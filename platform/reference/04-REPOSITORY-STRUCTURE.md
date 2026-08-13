# Repository Structure

**Repository:** `kubernetes`
**Purpose:** the complete, self-contained delivery kit for the 5-day *Kubernetes Comprehensive* course. An instructor clones it, runs one script, and teaches.

---

## 1. Design principles

| # | Principle | Consequence |
|---|---|---|
| 1 | **One clone, zero assembly** | Nothing is downloaded at teach-time except base images during setup. No "see the other repo". |
| 2 | **Three audiences, three doors** | `labs/` for the student, `documents/` for the instructor, `topics/` for whoever is teaching one day. Everything else is the machinery underneath. |
| 3 | **Generated artefacts are never edited** | Decks come from `slides/src/`, manuals from `topics/*/manual-chapter.md`, dashboards from a Python file. Editing a `.pptx` loses the change at the next build. |
| 4 | **A copy that can drift is a bug** | The deck and manual appear in both `documents/` and the topic folder. `make slides` and `make manuals` write both, and `make verify` compares them byte for byte. |
| 5 | **Solutions are separated, not hidden** | Each topic carries its own `solutions.md`. Adults learn faster with the answer available and the discipline not to open it. |
| 6 | **Nothing floats on `:latest`** | Every version pinned in `VERSIONS.env`. A course that breaks because upstream moved is a course that gets cancelled. |
| 7 | **Automation over instruction** | If a step can be scripted, it is. Instructor time goes to teaching, not to fixing environments. |
| 8 | **Diagrams are source, not images** | Mermaid is the master; SVG and PNG are generated. Deck diagrams are native PowerPoint shapes, generated from `slides/src/day<N>/diagrams.js`. |

---

## 2. Top-level layout

```
kubernetes/
├── README.md                     Start here — course overview, quick start
├── LICENSE
├── VERSIONS.env                  Single source of truth for every version pin
├── Makefile                      make preflight · build · deploy-all · verify · …
│
│   ── THE THREE DOORS ────────────────────────────────────────────────────
├── labs/                         STUDENT: 31 labs + 4 incident windows, in order
├── documents/                    INSTRUCTOR: decks, manuals, assessments, reference
├── topics/                       PER-DAY: one folder per topic, teachable as a unit
│
│   ── THE PLATFORM ───────────────────────────────────────────────────────
├── images/                       Service source + Dockerfiles — 16 services
├── manifests/                    Kubernetes YAML — the platform, day by day
├── charts/                       Helm chart for the whole platform, and the
│                                 observability stack's values files
├── data/                         Database schema, seed generator, fixtures
│
│   ── THE MACHINERY ──────────────────────────────────────────────────────
├── scripts/                      Student setup and build (installers, image builds)
├── admin/                        Instructor-only: validation, incidents, authoring
└── capstone/                     Brief, incident tickets, migration, solutions
```

### Where a given file lives

| Looking for | It is in |
|---|---|
| A practical | `labs/day<N>/<ID>-<slug>/README.md`, with its YAML in the same folder |
| A PowerPoint deck | `documents/slides/` (and a copy in the topic folder) |
| A participant manual PDF | `documents/manuals/` (and a copy in the topic folder) |
| The manual's *source* markdown | `topics/<topic>/manual-chapter.md` |
| A trainer guide | `documents/instructor/` (copy in the topic folder) |
| An assessment or answer key | `documents/assessments/` (copy in the topic folder) |
| Curriculum, architecture, glossary, command reference | `documents/reference/` |
| Lab solutions | `topics/<topic>/solutions.md` |
| The capstone run-book and rubric | `documents/instructor/` — **not** in `capstone/` |
| Capstone answers | `capstone/solutions.md` |

---

## 3. The three doors

### 3.1 `labs/` — the student's door

```
labs/
├── README.md                     Order, format, how to validate
├── GETTING-STARTED.md            Ubuntu install, terminal primer, cluster setup
├── day1/
│   ├── README.md                 The day's index
│   ├── L1.1-cluster-recon/
│   │   └── README.md             (no YAML — this one only looks)
│   ├── L1.3-first-pod/
│   │   ├── README.md
│   │   └── manifests/            the YAML this lab applies
│   └── … L1.6, INC-1
└── day2/ … day5/                 Same shape — 35 practicals in total
```

**Each practical is a folder** so a student never leaves it mid-lab. The YAML is a
copy of the canonical file in `manifests/`; `make verify` compares all 91 copies
byte for byte.

All five days together, deliberately: a student works the week in one place rather
than hopping between topic folders. Every lab has the same twelve sections and a
matching validator at `platform/admin/validate/validate-lab-<ID>.sh`.

### 3.2 `documents/` — the instructor's door

