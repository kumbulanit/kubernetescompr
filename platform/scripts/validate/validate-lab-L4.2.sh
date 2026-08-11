#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L4.2"; LAB_DOC="days/day4/labs/L4.2-dns/"

header "L4.2 — CoreDNS"
RDY="$(K get deployment coredns -n kube-system -o jsonpath="{.status.readyReplicas}" 2>/dev/null || echo 0)"
[[ "${RDY:-0}" -ge 1 ]] && pass "CoreDNS has ${RDY} ready replica(s)" \
  || fail "CoreDNS not ready" ">=1" "kubectl get pods -n kube-system -l k8s-app=kube-dns"
K get svc kube-dns -n kube-system >/dev/null 2>&1 && pass "kube-dns Service exists" \
  || fail "kube-dns Service missing" "" ""

header "Resolution from inside the cluster"
OUT="$(K run dns-validate-$RANDOM -n "${NS_CORE}" --rm -i --restart=Never --image=busybox:1.37 -- \
  sh -c "nslookup payment-service.axispay-core.svc.cluster.local >/dev/null 2>&1 && echo OK || echo FAIL" 2>/dev/null | tr -d "[:space:]")"
[[ "$OUT" == *OK* ]] && pass "FQDN resolves from a pod" \
  || fail "FQDN did not resolve" "OK" "kubectl get pods -n kube-system -l k8s-app=kube-dns"
summary
