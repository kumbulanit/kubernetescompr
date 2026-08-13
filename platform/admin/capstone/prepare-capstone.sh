#!/usr/bin/env bash
# ==============================================================================
# Capstone pre-flight — run this the NIGHT BEFORE, not at 09:00
# ==============================================================================
#   bash platform/admin/capstone/prepare-capstone.sh
#   bash platform/admin/capstone/prepare-capstone.sh --build     also build 2.0.0 images
#
# Checks the room is ready to run "Production Upgrade Under Fire". Every
# failure here is a failure that would otherwise consume part of a 110-minute
# window that has no slack in it.
#
# The single most common way the capstone fails is IMAGES. A student who
# cannot pull 2.0.0 spends the whole window on ImagePullBackOff and learns
# nothing the exercise was designed to teach.
# ==============================================================================
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$R/platform/admin/validate/_lib.sh"
LAB_ID="CAPSTONE PRE-FLIGHT"; LAB_DOC="documents/instructor/capstone-run-book.md"

BUILD=0; [[ "${1:-}" == "--build" ]] && BUILD=1

# ==============================================================================
header "The platform is at the version the brief assumes"
# ==============================================================================
if command -v helm >/dev/null 2>&1; then
  INFO="$(helm --kube-context="${MINIKUBE_PROFILE}" list -A -o json 2>/dev/null \
    | python3 -c 'import json,sys
try: rows=json.load(sys.stdin)
except Exception: rows=[]
r=next((x for x in rows if x["name"]=="axispay"), None)
print(f"{r[\"status\"]}|{r[\"app_version\"]}|{r[\"revision\"]}" if r else "MISSING||")')"
  IFS='|' read -r ST AV RV <<< "$INFO"
  [[ "$ST" == "deployed" ]] && pass "release axispay deployed (revision ${RV})" \
    || fail "release axispay is '${ST}'" "a deployed release" "helm history axispay"
else
  fail "helm not installed" "helm 3" "platform/scripts/setup/00-preflight.sh"
fi

CUR="$(K get deploy payment-service -n "${NS_CORE}" \
      -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)"
if [[ "$CUR" == *":${IMAGE_TAG_V1_1}" ]]; then
  pass "payment-service is on ${IMAGE_TAG_V1_1} — the brief upgrades from here"
elif [[ "$CUR" == *":${IMAGE_TAG_V2}" ]]; then
  fail "payment-service is ALREADY on ${IMAGE_TAG_V2}" \
       "${IMAGE_TAG_V1_1} before the window opens" \
       "helm rollback axispay   # the capstone has nothing to upgrade otherwise"
else
  fail "payment-service is on '${CUR##*:}'" "${IMAGE_TAG_V1_1}" \
       "helm upgrade axispay ./charts/axispay --set global.image.tag=${IMAGE_TAG_V1_1}"
fi

# ==============================================================================
header "The 2.0.0 images exist in the node runtime"
# ==============================================================================
if [[ $BUILD -eq 1 ]]; then
  echo "  building ${IMAGE_TAG_V2} images (this takes several minutes)..."
  ( eval "$(minikube -p "${MINIKUBE_PROFILE}" docker-env)" && \
    IMAGE_TAG="${IMAGE_TAG_V2}" bash "$R/platform/scripts/build/build-all.sh" ) >/dev/null 2>&1 \
    && echo "  build finished" || echo "  build reported errors — see platform/scripts/build/build-all.sh"
fi

WANT=$(echo "${AXISPAY_SERVICES}" | wc -w | tr -d ' ')
HAVE=$(minikube -p "${MINIKUBE_PROFILE}" image ls 2>/dev/null \
       | grep -c "${IMAGE_NAMESPACE}/.*:${IMAGE_TAG_V2}" || true)
if [[ "${HAVE:-0}" -ge "${WANT}" ]]; then
  pass "${HAVE}/${WANT} images tagged ${IMAGE_TAG_V2} are present"
else
  fail "only ${HAVE:-0}/${WANT} images tagged ${IMAGE_TAG_V2}" \
       "every service built at ${IMAGE_TAG_V2}" \
       "eval \$(minikube -p ${MINIKUBE_PROFILE} docker-env) && IMAGE_TAG=${IMAGE_TAG_V2} make build
       DO THIS THE NIGHT BEFORE. It is the most common way this session fails."
fi

# ==============================================================================
header "Observability is up — the students need it from minute one"
# ==============================================================================
K get crd servicemonitors.monitoring.coreos.com >/dev/null 2>&1 \
  && pass "Prometheus Operator CRDs present" \
  || fail "kube-prometheus-stack not installed" "the observability stack" \
          "make observability   # pulls ~1.5 GB — NEVER during the window"

for d in kube-prometheus-stack-grafana kube-prometheus-stack-operator alert-sink; do
  assert_ready "${NS_OBS}" "$d" 1
done

DASH=$(K get configmap -n "${NS_OBS}" -l grafana_dashboard=1 --no-headers 2>/dev/null | wc -l | tr -d ' ')
[[ "${DASH:-0}" -ge 2 ]] && pass "${DASH} dashboards provisioned" \
  || fail "${DASH:-0} dashboards" "2" "kubectl apply -f manifests/day5/observability/04-grafana-dashboards.yaml"

