#!/usr/bin/env python3
"""新宿駅構内図3D_base.html に B1 物理人流レイヤを統合する。

パッチ(バンドル内 2 箇所・アンカー完全一致、置換数を検証):
  1. window.__app に floors(Zi)/floorH(Qr)/origin(gn)/flowPoints(Vl)/expand(Ys) を追加公開
  2. アニメループ vf に window.__b1tick(dt) 呼び出しを挿入
その後 </body> 直前に b1_pack.json と b1_layer.js を注入する。
"""
import pathlib, sys

root = pathlib.Path(__file__).parent
base = root / "新宿駅構内図3D_base.html"
out  = root / "新宿駅構内図3D.html"

html = base.read_text()
pack = (root / "floors_pack.json").read_text()
layer = (root / "floors_layer.js").read_text()

patches = [
    # 1) __app 拡張
    ("window.__app={scene:Re,",
     "window.__app={floors:Zi,floorH:Qr,origin:gn,flowPoints:Vl,get expand(){return Ys},scene:Re,"),
    # 2) 毎フレームフック(dt 秒)
    ("ev(i),lv(i),vv(performance.now()),Yi.render()",
     "ev(i),lv(i),window.__b1tick&&window.__b1tick(i),vv(performance.now()),Yi.render()"),
]
for old, new in patches:
    n = html.count(old)
    assert n == 1, f"アンカー一致数 {n} != 1: {old[:60]}"
    html = html.replace(old, new)

inject = (f'<script id="floorspack" type="application/json">{pack}</script>\n'
          f'<script>\n{layer}\n</script>\n</body>')
assert html.count("</body>") == 1
html = html.replace("</body>", inject)

out.write_text(html)

# パッチ後の実物確認(sed 的置換の無言成功を防ぐ — HANDOVER §6)
for needle in ["floors:Zi", "__b1tick", 'id="floorspack"', "'crowd-'+F.pk.name", "地下 物理人流"]:
    assert needle in out.read_text(), f"検証失敗: {needle}"
print(f"wrote {out} ({out.stat().st_size/1e6:.1f} MB)")
