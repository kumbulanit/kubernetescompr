# Capstone Rubric — Production Upgrade Under Fire

**Total 100 points · Pass 70 · Distinction 88**

Assessed by observation plus the artefacts the student produces. Score each row as you observe it; do not reconstruct at the end.

Print one copy per student.

---

## Student

```
Name ______________________________  Date ____________  Start ______  End ______

Cluster profile:  A (3 nodes)  ·  B (2 nodes)  ·  slim values

Incidents injected at:   INC-5 ______   INC-6 ______   INC-7 ______
```

---

## 1 · Upgrade executed correctly — 20 points

| Pts | Criterion | Observed |
|---:|---|:--:|
| 4 | Baseline recorded **before** any change: health, replicas, SLO figures, ledger balance | ☐ |
| 3 | Rollback plan written down before the upgrade, not improvised after | ☐ |
| 4 | `helm upgrade` used with `--atomic` (or an explicit, defended reason not to) | ☐ |
| 3 | Migration Job ordering deliberate and defended — student can say which code tolerates which schema | ☐ |
| 3 | Migration ran **exactly once**; no duplicate rows and no second Job | ☐ |
| 3 | Rollout watched in Grafana *during*, not confirmed only by `rollout status` after | ☐ |

**Zero for this section** if the student edited a live object with `kubectl edit` instead of going through the chart. That is the drift the whole week argued against.

---

## 2 · SLOs maintained — 20 points

Measured from Prometheus over the change window, not from the student's opinion.

| Pts | Criterion | Measured |
|---:|---|:--:|
| 8 | Availability ≥ 99.5% across the window | ______ % |
| 6 | p99 latency < 300 ms except during the INC-5 window | ______ ms |
| 6 | Zero payments lost or double-processed (`capstone-validate.sh` idempotency check) | ☐ |

```promql
# availability across the window
sum(rate(axispay_http_requests_total{service="payment-service",status!~"5.."}[110m]))
  / sum(rate(axispay_http_requests_total{service="payment-service"}[110m]))
```

> **Partial credit is real here.** A student who breaches the SLO during INC-5 but recovers within four minutes and can say exactly how long the breach lasted has demonstrated more than one who never noticed.

---

## 3 · Three incidents root-caused — 25 points

Score each incident independently against the band descriptors in §7.

### INC-5 · Redis unavailable — 8 points

