# L5.6 · From a Spike on a Graph to the Line That Caused It

| | |
|---|---|
| **Time** | 45 minutes |
| **Difficulty** | The payoff for something you did on Monday |
| **You need first** | [L5.5](../L5.5-metrics-and-dashboards/) finished |
| **You will do** | Trace one payment across seven services; prove alert routing |
| **Check you are done** | `make validate-lab LAB=L5.6` |

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

On Monday you implemented `X-Correlation-Id` in `edge-gateway` and were told you would find out why on Friday.

This is Friday. You will take a payment reference, find its correlation ID, and produce **every log line from all seven services that touched it, in order, with a duration on each** — in one query.

Then you will prove alert routing rather than assuming it, which is a thing almost nobody does and which takes thirty seconds.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-observability \| grep -E 'loki\|alloy'` | Both `Running` |

**If Loki is missing**, you installed with `--metrics-only`. Steps 1–6 will not run; **steps 7–8 still work** and are the more assessable half.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | Alert routing, the alert sink, and the observability policies |

---

## The one rule that governs Loki

```
  Loki indexes LABELS. Content is SCANNED.

  -> a query MUST start with a label selector
  -> filtering on content (| json | level="error") is a scan
  -> a high-cardinality label creates one stream per value, and will
     take the platform down
```

Everything below follows from that.

---

## Step 1 — Why the logs are usable at all

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n axispay-core $POD --tail=3 | jq .
```

One JSON object per line, on **stdout**, with `service`, `pod`, `correlation_id` and `duration_ms` on every record.

**Nothing writes to a file.** A container that logs to `/var/log/app.log` produces logs nobody can read and that vanish on restart. You met that rule on Day 1; this is the payoff.

---

## Step 2 — Make a payment and keep its ID

```bash
RESP=$(curl -sk -i -X POST https://api.axispay.local/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: l56-trace-001' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-4471-ZA","amount_minor":845000,"currency":"ZAR","card_token":"tok_visa_4242"}')

CID=$(echo "$RESP" | grep -i '^x-correlation-id:' | awk '{print $2}' | tr -d '\r')
echo "correlation id: $CID"
```

---

## Step 3 — Follow it across every service

```bash
kubectl -n axispay-observability port-forward svc/loki-gateway 3100:80 >/dev/null 2>&1 &
sleep 3

curl -s -G 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode "query={namespace=~\"axispay-.*\"} | json | correlation_id=\"$CID\"" \
  --data-urlencode "start=$(date -u -d '10 minutes ago' +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  --data-urlencode 'limit=100' \
  | jq -r '.data.result[].values[][1]' \
  | jq -r '[.ts, .service, .msg, (.duration_ms // "-" | tostring)] | @tsv' | sort
```

```
02:14:07  edge-gateway      request            1247.3
02:14:07  auth-service      request               3.1
02:14:07  payment-service   payment created    1198.7
02:14:07  merchant-service  request               4.8
02:14:07  fraud-service     risk assessed      1102.4   <-- here
02:14:08  routing-service   request              12.2
02:14:08  ledger-service    journal posted        6.9
```

**One request, one ID, every service it touched, in order, with a duration on each.** The slow hop is obvious.

Do the same in Grafana Explore, which is where you will actually work:

```
{namespace=~"axispay-.*"} | json | correlation_id="<paste>"
```

---

## Step 4 — Scans versus index lookups

```bash
curl -s -G 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={namespace=~"axispay-.*"} | json | duration_ms > 500' \
  --data-urlencode "start=$(date -u -d '30 minutes ago' +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" \
  | jq -r '.data.result[].values[][1]' | jq -r '[.service, .route, (.duration_ms|tostring)] | @tsv' \
  | sort -k3 -rn | head
```

**`| json | duration_ms > 500` is a scan, not an index lookup.** It is fast here only because the label selector already narrowed it to a few namespaces over thirty minutes. **The label selector is not optional — it is what makes the query finite.**

---

## Step 5 — What a high-cardinality label would do

```bash
grep -A4 'target_label' charts/observability/alloy-values.yaml | head -25
```

Five labels: `namespace`, `service`, `pod`, `container`, `node`. **All bounded.**

> **Every distinct combination of label values is a separate Loki stream**, with its own index entry and chunks. `correlation_id` is unique per request. At 20 requests per second that is **1.7 million streams a day**, from one service.
>
> The symptom is not "the label is wrong". It is Loki running out of memory and the log platform going down **during the incident you needed it for**. The identical trap exists in Prometheus with a label like `payment_id`.

---

## Step 6 — Connect the graph to the log

```bash
grep -A8 'derivedFields' charts/observability/kube-prometheus-stack-values.yaml
```

