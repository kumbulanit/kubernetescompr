# Final Examination — Answer Key

*Instructor copy. Marks in brackets. Model answers are longer than a student's need to be.*

---

## Section A — Short recall (10 marks)

**A1** *(1)* — The container is up but failing its readiness probe, so it has been removed from the Service's endpoints and receives no traffic. It is alive and refusing work on purpose.

**A2** *(1)* — Liveness: failure **restarts the container**. Readiness: failure **removes the pod from Service endpoints**. Startup: failure **restarts the container, and while it runs it suspends the liveness probe**.
> Half a mark if named but not by consequence. The consequence is the whole point.

**A3** *(1)* — The volume can be mounted read-write by **one node**. Multiple pods on that same node may share it. It is not "one pod".

**A4** *(1)* — Default-allow until a policy selects the pod; policies are purely additive with no deny rule; ingress and egress are evaluated independently and **both** ends must permit the flow.

**A5** *(1)* — Exit code **137**. The **kernel** killed it (OOM killer), not the container and not Kubernetes.

**A6** *(1)* — **Down** means Prometheus tried to scrape and failed — network, port, path or readiness. **Missing** means Prometheus never knew about the target: the ServiceMonitor was not selected, almost always a missing `release` label.

**A7** *(1)* — You cannot. RBAC has no deny rule. You remove or narrow the binding that grants it; a permission is absent, never revoked.

**A8** *(1)* — A gzipped, base64-encoded copy of the **rendered manifests** for that revision, one Secret per revision.

**A9** *(1)* — The **kubelet**. It may lag by up to three minor versions but must never lead the API server, which is why the control plane is always upgraded first.

**A10** *(1)* — The kubelet captures stdout; `kubectl logs` reads it and collectors ship it. A file inside the container is unreachable from outside and is destroyed when the pod restarts.

---

## Section B — Reasoning (20 marks)

### B1 — The probe that made it worse *(4)*

*(1)* PostgreSQL slows. `payment-service`'s liveness endpoint, which checks the database, exceeds its timeout.

*(1)* After `failureThreshold` consecutive failures the kubelet **restarts** the container. Every replica is affected simultaneously, because they all depend on the same database.

*(1)* Restarting does not help — the database is the problem — so each new container fails the probe again. The workload enters CrashLoopBackOff. Now capacity is *zero* rather than degraded, and every request fails rather than merely being slow. Worse still, restarting drops in-flight requests and, on restart, each pod re-establishes its connection pool, adding load to the database that is already struggling.

*(1)* **Correct design:** liveness points at `/healthz`, which returns 200 unconditionally as long as the process can serve HTTP. Dependency checks belong in **readiness** (`/readyz`), because the correct response to a broken dependency is to stop receiving traffic, not to restart. And for a *non-critical* dependency such as a cache, readiness should stay green and the service should degrade.

> Full marks require the CrashLoopBackOff *and* the observation that the outcome is worse than no probe. Excellent answers mention the connection-pool thundering herd.

---

### B2 — The audit that passed *(4)*

*(1 each, any two)*

- **`create` on `pods/exec`** — exec into `auth-service` and read the environment: `kubectl exec -n axispay-edge deploy/auth-service -- printenv JWT_SIGNING_KEY`. No `secrets` grant is involved.
- **`create` on `pods`** — create a pod that mounts the Secret, and read it from your own pod.
- **`create` on `pods/portforward`** — forward to a service that exposes it.
- **`escalate` or `bind` on roles** — grant yourself `get secrets`.
- **`impersonate`** — become a subject who already has it.

*(2)* The review examined a **resource** when it should have examined the **paths** to that resource. The correct question is not "who can get secrets" but "who can reach the value of this Secret, by any route" — which includes exec, portforward, pod creation, and the ability to change RBAC. A useful reformulation: treat every grant that yields code execution in a namespace as equivalent to reading every Secret consumed in that namespace.

---

### B3 — The release that worked until it did not *(4)*

*(1)* The chart puts a volatile label — `app.kubernetes.io/version` or `helm.sh/chart` — inside the Deployment's `.spec.selector`.

*(1)* `.spec.selector` is **immutable after creation**. For four months the rendered selector never changed: patch releases did not alter the app version, so the patch was a no-op on that field and the upgrade succeeded. The first minor version bump changes the label value, Helm attempts to patch an immutable field, and the API server rejects it.

*(1)* **Recovery:** delete the Deployment and let Helm recreate it. That means an outage, in production, during an already-failed release. `helm rollback` does not help, because the rendered selector in the previous release is the *old* value and the live object still has it — the object is fine; the *new* render is what cannot be applied.

*(1)* **Guard:** keep `.spec.selector` to identity labels only — `app.kubernetes.io/name` and `app.kubernetes.io/instance` — and assert it in CI. `platform/admin/validate/check-helm-chart.py` fails the build if any selector contains a chart or version label.

> Award the third mark only if the student recognises that rollback does not fix it. Many will assume it does.

---

### B4 — Everything is green *(4)*

