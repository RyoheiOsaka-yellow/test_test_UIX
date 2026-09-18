#!/usr/bin/env python3
"""OSM(Overpass)取得データ → SCENE_DATA(JSON) を組み立て、テンプレート断片と結合して index.html を生成する。
   座標系: 中心(CLAT, CLON)からの m 単位、x=東, y=北。"""
import json, glob, math, os, random, sys

OSM = sys.argv[1] if len(sys.argv) > 1 else 'osm'
TPL = sys.argv[2] if len(sys.argv) > 2 else 'tpl'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'index.html'
CLAT, CLON = 34.8380, 134.6915
MX = 111320 * math.cos(math.radians(CLAT))
MY = 110574
random.seed(7)

def proj(lat, lon):
    return [round((lon - CLON) * MX, 1), round((lat - CLAT) * MY, 1)]

def load(name):
    p = os.path.join(OSM, name + '.json')
    if not os.path.exists(p): return []
    try: return json.load(open(p))['elements']
    except Exception as e:
        print('skip', name, e); return []

def load_glob(pat):
    out = {}
    for p in sorted(glob.glob(os.path.join(OSM, pat))):
        try:
            for e in json.load(open(p))['elements']: out[(e['type'], e['id'])] = e
        except Exception as ex: print('skip', p, ex)
    return list(out.values())

def geom_poly(e):
    g = e.get('geometry')
    if not g: return None
    pts = [proj(q['lat'], q['lon']) for q in g if 'lat' in q]
    out = []
    for p in pts:
        if not out or out[-1] != p: out.append(p)
    if len(out) >= 2 and out[0] == out[-1]: out.pop()
    return out if len(out) >= 3 else None

def dp(pts, tol):
    """Douglas-Peucker 簡略化（ポリライン）"""
    if len(pts) <= 2: return pts
    ax, ay = pts[0]; bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    L2 = dx*dx + dy*dy or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts)-1):
        px, py = pts[i]
        t = max(0, min(1, ((px-ax)*dx + (py-ay)*dy) / L2))
        d = math.hypot(px - (ax+t*dx), py - (ay+t*dy))
        if d > best: best, bi = d, i
    if best > tol:
        return dp(pts[:bi+1], tol)[:-1] + dp(pts[bi:], tol)
    return [pts[0], pts[-1]]

def area(poly):
    s = 0
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % len(poly)]
        s += x1*y2 - x2*y1
    return abs(s) / 2

def centroid(poly):
    return [round(sum(p[0] for p in poly)/len(poly), 1), round(sum(p[1] for p in poly)/len(poly), 1)]

def coord(e):
    if 'lat' in e: return proj(e['lat'], e['lon'])
    c = e.get('center')
    return proj(c['lat'], c['lon']) if c else None

# ---------- 建物 ----------
CASTLE_KEYS = ['天守', '櫓', '渡櫓', '化粧櫓', '百間廊下', '菱の門', 'の門', '姫路城']
def castle_height(name, tags):
    if '大天守' in name: return 46.4
    if '小天守' in name or '乾小天守' in name: return 28
    if '櫓' in name or '廊下' in name: return 11
    if '門' in name: return 8
    return 9

buildings = []
for e in load_glob('bi_*.json'):
    poly = geom_poly(e)
    if not poly: continue
    t = e.get('tags', {})
    name = t.get('name', '')
    b = {'p': [[round(x, 1), round(y, 1)] for x, y in dp(poly, 0.6)] if len(poly) > 6 else poly}
    if len(b['p']) < 3: continue
    h = None
    try:
        if t.get('height'): h = float(str(t['height']).replace('m', '').strip())
        elif t.get('building:levels'): h = float(t['building:levels']) * 3.3
    except ValueError: h = None
    is_castle = (t.get('building') == 'castle' or t.get('historic') == 'castle' or t.get('castle_type') or any(k in name for k in CASTLE_KEYS))
    if is_castle:
        b['k'] = 'castle'; b['h'] = round(castle_height(name, t), 1); b['n'] = name or '姫路城'
    else:
        if h is None:
            a = area(poly)
            h = 5.5 + random.random()*4 + (10 if a > 2500 else (5 if a > 900 else 0))
        b['h'] = round(min(h, 90), 1)
        if name and len(name) <= 18: b['n'] = name
    buildings.append(b)
