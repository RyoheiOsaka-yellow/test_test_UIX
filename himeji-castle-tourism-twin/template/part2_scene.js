'use strict';
/* ================= XBUILD 姫路城 × 姫路市 観光動態デジタルツイン =================
   L0 広域流入（誰がどこから来たか） / L1 市内回遊・滞留（どこに滞留したか） / L2 姫路城（城内滞留・待ち行列）
   数値はすべて提案用のダミー（携帯位置情報・決済・入城券データ等の接続で実測化する前提）
============================================================================ */

/* ---------- 基本セットアップ ---------- */
const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BG_HEX = 0x0b0e14;
scene.background = new THREE.Color(BG_HEX);
scene.fog = new THREE.Fog(BG_HEX, 9000, 26000);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.5, 80000);
camera.position.set(-500, 620, 620);

const amb = new THREE.HemisphereLight(0xbdc8e8, 0x2a2c38, 0.85);
scene.add(amb);
const sun = new THREE.DirectionalLight(0xfff3d8, 1.1);
sun.position.set(-600, 900, 400);
scene.add(sun);

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- カスタムオービットコントロール ---------- */
const ctrl = {
  target: new THREE.Vector3(0,0,0),
  sph: new THREE.Spherical(1000, 0.9, -0.7),
  panning:false, rotating:false, px:0, py:0, enabled:true,
  minR: 30, maxR: 30000, minPhi: 0.1, maxPhi: 1.45,
  apply(){
    this.sph.radius = Math.max(this.minR, Math.min(this.maxR, this.sph.radius));
    this.sph.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.sph.phi));
    const p = new THREE.Vector3().setFromSpherical(this.sph).add(this.target);
    camera.position.copy(p);
    camera.lookAt(this.target);
  }
};
ctrl.apply();
const el = renderer.domElement;
el.style.cursor = 'grab';
/* --- 操作: 左ドラッグ＝地図を掴んで移動（カーソル直下の地面を追従） / 右ドラッグ・Shift+ドラッグ＝回転 / ホイール＝ズーム --- */
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0), _hit = new THREE.Vector3();
function groundAt(clientX, clientY, y){
  const r = el.getBoundingClientRect();
  _ndc.set(((clientX-r.left)/r.width)*2-1, -((clientY-r.top)/r.height)*2+1);
  _ray.setFromCamera(_ndc, camera);
  _plane.constant = -y;
  const ok = _ray.ray.intersectPlane(_plane, _hit);
  if(!ok) return null;
  const d = _hit.distanceTo(camera.position);
  if(d > ctrl.sph.radius*6) return null;   // 地平線付近は不安定なので画面差分パンにフォールバック
  return _hit.clone();
}
const grab = { on:false, pt:null, y:0 };
let dragMode = 'pan';   // pan | rotate（左ドラッグの役割）
const PAN_LIMIT = 24000;
function clampTarget(){ ctrl.target.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, ctrl.target.x)); ctrl.target.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, ctrl.target.z)); }
function startGrab(x, y){ grab.y = ctrl.target.y; grab.pt = groundAt(x, y, grab.y); grab.on = true; ctrl.panning = true; ctrl.px = x; ctrl.py = y; el.style.cursor = 'grabbing'; }
function moveGrab(x, y){
  const p = grab.pt ? groundAt(x, y, grab.y) : null;
  if(p && grab.pt){ ctrl.target.x += grab.pt.x - p.x; ctrl.target.z += grab.pt.z - p.z; }
  else { /* 画面差分パン */
    const dx = x-ctrl.px, dy = y-ctrl.py, s = ctrl.sph.radius*0.0013;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).negate();
    ctrl.target.addScaledVector(right, -dx*s).addScaledVector(fwd, dy*s);
  }
  clampTarget(); ctrl.apply();
  if(grab.pt){ const q = groundAt(x, y, grab.y); if(q) grab.pt = q; }
  ctrl.px = x; ctrl.py = y;
}
function endGrab(){ grab.on = false; grab.pt = null; ctrl.panning = false; ctrl.rotating = false; el.style.cursor = 'grab'; }
el.addEventListener('contextmenu', e=>e.preventDefault());
el.addEventListener('mousedown', e=>{
  if(!ctrl.enabled) return;
  if(tween) tween = null;   // 掴んだらカメラ遷移を中断
  if(e.button===2 || (e.button===0 && (dragMode==='rotate' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey))){ ctrl.rotating = true; ctrl.px = e.clientX; ctrl.py = e.clientY; el.style.cursor = 'move'; }
  else if(e.button===0){ startGrab(e.clientX, e.clientY); }
});
addEventListener('mouseup', ()=>{ endGrab(); });
addEventListener('mousemove', e=>{
  if(!ctrl.enabled) return;
  if(ctrl.rotating){
    const dx = e.clientX-ctrl.px, dy = e.clientY-ctrl.py;
    ctrl.sph.theta -= dx*0.0048; ctrl.sph.phi -= dy*0.0042; ctrl.apply();
    ctrl.px=e.clientX; ctrl.py=e.clientY;
  } else if(grab.on){ moveGrab(e.clientX, e.clientY); }
});
el.addEventListener('wheel', e=>{
  if(!ctrl.enabled) return;
  e.preventDefault();
  /* カーソル位置を中心にズーム（地面上の点が動かないよう補正） */
  const before = groundAt(e.clientX, e.clientY, ctrl.target.y);
  ctrl.sph.radius *= (1 + Math.sign(e.deltaY)*0.09);
  ctrl.apply();
  const after = groundAt(e.clientX, e.clientY, ctrl.target.y);
  if(before && after){ ctrl.target.x += before.x - after.x; ctrl.target.z += before.z - after.z; clampTarget(); ctrl.apply(); }
}, {passive:false});
/* タッチ（1本指: 掴んで移動 / 2本指: ピンチズーム＋回転） */
let touchD = 0, touchA = 0, touchMid = null;
el.addEventListener('touchstart', e=>{
  if(tween) tween = null;
  if(e.touches.length===1){ if(dragMode==='rotate'){ ctrl.rotating = true; ctrl.px=e.touches[0].clientX; ctrl.py=e.touches[0].clientY; } else startGrab(e.touches[0].clientX, e.touches[0].clientY); }
  if(e.touches.length===2){
    endGrab();
    const t0=e.touches[0], t1=e.touches[1];
    touchD = Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY); touchA = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
    touchMid = {x:(t0.clientX+t1.clientX)/2, y:(t0.clientY+t1.clientY)/2};
  }
}, {passive:true});
el.addEventListener('touchmove', e=>{
  if(e.touches.length===1 && ctrl.rotating){ const dx=e.touches[0].clientX-ctrl.px, dy=e.touches[0].clientY-ctrl.py; ctrl.sph.theta -= dx*0.0048; ctrl.sph.phi -= dy*0.0042; ctrl.apply(); ctrl.px=e.touches[0].clientX; ctrl.py=e.touches[0].clientY; }
  else if(e.touches.length===1 && grab.on){ moveGrab(e.touches[0].clientX, e.touches[0].clientY); }
  else if(e.touches.length===2){
    const t0=e.touches[0], t1=e.touches[1];
    const d = Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY), a = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
    const mid = {x:(t0.clientX+t1.clientX)/2, y:(t0.clientY+t1.clientY)/2};
    if(touchD>0){ ctrl.sph.radius *= touchD/d; }
    ctrl.sph.theta -= (a-touchA);                       // 2本指のひねりで回転
    if(touchMid){ ctrl.sph.phi -= (mid.y-touchMid.y)*0.004; }   // 2本指の上下で見下ろし角
    ctrl.apply();
    touchD = d; touchA = a; touchMid = mid;
  }
}, {passive:true});
el.addEventListener('touchend', ()=>{ endGrab(); touchD=0; touchMid=null; }, {passive:true});

