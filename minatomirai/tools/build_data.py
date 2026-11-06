#!/usr/bin/env python3
"""
みなとみらい 3D 用データパック生成スクリプト。

入力（WORK ディレクトリ、fetch_plateau.py / decode_b3dm.js / fetch_osm.py が生成）:
  dec_lod3.json, idx_lod3.json   PLATEAU 建築物 (LOD3優先, LOD2フォールバック) デコード済み
  dec_brid2.json, dec_brid3.json PLATEAU 橋梁 LOD2 / ペデストリアンデッキ LOD3
  tran/*.mvt                     PLATEAU 交通(道路)面 MVT
  osm/*.xml                      OpenStreetMap map API 取得結果
  dem/*.png                      地理院 DEM5A 標高タイル (無ければ取得)

出力:
  data/minatomirai.pack  (gzip されたバイナリコンテナ: JSON ヘッダ + 型付き配列)
"""
import json, os, sys, math, struct, gzip, glob, collections, urllib.request, re
import xml.etree.ElementTree as ET
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union, polygonize
from PIL import Image

WORK = os.environ.get("MM_WORK", "/tmp/mm")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "minatomirai.pack")

# ---- 座標系 --------------------------------------------------------------
GN = (-18292.7, -60134.6)          # 原点 = みなとみらい駅 (EPSG:6677 平面直角座標IX系)
BOX = (-1300, -1350, 1500, 1200)   # 対象範囲 (m, 原点相対)  x:東 y:北
ecef2geo = Transformer.from_crs("EPSG:4978", "EPSG:6667", always_xy=True)
geo2pl = Transformer.from_crs("EPSG:6668", "EPSG:6677", always_xy=True)
pl2geo = Transformer.from_crs("EPSG:6677", "EPSG:6668", always_xy=True)
wgs2pl = Transformer.from_crs("EPSG:4326", "EPSG:6677", always_xy=True)
BOXPOLY = box(*BOX)

def to_local(lon, lat):
    x, y = geo2pl.transform(lon, lat)
    return x - GN[0], y - GN[1]

def inbox(x, y):
    return BOX[0] <= x <= BOX[2] and BOX[1] <= y <= BOX[3]

def dm(v):
    return int(round(v * 10))

def ring_dm(coords):
    return [[dm(x), dm(y)] for x, y in coords]

# ---- 地形 (地理院 DEM5A) --------------------------------------------------
def fetch_dem():
    z = 15; n = 2 ** z
    def tx(lon): return int((lon + 180) / 360 * n)
    def ty(lat): return int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    lon0, lat0 = pl2geo.transform(BOX[0] + GN[0], BOX[1] + GN[1])
    lon1, lat1 = pl2geo.transform(BOX[2] + GN[0], BOX[3] + GN[1])
    os.makedirs(os.path.join(WORK, "dem"), exist_ok=True)
    tiles = {}
    for x in range(tx(lon0) - 1, tx(lon1) + 2):
        for y in range(ty(lat1) - 1, ty(lat0) + 2):
            fn = os.path.join(WORK, "dem", f"{z}_{x}_{y}.png")
            if not os.path.exists(fn):
                try:
                    data = urllib.request.urlopen(f"https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/{z}/{x}/{y}.png", timeout=60).read()
                    open(fn, "wb").write(data)
                except Exception as e:
                    open(fn, "wb").write(b"")
            if os.path.getsize(fn) > 0:
                tiles[(x, y)] = Image.open(fn).convert("RGB").load()
    def elev(lon, lat):
        fx = (lon + 180) / 360 * n
        fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
        x, y = int(fx), int(fy)
        px = tiles.get((x, y))
        if px is None: return 0.0
        r, g, b = px[min(255, int((fx - x) * 256)), min(255, int((fy - y) * 256))]
        if (r, g, b) == (128, 0, 0): return 0.0  # 無効値(海など)
        v = r * 65536 + g * 256 + b
        if v >= 2 ** 23: v -= 2 ** 24
        return v * 0.01
    return elev

STEP = 10.0
def build_terrain(elev):
    nx = int((BOX[2] - BOX[0]) / STEP) + 1
    ny = int((BOX[3] - BOX[1]) / STEP) + 1
    grid = []
    for j in range(ny):
        for i in range(nx):
            x = BOX[0] + i * STEP; y = BOX[1] + j * STEP
            lon, lat = pl2geo.transform(x + GN[0], y + GN[1])
            grid.append(max(-50, min(300, elev(lon, lat))))
    return {"x0": BOX[0], "y0": BOX[1], "step": STEP, "nx": nx, "ny": ny}, grid

def make_sampler(meta, grid):
    nx, ny, st = meta["nx"], meta["ny"], meta["step"]
    def f(x, y):
        fx = (x - meta["x0"]) / st; fy = (y - meta["y0"]) / st
        i = max(0, min(nx - 2, int(fx))); j = max(0, min(ny - 2, int(fy)))
        u = max(0, min(1, fx - i)); v = max(0, min(1, fy - j))
        a = grid[j * nx + i]; b = grid[j * nx + i + 1]; c = grid[(j + 1) * nx + i]; d = grid[(j + 1) * nx + i + 1]
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
    return f

# ---- PLATEAU メッシュ -----------------------------------------------------
def ensure_index(dec, idxfn):
    """地物 (gml_id) ごとに「最も頂点数の多いタイル」と重心緯度経度を記録した索引を作る。
    3D Tiles は refine=REPLACE で親タイルにも簡略版が入ることがあるため、重複を 1 つに絞る。"""
    fn = os.path.join(WORK, idxfn)
    if os.path.exists(fn):
        return json.load(open(fn))
    items = {}
    for f in dec:
        rtc = f["rtc"]; P = f["pos"]; bid = f["bid"]; B = f["batch"]; nb = f["batchLength"]
        nv = [0] * nb; first = [None] * nb
        for i, b in enumerate(bid):
            nv[b] += 1
            if first[b] is None: first[b] = i
        for b in range(nb):
            g = B["gml_id"][b]
            if first[b] is None or (g in items and items[g]["nv"] >= nv[b]): continue
            i0 = first[b] * 3
            lon, lat, h = ecef2geo.transform(rtc[0] + P[i0], rtc[1] - P[i0 + 2], rtc[2] + P[i0 + 1])
            items[g] = {"nv": nv[b], "lon": lon, "lat": lat, "file": f["file"]}
    json.dump(items, open(fn, "w"))
    return items

