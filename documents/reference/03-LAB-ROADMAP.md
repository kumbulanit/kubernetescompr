# Lab Roadmap & Incident Schedule

**31 labs · 10 injected faults across 7 incident windows · 1 capstone · one platform.**

There are no throwaway labs in this course. Lab 1.2 creates the namespaces that Lab 5.4 promotes between. The PodDisruptionBudget written in Lab 4.6 is what makes the capstone upgrade survive. A student who skips a lab does not miss a topic — they miss a component, and they will notice on Friday.

---

## 1. Practical anatomy

**Every practical is a folder**, not a file:

```
labs/day3/L3.5-data-tier/
├── README.md        the lab — every step, every command, what you should see
└── manifests/       the YAML that lab applies, right there
```

The student opens the folder and never leaves it. The YAML is a copy of the
canonical version in `manifests/`, which is what `make deploy-dayN` applies;
`make verify` compares them byte for byte, so the copy is always the real thing.

### The written structure

Written for someone **new to Kubernetes** who can use a terminal, on **Ubuntu**.
Every `kubectl` flag is explained the first time it appears, every YAML field is
annotated, and expected output is shown *before* the command is run.

| # | Section | Contains |
|---|---|---|
| 1 | **Header table** | Time · difficulty · what you need first · what you will create · how to check |
| 2 | **First time in a terminal?** | Collapsible primer — copy/paste, <kbd>Ctrl</kbd>+<kbd>C</kbd>, `pwd`. Experienced students collapse it in one click |
| 3 | **What you are going to do** | Plain language. The point of the lab, and the surprise in it |
| 4 | **What you need before you start** | Numbered checks with the exact command and the exact expected output |
| 5 | **What is in this folder** | Every file, and what it is for |
| 6 | **Steps** | Each one: **why we are doing this** → **run this** → **what you should see** → **what that means** → what to do if it differs |
| 7 | **Did it work?** | The automated validator in `scripts/validate/` |
| 8 | **Clean up** | Usually very little — the platform persists |
| 9 | **If something went wrong** | Symptom → cause → command, for the failures we actually see |
| 10 | **Try this yourself** | Unassisted extension. Goal and acceptance test, no commands |
| 11 | **What you built** | Ties the artefact to the running platform, and names what is next |

**Design rule:** every step explains *why* before *what*. `kubectl apply -f x.yaml`
with no explanation trains typists, not engineers.

**Enforced**, not merely intended: `scripts/validate/verify-course.sh` §5a fails
the build if any practical is missing the first-time box, the "what you are going
to do" section, the folder-contents table, the troubleshooting table, or the link
back to `labs/GETTING-STARTED.md`.

### The two exceptions, and why

- **L1.6** and the **incident labs** give *tasks* with collapsible hints rather
  than step-by-step commands. Full hand-holding would defeat their purpose, which
  is to find out whether the method has landed. Help is available; it is not forced.
- **Later practicals are shorter.** Day 1 averages 460 lines, Day 5 about 265. By
  Wednesday a student knows what `-o wide` does, and re-explaining it is noise.

---

## 2. Day 1 — Foundations and First Deployment

**End state:** 3 namespaces, 4 Deployments, 4 Services. A merchant can call `/api/v1/payments` inside the cluster and get a payment back. No persistence yet — that is Wednesday's problem, and students should feel its absence.

| Lab | Title | Type | Min | Builds | Validates |
|---|---|---|---|---|---|
| **L1.1** | Cluster reconnaissance | Guided | 30 | — | Student can name every control-plane component in *their own* cluster and explain what it does |
| **L1.2** | Namespace design for a segmented estate | Guided | 30 | `axispay-edge`, `axispay-core`, `axispay-async` + labels | Namespaces exist with correct `zone`, `pci-scope`, `tier` labels |
| **L1.3** | The first Pod — payment-service, raw | Guided | 40 | Bare `payment-service` Pod | Pod Running; `/api/v1/_info` reachable via port-forward; student can exec, log, describe |
| **L1.4** | From Pod to Deployment | Guided | 55 | `payment-service` Deployment, 3 replicas | Killing a pod triggers replacement in < 10 s; `ownerReferences` traced Pod → RS → Deployment |
| **L1.5** | Services and stable identity | Guided | 40 | `payment-service` ClusterIP | 20 curls hit ≥ 2 distinct pods (proved via `_info.pod_name`) |
| **L1.6** | Four services, one platform | Independent | 55 | `edge-gateway`, `auth-service`, `merchant-service` + Services | End-to-end: gateway → auth → merchant → payment returns 201 |
| **INC-1** | *Injected incident* | Incident | 35 | — | `ImagePullBackOff` diagnosed and fixed unaided |

