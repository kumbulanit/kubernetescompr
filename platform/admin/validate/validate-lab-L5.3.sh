#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L5.3"; LAB_DOC="days/day5/labs/L5.3-helm-packaging/"

header "The chart is valid offline"
python3 "$D/check-helm-chart.py" >/dev/null 2>&1 \
  && pass "check-helm-chart.py: all assertions hold" \
  || fail "chart validation fails" "94 assertions holding" "python3 platform/admin/validate/check-helm-chart.py"

header "helm is installed and the chart lints"
if command -v helm >/dev/null 2>&1; then
  pass "helm $(helm version --short 2>/dev/null)"
  helm lint "$R/platform/charts/axispay" >/dev/null 2>&1 && pass "helm lint clean" \
    || fail "helm lint reports problems" "a clean lint" "helm lint charts/axispay"
  for v in "$R"/charts/axispay/values-*.yaml; do
    helm lint "$R/platform/charts/axispay" -f "$v" >/dev/null 2>&1 \
      && pass "helm lint $(basename "$v")" \
      || fail "helm lint fails for $(basename "$v")" "a clean lint" "helm lint charts/axispay -f $v"
  done
else
  fail "helm not installed" "helm 3" "platform/scripts/setup/00-preflight.sh"
fi

header "The release is installed"
REV="$(helm --kube-context="${MINIKUBE_PROFILE}" list -A -o json 2>/dev/null \
  | python3 -c 'import json,sys
try: rows=json.load(sys.stdin)
except Exception: rows=[]
r=next((x for x in rows if x["name"]=="axispay"), None)
print(f"{r[\"status\"]} rev{r[\"revision\"]}" if r else "MISSING")')"
[[ "$REV" == deployed* ]] && pass "release axispay: $REV" \
  || fail "release axispay is '$REV'" "status deployed" "helm history axispay"

header "The chart produced the platform"
for nsd in "${NS_EDGE}:edge-gateway" "${NS_CORE}:payment-service" "${NS_CORE}:fraud-service" \
           "${NS_ASYNC}:audit-service" "${NS_OBS}:alert-sink"; do
  assert_ready "${nsd%%:*}" "${nsd##*:}" 1
done

header "Selectors carry no volatile label — the second-release trap"
BAD=""
while read -r ns name sel; do
  [[ -z "${name:-}" ]] && continue
  echo "$sel" | grep -qE 'helm.sh/chart|app.kubernetes.io/version' && BAD="$BAD $ns/$name"
done < <(K get deploy -A -l app.kubernetes.io/part-of=axispay \
        -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{" "}{.spec.selector.matchLabels}{"\n"}{end}' 2>/dev/null)
[[ -z "${BAD// /}" ]] && pass "no Deployment selector contains a chart or version label" \
  || fail "volatile labels in selectors:$BAD" "identity labels only" \
          ".spec.selector is IMMUTABLE — the next version bump fails the upgrade"

header "A payment still works from the chart-installed platform"
CODE="$(curl -sk -o /dev/null -w '%{http_code}' -X POST "https://${INGRESS_HOST_API}/api/v1/payments" \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H "Idempotency-Key: l53-$(date +%s)" \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L53-V","amount_minor":45000,"currency":"ZAR","card_token":"tok_visa_4242"}' 2>/dev/null)"
[[ "$CODE" == "201" ]] && pass "payment accepted (201)" \
  || fail "payment returned $CODE" "201" "kubectl logs -n ${NS_EDGE} deploy/edge-gateway --tail=40"

summary
