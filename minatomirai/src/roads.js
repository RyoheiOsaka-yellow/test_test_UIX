// 道路の精密化 (リアル表示用): 車道・歩道 (縁石 15cm)・区画線 (外側線/中央線/車線境界線/横断歩道/停止線)・車の流れ。
// データは tools/road_detail.py が OSM 中心線 + PLATEAU 道路面から生成 (header.roadDetail, blob road_marks)。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CAR_COLORS = ['#f2f2f2', '#f2f2f2', '#d9d9d9', '#b7bcc4', '#2b2b2b', '#1c2a44', '#7a1e1e', '#2f4f3a', '#e8d26a', '#c9c9c9', '#3b3f45', '#f2f2f2'];

function carGeometry() {
  const parts = [];
  const add = (w, h, d, x, y, z, col) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
    const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = col[0]; c[i + 1] = col[1]; c[i + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g);
  };
  add(4.3, 0.62, 1.74, 0, 0.62, 0, [1, 1, 1]);                 // ボディ (インスタンス色が乗る)
  add(2.3, 0.58, 1.58, -0.25, 1.2, 0, [0.22, 0.26, 0.3]);     // キャビン (ガラス)
  for (const [x, z] of [[1.35, 0.8], [1.35, -0.8], [-1.35, 0.8], [-1.35, -0.8]]) add(0.62, 0.6, 0.22, x, 0.3, z, [0.05, 0.05, 0.05]);
  const g = mergeGeometries(parts); g.computeVertexNormals(); return g;
}
function lightGeometry() {
  const parts = [];
  const add = (x, z, col) => { const g = new THREE.BoxGeometry(0.06, 0.16, 0.36); g.translate(x, 0.7, z); const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = col[0]; c[i + 1] = col[1]; c[i + 2] = col[2]; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g); };
  add(2.16, 0.55, [1.0, 0.97, 0.85]); add(2.16, -0.55, [1.0, 0.97, 0.85]); add(-2.16, 0.55, [1.0, 0.08, 0.05]); add(-2.16, -0.55, [1.0, 0.08, 0.05]);
  return mergeGeometries(parts);
}