/* カメラ遷移トゥイーン */
let tween = null;
function flyTo(target, radius, phi, theta, dur=1300, done){
  tween = {
    t0: performance.now(), dur,
    fromT: ctrl.target.clone(), toT: target.clone(),
    fromS: {r:ctrl.sph.radius, p:ctrl.sph.phi, th:ctrl.sph.theta},
    toS: {r:radius, p:phi, th:theta}, done
  };
}
function updateTween(now){
  if(!tween) return;
  let k = (now - tween.t0)/tween.dur;
  if(k>=1){ k=1; }
  const e = k<.5 ? 4*k*k*k : 1-Math.pow(-2*k+2,3)/2;
  ctrl.target.lerpVectors(tween.fromT, tween.toT, e);
  ctrl.sph.radius = tween.fromS.r + (tween.toS.r-tween.fromS.r)*e;
  ctrl.sph.phi   = tween.fromS.p + (tween.toS.p-tween.fromS.p)*e;
  ctrl.sph.theta = tween.fromS.th + (tween.toS.th-tween.fromS.th)*e;
  ctrl.apply();
  if(k===1){ const d=tween.done; tween=null; if(d) d(); }
}

/* ---------- ユーティリティ ---------- */
const toast = (msg, ms=2400)=>{
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display='block';
  clearTimeout(t._h); t._h = setTimeout(()=>t.style.display='none', ms);
};
const hx6 = c=> '#'+c.toString(16).padStart(6,'0');
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const sstep = (a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const fmt = n=> Math.round(n).toLocaleString('ja-JP');
/* 決定的な擬似乱数（再現性のあるダミー） */
let _seed = 20261001;
function rnd(){ _seed = (_seed*1664525 + 1013904223) >>> 0; return _seed/4294967296; }

/* 座標系: データ x=東, y=北（m） → three: x=東, z=-北。
   Shape(x, y) を rotation.x=-π/2 で倒すと world z = -y になり、道路/鉄道/POI（z=-y）と一致する */
function polyShape(pts){
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0], pts[i][1]);
  return s;
}
function extrudePoly(pts, h, mat, y0=0){
  const geo = new THREE.ExtrudeGeometry(polyShape(pts), {depth:h, bevelEnabled:false});
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI/2;
  let cx=0, cy=0; pts.forEach(q=>{cx+=q[0]; cy+=q[1];}); cx/=pts.length; cy/=pts.length;
  m.position.y = y0 + TH(cx, -cy);
  return m;
}
function flatPoly(pts, mat, y0=0.1){
  const geo = new THREE.ShapeGeometry(polyShape(pts));
  if(TERRAIN_ON){ const ps=geo.attributes.position; for(let i=0;i<ps.count;i++) ps.setZ(i, TH(ps.getX(i), -ps.getY(i))); }
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI/2; m.position.y = y0;
  return m;
}
function makeLabel(text, size=18, color='#ff8a1e', weight=700){
  const cv = document.createElement('canvas'); cv.width=1024; cv.height=128;
  const c = cv.getContext('2d');
  c.font = `${weight} 58px 'Oswald','Noto Sans JP',sans-serif`;
  c.fillStyle = color; c.textAlign='center'; c.textBaseline='middle';
  c.shadowColor='rgba(0,0,0,.75)'; c.shadowBlur=14;
  c.fillText(text, 512, 64);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false}));
  sp.scale.set(size*8, size, 1);
  sp.renderOrder = 10;
  return sp;
}

