#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DAY2_SCRIPT="$REPO_ROOT/days/day2/apply-all.sh"
DAY3_LAB_MANIFEST_ROOT="$REPO_ROOT/days/day3/labs"
DAY3_PLATFORM_MANIFEST_DIR="$REPO_ROOT/platform/manifests/day3"
DAY3_ROOT_NAMESPACE_MANIFEST="$REPO_ROOT/days/day3/00-namespaces.yaml"
DAY3_ROOT_STORAGE_MANIFEST="$REPO_ROOT/days/day3/00-ubuntu-local-storage.yaml"

if [[ ! -f "$DAY2_SCRIPT" ]]; then
  echo "Day 2 apply script not found: $DAY2_SCRIPT" >&2
  exit 1
fi

if [[ ! -d "$DAY3_LAB_MANIFEST_ROOT" ]]; then
  echo "Day 3 lab manifest root not found: $DAY3_LAB_MANIFEST_ROOT" >&2
  exit 1
fi

if [[ ! -d "$DAY3_PLATFORM_MANIFEST_DIR" ]]; then
  echo "Day 3 platform manifest directory not found: $DAY3_PLATFORM_MANIFEST_DIR" >&2
  exit 1
fi

echo "[day3] Applying Day 1 through Day 2 manifests..."
bash "$DAY2_SCRIPT"

echo "[day3] Applying Day 3 namespace and storage bootstrap..."
kubectl apply -f "$DAY3_ROOT_NAMESPACE_MANIFEST"
kubectl apply -f "$DAY3_ROOT_STORAGE_MANIFEST"

mapfile -t lab_manifest_dirs < <(find "$DAY3_LAB_MANIFEST_ROOT" -type d -name manifests | sort)
for manifest_dir in "${lab_manifest_dirs[@]}"; do
  echo "[day3] Applying lab manifests from $manifest_dir"
  bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$manifest_dir"
done

echo "[day3] Applying Day 3 platform manifests..."
bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$DAY3_PLATFORM_MANIFEST_DIR"
