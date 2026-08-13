#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L4.3"; LAB_DOC="days/day4/labs/L4.3-ingress-tls/"

header "L4.3 — Ingress and TLS"
K get pods -n ingress-nginx --no-headers 2>/dev/null | grep -q Running \
  && pass "ingress-nginx controller running" \
  || fail "no ingress controller" "a running controller" "minikube addons enable ingress -p ${MINIKUBE_PROFILE}"
assert_resource ingress "${NS_EDGE}" axispay-api "manifests/day4/ingress/01-ingress.yaml"
assert_resource ingress "${NS_ASYNC}" axispay-portal "manifests/day4/ingress/01-ingress.yaml"

PT="$(K get ingress axispay-api -n "${NS_EDGE}" -o jsonpath="{.spec.rules[0].http.paths[0].pathType}" 2>/dev/null)"
[[ "$PT" == "Prefix" ]] && pass "pathType is Prefix (Exact would 404 everything but one URL)" \
  || fail "pathType is $PT" "Prefix" "see L4.3 step 8 — this is INC-4a"

header "TLS"
for e in "${NS_EDGE} axispay-tls" "${NS_ASYNC} axispay-portal-tls"; do
  # shellcheck disable=SC2086
  set -- $e
  T="$(K get secret "$2" -n "$1" -o jsonpath="{.type}" 2>/dev/null)"
  [[ "$T" == "kubernetes.io/tls" ]] && pass "$2 is a TLS secret" \
    || fail "$2 type is ${T:-missing}" "kubernetes.io/tls" "./platform/scripts/setup/06-generate-tls.sh"
done
K get ingress axispay-api -n "${NS_EDGE}" -o jsonpath="{.spec.tls[0].secretName}" 2>/dev/null | grep -q . \
  && pass "Ingress references a TLS secret" || fail "no TLS block on the Ingress" "" ""
summary
