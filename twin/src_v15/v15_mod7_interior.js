/* ================================================================
   ▼ 拡張モジュール7: 🏀 内観（v13）
   座席を「座面＋背もたれ＋脚」の合成ジオメトリに差替（既存InstancedMeshを維持し
   ピック・色付け互換）、内壁/天井を内向き片面のドールハウス囲いで追加、
   天井灯グリッド・補助ライト、場内シャドウの投影/受影フラグを付与。
================================================================ */
(function(){
'use strict';
/* --- 合成ジオメトリ（BoxGeometryを手動マージ: BufferGeometryUtils不使用） --- */
function mergeBoxes(specs){
  const pos=[], nor=[], uv=[], idx=[]; let off=0;
  specs.forEach(s=>{
    const g=new THREE.BoxGeometry(s.w,s.h,s.d); g.translate(s.x,s.y,s.z);
    const p=g.attributes.position.array, n=g.attributes.normal.array, u=g.attributes.uv.array, ix=g.index.array;
    for(let i=0;i<p.length;i++) pos.push(p[i]);
    for(let i=0;i<n.length;i++) nor.push(n[i]);
    for(let i=0;i<u.length;i++) uv.push(u[i]);
    for(let i=0;i<ix.length;i++) idx.push(ix[i]+off);
    off+=p.length/3; g.dispose();
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);
  return geo;
}
/* 座席: 座面 / 背もたれ（局所+zが正面） / 脚 */
if(SEAT.mesh){
  const seatGeo=mergeBoxes([
    {w:0.44,h:0.09,d:0.42, x:0,y:0.42,z:0.02},
    {w:0.44,h:0.40,d:0.07, x:0,y:0.64,z:-0.19},
    {w:0.10,h:0.38,d:0.10, x:0,y:0.19,z:0.0},
  ]);
  const old=SEAT.mesh.geometry;
  SEAT.mesh.geometry=seatGeo;
  old.dispose();
  SEAT.mesh.material.roughness=0.62; SEAT.mesh.material.metalness=0.08;
}

/* --- ドールハウス囲い（内向き片面: 外からは見えず、内側からは壁・天井が見える） --- */
function wallTex(){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=256;
  const c=cv.getContext('2d');
  c.fillStyle='#171b26'; c.fillRect(0,0,512,256);
  for(let x=0;x<512;x+=24){ c.fillStyle= (x/24)%3===0 ? '#1d2230' : '#141821'; c.fillRect(x,0,20,256); }
  c.fillStyle='#0d1018'; c.fillRect(0,0,512,3); c.fillRect(0,253,512,3);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
const wt=wallTex();
const wallMat=new THREE.MeshStandardMaterial({color:0xffffff, map:wt, roughness:0.92, side:THREE.FrontSide});
const enc=new THREE.Group(); interior.add(enc);
const WX=37, WZ=43, WH=19.2;
function wall(w, h, px, pz, ry, rep){
  const t=wt.clone(); t.needsUpdate=true; t.repeat.set(rep, 2.4);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), wallMat.clone()); m.material.map=t;
  m.position.set(px, h/2, pz); m.rotation.y=ry; m.receiveShadow=true; enc.add(m);
}
wall(WZ*2, WH,  WX, 0,  -Math.PI/2, 14);   /* 東壁: 法線-x（内向き） */
wall(WZ*2, WH, -WX, 0,   Math.PI/2, 14);   /* 西壁 */
wall(WX*2, WH, 0, -WZ,   0,          12);  /* 北壁: 法線+z */
wall(WX*2, WH, 0,  WZ,   Math.PI,    12);  /* 南壁 */
const ceil=new THREE.Mesh(new THREE.PlaneGeometry(WX*2, WZ*2),
  new THREE.MeshStandardMaterial({color:0x0e1118, roughness:0.95}));
ceil.rotation.x=Math.PI/2; ceil.position.y=WH; enc.add(ceil);   /* 法線-y（下向き） */

/* 天井灯グリッド（発光器具・80灯） */
const lampMat=new THREE.MeshStandardMaterial({color:0x202430, emissive:0xfff1d2, emissiveIntensity:1.6, roughness:0.4});
const lamps=[]; for(let ix=-3.5; ix<=3.5; ix++) for(let iz=-4.5; iz<=4.5; iz++) lamps.push([ix*8.6, iz*8.6]);
/* 器具は下向き片面（上空からの俯瞰では見えない） */
const lampGeo=new THREE.PlaneGeometry(1.3,0.5); lampGeo.rotateX(Math.PI/2);
const lampI=new THREE.InstancedMesh(lampGeo, lampMat, lamps.length);
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
lamps.forEach((l,i)=>{ M.compose(P.set(l[0], WH-0.3, l[1]), Q, S); lampI.setMatrixAt(i,M); });
enc.add(lampI);

/* 補助ライト（コート上空・両サイド／アリーナ階層のみ点灯） */
const fill=[new THREE.PointLight(0xfff0d8, 0, 120, 1.8), new THREE.PointLight(0xfff0d8, 0, 120, 1.8)];
fill[0].position.set(-18, 15, 0); fill[1].position.set(18, 15, 0);
fill.forEach(l=>interior.add(l));

/* --- シャドウ投影/受影フラグ（半透明・加算材質は除外） --- */
interior.traverse(o=>{
  if(!(o.isMesh || o.isInstancedMesh)) return;
  const m=o.material;
  if(!m || m.transparent || m.blending===THREE.AdditiveBlending || m.visible===false) return;
  o.castShadow=true; o.receiveShadow=true;
});
enc.traverse(o=>{ if(o.isMesh) o.castShadow=false; });   /* 壁・天井は受影のみ */
if(SEAT.crowd){ SEAT.crowd.receiveShadow=false; }         /* 低ポリ球の自己遮蔽（黒化）を回避 */

/* --- 基底バグ修正: InstancedMesh.setColorAt の遅延確保が count=0 時に長さ0の
   色バッファを作り、以後の観客・人流・行列インスタンスが黒く描画される問題。
   最大インスタンス数で色バッファを事前確保する（r128仕様への対処）。 --- */
function fixInstColor(m){
  if(!m || !m.isInstancedMesh) return;
  const n=m.instanceMatrix.count;
  if(m.instanceColor && m.instanceColor.count>=n) return;
  const a=new THREE.InstancedBufferAttribute(new Float32Array(n*3).fill(1), 3);
  a.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor=a;
}
[SEAT.crowd,
 typeof concMesh!=='undefined'?concMesh:null,
 typeof tQueueMesh!=='undefined'?tQueueMesh:null,
 typeof flowParticles!=='undefined'?flowParticles:null,
 typeof agentMesh!=='undefined'?agentMesh:null,
 typeof queueMesh!=='undefined'?queueMesh:null].forEach(fixInstColor);
window.__fixInstColor=fixInstColor;

window.__intApi={lampI, enc, fill, WX, WZ, WH};
const baseSetLevel7=setLevel;
setLevel=function(lv, fly){
  baseSetLevel7(lv, fly);
  fill.forEach(l=>{ l.intensity = (level==='arena') ? 0.32 : 0; });
};
})();
