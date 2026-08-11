# L2.4 · Autoscaling — More Pods, Automatically

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | One formula, and a dependency people miss |
| **You need first** | [L2.3](../L2.3-probes/) finished |
| **You will create** | 2 HorizontalPodAutoscalers |
| **Check you are done** | `make validate-lab LAB=L2.4` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## What you are going to do

AxisPay gets busy at lunchtime and quiet at 3am. Running six replicas all night wastes money; running two at noon drops payments.

You will create a **HorizontalPodAutoscaler** — a controller that watches CPU usage and changes the replica count for you. Then you will put real load through the platform and watch it react.

The thing most people get wrong: **the HPA measures usage against your `requests`, not against the limit and not against the machine.** The numbers you chose in L2.1 are what scaling is calculated from. Get them wrong and the autoscaler behaves strangely for reasons that look unrelated.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl top pods -n axispay-core` | Numbers, not an error |
| 3 | `kubectl get deploy payment-service -n axispay-core -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}'` | `100m` — **not empty** |

**#3 is the one that matters.** An HPA against a workload with no CPU request cannot compute a percentage of anything, and reports `<unknown>` forever.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-hpa-payment-service.yaml` | Both HPAs — payment and fraud. |

---

## Step 1 — Scale by hand first

**Why we are doing this.** So you can see what the autoscaler is doing on your behalf.

```bash
kubectl scale deployment/payment-service -n axispay-core --replicas=5
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
kubectl scale deployment/payment-service -n axispay-core --replicas=3
```

That works, and it requires a human to be awake and watching. Everything below automates exactly this.

---

## Step 2 — Prove the HPA needs requests

**Why we are doing this.** So that when you see `<unknown>` in the wild, you know within five seconds what it means.

```bash
kubectl create deployment norequests -n axispay-core --image=busybox:1.37 -- sleep 3600
kubectl autoscale deployment/norequests -n axispay-core --cpu-percent=50 --min=1 --max=3
sleep 30
kubectl get hpa norequests -n axispay-core
```

```
NAME         REFERENCE               TARGETS         MINPODS   MAXPODS   REPLICAS
norequests   Deployment/norequests   <unknown>/50%   1         3         1
```

**`<unknown>`.** Not an error, not a warning — just a number it cannot compute.

Wait — but L2.2's LimitRange gives defaults, so it *does* have a request. Look closer:

```bash
kubectl describe hpa norequests -n axispay-core | tail -8
```

If it reports a percentage, the LimitRange saved you. In a namespace **without** one, this stays `<unknown>` forever and the HPA silently does nothing.

**That is the connection worth carrying:** L2.1's requests and L2.2's LimitRange are what make L2.4 possible at all.

```bash
kubectl delete hpa,deployment norequests -n axispay-core
```

---

## Step 3 — Read the HPA, then apply it

```bash
cat manifests/01-hpa-payment-service.yaml
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payment-service
spec:
  scaleTargetRef:                     # ① what it scales
    apiVersion: apps/v1
    kind: Deployment
    name: payment-service
  minReplicas: 3                      # ② never below
  maxReplicas: 8                      # ③ never above
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70      # ④ 70% OF THE REQUEST
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0   # ⑤ react to a spike immediately
    scaleDown:
      stabilizationWindowSeconds: 300 # ⑥ come down slowly
```

| | What it means |
|---|---|
| ① | Which Deployment it drives. The HPA writes to `.spec.replicas` — which is why a chart that also sets that field fights it. |
| ② | A floor. Survives a node loss. |
| ③ | A ceiling. Protects the cluster and your budget. |
| ④ | **70% of the REQUEST**, not of the node and not of the limit. `payment-service` requests 100m, so this means "scale when average usage passes 70m". |
| ⑤ | Scale up with no delay. A payment spike cannot wait. |
| ⑥ | Scale down only after five minutes of calm, or you flap: scale down, load returns, scale up, repeat. |

### The formula

```
desiredReplicas = ceil( currentReplicas × currentUtilisation / targetUtilisation )
```

Three pods averaging 140% against a 70% target:

```
ceil( 3 × 140 / 70 ) = ceil(6) = 6 replicas
```

**Apply:**

```bash
kubectl apply -f manifests/01-hpa-payment-service.yaml
kubectl get hpa -n axispay-core
```

```
NAME              REFERENCE                    TARGETS   MINPODS   MAXPODS   REPLICAS
fraud-service     Deployment/fraud-service     4%/65%    2         6         2
payment-service   Deployment/payment-service   5%/70%    3         8         3
```

**`5%/70%`** — current against target. If yours says `<unknown>`, wait sixty seconds for metrics.

---

## Step 4 — Generate real load and watch

**Three terminals.**

**Terminal 1 — watch the HPA:**

