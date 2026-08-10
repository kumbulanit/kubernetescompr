# Concept Dependency Map

**Rule enforced by this document:** no concept is taught, and no lab is run, before every one of its prerequisites has been taught. This is a directed acyclic graph. It was built by listing prerequisites *first* and deriving the teaching order *from* them — not by writing an agenda and rationalising it afterwards.

Three violations were found during construction and are resolved explicitly in §7. They are documented rather than hidden, because an instructor needs to know where the seams are.

---

## 1. How to read this

```
Concept A
    ↓  (A must be understood before B is meaningful)
Concept B
```

Each node carries its teaching location: **`D<day> M<module>`**.

- **Hard edge** (solid, `-->`) — B is *incomprehensible* without A. Never reorder.
- **Soft edge** (dashed, `-.->`) — B is *harder* without A, but teachable. Reorder only with a written justification.

---

## 2. The spine — Layer 0 to Layer 4

Everything in the course hangs off this. If a student loses the thread here, nothing later lands.

```mermaid
graph TD
    L0A["Linux shell, processes, ports<br/><i>prerequisite</i>"]
    L0B["Containers: image vs container<br/><i>prerequisite</i>"]
    L0C["YAML: maps, lists, types<br/><i>prerequisite</i>"]
    L0D["HTTP, JSON, status codes<br/><i>prerequisite</i>"]

    L1["<b>Why orchestration exists</b><br/>D1 M1.2"]
    L2["<b>Declarative model:<br/>desired vs actual state</b><br/>D1 M1.3"]
    L3["<b>The reconciliation loop</b><br/>D1 M1.3"]
    L4["<b>Cluster architecture</b><br/>apiserver · etcd · scheduler<br/>controller-manager · kubelet · kube-proxy<br/>D1 M1.4"]
    L5["<b>Interface layer</b><br/>CRI · CNI · CSI<br/>D1 M1.4"]
    L6["<b>API objects & the resource model</b><br/>apiVersion · kind · metadata · spec · status<br/>D1 M1.4"]
    L7["<b>Labels & selectors</b><br/>D1 M1.4"]
    L8["<b>kubectl: apply, get, describe, logs, exec</b><br/>D1 M1.4"]

    L0A --> L1
    L0B --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    L4 --> L6
    L0C --> L6
    L6 --> L7
    L6 --> L8
    L0D -.-> L8

    style L2 fill:#1f2b3b,stroke:#42a5f5,color:#fff
    style L3 fill:#1f2b3b,stroke:#42a5f5,color:#fff
    style L7 fill:#3b2f1f,stroke:#ffa726,color:#fff
```

> **Why the reconciliation loop is the root of the tree.** Every controller in Kubernetes — ReplicaSet, Deployment, StatefulSet, DaemonSet, Job, HPA, the Ingress controller, cert-manager, an Operator — is the same loop with a different `spec`. Teach it once, properly, on Monday morning, and every subsequent object is a variation the student can predict rather than memorise. Teach it late and the whole week is rote learning.
>
> **Why labels and selectors sit this high.** Labels are the *only* mechanism by which Kubernetes objects find each other. Services find Pods by label. Deployments own ReplicaSets by label. NetworkPolicies select workloads by label. Anti-affinity groups by label. Prometheus discovers targets by label. A student weak on labels will fail on Day 1, Day 2, Day 4 and Day 5 — and will not know why. This is the highest-leverage twenty minutes in the course.

---

## 3. Workload layer — Layers 5 to 9

