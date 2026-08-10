#!/usr/bin/env bash
# ==============================================================================
# INC-5 — Redis unavailable  (capstone, ~T+12 of phase 3)
#
# Fault:    redis StatefulSet scaled to 0
# Presents: fraud-service latency climbs, approval rate falls, p99 SLO breached
# Root:     a cache dependency is gone; fraud-service degrades instead of failing
#
# Teaches:  dependency mapping, the difference between a dependency that should
#           fail readiness and one that should degrade, and reading a business
#           metric (approval rate) rather than an infrastructure one.
#
# WHAT MAKES THIS HARD: nothing crashes. Every pod stays Ready, because
# fraud-service treats Redis as NON-CRITICAL in its ReadinessRegistry — by
# design. So `kubectl get pods` is entirely green while merchants are being
# declined. A student who only looks at pods will not find this.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Injecting INC-5 (Redis unavailable)..."
K -n "${NS_DATA}" scale statefulset/redis --replicas=0 >/dev/null
echo "Injected at $(date +%H:%M:%S). Give it ~3 minutes to show on the dashboard."
echo
echo "Ticket to hand out:"
cat <<'TICKET'

  SEV-2 — Merchant MER_7QK2XD9P4A reports declined payments since 22:41.
  Approval rate down roughly 30%. Two other merchants have confirmed.
  Checkout is slow but not failing. Ops needs an update in 15 minutes.

TICKET
echo "Watch:   Grafana 'Payments by outcome' and the p99 panel"
echo "Resolve: $D/resolve-INC-5.sh"
