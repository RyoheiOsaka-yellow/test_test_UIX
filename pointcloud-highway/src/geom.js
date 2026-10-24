// Pure geometry helpers shared by the main thread and the synthesis worker (no three.js).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rnd) {
  // Box-Muller
  const u = 1 - rnd(), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Centripetal Catmull-Rom resampling of a 3D polyline at ~ds spacing. Returns array of [x,y,z]. */
export function resample(pts, ds) {
  if (pts.length < 2) return pts.map((p) => p.slice());
  // remove duplicate consecutive points
  const P = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = P[P.length - 1], b = pts[i];
    if (Math.hypot(b[0] - a[0], b[2] - a[2]) > 0.05) P.push(b);
  }
  if (P.length < 2) return P;
  if (P.length === 2) return lerpLine(P[0], P[1], ds);
  const out = [];
  const n = P.length;
  const get = (i) => P[Math.min(Math.max(i, 0), n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
    const steps = Math.max(1, Math.round(segLen / ds));
    // centripetal parametrisation
    const t0 = 0;
    const t1 = t0 + Math.max(1e-3, Math.sqrt(dist(p0, p1)));
    const t2 = t1 + Math.max(1e-3, Math.sqrt(dist(p1, p2)));
    const t3 = t2 + Math.max(1e-3, Math.sqrt(dist(p2, p3)));
    for (let s = 0; s < steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      out.push(catmull(p0, p1, p2, p3, t0, t1, t2, t3, t));
    }
  }
  out.push(P[n - 1].slice());
  return out;
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function lerpLine(a, b, ds) {
  const L = dist(a, b);
  const steps = Math.max(1, Math.round(L / ds));
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

function catmull(p0, p1, p2, p3, t0, t1, t2, t3, t) {
  const r = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const A1 = ((t1 - t) / (t1 - t0)) * p0[k] + ((t - t0) / (t1 - t0)) * p1[k];
    const A2 = ((t2 - t) / (t2 - t1)) * p1[k] + ((t - t1) / (t2 - t1)) * p2[k];
    const A3 = ((t3 - t) / (t3 - t2)) * p2[k] + ((t - t2) / (t3 - t2)) * p3[k];
    const B1 = ((t2 - t) / (t2 - t0)) * A1 + ((t - t0) / (t2 - t0)) * A2;
    const B2 = ((t3 - t) / (t3 - t1)) * A2 + ((t - t1) / (t3 - t1)) * A3;
    r[k] = ((t2 - t) / (t2 - t1)) * B1 + ((t - t1) / (t2 - t1)) * B2;
  }
  return r;
}

/** Build a path with frames: {x,y,z, tx,tz, nx,nz, s} where (tx,tz) is the horizontal tangent
 *  and (nx,nz) the left-hand normal; s is the arc length. */
export function framePath(pts) {
  const out = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[2] - a[2];
    const L = Math.hypot(tx, tz) || 1;
    tx /= L; tz /= L;
    if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    out.push({ x: pts[i][0], y: pts[i][1], z: pts[i][2], tx, tz, nx: -tz, nz: tx, s });
  }
  return out;
}

export function pathLength(path) {
  return path.length ? path[path.length - 1].s : 0;
}

/** Interpolate a framed path at arc length s. */
export function samplePath(path, s) {
  if (s <= 0) return path[0];
  if (s >= path[path.length - 1].s) return path[path.length - 1];
  let lo = 0, hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].s <= s) lo = mid; else hi = mid;
  }
  const a = path[lo], b = path[hi];
  const t = (s - a.s) / Math.max(1e-6, b.s - a.s);
  const tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t;
  const L = Math.hypot(tx, tz) || 1;
  return {
    x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
    tx: tx / L, tz: tz / L, nx: -tz / L, nz: tx / L, s,
  };
}

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

export function polygonBBox(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of poly) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

/** Simple 2D occupancy raster covering the crop rectangle at 1 m resolution. */
export class Raster {
  constructor(w, h, res = 1) {
    this.res = res;
    this.w = Math.ceil(w / res); this.h = Math.ceil(h / res);
    this.ox = -w / 2; this.oz = -h / 2;
    this.data = new Uint8Array(this.w * this.h);
  }
  idx(x, z) {
    const i = Math.floor((x - this.ox) / this.res), j = Math.floor((z - this.oz) / this.res);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }
  get(x, z) { const k = this.idx(x, z); return k < 0 ? 255 : this.data[k]; }
  set(x, z, v) { const k = this.idx(x, z); if (k >= 0) this.data[k] = v; }
  fillPolygon(poly, v) {
    const [x0, z0, x1, z1] = polygonBBox(poly);
    for (let z = z0; z <= z1; z += this.res)
      for (let x = x0; x <= x1; x += this.res)
        if (pointInPolygon(x + this.res / 2, z + this.res / 2, poly)) this.set(x, z, v);
  }
  fillDisc(x, z, r, v) {
    for (let dz = -r; dz <= r; dz += this.res)
      for (let dx = -r; dx <= r; dx += this.res)
        if (dx * dx + dz * dz <= r * r) this.set(x + dx, z + dz, v);
  }
}
