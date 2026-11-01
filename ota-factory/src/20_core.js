// ================= 基本セットアップ =================
const app = document.getElementById("app");
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance", preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
app.appendChild(renderer.domElement);
let shadowDirty = true; function dirtyShadow(){ shadowDirty = true; }

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.2, 3000);

// 環境マップ（金属・ガラスの映り込み用）
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

// ---- ライティング ----
const hemi = new THREE.HemisphereLight(0xbfd4ee, 0x4a4a42, 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 2.0);
sun.position.set(-90, 160, 110); scene.add(sun); scene.add(sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.25;
{ const sc = sun.shadow.camera; sc.left=-130; sc.right=130; sc.top=130; sc.bottom=-130; sc.near=20; sc.far=600; sc.updateProjectionMatrix(); }
const fill = new THREE.DirectionalLight(0x8fb0ff, 0.25); fill.position.set(120, 80, -140); scene.add(fill);

// ---- 空 ----
const skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ top:{value:new THREE.Color(0x5f93d6)}, mid:{value:new THREE.Color(0xcfe0f2)}, bot:{value:new THREE.Color(0xe9eef2)} },
  vertexShader:"varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:"uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vW;\n"+
    "void main(){ float h=normalize(vW).y; vec3 c = h>0.0 ? mix(mid,top,pow(h,0.55)) : mix(mid,bot,clamp(-h*5.0,0.0,1.0));\n"+
    "  gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" });
const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

// 時間帯プリセット（昼・夕・夜）
const DAY_PRESETS = {
  day:  { top:0x5f93d6, mid:0xcfe0f2, bot:0xe9eef2, fog:0xd5e0ea, sun:[-90,160,110], sunC:0xfff3e0, sunI:2.0, hemi:0.55, env:0.55, exp:1.05, emis:0.0 },
  dusk: { top:0x2f4f86, mid:0xf0a66a, bot:0xd7c6b4, fog:0xd9b39a, sun:[-170,45,60], sunC:0xffb070, sunI:1.5, hemi:0.35, env:0.35, exp:1.0, emis:0.8 },
  night:{ top:0x05080f, mid:0x151e2e, bot:0x1b2230, fog:0x141a24, sun:[60,120,-90], sunC:0x8da8d8, sunI:0.25, hemi:0.12, env:0.18, exp:0.95, emis:1.0 },
};
let dayMode = "day";
const emissiveMats = []; // 夜に発光させる材質
function setDay(mode){
  dayMode = mode; const p = DAY_PRESETS[mode];
  skyMat.uniforms.top.value.set(p.top); skyMat.uniforms.mid.value.set(p.mid); skyMat.uniforms.bot.value.set(p.bot);
  scene.background = new THREE.Color(p.fog); scene.fog = new THREE.Fog(p.fog, 500, 1500);
  sun.position.set(...p.sun); sun.color.set(p.sunC); sun.intensity = p.sunI;
  hemi.intensity = p.hemi; scene.environmentIntensity = p.env; renderer.toneMappingExposure = p.exp;
  emissiveMats.forEach(m => { m.emissiveIntensity = p.emis * (m.userData.emisMax ?? 1); m.needsUpdate = false; });
  dirtyShadow();
}

