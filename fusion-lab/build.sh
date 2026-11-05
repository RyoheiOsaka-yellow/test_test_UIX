#!/usr/bin/env bash
# 3D ビューア（three.js 同梱）をバンドルし、パーツを結合して単一の index.html を作る
set -euo pipefail
cd "$(dirname "$0")"
npx esbuild src/viewer3d.js --bundle --format=iife --minify --legal-comments=none --target=es2020 --outfile=build/viewer3d.min.js --log-level=warning
if grep -q '</script' build/viewer3d.min.js; then echo "bundle contains </script>" >&2; exit 1; fi
{
  cat part1_head.html part2_body.html part3_data.js part4_engine.js
  printf '<script>\n/* three.js r180 (MIT License, (c) 2010-2025 three.js authors) + ANGLEX FUSION viewer */\n'
  cat build/viewer3d.min.js
  printf '\n</script>\n'
  cat part5_ui.js
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
