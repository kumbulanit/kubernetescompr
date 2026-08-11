#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L2.5"; LAB_DOC="days/day2/labs/L2.5-workload-types/"

header "L2.5 — DaemonSet: exactly one pod per node"
NODES="$(K get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')"
READY="$(K get daemonset node-agent -n "${NS_OPS}" -o jsonpath='{.status.numberReady}' 2>/dev/null || echo 0)"
DESIRED="$(K get daemonset node-agent -n "${NS_OPS}" -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo 0)"
[[ "${READY:-0}" -eq "${NODES:-0}" && "${NODES:-0}" -gt 0 ]] \
  && pass "node-agent: ${READY} ready on ${NODES} node(s) — invariant holds" \
  || fail "node-agent ${READY} ready / ${DESIRED} desired on ${NODES} nodes" \
          "one ready pod per node" \
          "kubectl describe daemonset node-agent -n ${NS_OPS}; check taints with kubectl describe node"
K get pods -n "${NS_OPS}" -l app.kubernetes.io/name=node-agent \
  -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName --no-headers 2>/dev/null | sed 's/^/    /'
K get daemonset node-agent -n "${NS_OPS}" -o json 2>/dev/null \
  | grep -q '"replicas"' && fail "DaemonSet has a replicas field" "there is no replicas field" "" \
  || pass "no replicas field — the node inventory decides the count"

header "Job: run to completion"
SUCC="$(K get job recon-worker -n "${NS_ASYNC}" -o jsonpath='{.status.succeeded}' 2>/dev/null || echo 0)"
[[ "${SUCC:-0}" -ge 1 ]] \
  && pass "recon-worker succeeded (${SUCC})" \
  || fail "recon-worker has not completed" "status.succeeded >= 1" \
          "kubectl logs -n ${NS_ASYNC} job/recon-worker; kubectl describe job recon-worker -n ${NS_ASYNC}"
RP="$(K get job recon-worker -n "${NS_ASYNC}" -o jsonpath='{.spec.template.spec.restartPolicy}' 2>/dev/null)"
[[ "$RP" == "Never" || "$RP" == "OnFailure" ]] \
  && pass "restartPolicy=$RP (Always is rejected for Jobs)" \
  || fail "restartPolicy=$RP" "Never or OnFailure" ""
for f in backoffLimit activeDeadlineSeconds; do
  K get job recon-worker -n "${NS_ASYNC}" -o jsonpath="{.spec.$f}" 2>/dev/null | grep -q . \
    && pass "Job sets $f" || fail "Job has no $f" "bounded retries and runtime" ""
done

header "Ledger invariant — did reconciliation balance?"
K logs -n "${NS_ASYNC}" job/recon-worker --tail=50 2>/dev/null | grep -o '"balanced": *[a-z]*' | sort | uniq -c | sed 's/^/    /' || true
if K logs -n "${NS_ASYNC}" job/recon-worker --tail=50 2>/dev/null | grep -q '"balanced": *false'; then
  fail "a currency position did not balance" "gross == fees + net" "kubectl logs -n ${NS_ASYNC} job/recon-worker"
else
  pass "every currency position balances (gross == fees + net)"
fi

header "CronJob: scheduled, time-zoned, and cannot double-run"
assert_resource cronjob "${NS_ASYNC}" settlement-cron "manifests/day2/workloads/03-cronjob-settlement.yaml"
read -r SCH TZ CP <<<"$(K get cronjob settlement-cron -n "${NS_ASYNC}" \
  -o jsonpath='{.spec.schedule} {.spec.timeZone} {.spec.concurrencyPolicy}' 2>/dev/null)"
[[ -n "$SCH" ]]        && pass "schedule: $SCH"        || fail "no schedule" "" ""
[[ -n "$TZ" ]]         && pass "timeZone: $TZ"         || fail "no timeZone — the cluster runs UTC" "timeZone set" "a settlement batch on the wrong calendar day is an accounting defect"
[[ "$CP" == "Forbid" ]] && pass "concurrencyPolicy: Forbid — settlement cannot double-run" \
  || fail "concurrencyPolicy: $CP" "Forbid" "Allow or Replace would double-count or leave partial work"
summary
