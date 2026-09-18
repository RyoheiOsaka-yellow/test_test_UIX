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
el.addEventListener('contextmenu', e=>e.preventDefault());
el.addEventListener('mousedown', e=>{
  if(!ctrl.enabled) return;
  if(e.button===0) ctrl.rotating = true;
  if(e.button===2) ctrl.panning = true;
  ctrl.px = e.clientX; ctrl.py = e.clientY;
});
addEventListener('mouseup', ()=>{ ctrl.rotating=false; ctrl.panning=false; });
addEventListener('mousemove', e=>{
  const dx = e.clientX-ctrl.px, dy = e.clientY-ctrl.py;
  if(ctrl.rotating && ctrl.enabled){
    ctrl.sph.theta -= dx*0.0048; ctrl.sph.phi -= dy*0.0042; ctrl.apply();
  } else if(ctrl.panning && ctrl.enabled){
    const s = ctrl.sph.radius*0.0013;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).negate();
    ctrl.target.addScaledVector(right, -dx*s).addScaledVector(fwd, dy*s);
    ctrl.apply();
  }
  ctrl.px=e.clientX; ctrl.py=e.clientY;
});
el.addEventListener('wheel', e=>{
  if(!ctrl.enabled) return;
  e.preventDefault();
  ctrl.sph.radius *= (1 + Math.sign(e.deltaY)*0.09);
  ctrl.apply();
}, {passive:false});
/* タッチ（1本指: 回転 / 2本指: ピンチズーム） */
let touchD = 0;
el.addEventListener('touchstart', e=>{
  if(e.touches.length===1){ ctrl.rotating=true; ctrl.px=e.touches[0].clientX; ctrl.py=e.touches[0].clientY; }
  if(e.touches.length===2){ ctrl.rotating=false; touchD = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); }
}, {passive:true});
el.addEventListener('touchmove', e=>{
  if(e.touches.length===1 && ctrl.rotating){
    const dx=e.touches[0].clientX-ctrl.px, dy=e.touches[0].clientY-ctrl.py;
    ctrl.sph.theta -= dx*0.0048; ctrl.sph.phi -= dy*0.0042; ctrl.apply();
    ctrl.px=e.touches[0].clientX; ctrl.py=e.touches[0].clientY;
  } else if(e.touches.length===2){
    const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    if(touchD>0){ ctrl.sph.radius *= touchD/d; ctrl.apply(); }
    touchD = d;
  }
}, {passive:true});
el.addEventListener('touchend', ()=>{ ctrl.rotating=false; touchD=0; }, {passive:true});

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
  m.position.y = y0;
  return m;
}
function flatPoly(pts, mat, y0=0.1){
  const geo = new THREE.ShapeGeometry(polyShape(pts));
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

/* ---------- GSI 航空写真タイル地面（広域 z15 + 中心部 z17 高解像） ---------- */
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
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(metersPerTile, metersPerTile), mat);
    plane.rotation.x = -Math.PI/2;
    plane.position.set((tx+0.5-ctx)*metersPerTile, y, (ty+0.5-cty)*metersPerTile);
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

/* ポリゴン群の単一マージメッシュ化（ドローコール削減） */
function mergedFlat(polys, mat, y){
  const arrs=[]; let total=0;
  polys.forEach(p=>{
    try{
      if(p.length < 3) return;
      const g0 = new THREE.ShapeGeometry(polyShape(p)); const g = g0.index ? g0.toNonIndexed() : g0;
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

/* 道路（クラス別マージLineSegments: 0生活/1補助幹線/2幹線/3歩行者・商店街/4歩道） */
function mergedSegs(polylines, mat, y){
  const pts=[];
  polylines.forEach(pl=>{
    for(let i=0;i<pl.length-1;i++){
      pts.push(new THREE.Vector3(pl[i][0], y, -pl[i][1]), new THREE.Vector3(pl[i+1][0], y, -pl[i+1][1]));
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
  for(let i=0;i<n;i++){ pos[i*3]=d[i*2]; pos[i*3+1]=1.6; pos[i*3+2]=-d[i*2+1]; }
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
  pin.position.set(p.p[0], 0, -p.p[1]);
  const lb = makeLabel(p.n, p.big ? 16 : 11, hx6(cat.c));
  lb.position.set(p.p[0], 44*sz, -p.p[1]);
  LG.poi.add(pin, lb);
});

/* 宿泊施設（OSM実データ）＋駅・IC */
(function hotelLayer(){
  const hMat = new THREE.MeshStandardMaterial({color:0x35d0c0, emissive:0x0d4a44, roughness:0.5});
  SCENE_DATA.hotels.forEach(ht=>{
    const d = Math.hypot(ht.p[0], ht.p[1]-1200);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 26, 6), hMat);
    tower.position.set(ht.p[0], 13, -ht.p[1]);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 7, 6), hMat);
    roof.position.set(ht.p[0], 29.5, -ht.p[1]);
    tower.userData = roof.userData = { name:ht.n, hotel:true,
      desc:`宿泊施設（姫路駅から約${d>=1000?(d/1000).toFixed(1)+'km':Math.round(d)+'m'}）。宿泊者は夜間の市内回遊・翌日の周遊起点になります` };
    LG.hotel.add(tower, roof);
    if(d < 900){
      const lb = makeLabel(ht.n, 8.5, '#35d0c0', 500);
      lb.position.set(ht.p[0], 42, -ht.p[1]);
      LG.hotel.add(lb);
    }
  });
  SCENE_DATA.stations.forEach(s=>{
    const col = s.k==='sanyo' ? 0xff9a3d : (s.k==='shin' ? 0x9ec5ff : 0xd0d6ea);
    const big = s.n==='姫路' || s.n==='山陽姫路';
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(big?14:8, big?14:8, 3, 10),
      new THREE.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:0.25, roughness:0.6}));
    disc.position.set(s.p[0], 1.8, -s.p[1]);
    disc.userData = { name:(s.k==='sanyo'?'山陽電鉄 ':'JR ') + s.n + '駅' };
    LG.rail.add(disc);
    if(!big){ const lb = makeLabel(s.n, 8, hx6(col), 500); lb.position.set(s.p[0], 26, -s.p[1]); LG.rail.add(lb); }
  });
  SCENE_DATA.ic.forEach(ic=>{
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), new THREE.MeshStandardMaterial({color:0x8fd0ff, emissive:0x1a3a66, roughness:0.5}));
    m.position.set(ic.p[0], 10, -ic.p[1]);
    m.userData = { name:ic.n, desc:'高速道路・自動車専用道の出入口。自家用車・観光バスの流入ゲート' };
    siteGroup.add(m);
    const lb = makeLabel(ic.n, 9, '#8fd0ff', 500); lb.position.set(ic.p[0], 30, -ic.p[1]); siteGroup.add(lb);
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
const castleLabel = makeLabel('世界遺産 姫路城', 22, '#ffd166');
castleLabel.position.set(CASTLE.x, 120, CASTLE.z);
siteGroup.add(castleLabel);
/* 大天守の存在感: 光柱 */
const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 10, 260, 12, 1, true),
  new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:0.10, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
beam.position.set(CASTLE.x, 150, CASTLE.z);
siteGroup.add(beam);
