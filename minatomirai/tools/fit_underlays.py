#!/usr/bin/env python3
"""
下敷き (公式フロアマップ) の配置パラメータ (rot/scale/dx/dy) を、建物の実フットプリントとの IoU 最大化で自動決定する。
  - 建物フットプリント: データパック内の三角形を XY 投影して塗りつぶしたマスク
  - 図面の建物領域: 非白ピクセルのクロージング + 穴埋め + 最大連結成分
  - 変換は main.js の layoutUnderlays と同じ定義 (主軸基準の rot, 図面範囲 box の長辺 = 主軸長 × scale, dx/dy は主軸/直交方向の平行移動)
結果は data/underlays.json の rot/scale/dx/dy に書き戻す。
"""
import gzip, json, math, os, struct, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
PACK = os.path.join(DATA, "minatomirai.pack")
MF = os.path.join(DATA, "underlays.json")
RES = 1.0   # m / cell

def load_pack():
    raw = gzip.decompress(open(PACK, "rb").read())
    n = struct.unpack("<I", raw[:4])[0]; header = json.loads(raw[4:4 + n].decode("utf-8")); base = 4 + n
    blobs = {}
    for name, b in header["blobs"].items():
        size = 2 if b["fmt"] == "h" else 4
        blobs[name] = np.frombuffer(raw[base + b["offset"]: base + b["offset"] + b["length"] * size], dtype=np.int16 if b["fmt"] == "h" else np.uint32)
    return header, blobs

def building_tris(header, blobs, bid):
    starts = header["buildings"]["starts"]; idx = blobs["bldg_idx"]; pos = blobs["bldg_pos"].reshape(-1, 3) / 10.0
    tri = idx[starts[bid] * 3: starts[bid + 1] * 3].reshape(-1, 3)
    return pos[tri][:, :, :2]   # (nt, 3, 2) in (x, y_north)

def convex_hull(pts):
    pts = sorted(set(map(tuple, pts)))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []; hi = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]

def hull_axis(hull):   # main.js hullAxis と同じ
    h = np.array(hull); cx, cy = h.mean(axis=0)
    dx = h[:, 0] - cx; dy = h[:, 1] - cy
    sxx = (dx * dx).sum(); sxy = (dx * dy).sum(); syy = (dy * dy).sum()
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy); ax, ay = math.cos(ang), math.sin(ang); nx, ny = -ay, ax
    pa = dx * ax + dy * ay; pn = dx * nx + dy * ny
    return dict(cx=cx, cy=cy, ax=ax, ay=ay, nx=nx, ny=ny, a0=pa.min(), a1=pa.max(), n0=pn.min(), n1=pn.max())

def map_mask(path):
    im = np.array(Image.open(path).convert("L"))
    m = im < 225
    m = ndimage.binary_closing(m, structure=np.ones((9, 9)), iterations=2)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1)); m = lab == (int(np.argmax(sizes)) + 1)
    return m

def world_grid(tris):
    xs = tris[:, :, 0]; ys = tris[:, :, 1]
    pad = 60
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    W = int((x1 - x0) / RES) + 1; H = int((y1 - y0) / RES) + 1
    im = Image.new("1", (W, H), 0); d = ImageDraw.Draw(im)
    for t in tris:
        d.polygon([((p[0] - x0) / RES, (y1 - p[1]) / RES) for p in t], fill=1)
    return np.array(im, dtype=bool), x0, y1, W, H

def render_map(mask, u, A, rot, scale, dx, dy, x0, y1, W, H):
    """main.js と同じ変換で図面マスクを世界グリッドへ写す。グリッド各セルの世界座標 → 画像座標 (逆写像)。"""
    box = u["box"]; w, h = u["w"], u["h"]
    bw = (box[2] - box[0]) * w; L = (A["a1"] - A["a0"]) * scale; k = L / max(1, bw)
    ang = math.atan2(A["ay"], A["ax"]) + rot * math.pi / 180
    rx, ry = math.cos(ang), math.sin(ang); ux, uy = -math.sin(ang), math.cos(ang)
    offR = ((box[0] + box[2]) / 2 - 0.5) * w * k; offD = ((box[1] + box[3]) / 2 - 0.5) * h * k
    tx = A["cx"] + A["ax"] * dx + A["nx"] * dy; ty = A["cy"] + A["ay"] * dx + A["ny"] * dy
    cx = tx - (offR * rx - offD * ux); cy = ty - (offR * ry - offD * uy)
    gx = x0 + np.arange(W) * RES; gy = y1 - np.arange(H) * RES
    GX, GY = np.meshgrid(gx, gy)
    vx = GX - cx; vy = GY - cy
    pr = vx * rx + vy * ry; pu = vx * ux + vy * uy            # 画像の右/上方向の距離 (m)
    px = (pr / k + w / 2).astype(int); py = (-pu / k + h / 2).astype(int)
    inside = (px >= 0) & (px < w) & (py >= 0) & (py < h)
    out = np.zeros((H, W), dtype=bool)
    out[inside] = mask[py[inside], px[inside]]
    return out