```mermaid
graph TD
    L7["Labels & selectors<br/>D1 M1.4"]
    N1["<b>Namespaces</b><br/>D1 M1.5"]
    N2["<b>Pod</b> — the atomic unit<br/>shared netns + IPC + volumes<br/>D1 M1.6"]
    N3["Pod lifecycle & phases<br/>Pending→Running→Succeeded/Failed<br/>D1 M1.6"]
    N4["Downward API<br/>D1 M1.6"]
    N5["<b>ReplicaSet</b> — desired replica count<br/>D1 M1.7"]
    N6["<b>Deployment</b> — declarative updates<br/>D1 M1.7"]
    N7["ownerReferences & garbage collection<br/>D1 M1.7"]
    N8["<b>Service: ClusterIP</b><br/>D1 M1.8"]
    N9["Endpoints / EndpointSlice<br/>D1 M1.8"]
    N10["<b>DNS — seed</b><br/>reach a Service by its name<br/>D1 M1.8 → deepened D4 M4.3"]
    N11["<b>Triage loop</b><br/>events → describe → logs → exec<br/>D1 M1.9"]

    L7 --> N1
    L7 --> N2
    N1 --> N2
    N2 --> N3
    N2 --> N4
    N3 --> N5
    L7 --> N5
    N5 --> N6
    N5 --> N7
    N2 --> N8
    L7 --> N8
    N8 --> N9
    N8 --> N10
    N3 --> N11
    N9 -.-> N11

    style N2 fill:#1f2b3b,stroke:#42a5f5,color:#fff
    style N6 fill:#1f2b3b,stroke:#42a5f5,color:#fff
    style N10 fill:#3b2f1f,stroke:#ffa726,color:#fff
```

**Ordering justification for Day 1.**

| Edge | Why it cannot be reversed |
|---|---|
| Namespace → Pod | Every Pod is created *into* a namespace. Teaching Pods first means silently using `default`, which then has to be untaught. |
| Pod → ReplicaSet | A ReplicaSet is defined as "N copies of this Pod template". Without the Pod, there is nothing to replicate. |
| ReplicaSet → Deployment | A Deployment manages ReplicaSets. Students who meet Deployment first believe Deployment creates Pods directly, and are then unable to explain rollbacks on Day 2. **This 10-minute detour buys the entire Day 2 update model.** |
| Pod + Labels → Service | A Service is a label selector plus a virtual IP. Both halves must exist first. |
| Service → Endpoints | Endpoints are the *output* of the selector. Teaching them first inverts cause and effect — and "no endpoints" is the single most common Service bug, so students must understand the direction of the arrow. |

---

## 4. Reliability layer — Day 2

```mermaid
graph TD
    N6["Deployment<br/>D1 M1.7"]
    N8["Service / Endpoints<br/>D1 M1.8"]
    N3["Pod lifecycle<br/>D1 M1.6"]
    L4S["Scheduler<br/>D1 M1.4"]

    R1["<b>Resource requests</b><br/>→ drives scheduling<br/>D2 M2.2"]
    R2["<b>Resource limits</b><br/>→ drives enforcement<br/>D2 M2.2"]
    R3["QoS classes<br/>Guaranteed · Burstable · BestEffort<br/>D2 M2.2"]
    R4["CPU throttling vs OOMKill<br/>D2 M2.2"]
    R5["ResourceQuota & LimitRange<br/>D2 M2.2"]

    R6["<b>Liveness probe</b> → restart<br/>D2 M2.3"]
    R7["<b>Readiness probe</b> → endpoint in/out<br/>D2 M2.3"]
    R8["<b>Startup probe</b> → protect slow starts<br/>D2 M2.3"]

    R9["Manual scaling<br/>D2 M2.4"]
    R10["metrics-server<br/>D2 M2.4"]
    R11["<b>HPA</b><br/>D2 M2.4"]

    R12["DaemonSet<br/>D2 M2.5"]
    R13["Job & backoffLimit<br/>D2 M2.5"]
    R14["CronJob & concurrencyPolicy<br/>D2 M2.5"]

    R15["<b>Rolling update</b><br/>maxSurge / maxUnavailable<br/>D2 M2.6"]
    R16["Rollback & revision history<br/>D2 M2.6"]
    R17["Graceful shutdown<br/>SIGTERM · grace period · preStop<br/>D2 M2.6"]

    L4S --> R1
    N3 --> R1
    R1 --> R2
    R2 --> R3
    R2 --> R4
    R1 --> R5
    N3 --> R6
    N8 --> R7
    R6 --> R8
    N6 --> R9
    R1 --> R10
    R10 --> R11
    R9 --> R11
    N3 --> R12
    N3 --> R13
    R13 --> R14
    N6 --> R15
    R7 --> R15
    R15 --> R16
    R7 --> R17
    R15 --> R17

    style R1 fill:#1f3b2b,stroke:#66bb6a,color:#fff
    style R7 fill:#1f3b2b,stroke:#66bb6a,color:#fff
    style R15 fill:#1f3b2b,stroke:#66bb6a,color:#fff
```

