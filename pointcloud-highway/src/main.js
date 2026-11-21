import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildStructure, elementBounds, elementProperties, CATEGORY } from './structure.js';
import { CLS, CLS_INFO, DENS } from './synth.js';
import { buildLut, cssGradient } from './colormaps.js';
import { createPointMaterial, createBimFaceMaterial, createBimEdgeMaterial, createVisibilityTexture, setAccumulation } from './shaders.js';
import { Post, POINT_LAYER } from './post.js';
import { buildBIM, elementAtFace } from './bim.js';
import { buildDriveRoute, Director } from './camera.js';
import { Measure } from './measure.js';
import { buildLevels, buildGridBubbles, SectionBox } from './annotations.js';
import { LAS_WORKER_BODY, writeLas } from './las.js';
import { buildLod } from './lod.js';
import { buildTraffic } from './traffic.js';
import { buildFlowModel, METRICS, atHour, speedAt, rampCss } from './trafficdata.js';
import { buildFlowViz } from './flow.js';
import { describeEpsg, tmForward, tmInverse, guessZone, formatDms } from './crs.js';

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
const edl = new Post(renderer, camera);
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
  clsHidden: new Set(), isolateRoute: null, surfel: true, shade: 0.5, las: null, budget: 8e6,
  style: 'accum', autoStyle: true, exposure: 1.0, bloom: 0.3, fog: 0.5, trafficOn: true, pulse: true,
  hour: 8, hourPlaying: false, dayType: 'weekday', flowOn: true, flowMetric: 'v24', flowShape: 'wall', flowSel: -1,
};
// test / kiosk overrides: ?density=0.2&budget=3000000&style=solid
{ const q = new URLSearchParams(location.search); if (q.has('noreveal')) { state.noReveal = true; state.pulse = false; } if (q.has('notraffic')) state.trafficOn = false; if (q.has('density')) state.density = +q.get('density'); if (q.has('budget')) state.budget = +q.get('budget'); if (q.has('style')) state.style = q.get('style'); }
let traffic = null, tdata = null, flowModel = null, flowViz = null;
async function loadJson(name) { const el = document.getElementById(`data-${name}`); if (el) return JSON.parse(el.textContent); return (await fetch(`./data/${name}.json`)).json(); }
const sweep = { t: -1, dur: 4.2, pulseT: 0, maxR: 1200 };
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let data = null, elements = [], points = null, lod = null, bim = null, levels = null, grids = null, cloud = null, seqRange = [0, 1];

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
  data = await loadJson(key);
  if (!tdata) tdata = await loadJson('traffic');
  flowModel = buildFlowModel(data, tdata, key, state.dayType);
  state.flowSel = -1;
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
  renderCrs();
  rebuildTraffic();
  rebuildFlow();
  overlay.classList.add('hidden');
  if (!state.noReveal && !reduceMotion) startReveal();
}

function rebuildCloud() {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./synth.worker.js', import.meta.url), { type: 'module' });
    overlay.classList.remove('hidden');
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'progress') { setProgress(0.1 + m.p * 0.8, 'LiDAR 点群を合成中…'); return; }
      worker.terminate();
      installCloud(m);
      $('stat-time').textContent = `${(m.ms / 1000).toFixed(1)} s`;
      setProgress(0.95, 'GPU へ転送中…');
      overlay.classList.add('hidden');
      resolve();
    };
    worker.postMessage({ data, options: { density: state.density, seed: 1, traffic: state.trafficOn ? 'dynamic' : 'static' } });
  });
}

/** Build the Points object from attribute arrays (synthesised or imported). */
function installCloud(m) {
  if (lod) { scene.remove(lod.group); lod.dispose(); lod = null; }
  if (!m.nrm) m.nrm = new Int8Array(m.n * 3);
  // ground-cell size: ~24 cells across the extent, at least 20 m
  let ex0 = Infinity, ex1 = -Infinity, ez0 = Infinity, ez1 = -Infinity;
  for (let i = 0; i < m.pos.length; i += 3) { const x = m.pos[i], z = m.pos[i + 2]; if (x < ex0) ex0 = x; if (x > ex1) ex1 = x; if (z < ez0) ez0 = z; if (z > ez1) ez1 = z; }
  const cell = Math.max(20, Math.max(ex1 - ex0, ez1 - ez0) / 24);
  lod = buildLod(m, pointMat, { cell });
  cloud = lod.cloud; // attribute arrays reordered by cell/LOD rank; element ids and classes travel with the points
  for (const c of lod.cells) c.points.userData.cell = c;
  pointMat.uniforms.uHasRgb.value = m.rgb ? 1 : 0;
  points = lod.group;
  points.visible = state.showCloud;
  scene.add(points);
  let hMin = Infinity, hMax = -Infinity;
  for (let i = 1; i < m.pos.length; i += 3) { if (m.pos[i] > hMax) hMax = m.pos[i]; if (m.pos[i] < hMin) hMin = m.pos[i]; }
  pointMat.uniforms.uHMin.value = Math.max(hMin, -2); pointMat.uniforms.uHMax.value = Math.min(hMax, state.las ? hMax : 60);
  $('stat-points').textContent = m.n.toLocaleString();
  renderLegend();
}
// ---------------------------------------------------------------- traffic + scan sweep
function rebuildTraffic() {
  if (traffic) { scene.remove(traffic.points); traffic.dispose(); traffic = null; }
  if (!state.trafficOn || state.las || !flowModel) { $('stat-vehicles').textContent = '—'; return; }
  traffic = buildTraffic(flowModel, pointMat);
  traffic.setHour(state.hour);
  scene.add(traffic.points);
  $('stat-vehicles').textContent = traffic.count.toLocaleString();
}

