/* ================================================================
   ▼ 拡張モジュール19: ◆ 点群ビューの高品質化（v16）
   建物ファサードの高密度点サンプリング（高さ着色）、中間帯建物の輪郭点、
   公園/水面の面内サンプリング、場内の壁・床・段床の点群。
   LiDAR風のスキャンスイープ（中心からのリング）と距離減衰つき丸点シェーダー。
================================================================ */
(function(){
'use strict';
const PC={sweep:true, size:1.0, built:false, mats:[]};
function pointMat(center){
  const u={uTime:{value:0}, uC:{value:new THREE.Vector2(center[0],center[1])}, uSweep:{value:1}, uSize:{value:1}, uSpan:{value:center[2]}};
  const m=new THREE.ShaderMaterial({uniforms:u, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:['attribute vec3 pcol; varying vec3 vC; varying float vG; uniform float uTime,uSweep,uSize,uSpan; uniform vec2 uC;',
      'void main(){ vC=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0);',
      ' float r=mod(uTime*0.11,1.0)*uSpan; float d=distance(position.xz,uC);',
      ' vG=uSweep*exp(-abs(d-r)/(uSpan*0.02));',
      ' gl_PointSize=clamp(uSize*(1.6+2.2*vG)*(420.0/-mv.z)*3.0,1.0,7.0); gl_Position=projectionMatrix*mv; }'].join('\n'),
    fragmentShader:['varying vec3 vC; varying float vG; void main(){ vec2 p=gl_PointCoord-0.5; if(dot(p,p)>0.25) discard;',
      ' gl_FragColor=vec4(vC*(0.55+1.3*vG), 0.75); }'].join('\n')});
  PC.mats.push(m); return m;
}
function pointsOf(arr, cols, mat){
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr,3)); g.setAttribute('pcol', new THREE.Float32BufferAttribute(cols,3));
  const p=new THREE.Points(g, mat); p.frustumCulled=false; return p;
}
function inPoly(x,y,poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1]; if(((yi>y)!==(yj>y)) && (x<(xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c; } return c; }
const lo=new THREE.Color(0x1e5f8a), hi=new THREE.Color(0xaef3ff), tmp=new THREE.Color();
function buildSite(){
  const pos=[], col=[];
  let step=2.6, budget=230000;
  /* 建物ファサード */
  LG.bldg.children.forEach(o=>{
    if(!o.userData.fp) return; const fp=o.userData.fp, hh=o.userData.hh||8;
    for(let i=0;i<fp.length-1 && pos.length/3<budget;i++){
      const a=fp[i], b=fp[i+1], L=Math.hypot(b[0]-a[0], b[1]-a[1]), n=Math.max(1,Math.floor(L/step));
      for(let j=0;j<=n;j++){ const k=j/n, x=a[0]+(b[0]-a[0])*k, z=-(a[1]+(b[1]-a[1])*k);
        for(let y=0.6;y<hh;y+=2.0){ const r=y/hh; tmp.copy(lo).lerp(hi,r); pos.push(x+(Math.random()-0.5)*0.4, y+(Math.random()-0.5)*0.3, z+(Math.random()-0.5)*0.4); col.push(tmp.r,tmp.g,tmp.b); } }
    }
  });
  /* 中間帯建物: 輪郭点（低密度） */
  SCENE_DATA.mid.forEach(b=>{ const fp=b.p; for(let i=0;i<fp.length-1 && pos.length/3<budget+60000;i++){ const a=fp[i], c=fp[i+1], L=Math.hypot(c[0]-a[0],c[1]-a[1]), n=Math.max(1,Math.floor(L/9)); for(let j=0;j<n;j++){ const k=j/n; pos.push(a[0]+(c[0]-a[0])*k, 3+Math.random()*4, -(a[1]+(c[1]-a[1])*k)); col.push(0.12,0.36,0.52); } } });
  /* 公園・水面: 面内グリッド */
  [['park',[0.22,0.75,0.42],28],['water',[0.20,0.55,0.95],34]].forEach(cfg=>{
    (SCENE_DATA.lu[cfg[0]]||[]).forEach(poly=>{ const xs=poly.map(p=>p[0]), ys=poly.map(p=>p[1]); const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys); if((x1-x0)*(y1-y0)>3.5e6) return;
      for(let x=x0;x<x1;x+=cfg[2]) for(let y=y0;y<y1;y+=cfg[2]) if(inPoly(x,y,poly)){ pos.push(x+Math.random()*6, cfg[0]==='park'?1.2+Math.random()*3.5:0.7, -(y+Math.random()*6)); col.push(cfg[1][0],cfg[1][1],cfg[1][2]); } });
  });
  const mat=pointMat([MAIN_C.x, MAIN_C.z, 3200]);
  pcSite.add(pointsOf(pos,col,mat));
  return pos.length/3;
}
function buildInterior(){
  const I=window.__intApi; if(!I) return 0;
  const pos=[], col=[], c1=new THREE.Color(0x66e0ff), c2=new THREE.Color(0xffffff);
  const put=(x,y,z,k)=>{ tmp.copy(c1).lerp(c2,k); pos.push(x,y,z); col.push(tmp.r,tmp.g,tmp.b); };
  for(let x=-I.WX;x<=I.WX;x+=0.9){ for(let y=0.4;y<I.WH;y+=0.9){ put(x,y,-I.WZ,y/I.WH); put(x,y,I.WZ,y/I.WH); } }
  for(let z=-I.WZ;z<=I.WZ;z+=0.9){ for(let y=0.4;y<I.WH;y+=0.9){ put(-I.WX,y,z,y/I.WH); put(I.WX,y,z,y/I.WH); } }
  for(let x=-I.WX;x<=I.WX;x+=1.1) for(let z=-I.WZ;z<=I.WZ;z+=1.1){ const onCourt=Math.abs(x)<7.5&&Math.abs(z)<14; put(x+Math.random()*0.3, 0.25, z+Math.random()*0.3, onCourt?0.8:0.15); }
  /* 段床（2F 8列×4面・1F可動 6列×2面）の段鼻 */
  for(let r=0;r<8;r++){ const hx=20.5+r*0.8, hz=26.5+r*0.8, y=3.9+r*0.46; for(let z=-(hz-5);z<=hz-5;z+=0.7){ put(-hx,y,z,0.45); put(hx,y,z,0.45); } for(let x=-(hx-5);x<=hx-5;x+=0.7){ put(x,y,-hz,0.45); put(x,y,hz,0.45); } }
  for(let r=0;r<6;r++){ const x=14.2+r*0.78, y=0.4+r*0.38; for(let z=-17.9;z<=17.9;z+=0.6){ put(-x,y,z,0.6); put(x,y,z,0.6); } }
  const mat=pointMat([0,0,60]);
  pcInterior.add(pointsOf(pos,col,mat));
  return pos.length/3;
}
const baseBuildPC=buildPC;
buildPC=function(){
  baseBuildPC();
  if(PC.built) return; PC.built=true;
  PC.nSite=buildSite(); PC.nInt=buildInterior();
};
const baseSetPCMode19=setPCMode;
setPCMode=function(on){ baseSetPCMode19(on); renderPanel(); };
const baseLoop19=loop;
loop=function(now){ baseLoop19(now); if(pcMode) PC.mats.forEach(m=>{ m.uniforms.uTime.value=now/1000; m.uniforms.uSweep.value=PC.sweep?1:0; m.uniforms.uSize.value=PC.size; }); };
const baseRenderPanel19=renderPanel;
renderPanel=function(){
  baseRenderPanel19();
  if(!pcMode) return;
  pb.insertAdjacentHTML('afterbegin', '<div class="sec" id="pc-sec"><div class="sec-t"><b>◆ 点群ビュー</b> — 高密度点群'+(PC.built?'（サイト '+PC.nSite.toLocaleString()+'点・場内 '+PC.nInt.toLocaleString()+'点）':'')+'</div>'
    +'<div class="row-btns"><button class="chip '+(PC.sweep?'active':'')+'" id="pc-sweep">スキャンスイープ</button></div>'
    +'<div class="pr"><span>点サイズ</span><b id="pc-sz">'+PC.size.toFixed(1)+'</b></div><input type="range" class="rg" id="pc-size" min="0.5" max="2.5" step="0.1" value="'+PC.size+'">'
    +'<div class="hint" style="margin-top:6px">建物ファサードを2.6m×2mで面サンプリング（高さで着色）、中間帯は輪郭点、公園/水面は面内グリッド。場内は壁・床・段鼻を0.9m格子で点群化。スイープはLiDAR走査の演出。</div></div>');
  const s=document.getElementById('pc-sweep'); if(s) s.onclick=()=>{ PC.sweep=!PC.sweep; renderPanel(); };
  const r=document.getElementById('pc-size'); if(r) r.oninput=()=>{ PC.size=+r.value; document.getElementById('pc-sz').textContent=PC.size.toFixed(1); };
};
window.__pcFine=PC;
})();
