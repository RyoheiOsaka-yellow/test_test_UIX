// みなとみらい 立体地図 3D
// PLATEAU (建物 LOD2/3・デッキ・道路面) + OSM (多層歩行者ネットワーク・鉄道・水面) + 地理院 DEM の統合ビュー。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const FLOORS = [
  { level: 2, label: '2F', color: '#ffe66e', desc: 'デッキ上層' },
  { level: 1, label: '1F', color: '#9dffb0', desc: 'デッキ・高架' },
  { level: 0, label: 'GL', color: '#7ef0ff', desc: '地上' },
  { level: -1, label: 'B1', color: '#7fb2ff' },
  { level: -2, label: 'B2', color: '#b48dff' },
  { level: -3, label: 'B3', color: '#ff8df0' },
  { level: -4, label: 'B4', color: '#ff9db1' },
  { level: -5, label: 'B5', color: '#ffc36e' },
];
const CAT_COLORS = {
  platform: '#ff7fb2', concourse: '#b8c7ff', gate: '#ff5c8a', esc: '#ffd94d', elev: '#7dffa8',
  stairs: '#ffb648', toilet: '#6db4ff', void: '#4fe3ff',
};
const CAT_LABEL = { platform: 'ホーム', concourse: 'コンコース', gate: '改札', esc: 'エスカレーター', elev: 'エレベーター', stairs: '階段', toilet: 'トイレ', void: '吹抜け' };
const VT_LABEL = { stairs: '階段', esc: 'エスカレーター', elev: 'EV', slope: 'スロープ' };
const BG = '#04050c';

// ---------------------------------------------------------------------------
// データパック読み込み
// ---------------------------------------------------------------------------
const progressEl = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');
const setProgress = (p, text) => { progressEl.style.width = `${Math.round(p * 100)}%`; if (text) loadingText.textContent = text; };
const nextFrame = () => new Promise(r => requestAnimationFrame(r));

async function loadPack() {
  const b64 = window.__PACK_B64;
  if (!b64) throw new Error('データが埋め込まれていません');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  const dv = new DataView(buf);
  const hlen = dv.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen)));
  const base = 4 + hlen;
  const blobs = {};
  for (const [name, b] of Object.entries(header.blobs)) {
    const size = b.fmt === 'h' ? 2 : 4;
    const slice = buf.slice(base + b.offset, base + b.offset + b.length * size);
    blobs[name] = b.fmt === 'h' ? new Int16Array(slice) : new Uint32Array(slice);
  }
  return { header, blobs };
}

// ---------------------------------------------------------------------------
// 表示スタイル (線画 / 白図面 / 夜景)
// ---------------------------------------------------------------------------
const THEMES = {
  line: {  // 細線の BIM 風線画 (暗背景)
    bg: '#05070f', fog: '#05070f', fogDensity: 0.00030, skyTop: '#05070f', skyHorizon: '#05070f', far: '#05070f', bloom: false, tone: false,
    face: '#090d1c', faceLine: '#9cc4ff', faceLineAlpha: 0.3, edge: '#b9d4ff', edgeAlpha: 0.78, edgeAdd: false, edgeWidth: 1.0, thinAlpha: 0.32, hatch: 0.07,
    brFace: '#0a1226', brEdge: '#a8dcff', brEdgeAlpha: 0.75,
    terrain: '#04060d', terrainAlpha: 0.9, wire: '#1c2c52', wireAlpha: 0.08,
    sea: '#061226', seaAlpha: 0.9, inland: '#081a33', water: '#3f7fd0', waterLineAlpha: 0.55,
    road: '#070b16', roadAlpha: 0.9, roadLine: '#6d87b8', roadLineAlpha: 0.5,
    green: '#07140f', greenLine: '#2f8f5a', greenLineAlpha: 0.5,
    net: '#39e1ff', netPts: '#9ff3ff', hover: [0.35, 0.85, 1.0], label: '#7ef0ff',
  },
  paper: { // 白図面
    bg: '#f4f6fa', fog: '#f4f6fa', fogDensity: 0.00026, skyTop: '#f4f6fa', skyHorizon: '#e3e9f3', far: '#f0f3f8', bloom: false, tone: false,
    face: '#ffffff', faceLine: '#35466b', faceLineAlpha: 0.3, edge: '#1a2340', edgeAlpha: 0.85, edgeAdd: false, edgeWidth: 1.0, thinAlpha: 0.3, hatch: 0.1,
    brFace: '#f7f9fc', brEdge: '#2a3a5c', brEdgeAlpha: 0.8,
    terrain: '#f0f3f8', terrainAlpha: 0.95, wire: '#c8d2e2', wireAlpha: 0.25,
    sea: '#dfe9f6', seaAlpha: 0.95, inland: '#d5e3f4', water: '#6f9bd3', waterLineAlpha: 0.7,
    road: '#eaeef4', roadAlpha: 0.95, roadLine: '#6d7fa3', roadLineAlpha: 0.6,
    green: '#e4efe7', greenLine: '#5e9b79', greenLineAlpha: 0.6,
    net: '#0a7fc4', netPts: '#0a5f9a', hover: [0.1, 0.55, 1.0], label: '#163f7a', labelGlow: false,
  },
  night: { // 夜景 (窓明かり)
    bg: '#04050c', fog: '#070a18', fogDensity: 0.0003, skyTop: '#02030a', skyHorizon: '#0d1a3a', far: '#060912', bloom: true, tone: true,
    face: '#2b3e6c', faceLine: '#9cc4ff', faceLineAlpha: 0.0, edge: '#6fa0ff', edgeAlpha: 0.25, edgeAdd: true, edgeWidth: 1.0, thinAlpha: 0.12, hatch: 0.0,
    brFace: '#2d5a8a', brEdge: '#8fd0ff', brEdgeAlpha: 0.25,
    terrain: '#0b1020', terrainAlpha: 0.62, wire: '#1a2b52', wireAlpha: 0.12,
    sea: '#0d3b6e', seaAlpha: 0.72, inland: '#124a86', water: '#3f7fd0', waterLineAlpha: 0.0,
    road: '#151c33', roadAlpha: 0.7, roadLine: '#c466ff', roadLineAlpha: 0.22,
    green: '#0f3a2a', greenLine: '#2f8f5a', greenLineAlpha: 0.0,
    net: '#00e5ff', netPts: '#9ff3ff', hover: [0.35, 0.85, 1.0], label: '#7ef0ff',
  },
};
let styleName = 'paper';
const T = () => THEMES[styleName];
const themed = [];   // { apply(theme) } を登録し、スタイル切替時に一括適用
const onTheme = fn => { themed.push(fn); fn(T()); };

// ---------------------------------------------------------------------------
// シーン基礎
// ---------------------------------------------------------------------------
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2('#070a18', 0.00030);
onTheme(t => { scene.background.set(t.bg); scene.fog.color.set(t.fog); scene.fog.density = t.fogDensity; });
// 夜空のグラデーション (地平線付近をわずかに明るく)
const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#02030a') }, horizon: { value: new THREE.Color('#0d1a3a') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top, horizon; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = pow(clamp(1.0 - h * 2.2, 0.0, 1.0), 2.2); gl_FragColor = vec4(mix(top, horizon, t), 1.0); }',
}));
sky.renderOrder = -10; scene.add(sky);
onTheme(t => { sky.material.uniforms.top.value.set(t.skyTop); sky.material.uniforms.horizon.value.set(t.skyHorizon); });
// 対象範囲の外側を覆う地面 (地形の切れ目を目立たせない)
const farGround = new THREE.Mesh(new THREE.CircleGeometry(9000, 64), new THREE.MeshBasicMaterial({ color: '#060912' }));
farGround.rotation.x = -Math.PI / 2; farGround.position.y = -1.2; farGround.renderOrder = -5; scene.add(farGround);
onTheme(t => farGround.material.color.set(t.far));

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 20000);
const CAM_HOME = new THREE.Vector3(1150, 720, -1250);
camera.position.copy(CAM_HOME).multiplyScalar(1.45);
scene.add(camera);

