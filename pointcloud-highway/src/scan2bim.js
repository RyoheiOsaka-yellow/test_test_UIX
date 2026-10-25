// Scan-to-BIM: derive a structural model from a point cloud alone (no survey data needed).
//   1. elevated deck surfaces → 2D rasters per height band → thinning → centreline polylines
//      with width (distance transform) and height (mean z) → "roads" for buildStructure
//   2. pier shafts → vertical point columns under the decks → pier positions
//   3. buildings → oriented bounding rectangles of building-classified components
//   4. every point is assigned to the nearest fitted element and its signed distance to the
//      design surface is stored as deviation (mm) → real Scan-to-BIM heat map + per-element stats
import { Raster, resample, framePath, pathLength, samplePath, polygonArea } from './geom.js';
import { DECK_T, GIRDER_D, RAIL_T, RAIL_H } from './structure.js';
import { ransacPlane, ransacCircle, median } from './fit.js';

const UNASSIGNED = 65535;
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
export function extractDecks(cloud, { res = 1, bandH = 2.0, minLen = 10, minHeight = 2.0, maxHeight = 45, log = () => {} } = {}) {
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
    const m = erode(closed, sw, sh);
    const dist = distanceTransform(m, sw, sh);
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
        widths.push(Math.max(res, (dist[kk] * 2 - 1) * res));
      }
      if (pts.length < 4) continue;
      // smooth heights and positions (moving average), width = median of the central 60 %
      const sm = pts.map((p, i) => { let sx = 0, sy = 0, sz = 0, c = 0; for (let q = -3; q <= 3; q++) { const pp = pts[i + q]; if (pp) { sx += pp[0]; sy += pp[1]; sz += pp[2]; c++; } } return [sx / c, sy / c, sz / c]; });
      const wsm = widths.map((w, i) => { const win = []; for (let q = -4; q <= 4; q++) if (widths[i + q] != null) win.push(widths[i + q]); win.sort((a, b2) => a - b2); return win[win.length >> 1]; });
      // split where the local width changes class (a ramp running into a junction blob, a merge nose)
      let start = 0;
      for (let i = 1; i <= wsm.length; i++) {
        const cur = wsm.slice(start, i); const curMed = cur.slice().sort((a, b2) => a - b2)[cur.length >> 1];
        const jump = i < wsm.length && Math.abs(wsm[i] - curMed) > Math.max(3, curMed * 0.45) && (i + 4 >= wsm.length || Math.abs(wsm[i + 4] - curMed) > Math.max(3, curMed * 0.45));
        if (i === wsm.length || jump) {
          if (i - start >= 3) segments.push({ pts: sm.slice(start, i), width: Math.max(4, Math.min(32, curMed)), band: b });
          start = i;
        }
      }
    }
  }
  // merge segments whose ends meet (same corridor split by band edges or junction nodes)
  const near = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 8 && Math.abs(a[1] - b[1]) < 3;
  const similar = (A, B) => Math.abs(A.width - B.width) <= Math.max(2.5, 0.35 * Math.max(A.width, B.width));
  const dirAt = (pts, atEnd) => { const n = Math.min(4, pts.length - 1); const a = atEnd ? pts[pts.length - 1 - n] : pts[n], b = atEnd ? pts[pts.length - 1] : pts[0]; const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
  let merged = true;
  const endHash = () => { const h = new Map(); segments.forEach((sg, j) => { for (const p of [sg.pts[0], sg.pts[sg.pts.length - 1]]) { const k = `${Math.floor(p[0] / 8)},${Math.floor(p[2] / 8)}`; if (!h.has(k)) h.set(k, new Set()); h.get(k).add(j); } }); return h; };
  const candidatesNear = (h, p) => { const out = new Set(); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = h.get(`${Math.floor(p[0] / 8) + di},${Math.floor(p[2] / 8) + dj}`); if (l) for (const j of l) out.add(j); } return out; };
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
        if (!similar(A, B)) continue;
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
  log(`decks: ${kept.length} corridors (${segments.length} after merging), ${kept.reduce((a, s) => a + s.pts.length * res, 0).toFixed(0)} m total`);
  return kept.map((s, i) => ({
    id: `scan${i}`, hw: s.width > 9 ? 'motorway' : 'motorway_link', kind: s.width > 9 ? 'expressway' : 'ramp', elevated: true,
    layer: Math.max(1, Math.round(s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length / 5.6)), width: Math.round(s.width * 10) / 10,
    lanes: Math.max(1, Math.round((s.width - 1.5) / 3.4)), oneway: true, name: '', ref: '', pts: resample(s.pts, 4).map((p) => [p[0], p[1], p[2]]),
  }));
}

// ---------------------------------------------------------------- 1a. decks from parapet pairs (classified scans)
/**
 * Parapets are thin, continuous lines; two parallel ones at the same height 4–22 m apart bound a
 * deck. This resolves adjacent decks that the occupancy raster merges into one blob.
 */