/* ---------- 実地形（地理院DEM5A）と 兵庫県DSM（1m）: base64 Int16 グリッド ---------- */
const REAL = SCENE_DATA.real || null;
function decI16(b64){ const bin=atob(b64); const n=bin.length>>1; const a=new Int16Array(n); for(let i=0;i<n;i++){ a[i] = ((bin.charCodeAt(2*i) | (bin.charCodeAt(2*i+1)<<8)) << 16) >> 16; } return a; }
function decU8(b64){ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a; }
function makeGrid(g){
  if(!g) return null;
  const G = {x0:g.x0, y0:g.y0, step:g.step, nx:g.nx, ny:g.ny, h:decI16(g.h), s:0.1};
  G.at = function(i,j){ return this.h[j*this.nx+i]*this.s; };
  G.sample = function(x, y){   // x=東, y=北（データ座標）
    const fx=(x-this.x0)/this.step, fy=(y-this.y0)/this.step;
    if(fx<0||fy<0||fx>this.nx-1||fy>this.ny-1) return null;
    const i=Math.min(this.nx-2, Math.floor(fx)), j=Math.min(this.ny-2, Math.floor(fy)); const tx=fx-i, ty=fy-j;
    return (this.at(i,j)*(1-tx)*(1-ty) + this.at(i+1,j)*tx*(1-ty) + this.at(i,j+1)*(1-tx)*ty + this.at(i+1,j+1)*tx*ty);
  };
  return G;
}
const TER_W = REAL ? makeGrid(REAL.terrain_wide) : null, TER_I = REAL ? makeGrid(REAL.terrain_inner) : null;
const TERRAIN_ON = !!TER_W;
/* world(x,z) → 地表標高 m（z=-北）。地図外は最寄りの端の値 */
function TH(x, z){
  if(!TERRAIN_ON) return 0;
  const y=-z;
  let v = TER_I ? TER_I.sample(x, y) : null;
  if(v===null) v = TER_W.sample(x, y);
  if(v===null){
    const cx = Math.max(TER_W.x0, Math.min(TER_W.x0+(TER_W.nx-1)*TER_W.step, x)), cy = Math.max(TER_W.y0, Math.min(TER_W.y0+(TER_W.ny-1)*TER_W.step, y));
    v = TER_W.sample(cx, cy);
  }
  return v===null ? 0 : v;
}
const TY = (x, z, off=0)=> TH(x, z) + off;

/* ---------- GSI 航空写真タイル地面（広域 z15 + 中心部 z17 高解像）: 地形に沿って起伏 ---------- */
const CLAT = SCENE_DATA.c.lat, CLON = SCENE_DATA.c.lon;
function lon2tx(lon,z){ return (lon+180)/360*Math.pow(2,z); }
function lat2ty(lat,z){ return (1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*Math.pow(2,z); }
const groundGroup = new THREE.Group();
function buildTiles(ZOOM, N, y, tone){
  const ctx = lon2tx(CLON,ZOOM), cty = lat2ty(CLAT,ZOOM);
  const metersPerTile = 40075016.686*Math.cos(CLAT*Math.PI/180)/Math.pow(2,ZOOM);
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  for(let dx=-N; dx<=N; dx++) for(let dy=-N; dy<=N; dy++){
    const tx = Math.floor(ctx)+dx, ty = Math.floor(cty)+dy;
    const key = `${ZOOM}/${tx}/${ty}`;
    const url = (typeof TILE_DATA !== 'undefined' && TILE_DATA[key]) ? TILE_DATA[key] : `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${key}.jpg`;
    const tex = loader.load(url);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.MeshBasicMaterial({map:tex, color:tone});
    const SEGS = TERRAIN_ON ? (ZOOM===15 ? 20 : 10) : 1;
    const geo = new THREE.PlaneGeometry(metersPerTile, metersPerTile, SEGS, SEGS);
    const px=(tx+0.5-ctx)*metersPerTile, pz=(ty+0.5-cty)*metersPerTile;
    if(TERRAIN_ON){ const ps=geo.attributes.position; for(let i=0;i<ps.count;i++){ ps.setZ(i, TH(px+ps.getX(i), pz-ps.getY(i)) + y); } }
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI/2;
    plane.position.set(px, TERRAIN_ON ? 0 : y, pz);
    groundGroup.add(plane);
  }
  return (2*N+1)*metersPerTile;
}
const WIDE_SPAN = buildTiles(15, 6, 0, 0x7e879c);   // 約13km四方
buildTiles(17, 5, 0.15, 0x8a92a8);                   // 中心 約2.7km四方（姫路城〜姫路駅）
scene.add(groundGroup);
/* 地図外の暗い地面（広域ODノード用） */
const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshBasicMaterial({color:0x0e121b}));
outerGround.rotation.x = -Math.PI/2; outerGround.position.y = -1.5;
scene.add(outerGround);

