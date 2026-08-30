#!/usr/bin/env python3
"""Crypto.com Arena 周辺 (Downtown Los Angeles) の OSM データを取得し、
xStadium デジタルツインの SCENE_DATA スキーマ（ローカルENUメートル座標）へ変換する。

Overpass の各ミラーが不通のため OpenStreetMap 本体 API (/api/0.6/map) をタイル分割で使用。
50,000ノード上限に当たったタイルは自動的に4分割して再取得する。
"""
import json, math, os, subprocess, sys, tempfile
import xml.etree.ElementTree as ET

LAT0, LON0 = 34.043018, -118.267254          # Crypto.com Arena 中心
HALF_LAT, HALF_LON = 0.030, 0.036            # ≒ ±3.3km
TILE_LAT, TILE_LON = 0.010, 0.012
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'scene_data_la.json')

M_PER_DEG_LAT = 111320.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT0))

def to_xy(lat, lon):
    """ローカルENU: x=東(m), y=北(m)。描画側は z=-y で使う（宇都宮版と同一規約）。"""
    return (round((lon - LON0) * M_PER_DEG_LON, 1),
            round((lat - LAT0) * M_PER_DEG_LAT, 1))

ROAD_CLASS = {
    'motorway': 4, 'motorway_link': 4, 'trunk': 4, 'trunk_link': 4,
    'primary': 3, 'primary_link': 3,
    'secondary': 2, 'secondary_link': 2,
    'tertiary': 1, 'tertiary_link': 1,
    'residential': 0, 'unclassified': 0, 'living_street': 0, 'service': 0,
}
LU_KIND = {
    'park': 'park', 'garden': 'park', 'grass': 'park', 'pitch': 'park',
    'recreation_ground': 'park', 'cemetery': 'park',
    'retail': 'retail', 'commercial': 'retail',
    'school': 'edu', 'university': 'edu', 'college': 'edu',
    'water': 'water', 'reservoir': 'water', 'riverbank': 'water',
}

# 手選のPOI（回遊・クロス分析の起終点。OSMの網羅取得より意図的なキュレーションを優先）
CURATED_POIS = [
    ("L.A. LIVE / Star Plaza", 34.04480, -118.26700, "ent",
     "アリーナ北側の屋外プラザ。試合前後の滞留とスポンサーアクティベーションの中心"),
    ("Peacock Theater", 34.04430, -118.26650, "ent",
     "7,100席の劇場。アワード興行でアリーナと同時稼働し周辺需要が跳ねる"),
    ("GRAMMY Museum", 34.04340, -118.26610, "tour",
     "音楽系来訪の起点。コンサート興行とのクロス送客対象"),
    ("Los Angeles Convention Center", 34.04030, -118.26960, "biz",
     "大型MICE。同時開催日は駐車場と道路の需要が競合する"),
    ("JW Marriott / Ritz-Carlton", 34.04500, -118.26730, "hotel",
     "隣接ホテル。州外・インバウンド観戦客の主要宿泊地"),
    ("Hotel Figueroa", 34.04680, -118.26500, "hotel", "徒歩圏ホテル"),
    ("Regal L.A. LIVE", 34.04480, -118.26800, "ent", "シネコン。試合前後の回遊先"),
    ("Fashion District", 34.03700, -118.25300, "shop", "南東の商業集積。退場後の回遊導線"),
    ("Grand Central Market", 34.05050, -118.24870, "shop", "DTLA北の食の核"),
    ("The Broad / Walt Disney Concert Hall", 34.05440, -118.25000, "tour", "バンカーヒル文化施設群"),
    ("Little Tokyo", 34.05000, -118.24000, "shop", "北東の観光・飲食エリア"),
    ("Union Station", 34.05600, -118.23400, "rail", "広域鉄道結節点。遠方来場者の玄関口"),
    ("Exposition Park / USC", 34.01700, -118.28600, "tour", "南西の集客拠点。Metro E Lineで直結"),
    ("Wilshire Grand Center", 34.05050, -118.25880, "biz", "DTLA最高層(335m)。スカイラインの基準"),
]