// ---------------------------------------------------------------- traffic volume (real counts)
const hh = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
function rebuildFlow() {
  if (flowViz) { scene.remove(flowViz.group); flowViz.dispose(); flowViz = null; }
  const on = !!flowModel && !state.las;
  document.body.classList.toggle('has-tpanel', on);
  if (!on) return;
  flowViz = buildFlowViz(flowModel);
  scene.add(flowViz.group);
  flowViz.update({ metric: state.flowMetric, shape: state.flowShape, hour: state.hour, selected: state.flowSel });
  flowViz.setVisible(state.flowOn);
  renderTrafficPanel();
}
function setHour(h, fromSlider = false) {
  state.hour = ((h % 24) + 24) % 24;
  if (!fromSlider) $('hour').value = state.hour;
  $('hour-label').textContent = hh(state.hour);
  if (traffic) { traffic.setHour(state.hour); $('stat-vehicles').textContent = traffic.count.toLocaleString(); }
  if (flowViz) flowViz.update({ hour: state.hour });
  renderTrafficPanel(true);
}
function selectFlow(fi, fly = false) {
  state.flowSel = fi;
  if (flowViz) flowViz.update({ selected: fi });
  renderTrafficPanel();
  if (fly && fi >= 0) { const f = flowModel.flows[fi], p = f.path[f.path.length >> 1]; const c = new THREE.Vector3(p.x, p.y + 10, p.z); director.setMode('orbit'); setActiveView(null); director.flyTo(c.clone().add(new THREE.Vector3(-160, 190, 230)), c); }
}
const congBadge = (c) => `<span class="badge ${c >= 1.25 ? 'bad' : c >= 1 ? 'warn' : 'ok'}">混雑度 ${c.toFixed(2)}</span>`;
function hourlyChart(large, small, hour) {
  const W = 336, H = 96, pad = 10, max = Math.max(...large.map((v, i) => v + small[i])) || 1, bw = (W - pad - 8) / 24;
  let bars = '';
  for (let i = 0; i < 24; i++) {
    const hs = (small[i] / max) * (H - 18), hl = (large[i] / max) * (H - 18), x = pad + i * bw, cur = Math.floor(hour) === i;
    bars += `<rect x="${x + 1}" y="${H - 14 - hs}" width="${bw - 2}" height="${hs}" fill="var(--accent)" opacity="${cur ? 1 : 0.55}"><title>${i}時台 小型 ${Math.round(small[i]).toLocaleString()} 台</title></rect>`;
    bars += `<rect x="${x + 1}" y="${H - 14 - hs - hl}" width="${bw - 2}" height="${hl}" fill="var(--accent2)" opacity="${cur ? 1 : 0.7}"><title>${i}時台 大型 ${Math.round(large[i]).toLocaleString()} 台</title></rect>`;
  }
  const xh = pad + (hour / 24) * (W - pad - 8);
  const ticks = [0, 6, 12, 18, 24].map((t) => `<text x="${pad + (t / 24) * (W - pad - 8)}" y="${H - 2}" text-anchor="middle">${t}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="hchart" role="img" aria-label="時間帯別交通量"><line x1="${pad}" y1="${H - 14}" x2="${W}" y2="${H - 14}" class="axis"/><text x="${pad - 2}" y="9" text-anchor="start">${Math.round(max).toLocaleString()} 台/時</text>${bars}<line x1="${xh}" y1="12" x2="${xh}" y2="${H - 12}" class="now"/>${ticks}</svg>`;
}
function historyChart(st) {
  const hst = st.history12; if (!hst) return '';
  const ys = Object.keys(hst), vals = ys.map((y) => hst[y]), max = Math.max(...vals), W = 336, H = 58, bw = (W - 8) / ys.length;
  const bars = ys.map((y, i) => { const hgt = (vals[i] / max) * (H - 24); return `<rect x="${4 + i * bw + 3}" y="${H - 12 - hgt}" width="${bw - 6}" height="${hgt}" fill="${y === 'R3' ? 'var(--accent)' : '#3d5a73'}"><title>${y} ${vals[i].toLocaleString()} 台/12h</title></rect><text x="${4 + i * bw + bw / 2}" y="${H - 2}" text-anchor="middle">${y}</text><text x="${4 + i * bw + bw / 2}" y="${H - 15 - hgt}" text-anchor="middle">${(vals[i] / 1000).toFixed(0)}</text>`; }).join('');
  return `<p class="tcap">推移（昼間 12 時間、千台。調査区間の変更により不連続の年度があります）</p><svg viewBox="0 0 ${W} ${H}" class="hchart" role="img" aria-label="交通量の推移">${bars}</svg>`;
}
function mlitChart(st) {
  const ser = tdata.mlitSeries[st.id]; if (!ser) return '';
  const W = 336, H = 64, lo = Math.min(...ser.map((x) => x.v)) * 0.96, hi = Math.max(...ser.map((x) => x.v)) * 1.02, n = ser.length;
  const xy = (x, i) => [10 + (i / (n - 1)) * (W - 20), H - 14 - ((x.v - lo) / (hi - lo)) * (H - 26)];
  const dots = ser.map((x, i) => { const [cx, cy] = xy(x, i), we = x.dow === '土' || x.dow === '日'; return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${we ? 'var(--accent2)' : 'var(--accent)'}"><title>${x.date}（${x.dow}） ${x.v.toLocaleString()} 台/日</title></circle>`; }).join('');
  const line = ser.map((x, i) => xy(x, i).join(',')).join(' ');
  const sec = tdata.mlitSections[st.id];
  return `<p class="tcap">${sec[1]} の日交通量（国交省 代表断面、2020/9〜2023/4。<span style="color:var(--accent2)">●</span> 土日）</p><svg viewBox="0 0 ${W} ${H}" class="hchart" role="img" aria-label="代表断面の日交通量"><polyline points="${line}" fill="none" stroke="#3d5a73" stroke-width="1"/>${dots}<text x="10" y="${H - 2}">${ser[0].date.slice(0, 7)}</text><text x="${W - 10}" y="${H - 2}" text-anchor="end">${ser[n - 1].date.slice(0, 7)}</text><text x="10" y="9">${Math.round(hi / 1000)} 千台</text></svg>`;
}
function setDayType(v) {
  state.dayType = v; $('day-type').value = v;
  const keep = state.flowSel >= 0 ? flowModel.flows[state.flowSel] : null;
  flowModel = buildFlowModel(data, tdata, state.site, v);
  state.flowSel = keep ? flowModel.flows.findIndex((f) => f.ri === keep.ri && f.sec.index === keep.sec.index && f.measured === keep.measured) : -1;
  rebuildTraffic(); rebuildFlow();
  $('tpanel-sub').textContent = v === 'holiday' ? '休日（推定）' : '平日（令和3年度センサス）';
}
let panelT = 0;
function renderTrafficPanel(throttle = false) {
  if (!flowModel || state.las) return;
  const now = performance.now();
  clearTimeout(renderTrafficPanel.timer);
  if (throttle && now - panelT < 200) { renderTrafficPanel.timer = setTimeout(() => renderTrafficPanel(), 220); return; } // trailing update
  panelT = now;
  const M = METRICS[state.flowMetric], h = state.hour, m = flowModel;
  const src = tdata.meta.sources.map((x) => `<a href="${x.url}" target="_blank" rel="noopener">${x.publisher} ${x.id === 'census-r3' ? '令和3年度 道路交通センサス' : '代表断面交通量（2023年4月28日）'}</a>`).join(' ／ ');
  const legend = `<div class="tlegend"><div class="bar" style="background:${rampCss(M.ramp)}"></div><div class="ticks"><span>${M.ticks(m)[0]}</span><span>色: ${M.label}${M.unit ? `（${M.unit}${M.ramp === 'volume' ? '・片方向' : ''}）` : ''}　${state.flowShape === 'wall' ? '高さ' : '幅'}: 交通量</span><span>${M.ticks(m)[1]}</span></div></div>`;
  let body;
  const f = state.flowSel >= 0 ? m.flows[state.flowSel] : null;
  if (f && f.measured) {
    const st = f.st, sec = f.sec, day = sec.day, hol = state.dayType === 'holiday', H = tdata.dayType.holiday;
    const qh = atHour(day.small.map((v, i) => v + day.large[i]), h), lh = atHour(day.large, h);
    const up = sec.ways.find((w) => w.up === true), dn = sec.ways.find((w) => w.up === false), any = sec.ways[0];
    const spd = up && dn ? `上り ${Math.round(speedAt(up, h))} / 下り ${Math.round(speedAt(dn, h))} km/h` : `${Math.round(speedAt(any, h))} km/h`;
    const ratio = H.volumeRatio[sec.rk] ?? 1;
    const dirLine = day.hasDir ? `<p class="tdir"><span>上り <b>${day.up24.toLocaleString()}</b></span><span>下り <b>${day.down24.toLocaleString()}</b></span><span class="muted">${st.dir.up.v24 == null ? '台/日（夜間は按分推定）' : '台/日'}　${hh(h)}: ${Math.round(atHour(day.qUp, h)).toLocaleString()} / ${Math.round(atHour(day.qDown, h)).toLocaleString()} 台/時</span></p>` : '';
    const cmp = hol ? `<p class="muted">平日 ${st.v24.toLocaleString()} 台/日 → 休日 推定 ×${ratio.toFixed(2)}${sec.kind === 'surface' ? '（一般道は休日データなし。平日値のまま、時間変動のみ補正）' : ''}</p>`
      : `<p class="muted">休日（推定）: ×${ratio.toFixed(2)} → 約 ${(Math.round((st.v24 * ratio) / 100) * 100).toLocaleString()} 台/日</p>`;
    body = `<div class="tsec"><button class="tback" id="t-back">← 区間一覧</button><h3>${sec.label || st.route.replace('高速', '首都高速')}</h3><p class="muted">${st.section}（観測地点 ${st.id}・${st.date}${st.lanes ? `・${st.lanes} 車線` : ''}）</p>
      <div class="tbig"><b>${day.v24.toLocaleString()}</b> 台/日${hol ? '<span class="est">休日推定</span>' : st.v24est ? '<span class="est">推定（12時間 ' + st.v12.toLocaleString() + ' 台 × 昼夜率 ' + st.nightRatio + '）</span>' : ''} ${congBadge(st.congestion)}</div>
      ${dirLine}
      <div class="kpis"><div><span>大型車</span><b>${st.hv} %</b></div><div><span>ピーク率</span><b>${st.peakPct} %</b></div><div><span>昼夜率</span><b>${st.nightRatio}</b></div><div><span>朝夕速度 上/下</span><b>${st.vUp != null ? Math.round(st.vUp) : '—'}/${st.vDown != null ? Math.round(st.vDown) : '—'}</b></div><div><span>H27 比</span><b>${st.growth ? (st.growth >= 1 ? '+' : '') + Math.round((st.growth - 1) * 100) + ' %' : '—'}</b></div></div>
      ${hourlyChart(day.large, day.small, h)}
      <p class="tnow"><b>${hh(h)}</b>　${Math.round(qh).toLocaleString()} 台/時（大型 ${Math.round((lh / Math.max(1, qh)) * 100)} %）・モデル速度 ${spd}${st.hourly ? '' : '<span class="est">夜間の時間変動は一般道平均形状</span>'}</p>
      ${cmp}${historyChart(st)}${mlitChart(st)}${hol ? `<p class="muted">${H.basis}</p>` : ''}</div>`;
  } else if (f) {
    body = `<div class="tsec"><button class="tback" id="t-back">← 区間一覧</button><h3>連結路（${f.road.name || 'ランプ・JCT'}）</h3><p class="muted">観測値なし。前後区間の収支からの推定値です。</p>
      <div class="tbig"><b>${f.ramp.v24.toLocaleString()}</b> 台/日<span class="est">推定</span></div><p class="muted">${f.ramp.basis}</p>
      ${hourlyChart(f.q.map((v, i) => v * 2 * f.hvh[i]), f.q.map((v, i) => v * 2 * (1 - f.hvh[i])), h)}<p class="muted">時間変動は隣接区間（${f.st.section}）の形状を適用。</p></div>`;
  } else {
    const secs = m.sections.filter((x) => x.ways.length).sort((a, b) => b.day.v24 - a.day.v24), vm = secs[0].day.v24;
    let tot = 0; for (const t of m.tracks) tot += (atHour(t.q, h) / speedAt(t, h)) * (t.L / 1000);
    body = `<p class="tnow"><b>${hh(h)}</b>　モデル内の走行台数 約 ${Math.round(tot).toLocaleString()} 台（交通量 ÷ 速度 × 延長）</p><div class="trank">${secs.map((x) => `<button class="trow" data-st="${x.index}"><span class="nm">${x.label || x.st.route.replace('高速', '')}<small>${x.kind === 'exp' ? x.st.section : x.st.section}</small></span><span class="br"><i style="width:${(x.day.v24 / vm) * 100}%;background:${x.st.congestion >= 1.25 ? '#ef5350' : x.st.congestion >= 1 ? '#ffb347' : 'var(--accent)'}"></i></span><span class="vl">${x.day.v24.toLocaleString()}${x.day.est ? '*' : ''}</span></button>`).join('')}</div><p class="muted">台/日（上下計）。* は推定（${state.dayType === 'holiday' ? '休日は全区間が推定値' : '12 時間値 × 昼夜率'}）。棒の色: 平日の混雑度 1.0 以上は橙、1.25 以上は赤。</p>`;
  }
  $('tpanel-body').innerHTML = `${body}${legend}<p class="tsrc">出典: ${src}</p>`;
  const back = $('t-back'); if (back) back.addEventListener('click', () => selectFlow(-1));
  $('tpanel-body').querySelectorAll('.trow').forEach((b) => b.addEventListener('click', () => { const sec = m.sections[+b.dataset.st]; const w = sec.ways.slice().sort((p, q) => q.L - p.L)[0]; selectFlow(m.flows.indexOf(w), true); }));
}
function startReveal() { if (!points) return; const b = new THREE.Box3().setFromObject(points); sweep.maxR = b.getSize(new THREE.Vector3()).length() / 2 + 40; sweep.t = 0; }
function updateSweep(dt) {
  const u = pointMat.uniforms;
  const c = director.mode === 'drive' ? camera.position : controls.target;
  if (sweep.t >= 0) { // reveal: the scan front expands from the centre, points appear behind it
    sweep.t += dt;
    const k = Math.min(1, sweep.t / sweep.dur), e = 1 - Math.pow(1 - k, 2.2), R = e * sweep.maxR;
    u.uSweepC.value.set(0, 0, 0); u.uRevealR.value = R; u.uSweepR.value = R - 6; u.uSweepW.value = 10 + 30 * e; u.uSweepK.value = 1.0;
    if (k >= 1) { sweep.t = -1; u.uRevealR.value = 1e9; u.uSweepK.value = 0; sweep.pulseT = 0; }
    return;
  }
  if (!state.pulse) { u.uSweepK.value = 0; return; }
  // periodic LiDAR pulse: a faint ring travelling outwards every 6 s (from the vehicle in drive mode)
  sweep.pulseT += dt;
  const period = 6, speed = director.mode === 'drive' ? 90 : 320, tt = sweep.pulseT % period;
  if (tt < dt) u.uSweepC.value.copy(c);
  u.uSweepR.value = tt * speed; u.uSweepW.value = director.mode === 'drive' ? 5 : 16;
  u.uSweepK.value = 0.55 * Math.max(0, 1 - tt / (period * 0.75));
}

/** Push updated per-point arrays (elem / dev after scan-to-BIM) to the GPU. */
function refreshCloudAttributes() {
  for (const c of lod.cells) { for (const name of ['elem', 'dev']) { const a = c.points.geometry.getAttribute(name); if (a) a.needsUpdate = true; } }
}

// ---------------------------------------------------------------- real scans (LAS / LAZ)
/** Source of a classic worker built from plain-script versions of our modules (embedded in the single-file build). */
async function workerSource(embeddedKey, modules, body) {
  let src = window[embeddedKey];
  if (!src) {
    const parts = [];
    for (const name of modules) parts.push((await (await fetch(new URL(`./${name}.js`, import.meta.url))).text()).replace(/^import\s[^;]*;\s*$/gm, ''));
    src = parts.join('\n');
  }
  return src.replace(/^export\s+(?=(const|let|function|class|async))/gm, '') + '\n' + body;
}
const lasWorkerSource = () => workerSource('__LAS_SRC__', ['crs', 'fit', 'las'], LAS_WORKER_BODY);
const SITE_EPSG = { hakozaki: 6677, ohashi: 6677 }; // 平面直角座標系 第IX系 (JGD2011)

// ---------------------------------------------------------------- coordinate reference system
function currentCrs() {
  if (state.las) { const epsg = state.las.epsgOverride || (state.las.header.crs && state.las.header.crs.epsg); return { epsg, desc: describeEpsg(epsg), origin: [state.las.local.cx, state.las.local.cy, state.las.local.z0], source: state.las.epsgOverride ? '手動指定' : state.las.header.crs ? state.las.header.crs.source : null }; }
  const epsg = SITE_EPSG[state.site], desc = describeEpsg(epsg);
  const c = data ? tmForward(data.site.center[0], data.site.center[1], desc.tm) : { e: 0, n: 0 };
  return { epsg, desc, origin: [c.e, c.n, 0], source: 'OSM 中心座標から投影' };
}
/** viewer local (x east, y up, z south) → projected E/N/H and lat/lon */
function toWorld(x, y, z) {
  const crs = currentCrs();
  const E = crs.origin[0] + x, N = crs.origin[1] - z, H = crs.origin[2] + y;
  const ll = crs.desc && crs.desc.tm ? tmInverse(E, N, crs.desc.tm) : null;
  return { E, N, H, ll, crs };
}
function renderCrs() {
  const crs = currentCrs();
  const el = $('crs-info');
  const o = crs.origin;
  let html = `<div class="kv"><span>座標系</span><b>${crs.desc ? crs.desc.name : '不明（ファイルに CRS 情報なし）'}</b></div>`;
  if (crs.epsg) html += `<div class="kv"><span>EPSG</span><b>${crs.epsg}${crs.source ? `（${crs.source}）` : ''}</b></div>`;
  html += `<div class="kv"><span>ローカル原点</span><b>E ${o[0].toFixed(3)} / N ${o[1].toFixed(3)} / H ${o[2].toFixed(3)} m</b></div>`;
  if (crs.desc && crs.desc.tm) { const ll = tmInverse(o[0], o[1], crs.desc.tm); html += `<div class="kv"><span>原点の経緯度</span><b>${formatDms(ll.lat, 'lat')} ${formatDms(ll.lon, 'lon')}</b></div>`; }
  else if (state.las) { const g = guessZone(o[0], o[1]); if (g) html += `<div class="kv hint">${g.hint}</div>`; }
  if (crs.desc && crs.desc.merc) html += `<div class="kv hint">${crs.desc.name}</div>`;
  el.innerHTML = html;
  $('crs-select-row').style.display = state.las && !(state.las.header.crs && state.las.header.crs.epsg) ? '' : 'none';
}
function showCoord(p) {
  const w = toWorld(p.x, p.y, p.z);
  $('coord-readout').innerHTML = `<b>E</b> ${w.E.toFixed(3)} <b>N</b> ${w.N.toFixed(3)} <b>H</b> ${w.H.toFixed(3)} m` + (w.ll ? `<br>${formatDms(w.ll.lat, 'lat')} ${formatDms(w.ll.lon, 'lon')}` : '') + `<br><span class="muted">ローカル x ${p.x.toFixed(2)} y ${p.y.toFixed(2)} z ${p.z.toFixed(2)}</span>`;
}
$('crs-select').addEventListener('change', (e) => { if (state.las) { state.las.epsgOverride = +e.target.value || null; renderCrs(); } });
const S2B_BODY = `
self.onmessage = (ev) => {
  const cloud = ev.data;
  try {
    const log = [];
    const { data } = scanToBim(cloud, { log: (m) => { log.push(m); self.postMessage({ type: 'log', m }); } });
    const elements = buildStructure(data).elements;
    const stats = assignAndDeviate(cloud, elements, { log: (m) => { log.push(m); self.postMessage({ type: 'log', m }); } });
    self.postMessage({ type: 'done', data, elements, stats, elem: cloud.elem, dev: cloud.dev, log }, [cloud.elem.buffer, cloud.dev.buffer]);
  } catch (err) { self.postMessage({ type: 'error', message: String(err && err.stack || err) }); }
};
`;
async function runScanToBim() {
  if (!cloud) return;
  overlay.classList.remove('hidden');
  setProgress(0.05, 'Scan-to-BIM: 高架の線形・橋脚・建物を点群から抽出中…');
  const url = URL.createObjectURL(new Blob([await workerSource('__S2B_SRC__', ['geom', 'structure', 'fit', 'scan2bim'], S2B_BODY)], { type: 'text/javascript' }));
  const worker = new Worker(url);
  const payload = { n: cloud.n, pos: cloud.pos.slice(), cls: cloud.cls.slice(), nrm: cloud.nrm.slice(), elem: new Uint16Array(cloud.n), dev: new Uint8Array(cloud.n) };
  const res = await new Promise((resolve, reject) => {
    worker.onmessage = (ev) => { const d = ev.data; if (d.type === 'log') setProgress(0.3, d.m); else if (d.type === 'error') reject(new Error(d.message)); else resolve(d); };
    worker.onerror = (e) => reject(new Error(e.message || 'worker error'));
    worker.postMessage(payload, [payload.pos.buffer, payload.cls.buffer, payload.nrm.buffer, payload.elem.buffer, payload.dev.buffer]);
  }).finally(() => { worker.terminate(); URL.revokeObjectURL(url); });
  // adopt the fitted model
  cloud.elem.set(res.elem); cloud.dev.set(res.dev); refreshCloudAttributes();
  elements = res.elements;
  const ex = points ? new THREE.Box3().setFromObject(points) : null;
  data = { ...res.data, site: { ...res.data.site, name: state.las ? state.las.name : 'scan', nameJa: '', cropM: ex ? [ex.max.x - ex.min.x, ex.max.z - ex.min.z] : [1000, 1000], layerHeight: 5.6, drive: {} } };
  rebuildBim(); rebuildAnnotations();
  director.route = buildDriveRoute(data);
  $('drive-name').textContent = director.route ? `抽出線形（${(director.route.length / 1000).toFixed(1)} km）` : '—';
  document.body.classList.remove('no-bim');
  $('show-bim').checked = true; state.showBim = true; bim.group.visible = true;
  $('bim-style').value = 'wire'; state.bimStyle = 'wire'; applyBimStyle();
  overlay.classList.add('hidden');
  const counts = {}; for (const e of elements) counts[e.type] = (counts[e.type] || 0) + 1;
  const assigned = res.elem.reduce((a, v) => a + (v !== NO_ELEM ? 1 : 0), 0);
  $('s2b-log').textContent = res.log.join('\n');
  toast(`Scan-to-BIM 完了: 床版 ${counts.deck || 0}・橋脚 ${counts.column || 0}・建物 ${counts.building || 0} を抽出、${assigned.toLocaleString()} 点を部材に対応付け`, 7000);
  applyPreset('scan2bim');
}
$('s2b-run').addEventListener('click', () => runScanToBim().catch((err) => { overlay.classList.add('hidden'); toast(`Scan-to-BIM 失敗: ${err.message}`, 8000); console.error(err); }));
async function loadLasFile(file) {
  overlay.classList.remove('hidden');
  setProgress(0.02, `${file.name} を読み込み中…`);
  const buf = await file.arrayBuffer();
  const isLaz = /\.laz$/i.test(file.name) || (new Uint8Array(buf)[104] & 0x80) !== 0;
  const url = URL.createObjectURL(new Blob([await lasWorkerSource()], { type: 'text/javascript' }));
  const worker = new Worker(url);
  const m = await new Promise((resolve, reject) => {
    worker.onmessage = (ev) => {
      const d = ev.data;
      if (d.type === 'progress') setProgress(0.05 + d.p * 0.9, d.p < 0.7 ? (isLaz ? 'LAZ を展開中（laz-perf）…' : 'LAS を解析中…') : '法線を推定中…');
      else if (d.type === 'error') reject(new Error(d.message));
      else resolve(d);
    };
    worker.onerror = (e) => reject(new Error(e.message || 'worker error'));
    worker.postMessage({ buf, isLaz, maxPoints: 16e6 }, [buf]);
  }).finally(() => { worker.terminate(); URL.revokeObjectURL(url); });
  // switch the viewer into "real scan" mode: no structural model, cloud only
  state.las = { name: file.name, header: m.header, spacing: m.spacing, cell: m.cell, stride: m.stride, local: m.local, epsgOverride: null };
  state.isolateRoute = null; clearSelection(); measure.clear();
  elements = [];
  if (bim) { scene.remove(bim.group); bim.faceGeo.dispose(); bim.edgeGeo.dispose(); bim = null; }
  if (levels) { scene.remove(levels); levels.traverse((o) => o.element && o.element.remove()); levels = null; }
  if (grids) { scene.remove(grids); grids.traverse((o) => o.element && o.element.remove()); grids = null; }
  director.route = null; director.setMode('orbit'); setActiveView(null);
  document.body.classList.add('las-mode', 'no-bim');
  $('s2b-log').textContent = '';
  rebuildTraffic(); rebuildFlow();
  installCloud(m);
  applySpacing();
  const h = m.header;
  $('site-name').textContent = `${file.name}（LAS ${h.version} / PF${h.format}${m.stride > 1 ? ` / 1:${m.stride} 間引き` : ''}）`;
  $('stat-elements').textContent = '—';
  $('stat-time').textContent = `${(m.spacing).toFixed(2)} m/pt`;
  $('drive-name').textContent = '—（実測データでは利用不可）';
  // fit camera and section box to the data
  // frame the bulk of the data (3rd–97th percentile), not stray far points
  const sx = [], sy = [], sz = []; for (let i = 0, st = Math.max(1, Math.floor(m.n / 20000)); i < m.n; i += st) { sx.push(cloud.pos[i * 3]); sy.push(cloud.pos[i * 3 + 1]); sz.push(cloud.pos[i * 3 + 2]); }
  const pct = (arr, f) => { arr.sort((p, q) => p - q); return arr[Math.min(arr.length - 1, Math.floor(arr.length * f))]; };
  const box = new THREE.Box3(new THREE.Vector3(pct(sx, 0.03), pct(sy, 0.03), pct(sz, 0.03)), new THREE.Vector3(pct(sx, 0.97), pct(sy, 0.97), pct(sz, 0.97)));
  const c = box.getCenter(new THREE.Vector3()), r = Math.max(10, box.getSize(new THREE.Vector3()).length() / 2);
  director.flyTo(c.clone().add(new THREE.Vector3(-0.6, 0.55, 0.75).normalize().multiplyScalar(r * 1.35)), c, 10);
  controls.maxDistance = r * 8;
  sectionBox.min.set(c.x - r, c.y - r, c.z - r); sectionBox.max.set(c.x + r, c.y + r, c.z + r); sectionBox.update();
  const cfg = [['sx0', c.x - r, c.x + r, c.x - r], ['sx1', c.x - r, c.x + r, c.x + r], ['sy0', c.y - r, c.y + r, c.y - r], ['sy1', c.y - r, c.y + r, c.y + r], ['sz0', c.z - r, c.z + r, c.z - r], ['sz1', c.z - r, c.z + r, c.z + r]];
  for (const [id, lo, hi, v] of cfg) { const sl = $(id); sl.min = lo; sl.max = hi; sl.value = v; }
  renderCrs();
  overlay.classList.add('hidden');
  const clsSet = new Set(m.cls);
  toast(`${m.n.toLocaleString()} 点を読み込みました（分類 ${clsSet.size} 種、平均点間隔 ${m.spacing.toFixed(2)} m）`, 5000);
  if (!clsSet.has(2) && !clsSet.has(6)) $('mode').value = m.rgb ? '5' : '2', $('mode').dispatchEvent(new Event('change'));
}
function exportLas() {
  if (!cloud) return;
  // colour from the LiDAR colormap (mode 0 formula) so CloudCompare / ReCap show the same look
  const lutData = lut.image.data, row = ROWS[state.row] ?? 0, n = cloud.n;
  const rgb = new Uint8Array(n * 3);
  const hMin = pointMat.uniforms.uHMin.value, hMax = pointMat.uniforms.uHMax.value;
  for (let i = 0; i < n; i++) {
    const I = Math.min(1, (cloud.inten[i] / 255) * state.gain), hN = Math.min(1, Math.max(0, (cloud.pos[i * 3 + 1] - hMin) / (hMax - hMin)));
    const t = 0.09 + 0.91 * Math.min(1, (I * (1 - state.heightMix) + hN * state.heightMix) * 1.08);
    const k = (row * 256 + Math.min(255, Math.max(0, Math.round(t * 255)))) * 4;
    rgb[i * 3] = lutData[k]; rgb[i * 3 + 1] = lutData[k + 1]; rgb[i * 3 + 2] = lutData[k + 2];
  }
  const crs = currentCrs();
  const buf = writeLas({ n, pos: cloud.pos, inten: cloud.inten, cls: cloud.cls, rgb }, { offset: crs.origin, epsg: crs.desc && crs.desc.tm ? crs.epsg : null });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
  a.download = (state.las ? state.las.name.replace(/\.la[sz]$/i, '') : `${state.site}-synth`) + '.las';
  document.body.appendChild(a); a.click(); a.remove();
  toast(`LAS 1.2 (PF2) を書き出しました: ${(buf.byteLength / 1e6).toFixed(0)} MB、${n.toLocaleString()} 点${crs.epsg ? `、EPSG:${crs.epsg}` : ''}`, 5000);
}
$('las-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadLasFile(f).catch((err) => { overlay.classList.add('hidden'); toast(`読み込み失敗: ${err.message}`, 6000); }); e.target.value = ''; });
$('las-export').addEventListener('click', exportLas);
canvas.addEventListener('dragover', (e) => { e.preventDefault(); });
canvas.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.la[sz]$/i.test(f.name)) loadLasFile(f).catch((err) => { overlay.classList.add('hidden'); toast(`読み込み失敗: ${err.message}`, 6000); }); });

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
  seqRange = seqs.length ? [Math.min(...seqs), Math.max(...seqs)] : [0, 1];
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
/** Nominal sample spacing per class (m) for the current density → splat radius in the shader. */
function applySpacing() {
  const D = state.density, sp = pointMat.uniforms.uSpacing.value;
  const s = (d, cap = 1.2) => Math.min(cap, 1 / Math.sqrt(d * D));
  sp.fill(0.5);
  sp[CLS.deck] = s(DENS.deck); sp[CLS.road] = s(DENS.arterial * 0.8); sp[CLS.marking] = 0.097 / Math.sqrt(D); // a 0.15 m line sampled at 16·D points per metre
  sp[CLS.railing] = s(DENS.railFace); sp[CLS.girder] = s(DENS.girderSide); sp[CLS.column] = s(DENS.column); sp[CLS.cap] = s(DENS.cap);
  sp[CLS.building] = s(DENS.wall * 0.8, 1.0); sp[CLS.floor] = s(DENS.floorSlab, 1.4); sp[CLS.ground] = s(DENS.ground, 1.3); sp[CLS.lowVeg] = s(DENS.grass, 1.3);
  sp[CLS.highVeg] = 0.45; sp[CLS.vehicle] = state.trafficOn ? 0.4 : s(6); sp[CLS.pole] = 0.12; sp[CLS.furniture] = 0.12; sp[CLS.gantry] = 0.1; sp[CLS.water] = 1.5; sp[CLS.noise] = 0.1;
  if (state.las) sp.fill(Math.min(2.5, Math.max(0.03, state.las.spacing * 1.1)));
  pointMat.uniforms.uTanHalfFov.value = Math.tan((camera.fov / 2) * Math.PI / 180);
}
function applyMode() {
  pointMat.uniforms.uMode.value = state.mode;
  pointMat.uniforms.uRow.value = ROWS[state.row] ?? 0;
  pointMat.uniforms.uHeightMix.value = state.heightMix;
  pointMat.uniforms.uSize.value = state.pointSize;
  pointMat.uniforms.uGain.value = state.gain;
  pointMat.uniforms.uDevRange.value = state.devRange;
  pointMat.uniforms.uSurfel.value = state.surfel ? 1 : 0;
  pointMat.uniforms.uShade.value = state.shade;
  applyStyle();
  $('row-group').style.display = state.mode <= 1 ? '' : 'none';
  $('mix-group').style.display = state.mode === 0 ? '' : 'none';
  $('dev-group').style.display = state.mode === 4 ? '' : 'none';
  renderLegend();
}
/** Rendering style: additive accumulation ("X-ray", like the reference footage) or opaque splats with EDL. */
const maxSplat = Math.min(220, (renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1] || 64) / renderer.getPixelRatio());
function applyStyle() {
  const accum = state.style === 'accum' && edl.canFloat;
  if ((pointMat.uniforms.uAccum.value > 0.5) !== accum) setAccumulation(pointMat, accum);
  edl.accumulate = accum; edl.exposure = state.exposure; edl.bloom = state.bloom;
  pointMat.uniforms.uFog.value = state.fog;
  // per-class opacity of one surface layer in accumulation mode (buildings and vegetation stay translucent)
  const W = pointMat.uniforms.uClsW.value; W.fill(1);
  if (!state.las) {
    W[CLS.deck] = 1.0; W[CLS.road] = 0.9; W[CLS.marking] = 3.0; W[CLS.railing] = 0.65; W[CLS.girder] = 0.4; W[CLS.column] = 0.7; W[CLS.cap] = 0.6;
    W[CLS.building] = 0.55; W[CLS.floor] = 0.35; W[CLS.ground] = 0.35; W[CLS.lowVeg] = 0.45; W[CLS.highVeg] = 0.3; W[CLS.water] = 0.5;
    W[CLS.vehicle] = 1.0; W[CLS.pole] = 0.6; W[CLS.gantry] = 0.8; W[CLS.furniture] = 0.6; W[CLS.noise] = 0.2;
  }
  // splat width: continuous surfaces are filled smoothly, facades and small objects stay crisp
  const K = pointMat.uniforms.uClsK.value; K.fill(state.las ? 1.2 : 0.7);
  const M = pointMat.uniforms.uClsMax.value; M.fill(state.las ? Math.min(maxSplat, 64) : 5);
  if (!state.las) { for (const c of [CLS.deck, CLS.road, CLS.ground, CLS.lowVeg, CLS.water, CLS.marking]) M[c] = maxSplat; for (const c of [CLS.railing, CLS.vehicle]) M[c] = Math.min(maxSplat, 40); for (const c of [CLS.girder, CLS.column, CLS.cap]) M[c] = 22; }
  if (!state.las) { for (const c of [CLS.deck, CLS.road, CLS.ground, CLS.lowVeg, CLS.water]) K[c] = 1.35; K[CLS.railing] = 1.0; K[CLS.girder] = 1.1; K[CLS.column] = 1.1; K[CLS.cap] = 1.1; K[CLS.marking] = 1.2; K[CLS.building] = 0.62; K[CLS.floor] = 0.9; K[CLS.vehicle] = 1.0; }
  document.body.classList.toggle('style-accum', accum);
  $('style').value = state.style; $('edl-row').style.display = accum ? 'none' : ''; $('exposure-row').style.display = accum ? '' : 'none';
  if (state.style === 'accum' && !edl.canFloat && !applyStyle.warned) { applyStyle.warned = true; toast('この GPU は浮動小数点レンダーターゲット非対応のため、ソリッド表示に切り替えました', 6000); }
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
raycaster.layers.enableAll();
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
    const hit = lod && points.visible ? raycaster.intersectObjects(lod.objects, false)[0] : null;
    if (hit) { showCoord(hit.point); measure.addPoint(hit.point); toast(measure.pending ? '2 点目をクリック' : `計測: ${(measure.items.at(-1).d).toFixed(3)} m`); }
    return;
  }
  if (flowViz && state.flowOn) {
    const hit = raycaster.intersectObject(flowViz.mesh, false)[0];
    if (hit) { selectFlow(flowViz.flowAtFace(hit.faceIndex)); return; }
  }
  let id = -1;
  if (bim && bim.group.visible) {
    const hit = raycaster.intersectObject(bim.faces, false)[0];
    if (hit) id = elementAtFace(bim.ranges, hit.faceIndex);
  }
  if (lod && points.visible) {
    const hit = raycaster.intersectObjects(lod.objects, false)[0];
    if (hit) { showCoord(hit.point); if (id < 0) { const el = cloud.elem[hit.object.userData.cell.offset + hit.index]; if (el !== NO_ELEM) id = el; } }
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
  const extra = { count, meanDev: count ? sum / count : null, maxDev: count ? maxAbs : null, coverage: state.las ? null : expected > 0 ? Math.min(100, (count / expected) * 100) : null };
  if (e.fit) extra.note = `RANSAC 当てはめ: ${e.round ? `半径 ${(e.fit.r * 1000).toFixed(0)} mm` : '矩形断面'}、残差 RMS ${(e.fit.rms * 1000).toFixed(0)} mm、天端の傾き ${(Math.hypot(e.fit.lean[0], e.fit.lean[1]) * 1000).toFixed(0)} mm`;
  if (e.settled && e.settled.length) extra.note = `沈下疑い: ${e.settled.map((sp) => `${sp.s.toFixed(0)} m 付近 ${sp.mm} mm`).slice(0, 4).join('、')}`;
  if (e.type === 'footing') extra.note = '地中部材：スキャン未取得（BIM のみ）';
  renderProperties(e, extra);
}
function expectedPoints(e) {
  switch (e.type) {
    case 'deck': return e.length * e.width * 16;
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
  // close-range views read better as opaque surfels; overviews as the accumulated X-ray look
  if (state.autoStyle) setStyle(v === 'drive' || v === 'low' ? 'solid' : 'accum');
  { const shape = v === 'top' ? 'band' : 'wall'; if (state.flowShape !== shape) { state.flowShape = shape; $('flow-shape').value = shape; if (flowViz) flowViz.update({ shape }); renderTrafficPanel(); } }
  if (v === 'drive') { if (!director.route) { toast('走行ルートがありません（実測データでは利用不可）'); setActiveView(null); return; } director.setMode('drive'); return; }
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
$('style').addEventListener('change', (e) => { state.style = e.target.value; applyStyle(); });
$('exposure').addEventListener('input', (e) => { state.exposure = +e.target.value; applyStyle(); });
$('bloom').addEventListener('input', (e) => { state.bloom = +e.target.value; applyStyle(); });
$('fog').addEventListener('input', (e) => { state.fog = +e.target.value; applyStyle(); });
$('traffic').addEventListener('change', async (e) => { state.trafficOn = e.target.checked; if (!state.las) { await rebuildCloud(); applyPhase(); } rebuildTraffic(); });
$('flow-on').addEventListener('change', (e) => { state.flowOn = e.target.checked; if (flowViz) flowViz.setVisible(state.flowOn); });
$('flow-metric').addEventListener('change', (e) => { state.flowMetric = e.target.value; if (flowViz) flowViz.update({ metric: state.flowMetric }); renderTrafficPanel(); });
$('flow-shape').addEventListener('change', (e) => { state.flowShape = e.target.value; if (flowViz) flowViz.update({ shape: state.flowShape }); renderTrafficPanel(); });
$('day-type').addEventListener('change', (e) => setDayType(e.target.value));
$('hour').addEventListener('input', (e) => setHour(+e.target.value, true));
$('hour-play').addEventListener('click', () => { state.hourPlaying = !state.hourPlaying; $('hour-play').textContent = state.hourPlaying ? '⏸ 停止' : '▶ 24時間を再生'; });
$('tpanel-toggle').addEventListener('click', () => document.body.classList.toggle('tpanel-min'));
$('pulse').addEventListener('change', (e) => { state.pulse = e.target.checked; });
$('reveal').addEventListener('click', () => startReveal());
function setStyle(v) { if (state.style === v) return; state.style = v; $('style').value = v; applyStyle(); }
$('surfel').addEventListener('change', (e) => { state.surfel = e.target.checked; applyMode(); });
$('shade').addEventListener('input', (e) => { state.shade = +e.target.value; applyMode(); });
$('devrange').addEventListener('change', (e) => { state.devRange = +e.target.value; applyMode(); });
$('density').addEventListener('change', async (e) => { state.density = +e.target.value; applySpacing(); if (state.las) return; await rebuildCloud(); applyPhase(); });
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
$('site').addEventListener('change', (e) => { state.site = e.target.value; state.isolateRoute = null; state.las = null; document.body.classList.remove('las-mode', 'no-bim'); controls.maxDistance = 3500; loadSite(state.site); });
$('budget').addEventListener('change', (e) => { state.budget = +e.target.value; });
$('isolate-reset').addEventListener('click', () => isolateRoute(null));
$('panel-toggle').addEventListener('click', () => document.body.classList.toggle('panel-collapsed'));
$('props-close').addEventListener('click', clearSelection);
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));

