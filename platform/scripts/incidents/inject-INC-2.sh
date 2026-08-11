#!/usr/bin/env bash
# ==============================================================================
# INC-2 — CrashLoopBackOff caused by an OOMKill  (Day 2, 16:30)
#
# Sets memory limit BELOW the request, and below what the process needs.
# Pods start, get OOMKilled within seconds, and CrashLoopBackOff.
#
# Presents as INTERMITTENT (not total) because one replica usually survives
# briefly — which is a deliberate contrast with INC-1's total outage.
#
# Teaches: RESTARTS vs status, `Last State`, exit 137, logs --previous,
#          and why a clean log is itself a clue.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Injecting INC-2..."
K -n "${NS_CORE}" patch deployment payment-service --type=json -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/resources/limits/memory","value":"48Mi"}
]' >/dev/null
K -n "${NS_CORE}" annotate deployment/payment-service \
  kubernetes.io/change-cause="resource tuning — reduce memory footprint" --overwrite >/dev/null

echo "Injected. Wait ~90s for CrashLoopBackOff, then hand out the ticket:"
echo "  days/day2/labs/INC-2-oomkill-crashloop/ §2"
echo
echo "Watch:    kubectl get pods -n ${NS_CORE} -w"
echo "Resolve:  $D/resolve-INC-2.sh"
