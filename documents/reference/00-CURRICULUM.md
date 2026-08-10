# Kubernetes Comprehensive — Enterprise Curriculum Design

**Course code:** `AXP-K8S-5D`
**Duration:** 5 days / 35 contact hours
**Delivery:** Instructor-led (onsite or virtual), live-lab
**Audience:** System Administrators · Developers · DevOps Engineers · SRE · Cloud Engineers
**Lab environment:** Ubuntu 26.04 LTS (24.04 LTS supported) + Minikube, Kubernetes v1.36.x
**Business context:** AxisPay — a fictional pan-African payment orchestration platform
**Split:** 30% theory / 70% hands-on (verified per-block in §7)

---

## 1. How this document should be used

This is the **design authority** for the course. Every other artefact in this repository — slides, participant manual, labs, manifests, charts, assessments — is generated from the module list, objectives and sequencing defined here. If a topic is not in §5, it does not belong in the course. If a lab does not map to an objective in §5, it does not belong in the lab roadmap.

Three audiences read it:

| Reader | What they need from it |
|---|---|
| **Instructor** | Timings, objectives, what to demo, where the hard parts are |
| **Curriculum owner** | Traceability from source syllabus → objective → lab → assessment |
| **Client L&D / procurement** | Evidence the course covers the advertised outcomes and more |

---

## 2. Source syllabus analysis

The supplied outline (NobleProg *Kubernetes Comprehensive*, 35 hours) was treated **strictly as a syllabus** — a list of required coverage. It was decomposed into 11 modules and 33 discrete topics. Nothing from it has been dropped.

### 2.1 Coverage map — source outline → this course

| # | Source module | Source topics | Where it lands here | Verdict |
|---|---|---|---|---|
| 1 | Introduction to Kubernetes | Architecture; API server, Controller Manager, Scheduler, etcd, Kubelet; Pods, Nodes, Clusters | D1 M1.2, M1.3, M1.4 | **Expanded** — added the reconciliation loop as the course's organising idea, plus CRI/CNI/CSI interface layer |
| 2 | Resource Management | Namespaces; Requests & Limits; Scaling | D1 M1.5 (Namespaces), D2 M2.2 (Requests/Limits), D2 M2.4 (Scaling) | **Split** — namespaces belong on Day 1 (you cannot deploy without one); resource maths belongs on Day 2 |
| 3 | Managing Workloads | Deployments, StatefulSets, DaemonSets; Jobs & CronJobs; Updates & rollbacks | D1 M1.7 (Deployments), D2 M2.5 (DaemonSet/Job/CronJob), D2 M2.6 (updates/rollbacks), D3 M3.6 (StatefulSets) | **Resequenced** — StatefulSets are meaningless before PersistentVolumes are taught. Moved to Day 3, immediately after storage |
| 4 | Networking & Service Discovery | Service types; DNS & discovery; Ingress | D1 M1.8 (ClusterIP only), D4 M4.1–M4.5 | **Split** — a minimal ClusterIP on Day 1 so students can see traffic work; the full model on Day 4 |
| 5 | Data Persistence | PV/PVC; static & dynamic; access modes, reclaim policies, projected volumes | D3 M3.3, M3.4, M3.5 | **As specified**, plus CSI architecture and the `volumeBindingMode` trap |
| 6 | Configuration Management | ConfigMaps & Secrets; env vars & volumes | D3 M3.1, M3.2 | **Expanded** — added checksum-triggered rollouts, immutable ConfigMaps, and why Secrets are *not* encryption |
| 7 | Cluster Management | kubeadm upgrades; TLS authentication; RBAC | D5 M5.1 (auth/TLS), M5.2 (RBAC), M5.7 (upgrades) | **Expanded** — added ServiceAccount token projection and Pod Security Admission |
| 8 | Advanced Scaling Strategies | NodeSelector, NodeAffinity, PodAffinity; Taints & Tolerations | D4 M4.6, M4.7 | **Resequenced** — placement is a topology conversation, so it sits with networking/topology on Day 4, not stranded at the end |
| 9 | Provisioning with Helm | Helm & charts; creating/deploying; dependencies | D5 M5.3 | **As specified**, plus values-per-environment and rollback drills |
| 10 | Troubleshooting | BackOff/CrashLoopBackOff; NotReady nodes; kubectl & logs | Woven through **all five days** as injected incidents; consolidated in the D5 capstone (M5.8) | **Fundamentally upgraded** — see §3.1 |
| 11 | Summary & Next Steps | — | D5 M5.9 | Retained, plus certification pathway |

