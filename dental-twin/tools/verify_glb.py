#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify_glb.py — dental_template.glb の構造検証 + オルソ投影プレビュー生成"""

import json, os, struct, sys, math
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)
PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "dental_template.glb")

# ---------- GLB パース ----------
with open(PATH, "rb") as f:
    data = f.read()
magic, ver, total = struct.unpack_from("<III", data, 0)
assert magic == 0x46546C67 and ver == 2, "not a GLB2"
off = 12
chunks = {}
while off < total:
    ln, ctype = struct.unpack_from("<II", data, off)
    chunks[ctype] = data[off + 8: off + 8 + ln]
    off += 8 + ln
g = json.loads(chunks[0x4E4F534A].decode("utf-8"))
buf = chunks[0x004E4942]

CT = {5126: (np.float32, 4), 5125: (np.uint32, 4), 5123: (np.uint16, 2)}
NC = {"VEC3": 3, "SCALAR": 1}

def read_acc(i):
    a = g["accessors"][i]
    bv = g["bufferViews"][a["bufferView"]]
    dt, sz = CT[a["componentType"]]
    n = NC[a["type"]]
    start = bv["byteOffset"] + a.get("byteOffset", 0)
    arr = np.frombuffer(buf, dtype=dt, count=a["count"] * n, offset=start)
    return arr.reshape(-1, n) if n > 1 else arr

# ---------- 構造検証 ----------
errors, warns = [], []
nodes = g["nodes"]
by_name = {n["name"]: n for n in nodes}

FDI_ALL = [q * 10 + i for q in (1, 2, 3, 4) for i in range(1, 9)]
missing = [f for f in FDI_ALL if f"tooth_{f}" not in by_name]
if missing:
    errors.append(f"歯ノード欠落: {missing}")

for nm in ("gingiva_upper", "gingiva_lower", "bone_upper", "bone_lower",
           "palate_upper", "floor_lower", "maxilla", "mandible"):
    if nm not in by_name:
        errors.append(f"ノード欠落: {nm}")

# 命名規約チェック
for n in nodes:
    nm = n["name"]
    ok = (nm.startswith("tooth_") and nm[6:].isdigit()) or \
         nm in ("gingiva_upper", "gingiva_lower", "bone_upper", "bone_lower",
                "palate_upper", "floor_lower", "maxilla", "mandible")
    if not ok:
        warns.append(f"命名規約外: {nm}")

# extras 検証
bad_axis, bad_h = [], []
for f in FDI_ALL:
    n = by_name.get(f"tooth_{f}")
    if not n:
        continue
    ex = n.get("extras", {})
    o = np.array(ex["axis_occlusal"]); b = np.array(ex["axis_buccal"]); m = np.array(ex["axis_mesial"])
    for lbl, v in (("o", o), ("b", b), ("m", m)):
        if abs(np.linalg.norm(v) - 1) > 1e-4:
            bad_axis.append(f"{f}:{lbl} 非単位長")
    for lbl, d in (("o·b", np.dot(o, b)), ("o·m", np.dot(o, m)), ("b·m", np.dot(b, m))):
        if abs(d) > 1e-4:
            bad_axis.append(f"{f}:{lbl}={d:.5f} 非直交")
    if not (ex["apex_h"] < ex["cej_h"] < ex["crown_top_h"]):
        bad_h.append(f"{f}: apex<cej<top を満たさない")
    if ex["fdi"] != f:
        errors.append(f"{f}: extras.fdi 不一致")
if bad_axis: errors.append("軸: " + ", ".join(bad_axis[:6]))
if bad_h:    errors.append("高さ: " + ", ".join(bad_h[:6]))

# 咬合方向の符号: 上顎は -Y 寄り、下顎は +Y 寄り
for f in FDI_ALL:
    ex = by_name[f"tooth_{f}"]["extras"]
    oy = ex["axis_occlusal"][1]
    if ex["jaw"] == "U" and oy > -0.7: errors.append(f"{f}: 上顎の咬合軸が下向きでない ({oy:.2f})")
    if ex["jaw"] == "L" and oy < 0.7:  errors.append(f"{f}: 下顎の咬合軸が上向きでない ({oy:.2f})")

