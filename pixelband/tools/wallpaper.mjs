#!/usr/bin/env node
// Phone wallpapers (1080x1920 on black).
//   node tools/wallpaper.mjs --mode hero --who kurt --out docs/wallpapers/kurt.png
//   node tools/wallpaper.mjs --mode pattern --who thom,jonny,kurt,frusciante --out docs/wallpapers/pattern.png
//   node tools/wallpaper.mjs --mode hero --who radiohead --zoom 6
// Options: --w --h --zoom --frame (seconds into the loop) --cols --rowk --seed --title "text"
import { join } from "node:path";
import { ROOT, people, renderFrame, image, save } from "./lib.mjs";
import { Rng } from "../../pixelsea/src/core/index.js";

const args = process.argv.slice(2), f = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) f[args[i].slice(2)] = args[i + 1] === undefined || args[i + 1].startsWith("--") ? true : args[++i];
const W = +(f.w ?? 1080), H = +(f.h ?? 1920), mode = f.mode ?? "hero", R = new Rng(+(f.seed ?? 3)), img = image(W, H);
const who = (f.who ?? "thom").split(",");
if (mode === "hero") {
  const r = renderFrame(who[0], +(f.frame ?? 0.3));
  const k = +(f.zoom ?? Math.max(1, Math.floor((W * 0.8) / r.w)));
  img.put(r.rgba, r.w, r.h, Math.round((W - r.w * k) / 2), Math.round(H * 0.56 - (r.h * k) / 2), k);
} else {
  const cols = +(f.cols ?? 4), k = +(f.zoom ?? 3), cw = W / cols, ch = cw * +(f.rowk ?? 1.4), rows = Math.ceil(H / ch) + 1;
  let n = 0;
  for (let row = -1; row < rows; row++) for (let col = -1; col <= cols; col++) {
    const id = who[(((n++ + row) % who.length) + who.length) % who.length], r = renderFrame(id, R.range(0, 2), { scene: false });
    const cx = col * cw + cw / 2 + (row % 2 ? cw / 2 : 0), cy = row * ch + ch / 2;
    img.put(r.rgba, r.w, r.h, Math.round(cx - (r.w * k) / 2), Math.round(cy - (r.h * k) / 2), k, R.chance(0.5));
  }
}
const out = f.out ?? join(ROOT, "docs", "wallpapers", `${mode}-${who.join("-")}.png`);
save(out, img.png());
console.log(`${W}x${H} ${mode} ${who.join(",")} -> ${out.replace(ROOT + "/", "")}`);
