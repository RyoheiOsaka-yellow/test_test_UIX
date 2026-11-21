// Dynamic traffic: vehicles are small point clusters that drive along the road network (left-hand
// traffic, simple car-following), updated on the CPU every frame and drawn with the point material.
import * as THREE from 'three';
import { resample, framePath, pathLength, samplePath, mulberry32 } from './geom.js';

const CLS_VEHICLE = 24, TRAFFIC_LAYER = 2; // same layer as POINT_LAYER in post.js

/** Quasi-uniform samples of a vehicle body in local coordinates (u forward, v right, h up). */
function template(kind, rnd) {
  const boxes = kind === 'truck'
    ? [{ u0: 2.6, u1: 4.9, w: 2.3, h0: 0.5, h1: 2.7, glass: 1.5 }, { u0: -4.9, u1: 2.4, w: 2.45, h0: 0.9, h1: 3.3, glass: 9 }]   // cab + cargo box
    : [{ u0: -2.2, u1: 2.2, w: 1.75, h0: 0.25, h1: 0.82, glass: 9 }, { u0: -1.45, u1: 0.75, w: 1.6, h0: 0.82, h1: 1.42, glass: 0.86 }]; // body + cabin
  const pts = [];
  const dens = kind === 'truck' ? 4.2 : 8.5;
  for (const b of boxes) {
    const l = b.u1 - b.u0, h = b.h1 - b.h0, w = b.w;
    const faces = [
      { area: l * w, f: (a, c) => [b.u0 + a * l, (c - 0.5) * w, b.h1, 0, 0, 1] },               // top
      { area: l * h, f: (a, c) => [b.u0 + a * l, -w / 2, b.h0 + c * h, 0, -1, 0] },             // left
      { area: l * h, f: (a, c) => [b.u0 + a * l, w / 2, b.h0 + c * h, 0, 1, 0] },               // right
      { area: w * h, f: (a, c) => [b.u1, (a - 0.5) * w, b.h0 + c * h, 1, 0, 0] },               // front
      { area: w * h, f: (a, c) => [b.u0, (a - 0.5) * w, b.h0 + c * h, -1, 0, 0] },              // back
    ];
    for (const face of faces) {
      const n = Math.round(face.area * dens), o = rnd() * 9;
      for (let i = 0; i < n; i++) {
        const a = (o + i * 0.7548776662466927) % 1, c = (o * 1.37 + i * 0.5698402909980532) % 1;
        const p = face.f(a, c);
        const isGlass = p[2] > b.glass && p[5] === 0; // side / front / rear glazing above the belt line
        if (isGlass && rnd() < 0.6) continue;
        pts.push({ u: p[0], v: p[1], h: p[2], nu: p[3], nv: p[4], nh: p[5], i: isGlass ? 0.2 : 0.5 + rnd() * 0.2 });
      }
    }
  }
  return pts;
}

