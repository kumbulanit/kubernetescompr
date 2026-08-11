# L2.6 · Release Under Live Traffic, and Drop Nothing

| | |
|---|---|
| **Time** | 55 minutes |
| **Difficulty** | Everything from today, working together |
| **You need first** | [L2.5](../L2.5-workload-types/) finished |
| **You will do** | Upgrade 1.0.0 → 1.1.0 while payments are flowing |
| **Check you are done** | `make validate-lab LAB=L2.6` |

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

You will upgrade `payment-service` from 1.0.0 to 1.1.0 **while real payments are going through it**, and prove afterwards that not one request failed.

Then you will remove the safety mechanisms one at a time and watch requests start failing — so you know which piece was doing what.

**Nothing new is introduced here.** Every mechanism is something you built earlier today. This lab is where they combine.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-core` | All `1/1 Running` |
| 3 | `minikube -p axispay image ls \| grep payment-service` | Both `1.0.0` **and** `1.1.0` |

**If 1.1.0 is missing:**

```bash
eval $(minikube -p axispay docker-env)
IMAGE_TAG=1.1.0 make build
```

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-deployment-payment-service-v1.1.0.yaml` | The new version, with the rollout settings you will study |

---

## The four things that make this work

You already built all of them:

| Mechanism | From | What it does here |
|---|---|---|
| **Readiness probe** | L2.3 | Traffic only reaches a new pod once it says it is ready |
| **`maxUnavailable: 0`** | this lab | Capacity never drops below 100% during the release |
| **`preStop` + grace period** | this lab | The dying pod finishes in-flight requests before exiting |
| **Multiple replicas** | L1.4 | There is somewhere else for traffic to go |

Remove any one and requests start failing. You will prove that in Step 6.

---

## Step 1 — Measure before you change anything

**Why we are doing this.** You cannot claim zero downtime without a number from before, during and after.

**Terminal 1 — tunnel:**

```bash
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080
```

**Terminal 2 — continuous traffic, counting every result.** Leave this running for the whole lab:

```bash
OK=0; FAIL=0
while true; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8080/api/v1/payments \
    -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
    -H "Idempotency-Key: l26-$(date +%s%N)" \
    -H 'Content-Type: application/json' \
    -d '{"merchant_reference":"AXP-L26","amount_minor":15000,"currency":"ZAR","card_token":"tok_visa_4242"}')
  if [ "$CODE" = "201" ]; then OK=$((OK+1)); else FAIL=$((FAIL+1)); echo "  !! $CODE at $(date +%T)"; fi
  printf "\rok=%d fail=%d " $OK $FAIL
  sleep 0.2
done
```

**What you should see:** `ok` climbing, `fail` staying at 0. Any non-201 prints a line with a timestamp.

---

## Step 2 — Watch in two more places

**Terminal 3 — the pods:**

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service -w
```

**Terminal 4 — the endpoints, which is where the truth is:**

```bash
watch -n1 'kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service -o jsonpath="{.items[0].endpoints[*].addresses[0]}"; echo'
```

You now have: traffic, pods, and routing, side by side.

---

## Step 3 — Read the rollout settings, then release

```bash
grep -B2 -A12 'strategy:' manifests/01-deployment-payment-service-v1.1.0.yaml
```

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0            # ① never lose capacity
    maxSurge: 1                  # ② one extra pod at a time
terminationGracePeriodSeconds: 45  # ③
...
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "8"]   # ④ the one people leave out
```

| | What it means |
|---|---|
| ① | **Never** go below the desired replica count. Kubernetes must add before it removes. |
| ② | At most one extra pod above the desired count while rolling. Slower, cheaper, safer. |
| ③ | After SIGTERM, wait up to 45 seconds for a clean exit before SIGKILL. |
| ④ | **Sleep 8 seconds before shutting down.** Explained in Step 5 — it is the least obvious and most important line here. |

**Release it:**

```bash
kubectl apply -f manifests/01-deployment-payment-service-v1.1.0.yaml
kubectl rollout status deployment/payment-service -n axispay-core
```

**Watch all four terminals while it runs.** In terminal 3 you will see a new pod appear, become ready, and only then an old one begin terminating — one at a time.

---

## Step 4 — Confirm it really is the new version

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
```

Every line should end `:1.1.0`.

```bash
kubectl rollout history deployment/payment-service -n axispay-core
```

Two revisions now. Revision 1 is what you roll back to in Step 7.

---

## Step 5 — The proof

**Look at terminal 2.** `fail` should still read **0**.

```
ok=847 fail=0
```

**You replaced every pod of a running payment service and not one request failed.**

### Why `preStop: sleep 8` matters more than it looks

When a pod is deleted, two things happen **at the same time**, not in sequence:

1. The endpoints controller removes it from the Service.
2. The kubelet sends SIGTERM to the container.

Step 1 has to propagate to every node's kube-proxy, which takes a moment. So there is a window where the pod has begun shutting down but traffic is still being sent to it.

`preStop: sleep 8` makes the container wait before the shutdown begins, so removal wins the race.

**Without it you get a handful of connection-refused errors on every single release** — few enough to look like noise, frequent enough that someone eventually spends a week hunting them. Prove it in the next step.

---

## Step 6 — Remove the safety net, one piece at a time

**Keep the load running in terminal 2 throughout.**

### 6a — Remove the preStop hook

```bash
kubectl patch deployment payment-service -n axispay-core --type=json \
  -p='[{"op":"remove","path":"/spec/template/spec/containers/0/lifecycle"}]'