export function extractDecksFromParapets(cloud, { res = 1, bandH = 2.0, minLen = 12, minHeight = 2.0, maxHeight = 45, log = () => {} } = {}) {
  const { n, pos, cls } = cloud;
  if (!cls.some((c) => c === C.railing)) return [];
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity, maxy = 0;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2], y = pos[i * 3 + 1]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; if (y > maxy) maxy = y; }
  const g = new Grid(minx, minz, maxx - minx, maxz - minz, res);
  const nb = Math.ceil(Math.min(maxy, maxHeight) / bandH) + 1;
  const bands = Array.from({ length: nb }, () => new Map()); // cell → [count, maxY]
  for (let i = 0; i < n; i++) {
    if (cls[i] !== C.railing) continue;
    const y = pos[i * 3 + 1]; if (y < minHeight || y > maxHeight) continue;
    const b = Math.floor(y / bandH), k = g.iz(pos[i * 3 + 2]) * g.w + g.ix(pos[i * 3]);
    const m = bands[b]; let cell = m.get(k); if (!cell) { cell = [0, -1e9]; m.set(k, cell); }
    cell[0]++; if (y > cell[1]) cell[1] = y;
  }
  // parapet lines per band (lines are thin: no closing, light pruning by count)
  const lines = []; // { pts:[[x,top,z]...] }
  for (let b = 0; b < nb; b++) {
    const mask = new Uint8Array(g.w * g.h); let any = 0;
    for (const [k, c] of bands[b]) if (c[0] >= 2) { mask[k] = 1; any++; }
    if (b + 1 < nb) for (const [k, c] of bands[b + 1]) if (c[0] >= 2) mask[k] = 1;
    if (any < 10) continue;
    let i0 = g.w, i1 = 0, j0 = g.h, j1 = 0;
    for (let k = 0; k < mask.length; k++) if (mask[k]) { const i = k % g.w, j = (k / g.w) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    i0 = Math.max(0, i0 - 3); j0 = Math.max(0, j0 - 3); i1 = Math.min(g.w - 1, i1 + 3); j1 = Math.min(g.h - 1, j1 + 3);
    const sw = i1 - i0 + 1, sh = j1 - j0 + 1, sub = new Uint8Array(sw * sh);
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) sub[j * sw + i] = mask[(j + j0) * g.w + i + i0];
    const closed = erode(dilate(sub, sw, sh), sw, sh); // bridge 1-cell gaps only
    const sk = thin(closed, sw, sh);
    for (const line of tracePolylines(sk, sw, sh)) {
      if (line.length * res < minLen) continue;
      const pts = [];
      for (const kk of line) {
        const i = (kk % sw) + i0, j = ((kk / sw) | 0) + j0, k = j * g.w + i;
        let top = -1e9; for (const bb of [b, b + 1]) { const c = bands[bb] && bands[bb].get(k); if (c && c[1] > top) top = c[1]; }
        if (top < -1e8) { // skeleton cell outside raw cells (closing): take neighbours
          for (let dj = -1; dj <= 1 && top < -1e8; dj++) for (let di = -1; di <= 1; di++) { const c = bands[b].get((j + dj) * g.w + i + di) || (bands[b + 1] && bands[b + 1].get((j + dj) * g.w + i + di)); if (c && c[1] > top) top = c[1]; }
        }
        if (top < -1e8) continue;
        pts.push([g.x(i), top, g.z(j)]);
      }
      if (pts.length >= 4) lines.push({ pts: pts.map((p, i) => { let sx = 0, sy = 0, sz = 0, c = 0; for (let q = -2; q <= 2; q++) { const pp = pts[i + q]; if (pp) { sx += pp[0]; sy += pp[1]; sz += pp[2]; c++; } } return [sx / c, sy / c, sz / c]; }), band: b });
    }
  }
  // dedupe lines duplicated by the band overlap
  lines.sort((a, b) => b.pts.length - a.pts.length);
  const keptL = [], occ = new Map();
  const okey = (p) => `${Math.floor(p[0] / 2)},${Math.floor(p[2] / 2)}`;
  const covered = (p) => { for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = occ.get(`${Math.floor(p[0] / 2) + di},${Math.floor(p[2] / 2) + dj}`); if (l && l.some((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < 1.6 && Math.abs(q[1] - p[1]) < 1.2)) return true; } return false; };
  for (const L of lines) { let c = 0; for (const p of L.pts) if (covered(p)) c++; if (c / L.pts.length < 0.5) { keptL.push(L); for (const p of L.pts) { const k = okey(p); if (!occ.has(k)) occ.set(k, []); occ.get(k).push(p); } } }
  // frames + spatial hash of line samples
  const framed = keptL.map((L, li) => ({ li, path: framePath(resample(L.pts, 2)) }));
  const hash = new Map();
  framed.forEach((F) => F.path.forEach((p, i) => { const k = `${Math.floor(p.x / 8)},${Math.floor(p.z / 8)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push([F.li, i]); }));
  // pairing: for each line, per side, the partner line most often found parallel at 4–22 m and same height
  const bestOf = new Map(); // li → [{lj, n, d}, {lj, n, d}] per side (0 = left, 1 = right)
  for (const F of framed) {
    const votes = [new Map(), new Map()];
    for (let i = 0; i < F.path.length; i += 2) {
      const p = F.path[i];
      const seen = new Map(); // li → best (|v|, cos)
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const l = hash.get(`${Math.floor(p.x / 8) + di},${Math.floor(p.z / 8) + dj}`); if (!l) continue;
        for (const [lj, idx] of l) {
          if (lj === F.li) continue;
          const q = framed[lj].path[idx];
          const u = (q.x - p.x) * p.tx + (q.z - p.z) * p.tz, v = (q.x - p.x) * p.nx + (q.z - p.z) * p.nz;
          if (Math.abs(u) > 2.5 || Math.abs(v) < 4 || Math.abs(v) > 22 || Math.abs(q.y - p.y) > 0.7) continue;
          const cos = Math.abs(q.tx * p.tx + q.tz * p.tz); if (cos < 0.85) continue;
          const prev = seen.get(lj); if (!prev || Math.abs(v) < Math.abs(prev)) seen.set(lj, v);
        }
      }
      // nearest partner on each side wins this sample
      let bestL = null, bestR = null;
      for (const [lj, v] of seen) { if (v < 0) { if (!bestL || -v < -bestL[1]) bestL = [lj, v]; } else if (!bestR || v < bestR[1]) bestR = [lj, v]; }
      for (const [side, b] of [[0, bestL], [1, bestR]]) if (b) { const m = votes[side]; const e = m.get(b[0]) || { n: 0, d: [] }; e.n++; e.d.push(Math.abs(b[1])); m.set(b[0], e); }
    }
    const rec = [null, null];
    for (const side of [0, 1]) {
      let best = null; for (const [lj, e] of votes[side]) if (!best || e.n > best[1].n) best = [lj, e];
      if (!best || best[1].n < Math.max(3, (F.path.length / 2) * 0.5)) continue;
      rec[side] = { lj: best[0], n: best[1].n, d: best[1].d };
    }
    bestOf.set(F.li, rec);
  }
  // a pair is kept only when it is mutual: A's partner on one side is B and B's partner on some side is A
  const pairs = new Map();
  for (const [li, rec] of bestOf) for (const side of [0, 1]) {
    const r = rec[side]; if (!r) continue;
    const back = bestOf.get(r.lj); if (!back || !back.some((o) => o && o.lj === li)) continue;
    const key = li < r.lj ? `${li}:${r.lj}` : `${r.lj}:${li}`;
    const pr = pairs.get(key) || { a: Math.min(li, r.lj), b: Math.max(li, r.lj), d: [], votes: 0 };
    pr.d.push(...r.d); pr.votes += r.n; pairs.set(key, pr);
  }
  // pavement check: deck points must exist between the lines (hash of deck-class points at 4 m cells)
  const deckHash = new Map();
  for (let i = 0; i < n; i++) { if (cls[i] !== C.deck) continue; const k = `${Math.floor(pos[i * 3] / 4)},${Math.floor(pos[i * 3 + 2] / 4)}`; let l = deckHash.get(k); if (!l) { l = []; deckHash.set(k, l); } if (l.length < 64) l.push(pos[i * 3 + 1]); }
  // wall tops include fence points (up to ~1 m above the coping), so look for pavement within 2.2 m below the estimate
  const pavementAt = (x, y, z) => { const l = deckHash.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`); if (!l) return null; const ys = l.filter((yy) => yy - y < 0.6 && y - yy < 2.2); return ys.length ? median(ys) : null; };
  // decks from pairs: midline over the overlapping extent of the longer line
  const roads = [];
  for (const pr of pairs.values()) {
    const A = framed[pr.a].path, B = framed[pr.b].path;
    const [longP, shortP] = A.length >= B.length ? [A, B] : [B, A];
    const bh = new Map(); shortP.forEach((q, i) => { const k = `${Math.floor(q.x / 8)},${Math.floor(q.z / 8)}`; if (!bh.has(k)) bh.set(k, []); bh.get(k).push(i); });
    const mid = [];
    for (const p of longP) {
      let bq = null, bd = 1e9;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const l = bh.get(`${Math.floor(p.x / 8) + di},${Math.floor(p.z / 8) + dj}`); if (!l) continue; for (const i of l) { const q = shortP[i]; const u = (q.x - p.x) * p.tx + (q.z - p.z) * p.tz; if (Math.abs(u) > 2.5) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd && d >= 4 && d <= 22 && Math.abs(q.y - p.y) < 0.7) { bd = d; bq = q; } } }
      if (bq) mid.push([(p.x + bq.x) / 2, (p.y + bq.y) / 2 - RAIL_H, (p.z + bq.z) / 2]);
    }
    if (mid.length * 2 < minLen) continue;
    let paved = 0; for (const m of mid) { const py = pavementAt(m[0], m[1], m[2]); if (py != null) { m[1] = py; paved++; } }
    if (paved < mid.length * 0.6) continue; // phantom: no pavement between the two lines
    for (let i = 0; i < mid.length; i++) if (mid[i][1] == null) mid[i][1] = mid[Math.max(0, i - 1)][1];
    const w = Math.round((median(pr.d) + RAIL_T) * 10) / 10;
    roads.push({ id: `pp${roads.length}`, hw: w > 9 ? 'motorway' : 'motorway_link', kind: w > 9 ? 'expressway' : 'ramp', elevated: true, layer: Math.max(1, Math.round(mid[0][1] / 5.6)), width: w, lanes: Math.max(1, Math.round((w - 1.5) / 3.4)), oneway: true, name: '', ref: '', pts: resample(mid, 4), fromParapets: true });
  }
  log(`parapet lines: ${keptL.length} (${lines.length} raw) → ${pairs.size} pairs → ${roads.length} decks, ${roads.reduce((a, r) => a + r.pts.length * 4, 0)} m`);
  return roads;
}

