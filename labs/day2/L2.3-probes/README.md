# L2.3 · Health Probes — Thirty Lines That Decide Everything

| | |
|---|---|
| **Time** | 55 minutes |
| **Difficulty** | The most consequential lab of the week |
| **You need first** | [L2.2](../L2.2-quota-limitrange/) finished |
| **You will change** | All 6 Deployments get 3 probes each |
| **Check you are done** | `make validate-lab LAB=L2.3` |

> **If you only properly learn one lab this week, make it this one.** Probes are thirty lines of YAML that decide whether a bad deploy is invisible or an outage.

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

Your services have no health checks. That means Kubernetes has exactly one way to judge them: **is the process still running?** A process that is running but wedged, or running but unable to reach its database, looks perfectly healthy — and keeps receiving traffic.

You will add three probes to every service. Then you will:

- watch readiness **remove a pod from traffic** without restarting it
- deliberately build the classic mistake — a liveness probe that checks a dependency — and watch it turn one slow database into a cluster-wide restart storm

**Learn the three probes by their CONSEQUENCE, not their names.** The names are almost useless; the consequences are everything.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-core` | Pods `1/1 Running` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/0*-deployment-*.yaml` | The six services, now with all three probes |
| `manifests/00-governance-axispay-core.yaml` | The quota from L2.2, unchanged |

---

## The three probes, by consequence

```
  livenessProbe    FAILS -> the container is RESTARTED
                   "Are you alive? Would restarting help?"
                   Point it at something ONLY a restart can fix.

  readinessProbe   FAILS -> the pod is REMOVED FROM SERVICE ENDPOINTS
                   "Can you serve a request right now?"
                   The pod keeps running. It just stops receiving traffic.
                   THIS is where dependency checks belong.

  startupProbe     While it runs, LIVENESS IS SUSPENDED
                   "Have you finished starting?"
                   Exists so slow starters are not killed mid-boot.
```

Read those three consequences again. Everything in this lab follows from them.

---

## Step 1 — See the problem you are about to fix

**Why we are doing this.** Believing that a running process can be useless is easier once you have watched it happen.

**Run this** — it tells a payment pod to start failing its readiness check, using a test endpoint the application provides:

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
echo "using $POD"
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/api/v1/_admin/unready',data=b'')" 2>/dev/null
```

**Now look:**

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service
```

**What you should see.** The pod is still `1/1 Running`, and it is **still in the endpoint list** — still receiving traffic it cannot serve.

**What that means.** Without a readiness probe, Kubernetes has no way to know. The application knows perfectly well it is not ready; nobody is asking it.

That is the gap you are about to close.

---

## Step 2 — Read the probe definitions

```bash
grep -B2 -A30 'Probe' manifests/01-deployment-edge-gateway.yaml | head -45
```

```yaml
startupProbe:                       # ① runs FIRST, alone
  httpGet:
    path: /startupz
    port: http
  periodSeconds: 2
  failureThreshold: 30              # ② up to 60 seconds to start
livenessProbe:
  httpGet:
    path: /healthz                  # ③ NEVER /readyz
    port: http
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3               # ④ 3 failures before restarting
readinessProbe:
  httpGet:
    path: /readyz                   # ⑤ this one checks dependencies
    port: http
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2               # ⑥ react faster than liveness
```

| | What it means |
|---|---|
| ① | The startup probe runs first. **While it is running, the liveness probe does not.** |
| ② | 30 failures × 2 seconds = 60 seconds of grace. A slow starter is not killed mid-boot. |
| ③ | **Liveness points at `/healthz`, which checks nothing external.** This is the whole lab. |
| ④ | Three consecutive failures, ten seconds apart, before a restart. Not one — a single blip must not restart a healthy service. |
| ⑤ | **Readiness points at `/readyz`, which does check dependencies.** |
| ⑥ | Readiness reacts faster than liveness, because removing traffic is cheap and restarting is expensive. |

**The asymmetry in ④ and ⑥ is deliberate.** Being wrong about readiness costs you one pod's share of traffic for five seconds. Being wrong about liveness costs you a restart — and if every replica is wrong at once, it costs you the service.

---

## Step 3 — Apply probes to the whole platform

