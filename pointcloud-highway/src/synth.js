// LiDAR point-cloud synthesis. Runs inside a Web Worker. Produces typed arrays:
//   positions (Float32 x3), intensity (Uint8), cls (Uint8), dev (Uint8, 128 = 0 mm), elem (Uint16)
import { mulberry32, gauss, resample, framePath, pathLength, samplePath, polygonArea, polygonBBox, pointInPolygon, Raster } from './geom.js';
import { buildStructure, DECK_T, routeName } from './structure.js';

export const CLS = {
  unclassified: 1, ground: 2, lowVeg: 3, highVeg: 5, building: 6, water: 9, road: 11, deck: 17, noise: 18,
  marking: 20, railing: 21, column: 22, girder: 23, vehicle: 24, pole: 25, floor: 26, cap: 27, footing: 28, gantry: 29,
};
export const CLS_INFO = [
  [CLS.ground, '地盤', 0x8a6d4b], [CLS.lowVeg, '低植生', 0x7cb342], [CLS.highVeg, '樹木', 0x2e7d32],
  [CLS.building, '建物', 0xc9b79c], [CLS.floor, '建物 床版', 0x8fa3b3], [CLS.water, '水面', 0x1e88e5],
  [CLS.road, '一般道 路面', 0x5c5c66], [CLS.deck, '高架 床版', 0x9b59b6], [CLS.marking, '区画線', 0xfff176],
  [CLS.railing, '壁高欄', 0x26c6da], [CLS.girder, '主桁', 0xff8a65], [CLS.column, '橋脚', 0xba68c8],
  [CLS.cap, '横梁', 0xffb74d], [CLS.vehicle, '車両', 0xff5252], [CLS.pole, '照明柱', 0xe0e0e0],
  [CLS.gantry, '標識柱', 0xf5f5f5], [CLS.noise, 'ノイズ', 0x555555],
];
const NO_ELEM = 65535;

class Cloud {
  constructor(cap) {
    this.n = 0;
    this.alloc(cap);
  }
  alloc(cap) {
    this.cap = cap;
    const old = this.pos ? this : null;
    this.pos = new Float32Array(cap * 3);
    this.inten = new Uint8Array(cap);
    this.cls = new Uint8Array(cap);
    this.dev = new Uint8Array(cap);
    this.elem = new Uint16Array(cap);
    if (old) {
      this.pos.set(old.pos.subarray(0, old.n * 3));
      this.inten.set(old.inten.subarray(0, old.n));
      this.cls.set(old.cls.subarray(0, old.n));
      this.dev.set(old.dev.subarray(0, old.n));
      this.elem.set(old.elem.subarray(0, old.n));
    }
  }
  push(x, y, z, i, c, d, e) {
    if (this.n >= this.cap) {
      const o = { pos: this.pos, inten: this.inten, cls: this.cls, dev: this.dev, elem: this.elem, n: this.n };
      this.cap = Math.ceil(this.cap * 1.6);
      this.pos = new Float32Array(this.cap * 3); this.pos.set(o.pos);
      this.inten = new Uint8Array(this.cap); this.inten.set(o.inten);
      this.cls = new Uint8Array(this.cap); this.cls.set(o.cls);
      this.dev = new Uint8Array(this.cap); this.dev.set(o.dev);
      this.elem = new Uint16Array(this.cap); this.elem.set(o.elem);
    }
    const k = this.n++;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.inten[k] = i < 0 ? 0 : i > 1 ? 255 : (i * 255) | 0;
    this.cls[k] = c;
    const dv = 128 + d;
    this.dev[k] = dv < 0 ? 0 : dv > 255 ? 255 : dv | 0;
    this.elem[k] = e;
  }
  finish() {
    return {
      n: this.n,
      pos: this.pos.slice(0, this.n * 3),
      inten: this.inten.slice(0, this.n),
      cls: this.cls.slice(0, this.n),
      dev: this.dev.slice(0, this.n),
      elem: this.elem.slice(0, this.n),
    };
  }
}