```
documents/
├── README.md
├── slides/           5 × .pptx      179 slides, 111k characters of speaker notes
├── manuals/          5 × .pdf       166 pages
├── instructor/       5 trainer guides + capstone run-book + capstone rubric
├── assessments/      5 daily papers + final exam
│   └── answer-keys/  6 keys with marking guidance and band descriptors
└── reference/        00 … 08 — the nine whole-course documents
```

`instructor/capstone-run-book.md` and `instructor/capstone-rubric.md` contain the
capstone answers. They are the only files in the repository that must not reach a
student before the assessment.

### 3.3 `topics/` — the per-day door

```
topics/
├── README.md
├── 01-foundations-and-core-objects/
│   ├── README.md                 What this topic is, objectives, links to its labs
│   ├── AxisPay-K8s-Day1.pptx     copy of documents/slides/
│   ├── manual-chapter.md         THE SOURCE — `make manuals` builds the PDF from this
│   ├── AxisPay-K8s-Day1-Participant-Manual.pdf
│   ├── trainer-guide.md          copy of documents/instructor/
│   ├── assessment.md             copy of documents/assessments/
│   ├── answer-key.md             copy of documents/assessments/answer-keys/
│   └── solutions.md              worked answers to every challenge and bonus
├── 02-workloads-scaling-and-releases/
├── 03-storage-and-configuration/
├── 04-networking-and-exposure/
└── 05-security-packaging-and-operations/
```

Each folder is self-contained enough to hand to whoever is teaching that day.

**On the duplication.** The deck and manual exist in two places on purpose. It is a
real risk — two copies of anything drift — so it is handled rather than hoped about:
`make slides` and `make manuals` write both locations from one source, and
`make verify` compares them byte for byte and fails if they differ. The manual's
*markdown source* exists only once, in the topic folder.

---

### 3.4 `documents/reference/` — design authority

```
documents/reference/
├── 00-CURRICULUM.md              Module map, objectives, timings, assessment strategy
├── 01-ARCHITECTURE.md            AxisPay platform architecture and lab environment spec
├── 02-DEPENDENCY-MAP.md          Concept DAG, ordering justification, seed-then-deepen pairs
├── 03-LAB-ROADMAP.md             All 31 labs, 10 incidents, capstone
├── 04-REPOSITORY-STRUCTURE.md    This document
├── 05-INSTRUCTOR-GUIDE.md        How to deliver the course                    [Phase 7]
├── 06-STUDENT-GUIDE.md           How to get the most from the course          [Phase 2]
├── 07-GLOSSARY.md                ~180 terms, plain English first              [Phase 7]
├── 08-COMMAND-REFERENCE.md       Every kubectl/helm command used, by task     [Phase 7]
├── 09-TRACEABILITY-MATRIX.md     Syllabus → objective → lab → assessment      [Phase 7]
├── 10-API-REFERENCE.md           AxisPay REST API across all 16 services      [Phase 2]
├── 11-CHEAT-SHEETS.md            Printable one-pagers per day                 [Phase 7]
├── 12-TROUBLESHOOTING-GUIDE.md   Symptom → cause → command → fix, consolidated [Phase 7]
├── 13-INTERVIEW-QUESTIONS.md     ~180 questions with model answers            [Phase 7]
└── assets/                       Screenshots and figures used in docs
```

### 3.5 `slides/` — deck SOURCE only

```
slides/
├── README.md
├── src/day1/ … src/day5/
│   ├── day<N>.js                 The deck: every slide, with its speaker notes
│   ├── lib.js                    12 slide archetypes — sTitle, sExplain, sCode, sLab …
│   └── diagrams.js               Native PowerPoint diagrams, as real shapes
├── templates/                    Master theme — colours, fonts, layouts
└── assets/                       Logos, icons, backgrounds
```

**The built `.pptx` files are not here** — they are in `documents/slides/`, with a
copy in each topic folder. This directory holds only the source.

```bash
make slides        # rebuilds all five decks and mirrors them into topics/
```

Every slide carries, in the notes pane: learning objective · speaker script ·
timing · demo cue · question to ask with the expected answer · callouts, tips and
warnings. 179 slides, roughly 111,000 characters of notes.

### 3.6 `labs/` — see §3.1

Student-facing instructions, all five days together. Covered in §3.1 above.

### 3.7 `manifests/` — the platform, day by day

```
manifests/
├── 00-namespaces/                Namespaces + labels (applied once, Day 1)
├── day1/{pods,deployments,services}/
├── day2/{resources,probes,autoscaling,workloads,rollout}/
├── day3/{config,secrets,storage,statefulsets,security}/
├── day4/{services,ingress,netpol,scheduling,disruption}/
├── day5/{rbac,security,observability}/
├── base/                         Shared fragments referenced across days
└── overlays/{dev,staging,prod}/  Environment differences (used on Day 5)
```