def fetch(bbox, depth=0):
    """1タイル取得。ノード数超過なら4分割して再帰。戻り値: XMLファイルパスのリスト。"""
    w, s, e, n = bbox
    url = f'https://api.openstreetmap.org/api/0.6/map?bbox={w:.5f},{s:.5f},{e:.5f},{n:.5f}'
    fd, path = tempfile.mkstemp(suffix='.osm'); os.close(fd)
    for attempt in range(4):
        r = subprocess.run(['curl', '-sS', '--max-time', '300', '-o', path,
                            '-w', '%{http_code}', url], capture_output=True, text=True)
        code = r.stdout.strip()[-3:]
        if code == '200':
            print(f'  tile {w:.4f},{s:.4f} depth={depth} '
                  f'{os.path.getsize(path)/1e6:.1f}MB', flush=True)
            return [path]
        if code == '400' and depth < 3:                     # too many nodes → 4分割
            os.remove(path)
            mw, ms = (w + e) / 2, (s + n) / 2
            out = []
            for b in [(w, s, mw, ms), (mw, s, e, ms), (w, ms, mw, n), (mw, ms, e, n)]:
                out += fetch(b, depth + 1)
            return out
        print(f'  retry {code} ({attempt+1}/4) {w:.4f},{s:.4f}', flush=True)
        subprocess.run(['sleep', str(2 ** attempt)])
    print(f'  ! give up {w:.4f},{s:.4f}', flush=True)
    os.path.exists(path) and os.remove(path)
    return []

# ---- 収集バッファ（way id で重複排除） ----
nodes = {}
ways = {}          # id -> {'nd':[ids], 'tags':{}}
pois = {}          # id -> (lat, lon, tags)

def parse(path):
    for _, el in ET.iterparse(path, events=('end',)):
        if el.tag == 'node':
            nid = el.get('id')
            nodes[nid] = (float(el.get('lat')), float(el.get('lon')))
            t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
            if t.get('name') and (t.get('railway') == 'station' or t.get('tourism')
                                  or t.get('amenity') in ('theatre', 'arts_centre')):
                pois[nid] = (float(el.get('lat')), float(el.get('lon')), t)
            el.clear()
        elif el.tag == 'way':
            wid = el.get('id')
            if wid not in ways:
                t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
                if t:
                    ways[wid] = {'nd': [c.get('ref') for c in el if c.tag == 'nd'], 'tags': t}
            el.clear()
        elif el.tag == 'relation':
            el.clear()

def main():
    if '--from-cache' in sys.argv:
        import pickle
        with open('/tmp/osm_cache.pkl', 'rb') as f:
            n2, w2, p2 = pickle.load(f)
        nodes.update(n2); ways.update(w2); pois.update(p2)
        print(f'cache: nodes={len(nodes)} ways={len(ways)}', flush=True)
        return build()
    tiles = []
    lat = LAT0 - HALF_LAT
    while lat < LAT0 + HALF_LAT:
        lon = LON0 - HALF_LON
        while lon < LON0 + HALF_LON:
            tiles.append((lon, lat, min(lon + TILE_LON, LON0 + HALF_LON),
                          min(lat + TILE_LAT, LAT0 + HALF_LAT)))
            lon += TILE_LON
        lat += TILE_LAT
    print(f'{len(tiles)} tiles', flush=True)
    for i, b in enumerate(tiles):
        print(f'[{i+1}/{len(tiles)}]', flush=True)
        for p in fetch(b):
            parse(p); os.remove(p)
    print(f'nodes={len(nodes)} ways={len(ways)} poi_nodes={len(pois)}', flush=True)
    import pickle
    with open('/tmp/osm_cache.pkl','wb') as f: pickle.dump((nodes,ways,pois),f)
    return build()