def load_meshes(decfn, idxfn, geoid_fn=None):
    """デコード済み b3dm から、範囲内の地物ごとに (頂点[local xyz], 三角形) を返す。"""
    dec = json.load(open(os.path.join(WORK, decfn)))
    idx = ensure_index(dec, idxfn)
    feats = {}
    for f in dec:
        rtc = f["rtc"]; P = f["pos"]; bid = f["bid"]; I = f["idx"]; B = f["batch"]; nb = f["batchLength"]
        gids = B["gml_id"]
        want = {}
        for b, g in enumerate(gids):
            v = idx.get(g)
            if not v or v["file"] != f["file"]: continue
            x, y = to_local(v["lon"], v["lat"])
            if inbox(x, y): want[b] = g
        if not want: continue
        conv = {}
        tris = collections.defaultdict(list)
        for k in range(0, len(I), 3):
            b = bid[I[k]]
            if b not in want: continue
            tri = []
            for j in (I[k], I[k + 1], I[k + 2]):
                if j not in conv:
                    x, y, z = P[j * 3], -P[j * 3 + 2], P[j * 3 + 1]      # glTF y-up -> ECEF z-up
                    lon, lat, h = ecef2geo.transform(rtc[0] + x, rtc[1] + y, rtc[2] + z)
                    lx, ly = to_local(lon, lat)
                    conv[j] = (lx, ly, h)
                tri.append(conv[j])
            tris[b].append(tri)
        for b, g in want.items():
            if not tris[b]: continue
            meta = {k: (B.get(k) or [None] * nb)[b] for k in ("gml:name", "bldg:measuredHeight", "brid:function", "brid:class")}
            feats[g] = {"tris": tris[b], "meta": meta}
    return feats

# 複数の部位 (PLATEAU では別地物) に分かれている大型施設を 1 棟として扱う名称
MERGE_NAMES = {"クイーンズスクエア横浜", "MARK IS minatomirai", "ランドマークプラザ", "横浜ランドマークタワー", "パシフィコ横浜", "パシフィコ横浜ノース",
               "Yokohama World Porters", "横浜美術館", "横浜市役所", "横浜ハンマーヘッド", "横浜ベイクォーター", "そごう横浜店", "横浜スカイビル", "コレットマーレ", "横浜ワールドポーターズ"}

def pack_meshes(feats, zoff, order=None, name_fn=None):
    """溶接・量子化し、地物ごとに三角形を並べたメッシュを作る。MERGE_NAMES の同名部位は 1 地物に統合する。"""
    vmap = {}; verts = []; idx = []; starts = []; metas = []
    keys = order or list(feats.keys())
    # 名前解決と統合グループ化
    names = {}
    for g in keys:
        f = feats[g]
        xs = [p[0] for t in f["tris"] for p in t]; ys = [p[1] for t in f["tris"] for p in t]
        names[g] = name_fn(g, f, sum(xs) / len(xs), sum(ys) / len(ys)) if name_fn else f["meta"].get("gml:name")
    groups = []; seen = {}
    for g in keys:
        n = names[g]
        if n in MERGE_NAMES:
            if n in seen: groups[seen[n]].append(g); continue
            seen[n] = len(groups)
        groups.append([g])
    merged = 0
    for grp in groups:
        if len(grp) > 1: merged += 1
        g = grp[0]
        f = {"tris": [t for k in grp for t in feats[k]["tris"]],
             "meta": {"gml:name": names[g], "bldg:measuredHeight": max((feats[k]["meta"].get("bldg:measuredHeight") or 0) for k in grp) or None,
                      "brid:function": feats[g]["meta"].get("brid:function"), "brid:class": feats[g]["meta"].get("brid:class")},
             "parts": len(grp)}
        starts.append(len(idx) // 3)
        xs = []; ys = []; zmin = 1e9; zmax = -1e9
        for tri in f["tris"]:
            for (x, y, h) in tri:
                q = (dm(x), dm(y), dm(h - zoff))
                zmin = min(zmin, h - zoff); zmax = max(zmax, h - zoff)
                xs.append(x); ys.append(y)
                vi = vmap.get(q)
                if vi is None:
                    vi = len(verts); vmap[q] = vi; verts.append(q)
                idx.append(vi)
        cx = sum(xs) / len(xs); cy = sum(ys) / len(ys)
        m = f["meta"]
        metas.append({
            "n": m.get("gml:name"), "parts": f.get("parts", 1),
            "h": m.get("bldg:measuredHeight"),
            "fn": m.get("brid:function"),
            "c": [dm(cx), dm(cy)], "z": [round(zmin, 1), round(zmax, 1)],
            "bb": [dm(min(xs)), dm(min(ys)), dm(max(xs)), dm(max(ys))],
        })
    starts.append(len(idx) // 3)
    if merged: print("  merged multi-part buildings:", merged)
    return verts, idx, starts, metas

# ---- OSM --------------------------------------------------------------------
def load_osm():
    nodes = {}; ways = {}; rels = {}
    for f in sorted(glob.glob(os.path.join(WORK, "osm", "*.xml"))):
        for ev, el in ET.iterparse(f):
            if el.tag == "node":
                nodes[el.get("id")] = (float(el.get("lon")), float(el.get("lat")), {t.get("k"): t.get("v") for t in el.findall("tag")})
            elif el.tag == "way":
                ways[el.get("id")] = ([n.get("ref") for n in el.findall("nd")], {t.get("k"): t.get("v") for t in el.findall("tag")})
            elif el.tag == "relation":
                rels[el.get("id")] = ([(m.get("type"), m.get("ref"), m.get("role")) for m in el.findall("member")], {t.get("k"): t.get("v") for t in el.findall("tag")})
            if el.tag in ("node", "way", "relation"): el.clear()
    return nodes, ways, rels

def way_coords(nodes, ways, w, cache):
    out = []
    for n in ways[w][0]:
        if n not in nodes: continue
        if n not in cache:
            lon, lat, _ = nodes[n]; cache[n] = to_local(lon, lat)
        out.append(cache[n])
    return out

RAIL_COLORS = [
    ("みなとみらい", "#3b8cff"), ("東横線", "#e8325a"), ("根岸線", "#19c2ff"), ("京浜東北", "#19c2ff"),
    ("東海道本線（横須賀線）", "#2a73d6"), ("横須賀", "#2a73d6"), ("東海道", "#ff9a2e"), ("京浜急行", "#ff4d4d"),
    ("相模鉄道", "#4f7bff"), ("3号線", "#2f6fdc"), ("1号線", "#2f6fdc"), ("高島線", "#8a93a6"),
]
def rail_color(name):
    for k, c in RAIL_COLORS:
        if name and k in name: return c
    return "#8a93a6"

LEVEL_H = {3: 17, 2: 12, 1: 6.5, 0: 0, -1: -6, -2: -12, -3: -18, -4: -24, -5: -30}

def way_level(t):
    lv = t.get("level")
    if lv is not None:
        try: return int(float(lv.split(";")[0]))
        except Exception: pass
    ly = t.get("layer")
    if ly is not None:
        try:
            l = int(ly)
            if l != 0 or t.get("bridge") or t.get("tunnel"): return l
        except Exception: pass
    if t.get("bridge") and t.get("bridge") != "no": return 1
    if t.get("tunnel") and t.get("tunnel") != "no": return -1
    return 0

def build_rails(nodes, ways, cache):
    out = []
    for w, (nd, t) in ways.items():
        if t.get("railway") not in ("rail", "subway", "light_rail"): continue
        if t.get("service") in ("yard", "siding", "spur", "crossover"): continue
        pts = way_coords(nodes, ways, w, cache)
        pts = [p for p in pts]
        if len(pts) < 2: continue
        if not any(inbox(*p) for p in pts): continue
        lv = way_level(t)
        lv = max(-5, min(3, lv))
        out.append({"n": t.get("name") or "", "c": rail_color(t.get("name")), "lv": lv, "p": ring_dm(pts)})
    return out

def build_roads_from_mvt():
    import mapbox_vector_tile as mvt
    z = 16; n = 2 ** z
    polys = []; seen = set()
    for fn in glob.glob(os.path.join(WORK, "tran", "16_*.mvt")):
        _, x, y = os.path.basename(fn)[:-4].split("_"); x = int(x); y = int(y)
        data = open(fn, "rb").read()
        if not data: continue
        d = mvt.decode(data)
        for layer, v in d.items():
            ext = v.get("extent", 4096)
            def t2ll(px, py):
                lon = (x + px / ext) / n * 360 - 180
                yy = (y + (1 - py / ext)) / n
                return lon, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy))))
            for f in v["features"]:
                gid = f["properties"].get("gml_id")
                if gid in seen: continue
                seen.add(gid)
                g = f["geometry"]
                rings = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
                for poly in rings:
                    try:
                        shp = Polygon([to_local(*t2ll(px, py)) for px, py in poly[0]], [[to_local(*t2ll(px, py)) for px, py in r] for r in poly[1:]])
                        shp = shp.buffer(0).intersection(BOXPOLY)
                    except Exception:
                        continue
                    for p in (shp.geoms if hasattr(shp, "geoms") else [shp]):
                        if p.is_empty or p.area < 4 or p.geom_type != "Polygon": continue
                        polys.append([ring_dm(p.exterior.coords[:-1])] + [ring_dm(i.coords[:-1]) for i in p.interiors])
    return polys

