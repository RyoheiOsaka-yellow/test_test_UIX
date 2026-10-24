// Scan-to-BIM: derive a structural model from a point cloud alone (no survey data needed).
//   1. elevated deck surfaces → 2D rasters per height band → thinning → centreline polylines
//      with width (distance transform) and height (mean z) → "roads" for buildStructure
//   2. pier shafts → vertical point columns under the decks → pier positions
//   3. buildings → oriented bounding rectangles of building-classified components
//   4. every point is assigned to the nearest fitted element and its signed distance to the
//      design surface is stored as deviation (mm) → real Scan-to-BIM heat map + per-element stats
import { Raster, resample, framePath, pathLength, samplePath, polygonArea } from './geom.js';
import { DECK_T, GIRDER_D, RAIL_T, RAIL_H } from './structure.js';

const NO_ELEM = 65535;
const C = { ground: 2, building: 6, deck: 17, marking: 20, railing: 21, column: 22, girder: 23, road: 11 };

// ---------------------------------------------------------------- raster helpers
class Grid {
  constructor(minx, minz, w, h, res) { this.minx = minx; this.minz = minz; this.res = res; this.w = Math.ceil(w / res) + 2; this.h = Math.ceil(h / res) + 2; }
  ix(x) { return Math.floor((x - this.minx) / this.res) + 1; }
  iz(z) { return Math.floor((z - this.minz) / this.res) + 1; }
  x(i) { return this.minx + (i - 1 + 0.5) * this.res; }
  z(j) { return this.minz + (j - 1 + 0.5) * this.res; }
}

function dilate(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const k = j * w + i;
    if (mask[k] || mask[k - 1] || mask[k + 1] || mask[k - w] || mask[k + w] || mask[k - w - 1] || mask[k - w + 1] || mask[k + w - 1] || mask[k + w + 1]) out[k] = 1;
  }
  return out;
}
function erode(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const k = j * w + i;
    if (mask[k] && mask[k - 1] && mask[k + 1] && mask[k - w] && mask[k + w]) out[k] = 1;
  }
  return out;
}
/** Zhang-Suen thinning → 1-pixel skeleton. */
function thin(mask, w, h) {
  const m = Uint8Array.from(mask);
  let changed = true;
  const n = new Uint8Array(8);
  let active = [];
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) if (m[j * w + i]) active.push(j * w + i);
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const del = [];
      for (const k of active) {
        if (!m[k]) continue;
        n[0] = m[k - w]; n[1] = m[k - w + 1]; n[2] = m[k + 1]; n[3] = m[k + w + 1]; n[4] = m[k + w]; n[5] = m[k + w - 1]; n[6] = m[k - 1]; n[7] = m[k - w - 1];
        let B = 0, A = 0;
        for (let q = 0; q < 8; q++) { B += n[q]; if (n[q] === 0 && n[(q + 1) % 8] === 1) A++; }
        if (B < 2 || B > 6 || A !== 1) continue;
        if (pass === 0 ? n[0] * n[2] * n[4] !== 0 || n[2] * n[4] * n[6] !== 0 : n[0] * n[2] * n[6] !== 0 || n[0] * n[4] * n[6] !== 0) continue;
        del.push(k);
      }
      for (const k of del) m[k] = 0;
      if (del.length) { changed = true; active = active.filter((k) => m[k]); }
    }
  }
  return m;
}
/** Distance (in cells) to the nearest non-mask cell, by BFS from the boundary. */
function distanceTransform(mask, w, h) {
  const d = new Float32Array(mask.length).fill(1e9);
  const q = new Int32Array(mask.length * 2); let qh = 0, qt = 0;
  for (let k = 0; k < mask.length; k++) {
    if (mask[k]) continue;
    const i = k % w, j = (k / w) | 0;
    const nearMask = (i > 0 && mask[k - 1]) || (i < w - 1 && mask[k + 1]) || (j > 0 && mask[k - w]) || (j < h - 1 && mask[k + w]);
    if (nearMask) { d[k] = 0; q[qt++] = k; }
  }
  while (qh < qt) {
    const k = q[qh++], i = k % w, j = (k / w) | 0;
    for (const [di, dj, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
      const kk = jj * w + ii;
      if (mask[kk] && d[kk] > d[k] + c) { d[kk] = d[k] + c; q[qt++ % q.length] = kk; }
    }
  }
  return d;
}
/** Trace a skeleton into polylines (lists of cell indices) between endpoints / junctions. */
function tracePolylines(sk, w, h) {
  const deg = new Uint8Array(sk.length);
  const nb = (k) => { const out = []; const i = k % w, j = (k / w) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue; const kk = jj * w + ii; if (sk[kk]) out.push(kk); } return out; };
  for (let k = 0; k < sk.length; k++) if (sk[k]) deg[k] = nb(k).length;
  const used = new Uint8Array(sk.length);
  const lines = [];
  const walk = (start, next) => {
    const line = [start]; used[start] = 1;
    let prev = start, cur = next;
    while (cur >= 0 && !used[cur]) {
      line.push(cur); used[cur] = 1;
      if (deg[cur] !== 2) break;
      const ns = nb(cur).filter((k) => k !== prev && !used[k]);
      prev = cur; cur = ns.length ? ns[0] : -1;
    }
    return line;
  };
  for (let k = 0; k < sk.length; k++) {
    if (!sk[k] || used[k] || deg[k] === 2) continue;
    for (const n of nb(k)) if (!used[n]) { const l = walk(k, n); used[k] = 1; if (l.length > 2) lines.push(l); }
    used[k] = 1;
  }
  for (let k = 0; k < sk.length; k++) if (sk[k] && !used[k]) { const l = walk(k, nb(k)[0] ?? -1); if (l.length > 2) lines.push(l); } // loops
  return lines;
}

