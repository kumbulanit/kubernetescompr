#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L1.6"; LAB_DOC="days/day1/labs/L1.6-platform-assembly/"

header "L1.6 — Four services, one platform"
assert_ready axispay-edge edge-gateway     2
assert_ready axispay-edge auth-service     2
assert_ready axispay-core merchant-service 2
assert_ready axispay-core payment-service  3
for e in "axispay-edge edge-gateway" "axispay-edge auth-service" \
         "axispay-core merchant-service" "axispay-core payment-service"; do
  # shellcheck disable=SC2086
  set -- $e; assert_endpoints "$1" "$2" 2
done

header "END-TO-END: a real payment through the whole platform"
RESULT="$(K run axispay-e2e-$RANDOM -n axispay-edge --rm -i --restart=Never \
  --image=curlimages/curl:8.11.1 --command -- sh -c '
  TOKEN=$(curl -s --max-time 5 -X POST http://edge-gateway:8080/api/v1/login \
    -H "Content-Type: application/json" \
    -d "{\"api_key\":\"ak_live_kalahari_7QK2XD9P4A\"}" \
    | tr "," "\n" | grep access_token | cut -d: -f2 | tr -d "\" ")
  [ -z "$TOKEN" ] && echo "LOGIN_FAILED" && exit 1
  curl -s --max-time 5 -o /tmp/r.json -w "HTTP:%{http_code}\n" -X POST http://edge-gateway:8080/api/v1/charges \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -H "Idempotency-Key: lab-l16-validate" \
    -d "{\"amount_minor\":129900,\"currency\":\"ZAR\",\"card_token\":\"tok_a71ef4c2900bd5386ff1240e\",\"description\":\"L1.6 validation\"}"
  cat /tmp/r.json' 2>/dev/null || true)"

if echo "$RESULT" | grep -q "HTTP:201\|HTTP:200"; then
  pass "payment created end-to-end (gateway -> auth -> payment -> merchant)"
  echo "$RESULT" | tr ',' '\n' | grep -E 'payment_id|reference|status|display_amount|fee_minor' | sed 's/^/      /'
else
  fail "end-to-end payment did not succeed" \
       "HTTP 201 from POST /api/v1/charges" \
       "kubectl run -n axispay-edge dbg --rm -it --image=curlimages/curl:8.11.1 -- sh"
  echo "$RESULT" | head -5 | sed 's/^/      /'
fi

header "Cross-namespace DNS (edge -> core)"
DNS="$(K run axispay-dns-$RANDOM -n axispay-edge --rm -i --restart=Never \
  --image=curlimages/curl:8.11.1 --command -- sh -c '
  curl -s -o /dev/null -w "%{http_code}" --max-time 4 \
    http://payment-service.axispay-core.svc.cluster.local:8080/healthz' 2>/dev/null || true)"
[[ "$DNS" == "200" ]] \
  && pass "axispay-edge can resolve and reach payment-service.axispay-core" \
  || fail "cross-namespace call returned '$DNS'" "200" \
          "kubectl exec -n axispay-edge deploy/edge-gateway -- nslookup payment-service.axispay-core.svc.cluster.local"
summary
