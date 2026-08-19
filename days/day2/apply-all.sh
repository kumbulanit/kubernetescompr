#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DAY1_SCRIPT="$REPO_ROOT/days/day1/apply-all.sh"
DAY2_LAB_MANIFEST_ROOT="$REPO_ROOT/days/day2/labs"
DAY2_PLATFORM_MANIFEST_DIR="$REPO_ROOT/platform/manifests/day2"

if [[ ! -f "$DAY1_SCRIPT" ]]; then
  echo "Day 1 apply script not found: $DAY1_SCRIPT" >&2
  exit 1
fi

if [[ ! -d "$DAY2_LAB_MANIFEST_ROOT" ]]; then
  echo "Day 2 lab manifest root not found: $DAY2_LAB_MANIFEST_ROOT" >&2
  exit 1
fi

if [[ ! -d "$DAY2_PLATFORM_MANIFEST_DIR" ]]; then
  echo "Day 2 platform manifest directory not found: $DAY2_PLATFORM_MANIFEST_DIR" >&2
  exit 1
fi

echo "[day2] Applying Day 1 manifests..."
bash "$DAY1_SCRIPT"

mapfile -t lab_manifest_dirs < <(find "$DAY2_LAB_MANIFEST_ROOT" -type d -name manifests | sort)
for manifest_dir in "${lab_manifest_dirs[@]}"; do
  echo "[day2] Applying lab manifests from $manifest_dir"
  bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$manifest_dir"
done

echo "[day2] Applying Day 2 platform manifests..."
bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$DAY2_PLATFORM_MANIFEST_DIR"
