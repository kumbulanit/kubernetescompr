#!/usr/bin/env bash
# ==============================================================================
# INC-1 — ImagePullBackOff  (Day 1, 16:30)
#
# Injects a non-existent image tag on payment-service. All three replicas fail
# to start; the payment API goes to 0% approval.
#
# Teaches: events vs logs, ImagePullBackOff vs CrashLoopBackOff, rollout undo.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Injecting INC-1..."
K -n "${NS_CORE}" set image deployment/payment-service \
  payment-service="${IMAGE_NAMESPACE}/payment-service:1.0.0-rc9" >/dev/null

# annotate so `kubectl rollout history` shows a plausible change-cause, exactly
# as a real (badly documented) change would
K -n "${NS_CORE}" annotate deployment/payment-service \
  kubernetes.io/change-cause="CR-2026-0814 deploy release candidate" --overwrite >/dev/null

echo "Injected. Wait ~90s for pods to reach ImagePullBackOff, then hand out the ticket:"
echo "  labs/day1/INC-1-imagepullbackoff/ §2"
echo
echo "Watch with:  kubectl get pods -n ${NS_CORE} -w"
echo "Resolve with: $D/resolve-INC-1.sh"
