#!/usr/bin/env bash
# ==============================================================================
# End-of-day checkpoint — is the platform in the state the next day assumes?
# ==============================================================================
#   bash scripts/validate/checkpoint.sh 3
#   bash scripts/validate/checkpoint.sh 3 --wait      wait for rollouts first
#
# Called through the thin wrappers checkpoint-day1..5.sh, which is what the
# Makefile and the labs reference.
#
# WHY A CHECKPOINT AND NOT JUST THE LAB VALIDATORS
# Each lab validator proves one lab worked. This proves the DAY'S END STATE
# holds — including the things earlier days built that a later lab might have
# broken. Day 4 assumes Day 3's storage still works. If it does not, the
# fastest place to find out is here, at 17:00, and not at 09:15 tomorrow with
# twelve people waiting.
# ==============================================================================
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"

DAY="${1:-0}"; shift || true
WAIT=0; [[ "${1:-}" == "--wait" ]] && WAIT=1
[[ "$DAY" =~ ^[1-5]$ ]] || { echo "usage: checkpoint.sh <1-5> [--wait]"; exit 2; }
LAB_ID="DAY ${DAY} CHECKPOINT"; LAB_DOC="documents/reference/03-LAB-ROADMAP.md"

wait_for() {  # wait_for <ns> <kind/name>
  [[ $WAIT -eq 1 ]] || return 0
  K -n "$1" rollout status "$2" --timeout=240s >/dev/null 2>&1 || true
}

# ==============================================================================
header "Cluster"
# ==============================================================================
if K get nodes >/dev/null 2>&1; then
  NODES=$(K get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')
  READY=$(K get nodes --no-headers 2>/dev/null | grep -cw Ready || true)
  [[ "${READY:-0}" -eq "${NODES:-0}" && "${NODES:-0}" -ge 1 ]] \
    && pass "${READY}/${NODES} nodes Ready" \
    || fail "${READY:-0}/${NODES:-0} nodes Ready" "every node Ready" "kubectl get nodes"
else
  fail "cannot reach the cluster" "a running Minikube profile" \
       "minikube start -p ${MINIKUBE_PROFILE}"
  summary
fi

if [[ "$DAY" -ge 4 ]]; then
  K get daemonset -n kube-system calico-node >/dev/null 2>&1 \
    && pass "Calico present — NetworkPolicy is actually enforced" \
    || fail "Calico NOT found" "a policy-enforcing CNI" \
            "every policy applies cleanly and enforces NOTHING. Rebuild with --cni=calico"
fi

# ==============================================================================
header "Namespaces"
# ==============================================================================
NSLIST=("${NS_EDGE}" "${NS_CORE}")
[[ "$DAY" -ge 2 ]] && NSLIST+=("${NS_OPS}" "${NS_ASYNC}")
[[ "$DAY" -ge 3 ]] && NSLIST+=("${NS_DATA}")
[[ "$DAY" -ge 5 ]] && NSLIST+=("${NS_OBS}")
for ns in "${NSLIST[@]}"; do
  K get ns "$ns" >/dev/null 2>&1 && pass "$ns" \
    || fail "$ns missing" "the namespace" "kubectl apply -f manifests/00-namespaces/"
done

# ==============================================================================
header "Workloads for day ${DAY}"
# ==============================================================================
declare -a WL
WL=("${NS_EDGE}:edge-gateway:1" "${NS_EDGE}:auth-service:1"
    "${NS_CORE}:payment-service:1" "${NS_CORE}:merchant-service:1")
[[ "$DAY" -ge 2 ]] && WL+=("${NS_CORE}:fraud-service:1" "${NS_CORE}:routing-service:1")
[[ "$DAY" -ge 3 ]] && WL+=("${NS_CORE}:ledger-service:1" "${NS_CORE}:customer-service:1")
[[ "$DAY" -ge 4 ]] && WL+=("${NS_ASYNC}:settlement-service:1" "${NS_ASYNC}:notification-service:1"
                           "${NS_ASYNC}:audit-service:1" "${NS_ASYNC}:reporting-service:1")
[[ "$DAY" -ge 5 ]] && WL+=("${NS_OBS}:alert-sink:1")

for e in "${WL[@]}"; do
  IFS=: read -r ns name want <<< "$e"
  wait_for "$ns" "deployment/$name"
  assert_ready "$ns" "$name" "$want"
done

# ==============================================================================
header "Services have endpoints"
# ==============================================================================
for e in "${WL[@]}"; do
  IFS=: read -r ns name _ <<< "$e"
  assert_endpoints "$ns" "$name" 1
done

# ==============================================================================
[[ "$DAY" -ge 2 ]] && {
header "Day 2 — resources, probes and autoscaling"
NOLIM="$(K get pods -A -l app.kubernetes.io/part-of=axispay \
  -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.containers[0].resources.limits.memory}{"\n"}{end}' 2>/dev/null \
  | awk 'NF<2{print $1}')"
[[ -z "$NOLIM" ]] && pass "every container has a memory limit" \
  || fail "no memory limit on: $(echo "$NOLIM" | tr '\n' ' ')" "requests AND limits" \
          "an unlimited container can evict its neighbours"
K get hpa -n "${NS_CORE}" >/dev/null 2>&1 && \
  [[ "$(K get hpa -n "${NS_CORE}" --no-headers 2>/dev/null | wc -l | tr -d ' ')" -ge 1 ]] \
  && pass "HorizontalPodAutoscaler present" \
  || fail "no HPA in ${NS_CORE}" "at least one HPA" "kubectl apply -f manifests/day2/"
K get cronjob settlement-cron -n "${NS_ASYNC}" >/dev/null 2>&1 \
  && pass "settlement-cron CronJob present" \
  || fail "settlement-cron missing" "the nightly batch" "kubectl apply -f manifests/day2/workloads/"
}

# ==============================================================================
[[ "$DAY" -ge 3 ]] && {
header "Day 3 — storage and configuration"
K -n "${NS_DATA}" get statefulset postgres >/dev/null 2>&1 \
  && pass "postgres StatefulSet present" \
  || fail "postgres StatefulSet missing" "the database" "kubectl apply -f manifests/day3/"
PVC="$(K get pvc -n "${NS_DATA}" --no-headers 2>/dev/null | awk '$2!="Bound"{print $1}')"
[[ -z "$PVC" ]] && pass "every PVC is Bound" \
  || fail "unbound PVCs: $(echo "$PVC" | tr '\n' ' ')" "Bound" \
          "kubectl describe pvc -n ${NS_DATA}   # usually a StorageClass that does not exist"
ROWS="$(K -n "${NS_DATA}" exec postgres-0 -- psql -U axispay_app -d axispay -t -A \
        -c 'SELECT COUNT(*) FROM payments;' 2>/dev/null | tr -d '[:space:]')"
[[ "${ROWS:-0}" -gt 0 ]] && pass "database seeded (${ROWS} payments)" \
  || fail "database not seeded" "seed data loaded" "make seed"
}

# ==============================================================================
[[ "$DAY" -ge 4 ]] && {
header "Day 4 — ingress, DNS and segmentation"
K get ingress -n "${NS_EDGE}" >/dev/null 2>&1 && \
  [[ "$(K get ingress -n "${NS_EDGE}" --no-headers 2>/dev/null | wc -l | tr -d ' ')" -ge 1 ]] \
  && pass "Ingress present" || fail "no Ingress in ${NS_EDGE}" "the merchant API" "kubectl apply -f manifests/day4/ingress/"
for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_DATA}" "${NS_ASYNC}"; do
  K get netpol default-deny-all -n "$ns" >/dev/null 2>&1 \
    || fail "$ns has no default-deny" "default-deny-all" "kubectl apply -f manifests/day4/netpol/"
done
K get netpol default-deny-all -n "${NS_CORE}" >/dev/null 2>&1 && pass "default-deny in place"
python3 "$D/simulate-netpol.py" >/dev/null 2>&1 \
  && pass "simulate-netpol.py: every policy assertion holds" \
  || fail "policy simulation reports failures" "all assertions holding" "python3 scripts/validate/simulate-netpol.py"
}

