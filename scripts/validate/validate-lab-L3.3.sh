#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L3.3"; LAB_DOC="labs/day3/L3.3-persistent-volumes/"

header "L3.3 — PersistentVolumes and Claims"
assert_resource pv "" axispay-ledger-archive "manifests/day3/storage/02-pv-ledger-archive.yaml" 2>/dev/null || \
  { K get pv axispay-ledger-archive >/dev/null 2>&1 && pass "PV axispay-ledger-archive exists" \
    || fail "PV axispay-ledger-archive missing" "" "kubectl apply -f manifests/day3/storage/"; }
assert_resource pvc "${NS_CORE}" ledger-archive "manifests/day3/storage/02-pv-ledger-archive.yaml"

PH="$(K get pvc ledger-archive -n "${NS_CORE}" -o jsonpath="{.status.phase}" 2>/dev/null)"
case "$PH" in
  Bound)   pass "PVC is Bound" ;;
  Pending) printf "  %s○%s PVC Pending — normal with WaitForFirstConsumer until a pod uses it\n" "$YEL" "$RST" ;;
  *)       fail "PVC phase is $PH" "Bound or Pending" "kubectl describe pvc ledger-archive -n ${NS_CORE}" ;;
esac

RP="$(K get pv axispay-ledger-archive -o jsonpath="{.spec.persistentVolumeReclaimPolicy}" 2>/dev/null)"
[[ "$RP" == "Retain" ]] && pass "reclaimPolicy=Retain — a ledger survives an accidental delete" \
  || fail "reclaimPolicy=$RP" "Retain" "Delete would destroy the data with the claim"
K get pv axispay-ledger-archive -o jsonpath="{.spec.nodeAffinity}" 2>/dev/null | grep -q . \
  && pass "hostPath PV declares nodeAffinity" \
  || fail "PV has no nodeAffinity" "required nodeAffinity" "otherwise the pod can be scheduled where the data is not"
summary
