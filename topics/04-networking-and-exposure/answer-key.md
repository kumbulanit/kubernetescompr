# Day 4 — Answer Key (Instructor)

---

## Section A (6 marks)

**A1 — (b)** Allowed by default until selected; policies only add permission.

| Distractor | Why wrong |
|---|---|
| (a) | Inverted. This is the single most consequential misunderstanding of the day — it leads people to write an allow-list and believe they are protected. |
| (c) | There is no deny rule in the NetworkPolicy API. |
| (d) | `podSelector` targets individual pods; `podSelector: {}` targets all of them. |

**A2 — (b)** DNS egress was blocked.

> Every service call begins with a lookup to CoreDNS in `kube-system`, and that lookup is egress traffic. Students met this exact symptom twice: deliberately in L4.2 step 6, and by accident in L4.4 step 3.
> (a) is the tempting wrong answer — the *symptom* is identical, which is precisely why the distinction matters.

**A3 — (c)** No controller has claimed it.

> An empty `ADDRESS` column is the tell. (b) would give 404s on most paths but the ADDRESS would be populated. (d) would give 503. Three different symptoms, three different layers.

**A4 — (b)** The 4th pod stays `Pending` indefinitely.

> `required` anti-affinity on hostname means you can never have more replicas than nodes. Students produced this exact state in L4.5 step 4.
> The follow-up that matters: this is why `fraud-service` uses `preferred` — its HPA scales to 6, and `required` would silently cap autoscaling at the node count during exactly the traffic spike it exists to absorb.

**A5 — (c)** `kubectl delete pod`.

> A direct delete bypasses the eviction API entirely, and only the eviction API consults a PDB. (a), (b) and (d) all go through eviction.
> Also worth stating in the debrief: node crashes, OOM kills and liveness restarts are all outside a PDB's reach. It gates *voluntary* disruption only.

**A6 — (c)** The backend Service has no ready endpoints.

| Code | Layer |
|---|---|
| 404 | Routing rules did not match — an Ingress problem |
| 502 | Controller reached a backend and got a bad response — usually the wrong port |
| 503 | No ready endpoints — a Service or readiness problem |

---

## Section B (3 marks)

**B1** *(1 mark)*

> **You cannot.** There is no deny rule. You ensure that *some* policy selects the pod, and that none of the policies selecting it permit the traffic. **Absence of permission is the denial.** A default-deny policy is simply `podSelector: {}` with both `policyTypes` and no rules at all.

| Mark | Criteria |
|---|---|
| 1 | States there is no deny rule **and** explains that denial is the absence of permission |
| 0.5 | Says "you can't write deny" without explaining the mechanism |
| 0 | Invents a deny rule |

**B2** *(1 mark — the discriminating question)*

> NetworkPolicy is **default-allow until selected**. Before the new policy, `fraud-service` accepted traffic from anywhere because nothing selected it. The new policy selects it, so from that moment `fraud-service` accepts **only** what a policy explicitly permits — and the new one permits only `reporting-service`. `payment-service` was never denied by name; it simply stopped being allowed.

| Mark | Criteria |
|---|---|
| 1 | Identifies default-allow-until-selected **and** that adding one narrow policy closes everything else |
| 0.5 | Says "the policy blocked it" without the selection mechanism |
| 0 | Claims the policy contains a deny rule for `payment-service` |

> **This is INC-4c.** Students who sat that incident and understood it will answer well.

**B3** *(1 mark)*

> `minAvailable` is an absolute number that does not scale with the workload. When the HPA scales down to `minReplicas`, an absolute `minAvailable` can equal the current replica count — making `disruptionsAllowed` zero and the node **undrainable**. A node that cannot be drained cannot be patched or upgraded. `maxUnavailable` expresses the same intent relative to the current size and never blocks maintenance entirely.

| Mark | Criteria |
|---|---|
| 1 | Identifies the interaction with scale-down **and** the maintenance consequence |
| 0.5 | Notes it can block a drain without explaining why |
| 0 | Says they are equivalent |

---

## Section C (1 mark)

**C1 (a)** *(½ mark)*
```bash
kubectl exec -n axispay-edge deploy/edge-gateway -- python3 -c \
  "import socket; socket.create_connection(('postgres-0.postgres.axispay-data.svc.cluster.local',5432),timeout=5)"
```
> Accept any equivalent connection attempt from a DMZ pod to the data tier — `nc -z -w3` is fine.

**C1 (b)** *(½ mark)*

> **Proof is the connection failing.** A `TimeoutError` after the timeout elapses, plus a policy set containing no rule granting that path, plus a repeatable automated assertion (`simulate-netpol.py`).
>
> It is a **timeout rather than a refusal** because NetworkPolicy causes packets to be **dropped** silently. A refusal (`ECONNREFUSED`) would mean the packet arrived and something actively rejected it — which would indicate the policy was not applied at all.

> **Do not accept** "show them the YAML". A policy file proves intent, not enforcement — and a CNI that does not enforce policy would produce identical YAML and no protection.

---

## Marking summary

| | |
|---|---|
| **Pass** | 6/10 |
| **Strong** | 8+/10 |
| **At risk** | < 6/10 — private conversation Friday 09:00 |

### Gap remediation

| Missed | Send them to |
|---|---|
| A1, B1 | Manual §4.4 (point 4) · Slide 12 · Lab L4.4 |
| A2 | Manual §4.2 (point 10) · Slide 14 · **Lab L4.4 step 3** |
| A3 | Manual §4.3 (point 4) · Slide 9 · Lab L4.3 step 3 |
| A4 | Manual §4.5 (point 4) · Slide 17 · **Lab L4.5 step 4** |
| A5 | Manual §4.5 (point 4) · Slide 18 |
| A6 | Manual §4.3 (point 16) · Slide 9 |
| B2 | Manual §4.4 (points 4, 10) · **INC-4 §6, fault C** |
| B3 | Manual §4.5 (points 9–10) · Slide 18 · Lab L4.6 Task 6 |
| C1 | Manual §4.4 (point 7) · Slide 13 · Lab L4.4 steps 1 and 6 |

### Cohort signals

| If | Then |
|---|---|
| > ⅓ miss A1 or B1 | **Re-teach before the capstone.** Friday has a NetworkPolicy incident with a tempting wrong fix. |
| > ⅓ miss A5 or B3 | Recap PDBs — the capstone drains a node under live load |
| > ⅓ miss A2 | Recap DNS egress; it is the most common real-world policy failure |
| Anyone answers C1 with "show the YAML" | Correct it directly. Intent is not enforcement, and an auditor knows the difference. |