**Naming convention:** `<NN>-<kind>-<component>.yaml` — e.g. `03-deployment-payment-service.yaml`. The numeric prefix encodes apply order, so `kubectl apply -f <dir>/` always works without a separate ordering document.

### 3.8 `charts/` — Helm

```
charts/axispay/
├── Chart.yaml                    v2, appVersion 2.0.0
├── values.yaml                   Documented defaults
├── values-dev.yaml               1 replica, debug logs, low resources
├── values-staging.yaml           2 replicas, info logs
├── values-prod.yaml              3 replicas, warn logs, PDBs, anti-affinity
├── values-slim.yaml              Profile B — reduced observability footprint
├── templates/
│   ├── _helpers.tpl              Naming, labels, selector helpers
│   ├── NOTES.txt                 Post-install verification steps
│   └── <component>/…             One directory per service
├── charts/                       Subcharts: postgresql, redis, rabbitmq
└── README.md                     Full values reference table
```

### 3.9 `images/` — container build contexts

One directory per service. This is where the Java/Spring Boot source and Maven build metadata live, because a Dockerfile without its source is not reproducible.

```
images/
├── _shared/
│   ├── Dockerfile.base           Common Java runtime base
│   └── axispay_common/           Shared library: config, logging, health,
│                                 metrics, correlation IDs, DB/Redis/MQ clients
├── payment-service/
│   ├── Dockerfile
│   ├── pom.xml
│   ├── src/main/java/.../Application.java
│   ├── src/main/java/.../PaymentController.java
│   ├── src/test/
│   └── README.md                 API contract, env vars, ports, dependencies
├── edge-gateway/ auth-service/ merchant-service/ customer-service/
├── routing-service/ fraud-service/ ledger-service/
├── settlement-service/ notification-service/ audit-service/ reporting-service/
├── node-agent/ recon-worker/ loadgen/
```

Every Dockerfile: multi-stage · non-root UID 10001 · no shell in final layer where avoidable · `HEALTHCHECK` · pinned base by digest · `.dockerignore`.

### 3.10 `admin/authoring/diagrams/` — sources and renders

```
admin/authoring/diagrams/
├── README.md                     Naming, colour palette, how to regenerate
├── mermaid/                      MASTER SOURCE — *.mmd, one per diagram
└── render.sh                     mermaid → svg → png pipeline
```

~55 diagrams planned, covering every major topic. Mermaid is the master; everything else is generated.

### 3.11 `scripts/` and `admin/`

Student-facing tooling lives in `scripts/`; everything instructor-only lives in `admin/`.

```
scripts/
├── setup/
│   ├── 00-preflight.sh           Checks CPU, RAM, disk, virtualisation, ports
│   ├── 05-seed-database.sh       Load (and optionally regenerate) the seed data
│   ├── 06-generate-tls.sh        Issue the platform TLS material
│   └── 07-install-observability.sh  Prometheus, Grafana, Loki, Alloy
└── build/
    ├── build-all.sh              Build 16 images into the Minikube daemon
    └── build-service.sh          Build one

admin/
├── validate/
│   ├── validate-lab-*.sh         Per-lab acceptance tests
│   ├── checkpoint-day<N>.sh      Rebuild a day's end-state
│   ├── verify-course.sh          Whole-course offline verification
│   ├── capstone-validate.sh      Nine capstone competencies
│   └── check-*.py / simulate-*.py  Offline manifest/chart/PromQL/policy checks
├── incidents/
│   ├── inject-INC-<n>.sh         Inject a fault
│   └── resolve-INC-<n>.sh        Instructor escape hatch
├── capstone/
│   └── prepare-capstone.sh       Capstone pre-flight
└── authoring/                    Artefact generators (outputs are committed)
    ├── slides-src/               PowerPoint deck sources (Node)
    ├── diagrams/                 Mermaid masters + render.sh
    ├── build_manual.py           Markdown → participant-manual PDF
    ├── build-dashboards.py       Grafana dashboard ConfigMaps
    └── generate_seed.py          Seed-SQL generator
```

All scripts: `set -euo pipefail` · `--help` · `--dry-run` where destructive · colourised pass/fail · `shellcheck`-clean.

### 3.12 Remaining folders

| Folder | Contents |
|---|---|
| `capstone/` | Student brief, three incident tickets (symptoms only), the settlement schema migration, the validation script and `solutions.md`. The run-book and rubric live in `documents/instructor/` so the whole instructor set is in one place. |
| `data/` | `schema/` — 11 tables, 27 CHECK constraints · `seed/` — a deterministic generator producing 25 merchants, 5,000 payments and 14,865 ledger entries that balance to zero · `fixtures/` — captured API responses used as expected output in labs and slides |

