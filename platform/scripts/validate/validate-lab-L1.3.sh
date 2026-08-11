#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L1.3"; LAB_DOC="days/day1/labs/L1.3-first-pod/"

header "L1.3 — The first Pod"
if K get pod payment-service-bare -n "${NS_CORE}" >/dev/null 2>&1; then
  PHASE="$(K get pod payment-service-bare -n "${NS_CORE}" -o jsonpath='{.status.phase}')"
  [[ "$PHASE" == "Running" ]] && pass "payment-service-bare is Running" \
    || fail "pod phase is $PHASE" "Running" "kubectl describe pod payment-service-bare -n ${NS_CORE}"

  USER_ID="$(K exec payment-service-bare -n "${NS_CORE}" -- id -u 2>/dev/null || echo "?")"
  [[ "$USER_ID" == "${APP_UID}" ]] && pass "runs as non-root (uid ${APP_UID})" \
    || fail "running as uid $USER_ID" "uid ${APP_UID}" "check USER in images/payment-service/Dockerfile"

  H="$(K exec payment-service-bare -n "${NS_CORE}" -- \
       python3 -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8080/healthz',timeout=3).status)" 2>/dev/null || echo 000)"
  [[ "$H" == "200" ]] && pass "/healthz returns 200 — the process is alive" \
    || fail "/healthz returned $H" "200" "kubectl logs payment-service-bare -n ${NS_CORE}"

  printf "  %s○%s NOTE: /readyz returning 503 here is CORRECT — merchant-service does not exist until L1.6\n" "$YEL" "$RST"
else
  pass "payment-service-bare has been deleted — you completed step 7"
  printf "    %s→ and nothing recreated it. That is the lesson of this lab.%s\n" "$DIM" "$RST"
fi
summary
