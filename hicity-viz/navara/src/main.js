/* 羽田イノベーションシティ デジタルツイン — Navara(Re:Earth) × PLATEAU
   - 地球規模の地形/航空写真の上に PLATEAU 3D都市モデル(大田区 2025年度 LOD2)をストリーミング
   - 既存資産(HICity IFC図面・駅構造・新空港線・人流)を ENU ローカル系のまま重畳 */
import * as THREE from 'three';
import ThreeView, { Color, MeshDesc, JAPAN_GSI_ELEVATION_DECODER } from '@navaramap/three';
import { DefaultPlugin } from '@navaramap/three-default-plugin';
import { buildStations, buildTrains } from './stations_build.js';

const D = window.__HIC;
const $ = id => document.getElementById(id);
const setStatus = t => { const s = $('status'); if (!t) { s.style.display = 'none'; return; } s.style.display = 'block'; s.textContent = t; };

/* ---------- 座標変換: HICityローカル(m) ---------- */
const fit = D.fit;
const TH = fit.theta * Math.PI / 180, CT = Math.cos(TH), ST = Math.sin(TH);
function toLocal(lon, lat) {
  const x = (lon - fit.lon_c) * fit.mlon, y = (lat - fit.lat_c) * fit.mlat;
  return [CT * x - ST * y + fit.dx, ST * x + CT * y + fit.dy];
}
function toLonLat(lx, ly) {   // ローカル→WGS84(逆変換)
  const x0 = lx - fit.dx, y0 = ly - fit.dy;
  const x = CT * x0 + ST * y0, y = -ST * x0 + CT * y0;
  return [x / fit.mlon + fit.lon_c, y / fit.mlat + fit.lat_c];
}
const W = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

/* ---------- PLATEAU 3D Tiles (大田区 2025年度) ---------- */
const PLATEAU = {
  bldg: 'https://assets.cms.plateau.reearth.io/assets/a9/ea2016-3ecc-4dc4-84f8-488b13f2816b/13111_ota-ku_pref_2025_citygml_1_op_bldg_3dtiles_13111_ota-ku_lod2/tileset.json',
  tran: 'https://assets.cms.plateau.reearth.io/assets/5a/52915f-2535-4e6b-8889-95c28dd1a4dd/13111_ota-ku_pref_2025_citygml_1_op_tran_3dtiles_lod3/tileset.json',
  brid: 'https://assets.cms.plateau.reearth.io/assets/b1/7b541e-8776-43ec-99ab-832332d7977e/13111_ota-ku_pref_2025_citygml_1_op_brid_3dtiles_lod2/tileset.json',
};
const HIC_LL = { lng: fit.lon_c, lat: fit.lat_c };
const VIEWS = {
  hic:   { lng: 139.7555, lat: 35.5482, height: 420, heading: 25, pitch: -32 },
  kamata:{ lng: 139.7160, lat: 35.5624, height: 520, heading: 15, pitch: -35 },
  keikyu:{ lng: 139.7231, lat: 35.5611, height: 430, heading: 350, pitch: -33 },
  airport:{ lng: 139.7760, lat: 35.5470, height: 1600, heading: 300, pitch: -30 },
  ward:  { lng: 139.7300, lat: 35.5500, height: 7000, heading: 340, pitch: -38 },
  omori: { lng: 139.7280, lat: 35.5885, height: 520, heading: 20, pitch: -34 },
};

/* ---------- Navara 初期化 ---------- */
const view = new ThreeView({ shadow: true, canvasParent: $('app') });
const plugin = new DefaultPlugin();
view.addPlugin(plugin);

const state = {
  playing: true, speed: 240, simT: 9.5 * 3600,
  sunSync: true,
  layers: { hic: true, heat: true, sta: true, future: true, train: true, people: true },
};
let hicRoot = null, ST3D = null, TRAINS = null, heatGroup = null, tagsForDay = [], partSystems = {};
const tilesLayers = {};
let baseLayers = {};