def iou(a, b):
    i = np.logical_and(a, b).sum(); un = np.logical_or(a, b).sum()
    return i / un if un else 0

def anchor_rot(u, A, metas):
    """main.js autoRotation と同じ: アンカー地物の方向で 0/180 を決める。"""
    a = u.get("anchor")
    if not a: return 0
    bm = next((m for m in metas if m.get("n") and a["name"] in m["n"]), None)
    if not bm: return 0
    tx = bm["c"][0] / 10 - A["cx"]; ty = bm["c"][1] / 10 - A["cy"]
    box = u.get("box", [0, 0, 1, 1]); iu = a["u"] - (box[0] + box[2]) / 2; iv = -(a["v"] - (box[1] + box[3]) / 2)
    d0 = (iu * A["ax"] + iv * A["nx"]) * tx + (iu * A["ay"] + iv * A["ny"]) * ty
    return 0 if d0 >= 0 else 180

def fit(u, tris, base_rot):
    mask = map_mask(os.path.join(DATA, "underlays", u["file"]))
    fp, x0, y1, W, H = world_grid(tris)
    A = hull_axis(convex_hull([tuple(p) for t in tris for p in t]))
    best = (-1, None)
    # 粗探索 (アンカーで決めた向きの ±16° 以内) → 細探索
    for rot in [base_rot + d for d in (-16, -12, -8, -4, 0, 4, 8, 12, 16)]:
        for s in np.arange(0.75, 1.26, 0.05):
            for dx in range(-40, 41, 10):
                for dy in range(-40, 41, 10):
                    v = iou(fp, render_map(mask, u, A, rot, s, dx, dy, x0, y1, W, H))
                    if v > best[0]: best = (v, (rot, s, dx, dy))
    rot, s, dx, dy = best[1]
    for _ in range(2):
        for r2 in np.arange(rot - 3, rot + 3.1, 1):
            for s2 in np.arange(s - 0.04, s + 0.041, 0.01):
                for dx2 in range(int(dx) - 8, int(dx) + 9, 2):
                    for dy2 in range(int(dy) - 8, int(dy) + 9, 2):
                        v = iou(fp, render_map(mask, u, A, r2, s2, dx2, dy2, x0, y1, W, H))
                        if v > best[0]: best = (v, (r2, s2, dx2, dy2))
        rot, s, dx, dy = best[1]
    return best

def main():
    header, blobs = load_pack(); metas = header["buildings"]["meta"]
    us = json.load(open(MF))
    only = sys.argv[1:]  # 建物名の部分一致で絞り込み (省略時は全部)
    for u in us:
        if only and not any(o in u["building"] for o in only): continue
        bid = next((i for i, m in enumerate(metas) if m.get("n") and (u["building"] in m["n"] or m["n"] in u["building"])), None)
        if bid is None: print("building not found:", u["building"]); continue
        tris = building_tris(header, blobs, bid)
        A = hull_axis(convex_hull([tuple(p) for t in tris for p in t]))
        if u.get("anchor"):
            base = anchor_rot(u, A, metas); results = [fit(u, tris, base)]
        else:
            results = [fit(u, tris, r) for r in (0, 180)]   # アンカー無し: 形状で 0/180 を判定
        (v, (rot, s, dx, dy)) = max(results, key=lambda r: r[0])
        # fit=True のとき rot は絶対値 (主軸基準)。main.js はアンカー判定を省略して rot をそのまま使う
        u["rot"] = round(float(rot), 1); u["scale"] = round(float(s), 3); u["dx"] = float(dx); u["dy"] = float(dy); u["iou"] = round(float(v), 3); u["fit"] = True
        print(f'{u["building"]} {u["floor"]}: IoU {v:.3f} rot {rot:.1f} scale {s:.3f} dx {dx} dy {dy}')
    json.dump(us, open(MF, "w"), ensure_ascii=False, indent=1)
    print("updated", MF)

if __name__ == "__main__":
    main()
