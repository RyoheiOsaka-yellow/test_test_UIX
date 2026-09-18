#!/usr/bin/env python3
"""SYNTHETIC 人流生成（実データではありません）
   姫路城周辺の実際の都市構造（OSM 道路網・駅・大手門・回遊先 POI）を参考に、来訪者の 1 日の GPS 点列を合成して
   data/synthetic/mobility/raw_points.csv を書き出す。source_type='synthetic', source_id='synthetic-v1' を必ず付ける。
   軌跡・滞在・OD・メッシュ統計は DB 側の関数（mobility.build_trajectories / detect_stays / build_od / compute_all_mesh_stats）で派生させる。
   使い方: python3 generate_synthetic.py --scene ../../data/real/scene_data.json --out ../../data/synthetic/mobility --persons 800 --date 2026-10-04
"""
import argparse, csv, hashlib, heapq, json, math, os, random
from datetime import datetime, timedelta, timezone

ap = argparse.ArgumentParser()
ap.add_argument('--scene', default=os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'real', 'scene_data.json'))
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'synthetic', 'mobility'))
ap.add_argument('--persons', type=int, default=800)
ap.add_argument('--date', default='2026-10-04')          # 土曜（週末シナリオ）
ap.add_argument('--step', type=int, default=30)          # GPS サンプリング秒
ap.add_argument('--seed', type=int, default=7)
args = ap.parse_args()
random.seed(args.seed)

SC = json.load(open(args.scene, encoding='utf-8'))
CLAT, CLON = SC['c']['lat'], SC['c']['lon']
MX = 111320 * math.cos(math.radians(CLAT)); MY = 110574
def to_ll(x, y): return (CLON + x / MX, CLAT + y / MY)
JST = timezone(timedelta(hours=9))
DAY = datetime.fromisoformat(args.date).replace(tzinfo=JST)

# ---- 道路網（歩行可能: 幹線以外も含む。x=東, y=北 m） ----
def key(p): return (round(p[0]), round(p[1]))
nodes, adj = {}, {}
def add_edge(a, b):
    ka, kb = key(a), key(b); nodes[ka] = a; nodes[kb] = b
    d = math.hypot(a[0] - b[0], a[1] - b[1])
    if d < 0.5: return
    adj.setdefault(ka, []).append((kb, d)); adj.setdefault(kb, []).append((ka, d))
for r in SC['roads']:
    pts = r['p']
    if max(abs(p[0]) for p in pts) > 3000 or max(abs(p[1]) for p in pts) > 3000: continue
    for i in range(len(pts) - 1): add_edge(pts[i], pts[i + 1])
