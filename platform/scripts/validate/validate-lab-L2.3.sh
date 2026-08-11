#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L2.3"; LAB_DOC="days/day2/labs/L2.3-probes/"

header "L2.3 — All three probes, correctly separated"
for e in "${NS_EDGE} edge-gateway" "${NS_EDGE} auth-service" \
         "${NS_CORE} merchant-service" "${NS_CORE} payment-service" \
         "${NS_CORE} fraud-service" "${NS_CORE} routing-service"; do
  # shellcheck disable=SC2086
  set -- $e; ns="$1"; name="$2"
  OUT="$(K get deploy "$name" -n "$ns" -o json 2>/dev/null | python3 -c "
import json,sys
try: c=json.load(sys.stdin)['spec']['template']['spec']['containers'][0]
except Exception: print('MISSING'); raise SystemExit
def p(k): return (c.get(k) or {}).get('httpGet',{}).get('path','-')
print(f\"{p('startupProbe')} {p('livenessProbe')} {p('readinessProbe')}\")")"
  read -r sp lp rp <<<"$OUT"
  if [[ "$sp" == "/startupz" && "$lp" == "/healthz" && "$rp" == "/readyz" ]]; then
    pass "$name  startup=$sp liveness=$lp readiness=$rp"
  else
    fail "$name probes are startup=$sp liveness=$lp readiness=$rp" \
         "startup=/startupz liveness=/healthz readiness=/readyz" \
         "kubectl get deploy $name -n $ns -o yaml | grep -A4 Probe"
  fi
  if [[ "$lp" == "/readyz" ]]; then
    fail "$name LIVENESS IS CHECKING DEPENDENCIES" \
         "liveness must target /healthz" \
         "This is the cascading-failure bug — see L2.3 step 6"
  fi
done

header "Readiness must react faster than liveness"
K get deploy payment-service -n "${NS_CORE}" -o json 2>/dev/null | python3 -c "
import json,sys
c=json.load(sys.stdin)['spec']['template']['spec']['containers'][0]
r=c['readinessProbe']; l=c['livenessProbe']
rt=r.get('periodSeconds',10)*r.get('failureThreshold',3)
lt=l.get('periodSeconds',10)*l.get('failureThreshold',3)
print(f'readiness reacts in {rt}s, liveness in {lt}s')
sys.exit(0 if rt<lt else 1)" 2>/dev/null | sed 's/^/    /' \
  && pass "readiness reacts before liveness" \
  || fail "liveness reacts before readiness" "readiness period*threshold < liveness" "see L2.3 §5 step 2"

header "graceful shutdown"
for e in "${NS_CORE} payment-service" "${NS_EDGE} edge-gateway"; do
  # shellcheck disable=SC2086
  set -- $e; ns="$1"; name="$2"
  G="$(K get deploy "$name" -n "$ns" -o jsonpath='{.spec.template.spec.terminationGracePeriodSeconds}' 2>/dev/null || echo 0)"
  PS="$(K get deploy "$name" -n "$ns" -o jsonpath='{.spec.template.spec.containers[0].lifecycle.preStop}' 2>/dev/null || true)"
  [[ "${G:-0}" -ge 30 && -n "$PS" ]] \
    && pass "$name grace=${G}s with preStop drain" \
    || fail "$name grace=${G}s preStop=${PS:-none}" "grace >= 30s and a preStop hook" "see L2.6 step 8"
done
summary
