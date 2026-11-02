#!/usr/bin/env python3
"""
MARK IS の公式フロアマップから区画 (番号つき色面) を自動抽出し、世界座標の多角形として data/zones.json に書く。
  1. PDF を 300dpi でラスタライズし、make_underlays.py と同じ範囲で階ごとに切り出す
  2. 彩色された面 (区画) を連結成分として検出
  3. 区画番号: 全体 OCR (RapidOCR, 4 倍拡大) + 未検出の面は検出済み数字から作った字形テンプレートで照合
  4. 面の輪郭 (凸包) を、下敷きと同じ変換 (fit_underlays.py の結果) で世界座標へ
"""
import json, math, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage
from fit_underlays import load_pack, building_tris, convex_hull, hull_axis, DATA

WORK = os.environ.get("MM_WORK", "/tmp/mm")
OUT = os.path.join(DATA, "zones.json")
DPI = 300; REF = 60
# make_underlays.py の CROPS と同じ (markis のみ)
CROPS = [
    ("markis", 2, 60, 45, 212, 150, "MARK IS minatomirai", "B4", 16), ("markis", 2, 60, 168, 212, 258, "MARK IS minatomirai", "B2", 5),
    ("markis", 2, 60, 272, 212, 396, "MARK IS minatomirai", "B1", 15), ("markis", 2, 68, 418, 470, 562, "MARK IS minatomirai", "1F", 42),
    ("markis", 2, 540, 45, 840, 142, "MARK IS minatomirai", "2F", 31), ("markis", 2, 540, 228, 840, 312, "MARK IS minatomirai", "3F", 32),
    ("markis", 2, 540, 410, 835, 502, "MARK IS minatomirai", "4F", 29), ("markis", 2, 540, 593, 760, 692, "MARK IS minatomirai", "5F", 2),
]

def page_image(key, page):
    prefix = os.path.join(WORK, "pdf", f"{key}_{DPI}")
    fn = f"{prefix}-{page}.png"
    if not os.path.exists(fn):
        subprocess.run(["pdftoppm", "-r", str(DPI), "-png", os.path.join(WORK, "pdf", key + ".pdf"), prefix], check=True, stderr=subprocess.DEVNULL)
    return Image.open(fn).convert("RGB")

def regions(im):
    a = np.array(im).astype(int); mx = a.max(-1); mn = a.min(-1)
    colored = ((mx - mn) > 40) & (mx > 120)
    colored = ndimage.binary_opening(colored, structure=np.ones((5, 5)))
    lab, n = ndimage.label(colored); sizes = ndimage.sum(colored, lab, range(1, n + 1))
    return lab, n, sizes, mx

def glyph_groups(lab, lid, mx):
    """区画 lid の内側にある暗い字形 (数字) を横方向にまとめて返す: [(x0,y0,x1,y1, [glyph slices])]"""
    region = ndimage.binary_fill_holes(lab == lid)
    inner = ndimage.binary_erosion(region, structure=np.ones((3, 3)), iterations=3)
    dark = (mx < 120) & inner
    gl, gn = ndimage.label(dark); groups = []
    comps = []
    for sl in ndimage.find_objects(gl):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if 12 <= h <= 40 and 4 <= w <= 32: comps.append(sl)
    comps.sort(key=lambda s: s[1].start)
    for sl in comps:
        if groups and abs(groups[-1][1] - sl[0].start) < 10 and sl[1].start - groups[-1][2] < 12:
            g = groups[-1]; groups[-1] = (g[0], min(g[1], sl[0].start), max(g[2], sl[1].stop), max(g[3], sl[0].stop), g[4] + [sl])
        else: groups.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, [sl]))
    return groups

def norm_glyph(mx, sl):
    g = (mx[sl] < 120).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((16, 24), Image.BILINEAR)
    v = np.array(im, dtype=np.float32) / 255; v -= v.mean(); n = np.linalg.norm(v)
    return v / n if n > 0 else v

def ocr_numbers(im, maxn):
    from rapidocr_onnxruntime import RapidOCR
    ocr = RapidOCR(); big = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
    res, _ = ocr(np.array(big)); out = []
    for box, text, score in (res or []):
        t = text.strip()
        if t.isdigit() and 1 <= int(t) <= maxn:
            out.append((int(t), sum(p[0] for p in box) / 16, sum(p[1] for p in box) / 16))
    return out

