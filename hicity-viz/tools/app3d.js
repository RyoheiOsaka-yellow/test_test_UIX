import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildStations } from './stations_build.js';
import { buildArea, buildGsiTiles } from './area_build.js';

const D = window.__HIC;
const AREA = window.__AREA || {};
const $ = id => document.getElementById(id);

/* ---------------- coordinate helpers ---------------- */
const fit = D.fit;
const TH = fit.theta * Math.PI / 180, CT = Math.cos(TH), ST = Math.sin(TH);
function toLocal(lon, lat) {
  const x = (lon - fit.lon_c) * fit.mlon;
  const y = (lat - fit.lat_c) * fit.mlat;
  return [CT * x - ST * y + fit.dx, ST * x + CT * y + fit.dy];
}
// world: X = local x, Z = -local y, Y = up
const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

/* ---------------- constants ---------------- */
const FLOORS = [
  { fi: -1, key: '-1', label: 'B1F', z: 2.6 * -1, color: 0x8a7fff, storey: 'Fndn' },
  { fi: 0, key: '0', label: '1F', z: 0.15, color: 0x00e5ff, storey: '1FL' },
  { fi: 1, key: '1', label: '2F', z: 5.95, color: 0x35e0a1, storey: '2FL' },
  { fi: 2, key: '2', label: '3F', z: 11.45, color: 0xffd166, storey: '3FL' },
  { fi: 3, key: '3', label: 'RF', z: 15.95, color: 0xff7fb2, storey: 'RFL' },
];
const GROUPS = {
  staff: { label: 'スタッフ', color: 0x4da3ff },
  visitor: { label: 'ビジター', color: 0xff9a4d },
  robot: { label: 'ロボット', color: 0x35e0a1 },
  mobility: { label: 'モビリティ', color: 0xffe066 },
};
const SCENARIOS = {
  s2020: { label: '2020 実測', clones: 0, idx: 100, dwell: 42.4, vis: '実証実験期', econ: null },
  low: { label: '2026 低位', clones: 1, idx: 220, dwell: 55, vis: '約120万人/年', econ: 59 },
  mid: { label: '2026 中位', clones: 2, idx: 320, dwell: 64, vis: '約180万人/年', econ: 89 },
  high: { label: '2026 高位', clones: 4, idx: 460, dwell: 76, vis: '約260万人/年', econ: 128 },
};

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const BG_NORMAL = new THREE.Color(0x04050c), BG_BLUE = new THREE.Color(0x081b33);
scene.background = BG_NORMAL.clone();
scene.fog = new THREE.Fog(0x04050c, 3000, 22000);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 60000);
const CENTER = W(60, -20, 0);
camera.position.set(CENTER.x + 30, 300, CENTER.z + 310);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CENTER);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 20; controls.maxDistance = 16000;

scene.add(new THREE.AmbientLight(0xffffff, 1.0));

/* ---------------- ground & context ---------------- */
const context = new THREE.Group(); scene.add(context);
{
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000),
    new THREE.MeshBasicMaterial({ color: 0x060a14 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -0.8; context.add(g);
  const grid = new THREE.GridHelper(20000, 100, 0x0d1a30, 0x0a1425);
  grid.position.y = -0.7; context.add(grid);
}
function lineFromLonLat(pts, color, opacity, dashed) {
  const v = [];
  for (const [lon, lat] of pts) { const [x, y] = toLocal(lon, lat); v.push(W(x, y, 0.2)); }
  const geo = new THREE.BufferGeometry().setFromPoints(v);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, opacity, transparent: true, dashSize: 6, gapSize: 5 })
    : new THREE.LineBasicMaterial({ color, opacity, transparent: true });
  const ln = new THREE.Line(geo, mat);
  if (dashed) ln.computeLineDistances();
  return ln;
}
function labelSprite(text, color, scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = '600 26px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 22;
  c.width = w; c.height = 40;
  const ctx2 = c.getContext('2d');
  ctx2.font = '600 26px system-ui, sans-serif';
  ctx2.fillStyle = 'rgba(4,8,18,0.55)';
  ctx2.beginPath(); ctx2.roundRect(0, 0, w, 40, 8); ctx2.fill();
  ctx2.fillStyle = color;
  ctx2.fillText(text, 11, 29);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(w / 40 * 7 * scale, 7 * scale, 1);
  return sp;
}
{
  // バス経路(模式)のみ残す — 鉄道は駅構造レイヤーの3Dプロファイル線で表示
  const bus = [[139.7160, 35.5624], [139.7333, 35.5553], [139.7419, 35.5520], [139.7546, 35.5488], [139.7690, 35.5450]];
  context.add(lineFromLonLat(bus, 0xffd94d, 0.4, true));
  const hicSp = labelSprite('HANEDA INNOVATION CITY', '#00e5ff', 1.15);
  hicSp.position.copy(CENTER.clone().setY(46)); context.add(hicSp);
}

