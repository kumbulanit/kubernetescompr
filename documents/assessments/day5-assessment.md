# Day 5 — End-of-Day Assessment

**15 minutes · 10 items · closed book except your cheat sheet**

Name: ________________________  Date: ____________

---

## Section A — Multiple choice (6 marks, 1 each)

**A1.** A pod uses the `default` ServiceAccount. RBAC grants `default` nothing. Using the mounted token against the API server returns **403**. What does that tell you?

- [ ] a) The token is invalid, so there is no risk
- [ ] b) The token authenticated successfully and was then denied by authorisation
- [ ] c) The API server rejected the request before reading the token
- [ ] d) The token has expired

**A2.** You change a namespace label from `pod-security.kubernetes.io/enforce: baseline` to `restricted`. Three non-compliant pods are running in it. What happens?

- [ ] a) All three are evicted immediately
- [ ] b) All three are restarted with corrected security contexts
- [ ] c) Nothing changes now; the next create or update of those pods is rejected
- [ ] d) The label change is rejected because pods would become non-compliant

**A3.** Which combination is **invalid** in Kubernetes RBAC?

- [ ] a) ClusterRole referenced by a RoleBinding
- [ ] b) ClusterRole referenced by a ClusterRoleBinding
- [ ] c) Role referenced by a RoleBinding
- [ ] d) Role referenced by a ClusterRoleBinding

**A4.** A chart puts `app.kubernetes.io/version` inside a Deployment's `.spec.selector`. When does this first fail?

- [ ] a) At `helm install`
- [ ] b) At `helm lint`
- [ ] c) At the first `helm upgrade` that changes the app version
- [ ] d) It never fails; it is merely untidy

**A5.** A Prometheus target does not appear at all in Status → Targets — it is not listed as down, it is absent. The most likely cause is:

- [ ] a) The pod is failing its readiness probe
- [ ] b) A NetworkPolicy is blocking the scrape
- [ ] c) The ServiceMonitor is missing the label Prometheus selects on
- [ ] d) The scrape timeout is too short

**A6.** Which of these is the strongest reason **not** to make `correlation_id` a Loki label?

- [ ] a) Labels must be lowercase
- [ ] b) It creates one stream per request, and stream count is Loki's scaling constraint
- [ ] c) Loki cannot index UUID values
- [ ] d) It would make the query syntax more verbose

---

## Section B — Short answer (3 marks, 1 each)

**B1.** An access review confirms that nobody has `get` or `list` on `secrets` in `axispay-edge`. Name **two** other RBAC grants that would still allow someone to read the JWT signing key, and say briefly how each works.

**B2.** Your chart manages `payment-service`, which is also managed by a HorizontalPodAutoscaler. Explain why the chart deliberately omits `.spec.replicas` for that Deployment, and what would go wrong if it did not.

**B3.** Every pod is Ready, no error rate is elevated, latency is excellent, and no alert has fired — but no payments have been taken for twenty minutes. Write the PromQL that would have caught this, and explain in one sentence why no other alert did.

---

## Section C — Practical (1 mark)

**C1.** An auditor will be given read access to `axispay-core` for six weeks and must never be able to read a Secret.

(a) State the mechanism by which you prevent Secret access, given that RBAC has no deny rule. *(½ mark)*

(b) Give the **one command** that produces the evidence for the access review, and state what output constitutes proof. *(½ mark)*

---

**Total: ____ / 10**  ·  Pass mark 6/10
