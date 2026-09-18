#!/usr/bin/env python3
"""PLATEAU 姫路市 CityGML（2023年度・仕様4.1・EPSG:6697）→ ブラウザ用の軽量データ osm/plateau.json
   ・bldg: 中心 R2 m は LOD2（屋根面・壁面の三角形, int16 0.1m 量子化）、範囲内すべて LOD1（フットプリント＋計測高さ＋用途）
   ・tran: 道路面ポリゴン（LOD1）
   ・frn : 都市設備（街路灯・標識など）の位置と種別
   ・brid: 橋梁 LOD2 の三角形
   ・luse: 土地利用ポリゴン（用途コード）
   座標: build_scene.py と同じ中心(CLAT, CLON)からの m（x=東, y=北）。高さは T.P. 標高（そのまま three の y）
   使い方: python3 prep_plateau.py geo/plateau osm/plateau.json
"""
import sys, os, json, math, base64, glob, time
import numpy as np
from lxml import etree
import mapbox_earcut as earcut
from shapely.geometry import Polygon
from shapely.validation import make_valid

SRC = sys.argv[1] if len(sys.argv) > 1 else 'geo/plateau'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'osm/plateau.json'
CLAT, CLON = 34.8380, 134.6915
MX = 111320 * math.cos(math.radians(CLAT)); MY = 110574
CASTLE = (214.9, 165.2)          # 大天守（x=東, y=北）
R2 = float(os.environ.get('LOD2_R', 1700))      # LOD2 半径 m（姫路城〜駅前を含む）
EXT_X, EXT_Y = 3900, 3500        # LOD1・道路の範囲（シーン範囲）
ROAD_EXT = 2600                  # 道路面はやや狭く
LUSE_EXT = 3900
Q = 10.0                         # 量子化 0.1 m

NS = {'gml':'http://www.opengis.net/gml', 'bldg':'http://www.opengis.net/citygml/building/2.0', 'core':'http://www.opengis.net/citygml/2.0',
      'tran':'http://www.opengis.net/citygml/transportation/2.0', 'frn':'http://www.opengis.net/citygml/cityfurniture/2.0',
      'brid':'http://www.opengis.net/citygml/bridge/2.0', 'luse':'http://www.opengis.net/citygml/landuse/2.0', 'uro':'https://www.geospatial.jp/iur/uro/3.1',
      'gen':'http://www.opengis.net/citygml/generics/2.0'}
def T(ns, tag): return '{%s}%s' % (NS[ns], tag)

def proj(lat, lon): return ((lon - CLON) * MX, (lat - CLAT) * MY)
def parse_poslist(txt):
    v = np.array(txt.split(), dtype=np.float64)
    if v.size % 3: return None
    v = v.reshape(-1, 3)
    x = (v[:, 1] - CLON) * MX; y = (v[:, 0] - CLAT) * MY; z = v[:, 2]
    return np.stack([x, y, z], axis=1)

def ring_polys(elem):
    """要素配下の gml:Polygon → [(exterior Nx3, [interior Nx3,...]), ...]"""
    out = []
    for poly in elem.iter(T('gml', 'Polygon')):
        ext = poly.find('gml:exterior/gml:LinearRing/gml:posList', NS)
        if ext is None or not ext.text: continue
        e = parse_poslist(ext.text)
        if e is None or len(e) < 4: continue
        holes = []
        for h in poly.findall('gml:interior/gml:LinearRing/gml:posList', NS):
            hh = parse_poslist(h.text or '')
            if hh is not None and len(hh) >= 4: holes.append(hh)
        out.append((e, holes))
    return out

