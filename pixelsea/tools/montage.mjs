#!/usr/bin/env node
// One picture of every species (or a category): a frame each on its own backdrop, labelled.
//   node tools/montage.mjs                 docs/montage.png
//   node tools/montage.mjs shrimp --zoom 3 --cols 4 --out records/shrimp.png --frame 20
import { join } from "node:path";
import { ROOT, resolveIds, renderFrames, image, save, species } from "./lib/sealib.mjs";

const args = process.argv.slice(2), flags = {}, ids = [];
for (let i = 0; i < args.length; i++) args[i].startsWith("--") ? (flags[args[i].slice(2)] = args[++i]) : ids.push(args[i]);
const list = resolveIds(ids.length ? ids : ["all"]), zoom = +(flags.zoom ?? 3), cols = +(flags.cols ?? 4), fi = +(flags.frame ?? 0);
const CW = Math.max(...list.map((id) => species[id].meta.size[0])), CH = Math.max(...list.map((id) => species[id].meta.size[1]));
const cw = CW * zoom + 6, ch = CH * zoom + 20, rows = Math.ceil(list.length / cols);
const img = image(cols * cw + 6, rows * ch + 6, [12, 12, 18, 255]);
list.forEach((id, i) => {
  const m = species[id].meta;
  const f = renderFrames(id, { bg: flags.bg ?? m.bg });
  const frame = f.frames[Math.min(fi, f.n - 1)];
  const x = 6 + (i % cols) * cw, y = 6 + Math.floor(i / cols) * ch;
  img.paste(frame, f.w, f.h, x + Math.floor((CW - f.w) / 2) * zoom, y + (CH - f.h) * zoom, zoom);
  img.text(`${m.name}`, x, y + CH * zoom + 2, [230, 230, 240]);
  img.text(`${m.sci}`, x, y + CH * zoom + 8, [140, 140, 160]);
});
const out = flags.out ?? join(ROOT, "docs", "montage.png");
save(out, img.png());
console.log(`${list.length} species -> ${out.replace(ROOT + "/", "")}`);