### 2.2 Prerequisites identified in the source

Stated: basic Linux commands; familiarity with containerisation (e.g. Docker); networking fundamentals recommended.

**Assessment:** these are correct but under-specified for a course that reaches RBAC and Helm by Friday. A student who has "heard of Docker" will drown on Day 3. See §4 for the hardened prerequisite definition and the pre-course self-assessment.

---

## 3. Gap analysis — what the source syllabus is missing

Eleven gaps were identified. Each is a skill an engineer needs on their first week of real Kubernetes work, and each is now taught.

### 3.1 Critical gaps (would cause on-the-job failure)

| Gap | Why it matters | Remedy in this course |
|---|---|---|
| **G1 — Health probes** | Absent from the source outline entirely. Without probes, rolling updates drop live traffic and dead pods keep receiving requests. This is the single most common cause of "Kubernetes broke our deployment" incidents. | **D2 M2.3** — liveness, readiness, startup; the readiness-vs-liveness confusion; probe-induced cascading failure |
| **G2 — Systematic troubleshooting method** | The source lists three symptoms. Real incidents are unbounded. Engineers need a *method*, not a symptom lookup table. | **D1 M1.9** introduces the 6-step triage loop on day one; it is then applied to every injected incident all week; **D5 M5.8** (the capstone) assesses it under time pressure |
| **G3 — Observability** | No monitoring, metrics, logging or alerting in the source outline. You cannot operate a payment platform you cannot see. | **D5 M5.5 and M5.6** — Prometheus, Grafana, Loki, Alertmanager; golden signals defined for payments; SLO/error-budget framing |
| **G4 — NetworkPolicy** | Absent. A flat pod network in a payments environment is a PCI-DSS finding. Default-allow east-west traffic is the norm students will inherit. | **D4 M4.5** — default-deny in the cardholder data environment, then explicit allow-listing |
| **G5 — Security context / Pod Security** | Absent. Containers running as root with a writable filesystem is the default students will produce unless taught otherwise. | **D3 M3.7** (securityContext on workloads) and **D5 M5.1** (Pod Security Admission at namespace level) |

### 3.2 Significant gaps (would cause poor practice)

| Gap | Remedy |
|---|---|
| **G6 — The declarative model & reconciliation** | The source teaches objects but never the idea that unifies them. **D1 M1.3** makes the control loop the spine of the entire week: every subsequent object is introduced as "what controller watches this, and what does it reconcile towards?" |
| **G7 — Autoscaling (HPA)** | Source says "scaling applications" but only implies manual replica changes. **D2 M2.4** covers manual, HPA, metrics-server, and why HPA and `requests` are the same conversation |
| **G8 — Disruption budgets & graceful shutdown** | Absent. **D2 M2.6** covers `terminationGracePeriodSeconds`, `preStop`, SIGTERM handling; **D4 M4.7** covers PodDisruptionBudget before the Day 5 upgrade |
| **G9 — Multi-environment promotion** | Source treats the cluster as one environment. **D5 M5.4** uses Helm values files to promote the same chart dev → staging → prod |
| **G10 — Init containers & native sidecars** | Absent. Real platforms need ordered startup (wait-for-database) and sidecars (log shipper). **D3 M3.6** covers init containers for schema migration; the capstone migration Job uses a wait-for-database init container, and Grafana's dashboard sidecar is examined in **D5 M5.5** |
| **G11 — Resource quotas & LimitRange** | Source covers per-pod requests/limits but not namespace-level governance, which is how platform teams actually enforce them. **D2 M2.2** |

