import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildStructure, elementBounds, elementProperties, CATEGORY } from './structure.js';
import { CLS, CLS_INFO } from './synth.js';
import { buildLut, cssGradient } from './colormaps.js';
import { createPointMaterial, createBimFaceMaterial, createBimEdgeMaterial, createVisibilityTexture } from './shaders.js';
import { EDL } from './edl.js';
import { buildBIM, elementAtFace } from './bim.js';
import { buildDriveRoute, Director } from './camera.js';
import { Measure } from './measure.js';
import { buildLevels, buildGridBubbles, SectionBox } from './annotations.js';

const $ = (id) => document.getElementById(id);
const NO_ELEM = 65535;
import { ROWS } from './colormaps.js';

// ---------------------------------------------------------------- renderer / scene
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 1);
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 1, 7000);
camera.position.set(-330, 420, 700);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.target.set(60, 10, 40);
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 4; controls.maxDistance = 3500;
const labelRenderer = new CSS2DRenderer({ element: $('labels') });
const edl = new EDL(renderer, camera);
const director = new Director(camera, controls);
const measure = new Measure(scene);
const sectionBox = new SectionBox();
scene.add(sectionBox.outline);
const lut = buildLut();
const visTex = createVisibilityTexture();
const pointMat = createPointMaterial(lut, visTex);
const bimFaceMat = createBimFaceMaterial(visTex);
const bimEdgeMat = createBimEdgeMaterial(visTex);

const state = {
  site: 'hakozaki', density: 0.4, mode: 0, row: 'lidar', heightMix: 0.15, pointSize: 2.0, gain: 1.0,
  showCloud: true, showBim: false, bimStyle: 'wire', showBuildingsBim: false, showLevels: false, showGrid: false,
  section: false, phase: 1, phasePlaying: false, devRange: 50, selected: -1, measuring: false, edl: true,
  clsHidden: new Set(), isolateRoute: null,
};
let data = null, elements = [], points = null, bim = null, levels = null, grids = null, cloud = null, seqRange = [0, 1];

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  edl.setSize(db.x, db.y);
  pointMat.uniforms.uViewportH.value = db.y;
  pointMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loading
const overlay = $('overlay'), bar = $('bar'), overlayText = $('overlay-text');
function setProgress(p, text) { bar.style.width = `${(p * 100) | 0}%`; if (text) overlayText.textContent = text; }

async function loadSite(key) {
  overlay.classList.remove('hidden');
  setProgress(0.02, 'OSM 由来データを読み込み中…');
  clearSelection(); measure.clear();
  const res = await fetch(`./data/${key}.json`);
  data = await res.json();
  $('site-name').textContent = data.site.nameJa;
  elements = buildStructure(data).elements;
  setProgress(0.08, `構造モデル生成: ${elements.length.toLocaleString()} 要素`);
  await rebuildCloud();
  rebuildBim();
  rebuildAnnotations();
  director.route = buildDriveRoute(data);
  $('drive-name').textContent = director.route ? `${director.route.name}（${(director.route.length / 1000).toFixed(1)} km）` : '—';
  director.s = 0;
  const [cw, ch] = data.site.cropM;
  sectionBox.min.set(-cw / 2, -3, -ch / 2); sectionBox.max.set(cw / 2, 60, ch / 2); sectionBox.update();
  syncSectionSliders();
  overlay.classList.add('hidden');
}

function rebuildCloud() {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./synth.worker.js', import.meta.url), { type: 'module' });
    overlay.classList.remove('hidden');
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'progress') { setProgress(0.1 + m.p * 0.8, 'LiDAR 点群を合成中…'); return; }
      worker.terminate();
      cloud = m;
      if (points) { scene.remove(points); points.geometry.dispose(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
      geo.setAttribute('intensity', new THREE.BufferAttribute(m.inten, 1, true));
      geo.setAttribute('cls', new THREE.BufferAttribute(m.cls, 1, false));
      geo.setAttribute('dev', new THREE.BufferAttribute(m.dev, 1, true));
      geo.setAttribute('elem', new THREE.BufferAttribute(m.elem, 1, false));
      geo.computeBoundingSphere();
      points = new THREE.Points(geo, pointMat);
      points.frustumCulled = false;
      points.visible = state.showCloud;
      scene.add(points);
      let hMax = 0; for (let i = 1; i < m.pos.length; i += 3) if (m.pos[i] > hMax) hMax = m.pos[i];
      pointMat.uniforms.uHMin.value = -2; pointMat.uniforms.uHMax.value = Math.min(hMax, 60);
      $('stat-points').textContent = m.n.toLocaleString();
      $('stat-time').textContent = `${(m.ms / 1000).toFixed(1)} s`;
      setProgress(0.95, 'GPU へ転送中…');
      overlay.classList.add('hidden');
      resolve();
    };
    worker.postMessage({ data, options: { density: state.density, seed: 1 } });
  });
}

