# Day 2 — Answer Key (Instructor)

---

## Section A (6 marks)

**A1 — (b) `requests` only.**

| Distractor | Why wrong |
|---|---|
| (a) | Limits are enforced by the kernel at runtime and are invisible to the scheduler |
| (c) | The scheduler works from **reservations**, not measurements. A 5%-busy node that is 95% reserved will refuse a pod — this surprises people. |
| (d) | They are inputs to two different systems that never interact |

**A2 — (b) Throttled, with no error, event or log line.**

> The asymmetry: CPU is **compressible** (you can have less of it and simply run slower), memory is **incompressible** (the bytes are there or they are not). Students who pick (a) have merged the two failure modes — and they will misdiagnose INC-2 and the Friday capstone.
> The only signals are latency and `nr_throttled` in `/sys/fs/cgroup/cpu.stat`.

**A3 — (b) Restarts the container.**

> (a) is the **readiness** consequence. Confusing these two is the single most consequential probe error, and it produces the cascading failure in B1.
> Note: the pod object, its IP and its node do not change — only `restartCount` increments.

**A4 — (b) No CPU request on the target.**

> Utilisation is a percentage **of the request**. No request, no denominator, `<unknown>`, and the HPA does nothing — with no error and no event.
> (c) is plausible but stabilisation delays scaling, it does not produce `<unknown>`.
> Accept "or metrics-server is down" as an equally correct answer — both produce `<unknown>` and both are worth checking.

**A5 — (c) DaemonSet.**

> (a) is the tempting wrong answer. `replicas: 3` gives you three pods *somewhere* — possibly two on one node and none on another. Nothing guarantees coverage, and it does not follow the node inventory when a node is added. A DaemonSet has no `replicas` field precisely because you never choose the count.

**A6 — (b) A readiness probe and `maxUnavailable: 0`.**

> Both are required and neither is sufficient. `maxUnavailable: 0` says "do not remove an old pod until a new one is available"; the readiness probe is what makes "available" mean "can actually serve a payment" rather than "the process started".
> Students measured both halves of this in L2.6 steps 5 and 6.

---

## Section B (3 marks)

**B1** *(1 mark — needs the mechanism AND the failure)*

> Liveness failure **restarts** the container. If liveness checks a dependency, then a brief dependency outage fails liveness on **every replica simultaneously**, restarting the entire service. Restarting does not fix the dependency — it discards warm processes and connection pools, and the thundering herd of restarts extends the outage well beyond the original fault.

| Mark | Criteria |
|---|---|
| 1 | Identifies restart as the consequence **and** that it hits all replicas at once |
| 0.5 | Says "it restarts" without the correlated-failure point |
| 0 | Confuses it with readiness |

*Bonus credit:* mentions it reaches `CrashLoopBackOff` and exponential back-off keeps the platform down after the dependency recovers.

**B2** *(1 mark)*

> The Deployment is **rejected**. A quota on `requests.cpu` makes any pod without a CPU request unschedulable — Kubernetes cannot count what was never declared. The `LimitRange`'s `defaultRequest` is what supplies the missing value, so a quota without a LimitRange breaks every manifest that omitted resources.

| Mark | Criteria |
|---|---|
| 1 | Rejection **and** the reason (the quota cannot count an undeclared value) |
| 0.5 | Says rejected but cannot explain why |
| 0 | Says it is admitted with defaults |

*Bonus credit:* notes the rejection appears on the **ReplicaSet** as `FailedCreate`, not on the Deployment.

**B3** *(1 mark)*

> 1. Pod marked `Terminating`; endpoint controller removes it from the EndpointSlice (in parallel).
> 2. `preStop` hook runs.
> 3. **SIGTERM** to PID 1.
> 4. Up to `terminationGracePeriodSeconds` to exit cleanly.
> 5. **SIGKILL**.
>
> `preStop` exists because endpoint removal is **eventually consistent** — it must propagate to every node's kube-proxy. Without the pause, the process can stop accepting connections while some nodes are still routing to it, severing in-flight payments.

| Mark | Criteria |
|---|---|
| 1 | Correct order **and** the propagation reason for `preStop` |
| 0.5 | Correct order, weak or missing reason |
| 0 | Order wrong, or claims endpoint removal is instant |

---

## Section C (1 mark)

**C1 (a)** *(½ mark)* — One replica (`8vm3q`) is `1/1 Running`, so the Service still has one healthy endpoint. Roughly a third of requests reach it and succeed; the rest fail.

**C1 (b)** *(½ mark)* — `kubectl describe pod <pod>`, reading the **`Last State`** block: `Reason: OOMKilled`, `Exit Code: 137`.

> Accept `kubectl get pod -o yaml` reading `status.containerStatuses[].lastState.terminated.reason`.
> **Do NOT accept `kubectl logs` alone.** An OOMKill is SIGKILL — it cannot be caught, so the application logs nothing. A clean startup followed by silence is itself the clue, and students who answer "check the logs" have missed the most important discriminator of the day.

---

## Marking summary

| | |
|---|---|
| **Pass** | 6/10 |
| **Strong** | 8+/10 |
| **At risk** | < 6/10 — private conversation Wednesday 09:00 |

### Gap remediation — give the reference, never "study more"

| Missed | Send them to |
|---|---|
| A1 | Manual §2.1 (points 4–5) · Slide 6 · Lab L2.1 step 2 |
| A2 | Manual §2.1 (points 4, 12) · Slide 7 · Lab L2.1 step 5 |
| A3 | Manual §2.3 (point 4) · Slide 12 · Lab L2.3 step 4 |
| A4 | Manual §2.4 (points 4, 10) · Slide 18 · Lab L2.4 step 2 |
| A5 | Manual §2.5 (points 4–5) · Slide 22 · Lab L2.5 task 1 |
| A6 | Manual §2.6 (points 4, 9) · Slide 28 · Lab L2.6 steps 5–6 |
| B1 | Manual §2.3 (points 9–10) · Slide 13 · **Lab L2.3 step 6** |
| B2 | Manual §2.2 (point 5) · Lab L2.2 step 3 |
| B3 | Manual §2.6 (point 6) · Slide 29 · Lab L2.6 step 8 |
| C1 | Manual §2.1 (point 16) · INC-2 §6 |

### Cohort signals

| If | Then |
|---|---|
| > ⅓ miss A3 or B1 | **Re-teach before Day 3.** StatefulSet readiness depends entirely on this distinction. |
| > ⅓ miss A2 or C1 | Recap throttling vs OOMKill — it is a capstone diagnosis on Friday |
| > ⅓ miss A4 | Five minutes tomorrow; the HPA denominator recurs when Redis is added |
| > ⅓ miss A6 | Re-show the L2.6 before/after numbers. It is the strongest evidence on the course. |
