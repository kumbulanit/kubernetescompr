#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.7"; LAB_DOC="labs/day3/L3.7-security-context/"

header "L3.7 — securityContext hardening"
for e in "${NS_EDGE} edge-gateway" "${NS_EDGE} auth-service" "${NS_CORE} merchant-service" \
         "${NS_CORE} payment-service" "${NS_CORE} fraud-service" "${NS_CORE} routing-service"; do
  # shellcheck disable=SC2086
  set -- $e; ns="$1"; name="$2"
  OUT="$(K get deploy "$name" -n "$ns" -o json 2>/dev/null | python3 -c "
import json,sys
try: s=json.load(sys.stdin)[\"spec\"][\"template\"][\"spec\"]
except Exception: print(\"MISSING\"); raise SystemExit
p=s.get(\"securityContext\",{}); c=s[\"containers\"][0].get(\"securityContext\",{})
print(p.get(\"runAsNonRoot\"), c.get(\"readOnlyRootFilesystem\"),
      (c.get(\"capabilities\",{}) or {}).get(\"drop\"), c.get(\"allowPrivilegeEscalation\"))" 2>/dev/null)"
  read -r nonroot rofs caps esc <<<"$OUT"
  if [[ "$nonroot" == "True" && "$rofs" == "True" && "$caps" == "['ALL']" && "$esc" == "False" ]]; then
    pass "$name: non-root, read-only rootfs, drop ALL, no escalation"
  else
    fail "$name: nonRoot=$nonroot readOnlyFS=$rofs drop=$caps noEscalation=$esc" \
         "all four hardening controls" \
         "kubectl apply -f manifests/day3/security/02-hardened-deployments.yaml"
  fi
done

header "Effective runtime user"
POD="$(K get pods -n "${NS_CORE}" -l app.kubernetes.io/name=payment-service -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)"
if [[ -n "$POD" ]]; then
  UID_="$(K exec -n "${NS_CORE}" "$POD" -- id -u 2>/dev/null || echo "?")"
  [[ "$UID_" == "${APP_UID}" ]] && pass "runs as uid ${APP_UID} (not root)" \
    || fail "running as uid $UID_" "uid ${APP_UID}" "check the pod securityContext"
  CAP="$(K exec -n "${NS_CORE}" "$POD" -- grep CapEff /proc/1/status 2>/dev/null | awk "{print \$2}")"
  [[ "$CAP" == "0000000000000000" ]] && pass "CapEff=0000000000000000 — zero capabilities" \
    || fail "CapEff=$CAP" "0000000000000000" "capabilities.drop: [ALL]"
fi

header "Data tier runs non-root too"
for s in postgres redis rabbitmq; do
  NR="$(K get statefulset "$s" -n "${NS_DATA}" -o jsonpath="{.spec.template.spec.securityContext.runAsNonRoot}" 2>/dev/null)"
  FG="$(K get statefulset "$s" -n "${NS_DATA}" -o jsonpath="{.spec.template.spec.securityContext.fsGroup}" 2>/dev/null)"
  [[ "$NR" == "true" && -n "$FG" ]] && pass "$s: runAsNonRoot with fsGroup=$FG" \
    || fail "$s: runAsNonRoot=$NR fsGroup=$FG" "true + an fsGroup" "without fsGroup a non-root process cannot write to its volume"
done
summary