function rebuildBim() {
  if (bim) { scene.remove(bim.group); bim.faceGeo.dispose(); bim.edgeGeo.dispose(); }
  const b = buildBIM(elements, { includeBuildings: state.showBuildingsBim });
  const faces = new THREE.Mesh(b.faceGeo, bimFaceMat);
  const edges = new THREE.LineSegments(b.edgeGeo, bimEdgeMat);
  faces.frustumCulled = false; edges.frustumCulled = false;
  const group = new THREE.Group();
  group.add(faces, edges);
  group.visible = state.showBim;
  scene.add(group);
  bim = { ...b, group, faces, edges };
  $('stat-elements').textContent = elements.length.toLocaleString();
  const seqs = elements.filter((e) => e.seq >= 0).map((e) => e.seq);
  seqRange = [Math.min(...seqs), Math.max(...seqs)];
  applyBimStyle();
  applyPhase();
}

function rebuildAnnotations() {
  if (levels) { scene.remove(levels); levels.traverse((o) => o.element && o.element.remove()); }
  if (grids) { scene.remove(grids); grids.traverse((o) => o.element && o.element.remove()); }
  const maxLayer = Math.max(1, ...data.roads.map((r) => r.layer));
  levels = buildLevels(data.site.layerHeight, maxLayer, [data.site.cropM[0] * 0.6, data.site.cropM[1] * 0.6]);
  grids = buildGridBubbles(elements);
  setGroupVisible(levels, state.showLevels); setGroupVisible(grids, state.showGrid);
  scene.add(levels, grids);
}
function setGroupVisible(g, v) { g.visible = v; g.traverse((o) => { o.visible = v; }); }

