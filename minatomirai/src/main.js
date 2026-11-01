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
    net: '#39e1ff', netPts: '#9ff3ff', hover: [0.35, 0.85, 1.0], label: '#7ef0ff', pointColor: '#b9d4ff', pointColor2: '#ffb648', voxel: '#101a36', voxelEmissive: '#0a1024',
  },
  paper: { // 白図面
    bg: '#f4f6fa', fog: '#f4f6fa', fogDensity: 0.00026, skyTop: '#f4f6fa', skyHorizon: '#e3e9f3', far: '#f0f3f8', bloom: false, tone: false,
    face: '#ffffff', faceLine: '#35466b', faceLineAlpha: 0.3, edge: '#1a2340', edgeAlpha: 0.85, edgeAdd: false, edgeWidth: 1.0, thinAlpha: 0.3, hatch: 0.1,
    brFace: '#f7f9fc', brEdge: '#2a3a5c', brEdgeAlpha: 0.8,
    terrain: '#f0f3f8', terrainAlpha: 0.95, wire: '#c8d2e2', wireAlpha: 0.25,
    sea: '#dfe9f6', seaAlpha: 0.95, inland: '#d5e3f4', water: '#6f9bd3', waterLineAlpha: 0.7,
    road: '#eaeef4', roadAlpha: 0.95, roadLine: '#6d7fa3', roadLineAlpha: 0.6,
    green: '#e4efe7', greenLine: '#5e9b79', greenLineAlpha: 0.6,
    net: '#0a7fc4', netPts: '#0a5f9a', hover: [0.1, 0.55, 1.0], label: '#163f7a', labelGlow: false, pointColor: '#1f2a44', pointColor2: '#c8553d', voxel: '#eef1f6',
  },
  night: { // 夜景 (窓明かり)
    bg: '#04050c', fog: '#070a18', fogDensity: 0.0003, skyTop: '#02030a', skyHorizon: '#0d1a3a', far: '#060912', bloom: true, tone: true,
    face: '#2b3e6c', faceLine: '#9cc4ff', faceLineAlpha: 0.0, edge: '#6fa0ff', edgeAlpha: 0.25, edgeAdd: true, edgeWidth: 1.0, thinAlpha: 0.12, hatch: 0.0,
    brFace: '#2d5a8a', brEdge: '#8fd0ff', brEdgeAlpha: 0.25,
    terrain: '#0b1020', terrainAlpha: 0.62, wire: '#1a2b52', wireAlpha: 0.12,
    sea: '#0d3b6e', seaAlpha: 0.72, inland: '#124a86', water: '#3f7fd0', waterLineAlpha: 0.0,
    road: '#151c33', roadAlpha: 0.7, roadLine: '#c466ff', roadLineAlpha: 0.22,
    green: '#0f3a2a', greenLine: '#2f8f5a', greenLineAlpha: 0.0,
    net: '#00e5ff', netPts: '#9ff3ff', hover: [0.35, 0.85, 1.0], label: '#7ef0ff', pointColor: '#9fc8ff', pointColor2: '#ffd9a0', voxel: '#24365f', voxelEmissive: '#0c142c',
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: true });
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

const renderTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 4, stencilBuffer: true });
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
// 建物ごとの変位 (分解・組立・高さ順浮上)。建物情報 (高さ, 重心x, 重心y) は DataTexture で渡す
const dispUniforms = { uDMode: { value: 0 }, uDT: { value: 0 }, uDSeed: { value: 1.7 }, uBldTex: { value: null }, uBldW: { value: 1 }, uHide: { value: -1 } };
const DISP_PARS = `
  uniform float uDMode, uDT, uDSeed, uBldW; uniform sampler2D uBldTex;
  float dhash(float n) { return fract(sin(n * 12.9898 + uDSeed) * 43758.5453); }
  vec3 disp(float b) {
    if (uDMode < 0.5 || b < -0.5) return vec3(0.0);
    float i = floor(b + 0.5);
    vec4 info = texelFetch(uBldTex, ivec2(int(mod(i, uBldW)), int(i / uBldW)), 0);
    float r1 = dhash(i), r2 = dhash(i + 77.0), r3 = dhash(i + 191.0);
    if (uDMode < 1.5) {        // 放射分解: 外へ・上へ飛散
      vec3 dir = normalize(vec3(r1 - 0.5, 0.5 + r2 * 0.9, r3 - 0.5));
      return dir * uDT * (60.0 + 260.0 * r2 + info.x * 1.5);
    } else if (uDMode < 2.5) { // 組立: 中心から順に地中からせり上がる (uDT: 0=未完成 1=完成)
      float d = length(info.yz) / 1900.0; float delay = clamp(d * 0.7 + r1 * 0.12, 0.0, 0.85);
      float p = clamp((uDT - delay) / 0.15, 0.0, 1.0); p = 1.0 - pow(1.0 - p, 3.0);
      return vec3(0.0, -(info.x + 40.0) * (1.0 - p), 0.0);
    } else if (uDMode < 3.5) { // 高さ順浮上: 高い建物ほど上へ (階層分解図)
      return vec3(0.0, uDT * (info.x * 1.6 + 20.0), 0.0);
    } else {                   // 格子分解: 建物を碁盤目状に引き離す
      return vec3(info.y, 0.0, -info.z) * uDT * 0.6;
    }
  }`;
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 5000); // 断面カット (y <= constant を残す)
const sectionPlanes = [sectionPlane];
renderer.localClippingEnabled = true;
let bidLookup = null; // 量子化座標 -> 建物番号 (輪郭線へ bid を付与するため)
const posKey = (x, y, z) => `${Math.round(x * 10)},${Math.round(y * 10)},${Math.round(z * 10)}`;
function addDispUniforms(shader) { for (const [k, v] of Object.entries(dispUniforms)) shader.uniforms[k] = v; }
// 夜景用: 窓明かりつき標準マテリアル
function cityMaterial({ windows, color = '#2b3e6c', emissive = '#0c142c', displace = true }) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.3, flatShading: true, transparent: true, opacity: 0.86, clippingPlanes: sectionPlanes });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uHover = bldUniforms.uHover; shader.uniforms.uWindows = bldUniforms.uWindows; shader.uniforms.uTime = bldUniforms.uTime; addDispUniforms(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bid; varying float vBid; varying vec3 vWPos;\n' + (displace ? DISP_PARS : 'vec3 disp(float b) { return vec3(0.0); }'))
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + disp(bid);')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvBid = bid; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uHover, uWindows, uTime, uHide; varying float vBid; varying vec3 vWPos;
        float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBid - uHide) < 0.5) discard;')
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
  mat.customProgramCacheKey = () => 'city' + (windows ? 'w' : '') + (displace ? 'd' : '');
  return mat;
}
// 線画用: 隠線処理のための面 (背景色に近い塗り) + 階ライン・方立ラインを細線で描く
function drawingMaterial({ floors = true, displace = true } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFace: { value: hex('#090d1c') }, uLine: { value: hex('#9cc4ff') }, uLineAlpha: { value: 0.42 }, uHover: bldUniforms.uHover, uHoverCol: { value: new THREE.Vector3(0.35, 0.85, 1.0) }, uFloors: { value: floors ? 1 : 0 }, uHatch: { value: 0.1 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, ...(displace ? dispUniforms : {}) },
    clipping: true, clippingPlanes: sectionPlanes,
    vertexShader: `attribute float bid; varying float vBid; varying vec3 vWPos; varying float vFogDepth;
      #include <clipping_planes_pars_vertex>
      ${displace ? DISP_PARS : 'vec3 disp(float b) { return vec3(0.0); }'}
      void main(){ vBid = bid; vec4 wp = modelMatrix * vec4(position + disp(bid), 1.0); vWPos = wp.xyz; vec4 mvPosition = viewMatrix * wp; vFogDepth = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `uniform vec3 uFace, uLine, uHoverCol, fogColor; uniform float uLineAlpha, uHover, uFloors, uHatch, fogDensity, uHide;
      varying float vBid; varying vec3 vWPos; varying float vFogDepth;
      #include <clipping_planes_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        if (abs(vBid - uHide) < 0.5) discard;
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
function makeEdgeLines(g, thinDeg, thickDeg, group, displace = false) {
  const thinGeo = new THREE.EdgesGeometry(g, thinDeg);
  const thinMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, clippingPlanes: sectionPlanes });
  const thin = new THREE.LineSegments(thinGeo, thinMat);
  const thickGeo = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g, thickDeg));
  const thickMat = new LineMaterial({ color: 0xffffff, linewidth: 1.8, worldUnits: false, transparent: true, opacity: 0.9, depthWrite: true, clippingPlanes: sectionPlanes }); thickMat.fog = true;
  thickMat.resolution.set(innerWidth, innerHeight);
  if (displace && bidLookup) {
    // 線の各頂点に建物番号を付与 (量子化座標で逆引き)
    const tp = thinGeo.attributes.position; const tb = new Float32Array(tp.count);
    for (let i = 0; i < tp.count; i++) tb[i] = bidLookup.get(posKey(tp.getX(i), tp.getY(i), tp.getZ(i))) ?? -1;
    thinGeo.setAttribute('bid', new THREE.BufferAttribute(tb, 1));
    const st = thickGeo.attributes.instanceStart; const ib = new Float32Array(st.count);
    for (let i = 0; i < st.count; i++) ib[i] = bidLookup.get(posKey(st.getX(i), st.getY(i), st.getZ(i))) ?? -1;
    thickGeo.setAttribute('bidInst', new THREE.InstancedBufferAttribute(ib, 1));
    thinMat.onBeforeCompile = shader => {
      addDispUniforms(shader);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float bid; varying float vBidL;\n' + DISP_PARS).replace('#include <begin_vertex>', 'vBidL = bid; vec3 transformed = vec3(position) + disp(bid);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHide; varying float vBidL;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBidL - uHide) < 0.5) discard;');
    };
    thinMat.customProgramCacheKey = () => 'thinDisp';
    thickMat.onBeforeCompile = shader => {
      addDispUniforms(shader);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float bidInst; varying float vBidL;\n' + DISP_PARS)
        .replace('void main() {', 'void main() {\n\tvBidL = bidInst; vec3 dOff = disp(bidInst);')
        .replaceAll('vec4( instanceStart, 1.0 )', 'vec4( instanceStart + dOff, 1.0 )').replaceAll('vec4( instanceEnd, 1.0 )', 'vec4( instanceEnd + dOff, 1.0 )');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHide; varying float vBidL;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBidL - uHide) < 0.5) discard;');
    };
    thickMat.customProgramCacheKey = () => 'thickDisp';
  }
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
    if (kind === 'bldg') applyRepMode();
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
  // 建物情報テクスチャ (高さ, 重心x, 重心y[北])
  const nb = buildingMeta.length; const texW = 2048, texH = Math.ceil(nb / texW);
  const data = new Float32Array(texW * texH * 4);
  buildingMeta.forEach((m, i) => { data[i * 4] = m.h ?? Math.max(3, m.z[1] - m.z[0]); data[i * 4 + 1] = m.c[0] / 10; data[i * 4 + 2] = m.c[1] / 10; data[i * 4 + 3] = 1; });
  const tex = new THREE.DataTexture(data, texW, texH, THREE.RGBAFormat, THREE.FloatType); tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  dispUniforms.uBldTex.value = tex; dispUniforms.uBldW.value = texW;
  // 座標 -> 建物番号 の逆引き (輪郭線用)
  const p = g.attributes.position, bidAttr = g.attributes.bid; bidLookup = new Map();
  for (let i = 0; i < p.count; i++) bidLookup.set(posKey(p.getX(i), p.getY(i), p.getZ(i)), bidAttr.getX(i));
  // 輪郭線: 折れ角 14° 以上を細線、60° 以上 (外形・コーナー) を太線で描く
  const lines = makeEdgeLines(g, 14, 60, groups.edges, true);
  console.log(`building edges: thin ${lines.thinCount}, thick ${lines.thickCount}`);
  setupStyledMesh(buildingMesh, buildingMesh.material, cityMaterial({ windows: true }), lines, 'bldg');
  buildPointsAndVoxels(g);
  buildSectionCap(g);
}
function buildBridges(blobs, header) {
  const g = meshFromPack(blobs.brid_pos, blobs.brid_idx);
  bridgeMesh = new THREE.Mesh(g, drawingMaterial({ floors: false, displace: false })); bridgeMesh.name = 'brid';
  groups.bridges.add(bridgeMesh);
  bridgeMeta = header.bridges.meta; bridgeStarts = header.bridges.starts;
  const lines = makeEdgeLines(g, 20, 65, groups.bridges);
  setupStyledMesh(bridgeMesh, bridgeMesh.material, cityMaterial({ windows: false, color: '#2d5a8a', emissive: '#0f2a4a', displace: false }), lines, 'brid');
}

