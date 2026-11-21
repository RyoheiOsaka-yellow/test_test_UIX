// Traffic simulation driven by real counts: on every way with data the number of vehicles is
// density = hourly volume / speed (veh/km) × length, the speed follows the census travel speed,
// and the truck share follows the heavy-vehicle ratio. Vehicles are point clusters drawn with the
// point material and updated on the CPU every frame.
import * as THREE from 'three';
import { samplePath, mulberry32 } from './geom.js';
import { atHour, speedAt } from './trafficdata.js';

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
      { area: l * w, f: (a, c) => [b.u0 + a * l, (c - 0.5) * w, b.h1, 0, 0, 1] },
      { area: l * h, f: (a, c) => [b.u0 + a * l, -w / 2, b.h0 + c * h, 0, -1, 0] },
      { area: l * h, f: (a, c) => [b.u0 + a * l, w / 2, b.h0 + c * h, 0, 1, 0] },
      { area: w * h, f: (a, c) => [b.u1, (a - 0.5) * w, b.h0 + c * h, 1, 0, 0] },
      { area: w * h, f: (a, c) => [b.u0, (a - 0.5) * w, b.h0 + c * h, -1, 0, 0] },
    ];
    for (const face of faces) {
      const n = Math.round(face.area * dens), o = rnd() * 9;
      for (let i = 0; i < n; i++) {
        const a = (o + i * 0.7548776662466927) % 1, c = (o * 1.37 + i * 0.5698402909980532) % 1;
        const p = face.f(a, c);
        const isGlass = p[2] > b.glass && p[5] === 0;
        if (isGlass && rnd() < 0.6) continue;
        pts.push({ u: p[0], v: p[1], h: p[2], nu: p[3], nv: p[4], nh: p[5], i: isGlass ? 0.2 : 0.5 + rnd() * 0.2 });
      }
    }
  }
  return pts;
}

export function buildTraffic(model, material, { maxVehicles = 3200 } = {}) {
  const rnd = mulberry32(11);
  const car = template('car', rnd), truck = template('truck', rnd);
  const JAM = 110; // veh/km/lane
  // pool per way sized for its busiest hour
  const tracks = [];
  let want = 0;
  for (const f of model.tracks) {
    let nMax = 0;
    for (let h = 0; h < 24; h++) nMax = Math.max(nMax, (f.q[h] / speedAt(f, h + 0.5)) * (f.L / 1000));
    const perDir = f.oneway ? f.lanes : Math.max(1, Math.round(f.lanes / 2));
    const lanesAll = f.oneway ? perDir : perDir * 2;
    nMax = Math.min(nMax, JAM * lanesAll * (f.L / 1000));
    tracks.push({ f, nMax, perDir, lanesAll, vehicles: [], active: 0 });
    want += nMax;
  }
  const scale = Math.min(1, maxVehicles / Math.max(1, want)); // if the pool is capped, every way is thinned equally
  const vehicles = [];
  for (const t of tracks) {
    const n = Math.ceil(t.nMax * scale);
    const hvDay = t.f.hv / 100;
    for (let i = 0; i < n; i++) {
      const isTruck = rnd() < hvDay;
      const dir = t.f.oneway ? 1 : (i % 2 ? -1 : 1);
      const lane = Math.floor(i / (t.f.oneway ? 1 : 2)) % t.perDir;
      const v = { t, dir, lane, s: ((i + rnd() * 0.6) / n) * t.f.L, k: 0.94 + rnd() * 0.12, tpl: isTruck ? truck : car, off: 0, on: false };
      t.vehicles.push(v); vehicles.push(v);
    }
    // activation order is shuffled so that thinning at night stays evenly spread along the way
    t.order = t.vehicles.map((_, i) => i).sort(() => rnd() - 0.5);
  }
  let total = 0; for (const v of vehicles) { v.off = total; total += v.tpl.length; }
  const pos = new Float32Array(total * 3).fill(1e7), nrm = new Int8Array(total * 3), inten = new Uint8Array(total), cls = new Uint8Array(total).fill(CLS_VEHICLE), dev = new Uint8Array(total).fill(128), elem = new Uint16Array(total).fill(65535);
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

  const stats = { active: 0, pool: vehicles.length, scale };
  let hour = 8;
  function setHour(h) {
    hour = h; let active = 0;
    for (const t of tracks) {
      const f = t.f, v = speedAt(f, h);
      t.speed = v / 3.6;
      const n = Math.min(t.vehicles.length, Math.round((atHour(f.q, h) / v) * (f.L / 1000) * scale + 0.35));
      if (n !== t.active) {
        for (let i = 0; i < t.order.length; i++) {
          const veh = t.vehicles[t.order[i]], on = i < n;
          if (veh.on && !on) { pos.fill(1e7, veh.off * 3, (veh.off + veh.tpl.length) * 3); } // park far outside the view
          veh.on = on;
        }
        t.active = n;
      }
      active += n;
    }
    stats.active = active;
  }
  function update(dt) {
    for (const t of tracks) {
      if (!t.active) continue;
      const f = t.f, L = f.L, laneW = (f.road.width - 0.9) / Math.max(1, f.lanes);
      for (const v of t.vehicles) {
        if (!v.on) continue;
        // the right-hand (overtaking) lane runs slightly faster
        v.s += t.speed * v.k * (1 + 0.05 * v.lane) * v.dir * dt;
        if (v.s > L) v.s -= L; else if (v.s < 0) v.s += L;
        const p = samplePath(f.path, v.s);
        const tx = p.tx * v.dir, tz = p.tz * v.dir, nx = p.nx * v.dir, nz = p.nz * v.dir;
        const lat = f.oneway ? -f.road.width / 2 + 0.45 + laneW * (v.lane + 0.5) : -laneW * (v.lane + 0.5);
        const bx = p.x + nx * lat, bz = p.z + nz * lat, by = p.y + 0.02;
        const tpl = v.tpl; let o = v.off * 3;
        for (let i = 0; i < tpl.length; i++, o += 3) {
          const q = tpl[i];
          pos[o] = bx + tx * q.u + nx * q.v; pos[o + 1] = by + q.h; pos[o + 2] = bz + tz * q.u + nz * q.v;
          nrm[o] = (tx * q.nu + nx * q.nv) * 127; nrm[o + 1] = q.nh * 127; nrm[o + 2] = (tz * q.nu + nz * q.nv) * 127;
        }
      }
    }
    posAttr.needsUpdate = true; nrmAttr.needsUpdate = true;
  }
  setHour(hour); update(0);
  return { points, update, setHour, stats, get count() { return stats.active; }, pointCount: total, dispose: () => geo.dispose() };
}