### L1.3 — why a bare Pod first

Students are shown the wrong way on purpose. They create a bare Pod, then delete it, and watch nothing happen. Ten minutes later they create a Deployment, delete a pod, and watch it come back. The contrast is the lesson — and it is far more durable than being told "always use a Deployment."

### Day 1 challenges

| Lab | Challenge |
|---|---|
| L1.2 | Add a fourth namespace `axispay-data` with correct labels, without looking at L1.2's YAML |
| L1.4 | Make the Deployment survive deletion of *two* pods simultaneously and explain the recovery timeline |
| L1.5 | Prove, using only `kubectl`, which pods are behind the Service — then break it by editing one pod's labels and explain what happened to Endpoints |
| L1.6 | Add `customer-service` to the platform from scratch — manifest, Service, wiring — with no template provided |

---

## 3. Day 2 — Reliability, Resource Governance and Controlled Change

**End state:** every workload has correct requests, limits and probes. HPA scales `payment-service` under real load. A DaemonSet, a Job and a CronJob are running. A rolling update completes with **zero dropped payments**, proven by the load generator.

| Lab | Title | Type | Min | Builds | Validates |
|---|---|---|---|---|---|
| **L2.1** | Requests, limits and QoS classes | Guided | 45 | Resources on all 4 Day-1 services | All three QoS classes observed and explained; throttling demonstrated with `kubectl top` |
| **L2.2** | Namespace governance: ResourceQuota & LimitRange | Guided | 30 | Quota + LimitRange on `axispay-core` | A deliberately oversized Deployment is *rejected*, and the student reads the rejection message correctly |
| **L2.3** | Probes that tell the truth | Guided | 50 | Liveness/readiness/startup on all services | Readiness gates traffic — pod removed from Endpoints while dependency is down, restored when it returns |
| **L2.4** | Autoscaling under merchant load | Guided | 55 | metrics-server, HPA on `payment-service`, `loadgen` | HPA scales 2 → 6 under load and back down after stabilisation window |
| **L2.5** | The other three controllers | Independent | 45 | `node-agent` DaemonSet, `recon-worker` Job, `settlement-cron` CronJob | One node-agent per node; Job completes; CronJob fires on a shortened schedule |
| **L2.6** | Zero-downtime release under live traffic | Guided | 55 | v1.0.0 → v1.1.0 rollout + rollback | **Zero non-2xx responses** across the rollout, measured by loadgen; rollback restores v1.0.0 |
| **INC-2** | *Injected incident* | Incident | 60 | — | `CrashLoopBackOff` root-caused to an OOMKill (not a probe failure) and fixed |

### L2.6 — the load-generator proof

`loadgen` runs at 40 requests/second against `edge-gateway` for the whole rollout and prints a live tally. Students watch the counter and see zero failures. Then the instructor removes the readiness probe and reruns it — and the counter shows failures. **This single before/after is the most persuasive five minutes of the week**, and it is why probes are taught before rollouts.

### Day 2 challenges

| Lab | Challenge |
|---|---|
| L2.1 | Given `kubectl top` output for `fraud-service`, derive correct requests and limits and justify the headroom |
| L2.3 | Write a readiness probe for `payment-service` that reports not-ready when PostgreSQL is unreachable but stays *alive* — and explain why liveness must not check the database |
| L2.4 | Explain why HPA does not scale when `requests` are absent, then prove it empirically |
| L2.6 | Achieve a zero-downtime rollout with `maxUnavailable: 0` and only 2 replicas — and explain the scheduling cost |