POI_KEYS = ("shop", "amenity", "office", "craft", "tourism", "leisure", "healthcare")
POI_SKIP = {"parking", "bicycle_parking", "bicycle_rental", "information", "artwork", "toilets", "vending_machine", "atm", "bench", "waste_basket", "parking_entrance", "motorcycle_parking", "charging_station", "viewpoint", "pitch", "park", "garden", "playground", "fountain", "drinking_water", "post_box", "telephone", "taxi", "bus_station", "ferry_terminal", "shelter", "car_sharing", "loading_dock", "smoking_area", "bicycle_repair_station", "apartment", "apartments", "yes"}
CATEGORY = {  # (OSM キー, 値) -> 用途カテゴリ
    "飲食": {"restaurant", "cafe", "pub", "bar", "fast_food", "bakery", "ice_cream", "food_court", "biergarten", "confectionery", "pastry", "tea", "coffee", "wine", "alcohol", "beverages", "seafood", "deli"},
    "医療": {"doctors", "dentist", "pharmacy", "clinic", "hospital", "optician", "chemist", "veterinary", "massage", "physiotherapist"},
    "公共": {"government", "townhall", "post_office", "police", "library", "museum", "community_centre", "public_building", "courthouse", "fire_station", "embassy", "social_facility", "university", "college", "school", "kindergarten", "place_of_worship", "theatre", "cinema", "arts_centre", "gallery", "attraction", "zoo", "aquarium", "exhibition_centre", "conference_centre", "events_venue", "fitness_centre", "sports_centre"},
    "宿泊": {"hotel", "hostel", "guest_house", "motel", "apartment"},
    "サービス": {"hairdresser", "beauty", "bank", "estate_agent", "travel_agency", "dry_cleaning", "laundry", "car_rental", "insurance", "lawyer", "accountant", "tattoo", "nails", "photo", "copyshop", "money_lender", "bureau_de_change", "driving_school", "language_school", "music_school", "childcare", "coworking", "fitness", "gym", "yoga"},
}
def poi_category(g, k):
    for cat, vals in CATEGORY.items():
        if k in vals: return cat
    if g == "shop": return "物販"
    if g == "office": return "オフィス"
    if g == "craft": return "サービス"
    if g in ("tourism", "leisure"): return "公共"
    if g == "healthcare": return "医療"
    return "その他"

def build_poi(nodes, ways, cache):
    """OSM の名前つき店舗・施設 POI。level タグがあれば階層 (整数) を持つ。"""
    out = []
    def kind(t):
        for k in POI_KEYS:
            v = t.get(k)
            if v and v not in POI_SKIP: return k, v
        return None, None
    def lv_of(t):
        v = t.get("level")
        if v is None: return None
        try: return int(float(v.split(";")[0].split("-")[0]))
        except Exception: return None
    for nid, (lon, lat, t) in nodes.items():
        if not t.get("name"): continue
        k, v = kind(t)
        if not k: continue
        x, y = to_local(lon, lat)
        if not inbox(x, y): continue
        out.append({"n": t["name"], "k": v, "g": k, "c": poi_category(k, v), "lv": lv_of(t), "x": dm(x), "y": dm(y)})
    for w, (nd, t) in ways.items():
        if not t.get("name") or "building" in t: continue
        k, v = kind(t)
        if not k: continue
        pts = way_coords(nodes, ways, w, cache)
        if not pts: continue
        x = sum(p[0] for p in pts) / len(pts); y = sum(p[1] for p in pts) / len(pts)
        if not inbox(x, y): continue
        out.append({"n": t["name"], "k": v, "g": k, "c": poi_category(k, v), "lv": lv_of(t), "x": dm(x), "y": dm(y)})
    return out

def assign_poi_to_buildings(pois, bmetas):
    """POI を、その位置を含む最小 bbox の建物に割り当てる (b: 建物番号, 無ければ -1)。"""
    for p in pois:
        best = -1; barea = 1e18
        for i, m in enumerate(bmetas):
            bb = m["bb"]
            if bb[0] <= p["x"] <= bb[2] and bb[1] <= p["y"] <= bb[3]:
                a = (bb[2] - bb[0]) * (bb[3] - bb[1])
                if a < barea: barea = a; best = i
        p["b"] = best
    return pois

def build_trees(nodes, ways, cache):
    """街路樹・樹木 (natural=tree, tree_row 上に 8m 間隔) と街灯 (highway=street_lamp)。[x, y, kind] kind 0=樹木 1=街灯"""
    out = []
    for nid, (lon, lat, t) in nodes.items():
        k = 0 if t.get("natural") == "tree" else 1 if t.get("highway") == "street_lamp" else None
        if k is None: continue
        x, y = to_local(lon, lat)
        if inbox(x, y): out.append([dm(x), dm(y), k])
    for w, (nd, t) in ways.items():
        if t.get("natural") != "tree_row": continue
        pts = way_coords(nodes, ways, w, cache); acc = 0.0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            L = math.hypot(x1 - x0, y1 - y0)
            if L == 0: continue
            while acc <= L:
                x = x0 + (x1 - x0) * acc / L; y = y0 + (y1 - y0) * acc / L
                if inbox(x, y): out.append([dm(x), dm(y), 0])
                acc += 8.0
            acc -= L
    return out

