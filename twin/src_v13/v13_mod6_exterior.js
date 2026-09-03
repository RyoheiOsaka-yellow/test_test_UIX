/* ================================================================
   ▼ 拡張モジュール6: 🏟 外観・環境（v13）
   レンダリング基盤（ACESトーンマッピング・場内シャドウ）、
   タイムライン連動の空（15:00 昼 → 17:30 夕景 → 20:00 夜景）、
   アリーナ外観ディテール（ガラスカーテンウォール帯・大屋根キャップ・
   BREXイエロー屋根ライン・ファサードサイン・エントランスキャノピー・
   投光ポール・植栽）。点群ビューでは外観装飾を非表示。
================================================================ */
(function(){
'use strict';
/* --- レンダリング基盤（初回レンダー前に設定） --- */
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* 場内シャドウ用ディレクショナルライト（アリーナ階層のみ点灯） */
const shadowSun = new THREE.DirectionalLight(0xfff4e0, 0);
shadowSun.position.set(MAIN_C.x+38, 72, MAIN_C.z-28);
shadowSun.target.position.set(MAIN_C.x, 0, MAIN_C.z);
shadowSun.castShadow = true;
shadowSun.shadow.mapSize.set(2048, 2048);
const sc = shadowSun.shadow.camera;
sc.left=-58; sc.right=58; sc.top=58; sc.bottom=-58; sc.near=10; sc.far=200;
shadowSun.shadow.bias = -0.0005;
shadowSun.shadow.normalBias = 0.02;
scene.add(shadowSun, shadowSun.target);
window.__shadowSun = shadowSun;
window.__extGroup = null;

/* --- タイムライン連動スカイ（サイト/広場階層・通常ビューのみ） --- */
const SKY_KEYS = [   /* [min, top, bottom, sunHex, sunI, ambI, night] */
  [  0, 0x1a2238, 0x4a5a80, 0xfff3d8, 1.10, 0.85, 0.00],   /* 15:00 昼 */
  [120, 0x1c1f36, 0x8a5a48, 0xffc890, 0.85, 0.78, 0.25],   /* 17:00 */
  [150, 0x1b1a2e, 0xb0603a, 0xffb070, 0.70, 0.70, 0.45],   /* 17:30 夕景 */
  [210, 0x0d0f18, 0x2a2540, 0xa8b8ff, 0.35, 0.60, 0.85],   /* 18:30 */
  [300, 0x0a0b10, 0x131a2a, 0x9ab0ff, 0.22, 0.55, 1.00],   /* 20:00 夜景 */
  [420, 0x0a0b10, 0x121826, 0x9ab0ff, 0.20, 0.55, 1.00],
];
const cA=new THREE.Color(), cB=new THREE.Color(), cT=new THREE.Color(), cS=new THREE.Color();
let nightK = 0, lastSkyKey = '';
function skyAt(min){
  let i=0; while(i<SKY_KEYS.length-2 && SKY_KEYS[i+1][0]<=min) i++;
  const a=SKY_KEYS[i], b=SKY_KEYS[i+1];
  const k=Math.max(0, Math.min(1, (min-a[0])/(b[0]-a[0])));
  cT.setHex(a[1]).lerp(cB.setHex(b[1]), k);       const top=cT.clone();
  cT.setHex(a[2]).lerp(cB.setHex(b[2]), k);       const bot=cT.clone();
  cS.setHex(a[3]).lerp(cB.setHex(b[3]), k);
  return {top, bot, sun:cS.clone(), sunI:a[4]+(b[4]-a[4])*k, ambI:a[5]+(b[5]-a[5])*k, night:a[6]+(b[6]-a[6])*k};
}
function applySky(min){
  if(pcMode) return;                                  /* 点群ビューは専用グラデーション */
  if(level==='arena'){
    if(lastSkyKey!=='arena'){
      lastSkyKey='arena';
      wrap.style.background=''; scene.background=new THREE.Color(0x0d0f14); scene.fog.color.setHex(0x0d0f14);
      sun.intensity=1.1; sun.color.setHex(0xfff3d8);
    }
    return;
  }
  const s=skyAt(min);
  nightK=s.night;
  /* 基底のupdateProductionが毎フレームamb強度を戻すため、光源は毎回上書き */
  sun.intensity=s.sunI; sun.color.copy(s.sun);
  amb.intensity=s.ambI;
  setNight(s.night);
  const key=Math.round(min/2);
  if(lastSkyKey!==key){
    lastSkyKey=key;
    wrap.style.background='linear-gradient(180deg,#'+s.top.getHexString()+' 0%,#'+s.bot.getHexString()+' 100%)';
    scene.background=null;
    cA.copy(s.top).lerp(s.bot, 0.55); scene.fog.color.copy(cA);
  }
}
const baseUpdateProduction=updateProduction;
updateProduction=function(min){ baseUpdateProduction(min); applySky(min); };

/* --- 外観ディテール --- */
const ext=new THREE.Group(); scene.add(ext); window.__extGroup=ext;
const A=SCENE_DATA.arena;
const cx0=(Math.max(...A.outer.map(p=>p[0]))+Math.min(...A.outer.map(p=>p[0])))/2;
const cy0=(Math.max(...A.outer.map(p=>p[1]))+Math.min(...A.outer.map(p=>p[1])))/2;
const scalePoly=(pts,k)=>pts.map(p=>[cx0+(p[0]-cx0)*k, cy0+(p[1]-cy0)*k]);
const mainMinX=Math.min(...A.main.map(p=>p[0])), mainMaxY=Math.max(...A.main.map(p=>p[1])), mainMinY=Math.min(...A.main.map(p=>p[1]));
const outerMinX=Math.min(...A.outer.map(p=>p[0]));

/* カーテンウォール テクスチャ（方立＋窓明かり） */
function glassTex(){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=128;
  const c=cv.getContext('2d');
  c.fillStyle='#14203a'; c.fillRect(0,0,1024,128);
  for(let x=0;x<1024;x+=16){
    const lit=Math.abs(Math.sin(x*0.37+1.3))>0.42;
    c.fillStyle= lit ? 'rgba(255,214,150,'+(0.35+0.45*Math.abs(Math.sin(x*0.11))).toFixed(2)+')' : 'rgba(40,60,100,0.6)';
    c.fillRect(x+2, 8, 12, 112);
    c.fillStyle='#0a0f1c'; c.fillRect(x, 0, 2, 128);
  }
  c.fillStyle='#0a0f1c'; c.fillRect(0,0,1024,8); c.fillRect(0,120,1024,8); c.fillRect(0,62,1024,3);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(0.09, 0.32);
  return t;
}
const gt=glassTex();
const glassBandMat=new THREE.MeshStandardMaterial({color:0x8090b0, map:gt, emissive:0xffffff, emissiveMap:gt,
  emissiveIntensity:0.15, roughness:0.25, metalness:0.55, transparent:true, opacity:0.97});
const band=extrudePoly(scalePoly(A.outer,1.006), 3.0, glassBandMat, 2.4);
ext.add(band);

/* 大屋根キャップ＋BREXイエロー屋根ライン＋屋上設備 */
const roofMat=new THREE.MeshStandardMaterial({color:0x2e3548, roughness:0.42, metalness:0.55});
ext.add(extrudePoly(A.main, 1.3, roofMat, 20.0));
const rimMat=new THREE.MeshStandardMaterial({color:0xf5c400, emissive:0xf5c400, emissiveIntensity:0.55, roughness:0.5});
/* 屋根ラインは外周リング（穴あきShape）— 全面スラブにしない */
(function(){
  const outer=scalePoly(A.main,1.004), inner=scalePoly(A.main,0.975);
  const sh=polyShape(outer);
  const hole=new THREE.Path();
  hole.moveTo(inner[0][0], -inner[0][1]);
  for(let i=1;i<inner.length;i++) hole.lineTo(inner[i][0], -inner[i][1]);
  sh.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(sh, {depth:0.4, bevelEnabled:false});
  const m=new THREE.Mesh(g, rimMat); m.rotation.x=-Math.PI/2; m.position.y=21.3;
  ext.add(m);
})();
const rtuMat=new THREE.MeshStandardMaterial({color:0x3a4052, roughness:0.7, metalness:0.3});
[[-40,-20,6,2.2,4],[-20,-25,5,1.8,3],[10,-18,7,2.4,4],[25,15,6,2.2,4],[-45,20,5,1.8,3],[0,28,8,2.0,3]].forEach(u=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(u[2],u[3],u[4]), rtuMat);
  m.position.set(MAIN_C.x+u[0], 21.3+u[3]/2, MAIN_C.z+u[1]); ext.add(m);
});

