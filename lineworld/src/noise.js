// Deterministic hash noise. No libraries, no data files -- the whole world is
// derived from these few integer operations.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash2i(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2i(xi, yi, seed);
  const b = hash2i(xi + 1, yi, seed);
  const c = hash2i(xi, yi + 1, seed);
  const d = hash2i(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm2(x, y, octaves = 4, seed = 0) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export const WORLD_HALF = 165;

export function terrainHeight(x, z) {
  let h = (fbm2(x * 0.0085, z * 0.0085, 4, 11) - 0.5) * 9.0;
  h += (fbm2(x * 0.041, z * 0.041, 3, 37) - 0.5) * 1.6;
  h += (fbm2(x * 0.16, z * 0.16, 2, 71) - 0.5) * 0.22;
  // A shallow bowl around the origin so the opening clearing reads as a place.
  const d = Math.hypot(x, z);
  h *= 0.35 + 0.65 * smooth(Math.min(1, d / 46));
  return h;
}

export function terrainNormal(x, z, out) {
  const e = 0.75;
  const hL = terrainHeight(x - e, z), hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e), hU = terrainHeight(x, z + e);
  out.set(hL - hR, 2 * e, hD - hU).normalize();
  return out;
}