def region_at(lab, x, y, r=14):
    y0, y1 = max(0, int(y) - r), int(y) + r; x0, x1 = max(0, int(x) - r), int(x) + r
    win = lab[y0:y1, x0:x1]; vals, cnt = np.unique(win[win > 0], return_counts=True)
    return int(vals[np.argmax(cnt)]) if len(vals) else 0

def polygon_of(lab, lid):
    ys, xs = np.nonzero(lab == lid); pts = list(zip(xs.tolist(), ys.tolist()))
    if len(pts) > 4000:
        step = len(pts) // 4000; pts = pts[::step]
    return convex_hull(pts)

# ランドマークプラザ: 区画は中間グレーの面 (番号なし)。形状のみ抽出し、店名は画面側で OSM POI の位置から対応付ける
LMP_CROPS = [
    ("lmp", 1, 25, 48, 300, 262, "ランドマークプラザ", "5F"), ("lmp", 1, 25, 275, 300, 482, "ランドマークプラザ", "4F"),
    ("lmp", 1, 25, 498, 300, 692, "ランドマークプラザ", "3F"), ("lmp", 1, 25, 705, 300, 922, "ランドマークプラザ", "2F"),
    ("lmp", 2, 25, 65, 350, 302, "ランドマークプラザ", "1F"),
]
def gray_regions(im):
    a = np.array(im).astype(int); mx = a.max(-1); mn = a.min(-1)
    g = (mx - mn < 18) & (mx > 95) & (mx < 205)
    g = ndimage.binary_opening(g, structure=np.ones((4, 4)))
    lab, n = ndimage.label(g); sizes = ndimage.sum(g, lab, range(1, n + 1))
    return lab, n, sizes

def world_mapper(u, im, A):
    box = u["box"]; w, h = u["w"], u["h"]; sx = w / im.width; sy = h / im.height
    bw = (box[2] - box[0]) * w; L = (A["a1"] - A["a0"]) * u.get("scale", 1); kk = L / max(1, bw)
    ang = math.atan2(A["ay"], A["ax"]) + u.get("rot", 0) * math.pi / 180
    rx, ry = math.cos(ang), math.sin(ang); ux, uy = -math.sin(ang), math.cos(ang)
    offR = ((box[0] + box[2]) / 2 - 0.5) * w * kk; offD = ((box[1] + box[3]) / 2 - 0.5) * h * kk
    tx = A["cx"] + A["ax"] * u.get("dx", 0) + A["nx"] * u.get("dy", 0); ty = A["cy"] + A["ay"] * u.get("dx", 0) + A["ny"] * u.get("dy", 0)
    pcx = tx - (offR * rx - offD * ux); pcy = ty - (offR * ry - offD * uy)
    def to_world(px, py):
        ix = px * sx - w / 2; iy = -(py * sy - h / 2)
        return [round(pcx + (ix * rx + iy * ux) * kk, 2), round(pcy + (ix * ry + iy * uy) * kk, 2)]
    return to_world

def extract_lmp(header, blobs, us, k):
    metas = header["buildings"]["meta"]; zones = []
    for pdf, page, x0, y0, x1, y1, bld, fl in LMP_CROPS:
        u = next((u for u in us if u["building"] == bld and u["floor"] == fl), None)
        if not u: continue
        bid = next(i for i, m in enumerate(metas) if m.get("n") and bld in m["n"])
        tris = building_tris(header, blobs, bid); A = hull_axis(convex_hull([tuple(p) for t in tris for p in t]))
        im = page_image(pdf, page).crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
        lab, n, sizes = gray_regions(im); to_world = world_mapper(u, im, A); c = 0
        for lid in range(1, n + 1):
            if sizes[lid - 1] < 900: continue
            c += 1
            zones.append({"building": bld, "floor": fl, "zone": f"L{c}", "unlabeled": True, "poly": [to_world(*p) for p in polygon_of(lab, lid)]})
        print(f"LMP {fl}: {c} gray regions")
    return zones

