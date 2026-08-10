# Day 1 — Trainer Guide

**Read this the evening before you deliver.** It contains the timing, the three places students reliably get stuck, and the decisions you will have to make in the room.

---

## 1. Before the room opens

| When | Do |
|---|---|
| **7 days out** | Send the pre-course pack. Insist on `make preflight` output. This one thing prevents more lost mornings than anything else you can do. |
| **1 day out** | Build the reference cluster yourself, end to end. Do not trust last month's. |
| **60 min out** | `make setup && make build-all && make deploy-day1 && make validate-day1`. Then `make clean` so you start where students start. |
| **30 min out** | Projector test — open the deck and check the terminal font is legible **from the back row**. 14pt minimum in a real room. |
| **15 min out** | Two terminals ready: one for demos, one for `kubectl get events -A --watch`. |

### The four preflight failures you will actually see

| Symptom | Cause | Fix in the room |
|---|---|---|
| `docker: permission denied` | User not in the `docker` group | `sudo usermod -aG docker $USER && newgrp docker` |
| Cluster starts, one node only | Missing `--nodes` | `minikube node add -p axispay` — non-destructive |
| `kubectl get ns` hangs | Corporate proxy intercepting localhost | `export NO_PROXY=$NO_PROXY,192.168.49.0/24,.svc,.cluster.local` |
| **No Calico pods** | Built without `--cni=calico` | **Rebuild now.** CNI cannot be changed later and Thursday depends on it. |

---

## 2. Minute-by-minute

| Time | Block | Min | Notes |
|---|---|---|---|
| 09:00 | Welcome, deck slides 1–4 | 20 | Your own production incident story. 60 seconds. Non-negotiable. |
| 09:20 | M1.1 Context (5–8) | 30 | Ends on the request-flow diagram |
| 09:50 | M1.2 Why orchestration (9–13) | 35 | The 02:14 story. Tell it slowly. |
| 10:25 | M1.3 Declarative (14–17) | 40 | **The most important 40 minutes of the week** |
| 11:05 | *Break* | 15 | |
| 11:20 | M1.4 Architecture (18–23) | 45 | Includes the `kubectl apply` live demo |
| 12:05 | **LAB L1.1** | 30 | Verify Calico for every student |
| 12:35 | *Lunch* | 45 | |
| 13:20 | M1.5 Namespaces (24–28) | 35 | |
| 13:55 | **LAB L1.2** | 30 | The cross-namespace ping is the point |
| 14:25 | M1.6 Pods (29–33) | 45 | |
| 15:10 | **LAB L1.3** | 40 | Ends with them deleting a Pod and nothing happening |
| 15:50 | *Break* | 15 | **Inject INC-1 now** if running to time |
| 16:05 | M1.7 Deployments (34–38) | 35 | The ownership chain slide |
| 16:40 | **LAB L1.4** | 55 | |
| 17:35 | M1.8 Services (39–45) | 40 | |
| 18:15 | **LABS L1.5 + L1.6** | 95 | |
| — | M1.9 + INC-1 + close | 50 | |

> **This does not fit in seven hours and it is not supposed to.** The table above is the full menu. See §3 for what to cut.

---

## 3. Running late — cut in this order

| Cut | Cost | Why it is safe |
|---|---|---|
| 1. Slides 11–13 (containers → orchestration detail) | Low | The 02:14 story alone does the motivating work |
| 2. Slide 20 (control-plane cards, detail) | Low | The architecture diagram carries it; the manual has the depth |
| 3. Slide 28 (namespaced vs cluster-scoped table) | Medium | Recap it on Day 5 before RBAC, where it actually bites |
| 4. Lab L1.1 challenges | Low | They are optional by design |
| 5. Slide 45 (load-balancing demo) — *do it live in L1.5 instead* | Low | Students do it themselves in the lab |

### Never cut

- **M1.3, the reconciliation loop.** The whole week rests on it.
- **INC-1.** It is the single highest-value 35 minutes of the day.
- **The L1.3 → L1.4 contrast** (bare Pod dies vs Deployment heals). That contrast is the lesson.

---

## 4. The three places students get stuck

