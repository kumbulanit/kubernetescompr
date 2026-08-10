# L5.5 · Golden Signals, and the One That Fires on Silence

| | |
|---|---|
| **Time** | 55 minutes |
| **Difficulty** | The module that pays back the whole week |
| **You need first** | [L5.4](../L5.4-promotion/) finished, and `make observability` run |
| **You will create** | ServiceMonitors, alert rules, 2 dashboards |
| **Check you are done** | `make validate-lab LAB=L5.5` |

> **The most valuable alert you build today fires when nothing is happening.**

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

AxisPay has an SLO — 99.5% availability, 300 ms p99 — and no way to compute it. The platform team says it was met last quarter; the merchant integration team has a spreadsheet and disagrees. Neither can settle it, because "availability" was never defined in a way a machine could evaluate.

You will make it a query. Along the way you will deliberately break Prometheus discovery, because "target missing" and "target down" are entirely different problems and the difference is worth knowing cold.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-observability` | Prometheus, Grafana, operator — `Running` |

**If #2 is empty**, install the stack now. It pulls about 1.5 GB:

```bash
make observability
```

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | ServiceMonitors, PrometheusRules, the generated dashboards |

---

## Step 1 — Start at the source

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8080/metrics').read().decode())" \
  | grep -E '^axispay_' | head -12
```

**That is the whole contract:** a text endpoint, one line per series. **Prometheus is a poller** — nothing is pushed. Which gives you a free liveness signal, means no service needs to know where monitoring lives, and means a monitoring outage cannot back-pressure your application.

---

## Step 2 — Break discovery on purpose

```bash
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-prometheus 9090 >/dev/null 2>&1 &
sleep 3
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job|test("axispay")) | "\(.labels.job) \(.health)"' | sort -u
```

Now remove the label that makes a ServiceMonitor visible:

```bash
kubectl label servicemonitor axispay-core -n axispay-core release- --overwrite
sleep 45
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job|test("axispay-core")) | .labels.job' | sort -u
```

**Nothing. Not `down` — absent.**

> **A target that is DOWN and a target that is MISSING are completely different problems.**
>
> - `down` — Prometheus tried and failed: network, port, path, readiness.
> - *missing* — Prometheus never knew about it: the ServiceMonitor was not selected.
>
> kube-prometheus-stack selects on `release: kube-prometheus-stack`. A ServiceMonitor without that label is correct YAML, a valid object, and **zero targets**. This is the most common real ticket in the whole observability stack.

```bash
kubectl label servicemonitor axispay-core -n axispay-core release=kube-prometheus-stack --overwrite
sleep 45
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job|test("axispay-core")) | "\(.labels.job) \(.health)"' | sort -u
```

---

## Step 3 — Traffic worth measuring

```bash
kubectl scale deployment/loadgen -n axispay-ops --replicas=1
kubectl rollout status deployment/loadgen -n axispay-ops --timeout=90s
sleep 60
```

---

## Step 4 — The four golden signals

Open <http://localhost:9090> and run each.

**Traffic**

```promql
sum by (service) (rate(axispay_http_requests_total[5m]))
```

**Errors — and note that only 5xx counts**

```promql
sum(rate(axispay_http_requests_total{status=~"5.."}[5m]))
  / sum(rate(axispay_http_requests_total[5m]))
```

A `409` from a fraud decline and a `402` for insufficient funds are the system **working correctly**. Counting them would burn your error budget on the risk engine doing its job, and train the on-call to ignore the alert.

**Latency — run both of these**

```promql
rate(axispay_http_request_duration_seconds_sum{service="payment-service"}[5m])
  / rate(axispay_http_request_duration_seconds_count{service="payment-service"}[5m])

histogram_quantile(0.99, sum by (le) (
  rate(axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))
```

**The average will look fine while the p99 does not.** If 99 requests take 10 ms and one takes 3 s, the mean is 40 ms — and one merchant in a hundred waited three seconds. The SLO is written on the p99 because that is the customer you are about to lose.

**Saturation — against the REQUEST**

```promql
sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="axispay-core",container!=""}[5m]))
  / sum by (pod) (kube_pod_container_resource_requests{namespace="axispay-core",resource="cpu"})
```

Not the limit, not the node. The request — because that is what the HPA divides by.

---

## Step 5 — The dimension you did not emit

