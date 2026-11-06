// Frames and live creature instances. A frame is w x h pixels whose top-left sits at (ox, oy) in world
// space. `color` holds opaque or translucent pixels, `light` additive glow; composite() puts them together.
// Same shape as pixelfx's frames (MIT, Patch), which follow Sprite Fusion's VFX format.

import { Painter } from "./painter.js";
import { clamp } from "./math.js";
import { fit, toHex, hex } from "./color.js";

export function createFrame(w, h, ox = 0, oy = 0) {
  return { w, h, ox, oy, color: new Uint32Array(w * h), light: new Uint32Array(w * h) };
}
export function clearFrame(f) {
  f.color.fill(0);
  f.light.fill(0);
  return f;
}

const painters = new WeakMap();
/** The painter for a frame (one per frame, reused). */
export function painterFor(frame) {
  let p = painters.get(frame);
  if (!p) painters.set(frame, (p = new Painter(frame)));
  return p.reset();
}

const isRamp = (v) => Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === "number" || /^#[0-9a-f]{3,8}$/i.test(c));

/** A species' options: its defaults with the caller's on top. Ramps of another length are resampled to the default's. */
export function resolveOptions(meta, o = {}) {
  const opts = { ...(meta.options ?? {}), ...o };
  for (const [k, def] of Object.entries(meta.options ?? {}))
    if (isRamp(def) && isRamp(o[k]) && o[k].length !== def.length) opts[k] = fit(o[k], def.length).map(toHex);
  return opts;
}

/**
 * A live instance of a species module: { update(dt), draw(frame), t }.
 * o: { x, y, flip, angle, seed, palette, light, ...the species' own options }.
 */
export function createCreature(mod, o = {}) {
  const meta = mod.meta ?? {};
  const opts = resolveOptions(meta, o);
  const D = meta.duration ?? 1;
  let t = 0;
  return {
    meta,
    options: opts,
    get t() {
      return t;
    },
    set t(v) {
      t = v;
    },
    update(dt) {
      t += dt;
    },
    draw(frame) {
      const p = painterFor(frame);
      p.place(opts.x ?? 0, opts.y ?? 0, !!opts.flip, opts.angle ?? 0);
      p.lightK = opts.light ?? 1;
      mod.draw(p, meta.loop === false ? Math.min(t, D) : t % D, opts);
    },
  };
}

/**
 * Color over a background, plus light, into RGBA bytes (w * h * 4). bg: null for transparent, a color
 * number, or a Uint32Array of the frame's size.
 */
export function composite(f, out, bg = null, lightK = 1) {
  const n = f.w * f.h, C = f.color, L = f.light, flat = typeof bg === "number";
  for (let i = 0; i < n; i++) {
    const c = C[i], l = L[i] & 0xffffff;
    let r, g, b, a;
    const ca = c >>> 24;
    if (ca === 255) {
      r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; a = 255;
    } else if (bg === null) {
      r = c & 255; g = (c >>> 8) & 255; b = (c >>> 16) & 255; a = ca;
    } else {
      const k = flat ? bg : bg[i], f2 = ca / 255;
      r = (c & 255) * f2 + (k & 255) * (1 - f2); g = ((c >>> 8) & 255) * f2 + ((k >>> 8) & 255) * (1 - f2);
      b = ((c >>> 16) & 255) * f2 + ((k >>> 16) & 255) * (1 - f2); a = 255;
    }
    if (l) {
      const lr = (l & 255) * lightK, lg = ((l >>> 8) & 255) * lightK, lb = ((l >>> 16) & 255) * lightK;
      if (a < 255) {
        const pa = a / 255, pr = r * pa + lr, pg = g * pa + lg, pb = b * pa + lb;
        const na = Math.min(1, Math.max(pa, Math.max(lr, lg, lb) / 255));
        if (na > 0) { r = Math.min(255, pr / na); g = Math.min(255, pg / na); b = Math.min(255, pb / na); a = na * 255; }
      } else {
        r = Math.min(255, r + lr); g = Math.min(255, g + lg); b = Math.min(255, b + lb);
      }
    }
    const j = i * 4;
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a;
  }
  return out;
}

/**
 * A backdrop buffer (Uint32Array, w * h) for a frame: "deep" (open water, darker below), "reef" (teal water
 * over a sandy floor at floorY), "sand" (a pale sandy bottom), "night" (near black), "black", "white".
 */
export function backdrop(kind, w, h, floorY = h * 0.8) {
  const buf = new Uint32Array(w * h);
  const lerpc = (a, b, t) => {
    t = clamp(t);
    const A = hex(a), B = hex(b);
    const ch = (s) => (((A >>> s) & 255) + (((B >>> s) & 255) - ((A >>> s) & 255)) * t) & 255;
    return (255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c;
      const v = y / Math.max(1, h - 1);
      if (kind === "black") c = hex("#000000");
      else if (kind === "white") c = hex("#ffffff");
      else if (kind === "night") c = lerpc("#070a1a", "#03040c", v);
      else if (kind === "sand") c = y >= floorY ? lerpc("#c8a868", "#9c7e44", (y - floorY) / Math.max(1, h - floorY)) : lerpc("#2f7eae", "#5ab6d6", v / 0.8);
      else if (kind === "reef") c = y >= floorY ? ((x + y) % 7 === 0 ? hex("#7a6a3e") : lerpc("#8a7846", "#5c4c2a", (y - floorY) / Math.max(1, h - floorY))) : lerpc("#0e2a3c", "#1d5a6a", v / 0.8);
      else c = lerpc("#0a1a34", "#050c1c", v);
      buf[y * w + x] = c;
    }
  return buf;
}
export const BACKDROPS = ["deep", "reef", "sand", "night", "black", "white", "none"];
