import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Japanese sea nettle",
  ja: "アカクラゲ",
  sci: "Chrysaora pacifica",
  region: "Japan, Korea, China (coastal)",
  length: "bell 20 cm, tentacles 2 m",
  desc: "A reddish-brown bell striped like a parasol with sixteen dark rays, trailing long tentacles and four ruffled oral arms. Its sting is sharp, and even its dried dust makes people sneeze: samurai once used it as a sneezing powder in battle.",
  jadesc: "赤褐色の傘に十六本の暗い放射模様、長い触手と四本のひだ状の口腕。刺されると痛く、乾いた粉を吸うとくしゃみが出る。戦国時代にはこの粉を「くしゃみの粉」として戦で使ったという。",
  tags: ["jellyfish", "cnidaria", "sting", "japan", "stripes", "loop"],
  size: [72,80],
  origin: [36,22],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a2010", "#8a4020", "#c06830", "#e8a060", "#ffd8a8"],
    ray: ["#2a0c08", "#4a1810", "#6a2818", "#8a3c28", "#a85038"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -22, 72, 80);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const R = fit(o.ray, 5), k = beat(t, D, 1), y = lift(t, D, 1, 0, 5);
  const pattern = (x, yy, nx, ny) => (Math.round(Math.atan2(yy + 2, x) * 5) % 2 === 0 && ny < 0.9 ? R : 0);
  const b = bell(g, 24, 13, k, o.palette, pattern, { a: 0.8, frill: 8, dome: 0.65 });
  tentacles(g, b.W, 14, 48, k, t, D, ["#6a3020", "#a05030", "#d07848", "#f0a070", "#ffd0a0"], { a: 0.75, spread: 5, seed: o.seed });
  oralArms(g, 4, 34, 2, k, t, D, ["#8a4020", "#c06830", "#e8a060", "#ffd0a0", "#fff0e0"], { a: 0.8, seed: o.seed });
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.7);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, y);
  p.glow(0, -4 + y, 22, hex("#c06830"), 0.07);
  bubbles(p, t, D, 1, o.seed * 7 + 131, 10, 10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -20);
}
