#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.2"; LAB_DOC="labs/day3/L3.2-secrets/"

header "L3.2 — Secrets"
assert_resource secret "${NS_DATA}" axispay-db-credentials    "manifests/day3/secrets/01-secrets.yaml"
assert_resource secret "${NS_CORE}" axispay-db-credentials    "manifests/day3/secrets/01-secrets.yaml"
assert_resource secret "${NS_EDGE}" axispay-jwt-signing       "manifests/day3/secrets/01-secrets.yaml"
assert_resource secret "${NS_DATA}" axispay-redis-credentials "manifests/day3/secrets/01-secrets.yaml"

header "The JWT key must NO LONGER be visible in describe"
if K describe pod -n "${NS_EDGE}" -l app.kubernetes.io/name=auth-service 2>/dev/null \
     | grep -q "set to the key .JWT_SIGNING_KEY. in secret"; then
  pass "auth-service reads the key via secretKeyRef, not a plaintext value"
elif K describe pod -n "${NS_EDGE}" -l app.kubernetes.io/name=auth-service 2>/dev/null \
     | grep -q "JWT_SIGNING_KEY:.*day1-insecure"; then
  fail "the JWT key is STILL in plaintext in the pod spec" \
       "a secretKeyRef" \
       "kubectl set env deployment/auth-service -n ${NS_EDGE} --from=secret/axispay-jwt-signing"
else
  printf "  %s○%s auth-service JWT config not detected — check it manually\n" "$YEL" "$RST"
fi

header "Secret values are base64, NOT encrypted (this is the lesson, not a bug)"
DEC="$(K get secret axispay-db-credentials -n "${NS_DATA}" -o jsonpath="{.data.POSTGRES_PASSWORD}" 2>/dev/null | base64 -d 2>/dev/null)"
[[ -n "$DEC" ]] && pass "decoded in one command — anyone with get secrets can read it" \
  || fail "could not decode the secret" "a POSTGRES_PASSWORD key" "kubectl get secret -n ${NS_DATA} -o yaml"
summary