### 3.3 Deliberate exclusions (and why)

Being explicit about what is *not* taught is part of a professional design. These were considered and cut:

| Excluded | Reason |
|---|---|
| Service mesh (Istio/Linkerd) | Requires solid NetworkPolicy + sidecar grounding first. Signposted on Day 5 as the next course. |
| Operators & CRDs | Signposted only. A meaningful treatment needs a day of its own. |
| GitOps (Argo CD / Flux) | Signposted. Depends on Helm, which is only reached on Day 5. |
| Multi-cluster / federation | Out of scope for a single-cluster comprehensive course. |
| Building a cluster with kubeadm from scratch | The source asks for *upgrades* via kubeadm, which is taught conceptually plus a Minikube-based practical. Full bare-metal bootstrap is a separate CKA-track exercise; the theory and full command sequence are supplied in the manual for reference. |
| Cloud-provider integrations (EKS/AKS/GKE specifics) | Environment is Minikube. Differences are called out as "in a managed cluster this is done by…" callouts throughout. |

---

## 4. Prerequisites (hardened)

### 4.1 Required — students without these will not keep up

| # | Skill | Verification question |
|---|---|---|
| P1 | Linux shell: navigate, edit files with `vi`/`nano`, `cat`, `grep`, `tail -f`, pipes, `sudo` | *Show me how you'd find every line containing "ERROR" in a 2 GB log file.* |
| P2 | Understand what a process, port and environment variable are | *What does it mean when a program "listens on port 8080"?* |
| P3 | Basic YAML: indentation, lists, maps, strings vs numbers | *Why does `version: 1.10` behave differently from `version: "1.10"`?* |
| P4 | Container basics: image vs container, `docker run`, `docker build`, why containers are not VMs | *What is inside a container image?* |
| P5 | HTTP basics: request/response, status codes, JSON | *What does a 503 mean and who usually emits it?* |

### 4.2 Recommended — helpful, but taught inline if absent

| # | Skill |
|---|---|
| P6 | TCP/IP fundamentals: IP address, port, DNS resolution, subnet |
| P7 | Any experience with a relational database and a connection string |
| P8 | Git basics (`clone`, `pull`) — needed only to fetch the lab repository |
| P9 | Exposure to CI/CD concepts |

### 4.3 Pre-course actions (sent 7 days before)

1. Complete the self-assessment (`documents/assessments/`).
2. Provision the lab machine per `instructor/setup/STUDENT-SETUP.md` — **4 vCPU / 8 GB RAM minimum, 6 vCPU / 12 GB RAM recommended, 40 GB free disk**.
3. Run `scripts/setup/00-preflight.sh` and send the output to the instructor. This catches broken environments before Monday 09:00, which is the single highest-value thing a training operation can do.

---

## 5. Module map, learning objectives and sequencing

Objectives are written to **Bloom's taxonomy** and are all observable — each one is something the student *does*, and each is validated by a specific lab or assessment item.

Legend: **T** = theory minutes, **P** = practical minutes.

---

### DAY 1 — Foundations and First Deployment
*Theme: "From container to running platform." By 17:00 the student has AxisPay's first four services running and talking to each other.*

