#!/usr/bin/env bash
# Instructor escape hatch for INC-4.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "C — removing the over-broad policy..."
K -n "${NS_CORE}" delete networkpolicy tighten-fraud-ingress --ignore-not-found >/dev/null

echo "A — restoring the Ingress..."
K apply -f "$R/platform/manifests/day4/ingress/01-ingress.yaml" >/dev/null

echo "B — restoring CoreDNS..."
if K -n kube-system get cm coredns-backup-inc4 >/dev/null 2>&1; then
  CF="$(K -n kube-system get cm coredns-backup-inc4 -o jsonpath='{.data.Corefile}')"
  K -n kube-system patch cm coredns --type merge \
    -p "$(python3 -c 'import json,sys; print(json.dumps({"data":{"Corefile":sys.stdin.read()}}))' <<< "$CF")" >/dev/null
  K -n kube-system delete cm coredns-backup-inc4 >/dev/null
else
  CF="$(K -n kube-system get cm coredns -o jsonpath='{.data.Corefile}' | sed 's/kubernets /kubernetes /')"
  K -n kube-system patch cm coredns --type merge \
    -p "$(python3 -c 'import json,sys; print(json.dumps({"data":{"Corefile":sys.stdin.read()}}))' <<< "$CF")" >/dev/null
fi
K -n kube-system rollout restart deployment/coredns >/dev/null
K -n kube-system rollout status deployment/coredns --timeout=120s

echo "INC-4 resolved. Verify: python3 platform/admin/validate/simulate-netpol.py"