```bash
watch -n5 kubectl get hpa,pods -n axispay-core -l app.kubernetes.io/name=payment-service
```

**Terminal 2 — a tunnel:**

```bash
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080
```

**Terminal 3 — sustained load for three minutes:**

```bash
END=$((SECONDS+180))
while [ $SECONDS -lt $END ]; do
  for i in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null -X POST http://localhost:8080/api/v1/payments \
      -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
      -H "Idempotency-Key: l24-$SECONDS-$i" \
      -H 'Content-Type: application/json' \
      -d '{"merchant_reference":"AXP-L24","amount_minor":25000,"currency":"ZAR","card_token":"tok_visa_4242"}' &
  done
  wait
done
echo "load finished"
```

**What you should see in terminal 1**, over two or three minutes:

```
NAME              TARGETS    MINPODS   MAXPODS   REPLICAS
payment-service   132%/70%   3         8         6
```

New pods appear. Confirm the arithmetic yourself: at 132% with a 70% target and 3 replicas, `ceil(3 × 132 / 70) = ceil(5.65) = 6`.

---

## Step 5 — Read the decisions

```bash
kubectl describe hpa payment-service -n axispay-core | tail -15
```

```
Events:
  Type    Reason             Age   Message
  ----    ------             ----  -------
  Normal  SuccessfulRescale  2m    New size: 5; reason: cpu resource utilization above target
  Normal  SuccessfulRescale  1m    New size: 6; reason: cpu resource utilization above target
```

**The HPA writes down why it did what it did.** When someone asks "why did we have eight pods at 2am", this is the answer.

---

## Step 6 — Watch it come down, slowly

Stop the load (<kbd>Ctrl</kbd>+<kbd>C</kbd> in terminal 3) and keep watching terminal 1.

**Nothing happens for five minutes.** Then the count drops.

**That is `stabilizationWindowSeconds: 300` from ⑥.** Without it you get flapping: scale down, load returns, scale up, scale down — and every cycle throws away warm pods and connection pools.

**Up fast, down slow.** The asymmetry is the point: being slow to add capacity costs you payments; being slow to remove it costs you a few cents.

---

## Step 7 — What autoscaling cannot fix

**Why we are doing this.** So you do not reach for an HPA when it is the wrong tool.

```bash
kubectl scale deploy/merchant-service -n axispay-core --replicas=0
# ... put load through again ...
kubectl scale deploy/merchant-service -n axispay-core --replicas=2
```

More `payment-service` pods do not help at all — every one of them is waiting on the same missing dependency.

**An HPA only fixes "not enough of me".** It cannot fix:

- a slow or missing dependency
- a database that is the bottleneck (more clients make it worse)
- a memory leak
- a service whose work is **waiting**, not computing

That last one applies to `payment-service` in reality: it spends most of its time waiting on the acquirer, not burning CPU. CPU is a mediocre signal for it, and the better answer — scaling on requests-in-flight or queue depth — needs custom metrics. Signposted, not built, in this course.

---

## Did it work?

```bash
make validate-lab LAB=L2.4
```

---

## Clean up

```bash
kubectl get hpa -n axispay-core     # leave them; Day 5 uses them
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `TARGETS` shows `<unknown>` | No CPU request, or metrics-server not ready | Check requests are set; `kubectl top pods` must work |
| HPA never scales up | Load is not reaching the pods, or is too light | `kubectl top pods` during the load — is CPU actually rising? |
| Scales to max instantly | Target too low, or requests too small | Compare `kubectl top` against the request |
| New pods stay `Pending` | Quota or node capacity exhausted | `kubectl describe pod <name>`; check `kubectl describe resourcequota` |
| Replicas keep flapping | Stabilisation window too short | It is 300s here on purpose |
| `FailedGetResourceMetric` | metrics-server unhealthy | `kubectl get pods -n kube-system \| grep metrics` |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** `fraud-service` has `maxReplicas: 6` on a 3-node cluster. Work out whether that fits the ResourceQuota from L2.2 at full stretch. Show the arithmetic.

**2.** Compute from the formula how many replicas the HPA asks for when 4 pods each sit at 140% against a 70% target. Then verify against a real `kubectl describe hpa`.

**3.** `payment-service` spends most of its time waiting on the acquirer, not using CPU. Explain why CPU is a poor scaling signal here, and what you would scale on instead.

---

## What you built

- **Two autoscalers**, driving replica counts from real load
- **The formula**, verified against what the HPA actually did
- **Proof that the HPA measures against your ** — L2.1's numbers, doing work you did not expect
- **Up fast, down slow**, and why flapping is worse than briefly over-provisioning
- **A clear sense of what autoscaling cannot fix**

**Next:** [L2.5 — Workload types](../L2.5-workload-types/) — because not everything is a Deployment, and modelling it wrongly is a common and expensive mistake.