### 4.1 "Why is my pod not Ready?" (L1.3, ~15:25)

`payment-service` reports `0/1` because `merchant-service` does not exist yet.

**This is correct and it is deliberate.** Do not "fix" it. Say:

> *"The process is alive. It cannot serve. Those are different things, and by tomorrow lunchtime you will be making Kubernetes act on the difference."*

Half the room will have an audible penny-drop moment on Day 2 because of this.

### 4.2 Labels and selectors (L1.4 challenge 2, ~17:10)

Students relabel a pod, end up with four pods and three endpoints, and cannot explain it.

**Do not explain it.** Ask instead:
1. Which pods does the ReplicaSet think it owns?
2. Which pods does the Service think it owns?
3. Who owns the orphan?

They get there in about two minutes, and it sticks permanently.

### 4.3 `kubectl logs` during INC-1 (~16:35)

They run `kubectl logs`, get "container is waiting to start", and stall.

**Let it happen.** It is the most valuable failure of the day and it is why the triage loop puts events before logs. If someone is still stuck at 15 minutes:

> *"Compare a failing pod with a healthy one. What is literally different between them?"*

Nothing more than that.

---

## 5. Questions you will be asked

| Question | Answer |
|---|---|
| *"Is Kubernetes overkill for three services?"* | Often, yes — say so. It earns credibility. The break-even is usually around "more than one machine, or more than one team deploying independently". |
| *"Why not Docker Compose?"* | Compose orchestrates one host. Kubernetes orchestrates a fleet, and adds self-healing, rolling updates and declarative state. Compose is excellent for local development. |
| *"Do I still need VMs?"* | Yes. Almost every production cluster runs on them. They are not alternatives. |
| *"Is this how the cloud providers do it?"* | EKS/AKS/GKE manage the control plane for you. Everything you learn this week applies unchanged; you just do not run etcd yourself. |
| *"Can I run databases on Kubernetes?"* | Yes, and Wednesday shows how. Whether you *should* depends on your team's operational maturity — a managed database is often the better business decision. Be honest about this. |
| *"What about serverless?"* | Different trade: less control, less operational burden. Many organisations run both. Not a competitor to this material. |
| *"Why is the YAML so verbose?"* | Because it is an API, not a configuration file. Helm (Day 5) and Kustomize reduce the repetition. |

---

## 6. Assessment administration

| | |
|---|---|
| **Knowledge check** (16:55, 15 min) | Verbal, whole room, **not scored**. Ask, pause, take an answer, correct gently. ~90 s each. |
| **Day assessment** (17:10, 15 min) | `documents/assessments/day1-assessment.md`. Individual, scored, closed-book except the cheat sheet. |
| **Marking** | Answer key with rationale in `documents/assessments/answer-keys/day1-answer-key.md`. Mark over the break; return Tuesday morning. |
| **Below 60%** | Talk to them privately Tuesday at 09:00 with a specific gap list — manual sections and lab numbers, never "study more". |

**Diagnostic signal:** if more than a third of the room gets Q3 (endpoints) or Q5 (ImagePullBackOff vs CrashLoop) wrong, spend five minutes of Tuesday's recap on it. Both are load-bearing for Day 2.

---

## 7. Incident INC-1

```bash
make incident N=1        # during the 15:50 break — do not announce it
make resolve N=1         # escape hatch if a student is stuck past the time box
```

Hand out the ticket from `labs/day1/INC-1-imagepullbackoff/` §2. Start the clock.

**Debrief is 10 minutes and the last question matters most:** *"What would have caught this before a merchant phoned?"* The answer — an alert on `readyReplicas < spec.replicas`, and a readiness probe that would have halted the rollout — is the bridge into Day 2. End the day there and let it hang overnight.

---

## 8. End-of-day checklist

- [ ] Every student's `make validate-day1` exits 0
- [ ] Every student has Calico running
- [ ] Every student has ≥ 2 nodes
- [ ] INC-1 resolved on every cluster
- [ ] Day 1 assessments collected
- [ ] Anyone below 60% noted for a Tuesday 09:00 conversation
- [ ] Tomorrow's images pre-pulled if the network is slow

**Tell them not to delete their cluster.** Someone always does.
