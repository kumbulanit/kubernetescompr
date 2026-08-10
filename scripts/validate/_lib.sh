#!/usr/bin/env bash
# ==============================================================================
# Shared helpers for every AxisPay validation script.
#
# Design rule: a validation script that prints "FAILED" and nothing else
# teaches nothing. Every failure here names the expected artefact, the
# diagnostic command, and the manual section to read.
# ==============================================================================
# shellcheck disable=SC2034
GRN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; BLU=$'\033[34m'
BLD=$'\033[1m'; DIM=$'\033[2m'; RST=$'\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0
LAB_ID="${LAB_ID:-unknown}"
LAB_DOC="${LAB_DOC:-}"

K() { kubectl --context="${MINIKUBE_PROFILE:-axispay}" "$@"; }

header() { printf "\n%s%s%s%s\n%s\n" "$BLD" "$BLU" "$1" "$RST" "$(printf '%.0s-' {1..64})"; }

pass() {
  CHECKS_PASSED=$((CHECKS_PASSED+1))
  printf "  %s✓%s %s\n" "$GRN" "$RST" "$1"
}

fail() {
  CHECKS_FAILED=$((CHECKS_FAILED+1))
  printf "  %s✗%s %s\n" "$RED" "$RST" "$1"
  [[ -n "${2:-}" ]] && printf "    %s→ expected: %s%s\n" "$DIM" "$2" "$RST"
  [[ -n "${3:-}" ]] && printf "    %s→ check:    %s%s\n" "$DIM" "$3" "$RST"
}

# assert_resource <kind> <namespace> <name> [expected-file]
assert_resource() {
  local kind="$1" ns="$2" name="$3" src="${4:-}"
  if K get "$kind" "$name" -n "$ns" >/dev/null 2>&1; then
    pass "$kind $ns/$name exists"
  else
    fail "$kind $ns/$name NOT FOUND" "${src:-a $kind named $name}" "kubectl get $kind -n $ns"
  fi
}

# assert_ready <namespace> <deployment> <min-replicas>
assert_ready() {
  local ns="$1" name="$2" want="${3:-1}"
  local ready
  ready="$(K get deploy "$name" -n "$ns" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
  ready="${ready:-0}"
  if [[ "$ready" -ge "$want" ]]; then
    pass "Deployment $ns/$name has $ready/$want ready replica(s)"
  else
    fail "Deployment $ns/$name has $ready ready, expected >= $want" \
         "$want ready replicas" \
         "kubectl describe deploy $name -n $ns && kubectl get pods -n $ns"
  fi
}

# assert_endpoints <namespace> <service> <min>
assert_endpoints() {
  local ns="$1" name="$2" want="${3:-1}"
  local n
  n="$(K get endpointslice -n "$ns" -l "kubernetes.io/service-name=$name" \
        -o jsonpath='{range .items[*]}{range .endpoints[*]}{.addresses[0]}{"\n"}{end}{end}' 2>/dev/null | grep -c . || true)"
  if [[ "${n:-0}" -ge "$want" ]]; then
    pass "Service $ns/$name has $n endpoint(s)"
  else
    fail "Service $ns/$name has ${n:-0} endpoints, expected >= $want" \
         "the Service selector must match pod labels" \
         "kubectl get endpointslice -n $ns -l kubernetes.io/service-name=$name -o yaml"
  fi
}

summary() {
  local total=$((CHECKS_PASSED+CHECKS_FAILED))
  echo
  if [[ $CHECKS_FAILED -eq 0 ]]; then
    printf "%s%s✓ %s PASSED%s — %d/%d checks\n\n" "$GRN" "$BLD" "$LAB_ID" "$RST" "$CHECKS_PASSED" "$total"
    exit 0
  fi
  printf "%s%s✗ %s FAILED%s — %d of %d checks did not pass\n" "$RED" "$BLD" "$LAB_ID" "$RST" "$CHECKS_FAILED" "$total"
  [[ -n "$LAB_DOC" ]] && printf "%sSee %s (§9 Troubleshooting)%s\n" "$DIM" "$LAB_DOC" "$RST"
  echo
  exit 1
}
