/* ============================================================
   TERRAIN — bake, clipmap, excavation, sun mask

   The one rule this file exists to enforce: the GPU never derives a
   height of its own. Wheels and pixels read the same baked field with
   the same filter, so the rover cannot float or sink. Everything else
   here — the clipmap rings, the mip chain, the dirty-rect uploads —
   is in service of that.
   ============================================================ */

import { fbm2, ridged2, hash2, makeRng, valueNoise2 } from '../core/rng.js';
import { createProgram, texture2D, buffer, vao } from '../core/gl.js';
import { clamp, smoothstep } from '../core/math.js';

/* Two nested fields. The fine one is the world you drive on and the
   only one excavation touches; the coarse one carries the rim wall and
   the far massifs out to the horizon. */
export const FIELD = {
  low:  { fineN: 1024, fineCell: 0.5,  coarseN: 512,  coarseCell: 16 },
  high: { fineN: 2048, fineCell: 0.25, coarseN: 1024, coarseCell: 8 }
};

const CLIP_M = 64;              // half-width of a clipmap block in cells
const CLIP_LEVELS = 9;
const SUN_ANGULAR_RADIUS = 0.00463;   // 0.53° across, in radians

/* ---------- the analytic world ----------
   Everything below is a pure function of position and seed. The bake
   samples it; nothing else is allowed to invent ground. */

const CRATER_CUTOFF = 2.2;

function craterProfile(t) {
  /* t = distance / radius. Parabolic bowl, raised rim at t=1, ejecta
     apron decaying outside. Depth-to-diameter near 1:5, which is what
     a fresh simple crater actually is.

     Every piece of this has to be continuous, including at the cutoff.
     An earlier version added the ejecta term only outside t=1 and
     stopped dead at t=2.2, which put a step of 0.02·r at the rim and
     another at the edge — on a 900 m crater that is an eighteen metre
     cliff, and the rover found every one of them. */
  const d = Math.abs(t - 1);
  const rim = 0.055 * Math.exp(-(d * d) / 0.045);
  const ejecta = 0.020 * Math.exp(-Math.max(t - 1, 0) * 1.7);
  const bowl = t < 1 ? -(1 - t * t) * 0.20 : 0;
  // Taper the whole apron to exactly zero where the query stops looking.
  const fade = 1 - smoothstep(1.5, CRATER_CUTOFF, t);
  return bowl + (rim + ejecta) * fade;
}

class CraterField {
  /* Craters are scattered on a jittered grid so the bake can find the
     handful that touch a texel without walking the whole list. */
  constructor(seed, cellSize, minR, maxR, density, halfSpan) {
    this.cell = cellSize;
    this.list = [];
    this.grid = new Map();
    const rng = makeRng(seed);
    const n = Math.ceil((halfSpan * 2) / cellSize);
    for (let gz = -1; gz <= n + 1; gz++) {
      for (let gx = -1; gx <= n + 1; gx++) {
        const h = hash2(gx, gz, seed);
        if (h > density) continue;
        const x = (gx + hash2(gx, gz, seed + 11)) * cellSize - halfSpan;
        const z = (gz + hash2(gx, gz, seed + 23)) * cellSize - halfSpan;
        // Size distribution biased hard toward small; big craters are rare.
        const u = hash2(gx, gz, seed + 37);
        const r = minR * Math.pow(maxR / minR, u * u * u);
        const age = hash2(gx, gz, seed + 53);   // 0 fresh, 1 degraded
        this.add({ x, z, r, age });
      }
    }
    void rng;
  }
  add(c) {
    this.list.push(c);
    const reach = c.r * CRATER_CUTOFF;
    const x0 = Math.floor((c.x - reach) / this.cell), x1 = Math.floor((c.x + reach) / this.cell);
    const z0 = Math.floor((c.z - reach) / this.cell), z1 = Math.floor((c.z + reach) / this.cell);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const k = x * 73856093 ^ z * 19349663;
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, a = []);
        a.push(c);
      }
    }
  }
  heightAt(x, z) {
    const k = Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663;
    const a = this.grid.get(k);
    if (!a) return 0;
    let h = 0;
    for (let i = 0; i < a.length; i++) {
      const c = a[i];
      const d = Math.hypot(x - c.x, z - c.z);
      const t = d / c.r;
      if (t > CRATER_CUTOFF) continue;
      // Old craters are shallow and their rims are gone.
      const fresh = 1 - c.age * 0.8;
      h += craterProfile(t) * c.r * fresh;
    }
    return h;
  }
}

