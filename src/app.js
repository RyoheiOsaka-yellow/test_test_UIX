/* ============================================================
   XBUILD — app.js（ブラウザ エントリ）
   シーン層 + データフロー層 + three.js r128 ビューア
   ============================================================ */

'use strict';

const { Graph } = require('./cook');
const { reg } = require('./site_nodes');
const { SceneStore } = require('./scene');

if (typeof THREE.ColorManagement !== 'undefined') THREE.ColorManagement.enabled = false;

/* ============================================================
   1. データフロー グラフの構築（すべて実データ）
   ============================================================ */

/* --- PLATEAU LOD1 の実建物 --- */
const cityGraph = new Graph(reg);
cityGraph.add('sitectx', { radius: 600, minHeight: 0, useMh: 0 }, 'ctx1');
cityGraph.add('snippet', {
  class: 'prim',
  code: '// prim 単位。@height @usage @storeys @year @mhDelta が使える\n// 例: 5m 未満を持ち上げて見やすくする\n// @height = Math.max(@height, 5);',
}, 'cityw');
cityGraph.connect('ctx1', 'cityw', 0);
cityGraph.displayNode = 'cityw';

/* --- 計画アリーナ（公表値ベースのマッシング） --- */
const arenaGraph = new Graph(reg);
arenaGraph.add('arena', {}, 'arena1');
arenaGraph.add('snippet', {
  class: 'point',
  code: '// point 単位。@Time を書くと自動で時間依存になる',
}, 'aw');
arenaGraph.add('attribconvert', {
  class: 'point', name: 'P', type: 'float', component: 2, outName: 'zh',
}, 'azh');
arenaGraph.connect('arena1', 'aw', 0);
arenaGraph.connect('aw', 'azh', 0);
arenaGraph.displayNode = 'azh';

/* --- 道路網とその上を歩く人流（時間依存） --- */
const flowGraph = new Graph(reg);
// demand: 駅・外周から会場へ集まる流入モデル（§21）。window/speed はデモで観察しやすい値
flowGraph.add('roadagents', { mode: 'demand', count: 900, window: 300, speed: 2.0, deck: 0 }, 'agents1');
flowGraph.add('heatmap', { cell: 22, extent: 600, lift: 0.6 }, 'heat1');
flowGraph.connect('agents1', 'heat1', 0);
flowGraph.displayNode = 'heat1';

const roadGraph = new Graph(reg);
roadGraph.add('siteroads', { walkableOnly: 1, lift: 0.25 }, 'roads1');
roadGraph.displayNode = 'roads1';

const lmGraph = new Graph(reg);
lmGraph.add('landmarks', { height: 46 }, 'lm1');
lmGraph.displayNode = 'lm1';

/* ============================================================
   2. シーン層
   ============================================================ */

const store = new SceneStore();
store.add('site', 'site', { name: '東静岡 アリーナ予定地' });
store.add('city', 'geo', {
  name: '文脈建物 PLATEAU LOD1', parentId: 'site',
  payload: { graph: cityGraph, displayNode: 'cityw', colorBy: 'height', ramp: 'cool' },
  style: { surface: true, opacity: 0.95 },
});
store.add('arena', 'geo', {
  name: 'アリーナ 計画マッシング', parentId: 'site',
  payload: { graph: arenaGraph, displayNode: 'azh', colorBy: 'zh', ramp: 'yellow' },
  style: { surface: true, opacity: 0.92 },
});
store.add('roads', 'geo', {
  name: '道路網 OSM', parentId: 'site',
  payload: { graph: roadGraph, displayNode: 'roads1', baseColor: [0.32, 0.36, 0.42] },
  style: { lines: true },
});
store.add('heat', 'geo', {
  name: '滞留ヒートマップ', parentId: 'site',
  payload: { graph: flowGraph, displayNode: 'heat1', colorBy: 'density', ramp: 'heat' },
  style: { surface: true, opacity: 0.5 },
});
store.add('agents', 'geo', {
  name: '人流エージェント', parentId: 'site',
  payload: { graph: flowGraph, displayNode: 'agents1', colorBy: 'toVenue', ramp: 'heat' },
  style: { points: true, pointSize: 2.8 },
});
store.add('lm', 'geo', {
  name: 'ランドマーク', parentId: 'site',
  payload: { graph: lmGraph, displayNode: 'lm1', baseColor: [0.95, 0.78, 0.35] },
  style: { lines: true },
});