# 頬側軸が弓の外向きか (中心軸からの外向き成分が正)
for f in FDI_ALL:
    ex = by_name[f"tooth_{f}"]["extras"]
    c = np.array(ex["centroid"]); b = np.array(ex["axis_buccal"])
    radial = np.array([c[0], 0.0, c[2] - 0.0])
    if np.linalg.norm(radial) > 1e-6:
        radial /= np.linalg.norm(radial)
        if np.dot(b, radial) < 0.2:
            warns.append(f"{f}: 頬側軸の外向き成分が小さい ({np.dot(b, radial):.2f})")

# ---------- ジオメトリ収集 ----------
prim_of_mesh = {i: m["primitives"][0] for i, m in enumerate(g["meshes"])}
groups = {"tooth": [], "gingiva": [], "bone": [], "sheet": []}
allV = []
tooth_bbox = {}
for n in nodes:
    if "mesh" not in n: continue
    p = prim_of_mesh[n["mesh"]]
    V = read_acc(p["attributes"]["POSITION"]).astype(np.float64)
    F = read_acc(p["indices"]).reshape(-1, 3)
    key = "tooth" if n["name"].startswith("tooth_") else \
          ("bone" if n["name"].startswith("bone") else
           ("sheet" if n["name"] in ("palate_upper", "floor_lower") else "gingiva"))
    groups[key].append((n["name"], V, F))
    allV.append(V)
    if key == "tooth":
        tooth_bbox[n["name"]] = (V.min(0), V.max(0))
allV = np.vstack(allV)

# 咬合平面クリアランス
up_top = max(by_name[f"tooth_{f}"]["extras"]["cej_y"] - by_name[f"tooth_{f}"]["extras"]["crown_h"]
             for f in FDI_ALL if by_name[f"tooth_{f}"]["extras"]["jaw"] == "U")
lo_top = min(by_name[f"tooth_{f}"]["extras"]["cej_y"] + by_name[f"tooth_{f}"]["extras"]["crown_h"]
             for f in FDI_ALL if by_name[f"tooth_{f}"]["extras"]["jaw"] == "L")

# 左右対称性 (11 と 21 の centroid.x が符号反転しているか)
sym_err = []
for a, b in ((11, 21), (16, 26), (31, 41), (36, 46), (18, 28), (38, 48)):
    ca = np.array(by_name[f"tooth_{a}"]["extras"]["centroid"])
    cb = np.array(by_name[f"tooth_{b}"]["extras"]["centroid"])
    if abs(ca[0] + cb[0]) > 0.05 or abs(ca[1] - cb[1]) > 0.05 or abs(ca[2] - cb[2]) > 0.05:
        sym_err.append(f"{a}/{b}")
if sym_err: errors.append("左右対称性: " + ", ".join(sym_err))

# 患者右 = -X の確認 (第1象限=上顎右 が -X 側)
if by_name["tooth_16"]["extras"]["centroid"][0] >= 0:
    errors.append("象限1(上顎右)が -X 側にない")
if by_name["tooth_26"]["extras"]["centroid"][0] <= 0:
    errors.append("象限2(上顎左)が +X 側にない")

# 隣接歯の重なりチェック (centroid 間距離 vs MD幅の平均)
overlap = []
for q, seq in [(k, v) for k, v in {1: [11,12,13,14,15,16,17,18], 2: [21,22,23,24,25,26,27,28],
                                   3: [31,32,33,34,35,36,37,38], 4: [41,42,43,44,45,46,47,48]}.items()]:
    for a, b in zip(seq, seq[1:]):
        ea, eb = by_name[f"tooth_{a}"]["extras"], by_name[f"tooth_{b}"]["extras"]
        d = np.linalg.norm(np.array(ea["centroid"]) - np.array(eb["centroid"]))
        exp = (ea["md_width"] + eb["md_width"]) / 2
        if d < exp * 0.60:
            overlap.append(f"{a}-{b}({d:.1f}<{exp*0.6:.1f})")