export function makeWorldFunction(seed) {
  /* Anaxagoras is a 51 km crater; we sit on a patch of its floor. What
     the player sees is basin floor, a rille running north-east, one
     massif shoulder to the west, and the rim wall closing the horizon. */
  const craters = new CraterField(seed ^ 0x5f2a, 24, 2.5, 55, 0.16, 340);
  const bigCraters = new CraterField(seed ^ 0x9c31, 300, 60, 900, 0.30, 4400);

  function rilleDepth(x, z) {
    // A graben running roughly NE, meandering. Flat floor, steep walls.
    const t = (x * 0.6 + z * 0.8) / 1.0;
    const along = (-x * 0.8 + z * 0.6);
    const wander = fbm2(along * 0.0016, 0.0, 3, seed ^ 0x1234) * 46;
    const d = Math.abs(t - 150 - wander);
    const halfW = 26 + fbm2(along * 0.004, 7.0, 3, seed ^ 0x77) * 9;
    const u = d / halfW;
    if (u > 4) return 0;
    const DEPTH = -13;
    // Floor: deepest at the centreline, three quarters of that at the lip.
    if (u < 1) return DEPTH * (1 - 0.35 * u * u);
    // Wall: has to START where the floor ENDED, and reach exactly zero at
    // the cutoff. Getting either end wrong puts a four metre kerb along
    // both banks of the graben, which is where this comment comes from.
    const lip = DEPTH * (1 - 0.35);
    return lip * Math.exp(-(u - 1) * 2.6) * (1 - smoothstep(3, 4, u));
  }

  function rimWall(x, z) {
    const r = Math.hypot(x, z);
    // Rim crest at ~3.4 km, 1.1 km high, scalloped by ridged noise.
    // Sampled on the circle rather than on the angle: atan2 has a branch
    // cut at ±π, and a seam in the rim wall is a kilometre-high cliff.
    const a = Math.atan2(z, x);
    const scallop = ridged2(Math.cos(a) * 5.0, Math.sin(a) * 5.0 + r * 0.0004, 4, seed ^ 0xabc);
    const crest = 3400 + scallop * 700;
    if (r < crest - 2400) return 0;
    const u = (r - (crest - 2400)) / 2400;
    const rise = smoothstep(0, 1, u);
    return rise * (760 + scallop * 620);
  }

  function massif(x, z) {
    // A shoulder of the central peak complex, west-north-west.
    const dx = (x + 1450) * 0.9, dz = (z - 980) * 1.15;
    const r = Math.hypot(dx, dz);
    if (r > 1500) return 0;
    const u = 1 - r / 1500;
    const rough = ridged2(dx * 0.0035, dz * 0.0035, 5, seed ^ 0x333);
    return Math.pow(u, 1.7) * (330 + rough * 260);
  }

  /* Metres above the nominal basin datum. */
  function height(x, z) {
    let h = 0;
    // Long-wavelength floor roll — a few metres over hundreds.
    h += fbm2(x * 0.0011, z * 0.0011, 4, seed) * 14;
    h += fbm2(x * 0.0068, z * 0.0068, 4, seed + 91) * 2.4;
    // Metre-scale regolith undulation. This is what the suspension feels.
    h += fbm2(x * 0.055, z * 0.055, 3, seed + 401) * 0.24;
    h += fbm2(x * 0.31, z * 0.31, 2, seed + 733) * 0.045;
    h += rilleDepth(x, z);
    h += craters.heightAt(x, z);
    h += bigCraters.heightAt(x, z);
    h += rimWall(x, z);
    h += massif(x, z);
    return h;
  }

  return { height, craters, bigCraters, rilleDepth, rimWall, massif };
}

/* ---------- mip chain ----------
   Without this the coarse rings interpolate straight across crater
   bowls and leave a row of tents on the skyline. Box filter, because
   the field is a height and averaging is the correct reconstruction. */
function buildMips(base, n) {
  const mips = [base];
  let src = base, size = n;
  while (size > 4) {
    const half = size >> 1;
    const dst = new Float32Array(half * half);
    for (let y = 0; y < half; y++) {
      const s0 = (y * 2) * size, s1 = (y * 2 + 1) * size;
      for (let x = 0; x < half; x++) {
        const a = x * 2;
        dst[y * half + x] = (src[s0 + a] + src[s0 + a + 1] + src[s1 + a] + src[s1 + a + 1]) * 0.25;
      }
    }
    mips.push(dst);
    src = dst; size = half;
  }
  return mips;
}

function refreshMipRect(mips, n, x0, y0, x1, y1) {
  // Recompute only the levels that are still visible at rut scale.
  for (let l = 1; l < Math.min(4, mips.length); l++) {
    const size = n >> l, prevSize = n >> (l - 1);
    const src = mips[l - 1], dst = mips[l];
    const ax0 = Math.max(0, x0 >> l), ax1 = Math.min(size - 1, x1 >> l);
    const ay0 = Math.max(0, y0 >> l), ay1 = Math.min(size - 1, y1 >> l);
    for (let y = ay0; y <= ay1; y++) {
      const s0 = (y * 2) * prevSize, s1 = (y * 2 + 1) * prevSize;
      for (let x = ax0; x <= ax1; x++) {
        const a = x * 2;
        dst[y * size + x] = (src[s0 + a] + src[s0 + a + 1] + src[s1 + a] + src[s1 + a + 1]) * 0.25;
      }
    }
  }
}

/* ---------- the sun-occlusion sweep ----------

   For each texel, H(p) = max over the ray toward the sun of
   (h - u·tanElev). A point is in shadow when H(p) > h(p). Written as a
   recurrence it is one sweep across the field rather than a ray march
   per texel — O(N²) for the whole map instead of O(N²·steps).

       H(p) = max( h(p+Δ), H(p+Δ) ) - s·tanElev

   We carry the blocker distance alongside so the penumbra can be sized
   from the sun's real angular diameter, which is what makes a lunar
   shadow edge look like it could cut you. */
