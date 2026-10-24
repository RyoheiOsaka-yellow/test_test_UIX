// LiDAR point-cloud synthesis. Runs inside a Web Worker. Produces typed arrays:
//   positions (Float32 x3), intensity (Uint8), cls (Uint8), dev (Uint8, 128 = 0 mm), elem (Uint16)
import { mulberry32, gauss, resample, framePath, pathLength, samplePath, polygonArea, polygonBBox, pointInPolygon, Raster, hashStr } from './geom.js';
import { buildStructure, DECK_T } from './structure.js';

export const CLS = {
  unclassified: 1, ground: 2, lowVeg: 3, highVeg: 5, building: 6, water: 9, road: 11, deck: 17, noise: 18,
  marking: 20, railing: 21, column: 22, girder: 23, vehicle: 24, pole: 25, floor: 26, cap: 27, footing: 28, gantry: 29,
  furniture: 30,
};
export const CLS_INFO = [
  [CLS.ground, '地盤', 0x8a6d4b], [CLS.lowVeg, '低植生', 0x7cb342], [CLS.highVeg, '樹木', 0x2e7d32],
  [CLS.building, '建物', 0xc9b79c], [CLS.floor, '建物 床版', 0x8fa3b3], [CLS.water, '水面', 0x1e88e5],
  [CLS.road, '一般道 路面', 0x5c5c66], [CLS.deck, '高架 床版', 0x9b59b6], [CLS.marking, '区画線', 0xfff176],
  [CLS.railing, '壁高欄', 0x26c6da], [CLS.girder, '主桁', 0xff8a65], [CLS.column, '橋脚', 0xba68c8],
  [CLS.cap, '横梁', 0xffb74d], [CLS.vehicle, '車両', 0xff5252], [CLS.pole, '照明柱', 0xe0e0e0],
  [CLS.gantry, '標識柱', 0xf5f5f5], [CLS.furniture, '電柱・街路施設', 0xb0bec5], [CLS.noise, 'ノイズ', 0x555555],
];
const NO_ELEM = 65535;

class Cloud {
  constructor(cap) { this.n = 0; this.cap = cap; this.alloc(); }
  alloc() {
    this.pos = new Float32Array(this.cap * 3); this.inten = new Uint8Array(this.cap); this.cls = new Uint8Array(this.cap);
    this.dev = new Uint8Array(this.cap); this.elem = new Uint16Array(this.cap); this.nrm = new Int8Array(this.cap * 3);
  }
  push(x, y, z, i, c, d, e, nx = 0, ny = 0, nz = 0) {
    if (this.n >= this.cap) {
      const o = this; const old = { pos: o.pos, inten: o.inten, cls: o.cls, dev: o.dev, elem: o.elem, nrm: o.nrm };
      this.cap = Math.ceil(this.cap * 1.6); this.alloc();
      this.pos.set(old.pos); this.inten.set(old.inten); this.cls.set(old.cls); this.dev.set(old.dev); this.elem.set(old.elem); this.nrm.set(old.nrm);
    }
    const k = this.n++;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.nrm[k * 3] = nx * 127; this.nrm[k * 3 + 1] = ny * 127; this.nrm[k * 3 + 2] = nz * 127;
    this.inten[k] = i < 0 ? 0 : i > 1 ? 255 : (i * 255) | 0;
    this.cls[k] = c;
    const dv = 128 + d;
    this.dev[k] = dv < 0 ? 0 : dv > 255 ? 255 : dv | 0;
    this.elem[k] = e;
  }
  finish() {
    return { n: this.n, pos: this.pos.slice(0, this.n * 3), inten: this.inten.slice(0, this.n), cls: this.cls.slice(0, this.n), dev: this.dev.slice(0, this.n), elem: this.elem.slice(0, this.n), nrm: this.nrm.slice(0, this.n * 3) };
  }
}

// nominal surface densities (points / m²) at density = 1
export const DENS = {
  deck: 11, arterial: 4.5, street: 4.0, marking: 16, sidewalk: 3.2, kerb: 8, railFace: 6.5, railTop: 18,
  girderSide: 2.2, girderBot: 1.0, column: 7, cap: 5, wall: 0.55, roof: 0.4, floorSlab: 0.09, ground: 0.8, grass: 0.4,
};

