#!/usr/bin/env python3
"""
道路の精密化レイヤ (リアル表示用) を OSM の道路中心線 + PLATEAU 道路面 (LOD1) から生成する。
  car   : 車道面 (中心線を車線数 × 車線幅でバッファ) のポリゴン
  walk  : 歩道面 (PLATEAU 道路面 − 車道面)。表示側で 15cm 持ち上げて縁石を出す
  marks : 区画線の線分 [x0,y0,x1,y1,幅,色] (dm)。外側線・中央線・車線境界線 (破線は分割済み)・横断歩道の縞・停止線
  lanes : 車線ごとの走行経路 (進行方向に並べた点列)。表示側で車を流す
PLATEAU 横浜市 2024 の道路 LOD3 は対象範囲の南端 (桜木町〜関内) にしか無く、属性 (車道/歩道/区画線) も
3D Tiles には入っていないため、ここでは OSM 中心線から幾何学的に組み立てる。
"""
import math
from shapely.geometry import LineString, Point, Polygon, MultiLineString, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

CAR_HW = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
          "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service"}
DEFAULT_LANES = {"motorway": 4, "motorway_link": 1, "trunk": 4, "trunk_link": 1, "primary": 4, "primary_link": 1,
                 "secondary": 2, "secondary_link": 1, "tertiary": 2, "tertiary_link": 1, "unclassified": 2, "residential": 1, "living_street": 1, "service": 1}
SPEED = {"motorway": 22, "motorway_link": 12, "trunk": 14, "trunk_link": 10, "primary": 12, "primary_link": 9, "secondary": 11, "secondary_link": 8,
         "tertiary": 10, "tertiary_link": 8, "unclassified": 8, "residential": 6, "living_street": 4, "service": 4}
LANE_W = 3.25
DASH, GAP = 5.0, 5.0        # 車線境界線の破線 (都市部)
LINE_W = 0.15               # 区画線の幅
ZEBRA_W, ZEBRA_PITCH, CROSS_HALF = 0.45, 0.9, 2.0   # 横断歩道: 縞幅, ピッチ, 横断歩道の幅/2


def _int(v, d):
    try: return int(float(str(v).split(";")[0]))
    except Exception: return d


def _lanes(t):
    hw = t["highway"]
    L = _int(t.get("lanes"), DEFAULT_LANES.get(hw, 1))
    one = t.get("oneway") in ("yes", "1", "true", "-1") or hw in ("motorway", "motorway_link")
    if t.get("junction") in ("roundabout", "circular"): one = True
    rev = t.get("oneway") == "-1"
    if one:
        lf, lb = L, 0
    else:
        lf = _int(t.get("lanes:forward"), None); lb = _int(t.get("lanes:backward"), None)
        if lf is None and lb is None:
            if L <= 1: lf, lb = 1, 1 if hw not in ("residential", "living_street", "service") else 0   # 1車線の細街路は対面通行の共用車線
            else: lf = L // 2; lb = L - lf
        elif lf is None: lf = max(L - lb, 0)
        elif lb is None: lb = max(L - lf, 0)
    w = LANE_W if hw not in ("residential", "living_street", "service") else 2.6
    return lf, lb, rev, one, w


def _offset_path(pts, off):
    """折れ線を左 (進行方向左手 = +法線) に off だけ平行移動した折れ線。"""
    if abs(off) < 1e-6: return [tuple(p) for p in pts]
    ls = LineString(pts)
    try:
        o = ls.offset_curve(off, join_style=2, mitre_limit=2.0)   # shapely 2: 正 = 左
    except Exception:
        return None
    if o.is_empty: return None
    if o.geom_type == "MultiLineString":
        o = max(o.geoms, key=lambda g: g.length)
    c = list(o.coords)
    # offset_curve は方向を保つが、まれに反転するので先頭の向きで確認
    if len(c) >= 2 and len(pts) >= 2:
        d0 = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]); d1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
        if d0[0] * d1[0] + d0[1] * d1[1] < 0: c.reverse()
    return c


def _dashes(path, dash, gap, phase=0.0):
    out = []; acc = -phase; on = True
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 1e-6: continue
        s = 0.0
        while s < L:
            seg = (dash if on else gap)
            rem = seg - acc if acc > 0 else seg
            e = min(L, s + rem)
            if on and e - s > 0.3:
                out.append((x0 + (x1 - x0) * s / L, y0 + (y1 - y0) * s / L, x0 + (x1 - x0) * e / L, y0 + (y1 - y0) * e / L))
            if e >= L: acc = acc + (L - s) if acc > 0 else (L - s); break
            s = e; acc = 0.0; on = not on
    return out


