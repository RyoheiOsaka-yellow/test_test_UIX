// Traffic-volume geometry: along every road with data, either a vertical "curtain" whose height is
// proportional to the volume, or a flat band whose width is. Colours follow the selected metric.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { METRICS, RAMPS, atHour } from './trafficdata.js';

export function buildFlowViz(model) {
  const group = new THREE.Group();
  let nv = 0, nt = 0;
  for (const f of model.flows) { nv += f.path.length * 2; nt += (f.path.length - 1) * 2; }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4), idx = new Uint32Array(nt * 3);
  const ranges = [];
  let v = 0, t = 0;
  for (const [fi, f] of model.flows.entries()) {
    f.vOff = v; const t0 = t;
    for (let k = 0; k < f.path.length - 1; k++) { const a = v + k * 2; idx[t * 3] = a; idx[t * 3 + 1] = a + 1; idx[t * 3 + 2] = a + 2; t++; idx[t * 3] = a + 1; idx[t * 3 + 1] = a + 3; idx[t * 3 + 2] = a + 2; t++; }
    ranges.push({ start: t0, end: t, fi });
    v += f.path.length * 2;
  }
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(pos, 3), colA = new THREE.BufferAttribute(col, 4);
  posA.setUsage(THREE.DynamicDrawUsage); colA.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA); geo.setAttribute('color', colA); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  group.add(mesh);
  // section labels (measured sections only)
  const labels = [];
  for (const s of model.sections) {
    if (!s.ways.length) continue;
    const w = s.ways.slice().sort((a, b) => b.L - a.L)[0], p = w.path[w.path.length >> 1];
    const el = document.createElement('div'); el.className = 'flow-label';
    const lab = new CSS2DObject(el); lab.position.set(p.x, p.y + 4, p.z);
    group.add(lab); labels.push({ lab, el, s, base: p.y + 4 });
  }
  const state = { metric: 'v24', shape: 'wall', hour: 8, selected: -1 };
  function update(opts = {}) {
    Object.assign(state, opts);
    const M = METRICS[state.metric], rampFn = RAMPS[M.ramp], wall = state.shape === 'wall';
    const hMax = 70, wMax = 34; // metres at the site maximum
    for (const [fi, f] of model.flows.entries()) {
      // size always encodes volume (daily, or hourly when an hourly metric is shown); colour encodes the metric
      const hourly = state.metric !== 'v24' && state.metric !== 'congestion' && state.metric !== 'growth';
      const frac = hourly ? METRICS.qh.value(f, state.hour) / model.qmax : f.v24 / model.vmax;
      const val = M.value(f, state.hour);
      const c = M.measuredOnly && !f.measured ? [0.45, 0.47, 0.52] : rampFn(M.norm(val, model));
      const sel = state.selected >= 0 && model.flows[state.selected].sec === f.sec && f.measured === model.flows[state.selected].measured;
      const alpha = (f.measured ? 0.62 : 0.3) * (state.selected >= 0 && !sel ? 0.35 : 1);
      const size = Math.max(0.03, frac);
      f.height = wall ? 1.5 + size * hMax : 0;
      let o = f.vOff * 3, oc = f.vOff * 4;
      for (const p of f.path) {
        if (wall) {
          pos[o] = p.x; pos[o + 1] = p.y + 0.4; pos[o + 2] = p.z;
          pos[o + 3] = p.x; pos[o + 4] = p.y + 0.4 + f.height; pos[o + 5] = p.z;
          col[oc] = c[0]; col[oc + 1] = c[1]; col[oc + 2] = c[2]; col[oc + 3] = alpha * 0.25;       // fades towards the road
          col[oc + 4] = c[0]; col[oc + 5] = c[1]; col[oc + 6] = c[2]; col[oc + 7] = alpha * 1.25;
        } else {
          const hw = (1.5 + size * wMax) / 2;
          pos[o] = p.x - p.nx * hw; pos[o + 1] = p.y + 0.5; pos[o + 2] = p.z - p.nz * hw;
          pos[o + 3] = p.x + p.nx * hw; pos[o + 4] = p.y + 0.5; pos[o + 5] = p.z + p.nz * hw;
          col[oc] = c[0]; col[oc + 1] = c[1]; col[oc + 2] = c[2]; col[oc + 3] = alpha;
          col[oc + 4] = c[0]; col[oc + 5] = c[1]; col[oc + 6] = c[2]; col[oc + 7] = alpha;
        }
        o += 6; oc += 8;
      }
    }
    posA.needsUpdate = true; colA.needsUpdate = true;
    for (const L of labels) {
      const w = L.s.ways[0], st = L.s.st, day = L.s.day;
      const hourly = state.metric !== 'v24' && state.metric !== 'congestion' && state.metric !== 'growth';
      const secQ = atHour(day.small.map((x, i) => x + day.large[i]), state.hour); // both directions
      const main = hourly ? `${Math.round(secQ).toLocaleString()}<small> 台/時</small>` : `${day.v24.toLocaleString()}<small> 台/日${day.est ? '（推定）' : ''}</small>`;
      const extra = state.metric === 'congestion' ? `混雑度 ${st.congestion.toFixed(2)}` : state.metric === 'speed' ? `${Math.round(METRICS.speed.value(w, state.hour))} km/h` : state.metric === 'heavy' ? `大型 ${METRICS.heavy.value(w, state.hour).toFixed(0)} %` : state.metric === 'growth' && st.growth ? `H27比 ${st.growth >= 1 ? '+' : ''}${Math.round((st.growth - 1) * 100)} %` : '';
      L.el.innerHTML = `<b>${main}</b>${extra ? `<span>${extra}</span>` : ''}`;
      L.lab.position.y = L.base + (wall ? Math.max(...L.s.ways.map((f) => f.height)) : 2);
    }
  }
  function flowAtFace(faceIndex) { for (const r of ranges) if (faceIndex >= r.start && faceIndex < r.end) return r.fi; return -1; }
  function dispose() { geo.dispose(); mat.dispose(); for (const L of labels) L.el.remove(); }
  function setVisible(v) { group.visible = v; group.traverse((o) => { o.visible = v; }); }
  update();
  return { group, mesh, update, flowAtFace, dispose, setVisible, state };
}
