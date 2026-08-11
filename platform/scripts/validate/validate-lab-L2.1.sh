#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L2.1"; LAB_DOC="days/day2/labs/L2.1-resources/"

header "L2.1 — Requests, limits and QoS"
for e in "${NS_EDGE} edge-gateway" "${NS_EDGE} auth-service" \
         "${NS_CORE} merchant-service" "${NS_CORE} payment-service" \
         "${NS_CORE} fraud-service" "${NS_CORE} routing-service"; do
  # shellcheck disable=SC2086
  set -- $e; ns="$1"; name="$2"
  J="$(K get deploy "$name" -n "$ns" -o json 2>/dev/null)" || { fail "$name not found" "" "kubectl get deploy -n $ns"; continue; }
  read -r cr cl mr ml <<<"$(echo "$J" | python3 -c "
import json,sys
c=json.load(sys.stdin)['spec']['template']['spec']['containers'][0].get('resources',{})
r=c.get('requests',{}); l=c.get('limits',{})
print(r.get('cpu','-'), l.get('cpu','-'), r.get('memory','-'), l.get('memory','-'))")"
  if [[ "$cr" != "-" && "$cl" != "-" && "$mr" != "-" && "$ml" != "-" ]]; then
    pass "$name  cpu ${cr}/${cl}  mem ${mr}/${ml}"
  else
    fail "$name missing resources (cpu ${cr}/${cl} mem ${mr}/${ml})" \
         "requests AND limits for cpu and memory" \
         "kubectl apply -f manifests/day2/resources/"
  fi
done

header "QoS classes"
K get pods -A -l app.kubernetes.io/part-of=axispay \
  -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass --no-headers 2>/dev/null \
  | awk '{print "    "$1"  "$2}' | head -12
BE="$(K get pods -A -l app.kubernetes.io/part-of=axispay -o jsonpath='{.items[*].status.qosClass}' 2>/dev/null | tr ' ' '\n' | grep -c BestEffort || true)"
[[ "${BE:-0}" -eq 0 ]] && pass "no BestEffort pods — every workload declares resources" \
  || fail "${BE} BestEffort pod(s)" "all Burstable or Guaranteed" "kubectl get pods -A -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass"

header "metrics-server (needed by L2.4)"
K top pods -n "${NS_CORE}" >/dev/null 2>&1 \
  && pass "kubectl top returns data" \
  || fail "kubectl top unavailable" "metrics-server running" "minikube addons enable metrics-server -p ${MINIKUBE_PROFILE}; wait 60s"
summary