// ================= ユーティリティ =================
function sRand(seed){ let h = 1779033703 ^ seed.length; for (let i=0;i<seed.length;i++){ h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); }
  return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); h ^= h>>>16; return (h>>>0)/4294967296; }; }
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const lerp = (a,b,t)=> a+(b-a)*t;
const pe = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---- 手続きテクスチャ ----
const texCache = {};
function canvasTex(key, size, draw, opts={}){
  if (texCache[key]) return texCache[key];
  const cvs = document.createElement("canvas"); cvs.width = size; cvs.height = opts.h || size;
  const c = cvs.getContext("2d"); draw(c, cvs.width, cvs.height, sRand(key));
  const t = new THREE.CanvasTexture(cvs); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace; if (opts.repeat) t.repeat.set(...opts.repeat);
  texCache[key] = t; return t;
}
function noiseFill(c, w, h, base, amp, n, rnd){
  c.fillStyle = base; c.fillRect(0,0,w,h);
  for (let i=0;i<n;i++){ const v = Math.floor(rnd()*amp); c.fillStyle = `rgba(${v},${v},${v},${(0.15+rnd()*0.35).toFixed(2)})`; c.fillRect(rnd()*w, rnd()*h, 1.5+rnd()*2, 1.5+rnd()*2); }
}
const TEX = {
  concrete(rep){ return canvasTex("concrete", 512, (c,w,h,rnd)=>{ noiseFill(c,w,h,"#b9bbb6",90,14000,rnd);
      for(let i=0;i<60;i++){ c.strokeStyle=`rgba(80,80,78,${(0.05+rnd()*0.12).toFixed(2)})`; c.lineWidth=0.6+rnd()*1.2; c.beginPath(); c.moveTo(rnd()*w,rnd()*h); c.lineTo(rnd()*w,rnd()*h); c.stroke(); } }, {repeat:rep}); },
  epoxy(rep){ return canvasTex("epoxy", 512, (c,w,h,rnd)=>{ noiseFill(c,w,h,"#c3c9ce",50,7000,rnd);
      c.fillStyle="rgba(255,255,255,0.08)"; for(let i=0;i<300;i++){ c.beginPath(); c.arc(rnd()*w,rnd()*h,3+rnd()*18,0,6.3); c.fill(); } }, {repeat:rep}); },
  asphalt(rep){ return canvasTex("asphalt", 512, (c,w,h,rnd)=>{ noiseFill(c,w,h,"#46494e",60,18000,rnd); }, {repeat:rep}); },
  paving(rep){ return canvasTex("paving", 512, (c,w,h,rnd)=>{ noiseFill(c,w,h,"#c9c6bd",60,6000,rnd); c.strokeStyle="rgba(90,88,82,0.55)"; c.lineWidth=2;
      for(let i=0;i<=8;i++){ c.beginPath(); c.moveTo(0,i*64); c.lineTo(w,i*64); c.stroke(); c.beginPath(); c.moveTo(i*64,0); c.lineTo(i*64,h); c.stroke(); } }, {repeat:rep}); },
  grass(rep){ return canvasTex("grass", 512, (c,w,h,rnd)=>{ c.fillStyle="#5f8a3a"; c.fillRect(0,0,w,h);
      for(let i=0;i<20000;i++){ const g=70+rnd()*90; c.fillStyle=`rgba(${30+rnd()*40},${g},${20+rnd()*30},0.6)`; c.fillRect(rnd()*w,rnd()*h,1.5,3+rnd()*4);} }, {repeat:rep}); },
  metal(rep){ return canvasTex("metalpanel", 512, (c,w,h,rnd)=>{ c.fillStyle="#eef0f2"; c.fillRect(0,0,w,h);
      for(let x=0;x<w;x+=16){ c.fillStyle="rgba(0,0,0,0.10)"; c.fillRect(x,0,5,h); c.fillStyle="rgba(255,255,255,0.35)"; c.fillRect(x+6,0,3,h); } }, {repeat:rep}); },
  timber(rep){ return canvasTex("timber", 512, (c,w,h,rnd)=>{ c.fillStyle="#b7804a"; c.fillRect(0,0,w,h);
      for(let i=0;i<w;i+=10){ const v=rnd(); c.fillStyle=`rgba(${120+v*60},${75+v*40},${35+v*25},0.9)`; c.fillRect(i,0,7,h); c.fillStyle="rgba(40,25,10,0.55)"; c.fillRect(i+7,0,3,h); } }, {repeat:rep}); },
  carpet(rep){ return canvasTex("carpet", 256, (c,w,h,rnd)=>{ noiseFill(c,w,h,"#55606a",50,6000,rnd); c.strokeStyle="rgba(0,0,0,0.25)"; for(let i=0;i<=4;i++){ c.beginPath(); c.moveTo(0,i*64); c.lineTo(w,i*64); c.stroke(); c.beginPath(); c.moveTo(i*64,0); c.lineTo(i*64,h); c.stroke(); } }, {repeat:rep}); },
  woodFloor(rep){ return canvasTex("woodfloor", 512, (c,w,h,rnd)=>{ c.fillStyle="#c9a06a"; c.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=32){ for(let x=-64;x<w;x+=256){ const v=rnd(); c.fillStyle=`rgba(${170+v*50},${125+v*40},${75+v*30},1)`; c.fillRect(x+(y/32%2)*128,y,252,30); } } c.strokeStyle="rgba(60,40,20,0.35)"; for(let y=0;y<h;y+=32){ c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); } }, {repeat:rep}); },
  mesh(rep){ return canvasTex("mesh", 128, (c,w,h,rnd)=>{ c.clearRect(0,0,w,h); c.strokeStyle="#f2c744"; c.lineWidth=3; for(let i=0;i<=w;i+=16){ c.beginPath(); c.moveTo(i,0); c.lineTo(i,h); c.stroke(); c.beginPath(); c.moveTo(0,i); c.lineTo(w,i); c.stroke(); } }, {repeat:rep}); },
  solar(rep){ return canvasTex("solar", 256, (c,w,h,rnd)=>{ c.fillStyle="#17223a"; c.fillRect(0,0,w,h); c.strokeStyle="#6f86b3"; c.lineWidth=2; for(let i=0;i<=w;i+=32){ c.beginPath(); c.moveTo(i,0); c.lineTo(i,h); c.stroke(); c.beginPath(); c.moveTo(0,i); c.lineTo(w,i); c.stroke(); } }, {repeat:rep}); },
  glassFrit(rep){ return canvasTex("frit", 128, (c,w,h,rnd)=>{ c.clearRect(0,0,w,h); c.fillStyle="rgba(255,255,255,0.5)"; for(let y=4;y<h;y+=12){ for(let x=4;x<w;x+=12){ c.beginPath(); c.arc(x,y,2.2,0,6.3); c.fill(); } } }, {repeat:rep}); },
};