// ---------------------------------------------------------------- 1b. split merged corridors
/**
 * A wide corridor that actually holds two parallel viaducts (up / down lines a few metres apart)
 * is split along the lateral gaps in deck occupancy. Per 10 m bin a lateral histogram (0.25 m)
 * of deck + marking points is scanned for runs separated by ≥ 0.75 m of emptiness; when ≥ 60 %
 * of the bins agree on the run count, the corridor becomes that many sub-corridors.
 */
export function splitCorridors(cloud, roads, { log = () => {} } = {}) {
  const { n, pos, cls } = cloud;
  const classified = cls.some((c) => c === C.deck);
  const paths = roads.map((r) => framePath(resample(r.pts, 2)));
  const CELL = 6, hash = new Map();
  paths.forEach((path, ri) => path.forEach((p, i) => { const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push([ri, i]); }));
  const BIN = 10, HW = 0.25;
  const hist = roads.map(() => new Map()); // bin → { h: Float32Array(lateral histogram), y: Float32Array(sum of heights) }
  const span = (ri) => Math.ceil((roads[ri].width / 2 + 4) / HW);
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1]; if (y < 3) continue;
    const c = cls[i]; if (classified ? !(c === C.deck || c === C.marking || c === C.railing) : c === C.building) continue;
    const x = pos[i * 3], z = pos[i * 3 + 2];
    let best = null, bd = 1e9; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const l = hash.get(`${cx + di},${cz + dj}`); if (!l) continue; for (const [ri, idx] of l) { const p = paths[ri][idx]; const d = (p.x - x) ** 2 + (p.z - z) ** 2 + (p.y - y) ** 2 * 0.15; if (d < bd) { bd = d; best = [ri, idx]; } } }
    if (!best) continue;
    const ri = best[0], p = paths[ri][best[1]], dy = y - p.y;
    if (Math.abs(dy) > 2.5) continue;
    const v = (x - p.x) * p.nx + (z - p.z) * p.nz, S = span(ri);
    const cell = Math.round(v / HW) + S; if (cell < 0 || cell >= 2 * S + 1) continue;
    const b = Math.floor(p.s / BIN); let h = hist[ri].get(b); if (!h) { h = { h: new Float32Array(2 * S + 1), y: new Float32Array(2 * S + 1), w: new Float32Array(2 * S + 1) }; hist[ri].set(b, h); }
    const isWall = classified ? c === C.railing : false;
    if (isWall) { if (dy > RAIL_H - 0.3 && dy < RAIL_H + 0.3) h.w[cell]++; continue; }
    h.h[cell]++; h.y[cell] += y;
  }
  const out = [];
  let splits = 0, calibrated = 0;
  roads.forEach((road, ri) => {
    const bins = hist[ri]; const S = span(ri);
    const runsPerBin = new Map();
    for (const [b, hh] of bins) {
      const h = hh.h;
      let mx = 0; for (const v of h) if (v > mx) mx = v;
      if (mx < 3) continue;
      // interior parapet lines: peaks of wall-top occupancy away from the outermost two
      const wall = []; { let wm = 0; for (const v of hh.w) if (v > wm) wm = v; if (wm >= 3) { let st = -1; for (let c = 0; c <= hh.w.length; c++) { const on = c < hh.w.length && hh.w[c] >= wm * 0.25; if (on && st < 0) st = c; if (!on && st >= 0) { wall.push((st + c - 1) / 2); st = -1; } } } }
      const cuts = new Set();
      if (wall.length > 2) { const first = wall[0], last = wall[wall.length - 1]; const inner = wall.slice(1, -1).filter((w) => w - first > 1.2 / HW && last - w > 1.2 / HW); for (let k = 0; k < inner.length; k++) { let j = k; while (j + 1 < inner.length && inner[j + 1] - inner[j] < 1.0 / HW) j++; cuts.add(Math.round((inner[k] + inner[j]) / 2)); k = j; } }
      const thr = mx * 0.12, runs = []; let start = -1, gap = 0;
      const flush = (end) => { if ((end - start) * HW >= 2.5) { let sy = 0, sc = 0; for (let q = start; q < end; q++) { sy += hh.y[q]; sc += h[q]; } if (sc > 0) runs.push([(start - S) * HW, (end - 1 - S) * HW, sy / sc]); } };
      for (let c = 0; c <= h.length; c++) {
        const on = c < h.length && h[c] >= thr;
        if (on && cuts.has(c) && start >= 0) { flush(c); start = c + 1; gap = 0; continue; }
        if (on) { if (start < 0) start = c; gap = 0; }
        else if (start >= 0) { gap++; if (gap >= 3 || c === h.length) { flush(c - gap); start = -1; gap = 0; } }
      }
      if (runs.length) runsPerBin.set(b, runs);
    }
    const counts = {}; for (const r of runsPerBin.values()) counts[r.length] = (counts[r.length] || 0) + 1;
    const total = runsPerBin.size;
    let k = 1, kc = 0; for (const [cnt, c] of Object.entries(counts)) if (c > kc) { kc = c; k = +cnt; }
    const path = paths[ri], nb = Math.floor(path[path.length - 1].s / BIN) + 1;
    if (k < 2 || kc < total * 0.6 || total < 3) {
      // single carriageway: calibrate width and lateral centre from the measured pavement extent
      const centre = new Array(nb).fill(null), width = new Array(nb).fill(null);
      for (const [b, runs] of runsPerBin) if (runs.length === 1) { centre[b] = (runs[0][0] + runs[0][1]) / 2; width[b] = runs[0][1] - runs[0][0] + HW; }
      const wv = width.filter((v) => v != null);
      if (wv.length >= 2) {
        const fill = (arr) => { const idx = arr.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0); return arr.map((v, i) => { if (v != null) return v; let lo = -1, hi = -1; for (const q of idx) { if (q < i) lo = q; else { hi = q; break; } } if (lo < 0) return arr[hi]; if (hi < 0) return arr[lo]; return arr[lo] + (arr[hi] - arr[lo]) * ((i - lo) / (hi - lo)); }); };
        const cF = fill(centre);
        const w = Math.round((median(wv) + RAIL_T) * 10) / 10;
        const pts = path.filter((p, i) => i % 2 === 0).map((p) => { const b = Math.min(nb - 1, Math.floor(p.s / BIN)); return [p.x + p.nx * cF[b], p.y, p.z + p.nz * cF[b]]; });
        calibrated++;
        out.push({ ...road, width: w, lanes: Math.max(1, Math.round((w - 1.5) / 3.4)), hw: w > 9 ? 'motorway' : 'motorway_link', kind: w > 9 ? 'expressway' : 'ramp', pts });
      } else out.push(road);
      return;
    }
    splits++;
    for (let j = 0; j < k; j++) {
      const centre = new Array(nb).fill(null), width = new Array(nb).fill(null), hgt = new Array(nb).fill(null);
      for (const [b, runs] of runsPerBin) if (runs.length === k) { centre[b] = (runs[j][0] + runs[j][1]) / 2; width[b] = runs[j][1] - runs[j][0] + HW; hgt[b] = runs[j][2]; }
      const fill = (arr) => { const idx = arr.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0); return arr.map((v, i) => { if (v != null) return v; let lo = -1, hi = -1; for (const q of idx) { if (q < i) lo = q; else { hi = q; break; } } if (lo < 0) return arr[hi]; if (hi < 0) return arr[lo]; return arr[lo] + (arr[hi] - arr[lo]) * ((i - lo) / (hi - lo)); }); };
      const cF = fill(centre), wF = fill(width), hF = fill(hgt);
      const pts = path.filter((p, i) => i % 2 === 0).map((p) => { const b = Math.min(nb - 1, Math.floor(p.s / BIN)); return [p.x + p.nx * cF[b], hF ? hF[b] : p.y, p.z + p.nz * cF[b]]; });
      const w = Math.round(median(wF.filter((v) => v != null)) * 10) / 10 + RAIL_T; // run = pavement extent → add the two half-walls
      out.push({ ...road, id: `${road.id}_${j}`, width: w, lanes: Math.max(1, Math.round((w - 1.5) / 3.4)), hw: w > 9 ? 'motorway' : 'motorway_link', kind: w > 9 ? 'expressway' : 'ramp', pts });
    }
  });
  log(`corridors: ${calibrated} widths calibrated from pavement extent, ${splits} divided at gaps / interior parapets → ${out.length} carriageways`);
  return out;
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
  elem.fill(UNASSIGNED); dev.fill(128);
  if (refineWidths) refineDeckWidths(cloud, elements, log);
  const stats0 = assignPass(cloud, elements, log, 0);
  if (!refineWidths) return stats0;
  refinePiers(cloud, elements, log);
  return assignPass(cloud, elements, log, 1); // re-assign against the refitted piers
}
function assignPass(cloud, elements, log, pass = 0) {
  const { n, pos, cls, elem, dev } = cloud;
  elem.fill(UNASSIGNED); dev.fill(128);
  const colSlack = pass === 0 ? 0.8 : 0.45; // first pass: raster pier centres can be decimetres off
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
      const rails0 = railByDeck.get(e.id) || [];
      const rail0 = rails0.find((rr) => Math.sign(rr.side) === Math.sign(v)) || rails0[0];
      const c00 = rail0 ? (rail0.designAbs != null ? rail0.designAbs : hw - RAIL_T / 2) : hw - RAIL_T / 2;
      if (rail0 && Math.abs(av - c00) < RAIL_T / 2 + 0.3 && dy > 0.12 && dy < RAIL_H + 1.3) {                                // parapet: lateral deviation of the nearer face
        const rail = rail0;
        {
          const c0 = c00; hit = rail;
          if (dy > RAIL_H - 0.12) dmm = 0;                                                            // wall top / fence: no lateral reference
          else dmm = (av >= c0 ? av - (c0 + RAIL_T / 2) : av - (c0 - RAIL_T / 2)) * 1000;              // nearer face
        }
      } else if (av <= hw - RAIL_T + 0.1 && dy > -0.3 && dy < 0.3) { hit = e; dmm = dy * 1000; }                          // deck surface: vertical deviation from the design profile
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
        if (col.round) { const r = col.fit ? col.fit.r : col.colW / 2; sd = Math.hypot(x - col.x, z - col.z) - r; }
        else { const u = (x - col.x) * col.tx + (z - col.z) * col.tz, v = -(x - col.x) * col.tz + (z - col.z) * col.tx; const du = Math.abs(u) - col.colL / 2, dv = Math.abs(v) - col.colW / 2; sd = Math.max(du, dv); }
        if (sd < colSlack && sd > -(colSlack + 0.15)) { hit = col; dmm = sd * 1000; break; }
      }
    }
    if (hit) { elem[i] = hit.id; const dd = Math.max(-127, Math.min(127, Math.round(dmm))); dev[i] = 128 + dd; acc(hit.id, dmm); assigned++; }
  }
  log(`assigned ${assigned.toLocaleString()} / ${n.toLocaleString()} points to ${stats.size} elements`);
  // per-element point statistics onto the elements (used by the property sheet)
  for (const [id, st] of stats) { const e = elements[id]; if (e) e.scan = { count: st.count, meanDev: st.sum / st.count, maxDev: st.maxAbs }; }
  const out = {};
  for (const [id, s] of stats) out[id] = { count: s.count, meanDev: s.sum / s.count, maxDev: s.maxAbs };
  return out;
}

