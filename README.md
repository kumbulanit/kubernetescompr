<div align="center">

# AxisPay — Kubernetes Comprehensive

**A 5-day, 35-hour instructor-led enterprise training course**

Build, operate, secure and troubleshoot a production-style payments platform on Kubernetes.

`Ubuntu 26.04 LTS` · `Minikube` · `Kubernetes v1.36` · `Java 21 LTS + Spring Boot 3.4 + Maven` · `PostgreSQL 17` · `Redis 7.4` · `RabbitMQ 4` · `Helm 3` · `Prometheus · Grafana · Loki`

</div>

---

## What this is

Most Kubernetes courses teach you `nginx`. This one hands you **AxisPay** — a fictional pan-African payment orchestration platform with 16 microservices, a double-entry ledger, an event backbone and 5,000 seeded transactions — and asks you to run it.

Over five days you deploy it, make it survive load, give it persistent state, expose it safely to merchants, lock it down, package it, instrument it, and then upgrade it in production while three unannounced incidents are injected.

**There are no throwaway exercises.** Monday's namespaces are Friday's Helm values. Thursday's PodDisruptionBudgets are what stop the capstone upgrade from taking the platform down. Everything you build, you keep.

---

## Who it is for

System Administrators · Developers · DevOps Engineers · Site Reliability Engineers · Cloud Engineers

**You need:** comfort in a Linux shell · a working idea of what a container is · basic YAML · basic HTTP.
**You do not need:** prior Kubernetes experience.

Full prerequisites and a self-assessment: [`documents/reference/00-CURRICULUM.md` §4](platform/reference/00-CURRICULUM.md).

---

## The week

| Day | Theme | You will build |
|:--:|---|---|
| **1** | Foundations and first deployment | Namespaces, Pods, Deployments, Services — four AxisPay services talking to each other |
| **2** | Reliability and controlled change | Resource governance, health probes, autoscaling under load, a zero-downtime release |
| **3** | State, configuration and data | ConfigMaps, Secrets, persistent storage, PostgreSQL/Redis/RabbitMQ as StatefulSets, real seeded data |
| **4** | Networking, exposure and placement | Ingress with TLS, DNS, zero-trust NetworkPolicy, affinity and anti-affinity, disruption budgets |
| **5** | Security, packaging, observability, production ops | RBAC, Helm, Prometheus/Grafana/Loki/Alertmanager, and the **capstone** |

**Capstone — "Production Upgrade Under Fire":** upgrade AxisPay from 1.1.0 to 2.0.0 under live merchant traffic, keep availability above 99.5% and p99 latency under 300 ms, survive three injected incidents, prove the ledger still balances, and present your incident report to the change board.

---

## Quick start

> **Host requirements:** Ubuntu 26.04 LTS (24.04 LTS supported) · 4 vCPU / 8 GB RAM minimum, 8 vCPU / 16 GB recommended · 40 GB free disk.

```bash
git clone <repo-url> axispay-k8s-training
cd axispay-k8s-training

make preflight                 # Verify your machine can run the labs — do this BEFORE day 1
make setup                     # Install Docker, minikube, kubectl, helm; create the cluster
make build SVC=payment-service # Build one service image into Minikube
make build-all                 # Build all 16 service images into Minikube (no registry needed)
make deploy-day1               # Deploy the Day 1 end-state
make validate-day1             # Confirm it worked
make validate-lab LAB=L1.3    # Check one lab's result
```

The `make` targets are wrappers. If you want to see the normal and underlying commands behind them, this is the equivalent:

```bash
# make preflight
bash platform/scripts/setup/00-preflight.sh --profile A

# make cluster
bash platform/scripts/setup/03-create-cluster.sh --profile A
bash platform/scripts/setup/04-verify-cluster.sh

# vanilla Minikube equivalent of make cluster
minikube start -p axispay \
  --driver=docker \
  --container-runtime=containerd \
  --kubernetes-version=v1.36.2 \
  --cpus=4 \
  --memory=8g \
  --disk-size=20g \
  --nodes=3 \
  --cni=calico \
  --addons=metrics-server,ingress,storage-provisioner \
  --wait=all

kubectl config use-context axispay
kubectl wait --for=condition=Ready node --all --timeout=5m

# make setup
bash platform/scripts/setup/00-preflight.sh --profile A
bash platform/scripts/setup/01-install-tools.sh
bash platform/scripts/setup/02-preload-images.sh
bash platform/scripts/setup/03-create-cluster.sh --profile A
bash platform/scripts/setup/04-verify-cluster.sh

# make build SVC=payment-service
bash platform/scripts/build/build-service.sh --service payment-service --tag 1.0.0

# vanilla Docker/Minikube equivalent of make build SVC=payment-service
docker build \
  -t axispay/payment-service:1.0.0 \
  -f platform/images/payment-service/Dockerfile \
  .
minikube -p axispay image load axispay/payment-service:1.0.0

# make build-all
bash platform/scripts/build/build-all.sh --tag 1.0.0

# vanilla Docker/Minikube equivalent of make build-all
docker build -t axispay/edge-gateway:1.0.0 -f platform/images/edge-gateway/Dockerfile .
# ... repeat for each service ...
minikube -p axispay image load axispay/edge-gateway:1.0.0

# make deploy-day1
kubectl --context=axispay apply -R -f platform/manifests/00-namespaces/
kubectl --context=axispay apply -R -f platform/manifests/day1/
bash platform/admin/validate/checkpoint-day1.sh --wait

# make validate-day1
bash platform/admin/validate/checkpoint-day1.sh

# make validate-lab LAB=L1.3
bash platform/admin/validate/validate-lab-L1.3.sh

# vanilla equivalent of a lab validator is the same check, run from the lab or by the script itself
kubectl get pods -A
kubectl get deploy -A
kubectl get svc -A
```

