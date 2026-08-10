#!/usr/bin/env bash
# ==============================================================================
# INC-7 — Expired TLS certificate  (capstone, ~T+36 of phase 3)
#
# Fault:    the Ingress TLS Secret is replaced with a certificate that expired
#           yesterday
# Presents: merchant integrations fail the TLS handshake; browsers warn;
#           in-cluster traffic is completely unaffected
# Root:     certificate lifecycle — nobody was watching the expiry date
#
# WHAT MAKES THIS INSTRUCTIVE: every pod is Ready, every in-cluster call works,
# every dashboard is green. The failure is entirely outside the cluster's own
# view of itself. `curl -k` also succeeds, which is how people convince
# themselves it is fine.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "Backing up the valid certificate..."
K -n "${NS_EDGE}" get secret axispay-tls -o yaml > "$TMP/axispay-tls-backup.yaml"
cp "$TMP/axispay-tls-backup.yaml" "/tmp/axispay-tls-backup-inc7.yaml"

echo "Generating a certificate that expired yesterday..."
# -not_before / -not_after need OpenSSL 3.x. Fall back to a 1-second lifetime.
if openssl req -x509 -newkey rsa:2048 -nodes -sha256 \
     -keyout "$TMP/tls.key" -out "$TMP/tls.crt" \
     -subj "/CN=${INGRESS_HOST_API}/O=Axis Financial Services" \
     -addext "subjectAltName=DNS:${INGRESS_HOST_API},DNS:${INGRESS_HOST_PORTAL}" \
     -not_before "$(date -u -d '30 days ago' +%Y%m%d%H%M%SZ)" \
     -not_after  "$(date -u -d '1 day ago'  +%Y%m%d%H%M%SZ)" 2>/dev/null; then
  echo "  generated with an explicit past validity window"
else
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \
    -keyout "$TMP/tls.key" -out "$TMP/tls.crt" \
    -subj "/CN=${INGRESS_HOST_API}/O=Axis Financial Services" \
    -addext "subjectAltName=DNS:${INGRESS_HOST_API},DNS:${INGRESS_HOST_PORTAL}" 2>/dev/null
  echo "  OpenSSL 1.x detected — issued for 1 day; set the clock forward or"
  echo "  tell the class the certificate expires tonight."
fi

K -n "${NS_EDGE}" create secret tls axispay-tls \
  --cert="$TMP/tls.crt" --key="$TMP/tls.key" \
  --dry-run=client -o yaml | K apply -f - >/dev/null

# nginx caches certificates; force a reload.
K -n ingress-nginx rollout restart deployment/ingress-nginx-controller >/dev/null 2>&1 || \
  K -n ingress-nginx rollout restart daemonset/ingress-nginx-controller >/dev/null 2>&1 || true

echo "Injected at $(date +%H:%M:%S)."
echo
cat <<'TICKET'
  SEV-1 — Three merchant integrations are failing to connect to the payment
  API. Their logs say "certificate has expired". Our dashboards are green and
  our own health checks pass. Merchant onboarding has stopped.
TICKET
echo "Check:   openssl s_client -connect \$(minikube ip -p ${MINIKUBE_PROFILE}):443 -servername ${INGRESS_HOST_API} 2>/dev/null | openssl x509 -noout -dates"
echo "Resolve: $D/resolve-INC-7.sh"
