import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Comb jelly",
  ja: "ウリクラゲ（クシクラゲ）",
  sci: "Beroe cucumis",
  region: "Cold and temperate seas worldwide; Japan in winter",
  length: "10–15 cm",
  desc: "Not a true jellyfish but a ctenophore: a melon-shaped sack of clear jelly with no sting, rowing itself along on eight rows of beating comb plates that scatter light into rainbows. It swallows other comb jellies whole.",
  jadesc: "本当のクラゲではなく有櫛動物。瓜のような形の透明なゼリーで、刺す毒はない。八列の櫛板をさざ波のように動かして進み、光が当たると虹色に輝く。ほかのクシクラゲを丸呑みにする。",
  tags: ["comb jelly", "ctenophore", "rainbow", "worldwide", "winter", "loop"],
  size: [64,52],
  origin: [32,26],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a4050", "#7a6a88", "#a898b0", "#d0c8d8", "#f4f0f8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -26, 64, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU;
  g.ellipse(0, 0, 13, 22, (nx, ny) => (Math.abs(nx) > 0.75 ? C[2] : C[3]), 0.5);
  // eight comb rows: beads of light running down the body, cycling through the rainbow
  const RB = ["#ff4060", "#ffa030", "#f0e040", "#40e080", "#40c0ff", "#8060ff", "#e060ff"].map(hex);
  for (let r = 0; r < 5; r++) {
    const u = -1 + (r / 4) * 2, rx = u * 12;
    for (let yy = -20; yy <= 20; yy += 2) { const ny = yy / 22, x = rx * Math.sqrt(Math.max(0, 1 - ny * ny)); const idx = ((Math.round((yy + 20) / 2 - t * 12) % 7) + 7) % 7; g.set(x, yy, RB[idx], 0.95); }
  }
  g.ellipse(0, 21, 8, 2.5, (nx, ny) => (ny < 0 ? C[1] : C[0]), 0.7);
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[3] : C[1]), 0.5);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 2) * 1.5);
  p.glow(0, 0, 22, hex("#a898b0"), 0.06);
  bubbles(p, t, D, 1, o.seed * 7 + 142, 8, 4, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
}