print('buildings inner (OSM)', len(buildings), 'castle', sum(1 for b in buildings if b.get('k') == 'castle'))
osm_tiles = [tuple(map(float, os.path.basename(p)[3:-5].split('_'))) for p in glob.glob(os.path.join(OSM, 'bi_*.json'))]
def in_osm_tile(x, y):
    lat = CLAT + y/MY; lon = CLON + x/MX
    return any(a <= lat < a+0.005 and c <= lon < c+0.005 for a, c in osm_tiles)

mid = []
for e in load_glob('bm_*.json'):
    poly = geom_poly(e)
    if not poly or area(poly) < 45: continue
    mid.append([[round(x, 1), round(y, 1)] for x, y in (dp(poly, 1.2) if len(poly) > 6 else poly)])
dots = []
for e in load_glob('bw_*.json'):
    c = e.get('center')
    if c: dots.append(proj(c['lat'], c['lon']))

# ---- 地理院ベクトルタイル由来の建物（OSMタイルが無い範囲を補完） ----
GSI = os.path.join(OSM, 'gsi_buildings.json')
if os.path.exists(GSI):
    g = json.load(open(GSI))
    CORR = (-1000, -1500, 1050, 700)   # 押し出し対象: 城〜駅の回廊 (x0,y0,x1,y1) m
    KEEP = proj(34.83945, 134.69396)
    cand = []
    for bb in g['inner']:
        cx, cy = centroid(bb['p']); a = area(bb['p'])
        if in_osm_tile(cx, cy) and osm_tiles: continue
        d_keep = math.hypot(cx-KEEP[0], cy-KEEP[1])
        if a > 60 and (d_keep < 115 or (a > 900 and cx < KEEP[0]-100 and d_keep < 260)):
            cand.append((a, bb, cx, cy, d_keep)); continue
        if CORR[0] <= cx <= CORR[2] and CORR[1] <= cy <= CORR[3] and a >= 35:
            bb['p'] = [[int(round(u)), int(round(v))] for u, v in bb['p']]
            buildings.append(bb)
        elif a >= 60:
            mid.append([[int(round(u)), int(round(v))] for u, v in bb['p']])
    if cand:
        osm_keep = any('大天守' in b.get('n', '') for b in buildings)
        near = [t for t in cand if t[4] < 70]
        keep_bb = None if osm_keep else max(near or cand, key=lambda t: t[0])[1]
        for (a, bb, cx, cy, dk) in cand:
            bb['p'] = [[int(round(u)), int(round(v))] for u, v in bb['p']]
            bb['k'] = 'castle'
            if bb is keep_bb: bb['h'] = 46.4; bb['n'] = '姫路城 大天守'
            elif dk < 70: bb['h'] = 22.0; bb['n'] = '姫路城 小天守・渡櫓'
            elif a > 900: bb['h'] = 12.0; bb['n'] = '姫路城 西の丸 百間廊下・櫓'
            else: bb['h'] = 9.0; bb['n'] = '姫路城 櫓・門'
            buildings.append(bb)
        if keep_bb: print(' castle keep centroid', centroid(keep_bb['p']), 'area', round(area(keep_bb['p'])))
    for poly in g['mid']:
        if area(poly) >= 70: mid.append([[int(round(u)), int(round(v))] for u, v in poly])
    dots += [[int(p[0]), int(p[1])] for p in g['dots']]
    mid.sort(key=lambda p: -area(p)); mid = mid[:22000]
print('buildings inner', len(buildings), 'castle', sum(1 for b in buildings if b.get('k') == 'castle'), 'mid', len(mid))
random.shuffle(dots)
dots = dots[:32000]
flat_dots = []
for d in dots: flat_dots += [int(d[0]), int(d[1])]
print('dots', len(dots))

