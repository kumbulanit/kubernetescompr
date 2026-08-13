#!/usr/bin/env bash
# ==============================================================================
# Capstone validation — the nine competencies, checked against the cluster
# ==============================================================================
#   bash platform/admin/validate/capstone-validate.sh
#   bash platform/admin/validate/capstone-validate.sh --brief     one line per section
#
# Exit 0 means the platform is in the state the change request required. It
# does not mean the student scored well — method is assessed by the instructor
# against capstone/rubric.md. This script checks the OUTCOME.
#
# Design rule, same as every other validator here: a failure names the expected
# state, the diagnostic command, and where to read about it. "FAILED" on its
# own teaches nothing.
# ==============================================================================
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="CAPSTONE"; LAB_DOC="capstone/README.md"

TARGET_TAG="${IMAGE_TAG_V2}"
BRIEF=0; [[ "${1:-}" == "--brief" ]] && BRIEF=1

# ==============================================================================
header "1 · Deploy — the release is where it should be"
# ==============================================================================
if command -v helm >/dev/null 2>&1; then
  STATUS="$(helm --kube-context="${MINIKUBE_PROFILE}" list -A -o json 2>/dev/null \
            | python3 -c 'import json,sys
try: rows=json.load(sys.stdin)
except Exception: rows=[]
print(next((r["status"] for r in rows if r["name"]=="axispay"), "MISSING"))' 2>/dev/null)"
  if [[ "$STATUS" == "deployed" ]]; then
    pass "Helm release axispay is 'deployed'"
  else
    fail "Helm release axispay is '${STATUS}'" \
         "status 'deployed'" \
         "helm history axispay   # then: helm rollback axispay"
  fi
else
  fail "helm not installed" "helm 3" "platform/scripts/setup/00-preflight.sh"
fi

# ==============================================================================
header "2 · Upgrade — every workload is on ${TARGET_TAG}"
# ==============================================================================
STRAGGLERS=0
while read -r ns name image; do
  [[ -z "${name:-}" ]] && continue
  if [[ "$image" == *":${TARGET_TAG}" ]]; then
    [[ $BRIEF -eq 0 ]] && pass "$ns/$name on ${TARGET_TAG}"
  else
    fail "$ns/$name is on '${image##*:}'" \
         "image tag ${TARGET_TAG}" \
         "kubectl -n $ns get deploy $name -o jsonpath='{.spec.template.spec.containers[0].image}'"
    STRAGGLERS=$((STRAGGLERS+1))
  fi
done < <(K get deploy -A -l app.kubernetes.io/part-of=axispay \
          -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{" "}{.spec.template.spec.containers[0].image}{"\n"}{end}' 2>/dev/null)
[[ $BRIEF -eq 1 && $STRAGGLERS -eq 0 ]] && pass "every Deployment is on ${TARGET_TAG}"

# The migration must have run EXACTLY once. Twice is a double-applied schema
# change, which in a settlement system is a data-integrity incident.
MIG=$(K get jobs -n "${NS_DATA}" -l axispay.io/migration=settlement-2.0.0 \
      --no-headers 2>/dev/null | wc -l | tr -d ' ')
MIG_OK=$(K get jobs -n "${NS_DATA}" -l axispay.io/migration=settlement-2.0.0 \
      -o jsonpath='{range .items[*]}{.status.succeeded}{"\n"}{end}' 2>/dev/null | grep -c '^1$' || true)
if [[ "${MIG:-0}" -eq 1 && "${MIG_OK:-0}" -eq 1 ]]; then
  pass "settlement migration Job ran exactly once and succeeded"
elif [[ "${MIG:-0}" -eq 0 ]]; then
  fail "settlement migration Job not found" \
       "one Job labelled axispay.io/migration=settlement-2.0.0" \
       "kubectl get jobs -n ${NS_DATA}"
else
  fail "settlement migration ran ${MIG} times (${MIG_OK} succeeded)" \
       "exactly one successful run" \
       "a schema migration applied twice is a data-integrity incident"
fi

# ==============================================================================
header "3 · Recover — everything Ready, nothing restarting"
# ==============================================================================
NOTREADY="$(K get pods -A -l app.kubernetes.io/part-of=axispay \
  -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name} {.status.phase} {range .status.conditions[?(@.type=="Ready")]}{.status}{end}{"\n"}{end}' 2>/dev/null \
  | awk '$3!="True"{print $1}' )"
if [[ -z "$NOTREADY" ]]; then
  pass "every AxisPay pod is Ready"
else
  fail "pods not Ready: $(echo "$NOTREADY" | tr '\n' ' ')" \
       "Ready=True on every pod" \
       "kubectl get pods -A -l app.kubernetes.io/part-of=axispay"
fi

for svc_ns in "${NS_EDGE}:edge-gateway" "${NS_CORE}:payment-service" \
              "${NS_CORE}:fraud-service" "${NS_ASYNC}:settlement-service"; do
  assert_endpoints "${svc_ns%%:*}" "${svc_ns##*:}" 1
done

RESTARTS="$(K get pods -A -l app.kubernetes.io/part-of=axispay \
  -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].restartCount}{"\n"}{end}' 2>/dev/null \
  | awk '$2>3{print $1"("$2")"}')"
if [[ -z "$RESTARTS" ]]; then
  pass "no pod has restarted more than three times"
else
  fail "high restart counts: $RESTARTS" \
       "a stable platform at the end of the window" \
       "kubectl describe pod <name>   # look at lastState.terminated.reason"
fi

# ==============================================================================
header "4 · Secure — nothing was weakened to restore service"
# ==============================================================================
# THE TRAP. If the data-tier policy is gone, INC-6 was 'fixed' by deleting the
# cardholder-data segmentation.
if K get netpol allow-core-and-async-to-data -n "${NS_DATA}" >/dev/null 2>&1; then
  ASYNC_OK=$(K get netpol allow-core-and-async-to-data -n "${NS_DATA}" -o json 2>/dev/null \
    | grep -c "${NS_ASYNC}" || true)
  if [[ "${ASYNC_OK:-0}" -ge 1 ]]; then
    pass "data-tier policy present AND still admits ${NS_ASYNC}"
  else
    fail "data-tier policy no longer admits ${NS_ASYNC}" \
         "the original policy from manifests/day4/netpol/05-data-tier.yaml" \
         "kubectl apply -f manifests/day4/netpol/05-data-tier.yaml"
  fi
else
  fail "data-tier NetworkPolicy IS MISSING" \
       "allow-core-and-async-to-data in ${NS_DATA}" \
       "DELETING IT IS THE WRONG FIX FOR INC-6 — it removes the cardholder-data
       segmentation. Restore with:
         kubectl apply -f manifests/day4/netpol/05-data-tier.yaml
       See capstone/rubric.md §3 (the trap)."
fi

for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_DATA}" "${NS_ASYNC}"; do
  K get netpol default-deny-all -n "$ns" >/dev/null 2>&1 \
    && { [[ $BRIEF -eq 0 ]] && pass "$ns still has default-deny"; } \
    || fail "$ns lost its default-deny policy" "default-deny-all" \
            "kubectl apply -f manifests/day4/netpol/01-default-deny.yaml"