// ---------------------------------------------------------------- 1. decks
export function extractDecks(cloud, { res = 1, bandH = 2.0, minLen = 10, minHeight = 3.5, maxHeight = 45, log = () => {} } = {}) {
  const { n, pos, cls, nrm } = cloud;
  const classified = cls.some((c) => c === C.deck);
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity, maxy = 0;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2], y = pos[i * 3 + 1]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; if (y > maxy) maxy = y; }
  // candidate density → raster resolution (≥ 6 candidate points per cell), so sparse scans still yield corridors
  const isCand = (i) => { const y = pos[i * 3 + 1]; if (y < minHeight || y > maxHeight) return false; const c = cls[i]; return classified ? c === C.deck || c === C.marking : nrm ? Math.abs(nrm[i * 3 + 1]) > 95 && c !== C.building : true; };
  {
    const probe = new Set(); let pc = 0;
    for (let i = 0; i < n; i += 4) if (isCand(i)) { pc++; probe.add(`${Math.floor(pos[i * 3] / 2)},${Math.floor(pos[i * 3 + 2] / 2)}`); }
    const dens = (pc * 4) / Math.max(1, probe.size * 4); // candidate points per m²
    res = Math.max(res, Math.min(4, Math.ceil(Math.sqrt(6 / Math.max(0.05, dens)))));
    log(`deck candidate density ${dens.toFixed(2)} pt/m² → raster ${res} m`);
  }
  const g = new Grid(minx, minz, maxx - minx, maxz - minz, res);
  const nb = Math.ceil(Math.min(maxy, maxHeight) / bandH) + 1;
  // candidate deck points → per-band rasters (count, sum y)
  const bands = Array.from({ length: nb }, () => new Map()); // cell → [count, sumY]
  const bandOf = (y) => Math.floor(y / bandH);
  let cand = 0, cellsTotal = 0;
  for (let i = 0; i < n; i++) {
    if (!isCand(i)) continue;
    const y = pos[i * 3 + 1];
    cand++;
    const b = bandOf(y), k = g.iz(pos[i * 3 + 2]) * g.w + g.ix(pos[i * 3]);
    const m = bands[b]; let cell = m.get(k);
    if (!cell) { cell = [0, 0]; m.set(k, cell); cellsTotal++; }
    cell[0]++; cell[1] += y;
  }
  log(`deck candidates: ${cand} points in ${cellsTotal} cells, ${nb} height bands`);
  const minPts = Math.max(2, Math.round(cand / Math.max(1, cellsTotal) * 0.15));
  const segments = []; // { pts:[[x,y,z]...], width, bandLo, bandHi }
  for (let b = 0; b < nb; b++) {
    const mask = new Uint8Array(g.w * g.h);
    let any = 0;
    for (const [k, c] of bands[b]) if (c[0] >= minPts) { mask[k] = 1; any++; }
    // neighbouring bands overlap by one band so ramps are not cut at band edges
    if (b + 1 < nb) for (const [k, c] of bands[b + 1]) if (c[0] >= minPts) mask[k] = 1;
    if (any < 20) continue;
    // work on the band's bounding sub-rectangle (plus margin) — thinning on the full grid is far too slow
    let i0 = g.w, i1 = 0, j0 = g.h, j1 = 0;
    for (let k = 0; k < mask.length; k++) if (mask[k]) { const i = k % g.w, j = (k / g.w) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    i0 = Math.max(0, i0 - 4); j0 = Math.max(0, j0 - 4); i1 = Math.min(g.w - 1, i1 + 4); j1 = Math.min(g.h - 1, j1 + 4);
    const sw = i1 - i0 + 1, sh = j1 - j0 + 1;
    const sub = new Uint8Array(sw * sh);
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) sub[j * sw + i] = mask[(j + j0) * g.w + i + i0];
    const closed = erode(dilate(dilate(sub, sw, sh), sw, sh), sw, sh);
    const dist = distanceTransform(closed, sw, sh);
    const m = erode(closed, sw, sh);
    const sk = thin(m, sw, sh);
    const lines = tracePolylines(sk, sw, sh);
    for (const line of lines) {
      if (line.length * res * 0.9 < minLen) continue;
      const pts = [], widths = [];
      for (const kk of line) {
        const i = (kk % sw) + i0, j = ((kk / sw) | 0) + j0, k = j * g.w + i;
        // height: mean of candidate points in this cell (this band or the next)
        let sy = 0, sc = 0;
        for (const bb of [b, b + 1]) { const c = bands[bb] && bands[bb].get(k); if (c) { sy += c[1]; sc += c[0]; } }
        if (!sc) continue;
        pts.push([g.x(i), sy / sc, g.z(j)]);
        widths.push(dist[kk] * 2 * res);
      }
      if (pts.length < 4) continue;
      // smooth heights and positions (moving average), width = median of the central 60 %
      const sm = pts.map((p, i) => { let sx = 0, sy = 0, sz = 0, c = 0; for (let q = -3; q <= 3; q++) { const pp = pts[i + q]; if (pp) { sx += pp[0]; sy += pp[1]; sz += pp[2]; c++; } } return [sx / c, sy / c, sz / c]; });
      const ws = widths.slice().sort((a, b) => a - b);
      const width = Math.max(4, Math.min(32, ws[Math.floor(ws.length * 0.5)] + res * 0.5));
      segments.push({ pts: sm, width, band: b });
    }
  }
  // merge segments whose ends meet (same corridor split by band edges or junction nodes)
  const near = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 4.5 && Math.abs(a[1] - b[1]) < 2.5;
  const dirAt = (pts, atEnd) => { const n = Math.min(4, pts.length - 1); const a = atEnd ? pts[pts.length - 1 - n] : pts[n], b = atEnd ? pts[pts.length - 1] : pts[0]; const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
  let merged = true;
  const endHash = () => { const h = new Map(); segments.forEach((sg, j) => { for (const p of [sg.pts[0], sg.pts[sg.pts.length - 1]]) { const k = `${Math.floor(p[0] / 5)},${Math.floor(p[2] / 5)}`; if (!h.has(k)) h.set(k, new Set()); h.get(k).add(j); } }); return h; };
  const candidatesNear = (h, p) => { const out = new Set(); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = h.get(`${Math.floor(p[0] / 5) + di},${Math.floor(p[2] / 5) + dj}`); if (l) for (const j of l) out.add(j); } return out; };
  while (merged) {
    merged = false;
    const h = endHash();
    for (let i = 0; i < segments.length && !merged; i++) {
      const A = segments[i];
      let best = null, bestCos = 0.5; // require a reasonably straight continuation (< 60°)
      const cand = new Set([...candidatesNear(h, A.pts[0]), ...candidatesNear(h, A.pts[A.pts.length - 1])]);
      for (const j of cand) {
        if (i === j) continue;
        const B = segments[j];
        const a0 = A.pts[0], a1 = A.pts[A.pts.length - 1], b0 = B.pts[0], b1 = B.pts[B.pts.length - 1];
        const cands = [];
        if (near(a1, b0)) cands.push([dirAt(A.pts, true), dirAt(B.pts, false), () => A.pts.concat(B.pts.slice(1))]);
        if (near(a1, b1)) cands.push([dirAt(A.pts, true), dirAt(B.pts.slice().reverse(), false), () => A.pts.concat(B.pts.slice(0, -1).reverse())]);
        if (near(a0, b1)) cands.push([dirAt(B.pts, true), dirAt(A.pts, false), () => B.pts.concat(A.pts.slice(1))]);
        if (near(a0, b0)) cands.push([dirAt(B.pts.slice().reverse(), true), dirAt(A.pts, false), () => B.pts.slice().reverse().concat(A.pts.slice(1))]);
        for (const [d1, d2, join] of cands) { const cos = d1[0] * d2[0] + d1[1] * d2[1]; if (cos > bestCos) { bestCos = cos; best = { j, join }; } }
      }
      if (best) {
        const B = segments[best.j], la = A.pts.length, lb = B.pts.length;
        segments[i] = { pts: best.join(), width: (A.width * la + B.width * lb) / (la + lb), band: A.band };
        segments.splice(best.j, 1); merged = true;
      }
    }
  }
  // dedupe: drop a segment that lies almost entirely within 3 m of a longer one at similar height
  segments.sort((a, b) => b.pts.length - a.pts.length);
  const kept = [], occ = new Map();
  const okey = (p) => `${Math.floor(p[0] / 3)},${Math.floor(p[2] / 3)}`;
  const isCovered = (p) => { for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = occ.get(`${Math.floor(p[0] / 3) + di},${Math.floor(p[2] / 3) + dj}`); if (l && l.some((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < 3 && Math.abs(q[1] - p[1]) < 1.5)) return true; } return false; };
  for (const s of segments) {
    let covered = 0;
    for (const p of s.pts) if (isCovered(p)) covered++;
    if (covered / s.pts.length < 0.6) { kept.push(s); for (const p of s.pts) { const k = okey(p); if (!occ.has(k)) occ.set(k, []); occ.get(k).push(p); } }
  }
  log(`decks: ${kept.length} corridors, ${kept.reduce((a, s) => a + s.pts.length, 0)} m total`);
  return kept.map((s, i) => ({
    id: `scan${i}`, hw: s.width > 9 ? 'motorway' : 'motorway_link', kind: s.width > 9 ? 'expressway' : 'ramp', elevated: true,
    layer: Math.max(1, Math.round(s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length / 5.6)), width: Math.round(s.width * 10) / 10,
    lanes: Math.max(1, Math.round((s.width - 1.5) / 3.4)), oneway: true, name: '', ref: '', pts: resample(s.pts, 4).map((p) => [p[0], p[1], p[2]]),
  }));
}