```bash
kubectl apply -f manifests/
kubectl rollout status deployment/payment-service -n axispay-core --timeout=180s
```

**Confirm they are really there:**

```bash
kubectl get deploy -n axispay-core -o custom-columns=\
'NAME:.metadata.name,LIVE:.spec.template.spec.containers[0].livenessProbe.httpGet.path,READY:.spec.template.spec.containers[0].readinessProbe.httpGet.path'
```

```
NAME               LIVE       READY
fraud-service      /healthz   /readyz
merchant-service   /healthz   /readyz
payment-service    /healthz   /readyz
routing-service    /healthz   /readyz
```

**Every liveness says `/healthz`. Every readiness says `/readyz`.** If any row shows `/readyz` in the LIVE column, stop and fix it — Step 6 shows you why.

---

## Step 4 — Watch readiness gate traffic, live

**This is the payoff.** Two terminals.

**Terminal 1 — watch the endpoints:**

```bash
watch -n1 'kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service -o jsonpath="{.items[0].endpoints[*].addresses[0]}"; echo'
```

Three IP addresses.

**Terminal 2 — make one pod unready:**

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/api/v1/_admin/unready',data=b'')" 2>/dev/null
```

**Watch terminal 1.** Within about ten seconds, **one IP disappears**. Two left.

**Now check the pod itself:**

```bash
kubectl get pod $POD -n axispay-core
```

```
NAME                              READY   STATUS    RESTARTS   AGE
payment-service-6c9d4f7b8-x2ktp   0/1     Running   0          5m
```

**`0/1`, `Running`, `RESTARTS: 0`.**

**What that means — and this is the sentence to remember:**

> The pod was **removed from traffic without being restarted**. It is alive, it kept its state, it is simply not being sent work.

That is a service being honest about not being ready, and Kubernetes respecting it. Requests went to the other two pods; nobody saw an error.

**Put it back:**

```bash
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/api/v1/_admin/unready?ready=true',data=b'')" 2>/dev/null
```

The IP returns to the list. Stop the watch with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

---

## Step 5 — Dependency-aware readiness

**Why we are doing this.** `/readyz` does not just return "yes". It checks the things the service actually needs.

```bash
kubectl port-forward -n axispay-core svc/payment-service 8080:8080 &
sleep 3
curl -s http://localhost:8080/readyz | jq .
kill %1
```

```json
{
  "ready": true,
  "checks": {
    "merchant-service": "ok",
    "fraud-service": "ok",
    "routing-service": "ok"
  }
}
```

**Now break a dependency and watch:**

```bash
kubectl scale deploy/merchant-service -n axispay-core --replicas=0
sleep 20
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service
```

**Every payment pod goes `0/1`, and the endpoint list empties.**

**What that means.** The service correctly reports that it cannot do its job. Callers get "no endpoints" — a fast, clear failure — instead of slow timeouts and half-processed payments.

**Restore:**

```bash
kubectl scale deploy/merchant-service -n axispay-core --replicas=2
kubectl rollout status deploy/merchant-service -n axispay-core
```

Everything comes back on its own. **Nothing restarted.**

> **A design decision worth noticing.** Not every dependency belongs in readiness. A *cache* being down should degrade the service, not remove it. AxisPay marks Redis as **non-critical** for exactly this reason — you will meet the consequences on Friday.

---

## Step 6 — Build the mistake, on purpose

**Why we are doing this.** This is the single most expensive Kubernetes misconfiguration, and the only way to really learn it is to cause it.

**Point liveness at `/readyz`:**

```bash
kubectl patch deployment payment-service -n axispay-core --type=json -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/livenessProbe/httpGet/path","value":"/readyz"}
]'
kubectl rollout status deployment/payment-service -n axispay-core --timeout=120s
```

**Now break the dependency again, and watch:**

```bash
kubectl scale deploy/merchant-service -n axispay-core --replicas=0
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service -w
```

**What you should see, over a minute or two:**

```
payment-service-...   0/1   Running            0     2m
payment-service-...   0/1   Running            1     2m30s
payment-service-...   0/1   Running            2     3m
payment-service-...   0/1   CrashLoopBackOff   3     3m30s
```

**The restart count climbs on every pod, simultaneously, and they all end in CrashLoopBackOff.**

**What just happened.** `merchant-service` went away. Readiness correctly said "not ready" — fine, that is its job. But liveness was reading the *same* endpoint, so it concluded the container was **broken** and restarted it. Restarting did not bring `merchant-service` back, so it failed again. And again.

**Compare the two outcomes:**

| | Correct probes (Step 5) | Liveness on `/readyz` (now) |
|---|---|---|
| Pods | Running, 0/1, no restarts | CrashLoopBackOff |
| Capacity | Degraded, recovers by itself | **Zero**, and getting worse |
| Recovery when the dependency returns | Instant, automatic | Slow — back-off delays are now minutes long |
| Extra load on the sick dependency | None | Every restart reopens its connection pool |

**One slow database became a cluster-wide restart storm**, and made recovery harder at exactly the wrong moment.

**Fix it:**

```bash
kubectl scale deploy/merchant-service -n axispay-core --replicas=2
kubectl apply -f manifests/
kubectl rollout status deployment/payment-service -n axispay-core --timeout=180s
kubectl get pods -n axispay-core
```

> **The rule, in one line:** *point liveness at something only a restart can fix.* If restarting would not help, it does not belong in a liveness probe.

---

## Step 7 — Startup probes and slow starts

**Why we are doing this.** The startup probe exists for one situation, and without it that situation is unfixable.

A service that takes 90 seconds to warm up will be killed by a liveness probe at 30 seconds — forever. You could lengthen `initialDelaySeconds` on liveness, but then a genuinely wedged process also goes undetected for 90 seconds, permanently.

The startup probe solves both: **be patient during boot, be strict afterwards.**

```bash
kubectl set env deployment/routing-service -n axispay-core STARTUP_DELAY_SECONDS=25
kubectl rollout status deployment/routing-service -n axispay-core --timeout=180s
kubectl describe pod -n axispay-core -l app.kubernetes.io/name=routing-service | grep -A3 'Startup:'
```

It took longer to become ready and **was not restarted**. The startup probe held liveness off until it finished.

```bash
kubectl set env deployment/routing-service -n axispay-core STARTUP_DELAY_SECONDS-
```

---

## Did it work?

```bash
make validate-lab LAB=L2.3
```

It specifically checks that no liveness probe points at `/readyz` — because that is the mistake that matters.

---

## Clean up

```bash
kubectl apply -f manifests/
kubectl scale deploy/merchant-service -n axispay-core --replicas=2
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| All pods `0/1` after applying | Probes are failing legitimately | `kubectl describe pod <name>` — the probe result is in the events |
| `CrashLoopBackOff` after Step 6 | Expected — that is the lesson | Re-apply `manifests/` to restore correct probes |
| Restart count climbing steadily | Liveness failing | Check the path. `curl` it from inside with `kubectl exec` |
| Pod never becomes ready | A dependency really is down | `curl /readyz` and read which check fails |
| `connection refused` from a probe | Wrong port or the app is not listening yet | Add a startup probe; check the port name matches |
| `_admin/unready` returns 404 | Older image | `make build` to rebuild |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/02-workloads-scaling-and-releases/solutions.md).

**1.** `fraud-service` uses Redis as a cache. Should Redis be in its readiness check? Argue both sides, then decide — and say what the user experiences either way.

**2.** Compute the **worst-case** time between a container wedging and Kubernetes restarting it, using the numbers in the manifest. Then work out what changes if `failureThreshold` is 1.

**3.** A colleague says "add `initialDelaySeconds: 120` to liveness so slow starts are not killed". Explain what that costs, and what a startup probe does instead.

---

## What you built

- **Three probes on every service**, with liveness and readiness pointed at genuinely different things
- **Readiness gating traffic, watched live** — a pod removed from rotation without a restart
- **Dependency-aware readiness**, recovering by itself when the dependency returned
- **The classic mistake, built and observed** — and the exact cost of it, side by side
- **The rule:** point liveness at something only a restart can fix

**Next:** [L2.4 — Autoscaling](../L2.4-autoscaling/) — where the requests you set in L2.1 turn out to be the thing scaling is measured against.
