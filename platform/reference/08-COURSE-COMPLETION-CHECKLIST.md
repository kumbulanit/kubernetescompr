# Course Completion Checklist

*Three checklists. One for whoever is delivering the course, one for the student, and one for whoever owns this repository.*

---

## Part 1 — Instructor: before the course

### Four weeks out

- [ ] Participant list confirmed, with a role for each (SysAdmin / Developer / DevOps / SRE / Cloud Engineer)
- [ ] Machine specification sent: **8 vCPU / 16 GB / 40 GB free** recommended; 4 vCPU / 8 GB minimum
- [ ] Participants warned that they need **local admin rights** to install Docker and Minikube
- [ ] Corporate proxy? Ask now — it breaks image pulls, and `trust_env=False` in the services is there because of it

### One week out

- [ ] `scripts/setup/00-preflight.sh` sent to every participant, with instructions to run it and report failures
- [ ] Everyone has run it successfully, or you know who has not
- [ ] Images pre-pulled where bandwidth is poor: `python:3.13-slim-bookworm`, `postgres:17-alpine`, `redis:7.4-alpine`, `rabbitmq:4-management-alpine`, `busybox:1.37`, `curlimages/curl:8.11.1`
- [ ] You have run the whole course yourself, end to end, on a clean machine

### The day before

- [ ] `bash platform/admin/validate/verify-course.sh` — green
- [ ] Your own cluster rebuilt from scratch, so your demos are on the same state the room will have
- [ ] Printed: five assessments, five answer keys, one capstone rubric **per student**
- [ ] `make observability` scheduled for the end of Day 4 — say it twice
- [ ] 2.0.0 images built on every machine (see the capstone run-book)

### Every morning

- [ ] Yesterday's checkpoint passes for everyone: `make validate-day<N-1>`
- [ ] Anyone broken is paired up before the first module, not during the first lab
- [ ] The day's incident script tested on your own cluster

---

## Part 2 — Student: have I actually finished?

Tick these honestly. They are what the course claims you can do.

### Day 1 — Deploy it

- [ ] I can explain the reconciliation loop without using the word "magic"
- [ ] I can name what happens between `kubectl apply` and a running container
- [ ] I know the difference between a pod that is `Running` and one that is `Ready`
- [ ] I found the root cause of INC-1 by method, not by guessing
- [ ] `make validate-day1` passes

### Day 2 — Keep it up

- [ ] I can state what requests and limits each do, and who reads them
- [ ] I can name the three probes **by consequence**, not by name
- [ ] I know why a liveness probe must not check a dependency
- [ ] I ran a rolling update under live traffic with zero failed requests
- [ ] I recognised OOMKilled from exit code 137 without being told
- [ ] `make validate-day2` passes

### Day 3 — Give it memory

- [ ] I know when a ConfigMap change reaches a running pod and when it does not
- [ ] I can say what a Secret actually protects against — and what it does not
- [ ] I understand that `ReadWriteOnce` means one **node**
- [ ] I can say why a database is a StatefulSet and a gateway is not
- [ ] I made a container run as non-root with a read-only root filesystem
- [ ] `make validate-day3` passes

### Day 4 — Let the world in

- [ ] I can state the four networking rules Kubernetes requires of a CNI
- [ ] I can choose between the five Service types and defend the choice
- [ ] I can explain `ndots:5` and what it costs
- [ ] I applied default-deny, watched everything break, and **derived** the DNS rule myself
- [ ] I can tell 404, 502 and 503 apart from an Ingress, and say which layer each is
- [ ] I drained a node with zero failed payments
- [ ] `make validate-day4` passes

### Day 5 — Run it

- [ ] I read a live API token out of a pod and understood why 403 was the bad news
- [ ] Every one of my workloads has its own identity and no unused token
- [ ] I proved an RBAC denial with `kubectl auth can-i`, not by reading YAML
- [ ] I can name two ways to read a Secret with no `secrets` grant
- [ ] I installed the whole platform with one command
- [ ] I caused `field is immutable` and understood why it appeared on the second release
- [ ] I can write PromQL for all four golden signals
- [ ] I built the alert that fires when nothing is happening
- [ ] I traced one payment across seven services from a single ID
- [ ] `make validate-day5` passes

### Capstone

- [ ] I recorded a baseline **before** I changed anything
- [ ] I wrote a rollback plan before I needed one
- [ ] I upgraded under live traffic and held the SLO
- [ ] I root-caused all three incidents
- [ ] I did not weaken a security control to restore service — or I did, caught myself, and can explain why it mattered
- [ ] `capstone-validate.sh` exits 0 and the ledger balances to zero
- [ ] I presented a timeline, three root causes, quantified impact, and two preventive actions

