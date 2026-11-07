import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Northern shrimp",
  ja: "ホッコクアカエビ（甘エビ）",
  sci: "Pandalus eous",
  region: "North Pacific, 200–600 m deep",
  length: "12 cm",
  desc: "The sweet shrimp of sushi counters: a glassy rose-red body, a long saw-toothed rostrum and big black eyes for the dim cold water. Born male, it turns female after a few years.",
  jadesc: "寿司屋の「甘エビ」。透き通った紅色の体に、長いノコギリ状の額角、暗い深海で光を集める大きな黒い目。雄として生まれ、数年で雌に性転換する。",
  tags: ["shrimp", "deep", "japan", "cold", "food", "loop"],
  size: [84, 52],
  origin: [36, 26],
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a0c20", "#a81c40", "#e04060", "#ff7890", "#ffc0c8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -26, 84, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const bob = Math.sin((t / D) * TAU) * 2, drift = Math.sin((t / D) * TAU) * 2;
  drawShrimp(g, {
    Lc: 14, H: 5, L: 22, curl: 0.5, rostrum: 10, rostrumUp: 2.5, taper: 0.38, eye: 2, alpha: 0.85, translucent: true,
    skin: (u, v) => (v > 0.45 ? ["#a81c40", "#e04060", "#ff7890", "#ffb0b8", "#ffe0e4"] : C),
    legs: { n: 5, len: 8, col: "#e86080", step: 0.5 },
    antennae: { n: 2, len: 40, up: -0.3, back: true, col: "#ff9aa8", alpha: 0.75 },
    antennules: { len: 9, col: "#ff9aa8" },
    claws: { kind: "small", size: 0.8, col: "#e86080" },
    swimmerets: { col: "#ff8098" },
  }, t, D, o.seed);
  g.draw(p, 1, drift, bob);
  // marine snow drifting down in the dark
  for (let i = 0; i < (o.scene !== false ? 14 : 0); i++) {
    const ph = (i * 0.37 + t / D) % 1, x = -40 + ((i * 37) % 84), y = -26 + ph * 52;
    p.dot(x, y, hex("#a8d0e0"), 0.35 + 0.25 * Math.sin(i));
  }
  bubbles(p, t, D, 1, o.seed * 13 + 5, 20, -6 + bob, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -26);
  p.glow(4, 0, 30, hex("#e04060"), 0.08);
}