// ---------------------------------------------------------------- 2. piers
export function extractPiers(cloud, roads, { res = 1, log = () => {} } = {}) {
  const { n, pos, cls, nrm } = cloud;
  const classified = cls.some((c) => c === C.column);
  const cells = new Map(); // key → {c, sx, sz, miny, maxy, idx[]}
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; }
  const g = new Grid(minx, minz, maxx - minx, maxz - minz, res);
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (y < 1.0 || y > 40) continue;
    const ok = classified ? cls[i] === C.column : nrm && Math.abs(nrm[i * 3 + 1]) < 35 && cls[i] !== C.building;
    if (!ok) continue;
    const k = g.iz(pos[i * 3 + 2]) * g.w + g.ix(pos[i * 3]);
    let s = cells.get(k);
    if (!s) { s = { c: 0, sx: 0, sz: 0, miny: 1e9, maxy: -1e9, idx: [] }; cells.set(k, s); }
    s.c++; s.sx += pos[i * 3]; s.sz += pos[i * 3 + 2]; if (y < s.miny) s.miny = y; if (y > s.maxy) s.maxy = y; if (s.idx.length < 400) s.idx.push(i);
  }
  // cells with a tall vertical extent and enough points → connected components → pier centroids
  const tall = [...cells.values()].filter((s) => s.maxy - s.miny > 4).map((s) => s.c).sort((a, b) => a - b);
  const minC = Math.max(3, Math.round((tall[tall.length >> 1] || 12) * 0.35));
  const strong = new Set();
  for (const [k, s] of cells) if (s.maxy - s.miny > 4 && s.c >= minC) strong.add(k);
  const seen = new Set(), piers = [];
  for (const k0 of strong) {
    if (seen.has(k0)) continue;
    const comp = []; const stack = [k0]; seen.add(k0);
    while (stack.length) {
      const k = stack.pop(); comp.push(k);
      const i = k % g.w, j = (k / g.w) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const kk = (j + dj) * g.w + i + di; if (strong.has(kk) && !seen.has(kk)) { seen.add(kk); stack.push(kk); } }
    }
    let sx = 0, sz = 0, c = 0, top = -1e9, bot = 1e9; const idx = [];
    for (const k of comp) { const s = cells.get(k); sx += s.sx; sz += s.sz; c += s.c; if (s.maxy > top) top = s.maxy; if (s.miny < bot) bot = s.miny; idx.push(...s.idx); }
    if (comp.length > 40) continue; // too wide for a pier (building wall)
    piers.push({ x: sx / c, z: sz / c, yTop: top, yBot: bot, cells: comp.length, points: c, idx });
  }
  // attach each pier to the nearest deck corridor (frame direction, deck height)
  const paths = roads.map((r) => framePath(resample(r.pts, 2)));
  const out = [];
  for (const p of piers) {
    let best = null, bd = 1e9;
    paths.forEach((path, ri) => { for (const q of path) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = { q, ri }; } } });
    if (!best || bd > roads[best.ri].width / 2 + 4) continue;
    if (p.yTop < best.q.y - DECK_T - GIRDER_D - 6 || p.yTop > best.q.y + 1.0) continue; // shaft must reach the girder
    // section fit: circle (median radius) vs rectangle aligned with the deck (95 % extents); keep the better residual
    const { tx, tz } = best.q, nx = -tz, nz = tx;
    const rs = [], us = [], vs = [];
    for (const i of p.idx) { const dx = pos[i * 3] - p.x, dz = pos[i * 3 + 2] - p.z; rs.push(Math.hypot(dx, dz)); us.push(Math.abs(dx * tx + dz * tz)); vs.push(Math.abs(dx * nx + dz * nz)); }
    const srt = (a) => a.slice().sort((q1, q2) => q1 - q2);
    const R = srt(rs)[rs.length >> 1];
    const U = srt(us)[Math.floor(us.length * 0.95)], V = srt(vs)[Math.floor(vs.length * 0.95)];
    let resC = 0, resR = 0;
    for (let k = 0; k < rs.length; k++) { resC += Math.abs(rs[k] - R); resR += Math.abs(Math.max(us[k] - U, vs[k] - V)); }
    const round = resC <= resR * 1.15;
    out.push({ x: p.x, z: p.z, tx, tz, road: best.ri, deckY: best.q.y, width: roads[best.ri].width, points: p.points, round, colW: round ? Math.round(R * 2 * 20) / 20 : Math.round(V * 2 * 20) / 20, colL: round ? Math.round(R * 2 * 20) / 20 : Math.round(U * 2 * 20) / 20 });
  }
  log(`piers: ${out.length} detected (${piers.length} vertical clusters, cell threshold ${minC} pts)`);
  return out;
}

