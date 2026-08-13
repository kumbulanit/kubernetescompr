# Capstone — Solutions

> **Do not read this before the capstone.** It contains the three root causes.
>
> Read it afterwards, alongside your own incident report, and compare your path to this one. The gap between them is the thing worth studying.

---

## Phase 1 — Pre-flight

What a strong baseline looks like. It takes six minutes and it is what makes every later claim provable.

```bash
# 1. Is the platform healthy BEFORE you touch it?
make validate-day5
kubectl get pods -A -l app.kubernetes.io/part-of=axispay | grep -v Running

# 2. Where is the release?
helm list -A && helm history axispay

# 3. The SLO numbers, right now — screenshot or write them down
#    (Prometheus, over the last hour)
sum(rate(axispay_http_requests_total{service="payment-service",status!~"5.."}[1h]))
  / sum(rate(axispay_http_requests_total{service="payment-service"}[1h]))
histogram_quantile(0.99, sum by (le) (
  rate(axispay_http_request_duration_seconds_bucket{service="payment-service"}[1h])))

# 4. Replica counts and who owns them
kubectl get deploy,hpa -A -l app.kubernetes.io/part-of=axispay

# 5. What protects the rollout
kubectl get pdb -A

# 6. The money
kubectl -n axispay-data exec postgres-0 -- \
  psql -U axispay_app -d axispay -t -c 'SELECT SUM(amount_minor) FROM ledger_entries;'
```

**The rollback plan, written before the upgrade:**

> If the upgrade does not converge in 10 minutes, `--atomic` rolls it back automatically. If it converges but the SLO degrades, `helm rollback axispay --wait`. The settlement migration is additive and idempotent, so it does **not** need reverting — 1.1.0 code runs against the 2.0.0 schema. Recovery point: `helm history` revision N. Recovery time: under 3 minutes.

That last sentence — *why the migration does not need reverting* — is what separates a plan from a hope.

---

## Phase 2 — The upgrade

**Migration first or code first?** Either order is defensible; you must be able to say which property makes yours safe.

This migration only **adds** nullable columns, adds a column with a default, and adds an index. Nothing is dropped or renamed, and no NOT NULL arrives without a default. So it is **backward compatible**: 1.1.0 code keeps working against the new schema. That makes *migration first* the safer order — and it is the order that works during a rolling update, when **both** versions are serving traffic simultaneously.

```bash
# 1. migration first — it is backward compatible, so 1.1.0 survives it
kubectl apply -f capstone/manifests/
kubectl -n axispay-data wait --for=condition=complete job/settlement-migration-2-0-0 --timeout=300s
kubectl -n axispay-data logs job/settlement-migration-2-0-0     # read the verify output

# 2. keep traffic flowing — you cannot claim an SLO with no traffic
kubectl scale deployment/loadgen -n axispay-ops --replicas=1

# 3. the upgrade
helm upgrade axispay ./charts/axispay --set global.image.tag=2.0.0 --atomic --timeout 10m

# 4. watch it in GRAFANA, not only in rollout status
kubectl rollout status deployment/payment-service -n axispay-core
```

The migration that would have forced the other order: `ALTER TABLE settlements RENAME COLUMN file_ref TO settlement_file_ref`. The instant it applies, every 1.1.0 pod still running starts throwing. That needs expand/contract across two releases, not one Job — and being able to name that difference is the assessable part.

---

## Phase 3 — The three incidents

### INC-5 · Redis unavailable

**Presenting symptom:** approval rate down ~30%, p99 climbing, checkout slow but not failing.

**What makes it hard:** `kubectl get pods` is entirely green. Every pod is Ready.

**The path a strong answer takes:**