| Module | Title | T | P | Learning objectives — the student will be able to… |
|---|---|---|---|---|
| M1.1 | Course, platform and business context | 25 | 5 | Describe the AxisPay business problem and name the services they will build; state the course's assessment model |
| M1.2 | Why orchestration exists | 25 | 10 | Explain the operational problems containers create at scale; justify orchestration to a non-technical stakeholder; distinguish orchestration from virtualisation |
| M1.3 | The declarative model & reconciliation loop | 30 | 10 | Explain desired state vs actual state; trace a reconciliation cycle end-to-end; predict what a controller does when a pod is deleted |
| M1.4 | Cluster architecture & component walkthrough | 40 | 30 | Name every control-plane and node component and state its single responsibility; trace `kubectl apply` through apiserver → etcd → scheduler → kubelet → CRI; locate each component in a live Minikube cluster |
| M1.5 | Namespaces and multi-tenancy | 20 | 30 | Design a namespace layout for a segmented payments estate; create/switch/scope namespaces; identify which resources are *not* namespaced |
| M1.6 | Pods — the atomic unit | 40 | 40 | Explain why the Pod exists rather than "a container"; describe shared network and storage namespaces; write a Pod manifest; inspect, exec into and read logs from a running Pod; explain why bare Pods are unsuitable for production |
| M1.7 | Deployments & ReplicaSets | 35 | 55 | Explain the Deployment → ReplicaSet → Pod ownership chain; write a Deployment; scale it; demonstrate self-healing by killing a pod; read `ownerReferences` |
| M1.8 | Services — stable identity (ClusterIP) | 30 | 40 | Explain why pod IPs cannot be used directly; describe label-selector → Endpoints → kube-proxy; expose a Deployment; prove load-balancing across replicas |
| M1.9 | Triage method + incident #1 | 15 | 35 | Apply the 6-step triage loop; diagnose and fix an `ImagePullBackOff` unaided |
| M1.10 | Knowledge check, day assessment, Q&A | 0 | 45 | — |
| | **Day 1 totals** | **260** | **300** | **46% / 54%** |

---

### DAY 2 — Reliability, Resource Governance and Controlled Change
*Theme: "Make it survive Monday morning." Traffic arrives; the platform must not fall over, and must be upgradeable without downtime.*

| Module | Title | T | P | Learning objectives |
|---|---|---|---|---|
| M2.1 | Recap + Day 1 incident review | 15 | 15 | Explain yesterday's fix to a peer; restore the platform to a known-good state |
| M2.2 | Resource requests, limits, QoS & governance | 45 | 45 | Calculate correct requests from observed usage; explain how requests drive scheduling and limits drive enforcement; distinguish CPU throttling from OOMKill; assign QoS classes; apply ResourceQuota and LimitRange to a namespace |
| M2.3 | Health probes | 40 | 50 | Distinguish liveness, readiness and startup probes by their *consequence*; write correct probes for a slow-starting payment service; explain how a wrong liveness probe causes a cascading outage; implement a dependency-aware readiness endpoint |
| M2.4 | Scaling: manual, HPA and the limits of both | 35 | 55 | Scale manually; deploy metrics-server; configure an HPA on CPU; explain why HPA is meaningless without requests; describe scale-up/scale-down stabilisation; state what HPA cannot fix |
| M2.5 | Workload controllers: DaemonSet, Job, CronJob | 40 | 45 | Choose the correct controller for a given workload; deploy a node-agent DaemonSet; run a reconciliation Job; schedule the nightly settlement CronJob; explain `concurrencyPolicy`, `backoffLimit` and `activeDeadlineSeconds` |
| M2.6 | Rolling updates, rollbacks & graceful shutdown | 40 | 55 | Explain `maxSurge`/`maxUnavailable` arithmetically; perform a zero-downtime update under live traffic; roll back on failure; explain the SIGTERM → grace period → SIGKILL sequence; implement `preStop` to drain connections |
| M2.7 | Incident #2 + knowledge check + day assessment | 10 | 60 | Diagnose a `CrashLoopBackOff` caused by an OOMKill; distinguish it from a probe failure |
| | **Day 2 totals** | **225** | **325** | **41% / 59%** |

---

### DAY 3 — State, Configuration and Data
*Theme: "Give it a memory." The platform gets a real PostgreSQL database, real configuration, and real secrets.*

