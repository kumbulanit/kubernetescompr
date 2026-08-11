#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L4.1"; LAB_DOC="days/day4/labs/L4.1-service-types/"

header "L4.1 — Service taxonomy"
for e in "${NS_EDGE} edge-gateway-nodeport NodePort" "${NS_CORE} acquirer-gateway ExternalName" \
         "${NS_CORE} payment-service-headless ClusterIP"; do
  # shellcheck disable=SC2086
  set -- $e; ns="$1"; nm="$2"; want="$3"
  T="$(K get svc "$nm" -n "$ns" -o jsonpath="{.spec.type}" 2>/dev/null)"
  [[ "${T:-ClusterIP}" == "$want" ]] && pass "$nm is $want" \
    || fail "$nm is ${T:-missing}" "$want" "kubectl apply -f manifests/day4/services/"
done
CIP="$(K get svc payment-service-headless -n "${NS_CORE}" -o jsonpath="{.spec.clusterIP}" 2>/dev/null)"
[[ "$CIP" == "None" ]] && pass "payment-service-headless is headless (clusterIP: None)" \
  || fail "clusterIP is $CIP" "None" ""

header "Four networking rules — pod-to-pod without NAT"
assert_endpoints "${NS_CORE}" payment-service 2
summary