/* ---------- サイト地物（レイヤーシステム） ---------- */
const siteGroup = new THREE.Group();
scene.add(siteGroup);
const LG = { bldg:new THREE.Group(), lu:new THREE.Group(), ped:new THREE.Group(),
             poi:new THREE.Group(), dots:new THREE.Group(), hotel:new THREE.Group(), heat:new THREE.Group(), rail:new THREE.Group() };
Object.values(LG).forEach(g=>siteGroup.add(g));
const LAYER_STATE = { lu:true, ped:true, poi:true, dots:true, hotel:true, rail:true, agents:true };
let heatMode = 'off';  // off | all | in | dom

const MAT = {
  bldg: new THREE.MeshStandardMaterial({color:0x39415a, roughness:0.9, metalness:0.05}),
  bldgNamed: new THREE.MeshStandardMaterial({color:0x4a5578, roughness:0.85}),
  castle: new THREE.MeshStandardMaterial({color:0xe9e4d6, roughness:0.55, metalness:0.1, emissive:0x3a2e12, emissiveIntensity:0.25}),
  castleWall: new THREE.MeshStandardMaterial({color:0x6d6a60, roughness:0.95}),
  road0: new THREE.LineBasicMaterial({color:0x353d54, transparent:true, opacity:0.45}),
  road1: new THREE.LineBasicMaterial({color:0x5a6580, transparent:true, opacity:0.8}),
  road2: new THREE.LineBasicMaterial({color:0x8f9cc0, transparent:true, opacity:0.95}),
  roadPed: new THREE.LineBasicMaterial({color:0xe87ca0, transparent:true, opacity:0.95}),
  roadFoot: new THREE.LineBasicMaterial({color:0x3f8f80, transparent:true, opacity:0.4}),
  railJR: new THREE.LineBasicMaterial({color:0xd0d6ea, transparent:true, opacity:0.95}),
  railShin: new THREE.LineBasicMaterial({color:0x9ec5ff, transparent:true, opacity:1.0}),
  railSanyo: new THREE.LineBasicMaterial({color:0xff9a3d, transparent:true, opacity:1.0}),
  railOther: new THREE.LineBasicMaterial({color:0x8a93ad, transparent:true, opacity:0.6}),
  rope: new THREE.LineBasicMaterial({color:0xffd166, transparent:true, opacity:0.9}),
  luPark:  new THREE.MeshBasicMaterial({color:0x1d3a27, transparent:true, opacity:0.55}),
  luForest:new THREE.MeshBasicMaterial({color:0x16301f, transparent:true, opacity:0.45}),
  luRetail:new THREE.MeshBasicMaterial({color:0x47233c, transparent:true, opacity:0.5}),
  luEdu:   new THREE.MeshBasicMaterial({color:0x1f2a4e, transparent:true, opacity:0.5}),
  luWater: new THREE.MeshBasicMaterial({color:0x1c3350, transparent:true, opacity:0.75}),
  luMoat:  new THREE.MeshBasicMaterial({color:0x2a5a8a, transparent:true, opacity:0.85}),
  park:    new THREE.MeshBasicMaterial({color:0x232a3e, transparent:true, opacity:0.6}),
};