export function synthesize(data, { density = 1, seed = 1 } = {}, progress = () => {}) {
  const rnd = mulberry32(seed);
  const jit = () => (rnd() + rnd() - 1) * 0.03; // ~σ 12 mm ranging noise
  const cloud = new Cloud(Math.round(1.4e6 * density + 2e5));
  const { elements } = buildStructure(data);
  const D = density;
  const [cw, ch] = data.site.cropM;
  const inCrop = (x, z) => Math.abs(x) <= cw / 2 && Math.abs(z) <= ch / 2;

  // deviation (mm) of an element at a given point, signed
  const devAt = (e, x, y, z, u = 0) => {
    const a = e.asBuilt;
    let dx = a.dx, dy = a.dy, dz = a.dz;
    if (e.type === 'column') { const f = (y - e.yBot) / Math.max(1, e.yTop - e.yBot); dx *= f; dz *= f; }
    if (e.type === 'railing') { const f = Math.sin(Math.PI * u); dx *= f; }
    const mag = dy !== 0 ? dy : Math.hypot(dx, dz) * (e.type === 'railing' ? Math.sign(e.asBuilt.dx) : 1);
    return { dx, dy, dz, mm: mag * 1000 + gauss(rnd) * 2.5 };
  };
  const emitE = (e, x, y, z, i, c, u = 0) => {
    const d = devAt(e, x, y, z, u);
    cloud.push(x + d.dx + jit(), y + d.dy + jit(), z + d.dz + jit(), i + (rnd() - 0.5) * 0.06, c, d.mm, e.id);
  };
  const emit = (x, y, z, i, c) => cloud.push(x + jit(), y + jit(), z + jit(), i + (rnd() - 0.5) * 0.06, c, gauss(rnd) * 2.5, NO_ELEM);

  // ---------- raster masks for ground sampling ----------
  const mask = new Raster(cw, ch, 1);
  for (const b of data.buildings) mask.fillPolygon(b.pts, 1);
  for (const w of data.water) mask.fillPolygon(w, 2);
  for (const p of data.parks) mask.fillPolygon(p, 4);

  // ---------- pavement (shared by at-grade roads and decks) ----------
  function pavement(path, road, elev, e) {
    const w = road.width, L = pathLength(path);
    const base = elev ? 4.5 : road.kind === 'arterial' ? 1.8 : 1.0;
    const cls = elev ? CLS.deck : CLS.road;
    const lanes = Math.max(1, road.lanes);
    const laneW = (w - 0.9) / lanes;
    const put = (x, y, z, i, c, u) => (e ? emitE(e, x, y, z, i, c, u) : emit(x, y, z, i, c));
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      const ds = b.s - a.s;
      const n = ds * w * base * D;
      const cnt = Math.floor(n) + (rnd() < n - Math.floor(n) ? 1 : 0);
      for (let q = 0; q < cnt; q++) {
        const t = rnd(), v = (rnd() - 0.5) * w;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
        const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
        // wheel-path polish makes the asphalt slightly darker in two bands per lane
        const lanePos = ((v + w / 2) % laneW) / laneW;
        const wear = Math.abs(lanePos - 0.25) < 0.08 || Math.abs(lanePos - 0.75) < 0.08 ? -0.02 : 0;
        put(x + nx * v, y + 0.01, z + nz * v, 0.13 + wear + rnd() * 0.05, cls, a.s / L);
      }
      if (!road.oneway && !elev && road.kind === 'street') {
        // narrow streets: no markings
      }
      // markings
      const lines = road.kind === 'street' ? [] : [[-w / 2 + 0.45, 'solid'], [w / 2 - 0.45, 'solid']];
      if (road.kind !== 'street') for (let l = 1; l < lanes; l++) lines.push([-w / 2 + 0.45 + l * laneW, road.oneway ? 'dash' : l === lanes / 2 ? 'solid' : 'dash']);
      if (!road.oneway && lanes === 1) lines.push([0, 'solid']);
      for (const [v, kind] of lines) {
        const m = ds * 9 * D;
        const cm = Math.floor(m) + (rnd() < m - Math.floor(m) ? 1 : 0);
        for (let q = 0; q < cm; q++) {
          const t = rnd();
          const s = a.s + ds * t;
          if (kind === 'dash' && s % 15 > 6) continue;
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
          const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
          const vv = v + (rnd() - 0.5) * 0.15;
          put(x + nx * vv, y + 0.015, z + nz * vv, 0.82 + rnd() * 0.15, CLS.marking, s / L);
        }
      }
    }
    // sidewalks + kerbs on at-grade arterials
    if (!elev && road.kind !== 'street') {
      for (const side of [-1, 1]) {
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1], b = path[k];
          const ds = b.s - a.s;
          const n = ds * 2.5 * 1.1 * D;
          const cnt = Math.floor(n) + (rnd() < n - Math.floor(n) ? 1 : 0);
          for (let q = 0; q < cnt; q++) {
            const t = rnd(), v = side * (w / 2 + 0.2 + rnd() * 2.5);
            const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
            emit(x + nx * v, 0.15, z + nz * v, 0.24 + rnd() * 0.08, CLS.ground);
          }
          const m = ds * 6 * D;
          for (let q = 0; q < m; q++) {
            const t = rnd(), v = side * (w / 2 + 0.1);
            const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
            emit(x + nx * v, 0.08 + rnd() * 0.07, z + nz * v, 0.45, CLS.ground);
          }
        }
      }
    }
    vehicles(path, road, elev, e);
  }

  function vehicles(path, road, elev, e) {
    const L = pathLength(path), w = road.width;
    const lanes = Math.max(1, road.lanes), laneW = (w - 0.9) / lanes;
    const per100 = road.kind === 'street' ? 0.25 : elev ? 1.3 : 0.9;
    const n = (L / 100) * lanes * per100;
    const cnt = Math.floor(n) + (rnd() < n - Math.floor(n) ? 1 : 0);
    for (let q = 0; q < cnt; q++) {
      const s = rnd() * L;
      const p = samplePath(path, s);
      const lane = Math.floor(rnd() * lanes);
      const v = -w / 2 + 0.45 + laneW * (lane + 0.5);
      const truck = rnd() < 0.2;
      const len = truck ? 8 + rnd() * 4 : 4.2 + rnd() * 0.8, wid = truck ? 2.4 : 1.75, hgt = truck ? 3.2 : 1.45;
      const cx = p.x + p.nx * v, cz = p.z + p.nz * v, cy = p.y;
      const m = (len * wid + 2 * len * hgt + 2 * wid * hgt) * 7 * D;
      for (let k = 0; k < m; k++) {
        const face = rnd();
        let u = (rnd() - 0.5) * len, vv = (rnd() - 0.5) * wid, h = hgt, inten = 0.55;
        if (face < 0.4) { /* roof */ h = hgt * (truck ? 1 : 0.9 + 0.1 * Math.cos((u / len) * 3)); }
        else if (face < 0.8) { vv = (rnd() < 0.5 ? -1 : 1) * wid / 2; h = rnd() * hgt; if (!truck && h > hgt * 0.55) { if (rnd() < 0.7) continue; inten = 0.2; } }
        else { u = (rnd() < 0.5 ? -1 : 1) * len / 2; h = rnd() * hgt; }
        const x = cx + p.tx * u + p.nx * vv, z = cz + p.tz * u + p.nz * vv;
        if (e) emitE(e, x, cy + h, z, inten + rnd() * 0.15, CLS.vehicle, s / L); else emit(x, cy + h, z, inten + rnd() * 0.15, CLS.vehicle);
      }
    }
  }

  // ---------- at-grade roads ----------
  let done = 0;
  const groundRoads = data.roads.filter((r) => !r.elevated);
  for (const road of groundRoads) {
    const path = framePath(resample(road.pts, 2.0));
    if (pathLength(path) < 3) continue;
    for (const p of path) mask.fillDisc(p.x, p.z, road.width / 2 + (road.kind === 'street' ? 0.5 : 2.8), 3);
    pavement(path, road, false, null);
    // street trees along arterials
    if (road.kind === 'arterial') {
      const L = pathLength(path);
      for (let s = 7; s < L; s += 14) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.55) continue;
          const p = samplePath(path, s);
          const v = side * (road.width / 2 + 1.6);
          tree(p.x + p.nx * v, p.z + p.nz * v, 1.6 + rnd() * 1.4, 3.5 + rnd() * 2);
        }
      }
    }
  }
  progress(0.25);

  // ---------- structural elements ----------
  function tree(x, z, r, hc) {
    const n = 70 * r * D;
    for (let k = 0; k < n; k++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = r * Math.cbrt(0.45 + 0.55 * rnd());
      const sq = Math.sqrt(1 - u * u);
      emit(x + rr * sq * Math.cos(th), hc + rr * u * 0.8, z + rr * sq * Math.sin(th), 0.25 + rnd() * 0.22, CLS.highVeg);
    }
    for (let k = 0; k < 10 * D; k++) emit(x + (rnd() - 0.5) * 0.3, rnd() * (hc - r * 0.5), z + (rnd() - 0.5) * 0.3, 0.3, CLS.highVeg);
  }
  const boxFaces = (e, cx, cy, cz, tx, tz, nx, nz, l, w, h, dens, inten, cls, faces = 'all') => {
    const area = 2 * (l * h + w * h) + (faces === 'all' ? l * w : 0);
    const n = area * dens * D;
    for (let k = 0; k < n; k++) {
      const f = rnd() * area;
      let u, v, y;
      if (f < l * h) { u = (rnd() - 0.5) * l; v = -w / 2; y = rnd() * h; }
      else if (f < 2 * l * h) { u = (rnd() - 0.5) * l; v = w / 2; y = rnd() * h; }
      else if (f < 2 * l * h + w * h) { u = -l / 2; v = (rnd() - 0.5) * w; y = rnd() * h; }
      else if (f < 2 * (l * h + w * h)) { u = l / 2; v = (rnd() - 0.5) * w; y = rnd() * h; }
      else { u = (rnd() - 0.5) * l; v = (rnd() - 0.5) * w; y = h; }
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
          const nSide = ds * e.depth * 2.0 * D, nBot = ds * e.wBot * 0.9 * D;
          for (let q = 0; q < nSide; q++) {
            const t = rnd(), f = rnd(), side = rnd() < 0.5 ? -1 : 1;
            const v = side * (e.wTop / 2 + (e.wBot / 2 - e.wTop / 2) * f);
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - DECK_T - f * e.depth, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.36 + rnd() * 0.08, CLS.girder, a.s / L);
          }
          for (let q = 0; q < nBot; q++) {
            const t = rnd(), v = (rnd() - 0.5) * e.wBot;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - DECK_T - e.depth, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.3 + rnd() * 0.08, CLS.girder, a.s / L);
          }
        }
        break;
      }
      case 'railing': {
        const path = e.path, L = pathLength(path);
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1], b = path[k], ds = b.s - a.s;
          const nFace = ds * e.h * 2 * 3.2 * D, nTop = ds * 9 * D;
          for (let q = 0; q < nFace; q++) {
            const t = rnd(), f = rnd();
            const v = e.offset + (rnd() < 0.5 ? -1 : 1) * e.t / 2;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + f * e.h, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.5 + f * 0.12, CLS.railing, (a.s + ds * t) / L);
          }
          for (let q = 0; q < nTop; q++) {
            const t = rnd(), v = e.offset + (rnd() - 0.5) * e.t;
            const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + e.h, z = a.z + (b.z - a.z) * t;
            emitE(e, x + a.nx * v, y, z + a.nz * v, 0.86 + rnd() * 0.12, CLS.railing, (a.s + ds * t) / L);
          }
        }
        break;
      }
      case 'column': {
        const h = e.yTop - e.yBot;
        if (e.round) {
          const n = Math.PI * e.colW * h * 6 * D;
          for (let k = 0; k < n; k++) {
            const th = rnd() * Math.PI * 2, y = e.yBot + rnd() * h;
            emitE(e, e.x + Math.cos(th) * e.colW / 2, y, e.z + Math.sin(th) * e.colW / 2, 0.4 + rnd() * 0.08, CLS.column);
          }
        } else boxFaces(e, e.x, e.yBot, e.z, e.tx, e.tz, -e.tz, e.tx, e.colL, e.colW, h, 6, 0.42, CLS.column, 'sides');
        break;
      }
      case 'cap': boxFaces(e, e.x, e.yBot, e.z, e.tx, e.tz, -e.tz, e.tx, e.l, e.w, e.h, 4.5, 0.46, CLS.cap, 'sides'); break;
      case 'footing': break; // underground: no returns
      case 'pole': {
        for (let k = 0; k < e.h * 9 * D; k++) emitE(e, e.x + (rnd() - 0.5) * 0.25, e.y + rnd() * e.h, e.z + (rnd() - 0.5) * 0.25, 0.6, CLS.pole);
        for (let k = 0; k < 22 * D; k++) { const u = rnd() * 2.4; emitE(e, e.x - e.nx * u, e.y + e.h - 0.3 + u * 0.1, e.z - e.nz * u, 0.7, CLS.pole); }
        break;
      }
      case 'gantry': {
        for (const side of [-1, 1]) {
          const px = e.x + e.nx * side * e.w / 2, pz = e.z + e.nz * side * e.w / 2;
          for (let k = 0; k < e.h * 14 * D; k++) emitE(e, px + (rnd() - 0.5) * 0.4, e.y + rnd() * e.h, pz + (rnd() - 0.5) * 0.4, 0.62, CLS.gantry);
        }
        for (let k = 0; k < e.w * 26 * D; k++) {
          const v = (rnd() - 0.5) * e.w, zig = Math.abs(((v * 2) % 2.4) - 1.2) * 0.9;
          emitE(e, e.x + e.nx * v + (rnd() - 0.5) * 0.3, e.y + e.h - 1.2 + zig, e.z + e.nz * v + (rnd() - 0.5) * 0.3, 0.6, CLS.gantry);
        }
        for (let k = 0; k < 110 * D; k++) { // sign panel 3.6 x 2.2 m (retro-reflective)
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
    // walls: slab bands bright, glazing dark and sparse; density fades with height (MLS sees lower floors)
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.5) continue;
      const n = L * h * (big ? 0.1 : 0.17) * D;
      for (let k = 0; k < n; k++) {
        const t = rnd(), y = rnd() * h;
        const vis = 0.35 + 0.65 * Math.exp(-y / 45);
        if (rnd() > vis) continue;
        const ph = (y % floorH) / floorH;
        let inten;
        if (ph < 0.2) inten = 0.48 + rnd() * 0.1;
        else { if (rnd() < 0.55) continue; inten = 0.2 + rnd() * 0.12; }
        emitE(e, a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t, inten, CLS.building);
      }
      // vertical corner line
      for (let k = 0; k < h * 2.2 * D; k++) emitE(e, a[0], rnd() * h, a[1], 0.5 + rnd() * 0.08, CLS.building);
    }
    // roof + roof parapet + floor slabs seen through glazing
    const [x0, z0, x1, z1] = polygonBBox(poly);
    const bw = x1 - x0, bh = z1 - z0;
    const roofN = Math.min(e.area, 12000) * 0.13 * D;
    let tries = 0, got = 0;
    while (got < roofN && tries < roofN * 4) {
      tries++;
      const x = x0 + rnd() * bw, z = z0 + rnd() * bh;
      if (!pointInPolygon(x, z, poly)) continue;
      got++;
      emitE(e, x, h + 0.02, z, 0.3 + rnd() * 0.08, CLS.building);
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < L * 1.6 * D; k++) { const t = rnd(); emitE(e, a[0] + (b[0] - a[0]) * t, h + rnd() * 1.0, a[1] + (b[1] - a[1]) * t, 0.45, CLS.building); }
    }
    if (!big && e.levels > 2) {
      const perLevel = Math.min(e.area, 2500) * 0.035 * D;
      for (let lv = 1; lv < e.levels; lv++) {
        const y = lv * floorH + 0.15;
        const vis = 0.35 + 0.65 * Math.exp(-y / 45);
        let t2 = 0, g2 = 0;
        while (g2 < perLevel * vis && t2 < perLevel * 4) {
          t2++;
          const x = x0 + rnd() * bw, z = z0 + rnd() * bh;
          if (!pointInPolygon(x, z, poly)) continue;
          g2++;
          emitE(e, x, y, z, 0.3 + rnd() * 0.1, CLS.floor);
        }
      }
    }
    // rooftop equipment
    if (e.area > 300 && rnd() < 0.6) {
      const cx = (x0 + x1) / 2 + (rnd() - 0.5) * bw * 0.3, cz = (z0 + z1) / 2 + (rnd() - 0.5) * bh * 0.3;
      if (pointInPolygon(cx, cz, poly)) boxFaces(e, cx, h, cz, 1, 0, 0, 1, 3 + rnd() * 3, 2 + rnd() * 2, 2 + rnd() * 1.5, 1.5, 0.4, CLS.building);
    }
  }
  progress(0.86);

  // ---------- ground, water, parks ----------
  const groundN = cw * ch * 0.22 * D;
  for (let k = 0; k < groundN; k++) {
    const x = (rnd() - 0.5) * cw, z = (rnd() - 0.5) * ch;
    const m = mask.get(x, z);
    if (m === 1 || m === 2 || m === 3 || m === 255) continue;
    const und = 0.25 * Math.sin(x * 0.011) * Math.cos(z * 0.013);
    if (m === 4) emit(x, und + rnd() * 0.25, z, 0.26 + rnd() * 0.12, CLS.lowVeg);
    else emit(x, und, z, 0.18 + rnd() * 0.08, CLS.ground);
  }
  for (const poly of data.water) {
    const [x0, z0, x1, z1] = polygonBBox(poly);
    const n = (x1 - x0) * (z1 - z0) * 0.035 * D;
    for (let k = 0; k < n; k++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!inCrop(x, z) || !pointInPolygon(x, z, poly)) continue;
      emit(x, -1.8 + rnd() * 0.1, z, 0.06 + rnd() * 0.06, CLS.water);
    }
  }
  for (const poly of data.parks) {
    const [x0, z0, x1, z1] = polygonBBox(poly);
    const n = polygonArea(poly) / 120;
    for (let k = 0; k < n; k++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!inCrop(x, z) || !pointInPolygon(x, z, poly)) continue;
      tree(x, z, 2 + rnd() * 2.5, 4 + rnd() * 4);
    }
  }
  // sparse noise returns (birds, multipath)
  const noiseN = cloud.n * 0.0025;
  for (let k = 0; k < noiseN; k++) {
    const i = Math.floor(rnd() * cloud.n);
    cloud.push(cloud.pos[i * 3] + (rnd() - 0.5) * 2, cloud.pos[i * 3 + 1] + (rnd() - 0.2) * 5, cloud.pos[i * 3 + 2] + (rnd() - 0.5) * 2, 0.08 + rnd() * 0.1, CLS.noise, 0, NO_ELEM);
  }
  progress(1);
  return cloud.finish();
}
