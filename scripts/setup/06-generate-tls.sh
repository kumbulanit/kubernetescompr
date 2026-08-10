#!/usr/bin/env bash
# ==============================================================================
# Generate self-signed TLS certificates for the AxisPay Ingress.
#
# TRAINING ONLY. In production these come from cert-manager with an ACME issuer
# and rotate automatically — which is exactly what INC-7 exploits when it swaps
# in an expired one.
#
#   ./scripts/setup/06-generate-tls.sh [--days 365]
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

DAYS=365
[[ "${1:-}" == "--days" ]] && DAYS="$2"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT

gen() {
  local host="$1" secret="$2" ns="$3"
  openssl req -x509 -nodes -newkey rsa:2048 -days "$DAYS" \
    -keyout "$OUT/$host.key" -out "$OUT/$host.crt" \
    -subj "/C=ZA/ST=Western Cape/L=Cape Town/O=Axis Financial Services (fictional)/CN=$host" \
    -addext "subjectAltName=DNS:$host" 2>/dev/null
  K -n "$ns" create secret tls "$secret" \
    --cert="$OUT/$host.crt" --key="$OUT/$host.key" \
    --dry-run=client -o yaml | K apply -f - >/dev/null
  echo "  $secret in $ns  ($host, valid ${DAYS} days)"
}

echo "Generating self-signed certificates..."
gen api.axispay.local    axispay-tls        "${NS_EDGE}"
gen portal.axispay.local axispay-portal-tls "${NS_ASYNC}"

echo
echo "Add to /etc/hosts:"
echo "  $(minikube -p "${MINIKUBE_PROFILE}" ip 2>/dev/null || echo '<minikube-ip>')  api.axispay.local portal.axispay.local"
echo
echo "Then:  curl -k https://api.axispay.local/api/v1/platform-status"
