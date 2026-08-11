# Day 5 — Trainer Guide

**The day it becomes operable, and the day they are assessed.** Two thirds of today is normal teaching; the last third is a 110-minute individual assessment worth 25% of the course. Those two halves need different energy from you, and the switch happens at 15:10.

---

## 1. Before the room opens

| When | Do |
|---|---|
| **Two evenings before** | Tell the class to run `make observability` at the end of Day 4. It pulls ~1.5 GB. This is the single most common way today runs late. |
| **Evening before** | `bash capstone/validation/prepare-capstone.sh --build` on your own cluster. It builds the 2.0.0 images and checks everything the capstone needs. |
| **Evening before** | Print the rubric — `documents/instructor/capstone-rubric.md` — one copy per student. You will write on it during the exercise, not afterwards. |
| **60 min out** | On every student cluster: `kubectl get pods -n axispay-observability`. Anyone missing the stack starts it now and pairs for M5.5. |
| **30 min out** | Open Grafana, Prometheus and the alert sink on your demo machine. Hunting for a port-forward at minute 62 of the capstone is a self-inflicted incident. |
| **15 min out** | `python3 scripts/validate/check-promql.py` and `check-helm-chart.py`. Both green before you teach from them. |

### The check that must not be skipped

```bash
minikube -p axispay image ls | grep ':2.0.0' | wc -l     # expect 16
```

A student who cannot pull 2.0.0 spends the whole capstone on `ImagePullBackOff` and learns nothing the exercise was designed to teach. Build the night before, on every machine.

---

## 2. Minute-by-minute

| Time | Block | Min | Notes |
|---|---|---|---|
| 09:00 | Recap + set the frame | 20 | Say the scoring rule out loud. It changes how they work all day. |
| 09:20 | M5.1 identity + Pod Security | 35 | The 403 demo. Do it live, do not describe it. |
| 09:55 | M5.2 RBAC theory | 30 | The 2×2, then the four rules. `pods/exec` is the moment. |
| 10:25 | **Break** | 15 | |
| 10:40 | **L5.1 + L5.2** | 80 | Circulate. Send back anyone who writes RBAC without proving it. |
| 12:00 | **Lunch** | 45 | |
| 12:45 | M5.3 + M5.4 Helm | 40 | Be even-handed. Templating has real costs. |
| 13:25 | **L5.3 + L5.4** | 90 | Step 7 of L5.3 breaks the chart on purpose — check they restore it. |
| 14:55 | **Break** | 15 | |
| 15:10 | M5.5 + M5.6 observability | 55 | Compress if needed; the labs carry it. |
| 16:05 | **L5.5 + L5.6** | 45 | Short. They will not finish; that is planned — see §3. |
| 16:50 | Assessment | 15 | Ten items. |
| 17:05 | Capstone brief + set up | 10 | |
| 17:15 | **CAPSTONE** | 110 | See `documents/instructor/capstone-run-book.md` |

> **Note on the shape of this day.** It is longer than the others because the capstone is an assessment, not a lab. If your course runs to a strict 17:00 finish, run the capstone as a separate session — do **not** compress it to 60 minutes. At 60 minutes the incidents overlap, the students cannot triage, and the exercise measures panic rather than method.

---

## 3. Running late — cut in this order

1. **The `warn` versus `enforce` demo in L5.1 step 8.** The slide carries it.
2. **L5.4 steps 5 and 6** (shape diff, drift detection). Demo them instead of having everyone run them.
3. **L5.3 step 7** — the immutable selector. Painful to lose because it is the most transferable defect in the module, so demo it on your own cluster rather than dropping it.
4. **L5.6 steps 1–6** if Loki is not installed anywhere. The alert-routing half (steps 7–8) still works and is the more assessable part.
5. **The end-of-day assessment.** Set it as homework and mark it on Monday.

**Never cut:** L5.2's `auth can-i` proof block, the silence alert in M5.5, or the capstone. Those three are what the course is sold on.

---

## 4. The five places students get stuck

**1 — "My token is still mounted."**
They set `automountServiceAccountToken: false` and check an old pod. The setting applies to new pods only. `kubectl rollout status` first.

**2 — "`auth can-i` says yes to everything."**
They forgot `--as`. They are cluster-admin. This wastes ten minutes if you do not catch it early — say it before the lab, and say it again when you see the first person confused.

**3 — "`helm upgrade` says the name is already in use."**
Objects exist from four days of `kubectl apply`. The lab tells them to delete the raw manifests first; people skip that step. Have the command ready.

