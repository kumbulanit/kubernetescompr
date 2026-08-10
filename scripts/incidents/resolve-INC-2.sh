#!/usr/bin/env bash
# Instructor escape hatch for INC-2.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }
echo "Restoring payment-service from the declared manifest..."
K apply -f "$R/manifests/day2/rollout/01-deployment-payment-service-v1.1.0.yaml" >/dev/null
K -n "${NS_CORE}" rollout status deployment/payment-service --timeout=180s
echo "INC-2 resolved. Verify: make validate-lab LAB=L2.6"
