# Day 5 — Answer Key

*Instructor copy. Covers the end-of-day assessment and the eighteen manual review questions.*

---

## End-of-day assessment

### Section A — Multiple choice (6 marks)

**A1 — (b)** The token authenticated successfully and was then denied by authorisation.

> The distinction is the whole point of the exercise. **401** would mean no valid credential. **403** means the API server accepted the identity and RBAC declined the action. The credential is real and works; only the current RBAC configuration stands between it and the cluster, and RBAC changes.
>
> *If a student picks (a):* ask what happens the day someone grants `default` a permission for convenience. The finding becomes an incident retroactively.

**A2 — (c)** Nothing changes now; the next create or update of those pods is rejected.

> Pod Security Admission is an **admission** controller: it evaluates on create and update, not continuously. This is the single most commonly misunderstood property, and it produces a nasty failure mode — nothing breaks on the day of the change, and a release fails weeks later with no obvious connection.
>
> Full marks also for a student who volunteers the mitigation: set `warn` and `audit` first and let the warnings size the work.

**A3 — (d)** Role referenced by a ClusterRoleBinding.

> A ClusterRoleBinding grants cluster-wide, and a Role's permissions are namespace-scoped; the combination has no coherent meaning and the API rejects it. (a) is not merely valid but the most useful of the four — define the permission set once, bind it where it applies.

**A4 — (c)** At the first `helm upgrade` that changes the app version.

> Install succeeds. Patch releases succeed, because the version label has not changed. The first minor bump fails with `spec.selector: field is immutable`, and the only remedy is deleting the Deployment — in production, during the failed release.
>
> The latency between cause and symptom is what makes this defect expensive, and it is why `check-helm-chart.py` asserts against it.

**A5 — (c)** The ServiceMonitor is missing the label Prometheus selects on.

> **Missing and down are different problems.** Down means Prometheus tried and failed — (a), (b) and (d) all produce *down*. Absent means Prometheus never selected the object, and with `serviceMonitorSelectorNilUsesHelmValues: true` that is almost always the missing `release: kube-prometheus-stack` label.

**A6 — (b)** One stream per request, and stream count is Loki's scaling constraint.

> Loki indexes labels; each unique combination of label values is a stream with its own chunks and index entries. A unique-per-request label at 200 requests per second creates roughly 17 million streams a day. The failure is not a slow query — it is the ingesters running out of memory and the log platform going down during the incident it was bought for.

---

### Section B — Short answer (3 marks)

**B1 — two grants that read a Secret without any `secrets` grant.** *(1 mark; ½ for one correct, full marks need two with a mechanism.)*

Any two of:

| Grant | How it works |
|---|---|
| `create` on `pods/exec` | Exec into a pod that consumes the Secret and read it from the environment or the mounted file: `kubectl exec ... -- printenv JWT_SIGNING_KEY` |
| `create` on `pods` | Create a pod that mounts the Secret and read it from your own pod |
| `create` on `pods/portforward` | Forward to a service that exposes the value |
| `escalate` / `bind` on roles | Grant yourself `get secrets` |
| `impersonate` | Become a subject who already has it |

> The teaching point: an access review that checks a **resource** rather than the **paths** to that resource has audited the wrong thing. Give full marks for any two mechanisms correctly explained; a student who explains only `pods/exec` but explains it precisely earns ½.

**B2 — why the chart omits `replicas` when an HPA owns the workload.** *(1 mark)*

Because the HPA owns `.spec.replicas` at runtime. If the chart also sets it, every `helm upgrade` renders the chart's value and patches the Deployment back to it — undoing the autoscaler's decision. In the worst case that happens during a traffic spike, when the HPA has scaled to twelve and an unrelated config change resets it to three.

> ½ mark for "so Helm and the HPA do not conflict" without the mechanism. Full marks require naming the reset, and a student who mentions that the *timing* is the danger has understood it properly.

**B3 — the alert that fires on silence.** *(1 mark)*

```promql
sum(rate(axispay_payments_total[10m])) == 0
```

for a `for:` duration of around 10 minutes.

No other alert fired because nothing infrastructural is wrong: pods are Ready so the endpoint alert is quiet, there are no requests so there is no error *ratio* to exceed a threshold, and there is no traffic to be slow so latency is perfect. The cause is upstream of the cluster entirely — a DNS record pointing at the old load balancer, an expired merchant API key, a CDN rule swallowing POSTs.

> Accept `absent()` formulations or a business-metric variant. The mark is for the reasoning, not the exact expression: alerting on the **absence** of traffic is the only way to detect this class of failure.

---

### Section C — Practical (1 mark)

**C1(a) — the mechanism.** *(½ mark)*