/**
 * Refit each corridor to the scan. The lateral alignment is taken from the pavement edge lines
 * (区画線) rather than the parapets, so a bulging parapet shows up as a deviation instead of
 * bending the alignment. Heights come from a RANSAC plane per 10 m bin (vehicles rejected); the
 * design profile is the median of bins 3–8 away, so a locally settled span stands out.
 * Also stores per-element design offsets used by assignAndDeviate.
 */
function refineDeckWidths(cloud, elements, log) {
  const { n, pos, cls, inten } = cloud;
  const decks = elements.filter((e) => e.type === 'deck');
  const classified = cls.some((c) => c === C.marking);
  let iMax = 0; if (!classified) for (let i = 0; i < n; i++) if (inten && inten[i] > iMax) iMax = inten[i];
  const CELL = 6, hash = new Map();
  for (const e of decks) for (let i = 0; i < e.path.length; i++) { const p = e.path[i], k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push([e, i]); }
  const BIN = 10;
  const bins = new Map(); // deckId → Map(bin → {L:[], R:[], EL:[], ER:[], px:[], py:[], pz:[]})
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
    const b = Math.floor(p.s / BIN); let bb = m.get(b); if (!bb) { bb = { L: [], R: [], EL: [], ER: [], px: [], py: [], pz: [] }; m.set(b, bb); }
    const isMark = classified ? c === C.marking : inten && inten[i] > iMax * 0.7 && Math.abs(dy) < 0.12;
    if (dy > RAIL_H - 0.25 && dy < RAIL_H + 0.25 && av > 1) (v < 0 ? bb.L : bb.R).push(av);          // parapet top
    else if (isMark && Math.abs(dy) < 0.6 && av > 1.2) (v < 0 ? bb.EL : bb.ER).push(av);                 // markings (outermost = edge line)
    else if (Math.abs(dy) < 0.6 && av < hw - 0.6 && !isMark && bb.px.length < 600) { bb.px.push(x); bb.py.push(y); bb.pz.push(z); }
  }
  const fill = (arr) => { const idx = arr.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0); if (!idx.length) return null; return arr.map((v, i) => { if (v != null) return v; let lo = -1, hi = -1; for (const j of idx) { if (j < i) lo = j; else { hi = j; break; } } if (lo < 0) return arr[hi]; if (hi < 0) return arr[lo]; return arr[lo] + (arr[hi] - arr[lo]) * ((i - lo) / (hi - lo)); }); };
  const med = (a) => (a.length >= 6 ? median(a) : null);
  const edge = (a) => { if (a.length < 6) return null; const s2 = Float64Array.from(a).sort(); return s2[Math.floor(s2.length * 0.9)]; }; // outermost line
  let refined = 0, markRef = 0, markBins = 0;
  for (const e of decks) {
    const m = bins.get(e.id); if (!m) continue;
    const nb = Math.floor(e.path[e.path.length - 1].s / BIN) + 1;
    const lat = new Array(nb).fill(null), latRail = new Array(nb).fill(null), hAbs = new Array(nb).fill(null), wid = new Array(nb).fill(null), railL = new Array(nb).fill(null), railR = new Array(nb).fill(null);
    for (const [b, bb] of m) {
      const el = edge(bb.EL), er = edge(bb.ER), l = med(bb.L), r = med(bb.R);
      if (el != null && er != null) { lat[b] = (er - el) / 2; markBins++; }   // alignment from the outermost markings
      if (l != null && r != null) { latRail[b] = (r - l) / 2; wid[b] = l + r + RAIL_T; }
      railL[b] = l; railR[b] = r;
      if (bb.px.length >= 12) {
        const pl = ransacPlane(bb.px, bb.py, bb.pz, { thresh: 0.05, iters: 40 });
        if (pl && pl.count >= 8 && Math.abs(pl.n[1]) > 0.9) {
          const p = samplePath(e.path, Math.min(e.path[e.path.length - 1].s, (b + 0.5) * BIN));
          hAbs[b] = -(pl.n[0] * p.x + pl.n[2] * p.z + pl.d) / pl.n[1];   // measured pavement height at the bin centre
        }
      }
    }
    const useMark = lat.filter((v) => v != null).length >= Math.max(2, nb * 0.3);
    if (useMark) markRef++;
    const latF = fill(useMark ? lat : latRail), hF = fill(hAbs);
    if (!latF && !hF) continue;
    refined++;
    const latS = latF && latF.map((v, i) => { let s2 = 0, c = 0; for (let q = -1; q <= 1; q++) if (latF[i + q] != null) { s2 += latF[i + q]; c++; } return s2 / c; });
    // design profile: for each bin, a straight line fitted (least squares) through the measured heights of
    // bins 3–8 away on both sides; a span settled over ~40 m therefore shows as a dip against its neighbours
    let design = null;
    if (hF) {
      // robust quadratic (IRLS, Cauchy weights, 20 mm scale) through the measured heights of bins i-8…i+8:
      // a vertical curve is a parabola, so it is reproduced; a settled span (4–5 bins) is down-weighted
      design = hF.map((v, i) => {
        const qs = [], hs = [];
        for (let q = -8; q <= 8; q++) if (hF[i + q] != null) { qs.push(q); hs.push(hF[i + q]); }
        if (qs.length < 5) return v;
        let left = 0, right = 0; for (const q of qs) { if (q < 0) left++; else if (q > 0) right++; }
        const deg = qs.length >= 7 && left >= 3 && right >= 3 ? 2 : 1;
        let w = qs.map(() => 1), coef = null;
        for (let it = 0; it < 4; it++) {
          coef = polyfit(qs, hs, deg, w); if (!coef) return v;
          w = qs.map((q, k) => { const r = hs[k] - (coef[0] + coef[1] * q + (coef[2] || 0) * q * q); return 1 / (1 + (r / 0.02) ** 2); });
        }
        return coef[0];
      });
    }
    for (const p of e.path) {
      const fb = Math.min(nb - 1, Math.max(0, p.s / BIN - 0.5)), b0 = Math.floor(fb), b1 = Math.min(nb - 1, b0 + 1), t = fb - b0;
      if (latS) { const l = latS[b0] + (latS[b1] - latS[b0]) * t; p.x += p.nx * l; p.z += p.nz * l; }
      if (design) p.y = design[b0] + (design[b1] - design[b0]) * t;   // path height := design profile (linear between bin centres)
    }
    e.measuredOffset = hF && design ? hF.map((v, i) => v - design[i]) : null; // per-bin settlement (m, negative = sagged)
    e.profile = { hAbs, design, lat: latS, useMark };
    // settled spans: ≥ 2 consecutive interior bins more than 20 mm below the design profile
    e.settled = [];
    if (e.measuredOffset) {
      const mo = e.measuredOffset;
      for (let i = 1; i < nb - 1; i++) if (hAbs[i] != null && mo[i] < -0.02 && ((hAbs[i - 1] != null && mo[i - 1] < -0.02) || (hAbs[i + 1] != null && mo[i + 1] < -0.02))) e.settled.push({ bin: i, s: (i + 0.5) * BIN, mm: Math.round(mo[i] * 1000) });
    }
    const wv = wid.filter((v) => v != null);
    if (wv.length) {
      const w = Math.round(median(wv) * 100) / 100;
      const lDesign = median(railL.filter((v) => v != null)), rDesign = median(railR.filter((v) => v != null));
      for (const el of elements) if (el === e || el.parent === e.id) {
        if (el.type === 'deck') { el.width = w; el.typeName = `t=${(el.thick * 1000) | 0} W=${(w * 1000) | 0}`; }
        if (el.type === 'girder') { el.wTop = Math.max(3, w - 1.0); el.wBot = Math.max(2.5, w - 3.2); el.typeName = `W${(el.wTop * 1000) | 0}×D${(el.depth * 1000) | 0}`; }
        if (el.type === 'railing') { const d = el.side < 0 ? lDesign : rDesign; el.offset = el.side * (d != null ? d : w / 2 - RAIL_T / 2); el.designAbs = d != null ? d : w / 2 - RAIL_T / 2; }
        if (el.type === 'cap') { el.w = w + 1.4; el.typeName = `W${((w + 1.4) * 1000) | 0}×H${(el.h * 1000) | 0}`; }
      }
    }
  }
  log(`corridors refitted: ${refined} / ${decks.length} (alignment from markings on ${markRef}, ${markBins} bins; parapets otherwise); heights by per-bin RANSAC planes vs. local design trend`);
}

