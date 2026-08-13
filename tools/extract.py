import struct, json, glob, math, os
import numpy as np, DracoPy
from pyproj import Transformer

LAT0, LON0, H0 = 34.9858, 138.4125, 0.0     # JR東静岡駅北口市有地（アリーナ予定地）付近
RADIUS = 600.0

to_ecef = Transformer.from_crs('EPSG:4326','EPSG:4978', always_xy=True)
X0, Y0, Z0 = to_ecef.transform(LON0, LAT0, H0)
la, lo = math.radians(LAT0), math.radians(LON0)
sla, cla, slo, clo = math.sin(la), math.cos(la), math.sin(lo), math.cos(lo)
R = np.array([[-slo,        clo,       0.0],
              [-sla*clo, -sla*slo,     cla],
              [ cla*clo,  cla*slo,     sla]])

def read_b3dm(path):
    d = open(path,'rb').read()
    _,_,_,ftJ,ftB,btJ,btB = struct.unpack('<4sIIIIII', d[:28])
    o = 28+ftJ+ftB
    bt = json.loads(d[o:o+btJ]) if btJ else {}
    o += btJ+btB
    glb = d[o:]
    _,_,glen = struct.unpack('<4sII', glb[:12]); p=12; ch=[]
    while p < glen:
        cl,ct = struct.unpack('<II', glb[p:p+8]); p+=8; ch.append((ct,cl,p)); p+=cl
    gj = json.loads(glb[ch[0][2]:ch[0][2]+ch[0][1]])
    binoff = ch[1][2]
    return bt, gj, glb, binoff

def decode_prim(gj, glb, binoff, prim):
    ext = prim['extensions']['KHR_draco_mesh_compression']
    bv = gj['bufferViews'][ext['bufferView']]
    s = binoff + bv.get('byteOffset',0)
    m = DracoPy.decode(glb[s:s+bv['byteLength']])
    attrs = {a['unique_id']: a for a in m.attributes}
    pos = np.asarray(attrs[ext['attributes']['POSITION']]['data'], dtype=np.float64)
    bid = np.asarray(attrs[ext['attributes']['_BATCHID']]['data'], dtype=np.int64).ravel()
    faces = np.asarray(m.faces, dtype=np.int64)
    return pos, bid, faces

def to_enu(pos, rtc):
    # glTF は Y-up。3D Tiles の ECEF は Z-up なので (x, y, z) -> (x, -z, y)
    ecef = np.empty_like(pos)
    ecef[:,0] = pos[:,0] + rtc[0]
    ecef[:,1] = -pos[:,2] + rtc[1]
    ecef[:,2] = pos[:,1] + rtc[2]
    d = ecef - np.array([X0,Y0,Z0])
    return d @ R.T

def weld(verts, tris, tol=0.001):
    """Draco 出力は三角形ごとに頂点が複製されている。位置で溶接しないと
       「境界エッジは1回だけ現れる」判定が全エッジで成立してしまう。"""
    q = np.round(verts / tol).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    return verts[first], inv[tris]

def roof_ring(verts, tris, ztop):
    """屋根面（上端付近）の三角形集合から境界エッジを拾って外周ループを作る"""
    sel = tris[(verts[tris[:,0],2] > ztop-0.6) &
               (verts[tris[:,1],2] > ztop-0.6) &
               (verts[tris[:,2],2] > ztop-0.6)]
    if len(sel)==0: return None
    cnt = {}
    for t in sel:
        for a,b in ((t[0],t[1]),(t[1],t[2]),(t[2],t[0])):
            k = (a,b) if a<b else (b,a)
            cnt[k] = cnt.get(k,0)+1
    edges = [k for k,v in cnt.items() if v==1]
    if len(edges) < 3: return None
    adj = {}
    for a,b in edges:
        adj.setdefault(a,[]).append(b); adj.setdefault(b,[]).append(a)
    loops=[]; used=set()
    for start in adj:
        if start in used: continue
        loop=[start]; used.add(start); prev=None; cur=start
        while True:
            nxt=[x for x in adj[cur] if x!=prev]
            if not nxt: break
            step = next((x for x in nxt if x not in used), None)
            if step is None:
                break                     # 出発点へ戻って閉路が閉じた
            loop.append(step); used.add(step); prev=cur; cur=step
        if len(loop)>=3: loops.append(loop)
    if not loops: return None
    def area(l):
        r=verts[l][:,:2]
        return abs(sum(r[i,0]*r[(i+1)%len(r),1]-r[(i+1)%len(r),0]*r[i,1] for i in range(len(r))))/2
    loop=max(loops, key=area)             # 最大面積のループを外周とみなす
    return verts[loop][:,:2]

