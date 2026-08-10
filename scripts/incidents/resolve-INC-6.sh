#!/usr/bin/env bash
# Instructor escape hatch for INC-6. Restores the ORIGINAL policy — it does not
# delete it, because deleting it is the wrong answer being tested for.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }
echo "Restoring the correct data-tier policy from manifests/day4/netpol/..."
K apply -f "$R/manifests/day4/netpol/05-data-tier.yaml" >/dev/null
K -n "${NS_DATA}" get networkpolicy
echo "INC-6 resolved — segmentation intact."