// ---------------------------------------------------------------- 3. buildings (oriented boxes)
export function extractBuildings(cloud, { res = 2, log = () => {} } = {}) {
  const { n, pos, cls } = cloud;
  if (!cls.some((c) => c === C.building)) return [];
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; }
  const g = new Grid(minx, minz, maxx - minx, maxz - minz, res);
  const mask = new Uint8Array(g.w * g.h), hmax = new Float32Array(g.w * g.h);
  const cnt = new Uint16Array(g.w * g.h);
  for (let i = 0; i < n; i++) {
    if (cls[i] !== C.building) continue;
    const k = g.iz(pos[i * 3 + 2]) * g.w + g.ix(pos[i * 3]);
    cnt[k]++; const y = pos[i * 3 + 1]; if (y > hmax[k]) hmax[k] = y;
  }
  const occ = [...cnt].filter((c) => c > 0).sort((a, b) => a - b);
  const minB = Math.max(2, Math.round((occ[occ.length >> 1] || 3) * 0.3));
  for (let k = 0; k < mask.length; k++) if (cnt[k] >= minB) mask[k] = 1;
  const seen = new Uint8Array(mask.length), out = [];
  for (let k0 = 0; k0 < mask.length; k0++) {
    if (!mask[k0] || seen[k0]) continue;
    const comp = [], stack = [k0]; seen[k0] = 1;
    while (stack.length) {
      const k = stack.pop(); comp.push(k);
      const i = k % g.w, j = (k / g.w) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= g.w || jj >= g.h) continue; const kk = jj * g.w + ii; if (mask[kk] && !seen[kk]) { seen[kk] = 1; stack.push(kk); } }
    }
    if (comp.length < 3) continue;
    // PCA-oriented bounding rectangle of the component cells
    let sx = 0, sz = 0; for (const k of comp) { sx += g.x(k % g.w); sz += g.z((k / g.w) | 0); }
    const cx = sx / comp.length, cz = sz / comp.length;
    let a = 0, b = 0, d = 0; for (const k of comp) { const x = g.x(k % g.w) - cx, z = g.z((k / g.w) | 0) - cz; a += x * x; b += x * z; d += z * z; }
    const th = 0.5 * Math.atan2(2 * b, a - d), ux = Math.cos(th), uz = Math.sin(th);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9, h = 0; const hs = [];
    for (const k of comp) { const x = g.x(k % g.w) - cx, z = g.z((k / g.w) | 0) - cz; const u = x * ux + z * uz, v = -x * uz + z * ux; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; hs.push(hmax[k]); }
    hs.sort((p, q) => p - q); h = hs[Math.floor(hs.length * 0.9)];
    const hr = res / 2; u0 -= hr; u1 += hr; v0 -= hr; v1 += hr;
    const corner = (u, v) => [cx + u * ux - v * uz, cz + u * uz + v * ux];
    const pts = [corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)].map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    if (h < 3 || polygonArea(pts) < 20) continue;
    out.push({ id: `b${out.length}`, h: Math.round(h * 10) / 10, levels: Math.max(1, Math.round(h / 3.4)), name: '', use: '', pts });
  }
  log(`buildings: ${out.length} footprints`);
  return out;
}