---

## 4. Day 3 — State, Configuration and Data

**End state:** PostgreSQL, Redis and RabbitMQ running as StatefulSets with persistent storage. Schema applied, 5,000 seeded transactions queryable. All configuration externalised. All services non-root with read-only root filesystems.

| Lab | Title | Type | Min | Builds | Validates |
|---|---|---|---|---|---|
| **L3.1** | Externalising configuration | Guided | 40 | ConfigMaps for all services | Env-var config requires restart; volume config updates in place — both demonstrated |
| **L3.2** | Secrets, honestly | Guided | 40 | Secrets for DB, MQ, JWT key | Student decodes a Secret with `base64 -d` and articulates why that is not a bug but a design boundary |
| **L3.3** | PersistentVolumes and Claims | Guided | 30 | Static PV + PVC for ledger archive | Claim binds; data survives pod deletion; unbindable claim diagnosed |
| **L3.4** | Dynamic provisioning and StorageClasses | Guided | 35 | StorageClass + dynamic PVCs | PVC provisions automatically; `WaitForFirstConsumer` behaviour observed on a multi-node cluster |
| **L3.5** | The data tier | Guided | 60 | PostgreSQL, Redis, RabbitMQ + schema + seed | 25 merchants, 5,000 payments, 10,400 ledger entries queryable; ledger balances to zero |
| **L3.6** | StatefulSets and ordered startup | Guided | 50 | Convert data tier to StatefulSets; init containers for migration | `postgres-0` keeps its identity and its data across deletion; migrations run exactly once before services start |
| **L3.7** | Hardening: non-root, read-only, no capabilities | Independent | 30 | securityContext on all workloads | Every pod runs as UID 10001 with a read-only root filesystem; `fsGroup` resolves the volume-permission error |
| **INC-3** | *Injected incident* | Incident | 60 | — | Pod `Pending` on unbound PVC **and** a service broken by a misspelled ConfigMap key — two failures, one window |

### L3.5 — the ledger proof

The seed data is generated so that `SELECT SUM(CASE WHEN direction='DR' THEN amount_minor ELSE -amount_minor END) FROM ledger_entries;` returns exactly `0`. Students run it themselves. A double-entry ledger that balances is a satisfying thing to see, and it makes the data feel real rather than decorative — which is the point of using a payments domain at all.

### L3.6 — the multi-node storage trap, taught deliberately

On a multi-node Minikube, the default provisioner is node-local. Students delete `postgres-0` and, if it reschedules to another node, it comes up **empty**. This is not a bug in the lab — it is the single most important storage lesson in the course, and it is scripted, expected, and then solved with node affinity on the PV. Instructors are briefed not to "rescue" students from it too quickly.

### Day 3 challenges

| Lab | Challenge |
|---|---|
| L3.1 | Make `fraud-service` pick up a changed risk threshold **without** a restart, then explain the propagation delay and where it comes from |
| L3.2 | List every way a Secret can leak in a default cluster; propose a control for each |
| L3.4 | Explain what `WaitForFirstConsumer` prevents, then construct the failure it prevents by using `Immediate` |
| L3.6 | Scale PostgreSQL to 3 replicas and explain why that does **not** give you a working database cluster |

---

## 5. Day 4 — Networking, Exposure and Placement

**End state:** merchants reach AxisPay through an Ingress over TLS. Zero-trust NetworkPolicy protects the cardholder data environment. Payment replicas are spread across nodes. PodDisruptionBudgets are in place — and a node can be drained without an outage.