const ORTHO_HALF = 700;
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 6000);
const fitOrtho = () => { const a = innerWidth / innerHeight; ortho.left = -ORTHO_HALF * a; ortho.right = ORTHO_HALF * a; ortho.top = ORTHO_HALF; ortho.bottom = -ORTHO_HALF; ortho.updateProjectionMatrix(); };
fitOrtho(); ortho.up.set(0, 0, -1); ortho.position.set(0, 1500, 0); ortho.lookAt(0, 0, 0); scene.add(ortho);

const pixelRatio = () => { const cap = Math.min(devicePixelRatio * 1.25, 3); const budget = Math.sqrt(9.5e6 / (innerWidth * innerHeight)); return Math.max(1, Math.min(cap, budget)); };
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(pixelRatio());
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.05;
onTheme(t => { renderer.toneMapping = t.tone ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); });

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.zoomToCursor = true; controls.screenSpacePanning = false;
controls.minDistance = 15; controls.maxDistance = 5000; controls.maxPolarAngle = Math.PI * 0.52; controls.autoRotateSpeed = 0.5;
controls.target.set(0, 0, 60);
const orthoControls = new OrbitControls(ortho, canvas);
orthoControls.enableDamping = true; orthoControls.dampingFactor = 0.08; orthoControls.enableRotate = false; orthoControls.screenSpacePanning = true; orthoControls.zoomToCursor = true;
orthoControls.minZoom = 0.25; orthoControls.maxZoom = 30;
orthoControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
orthoControls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
orthoControls.enabled = false;
let activeCamera = camera, activeControls = controls;

// ライティング（建物の立体感用）
scene.add(new THREE.HemisphereLight('#9fb8ff', '#0a0c18', 0.9));
const sun = new THREE.DirectionalLight('#dfe8ff', 1.6); sun.position.set(-900, 1400, -600); scene.add(sun);
const fill = new THREE.DirectionalLight('#7fb2ff', 0.5); fill.position.set(900, 500, 900); scene.add(fill);

const renderTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 4 });
const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.28, 0.3, 0.5);
composer.addPass(bloom);
composer.addPass(new OutputPass());
onTheme(t => { bloom.enabled = t.bloom; });
composer.setSize(innerWidth, innerHeight);
const renderPass = composer.passes[0];

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fitOrtho();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(pixelRatio()); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  scene.traverse(o => { if (o.material && o.material.isLineMaterial) o.material.resolution.set(innerWidth, innerHeight); });
  for (const m of pointMaterials) { m.uniforms.uScale.value = innerHeight / 2; m.uniforms.uPR.value = renderer.getPixelRatio(); }
});

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
const hex = c => new THREE.Color(c);
const shapeFromRings = (rings, scale = 0.1) => {
  const toPath = (ring, P) => { const p = new P(); ring.forEach(([x, y], i) => i === 0 ? p.moveTo(x * scale, y * scale) : p.lineTo(x * scale, y * scale)); p.closePath(); return p; };
  if (!rings[0] || rings[0].length < 3) return null;
  const s = toPath(rings[0], THREE.Shape);
  for (let i = 1; i < rings.length; i++) if (rings[i].length >= 3) s.holes.push(toPath(rings[i], THREE.Path));
  return s;
};
// Shape は (東, 北) 平面で作り、X 軸まわりに -90° 回して XZ 平面へ倒す: (E, N, h) -> (E, h, -N)。ワールドでは北 = -z。
const ROT_XZ = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
const flatGeometry = (shape, depth) => {
  // depth>0: 押し出し(上方向), 0: 面
  const g = depth > 0 ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
  g.applyMatrix4(ROT_XZ);
  g.computeVertexNormals();
  return g;
};
const fixNorth = g => g;

const LABEL_FONT = 'bold 56px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
const textTexture = (text, color, { glow = true, pad = 24 } = {}) => {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = LABEL_FONT; const w = Math.ceil(ctx.measureText(text).width) + pad * 2; c.width = w; c.height = 96;
  ctx.font = LABEL_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.fillStyle = color; ctx.fillText(text, w / 2, 48); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.85)'; }
  else { ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(text, w / 2, 48); ctx.fillStyle = color; }
  ctx.fillText(text, w / 2, 48);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, w };
};
const makeTextSprite = (text, color, { scale = 0.28, themeColor = null } = {}) => {
  const { tex, w } = textTexture(text, color);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false, sizeAttenuation: false, depthTest: false }));
  sp.userData.aspect = w / 96; sp.userData.px = scale * 96; // scale = 画面上の高さ(px)相当
  sp.renderOrder = 12;
  // テーマ切替で文字色を差し替える (themeColor: テーマ -> 色 を返す関数)
  onTheme(t => { const col = themeColor ? themeColor(t) : color; const r = textTexture(text, col, { glow: t.labelGlow !== false }); sp.material.map.dispose(); sp.material.map = r.tex; sp.material.needsUpdate = true; });
  return sp;
};

// ---------------------------------------------------------------------------
// アプリ本体
// ---------------------------------------------------------------------------
const groups = {
  terrain: new THREE.Group(), water: new THREE.Group(), green: new THREE.Group(), roads: new THREE.Group(), buildings: new THREE.Group(), edges: new THREE.Group(),
  bridges: new THREE.Group(), rails: new THREE.Group(), network: new THREE.Group(), station: new THREE.Group(), labels: new THREE.Group(),
};
for (const [k, g] of Object.entries(groups)) { g.name = k; scene.add(g); }
const floorGroups = new Map();   // level -> Group (駅構内)
FLOORS.forEach(f => { const g = new THREE.Group(); g.name = `floor${f.level}`; groups.station.add(g); floorGroups.set(f.level, g); });

let LEVEL_H = {};
let expand = 1.0;            // フロア展開倍率
let terrainSampler = () => 0;
const levelY = (lv, k = expand) => (LEVEL_H[lv] ?? lv * 6) * k;

let buildingMesh = null, buildingMeta = null, buildingStarts = null;
let bridgeMesh = null, bridgeMeta = null, bridgeStarts = null;
const fillMeshes = [];         // 駅構内のホバー対象
const fillRanges = new Map();  // mesh -> [{start,end,name,floorLabel}]
const floorLabelSprites = [];
const layoutSprite = sp => {
  const d = sp.position.distanceTo(activeCamera.position);
  const fade = sp.userData.fadeFrom ?? 1500;
  const op = activeCamera === ortho ? 0.9 : Math.max(0, Math.min(1, 1 - (d - fade) / (fade * 0.8)));
  sp.material.opacity = op * 0.92; sp.visible = op > 0.02;
  const h = sp.userData.px * 2 / innerHeight; // sizeAttenuation:false のとき scale は NDC 単位
  sp.scale.set(h * sp.userData.aspect * innerHeight / innerWidth, h, 1);
};
const floorVisible = new Map(FLOORS.map(f => [f.level, true]));

// ---- 地形 -----------------------------------------------------------------
function buildTerrain(meta, grid) {
  const { nx, ny, step, x0, y0 } = meta;
  const h = new Float32Array(grid.length);
  for (let i = 0; i < grid.length; i++) { const v = grid[i] / 10; h[i] = v === 0 ? -2.5 : v; }
  terrainSampler = (x, y) => {
    const fx = (x - x0) / step, fy = (y - y0) / step;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j));
    const a = h[j * nx + i], b = h[j * nx + i + 1], c = h[(j + 1) * nx + i], d = h[(j + 1) * nx + i + 1];
    const t = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    return t < 0 ? 0 : t;   // 海域(無効値)は 0 扱い
  };
  const geo = new THREE.PlaneGeometry((nx - 1) * step, (ny - 1) * step, nx - 1, ny - 1);
  const pos = geo.attributes.position;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = j * nx + i; const gx = x0 + i * step, gy = y0 + (ny - 1 - j) * step;
    pos.setXYZ(idx, gx, gy, h[(ny - 1 - j) * nx + i]);
  }
  geo.applyMatrix4(ROT_XZ); // (x, y, z) -> (x, z, -y): 北が -z, 標高が y
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: '#0b1020', transparent: true, opacity: 0.62, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.position.y = -0.4; mesh.renderOrder = -2;
  groups.terrain.add(mesh);
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#1a2b52', wireframe: true, transparent: true, opacity: 0.12 }));
  wire.position.y = -0.3; groups.terrain.add(wire);
  onTheme(t => { mat.color.set(t.terrain); mat.opacity = t.terrainAlpha; wire.material.color.set(t.wire); wire.material.opacity = t.wireAlpha; });
}