*(2)* No alert fired because **nothing infrastructural is wrong**:

- The endpoints alert is quiet: every pod is Ready.
- The error-**ratio** alert is quiet: the ratio's numerator and denominator are both zero, so it does not exceed the threshold (and may not evaluate at all).
- The latency alert is quiet: there are no observations, so the quantile is empty. There is no traffic to be slow.
- The crash-loop and OOM alerts are quiet: nothing has restarted.

Every alert in the platform is conditioned on requests existing.

*(1)* **The alert:**
```promql
sum(rate(axispay_payments_total[10m])) == 0
```
with `for: 10m`. Alerting on the *absence* of traffic is the only signal available.

*(1)* **Two causes consistent with the evidence** — any two of: a DNS record still pointing at a decommissioned load balancer; an expired TLS certificate on the ingress (in-cluster health is unaffected); merchant API keys expired or rotated; a CDN or WAF rule dropping POSTs; the ingress controller's own Service losing its endpoints.

> The mark is for causes that are genuinely **upstream of the cluster**. "payment-service is down" contradicts the evidence and scores nothing.

---

### B5 — The fastest fix *(4)*

*(1)* **No.** Deleting the policy removes the segmentation between the cardholder data environment and everything else. The change record CR-2026-0819 narrowed it; deleting it does not restore the previous state — it removes the control entirely, which is a larger change than the one that caused the incident.

*(1)* **The defence to a change board:** the constraint is contractual, the deletion would appear in the audit trail as a removal of a PCI control during an incident, and "we were in a hurry" is not a defensible justification at an assessment. Restoring the *correct* policy takes only marginally longer and leaves the control intact.

*(1)* **The actual fix:** re-apply the original policy from version control —
```bash
kubectl apply -f manifests/day4/netpol/05-data-tier.yaml
```
which admits `axispay-core` **and** `axispay-async` to the data tier on 5432/6379/5672 and nothing else.

*(1)* **Verification and follow-up:** confirm settlement writes resume and the queue drains; re-run `simulate-netpol.py`; and raise the real defect, which is that a policy change was approved and applied without a test that would have caught it. The preventive action is a policy test in CI, not a rule about being more careful.

> Full marks require naming the difference between *restoring* the correct policy and *deleting* it. A student who says "delete it now, restore it later" scores 1 — that is exactly the reasoning the exercise is testing.

---

## Section C — Design (20 marks)

### C1 — `dispute-service` *(10)*

*(1)* **(a) Kind and namespace.** A Deployment — it is a long-running request handler with interchangeable replicas — in `axispay-core`, because it reads and writes the payments and ledger tables and therefore sits inside the cardholder data environment. Accept `axispay-async` **only** if the student argues it is event-driven and does not serve the merchant path; the data access makes `core` the better answer.

*(2)* **(b) Resources.** Requests sized for the *steady* state, not the spike: roughly `cpu: 50m, memory: 96Mi`. Limits at about `cpu: 400m, memory: 256Mi` to absorb the hourly spike. Reasoning that must be present: the **request** is what the scheduler reserves and what the HPA divides by, so sizing it for the spike wastes capacity permanently; the **limit** is where the kernel throttles, so it must have headroom for the spike. Memory limit close to the real working set, because memory has no throttle — crossing it is an instant kill.

*(2)* **(c) Probes.** Startup on `/startupz` with a generous `failureThreshold`, so a slow first connection does not cause a restart loop. Liveness on `/healthz`, returning 200 whenever the process can serve HTTP and checking **no** dependency. Readiness on `/readyz`, checking PostgreSQL (critical — cannot serve without it) and RabbitMQ. Full marks require the liveness/readiness distinction to be justified, not just stated.

*(1)* **(d) HPA.** Yes — 5 rps to 60 rps is a twelvefold spike and exactly what autoscaling is for. On CPU utilisation against the request, `minReplicas: 2` (so a single node loss is survivable), `maxReplicas` sized so that max × request fits the cluster. A good answer notes that the spike is hourly and predictable, so a short `scaleUp` stabilisation window and a long `scaleDown` one prevents flapping.

*(2)* **(e) NetworkPolicy.** Ingress: from `edge-gateway` in `axispay-edge` on 8080 only — accept that acquirer callbacks arrive through the existing gateway rather than exposing a second entry point. Egress: DNS to `kube-system` on 53 (**both** UDP and TCP); to `axispay-data` on 5432 and 5672; to `payment-service` and `ledger-service` in `axispay-core` on 8080. Plus ingress from `axispay-observability` on 8080 for scraping. Deduct if DNS is missing — that is the mistake the whole of Day 4 was built around.

*(1)* **(f) Identity.** Its own ServiceAccount with `automountServiceAccountToken: false`, and **no RBAC at all**: it never calls the Kubernetes API. A student who grants it a Role has missed the point of L5.1.

*(1)* **(g) Two alerts.** Symptoms a person outside the platform team would notice. Good pairs: a 5xx ratio breaching the error budget; disputes-opened rate falling to zero (the silence alert for this service); RabbitMQ publish failures; p99 latency above the SLO. Deduct for "CPU is high" — that is a cause, not a symptom.