// ---------------------------------------------------------------- display modes
function applyMode() {
  pointMat.uniforms.uMode.value = state.mode;
  pointMat.uniforms.uRow.value = ROWS[state.row] ?? 0;
  pointMat.uniforms.uHeightMix.value = state.heightMix;
  pointMat.uniforms.uSize.value = state.pointSize;
  pointMat.uniforms.uGain.value = state.gain;
  pointMat.uniforms.uDevRange.value = state.devRange;
  $('row-group').style.display = state.mode <= 1 ? '' : 'none';
  $('mix-group').style.display = state.mode === 0 ? '' : 'none';
  $('dev-group').style.display = state.mode === 4 ? '' : 'none';
  renderLegend();
}
function renderLegend() {
  const el = $('legend');
  const m = state.mode;
  if (m === 0 || m === 1) {
    el.innerHTML = `<div class="legend-title">${m === 0 ? 'LiDAR 反射強度 × 高さ' : '標高'}</div><div class="bar" style="background:${cssGradient(state.row)}"></div><div class="ticks"><span>${m === 0 ? '低反射（舗装）' : '-2 m'}</span><span>${m === 0 ? '高反射（区画線・高欄）' : `${pointMat.uniforms.uHMax.value.toFixed(0)} m`}</span></div>`;
  } else if (m === 2) {
    el.innerHTML = `<div class="legend-title">反射強度（グレースケール）</div><div class="bar" style="background:linear-gradient(90deg,#000,#fff)"></div><div class="ticks"><span>0</span><span>255</span></div>`;
  } else if (m === 3 || m === 5) {
    el.innerHTML = `<div class="legend-title">${m === 3 ? '分類（ASPRS 拡張）' : '疑似カラー（分類ベース）'}</div><div class="swatches">${CLS_INFO.map(([c, n, hex]) => `<label class="sw ${state.clsHidden.has(c) ? 'off' : ''}" data-cls="${c}"><i style="background:#${hex.toString(16).padStart(6, '0')}"></i>${n}</label>`).join('')}</div><div class="hint">クリックで分類ごとに表示／非表示</div>`;
    el.querySelectorAll('.sw').forEach((sw) => sw.addEventListener('click', () => { const c = +sw.dataset.cls; if (state.clsHidden.has(c)) state.clsHidden.delete(c); else state.clsHidden.add(c); applyClsMask(); renderLegend(); }));
  } else if (m === 4) {
    el.innerHTML = `<div class="legend-title">Scan-to-BIM 偏差（設計モデルとの差）</div><div class="bar" style="background:${cssGradient('deviation')}"></div><div class="ticks"><span>−${state.devRange} mm</span><span>0</span><span>+${state.devRange} mm</span></div><div class="hint">構造部材のみ着色。橋脚の傾き・高欄の孕み・桁の沈下を疑似再現</div>`;
  }
}
function applyClsMask() {
  const arr = pointMat.uniforms.uClsMask.value;
  for (let i = 0; i < 32; i++) arr[i] = state.clsHidden.has(i) ? 0 : 1;
}
function applyBimStyle() {
  if (!bim) return;
  const s = state.bimStyle;
  bimFaceMat.uniforms.uUseVertexColor.value = s === 'category' ? 1 : 0;
  bimEdgeMat.uniforms.uUseVertexColor.value = s === 'category' ? 1 : 0;
  bimFaceMat.uniforms.uOpacity.value = s === 'wire' ? 0.05 : s === 'shaded' ? 0.32 : 0.38;
  bimEdgeMat.uniforms.uOpacity.value = s === 'wire' ? 0.85 : s === 'shaded' ? 0.6 : 0.95;
  bim.faces.visible = true;
}
function applyPhase() {
  const t = state.phase;
  const seqMax = t >= 1 ? 1e9 : seqRange[0] + (seqRange[1] - seqRange[0]) * t;
  bimFaceMat.uniforms.uSeqMax.value = seqMax; bimEdgeMat.uniforms.uSeqMax.value = seqMax;
  updateVisibility(seqMax);
  const cat = ['基礎', '橋脚', '横梁', '主桁', '床版', '高欄', '付属物'];
  const idx = Math.min(cat.length - 1, Math.floor((seqMax - seqRange[0]) / 1000));
  $('phase-label').textContent = t >= 1 ? '竣工（全要素）' : `${(t * 100) | 0} % — ${cat[idx]} 施工中`;
}
/** Per-element visibility (4D sequence + route isolation) → R8 texture sampled by all shaders. */
function updateVisibility(seqMax = bimFaceMat.uniforms.uSeqMax.value) {
  const d = visTex.image.data;
  d.fill(255);
  const iso = state.isolateRoute;
  for (const e of elements) {
    let v = true;
    if (e.seq >= 0 && e.seq > seqMax) v = false;
    if (iso && e.route !== iso) v = false;
    if (!v) d[e.id] = 0;
  }
  if (iso) d[NO_ELEM] = 0; // unassigned points (ground, at-grade roads, vegetation) hidden while isolating
  visTex.needsUpdate = true;
  $('isolate-banner').style.display = iso ? '' : 'none';
  $('isolate-name').textContent = iso || '';
}
function isolateRoute(route) { state.isolateRoute = route; updateVisibility(); }

