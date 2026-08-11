# Day 2 — Solutions

> Read the lab first. Use this to check yourself, or when genuinely stuck after ten minutes.

## L2.1 Requests, limits, QoS

```bash
kubectl top pods -n axispay-core --containers
kubectl apply -f manifests/day2/resources/
kubectl get pods -n axispay-core -o custom-columns=\
NAME:.metadata.name,CPU_REQ:.spec.containers[0].resources.requests.cpu,\
CPU_LIM:.spec.containers[0].resources.limits.cpu,QOS:.status.qosClass
```

**C1 — deriving edge-gateway's numbers.** Under 25 rps the gateway sits around 30–40m CPU and 55–65Mi. Applying the rules: request ≈ 50m / 64Mi (steady + 30%), limit ≈ 300m / 192Mi (peak + 100%). That matches the supplied manifest. If your load pattern differed, your numbers should differ — the method matters more than the answer.

**C2 — Guaranteed QoS, and why AxisPay does not use it.**
```bash
kubectl set resources deployment/payment-service -n axispay-core \
  --requests=cpu=500m,memory=256Mi --limits=cpu=500m,memory=256Mi
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service \
  -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass
kubectl apply -f manifests/day2/rollout/     # restore
```
Guaranteed gives the best eviction protection and **zero burst headroom**. Under a traffic spike the pod is throttled at exactly its request — the worst possible moment to have no room. AxisPay accepts slightly higher eviction risk in exchange for burst capacity. That is a deliberate trade, and reasonable people choose differently.

**C3 — `requests.cpu: 10m`, `limits.cpu: 2000m`.**
The scheduler reserves only 10m, so the pod schedules almost anywhere — it looks tiny. At load it bursts to 2000m and degrades every neighbour on that node. `maxLimitRequestRatio: 10` in the LimitRange rejects it: the ratio is 200. The rule exists to stop workloads lying to the scheduler about their size.

---

## L2.2 Quota and LimitRange

```bash
kubectl apply -f manifests/day2/resources/00-governance-axispay-core.yaml
kubectl describe quota axispay-core-quota -n axispay-core
kubectl describe rs -n axispay-core -l app=quota-test | tail -12   # the FailedCreate
```

**C1 — sizing a quota for `axispay-async`.**
Four services × 2 replicas at roughly 60m/72Mi request and 300m/192Mi limit:
```
requests  4 x 2 x  60m =  480m      4 x 2 x  72Mi =  576Mi
limits    4 x 2 x 300m = 2400m      4 x 2 x 192Mi = 1536Mi
```
Add one HPA scaling `reporting-service` to 6: `+4 x 60m = 240m` request, `+4 x 300m = 1200m` limit.
Reasonable quota: `requests.cpu: 1`, `requests.memory: 1Gi`, `limits.cpu: 4`, `limits.memory: 3Gi`, `pods: 25`.
Always round up — a quota that is exactly the calculated figure has no room for a rollout's surge pod.

**C2 — quota with no LimitRange.**
```bash
kubectl create namespace quota-nolr
kubectl create quota test -n quota-nolr --hard=requests.cpu=1,requests.memory=1Gi
kubectl create deployment nolr --image=busybox:1.37 -n quota-nolr -- sleep 3600
kubectl describe rs -n quota-nolr | tail -6
kubectl delete namespace quota-nolr
```
```
Error creating: pods "nolr-..." is forbidden: failed quota: test:
  must specify requests.cpu for: nolr; requests.memory for: nolr
```
Rejected, and the message is explicit. Kubernetes cannot count an undeclared value, so it refuses rather than guessing.

**C3 — why limits may be oversubscribed.**
Requests are reservations the scheduler must honour, so their sum is bounded by real capacity: 1920m at HPA max against 6000m allocatable. Limits are per-container ceilings enforced by the kernel; a pod may burst into headroom its neighbours are not using. Our limits total 8700m against 6000m allocatable — deliberately oversubscribed, and correct. That is what Burstable QoS is for. The quota still has to permit 8700m or the HPA stalls mid-scale.

---

## L2.3 Probes

```bash
kubectl apply -f manifests/day2/resources/
POD=$(kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- python3 -c "import urllib.request;
urllib.request.urlopen('http://127.0.0.1:8080/api/v1/_admin/unready?value=true', data=b'', timeout=3)"
kubectl get endpointslice -n axispay-core -l kubernetes.io/service-name=payment-service
```

**C1 — should `merchant-service` be a critical readiness dependency of `payment-service`?**

Look at `images/payment-service/app/main.py` `_startup()`:
```python
app.state.readiness.register("merchant-service", merchants.probe, critical=True)
```

