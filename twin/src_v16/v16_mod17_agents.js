/* ================================================================
   ▼ 拡張モジュール17: 🚶 人の動きの高品質化（v16）
   メッシュ起点（OD細分化）から道路網の最短経路で来場するエージェントを追加
   （経路は1フレーム1本ずつ遅延計算）、人型カプセル形状、フェード軌跡、
   LRT車両・JR列車の走行、群れ（同時スポーンの横並び）。
================================================================ */
(function(){
'use strict';
/* --- 人型ジオメトリ（胴＋頭）へ差替 --- */
function mergeGeos(list){
  const pos=[], nor=[], idx=[]; let off=0;
  list.forEach(g=>{ const ng=g.toNonIndexed(); const p=ng.attributes.position.array, n=ng.attributes.normal.array;
    for(let i=0;i<p.length;i++){ pos.push(p[i]); nor.push(n[i]); } for(let i=0;i<p.length/3;i++) idx.push(off+i); off+=p.length/3; ng.dispose(); });
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3)); geo.setIndex(idx); return geo;
}
(function(){
  const body=new THREE.CylinderGeometry(0.55,0.7,1.7,7); body.translate(0,0.85,0);
  const head=new THREE.SphereGeometry(0.55,7,6); head.translate(0,2.05,0);
  const g=mergeGeos([body,head]);
  const old=agentMesh.geometry; agentMesh.geometry=g; old.dispose();
})();

/* --- メッシュ起点 → 道路網経路（遅延計算） --- */
const OF=window.__odFine;
const gate=[PLAZA.x-PLAZA.w/2-6, PLAZA.z];
const pending=[];
let hubW=0; ORIGINS.forEach(o=>{ hubW+=o.w; });
ORIGINS.forEach(o=>{ o.w = o.w*0.6/(hubW||1); });   /* 既存ハブ起点 60% */
const ZONE_TOTAL=0.4, zoneOrigins=[];
if(OF){ OF.zones.slice(0,24).forEach(z=> pending.push(z)); }
const hubPaths=ORIGINS.slice(0,5).map(o=>o.path);
function zonePath(z){
  /* 1) 道路網A*（起点をアリーナ側へ少しずらして最大4回試行） */
  for(let k=0;k<4;k++){
    const f=k*0.08, x=z.x+(gate[0]-z.x)*f, zz=z.z+(gate[1]-z.z)*f;
    let p=null; try{ p=roadGraph.path(x, zz, gate[0], gate[1]); }catch(e){}
    if(p && p.length>=2){ if(k>0) p.unshift([z.x,z.z]); return p; }
  }
  /* 2) フォールバック: 最寄りのハブ経路へ直線で合流し、その先を共有 */
  let best=null, bd=1e18;
  hubPaths.forEach(hp=>{ hp.forEach((q,i)=>{ const d=(q[0]-z.x)**2+(q[1]-z.z)**2; if(d<bd){ bd=d; best=[hp,i]; } }); });
  if(!best) return null;
  return [[z.x,z.z]].concat(best[0].slice(best[1]));
}
function addZoneOrigin(z){
  let pth=zonePath(z);
  if(!pth || pth.length<2) return;
  if(Math.hypot(pth[pth.length-1][0]-(GATE.x-6), pth[pth.length-1][1]-GATE.z)>2) pth.push([GATE.x-6, GATE.z]);
  let total=0; const seg=[0];
  for(let i=1;i<pth.length;i++){ total+=Math.hypot(pth[i][0]-pth[i-1][0], pth[i][1]-pth[i-1][1]); seg.push(total); }
  const o={name:'メッシュ '+z.name, x:z.x, z:z.z, w:0, color: z.hub?z.hub.col:0x9ab0ff, path:pth, seg, total, share:z.share};
  ORIGINS.push(o); zoneOrigins.push(o);
  const shSum=zoneOrigins.reduce((a,q)=>a+q.share,0);
  zoneOrigins.forEach(q=>{ q.w=ZONE_TOTAL*q.share/shSum; });
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pth.map(p=>new THREE.Vector3(p[0],1.1,p[1]))),
    new THREE.LineBasicMaterial({color:o.color, transparent:true, opacity:0.18}));
  siteGroup.add(line);
}