// ---------------------------------------------------------------- section box
function applySection() {
  const planes = state.section ? sectionBox.planes : [];
  for (const m of [pointMat, bimFaceMat, bimEdgeMat]) { m.clippingPlanes = planes; m.needsUpdate = true; }
  sectionBox.outline.visible = state.section;
  $('section-sliders').style.display = state.section ? '' : 'none';
}
function syncSectionSliders() {
  const [cw, ch] = data.site.cropM;
  const cfg = [['sx0', -cw / 2, cw / 2, sectionBox.min.x], ['sx1', -cw / 2, cw / 2, sectionBox.max.x], ['sy0', -5, 60, sectionBox.min.y], ['sy1', -5, 60, sectionBox.max.y], ['sz0', -ch / 2, ch / 2, sectionBox.min.z], ['sz1', -ch / 2, ch / 2, sectionBox.max.z]];
  for (const [id, lo, hi, v] of cfg) { const s = $(id); s.min = lo; s.max = hi; s.value = v; }
}
for (const id of ['sx0', 'sx1', 'sy0', 'sy1', 'sz0', 'sz1']) {
  $(id).addEventListener('input', () => {
    sectionBox.min.set(Math.min(+$('sx0').value, +$('sx1').value - 1), Math.min(+$('sy0').value, +$('sy1').value - 0.5), Math.min(+$('sz0').value, +$('sz1').value - 1));
    sectionBox.max.set(Math.max(+$('sx1').value, +$('sx0').value + 1), Math.max(+$('sy1').value, +$('sy0').value + 0.5), Math.max(+$('sz1').value, +$('sz0').value + 1));
    sectionBox.update();
  });
}

// ---------------------------------------------------------------- selection
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.6;
const pointer = new THREE.Vector2();
let downPos = null;
canvas.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downPos || Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 4) return;
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (state.measuring) {
    const hit = points && points.visible ? raycaster.intersectObject(points, false)[0] : null;
    if (hit) { measure.addPoint(hit.point); toast(measure.pending ? '2 点目をクリック' : `計測: ${(measure.items.at(-1).d).toFixed(3)} m`); }
    return;
  }
  let id = -1;
  if (bim && bim.group.visible) {
    const hit = raycaster.intersectObject(bim.faces, false)[0];
    if (hit) id = elementAtFace(bim.ranges, hit.faceIndex);
  }
  if (id < 0 && points && points.visible) {
    const hit = raycaster.intersectObject(points, false)[0];
    if (hit) { const el = cloud.elem[hit.index]; if (el !== NO_ELEM) id = el; }
  }
  if (id >= 0) select(id); else clearSelection();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { clearSelection(); if (state.measuring) { measure.clear(); } }
});

function select(id) {
  state.selected = id;
  pointMat.uniforms.uSelected.value = id; bimFaceMat.uniforms.uSelected.value = id; bimEdgeMat.uniforms.uSelected.value = id;
  const e = elements[id];
  // scan statistics for this element
  let count = 0, sum = 0, maxAbs = 0;
  if (cloud) for (let i = 0; i < cloud.n; i++) if (cloud.elem[i] === id) { count++; const d = cloud.dev[i] - 128; sum += d; if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d); }
  const expected = expectedPoints(e) * state.density;
  const extra = { count, meanDev: count ? sum / count : null, maxDev: count ? maxAbs : null, coverage: expected > 0 ? Math.min(100, (count / expected) * 100) : null };
  if (e.type === 'footing') extra.note = '地中部材：スキャン未取得（BIM のみ）';
  renderProperties(e, extra);
}
function expectedPoints(e) {
  switch (e.type) {
    case 'deck': return e.length * e.width * 11;
    case 'girder': return e.length * (e.depth * 2.2 * 2 + e.wBot * 1.0 + 2.4);
    case 'railing': return e.length * (e.h * 2 * 6.5 + 18 + 5);
    case 'column': return (e.round ? Math.PI * e.colW : 2 * (e.colW + e.colL)) * (e.yTop - e.yBot) * 7;
    case 'cap': return 2 * (e.w + e.l) * e.h * 5;
    case 'footing': return 2 * (e.w + e.l) * e.h * 5;
    case 'pole': return e.h * 12 + 30;
    case 'gantry': return e.h * 36 + e.w * 34 + 160;
    case 'building': return e.area * 0.4 + e.h * 40;
    default: return 0;
  }
}
function clearSelection() {
  state.selected = -1;
  pointMat.uniforms.uSelected.value = -1; bimFaceMat.uniforms.uSelected.value = -1; bimEdgeMat.uniforms.uSelected.value = -1;
  $('props').classList.add('empty');
  $('props-body').innerHTML = '<p class="muted">点群または BIM 要素をクリックすると、Revit 風のプロパティ（識別情報・拘束・寸法・材料・点群照合）を表示します。</p>';
  $('props-title').textContent = 'プロパティ';
}
function renderProperties(e, extra) {
  const cat = CATEGORY[e.type];
  $('props').classList.remove('empty');
  $('props-title').textContent = `${e.tag} — ${cat.revit}`;
  const groups = elementProperties(e, extra);
  let html = `<div class="type-card"><i style="background:#${cat.color.toString(16).padStart(6, '0')}"></i><div><b>${e.family}</b><span>${e.typeName}</span></div></div>`;
  if (extra.note) html += `<div class="note">${extra.note}</div>`;
  for (const [title, rows] of groups) {
    html += `<details open><summary>${title}</summary><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table></details>`;
  }
  html += `<div class="props-actions"><button id="zoom-sel">要素へズーム</button><button id="iso-sel" ${e.route ? '' : 'disabled'}>路線を分離表示</button></div>`;
  $('props-body').innerHTML = html;
  $('zoom-sel').addEventListener('click', () => zoomTo(e));
  $('iso-sel').addEventListener('click', () => { isolateRoute(state.isolateRoute === e.route ? null : e.route); toast(state.isolateRoute ? `「${e.route}」を分離表示（他要素を非表示）` : '分離表示を解除'); });
}
function zoomTo(e) {
  const bb = elementBounds(e);
  const c = new THREE.Vector3((bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2);
  const size = Math.max(12, Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]));
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  if (dir.y < 0.25) dir.y = 0.35;
  dir.normalize();
  director.setMode('orbit'); setActiveView(null);
  director.flyTo(c.clone().add(dir.multiplyScalar(size * 1.6)), c);
}

