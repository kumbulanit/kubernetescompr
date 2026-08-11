# Day 5 — Solutions

> Read the lab first. Use this to check yourself, or when genuinely stuck after ten minutes.

---

## L5.1 Identity and Pod Security

**C1 — Prove `node-agent` needs its token, and can do nothing else.**

```bash
# 1. What it actually calls
kubectl logs -n axispay-ops ds/node-agent --tail=20 | jq -r 'select(.msg|test("node")) | .msg'
grep -n "nodes" images/node-agent/app/main.py

# 2. It CAN list nodes
kubectl auth can-i list nodes --as=system:serviceaccount:axispay-ops:node-agent
# yes

# 3. It can do nothing else
SA="--as=system:serviceaccount:axispay-ops:node-agent"
kubectl auth can-i list pods    -n axispay-core $SA   # no
kubectl auth can-i get  secrets -n axispay-core $SA   # no
kubectl auth can-i create pods  -n axispay-ops  $SA   # no
kubectl auth can-i delete nodes                 $SA   # no  <- read-only, note the verb
```

The `axispay-node-reader` ClusterRole grants `nodes: [get, list, watch]` and nothing else. It is a ClusterRoleBinding because **Nodes are not namespaced** — this is one of the few places where cluster-wide is the correct scope rather than the lazy one.

**Bonus — which of the five `restricted` requirements did Monday's `payment-service` already meet?**

Four of five, because they came from the Dockerfile rather than the manifest:

| Requirement | Monday | Where it came from |
|---|---|---|
| `runAsNonRoot` | ✅ | `USER 10001:10001` in the Dockerfile |
| capabilities dropped | ❌ | Added in L3.7 — the container spec, not the image |
| `allowPrivilegeEscalation: false` | ❌ | Added in L3.7 |
| seccompProfile | ❌ | Added in L3.7 |
| restricted volume types | ✅ | It had no volumes at all on Monday |

The point worth taking: **image hygiene and pod-spec hardening are different work.** A perfectly built image still fails `restricted` because four of the five requirements can only be expressed in the pod spec.

---

## L5.2 RBAC

**C1 — Six-week expiry for the auditor.**

Kubernetes RBAC has no expiry field. There is no `validUntil`, and adding one has been discussed and rejected upstream — RBAC is deliberately a pure function of the current object set.

Three mechanisms that actually work, in order of preference:

1. **Expire the identity, not the binding.** The auditor is a User, and Users come from your authentication layer. Issue a client certificate with a six-week validity, or scope an OIDC group membership with an expiry in the identity provider. When the identity expires, every binding referencing it becomes inert automatically. **This is the right answer** — the expiry lives where identities live.
2. **A scheduled job that deletes the bindings**, with the deletion date in an annotation:
   ```yaml
   metadata:
     annotations:
       axispay.io/expires: "2026-09-25"
   ```
   Reconciled by a CronJob. It works, and it fails silently if the CronJob stops — which is exactly the failure mode of INC-5.
3. **A calendar reminder.** Honest about what it is. It will be missed.

**What breaks if someone forgets:** with (1), nothing — access simply stops. With (2), access persists until someone notices, and the next access review finds a grant with no owner. That asymmetry is the whole argument for (1).

**C2 — CI pipeline that may deploy only `payment-service`.**

```yaml
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    resourceNames: ["payment-service"]        # <- the restriction
    verbs: ["get", "update", "patch"]
  - apiGroups: ["apps"]
    resources: ["deployments/scale"]
    resourceNames: ["payment-service"]
    verbs: ["get", "update", "patch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["list", "watch"]                  # <- CANNOT be restricted by name
```

**Why `list` and `watch` cannot be restricted by `resourceNames`:** those verbs operate on a *collection*, and the authorisation decision is made before the collection is filtered. The API server cannot authorise "list, but only these" — it would have to fetch everything to decide. So `resourceNames` applies to `get`, `update`, `patch` and `delete`, and a role with `list` sees every Deployment in the namespace.

The practical consequence: your pipeline can **read** the names of all Deployments and **modify** only one. That is usually acceptable — names are not secrets — but say it out loud rather than assuming `resourceNames` is a complete boundary.

---

## L5.3 Helm

**C1 — `customer-service` as a subchart.**

```
charts/axispay/
  Chart.yaml            # add the dependency
  charts/
    customer-service/
      Chart.yaml
      values.yaml
      templates/deployment.yaml, service.yaml
```

```yaml
# charts/axispay/Chart.yaml
dependencies:
  - name: customer-service
    version: "1.0.0"
    repository: "file://charts/customer-service"
    condition: customer-service.enabled
```

```bash
helm dependency update ./charts/axispay
helm template axispay ./charts/axispay --set customer-service.enabled=false | grep -c customer
```

**Now the argument, which is the actual challenge.** A subchart is the wrong structure here, and you should be able to say why:

- `customer-service` is one of twelve near-identical Deployments. Extracting it means it no longer inherits the shared security context, the shared probes or the shared labels — the very properties the single template makes true by construction.
- The value path changes from `services.customer-service.replicas` to `customer-service.replicas`, so it is now configured differently from its eleven siblings for no reason a reader can infer.
- Subcharts earn their place when a component is **genuinely independent**: separately versioned, separately released, reused by another chart, or maintained by another team. None of that is true here.

The version worth building as a subchart is the *data tier* — Postgres, Redis, RabbitMQ — which is separately versioned, differs from the application workloads in kind, and is a plausible candidate for replacement by an upstream chart.

**Bonus — twelve explicit files versus one `range`.**

Write three of them out and compare honestly.

| | Twelve files | One `range` |
|---|---|---|
| Reviewing a change | See exactly what changed, per service | Read the template plus the values diff |
| Debugging at 02:00 | `cat` the file. Done. | `helm template \| grep -A40` |
| Adding a thirteenth service | Copy, paste, and forget one thing | Nine lines of values, full posture inherited |
| "Every service has three probes" | Hope, and a review checklist | True by construction |
| Onboarding someone new | Immediately legible | Needs the templating explained |

The honest conclusion: **ranging is right when the workloads are genuinely similar and the invariant matters more than the legibility.** For twelve near-identical stateless services with a security posture you must not get wrong, it is right. For three databases that differ from each other in kind, it is not — which is why the data tier in this repository is written out longhand.

---

## L5.4 Promotion

**C1 — `values-dr.yaml`.**

```yaml
# Disaster recovery region. 30% of production capacity, no ingress until a DNS
# cutover, and FULL alerting — so you learn it is broken before you need it.
global:
  environment: dr
services:
  edge-gateway:      { replicas: 2, antiAffinity: required, pdb: { maxUnavailable: 1 } }
  auth-service:      { replicas: 1 }
  payment-service:
    replicas: 2
    antiAffinity: required
    hpa: { enabled: true, minReplicas: 2, maxReplicas: 20, targetCPU: 60 }
  # ... the rest at roughly 30% of prod
ingress:
  enabled: false          # traffic arrives only after a DNS cutover
observability:
  enabled: true           # NOT reduced — see below
  alerts:
    enabled: true
    availabilitySLO: 99.5
networkPolicy: { enabled: true }
podSecurity:  { enforce: restricted }
```

The justifications that matter:

- **`ingress.enabled: false`, but the workloads still run.** DR capacity that is cold takes minutes to warm; capacity that is warm and unrouted takes seconds. The cost is running 30% of production permanently, and that is the trade the business is buying.
- **`hpa.maxReplicas` stays at the production value.** The point of DR is to absorb production traffic. A ceiling of 30% would fail at exactly the moment it is needed.
- **Alerting is at full strength, not reduced.** This is the one people get wrong. A DR environment with alerting turned down is one you discover is broken during the failover. The alerts firing in DR are noise you want.
- **Security identical.** Same argument as every other environment.

**Bonus — the CI check that would have prevented the four-hour investigation.**

```bash
#!/usr/bin/env bash
set -euo pipefail
a=$(helm template axispay ./charts/axispay -f charts/axispay/values-staging.yaml \
    | grep '^kind:' | sort | uniq -c)
b=$(helm template axispay ./charts/axispay -f charts/axispay/values-prod.yaml \
    | grep '^kind:' | sort | uniq -c)
if [[ "$a" != "$b" ]]; then
  echo "staging and production differ STRUCTURALLY, not just in size:"
  diff <(echo "$a") <(echo "$b")
  exit 1
fi
echo "staging and production have the same shape"
```

Ten lines. It would have caught the missing PodDisruptionBudgets before the forty-minute hung rollout.

---

## L5.5 Metrics

**C1 — Approval rate per acquirer, and why you cannot write it yet.**

The query you want:

```promql
sum by (acquirer) (rate(axispay_payments_total{status=~"captured|authorized"}[5m]))
  / sum by (acquirer) (rate(axispay_payments_total[5m]))
```

It returns nothing, because `axispay_payments_total` has labels `service`, `status`, `currency` — and no `acquirer`. **You cannot query a dimension you did not emit.**

The change, in `images/_shared/axispay_common/metrics.py`:

```python
PAYMENTS = Counter(
    "axispay_payments_total", "Payments by outcome",
    ["service", "status", "currency", "acquirer"],
)
```

and at the two call sites in `payment-service`, passing `acquirer` (using `"none"` rather than `None` for declines that never reached routing — a missing label value and an empty one are different, and Prometheus will reject `None`).

**The cardinality arithmetic, which is the actual challenge:**

| Label | Distinct values | Effect |
|---|---|---|
| service | 1 (this metric is only emitted by payment-service) | ×1 |
| status | 3 — captured, authorized, declined | ×3 |
| currency | 7 | ×7 |
| **acquirer** | **4** | **×4** |

