#!/usr/bin/env bash
# ==============================================================================
# Build ONE AxisPay image into the Minikube container runtime.
#   ./scripts/build/build-service.sh --service payment-service [--tag 1.1.0]
# ==============================================================================
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"

SVC=""; TAG="${IMAGE_TAG}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SVC="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
[[ -n "$SVC" ]] || { echo "--service is required"; exit 1; }
[[ -f "$R/images/$SVC/Dockerfile" ]] || { echo "no Dockerfile for '$SVC'"; exit 1; }

minikube -p "${MINIKUBE_PROFILE}" status >/dev/null 2>&1 || {
  echo "Minikube profile '${MINIKUBE_PROFILE}' is not running. Run: make cluster"; exit 1; }
eval "$(minikube -p "${MINIKUBE_PROFILE}" docker-env)"

echo "Building ${IMAGE_NAMESPACE}/${SVC}:${TAG} ..."
docker build -t "${IMAGE_NAMESPACE}/${SVC}:${TAG}" -f "$R/images/$SVC/Dockerfile" "$R"
echo "Done. Verify: minikube -p ${MINIKUBE_PROFILE} image ls | grep ${SVC}"
