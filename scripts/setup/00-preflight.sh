#!/usr/bin/env bash
# ==============================================================================
# AxisPay Kubernetes Training — Preflight Check
# ==============================================================================
# Verifies this machine can run the course labs.
#
# Run this AT LEAST A WEEK BEFORE the course starts and send the output to your
# instructor. Every check here exists because it has caused a lost training
# morning at some point.
#
#   ./scripts/setup/00-preflight.sh [--profile A|B] [--quiet]
#
# Exit codes:  0 ready   1 blocking failure   2 warnings only
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck disable=SC1091
[[ -f "${REPO_ROOT}/VERSIONS.env" ]] && source "${REPO_ROOT}/VERSIONS.env"

PROFILE="A"
QUIET=0
PASS=0; WARN=0; FAIL=0

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; BLU=$'\033[34m'
BLD=$'\033[1m';  DIM=$'\033[2m';  RST=$'\033[0m'

usage() {
  cat <<EOF
${BLD}AxisPay Preflight Check${RST}

  --profile A|B   Cluster profile to validate against
                    A = recommended (8 vCPU / 16 GB host, 3 nodes)
                    B = minimum     (4 vCPU / 8 GB host,  2 nodes)
  --quiet         Only show problems
  -h, --help      This message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-A}"; shift 2 ;;
    --quiet)   QUIET=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# ---- reporting helpers -------------------------------------------------------
section() { printf "\n${BLD}${BLU}%s${RST}\n" "$1"; }
ok()   { ((PASS++)); (( QUIET )) || printf "  ${GRN}✓${RST} %-34s %s\n" "$1" "${2:-}"; }
warn() { ((WARN++));            printf "  ${YEL}!${RST} %-34s %s\n" "$1" "${2:-}"
         [[ -n "${3:-}" ]] && printf "    ${DIM}→ %s${RST}\n" "$3"; }
bad()  { ((FAIL++));            printf "  ${RED}✗${RST} %-34s %s\n" "$1" "${2:-}"
         [[ -n "${3:-}" ]] && printf "    ${DIM}→ %s${RST}\n" "$3"; }

if [[ "$PROFILE" == "A" ]]; then
  REQ_CPU=8; REQ_MEM_GB=16; REQ_NODES=3
else
  REQ_CPU=4; REQ_MEM_GB=8;  REQ_NODES=2
fi
MIN_CPU=4; MIN_MEM_GB=8; MIN_DISK_GB=40

printf "\n${BLD}AxisPay Kubernetes Training — Preflight${RST}\n"
printf "${DIM}Course %s · Kubernetes %s · cluster profile %s (%s nodes)${RST}\n" \
  "${COURSE_CODE:-AXP-K8S-5D}" "${KUBERNETES_VERSION:-v1.36.2}" "$PROFILE" "$REQ_NODES"

# ==============================================================================
section "Operating system"
# ==============================================================================
if [[ "$(uname -s)" != "Linux" ]]; then
  bad "Operating system" "$(uname -s)" \
      "The labs target Ubuntu. On macOS/Windows, run Ubuntu in a VM and allocate the resources below TO THE VM."
elif [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu)
      case "${VERSION_ID:-}" in
        26.04|24.04) ok "Ubuntu version" "${VERSION_ID} LTS" ;;
        22.04) warn "Ubuntu version" "${VERSION_ID} LTS" \
               "Supported but not tested for this release. 24.04 or 26.04 preferred." ;;
        *) warn "Ubuntu version" "${VERSION_ID:-unknown}" \
                "Course targets 26.04 LTS (24.04 LTS supported)." ;;
      esac ;;
    debian) warn "Distribution" "Debian ${VERSION_ID:-}" "Should work; instructions assume Ubuntu package names." ;;
    *) warn "Distribution" "${PRETTY_NAME:-unknown}" "Course targets Ubuntu. Tool install steps will differ." ;;
  esac
  ok "Kernel" "$(uname -r)"
else
  warn "Operating system" "cannot identify" "/etc/os-release not readable"
fi

# ==============================================================================
section "CPU"
# ==============================================================================
CPU_COUNT="$(nproc 2>/dev/null || echo 0)"
if   (( CPU_COUNT >= REQ_CPU )); then ok  "Logical CPUs" "${CPU_COUNT} (recommended: ${REQ_CPU})"
elif (( CPU_COUNT >= MIN_CPU )); then warn "Logical CPUs" "${CPU_COUNT}" \
     "Meets the ${MIN_CPU}-vCPU minimum. Use profile B: make preflight PROFILE=B"
else bad "Logical CPUs" "${CPU_COUNT}" \
     "Minimum is ${MIN_CPU} vCPU. The cluster will not start reliably below this."
fi

if grep -qE '(vmx|svm)' /proc/cpuinfo 2>/dev/null; then
  ok "Hardware virtualisation" "available"
else
  warn "Hardware virtualisation" "not detected" \
       "Fine with the docker driver. Required only if you switch to a VM driver."
fi

