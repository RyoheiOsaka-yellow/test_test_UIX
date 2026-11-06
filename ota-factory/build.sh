#!/usr/bin/env bash
# src/ を連結して単一 HTML（index.html）を生成する。
set -euo pipefail
cd "$(dirname "$0")"
out=index.html
{
  cat src/00_head.html
  for f in src/05_logo.js src/10_data.js src/20_core.js src/30_site.js src/40_building.js src/50_interior.js src/55_overhead.js src/56_lanes.js src/57_mep.js src/58_detail.js src/59_floors.js src/60_movers.js src/65_assets.js src/70_ui.js; do
    printf '\n// ===== %s =====\n' "$f"; cat "$f"
  done
  cat src/99_tail.html
} > "$out"
echo "built $out ($(wc -c < "$out") bytes, $(wc -l < "$out") lines)"
# 画像を base64 で埋め込んだ単体配布版も生成する
python3 -I - <<'PY'
import base64, re, os
s = open("index.html", encoding="utf-8").read()
def rep(m):
    p = m.group(1)
    if not os.path.exists(p): return m.group(0)
    mime = "image/png" if p.endswith(".png") else "image/jpeg"
    return '"data:%s;base64,' % mime + base64.b64encode(open(p,"rb").read()).decode() + '"'
s = re.sub(r'"(img/[^"]+\.(?:jpg|png))"', rep, s)
out = "xantalos-ota-factory-standalone.html"
if os.path.exists("yellow-ota-factory-standalone.html"): os.remove("yellow-ota-factory-standalone.html")
open(out, "w", encoding="utf-8").write(s)
print("built %s (%d bytes)" % (out, os.path.getsize(out)))
PY
