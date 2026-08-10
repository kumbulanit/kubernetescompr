# Capstone — Production Upgrade Under Fire

| | |
|---|---|
| **Time** | 110 minutes |
| **Weight** | 25% of the course |
| **Format** | Individual, instructor-observed |
| **You need first** | Day 5 finished — `make validate-day5` passes |
| **Pass mark** | 70% |
| **Rubric** | [`documents/instructor/capstone-rubric.md`](../documents/instructor/capstone-rubric.md) |

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../labs/GETTING-STARTED.md).
</details>

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This brief. |
| `manifests/01-settlement-migration.yaml` | The settlement schema migration you run in phase 2 |
| `scenarios/` | The three incident tickets — your instructor hands these out |
| `validation/prepare-capstone.sh` | Instructor pre-flight, run the night before |
| `solutions.md` | **Do not open before the exercise.** Root causes and walkthrough |

---

## Before you start

Open these in tabs. Hunting for a port-forward command at minute 62 is a self-inflicted incident.

```bash
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-grafana 3000:80 &
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-prometheus 9090 &
kubectl -n axispay-observability port-forward svc/alert-sink 8080:8080 &
kubectl -n axispay-observability logs -f deploy/alert-sink &
```

| | |
|---|---|
| Grafana | <http://localhost:3000> — admin / axispay-training |
| Prometheus | <http://localhost:9090> — Alerts, and Status → Targets |
| Alert sink | `curl -s localhost:8080/api/v1/routes \| jq .` |
| Triage board | Grafana → **AxisPay — Incident Triage** |

---

## The brief

> ### AxisPay Change Request CR-2026-0814 — **Approved**
>
> Platform version **1.1.0 must be upgraded to 2.0.0 tonight.** The change window is 110 minutes. Merchant traffic continues throughout — there is no maintenance window; payments do not stop.
>
> **Release 2.0.0 contains:**
> - a new fraud scoring model
> - a settlement schema migration
> - an increased connection pool in `payment-service`
> - a new reporting endpoint
>
> **Contractual constraints. Non-negotiable.**
>
> | | |
> |---|---|
> | Payment API availability | must not drop below **99.5%** during the window |
> | p99 authorisation latency | must stay under **300 ms** |
> | Payments lost or double-processed | **zero** |
> | The ledger | must balance to zero at the end |
> | Every action | must be auditable |
>
> You are the engineer on point. You have Grafana. You have the runbook you wrote this week.
>
> Go.

---

## What you are allowed

Everything in this repository, everything on your cluster, and your own notes. The instructor will answer questions about **tools** and will not answer questions about **causes**.

You are being assessed on method, not speed. A student who works systematically and does not finish scores higher than one who guesses correctly.

---

## Phases

### Phase 1 · Pre-flight — 15 minutes

Before you change anything, establish what "working" currently means. You cannot prove you maintained an SLO if you never recorded the starting point.

```bash
make validate-day5
kubectl get pods -A -l app.kubernetes.io/part-of=axispay
helm list -A && helm history axispay
```

Record a baseline. Suggested minimum:

- current success rate and p99 latency from Grafana
- replica counts, and which workloads have an HPA
- which PodDisruptionBudgets exist and what they permit
- the current ledger balance (it should already be zero)
- **your rollback plan, written down before you need it**

```bash
kubectl exec -n axispay-data postgres-0 -- \
  psql -U axispay_app -d axispay -t -c 'SELECT SUM(amount_minor) FROM ledger_entries;'
```

> **You are assessed on whether you check before you change.** An engineer who upgrades first and looks second cannot tell a pre-existing fault from one they caused.

### Phase 2 · Upgrade — 25 minutes

```bash
helm upgrade axispay ./charts/axispay \
  --set global.image.tag=2.0.0 \
  --atomic --timeout 10m
```

Two things the command above does not do for you:

1. **The settlement schema migration.** It runs as a Job. Decide whether it goes before or after the workload upgrade, and be ready to defend the order. Ask yourself which version of the code has to tolerate which version of the schema.
2. **Watching.** Monitor *during* the rollout, not after it. `kubectl rollout status` tells you Kubernetes is content. Grafana tells you whether merchants are.

Keep traffic flowing the whole time:

```bash
kubectl scale deployment/loadgen -n axispay-ops --replicas=1
```

### Phase 3 · Incident wave — 40 minutes

Three faults will be injected without warning, roughly twelve minutes apart. You will not be told what they are or how many have landed.

Apply the triage loop. Prioritise by customer impact, not by which alert is loudest.

> **One of the three has a fix that takes two seconds and is wrong.** It will restore service immediately and it will destroy something you built earlier in the week to satisfy a control this brief calls contractual. If you find yourself about to delete a security object to restore service, stop and consider what you are trading.

### Phase 4 · Recovery and validation — 20 minutes

```bash
bash scripts/validate/capstone-validate.sh
```

The script must exit 0. Additionally:

- every workload Ready, on 2.0.0
- the RabbitMQ queue drained to zero
- the ledger sums to zero
- security posture unchanged from your Phase 1 baseline

> **A fix without verification does not count.** This is stated before INC-1 on Monday and it is not negotiable.

### Phase 5 · Presentation — 10 minutes

Five minutes to the AxisPay change board (the class), five for questions. Cover:

1. **Timeline** — what happened, when
2. **Root cause** of each incident, stated as a cause and not a symptom
3. **Impact** — in payments and rands, not in pods
4. **Two concrete preventive actions**, at least one of which is an alert that does not exist yet

No slides required. A clear verbal account with the dashboard on screen is better than slides.

---

## The nine competencies

You are assessed against these. They are the outcomes this course is sold on.

| # | Competency | Where | Evidence |
|---|---|---|---|
| 1 | **Deploy** | Phase 2 | Release 2.0.0 `deployed` |
| 2 | **Scale** | Phase 3 | Replica count reacts to load during INC-5 |
| 3 | **Upgrade** | Phase 2 | All Deployments on 2.0.0; migration Job succeeded exactly once |
| 4 | **Secure** | Phase 3 | TLS valid; NetworkPolicies intact; nothing weakened to restore service |
| 5 | **Monitor** | Throughout | You detect at least two of three incidents from dashboards *before* the ticket |
| 6 | **Troubleshoot** | Phase 3 | All three root causes correctly identified |
| 7 | **Recover** | Phase 4 | All services Ready; queue drained |
| 8 | **Validate** | Phase 4 | `capstone-validate.sh` exits 0; ledger sums to zero |
| 9 | **Present** | Phase 5 | Timeline, causes, impact, two preventive actions |

---

## Scoring

| Component | Weight |
|---|---|
| Upgrade executed correctly | 20% |
| SLOs maintained (availability + latency) | 20% |
| Three incidents root-caused | 25% |
| Validation passes; ledger balances | 15% |
| Security posture preserved | 10% |
| Presentation quality | 10% |

---

Good luck. The ledger has to balance.
