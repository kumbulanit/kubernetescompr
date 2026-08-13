#!/usr/bin/env bash
# ==============================================================================
# INC-4 — THREE unrelated faults  (Day 4, 16:25)
#
#   A (loud)   Ingress path narrowed + pathType Exact  -> 404 on everything
#   B (loud)   CoreDNS Corefile typo                   -> intermittent DNS
#   C (SILENT) over-broad NetworkPolicy on fraud-service -> approval rate 61%
#
# Teaches: prioritisation by customer impact, the failure mode with no error,
#          and the temptation to delete a security control to restore service.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Injecting INC-4 (three faults)..."

# --- A: narrow the Ingress path and make it Exact
K -n "${NS_EDGE}" patch ingress axispay-api --type json -p='[
  {"op":"replace","path":"/spec/rules/0/http/paths/0/path","value":"/api/v1/health"},
  {"op":"replace","path":"/spec/rules/0/http/paths/0/pathType","value":"Exact"}
]' >/dev/null 2>&1 || true

# --- B: break the CoreDNS Corefile
CF="$(K -n kube-system get cm coredns -o jsonpath='{.data.Corefile}')"
K -n kube-system create cm coredns-backup-inc4 --from-literal=Corefile="$CF" \
  --dry-run=client -o yaml | K apply -f - >/dev/null 2>&1 || true
BROKEN="${CF/kubernetes cluster.local/kubernets cluster.local}"
K -n kube-system patch cm coredns --type merge \
  -p "$(python3 -c 'import json,sys; print(json.dumps({"data":{"Corefile":sys.stdin.read()}}))' <<< "$BROKEN")" >/dev/null
K -n kube-system rollout restart deployment/coredns >/dev/null

# --- C: the silent one
cat <<'YAML' | K apply -f - >/dev/null
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tighten-fraud-ingress
  namespace: axispay-core
  labels: { app.kubernetes.io/part-of: axispay }
  annotations:
    kubernetes.io/change-cause: "tighten network policy — restrict fraud-service ingress"
spec:
  podSelector:
    matchLabels: { app.kubernetes.io/name: fraud-service }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app.kubernetes.io/name: reporting-service }
      ports: [{ protocol: TCP, port: 8080 }]
YAML

echo "Injected. Wait ~2 min, then hand out the ticket:"
echo "  days/day4/labs/INC-4-three-faults/ §2"
echo
echo "Watch:   kubectl get pods,ingress,netpol -A"
echo "Resolve: $D/resolve-INC-4.sh"
