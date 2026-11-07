import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Crystal jelly",
  ja: "オワンクラゲ",
  sci: "Aequorea coerulescens",
  region: "North Pacific; Japan, California",
  length: "bell 10–20 cm",
  desc: "A clear bowl of a jellyfish ribbed with fine radial canals, whose rim glows green when disturbed. That glow gave science aequorin and GFP, the green fluorescent protein that lights up cells in every biology lab, and a Nobel Prize for Osamu Shimomura.",
  jadesc: "透明なお椀の形で、細い放射管が肋のように並び、刺激すると縁が緑に光る。この光から下村脩がイクオリンと緑色蛍光タンパク質（GFP）を見つけ、ノーベル賞を受けた。",
  tags: ["jellyfish", "hydrozoa", "glow", "gfp", "japan", "loop"],
  size: [72,56],
  origin: [36,18],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a7a80", "#9aacb4", "#c8d8dc", "#e4eef0", "#f8fcff"],
    glow: ["#0a4a20", "#20a040", "#48e070", "#a0ffb0", "#f0fff0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -18, 72, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const GL = fit(o.glow, 5), k = beat(t, D, 1), y = lift(t, D, 1, 0, 3), ph = (t / D) * TAU, flash = Math.max(0, Math.sin(ph - 1)) ** 2;
  const b = bell(g, 28, 11, k, o.palette, (x, yy, nx, ny) => (Math.round(Math.atan2(yy + 1, x) * 12) % 2 === 0 ? ["#8a9aa0", "#b4c4c8", "#dce8ec", "#f0f8fa", "#ffffff"] : 0), { a: 0.6, frill: 0, dome: 0.5, rim: flash > 0.3 ? o.glow : null });
  tentacles(g, b.W, 24, 10, k, t, D, o.palette, { a: 0.45, spread: 2, seed: o.seed });
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[3] : C[1]), 0.45);
  g.draw(p, 1, Math.sin(ph) * 1.5, y);
  for (let x = -b.W; x <= b.W; x += 3) p.glow(x + Math.sin(ph) * 1.5, y + 1, 4, GL[2], 0.35 * flash);
  p.glow(0, -4 + y, 24, hex("#9aacb4"), 0.08);
  bubbles(p, t, D, 1, o.seed * 7 + 137, 10, 8, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -16);
}