def simplify(ring, tol=0.35):
    """共線頂点の除去"""
    out=[]
    n=len(ring)
    for i in range(n):
        a,b,c = ring[i-1], ring[i], ring[(i+1)%n]
        v1=b-a; v2=c-b
        l1=math.hypot(*v1); l2=math.hypot(*v2)
        if l1<1e-6 or l2<1e-6: continue
        cross=abs(v1[0]*v2[1]-v1[1]*v2[0])/(l1*l2)
        if cross>0.02 or l1>25: out.append(b)
    return np.array(out) if len(out)>=3 else ring

def num(v):
    try: return float(v)
    except: return None

buildings={}
files=sorted(glob.glob('b3dm2/*.b3dm'))
for fi,f in enumerate(files):
    bt, gj, glb, binoff = read_b3dm(f)
    rtc = gj.get('extensions',{}).get('CESIUM_RTC',{}).get('center',[0,0,0])
    def col(k):
        # バイナリ batch table（dict）で来る場合があるのでリスト以外は捨てる
        v = bt.get(k)
        return v if isinstance(v, list) else []
    gml = col('gml_id'); hh = col('bldg:measuredHeight'); us = col('bldg:usage')
    st  = col('bldg:storeysAboveGround'); yr = col('bldg:yearOfConstruction')
    for mesh in gj['meshes']:
        for prim in mesh['primitives']:
            if 'KHR_draco_mesh_compression' not in prim.get('extensions',{}): continue
            pos,bid,faces = decode_prim(gj, glb, binoff, prim)
            enu = to_enu(pos, rtc)
            order = np.argsort(bid, kind='stable')
            b_sorted = bid[order]
            uniq, starts = np.unique(b_sorted, return_index=True)
            vert_of = {}
            for i,b in enumerate(uniq):
                e = starts[i+1] if i+1<len(starts) else len(b_sorted)
                vert_of[int(b)] = order[starts[i]:e]
            face_b = bid[faces[:,0]]
            for b in uniq:
                b=int(b)
                idx = vert_of[b]
                v = enu[idx]
                cx, cy = float(v[:,0].mean()), float(v[:,1].mean())
                if math.hypot(cx,cy) > RADIUS: continue
                gid = gml[b] if 0 <= b < len(gml) else f'{fi}_{b}'
                if gid in buildings: continue
                tri = faces[face_b==b]
                remap = -np.ones(len(enu), dtype=np.int64)
                remap[idx] = np.arange(len(idx))
                tri = remap[tri]
                if (tri<0).any(): continue
                v, tri = weld(v, tri)
                ztop, zbot = float(v[:,2].max()), float(v[:,2].min())
                ring = roof_ring(v, tri, ztop)
                if ring is None or len(ring)<3: continue
                ring = simplify(ring)
                buildings[gid] = dict(
                    ring=[[round(float(x),1), round(float(y),1)] for x,y in ring],
                    base=round(zbot,1), h=round(ztop-zbot,1),
                    mh=num(hh[b]) if 0 <= b < len(hh) else None,
                    usage=(us[b] if 0 <= b < len(us) else None),
                    storeys=num(st[b]) if 0 <= b < len(st) else None,
                    year=num(yr[b]) if 0 <= b < len(yr) else None,
                )
    print(f'{fi+1}/{len(files)}', os.path.basename(f), '->', len(buildings))

out = dict(origin=dict(lat=LAT0, lon=LON0), radius=RADIUS,
           source='PLATEAU 22101 静岡市葵区 建築物モデル LOD1 (2023)',
           buildings=list(buildings.values()))
json.dump(out, open('shizuoka_ctx.json','w'), separators=(',',':'))
print('buildings', len(out['buildings']), 'size', round(os.path.getsize('shizuoka_ctx.json')/1024,1),'KB')
hs=[b['h'] for b in out['buildings']]
print('height min/med/max', round(min(hs),1), round(sorted(hs)[len(hs)//2],1), round(max(hs),1))
print('ring len avg', round(sum(len(b['ring']) for b in out['buildings'])/len(out['buildings']),1))
