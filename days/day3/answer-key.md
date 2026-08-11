# Day 3 — Answer Key (Instructor)

---

## Section A (6 marks)

**A1 — (b) Nothing. The values were a snapshot.**

| Distractor | Why wrong |
|---|---|
| (a) | That is **volume** behaviour, not env. Mixing them up is the most common Day 3 confusion. |
| (c) | Kubernetes never restarts pods on a ConfigMap change. The checksum annotation is what makes that happen, and you have to add it. |
| (d) | ConfigMaps can be edited freely at any time. |

> Students proved this in L3.1 step 5 — patched the ConfigMap, waited twenty seconds, and the env var was unchanged with no error.

**A2 — (b) base64-encoded — an encoding, not encryption.**

| Distractor | Why wrong |
|---|---|
| (a) | There is no key and no algorithm involved at all |
| (c) | Encryption at rest is **opt-in** and must be configured on the API server. Many clusters do not have it. |
| (d) | Secrets are stored in etcd like everything else |

> **This is the most important question on the paper.** A student who answers (a) or (c) will build a platform they believe is secure and is not. They decoded a Secret themselves in L3.2 step 3.

**A3 — (b) One node.**

> Several pods scheduled onto the **same** node can share an RWO volume. `ReadWriteOncePod` is the mode that genuinely means one pod — and it exists *because* RWO was so widely misread. Accept an answer that also mentions this.

**A4 — (b) So the volume is created on the node the scheduler actually chose.**

> With `Immediate` the provisioner picks a node before the pod exists; the scheduler later picks a different one; the pod is unschedulable forever with `volume node affinity conflict`. (a) is wrong — it is *slower* to first start, deliberately.

**A5 — (c) A stable per-replica name and its own persistent volume.**

> (a), (b) and (d) all work with Deployments. The distinguishing three are stable identity, stable storage and ordered start/stop.

**A6 — (c) `fsGroup` not set.**

> A freshly provisioned volume is owned by root. A process running as 10001 cannot write to it. `fsGroup` makes the kubelet chown the volume before the container starts.
> (a) would give `Read-only file system`, not `permission denied` — different message, different cause. (b) would leave the pod `Pending`, not running. Worth calling out: the *wording* of the error distinguishes these.

---

## Section B (3 marks)

**B1** *(1 mark — needs at least two)*

> **RBAC** — who may `get` Secrets in a namespace. That is the real boundary.
> **etcd encryption at rest** — without it, a backup is a plaintext credential dump.
> Also acceptable: mounting as a volume rather than an env var; not mounting what you do not need; an external secret manager with short-lived credentials.

| Mark | Criteria |
|---|---|
| 1 | Two or more real controls, RBAC among them |
| 0.5 | One control, or vague ("permissions") |
| 0 | "It is encrypted" |

**B2** *(1 mark)*

> Read the **event**, not the status: `kubectl describe pvc <name> -n <ns>`.
> - `waiting for first consumer to be created before binding` → **normal** with `WaitForFirstConsumer`. Create a pod.
> - `storageclass "x" not found` or `no persistent volumes available` → **broken**.
>
> The status is identical in both cases. The event is everything.

| Mark | Criteria |
|---|---|
| 1 | Names `describe pvc`, and distinguishes the two event messages |
| 0.5 | Names the command but cannot say what to look for |
| 0 | Suggests deleting and recreating the PVC |

**B3** *(1 mark)*

> Three **independent, empty** databases that share a name prefix — `postgres-0`, `-1`, `-2` — each with its own PVC and no relationship between them. Kubernetes provides identity, storage and ordering; it knows nothing about replication, leader election or WAL shipping.
> A real cluster needs an **Operator** (CloudNativePG, Zalando, Crunchy) that configures streaming replication, handles failover and manages backups.

| Mark | Criteria |
|---|---|
| 1 | "Independent empty databases" **and** names an Operator or equivalent |
| 0.5 | Identifies they are not a cluster but cannot say what is needed |
| 0 | "You now have a 3-node PostgreSQL cluster" |

---

## Section C (1 mark)

**C1 (a)** *(½ mark)* — A configuration problem: `ledger-service` is looking up a hostname that is wrong or absent — most likely a ConfigMap key it reads is missing or has been renamed, so it fell back to a default that does not resolve.

> Accept any answer identifying *config* as the cause. **Do not accept** "postgres is down" — the question states other services reach it fine.

**C1 (b)** *(½ mark)* — `kubectl exec -n axispay-core <pod> -- printenv | sort`, comparing the variable names the application expects (`POSTGRES_HOST`) against what is actually present (`POSTGRES_HOSTNAME`).

> Also accept `kubectl get configmap axispay-platform-config -o yaml` compared against the application's expected keys.
> **This is INC-3b.** Students who sat that incident should find it quickly; those who let a neighbour do the work will not.

---

## Marking summary

| | |
|---|---|
| **Pass** | 6/10 |
| **Strong** | 8+/10 |
| **At risk** | < 6/10 — private conversation Thursday 09:00 |

### Gap remediation

| Missed | Send them to |
|---|---|
| A1 | Manual §3.1 (point 4) · Slide 6 · **Lab L3.1 step 5** |
| A2 | Manual §3.2 (point 4) · Slide 10 · **Lab L3.2 step 3** |
| A3 | Manual §3.3 (point 4) · Slide 13 |
| A4 | Manual §3.3 (point 5) · Slide 14 · Lab L3.4 step 4 |
| A5 | Manual §3.4 (point 4) · Slide 17 · Lab L3.6 step 1 |
| A6 | Manual §3.5 (point 4) · Slide 21 · Lab L3.7 task 4 |
| B1 | Manual §3.2 (points 4, 11) · Slide 10 |
| B2 | Manual §3.3 (point 16) · Slide 14 · INC-3 §6 |
| B3 | Manual §3.4 (point 13) · Slide 17 · Lab L3.6 C1 |
| C1 | Manual §3.1 (point 16) · INC-3 §6 |

### Cohort signals

| If | Then |
|---|---|
| **Anyone** answers A2 as "encrypted" | Correct it publicly, gently, immediately. This misconception causes real breaches. |
| > ⅓ miss A1 | Re-demo the env-vs-volume difference before Day 4 |
| > ⅓ miss A6 | Recap `fsGroup` — it recurs whenever a volume is added |
| > ⅓ miss B3 | Address before Day 5; students otherwise believe StatefulSets give HA |