### The honest ones

- [ ] There is at least one thing I got wrong this week and can explain why
- [ ] I said "I don't know" at least once instead of guessing
- [ ] I could run this platform on call, with the runbook I have

---

## Part 3 — Repository owner: is this course still shippable?

Run before every cohort, and after any change.

### Automated

```bash
bash platform/admin/validate/verify-course.sh
```

- [ ] Every shell script, Python file, YAML file and deck source parses
- [ ] `check-manifests.py` — manifest wiring
- [ ] `check-helm-chart.py` — 94 chart assertions
- [ ] `check-promql.py` — every expression parsed, every metric name real
- [ ] `check-diagrams.py` — every Mermaid source
- [ ] `simulate-netpol.py` — 46 policy assertions
- [ ] `simulate-rbac.py` — 28 RBAC assertions
- [ ] Every lab has a validator, and every validator has a lab
- [ ] Every day has a deck, a manual, a trainer guide, an assessment, an answer key, a checkpoint and diagrams
- [ ] Every relative markdown link resolves
- [ ] No card number pattern anywhere in the seed data
- [ ] `VERSIONS.env`, `Chart.yaml` and `values.yaml` agree

### On a real cluster

```bash
make cluster && make build-all && make deploy-all && make seed
make observability
for d in 1 2 3 4 5; do make validate-day$d || break; done
```

- [ ] The platform deploys from zero on a clean machine
- [ ] All five checkpoints pass
- [ ] A payment succeeds end to end, and a replay returns `Idempotent-Replay: true`
- [ ] The ledger sums to zero
- [ ] `helm lint` passes against all five values files
- [ ] Every incident script injects and resolves cleanly

### By hand — the things a script cannot check

- [ ] Every deck opens in PowerPoint and Google Slides without a layout defect
- [ ] Speaker notes are present on every slide
- [ ] Every manual PDF renders with no overflowing code block
- [ ] The Kubernetes version in `VERSIONS.env` is still supported upstream
- [ ] Chart versions for kube-prometheus-stack, Loki and Alloy still exist
- [ ] No deprecated API version appears in any manifest

---

## Part 4 — What to do when something is out of date

| What changed | Where to fix it |
|---|---|
| Kubernetes minor version | `VERSIONS.env` → `make preflight` → `make validate-all` |
| A chart version (Prometheus, Loki, Alloy) | `VERSIONS.env`, then re-run `make observability` |
| An image base | `VERSIONS.env`, then `make build-all` (or `make build SVC=<service>` for one service) |
| A deprecated API in a manifest | The manifest, the chart template, and the lab that quotes it — `check-manifests.py` will not catch this |
| A metric renamed upstream | `check-promql.py` catches it. Fix the dashboards and the rules |
| A slide is wrong | `slides/src/day<N>/day<N>.js`, then rebuild. **Never edit the .pptx** — it is generated |
| A dashboard is wrong | `platform/admin/authoring/build-dashboards.py`, then `make dashboards`. **Never edit in the Grafana UI** |
| A diagram is wrong | `diagrams/mermaid/*.mmd`, then `./render.sh`. Deck diagrams are separate, in `slides/src/day<N>/diagrams.js` |

---

## Part 5 — Known limitations, stated plainly

Every course has these. Ours are written down rather than discovered.

| Limitation | Why | Mitigation |
|---|---|---|
| Cluster upgrades are taught, not practised | Upgrading Minikube mid-course would end the course | The risky part — `drain` under a PDB — is practised twice |
| Single-node data tier | Real HA for Postgres needs an operator and more RAM than a laptop has | Named explicitly in D3; the failure modes are taught |
| Loki in single-binary mode | Distributed mode needs object storage | Stated in the values file, with what production would differ on |
| No GitOps | ArgoCD or Flux would be a sixth day | Named in the closing slide as the first thing to learn next |
| No service mesh | Same reason | Named in the closing slide |
| No cost management | Same reason | Named — and flagged as the one most employers care about soonest |
| `values-prod.yaml` cannot run its own autoscaler ceiling on a laptop | 20 replicas of payment-service is 4000m | Documented in the Makefile and the chart README; render it, do not install it |
| The capstone needs a full 110 minutes | Compressed, the incidents overlap and it measures panic | Run it as a separate session rather than shortening it |