/* --- フェード軌跡 --- */
const TR=3;
const trail=new THREE.InstancedMesh(new THREE.SphereGeometry(0.75,5,4), new THREE.MeshBasicMaterial({transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false}), MAX_AG*TR);
trail.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(MAX_AG*TR*3),3); trail.instanceColor.setUsage(THREE.DynamicDrawUsage);
trail.count=0; trail.frustumCulled=false; scene.add(trail);
const M=new THREE.Matrix4(), C=new THREE.Color();
const baseUpdateAgents=updateAgents;
updateAgents=function(dtMin){
  baseUpdateAgents(dtMin);
  let ti=0;
  for(let i=0;i<agents.length;i++){
    const a=agents[i]; agentMesh.getMatrixAt(i,M); const x=M.elements[12], z=M.elements[14];
    if(!a.h) a.h=[];
    const lp=a.h[a.h.length-1];
    if(!lp || Math.hypot(lp[0]-x, lp[1]-z)>7){ a.h.push([x,z]); if(a.h.length>TR) a.h.shift(); }
    for(let k=0;k<a.h.length;k++){
      const f=(k+1)/(a.h.length+1);
      M.makeTranslation(a.h[k][0], 1.4, a.h[k][1]); M.scale(new THREE.Vector3(f,f,f));
      trail.setMatrixAt(ti,M); C.copy(a.col).multiplyScalar(0.18+0.35*f); trail.setColorAt(ti,C); ti++;
    }
  }
  trail.count=ti; trail.instanceMatrix.needsUpdate=true; trail.instanceColor.needsUpdate=true;
};

/* --- 車両: LRT（railTram）・JR（railJR） --- */
const VG=new THREE.Group(); scene.add(VG);
function polyLen(p){ let L=0; for(let i=1;i<p.length;i++) L+=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); return L; }
function sampleAt(p, d){ let acc=0; for(let i=1;i<p.length;i++){ const L=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); if(acc+L>=d){ const k=(d-acc)/L; return [p[i-1][0]+(p[i][0]-p[i-1][0])*k, p[i-1][1]+(p[i][1]-p[i-1][1])*k, p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]]; } acc+=L; } const q=p[p.length-1]; return [q[0],q[1],1,0]; }
const vehicles=[];
function mkTrain(cars, len, col, roofCol, h){
  const g=new THREE.Group();
  for(let i=0;i<cars;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(len, h, 2.7), new THREE.MeshStandardMaterial({color:col, roughness:0.4, metalness:0.3, emissive:col, emissiveIntensity:0.25}));
    b.position.set(-(cars-1)*len/2 + i*(len+0.8), h/2+0.8, 0); g.add(b);
    const r=new THREE.Mesh(new THREE.BoxGeometry(len-0.4, 0.3, 2.4), new THREE.MeshStandardMaterial({color:roofCol, roughness:0.6})); r.position.set(b.position.x, h+0.95, 0); g.add(r);
  }
  return g;
}
const toWorld=poly=>poly.map(p=>[p[0], -p[1]]);
const tramLines=SCENE_DATA.railTram.map(toWorld).sort((a,b)=>polyLen(b)-polyLen(a)).slice(0,3);
tramLines.forEach((p,i)=>{ const L=polyLen(p); if(L<300) return; const m=mkTrain(2, 14, 0xf5c400, 0x111111, 3.4); VG.add(m); vehicles.push({p, L, d:(i*0.37%1)*L, dir:1, v:45, m}); });
const jrLines=SCENE_DATA.railJR.map(toWorld).sort((a,b)=>polyLen(b)-polyLen(a)).slice(0,2);
jrLines.forEach((p,i)=>{ const L=polyLen(p); const m=mkTrain(4, 20, 0xe8ecf4, 0x2a3a66, 3.8); VG.add(m); vehicles.push({p, L, d:(0.5+i*0.3)%1*L, dir:1, v:80, m}); });
const UP=new THREE.Vector3(1,0,0);
let lastV=performance.now();
const baseLoop17=loop;
loop=function(now){
  baseLoop17(now);
  const dt=Math.min(0.1,(now-lastV)/1000); lastV=now;
  VG.visible = level!=='arena';
  vehicles.forEach(v=>{
    v.d+=v.dir*v.v*dt; if(v.d>v.L){ v.d=v.L; v.dir=-1; } if(v.d<0){ v.d=0; v.dir=1; }
    const s=sampleAt(v.p, v.d); v.m.position.set(s[0], 0, s[1]);
    const dir=new THREE.Vector3(s[2],0,s[3]).normalize(); if(v.dir<0) dir.negate(); v.m.quaternion.setFromUnitVectors(UP, dir);
  });
  /* 経路の遅延計算: 1フレーム1本 */
  if(pending.length){ const z=pending.shift(); try{ addZoneOrigin(z); }catch(e){} }
};
const baseSetLevel17=setLevel;
setLevel=function(lv,fly){ baseSetLevel17(lv,fly); trail.visible = level!=='arena'; VG.visible = level!=='arena'; };
window.__agentsExt={vehicles, zoneOrigins, pending};
})();
