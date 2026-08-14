#!/usr/bin/env bash
# ==============================================================================
# Install the toolchain required by the course.
# ==============================================================================
set -euo pipefail

D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
fi

C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_B=$'\033[1m'; C_D=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$C_B" "$1" "$C_D"; }
ok()   { printf '  %sOK%s   %s\n' "$C_G" "$C_D" "$1"; }
warn() { printf '  %sWARN%s %s\n' "$C_Y" "$C_D" "$1"; }
die()  { printf '  %sFAIL%s %s\n' "$C_R" "$C_D" "$1"; exit 1; }

arch_name() {
  local a
  a="$(uname -m)"
  case "$a" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) die "Unsupported architecture: $a" ;;
  esac
}

install_apt_pkg() {
  local pkg="$1"
  if ! command -v "$pkg" >/dev/null 2>&1; then
    step "Installing $pkg"
    $SUDO apt-get update -qq
    $SUDO apt-get install -y "$pkg"
  fi
}

install_minikube() {
  if command -v minikube >/dev/null 2>&1; then
    ok "minikube already installed ($(minikube version --short 2>/dev/null || minikube version))"
    return 0
  fi
  local arch
  arch="$(arch_name)"
  step "Installing minikube"
  curl -fsSL -o /tmp/minikube "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-${arch}"
  $SUDO install -m 0755 /tmp/minikube /usr/local/bin/minikube
  rm -f /tmp/minikube
  ok "minikube installed"
}

install_kubectl() {
  if command -v kubectl >/dev/null 2>&1; then
    ok "kubectl already installed ($(kubectl version --client --short 2>/dev/null || kubectl version --client))"
    return 0
  fi
  local arch
  arch="$(arch_name)"
  step "Installing kubectl ${KUBECTL_VERSION:-v1.36.2}"
  curl -fsSL -o /tmp/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION:-v1.36.2}/bin/linux/${arch}/kubectl"
  $SUDO install -m 0755 /tmp/kubectl /usr/local/bin/kubectl
  rm -f /tmp/kubectl
  ok "kubectl installed"
}

install_helm() {
  if command -v helm >/dev/null 2>&1; then
    ok "helm already installed ($(helm version --short 2>/dev/null || helm version))"
    return 0
  fi
  step "Installing Helm"
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  ok "helm installed"
}

step "Checking base packages"
install_apt_pkg docker.io
install_apt_pkg curl
install_apt_pkg git
install_apt_pkg jq
install_apt_pkg make
install_apt_pkg openssl

step "Ensuring Docker is usable"
if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon is not running or is not accessible from this user."
  warn "Run: sudo systemctl enable --now docker && sudo usermod -aG docker $USER && newgrp docker"
fi

install_minikube
install_kubectl
install_helm

printf '\n%sTooling is ready.%s\n' "$C_B" "$C_D"
printf 'Next: %s make preflight %s\n' "$C_B" "$C_D"
