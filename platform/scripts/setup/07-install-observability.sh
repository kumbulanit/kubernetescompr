#!/usr/bin/env bash
# ==============================================================================
# Install the observability stack: Prometheus, Alertmanager, Grafana, Loki, Alloy
# ==============================================================================
#   ./scripts/setup/07-install-observability.sh          full install
#   ./scripts/setup/07-install-observability.sh --metrics-only   skip Loki/Alloy
#   ./scripts/setup/07-install-observability.sh --uninstall
#
# RUN THIS BEFORE DAY 5, NOT DURING IT.
# The three Helm charts pull roughly 1.5 GB of images. On classroom wifi that
# is fifteen to forty minutes of nothing happening, and it is the single most
# common reason a Day 5 morning runs late. Ask participants to run it at the
# end of Day 4, or pre-pull on the instructor machine and share.
#
# --metrics-only exists for constrained laptops. Loki plus Alloy add about
# 400 MB of memory; without them you lose the log-correlation lab (L5.5) but
# keep metrics, dashboards and alert routing.
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"

K() { kubectl --context="${MINIKUBE_PROFILE}" "$@"; }
H() { helm --kube-context="${MINIKUBE_PROFILE}" "$@"; }

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_B=$'\033[1m'; C_D=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$C_B" "$1" "$C_D"; }
ok()   { printf '  %sOK%s   %s\n' "$C_G" "$C_D" "$1"; }
warn() { printf '  %sWARN%s %s\n' "$C_Y" "$C_D" "$1"; }
die()  { printf '  %sFAIL%s %s\n' "$C_R" "$C_D" "$1"; exit 1; }

METRICS_ONLY=0
case "${1:-}" in
  --metrics-only) METRICS_ONLY=1 ;;
  --uninstall)
    step "Removing the observability stack"
    H uninstall alloy -n "${NS_OBS}" 2>/dev/null || true
    H uninstall loki  -n "${NS_OBS}" 2>/dev/null || true
    H uninstall kube-prometheus-stack -n "${NS_OBS}" 2>/dev/null || true
    # The operator's CRDs are NOT removed by `helm uninstall`. That is
    # deliberate on Helm's part: deleting a CRD deletes every custom resource
    # of that kind cluster-wide, which is not something a chart should do
    # silently. Remove them by hand only if you mean it:
    #   kubectl delete crd $(kubectl get crd -o name | grep monitoring.coreos.com)
    warn "CRDs left in place on purpose — deleting them removes every "
    warn "ServiceMonitor and PrometheusRule in the cluster."
    K delete pvc -n "${NS_OBS}" --all 2>/dev/null || true
    ok "uninstalled"
    exit 0 ;;
  "") ;;
  *) die "unknown option: $1" ;;
esac

command -v helm >/dev/null || die "helm is not installed — see scripts/setup/00-preflight.sh"

# ------------------------------------------------------------------------------
step "Checking there is room for this"
# ------------------------------------------------------------------------------
# The stack requests roughly 400m CPU and 1.3Gi of memory. On Profile B that is
# most of what is left, which is exactly why --metrics-only exists.
ALLOC=$(K get nodes -o jsonpath='{range .items[*]}{.status.allocatable.cpu}{"\n"}{end}' \
        | sed 's/m$//' | awk '{s += ($1 < 100 ? $1*1000 : $1)} END {print s}')
echo "  cluster allocatable CPU: ${ALLOC}m"
if [[ "${ALLOC}" -lt 4000 && "${METRICS_ONLY}" -eq 0 ]]; then
  warn "Under 4 CPU allocatable. Consider --metrics-only, or expect Pending pods."
fi

# ------------------------------------------------------------------------------
step "Adding chart repositories"
# ------------------------------------------------------------------------------
H repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
H repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
H repo update >/dev/null
ok "repositories updated"

K create namespace "${NS_OBS}" --dry-run=client -o yaml | K apply -f - >/dev/null
# Alloy needs a hostPath to read /var/log/pods, so this namespace cannot meet
# the restricted standard. The exception is declared here and in
# manifests/day5/security/01-pod-security.yaml — never discovered at 2pm.
K label namespace "${NS_OBS}" \
  pod-security.kubernetes.io/enforce=privileged \
  pod-security.kubernetes.io/audit=baseline \
  pod-security.kubernetes.io/warn=baseline --overwrite >/dev/null
ok "namespace ${NS_OBS} ready (Pod Security: privileged — Alloy needs hostPath)"