/* ---------------- 周辺エリア(大田区全域 OSM) ---------------- */
const areaLayers = buildArea(AREA, W);
for (const k of Object.keys(areaLayers)) scene.add(areaLayers[k]);
let gsiLoaded = false;
function ensureGsi() {
  if (gsiLoaded) return; gsiLoaded = true;
  buildGsiTiles(areaLayers.gsi, { toLocal, W, TH, lonC: fit.lon_c, latC: fit.lat_c });
}

/* ---------------- 駅構造 + 路線3D + 新空港線(構想) ---------------- */
const ST3D = buildStations(toLocal, W, labelSprite);
scene.add(ST3D.group, ST3D.futureGroup, ST3D.railGroup);

/* カメラ フライト */
let flyTween = null;
function flyTo(target, dist, dur = 1400) {
  let dirXZ = camera.position.clone().sub(controls.target).setY(0);
  if (dirXZ.lengthSq() < 1) dirXZ.set(0.3, 0, 1);
  dirXZ.normalize();
  flyTween = {
    t0: performance.now(), dur,
    fromT: controls.target.clone(), toT: target.clone(),
    fromP: camera.position.clone(),
    toP: target.clone().addScaledVector(dirXZ, dist * 0.85).add(new THREE.Vector3(0, dist * 0.6, 0)),
  };
}
function updateFly(now) {
  if (!flyTween) return;
  let k = (now - flyTween.t0) / flyTween.dur;
  if (k >= 1) k = 1;
  const e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;
  controls.target.lerpVectors(flyTween.fromT, flyTween.toT, e);
  camera.position.lerpVectors(flyTween.fromP, flyTween.toP, e);
  if (k === 1) flyTween = null;
}

/* ---------------- floors: plans + heat ---------------- */
const floorRoots = {};              // fi -> Group (position.y animated)
const fillMats = [], lineMatsByFloor = {};
const heatMeshes = [];              // {mesh, fi, g}
for (const F of FLOORS) { const gr = new THREE.Group(); floorRoots[F.fi] = gr; scene.add(gr); }

function addRingLines(root, rings, color, opacity) {
  const verts = [];
  for (const ring of rings)
    for (let i = 0; i + 1 < ring.length; i++) {
      verts.push(ring[i][0], 0, -ring[i][1], ring[i + 1][0], 0, -ring[i + 1][1]);
    }
  if (!verts.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const ls = new THREE.LineSegments(geo, mat);
  root.add(ls); return ls;
}
for (const F of FLOORS) {
  const root = floorRoots[F.fi];
  for (const bk of Object.keys(D.plans)) {
    const st = D.plans[bk].storeys[F.storey];
    if (!st) continue;
    // slab fills
    const slab = st.slab || [];
    for (const ring of slab) {
      const shape = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], -p[1])));
      const mat = new THREE.MeshBasicMaterial({
        color: F.color, transparent: true, opacity: 0.06,
        side: THREE.DoubleSide, depthWrite: false,
      });
      fillMats.push(mat);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -0.05;
      root.add(mesh);
    }
    const l1 = addRingLines(root, slab, F.color, 0.65);
    const l2 = addRingLines(root, st.wall || [], F.color, 0.5);
    const l3 = addRingLines(root, st.glass || [], 0x27c8e8, 0.55);
    const l4 = addRingLines(root, st.stair || [], 0xffb648, 0.7);
    (lineMatsByFloor[F.fi] ||= []).push(...[l1, l2, l3, l4].filter(Boolean).map(l => l.material));
  }
}