/* 内周建物（フル押し出し） — 一般建物は統合メッシュ（ドローコール削減）、姫路城・名称付きは個別（ホバー/クリック対象） */
const CASTLE_MESHES = [];
function mergedExtrude(list, mat){
  const arrs=[]; let total=0;
  list.forEach(b=>{
    try{
      const g0 = new THREE.ExtrudeGeometry(polyShape(b.p), {depth:b.h, bevelEnabled:false}); const g = g0.index ? g0.toNonIndexed() : g0;
      if(TERRAIN_ON){ let cx=0, cy=0; b.p.forEach(q=>{cx+=q[0]; cy+=q[1];}); cx/=b.p.length; cy/=b.p.length; const hh=TH(cx,-cy); const ar=g.attributes.position.array; for(let k=2;k<ar.length;k+=3) ar[k]+=hh; }
      arrs.push(g.attributes.position.array); total += g.attributes.position.array.length;
    }catch(e){}
  });
  const pos = new Float32Array(total); let o=0;
  arrs.forEach(a=>{ pos.set(a,o); o+=a.length; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI/2;
  return m;
}
(function buildBuildings(){
  const plain = [];
  SCENE_DATA.buildings.forEach(b=>{
    b.h = b.h || 6 + rnd()*5;
    if(b.k==='castle' || b.n){
      const mat = b.k==='castle' ? MAT.castle : (b.k==='wall' ? MAT.castleWall : MAT.bldgNamed);
      const m = extrudePoly(b.p, b.h, mat);
      m.userData.name = b.n;
      if(b.k==='castle'){ m.userData.castle = true; CASTLE_MESHES.push(m); }
      LG.bldg.add(m);
    } else plain.push(b);
  });
  for(let i=0;i<plain.length;i+=1500) LG.bldg.add(mergedExtrude(plain.slice(i,i+1500), MAT.bldg));
})();

/* ---------- 姫路城 天守群の立体モデル（白漆喰の層塔 × 石垣 × 鯱） — フットプリントの向き・大きさに合わせて生成 ---------- */
const KEEP_MAT = {
  stone: new THREE.MeshStandardMaterial({color:0x7c776a, roughness:0.95}),
  wall:  new THREE.MeshStandardMaterial({color:0xf6f3ec, roughness:0.55, emissive:0x33291a, emissiveIntensity:0.32}),
  roof:  new THREE.MeshStandardMaterial({color:0x2c3140, roughness:0.45, metalness:0.25}),
  gold:  new THREE.MeshStandardMaterial({color:0xffd166, emissive:0xff9f00, emissiveIntensity:0.7}),
};
function frustumGeo(wb, db, wt, dt, h){
  const v=[[-wb/2,0,-db/2],[wb/2,0,-db/2],[wb/2,0,db/2],[-wb/2,0,db/2],[-wt/2,h,-dt/2],[wt/2,h,-dt/2],[wt/2,h,dt/2],[-wt/2,h,dt/2]];
  const f=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]];
  const pos=[]; f.forEach(q=>{ [q[0],q[1],q[2], q[0],q[2],q[3]].forEach(i=> pos.push(...v[i])); });
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return g;
}
function polyAxis(pts){
  /* 最長辺の向き・寸法 */
  let best=0, ang=0;
  for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; const L=Math.hypot(b[0]-a[0], b[1]-a[1]); if(L>best){ best=L; ang=Math.atan2(b[1]-a[1], b[0]-a[0]); } }
  let area=0; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; area += a[0]*b[1]-b[0]*a[1]; } area=Math.abs(area)/2;
  const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length, cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  return {w:best, d:Math.max(8, area/best), ang, cx, cy};
}
function buildKeep(cx, cz, w, d, ang, tiers, name){
  const g = new THREE.Group();
  const stoneH = tiers>=5 ? 17 : 8;
  const wallH = tiers>=5 ? 38 : 17;
  const th = wallH/tiers;
  const base = new THREE.Mesh(frustumGeo(w*1.35, d*1.35, w*1.02, d*1.02, stoneH), KEEP_MAT.stone); g.add(base);
  for(let i=0;i<tiers;i++){
    const k = 1 - 0.13*i, y0 = stoneH + i*th;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w*k, th*0.72, d*k), KEEP_MAT.wall); wall.position.y = y0 + th*0.36; g.add(wall);
    const last = i===tiers-1;
    const roof = new THREE.Mesh(frustumGeo(w*k*1.28, d*k*1.28, last ? w*k*0.18 : w*k*0.78, last ? d*k*0.18 : d*k*0.78, last ? th*0.9 : th*0.34), KEEP_MAT.roof);
    roof.position.y = y0 + th*0.7; g.add(roof);
    if(last){ [-1,1].forEach(sx=>{ const sh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.7, w*0.035), 8, 6), KEEP_MAT.gold); sh.position.set(sx*w*k*0.09, y0+th*1.62, 0); g.add(sh); }); }
  }
  g.position.set(cx, TH(cx, cz) + (tiers>=5 ? 2 : 0), cz); g.rotation.y = ang;
  g.traverse(o=>{ if(o.isMesh){ o.userData = {name, castle:true}; CASTLE_MESHES.push(o); } });
  return g;
}
(function buildCastleKeeps(){
  const keepB = SCENE_DATA.buildings.find(b=> b.k==='castle' && (b.n||'').includes('大天守'));
  const smalls = SCENE_DATA.buildings.filter(b=> b.k==='castle' && (b.n||'').includes('小天守') && polyAxis(b.p).w*polyAxis(b.p).d > 300);
  const hideExtrusion = b=>{ const m = CASTLE_MESHES.find(m=> m.userData.name===b.n && m.geometry && m.geometry.type==='ExtrudeGeometry' && Math.abs(m.geometry.boundingBox ? 0 : 0)===0); };
  const targets = [];
  if(keepB){ const ax = polyAxis(keepB.p); targets.push({b:keepB, ax, tiers:5, name:'姫路城 大天守（国宝・世界遺産）'}); }
  smalls.slice(0,3).forEach(b=>{ const ax = polyAxis(b.p); targets.push({b, ax, tiers:3, name:'姫路城 小天守・渡櫓'}); });
  targets.forEach(t=>{
    /* 元の押し出しは石垣として低く残す（高さを抑える） */
    LG.bldg.children.filter(m=> m.userData && m.userData.name===t.b.n).forEach(m=>{ m.scale.y = 0.001; m.visible = false; });
    const w = Math.min(t.ax.w, t.tiers>=5 ? 36 : 22)*1.3, d = Math.min(t.ax.d, t.tiers>=5 ? 30 : 18)*1.3;
    LG.bldg.add(buildKeep(t.ax.cx, -t.ax.cy, w, d, t.ax.ang, t.tiers, t.name));
  });
})();

