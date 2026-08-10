#!/usr/bin/env bash
# Render every Mermaid source to SVG and PNG.
#   ./render.sh [--only d1] [--theme dark]
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONLY=""; THEME="dark"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY="$2"; shift 2 ;;
    --theme) THEME="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done
command -v mmdc >/dev/null 2>&1 || {
  echo "mermaid-cli not found. Install: npm install -g @mermaid-js/mermaid-cli"; exit 1; }
mkdir -p "$D/svg" "$D/png"
n=0
for f in "$D"/mermaid/*.mmd; do
  b="$(basename "$f" .mmd)"
  [[ -n "$ONLY" && "$b" != ${ONLY}* ]] && continue
  mmdc -i "$f" -o "$D/svg/$b.svg" -t "$THEME" -b transparent --quiet
  mmdc -i "$f" -o "$D/png/$b.png" -t "$THEME" -b transparent -w 2400 --quiet
  echo "  rendered $b"; n=$((n+1))
done
echo "$n diagram(s) rendered to svg/ and png/"