// ---- 点描・ボクセル (建物表面のサンプリングから生成) ------------------------------
let pointsObj = null, voxelMesh = null;
const POINT_COUNT = 900000, VOXEL = 6;
function buildPointsAndVoxels(g) {
  const pos = g.attributes.position, idx = g.index.array, bidA = g.attributes.bid;
  const nt = idx.length / 3; const cum = new Float64Array(nt); let total = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  const light = new THREE.Vector3(-0.5, 0.75, 0.4).normalize();
  const nrm = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    A.fromBufferAttribute(pos, idx[t * 3]); B.fromBufferAttribute(pos, idx[t * 3 + 1]); C.fromBufferAttribute(pos, idx[t * 3 + 2]);
    N.copy(B).sub(A).cross(C.clone().sub(A)); const area = N.length() * 0.5; N.normalize();
    nrm[t * 3] = N.x; nrm[t * 3 + 1] = N.y; nrm[t * 3 + 2] = N.z;
    total += area; cum[t] = total;
  }
  // 面積比例で一様サンプリング
  const P = new Float32Array(POINT_COUNT * 3), PB = new Float32Array(POINT_COUNT), PS = new Float32Array(POINT_COUNT), PR = new Float32Array(POINT_COUNT);
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cells = new Map();
  for (let i = 0; i < POINT_COUNT; i++) {
    const r = rnd() * total; let lo = 0, hi = nt - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const t = lo; let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    A.fromBufferAttribute(pos, idx[t * 3]); B.fromBufferAttribute(pos, idx[t * 3 + 1]); C.fromBufferAttribute(pos, idx[t * 3 + 2]);
    const x = A.x + (B.x - A.x) * u + (C.x - A.x) * v, y = A.y + (B.y - A.y) * u + (C.y - A.y) * v, z = A.z + (B.z - A.z) * u + (C.z - A.z) * v;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    const b = bidA.getX(idx[t * 3]); PB[i] = b;
    const sh = 0.5 - 0.5 * (nrm[t * 3] * light.x + nrm[t * 3 + 1] * light.y + nrm[t * 3 + 2] * light.z); PS[i] = sh; PR[i] = rnd();
    const key = `${Math.floor(x / VOXEL)},${Math.floor(y / VOXEL)},${Math.floor(z / VOXEL)}`;
    if (!cells.has(key)) cells.set(key, b);
  }
  // 点描
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('bid', new THREE.BufferAttribute(PB, 1)); pg.setAttribute('shade', new THREE.BufferAttribute(PS, 1)); pg.setAttribute('rnd', new THREE.BufferAttribute(PR, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: hex('#1f2a44') }, uColor2: { value: hex('#c8553d') }, uPMode: { value: 0 }, uSize: { value: 1.0 }, uDensity: { value: 0.7 }, uScale: { value: innerHeight / 2 }, uPR: { value: renderer.getPixelRatio() }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, ...dispUniforms },
    clipping: true, clippingPlanes: sectionPlanes, transparent: true, depthWrite: true,
    vertexShader: `attribute float bid, shade, rnd; uniform float uSize, uDensity, uScale, uPR, uPMode; varying float vKeep, vFog, vH, vB;
      #include <clipping_planes_pars_vertex>
      ${DISP_PARS}
      void main(){
        vec4 mvPosition = modelViewMatrix * vec4(position + disp(bid), 1.0);
        vB = bid; vH = position.y;
        float s = uSize * uScale / max(1.0, -mvPosition.z) * 4.0;
        if (uPMode > 1.5) {       // 大小点: 陰側ほど大きい点 (密度は一定)
          vKeep = step(rnd, uDensity * 0.7); s *= mix(0.5, 2.2, shade);
          gl_PointSize = clamp(s, 0.8, 4.5) * uPR;
        } else {                   // 陰側ほど点を密に (点描の陰影)
          vKeep = step(rnd, uDensity * mix(0.25, 1.0, shade));
          gl_PointSize = clamp(s, 0.9, 2.1) * uPR;
        }
        vFog = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor, uColor2, fogColor; uniform float fogDensity, uPMode, uHide; varying float vKeep, vFog, vH, vB;
      #include <clipping_planes_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        if (vKeep < 0.5 || abs(vB - uHide) < 0.5) discard; vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard;
        vec3 c = uPMode > 0.5 && uPMode < 1.5 ? mix(uColor, uColor2, clamp(vH / 160.0, 0.0, 1.0)) : uColor;
        float f = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
        gl_FragColor = vec4(mix(c, fogColor, clamp(f, 0.0, 1.0)), 1.0);
      }`,
  });
  pointsObj = new THREE.Points(pg, pm); pointsObj.frustumCulled = false; pointsObj.visible = false; groups.buildings.add(pointsObj);
  pointMaterials.push(pm);
  // ボクセル
  const n = cells.size; const box = new THREE.BoxGeometry(VOXEL * 0.96, VOXEL * 0.96, VOXEL * 0.96);
  const vb = new Float32Array(n); const vm = new THREE.MeshStandardMaterial({ color: '#dfe6f2', roughness: 0.9, metalness: 0, flatShading: true, clippingPlanes: sectionPlanes });
  vm.onBeforeCompile = shader => {
    addDispUniforms(shader);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float bid; varying float vBidV;\n' + DISP_PARS).replace('#include <begin_vertex>', 'vBidV = bid; vec3 transformed = vec3(position) + disp(bid);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHide; varying float vBidV;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBidV - uHide) < 0.5) discard;');
  };
  vm.customProgramCacheKey = () => 'voxelDisp';
  voxelMesh = new THREE.InstancedMesh(box, vm, n);
  const M = new THREE.Matrix4(); let k = 0;
  for (const [key, b] of cells) { const [cx, cy, cz] = key.split(',').map(Number); M.makeTranslation((cx + 0.5) * VOXEL, (cy + 0.5) * VOXEL, (cz + 0.5) * VOXEL); voxelMesh.setMatrixAt(k, M); vb[k] = b; k++; }
  box.setAttribute('bid', new THREE.InstancedBufferAttribute(vb, 1));
  voxelMesh.instanceMatrix.needsUpdate = true; voxelMesh.frustumCulled = false; voxelMesh.visible = false; groups.buildings.add(voxelMesh);
  console.log(`points ${POINT_COUNT}, voxels ${n}`);
  onTheme(t => { pm.uniforms.uColor.value.set(t.pointColor ?? t.edge); pm.uniforms.uColor2.value.set(t.pointColor2 ?? '#c8553d'); pm.uniforms.fogColor.value.set(t.fog); pm.uniforms.fogDensity.value = t.fogDensity; vm.color.set(t.voxel ?? t.face); vm.emissive.set(t.voxelEmissive ?? '#000000'); });
  applyRepMode();
}
// ---- 断面キャップ: ステンシルで切り口を塗る (前面+1, 背面-1 → 0 でない場所が内部) ------
let capPlane = null;
function buildSectionCap(g) {
  const mk = (side, op) => {
    const m = new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op, clippingPlanes: sectionPlanes });
    // 選択中 (階分解表示中) の建物はキャップ対象から外す
    m.onBeforeCompile = sh => { sh.uniforms.uHide = dispUniforms.uHide; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float bid; varying float vBidC;').replace('#include <begin_vertex>', 'vBidC = bid;\n#include <begin_vertex>'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHide; varying float vBidC;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBidC - uHide) < 0.5) discard;'); };
    m.customProgramCacheKey = () => 'cap' + side;
    return m;
  };
  const back = new THREE.Mesh(g, mk(THREE.BackSide, THREE.IncrementWrapStencilOp)); back.renderOrder = 20;
  const front = new THREE.Mesh(g, mk(THREE.FrontSide, THREE.DecrementWrapStencilOp)); front.renderOrder = 21;
  const capMat = new THREE.ShaderMaterial({
    uniforms: { uFace: { value: hex('#ffffff') }, uLine: { value: hex('#35466b') }, uAlpha: { value: 0.5 } },
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
    vertexShader: 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform vec3 uFace, uLine; uniform float uAlpha; varying vec3 vW;
      void main(){ float h1 = (vW.x + vW.z) / 2.4; float d1 = min(fract(h1), 1.0 - fract(h1)); float w1 = fwidth(h1);
        float h2 = (vW.x - vW.z) / 2.4; float d2 = min(fract(h2), 1.0 - fract(h2)); float w2 = fwidth(h2);
        float l = max(1.0 - smoothstep(w1 * 0.5, w1 * 1.4, d1), 1.0 - smoothstep(w2 * 0.5, w2 * 1.4, d2));
        gl_FragColor = vec4(mix(uFace * 0.93, uLine, l * uAlpha), 1.0); }`,
  });
  capPlane = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), capMat); capPlane.rotation.x = -Math.PI / 2; capPlane.renderOrder = 22;
  capPlane.onAfterRender = r => r.clearStencil();
  const grp = new THREE.Group(); grp.add(back, front, capPlane); grp.visible = false; groups.buildings.add(grp);
  capPlane.userData.group = grp;
  onTheme(t => { capMat.uniforms.uFace.value.set(t.face); capMat.uniforms.uLine.value.set(t.faceLine); capMat.uniforms.uAlpha.value = t.bloom ? 0.2 : 0.55; });
}
function updateSectionCap() {
  if (!capPlane) return;
  const on = sectionPlane.constant < 4000 && dispUniforms.uDMode.value === 0 && repMode === 'line';
  capPlane.userData.group.visible = on; capPlane.position.y = sectionPlane.constant - 0.02;
}

// 表現モード: 線画 / 点描 / ボクセル
let repMode = 'line';
function applyRepMode() {
  const isNight = T().bloom;
  if (buildingMesh) buildingMesh.visible = repMode === 'line' && (isNight || bldFaces);
  groups.edges.visible = repMode === 'line' && document.getElementById('chk-edges').checked;
  if (pointsObj) pointsObj.visible = repMode === 'points';
  if (voxelMesh) voxelMesh.visible = repMode === 'voxel';
  updateSectionCap();
}

// ---- テナント・店舗 POI (OSM) -----------------------------------------------------
let poiData = [], poiPoints = null, poiByBuilding = new Map();
const catVisible = new Set();  // 空 = すべて表示
const catOn = c => catVisible.size === 0 || catVisible.has(c);
function applyCategoryFilter() {
  for (const z of sel.zones) { const on = z.isCor || catOn(z.zone.category); z.mesh.visible = on; z.edge.visible = on; if (z.label) z.label.visible = on && z.label.material.opacity > 0.02; }
  for (const sp of sel.markers) sp.userData.filtered = !catOn(sp.userData.q.c);
  if (poiPoints) { const a = poiPoints.geometry.attributes.vis; poiData.forEach((q, i) => a.setX(i, catOn(q.c) ? 1 : 0)); a.needsUpdate = true; }
}
const CAT_COLOR = { '飲食': '#e0652f', '物販': '#e8a33d', 'サービス': '#8c5ae0', 'オフィス': '#5a6b8c', '医療': '#d04a7a', '公共': '#2fb27a', '宿泊': '#2f7fe0', 'その他': '#9aa3b5' };
const catColor = c => CAT_COLOR[c] ?? CAT_COLOR['その他'];
const POI_GROUP_COLOR = { shop: '#e0652f', amenity: '#2f7fe0', office: '#5a6b8c', craft: '#8c5ae0', tourism: '#2fb27a', leisure: '#2fb27a', healthcare: '#d04a7a' };
const FLOOR_H = 3.6;
const poiY = q => { const b = q.b >= 0 ? buildingMeta[q.b] : null; const base = b ? b.z[0] : terrainSampler(q.x, q.y); return base + (q.lv ?? 0) * FLOOR_H + 1.6; };
function buildPOI(list) {
  poiData = (list || []).map(q => ({ ...q, x: q.x / 10, y: q.y / 10 }));
  for (const q of poiData) if (q.b >= 0) { if (!poiByBuilding.has(q.b)) poiByBuilding.set(q.b, []); poiByBuilding.get(q.b).push(q); }
  const pos = new Float32Array(poiData.length * 3), col = new Float32Array(poiData.length * 3);
  poiData.forEach((q, i) => { pos[i * 3] = q.x; pos[i * 3 + 1] = poiY(q); pos[i * 3 + 2] = -q.y; const c = hex(catColor(q.c)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('vis', new THREE.BufferAttribute(new Float32Array(poiData.length).fill(1), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: innerHeight / 2 }, uPR: { value: renderer.getPixelRatio() }, uSize: { value: 2.2 }, uMin: { value: 3 }, uMax: { value: 7 }, uOpacity: { value: 0.95 }, uColor: { value: new THREE.Color() } },
    vertexShader: `attribute vec3 color; attribute float vis; varying vec3 vC; varying float vV; uniform float uSize, uMin, uMax, uScale, uPR; void main(){ vC = color; vV = vis; vec4 mv = modelViewMatrix * vec4(position, 1.0); float s = uSize * uScale / max(1.0, -mv.z); gl_PointSize = clamp(s, uMin, uMax) * uPR; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vV; uniform float uOpacity; void main(){ if (vV < 0.5) discard; vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float ring = smoothstep(0.55, 0.7, r); gl_FragColor = vec4(mix(vC, vec3(1.0), ring * 0.9), uOpacity * (1.0 - smoothstep(0.85, 1.0, r))); }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  pointMaterials.push(mat);
  poiPoints = new THREE.Points(geo, mat); poiPoints.renderOrder = 15; poiPoints.frustumCulled = false; poiPoints.visible = false; scene.add(poiPoints);
}
const updatePOIPositions = () => { if (!poiPoints) return; const p = poiPoints.geometry.attributes.position; poiData.forEach((q, i) => p.setY(i, poiY(q))); p.needsUpdate = true; };
const pickZone = () => { if (!sel.zones.length) return null; const hits = raycaster.intersectObjects(sel.zones.filter(z => !z.isCor && z.mesh.visible).map(z => z.mesh), false); return hits.length ? hits[0].object : null; };
const pickPOI = (sx, sy) => {
  if (!poiPoints || !poiPoints.visible) return null;
  for (const q of poiData) q._vis = catOn(q.c);
  let best = null, bd = 9;
  for (const q of poiData) {
    if (!q._vis) continue;
    tmpV.set(q.x, poiY(q), -q.y).project(activeCamera); if (tmpV.z > 1) continue;
    const d = Math.hypot((tmpV.x + 1) / 2 * innerWidth - sx, (1 - tmpV.y) / 2 * innerHeight - sy); if (d < bd) { bd = d; best = q; }
  }
  return best;
};
const lvLabel = lv => lv == null ? '階不明' : lv >= 0 ? `${lv + 1}F` : `B${-lv}`;

// ---- フロアガイド CSV (building,floor,zone,name,category,share,source) -------------------
let floorGuide = new Map();   // building name -> Map(fl -> [{zone,name,category,share}])
const ZONES = new Map();      // `${building}|${fl}|${zone}` -> [[x,y],...] (world, 北=+y)
for (const z of (window.__ZONES || [])) ZONES.set(`${z.building}|${parseFloor(z.floor)}|${z.zone}`, z.poly);
const zoneKey = (b, fl, zone) => { for (const [k, v] of ZONES) { const [kb, kf, kz] = k.split('|'); if ((b.includes(kb) || kb.includes(b)) && Number(kf) === fl && kz === String(zone)) return v; } return null; };
const parseFloor = f => { f = String(f || '').trim().toUpperCase(); if (!f) return null; const b = f.match(/^B(\d+)/); if (b) return -Number(b[1]); if (f === 'GL' || f === 'G') return 0; const n = parseFloat(f); return isNaN(n) ? null : Math.round(n) - 1; };
const parseCSV = text => {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim().replace(/^\ufeff/, ''));
  return rows.filter(r => r.some(v => v.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
};
function loadFloorGuide(text) {
  floorGuide = new Map(); let n = 0;
  for (const r of parseCSV(text)) {
    const fl = parseFloor(r.floor); if (!r.building || fl == null || !r.name) continue;
    if (!floorGuide.has(r.building)) floorGuide.set(r.building, new Map());
    const fm = floorGuide.get(r.building); if (!fm.has(fl)) fm.set(fl, []);
    fm.get(fl).push({ zone: r.zone || '', name: r.name, category: r.category || 'その他', share: Math.max(0.05, parseFloat(r.share) || 1), source: r.source || '', url: r.url || '', hours: r.hours || '', tel: r.tel || '', website: r.website || '', genre: r.genre || '' }); n++;
  }
  return n;
}
const guideFor = name => { if (!name) return null; if (floorGuide.has(name)) return floorGuide.get(name); for (const [k, v] of floorGuide) if (name.includes(k) || k.includes(name)) return v; return null; };
const floorName = fl => fl < 0 ? `B${-fl}` : `${fl + 1}F`;
const floorGuideTemplate = (name, nFloors) => {
  const g = guideFor(name); const lines = ['building,floor,zone,name,category,share,source'];
  for (let fl = nFloors - 1; fl >= -2; fl--) {
    const zs = g?.get(fl) ?? [];
    if (zs.length) for (const z of zs) lines.push([name, floorName(fl), z.zone, z.name, z.category, z.share, z.source].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    else lines.push(`"${name}",${floorName(fl)},,,,1,`);
  }
  return lines.join('\n');
};

// 2D 凸包 (Andrew's monotone chain) と帯状分割
const convexHull = pts => {
  pts = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
};
const clipHalf = (poly, nx, ny, c, keepLess) => { // n·p <= c (keepLess) を残す
  const out = []; const f = p => nx * p[0] + ny * p[1] - c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]; const fa = f(a), fb = f(b);
    const ia = keepLess ? fa <= 0 : fa >= 0, ib = keepLess ? fb <= 0 : fb >= 0;
    if (ia) out.push(a);
    if (ia !== ib) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
};
// 区画記号の数値順 (MARK IS の区画番号など) に並べる
const zoneOrder = zs => [...zs].sort((a, b) => { const na = parseFloat((a.zone.match(/\d+(\.\d+)?/) || ['Infinity'])[0]), nb = parseFloat((b.zone.match(/\d+(\.\d+)?/) || ['Infinity'])[0]); return na - nb || a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name); });
let partitionMode = 'corridor';   // strip | grid | corridor
const hullAxis = hull => {
  let cx = 0, cy = 0; for (const p of hull) { cx += p[0]; cy += p[1]; } cx /= hull.length; cy /= hull.length;
  let sxx = 0, sxy = 0, syy = 0; for (const p of hull) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); const ax = Math.cos(ang), ay = Math.sin(ang), nx = -ay, ny = ax;
  const pa = hull.map(p => (p[0] - cx) * ax + (p[1] - cy) * ay), pn = hull.map(p => (p[0] - cx) * nx + (p[1] - cy) * ny);
  return { cx, cy, ax, ay, nx, ny, a0: Math.min(...pa), a1: Math.max(...pa), n0: Math.min(...pn), n1: Math.max(...pn) };
};
// 主軸方向の帯分割 (poly を範囲 [a0,a1] 内で share 比に分ける)
const splitAlong = (poly, A, zones, a0, a1) => {
  const total = zones.reduce((a, z) => a + z.share, 0); let acc = a0; const out = [];
  const base = A.cx * A.ax + A.cy * A.ay;
  for (const z of zones) {
    const w = (a1 - a0) * z.share / total; const c0 = acc, c1 = acc + w; acc = c1;
    let q = clipHalf(poly, A.ax, A.ay, base + c0, false); if (q.length >= 3) q = clipHalf(q, A.ax, A.ay, base + c1, true);
    if (q.length >= 3) out.push({ zone: z, poly: q });
  }
  return out;
};
const sliceAcross = (poly, A, t0, t1) => { // 直交方向の比率 [t0,t1] で切り出す
  const base = A.cx * A.nx + A.cy * A.ny;
  let q = clipHalf(poly, A.nx, A.ny, base + A.n0 + (A.n1 - A.n0) * t0, false); if (q.length >= 3) q = clipHalf(q, A.nx, A.ny, base + A.n0 + (A.n1 - A.n0) * t1, true);
  return q;
};
function partition(hull, zones, mode = partitionMode) {
  zones = zoneOrder(zones); const A = hullAxis(hull);
  if (mode === 'strip' || zones.length < 3) return splitAlong(hull, A, zones, A.a0, A.a1).map(o => ({ ...o, kind: 'zone' }));
  if (mode === 'grid') {
    const rows = Math.max(2, Math.min(4, Math.round(Math.sqrt(zones.length / 2)))); const out = [];
    const per = Math.ceil(zones.length / rows);
    for (let r = 0; r < rows; r++) { const band = sliceAcross(hull, A, r / rows, (r + 1) / rows); const zs = zones.slice(r * per, (r + 1) * per); if (band.length >= 3 && zs.length) out.push(...splitAlong(band, A, zs, A.a0, A.a1).map(o => ({ ...o, kind: 'zone' }))); }
    return out;
  }
  // corridor: 中央通路 (幅 14%) の両側に交互配置
  const left = zones.filter((_, i) => i % 2 === 0), right = zones.filter((_, i) => i % 2 === 1);
  const bl = sliceAcross(hull, A, 0, 0.43), bc = sliceAcross(hull, A, 0.43, 0.57), br = sliceAcross(hull, A, 0.57, 1);
  const out = [];
  if (bl.length >= 3) out.push(...splitAlong(bl, A, left, A.a0, A.a1).map(o => ({ ...o, kind: 'zone' })));
  if (br.length >= 3 && right.length) out.push(...splitAlong(br, A, right, A.a0, A.a1).map(o => ({ ...o, kind: 'zone' })));
  if (bc.length >= 3) out.push({ zone: { name: '通路', category: '通路', zone: '', share: 1 }, poly: bc, kind: 'corridor' });
  return out;
}
function stripPartition(hull, zones) {
  // 主軸 (最長方向) に沿って share 比で帯に分ける
  let cx = 0, cy = 0; for (const p of hull) { cx += p[0]; cy += p[1]; } cx /= hull.length; cy /= hull.length;
  let sxx = 0, sxy = 0, syy = 0; for (const p of hull) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy); const ax = Math.cos(ang), ay = Math.sin(ang);
  const proj = hull.map(p => (p[0] - cx) * ax + (p[1] - cy) * ay); const lo = Math.min(...proj), hi = Math.max(...proj);
  const total = zones.reduce((a, z) => a + z.share, 0); let acc = lo; const out = [];
  for (const z of zones) {
    const w = (hi - lo) * z.share / total; const c0 = acc, c1 = acc + w; acc = c1;
    let poly = clipHalf(hull, ax, ay, cx * ax + cy * ay + c0, false); if (poly.length >= 3) poly = clipHalf(poly, ax, ay, cx * ax + cy * ay + c1, true);
    if (poly.length >= 3) out.push({ zone: z, poly });
  }
  return out;
}