If `make preflight` reports a problem, fix it before Monday. It is designed to catch every environment failure we have seen in delivery, and running it a week early turns a lost morning into a five-minute email.

---

## What is in the box

**The course is complete.** Every figure below is an actual, produced by
`make inventory` and re-checked by `make verify`.

| | Delivered |
|---|---|
| **Slides** | **179** across five decks, every one with speaker notes — **111,000 characters** of them: objectives, timings, live-demo cues, questions with expected answers, callouts, warnings, animation notes |
| **Participant manual** | **166 pages** across five PDFs. Every topic on the 16-point template: what it is, why it exists, the business problem, how it works, internal architecture, component interactions, an enterprise example, an analogy, best practices, common mistakes, security, performance, HA, DR, monitoring, troubleshooting — plus interview questions, cheat sheets and review questions |
| **Trainer guides** | Five. Minute-by-minute timing, what to cut when running late and in what order, the places students reliably get stuck, the demos worth doing live, and the hard questions with answers |
| **Practicals** | **35 folders** — 31 labs + 4 incident windows, plus the capstone. Each holds its README and its own YAML, written for someone new to Kubernetes on Ubuntu: every flag explained, every YAML field annotated, expected output shown before the command. `make verify` enforces the format. |
| **Incidents** | **10 faults in 7 windows**, with realistic tickets, escalating hints and a scoring rubric. Three are injected unannounced during the capstone |
| **Code** | **16 services** — Java 21 / Spring Boot on a shared library — tested end to end, plus an 11-table schema and 28,000 statements of fictional seed data that balances to zero |
| **Manifests** | **67 files, 151 objects.** No beta APIs. Wiring verified by script |
| **Helm chart** | One chart, **13 templates, 5 values files**, 69 rendered objects, **94 assertions** checked offline with no cluster and no helm binary |
| **Observability** | **9 alert rules**, **22 dashboard panels** across two generated dashboards, alert routing with inhibition, and a receiver that lets you *prove* the routing |
| **Diagrams** | **39 Mermaid sources** plus native PowerPoint shapes in every deck — editable, not images |
| **Assessments** | Five end-of-day papers, a 60-minute final examination, the capstone rubric, and answer keys with marking guidance and band descriptors |
| **Automation** | **48 validators, 70 scripts.** Six of them verify the repository against itself: manifest wiring, chart assertions, PromQL, Mermaid, NetworkPolicy logic and RBAC grants |

```bash
make verify      # every artefact agrees with every other — no cluster needed
make inventory   # the numbers above
```

Equivalent raw commands:

```bash
# make verify
bash platform/admin/validate/verify-course.sh

# make inventory
bash platform/admin/validate/verify-course.sh --inventory
```

---

> **Students start here:** [`labs/GETTING-STARTED.md`](days/GETTING-STARTED.md) — installs
> everything on Ubuntu, creates the cluster, and explains how the practicals work.
> Then [`labs/day1/`](days/day1/labs/).

## Repository map

Three doors, depending on who you are.

