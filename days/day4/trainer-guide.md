# Day 4 — Trainer Guide

**The security day.** L4.4 is the single most important lab of the week, and it is the one where the entire platform stops working in the middle, on purpose.

---

## 1. Before the room opens

| When | Do |
|---|---|
| **Evening before** | Run `python3 platform/admin/validate/simulate-netpol.py` — 39/39 — so you know the shipped policy set is correct before students copy it. |
| **60 min out** | **Verify Calico on every student cluster.** `kubectl get ds -n kube-system calico-node`. Without it, L4.4 applies 22 policies and enforces nothing. |
| **45 min out** | `minikube addons enable ingress -p axispay` and confirm the controller is Running. |
| **30 min out** | Add the hostnames to your own `/etc/hosts` and confirm `curl -k https://api.axispay.local` works from your demo machine. |

### The check that must not be skipped

```bash
kubectl get daemonset -n kube-system calico-node
```

If this returns nothing for **any** student, deal with it now. CNI cannot be changed on a running cluster, and the failure is silent — their policies will apply cleanly and protect nothing. That is the worst possible outcome in a security module.

---

## 2. Minute-by-minute

| Time | Block | Min | Notes |
|---|---|---|---|
| 09:00 | Recap + **the finding demo** | 20 | Exec into the gateway, connect to PostgreSQL. It works. |
| 09:20 | M4.1–M4.2 (slides 4–6) | 40 | |
| 10:00 | **LABS L4.1 + L4.2** | 65 | |
| 11:05 | *Break* | 15 | |
| 11:20 | M4.4 Ingress (slides 8–9) | 35 | |
| 11:55 | **LAB L4.3** | 55 | The first request without kubectl |
| 12:50 | *Lunch* | 45 | |
| 13:35 | M4.5 NetworkPolicy (slides 11–14) | 45 | **The most important 45 minutes of Day 4** |
| 14:20 | **LAB L4.4** | 50 | Everything breaks at step 2 |
| 15:10 | *Break* | 15 | **Inject INC-4 now** |
| 15:25 | M4.6–M4.7 (slides 16–18) | 45 | |
| 16:10 | **LABS L4.5 + L4.6** | 110 | |
| — | INC-4 + knowledge check + assessment | 55 | |

---

## 3. Running late — cut in this order

| Cut | Cost | Why safe |
|---|---|---|
| 1. Slide 6 (Service types table) | Low | L4.1 exercises all five hands-on |
| 2. L4.1 steps 5–6 (ExternalName, headless) | Low | Demo them yourself in 3 minutes |
| 3. L4.2 challenges | Low | Optional |
| 4. Slide 18 (PDB table) | Medium | L4.6 Task 5 covers it |
| 5. L4.5 steps 5–6 | Medium | The `required` limit in step 4 is the key part |

### Never cut

- **L4.4 in its entirety.** Steps 1 and 6 run the identical command with opposite results.
- **L4.4 step 3** — deriving the DNS rule from a broken cluster.
- **L4.6 Tasks 1 and 3** — the drain, with and without budgets, measured.
- **INC-4.**

---

## 4. The four places students get stuck

### 4.1 "I applied default-deny and everything is broken" (L4.4 step 2, ~14:30)

**That is the lab working.** Say so immediately and calmly, then point them at step 3 rather than giving the answer.

Students who paid attention in L4.2 derive it in two minutes. Students who skimmed it lose twenty. That gap is the entire justification for the module ordering.

### 4.2 "My policies applied but nothing is enforced" (L4.4 step 6)

Calico is missing. This is the failure with no error message. Check it at 09:00, not at 15:00.

### 4.3 The Ingress returns 503 after default-deny (L4.4 step 5, ~14:50)

The ingress controller lives in its own namespace and is now blocked from reaching `edge-gateway`. It is in `07-allow-ingress-controller.yaml`, which some students apply out of order.

**Ask:** *"Which namespace is the controller in, and does any policy permit it?"*

### 4.4 The 4th pod stays Pending (L4.5 step 4, ~16:40)

Expected and scripted. `required` anti-affinity on hostname means replicas can never exceed nodes.

**Make them connect it to the HPA:** this is why `fraud-service` uses `preferred`. A hard rule plus autoscaling silently caps capacity during a spike, and the symptom looks nothing like the cause.

---

## 5. The demos worth doing live

| When | Demo | Time | Why |
|---|---|---|---|
| 09:00 | Gateway → PostgreSQL: **CONNECTED** | 1 min | States the problem in one command |
| L4.3 step 6 | A real payment over HTTPS from outside | 2 min | The milestone of the week so far |
| Slide 13 | `simulate-netpol.py` — 39/39 | 1 min | Shows the policy set is *tested*, not hoped |
| 17:00 close | The same gateway → PostgreSQL command: **BLOCKED** | 1 min | Opens and closes the day with one command |

That last one is the cleanest demonstration on the course that the day achieved something.

---

## 6. Questions you will be asked

| Question | Answer |
|---|---|
| *"Isn't a service mesh better than NetworkPolicy?"* | Different layers. NetworkPolicy is L3/L4 and cheap; a mesh adds L7 policy and mTLS at significant operational cost. Most platforms should do NetworkPolicy properly first. |
| *"Do I need Ingress if I have a LoadBalancer?"* | A LoadBalancer per service is expensive and gives no HTTP routing. Ingress puts one entry point in front of many services. |
| *"Why not just use NodePort?"* | It opens a port on every node, bypasses your TLS and rate limiting, and is an unnecessary attack surface. |
| *"Can NetworkPolicy do L7 rules?"* | Not in core Kubernetes. Calico and Cilium have extensions; a mesh does it properly. |
| *"Should every namespace have default-deny?"* | For anything regulated, yes. The cost is that every new call path needs an explicit rule — which is the point. |
| *"What if I need to debug and the policy blocks me?"* | Use `kubectl exec` into a permitted pod, or add a **temporary, time-boxed, reviewed** policy. Never delete a default-deny. |

---

## 7. Incident INC-4

```bash
make incident N=4      # three faults
make resolve N=4
```

**The trap that matters:** a student deletes `default-deny-all` or a legitimate allow-rule "to see if that fixes it". It does. **Let them.** Then in the debrief ask them to run the gateway → PostgreSQL check and explain the result to a QSA.

That exact temptation returns in tomorrow's capstone under more pressure, and taking it costs the Secure competency.

**Fault C is the discriminator.** It produces no logs and no events — only a metric that moved. Most students find A and B within five minutes and take 15–25 on C.

**If nobody has C at 22 minutes:** *"Alert 3 says no errors are logged anywhere. What kind of network failure produces no error at all?"*

---

## 8. End-of-day checklist

- [ ] `make validate-lab LAB=L4.4` passes — **gateway CANNOT reach PostgreSQL**
- [ ] `python3 platform/admin/validate/simulate-netpol.py` returns 39/39
- [ ] All six PDBs applied, none with zero allowed disruptions
- [ ] **All nodes uncordoned** — `kubectl uncordon --all`
- [ ] All taints removed
- [ ] loadgen stopped
- [ ] INC-4 resolved, and **no security control was deleted to do it**
- [ ] Assessments collected

**Close by re-running the morning's command.** CONNECTED at 09:00, BLOCKED at 17:00, same command. Nothing else demonstrates the day as well.
