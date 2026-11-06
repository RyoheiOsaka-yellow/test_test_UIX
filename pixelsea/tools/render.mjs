#!/usr/bin/env node
// Render species so you can look at them.
//
//   node tools/render.mjs shrimp/harlequin            contact sheet: records/shrimp/harlequin/contact.png
//   node tools/render.mjs nudibranch --gif            every nudibranch, plus an animated GIF each
//   node tools/render.mjs all --sheet                 transparent sprite sheets (PNG + JSON) for every species
//   node tools/render.mjs "shrimp/*" --mp4 --scale 6
//   node tools/render.mjs shrimp/harlequin --opts '{"palette":["#102","#215","#43a","#8cf","#fff"]}'
//
// Options: --gif --mp4 --sheet --all (every frame in the contact sheet) --max N --zoom N --scale N
// --bg deep|reef|sand|night|black|white|none --seed N --fps N --flip --opts JSON --out DIR

import { join } from "node:path";
import { ROOT, resolveIds, renderFrames, contactSheet, spriteSheet, gif, mp4, save } from "./lib/sealib.mjs";

const args = process.argv.slice(2), flags = {}, ids = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith("--")) ids.push(a);
  else if (["gif", "mp4", "sheet", "all", "flip"].includes(a.slice(2))) flags[a.slice(2)] = true;
  else flags[a.slice(2)] = args[++i];
}
if (!ids.length) {
  console.error("usage: node tools/render.mjs <id|category|pattern|all>... [--gif] [--mp4] [--sheet] [--all]");
  process.exit(1);
}
const out = flags.out ?? join(ROOT, "records");
let failed = 0;
for (const id of resolveIds(ids)) {
  try {
    const t0 = Date.now();
    const shown = renderFrames(id, { fps: flags.fps ? +flags.fps : undefined, seed: flags.seed ? +flags.seed : undefined, bg: flags.bg ?? "deep", flip: !!flags.flip, options: flags.opts ? JSON.parse(flags.opts) : undefined });
    const dir = join(out, id), made = [];
    made.push(save(join(dir, "contact.png"), contactSheet(shown, { max: flags.all ? 999 : +(flags.max ?? 12), zoom: +(flags.zoom ?? 2) })));
    if (flags.gif) made.push(save(join(dir, "preview.gif"), gif(shown, +(flags.scale ?? 3))));
    if (flags.mp4) made.push(mp4(shown, save(join(dir, "preview.mp4"), Buffer.alloc(0)) && join(dir, "preview.mp4"), +(flags.scale ?? 4)) ? join(dir, "preview.mp4") : "(no ffmpeg)");
    if (flags.sheet) {
      const clean = renderFrames(id, { fps: flags.fps ? +flags.fps : undefined, seed: flags.seed ? +flags.seed : undefined, bg: "none", flip: !!flags.flip, options: { scene: false, ...(flags.opts ? JSON.parse(flags.opts) : {}) } });
      const name = id.split("/")[1], s = spriteSheet(clean, name);
      made.push(save(join(dir, `${name}.png`), s.png), save(join(dir, `${name}.json`), JSON.stringify(s.json, null, 2)));
    }
    console.log(`${id}: ${shown.n} frames ${shown.w}x${shown.h} in ${Date.now() - t0} ms -> ${made.map((m) => m.replace(ROOT + "/", "")).join(", ")}`);
  } catch (e) {
    failed++;
    console.error(`${id}: ${e.stack}`);
  }
}
process.exit(failed ? 1 : 0);