function bakeSunMask(field, n, cell, sunAz, sunEl) {
  const mask = new Uint8Array(n * n);
  const lx = Math.cos(sunEl) * Math.cos(sunAz);
  const lz = Math.cos(sunEl) * Math.sin(sunAz);
  const tanEl = Math.tan(sunEl);

  const dominantX = Math.abs(lx) >= Math.abs(lz);
  const stepSign = dominantX ? Math.sign(lx) || 1 : Math.sign(lz) || 1;
  const drift = dominantX ? lz / Math.abs(lx) : lx / Math.abs(lz);
  const s = cell * Math.hypot(1, drift);   // horizontal world distance per step
  const drop = s * tanEl;

  const major = n, minor = n;
  // carry[k] = max(h, H) at the previous (sun-ward) slab; dist[k] its blocker range.
  let carryH = new Float32Array(minor);
  let carryD = new Float32Array(minor);
  let nextH = new Float32Array(minor);
  let nextD = new Float32Array(minor);
  carryH.fill(-1e9);

  // Walk from the sun-ward edge backwards, so p+Δ is always already done.
  const start = stepSign > 0 ? major - 1 : 0;
  const end = stepSign > 0 ? -1 : major;
  const inc = -stepSign;

  const at = dominantX
    ? (i, k) => field[k * n + i]
    : (i, k) => field[i * n + k];
  const put = dominantX
    ? (i, k, v) => { mask[k * n + i] = v; }
    : (i, k, v) => { mask[i * n + k] = v; };

  for (let i = start; i !== end; i += inc) {
    for (let k = 0; k < minor; k++) {
      const h = at(i, k);
      // Sample the carried slab at k + drift, linearly.
      const kf = k + drift;
      let blockH, blockD;
      const k0 = Math.floor(kf);
      if (k0 < 0 || k0 >= minor - 1) { blockH = -1e9; blockD = 0; }
      else {
        const t = kf - k0;
        blockH = carryH[k0] + (carryH[k0 + 1] - carryH[k0]) * t;
        blockD = carryD[k0] + (carryD[k0 + 1] - carryD[k0]) * t;
      }
      const H = blockH - drop;
      const rise = H - h;
      let lit;
      if (rise <= -0.5) lit = 255;
      else {
        // Penumbra half-width grows with how far away the blocker is.
        const w = Math.max(0.02, (blockD + s) * SUN_ANGULAR_RADIUS);
        lit = Math.round(255 * (1 - smoothstep(-w, w, rise)));
      }
      put(i, k, lit);

      if (h >= H) { nextH[k] = h; nextD[k] = 0; }
      else { nextH[k] = H; nextD[k] = blockD + s; }
    }
    const th = carryH; carryH = nextH; nextH = th;
    const td = carryD; carryD = nextD; nextD = td;
  }
  return mask;
}

/* ---------- GLSL shared between the terrain and anything else that
   needs to know where the ground is ---------- */

export const HEIGHT_GLSL = `
uniform highp sampler2D uFine;
uniform highp sampler2D uCoarse;
uniform vec4 uFineInfo;    // originX, originZ, cell, size
uniform vec4 uCoarseInfo;

/* Software bilinear on purpose. OES_texture_float_linear is not
   universal, and doing the filter by hand is the only way to be sure
   the shader and the CPU agree to the last bit. */
float fetchBilinear(highp sampler2D tex, vec2 p, vec2 origin, float cell, float size, int lod) {
  float texel = cell * exp2(float(lod));
  float n = max(size / exp2(float(lod)), 1.0);
  vec2 uv = (p - origin) / texel - 0.5;
  vec2 f = fract(uv);
  ivec2 i0 = ivec2(floor(uv));
  ivec2 hi = ivec2(int(n) - 1);
  ivec2 a = clamp(i0, ivec2(0), hi);
  ivec2 b = clamp(i0 + ivec2(1, 0), ivec2(0), hi);
  ivec2 c = clamp(i0 + ivec2(0, 1), ivec2(0), hi);
  ivec2 d = clamp(i0 + ivec2(1, 1), ivec2(0), hi);
  float h00 = texelFetch(tex, a, lod).r;
  float h10 = texelFetch(tex, b, lod).r;
  float h01 = texelFetch(tex, c, lod).r;
  float h11 = texelFetch(tex, d, lod).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}

float sampleHeightLod(vec2 p, int fineLod, int coarseLod) {
  float hc = fetchBilinear(uCoarse, p, uCoarseInfo.xy, uCoarseInfo.z, uCoarseInfo.w, coarseLod);
  float halfFine = -uFineInfo.x;
  float edge = max(abs(p.x), abs(p.y));
  float w = 1.0 - smoothstep(halfFine - 46.0, halfFine - 10.0, edge);
  if (w <= 0.0) return hc;
  float hf = fetchBilinear(uFine, p, uFineInfo.xy, uFineInfo.z, uFineInfo.w, fineLod);
  return mix(hc, hf, w);
}
`;

/* ---------- Terrain ---------- */

export class Terrain {
  constructor(gl, { seed = 20260812, tier = 'high', sunAzimuth = 2.15, sunElevation = 0.38 } = {}) {
    this.gl = gl;
    this.seed = seed | 0;
    this.cfg = FIELD[tier] || FIELD.high;
    this.sunAz = sunAzimuth;
    this.sunEl = sunElevation;
    this.sunDir = [
      Math.cos(sunElevation) * Math.cos(sunAzimuth),
      Math.sin(sunElevation),
      Math.cos(sunElevation) * Math.sin(sunAzimuth)
    ];
    this.world = makeWorldFunction(this.seed);

    this.fineN = this.cfg.fineN;
    this.fineCell = this.cfg.fineCell;
    this.fineHalf = (this.fineN * this.fineCell) / 2;
    this.coarseN = this.cfg.coarseN;
    this.coarseCell = this.cfg.coarseCell;
    this.coarseHalf = (this.coarseN * this.coarseCell) / 2;

    this.debug = 0;
    this.dirty = [];              // region list, not a growing union
    this.churn = new Map();       // index -> { target, rate } for rut floors that slump
    this.churnCap = 24000;
  }