if overlap: warns.append("隣接歯が接近しすぎ: " + ", ".join(overlap))

# 面法線の向き検証: 歯は閉じたメッシュなので符号付き体積が正なら外向き
flipped = []
for name, V, F in groups["tooth"]:
    p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    vol = np.einsum("ij,ij->i", p0, np.cross(p1 - p0, p2 - p0)).sum() / 6.0
    if vol <= 0:
        flipped.append(f"{name}({vol:.0f})")
if flipped:
    errors.append("面法線が内向き: " + ", ".join(flipped[:8]) + f" (計{len(flipped)})")

# 咬合面の面法線が咬合方向を向いているか（部分的な巻き順ミスは全体体積では検出できない）
cap_bad = []
for f in FDI_ALL:
    n = by_name.get(f"tooth_{f}")
    if not n or "mesh" not in n: continue
    ex = n["extras"]
    pr = prim_of_mesh[n["mesh"]]
    V = read_acc(pr["attributes"]["POSITION"]).astype(np.float64)
    F = read_acc(pr["indices"]).reshape(-1, 3)
    o = np.array(ex["axis_occlusal"]); c0 = np.array(ex["centroid"])
    p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    nrm = np.cross(p1 - p0, p2 - p0)
    ln = np.linalg.norm(nrm, axis=1, keepdims=True); ln[ln == 0] = 1
    nrm = nrm / ln
    ctr = (p0 + p1 + p2) / 3.0
    hh = (ctr - c0) @ o
    sel = hh > ex["crown_top_h"] - 0.05          # 咬合面テーブル付近
    if sel.sum() < 10:
        cap_bad.append(f"{f}: 咬合面の面が少なすぎる({int(sel.sum())})"); continue
    sc = float((nrm[sel] @ o).mean())
    if sc < 0.35:
        cap_bad.append(f"{f}: 咬合面法線 n·o={sc:.2f}")
if cap_bad:
    errors.append("咬合面: " + ", ".join(cap_bad[:6]) + f" (計{len(cap_bad)})")

# 歯肉・歯槽骨も閉じたメッシュなので同じ判定
for key in ("gingiva", "bone"):
    for name, V, F in groups[key]:
        p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        vol = np.einsum("ij,ij->i", p0, np.cross(p1 - p0, p2 - p0)).sum() / 6.0
        if vol <= 0:
            errors.append(f"{name}: 面法線が内向き (vol={vol:.0f})")