/* ============================================================
   3. three.js ビューア
   ============================================================ */

const canvasWrap = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
/* 静的シャドウマップ（P6.5）: 毎フレームではなく、レイヤ再構築時にだけ描き直す */
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
canvasWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1013);
scene.fog = new THREE.Fog(0x0e1013, 700, 1900);

const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 4000);
camera.up.set(0, 0, 1);

scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x1a1c20, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d0, 0.85);
sun.position.set(240, -360, 520);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -700; sun.shadow.camera.right = 700;
sun.shadow.camera.top = 700; sun.shadow.camera.bottom = -700;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 1600;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);

const grid = new THREE.GridHelper(1400, 28, 0x2b3038, 0x1b1f25);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

/* 影の受け皿（PlaneGeometry は XY 面 = この座標系の地面） */
const groundShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1400, 1400),
  new THREE.ShadowMaterial({ opacity: 0.32 }),
);
groundShadow.receiveShadow = true;
groundShadow.userData.aux = true;
scene.add(groundShadow);

const groups = {};
const updateStats = { inPlace: 0, rebuilt: 0 };   // 差分更新 / 全再構築の回数（P6.5）

/** 不透明に近いサーフェスだけが影を落とす（半透明ヒートマップの影は不自然） */
function castsShadow(node) {
  return !!node.style.surface && (node.style.opacity || 1) >= 0.9;
}

function makeSurface(bufs, style, shadow) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(bufs.tris.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(bufs.tris.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(bufs.tris.color, 3));
  const m = new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide,
    transparent: (style.opacity || 1) < 1, opacity: style.opacity || 1,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.role = 'surface';
  mesh.userData.primId = bufs.tris.primId;   // ピッキング用（三角形 -> プリム）
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  return mesh;
}

function makePoints(bufs, style) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(bufs.points.position, 3));
  g.setAttribute('color', new THREE.BufferAttribute(bufs.points.color, 3));
  const m = new THREE.PointsMaterial({ size: style.pointSize || 2, vertexColors: true, sizeAttenuation: false });
  const p = new THREE.Points(g, m);
  p.userData.role = 'points';
  return p;
}

function makeLines(bufs, style) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(bufs.lines.position, 3));
  if (bufs.lines.color) g.setAttribute('color', new THREE.BufferAttribute(bufs.lines.color, 3));
  const m = new THREE.LineBasicMaterial({ vertexColors: !!bufs.lines.color });
  const l = new THREE.LineSegments(g, m);
  l.userData.role = 'lines';
  return l;
}

function disposeGroup(id) {
  if (!groups[id]) return;
  groups[id].traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  scene.remove(groups[id]);
  delete groups[id];
}

/* ---------- 差分更新（P6.5） ----------
   頂点数が前回と一致する限り BufferGeometry を作り直さず、
   属性配列を上書きして needsUpdate を立てるだけにする。
   人流エージェント（毎フレーム 900 点）はこの経路に乗る。 */

function roleSig(node, bufs) {
  return (node.style.surface && bufs.tris.count ? 's' : '') +
         (node.style.points && bufs.points.count ? 'p' : '') +
         (node.style.lines && bufs.lines.count ? 'l' : '');
}

function updateAttr(geom, name, arr) {
  const a = geom.attributes[name];
  if (!a || a.array.length !== arr.length) return false;
  a.array.set(arr);
  a.needsUpdate = true;
  return true;
}