  /* Bake is a generator so the loading screen can show progress instead
     of the tab going white for four seconds. */
  * bakeSteps() {
    const { fineN, fineCell, fineHalf, coarseN, coarseCell, coarseHalf } = this;
    const H = this.world.height;

    yield { phase: 'Surveying basin floor', t: 0.02 };

    const fine = new Float32Array(fineN * fineN);
    const rowsPerChunk = 64;
    for (let y0 = 0; y0 < fineN; y0 += rowsPerChunk) {
      const y1 = Math.min(fineN, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        const wz = -fineHalf + (y + 0.5) * fineCell;
        const row = y * fineN;
        for (let x = 0; x < fineN; x++) {
          fine[row + x] = H(-fineHalf + (x + 0.5) * fineCell, wz);
        }
      }
      yield { phase: 'Surveying basin floor', t: 0.02 + 0.52 * (y1 / fineN) };
    }
    this.fine = fine;
    // Signed displacement already applied to each texel, in millimetres.
    this.cut = new Int16Array(fineN * fineN);

    yield { phase: 'Mapping rim wall', t: 0.56 };
    const coarse = new Float32Array(coarseN * coarseN);
    for (let y0 = 0; y0 < coarseN; y0 += rowsPerChunk) {
      const y1 = Math.min(coarseN, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        const wz = -coarseHalf + (y + 0.5) * coarseCell;
        const row = y * coarseN;
        for (let x = 0; x < coarseN; x++) {
          coarse[row + x] = H(-coarseHalf + (x + 0.5) * coarseCell, wz);
        }
      }
      yield { phase: 'Mapping rim wall', t: 0.56 + 0.16 * (y1 / coarseN) };
    }
    this.coarse = coarse;

    yield { phase: 'Building mip chain', t: 0.73 };
    this.fineMips = buildMips(fine, fineN);
    this.coarseMips = buildMips(coarse, coarseN);

    yield { phase: 'Ray-marching sun occlusion', t: 0.78 };
    this.fineMask = bakeSunMask(fine, fineN, fineCell, this.sunAz, this.sunEl);
    yield { phase: 'Ray-marching sun occlusion', t: 0.90 };
    this.coarseMask = bakeSunMask(coarse, coarseN, coarseCell, this.sunAz, this.sunEl);

    yield { phase: 'Uploading fields', t: 0.95 };
    this._upload();
    this._buildClipmap();
    yield { phase: 'Ready', t: 1 };
  }

  _upload() {
    const gl = this.gl;
    const mk = (mips, n, mask) => {
      const levels = mips.length;
      const tex = texture2D(gl, {
        width: n, height: n, levels,
        internalFormat: gl.R32F, format: gl.RED, type: gl.FLOAT,
        min: gl.NEAREST_MIPMAP_NEAREST, mag: gl.NEAREST
      });
      gl.bindTexture(gl.TEXTURE_2D, tex);
      for (let l = 0; l < levels; l++) {
        const s = n >> l;
        gl.texSubImage2D(gl.TEXTURE_2D, l, 0, 0, s, s, gl.RED, gl.FLOAT, mips[l]);
      }
      const mtex = texture2D(gl, {
        width: n, height: n, levels: 1,
        internalFormat: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE,
        data: mask, min: gl.LINEAR, mag: gl.LINEAR
      });
      return { tex, mtex };
    };
    const f = mk(this.fineMips, this.fineN, this.fineMask);
    const c = mk(this.coarseMips, this.coarseN, this.coarseMask);
    this.fineTex = f.tex; this.fineMaskTex = f.mtex;
    this.coarseTex = c.tex; this.coarseMaskTex = c.mtex;
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /* ---------- CPU sampling — the same filter the shader runs ---------- */

  height(x, z) {
    const n = this.fineN, cell = this.fineCell;
    const u = (x + this.fineHalf) / cell - 0.5;
    const v = (z + this.fineHalf) / cell - 0.5;
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const fx = u - i0, fz = v - j0;
    const ia = clamp(i0, 0, n - 1), ib = clamp(i0 + 1, 0, n - 1);
    const ja = clamp(j0, 0, n - 1), jb = clamp(j0 + 1, 0, n - 1);
    const f = this.fine;
    const h00 = f[ja * n + ia], h10 = f[ja * n + ib];
    const h01 = f[jb * n + ia], h11 = f[jb * n + ib];
    const a = h00 + (h10 - h00) * fx;
    const b = h01 + (h11 - h01) * fx;
    const hf = a + (b - a) * fz;

    const edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge < this.fineHalf - 46) return hf;
    const hc = this._coarseHeight(x, z);
    const w = 1 - smoothstep(this.fineHalf - 46, this.fineHalf - 10, edge);
    return hc + (hf - hc) * w;
  }

  _coarseHeight(x, z) {
    const n = this.coarseN, cell = this.coarseCell;
    const u = (x + this.coarseHalf) / cell - 0.5;
    const v = (z + this.coarseHalf) / cell - 0.5;
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const fx = u - i0, fz = v - j0;
    const ia = clamp(i0, 0, n - 1), ib = clamp(i0 + 1, 0, n - 1);
    const ja = clamp(j0, 0, n - 1), jb = clamp(j0 + 1, 0, n - 1);
    const f = this.coarse;
    const a = f[ja * n + ia] + (f[ja * n + ib] - f[ja * n + ia]) * fx;
    const b = f[jb * n + ia] + (f[jb * n + ib] - f[jb * n + ia]) * fx;
    return a + (b - a) * fz;
  }

  normal(x, z, out = [0, 1, 0]) {
    const e = this.fineCell;
    const hl = this.height(x - e, z), hr = this.height(x + e, z);
    const hd = this.height(x, z - e), hu = this.height(x, z + e);
    let nx = hl - hr, ny = 2 * e, nz = hd - hu;
    const l = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
    return out;
  }