def build_green(nodes, ways, rels, cache):
    """公園・緑地 (OSM leisure=park/garden, landuse=grass/recreation_ground, natural=wood/scrub)。"""
    polys = []
    def ok(t):
        return t.get("leisure") in ("park", "garden", "pitch", "playground") or t.get("landuse") in ("grass", "recreation_ground", "forest", "meadow", "cemetery") or t.get("natural") in ("wood", "scrub", "grassland")
    for w, (nd, t) in ways.items():
        if ok(t) and nd[0] == nd[-1]:
            pts = way_coords(nodes, ways, w, cache)
            if len(pts) > 3:
                try: polys.append(Polygon(pts).buffer(0))
                except Exception: pass
    for r, (m, t) in rels.items():
        if t.get("type") == "multipolygon" and ok(t):
            for ty, ref, role in m:
                if ty == "way" and ref in ways and role in ("outer", ""):
                    pts = way_coords(nodes, ways, ref, cache)
                    if len(pts) > 3 and pts[0] == pts[-1]:
                        try: polys.append(Polygon(pts).buffer(0))
                        except Exception: pass
    g = unary_union(polys).intersection(BOXPOLY)
    out = []
    for q in (g.geoms if hasattr(g, "geoms") else [g]):
        if q.is_empty or q.geom_type != "Polygon" or q.area < 30: continue
        out.append([ring_dm(q.exterior.coords[:-1])] + [ring_dm(i.coords[:-1]) for i in q.interiors])
    return out

def build_water(nodes, ways, rels, cache):
    coast = []; inland = []
    for w, (nd, t) in ways.items():
        pts = None
        if t.get("natural") == "coastline":
            pts = way_coords(nodes, ways, w, cache)
            if len(pts) > 1: coast.append(LineString(pts))
        elif (t.get("natural") == "water" or t.get("waterway") in ("riverbank", "dock")) and nd[0] == nd[-1]:
            pts = way_coords(nodes, ways, w, cache)
            if len(pts) > 3:
                try: inland.append(Polygon(pts).buffer(0))
                except Exception: pass
    for r, (m, t) in rels.items():
        if t.get("type") == "multipolygon" and t.get("natural") == "water":
            outer = []
            for ty, ref, role in m:
                if ty == "way" and ref in ways and role in ("outer", "", None):
                    pts = way_coords(nodes, ways, ref, cache)
                    if len(pts) > 3 and pts[0] == pts[-1]: outer.append(Polygon(pts).buffer(0))
            inland += outer
    # 外枠は OSM 取得範囲より小さくする (海岸線が枠内で途切れると面に分割されない)
    big = box(BOX[0] - 60, BOX[1] - 60, BOX[2] + 60, BOX[3] + 60)
    # 海岸線は外枠で切り、端点が必ず枠上に来るようにする (枠内で途切れると面に分割されない)
    clipped = []
    for ls in coast:
        g = ls.intersection(big)
        for part in (g.geoms if hasattr(g, "geoms") else [g]):
            if part.geom_type == "LineString" and part.length > 0: clipped.append(part)
    coast = clipped
    polys = list(polygonize(unary_union([big.boundary] + coast)))
    def side_pt(ls, sign, dist=3):
        c = list(ls.coords); k = len(c) // 2
        (x1, y1), (x2, y2) = c[k - 1], c[k]; dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1
        return Point((x1 + x2) / 2 + sign * dy / L * dist, (y1 + y2) / 2 - sign * dx / L * dist)
    water = []
    for p in polys:
        score = 0
        for ls in coast:
            if ls.intersects(p.buffer(1)):
                if p.contains(side_pt(ls, +1)): score += 1       # OSM: 海は進行方向右側
                elif p.contains(side_pt(ls, -1)): score -= 1
        if score > 0: water.append(p)
    sea = unary_union(water).intersection(BOXPOLY)
    inl = unary_union(inland).intersection(BOXPOLY)
    def rings(g):
        out = []
        for p in (g.geoms if hasattr(g, "geoms") else [g]):
            if p.is_empty or p.geom_type != "Polygon": continue
            out.append([ring_dm(p.exterior.coords[:-1])] + [ring_dm(i.coords[:-1]) for i in p.interiors])
        return out
    return {"sea": rings(sea), "inland": rings(inl)}

VTYPE = {None: 0, "stairs": 1, "esc": 2, "elev": 3, "slope": 4}

def build_network(nodes, ways, cache, elev_fn):
    """OSM 歩行者系ウェイから多層ネットワーク (ノード=階層付き, リンク) を作る。"""
    ped = []
    for w, (nd, t) in ways.items():
        h = t.get("highway")
        if h not in ("footway", "steps", "pedestrian", "path", "corridor", "elevator", "living_street"):
            continue
        if t.get("area") == "yes": continue
        pts = way_coords(nodes, ways, w, cache)
        if len(pts) < 2 or not any(inbox(*p) for p in pts): continue
        if h == "elevator" or t.get("conveying") in ("yes", "forward", "backward", "reversible"):
            vt = "elev" if h == "elevator" else "esc"
        elif h == "steps":
            vt = "stairs"
        elif t.get("incline") and t.get("incline") not in ("0", "0%"):
            vt = "slope" if t.get("ramp") or t.get("footway") == "ramp" else None
        else:
            vt = None
        ped.append({"id": w, "nodes": [n for n in nd if n in nodes], "pts": pts, "lv": way_level(t), "vt": vt, "oneway": t.get("oneway") in ("yes", "1") and vt == "esc"})
    # ノードの階層 (非垂直ウェイの多数決)。複数階層が混在する場合は階層ごとにノードを分割。
    lv_votes = collections.defaultdict(collections.Counter)
    for w in ped:
        if w["vt"] in (None, "slope"):
            for n in w["nodes"]: lv_votes[n][w["lv"]] += 1
    elevator_nodes = {n for n, (lon, lat, t) in nodes.items() if t.get("highway") == "elevator"}
    node_ids = {}        # (osm node, level) -> index
    node_list = []       # [x, y, level]
    def node_at(n, lv):
        key = (n, lv)
        if key not in node_ids:
            node_ids[key] = len(node_list)
            x, y = cache[n] if n in cache else to_local(nodes[n][0], nodes[n][1])
            node_list.append([x, y, lv])
        return node_ids[key]
    links = []
    for w in ped:
        nd = w["nodes"]
        if w["vt"] in (None, "slope"):
            # 平面ウェイ: 全ノードをウェイの階層に置く
            seq = [node_at(n, w["lv"]) for n in nd]
            levels = [w["lv"]] * len(nd)
        else:
            # 垂直ウェイ: 端点の階層は接続する平面ウェイから推定、中間は補間
            def end_level(n, other):
                v = lv_votes.get(n)
                if v:
                    cand = [l for l, c in v.most_common()]
                    # 他端と異なる階層を優先
                    for l in cand:
                        if l != other: return l
                    return cand[0]
                return None
            la = end_level(nd[0], None); lb = end_level(nd[-1], la)
            if la is None and lb is None: la = lb = w["lv"]
            elif la is None: la = lb if lb != w["lv"] else w["lv"]
            elif lb is None: lb = la if la != w["lv"] else w["lv"]
            if la == lb and w["vt"] in ("stairs", "esc", "elev"):
                # 階層差のない階段は同一階層内の段差として扱う
                pass
            seq = []
            for i, n in enumerate(nd):
                if i == 0: seq.append(node_at(n, la))
                elif i == len(nd) - 1: seq.append(node_at(n, lb))
                else: seq.append(node_at(n, la))
            levels = None
        for i in range(len(seq) - 1):
            a, b = seq[i], seq[i + 1]
            if a == b: continue
            links.append({"a": a, "b": b, "vt": w["vt"], "p": [w["pts"][i], w["pts"][i + 1]], "ow": w["oneway"]})
    # 同一OSMノードが複数階層に分割されている場合、階層間を接続 (エレベーターなら elev, それ以外は stairs)
    by_node = collections.defaultdict(list)
    for (n, lv), i in node_ids.items(): by_node[n].append((lv, i))
    for n, lst in by_node.items():
        if len(lst) < 2: continue
        lst.sort()
        vt = "elev" if n in elevator_nodes else "stairs"
        for (l1, i1), (l2, i2) in zip(lst, lst[1:]):
            x, y, _ = node_list[i1]
            links.append({"a": i1, "b": i2, "vt": vt, "p": [(x, y), (x, y)], "ow": False})
    # 連結成分で小さいものを除外
    adj = collections.defaultdict(set)
    for l in links: adj[l["a"]].add(l["b"]); adj[l["b"]].add(l["a"])
    comp = {}; cid = 0
    for s in range(len(node_list)):
        if s in comp: continue
        st = [s]; comp[s] = cid; members = [s]
        while st:
            x = st.pop()
            for y in adj[x]:
                if y not in comp: comp[y] = cid; st.append(y); members.append(y)
        cid += 1
    size = collections.Counter(comp.values())
    keep = {i for i in range(len(node_list)) if size[comp[i]] >= 12}
    remap = {}; out_nodes = []
    for i in sorted(keep):
        remap[i] = len(out_nodes); x, y, lv = node_list[i]
        out_nodes.append([dm(x), dm(y), lv])
    out_links = []
    for l in links:
        if l["a"] in keep and l["b"] in keep:
            out_links.append([remap[l["a"]], remap[l["b"]], VTYPE[l["vt"]], 1 if l["ow"] else 0] + [c for p in l["p"] for c in (dm(p[0]), dm(p[1]))])
    return out_nodes, out_links