function tryUpdateInPlace(grp, node, bufs) {
  if (grp.userData.sig !== roleSig(node, bufs)) return false;
  let ok = true;
  const jobs = [];
  grp.traverse(o => {
    if (!ok || !o.userData.role) return;
    if (o.userData.role === 'surface') {
      ok = o.geometry.attributes.position.array.length === bufs.tris.position.length;
      if (ok) jobs.push(() => {
        updateAttr(o.geometry, 'position', bufs.tris.position);
        updateAttr(o.geometry, 'normal', bufs.tris.normal);
        updateAttr(o.geometry, 'color', bufs.tris.color);
        o.userData.primId = bufs.tris.primId;
        o.geometry.computeBoundingSphere();
      });
    } else if (o.userData.role === 'points') {
      ok = o.geometry.attributes.position.array.length === bufs.points.position.length;
      if (ok) jobs.push(() => {
        updateAttr(o.geometry, 'position', bufs.points.position);
        updateAttr(o.geometry, 'color', bufs.points.color);
        o.geometry.computeBoundingSphere();
      });
    } else if (o.userData.role === 'lines') {
      ok = o.geometry.attributes.position.array.length === bufs.lines.position.length;
      if (ok) jobs.push(() => {
        updateAttr(o.geometry, 'position', bufs.lines.position);
        updateAttr(o.geometry, 'color', bufs.lines.color);
        o.geometry.computeBoundingSphere();
      });
    }
  });
  if (!ok || !jobs.length) return false;
  for (const j of jobs) j();   // 全役割が更新可能と確認してから書き込む（中途半端な状態を作らない）
  return true;
}

function rebuild(id, bufs, err) {
  const node = store.get(id);
  if (err) { node.error = err; disposeGroup(id); clearPickIf(id); return; }
  node.error = null;
  if (!bufs || !node.visible) { disposeGroup(id); clearPickIf(id); needsRender = true; return; }

  const existing = groups[id];
  if (existing && tryUpdateInPlace(existing, node, bufs)) {
    updateStats.inPlace++;
    if (castsShadow(node)) renderer.shadowMap.needsUpdate = true;
    refreshPick(id);
    needsRender = true;
    return;
  }

  disposeGroup(id);
  const shadow = castsShadow(node);
  const grp = new THREE.Group();
  if (node.style.surface && bufs.tris.count) grp.add(makeSurface(bufs, node.style, shadow));
  if (node.style.points && bufs.points.count) grp.add(makePoints(bufs, node.style));
  if (node.style.lines && bufs.lines.count) grp.add(makeLines(bufs, node.style));
  grp.userData.sig = roleSig(node, bufs);
  grp.traverse(o => { o.userData.sceneId = id; });
  groups[id] = grp;
  scene.add(grp);
  updateStats.rebuilt++;
  if (shadow) renderer.shadowMap.needsUpdate = true;
  refreshPick(id);
}

/* ---------- カメラ操作（r128 に OrbitControls は同梱されない） ---------- */

const cam = { az: -1.15, el: 0.46, dist: 900, target: new THREE.Vector3(20, 30, 15) };

function applyCamera() {
  const ce = Math.cos(cam.el), se = Math.sin(cam.el);
  camera.position.set(
    cam.target.x + cam.dist * ce * Math.cos(cam.az),
    cam.target.y + cam.dist * ce * Math.sin(cam.az),
    cam.target.z + cam.dist * se,
  );
  camera.lookAt(cam.target);
}

(function bindControls() {
  const el = renderer.domElement;
  let drag = null;
  let press = null;                       // クリック（≒ドラッグしていない）判定用
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, btn: e.button };
    press = { x: e.clientX, y: e.clientY, btn: e.button };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointerup', e => {
    drag = null;
    el.releasePointerCapture(e.pointerId);
    if (press && press.btn === 0 &&
        Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) {
      const r = el.getBoundingClientRect();
      pickAt(((e.clientX - r.left) / r.width) * 2 - 1,
             -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    press = null;
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.btn === 0) {
      cam.az -= dx * 0.006;
      cam.el = Math.max(0.04, Math.min(1.5, cam.el + dy * 0.005));
    } else {
      const s = cam.dist * 0.0016;
      const right = new THREE.Vector3(-Math.sin(cam.az), Math.cos(cam.az), 0);
      cam.target.addScaledVector(right, -dx * s);
      cam.target.z += dy * s;
    }
    applyCamera(); needsRender = true;
  });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    cam.dist = Math.max(60, Math.min(3000, cam.dist * (1 + Math.sign(e.deltaY) * 0.12)));
    applyCamera(); needsRender = true;
  }, { passive: false });
})();

function resize() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  needsRender = true;
}
window.addEventListener('resize', resize);

