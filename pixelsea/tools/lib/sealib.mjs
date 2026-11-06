// Shared by the tools: find species, render their frames, lay frames out, write PNG, GIF and MP4.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { encodePNG } from "./png.mjs";
import { encodeGIF } from "./gif.mjs";
import { drawText } from "./font.mjs";
import { createFrame, clearFrame, createCreature, composite, backdrop } from "../../src/core/index.js";
import { species, categories } from "../../src/species/index.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export { species, categories };

/** Species ids matching a list of ids, categories or globs ("shrimp/*", "nudibranch/chromodoris-*", "all"). */
export function resolveIds(list) {
  const ids = Object.keys(species), out = [];
  for (const q of list) {
    if (q === "all") { out.push(...ids); continue; }
    if (species[q]) { out.push(q); continue; }
    const re = new RegExp("^" + q.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + (q.includes("/") ? "$" : "/"));
    const m = ids.filter((id) => re.test(id));
    if (!m.length) console.error(`no species matches ${q}`);
    out.push(...m);
  }
  return [...new Set(out)];
}

/** Every frame of a species over one loop: { w, h, fps, frames: [RGBA Buffer...], meta }. */
export function renderFrames(id, { fps, seed, bg, options, pad = 0, flip = false } = {}) {
  const mod = species[id], meta = mod.meta;
  fps = fps ?? meta.fps ?? 30;
  const [w, h] = meta.size, [ox, oy] = meta.origin, W = w + pad * 2, H = h + pad * 2;
  const n = Math.max(1, Math.round(meta.duration * fps));
  const frame = createFrame(W, H), buf = bg && bg !== "none" ? backdrop(bg, W, H, oy + pad + (meta.floor ?? h * 0.35)) : null;
  const inst = createCreature(mod, { x: ox + pad, y: oy + pad, flip, seed: seed ?? meta.options?.seed ?? 1, ...(options ?? {}) });
  const frames = [];
  for (let i = 0; i < n; i++) {
    inst.t = i / fps;
    clearFrame(frame);
    inst.draw(frame);
    frames.push(composite(frame, Buffer.alloc(W * H * 4), buf));
  }
  return { id, w: W, h: H, fps, frames, meta, n };
}

/** An RGBA image to paste things on. */
export function image(w, h, fill = [0, 0, 0, 0]) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4);
  return {
    w, h, data,
    paste(src, sw, sh, x, y, k = 1) {
      for (let sy = 0; sy < sh; sy++)
        for (let sx = 0; sx < sw; sx++) {
          const j = (sy * sw + sx) * 4;
          if (src[j + 3] === 0) continue;
          for (let yy = 0; yy < k; yy++)
            for (let xx = 0; xx < k; xx++) {
              const X = x + sx * k + xx, Y = y + sy * k + yy;
              if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
              data.set(src.subarray(j, j + 4), (Y * w + X) * 4);
            }
        }
    },
    text(str, x, y, rgb = [255, 255, 255], k = 1) {
      drawText(str, x, y, (X, Y) => { if (X >= 0 && Y >= 0 && X < w && Y < h) data.set([...rgb, 255], (Y * w + X) * 4); }, k);
    },
    png() { return encodePNG(w, h, data); },
  };
}

/** A contact sheet: up to max frames in a grid, labelled, scaled. Returns a PNG buffer. */
export function contactSheet(r, { max = 12, zoom = 2, cols = 6 } = {}) {
  const pick = r.n <= max ? r.frames.map((_, i) => i) : Array.from({ length: max }, (_, i) => Math.floor((i * r.n) / max));
  const cw = r.w * zoom + 4, ch = r.h * zoom + 12, C = Math.min(cols, pick.length), R = Math.ceil(pick.length / C);
  const img = image(C * cw + 4, R * ch + 4, [20, 20, 28, 255]);
  pick.forEach((fi, i) => {
    const x = 4 + (i % C) * cw, y = 4 + Math.floor(i / C) * ch;
    img.paste(r.frames[fi], r.w, r.h, x, y + 8, zoom);
    img.text(`${fi}`, x, y + 1, [150, 150, 170]);
  });
  img.text(r.id, 4, img.h - 7 < 0 ? 0 : 0, [255, 255, 255]);
  return img.png();
}

/** A transparent sprite sheet (PNG + Aseprite-style JSON). */
export function spriteSheet(r, name) {
  const cols = Math.ceil(Math.sqrt(r.n)), rows = Math.ceil(r.n / cols);
  const img = image(cols * r.w, rows * r.h);
  const frames = {};
  const [ox, oy] = r.meta.origin;
  r.frames.forEach((f, i) => {
    const x = (i % cols) * r.w, y = Math.floor(i / cols) * r.h;
    img.paste(f, r.w, r.h, x, y);
    frames[`${name} ${i}`] = { frame: { x, y, w: r.w, h: r.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h }, sourceSize: { w: r.w, h: r.h }, duration: Math.round(1000 / r.fps) };
  });
  const json = {
    frames,
    meta: {
      app: "pixelsea", version: "1", image: `${name}.png`, format: "RGBA8888", size: { w: img.w, h: img.h }, scale: "1",
      frameTags: [{ name, from: 0, to: r.n - 1, direction: "forward" }],
      pixelsea: { id: r.id, name: r.meta.name, ja: r.meta.ja, sci: r.meta.sci, fps: r.fps, loop: r.meta.loop !== false, columns: cols, pivot: { x: ox, y: oy } },
    },
  };
  return { png: img.png(), json };
}

/** An animated GIF, scaled k times. */
export function gif(r, k = 3) {
  const frames = r.frames.map((f) => {
    const img = image(r.w * k, r.h * k);
    img.paste(f, r.w, r.h, 0, 0, k);
    return img.data;
  });
  return encodeGIF(frames, r.w * k, r.h * k, Math.max(2, Math.round(100 / r.fps)));
}

/** An MP4 through ffmpeg (if present), scaled k times. Returns false if ffmpeg is missing. */
export function mp4(r, file, k = 4, loops = 3) {
  const probe = spawnSync("ffmpeg", ["-version"]);
  if (probe.error) return false;
  const raw = Buffer.concat(Array.from({ length: loops }, () => r.frames).flat());
  const res = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${r.w}x${r.h}`, "-r", `${r.fps}`, "-i", "-",
    "-vf", `scale=${r.w * k}:${r.h * k}:flags=neighbor,format=yuv420p`, "-c:v", "libx264", "-crf", "18", file], { input: raw });
  return res.status === 0;
}

export function save(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return file;
}
export { existsSync };
