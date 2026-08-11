#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L4.6"; LAB_DOC="days/day4/labs/L4.6-pdb-drain/"

header "L4.6 — PodDisruptionBudgets"
for e in "${NS_CORE} payment-service" "${NS_CORE} merchant-service" "${NS_CORE} fraud-service" \
         "${NS_EDGE} edge-gateway" "${NS_EDGE} auth-service" "${NS_DATA} postgres"; do
  # shellcheck disable=SC2086
  set -- $e; ns="$1"; nm="$2"
  if K get pdb "$nm" -n "$ns" >/dev/null 2>&1; then
    A="$(K get pdb "$nm" -n "$ns" -o jsonpath="{.status.disruptionsAllowed}" 2>/dev/null)"
    pass "PDB $ns/$nm  (allowed disruptions: ${A:-?})"
  else
    fail "PDB $ns/$nm missing" "a disruption budget" "kubectl apply -f manifests/day4/disruption/"
  fi
done

header "Budgets must not BLOCK maintenance"
BLOCKED=0
for e in "${NS_CORE} payment-service" "${NS_CORE} fraud-service" "${NS_EDGE} edge-gateway"; do
  # shellcheck disable=SC2086
  set -- $e
  A="$(K get pdb "$2" -n "$1" -o jsonpath="{.status.disruptionsAllowed}" 2>/dev/null || echo 0)"
  [[ "${A:-0}" -eq 0 ]] && { BLOCKED=1; fail "$1/$2 allows ZERO disruptions" "at least 1" \
    "a node that cannot be drained cannot be patched — scale up or relax the budget"; }
done
[[ $BLOCKED -eq 0 ]] && pass "every PDB still permits a drain"

header "No node left cordoned"
C="$(K get nodes -o jsonpath="{range .items[?(@.spec.unschedulable==true)]}{.metadata.name}{\" \"}{end}" 2>/dev/null | tr -d "[:space:]")"
[[ -z "$C" ]] && pass "all nodes schedulable" \
  || fail "cordoned nodes: $C" "none" "kubectl uncordon --all"
summary
