/* ============================================================
   MESH — a small procedural geometry builder

   There are no model files in this project, so every solid in the
   world is assembled here out of boxes, cylinders and lathes. The
   builder keeps a transform stack, welds nothing, and emits one
   interleaved buffer: position, normal, colour, then two material
   channels (roughness, dust coverage).
   ============================================================ */

import { m4, m4ident, m4mul, m4compose, qFromAxisAngle, qt } from './math.js';

export const STRIDE = 11;   // floats per vertex

export class MeshBuilder {
  constructor() {
    this.v = [];
    this.i = [];
    this.stack = [m4ident(m4())];
    this.color = [0.7, 0.7, 0.72];
    this.rough = 0.6;
    this.dust = 0.3;
  }

  get xf() { return this.stack[this.stack.length - 1]; }

  push(mat) {
    const top = m4();
    m4mul(top, this.xf, mat);
    this.stack.push(top);
    return this;
  }
  pop() { this.stack.pop(); return this; }

  translate(x, y, z) {
    const m = m4ident(m4());
    m[12] = x; m[13] = y; m[14] = z;
    return this.push(m);
  }
  rotate(ax, ay, az, ang) {
    const q = qFromAxisAngle(qt(), ax, ay, az, ang);
    return this.push(m4compose(m4(), [0, 0, 0], q));
  }
  scale(sx, sy = sx, sz = sx) {
    const m = m4ident(m4());
    m[0] = sx; m[5] = sy; m[10] = sz;
    return this.push(m);
  }

  mat(color, rough = this.rough, dust = this.dust) {
    this.color = color; this.rough = rough; this.dust = dust;
    return this;
  }

  _vert(px, py, pz, nx, ny, nz) {
    const m = this.xf;
    const x = m[0] * px + m[4] * py + m[8] * pz + m[12];
    const y = m[1] * px + m[5] * py + m[9] * pz + m[13];
    const z = m[2] * px + m[6] * py + m[10] * pz + m[14];
    // Non-uniform scale is only ever used on boxes here, so the plain
    // rotation is a good enough normal transform once renormalised.
    let ax = m[0] * nx + m[4] * ny + m[8] * nz;
    let ay = m[1] * nx + m[5] * ny + m[9] * nz;
    let az = m[2] * nx + m[6] * ny + m[10] * nz;
    const l = Math.hypot(ax, ay, az) || 1;
    ax /= l; ay /= l; az /= l;
    const c = this.color;
    this.v.push(x, y, z, ax, ay, az, c[0], c[1], c[2], this.rough, this.dust);
    return (this.v.length / STRIDE) - 1;
  }

  tri(a, b, c) { this.i.push(a, b, c); return this; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); return this; }

  /* ---------- primitives ---------- */

  box(w, h, d, cx = 0, cy = 0, cz = 0) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const face = (nx, ny, nz, p0, p1, p2, p3) => {
      const a = this._vert(p0[0], p0[1], p0[2], nx, ny, nz);
      const b = this._vert(p1[0], p1[1], p1[2], nx, ny, nz);
      const c = this._vert(p2[0], p2[1], p2[2], nx, ny, nz);
      const d2 = this._vert(p3[0], p3[1], p3[2], nx, ny, nz);
      this.quad(a, b, c, d2);
    };
    face(0, 0, 1, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    face(0, 0, -1, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    face(1, 0, 0, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    face(-1, 0, 0, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    face(0, 1, 0, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    face(0, -1, 0, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    return this;
  }

  /* Cylinder along +Y, centred on the origin. */
  cylinder(r, h, seg = 20, caps = true, rTop = r) {
    const y0 = -h / 2, y1 = h / 2;
    const ring0 = [], ring1 = [];
    const slope = (r - rTop) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const ny = slope / Math.hypot(1, slope);
      const nr = 1 / Math.hypot(1, slope);
      ring0.push(this._vert(c * r, y0, s * r, c * nr, ny, s * nr));
      ring1.push(this._vert(c * rTop, y1, s * rTop, c * nr, ny, s * nr));
    }
    for (let i = 0; i < seg; i++) this.quad(ring0[i], ring0[i + 1], ring1[i + 1], ring1[i]);
    if (caps) {
      const cb = this._vert(0, y0, 0, 0, -1, 0);
      const ct = this._vert(0, y1, 0, 0, 1, 0);
      const b = [], t = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        b.push(this._vert(c * r, y0, s * r, 0, -1, 0));
        t.push(this._vert(c * rTop, y1, s * rTop, 0, 1, 0));
      }
      for (let i = 0; i < seg; i++) {
        this.tri(cb, b[i + 1], b[i]);
        this.tri(ct, t[i], t[i + 1]);
      }
    }
    return this;
  }

  /* UV sphere, optionally squashed — the base shape every boulder
     starts from before the noise gets at it. */
  sphere(r, seg = 16, rings = 10, deform = null) {
    const grid = [];
    for (let j = 0; j <= rings; j++) {
      const v = j / rings, phi = v * Math.PI;
      const row = [];
      for (let i = 0; i <= seg; i++) {
        const u = i / seg, th = u * Math.PI * 2;
        let nx = Math.sin(phi) * Math.cos(th);
        let ny = Math.cos(phi);
        let nz = Math.sin(phi) * Math.sin(th);
        let rr = r;
        if (deform) rr = r * deform(nx, ny, nz);
        row.push(this._vert(nx * rr, ny * rr, nz * rr, nx, ny, nz));
      }
      grid.push(row);
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        this.quad(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]);
      }
    }
    return this;
  }

  /* A tube between two points — struts, suspension arms, cables. */
  strut(a, b, r, seg = 8) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1e-4;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // Any perpendicular will do for the tube's reference frame.
    let px = 0, py = 1, pz = 0;
    if (Math.abs(uy) > 0.9) { px = 1; py = 0; }
    let tx = uy * pz - uz * py, ty = uz * px - ux * pz, tz = ux * py - uy * px;
    let l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    const bx = uy * tz - uz * ty, by = uz * tx - ux * tz, bz = ux * ty - uy * tx;
    const r0 = [], r1 = [];
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2;
      const c = Math.cos(ang), s = Math.sin(ang);
      const nx = tx * c + bx * s, ny = ty * c + by * s, nz = tz * c + bz * s;
      r0.push(this._vert(a[0] + nx * r, a[1] + ny * r, a[2] + nz * r, nx, ny, nz));
      r1.push(this._vert(b[0] + nx * r, b[1] + ny * r, b[2] + nz * r, nx, ny, nz));
    }
    for (let i = 0; i < seg; i++) this.quad(r0[i], r0[i + 1], r1[i + 1], r1[i]);
    return this;
  }

  build() {
    return {
      vertices: new Float32Array(this.v),
      indices: (this.v.length / STRIDE) > 65535
        ? new Uint32Array(this.i) : new Uint16Array(this.i),
      count: this.i.length
    };
  }
}
