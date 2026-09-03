/* ================================================================
   ▼ 拡張モジュール13: 📷 写真準拠 内観（v15）
   参照写真: 試合日俯瞰・無観客俯瞰・2F客席近景。
   読み取り: 黒い平天井に丸型ダウンライトの密グリッド／エンド壁上部の大型
   ビジョン（TOYOTA WOODYOU HOME）／コート周囲の紺色エプロン（スポンサー
   白文字）／2F前面の白い手すり／観客はBREX NATIONの黄色。
================================================================ */
(function(){
'use strict';
const I=window.__intApi; if(!I) return;
const G=new THREE.Group(); interior.add(G);

/* --- 天井: 丸型ダウンライトの密グリッド（旧・矩形器具は非表示） --- */
I.lampI.visible=false;
const lampMat=new THREE.MeshStandardMaterial({color:0x202430, emissive:0xfff3d8, emissiveIntensity:1.5, roughness:0.4});
const pts=[]; for(let ix=-7;ix<=7;ix++) for(let iz=-4;iz<=4;iz++) pts.push([ix*4.6, iz*8.2]);
const geo=new THREE.CircleGeometry(0.62, 18); geo.rotateX(Math.PI/2);   /* 法線-y（下向き片面） */
const lamps=new THREE.InstancedMesh(geo, lampMat, pts.length);
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
pts.forEach((p,i)=>{ M.compose(P.set(p[0], I.WH-0.28, p[1]), Q, S); lamps.setMatrixAt(i,M); });
G.add(lamps);
/* 器具まわりの黒いレースウェイ（写真の格子状の影） */
const wayM=new THREE.MeshStandardMaterial({color:0x0b0d12, roughness:0.9});
for(let iz=-4;iz<=4;iz++){ const w=new THREE.Mesh(new THREE.BoxGeometry(70,0.12,0.5), wayM); w.position.set(0, I.WH-0.15, iz*8.2); G.add(w); }

/* --- コート周囲の紺色エプロン（スポンサー白文字） --- */
function apronTex(){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=128; const c=cv.getContext('2d');
  c.fillStyle='#232a5e'; c.fillRect(0,0,1024,128);
  c.fillStyle='rgba(255,255,255,0.92)'; c.font='700 44px Oswald, "Noto Sans JP", sans-serif'; c.textAlign='center'; c.textBaseline='middle';
  ['BREX','TOYOTA WOODYOU HOME','UTSUNOMIYA','BREX NATION'].forEach((t,i)=>c.fillText(t, 128+i*256, 64));
  const tx=new THREE.CanvasTexture(cv); tx.wrapS=tx.wrapT=THREE.RepeatWrapping; tx.repeat.set(1/24, 1/3); return tx;
}
const apShape=new THREE.Shape(); apShape.moveTo(-10.5,-17.5); apShape.lineTo(10.5,-17.5); apShape.lineTo(10.5,17.5); apShape.lineTo(-10.5,17.5); apShape.lineTo(-10.5,-17.5);
const hole=new THREE.Path(); hole.moveTo(-7.5,-14); hole.lineTo(7.5,-14); hole.lineTo(7.5,14); hole.lineTo(-7.5,14); hole.lineTo(-7.5,-14);
apShape.holes.push(hole);
const apron=new THREE.Mesh(new THREE.ShapeGeometry(apShape), new THREE.MeshStandardMaterial({map:apronTex(), roughness:0.6}));
apron.rotation.x=-Math.PI/2; apron.position.y=(typeof court!=='undefined' ? court.position.y : 0.35)-0.02; apron.receiveShadow=true; G.add(apron);

/* --- エンド壁の大型ビジョン（ライブスコア・スポンサー） --- */
const vcv=document.createElement('canvas'); vcv.width=1024; vcv.height=288; const vc=vcv.getContext('2d');
const vtex=new THREE.CanvasTexture(vcv);
const vision=new THREE.Mesh(new THREE.BoxGeometry(18, 5, 0.5),
  new THREE.MeshStandardMaterial({map:vtex, emissive:0xffffff, emissiveMap:vtex, emissiveIntensity:0.9, color:0x101018}));
vision.position.set(0, 14.6, -I.WZ+0.4); vision.userData.name='エンドビジョン: TOYOTA WOODYOU HOME'; G.add(vision);
const vFrame=new THREE.Mesh(new THREE.BoxGeometry(18.8, 5.8, 0.3), new THREE.MeshStandardMaterial({color:0x14161f, roughness:0.7})); vFrame.position.set(0,14.6,-I.WZ+0.15); G.add(vFrame);
let lastV=0;
function drawVision(now){
  if(level!=='arena' || now-lastV<250) return; lastV=now;
  const g=(typeof gameStateAt==='function') ? gameStateAt(timeState.min) : {label:'BREX HOME GAME', clock:'', b:0, o:0, live:false};
  vc.fillStyle='#07080e'; vc.fillRect(0,0,1024,288);
  vc.fillStyle='#ffffff'; vc.fillRect(0,0,1024,62);
  vc.fillStyle='#d21f2f'; vc.font='700 34px Oswald, sans-serif'; vc.textAlign='left'; vc.textBaseline='middle'; vc.fillText('TOYOTA', 40, 31);
  vc.fillStyle='#111'; vc.fillText('WOODYOU HOME', 190, 31);
  vc.fillStyle='#f5c400'; vc.textAlign='right'; vc.fillText('BREX ARENA UTSUNOMIYA', 990, 31);
  vc.textAlign='center';
  vc.fillStyle='#f5c400'; vc.font='700 40px Oswald, sans-serif'; vc.fillText('BREX', 250, 120);
  vc.fillStyle='#d9564a'; vc.font="700 34px 'Noto Sans JP', sans-serif"; vc.fillText('千葉J', 774, 120);
  vc.fillStyle='#ffffff'; vc.font='700 118px Oswald, sans-serif'; vc.fillText(String(g.b), 250, 210); vc.fillText(String(g.o), 774, 210);
  vc.fillStyle='#8b93a8'; vc.font='700 30px Oswald, sans-serif'; vc.fillText(g.label, 512, 120);
  if(g.clock){ vc.fillStyle='#f5c400'; vc.font='700 64px Oswald, sans-serif'; vc.fillText(g.clock, 512, 210); }
  const pulse=0.5+0.5*Math.sin(now/600);
  vc.fillStyle='rgba(245,196,0,'+(0.25+0.35*pulse).toFixed(2)+')'; vc.fillRect(0,282,1024,6);
  vtex.needsUpdate=true;
}
const baseLoop13=loop;
loop=function(now){ baseLoop13(now); drawVision(now); };

/* --- 2F前面の手すりを白へ（写真: 白い手すり） --- */
interior.traverse(o=>{
  if(o.isMesh && !o.isInstancedMesh && o.geometry.type==='BoxGeometry' && o.material && o.material.color &&
     o.material.color.getHex()===0xf5c400 && Math.abs(o.position.y-7.9)<0.05) o.material.color.setHex(0xe6e8ee);
});
window.__photoInt=G;
})();