/* heat cells */
const heatRamp = t => {
  const a = new THREE.Color(0x0a3a66), b = new THREE.Color(0x00b7d9), c = new THREE.Color(0xffc94d);
  return t < 0.6 ? a.clone().lerp(b, t / 0.6) : b.clone().lerp(c, (t - 0.6) / 0.4);
};
{
  const cell = D.heat.cell;
  const box = new THREE.BoxGeometry(cell * 0.92, 0.3, cell * 0.92);
  for (const F of FLOORS) {
    const byG = D.heat.heat[F.key]; if (!byG) continue;
    for (const g of Object.keys(byG)) {
      const cells = byG[g];
      let max = 1; for (const c of cells) max = Math.max(max, c[2]);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false });
      const im = new THREE.InstancedMesh(box, mat, cells.length);
      const m4 = new THREE.Matrix4();
      cells.forEach((c, i) => {
        m4.setPosition((c[0] + 0.5) * cell, 0.35, -(c[1] + 0.5) * cell);
        im.setMatrixAt(i, m4);
        im.setColorAt(i, heatRamp(Math.log(1 + c[2]) / Math.log(1 + max)));
      });
      im.userData = { cells, g, fl: F.label };
      floorRoots[F.fi].add(im);
      heatMeshes.push({ mesh: im, fi: F.fi, g });
    }
  }
}

/* ---------------- trajectories replay ---------------- */
const tags = Object.entries(D.traj).map(([uid, d]) => ({ uid, g: d.g, n: d.n, p: d.p, ptr: 0 }));
const CLONE_MAX = 4;
const partSystems = {};   // g -> {points, base:[tagIdx...], clones:[{tag, dx,dy,dt}...]}
{
  const rng = mulberry(42);
  for (const g of Object.keys(GROUPS)) {
    const gTags = tags.map((t, i) => t.g === g ? i : -1).filter(i => i >= 0);
    const clones = [];
    for (const ti of gTags) {
      if (g !== 'visitor') continue;
      for (let k = 0; k < CLONE_MAX; k++) {
        const ang = rng() * Math.PI * 2, dist = 2.5 + rng() * 9;
        clones.push({ ti, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, dt: (rng() - 0.5) * 5400, k });
      }
    }
    const n = gTags.length + clones.length;
    const pos = new Float32Array(n * 3).fill(-9999);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: GROUPS[g].color, size: 4.2, transparent: true, opacity: 1,
      map: dotTexture(), alphaTest: 0.15, depthWrite: false, sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    partSystems[g] = { points: pts, base: gTags, clones };
  }
}
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c); return tex;
}
function samplePos(tag, t, out) {
  // advance/rewind pointer, binary-ish
  const p = tag.p;
  if (!p.length || t < p[0][0] - 90 || t > p[p.length - 1][0] + 90) return false;
  let i = tag.ptr;
  if (i >= p.length) i = p.length - 1;
  while (i > 0 && p[i][0] > t) i--;
  while (i + 1 < p.length && p[i + 1][0] <= t) i++;
  tag.ptr = i;
  const a = p[i], b = p[Math.min(i + 1, p.length - 1)];
  const gap = b[0] - a[0];
  if (t < a[0]) { if (a[0] - t > 90) return false; out.x = a[1] / 10; out.y = a[2] / 10; out.fl = a[3]; return true; }
  if (gap > 150 && t > a[0] + 90) return false;   // away from site
  let x, y, fl;
  if (gap > 0 && t <= b[0] && a[3] === b[3]) {
    const u = (t - a[0]) / gap;
    x = (a[1] + (b[1] - a[1]) * u) / 10; y = (a[2] + (b[2] - a[2]) * u) / 10; fl = a[3];
  } else { x = a[1] / 10; y = a[2] / 10; fl = a[3]; }
  out.x = x; out.y = y; out.fl = fl; return true;
}

/* ---------------- state & UI ---------------- */
const state = {
  floors: Object.fromEntries(FLOORS.map(F => [F.fi, true])),
  groups: Object.fromEntries(Object.keys(GROUPS).map(g => [g, true])),
  heatOn: true, plansOn: true, fillOn: true, contextOn: true,
  expand: 1.0, blueprint: false, rotate: false,
  scenario: 's2020',
  playing: true, speed: 240, simT: 9.5 * 3600,
  area: { bld: true, roads: true, osmrail: true, water: true, aero: true, boundary: true, gsi: true },
  stations: true, rail3d: true, future: true,
};