**Three edges that carry the whole day.**

1. **`requests` → HPA.** The HPA computes `desiredReplicas = ceil(currentReplicas × currentUtilisation / targetUtilisation)`, where utilisation is a percentage *of the request*. With no request there is no denominator and the HPA reports `<unknown>` and does nothing. Teaching HPA before requests produces a lab that silently fails and a student who concludes "HPA doesn't work."

2. **Readiness probe → rolling update.** A rolling update advances when new pods become *Ready*. With no readiness probe, "Ready" means "the container process started", so the rollout completes while the application is still loading its connection pool — and traffic is dropped. Every zero-downtime deployment story in the industry rests on this single edge.

3. **Readiness probe → graceful shutdown.** On termination, the pod must leave the Endpoints list *before* it stops accepting connections, or in-flight payments are severed. This is `preStop` + readiness working together, and it only makes sense once both are understood.

---

## 5. State layer — Day 3

```mermaid
graph TD
    N2["Pod<br/>D1 M1.6"]
    N6["Deployment<br/>D1 M1.7"]
    N8["Service<br/>D1 M1.8"]
    R15["Rolling update<br/>D2 M2.6"]
    L5C["CSI interface<br/>D1 M1.4"]

    C1["<b>ConfigMap</b><br/>D3 M3.1"]
    C2["Consume as env var<br/><i>snapshot at start</i><br/>D3 M3.1"]
    C3["Consume as volume<br/><i>updates in place</i><br/>D3 M3.1"]
    C4["Checksum annotation<br/>→ rollout on config change<br/>D3 M3.1"]
    C5["<b>Secret</b><br/>base64 ≠ encryption<br/>D3 M3.2"]
    C6["etcd encryption at rest · RBAC<br/>external secret managers<br/>D3 M3.2"]

    S1["<b>Volumes</b> — ephemeral<br/>emptyDir · hostPath<br/>D3 M3.3"]
    S2["<b>PersistentVolume</b><br/>D3 M3.3"]
    S3["<b>PersistentVolumeClaim</b><br/>D3 M3.3"]
    S4["Access modes · reclaim policy<br/>D3 M3.3"]
    S5["<b>StorageClass</b><br/>dynamic provisioning<br/>D3 M3.4"]
    S6["volumeBindingMode<br/>WaitForFirstConsumer<br/>D3 M3.4"]
    S7["Projected volumes<br/>D3 M3.4"]

    T1["Data tier deployed<br/>PostgreSQL · Redis · RabbitMQ<br/>D3 M3.5"]
    T2["<b>Headless Service — seed</b><br/>stable per-pod DNS<br/>D3 M3.6 → deepened D4 M4.2"]
    T3["<b>StatefulSet</b><br/>stable identity + storage<br/>D3 M3.6"]
    T4["volumeClaimTemplates<br/>D3 M3.6"]
    T5["Init containers<br/>wait-for-db · migrations<br/>D3 M3.6"]

    X1["<b>securityContext</b><br/>runAsNonRoot · readOnlyRootFilesystem<br/>drop capabilities<br/>D3 M3.7"]
    X2["fsGroup & volume ownership<br/>D3 M3.7"]

    N2 --> C1
    C1 --> C2
    C1 --> C3
    C3 --> C4
    R15 --> C4
    C1 --> C5
    C5 --> C6
    N2 --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    L5C --> S5
    S3 --> S5
    S5 --> S6
    C1 --> S7
    C5 --> S7
    S5 --> T1
    S3 --> T1
    N8 --> T2
    T2 --> T3
    N6 --> T3
    S3 --> T3
    T3 --> T4
    N2 --> T5
    T1 --> T5
    N2 --> X1
    S1 --> X2
    X1 --> X2

    style S3 fill:#3b2f1f,stroke:#ffa726,color:#fff
    style T3 fill:#3b2f1f,stroke:#ffa726,color:#fff
    style C5 fill:#3b1f1f,stroke:#d32f2f,color:#fff
```