# ---------- 道路 ----------
ROAD_CLASS = {'motorway':2,'motorway_link':2,'trunk':2,'trunk_link':2,'primary':2,'primary_link':2,
              'secondary':1,'secondary_link':1,'tertiary':1,'tertiary_link':1,
              'residential':0,'unclassified':0,'living_street':0,
              'pedestrian':3,'footway':4,'path':4,'steps':4,'cycleway':4}
roads = []
for e in load('roads'):
    t = e.get('tags', {}); hw = t.get('highway')
    if hw not in ROAD_CLASS: continue
    g = e.get('geometry')
    if not g: continue
    pts = [proj(q['lat'], q['lon']) for q in g if 'lat' in q]
    if len(pts) < 2: continue
    c = ROAD_CLASS[hw]
    nm = t.get('name', '')
    if 'みゆき通り' in nm or '商店街' in nm: c = 3
    pts = dp(pts, 1.5)
    roads.append({'p': [[round(x, 1), round(y, 1)] for x, y in pts], 'c': c})
print('roads', len(roads))

# ---------- 鉄道・駅・ロープウェイ ----------
rail = {'jr': [], 'shin': [], 'sanyo': [], 'other': []}
for e in load('rail_ways'):
    t = e.get('tags', {}); g = e.get('geometry')
    if not g: continue
    pts = dp([proj(q['lat'], q['lon']) for q in g if 'lat' in q], 2.0)
    if len(pts) < 2: continue
    nm, op = t.get('name', ''), t.get('operator', '')
    if '新幹線' in nm: k = 'shin'
    elif '山陽電気鉄道' in op or '山陽電' in nm: k = 'sanyo'
    elif '西日本旅客鉄道' in op or nm.startswith('JR') or '山陽本線' in nm or '播但' in nm or '姫新' in nm: k = 'jr'
    else: k = 'other'
    rail[k].append([[round(x, 1), round(y, 1)] for x, y in pts])
print('rail', {k: len(v) for k, v in rail.items()})

SANYO_ST = {'山陽姫路','手柄','亀山','飾磨','妻鹿','白浜の宮','八家','夢前川','西飾磨','広畑','山陽天満','平松','山陽網干','大塩','的形'}
stations = []
seen = set()
for e in load('rail_st'):
    t = e.get('tags', {}); nm = t.get('name', '')
    if not nm or 'lat' not in e or nm in seen: continue
    if t.get('disused') or nm == '手柄山平和公園': continue
    op = t.get('operator', '')
    k = 'sanyo' if ('山陽電気' in op or nm in SANYO_ST) else 'jr'
    seen.add(nm)
    stations.append({'n': nm, 'p': proj(e['lat'], e['lon']), 'k': k})
print('stations', len(stations))

ropeway = []
for e in load('aerial'):
    if e['type'] == 'way' and e.get('geometry'):
        ropeway.append([proj(q['lat'], q['lon']) for q in e['geometry'] if 'lat' in q])

# ---------- 土地利用・水域・駐車場 ----------
lu = {'park': [], 'forest': [], 'retail': [], 'edu': [], 'water': [], 'moat': []}
parking = []
for e in load('lu'):
    t = e.get('tags', {})
    polys = []
    if e['type'] == 'way':
        poly = geom_poly(e)
        if poly: polys.append(poly)
    elif e['type'] == 'relation':
        for m in e.get('members', []):
            if m.get('role') in ('outer', '') and m.get('geometry'):
                pts = [proj(q['lat'], q['lon']) for q in m['geometry'] if 'lat' in q]
                if len(pts) >= 4 and pts[0] == pts[-1]: polys.append(pts[:-1])
    for poly in polys:
        poly = [[round(x, 1), round(y, 1)] for x, y in (dp(poly, 1.0) if len(poly) > 8 else poly)]
        if len(poly) < 3: continue
        if t.get('amenity') == 'parking':
            if area(poly) >= 1500: parking.append(poly)
        elif t.get('water') == 'moat' or '堀' in t.get('name', ''): lu['moat'].append(poly)
        elif t.get('natural') == 'water' or t.get('water') or t.get('waterway') == 'riverbank': lu['water'].append(poly)
        elif t.get('leisure') in ('park', 'garden', 'pitch', 'stadium', 'sports_centre', 'nature_reserve') or t.get('landuse') == 'grass': lu['park'].append(poly)
        elif t.get('landuse') in ('forest',) or t.get('natural') == 'wood': lu['forest'].append(poly)
        elif t.get('landuse') in ('retail', 'commercial'): lu['retail'].append(poly)
        elif t.get('amenity') in ('university', 'college', 'school', 'hospital'): lu['edu'].append(poly)