In Grafana, open **AxisPay — Payment Platform**, scroll to the logs panel, and click a log line. The `correlation_id` is a link.

**Latency spike → click a log line → the full cross-service trace.** That is the payoff for a header minted on Monday by a service that had no idea why.

---

## Step 7 — Prove alert routing instead of assuming it

```bash
kubectl -n axispay-observability port-forward svc/alert-sink 8080:8080 >/dev/null 2>&1 &
sleep 2
curl -s localhost:8080/api/v1/routes | jq .
kubectl -n axispay-observability logs -f deploy/alert-sink &
```

**Break something and let a real alert flow through:**

```bash
kubectl -n axispay-core set env deployment/payment-service FORCE_DOWNSTREAM_FAILURE=true
kubectl -n axispay-core rollout status deployment/payment-service --timeout=120s
kubectl scale deployment/loadgen -n axispay-ops --replicas=1
```

Watch it move through three states:

```bash
curl -s localhost:9090/api/v1/alerts | jq -r '.data.alerts[] | "\(.labels.alertname) \(.state)"'   # pending
curl -s localhost:9093/api/v2/alerts | jq -r '.[] | "\(.labels.alertname) \(.status.state)"'       # firing
curl -s localhost:8080/api/v1/routes | jq .                                                        # delivered
```

**The assertion that matters:**

```bash
curl -s 'localhost:8080/api/v1/alerts?channel=payments' | jq -r '.alerts[] | .alertname'
curl -s 'localhost:8080/api/v1/alerts?channel=finance'  | jq -r '.matched'
```

`AxisPayPaymentErrorRateHigh` on `payments`, and `0` on `finance`.

> **A route that matches too broadly looks identical to a correct one** until the wrong team is paged at 03:00. This is the only way to know, and it takes thirty seconds.

---

## Step 8 — One fault, one page

```bash
grep -A6 'inhibitRules' manifests/03-alertmanager-config.yaml | head -20
curl -s localhost:9093/api/v2/alerts | jq -r '.[] | "\(.labels.alertname) \(.status.inhibitedBy | length) inhibitors"'
```

When `payment-service` has no ready endpoints, its error rate is also high and its latency is also bad — **three alerts describing one fault**. The inhibit rules suppress the two that are downstream.

**Inhibition is what makes an on-call rotation survivable.** Without it one bad node produces eight pods' worth of pages, and the person receiving them starts filtering the channel — which is the real failure.

**Restore:**

```bash
kubectl -n axispay-core set env deployment/payment-service FORCE_DOWNSTREAM_FAILURE-
kubectl -n axispay-core rollout status deployment/payment-service --timeout=120s
curl -s 'localhost:8080/api/v1/alerts?status=resolved' | jq -r '.alerts[] | .alertname'
curl -s -X DELETE localhost:8080/api/v1/alerts | jq .
```

`sendResolved: true` is why the resolve arrived. Without it the channel fills with problems and never with endings.

---

## Did it work?

```bash
make validate-lab LAB=L5.6
make validate-day5
```

---

## Clean up

```bash
kubectl -n axispay-core set env deployment/payment-service FORCE_DOWNSTREAM_FAILURE-
kubectl scale deployment/loadgen -n axispay-ops --replicas=0
kill %1 %2 %3 2>/dev/null || true
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| No logs in Loki | Alloy not running | It needs `privileged` PSA for hostPath |
| Logs present, `\| json` empty | Not JSON, or `LOG_LEVEL` changed the format | `kubectl logs ... \| jq .` |
| Query times out | No label selector, or too wide a range | Always start with `{namespace=...}` |
| Alert firing, sink empty | Route matchers do not match the labels | Compare with `03-alertmanager-config.yaml` |
| Alert pending forever | The `for:` clause | That is the design. Shorten it to test |
| Two teams paged for one fault | Inhibit labels do not match | `equal:` must name labels on **both** alerts |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/05-security-packaging-and-operations/solutions.md).

**1.** Given only the payment reference `AXP-4471-ZA` — no correlation ID — produce the complete cross-service log trail. Write it as a single shell function an on-call engineer could paste at 02:00.

**2.** Alloy promotes `level` to a label. Argue both sides, measure the stream count, and decide.

---

## What you built

- **One payment traced across seven services from a single ID**
- **The distinction between an index lookup and a scan**, and why the label selector is mandatory
- **The cardinality arithmetic**, and the failure it prevents
- **Alert routing proven rather than assumed**
- **Inhibition turning one fault into one page**

**Next:** [The capstone](../../../capstone/). Everything you built this week, upgraded under live traffic, with three faults injected and nobody telling you what they are.
