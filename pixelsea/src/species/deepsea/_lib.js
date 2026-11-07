// Deep-sea extras: marine snow, rows of photophores that glow, and a lure on a stalk.
import { TAU, hex, lnoise } from "../../core/index.js";

/** Marine snow drifting down through a w x h frame centred on the origin. */
export function snow(p, t, D, w, h, n = 14, a = 0.3) {
  for (let i = 0; i < n; i++) p.dot(-w / 2 + ((i * 37) % w), -h / 2 + (((i * 0.31 + t / D) % 1) * h), hex("#a8d0e0"), a);
}

/** A row of photophores along points [[x, y], ...] (already in frame space), glowing col with strength k. */
export function photophores(p, pts, col, k = 0.3, r = 3) {
  for (const [x, y] of pts) { p.dot(x, y, hex("#e8ffff"), 0.9); p.glow(x, y, r, col, k); }
}

/** A lure: a stalk from (x, y) arching forward to a bulb that glows; sway loops over D. Returns the bulb's position. */
export function lure(g, x, y, len, t, D, cols, seed = 1, lean = 1) {
  const sw = lnoise(t, D, 2, 0.7, seed) * 2;
  const pts = [[x, y], [x + len * 0.3 * lean, y - len * 0.7], [x + len * 0.8 * lean + sw, y - len * 0.75], [x + len * lean + sw, y - len * 0.45]];
  g.tube(pts, 0.7, (u, d) => cols[1], 1, 7);
  const [bx, by] = pts[3];
  g.ellipse(bx, by, 1.8, 1.8, (nx, ny) => (nx + ny < -0.5 ? cols[4] : cols[3]), 1, 7);
  return [bx, by];
}
