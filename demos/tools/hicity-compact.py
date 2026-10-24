# hicity の市街データを軽くする: 建物座標を 1m 整数に、人流軌跡を差分エンコード（読み込み時に復元）、遠景建物を半径で切る
# usage: python3 hc-compact.py <in.html> <out.html> [far_radius_m]
import sys, json, math, base64, struct
IN, OUT = sys.argv[1], sys.argv[2]
RFAR = float(sys.argv[3]) if len(sys.argv) > 3 else 3000
s = open(IN, encoding='utf-8').read()
dec = json.JSONDecoder()
ia = s.index('window.__AREA='); A, ea = dec.raw_decode(s[ia+len('window.__AREA='):])
ih = s.index('window.__HIC='); H, eh = dec.raw_decode(s[ih+len('window.__HIC='):])
a_end = ia+len('window.__AREA=')+ea; h_end = ih+len('window.__HIC=')+eh
assert ia < ih
def J(v): return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
n_area0, n_hic0 = len(J(A)), len(J(H))
# --- 建物（近景）: [h, x1,y1, ...] の座標を整数へ、連続重複を除く
bn = []
for row in A['bldNear']:
    pts = []
    for k in range(1, len(row)-1, 2):
        p = [int(round(row[k])), int(round(row[k+1]))]
        if not pts or pts[-1] != p: pts.append(p)
    if len(pts) >= 3:
        out = [row[0]]
        for p in pts: out += p
        bn.append(out)
A['bldNear'] = bn
# --- 建物（遠景）: 半径 RFAR を超えるものを落とす（6 値 1 組、x,y は 2m 単位）
b = base64.b64decode(A['bldFarB64']); n = len(b)//2; vals = list(struct.unpack('<%dh' % n, b))
keep = []
for k in range(0, n-5, 6):
    if math.hypot(vals[k]*2, vals[k+1]*2) <= RFAR: keep.extend(vals[k:k+6])
A['bldFarB64'] = base64.b64encode(struct.pack('<%dh' % len(keep), *keep)).decode(); A['bldFarN'] = len(keep)//6
far0, far1 = n//6, len(keep)//6
# --- 人流軌跡: p=[[t,x,y,z],...] を差分の平坦配列 d=[t0,x0,y0,z0, dt,dx,dy,dz, ...] に
npts = 0
for day, users in H['traj'].items():
    for uid, u in users.items():
        p = u['p']; d = []; prev = [0, 0, 0, 0]
        for pt in p:
            pt4 = [int(round(v)) for v in (pt + [0, 0, 0, 0])[:4]]
            d += [pt4[0]-prev[0], pt4[1]-prev[1], pt4[2]-prev[2], pt4[3]-prev[3]]; prev = pt4
        npts += len(p)
        u['d'] = d; del u['p']
DEC = ("(function(H){var T=H.traj||{};for(var day in T){var U=T[day];for(var uid in U){var u=U[uid],d=u.d||[],p=[],t=0,x=0,y=0,z=0;"
       "for(var i=0;i+3<d.length;i+=4){t+=d[i];x+=d[i+1];y+=d[i+2];z+=d[i+3];p.push([t,x,y,z]);}u.p=p;delete u.d;}}return H;})(")
new_area = 'window.__AREA=' + J(A)
new_hic = 'window.__HIC=' + DEC + J(H) + ')'
out = s[:ia] + new_area + s[a_end:ih] + new_hic + s[h_end:]
open(OUT, 'w', encoding='utf-8').write(out)
print('AREA %dKB -> %dKB (bldNear %d, bldFar %d -> %d), HIC %dKB -> %dKB (traj points %d), file %dKB -> %dKB' % (
    n_area0//1024, len(J(A))//1024, len(bn), far0, far1, n_hic0//1024, len(J(H))//1024, npts, len(s)//1024, len(out)//1024))
