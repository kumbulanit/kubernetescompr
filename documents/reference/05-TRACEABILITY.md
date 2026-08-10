# Traceability Matrix

*Every source-syllabus topic, every module, every lab, every assessment item — and where the artefact lives.*

This document exists to answer three questions without anyone having to read the whole repository:

1. **Coverage.** Is every topic in the source syllabus taught somewhere?
2. **Evidence.** For each learning objective, what does a student produce that demonstrates it?
3. **Assessment.** Is anything assessed that was never taught, or taught and never assessed?

---

## 1. Source syllabus → delivered curriculum

The source outline (nobleprog.co.za/cc/kubernetescompr) has eleven sections. All eleven are covered. Nine are expanded.

| # | Source topic | Delivered as | Status |
|---|---|---|---|
| 1 | Introduction to Kubernetes | D1 M1.1 – M1.3 | Expanded — the reconciliation loop is made the spine of the week |
| 2 | Architecture | D1 M1.4 | Expanded — request flow traced end to end |
| 3 | Installation & configuration | Pre-course + D1 M1.2 | Moved — `scripts/setup/` automates it; classroom time is not spent on installers |
| 4 | Core objects (pods, deployments, services) | D1 M1.5 – M1.8 | As specified |
| 5 | Application management | D2 (all) | Expanded — probes, HPA, workload kinds, zero-downtime rollout |
| 6 | Storage & configuration | D3 (all) | Expanded — StatefulSets, StorageClass, securityContext |
| 7 | Cluster management (upgrades, TLS, RBAC) | D5 M5.1, M5.2, M5.7 | Expanded — ServiceAccount tokens and Pod Security Admission added |
| 8 | Networking | D4 (all) | Expanded — NetworkPolicy added; it was absent |
| 9 | Provisioning with Helm | D5 M5.3, M5.4 | Expanded — split into packaging and promotion |
| 10 | Troubleshooting | D1 M1.9 + seven incident windows + capstone | Fundamentally upgraded — a method, not a symptom table |
| 11 | Summary & next steps | D5 M5.9 | Retained, plus an honest list of what was not covered |

### Gaps closed against the source outline

| Gap | Where it is now taught | Where it is assessed |
|---|---|---|
| G1 Health probes | D2 M2.3 | L2.3, INC-2, D2 assessment A3/B2 |
| G2 Troubleshooting method | D1 M1.9, applied all week | Every incident window; capstone §3 |
| G3 Observability | D5 M5.5, M5.6 | L5.5, L5.6, D5 assessment A5/A6/B3 |
| G4 NetworkPolicy | D4 M4.5 | L4.4, INC-4c, capstone INC-6 |
| G5 Pod Security / securityContext | D3 M3.7, D5 M5.1 | L3.7, L5.1, D5 assessment A2 |
| G6 Declarative model | D1 M1.3 | Every lab; D1 assessment B1 |
| G7 Autoscaling | D2 M2.4 | L2.4, capstone competency 2 |
| G8 Disruption budgets, graceful shutdown | D2 M2.6, D4 M4.7 | L2.6, L4.6, capstone phase 2 |
| G9 Environment promotion | D5 M5.4 | L5.4 |
| G10 Init containers | D3 M3.6, capstone migration Job | L3.6; capstone phase 2 |
| G11 ResourceQuota, LimitRange | D2 M2.2 | L2.2 |

---

## 2. Module → lab → validation → assessment

Every module produces something a student can run, and every lab has a machine-checkable end state.

### Day 1 — Deploy it

| Module | Lab | Validator | Manifests | Assessed by |
|---|---|---|---|---|
| M1.1–M1.4 orientation, architecture | L1.1 cluster recon | `validate-lab-L1.1.sh` | — | D1 A1, A2 |
| M1.5 namespaces | L1.2 namespaces | `validate-lab-L1.2.sh` | `manifests/00-namespaces/` | D1 A3 |
| M1.6 pods | L1.3 first pod | `validate-lab-L1.3.sh` | `manifests/day1/pods/` | D1 B1 |
| M1.7 deployments | L1.4 deployments | `validate-lab-L1.4.sh` | `manifests/day1/deployments/` | D1 A4, B2 |
| M1.8 services | L1.5 services | `validate-lab-L1.5.sh` | `manifests/day1/services/` | D1 A5, C1 |
| M1.9 triage loop | L1.6 + **INC-1** | `validate-lab-L1.6.sh`, `checkpoint-day1.sh` | — | Incident rubric |