// ---- 材質ライブラリ ----
function std(color, o={}){ return new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.75, metalness:0.0 }, o)); }
const M = {
  white:    std(0xf4f5f6, { roughness:0.55, metalness:0.15 }),
  roofMetal:std(0xffffff, { map:TEX.metal([24,1]), roughness:0.45, metalness:0.35 }),
  wallMetal:std(0xe9ebee, { map:TEX.metal([12,1]), roughness:0.5, metalness:0.3 }),
  timber:   std(0xc8955a, { map:TEX.timber([8,1]), roughness:0.7 }),
  steel:    std(0xb9bec4, { roughness:0.45, metalness:0.75 }),
  darkSteel:std(0x3a3f46, { roughness:0.5, metalness:0.7 }),
  mullion:  std(0x22262b, { roughness:0.45, metalness:0.6 }),
  yellow:   std(0xf2c230, { roughness:0.5, metalness:0.25 }),
  safetyYellow: std(0xf6cb2f, { roughness:0.6 }),
  concrete: std(0xb8b9b4, { map:TEX.concrete([30,30]), roughness:0.92 }),
  epoxy:    std(0xd4d9dd, { map:TEX.epoxy([40,16]), roughness:0.3, metalness:0.05 }),
  asphalt:  std(0x4a4d52, { map:TEX.asphalt([40,30]), roughness:0.95 }),
  paving:   std(0xc8c5bc, { map:TEX.paving([20,20]), roughness:0.85 }),
  grass:    std(0x6a9a43, { map:TEX.grass([30,20]), roughness:1 }),
  carpet:   std(0x5a6570, { map:TEX.carpet([40,16]), roughness:1 }),
  woodFloor:std(0xcaa272, { map:TEX.woodFloor([20,8]), roughness:0.6 }),
  glass:    new THREE.MeshPhysicalMaterial({ color:0xd8ecf7, roughness:0.08, metalness:0.0, transparent:true, opacity:0.28, side:THREE.DoubleSide, depthWrite:false, envMapIntensity:1.2 }),
  glassTint:new THREE.MeshPhysicalMaterial({ color:0x9fc6dd, roughness:0.1, metalness:0.1, transparent:true, opacity:0.45, side:THREE.DoubleSide, depthWrite:false, envMapIntensity:1.5 }),
  glassIn:  new THREE.MeshPhysicalMaterial({ color:0xe8f4fa, roughness:0.05, transparent:true, opacity:0.18, side:THREE.DoubleSide, depthWrite:false }),
  machineWhite: std(0xe8e9ea, { roughness:0.35, metalness:0.2 }),
  machineDark:  std(0x2f3338, { roughness:0.4, metalness:0.4 }),
  machineBlue:  std(0x2a5ea8, { roughness:0.45, metalness:0.2 }),
  machineWin:   new THREE.MeshPhysicalMaterial({ color:0x6f8ca0, roughness:0.1, transparent:true, opacity:0.5, metalness:0.2 }),
  robotYellow:  std(0xf3b11b, { roughness:0.35, metalness:0.2 }),
  robotWhite:   std(0xf0f0ee, { roughness:0.35, metalness:0.1 }),
  mesh:     new THREE.MeshStandardMaterial({ map:TEX.mesh([3,1]), transparent:true, alphaTest:0.4, side:THREE.DoubleSide, roughness:0.6, metalness:0.3 }),
  solar:    std(0x1b2740, { map:TEX.solar([8,3]), roughness:0.25, metalness:0.6 }),
  leaf:     std(0x4f8a3c, { roughness:0.9 }),
  leaf2:    std(0x6aa24a, { roughness:0.9 }),
  trunk:    std(0x6b4f35, { roughness:0.95 }),
  blackMatte: std(0x1d1f22, { roughness:0.9 }),
  desk:     std(0xd9c3a0, { roughness:0.6 }),
  deskWhite:std(0xf0f0ee, { roughness:0.5 }),
  chair:    std(0x30343a, { roughness:0.7 }),
  monitor:  std(0x14161a, { roughness:0.3, metalness:0.3 }),
  screen:   new THREE.MeshStandardMaterial({ color:0x1d3550, emissive:0x3b7fd8, emissiveIntensity:0.0, roughness:0.4 }),
  gypsum:   std(0xf1f0ec, { roughness:0.9 }),
  ceiling:  std(0xe6e6e2, { roughness:0.95 }),
  duct:     std(0xc7ccd2, { roughness:0.35, metalness:0.7 }),
  pipeBlue: std(0x2f6fd0, { roughness:0.4, metalness:0.3 }),
  pipeRed:  std(0xd13b3b, { roughness:0.4, metalness:0.3 }),
  tray:     std(0x8a9199, { roughness:0.5, metalness:0.6 }),
  lamp:     new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xfff3d6, emissiveIntensity:0.9, roughness:0.6 }),
  lampWarm: new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffd9a0, emissiveIntensity:0.9, roughness:0.6 }),
  line:     std(0xf5d14a, { roughness:0.6 }),
  lineWhite:std(0xf3f3f0, { roughness:0.6 }),
  rack:     std(0x2d66c4, { roughness:0.55, metalness:0.3 }),
  rackOrange: std(0xe8731a, { roughness:0.55, metalness:0.3 }),
  pallet:   std(0xc49a62, { roughness:0.9 }),
  box:      std(0xb79b74, { roughness:0.9 }),
  crate:    std(0x7a8a99, { roughness:0.6, metalness:0.3 }),
  car:      std(0xd8dde2, { roughness:0.3, metalness:0.5 }),
  truckWhite: std(0xf2f2f2, { roughness:0.4, metalness:0.2 }),
  skin:     std(0xe8c4a2, { roughness:0.8 }),
  uniform:  std(0x25355a, { roughness:0.9 }),
  uniform2: std(0x5b6670, { roughness:0.9 }),
  shirt:    std(0xe9ecef, { roughness:0.9 }),
  helmet:   std(0xf6d33b, { roughness:0.4 }),
  plant:    std(0x3f8a44, { roughness:0.9 }),
  pot:      std(0xd9d6cf, { roughness:0.8 }),
  neighbor: std(0xd6d4cf, { roughness:0.8 }),
  neighbor2:std(0xc4c8cc, { roughness:0.8 }),
  neighborRoof: std(0x8e9397, { roughness:0.8 }),
  pole:     std(0x9a9a94, { roughness:0.9 }),
  fence:    std(0x7d8891, { roughness:0.5, metalness:0.6 }),
  curb:     std(0xd3d3cf, { roughness:0.9 }),
  water:    new THREE.MeshPhysicalMaterial({ color:0x3b6e8c, roughness:0.15, metalness:0.1, transparent:true, opacity:0.85 }),
};
M.screen.userData.emisMax = 1.2; emissiveMats.push(M.screen);
M.lamp.userData.emisMax = 1.3; M.lampWarm.userData.emisMax = 1.3;
M.lamp.emissiveIntensity = 0.9; M.lampWarm.emissiveIntensity = 0.9;

