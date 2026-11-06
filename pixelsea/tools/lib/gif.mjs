// A small animated GIF writer (LZW, one global palette) so previews need no packages. Colors beyond 256 are
// folded by dropping low bits, which pixel art rarely notices.

function quantize(frames, w, h) {
  // frames: RGBA buffers. Returns { pal: [[r,g,b]...], idx: [Uint8Array...] }
  let bits = 8;
  for (;;) {
    const shift = 8 - bits, map = new Map(), idx = [];
    let over = false;
    for (const f of frames) {
      const out = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const j = i * 4, a = f[j + 3];
        let key;
        if (a < 128) key = -1;
        else key = ((f[j] >> shift) << 16) | ((f[j + 1] >> shift) << 8) | (f[j + 2] >> shift);
        let k = map.get(key);
        if (k === undefined) {
          if (map.size >= 255) { over = true; break; }
          map.set(key, (k = map.size));
        }
        out[i] = k;
      }
      if (over) break;
      idx.push(out);
    }
    if (!over) {
      const pal = [];
      let transparent = -1;
      for (const [key, k] of map) {
        if (key === -1) { transparent = k; pal[k] = [0, 0, 0]; continue; }
        const up = (v) => (bits === 8 ? v : Math.round((v / ((1 << bits) - 1)) * 255));
        pal[k] = [up(key >> 16), up((key >> 8) & 255), up(key & 255)];
      }
      return { pal, idx, transparent };
    }
    bits--;
  }
}

function lzw(indices, minCode) {
  const out = [], clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, dict = new Map(), next = eoi + 1, cur = 0, curBits = 0;
  const emit = (code) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) { out.push(cur & 255); cur >>>= 8; curBits -= 8; }
  };
  const reset = () => { dict = new Map(); next = eoi + 1; codeSize = minCode + 1; };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i], key = prefix * 4096 + c + 1, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize++;
    } else { emit(clear); reset(); }
    prefix = c;
  }
  emit(prefix);
  emit(eoi);
  if (curBits > 0) out.push(cur & 255);
  return Buffer.from(out);
}

/** frames: RGBA buffers of w x h; delay in 1/100 s per frame (number or array). Returns a GIF buffer. */
export function encodeGIF(frames, w, h, delay = 3, loops = 0) {
  const { pal, idx, transparent } = quantize(frames, w, h);
  let bits = 1;
  while (1 << bits < pal.length) bits++;
  bits = Math.max(2, bits);
  const parts = [];
  parts.push(Buffer.from("GIF89a", "ascii"));
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0); lsd.writeUInt16LE(h, 2); lsd[4] = 0x80 | (bits - 1); lsd[5] = 0; lsd[6] = 0;
  parts.push(lsd);
  const gct = Buffer.alloc(3 << bits);
  pal.forEach((c, i) => { gct[i * 3] = c[0]; gct[i * 3 + 1] = c[1]; gct[i * 3 + 2] = c[2]; });
  parts.push(gct);
  parts.push(Buffer.from([0x21, 0xff, 11, ...Buffer.from("NETSCAPE2.0", "ascii"), 3, 1, loops & 255, (loops >> 8) & 255, 0]));
  idx.forEach((ind, i) => {
    const d = Array.isArray(delay) ? delay[i] : delay;
    const gce = Buffer.from([0x21, 0xf9, 4, transparent >= 0 ? 0x09 : 0x08, d & 255, (d >> 8) & 255, transparent >= 0 ? transparent : 0, 0]);
    parts.push(gce);
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c; desc.writeUInt16LE(0, 1); desc.writeUInt16LE(0, 3); desc.writeUInt16LE(w, 5); desc.writeUInt16LE(h, 7); desc[9] = 0;
    parts.push(desc);
    const min = Math.max(2, bits), data = lzw(ind, min);
    parts.push(Buffer.from([min]));
    for (let o = 0; o < data.length; o += 255) {
      const n = Math.min(255, data.length - o);
      parts.push(Buffer.from([n]), data.subarray(o, o + n));
    }
    parts.push(Buffer.from([0]));
  });
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