You do not deny Secrets — RBAC has no deny rule. You write a role that **never names** `secrets` at all. The absence of the grant *is* the control, and `grep -c secrets manifests/day5/rbac/02-roles.yaml` returning `0` is the demonstration that it is absent by design rather than by accident.

**C1(b) — the evidence.** *(½ mark)*

```bash
kubectl auth can-i get secrets -n axispay-core --as=auditor@axis.example
```

Output `no` is the proof. It is credible because `kubectl auth can-i` issues a SubjectAccessReview against the API server — the same authorisation path a real request takes, with the same rules and the same cache. It is not a simulation of the policy; it *is* the policy.

> A student who additionally runs `kubectl get secrets -n axispay-core --as=...` and shows the Forbidden error has done better than asked. A student who only shows the role YAML has not answered the question — the YAML is the implementation, the `can-i` output is the evidence.

---

## Manual review questions (18)

1. **Why is the token still a problem if RBAC grants `default` nothing?** — It is a valid credential that authenticates; only the current RBAC configuration stops it, and that changes. It also reveals the namespace and the API server address to anything that can read it.

2. **401 versus 403.** — 401: no valid credential presented. 403: credential accepted, action denied by authorisation.

3. **`enforce: restricted` on a namespace with running non-compliant pods.** — Nothing immediately; they keep running. The next create or update is rejected, which usually means the next rollout — potentially weeks later, and not obviously connected.

4. **Why a log collector cannot run under `baseline`.** — Baseline forbids hostPath volumes, and reading `/var/log/pods` requires one. This surprises people who assume baseline is a mild setting.

5. **How to revoke a permission.** — You cannot. There is no deny; you remove or narrow the binding that grants it, and `kubectl auth can-i --list` shows the union of everything still granted.

6. **Two ways to read a Secret with no `secrets` grant.** — `create` on `pods/exec`; `create` on `pods`. (Also `pods/portforward`, `escalate`, `impersonate`.)

7. **Why ClusterRole + RoleBinding is the useful combination.** — The ClusterRole defines *what*, the RoleBinding decides *where*. One permission set bound in three namespaces, so the three cannot drift apart.

8. **What a Helm release Secret contains, and what follows.** — A gzipped, base64-encoded copy of the rendered manifests, one Secret per revision. Therefore rollback re-applies a stored copy rather than re-rendering from Git; deleting those Secrets destroys the history; and Helm knows nothing about what happened between commands.

9. **Why `.spec.selector` must contain only stable labels.** — It is immutable after creation. A version or chart label there makes the next version bump fail with `field is immutable`, and the only fix is deleting the Deployment.

10. **Why the chart omits `replicas` for `payment-service`.** — Its HPA owns the field; setting it in the chart means every upgrade resets the autoscaler's decision.

11. **A setting identical in all environments, and why.** — `networkPolicy.enabled`, `podSecurity.enforce`, or `serviceAccount.automountToken`. A policy you only enable in production is a policy you first *test* in production, and NetworkPolicy bugs present as application failures that look like something else.

12. **Why the average latency is wrong for an SLO.** — It is dominated by the fast majority. 99 requests at 10 ms and one at 3 s averages 40 ms, and one merchant in a hundred waited three seconds.

13. **A target missing rather than down.** — Prometheus never selected it. Almost always the ServiceMonitor's `release` label. Down means it tried and failed.

14. **Why a ServiceMonitor selects a Service rather than pods.** — Prometheus discovers the endpoints behind it, so unready pods are not scraped. Readiness gating for free, and a starting pod does not distort the data.

15. **`correlation_id` as a Loki label.** — One stream per request. Stream count is the scaling constraint; the ingesters run out of memory and the log platform fails.

16. **What Alertmanager does that Prometheus does not.** — Grouping, inhibition, throttling and routing. Prometheus decides *whether*; Alertmanager decides *who*, and *how often*.

17. **Detecting "everything green, no payments".** — `sum(rate(axispay_payments_total[10m])) == 0`, with a `for:` clause. Nothing else fires because nothing infrastructural is wrong.

18. **From a payment reference to the cross-service trail.** — Reference → payment record → `correlation_id` → `{namespace=~"axispay-.*"} | json | correlation_id="<id>"`. Seven services, one sorted list, one query.

---

## Marking notes

- **Pass is 6/10.** Section B is where understanding shows; a student who scores 6/6 on A and 0/3 on B has memorised and not understood, and is worth a conversation.
- **B1 is the discriminator for the security module.** A student who names two paths has internalised that RBAC review is about paths, not resources.
- **B3 is the discriminator for the observability module.** It is the one question whose answer cannot be pattern-matched from a cheat sheet.
- Award full marks for a correct mechanism explained in the student's own words, even where the wording differs from this key. Where a student's answer is better than the key, say so.
