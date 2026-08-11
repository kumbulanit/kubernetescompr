#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L5.6"; LAB_DOC="days/day5/labs/L5.6-logs-and-alerts/"

header "Logs are structured JSON on stdout"
POD="$(K get pod -n "${NS_CORE}" -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
if [[ -n "$POD" ]]; then
  LINE="$(K logs -n "${NS_CORE}" "$POD" --tail=20 2>/dev/null | grep -m1 '^{')"
  if [[ -n "$LINE" ]] && echo "$LINE" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if {"service","correlation_id","level"} <= set(d) else 1)' 2>/dev/null; then
    pass "log lines are JSON carrying service, level and correlation_id"
  else
    fail "log lines are not the expected JSON" "one JSON object per line on stdout" \
         "kubectl logs -n ${NS_CORE} $POD --tail=3 | jq ."
  fi
else
  fail "no payment-service pod" "a running payment-service" "kubectl get pods -n ${NS_CORE}"
fi

header "The log pipeline is running"
if K get ds -n "${NS_OBS}" -l app.kubernetes.io/name=alloy >/dev/null 2>&1 && \
   [[ "$(K get ds -n "${NS_OBS}" -l app.kubernetes.io/name=alloy -o jsonpath='{.items[0].status.numberReady}' 2>/dev/null)" -ge 1 ]]; then
  pass "Alloy DaemonSet has ready pods — one collector per node"
else
  fail "Alloy is not running" "a DaemonSet collecting /var/log/pods" \
       "make observability   # or --metrics-only was used, in which case L5.6 steps 1-6 do not apply"
fi
K get sts,deploy -n "${NS_OBS}" 2>/dev/null | grep -q loki \
  && pass "Loki present" \
  || fail "Loki not found" "the log store" "make observability"

header "Only bounded labels are promoted to Loki streams"
grep -q 'correlation_id' "$R/platform/charts/observability/alloy-values.yaml" && \
  grep -A2 'target_label' "$R/platform/charts/observability/alloy-values.yaml" | grep -q 'correlation_id' \
  && fail "correlation_id is promoted to a LABEL" "it must stay in the log body" \
          "one stream per request would take Loki down — query it with | json instead" \
  || pass "correlation_id stays in the body, not in the labels"

header "Alert routing has somewhere to deliver"
assert_ready "${NS_OBS}" alert-sink 1
assert_endpoints "${NS_OBS}" alert-sink 1
K get alertmanagerconfig axispay-routing -n "${NS_OBS}" >/dev/null 2>&1 \
  && pass "AlertmanagerConfig axispay-routing applied" \
  || fail "AlertmanagerConfig missing" "the routing tree" \
          "kubectl apply -f manifests/day5/observability/03-alertmanager-config.yaml"

header "The routing tree separates the teams"
ROUTES="$(K get alertmanagerconfig axispay-routing -n "${NS_OBS}" -o json 2>/dev/null \
  | python3 -c 'import json,sys
d=json.load(sys.stdin)
print(" ".join(sorted(r["receiver"] for r in d["spec"]["route"].get("routes",[]))))' 2>/dev/null)"
for r in payments-oncall finance-ops risk-team; do
  echo "$ROUTES" | grep -q "$r" && pass "route to $r" \
    || fail "no route to $r" "a per-team route" "kubectl get alertmanagerconfig axispay-routing -n ${NS_OBS} -o yaml"
done

INH="$(K get alertmanagerconfig axispay-routing -n "${NS_OBS}" -o json 2>/dev/null \
  | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["spec"].get("inhibitRules",[])))' 2>/dev/null)"
[[ "${INH:-0}" -ge 3 ]] && pass "$INH inhibit rules — one fault produces one page" \
  || fail "${INH:-0} inhibit rules" "at least 3" "without them one bad node pages eight times"

header "The sink answers"
SINKPOD="$(K get pod -n "${NS_OBS}" -l app.kubernetes.io/name=alert-sink -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
if [[ -n "$SINKPOD" ]]; then
  K exec -n "${NS_OBS}" "$SINKPOD" -- python3 -c \
    "import urllib.request,json;json.load(urllib.request.urlopen('http://127.0.0.1:8080/api/v1/routes'))" 2>/dev/null \
    && pass "/api/v1/routes responds — routing is provable, not assumed" \
    || fail "alert-sink /api/v1/routes did not respond" "a working sink" "kubectl logs -n ${NS_OBS} deploy/alert-sink"
else
  fail "no alert-sink pod" "the receiver" "kubectl apply -f manifests/day5/observability/06-alert-sink.yaml"
fi

summary
