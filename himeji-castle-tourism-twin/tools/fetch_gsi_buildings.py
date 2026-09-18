#!/usr/bin/env python3
"""国土地理院 ベクトルタイル(experimental_bvmap, z16) の building レイヤーから建物ポリゴンを取得し、
   内周(フル押し出し) / 中間帯(フラット) / 広域(点描) に分類して gsi_buildings.json を書き出す。"""
import math, subprocess, json, os, sys, concurrent.futures, random
import mapbox_vector_tile
OUT = sys.argv[1] if len(sys.argv) > 1 else 'osm/gsi_buildings.json'
CACHE = 'gsi_tiles'; os.makedirs(CACHE, exist_ok=True)
CLAT, CLON = 34.8380, 134.6915
MX = 111320*math.cos(math.radians(CLAT)); MY = 110574
INNER = (34.8225, 134.6800, 34.8475, 134.7060)
MID   = (34.8100, 134.6600, 34.8600, 134.7250)
WIDE  = (34.7790, 134.6200, 34.8970, 134.7630)
Z = 16
def tx(lon): return (lon+180)/360*2**Z
def ty(lat): return (1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*2**Z
def inv(x, y):
    lon = x/2**Z*360-180
    n = math.pi - 2*math.pi*y/2**Z
    lat = math.degrees(math.atan(math.sinh(n)))
    return lat, lon
def proj(lat, lon): return [round((lon-CLON)*MX, 1), round((lat-CLAT)*MY, 1)]
def inside(b, lat, lon): return b[0] <= lat <= b[2] and b[1] <= lon <= b[3]
def area(poly):
    s = 0
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % len(poly)]; s += x1*y2-x2*y1
    return abs(s)/2
def dp(pts, tol):
    if len(pts) <= 2: return pts
    ax, ay = pts[0]; bx, by = pts[-1]; dx, dy = bx-ax, by-ay; L2 = dx*dx+dy*dy or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts)-1):
        px, py = pts[i]; t = max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/L2)); d = math.hypot(px-(ax+t*dx), py-(ay+t*dy))
        if d > best: best, bi = d, i
    if best > tol: return dp(pts[:bi+1], tol)[:-1] + dp(pts[bi:], tol)
    return [pts[0], pts[-1]]

x0, x1 = int(tx(WIDE[1])), int(tx(WIDE[3])); y0, y1 = int(ty(WIDE[2])), int(ty(WIDE[0]))
jobs = [(x, y) for x in range(x0, x1+1) for y in range(y0, y1+1)]
print('tiles', len(jobs))
def get(j):
    x, y = j; f = f'{CACHE}/{Z}_{x}_{y}.pbf'
    if os.path.exists(f) and os.path.getsize(f) > 0: return f
    for t in range(3):
        r = subprocess.run(['curl', '-sS', '-m', '60', '-o', f, '-w', '%{http_code}', f'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{Z}/{x}/{y}.pbf'], capture_output=True, text=True)
        if r.stdout.strip() == '200': return f
        if r.stdout.strip() == '404': open(f, 'wb').close(); return f
    return None
with concurrent.futures.ThreadPoolExecutor(8) as ex: files = list(ex.map(get, jobs))
print('downloaded', sum(1 for f in files if f))

inner, mid, dots = [], [], []
seen = set()
for (x, y), f in zip(jobs, files):
    if not f or os.path.getsize(f) == 0: continue
    try: d = mapbox_vector_tile.decode(open(f, 'rb').read(), y_coord_down=True)
    except Exception as e: print('decode fail', f, e); continue
    lay = d.get('building')
    if not lay: continue
    ext = lay.get('extent', 4096)
    for ft in lay['features']:
        g = ft['geometry']; props = ft.get('properties', {})
        polys = []
        if g['type'] == 'Polygon': polys = [g['coordinates'][0]]
        elif g['type'] == 'MultiPolygon': polys = [p[0] for p in g['coordinates']]
        for ring in polys:
            pts = []
            for px, py in ring:
                lat, lon = inv(x + px/ext, y + py/ext); pts.append((lat, lon))
            if len(pts) < 3: continue
            clat = sum(p[0] for p in pts)/len(pts); clon = sum(p[1] for p in pts)/len(pts)
            # タイル境界でクリップされた重複を除去（セントロイド丸め）
            key = (round(clat, 5), round(clon, 5))
            if key in seen: continue
            seen.add(key)
            xy = [proj(a, b) for a, b in pts]
            if xy[0] == xy[-1]: xy = xy[:-1]
            if len(xy) < 3: continue
            a = area(xy)
            if inside(INNER, clat, clon):
                if a < 12: continue
                code = int(props.get('ftCode', 3101))
                solid = code in (3102, 3112, 3104)   # 堅ろう建物
                h = (12 + min(30, a/120)) if solid else (5.5 + random.random()*3 + (4 if a > 600 else 0))
                inner.append({'p': [[round(u, 1), round(v, 1)] for u, v in (dp(xy, 0.5) if len(xy) > 6 else xy)], 'h': round(h, 1)})
            elif inside(MID, clat, clon):
                if a < 40: continue
                mid.append([[round(u, 1), round(v, 1)] for u, v in (dp(xy, 1.2) if len(xy) > 6 else xy)])
            else:
                if a < 30: continue
                dots.append(proj(clat, clon))
random.seed(3); random.shuffle(dots); dots = dots[:48000]
json.dump({'inner': inner, 'mid': mid, 'dots': dots}, open(OUT, 'w'))
print('inner', len(inner), 'mid', len(mid), 'dots', len(dots), 'bytes', os.path.getsize(OUT))