# ---- 駅 構内 近似モデル -----------------------------------------------------
def rect(cx, cy, dx, dy, length, width, along=0.0, across=0.0):
    """中心(cx,cy)から軸(dx,dy)方向に along, 直交方向に across ずらした長方形 (長さ length, 幅 width)。"""
    L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; vx, vy = -uy, ux
    cx += ux * along + vx * across; cy += uy * along + vy * across
    hl, hw = length / 2, width / 2
    return [[cx + ux * s * hl + vx * t * hw, cy + uy * s * hl + vy * t * hw] for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

def station_models(osm_platforms):
    """各駅の階層ごとの空間 (近似) とネットワークノード/リンクを返す。"""
    spaces = []   # {st, lv, cat, name, ring}
    snodes = []   # [x, y, lv]
    slinks = []   # [a, b, vtype]
    labels = []
    def add_space(st, lv, cat, name, ring): spaces.append({"st": st, "lv": lv, "cat": cat, "n": name, "r": ring})
    def add_node(x, y, lv):
        snodes.append([x, y, lv]); return len(snodes) - 1
    def link(a, b, vt): slinks.append([a, b, VTYPE[vt]])

    # --- みなとみらい駅 (島式1面2線, ホーム B4, 改札 B3[QS側]/B2[美術館側], 吹抜け B4→GL) ---
    cx, cy, dx, dy = 105.0, -67.0, 94.0, -140.0
    st = "みなとみらい駅"
    plat = next((p for p in osm_platforms if p["lv"] == -4 and math.hypot(p["c"][0] - cx, p["c"][1] - cy) < 80), None)
    add_space(st, -4, "platform", "みなとみらい駅 ホーム (B4)", plat["r"] if plat else rect(cx, cy, dx, dy, 165, 12))
    add_space(st, -3, "concourse", "B3 コンコース", rect(cx, cy, dx, dy, 200, 52))
    add_space(st, -3, "gate", "改札 (クイーンズスクエア側)", rect(cx, cy, dx, dy, 14, 30, along=48))
    add_space(st, -3, "void", "吹抜け (B4→地上)", rect(cx, cy, dx, dy, 60, 26, along=62, across=0))
    add_space(st, -3, "esc", "ESC ホーム↔B3", rect(cx, cy, dx, dy, 16, 5, along=-60, across=4))
    add_space(st, -3, "esc", "ESC ホーム↔B3", rect(cx, cy, dx, dy, 16, 5, along=30, across=-4))
    add_space(st, -3, "elev", "EV ホーム↔B3", rect(cx, cy, dx, dy, 5, 5, along=0, across=6))
    add_space(st, -3, "toilet", "トイレ", rect(cx, cy, dx, dy, 14, 8, along=-30, across=18))
    add_space(st, -2, "concourse", "B2 コンコース (美術館側)", rect(cx, cy, dx, dy, 90, 40, along=-55))
    add_space(st, -2, "gate", "改札 (美術館側)", rect(cx, cy, dx, dy, 12, 24, along=-40))
    add_space(st, -2, "void", "吹抜け", rect(cx, cy, dx, dy, 60, 26, along=62))
    add_space(st, -2, "concourse", "B2 クイーンズスクエア連絡", rect(cx, cy, dx, dy, 70, 40, along=62, across=22))
    add_space(st, -2, "esc", "ESC B3↔B2", rect(cx, cy, dx, dy, 16, 5, along=-20, across=0))
    add_space(st, -2, "esc", "ESC B3↔B2 (吹抜け)", rect(cx, cy, dx, dy, 18, 5, along=62, across=16))
    add_space(st, -1, "concourse", "B1 クイーンズスクエア連絡口", rect(cx, cy, dx, dy, 70, 40, along=62, across=22))
    add_space(st, -1, "void", "吹抜け", rect(cx, cy, dx, dy, 60, 26, along=62))
    add_space(st, -1, "concourse", "B1 マークイズ連絡口", rect(cx, cy, dx, dy, 40, 12, along=-100, across=-10))
    add_space(st, -1, "esc", "ESC B2↔B1", rect(cx, cy, dx, dy, 18, 5, along=62, across=16))
    add_space(st, -1, "esc", "ESC B2↔B1 (美術館側)", rect(cx, cy, dx, dy, 16, 5, along=-80, across=-10))
    # ネットワーク
    def P(along, across=0.0):
        L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; vx, vy = -uy, ux
        return cx + ux * along + vx * across, cy + uy * along + vy * across
    p_sw = add_node(*P(-60), -4); p_c = add_node(*P(0), -4); p_ne = add_node(*P(60), -4)
    link(p_sw, p_c, None); link(p_c, p_ne, None)
    c3_sw = add_node(*P(-60, 4), -3); c3_c = add_node(*P(0, 6), -3); c3_ne = add_node(*P(48), -3); c3_void = add_node(*P(62, 16), -3)
    link(p_sw, c3_sw, "esc"); link(p_ne, c3_ne, "esc"); link(p_c, c3_c, "elev")
    link(c3_sw, c3_c, None); link(c3_c, c3_ne, None); link(c3_ne, c3_void, None)
    c2_mus = add_node(*P(-40), -2); c2_mid = add_node(*P(-20), -2); c2_void = add_node(*P(62, 16), -2); c2_qs = add_node(*P(80, 30), -2)
    link(c3_sw, c2_mid, "esc"); link(c2_mid, c2_mus, None); link(c3_void, c2_void, "esc"); link(c2_void, c2_qs, None)
    b1_qs = add_node(*P(62, 16), -1); b1_qs2 = add_node(*P(85, 32), -1); b1_mark = add_node(*P(-80, -10), -1); b1_mark2 = add_node(*P(-115, -14), -1)
    link(c2_void, b1_qs, "esc"); link(b1_qs, b1_qs2, None); link(c2_mus, b1_mark, "esc"); link(b1_mark, b1_mark2, None)
    b1_east = add_node(*P(40, -20), -1); link(c2_mid, b1_east, "esc")
    exits = [(P(62, 40), b1_qs2, "esc"), (P(-125, -14), b1_mark2, "stairs"), (P(-45, 30), c2_mus, "esc"), (P(-45, -30), c2_mus, "stairs"), (P(25, -32), b1_east, "stairs"), (P(95, -10), b1_qs2, "stairs"), (P(0, 34), c3_c, "elev")]
    add_space(st, -1, "concourse", "B1 連絡通路 (東側)", rect(cx, cy, dx, dy, 40, 10, along=30, across=-20))
    add_space(st, -1, "esc", "ESC B2↔B1", rect(cx, cy, dx, dy, 16, 5, along=-5, across=-14))
    exit_nodes = []
    for (x, y), frm, vt in exits:
        e = add_node(x, y, 0); link(frm, e, vt); exit_nodes.append(e)
        add_space(st, 0, "stairs" if vt != "elev" else "elev", "出入口", rect(x, y, dx, dy, 8, 5))
    labels.append({"n": "みなとみらい駅", "p": [cx, cy], "h": 6, "kind": "station"})

    # --- 新高島駅 (相対式2面2線, ホーム B5, 改札 B2) ---
    st = "新高島駅"; cx, cy, dx, dy = -444.0, 460.0, 1.0, 0.03
    plats = [p for p in osm_platforms if p["lv"] == -5 and math.hypot(p["c"][0] - cx, p["c"][1] - cy) < 60]
    if plats:
        for p in plats: add_space(st, -5, "platform", "新高島駅 ホーム (B5)", p["r"])
    else:
        add_space(st, -5, "platform", "新高島駅 ホーム (B5)", rect(cx, cy, dx, dy, 165, 8, across=8))
        add_space(st, -5, "platform", "新高島駅 ホーム (B5)", rect(cx, cy, dx, dy, 165, 8, across=-8))
    add_space(st, -2, "concourse", "B2 コンコース", rect(cx, cy, dx, dy, 110, 44))
    add_space(st, -2, "gate", "改札", rect(cx, cy, dx, dy, 12, 26))
    add_space(st, -2, "esc", "ESC ホーム↔B2", rect(cx, cy, dx, dy, 16, 5, along=-40, across=8))
    add_space(st, -2, "esc", "ESC ホーム↔B2", rect(cx, cy, dx, dy, 16, 5, along=40, across=-8))
    add_space(st, -2, "elev", "EV", rect(cx, cy, dx, dy, 5, 5, across=14))
    pa = add_node(cx - 40, cy + 8, -5); pb = add_node(cx + 40, cy - 8, -5); pc = add_node(cx, cy + 8, -5); pd = add_node(cx, cy - 8, -5)
    link(pa, pc, None); link(pd, pb, None)
    ca = add_node(cx - 40, cy + 8, -2); cb = add_node(cx + 40, cy - 8, -2); cc = add_node(cx, cy, -2)
    link(pa, ca, "esc"); link(pb, cb, "esc"); link(pc, cc, "elev"); link(pd, cc, "elev"); link(ca, cc, None); link(cc, cb, None)
    for (x, y) in [(cx - 70, cy + 30), (cx - 70, cy - 30), (cx + 70, cy + 30), (cx + 70, cy - 30)]:
        e = add_node(x, y, 0); link(ca if x < cx else cb, e, "stairs"); exit_nodes.append(e)
        add_space(st, 0, "stairs", "出入口", rect(x, y, dx, dy, 8, 5))
    labels.append({"n": "新高島駅", "p": [cx, cy], "h": 6, "kind": "station"})

    # --- 馬車道駅 (島式1面2線, ホーム B3, 改札 B2) ---
    st = "馬車道駅"; cx, cy, dx, dy = 420.0, -858.0, -54.0, 32.0
    add_space(st, -3, "platform", "馬車道駅 ホーム (B3)", rect(cx, cy, dx, dy, 160, 11))
    add_space(st, -2, "concourse", "B2 コンコース", rect(cx, cy, dx, dy, 120, 44))
    add_space(st, -2, "gate", "改札", rect(cx, cy, dx, dy, 12, 26, along=10))
    add_space(st, -2, "esc", "ESC ホーム↔B2", rect(cx, cy, dx, dy, 16, 5, along=-45, across=4))
    add_space(st, -2, "esc", "ESC ホーム↔B2", rect(cx, cy, dx, dy, 16, 5, along=45, across=-4))
    add_space(st, -2, "elev", "EV", rect(cx, cy, dx, dy, 5, 5, across=10))
    def Q(along, across=0.0):
        L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; vx, vy = -uy, ux
        return cx + ux * along + vx * across, cy + uy * along + vy * across
    pa = add_node(*Q(-45), -3); pc = add_node(*Q(0), -3); pb = add_node(*Q(45), -3)
    link(pa, pc, None); link(pc, pb, None)
    ca = add_node(*Q(-45, 4), -2); cc = add_node(*Q(0, 8), -2); cb = add_node(*Q(45, -4), -2)
    link(pa, ca, "esc"); link(pb, cb, "esc"); link(pc, cc, "elev"); link(ca, cc, None); link(cc, cb, None)
    for along, across, frm in [(-75, 25, ca), (-75, -25, ca), (75, 25, cb), (75, -25, cb), (0, 40, cc), (0, -40, cc)]:
        x, y = Q(along, across); e = add_node(x, y, 0); link(frm, e, "stairs"); exit_nodes.append(e)
        add_space(st, 0, "stairs", "出入口", rect(x, y, dx, dy, 8, 5))
    labels.append({"n": "馬車道駅", "p": [cx, cy], "h": 6, "kind": "station"})

    # --- 桜木町駅 (JR 高架ホーム, ブルーライン B2) ---
    st = "桜木町駅"
    for p in osm_platforms:
        if p["layer"] == 2 and math.hypot(p["c"][0] + 70, p["c"][1] + 760) < 120:
            add_space(st, 1, "platform", "JR桜木町駅 ホーム (高架)", p["r"])
    cx, cy, dx, dy = -93.0, -906.0, -20.0, -100.0
    add_space(st, -2, "platform", "ブルーライン桜木町駅 ホーム (B2)", rect(cx, cy, dx, dy, 130, 10))
    add_space(st, -1, "concourse", "B1 コンコース", rect(cx, cy, dx, dy, 90, 36))
    add_space(st, -1, "gate", "改札", rect(cx, cy, dx, dy, 12, 22))
    add_space(st, -1, "esc", "ESC", rect(cx, cy, dx, dy, 16, 5, along=-35, across=4))
    add_space(st, -1, "esc", "ESC", rect(cx, cy, dx, dy, 16, 5, along=35, across=-4))
    def R(along, across=0.0):
        L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; vx, vy = -uy, ux
        return cx + ux * along + vx * across, cy + uy * along + vy * across
    pa = add_node(*R(-35), -2); pb = add_node(*R(35), -2); link(pa, pb, None)
    ca = add_node(*R(-35, 4), -1); cb = add_node(*R(35, -4), -1); link(pa, ca, "esc"); link(pb, cb, "esc"); link(ca, cb, None)
    for along, across, frm in [(-60, 20, ca), (60, -20, cb), (0, 30, ca)]:
        x, y = R(along, across); e = add_node(x, y, 0); link(frm, e, "stairs"); exit_nodes.append(e)
        add_space(st, 0, "stairs", "出入口", rect(x, y, dx, dy, 8, 5))
    labels.append({"n": "桜木町駅", "p": [-60, -760], "h": 10, "kind": "station"})

    # --- 高島町駅 (ブルーライン, 相対式 B2) ---
    st = "高島町駅"; cx, cy, dx, dy = -720.0, 74.0, 60.0, 100.0
    add_space(st, -2, "platform", "高島町駅 ホーム (B2)", rect(cx, cy, dx, dy, 130, 7, across=7))
    add_space(st, -2, "platform", "高島町駅 ホーム (B2)", rect(cx, cy, dx, dy, 130, 7, across=-7))
    add_space(st, -1, "concourse", "B1 コンコース", rect(cx, cy, dx, dy, 60, 34))
    add_space(st, -1, "gate", "改札", rect(cx, cy, dx, dy, 10, 20))
    def S(along, across=0.0):
        L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; vx, vy = -uy, ux
        return cx + ux * along + vx * across, cy + uy * along + vy * across
    pa = add_node(*S(0, 7), -2); pb = add_node(*S(0, -7), -2); ca = add_node(*S(0, 0), -1)
    link(pa, ca, "stairs"); link(pb, ca, "stairs")
    for along, across in [(-45, 0), (45, 0)]:
        x, y = S(along, across); e = add_node(x, y, 0); link(ca, e, "stairs"); exit_nodes.append(e)
        add_space(st, 0, "stairs", "出入口", rect(x, y, dx, dy, 8, 5))
    labels.append({"n": "高島町駅", "p": [cx, cy], "h": 6, "kind": "station"})

    # --- 横浜駅 (地平ホームのみ OSM 形状) ---
    for p in osm_platforms:
        if p["lv"] is None and p["layer"] is None and math.hypot(p["c"][0] + 880, p["c"][1] - 900) < 260:
            add_space("横浜駅", 0, "platform", "横浜駅 ホーム", p["r"])
    labels.append({"n": "横浜駅", "p": [-880, 900], "h": 10, "kind": "station"})
    return spaces, snodes, slinks, exit_nodes, labels

# ---- ラベル ----------------------------------------------------------------
LANDMARKS = [
    ("横浜ランドマークタワー", r"^横浜ランドマークタワー$"), ("クイーンズタワーA", r"クイーンズタワーA"), ("クイーンズタワーB", r"クイーンズタワーB"),
    ("クイーンズタワーC", r"クイーンズタワーC"), ("パシフィコ横浜", r"^パシフィコ横浜$"), ("パシフィコ横浜ノース", r"ノース"),
    ("インターコンチネンタル", r"インターコンチネンタル"), ("横浜美術館", r"^横浜美術館$"), ("MARK IS みなとみらい", r"MARK IS"),
    ("日産グローバル本社", r"日産自動車グローバル本社"), ("横浜赤レンガ倉庫", r"赤レンガ倉庫1号館"), ("ワールドポーターズ", r"World Porters"),
    ("コスモクロック21", r"コスモクロック21"), ("カップヌードルミュージアム", r"Cupnoodles"), ("横浜市役所", r"^横浜市役所$"),
    ("ザ・タワー横浜北仲", r"ザ・タワー横浜北仲"), ("横濱ゲートタワー", r"^横濱ゲートタワー$"), ("横浜ベイホテル東急", r"^横浜ベイホテル東急$"),
    ("資生堂 S/PARK", r"S/PARK"), ("京急グループ本社", r"^京急グループ本社$"), ("村田製作所", r"^村田製作所 みなとみらい"),
    ("富士フイルム", r"富士フイルムビジネスイノベーション"), ("LG横浜", r"^LG YOKOHAMA"), ("横浜銀行本店", r"^横浜銀行本店ビル$"),
    ("日本丸", r"^日本丸$"), ("横浜ハンマーヘッド", r"横浜ハンマーヘッド"), ("アパホテル横浜ベイタワー", r"アパホテル"),
    ("横浜アイマークプレイス", r"横浜アイマークプレイス"), ("万葉倶楽部", r"万葉倶楽部"), ("横浜税関", r"^横浜税関$"),
    ("ランドマークプラザ", r"^ランドマークプラザ$"), ("ザ・カハラ・ホテル", r"カハラ"), ("横浜ベイシェラトン", r"ベイシェラトン"),
    ("三菱重工横浜ビル", r"^三菱重工横浜ビル$"), ("そごう横浜店", r"そごう美術館"),
]

def osm_named_polys(nodes, ways, rels, cache):
    out = []
    def add(name, pts, t):
        if len(pts) > 3:
            try:
                p = Polygon(pts).buffer(0)
                if not p.is_empty: out.append({"n": name, "poly": p, "h": t.get("height"), "lv": t.get("building:levels")})
            except Exception: pass
    for w, (nd, t) in ways.items():
        n = t.get("name")
        if n and ("building" in t or t.get("attraction") or t.get("man_made") in ("tower",)) and nd[0] == nd[-1]:
            add(n, way_coords(nodes, ways, w, cache), t)
    for r, (m, t) in rels.items():
        n = t.get("name")
        if n and t.get("type") == "multipolygon" and "building" in t:
            pts = []
            for ty, ref, role in m:
                if ty == "way" and ref in ways and role == "outer":
                    c = way_coords(nodes, ways, ref, cache)
                    if len(c) > 3 and c[0] == c[-1]: add(n, c, t)
    return out

# ---- コンテナ書き出し --------------------------------------------------------
def write_pack(header, blobs, fn):
    body = b""
    for name, (arr, fmt) in blobs.items():
        data = struct.pack("<%d%s" % (len(arr), fmt), *arr)
        header.setdefault("blobs", {})[name] = {"offset": len(body), "length": len(arr), "fmt": fmt}
        body += data
    hj = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    raw = struct.pack("<I", len(hj)) + hj + body
    gz = gzip.compress(raw, 9)
    os.makedirs(os.path.dirname(fn), exist_ok=True)
    open(fn, "wb").write(gz)
    return len(raw), len(gz)

def main():
    print("terrain ..."); elev = fetch_dem(); tmeta, tgrid = build_terrain(elev); tsample = make_sampler(tmeta, tgrid)
    print("  grid", tmeta["nx"], "x", tmeta["ny"], "min/max", min(tgrid), max(tgrid))

    print("osm ..."); nodes, ways, rels = load_osm(); cache = {}
    named = osm_named_polys(nodes, ways, rels, cache)
    print("  named polys", len(named))

    print("buildings ..."); bfeats = load_meshes("dec_lod3.json", "idx_lod3.json")
    # ジオイド高の推定: 建物最下点(楕円体高) - DEM標高 の中央値
    diffs = []
    for g, f in bfeats.items():
        xs = [p[0] for t in f["tris"] for p in t]; ys = [p[1] for t in f["tris"] for p in t]; hs = [p[2] for t in f["tris"] for p in t]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        diffs.append(min(hs) - tsample(cx, cy))
    diffs.sort(); zoff = diffs[len(diffs) // 2]
    print("  buildings in box", len(bfeats), "geoid offset", round(zoff, 2))
    # 名前: OSM 多角形に重心が含まれればその名前を優先
    from shapely.strtree import STRtree
    tree = STRtree([n["poly"] for n in named])
    def name_fn(g, f, cx, cy):
        pt = Point(cx, cy)
        hit = [named[i] for i in tree.query(pt) if named[i]["poly"].contains(pt)]
        if hit:
            hit.sort(key=lambda n: n["poly"].area)
            return hit[0]["n"]
        return f["meta"].get("gml:name")
    order = sorted(bfeats.keys(), key=lambda g: -(bfeats[g]["meta"].get("bldg:measuredHeight") or 0))
    bverts, bidx, bstarts, bmetas = pack_meshes(bfeats, zoff, order, name_fn)
    print("  verts", len(bverts), "tris", len(bidx) // 3)

    print("bridges ..."); brf = load_meshes("dec_brid2.json", "idx_brid2.json"); brf3 = load_meshes("dec_brid3.json", "idx_brid3.json")
    brf.update(brf3)
    rverts, ridx, rstarts, rmetas = pack_meshes(brf, zoff)
    print("  bridges", len(brf), "verts", len(rverts), "tris", len(ridx) // 3)

    print("roads ..."); roads = build_roads_from_mvt(); print("  polygons", len(roads))
    print("water ..."); water = build_water(nodes, ways, rels, cache); print("  sea", len(water["sea"]), "inland", len(water["inland"]))
    print("green ..."); green = build_green(nodes, ways, rels, cache); print("  polygons", len(green))
    print("trees ..."); trees = build_trees(nodes, ways, cache); print("  trees/lamps", len(trees))
    print("poi ..."); pois = assign_poi_to_buildings(build_poi(nodes, ways, cache), bmetas)
    print("  pois", len(pois), "with level", sum(1 for q in pois if q["lv"] is not None), "assigned", sum(1 for q in pois if q["b"] >= 0))
    print("rails ..."); rails = build_rails(nodes, ways, cache); print("  ways", len(rails))

    print("network ..."); nnodes, nlinks = build_network(nodes, ways, cache, tsample)
    print("  nodes", len(nnodes), "links", len(nlinks))

    # OSM プラットフォーム
    plats = []
    for w, (nd, t) in ways.items():
        if (t.get("railway") == "platform" or t.get("public_transport") == "platform") and nd[0] == nd[-1]:
            pts = way_coords(nodes, ways, w, cache)
            if len(pts) > 3:
                lv = None
                try: lv = int(float(t["level"].split(";")[0])) if t.get("level") else None
                except Exception: pass
                ly = None
                try: ly = int(t["layer"]) if t.get("layer") else None
                except Exception: pass
                plats.append({"lv": lv, "layer": ly, "c": [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)], "r": pts[:-1]})
    print("stations ..."); spaces, snodes, slinks, exit_nodes, slabels = station_models(plats)
    # 駅ネットワークを OSM ネットワークへ接続 (出入口ノード -> 最近傍の地上ノード)
    base = len(nnodes)
    for x, y, lv in snodes: nnodes.append([dm(x), dm(y), lv])
    for a, b, vt in slinks:
        xa, ya, _ = snodes[a]; xb, yb, _ = snodes[b]
        nlinks.append([base + a, base + b, vt, 0, dm(xa), dm(ya), dm(xb), dm(yb)])
    ground = [(i, n) for i, n in enumerate(nnodes[:base]) if n[2] == 0]
    joined = 0
    for e in exit_nodes:
        x, y, _ = snodes[e]
        best = None; bd = 70 * 10
        for i, n in ground:
            d = math.hypot(n[0] - dm(x), n[1] - dm(y))
            if d < bd: bd = d; best = i
        if best is not None:
            nlinks.append([base + e, best, 0, 0, dm(x), dm(y), nnodes[best][0], nnodes[best][1]]); joined += 1
    print("  spaces", len(spaces), "exits joined", joined, "/", len(exit_nodes))

    # ランドマークラベル
    labels = list(slabels)
    for disp, pat in LANDMARKS:
        rx = re.compile(pat)
        cands = [n for n in named if rx.search(n["n"])]
        if not cands:
            # PLATEAU 名称から
            for m in bmetas:
                if m["n"] and rx.search(m["n"]):
                    labels.append({"n": disp, "p": [m["c"][0] / 10, m["c"][1] / 10], "h": (m["h"] or 20) + 12, "kind": "bldg"}); break
            continue
        cands.sort(key=lambda n: -n["poly"].area)
        c = cands[0]; cen = c["poly"].centroid
        h = None
        try: h = float(re.sub(r"[^0-9.]", "", c["h"] or ""))
        except Exception: h = None
        if h is None:
            # 重心に最も近い PLATEAU 建物の高さ
            best = None; bd = 1e9
            for m in bmetas:
                d = math.hypot(m["c"][0] / 10 - cen.x, m["c"][1] / 10 - cen.y)
                if d < bd and m["h"]: bd = d; best = m
            h = best["h"] if best and bd < 60 else 20
        labels.append({"n": disp, "p": [round(cen.x, 1), round(cen.y, 1)], "h": round(h + 12, 1), "kind": "bldg"})
    print("  labels", len(labels))

    header = {
        "origin": {"epsg": 6677, "x": GN[0], "y": GN[1], "lon": 139.6318, "lat": 35.4578},
        "box": BOX, "levelHeights": LEVEL_H, "zoff": round(zoff, 2),
        "terrain": tmeta,
        "buildings": {"starts": bstarts, "meta": bmetas},
        "bridges": {"starts": rstarts, "meta": rmetas},
        "roads": roads, "water": water, "green": green, "rails": rails, "poi": pois, "trees": trees,
        "network": {"nodes": nnodes, "links": nlinks, "vtypes": {v: k for k, v in VTYPE.items() if k}},
        "stations": [{"st": s["st"], "lv": s["lv"], "cat": s["cat"], "n": s["n"], "r": ring_dm(s["r"])} for s in spaces],
        "labels": labels,
        "credits": ["3D都市モデル (Project PLATEAU) 横浜市 (2024年度) / 国土交通省", "© OpenStreetMap contributors", "地理院タイル (標高タイル DEM5A) / 国土地理院"],
    }
    blobs = {
        "terrain": ([dm(v) for v in tgrid], "h"),
        "bldg_pos": ([c for v in bverts for c in v], "h"),
        "bldg_idx": (bidx, "I"),
        "brid_pos": ([c for v in rverts for c in v], "h"),
        "brid_idx": (ridx, "I"),
    }
    raw, gz = write_pack(header, blobs, OUT)
    print("pack:", OUT, "raw", raw, "gzip", gz)

if __name__ == "__main__":
    main()