### Folders that no longer exist

The layout was reorganised after the course was complete. If a document you are
reading refers to one of these, this is where it went:

| Was | Now |
|---|---|
| `docs/` | `documents/reference/` |
| `slides/dayN/*.pptx` | `documents/slides/` (+ a copy in the topic folder) |
| `manuals/*.pdf` | `documents/manuals/` (+ a copy in the topic folder) |
| `manuals/src/dayN-participant-manual.md` | `topics/<topic>/manual-chapter.md` |
| `instructor/trainer-notes/` | `documents/instructor/` |
| `assessments/**` | `documents/assessments/` |
| `solutions/dayN/README.md` | `topics/<topic>/solutions.md` |
| `solutions/capstone/README.md` | `capstone/solutions.md` |
| `capstone/instructor/run-book.md` | `documents/instructor/capstone-run-book.md` |
| `capstone/rubrics/capstone-rubric.md` | `documents/instructor/capstone-rubric.md` |

`labs/`, `manifests/`, `charts/`, `images/`, `scripts/`, `data/` and `diagrams/`
did not move.

---

## 4. Root files

### 4.1 `VERSIONS.env`

Sourced by every script, referenced by every manifest and chart. Changing a version is a one-line edit here.

### 4.2 `Makefile`

```
make preflight        Check the host is capable
make setup            Install tools, create cluster, preload images
make build-all        Build all 16 service images into Minikube
make deploy-day1..5   Deploy a day's end-state
make validate-day1..5 Validate a day's end-state
make incident-N       Inject incident N
make health           Full platform health report
make capstone         Set up the capstone environment
make clean            Reset to a clean cluster (keeps the cluster)
make destroy          Delete the cluster entirely
```

### 4.3 CI (`.github/workflows/`)

| Check | Tool |
|---|---|
| YAML syntax and style | `yamllint` |
| Manifest schema validity against v1.36 | `kubeconform` |
| Shell script correctness | `shellcheck` |
| Helm chart lint + template render | `helm lint`, `helm template` |
| Python lint and type check | `ruff`, `mypy` |
| Markdown link integrity | `lychee` |
| Lab template compliance | custom — all 12 sections present |
| Diagram render | `mmdc` renders every `.mmd` |

CI matters more than usual here: a manifest that does not apply is not a bug in a repository, it is **a failed training day in front of twenty paying students**.

---

## 5. Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Kubernetes objects | lowercase, hyphenated | `payment-service` |
| Namespaces | `axispay-<zone>` | `axispay-core` |
| Manifest files | `<NN>-<kind>-<component>.yaml` | `03-deployment-payment-service.yaml` |
| Labs | `L<day>.<n>-<slug>.md` | `L3.6-statefulsets.md` |
| Incidents | `INC-<n>[<letter>]-<slug>` | `INC-4a-ingress-misconfig` |
| Images | `axispay/<service>:<semver>` | `axispay/payment-service:1.0.0` |
| Scripts | `<verb>-<noun>.sh` | `validate-lab-L3.6.sh` |
| Diagrams | `<day>-<topic>-<type>.mmd` | `d3-storage-pv-pvc-flow.mmd` |

### 5.1 Standard labels on every object

```yaml
app.kubernetes.io/name: payment-service
app.kubernetes.io/instance: axispay
app.kubernetes.io/version: "1.0.0"
app.kubernetes.io/component: core
app.kubernetes.io/part-of: axispay
app.kubernetes.io/managed-by: kubectl     # → helm from Day 5
axispay.io/zone: core
axispay.io/pci-scope: "true"
axispay.io/day-introduced: "1"
```

`axispay.io/day-introduced` is a teaching aid — `kubectl get all -l axispay.io/day-introduced=3` shows a student exactly what Wednesday added.

---

## 6. Build phases

| Phase | Deliverable | Status |
|---|---|---|
| **1** | Curriculum · Architecture · Dependency map · Lab roadmap · Repository structure | **Complete** |
| 2 | Day 1: slides, manual chapter, trainer notes, 6 labs, manifests, service code, diagrams | Next |
| 3 | Day 2: same set | |
| 4 | Day 3: same set | |
| 5 | Day 4: same set | |
| 6 | Day 5: same set + Helm chart + observability | |
| 7 | Assembly: complete PPTX, participant PDF, trainer PDF, capstone, assessments, instructor guide, glossary, cheat sheets, traceability matrix, completion checklist | |

---

*Document owner: GitHub Repository Architect · Version 1.0 · Phase 1*
