/* ================================================================
   ▼ 拡張モジュール15: ▦ 細メッシュヒートマップ（v16）
   通り単位ヒートに加え、サイト全域の格子メッシュ（25/50/100m）を追加。
   建物代理点（OSM 約1.6万点）の密度＋POI/宿泊/駅/LRT停留場のガウス核を
   静的ベースとし、アリーナ・回遊フロー・移動中エージェントを動的に加算。
   立体表示では値を高さに変換する。既存の heatMode（通常日/試合日/寄与）に従う。
================================================================ */
(function(){
'use strict';
const MH={unit:'street', size:50, solid:false, inst:null, nx:0, nz:0, base:null, dyn:null, baseMax:1, lastT:-99, lastMode:''};
const BX0=-3100, BX1=2100, BZ0=-1800, BZ1=1600;
const dots=SCENE_DATA.dots;
const grp=new THREE.Group(); LG.heat.add(grp);
const M4=new THREE.Matrix4(), Q4=new THREE.Quaternion(), P4=new THREE.Vector3(), S4=new THREE.Vector3();

function blur(a, nx, nz){
  const o=new Float32Array(a.length);
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    let s=0, w=0;
    for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
      const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=nx||jj>=nz) continue;
      const k=(di===0&&dj===0)?4:((di===0||dj===0)?2:1);
      s+=a[jj*nx+ii]*k; w+=k;
    }
    o[j*nx+i]=s/w;
  }
  return o;
}
function build(size){
  if(MH.inst){ grp.remove(MH.inst); MH.inst.geometry.dispose(); MH.inst.material.dispose(); MH.inst=null; }
  MH.size=size;
  const nx=Math.ceil((BX1-BX0)/size), nz=Math.ceil((BZ1-BZ0)/size); MH.nx=nx; MH.nz=nz;
  const geo=new THREE.BoxGeometry(size*0.92, 1, size*0.92); geo.translate(0,0.5,0);
  const inst=new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false}), nx*nz);
  inst.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(nx*nz*3), 3);
  inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled=false;
  /* 静的ベース: 建物代理点密度（ぼかし）＋ガウス核 */
  const dens=new Float32Array(nx*nz);
  for(let i=0;i<dots.length;i+=2){
    const x=dots[i], z=-dots[i+1];
    const ci=Math.floor((x-BX0)/size), cj=Math.floor((z-BZ0)/size);
    if(ci>=0&&cj>=0&&ci<nx&&cj<nz) dens[cj*nx+ci]+=1;
  }
  const bd=blur(dens,nx,nz); let dmax=0; for(let i=0;i<bd.length;i++) if(bd[i]>dmax) dmax=bd[i];
  const src=[];
  SCENE_DATA.pois.forEach(p=> src.push([p.p[0], -p.p[1], ({shop:1.0,tour:0.75,biz:0.5,edu:0.35})[p.c]||0.4, 200]));
  HOTELS.forEach(h=> src.push([h.p[0], -h.p[1], 0.34, 150]));
  src.push([stn.p[0], -stn.p[1], 1.25, 280]);
  LRT_STOPS.forEach(s=> src.push([s.p[0], -s.p[1], 0.45, 130]));
  const base=new Float32Array(nx*nz); let mx=0;
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const x=BX0+(i+0.5)*size, z=BZ0+(j+0.5)*size;
    let e=0.9*(bd[j*nx+i]/(dmax||1));
    for(const s of src){ const dx=x-s[0], dz=z-s[1], sg=s[3], d2=dx*dx+dz*dz; if(d2<sg*sg*9) e+=s[2]*Math.exp(-d2/(2*sg*sg)); }
    base[j*nx+i]=e; if(e>mx) mx=e;
  }
  MH.base=base; MH.baseMax=mx||1; MH.dyn=new Float32Array(nx*nz);
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    P4.set(BX0+(i+0.5)*size, 0.6, BZ0+(j+0.5)*size); S4.set(1,0.0001,1); M4.compose(P4,Q4,S4); inst.setMatrixAt(j*nx+i, M4);
  }
  grp.add(inst); MH.inst=inst; MH.lastT=-99; MH.lastMode='';
}
function computeDyn(t){
  const nx=MH.nx, nz=MH.nz, size=MH.size, dyn=MH.dyn; dyn.fill(0);
  const fs=[[MAIN_C.x, MAIN_C.z, arenaWeight(t), 320]];
  if(t>=325 && t<415 && typeof flowBuilt!=='undefined' && flowBuilt && typeof sampleFlow==='function'){
    FLOWS.forEach(f=>{ if(!f.total) return; for(let d=90; d<f.total; d+=90){ const p=sampleFlow(f,d); fs.push([p[0], -p[1], 0.85*f.share*(1-(t-330)/95), 140]); } });
  }
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const x=BX0+(i+0.5)*size, z=BZ0+(j+0.5)*size; let e=0;
    for(const s of fs){ const dx=x-s[0], dz=z-s[1], sg=s[3], d2=dx*dx+dz*dz; if(d2<sg*sg*9) e+=Math.max(0,s[2])*Math.exp(-d2/(2*sg*sg)); }
    dyn[j*nx+i]=e;
  }
  /* 移動中エージェントの実位置（ライブ密度） */
  if(typeof agents!=='undefined' && agentMesh.count>0){
    const ag=new Float32Array(nx*nz);
    for(let i=0;i<agentMesh.count;i++){
      agentMesh.getMatrixAt(i, M4); const x=M4.elements[12], z=M4.elements[14];
      const ci=Math.floor((x-BX0)/size), cj=Math.floor((z-BZ0)/size);
      if(ci>=0&&cj>=0&&ci<nx&&cj<nz) ag[cj*nx+ci]+=0.06*(50/size);
    }
    const b=blur(ag,nx,nz); for(let i=0;i<dyn.length;i++) dyn[i]+=b[i];
  }
}
function paint(){
  if(!MH.inst) return;
  const t=timeState.min;
  if(heatMode!=='base' && (Math.abs(t-MH.lastT)>1.5 || MH.lastMode!==heatMode)){ computeDyn(t); MH.lastT=t; }
  MH.lastMode=heatMode;
  const n=MH.nx*MH.nz, k1=1/(MH.baseMax*0.75), size=MH.size, col=MH.inst.instanceColor;
  const C=new THREE.Color();
  for(let idx=0; idx<n; idx++){
    let v;
    if(heatMode==='base')      v=Math.min(1, MH.base[idx]*k1);
    else if(heatMode==='game') v=Math.min(1, (MH.base[idx]+MH.dyn[idx])*k1*0.85);
    else                       v=Math.min(1, MH.dyn[idx]*1.15);
    const c = heatMode==='uplift' ? upC(v) : heatC(v);
    if(v<0.04){ C.setRGB(0,0,0); } else C.copy(c).multiplyScalar(0.18+0.55*v);
    col.setXYZ(idx, C.r, C.g, C.b);
    const i=idx%MH.nx, j=(idx-i)/MH.nx;
    P4.set(BX0+(i+0.5)*size, 0.6, BZ0+(j+0.5)*size);
    S4.set(1, v<0.04 ? 0.0001 : (MH.solid ? 3+v*v*110 : 0.8), 1);
    M4.compose(P4,Q4,S4); MH.inst.setMatrixAt(idx, M4);
  }
  col.needsUpdate=true; MH.inst.instanceMatrix.needsUpdate=true;
}
function applyUnit(){
  const mesh = MH.unit!=='street';
  if(mesh && (!MH.inst || MH.size!==+MH.unit)) build(+MH.unit);
  grp.visible = mesh;
  if(HEAT.obj) HEAT.obj.visible = !mesh;
  if(mesh) paint();
}
const baseRepaintHeat15=repaintHeat;
repaintHeat=function(){ baseRepaintHeat15(); if(heatMode!=='off' && MH.unit!=='street') paint(); if(HEAT.obj) HEAT.obj.visible = (MH.unit==='street'); };