function applyVisibility() {
  for (const F of FLOORS) floorRoots[F.fi].visible = state.floors[F.fi];
  for (const { mesh, g } of heatMeshes)
    mesh.visible = state.heatOn && state.groups[g];
  for (const fi of Object.keys(lineMatsByFloor))
    for (const m of lineMatsByFloor[fi]) m.visible = state.plansOn;
  // fills
  for (const m of fillMats) m.opacity = (!state.fillOn || state.blueprint) ? 0 : 0.06;
  context.visible = state.contextOn;
  for (const k of Object.keys(state.area)) areaLayers[k].visible = state.area[k];
  ST3D.group.visible = state.stations;
  ST3D.railGroup.visible = state.rail3d;
  ST3D.futureGroup.visible = state.future;
}
function applyExpand() {
  for (const F of FLOORS)
    floorRoots[F.fi].position.y = Math.max(F.z, -2.6) * state.expand + (F.fi === -1 ? 0 : 0);
  $('expand-value').textContent = '×' + state.expand.toFixed(2);
}
function applyBlueprint() {
  scene.background.copy(state.blueprint ? BG_BLUE : BG_NORMAL);
  scene.fog.color.copy(scene.background);
  $('btn-blueprint').classList.toggle('active', state.blueprint);
  applyVisibility();
}
function applyScenario() {
  const sc = SCENARIOS[state.scenario];
  document.querySelectorAll('#scenario-row button').forEach(b =>
    b.classList.toggle('active', b.dataset.sc === state.scenario));
  $('st-idx').textContent = sc.idx;
  $('st-dwell').textContent = sc.dwell + ' 分';
  $('st-vis').textContent = sc.vis;
  $('st-econ').textContent = sc.econ ? '約' + sc.econ + ' 億円/年' : '—';
  $('stats-note').textContent = state.scenario === 's2020'
    ? 'K-field実測(2020/9/18) タグ装着者のみの計測'
    : '推計シナリオ: ビジター粒子を複製表示(オレンジ)。指数・滞在・波及はモデル試算';
}

/* particle update */
const tmp = {};
function updateParticles() {
  const t = state.simT;
  const sc = SCENARIOS[state.scenario];
  const counts = { staff: 0, visitor: 0, robot: 0, mobility: 0 };
  for (const g of Object.keys(partSystems)) {
    const sys = partSystems[g];
    const arr = sys.points.geometry.attributes.position.array;
    const on = state.groups[g];
    let w = 0;
    for (const ti of sys.base) {
      const tag = tags[ti];
      let ok = on && samplePos(tag, t, tmp) && state.floors[tmp.fl];
      if (ok) {
        const yb = Math.max(FLOORS.find(F => F.fi === tmp.fl).z, -2.6) * state.expand;
        arr[w++] = tmp.x; arr[w++] = yb + 1.2; arr[w++] = -tmp.y;
        counts[g]++;
      } else { arr[w++] = 0; arr[w++] = -9999; arr[w++] = 0; }
    }
    for (const cl of sys.clones) {
      const tag = tags[cl.ti];
      let ok = on && cl.k < sc.clones && samplePos(tag, t + cl.dt, tmp) && state.floors[tmp.fl];
      if (ok) {
        const yb = Math.max(FLOORS.find(F => F.fi === tmp.fl).z, -2.6) * state.expand;
        arr[w++] = tmp.x + cl.dx; arr[w++] = yb + 1.2; arr[w++] = -tmp.y - cl.dy;
        counts[g]++;
      } else { arr[w++] = 0; arr[w++] = -9999; arr[w++] = 0; }
    }
    sys.points.geometry.attributes.position.needsUpdate = true;
  }
  const hh = String(Math.floor(t / 3600)).padStart(2, '0');
  const mm = String(Math.floor(t % 3600 / 60)).padStart(2, '0');
  $('clock').textContent = `${hh}:${mm}`;
  $('time-slider').value = t;
  $('cnt-staff').textContent = counts.staff;
  $('cnt-visitor').textContent = counts.visitor;
  $('cnt-robot').textContent = counts.robot;
  $('cnt-mobility').textContent = counts.mobility;
}