// ---- 建物の選択・階分解 (選択した建物をフロアごとにスライスして分解) -------------------
const sel = { bid: -1, mesh: null, lines: null, markers: [], gap: 0, floors: 0, zones: [], hull: null, underlays: [] };
const UNDERLAYS = (window.__UNDERLAYS || []).map(u => ({ ...u, fl: parseFloor(u.floor) }));
const texLoader = new THREE.TextureLoader(); const texCache = new Map();
let underlayOn = true, labelMode = 'auto';
const underlaysFor = name => UNDERLAYS.filter(u => name && (name.includes(u.building) || u.building.includes(name)));
function buildUnderlays(name) {
  const list = underlaysFor(name); if (!list.length || !sel.hull) return;
  const A = hullAxis(sel.hull);
  for (const u of list) {
    if (!texCache.has(u.file)) { const t = texLoader.load(u.data); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texCache.set(u.file, t); }
    const mat = new THREE.MeshBasicMaterial({ map: texCache.get(u.file), transparent: true, opacity: u.opacity ?? 0.8, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: sectionPlanes });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.renderOrder = 4; mesh.userData.u = u; mesh.userData.A = A;
    selGroup.add(mesh); sel.underlays.push(mesh);
  }
  layoutUnderlays();
}
// 画像内の図面範囲 (box) を建物主軸に合わせ、アンカー地物の方向で 0°/180° を自動判定する
function autoRotation(u, A) {
  if (!u.anchor) return 0;
  const bm = buildingMeta.find(m => m.n && m.n.includes(u.anchor.name)); if (!bm) return 0;
  const tx = bm.c[0] / 10 - A.cx, ty = bm.c[1] / 10 - A.cy;                 // 建物中心 → アンカー (世界)
  const box = u.box || [0, 0, 1, 1]; const iu = u.anchor.u - (box[0] + box[2]) / 2, iv = -(u.anchor.v - (box[1] + box[3]) / 2); // 画像中心 → アンカー (画像: 右+, 上+)
  const ax = A.ax, ay = A.ay, nx = A.nx, ny = A.ny;
  const d0 = (iu * ax + iv * nx) * tx + (iu * ay + iv * ny) * ty;            // rot 0 のとき
  return d0 >= 0 ? 0 : 180;
}
function layoutUnderlays() {
  const gap = selUniforms.uGap.value;
  for (const m of sel.underlays) {
    const u = m.userData.u, A = m.userData.A;
    const box = u.box || [0, 0, 1, 1];
    const bw = (box[2] - box[0]) * u.w, bh = (box[3] - box[1]) * u.h;         // 図面範囲 (px)
    const L = (A.a1 - A.a0) * (u.scale ?? 1);
    const k = L / Math.max(1, bw);                                              // 世界 m / px
    const w = u.w * k, h = u.h * k;
    const rotDeg = (u.fit ? 0 : autoRotation(u, A)) + (u.rot ?? 0); const ang = Math.atan2(A.ay, A.ax) + rotDeg * Math.PI / 180;
    const rx = Math.cos(ang), ry = Math.sin(ang), ux = -Math.sin(ang), uy = Math.cos(ang);   // 画像の右・上 (世界 東,北)
    const offR = ((box[0] + box[2]) / 2 - 0.5) * u.w * k, offD = ((box[1] + box[3]) / 2 - 0.5) * u.h * k; // 図面中心の画像中心からのずれ
    const tx = A.cx + A.ax * (u.dx ?? 0) + A.nx * (u.dy ?? 0), ty = A.cy + A.ay * (u.dx ?? 0) + A.ny * (u.dy ?? 0);
    const cx = tx - (offR * rx - offD * ux), cy = ty - (offR * ry - offD * uy);
    m.scale.set(w, h, 1);
    m.rotation.order = 'YXZ'; m.rotation.y = ang; m.rotation.x = -Math.PI / 2;
    m.position.set(cx, sel.base + u.fl * FLOOR_H + 0.28 + Math.max(0, u.fl) * gap, -cy);
    m.material.opacity = u.opacity ?? 0.8; m.visible = underlayOn && (u.fl >= 0 || gap > 0.5 || sectionPlane.constant < sel.base);
  }
  // 断面カット中で階が重なっている (展開なし) ときは、切断面直下の 1 枚だけを見せる
  if (sectionPlane.constant < 4000 && gap < 0.5) {
    let top = null;
    for (const m of sel.underlays) if (m.visible && m.position.y <= sectionPlane.constant && (!top || m.position.y > top.position.y)) top = m;
    for (const m of sel.underlays) if (m.visible && m !== top) m.visible = false;
  }
}
const underlayJSON = () => JSON.stringify(UNDERLAYS.map(({ data, fl, ...u }) => u), null, 1);
const underlaysFor_ = underlaysFor;
let floorCatMode = false;  // 階を用途色で塗る
const selGroup = new THREE.Group(); scene.add(selGroup);
const infoEl = document.getElementById('info'), infoBody = document.getElementById('info-body'), infoTitle = document.getElementById('info-title');
const zoneDetail = document.getElementById('zone-detail');
function showZoneDetail(zi) {
  const z = zi.zone; const src = z.source === 'official' ? '公式フロアガイド' : z.source === 'osm' ? 'OpenStreetMap' : z.source === 'fictional' ? '架空（生成データ）' : z.source || '手入力';
  const osm = poiData.find(q => q.n === z.name && q.b === sel.bid);
  zoneDetail.innerHTML = `<div class="zd-head"><span class="tag" style="border-color:${catColor(z.category)};background:${catColor(z.category)}33">${z.category}</span> <b>${z.name}</b></div>
    <div>${zi.building ?? ''} ${floorName(zi.fl)}${z.zone ? ' ／ 区画 ' + z.zone : ''}${z.genre ? ' ／ ' + z.genre : ''}</div>
    ${z.hours ? `<div class="zd-row">営業時間: ${z.hours}</div>` : ''}${z.tel ? `<div class="zd-row">TEL: ${z.tel}</div>` : ''}
    <div class="zd-row">${z.url ? `<a href="${z.url}" target="_blank" rel="noopener">施設の店舗ページ ↗</a>` : ''}${z.website ? ` ／ <a href="${z.website}" target="_blank" rel="noopener">店舗公式サイト ↗</a>` : ''}</div>
    <div class="info-sub">出典: ${src}${osm ? ' ／ OSM 種別: ' + osm.k : ''}</div>
    <div class="btn-row" style="margin:6px 0 0"><button id="btn-zone-cat">同じ用途だけ表示</button><button id="btn-zone-close">閉じる</button></div>`;
  zoneDetail.style.display = 'block';
  document.getElementById('btn-zone-cat').addEventListener('click', () => { setCatFilter(new Set([z.category])); });
  document.getElementById('btn-zone-close').addEventListener('click', () => { zoneDetail.style.display = 'none'; });
  for (const zz of sel.zones) zz.edge.material.opacity = (zz.zone === z) ? 1 : (zz.isCor ? 0.4 : 0.9), zz.mesh.material.opacity = (zz.zone === z) ? 0.85 : (zz.isCor ? 0.18 : 0.45);
}
const setCatFilter = set => { catVisible.clear(); for (const c of set) catVisible.add(c); document.querySelectorAll('#cat-filter .cf').forEach(b => b.classList.toggle('active', catVisible.size === 0 || catVisible.has(b.dataset.cat))); applyCategoryFilter(); };
function sliceBuilding(bid, floorH) {
  const g = buildingMesh.geometry, P = g.attributes.position, I = g.index.array;
  const base = buildingMeta[bid].z[0], top = buildingMeta[bid].z[1];
  const nFloors = Math.max(1, Math.ceil((top - base - 0.3) / floorH));
  const tris = []; // [{fl, pts:[[x,y,z],...]}]
  const cuts = []; // 切断線 [fl, x1,y1,z1, x2,y2,z2]
  const clipPoly = (poly, yc) => { // 凸多角形を平面 y=yc で下/上に分割
    const below = [], above = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[1] - yc, db = b[1] - yc;
      (da <= 0 ? below : above).push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); const m = [a[0] + (b[0] - a[0]) * t, yc, a[2] + (b[2] - a[2]) * t]; below.push(m); above.push(m); }
    }
    return [below, above];
  };
  for (let t = buildingStarts[bid]; t < buildingStarts[bid + 1]; t++) {
    let polys = [[0, 1, 2].map(k => [P.getX(I[t * 3 + k]), P.getY(I[t * 3 + k]), P.getZ(I[t * 3 + k])])];
    const ys = polys[0].map(p => p[1]); const k0 = Math.max(1, Math.floor((Math.min(...ys) - base) / floorH) + 1), k1 = Math.min(nFloors - 1, Math.floor((Math.max(...ys) - base) / floorH));
    for (let k = k0; k <= k1; k++) {
      const yc = base + k * floorH; const next = [];
      for (const poly of polys) {
        const ys2 = poly.map(p => p[1]);
        if (Math.max(...ys2) <= yc + 1e-6) { tris.push({ fl: k - 1, pts: poly }); continue; }
        if (Math.min(...ys2) >= yc - 1e-6) { next.push(poly); continue; }
        const [lo, hi] = clipPoly(poly, yc);
        if (lo.length >= 3) tris.push({ fl: k - 1, pts: lo });
        if (hi.length >= 3) next.push(hi);
        const onCut = lo.filter(p => Math.abs(p[1] - yc) < 1e-6);
        if (onCut.length >= 2) cuts.push([k - 1, ...onCut[0], ...onCut[1]]);
      }
      polys = next;
    }
    for (const poly of polys) { const fl = Math.min(nFloors - 1, Math.max(0, Math.floor((poly.reduce((a, p) => a + p[1], 0) / poly.length - base) / floorH))); tris.push({ fl, pts: poly }); }
  }
  // 三角形化 (扇状) + フロア属性
  const pos = [], fl = [], triFloor = [];
  for (const tr of tris) for (let i = 1; i < tr.pts.length - 1; i++) { for (const p of [tr.pts[0], tr.pts[i], tr.pts[i + 1]]) { pos.push(p[0], p[1], p[2]); fl.push(tr.fl); } triFloor.push(tr.fl); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('fl', new THREE.Float32BufferAttribute(fl, 1));
  // 輪郭線: フロアごとに EdgesGeometry、切断線は両フロア側に
  const lpos = [], lfl = [];
  const byFloor = new Map(); tris.forEach((tr, i) => { if (!byFloor.has(tr.fl)) byFloor.set(tr.fl, []); byFloor.get(tr.fl).push(tr); });
  for (const [f, list] of byFloor) {
    const fp = []; for (const tr of list) for (let i = 1; i < tr.pts.length - 1; i++) for (const p of [tr.pts[0], tr.pts[i], tr.pts[i + 1]]) fp.push(p[0], p[1], p[2]);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    const eg = new THREE.EdgesGeometry(fg, 14); const ep = eg.attributes.position;
    for (let i = 0; i < ep.count; i++) { lpos.push(ep.getX(i), ep.getY(i), ep.getZ(i)); lfl.push(f); }
    fg.dispose(); eg.dispose();
  }
  for (const c of cuts) { lpos.push(c[1], c[2], c[3], c[4], c[5], c[6]); lfl.push(c[0], c[0]); lpos.push(c[1], c[2], c[3], c[4], c[5], c[6]); lfl.push(c[0] + 1, c[0] + 1); }
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3)); lgeo.setAttribute('fl', new THREE.Float32BufferAttribute(lfl, 1));
  return { geo, lgeo, triFloor, nFloors, base };
}
const selUniforms = { uGap: { value: 0 }, uHoverFl: { value: -1 }, uCat: { value: 0 } };
function selectBuilding(bid) {
  clearSelection();
  if (bid < 0 || bid == null) return;
  const m = buildingMeta[bid]; sel.bid = bid;
  const { geo, lgeo, triFloor, nFloors, base } = sliceBuilding(bid, FLOOR_H);
  sel.floors = nFloors; sel.base = base; sel.triFloor = triFloor;
  const t = T();
  // 階ごとの用途色 (フロアガイド優先、無ければ OSM POI の多数決)
  const guide = guideFor(m.n); const tenantsAll = poiByBuilding.get(bid) ?? [];
  const floorCat = fl => { const zs = guide?.get(fl); const list = zs?.length ? zs.map(z => z.category) : tenantsAll.filter(q => (q.lv ?? 0) === fl).map(q => q.c); if (!list.length) return null; const cnt = {}; for (const c of list) cnt[c] = (cnt[c] || 0) + 1; return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; };
  const fc = new Float32Array(geo.attributes.fl.count * 3); const flA = geo.attributes.fl; const catCache = new Map();
  for (let i = 0; i < flA.count; i++) { const fl = flA.getX(i); if (!catCache.has(fl)) { const c = floorCat(fl); catCache.set(fl, c ? hex(catColor(c)) : null); } const c = catCache.get(fl); if (c) { fc[i * 3] = c.r; fc[i * 3 + 1] = c.g; fc[i * 3 + 2] = c.b; } else { fc[i * 3] = -1; } }
  geo.setAttribute('fc', new THREE.BufferAttribute(fc, 3));
  const fmat = new THREE.ShaderMaterial({
    uniforms: { uFace: { value: hex(t.face) }, uLine: { value: hex(t.faceLine) }, uGap: selUniforms.uGap, uHoverFl: selUniforms.uHoverFl, uCat: selUniforms.uCat },
    clipping: true, clippingPlanes: sectionPlanes,
    vertexShader: `attribute float fl; attribute vec3 fc; uniform float uGap; varying float vFl; varying vec3 vW, vFc;
      #include <clipping_planes_pars_vertex>
      void main(){ vFl = fl; vFc = fc; vec4 wp = modelMatrix * vec4(position + vec3(0.0, fl * uGap, 0.0), 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <clipping_planes_vertex>
      }`,
    fragmentShader: `uniform vec3 uFace, uLine; uniform float uHoverFl, uCat; varying float vFl; varying vec3 vW, vFc;
      #include <clipping_planes_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW))); vec3 col = uFace * (0.92 + 0.08 * abs(fn.x) + 0.04 * abs(fn.z));
        // 偶数階/奇数階でごく薄く色分け
        col = mix(col, uLine, mod(vFl, 2.0) * 0.06);
        if (uCat > 0.5 && vFc.x >= 0.0) col = mix(col, vFc, 0.55);
        if (abs(vFl - uHoverFl) < 0.5) col = mix(col, vec3(0.2, 0.7, 1.0), 0.35);
        gl_FragColor = vec4(col, 1.0); }`,
    polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 1.5,
  });
  sel.mesh = new THREE.Mesh(geo, fmat); selGroup.add(sel.mesh);
  const lmat = new THREE.LineBasicMaterial({ color: t.edge, transparent: true, opacity: 0.9, clippingPlanes: sectionPlanes });
  lmat.onBeforeCompile = sh => { sh.uniforms.uGap = selUniforms.uGap; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float fl; uniform float uGap;').replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + vec3(0.0, fl * uGap, 0.0);'); };
  lmat.customProgramCacheKey = () => 'selLines';
  sel.lines = new THREE.LineSegments(lgeo, lmat); selGroup.add(sel.lines);
  dispUniforms.uHide.value = bid;
  // テナントマーカー
  const tenants = poiByBuilding.get(bid) ?? [];
  const guided = new Set(); if (guide) for (const zs of guide.values()) for (const z of zs) guided.add(z.name);
  for (const q of tenants) {
    if (guided.has(q.n)) continue;  // フロアガイドにある店は区画プレート側でラベル表示
    const sp = makeTextSprite(q.n, catColor(q.c), { scale: 0.13, themeColor: tt => tt.labelGlow === false ? catColor(q.c) : '#ffe9b0' }); sp.userData.q = q; sp.userData.fadeFrom = 1200; selGroup.add(sp); sel.markers.push(sp);
  }
  // 区画プレート: フロアガイドの各階を凸包の帯分割で区画化
  if (guide) {
    const P = buildingMesh.geometry.attributes.position; const pts = [];
    for (let tr = buildingStarts[bid]; tr < buildingStarts[bid + 1]; tr++) for (let k = 0; k < 3; k++) { const vi = buildingMesh.geometry.index.array[tr * 3 + k]; pts.push([P.getX(vi), -P.getZ(vi)]); }
    sel.hull = convexHull(pts);
    for (const [fl, zs] of guide) {
      // 抽出済みの区画多角形があればそれを使い、無いものは残りを帯分割で近似
      const withPoly = zs.filter(z => zoneKey(m.n, fl, z.zone)); const rest = zs.filter(z => !zoneKey(m.n, fl, z.zone));
      const parts = withPoly.map(z => ({ zone: z, poly: zoneKey(m.n, fl, z.zone), kind: 'zone', exact: true }));
      if (rest.length) parts.push(...(withPoly.length ? partition(sel.hull, rest, 'strip') : partition(sel.hull, rest)));
      for (const { zone, poly, kind, exact } of parts) {
        const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
        const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false }); g.applyMatrix4(ROT_XZ);
        const isCor = kind === 'corridor'; const col = isCor ? '#9aa3b5' : catColor(zone.category);
        const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: isCor ? 0.18 : (kind === 'zone' && !exact && withPoly.length ? 0.22 : 0.55), depthWrite: false, clippingPlanes: sectionPlanes }));
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: isCor ? 0.4 : 0.9, clippingPlanes: sectionPlanes }));
        let zx = 0, zy = 0; for (const q of poly) { zx += q[0]; zy += q[1]; } zx /= poly.length; zy /= poly.length;
        const label = isCor ? null : makeTextSprite(zone.name, col, { scale: 0.12, themeColor: tt => tt.labelGlow === false ? col : '#ffe9b0' }); if (label) label.userData.fadeFrom = 1000;
        mesh.renderOrder = 5; mesh.userData.zoneInfo = { fl, zone, building: m.n }; selGroup.add(mesh, edge); if (label) selGroup.add(label);
        sel.zones.push({ fl, mesh, edge, label, zx, zy, zone, isCor });
      }
    }
  }
  buildUnderlays(m.n);
  updateSelectionLayout();
  // 情報パネル
  const h = m.h ?? Math.round(m.z[1] - m.z[0]);
  const byFl = new Map(); for (const q of tenants) { const k = q.lv == null ? 'unknown' : q.lv; if (!byFl.has(k)) byFl.set(k, []); byFl.get(k).push(q); }
  const keys = [...byFl.keys()].filter(k => k !== 'unknown').sort((a, b) => b - a);
  const tag = (n, c, src) => `<span class="tag" style="border-color:${catColor(c)};${src === 'osm' || !src ? '' : 'background:' + catColor(c) + '33'}">${n}</span>`;
  const allFl = new Set([...keys, ...(guide ? [...guide.keys()] : [])]); const flKeys = [...allFl].sort((a, b) => b - a);
  const rows = flKeys.map(k => { const gz = guide?.get(k) ?? []; const gnames = new Set(gz.map(z => z.name)); const os = (byFl.get(k) ?? []).filter(q => !gnames.has(q.n)); return `<div class="info-floor"><b>${lvLabel(k)}</b> ${gz.map(z => tag((z.zone ? z.zone + ' ' : '') + z.name, z.category, z.source || 'guide')).join(' ')} ${os.map(q => tag(q.n, q.c, 'osm')).join(' ')}</div>`; }).join('');
  const unknown = byFl.get('unknown') ? `<div class="info-floor"><b>階不明</b> ${byFl.get('unknown').map(q => tag(q.n, q.c, 'osm')).join(' ')}</div>` : '';
  const legend = Object.entries(CAT_COLOR).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('');
  infoTitle.textContent = m.n ?? '（名称なし）';
  const nGuide = guide ? [...guide.values()].reduce((a, v) => a + v.length, 0) : 0;
  infoBody.innerHTML = `${m.fictional ? '<div class="info-sub" style="color:#ffb648">※ この建物は本ツールで生成した架空の建築です（テナントも架空）</div>' : ''}<div>高さ ${h} m ／ 推定 ${nFloors} 階（階高 ${FLOOR_H} m）${m.parts > 1 ? ` ／ ${m.parts} 部位を統合` : ''}</div>
    <label class="row" style="padding:4px 0"><input type="checkbox" id="chk-floorcat" ${floorCatMode ? 'checked' : ''} /> 階を用途色で塗る</label>
    ${underlaysFor(m.n).length ? `<label class="row" style="padding:4px 0"><input type="checkbox" id="chk-underlay" ${underlayOn ? 'checked' : ''} /> 公式フロアマップを下敷き表示（${underlaysFor(m.n).length} 階）</label>
    <details id="underlay-cal"><summary class="info-sub" style="cursor:pointer">下敷きの位置合わせ（階ごと）</summary>
      <select id="ul-floor" style="width:100%;margin:4px 0;font-size:11px">${underlaysFor(m.n).map((u, i) => `<option value="${i}">${u.floor}</option>`).join('')}</select>
      <div class="cal-row"><span>回転</span><input type="range" id="ul-rot" min="-180" max="180" step="0.5" /><b id="ul-rot-v"></b></div>
      <div class="cal-row"><span>拡縮</span><input type="range" id="ul-scale" min="0.4" max="2.5" step="0.005" /><b id="ul-scale-v"></b></div>
      <div class="cal-row"><span>主軸方向</span><input type="range" id="ul-dx" min="-120" max="120" step="0.5" /><b id="ul-dx-v"></b></div>
      <div class="cal-row"><span>直交方向</span><input type="range" id="ul-dy" min="-120" max="120" step="0.5" /><b id="ul-dy-v"></b></div>
      <div class="cal-row"><span>不透明度</span><input type="range" id="ul-op" min="0" max="1" step="0.02" /><b id="ul-op-v"></b></div>
      <div class="btn-row"><button id="btn-ul-copy">設定を JSON でコピー</button><button id="btn-ul-dl">underlays.json 保存</button></div>
      <div class="info-sub">保存した JSON を data/underlays.json に置いて再ビルドすると既定値になります。</div>
    </details>` : ''}
    <div class="sec-title">名札</div>
    <div class="seg-row" id="label-presets"><button data-lm="auto" class="${labelMode === 'auto' ? 'active' : ''}">自動間引き</button><button data-lm="floor" class="${labelMode === 'floor' ? 'active' : ''}">カーソルの階</button><button data-lm="all" class="${labelMode === 'all' ? 'active' : ''}">すべて</button><button data-lm="none" class="${labelMode === 'none' ? 'active' : ''}">なし</button></div>
    <div class="sec-title">区画の割り付け</div>
    <div class="seg-row" id="part-presets"><button data-part="corridor" class="${partitionMode === 'corridor' ? 'active' : ''}">通路＋両側</button><button data-part="grid" class="${partitionMode === 'grid' ? 'active' : ''}">グリッド</button><button data-part="strip" class="${partitionMode === 'strip' ? 'active' : ''}">帯</button></div>
    <div class="legend" style="margin:2px 0 6px">${legend}</div>
    <div class="info-sub">フロアガイド ${nGuide} 区画（CSV）／ OSM 店舗 ${tenants.length} 件</div>${rows}${unknown}${tenants.length || nGuide ? '' : '<div class="info-sub">この建物に登録された店舗・施設はありません</div>'}
    <div class="btn-row" style="margin-top:8px"><button id="btn-guide-template">この建物の CSV 雛形</button><button id="btn-guide-load">CSV 読み込み</button></div>
    <div class="info-sub">※ 区画は CSV の share 比で主軸方向に帯分割した近似。正式な階数・区画形状はオープンデータに含まれません。</div>`;
  document.querySelectorAll('#label-presets button').forEach(b => b.addEventListener('click', () => { labelMode = b.dataset.lm; document.querySelectorAll('#label-presets button').forEach(x => x.classList.toggle('active', x === b)); }));
  const ulChk = document.getElementById('chk-underlay');
  if (ulChk) {
    ulChk.addEventListener('change', e => { underlayOn = e.target.checked; layoutUnderlays(); });
    const list = underlaysFor(m.n); const sel$ = document.getElementById('ul-floor');
    const ids = { rot: 'ul-rot', scale: 'ul-scale', dx: 'ul-dx', dy: 'ul-dy', opacity: 'ul-op' };
    const sync = () => { const u = list[Number(sel$.value)]; for (const [k, id] of Object.entries(ids)) { const el = document.getElementById(id); el.value = u[k] ?? (k === 'scale' ? 1 : k === 'opacity' ? 0.8 : 0); document.getElementById(id + '-v').textContent = String(el.value); } };
    sel$.addEventListener('change', sync); sync();
    for (const [k, id] of Object.entries(ids)) document.getElementById(id).addEventListener('input', e => { const u = list[Number(sel$.value)]; u[k] = parseFloat(e.target.value); document.getElementById(id + '-v').textContent = e.target.value; layoutUnderlays(); });
    document.getElementById('btn-ul-copy').addEventListener('click', () => navigator.clipboard?.writeText(underlayJSON()).then(() => { routeResult.textContent = '下敷き設定をクリップボードにコピーしました'; }));
    document.getElementById('btn-ul-dl').addEventListener('click', () => download(new Blob([underlayJSON()], { type: 'application/json' }), 'underlays.json'));
  }
  document.querySelectorAll('#part-presets button').forEach(b => b.addEventListener('click', () => { partitionMode = b.dataset.part; const g = selUniforms.uGap.value; selectBuilding(bid); selUniforms.uGap.value = g; updateSelectionLayout(); }));
  document.getElementById('chk-floorcat').addEventListener('change', e => { floorCatMode = e.target.checked; selUniforms.uCat.value = floorCatMode ? 1 : 0; });
  document.getElementById('btn-guide-template').addEventListener('click', () => download(new Blob(['\ufeff' + floorGuideTemplate(m.n ?? '', nFloors)], { type: 'text/csv' }), `floorguide_${(m.n ?? 'building').replace(/[\\/:*?"<>|]/g, '_')}.csv`));
  document.getElementById('btn-guide-load').addEventListener('click', () => guideFileInput.click());
  infoEl.style.display = 'block';
  document.getElementById('floor-gap').value = selUniforms.uGap.value;
}
function updateSelectionLayout() {
  const gap = selUniforms.uGap.value;
  for (const sp of sel.markers) { const q = sp.userData.q; const fl = Math.max(0, Math.min(sel.floors - 1, q.lv ?? 0)); sp.position.set(q.x, sel.base + fl * FLOOR_H + 1.8 + fl * gap, -q.y); layoutSprite(sp); }
  for (const z of sel.zones) { const y = sel.base + z.fl * FLOOR_H + 0.5 + Math.max(0, z.fl) * gap; z.mesh.position.y = y; z.edge.position.y = y; if (z.label) { z.label.position.set(z.zx, y + 2.2, -z.zy); layoutSprite(z.label); } }
  applyCategoryFilter(); layoutUnderlays();
}
// 名札の間引き: 画面上で重なる名札を優先度順 (カーソルの階 > 手前) に間引く
const _lab = new THREE.Vector3();
function declutterLabels() {
  const items = [];
  for (const sp of sel.markers) if (sp.visible) items.push({ sp, fl: Math.max(0, sp.userData.q.lv ?? 0) });
  for (const z of sel.zones) if (z.label && z.label.visible) items.push({ sp: z.label, fl: z.fl });
  if (!items.length) return;
  if (labelMode === 'none') { for (const it of items) it.sp.visible = false; return; }
  if (labelMode === 'all') return;
  const hf = selUniforms.uHoverFl.value;
  if (labelMode === 'floor') { for (const it of items) it.sp.visible = hf >= 0 ? it.fl === hf : false; if (hf >= 0) return; for (const it of items) it.sp.visible = true; }
  for (const it of items) { _lab.copy(it.sp.position).project(activeCamera); it.x = (_lab.x + 1) / 2 * innerWidth; it.y = (1 - _lab.y) / 2 * innerHeight; it.d = _lab.z; it.w = it.sp.userData.px * it.sp.userData.aspect; it.h = it.sp.userData.px; it.pri = (it.fl === hf ? 0 : 1); }
  items.sort((a, b) => a.pri - b.pri || a.d - b.d);
  const placed = [];
  for (const it of items) {
    if (it.d > 1) { it.sp.visible = false; continue; }
    const ok = placed.every(p => Math.abs(p.x - it.x) * 2 > p.w + it.w + 14 || Math.abs(p.y - it.y) * 2 > p.h + it.h + 6);
    it.sp.visible = ok; if (ok) placed.push(it);
  }
}
function clearSelection() {
  if (sel.mesh) { selGroup.remove(sel.mesh); sel.mesh.geometry.dispose(); sel.mesh.material.dispose(); sel.mesh = null; }
  if (sel.lines) { selGroup.remove(sel.lines); sel.lines.geometry.dispose(); sel.lines.material.dispose(); sel.lines = null; }
  for (const sp of sel.markers) { selGroup.remove(sp); sp.material.map.dispose(); sp.material.dispose(); }
  for (const z of sel.zones) { selGroup.remove(z.mesh, z.edge); z.mesh.geometry.dispose(); z.mesh.material.dispose(); z.edge.geometry.dispose(); z.edge.material.dispose(); if (z.label) { selGroup.remove(z.label); z.label.material.map.dispose(); z.label.material.dispose(); } }
  for (const u of sel.underlays) { selGroup.remove(u); u.geometry.dispose(); u.material.dispose(); } sel.underlays = [];
  zoneDetail.style.display = 'none';
  sel.zones = []; sel.markers = []; sel.bid = -1; dispUniforms.uHide.value = -1; infoEl.style.display = 'none'; selUniforms.uHoverFl.value = -1;
}
onTheme(t => { if (sel.mesh) { sel.mesh.material.uniforms.uFace.value.set(t.face); sel.mesh.material.uniforms.uLine.value.set(t.faceLine); sel.lines.material.color.set(t.edge); } });

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
  const zq = pickZone();
  if (zq) { const zi = zq.userData.zoneInfo; html = `<span class="tt-floor">${floorName(zi.fl)}</span>${zi.zone.name}<span class="tt-sub">${zi.zone.category}${zi.zone.zone ? '｜区画 ' + zi.zone.zone : ''}｜クリックで詳細</span>`; }
  const q = html ? null : pickPOI(pointerPx.x, pointerPx.y);
  if (q) html = `<span class="tt-floor">${lvLabel(q.lv)}</span>${q.n}<span class="tt-sub">${q.k}${q.b >= 0 && buildingMeta[q.b].n ? '｜' + buildingMeta[q.b].n : ''}</span>`;
  if (!html && sel.mesh) {
    const hit = raycaster.intersectObject(sel.mesh, false)[0];
    if (hit) { const fl = sel.triFloor[hit.faceIndex]; selUniforms.uHoverFl.value = fl; const names = (poiByBuilding.get(sel.bid) ?? []).filter(x => (x.lv ?? 0) === fl).map(x => x.n); html = `<span class="tt-floor">${lvLabel(fl)}</span>${buildingMeta[sel.bid].n ?? ''}<span class="tt-sub">${names.length ? names.join('・') : 'テナント登録なし'}</span>`; }
    else selUniforms.uHoverFl.value = -1;
  }
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
        html = `<span class="tt-floor">${m.fictional ? '架空の建物' : '建物'}</span>${m.n ?? '（名称なし）'}<span class="tt-sub">${hgt}${m.fictional ? '｜本ツールで生成した仮想建築' : ''}</span>`;
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
bindToggle('chk-network', groups.network); bindToggle('chk-station', groups.station); bindToggle('chk-bld', groups.buildings);
document.getElementById('chk-edges').addEventListener('change', () => applyRepMode());
bindToggle('chk-bridge', groups.bridges); bindToggle('chk-road', groups.roads); bindToggle('chk-rail', groups.rails); bindToggle('chk-water', groups.water); bindToggle('chk-terrain', groups.terrain); bindToggle('chk-labels', groups.labels); bindToggle('chk-green', groups.green);
document.getElementById('chk-windows').addEventListener('change', e => { bldUniforms.uWindows.value = e.target.checked ? 1 : 0; });
const applyTheme = name => { styleName = name; const t = T(); for (const fn of themed) fn(t); document.querySelectorAll('#style-presets button').forEach(b => b.classList.toggle('active', b.dataset.style === name)); document.getElementById('row-windows').style.display = t.bloom ? '' : 'none'; };
document.querySelectorAll('#style-presets button').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.style)));
document.querySelectorAll('#rep-presets button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#rep-presets button').forEach(x => x.classList.remove('active')); b.classList.add('active'); repMode = b.dataset.rep; applyRepMode(); }));
const dispInput = document.getElementById('disp-amount'), dispValue = document.getElementById('disp-value');
let dispAnim = null; // { from, to, start, ms }
const DMODE = { explode: 1, build: 2, stack: 3, grid: 4 };
let dmodeName = 'explode';
// スライダー値 v: 0=元の街, 1=最大分解。組立モードはシェーダ側で uDT=1 が完成形なので反転して渡す
const setDisp = v => { const build = dmodeName === 'build'; dispUniforms.uDT.value = build ? 1 - v : v; dispInput.value = v; dispValue.textContent = `${Math.round(v * 100)}%`; dispUniforms.uDMode.value = v > 0.0005 ? DMODE[dmodeName] : 0; };
document.querySelectorAll('#disp-presets button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#disp-presets button').forEach(x => x.classList.remove('active')); b.classList.add('active'); dmodeName = b.dataset.dmode; dispUniforms.uDMode.value = dispUniforms.uDT.value > 0.0005 ? DMODE[dmodeName] : 0; }));
dispInput.addEventListener('input', () => { dispAnim = null; setDisp(parseFloat(dispInput.value)); });
document.getElementById('btn-disp-play').addEventListener('click', () => { dispUniforms.uDSeed.value = Math.random() * 10; dispAnim = { from: 0, to: 1, start: performance.now(), ms: 2600 }; });
document.getElementById('btn-disp-rebuild').addEventListener('click', () => { dispAnim = { from: dispUniforms.uDT.value, to: 0, start: performance.now(), ms: 2600 }; });
document.getElementById('btn-city-rebuild').addEventListener('click', () => {
  // 街を作り直す: 組立モードで地中から順に立ち上げる
  document.querySelectorAll('#disp-presets button').forEach(x => x.classList.toggle('active', x.dataset.dmode === 'build')); dmodeName = 'build';
  dispUniforms.uDSeed.value = Math.random() * 10; setDisp(1);
  dispAnim = { from: 1, to: 0, start: performance.now(), ms: 5200, rebuild: true };
});
const secChk = document.getElementById('chk-section'), secInput = document.getElementById('section-h'), secValue = document.getElementById('section-value');
const applySection = () => { const on = secChk.checked; const h = parseFloat(secInput.value); sectionPlane.constant = on ? h : 5000; secValue.textContent = on ? `${h.toFixed(0)}m` : 'オフ'; updateSectionCap(); layoutUnderlays(); };
secChk.addEventListener('change', applySection); secInput.addEventListener('input', () => { if (!secChk.checked) secChk.checked = true; applySection(); });
const densInput = document.getElementById('point-density');
densInput.addEventListener('input', () => { if (pointsObj) pointsObj.material.uniforms.uDensity.value = parseFloat(densInput.value); });
document.querySelectorAll('#pmode-presets button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('#pmode-presets button').forEach(x => x.classList.remove('active')); b.classList.add('active'); if (pointsObj) pointsObj.material.uniforms.uPMode.value = Number(b.dataset.pmode); }));
const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
document.getElementById('btn-png').addEventListener('click', () => { composer.render(); canvas.toBlob(b => download(b, `minatomirai_${stamp()}.png`), 'image/png'); });
let recorder = null, recChunks = [];
const recBtn = document.getElementById('btn-rec');
recBtn.addEventListener('click', () => {
  if (recorder) { recorder.stop(); return; }
  const stream = canvas.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 12e6 }); recChunks = [];
  recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => { download(new Blob(recChunks, { type: 'video/webm' }), `minatomirai_${stamp()}.webm`); recorder = null; recBtn.textContent = '● 録画開始 (WebM)'; recBtn.classList.remove('active'); };
  recorder.start(200); recBtn.textContent = '■ 録画停止・保存'; recBtn.classList.add('active');
});
const lineInput = document.getElementById('line-scale'), lineValue = document.getElementById('line-scale-value');
lineInput.addEventListener('input', () => { lineScale = parseFloat(lineInput.value); lineValue.textContent = `×${lineScale.toFixed(2)}`; for (const fn of themed) fn(T()); });
const guideFileInput = document.createElement('input'); guideFileInput.type = 'file'; guideFileInput.accept = '.csv,text/csv'; guideFileInput.style.display = 'none'; document.body.appendChild(guideFileInput);
guideFileInput.addEventListener('change', async () => { const f = guideFileInput.files[0]; if (!f) return; const n = loadFloorGuide(await f.text()); guideFileInput.value = ''; const b = sel.bid; if (b >= 0) selectBuilding(b); routeResult.textContent = `フロアガイド CSV を読み込みました（${n} 区画）`; });
if (window.__FLOORGUIDE) loadFloorGuide(window.__FLOORGUIDE);
document.getElementById('floor-gap').addEventListener('input', e => { selUniforms.uGap.value = parseFloat(e.target.value); updateSelectionLayout(); });
document.getElementById('btn-info-close').addEventListener('click', () => clearSelection());
document.querySelectorAll('#cat-filter .cf').forEach(b => b.addEventListener('click', () => {
  const c = b.dataset.cat;
  if (catVisible.size === 0) { catVisible.add(c); } else if (catVisible.has(c)) { catVisible.delete(c); } else catVisible.add(c);
  if (catVisible.size === Object.keys(CAT_COLOR).length) catVisible.clear();
  setCatFilter(new Set(catVisible));
}));
document.getElementById('cat-all').addEventListener('click', () => setCatFilter(new Set()));
document.getElementById('chk-poi').addEventListener('change', e => { if (poiPoints) poiPoints.visible = e.target.checked; });
document.getElementById('chk-faces').addEventListener('change', e => { bldFaces = e.target.checked; for (const m of styledMeshes) m.mesh.visible = T().bloom || bldFaces; applyRepMode(); });
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
  if (!routeMode && downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) <= 6 && e.button === 0) {
    raycaster.setFromCamera(pointer, activeCamera);
    const zm = pickZone();
    if (zm) { showZoneDetail(zm.userData.zoneInfo); return; }
    const hit = buildingMesh && buildingMesh.visible ? raycaster.intersectObject(buildingMesh, false)[0] : null;
    if (hit) { const bid = findRange(buildingStarts, hit.faceIndex); if (bid !== sel.bid) selectBuilding(bid); }
    else if (sel.mesh && !raycaster.intersectObject(sel.mesh, false).length) clearSelection();
    return;
  }
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
  setProgress(0.9, '駅構内モデルを生成中…'); await nextFrame(); buildStations(header.stations); buildLabels(header.labels); buildPOI(header.poi);
  applyFlowPreset();
  applyTheme(styleName);
  setProgress(1, '完了');
  const loading = document.getElementById('loading');
  const anim = loading.animate({ opacity: [1, 0] }, { duration: 500, fill: 'forwards' });
  anim.onfinish = () => loading.remove();
  introStart = performance.now();
  window.__app = { applyTheme: n => applyTheme(n), select: b => selectBuilding(b), underlay: (on, u) => { underlayOn = on; if (u) Object.assign(UNDERLAYS.find(x => (x.building.includes(u.building) || u.building.includes(x.building)) && x.floor === u.floor) || {}, u); layoutUnderlays(); }, labels: m => { labelMode = m; }, setPartition: m => { partitionMode = m; }, setCat: arr => setCatFilter(new Set(arr)), zoneDetail: i => { const z = sel.zones.filter(z => !z.isCor)[i]; if (z) showZoneDetail(z.mesh.userData.zoneInfo); }, floorCat: v => { floorCatMode = v; selUniforms.uCat.value = v ? 1 : 0; }, loadGuide: t => loadFloorGuide(t), selectByName: n => { let i = buildingMeta.findIndex(m => m.n === n); if (i < 0) i = buildingMeta.findIndex(m => m.n && m.n.includes(n)); if (i >= 0) selectBuilding(i); return i; }, setGap: v => { selUniforms.uGap.value = v; updateSelectionLayout(); }, poi: v => { if (poiPoints) poiPoints.visible = v; }, setPMode: v => { if (pointsObj) pointsObj.material.uniforms.uPMode.value = v; }, setRep: m => { repMode = m; applyRepMode(); }, setDisp: (m, v) => { dmodeName = m; setDisp(v); }, section: h => { secChk.checked = h != null; secInput.value = h ?? 300; applySection(); }, scene, camera, controls, graph, header, buildingMesh, bridgeMesh, groups, render: () => { updateLabels(); composer.render(); }, setExpand, dijkstra, floorLabel, paused: false, benchmark: (n = 5) => { const gl = renderer.getContext(); const t = []; for (let i = 0; i < n; i++) { const s = performance.now(); composer.render(); gl.finish(); t.push(Math.round(performance.now() - s)); } return t; } };
}

