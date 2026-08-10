#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L4.4"; LAB_DOC="labs/day4/L4.4-networkpolicy/"

header "L4.4 — Zero-trust segmentation"
if ! K get daemonset -n kube-system calico-node >/dev/null 2>&1; then
  fail "CALICO NOT FOUND" "a policy-enforcing CNI" \
       "Every policy below applies cleanly and enforces NOTHING. Rebuild with --cni=calico."
else
  pass "Calico present — policies are actually enforced"
fi

header "Default deny in every namespace"
for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_DATA}" "${NS_ASYNC}"; do
  if K get netpol default-deny-all -n "$ns" >/dev/null 2>&1; then
    pass "$ns has default-deny-all"
  else
    fail "$ns has NO default-deny" "a default-deny policy" "kubectl apply -f manifests/day4/netpol/"
  fi
done

header "DNS egress — the rule everyone forgets"
for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_DATA}" "${NS_ASYNC}"; do
  K get netpol allow-dns-egress -n "$ns" >/dev/null 2>&1 \
    && pass "$ns permits DNS egress" \
    || fail "$ns blocks DNS" "allow-dns-egress" "every service call will fail with a resolution error"
done

header "THE CONTROL — the DMZ must not reach the vault"
OUT="$(K exec -n "${NS_EDGE}" deploy/edge-gateway -- python3 -c "
import socket
try:
    socket.create_connection((\"postgres-0.postgres.axispay-data.svc.cluster.local\",5432),timeout=5)
    print(\"REACHABLE\")
except Exception:
    print(\"BLOCKED\")" 2>/dev/null | tr -d "[:space:]")"
if [[ "$OUT" == "BLOCKED" ]]; then
  pass "edge-gateway CANNOT reach PostgreSQL — segmentation holds"
elif [[ "$OUT" == "REACHABLE" ]]; then
  fail "edge-gateway CAN reach PostgreSQL" "blocked" \
       "In a PCI assessment this puts the DMZ inside the CDE. See L4.4 step 6."
else
  printf "  %s○%s could not test the DMZ->vault path (gateway pod unavailable)\n" "$YEL" "$RST"
fi

header "Policy logic simulation"
python3 "$R/scripts/validate/simulate-netpol.py" >/dev/null 2>&1 \
  && pass "all 39 policy assertions hold" \
  || fail "policy simulation failed" "39/39" "python3 scripts/validate/simulate-netpol.py"
summary
