# Final Examination

**AxisPay · Kubernetes Comprehensive (AXP-K8S-5D)**

| | |
|---|---|
| **Duration** | 60 minutes |
| **Weight** | 25% of the course (the capstone is a further 25%; daily assessments 50%) |
| **Format** | Closed book. Your own cheat sheet is permitted. No cluster. |
| **Pass** | 60% · **Merit** 75% · **Distinction** 88% |

Name: ________________________  Date: ____________

---

> **How this paper is marked.** Section A tests recall. Sections B and C test whether you can reason about a system you cannot see. A precise answer in your own words scores better than an exact quotation. Where a question asks *why*, an answer that only says *what* scores half.

---

## Section A — Short recall (10 marks, 1 each)

**A1.** A pod is `Running` but `0/1 READY`. In one sentence, what is happening and what is the consequence for traffic?

**A2.** Name the three probe types **by their consequence**, not by their names.

**A3.** What does `ReadWriteOnce` mean? Be precise about the unit.

**A4.** State the three properties of NetworkPolicy that determine whether a flow is permitted.

**A5.** Give the exit code that indicates OOMKilled, and say who killed the process.

**A6.** What is the difference between a Prometheus target that is **down** and one that is **missing**?

**A7.** In RBAC, how do you deny a permission?

**A8.** What is stored in a Helm release Secret?

**A9.** Which component may lag the API server by up to three minor versions, and what does that fact determine?

**A10.** Why must a container log to stdout rather than to a file inside itself?

---

## Section B — Reasoning (5 questions, 4 marks each — 20 marks)

**B1. The probe that made it worse.**

A team sets `payment-service`'s liveness probe to an endpoint that checks the database connection. PostgreSQL becomes slow for ninety seconds.

Describe what happens across the platform, in order, and explain why the outcome is worse than if no probe had been set at all. Then state the correct design and why.

---

**B2. The audit that passed and should not have.**

An access review confirms that nobody outside the platform team has `get` or `list` on `secrets` in `axispay-edge`. The JWT signing key is in that namespace, injected into `auth-service` as an environment variable.

Explain how someone with no `secrets` permission could still read the signing key. Name at least two distinct mechanisms. Then state what the access review should have examined instead.

---

**B3. The release that worked until it did not.**

A chart has been in production for four months. Installs work. Three patch releases worked. The first minor version bump fails:

```
Error: UPGRADE FAILED: cannot patch "payment-service" with kind Deployment:
Deployment.apps "payment-service" is invalid: spec.selector: field is immutable
```

Explain the defect, why it did not appear for four months, and what the recovery is. Then state the guard that would have prevented it.

---

**B4. Everything is green.**

At 02:00 the on-call engineer is called by a merchant. No payments have been accepted for forty minutes. Every pod is `Ready`. No alert has fired. The p99 latency panel is flat and excellent. The error rate is zero.

Explain why none of the existing alerts fired, give the alert that would have caught this, and name two plausible causes that are consistent with all the evidence above.

---

**B5. The fastest fix.**

During a change window, settlement writes begin failing. The audit queue is growing. Payments are unaffected. You find that a NetworkPolicy in `axispay-data` was replaced this morning under change record CR-2026-0819 and now admits only `axispay-core`.

Deleting the policy restores service in two seconds. State whether you would do it, and defend your answer to a change board. Give the fix you would actually apply.

---

## Section C — Design (2 questions, 10 marks each — 20 marks)

**C1. A new service.**

AxisPay is adding `dispute-service`. It:

- receives chargeback notifications from acquirers over HTTP
- reads and writes the `payments` and `ledger_entries` tables
- publishes an event to RabbitMQ for every dispute opened
- must not be reachable from the internet
- handles roughly 5 requests per second, with hourly spikes to 60

Specify how you would deploy it. Cover, with a sentence of justification each:

(a) workload kind and namespace
(b) resource requests and limits, and the reasoning behind the numbers
(c) all three probes, and what each endpoint should check
(d) whether it gets an HPA, and if so on what
(e) the NetworkPolicy rules it needs — both directions
(f) its ServiceAccount and RBAC
(g) two alerts you would write for it, and why those two

---

**C2. The upgrade nobody wants to run.**

AxisPay's cluster is two minor versions behind. A CVE affects the API server. You have a four-hour window on a Sunday. Three control-plane nodes, six workers, merchant traffic continues throughout.

Write the plan. Cover:

(a) what you check **before** the window opens, and why each check matters
(b) the ordering, and the rule that determines it
(c) what you do about the two-version gap
(d) how PodDisruptionBudgets affect the worker upgrades, and what you do if a drain hangs
(e) what cannot be rolled back, and what your recovery path is instead
(f) what you would tell the change board about expected customer impact

---

## Section D — The one that matters (10 marks)

**D1.** You are handing this platform to an on-call rotation of four engineers, two of whom have never used Kubernetes.

Name the **three** things you would insist on before the handover, and defend each in two or three sentences. Then name one thing you would deliberately **not** insist on, and explain why demanding it would make the handover worse.

There is no single correct answer. You are marked on the quality of the reasoning and on whether your three choices are consistent with each other.

---

**Total: ____ / 60**

| | |
|---|---|
| Section A — recall | ____ / 10 |
| Section B — reasoning | ____ / 20 |
| Section C — design | ____ / 20 |
| Section D — judgement | ____ / 10 |

**Pass 36 · Merit 45 · Distinction 53**
