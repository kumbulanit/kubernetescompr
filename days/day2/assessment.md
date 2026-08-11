# Day 2 — End-of-Day Assessment

**15 minutes · 10 items · closed book except your cheat sheet**

Name: ________________________  Date: ____________

---

## Section A — Multiple choice (6 marks, 1 each)

**A1.** Which does the Kubernetes **scheduler** use when deciding where to place a pod?

- [ ] a) `limits` only
- [ ] b) `requests` only
- [ ] c) Actual current usage from metrics-server
- [ ] d) Both requests and limits, averaged

**A2.** A container exceeds its **CPU** limit. What happens?

- [ ] a) It is OOMKilled with exit code 137
- [ ] b) It is throttled — slowed down, with no error, event or log line
- [ ] c) It is evicted from the node
- [ ] d) The limit is automatically raised

**A3.** A **liveness** probe fails three times in a row. What does the kubelet do?

- [ ] a) Removes the pod from Service endpoints
- [ ] b) Restarts the container
- [ ] c) Marks the pod `Pending`
- [ ] d) Nothing — liveness is advisory

**A4.** An HPA shows `TARGETS: <unknown>/70%` and never scales. The most likely cause is:

- [ ] a) `maxReplicas` is too low
- [ ] b) The target Deployment has no CPU **request**
- [ ] c) The stabilisation window has not elapsed
- [ ] d) The HPA needs a `behavior` block

**A5.** You need one pod running on **every** node, including nodes added next month. Which controller?

- [ ] a) Deployment with `replicas` equal to the node count
- [ ] b) StatefulSet
- [ ] c) DaemonSet
- [ ] d) Job with `parallelism` equal to the node count

**A6.** Which pair together make a rolling update genuinely zero-downtime?

- [ ] a) `maxSurge: 1` and `progressDeadlineSeconds`
- [ ] b) A readiness probe and `maxUnavailable: 0`
- [ ] c) A liveness probe and `terminationGracePeriodSeconds`
- [ ] d) `revisionHistoryLimit` and `rollout undo`

---

## Section B — Short answer (3 marks, 1 each)

**B1.** In one or two sentences: why must a liveness probe never check a downstream dependency? Describe the specific failure it causes.

**B2.** A `ResourceQuota` is applied to a namespace that has **no** `LimitRange`. A developer applies a Deployment with no `resources` block. What happens, and why?

**B3.** A pod is deleted. List the termination sequence in order, and explain in one sentence why the `preStop` pause exists.

---

## Section C — Practical (1 mark)

**C1.** A merchant reports intermittent payment failures. You find:

```
NAME                              READY   STATUS             RESTARTS        AGE
payment-service-7d9c4b8f6-2xk9p   0/1     CrashLoopBackOff   6 (48s ago)     14m
payment-service-7d9c4b8f6-8vm3q   1/1     Running            4 (2m12s ago)   14m
payment-service-7d9c4b8f6-p7n2w   0/1     CrashLoopBackOff   6 (31s ago)     14m
```

(a) Why is the failure **intermittent** rather than total? *(½ mark)*

(b) Name the **one command** that will tell you the root cause, and the specific field you would read in its output. *(½ mark)*

---

**Total: ____ / 10**  ·  Pass mark 6/10
