import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Narwhal",
  ja: "イッカク",
  sci: "Monodon monoceros",
  region: "Arctic Ocean: Canada, Greenland, Svalbard",
  length: "5 m (tusk to 3 m)",
  desc: "The unicorn of the sea: a mottled grey Arctic whale with no dorsal fin and, in males, a single spiral tusk up to three metres long. It is a tooth, grown out through the lip, packed with nerves that taste the water.",
  jadesc: "海のユニコーン。背びれのない灰色まだらの北極のクジラで、雄は最長3 mのらせん状の一本角をもつ。角の正体は唇を突き破って伸びた歯で、神経が通って海水の変化を感じ取る。",
  tags: ["whale", "cetacean", "arctic", "tusk", "ice", "loop"],
  size: [120, 48],
  origin: [52, 26],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "deep",
  options: {
    palette: ["#2a2e36", "#505864", "#7c8692", "#a8b2bc", "#d4dce4"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-52, -26, 120, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const skin = (u, v, x, y) => (v > 0.5 ? ["#6a7480", "#a0aab4", "#d0d8e0", "#eef2f6", "#ffffff"] : rand(Math.round(x / 2), Math.round(y / 2), 23) < 0.3 ? ["#141820", "#2a2e36", "#3c424c", "#505864", "#6a727e"] : C);
  drawFish(g, {
    L: 60, H: 9, peak: 0.4, nose: 0.8, stock: 0.16, skin,
    tail: { kind: "fluke", span: 6, len: 12, rays: false },
    dorsal: [],
    pectoral: { u: 0.3, len: 10, w: 4.5, angle: 0.6, v: 0.6, flap: 0.15 },
    eye: { u: 0.12, v: 0.05, r: 0.8, ring: "#505864" },
    mouth: { len: 6, open: 0, v: 0.4, drop: 0.5 },
    swim: { kind: "whale", amp: 0.9 },
    extra: (g, t, S) => {
      // the tusk: a long spiral tooth out of the upper lip
      const x0 = S.xOf(0.01), y0 = S.wave(0) - 1.5, L = 40;
      g.tube([[x0, y0], [x0 + L, y0 - 1.5]], (u) => 1.3 - u, (u, d) => (Math.round(u * 20) % 2 ? C[4] : C[2]), 1, 1);
    },
    outline: "#0e1016", lit: "#7c8692",
  }, t, D, o.seed);
  if (o.scene !== false) {
    // ice above: a pale ceiling with a crack of light
    for (let x = -52; x < 68; x++) p.dot(x, -26 + ((x * 7) % 3), hex("#c8e4ff"), 0.6);
    surfaceLight(p, t, D, -52, 68, -26, hex("#a8e6f0"), 0.09);
  }
  g.draw(p, 1, Math.sin((t / D) * TAU) * 2, Math.sin((t / D) * TAU) * 1.5);
  bubbles(p, t, D, 2, o.seed * 7 + 55, 14, -2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
}
