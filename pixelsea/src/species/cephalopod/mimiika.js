import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Bobtail squid",
  ja: "ミミイカ",
  sci: "Euprymna berryi",
  region: "Japan, Korea, China (shallow sand)",
  length: "4 cm",
  desc: "A thumb-sized, round-bodied squid with ear-like fins, buried in sand by day and hunting by night. A pouch of glowing bacteria on its belly shines just as bright as the moonlight above, so it casts no shadow for predators below.",
  jadesc: "親指ほどの丸い体に耳のようなひれ。昼は砂に潜り、夜に狩りに出る。腹の発光器に飼う細菌が月明かりと同じ明るさで光り、下から見上げる敵に影を見せない。",
  tags: ["squid", "cephalopod", "tiny", "japan", "sand", "glow", "loop"],
  size: [56, 40],
  origin: [26, 22],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1a1020", "#3a2840", "#5a4460", "#8a6a88", "#b898b0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-26, -22, 56, 40);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU;
  const skin = (u, v, x, y, tt) => (v > 0.55 ? ["#6a8a98", "#a0c8d8", "#d0f0f8", "#f0ffff", "#ffffff"] : spots(x, y, tt, 0.3, 2, 6) ? ["#0a0410", "#1c1024", "#2e1c38", "#40284a", "#54385e"] : C);
  drawSquid(g, {
    L: 16, H: 7, shape: "round", skin,
    fins: { kind: "ear", len: 9, h: 6, at: 0.5 }, finSkin: C,
    head: { r: 5.5 }, eye: { r: 2.6, ring: "#e8e8f0" },
    arms: { n: 8, L: 7, r: 1.4, curl: 0.8 },
    tentacles: null,
    outline: "#0a0410", lit: "#3a2840",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -26, 28, 8, 8, o.seed);
  g.draw(p, 1, 0, 1 + Math.sin(ph) * 0.8);
  p.glow(-2, 6, 10, hex("#a0e0ff"), 0.18 + 0.08 * Math.sin(ph * 2));
  if (o.scene !== false) sandFloor(p, -26, 28, 11, 6, o.seed + 1);
  bubbles(p, t, D, 1, o.seed * 7 + 115, 6, -4, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -20);
}