done
[[ $BRIEF -eq 1 ]] && pass "default-deny intact in all four namespaces"

for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_ASYNC}"; do
  ENF="$(K get ns "$ns" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null)"
  [[ "$ENF" == "restricted" ]] \
    && { [[ $BRIEF -eq 0 ]] && pass "$ns still enforces restricted"; } \
    || fail "$ns enforces '${ENF:-none}', not restricted" "restricted" \
            "kubectl apply -f manifests/day5/security/01-pod-security.yaml"
done
[[ $BRIEF -eq 1 ]] && pass "Pod Security still restricted on the application namespaces"

# TLS — read the certificate the way a merchant would, not with curl -k
MIP="$(minikube ip -p "${MINIKUBE_PROFILE}" 2>/dev/null)"
if [[ -n "$MIP" ]] && command -v openssl >/dev/null 2>&1; then
  END="$(echo | timeout 10 openssl s_client -connect "${MIP}:443" \
         -servername "${INGRESS_HOST_API}" 2>/dev/null \
         | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [[ -n "$END" ]] && date -d "$END" +%s >/dev/null 2>&1 \
     && [[ "$(date -d "$END" +%s)" -gt "$(date +%s)" ]]; then
    pass "TLS certificate is valid until ${END}"
  else
    fail "TLS certificate is expired or unreadable (${END:-no certificate})" \
         "a certificate valid beyond now" \
         "openssl s_client -connect ${MIP}:443 -servername ${INGRESS_HOST_API} | openssl x509 -noout -dates
       NOTE: 'curl -k' succeeding proves nothing — -k disables the check that is failing."
  fi
else
  printf "  %s·%s  TLS check skipped (no minikube ip or openssl)\n" "$DIM" "$RST"
fi

# ==============================================================================
header "5 · Validate — the money has to balance"
# ==============================================================================
SQL_BAL="SELECT COALESCE(SUM(amount_minor),0) FROM ledger_entries;"
BAL="$(K -n "${NS_DATA}" exec postgres-0 -- \
       psql -U axispay_app -d axispay -t -A -c "$SQL_BAL" 2>/dev/null | tr -d '[:space:]')"
if [[ "${BAL:-x}" == "0" ]]; then
  pass "ledger balances to zero across $(K -n "${NS_DATA}" exec postgres-0 -- \
        psql -U axispay_app -d axispay -t -A -c 'SELECT COUNT(*) FROM ledger_entries;' 2>/dev/null | tr -d '[:space:]') entries"
