#!/usr/bin/env python3
"""Aggregate K-field (HICity) 1Hz position logs into compact JSON for the viz."""
import csv, json, glob, os, math
from collections import defaultdict

SP = os.path.dirname(os.path.abspath(__file__))
FILES = sorted(glob.glob(os.path.join(SP, 'data', 'kf_*.csv')))

# tag_name -> group
def group_of(tag_name):
    if tag_name == 'スタッフ': return 'staff'
    if tag_name == 'ビジター': return 'visitor'
    if tag_name in ('自律走行低速電動カート', '自動運転車椅子'): return 'mobility'
    if 'ロボット' in tag_name: return 'robot'
    return None  # spot etc.

# grid: ~1.1m cells
LON0, LAT0 = 139.7540, 35.5470
CELL_LON, CELL_LAT = 0.000012, 0.00001

hourly = defaultdict(int)                               # (day,hour,group) -> seconds
hourly_tags = defaultdict(set)                          # (day,hour,group) -> tag ids
daily_tags = defaultdict(set)                           # (day,group) -> tag ids
zones = defaultdict(int)                                # (zone,group) -> seconds
zone_tags = defaultdict(set)
grid = defaultdict(int)                                 # (group,ix,iy) -> seconds
zone_ext = {}                                           # zone -> [minlon,minlat,maxlon,maxlat]
visitor_dwell = defaultdict(int)                        # (day,user_id) -> seconds
robot_detail = defaultdict(int)                         # (day, tag_name) -> seconds

for path in FILES:
    day = os.path.basename(path)[3:7]  # 0918
    with open(path, encoding='cp932', errors='replace') as f:
        r = csv.reader(f)
        header = next(r)
        for row in r:
            try:
                uid, uname, comp, tid, tname, mlid, mlname, xs, ys, ts = row
                g = group_of(tname)
                if g is None: continue
                x = float(xs); y = float(ys)
                hour = int(ts[11:13])
            except (ValueError, IndexError):
                continue
            hourly[(day, hour, g)] += 1
            hourly_tags[(day, hour, g)].add(uid)
            daily_tags[(day, g)].add(uid)
            zones[(mlname, g)] += 1
            zone_tags[(mlname, g)].add(uid)
            ix = int((x - LON0) / CELL_LON); iy = int((y - LAT0) / CELL_LAT)
            grid[(g, ix, iy)] += 1
            e = zone_ext.get(mlname)
            if e is None:
                zone_ext[mlname] = [x, y, x, y]
            else:
                if x < e[0]: e[0] = x
                if y < e[1]: e[1] = y
                if x > e[2]: e[2] = x
                if y > e[3]: e[3] = y
            if g == 'visitor':
                visitor_dwell[(day, uid)] += 1
            if g == 'robot':
                robot_detail[(day, tname)] += 1

days = sorted({d for d, _, _ in hourly})
groups = ['staff', 'visitor', 'robot', 'mobility']

out = {
    'days': days,
    'groups': groups,
    'hourly': {d: {g: [hourly.get((d, h, g), 0) for h in range(24)] for g in groups} for d in days},
    'hourlyTags': {d: {g: [len(hourly_tags.get((d, h, g), ())) for h in range(24)] for g in groups} for d in days},
    'dailyTags': {d: {g: len(daily_tags.get((d, g), ())) for g in groups} for d in days},
    'zones': {},
    'robotDetail': {d: {k: v for (dd, k), v in robot_detail.items() if dd == d} for d in days},
}
zone_names = sorted(zone_ext)
for z in zone_names:
    out['zones'][z] = {
        'ext': [round(v, 7) for v in zone_ext[z]],
        'sec': {g: zones.get((z, g), 0) for g in groups},
        'tags': {g: len(zone_tags.get((z, g), ())) for g in groups},
    }
# visitor dwell distribution (minutes buckets)
buckets = [5, 15, 30, 60, 120, 240, 1e9]
labels = ['<5分', '5-15分', '15-30分', '30-60分', '1-2時間', '2-4時間', '4時間+']
dw = [0] * len(buckets)
tot_sec = 0; nvis = 0
for (d, uid), sec in visitor_dwell.items():
    m = sec / 60; nvis += 1; tot_sec += sec
    for i, b in enumerate(buckets):
        if m < b: dw[i] += 1; break
out['visitorDwell'] = {'labels': labels, 'counts': dw, 'meanMin': round(tot_sec / max(nvis, 1) / 60, 1), 'n': nvis}

# grids: per group, sparse [ix,iy,sec], drop cells <5s noise
grids = {}
for g in groups:
    cells = [[ix, iy, s] for (gg, ix, iy), s in grid.items() if gg == g and s >= 5]
    cells.sort()
    grids[g] = cells
out['gridMeta'] = {'lon0': LON0, 'lat0': LAT0, 'dlon': CELL_LON, 'dlat': CELL_LAT}

with open(os.path.join(SP, 'agg.json'), 'w') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(SP, 'grids.json'), 'w') as f:
    json.dump(grids, f, separators=(',', ':'))
print('days', days)
print('dailyTags', json.dumps(out['dailyTags'], ensure_ascii=False))
print('visitorDwell', out['visitorDwell'])
print('grid cells', {g: len(v) for g, v in grids.items()})
print('sizes', os.path.getsize(os.path.join(SP, 'agg.json')), os.path.getsize(os.path.join(SP, 'grids.json')))
print('zones', {z: out['zones'][z]['sec'] for z in zone_names})
