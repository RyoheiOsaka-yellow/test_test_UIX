import urllib.request, json, math, os, concurrent.futures as cf
LAT, LON = 34.9858, 138.4125
DLAT, DLON = 0.0068, 0.0075          # 約 ±750m
w0,e0 = math.radians(LON-DLON), math.radians(LON+DLON)
s0,n0 = math.radians(LAT-DLAT), math.radians(LAT+DLAT)

SETS = {
 'aoi':    ('inner.json',        'https://assets.cms.plateau.reearth.io/assets/d5/087dc5-219d-4337-9703-4314f90cd3b1/22100_shizuoka-shi_city_2023_citygml_3_op_bldg_3dtiles_22101_aoi-ku_lod1/'),
 'suruga': ('inner_suruga.json', json.load(open('base_suruga.json'))['base']),
}
def walk(n,d=0,out=None):
    if out is None: out=[]
    c=n.get('content')
    if c: out.append((d,c.get('uri'),n.get('boundingVolume',{}).get('region')))
    for ch in n.get('children',[]): walk(ch,d+1,out)
    return out
def hits(r):
    return r and not (r[2]<w0 or r[0]>e0 or r[3]<s0 or r[1]>n0)

os.makedirs('b3dm2', exist_ok=True)
jobs=[]
for tag,(idx,base) in SETS.items():
    t=json.load(open(idx))
    sel=[(u) for d,u,r in walk(t['root']) if hits(r)]
    print(tag, 'tiles', len(sel))
    jobs += [(tag, base, u) for u in sel]

def get(j):
    tag, base, u = j
    fn = f'b3dm2/{tag}_' + u.replace('/','_')
    if os.path.exists(fn): return fn, os.path.getsize(fn)
    req=urllib.request.Request(base+u, headers={'User-Agent':'Mozilla/5.0'})
    d=urllib.request.urlopen(req, timeout=180).read()
    open(fn,'wb').write(d); return fn, len(d)

with cf.ThreadPoolExecutor(8) as ex: res=list(ex.map(get, jobs))
print('downloaded', len(res), round(sum(s for _,s in res)/1e6,1),'MB')