export function initRoadDetail(ctx) {
  const { header, blobs, terrainSampler, shapeFromRings, flatGeometry, group, bldUniforms, realState } = ctx;
  const rd = header.roadDetail; if (!rd) return null;
  let built = false, on = false;
  const surf = new THREE.Group(), marksG = new THREE.Group(), carsG = new THREE.Group(); group.add(surf, marksG, carsG);
  let cars = null, lights = null, carList = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  function drape(g, lift) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, terrainSampler(p.getX(i), -p.getZ(i)) + lift + p.getY(i));
    g.computeVertexNormals(); return g;
  }
  function build() {
    built = true; const T0 = performance.now(); const tm = {}; let tl = T0; const lap = k => { const n = performance.now(); tm[k] = Math.round(n - tl); tl = n; };
    // ---- 車道 (アスファルト) ----
    const carGeos = []; for (const rings of rd.car) { const sh = shapeFromRings(rings); if (!sh) continue; carGeos.push(drape(flatGeometry(sh, 0), 0.14)); }
    if (carGeos.length) { const m = new THREE.Mesh(mergeGeometries(carGeos), new THREE.MeshStandardMaterial({ color: '#45464a', roughness: 0.93, metalness: 0 })); m.receiveShadow = true; m.name = 'carway'; surf.add(m); }
    lap('car');
    // ---- 歩道 (15cm 高い面 + 縁石の側面) ----
    const walkGeos = []; for (const rings of rd.walk) { const sh = shapeFromRings(rings); if (!sh) continue; walkGeos.push(drape(flatGeometry(sh, 0.15), 0.12)); }
    if (walkGeos.length) { const m = new THREE.Mesh(mergeGeometries(walkGeos), new THREE.MeshStandardMaterial({ color: '#a4a39d', roughness: 0.96, metalness: 0 })); m.receiveShadow = true; m.name = 'sidewalk'; surf.add(m); }
    lap('walk');
    // ---- 区画線 (四角形の帯) ----
    const mk = blobs.road_marks; const n = mk.length / 6;
    const pos = new Float32Array(n * 12), col = new Float32Array(n * 12), nor = new Float32Array(n * 12), idx = new Uint32Array(n * 6);
    const white = [0.95, 0.95, 0.93], yellow = [0.95, 0.78, 0.2];
    for (let i = 0; i < n; i++) {
      const x0 = mk[i * 6] / 10, y0 = mk[i * 6 + 1] / 10, x1 = mk[i * 6 + 2] / 10, y1 = mk[i * 6 + 3] / 10, hw = mk[i * 6 + 4] / 200, c = mk[i * 6 + 5] ? yellow : white;
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1; const nx = -dy / L * hw, ny = dx / L * hw;
      const q = [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny]];
      q.forEach(([x, y], k) => { const o = i * 12 + k * 3; pos[o] = x; pos[o + 1] = terrainSampler(x, y) + 0.165; pos[o + 2] = -y; col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2]; nor[o + 1] = 1; });
      const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 2; idx[o + 2] = b + 1; idx[o + 3] = b; idx[o + 4] = b + 3; idx[o + 5] = b + 2;
    }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('color', new THREE.BufferAttribute(col, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setIndex(new THREE.BufferAttribute(idx, 1));
    const mm = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); mm.receiveShadow = true; mm.name = 'marks'; marksG.add(mm);
    lap('marks');
    // ---- 車線経路と車 ----
    const lanes = [];
    for (const ln of rd.lanes) {
      const pts = [];
      for (const q of ln.p) {
        const x = q[0] / 10, y = q[1] / 10;
        const h = q.length > 2 ? q[2] / 10 + 0.1 : terrainSampler(x, y) + 0.15;   // 橋の上は build 時に橋梁メッシュから求めた路面高さ
        pts.push(new THREE.Vector3(x, h, -y));
      }
      if (pts.length < 2) continue;
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      lanes.push({ pts, cum, len: cum[cum.length - 1], v: ln.v * (0.85 + Math.random() * 0.3) });
    }
    carList = [];
    for (const ln of lanes) {
      const nCar = Math.floor(ln.len / 55 + Math.random() * 0.9); const gap = ln.len / Math.max(nCar, 1);
      for (let i = 0; i < nCar; i++) carList.push({ ln, s: (i + Math.random() * 0.5) * gap, c: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] });
    }
    const N = carList.length;
    cars = new THREE.InstancedMesh(carGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5, envMapIntensity: 1.2 }), N);
    lights = new THREE.InstancedMesh(lightGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), N);
    cars.castShadow = true; cars.receiveShadow = true; cars.name = 'cars'; lights.name = 'carlights'; lights.visible = false;
    const colr = new THREE.Color(); carList.forEach((c, i) => cars.setColorAt(i, colr.set(c.c)));
    cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    carsG.add(cars, lights); step(0);
    lap('cars');
    console.log(`road detail: lanes ${lanes.length}, cars ${N}, marks ${n}; ms ${JSON.stringify(tm)} total ${Math.round(performance.now() - T0)}`);
  }
  const dir = new THREE.Vector3();
  function step(dt) {
    if (!cars) return;
    for (let i = 0; i < carList.length; i++) {
      const c = carList[i], ln = c.ln; c.s += ln.v * dt; if (c.s >= ln.len) c.s -= ln.len;
      // 区間を二分探索
      let lo = 0, hi = ln.cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ln.cum[mid] <= c.s) lo = mid; else hi = mid; }
      const a = ln.pts[lo], b = ln.pts[lo + 1] || a; const segL = ln.cum[lo + 1] - ln.cum[lo] || 1; const t = (c.s - ln.cum[lo]) / segL;
      P.lerpVectors(a, b, t); dir.subVectors(b, a); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); dir.normalize();
      Q.setFromAxisAngle(UP, Math.atan2(-dir.z, dir.x)); M.compose(P, Q, S); cars.setMatrixAt(i, M); lights.setMatrixAt(i, M);
    }
    cars.instanceMatrix.needsUpdate = true; lights.instanceMatrix.needsUpdate = true;
  }
  function applyOptions() {
    surf.visible = marksG.visible = on && realState.roads !== false; carsG.visible = on && realState.traffic !== false;
  }
  function enable(v) { on = v; if (v && !built) build(); group.visible = v; applyOptions(); }
  function update(dt) { if (!on || !cars || !carsG.visible) return; step(dt); lights.visible = bldUniforms.uNight.value > 0.5; }
  return { enable, update, applyOptions, get cars() { return cars; } };
}