print('lu', {k: len(v) for k, v in lu.items()}, 'parking', len(parking))

# ---------- 宿泊・IC ----------
hotels = []
hseen = set()
for e in load('hotels'):
    t = e.get('tags', {}); c = coord(e)
    if not c: continue
    nm = t.get('name') or t.get('name:en') or ('ホテル' if t.get('tourism') == 'hotel' else '宿泊施設')
    if t.get('tourism') == 'apartment' and not t.get('name'): continue
    key = (nm, int(c[0]/30), int(c[1]/30))
    if key in hseen: continue
    hseen.add(key)
    hotels.append({'n': nm, 'p': c})
print('hotels', len(hotels))

ics = {}
for e in load('ic'):
    t = e.get('tags', {}); nm = t.get('name'); c = coord(e)
    if not nm or not c: continue
    nm = nm.replace('IC', '').replace('インターチェンジ', '').replace('ランプ', '').strip()
    ics.setdefault(nm, []).append(c)
ic = []
for nm, cs in ics.items():
    x = sum(c[0] for c in cs)/len(cs); y = sum(c[1] for c in cs)/len(cs)
    if abs(x) < 6600 and abs(y) < 6600: ic.append({'n': nm, 'p': [round(x, 1), round(y, 1)]})
# 名前が近いもの（上り/下り）を統合
merged = []
for i in ic:
    hit = next((m for m in merged if math.hypot(m['p'][0]-i['p'][0], m['p'][1]-i['p'][1]) < 700 and m['n'][:2] == i['n'][:2]), None)
    if hit: hit['p'] = [round((hit['p'][0]+i['p'][0])/2, 1), round((hit['p'][1]+i['p'][1])/2, 1)]
    else: merged.append(i)
ic = merged
print('ic', [i['n'] for i in ic])

# ---------- POI（キュレーション + OSM座標で補正） ----------
named = {}
for f in ('named', 'attr', 'hist', 'amen', 'shops'):
    for e in load(f):
        t = e.get('tags', {}); nm = t.get('name'); c = coord(e)
        if not nm or not c: continue
        if t.get('highway') == 'bus_stop' or t.get('public_transport') or t.get('railway'): continue   # バス停・駅は除外
        if nm not in named: named[nm] = c
def find(*keys):
    for k in keys:                       # 完全一致を優先
        if k in named: return named[k]
    for k in keys:                       # 次に部分一致
        for nm, c in named.items():
            if k in nm: return c
    return None