def build():

    stations = []
    for nid,(la,lo,t) in pois.items():
        if t.get('railway')=='station' or t.get('station') in ('subway','light_rail'):
            x,y = to_xy(la,lo)
            if math.hypot(x,y) < 3000:
                stations.append({'n': t['name'], 'p': [x,y],
                                 'k': t.get('station') or t.get('railway')})
    buildings, mid, dots = [], [], []
    roads, rail_heavy, rail_metro, parking = [], [], [], []
    lu = {'park': [], 'retail': [], 'edu': [], 'water': []}
    arena_poly = None

    for wid, w in ways.items():
        pts = [nodes[n] for n in w['nd'] if n in nodes]
        if len(pts) < 2:
            continue
        xy = [to_xy(la, lo) for la, lo in pts]
        t = w['tags']
        closed = w['nd'][0] == w['nd'][-1] and len(xy) >= 4

        if 'building' in t or 'building:part' in t:
            if not closed:
                continue
            cx = sum(p[0] for p in xy) / len(xy)
            cy = sum(p[1] for p in xy) / len(xy)
            r = math.hypot(cx, cy)
            h = None
            if t.get('height'):
                try: h = round(float(t['height'].split()[0]), 1)
                except ValueError: pass
            if h is None and t.get('building:levels'):
                try: h = round(float(t['building:levels']) * 3.4, 1)
                except ValueError: pass
            name = (t.get('name') or '')
            if 'Crypto.com Arena' in name or 'Staples Center' in name:
                arena_poly = xy
                continue
            if r < 1300:
                b = {'p': xy}
                if h: b['h'] = h
                if name and r < 700: b['n'] = name
                buildings.append(b)
            elif r < 2800:
                mid.append({'p': simplify(xy, 6.0)})
            else:
                dots += [int(cx), int(cy)]
            continue

        def struct(o):
            """bridge=1 / tunnel=-1 / at-grade=0 と layer をレコードに付与"""
            if t.get('bridge') not in (None, 'no'): o['b'] = 1
            elif t.get('tunnel') not in (None, 'no'): o['b'] = -1
            try:
                lv = int(float(t.get('layer', 0)))
                if lv: o['ly'] = lv
            except ValueError:
                pass
            return o

        hw = t.get('highway')
        if hw in ROAD_CLASS:
            o = {'p': simplify(xy, 3.0), 'c': ROAD_CLASS[hw]}
            try:
                if t.get('lanes'): o['ln'] = int(float(t['lanes']))
            except ValueError:
                pass
            if t.get('oneway') == 'yes': o['ow'] = 1
            roads.append(struct(o))
            continue

        rw = t.get('railway')
        if rw in ('rail', 'light_rail', 'subway', 'tram'):
            o = struct({'p': simplify(xy, 5.0)})
            if t.get('name'): o['n'] = t['name']
            if rw == 'subway': o['b'] = -1
            (rail_heavy if rw == 'rail' else rail_metro).append(o)
            continue

        if t.get('amenity') == 'parking' and closed:
            parking.append(xy)
            continue

        kind = LU_KIND.get(t.get('leisure')) or LU_KIND.get(t.get('landuse')) \
            or LU_KIND.get(t.get('natural')) or LU_KIND.get(t.get('amenity'))
        if kind and closed:
            lu[kind].append(simplify(xy, 4.0))

    scene = {
        'meta': {'center': [LAT0, LON0], 'name': 'Crypto.com Arena / Downtown Los Angeles',
                 'unit': 'meter', 'axis': 'x=east, y=north (render z = -y)'},
        'buildings': buildings, 'mid': mid, 'dots': dots,
        'roads': roads, 'railHeavy': rail_heavy, 'railMetro': rail_metro,
        'lu': lu, 'parking': parking,
        'arena': {'outer': arena_poly or []},
        'stations': stations,
        'pois': [{'n': n, 'p': list(to_xy(la, lo)), 'c': c, 'd': d}
                 for n, la, lo, c, d in CURATED_POIS],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(scene, f, separators=(',', ':'))
    print(f'buildings={len(buildings)} mid={len(mid)} dots={len(dots)//2} '
          f'roads={len(roads)} railHeavy={len(rail_heavy)} railMetro={len(rail_metro)} '
          f'parking={len(parking)} lu=' + str({k: len(v) for k, v in lu.items()}), flush=True)
    print(f'arena outer pts={len(arena_poly or [])}')
    print(f'wrote {OUT} {os.path.getsize(OUT)/1e6:.1f}MB')

def simplify(pts, tol):
    """Douglas-Peucker（スタック実装・再帰上限回避）。
    閉リング（始点=終点）は基線が長さ0になり全点が落ちるため、
    始点から最も遠い点で2本の開いた鎖に割ってから間引く。"""
    if len(pts) < 3:
        return pts
    if pts[0] == pts[-1] and len(pts) > 3:
        ring = pts[:-1]
        far = max(range(1, len(ring)),
                  key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
        a = simplify(ring[:far + 1], tol)
        b = simplify(ring[far:] + [ring[0]], tol)
        out = a[:-1] + b
        return out if len(out) >= 4 else pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, bi = d, k
        if best > tol:
            keep[bi] = True
            stack += [(i, bi), (bi, j)]
    return [p for p, k in zip(pts, keep) if k]

if __name__ == '__main__':
    main()