// ---- ジオメトリ短縮 ----
const G = {
  box: (w,h,d)=> new THREE.BoxGeometry(w,h,d),
  cyl: (r,h,seg=24,rt)=> new THREE.CylinderGeometry(rt??r, r, h, seg),
  sph: (r,seg=16)=> new THREE.SphereGeometry(r, seg, Math.max(8, seg/2|0)),
  plane: (w,h)=> new THREE.PlaneGeometry(w,h),
};
function mesh(geo, mat, x=0, y=0, z=0, opts={}){
  const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.ry !== undefined) m.rotation.y = opts.ry;
  m.castShadow = opts.cast ?? true; m.receiveShadow = opts.recv ?? true;
  if (opts.name) m.name = opts.name;
  return m;
}
// box 配置ヘルパ: 底面中心基準 (x, yBottom, z)
function boxAt(parent, w,h,d, mat, x, yb, z, opts={}){ const m = mesh(G.box(w,h,d), mat, x, yb+h/2, z, opts); parent.add(m); return m; }
function cylAt(parent, r,h, mat, x, yb, z, opts={}){ const m = mesh(G.cyl(r,h,opts.seg||24,opts.rt), mat, x, yb+h/2, z, opts); parent.add(m); return m; }

// ---- 静的ジオメトリの材質別マージ（描画コール削減） ----
class Merger {
  constructor(){ this.buckets = new Map(); }
  add(geo, mat, matrix){ const g = geo.clone(); if (matrix) g.applyMatrix4(matrix); if(!this.buckets.has(mat)) this.buckets.set(mat, []); this.buckets.get(mat).push(g); geo.dispose?.(); }
  box(w,h,d, mat, x, yb, z, ry=0){ const mtx = new THREE.Matrix4().makeRotationY(ry).setPosition(x, yb+h/2, z); this.add(G.box(w,h,d), mat, mtx); }
  boxC(w,h,d, mat, x, y, z, rot){ const mtx = new THREE.Matrix4(); if(rot) mtx.makeRotationFromEuler(new THREE.Euler(...rot)); mtx.setPosition(x,y,z); this.add(G.box(w,h,d), mat, mtx); }
  cyl(r,h, mat, x, yb, z, seg=16, rot){ const mtx = new THREE.Matrix4(); if(rot) mtx.makeRotationFromEuler(new THREE.Euler(...rot)); mtx.setPosition(x, rot? yb : yb+h/2, z); this.add(G.cyl(r,h,seg), mat, mtx); }
  flush(parent, opts={}){
    for (const [mat, geos] of this.buckets){
      if (!geos.length) continue;
      const g = mergeGeometries(geos, false); geos.forEach(x=>x.dispose());
      const m = new THREE.Mesh(g, mat); m.castShadow = opts.cast ?? true; m.receiveShadow = opts.recv ?? true;
      if (opts.name) m.name = opts.name; if (opts.layer) m.userData.layer = opts.layer;
      parent.add(m);
    }
    this.buckets.clear();
  }
}

