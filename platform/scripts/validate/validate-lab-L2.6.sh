#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L2.6"; LAB_DOC="days/day2/labs/L2.6-zero-downtime-rollout/"

header "L2.6 — payment-service is on v1.1.0"
IMG="$(K get deploy payment-service -n "${NS_CORE}" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)"
[[ "$IMG" == *":1.1.0" ]] && pass "image $IMG" \
  || fail "image is $IMG" "axispay/payment-service:1.1.0" "kubectl apply -f manifests/day2/rollout/"
FLAG="$(K get deploy payment-service -n "${NS_CORE}" -o json 2>/dev/null | python3 -c "
import json,sys
for e in json.load(sys.stdin)['spec']['template']['spec']['containers'][0].get('env',[]):
    if e['name']=='ENABLE_RISK_ROUTING': print(e.get('value')); break
else: print('unset')")"
[[ "$FLAG" == "true" ]] && pass "ENABLE_RISK_ROUTING=true — fraud and routing are on the payment path" \
  || fail "ENABLE_RISK_ROUTING=$FLAG" "true" "kubectl apply -f manifests/day2/rollout/"
assert_ready "${NS_CORE}" payment-service 3

header "Zero-downtime strategy"
read -r MU MS <<<"$(K get deploy payment-service -n "${NS_CORE}" \
  -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable} {.spec.strategy.rollingUpdate.maxSurge}' 2>/dev/null)"
[[ "$MU" == "0" ]] && pass "maxUnavailable=0 — capacity never drops" \
  || fail "maxUnavailable=$MU" "0" "a release must not reduce capacity on the payment path"
[[ -n "$MS" && "$MS" != "0" ]] && pass "maxSurge=$MS" \
  || fail "maxSurge=$MS" "at least 1" "with maxUnavailable 0 and maxSurge 0 the rollout can never start"
K get deploy payment-service -n "${NS_CORE}" -o jsonpath='{.spec.progressDeadlineSeconds}' 2>/dev/null | grep -q . \
  && pass "progressDeadlineSeconds set — a stuck rollout eventually fails" \
  || fail "no progressDeadlineSeconds" "set it" "otherwise a broken release stays 'in progress' forever"

header "Rollback is available"
REVS="$(K rollout history deployment/payment-service -n "${NS_CORE}" 2>/dev/null | grep -c '^[0-9]' || echo 0)"
[[ "${REVS:-0}" -ge 2 ]] && pass "${REVS} revisions in history — rollback possible" \
  || fail "only ${REVS} revision(s)" ">= 2" "roll out v1.1.0 to create one"

header "v1.1.0 behaviour is live — a real payment carries risk and acquirer"
OUT="$(K run l26-verify-$RANDOM -n "${NS_EDGE}" --rm -i --restart=Never \
  --image=curlimages/curl:8.11.1 --command -- sh -c '
  T=$(curl -s --max-time 6 -X POST http://edge-gateway:8080/api/v1/login \
      -H "Content-Type: application/json" \
      -d "{\"api_key\":\"ak_live_kalahari_7QK2XD9P4A\"}" \
      | tr "," "\n" | grep access_token | cut -d: -f2 | tr -d "\" ")
  curl -s --max-time 8 -X POST http://edge-gateway:8080/api/v1/charges \
    -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
    -d "{\"amount_minor\":129900,\"currency\":\"ZAR\",\"card_token\":\"tok_a71ef4c2900bd5386ff1240e\"}"' 2>/dev/null || true)"
if echo "$OUT" | grep -q '"risk_score"' && echo "$OUT" | grep -q '"acquirer"'; then
  pass "payment returned risk_score and acquirer"
  echo "$OUT" | tr ',' '\n' | grep -E 'risk_score|acquirer|auth_code|status' | sed 's/^/      /'
else
  fail "payment did not return v1.1.0 fields" "risk_score and acquirer in the response" \
       "check fraud-service and routing-service are Ready"
fi
summary
