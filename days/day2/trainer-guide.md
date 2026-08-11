# Day 2 — Trainer Guide

**Today is the day the course earns its fee.** Day 1 was foundations; today students build the things that stop production breaking. If you deliver only one day well, make it this one.

---

## 1. Before the room opens

| When | Do |
|---|---|
| **Evening before** | Read §4 — the three places students get stuck. Two of them are new today. |
| **60 min out** | Verify metrics-server: `kubectl top pods -n axispay-core`. If it errors, students cannot do L2.4 at all. |
| **45 min out** | Build the v1.1.0 image: `eval $(minikube -p axispay docker-env) && bash scripts/build/build-service.sh --service payment-service --tag 1.1.0`. Without it L2.6 stalls. |
| **30 min out** | Projector: open the deck AND a terminal. Today has three live demos. |
| **15 min out** | Two terminals ready plus a port-forward to loadgen on 8090. |

### Overnight failures you will see at 09:00

| Symptom | Cause | Fix |
|---|---|---|
| `make validate-day1` fails, pods `Pending` | Laptop slept; Minikube did not recover cleanly | `minikube stop -p axispay && minikube start -p axispay` |
| `kubectl top` errors | metrics-server never enabled, or still warming | `minikube addons enable metrics-server -p axispay`, wait 60 s |
| Images missing | Docker daemon reset | `eval $(minikube -p axispay docker-env) && make build-all` |
| INC-1 never resolved | Student left it broken | `make resolve N=1` |

---

## 2. Minute-by-minute

| Time | Block | Min | Notes |
|---|---|---|---|
| 09:00 | Recap + platform health (slides 2–3) | 20 | Everyone runs `make validate-day1` |
| 09:20 | M2.2 theory (slides 4–8) | 45 | The 83 ms headroom story |
| 10:05 | **LAB L2.1** | 45 | Both failure modes |
| 10:50 | *Break* | 15 | |
| 11:05 | M2.2 governance (slide 10) | 15 | |
| 11:20 | **LAB L2.2** | 30 | |
| 11:50 | M2.3 theory (slides 11–15) | 45 | **The most important 45 minutes of the week** |
| 12:35 | *Lunch* | 45 | |
| 13:20 | **LAB L2.3** | 50 | Includes building the cascade bug |
| 14:10 | M2.4 theory (slides 17–20) | 40 | |
| 14:50 | **LAB L2.4** | 55 | |
| 15:45 | *Break* | 15 | **Inject INC-2 now** |
| 16:00 | M2.5 (slides 22–24) | 30 | |
| 16:30 | **LAB L2.5** | 45 | Independent |
| 17:15 | M2.6 (slides 26–29) | 40 | |
| 17:55 | **LAB L2.6** | 55 | The proof |
| — | INC-2 + knowledge check + assessment | 65 | |

> As on Day 1 this is the full menu and does not fit seven hours. See §3.

---

## 3. Running late — cut in this order

| Cut | Cost | Why safe |
|---|---|---|
| 1. Slide 8 (QoS table) | Low | The lab shows all three classes empirically |
| 2. Slide 19 (scale up/down asymmetry) | Low | L2.4 step 6 demonstrates it — five minutes of silence teaches it better |
| 3. Slide 24 (Job/CronJob fields) | Medium | It is in the manual; L2.5 is independent anyway |
| 4. L2.5 tasks 5–6 (CronJob) | Medium | Demo the CronJob yourself in 3 minutes instead |
| 5. L2.1 steps 5–6 | **High — resist** | This is where throttling and OOMKill become real |

### Never cut

- **M2.3 and L2.3.** Probes are the single biggest gap in the source syllabus and the cause of most real outages.
- **L2.3 step 6** — building the cascading-failure bug. Nothing else on the course lands as hard.
- **L2.6 steps 5–6** — the with-probe / without-probe measurement. That is the deliverable.
- **INC-2.**

---

## 4. The three places students get stuck

### 4.1 "My HPA says `<unknown>`" (L2.4, ~15:00)

Two causes, and they look identical:

1. metrics-server is not running or has not scraped yet — wait 60 s.
2. The target has no CPU request.

**In our cluster, cause 2 is masked by the LimitRange from L2.2**, which supplies a `defaultRequest`. That is why L2.4 step 2 creates a scratch namespace with no LimitRange. If students skip that, they never see the real failure. Push them to do it.

### 4.2 The cascade lab feels like it broke their cluster (L2.3 step 6, ~13:50)

Students point liveness at `/readyz`, scale `merchant-service` to zero, and watch every `payment-service` pod restart repeatedly. Several will panic and think they have destroyed something.

