#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L1.4"; LAB_DOC="days/day1/labs/L1.4-deployments/"

header "L1.4 — From Pod to Deployment"
assert_resource deployment axispay-core payment-service "manifests/day1/deployments/04-deployment-payment-service.yaml"
assert_ready axispay-core payment-service 3

header "Ownership chain: Deployment -> ReplicaSet -> Pod"
RS="$(K get rs -n axispay-core -l app.kubernetes.io/name=payment-service \
      -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -n "$RS" ]]; then
  pass "ReplicaSet $RS created by the Deployment"
  OWNER="$(K get rs "$RS" -n axispay-core -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}' 2>/dev/null)"
  [[ "$OWNER" == "Deployment/payment-service" ]] \
    && pass "ReplicaSet ownerReference -> $OWNER" \
    || fail "ReplicaSet ownerReference is '$OWNER'" "Deployment/payment-service" \
            "kubectl get rs $RS -n axispay-core -o yaml | grep -A5 ownerReferences"
  POD="$(K get pods -n axispay-core -l app.kubernetes.io/name=payment-service \
         -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  POWNER="$(K get pod "$POD" -n axispay-core -o jsonpath='{.metadata.ownerReferences[0].kind}' 2>/dev/null)"
  [[ "$POWNER" == "ReplicaSet" ]] \
    && pass "Pod ownerReference -> ReplicaSet (not Deployment — this is the point)" \
    || fail "Pod ownerReference is '$POWNER'" "ReplicaSet" "kubectl get pod $POD -n axispay-core -o yaml"
else
  fail "no ReplicaSet found" "a ReplicaSet owned by the Deployment" \
       "kubectl get rs -n axispay-core"
fi

header "Self-healing — the reconciliation loop, observed"
BEFORE="$(K get pods -n axispay-core -l app.kubernetes.io/name=payment-service --no-headers 2>/dev/null | wc -l)"
VICTIM="$(K get pods -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
if [[ -n "$VICTIM" ]]; then
  echo "    deleting $VICTIM to prove the controller replaces it..."
  K delete pod "$VICTIM" -n axispay-core --wait=false >/dev/null 2>&1
  for _ in $(seq 1 30); do
    sleep 2
    RDY="$(K get deploy payment-service -n axispay-core -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
    [[ "${RDY:-0}" -ge 3 ]] && break
  done
  AFTER="$(K get pods -n axispay-core -l app.kubernetes.io/name=payment-service --no-headers 2>/dev/null | wc -l)"
  NOW="$(K get pods -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)"
  if [[ "$NOW" == *"$VICTIM"* ]]; then
    fail "deleted pod $VICTIM is still listed" "a NEW pod with a different name" "kubectl get pods -n axispay-core"
  else
    pass "deleted pod was replaced — replica count back to $AFTER (was $BEFORE)"
  fi
fi
summary