/* ファサードサイン（西面: 広場側 / 南面: LRT側） */
function signTex(text, sub){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=160;
  const c=cv.getContext('2d');
  c.clearRect(0,0,1024,160);
  c.textAlign='center'; c.textBaseline='middle';
  c.fillStyle='#f5c400';
  let fs=96;                                            /* 幅960px以内に収まるまで縮小 */
  do{ c.font='600 '+fs+'px Oswald, "Noto Sans JP", sans-serif'; fs-=4; } while(c.measureText(text).width>960 && fs>40);
  c.fillText(text, 512, sub?62:80);
  if(sub){ c.fillStyle='#ffffff'; c.font='700 34px "Noto Sans JP", sans-serif'; c.fillText(sub, 512, 128); }
  const t=new THREE.CanvasTexture(cv); return t;
}
const signMat=(tex)=>new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide, toneMapped:false});
const signW=signTex('BREX ARENA UTSUNOMIYA', 'ブレックスアリーナ宇都宮');
const sW=new THREE.Mesh(new THREE.PlaneGeometry(34, 5.3), signMat(signW));
sW.position.set(mainMinX-0.45, 16.6, MAIN_C.z); sW.rotation.y=-Math.PI/2; ext.add(sW);
const signS=signTex('BREX ARENA', 'UTSUNOMIYA BREX HOME');
const sS=new THREE.Mesh(new THREE.PlaneGeometry(26, 4.1), signMat(signS));
sS.position.set(MAIN_C.x, 14.5, -mainMinY+0.45); sS.rotation.y=0; ext.add(sS);
/* サイン背面の発光バー（夜間に強調） */
const barMat=new THREE.MeshStandardMaterial({color:0x111318, emissive:0xf5c400, emissiveIntensity:0.0, roughness:0.6});
const barW=new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 37), barMat); barW.position.set(mainMinX-0.15, 16.6, MAIN_C.z); ext.add(barW);
const barS=new THREE.Mesh(new THREE.BoxGeometry(29, 5.2, 0.3), barMat); barS.position.set(MAIN_C.x, 14.5, -mainMinY+0.15); ext.add(barS);