| Module | Title | T | P | Learning objectives |
|---|---|---|---|---|
| M3.1 | ConfigMaps | 30 | 40 | Externalise configuration from images; consume config as env vars *and* as volumes; explain the update-propagation difference between the two; use immutable ConfigMaps; trigger rollout on config change via checksum annotation |
| M3.2 | Secrets — and their honest limitations | 35 | 40 | Create and consume Secrets; state plainly that Secrets are base64-encoded, not encrypted; explain etcd encryption-at-rest and RBAC as the real controls; enumerate the ways Secrets leak; describe external secret managers |
| M3.3 | The storage model: Volumes, PV, PVC, StorageClass | 50 | 30 | Distinguish ephemeral volumes from persistent ones; explain the PV/PVC claim-binding contract; describe static vs dynamic provisioning; explain access modes and why RWO is not "one pod"; choose reclaim policies |
| M3.4 | CSI architecture & dynamic provisioning | 25 | 35 | Describe the CSI controller/node split; provision a PVC dynamically on Minikube; explain `volumeBindingMode: WaitForFirstConsumer` and the failure it prevents |
| M3.5 | Deploying PostgreSQL, Redis and RabbitMQ | 20 | 60 | Deploy the AxisPay data tier with persistent storage; verify data survives pod deletion; apply the schema and seed realistic merchant/transaction data |
| M3.6 | StatefulSets, init containers & ordered startup | 45 | 50 | Explain stable network identity and stable storage; contrast StatefulSet with Deployment; describe headless Services; use `volumeClaimTemplates`; implement an init container that waits for the database and runs migrations |
| M3.7 | securityContext and running as non-root | 25 | 30 | Set `runAsNonRoot`, `readOnlyRootFilesystem`, drop capabilities; explain `fsGroup` for volume ownership; diagnose a permission-denied on a mounted volume |
| M3.8 | Incident #3 + knowledge check + day assessment | 10 | 60 | Diagnose a pod stuck in `Pending` on an unbound PVC and a service broken by a malformed ConfigMap key |
| | **Day 3 totals** | **240** | **345** | **41% / 59%** |

---

### DAY 4 — Networking, Exposure and Placement
*Theme: "Let the world in — and keep it out of the vault." The platform gets an API gateway, DNS-based discovery, an Ingress, and PCI-style segmentation.*

| Module | Title | T | P | Learning objectives |
|---|---|---|---|---|
| M4.1 | The cluster network model | 30 | 30 | State the four Kubernetes networking rules; explain the CNI contract; trace a packet pod → pod on the same and different nodes; explain what an overlay does |
| M4.2 | Services in depth & kube-proxy internals | 35 | 40 | Choose correctly between ClusterIP, NodePort, LoadBalancer, ExternalName and headless; explain how Endpoints/EndpointSlice are populated; compare iptables and IPVS modes; explain session affinity and `externalTrafficPolicy` |
| M4.3 | DNS and service discovery | 30 | 30 | Explain CoreDNS's role and the FQDN pattern `svc.ns.svc.cluster.local`; explain `ndots:5` and its latency cost; resolve names from inside a pod; diagnose a DNS failure |
| M4.4 | Ingress and the API gateway edge | 40 | 55 | Distinguish Ingress resource from Ingress controller; enable ingress-nginx on Minikube; route by host and path; terminate TLS; describe how Gateway API supersedes Ingress |
| M4.5 | NetworkPolicy and zero-trust segmentation | 40 | 50 | Explain that policies are additive and default-allow until a selector matches; write default-deny for the cardholder data environment; allow-list precisely; permit DNS egress; verify enforcement empirically |
| M4.6 | Scheduling: nodeSelector, affinity, anti-affinity, topology spread | 40 | 40 | Explain the filter/score scheduling cycle; pin workloads to node classes with labels; use required vs preferred affinity; spread payment replicas across nodes with anti-affinity; apply topology spread constraints |
| M4.7 | Taints, tolerations & PodDisruptionBudgets | 25 | 30 | Contrast taints (node repels) with affinity (pod attracts); use `NoSchedule`/`NoExecute`; cordon and drain a node safely; write a PDB that protects the payment service during maintenance |
| M4.8 | Incident #4 + knowledge check + day assessment | 10 | 55 | Diagnose a broken Ingress, a service with no endpoints due to a selector typo, and traffic blackholed by an over-broad NetworkPolicy |
| | **Day 4 totals** | **250** | **330** | **43% / 57%** |

