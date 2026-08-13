# Day 3 — Trainer Guide

**Today the platform gets a memory.** It is the most infrastructure-heavy day and the one most likely to run long. Read §3 before you start.

---

## 1. Before the room opens

| When | Do |
|---|---|
| **Evening before** | Regenerate seed data if you changed anything: `python3 platform/admin/authoring/generate_seed.py -o data/seed/02-seed.sql`. It asserts both invariants and refuses to write if they fail. |
| **60 min out** | Pre-pull `postgres:17-alpine`, `redis:7.4-alpine`, `rabbitmq:4-management-alpine`. First pull on 20 laptops over one venue connection is the classic Day 3 disaster. |
| **45 min out** | Check free disk: the data tier needs ~8 GB of PVCs plus images. `minikube -p axispay ssh -- df -h`. |
| **30 min out** | Run L3.5 end to end yourself on a clean cluster and time it. |

### Pre-pull command to send students the night before

```bash
minikube -p axispay ssh -- 'docker pull postgres:17-alpine; docker pull redis:7.4-alpine; docker pull rabbitmq:4-management-alpine'
```

---

## 2. Minute-by-minute

| Time | Block | Min | Notes |
|---|---|---|---|
| 09:00 | Recap + the "delete a pod, lose everything" demo | 20 | Fifteen seconds of demo sells the whole day |
| 09:20 | M3.1 ConfigMaps (slides 5–8) | 35 | |
| 09:55 | **LAB L3.1** | 40 | Step 5 is the point |
| 10:35 | *Break* | 15 | |
| 10:50 | M3.2 Secrets (slides 9–12) | 40 | The base64 slide |
| 11:30 | **LAB L3.2** | 40 | Everyone decodes a Secret |
| 12:10 | *Lunch* | 45 | |
| 12:55 | M3.3–M3.4 Storage (slides 13–15) | 45 | |
| 13:40 | **LABS L3.3 + L3.4** | 65 | |
| 14:45 | *Break* | 15 | |
| 15:00 | M3.5–M3.6 (slides 16–19) | 45 | |
| 15:45 | **LABS L3.5 + L3.6** | 110 | **The big block. Protect it.** |
| 17:35 | M3.7 + **LAB L3.7** | 55 | |
| — | INC-3 + knowledge check + assessment | 65 | |

> Does not fit seven hours. See §3.

---

## 3. Running late — cut in this order

| Cut | Cost | Why safe |
|---|---|---|
| 1. Slide 13 (access modes table) | Low | It is in the cheat sheet and the manual |
| 2. L3.4 challenges | Low | Optional by design |
| 3. L3.7 tasks 5–6 | Medium | Task 5's table is a good homework item |
| 4. L3.3 step 6 (reclaim policy walkthrough) | Medium | Discuss verbally instead — 3 minutes |
| 5. L3.6 step 1 (bad-postgres) | **High — resist** | This is the module's whole argument |

### Never cut

- **L3.2 step 3.** Everyone decodes a Secret with their own hands.
- **L3.5 steps 5–6.** Querying their own database and seeing the ledger balance to zero.
- **L3.6 step 1.** Building the database as a Deployment and watching it fail.
- **INC-3.**

---

## 4. The four places students get stuck

### 4.1 "My PVC is Pending — is it broken?" (L3.4, ~14:00)

`WaitForFirstConsumer` keeps it Pending until a pod needs it. Several will assume failure.

**Say:** *"Read the event, not the status. `waiting for first consumer` is correct. `storageclass not found` is not. The status is identical; the event is everything."*

That sentence is also the answer to INC-3a, so it pays for itself twice.

### 4.2 `permission denied` on the data directory (L3.5, ~16:00)

Missing `fsGroup`. The error points at a directory that looks perfectly normal.

**Do not give the answer.** Ask: *"Who owns that directory, and who is the process?"* `kubectl exec -- ls -ld` and `id` answer it in ten seconds.

### 4.3 Seeding fails partway (L3.5, ~16:15)

`ON_ERROR_STOP=1` means a constraint violation aborts the load, leaving partial data.

**Do not debug the partial state.** Re-run:
```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
./scripts/setup/05-seed-database.sh
```

### 4.4 The node-local storage trap (L3.6 step 5, ~17:00)

Students cordon a node, delete the pod, and get `volume node affinity conflict`. Several will think they have broken the cluster.

**Say:** *"That is correct behaviour. Kubernetes is refusing to start your database somewhere its data does not exist. Starting it on an empty volume would look exactly like data loss."*

Then have them uncordon and confirm the 5,000 rows are still there. **This is one of the most valuable five minutes of the week** — it is the constraint that shapes every real decision about databases on Kubernetes.

---

## 5. The three demos worth doing live

| When | Demo | Time | Why |
|---|---|---|---|
| 09:00 | Delete a payment-service pod, then fetch a payment from this morning → 404 | 1 min | Sells the entire day |
| Slide 10 | `kubectl get secret … \| base64 -d` in front of the room | 1 min | Nobody forgets it |
| L3.5 step 6 | `SELECT * FROM v_ledger_balance;` on your own cluster | 2 min | They get identical numbers — the generator is deterministic |
| Close | Exec into edge-gateway, connect to postgres directly | 1 min | Sells Day 4 completely |

---

## 6. Questions you will be asked

| Question | Answer |
|---|---|
| *"Should we run databases on Kubernetes at all?"* | Be honest: often a managed database is the better business decision. Run it on Kubernetes when you need portability, have the operational maturity, and use an Operator. Never on a bare StatefulSet in production. |
| *"Is a Secret ever safe enough?"* | With RBAC restricting `get secrets`, etcd encryption at rest, and volumes rather than env vars — reasonable for many organisations. For regulated environments, an external manager with short-lived credentials. |
| *"Why not just use hostPath everywhere? It's fast."* | Because it pins pods to nodes. Fine for a single-node dev cluster; a serious availability constraint anywhere else. |
| *"Can I shrink a PVC?"* | No. Expansion only, and only with `allowVolumeExpansion`. Plan sizes. |
| *"What is the difference between a Secret and a ConfigMap really?"* | RBAC can be applied separately, etcd encryption applies to Secrets, and the kubelet keeps them in memory rather than on disk. Meaningful, but not encryption. |
| *"Do I need an Operator?"* | For a production database, yes. Replication, failover and backups are not things Kubernetes knows about. |

---

## 7. Incident INC-3

```bash
make incident N=3      # injects BOTH faults
make resolve N=3
```

**This is the first incident with two unrelated faults**, and prioritisation is the graded skill.

**The trap:** almost everyone fixes the loud fault (`postgres-0 Pending`) first because it looks worse. The correct order is the quiet one first — `ledger-service` is on the payment path, and it is a one-line fix.

In the debrief, ask what a merchant experienced during the extra four minutes. **Triage severity is about customer impact, not about how alarming the symptom looks.**

Watch for anyone deleting a **bound** PVC to "clean up". Stop them immediately and ask what `Retain` is for.

---

## 8. End-of-day checklist

- [ ] `make validate-lab LAB=L3.5` passes for everyone (**ledger imbalance 0**)
- [ ] All three StatefulSets ready, all PVCs Bound
- [ ] `bad-postgres` deleted
- [ ] Every node uncordoned (`kubectl uncordon --all`)
- [ ] INC-3 resolved
- [ ] Disk headroom checked — Day 5 adds the observability stack
- [ ] Assessments collected

**Close with the Day 4 hook:** exec into `edge-gateway`, connect to PostgreSQL directly. It works. In a PCI audit that single fact puts the DMZ inside the cardholder data environment.
