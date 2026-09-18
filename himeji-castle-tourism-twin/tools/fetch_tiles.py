import json, subprocess, time, os, sys
EPS = ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']
def q(name, query, tries=4):
    if os.path.exists(name+'.json'):
        try:
            d=json.load(open(name+'.json')); print(name,'cached',len(d['elements'])); return d
        except Exception: pass
    for t in range(tries):
        ep = EPS[t % len(EPS)] if t>=2 else EPS[0]
        tmp = name+'.tmp'
        r = subprocess.run(['curl','-sS','-m','200','-o',tmp,'-w','%{http_code}','--data-urlencode','data='+query, ep], capture_output=True, text=True)
        code = r.stdout.strip()
        if code=='200':
            try:
                d=json.load(open(tmp)); os.replace(tmp, name+'.json'); print(name, len(d['elements']), flush=True); return d
            except Exception as e: print(name,'bad json',e, flush=True)
        else:
            print(name, ep, code, flush=True)
        time.sleep(2+3*t)
    print(name,'FAILED', flush=True); return None

def frange(a,b,s):
    x=a; out=[]
    while x<b-1e-9: out.append((x,min(b,x+s))); x+=s
    return out

SHARD=int(os.environ.get('SHARD','0')); NSHARD=int(os.environ.get('NSHARD','1'))
_ti=[0]
def tiles(name, s,w,n,e, step, body, skip=None):
    res=[]
    for (a,b) in frange(s,n,step):
        for (c,d) in frange(w,e,step):
            if skip and skip(a,b,c,d): continue
            _ti[0]+=1
            if (_ti[0] % NSHARD) != SHARD: continue
            tn=f'{name}_{a:.4f}_{c:.4f}'
            dd=q(tn, body.format(bbox=f'{a:.4f},{c:.4f},{b:.4f},{d:.4f}'))
            if dd: res.append(dd)
    return res

what = sys.argv[1]
if what=='rail':
    q('rail_ways','[out:json][timeout:120];way["railway"~"^(rail|light_rail|tram|monorail|narrow_gauge)$"](34.7800,134.6350,34.8850,134.7500);out tags geom;')
    q('rail_st','[out:json][timeout:120];node["railway"="station"](34.7790,134.6200,34.8970,134.7630);out;')
    q('aerial','[out:json][timeout:120];(node["aerialway"](34.7800,134.6350,34.8850,134.7500);way["aerialway"](34.7800,134.6350,34.8850,134.7500););out tags geom;')
elif what=='poi':
    B='34.7790,134.6200,34.8970,134.7630'
    q('hotels',f'[out:json][timeout:120];nwr["tourism"~"^(hotel|hostel|guest_house|motel|ryokan|apartment)$"]({B});out center;')
    q('attr',f'[out:json][timeout:120];nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium|theme_park|information)$"]({B});out center;')
    q('hist',f'[out:json][timeout:120];nwr["historic"]({B});out center;')
    q('shops',f'[out:json][timeout:120];nwr["shop"~"^(mall|department_store)$"]({B});out center;')
    q('amen',f'[out:json][timeout:120];nwr["amenity"~"^(bus_station|ferry_terminal|conference_centre|exhibition_centre|townhall|theatre|arts_centre|events_venue)$"]({B});out center;')
    q('ic','[out:json][timeout:120];node["highway"="motorway_junction"](34.7500,134.6000,34.9000,134.8000);out;')
    q('named','[out:json][timeout:180];nwr["name"~"書写山|書寫山|圓教寺|太陽公園|セントラルパーク|好古園|手柄山|姫路港|イーグレ|ピオレ|山陽百貨店|みゆき通り|大手前|アクリエ|廣峯|広峯|松原八幡|千姫|男山|文学館|ヤマトヤシキ|テラッソ|市役所|大手門|三の丸|菱の門|大天守|西の丸|動物園"](34.7500,134.6000,34.9000,134.8000);out center;')
elif what=='bld':
    tiles('bi',34.8225,134.6800,34.8475,134.7060,0.005,'[out:json][timeout:120];way["building"]({bbox});out tags geom;')
    inner=lambda a,b,c,d: (a>=34.8225 and b<=34.8475 and c>=134.6800 and d<=134.7060)
    tiles('bm',34.8100,134.6600,34.8600,134.7250,0.01,'[out:json][timeout:120];way["building"]({bbox});out geom;', skip=inner)
    mid=lambda a,b,c,d: (a>=34.8100 and b<=34.8600 and c>=134.6600 and d<=134.7250)
    tiles('bw',34.7790,134.6200,34.8970,134.7630,0.02,'[out:json][timeout:120];way["building"]({bbox});out ids center;', skip=mid)
print('DONE', what)
