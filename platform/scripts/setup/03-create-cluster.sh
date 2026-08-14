#!/usr/bin/env bash
# ==============================================================================
# Create the course Minikube cluster with the required network and addon settings.
# ==============================================================================
set -euo pipefail

D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"

C_B=$'\033[1m'; C_D=$'\033[0m'

PROFILE="A"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-A}"; shift 2 ;;
    -h|--help) cat <<EOF
Usage: ${0##*/} [--profile A|B]

Creates the Minikube cluster used by the course.
EOF
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ "$PROFILE" == "A" ]]; then
  NODES="${PROFILE_A_NODES}"
  CPUS="${PROFILE_A_CPUS}"
  MEMORY="${PROFILE_A_MEMORY}"
else
  NODES="${PROFILE_B_NODES}"
  CPUS="${PROFILE_B_CPUS}"
  MEMORY="${PROFILE_B_MEMORY}"
fi

if minikube profile list 2>/dev/null | grep -q "${MINIKUBE_PROFILE:-axispay}"; then
  echo "Existing Minikube profile '${MINIKUBE_PROFILE:-axispay}' found. Reusing it."
  minikube profile "${MINIKUBE_PROFILE:-axispay}" >/dev/null 2>&1 || true
else
  echo "Creating Minikube profile '${MINIKUBE_PROFILE:-axispay}'"
fi

# Ensure a clean version of the cluster when the profile exists but should be rebuilt.
# This avoids the trap where a stale cluster has the wrong CNI or addon mix.
if minikube profile list 2>/dev/null | grep -q "${MINIKUBE_PROFILE:-axispay}"; then
  echo "Profile '${MINIKUBE_PROFILE:-axispay}' already exists; recreating it to ensure the correct CNI and addons."
  minikube delete -p "${MINIKUBE_PROFILE:-axispay}" >/dev/null || true
fi

cmd=(
  minikube start -p "${MINIKUBE_PROFILE:-axispay}"
  --driver="${MINIKUBE_DRIVER:-docker}"
  --container-runtime="${MINIKUBE_RUNTIME:-containerd}"
  --kubernetes-version="${KUBERNETES_VERSION:-v1.36.2}"
  --cpus="${CPUS}"
  --memory="${MEMORY}"
  --disk-size="${MINIKUBE_DISK:-20g}"
  --nodes="${NODES}"
  --cni="${MINIKUBE_CNI:-calico}"
  --addons="${MINIKUBE_ADDONS:-metrics-server,ingress,storage-provisioner}"
  --wait=all
)

"${cmd[@]}"

# Ensure the kube context resolves to the profile we just created.
kubectl config use-context "${MINIKUBE_PROFILE:-axispay}" >/dev/null 2>&1 || true

# Host entries expected by the labs.
for host in "${INGRESS_HOST_API:-api.axispay.local}" "${INGRESS_HOST_PORTAL:-portal.axispay.local}" "${INGRESS_HOST_GRAFANA:-grafana.axispay.local}"; do
  if ! grep -qE "^[[:space:]]*127\.0\.0\.1[[:space:]]+${host//./\\.}[[:space:]]*$" /etc/hosts 2>/dev/null; then
    if [[ "$(id -u)" -eq 0 ]]; then
      printf '127.0.0.1 %s\n' "$host" >> /etc/hosts
    else
      echo "Adding $host to /etc/hosts requires sudo."
      sudo sh -c "printf '127.0.0.1 %s\n' '$host' >> /etc/hosts"
    fi
  fi
done

kubectl --context="${MINIKUBE_PROFILE:-axispay}" wait --for=condition=Ready node --all --timeout=5m

printf '\nCluster is ready.\n'
printf 'Context: %s\n' "${MINIKUBE_PROFILE:-axispay}"
printf 'Next: %s make verify-cluster %s\n' "${C_B:-}" "${C_D:-}"
