#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""渋谷駅 構内図 3D 用の埋め込みデータを生成する。

入力:
  osm_station.json  … 駅構内ポリゴン (platform / indoor / room / corridor)
  osm_paths.json    … 構内・駅周辺の歩行経路 (footway / steps / elevator / conveying)
  osm_urban.json    … 周辺建物・鉄道・道路
  nanbu-node.json / nanbu-link.json … 国交省 歩行空間ネットワーク(渋谷南部)
  osm_toilets.json  … トイレ位置
出力:
  shibuya_embedded.json … window.__EMBEDDED_DATA 用の一括 JSON
"""
import json, math, re
from collections import defaultdict, Counter
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, mapping, shape
from shapely.ops import unary_union

S = "/tmp/claude-0/-home-user-test-test-UIX/170288d1-e4df-5921-a92d-40f263747569/scratchpad"
TR = Transformer.from_crs("EPSG:6668", "EPSG:6677", always_xy=True)

GN = (-11920.20, -37931.79)  # 駅中心 (139.70168, 35.65803) の EPSG:6677 座標

def xy(lon, lat):
    return TR.transform(lon, lat)

def rnd(v):
    return round(v, 2)

# ---------------------------------------------------------------- OSM 共通
def load_osm(path):
    d = json.load(open(f"{S}/{path}"))
    nodes = {e["id"]: (e["lon"], e["lat"]) for e in d["elements"] if e["type"] == "node"}
    node_tags = {e["id"]: e.get("tags", {}) for e in d["elements"] if e["type"] == "node" and e.get("tags")}
    ways = [e for e in d["elements"] if e["type"] == "way"]
    return nodes, node_tags, ways

def way_coords(w, nodes):
    return [nodes[n] for n in w["nodes"] if n in nodes]

def parse_levels(tag):
    """OSM level タグ → アプリ階層値のリスト (日本式: 1F→0, 2F→1, B1→-1)"""
    if tag is None:
        return None
    out = []
    for p in str(tag).split(";"):
        try:
            l = float(p)
        except ValueError:
            continue
        a = l - 1 if l >= 1 else l
        a = max(-5.0, min(3.0, a))
        out.append(a)
    return sorted(set(out)) or None

def to_int_floor(levels):
    """代表フロア (整数) を決める。垂直移動は最下階に置く。"""
    lv = levels[0]
    return int(math.floor(lv + 0.5)) if lv == int(lv) else int(math.floor(lv))

# ---------------------------------------------------------------- 構内 Space / Floor / Fixture
FLOOR_KEYS = ["B5", "B4", "B3", "B2", "B1", "0", "1", "2", "3"]
KEY2LEVEL = {"B5": -5, "B4": -4, "B3": -3, "B2": -2, "B1": -1, "0": 0, "1": 1, "2": 2, "3": 3}
FLOOR_NAMES = {-5: ("地下5階", "B5F"), -4: ("地下4階", "B4F"), -3: ("地下3階", "B3F"),
               -2: ("地下2階", "B2F"), -1: ("地下1階", "B1F"), 0: ("1階", "1F"),
               1: ("2階", "2F"), 2: ("3階", "3F"), 3: ("4階", "4F")}

def platform_name(level, cx_lon):
    if level == -5:
        return "東急東横線・東京メトロ副都心線ホーム"
    if level == -3:
        return "東急田園都市線・東京メトロ半蔵門線ホーム"
    if level == 2:
        return "東京メトロ銀座線ホーム"
    if level == 1:
        return "京王井の頭線ホーム" if cx_lon < 139.6997 else "JR線ホーム(山手線・埼京線・湘南新宿ライン)"
    return "ホーム"

def build_indoor():
    nodes, node_tags, ways = load_osm("osm_station.json")
    spaces = defaultdict(list)   # level -> feature list
    fixtures = defaultdict(list)
    seq = [0]

    def add_space(level, poly_lonlat, category, name=None):
        coords = [[rnd(v) for v in xy(*p)] for p in poly_lonlat]
        if len(coords) < 4:
            return
        seq[0] += 1
        spaces[level].append({
            "type": "Feature",
            "properties": {"id": f"sp{seq[0]:05d}", "category": category,
                           "name": name, "floor_id": None, "restricted": "2",
                           "suite": None, "nonpublic": "3", "toll": None, "source": "osm"},
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })

    for w in ways:
        t = w.get("tags", {})
        if not t:
            continue
        cs = way_coords(w, nodes)
        if len(cs) < 4 or cs[0] != cs[-1]:
            continue
        op = t.get("operator", "")
        if "Hikarie" in op or "ヒカリエ" in t.get("name", ""):
            continue  # 隣接商業ビル内部は周辺建物として表現する
        if "shop" in t and "level" not in t:
            continue
        levels = parse_levels(t.get("level"))
        if levels is None:
            continue
        multi = len(levels) > 1
        base = to_int_floor(levels)
        name = t.get("name:ja") or t.get("name")

        cx = sum(p[0] for p in cs) / len(cs)
        if t.get("railway") == "platform" or t.get("public_transport") == "platform":
            add_space(base, cs, "B028", platform_name(base, cx))
        elif t.get("amenity") == "toilets":
            add_space(base, cs, "B010", name or "トイレ")
        elif t.get("highway") == "elevator" or t.get("elevator") == "yes":
            add_space(base, cs, "B022", name)
        elif t.get("conveying"):
            add_space(base, cs, "B023", name)
        elif multi:
            # 垂直動線: 4 フロア以上跨ぐものは EV 扱い
            span = levels[-1] - levels[0]
            cat = "B022" if span >= 3 else "B021"
            for lv in range(int(levels[0]), int(levels[-1])):
                if -5 <= lv <= 3:
                    add_space(lv, cs, cat, name)
        elif t.get("indoor") == "corridor" or t.get("highway") == "corridor":
            add_space(base, cs, "B029", name)
        elif t.get("indoor") == "room" or t.get("room"):
            if name and "改札" in name:
                add_space(base, cs, "B006", name)
            elif "shop" in t:
                add_space(base, cs, "B001", name)
            else:
                add_space(base, cs, "B019", name)
        elif t.get("barrier") == "wall":
            continue
        elif t.get("indoor") == "yes":
            add_space(base, cs, "B029", name)

    # ---- 地下・構内の通路は OSM 上では線データのため、バッファして面化する
    pn, pnt, pways = load_osm("osm_paths.json")
    corridor_lines = defaultdict(list)   # (level, cat) -> [LineString]
    for w in pways:
        t = w.get("tags", {})
        if not t or t.get("highway") not in ("footway", "steps", "corridor", "elevator"):
            continue
        cs = way_coords(w, pn)
        if len(cs) < 2:
            continue
        levels = parse_levels(t.get("level"))
        indoorish = t.get("indoor") == "yes" or t.get("covered") == "yes" or \
            t.get("tunnel") in ("yes", "building_passage")
        if levels is None:
            continue  # レベル情報のない地上歩道は面化しない
        if levels == [0.0] and not indoorish:
            continue
        if t.get("highway") == "steps":
            cat = "B023" if t.get("conveying") else "B021"
            width = 3.2
        elif t.get("highway") == "elevator":
            cat, width = "B022", 2.5
        elif len(levels) > 1:
            cat = "B022" if levels[-1] - levels[0] >= 3 else "B021"
            width = 3.2
        else:
            cat, width = "B029", 5.0
        line = LineString([xy(*p) for p in cs])
        lv0 = int(math.floor(levels[0]))
        lv1 = int(math.floor(levels[-1]))
        for lv in ({lv0} if cat == "B029" else set(range(min(lv0, lv1), max(lv0, lv1) + 1))):
            if -5 <= lv <= 3:
                corridor_lines[(lv, cat)].append(line.buffer(width / 2, cap_style=2, join_style=2))
    CAT_NAMES = {"B029": "通路/コンコース", "B021": "階段", "B022": "エレベーター", "B023": "エスカレーター"}
    for (lv, cat), polys in corridor_lines.items():
        u = unary_union(polys).simplify(0.3)
        geoms = u.geoms if u.geom_type == "MultiPolygon" else [u]
        for g in geoms:
            if g.area < 4:
                continue
            rings = [[[rnd(x_), rnd(y_)] for x_, y_ in g.exterior.coords]]
            for hole in g.interiors:
                rings.append([[rnd(x_), rnd(y_)] for x_, y_ in hole.coords])
            seq[0] += 1
            spaces[lv].append({
                "type": "Feature",
                "properties": {"id": f"sp{seq[0]:05d}", "category": cat,
                               "name": None, "floor_id": None, "restricted": "2",
                               "suite": None, "nonpublic": "3", "toll": None, "source": "osm-line"},
                "geometry": {"type": "Polygon", "coordinates": rings},
            })

    # ---- 京王井の頭線ホーム (OSM に面データがないため線路から合成)
    un_, _, uways = load_osm("osm_urban.json")
    keio_lines = []
    for w in uways:
        t = w.get("tags", {})
        if not t or t.get("railway") not in ("rail", "light_rail"):
            continue
        nm = (t.get("name") or "") + (t.get("operator") or "")
        if "井の頭" not in nm:
            continue
        cs = [p for p in way_coords(w, un_) if 139.6968 <= p[0] <= 139.69915 and 35.6565 <= p[1] <= 35.6595]
        if len(cs) >= 2:
            keio_lines.append(LineString([xy(*p) for p in cs]))
    if keio_lines:
        kp = unary_union([l.buffer(5.5, cap_style=2) for l in keio_lines]).simplify(0.5)
        geoms = kp.geoms if kp.geom_type == "MultiPolygon" else [kp]
        for g in geoms:
            if g.area < 100:
                continue
            seq[0] += 1
            spaces[1].append({
                "type": "Feature",
                "properties": {"id": f"sp{seq[0]:05d}", "category": "B028",
                               "name": "京王井の頭線ホーム", "floor_id": None, "restricted": "2",
                               "suite": None, "nonpublic": "3", "toll": None, "source": "synth"},
                "geometry": {"type": "Polygon",
                             "coordinates": [[[rnd(x_), rnd(y_)] for x_, y_ in g.exterior.coords]]},
            })

    # トイレ (点) → 5m 四方の Space
    tnodes, _, tways = load_osm("osm_toilets.json")
    td = json.load(open(f"{S}/osm_toilets.json"))
    for e in td["elements"]:
        tg = e.get("tags", {})
        if tg.get("amenity") != "toilets" or e["type"] != "node":
            continue
        levels = parse_levels(tg.get("level"))
        if levels is None:
            continue
        base = to_int_floor(levels)
        lon, lat = e["lon"], e["lat"]
        dl = 0.000028
        sq = [(lon - dl, lat - dl), (lon + dl, lat - dl), (lon + dl, lat + dl), (lon - dl, lat + dl), (lon - dl, lat - dl)]
        add_space(base, sq, "B010", tg.get("name") or "トイレ")

    # 壁 (barrier=wall / indoor=wall, level 付き) → Fixture
    for w in ways:
        t = w.get("tags", {})
        if not t or ("Hikarie" in t.get("operator", "")):
            continue
        if t.get("barrier") != "wall" and t.get("indoor") != "wall":
            continue
        levels = parse_levels(t.get("level"))
        if levels is None:
            continue
        base = to_int_floor(levels)
        cs = way_coords(w, nodes)
        if len(cs) < 2:
            continue
        line = LineString([xy(*p) for p in cs])
        poly = line.buffer(0.35, cap_style=2, join_style=2)
        if poly.is_empty:
            continue
        geoms = poly.geoms if poly.geom_type == "MultiPolygon" else [poly]
        for g in geoms:
            fixtures[base].append({
                "type": "Feature",
                "properties": {"id": f"fx{w['id']}", "category": "C001", "floor_id": None, "source": "osm"},
                "geometry": {"type": "Polygon",
                             "coordinates": [[[rnd(x_), rnd(y_)] for x_, y_ in g.exterior.coords]]},
            })

    # Floor 外形 = Space の buffer + union
    floors = {}
    for key in FLOOR_KEYS:
        lv = KEY2LEVEL[key]
        polys = []
        for ft in spaces.get(lv, []):
            try:
                p = shape(ft["geometry"]).buffer(0)
                if p.is_valid and not p.is_empty:
                    polys.append(p.buffer(2.5, join_style=2))
            except Exception:
                pass
        feats = []
        if polys:
            u = unary_union(polys).simplify(0.5)
            geoms = u.geoms if u.geom_type == "MultiPolygon" else [u]
            nm, sn = FLOOR_NAMES[lv]
            for i, g in enumerate(geoms):
                if g.area < 30:
                    continue
                rings = [[[rnd(x_), rnd(y_)] for x_, y_ in g.exterior.coords]]
                for hole in g.interiors:
                    rings.append([[rnd(x_), rnd(y_)] for x_, y_ in hole.coords])
                feats.append({
                    "type": "Feature",
                    "properties": {"id": f"fl{key}_{i}", "category": "1", "name": nm,
                                   "ordinal": float(lv), "short_name": sn, "source": "osm"},
                    "geometry": {"type": "Polygon", "coordinates": rings},
                })
        floors[key] = feats

    return spaces, floors, fixtures

# ---------------------------------------------------------------- 歩行者ネットワーク
def build_network():
    nodes, node_tags, ways = load_osm("osm_paths.json")
    STATION_BBOX = (139.6950, 35.6540, 139.7080, 35.6615)

    # ノード階層の決定: 単一レベル way が最優先
    node_level = {}
    vertical_ways = []
    net_ways = []
    for w in ways:
        t = w.get("tags", {})
        if not t or t.get("highway") not in ("footway", "steps", "corridor", "elevator"):
            continue
        if t.get("area") == "yes":
            continue
        cs = [n for n in w["nodes"] if n in nodes]
        if len(cs) < 2:
            continue
        levels = parse_levels(t.get("level"))
        if levels is None:
            if t.get("tunnel") or t.get("covered") == "yes":
                levels = [0.0]
            elif t.get("layer") and t["layer"].lstrip("-").isdigit() and int(t["layer"]) != 0:
                levels = [max(-5.0, min(3.0, float(t["layer"])))]
            else:
                levels = [0.0]
        net_ways.append((w, levels))
        if len(levels) == 1:
            for n in cs:
                node_level.setdefault(n, levels[0])
        else:
            vertical_ways.append((w, levels))

    for w, levels in vertical_ways:  # 端点にレベルを割り当て
        cs = [n for n in w["nodes"] if n in nodes]
        a, b = cs[0], cs[-1]
        la, lb = node_level.get(a), node_level.get(b)
        lo, hi = levels[0], levels[-1]
        if la is None and lb is None:
            node_level[a], node_level[b] = lo, hi
        elif la is None:
            node_level[a] = lo if abs(lb - hi) < abs(lb - lo) else hi
        elif lb is None:
            node_level[b] = lo if abs(la - hi) < abs(la - lo) else hi
        for n in cs[1:-1]:
            node_level.setdefault(n, (node_level.get(a, lo) + node_level.get(b, hi)) / 2)

    node_feats, link_feats = [], []
    used_nodes = {}

    def node_id(osm_id):
        return f"osm{osm_id}"

    def emit_node(osm_id):
        if osm_id in used_nodes:
            return
        used_nodes[osm_id] = True
        lon, lat = nodes[osm_id]
        ordv = node_level.get(osm_id, 0.0)
        x, y = xy(lon, lat)
        node_feats.append({
            "type": "Feature",
            "properties": {"node_id": node_id(osm_id), "lat": lat, "lon": lon,
                           "ordinal": float(ordv), "in_out": "3"},
            "geometry": {"type": "Point", "coordinates": [rnd(x), rnd(y)]},
        })

    def emit_link(lid, a, b, coords_ll, vtype, dist):
        link_feats.append({
            "type": "Feature",
            "properties": {"link_id": lid, "start_id": a, "end_id": b,
                           "distance": round(dist, 1), "direction": "1", "vtype": vtype},
            "geometry": {"type": "LineString",
                         "coordinates": [[rnd(v) for v in xy(*p)] for p in coords_ll]},
        })

    def seg_dist(coords_ll):
        pts = [xy(*p) for p in coords_ll]
        return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

    for w, levels in net_ways:
        t = w["tags"]
        cs = [n for n in w["nodes"] if n in nodes]
        if t.get("highway") == "steps":
            vtype = "esc" if t.get("conveying") else "stairs"
        elif t.get("highway") == "elevator":
            vtype = "elev"
        elif len(levels) > 1:
            vtype = "elev" if levels[-1] - levels[0] >= 3 else "stairs"
        else:
            vtype = None
        coords_ll = [nodes[n] for n in cs]
        emit_node(cs[0]); emit_node(cs[-1])
        for n in cs[1:-1]:
            emit_node(n)
        # way 全体を 1 リンクにすると中間分岐が失われるため、ノード毎に分割
        for i in range(len(cs) - 1):
            seg = coords_ll[i:i + 2]
            emit_link(f"osmw{w['id']}_{i}", node_id(cs[i]), node_id(cs[i + 1]), seg, vtype, seg_dist(seg))

    # EV ノード (点) : 上下階の近傍ノードへ接続
    ev_nodes = [e_id for e_id, tg in node_tags.items() if tg.get("highway") == "elevator"]
    ev_links = 0
    for e_id in ev_nodes:
        lvls = parse_levels(node_tags[e_id].get("level"))
        if not lvls or len(lvls) < 2 or e_id not in nodes:
            continue
        lon, lat = nodes[e_id]
        x0, y0 = xy(lon, lat)
        near = {}
        for oid in used_nodes:
            lv = node_level.get(oid, 0.0)
            if not any(abs(lv - l) < 0.51 for l in lvls):
                continue
            x1, y1 = xy(*nodes[oid])
            d = math.hypot(x1 - x0, y1 - y0)
            if d < 25 and (lv not in near or d < near[lv][1]):
                near[lv] = (oid, d)
        ks = sorted(near)
        for a, b in zip(ks, ks[1:]):
            na, nb = near[a][0], near[b][0]
            emit_link(f"ev{e_id}_{int(a)}_{int(b)}", node_id(na), node_id(nb),
                      [nodes[na], (lon, lat), nodes[nb]], "elev", 20)
            ev_links += 1

    # ---- 国交省 渋谷南部データ (地上) をマージ
    nb_nodes = json.load(open(f"{S}/nanbu-node.json"))
    nb_links = json.load(open(f"{S}/nanbu-link.json"))
    VTYPE_MAP = {3: "slope", 4: "elev", 5: "esc", 6: "stairs"}
    nb_pos = {}
    for f in nb_nodes["features"]:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"][:2]
        x, y = xy(lon, lat)
        nb_pos[p["node_id"]] = (x, y, float(p.get("floor") or 0))
        node_feats.append({
            "type": "Feature",
            "properties": {"node_id": f"nb{p['node_id']}", "lat": lat, "lon": lon,
                           "ordinal": float(p.get("floor") or 0), "in_out": "1"},
            "geometry": {"type": "Point", "coordinates": [rnd(x), rnd(y)]},
        })
    for f in nb_links["features"]:
        p = f["properties"]
        cs = f["geometry"]["coordinates"]
        if len(cs) < 2 or p["start_id"] not in nb_pos or p["end_id"] not in nb_pos:
            continue
        emit_link(f"nb{p['link_id']}", f"nb{p['start_id']}", f"nb{p['end_id']}",
                  [(c[0], c[1]) for c in cs], VTYPE_MAP.get(p.get("route_type")), 0)

    # ---- OSM 地上ノード ↔ 南部ノードの接続 (12m 以内)
    conn = 0
    osm_ground = [(oid, xy(*nodes[oid])) for oid, lv in node_level.items()
                  if oid in used_nodes and abs(lv) < 0.26]
    nb_ground = [(nid, (x, y)) for nid, (x, y, fl) in nb_pos.items() if abs(fl) < 0.26]
    GRID = 30.0
    grid = defaultdict(list)
    for nid, (x, y) in nb_ground:
        grid[(int(x // GRID), int(y // GRID))].append((nid, x, y))
    for oid, (x, y) in osm_ground:
        best, bd = None, 12.0
        gx, gy = int(x // GRID), int(y // GRID)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for nid, x1, y1 in grid.get((gx + dx, gy + dy), []):
                    d = math.hypot(x1 - x, y1 - y)
                    if d < bd:
                        bd, best = d, (nid, x1, y1)
        if best:
            lon0, lat0 = nodes[oid]
            emit_link(f"cn{oid}", node_id(oid), f"nb{best[0]}",
                      [(lon0, lat0), TR.transform(best[1], best[2], direction="INVERSE")],
                      None, bd)
            conn += 1

    print(f"network: {len(node_feats)} nodes, {len(link_feats)} links (ev:{ev_links}, connectors:{conn})")
    return (
        {"type": "FeatureCollection", "name": "Shibuya_node",
         "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::6677"}},
         "features": node_feats},
        {"type": "FeatureCollection", "name": "Shibuya_link",
         "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::6677"}},
         "features": link_feats},
    )

# ---------------------------------------------------------------- 周辺建物・道路・鉄道
LINE_COLORS = [
    (re.compile(r"山手"), "#9acd32"),
    (re.compile(r"埼京|湘南新宿|山手貨物|相鉄"), "#00ac9a"),
    (re.compile(r"銀座線"), "#ff9500"),
    (re.compile(r"半蔵門線"), "#8f76d6"),
    (re.compile(r"副都心線"), "#9c5e31"),
    (re.compile(r"東横線"), "#da0442"),
    (re.compile(r"田園都市線"), "#00a04b"),
    (re.compile(r"井の頭線"), "#1d2088"),
    (re.compile(r"京王"), "#dd0077"),
]

def build_urban():
    nodes, _, ways = load_osm("osm_urban.json")
    buildings, rails, road_feats = [], [], []
    for w in ways:
        t = w.get("tags", {})
        cs = way_coords(w, nodes)
        if not t or len(cs) < 2:
            continue
        if "building" in t:
            if len(cs) < 4 or cs[0] != cs[-1]:
                continue
            h = None
            if t.get("height"):
                m = re.match(r"([\d.]+)", t["height"])
                if m:
                    h = float(m.group(1))
            if h is None and t.get("building:levels"):
                m = re.match(r"([\d.]+)", t["building:levels"])
                if m:
                    h = float(m.group(1)) * 3.2 + 3
            if h is None:
                h = 8.0
            ring = []
            for lon, lat in cs[:-1]:
                x, y = xy(lon, lat)
                ring.append([round(x - GN[0], 1), round(y - GN[1], 1)])
            if len(ring) >= 3 and abs(Polygon(ring).area) > 15:
                buildings.append({"h": round(h, 1), "r": ring})
        elif t.get("railway") in ("rail", "subway", "light_rail"):
            if t.get("service") in ("yard", "siding", "spur"):
                continue
            name = (t.get("name") or "") + " " + (t.get("operator") or "")
            color = "#7a8aa0"
            for pat, c in LINE_COLORS:
                if pat.search(name):
                    color = c
                    break
            if t.get("tunnel"):
                lv = "t"
            elif t.get("bridge") or (t.get("layer") or "0").lstrip("-").isdigit() and int(t.get("layer") or 0) > 0:
                lv = "b"
            else:
                lv = "g"
            pts = []
            for lon, lat in cs:
                x, y = xy(lon, lat)
                pts.append([round(x - GN[0], 1), round(y - GN[1], 1)])
            rails.append({"c": color, "lv": lv, "p": pts})
        elif "highway" in t:
            coords = [[rnd(v) for v in xy(*p)] for p in cs]
            road_feats.append({
                "type": "Feature", "properties": {},
                "geometry": {"type": "LineString", "coordinates": coords},
            })
    print(f"urban: {len(buildings)} buildings, {len(rails)} rail segs, {len(road_feats)} roads")
    fg = {"type": "FeatureCollection", "name": "fg",
          "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::6677"}},
          "features": road_feats}
    return buildings, rails, fg

# ---------------------------------------------------------------- 出力
def main():
    spaces, floors, fixtures = build_indoor()
    node_fc, link_fc = build_network()
    buildings, rails, fg = build_urban()

    out = {
        "./data/nw/Shibuya_node.geojson": node_fc,
        "./data/nw/Shibuya_link.geojson": link_fc,
        "./data/fg.geojson": fg,
        "./data/urban/buildings.json": buildings,
        "./data/urban/rails.json": rails,
    }
    for key in FLOOR_KEYS:
        lv = KEY2LEVEL[key]
        out[f"./data/ShibuyaTerminal/ShibuyaTerminal_{key}_Space.geojson"] = {
            "type": "FeatureCollection", "features": spaces.get(lv, [])}
        out[f"./data/ShibuyaTerminal/ShibuyaTerminal_{key}_Floor.geojson"] = {
            "type": "FeatureCollection", "features": floors.get(key, [])}
        out[f"./data/ShibuyaTerminal/ShibuyaTerminal_{key}_Fixture.geojson"] = {
            "type": "FeatureCollection", "features": fixtures.get(lv, [])}
        print(f"floor {key}: {len(spaces.get(lv, []))} spaces, {len(floors.get(key, []))} floor polys, {len(fixtures.get(lv, []))} fixtures")

    json.dump(out, open(f"{S}/shibuya_embedded.json", "w"), ensure_ascii=False, separators=(",", ":"))
    import os
    print("total size:", os.path.getsize(f"{S}/shibuya_embedded.json"))

if __name__ == "__main__":
    main()