const baseRenderPanel15=renderPanel;
renderPanel=function(){
  baseRenderPanel15();
  const lg=document.getElementById('heat-legend'); if(!lg) return;
  const ch=(v,l)=>'<button class="chip '+(MH.unit===v?'active':'')+'" data-hu="'+v+'">'+l+'</button>';
  lg.insertAdjacentHTML('beforebegin',
    '<div class="row-btns" id="heat-unit" style="margin-top:6px">'+ch('street','通り単位')+ch('25','メッシュ25m')+ch('50','メッシュ50m')+ch('100','メッシュ100m')
    +'<button class="chip '+(MH.solid?'active':'')+'" id="heat-solid">立体</button></div>'
    +(MH.unit!=='street' ? '<div class="hint" style="margin-top:5px">格子 '+MH.nx+'×'+MH.nz+'＝'+(MH.nx*MH.nz).toLocaleString()+'セル。ベース＝建物代理点密度（OSM）＋POI/宿泊/駅/LRT核、動的＝アリーナ・回遊フロー・移動中エージェントの実位置。</div>' : ''));
  document.querySelectorAll('#heat-unit [data-hu]').forEach(b=> b.onclick=()=>{ MH.unit=b.dataset.hu; applyUnit(); renderPanel(); });
  const sb=document.getElementById('heat-solid'); if(sb) sb.onclick=()=>{ MH.solid=!MH.solid; if(MH.inst) paint(); renderPanel(); };
};
window.__meshHeat=MH;
})();
