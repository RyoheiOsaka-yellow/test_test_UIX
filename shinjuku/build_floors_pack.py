#!/usr/bin/env python3
"""複数フロア用データパック生成 (HANDOVER §3 の B1 前処理を全フロアへ一般化)。

新宿駅構内図3D_base.html の __EMBEDDED_DATA から各フロアの Space/Fixture を読み、
  ラスタライズ(0.5m, スキャンライン偶奇) → ラン単位連結成分 → 最大成分採用
  → ホーム(B001) PCA 軸 → RLE
さらに隣接フロア間で階段/EV/ESC(B021/B022/B023)を重心距離でマッチングし、
フロア間ポータルを作る。出力: floors_pack.json

歩行可能 = Space(restricted != '1') − Fixture。B1 は旧 b1_pack.json と
セル数を突き合わせて回帰確認する(≈231,733 セル)。
"""
import json, math, pathlib, re, sys
import numpy as np

ROOT = pathlib.Path(__file__).parent
CELL = 0.5
VERT_CATS = {"B021", "B022", "B023"}  # 階段 / EV / ESC
FLOORS = [("B1", -1), ("B2", -2)]      # (データセット名, ビューア level)。B3 はホーム無・接続無のため除外
PAIRS = [(0, 1)]                       # 隣接フロア index: B1-B2
PORTAL_MATCH_R = 20.0                  # ポータル対応付けの最大重心距離 (m)。階段は水平に走るため広め


def load_embedded():
    html = (ROOT / "新宿駅構内図3D_base.html").read_text()
    start = html.index("window.__EMBEDDED_DATA=") + len("window.__EMBEDDED_DATA=")
    end = html.index("</script>", start)
    return json.loads(html[start:end].rstrip().rstrip(";"))


def rings_of(geom):
    if geom is None:
        return []
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return list(geom["coordinates"])
    return []


def rasterize(polys, x0, y0, W, H):
    """偶奇規則スキャンライン。polys = [ [ring, hole...], ... ] → bool (H,W)"""
    grid = np.zeros((H, W), dtype=bool)
    ys = (np.arange(H) + 0.5) * CELL + y0  # 各行の中心 y
    for rings in polys:
        edges = []
        for ring in rings:
            pts = ring[:-1] if ring[0] == ring[-1] else ring
            n = len(pts)
            for i in range(n):
                xa, ya = pts[i]
                xb, yb = pts[(i + 1) % n]
                if ya != yb:
                    edges.append((xa, ya, xb, yb))
        if not edges:
            continue
        exs = np.array([[e[0], e[2]] for e in edges])
        eys = np.array([[e[1], e[3]] for e in edges])
        ymin = eys.min(axis=1); ymax = eys.max(axis=1)
        r0 = max(0, int(math.floor((eys.min() - y0) / CELL - 0.5)))
        r1 = min(H - 1, int(math.ceil((eys.max() - y0) / CELL)))
        for r in range(r0, r1 + 1):
            yc = ys[r]
            act = (ymin <= yc) & (ymax > yc)   # 半開区間で頂点二重カウント回避
            if not act.any():
                continue
            xa, xb = exs[act, 0], exs[act, 1]
            ya, yb = eys[act, 0], eys[act, 1]
            xs = xa + (yc - ya) * (xb - xa) / (yb - ya)
            xs.sort()
            for k in range(0, len(xs) - 1, 2):
                c0 = int(math.ceil((xs[k] - x0) / CELL - 0.5))
                c1 = int(math.floor((xs[k + 1] - x0) / CELL - 0.5))
                if c1 >= c0:
                    grid[r, max(0, c0):min(W, c1 + 1)] ^= True
    return grid


def largest_cc(walk):
    """ラン単位ユニオンファインドで最大連結成分(4近傍)のみ残す"""
    H, W = walk.shape
    parent = []

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    runs_prev = []  # [(c0, c1, label)]
    row_runs = []
    for r in range(H):
        row = walk[r]
        idx = np.flatnonzero(np.diff(np.concatenate(([0], row.view(np.int8), [0]))))
        runs = []
        for k in range(0, len(idx), 2):
            c0, c1 = idx[k], idx[k + 1] - 1
            lab = len(parent)
            parent.append(lab)
            for p0, p1, pl in runs_prev:
                if p0 <= c1 and c0 <= p1:
                    union(pl, lab)
            runs.append((c0, c1, lab))
        row_runs.append(runs)
        runs_prev = runs
    sizes = {}
    for runs in row_runs:
        for c0, c1, lab in runs:
            root = find(lab)
            sizes[root] = sizes.get(root, 0) + (c1 - c0 + 1)
    if not sizes:
        return walk, 0
    best = max(sizes, key=sizes.get)
    out = np.zeros_like(walk)
    for r, runs in enumerate(row_runs):
        for c0, c1, lab in runs:
            if find(lab) == best:
                out[r, c0:c1 + 1] = True
    return out, sizes[best]