  /* The flattest patch near a preferred point. A descent sled would
     have picked one, so the game should too — dropping the rover on a
     crater wall means it starts the mission sliding. */
  findLandingSite(preferX = 0, preferZ = 0, searchR = 110) {
    let best = null;
    const N = 420;
    for (let a = 1; a <= N; a++) {
      const ang = a * 2.39996323;                 // golden-angle spiral
      const rad = searchR * Math.sqrt(a / N);
      const x = preferX + Math.cos(ang) * rad;
      const z = preferZ + Math.sin(ang) * rad;
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < 10; i++) {
        const th = (i / 10) * Math.PI * 2;
        const h = this.height(x + Math.cos(th) * 2.4, z + Math.sin(th) * 2.4);
        if (h < mn) mn = h;
        if (h > mx) mx = h;
      }
      const centre = this.height(x, z);
      // Penalise both roughness and a dished or domed patch, then prefer
      // sites near the preferred point when two are equally flat.
      const score = (mx - mn) + Math.abs(centre - (mx + mn) * 0.5) * 2 + (rad / searchR) * 0.20;
      if (!best || score < best.score) best = { x, z, score, relief: mx - mn };
    }
    return best;
  }

  /* Sun occlusion at a world point, for the rover body and for props. */
  sunLight(x, z) {
    const n = this.fineN;
    const u = clamp((x + this.fineHalf) / this.fineCell - 0.5, 0, n - 1);
    const v = clamp((z + this.fineHalf) / this.fineCell - 0.5, 0, n - 1);
    const i = u | 0, j = v | 0;
    return this.fineMask[j * n + i] / 255;
  }

  /* ---------- excavation ----------
     A wheel does not paint a decal on the ground. It cuts a trough and
     piles the displaced regolith into berms along both flanks, in the
     field the physics reads back on the next step.

     `cut` is the signed displacement already applied to each texel, in
     millimetres. Without it a wheel standing still would subtract its
     sinkage every frame and fall through the Moon; with it the rut
     converges on the depth the contact pressure actually justifies —
     and a spinning wheel, which asks for a deeper one, digs a hole. */
  excavate(x, z, radius, depthM, stepM, churnRate = 0) {
    const n = this.fineN, cell = this.fineCell;
    const f = this.fine, cut = this.cut;
    const reach = radius * 1.85;
    const cx = (x + this.fineHalf) / cell - 0.5;
    const cz = (z + this.fineHalf) / cell - 0.5;
    const r = reach / cell + 1;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(n - 1, Math.ceil(cx + r));
    const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(n - 1, Math.ceil(cz + r));
    if (x1 < x0 || z1 < z0) return;

    const rInv = 1 / radius;
    const target = depthM * 1000;
    const maxStep = Math.max(0.4, stepM * 1000);
    let touched = false;
    for (let j = z0; j <= z1; j++) {
      const wz = -this.fineHalf + (j + 0.5) * cell;
      const dz = wz - z;
      const row = j * n;
      for (let i = x0; i <= x1; i++) {
        const wx = -this.fineHalf + (i + 0.5) * cell;
        const d = Math.hypot(wx - x, dz) * rInv;
        let desired;
        if (d < 1) {
          // Trough: near-flat floor, walls at the rim of the contact patch.
          desired = -target * (1 - d * d * d);
        } else if (d < 1.85) {
          // Berm: the material has to go somewhere, and it goes sideways.
          const t = (d - 1) / 0.85;
          desired = target * 0.40 * Math.sin(t * Math.PI) * (1 - t * 0.3);
        } else continue;

        const idx = row + i;
        const cur = cut[idx];
        let next = cur;
        if (desired < cur) next = Math.max(desired, cur - maxStep);
        else if (desired > cur && desired > 0) next = Math.min(desired, cur + maxStep);
        if (next === cur) continue;
        f[idx] += (next - cur) * 0.001;
        cut[idx] = next;
        touched = true;
        if (churnRate > 0 && d < 1) this._markChurn(idx, churnRate);
      }
    }
    if (touched) this._markDirty(x0, z0, x1, z1);
  }

  _markChurn(idx, rate) {
    if (this.churn.size >= this.churnCap) {
      // Oldest first; Map preserves insertion order.
      const k = this.churn.keys().next().value;
      this.churn.delete(k);
    }
    // Compacted rut floor never slumps. Churned floor comes back about
    // halfway, over a couple of seconds.
    const target = this.cut[idx] * 0.45;
    const e = this.churn.get(idx);
    if (e) { e.target = Math.max(e.target, target); e.rate = Math.max(e.rate, rate); }
    else this.churn.set(idx, { target, rate });
  }

  _markDirty(x0, z0, x1, z1) {
    // Region list rather than a growing union. The union version reaches
    // a million cells after ten minutes of driving and never shrinks.
    const pad = 1;
    x0 = Math.max(0, x0 - pad); z0 = Math.max(0, z0 - pad);
    x1 = Math.min(this.fineN - 1, x1 + pad); z1 = Math.min(this.fineN - 1, z1 + pad);
    for (const d of this.dirty) {
      // Merge only into a rect we already touch, and only while the
      // result stays small. The union version grows along the whole
      // driven path and ends up re-uploading a million cells a frame.
      if (x0 <= d.x1 + 4 && x1 >= d.x0 - 4 && z0 <= d.z1 + 4 && z1 >= d.z0 - 4) {
        const nx0 = Math.min(d.x0, x0), nz0 = Math.min(d.z0, z0);
        const nx1 = Math.max(d.x1, x1), nz1 = Math.max(d.z1, z1);
        if ((nx1 - nx0 + 1) * (nz1 - nz0 + 1) <= 4096) {
          d.x0 = nx0; d.z0 = nz0; d.x1 = nx1; d.z1 = nz1;
          return;
        }
      }
    }
    if (this.dirty.length > 48) {
      // Pathological frame; fold the newest into the last rather than
      // letting the list grow without bound.
      const d = this.dirty[this.dirty.length - 1];
      d.x0 = Math.min(d.x0, x0); d.z0 = Math.min(d.z0, z0);
      d.x1 = Math.max(d.x1, x1); d.z1 = Math.max(d.z1, z1);
      return;
    }
    this.dirty.push({ x0, z0, x1, z1 });
  }

  update(dt) {
    /* Churned rut floor creeps back over a couple of seconds; compacted
       floor never does. Bounded work per frame. */
    if (this.churn.size) {
      const n = this.fineN, f = this.fine, cut = this.cut;
      let budget = 3000;
      const done = [];
      let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9, any = false;
      for (const [idx, e] of this.churn) {
        if (budget-- <= 0) break;
        const cur = cut[idx];
        const next = cur + (e.target - cur) * Math.min(1, e.rate * dt);
        if (Math.abs(next - cur) < 0.4) { done.push(idx); continue; }
        f[idx] += (next - cur) * 0.001;
        cut[idx] = next;
        const x = idx % n, z = (idx / n) | 0;
        if (x < mnx) mnx = x; if (x > mxx) mxx = x;
        if (z < mnz) mnz = z; if (z > mxz) mxz = z;
        any = true;
      }
      for (const k of done) this.churn.delete(k);
      if (any) this._markDirty(mnx, mnz, mxx, mxz);
    }
    this._flushDirty();
  }

  _flushDirty() {
    if (!this.dirty.length) return;
    const gl = this.gl, n = this.fineN;
    gl.bindTexture(gl.TEXTURE_2D, this.fineTex);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, n);
    for (const d of this.dirty) {
      const w = d.x1 - d.x0 + 1, h = d.z1 - d.z0 + 1;
      refreshMipRect(this.fineMips, n, d.x0, d.z0, d.x1, d.z1);
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, d.x0);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, d.z0);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, d.x0, d.z0, w, h, gl.RED, gl.FLOAT, this.fine);
      for (let l = 1; l < Math.min(4, this.fineMips.length); l++) {
        const size = n >> l;
        const ax0 = d.x0 >> l, az0 = d.z0 >> l;
        const ax1 = Math.min(size - 1, d.x1 >> l), az1 = Math.min(size - 1, d.z1 >> l);
        if (ax1 < ax0 || az1 < az0) continue;
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, size);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, ax0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, az0);
        gl.texSubImage2D(gl.TEXTURE_2D, l, ax0, az0, ax1 - ax0 + 1, az1 - az0 + 1,
          gl.RED, gl.FLOAT, this.fineMips[l]);
      }
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, n);
    }
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.dirty.length = 0;
  }

  /* ---------- clipmap geometry ---------- */

  _buildClipmap() {
    const gl = this.gl;
    const M = CLIP_M, side = 2 * M + 1;
    const verts = new Float32Array(side * side * 2);
    let p = 0;
    for (let z = -M; z <= M; z++) {
      for (let x = -M; x <= M; x++) { verts[p++] = x; verts[p++] = z; }
    }
    const vb = buffer(gl, verts);

    const idx = (x, z) => (z + M) * side + (x + M);
    const mkIndices = (hole) => {
      const a = [];
      for (let z = -M; z < M; z++) {
        for (let x = -M; x < M; x++) {
          // hole is a half-open square in cell coordinates
          if (hole > 0 && x >= -hole && x < hole && z >= -hole && z < hole) continue;
          // Counter-clockwise seen from above: the ground's geometric
          // normal has to point at the sky or back-face culling quietly
          // eats every ring you are not looking up at.
          a.push(idx(x, z), idx(x, z + 1), idx(x + 1, z));
          a.push(idx(x + 1, z), idx(x, z + 1), idx(x + 1, z + 1));
        }
      }
      return new Uint32Array(a);
    };

    // One cell of guaranteed overlap: a gap between rings would show sky,
    // an overlap only shows a hairline that the depth bias settles.
    const HOLE = (M >> 1) - 1;
    this.fullIdx = mkIndices(0);
    this.ringIdx = mkIndices(HOLE);
    this.fullIB = buffer(gl, this.fullIdx, gl.ELEMENT_ARRAY_BUFFER);
    this.ringIB = buffer(gl, this.ringIdx, gl.ELEMENT_ARRAY_BUFFER);

    this.prog = createProgram(gl, TERRAIN_VS, TERRAIN_FS, 'terrain');
    const loc = this.prog.a.aLattice;
    this.vaoFull = vao(gl, [{ buffer: vb, loc, size: 2 }], this.fullIB);
    this.vaoRing = vao(gl, [{ buffer: vb, loc, size: 2 }], this.ringIB);
    this.M = M;
  }

  /* ---------- draw ---------- */

  render(ctx) {
    const gl = this.gl, pr = this.prog;
    pr.use();
    const u = pr.u;
    gl.uniformMatrix4fv(u.uViewProj, false, ctx.viewProj);
    gl.uniform3fv(u.uCam, ctx.camPos);
    gl.uniform3fv(u.uSun, this.sunDir);
    gl.uniform3fv(u.uSunColor, ctx.sunColor);
    gl.uniform1f(u.uTime, ctx.time);
    gl.uniform1f(u.uExposure, ctx.exposure);
    gl.uniform4fv(u.uFineInfo, [-this.fineHalf, -this.fineHalf, this.fineCell, this.fineN]);
    gl.uniform4fv(u.uCoarseInfo, [-this.coarseHalf, -this.coarseHalf, this.coarseCell, this.coarseN]);
    gl.uniform1f(u.uFineHalf, this.fineHalf);
    gl.uniform1i(u.uHeadlights, ctx.headlights ? 1 : 0);
    gl.uniform3fv(u.uLampPos, ctx.lampPos);
    gl.uniform3fv(u.uLampDir, ctx.lampDir);
    gl.uniform1fv(u.uShadowSpheres, ctx.shadowSpheres);
    gl.uniform1i(u.uShadowCount, ctx.shadowCount);
    gl.uniform4fv(u.uRadar, ctx.radar);
    gl.uniform1i(u.uDebug, this.debug | 0);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fineTex);
    gl.uniform1i(u.uFine, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.coarseTex);
    gl.uniform1i(u.uCoarse, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.fineMaskTex);
    gl.uniform1i(u.uFineMask, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.coarseMaskTex);
    gl.uniform1i(u.uCoarseMask, 3);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    const cx = ctx.focus[0], cz = ctx.focus[2];

    for (let l = 0; l < CLIP_LEVELS; l++) {
      const cell = this.fineCell * Math.pow(2, l);
      const snap = cell * 2;
      const ox = Math.round(cx / snap) * snap;
      const oz = Math.round(cz / snap) * snap;
      // Which mip of each field has texels this size?
      const fineLod = clamp(Math.round(Math.log2(cell / this.fineCell)), 0, this.fineMips.length - 1);
      const coarseLod = clamp(Math.round(Math.log2(cell / this.coarseCell)), 0, this.coarseMips.length - 1);
      gl.uniform4f(u.uLevel, ox, oz, cell, l);
      gl.uniform2i(u.uLod, fineLod, coarseLod);
      // Push coarser rings back so the one-cell overlap always resolves
      // in favour of the finer geometry.
      gl.polygonOffset(1 + l * 0.6, 2 + l * 2);
      gl.bindVertexArray(l === 0 ? this.vaoFull : this.vaoRing);
      const count = l === 0 ? this.fullIdx.length : this.ringIdx.length;
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
}

