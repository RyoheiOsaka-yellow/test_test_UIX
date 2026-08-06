#!/usr/bin/env python3
"""PLATEAU CityGML(大田区) → 建物フットプリント+実測高のJSON(Overpass風)"""
import zipfile, json, os, sys
import xml.etree.ElementTree as ET

SP = os.path.dirname(os.path.abspath(__file__))
Z = zipfile.ZipFile(f'{SP}/data/plateau_ota.zip')
NS_B = '{http://www.opengis.net/citygml/building/2.0}'
NS_G = '{http://www.opengis.net/gml}'

els = []
nid = 0
files = [n for n in Z.namelist() if '/bldg/' in n and n.endswith('.gml')]
for fi, name in enumerate(sorted(files)):
    with Z.open(name) as f:
        cur_h = None
        ring = None
        depth_bldg = 0
        for ev, el in ET.iterparse(f, events=('start', 'end')):
            if ev == 'start':
                if el.tag == NS_B + 'Building':
                    cur_h = None; ring = None
                continue
            # end events
            if el.tag == NS_B + 'measuredHeight' and el.text:
                try: cur_h = float(el.text)
                except ValueError: pass
            elif el.tag == NS_B + 'lod0RoofEdge' or el.tag == NS_B + 'lod0FootPrint':
                if ring is None:
                    pl = el.find(f'.//{NS_G}posList')
                    if pl is not None and pl.text:
                        vals = pl.text.split()
                        pts = []
                        for i in range(0, len(vals) - 2, 3):
                            try:
                                lat = float(vals[i]); lon = float(vals[i + 1])
                                pts.append({'lon': lon, 'lat': lat})
                            except ValueError: break
                        if len(pts) >= 4: ring = pts
                el.clear()
            elif el.tag == NS_B + 'Building':
                if ring:
                    nid += 1
                    tags = {}
                    if cur_h: tags['height'] = str(round(cur_h, 1))
                    els.append({'type': 'way', 'id': 9_000_000_000 + nid, 'tags': tags, 'geometry': ring})
                el.clear()
            elif el.tag.endswith('}cityObjectMember'):
                el.clear()
    print(f'{fi+1}/{len(files)} {name.split("/")[-1]} total {len(els)}', flush=True)

json.dump({'elements': els}, open(f'{SP}/osm/bld_plateau.json.tmp', 'w'))
os.rename(f'{SP}/osm/bld_plateau.json.tmp', f'{SP}/osm/bld_plateau.json')
with_h = sum(1 for e in els if 'height' in e['tags'])
print('DONE buildings', len(els), 'with measuredHeight', with_h)