```bash
# 1. Notice it on a BUSINESS panel, before the ticket
#    Grafana -> "Payments by outcome" -> the declined band is growing

# 2. Confirm the infrastructure is fine — this is evidence, not a dead end
kubectl get pods -A -l app.kubernetes.io/part-of=axispay        # all Ready

# 3. If the workloads are healthy, the fault is in a DEPENDENCY
kubectl logs -n axispay-core deploy/fraud-service --tail=30 | jq -r '.msg' | sort | uniq -c
#   -> repeated cache-miss / connection errors

# 4. Which dependency?
kubectl get pods,sts -n axispay-data
#   -> redis 0/0  <- there it is
```

**Fix:**

```bash
kubectl scale statefulset/redis -n axispay-data --replicas=1
kubectl rollout status statefulset/redis -n axispay-data --timeout=180s
```

**Why every pod stayed Ready — and why that is correct.** `fraud-service` registers Redis as a **non-critical** dependency in its readiness registry. A cache outage should *degrade* the service, not remove it from the load balancer. Had Redis been registered as critical, `fraud-service` would have gone unready, `payment-service` would have got connection failures instead of slow responses, and the outcome would have been worse — a hard failure instead of a soft one.

So the probe was right. **The gap was an alert, not a probe.** The alert that would have caught it before the merchant did:

```promql
# decline rate, which is in the platform already
(sum(rate(axispay_payments_total{status="declined"}[15m]))
   / sum(rate(axispay_payments_total[15m]))) > 0.25
```

`AxisPayDeclineRateHigh` exists precisely for this. If it did not fire before the ticket arrived, ask why — usually because `for: 15m` had not elapsed, which is a threshold conversation worth having.

---

### INC-6 · Settlement database unreachable — **the trap**

**Presenting symptom:** no settlement file, audit events backing up, payments unaffected.

**The path:**

```bash
# 1. Queue depth is the signal — a growing queue means consumers are failing
kubectl -n axispay-data exec deploy/rabbitmq -- rabbitmqctl list_queues name messages consumers

# 2. Which consumer?
kubectl logs -n axispay-async deploy/settlement-service --tail=30
kubectl logs -n axispay-async deploy/audit-service --tail=30
#   -> connection timeouts to postgres

# 3. Payments work, so postgres is up. The difference is the NAMESPACE.
kubectl exec -n axispay-core deploy/payment-service -- python3 -c \
  "import socket; socket.create_connection(('postgres.axispay-data.svc.cluster.local',5432),timeout=5); print('CORE OK')"
kubectl exec -n axispay-async deploy/audit-service -- python3 -c \
  "import socket; socket.create_connection(('postgres.axispay-data.svc.cluster.local',5432),timeout=5); print('ASYNC OK')"
#   -> core succeeds, async times out

# 4. What changed?
kubectl get netpol -n axispay-data -o yaml | grep -B2 -A2 change-cause
#   -> "CR-2026-0819 restrict data tier ingress to the payment path"
```

### ⚠ The two-second fix that is wrong

```bash
kubectl delete networkpolicy allow-core-and-async-to-data -n axispay-data   # DO NOT
```

It restores service instantly. It also **removes the cardholder-data segmentation entirely** — not back to yesterday's state, but to no control at all. The change record narrowed the policy; deleting it is a larger change than the one that caused the incident, made under time pressure, and it will appear in the audit trail as the removal of a PCI control during an incident.

**The correct fix:**

```bash
kubectl apply -f manifests/day4/netpol/05-data-tier.yaml
kubectl get netpol -n axispay-data
python3 platform/admin/validate/simulate-netpol.py            # 46 assertions — proof it is intact
```

Then verify the *symptom* is gone, not just the policy restored:

```bash
kubectl -n axispay-data exec deploy/rabbitmq -- rabbitmqctl list_queues name messages
# depth falling to zero as the consumers catch up
```

**The preventive action worth naming in your report:** the real defect is not that someone narrowed a policy — it is that a policy change was approved and applied with no test that would have caught it. `simulate-netpol.py` in CI would have failed the change. "Be more careful" is not a preventive action.

---

### INC-7 · Expired TLS certificate

**Presenting symptom:** merchants cannot connect; every dashboard is green.

**The path:**