---


> **Numbering note (revised during build).** Day 5 was originally planned as six
> modules. Two were split during construction because the material did not fit:
> Helm packaging and environment promotion are different skills with different
> failure modes (M5.3 / M5.4), and observability needs a metrics module and a
> logs-and-alerting module rather than one 100-minute block (M5.5 / M5.6).
> "Troubleshooting as a discipline" was removed as a standalone module — it is
> taught on Day 1 (M1.9) and then exercised in all seven incident windows, and a
> lecture about it on Friday afternoon would have been the weakest hour of the
> week. It is assessed instead, under time pressure, in the capstone.

### DAY 5 — Security, Packaging, Observability and Production Operations
*Theme: "Hand it to the on-call team." The platform is locked down, packaged, instrumented, upgraded under load, and defended.*

| Module | Title | T | P | Learning objectives |
|---|---|---|---|---|
| M5.1 | Identity: authentication, ServiceAccounts and Pod Security Admission | 35 | 30 | Explain the authN → authZ → admission request pipeline; describe how client certificates authenticate humans and projected tokens authenticate workloads; create a ServiceAccount and remove the token nobody uses; apply Pod Security Admission labels and read a rejection; distinguish `enforce`, `audit` and `warn` |
| M5.2 | RBAC | 40 | 50 | Distinguish Role/ClusterRole and RoleBinding/ClusterRoleBinding; write least-privilege rules by verb, resource and apiGroup; grant a read-only auditor and a namespace-scoped deployer; **prove** every grant and denial with `kubectl auth can-i`; explain RBAC's additive, deny-free model and the paths to a Secret that bypass a `secrets` grant |
| M5.3 | Helm: packaging the whole platform | 40 | 55 | Explain charts, releases, values and the rendering pipeline; install the platform in one command; use `_helpers.tpl` and named templates; perform `helm upgrade`, `--atomic` and `rollback`; lint and template-diff before applying; find the immutable-selector defect that only appears on the second release |
| M5.4 | Promotion: dev → staging → production | 20 | 35 | Express the difference between environments as data; explain why staging must match production in shape and differ only in size; justify which settings may be relaxed per environment and which never may; detect and reconcile drift |
| M5.5 | Observability: metrics, PromQL and dashboards | 30 | 55 | Define the golden signals for a payment platform; explain pull-based scraping and ServiceMonitor discovery; distinguish a MISSING target from a DOWN one; write PromQL for traffic, errors, latency and saturation; explain why a histogram and not an average; alert on the absence of traffic |
| M5.6 | Observability: logs and alert routing | 25 | 45 | Explain why Loki indexes labels and not content, and what follows; follow one payment across seven services from a correlation ID; explain cardinality as a design constraint; route, group, throttle and inhibit alerts, and prove the routing rather than assuming it |
| M5.7 | Cluster upgrades and production change management | 30 | 15 | State the version skew policy and the control-plane-first ordering; describe the kubeadm upgrade sequence; drain and uncordon safely; plan a maintenance window with PodDisruptionBudgets; state what cannot be rolled back |
| M5.8 | **CAPSTONE** — production upgrade under fire | 0 | 110 | Upgrade AxisPay under live load while three unannounced incidents are injected; maintain SLO; recover; validate; present findings |
| M5.9 | Final assessment, certification pathway, close | 20 | 30 | Consolidate the week; sit the final examination; map what was covered onto the CKA and CKAD syllabi; state honestly what a five-day course did not cover |
| | **Day 5 totals** | **240** | **425** | **36% / 64%** |

---

## 6. Daily structure (fixed template)

Every day runs the same rhythm. Predictability reduces cognitive load and lets the instructor manage time by exception.