else
  fail "ledger sums to ${BAL:-<unreadable>}, not zero" \
       "double-entry: every debit has a matching credit" \
       "kubectl -n ${NS_DATA} exec postgres-0 -- psql -U axispay_app -d axispay -c \\
         \"SELECT journal_id, SUM(amount_minor) FROM ledger_entries GROUP BY 1 HAVING SUM(amount_minor)<>0;\""
fi

UNBAL="$(K -n "${NS_DATA}" exec postgres-0 -- psql -U axispay_app -d axispay -t -A -c \
  "SELECT COUNT(*) FROM (SELECT journal_id FROM ledger_entries GROUP BY 1 HAVING SUM(amount_minor)<>0) x;" \
  2>/dev/null | tr -d '[:space:]')"
[[ "${UNBAL:-x}" == "0" ]] \
  && pass "every individual journal balances, not just the total" \
  || fail "${UNBAL} journal(s) do not balance" "each journal sums to zero" \
          "a total of zero can hide two offsetting errors — this is the real check"

# No duplicate payments: the idempotency contract
DUPES="$(K -n "${NS_DATA}" exec postgres-0 -- psql -U axispay_app -d axispay -t -A -c \
  "SELECT COUNT(*) FROM (SELECT idempotency_key FROM payments WHERE idempotency_key IS NOT NULL
   GROUP BY 1 HAVING COUNT(*)>1) x;" 2>/dev/null | tr -d '[:space:]')"
[[ "${DUPES:-x}" == "0" ]] \
  && pass "no payment was processed twice" \
  || fail "${DUPES} idempotency key(s) map to more than one payment" \
          "zero — a retried request must never take money twice" \
          "SELECT idempotency_key, COUNT(*) FROM payments GROUP BY 1 HAVING COUNT(*)>1;"

# ==============================================================================
header "6 · Recover — the queue drained"
# ==============================================================================
QD="$(K -n "${NS_DATA}" exec deploy/rabbitmq -- \
      rabbitmqctl list_queues name messages --quiet 2>/dev/null \
      | awk 'NR>0 && $2>0 {print $1"="$2}' | tr '\n' ' ')"
if [[ -z "${QD// /}" ]]; then
  pass "all RabbitMQ queues are empty"
else
  fail "queues still holding messages: ${QD}" \
       "zero depth — consumers caught up" \
       "kubectl -n ${NS_DATA} exec deploy/rabbitmq -- rabbitmqctl list_queues name messages consumers"
fi

# ==============================================================================
header "7 · Monitor — observability survived the window"
# ==============================================================================
SM=$(K get servicemonitor -A -l app.kubernetes.io/part-of=axispay --no-headers 2>/dev/null | wc -l | tr -d ' ')
[[ "${SM:-0}" -ge 5 ]] && pass "${SM} ServiceMonitors still registered" \
  || fail "only ${SM:-0} ServiceMonitors" "5" "kubectl get servicemonitor -A"

K get prometheusrule axispay-slo -n "${NS_OBS}" >/dev/null 2>&1 \
  && pass "alert rules still applied" \
  || fail "PrometheusRule axispay-slo missing" "the SLO rules" \
          "kubectl apply -f manifests/day5/observability/02-prometheusrules.yaml"

# ==============================================================================
header "8 · Deploy — a payment still works, end to end"
# ==============================================================================
KEY="capstone-validate-$(date +%s)"
RESP="$(curl -sk -o /tmp/axp-cap.json -w '%{http_code}' -X POST \
  "https://${INGRESS_HOST_API}/api/v1/payments" \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
  -H "Idempotency-Key: ${KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-CAPSTONE-001","amount_minor":125000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  2>/dev/null)"
if [[ "$RESP" == "201" ]]; then
  pass "payment accepted (201) — $(python3 -c 'import json;print(json.load(open("/tmp/axp-cap.json"))["payment_id"])' 2>/dev/null)"
else
  fail "payment POST returned ${RESP}" "201 Created" \
       "curl -skv https://${INGRESS_HOST_API}/api/v1/payments ...  # then check the gateway logs"
fi

REPLAY="$(curl -sk -D- -o /dev/null -X POST "https://${INGRESS_HOST_API}/api/v1/payments" \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
  -H "Idempotency-Key: ${KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-CAPSTONE-001","amount_minor":125000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  2>/dev/null | grep -ci 'Idempotent-Replay: true' || true)"
[[ "${REPLAY:-0}" -ge 1 ]] \
  && pass "the same request replayed did not take money twice" \
  || fail "replay did not return Idempotent-Replay: true" \
          "the second identical POST must return 200 with the original payment" \
          "this is the contract that protects a merchant's retry"

# ==============================================================================
header "9 · Offline checks — the artefacts still agree with each other"
# ==============================================================================
for s in check-manifests.py simulate-netpol.py simulate-rbac.py check-helm-chart.py check-promql.py; do
  if python3 "$D/$s" >/dev/null 2>&1; then
    pass "$s"
  else
    fail "$s reports failures" "all assertions holding" "python3 platform/admin/validate/$s"
  fi
done

summary
