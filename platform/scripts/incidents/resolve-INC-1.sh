#!/usr/bin/env bash
# Instructor escape hatch for INC-1. Use only if a student is stuck past the box.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Restoring payment-service from the declared manifest..."
K apply -f "$R/platform/manifests/day1/deployments/04-deployment-payment-service.yaml" >/dev/null
K -n "${NS_CORE}" rollout status deployment/payment-service --timeout=120s
K -n "${NS_CORE}" annotate deployment/payment-service kubernetes.io/change-cause- >/dev/null 2>&1 || true
echo "INC-1 resolved. Verify: make validate-lab LAB=L1.6"