// ---------------------------------------------------------------- 4. assignment + deviation
/**
 * Assign points to fitted elements and compute signed deviation (mm) to the design surface.
 * Writes cloud.elem and cloud.dev in place. Returns per-element stats.
 */
export function assignAndDeviate(cloud, elements, { log = () => {}, refineWidths = true } = {}) {
  const { n, pos, cls, elem, dev } = cloud;
  elem.fill(NO_ELEM); dev.fill(128);
  if (refineWidths) refineDeckWidths(cloud, elements, log);
  // spatial hash of deck path samples (cell 6 m) → nearest corridor lookup
  const CELL = 6, hash = new Map();
  const decks = elements.filter((e) => e.type === 'deck');
  const railByDeck = new Map();
  for (const e of elements) if (e.type === 'railing') { if (!railByDeck.has(e.parent)) railByDeck.set(e.parent, []); railByDeck.get(e.parent).push(e); }
  const girderByDeck = new Map(); for (const e of elements) if (e.type === 'girder') girderByDeck.set(e.parent, e);
  for (const e of decks) for (let i = 0; i < e.path.length; i++) {
    const p = e.path[i], k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!hash.has(k)) hash.set(k, []);
    hash.get(k).push([e, i]);
  }
  const columns = elements.filter((e) => e.type === 'column');
  const colHash = new Map();
  for (const c of columns) { const k = `${Math.floor(c.x / 10)},${Math.floor(c.z / 10)}`; if (!colHash.has(k)) colHash.set(k, []); colHash.get(k).push(c); }
  const stats = new Map();
  const acc = (id, d) => { let s = stats.get(id); if (!s) { s = { count: 0, sum: 0, maxAbs: 0 }; stats.set(id, s); } s.count++; s.sum += d; if (Math.abs(d) > s.maxAbs) s.maxAbs = Math.abs(d); };
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const c = cls[i];
    if (c === C.building || c === C.ground || c === C.road || y < 0.5) continue;
    // nearest deck sample within 3x3 cells
    let best = null, bd = 1e9;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const list = hash.get(`${cx + di},${cz + dj}`); if (!list) continue;
      for (const [e, idx] of list) { const p = e.path[idx]; const d = (p.x - x) ** 2 + (p.z - z) ** 2 + (p.y - y) ** 2 * 0.15; if (d < bd) { bd = d; best = [e, idx]; } }
    }
    let hit = null, dmm = 0;
    if (best) {
      const e = best[0], p = e.path[best[1]];
      // refine with the two neighbouring samples (local segment projection)
      const q = e.path[Math.min(e.path.length - 1, best[1] + 1)], r = e.path[Math.max(0, best[1] - 1)];
      const seg = p === q ? [r, p] : [p, q];
      const [a, b] = seg; const tx = b.x - a.x, tz = b.z - a.z, L2 = tx * tx + tz * tz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * tx + (z - a.z) * tz) / L2));
      const px = a.x + tx * t, pz = a.z + tz * t, py = a.y + (b.y - a.y) * t;
      const nx = -tz / Math.sqrt(L2), nz = tx / Math.sqrt(L2);
      const v = (x - px) * nx + (z - pz) * nz, dy = y - py, hw = e.width / 2;
      const av = Math.abs(v);
      if (av > hw - RAIL_T - 0.35 && av < hw + 0.45 && dy > 0.06 && dy < RAIL_H + 1.3) {                                    // parapet: lateral deviation of the nearer face
        const rails = railByDeck.get(e.id) || [];
        const rail = rails.find((rr) => Math.sign(rr.side) === Math.sign(v)) || rails[0];
        if (rail) { hit = rail; dmm = (av >= hw - RAIL_T / 2 ? av - hw : av - (hw - RAIL_T)) * 1000; }
      } else if (av <= hw - RAIL_T + 0.1 && dy > -0.3 && dy < 0.3) { hit = e; dmm = dy * 1000; }                          // deck surface: vertical deviation
      else if (Math.abs(v) < hw + 0.3 && dy < -0.2 && dy > -(DECK_T + GIRDER_D + 0.6)) {                                 // girder
        const gd = girderByDeck.get(e.id);
        if (gd) {
          if (dy < -(DECK_T + GIRDER_D - 0.35)) { hit = gd; dmm = (dy + DECK_T + GIRDER_D) * 1000; }                        // soffit: vertical deviation
          else { const f = Math.min(1, Math.max(0, (-dy - DECK_T) / gd.depth)); const expect = gd.wTop / 2 + (gd.wBot / 2 - gd.wTop / 2) * f; if (Math.abs(Math.abs(v) - expect) < 0.5) { hit = gd; dmm = (Math.abs(v) - expect) * 1000; } }
        }
      }
    }
    if (!hit && (c === C.column || c === 27 || !cls.some)) { /* fallthrough */ }
    if (!hit && y > 0.5) {
      const list = []; const kx = Math.floor(x / 10), kz = Math.floor(z / 10);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const l = colHash.get(`${kx + di},${kz + dj}`); if (l) list.push(...l); }
      for (const col of list) {
        if (y < col.yBot - 0.5 || y > col.yTop + 0.3) continue;
        let sd;
        if (col.round) sd = Math.hypot(x - col.x, z - col.z) - col.colW / 2;
        else { const u = (x - col.x) * col.tx + (z - col.z) * col.tz, v = -(x - col.x) * col.tz + (z - col.z) * col.tx; const du = Math.abs(u) - col.colL / 2, dv = Math.abs(v) - col.colW / 2; sd = Math.max(du, dv); }
        if (sd < 0.45 && sd > -0.6) { hit = col; dmm = sd * 1000; break; }
      }
    }
    if (hit) { elem[i] = hit.id; const dd = Math.max(-127, Math.min(127, Math.round(dmm))); dev[i] = 128 + dd; acc(hit.id, dmm); assigned++; }
  }
  log(`assigned ${assigned.toLocaleString()} / ${n.toLocaleString()} points to ${stats.size} elements`);
  const out = {};
  for (const [id, s] of stats) out[id] = { count: s.count, meanDev: s.sum / s.count, maxDev: s.maxAbs };
  return out;
}