# ==============================================================================
[[ "$DAY" -ge 5 ]] && {
header "Day 5 — identity, packaging and observability"
DEF="$(K get pods -A -l app.kubernetes.io/part-of=axispay \
  -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.serviceAccountName}{"\n"}{end}' 2>/dev/null \
  | awk '$2=="default"{print $1}')"
[[ -z "$DEF" ]] && pass "no workload uses the default ServiceAccount" \
  || fail "still on default: $(echo "$DEF" | tr '\n' ' ')" "a named ServiceAccount each" \
          "kubectl apply -f manifests/day5/rbac/"
for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_ASYNC}"; do
  [[ "$(K get ns "$ns" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null)" == "restricted" ]] \
    || fail "$ns does not enforce restricted" "restricted" "kubectl apply -f manifests/day5/security/"
done
pass "Pod Security checked on the application namespaces"
python3 "$D/simulate-rbac.py"       >/dev/null 2>&1 && pass "RBAC assertions hold"   || fail "RBAC simulation fails" "28 assertions" "python3 scripts/validate/simulate-rbac.py"
python3 "$D/check-helm-chart.py"    >/dev/null 2>&1 && pass "chart assertions hold"  || fail "chart validation fails" "94 assertions" "python3 scripts/validate/check-helm-chart.py"
python3 "$D/check-promql.py"        >/dev/null 2>&1 && pass "PromQL assertions hold" || fail "PromQL validation fails" "all expressions valid" "python3 scripts/validate/check-promql.py"
K get crd servicemonitors.monitoring.coreos.com >/dev/null 2>&1 \
  && pass "Prometheus Operator installed" \
  || fail "ServiceMonitor CRD missing" "kube-prometheus-stack" "make observability"
}

# ==============================================================================
header "End-to-end — a payment still works"
# ==============================================================================
if [[ "$DAY" -ge 4 ]]; then
  CODE="$(curl -sk -o /dev/null -w '%{http_code}' -X POST "https://${INGRESS_HOST_API}/api/v1/payments" \
    -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H "Idempotency-Key: chk-d${DAY}-$(date +%s)" \
    -H 'Content-Type: application/json' \
    -d '{"merchant_reference":"AXP-CHECKPOINT","amount_minor":45000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
    2>/dev/null)"
  [[ "$CODE" == "201" ]] && pass "payment accepted through the Ingress (201)" \
    || fail "payment returned ${CODE}" "201 Created" \
            "curl -skv https://${INGRESS_HOST_API}/api/v1/payments ... ; kubectl logs -n ${NS_EDGE} deploy/edge-gateway"
else
  OUT="$(K exec -n "${NS_EDGE}" deploy/edge-gateway -- python3 -c "
import urllib.request,json
r=urllib.request.urlopen('http://payment-service.${NS_CORE}.svc.cluster.local:8080/api/v1/_info',timeout=5)
print(r.status)" 2>/dev/null | tr -d '[:space:]')"
  [[ "$OUT" == "200" ]] && pass "edge-gateway reaches payment-service in-cluster" \
    || fail "gateway could not reach payment-service (got '${OUT:-no response}')" "HTTP 200" \
            "kubectl exec -n ${NS_EDGE} deploy/edge-gateway -- nslookup payment-service.${NS_CORE}.svc.cluster.local"
fi

summary