# ==============================================================================
section "Memory"
# ==============================================================================
MEM_KB="$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
MEM_GB=$(( MEM_KB / 1024 / 1024 ))
if   (( MEM_GB >= REQ_MEM_GB )); then ok  "Total RAM" "${MEM_GB} GB (recommended: ${REQ_MEM_GB} GB)"
elif (( MEM_GB >= MIN_MEM_GB )); then warn "Total RAM" "${MEM_GB} GB" \
     "Meets the ${MIN_MEM_GB} GB minimum. Use profile B and the slim observability values on Day 5."
else bad "Total RAM" "${MEM_GB} GB" \
     "Minimum is ${MIN_MEM_GB} GB. Day 3 onward will fail with OOM kills below this."
fi

SWAP_KB="$(awk '/SwapTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
(( SWAP_KB > 0 )) && ok "Swap" "$(( SWAP_KB / 1024 / 1024 )) GB present" \
                  || warn "Swap" "none" "Not required, but gives headroom on an 8 GB host."

# ==============================================================================
section "Disk"
# ==============================================================================
DISK_GB="$(df -BG --output=avail "$HOME" 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)"
if   (( DISK_GB >= 60 ));          then ok  "Free space in \$HOME" "${DISK_GB} GB"
elif (( DISK_GB >= MIN_DISK_GB )); then warn "Free space in \$HOME" "${DISK_GB} GB" \
     "Enough to start. 60 GB recommended — images and volumes grow through the week."
else bad "Free space in \$HOME" "${DISK_GB} GB" \
     "Minimum is ${MIN_DISK_GB} GB. Free space before the course starts."
fi

# ==============================================================================
section "Required tooling"
# ==============================================================================
check_tool() {
  local cmd="$1" label="$2" hint="$3"
  if command -v "$cmd" >/dev/null 2>&1; then
    local v; v="$("$cmd" version --short 2>/dev/null || "$cmd" --version 2>/dev/null || echo "installed")"
    ok "$label" "$(echo "$v" | head -1 | cut -c1-46)"
  else
    warn "$label" "not installed" "$hint"
  fi
}
check_tool docker   "Docker"   "make install-tools will install it"
check_tool minikube "Minikube" "make install-tools will install it"
check_tool kubectl  "kubectl"  "make install-tools will install it"
check_tool helm     "Helm"     "make install-tools will install it"
check_tool git      "Git"      "sudo apt install -y git"
check_tool curl     "curl"     "sudo apt install -y curl"
check_tool jq       "jq"       "sudo apt install -y jq — used by validation scripts"

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    ok "Docker daemon" "reachable without sudo"
  elif sudo -n docker info >/dev/null 2>&1; then
    bad "Docker daemon" "requires sudo" \
        "Run: sudo usermod -aG docker \$USER && newgrp docker — Minikube's docker driver needs rootless access."
  else
    bad "Docker daemon" "not running" "Run: sudo systemctl enable --now docker"
  fi
fi

# ==============================================================================
section "Network"
# ==============================================================================
if curl -fsS --max-time 8 https://registry.k8s.io/v2/ >/dev/null 2>&1; then
  ok "registry.k8s.io" "reachable"
else
  bad "registry.k8s.io" "unreachable" \
      "Needed once, to pull base images. Check proxy/firewall — see instructor/setup/OFFLINE.md"
fi
if curl -fsS --max-time 8 https://auth.docker.io/token?service=registry.docker.io >/dev/null 2>&1; then
  ok "Docker Hub" "reachable"
else
  warn "Docker Hub" "unreachable" "Needed once for base images (python, postgres, redis, rabbitmq)."
fi

for p in 8080 8443 5432 6379; do
  if command -v ss >/dev/null 2>&1 && ss -Hltn "sport = :$p" 2>/dev/null | grep -q .; then
    warn "Port ${p}" "in use" "Used by port-forward labs. Free it or expect a bind error."
  fi
done
(( QUIET )) || ok "Local port availability" "checked 8080, 8443, 5432, 6379"

# ==============================================================================
section "Existing cluster"
# ==============================================================================
if command -v minikube >/dev/null 2>&1; then
  if minikube profile list 2>/dev/null | grep -q "${MINIKUBE_PROFILE:-axispay}"; then
    warn "Minikube profile '${MINIKUBE_PROFILE:-axispay}'" "already exists" \
         "make setup will reuse it. To start clean: minikube delete -p ${MINIKUBE_PROFILE:-axispay}"
  else
    ok "Minikube profile" "clean — none exists yet"
  fi
fi

# ==============================================================================
# Summary
# ==============================================================================
printf "\n${BLD}Summary${RST}  ${GRN}%d passed${RST} · ${YEL}%d warnings${RST} · ${RED}%d failures${RST}\n" \
  "$PASS" "$WARN" "$FAIL"

if (( FAIL > 0 )); then
  printf "\n${RED}${BLD}NOT READY.${RST} Resolve the %d failure(s) above before day 1.\n" "$FAIL"
  printf "${DIM}Send this output to your instructor if you need help.${RST}\n\n"
  exit 1
elif (( WARN > 0 )); then
  printf "\n${YEL}${BLD}READY, with warnings.${RST} The course will run. Read the warnings above.\n"
  printf "Next: ${BLD}make setup${RST}\n\n"
  exit 2
else
  printf "\n${GRN}${BLD}READY.${RST} Next: ${BLD}make setup${RST}\n\n"
  exit 0
fi
