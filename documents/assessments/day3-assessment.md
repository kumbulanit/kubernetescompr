# Day 3 — End-of-Day Assessment

**15 minutes · 10 items · closed book except your cheat sheet**

Name: ________________________  Date: ____________

---

## Section A — Multiple choice (6 marks, 1 each)

**A1.** You edit a ConfigMap consumed by a Deployment via `envFrom`. What happens to the pods already running?

- [ ] a) They pick up the new values within about 60 seconds
- [ ] b) Nothing — the values were a snapshot taken at container start
- [ ] c) They restart automatically
- [ ] d) The API server rejects the edit while pods reference it

**A2.** A Kubernetes Secret is:

- [ ] a) Encrypted with the cluster's private key
- [ ] b) base64-encoded — an encoding, not encryption
- [ ] c) Encrypted at rest by default in every cluster
- [ ] d) Stored outside etcd for safety

**A3.** `ReadWriteOnce` means the volume may be mounted read-write by:

- [ ] a) One pod, cluster-wide
- [ ] b) One **node** — several pods on that node can share it
- [ ] c) One container
- [ ] d) One namespace

**A4.** Why use `volumeBindingMode: WaitForFirstConsumer`?

- [ ] a) To provision volumes faster
- [ ] b) So the volume is created on the node the scheduler actually chose
- [ ] c) To allow ReadWriteMany on block storage
- [ ] d) To delay billing until the volume is used

**A5.** Which does a StatefulSet provide that a Deployment does **not**?

- [ ] a) Rolling updates
- [ ] b) Readiness probes
- [ ] c) A stable per-replica name and its own persistent volume
- [ ] d) Horizontal autoscaling

**A6.** A pod runs as UID 10001 and mounts a freshly provisioned volume. Writes fail with `permission denied`. The most likely cause is:

- [ ] a) `readOnlyRootFilesystem: true`
- [ ] b) The PVC is still Pending
- [ ] c) `fsGroup` is not set, so the volume is still owned by root
- [ ] d) `capabilities.drop: ["ALL"]`

---

## Section B — Short answer (3 marks, 1 each)

**B1.** In one or two sentences: what actually protects a Kubernetes Secret? Name at least two controls.

**B2.** A PVC has been `Pending` for five minutes. Describe how you would decide whether this is normal or broken, and name the exact command you would run.

**B3.** You scale a PostgreSQL StatefulSet from 1 to 3 replicas. Describe what you now have, and what would be required to make it an actual database cluster.

---

## Section C — Practical (1 mark)

**C1.** `ledger-service` is `Running` but shows `0/1` and its readiness probe returns 503. The logs say `database unreachable: getaddrinfo failed`. `postgres-0` is healthy and other services can reach it.

(a) State your single most likely hypothesis. *(½ mark)*

(b) Give the **one command** that would confirm it, and say what you would compare in its output. *(½ mark)*

---

**Total: ____ / 10**  ·  Pass mark 6/10
