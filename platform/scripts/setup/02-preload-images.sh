#!/usr/bin/env bash
# ==============================================================================
# Pull and cache the base images used by the labs.
# ==============================================================================
set -euo pipefail

D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_B=$'\033[1m'; C_D=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$C_B" "$1" "$C_D"; }
ok()   { printf '  %sOK%s   %s\n' "$C_G" "$C_D" "$1"; }
warn() { printf '  %sWARN%s %s\n' "$C_Y" "$C_D" "$1"; }
die()  { printf '  %sFAIL%s %s\n' "$C_R" "$C_D" "$1"; exit 1; }

pull_image() {
  local image="$1"
  echo "  pulling $image"
  docker pull "$image" >/dev/null 2>&1 || warn "failed to pull $image"
  if command -v minikube >/dev/null 2>&1 && minikube profile list 2>/dev/null | grep -q "${MINIKUBE_PROFILE:-axispay}"; then
    minikube image load "$image" -p "${MINIKUBE_PROFILE:-axispay}" >/dev/null 2>&1 || warn "image load failed for $image"
  fi
}

step "Pulling base images used by the course"
for image in \
  "${PYTHON_IMAGE}" \
  "${POSTGRES_IMAGE}" \
  "${REDIS_IMAGE}" \
  "${RABBITMQ_IMAGE}" \
  "${BUSYBOX_IMAGE}" \
  "${CURL_IMAGE}"; do
  pull_image "$image"
done

ok "base images cached locally"
printf '\n%sNext: %s make cluster%s\n' "$C_B" "$C_D" "$C_B"