**Why StatefulSet cannot be taught on Day 1 with the other controllers** — even though the source syllabus groups them together under "Managing Workloads".

A StatefulSet is defined entirely in terms of things a Day 1 student has not met:

| StatefulSet feature | Requires |
|---|---|
| Stable persistent storage per replica | PersistentVolumeClaim (D3 M3.3) |
| `volumeClaimTemplates` | StorageClass and dynamic provisioning (D3 M3.4) |
| Stable network identity `pod-0.svc…` | Headless Service (D3 M3.6) |
| Ordered, graceful deployment and scaling | Pod lifecycle + graceful shutdown (D2 M2.6) |
| The reason it exists at all | Contrast with Deployment's interchangeable pods (D1 M1.7) |

Taught on Day 1, StatefulSet is a vocabulary exercise. Taught on Day 3 — the hour after students have watched a database pod get rescheduled and lose its data — it is obvious. This is the single most important resequencing decision in the course.

---

## 6. Networking, placement, security and operations — Days 4 and 5

```mermaid
graph TD
    N8["Service ClusterIP<br/>D1 M1.8"]
    N9["Endpoints<br/>D1 M1.8"]
    N10["DNS seed<br/>D1 M1.8"]
    T2["Headless seed<br/>D3 M3.6"]
    N1["Namespaces<br/>D1 M1.5"]
    L7["Labels<br/>D1 M1.4"]
    N6["Deployment<br/>D1 M1.7"]

    W1["<b>Cluster network model</b><br/>4 rules · CNI contract<br/>D4 M4.1"]
    W2["<b>Service types</b><br/>NodePort · LoadBalancer<br/>ExternalName · headless<br/>D4 M4.2"]
    W3["kube-proxy: iptables vs IPVS<br/>externalTrafficPolicy<br/>D4 M4.2"]
    W4["<b>CoreDNS deep dive</b><br/>FQDN · ndots · search domains<br/>D4 M4.3"]
    W5["<b>Ingress resource</b><br/>D4 M4.4"]
    W6["<b>Ingress controller</b><br/>D4 M4.4"]
    W7["TLS termination<br/>D4 M4.4"]
    W8["Gateway API <i>(discussed)</i><br/>D4 M4.4"]
    W9["<b>NetworkPolicy</b><br/>default-deny + allow-list<br/>D4 M4.5"]
    W10["DNS egress rule<br/><i>the classic trap</i><br/>D4 M4.5"]

    P1["Scheduling cycle: filter → score<br/>D4 M4.6"]
    P2["nodeSelector<br/>D4 M4.6"]
    P3["nodeAffinity: required vs preferred<br/>D4 M4.6"]
    P4["pod affinity / anti-affinity<br/>D4 M4.6"]
    P5["topologySpreadConstraints<br/>D4 M4.6"]
    P6["Taints & tolerations<br/>D4 M4.7"]
    P7["cordon · drain · uncordon<br/>D4 M4.7"]
    P8["<b>PodDisruptionBudget</b><br/>D4 M4.7"]

    G1["Request pipeline<br/>authN → authZ → admission<br/>D5 M5.1"]
    G2["TLS client certs · kubeconfig<br/>D5 M5.1"]
    G3["ServiceAccount · projected token<br/>D5 M5.1"]
    G4["Pod Security Admission<br/>D5 M5.1"]
    G5["<b>Role / ClusterRole</b><br/>D5 M5.2"]
    G6["<b>RoleBinding / ClusterRoleBinding</b><br/>D5 M5.2"]
    G7["kubectl auth can-i<br/>D5 M5.2"]

    H1["<b>Helm: chart · release · values</b><br/>D5 M5.3"]
    H2["Templates · _helpers.tpl<br/>D5 M5.3"]
    H3["Subchart dependencies<br/>D5 M5.3"]
    H4["upgrade · --atomic · rollback<br/>D5 M5.3"]
    H5["values per environment<br/>D5 M5.3"]

    O1["Golden signals for payments<br/>D5 M5.4"]
    O2["<b>Prometheus</b> pull + discovery<br/>D5 M5.4"]
    O3["Grafana dashboards<br/>D5 M5.4"]
    O4["<b>Loki</b> + Alloy DaemonSet<br/>D5 M5.4"]
    O5["Alertmanager routing<br/>D5 M5.4"]
    O6["SLO & error budget<br/>D5 M5.4"]

    U1["Version skew policy<br/>D5 M5.6"]
    U2["kubeadm upgrade sequence<br/>D5 M5.6"]
    U3["<b>Production upgrade</b><br/>D5 M5.6 → Capstone"]

    N8 --> W1
    W1 --> W2
    N9 --> W2
    T2 --> W2
    W2 --> W3
    N10 --> W4
    W2 --> W4
    W2 --> W5
    W5 --> W6
    W6 --> W7
    W6 -.-> W8
    N1 --> W9
    L7 --> W9
    W4 --> W9
    W9 --> W10
    P1 --> P2
    P2 --> P3
    L7 --> P4
    P3 --> P4
    P4 --> P5
    P3 --> P6
    P6 --> P7
    N6 --> P8
    P7 --> P8

    G1 --> G2
    G1 --> G3
    G3 --> G4
    G3 --> G5
    G5 --> G6
    G6 --> G7

    W9 --> H1
    P8 --> H1
    G6 --> H1
    H1 --> H2
    H2 --> H3
    H3 --> H4
    H4 --> H5

    G6 --> O2
    W2 --> O2
    O1 --> O2
    O2 --> O3
    O2 --> O5
    O3 --> O6
    O5 --> O6

    P8 --> U1
    U1 --> U2
    U2 --> U3
    H4 --> U3
    O5 --> U3

    style W9 fill:#3b1f2b,stroke:#ec407a,color:#fff
    style G5 fill:#2b1f3b,stroke:#ab47bc,color:#fff
    style H1 fill:#2b1f3b,stroke:#ab47bc,color:#fff
    style O2 fill:#2b1f3b,stroke:#ab47bc,color:#fff
    style U3 fill:#3b1f1f,stroke:#d32f2f,color:#fff
```