**Say:** *"That is exactly what was supposed to happen. Now undo it and explain to the person next to you what you just saw."*

Then make sure everyone runs `kubectl rollout undo`. The validation script **fails the lab** if liveness still points at `/readyz` — deliberately, because leaving it would carry the bug into Friday's capstone.

### 4.3 "Zero failures — did the rollout actually happen?" (L2.6 step 5)

Because it works, several students will doubt it did anything. Have them confirm three ways: the image tag on the pods, two ReplicaSets in `kubectl get rs`, and a live payment returning `risk_score` and `acquirer`.

Then step 6 removes the probe and the counter moves. **That contrast is the point of the whole day** — do not let anyone leave without seeing both numbers.

---

## 5. The three live demos

| Slide | Demo | Time | Why it matters |
|---|---|---|---|
| 14 | Force a pod unready; watch it leave EndpointSlice with `RESTARTS: 0` | 8 min | Makes the readiness mechanism concrete in 90 seconds |
| 28 | Roll out v1.1.0 at 40 rps with the failure counter on screen | 12 min | The strongest evidence on the course |
| 23 | `minikube node add` while everyone watches a DaemonSet | 5 min | The per-node invariant, live |

For demo 2, run the *first* half live (with the probe) and show the second half from the slide. Running both live costs 25 minutes you do not have.

---

## 6. Questions you will be asked

| Question | Answer |
|---|---|
| *"Should we set CPU limits at all?"* | Genuinely contested. Throttling is invisible and often worse than the noisy neighbour it prevents. Many mature teams set memory limits and omit CPU limits. Present both sides — do not pretend there is consensus. |
| *"Why not just set requests == limits everywhere?"* | That is Guaranteed QoS. You get better eviction protection and zero burst headroom — so you are throttled at exactly the moment traffic spikes. A real trade. |
| *"Can readiness and liveness use the same endpoint?"* | They can, and it is the cascading-failure bug. Never do it. |
| *"How do I autoscale on queue depth?"* | Custom or external metrics via an adapter (KEDA is common). Beyond this course; signposted on Day 5. |
| *"Does the HPA conflict with `kubectl scale`?"* | Yes. The HPA owns `spec.replicas` and will overwrite you within 15 seconds. |
| *"Why 8 seconds in `preStop`?"* | Long enough for endpoint removal to reach every node's kube-proxy. It is an empirical number, not a magic one — tune it to your cluster size. |
| *"Is `Recreate` ever right?"* | Yes — a non-backwards-compatible schema migration, or a singleton holding an exclusive lock. A deliberate outage in exchange for correctness. |

---

## 7. Incident INC-2

```bash
make incident N=2      # during the 15:45 break, unannounced
make resolve N=2       # escape hatch
```

**The deliberate trap:** several students will see `CrashLoopBackOff`, run `kubectl logs` *without* `--previous`, get "container is waiting to start", and conclude it is yesterday's incident. **Let them.** The recovery — noticing `RESTARTS` is non-zero, so a container *did* run — is the lesson.

**If nobody has it at 20 minutes:** *"You have the logs from the run that failed. They are clean. What kills a process without letting it log anything?"*

**Debrief priority:** question 3 (why is a clean log itself a clue) and question 6 (why the probes could not save you). Both are more valuable than the root cause itself.

---

## 8. Assessment

Same shape as Day 1: 10 items, 15 minutes, closed book except the cheat sheet. Answer key with distractor rationale and per-question remediation in `documents/assessments/answer-keys/day2-answer-key.md`.

**Cohort signals:**

| If | Then |
|---|---|
| > ⅓ miss the liveness/readiness question | Re-teach before Day 3. StatefulSet readiness depends on it. |
| > ⅓ miss the HPA denominator | Five minutes tomorrow — it recurs when Redis is added |
| > ⅓ miss throttling vs OOMKill | Recap; it is a capstone diagnosis on Friday |

---

## 9. End-of-day checklist

- [ ] `make validate-lab LAB=L2.6` passes for everyone
- [ ] **No student has liveness pointing at `/readyz`** (the validator catches it)
- [ ] `payment-service` is on v1.1.0 everywhere
- [ ] INC-2 resolved on every cluster
- [ ] loadgen stopped (it will run all night otherwise and skew tomorrow)
- [ ] Assessments collected

**Close with the Day 3 hook:** have someone delete a `payment-service` pod and try to fetch a payment created that morning. It is gone. Fifteen seconds, and it sells tomorrow better than any slide.