// ---- ラベル（スプライト：画面上で一定サイズ） ----
const LABELS = [];
function refitLabels(){ const a = innerWidth/innerHeight; for (const sp of LABELS) sp.scale.set(sp.userData.aspect * sp.userData.hN / a, sp.userData.hN, 1); }
function makeLabel(text, opts={}){
  const scale = opts.scale ?? 1, color = opts.color ?? "#ffffff", bg = opts.bg ?? "rgba(13,17,23,0.78)";
  const cvs = document.createElement("canvas"); const c = cvs.getContext("2d");
  const fs = 44; c.font = `700 ${fs}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`;
  const tw = c.measureText(text).width; cvs.width = Math.ceil(tw + 56); cvs.height = fs + 36;
  c.font = `700 ${fs}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`;
  c.fillStyle = bg; c.beginPath(); c.roundRect(0,0,cvs.width,cvs.height,16); c.fill();
  if (opts.accent){ c.fillStyle = opts.accent; c.fillRect(0, 0, 10, cvs.height); }
  c.fillStyle = color; c.textBaseline = "middle"; c.fillText(text, 28, cvs.height/2 + 2);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, transparent:true, depthTest:false, depthWrite:false, sizeAttenuation:false }));
  const hN = 0.032 * scale; sp.scale.set(cvs.width/cvs.height * hN / (innerWidth/innerHeight), hN, 1); sp.renderOrder = 50; sp.userData.isLabel = true; sp.userData.aspect = cvs.width/cvs.height; sp.userData.hN = hN;
  LABELS.push(sp); return sp;
}

