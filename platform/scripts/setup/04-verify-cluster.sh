#!/usr/bin/env bash
# ==============================================================================
# Validate that the Minikube cluster is in the state the course expects.
# ==============================================================================
set -euo pipefail

D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"

K() { kubectl --context="${MINIKUBE_PROFILE:-axispay}" "$@"; }

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_B=$'\033[1m'; C_D=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$C_B" "$1" "$C_D"; }
ok()   { printf '  %sOK%s   %s\n' "$C_G" "$C_D" "$1"; }
warn() { printf '  %sWARN%s %s\n' "$C_Y" "$C_D" "$1"; }
die()  { printf '  %sFAIL%s %s\n' "$C_R" "$C_D" "$1"; exit 1; }

step "Checking cluster reachability"
K get nodes >/dev/null 2>&1 || die "kubectl cannot reach the cluster. Run: make cluster"

NODES=$(K get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')
READY=$(K get nodes --no-headers 2>/dev/null | grep -cw Ready || true)
[[ "${READY:-0}" -eq "${NODES:-0}" && "${NODES:-0}" -ge 1 ]] || die "${READY:-0}/${NODES:-0} nodes Ready; expected all nodes Ready"

step "Checking CNI"
K get daemonset -n kube-system calico-node >/dev/null 2>&1 || die "Calico is not installed. Recreate the cluster with --cni=calico"

step "Checking required addons"
K get pods -n kube-system -l k8s-app=metrics-server --no-headers 2>/dev/null | grep -q . || die "metrics-server is not running"
K get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --no-headers 2>/dev/null | grep -q . || die "ingress-nginx is not running"

step "Checking default storage class"
if K get storageclass 2>/dev/null | grep -q .; then
  ok "storage class present"
else
  warn "no storage class found; the Day 3 PVC lab will fail until provisioner is enabled"
fi

step "Final summary"
ok "cluster is reachable"
ok "${READY}/${NODES} nodes are Ready"
ok "Calico is present"
ok "metrics-server and ingress are running"

printf '\n%sCluster verification passed.%s\n' "$C_B" "$C_D"