POIS = [
    ('姫路城 大天守', (34.83945, 134.69396), 'castle', '世界遺産（1993年・日本初）・国宝。白鷺城。大天守は入場制限 15,000人/日。来訪者の9割が入城する中核目的地', 150, True, ['大天守']),
    ('大手門', (34.8352, 134.6937), 'castle', '入城導線の起点。大手前通りの北端。桜門橋〜三の丸広場へ', 10, False, ['大手門']),
    ('好古園', (34.8378, 134.6884), 'castle', '姫路城西御屋敷跡庭園。城との共通券で立寄率が高い。滞留分散の受け皿', 45, False, ['好古園']),
    ('姫路市立美術館', (34.8404, 134.6975), 'culture', '旧陸軍倉庫の赤レンガ。城の東側。国内客の立寄り先', 50, False, ['姫路市立美術館']),
    ('兵庫県立歴史博物館', (34.8419, 134.6959), 'culture', '城北側。城の模型・歴史展示。雨天時の受け皿', 45, False, ['歴史博物館']),
    ('姫路市立動物園', (34.8386, 134.6960), 'nature', '城内（三の丸東）。家族連れ・県内客の立寄り', 50, False, ['姫路市立動物園', '動物園']),
    ('姫路文学館', (34.8410, 134.6868), 'culture', '安藤忠雄設計。城の西側・男山麓', 40, False, ['姫路文学館', '文学館']),
    ('イーグレひめじ', (34.8348, 134.6944), 'culture', '屋上展望デッキから城の眺望。大手前公園に面する', 20, False, ['イーグレ']),
    ('大手前通り', (34.8312, 134.6922), 'shop', '駅〜城を結ぶ約1kmのシンボルロード。来訪者の主動線', 15, False, []),
    ('みゆき通り商店街', (34.8300, 134.6935), 'shop', '駅北〜城南のアーケード商店街。飲食・土産の消費拠点', 40, False, ['みゆき通り']),
    ('JR姫路駅', (34.8268, 134.6905), 'transit', '山陽新幹線・山陽本線・播但線・姫新線。来訪者の6割超が利用する最大ゲート', 0, True, []),
    ('山陽姫路駅', (34.8283, 134.6896), 'transit', '山陽電鉄本線 終点。神戸・明石方面の県内客', 0, False, []),
    ('姫路駅北 バスターミナル', (34.8281, 134.6900), 'transit', '神姫バス・高速バス・ツアーバス。書写山・太陽公園・姫路港方面への起点', 0, False, []),
    ('ピオレ姫路', (34.8271, 134.6910), 'shop', '駅ビル商業。帰路直前の土産・飲食', 30, False, ['ピオレ']),
    ('アクリエひめじ', (34.8250, 134.6985), 'culture', '姫路市文化コンベンションセンター（2021年開館）。MICE来訪の起点', 90, False, ['アクリエ']),
    ('手柄山中央公園', (34.8210, 134.6742), 'nature', '姫路市立水族館・平和資料館・回転展望台。県内ファミリー層', 60, False, ['手柄山中央公園']),
    ('書写山圓教寺', (34.8870, 134.6595), 'castle', '西の比叡山。摩尼殿・三つの堂。ラストサムライ ロケ地。インバウンドの"+1スポット"', 150, False, ['圓教寺', '圓教寺 摩尼殿']),
    ('書写山ロープウェイ 山麓駅', (34.8786, 134.6665), 'transit', '姫路駅から神姫バス約30分。ロープウェイ4分で山上へ', 0, False, ['書写']),
    ('廣峯神社', (34.8735, 134.6935), 'castle', '黒田官兵衛ゆかりの古社。広峰山上。眺望', 40, False, ['廣峯神社', '広峯神社']),
    ('姫路港', (34.7810, 134.6735), 'transit', '家島諸島・小豆島航路。海のゲート', 0, False, ['姫路港']),
    ('松原八幡神社', (34.7885, 134.7375), 'castle', '灘のけんか祭り（10月14・15日）。屋台練りで10万人規模の集客', 60, False, ['松原八幡']),
    ('男山配水池公園', (34.8421, 134.6893), 'nature', '姫路城の全景撮影スポット。SNS投稿の集中点', 20, False, ['男山配水池', 'Otokoyama']),
    ('太陽公園', (34.8735, 134.6255), 'nature', '石のエリア・白鳥城。西部の観光施設', 90, False, ['太陽公園']),
]
pois = []
ST = {s['n']: s['p'] for s in stations}
tenshu = next((b for b in buildings if b.get('k') == 'castle' and '大天守' in b.get('n', '')), None)
for n, ll, c, d, dw, big, keys in POIS:
    p = find(*keys) if keys else None
    if n == '姫路城 大天守' and tenshu: p = centroid(tenshu['p'])
    if n == 'JR姫路駅' and ST.get('姫路'): p = ST['姫路']
    if n == '山陽姫路駅' and ST.get('山陽姫路'): p = ST['山陽姫路']
    fb = proj(*ll)
    if p and math.hypot(p[0]-fb[0], p[1]-fb[1]) > 1500: p = None   # 名前一致でも遠すぎる場合は採用しない
    o = {'n': n, 'p': p or fb, 'c': c, 'd': d}
    if dw: o['dw'] = dw
    if big: o['big'] = True
    pois.append(o)
    print(' poi', n, 'osm' if p else 'fallback', o['p'])