def _solid(path):
    return [(x0, y0, x1, y1) for (x0, y0), (x1, y1) in zip(path, path[1:]) if math.hypot(x1 - x0, y1 - y0) > 0.05]


def build_road_detail(nodes, ways, cache, way_coords, to_local, road_polys, boxpoly, dm, bridge_h=None):
    car_ways = []
    for w, (nd, t) in ways.items():
        hw = t.get("highway")
        if hw not in CAR_HW or t.get("area") == "yes": continue
        if t.get("tunnel") in ("yes", "building_passage") or t.get("covered") == "yes": continue
        pts = way_coords(nodes, ways, w, cache)
        if len(pts) < 2: continue
        ls = LineString(pts)
        if not ls.intersects(boxpoly): continue
        bridge = t.get("bridge") not in (None, "no") or (_int(t.get("layer"), 0) > 0)
        car_ways.append({"t": t, "hw": hw, "pts": pts, "ls": ls, "bridge": bridge})
    print("  car ways", len(car_ways))

    # ---- 車道面・区画線・車線経路 ----
    car_polys = []; marks = []; lanes = []
    def add_marks(segs, w, col, bridge):
        if bridge: return
        for x0, y0, x1, y1 in segs: marks.append((x0, y0, x1, y1, w, col))
    for cw in car_ways:
        t = cw["t"]; pts = cw["pts"]; hw = cw["hw"]
        lf, lb, rev, one, W = _lanes(t)
        if rev: pts = pts[::-1]
        if one:
            total = max(lf, 1); left = total * W / 2; right = -total * W / 2
        else:
            left = lf * W; right = -lb * W
        # 共用車線 (細街路) : 幅 5m、区画線なし
        shared = (not one) and lb == 0
        if shared: left, right = 2.5, -2.5
        half = max(left, -right) + 0.3
        try:
            poly = LineString(pts).buffer(half, cap_style=1, join_style=1)
            # 非対称 (片側の車線数が違う) の場合は中心線を左右に分けてバッファ
            if abs(left + right) > 0.1 and not shared:
                poly = unary_union([LineString(pts).buffer(0.01), LineString(pts).buffer(left + 0.3, single_sided=True), LineString(pts).buffer(-(-right + 0.3), single_sided=True)]).buffer(0.05)
            poly = poly.intersection(boxpoly)
        except Exception:
            poly = None
        if poly is not None and not poly.is_empty: car_polys.append(poly)
        # 区画線 (橋の上は高さが不明なので省く)
        if not shared and hw not in ("service", "living_street"):
            el = _offset_path(pts, left - 0.25); er = _offset_path(pts, right + 0.25)
            if el: add_marks(_solid(el), LINE_W, 0, cw["bridge"])
            if er: add_marks(_solid(er), LINE_W, 0, cw["bridge"])
            if not one and lf and lb:
                total = lf + lb
                add_marks(_solid(pts) if total >= 4 else _dashes(pts, DASH, GAP), LINE_W, 1 if total >= 4 else 0, cw["bridge"])
            for i in range(1, lf):
                p = _offset_path(pts, i * W)
                if p: add_marks(_dashes(p, DASH, GAP), LINE_W, 0, cw["bridge"])
            for i in range(1, lb):
                p = _offset_path(pts, -i * W)
                if p: add_marks(_dashes(p, DASH, GAP), LINE_W, 0, cw["bridge"])
            if one:
                for i in range(1, total if one else 0):
                    p = _offset_path(pts, right + i * W)
                    if p: add_marks(_dashes(p, DASH, GAP), LINE_W, 0, cw["bridge"])
        # 車線経路 (左側通行: 進行方向左が順方向車線)
        if hw == "service": continue
        def add_lane(path, speed, bridge):
            if not path: return
            ls = LineString(path).intersection(boxpoly)
            parts = ls.geoms if ls.geom_type == "MultiLineString" else [ls] if ls.geom_type == "LineString" else []
            for g in parts:
                if g.length < 12: continue
                if bridge:
                    # 橋の上: 橋梁メッシュ (PLATEAU brid) の路面高さを点ごとに求める。取れない区間は省く
                    if bridge_h is None: continue
                    dense = [g.interpolate(d) for d in [i * 4.0 for i in range(int(g.length // 4.0))] + [g.length]]
                    pts = []
                    for q in dense:
                        h = bridge_h(q.x, q.y)
                        if h is None: pts = None; break
                        pts.append([dm(q.x), dm(q.y), dm(h)])
                    if pts and len(pts) >= 2: lanes.append({"p": pts, "v": speed, "b": 1})
                    continue
                lanes.append({"p": [[dm(x), dm(y)] for x, y in g.coords], "v": speed, "b": 0})
        spd = SPEED.get(hw, 8)
        if shared:
            add_lane(_offset_path(pts, 1.2), spd, cw["bridge"]); add_lane(_offset_path(pts[::-1], 1.2), spd, cw["bridge"])
        elif one:
            for i in range(total): add_lane(_offset_path(pts, right + (i + 0.5) * W), spd, cw["bridge"])
        else:
            for i in range(lf): add_lane(_offset_path(pts, (i + 0.5) * W), spd, cw["bridge"])
            for i in range(lb): add_lane(_offset_path(pts[::-1], (i + 0.5) * W), spd, cw["bridge"])
    car_union = unary_union(car_polys).buffer(0)
    print("  car polys", len(car_polys), "lanes", len(lanes), "marks", len(marks))

    # ---- 歩道面 = PLATEAU 道路面 − 車道面 ----
    road_area = unary_union([Polygon([(x / 10, y / 10) for x, y in r[0]], [[(x / 10, y / 10) for x, y in h] for h in r[1:]]).buffer(0) for r in road_polys]).buffer(0)
    walk = road_area.difference(car_union.buffer(0.1)).buffer(-0.4).buffer(0.4)   # 細すぎる断片を除く
    car_in_road = car_union.intersection(boxpoly)

    # ---- 横断歩道 (footway=crossing の経路を車道面で切る) ・ 停止線 ----
    tree = STRtree([cw["ls"] for cw in car_ways])
    cross_paths = []
    for w, (nd, t) in ways.items():
        if t.get("footway") != "crossing" and t.get("cycleway") != "crossing" and not (t.get("highway") in ("footway", "path", "pedestrian") and t.get("crossing")):
            continue
        if t.get("crossing") in ("unmarked", "no") or t.get("railway"): continue
        pts = way_coords(nodes, ways, w, cache)
        if len(pts) < 2: continue
        g = LineString(pts).intersection(car_in_road)
        for part in (g.geoms if hasattr(g, "geoms") else [g]):
            if part.geom_type == "LineString" and part.length >= 2.5: cross_paths.append(part)
    # 交差点ノード (highway=crossing) で、横断歩道の経路が近くに無いもの: 道路に直交する横断歩道を置く
    ctree = STRtree(cross_paths) if cross_paths else None
    for nid, (lon, lat, t) in nodes.items():
        if t.get("highway") != "crossing" or t.get("crossing") in ("unmarked", "no") or t.get("railway"): continue
        pt = Point(*to_local(lon, lat))
        if not boxpoly.contains(pt): continue
        if ctree is not None and any(cross_paths[i].distance(pt) < 6 for i in ctree.query(pt.buffer(6))): continue
        cand = [car_ways[i] for i in tree.query(pt.buffer(3)) if car_ways[i]["ls"].distance(pt) < 3]
        if not cand: continue
        cw = min(cand, key=lambda c: c["ls"].distance(pt))
        s = cw["ls"].project(pt); a = cw["ls"].interpolate(max(s - 1, 0)); b = cw["ls"].interpolate(min(s + 1, cw["ls"].length))
        dx, dy = b.x - a.x, b.y - a.y; L = math.hypot(dx, dy)
        if L < 1e-6: continue
        nx, ny = -dy / L, dx / L
        lf, lb, rev, one, W = _lanes(cw["t"]); hw_ = (max(lf, lb) if not one else lf / 2) * W + 1.0
        if (not one) and lb == 0: hw_ = 3.0
        g = LineString([(pt.x - nx * hw_ * 1.5, pt.y - ny * hw_ * 1.5), (pt.x + nx * hw_ * 1.5, pt.y + ny * hw_ * 1.5)]).intersection(car_in_road)
        for part in (g.geoms if hasattr(g, "geoms") else [g]):
            if part.geom_type == "LineString" and part.length >= 2.5: cross_paths.append(part)
    zebra = 0
    for cp in cross_paths:
        c = list(cp.coords); Ltot = cp.length
        s = ZEBRA_PITCH / 2
        while s < Ltot:
            p = cp.interpolate(s); q = cp.interpolate(min(s + 0.5, Ltot)); r = cp.interpolate(max(s - 0.5, 0))
            dx, dy = q.x - r.x, q.y - r.y; L = math.hypot(dx, dy)
            if L > 1e-6:
                nx, ny = -dy / L, dx / L
                marks.append((p.x - nx * CROSS_HALF, p.y - ny * CROSS_HALF, p.x + nx * CROSS_HALF, p.y + ny * CROSS_HALF, ZEBRA_W, 0)); zebra += 1
            s += ZEBRA_PITCH
        # 停止線: 横断歩道の中点に最も近い車道の、進行方向ごとに手前 2m
        mid = cp.interpolate(Ltot / 2)
        cand = [car_ways[i] for i in tree.query(mid.buffer(10)) if car_ways[i]["ls"].distance(mid) < 10 and not car_ways[i]["bridge"]]
        if not cand: continue
        cw = min(cand, key=lambda c: c["ls"].distance(mid))
        ls = cw["ls"]; s0 = ls.project(mid); a = ls.interpolate(max(s0 - 1, 0)); b = ls.interpolate(min(s0 + 1, ls.length))
        dx, dy = b.x - a.x, b.y - a.y; L = math.hypot(dx, dy)
        if L < 1e-6: continue
        dx /= L; dy /= L; nx, ny = -dy, dx
        # 横断歩道が道路とほぼ平行なら (歩道沿いの誤検出) 停止線を置かない
        cdx, cdy = c[-1][0] - c[0][0], c[-1][1] - c[0][1]; cl = math.hypot(cdx, cdy)
        if cl < 1e-6 or abs(cdx * dx + cdy * dy) / cl > 0.7: continue
        lf, lb, rev, one, W = _lanes(cw["t"])
        if rev: dx, dy, nx, ny = -dx, -dy, -nx, -ny
        base = ls.interpolate(s0)
        shared = (not one) and lb == 0
        if one or shared:
            tot = max(lf, 1); left = tot * W / 2 if one else 2.5; right = -left
            px, py = base.x - dx * (CROSS_HALF + 2.0), base.y - dy * (CROSS_HALF + 2.0)
            if shared: left, right = 2.3, 0.0
            marks.append((px + nx * (right + 0.3), py + ny * (right + 0.3), px + nx * (left - 0.3), py + ny * (left - 0.3), 0.45, 0))
            if shared:
                px, py = base.x + dx * (CROSS_HALF + 2.0), base.y + dy * (CROSS_HALF + 2.0)
                marks.append((px - nx * 0.3, py - ny * 0.3, px - nx * 2.3, py - ny * 2.3, 0.45, 0))
        else:
            px, py = base.x - dx * (CROSS_HALF + 2.0), base.y - dy * (CROSS_HALF + 2.0)
            marks.append((px + nx * 0.3, py + ny * 0.3, px + nx * (lf * W - 0.3), py + ny * (lf * W - 0.3), 0.45, 0))
            px, py = base.x + dx * (CROSS_HALF + 2.0), base.y + dy * (CROSS_HALF + 2.0)
            marks.append((px - nx * 0.3, py - ny * 0.3, px - nx * (lb * W - 0.3), py - ny * (lb * W - 0.3), 0.45, 0))
    print("  crosswalks", len(cross_paths), "zebra bars", zebra, "marks total", len(marks))

    def polys_dm(geom):
        out = []
        for p in (geom.geoms if hasattr(geom, "geoms") else [geom]):
            if p.is_empty or p.geom_type != "Polygon" or p.area < 2: continue
            out.append([[[dm(x), dm(y)] for x, y in p.exterior.coords[:-1]]] + [[[dm(x), dm(y)] for x, y in r.coords[:-1]] for r in p.interiors if len(r.coords) > 4])
        return out
    car_out = polys_dm(car_in_road.simplify(0.15)); walk_out = polys_dm(walk.simplify(0.15))
    mark_arr = []
    for x0, y0, x1, y1, w, col in marks:
        if boxpoly.contains(Point(x0, y0)) and boxpoly.contains(Point(x1, y1)):
            mark_arr += [dm(x0), dm(y0), dm(x1), dm(y1), int(round(w * 100)), col]
    print("  car polygons", len(car_out), "walk polygons", len(walk_out), "mark segments", len(mark_arr) // 6)
    return {"car": car_out, "walk": walk_out, "lanes": lanes}, mark_arr