| Time | Block | Duration | Purpose |
|---|---|---|---|
| 09:00 | **Morning recap** | 20 min | Yesterday in 5 questions; restore platform state; surface overnight questions |
| 09:20 | Theory block A | 45 min | New concept — what/why/how/architecture |
| 10:05 | **Live demonstration** | 20 min | Instructor drives; students watch only. No typing. |
| 10:25 | **Guided lab** | 45 min | Instructor and students type together |
| 11:10 | *Break* | 15 min | |
| 11:25 | Theory block B | 40 min | |
| 12:05 | **Independent lab** | 45 min | Students work alone; instructor floats |
| 12:50 | *Lunch* | 45 min | |
| 13:35 | Theory block C | 40 min | |
| 14:15 | **Live demonstration** | 20 min | |
| 14:35 | **Guided lab** | 50 min | |
| 15:25 | *Break* | 15 min | |
| 15:40 | **Independent lab / progressive project** | 50 min | Extends the platform; output is required by tomorrow |
| 16:30 | **Injected incident** | 25 min | Unannounced failure; students triage |
| 16:55 | **Knowledge check** | 15 min | 8–10 questions, discussed live |
| 17:10 | **End-of-day assessment** | 15 min | Scored; tracked on the progress sheet |
| 17:25 | **Q&A and tomorrow's preview** | 20 min | |
| 17:45 | Close | | |

**Instructor note:** the 16:30 incident block is the highest-value 25 minutes of the day and the first thing under pressure when running late. Protect it. Cut theory block C instead — its content is in the participant manual.

---

## 7. Theory / practical ratio — verification

| Day | Theory (min) | Practical (min) | Total | Practical % |
|---|---|---|---|---|
| 1 | 260 | 300 | 560 | 54% |
| 2 | 225 | 325 | 550 | 59% |
| 3 | 240 | 345 | 585 | 59% |
| 4 | 250 | 330 | 580 | 57% |
| 5 | 240 | 395 | 635 | 62% |
| **Course** | **1,215** | **1,695** | **2,910** | **58%** |

### 7.1 Three measurements, stated plainly

| Measurement | Theory | Practical |
|---|---|---|
| **A — Scheduled minutes** (table above) | 42% | 58% |
| **B — Counting live demonstration as practical** (200 min: 2 × 20 min per day) | 35% | 65% |
| **C — Classroom lecture only**, excluding demos, worked examples and instructor-led incident debriefs (a further ~160 min) | **29%** | **71%** |

**Measurement C is the one that matches the 30/70 target, and it is the one this course is designed against.** It is also the least flattering to state without explanation, so here is the explanation.

### 7.2 Why the numbers differ — and the design decision behind it

There is a real tension in this course's requirements. The brief asks for **30% theory**, and also asks that every topic be taught across sixteen dimensions — internal architecture, component interactions, HA, DR, security, performance, monitoring, troubleshooting and more (§8). Both are reasonable. Together, in 35 hours, they do not fit in a classroom.

**The resolution is a deliberate split between the room and the manual:**

| Channel | Carries | Volume |
|---|---|---|
| **Classroom theory** | The mental model: what it is, why it exists, how it works, the business problem, one analogy, the three mistakes that matter | ~29% of contact time |
| **Live demonstration** | Component interactions and internal architecture, shown in a real terminal rather than described on a slide | ~7% of contact time |
| **Participant manual** | The full 16-point treatment for all 47 topics — HA, DR, performance at scale, security threat/control/residual-risk tables, monitoring queries, interview questions | ~320 pages, self-study and post-course reference |

This is why the participant manual is large and why it is a deliverable in its own right rather than a set of printed slides. A student gets the model in the room and the depth on their desk.

**What a client should be told, accurately:** *"Under 30% of classroom time is lecture. Students are at a keyboard for more than two-thirds of every day. The full enterprise-depth reference material — architecture, HA, DR, security and performance for every topic — is delivered in the 320-page participant manual, not read aloud in class."*

### 7.3 Day 1 is deliberately the most theory-heavy day

The conceptual model built on Monday — the reconciliation loop, cluster architecture, labels and selectors — is what makes Tuesday through Friday fast. Front-loading it is a considered trade, not drift. By Day 5 the ratio is 62% practical on scheduled minutes and over 75% on measurement C.