**Critical** (current): if `merchant-service` is unreachable, the pod leaves the Service entirely and serves nothing. Merchants get a connection-level failure and can retry elsewhere.

**Non-critical**: the pod keeps serving, and every payment fails individually at the pricing lookup with a 502.

**Critical is right here**, because `payment-service` genuinely cannot complete *any* payment without merchant pricing. Failing fast at the load balancer is better than accepting work you cannot finish. Contrast with `edge-gateway`, where `merchant-service` is registered **non-critical** — the gateway can still serve charges (payment-service talks to merchant-service itself); only `/account` degrades. Same dependency, different classification, because the consequence differs.

**C2 — catching a dependency that responds with garbage.**
Replace the `/healthz` reachability probe with a real business call — e.g. fetch a known merchant and assert the response contains `mdr_bps`. Cost: every readiness check becomes a real query, multiplying load on the dependency (1,000 probe requests/minute cluster-wide). Risk: a slow dependency now causes readiness *timeouts*, taking pods out of rotation for slowness rather than failure. The usual compromise is a cheap synthetic check plus separate synthetic monitoring of the real path.

**C3 — worst-case time a broken pod keeps receiving traffic.**
```
readiness periodSeconds 5 x failureThreshold 2      = 10s   detection
+ up to one full period before the first failing check = +5s
+ endpoint controller observes and updates EndpointSlice = ~1s
+ kube-proxy on every node reprograms                    = 1-3s
                                                     ------
                                             worst case ~19s
```
Roughly 10–20 seconds. Not instant — and that gap is exactly why `preStop` sleeps 8 seconds during termination.

---

## L2.4 Autoscaling

```bash
kubectl apply -f manifests/day2/autoscaling/
kubectl port-forward -n axispay-ops deploy/loadgen 8090:8080 &
curl -s -X POST localhost:8090/api/v1/loadgen/start -H 'Content-Type: application/json' -d '{"rps":60}'
watch -n5 'kubectl get hpa -n axispay-core'
```

**C1 — the velocity bug.**
```bash
for p in $(kubectl get pods -n axispay-core -l app.kubernetes.io/name=fraud-service -o name); do
  kubectl exec -n axispay-core ${p#pod/} -- python3 -c "
import urllib.request,json
d=json.load(urllib.request.urlopen('http://127.0.0.1:8080/api/v1/velocity/tok_a71ef4c2900bd5386ff1240e'))
print(d['counted_by_pod'], d['recent_attempts'])"
done
```
Each pod reports a different, much lower count. With 6 replicas each sees roughly one sixth of the traffic, so a rule of "more than 8 attempts in 5 minutes" effectively fires at **48**. The fraud control silently weakens as you scale — nothing errors, no alert fires. Scaling up for performance degrades a security control. Day 3 moves the counters into Redis.

**C2 — the arithmetic.**
`ceil(4 × 140 / 70) = ceil(8) = 8` replicas. Verify with `kubectl describe hpa fraud-service -n axispay-core` and read the `SuccessfulRescale` event text — Kubernetes states "percentage of request" itself.

**C3 — why CPU is a poor signal for `payment-service`.**
It spends most of its wall-clock time **waiting** on the simulated acquirer call (85–225 ms), not burning CPU. A pod can be saturated in terms of concurrent in-flight requests while showing low CPU, so the HPA under-scales exactly when it matters. Better signals: in-flight request count, p99 latency, or queue depth — all custom or external metrics, typically via an adapter such as KEDA. Signposted on Day 5.

---

## L2.5 Workload types

```bash
kubectl apply -f manifests/day2/deployments/01-namespace-ops.yaml
kubectl apply -f manifests/day2/workloads/
kubectl get pods -n axispay-ops -o wide            # one per node
kubectl logs -n axispay-async job/recon-worker
```

**Task 2 — the toleration.**
```yaml
tolerations:
  - key: node-role.kubernetes.io/control-plane
    operator: Exists
    effect: NoSchedule
```
Control-plane nodes carry a `NoSchedule` taint so ordinary workloads stay off them. Remove the toleration and the DaemonSet has no pod on the control-plane node — `desiredNumberScheduled` drops to 2 on a 3-node cluster. An **agent** needs it because an unmonitored node is the one that will fail your audit; `payment-service` does not, because you actively do not want payment traffic competing with the API server.

**Task 4 — `backoffLimit`.**
With `backoffLimit: 4` the pod runs **5 times total** (initial + 4 retries), with exponential back-off between attempts — roughly 10 s, 20 s, 40 s, 80 s. The Job then reports:
```yaml
status:
  conditions:
    - type: Failed
      reason: BackoffLimitExceeded
```

**Task 6 — `concurrencyPolicy` for settlement.**

