#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L5.5"; LAB_DOC="days/day5/labs/L5.5-metrics-and-dashboards/"

header "Every PromQL expression in the repository is valid"
python3 "$D/check-promql.py" >/dev/null 2>&1 \
  && pass "check-promql.py: all assertions hold" \
  || fail "check-promql.py reports failures" "all expressions parsing, all metrics existing" \
          "python3 scripts/validate/check-promql.py"

header "The operator is installed"
K get crd servicemonitors.monitoring.coreos.com >/dev/null 2>&1 \
  && pass "Prometheus Operator CRDs present" \
  || fail "ServiceMonitor CRD missing" "kube-prometheus-stack installed" "make observability"

for d in kube-prometheus-stack-operator kube-prometheus-stack-grafana; do
  K get deploy "$d" -n "${NS_OBS}" >/dev/null 2>&1 && pass "$d present" \
    || fail "$d missing" "the observability stack" "make observability"
done

header "Every ServiceMonitor carries the selector label"
MISSING=""
while read -r ns name rel; do
  [[ -z "${name:-}" ]] && continue
  [[ "$rel" == "kube-prometheus-stack" ]] || MISSING="$MISSING $ns/$name"
done < <(K get servicemonitor -A -l app.kubernetes.io/part-of=axispay \
        -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{" "}{.metadata.labels.release}{"\n"}{end}' 2>/dev/null)
[[ -z "${MISSING// /}" ]] && pass "all ServiceMonitors labelled release=kube-prometheus-stack" \
  || fail "missing the release label:$MISSING" "release: kube-prometheus-stack" \
          "without it Prometheus IGNORES the object — the target is ABSENT, not down"

header "Alert rules are applied"
K get prometheusrule axispay-slo -n "${NS_OBS}" >/dev/null 2>&1 \
  && pass "PrometheusRule axispay-slo applied" \
  || fail "PrometheusRule missing" "the SLO rules" "kubectl apply -f manifests/day5/observability/02-prometheusrules.yaml"

N="$(K get prometheusrule axispay-slo -n "${NS_OBS}" -o json 2>/dev/null \
     | python3 -c 'import json,sys; d=json.load(sys.stdin); print(sum(len(g["rules"]) for g in d["spec"]["groups"]))' 2>/dev/null)"
[[ "${N:-0}" -eq 9 ]] && pass "$N alert rules loaded" \
  || fail "${N:-0} alert rules, expected 9" "9 alerts" "kubectl get prometheusrule axispay-slo -n ${NS_OBS} -o yaml"

header "Dashboards are provisioned as data"
DASH="$(K get configmap -n "${NS_OBS}" -l grafana_dashboard=1 --no-headers 2>/dev/null | wc -l | tr -d ' ')"
[[ "${DASH:-0}" -ge 2 ]] && pass "$DASH dashboard ConfigMaps" \
  || fail "${DASH:-0} dashboards" "2" "kubectl apply -f manifests/day5/observability/04-grafana-dashboards.yaml"

header "The application actually exports the metrics"
POD="$(K get pod -n "${NS_CORE}" -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
if [[ -n "$POD" ]]; then
  M="$(K exec -n "${NS_CORE}" "$POD" -- python3 -c \
      "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8080/metrics').read().decode())" 2>/dev/null)"
  for s in axispay_http_requests_total axispay_http_request_duration_seconds_bucket axispay_payments_total; do
    echo "$M" | grep -q "^$s" && pass "$s exported" \
      || fail "$s NOT exported" "the series the alerts query" "kubectl exec ... -- curl localhost:8080/metrics"
  done
else
  fail "no payment-service pod" "a running payment-service" "kubectl get pods -n ${NS_CORE}"
fi

summary
