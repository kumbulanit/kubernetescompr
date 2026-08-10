#!/usr/bin/env bash
# Instructor escape hatch for INC-7.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

if [[ -f /tmp/axispay-tls-backup-inc7.yaml ]]; then
  echo "Restoring the backed-up certificate..."
  K apply -f /tmp/axispay-tls-backup-inc7.yaml >/dev/null
  rm -f /tmp/axispay-tls-backup-inc7.yaml
else
  echo "No backup found — regenerating from scripts/setup/06-generate-tls.sh"
  bash "$R/scripts/setup/06-generate-tls.sh"
fi
K -n ingress-nginx rollout restart deployment/ingress-nginx-controller >/dev/null 2>&1 || true
echo "INC-7 resolved. Verify:"
echo "  openssl s_client -connect \$(minikube ip -p ${MINIKUBE_PROFILE}):443 -servername ${INGRESS_HOST_API} 2>/dev/null | openssl x509 -noout -dates"