| Lab | Title | Type | Min | Builds | Validates |
|---|---|---|---|---|---|
| **L4.1** | Packet forensics: pod-to-pod | Guided | 35 | — | Student traces a packet across nodes and states the four networking rules from evidence, not memory |
| **L4.2** | The full Service taxonomy | Guided | 30 | NodePort, headless, ExternalName variants | Each type demonstrated and correctly chosen for a given requirement; EndpointSlice inspected |
| **L4.3** | DNS forensics | Guided | 30 | — | FQDN forms resolved from a pod; `ndots` cost measured; a broken CoreDNS diagnosed |
| **L4.4** | Ingress and TLS at the edge | Guided | 55 | Ingress + TLS Secret + host routing | `https://api.axispay.local` reaches `edge-gateway`; path routing to `reporting-service` works; TLS terminates |
| **L4.5** | Zero-trust segmentation | Guided | 50 | 9 NetworkPolicies | Edge **cannot** reach the data tier; core **can**; DNS egress explicitly permitted; enforcement proved by test pod |
| **L4.6** | Placement, spread and disruption budgets | Independent | 70 | Affinity, anti-affinity, topology spread, taints, PDBs | `payment-service` replicas on distinct nodes; a node drains with **zero** payment errors |
| **INC-4** | *Injected incident* | Incident | 55 | — | Three simultaneous faults: a broken Ingress path, a Service selector typo, and an over-broad NetworkPolicy |

### L4.5 — the DNS egress trap

Students write default-deny in `axispay-core`, then everything breaks — including calls they explicitly allowed. The cause is that name resolution to CoreDNS in `kube-system` is itself egress traffic. Because DNS was taught properly in L4.3, students can *derive* the fix rather than copy it. This ordering is deliberate and is documented in the dependency map (§7, V1).

### L4.6 — Thursday protects Friday

The PDBs written here are the reason the capstone's rolling node drain does not take AxisPay down on Friday afternoon. The instructor says this out loud when the lab is set. It is the clearest illustration in the course that Kubernetes objects are cumulative infrastructure, not exercises.

### Day 4 challenges

| Lab | Challenge |
|---|---|
| L4.2 | A Service has an IP but no endpoints. Find the cause in under three minutes using only `kubectl`. |
| L4.4 | Add a second Ingress host for the merchant portal with its own TLS certificate and a rate-limit annotation |
| L4.5 | Write the *minimum* policy set that lets `reporting-service` read PostgreSQL and nothing else. Prove nothing else got through. |
| L4.6 | Drain the busiest node during live load and keep the payment error rate at zero. Report exactly which objects made that possible. |

---

## 6. Day 5 — Security, Packaging, Observability, Production Ops

**End state:** RBAC enforced, platform packaged as a Helm chart, full observability stack running, and the whole thing upgraded under live traffic while three unannounced incidents are injected.

| Lab | Title | Type | Min | Builds | Validates |
|---|---|---|---|---|---|
| **L5.1** | Identity: ServiceAccounts and Pod Security | Guided | 30 | Per-service ServiceAccounts, PSA labels | No workload uses `default`; `restricted` PSA enforced on `axispay-core`; a privileged pod is rejected |
| **L5.2** | RBAC least privilege | Guided | 50 | `axispay-auditor`, `axispay-deployer`, `prometheus` roles | Auditor can read and cannot write; deployer is namespace-scoped; all proved with `auth can-i` |
| **L5.3** | Packaging AxisPay as a Helm chart | Guided | 60 | `charts/axispay` with subcharts | `helm install` reproduces the entire platform from zero in one command |
| **L5.4** | Promotion: dev → staging → prod | Guided | 30 | `values-dev/staging/prod.yaml` | Same chart, three environments, different replica counts, resources and log levels |
| **L5.5** | Metrics and dashboards | Guided | 55 | Prometheus + Grafana + AxisPay dashboard | Golden signals visible; approval rate, p99 latency and payment volume all live |
| **L5.6** | Logs and alerts | Guided | 45 | Loki + Alloy + Alertmanager | A payment error is traced from a Grafana spike to the exact log line by correlation ID; a SEV-1 alert fires and routes |
| **CAPSTONE** | Production upgrade under fire | Assessed | 110 | — | See §8 |

### L5.6 — the correlation-ID payoff

The `X-Correlation-Id` injected by `edge-gateway` on Day 1 — which students implemented without knowing why — is what makes it possible on Friday to take a latency spike in Grafana, click through to Loki, and find every log line from all seven services for that one payment. The callback to Monday is explicit and lands hard.