/* エントランスキャノピー（西面・広場側） */
const canMat=new THREE.MeshStandardMaterial({color:0x2a3040, roughness:0.5, metalness:0.5});
const canopy=new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.55, 38), canMat);
canopy.position.set(outerMinX-3.0, 7.0, MAIN_C.z); ext.add(canopy);
const canGlow=new THREE.MeshStandardMaterial({color:0xfff2d0, emissive:0xfff0c0, emissiveIntensity:0.6, roughness:0.9});
const canUnder=new THREE.Mesh(new THREE.PlaneGeometry(6.0, 37), canGlow);
canUnder.rotation.x=Math.PI/2; canUnder.position.set(outerMinX-3.0, 6.7, MAIN_C.z); ext.add(canUnder);
const colMat=new THREE.MeshStandardMaterial({color:0x30364a, roughness:0.6, metalness:0.4});
for(let z=-15; z<=15; z+=6){
  const c=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,6.8,10), colMat);
  c.position.set(outerMinX-5.6, 3.4, MAIN_C.z+z); ext.add(c);
}

/* 投光ポール（広場周辺 6本・夜間に光錐） */
const coneMat=new THREE.MeshBasicMaterial({color:0xfff2c8, transparent:true, opacity:0.0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
const headMat=new THREE.MeshStandardMaterial({color:0x222634, emissive:0xfff6dd, emissiveIntensity:0.0, roughness:0.5});
[[PLAZA.x-42, PLAZA.z-50],[PLAZA.x+2, PLAZA.z-50],[PLAZA.x-42, PLAZA.z+50],[PLAZA.x+2, PLAZA.z+50],[PLAZA.x-52, PLAZA.z-12],[PLAZA.x-52, PLAZA.z+12]].forEach(p=>{
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.28,15,8), colMat);
  pole.position.set(p[0], 7.5, p[1]); ext.add(pole);
  const head=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.5,0.7), headMat);
  head.position.set(p[0], 15.2, p[1]); ext.add(head);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(6.5, 15, 14, 1, true), coneMat);
  cone.rotation.x=Math.PI; cone.position.set(p[0], 7.6, p[1]); ext.add(cone);
});

/* 植栽（広場外周・インスタンス） */
const treePts=[];
for(let x=PLAZA.x-46; x<=PLAZA.x+44; x+=7){ treePts.push([x, PLAZA.z-57]); treePts.push([x, PLAZA.z+57]); }
for(let z=PLAZA.z-48; z<=PLAZA.z+48; z+=8) treePts.push([PLAZA.x-56, z]);
const trunkI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.32,2.8,6),
  new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:0.9}), treePts.length);
const crownI=new THREE.InstancedMesh(new THREE.SphereGeometry(2.3,8,6),
  new THREE.MeshStandardMaterial({color:0x2f6b3a, roughness:0.95}), treePts.length);
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), S=new THREE.Vector3();
treePts.forEach((p,i)=>{
  const k=0.85+((i*7919)%100)/100*0.4;
  M.compose(P.set(p[0],1.4,p[1]), Q, S.set(1,1,1)); trunkI.setMatrixAt(i,M);
  M.compose(P.set(p[0],4.2*k,p[1]), Q, S.set(k,k*0.9,k)); crownI.setMatrixAt(i,M);
});
ext.add(trunkI, crownI);

/* 夜間強度（スカイのnight係数で駆動） */
function setNight(n){
  glassBandMat.emissiveIntensity = 0.12 + 1.1*n;
  barMat.emissiveIntensity = 0.9*n;
  headMat.emissiveIntensity = 1.6*n;
  coneMat.opacity = 0.085*n;
  canGlow.emissiveIntensity = 0.25 + 0.9*n;
  rimMat.emissiveIntensity = 0.35 + 0.6*n;
}
setNight(0);

/* --- 可視制御: 点群ビュー・アリーナ階層では外観装飾を隠す --- */
function applyExtVis(){ ext.visible = !pcMode && level!=='arena'; }
const baseApplyPC=applyPCVisibility;
applyPCVisibility=function(){ baseApplyPC(); applyExtVis(); lastSkyKey=''; };
const baseSetLevel6=setLevel;
setLevel=function(lv, fly){
  baseSetLevel6(lv, fly);
  applyExtVis();
  shadowSun.intensity = (level==='arena') ? 0.6 : 0;
  lastSkyKey='';
  applySky(timeState.min);
};
applyExtVis();
})();