if K get prometheusrule axispay-slo -n "${NS_OBS}" >/dev/null 2>&1; then
  N="$(K get prometheusrule axispay-slo -n "${NS_OBS}" -o json 2>/dev/null \
      | python3 -c 'import json,sys; print(sum(len(g["rules"]) for g in json.load(sys.stdin)["spec"]["groups"]))' 2>/dev/null)"
  [[ "${N:-0}" -eq 9 ]] && pass "${N} alert rules loaded" \
    || fail "${N:-0} alert rules, expected 9" "9" "kubectl apply -f manifests/day5/observability/02-prometheusrules.yaml"
else
  fail "PrometheusRule axispay-slo missing" "the SLO rules" \
       "kubectl apply -f manifests/day5/observability/02-prometheusrules.yaml"
fi

# ==============================================================================
header "The three incidents have something to break"
# ==============================================================================
K get statefulset redis -n "${NS_DATA}" >/dev/null 2>&1 \
  && pass "redis StatefulSet present (INC-5 target)" \
  || fail "redis missing" "the cache INC-5 removes" "kubectl apply -f manifests/day3/"

K get netpol allow-core-and-async-to-data -n "${NS_DATA}" >/dev/null 2>&1 \
  && pass "data-tier NetworkPolicy present (INC-6 target, and the trap)" \
  || fail "data-tier policy missing" "the policy INC-6 narrows" \
          "kubectl apply -f manifests/day4/netpol/05-data-tier.yaml"

K get secret axispay-tls -n "${NS_EDGE}" >/dev/null 2>&1 \
  && pass "TLS Secret present (INC-7 target)" \
  || fail "axispay-tls missing" "the certificate INC-7 expires" "bash platform/scripts/setup/06-generate-tls.sh"

command -v openssl >/dev/null 2>&1 && pass "openssl available (INC-7 needs it)" \
  || fail "openssl not installed" "openssl" "apt-get install openssl"

# ==============================================================================
header "The migration is ready to apply, and has NOT already run"
# ==============================================================================
[[ -f "$R/capstone/manifests/01-settlement-migration.yaml" ]] \
  && pass "capstone/manifests/01-settlement-migration.yaml present" \
  || fail "migration manifest missing" "the settlement schema migration" "check the repository"

if K get job settlement-migration-2-0-0 -n "${NS_DATA}" >/dev/null 2>&1; then
  fail "the migration Job ALREADY EXISTS" "no prior run" \
       "kubectl delete job settlement-migration-2-0-0 -n ${NS_DATA}
       Left in place, the students have nothing to run and the rubric cannot score it."
else
  pass "no prior migration Job — the window has something to do"
fi

# ==============================================================================
header "Baseline — record these before the window opens"
# ==============================================================================
BAL="$(K -n "${NS_DATA}" exec postgres-0 -- psql -U axispay_app -d axispay -t -A \
      -c 'SELECT COALESCE(SUM(amount_minor),0) FROM ledger_entries;' 2>/dev/null | tr -d '[:space:]')"
[[ "${BAL:-x}" == "0" ]] && pass "ledger already balances to zero" \
  || fail "ledger sums to ${BAL:-<unreadable>} BEFORE the window" "zero" \
          "fix this now — otherwise the students inherit a failing check they did not cause"

PODS=$(K get pods -A -l app.kubernetes.io/part-of=axispay --no-headers 2>/dev/null | wc -l | tr -d ' ')
NOTREADY=$(K get pods -A -l app.kubernetes.io/part-of=axispay --no-headers 2>/dev/null \
           | awk '{split($2,a,"/"); if (a[1]!=a[2]) print}' | wc -l | tr -d ' ')
[[ "${NOTREADY:-1}" -eq 0 ]] && pass "${PODS} AxisPay pods, all Ready" \
  || fail "${NOTREADY} of ${PODS} pods not Ready" "a clean starting state" \
          "kubectl get pods -A -l app.kubernetes.io/part-of=axispay"

# ==============================================================================
header "Offline artefacts still agree"
# ==============================================================================
for s in check-manifests.py simulate-netpol.py simulate-rbac.py check-helm-chart.py check-promql.py; do
  python3 "$R/platform/admin/validate/$s" >/dev/null 2>&1 && pass "$s" \
    || fail "$s reports failures" "all assertions holding" "python3 platform/admin/validate/$s"
done

echo
printf "%sInjection commands — keep this terminal open:%s\n" "$BLD" "$RST"
cat <<EOF
  00:40  bash platform/admin/incidents/inject-INC-5.sh    # redis -> 0
  00:52  bash platform/admin/incidents/inject-INC-6.sh    # data-tier policy narrowed  (THE TRAP)
  01:04  bash platform/admin/incidents/inject-INC-7.sh    # TLS certificate expired

  Run book: documents/instructor/capstone-run-book.md
  Rubric:   documents/instructor/capstone-rubric.md   (print one per student)
EOF

summary
