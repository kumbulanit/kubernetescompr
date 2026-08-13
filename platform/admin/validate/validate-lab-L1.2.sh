#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L1.2"; LAB_DOC="days/day1/labs/L1.2-namespaces/"

header "L1.2 — Namespace design for a segmented estate"
for ns in axispay-edge axispay-core axispay-async; do
  if K get ns "$ns" >/dev/null 2>&1; then pass "namespace $ns exists"
  else fail "namespace $ns missing" "3 namespaces from manifests/00-namespaces/" \
            "kubectl apply -f manifests/00-namespaces/"; fi
done

header "Labels — these are what NetworkPolicy and RBAC select on later"
check_label() {
  local ns="$1" key="$2" want="$3" got
  # Read the label via Python rather than jsonpath: label keys contain dots
  # ("axispay.io/zone"), and escaping those inside a jsonpath expression is
  # fiddly and shell-quoting-dependent. This is clearer and always correct.
  got="$(K get ns "$ns" -o json 2>/dev/null | python3 -c "
import json,sys
try: print(json.load(sys.stdin)['metadata'].get('labels',{}).get('$key',''))
except Exception: print('')" 2>/dev/null)"
  if [[ "$got" == "$want" ]]; then pass "$ns  $key=$want"
  else fail "$ns  $key is '${got:-<unset>}', expected '$want'" \
            "label $key: \"$want\"" "kubectl get ns $ns --show-labels"; fi
}
check_label axispay-edge  axispay.io/zone      edge
check_label axispay-core  axispay.io/zone      core
check_label axispay-async axispay.io/zone      async
check_label axispay-core  axispay.io/pci-scope "true"
check_label axispay-edge  axispay.io/pci-scope "false"

header "CHALLENGE — did you add axispay-data yourself?"
if K get ns axispay-data >/dev/null 2>&1; then
  pass "axispay-data exists (challenge complete)"
else
  printf "  %s○%s axispay-data not created — see §10 Challenge (optional)\n" "$YEL" "$RST"
fi
summary
