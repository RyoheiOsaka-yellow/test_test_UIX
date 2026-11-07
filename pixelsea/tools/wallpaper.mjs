#!/usr/bin/env node
// Phone wallpapers on black.
//   node tools/wallpaper.mjs --mode tile --cat nudibranch --out docs/wallpapers/nudibranch-pattern.png
//   node tools/wallpaper.mjs --mode hero --species nudibranch/anna --out docs/wallpapers/nudibranch-hero.png
// Options: --w 1080 --h 1920 --zoom N (tile sprite scale, default 3; hero default fits 70% of the width)
// --cols N (tile columns, default 4) --seed N --frame N (or random) --no-scene
import { join } from "node:path";
import { ROOT, resolveIds, renderFrames, image, save, species } from "./lib/sealib.mjs";
import { Rng } from "../src/core/index.js";

const args = process.argv.slice(2), f = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) f[args[i].slice(2)] = args[i + 1]?.startsWith("--") || args[i + 1] === undefined ? true : args[++i];
const W = +(f.w ?? 1080), H = +(f.h ?? 1920), mode = f.mode ?? "tile", R = new Rng(+(f.seed ?? 7));
const img = image(W, H, [0, 0, 0, 255]);

// paste a frame scaled k times with alpha blending over what is there
function put(frame, w, h, x0, y0, k, flip = false) {
  for (let sy = 0; sy < h; sy++)
    for (let sx = 0; sx < w; sx++) {
      const j = (sy * w + (flip ? w - 1 - sx : sx)) * 4, a = frame[j + 3] / 255;
      if (a <= 0) continue;
      for (let yy = 0; yy < k; yy++)
        for (let xx = 0; xx < k; xx++) {
          const X = x0 + sx * k + xx, Y = y0 + sy * k + yy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const o = (Y * W + X) * 4;
          for (let c = 0; c < 3; c++) img.data[o + c] = frame[j + c] * a + img.data[o + c] * (1 - a);
          img.data[o + 3] = 255;
        }
    }
}
const frameOf = (id) => {
  const r = renderFrames(id, { bg: "none", options: { scene: f.scene === false || f["no-scene"] ? false : false }, seed: 1 + R.int(0, 5) });
  const i = f.frame !== undefined ? +f.frame % r.n : R.int(0, r.n - 1);
  return { r, frame: r.frames[i] };
};

if (mode === "tile") {
  const ids = resolveIds([f.cat ?? f.species ?? "nudibranch"]);
  const cols = +(f.cols ?? 5), k = +(f.zoom ?? 3), cw = W / cols, ch = cw * +(f.rowk ?? 0.72), rows = Math.ceil(H / ch) + 1;
  let n = 0;
  for (let row = -1; row < rows; row++)
    for (let col = -1; col <= cols; col++) {
      const id = ids[(((n++ + row * 3) % ids.length) + ids.length) % ids.length], { r, frame } = frameOf(id);
      const cx = col * cw + cw / 2 + (row % 2 ? cw / 2 : 0) + R.range(-8, 8), cy = row * ch + ch / 2 + R.range(-8, 8);
      put(frame, r.w, r.h, Math.round(cx - (r.w * k) / 2), Math.round(cy - (r.h * k) / 2), k, R.chance(0.5));
    }
} else {
  const id = f.species ?? "nudibranch/anna", { r, frame } = frameOf(id);
  const k = +(f.zoom ?? Math.max(1, Math.floor((W * 0.7) / r.w)));
  put(frame, r.w, r.h, Math.round((W - r.w * k) / 2), Math.round((H - r.h * k) / 2), k);
}
const out = f.out ?? join(ROOT, "docs", "wallpapers", `${mode}.png`);
save(out, img.png());
console.log(`${W}x${H} ${mode} -> ${out.replace(ROOT + "/", "")}`);
