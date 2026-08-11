#!/usr/bin/env bash
# ==============================================================================
# INC-3 — TWO unrelated faults in one window  (Day 3, 16:20)
#
#   A (loud)  postgres StatefulSet points at a StorageClass that does not exist
#             -> PVC Pending -> pod Pending, never scheduled
#   B (quiet) ConfigMap key renamed POSTGRES_HOST -> POSTGRES_HOSTNAME
#             -> ledger-service Running but 0/1, readiness 503
#
# Teaches: two failure classes side by side, and PRIORITISATION.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Injecting INC-3 (two faults)..."

# --- Fault A: nonexistent StorageClass. volumeClaimTemplates are immutable,
#     so the StatefulSet must be recreated with --cascade=orphan to keep the pod
#     definition, then the PVC removed so it re-provisions against the bad class.
K -n "${NS_DATA}" delete statefulset postgres --cascade=orphan >/dev/null 2>&1 || true
K -n "${NS_DATA}" delete pod postgres-0 --ignore-not-found --wait=false >/dev/null 2>&1 || true
K -n "${NS_DATA}" delete pvc data-postgres-0 --ignore-not-found --wait=false >/dev/null 2>&1 || true
sed 's/storageClassName: axispay-standard/storageClassName: axispay-fast/' \
  "$R/platform/manifests/day3/statefulsets/01-postgres.yaml" | K apply -f - >/dev/null

# --- Fault B: rename the key the application reads.
K -n "${NS_CORE}" patch configmap axispay-platform-config --type json -p='[
  {"op":"remove","path":"/data/POSTGRES_HOST"},
  {"op":"add","path":"/data/POSTGRES_HOSTNAME","value":"postgres-0.postgres.axispay-data.svc.cluster.local"}
]' >/dev/null 2>&1 || true
K -n "${NS_CORE}" rollout restart deployment/ledger-service >/dev/null 2>&1 || true

echo "Injected. Wait ~2 min, then hand out the ticket:"
echo "  days/day3/labs/INC-3-storage-and-config/ §2"
echo
echo "Watch:   kubectl get pods -A -l app.kubernetes.io/part-of=axispay"
echo "Resolve: $D/resolve-INC-3.sh"
