#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L4.5"; LAB_DOC="labs/day4/L4.5-placement/"

header "L4.5 — Placement"
K get deploy payment-service -n "${NS_CORE}" -o jsonpath="{.spec.template.spec.affinity.podAntiAffinity.requiredDuringSchedulingIgnoredDuringExecution}" 2>/dev/null | grep -q . \
  && pass "payment-service has REQUIRED anti-affinity" \
  || fail "no required anti-affinity" "hard spread on the payment path" "kubectl apply -f manifests/day4/scheduling/01-placement.yaml"
K get deploy payment-service -n "${NS_CORE}" -o jsonpath="{.spec.template.spec.topologySpreadConstraints}" 2>/dev/null | grep -q . \
  && pass "payment-service has topologySpreadConstraints" || fail "no spread constraints" "" ""
K get deploy fraud-service -n "${NS_CORE}" -o jsonpath="{.spec.template.spec.affinity.podAntiAffinity.preferredDuringSchedulingIgnoredDuringExecution}" 2>/dev/null | grep -q . \
  && pass "fraud-service uses PREFERRED (its HPA scales past the node count)" \
  || fail "fraud-service anti-affinity" "preferred, not required" "required would cap autoscaling at the node count"

header "Replicas are actually on distinct nodes"
NODES="$(K get pods -n "${NS_CORE}" -l app.kubernetes.io/name=payment-service -o jsonpath="{.items[*].spec.nodeName}" 2>/dev/null)"
U="$(echo "$NODES" | tr " " "\n" | sort -u | grep -c .)"
T="$(echo "$NODES" | tr " " "\n" | grep -c .)"
[[ "${U:-0}" -eq "${T:-0}" && "${T:-0}" -ge 2 ]] \
  && pass "$T payment-service replicas on $U distinct nodes" \
  || fail "$T replicas on $U nodes" "one per node" "kubectl get pods -n ${NS_CORE} -o wide"
summary
