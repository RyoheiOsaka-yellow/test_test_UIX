// Render people to RGBA frames, and write PNGs, with pixelsea's core and PNG writer.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createFrame, clearFrame, composite, painterFor, hex } from "../../pixelsea/src/core/index.js";
import { encodePNG } from "../../pixelsea/tools/lib/png.mjs";
import { people } from "../src/index.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export { people, encodePNG };

export function renderFrame(id, t, { bg = null, scene = true, seed = 1 } = {}) {
  const mod = people[id], m = mod.meta, [w, h] = m.size, [ox, oy] = m.origin;
  const frame = createFrame(w, h), p = painterFor(frame).place(ox, oy);
  mod.draw(p, t, { scene, seed });
  return { w, h, rgba: composite(frame, Buffer.alloc(w * h * 4), bg === null ? null : hex(bg)) };
}
export function image(w, h, fill = [0, 0, 0, 255]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4);
  const put = (f, fw, fh, x0, y0, k, flip = false) => {
    for (let sy = 0; sy < fh; sy++) for (let sx = 0; sx < fw; sx++) {
      const j = (sy * fw + (flip ? fw - 1 - sx : sx)) * 4, a = f[j + 3] / 255;
      if (a <= 0) continue;
      for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
        const X = x0 + sx * k + xx, Y = y0 + sy * k + yy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const o = (Y * w + X) * 4;
        for (let c = 0; c < 3; c++) data[o + c] = f[j + c] * a + data[o + c] * (1 - a);
        data[o + 3] = 255;
      }
    }
  };
  return { w, h, data, put, png: () => encodePNG(w, h, data) };
}
export function save(file, buf) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, buf); return file; }
