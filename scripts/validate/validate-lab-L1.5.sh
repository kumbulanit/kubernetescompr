#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L1.5"; LAB_DOC="labs/day1/L1.5-services/"

header "L1.5 — Services and stable identity"
assert_resource service axispay-core payment-service "manifests/day1/services/04-service-payment-service.yaml"
assert_endpoints axispay-core payment-service 3

TYPE="$(K get svc payment-service -n axispay-core -o jsonpath='{.spec.type}' 2>/dev/null)"
[[ "$TYPE" == "ClusterIP" ]] && pass "Service type is ClusterIP" \
  || fail "Service type is '$TYPE'" "ClusterIP on Day 1 (NodePort/LoadBalancer come on Day 4)" \
          "kubectl get svc payment-service -n axispay-core -o yaml"

header "Load balancing — proved by asking WHICH POD answered"
echo "    running 20 requests through the Service ClusterIP..."
OUT="$(K run axispay-lbtest-$RANDOM -n axispay-core --rm -i --restart=Never \
        --image=curlimages/curl:8.11.1 --command -- sh -c '
        for i in $(seq 1 20); do
          curl -s --max-time 3 http://payment-service:8080/api/v1/_info \
            | tr "," "\n" | grep pod_name | cut -d: -f2 | tr -d "\" "
        done' 2>/dev/null | sort | uniq -c | sort -rn || true)"
DISTINCT="$(echo "$OUT" | grep -c . || echo 0)"
if [[ "${DISTINCT:-0}" -ge 2 ]]; then
  pass "traffic reached $DISTINCT distinct pods"
  echo "$OUT" | sed 's/^/      /'
else
  fail "traffic reached only ${DISTINCT} pod(s)" \
       "at least 2 distinct pods (the Service load-balances)" \
       "kubectl get endpointslice -n axispay-core -l kubernetes.io/service-name=payment-service"
fi
summary
