#!/usr/bin/env bash
# まとめて確認: 画面テスト（読込・書出し・立体変換・IFC 往復）、外部ツールでの検証、オフライン版の確認を順に走らせ、結果を 1 つの表にする。
# 使い方: ANGLEX_PY=<venv>/bin/python bash dev/check-all.sh [ログの出力先フォルダ]
#   ANGLEX_PY を省くと、外部ツール（IfcOpenShell・dstv）での検証は飛ばします。オフライン版は dist/ にあるものを確認します（先にビルドしてください）
cd "$(dirname "$0")/.." || exit 1
OUT="${1:-dev/external/check-logs}"; mkdir -p "$OUT"; fail=0
row() { printf '%-28s %-6s %s\n' "$1" "$2" "$3"; }
flow() { # 名前 フロー [ページ]
  local log="$OUT/$1.log"; PORT=$((8300 + RANDOM % 500)) PAGE="${3:-/index.html}" timeout 600 node dev/app-shot.mjs "$OUT/$1.png" "dev/flows/$2" > "$log" 2>&1
  local ok bad err; ok=$(grep -c '"ok":true' "$log"); bad=$(grep -c '"ok":false' "$log"); err=$(grep -c -E '\[pageerror\]|triggerUncaughtException|FAILED' "$log")
  if [ "$bad" -gt 0 ] || [ "$err" -gt 0 ] || ! grep -q '^saved ' "$log"; then fail=1; row "$1" NG "一致 $ok / 不一致 $bad / エラー $err → $log"; else row "$1" OK "一致 $ok 項目"; fi; }
echo "== 画面テスト"
flow formats ux20.js; flow solids ux21.js; flow ifc-roundtrip ux22.js; flow cuts-ifc2x3 ux23.js; flow cuts-family ux24.js; flow wire-frame ux25.js; flow context-pins ux26.js; flow wire-finish ux27.js; flow pins-insp-ui ux28.js; flow modules modcheck.js; flow v2 v2check.js /v2.html
echo "== 外部ツールでの検証（IfcOpenShell・dstv）"
if [ -n "$ANGLEX_PY" ]; then log="$OUT/external.log"; timeout 900 node dev/verify-external.mjs > "$log" 2>&1
  ve=$(grep -o '"validation_errors":[0-9]*' "$log" | grep -c -v ':0$'); mm=$(grep -o '"mismatches":[0-9]*' "$log" | grep -c -v ':0$'); gf=$(grep -o '"geometry_failed":[0-9]*' "$log" | grep -c -v ':0$')
  if [ "$ve" -gt 0 ] || [ "$mm" -gt 0 ] || [ "$gf" -gt 0 ] || ! grep -q NC_ALT "$log" || ! grep -q IFC2X3_COMPARE "$log" || grep -q CHECK_FAILED "$log"; then fail=1; row external NG "→ $log"; else row external OK "IFC4・IFC2x3 ともスキーマ違反 0・形状生成の失敗 0、NC 不一致 0"; fi
else row external "--" "ANGLEX_PY が未設定のため省略"; fi
echo "== オフライン版（外部通信を遮断）"
for f in dist/ANGLEX_v1_offline.html dist/ANGLEX_v2_offline.html; do n=$(basename "$f" .html); log="$OUT/$n.log"; if [ ! -f "$f" ]; then row "$n" "--" "ファイルなし"; continue; fi
  timeout 600 node dev/offline-formats.mjs "$f" > "$log" 2>&1; if grep -q FAILED "$log" || ! grep -q 'BLOCKED \[\]' "$log"; then fail=1; row "$n" NG "→ $log"; else row "$n" OK "全ステップ成功・外部通信 0 件"; fi; done
[ "$fail" -eq 0 ] && echo "すべて OK" || echo "NG があります"; exit "$fail"