async function main() {
  await view.init();
  setStatus('シーンを構築中…');

  view.toneMappingExposure = 8;
  const scene = plugin.addDefaultPhotorealScene();
  scene.sky && scene.aerialPerspective?.update({ aerialPerspective: { sky: true } });

  /* --- 地形(地理院DEM) --- */
  const demSource = view.addSource({
    type: 'raster-dem',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png',
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    minZoom: 6, maxZoom: 15,
  });
  const terrainLayer = view.addLayer({ type: 'terrain', source: demSource,
    terrain: { castShadow: false, receiveShadow: true } });

  /* --- ベースマップ(航空写真 / 地図) --- */
  const photoSource = view.addSource({
    type: 'raster-tile', url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', maxZoom: 18 });
  const stdSource = view.addSource({
    type: 'raster-tile', url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', maxZoom: 18 });
  baseLayers.photo = view.addLayer({ type: 'raster', source: photoSource,
    raster: { color: new Color().setStyle('#ffffff'), opacity: 1 } });
  baseLayers.std = view.addLayer({ type: 'raster', source: stdSource,
    raster: { color: new Color().setStyle('#ffffff'), opacity: 0 } });
  baseLayers.terrain = terrainLayer;

  /* --- PLATEAU 3D Tiles --- */
  for (const [key, url] of Object.entries(PLATEAU)) {
    const src = view.addSource({ type: '3d-tiles', url });
    tilesLayers[key] = view.addLayer({ type: '3d-tiles', source: src,
      tiles3d: { castShadow: key === 'bldg', receiveShadow: true } });
  }
  setLayerOpacity(tilesLayers.tran, 0);
  setLayerOpacity(tilesLayers.brid, 0);

  view.attribution?.add([
    { attribution: '3D都市モデル Project PLATEAU（大田区 2025年度）', attributionUrl: 'https://www.mlit.go.jp/plateau/' },
    { attribution: '地理院タイル（標高・シームレス空中写真）', attributionUrl: 'https://maps.gsi.go.jp/development/ichiran.html' },
  ]);

  /* --- 既存資産(HICity/駅/新線/人流)をENUローカル系で重畳 --- */
  buildOverlays();

  view.setCamera({ ...VIEWS.hic, roll: 0 });
  wireUI();
  setStatus('');
  requestAnimationFrame(loop);
}

function setLayerOpacity(layer, v) {
  try { layer.update({ type: '3d-tiles', tiles3d: { opacity: v } }); } catch (e) { /* noop */ }
  try { layer.ref && (layer.ref.visible = v > 0); } catch (e) { /* noop */ }
}

/* ---------- ローカル系オーバーレイ ---------- */
/** 任意のthree.jsオブジェクトをNavaraのレンダーパスに載せる公式拡張点 */
class OverlayDesc extends MeshDesc {
  constructor(view, ctx, config) { super(view, ctx, config); this._group = config.overlay?.group ?? new THREE.Group(); }
  createMesh() { return this._group; }
}

function buildOverlays() {
  // glTF規約(+Z=正面)のWest-Up-North接地フレーム上に、ローカル系(x=東, y=上, z=-北)を載せる
  const root = new THREE.Group();
  root.rotation.y = Math.PI;   // West-Up-North → East-Up-South(=当プロジェクトのローカル系)

  /* HICity IFC 図面 */
  hicRoot = new THREE.Group(); root.add(hicRoot);
  const FLOORS = [
    { key: '-1', z: -2.6, color: 0x8a7fff, storey: 'Fndn' }, { key: '0', z: 0.15, color: 0x00e5ff, storey: '1FL' },
    { key: '1', z: 5.95, color: 0x35e0a1, storey: '2FL' }, { key: '2', z: 11.45, color: 0xffd166, storey: '3FL' },
    { key: '3', z: 15.95, color: 0xff7fb2, storey: 'RFL' },
  ];
  for (const F of FLOORS) {
    for (const bk of Object.keys(D.plans)) {
      const st = D.plans[bk].storeys[F.storey];
      if (!st) continue;
      for (const [kind, col, op] of [['slab', F.color, 0.75], ['wall', F.color, 0.6], ['glass', 0x27c8e8, 0.6], ['stair', 0xffb648, 0.8]]) {
        const rings = st[kind] || [];
        const v = [];
        for (const ring of rings)
          for (let i = 0; i + 1 < ring.length; i++)
            v.push(ring[i][0], F.z, -ring[i][1], ring[i + 1][0], F.z, -ring[i + 1][1]);
        if (!v.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
        const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }));
        ls.renderOrder = 10; ls.frustumCulled = false;
        hicRoot.add(ls);
      }
    }
  }

  /* 施設内 滞留ヒート */
  heatGroup = new THREE.Group(); root.add(heatGroup);
  const cell = D.heat.cell;
  const ramp = t => {
    const a = new THREE.Color(0x0a3a66), b = new THREE.Color(0x00b7d9), c = new THREE.Color(0xffc94d);
    return t < 0.6 ? a.clone().lerp(b, t / 0.6) : b.clone().lerp(c, (t - 0.6) / 0.4);
  };
  const box = new THREE.BoxGeometry(cell * 0.92, 0.4, cell * 0.92);
  for (const F of FLOORS) {
    const byG = D.heat.heat[F.key]; if (!byG) continue;
    for (const g of Object.keys(byG)) {
      const cells = byG[g];
      let max = 1; for (const c of cells) max = Math.max(max, c[2]);
      const im = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false }), cells.length);
      const m4 = new THREE.Matrix4();
      cells.forEach((c, i) => {
        m4.setPosition((c[0] + 0.5) * cell, F.z + 0.5, -(c[1] + 0.5) * cell);
        im.setMatrixAt(i, m4);
        im.setColorAt(i, ramp(Math.log(1 + c[2]) / Math.log(1 + max)));
      });
      im.renderOrder = 11; im.frustumCulled = false;
      heatGroup.add(im);
    }
  }

  /* 駅構造・路線・新空港線 */
  ST3D = buildStations(toLocal, W, labelSprite);
  root.add(ST3D.group, ST3D.futureGroup, ST3D.railGroup);
  ST3D.group.traverse(o => { if (o.material && !o.isSprite) { o.material.depthTest = false; o.renderOrder = 8; } });
  ST3D.railGroup.traverse(o => { if (o.material && !o.isSprite) { o.material.depthTest = false; o.renderOrder = 8; } });

  /* 列車 */
  TRAINS = buildTrains(toLocal, W);
  TRAINS.group.traverse(o => { if (o.material) { o.material.depthTest = false; o.renderOrder = 9; } });
  root.add(TRAINS.group);

  /* 人流(9/18) */
  buildPeople(root);

  view.registerMesh('overlay', OverlayDesc);
  view.addMesh({ overlay: { group: root }, geodetic: { lng: HIC_LL.lng, lat: HIC_LL.lat, height: 0, heading: 0 } });
  window.__diagRoot = root;
}