def tri_polygon(ext, holes):
    """3D 平面ポリゴンを三角形化（Newell 法線で 2D 投影 → earcut）。返り値: (M,3,3) の頂点"""
    pts = ext[:-1] if np.allclose(ext[0], ext[-1]) else ext
    if len(pts) < 3: return None
    # Newell normal
    n = np.zeros(3)
    for i in range(len(pts)):
        a = pts[i]; b = pts[(i + 1) % len(pts)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1])
    L = np.linalg.norm(n)
    if L < 1e-9: return None
    n /= L
    ax = np.argmax(np.abs(n))
    keep = [i for i in range(3) if i != ax]
    allpts = [pts]; rings = [len(pts)]
    for h in holes:
        hp = h[:-1] if np.allclose(h[0], h[-1]) else h
        if len(hp) >= 3: allpts.append(hp); rings.append(rings[-1] + len(hp))
    P = np.concatenate(allpts, axis=0)
    p2 = P[:, keep].astype(np.float64)
    try:
        idx = earcut.triangulate_float64(p2, np.array(rings, dtype=np.uint32))
    except Exception:
        return None
    if idx.size < 3: return None
    tri = P[idx].reshape(-1, 3, 3)
    # 法線の向きを Newell 法線に揃える
    v1 = tri[:, 1] - tri[:, 0]; v2 = tri[:, 2] - tri[:, 0]
    fn = np.cross(v1, v2)
    flip = (fn @ n) < 0
    tri[flip] = tri[flip][:, ::-1]
    return tri

def q16(arr):
    a = np.clip(np.round(np.asarray(arr, dtype=np.float64) * Q), -32767, 32767).astype(np.int16)
    return base64.b64encode(a.tobytes()).decode('ascii')

# ---------------- 建物 ----------------
lod1, lod2_roof, lod2_wall, lod2_b = [], [], [], []   # lod2_b: [start_tri_roof, n_roof, start_wall, n_wall, lod1_index]
lod2_ids = set()
usage_count = {}
def parse_bldg(path):
    n_all = n_in = n2 = 0
    ctx = etree.iterparse(path, events=('end',), tag=T('bldg', 'Building'))
    for _, b in ctx:
        n_all += 1
        try:
            gid = b.get(T('gml', 'id')) or ''
            mh = b.findtext('bldg:measuredHeight', namespaces=NS)
            usage = b.findtext('bldg:usage', namespaces=NS)
            st = b.findtext('bldg:storeysAboveGround', namespaces=NS)
            name = b.findtext('gml:name', namespaces=NS)
            det = b.find('uro:buildingDetailAttribute/uro:BuildingDetailAttribute', NS)
            struct = det.findtext('uro:buildingStructureType', namespaces=NS) if det is not None else None
            tfa = det.findtext('uro:totalFloorArea', namespaces=NS) if det is not None else None
            year = b.findtext('bldg:yearOfConstruction', namespaces=NS)
            # フットプリント: lod0RoofEdge > lod0FootPrint > lod1Solid 底面
            fp = None
            for tag in ('bldg:lod0RoofEdge', 'bldg:lod0FootPrint'):
                e = b.find(tag, NS)
                if e is not None:
                    polys = ring_polys(e)
                    if polys: fp = polys[0][0]; break
            solid = b.find('bldg:lod1Solid', NS)
            zmin = zmax = None
            if solid is not None:
                polys = ring_polys(solid)
                if polys:
                    allz = np.concatenate([p[0][:, 2] for p in polys]); zmin, zmax = float(allz.min()), float(allz.max())
                    if fp is None:
                        # 底面 = 平均 z が最小の面
                        fp = min(polys, key=lambda p: p[0][:, 2].mean())[0]
            if fp is None: continue
            cx, cy = float(fp[:, 0].mean()), float(fp[:, 1].mean())
            if abs(cx) > EXT_X or abs(cy) > EXT_Y: continue
            n_in += 1
            h = None
            try: h = float(mh) if mh is not None else None
            except: h = None
            if (h is None or h <= 0) and zmin is not None and zmax is not None: h = zmax - zmin
            if h is None or h <= 0: h = 3.0
            gz = zmin if zmin is not None else float(fp[:, 2].min())
            # 簡略化（0.4m）
            try:
                pg = Polygon(fp[:, :2])
                if not pg.is_valid: pg = make_valid(pg)
                if pg.geom_type != 'Polygon': pg = max(pg.geoms, key=lambda g: g.area) if hasattr(pg, 'geoms') else pg
                pg = pg.simplify(0.4, preserve_topology=True)
                ring = list(pg.exterior.coords)[:-1]
            except Exception:
                ring = [tuple(p) for p in fp[:, :2]]
            if len(ring) < 3: continue
            rec = {'p': [[round(x, 1), round(y, 1)] for x, y in ring], 'h': round(h, 1), 'g': round(gz, 1), 'id': gid[-8:]}
            if usage: rec['u'] = usage; usage_count[usage] = usage_count.get(usage, 0) + 1
            if st and st not in ('9999', '-9999'): rec['s'] = int(float(st))
            if name: rec['n'] = name
            if struct: rec['st'] = struct
            if tfa and tfa not in ('-9999',): rec['fa'] = round(float(tfa))
            if year and year not in ('9999', '-9999', '0'): rec['y'] = int(year)
            li = len(lod1)
            # LOD2
            if math.hypot(cx - CASTLE[0], cy - CASTLE[1]) <= R2 and b.find('bldg:lod2Solid', NS) is not None:
                rs, ws = [], []
                for bb in b.findall('bldg:boundedBy', NS):
                    for surf in bb:
                        kind = etree.QName(surf).localname
                        if kind not in ('RoofSurface', 'WallSurface', 'OuterCeilingSurface', 'OuterFloorSurface'): continue
                        ms = surf.find('bldg:lod2MultiSurface', NS)
                        if ms is None: continue
                        for ext, holes in ring_polys(ms):
                            tri = tri_polygon(ext, holes)
                            if tri is None: continue
                            (rs if kind in ('RoofSurface', 'OuterCeilingSurface', 'OuterFloorSurface') else ws).append(tri)
                if rs or ws:
                    r0 = sum(len(t) for t in lod2_roof); w0 = sum(len(t) for t in lod2_wall)
                    nr = sum(len(t) for t in rs); nw = sum(len(t) for t in ws)
                    lod2_roof.extend(rs); lod2_wall.extend(ws)
                    lod2_b.append([r0, nr, w0, nw, li]); rec['l2'] = 1; n2 += 1
            lod1.append(rec)
        finally:
            b.clear()
            while b.getprevious() is not None:
                del b.getparent()[0]
    return n_all, n_in, n2