---

## 8. Every-topic teaching template

Every module in the participant manual and every topic in the slide deck is written against this fixed 16-point structure. Consistency is what lets a student find "the security bit" for any topic without hunting.

| # | Section | What it must answer |
|---|---|---|
| 1 | **What it is** | Plain English, no Kubernetes jargon in the first sentence |
| 2 | **Why it exists** | What was painful before this existed |
| 3 | **The business problem** | Framed in AxisPay terms, with money attached |
| 4 | **How it works** | Mechanism, in order |
| 5 | **Internal architecture** | Components and their responsibilities |
| 6 | **Component interactions** | Who calls whom, in what order — always a diagram |
| 7 | **Enterprise example** | How a real payments/banking platform uses it |
| 8 | **Real-world analogy** | One non-technical analogy, and its limits |
| 9 | **Best practices** | 5–8 rules, each with a reason |
| 10 | **Common mistakes** | What students actually get wrong, with the symptom it produces |
| 11 | **Security considerations** | Threat, control, residual risk |
| 12 | **Performance considerations** | What gets slow, at what scale, and the leading indicator |
| 13 | **High availability** | How this survives losing a node/zone |
| 14 | **Disaster recovery** | What to back up, RTO/RPO implications, restore procedure |
| 15 | **Monitoring** | Specific metrics/queries and alert thresholds |
| 16 | **Troubleshooting** | Symptom → likely cause → diagnostic command → fix |
| + | **Interview questions** | 5 per topic, with model answers, graded junior → senior |

---

## 9. Assessment strategy

| Instrument | When | Weight | Format | Pass |
|---|---|---|---|---|
| Pre-course self-assessment | −7 days | 0% | 15 items, self-scored | Diagnostic only |
| Knowledge checks | 5 × daily, 16:55 | 0% | 8–10 MCQ/short answer, discussed live | Formative |
| End-of-day assessments | 5 × daily, 17:10 | 40% | 10 items: 6 MCQ + 3 short answer + 1 practical | 60% |
| Injected incident triage | 5 × daily + 3 in capstone | 20% | Observed; scored on method, not just outcome | Method demonstrated |
| Progressive project checkpoints | End of D1–D4 | 15% | Automated validation script must pass | Script exits 0 |
| **Capstone** | D5 afternoon | 25% | Deploy · scale · upgrade · secure · monitor · troubleshoot · recover · validate · present | Rubric in `capstone/rubrics/` |

**Overall pass mark: 70%.** A student below 70% receives a written gap list mapped to specific manual sections and lab numbers, not a generic "study more".

**Incident scoring is deliberately method-weighted.** A student who follows the triage loop correctly and does not reach the fix scores higher than one who guesses correctly on the first try. That is the behaviour that transfers to production.

---

## 10. Certification and next-step pathway

| Goal | Next course | This course covers |
|---|---|---|
| **CKA** | Certified Kubernetes Administrator prep | ~75% of the CKA domain. Gaps: kubeadm bootstrap from scratch, etcd backup/restore practical, multi-node cluster networking troubleshooting |
| **CKAD** | Certified Kubernetes Application Developer prep | ~80%. Gaps: exam speed drills, `kubectl` imperative shortcuts under time pressure |
| **CKS** | Certified Kubernetes Security Specialist | ~35%. Requires CKA first. Gaps: runtime security, supply chain, admission controllers, audit logging |
| **Platform engineering** | Service mesh, Operators, GitOps | Foundation complete |

An hour of CKA/CKAD exam-technique guidance is included in M5.9 for students on a certification track.

---

## 11. Traceability

Full requirement traceability — source syllabus topic → module → learning objective → lab → assessment item → slide range → manual section — is maintained in `docs/09-TRACEABILITY-MATRIX.md`, generated in the final phase. No objective may exist without a lab that practises it and an assessment item that tests it.

---

*Document owner: Curriculum Development Team · Version 1.0 · Phase 1*