/* ---------------- panel wiring ---------------- */
{
  // floor rows
  const fl = $('floor-list');
  for (const F of [...FLOORS].reverse()) {
    const heat = D.heat.heat[F.key] || {};
    const nc = Object.values(heat).reduce((a, v) => a + v.length, 0);
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<input type="checkbox" checked data-fi="${F.fi}">
      <span class="chip" style="background:#${F.color.toString(16).padStart(6, '0')}"></span>
      ${F.label}<span class="floor-count">${nc ? nc + ' セル' : ''}</span>`;
    row.querySelector('input').addEventListener('change', e => {
      state.floors[F.fi] = e.target.checked; applyVisibility();
    });
    fl.appendChild(row);
  }
  // group rows
  const gl = $('group-list');
  for (const [g, info] of Object.entries(GROUPS)) {
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<input type="checkbox" checked>
      <span class="chip" style="background:#${info.color.toString(16).padStart(6, '0')}"></span>
      ${info.label}<span class="floor-count" id="cnt-${g}">0</span>`;
    row.querySelector('input').addEventListener('change', e => {
      state.groups[g] = e.target.checked; applyVisibility();
    });
    gl.appendChild(row);
  }
  $('chk-heat').addEventListener('change', e => { state.heatOn = e.target.checked; applyVisibility(); });
  $('chk-plan').addEventListener('change', e => { state.plansOn = e.target.checked; applyVisibility(); });
  $('chk-fill').addEventListener('change', e => { state.fillOn = e.target.checked; applyVisibility(); });
  $('chk-ctx').addEventListener('change', e => { state.contextOn = e.target.checked; applyVisibility(); });
  $('floor-expand').addEventListener('input', e => { state.expand = +e.target.value; applyExpand(); });
  $('btn-blueprint').addEventListener('click', () => { state.blueprint = !state.blueprint; applyBlueprint(); });
  $('chk-rotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; });
  controls.autoRotateSpeed = 0.8;
  $('btn-reset').addEventListener('click', () => {
    camera.position.set(CENTER.x + 30, 300, CENTER.z + 310);
    controls.target.copy(CENTER);
  });
  $('btn-all').addEventListener('click', () => {
    for (const F of FLOORS) state.floors[F.fi] = true;
    document.querySelectorAll('#floor-list input').forEach(i => i.checked = true);
    applyVisibility();
  });
  $('btn-none').addEventListener('click', () => {
    for (const F of FLOORS) state.floors[F.fi] = false;
    document.querySelectorAll('#floor-list input').forEach(i => i.checked = false);
    applyVisibility();
  });
  // playback
  $('btn-play').addEventListener('click', () => {
    state.playing = !state.playing;
    $('btn-play').textContent = state.playing ? '⏸ 一時停止' : '▶ 再生';
  });
  document.querySelectorAll('#speed-row button').forEach(b =>
    b.addEventListener('click', () => {
      state.speed = +b.dataset.v;
      document.querySelectorAll('#speed-row button').forEach(x => x.classList.toggle('active', x === b));
    }));
  $('time-slider').addEventListener('input', e => {
    state.simT = +e.target.value;
    for (const tg of tags) tg.ptr = 0;
    updateParticles();
  });
  document.querySelectorAll('#scenario-row button').forEach(b =>
    b.addEventListener('click', () => { state.scenario = b.dataset.sc; applyScenario(); }));

  // 周辺エリアレイヤー
  for (const [id, key] of [['chk-a-bld', 'bld'], ['chk-a-roads', 'roads'], ['chk-a-rail', 'osmrail'],
                           ['chk-a-water', 'water'], ['chk-a-aero', 'aero'], ['chk-a-bnd', 'boundary'],
                           ['chk-a-gsi', 'gsi']]) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener('change', e => {
      state.area[key] = e.target.checked;
      if (key === 'gsi' && e.target.checked) ensureGsi();
      applyVisibility();
    });
  }
  $('chk-stations')?.addEventListener('change', e => { state.stations = e.target.checked; applyVisibility(); });
  $('chk-rail3d')?.addEventListener('change', e => { state.rail3d = e.target.checked; applyVisibility(); });
  $('chk-future')?.addEventListener('change', e => { state.future = e.target.checked; applyVisibility(); });

  // 駅フライト
  const fr = $('fly-row');
  if (fr) {
    const items = [['hic', 'HICity'], ['tenkubashi', '天空橋'], ['hnd-t3', '空港T3'], ['hnd-t12', '空港T1・T2'],
                   ['keikyu-kamata', '京急蒲田'], ['kamata', '蒲田'], ['otorii', '大鳥居'], ['omori', '大森'], ['oimachi', '大井町']];
    fr.innerHTML = items.map(([id, l]) => `<button data-fly="${id}">${l}</button>`).join('');
    fr.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.fly === 'hic') { flyTo(CENTER, 380); return; }
      const t = ST3D.flyTargets[b.dataset.fly];
      if (t) flyTo(t.pos, 420);
    }));
  }
  $('bld-count') && ($('bld-count').textContent =
    (areaLayers.bld.userData.count ? Math.round(areaLayers.bld.children[0].geometry.attributes.position.count / 1000) + 'k点' : ''));
}