# ---------------- 道路面 ----------------
roads = []
def parse_tran(path):
    n = 0
    ctx = etree.iterparse(path, events=('end',), tag=T('tran', 'Road'))
    for _, r in ctx:
        try:
            func = r.findtext('tran:function', namespaces=NS)
            ms = r.find('tran:lod1MultiSurface', NS)
            if ms is None: continue
            for ext, holes in ring_polys(ms):
                cx, cy = float(ext[:, 0].mean()), float(ext[:, 1].mean())
                if abs(cx) > ROAD_EXT or abs(cy) > ROAD_EXT: continue
                try:
                    pg = Polygon(ext[:, :2], [h[:, :2] for h in holes])
                    if not pg.is_valid: pg = make_valid(pg)
                    geoms = list(pg.geoms) if hasattr(pg, 'geoms') else [pg]
                    for g in geoms:
                        if g.geom_type != 'Polygon' or g.area < 4: continue
                        g = g.simplify(0.5, preserve_topology=True)
                        rec = {'p': [[round(x, 1), round(y, 1)] for x, y in list(g.exterior.coords)[:-1]]}
                        hs = [[[round(x, 1), round(y, 1)] for x, y in list(i.coords)[:-1]] for i in g.interiors if len(i.coords) > 3]
                        if hs: rec['i'] = hs
                        if func: rec['f'] = func
                        roads.append(rec); n += 1
                except Exception:
                    continue
        finally:
            r.clear()
            while r.getprevious() is not None:
                del r.getparent()[0]
    return n

