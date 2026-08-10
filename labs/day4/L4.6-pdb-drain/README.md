# L4.6 · Drain a Node Without Dropping a Payment

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | Everything from this week, at once |
| **You need first** | [L4.5](../L4.5-placement/) finished |
| **You will create** | 6 PodDisruptionBudgets |
| **Check you are done** | `make validate-lab LAB=L4.6` |

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

Nodes get drained — for a kernel patch, a Kubernetes upgrade, a hardware replacement. Right now a drain evicts every pod on that node at once, and if two payment replicas are there, two thirds of your capacity goes with it.

You will add **PodDisruptionBudgets**, then drain a node **while payments are flowing** and prove the error count stayed at zero.

Then you will set a budget that can never be satisfied, and discover that maximum safety produces a node you can never maintain.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-core -o wide` | Payment pods on **different** nodes (L4.5) |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The PodDisruptionBudgets |

---

## Step 1 — What a PDB actually constrains

```
  VOLUNTARY disruption      kubectl drain, node upgrades, descheduling
                            -> a PDB is consulted and CAN BLOCK it

  INVOLUNTARY disruption    node crashes, kernel panic, someone trips
                            over a cable
                            -> a PDB is IRRELEVANT
```

**A PDB will not save you from a node catching fire.** It stops *planned* work from taking too much away at once. Believing otherwise is a common and expensive misunderstanding.

```bash
cat manifests/*pdb*.yaml | head -20
```

```yaml
spec:
  maxUnavailable: 1                 # ①
  selector:
    matchLabels:
      app.kubernetes.io/name: payment-service
```

| | What it means |
|---|---|
| ① | At most one pod of this workload may be unavailable at a time due to voluntary disruption. The alternative is `minAvailable`, and Step 5 shows why `maxUnavailable` is usually safer. |

```bash
kubectl apply -f manifests/
kubectl get pdb -A
```

```
NAMESPACE      NAME              MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS
axispay-core   payment-service   N/A             1                 1
```

**`ALLOWED DISRUPTIONS: 1`** — right now, one pod could be evicted. If it read `0`, a drain would block.

---

## Step 2 — Start measuring before you touch anything

**Terminal 1:**

```bash
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080
```

**Terminal 2 — leave this running for the whole lab:**

```bash
OK=0; FAIL=0
while true; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8080/api/v1/payments \
    -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H "Idempotency-Key: l46-$(date +%s%N)" \
    -H 'Content-Type: application/json' \
    -d '{"merchant_reference":"AXP-L46","amount_minor":12000,"currency":"ZAR","card_token":"tok_visa_4242"}')
  [ "$CODE" = "201" ] && OK=$((OK+1)) || { FAIL=$((FAIL+1)); echo "  !! $CODE at $(date +%T)"; }
  printf "\rok=%d fail=%d " $OK $FAIL
  sleep 0.2
done
```

---

## Step 3 — Drain a node under live traffic

```bash
NODE=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service \
       -o jsonpath='{.items[0].spec.nodeName}')
echo "draining $NODE"
kubectl get pods -A -o wide --field-selector spec.nodeName=$NODE | head
```

**Terminal 3:**

```bash
kubectl drain $NODE --ignore-daemonsets --delete-emptydir-data --timeout=300s
```

| Flag | Why |
|---|---|
| `--ignore-daemonsets` | DaemonSet pods are meant to be on every node; they are recreated by design and cannot be "moved" |
| `--delete-emptydir-data` | Acknowledges that `emptyDir` contents are lost. Without it the drain refuses |

**Watch terminal 2 the whole time.** `fail` should stay at **0**.

```bash
kubectl get nodes
kubectl get pods -A -o wide | grep $NODE || echo "node is empty"
```

The node shows `SchedulingDisabled` and its pods have moved.

**Four things made that work, and you built all of them this week:**

| Mechanism | From |
|---|---|
| **PDB** — evict at most one at a time | today |
| **Readiness probe** — no traffic until the replacement is ready | L2.3 |
| **`preStop` + grace period** — finish in-flight requests | L2.6 |
| **Anti-affinity** — replicas were on different nodes to begin with | L4.5 |

Remove any one and the count moves.

**Bring the node back:**

```bash
kubectl uncordon $NODE
kubectl get nodes
```

> `uncordon` makes it schedulable again. **It does not move pods back** — Kubernetes does not rebalance on its own. The node fills up as pods are next replaced.

---

## Step 4 — Watch a PDB block a drain

```bash
kubectl scale deploy/payment-service -n axispay-core --replicas=2
sleep 20
kubectl get pdb payment-service -n axispay-core
```

```
NAME              MAX UNAVAILABLE   ALLOWED DISRUPTIONS
payment-service   1                 1
```

Now make one pod unready, so the budget has no slack:

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/api/v1/_admin/unready',data=b'')" 2>/dev/null
sleep 10
kubectl get pdb payment-service -n axispay-core
```

```
ALLOWED DISRUPTIONS: 0
```

```bash
NODE2=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[1].spec.nodeName}')
timeout 45 kubectl drain $NODE2 --ignore-daemonsets --delete-emptydir-data
```

```
evicting pod axispay-core/payment-service-...
error when evicting pod ... Cannot evict pod as it would violate the pod's disruption budget.
```

**The drain is blocked, and it retries forever.** That is the PDB doing exactly its job: one replica is already unavailable, so removing another would leave zero.

```bash
kubectl exec -n axispay-core $POD -- \
  python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/api/v1/_admin/unready?ready=true',data=b'')" 2>/dev/null
kubectl uncordon $NODE2
kubectl scale deploy/payment-service -n axispay-core --replicas=3
```

> **A slow drain is usually a PDB telling you the truth.** In Friday's capstone the temptation to reach for `--force` appears again — and `--force` deletes the pod the PDB was protecting.

---

## Step 5 — Maximum safety that makes maintenance impossible

```bash
kubectl patch pdb payment-service -n axispay-core --type=json \
  -p='[{"op":"remove","path":"/spec/maxUnavailable"},{"op":"add","path":"/spec/minAvailable","value":3}]'
kubectl get pdb payment-service -n axispay-core
```

```
MIN AVAILABLE   ALLOWED DISRUPTIONS
3               0
```

**`ALLOWED DISRUPTIONS: 0`, with everything perfectly healthy.** Three replicas, three required available, so no pod may ever be evicted. **This node can never be drained.**

**It reads like maximum safety and it is a production hazard.** Maintenance becomes impossible, and the person under time pressure reaches for `--force` — which bypasses the budget entirely and gives you none of the protection.

**A budget that can never be satisfied provides no protection. It only removes the safe path.**

```bash
kubectl apply -f manifests/
kubectl get pdb -A
```

**Why `maxUnavailable: 1` is the better default:** it is correct at every replica count. `minAvailable: 2` on a workload that autoscales between 2 and 10 permits **zero** disruption at the minimum and eight at the maximum — silently loosening exactly when there is most traffic.

---

## Did it work?

```bash
make validate-lab LAB=L4.6
make validate-day4
```

---

## Clean up

```bash
kubectl uncordon --all 2>/dev/null || true
kubectl scale deploy/payment-service -n axispay-core --replicas=3
kubectl apply -f manifests/
```

Stop the load in terminal 2 with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Drain hangs forever | A PDB is blocking it — usually correctly | `kubectl get pdb -A`. Find what is not ready. **Do not `--force`** |
| Failures during the drain | A mechanism is missing | Check replicas ≥ 2, anti-affinity, readiness, `preStop` |
| `cannot delete Pods with local storage` | `emptyDir` in use | `--delete-emptydir-data` |
| `cannot delete DaemonSet-managed Pods` | Expected | `--ignore-daemonsets` |
| Pods do not return after `uncordon` | Kubernetes does not rebalance | Normal. They return as pods are replaced |
| `ALLOWED DISRUPTIONS: 0` when healthy | `minAvailable` equals the replica count | See Step 5 |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/04-networking-and-exposure/solutions.md).

**1.** Drain the busiest node under live load and keep the error count at **zero**. Then write down exactly which four objects made that possible.

**2.** Design a PDB for a service with `minReplicas: 2` and `maxReplicas: 10` that never blocks maintenance and never drops below two serving replicas. Justify `maxUnavailable` versus a percentage.

**3.** A node has been draining for twenty minutes. Diagnose it in three commands and state the two most likely causes.

---

## What you built

- **Six PodDisruptionBudgets**, and a node drained under live traffic with zero failures
- **The four mechanisms that made it work**, all built earlier this week
- **A drain blocked by a PDB**, which is the budget working rather than failing
- **`minAvailable` equal to the replica count** — maximum safety that removes the safe path
- **The reason `maxUnavailable: 1` is the better default**

**Next:** [INC-4 — Three faults at once](../INC-4-three-faults/). One of them is silent.
