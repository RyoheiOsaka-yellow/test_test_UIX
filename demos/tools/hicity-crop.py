# hicity の市街データを中心からの半径で切り詰めた版を作る（usage: hicity-crop.py <radius_m> <out.html>）
import sys, json, math, base64, struct, re
R=float(sys.argv[1]); OUT=sys.argv[2]
hc=open('/home/user/test_test_UIX/demos/src/hicity.html',encoding='utf-8').read()
i=hc.find('window.__AREA='); s=hc[i+len('window.__AREA='):]
A,end=json.JSONDecoder().raw_decode(s)
def inside(p): return math.hypot(p[0],p[1])<=R
def keep_line(line): return any(inside(p) for p in line)
def filt_lines(v): return [l for l in v if keep_line(l)]
n0=len(json.dumps(A,separators=(',',':')))
A['roads']=[filt_lines(t) for t in A['roads']]
for k in ['green','waterFill','waterLine','rail','motorway','taxiways','aprons','boundary']:
    if k in A and isinstance(A[k],list) and A[k] and isinstance(A[k][0],list): A[k]=filt_lines(A[k])
if 'runways' in A: A['runways']=[d for d in A['runways'] if keep_line(d['p'])]
if 'stations' in A: A['stations']=[d for d in A['stations'] if (isinstance(d,dict) and 'p' in d and inside(d['p'])) or not isinstance(d,dict)]
b=base64.b64decode(A['bldFarB64']); n=len(b)//2; vals=list(struct.unpack('<%dh'%n,b))
keep=[]
for k in range(0,n-5,6):
    if math.hypot(vals[k]*2,vals[k+1]*2)<=R: keep.extend(vals[k:k+6])
A['bldFarB64']=base64.b64encode(struct.pack('<%dh'%len(keep),*keep)).decode(); A['bldFarN']=len(keep)//6
txt=json.dumps(A,ensure_ascii=False,separators=(',',':'))
out=hc[:i]+'window.__AREA='+txt+s[end:]
open(OUT,'w',encoding='utf-8').write(out)
print(f'R={R:.0f}: __AREA {n0>>10}KB -> {len(txt)>>10}KB, file {len(out)>>10}KB, bldFar {n//6} -> {len(keep)//6}')