# ---------------- 都市設備 ----------------
furn = []
def parse_frn(path):
    n = 0
    ctx = etree.iterparse(path, events=('end',), tag=T('frn', 'CityFurniture'))
    for _, f in ctx:
        try:
            cls = f.findtext('frn:class', namespaces=NS); func = f.findtext('frn:function', namespaces=NS)
            pts = []
            for ext, _h in ring_polys(f):
                pts.append(ext)
            if not pts: continue
            P = np.concatenate(pts, axis=0)
            cx, cy = float(P[:, 0].mean()), float(P[:, 1].mean())
            if abs(cx) > EXT_X or abs(cy) > EXT_Y: continue
            furn.append({'x': round(cx, 1), 'y': round(cy, 1), 'z0': round(float(P[:, 2].min()), 1), 'h': round(float(P[:, 2].max() - P[:, 2].min()), 1), 'c': cls or '', 'f': func or ''}); n += 1
        finally:
            f.clear()
            while f.getprevious() is not None:
                del f.getparent()[0]
    return n

# ---------------- 橋梁 ----------------
brid_tris = []
def parse_brid(path):
    n = 0
    ctx = etree.iterparse(path, events=('end',), tag=T('brid', 'Bridge'))
    for _, br in ctx:
        try:
            for ms in br.iter(T('brid', 'lod2MultiSurface')):
                for ext, holes in ring_polys(ms):
                    tri = tri_polygon(ext, holes)
                    if tri is not None: brid_tris.append(tri); n += 1
            if n == 0:
                for ms in br.iter(T('brid', 'lod2Solid')):
                    for ext, holes in ring_polys(ms):
                        tri = tri_polygon(ext, holes)
                        if tri is not None: brid_tris.append(tri); n += 1
        finally:
            br.clear()
    return n

# ---------------- 土地利用 ----------------
luse = []
def parse_luse(path):
    n = 0
    ctx = etree.iterparse(path, events=('end',), tag=T('luse', 'LandUse'))
    for _, l in ctx:
        try:
            cls = l.findtext('luse:class', namespaces=NS)
            ms = l.find('luse:lod1MultiSurface', NS)
            if ms is None: continue
            for ext, holes in ring_polys(ms):
                cx, cy = float(ext[:, 0].mean()), float(ext[:, 1].mean())
                if abs(cx) > LUSE_EXT or abs(cy) > LUSE_EXT: continue
                try:
                    pg = Polygon(ext[:, :2], [h[:, :2] for h in holes])
                    if not pg.is_valid: pg = make_valid(pg)
                    geoms = list(pg.geoms) if hasattr(pg, 'geoms') else [pg]
                    for g in geoms:
                        if g.geom_type != 'Polygon' or g.area < 30: continue
                        g = g.simplify(1.5, preserve_topology=True)
                        rec = {'p': [[round(x, 1), round(y, 1)] for x, y in list(g.exterior.coords)[:-1]], 'c': cls or ''}
                        hs = [[[round(x, 1), round(y, 1)] for x, y in list(i.coords)[:-1]] for i in g.interiors if len(i.coords) > 3]
                        if hs: rec['i'] = hs
                        luse.append(rec); n += 1
                except Exception:
                    continue
        finally:
            l.clear()
            while l.getprevious() is not None:
                del l.getparent()[0]
    return n


# ---------------- 道路面（OSM 中心線のバッファ: PLATEAU tran が未提供のため） ----------------
def build_road_areas():
    from shapely.geometry import LineString
    from shapely.ops import unary_union
    sd_path = os.path.join('osm', 'scene_data.json')
    if not os.path.exists(sd_path): return []
    sd = json.load(open(sd_path))
    W = {2: 8.5, 1: 5.5, 0: 3.0, 3: 3.5, 4: 1.3}      # 片側幅 m（幹線 / 主要 / 細街路 / 歩行者・商店街 / 歩道・小径）
    LIM = {2: ROAD_EXT, 1: ROAD_EXT, 0: ROAD_EXT, 3: ROAD_EXT, 4: 1700}
    out = []
    for c in [2, 1, 0, 3, 4]:
        ls = []
        for r in sd['roads']:
            if r['c'] != c: continue
            P = np.array(r['p'])
            if np.abs(P).max() > LIM[c] or len(P) < 2: continue
            ls.append(LineString(P))
        if not ls: continue
        u = unary_union([l.buffer(W[c], cap_style=2, join_style=2) for l in ls]).simplify(0.4)
        for g in (u.geoms if hasattr(u, 'geoms') else [u]):
            if g.geom_type != 'Polygon' or g.area < 6: continue
            out.append((c, [list(g.exterior.coords)[:-1]] + [list(i.coords)[:-1] for i in g.interiors if len(i.coords) > 3]))
    return out

