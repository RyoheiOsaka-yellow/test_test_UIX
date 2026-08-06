#!/usr/bin/env python3
"""Compact Ota-ku OSM data into area.json (local meters, same frame as IFC fit)."""
import json, math, os, glob

SP = os.path.dirname(os.path.abspath(__file__))
fit = json.load(open(f'{SP}/fit.json'))
th = math.radians(fit['theta']); C, S = math.cos(th), math.sin(th)

def to_local(lon, lat):
    x = (lon - fit['lon_c']) * fit['mlon']
    y = (lat - fit['lat_c']) * fit['mlat']
    return (C*x - S*y + fit['dx'], S*x + C*y + fit['dy'])

def load(name):
    p = f'{SP}/osm/{name}.json'
    if not os.path.exists(p): return []
    return json.load(open(p)).get('elements', [])

def ring_local(geom, q=1.0, min_seg=1.5):
    out = []
    px = py = None
    for g in geom:
        x, y = to_local(g['lon'], g['lat'])
        x = round(x/q)*q; y = round(y/q)*q
        if px is not None and abs(x-px) < min_seg and abs(y-py) < min_seg: continue
        out.append([round(x, 1), round(y, 1)]); px, py = x, y
    return out

def est_height(tags):
    try:
        h = tags.get('height') or tags.get('building:height')
        if h: return max(3.0, float(str(h).replace('m', '').strip()))
    except ValueError: pass
    try:
        lv = tags.get('building:levels')
        if lv: return max(3.0, float(lv) * 3.2 + 2)
    except ValueError: pass
    return 6.0

HIC = (0.0, 0.0)  # local origin ~ HIC via fit (lon_c/lat_c near campus); use fit dx/dy offset center
hic_x, hic_y = to_local(fit['lon_c'], fit['lat_c'])

out = {}

# boundary
rings = []
for el in load('boundary'):
    if el.get('type') == 'way' and 'geometry' in el:
        r = ring_local(el['geometry'], q=2)
        if len(r) > 1: rings.append(r)
out['boundary'] = rings

# rails (OSM precise alignments, ground overlay)
rails = []
for el in load('rail'):
    if 'geometry' not in el: continue
    t = el.get('tags', {})
    if t.get('railway') == 'rail' and t.get('service'): continue  # yards/sidings thinned
    r = ring_local(el['geometry'], q=1)
    if len(r) > 1: rails.append(r)
out['rail'] = rails

# stations (names for reference; we use curated list in app)
sta = []
for el in load('stations'):
    t = el.get('tags', {})
    if 'lon' in el:
        x, y = to_local(el['lon'], el['lat'])
        sta.append([t.get('name', ''), round(x, 1), round(y, 1)])
out['stations'] = sta

# roads by class
CLS = {'motorway': 0, 'motorway_link': 0, 'trunk': 0, 'trunk_link': 0,
       'primary': 1, 'primary_link': 1, 'secondary': 1, 'secondary_link': 1,
       'tertiary': 2, 'unclassified': 2, 'residential': 2}
roads = {0: [], 1: [], 2: []}
for src in ('roads', 'roads_major', 'roads_minor0', 'roads_minor1'):
    for el in load(src):
        if 'geometry' not in el: continue
        c = CLS.get(el.get('tags', {}).get('highway'))
        if c is None: continue
        q = 1 if c < 2 else 2
        r = ring_local(el['geometry'], q=q, min_seg=2 if c < 2 else 4)
        if len(r) > 1: roads[c].append(r)
out['roads'] = [roads[0], roads[1], roads[2]]

# water polygons + coastline
wfill, wline = [], []
for el in load('water') + load('water_rel'):
    t = el.get('tags', {})
    if el['type'] == 'way' and 'geometry' in el:
        r = ring_local(el['geometry'], q=2)
        if len(r) < 3: continue
        if t.get('natural') == 'coastline': wline.append(r)
        elif r[0] == r[-1]: wfill.append(r)
        else: wline.append(r)
    elif el['type'] == 'relation':
        for m in el.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m:
                r = ring_local(m['geometry'], q=2)
                if len(r) >= 3: wfill.append(r)
out['waterFill'] = wfill
out['waterLine'] = wline

# aeroway
rw, tw, ap = [], [], []
for el in load('aeroway'):
    t = el.get('tags', {})
    a = t.get('aeroway')
    if el['type'] == 'way' and 'geometry' in el:
        r = ring_local(el['geometry'], q=1)
        if len(r) < 2: continue
        if a == 'runway':
            try: w = float(t.get('width', 60))
            except ValueError: w = 60
            rw.append({'w': w, 'p': r})
        elif a == 'taxiway': tw.append(r)
        elif a == 'apron' and r[0] == r[-1]: ap.append(r)
    elif el['type'] == 'relation' and a == 'apron':
        for m in el.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m:
                r = ring_local(m['geometry'], q=2)
                if len(r) >= 3: ap.append(r)
out['runways'] = rw
out['taxiways'] = tw
out['aprons'] = ap

# buildings: near = full ring, far = oriented bbox
NEAR_R = 1500.0   # 全形状で保持
MID_R = 3500.0    # OBBで全棟保持
# それ以遠: 小規模建物(概ね戸建て)は間引き
near, far = [], []
nb = 0
seen_ids = set()
bld_files = sorted(os.path.basename(p)[:-5] for p in glob.glob(f'{SP}/osm/bld*.json'))
for name in bld_files:
    for el in load(name):
        if 'geometry' not in el: continue
        eid = el.get('id')
        if eid in seen_ids: continue
        seen_ids.add(eid)
        g = el['geometry']
        if len(g) < 3: continue
        nb += 1
        t = el.get('tags', {})
        h = est_height(t)
        pts = [to_local(p['lon'], p['lat']) for p in g]
        cx = sum(p[0] for p in pts)/len(pts); cy = sum(p[1] for p in pts)/len(pts)
        dist = math.hypot(cx - hic_x, cy - hic_y)
        if dist < NEAR_R:
            r = ring_local(g, q=0.5, min_seg=1)
            if len(r) >= 3:
                near.append([round(h, 1)] + [c for p in r for c in p])
        else:
            # oriented bbox: angle of longest edge
            best, ang = 0, 0
            for a2, b2 in zip(pts, pts[1:]):
                d2 = (b2[0]-a2[0])**2 + (b2[1]-a2[1])**2
                if d2 > best: best = d2; ang = math.atan2(b2[1]-a2[1], b2[0]-a2[0])
            ca, sa = math.cos(-ang), math.sin(-ang)
            xs = [ (p[0]-cx)*ca - (p[1]-cy)*sa for p in pts]
            ys = [ (p[0]-cx)*sa + (p[1]-cy)*ca for p in pts]
            w = max(xs)-min(xs); l = max(ys)-min(ys)
            if w < 2 or l < 2: continue
            if dist > MID_R and w * l < 80 and h < 12: continue  # 遠方の小規模建物は省略
            far.append([round(cx), round(cy), round(w), round(l), round(math.degrees(ang)) % 180, round(h)])
out['bldNear'] = near
out['bldFar'] = [v for b in far for v in b]  # flat array, stride 6

json.dump(out, open(f'{SP}/area.json', 'w'), separators=(',', ':'))
print('buildings total', nb, 'near', len(near), 'far', len(far))
print('roads', [len(r) for r in out['roads']], 'rail ways', len(rails), 'water fill/line', len(wfill), len(wline))
print('runways', len(rw), 'taxiways', len(tw), 'aprons', len(ap), 'boundary ways', len(rings))
print('size', os.path.getsize(f'{SP}/area.json'))
