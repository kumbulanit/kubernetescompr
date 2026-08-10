#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L1.1"; LAB_DOC="labs/day1/L1.1-cluster-recon/"

header "L1.1 — Cluster reconnaissance"
NODES="$(K get nodes --no-headers 2>/dev/null | wc -l)"
READY="$(K get nodes --no-headers 2>/dev/null | grep -cw Ready)"
[[ "${READY:-0}" -eq "${NODES:-0}" && "${NODES:-0}" -ge 1 ]] \
  && pass "all $READY/$NODES nodes Ready" \
  || fail "$READY of $NODES nodes Ready" "every node Ready" "kubectl describe node"
[[ "${NODES:-0}" -ge 2 ]] && pass "$NODES nodes — placement labs will work on Day 4" \
  || fail "only $NODES node" "2 or more nodes" "minikube node add -p ${MINIKUBE_PROFILE} (non-destructive)"

VER="$(K version -o json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['serverVersion']['gitVersion'])" 2>/dev/null)"
case "$VER" in v1.3[3456]*) pass "Kubernetes $VER is in the supported range (v1.33–v1.36)" ;;
  *) fail "Kubernetes version '$VER'" "v1.33–v1.36" "recreate with --kubernetes-version=${KUBERNETES_VERSION}" ;; esac

header "CRITICAL — CNI must enforce NetworkPolicy (Day 4 depends on this)"
if K get daemonset -n kube-system calico-node >/dev/null 2>&1; then
  pass "Calico DaemonSet present — NetworkPolicy will be enforced"
else
  fail "Calico NOT FOUND" "--cni=calico at cluster creation" \
       "CNI cannot be changed on a running cluster. Tell your instructor TODAY, not Thursday."
fi

header "Addons required later in the week"
for a in "metrics-server:kube-system:k8s-app=metrics-server" "ingress-nginx:ingress-nginx:app.kubernetes.io/name=ingress-nginx"; do
  IFS=: read -r name ns sel <<< "$a"
  if K get pods -n "$ns" -l "$sel" --no-headers 2>/dev/null | grep -q .; then pass "$name present"
  else fail "$name missing" "--addons=metrics-server,ingress" "minikube addons enable <name> -p ${MINIKUBE_PROFILE}"; fi
done

header "Control plane"
for c in kube-apiserver etcd kube-scheduler kube-controller-manager; do
  K get pods -n kube-system -l component="$c" --no-headers 2>/dev/null | grep -q . \
    && pass "$c running" \
    || K get pods -n kube-system 2>/dev/null | grep -q "$c" \
       && pass "$c running" \
       || fail "$c not found" "a static pod in kube-system" "kubectl get pods -n kube-system"
done
summary