/* ポリゴン群の単一マージメッシュ化（ドローコール削減） */
function mergedFlat(polys, mat, y){
  const arrs=[]; let total=0;
  polys.forEach(p=>{
    try{
      if(p.length < 3) return;
      const g0 = new THREE.ShapeGeometry(polyShape(p)); const g = g0.index ? g0.toNonIndexed() : g0;
      if(TERRAIN_ON){ const ar=g.attributes.position.array; for(let k=0;k<ar.length;k+=3) ar[k+2]=TH(ar[k], -ar[k+1]); }
      arrs.push(g.attributes.position.array); total += g.attributes.position.array.length;
    }catch(e){}
  });
  const pos = new Float32Array(total); let o=0;
  arrs.forEach(a=>{ pos.set(a,o); o+=a.length; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI/2; m.position.y = y;
  return m;
}
/* 中間帯建物（フラット近似・1メッシュ） */
const midMesh = mergedFlat(SCENE_DATA.mid, new THREE.MeshBasicMaterial({color:0x2a3048, transparent:true, opacity:0.8}), 2.2);
LG.bldg.add(midMesh);

/* 土地利用（カテゴリ別マージ）＋駐車場 */
[['park',MAT.luPark,0.3],['forest',MAT.luForest,0.28],['retail',MAT.luRetail,0.34],['edu',MAT.luEdu,0.34],['water',MAT.luWater,0.4],['moat',MAT.luMoat,0.5]].forEach(d=>{
  if(SCENE_DATA.lu[d[0]] && SCENE_DATA.lu[d[0]].length) LG.lu.add(mergedFlat(SCENE_DATA.lu[d[0]], d[1], d[2]));
});
LG.lu.add(mergedFlat(SCENE_DATA.parking, MAT.park, 0.45));
/* 内堀・中堀の縁を発光ラインでなぞり、城郭の輪郭を強調 */
(SCENE_DATA.lu.moat||[]).forEach(poly=>{
  const pts = poly.map(p=>new THREE.Vector3(p[0], TY(p[0], -p[1], 1.0), -p[1]));
  LG.lu.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:0x6fc3ff, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false})));
});

/* 道路（クラス別マージLineSegments: 0生活/1補助幹線/2幹線/3歩行者・商店街/4歩道） */
function mergedSegs(polylines, mat, y){
  const pts=[];
  polylines.forEach(pl=>{
    for(let i=0;i<pl.length-1;i++){
      pts.push(new THREE.Vector3(pl[i][0], TY(pl[i][0], -pl[i][1], y), -pl[i][1]), new THREE.Vector3(pl[i+1][0], TY(pl[i+1][0], -pl[i+1][1], y), -pl[i+1][1]));
    }
  });
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
}
const ROAD_LINES = {};
[[0,MAT.road0,0.6],[1,MAT.road1,0.65],[2,MAT.road2,0.7],[3,MAT.roadPed,0.72],[4,MAT.roadFoot,0.55]].forEach(cfg=>{
  const set = SCENE_DATA.roads.filter(r=>r.c===cfg[0]).map(r=>r.p);
  const ls = mergedSegs(set, cfg[1], cfg[2]);
  ROAD_LINES[cfg[0]] = ls;
  (cfg[0]>=3 ? LG.ped : siteGroup).add(ls);
});
/* 鉄道: JR山陽本線・播但線・姫新線（白） / 山陽新幹線（水色） / 山陽電鉄（橙） / ロープウェイ（金） */
LG.rail.add(mergedSegs(SCENE_DATA.rail.jr,    MAT.railJR,    0.8));
LG.rail.add(mergedSegs(SCENE_DATA.rail.shin,  MAT.railShin,  0.9));
LG.rail.add(mergedSegs(SCENE_DATA.rail.sanyo, MAT.railSanyo, 0.85));
LG.rail.add(mergedSegs(SCENE_DATA.rail.other, MAT.railOther, 0.75));
LG.rail.add(mergedSegs(SCENE_DATA.ropeway,    MAT.rope,      6));

/* 点描（広域 建物センター） */
const dotMat = new THREE.PointsMaterial({color:0x556080, size:2.6, transparent:true, opacity:0.5, depthWrite:false});
(function buildDots(){
  const d = SCENE_DATA.dots, n = d.length/2;
  const pos = new Float32Array(n*3);
  for(let i=0;i<n;i++){ pos[i*3]=d[i*2]; pos[i*3+1]=TY(d[i*2], -d[i*2+1], 1.6); pos[i*3+2]=-d[i*2+1]; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  LG.dots.add(new THREE.Points(geo, dotMat));
})();

/* POI（世界遺産・史跡 / 文化施設 / 商業 / 交通 / 自然・公園） */
const POI_CAT = {
  castle:{c:0xffd166, l:'世界遺産・史跡'}, culture:{c:0xb56ce8, l:'文化施設'}, shop:{c:0xe87ca0, l:'商業・食'},
  transit:{c:0x4da3ff, l:'交通結節点'}, nature:{c:0x3ddc84, l:'自然・公園'}
};
const POI_BY_NAME = {};
SCENE_DATA.pois.forEach(p=>{
  POI_BY_NAME[p.n] = p;
  const cat = POI_CAT[p.c];
  const pinMat = new THREE.MeshStandardMaterial({color:cat.c, emissive:cat.c, emissiveIntensity:0.3, roughness:0.5});
  const sz = p.big ? 1.6 : 1;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7*sz, 20*sz, 6), pinMat);
  cone.rotation.x = Math.PI; cone.position.y = 14*sz;
  const orb = new THREE.Mesh(new THREE.SphereGeometry(6*sz, 8, 6), pinMat);
  orb.position.y = 27*sz;
  const ud = { name:p.n, poi:true, desc:p.d, catL:cat.l, dwell:p.dw };
  cone.userData = ud; orb.userData = ud;
  const pin = new THREE.Group();
  pin.add(cone, orb);
  pin.position.set(p.p[0], TH(p.p[0], -p.p[1]), -p.p[1]);
  const lb = makeLabel(p.n, p.big ? 16 : 11, hx6(cat.c));
  lb.position.set(p.p[0], TY(p.p[0], -p.p[1], 44*sz), -p.p[1]);
  LG.poi.add(pin, lb);
});

