/* ============================================================
   RNG — deterministic noise

   The whole world is a pure function of one seed: terrain, boulder
   placement, star field, texture detail. Nothing here may ever call
   Math.random(), because the CPU bake and the shaders both need to
   agree on what the ground looks like, and a save file that only
   stores a seed has to rebuild the same basin.
   ============================================================ */

/* mulberry32 — small, fast, good enough for scattering rocks. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Integer hash to [0,1). Used for lattice noise so the field can be
   evaluated at any point without storing a permutation table. */
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^
          Math.imul(z | 0, 0x85ebca6b) ^ Math.imul(seed | 0, 0x9e3779b9);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/* Value noise rather than gradient noise. Regolith topography is
   lumpy, not swirly, and value noise costs one hash per corner. */
export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return (ab + (cd - ab) * v) * 2 - 1;   // [-1, 1]
}

export function valueNoise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const n = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const x00 = n(0, 0, 0) + (n(1, 0, 0) - n(0, 0, 0)) * u;
  const x10 = n(0, 1, 0) + (n(1, 1, 0) - n(0, 1, 0)) * u;
  const x01 = n(0, 0, 1) + (n(1, 0, 1) - n(0, 0, 1)) * u;
  const x11 = n(0, 1, 1) + (n(1, 1, 1) - n(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return (y0 + (y1 - y0) * w) * 2 - 1;
}

/* Fractional Brownian motion. Lacunarity 2.03 rather than 2.0 so the
   octaves do not line up on the lattice and stripe the field. */
export function fbm2(x, y, octaves = 5, seed = 0, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(fx, fy, seed + i * 1013) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity; fy *= lacunarity;
  }
  return sum / norm;
}

export function fbm3(x, y, z, octaves = 4, seed = 0) {
  let sum = 0, amp = 1, norm = 0, s = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * s, y * s, z * s, seed + i * 1013) * amp;
    norm += amp; amp *= 0.5; s *= 2.03;
  }
  return sum / norm;
}

/* Ridged multifractal — the sharp-crested ridges of a rim wall. */
export function ridged2(x, y, octaves = 5, seed = 0) {
  let sum = 0, amp = 0.5, norm = 0, fx = x, fy = y, prev = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(valueNoise2(fx, fy, seed + i * 7919));
    n *= n;
    sum += n * amp * prev;
    norm += amp;
    prev = n;
    amp *= 0.5;
    fx *= 2.07; fy *= 2.07;
  }
  return sum / norm;
}

/* Worley / cellular F1 distance, used for the mottled plagioclase on
   boulders and for the clumping of small crater fields. */
export function worley2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 8;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const px = cx + hash2(cx, cy, seed);
      const py = cy + hash2(cx, cy, seed + 7717);
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/* Uniform point on a sphere, from two uniforms. Stars and dust ejection
   cones both need this and both need it to be repeatable. */
export function sphereDir(u1, u2, out = [0, 0, 0]) {
  const z = u1 * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  const phi = u2 * Math.PI * 2;
  out[0] = r * Math.cos(phi); out[1] = z; out[2] = r * Math.sin(phi);
  return out;
}
