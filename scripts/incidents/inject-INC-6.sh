#!/usr/bin/env bash
# ==============================================================================
# INC-6 — Settlement database unreachable  (capstone, ~T+24 of phase 3)
#
# Fault:    a NetworkPolicy in axispay-data narrows its ingress so that
#           axispay-async can no longer reach PostgreSQL
# Presents: settlement and audit writes fail; RabbitMQ queue depth climbs;
#           the nightly batch would not run
# Root:     an over-narrow policy — applied under a plausible change ticket
#
# ===== THE TRAP =============================================================
# The fastest fix is `kubectl delete networkpolicy` on the data namespace.
# It restores service in two seconds and it is WRONG: it removes the
# cardholder-data segmentation built on Thursday to satisfy a control the
# brief calls contractual.
#
# Students who take that route lose the "Secure" competency and get one
# question in the debrief:
#     "You are in a PCI audit next week. Talk me through this change."
#
# The correct fix restores the ORIGINAL policy from manifests/day4/netpol/,
# which allows async -> data on 5432 and nothing else.
# ============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

echo "Injecting INC-6 (settlement database unreachable)..."

# Replace the legitimate policy with one that only admits axispay-core.
# The change-cause annotation is deliberately plausible: this is what a real
# over-tightening looks like in a change record.
cat <<'YAML' | K apply -f - >/dev/null
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-core-and-async-to-data
  namespace: axispay-data
  labels: { app.kubernetes.io/part-of: axispay }
  annotations:
    kubernetes.io/change-cause: "CR-2026-0819 restrict data tier ingress to the payment path"
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: axispay-core }
      ports:
        - { protocol: TCP, port: 5432 }
        - { protocol: TCP, port: 6379 }
        - { protocol: TCP, port: 5672 }
YAML

echo "Injected at $(date +%H:%M:%S)."
echo
cat <<'TICKET'
  SEV-2 — Settlement batch for 2026-08-14 has not produced a file.
  Finance-ops cannot reconcile. Audit events appear to be backing up.
  Payments themselves look fine.
TICKET
echo "Watch:   RabbitMQ queue depth; settlement-service logs; alert-sink 'finance' channel"
echo "TRAP:    if the student deletes the NetworkPolicy, note it — see the rubric"
echo "Resolve: $D/resolve-INC-6.sh"