SCENE = {'c': {'lat': CLAT, 'lon': CLON}, 'buildings': buildings, 'mid': mid, 'dots': flat_dots, 'roads': roads,
         'rail': rail, 'stations': stations, 'ropeway': ropeway, 'lu': lu, 'parking': parking,
         'hotels': hotels, 'ic': ic, 'pois': pois}
json.dump(SCENE, open(os.path.join(OSM, 'scene_data.json'), 'w'))   # 実データ前処理（prep_real.py）の入力
# ---- 実データ（地形・DSM）: prep_real.py の出力があれば取り込む ----
# ---- PLATEAU（prep_plateau.py の出力）: あれば建物・土地利用・道路面を実データに置換 ----
PLAT = os.path.join(OSM, 'plateau.json')
if os.path.exists(PLAT):
    plateau = json.load(open(PLAT, encoding='utf-8'))
    SCENE['plateau'] = plateau
    SCENE['buildings'] = [b for b in buildings if b.get('k') == 'castle']   # 天守モデル配置用に城郭のみ残す（描画は PLATEAU）
    buildings = SCENE['buildings']
    SCENE['mid'] = []
    print('PLATEAU attached:', plateau.get('meta'))
REAL = os.path.join(OSM, 'real.json')
if os.path.exists(REAL):
    real = json.load(open(REAL))
    bh = real.pop('bldg_h', {})
    n_h = 0
    for i, h in bh.items():
        i = int(i)
        if i < len(buildings) and buildings[i].get('k') != 'castle':
            buildings[i]['h'] = h; n_h += 1
    SCENE['real'] = real
    print('real data attached: heights', n_h, 'keys', list(real.keys()))
js = json.dumps(SCENE, ensure_ascii=False, separators=(',', ':'))
print('SCENE_DATA bytes', len(js.encode('utf-8')))