### Day 2 — Keep it up

| Module | Lab | Validator | Manifests | Assessed by |
|---|---|---|---|---|
| M2.1 requests and limits | L2.1 resources | `validate-lab-L2.1.sh` | `day2/resources/` | D2 A1, A2 |
| M2.2 quota and LimitRange | L2.2 | `validate-lab-L2.2.sh` | `day2/resources/` | D2 A3 |
| M2.3 probes | L2.3 probes | `validate-lab-L2.3.sh` | `day2/probes/` | D2 A4, B1 |
| M2.4 autoscaling | L2.4 | `validate-lab-L2.4.sh` | `day2/autoscaling/` | D2 B2 |
| M2.5 workload kinds | L2.5 | `validate-lab-L2.5.sh` | `day2/workloads/` | D2 A5 |
| M2.6 rollout and shutdown | L2.6 + **INC-2** | `validate-lab-L2.6.sh`, `checkpoint-day2.sh` | `day2/deployments/` | D2 C1; incident rubric |

### Day 3 — Give it memory

| Module | Lab | Validator | Manifests | Assessed by |
|---|---|---|---|---|
| M3.1 ConfigMaps | L3.1 | `validate-lab-L3.1.sh` | `day3/config/` | D3 A1, B1 |
| M3.2 Secrets | L3.2 | `validate-lab-L3.2.sh` | `day3/config/` | D3 A2 |
| M3.3 volumes, PV/PVC | L3.3 | `validate-lab-L3.3.sh` | `day3/storage/` | D3 A3 |
| M3.4 StorageClass | L3.4 | `validate-lab-L3.4.sh` | `day3/storage/` | D3 A4 |
| M3.5 the data tier | L3.5 | `validate-lab-L3.5.sh` | `day3/data/` | D3 C1 |
| M3.6 StatefulSets | L3.6 | `validate-lab-L3.6.sh` | `day3/data/` | D3 A5, B2 |
| M3.7 securityContext | L3.7 + **INC-3** | `validate-lab-L3.7.sh`, `checkpoint-day3.sh` | `day3/` | D3 B3; incident rubric |

### Day 4 — Let the world in

| Module | Lab | Validator | Manifests | Assessed by |
|---|---|---|---|---|
| M4.1 the network model | L4.1 service types | `validate-lab-L4.1.sh` | `day4/services/` | D4 A1 |
| M4.2 DNS | L4.2 | `validate-lab-L4.2.sh` | — | D4 A2 |
| M4.3–M4.4 Ingress and TLS | L4.3 | `validate-lab-L4.3.sh` | `day4/ingress/` | D4 A3, A6 |
| M4.5 NetworkPolicy | L4.4 | `validate-lab-L4.4.sh`, `simulate-netpol.py` | `day4/netpol/` | D4 B1, B2, C1 |
| M4.6 placement | L4.5 | `validate-lab-L4.5.sh` | `day4/placement/` | D4 A4 |
| M4.7 PDB and drain | L4.6 + **INC-4** | `validate-lab-L4.6.sh`, `checkpoint-day4.sh` | `day4/placement/` | D4 A5, B3; incident rubric |

### Day 5 — Run it

| Module | Lab | Validator | Manifests | Assessed by |
|---|---|---|---|---|
| M5.1 identity and Pod Security | L5.1 | `validate-lab-L5.1.sh` | `day5/rbac/01-`, `day5/security/` | D5 A1, A2, C1 |
| M5.2 RBAC | L5.2 | `validate-lab-L5.2.sh`, `simulate-rbac.py` | `day5/rbac/02-`, `03-` | D5 A3, B1, C1 |
| M5.3 Helm packaging | L5.3 | `validate-lab-L5.3.sh`, `check-helm-chart.py` | `charts/axispay/` | D5 A4, B2 |
| M5.4 promotion | L5.4 | `validate-lab-L5.4.sh` | `charts/axispay/values-*.yaml` | D5 B2 |
| M5.5 metrics and dashboards | L5.5 | `validate-lab-L5.5.sh`, `check-promql.py` | `day5/observability/01-`, `02-`, `04-` | D5 A5, B3 |
| M5.6 logs and alerting | L5.6 | `validate-lab-L5.6.sh` | `day5/observability/03-`, `05-`, `06-` | D5 A6 |
| M5.7 cluster upgrades | *demo only — see note* | — | — | Final exam Q14 |
| M5.8 CAPSTONE | `capstone/` | `capstone-validate.sh` | `capstone/manifests/` | Capstone rubric, 25% |
| M5.9 close | — | — | — | Final exam |