let introStart = null; const INTRO_MS = 2600; const introFrom = camera.position.clone();
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clock = new THREE.Clock(); let elapsed = 0;
function updateLabels() {
  activeCamera.updateMatrixWorld();
  if (groups.labels.visible) for (const sp of groups.labels.children) layoutSprite(sp);
  for (const sp of floorLabelSprites) layoutSprite(sp);
  const cut = sectionPlane.constant;
  for (const sp of sel.markers) { layoutSprite(sp); if (sp.userData.filtered || sp.position.y > cut) sp.visible = false; }
  for (const z of sel.zones) if (z.label && (z.mesh.visible === false || z.label.position.y > cut)) z.label.visible = false;
  declutterLabels();
}
function animate() {
  requestAnimationFrame(animate);
  if (window.__app?.paused) return;
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt;
  if (introStart !== null) { const t = Math.min((performance.now() - introStart) / INTRO_MS, 1); camera.position.lerpVectors(introFrom, CAM_HOME, easeOut(t)); if (t >= 1) introStart = null; }
  if (fly) { const t = easeOut(Math.min((performance.now() - fly.start) / fly.ms, 1)); camera.position.lerpVectors(fly.p0, fly.p1, t); controls.target.lerpVectors(fly.t0, fly.t1, t); if (t >= 1) fly = null; }
  activeControls.update();
  for (const m of Object.values(netMats)) m.dashOffset = -elapsed * 4;
  bldUniforms.uTime.value = elapsed;
  if (dispAnim) {
    const t = Math.min((performance.now() - dispAnim.start) / dispAnim.ms, 1);
    const v = dispAnim.from + (dispAnim.to - dispAnim.from) * (dispAnim.rebuild ? t : easeOut(t));
    setDisp(v);
    if (t >= 1) dispAnim = null;
  }
  stepFlow(dt); stepRouteFlow(dt); updateHover(performance.now());
  updateLabels();
  composer.render();
}
init().catch(e => { loadingText.textContent = `読み込みエラー: ${e.message}`; console.error(e); });
animate();
