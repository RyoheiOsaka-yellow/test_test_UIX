// A creature-sized canvas in local coordinates. A creature is built in a small offscreen grid from shaded
// parts, given a 1 px outline (picked per side, so it can be darker in shadow and break into a highlight),
// then put on the painter, opaque or translucent. Adapted from pixelfx's critter kit (MIT, Patch).

import { hex } from "./color.js";

export class Grid {
  constructor(x0, y0, w, h) {
    this.x0 = Math.floor(x0); this.y0 = Math.floor(y0); this.w = w; this.h = h;
    this.c = new Uint32Array(w * h);
    this.a = new Float32Array(w * h);
    this.tag = new Uint8Array(w * h);
    this.o = { a: 1, t: 0 };
  }
  idx(x, y) {
    const ix = Math.floor(x) - this.x0, iy = Math.floor(y) - this.y0;
    return ix < 0 || iy < 0 || ix >= this.w || iy >= this.h ? -1 : iy * this.w + ix;
  }
  /** Paint a cell: color c, alpha a (below 1 is drawn translucent), tag (any 0..255 label for later passes). */
  set(x, y, c, a = 1, tag = 0) {
    const i = this.idx(x, y);
    if (i >= 0 && c) (this.c[i] = c), (this.a[i] = a), (this.tag[i] = tag);
  }
  /** Paint a cell only if it is empty (so later parts go behind earlier ones). */
  under(x, y, c, a = 1, tag = 0) {
    const i = this.idx(x, y);
    if (i >= 0 && c && !this.c[i]) (this.c[i] = c), (this.a[i] = a), (this.tag[i] = tag);
  }
  get(x, y) {
    const i = this.idx(x, y);
    return i < 0 ? 0 : this.c[i];
  }
  tagAt(x, y) {
    const i = this.idx(x, y);
    return i < 0 ? 0 : this.tag[i];
  }
  erase(x, y) {
    const i = this.idx(x, y);
    if (i >= 0) this.c[i] = 0;
  }
  /** fn(x, y, out) at each cell center in the box returns a color (or 0 to leave it); it may set out.a and out.t. */
  shade(x0, y0, x1, y1, fn, under = false) {
    const o = this.o;
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++)
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
        o.a = 1; o.t = 0;
        const c = fn(x + 0.5, y + 0.5, o);
        if (c) under ? this.under(x, y, c, o.a, o.t) : this.set(x, y, c, o.a, o.t);
      }
  }
  /** Filled ellipse; c may be fn(nx, ny) of the normalized offset (-1..1). */
  ellipse(cx, cy, rx, ry, c, a = 1, tag = 0) {
    if (rx <= 0 || ry <= 0) return;
    this.shade(cx - rx, cy - ry, cx + rx, cy + ry, (x, y, o) => {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) return 0;
      o.a = a; o.t = tag;
      return typeof c === "function" ? c(nx, ny) : c;
    });
  }
  /** 1 px line; c may be fn(u). */
  line(x0, y0, x1, y1, c, a = 1, tag = 0) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, typeof c === "function" ? c(i / n) : c, a, tag);
  }
  /** A line of discs along pts, r may be fn(u): tails, tentacles, legs. c may be fn(u, v) with v 0 center .. 1 edge. */
  tube(pts, r, c, a = 1, tag = 0) {
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L = Math.max(1, Math.hypot(bx - ax, by - ay));
      for (let s = 0; s <= L; s += 0.5) {
        const u = (k - 1 + s / L) / (pts.length - 1), rr = typeof r === "function" ? r(u) : r;
        const x = ax + ((bx - ax) * s) / L, y = ay + ((by - ay) * s) / L;
        if (rr < 0.75) {
          this.set(x, y, typeof c === "function" ? c(u, 0) : c, a, tag);
          continue;
        }
        this.shade(x - rr, y - rr, x + rr, y + rr, (px, py, o) => {
          const d = Math.hypot(px - x, py - y) / rr;
          o.a = a; o.t = tag;
          return d > 1 ? 0 : typeof c === "function" ? c(u, d) : c;
        });
      }
    }
  }
  /** Filled polygon (even-odd); c may be fn(x, y). */
  poly(pts, c, a = 1, tag = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    const n = pts.length;
    this.shade(x0, y0, x1, y1, (x, y, o) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      o.a = a; o.t = tag;
      return inside ? (typeof c === "function" ? c(x, y) : c) : 0;
    });
  }
  /** A sprite from strings, its top-left at (X, Y). */
  sprite(rows, pal, X, Y, { flip = false } = {}) {
    const W = rows[0].length, cache = {};
    const col = (ch) => (ch in cache ? cache[ch] : (cache[ch] = pal[ch] === undefined ? 0 : hex(pal[ch])));
    for (let r = 0; r < rows.length; r++)
      for (let q = 0; q < W; q++) {
        const ch = rows[r][flip ? W - 1 - q : q];
        if (ch === "." || ch === " ") continue;
        const c = col(ch);
        if (c) this.set(Math.round(X) + q, Math.round(Y) + r, c);
      }
  }
  /**
   * How deep each filled cell sits: 1 on the edge (next to an empty cell), 2 one in, ... up to max.
   * Returns a Uint8Array over the grid; depth(x, y) reads it.
   */
  depths(max = 4) {
    const { w, h, c } = this, d = new Uint8Array(w * h), q = [];
    for (let i = 0; i < w * h; i++) {
      if (!c[i]) continue;
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !c[i - 1] || !c[i + 1] || !c[i - w] || !c[i + w]) (d[i] = 1), q.push(i);
    }
    for (let k = 0; k < q.length; k++) {
      const i = q[k], v = d[i];
      if (v >= max) continue;
      for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < w * h && c[j] && !d[j]) (d[j] = v + 1), q.push(j);
    }
    for (let i = 0; i < w * h; i++) if (c[i] && !d[i]) d[i] = max;
    this.d = d;
    return d;
  }
  depth(x, y) {
    const i = this.idx(x, y);
    return i < 0 || !this.d ? 0 : this.d[i];
  }
  /**
   * Wrap everything drawn so far in a 1 px outline (4-neighbour). c is a color, or fn(x, y, nx, ny) with
   * (nx, ny) the outward direction there, so the outline can be picked per side. Return 0 to leave a gap.
   */
  outline(c, a = 1) {
    const src = this.c.slice(), w = this.w, h = this.h, fn = typeof c === "function";
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i]) continue;
        const l = x > 0 && src[i - 1], r = x < w - 1 && src[i + 1], u = y > 0 && src[i - w], d = y < h - 1 && src[i + w];
        if (!(l || r || u || d)) continue;
        const col = fn ? c(this.x0 + x, this.y0 + y, (l ? 1 : 0) - (r ? 1 : 0), (u ? 1 : 0) - (d ? 1 : 0)) : c;
        if (col) (this.c[i] = col), (this.a[i] = a), (this.tag[i] = 255);
      }
  }
  /** Rework every filled cell: fn(x, y, color, alpha, tag) returns its new color (0 erases it). */
  recolor(fn) {
    for (let i = 0; i < this.w * this.h; i++) {
      if (!this.c[i]) continue;
      this.c[i] = fn(this.x0 + (i % this.w), this.y0 + ((i / this.w) | 0), this.c[i], this.a[i], this.tag[i]) || 0;
    }
  }
  /** Put the grid on the painter, moved by (dx, dy): opaque cells dithered by fade, translucent ones blended. */
  draw(p, fade = 1, dx = 0, dy = 0) {
    const X = this.x0 + Math.round(dx), Y = this.y0 + Math.round(dy);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x, c = this.c[i];
        if (!c) continue;
        const a = this.a[i];
        if (a >= 0.999) p.dot(X + x, Y + y, c, fade);
        else p.blend(X + x, Y + y, c, a * fade);
      }
  }
  clear() {
    this.c.fill(0);
    this.a.fill(0);
    this.tag.fill(0);
    this.d = null;
    return this;
  }
}
