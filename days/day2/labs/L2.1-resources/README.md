# L2.1 · Requests and Limits — Telling the Scheduler the Truth

| | |
|---|---|
| **Time** | 45 minutes |
| **Difficulty** | Two numbers, four consequences |
| **You need first** | Day 1 finished — `make validate-day1` passes |
| **You will change** | 6 Deployments get resource settings |
| **Check you are done** | `make validate-lab LAB=L2.1` |

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

Right now every AxisPay pod is running with **no resource settings at all**. That means two things, both bad:

- The scheduler has no idea how big they are, so it packs them onto nodes by guesswork.
- Nothing stops one pod eating all the memory on a node and taking its neighbours down with it.

You are going to measure what the services actually use, derive sensible numbers from those measurements, and apply them. Then you will deliberately cause the two failures those numbers prevent — **CPU throttling** and an **OOM kill** — so you recognise them when they happen for real.

The single most important idea: **requests and limits are read by two completely different things, for two completely different purposes.**

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `make validate-day1` | `DAY 1 CHECKPOINT PASSED` |
| 3 | `kubectl top nodes` | Numbers, not an error |

**If #3 says `Metrics API not available`**, the metrics server is not running. Enable it and wait a minute:

```bash
minikube addons enable metrics-server -p axispay
sleep 60
kubectl top nodes
```

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/00-governance-axispay-core.yaml` | Namespace budget and defaults — used properly in L2.2 |
| `manifests/01-deployment-edge-gateway.yaml` | The same four services from Day 1, now with resources |
| `manifests/02-deployment-auth-service.yaml` | |
| `manifests/03-deployment-merchant-service.yaml` | |
| `manifests/05-deployment-fraud-service.yaml` | New today — risk scoring |
| `manifests/06-deployment-routing-service.yaml` | New today — picks an acquirer |

---

## The idea, before the commands

```
  requests            READ BY THE SCHEDULER
  "reserve me this"   Decides which node you land on. Reserved whether
                      you use it or not. Too high = wasted money.
                      Too low = you land somewhere with no room to grow.

  limits              READ BY THE KERNEL, on the node
  "never exceed this" CPU over limit  -> THROTTLED (slowed down)
                      Memory over limit -> KILLED instantly (exit 137)
```

**Those are not two settings for the same thing.** The scheduler never looks at limits. The kernel never looks at requests. Getting this backwards is the single most common resource mistake.

And note the asymmetry, because it decides how you choose the numbers:

- **CPU is compressible.** Exceed the limit and you go slower. Unpleasant, survivable.
- **Memory is not.** Exceed the limit and the kernel kills the process. No warning, no slowdown, no negotiation.

---

## Step 1 — Measure before you decide

**Why we are doing this.** Numbers pulled out of the air are how clusters end up either broke or unschedulable. Measure first.

**Run this:**

```bash
kubectl top pods -n axispay-core --containers
kubectl top pods -n axispay-edge --containers
```

**What you should see:**

```
POD                               NAME              CPU(cores)   MEMORY(bytes)
merchant-service-7fc9b5d64-8vtkr  merchant-service  3m           48Mi
payment-service-7d4f8b9c6-h9mzt   payment-service   5m           61Mi
```

**What that means.** `3m` is three **millicores** — three thousandths of one CPU. `48Mi` is 48 mebibytes. These are idle figures; almost nothing is happening.

**Now put it under load and measure again.** Two terminals.

**Terminal 1:**

```bash
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080
```

**Terminal 2** — 200 payments as fast as it can:

```bash
for i in $(seq 1 200); do
  curl -s -o /dev/null -X POST http://localhost:8080/api/v1/payments \
    -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
    -H "Idempotency-Key: l21-load-$i" \
    -H 'Content-Type: application/json' \
    -d '{"merchant_reference":"AXP-L21","amount_minor":10000,"currency":"ZAR","card_token":"tok_visa_4242"}' &
