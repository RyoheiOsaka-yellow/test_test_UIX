/* ================================================================
   ▼ 拡張モジュール9: 🏛 外観調整 — 実写準拠化ツール（v14）
   OSM足跡は実測だが屋根形状・開口リズムは写真からの読み取りが必要なため、
   パラメトリック屋根（フラット/アーチ/切妻・ライズ・軸・色）、カーテンウォールの
   方立ピッチ/帯高さ、立面写真・航空写真のトレース用オーバーレイ、
   パラメータのlocalStorage/JSON保存を提供する。値は写真と照合して調整する前提。
================================================================ */
(function(){
'use strict';
const api=window.__extApi; if(!api) return;
const LS='brex_ext_params_v14';
const P=Object.assign({roof:'flat', rise:7, axis:'x', roofColor:'gray', pitch:1.6, bandH:3.0, bandY:2.4,
  elevFace:'W', elevOp:0.6, elevW:60, elevH:20, elevY:10, elevOff:0,
  aerialOp:0.55, aerialW:260, aerialRot:0, aerialX:0, aerialZ:0},
  (function(){ try{ return JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){ return {}; } })());
function save(){ try{ localStorage.setItem(LS, JSON.stringify(P)); }catch(e){} }

const A=api.A, ext=api.group;
const xs=A.main.map(p=>p[0]), ys=A.main.map(p=>p[1]);
const L=Math.max(...xs)-Math.min(...xs), W=Math.max(...ys)-Math.min(...ys);
const CX=(Math.max(...xs)+Math.min(...xs))/2, CZ=-(Math.max(...ys)+Math.min(...ys))/2;
const ROOF_COL={gray:0x2e3548, white:0xc9ced9, dark:0x161a24, brex:0x8a7000};

/* --- パラメトリック屋根 --- */
const roofG=new THREE.Group(); ext.add(roofG);
function buildRoof(){
  while(roofG.children.length){ const c=roofG.children.pop(); c.geometry.dispose(); }
  api.roofMat.color.setHex(ROOF_COL[P.roofColor]||ROOF_COL.gray);
  api.roofCap.visible = (P.roof==='flat');
  if(window.__extRim) window.__extRim.position.y = (P.roof==='flat') ? 21.3 : 19.9;
  if(P.roof==='flat') return;
  const alongX=(P.axis==='x');                  /* 稜線/母線の方向 */
  const len=(alongX?L:W)+2.0, span=(alongX?W:L)+1.2, rise=P.rise;
  const mat=new THREE.MeshStandardMaterial({color:ROOF_COL[P.roofColor]||ROOF_COL.gray, roughness:0.42, metalness:0.55, side:THREE.DoubleSide});
  if(P.roof==='vault'){
    const R=(span*span/4+rise*rise)/(2*rise), th=Math.asin(Math.min(1, span/2/R));
    const g=new THREE.CylinderGeometry(R,R,len,64,1,true, -th, 2*th);
    const m=new THREE.Mesh(g, mat);
    /* 円筒軸(局所Y)→稜線方向、弧の中央(局所+Z)→上方 */
    if(alongX) m.rotation.set(-Math.PI/2, 0, -Math.PI/2, 'XYZ'); else m.rotation.set(-Math.PI/2, 0, 0);
    m.position.set(CX, 20-(R-rise), CZ);
    roofG.add(m);
    /* 妻面（弧の端を塞ぐ） */
    const sh=new THREE.Shape();
    sh.moveTo(-span/2,0);
    for(let i=0;i<=32;i++){ const t=-th+2*th*i/32; sh.lineTo(R*Math.sin(t), R*Math.cos(t)-(R-rise)); }
    sh.lineTo(span/2,0); sh.lineTo(-span/2,0);
    [-1,1].forEach(sg=>{
      const e=new THREE.Mesh(new THREE.ShapeGeometry(sh), mat);
      if(alongX){ e.rotation.y=Math.PI/2; e.position.set(CX+sg*len/2, 20, CZ); }
      else { e.position.set(CX, 20, CZ+sg*len/2); }
      roofG.add(e);
    });
  } else if(P.roof==='gable'){
    const half=span/2, slope=Math.hypot(half, rise), ang=Math.atan2(rise, half);
    [-1,1].forEach(sg=>{
      const g=new THREE.BoxGeometry(alongX?len:slope, 0.5, alongX?slope:len);
      const m=new THREE.Mesh(g, mat);
      if(alongX){ m.rotation.x=sg*ang; m.position.set(CX, 20+rise/2, CZ+sg*half/2); }
      else       { m.rotation.z=-sg*ang; m.position.set(CX+sg*half/2, 20+rise/2, CZ); }
      roofG.add(m);
    });
    const sh=new THREE.Shape(); sh.moveTo(-half,0); sh.lineTo(0,rise); sh.lineTo(half,0); sh.lineTo(-half,0);
    [-1,1].forEach(sg=>{
      const e=new THREE.Mesh(new THREE.ShapeGeometry(sh), mat);
      if(alongX){ e.rotation.y=Math.PI/2; e.position.set(CX+sg*len/2, 20, CZ); }
      else { e.position.set(CX, 20, CZ+sg*len/2); }
      roofG.add(e);
    });
  }
}

/* --- カーテンウォール: 方立ピッチ/帯高さ（1タイル=8方立） --- */
function glassTex(){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=128;
  const c=cv.getContext('2d');
  c.fillStyle='#14203a'; c.fillRect(0,0,1024,128);
  for(let i=0;i<8;i++){
    const x=i*128, lit=Math.abs(Math.sin(i*1.7+0.4))>0.35;
    c.fillStyle= lit ? 'rgba(255,214,150,'+(0.32+0.45*Math.abs(Math.sin(i*2.3))).toFixed(2)+')' : 'rgba(40,60,100,0.6)';
    c.fillRect(x+5, 8, 118, 112);
    c.fillStyle='#0a0f1c'; c.fillRect(x, 0, 5, 128);
  }
  c.fillStyle='#0a0f1c'; c.fillRect(0,0,1024,8); c.fillRect(0,120,1024,8); c.fillRect(0,62,1024,3);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const gt=glassTex();
api.bandMat.map=gt; api.bandMat.emissiveMap=gt; api.bandMat.needsUpdate=true;
function applyBand(){
  gt.repeat.set(1/(8*P.pitch), 1/P.bandH);
  api.band.scale.z = P.bandH/3.0;            /* Extrude深さ=Y方向（回転後） */
  api.band.position.y = P.bandY;
}

/* --- 写真オーバーレイ（立面 / 航空） --- */
const ovG=new THREE.Group(); ext.add(ovG);
let elevMesh=null, aerialMesh=null;
function loadImg(file, cb){
  const rd=new FileReader();
  rd.onload=()=>{ const im=new Image(); im.onload=()=>cb(im); im.src=rd.result; };
  rd.readAsDataURL(file);
}
function mkPlane(im, op){
  const t=new THREE.Texture(im); t.needsUpdate=true;
  return new THREE.Mesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false, toneMapped:false}));
}
function placeElev(){
  if(!elevMesh) return;
  const m=elevMesh; m.scale.set(P.elevW, P.elevH, 1); m.material.opacity=P.elevOp;
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const f=P.elevFace;
  if(f==='W'){ m.position.set(minX-1.5, P.elevY, CZ+P.elevOff); m.rotation.set(0,-Math.PI/2,0); }
  if(f==='E'){ m.position.set(maxX+1.5, P.elevY, CZ+P.elevOff); m.rotation.set(0, Math.PI/2,0); }
  if(f==='N'){ m.position.set(CX+P.elevOff, P.elevY, -maxY-1.5); m.rotation.set(0, Math.PI,0); }
  if(f==='S'){ m.position.set(CX+P.elevOff, P.elevY, -minY+1.5); m.rotation.set(0,0,0); }
}
function placeAerial(){
  if(!aerialMesh) return;
  const m=aerialMesh, im=m.material.map.image, asp=im.height/im.width;
  m.scale.set(P.aerialW, P.aerialW*asp, 1); m.material.opacity=P.aerialOp;
  m.rotation.set(-Math.PI/2, 0, 0); m.rotateZ(P.aerialRot*Math.PI/180);
  m.position.set(CX+P.aerialX, 0.8, CZ+P.aerialZ);
}