// ================= カメラ制御（軌道 + 歩行） =================
const camState = { yaw:-0.75, pitch:0.55, dist:190, target:new THREE.Vector3(0,6,0) };
const camGoal  = { yaw:-0.75, pitch:0.55, dist:190, target:new THREE.Vector3(0,6,0) };
const walk = { on:false, pos:new THREE.Vector3(-30, 1.65, 26), yaw:Math.PI, pitch:0, keys:{} };
let camDirty = true;
function setCam(goal, instant=false){
  if (goal.yaw !== undefined) camGoal.yaw = goal.yaw; if (goal.pitch !== undefined) camGoal.pitch = goal.pitch;
  if (goal.dist !== undefined) camGoal.dist = goal.dist; if (goal.target) camGoal.target.set(...goal.target);
  if (instant){ camState.yaw=camGoal.yaw; camState.pitch=camGoal.pitch; camState.dist=camGoal.dist; camState.target.copy(camGoal.target); }
  camDirty = true;
}
function applyCam(){
  if (walk.on){
    const dir = new THREE.Vector3(Math.sin(walk.yaw)*Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw)*Math.cos(walk.pitch));
    camera.position.copy(walk.pos); camera.lookAt(walk.pos.clone().add(dir)); return;
  }
  const s = camState, g = camGoal, k = 0.12;
  s.yaw = lerp(s.yaw, g.yaw, k); s.pitch = lerp(s.pitch, g.pitch, k); s.dist = lerp(s.dist, g.dist, k); s.target.lerp(g.target, k);
  const p = clamp(s.pitch, 0.02, 1.55);
  camera.position.set(s.target.x + s.dist*Math.cos(p)*Math.sin(s.yaw), s.target.y + s.dist*Math.sin(p), s.target.z + s.dist*Math.cos(p)*Math.cos(s.yaw));
  camera.lookAt(s.target);
  if (Math.abs(s.yaw-g.yaw)+Math.abs(s.pitch-g.pitch)+Math.abs(s.dist-g.dist)+s.target.distanceTo(g.target) < 0.002) camDirty = false;
}
// マウス操作
const drag = { on:false, btn:0, x:0, y:0, moved:0 };
const cvsEl = renderer.domElement;
cvsEl.addEventListener("pointerdown", e => { drag.on = true; drag.btn = e.button; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; cvsEl.setPointerCapture(e.pointerId); });
cvsEl.addEventListener("pointermove", e => {
  if (walk.on && document.pointerLockElement === cvsEl){ walk.yaw -= e.movementX*0.0025; walk.pitch = clamp(walk.pitch - e.movementY*0.0025, -1.2, 1.2); return; }
  if (!drag.on) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx)+Math.abs(dy);
  if (drag.btn === 2 || e.shiftKey){
    const right = new THREE.Vector3(Math.cos(camGoal.yaw), 0, -Math.sin(camGoal.yaw));
    const fwd = new THREE.Vector3(-Math.sin(camGoal.yaw), 0, -Math.cos(camGoal.yaw));
    const k = camGoal.dist * 0.0012;
    camGoal.target.addScaledVector(right, -dx*k).addScaledVector(fwd, -dy*k);
  } else { camGoal.yaw -= dx*0.006; camGoal.pitch = clamp(camGoal.pitch + dy*0.005, 0.02, 1.55); }
  camDirty = true;
});
cvsEl.addEventListener("pointerup", e => { drag.on = false; });
cvsEl.addEventListener("contextmenu", e => e.preventDefault());
cvsEl.addEventListener("wheel", e => { e.preventDefault(); if (walk.on) return; camGoal.dist = clamp(camGoal.dist * (1 + Math.sign(e.deltaY)*0.12), 3, 600); camDirty = true; }, { passive:false });
addEventListener("keydown", e => { walk.keys[e.code] = true; });
addEventListener("keyup", e => { walk.keys[e.code] = false; });
addEventListener("resize", () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); refitLabels(); camDirty = true; });

function updateWalk(dt){
  if (!walk.on) return;
  const sp = (walk.keys.ShiftLeft ? 6 : 2.4) * dt;
  const f = new THREE.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw)), r = new THREE.Vector3(f.z, 0, -f.x);
  if (walk.keys.KeyW || walk.keys.ArrowUp) walk.pos.addScaledVector(f, sp);
  if (walk.keys.KeyS || walk.keys.ArrowDown) walk.pos.addScaledVector(f, -sp);
  if (walk.keys.KeyA || walk.keys.ArrowLeft) walk.pos.addScaledVector(r, sp);
  if (walk.keys.KeyD || walk.keys.ArrowRight) walk.pos.addScaledVector(r, -sp);
  if (walk.keys.KeyQ) walk.pos.y = clamp(walk.pos.y - sp, 1.2, 16);
  if (walk.keys.KeyE) walk.pos.y = clamp(walk.pos.y + sp, 1.2, 16);
  walk.pos.x = clamp(walk.pos.x, -SITE.w/2-20, SITE.w/2+20); walk.pos.z = clamp(walk.pos.z, -SITE.d/2-20, SITE.d/2+30);
}