**4 — "My Prometheus target is missing."**
This is the intended lesson of L5.5 step 2, so let it happen. Where it costs time is when a student breaks it and cannot get back — the label is `release=kube-prometheus-stack` and the reconcile takes up to 45 seconds. Tell them to wait before re-editing.

**5 — "Loki returns nothing."**
Two causes, and they need different fixes. If Alloy is not running, the namespace is not `privileged` — baseline forbids hostPath. If Alloy is running and the query is empty, they have dropped the label selector or the logs are not JSON.

---

## 5. The demos worth doing live

| Demo | Why |
|---|---|
| **Read the token, then use it** (M5.1) | The 403 is the moment the room stops treating it as a theoretical risk. |
| **The privileged pod rejection** (M5.1) | Five violations reported at once. It reads better than any slide about it. |
| **`kubectl exec -- printenv JWT_SIGNING_KEY`** (M5.2) | Thirty seconds, and it permanently changes how they review RBAC. |
| **Remove the ServiceMonitor `release` label** (M5.5) | Wait 45 seconds. The target vanishes rather than going red. Put it back. |
| **Scale loadgen to zero** (M5.5) | Every panel green, payments-per-minute at zero. The picture they remember. |
| **The correlation-ID query** (M5.6) | The callback to Monday. Do it live if the timing allows at all. |
| **The ledger query** (closing) | `SELECT SUM(amount_minor) FROM ledger_entries;` → 0. End the week on it. |

---

## 6. Questions you will be asked

**"Why not just use `cluster-admin` for the platform team?"**
Because an access review will ask you to justify it, and because the blast radius of a compromised laptop is then the whole cluster. Also worth saying: the narrow role took ten minutes to write and has needed no maintenance.

**"Isn't Helm just templating? Kustomize does this without a templating language."**
A fair question, and the honest answer is that Kustomize's overlay model avoids the whitespace-control problems entirely and is a genuine alternative. Helm's advantages here are release history, rollback, and the ecosystem of upstream charts you will consume whether or not you author your own. Do not defend Helm as obviously correct.

**"Why is the observability namespace `privileged`? Isn't that the thing we spent the morning removing?"**
Yes, and it is the right question. The answer is on the manifest: Alloy needs hostPath to read `/var/log/pods`, baseline forbids hostPath, and the namespace holds no cardholder data and is not internet-reachable. The exception is scoped to one namespace with one reason written next to it. That is what a defensible exception looks like, as opposed to a forgotten one.

**"Do we really need alerts if we have dashboards?"**
Ask who is looking at the dashboard at 03:00 on a Saturday.

**"Can we not just use `latest` and always get the newest?"**
Then you cannot roll back, because the tag moves. Ask them what `helm rollback` would do.

---

## 7. The capstone

Everything you need is in **`documents/instructor/capstone-run-book.md`** — timings, injection commands, hints in escalating order, and the debrief script. Read it before the day.

Three things to hold in mind while it runs:

- **Answer questions about tools, never about causes.** "How do I read a certificate's expiry" is fair. "Is it the certificate" is not. Hold the line kindly and consistently.
- **Score as you observe.** Reconstructing at the end favours the students who finished over the students who reasoned well, which is exactly backwards.
- **The trap in INC-6 is not a gotcha.** If a student deletes the NetworkPolicy, let them. The debrief question — *"You are in a PCI audit next week. Talk me through this change."* — is the teaching, and it lands harder than any warning would have.

---

## 8. End-of-day checklist

- [ ] Every student's `make validate-day5` passes, or you know why not
- [ ] The rubric is completed for every student, with the feedback boxes filled in *during* the debrief
- [ ] Anyone who deleted the NetworkPolicy has had the audit conversation and knows why it mattered
- [ ] The ledger query was run in front of the room
- [ ] Course feedback collected before anyone leaves the room
- [ ] Students know where the repository lives and that it is theirs to keep
- [ ] `make capstone-reset` run on any shared cluster before the next cohort

---

## 9. What to say at the end

Do not oversell it. Five days is not enough for Kubernetes, and the room knows that.

What is true, and worth saying plainly: they can deploy, scale, upgrade, secure, monitor and troubleshoot a real platform, and they have done all six under time pressure with faults they were not warned about. That is a lot. The honest next steps are on the closing slide, and the cost bullet is the one most employers will care about within a month.

Then close on the ledger. Through an upgrade, three incidents and 110 minutes under pressure, the money still balances to zero. It is the most concrete thing they did all week.
