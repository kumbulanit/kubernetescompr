#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DAY3_SCRIPT="$REPO_ROOT/days/day3/apply-all.sh"
DAY4_LAB_MANIFEST_ROOT="$REPO_ROOT/days/day4/labs"
DAY4_PLATFORM_MANIFEST_DIR="$REPO_ROOT/platform/manifests/day4"

if [[ ! -f "$DAY3_SCRIPT" ]]; then
  echo "Day 3 apply script not found: $DAY3_SCRIPT" >&2
  exit 1
fi

if [[ ! -d "$DAY4_LAB_MANIFEST_ROOT" ]]; then
  echo "Day 4 lab manifest root not found: $DAY4_LAB_MANIFEST_ROOT" >&2
  exit 1
fi

if [[ ! -d "$DAY4_PLATFORM_MANIFEST_DIR" ]]; then
  echo "Day 4 platform manifest directory not found: $DAY4_PLATFORM_MANIFEST_DIR" >&2
  exit 1
fi

echo "[day4] Applying Day 1 through Day 3 manifests..."
bash "$DAY3_SCRIPT"

mapfile -t lab_manifest_dirs < <(find "$DAY4_LAB_MANIFEST_ROOT" -type d -name manifests | sort)
for manifest_dir in "${lab_manifest_dirs[@]}"; do
  echo "[day4] Applying lab manifests from $manifest_dir"
  bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$manifest_dir"
done

echo "[day4] Applying Day 4 platform manifests..."
bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$DAY4_PLATFORM_MANIFEST_DIR"