function applyPreset(name) {
  const set = (id, v) => { const el = $(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event(el.type === 'range' ? 'input' : 'change')); };
  if (name === 'lidar') { setStyle('accum'); set('mode', 0); set('row', 'lidar'); set('mix', 0.15); set('gain', 1.0); set('show-bim', false); set('show-levels', false); set('show-grid', false); set('edl', true); }
  if (name === 'mono') { setStyle('solid'); set('mode', 2); set('gain', 1.0); set('show-bim', false); set('show-levels', false); set('show-grid', false); set('edl', true); }
  if (name === 'bim') { setStyle('solid'); set('mode', 2); set('gain', 0.7); set('show-bim', true); set('bim-style', 'category'); set('show-levels', true); set('show-grid', true); }
  if (name === 'scan2bim') { setStyle('solid'); set('mode', 4); set('gain', 1.0); set('show-bim', true); set('bim-style', 'wire'); set('show-levels', false); set('show-grid', true); }
  if (name === 'xray') { setStyle('accum'); set('mode', 0); set('gain', 1.0); set('row', 'magma'); set('show-bim', true); set('bim-style', 'shaded'); set('show-bldg', true); set('mix', 0.55); }
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
}

// ---------------------------------------------------------------- loop
let last = performance.now(), frames = 0, fpsT = last;
const _dbSize = new THREE.Vector2();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.phasePlaying) { state.phase = Math.min(1, state.phase + dt * 0.06); $('phase').value = state.phase * 100; applyPhase(); if (state.phase >= 1) { state.phasePlaying = false; $('phase-play').textContent = '▶ 再生'; } }
  director.update(dt);
  if (state.hourPlaying) setHour(state.hour + dt * 0.5); // one hour every two seconds
  if (traffic) { traffic.points.visible = state.showCloud && state.phase >= 1 && !state.isolateRoute; if (traffic.points.visible) traffic.update(dt); }
  updateSweep(dt);
  pointMat.uniforms.uFogStart.value = director.mode === 'drive' ? 80 : camera.position.distanceTo(controls.target) * 0.75;
  pointMat.uniforms.uFog.value = state.fog * (director.mode === 'drive' ? 4 : 1);
  if (lod && points.visible) { const st = lod.update(camera, renderer.getDrawingBufferSize(_dbSize).y, state.budget); if ((frames & 15) === 0) $('stat-drawn').textContent = st.drawn.toLocaleString(); }
  if (grids && state.showGrid) { const cp = camera.position; for (const o of grids.children) if (o.element) { const d = cp.distanceTo(o.position); o.element.style.display = d < 420 ? '' : 'none'; o.element.style.opacity = d < 300 ? 1 : 1 - (d - 300) / 120; } }
  if (director.mode === 'drive') $('drive-progress').style.width = `${director.progress * 100}%`;
  edl.render(scene);
  labelRenderer.render(scene, camera);
  frames++;
  if (now - fpsT > 1000) { $('stat-fps').textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps`; frames = 0; fpsT = now; }
}

// debugging / automation hooks
window.__app = { get traffic() { return traffic; }, get flowModel() { return flowModel; }, get flowViz() { return flowViz; }, setHour, selectFlow, setDayType, startReveal, sweep, post: edl, pointMat, applyStyle, setStyle, maxSplat, select, clearSelection, zoomTo, applyPreset, isolateRoute, loadLasFile, exportLas, runScanToBim, get lod() { return lod; }, get elements() { return elements; }, get cloud() { return cloud; }, camera, controls, director, state };

resize();
applySpacing(); applyMode(); applyClsMask(); applySection(); clearSelection();
loadSite(state.site).then(() => { requestAnimationFrame(loop); toast('ドラッグで回転・ホイールでズーム・クリックで要素選択', 5000); });