def dissolve_luse():
    from shapely.ops import unary_union
    CL = ['211', '212', '213', '214', '217', '204', '201', '202', '203', '216', '222', '223']
    out = []
    for ci, c in enumerate(CL):
        polys = []
        for x in luse:
            if x['c'] != c: continue
            P = np.array(x['p'])
            if np.abs(P).max() > ROAD_EXT: continue
            try:
                pg = Polygon(x['p'], x.get('i', []))
                if not pg.is_valid: pg = pg.buffer(0)
                if not pg.is_empty: polys.append(pg)
            except Exception: pass
        if not polys: continue
        u = unary_union(polys).simplify(2.0)
        for g in (u.geoms if hasattr(u, 'geoms') else [u]):
            if g.geom_type != 'Polygon' or g.area < 150: continue
            out.append((ci, [list(g.exterior.coords)[:-1]] + [list(i.coords)[:-1] for i in g.interiors if len(i.coords) > 3]))
    return CL, out

def enc_polys(items, unit=5.0):
    """[(cls, [ring, hole, ...]), ...] → {v:int16 b64 (単位 1/unit m), rn:uint16 各リング頂点数, pr:uint16 ポリゴンごとのリング数, c:uint8 クラス}"""
    v, rn, pr, cl = [], [], [], []
    for c, rings in items:
        k = 0
        for ring in rings:
            if len(ring) < 3 or len(ring) > 65000: continue
            for x, y in ring: v.append(int(round(x * unit))); v.append(int(round(y * unit)))
            rn.append(len(ring)); k += 1
        if k == 0: continue
        pr.append(k); cl.append(c)
    return {'v': base64.b64encode(np.clip(np.array(v, dtype=np.int64), -32767, 32767).astype(np.int16).tobytes()).decode('ascii'),
            'rn': base64.b64encode(np.array(rn, dtype=np.uint16).tobytes()).decode('ascii'),
            'pr': base64.b64encode(np.array(pr, dtype=np.uint16).tobytes()).decode('ascii'),
            'c': base64.b64encode(np.array(cl, dtype=np.uint8).tobytes()).decode('ascii'), 'n': len(pr)}

t0 = time.time()
for p in sorted(glob.glob(os.path.join(SRC, 'bldg', '*.gml'))):
    r = parse_bldg(p); print('bldg', os.path.basename(p), r, f'{time.time()-t0:.0f}s', flush=True)
for p in sorted(glob.glob(os.path.join(SRC, 'brid', '*.gml'))):
    r = parse_brid(p); print('brid', os.path.basename(p), r, flush=True)
for p in sorted(glob.glob(os.path.join(SRC, 'luse', '*.gml'))):
    r = parse_luse(p); print('luse', os.path.basename(p), r, flush=True)

# ---- 建物: 帯域分け（押し出し / 中間帯フラット）とバイナリ化 ----
EXT_BOX, MID_BOX = 2400, 3900
USAGES = ['411', '412', '413', '414', '415', '401', '402', '403', '404', '421', '422', '431', '441', '451', '452', '453', '454', '461']
# 城郭（内堀〜中堀）楕円: three座標 (x, z) 中心(150,-10) 半径(470,410) → データ座標 y=-z
def in_castle(cx, cy): return ((cx - 150) / 470) ** 2 + ((cy - 10) / 410) ** 2 <= 1.0
ext_b, mid_b = [], []
lod2_map = {}    # 旧 lod1 index → 新 ext index
for i, b in enumerate(lod1):
    P = np.array(b['p']); cx, cy = float(P[:, 0].mean()), float(P[:, 1].mean())
    try: a = Polygon(b['p']).area
    except Exception: a = 0
    box = max(abs(cx), abs(cy)); r = math.hypot(cx - CASTLE[0], cy - CASTLE[1])
    if box <= EXT_BOX and (a >= 40 or r <= 1200 or b.get('l2')):
        b['_a'] = a; b['_c'] = 1 if (in_castle(cx, cy) and b.get('u') in ('422', '454', '461', None) and b['h'] >= 5) else 0
        lod2_map[i] = len(ext_b); ext_b.append(b)
    elif box <= MID_BOX and a >= 60:
        mid_b.append(b)
