#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.1"; LAB_DOC="labs/day3/L3.1-configmaps/"

header "L3.1 — ConfigMaps"
assert_resource configmap "${NS_CORE}" axispay-platform-config "manifests/day3/config/01-configmap-platform.yaml"
assert_resource configmap "${NS_CORE}" axispay-fraud-rules     "manifests/day3/config/01-configmap-platform.yaml"
for k in LOG_LEVEL POSTGRES_HOST SUPPORTED_CURRENCIES MERCHANT_SERVICE_URL; do
  V="$(K get configmap axispay-platform-config -n "${NS_CORE}" -o jsonpath="{.data.$k}" 2>/dev/null)"
  [[ -n "$V" ]] && pass "key $k = $V" \
    || fail "key $k missing" "present in the ConfigMap" "kubectl get cm axispay-platform-config -n ${NS_CORE} -o yaml"
done

header "A workload consumes it"
POD="$(K get pods -n "${NS_CORE}" -l app.kubernetes.io/name=payment-service -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)"
if [[ -n "$POD" ]]; then
  if K exec -n "${NS_CORE}" "$POD" -- printenv 2>/dev/null | grep -q "^SUPPORTED_CURRENCIES="; then
    pass "payment-service has ConfigMap values in its environment"
  else
    fail "payment-service is not consuming the ConfigMap" \
         "env from configmap/axispay-platform-config" \
         "kubectl set env deployment/payment-service -n ${NS_CORE} --from=configmap/axispay-platform-config"
  fi
fi
summary
