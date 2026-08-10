#!/usr/bin/env bash
# ==============================================================================
# Load the AxisPay schema and seed data into the running PostgreSQL StatefulSet.
#
# The seed file is ~8 MB, which is far too large for a ConfigMap (1 MiB limit).
# So we pipe it straight into psql instead. That size limit is a real constraint
# students should know about, and it is why production seed data lives in an
# init Job or an object store rather than a ConfigMap.
#
#   ./scripts/setup/05-seed-database.sh [--regenerate]
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"
K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }

[[ "${1:-}" == "--regenerate" ]] && {
  echo "Regenerating seed data..."
  python3 "$R/data/seed/generate_seed.py" -o "$R/data/seed/02-seed.sql"; }

echo "Waiting for postgres-0 to be ready..."
K -n "${NS_DATA}" wait --for=condition=ready pod/postgres-0 --timeout=300s

echo "Applying schema..."
K -n "${NS_DATA}" exec -i postgres-0 -- \
  psql -U axispay_app -d axispay -v ON_ERROR_STOP=1 < "$R/data/schema/01-schema.sql"

echo "Loading seed data (~28,000 statements, this takes 30-60s)..."
K -n "${NS_DATA}" exec -i postgres-0 -- \
  psql -U axispay_app -d axispay -q -v ON_ERROR_STOP=1 < "$R/data/seed/02-seed.sql"

echo
echo "Verifying..."
K -n "${NS_DATA}" exec -i postgres-0 -- psql -U axispay_app -d axispay -t <<'SQL'
SELECT '  merchants      ' || COUNT(*) FROM merchants;
SELECT '  customers      ' || COUNT(*) FROM customers;
SELECT '  payments       ' || COUNT(*) FROM payments;
SELECT '  ledger_entries ' || COUNT(*) FROM ledger_entries;
SELECT '  settlements    ' || COUNT(*) FROM settlements;
SELECT '  LEDGER IMBALANCE (must be 0): ' || COALESCE(SUM(imbalance),0) FROM v_ledger_balance;
SQL
echo
echo "Seeded. Try:  kubectl -n ${NS_DATA} exec -it postgres-0 -- psql -U axispay_app -d axispay"
