// Builds the BIM overlay (merged face mesh + edge lines) from the structural model.
import * as THREE from 'three';
import { CATEGORY, DECK_T } from './structure.js';

class Builder {
  constructor() { this.pos = []; this.col = []; this.seq = []; this.elem = []; this.epos = []; this.ecol = []; this.eseq = []; this.eelem = []; this.ranges = []; }
  begin(e) { this.cur = e; this.triStart = this.pos.length / 9; const c = new THREE.Color(CATEGORY[e.type].color); this.c = [c.r, c.g, c.b]; }
  end() { const n = this.pos.length / 9; if (n > this.triStart) this.ranges.push({ start: this.triStart, end: n, id: this.cur.id }); }
  tri(a, b, c) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) { this.col.push(this.c[0], this.c[1], this.c[2]); this.seq.push(this.cur.seq); this.elem.push(this.cur.id); }
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  edge(a, b) {
    this.epos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    for (let i = 0; i < 2; i++) { this.ecol.push(this.c[0], this.c[1], this.c[2]); this.eseq.push(this.cur.seq); this.eelem.push(this.cur.id); }
  }
  /** Sweep a closed convex 2D section [[v,y],...] along a framed path (v along normal, y up). */
  sweep(path, section, step = 1) {
    const rings = [];
    for (let k = 0; k < path.length; k += step) {
      const p = path[k];
      rings.push(section.map(([v, y]) => [p.x + p.nx * v, p.y + y, p.z + p.nz * v]));
    }
    if (path.length % step !== 1) { const p = path[path.length - 1]; rings.push(section.map(([v, y]) => [p.x + p.nx * v, p.y + y, p.z + p.nz * v])); }
    const m = section.length;
    for (let k = 1; k < rings.length; k++) {
      const A = rings[k - 1], B = rings[k];
      for (let j = 0; j < m; j++) {
        const j2 = (j + 1) % m;
        this.quad(A[j], A[j2], B[j2], B[j]);
        this.edge(A[j], B[j]);
      }
    }
    for (const R of [rings[0], rings[rings.length - 1]]) {
      for (let j = 1; j < m - 1; j++) this.tri(R[0], R[j], R[j + 1]);
      for (let j = 0; j < m; j++) this.edge(R[j], R[(j + 1) % m]);
    }
  }
  box(cx, yBot, cz, tx, tz, l, w, h) {
    const nx = -tz, nz = tx;
    const c = (u, v, y) => [cx + tx * u + nx * v, y, cz + tz * u + nz * v];
    const y0 = yBot, y1 = yBot + h, hl = l / 2, hw = w / 2;
    const v = [c(-hl, -hw, y0), c(hl, -hw, y0), c(hl, hw, y0), c(-hl, hw, y0), c(-hl, -hw, y1), c(hl, -hw, y1), c(hl, hw, y1), c(-hl, hw, y1)];
    this.quad(v[0], v[1], v[2], v[3]); this.quad(v[4], v[7], v[6], v[5]);
    this.quad(v[0], v[4], v[5], v[1]); this.quad(v[1], v[5], v[6], v[2]); this.quad(v[2], v[6], v[7], v[3]); this.quad(v[3], v[7], v[4], v[0]);
    for (let i = 0; i < 4; i++) { this.edge(v[i], v[(i + 1) % 4]); this.edge(v[4 + i], v[4 + ((i + 1) % 4)]); this.edge(v[i], v[4 + i]); }
  }
  cylinder(cx, yBot, cz, r, h, segs = 16) {
    const ring = (y) => Array.from({ length: segs }, (_, i) => [cx + Math.cos((i / segs) * Math.PI * 2) * r, y, cz + Math.sin((i / segs) * Math.PI * 2) * r]);
    const A = ring(yBot), B = ring(yBot + h);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      this.quad(A[i], A[j], B[j], B[i]);
      this.edge(A[i], A[j]); this.edge(B[i], B[j]);
      if (i % 4 === 0) this.edge(A[i], B[i]);
    }
    for (let i = 1; i < segs - 1; i++) { this.tri(A[0], A[i + 1], A[i]); this.tri(B[0], B[i], B[i + 1]); }
  }
  prism(poly, h, levels) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      this.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]);
      this.edge([a[0], 0, a[1]], [a[0], h, a[1]]);
      this.edge([a[0], h, a[1]], [b[0], h, b[1]]);
      this.edge([a[0], 0, a[1]], [b[0], 0, b[1]]);
      const fl = h / levels;
      for (let l = 1; l < levels; l++) this.edge([a[0], l * fl, a[1]], [b[0], l * fl, b[1]]);
    }
    try {
      const pts = poly.map(([x, z]) => new THREE.Vector2(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      for (const [a, b, c] of tris) this.tri([poly[a][0], h, poly[a][1]], [poly[b][0], h, poly[b][1]], [poly[c][0], h, poly[c][1]]);
    } catch (err) { /* degenerate footprint: walls only */ }
  }
}