def rle_encode(walk):
    flat = walk.reshape(-1).view(np.int8)
    idx = np.flatnonzero(np.diff(flat))
    runs, prev = [], -1
    for i in idx:
        runs.append(int(i - prev)); prev = i
    runs.append(int(flat.size - 1 - prev))
    # 先頭は「0 の個数」から始まる規約 (先頭が 1 なら 0 を前置)
    if flat[0] == 1:
        runs = [0] + runs
    return runs


def _axis_of(px, py):
    mx, my = px.mean(), py.mean()
    cov = np.cov(np.stack([px - mx, py - my]))
    evals, evecs = np.linalg.eigh(cov)
    v = evecs[:, -1]
    t = (px - mx) * v[0] + (py - my) * v[1]
    t0, t1 = np.percentile(t, 1), np.percentile(t, 99)
    return mx, my, v, float(t0), float(t1)


def platform_axes(b001_cells, x0, y0, min_len=40.0, max_axes=4):
    """B001 セル群を連結成分に分け、共線の成分をマージして PCA 長軸を返す。
    (階段・通路がホーム面を分断するため、旧 B1 処理と同様 npoly>1 の軸を再構成する)"""
    comp, n = largest_cc_all(b001_cells)
    groups = []
    for ci in range(1, n + 1):
        ys, xs = np.nonzero(comp == ci)
        if len(xs) < 200:  # 50 m² 未満は無視
            continue
        groups.append({"px": (xs + 0.5) * CELL + x0, "py": (ys + 0.5) * CELL + y0, "npoly": 1})
    # 共線マージ: 角度 <12°・横ずれ <7m・軸方向ギャップ <25m
    merged = True
    while merged:
        merged = False
        for i in range(len(groups)):
            if merged:
                break
            for j in range(i + 1, len(groups)):
                a, b = groups[i], groups[j]
                mxa, mya, va, ta0, ta1 = _axis_of(a["px"], a["py"])
                mxb, myb, vb, tb0, tb1 = _axis_of(b["px"], b["py"])
                if abs(va[0] * vb[0] + va[1] * vb[1]) < math.cos(math.radians(12)):
                    continue
                # b の重心を a の軸へ射影
                dx, dy = mxb - mxa, myb - mya
                lat = abs(-va[1] * dx + va[0] * dy)
                if lat > 7.0:
                    continue
                tb = dx * va[0] + dy * va[1]
                tbb0 = tb + min(tb0, tb1) * (1 if va[0]*vb[0]+va[1]*vb[1] > 0 else -1)
                tbb1 = tb + max(tb0, tb1)
                gap = max(ta0, min(tbb0, tbb1)) - min(ta1, max(tbb0, tbb1))
                if max(tbb0, tbb1) < ta0:
                    gap = ta0 - max(tbb0, tbb1)
                elif min(tbb0, tbb1) > ta1:
                    gap = min(tbb0, tbb1) - ta1
                else:
                    gap = 0.0
                if gap > 25.0:
                    continue
                a["px"] = np.concatenate([a["px"], b["px"]])
                a["py"] = np.concatenate([a["py"], b["py"]])
                a["npoly"] += b["npoly"]
                groups.pop(j)
                merged = True
                break
    axes = []
    for g in groups:
        mx, my, v, t0, t1 = _axis_of(g["px"], g["py"])
        length = t1 - t0
        if length < min_len:
            continue
        axes.append({
            "x0": round(float(mx + v[0] * t0), 2), "y0": round(float(my + v[1] * t0), 2),
            "x1": round(float(mx + v[0] * t1), 2), "y1": round(float(my + v[1] * t1), 2),
            "len": round(length, 1), "npoly": int(g["npoly"]), "cells": int(len(g["px"])),
        })
    axes.sort(key=lambda a: -a["len"])
    return axes[:max_axes]


def largest_cc_all(mask):
    """全連結成分ラベリング(小規模グリッド用・BFS)"""
    from collections import deque
    H, W = mask.shape
    comp = np.zeros((H, W), dtype=np.int32)
    n = 0
    for r0 in range(H):
        for c0 in np.flatnonzero(mask[r0] & (comp[r0] == 0)):
            n += 1
            dq = deque([(r0, int(c0))])
            comp[r0, c0] = n
            while dq:
                r, c = dq.popleft()
                for rr, cc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                    if 0 <= rr < H and 0 <= cc < W and mask[rr, cc] and comp[rr, cc] == 0:
                        comp[rr, cc] = n
                        dq.append((rr, cc))
    return comp, n


