#!/usr/bin/env node
// A contact sheet of everyone at a zoom, to look at:  node tools/sheet.mjs --zoom 5 --out /tmp/x.png
import { people, renderFrame, image, save } from "./lib.mjs";
const args = process.argv.slice(2), f = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) f[args[i].slice(2)] = args[++i];
const k = +(f.zoom ?? 4), ids = Object.keys(people), rs = ids.map((id) => renderFrame(id, +(f.frame ?? 0.3)));
const W = rs.reduce((s, r) => s + r.w * k + 8, 8), H = Math.max(...rs.map((r) => r.h * k)) + 16;
const img = image(W, H, [20, 20, 28, 255]);
let x = 8;
for (const r of rs) { img.put(r.rgba, r.w, r.h, x, 8, k); x += r.w * k + 8; }
save(f.out ?? "sheet.png", img.png());
console.log(`${ids.join(", ")} -> ${f.out}`);