/* 宿泊施設（OSM実データ）＋駅・IC */
(function hotelLayer(){
  const hMat = new THREE.MeshStandardMaterial({color:0x35d0c0, emissive:0x0d4a44, roughness:0.5});
  SCENE_DATA.hotels.forEach(ht=>{
    const d = Math.hypot(ht.p[0], ht.p[1]-1200);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 26, 6), hMat);
    const hy = TH(ht.p[0], -ht.p[1]);
    tower.position.set(ht.p[0], hy+13, -ht.p[1]);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 7, 6), hMat);
    roof.position.set(ht.p[0], hy+29.5, -ht.p[1]);
    tower.userData = roof.userData = { name:ht.n, hotel:true,
      desc:`宿泊施設（姫路駅から約${d>=1000?(d/1000).toFixed(1)+'km':Math.round(d)+'m'}）。宿泊者は夜間の市内回遊・翌日の周遊起点になります` };
    LG.hotel.add(tower, roof);
    if(d < 900){
      const lb = makeLabel(ht.n, 8.5, '#35d0c0', 500);
      lb.position.set(ht.p[0], hy+42, -ht.p[1]);
      LG.hotel.add(lb);
    }
  });
  SCENE_DATA.stations.forEach(s=>{
    const col = s.k==='sanyo' ? 0xff9a3d : (s.k==='shin' ? 0x9ec5ff : 0xd0d6ea);
    const big = s.n==='姫路' || s.n==='山陽姫路';
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(big?14:8, big?14:8, 3, 10),
      new THREE.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:0.25, roughness:0.6}));
    disc.position.set(s.p[0], TY(s.p[0], -s.p[1], 1.8), -s.p[1]);
    disc.userData = { name:(s.k==='sanyo'?'山陽電鉄 ':'JR ') + s.n + '駅' };
    LG.rail.add(disc);
    if(!big){ const lb = makeLabel(s.n, 8, hx6(col), 500); lb.position.set(s.p[0], TY(s.p[0], -s.p[1], 26), -s.p[1]); LG.rail.add(lb); }
  });
  SCENE_DATA.ic.forEach(ic=>{
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), new THREE.MeshStandardMaterial({color:0x8fd0ff, emissive:0x1a3a66, roughness:0.5}));
    m.position.set(ic.p[0], TY(ic.p[0], -ic.p[1], 10), -ic.p[1]);
    m.userData = { name:ic.n, desc:'高速道路・自動車専用道の出入口。自家用車・観光バスの流入ゲート' };
    siteGroup.add(m);
    const lb = makeLabel(ic.n, 9, '#8fd0ff', 500); lb.position.set(ic.p[0], TY(ic.p[0], -ic.p[1], 30), -ic.p[1]); siteGroup.add(lb);
  });
})();

function applyLayers(){
  LG.lu.visible   = LAYER_STATE.lu;
  LG.ped.visible  = LAYER_STATE.ped;
  LG.poi.visible  = LAYER_STATE.poi;
  LG.dots.visible = LAYER_STATE.dots;
  LG.hotel.visible = LAYER_STATE.hotel;
  LG.rail.visible = LAYER_STATE.rail;
  LG.heat.visible = (heatMode !== 'off');
}

/* ---------- 主要ノード座標（three座標: x, z） ---------- */
const P = n=>{ const p = POI_BY_NAME[n]; return p ? {x:p.p[0], z:-p.p[1]} : {x:0, z:0}; };
const CASTLE = P('姫路城 大天守');
const GATE_OTEMON = P('大手門');
const STN = P('JR姫路駅');
const SANYO_STN = P('山陽姫路駅');
const BUS_TERM = P('姫路駅北 バスターミナル');
const PORT = P('姫路港');

/* 姫路城ラベル（大） */
const castleLabel = makeLabel('世界遺産 姫路城（白鷺城）', 40, '#ffd166');
const CASTLE_Y = TH(CASTLE.x, CASTLE.z);
castleLabel.position.set(CASTLE.x, CASTLE_Y+150, CASTLE.z);
siteGroup.add(castleLabel);
const castleLabel2 = makeLabel('国宝・1993年 世界遺産登録 ｜ 2025年度 入城 156.8万人', 16, '#f0e6c8', 500);
castleLabel2.position.set(CASTLE.x, CASTLE_Y+112, CASTLE.z);
siteGroup.add(castleLabel2);
/* 城郭の足元に金色の淡い発光ディスク（目印） */
const castleGlow = new THREE.Mesh(new THREE.CircleGeometry(230, 48), new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:0.12, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
castleGlow.rotation.x = -Math.PI/2; castleGlow.position.set(CASTLE.x-30, TY(CASTLE.x-30, CASTLE.z+110, 0.8), CASTLE.z+110);
siteGroup.add(castleGlow);
/* 大天守の存在感: 光柱 */
const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 10, 260, 12, 1, true),
  new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:0.10, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