```promql
sum by (acquirer) (rate(axispay_payments_total{status=~"captured|authorized"}[5m]))
  / sum by (acquirer) (rate(axispay_payments_total[5m]))
```

**Nothing.** Find out why:

```bash
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8080/metrics').read().decode())" \
  | grep '^axispay_payments_total' | head -3
```

Labels are `service`, `status`, `currency`. **There is no `acquirer`.**

> **You cannot query a dimension you did not emit.** Adding it means a code change and a deploy — and it should be deliberate. `acquirer` has four values, so it is safe. `merchant_id` has 25 today and 25,000 next year, and would multiply every series by 25,000. **Cardinality is a design decision made at the counter, not at the query.**

---

## Step 6 — The alert that fires on silence

```promql
sum(rate(axispay_payments_total[10m])) == 0
```

**Watch it become true:**

```bash
kubectl scale deployment/loadgen -n axispay-ops --replicas=0
```

**Everything else stays green.** Every pod Ready. No error ratio elevated — the numerator and denominator are both zero. Latency perfect, because there is no traffic to be slow. **Not one infrastructure alert will fire.**

In the real world the cause is upstream of the cluster entirely: a DNS record pointing at the old load balancer, an expired merchant API key, a CDN rule swallowing POSTs.

**Alerting on the absence of traffic is the only way to see it**, and most platforms discover they need it the expensive way.

```bash
kubectl scale deployment/loadgen -n axispay-ops --replicas=1
```

---

## Step 7 — Dashboards as data

```bash
kubectl get configmap -n axispay-observability -l grafana_dashboard=1
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-grafana 3000:80 >/dev/null 2>&1 &
sleep 3
echo "http://localhost:3000   admin / axispay-training"
```

**There is no import step.** A sidecar watches for that label and provisions whatever JSON it finds.

Open **AxisPay — Payment Platform** and work down it. Then edit a panel in the UI and:

```bash
kubectl rollout restart deployment/kube-prometheus-stack-grafana -n axispay-observability
kubectl rollout status deployment/kube-prometheus-stack-grafana -n axispay-observability
```

**Your change is gone.** The ConfigMap is the source of truth.

```bash
# the supported way
$EDITOR scripts/build/build-dashboards.py
make dashboards
kubectl apply -f manifests/
```

**A dashboard is data.** Clicking around and exporting produces something nobody can review, diff or roll back.

---

## Step 8 — Validate every query in the repository

```bash
make validate-promql
```

**A PromQL typo does not fail loudly.** Prometheus accepts the rule, it evaluates to an empty vector, and the alert simply never fires — you find out during the incident it was written for. This parses all 47 expressions and checks every metric name against what actually exists.

---

## Did it work?

```bash
make validate-lab LAB=L5.5
```

---

## Clean up

```bash
kubectl scale deployment/loadgen -n axispay-ops --replicas=0
kill %1 %2 2>/dev/null || true
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Target **missing** entirely | ServiceMonitor lacks `release: kube-prometheus-stack` | Add the label; wait 45s |
| Target **down**, connection refused | Wrong port name, or the pod is unready | The ServiceMonitor uses the port **name** |
| Target down, deadline exceeded | Timeout, or a NetworkPolicy | Check `allow-prometheus-scrape` |
| Query returns nothing | That label does not exist on that metric | Read `/metrics` |
| `histogram_quantile` returns NaN | No observations in the window | Generate traffic or widen the range |
| Dashboard missing | ConfigMap label wrong, or sidecar down | `kubectl logs -n axispay-observability -l app.kubernetes.io/name=grafana -c grafana-sc-dashboard` |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/05-security-packaging-and-operations/solutions.md).

**1.** Write the alert for "any acquirer's approval rate below 85% over 5 minutes". You will find you cannot. Do the work properly: add the label, justify the cardinality with arithmetic, rebuild, and write the alert.

**2.** The p50/p99 panel shows a gap under load. Find out whether it is one slow replica or all of them — and note that an average across pods hides it completely.

---

## What you built

- **The SLO as a query**, not an opinion
- **Missing versus down**, produced deliberately
- **Four golden signals**, and why the average is the wrong number
- **The alert that fires on silence**, and why nothing else would catch it
- **Dashboards in version control**, and proof that UI edits vanish
- **47 PromQL expressions validated in CI**

**Next:** [L5.6 — Logs and alerts](../L5.6-logs-and-alerts/) — Monday's header finally pays off.