# ------------------------------------------------------------------------------
step "Installing kube-prometheus-stack ${KUBE_PROM_STACK_VERSION}"
# ------------------------------------------------------------------------------
echo "  this pulls ~900 MB and takes 5-15 minutes on first run"
H upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --version "${KUBE_PROM_STACK_VERSION}" \
  -n "${NS_OBS}" \
  -f "$R/platform/charts/observability/kube-prometheus-stack-values.yaml" \
  --wait --timeout 15m
ok "Prometheus, Alertmanager and Grafana installed"

if [[ "${METRICS_ONLY}" -eq 0 ]]; then
  # ----------------------------------------------------------------------------
  step "Installing Loki ${LOKI_CHART_VERSION}"
  # ----------------------------------------------------------------------------
  H upgrade --install loki grafana/loki \
    --version "${LOKI_CHART_VERSION}" \
    -n "${NS_OBS}" \
    -f "$R/platform/charts/observability/loki-values.yaml" \
    --wait --timeout 10m
  ok "Loki installed (single-binary, 24h retention)"

  # ----------------------------------------------------------------------------
  step "Installing Alloy ${ALLOY_CHART_VERSION}"
  # ----------------------------------------------------------------------------
  H upgrade --install alloy grafana/alloy \
    --version "${ALLOY_CHART_VERSION}" \
    -n "${NS_OBS}" \
    -f "$R/platform/charts/observability/alloy-values.yaml" \
    --wait --timeout 10m
  ok "Alloy installed (DaemonSet — one collector per node)"
else
  warn "--metrics-only: Loki and Alloy skipped. L5.5 (log correlation) will not run."
fi

# ------------------------------------------------------------------------------
step "Applying the AxisPay observability manifests"
# ------------------------------------------------------------------------------
# Order matters here only in one respect: the CRDs must exist before the
# ServiceMonitors, PrometheusRules and AlertmanagerConfigs reference them.
# `helm --wait` above guarantees that.
K apply -f "$R/platform/manifests/day5/observability/"
ok "ServiceMonitors, rules, alert routing, dashboards and the sink applied"

# ------------------------------------------------------------------------------
step "Verifying"
# ------------------------------------------------------------------------------
K -n "${NS_OBS}" rollout status deploy/alert-sink --timeout=120s >/dev/null \
  && ok "alert-sink is Ready" || warn "alert-sink is not Ready yet"

SM=$(K get servicemonitor -A -l app.kubernetes.io/part-of=axispay --no-headers 2>/dev/null | wc -l)
[[ "${SM}" -ge 5 ]] && ok "${SM} ServiceMonitors registered" \
                    || warn "only ${SM} ServiceMonitors — expected 5"

RULES=$(K get prometheusrule -n "${NS_OBS}" -l app.kubernetes.io/part-of=axispay --no-headers 2>/dev/null | wc -l)
[[ "${RULES}" -ge 1 ]] && ok "PrometheusRule applied" || warn "no PrometheusRule found"

DASH=$(K get configmap -n "${NS_OBS}" -l grafana_dashboard=1 --no-headers 2>/dev/null | wc -l)
[[ "${DASH}" -ge 2 ]] && ok "${DASH} dashboards provisioned" \
                      || warn "only ${DASH} dashboard ConfigMaps found"

cat <<EOF

${C_B}Observability is up.${C_D}

Grafana        kubectl -n ${NS_OBS} port-forward svc/kube-prometheus-stack-grafana 3000:80
               http://localhost:3000    admin / axispay-training
               Dashboards: "AxisPay — Payment Platform", "AxisPay — Incident Triage"

Prometheus     kubectl -n ${NS_OBS} port-forward svc/kube-prometheus-stack-prometheus 9090
               http://localhost:9090    Status -> Targets, then Alerts

Alertmanager   kubectl -n ${NS_OBS} port-forward svc/kube-prometheus-stack-alertmanager 9093

Alert sink     kubectl -n ${NS_OBS} logs -f deploy/alert-sink
               kubectl -n ${NS_OBS} port-forward svc/alert-sink 8080:8080
               curl -s localhost:8080/api/v1/routes | jq .

${C_B}First thing to check:${C_D} Prometheus -> Status -> Targets. Every AxisPay
service should be UP. A target that is missing entirely — rather than down —
almost always means the ServiceMonitor is missing its
\`release: kube-prometheus-stack\` label.
EOF
