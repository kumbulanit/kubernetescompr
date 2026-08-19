#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NAMESPACE_MANIFEST="$REPO_ROOT/platform/manifests/00-namespaces/01-namespaces.yaml"
DAY1_LAB_MANIFEST_ROOT="$REPO_ROOT/days/day1/labs"
DAY1_PLATFORM_MANIFEST_DIR="$REPO_ROOT/platform/manifests/day1"

if [[ ! -f "$NAMESPACE_MANIFEST" ]]; then
  echo "Namespace manifest not found: $NAMESPACE_MANIFEST" >&2
  exit 1
fi

if [[ ! -d "$DAY1_LAB_MANIFEST_ROOT" ]]; then
  echo "Day 1 lab manifest root not found: $DAY1_LAB_MANIFEST_ROOT" >&2
  exit 1
fi

if [[ ! -d "$DAY1_PLATFORM_MANIFEST_DIR" ]]; then
  echo "Day 1 platform manifest directory not found: $DAY1_PLATFORM_MANIFEST_DIR" >&2
  exit 1
fi

echo "[day1] Applying shared namespaces..."
kubectl apply -f "$NAMESPACE_MANIFEST"

mapfile -t lab_manifest_dirs < <(find "$DAY1_LAB_MANIFEST_ROOT" -type d -name manifests | sort)
for manifest_dir in "${lab_manifest_dirs[@]}"; do
  echo "[day1] Applying lab manifests from $manifest_dir"
  bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$manifest_dir"
done

echo "[day1] Applying Day 1 platform manifests..."
bash "$REPO_ROOT/platform/scripts/apply-manifests.sh" "$DAY1_PLATFORM_MANIFEST_DIR"