# ---------- レンダリング ----------
def render(view, W=900, H=760):
    if view == "front":     # +Z から見る
        ax_u, ax_v, ax_d, flip_u = 0, 1, 2, False
    elif view == "occ_up":  # 上顎を下から
        ax_u, ax_v, ax_d, flip_u = 0, 2, 1, False
    elif view == "occ_low": # 下顎を上から
        ax_u, ax_v, ax_d, flip_u = 0, 2, 1, False
    else:                   # right lateral: -X から
        ax_u, ax_v, ax_d, flip_u = 2, 1, 0, False

    sel = []
    for key, col in (("bone", (150, 145, 135)), ("gingiva", (200, 120, 118)),
                     ("tooth", (232, 226, 212))):
        for name, V, F in groups[key]:
            if view == "occ_up" and not (name.endswith("_upper") or
                                         (name.startswith("tooth_") and name[6] in "12")):
                continue
            if view == "occ_low" and not (name.endswith("_lower") or
                                          (name.startswith("tooth_") and name[6] in "34")):
                continue
            sel.append((V, F, col))

    pts = np.vstack([V for V, _, _ in sel])
    u_all, v_all = pts[:, ax_u], pts[:, ax_v]
    umin, umax = u_all.min() - 4, u_all.max() + 4
    vmin, vmax = v_all.min() - 4, v_all.max() + 4
    sc = min(W / (umax - umin), H / (vmax - vmin))

    img = np.full((H, W, 3), 245, np.uint8)
    zbuf = np.full((H, W), np.inf)
    light = np.array([0.35, 0.6, 0.72]); light /= np.linalg.norm(light)

    for V, F, col in sel:
        px = ((V[:, ax_u] - umin) * sc).astype(np.float64)
        py = (H - (V[:, ax_v] - vmin) * sc).astype(np.float64)
        depth = V[:, ax_d]
        if view in ("front",):        depth = -depth      # +Z 手前
        elif view == "occ_up":        depth = depth       # 下から: -Y 手前
        elif view == "occ_low":       depth = -depth      # 上から: +Y 手前
        else:                         depth = depth

        p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        fn = np.cross(p1 - p0, p2 - p0)
        nl = np.linalg.norm(fn, axis=1, keepdims=True); nl[nl == 0] = 1
        fn = fn / nl
        lam = np.abs(fn @ light)
        shade = (0.30 + 0.70 * lam)

        fz = depth[F].mean(1)
        order = np.argsort(-fz)
        base = np.array(col, float)

        for t in order:
            i0, i1, i2 = F[t]
            xs = np.array([px[i0], px[i1], px[i2]])
            ys = np.array([py[i0], py[i1], py[i2]])
            x0, x1 = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
            y0, y1 = int(max(0, np.floor(ys.min()))), int(min(H - 1, np.ceil(ys.max())))
            if x1 < x0 or y1 < y0: continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-9: continue
            w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
            w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
            w2 = 1 - w0 - w1
            mask = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
            if not mask.any(): continue
            zz = w0 * fz[t] + w1 * fz[t] + w2 * fz[t]
            sub = zbuf[y0:y1 + 1, x0:x1 + 1]
            hit = mask & (zz < sub)
            if not hit.any(): continue
            sub[hit] = zz[hit] if np.ndim(zz) else zz
            c = np.clip(base * shade[t], 0, 255).astype(np.uint8)
            img[y0:y1 + 1, x0:x1 + 1][hit] = c
    return Image.fromarray(img)


print("=" * 62)
print(f"GLB: {PATH}  ({total/1024/1024:.2f} MB)")
print(f"nodes={len(nodes)} meshes={len(g['meshes'])} "
      f"tri={sum(len(F) for k in groups for _, _, F in groups[k]):,}")
print(f"全体bbox  X[{allV[:,0].min():7.1f},{allV[:,0].max():7.1f}] "
      f"Y[{allV[:,1].min():7.1f},{allV[:,1].max():7.1f}] "
      f"Z[{allV[:,2].min():7.1f},{allV[:,2].max():7.1f}]  (mm)")
print(f"咬合平面クリアランス: 上顎最下端 y={up_top:+.2f} / 下顎最上端 y={lo_top:+.2f} "
      f"→ gap={up_top-lo_top:.2f} mm")
print("-" * 62)
if errors:
    print("❌ ERRORS")
    for e in errors: print("   -", e)
else:
    print("✅ 構造検証 すべて合格 (歯番32 / 軸の正規直交性 / 高さ順序 / 左右対称 / 象限のX符号)")
if warns:
    print("⚠️  WARN")
    for w in warns[:10]: print("   -", w)
print("=" * 62)

for v, fn in (("front", "preview_front.jpg"), ("occ_up", "preview_occlusal_upper.jpg"),
              ("occ_low", "preview_occlusal_lower.jpg"), ("side", "preview_side.jpg")):
    im = render(v)
    im.thumbnail((640, 640))
    out = os.path.join(DOCS, fn)
    im.save(out, quality=78)
    print("rendered", os.path.relpath(out, ROOT))

sys.exit(1 if errors else 0)
