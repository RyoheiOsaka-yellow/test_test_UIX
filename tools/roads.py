import urllib.request, json, math
LAT0, LON0 = 34.9858, 138.4125
R = 600.0
DLAT = R/111320.0; DLON = R/(111320.0*math.cos(math.radians(LAT0)))
bbox = f"{LAT0-DLAT},{LON0-DLON},{LAT0+DLAT},{LON0+DLON}"
Q = f"""
[out:json][timeout:120];
way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|footway|path|service)$"]({bbox});
out body geom;
"""
req=urllib.request.Request('https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    data=Q.encode(), headers={'User-Agent':'Mozilla/5.0'})
d=json.load(urllib.request.urlopen(req, timeout=240))
print('ways', len(d['elements']))

def enu(lat, lon):
    return ((lon-LON0)*111320.0*math.cos(math.radians(LAT0)), (lat-LAT0)*111320.0)

WALK = {'pedestrian','footway','path','living_street','residential','service','unclassified'}
ways=[]
for e in d['elements']:
    g=e.get('geometry') or []
    if len(g)<2: continue
    hw=e['tags'].get('highway')
    pts=[enu(p['lat'],p['lon']) for p in g]
    pts=[p for p in pts if math.hypot(*p)<=R*1.05]
    if len(pts)<2: continue
    ways.append(dict(hw=hw, walk=hw in WALK, pts=[[round(x,1),round(y,1)] for x,y in pts]))
json.dump(dict(origin=dict(lat=LAT0,lon=LON0), ways=ways), open('shizuoka_roads.json','w'), separators=(',',':'))
import os
print('kept ways', len(ways), 'vertices', sum(len(w['pts']) for w in ways),
      'size', round(os.path.getsize('shizuoka_roads.json')/1024,1),'KB')
from collections import Counter
print(Counter(w['hw'] for w in ways).most_common())
print('walkable ways', sum(1 for w in ways if w['walk']))