// ---------------------------------------------------------------- views
const VIEWS = {
  iso: { pos: [-330, 420, 700], target: [60, 10, 40] },
  top: { pos: [0, 1250, 0.01], target: [0, 0, 0] },
  low: { pos: [-110, 6, 150], target: [20, 16, -20] },
  north: { pos: [40, 260, -640], target: [0, 10, 0] },
};
function setActiveView(name) { document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name)); }
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.view;
  setActiveView(v);
  if (v === 'drive') { director.setMode('drive'); return; }
  if (v === 'fly') { director.setMode('flyover'); return; }
  director.setMode('orbit');
  let d = VIEWS[v];
  if (v === 'low') {
    // look up at the tallest pier group near the junction core
    const cols = elements.filter((e) => e.type === 'column' && e.yTop > 12 && Math.hypot(e.x, e.z) < 260);
    const c = cols.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    if (c) { const nx = -c.tz, nz = c.tx; d = { pos: [c.x - c.tx * 70 + nx * 22, 4, c.z - c.tz * 70 + nz * 22], target: [c.x, c.yTop * 0.75, c.z] }; }
  }
  director.flyTo(new THREE.Vector3(...d.pos), new THREE.Vector3(...d.target));
}));
$('speed').addEventListener('input', (e) => { director.speedKmh = +e.target.value; $('speed-val').textContent = `${e.target.value} km/h`; });