/* ============================================================
   3.5 ピッキング（P6.5）
   ------------------------------------------------------------
   toRenderBuffers が三角形ごとに出力している primId バッファで
   レイキャスト結果（faceIndex）からプリムを引き、シーン層の
   inspect（geo kind に閉じた属性読み出し）で属性を表示する。
   ============================================================ */

const raycaster = new THREE.Raycaster();
let lastPick = null;      // { sceneId, prim, info, point }
let highlight = null;     // 選択プリムのハイライトメッシュ

function clearHighlight() {
  if (!highlight) return;
  highlight.geometry.dispose();
  highlight.material.dispose();
  scene.remove(highlight);
  highlight = null;
}

function clearPick() {
  lastPick = null;
  clearHighlight();
  renderPickInfo();
  needsRender = true;
}

function clearPickIf(sceneId) {
  if (lastPick && lastPick.sceneId === sceneId) clearPick();
}

/** 選択プリムの三角形を primId バッファから抜き出してハイライトにする */
function buildHighlight(sceneId) {
  clearHighlight();
  if (!lastPick) return;
  const grp = groups[sceneId];
  if (!grp) return;
  let mesh = null;
  grp.traverse(o => { if (!mesh && o.userData.primId) mesh = o; });
  if (!mesh) return;
  const primId = mesh.userData.primId;
  const pos = mesh.geometry.attributes.position.array;
  const out = [];
  for (let t = 0; t < primId.length; t += 3)
    if (primId[t] === lastPick.prim)
      for (let k = 0; k < 9; k++) out.push(pos[t * 3 + k]);
  if (!out.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
  const m = new THREE.MeshBasicMaterial({
    color: 0xf0c341, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  highlight = new THREE.Mesh(g, m);
  highlight.userData.aux = true;
  scene.add(highlight);
}

function pickAt(nx, ny) {
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const cands = [];
  for (const grp of Object.values(groups))
    grp.traverse(o => { if (o.isMesh && o.userData.primId) cands.push(o); });
  const hits = raycaster.intersectObjects(cands, false);
  if (!hits.length) { clearPick(); return null; }
  const hit = hits[0];
  const sceneId = hit.object.userData.sceneId;
  const prim = hit.object.userData.primId[hit.faceIndex * 3];
  const info = store.inspect(sceneId, prim, { time });
  if (!info) { clearPick(); return null; }
  lastPick = { sceneId, prim, info, point: [hit.point.x, hit.point.y, hit.point.z] };
  buildHighlight(sceneId);
  renderPickInfo();
  needsRender = true;
  return lastPick;
}

/** レイヤ再構築 / 差分更新後に、選択中プリムの表示を追随させる */
function refreshPick(sceneId) {
  if (!lastPick || lastPick.sceneId !== sceneId) return;
  const info = store.inspect(sceneId, lastPick.prim, { time });
  if (!info) { clearPick(); return; }
  lastPick.info = info;
  buildHighlight(sceneId);
  renderPickInfo();
}

function fmtVal(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function renderPickInfo() {
  const host = document.getElementById('pickinfo');
  if (!lastPick) { host.style.display = 'none'; return; }
  const n = store.get(lastPick.sceneId);
  const rows = Object.entries(lastPick.info.attribs)
    .filter(([k]) => k !== 'closed')
    .map(([k, v]) => `<tr><td>${k}</td><td>${fmtVal(v)}</td></tr>`)
    .join('');
  host.innerHTML = `<b>${n.name}</b>` +
    `<table><tr><td>prim</td><td>#${lastPick.prim}</td></tr>` +
    `<tr><td>頂点数</td><td>${lastPick.info.vertices}</td></tr>${rows}</table>`;
  host.style.display = 'block';   // '' だとスタイルシートの display:none に戻ってしまう
}

/* ============================================================
   4. 評価ループ
   ============================================================ */

let time = 0, playing = false, needsRender = true;
let lastBuildMs = 0, lastBuilt = [];

const graphBase = new Map();   // graph -> このフレーム開始時点の cookCount

function snapshotGraphBase() {
  graphBase.clear();
  for (const id of store.order) {
    const n = store.get(id);
    if (n.kind === 'geo') graphBase.set(n.payload.graph, n.payload.graph.cookCount);
  }
}

function buildFrame() {
  snapshotGraphBase();
  const t0 = performance.now();
  lastBuilt = store.buildDirty({ time, frame: Math.round(time * 30) }, rebuild);
  lastBuildMs = performance.now() - t0;
  needsRender = true;
  renderReport();
}

function markAllDirty() { for (const id of store.order) store.markDirty(id); }

let lastT = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (playing) {
    time += dt;
    // 時間依存のシーンノードだけを dirty にする
    for (const id of store.timeDependentIds()) store.markDirty(id);
  }
  if (store.dirty.size) buildFrame();
  if (needsRender) { renderer.render(scene, camera); needsRender = false; }
}

/* ============================================================
   5. UI
   ============================================================ */

const el = (id) => document.getElementById(id);

/* ---- アウトライナ ---- */
function renderOutliner() {
  const host = el('outliner');
  host.innerHTML = '';
  for (const id of store.order) {
    const n = store.get(id);
    const row = document.createElement('div');
    row.className = 'row' + (n.parentId ? ' indent' : '') + (id === selectedScene ? ' sel' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = n.visible;
    cb.onclick = (e) => { e.stopPropagation(); store.setVisible(id, cb.checked); buildFrame(); };
    if (n.kind !== 'geo') cb.style.visibility = 'hidden';
    row.appendChild(cb);
    const label = document.createElement('span');
    label.textContent = n.name;
    row.appendChild(label);
    if (n.kind === 'geo') {
      const tag = document.createElement('em');
      tag.textContent = n.payload.graph.isTimeDependent(n.payload.displayNode) ? 'time' : 'static';
      tag.className = 'tag';
      row.appendChild(tag);
    }
    if (n.kind === 'geo') row.onclick = () => { selectedScene = id; selectedNode = n.payload.displayNode; renderAll(); };
    host.appendChild(row);
  }
}

/* ---- ノード一覧とパラメータ ---- */
let selectedScene = 'arena';
let selectedNode = 'arena1';

function currentGraph() { return store.get(selectedScene).payload.graph; }

function renderNodeList() {
  const host = el('nodelist');
  host.innerHTML = '';
  const g = currentGraph();
  for (const [id, n] of g.nodes) {
    const row = document.createElement('div');
    row.className = 'row' + (id === selectedNode ? ' sel' : '');
    row.textContent = (n.def.label || n.type);
    const s = document.createElement('em');
    s.className = 'tag'; s.textContent = id;
    row.appendChild(s);
    if (n.error) row.classList.add('err');
    row.onclick = () => { selectedNode = id; renderAll(); };
    host.appendChild(row);
  }
}

function renderParams() {
  const host = el('params');
  host.innerHTML = '';
  const g = currentGraph();
  const n = g.nodes.get(selectedNode);
  if (!n) return;

  for (const [k, spec] of Object.entries(n.def.params)) {
    if (spec.type === 'string' && k === 'code') continue;
    const wrap = document.createElement('div');
    wrap.className = 'pfield';
    const lab = document.createElement('label');
    lab.textContent = k;
    wrap.appendChild(lab);

    if (spec.type === 'int' || spec.type === 'float') {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.value = n.params[k];
      inp.step = spec.type === 'int' ? 1 : 0.1;
      inp.oninput = () => {
        const v = spec.type === 'int' ? parseInt(inp.value, 10) : parseFloat(inp.value);
        if (!isFinite(v)) return;
        n.setParam(k, v);
        store.markDirty(selectedScene);
        for (const id of store.order)
          if (store.get(id).kind === 'geo' && store.get(id).payload.graph === g) store.markDirty(id);
        buildFrame();
      };
      wrap.appendChild(inp);
    } else if (spec.type === 'vec2' || spec.type === 'vec3') {
      const box = document.createElement('div');
      box.className = 'vec';
      (n.params[k] || []).forEach((val, i) => {
        const inp = document.createElement('input');
        inp.type = 'number'; inp.value = val; inp.step = 0.1;
        inp.oninput = () => {
          const arr = n.params[k].slice(); arr[i] = parseFloat(inp.value) || 0;
          n.setParam(k, arr); store.markDirty(selectedScene); buildFrame();
        };
        box.appendChild(inp);
      });
      wrap.appendChild(box);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = n.params[k];
      inp.oninput = () => { n.setParam(k, inp.value); store.markDirty(selectedScene); buildFrame(); };
      wrap.appendChild(inp);
    }
    host.appendChild(wrap);
  }

  /* スニペット */
  const sn = el('snipwrap');
  if (n.type === 'snippet') {
    sn.style.display = '';
    el('snippet').value = n.params.code || '';
    el('snipclass').value = n.params.class || 'point';
  } else {
    sn.style.display = 'none';
  }
}

el('snipapply').onclick = () => {
  /* 適用のたびに時間依存が変わりうるのでアウトライナも描き直す */
  const g = currentGraph();
  const n = g.nodes.get(selectedNode);
  if (!n || n.type !== 'snippet') return;
  n.setParam('class', el('snipclass').value);
  n.setParam('code', el('snippet').value);
  for (const id of store.order)
    if (store.get(id).kind === 'geo' && store.get(id).payload.graph === g) store.markDirty(id);
  buildFrame();
  renderOutliner();
  renderNodeList();
};

/* ---- cook レポート ---- */
function renderReport() {
  const host = el('report');
  const rows = [];
  const seenG = new Set();
  for (const id of store.order) {
    const n = store.get(id);
    if (n.kind !== 'geo') continue;
    const g = n.payload.graph;
    if (seenG.has(g)) continue;
    seenG.add(g);
    const base = graphBase.has(g) ? graphBase.get(g) : 0;
    for (const [nid, nd] of g.nodes) {
      if (!nd.stats) continue;
      rows.push({ id: nid, fresh: (nd.stats.serial || 0) > base, ...nd.stats });
    }
  }
  const uniq = rows;

  host.innerHTML =
    '<table><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"></colgroup><thead><tr><th>ノード</th><th>ms</th><th>点</th><th>面</th><th>time</th><th>状態</th></tr></thead><tbody>' +
    uniq.map(r => {
      const fresh = r.fresh;
      const state = r.error
        ? `<span class="bad">${r.error}</span>`
        : (r.warnings && r.warnings.length ? `<span class="warn">${r.warnings[0]}</span>`
          : (fresh ? '<span class="ok">再計算</span>' : '<span class="cache">キャッシュ</span>'));
      return `<tr><td>${r.id}</td><td>${r.ms}</td><td>${r.points}</td><td>${r.prims}</td><td>${r.timeDep ? '●' : ''}</td><td>${state}</td></tr>`;
    }).join('') + '</tbody></table>';

  el('stats').textContent =
    `build ${lastBuildMs.toFixed(1)}ms / 再構築 ${lastBuilt.length} レイヤ / t=${time.toFixed(2)}s`;
}

function renderAll() { renderOutliner(); renderNodeList(); renderParams(); renderReport(); }

/* ---- 再生 ---- */
el('play').onclick = () => {
  playing = !playing;
  el('play').textContent = playing ? '■ 停止' : '▶ 再生';
};
el('reset').onclick = () => { time = 0; markAllDirty(); buildFrame(); };

/* ============================================================
   6. 起動
   ============================================================ */

resize();
applyCamera();
buildFrame();
renderAll();
loop();

/* テスト用フック */
window.__xb = { store, cityGraph, arenaGraph, flowGraph, roadGraph, lmGraph, scene, camera,
  step(dt) { time += dt; for (const id of store.timeDependentIds()) store.markDirty(id); buildFrame(); },
  counts() {
    let tri = 0, pts = 0;
    scene.traverse(o => {
      if (o.userData.aux) return;                     // ハイライト / 影の受け皿は数えない
      if (o.isMesh) tri += o.geometry.attributes.position.count / 3;
      if (o.isPoints) pts += o.geometry.attributes.position.count;
    });
    return { tri, pts, layers: Object.keys(groups).length };
  },
  /* P6.5 */
  pick: (nx, ny) => pickAt(nx, ny),
  getPick: () => lastPick,
  clearPick,
  updateStats,
  render() { renderer.render(scene, camera); },
  shadows: () => renderer.shadowMap.enabled };
