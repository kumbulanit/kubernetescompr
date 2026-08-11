#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.6"; LAB_DOC="days/day3/labs/L3.6-statefulsets/"

header "L3.6 — StatefulSets"
for s in postgres redis rabbitmq; do
  SN="$(K get statefulset "$s" -n "${NS_DATA}" -o jsonpath="{.spec.serviceName}" 2>/dev/null)"
  CIP="$(K get svc "$SN" -n "${NS_DATA}" -o jsonpath="{.spec.clusterIP}" 2>/dev/null)"
  [[ "$CIP" == "None" ]] && pass "$s -> headless Service '$SN'" \
    || fail "$s serviceName '$SN' clusterIP=$CIP" "None (headless)" "a StatefulSet needs a headless Service for stable per-pod DNS"
  K get statefulset "$s" -n "${NS_DATA}" -o jsonpath="{.spec.volumeClaimTemplates[0].metadata.name}" 2>/dev/null | grep -q . \
    && pass "$s has volumeClaimTemplates" || fail "$s has no volumeClaimTemplates" "one PVC per replica" ""
done

header "Stable identity"
K get pod postgres-0 -n "${NS_DATA}" >/dev/null 2>&1 \
  && pass "pod is named postgres-0 (ordinal identity, not a random suffix)" \
  || fail "postgres-0 not found" "stable ordinal naming" "kubectl get pods -n ${NS_DATA}"

header "Init container ordering"
if K get deployment payment-service -n "${NS_CORE}" -o jsonpath="{.spec.template.spec.initContainers[*].name}" 2>/dev/null | grep -q wait-for; then
  pass "payment-service has a wait-for-postgres init container"
else
  printf "  %s○%s init container not added yet — see L3.6 step 6\n" "$YEL" "$RST"
fi

header "The anti-pattern must be gone"
K get deployment bad-postgres -n "${NS_DATA}" >/dev/null 2>&1 \
  && fail "bad-postgres Deployment still exists" "deleted after step 1" "kubectl delete deployment bad-postgres -n ${NS_DATA}" \
  || pass "bad-postgres cleaned up"
summary
