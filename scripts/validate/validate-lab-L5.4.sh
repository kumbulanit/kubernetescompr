#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L5.4"; LAB_DOC="labs/day5/L5.4-promotion/"
CH="$R/charts/axispay"

header "All five values files exist and parse"
for v in values values-dev values-staging values-prod values-slim; do
  if [[ -f "$CH/$v.yaml" ]] && python3 -c "import yaml,sys; yaml.safe_load(open('$CH/$v.yaml'))" 2>/dev/null; then
    pass "$v.yaml"
  else
    fail "$v.yaml missing or invalid" "a parseable values file" "python3 -c \"import yaml;yaml.safe_load(open('charts/axispay/$v.yaml'))\""
  fi
done

header "Staging and production have the SAME SHAPE"
if command -v helm >/dev/null 2>&1; then
  S="$(helm template axispay "$CH" -f "$CH/values-staging.yaml" 2>/dev/null | grep '^kind:' | sort -u)"
  P="$(helm template axispay "$CH" -f "$CH/values-prod.yaml" 2>/dev/null | grep '^kind:' | sort -u)"
  if [[ "$S" == "$P" ]]; then
    pass "staging and production render the same set of object kinds"
  else
    fail "staging and production differ structurally" \
         "identical object kinds — only NUMBERS should differ" \
         "diff <(helm template ... -f values-staging.yaml) <(helm template ... -f values-prod.yaml)"
  fi
else
  fail "helm not installed" "helm 3" "scripts/setup/00-preflight.sh"
fi

header "Security settings are never relaxed per environment"
python3 - <<'PY' && pass "networkPolicy, podSecurity and token mounting are identical in every environment" \
  || fail "a security setting differs between environments" \
          "security is STRUCTURE, not size — never relaxed for dev" \
          "grep -A3 networkPolicy charts/axispay/values-dev.yaml"
import yaml, sys, os
CH = os.path.join(os.environ.get("R", "."), "charts", "axispay")
base = yaml.safe_load(open(f"{CH}/values.yaml"))
def merge(a, b):
    o = dict(a)
    for k, v in (b or {}).items():
        o[k] = merge(a[k], v) if isinstance(v, dict) and isinstance(a.get(k), dict) else v
    return o
bad = []
for f in ("values-dev.yaml", "values-staging.yaml", "values-prod.yaml"):
    m = merge(base, yaml.safe_load(open(f"{CH}/{f}")))
    if m["networkPolicy"]["enabled"] is not True:
        bad.append(f"{f}: networkPolicy disabled")
    if m["podSecurity"]["enforce"] != "restricted":
        bad.append(f"{f}: podSecurity {m['podSecurity']['enforce']}")
    if m["serviceAccount"]["automountToken"] is not False:
        bad.append(f"{f}: automountToken enabled")
if bad:
    print("\n".join(bad), file=sys.stderr); sys.exit(1)
PY

header "The cluster matches the chart (no drift)"
if command -v helm >/dev/null 2>&1 && helm plugin list 2>/dev/null | grep -q diff; then
  DIFF="$(helm diff upgrade axispay "$CH" -f "$CH/values.yaml" 2>/dev/null | head -5)"
  [[ -z "$DIFF" ]] && pass "no drift between the cluster and the chart" \
    || fail "drift detected" "the chart is the source of truth" "helm diff upgrade axispay charts/axispay"
else
  printf "  %s·%s  helm-diff plugin not installed — drift check skipped\n" "$DIM" "$RST"
fi

header "The HPA still owns the replica count"
for d in payment-service fraud-service; do
  if K get deploy "$d" -n "${NS_CORE}" -o json 2>/dev/null | python3 -c 'import json,sys; sys.exit(0 if "replicas" not in json.load(sys.stdin)["spec"] else 1)'; then
    pass "$d does not pin .spec.replicas — the autoscaler owns it"
  else
    fail "$d pins .spec.replicas" "the field omitted when an HPA exists" \
         "every helm upgrade would reset the replica count mid-spike"
  fi
done

summary
