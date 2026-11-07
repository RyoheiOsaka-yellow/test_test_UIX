import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Pacific viperfish",
  ja: "ホウライエソ",
  sci: "Chauliodus macouni",
  region: "North Pacific, 200–1500 m; Japan",
  length: "30 cm",
  desc: "Fangs too long for its mouth, a hinged skull that swings open to swallow fish half its size, and a long first dorsal ray it dangles over its head as a lure. Rows of photophores light its belly. It rises hundreds of metres every night to hunt.",
  jadesc: "口に収まらないほど長い牙と、自分の半分ほどの魚を呑むために開く蝶番の頭骨、頭の上に垂らす長い背びれの棘のルアー。腹には発光器が列をなす。毎晩数百 m浮上して狩りをする。",
  tags: ["deepsea", "fangs", "glow", "pacific", "japan", "loop"],
  size: [96,44],
  origin: [48,22],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0e1420", "#1c2a40", "#2e4460", "#466080", "#6a84a0"],
    glow: ["#1040a0", "#3080e0", "#60c0ff", "#b0f0ff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -22, 96, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const GL = fit(o.glow, 5), k = 0.6 + 0.4 * Math.sin(ph * 2);
  let pts = [];
  drawFish(g, {
    L: 70, H: 6, peak: 0.25, nose: 0.6, stock: 0.15,
    skin: (u, v, x, y) => (((Math.round(x) + Math.round(y)) % 3 === 0) ? ["#1c2a40", "#2e4460", "#3e5878", "#5a7898", "#80a0c0"] : C),
    tail: { kind: "fork", span: 7, len: 7 },
    dorsal: [{ u: 0.3, h: 5, w: 5, kind: "tri" }],
    pectoral: { u: 0.25, len: 6, w: 2.5, angle: 0.4, v: 0.4, flap: 0.3 },
    anal: { u: 0.85, h: 3, w: 5 },
    eye: { u: 0.08, v: -0.2, r: 1.4, ring: "#466080" },
    mouth: { len: 10, open: 0.6, v: 0.1, drop: 2 }, mouthCol: "#1a0810",
    swim: { kind: "fish", amp: 1 },
    finSkin: () => C,
    extra: (g, t, S) => {
      const x0 = S.xOf(0), y0 = S.wave(0);
      for (const [dx, dy, L] of [[-1, -1, 7], [-3, -0.5, 5], [-1, 4, 6], [-3.5, 4, 4]]) g.line(x0 + dx, y0 + dy, x0 + dx - 0.5, y0 + dy + (dy < 2 ? L : -L), hex("#ffffff"));
      const rx = S.xOf(0.3), ry = S.wave(0.3) - S.H * S.back(0.3), sw = lnoise(t, D, 2, 0.5, o.seed) * 2;
      g.line(rx, ry, rx + 10 + sw, ry - 14, C[3], 1, 7); g.line(rx + 10 + sw, ry - 14, rx + 22 + sw, ry - 10, C[3], 1, 7); g.set(rx + 22 + sw, ry - 10, GL[4], 1, 7);
      pts = []; for (let i = 0; i < 10; i++) { const u = 0.15 + i * 0.075; pts.push([S.xOf(u), S.wave(u) + S.H * S.belly(u) - 0.5]); }
    },
    outline: "#060a12", lit: "#2e4460",
  }, t, D, o.seed);
  const dx = Math.sin(ph) * 2, dy = Math.sin(ph * 0.5) * 1;
  g.draw(p, 1, dx, dy);
  photophores(p, pts.map(([x, y]) => [x + dx, y + dy]), GL[2], 0.25 * k, 3);
  if (o.scene !== false) snow(p, t, D, 96, 44);
}