def centroid(rings):
    ring = rings[0]
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def snap_walk(walk, gx, gy, rr=8):
    """最近傍の歩行可能セルへスナップ。見つからなければ None"""
    H, W = walk.shape
    best = None; bd = 1e18
    for dy in range(-rr, rr + 1):
        for dx in range(-rr, rr + 1):
            x, y = gx + dx, gy + dy
            if 0 <= x < W and 0 <= y < H and walk[y, x]:
                d = dx * dx + dy * dy
                if d < bd:
                    bd = d; best = (x, y)
    return best


def main():
    data = load_embedded()
    floors_out = []
    verticals_by_floor = []   # ポータルマッチング用 [(cx, cy, cat), ...]

    for name, level in FLOORS:
        sp = data[f"./data/ShinjukuTerminal/ShinjukuTerminal_{name}_Space.geojson"]["features"]
        fx_key = f"./data/ShinjukuTerminal/ShinjukuTerminal_{name}_Fixture.geojson"
        fx = data.get(fx_key, {"features": []})["features"]

        walk_polys, fix_polys, b001_polys, verts = [], [], [], []
        allx, ally = [], []
        for f in sp:
            if f["properties"].get("restricted") == "1":
                continue
            rs = rings_of(f["geometry"])
            if not rs:
                continue
            walk_polys += rs
            cat = f["properties"].get("category")
            if cat == "B001":
                b001_polys += rs
            if cat in VERT_CATS:
                cx, cy = centroid(rs[0])
                verts.append((cx, cy, cat))
            for ring in rs[0]:
                for p in ring:
                    allx.append(p[0]); ally.append(p[1])
        for f in fx:
            fix_polys += rings_of(f["geometry"])

        x0 = math.floor(min(allx) / CELL) * CELL - 2
        y0 = math.floor(min(ally) / CELL) * CELL - 2
        W = int(math.ceil((max(allx) - x0) / CELL)) + 4
        H = int(math.ceil((max(ally) - y0) / CELL)) + 4

        walk = rasterize(walk_polys, x0, y0, W, H)
        raw = int(walk.sum())
        if fix_polys:
            walk &= ~rasterize(fix_polys, x0, y0, W, H)
        walk, ncc = largest_cc(walk)
        b001 = rasterize(b001_polys, x0, y0, W, H) & walk if b001_polys else np.zeros((H, W), bool)
        plats = platform_axes(b001, 0, 0)  # ローカル座標 (原点 x0,y0 基準)
        # 縦動線をローカル座標へ、歩行セルへスナップ
        vlocal = []
        for cx, cy, cat in verts:
            lx, ly = cx - x0, cy - y0
            g = snap_walk(walk, int(lx / CELL), int(ly / CELL))
            if g is None:
                continue
            vlocal.append({"x": round(lx, 2), "y": round(ly, 2),
                           "gx": int(g[0]), "gy": int(g[1]), "kind": cat,
                           "wx": cx, "wy": cy})
        print(f"{name}: grid {W}x{H} raw {raw} -> walk(maxCC) {int(walk.sum())} cells "
              f"({int(walk.sum())*CELL*CELL:.0f} m2), plats {len(plats)}, verts {len(vlocal)}")
        floors_out.append({
            "name": name, "level": level, "cell": CELL,
            "W": W, "H": H, "origin": [round(x0, 2), round(y0, 2)],
            "rle": rle_encode(walk), "platforms": plats, "verts": vlocal,
        })
        verticals_by_floor.append(vlocal)

    # --- 隣接フロア間ポータルマッチング(貪欲最近傍) ---
    for a, b in PAIRS:
        va, vb = verticals_by_floor[a], verticals_by_floor[b]
        used = set()
        pairs = 0
        for i, v in enumerate(va):
            best, bd = None, PORTAL_MATCH_R ** 2
            for j, u in enumerate(vb):
                if j in used:
                    continue
                d = (v["wx"] - u["wx"]) ** 2 + (v["wy"] - u["wy"]) ** 2
                if d < bd:
                    bd = d; best = j
            if best is not None:
                used.add(best); pairs += 1
                v.setdefault("links", []).append({"floor": b, "vi": best})
                vb[best].setdefault("links", []).append({"floor": a, "vi": i})
        print(f"portals {FLOORS[a][0]}<->{FLOORS[b][0]}: {pairs}")

    for fl in floors_out:  # 作業用ワールド座標を除去
        for v in fl["verts"]:
            v.pop("wx"), v.pop("wy")

    out = ROOT / "floors_pack.json"
    out.write_text(json.dumps({"floors": floors_out}, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
