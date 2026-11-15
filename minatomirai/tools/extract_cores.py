#!/usr/bin/env python3
"""
公式フロアマップから、エレベーターとエスカレーターの位置を自動検出して data/cores.json に書く。
  MARK IS           : エレベーター = 「北・中・南」の色つきマークを色で検出 / エスカレーター = 凡例の絵記号と照合 (大きさを変えて試す)
  ランドマークプラザ  : 黒丸の絵記号 (エレベーター・エスカレーター) を、図中の 1 個をテンプレートにして照合
  クイーンズスクエア  : 角丸四角の絵記号を同様に照合 (エスカレーターは向きが複数あるので反転・回転も試す)
位置は下敷き画像と同じ変換 (fit_underlays.py の結果) で世界座標へ。館内の人の動きと動線密度の昇降コアに使う (src/indoor.js)。
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image, ImageDraw
import extract_zones as Z
from fit_underlays import load_pack, building_tris, convex_hull, hull_axis, DATA

EV_HUES = {"北": (33, 52), "中": (6, 22), "南": (90, 112)}   # OpenCV の色相 (0..180)
K = Z.DPI / Z.REF
TOKYU_CROPS = [("tokyu", 1, 60, 170, 190, 292, "クイーンズスクエア横浜", "B3"), ("tokyu", 1, 300, 170, 460, 292, "クイーンズスクエア横浜", "B2"), ("tokyu", 1, 530, 178, 720, 282, "クイーンズスクエア横浜", "B1"),
               ("tokyu", 1, 105, 440, 462, 602, "クイーンズスクエア横浜", "1F"), ("tokyu", 2, 100, 58, 462, 215, "クイーンズスクエア横浜", "2F"), ("tokyu", 2, 85, 248, 462, 396, "クイーンズスクエア横浜", "3F"), ("tokyu", 2, 28, 468, 352, 632, "クイーンズスクエア横浜", "4F")]
gray = lambda a: cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
dark = lambda a: (gray(a) < 110).astype(np.float32)   # 黒い線だけを取り出す (灰色の網掛けを消す)

def crop(key, page, x0, y0, x1, y1):
    return Z.page_image(key, page).crop((int(x0 * K), int(y0 * K), int(x1 * K), int(y1 * K)))

def variants(t, flips=False, rots=False, scales=(1.0,)):
    out = [t]
    if flips: out += [cv2.flip(t, 1), cv2.flip(t, 0), cv2.flip(t, -1)]
    if rots: out += [np.rot90(v).copy() for v in list(out)]
    res = []
    for v in out:
        for s in scales: res.append(v if s == 1.0 else cv2.resize(v, None, fx=s, fy=s, interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR))
    return res

def match(img, tmpls, thr, mind=30):
    hits = []
    for t in tmpls:
        if t.shape[0] >= img.shape[0] or t.shape[1] >= img.shape[1]: continue
        r = cv2.matchTemplate(img, t, cv2.TM_CCOEFF_NORMED); ys, xs = np.where(r > thr)
        for y, x in zip(ys, xs): hits.append((float(r[y, x]), x + t.shape[1] / 2, y + t.shape[0] / 2))
    hits.sort(reverse=True); kept = []
    for s, x, y in hits:
        if all((x - a) ** 2 + (y - b) ** 2 > mind ** 2 for _, a, b in kept): kept.append((s, x, y))
    return kept

def main():
    header, blobs = load_pack(); metas = header["buildings"]["meta"]; us = json.load(open(os.path.join(DATA, "underlays.json")))
    out = []; sheets = {}
    def floor(key, pim, bld, fl, found):
        u = next((u for u in us if u["building"] == bld and u["floor"] == fl), None)
        if not u: return
        bid = next(i for i, m in enumerate(metas) if m.get("n") and bld in m["n"])
        A = hull_axis(convex_hull([tuple(p) for t in building_tris(header, blobs, bid) for p in t])); to_world = Z.world_mapper(u, pim, A)
        for kind, name, x, y in found:
            wx, wy = to_world(x, y); out.append({"building": bld, "floor": fl, "kind": kind, "name": name, "x": wx, "y": wy})
        print(f"{bld} {fl}: エレベーター {sum(1 for f in found if f[0] == 'ev')} エスカレーター {sum(1 for f in found if f[0] == 'esc')}")
        d = pim.copy(); dr = ImageDraw.Draw(d)
        for kind, name, x, y in found: dr.ellipse([x - 24, y - 24, x + 24, y + 24], outline=(255, 0, 255) if kind == "esc" else (0, 0, 255), width=5)
        sheets.setdefault(key, []).append(d)
    # ---- MARK IS ----
    P = np.array(Z.page_image("markis", 2)); leg = dark(P[3366:3400, 734:776]); tm = variants(leg, flips=False, scales=(0.88, 1.0, 1.12)) + variants(cv2.flip(leg, 1), scales=(0.88, 1.0, 1.12))
    for pdf, pg, x0, y0, x1, y1, bld, fl, maxn in Z.CROPS:
        pim = crop(pdf, pg, x0, y0, x1, y1); im = np.array(pim); hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV); found = []
        for name, (h0, h1) in EV_HUES.items():
            mask = ((hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) & (hsv[..., 1] > 150) & (hsv[..., 2] > 140)).astype(np.uint8)
            mask = cv2.dilate(mask, np.ones((11, 11), np.uint8)); n, lab, st, cen = cv2.connectedComponentsWithStats(mask, 8)
            cand = [(st[i][4], cen[i]) for i in range(1, n) if 45 <= st[i][2] <= 130 and 40 <= st[i][3] <= 110 and st[i][4] > 2200 and st[i][2] > st[i][3] * 1.05]   # 横長のマークだけ
            if cand: a, c = max(cand, key=lambda q: q[0]); found.append(("ev", name, float(c[0]), float(c[1])))
        found += [("esc", "", x, y) for s, x, y in match(dark(im), tm, 0.5)]
        floor("markis", pim, bld, fl, found)
    # ---- ランドマークプラザ: 3F の図から記号を 1 個ずつ切り出してテンプレートにする ----
    src = np.array(crop("lmp", 1, 25, 498, 300, 692)); t_esc = gray(src[204:244, 1279:1319]); t_ev = gray(src[122:161, 468:506])
    for pdf, pg, x0, y0, x1, y1, bld, fl in Z.LMP_CROPS:
        pim = crop(pdf, pg, x0, y0, x1, y1); g = gray(np.array(pim))
        floor("lmp", pim, bld, fl, [("esc", "", x, y) for s, x, y in match(g, [t_esc], 0.82)] + [("ev", "", x, y) for s, x, y in match(g, [t_ev], 0.82)])
    # ---- クイーンズスクエア: 1F の図から切り出す。エスカレーターは向き違いを反転・回転で拾う ----
    src = np.array(crop("tokyu", 1, 105, 440, 462, 602)); t_esc = gray(src[490:526, 867:903]); t_ev = gray(src[157:191, 1393:1428])
    for pdf, pg, x0, y0, x1, y1, bld, fl in TOKYU_CROPS:
        pim = crop(pdf, pg, x0, y0, x1, y1); g = gray(np.array(pim))
        floor("tokyu", pim, bld, fl, [("esc", "", x, y) for s, x, y in match(g, variants(t_esc, flips=True, rots=True), 0.7)] + [("ev", "", x, y) for s, x, y in match(g, [t_ev], 0.72)])
    json.dump(out, open(os.path.join(DATA, "cores.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    import collections
    print("cores.json", len(out), "points", dict(collections.Counter((o["building"], o["kind"]) for o in out)))
    if os.environ.get("CORE_DEBUG"):
        for key, dbg in sheets.items():
            W = max(d.width for d in dbg); H = sum(d.height for d in dbg); sheet = Image.new("RGB", (W, H), "white"); y = 0
            for d in dbg: sheet.paste(d, (0, y)); y += d.height
            sheet.resize((W // 2, H // 2)).save(os.environ["CORE_DEBUG"] + f"_{key}.png")

if __name__ == "__main__":
    main()