export function synthesize(data, { density = 1, seed = 1 } = {}, progress = () => {}) {
  const rnd = mulberry32(seed);
  const jit = () => (rnd() + rnd() - 1) * 0.025; // ~σ 10 mm ranging noise
  const cloud = new Cloud(Math.round(3.2e6 * density + 3e5));
  const { elements } = buildStructure(data);
  const D = density;
  const [cw, ch] = data.site.cropM;
  const inCrop = (x, z) => Math.abs(x) <= cw / 2 && Math.abs(z) <= ch / 2;
  const cnt = (n) => Math.floor(n) + (rnd() < n - Math.floor(n) ? 1 : 0);

  // deviation (mm) of an element at a given point, signed
  const devAt = (e, x, y, z, u = 0) => {
    const a = e.asBuilt;
    let dx = a.dx, dy = a.dy, dz = a.dz;
    if (e.type === 'column') { const f = (y - e.yBot) / Math.max(1, e.yTop - e.yBot); dx *= f; dz *= f; }
    if (e.type === 'railing') { const f = Math.sin(Math.PI * u); dx *= f; }
    const mag = dy !== 0 ? dy : Math.hypot(dx, dz) * (e.type === 'railing' ? Math.sign(e.asBuilt.dx) : 1);
    return { dx, dy, dz, mm: mag * 1000 + gauss(rnd) * 2.5 };
  };
  // current surface normal for emitted points (0,0,0 = none → rendered as a disc)
  let cn0 = 0, cn1 = 0, cn2 = 0;
  const N = (x, y, z) => { cn0 = x; cn1 = y; cn2 = z; };
  const UP = () => N(0, 1, 0);
  const emitE = (e, x, y, z, i, c, u = 0) => {
    const d = devAt(e, x, y, z, u);
    cloud.push(x + d.dx + jit(), y + d.dy + jit(), z + d.dz + jit(), i + (rnd() - 0.5) * 0.06, c, d.mm, e.id, cn0, cn1, cn2);
  };
  const emit = (x, y, z, i, c) => cloud.push(x + jit(), y + jit(), z + jit(), i + (rnd() - 0.5) * 0.06, c, gauss(rnd) * 2.5, NO_ELEM, cn0, cn1, cn2);
  // generic helpers (unassigned points)
  const vline = (x, z, y0, y1, perM, inten, cls, r = 0.08) => { N(0, 0, 0); for (let k = 0, n = (y1 - y0) * perM * D; k < n; k++) emit(x + (rnd() - 0.5) * r, y0 + rnd() * (y1 - y0), z + (rnd() - 0.5) * r, inten, cls); };
  const seg = (ax, ay, az, bx, by, bz, perM, inten, cls, r = 0.05, sag = 0) => {
    N(0, 0, 0);
    const L = Math.hypot(bx - ax, by - ay, bz - az);
    for (let k = 0, n = L * perM * D; k < n; k++) { const t = rnd(); emit(ax + (bx - ax) * t + (rnd() - 0.5) * r, ay + (by - ay) * t - sag * 4 * t * (1 - t), az + (bz - az) * t + (rnd() - 0.5) * r, inten, cls); }
  };
  const boxU = (cx, cy, cz, tx, tz, l, w, h, dens, inten, cls, top = true) => {
    const nx = -tz, nz = tx;
    const area = 2 * (l * h + w * h) + (top ? l * w : 0);
    for (let k = 0, n = area * dens * D; k < n; k++) {
      const f = rnd() * area; let u, v, y;
      if (f < l * h) { u = (rnd() - 0.5) * l; v = -w / 2; y = rnd() * h; N(-nx, 0, -nz); }
      else if (f < 2 * l * h) { u = (rnd() - 0.5) * l; v = w / 2; y = rnd() * h; N(nx, 0, nz); }
      else if (f < 2 * l * h + w * h) { u = -l / 2; v = (rnd() - 0.5) * w; y = rnd() * h; N(-tx, 0, -tz); }
      else if (f < 2 * (l * h + w * h)) { u = l / 2; v = (rnd() - 0.5) * w; y = rnd() * h; N(tx, 0, tz); }
      else { u = (rnd() - 0.5) * l; v = (rnd() - 0.5) * w; y = h; UP(); }
      emit(cx + tx * u + nx * v, cy + y, cz + tz * u + nz * v, inten, cls);
    }
  };

  // ---------- raster masks for ground sampling ----------
  const mask = new Raster(cw, ch, 1);
  for (const b of data.buildings) mask.fillPolygon(b.pts, 1);
  for (const w of data.water) mask.fillPolygon(w, 2);
  for (const p of data.parks) mask.fillPolygon(p, 4);

  // ---------- vehicles ----------
  function vehicle(p, v, elev, e, parked = false) {
    const truck = !parked && rnd() < 0.18;
    const len = truck ? 8 + rnd() * 4 : 4.1 + rnd() * 0.9, wid = truck ? 2.4 : 1.75, hgt = truck ? 3.2 : 1.45;
    const cx = p.x + p.nx * v, cz = p.z + p.nz * v, cy = p.y;
    const m = (len * wid + 2 * len * hgt + 2 * wid * hgt) * 6 * D;
    for (let k = 0; k < m; k++) {
      const face = rnd();
      let u = (rnd() - 0.5) * len, vv = (rnd() - 0.5) * wid, h = hgt, inten = 0.55;
      if (face < 0.4) { h = hgt * (truck ? 1 : 0.86 + 0.14 * Math.cos((u / len) * 3)); UP(); }
      else if (face < 0.8) { const sd = rnd() < 0.5 ? -1 : 1; vv = sd * wid / 2; h = rnd() * hgt; N(p.nx * sd, 0, p.nz * sd); if (!truck && h > hgt * 0.55) { if (rnd() < 0.7) continue; inten = 0.2; } }
      else { const sd = rnd() < 0.5 ? -1 : 1; u = sd * len / 2; h = rnd() * hgt; N(p.tx * sd, 0, p.tz * sd); if (h > hgt * 0.6 && rnd() < 0.5) continue; }
      const x = cx + p.tx * u + p.nx * vv, z = cz + p.tz * u + p.nz * vv;
      if (e) emitE(e, x, cy + h, z, inten + rnd() * 0.15, CLS.vehicle); else emit(x, cy + h, z, inten + rnd() * 0.15, CLS.vehicle);
    }
  }
  function vehicles(path, road, elev, e) {
    const L = pathLength(path), w = road.width;
    const lanes = Math.max(1, road.lanes), laneW = (w - 0.9) / lanes;
    const per100 = road.kind === 'street' ? 0.3 : elev ? 2.0 : 1.3;
    for (let q = 0, n = cnt((L / 100) * lanes * per100); q < n; q++) {
      const p = samplePath(path, rnd() * L);
      const lane = Math.floor(rnd() * lanes);
      vehicle(p, -w / 2 + 0.45 + laneW * (lane + 0.5), elev, e);
    }
    if (!elev && road.kind === 'street' && L > 30) {
      for (let s = 10; s < L - 5; s += 36) if (rnd() < 0.5) vehicle(samplePath(path, s), (rnd() < 0.5 ? -1 : 1) * (w / 2 - 1.1), false, null, true);
    }
  }

  // ---------- pavement (shared by at-grade roads and decks) ----------
  function pavement(path, road, elev, e) {
    const w = road.width, L = pathLength(path);
    const base = elev ? DENS.deck : road.kind === 'arterial' ? DENS.arterial : DENS.street;
    const cls = elev ? CLS.deck : CLS.road;
    const lanes = Math.max(1, road.lanes);
    const laneW = (w - 0.9) / lanes;
    const put = (x, y, z, i, c, u) => (e ? emitE(e, x, y, z, i, c, u) : emit(x, y, z, i, c));
    UP();
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      const ds = b.s - a.s;
      for (let q = 0, n = cnt(ds * w * base * D); q < n; q++) {
        const t = rnd(), v = (rnd() - 0.5) * w;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
        const lanePos = ((v + w / 2) % laneW) / laneW;
        const wear = Math.abs(lanePos - 0.25) < 0.08 || Math.abs(lanePos - 0.75) < 0.08 ? -0.025 : 0;
        put(x + nx * v, y + 0.01, z + nz * v, 0.13 + wear + rnd() * 0.05, cls, a.s / L);
      }
      // markings
      const lines = road.kind === 'street' ? [] : [[-w / 2 + 0.45, 'solid'], [w / 2 - 0.45, 'solid']];
      if (road.kind !== 'street') for (let l = 1; l < lanes; l++) lines.push([-w / 2 + 0.45 + l * laneW, road.oneway ? 'dash' : l === lanes / 2 ? 'solid' : 'dash']);
      if (!road.oneway && lanes === 1 && road.kind !== 'street') lines.push([0, 'solid']);
      for (const [v, kind] of lines) {
        for (let q = 0, m = cnt(ds * DENS.marking * D); q < m; q++) {
          const t = rnd(), s = a.s + ds * t;
          if (kind === 'dash' && s % 15 > 6) continue;
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
          const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
          const vv = v + (rnd() - 0.5) * 0.15;
          put(x + nx * vv, y + 0.015, z + nz * vv, 0.82 + rnd() * 0.15, CLS.marking, s / L);
        }
      }
    }
    // lane arrows every 80 m, expansion joints every 40 m (elevated)
    UP();
    if (road.kind !== 'street') {
      for (let s = 40; s < L - 10; s += 80) {
        const p = samplePath(path, s);
        for (let l = 0; l < lanes; l++) {
          const v = -w / 2 + 0.45 + laneW * (l + 0.5);
          for (let k = 0, n = 70 * D; k < n; k++) {
            const u = rnd() * 4.5, half = u < 3 ? 0.17 : 0.55 - (u - 3) * 0.35;
            const vv = v + (rnd() - 0.5) * 2 * half;
            put(p.x + p.tx * u + p.nx * vv, p.y + 0.015, p.z + p.tz * u + p.nz * vv, 0.85 + rnd() * 0.1, CLS.marking, s / L);
          }
        }
      }
    }
    if (elev) {
      for (let s = 20; s < L - 5; s += 40) {
        const p = samplePath(path, s);
        for (let k = 0, n = w * 14 * D; k < n; k++) { const v = (rnd() - 0.5) * w; put(p.x + p.nx * v + p.tx * (rnd() - 0.5) * 0.3, p.y + 0.02, p.z + p.nz * v + p.tz * (rnd() - 0.5) * 0.3, 0.62 + rnd() * 0.1, CLS.deck, s / L); }
      }
    }
    // at-grade: sidewalks, kerbs, guard rails, crosswalks, stop lines
    if (!elev && road.kind !== 'street') {
      for (const side of [-1, 1]) {
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1], b = path[k], ds = b.s - a.s;
          UP();
          for (let q = 0, n = cnt(ds * 2.8 * DENS.sidewalk * D); q < n; q++) {
            const t = rnd(), v = side * (w / 2 + 0.25 + rnd() * 2.8);
            const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
            emit(x + nx * v, 0.15, z + nz * v, 0.24 + rnd() * 0.08, CLS.ground);
          }
          N(-a.nx * side, 0.3, -a.nz * side);
          for (let q = 0, m = ds * DENS.kerb * D; q < m; q++) {
            const t = rnd(), v = side * (w / 2 + 0.12);
            const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
            emit(x + nx * v, 0.08 + rnd() * 0.07, z + nz * v, 0.45, CLS.ground);
          }
          // guard rail (white, retro-reflective) with posts every 2 m
          N(-a.nx * side, 0, -a.nz * side);
          for (let q = 0, m = ds * 7 * D; q < m; q++) {
            const t = rnd(), v = side * (w / 2 + 0.5);
            const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
            emit(x + nx * v, 0.62 + rnd() * 0.3, z + nz * v, 0.7 + rnd() * 0.15, CLS.furniture);
          }
        }
      }
      for (const s0 of [9, L - 9]) {
        if (L < 40) continue;
        const p = samplePath(path, s0), dir = s0 < L / 2 ? -1 : 1;
        UP();
        // zebra crossing: stripes 0.45 m wide, 0.9 m pitch, 4 m long
        for (let k = 0, n = w * 4 * 9 * D; k < n; k++) {
          const u = rnd() * 4 - 2, v = (rnd() - 0.5) * (w + 2);
          if (((v + w) % 0.9) > 0.45) continue;
          emit(p.x + p.tx * u + p.nx * v, 0.015, p.z + p.tz * u + p.nz * v, 0.88 + rnd() * 0.1, CLS.marking);
        }
        // stop line 0.45 m wide across the approach lanes
        const u0 = dir * 3.2;
        for (let k = 0, n = w * 12 * D; k < n; k++) { const v = (rnd() - 0.5) * w; emit(p.x + p.tx * (u0 + (rnd() - 0.5) * 0.45) + p.nx * v, 0.015, p.z + p.tz * (u0 + (rnd() - 0.5) * 0.45) + p.nz * v, 0.85, CLS.marking); }
        // traffic signal: pole + arm over the carriageway + 3-lamp head
        const side = -1;
        const px = p.x + p.nx * side * (w / 2 + 0.6), pz = p.z + p.nz * side * (w / 2 + 0.6);
        vline(px, pz, 0, 6.2, 12, 0.5, CLS.furniture, 0.22);
        seg(px, 6.0, pz, px - p.nx * side * (w / 2 + 0.6) + p.nx * 0, 5.8, pz - p.nz * side * (w / 2 + 0.6), 10, 0.5, CLS.furniture, 0.14);
        boxU(px - p.nx * side * (w * 0.35), 5.1, pz - p.nz * side * (w * 0.35), p.nx, p.nz, 1.25, 0.3, 0.45, 40, 0.75, CLS.furniture);
      }
    }
    vehicles(path, road, elev, e);
  }

  // ---------- trees ----------
  function tree(x, z, r, hc) {
    for (let k = 0, n = 110 * r * D; k < n; k++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = r * Math.cbrt(0.45 + 0.55 * rnd());
      const sq = Math.sqrt(1 - u * u);
      N(sq * Math.cos(th), u, sq * Math.sin(th));
      emit(x + rr * sq * Math.cos(th), hc + rr * u * 0.8, z + rr * sq * Math.sin(th), 0.25 + rnd() * 0.22, CLS.highVeg);
    }
    vline(x, z, 0, hc - r * 0.5, 12, 0.3, CLS.highVeg, 0.3);
  }

  // ---------- at-grade roads ----------
  let done = 0;
  const groundRoads = data.roads.filter((r) => !r.elevated);
  for (const road of groundRoads) {
    const path = framePath(resample(road.pts, 2.0));
    const L = pathLength(path);
    if (L < 3) continue;
    for (const p of path) mask.fillDisc(p.x, p.z, road.width / 2 + (road.kind === 'street' ? 0.6 : 3.2), 3);
    pavement(path, road, false, null);
    const w = road.width;
    // vending machines at the building line
    for (let s = 12 + rnd() * 30, step = road.kind === 'arterial' ? 45 : 60; s < L - 4; s += step) {
      if (rnd() > 0.55) continue;
      const side = rnd() < 0.5 ? -1 : 1, p = samplePath(path, s), v = side * (w / 2 + (road.kind === 'arterial' ? 3.2 : 0.55));
      const px = p.x + p.nx * v, pz = p.z + p.nz * v;
      boxU(px, 0, pz, p.tx, p.tz, 1.0, 0.75, 1.85, 12, 0.45, CLS.furniture);
      N(-p.nx * side, 0, -p.nz * side); // bright front panel facing the road
      for (let k = 0, n = 1.0 * 1.85 * 14 * D; k < n; k++) emit(px + p.tx * (rnd() - 0.5) * 1.0 - p.nx * side * 0.38, 0.3 + rnd() * 1.5, pz + p.tz * (rnd() - 0.5) * 1.0 - p.nz * side * 0.38, 0.72, CLS.furniture);
    }
    if (road.kind === 'arterial') {
      // planting strips (hedges) along both kerbs, 10 m runs with 2.5 m gaps; median planter on wide roads
      const hedge = (v, s0, s1, hw, hh) => {
        for (let s = s0; s < s1; s += 12.5) {
          const e1 = Math.min(s1, s + 10);
          for (let k = 0, n = (e1 - s) * (hw + 2 * hh) * 4 * D; k < n; k++) {
            const p = samplePath(path, s + rnd() * (e1 - s)), f = rnd() * (hw + 2 * hh);
            let vv, y;
            if (f < hw) { vv = v + (rnd() - 0.5) * hw; y = hh; UP(); }
            else { const sd = f < hw + hh ? -1 : 1; vv = v + sd * hw / 2; y = rnd() * hh; N(p.nx * sd, 0.2, p.nz * sd); }
            emit(p.x + p.nx * vv, y + (rnd() - 0.5) * 0.15, p.z + p.nz * vv, 0.28 + rnd() * 0.12, CLS.lowVeg);
          }
        }
      };
      if (L > 40) for (const side of [-1, 1]) if (hashStr(road.id + side) % 3 !== 0) hedge(side * (w / 2 + 1.05), 14, L - 14, 0.9, 0.8);
      if (road.lanes >= 4 && L > 80) for (let s = 12; s < L - 12; s += 68) hedge(0, s, Math.min(L - 12, s + 60), 1.2, 0.9);
      // bus stops every ~260 m (sign pole, shelter roof + back panel, bench)
      for (let s = 130 + (hashStr('bus' + road.id) % 90); s < L - 10; s += 260) {
        const side = (Math.floor(s / 260) % 2) * 2 - 1, p = samplePath(path, s), v = side * (w / 2 + 1.2);
        const px = p.x + p.nx * v, pz = p.z + p.nz * v;
        vline(px, pz, 0, 3.2, 14, 0.55, CLS.furniture, 0.12);
        N(p.tx, 0, p.tz);
        for (let k = 0, n = 40 * D; k < n; k++) { const r = Math.sqrt(rnd()) * 0.35, th = rnd() * 6.283; emit(px + p.nx * Math.cos(th) * r, 3.4 + Math.sin(th) * r, pz + p.nz * Math.cos(th) * r, 0.8, CLS.furniture); }
        const sx = px + p.tx * 4, sz = pz + p.tz * 4, sv = side * 0.9;
        boxU(sx + p.nx * sv, 2.55, sz + p.nz * sv, p.tx, p.tz, 4.2, 1.8, 0.15, 10, 0.5, CLS.furniture);
        for (const u of [-1.9, 1.9]) vline(sx + p.tx * u + p.nx * (sv + side * 0.8), sz + p.tz * u + p.nz * (sv + side * 0.8), 0, 2.55, 14, 0.5, CLS.furniture, 0.1);
        N(p.nx * side, 0, p.nz * side);
        for (let k = 0, n = 4.2 * 2.2 * 2.2 * D; k < n; k++) emit(sx + p.tx * (rnd() - 0.5) * 4.2 + p.nx * (sv + side * 0.85), 0.3 + rnd() * 2.2, sz + p.tz * (rnd() - 0.5) * 4.2 + p.nz * (sv + side * 0.85), 0.3, CLS.furniture);
        boxU(sx + p.nx * (sv + side * 0.5), 0.45, sz + p.nz * (sv + side * 0.5), p.tx, p.tz, 1.8, 0.4, 0.06, 20, 0.5, CLS.furniture);
      }
      // regulatory road signs (retro-reflective discs) every ~70 m, alternating sides
      for (let s = 30 + (hashStr('sign' + road.id) % 40); s < L - 6; s += 70) {
        const side = (Math.floor(s / 70) % 2) * 2 - 1, p = samplePath(path, s), v = side * (w / 2 + 0.4);
        const px = p.x + p.nx * v, pz = p.z + p.nz * v;
        vline(px, pz, 0, 2.9, 14, 0.5, CLS.furniture, 0.1);
        N(p.tx, 0, p.tz);
        for (let k = 0, n = 44 * D; k < n; k++) { const r = Math.sqrt(rnd()) * 0.3, th = rnd() * 6.283; emit(px + p.nx * Math.cos(th) * r, 3.05 + Math.sin(th) * r, pz + p.nz * Math.cos(th) * r, 0.9, CLS.furniture); }
      }
      // pedestrian overpass across wide arterials
      if (road.lanes >= 4 && L > 160) {
        const p = samplePath(path, L / 2), span = w + 6, dh = 5.2;
        for (const [u0, u1, y0, y1] of [[-1.2, 1.2, dh, dh]]) {
          for (let k = 0, n = span * 2.4 * 7 * D; k < n; k++) { const v = (rnd() - 0.5) * span, u = u0 + rnd() * (u1 - u0); UP(); emit(p.x + p.nx * v + p.tx * u, y0 + 0.02, p.z + p.nz * v + p.tz * u, 0.42, CLS.furniture); N(0, -1, 0); emit(p.x + p.nx * v + p.tx * u, y0 - 0.5, p.z + p.nz * v + p.tz * u, 0.35, CLS.furniture); }
        }
        for (const u of [-1.2, 1.2]) { // handrails with posts
          N(p.tx * Math.sign(u), 0, p.tz * Math.sign(u));
          for (let k = 0, n = span * 2 * 3.5 * D; k < n; k++) { const v = (rnd() - 0.5) * span; emit(p.x + p.nx * v + p.tx * u, dh + rnd() * 1.1, p.z + p.nz * v + p.tz * u, 0.4, CLS.furniture); }
          for (let v = -span / 2; v <= span / 2; v += 2) vline(p.x + p.nx * v + p.tx * u, p.z + p.nz * v + p.tz * u, dh, dh + 1.1, 10, 0.5, CLS.furniture, 0.06);
        }
        for (const sd of [-1, 1]) { // stair ramps on each sidewalk, running along the road
          const vb = sd * (span / 2 - 1.2);
          for (let k = 0, n = 8 * 2.4 * 7 * D; k < n; k++) {
            const u = 1.2 + rnd() * 8, v = vb + (rnd() - 0.5) * 2.4, y = dh * (1 - (u - 1.2) / 8);
            N(-p.tx * 0.55, 0.83, -p.tz * 0.55);
            emit(p.x + p.nx * v + p.tx * u, y + 0.02, p.z + p.nz * v + p.tz * u, 0.42, CLS.furniture);
          }
          N(p.nx * sd, 0, p.nz * sd);
          for (let k = 0, n = 8 * 1.1 * 3 * D; k < n; k++) { const u = 1.2 + rnd() * 8, y = dh * (1 - (u - 1.2) / 8); emit(p.x + p.nx * (vb + sd * 1.2) + p.tx * u, y + 0.3 + rnd() * 0.9, p.z + p.nz * (vb + sd * 1.2) + p.tz * u, 0.4, CLS.furniture); }
          vline(p.x + p.nx * vb, p.z + p.nz * vb, 0, dh - 0.5, 14, 0.45, CLS.furniture, 0.45);
          vline(p.x + p.nx * (vb - sd * 3), p.z + p.nz * (vb - sd * 3), 0, dh - 0.5, 14, 0.45, CLS.furniture, 0.45);
        }
      }
      // street trees and street lights
      for (let s = 7; s < L; s += 14) for (const side of [-1, 1]) {
        if (rnd() > 0.55) continue;
        const p = samplePath(path, s), v = side * (w / 2 + 1.7);
        tree(p.x + p.nx * v, p.z + p.nz * v, 1.6 + rnd() * 1.4, 3.5 + rnd() * 2);
      }
      for (let s = 18; s < L - 5; s += 35) {
        const side = (Math.floor(s / 35) % 2) * 2 - 1;
        const p = samplePath(path, s), px = p.x + p.nx * side * (w / 2 + 0.7), pz = p.z + p.nz * side * (w / 2 + 0.7);
        vline(px, pz, 0, 9, 11, 0.6, CLS.pole, 0.2);
        seg(px, 8.7, pz, px - p.nx * side * 2.6, 9.2, pz - p.nz * side * 2.6, 14, 0.65, CLS.pole, 0.12);
      }
    } else {
      // Tokyo backstreets: utility poles with overhead wires, one side, every ~30 m
      const side = hashStr(road.id) % 2 ? 1 : -1;
      let prev = null;
      for (let s = 6 + rnd() * 8; s < L - 4; s += 28 + rnd() * 8) {
        const p = samplePath(path, s), px = p.x + p.nx * side * (w / 2 + 0.45), pz = p.z + p.nz * side * (w / 2 + 0.45);
        vline(px, pz, 0, 11.5, 14, 0.45, CLS.furniture, 0.28);
        for (const yy of [9.6, 10.8]) seg(px - p.tx * 0.9, yy, pz - p.tz * 0.9, px + p.tx * 0.9, yy, pz + p.tz * 0.9, 16, 0.5, CLS.furniture, 0.08);
        if (rnd() < 0.3) boxU(px + p.nx * side * 0.3, 8.0, pz + p.nz * side * 0.3, p.tx, p.tz, 0.7, 0.6, 1.0, 30, 0.42, CLS.furniture);
        if (prev) for (const [yy, off] of [[9.6, -0.9], [9.6, 0.9], [10.8, 0], [7.2, 0.2]]) seg(prev[0] + p.tx * off, yy, prev[1] + p.tz * off, px + p.tx * off, yy, pz + p.tz * off, 1.6, 0.32, CLS.furniture, 0.04, 0.55);
        prev = [px, pz];
      }
    }
  }
  progress(0.25);

  // ---------- structural elements ----------
  const boxFaces = (e, cx, cy, cz, tx, tz, nx, nz, l, w, h, dens, inten, cls, top = false) => {
    const area = 2 * (l * h + w * h) + (top ? l * w : 0);
    for (let k = 0, n = area * dens * D; k < n; k++) {
      const f = rnd() * area; let u, v, y;
      if (f < l * h) { u = (rnd() - 0.5) * l; v = -w / 2; y = rnd() * h; N(-nx, 0, -nz); }
      else if (f < 2 * l * h) { u = (rnd() - 0.5) * l; v = w / 2; y = rnd() * h; N(nx, 0, nz); }
      else if (f < 2 * l * h + w * h) { u = -l / 2; v = (rnd() - 0.5) * w; y = rnd() * h; N(-tx, 0, -tz); }
      else if (f < 2 * (l * h + w * h)) { u = l / 2; v = (rnd() - 0.5) * w; y = rnd() * h; N(tx, 0, tz); }
      else { u = (rnd() - 0.5) * l; v = (rnd() - 0.5) * w; y = h; UP(); }
      emitE(e, cx + tx * u + nx * v, cy + y, cz + tz * u + nz * v, inten, cls);
    }
  };

  for (const e of elements) {
    switch (e.type) {
      case 'deck': pavement(e.path, e.road, true, e); break;
      case 'girder': {
        const path = e.path, L = pathLength(path);
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1], b = path[k], ds = b.s - a.s;
          for (let q = 0, n = ds * e.depth * DENS.girderSide * D; q < n; q++) {
            const t = rnd(), f = rnd(), side = rnd() < 0.5 ? -1 : 1;
            N(a.nx * side, 0.25, a.nz * side);
            const v = side * (e.wTop / 2 + (e.wBot / 2 - e.wTop / 2) * f);
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - DECK_T - f * e.depth, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.36 + rnd() * 0.08 + (f < 0.08 ? 0.12 : 0), CLS.girder, a.s / L);
          }
          N(0, -1, 0);
          for (let q = 0, n = ds * e.wBot * DENS.girderBot * D; q < n; q++) {
            const t = rnd(), v = (rnd() - 0.5) * e.wBot;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - DECK_T - e.depth, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.3 + rnd() * 0.08, CLS.girder, a.s / L);
          }
          // deck soffit outside the girder (cantilever slab underside)
          for (let q = 0, n = ds * (e.wTop + 2) * 1.2 * D; q < n; q++) {
            const t = rnd(), v = (rnd() - 0.5) * (e.wTop + 2.4);
            if (Math.abs(v) < e.wTop / 2) continue;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - DECK_T, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.33, CLS.girder, a.s / L);
          }
        }
        break;
      }
      case 'railing': {
        const path = e.path, L = pathLength(path);
        const fence = e.road.kind !== 'ramp' || hashStr(e.tag) % 3 === 0;
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1], b = path[k], ds = b.s - a.s;
          for (let q = 0, n = ds * e.h * 2 * DENS.railFace * D; q < n; q++) {
            const t = rnd(), f = rnd(), sd = rnd() < 0.5 ? -1 : 1;
            N(a.nx * sd, 0, a.nz * sd);
            const v = e.offset + sd * e.t / 2;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + f * e.h, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.5 + f * 0.12, CLS.railing, (a.s + ds * t) / L);
          }
          UP();
          for (let q = 0, n = ds * DENS.railTop * D; q < n; q++) {
            const t = rnd(), v = e.offset + (rnd() - 0.5) * e.t;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + e.h, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.86 + rnd() * 0.12, CLS.railing, (a.s + ds * t) / L);
          }
          // drainage kerb line on the carriageway side
          N(-a.nx * e.side, 0.5, -a.nz * e.side);
          for (let q = 0, n = ds * 5 * D; q < n; q++) {
            const t = rnd(), v = e.offset - e.side * (e.t / 2 + 0.25);
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + 0.05, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.4, CLS.railing, (a.s + ds * t) / L);
          }
          if (fence) {
            // fence on top of the parapet: posts every 2 m, top rail, sparse mesh
            N(a.nx * e.side, 0, a.nz * e.side);
            for (let q = 0, n = ds * 1.0 * 1.4 * D; q < n; q++) {
              const t = rnd(), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + e.h + rnd() * 1.0, z = a.z + (b.z - a.z) * t;
              emitE(e, x + a.nx * e.offset, y, z + a.nz * e.offset, 0.3 + rnd() * 0.1, CLS.railing, (a.s + ds * t) / L);
            }
            for (let q = 0, n = ds * 7 * D; q < n; q++) {
              const t = rnd(), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + e.h + 1.0, z = a.z + (b.z - a.z) * t;
              emitE(e, x + a.nx * e.offset, y, z + a.nz * e.offset, 0.55, CLS.railing, (a.s + ds * t) / L);
            }
          }
        }
        if (fence) for (let s = 1; s < L; s += 2) {
          const p = samplePath(path, s);
          N(0, 0, 0);
          for (let k = 0, n = 9 * D; k < n; k++) emitE(e, p.x + p.nx * e.offset, p.y + e.h + rnd() * 1.0, p.z + p.nz * e.offset, 0.5, CLS.railing, s / L);
        }
        break;
      }
      case 'column': {
        const h = e.yTop - e.yBot;
        if (e.round) {
          for (let k = 0, n = Math.PI * e.colW * h * DENS.column * D; k < n; k++) {
            const th = rnd() * Math.PI * 2, y = e.yBot + rnd() * h;
            N(Math.cos(th), 0, Math.sin(th));
            emitE(e, e.x + Math.cos(th) * e.colW / 2, y, e.z + Math.sin(th) * e.colW / 2, 0.4 + rnd() * 0.08 + (y < 1.2 ? 0.1 : 0), CLS.column);
          }
        } else boxFaces(e, e.x, e.yBot, e.z, e.tx, e.tz, -e.tz, e.tx, e.colL, e.colW, h, DENS.column, 0.42, CLS.column);
        break;
      }
      case 'cap': boxFaces(e, e.x, e.yBot, e.z, e.tx, e.tz, -e.tz, e.tx, e.l, e.w, e.h, DENS.cap, 0.46, CLS.cap); break;
      case 'footing': break; // underground: no returns
      case 'pole': {
        N(0, 0, 0);
        for (let k = 0, n = e.h * 12 * D; k < n; k++) emitE(e, e.x + (rnd() - 0.5) * 0.25, e.y + rnd() * e.h, e.z + (rnd() - 0.5) * 0.25, 0.6, CLS.pole);
        for (let k = 0, n = 30 * D; k < n; k++) { const u = rnd() * 2.4; emitE(e, e.x - e.nx * u, e.y + e.h - 0.3 + u * 0.1, e.z - e.nz * u, 0.7, CLS.pole); }
        break;
      }
      case 'gantry': {
        N(0, 0, 0);
        for (const side of [-1, 1]) {
          const px = e.x + e.nx * side * e.w / 2, pz = e.z + e.nz * side * e.w / 2;
          for (let k = 0, n = e.h * 18 * D; k < n; k++) emitE(e, px + (rnd() - 0.5) * 0.4, e.y + rnd() * e.h, pz + (rnd() - 0.5) * 0.4, 0.62, CLS.gantry);
        }
        for (let k = 0, n = e.w * 34 * D; k < n; k++) {
          const v = (rnd() - 0.5) * e.w, zig = Math.abs(((v * 2) % 2.4) - 1.2) * 0.9;
          emitE(e, e.x + e.nx * v + (rnd() - 0.5) * 0.3, e.y + e.h - 1.2 + zig, e.z + e.nz * v + (rnd() - 0.5) * 0.3, 0.6, CLS.gantry);
        }
        N(-e.tx, 0, -e.tz);
        for (let k = 0, n = 160 * D; k < n; k++) {
          const v = (rnd() - 0.5) * 3.6, y = e.y + e.h - 1.1 + (rnd() - 0.5) * 2.2;
          emitE(e, e.x + e.nx * v - e.tx * 0.3, y, e.z + e.nz * v - e.tz * 0.3, 0.9 + rnd() * 0.1, CLS.gantry);
        }
        break;
      }
      case 'building': building(e); break;
    }
    if (++done % 400 === 0) progress(0.25 + 0.6 * (done / elements.length));
  }

  function building(e) {
    const poly = e.footprint, h = e.h;
    const floorH = h / e.levels;
    const big = e.area > 6000;
    const hb = hashStr(e.tag);
    const mullion = 2.6 + (hb % 100) / 50;            // 2.6–4.6 m window module
    const residential = h < 45 && hb % 10 < 4;        // balconies
    const glassy = h > 40 && hb % 10 < 6;             // curtain wall: sparse glass, strong mullions
    const shopfront = e.area > 150 && hb % 10 < 7;
    const wallD = DENS.wall * (big ? 0.5 : 1);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.5) continue;
      const nxw = (b[1] - a[1]) / L, nzw = -(b[0] - a[0]) / L; // outward-ish normal (sign irrelevant)
      N(nxw, 0, nzw);
      for (let k = 0, n = L * h * wallD * 1.6 * D; k < n; k++) {
        const t = rnd(), y = rnd() * h;
        const vis = 0.3 + 0.7 * Math.exp(-y / 50);
        if (rnd() > vis) continue;
        const ph = (y % floorH) / floorH, mt = (t * L) % mullion;
        let inten, keep;
        if (ph < 0.14) { inten = 0.5 + rnd() * 0.1; keep = 1; }                       // floor slab band
        else if (mt < 0.16 || mt > mullion - 0.16) { inten = 0.44 + rnd() * 0.08; keep = 0.9; } // mullion
        else if (y < 0.5) { inten = 0.45; keep = 1; }                                  // plinth
        else if (shopfront && y > 3.0 && y < 3.7) { inten = 0.62 + rnd() * 0.1; keep = 0.9; } // signage band
        else { inten = glassy ? 0.15 + rnd() * 0.08 : 0.24 + rnd() * 0.12; keep = glassy ? 0.18 : 0.42; } // glazing / render
        if (rnd() > keep) continue;
        emitE(e, a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t, inten, CLS.building);
      }
      // vertical corner line
      N(0, 0, 0);
      for (let k = 0, n = h * 6 * D; k < n; k++) emitE(e, a[0], rnd() * h, a[1], 0.5 + rnd() * 0.08, CLS.building);
      // roof parapet (1 m) + balconies
      N(nxw, 0, nzw);
      for (let k = 0, n = L * 4 * D; k < n; k++) { const t = rnd(); emitE(e, a[0] + (b[0] - a[0]) * t, h + rnd() * 1.0, a[1] + (b[1] - a[1]) * t, 0.45, CLS.building); }
      // projecting shop sign (袖看板) on commercial facades
      if (shopfront && h > 8 && L > 6 && (hb + i) % 5 === 0) {
        const t = 0.3 + rnd() * 0.4, sy = 4 + rnd() * Math.max(1, h - 8);
        boxU(a[0] + (b[0] - a[0]) * t + nxw * 0.55, sy, a[1] + (b[1] - a[1]) * t + nzw * 0.55, -nzw, nxw, 0.7, 0.25, 2.6, 14, 0.78, CLS.furniture);
      }
      if (residential && !big) {
        UP();
        for (let lv = 1; lv < e.levels; lv++) {
          const y = lv * floorH;
          for (let k = 0, n = L * 1.2 * 2.2 * D; k < n; k++) {
            const t = rnd(), d = rnd() * 1.2;
            emitE(e, a[0] + (b[0] - a[0]) * t + nxw * d, y + 0.05 + (rnd() < 0.3 ? rnd() * 1.1 : 0), a[1] + (b[1] - a[1]) * t + nzw * d, 0.42, CLS.building);
          }
        }
      }
    }
    // roof surface, rooftop equipment, stair bulkhead, water tank
    const [x0, z0, x1, z1] = polygonBBox(poly);
    const bw = x1 - x0, bh = z1 - z0;
    const roofN = Math.min(e.area, 12000) * DENS.roof * D;
    UP();
    for (let tries = 0, got = 0; got < roofN && tries < roofN * 4; tries++) {
      const x = x0 + rnd() * bw, z = z0 + rnd() * bh;
      if (!pointInPolygon(x, z, poly)) continue;
      got++;
      emitE(e, x, h + 0.02, z, 0.3 + rnd() * 0.08, CLS.building);
    }
    if (e.area > 120) {
      const nBox = e.area > 800 ? 3 : e.area > 300 ? 2 : 1;
      for (let b = 0; b < nBox; b++) {
        const cx = (x0 + x1) / 2 + (rnd() - 0.5) * bw * 0.5, cz = (z0 + z1) / 2 + (rnd() - 0.5) * bh * 0.5;
        if (!pointInPolygon(cx, cz, poly)) continue;
        const kind = rnd();
        if (kind < 0.5) boxFaces(e, cx, h, cz, 1, 0, 0, 1, 2 + rnd() * 3, 1.5 + rnd() * 2, 1.5 + rnd() * 1.5, 2.5, 0.4, CLS.building, true);
        else if (kind < 0.8) boxFaces(e, cx, h, cz, 1, 0, 0, 1, 3 + rnd() * 2, 3 + rnd() * 2, 2.8, 2.5, 0.42, CLS.building, true); // stair bulkhead
        else { const r = 0.9 + rnd() * 0.6; for (let k = 0, n = 2 * Math.PI * r * 2.2 * 4 * D; k < n; k++) { const th = rnd() * 6.283; N(Math.cos(th), 0, Math.sin(th)); emitE(e, cx + Math.cos(th) * r, h + 0.6 + rnd() * 2.2, cz + Math.sin(th) * r, 0.5, CLS.building); } }
      }
      // rooftop billboard on larger buildings
      if (e.area > 500 && hb % 7 === 0) {
        let bi = 0, bl = 0;
        for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > bl) { bl = L; bi = i; } }
        const a = poly[bi], b = poly[(bi + 1) % poly.length];
        const tx = (b[0] - a[0]) / bl, tz = (b[1] - a[1]) / bl, nxw = tz, nzw = -tx;
        const cx = (a[0] + b[0]) / 2 - nxw * 2.5, cz = (a[1] + b[1]) / 2 - nzw * 2.5;
        const inside = pointInPolygon(cx, cz, poly) ? 1 : -1;
        const px = (a[0] + b[0]) / 2 - nxw * 2.5 * inside, pz = (a[1] + b[1]) / 2 - nzw * 2.5 * inside;
        boxU(px, h + 1.5, pz, tx, tz, Math.min(8, bl * 0.6), 0.15, 3.2, 7, 0.7, CLS.furniture);
        for (const u of [-1, 1]) vline(px + tx * u * Math.min(3.5, bl * 0.25), pz + tz * u * Math.min(3.5, bl * 0.25), h, h + 1.6, 12, 0.45, CLS.furniture, 0.15);
      }
    }
    // interior floor slabs seen through glazing (denser near the facade)
    if (!big && e.levels > 2) {
      const perLevel = Math.min(e.area, 2500) * DENS.floorSlab * (glassy ? 1.6 : 1) * D;
      UP();
      for (let lv = 1; lv < e.levels; lv++) {
        const y = lv * floorH + 0.15;
        const vis = 0.3 + 0.7 * Math.exp(-y / 50);
        for (let t2 = 0, g2 = 0; g2 < perLevel * vis && t2 < perLevel * 4; t2++) {
          const x = x0 + rnd() * bw, z = z0 + rnd() * bh;
          if (!pointInPolygon(x, z, poly)) continue;
          g2++;
          emitE(e, x, y, z, 0.3 + rnd() * 0.1, CLS.floor);
        }
      }
    }
  }
  progress(0.86);

  // ---------- ground, water, parks, parking lots ----------
  UP();
  for (let k = 0, n = cw * ch * DENS.ground * D; k < n; k++) {
    const x = (rnd() - 0.5) * cw, z = (rnd() - 0.5) * ch;
    const m = mask.get(x, z);
    if (m === 1 || m === 2 || m === 3 || m === 255) continue;
    const und = 0.25 * Math.sin(x * 0.011) * Math.cos(z * 0.013);
    if (m === 4) { if (rnd() < DENS.grass / DENS.ground) emit(x, und + rnd() * 0.25, z, 0.26 + rnd() * 0.12, CLS.lowVeg); }
    else emit(x, und, z, 0.18 + rnd() * 0.08, CLS.ground);
  }
  // open plots become small parking lots: rows of cars + a few bollards
  for (let k = 0, lots = 0; k < 4000 && lots < 160; k++) {
    const x = (rnd() - 0.5) * cw, z = (rnd() - 0.5) * ch;
    let ok = true;
    for (let dx = -8; dx <= 8 && ok; dx += 4) for (let dz = -6; dz <= 6; dz += 3) if (mask.get(x + dx, z + dz) !== 0) { ok = false; break; }
    if (!ok) continue;
    lots++;
    const ang = rnd() * Math.PI, tx = Math.cos(ang), tz = Math.sin(ang);
    const frame = { x, y: 0, z, tx, tz, nx: -tz, nz: tx };
    for (let i = -2; i <= 2; i++) if (rnd() < 0.7) vehicle({ ...frame, x: x + frame.nx * i * 2.6, z: z + frame.nz * i * 2.6 }, 0, false, null, true);
    for (let i = -3; i <= 3; i++) vline(x + frame.nx * i * 2.6 + tx * 4.2, z + frame.nz * i * 2.6 + tz * 4.2, 0, 0.8, 10, 0.5, CLS.furniture, 0.1);
  }
  UP();
  for (const poly of data.water) {
    const [x0, z0, x1, z1] = polygonBBox(poly);
    for (let k = 0, n = (x1 - x0) * (z1 - z0) * 0.035 * D; k < n; k++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!inCrop(x, z) || !pointInPolygon(x, z, poly)) continue;
      emit(x, -1.8 + rnd() * 0.1, z, 0.06 + rnd() * 0.06, CLS.water);
    }
  }
  for (const poly of data.parks) {
    const [x0, z0, x1, z1] = polygonBBox(poly);
    for (let k = 0, n = polygonArea(poly) / 110; k < n; k++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!inCrop(x, z) || !pointInPolygon(x, z, poly)) continue;
      tree(x, z, 2 + rnd() * 2.5, 4 + rnd() * 4);
    }
  }
  // sparse noise returns (birds, multipath)
  for (let k = 0, n = cloud.n * 0.002; k < n; k++) {
    const i = Math.floor(rnd() * cloud.n);
    cloud.push(cloud.pos[i * 3] + (rnd() - 0.5) * 2, cloud.pos[i * 3 + 1] + (rnd() - 0.2) * 5, cloud.pos[i * 3 + 2] + (rnd() - 0.5) * 2, 0.08 + rnd() * 0.1, CLS.noise, 0, NO_ELEM);
  }
  progress(1);
  return cloud.finish();
}