> **Note on M5.7.** Cluster upgrades are taught as theory plus a demonstration, not as a lab. Upgrading the Minikube cluster mid-course would end the course, and a simulated upgrade teaches the commands without the constraint that actually matters. What students *do* practise is the operation where the risk lives — `kubectl drain` under a PodDisruptionBudget — which they did in L4.6 and again in the capstone. This is a deliberate scope decision and the manual says so.

---

## 3. The nine capstone competencies → where each was taught

The capstone assesses nine competencies. None is assessed without having been taught and practised first.

| # | Competency | First taught | Practised in | Assessed in |
|---|---|---|---|---|
| 1 | Deploy | D1 M1.7 | L1.4, L1.6, L5.3 | Capstone phase 2 |
| 2 | Scale | D2 M2.4 | L2.4 | Capstone phase 3 (INC-5) |
| 3 | Upgrade | D2 M2.6 | L2.6, L5.3 | Capstone phase 2 |
| 4 | Secure | D3 M3.7, D4 M4.5, D5 M5.1–M5.2 | L3.7, L4.4, L5.1, L5.2 | Capstone phase 3 (INC-6) |
| 5 | Monitor | D5 M5.5–M5.6 | L5.5, L5.6 | Capstone throughout |
| 6 | Troubleshoot | D1 M1.9 | INC-1 … INC-4 | Capstone phase 3 |
| 7 | Recover | D2 M2.6 | INC-2, INC-3, INC-4 | Capstone phase 4 |
| 8 | Validate | D1 M1.9 | every `make validate-lab` | Capstone phase 4 |
| 9 | Present | D3 (first incident record) | INC-3, INC-4 records | Capstone phase 5 |

---

## 4. Incident coverage

Ten faults across seven windows. All ten scenarios requested in the course specification are covered.

| Requested scenario | Delivered as | Day |
|---|---|---|
| Payment Service CrashLoopBackOff | INC-2 (OOMKilled → CrashLoop) | 2 |
| Settlement database unavailable | INC-6 (NetworkPolicy blocks async → data) | Capstone |
| Incorrect ConfigMap | INC-3b (key renamed) | 3 |
| Expired certificate | INC-7 | Capstone |
| ImagePullBackOff | INC-1 | 1 |
| Redis unavailable | INC-5 | Capstone |
| Ingress misconfiguration | INC-4a (`pathType: Exact`, wrong port) | 4 |
| DNS failures | INC-4b (CoreDNS Corefile) | 4 |
| Storage failures | INC-3a (unbindable PVC) | 3 |
| Network policy issues | INC-4c (over-broad podSelector) | 4 |

---

## 5. What is assessed but taught only once

Reviewed deliberately — these are the items with a single teaching moment, and they are the ones to protect when running late.

| Item | Taught | Assessed | Risk if cut |
|---|---|---|---|
| `403` means the credential authenticated | D5 M5.1 demo | D5 A1 | High — the demo is the whole point |
| PSA evaluates on create/update only | D5 M5.1 slide | D5 A2 | High — nothing else covers it |
| Immutable selector | D5 M5.3, L5.3 step 7 | D5 A4 | Medium — the slide carries it if the lab is cut |
| Missing versus down target | D5 M5.5, L5.5 step 2 | D5 A5 | High — this is the most common real ticket |
| Alerting on absence of traffic | D5 M5.5 | D5 B3 | High — protect this one |

---

## 6. Regenerating the counts in this document

```bash
python3 scripts/validate/check-manifests.py     # manifest wiring
python3 scripts/validate/check-helm-chart.py    # chart assertions
python3 scripts/validate/check-promql.py        # every PromQL expression
python3 scripts/validate/check-diagrams.py      # every Mermaid source
python3 scripts/validate/simulate-netpol.py     # policy logic
python3 scripts/validate/simulate-rbac.py       # RBAC grants
bash    scripts/validate/verify-course.sh       # all of the above, plus inventory
```

`verify-course.sh` prints the inventory this document quotes. If a number here disagrees with that script, the script is right.
