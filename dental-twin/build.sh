#!/usr/bin/env bash
# build.sh — 生成 → 検証 → ビルド → ビューア検証 を一括で回す
# 使い方:  ./build.sh          全工程
#          ./build.sh model    モデル生成 + 構造検証まで
#          ./build.sh viewer   ビルド + ビューア検証のみ
set -euo pipefail
cd "$(dirname "$0")"

step="${1:-all}"

if [ "$step" = "all" ] || [ "$step" = "model" ]; then
  echo "── 1/6  モデル生成 ──────────────────────────────"
  python3 tools/dental_arch_gen.py
  echo "── 2/6  GLB 構造検証 ───────────────────────────"
  python3 tools/verify_glb.py
fi

if [ "$step" = "all" ] || [ "$step" = "pipeline" ]; then
  echo "── 3/6  IOS 取り込みの正規化検証 (Phase 2) ─────"
  python3 tools/verify_ios.py
  echo "── 4/6  DB ブリッジの往復検証 (Phase 2) ────────"
  python3 tools/db_bridge.py roundtrip data/findings_sample.json
  python3 tools/db_bridge.py roundtrip data/findings_prev_sample.json
fi

if [ "$step" = "all" ] || [ "$step" = "viewer" ]; then
  echo "── 5/6  JS 構文チェック + 単一HTMLビルド ────────"
  node --check src/viewer_app.js && echo "  node --check OK"
  python3 tools/build_viewer.py
  echo "── 6/6  ビューア検証 (Playwright/SwiftShader) ──"
  python3 tools/verify_viewer.py
fi

echo "── 完了 ────────────────────────────────────────"