// ---------------------------------------------------------------- UI wiring
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
$('mode').addEventListener('change', (e) => { state.mode = +e.target.value; applyMode(); });
$('row').addEventListener('change', (e) => { state.row = e.target.value; applyMode(); });
$('mix').addEventListener('input', (e) => { state.heightMix = +e.target.value; applyMode(); });
$('psize').addEventListener('input', (e) => { state.pointSize = +e.target.value; applyMode(); });
$('gain').addEventListener('input', (e) => { state.gain = +e.target.value; applyMode(); });
$('devrange').addEventListener('change', (e) => { state.devRange = +e.target.value; applyMode(); });
$('density').addEventListener('change', async (e) => { state.density = +e.target.value; await rebuildCloud(); applyPhase(); });
$('edl').addEventListener('change', (e) => { state.edl = e.target.checked; edl.enabled = state.edl; });
$('edl-strength').addEventListener('input', (e) => { edl.strength = +e.target.value; });
$('show-cloud').addEventListener('change', (e) => { state.showCloud = e.target.checked; if (points) points.visible = state.showCloud; });
$('show-bim').addEventListener('change', (e) => { state.showBim = e.target.checked; if (bim) bim.group.visible = state.showBim; });
$('bim-style').addEventListener('change', (e) => { state.bimStyle = e.target.value; applyBimStyle(); });
$('show-bldg').addEventListener('change', (e) => { state.showBuildingsBim = e.target.checked; rebuildBim(); });
$('show-levels').addEventListener('change', (e) => { state.showLevels = e.target.checked; if (levels) setGroupVisible(levels, state.showLevels); });
$('show-grid').addEventListener('change', (e) => { state.showGrid = e.target.checked; if (grids) setGroupVisible(grids, state.showGrid); });
$('section').addEventListener('change', (e) => { state.section = e.target.checked; applySection(); });
$('phase').addEventListener('input', (e) => { state.phase = +e.target.value / 100; applyPhase(); });
$('phase-play').addEventListener('click', () => { state.phasePlaying = !state.phasePlaying; $('phase-play').textContent = state.phasePlaying ? '⏸ 停止' : '▶ 再生'; if (state.phasePlaying && state.phase >= 1) state.phase = 0; });
$('measure').addEventListener('click', () => { state.measuring = !state.measuring; $('measure').classList.toggle('active', state.measuring); canvas.style.cursor = state.measuring ? 'crosshair' : ''; toast(state.measuring ? '計測モード：点群上の 2 点をクリック（Esc で解除）' : '計測モード終了'); if (!state.measuring) measure.pending = null; });
$('measure-clear').addEventListener('click', () => measure.clear());
$('site').addEventListener('change', (e) => { state.site = e.target.value; state.isolateRoute = null; loadSite(state.site); });
$('isolate-reset').addEventListener('click', () => isolateRoute(null));
$('panel-toggle').addEventListener('click', () => document.body.classList.toggle('panel-collapsed'));
$('props-close').addEventListener('click', clearSelection);
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));

function applyPreset(name) {
  const set = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(el.type === 'range' ? 'input' : 'change')); };
  if (name === 'lidar') { set('mode', 0); set('row', 'lidar'); set('mix', 0.15); set('gain', 1.0); set('show-bim', false); set('show-levels', false); set('show-grid', false); set('edl', true); }
  if (name === 'mono') { set('mode', 2); set('gain', 1.0); set('show-bim', false); set('show-levels', false); set('show-grid', false); set('edl', true); }
  if (name === 'bim') { set('mode', 2); set('gain', 0.7); set('show-bim', true); set('bim-style', 'category'); set('show-levels', true); set('show-grid', true); }
  if (name === 'scan2bim') { set('mode', 4); set('gain', 1.0); set('show-bim', true); set('bim-style', 'wire'); set('show-levels', false); set('show-grid', true); }
  if (name === 'xray') { set('mode', 0); set('gain', 1.0); set('row', 'magma'); set('show-bim', true); set('bim-style', 'shaded'); set('show-bldg', true); set('mix', 0.55); }
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
}

// ---------------------------------------------------------------- loop
let last = performance.now(), frames = 0, fpsT = last;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.phasePlaying) { state.phase = Math.min(1, state.phase + dt * 0.06); $('phase').value = state.phase * 100; applyPhase(); if (state.phase >= 1) { state.phasePlaying = false; $('phase-play').textContent = '▶ 再生'; } }
  director.update(dt);
  if (grids && state.showGrid) { const cp = camera.position; for (const o of grids.children) if (o.element) { const d = cp.distanceTo(o.position); o.element.style.display = d < 420 ? '' : 'none'; o.element.style.opacity = d < 300 ? 1 : 1 - (d - 300) / 120; } }
  if (director.mode === 'drive') $('drive-progress').style.width = `${director.progress * 100}%`;
  edl.render(scene);
  labelRenderer.render(scene, camera);
  frames++;
  if (now - fpsT > 1000) { $('stat-fps').textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps`; frames = 0; fpsT = now; }
}

// debugging / automation hooks
window.__app = { select, clearSelection, zoomTo, applyPreset, isolateRoute, get elements() { return elements; }, get cloud() { return cloud; }, camera, controls, director, state };

resize();
applyMode(); applyClsMask(); applySection(); clearSelection();
loadSite(state.site).then(() => { requestAnimationFrame(loop); toast('ドラッグで回転・ホイールでズーム・クリックで要素選択', 5000); });