**Load-bearing edges in the back half of the week.**

| Edge | Consequence of getting it wrong |
|---|---|
| **DNS deep dive → NetworkPolicy** | Students must already know that every service call begins with a UDP/TCP 53 lookup to CoreDNS in `kube-system`. Without it, their first default-deny policy breaks everything and they cannot reason about why. Taught in this order, the fix is *derivable* rather than copied. |
| **RBAC → Prometheus** | Prometheus discovers targets by calling the API server with a ServiceAccount token. Its ClusterRole is the first real-world RBAC object students meet, and it lands the day's security lesson far harder than a synthetic "read-only auditor" example. |
| **PDB → cluster upgrade** | Draining a node without PodDisruptionBudgets evicts every replica of the payment service simultaneously. The capstone upgrade *requires* the PDBs written on Day 4 — this is the clearest demonstration all week that Thursday's work protects Friday's. |
| **Helm ← everything** | Helm is deliberately last. A student who learns Helm before raw manifests can install charts but cannot debug them. The chart built in M5.3 packages exactly the manifests the students wrote themselves over four days, so `helm template` output is instantly recognisable. |

---

## 7. Ordering violations found — and how they are resolved

Building the DAG surfaced three places where the ideal order conflicts with a fixed constraint. Each is resolved by an explicit **seed-then-deepen** pair rather than by pretending the dependency does not exist.

### V1 — DNS is needed on Day 1 but taught on Day 4

**Conflict.** The moment a ClusterIP Service exists (D1 M1.8), students reach it as `http://payment-service:8080`. That is DNS. But CoreDNS internals, FQDN forms, search domains and `ndots` belong with the networking module on Day 4.

**Resolution.** A 10-minute **seed** in D1 M1.8: *"Kubernetes runs a DNS server; a Service is reachable by its name inside its namespace, and by `name.namespace` across namespaces. We will open up how this works on Thursday."* Full treatment in D4 M4.3, which opens by explicitly calling back to the seed.

**Why this is correct, not a compromise.** You cannot teach Services without naming them. Deferring the *mechanism* while giving the *fact* is standard instructional practice, and the callback on Day 4 reinforces both.

### V2 — Headless Services are needed on Day 3 but belong in the Day 4 Service taxonomy