// 面ポリゴン群 → 塗り + 外周線 (線画用)
function outlineLines(polys, lift) {
  const lines = [];
  for (const rings of polys) for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const ax = a[0] / 10, ay = a[1] / 10, bx = b[0] / 10, by = b[1] / 10;
      lines.push(ax, terrainSampler(ax, ay) + lift, -ay, bx, terrainSampler(bx, by) + lift, -by);
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 }));
}
function fillMesh(polys, lift, color) {
  const geos = [];
  for (const rings of polys) {
    const sh = shapeFromRings(rings); if (!sh) continue;
    const g = flatGeometry(sh, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, terrainSampler(p.getX(i), -p.getZ(i)) + lift);
    geos.push(g);
  }
  if (!geos.length) return null;
  return new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
}

// ---- 水面 -----------------------------------------------------------------
function buildWater(water) {
  const sea = fillMesh(water.sea, 0.05, '#0d3b6e'); const inland = fillMesh(water.inland, 0.6, '#124a86');
  const ln = outlineLines([...water.sea, ...water.inland], 0.7);
  if (sea) { sea.renderOrder = -1; groups.water.add(sea); }
  if (inland) groups.water.add(inland);
  groups.water.add(ln);
  onTheme(t => { if (sea) { sea.material.color.set(t.sea); sea.material.opacity = t.seaAlpha; } if (inland) { inland.material.color.set(t.inland); inland.material.opacity = t.seaAlpha; } ln.material.color.set(t.water); ln.material.opacity = t.waterLineAlpha; ln.visible = t.waterLineAlpha > 0; });
}

// ---- 公園・緑地 (OSM) ---------------------------------------------------------
function buildGreen(polys) {
  const m = fillMesh(polys || [], 0.18, '#0f3a2a'); if (!m) return;
  const ln = outlineLines(polys, 0.3);
  groups.green.add(m, ln);
  onTheme(t => { m.material.color.set(t.green); ln.material.color.set(t.greenLine); ln.material.opacity = t.greenLineAlpha; ln.visible = t.greenLineAlpha > 0; });
}

// ---- 道路面 (PLATEAU tran) ---------------------------------------------------
function buildRoads(polys) {
  const m = fillMesh(polys, 0.25, '#151c33'); const ln = outlineLines(polys, 0.45);
  if (m) groups.roads.add(m);
  groups.roads.add(ln);
  onTheme(t => { if (m) { m.material.color.set(t.road); m.material.opacity = t.roadAlpha; } ln.material.color.set(t.roadLine); ln.material.opacity = t.roadLineAlpha; });
}

// ---- PLATEAU メッシュ (建物・橋梁) -----------------------------------------------
function meshFromPack(pos16, idx32) {
  const n = pos16.length / 3;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = pos16[i * 3] / 10; pos[i * 3 + 1] = pos16[i * 3 + 2] / 10; pos[i * 3 + 2] = -pos16[i * 3 + 1] / 10; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx32, 1));
  g.computeBoundingSphere();
  return g;
}
const findRange = (starts, faceIndex) => { // starts: 三角形開始インデックス(昇順)
  let lo = 0, hi = starts.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= faceIndex) lo = mid; else hi = mid - 1; }
  return lo;
};