```bash
# 1. In-cluster health is PERFECT. Take that as evidence, not as noise —
#    it means the fault is at the edge, outside the cluster's view of itself.
make validate-day5        # passes

# 2. Reproduce it the way a merchant experiences it
curl -v https://api.axispay.local/api/v1/_info
#   -> SSL certificate problem: certificate has expired

# 3. Read the certificate
openssl s_client -connect $(minikube ip -p axispay):443 -servername api.axispay.local 2>/dev/null \
  | openssl x509 -noout -dates -subject
#   -> notAfter=<yesterday>
```

**Fix:**

```bash
bash scripts/setup/06-generate-tls.sh
kubectl -n ingress-nginx rollout restart deployment/ingress-nginx-controller
```

**Verify like a merchant, not like an engineer in a hurry:**

```bash
openssl s_client -connect $(minikube ip -p axispay):443 -servername api.axispay.local 2>/dev/null \
  | openssl x509 -noout -dates
curl -s -o /dev/null -w '%{http_code}\n' https://api.axispay.local/api/v1/_info    # NO -k
```

> **`curl -k` proves nothing.** `-k` disables precisely the certificate check that was failing. Verifying a TLS fix with `-k` is verifying that the fix was unnecessary.

**The preventive action:** a certificate-expiry alert. It does not exist in this platform, and finding that gap yourself is what an exemplary answer looks like:

```promql
(probe_ssl_earliest_cert_expiry - time()) / 86400 < 21
```

(requires blackbox-exporter, which is the honest next step rather than something already installed).

---

## Phase 4 — Validation

```bash
bash platform/admin/validate/capstone-validate.sh
```

It must exit 0. The checks that matter most, and why:

| Check | Why it is there |
|---|---|
| Migration ran **exactly once** | Twice is a double-applied schema change — a data-integrity incident |
| Data-tier policy present **and** admits async | Catches the trap |
| Every journal balances, not just the total | A total of zero can hide two offsetting errors |
| No duplicate idempotency key | Proves no payment was taken twice during the upgrade |
| Replay returns `Idempotent-Replay: true` | The contract that protects a merchant's retry |
| Queue depth zero | Consumers caught up — recovery is complete, not merely started |

---

## Phase 5 — The incident report

Five minutes. What a strong one contains:

**Timeline** — six or seven lines, with times. Not a narrative.

**Root causes, stated as causes:**

- ✅ "Redis was scaled to zero, so fraud-service lost its cache and fell back to the slow path."
- ❌ "fraud-service was slow." *(that is a symptom)*

**Impact, in the business's units:**

- ✅ "Approximately 340 payments declined over 18 minutes; roughly R412,000 of merchant volume affected; three merchants raised tickets."
- ❌ "fraud-service p99 went to 1.1 seconds." *(that is an instrument reading)*

You can compute the first from the metrics:

```promql
sum(increase(axispay_payments_total{status="declined"}[20m]))
```

**Two preventive actions, at least one an alert that does not exist:**

1. A certificate-expiry alert at 21 days (from INC-7) — nothing in the platform watches this today.
2. `simulate-netpol.py` in CI on every change to `manifests/**/netpol/**` (from INC-6) — the change that caused the incident would have been rejected before merge.

Weak reports say "improve monitoring" and "be more careful". Neither is an action anyone can complete.

---

## What separates a distinction

Not speed. Four things, in the order they show up:

1. **A baseline recorded before touching anything.** Without it you cannot distinguish a fault you caused from one that was already there — and you cannot claim you held the SLO.
2. **Detecting an incident from a dashboard before the ticket arrives.** At least two of three. This is the single strongest signal that the observability module landed.
3. **Restoring the policy in INC-6 rather than deleting it** — and being able to defend that choice to a change board without being asked to.
4. **Naming an alert that does not exist yet.** It means you have stopped thinking about the incident and started thinking about the class of incident.

The students who do well are not the ones who finish first. They are the ones whose first command in each incident was the same one, because they were following a method rather than a hunch.