/** Weighted least-squares polynomial coefficients [c0, c1, c2] of the given degree through (q, h). */
function polyfit(qs, hs, deg, w) {
  const m = deg + 1, A = Array.from({ length: m }, () => new Float64Array(m)), B = new Float64Array(m);
  for (let i = 0; i < qs.length; i++) { const pw = [1, qs[i], qs[i] * qs[i]], wi = w ? w[i] : 1; for (let r = 0; r < m; r++) { B[r] += wi * pw[r] * hs[i]; for (let c = 0; c < m; c++) A[r][c] += wi * pw[r] * pw[c]; } }
  const M = A.map((row, i) => [...row, B[i]]);
  for (let c = 0; c < m; c++) { let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < m; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= m; k++) M[r][k] -= f * M[c][k]; } }
  return Array.from({ length: m }, (_, i) => M[i][m] / M[i][i]);
}

/** Pier refit: RANSAC circle on the lower and upper thirds of the shaft → position, radius, lean. */
function refinePiers(cloud, elements, log) {
  const { n, pos, elem } = cloud;
  const cols = new Map();
  for (const e of elements) if (e.type === 'column') cols.set(e.id, { e, x: [], z: [], y: [] });
  for (let i = 0; i < n; i++) { const c = cols.get(elem[i]); if (c && c.x.length < 6000) { c.x.push(pos[i * 3]); c.z.push(pos[i * 3 + 2]); c.y.push(pos[i * 3 + 1]); } }
  let fitted = 0, leaning = 0;
  for (const { e, x, z, y } of cols.values()) {
    if (x.length < 60) continue;
    const h = e.yTop - e.yBot, lo = [], hi = [];
    for (let i = 0; i < x.length; i++) { const f = (y[i] - e.yBot) / h; if (f < 0.35) lo.push(i); else if (f > 0.65) hi.push(i); }
    if (lo.length < 20 || hi.length < 20) continue;
    const circ = (idx) => ransacCircle(idx.map((i) => x[i]), idx.map((i) => z[i]), { thresh: 0.04, iters: 80, rMin: 0.4, rMax: 4 });
    const rect = (idx) => rectCentre(idx.map((i) => x[i]), idx.map((i) => z[i]), e);
    // shape decision from the data: a circle that explains ≥ 70 % of the lower third with ≤ 25 mm rms wins
    let a = circ(lo), b = a && a.count >= lo.length * 0.7 && a.rms < 0.025 ? circ(hi) : null;
    if (a && b && b.count >= hi.length * 0.6 && b.rms < 0.03) e.round = true;
    else { e.round = false; a = rect(lo); b = rect(hi); }
    if (!a || !b) continue;
    fitted++;
    const yLo = median(lo.map((i) => y[i])), yHi = median(hi.map((i) => y[i]));
    const lean = [(b.cu - a.cu) / Math.max(1, yHi - yLo) * h, (b.cv - a.cv) / Math.max(1, yHi - yLo) * h]; // offset of the top relative to the base
    const axisX = a.cu, axisZ = a.cv; // base position from the lower-third fit (no noisy extrapolation)
    e.x = axisX; e.z = axisZ;
    if (e.round) { e.colW = e.colL = Math.round(a.r * 2 * 100) / 100; e.typeName = `φ${(e.colW * 1000) | 0}`; e.family = 'RC円柱橋脚'; }
    else if (a.size) { e.colL = Math.round(a.size[0] * 100) / 100; e.colW = Math.round(a.size[1] * 100) / 100; e.typeName = `${(e.colW * 1000) | 0}×${(e.colL * 1000) | 0}`; e.family = 'RC小判形橋脚'; }
    e.fit = { r: a.r, rms: a.rms, lean, inliers: a.count + b.count };
    e.asBuilt = { dx: lean[0], dy: 0, dz: lean[1] };
    if (Math.hypot(lean[0], lean[1]) > 0.03) leaning++;
    // caps / footings follow the pier base
    for (const el of elements) if (el.parent === e.id) { el.x = axisX; el.z = axisZ; }
  }
  log(`piers refitted (RANSAC circles / face medians): ${fitted}, leaning > 30 mm at the top: ${leaning}`);
}
function rectCentre(xs, zs, e) {
  const us = [], vs = [];
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - e.x, dz = zs[i] - e.z; us.push(dx * e.tx + dz * e.tz); vs.push(-dx * e.tz + dz * e.tx); }
  // each face = the points near its nominal plane; centre = mid-point between the two opposite face medians
  const face = (arr, other, half, otherHalf, sign) => { const sel = []; for (let i = 0; i < arr.length; i++) if (Math.abs(other[i]) < otherHalf - 0.1 && Math.abs(arr[i] * sign - half) < 0.4) sel.push(arr[i]); return sel.length >= 6 ? median(sel) : null; };
  const uP = face(us, vs, e.colL / 2, e.colW / 2, 1), uM = face(us, vs, e.colL / 2, e.colW / 2, -1), vP = face(vs, us, e.colW / 2, e.colL / 2, 1), vM = face(vs, us, e.colW / 2, e.colL / 2, -1);
  if (uP == null || uM == null || vP == null || vM == null) return null;
  const cu = (uP + uM) / 2, cv = (vP + vM) / 2;
  return { cu: e.x + cu * e.tx - cv * e.tz, cv: e.z + cu * e.tz + cv * e.tx, r: 0, rms: 0, count: xs.length, size: [uP - uM, vP - vM] };
}

