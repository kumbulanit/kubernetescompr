#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L2.4"; LAB_DOC="days/day2/labs/L2.4-autoscaling/"

header "L2.4 — Horizontal Pod Autoscalers"
for h in payment-service fraud-service; do
  assert_resource hpa "${NS_CORE}" "$h" "manifests/day2/autoscaling/01-hpa-payment-service.yaml"
done
K get hpa -n "${NS_CORE}" --no-headers 2>/dev/null | sed 's/^/    /'

header "TARGETS must be a percentage, never <unknown>"
for h in payment-service fraud-service; do
  CUR="$(K get hpa "$h" -n "${NS_CORE}" -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' 2>/dev/null || true)"
  if [[ -n "$CUR" ]]; then
    pass "$h reporting ${CUR}% utilisation"
  else
    fail "$h reports <unknown>" \
         "a CPU percentage" \
         "no CPU request on the target, or metrics-server is down. kubectl describe hpa $h -n ${NS_CORE}"
  fi
done

header "HPA target sanity"
for h in payment-service fraud-service; do
  read -r mn mx tgt <<<"$(K get hpa "$h" -n "${NS_CORE}" -o jsonpath='{.spec.minReplicas} {.spec.maxReplicas} {.spec.scaleTargetRef.name}' 2>/dev/null)"
  [[ -n "$mn" && "$mn" -le "$mx" ]] && pass "$h min=$mn max=$mx target=$tgt" \
    || fail "$h min=$mn max=$mx" "min <= max" "kubectl get hpa $h -n ${NS_CORE} -o yaml"
  K get deploy "$tgt" -n "${NS_CORE}" >/dev/null 2>&1 \
    && pass "$h scaleTargetRef resolves to a real Deployment" \
    || fail "$h target Deployment '$tgt' not found" "" "kubectl get deploy -n ${NS_CORE}"
done

header "scale-down must be slower than scale-up (prevents flapping)"
K get hpa payment-service -n "${NS_CORE}" -o json 2>/dev/null | python3 -c "
import json,sys
b=json.load(sys.stdin)['spec'].get('behavior',{})
up=b.get('scaleUp',{}).get('stabilizationWindowSeconds',0)
dn=b.get('scaleDown',{}).get('stabilizationWindowSeconds',300)
print(f'scaleUp {up}s, scaleDown {dn}s')
sys.exit(0 if dn>up else 1)" 2>/dev/null | sed 's/^/    /' \
  && pass "scale-down window exceeds scale-up" \
  || fail "scale-down is not slower than scale-up" "scaleDown > scaleUp stabilization" "see L2.4 step 6"
summary
