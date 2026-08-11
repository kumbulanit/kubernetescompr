# Day 1 — End-of-Day Assessment

**15 minutes · 10 items · closed book except your cheat sheet · 40% of your final mark (across five days)**

Name: ________________________  Date: ____________

---

## Section A — Multiple choice (6 marks, 1 each)

**A1.** Which statement best describes the relationship between `spec` and `status`?

- [ ] a) `spec` is written by a controller; `status` is written by you
- [ ] b) `spec` is what you want; `status` is what is, and a controller closes the gap
- [ ] c) They are two views of the same data
- [ ] d) `status` is only populated when something goes wrong

**A2.** A Deployment with 3 replicas creates Pods. What is listed in a Pod's `ownerReferences`?

- [ ] a) The Deployment
- [ ] b) The ReplicaSet
- [ ] c) The Node
- [ ] d) Nothing — Pods have no owner

**A3.** `kubectl get svc` shows `payment-service` with ClusterIP `10.96.14.22`. Requests to it fail. What do you check first?

- [ ] a) `kubectl logs` on the Service
- [ ] b) The Service's `type` field
- [ ] c) The EndpointSlice for that Service
- [ ] d) Whether CoreDNS is running

**A4.** Which of these is **NOT** namespaced?

- [ ] a) `Deployment`
- [ ] b) `Secret`
- [ ] c) `PersistentVolume`
- [ ] d) `Role`

**A5.** A pod shows `ImagePullBackOff` with `RESTARTS: 0`. Will `kubectl logs <pod>` help?

- [ ] a) Yes — it shows why the pull failed
- [ ] b) Yes, but only with `--previous`
- [ ] c) No — no container was ever created, so there are no logs
- [ ] d) Only if the image has a `HEALTHCHECK`

**A6.** Which component assigns a Pod to a node?

- [ ] a) kubelet
- [ ] b) kube-scheduler
- [ ] c) kube-controller-manager
- [ ] d) kube-proxy

---

## Section B — Short answer (3 marks, 1 each)

**B1.** In one or two sentences: why is `spec.selector` on a Deployment immutable, and what is the practical consequence of choosing it badly?

**B2.** Do namespaces isolate network traffic between pods? Justify your answer in one sentence, and name the object that *does* provide that isolation.

**B3.** A pod is `Running` but shows `0/1` in the READY column. What does this mean, and what is your first diagnostic command?

---

## Section C — Practical (1 mark)

**C1.** You are told `payment-service` is "down". Write the **first three commands** you would run, in order, and state in one line what each is for.

```
1. ____________________________________________   →  ______________________________

2. ____________________________________________   →  ______________________________

3. ____________________________________________   →  ______________________________
```

---

**Total: ____ / 10**  ·  Pass mark 6/10
