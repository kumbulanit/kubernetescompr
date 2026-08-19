#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <manifest-root>" >&2
  exit 1
fi

MANIFEST_ROOT="$1"

if [[ ! -d "$MANIFEST_ROOT" ]]; then
  echo "manifest root not found: $MANIFEST_ROOT" >&2
  exit 1
fi

mapfile -t manifest_files < <(find "$MANIFEST_ROOT" -type f \( -name '*.yaml' -o -name '*.yml' \) | sort)

if [[ ${#manifest_files[@]} -eq 0 ]]; then
  echo "[apply] no YAML manifests found under $MANIFEST_ROOT"
  exit 0
fi

for manifest_file in "${manifest_files[@]}"; do
  echo "[apply] applying $(basename "$manifest_file")"
  kubectl apply -f "$manifest_file"
done