kubectl rollout status deployment/payment-service -n axispay-core
```

**Watch terminal 2.** You will very likely see a few failures — `000` (connection refused) or `502`.

**Write down the count.** That is the cost of one missing line.

### 6b — Allow capacity to drop

```bash
kubectl patch deployment payment-service -n axispay-core --type=json \
  -p='[{"op":"replace","path":"/spec/strategy/rollingUpdate/maxUnavailable","value":1}]'
kubectl set env deployment/payment-service -n axispay-core ROLLOUT_MARKER=b
kubectl rollout status deployment/payment-service -n axispay-core
```

More failures — now old pods are removed *before* replacements are ready.

### 6c — Remove the readiness probe

```bash
kubectl patch deployment payment-service -n axispay-core --type=json \
  -p='[{"op":"remove","path":"/spec/template/spec/containers/0/readinessProbe"}]'
kubectl set env deployment/payment-service -n axispay-core ROLLOUT_MARKER=c
kubectl rollout status deployment/payment-service -n axispay-core
```

**This is the worst one.** Without readiness, a pod receives traffic the instant its process starts — before it has connected to anything. Expect a burst of `502`s.

**Restore everything:**

```bash
kubectl apply -f manifests/01-deployment-payment-service-v1.1.0.yaml
kubectl rollout status deployment/payment-service -n axispay-core
```

`fail` stops climbing.

**Compare your four numbers.** That table — full safety, no preStop, no maxUnavailable, no readiness — is the argument for every one of those settings, in your own measurements.

---

## Step 7 — Roll back a bad release

```bash
kubectl set image deployment/payment-service -n axispay-core \
  payment-service=axispay/payment-service:9.9.9-broken
sleep 30
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
```

New pods are stuck in `ImagePullBackOff` — **and terminal 2 keeps saying `fail=0`**.

**That is `maxUnavailable: 0` protecting you.** The old pods are not removed until new ones are ready, and they never become ready, so the release simply stalls with the service still up.

**Roll back:**

```bash
kubectl rollout undo deployment/payment-service -n axispay-core
kubectl rollout status deployment/payment-service -n axispay-core
```

> **This is exactly INC-1 from yesterday**, seen from the other side. Yesterday you found a broken image tag after it happened. Today you watched the rollout strategy contain it.

---

## Step 8 — Watch a graceful shutdown

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n axispay-core $POD -f &
kubectl delete pod $POD -n axispay-core
sleep 15; kill %1 2>/dev/null
```

```json
{"level":"info","msg":"SIGTERM received, draining"}
{"level":"info","msg":"in-flight requests complete","count":3}
{"level":"info","msg":"shutdown complete"}
```

**The application was told, and it finished its work.** That is the sequence:

```
delete → endpoints removed  ─┐
                             ├─ (preStop sleep 8 covers the gap)
       → SIGTERM ────────────┘
       → app drains in-flight requests
       → app exits
       → (SIGKILL after 45s, if it had not)
```

Stop the load in terminal 2 with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

---

## Did it work?

```bash
make validate-lab LAB=L2.6
make validate-day2
```

---

## Clean up

```bash
kubectl apply -f manifests/01-deployment-payment-service-v1.1.0.yaml
```

Stay on 1.1.0 — Day 5's capstone upgrades from here to 2.0.0.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Failures even with everything correct | Only one replica | `kubectl get deploy payment-service -n axispay-core` — you need at least 2 |
| Rollout hangs at "Waiting for..." | New pods never become ready | `kubectl get pods` then `describe` the new one |
| `fail` climbing constantly, not just during rollout | Something else is broken | Check `merchant-service` is `1/1` |
| `image not found` for 1.1.0 | Not built | `eval $(minikube -p axispay docker-env)` then `IMAGE_TAG=1.1.0 make build` |
| `rollout undo` says no history | Only one revision | `kubectl apply -f manifests/` |
| Load script shows `000` | Connection refused — nothing listening | Expected during 6a and 6c. Otherwise check the tunnel |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** Set `maxSurge: 0` **and** `maxUnavailable: 0` together. Predict what happens before applying. Then apply it and explain.

**2.** Measure how long a full rollout of 3 replicas takes with `maxSurge: 1`, then with `maxSurge: 3`. What did the speed cost you?

**3.** Your service takes 40 seconds to drain but `terminationGracePeriodSeconds` is 30. What exactly happens to the requests still in flight at second 30? Which signal arrives, and can the application catch it?

---

## What you built

- **A live upgrade of a payment service with zero failed requests**, measured rather than asserted
- **Four mechanisms proven by removing them** — and your own failure counts for each
- **An understanding of the endpoint-removal race**, and why `preStop` exists
- **A bad release contained by `maxUnavailable: 0`** — INC-1 from the other side
- **A graceful shutdown observed in the logs**, end to end

**Next:** [INC-2 — Your second incident](../INC-2-oomkill-crashloop/). Something breaks in a way you have already seen once today.