v, n, h, g, u, st, l2, cls = [], [], [], [], [], [], [], []
ids = []; names = []
for j, b in enumerate(ext_b):
    for x, y in b['p']: v.append(int(round(x * 5))); v.append(int(round(y * 5)))
    n.append(len(b['p'])); h.append(int(round(b['h'] * 10))); g.append(int(round(b['g'] * 10)))
    u.append(USAGES.index(b['u']) + 1 if b.get('u') in USAGES else 0); st.append(min(255, b.get('s', 0))); l2.append(1 if b.get('l2') else 0); cls.append(b['_c'])
    ids.append(b['id']);
    if b.get('n'): names.append([j, b['n']])
def b64(arr, dt): return base64.b64encode(np.array(arr, dtype=dt).tobytes()).decode('ascii')
mv, mn = [], []
for b in mid_b:
    for x, y in b['p']: mv.append(int(round(x * 5))); mv.append(int(round(y * 5)))
    mn.append(len(b['p']))
l2b = [[r0, nr, w0, nw, lod2_map[li]] for (r0, nr, w0, nw, li) in lod2_b if li in lod2_map]
roof = np.concatenate(lod2_roof, axis=0) if lod2_roof else np.zeros((0, 3, 3))
wall = np.concatenate(lod2_wall, axis=0) if lod2_wall else np.zeros((0, 3, 3))
brt = np.concatenate(brid_tris, axis=0) if brid_tris else np.zeros((0, 3, 3))
roads_items = build_road_areas()
luse_cls, luse_items = dissolve_luse()
out = {
    'meta': {'src': 'PLATEAU 姫路市 2023年度 CityGML（国土交通省・仕様4.1・EPSG:6697）', 'lod2_r': R2, 'q': Q, 'unit_l1': 5, 'castle': CASTLE,
             'n_ext': len(ext_b), 'n_mid': len(mid_b), 'n_lod2': len(l2b), 'tri_roof': int(len(roof)), 'tri_wall': int(len(wall)), 'usages': USAGES, 'luse_cls': luse_cls,
             'note': '道路面は OSM 中心線のバッファ（PLATEAU tran 未提供）。土地利用は PLATEAU luse を用途別に統合'},
    'l1': {'v': b64(v, np.int16), 'n': b64(n, np.uint8), 'h': b64(h, np.uint16), 'g': b64(g, np.int16), 'u': b64(u, np.uint8), 's': b64(st, np.uint8), 'l2': b64(l2, np.uint8), 'c': b64(cls, np.uint8), 'ids': ''.join(ids), 'names': names},
    'mid': {'v': b64(mv, np.int16), 'n': b64(mn, np.uint8)},
    'l2': {'roof': q16(roof.reshape(-1)), 'wall': q16(wall.reshape(-1)), 'b': l2b},
    'brid': q16(brt.reshape(-1)),
    'roads': enc_polys(roads_items), 'luse': enc_polys(luse_items),
}
js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w', encoding='utf-8').write(js)
print('ext', len(ext_b), 'mid', len(mid_b), 'lod2', len(l2b), 'roof tris', len(roof), 'wall tris', len(wall), 'roads', len(roads_items), 'luse', len(luse_items), 'brid tris', len(brt), 'castle-class', sum(cls))
print('bytes total', len(js.encode('utf-8')), {k: len(json.dumps(out[k])) for k in out})