const GROUPS = { staff: 0x4da3ff, visitor: 0xff9a4d, robot: 0x35e0a1, mobility: 0xffe066 };
function buildPeople(root) {
  const day = '0918';
  tagsForDay = Object.entries(D.traj[day] || {}).map(([uid, d]) => ({ g: d.g, p: d.p, ptr: 0 }));
  for (const g of Object.keys(GROUPS)) {
    const idx = tagsForDay.map((t, i) => t.g === g ? i : -1).filter(i => i >= 0);
    const pos = new Float32Array(Math.max(1, idx.length) * 3).fill(-99999);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: GROUPS[g], size: 5, transparent: true, opacity: 1,
      sizeAttenuation: true, blending: THREE.AdditiveBlending, map: dotTexture(), alphaTest: 0.12 }));
    pts.renderOrder = 12; pts.frustumCulled = false;
    root.add(pts);
    partSystems[g] = { points: pts, idx };
  }
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const FLOOR_Z = { '-1': -2.6, '0': 0.15, '1': 5.95, '2': 11.45, '3': 15.95 };
const tmp = {};
function samplePos(tag, t, out) {
  const p = tag.p;
  if (!p.length || t < p[0][0] - 90 || t > p[p.length - 1][0] + 90) return false;
  let i = Math.min(tag.ptr, p.length - 1);
  while (i > 0 && p[i][0] > t) i--;
  while (i + 1 < p.length && p[i + 1][0] <= t) i++;
  tag.ptr = i;
  const a = p[i], b = p[Math.min(i + 1, p.length - 1)];
  const gap = b[0] - a[0];
  if (gap > 150 && t > a[0] + 90) return false;
  if (gap > 0 && t <= b[0] && a[3] === b[3]) {
    const u = (t - a[0]) / gap;
    out.x = (a[1] + (b[1] - a[1]) * u) / 10; out.y = (a[2] + (b[2] - a[2]) * u) / 10; out.fl = a[3];
  } else { out.x = a[1] / 10; out.y = a[2] / 10; out.fl = a[3]; }
  return true;
}
function updatePeople(t) {
  for (const g of Object.keys(partSystems)) {
    const sys = partSystems[g];
    const arr = sys.points.geometry.attributes.position.array;
    let w = 0;
    for (const ti of sys.idx) {
      const tag = tagsForDay[ti];
      if (state.layers.people && samplePos(tag, t, tmp)) {
        arr[w++] = tmp.x; arr[w++] = (FLOOR_Z[String(tmp.fl)] ?? 0) + 1.4; arr[w++] = -tmp.y;
      } else { arr[w++] = 0; arr[w++] = -99999; arr[w++] = 0; }
    }
    sys.points.geometry.attributes.position.needsUpdate = true;
  }
}

