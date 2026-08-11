#!/usr/bin/env bash
# ==============================================================================
# Build every AxisPay image directly into the Minikube container runtime.
# No registry, no push, no pull-rate limits, works offline after setup.
#
#   ./scripts/build/build-all.sh [--tag 1.0.0] [--only payment-service] [--parallel]
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
# shellcheck disable=SC1091
source "${REPO_ROOT}/VERSIONS.env"

TAG="${IMAGE_TAG}"; ONLY=""; PARALLEL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    --parallel) PARALLEL=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

GRN=$'\033[32m'; RED=$'\033[31m'; BLU=$'\033[34m'; BLD=$'\033[1m'; RST=$'\033[0m'

# Day 1 ships four services; later days add the rest. Only build what exists,
# so this script works unchanged from Monday to Friday.
ALL_SERVICES=(edge-gateway auth-service merchant-service payment-service \
              fraud-service routing-service node-agent recon-worker loadgen \
              customer-service ledger-service \
              settlement-service notification-service audit-service reporting-service)

SERVICES=()
for s in "${ALL_SERVICES[@]}"; do
  [[ -n "$ONLY" && "$s" != "$ONLY" ]] && continue
  [[ -f "${REPO_ROOT}/platform/images/${s}/Dockerfile" ]] && SERVICES+=("$s")
done

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "${RED}No buildable services found${RST}"; exit 1
fi

printf "%s%sBuilding %d image(s) at tag %s into Minikube profile '%s'%s\n\n" \
  "$BLD" "$BLU" "${#SERVICES[@]}" "$TAG" "$MINIKUBE_PROFILE" "$RST"

# THE critical line. Without it, images are built into the HOST docker daemon
# and the cluster cannot see them — the pods sit in ErrImageNeverPull and
# students lose twenty minutes. Re-evaluated here rather than assumed, because
# each shell is independent.
if ! minikube -p "${MINIKUBE_PROFILE}" status >/dev/null 2>&1; then
  echo "${RED}Minikube profile '${MINIKUBE_PROFILE}' is not running.${RST}"
  echo "Run: make cluster"; exit 1
fi
eval "$(minikube -p "${MINIKUBE_PROFILE}" docker-env)"
echo "Docker context: ${DOCKER_HOST:-<local>}"
echo

build_one() {
  local svc="$1"
  if docker build --quiet \
       -t "${IMAGE_NAMESPACE}/${svc}:${TAG}" \
       -f "${REPO_ROOT}/platform/images/${svc}/Dockerfile" \
       "${REPO_ROOT}" >/dev/null 2>"/tmp/build-${svc}.err"; then
    printf "  %s✓%s %-22s %s/%s:%s\n" "$GRN" "$RST" "$svc" "$IMAGE_NAMESPACE" "$svc" "$TAG"
  else
    printf "  %s✗%s %-22s build failed — see /tmp/build-%s.err\n" "$RED" "$RST" "$svc" "$svc"
    tail -15 "/tmp/build-${svc}.err" | sed 's/^/      /'
    return 1
  fi
}

FAILED=0
if [[ $PARALLEL -eq 1 ]]; then
  # Parallel is much faster but interleaves failure output, so it is opt-in.
  pids=()
  for s in "${SERVICES[@]}"; do build_one "$s" & pids+=($!); done
  for p in "${pids[@]}"; do wait "$p" || FAILED=$((FAILED+1)); done
else
  for s in "${SERVICES[@]}"; do build_one "$s" || FAILED=$((FAILED+1)); done
fi

echo
if [[ $FAILED -gt 0 ]]; then
  printf "%s%s%d build(s) failed.%s\n" "$RED" "$BLD" "$FAILED" "$RST"; exit 1
fi
printf "%s%sAll %d image(s) built.%s\n" "$GRN" "$BLD" "${#SERVICES[@]}" "$RST"
echo
echo "Verify with:  minikube -p ${MINIKUBE_PROFILE} image ls | grep ${IMAGE_NAMESPACE}/"