/* ---------------- click-to-fly (駅・新線の構造をクリックで接近) ---------------- */
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let downXY = null;
renderer.domElement.addEventListener('pointerdown', ev => { downXY = [ev.clientX, ev.clientY]; });
renderer.domElement.addEventListener('pointerup', ev => {
  if (!downXY) return;
  const moved = Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]);
  downXY = null;
  if (moved > 6 || !state.stations) return;
  mouse.x = ev.clientX / innerWidth * 2 - 1;
  mouse.y = -(ev.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(ST3D.pickables, false);
  if (hits.length && hits[0].object.userData.flyPos) {
    const o = hits[0].object;
    flyTo(o.userData.flyPos, 320);
  }
});

/* ---------------- tooltip on heat cells ---------------- */
let ttTimer = null;
addEventListener('pointermove', ev => {
  mouse.x = ev.clientX / innerWidth * 2 - 1;
  mouse.y = -(ev.clientY / innerHeight) * 2 + 1;
  if (ttTimer) return;
  ttTimer = setTimeout(() => {
    ttTimer = null;
    const tt = $('tooltip');
    if (!state.heatOn) { tt.style.display = 'none'; return; }
    ray.setFromCamera(mouse, camera);
    // 駅構造・新空港線
    if (state.stations || state.future) {
      const objs = [...(state.stations ? ST3D.pickables : [])];
      if (state.future) objs.push(...ST3D.futureGroup.children.filter(o => o.userData.info));
      ray.params.Line = { threshold: 8 };
      const sh = ray.intersectObjects(objs, false);
      if (sh.length) {
        const info = sh[0].object.userData.info;
        tt.innerHTML = `<span class="tt-floor">${info.future ? '構想・未開業' : '駅構造'}</span>` +
          `<b>${info.station}</b><br>${info.level}${info.desc ? '<br><span style="color:#8fa8c8">' + info.desc + '</span>' : ''}`;
        tt.style.left = ev.clientX + 'px'; tt.style.top = ev.clientY + 'px';
        tt.style.display = 'block';
        return;
      }
    }
    if (!state.heatOn) { tt.style.display = 'none'; return; }
    const vis = heatMeshes.filter(h => h.mesh.visible && floorRoots[h.fi].visible).map(h => h.mesh);
    const hits = ray.intersectObjects(vis, false);
    if (hits.length && hits[0].instanceId != null) {
      const m = hits[0].object, id = hits[0].instanceId;
      const c = m.userData.cells[id];
      const hrs = (c[2] / 3600).toFixed(1);
      tt.innerHTML = `<span class="tt-floor">${m.userData.fl}</span>${GROUPS[m.userData.g].label} 延べ ${hrs} 時間`;
      tt.style.left = ev.clientX + 'px'; tt.style.top = ev.clientY + 'px';
      tt.style.display = 'block';
    } else tt.style.display = 'none';
  }, 40);
});

/* ---------------- loop ---------------- */
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (state.playing) {
    state.simT += dt * state.speed;
    if (state.simT > 86400) state.simT -= 86400;
  }
  updateParticles();
  updateFly(now);
  controls.update();
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

applyVisibility(); applyExpand(); applyScenario();
if (state.area.gsi) ensureGsi();
$('loading').style.display = 'none';
requestAnimationFrame(loop);
