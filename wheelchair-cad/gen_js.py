"""model.json -> studio-core/3_wheelchair_cad.js (product data file for the shared studio core)."""
import json, sys
m = json.load(open('out/model.json'))
seq = {pid:i+1 for i,pid in enumerate(m['seq'])}
parts = sorted(m['parts'], key=lambda p: seq[p['id']])
js = []
js.append("/* ───────── design data: アクティブ車椅子 CAD 版 (CadQuery / OpenCascade B-rep から生成) ───────── */")
js.append("const MATERIALS=" + json.dumps(m['materials'], ensure_ascii=False) + ";")
js.append("const GROUPS=" + json.dumps([dict(id=g[0],name=g[1],color=g[2]) for g in m['groups']], ensure_ascii=False) + ";")
js.append("const DEFAULT_PARAMS=" + json.dumps(m['params']) + ";")
js.append("const PARAM_DEFS=[];")
js.append("""const TARGETS=[
  {k:'mass',label:'総質量',unit:'g',op:'≤',target:12000},
  {k:'width',label:'全幅 (JIS T 9201)',unit:'mm',op:'≤',target:700},
  {k:'length',label:'全長 (JIS T 9201)',unit:'mm',op:'≤',target:1200},
  {k:'height',label:'全高 (JIS T 9201)',unit:'mm',op:'≤',target:1200},
  {k:'turn',label:'回転円直径',unit:'mm',op:'≤',target:1500},
  {k:'fasteners',label:'締結部品点数 (ボルト・ナット・ピン・ニップル)',unit:'個',op:'≤',target:120}
];""")
js.append("""function decodeMesh(rec){const b=atob(rec.p),pb=new Uint8Array(b.length);for(let i=0;i<b.length;i++)pb[i]=b.charCodeAt(i);
  const c=atob(rec.i),ib=new Uint8Array(c.length);for(let i=0;i<c.length;i++)ib[i]=c.charCodeAt(i);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pb.buffer),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(ib.buffer),1));g.computeVertexNormals();return g;}""")
js.append("const CAD_PARTS=" + json.dumps([{k:v for k,v in p.items()} for p in parts], ensure_ascii=False, separators=(',',':')) + ";")
js.append("""const PART_DEFS=CAD_PARTS.map((p,i)=>({id:p.id,seq:i+1,tool:p.tool,name:p.name,en:p.en,group:p.group,mat:p.mat,mb:p.mb,color:p.color,qty:p.qty,qtyInGeom:true,shell:p.shell,pieces:p.pieces,
  build:c=>({pos:V3(0,0,0),explode:V3(0,0,0),meshes:p.inst.map(m=>({g:decodeMesh(m),ex:m.ex,vol:m.vol}))})}));
const N_STEPS=PART_DEFS.length;""")
js.append("""const PRODUCT={
  mark:'WC',name:'Wheelchair CAD Studio',tag:'· B-rep 部品 53 品番 / 254 点 · CadQuery 生成',crumbA:'Wheelchair_Product.1',crumbB:'ActiveChair_CAD Assy.1',rev:'WC-2026-B · CAD rev 01',assy:'ActiveChair CAD Assy',assyInst:'ActiveChair_CAD Assy.1',
  hasLed:false,groundY:0,logo:false,ambient:0.55,keyLight:1.25,
  makeCtx(p){const sw=p.seatWidth,sd=p.seatDepth,shf=p.seatHeightF,shr=p.seatHeightR;const ax=-sd/2+45+p.axleOffset;return {p,ax,shf,shr,center:V3(0,(shf+shr)/2,0)};},
  results(ctx,box,groupMass,total){const s=box.getSize(V3());const front=box.max.x-ctx.ax;const fast=PART_DEFS.filter(d=>/ボルト|ナット|ピン|ニップル/.test(d.name)).reduce((n,d)=>n+d.qty,0);return {mass:total,width:s.z,length:s.x,height:s.y,turn:2*Math.hypot(front,s.z/2),fasteners:fast};},
  optimizeStep(p){return false;},
  paramNote:'この CAD 版は <b>CadQuery (OpenCascade)</b> の B-rep ソリッドから生成した固定ジオメトリです。寸法パラメータの変更は <code>wheelchair-cad/wheelchair_cad.py</code> の <code>P</code> を編集して再生成してください。<br><br>生成時パラメータ: 座幅 400 / 座奥行 420 / 前座高 480 / 後座高 440 / 駆動輪 24" / キャンバー 3° / バックレスト高 380 / キャスター 5" / アクスル位置 0',
  nested:[],
  sets:[
    {name:'駆動系 (Drive)',color:'#3aa0d8',pred:d=>d.group==='A1'},
    {name:'フレーム構造材',color:'#e39b2c',pred:d=>['P-201','P-202','P-205','P-208','P-210'].includes(d.id)},
    {name:'締結部品 (ボルト / ナット / ピン)',color:'#6b6f7a',pred:d=>/ボルト|ナット|ピン/.test(d.name)},
    {name:'ベアリング',color:'#8a929e',pred:d=>/ベアリング/.test(d.name)},
    {name:'ホイール構成部品',color:'#1f2226',pred:d=>['P-101','P-102','P-103','P-104','P-105','P-106'].includes(d.id)},
    {name:'シート / 張地',color:'#8b5cd6',pred:d=>d.group==='A3'},
    {name:'走行安全部品',color:'#3fae6a',pred:d=>d.group==='A4'},
    {name:'購入品 (Buy)',color:'#3b7dd8',pred:(d,st)=>st.mb==='buy'},
    {name:'自製品 (Make)',color:'#3fae5c',pred:(d,st)=>st.mb==='make'}
  ],
  hints:'ヒント: ▶ で 53 工程の順次分解。体積・重心は OpenCascade の B-rep から取得した値です。'
};""")
open('../studio-core/3_wheelchair_cad.js','w').write("\n".join(js)+"\n")
print('js written', sum(len(x) for x in js)/1e6, 'MB; parts', len(parts), 'pieces', sum(p['pieces'] for p in parts))