**Conflict.** `StatefulSet` (D3 M3.6) requires a headless Service for stable per-pod DNS. The complete Service-type taxonomy is D4 M4.2.

**Resolution.** **Seed** in D3 M3.6: headless Service introduced as *"a Service with `clusterIP: None`, which returns pod IPs instead of a virtual IP — which is what gives `postgres-0` a stable name."* Taught only to the depth StatefulSet requires. D4 M4.2 then places it in the full taxonomy alongside ClusterIP, NodePort, LoadBalancer and ExternalName.

### V3 — Troubleshooting is needed from hour four but is a Day 5 module

**Conflict.** The first injected incident is Day 1, 16:30. The formal troubleshooting module is D5 M5.5.

**Resolution.** This is not really a conflict — it is the correct design. The **6-step triage loop is taught on Day 1 (M1.9)** as a *method*, before students have enough Kubernetes knowledge for it to be a symptom lookup table. That is precisely why it works: they learn to *investigate* rather than to *recognise*. D5 M5.5 then consolidates four days of applied practice into decision trees and a written incident-record discipline.

**The 6-step triage loop, taught Day 1 and used 8 times:**

```
1. What is the desired state?      kubectl get <kind> -o yaml
2. What is the actual state?       kubectl get pods -o wide
3. What does the cluster say?      kubectl describe / kubectl get events --sort-by=...
4. What does the app say?          kubectl logs [--previous] [-c container]
5. Can I reproduce it from inside? kubectl exec / kubectl debug / kubectl port-forward
6. What changed?                   kubectl rollout history / git diff
```

---

## 8. Master concept → day matrix

Read down a column to see everything a student must already hold before that day begins.

| Concept | D1 | D2 | D3 | D4 | D5 |
|---|:--:|:--:|:--:|:--:|:--:|
| Reconciliation loop | **teach** | use | use | use | use |
| Cluster architecture | **teach** | use | use | use | use |
| Labels & selectors | **teach** | use | use | use | use |
| Namespaces | **teach** | use | use | use | use |
| Pod | **teach** | use | use | use | use |
| Downward API | **teach** | use | use | use | use |
| Deployment / ReplicaSet | **teach** | use | use | use | use |
| Service (ClusterIP) | **teach** | use | use | deepen | use |
| DNS | *seed* | use | use | **teach** | use |
| Triage loop | **teach** | use | use | use | consolidate |
| Requests / limits / QoS | | **teach** | use | use | use |
| ResourceQuota / LimitRange | | **teach** | use | use | use |
| Probes | | **teach** | use | use | use |
| Scaling / HPA | | **teach** | use | use | use |
| DaemonSet | | **teach** | use | use | use |
| Job / CronJob | | **teach** | use | use | use |
| Rolling update / rollback | | **teach** | use | use | use |
| Graceful shutdown | | **teach** | use | use | use |
| ConfigMap | | | **teach** | use | use |
| Secret | | | **teach** | use | use |
| Volumes / PV / PVC | | | **teach** | use | use |
| StorageClass / CSI | | | **teach** | use | use |
| StatefulSet | | | **teach** | use | use |
| Headless Service | | | *seed* | **teach** | use |
| Init containers | | | **teach** | use | use |
| securityContext | | | **teach** | use | use |
| Cluster network model | | | | **teach** | use |
| Service types / kube-proxy | | | | **teach** | use |
| Ingress + TLS | | | | **teach** | use |
| NetworkPolicy | | | | **teach** | use |
| Affinity / anti-affinity / spread | | | | **teach** | use |
| Taints / tolerations / drain | | | | **teach** | use |
| PodDisruptionBudget | | | | **teach** | use |
| AuthN / TLS / ServiceAccount | | | | | **teach** |
| Pod Security Admission | | | | | **teach** |
| RBAC | | | | | **teach** |
| Helm | | | | | **teach** |
| Prometheus / Grafana / Loki | | | | | **teach** |
| SLO / error budget | | | | | **teach** |
| Cluster upgrade | | | | | **teach** |

---

## 9. Lab dependency chain

Labs obey the same DAG. Each lab's artefacts are consumed by later labs; nothing is thrown away.