/* ---------- shaders ---------- */

const TERRAIN_VS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 aLattice;

uniform mat4 uViewProj;
uniform vec4 uLevel;     // originX, originZ, cellSize, levelIndex
uniform ivec2 uLod;
uniform float uFineHalf;
${HEIGHT_GLSL}

out vec3 vWorld;
out float vCell;
out float vLevel;

void main() {
  vec2 p = uLevel.xy + aLattice * uLevel.z;

  /* Geomorph the outer band toward the next coarser level so the ring
     boundary is coplanar with its neighbour and the LOD change does not
     pop as the rover drives. */
  float edge = max(abs(aLattice.x), abs(aLattice.y)) / ${CLIP_M}.0;
  float morph = smoothstep(0.76, 0.97, edge);

  float h = sampleHeightLod(p, uLod.x, uLod.y);
  if (morph > 0.0) {
    float hc = sampleHeightLod(p, min(uLod.x + 1, 8), min(uLod.y + 1, 8));
    h = mix(h, hc, morph);
  }

  vWorld = vec3(p.x, h, p.y);
  vCell = uLevel.z;
  vLevel = uLevel.w;
  gl_Position = uViewProj * vec4(vWorld, 1.0);
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec3 vWorld;
in float vCell;
in float vLevel;

uniform vec3 uCam;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uExposure;
uniform float uFineHalf;
uniform ivec2 uLod;
uniform sampler2D uFineMask;
uniform sampler2D uCoarseMask;
uniform int uHeadlights;
uniform vec3 uLampPos;
uniform vec3 uLampDir;
uniform float uShadowSpheres[48];   // xyz + radius, 12 max
uniform int uShadowCount;
uniform vec4 uRadar;                // x,z, radius, strength
uniform int uDebug;                 // 0 off; see Terrain.debug
${HEIGHT_GLSL}

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; }
  return s;
}

