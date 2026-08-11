# Day 1 — Answer Key (Instructor)

> Distractors are explained too. A student who picked a wrong answer needs to know *why* it was wrong, not just what the right one was.

---

## Section A (6 marks)

**A1 — (b)** `spec` is what you want; `status` is what is, and a controller closes the gap.

| Distractor | Why it is wrong |
|---|---|
| (a) | Inverted. This is the single most common misconception and it makes the whole model unintelligible. |
| (c) | They are deliberately separate: intent versus observation. |
| (d) | `status` is always populated; it is how the system reports reality. |

**A2 — (b)** The ReplicaSet.

> A Deployment never creates Pods. It creates and manages ReplicaSets. **This is the mechanism behind rolling updates and rollbacks** — a Deployment updates by creating a new ReplicaSet and shifting replicas.
> If a student picks (a), they will not be able to explain rollback on Day 2. Worth five minutes of Tuesday's recap if several get it wrong.

**A3 — (c)** The EndpointSlice.

> A Service **always** has a ClusterIP, whether or not its selector matches anything. `kubectl get svc` therefore looks healthy in both cases and proves nothing.
> (a) is nonsense — a Service has no logs. (d) is a reasonable second check but not first.
> **This becomes INC-4 on Thursday, under time pressure.**

**A4 — (c)** `PersistentVolume`.

> PVs are cluster-scoped; PVCs are namespaced. Also cluster-scoped: Node, StorageClass, ClusterRole, ClusterRoleBinding, CRD, IngressClass, Namespace.
> Note the deliberate pairing: `Role` (namespaced) versus `ClusterRole` (not). Confusing them on Day 5 is how people accidentally grant cluster-admin.

**A5 — (c)** No — no container was created, so there are no logs.

> `RESTARTS: 0` is the tell: nothing ever started, so nothing can have crashed. `--previous` also returns nothing, for the same reason. The answer lives in `kubectl describe pod` → Events.
> **Students met this in INC-1 today.** If they still get it wrong, they pattern-matched the fix rather than understanding it — worth a Tuesday recap.

**A6 — (b)** kube-scheduler.

> And it writes only a node name. The **kubelet** starts the container. Students who pick (a) have conflated deciding with doing, which makes `Pending` versus `ContainerCreating` impossible to reason about.

---

## Section B (3 marks)

**B1** *(1 mark — needs both halves)*

> Changing which pods a controller owns mid-flight would orphan or double-own running pods, so Kubernetes forbids it. The practical consequence: fixing a bad selector means **deleting and recreating the Deployment** — in production, with traffic on it.

| Mark | Criteria |
|---|---|
| 1 | Both the reason (ownership consistency) and the consequence (delete + recreate) |
| 0.5 | One half only |
| 0 | "Because Kubernetes says so" |

*Bonus credit:* mentions that version numbers must never appear in a selector.

**B2** *(1 mark)*

> **No.** By default every pod can reach every other pod in any namespace — namespaces isolate names, RBAC scope and quotas, not the network. **NetworkPolicy** provides network isolation.

| Mark | Criteria |
|---|---|
| 1 | "No" + what namespaces *do* isolate + names NetworkPolicy |
| 0.5 | Correct "no" but cannot name NetworkPolicy |
| 0 | "Yes" |

*Bonus credit:* notes that NetworkPolicy requires a CNI that enforces it.

**B3** *(1 mark)*

> The container process started, but the **readiness probe is failing**, so the pod has been removed from Service endpoints — it is alive but not receiving traffic. First command: `kubectl describe pod <pod>` and read Conditions/Events.

| Mark | Criteria |
|---|---|
| 1 | Identifies readiness (not liveness) + the traffic consequence + a sensible first command |
| 0.5 | Identifies readiness but not the endpoint consequence |
| 0 | Says the container has crashed |

*Note:* on Day 1 the honest answer is often "`merchant-service` is not up yet", which is exactly what they saw in L1.3. Give full credit for that if the reasoning is right.

---

## Section C (1 mark)

**C1** — any three that follow the triage loop outside-in. A model answer:

```
1. kubectl get pods -n axispay-core -o wide     → actual state: which pods, what status, which node
2. kubectl describe pod <failing-pod>           → what the CLUSTER says: Events, conditions, last state
3. kubectl logs <pod> --previous                → what the APP says, from the run that failed
```

| Mark | Criteria |
|---|---|
| 1 | Three commands, sensible order, correct purpose for each. **`describe` must come before `logs`.** |
| 0.5 | Right commands, wrong order, or vague purposes |
| 0 | Starts with `kubectl logs`, or starts by deleting pods |

> **`kubectl get events --sort-by='.lastTimestamp'` is an equally good step 2** — accept it.
> **Deducting for `logs` first is deliberate.** It is the failure mode INC-1 was designed to produce, and putting it right is the point of teaching the loop on Day 1.

---

## Marking summary

| | |
|---|---|
| **Pass** | 6/10 |
| **Strong** | 8+/10 — push them towards lab challenges tomorrow |
| **At risk** | < 6/10 — private conversation Tuesday 09:00 |

### Gap remediation — give the specific reference, never "study more"

| Missed | Send them to |
|---|---|
| A1 | Manual §1.1 (points 1–4) · Slides 14–17 |
| A2 | Manual §1.5 (points 4–5) · Slide 34 · Lab L1.4 step 5 |
| A3 | Manual §1.6 (points 4, 16) · Slide 40 · Lab L1.5 step 8 |
| A4 | Manual §1.3 (point 5) · Slide 28 |
| A5 | Manual §1.4 (point 16) · Slide 47 · INC-1 §6 |
| A6 | Manual §1.2 (point 5) · Slide 20 |
| B1 | Manual §1.5 (points 5, 9) · Slide 35 |
| B2 | Manual §1.3 (points 10–11) · Slide 25 · Lab L1.2 step 6 |
| B3 | Manual §1.4 (point 5) · Slide 47 |
| C1 | Manual cheat sheet · Slide 46 · INC-1 §3 |

### Cohort signals

| If | Then |
|---|---|
| > ⅓ miss A3 | Five minutes on EndpointSlices in Tuesday's recap. Thursday's INC-4 depends on it. |
| > ⅓ miss A5 | Five minutes on `describe` vs `logs`. Tuesday's INC-2 is a CrashLoopBackOff and needs the contrast. |
| > ⅓ miss A2 | Re-draw the ownership chain before teaching rolling updates. It will not land otherwise. |