done; wait; echo done
```

**Terminal 3** — watch while that runs:

```bash
watch -n2 kubectl top pods -n axispay-core --containers
```

`watch -n2` re-runs a command every 2 seconds. Stop it with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

**Write down the peak** CPU and memory you see for each service. Those are your inputs.

---

## Step 2 — Derive the numbers

**The rules AxisPay uses.** They are not laws, but they are defensible and you should be able to argue for them:

| Setting | Rule | Why |
|---|---|---|
| `requests.cpu` | steady-state usage **+ 30%** | The scheduler reserves this. Size for normal, not for peak — peak is what limits are for. |
| `limits.cpu` | peak **× 2** | Room to burst. Going over means throttling, which is survivable. |
| `requests.memory` | steady-state **+ 30%** | |
| `limits.memory` | peak **+ 50%**, and no more | Going over means **death**. But too generous and a leak goes unnoticed until it takes the node down. |

**Work out your own numbers for `payment-service` now**, before looking at the file. Write them down.

---

## Step 3 — Apply, and compare with your answer

```bash
grep -A6 'resources:' manifests/*.yaml | head -30
```

Compare with what you wrote. If you are within about 30%, your method is sound — the exact figures matter less than the reasoning.

```bash
kubectl apply -f manifests/
kubectl rollout status deployment/payment-service -n axispay-core --timeout=120s
```

**Confirm they took:**

```bash
kubectl get pods -n axispay-core -o custom-columns=\
'POD:.metadata.name,CPU_REQ:.spec.containers[0].resources.requests.cpu,CPU_LIM:.spec.containers[0].resources.limits.cpu,QOS:.status.qosClass'
```

---

## Step 4 — The three QoS classes

**Why we are doing this.** When a node runs out of memory, something has to be killed. Which pod dies is decided by a class Kubernetes assigns based on your numbers — and you did not choose it directly.

**Run this:**

```bash
kubectl get pods -A -o custom-columns='POD:.metadata.name,QOS:.status.qosClass' | sort -k2
```

**What that means:**

| Class | When you get it | Killed when the node is short |
|---|---|---|
| `Guaranteed` | requests **equal** limits, for every container | **Last** |
| `Burstable` | requests set, limits higher | Second |
| `BestEffort` | neither set | **First** |

Every AxisPay service is `Burstable`. That is deliberate: `Guaranteed` gives the best eviction protection and **zero burst headroom** — under a traffic spike the pod is throttled at exactly its request, which is the worst possible moment to have no room. AxisPay accepts slightly higher eviction risk in exchange for burst capacity.

Reasonable people choose differently. What matters is that it is a choice.

---

## Step 5 — Watch CPU throttling happen

**Why we are doing this.** So you recognise it. Throttling looks like "the service got slow for no reason", and it is invisible unless you know where to look.

**Run this** — a pod with a deliberately tiny CPU limit:

```bash
kubectl run cpu-victim -n axispay-core --restart=Never \
  --image=busybox:1.37 \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","command":["sh","-c","while true; do :; done"],"resources":{"requests":{"cpu":"50m"},"limits":{"cpu":"100m"}}}]}}'
sleep 30
kubectl top pod cpu-victim -n axispay-core
```

**What you should see:**

```
NAME         CPU(cores)   MEMORY(bytes)
cpu-victim   100m         0Mi
```

**Exactly 100m.** That loop would happily consume a whole CPU. The kernel is stopping it dead at the limit.

**See the throttling counter itself:**

```bash
kubectl exec cpu-victim -n axispay-core -- \
  cat /sys/fs/cgroup/cpu.stat 2>/dev/null | head -5
```

`throttled_usec` climbing is the proof. **Nothing is logged. No event fires. No alert.** The only symptom is latency.

```bash
kubectl delete pod cpu-victim -n axispay-core
```

---

## Step 6 — Watch a memory kill happen

**Why we are doing this.** This is the other failure, and it is completely different in character.

```bash
kubectl run mem-victim -n axispay-core --restart=Never \
  --image=busybox:1.37 \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","command":["sh","-c","dd if=/dev/zero of=/dev/shm/fill bs=1M count=200; sleep 300"],"resources":{"requests":{"memory":"32Mi"},"limits":{"memory":"64Mi"}}}]}}'
sleep 20
kubectl get pod mem-victim -n axispay-core
```

```
NAME         READY   STATUS      RESTARTS   AGE
mem-victim   0/1     OOMKilled   0          18s
```

**Now find the evidence** — this is the command that matters:

```bash
kubectl describe pod mem-victim -n axispay-core | grep -A5 'Last State'
```

```
Last State:     Terminated
  Reason:       OOMKilled
  Exit Code:    137
```

**Learn this shape.**

- **`Reason: OOMKilled`, exit code `137`** — the kernel killed it. Not Kubernetes, not the app.
- There was **no warning and no slowdown**. It was fine, then it was dead.
- **`kubectl logs` will show nothing useful** — the process did not get to say goodbye. You need `--previous` to see the dead container's output at all.

You will meet exactly this in this afternoon's incident.

```bash
kubectl delete pod mem-victim -n axispay-core
```

---

## Did it work?

```bash
make validate-lab LAB=L2.1
```

---

## Clean up

```bash
kubectl delete pod cpu-victim mem-victim -n axispay-core --ignore-not-found
```

Keep the resource settings — the rest of the week depends on them.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `kubectl top` says `Metrics API not available` | metrics-server not running or still starting | `minikube addons enable metrics-server -p axispay`, wait 60s |
| Pods `Pending` after applying | Requests now exceed what a node can offer | `kubectl describe pod <name>` and read the events. Lower the requests, or reduce replicas |
| `OOMKilled` on a real service | The memory limit is below its actual working set | Raise it — **but check for a leak first**. A limit is not a fix for unbounded growth |
| QoS says `BestEffort` | The resources block did not apply | `kubectl get deploy <name> -o yaml \| grep -A6 resources` |
| `cpu.stat` file not found | Older cgroup v1 layout | Try `/sys/fs/cgroup/cpu/cpu.stat` |
| Load loop produces `429` | Rate limiting is doing its job | Expected. Lower the count to 50 |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** From your own `kubectl top` readings, derive requests and limits for `edge-gateway` and justify the headroom. Compare with the supplied manifest and explain any difference.

**2.** Make `payment-service` `Guaranteed` QoS. Then explain in one paragraph why AxisPay deliberately does not do this in production. *(What happens to burst capacity, and what does that do to p99 during a spike?)*

**3.** A colleague sets `requests.cpu: 10m` and `limits.cpu: 2000m` "so it can burst". Explain what the scheduler does with that, what happens at load, and why a `maxLimitRequestRatio` exists.

---

## What you built

- **Six services with measured, defensible resource settings**
- **The knowledge that requests and limits are read by different things** — scheduler versus kernel
- **CPU throttling, seen** — silent, invisible, and the cause of unexplained latency
- **An OOM kill, seen** — `Reason: OOMKilled`, exit 137, no warning
- **QoS classes**, and why AxisPay accepts `Burstable` on purpose

**Next:** [L2.2 — Quota and LimitRange](../L2.2-quota-limitrange/) — the same numbers, enforced at the namespace level so nobody can opt out.
