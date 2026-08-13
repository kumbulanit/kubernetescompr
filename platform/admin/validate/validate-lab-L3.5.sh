#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.5"; LAB_DOC="days/day3/labs/L3.5-data-tier/"

header "L3.5 — Data tier"
for s in postgres redis rabbitmq; do
  RDY="$(K get statefulset "$s" -n "${NS_DATA}" -o jsonpath="{.status.readyReplicas}" 2>/dev/null || echo 0)"
  [[ "${RDY:-0}" -ge 1 ]] && pass "StatefulSet $s: ${RDY} ready" \
    || fail "StatefulSet $s not ready" "1 ready replica" "kubectl describe statefulset $s -n ${NS_DATA}"
done
for p in data-postgres-0 data-redis-0 data-rabbitmq-0; do
  PH="$(K get pvc "$p" -n "${NS_DATA}" -o jsonpath="{.status.phase}" 2>/dev/null)"
  [[ "$PH" == "Bound" ]] && pass "PVC $p Bound" \
    || fail "PVC $p is $PH" "Bound" "kubectl describe pvc $p -n ${NS_DATA}"
done

header "Seed data"
CNT="$(K exec -n "${NS_DATA}" postgres-0 -- psql -U axispay_app -d axispay -t -A -c "SELECT COUNT(*) FROM payments;" 2>/dev/null | tr -d "[:space:]")"
[[ "${CNT:-0}" -ge 4900 ]] && pass "$CNT payments loaded" \
  || fail "only ${CNT:-0} payments" "5000" "./platform/scripts/setup/05-seed-database.sh"

header "THE INVARIANT — the ledger must balance"
IMB="$(K exec -n "${NS_DATA}" postgres-0 -- psql -U axispay_app -d axispay -t -A -c "SELECT COALESCE(SUM(imbalance),0) FROM v_ledger_balance;" 2>/dev/null | tr -d "[:space:]")"
if [[ "${IMB:-x}" == "0" ]]; then
  pass "ledger imbalance is 0 in every currency (sum DR == sum CR)"
else
  fail "ledger imbalance is ${IMB:-unknown}" "0" \
       "kubectl exec -n ${NS_DATA} postgres-0 -- psql -U axispay_app -d axispay -c \"SELECT * FROM v_ledger_balance;\""
fi
BAD="$(K exec -n "${NS_DATA}" postgres-0 -- psql -U axispay_app -d axispay -t -A -c "SELECT COUNT(*) FROM payments WHERE amount_minor <> fee_minor + net_minor;" 2>/dev/null | tr -d "[:space:]")"
[[ "${BAD:-1}" == "0" ]] && pass "every payment satisfies amount = fee + net" \
  || fail "${BAD} payments do not balance" "0" "the payments_balance CHECK should make this impossible"
summary