```mermaid
graph LR
    subgraph DAY1[" DAY 1 "]
    A1[L1.1 Cluster<br/>recon] --> A2[L1.2 Namespaces]
    A2 --> A3[L1.3 First Pod]
    A3 --> A4[L1.4 Deployment<br/>+ self-healing]
    A4 --> A5[L1.5 Service<br/>+ load balance]
    A5 --> A6[L1.6 4 services<br/>talking]
    A6 --> A7[INC-1<br/>ImagePullBackOff]
    end

    subgraph DAY2[" DAY 2 "]
    A7 --> B1[L2.1 Requests<br/>limits QoS]
    B1 --> B2[L2.2 Quota<br/>LimitRange]
    B2 --> B3[L2.3 Probes]
    B3 --> B4[L2.4 HPA<br/>under load]
    B4 --> B5[L2.5 DaemonSet<br/>Job CronJob]
    B5 --> B6[L2.6 Zero-downtime<br/>rollout]
    B6 --> B7[INC-2<br/>OOMKill]
    end

    subgraph DAY3[" DAY 3 "]
    B7 --> C1[L3.1 ConfigMaps]
    C1 --> C2[L3.2 Secrets]
    C2 --> C3[L3.3 PV/PVC]
    C3 --> C4[L3.4 StorageClass]
    C4 --> C5[L3.5 Data tier<br/>+ seed data]
    C5 --> C6[L3.6 StatefulSet<br/>+ init containers]
    C6 --> C7[L3.7 Non-root<br/>hardening]
    C7 --> C8[INC-3<br/>Pending PVC]
    end

    subgraph DAY4[" DAY 4 "]
    C8 --> D1L[L4.1 Service<br/>types]
    D1L --> D2L[L4.2 DNS<br/>forensics]
    D2L --> D3L[L4.3 Ingress<br/>+ TLS]
    D3L --> D4L[L4.4 Zero-trust<br/>NetworkPolicy]
    D4L --> D5L[L4.5 Affinity<br/>+ spread]
    D5L --> D6L[L4.6 Taints<br/>+ PDB + drain]
    D6L --> D7L[INC-4<br/>Ingress + DNS]
    end

    subgraph DAY5[" DAY 5 "]
    D7L --> E1[L5.1 SA + PSA]
    E1 --> E2[L5.2 RBAC<br/>least privilege]
    E2 --> E3[L5.3 Helm chart]
    E3 --> E4[L5.4 Multi-env<br/>promotion]
    E4 --> E5[L5.5 Prometheus<br/>+ Grafana]
    E5 --> E6[L5.6 Loki<br/>+ Alertmanager]
    E6 --> CAP[CAPSTONE<br/>upgrade under fire]
    end

    style A5 fill:#1f2b3b,stroke:#42a5f5,color:#fff
    style B6 fill:#1f3b2b,stroke:#66bb6a,color:#fff
    style C6 fill:#3b2f1f,stroke:#ffa726,color:#fff
    style D4L fill:#3b1f2b,stroke:#ec407a,color:#fff
    style CAP fill:#3b1f1f,stroke:#d32f2f,color:#fff
```

### 9.1 Recovery points

A single lab must never be able to destroy the week. Every lab ends by writing its state, and `scripts/validate/checkpoint-day<N>.sh` can rebuild any day's end-state from manifests in under four minutes.

| Checkpoint | Restores | Runtime |
|---|---|---|
| `checkpoint-day1.sh` | 3 namespaces, 4 Deployments, 4 Services | ~2 min |
| `checkpoint-day2.sh` | + resources, probes, HPA, DaemonSet, Job, CronJob | ~3 min |
| `checkpoint-day3.sh` | + ConfigMaps, Secrets, PVCs, data tier, seed data | ~4 min |
| `checkpoint-day4.sh` | + Ingress, NetworkPolicies, placement rules, PDBs | ~4 min |
| `checkpoint-day5.sh` | + RBAC, Helm release, observability stack | ~5 min |

A student who arrives late, breaks their cluster, or joins on Wednesday can be productive within five minutes. This is not a nicety — over a five-day course it is the difference between one lost student and one lost classroom.

---

*Document owner: Instructional Designer + Principal Software Engineer · Version 1.0 · Phase 1*