/* ---------- ラベル ---------- */
function labelSprite(text, color, scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = '600 26px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 22;
  c.width = w; c.height = 40;
  const c2 = c.getContext('2d');
  c2.font = '600 26px system-ui, sans-serif';
  c2.fillStyle = 'rgba(4,8,18,0.6)';
  c2.beginPath(); c2.roundRect(0, 0, w, 40, 8); c2.fill();
  c2.fillStyle = color; c2.fillText(text, 11, 29);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(w / 40 * 7 * scale, 7 * scale, 1);
  sp.renderOrder = 20;
  return sp;
}

/* ---------- UI ---------- */
function wireUI() {
  const fr = $('fly-row');
  const items = [['hic', 'HICity'], ['ward', '大田区全景'], ['kamata', '蒲田'], ['keikyu', '京急蒲田'], ['omori', '大森'], ['airport', '羽田空港']];
  fr.innerHTML = items.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('');
  fr.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const v = VIEWS[b.dataset.v];
    view.flyTo({ ...v, roll: 0 }, { duration: 2.2 });
  }));

  const bind = (id, fn) => $(id)?.addEventListener('change', e => fn(e.target.checked));
  bind('l-bldg', v => setLayerOpacity(tilesLayers.bldg, v ? 1 : 0));
  bind('l-tran', v => setLayerOpacity(tilesLayers.tran, v ? 1 : 0));
  bind('l-brid', v => setLayerOpacity(tilesLayers.brid, v ? 1 : 0));
  bind('l-terrain', v => { try { baseLayers.terrain.ref && (baseLayers.terrain.ref.visible = v); } catch (e) {} });
  bind('l-hic', v => { state.layers.hic = v; hicRoot.visible = v; });
  bind('l-heat', v => { state.layers.heat = v; heatGroup.visible = v; });
  bind('l-sta', v => { state.layers.sta = v; ST3D.group.visible = v; ST3D.railGroup.visible = v; });
  bind('l-future', v => { state.layers.future = v; ST3D.futureGroup.visible = v; });
  bind('l-train', v => { state.layers.train = v; TRAINS.group.visible = v; });
  bind('l-people', v => { state.layers.people = v; });
  bind('l-sun', v => { state.sunSync = v; });

  document.querySelectorAll('#base-row button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#base-row button').forEach(x => x.classList.toggle('active', x === b));
    const k = b.dataset.b;
    try {
      baseLayers.photo.update({ type: 'raster', raster: { opacity: k === 'photo' ? 1 : 0 } });
      baseLayers.std.update({ type: 'raster', raster: { opacity: k === 'std' ? 1 : 0 } });
    } catch (e) { /* noop */ }
  }));

  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    $('play').textContent = state.playing ? '⏸ 停止' : '▶ 再生';
  });
  for (const id of ['sp60', 'sp240', 'sp900']) {
    $(id).addEventListener('click', () => {
      state.speed = +$(id).dataset.v;
      ['sp60', 'sp240', 'sp900'].forEach(x => $(x).classList.toggle('active', x === id));
    });
  }
  $('time').addEventListener('input', e => {
    state.simT = +e.target.value;
    for (const t of tagsForDay) t.ptr = 0;
  });

  // PLATEAU属性のツールチップ
  const tip = $('tip');
  view.on?.('feature_hover', ev => {
    const f = ev?.feature;
    if (!f) { tip.style.display = 'none'; return; }
    const a = f.properties || f.attributes || {};
    const name = a['gml:name'] || a['bldg:usage'] || '建築物';
    const h = a['bldg:measuredHeight'];
    tip.innerHTML = `<b>${name}</b>${h ? `<br>高さ ${Math.round(h)} m` : ''}<br><span style="color:#8fa8c8">PLATEAU LOD2</span>`;
    tip.style.display = 'block';
  });
  addEventListener('pointermove', e => {
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top = (e.clientY + 14) + 'px';
  });
}

/* ---------- ループ ---------- */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.playing) { state.simT += dt * state.speed; if (state.simT > 86400) state.simT -= 86400; }

  const hh = String(Math.floor(state.simT / 3600)).padStart(2, '0');
  const mm = String(Math.floor(state.simT % 3600 / 60)).padStart(2, '0');
  $('clock').textContent = `${hh}:${mm}`;
  $('time').value = state.simT;

  if (state.sunSync) {
    const d = view.atmosphere?.date;
    if (d) { d.setHours(Math.floor(state.simT / 3600), Math.floor(state.simT % 3600 / 60), 0, 0); }
  }
  updatePeople(state.simT);
  if (state.layers.train && TRAINS) TRAINS.update(state.simT, state.layers.future);
}

main().catch(e => { console.error(e); setStatus('初期化に失敗しました: ' + e.message); });