| Band | Pts | Descriptor |
|---|---:|---|
| Exemplary | 8 | Detected from the **approval-rate or latency panel before the ticket arrived**; correctly identified that every pod was Ready and explained *why* (Redis is a non-critical dependency in fraud-service's readiness registry); fixed and verified; named the alert that would have caught it sooner |
| Proficient | 6 | Systematic triage, correct root cause, verified fix |
| Developing | 4 | Reached the fix by pattern-matching or by guessing at Redis |
| Beginning | 2 | Needed significant guidance |

> The discriminator: **did they notice that `kubectl get pods` was entirely green?** A student who spends ten minutes on pods before looking at a business metric has found the right answer the wrong way.

### INC-6 · Settlement database unreachable — 9 points

| Band | Pts | Descriptor |
|---|---:|---|
| Exemplary | 9 | Used queue depth as the signal; traced async → data; restored the **correct** policy from `manifests/day4/netpol/`; explicitly rejected deleting it and said why |
| Proficient | 7 | Correct root cause, restored the original policy, verified |
| Developing | 4 | Correct root cause but restored service by loosening the policy beyond its original scope |
| Beginning | 2 | Needed guidance to reach the namespace boundary |

### **The trap — mandatory annotation**

```
Did the student DELETE the NetworkPolicy to restore service?     ☐ yes   ☐ no

If yes:  §5 (Security posture) scores 0, and ask in the debrief —
         "You are in a PCI audit next week. Talk me through this change."

Record their answer verbatim; it is the most useful thing on this page:
_______________________________________________________________________
_______________________________________________________________________
```

> This moment is the point of the whole exercise. In a regulated environment the fastest fix and the correct fix are frequently different, and knowing the difference is the job. A student who deletes the policy, then catches themselves and restores it properly, should be scored **Proficient** and told exactly why that recovery mattered.

### INC-7 · Expired TLS certificate — 8 points

| Band | Pts | Descriptor |
|---|---:|---|
| Exemplary | 8 | Recognised that in-cluster health being green was *evidence*, not noise; used `openssl s_client` to read the dates; rotated the Secret; verified with a real handshake, not `curl -k` |
| Proficient | 6 | Correct root cause, rotated the Secret, verified |
| Developing | 4 | Found it after being pointed at the edge |
| Beginning | 2 | Needed the cause given |

> **Watch for `curl -k`.** A student who verifies the fix with `-k` has verified nothing — `-k` is what disables the check that was failing.

---

## 4 · Validation and the ledger — 15 points

| Pts | Criterion | Observed |
|---:|---|:--:|
| 6 | `capstone-validate.sh` exits 0 | ☐ |
| 4 | Ledger sums to exactly zero; student can explain double-entry balance | ☐ |
| 3 | Queue depth drained to zero; no stuck consumers | ☐ |
| 2 | Student ran validation **unprompted**, as part of their own method | ☐ |

---

## 5 · Security posture preserved — 10 points

| Pts | Criterion | Observed |
|---:|---|:--:|
| 4 | All NetworkPolicies present and no broader than the Day 4 originals | ☐ |
| 2 | Pod Security labels unchanged; no namespace relaxed to make something start | ☐ |
| 2 | No ServiceAccount granted extra RBAC to work around a failure | ☐ |
| 2 | TLS certificate valid at the end of the window | ☐ |

**Automatic zero** if the NetworkPolicy was deleted (§3, INC-6).

```bash
python3 scripts/validate/simulate-netpol.py     # must still report 46 assertions
python3 scripts/validate/simulate-rbac.py       # must still report 28 assertions
```

---

## 6 · Presentation — 10 points

| Pts | Criterion | Observed |
|---:|---|:--:|
| 2 | Timeline is accurate and in order | ☐ |
| 3 | Root causes stated as **causes**, not symptoms ("Redis was scaled to zero", not "fraud was slow") | ☐ |
| 2 | Impact quantified in payments and rands, not in pods | ☐ |
| 2 | Two concrete preventive actions, at least one an alert that does not yet exist | ☐ |
| 1 | Handles a challenging question without becoming defensive | ☐ |

---

## 7 · Band descriptors (applied per incident)

| Band | Criterion |
|---|---|
| **4 — Exemplary** | Systematic triage, correct root cause, verified fix, **and** identified the missing alert that would have detected it first |
| **3 — Proficient** | Systematic triage, correct root cause, verified fix |
| **2 — Developing** | Reached the fix, but by guessing or pattern-matching rather than by method |
| **1 — Beginning** | Required significant guidance to progress |

> **A student who follows the method and does not finish scores higher than one who guesses correctly.** State this to the class before INC-1 on Monday. It is the behaviour that transfers to a real on-call rotation, and scoring it any other way teaches the opposite.

---

## Score sheet

```
1. Upgrade executed correctly          ______ / 20
2. SLOs maintained                     ______ / 20
3. Incidents root-caused               ______ / 25
       INC-5 ____/8   INC-6 ____/9   INC-7 ____/8
4. Validation and the ledger           ______ / 15
5. Security posture preserved          ______ / 10
6. Presentation                        ______ / 10
                                       -------------
                              TOTAL    ______ / 100

Result:   ☐ Distinction (88+)   ☐ Pass (70+)   ☐ Not yet (<70)
```

---

## Feedback (complete during the debrief, while it is fresh)

```
Strongest moment — be specific about the behaviour, not the outcome:
_______________________________________________________________________

The one habit that would most improve their next incident:
_______________________________________________________________________

Did they say "I don't know" at any point?   ☐ yes  ☐ no
  (In an engineer this is a strength. Say so.)

Ready to be on call for a payment platform?   ☐ yes  ☐ with support  ☐ not yet
```

---

## Notes for the assessor

- **Score as you observe.** Reconstructing at the end favours students who finished over students who reasoned well.
- **Watch the first command of each incident.** It tells you more than the fix does. `kubectl get pods -A` is a reasonable start; `kubectl delete` is not.
- **Do not answer questions about causes.** Tools, yes: "how do I read the certificate expiry" is a fair question. "Is it the certificate" is not.
- **The trap is not a gotcha.** If a student deletes the policy, let them; the debrief question is the teaching, and it lands far harder than a warning would have.
- **Time-box Phase 5 strictly.** Five minutes is part of the assessment. Real incident reports have an audience with somewhere else to be.
