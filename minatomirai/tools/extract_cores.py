#!/usr/bin/env python3
"""
MARK IS の公式フロアマップから、エレベーターとエスカレーターの位置を自動検出して data/cores.json に書く。
  エレベーター : 「北・中・南」の色つきマーク (緑・橙・青) を色で検出
  エスカレーター: 凡例の絵記号をテンプレートにして照合 (左右反転も試す)
位置は下敷き画像と同じ変換 (fit_underlays.py の結果) で世界座標へ。館内の人の動きと動線密度の昇降コアに使う (src/indoor.js)。
他の施設 (ランドマークプラザ等) は記号の様式が違うため未対応で、長軸上の仮定位置のまま。
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image, ImageDraw
import extract_zones as Z
from fit_underlays import load_pack, building_tris, convex_hull, hull_axis, DATA

EV_HUES = {"北": (33, 52), "中": (6, 22), "南": (90, 112)}   # OpenCV の色相 (0..180)

def main():
    header, blobs = load_pack(); metas = header["buildings"]["meta"]; us = json.load(open(os.path.join(DATA, "underlays.json")))
    page = Z.page_image("markis", 2); P = np.array(page); k = Z.DPI / Z.REF
    dark = lambda a: (cv2.cvtColor(a, cv2.COLOR_RGB2GRAY) < 110).astype(np.float32)   # 黒い線だけを取り出す (灰色の網掛けを消す)
    leg = dark(P[3366:3400, 734:776]); tmpl = [leg, cv2.flip(leg, 1)]   # 凡例のエスカレーター記号
    out = []; dbg = []
    for pdf, pg, x0, y0, x1, y1, bld, fl, maxn in Z.CROPS:
        u = next((u for u in us if u["building"] == bld and u["floor"] == fl), None)
        if not u: continue
        bid = next(i for i, m in enumerate(metas) if m.get("n") and bld in m["n"])
        A = hull_axis(convex_hull([tuple(p) for t in building_tris(header, blobs, bid) for p in t]))
        pim = page.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k))); im = np.array(pim); to_world = Z.world_mapper(u, pim, A)
        hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV); gray = dark(im); found = []
        for name, (h0, h1) in EV_HUES.items():
            mask = ((hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) & (hsv[..., 1] > 150) & (hsv[..., 2] > 140)).astype(np.uint8)
            mask = cv2.dilate(mask, np.ones((11, 11), np.uint8)); n, lab, st, cen = cv2.connectedComponentsWithStats(mask, 8)
            # マークは 縦横 45〜110 px 程度のかたまり。区画の塗り (大きい) や細線 (小さい) を除く
            cand = [(st[i][4], cen[i]) for i in range(1, n) if 45 <= st[i][2] <= 130 and 40 <= st[i][3] <= 110 and st[i][4] > 2200 and st[i][2] > st[i][3] * 1.05]   # 横長のマークだけ (正方形のロゴ等を除く)
            if cand: a, c = max(cand, key=lambda q: q[0]); found.append(("ev", name, float(c[0]), float(c[1])))
        hits = []
        for t in tmpl:
            r = cv2.matchTemplate(gray, t, cv2.TM_CCOEFF_NORMED); ys, xs = np.where(r > 0.55)
            for y, x in zip(ys, xs): hits.append((float(r[y, x]), x + t.shape[1] / 2, y + t.shape[0] / 2))
        hits.sort(reverse=True); kept = []
        for s, x, y in hits:
            if all((x - a) ** 2 + (y - b) ** 2 > 30 ** 2 for _, a, b in kept): kept.append((s, x, y))
        for s, x, y in kept: found.append(("esc", "", x, y))
        for kind, name, x, y in found:
            wx, wy = to_world(x, y); out.append({"building": bld, "floor": fl, "kind": kind, "name": name, "x": wx, "y": wy})
        print(f"{bld} {fl}: エレベーター {[f[1] for f in found if f[0] == 'ev']} エスカレーター {sum(1 for f in found if f[0] == 'esc')}")
        d = pim.copy(); dr = ImageDraw.Draw(d)
        for kind, name, x, y in found: dr.ellipse([x - 22, y - 22, x + 22, y + 22], outline=(255, 0, 255) if kind == "esc" else (0, 0, 255), width=5)
        dbg.append(d)
    json.dump(out, open(os.path.join(DATA, "cores.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("cores.json", len(out), "points")
    if os.environ.get("CORE_DEBUG"):
        W = max(d.width for d in dbg); H = sum(d.height for d in dbg); sheet = Image.new("RGB", (W, H), "white"); y = 0
        for d in dbg: sheet.paste(d, (0, y)); y += d.height
        sheet.resize((W // 2, H // 2)).save(os.environ["CORE_DEBUG"])

if __name__ == "__main__":
    main()
