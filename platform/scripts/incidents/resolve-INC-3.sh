#!/usr/bin/env bash
# Instructor escape hatch for INC-3.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Fault B — restoring the ConfigMap key..."
K -n "${NS_CORE}" patch configmap axispay-platform-config --type json -p='[
  {"op":"remove","path":"/data/POSTGRES_HOSTNAME"},
  {"op":"add","path":"/data/POSTGRES_HOST","value":"postgres-0.postgres.axispay-data.svc.cluster.local"}
]' >/dev/null 2>&1 || true
K -n "${NS_CORE}" rollout restart deployment/ledger-service >/dev/null 2>&1 || true

echo "Fault A — restoring the StatefulSet..."
K -n "${NS_DATA}" delete statefulset postgres --cascade=orphan --ignore-not-found >/dev/null 2>&1 || true
K -n "${NS_DATA}" delete pvc data-postgres-0 --ignore-not-found --wait=false >/dev/null 2>&1 || true
K -n "${NS_DATA}" delete pod postgres-0 --ignore-not-found --wait=false >/dev/null 2>&1 || true
K apply -f "$R/platform/manifests/day3/statefulsets/01-postgres.yaml" >/dev/null
K -n "${NS_DATA}" wait --for=condition=ready pod/postgres-0 --timeout=300s

echo "Reloading seed data..."
"$R/scripts/setup/05-seed-database.sh" >/dev/null 2>&1 || \
  echo "  (re-run ./scripts/setup/05-seed-database.sh manually if needed)"
echo "INC-3 resolved. Verify: make validate-lab LAB=L3.5"