const bldUniforms = { uHover: { value: -1 }, uWindows: { value: 1 }, uTime: { value: 0 } };
// 夜景用: 窓明かりつき標準マテリアル
function cityMaterial({ windows, color = '#2b3e6c', emissive = '#0c142c' }) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.3, flatShading: true, transparent: true, opacity: 0.86 });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uHover = bldUniforms.uHover; shader.uniforms.uWindows = bldUniforms.uWindows; shader.uniforms.uTime = bldUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bid; varying float vBid; varying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBid = bid; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uHover, uWindows, uTime; varying float vBid; varying vec3 vWPos;
        float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 fn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
          float vert = 1.0 - abs(fn.y);
          float h = max(vWPos.y, 0.0);
          diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 28.0, h));
          if (uWindows > 0.5 && vert > 0.6 && h > 2.0) {
            float u = abs(fn.x) > abs(fn.z) ? vWPos.z : vWPos.x;
            vec2 cell = floor(vec2(u / 3.2, vWPos.y / 3.6));
            vec2 f = fract(vec2(u / 3.2, vWPos.y / 3.6));
            float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.78);
            float r = hash21(cell + vec2(vBid * 0.37, vBid * 1.13));
            float lit = step(0.62, r) * win;
            float flick = 0.85 + 0.15 * sin(uTime * 0.6 + r * 60.0);
            vec3 warm = mix(vec3(1.0, 0.82, 0.55), vec3(0.75, 0.9, 1.0), step(0.85, r));
            totalEmissiveRadiance += warm * lit * 0.55 * flick * vert;
            diffuseColor.rgb += vec3(0.04) * win * vert;
          }
          if (abs(vBid - uHover) < 0.5) { totalEmissiveRadiance += vec3(0.35, 0.85, 1.0) * 0.55; diffuseColor.rgb += vec3(0.1, 0.2, 0.3); }
        }`);
  };
  mat.customProgramCacheKey = () => 'city' + (windows ? 'w' : '');
  return mat;
}
// 線画用: 隠線処理のための面 (背景色に近い塗り) + 階ライン・方立ラインを細線で描く
function drawingMaterial({ floors = true } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFace: { value: hex('#090d1c') }, uLine: { value: hex('#9cc4ff') }, uLineAlpha: { value: 0.42 }, uHover: bldUniforms.uHover, uHoverCol: { value: new THREE.Vector3(0.35, 0.85, 1.0) }, uFloors: { value: floors ? 1 : 0 }, uHatch: { value: 0.1 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
    vertexShader: `attribute float bid; varying float vBid; varying vec3 vWPos; varying float vFogDepth;
      void main(){ vBid = bid; vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; vec4 mv = viewMatrix * wp; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uFace, uLine, uHoverCol, fogColor; uniform float uLineAlpha, uHover, uFloors, uHatch, fogDensity;
      varying float vBid; varying vec3 vWPos; varying float vFogDepth;
      void main(){
        vec3 fn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
        float vert = 1.0 - abs(fn.y);
        // 面ごとのごく薄い陰影 (向きで僅かに変える)
        vec3 col = uFace * (0.94 + 0.06 * abs(fn.x) + 0.03 * abs(fn.z));
        if (uFloors > 0.5 && vert > 0.6 && vWPos.y > 1.0) {
          float yf = vWPos.y / 3.6; float fy = min(fract(yf), 1.0 - fract(yf)); float wy = fwidth(yf);
          float floorLine = 1.0 - smoothstep(wy * 0.6, wy * 1.6, fy);
          float u = abs(fn.x) > abs(fn.z) ? vWPos.z : vWPos.x;
          float uf = u / 3.2; float fu = min(fract(uf), 1.0 - fract(uf)); float wu = fwidth(uf);
          float mullion = 1.0 - smoothstep(wu * 0.6, wu * 1.6, fu);
          // 遠景では細線が潰れるので距離で減衰
          float fade = clamp(1.0 - (vFogDepth - 500.0) / 1400.0, 0.0, 1.0);
          float l = max(floorLine, mullion * 0.45) * uLineAlpha * fade;
          col = mix(col, uLine, l);
        }
        // ハッチング: 面の向きに合わせた世界座標の 45° 斜線 (1.2m ピッチ)。屋根・床面は濃く、壁面は薄く
        if (uHatch > 0.001) {
          float hc = abs(fn.y) > 0.5 ? (vWPos.x + vWPos.z) : ((abs(fn.x) > abs(fn.z) ? vWPos.z : vWPos.x) + vWPos.y);
          float hf = hc / 1.6; float hd = min(fract(hf), 1.0 - fract(hf)); float hw = fwidth(hf);
          float hatch = (1.0 - smoothstep(hw * 0.5, hw * 1.4, hd)) * clamp(1.0 - (vFogDepth - 500.0) / 1200.0, 0.0, 1.0);
          float hs = abs(fn.y) > 0.5 ? 1.0 : 0.45;
          col = mix(col, uLine, hatch * uHatch * hs);
        }
        if (abs(vBid - uHover) < 0.5) col = mix(col, uHoverCol, 0.45);
        float f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        col = mix(col, fogColor, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
    polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 1.5,
  });
  return mat;
}
function addBidAttribute(g, starts) {
  const n = g.attributes.position.count; const bid = new Float32Array(n); const idx = g.index.array;
  for (let b = 0; b < starts.length - 1; b++) for (let t = starts[b]; t < starts[b + 1]; t++) { bid[idx[t * 3]] = b; bid[idx[t * 3 + 1]] = b; bid[idx[t * 3 + 2]] = b; }
  g.setAttribute('bid', new THREE.BufferAttribute(bid, 1));
}
let bldFaces = true;   // 面を描く (隠線処理) か、線のみか
let lineScale = 1.0;   // 線の太さ倍率 (UI スライダー)
const styledMeshes = []; // { mesh, drawing, night, thick, thin, kind }
// 外形線 (折れ角 thickDeg 以上) は太線、補助線 (thinDeg 以上) は 1px の細線で描く
function makeEdgeLines(g, thinDeg, thickDeg, group) {
  const thinGeo = new THREE.EdgesGeometry(g, thinDeg);
  const thin = new THREE.LineSegments(thinGeo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }));
  const thickGeo = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g, thickDeg));
  const thickMat = new LineMaterial({ color: 0xffffff, linewidth: 1.8, worldUnits: false, transparent: true, opacity: 0.9, depthWrite: true }); thickMat.fog = true;
  thickMat.resolution.set(innerWidth, innerHeight);
  const thick = new LineSegments2(thickGeo, thickMat); thick.computeLineDistances();
  group.add(thin, thick);
  return { thin, thick, thinCount: thinGeo.attributes.position.count / 2, thickCount: thickGeo.attributes.instanceStart.count };
}
function setupStyledMesh(mesh, drawing, night, lines, kind) {
  styledMeshes.push({ mesh, drawing, night, lines, kind });
  onTheme(t => {
    const isNight = t.bloom;
    mesh.material = isNight ? night : drawing;
    mesh.visible = isNight || bldFaces;
    drawing.uniforms.uFace.value.set(kind === 'brid' ? t.brFace : t.face); drawing.uniforms.uLine.value.set(t.faceLine); drawing.uniforms.uLineAlpha.value = kind === 'brid' ? t.faceLineAlpha * 0.5 : t.faceLineAlpha;
    drawing.uniforms.uHatch.value = (kind === 'brid' ? t.hatch * 0.6 : t.hatch) * Math.min(1.5, lineScale);
    drawing.uniforms.uLineAlpha.value *= Math.min(1.5, lineScale);
    drawing.uniforms.uHoverCol.value.set(...t.hover); drawing.uniforms.fogColor.value.set(t.fog); drawing.uniforms.fogDensity.value = t.fogDensity;
    const col = kind === 'brid' ? t.brEdge : t.edge;
    lines.thin.material.color.set(col); lines.thin.material.opacity = Math.min(1, (kind === 'brid' ? t.brEdgeAlpha : t.edgeAlpha) * t.thinAlpha / 0.5 * Math.min(1, lineScale));
    lines.thin.material.blending = t.edgeAdd ? THREE.AdditiveBlending : THREE.NormalBlending; lines.thin.material.depthWrite = !t.edgeAdd; lines.thin.material.needsUpdate = true;
    lines.thick.material.color.set(col); lines.thick.material.opacity = (kind === 'brid' ? t.brEdgeAlpha : t.edgeAlpha) * Math.min(1, 0.6 + lineScale * 0.4); lines.thick.material.linewidth = t.edgeWidth * lineScale;
    lines.thick.material.blending = t.edgeAdd ? THREE.AdditiveBlending : THREE.NormalBlending; lines.thick.material.depthWrite = !t.edgeAdd; lines.thick.material.needsUpdate = true;
  });
}
function buildBuildings(blobs, header) {
  const g = meshFromPack(blobs.bldg_pos, blobs.bldg_idx);
  buildingMeta = header.buildings.meta; buildingStarts = header.buildings.starts;
  addBidAttribute(g, buildingStarts);
  buildingMesh = new THREE.Mesh(g, drawingMaterial()); buildingMesh.name = 'bldg';
  groups.buildings.add(buildingMesh);
  // 輪郭線: 折れ角 14° 以上を細線、60° 以上 (外形・コーナー) を太線で描く
  const lines = makeEdgeLines(g, 14, 60, groups.edges);
  console.log(`building edges: thin ${lines.thinCount}, thick ${lines.thickCount}`);
  setupStyledMesh(buildingMesh, buildingMesh.material, cityMaterial({ windows: true }), lines, 'bldg');
}
function buildBridges(blobs, header) {
  const g = meshFromPack(blobs.brid_pos, blobs.brid_idx);
  bridgeMesh = new THREE.Mesh(g, drawingMaterial({ floors: false })); bridgeMesh.name = 'brid';
  groups.bridges.add(bridgeMesh);
  bridgeMeta = header.bridges.meta; bridgeStarts = header.bridges.starts;
  const lines = makeEdgeLines(g, 20, 65, groups.bridges);
  setupStyledMesh(bridgeMesh, bridgeMesh.material, cityMaterial({ windows: false, color: '#2d5a8a', emissive: '#0f2a4a' }), lines, 'brid');
}

// ---- 鉄道 -----------------------------------------------------------------
const railLines = [];
function buildRails(rails) {
  const byColor = new Map();
  for (const r of rails) {
    const arr = byColor.get(r.c) || []; byColor.set(r.c, arr);
    const pts = r.p.map(([x, y]) => [x / 10, y / 10]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      arr.push({ a: [ax, ay], b: [bx, by], lv: r.lv });
    }
  }
  for (const [color, segs] of byColor) {
    const geo = new LineSegmentsGeometry();
    const mat = new LineMaterial({ color: hex(color), linewidth: 1.4, worldUnits: true, transparent: true, opacity: 0.8, depthWrite: false });
    mat.resolution.set(innerWidth, innerHeight);
    const line = new LineSegments2(geo, mat); line.userData.segs = segs; groups.rails.add(line); railLines.push(line);
    onTheme(t => { mat.linewidth = t.bloom ? 1.4 : 0.9; mat.opacity = t.bloom ? 0.8 : 0.9; });
  }
  updateRails();
}
const railY = (x, y, lv) => lv === 0 ? terrainSampler(x, y) + 0.6 : lv > 0 ? terrainSampler(x, y) + levelY(lv) + 0.6 : levelY(lv) + 0.6;
function updateRails() {
  for (const line of railLines) {
    const pos = [];
    for (const s of line.userData.segs) pos.push(s.a[0], railY(s.a[0], s.a[1], s.lv), -s.a[1], s.b[0], railY(s.b[0], s.b[1], s.lv), -s.b[1]);
    line.geometry.setPositions(pos); line.computeLineDistances();
  }
}

