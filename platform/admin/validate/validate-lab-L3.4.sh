#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.4"; LAB_DOC="days/day3/labs/L3.4-storageclass/"

header "L3.4 — StorageClass and dynamic provisioning"
K get storageclass axispay-standard >/dev/null 2>&1 \
  && pass "StorageClass axispay-standard exists" \
  || fail "StorageClass missing" "" "kubectl apply -f manifests/day3/storage/01-storageclass.yaml"
for kv in "reclaimPolicy Retain" "volumeBindingMode WaitForFirstConsumer"; do
  # shellcheck disable=SC2086
  set -- $kv
  GOT="$(K get sc axispay-standard -o jsonpath="{.$1}" 2>/dev/null)"
  [[ "$GOT" == "$2" ]] && pass "$1 = $2" || fail "$1 = $GOT" "$2" "see manifests/day3/storage/01-storageclass.yaml"
done

header "Dynamically provisioned volumes exist"
N="$(K get pv -o jsonpath="{range .items[?(@.spec.storageClassName==\"axispay-standard\")]}{.metadata.name}{\"\n\"}{end}" 2>/dev/null | grep -c . || echo 0)"
[[ "${N:-0}" -ge 1 ]] && pass "$N PV(s) provisioned by axispay-standard" \
  || fail "no dynamically provisioned volumes" ">=1" "deploy the data tier (L3.5)"
summary