### Day 5 challenges

| Lab | Challenge |
|---|---|
| L5.2 | Design RBAC for an external auditor who may read `axispay-core` but must **never** read Secrets. Prove the Secret restriction holds. |
| L5.3 | Add `customer-service` to the chart as a subchart with its own values and a dependency condition |
| L5.5 | Write a PromQL query for payment approval rate per acquirer over 5 minutes, and alert when any acquirer drops below 85% |
| L5.6 | Given only a merchant's payment reference, produce the complete cross-service log trail |

---

## 7. Incident catalogue

**Ten injected faults, delivered in seven incident windows.** Days 3, 4 and 5 present multiple simultaneous faults in a single window, because real incidents rarely arrive one at a time and prioritisation is itself a skill. All ten scenarios requested for this course are covered.

| ID | Day | Time | Fault injected | Presenting symptom | Root cause | Skills tested | Min |
|---|---|---|---|---|---|---|---|
| **INC-1** | 1 | 16:30 | Image tag changed to `1.0.0-rc9` (does not exist) | `payment-service` pods `ImagePullBackOff`; gateway returns 503 | Non-existent image tag | Events, `describe`, image policy, triage steps 1–3 | 35 |
| **INC-2** | 2 | 16:30 | Memory limit cut to 48 Mi | `payment-service` `CrashLoopBackOff`, restart count climbing | OOMKilled — `reason: OOMKilled`, exit 137 | `logs --previous`, `describe` last state, distinguishing OOMKill from probe failure | 60 |
| **INC-3a** | 3 | 16:20 | PVC requests a non-existent StorageClass | `postgres-0` stuck `Pending` | Unbindable claim | PVC/PV binding, `describe pvc`, scheduler events | 30 |
| **INC-3b** | 3 | 16:20 | ConfigMap key renamed `DB_HOST` → `DB_HOSTNAME` | `ledger-service` not ready; readiness failing | Config key mismatch — app reads a missing variable | ConfigMap→env mapping, readiness semantics, `exec env` | 30 |
| **INC-4a** | 4 | 16:25 | Ingress `pathType` changed to `Exact`; backend port wrong | 404 from the merchant API | Ingress path and port misconfiguration | Ingress controller logs, `describe ingress`, backend resolution | 20 |
| **INC-4b** | 4 | 16:25 | CoreDNS Corefile broken | Intermittent name-resolution failures across services | DNS outage | CoreDNS logs, `nslookup` in-pod, `resolv.conf` | 15 |
| **INC-4c** | 4 | 16:25 | NetworkPolicy podSelector too broad | `fraud-service` traffic blackholed, no errors in either log | Over-broad policy silently dropping traffic | Policy evaluation, connectivity testing, "no logs" reasoning | 20 |
| **INC-5** | 5 | Capstone | Redis scaled to 0 | `fraud-service` degrades; latency SLO breached; approval rate falls | Cache dependency unavailable | Dependency mapping, graceful degradation, readiness design | 25 |
| **INC-6** | 5 | Capstone | PostgreSQL NetworkPolicy blocks `axispay-async` | Settlement fails; nightly batch does not run; audit backs up in RabbitMQ | Settlement database unreachable | Multi-namespace policy debugging, queue depth as a signal | 25 |
| **INC-7** | 5 | Capstone | Ingress TLS Secret replaced with an expired certificate | Merchant integrations fail TLS handshake; browsers warn | Expired certificate | TLS inspection, `openssl s_client`, Secret rotation, cert lifecycle | 20 |

### 7.1 How incidents are run

1. **Injection.** The instructor runs `scripts/incidents/inject-INC-N.sh` — silently, ideally during a break. Students are not told which incident, only that something is wrong.
2. **Report.** Students receive a realistic ticket, not a hint:
   > *"SEV-2 — Merchant `MER_7QK2XD9P4A` reports payment API returning errors since 16:28. Approval rate down 40%. Two other merchants have confirmed. Ops on call needs an update in 15 minutes."*
