#!/usr/bin/env python3
"""Build 3D-app data: per-floor heat grids (IFC meters) + trajectory replay samples."""
import csv, json, math, os, glob
from collections import defaultdict

SP = os.path.dirname(os.path.abspath(__file__))
fit = json.load(open(f'{SP}/fit.json'))
th = math.radians(fit['theta']); C, S = math.cos(th), math.sin(th)

def to_local(lon, lat):
    x = (lon - fit['lon_c']) * fit['mlon']
    y = (lat - fit['lat_c']) * fit['mlat']
    return (C*x - S*y + fit['dx'], S*x + C*y + fit['dy'])

def group_of(tag_name):
    if tag_name == 'スタッフ': return 'staff'
    if tag_name == 'ビジター': return 'visitor'
    if tag_name in ('自律走行低速電動カート', '自動運転車椅子'): return 'mobility'
    if 'ロボット' in tag_name: return 'robot'
    return None

FLOORS = {'B1F': -1, '1F': 0, '2F': 1, '3F': 2, 'RF': 3}
def floor_of(mlname):
    f = mlname.split('_', 1)[1] if '_' in mlname else '1F'
    return FLOORS.get(f)

CELL = 2.0  # meters
heat = defaultdict(int)   # (floor, group, ix, iy) -> seconds  (all 5 days)
hourly = defaultdict(int) # (day,hour,group) -> seconds

for path in sorted(glob.glob(f'{SP}/data/kf_*.csv')):
    day = os.path.basename(path)[3:7]
    with open(path, encoding='cp932', errors='replace') as f:
        r = csv.reader(f); next(r)
        for row in r:
            try:
                g = group_of(row[4])
                if g is None: continue
                fl = floor_of(row[6])
                if fl is None: continue
                x, y = to_local(float(row[7]), float(row[8]))
                hour = int(row[9][11:13])
            except (ValueError, IndexError):
                continue
            heat[(fl, g, int(x//CELL), int(y//CELL))] += 1
            hourly[(day, hour, g)] += 1

groups = ['staff', 'visitor', 'robot', 'mobility']
heat_out = {}
for (fl, g, ix, iy), v in heat.items():
    if v < 8: continue
    heat_out.setdefault(str(fl), {}).setdefault(g, []).append([ix, iy, v])
for fl in heat_out:
    for g in heat_out[fl]:
        heat_out[fl][g].sort()

# ---- trajectories for replay: day 0918, sample every 8 s ----
STEP = 8        # min seconds between samples
KEEPALIVE = 60  # max seconds without a sample while stationary
MOVE = 1.0      # meters of movement that forces a sample
traj = {}   # uid -> {'g':group,'n':name,'p':[[t,x10,y10,fl],...]}
last = {}   # uid -> (t, x, y, fl)
with open(f'{SP}/data/kf_0918.csv', encoding='cp932', errors='replace') as f:
    r = csv.reader(f); next(r)
    for row in r:
        try:
            g = group_of(row[4])
            if g is None: continue
            fl = floor_of(row[6])
            if fl is None: continue
            ts = row[9]
            t = int(ts[11:13])*3600 + int(ts[14:16])*60 + int(ts[17:19])
            uid = row[0]
        except (ValueError, IndexError):
            continue
        x, y = to_local(float(row[7]), float(row[8]))
        lt = last.get(uid)
        if lt is not None:
            dt = t - lt[0]
            if dt < STEP: continue
            moved = math.hypot(x-lt[1], y-lt[2]) >= MOVE or fl != lt[3]
            if not moved and dt < KEEPALIVE: continue
        d = traj.setdefault(uid, {'g': g, 'n': row[1], 'p': []})
        d['p'].append([t, round(x*10), round(y*10), fl])
        last[uid] = (t, x, y, fl)

npts = sum(len(d['p']) for d in traj.values())
out = {
    'cell': CELL,
    'floors': {'-1': {'z': -2.6, 'label': 'B1F'}, '0': {'z': 0.15, 'label': '1F'},
               '1': {'z': 5.95, 'label': '2F'}, '2': {'z': 11.45, 'label': '3F'},
               '3': {'z': 15.95, 'label': 'RF'}},
    'heat': heat_out,
    'hourly': {d: {g: [hourly.get((d, h, g), 0) for h in range(24)] for g in groups}
               for d in sorted({k[0] for k in hourly})},
}
json.dump(out, open(f'{SP}/heat3d.json', 'w'), separators=(',', ':'))
json.dump(traj, open(f'{SP}/traj.json', 'w'), separators=(',', ':'))
print('heat cells', {fl: {g: len(v) for g, v in d.items()} for fl, d in heat_out.items()})
print('traj tags', len(traj), 'points', npts)
print('sizes', os.path.getsize(f'{SP}/heat3d.json'), os.path.getsize(f'{SP}/traj.json'))