// ---- 歩行者ネットワーク --------------------------------------------------------
const graph = { nodes: [], links: [], adj: new Map() };
let netLines = null, netLines2 = null, netPoints = null;
const netMat = (color) => { const m = new LineMaterial({ color: hex(color), linewidth: 0.5, worldUnits: true, dashed: true, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.85, depthWrite: false }); m.resolution.set(innerWidth, innerHeight); return m; };
const netMats = { 0: netMat('#00e5ff'), 1: netMat('#ffb648'), 2: netMat('#ffd94d'), 3: netMat('#7dffa8'), 4: netMat('#9fffe0') };
onTheme(t => { netMats[0].color.set(t.net); for (const m of Object.values(netMats)) m.linewidth = t.bloom ? 0.5 : 0.35; });
const nodeY = (n, k = expand) => terrainSampler(n.x, n.y) + levelY(n.lv, k) + 1.2;

function buildNetwork(net) {
  const vt = net.vtypes;
  graph.nodes = net.nodes.map(([x, y, lv], i) => ({ id: i, x: x / 10, y: y / 10, lv }));
  net.links.forEach((l, li) => {
    const [a, b, vtc, ow, ax, ay, bx, by] = l;
    const na = graph.nodes[a], nb = graph.nodes[b];
    const length = Math.max(0.5, Math.hypot(bx - ax, by - ay) / 10 + Math.abs(levelY(nb.lv, 1) - levelY(na.lv, 1)) * (vtc ? 1 : 0.2));
    const link = { li, a, b, vt: vt[vtc] || null, vtc, oneWay: !!ow, ax: ax / 10, ay: ay / 10, bx: bx / 10, by: by / 10, length };
    graph.links.push(link);
    if (!graph.adj.has(a)) graph.adj.set(a, []); graph.adj.get(a).push({ li, forward: true });
    if (!ow) { if (!graph.adj.has(b)) graph.adj.set(b, []); graph.adj.get(b).push({ li, forward: false }); }
  });
  groups.network.clear();
  netLines = new LineSegments2(new LineSegmentsGeometry(), netMats[0]);
  netLines2 = {}; for (const k of [1, 2, 3, 4]) netLines2[k] = new LineSegments2(new LineSegmentsGeometry(), netMats[k]);
  netPoints = new THREE.Points(new THREE.BufferGeometry(), registerPoints(makePointsMaterial('#9ff3ff', { size: 0.9, maxPx: 4, opacity: 0.45, additive: false })));
  onTheme(t => netPoints.material.uniforms.uColor.value.set(t.netPts));
  groups.network.add(netLines, netPoints, ...Object.values(netLines2));
  updateNetwork();
}
const linkVisible = l => floorVisible.get(graph.nodes[l.a].lv) !== false && floorVisible.get(graph.nodes[l.b].lv) !== false;
function updateNetwork() {
  const buckets = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  for (const l of graph.links) {
    if (!linkVisible(l)) continue;
    const na = graph.nodes[l.a], nb = graph.nodes[l.b];
    const ya = terrainSampler(l.ax, l.ay) + levelY(na.lv) + 1.2, yb = terrainSampler(l.bx, l.by) + levelY(nb.lv) + 1.2;
    buckets[l.vtc in buckets ? l.vtc : 0].push(l.ax, ya, -l.ay, l.bx, yb, -l.by);
  }
  const setPos = (line, arr) => { line.visible = arr.length > 0; if (arr.length) { line.geometry.setPositions(arr); line.computeLineDistances(); } };
  setPos(netLines, buckets[0]); for (const k of [1, 2, 3, 4]) setPos(netLines2[k], buckets[k]);
  const pts = [];
  for (const n of graph.nodes) if (floorVisible.get(n.lv) !== false) pts.push(n.x, nodeY(n), -n.y);
  netPoints.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); netPoints.geometry.computeBoundingSphere();
}
const linkPoint = (l, s, out) => { // s: 0..length
  const t = Math.max(0, Math.min(1, s / l.length));
  const na = graph.nodes[l.a], nb = graph.nodes[l.b];
  const ya = terrainSampler(l.ax, l.ay) + levelY(na.lv) + 1.2, yb = terrainSampler(l.bx, l.by) + levelY(nb.lv) + 1.2;
  out.set(l.ax + (l.bx - l.ax) * t, ya + (yb - ya) * t, -(l.ay + (l.by - l.ay) * t));
  return out;
};

// 粒子マテリアル: 距離減衰しつつ画面上のサイズを [min,max] px にクランプ (カメラ至近で巨大化しない)
const makePointsMaterial = (color, { size = 1.6, minPx = 1.5, maxPx = 7, opacity = 0.85, additive = true, depthTest = true } = {}) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: hex(color) }, uSize: { value: size }, uMin: { value: minPx }, uMax: { value: maxPx }, uOpacity: { value: opacity }, uScale: { value: innerHeight / 2 }, uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `uniform float uSize, uMin, uMax, uScale, uPR; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float s = uSize * uScale / max(1.0, -mv.z); gl_PointSize = clamp(s, uMin, uMax) * uPR; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOpacity; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = smoothstep(1.0, 0.35, r); gl_FragColor = vec4(uColor, a * uOpacity); }`,
  transparent: true, depthWrite: false, depthTest, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const pointMaterials = [];
const registerPoints = m => { pointMaterials.push(m); return m; };

// ---- 人流シミュレーション -------------------------------------------------------
const MAX_AGENTS = 9000;
const FLOW_PRESETS = { off: { count: 0, speedMul: 1 }, morning: { count: 6500, speedMul: 1.5 }, day: { count: 3000, speedMul: 1 }, evening: { count: 5500, speedMul: 1.3 }, night: { count: 900, speedMul: 0.7 } };
let flowPreset = FLOW_PRESETS.morning;
const flow = { count: 0, speedMul: 1, li: new Int32Array(MAX_AGENTS), s: new Float32Array(MAX_AGENTS), dir: new Int8Array(MAX_AGENTS), speed: new Float32Array(MAX_AGENTS) };
const flowPos = new Float32Array(MAX_AGENTS * 3);
const flowGeo = new THREE.BufferGeometry(); flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3)); flowGeo.setDrawRange(0, 0);
const flowPoints = new THREE.Points(flowGeo, registerPoints(makePointsMaterial('#ffd9a0', { size: 1.6, maxPx: 6 })));
flowPoints.frustumCulled = false; scene.add(flowPoints);
const visibleLinkIdx = () => graph.links.filter(linkVisible).map(l => l.li);
let visLinks = [];
const spawnAgent = i => {
  if (!visLinks.length) return;
  const li = visLinks[(Math.random() * visLinks.length) | 0]; const l = graph.links[li];
  flow.li[i] = li; flow.s[i] = Math.random() * l.length; flow.dir[i] = l.oneWay || Math.random() < 0.5 ? 1 : -1; flow.speed[i] = 1 + Math.random() * 0.8;
};
const applyFlowPreset = () => {
  visLinks = visibleLinkIdx();
  if (!graph.links.length) return;
  for (let i = flow.count; i < flowPreset.count; i++) spawnAgent(i);
  flow.count = flowPreset.count; flow.speedMul = flowPreset.speedMul; flowGeo.setDrawRange(0, flow.count); flowPoints.visible = flow.count > 0;
};
const tmpV = new THREE.Vector3();
function stepFlow(dt) {
  if (!flow.count) return;
  for (let i = 0; i < flow.count; i++) {
    let li = flow.li[i], l = graph.links[li];
    let s = flow.s[i] + flow.dir[i] * flow.speed[i] * flow.speedMul * dt;
    if (s < 0 || s > l.length) {
      const nodeId = flow.dir[i] > 0 ? l.b : l.a;
      const opts = graph.adj.get(nodeId);
      if (!opts || !opts.length) { spawnAgent(i); li = flow.li[i]; l = graph.links[li]; s = flow.s[i]; }
      else {
        let pick = opts[(Math.random() * opts.length) | 0];
        for (let k = 0; k < 2 && pick.li === li && opts.length > 1; k++) pick = opts[(Math.random() * opts.length) | 0];
        li = pick.li; l = graph.links[li];
        if (!linkVisible(l)) { spawnAgent(i); li = flow.li[i]; l = graph.links[li]; s = flow.s[i]; }
        else { flow.li[i] = li; flow.dir[i] = pick.forward ? 1 : -1; s = pick.forward ? 0 : l.length; }
      }
    }
    flow.s[i] = s; linkPoint(l, s, tmpV);
    flowPos[i * 3] = tmpV.x; flowPos[i * 3 + 1] = tmpV.y; flowPos[i * 3 + 2] = tmpV.z;
  }
  flowGeo.attributes.position.needsUpdate = true;
}