/**
 * Refit each fitted corridor to the measured points: per 10 m bin along the path, the lateral
 * centre is the mid-point between the two parapet medians, the height is the median pavement
 * height, and the width follows the parapet spacing. Paths and dependent elements are updated.
 */
function refineDeckWidths(cloud, elements, log) {
  const { n, pos, cls } = cloud;
  const decks = elements.filter((e) => e.type === 'deck');
  const CELL = 6, hash = new Map();
  for (const e of decks) for (let i = 0; i < e.path.length; i++) { const p = e.path[i], k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push([e, i]); }
  const BIN = 10;
  const bins = new Map(); // deckId → Map(binIndex → {L:[], R:[], H:[]})
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1]; if (y < 3) continue;
    const c = cls[i]; if (c === C.building || c === C.ground || c === C.road) continue;
    const x = pos[i * 3], z = pos[i * 3 + 2];
    let best = null, bd = 1e9; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const l = hash.get(`${cx + di},${cz + dj}`); if (!l) continue; for (const [e, idx] of l) { const p = e.path[idx]; const d = (p.x - x) ** 2 + (p.z - z) ** 2 + (p.y - y) ** 2 * 0.15; if (d < bd) { bd = d; best = [e, idx]; } } }
    if (!best) continue;
    const e = best[0], p = e.path[best[1]], dy = y - p.y;
    const v = (x - p.x) * p.nx + (z - p.z) * p.nz, av = Math.abs(v), hw = e.width / 2;
    if (av > hw + 3) continue;
    let m = bins.get(e.id); if (!m) { m = new Map(); bins.set(e.id, m); }
    const b = Math.floor(p.s / BIN); let bb = m.get(b); if (!bb) { bb = { L: [], R: [], H: [] }; m.set(b, bb); }
    if (dy > 0.3 && dy < RAIL_H && av > 1) (v < 0 ? bb.L : bb.R).push(av);
    else if (Math.abs(dy) < 0.6 && av < hw - 0.6) bb.H.push(dy);
  }
  const med = (a) => { if (a.length < 8) return null; a.sort((p, q) => p - q); return a[a.length >> 1]; };
  let refined = 0;
  for (const e of decks) {
    const m = bins.get(e.id); if (!m) continue;
    // per-bin corrections, then interpolate along the path (holes filled from neighbours)
    const nb = Math.floor(e.path[e.path.length - 1].s / BIN) + 1;
    const lat = new Array(nb).fill(null), ver = new Array(nb).fill(null), wid = new Array(nb).fill(null);
    for (const [b, bb] of m) { const l = med(bb.L), r = med(bb.R), h = med(bb.H); if (l != null && r != null) { lat[b] = (r - l) / 2; wid[b] = (r + l) / 2 * 2 + RAIL_T; } if (h != null) ver[b] = h; }
    const fill = (arr) => { const idx = arr.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0); if (!idx.length) return null; return arr.map((v, i) => { if (v != null) return v; let lo = -1, hi = -1; for (const j of idx) { if (j < i) lo = j; else { hi = j; break; } } if (lo < 0) return arr[hi]; if (hi < 0) return arr[lo]; return arr[lo] + (arr[hi] - arr[lo]) * ((i - lo) / (hi - lo)); }); };
    const latF = fill(lat), verF = fill(ver), widF = fill(wid);
    if (!latF && !verF) continue;
    refined++;
    const smooth = (arr) => arr.map((v, i) => { let s = 0, c = 0; for (let q = -1; q <= 1; q++) if (arr[i + q] != null) { s += arr[i + q]; c++; } return s / c; });
    const latS = latF && smooth(latF), verS = verF && smooth(verF);
    for (const p of e.path) {
      const b = Math.min(nb - 1, Math.floor(p.s / BIN));
      if (latS) { p.x += p.nx * latS[b]; p.z += p.nz * latS[b]; }
      if (verS) p.y += verS[b];
    }
    if (widF) {
      const ws = widF.slice().sort((a, b) => a - b), w = Math.round(ws[ws.length >> 1] * 100) / 100;
      for (const el of elements) if (el === e || el.parent === e.id) {
        if (el.type === 'deck') { el.width = w; el.typeName = `t=${(el.thick * 1000) | 0} W=${(w * 1000) | 0}`; }
        if (el.type === 'girder') { el.wTop = Math.max(3, w - 1.0); el.wBot = Math.max(2.5, w - 3.2); el.typeName = `W${(el.wTop * 1000) | 0}×D${(el.depth * 1000) | 0}`; }
        if (el.type === 'railing') el.offset = el.side * (w / 2 - RAIL_T / 2);
        if (el.type === 'cap') { el.w = w + 1.4; el.typeName = `W${((w + 1.4) * 1000) | 0}×H${(el.h * 1000) | 0}`; }
      }
    }
  }
  log(`corridors refitted to parapets / pavement: ${refined} / ${decks.length}`);
}

/** Full pipeline: cloud → { data (roads/buildings/piers), log } ready for buildStructure. */
export function scanToBim(cloud, opts = {}) {
  const lines = [];
  const log = (m) => { lines.push(m); if (opts.log) opts.log(m); };
  let t = performance.now();
  const roads = extractDecks(cloud, { log }); log(`  (decks ${((performance.now() - t) / 1000).toFixed(1)} s)`); t = performance.now();
  const piers = extractPiers(cloud, roads, { log }); log(`  (piers ${((performance.now() - t) / 1000).toFixed(1)} s)`); t = performance.now();
  const buildings = extractBuildings(cloud, { log }); log(`  (buildings ${((performance.now() - t) / 1000).toFixed(1)} s)`);
  const data = { site: { layerHeight: 5.6, cropM: [0, 0], drive: {} }, roads, buildings, water: [], parks: [], rail: [], piers };
  return { data, log: lines };
}
