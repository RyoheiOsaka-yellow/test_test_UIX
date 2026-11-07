import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Snow crab",
  ja: "ズワイガニ",
  sci: "Chionoecetes opilio",
  region: "Sea of Japan, Okhotsk, Bering Sea, 200–600 m",
  length: "shell 15 cm, legs 70 cm",
  desc: "The winter crab of the Sea of Japan coast, sold as matsuba-gani in Tottori and echizen-gani in Fukui with a tag on its leg: a smooth brown-red shell on long slender legs, living on the cold muddy bottom. Males grow for a decade, moulting until they are ready to mate.",
  jadesc: "日本海側の冬の味覚、鳥取の松葉ガニ、福井の越前ガニ。滑らかな赤褐色の甲に細長い脚で、冷たい泥の海底に住む。雄は10年かけて脱皮を重ね、成熟する。",
  tags: ["crab", "crustacean", "cold", "japan", "food", "loop"],
  size: [96,56],
  origin: [48,24],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a1c10", "#8a3820", "#c06030", "#e89060", "#ffc8a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -24, 96, 56), BG = new Grid(-48, -24, 96, 56);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  drawCrab(g, {
    W: 13, H: 10, shape: "round", floor: 26, scuttle: 1.5, bumps: 0.08,
    skin: (nx, ny) => (ny > 0.5 ? ["#8a6a50", "#c0a080", "#e0c8a8", "#f0e0c8", "#fff8f0"] : C),
    legs: { n: 4, L: 32, r: 1.5, cols: C, lift: 3, lengths: [1, 1, 0.95, 0.8] },
    claws: { size: 2, L: 16, cols: C, open: 0.3 },
    eyes: { stalk: 2, r: 1, x: 0.3 },
    outline: "#2a0c04", lit: "#8a3820",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -48, 50, 26, 6, o.seed);
  if (o.scene !== false) shadow(p, 0, 26, 40, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 144, 0, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -22);
}