// ---- 経路検索 -----------------------------------------------------------------
let routeMode = false, routeStart = null;
const routeObjects = [];
const routeResult = document.getElementById('route-result');
const routeMat = new LineMaterial({ color: hex('#8dffb0'), linewidth: 2.2, worldUnits: true, transparent: true, opacity: 0.95, depthTest: false }); routeMat.resolution.set(innerWidth, innerHeight);
const makeMarker = color => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30); g.addColorStop(0, color); g.addColorStop(0.5, color + 'aa'); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(14, 14, 1); sp.renderOrder = 11; return sp;
};
const RoutePath = { active: false, points: null, cum: null, length: 0, count: 0, s: new Float32Array(1500), speed: new Float32Array(1500) };
const routeFlowPos = new Float32Array(1500 * 3);
const routeFlowGeo = new THREE.BufferGeometry(); routeFlowGeo.setAttribute('position', new THREE.BufferAttribute(routeFlowPos, 3)); routeFlowGeo.setDrawRange(0, 0);
const routeFlow = new THREE.Points(routeFlowGeo, registerPoints(makePointsMaterial('#a8ffc8', { size: 2.2, maxPx: 8, opacity: 0.95, depthTest: false })));
routeFlow.renderOrder = 9; routeFlow.frustumCulled = false; scene.add(routeFlow);
let lastRoute = null;

const clearRoute = ({ keepText = false } = {}) => {
  routeObjects.forEach(o => { scene.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); }); routeObjects.length = 0;
  routeStart = null; lastRoute = null; RoutePath.active = false; routeFlowGeo.setDrawRange(0, 0);
  if (!keepText) routeResult.textContent = routeMode ? '始点をクリック' : '';
};
const pickNode = (sx, sy) => {
  let best = null, bd = 28;
  for (const n of graph.nodes) {
    if (floorVisible.get(n.lv) === false) continue;
    tmpV.set(n.x, nodeY(n), -n.y).project(activeCamera); if (tmpV.z > 1) continue;
    const px = (tmpV.x + 1) / 2 * innerWidth, py = (1 - tmpV.y) / 2 * innerHeight;
    const d = Math.hypot(px - sx, py - sy); if (d < bd) { bd = d; best = n.id; }
  }
  return best;
};
function dijkstra(from, to, barrierFree) {
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set(); const open = new Set([from]);
  while (open.size) {
    let cur = null, cd = Infinity;
    for (const n of open) { const d = dist.get(n) ?? Infinity; if (d < cd) { cd = d; cur = n; } }
    open.delete(cur); if (cur === to) break; done.add(cur);
    for (const { li, forward } of graph.adj.get(cur) ?? []) {
      const l = graph.links[li]; if (!linkVisible(l)) continue;
      const nxt = forward ? l.b : l.a; if (done.has(nxt)) continue;
      let w = l.length;
      if (barrierFree && (l.vt === 'stairs' || l.vt === 'esc')) w *= 1000;
      const nd = cd + w;
      if (nd < (dist.get(nxt) ?? Infinity)) { dist.set(nxt, nd); prev.set(nxt, { node: cur, li, forward }); open.add(nxt); }
    }
  }
  if (!prev.has(to)) return null;
  const steps = []; let c = to, length = 0, usedStairs = false; const moves = [];
  while (c !== from) {
    const p = prev.get(c); steps.unshift(p); const l = graph.links[p.li]; length += Math.hypot(l.bx - l.ax, l.by - l.ay);
    if (l.vt === 'stairs' || l.vt === 'esc') usedStairs = true;
    const la = graph.nodes[p.node].lv, lb = graph.nodes[c].lv;
    if (la !== lb) moves.unshift({ vt: l.vt || 'slope', from: la, to: lb });
    c = p.node;
  }
  const merged = []; moves.forEach(m => { const last = merged[merged.length - 1]; if (last && last.vt === m.vt && last.to === m.from) last.to = m.to; else merged.push({ ...m }); });
  const pts = [];
  steps.forEach(({ li, forward }) => { const l = graph.links[li]; const a = linkPoint(l, forward ? 0 : l.length, new THREE.Vector3()), b = linkPoint(l, forward ? l.length : 0, new THREE.Vector3()); if (!pts.length) pts.push(a.x, a.y + 0.8, a.z); pts.push(b.x, b.y + 0.8, b.z); });
  return { positions: pts, length, usedStairs, moves, steps };
}
const floorLabel = lv => FLOORS.find(f => f.level === lv)?.label ?? `${lv}F`;
function showRoute(endNode) {
  const barrier = document.getElementById('chk-barrier').checked;
  const r = dijkstra(routeStart, endNode, barrier);
  if (!r) { routeResult.textContent = '経路が見つかりません（同じ階層ネットワーク内か確認）'; return; }
  lastRoute = { from: routeStart, to: endNode, barrier };
  const lg = new LineGeometry(); lg.setPositions(r.positions);
  const line = new Line2(lg, routeMat); line.computeLineDistances(); line.renderOrder = 10; scene.add(line); routeObjects.push(line);
  const en = graph.nodes[endNode]; const mk = makeMarker('#ff7fb2'); mk.position.set(en.x, nodeY(en), -en.y); mk.userData.node = en; scene.add(mk); routeObjects.push(mk);
  // 経路上の人流
  const pts = []; for (let i = 0; i < r.positions.length; i += 3) pts.push(new THREE.Vector3(r.positions[i], r.positions[i + 1], r.positions[i + 2]));
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]));
  RoutePath.points = pts; RoutePath.cum = cum; RoutePath.length = cum[cum.length - 1]; RoutePath.count = Math.min(1500, Math.max(60, Math.round(r.length * 2)));
  for (let i = 0; i < RoutePath.count; i++) { RoutePath.s[i] = Math.random() * RoutePath.length; RoutePath.speed[i] = 1 + Math.random() * 0.8; }
  routeFlowGeo.setDrawRange(0, RoutePath.count); RoutePath.active = true;
  const mins = Math.max(1, Math.ceil(r.length / 80));
  const warn = barrier && r.usedStairs ? '（一部段差あり）' : '';
  const mv = r.moves.length ? '上下移動: ' + r.moves.map(m => `${VT_LABEL[m.vt] ?? m.vt}（${floorLabel(m.from)}→${floorLabel(m.to)}）`).join(' ▸ ') : '上下移動なし（同一階層）';
  routeResult.innerHTML = `距離 ${Math.round(r.length)}m ／ 徒歩約${mins}分 ${warn}<br><span class="route-moves">${mv}</span>`;
}
function stepRouteFlow(dt) {
  if (!RoutePath.active) return;
  const P = RoutePath;
  for (let i = 0; i < P.count; i++) {
    P.s[i] = (P.s[i] + P.speed[i] * flow.speedMul * dt) % P.length;
    let k = 1; while (k < P.cum.length - 1 && P.cum[k] < P.s[i]) k++;
    const seg = P.cum[k] - P.cum[k - 1] || 1; tmpV.lerpVectors(P.points[k - 1], P.points[k], (P.s[i] - P.cum[k - 1]) / seg);
    routeFlowPos[i * 3] = tmpV.x; routeFlowPos[i * 3 + 1] = tmpV.y; routeFlowPos[i * 3 + 2] = tmpV.z;
  }
  routeFlowGeo.attributes.position.needsUpdate = true;
}
const refreshRoute = () => { if (!lastRoute) return; const { from, to } = lastRoute; clearRoute({ keepText: true }); routeStart = from; const sn = graph.nodes[from]; const mk = makeMarker('#8dffb0'); mk.position.set(sn.x, nodeY(sn), -sn.y); mk.userData.node = sn; scene.add(mk); routeObjects.push(mk); showRoute(to); };