3. **Triage.** Students apply the 6-step loop. The instructor answers questions about *tools*, never about *causes*.
4. **Resolution.** Fix, then **verify** with the validation script. A fix without verification does not count.
5. **Debrief (10 min).** Not "what was the answer" but: *What was your first command, and why? What did you rule out? What would have caught this before a merchant did?* The last question is the one that turns a lab into an engineer.
6. **Written record.** From INC-3 onward, students complete a one-page blameless incident record (`documents/assessments/`). This is graded on method.

### 7.2 Incident scoring rubric

| Band | Criterion |
|---|---|
| 4 — Exemplary | Systematic triage, correct root cause, verified fix, identified the missing alert that would have detected it first |
| 3 — Proficient | Systematic triage, correct root cause, verified fix |
| 2 — Developing | Reached the fix, but by guessing or pattern-matching rather than by method |
| 1 — Beginning | Required significant guidance to progress |

**A student who follows the method and does not finish scores higher than one who guesses correctly.** This is stated to the class before INC-1 and is not negotiable — it is the behaviour that transfers to a real on-call rotation.

---

## 8. Capstone — "Production Upgrade Under Fire"

**Duration:** 110 minutes · **Weight:** 25% · **Format:** individual, instructor-observed

### 8.1 The brief given to students

> **AxisPay Change Request CR-2026-0814 — Approved**
>
> Platform version 1.1.0 must be upgraded to 2.0.0 tonight. The change window is 110 minutes. Merchant traffic continues throughout — there is no maintenance window; payments do not stop.
>
> **Release 2.0.0 contains:** a new fraud scoring model, a settlement schema migration, an increased connection pool in `payment-service`, and a new reporting endpoint.
>
> **Contractual constraints, non-negotiable:**
> - Payment API availability must not drop below **99.5%** during the window
> - p99 authorisation latency must stay under **300 ms**
> - **Zero** payments may be lost or double-processed
> - The ledger must balance to zero at the end
> - Every action must be auditable
>
> You are the engineer on point. You have Grafana. You have the runbook you wrote this week. Go.

### 8.2 Phases

| Phase | Min | Task | Assessed on |
|---|---|---|---|
| **1 · Pre-flight** | 15 | Verify platform health; confirm PDBs, probes and HPAs; record a baseline; write the rollback plan | Does the student check *before* changing? |
| **2 · Upgrade** | 25 | `helm upgrade` to 2.0.0 with `--atomic`; run the settlement migration as a Job; watch the rollout | Correct use of Helm; migration ordering; monitoring during, not after |
| **3 · Incident wave** | 40 | INC-5, INC-6 and INC-7 injected without warning, ~12 minutes apart | Triage under pressure; prioritisation; not making it worse |
| **4 · Recovery & validation** | 20 | Restore full service; run `scripts/validate/capstone-validate.sh`; confirm the ledger balances | Verification discipline |
| **5 · Presentation** | 10 | 5-minute incident report to the "AxisPay change board" (the class) | Communication under scrutiny |

### 8.3 The nine required competencies

Explicitly mapped, because these are the outcomes the course is sold on.

| # | Competency | Where it is exercised | Evidence |
|---|---|---|---|
| 1 | **Deploy** | Phase 2 — Helm upgrade | Release 2.0.0 `deployed` |
| 2 | **Scale** | Phase 3 — HPA response during INC-5 | Replica count reacts to load |
| 3 | **Upgrade** | Phase 2 — chart + schema migration | All Deployments on 2.0.0; migration Job succeeded once |
| 4 | **Secure** | Phase 3 — INC-7 certificate rotation | TLS valid; NetworkPolicies intact; no policy weakened to "fix" INC-6 |
| 5 | **Monitor** | Throughout — Grafana and Alertmanager | Student detects at least two of three incidents from dashboards *before* the ticket arrives |
| 6 | **Troubleshoot** | Phase 3 | All three root causes correctly identified |
| 7 | **Recover** | Phase 4 | All services Ready; queue depth drained to zero |
| 8 | **Validate** | Phase 4 | `capstone-validate.sh` exits 0; ledger sums to zero |
| 9 | **Present** | Phase 5 | Timeline, root causes, impact, and two concrete preventive actions |