beam.position.set(CASTLE.x, CASTLE_Y+150, CASTLE.z);
siteGroup.add(beam);

/* ---------- 姫路城郭 実測レリーフ（兵庫県 DSM 1m → 2m グリッド）: 石垣・櫓・樹木・堀を実形状で ---------- */
let castleRelief = null;
(function buildCastleRelief(){
  if(!REAL || !REAL.castle) return;
  const g = REAL.castle, H = decI16(g.h), ND = decI16(g.nd), C = decU8(g.c);
  const nx=g.nx, ny=g.ny, st=g.step;
  const geo = new THREE.PlaneGeometry((nx-1)*st, (ny-1)*st, nx-1, ny-1);
  const pos = geo.attributes.position, col = new Float32Array(pos.count*3);
  const cx0 = g.x0 + (nx-1)*st/2, cy0 = g.y0 + (ny-1)*st/2;   // データ座標の中心
  const KX = CASTLE.x, KZ = CASTLE.z;
  const EX = 150, EY = -10, ERX = 470, ERY = 410;   // 城郭（内堀〜中堀・好古園・動物園）を覆う楕円（データ座標）
  const inside = new Uint8Array(pos.count);
  const c = new THREE.Color();
  const ivory=new THREE.Color(0xf3efe4), gray=new THREE.Color(0x8a8578), stone=new THREE.Color(0x6a665c), green=new THREE.Color(0x2f6b3c), grass=new THREE.Color(0x4d6a3a), water=new THREE.Color(0x2a5f95), ground=new THREE.Color(0x5b5a52);
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
    const k = j*nx+i;               // PlaneGeometry: 行 j は上(+y)から
    const vx = g.x0 + i*st, vy = g.y0 + (ny-1-j)*st;   // データ座標（y=北）
    const gi = (ny-1-j)*nx + i;                          // グリッド配列は y0（南）から北へ
    let h = H[gi]*0.1, nd = ND[gi]*0.1; const cl = C[gi];
    /* 大天守は素屋根期の計測（平坦な箱）になり得るため、天守台の高さに均して立体モデルに置換 */
    const dk = Math.hypot(vx-KX, vy+KZ);
    if(dk < 40){ h = Math.min(h, TH(KX,KZ)+18); nd = Math.min(nd, 18); }
    /* 城郭の楕円範囲でクリップし、縁は地形（DEM）へ滑らかに接続 */
    const e = Math.pow((vx-EX)/ERX, 2) + Math.pow((vy-EY)/ERY, 2);
    inside[k] = e <= 1;
    if(e > 0.82){ const t = Math.min(1, (e-0.82)/0.18); h = h*(1-t) + (TH(vx,-vy)+0.4)*t; }
    pos.setZ(k, h);
    /* 斜度（石垣判定） */
    const hl = H[(ny-1-j)*nx + Math.max(0,i-1)]*0.1, hr = H[(ny-1-j)*nx + Math.min(nx-1,i+1)]*0.1;
    const hu = H[Math.min(ny-1, ny-j)*nx + i]*0.1, hd = H[Math.max(0, ny-2-j)*nx + i]*0.1;
    const slope = Math.max(Math.abs(hr-hl), Math.abs(hu-hd))/(2*st);
    if(cl===3) c.copy(water);
    else if(cl===1 && nd > 9) c.copy(ivory);
    else if(cl===1) c.copy(gray);
    else if(slope > 0.9) c.copy(stone);
    else if(cl===2 && nd > 3) c.copy(green).lerp(grass, Math.min(1, (nd-3)/12));
    else c.copy(ground).lerp(grass, 0.35);
    const sh = 0.75 + 0.25*Math.min(1, Math.max(0, (hr-hl)*0.5+0.5));
    col[k*3]=c.r*sh; col[k*3+1]=c.g*sh; col[k*3+2]=c.b*sh;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  /* 楕円外の三角形を除去 */
  const idx = geo.index.array, keep = [];
  for(let t=0;t<idx.length;t+=3){ if(inside[idx[t]] && inside[idx[t+1]] && inside[idx[t+2]]) keep.push(idx[t], idx[t+1], idx[t+2]); }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.85, metalness:0.05});
  castleRelief = new THREE.Mesh(geo, mat);
  castleRelief.rotation.x = -Math.PI/2;
  castleRelief.position.set(cx0, 0.3, -cy0);
  castleRelief.userData = {name:'姫路城（世界遺産・国宝）— 実測DSMレリーフ', castle:true};
  CASTLE_MESHES.push(castleRelief);
  LG.bldg.add(castleRelief);
  /* レリーフ範囲内の押し出し（城郭の櫓・門など）は二重描画になるため非表示。大天守・小天守の立体モデルは残す */
  LG.bldg.children.forEach(m=>{ if(m.userData && m.userData.castle && m!==castleRelief && !(m.parent && m.parent!==LG.bldg) && m.geometry && m.geometry.type==='ExtrudeGeometry') m.visible=false; });
})();