// ---- 駅構内 (近似モデル) ----------------------------------------------------------
const catMaterials = {};
for (const [k, c] of Object.entries(CAT_COLORS)) catMaterials[k] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: k === 'concourse' ? 0.35 : k === 'void' ? 0.12 : 0.75, depthWrite: k !== 'void', side: THREE.DoubleSide });
function buildStations(spaces) {
  const byLevel = new Map();
  for (const s of spaces) { if (!byLevel.has(s.lv)) byLevel.set(s.lv, []); byLevel.get(s.lv).push(s); }
  for (const [lv, list] of byLevel) {
    const g = floorGroups.get(lv); if (!g) continue;
    const f = FLOORS.find(x => x.level === lv);
    const fillGeos = []; const ranges = []; let tri = 0;
    for (const s of list) {
      const shape = shapeFromRings([s.r]); if (!shape) continue;
      const depth = s.cat === 'platform' ? 1.2 : s.cat === 'concourse' ? 0.5 : s.cat === 'void' ? 0.1 : 2.2;
      const geo = fixNorth(flatGeometry(shape, depth));
      const cx = s.r.reduce((a, p) => a + p[0], 0) / s.r.length / 10, cy = s.r.reduce((a, p) => a + p[1], 0) / s.r.length / 10;
      const groundY = terrainSampler(cx, cy);
      geo.translate(0, groundY, 0);
      const mesh = new THREE.Mesh(geo, catMaterials[s.cat] ?? catMaterials.concourse); mesh.userData.space = s; g.add(mesh);
      if (s.cat === 'void') {
        const eg = new THREE.EdgesGeometry(geo); g.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: '#4fe3ff', transparent: true, opacity: 0.6 })));
      } else {
        const eg = new THREE.EdgesGeometry(geo); g.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: f?.color ?? '#fff', transparent: true, opacity: 0.35 })));
      }
      // ホバー用: 面を複製してまとめる
      const fg = geo.clone(); const n = fg.index ? fg.index.count / 3 : fg.attributes.position.count / 3;
      ranges.push({ start: tri, end: tri + n, name: `${s.st}　${s.n}`, floorLabel: f?.label ?? '', cat: s.cat }); tri += n; fillGeos.push(fg);
    }
    if (fillGeos.length) {
      const merged = mergeGeometries(fillGeos.map(x => x.index ? x.toNonIndexed() : x));
      const fm = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })); fm.userData.isFill = true; g.add(fm); fillMeshes.push(fm); fillRanges.set(fm, ranges);
    }
    // 階層ラベル (みなとみらい駅の北西側)
    const sp = makeTextSprite(`${f?.label ?? lv}`, f?.color ?? '#fff', { scale: 0.16, themeColor: t => t.labelGlow === false ? '#1b2f55' : (f?.color ?? '#fff') });
    sp.position.set(-120, terrainSampler(-120, -40) + 4, 40); sp.userData.fadeFrom = 900; g.add(sp); floorLabelSprites.push(sp);
  }
  updateFloorPositions();
}
function updateFloorPositions() {
  for (const [lv, g] of floorGroups) g.position.y = levelY(lv);
}

// ---- ランドマークラベル -------------------------------------------------------------
function buildLabels(labels) {
  for (const l of labels) {
    if (l.kind !== 'station') continue;   // 建物名はホバー表示のみ
    const sp = makeTextSprite(l.n, '#7ef0ff', { scale: 0.2, themeColor: t => t.label });
    sp.position.set(l.p[0], terrainSampler(l.p[0], l.p[1]) + l.h, -l.p[1]);
    sp.userData.kind = l.kind; sp.userData.fadeFrom = l.kind === 'station' ? 2600 : 1500; groups.labels.add(sp);
  }
}

// ---- ホバー ------------------------------------------------------------------------
const tooltip = document.getElementById('tooltip');
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let pointerPx = { x: 0, y: 0 }, pointerMoved = false;
addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1; pointerPx = { x: e.clientX, y: e.clientY }; pointerMoved = true; });
let lastHover = 0;
function updateHover(now) {
  if (!pointerMoved || now - lastHover < 120) return; lastHover = now; pointerMoved = false;
  raycaster.setFromCamera(pointer, activeCamera);
  let html = null;
  // 駅構内
  const fills = fillMeshes.filter(m => m.parent.visible && groups.station.visible);
  for (const hit of raycaster.intersectObjects(fills, false)) {
    const rr = fillRanges.get(hit.object).find(r => hit.faceIndex >= r.start && hit.faceIndex < r.end);
    if (rr) { html = `<span class="tt-floor">${rr.floorLabel}</span>${rr.name}<span class="tt-sub">${CAT_LABEL[rr.cat] ?? ''}</span>`; break; }
  }
  if (!html) {
    const targets = []; if (buildingMesh && groups.buildings.visible) targets.push(buildingMesh); if (bridgeMesh && groups.bridges.visible) targets.push(bridgeMesh);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length) {
      const h = hits[0];
      if (h.object === buildingMesh) {
        const i = findRange(buildingStarts, h.faceIndex); const m = buildingMeta[i]; bldUniforms.uHover.value = i;
        const hgt = m.h != null ? `高さ ${m.h}m` : `高さ 約${Math.round(m.z[1] - m.z[0])}m`;
        html = `<span class="tt-floor">建物</span>${m.n ?? '（名称なし）'}<span class="tt-sub">${hgt}</span>`;
      } else {
        const i = findRange(bridgeStarts, h.faceIndex); const m = bridgeMeta[i];
        html = `<span class="tt-floor">橋梁</span>${m.fn && m.fn !== '不明' ? m.fn : '橋梁・デッキ'}`;
      }
    }
  }
  if (!html || !html.startsWith('<span class="tt-floor">建物')) bldUniforms.uHover.value = -1;
  if (html) { tooltip.innerHTML = html; tooltip.style.left = `${pointerPx.x}px`; tooltip.style.top = `${pointerPx.y}px`; tooltip.style.display = 'block'; }
  else tooltip.style.display = 'none';
}