/** Full pipeline: cloud → { data (roads/buildings/piers), log } ready for buildStructure. */
export function scanToBim(cloud, opts = {}) {
  const lines = [];
  const log = (m) => { lines.push(m); if (opts.log) opts.log(m); };
  let t = performance.now();
  const fromPar = extractDecksFromParapets(cloud, { log }); log(`  (parapets ${((performance.now() - t) / 1000).toFixed(1)} s)`); t = performance.now();
  let roads = extractDecks(cloud, { log }); log(`  (decks ${((performance.now() - t) / 1000).toFixed(1)} s)`); t = performance.now();
  roads = splitCorridors(cloud, roads, { log }); log(`  (split ${((performance.now() - t) / 1000).toFixed(1)} s)`); t = performance.now();
  if (fromPar.length) {
    // parapet-pair decks take precedence; occupancy corridors survive only where no pair deck lies within 4 m
    const occ = new Map();
    for (const r of fromPar) for (const p of r.pts) { const k = `${Math.floor(p[0] / 6)},${Math.floor(p[2] / 6)}`; if (!occ.has(k)) occ.set(k, []); occ.get(k).push(p); }
    const near = (p) => { for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const l = occ.get(`${Math.floor(p[0] / 6) + di},${Math.floor(p[2] / 6) + dj}`); if (l && l.some((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < 4 && Math.abs(q[1] - p[1]) < 2)) return true; } return false; };
    const rest = roads.filter((r) => r.pts.filter(near).length < r.pts.length * 0.5);
    log(`combined: ${fromPar.length} parapet-pair decks + ${rest.length} occupancy corridors (${roads.length - rest.length} superseded)`);
    roads = fromPar.concat(rest);
  }
  const piers = extractPiers(cloud, roads, { log }); log(`  (piers ${((performance.now() - t) / 1000).toFixed(1)} s)`); t = performance.now();
  const buildings = extractBuildings(cloud, { log }); log(`  (buildings ${((performance.now() - t) / 1000).toFixed(1)} s)`);
  const data = { site: { layerHeight: 5.6, cropM: [0, 0], drive: {} }, roads, buildings, water: [], parks: [], rail: [], piers };
  return { data, log: lines };
}
