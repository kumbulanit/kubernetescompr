#!/usr/bin/env bash
# Instructor escape hatch for INC-5.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }
echo "Restoring redis..."
K -n "${NS_DATA}" scale statefulset/redis --replicas=1 >/dev/null
K -n "${NS_DATA}" rollout status statefulset/redis --timeout=180s
echo "INC-5 resolved."
