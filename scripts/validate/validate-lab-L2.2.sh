#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L2.2"; LAB_DOC="labs/day2/L2.2-quota-limitrange/"

header "L2.2 — Namespace governance"
assert_resource resourcequota "${NS_CORE}" axispay-core-quota "manifests/day2/resources/00-governance-axispay-core.yaml"
assert_resource limitrange    "${NS_CORE}" axispay-core-limits "manifests/day2/resources/00-governance-axispay-core.yaml"

header "Quota utilisation"
K describe quota axispay-core-quota -n "${NS_CORE}" 2>/dev/null | sed -n '/Resource/,$p' | sed 's/^/    /'

header "LimitRange supplies defaults (without which the quota breaks every bare pod)"
DEF="$(K get limitrange axispay-core-limits -n "${NS_CORE}" -o json 2>/dev/null | python3 -c "
import json,sys
try:
    l=json.load(sys.stdin)['spec']['limits'][0]
    print('yes' if l.get('defaultRequest') and l.get('default') else 'no')
except Exception: print('no')")"
[[ "$DEF" == "yes" ]] && pass "defaultRequest and default are set" \
  || fail "LimitRange has no defaults" "default + defaultRequest" "see manifests/day2/resources/00-governance-axispay-core.yaml"

header "CRITICAL — can the HPA reach maxReplicas inside the quota?"
K get quota axispay-core-quota -n "${NS_CORE}" -o json 2>/dev/null | python3 -c "
import json,sys,re
q=json.load(sys.stdin)['status']['hard']
def cpu(v): return int(v[:-1]) if v.endswith('m') else int(float(v)*1000)
def mem(v):
    for s,m in (('Ki',1/1024),('Mi',1),('Gi',1024)):
        if v.endswith(s): return float(v[:-2])*m
    return float(v)/1048576
# payment 8x(100m/96Mi,500m/256Mi) fraud 6x(150m/80Mi,600m/192Mi)
# merchant 2x(50m/64Mi,250m/160Mi) routing 2x(60m/72Mi,300m/192Mi)
rc,rm=100*8+150*6+50*2+60*2, 96*8+80*6+64*2+72*2
lc,lm=500*8+600*6+250*2+300*2, 256*8+192*6+160*2+192*2
ok_r = rc<=cpu(q['requests.cpu']) and rm<=mem(q['requests.memory'])
ok_l = lc<=cpu(q['limits.cpu'])  and lm<=mem(q['limits.memory'])
print(f\"REQ {rc}m/{rm:.0f}Mi vs {cpu(q['requests.cpu'])}m/{mem(q['requests.memory']):.0f}Mi -> {'ok' if ok_r else 'FAIL'}\")
print(f\"LIM {lc}m/{lm:.0f}Mi vs {cpu(q['limits.cpu'])}m/{mem(q['limits.memory']):.0f}Mi -> {'ok' if ok_l else 'FAIL'}\")
sys.exit(0 if ok_r and ok_l else 1)" 2>/dev/null | sed 's/^/    /'
if K get quota axispay-core-quota -n "${NS_CORE}" >/dev/null 2>&1; then
  pass "quota sized so autoscaling can reach maxReplicas"
else
  fail "could not evaluate quota headroom" "a ResourceQuota in ${NS_CORE}" "kubectl describe quota -n ${NS_CORE}"
fi
summary