// ---- UI -----------------------------------------------------------------------------
const floorList = document.getElementById('floor-list'); const floorChecks = new Map();
FLOORS.forEach(f => {
  const label = document.createElement('label'); label.className = 'row';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
  cb.addEventListener('change', () => { floorVisible.set(f.level, cb.checked); floorGroups.get(f.level).visible = cb.checked; updateNetwork(); applyFlowPreset(); });
  const chip = document.createElement('span'); chip.className = 'chip'; chip.style.background = f.color; chip.style.color = f.color;
  const cnt = document.createElement('span'); cnt.className = 'floor-count'; cnt.textContent = f.desc ?? '';
  label.append(cb, chip, document.createTextNode(f.label), cnt); floorList.appendChild(label); floorChecks.set(f.level, cb);
});
const setAllFloors = v => { FLOORS.forEach(f => { floorVisible.set(f.level, v); floorGroups.get(f.level).visible = v; floorChecks.get(f.level).checked = v; }); updateNetwork(); applyFlowPreset(); };
document.getElementById('btn-all').addEventListener('click', () => setAllFloors(true));
document.getElementById('btn-none').addEventListener('click', () => setAllFloors(false));
document.getElementById('chk-rotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; });
document.getElementById('btn-reset').addEventListener('click', () => flyTo(CAM_HOME, new THREE.Vector3(0, 0, 60)));
const VIEWS = {
  station: { pos: [380, 150, 300], target: [60, -10, 40] },
  landmark: { pos: [-560, 260, 120], target: [-40, 90, 320] },
  redbrick: { pos: [1450, 300, 1150], target: [1000, 0, 650] },
  pacifico: { pos: [900, 260, -500], target: [420, 20, -60] },
  yokohama: { pos: [-300, 420, -1500], target: [-850, 0, -880] },
};
document.querySelectorAll('#view-presets button').forEach(b => b.addEventListener('click', () => { const v = VIEWS[b.dataset.view]; if (blueprint) setBlueprint(false); flyTo(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target)); }));
let fly = null;
const flyTo = (pos, target) => { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), ms: 1400 }; };
const bindToggle = (id, group) => document.getElementById(id).addEventListener('change', e => { group.visible = e.target.checked; });
bindToggle('chk-network', groups.network); bindToggle('chk-station', groups.station); bindToggle('chk-bld', groups.buildings); bindToggle('chk-edges', groups.edges);
bindToggle('chk-bridge', groups.bridges); bindToggle('chk-road', groups.roads); bindToggle('chk-rail', groups.rails); bindToggle('chk-water', groups.water); bindToggle('chk-terrain', groups.terrain); bindToggle('chk-labels', groups.labels); bindToggle('chk-green', groups.green);
document.getElementById('chk-windows').addEventListener('change', e => { bldUniforms.uWindows.value = e.target.checked ? 1 : 0; });
const applyTheme = name => { styleName = name; const t = T(); for (const fn of themed) fn(t); document.querySelectorAll('#style-presets button').forEach(b => b.classList.toggle('active', b.dataset.style === name)); document.getElementById('row-windows').style.display = t.bloom ? '' : 'none'; };
document.querySelectorAll('#style-presets button').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.style)));
const lineInput = document.getElementById('line-scale'), lineValue = document.getElementById('line-scale-value');
lineInput.addEventListener('input', () => { lineScale = parseFloat(lineInput.value); lineValue.textContent = `×${lineScale.toFixed(2)}`; for (const fn of themed) fn(T()); });
document.getElementById('chk-faces').addEventListener('change', e => { bldFaces = e.target.checked; for (const m of styledMeshes) m.mesh.visible = T().bloom || bldFaces; });
document.getElementById('chk-network').addEventListener('change', e => { flowPoints.visible = e.target.checked && flow.count > 0; });

const expandInput = document.getElementById('floor-expand'), expandValue = document.getElementById('expand-value');
const setExpand = v => { expand = v; expandInput.value = v; expandValue.textContent = `×${Math.round(v * 100) / 100}`; updateFloorPositions(); updateNetwork(); updateRails(); routeObjects.forEach(o => { if (o.isSprite && o.userData.node) { const n = o.userData.node; o.position.y = nodeY(n); } }); refreshRoute(); };
expandInput.addEventListener('input', () => setExpand(parseFloat(expandInput.value)));

let blueprint = false, savedExpand = 1;
const bpBtn = document.getElementById('btn-blueprint');
const setBlueprint = on => {
  blueprint = on; bpBtn.classList.toggle('active', on);
  if (on) {
    savedExpand = expand; setExpand(0);
    ortho.position.set(controls.target.x, 1500, controls.target.z); ortho.lookAt(controls.target.x, 0, controls.target.z); ortho.zoom = 1; ortho.updateProjectionMatrix();
    orthoControls.target.set(controls.target.x, 0, controls.target.z); controls.enabled = false; orthoControls.enabled = true; activeCamera = ortho; activeControls = orthoControls;
    renderPass.camera = ortho; groups.labels.visible = false; groups.terrain.visible = false;
  } else {
    setExpand(savedExpand); controls.enabled = true; orthoControls.enabled = false; activeCamera = camera; activeControls = controls; renderPass.camera = camera;
    groups.labels.visible = document.getElementById('chk-labels').checked; groups.terrain.visible = document.getElementById('chk-terrain').checked;
  }
};
bpBtn.addEventListener('click', () => setBlueprint(!blueprint));

document.querySelectorAll('#flow-presets button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#flow-presets button').forEach(x => x.classList.remove('active')); b.classList.add('active');
  flowPreset = FLOW_PRESETS[b.dataset.preset]; flow.count = Math.min(flow.count, flowPreset.count); applyFlowPreset();
}));
const routeBtn = document.getElementById('btn-route');
routeBtn.addEventListener('click', () => { routeMode = !routeMode; routeBtn.classList.toggle('active', routeMode); clearRoute(); routeResult.textContent = routeMode ? '始点をクリック（歩行者ネットワーク上の点）' : ''; });
document.getElementById('btn-route-clear').addEventListener('click', () => clearRoute());
document.getElementById('chk-barrier').addEventListener('change', refreshRoute);
let downPos = null;
canvas.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!routeMode || !downPos || Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
  const n = pickNode(e.clientX, e.clientY); if (n == null) return;
  if (routeStart === null) {
    clearRoute({ keepText: true }); routeStart = n; const sn = graph.nodes[n]; const mk = makeMarker('#8dffb0'); mk.position.set(sn.x, nodeY(sn), -sn.y); mk.userData.node = sn; scene.add(mk); routeObjects.push(mk);
    routeResult.textContent = `始点: ${floorLabel(sn.lv)} ／ 終点をクリック`;
  } else { showRoute(n); routeStart = null; }
});

// ---- 起動 -----------------------------------------------------------------------------
async function init() {
  setProgress(0.05, 'データ展開中…');
  const { header, blobs } = await loadPack();
  LEVEL_H = Object.fromEntries(Object.entries(header.levelHeights).map(([k, v]) => [Number(k), v]));
  setProgress(0.15, '地形を生成中…'); await nextFrame(); buildTerrain(header.terrain, blobs.terrain);
  setProgress(0.25, '水面・道路面を生成中…'); await nextFrame(); buildWater(header.water); buildGreen(header.green); buildRoads(header.roads);
  setProgress(0.45, `建物 ${header.buildings.meta.length.toLocaleString()} 棟を生成中…`); await nextFrame(); buildBuildings(blobs, header);
  setProgress(0.65, 'デッキ・橋梁を生成中…'); await nextFrame(); buildBridges(blobs, header);
  setProgress(0.75, '鉄道・歩行者ネットワークを生成中…'); await nextFrame(); buildRails(header.rails); buildNetwork(header.network);
  setProgress(0.9, '駅構内モデルを生成中…'); await nextFrame(); buildStations(header.stations); buildLabels(header.labels);
  applyFlowPreset();
  applyTheme(styleName);
  setProgress(1, '完了');
  const loading = document.getElementById('loading');
  const anim = loading.animate({ opacity: [1, 0] }, { duration: 500, fill: 'forwards' });
  anim.onfinish = () => loading.remove();
  introStart = performance.now();
  window.__app = { applyTheme: n => applyTheme(n), scene, camera, controls, graph, header, buildingMesh, bridgeMesh, groups, render: () => composer.render(), setExpand, dijkstra, floorLabel, paused: false, benchmark: (n = 5) => { const gl = renderer.getContext(); const t = []; for (let i = 0; i < n; i++) { const s = performance.now(); composer.render(); gl.finish(); t.push(Math.round(performance.now() - s)); } return t; } };
}

let introStart = null; const INTRO_MS = 2600; const introFrom = camera.position.clone();
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clock = new THREE.Clock(); let elapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  if (window.__app?.paused) return;
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt;
  if (introStart !== null) { const t = Math.min((performance.now() - introStart) / INTRO_MS, 1); camera.position.lerpVectors(introFrom, CAM_HOME, easeOut(t)); if (t >= 1) introStart = null; }
  if (fly) { const t = easeOut(Math.min((performance.now() - fly.start) / fly.ms, 1)); camera.position.lerpVectors(fly.p0, fly.p1, t); controls.target.lerpVectors(fly.t0, fly.t1, t); if (t >= 1) fly = null; }
  activeControls.update();
  for (const m of Object.values(netMats)) m.dashOffset = -elapsed * 4;
  bldUniforms.uTime.value = elapsed;
  stepFlow(dt); stepRouteFlow(dt); updateHover(performance.now());
  if (groups.labels.visible) for (const sp of groups.labels.children) layoutSprite(sp);
  for (const sp of floorLabelSprites) layoutSprite(sp);
  composer.render();
}
init().catch(e => { loadingText.textContent = `読み込みエラー: ${e.message}`; console.error(e); });
animate();