- **`Allow`** — if last night's run is still going, a second starts. Two settlement runs over the same captured payments **double-count**. Merchants are paid twice, or the ledger no longer balances. Unrecoverable without manual reconciliation.
- **`Replace`** — the running Job is killed mid-way and a fresh one starts. The killed run may have written some settlement records and not others; the new run does not know how far it got. **Partial work with no record of the boundary** — arguably worse than `Allow`, because it looks like it succeeded.
- **`Forbid`** — the only defensible value for money movement. Skip tonight rather than corrupt the ledger.

`startingDeadlineSeconds: 600` — if the controller was down at 23:00, still run when it recovers, but only within 10 minutes. Later than that, skip: a settlement batch at 04:00 against the wrong day's data is worse than not running.

`timeZone` — the cluster runs UTC. `0 23 * * *` without it fires at **01:00 the next day** in Johannesburg, so the Tuesday batch runs on Wednesday and may include Wednesday's early transactions. Silent accounting defect.

**C1 — parallel Job.**
```yaml
spec:
  completions: 4
  parallelism: 4
  completionMode: Indexed
```
`Indexed` gives each pod a `JOB_COMPLETION_INDEX` environment variable (0–3), so each can deterministically take a slice of the work without coordination.

**C2 — exactly-once settlement.**
Kubernetes gives **at-most-once scheduling** (`Forbid`), not exactly-once execution. The gap: a Job pod can be killed *after* doing its work and *before* recording that it finished — the retry then repeats it. The guarantee must come from the application: a uniquely-constrained completion record (`settlement_runs(batch_date, currency)` with a unique index) checked before starting and written in the same transaction as the settlement rows.

**C3 — why no `replicas` on a DaemonSet.**
The count is a function of the node inventory, not a value you choose. The equivalent of "scaling" is changing which nodes are **eligible** — via `nodeSelector`, `nodeAffinity` or tolerations.

---

## L2.6 Zero-downtime rollout

```bash
kubectl port-forward -n axispay-ops deploy/loadgen 8090:8080 &
curl -s -X POST localhost:8090/api/v1/loadgen/start -H 'Content-Type: application/json' -d '{"rps":40}'
kubectl apply -f manifests/day2/rollout/
kubectl rollout status deployment/payment-service -n axispay-core
curl -s localhost:8090/api/v1/loadgen/stats | python3 -m json.tool
```

**C1 — `maxUnavailable: 0` with 2 replicas.**
Peak pod count is 3 (2 + maxSurge 1). The cluster must have 100m CPU and 96Mi free *above* steady state for the surge pod. With 2 replicas the surge is 50% of capacity — proportionally expensive. The strategy becomes unaffordable when a single replica is a large fraction of the cluster (a big JVM, a GPU workload), where you may have to accept `maxUnavailable: 1` and a brief capacity dip.

**C2 — blue/green with Deployments and Services.**
Run two Deployments, `payment-service-blue` and `payment-service-green`, with a distinguishing label such as `axispay.io/slot`. The Service selector includes that label. Cut over by patching the Service selector:
```bash
kubectl patch svc payment-service -n axispay-core -p '{"spec":{"selector":{"axispay.io/slot":"green"}}}'
```
Cutover and rollback are both a single selector change — **seconds**, versus a full rolling update to go back. The cost is double the resources for the whole window, and any shared state (a database schema) still has to be compatible with both.

**C3 — is a 45-second grace period enough?**
The acquirer call is at most ~225 ms, so for normal payment traffic 45 s is generous. It is **not** enough for a long-running batch request held on the same pod — a large reporting query, or a bulk operation. The grace period must exceed the **longest possible** in-flight operation, not the average, because anything still running at the deadline is SIGKILLed regardless. Either raise the grace period for pods that serve long operations, separate those onto their own Deployment, or make them resumable.

**Bonus A — `Recreate`.**
```bash
kubectl patch deployment payment-service -n axispay-core \
  -p '{"spec":{"strategy":{"type":"Recreate","rollingUpdate":null}}}'
```
All pods terminate, then new ones start — a measurable outage of roughly 20–40 seconds at 40 rps, several hundred failed payments. Correct choice for a **non-backwards-compatible schema migration**, where old and new versions genuinely cannot run simultaneously against the same database. A deliberate outage in exchange for correctness. Restore with `kubectl apply -f manifests/day2/rollout/`.

**Bonus B — `minReadySeconds`.**
A readiness probe answers "is it ready *now*". `minReadySeconds: 10` requires a pod to stay ready for 10 continuous seconds before it counts as available. It catches the pod that passes readiness and then crashes four seconds later — which a readiness probe alone will happily let through, advancing the rollout into a broken version.
