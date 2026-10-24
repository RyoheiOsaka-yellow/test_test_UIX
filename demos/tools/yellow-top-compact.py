# yellow-top の埋め込みデータを圧縮形式にし、読み込み時に元の GeoJSON 形へ戻す小さなデコーダを付ける
# usage: python3 yt-compact.py <in.html> <out.html> [building_tol_m]
import sys, json, re, math
IN, OUT = sys.argv[1], sys.argv[2]
TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
s = open(IN, encoding='utf-8').read()
i = s.index('window.__EMBEDDED_DATA='); j = s.index('</script>', i)
D = json.loads(s[i+len('window.__EMBEDDED_DATA='):j].rstrip().rstrip(';'))

def q1(v): return round(v*10)/10          # 0.1 m
def qi(v): return int(round(v))          # 1 m
def num(v):                               # 末尾の .0 を落として短く
    r = round(v, 1)
    return int(r) if r == int(r) else r

# --- 歩行ネットワーク: ノードは [ordinal, x, y]、リンクは [startIdx, endIdx, (中間点...)]
nodes = D['./data/nw/Shibuya_node.geojson']['features']
idx = {}
N = []
for k, f in enumerate(nodes):
    p = f['properties']; c = f['geometry']['coordinates']
    idx[p['node_id']] = k
    N.append([num(p.get('ordinal', 0) or 0), num(c[0]), num(c[1])])
L = []
for f in D['./data/nw/Shibuya_link.geojson']['features']:
    p = f['properties']; c = f['geometry']['coordinates']
    row = [idx[p['start_id']], idx[p['end_id']]]
    for m in c[1:-1]: row.append([num(m[0]), num(m[1])])
    L.append(row)
# --- 地物線（fg）: 線の配列
F = [[[num(x), num(y)] for x, y in f['geometry']['coordinates']] for f in D['./data/fg.geojson']['features']]

# --- 建物: 高さ + 外形。外形は 1m 丸め + Douglas-Peucker で間引く
def dp(pts, tol):
    if len(pts) <= 2: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2-x1, y2-y1; L2 = dx*dx+dy*dy
    best, bi = -1, 0
    for k in range(1, len(pts)-1):
        px, py = pts[k]
        if L2 == 0: d = math.hypot(px-x1, py-y1)
        else:
            t = max(0, min(1, ((px-x1)*dx+(py-y1)*dy)/L2)); d = math.hypot(px-(x1+t*dx), py-(y1+t*dy))
        if d > best: best, bi = d, k
    if best > tol:
        a = dp(pts[:bi+1], tol); b = dp(pts[bi:], tol); return a[:-1] + b
    return [pts[0], pts[-1]]
B = []
nb_pts0 = nb_pts1 = 0
for it in D['./data/urban/buildings.json']:
    r = it['r']; nb_pts0 += len(r)
    closed = r[0] == r[-1]
    ring = r[:-1] if closed else r
    ring = dp(ring + [ring[0]], TOL)[:-1] if len(ring) > 3 else ring
    ring = [[qi(x), qi(y)] for x, y in ring]
    # 丸めで潰れた連続重複を除く
    out = []
    for p in ring:
        if not out or out[-1] != p: out.append(p)
    if len(out) >= 3:
        if closed: out.append(out[0])
        nb_pts1 += len(out)
        o = dict(it); o['r'] = out; o['h'] = num(it['h']); B.append(o)
R = [{'c': r['c'], 'lv': r['lv'], 'p': [[num(x), num(y)] for x, y in r['p']]} for r in D['./data/urban/rails.json']]
# --- 駅ターミナル: そのまま（座標だけ 0.1m に）
T = {}
def qgeom(g):
    if g is None: return None
    def rec(c):
        if isinstance(c[0], (int, float)): return [num(c[0]), num(c[1])] + ([num(c[2])] if len(c) > 2 else [])
        return [rec(x) for x in c]
    return {'type': g['type'], 'coordinates': rec(g['coordinates'])}
for k, v in D.items():
    if k.startswith('./data/ShibuyaTerminal/'):
        T[k.split('ShibuyaTerminal_')[1].replace('.geojson', '')] = [[f.get('properties', {}), qgeom(f.get('geometry'))] for f in v.get('features', [])]

C = {'N': N, 'L': L, 'F': F, 'B': B, 'R': R, 'T': T}
cj = json.dumps(C, ensure_ascii=False, separators=(',', ':'))
DEC = r"""window.__EMBEDDED_DATA=(function(C){
  var fc=function(fs){return {type:"FeatureCollection",features:fs};};
  var D={};
  var ids=C.N.map(function(_,k){return "n"+k;});
  D["./data/nw/Shibuya_node.geojson"]=fc(C.N.map(function(n,k){return {type:"Feature",properties:{node_id:ids[k],ordinal:n[0]},geometry:{type:"Point",coordinates:[n[1],n[2]]}};}));
  D["./data/nw/Shibuya_link.geojson"]=fc(C.L.map(function(l){var a=C.N[l[0]],b=C.N[l[1]];var cs=[[a[1],a[2]]];for(var i=2;i<l.length;i++)cs.push(l[i]);cs.push([b[1],b[2]]);return {type:"Feature",properties:{start_id:ids[l[0]],end_id:ids[l[1]]},geometry:{type:"LineString",coordinates:cs}};}));
  D["./data/fg.geojson"]=fc(C.F.map(function(cs){return {type:"Feature",properties:{},geometry:{type:"LineString",coordinates:cs}};}));
  D["./data/urban/buildings.json"]=C.B;
  D["./data/urban/rails.json"]=C.R;
  Object.keys(C.T).forEach(function(k){D["./data/ShibuyaTerminal/ShibuyaTerminal_"+k+".geojson"]=fc(C.T[k].map(function(f){return {type:"Feature",properties:f[0],geometry:f[1]};}));});
  return D;
})("""
new_script = DEC + cj + ');'
out = s[:i] + new_script + s[j:]
open(OUT, 'w', encoding='utf-8').write(out)
print('data %dKB -> %dKB (nodes %d, links %d, fg lines %d, buildings %d: ring pts %d -> %d), file %dKB -> %dKB' % (
    (j-i)//1024, len(new_script)//1024, len(N), len(L), len(F), len(B), nb_pts0, nb_pts1, len(s)//1024, len(out)//1024))
