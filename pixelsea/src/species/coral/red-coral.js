import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Japanese red coral",
  ja: "アカサンゴ",
  sci: "Corallium japonicum",
  region: "Japan (Kochi, Okinawa, Ogasawara), 100–300 m deep",
  length: "20–40 cm",
  desc: "The precious coral of jewellers: a fan of blood-red branches dotted with white polyps, growing a few millimetres a decade in the cold dark below the reef. Its dense red skeleton has been carved since antiquity and is now protected by harvest limits.",
  jadesc: "宝飾の「血赤珊瑚」。深く暗い冷たい海で、白いポリプを散らした血のように赤い枝が10年に数 mmだけ育つ。緻密な赤い骨格は古代から細工され、今は採取量が制限されている。",
  tags: ["coral", "precious", "deep", "red", "japan", "loop"],
  size: [60, 52],
  origin: [30, 46],
  floor: 0,
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "night",
  options: {
    palette: ["#3a0408", "#7a0a14", "#b81820", "#e03030", "#ff7070"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -46, 60, 52), BG = new Grid(-30, -46, 60, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU;
  if (o.scene !== false) rock(bg, -30, 30, 0, 6, ["#0a0a10", "#161620", "#24242e"], o.seed);
  branch(g, 0, -1, -0.1, 12, 4, t, D, {
    n: 2, spread: 0.6, shrink: 0.78, r: 2.4, rr: 0.9, cols: o.palette, k: 0.15, seed: o.seed,
    every: (g, bx, by, an, d, u) => { const k = 0.5 + 0.5 * Math.sin(ph + bx * 0.4 + by * 0.2); if (k > 0.4) { g.set(bx + Math.cos(an) * 2.2, by + Math.sin(an) * 2.2, hex("#fff8f0")); g.set(bx - Math.cos(an) * 2.2, by - Math.sin(an) * 2.2, hex("#fff8f0")); } },
    tip: (g, tx, ty) => g.set(tx, ty - 1, hex("#fff8f0")),
  });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) for (let i = 0; i < 10; i++) p.dot(-30 + ((i * 37) % 60), -46 + (((i * 0.31 + t / D) % 1) * 52), hex("#a8d0e0"), 0.3);
  bubbles(p, t, D, 1, o.seed * 7 + 99, 0, -26, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -44);
  p.glow(0, -22, 20, hex("#e03030"), 0.05);
}