3 × 7 × 4 = **84 series**. Trivial. Safe.

Now the same arithmetic for `merchant_id`: 25 today, 25 000 next year. 3 × 7 × 25 000 = **525 000 series from one metric**, growing with the business. That is the answer to "why not merchant_id" — and the reason is not that merchant is less interesting, but that its cardinality is *unbounded by the business model*. Acquirer is bounded by a commercial relationship; merchant is not.

The alert, once the label exists:

```yaml
- alert: AxisPayAcquirerApprovalRateLow
  expr: |
    (
      sum by (acquirer) (rate(axispay_payments_total{status=~"captured|authorized"}[5m]))
      / sum by (acquirer) (rate(axispay_payments_total[5m]))
    ) < 0.85
  for: 10m
  labels: { severity: warning, team: payments }
  annotations:
    summary: "{{ $labels.acquirer }} approval rate below 85%"
```

**Bonus — is it one slow replica or all of them?**

```promql
histogram_quantile(0.99, sum by (le, pod) (
  rate(axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))
```

If one pod's line sits consistently above the others, it is that pod: usually a node under memory pressure, a noisy neighbour, or a connection pool that never recovered after a downstream blip. An average across pods hides it completely, which is the point — the aggregate p99 tells you *that* the tail is bad, and the per-pod breakdown tells you *where*.

---

## L5.6 Logs and alerts

**C1 — From a payment reference to the full trail.**

You have `AXP-4471-ZA` and nothing else. Three hops:

```bash
#!/usr/bin/env bash
# trace-payment — reference -> payment -> correlation_id -> the cross-service trail
# Paste this at 02:00. It is the whole point of the correlation ID.
set -euo pipefail
REF="${1:?usage: trace-payment AXP-4471-ZA}"
NS_DATA="${NS_DATA:-axispay-data}"

# 1. reference -> payment_id and created_at (narrows the time window)
read -r PID CREATED < <(kubectl -n "$NS_DATA" exec postgres-0 -- \
  psql -U axispay_app -d axispay -t -A -F' ' \
  -c "SELECT payment_id, created_at FROM payments WHERE reference = '$REF';")
[[ -n "${PID:-}" ]] || { echo "no payment with reference $REF"; exit 1; }
echo "payment_id: $PID   created: $CREATED"

# 2. payment_id -> correlation_id, from the audit trail
CID=$(kubectl -n "$NS_DATA" exec postgres-0 -- \
  psql -U axispay_app -d axispay -t -A \
  -c "SELECT correlation_id FROM audit_events
      WHERE entity_type='payment' AND entity_id='$PID' LIMIT 1;")
echo "correlation_id: $CID"

# 3. correlation_id -> every log line, every service, in order
START=$(date -u -d "$CREATED - 2 minutes" +%s)000000000
END=$(date   -u -d "$CREATED + 5 minutes" +%s)000000000
curl -s -G 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode "query={namespace=~\"axispay-.*\"} | json | correlation_id=\"$CID\"" \
  --data-urlencode "start=$START" --data-urlencode "end=$END" \
  --data-urlencode 'limit=200' \
  | jq -r '.data.result[].values[][1]' \
  | jq -r '[.ts, .service, .msg, (.duration_ms // "-" | tostring)] | @tsv' \
  | sort
```

Two details that make it work at 02:00 rather than merely in principle:

- **Narrowing the Loki time window from `created_at`** turns a full-retention scan into a seven-minute one. Without it the query is slow exactly when you need it fast.
- **`audit_events` is the bridge.** The payments table does not store the correlation ID; the audit trail does, because it was designed to answer "what happened to this entity" — which is this question.

**Bonus — should `level` be a Loki label?**

**For:** `| level="error"` becomes an index lookup rather than a scan, and error-only queries are the common case during an incident. Measurable and real.

**Against:** it multiplies stream count by the number of distinct levels — typically 4 or 5 with `info` dominating. On this platform: 5 namespaces × ~12 services × ~3 pods × 5 levels ≈ 900 streams, against ~180 without. Both are trivially fine.

Measure it:

```logql
sum(count by (level) (count_over_time({namespace=~"axispay-.*"}[1h])))
```

**The judgement:** `level` is bounded and small, so promoting it is safe and useful. The rule is not "never promote a label" — it is "**promote only bounded labels, and know the bound**". `level` has four values forever. `correlation_id` has one per request. That difference, not the convenience, is what decides it.

---

## A note on the challenges you could not finish

Several of these — the acquirer label, the subchart, the DR values file — require a code change and a rebuild. If you ran out of time, the *reasoning* is the assessable part and it is all above. Come back to the implementation when you have a cluster and an afternoon; the arithmetic in C1 for L5.5 is the piece worth carrying into your own platform.
