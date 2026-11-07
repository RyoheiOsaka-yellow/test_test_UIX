import { fit, TAU, hex, Grid, lnoise } from "../../core/index.js";
import { drawBivalve } from "./_body.js";
import { shift, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Pacific geoduck",
  ja: "アメリカナミガイ",
  sci: "Panopea generosa",
  region: "Pacific coast of North America (Alaska to Baja California)",
  length: "20 cm shell, siphon to 1 m",
  desc: "The biggest burrowing clam on Earth and one of the longest-lived animals, up to 170 years. The shell can't close around its siphon, a wrinkled neck as long as an arm that reaches up a metre of sand to the water.",
  jadesc: "世界最大の潜砂性二枚貝で、170年も生きる長寿の動物。殻に収まりきらないしわだらけの水管は腕ほどの長さで、1 mの砂を貫いて海水に届く。",
  tags: ["shell", "bivalve", "clam", "siphon", "sand", "america", "loop"],
  size: [60, 56],
  origin: [28, 34],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a4038", "#8a7a68", "#b8aa98", "#d8d0c0", "#f4f0e8"],
    neck: ["#5a4838", "#9a8068", "#c8b098", "#e8d8c0", "#fff4e8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -34, 60, 54);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), N = fit(o.neck, 5), g = G.clear();
  const ph = (t / D) * TAU, reach = 0.75 + 0.25 * Math.sin(ph);
  drawBivalve(g, {
    L: 16, bulge: 6, gape: 0.5, tilt: -1.2, ribs: 0, lines: 5, skin: () => C,
    mantle: N,
    extra: (g, t, S) => {
      // the siphon: a thick wrinkled neck out of the gape, swaying, two openings at the top
      const [lx, ly] = S.lip("top")(0.8), [bx, by] = S.lip("bottom")(0.8);
      const x0 = (lx + bx) / 2, y0 = (ly + by) / 2, L = 30 * reach;
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6, sw = lnoise(t, D, 1, u, o.seed) * 3 * u;
        pts.push([x0 + 4 * u + sw, y0 - L * u]);
      }
      g.tube(pts, (u) => 3.6 - 0.8 * u, (u, d) => (Math.round(u * 14) % 2 === 0 ? (d > 0.75 ? N[1] : N[2]) : d > 0.75 ? N[2] : N[3]), 1, 7);
      const [ex, ey] = pts[6];
      g.ellipse(ex, ey - 1, 3, 1.6, (nx, ny) => (Math.abs(nx) > 0.35 && Math.hypot(nx * 1.5, ny) < 0.95 ? N[0] : N[3]), 1, 7);
    },
    outline: "#2a2420", lit: "#8a7a68",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -28, 30, 8, 14, o.seed);
  g.draw(p, 1, -4, 16);
  if (o.scene !== false) sandFloor(p, -28, 30, 12, 10, o.seed + 1);
  bubbles(p, t, D, 2, o.seed * 7 + 38, 2, -12 - 10 * reach, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 10, -32);
  if (o.scene !== false) caustics(p, t, D, -30, -34, 30, 18, hex("#e6cc96"), 0.1);
}