---

### C2 — The upgrade *(10)*

*(2)* **(a) Before the window.** Read the release notes for **both** minor versions you will pass through — removed APIs are the usual cause of failure. Check `apiserver_requested_deprecated_apis` for anything in your own manifests that will break. Take and **copy off the node** an etcd snapshot. Verify every node is `Ready` and has disk headroom. Confirm PodDisruptionBudgets exist and are satisfiable. Rehearse on a non-production cluster **of the same version** with the same workloads.

*(2)* **(b) Ordering.** Control plane first, then the kubelets. The rule is version skew: the kubelet may lag the API server by up to three minor versions but must never lead it. Within the control plane, upgrade the first node with `kubeadm upgrade apply`, then the rest with `kubeadm upgrade node`. Workers last, **one at a time**.

*(1)* **(c) The two-version gap.** Two separate upgrades, one minor version at a time. kubeadm refuses to skip, and forcing the packages produces an unsupported skew. Each step is its own change record and its own validation.

*(2)* **(d) PDBs and a hanging drain.** Each worker is cordoned and drained; the PDB constrains how many pods of a workload may be unavailable, so the drain blocks until replacements are Ready elsewhere. **A slow drain is the PDB doing its job.** Investigate what is not becoming Ready — insufficient capacity on the remaining nodes, anti-affinity that cannot be satisfied with one node gone, a slow startup probe. Never `--force`: that deletes the pod the PDB was protecting.

*(2)* **(e) What cannot be rolled back.** A control-plane upgrade is **forward-only**. There is no downgrade path. The recovery is restore-from-etcd-snapshot, which is why the snapshot is taken first and copied off the node. Say this explicitly at the change board rather than implying a rollback exists.

*(1)* **(f) Customer impact.** With three control-plane nodes behind a load balancer, the API is continuously available and **running workloads are unaffected throughout** — the kubelet keeps containers running without the API server. What pauses during each control-plane step is the control loop: no scheduling, no scaling, no rollouts. Worker drains move pods, which is why the PDBs and the `maxUnavailable: 0` rollout strategy matter. Expected merchant impact: none, provided every workload has at least two replicas and a PDB.

---

## Section D — Judgement (10 marks)

**D1** — There is no single correct answer. Mark the reasoning and the internal consistency of the three choices.

**Strong answers usually insist on some three of:**

| Insistence | Why it is defensible |
|---|---|
| A runbook per alert | An alert without one is a page that begins with twenty minutes of reading — worst for the two engineers who are new. |
| Every alert fires on a symptom a merchant would feel | Cause-based alerts train people to ignore the channel, and a muted channel is worse than no alerting. |
| Two replicas and a PDB on everything on the payment path | It converts a node failure from an incident into a non-event, which is the single highest-leverage thing for a thin rotation. |
| Structured logs with a correlation ID | It is what lets a newcomer answer "which service was slow" without knowing the architecture. |
| `--atomic` on every release | Removes the half-applied state, which is the hardest thing for a newcomer to reason about at 03:00. |
| A read-only role and a separately-authorised break-glass | New engineers can investigate freely without being able to make it worse. |

**Deliberately not insisting on — good answers include:**

- **Full test coverage of the NetworkPolicies before handover.** Defensible: it delays the handover indefinitely, and the policies are already asserted in CI. Perfect is the enemy of on-call.
- **That everyone understands the whole platform first.** You would never hand over. The runbooks and the triage method are what make partial knowledge sufficient — that is their purpose.
- **A service mesh, or mTLS everywhere.** It adds a layer the rotation cannot debug, which makes the platform *less* operable for exactly the people you are handing it to.
- **That the two newcomers complete a certification first.** It measures the wrong thing and delays the rotation.

**Marking bands:**

| Marks | Descriptor |
|---|---|
| 9–10 | Three well-chosen insistences, each defended in terms of the **two inexperienced engineers**; the omission is genuinely tempting and the reason it would hurt is specific |
| 7–8 | Three sound choices, defended generally rather than for this audience; a sensible omission |
| 5–6 | Reasonable choices, thin defence, or an omission that is obviously trivial and therefore costs nothing to omit |
| 3–4 | Generic best practices with no reference to the situation |
| 0–2 | Lists tools rather than reasoning |

> The discriminator is whether the student's answer changes because two of the four are new. A student who would give the same three answers for a team of Kubernetes veterans has not read the question.

---

## Overall marking notes

- **Section A is a floor, not a target.** A student at 10/10 on A and under 8/20 on B has memorised the week. Say so kindly.
- **B4 and B5 are the two questions worth reading most carefully.** They are where the course's actual thesis lives: alert on what a customer feels, and know the difference between the fastest fix and the correct one.
- **Give credit for better answers than this key.** It happens, particularly on C1 and D1, and saying so is worth more to the student than the mark.
- **Where an answer is wrong but the method is right, say which part was right.** That is the behaviour that transfers.