def main():
    header, blobs = load_pack(); metas = header["buildings"]["meta"]
    us = json.load(open(os.path.join(DATA, "underlays.json")))
    k = DPI / REF
    floors = []
    # 1 パス目: 彩色面の検出と全体 OCR
    for pdf, page, x0, y0, x1, y1, bld, fl, maxn in CROPS:
        u = next((u for u in us if u["building"] == bld and u["floor"] == fl), None)
        if not u: continue
        im = page_image(pdf, page).crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k)))
        lab, n, sizes, mx = regions(im)
        found = {}
        for num, cx, cy in ocr_numbers(im, maxn):
            lid = region_at(lab, cx, cy)
            if lid and sizes[lid - 1] > 800 and lid not in found and num not in found.values(): found[lid] = num
        floors.append(dict(u=u, bld=bld, fl=fl, maxn=maxn, im=im, lab=lab, n=n, sizes=sizes, mx=mx, found=found))
    # 字形テンプレート: 全階の検出済み番号から集める (単桁は 2 桁番号の各桁から学習)
    templates = {}
    for F in floors:
        for lid, num in F["found"].items():
            for g in glyph_groups(F["lab"], lid, F["mx"]):
                digits = str(num)
                if len(g[4]) == len(digits):
                    for sl, d in zip(g[4], digits): templates.setdefault(d, []).append(norm_glyph(F["mx"], sl))
    templates = {d: np.mean(v, axis=0) for d, v in templates.items()}
    print("digit templates:", {d: 1 for d in sorted(templates)})
    # 2 パス目: 未検出の面を字形照合で埋める → 残り 1 つなら消去法
    zones = []
    for F in floors:
        lab, n, sizes, mx, found, maxn = F["lab"], F["n"], F["sizes"], F["mx"], F["found"], F["maxn"]
        used = set(found.values()); cand = []
        for lid in range(1, n + 1):
            if lid in found or sizes[lid - 1] < 800: continue
            for g in glyph_groups(lab, lid, mx):
                if not (1 <= len(g[4]) <= 2): continue
                s = ""; conf = 1
                for sl in g[4]:
                    v = norm_glyph(mx, sl); best = max(templates.items(), key=lambda kv: float((kv[1] * v).sum()))
                    s += best[0]; conf = min(conf, float((best[1] * v).sum()))
                if s.isdigit() and 1 <= int(s) <= maxn: cand.append((conf, lid, int(s)))
        for conf, lid, num in sorted(cand, reverse=True):
            if conf > 0.4 and lid not in found and num not in used: found[lid] = num; used.add(num)
        big = [lid for lid in range(1, n + 1) if sizes[lid - 1] > 800 and lid not in found]
        missing = [i for i in range(1, maxn + 1) if i not in used]
        if len(big) == 1 and len(missing) == 1: found[big[0]] = missing[0]
        # 世界座標へ (下敷きと同じ変換)
        u = F["u"]; im = F["im"]
        bid = next(i for i, m in enumerate(metas) if m.get("n") and F["bld"] in m["n"])
        tris = building_tris(header, blobs, bid); A = hull_axis(convex_hull([tuple(p) for t in tris for p in t]))
        box = u["box"]; w, h = u["w"], u["h"]; sx = w / im.width; sy = h / im.height
        bw = (box[2] - box[0]) * w; L = (A["a1"] - A["a0"]) * u.get("scale", 1); kk = L / max(1, bw)
        ang = math.atan2(A["ay"], A["ax"]) + u.get("rot", 0) * math.pi / 180
        rx, ry = math.cos(ang), math.sin(ang); ux, uy = -math.sin(ang), math.cos(ang)
        offR = ((box[0] + box[2]) / 2 - 0.5) * w * kk; offD = ((box[1] + box[3]) / 2 - 0.5) * h * kk
        tx = A["cx"] + A["ax"] * u.get("dx", 0) + A["nx"] * u.get("dy", 0); ty = A["cy"] + A["ay"] * u.get("dx", 0) + A["ny"] * u.get("dy", 0)
        pcx = tx - (offR * rx - offD * ux); pcy = ty - (offR * ry - offD * uy)
        def to_world(px, py):
            ix = px * sx - w / 2; iy = -(py * sy - h / 2)
            return [round(pcx + (ix * rx + iy * ux) * kk, 2), round(pcy + (ix * ry + iy * uy) * kk, 2)]
        for lid, num in found.items():
            zones.append({"building": F["bld"], "floor": F["fl"], "zone": str(num), "poly": [to_world(*p) for p in polygon_of(lab, lid)]})
        print(f'{F["fl"]}: regions {int((sizes > 800).sum())}, numbered {len(found)} / {maxn}')
    zones += extract_lmp(header, blobs, us, k)
    json.dump(zones, open(OUT, "w"), ensure_ascii=False)
    print("wrote", OUT, len(zones))

if __name__ == "__main__":
    main()