export function buildBIM(elements, { includeBuildings = true } = {}) {
  const b = new Builder();
  for (const e of elements) {
    if (e.type === 'building' && !includeBuildings) continue;
    b.begin(e);
    switch (e.type) {
      case 'deck': { const hw = e.width / 2; b.sweep(e.path, [[-hw, -e.thick], [hw, -e.thick], [hw, 0], [-hw, 0]], 2); break; }
      case 'girder': b.sweep(e.path, [[-e.wBot / 2, -DECK_T - e.depth], [e.wBot / 2, -DECK_T - e.depth], [e.wTop / 2, -DECK_T], [-e.wTop / 2, -DECK_T]], 2); break;
      case 'railing': { const o = e.offset, t = e.t / 2; b.sweep(e.path, [[o - t, 0], [o + t, 0], [o + t, e.h], [o - t, e.h]], 2); break; }
      case 'column': if (e.round) b.cylinder(e.x, e.yBot, e.z, e.colW / 2, e.yTop - e.yBot); else b.box(e.x, e.yBot, e.z, e.tx, e.tz, e.colL, e.colW, e.yTop - e.yBot); break;
      case 'cap': b.box(e.x, e.yBot, e.z, e.tx, e.tz, e.l, e.w, e.h); break;
      case 'footing': b.box(e.x, e.yBot, e.z, e.tx, e.tz, e.l, e.w, e.h); break;
      case 'pole': b.box(e.x, e.y, e.z, e.tx, e.tz, 0.3, 0.3, e.h); b.box(e.x - e.nx * 1.2, e.y + e.h - 0.3, e.z - e.nz * 1.2, e.nx, e.nz, 2.4, 0.2, 0.2); break;
      case 'gantry': {
        for (const s of [-1, 1]) b.box(e.x + e.nx * s * e.w / 2, e.y, e.z + e.nz * s * e.w / 2, e.tx, e.tz, 0.45, 0.45, e.h);
        b.box(e.x, e.y + e.h - 1.3, e.z, e.nx, e.nz, e.w, 0.8, 0.9);
        b.box(e.x - e.tx * 0.3, e.y + e.h - 2.2, e.z - e.tz * 0.3, e.nx, e.nz, 3.6, 0.12, 2.2);
        break;
      }
      case 'building': b.prism(e.footprint, e.h, e.levels); break;
    }
    b.end();
  }
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  faceGeo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  faceGeo.setAttribute('aSeq', new THREE.Float32BufferAttribute(b.seq, 1));
  faceGeo.setAttribute('aElem', new THREE.Float32BufferAttribute(b.elem, 1));
  faceGeo.computeBoundingSphere();
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(b.epos, 3));
  edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(b.ecol, 3));
  edgeGeo.setAttribute('aSeq', new THREE.Float32BufferAttribute(b.eseq, 1));
  edgeGeo.setAttribute('aElem', new THREE.Float32BufferAttribute(b.eelem, 1));
  edgeGeo.computeBoundingSphere();
  return { faceGeo, edgeGeo, ranges: b.ranges, triangles: b.pos.length / 9, segments: b.epos.length / 6 };
}

export function elementAtFace(ranges, faceIndex) {
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, r = ranges[mid];
    if (faceIndex < r.start) hi = mid - 1; else if (faceIndex >= r.end) lo = mid + 1; else return r.id;
  }
  return -1;
}
