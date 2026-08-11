# Day 4 — End-of-Day Assessment

**15 minutes · 10 items · closed book except your cheat sheet**

Name: ________________________  Date: ____________

---

## Section A — Multiple choice (6 marks, 1 each)

**A1.** Which statement about NetworkPolicy is correct?

- [ ] a) Pods are denied by default; policies grant exceptions
- [ ] b) Pods are allowed by default until a policy selects them; policies only add permission
- [ ] c) A policy can contain explicit `deny` rules
- [ ] d) A policy applies to a whole namespace and cannot target individual pods

**A2.** You apply a default-deny policy to `axispay-core`. Every service call fails with a name-resolution error. The cause is:

- [ ] a) CoreDNS crashed
- [ ] b) DNS egress to `kube-system` was blocked by the policy
- [ ] c) The Service selectors no longer match
- [ ] d) `ndots` is misconfigured

**A3.** An Ingress exists, `ADDRESS` is empty, and nothing routes. The most likely cause is:

- [ ] a) The TLS secret is missing
- [ ] b) `pathType` is `Exact`
- [ ] c) No Ingress controller has claimed it
- [ ] d) The backend Service has no endpoints

**A4.** `payment-service` has `requiredDuringSchedulingIgnoredDuringExecution` pod anti-affinity on `kubernetes.io/hostname`, and the cluster has 3 nodes. You scale to 4 replicas. What happens?

- [ ] a) All 4 schedule; two share a node
- [ ] b) The 4th pod stays `Pending` indefinitely
- [ ] c) The scheduler evicts a pod to make room
- [ ] d) The Deployment is rejected at admission

**A5.** Which of these is a PodDisruptionBudget **NOT** consulted for?

- [ ] a) `kubectl drain`
- [ ] b) A node-pool upgrade
- [ ] c) `kubectl delete pod`
- [ ] d) Eviction during a cluster upgrade

**A6.** An Ingress returns **503**. This points at:

- [ ] a) The routing rules did not match the path
- [ ] b) The wrong backend port
- [ ] c) The backend Service has no ready endpoints
- [ ] d) An expired TLS certificate

---

## Section B — Short answer (3 marks, 1 each)

**B1.** In one or two sentences: how do you write a rule that *denies* traffic in NetworkPolicy? Explain your answer.

**B2.** A colleague adds one narrow NetworkPolicy to `fraud-service`, allowing ingress only from `reporting-service`. Within a minute `payment-service` starts failing, even though it is not mentioned in the new policy. Explain exactly why.

**B3.** Why is `maxUnavailable` generally safer than `minAvailable` in a PodDisruptionBudget for a workload behind an HPA?

---

## Section C — Practical (1 mark)

**C1.** A QSA asks you to demonstrate that AxisPay's DMZ cannot reach cardholder data.

(a) Give the **one command** you would run. *(½ mark)*

(b) State what output constitutes proof, and why the failure mode you expect is a **timeout** rather than a connection refusal. *(½ mark)*

---

**Total: ____ / 10**  ·  Pass mark 6/10
