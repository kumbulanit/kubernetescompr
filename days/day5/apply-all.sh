#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DAY4_SCRIPT="$REPO_ROOT/days/day4/apply-all.sh"
DAY5_LAB_MANIFEST_ROOT="$REPO_ROOT/days/day5/labs"
DAY5_PLATFORM_MANIFEST_DIR="$REPO_ROOT/platform/manifests/day5"
OBS_INSTALL_SCRIPT="$REPO_ROOT/platform/scripts/setup/07-install-observability.sh"

if [[ ! -f "$DAY4_SCRIPT" ]]; then
  echo "Day 4 apply script not found: $DAY4_SCRIPT" >&2
  exit 1
fi

if [[ ! -d "$DAY5_LAB_MANIFEST_ROOT" ]]; then
  echo "Day 5 lab manifest root not found: $DAY5_LAB_MANIFEST_ROOT" >&2
  exit 1
fi

if [[ ! -d "$DAY5_PLATFORM_MANIFEST_DIR" ]]; then
  echo "Day 5 platform manifest directory not found: $DAY5_PLATFORM_MANIFEST_DIR" >&2
  exit 1
fi

if [[ ! -f "$OBS_INSTALL_SCRIPT" ]]; then
  echo "Observability install script not found: $OBS_INSTALL_SCRIPT" >&2
  exit 1
fi

echo "[day5] Applying Day 1 through Day 4 manifests..."
bash "$DAY4_SCRIPT"

INSTALL_OBS=0
for crd in servicemonitors.monitoring.coreos.com prometheusrules.monitoring.coreos.com alertmanagerconfigs.monitoring.coreos.com; do
  if ! kubectl get crd "$crd" >/dev/null 2>&1; then
    INSTALL_OBS=1
    break
  fi
done

if [[ "$INSTALL_OBS" -eq 1 ]]; then
  echo "[day5] Observability CRDs are missing; installing the observability stack first..."
  bash "$OBS_INSTALL_SCRIPT"
else
  echo "[day5] Observability CRDs already present; skipping the install step"
fi

mapfile -t lab_manifest_dirs < <(find "$DAY5_LAB_MANIFEST_ROOT" -type d -name manifests | sort)
for manifest_dir in "${lab_manifest_dirs[@]}"; do
  echo "[day5] Applying lab manifests from $manifest_dir"
  bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$manifest_dir"
done

echo "[day5] Applying Day 5 platform manifests..."
bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$DAY5_PLATFORM_MANIFEST_DIR"
