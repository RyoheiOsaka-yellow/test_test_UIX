import { fit, TAU, hex, Grid, lnoise, ease } from "../../core/index.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Chambered nautilus",
  ja: "オウムガイ",
  sci: "Nautilus pompilius",
  region: "Western Pacific, 100–500 m (Philippines, Palau, Fiji)",
  length: "20 cm",
  desc: "A living fossil with a coiled, flame-striped shell divided into gas-filled chambers that keep it afloat. By day it hangs deep on the reef slope; by night it rises, jetting backward and feeling with ninety tentacles for shrimp and carrion.",
  jadesc: "炎のような縞のらせん殻をもつ生きた化石。殻の中はガスの詰まった小部屋に分かれ、浮力を調節する。昼は深い斜面にひそみ、夜は浮上して、水を噴いて後ろ向きに泳ぎながら90本の触手でエビや死骸を探す。",
  tags: ["shell", "cephalopod", "nautilus", "deep", "fossil", "swim", "loop"],
  size: [76, 56],
  origin: [36, 28],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a4a40", "#a89a88", "#e0d8c8", "#f8f4ec", "#ffffff"],
    flame: ["#4a1810", "#8a3018", "#c05028", "#e08050", "#f0b088"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -28, 76, 54);
const HOOD = ["#2a1810", "#5a3828", "#8a5a48", "#b08070", "#d0a890"], TEN = ["#5a3828", "#9a6a58", "#c89888", "#e8c0b0", "#fff0e8"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), F = fit(o.flame, 5), g = G.clear();
  const ph = (t / D) * TAU, u = t / D;
  // jets: a pulse every half loop pushes it back (left) and it drifts forward again
  const pulse = (u * 2) % 1, jet = pulse < 0.2 ? ease.outCubic(pulse / 0.2) : 1 - ease.inOutSine((pulse - 0.2) / 0.8);
  const R = 15, cx = 0, cy = -4;
  // the shell: a spiral disc; flame stripes radiate from the coil over the back, the belly cream
  g.ellipse(cx, cy, R, R * 0.92, (nx, ny) => {
    const ang = Math.atan2(ny, nx), d = Math.hypot(nx, ny);
    // the inner coil
    const ix = nx + 0.25, iy = ny - 0.1, id = Math.hypot(ix, iy);
    if (id < 0.32) return d < 0.1 ? C[1] : (Math.round((Math.atan2(iy, ix) + Math.PI) * 2.2) % 2 ? C[2] : C[3]);
    // stripes on the upper and outer half, bending with the spiral
    const stripe = Math.round((ang + Math.PI) * 3.2 + d * 2.5) % 2 === 0;
    if (ny < 0.35 && stripe && d > 0.35) return d > 0.85 ? F[2] : F[3];
    if (d > 0.9) return C[1];
    return ny > 0.4 ? C[3] : C[2];
  }, 1, 1);
  // the coil line: the spiral groove
  for (let a = 0; a < Math.PI * 3.2; a += 0.08) {
    const r = R * 0.32 * Math.exp(a * 0.105) * 0.62;
    if (r > R * 0.95) break;
    g.set(cx - 3.5 + Math.cos(a) * r, cy - 1.5 + Math.sin(a) * r * 0.92, C[0]);
  }
  // the hood: a dark leathery cap over the opening at the front-right, and the big eye
  const ox = cx + R * 0.72, oy = cy + 2;
  g.ellipse(ox + 1, oy - 5, 6, 5, (nx, ny) => (ny < -0.3 ? HOOD[3] : nx > 0.2 ? HOOD[2] : HOOD[1]), 1, 1);
  g.set(ox + 4, oy - 2, hex("#0a0810")); g.set(ox + 5, oy - 2, hex("#0a0810")); g.set(ox + 4, oy - 1, hex("#0a0810")); g.set(ox + 5, oy - 3, C[4]);
  // ninety tentacles, drawn as a bunch of a dozen, reaching forward and feeling about
  for (let i = 0; i < 12; i++) {
    const k = i / 11, base = [ox + 3 + k * 2, oy + 1 + k * 5], sw = lnoise(t, D, 2, i * 0.3, o.seed) * 2;
    const L = 7 + 4 * Math.sin(i * 1.7) + 3 * jet, ang = -0.3 + k * 0.9 + sw * 0.15;
    const ex = base[0] + Math.cos(ang) * L, ey = base[1] + Math.sin(ang) * L;
    g.line(base[0], base[1], ex, ey, (uu) => (uu > 0.7 ? TEN[3] : TEN[2]), 1, 7);
  }
  // the funnel below the hood, puffing water as it jets
  g.tube([[ox - 2, oy + 8], [ox + 2 - 4 * jet, oy + 10]], 1.3, (uu, d) => (d > 0.7 ? HOOD[1] : HOOD[3]), 1, 7);
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  const dx = -6 * jet + Math.sin(ph) * 1.5, dy = Math.sin(ph * 2) * 1.5 + 2;
  g.draw(p, 1, dx, dy);
  // the jet's wake and marine snow
  for (let i = 0; i < 5; i++) p.dot(ox - 4 + dx + i * 2 + jet * 6, oy + 11 + dy + (i % 2), hex("#a8d0e0"), 0.4 * jet * (1 - i / 5));
  if (o.scene !== false) for (let i = 0; i < 12; i++) p.dot(-36 + ((i * 41) % 76), -28 + (((i * 0.37 + u) % 1) * 56), hex("#a8d0e0"), 0.3);
  bubbles(p, t, D, 2, o.seed * 7 + 44, ox + dx - 4, oy + dy + 8, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -28);
  p.glow(cx + dx, cy + dy, 24, hex("#e08050"), 0.06);
}
