/**
 * Hydrostatics L0 engine.
 *
 * The hull is described by an offsets table (stations × waterline offsets).
 * All properties are obtained by numerical integration:
 *   - within a section, half-breadth y(z) is piecewise linear between offsets,
 *     so vertical integrals (area, first moment) are evaluated exactly per segment;
 *   - along the ship, integrals over x use composite Simpson on uniformly
 *     spaced stations, falling back to trapezoid segments where spacing is not
 *     uniform.
 *
 * L0 scope: even keel, rigid hull, box tanks, free-surface correction only.
 */

import type {
  HullGeometry,
  HydroCondition,
  HydroResult,
  Station,
  TankEntityData,
  TankState,
} from './types.js';

const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Generic integration over sampled data
// ---------------------------------------------------------------------------

/**
 * Integrate y over x for sampled points. Uses composite Simpson over runs of
 * uniform spacing (pairs of intervals), trapezoid for leftover intervals.
 */
export function integrateSamples(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error('integrateSamples: length mismatch');
  const n = xs.length;
  if (n < 2) return 0;
  let sum = 0;
  let i = 0;
  while (i < n - 1) {
    const h1 = xs[i + 1] - xs[i];
    if (i + 2 <= n - 1) {
      const h2 = xs[i + 2] - xs[i + 1];
      if (Math.abs(h1 - h2) < EPS * Math.max(1, Math.abs(h1))) {
        // Simpson's rule on a uniform pair of intervals
        sum += (h1 / 3) * (ys[i] + 4 * ys[i + 1] + ys[i + 2]);
        i += 2;
        continue;
      }
    }
    sum += ((ys[i] + ys[i + 1]) / 2) * h1;
    i += 1;
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Section-level quantities (exact for piecewise-linear offsets)
// ---------------------------------------------------------------------------

/** Half-breadth at height z, linear interpolation, clamped to the offset range. */
export function halfBreadthAt(station: Station, z: number): number {
  const offs = station.offsets;
  if (offs.length === 0) return 0;
  if (z <= offs[0].z) {
    // below the lowest offset: hull surface starts at the keel point
    return z < offs[0].z - EPS ? 0 : offs[0].y;
  }
  for (let i = 0; i < offs.length - 1; i++) {
    const a = offs[i];
    const b = offs[i + 1];
    if (z <= b.z + EPS) {
      const t = b.z - a.z < EPS ? 0 : (z - a.z) / (b.z - a.z);
      return a.y + t * (b.y - a.y);
    }
  }
  return offs[offs.length - 1].y;
}

/**
 * Immersed section area (both sides) and its first moment about the baseline,
 * up to draft T. Exact integration of the piecewise-linear profile.
 */
export function sectionProperties(
  station: Station,
  draft: number,
): { area: number; momentZ: number } {
  const offs = station.offsets;
  let area = 0;
  let momentZ = 0;
  if (offs.length === 0 || draft <= offs[0].z + EPS) return { area, momentZ };
  for (let i = 0; i < offs.length - 1; i++) {
    const a = offs[i];
    const b = offs[i + 1];
    const zLo = a.z;
    if (zLo >= draft) break;
    const zHi = Math.min(b.z, draft);
    if (zHi <= zLo + EPS) continue;
    const yLo = halfBreadthAt(station, zLo);
    const yHi = halfBreadthAt(station, zHi);
    const dz = zHi - zLo;
    // full breadth = 2y; trapezoidal strip (exact for linear y(z))
    area += (yLo + yHi) * dz;
    // ∫ 2y·z dz over the strip with linear y(z):
    // y(z) = yLo + (yHi−yLo)·(z−zLo)/dz
    const m =
      2 *
      (yLo * (zHi * zHi - zLo * zLo) / 2 +
        ((yHi - yLo) / dz) *
          ((zHi * zHi * zHi - zLo * zLo * zLo) / 3 -
            (zLo * (zHi * zHi - zLo * zLo)) / 2));
    momentZ += m;
  }
  return { area, momentZ };
}

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

/** Geometric capacity, fluid volume/mass and free-surface moment of a box tank. */
export function tankState(tank: TankEntityData): TankState {
  const l = Math.max(0, tank.x1 - tank.x0);
  const b = Math.max(0, tank.y1 - tank.y0);
  const h = Math.max(0, tank.z1 - tank.z0);
  const capacity = l * b * h;
  const fill = Math.min(100, Math.max(0, tank.fillPercent)) / 100;
  const fluidVolume = capacity * fill;
  const fluidMass = fluidVolume * tank.fluid.density;
  // Slack tank (0 < fill < 100): free-surface inertia i = l·b³/12
  const slack = fill > 1e-6 && fill < 1 - 1e-6;
  const freeSurfaceMoment = slack ? tank.fluid.density * (l * Math.pow(b, 3)) / 12 : 0;
  return { capacity, fluidVolume, fluidMass, freeSurfaceMoment };
}

// ---------------------------------------------------------------------------
// Hydrostatics
// ---------------------------------------------------------------------------

export function computeHydrostatics(
  hull: HullGeometry,
  condition: HydroCondition,
  opts: { lpp: number; beam: number; tanks?: TankEntityData[] },
): HydroResult {
  const { draft, rhoWater, kg } = condition;
  if (!(draft > 0)) throw new Error('draft must be positive');
  if (!(rhoWater > 0)) throw new Error('rhoWater must be positive');
  const stations = hull.stations;
  if (stations.length < 3) throw new Error('hull needs at least 3 stations');

  const xs = stations.map((s) => s.x);

  // Per-station immersed properties
  const areas: number[] = [];
  const momentsZ: number[] = [];
  const ywl: number[] = []; // waterline half-breadth at draft
  for (const s of stations) {
    const { area, momentZ } = sectionProperties(s, draft);
    areas.push(area);
    momentsZ.push(momentZ);
    ywl.push(Math.max(0, halfBreadthAt(s, draft)));
  }

  // Volume and centres of buoyancy
  const volume = integrateSamples(xs, areas);
  if (volume < EPS) throw new Error('zero displaced volume at given draft');
  const lcb = integrateSamples(xs, areas.map((a, i) => a * xs[i])) / volume;
  const kb = integrateSamples(xs, momentsZ) / volume;

  // Waterplane properties at draft
  const awp = 2 * integrateSamples(xs, ywl);
  const mWpX = 2 * integrateSamples(xs, ywl.map((y, i) => y * xs[i]));
  const lcf = awp > EPS ? mWpX / awp : 0;
  const it = (2 / 3) * integrateSamples(xs, ywl.map((y) => Math.pow(y, 3)));
  const ilAboutLcf =
    2 * integrateSamples(xs, ywl.map((y, i) => y * Math.pow(xs[i] - lcf, 2)));

  const bmt = it / volume;
  const bml = ilAboutLcf / volume;
  const kmt = kb + bmt;
  const kml = kb + bml;
  const gmtSolid = kmt - kg;
  const gml = kml - kg;

  const displacement = volume * rhoWater;

  // Free-surface correction from slack tanks
  const tanks = opts.tanks ?? [];
  let fsmSum = 0;
  let tankFluidMass = 0;
  for (const t of tanks) {
    const st = tankState(t);
    fsmSum += st.freeSurfaceMoment;
    tankFluidMass += st.fluidMass;
  }
  const fsc = displacement > EPS ? fsmSum / displacement : 0;
  const gmt = gmtSolid - fsc;

  const tpc = (awp * rhoWater) / 100;
  const mct1cm = (displacement * gml) / (100 * opts.lpp);

  // Midship section (closest station to Lpp/2)
  const xm = opts.lpp / 2;
  let midIdx = 0;
  for (let i = 1; i < stations.length; i++) {
    if (Math.abs(xs[i] - xm) < Math.abs(xs[midIdx] - xm)) midIdx = i;
  }
  const midshipArea = areas[midIdx];

  const cb = volume / (opts.lpp * opts.beam * draft);
  const cm = midshipArea / (opts.beam * draft);
  const cp = midshipArea > EPS ? volume / (midshipArea * opts.lpp) : 0;
  const cw = awp / (opts.lpp * opts.beam);

  const round = (v: number) => Math.round(v * 1e6) / 1e6;

  return {
    condition: { draft, rhoWater, kg },
    volume: round(volume),
    displacement: round(displacement),
    lcb: round(lcb),
    kb: round(kb),
    awp: round(awp),
    lcf: round(lcf),
    it: round(it),
    il: round(ilAboutLcf),
    bmt: round(bmt),
    bml: round(bml),
    kmt: round(kmt),
    kml: round(kml),
    gmtSolid: round(gmtSolid),
    fsc: round(fsc),
    gmt: round(gmt),
    gml: round(gml),
    tpc: round(tpc),
    mct1cm: round(mct1cm),
    cb: round(cb),
    cp: round(cp),
    cm: round(cm),
    cw: round(cw),
    midshipArea: round(midshipArea),
    tankFluidMass: round(tankFluidMass),
  };
}