parts = [open(os.path.join(TPL, f), encoding='utf-8').read() for f in ('part1_head.html', 'part2_scene.js', 'part3_sim.js', 'part4_ui.js')]
_p5 = open(os.path.join(TPL, 'part5_flow3d.js'), encoding='utf-8').read()
_p2b = open(os.path.join(TPL, 'part2b_plateau.js'), encoding='utf-8').read()
_anchor = "  for(let i=0;i<plain.length;i+=1500) LG.bldg.add(mergedExtrude(plain.slice(i,i+1500), MAT.bldg));\n})();\n"
assert parts[1].count(_anchor) == 1
parts[1] = parts[1].replace(_anchor, _anchor + _p2b)
assert parts[3].count('/* 初期化 */') == 1
parts[3] = parts[3].replace('/* 初期化 */', _p5 + '\n/* 初期化 */')
_p6 = open(os.path.join(TPL, 'part6_flowvis.js'), encoding='utf-8').read()
parts[3] = parts[3].replace(_p5 + '\n/* 初期化 */', _p5 + '\n' + _p6 + '\n/* 初期化 */')
assert _p6 in parts[3]
# ---------- ライブラリ・フォントの埋め込み（EMBED_LIBS=1: three.js / Noto Sans JP をインライン化、オフラインで動作） ----------
ASSETS = os.environ.get('ASSETS_DIR', os.path.join(TPL, 'assets'))
def libs_head(embed):
    h = parts[0]
    if embed and os.path.isdir(ASSETS):
        rd = lambda f: open(os.path.join(ASSETS, f), encoding='utf-8').read()
        h = h.replace('<!--@FONTS-->', rd('fonts.css.html').rstrip('\n')).replace('<!--@LICENSES-->', rd('licenses.html').rstrip('\n'))
        h = h.replace('<!--@THREE-->', '<script>/**\n * @license\n * Copyright 2010-2021 Three.js Authors\n * SPDX-License-Identifier: MIT\n */\n' + rd('three.min.js') + '</script>')
    else:
        h = h.replace('<!--@FONTS-->', '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">')
        h = h.replace('<!--@LICENSES-->', '').replace('<!--@THREE-->', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>')
    return h
EMBED_LIBS = os.environ.get('EMBED_LIBS', '1') != '0'
html = libs_head(EMBED_LIBS) + '\nconst SCENE_DATA = ' + js + ';\n' + parts[1] + '\n' + parts[2] + '\n' + parts[3]
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', OUT, len(html.encode('utf-8')), 'bytes')

# ---------- 共有用（Artifact）変種: 地理院タイルを data URI で埋め込み、外側の html/head/body ラッパを除去 ----------
TILES = os.environ.get('EMBED_TILES')
if TILES and os.path.isdir(TILES):
    import base64
    td = {}
    for f in sorted(os.listdir(TILES)):
        if not f.endswith('.jpg') or os.path.getsize(os.path.join(TILES, f)) < 500: continue
        z, x, y = f[:-4].split('_')
        td[f'{z}/{x}/{y}'] = 'data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(TILES, f), 'rb').read()).decode('ascii')
    tjs = 'const TILE_DATA = ' + json.dumps(td) + ';\n'
    head = libs_head(os.environ.get('EMBED_LIBS_ARTIFACT', '0') != '0')
    for tag in ('<!DOCTYPE html>', '<html lang="ja">', '<head>', '<meta charset="UTF-8">',
                '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">', '</head>', '<body>'):
        head = head.replace(tag + '\n', '').replace(tag, '')
    emb = head + '\nconst SCENE_DATA = ' + js + ';\n' + tjs + parts[1] + '\n' + parts[2] + '\n' + parts[3]
    emb = emb.replace('</body>\n</html>', '').rstrip() + '\n'
    out2 = os.environ.get('EMBED_OUT', OUT.replace('.html', '.embedded.html'))
    open(out2, 'w', encoding='utf-8').write(emb)
    print('wrote', out2, len(emb.encode('utf-8')), 'bytes', 'tiles', len(td))
    # ---- 多ファイル版（Artifact の files 機能向け: ページ本体 + data/scene.js + data/tiles.js。1ファイル16MB制限を回避） ----
    ADIR = os.environ.get('ARTIFACT_DIR')
    if ADIR:
        os.makedirs(os.path.join(ADIR, 'data'), exist_ok=True)
        open(os.path.join(ADIR, 'data', 'scene.js'), 'w', encoding='utf-8').write('window.SCENE_DATA_EXT = ' + js + ';\n')
        open(os.path.join(ADIR, 'data', 'tiles.js'), 'w', encoding='utf-8').write('window.TILE_DATA_EXT = ' + json.dumps(td) + ';\n')
        page = head.replace('<!--@THREE-->', '<script src="data/scene.js"></script>\n<script src="data/tiles.js"></script>\n<!--@THREE-->') if '<!--@THREE-->' in head else head
        page = page.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script src="data/scene.js"></script>\n<script src="data/tiles.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', 1)
        page = page + '\nconst SCENE_DATA = window.SCENE_DATA_EXT;\nconst TILE_DATA = window.TILE_DATA_EXT;\n' + parts[1] + '\n' + parts[2] + '\n' + parts[3]
        page = page.replace('</body>\n</html>', '').rstrip() + '\n'
        open(os.path.join(ADIR, 'index.html'), 'w', encoding='utf-8').write(page)
        print('wrote artifact dir', ADIR, 'page', len(page.encode('utf-8')), 'scene.js', len(js.encode('utf-8')) + 26, 'tiles.js', len(json.dumps(td)) + 25)
