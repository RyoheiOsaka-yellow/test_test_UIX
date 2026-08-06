#!/usr/bin/env python3
"""Fetch OSM data for Ota-ku + Haneda airport via Overpass, with pacing/retries."""
import json, time, os, sys, subprocess

SP = os.path.dirname(os.path.abspath(__file__))
OUT = f'{SP}/osm'; os.makedirs(OUT, exist_ok=True)
EPS = ['https://overpass-api.de/api/interpreter',
       'https://overpass.kumi.systems/api/interpreter']

# bbox: whole Ota-ku + airport + margin  (S,W,N,E)
S, W_, N, E = 35.518, 139.655, 35.630, 139.815

def fetch(name, query, tries=6):
    path = f'{OUT}/{name}.json'
    if os.path.exists(path) and os.path.getsize(path) > 100:
        print(name, 'cached', os.path.getsize(path)); return
    for a in range(tries):
        try:
            r = subprocess.run(['curl', '-sS', '-m', '280', '-G', EPS[a % len(EPS)],
                                '--data-urlencode', 'data=' + query, '-o', path],
                               capture_output=True, text=True, timeout=300)
            if r.returncode != 0:
                raise RuntimeError(r.stderr[:120])
            j = json.load(open(path))  # validates
            print(name, 'ok', os.path.getsize(path), 'elements', len(j.get('elements', [])), flush=True)
            time.sleep(8)
            return
        except Exception as e:
            print(name, 'attempt', a, 'failed:', str(e)[:120], flush=True)
            if os.path.exists(path): os.remove(path)
            time.sleep(25)
    raise SystemExit(f'giving up on {name}')

H = f'[out:json][timeout:240][maxsize:1073741824];'
bb = f'({S},{W_},{N},{E})'

fetch('boundary', H + 'relation["boundary"="administrative"]["admin_level"="7"]["name"="大田区"];way(r);out geom qt;')
fetch('rail', H + f'(way["railway"~"^(rail|monorail|light_rail|subway)$"]{bb};);out geom qt;')
fetch('stations', H + f'(node["railway"="station"]{bb};node["station"="monorail"]{bb};);out qt;')
fetch('aeroway', H + f'way["aeroway"~"^(runway|taxiway|apron)$"]{bb};out geom qt;')
fetch('water', H + f'(way["natural"="water"]{bb};way["natural"="coastline"]{bb};);out geom qt;')
fetch('water_rel', H + f'relation["natural"="water"]{bb};out geom qt;')
fetch('roads_major', H + f'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link)$"]{bb};out geom qt;')
mid = 35.574
fetch('roads_minor0', H + f'way["highway"~"^(unclassified|residential)$"]({S},{W_},{mid},{E});out geom qt;')
fetch('roads_minor1', H + f'way["highway"~"^(unclassified|residential)$"]({mid},{W_},{N},{E});out geom qt;')

# buildings in 4 lat bands to keep responses manageable
bands = [(35.518, 35.546), (35.546, 35.574), (35.574, 35.602), (35.602, 35.630)]
for i, (s, n) in enumerate(bands):
    fetch(f'bld{i}', H + f'way["building"]({s},{W_},{n},{E});out geom qt;')
print('ALL DONE')