export function buildTraffic(data, material, { rate = 1 } = {}) {
  const rnd = mulberry32(11);
  const tracks = [];
  for (const r of data.roads) {
    if (r.kind === 'street') continue;
    const path = framePath(resample(r.pts, 2));
    const L = pathLength(path);
    if (L < 10) continue;
    tracks.push({ road: r, path, L, lanes: Math.max(1, r.lanes), w: r.width, oneway: !!(r.oneway || r.elevated), elevated: !!r.elevated });
  }
  // entry points of every directed track → successor lookup at a vehicle's exit point
  const hash = new Map();
  const key = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  tracks.forEach((t, ti) => {
    for (const dir of t.oneway ? [1] : [1, -1]) {
      const p = dir > 0 ? t.path[0] : t.path[t.path.length - 1];
      const k = key(p.x, p.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push({ ti, dir, x: p.x, y: p.y, z: p.z });
    }
  });
  const successors = (ti, dir) => {
    const t = tracks[ti], p = dir > 0 ? t.path[t.path.length - 1] : t.path[0], out = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const l = hash.get(`${Math.floor(p.x / 4) + di},${Math.floor(p.z / 4) + dj}`); if (!l) continue;
      for (const c of l) if (c.ti !== ti && Math.hypot(c.x - p.x, c.z - p.z) < 3 && Math.abs(c.y - p.y) < 1.5) out.push(c);
    }
    return out;
  };
  const car = template('car', rnd), truck = template('truck', rnd);
  // spawn
  const vehicles = [];
  const totalL = tracks.reduce((a, t) => a + t.L, 0);
  for (const [ti, t] of tracks.entries()) {
    const per100 = (t.elevated ? 2.0 : 1.2) * rate;
    const n = Math.floor((t.L / 100) * t.lanes * per100 + rnd());
    for (let i = 0; i < n; i++) {
      const dir = t.oneway ? 1 : rnd() < 0.5 ? 1 : -1;
      const perDir = t.oneway ? t.lanes : Math.max(1, Math.floor(t.lanes / 2));
      const isTruck = rnd() < 0.16;
      const v0 = (t.road.kind === 'expressway' ? 17 + rnd() * 6 : t.road.kind === 'ramp' ? 11 + rnd() * 4 : 9 + rnd() * 5) * (isTruck ? 0.88 : 1);
      vehicles.push({ ti, dir, lane: Math.floor(rnd() * perDir), s: rnd() * t.L, v: v0, v0, tpl: isTruck ? truck : car, len: isTruck ? 9.8 : 4.4, off: 0 });
    }
  }
  let total = 0; for (const v of vehicles) { v.off = total; total += v.tpl.length; }
  const pos = new Float32Array(total * 3), nrm = new Int8Array(total * 3), inten = new Uint8Array(total), cls = new Uint8Array(total).fill(CLS_VEHICLE), dev = new Uint8Array(total).fill(128), elem = new Uint16Array(total).fill(65535);
  for (const v of vehicles) v.tpl.forEach((p, i) => { inten[v.off + i] = p.i * 255; });
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3), nrmAttr = new THREE.BufferAttribute(nrm, 3, true);
  posAttr.setUsage(THREE.DynamicDrawUsage); nrmAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr); geo.setAttribute('normal', nrmAttr);
  geo.setAttribute('intensity', new THREE.BufferAttribute(inten, 1, true));
  geo.setAttribute('cls', new THREE.BufferAttribute(cls, 1, false));
  geo.setAttribute('dev', new THREE.BufferAttribute(dev, 1, true));
  geo.setAttribute('elem', new THREE.BufferAttribute(elem, 1, false));
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false; points.layers.set(TRAFFIC_LAYER);
  points.onBeforeRender = () => { material.uniforms.uLodScale.value = 1; material.uniformsNeedUpdate = true; };

  const lateral = (t, v) => {
    const laneW = (t.w - 0.9) / t.lanes;
    if (t.oneway) return -t.w / 2 + 0.45 + laneW * (v.lane + 0.5);
    return -laneW * (v.lane + 0.5) * 1; // left of the centre line in the direction of travel
  };
  const groups = new Map();
  function update(dt) {
    // car following: per (track, direction, lane), slow down behind the leader
    groups.clear();
    for (const v of vehicles) { const k = v.ti * 64 + (v.dir > 0 ? 0 : 32) + v.lane; let g = groups.get(k); if (!g) { g = []; groups.set(k, g); } g.push(v); }
    for (const g of groups.values()) {
      g.sort((a, b) => (a.s - b.s) * a.dir);
      for (let i = 0; i < g.length; i++) {
        const v = g[i], lead = g[i + 1];
        let target = v.v0;
        if (lead) { const gap = Math.abs(lead.s - v.s) - (lead.len + v.len) / 2; target = Math.min(target, Math.max(0, (gap - 5) / 1.3)); }
        v.v += Math.max(-7 * dt, Math.min(2.2 * dt, target - v.v));
      }
    }
    for (const v of vehicles) {
      let t = tracks[v.ti];
      v.s += v.v * v.dir * dt;
      if (v.s > t.L || v.s < 0) {
        const succ = successors(v.ti, v.dir);
        if (succ.length) {
          const c = succ[Math.floor(rnd() * succ.length)], over = v.s > t.L ? v.s - t.L : -v.s;
          v.ti = c.ti; v.dir = c.dir; t = tracks[v.ti];
          v.s = c.dir > 0 ? over : t.L - over;
          const perDir = t.oneway ? t.lanes : Math.max(1, Math.floor(t.lanes / 2));
          v.lane = Math.min(v.lane, perDir - 1);
        } else { // dead end (edge of the model): re-enter somewhere else
          let r = rnd() * totalL, ti = 0; while (ti < tracks.length - 1 && r > tracks[ti].L) { r -= tracks[ti].L; ti++; }
          v.ti = ti; t = tracks[ti]; v.dir = t.oneway ? 1 : rnd() < 0.5 ? 1 : -1; v.s = v.dir > 0 ? 0 : t.L;
          const perDir = t.oneway ? t.lanes : Math.max(1, Math.floor(t.lanes / 2));
          v.lane = Math.floor(rnd() * perDir);
        }
      }
      const p = samplePath(t.path, Math.max(0, Math.min(t.L, v.s)));
      const tx = p.tx * v.dir, tz = p.tz * v.dir, nx = p.nx * v.dir, nz = p.nz * v.dir;
      const lat = lateral(t, v);
      const bx = p.x + nx * lat, bz = p.z + nz * lat, by = p.y + 0.02;
      const tpl = v.tpl; let o = v.off * 3;
      for (let i = 0; i < tpl.length; i++, o += 3) {
        const q = tpl[i];
        pos[o] = bx + tx * q.u + nx * q.v; pos[o + 1] = by + q.h; pos[o + 2] = bz + tz * q.u + nz * q.v;
        nrm[o] = (tx * q.nu + nx * q.nv) * 127; nrm[o + 1] = q.nh * 127; nrm[o + 2] = (tz * q.nu + nz * q.nv) * 127;
      }
    }
    posAttr.needsUpdate = true; nrmAttr.needsUpdate = true;
  }
  update(0);
  return { points, update, count: vehicles.length, pointCount: total, dispose: () => geo.dispose() };
}
