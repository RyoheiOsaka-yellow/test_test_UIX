/* ================= ◆ 点群ビューの高品質化（参照: XBUILD 宇都宮 拡張モジュール19 の表現） =================
   ・建物ファサードを 2.6m × 2.0m で面サンプリング（高さで lo→hi に着色、固定 seed の微小ジッタ）
   ・中間帯（遠方）建物は輪郭点（低密度）、公園・森・水面・堀は面内グリッド
   ・LiDAR 風スキャンスイープ（中心＝姫路城から広がるリングが通過した点を一瞬明るく）
   ・距離減衰つき丸点シェーダ（加算合成、1〜7px）、青いグラデーション背景（#020a16 → #062c4e → #1272ac）
   既存の DSM 実測点群（REAL.pc）も同じシェーダに載せ替える。追加点は実測ではない（建物形状からの補完） */
const PCV = { sweep:true, size:1.0, built:false, mats:[], nFacade:0, nGround:0, nDsm:0, group:new THREE.Group() };
PCV.group.visible=false; scene.add(PCV.group);
function pcvMat(center, span){
  const u={ uTime:{value:0}, uC:{value:new THREE.Vector2(center[0], center[1])}, uSweep:{value:1}, uSize:{value:1}, uSpan:{value:span} };
  const m=new THREE.ShaderMaterial({ uniforms:u, vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:['varying vec3 vC; varying float vG; uniform float uTime,uSweep,uSize,uSpan; uniform vec2 uC;',
      'void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0);',
      ' float r=mod(uTime*0.11,1.0)*uSpan; float d=distance(position.xz,uC);',
      ' vG=uSweep*exp(-abs(d-r)/(uSpan*0.02));',
      ' gl_PointSize=clamp(uSize*(1.6+2.2*vG)*(420.0/-mv.z)*3.0,1.0,7.0); gl_Position=projectionMatrix*mv; }'].join('\n'),
    fragmentShader:['varying vec3 vC; varying float vG; void main(){ vec2 p=gl_PointCoord-0.5; if(dot(p,p)>0.25) discard;',
      ' gl_FragColor=vec4(vC*(0.55+1.3*vG), 0.75); }'].join('\n') });
  PCV.mats.push(m); return m;
}
function pcvPoints(pos, col, mat){ const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); const p=new THREE.Points(g, mat); p.frustumCulled=false; return p; }
function pcvInPoly(x, y, poly){ let c=false; for(let i=0, j=poly.length-1; i<poly.length; j=i++){ const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1]; if(((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c; } return c; }
function pcvBuild(){
  if(PCV.built) return; PCV.built=true;
  const rnd=mulberry32(1993); const lo=new THREE.Color(0x1e5f8a), hi=new THREE.Color(0xaef3ff), gold=new THREE.Color(0xffd166), gw=new THREE.Color(0xfff6d6), tmp=new THREE.Color();
  const pos=[], col=[]; const budget=(window.TWIN_CONFIG&&TWIN_CONFIG.pcView&&TWIN_CONFIG.pcView.budget)||900000; const R2=2600*2600;
  /* 建物ファサード: PLATEAU LOD1（PL.ext, 計測高さ）を主に、OSM 建物（SCENE_DATA.buildings）は PLATEAU 外の補完。中心 2.6km は面サンプリング、外側は輪郭点 */
  const plateau=(typeof PL!=='undefined' && PL.ext && PL.ext.length) ? PL.ext.filter(b=>!b.keep).map(b=>({p:b.p, h:b.h, k:b.c?'castle':'', src:'plateau'})) : [];
  const osm = plateau.length ? SCENE_DATA.buildings.filter(b=>{ const q=b.p[0]; return (q[0]*q[0]+q[1]*q[1])>=R2; }) : SCENE_DATA.buildings;
  for(const b of plateau.concat(osm)){
    if(pos.length/3 > budget) break; const fp=b.p, hh=Math.max(3, b.h||8); const q=fp[0]; const near=(q[0]*q[0]+q[1]*q[1])<R2; const castle=b.k==='castle';
    const step=castle?1.8:near?2.6:9, vstep=castle?1.5:near?2.0:4;
    for(let i=0;i<fp.length;i++){ const a=fp[i], c=fp[(i+1)%fp.length]; const L=Math.hypot(c[0]-a[0], c[1]-a[1]); const n=Math.max(1, Math.floor(L/step));
      for(let j=0;j<=n;j++){ const k=j/n, x=a[0]+(c[0]-a[0])*k, y=a[1]+(c[1]-a[1])*k; const base=TH(x,-y);
        for(let h=0.6; h<hh; h+=vstep){ const r=h/hh; if(castle) tmp.copy(gold).lerp(gw, r); else tmp.copy(lo).lerp(hi, r);
          pos.push(x+(rnd()-0.5)*0.4, base+h+(rnd()-0.5)*0.3, -y+(rnd()-0.5)*0.4); col.push(tmp.r, tmp.g, tmp.b); }
        if(!near && !castle) break; } }
  }
  PCV.nFacade=pos.length/3;
  /* 公園・森・水面・堀: 面内グリッド */
  const gpos=[], gcol=[]; const luCol={park:0x2f8f6a, forest:0x226a52, water:0x1f5fb8, moat:0x2a78d6, edu:0x3a6d8a, retail:0x4a6d9a};
  for(const key of Object.keys(luCol)){ const polys=SCENE_DATA.lu[key]||[]; tmp.setHex(luCol[key]); const gs = (key==='water'||key==='moat') ? 5 : 7;
    for(const poly of polys){ if(gpos.length/3>400000) break; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of poly){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
      if((x1-x0)*(y1-y0) > 4e6) continue;   // 巨大ポリゴンは飛ばす
      for(let x=x0; x<=x1; x+=gs) for(let y=y0; y<=y1; y+=gs){ const jx=x+(rnd()-0.5)*gs*0.6, jy=y+(rnd()-0.5)*gs*0.6; if(!pcvInPoly(jx,jy,poly)) continue; const lift=(key==='forest')?4+rnd()*6:(key==='park')?0.6+rnd()*1.2:0.25;
        gpos.push(jx, TH(jx,-jy)+lift, -jy); const k=(key==='forest'||key==='park')?0.7+rnd()*0.3:0.8+rnd()*0.2; gcol.push(tmp.r*k, tmp.g*k, tmp.b*k); } } }
  PCV.nGround=gpos.length/3;
  const mat=pcvMat([CASTLE.x, CASTLE.z], 3600);
  PCV.group.add(pcvPoints(pos, col, mat)); PCV.group.add(pcvPoints(gpos, gcol, mat));
  /* 既存の DSM 点群（REAL.pc）とレイヤー補完点も同じスイープ材質へ */
  pcGroup.children.forEach(p=>{ if(p.isPoints && p.geometry.getAttribute('color')){ p.userData.pcvOrig=p.material; p.material=pcvMat([CASTLE.x, CASTLE.z], 3600); PCV.nDsm += p.geometry.getAttribute('position').count; } });
}
/* 既存 buildPC / setPCMode を拡張 */
const _pcvBaseSetPC = setPCMode;
setPCMode = function(on){
  _pcvBaseSetPC(on);
  if(on){ if(!PCV.built) pcvBuild(); PCV.group.visible=true; wrap.classList.add('pc-grad'); pcvHideSolids(true);
    if(window.twinPcl && twinPcl.mode!=='LIDAR'){ PCV.prevPclMode=twinPcl.mode; twinPcl.mode='LIDAR'; pclApplyMode(); } }
  else { PCV.group.visible=false; pcvHideSolids(false); if(window.twinPcl && PCV.prevPclMode){ twinPcl.mode=PCV.prevPclMode; PCV.prevPclMode=null; pclApplyMode(); } }
  renderPanel();
};
/* 点群ビューでは PLATEAU の面（LOD1/LOD2）・土地利用面・道路面・補完ディテールを隠し、点だけにする（参照表現） */
function pcvHideSolids(on){
  if(typeof PL!=='undefined'){ PL.group.visible=!on; PL.lu.visible=!on && LAYER_STATE.plu; PL.road.visible=!on && LAYER_STATE.proad; }
  if(typeof urbanDetail!=='undefined') urbanDetail.visible=!on && level!=='wide';
  if(!on && typeof syncRefinement==='function') syncRefinement();
}
function pcvTick(now){ if(!pcMode) return; if(typeof PL!=='undefined') PL.group.visible=false; if(typeof urbanDetail!=='undefined') urbanDetail.visible=false; PCV.mats.forEach(m=>{ m.uniforms.uTime.value=now/1000; m.uniforms.uSweep.value=PCV.sweep?1:0; m.uniforms.uSize.value=PCV.size; }); }
function pcvSec(){
  if(!pcMode) return '';
  return `<div class="sec" id="pcv-sec"><div class="sec-t"><b>◆ 点群ビュー</b> — 高密度点群${PCV.built?`（ファサード ${fmt(PCV.nFacade)} 点・地表 ${fmt(PCV.nGround)} 点${PCV.nDsm?`・DSM ${fmt(PCV.nDsm)} 点`:''}）`:''}</div>
    <div class="row-btns"><button class="chip ${PCV.sweep?'active':''}" id="pcv-sweep">スキャンスイープ</button></div>
    <div class="studio-label" style="margin:6px 0 4px">点サイズ <output id="pcv-sz">${PCV.size.toFixed(1)}</output></div><input type="range" id="pcv-size" min="0.5" max="2.5" step="0.1" value="${PCV.size}" style="width:100%">
    <div class="hint" style="margin-top:6px">建物ファサードを 2.6m×2.0m で面サンプリング（高さで着色、姫路城は金）、外周は輪郭点、公園・森・水面・堀は面内グリッド。兵庫県 DSM の実測点群は同じ材質で表示。スイープは LiDAR 走査の演出（実測ではありません）。人流粒子は LIDAR モードに切替。</div></div>`;
}
function bindPcv(){ const s=document.getElementById('pcv-sweep'); if(s) s.onclick=()=>{ PCV.sweep=!PCV.sweep; renderPanel(); }; const r=document.getElementById('pcv-size'); if(r) r.oninput=()=>{ PCV.size=+r.value; document.getElementById('pcv-sz').value=PCV.size.toFixed(1); }; }
window.twinPcv = PCV;
