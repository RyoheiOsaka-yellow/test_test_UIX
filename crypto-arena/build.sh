#!/bin/bash
# 単一HTML (index.html) を src/ の分割ソースと data/scene_data_la.json から組み立てる。
set -e
cd "$(dirname "$0")"
OUT=index.html
{
  cat src/00_head.html
  cat src/01_ui.html
  # three.js r128 (MIT) をインラインして単一ファイルで完全オフライン動作させる
  echo '<script>'; cat vendor/three.min.js; echo '</script>'
  echo '<script>'
  printf 'const SCENE_DATA = '
  cat data/scene_data_la.json
  echo ';'
  for f in src/[1-9]*.js; do echo "/* ---- $f ---- */"; cat "$f"; done
  echo '</script>'
  echo '</body></html>'
} > $OUT
echo "built $OUT  $(du -h $OUT | cut -f1)"