float sunMask(vec2 p) {
  float halfFine = uFineHalf;
  float edge = max(abs(p.x), abs(p.y));
  vec2 cu = (p - uCoarseInfo.xy) / (uCoarseInfo.z * uCoarseInfo.w);
  float mc = texture(uCoarseMask, cu).r;
  if (edge > halfFine - 10.0) return mc;
  vec2 fu = (p - uFineInfo.xy) / (uFineInfo.z * uFineInfo.w);
  float mf = texture(uFineMask, fu).r;
  float w = 1.0 - smoothstep(halfFine - 46.0, halfFine - 10.0, edge);
  return mix(mc, mf, w);
}

/* The rover and its wheels drop a real shadow without a shadow map:
   a handful of spheres tested against the sun ray, softened by the
   sun's angular size. Twelve spheres is the whole vehicle. */
float bodyShadow(vec3 p) {
  float s = 1.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uShadowCount) break;
    vec3 c = vec3(uShadowSpheres[i * 4], uShadowSpheres[i * 4 + 1], uShadowSpheres[i * 4 + 2]);
    float r = uShadowSpheres[i * 4 + 3];
    vec3 oc = c - p;
    float t = dot(oc, uSun);
    if (t < 0.0) continue;
    float d = length(oc - uSun * t);
    float pen = r + t * 0.0047 + 0.03;
    s *= smoothstep(0.0, 1.0, clamp((d - r * 0.35) / max(pen - r * 0.35, 1e-3), 0.0, 1.0));
  }
  return s;
}