### 8.4 The trap in phase 3

INC-6 blocks `axispay-async` from reaching PostgreSQL via a NetworkPolicy change. **The fastest fix is to delete the NetworkPolicy.** It works instantly and it is wrong — it removes the cardholder-data segmentation the student built on Thursday to satisfy a control they were told was contractual.

Students who take that route lose the "Secure" competency and are asked one question in the debrief: *"You are in a PCI audit next week. Talk me through this change."*

This is the most valuable moment of the entire course. It is where students learn that in a regulated environment, the fastest fix and the correct fix are frequently different — and that knowing the difference is the job.

### 8.5 Scoring

| Component | Weight |
|---|---|
| Upgrade executed correctly | 20% |
| SLOs maintained (availability + latency) | 20% |
| Three incidents root-caused | 25% |
| Validation passes; ledger balances | 15% |
| Security posture preserved | 10% |
| Presentation quality | 10% |

**Pass: 70%.** Full rubric with band descriptors: `documents/instructor/capstone-rubric.md`.

---

## 9. Validation and automation

Every lab has an automated validation script. No lab is "complete" on the student's word.

| Script | Purpose |
|---|---|
| `scripts/validate/validate-lab-<id>.sh` | Per-lab acceptance test — exits 0, or prints exactly what is missing and which manifest to check |
| `scripts/validate/checkpoint-day<N>.sh` | Rebuilds a full day end-state from manifests in under 5 minutes |
| `scripts/validate/platform-health.sh` | Full-platform health: pods, endpoints, PVCs, policies, queue depth, ledger balance |
| `scripts/validate/capstone-validate.sh` | The nine capstone competencies, checked mechanically |
| `scripts/incidents/inject-INC-<n>.sh` | Injects a fault |
| `scripts/incidents/resolve-INC-<n>.sh` | Instructor escape hatch — restores state if a student is stuck past the time box |

Validation output is written to be *useful when it fails*:

```
✗ L4.5 FAILED — 2 checks did not pass

  [FAIL] NetworkPolicy 'deny-all-ingress' not found in namespace axispay-core
         → expected: manifests/day4/netpol/01-default-deny.yaml
         → check:    kubectl get netpol -n axispay-core

  [FAIL] edge-gateway CAN reach postgres:5432 (it must not)
         → this means an egress policy is missing or too permissive
         → check:    kubectl describe netpol -n axispay-data

  4 of 6 checks passed. See labs/day4/L4.5-network-policy/ §9.
```

A validation script that prints `FAILED` and nothing else teaches nothing. Every failure here names the expected artefact, the diagnostic command, and the manual section.

---

## 10. Roadmap summary

| Day | Labs | Guided | Independent | Faults injected | Practical min | New objects |
|---|---|---|---|---|---|---|
| 1 | 6 | 5 | 1 | 1 | 300 | Namespace, Pod, ReplicaSet, Deployment, Service |
| 2 | 6 | 5 | 1 | 1 | 325 | Resources, Quota, LimitRange, probes, HPA, DaemonSet, Job, CronJob |
| 3 | 7 | 6 | 1 | 2 | 345 | ConfigMap, Secret, PV, PVC, StorageClass, StatefulSet, securityContext |
| 4 | 6 | 5 | 1 | 3 | 330 | NodePort, headless, Ingress, NetworkPolicy, affinity, taints, PDB |
| 5 | 6 | 6 | — | 3 | 395 | ServiceAccount, PSA, Role, RoleBinding, Helm release, ServiceMonitor |
| **Total** | **31** | **27** | **4** | **10** | **1,695** | **26 object kinds** |

Plus **1 capstone** (110 min, Day 5, assessed) which is counted in the Day 5 practical minutes above.

---

*Document owner: Lab Developer + Senior SRE · Version 1.0 · Phase 1*