```
kubernetes/
│
│   ── THE THREE DOORS ──────────────────────────────────────────────────
├── labs/           STUDENT      35 practicals, each a folder with its own YAML
├── documents/      INSTRUCTOR   decks · manuals · assessments · reference
│   ├── slides/         5 × .pptx      179 slides, all with speaker notes
│   ├── manuals/        5 × .pdf       166 pages
│   ├── instructor/     trainer guides, capstone run-book, capstone rubric
│   ├── assessments/    5 daily papers + final exam + answer keys
│   └── reference/      curriculum · architecture · dependency map · roadmap ·
│                       repo structure · traceability · glossary ·
│                       command reference · completion checklist
├── topics/         PER DAY      one self-contained folder per topic
│   ├── 01-foundations-and-core-objects/
│   ├── 02-workloads-scaling-and-releases/
│   ├── 03-storage-and-configuration/
│   ├── 04-networking-and-exposure/
│   └── 05-security-packaging-and-operations/
│         README · deck · manual chapter (source + PDF) · trainer guide ·
│         assessment · answer key · solutions
│
│   ── THE PLATFORM ─────────────────────────────────────────────────────
├── images/         16 services — Java 21 / Spring Boot + Dockerfiles
├── manifests/      Kubernetes YAML, day by day — 67 files, 151 objects
├── charts/         The Helm chart, and the observability stack's values
├── data/           Schema, seed generator, API fixtures
│
│   ── THE MACHINERY ────────────────────────────────────────────────────
├── scripts/        Setup · build · 48 validators · incident injection
├── slides/         Deck SOURCE (src/, templates/, assets/)
├── diagrams/       39 Mermaid masters + render script
└── capstone/       Brief · incident tickets · migration · solutions
```

**Two things worth knowing before you go looking for a file:**

- The `.pptx` and `.pdf` files appear in **both** `documents/` and the matching
  topic folder, on purpose — so a topic can be handed over as a unit. `make slides`
  and `make manuals` write both from one source, and `make verify` compares them
  byte for byte, so they cannot drift.
- Anything generated is never edited by hand. Decks come from `slides/src/`,
  manuals from `topics/*/manual-chapter.md`, dashboards from a Python file.

Full specification, including where every folder moved during the reorganisation:
[`documents/reference/04-REPOSITORY-STRUCTURE.md`](platform/reference/04-REPOSITORY-STRUCTURE.md).

---

## Where to start

| You are… | Read |
|---|---|
| **An instructor** preparing to deliver | [`documents/reference/08-COURSE-COMPLETION-CHECKLIST.md`](platform/reference/08-COURSE-COMPLETION-CHECKLIST.md) → [`documents/instructor//`](documents/instructor/) → [`documents/reference/00-CURRICULUM.md`](platform/reference/00-CURRICULUM.md) |
| **A student** starting the course | [`documents/reference/03-LAB-ROADMAP.md`](platform/reference/03-LAB-ROADMAP.md) → [`labs/GETTING-STARTED.md`](days/GETTING-STARTED.md) |
| **A curriculum reviewer** | [`documents/reference/00-CURRICULUM.md`](platform/reference/00-CURRICULUM.md) → [`documents/reference/02-DEPENDENCY-MAP.md`](platform/reference/02-DEPENDENCY-MAP.md) → [`documents/reference/05-TRACEABILITY.md`](platform/reference/05-TRACEABILITY.md) |
| **An architect** evaluating the platform | [`documents/reference/01-ARCHITECTURE.md`](platform/reference/01-ARCHITECTURE.md) → [`charts/README.md`](platform/charts/README.md) |
| **Running the capstone** | [`documents/instructor/capstone-run-book.md`](capstone/run-book.md) |
| **Looking something up** | [`documents/reference/07-COMMAND-REFERENCE.md`](platform/reference/07-COMMAND-REFERENCE.md) · [`documents/reference/06-GLOSSARY.md`](platform/reference/06-GLOSSARY.md) |
| **Self-studying** | [`documents/reference/03-LAB-ROADMAP.md`](platform/reference/03-LAB-ROADMAP.md), then work the labs in order |

---

## Certification alignment

| Exam | Coverage | Remaining gaps |
|---|:--:|---|
| **CKA** | ~75% | kubeadm bootstrap from scratch, etcd backup/restore practical, multi-node network troubleshooting |
| **CKAD** | ~80% | Exam speed drills, imperative `kubectl` under time pressure |
| **CKS** | ~35% | Runtime security, supply chain, admission control, audit logging (requires CKA first) |

---

## A note on realism

AxisPay, Axis Financial Services, every merchant, customer, card token, acquirer, transaction and bank reference in this repository is **fictional**. No real institution is represented. No real cardholder data is used anywhere — card numbers do not exist in this platform even in test fixtures, only tokens of the form `tok_…`.

The platform is built to a PCI-DSS *shape* because those constraints make security controls feel consequential. **It is not PCI-DSS compliant** and is not presented as such. Real compliance needs a QSA, key management, scanning and formal change control, all of which are outside the scope of a training course.

---

## Licence

See [`LICENSE`](LICENSE). Course content © the course authors. All architecture diagrams are original works, informed by publicly documented industry patterns but copied from no source.

---

<div align="center">

**Course code `AXP-K8S-5D` · Version 1.0**

</div>
