#!/usr/bin/env bash
# src/ を連結して単一 HTML（index.html）を生成する。
set -euo pipefail
cd "$(dirname "$0")"
out=index.html
{
  cat src/00_head.html
  for f in src/10_data.js src/20_core.js src/30_site.js src/40_building.js src/50_interior.js src/60_movers.js src/70_ui.js; do
    printf '\n// ===== %s =====\n' "$f"; cat "$f"
  done
  cat src/99_tail.html
} > "$out"
echo "built $out ($(wc -c < "$out") bytes, $(wc -l < "$out") lines)"