/* --- パネル --- */
const rg=(k,l,min,max,step,unit)=>'<div class="pr"><span>'+l+'</span><b id="fv-'+k+'">'+P[k]+unit+'</b></div>'
  +'<input type="range" class="rg" data-fk="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+P[k]+'">';
const ch=(k,v,l)=>'<button class="chip '+(P[k]===v?'active':'')+'" data-fc="'+k+'" data-v="'+v+'">'+l+'</button>';
function panelHTML(){
  return '<div class="sec" id="fac-sec"><div class="sec-t"><b>🏛 外観調整</b> — 実写トレース（写真と照合して調整）</div>'
   +'<div class="sec-t" style="margin-top:4px">屋根形状</div>'
   +'<div class="row-btns">'+ch('roof','flat','フラット')+ch('roof','vault','アーチ')+ch('roof','gable','切妻')+'</div>'
   +'<div class="row-btns" style="margin-top:5px">'+ch('axis','x','稜線 東西')+ch('axis','z','稜線 南北')
   +ch('roofColor','gray','グレー')+ch('roofColor','white','ホワイト')+ch('roofColor','dark','ダーク')+ch('roofColor','brex','BREX')+'</div>'
   +rg('rise','屋根ライズ',2,16,0.5,' m')
   +'<div class="sec-t" style="margin-top:8px">カーテンウォール</div>'
   +rg('pitch','方立ピッチ',0.6,4,0.1,' m')+rg('bandH','帯 高さ',1,8,0.25,' m')+rg('bandY','帯 下端高さ',0.5,14,0.25,' m')
   +'<div class="sec-t" style="margin-top:8px">立面写真オーバーレイ</div>'
   +'<div class="row-btns">'+ch('elevFace','W','西面(広場)')+ch('elevFace','E','東面')+ch('elevFace','N','北面')+ch('elevFace','S','南面(LRT)')+'</div>'
   +'<input type="file" id="fac-elev" accept="image/*" style="display:none">'
   +'<button class="tool-btn" id="fac-elev-btn" style="margin-top:5px">'+(elevMesh?'立面写真を差し替え':'立面写真を読み込む')+'</button>'
   +rg('elevOp','不透明度',0.1,1,0.05,'')+rg('elevW','幅',10,160,1,' m')+rg('elevH','高さ',3,40,0.5,' m')+rg('elevY','中心高さ',1,30,0.5,' m')+rg('elevOff','横オフセット',-60,60,1,' m')
   +'<div class="sec-t" style="margin-top:8px">航空写真オーバーレイ（地面）</div>'
   +'<input type="file" id="fac-aer" accept="image/*" style="display:none">'
   +'<button class="tool-btn" id="fac-aer-btn">'+(aerialMesh?'航空写真を差し替え':'航空写真を読み込む')+'</button>'
   +rg('aerialOp','不透明度',0.1,1,0.05,'')+rg('aerialW','幅',60,1200,5,' m')+rg('aerialRot','回転',-180,180,0.5,'°')+rg('aerialX','中心 X',-300,300,1,' m')+rg('aerialZ','中心 Z',-300,300,1,' m')
   +'<div class="row-btns" style="margin-top:8px"><button class="chip" id="fac-exp">設定JSONをコピー</button><button class="chip" id="fac-imp">JSONを貼付けて読込</button><button class="chip" id="fac-reset">初期値</button></div>'
   +'<div class="hint" style="margin-top:6px">建物足跡はOSM実測。屋根・開口・色は写真から読み取って調整してください（値はブラウザに保存）。オーバーレイは半透明で重ねてトレース用に使います。</div></div>';
}
function bind(){
  const sec=document.getElementById('fac-sec'); if(!sec) return;
  sec.querySelectorAll('[data-fc]').forEach(b=> b.onclick=()=>{
    P[b.dataset.fc]=b.dataset.v; save(); buildRoof(); placeElev(); renderPanel();
  });
  sec.querySelectorAll('[data-fk]').forEach(r=> r.oninput=()=>{
    const k=r.dataset.fk; P[k]=+r.value; save();
    const v=document.getElementById('fv-'+k); if(v) v.textContent=r.value+(v.textContent.replace(/^[-\d.]+/,''));
    if(k==='rise') buildRoof();
    else if(k==='pitch'||k==='bandH'||k==='bandY') applyBand();
    else if(k.indexOf('elev')===0) placeElev();
    else placeAerial();
  });
  const eb=document.getElementById('fac-elev-btn'), ei=document.getElementById('fac-elev');
  eb.onclick=()=>ei.click();
  ei.onchange=()=>{ const f=ei.files[0]; if(!f) return; loadImg(f, im=>{
    if(elevMesh){ ovG.remove(elevMesh); elevMesh.material.map.dispose(); }
    elevMesh=mkPlane(im, P.elevOp); ovG.add(elevMesh); placeElev(); renderPanel(); toast('立面写真を'+P.elevFace+'面に配置しました'); }); };
  const ab=document.getElementById('fac-aer-btn'), ai=document.getElementById('fac-aer');
  ab.onclick=()=>ai.click();
  ai.onchange=()=>{ const f=ai.files[0]; if(!f) return; loadImg(f, im=>{
    if(aerialMesh){ ovG.remove(aerialMesh); aerialMesh.material.map.dispose(); }
    aerialMesh=mkPlane(im, P.aerialOp); ovG.add(aerialMesh); placeAerial(); renderPanel(); toast('航空写真を地面に配置しました（幅・回転・位置で合わせてください）'); }); };
  document.getElementById('fac-exp').onclick=()=>{
    const s=JSON.stringify(P);
    if(navigator.clipboard) navigator.clipboard.writeText(s).then(()=>toast('外観パラメータJSONをコピーしました'), ()=>prompt('外観パラメータJSON', s));
    else prompt('外観パラメータJSON', s);
  };
  document.getElementById('fac-imp').onclick=()=>{
    const s=prompt('外観パラメータJSONを貼り付け'); if(!s) return;
    try{ Object.assign(P, JSON.parse(s)); save(); buildRoof(); applyBand(); placeElev(); placeAerial(); renderPanel(); toast('読み込みました'); }
    catch(e){ toast('JSONを解釈できませんでした'); }
  };
  document.getElementById('fac-reset').onclick=()=>{
    try{ localStorage.removeItem(LS); }catch(e){}
    Object.assign(P,{roof:'flat',rise:7,axis:'x',roofColor:'gray',pitch:1.6,bandH:3.0,bandY:2.4});
    buildRoof(); applyBand(); renderPanel();
  };
}
const baseRenderPanel9=renderPanel;
renderPanel=function(){
  baseRenderPanel9();
  if(level!=='arena') pb.insertAdjacentHTML('beforeend', panelHTML()), bind();
};
window.__facadeParams=P;
window.__facadeApply=()=>{ buildRoof(); applyBand(); };
buildRoof(); applyBand();
})();