void main() {
  vec2 p = vWorld.xz;
  float e = max(vCell, 0.25);

  // Normal from the same field the geometry came from, so shading and
  // silhouette never disagree.
  float hl = sampleHeightLod(p - vec2(e, 0.0), uLod.x, uLod.y);
  float hr = sampleHeightLod(p + vec2(e, 0.0), uLod.x, uLod.y);
  float hd = sampleHeightLod(p - vec2(0.0, e), uLod.x, uLod.y);
  float hu = sampleHeightLod(p + vec2(0.0, e), uLod.x, uLod.y);
  vec3 N = normalize(vec3(hl - hr, 2.0 * e, hd - hu));

  vec3 V = normalize(uCam - vWorld);
  float dist = length(uCam - vWorld);

  /* Micro-relief. Squared falloff, and it is gone by 40 m: a normal
     map at 2 cycles per metre viewed at a grazing angle is a field of
     white noise, which is exactly what the first version looked like. */
  float micro = clamp(1.0 - dist / 52.0, 0.0, 1.0);
  micro *= micro;
  if (micro > 0.002) {
    float s = 1.7;
    float n1 = fbm(p * s);
    float nx = fbm(p * s + vec2(0.10, 0.0)) - n1;
    float nz = fbm(p * s + vec2(0.0, 0.10)) - n1;
    N = normalize(N + vec3(-nx, 0.0, -nz) * 3.2 * micro);
  }

  /* Lommel–Seeliger. Lambert makes the Moon read as a shaded ball;
     the real surface is a flat disc right out to the limb because the
     brightness divides by (mu0 + mu). */
  float mu0 = max(dot(N, uSun), 0.0);
  float mu = max(dot(N, V), 0.0);
  float ls = mu0 / (mu0 + mu + 1e-3);

  // Coherent-backscatter opposition surge — the ground washes out when
  // you drive down-sun and your own shadow sits in the hot spot.
  float cg = clamp(dot(uSun, V), -1.0, 1.0);
  float g = acos(cg);
  float surge = 1.0 + 0.55 / (1.0 + tan(min(g, 3.0) * 0.5) / 0.075);

  float shadow = sunMask(p) * bodyShadow(vWorld + N * 0.02);

  // Albedo. Mare-dark floor, brighter ejecta around fresh craters,
  // a slow mottle so 300 m of flat ground is not one flat colour.
  float mott = fbm(p * 0.021) * 0.5 + fbm(p * 0.14) * 0.28;
  float alb = 0.088 + mott * 0.055;
  // Slope-fresh: steep faces shed dust and read brighter.
  alb += (1.0 - N.y) * 0.10;
  alb = clamp(alb, 0.05, 0.24);

  vec3 col = vec3(alb) * vec3(1.0, 0.975, 0.94) * ls * surge * shadow * uSunColor * 1.55;

  // Earthshine and the sky's own faint bounce. Almost nothing, but the
  // difference between "shadow" and "black hole in the picture".
  // Earthshine, plus what the surrounding regolith bounces back. It is
  // almost nothing — but it is the difference between a shadow and a
  // hole cut in the picture.
  col += vec3(0.034, 0.042, 0.062) * alb * (0.35 + 0.65 * N.y);

  if (uHeadlights == 1) {
    vec3 toL = uLampPos - vWorld;
    float ld = length(toL);
    vec3 Ld = toL / max(ld, 1e-3);
    float cone = smoothstep(0.80, 0.955, dot(-Ld, normalize(uLampDir)));
    float atten = 1.0 / (1.0 + ld * ld * 0.010);
    float lm0 = max(dot(N, Ld), 0.0);
    col += vec3(0.95, 0.96, 1.0) * alb * (lm0 / (lm0 + mu + 1e-3)) * cone * atten * 5.2;
  }

  // The GPR wavefront, drawn where it currently is on the ground.
  if (uRadar.w > 0.0) {
    /* pow(x, 2.0) is undefined for negative x in GLSL, and half of a
       wavefront is inside its own radius. The first version of this
       lit the entire disc instead of the ring. */
    float d = length(p - uRadar.xy);
    float rd = (d - uRadar.z) * 0.62;
    float band = exp(-rd * rd);
    // A faint wash trailing the wavefront. smoothstep with edge0 > edge1
    // is undefined in GLSL, which is how the first version came out as a
    // flood-lit disc rather than a ring.
    float behind = d < uRadar.z ? smoothstep(uRadar.z - 22.0, uRadar.z, d) * 0.13 : 0.0;
    col += vec3(0.16, 0.85, 1.0) * (band + behind) * uRadar.w * 0.30;
  }

  // No atmosphere means no aerial perspective. Distant terrain barely
  // dims, which is exactly why lunar photographs have no sense of scale.
  float far = clamp(dist / 4200.0, 0.0, 1.0);
  col = mix(col, col * 0.92 + vec3(0.006, 0.007, 0.011), far * 0.55);

  /* Development view. window.REGOLITH.debug = 1..6 to see what each
     term is actually doing, which is the only sane way to chase a
     shading bug through a shader this size. */
  if (uDebug != 0) {
    if (uDebug == 1) col = vec3(shadow);
    else if (uDebug == 2) col = N * 0.5 + 0.5;
    else if (uDebug == 3) col = vec3(mu0);
    else if (uDebug == 4) col = vec3(ls);
    else if (uDebug == 5) col = vec3(fract(vLevel / 8.0), 1.0 - vLevel / 8.0, 0.4);
    else if (uDebug == 6) col = vec3(alb * 4.0);
    fragColor = vec4(col, 1.0);
    return;
  }

  fragColor = vec4(col * uExposure, 1.0);
}`;
