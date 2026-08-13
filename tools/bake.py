"""PLATEAU 抽出結果 + OSM 道路 + ランドマークを、単一 HTML へ埋め込める最小形式に圧縮する。
   すべて原点からのデシメートル整数。"""
import json, math, os
B = json.load(open('shizuoka_ctx.json'))
Rd = json.load(open('shizuoka_roads.json'))
DM = lambda v: int(round(v*10))

usages = sorted({b['usage'] for b in B['buildings'] if b['usage']})
uidx = {u:i for i,u in enumerate(usages)}

bl = []
for b in B['buildings']:
    r = b['ring']
    if len(r) < 3: continue
    rec = [DM(b['base']), DM(b['h']),
           uidx.get(b['usage'], -1),
           int(b['storeys']) if b['storeys'] else 0,
           int(b['year']) if (b['year'] and b['year'] > 1800) else 0,
           DM(b['mh']) if b['mh'] else 0,
           len(r)]
    px = py = 0
    for x, y in r:
        X, Y = DM(x), DM(y)
        rec += [X-px, Y-py]          # 差分符号化
        px, py = X, Y
    bl.append(rec)

rw = []
for w in Rd['ways']:
    p = w['pts']
    rec = [1 if w['walk'] else 0, len(p)]
    px = py = 0
    for x, y in p:
        X, Y = DM(x), DM(y)
        rec += [X-px, Y-py]
        px, py = X, Y
    rw.append(rec)

LANDMARKS = [
    ["JR東静岡駅",           34.98423, 138.41308, "station"],
    ["静鉄長沼駅",           34.98894, 138.41258, "station"],
    ["グランシップ",         34.98570, 138.41710, "poi"],
    ["バンダイホビーセンター", 34.98936, 138.41160, "poi"],
    ["東静岡駅北口公園",     34.98643, 138.41397, "poi"],
]
def enu(lat, lon):
    return ((lon-138.4125)*111320.0*math.cos(math.radians(34.9858)),
            (lat-34.9858)*111320.0)
lm = [[n, DM(enu(la,lo)[0]), DM(enu(la,lo)[1]), k] for n,la,lo,k in LANDMARKS]

out = dict(
    v=1,
    origin=B['origin'],
    radius=B['radius'],
    source='PLATEAU 静岡市 建築物モデル LOD1 (2023) 22101葵区 / 22102駿河区 + OpenStreetMap',
    usages=usages,
    buildings=bl,
    roads=rw,
    landmarks=lm,
)
json.dump(out, open('shizuoka_site.json','w'), separators=(',',':'))
print('buildings', len(bl), 'roads', len(rw), 'landmarks', len(lm))
print('size', round(os.path.getsize('shizuoka_site.json')/1024,1), 'KB')
