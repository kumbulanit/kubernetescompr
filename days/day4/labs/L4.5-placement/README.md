# L4.5 · Placement — Stop Putting All The Eggs In One Node

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | Straightforward, with one trap |
| **You need first** | [L4.4](../L4.4-networkpolicy/) finished |
| **You will change** | Scheduling rules on 2 services |
| **Check you are done** | `make validate-lab LAB=L4.5` |

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

In L1.6 you noticed something and moved on: nothing tells the scheduler to spread your payment replicas across nodes. If two land together and that node dies, you lose two thirds of your payment capacity at once.

You will fix that with **anti-affinity**, meet **taints and tolerations**, and then hit the trap: a `required` anti-affinity rule with more replicas than nodes leaves pods `Pending` forever.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get nodes` | Three nodes, `Ready` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | Placement rules for payment and fraud |

---

## Step 1 — Look at where things are now

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay \
  -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName' | sort -k2
```

Count how many `payment-service` pods share a node. **Nothing arranged this.** The scheduler balanced by resource fit, which is not the same as fault tolerance.

---

## Step 2 — Anti-affinity

```bash
grep -B4 -A14 'podAntiAffinity' manifests/*payment*.yaml | head -22
```

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:   # ①
      - topologyKey: kubernetes.io/hostname            # ②
        labelSelector:
          matchLabels:
            app.kubernetes.io/name: payment-service    # ③
```

| | What it means |
|---|---|
| ① | **`required`** — a hard rule. If it cannot be satisfied, the pod stays `Pending`. The alternative is `preferred`, which is a weighting the scheduler tries to honour. |
| ② | The unit of separation. `kubernetes.io/hostname` means "different node". `topology.kubernetes.io/zone` would mean "different availability zone". |
| ③ | Keep away from pods carrying this label — that is, from my own siblings. |

**`IgnoredDuringExecution`** in the name means: enforced when scheduling, **not** re-checked afterwards. A pod already placed is never evicted because the rule stopped holding.

```bash
kubectl apply -f manifests/
kubectl rollout status deployment/payment-service -n axispay-core --timeout=180s
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service \
  -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName'
```

**Three pods, three different nodes.**

---

## Step 3 — The trap

```bash
kubectl scale deploy/payment-service -n axispay-core --replicas=4
sleep 15
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
```

```
NAME                              READY   STATUS    NODE
payment-service-...-2xk4p         1/1     Running   axispay
payment-service-...-h9mzt         1/1     Running   axispay-m02
payment-service-...-qw3nf         1/1     Running   axispay-m03
payment-service-...-lk8vt         0/1     Pending   <none>
```

```bash
kubectl describe pod -n axispay-core -l app.kubernetes.io/name=payment-service | grep -A4 'Events' | tail -5
```

```
Warning  FailedScheduling  ...  0/3 nodes are available:
3 node(s) didn't match pod anti-affinity rules.
```

**Four replicas, three nodes, one node each — the fourth has nowhere to go, and never will.**

**What that means for real platforms:** a `required` rule caps your replica count at the number of topology domains. That is often correct for a payment path, and it is a decision to make consciously rather than discover during a traffic spike.

```bash
kubectl scale deploy/payment-service -n axispay-core --replicas=3
```

---

## Step 4 — `preferred`, and why `fraud-service` uses it

```bash
grep -A10 'podAntiAffinity' manifests/*fraud*.yaml | head -14
```

```yaml
podAntiAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: kubernetes.io/hostname
        labelSelector: ...
```

**`preferred` with a weight.** The scheduler tries, and places the pod anyway if it cannot.

**Why the difference:** `fraud-service` has an HPA that reaches **6 replicas** on a **3-node** cluster. A `required` rule would leave three pods `Pending` forever at peak — turning a scaling event into an outage. `payment-service` is on the money path and its replica count is fixed, so a hard rule is right there.

**Same mechanism, opposite choice, and both are defensible.** That is the lesson.

---

## Step 5 — Taints and tolerations

```bash
kubectl describe node axispay | grep -A2 Taints
```

```
Taints:  node-role.kubernetes.io/control-plane:NoSchedule
```

**A taint repels pods.** A **toleration** on a pod says "that taint does not apply to me".

```bash
kubectl get daemonset node-agent -n axispay-ops -o jsonpath='{.spec.template.spec.tolerations}' | jq .
```

`node-agent` tolerates it deliberately — node telemetry with a hole in it is not telemetry.

| Effect | What it does |
|---|---|
| `NoSchedule` | Do not place new pods here |
| `PreferNoSchedule` | Avoid if you can |
| `NoExecute` | Do not place, **and evict what is already here** |

**Affinity is the pod choosing a node. Taints are the node refusing pods.** Two directions, and you usually need both.

---

## Step 6 — Topology spread, which is more expressive

```bash
grep -A8 'topologySpreadConstraints' manifests/*.yaml 2>/dev/null | head -12
```

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector: ...
```

Anti-affinity says "never together". Topology spread says **"spread evenly, within a tolerance"** — `maxSkew: 1` means the busiest and emptiest domain may differ by at most one pod.

**And `whenUnsatisfiable` gives you the choice anti-affinity does not:** `DoNotSchedule` behaves like `required`; `ScheduleAnyway` prefers the spread but takes the capacity when it must. For a workload that autoscales past the node count, that is usually what you want.

---

## Did it work?

```bash
make validate-lab LAB=L4.5
```

---

## Clean up

```bash
kubectl scale deploy/payment-service -n axispay-core --replicas=3
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Pods `Pending` with `didn't match pod anti-affinity` | More replicas than nodes | Reduce replicas, or use `preferred` |
| Anti-affinity ignored | The label selector matches nothing | It must match the pods' own labels |
| Pod on the control plane unexpectedly | It tolerates the taint | Check its tolerations |
| Spread uneven after scaling | `IgnoredDuringExecution` — placed pods are not moved | Roll the workload to redistribute |
| Everything on one node | Only one node is schedulable | `kubectl get nodes` and check taints |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** Make `payment-service` run **only** on nodes labelled `axispay.io/tier=payments`, while keeping one-per-node spread. Which two fields, and in what combination?

**2.** Explain why `fraud-service` uses `preferred` and `payment-service` uses `required`. Under what change would you switch either?

**3.** Three nodes across three zones. Write the topology spread constraint that guarantees at least one replica per zone, and say what happens when a zone fails.

---

## What you built

- **Payment replicas on three different nodes**, by instruction rather than luck
- **The `required` trap**, produced deliberately — replicas capped by topology domains
- **`preferred` where autoscaling exceeds the node count**, and the reasoning behind each choice
- **Taints and tolerations** — the node's side of the same conversation
- **Topology spread**, and why `whenUnsatisfiable` is the field that matters

**Next:** [L4.6 — Drain a node without dropping a payment](../L4.6-pdb-drain/).