# 端点の近接結合（3m）
grid = {}
for k in nodes: grid.setdefault((k[0] // 4, k[1] // 4), []).append(k)
for k in list(nodes):
    if len(adj.get(k, [])) > 1: continue
    gx, gy = k[0] // 4, k[1] // 4
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for k2 in grid.get((gx + dx, gy + dy), []):
                if k2 != k and math.hypot(k[0] - k2[0], k[1] - k2[1]) <= 3: add_edge(nodes[k], nodes[k2])
print('road graph nodes', len(nodes))

def nearest(x, y):
    best, bd = None, 1e18
    for k in nodes:
        d = (k[0] - x) ** 2 + (k[1] - y) ** 2
        if d < bd: bd, best = d, k
    return best
def route(a, b):
    ka, kb = nearest(*a), nearest(*b)
    dist = {ka: 0}; prev = {}; pq = [(0, ka)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == kb: break
        if d > dist.get(u, 1e18): continue
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if kb not in dist: return [a, b]
    path = [kb]
    while path[-1] != ka: path.append(prev[path[-1]])
    return [nodes[k] for k in reversed(path)]

# ---- 実際の都市構造に基づく地点（OSM POI）----
POI = {p['n']: (p['p'][0], p['p'][1]) for p in SC['pois'] if p.get('n')}
def P(n, fb): return POI.get(n, fb)
STN = P('JR姫路駅', (-64, -1282)); SANYO = P('山陽姫路駅', (-194, -1012)); OTEMON = P('大手門', (146, -214)); CASTLE = P('姫路城 大天守', (215, 165))
KOKOEN = P('好古園', (-120, -110)); MIYUKI = P('みゆき通り商店街', (75, -758)); ART = P('姫路市立美術館', (400, 250)); OTEMAE = P('大手前通り', (64, -752))
HOTELS = [(h['p'][0], h['p'][1]) for h in SC['hotels'] if math.hypot(h['p'][0] - STN[0], h['p'][1] - STN[1]) < 1500] or [STN]
GATES = [('jr', STN, 0.55), ('sanyo', SANYO, 0.12), ('bus', (STN[0] + 60, STN[1] + 120), 0.13), ('car_e', (1900, -300), 0.12), ('car_w', (-1800, -500), 0.08)]
SPOTS = [('kokoen', KOKOEN, 0.45, 50), ('miyuki', MIYUKI, 0.55, 40), ('art', ART, 0.25, 60), ('otemae', OTEMAE, 0.35, 20)]
# 城内の滞在位置（大手門〜三の丸〜菱の門〜西の丸〜大天守〜備前丸を巡る）
CASTLE_ROUTE = [(CASTLE[0] - 37, CASTLE[1] - 465), (CASTLE[0] - 20, CASTLE[1] - 270), (CASTLE[0] - 80, CASTLE[1] - 150), (CASTLE[0] - 220, CASTLE[1] - 100), (CASTLE[0], CASTLE[1]), (CASTLE[0] - 45, CASTLE[1] - 40), (CASTLE[0] - 30, CASTLE[1] - 250), (CASTLE[0] - 37, CASTLE[1] - 465)]

def pick(items):
    r = random.random() * sum(w for _, _, w in items)
    for n, p, w in items:
        r -= w
        if r <= 0: return n, p
    return items[-1][0], items[-1][1]

def arrival_time():
    # 到着ピーク 10 時前後、13 時に第2ピーク
    if random.random() < 0.65: h = random.gauss(9.8, 1.4)
    else: h = random.gauss(13.2, 1.3)
    return max(7.0, min(17.0, h))

os.makedirs(args.out, exist_ok=True)
fn = os.path.join(args.out, 'raw_points.csv')
n_pts = 0
with open(fn, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['source_id', 'person_hash', 'timestamp', 'longitude', 'latitude', 'accuracy', 'speed', 'heading', 'source_type'])
    for i in range(args.persons):
        ph = hashlib.sha1(f'synthetic-v1:{i}'.encode()).hexdigest()[:16]
        gate_name, gate = pick(GATES)
        t = DAY + timedelta(hours=arrival_time())
        speed = random.uniform(1.0, 1.5)      # m/s
        noise = random.uniform(3, 8)          # GPS 精度 m
        plan = []
        if random.random() < 0.9: plan.append(('castle', None, random.uniform(60, 150)))
        for n, p, prob, dw in SPOTS:
            if random.random() < prob: plan.append((n, p, dw * random.uniform(0.7, 1.4)))
        random.shuffle(plan); plan = plan[:3]
        end_kind = 'hotel' if random.random() < 0.18 else 'gate'
        end_pos = random.choice(HOTELS) if end_kind == 'hotel' else (gate if random.random() < 0.8 else STN)
        pos = gate; emitted = []
        def emit(p, ts, spd, head):
            lon, lat = to_ll(p[0] + random.gauss(0, noise / 2), p[1] + random.gauss(0, noise / 2))
            emitted.append((f'{ts.isoformat()}', f'{lon:.7f}', f'{lat:.7f}', f'{noise:.1f}', f'{spd:.2f}', f'{head:.0f}'))
        def walk(a, b, ts):
            path = route(a, b); acc = 0.0; nxt = 0.0; last = a
            for j in range(len(path) - 1):
                p0, p1 = path[j], path[j + 1]; seg = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
                head = (math.degrees(math.atan2(p1[0] - p0[0], p1[1] - p0[1])) + 360) % 360
                while nxt <= acc + seg:
                    u = (nxt - acc) / seg if seg > 0 else 0
                    emit((p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u), ts + timedelta(seconds=nxt / speed), speed, head)
                    nxt += speed * args.step
                acc += seg
            return ts + timedelta(seconds=acc / speed), path[-1]
        def stay(p, ts, minutes, wander=12):
            end = ts + timedelta(minutes=minutes); cur = ts
            while cur < end:
                emit((p[0] + random.gauss(0, wander), p[1] + random.gauss(0, wander)), cur, random.uniform(0, 0.3), random.uniform(0, 360)); cur += timedelta(seconds=args.step)
            return end
        emit(pos, t, 0, 0)
        for kind, p, dwell in plan:
            if kind == 'castle':
                t, pos = walk(pos, OTEMON, t)
                # 城内: 順路の各地点で滞在（GPS は城内でも取れる想定）
                per = dwell / (len(CASTLE_ROUTE) - 1)
                for q in CASTLE_ROUTE[1:]:
                    tt = t + timedelta(minutes=per * 0.35)
                    while t < tt: emit((q[0] + random.gauss(0, 10), q[1] + random.gauss(0, 10)), t, random.uniform(0.2, 0.8), random.uniform(0, 360)); t += timedelta(seconds=args.step)
                    t = stay(q, t, per * 0.65, 8)
                pos = OTEMON
            else:
                t, pos = walk(pos, p, t); t = stay(p, t, dwell, 15); pos = p
        t, pos = walk(pos, end_pos, t)
        if end_kind == 'hotel': t = stay(end_pos, t, 40, 5)
        for e in emitted: w.writerow(['synthetic-v1', ph, *e, 'synthetic'])
        n_pts += len(emitted)
print('persons', args.persons, 'points', n_pts, '->', fn)
open(os.path.join(args.out, 'README.md'), 'w', encoding='utf-8').write(
    '# SYNTHETIC mobility data\n\n`raw_points.csv` は `infra/synthetic/generate_synthetic.py` が合成した GPS 点列です（実人流ではありません）。\n'
    f'- persons: {args.persons}, points: {n_pts}, date: {args.date}, step: {args.step}s, seed: {args.seed}\n'
    '- source_type = synthetic, source_id = synthetic-v1（DB 側の `mobility.synthetic_*` ビューで分離）\n'
    '- 参考にした都市構造: OSM 道路網（歩行）、JR姫路駅・山陽姫路駅・バスターミナル・IC、大手門〜城内順路、好古園・みゆき通り・美術館・大手前通り\n'
    '- 投入: `bash infra/sql/load_synthetic.sh`（\\copy → build_trajectories / detect_stays / build_od / compute_all_mesh_stats / refresh）\n')
