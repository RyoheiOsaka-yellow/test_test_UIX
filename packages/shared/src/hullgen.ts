/**
 * Parametric hull generator — produces a faired offsets table used for
 * seeding demo vessels and for tests. Not a design tool; the hydrostatics
 * engine integrates whatever offsets it is given.
 */

import type { HullGeometry, Station, WaterlineOffset } from './types.js';

export interface HullGenParams {
  lpp: number;
  beam: number;
  depth: number;
  /** number of stations along x (odd numbers give pure Simpson integration) */
  nStations?: number;
  /** number of waterlines per station */
  nWaterlines?: number;
  /** fraction of Lpp occupied by the bow taper */
  bowFraction?: number;
  /** fraction of Lpp occupied by the stern taper */
  sternFraction?: number;
  /** waterline taper exponent (higher = fuller ends) */
  taperExponent?: number;
  /** section fullness exponent at midship (higher = boxier sections) */
  midshipFullness?: number;
  /** section fullness exponent at the ends (lower = more V-shaped) */
  endFullness?: number;
}

/** Plan-view taper factor 0..1 along the ship. */
function planTaper(
  x: number,
  lpp: number,
  bowFrac: number,
  sternFrac: number,
  e: number,
): number {
  const bowStart = lpp * (1 - bowFrac);
  const sternEnd = lpp * sternFrac;
  let f = 1;
  if (x > bowStart) {
    const t = (x - bowStart) / (lpp - bowStart);
    f = 1 - Math.pow(t, e);
  } else if (x < sternEnd) {
    const t = (sternEnd - x) / sternEnd;
    f = 1 - Math.pow(t, e * 1.15);
  }
  return Math.max(0, f);
}

/** Section shape factor 0..1 from keel (t=0) to deck (t=1). */
function sectionShape(t: number, fullness: number): number {
  // y/Ymax = (1 - (1-t)^p): p large → wall-sided; p→1 → triangular
  return 1 - Math.pow(1 - t, fullness);
}

export function generateHull(params: HullGenParams): HullGeometry {
  const {
    lpp,
    beam,
    depth,
    nStations = 41,
    nWaterlines = 17,
    bowFraction = 0.32,
    sternFraction = 0.24,
    taperExponent = 2.2,
    midshipFullness = 3.2,
    endFullness = 1.25,
  } = params;

  const stations: Station[] = [];
  for (let i = 0; i < nStations; i++) {
    const x = (lpp * i) / (nStations - 1);
    const taper = planTaper(x, lpp, bowFraction, sternFraction, taperExponent);
    // sections get more V-shaped toward the ends
    const endness = 1 - taper;
    const fullness = midshipFullness - (midshipFullness - endFullness) * endness;
    const yMax = (beam / 2) * taper;
    const offsets: WaterlineOffset[] = [];
    for (let j = 0; j < nWaterlines; j++) {
      const z = (depth * j) / (nWaterlines - 1);
      const t = z / depth;
      const y = yMax * sectionShape(t, fullness);
      offsets.push({ z: round6(z), y: round6(y) });
    }
    stations.push({ x: round6(x), offsets });
  }
  return { stations };
}

/** Rectangular barge — analytic reference hull used by tests. */
export function generateBox(lpp: number, beam: number, depth: number, nStations = 11, nWaterlines = 5): HullGeometry {
  const stations: Station[] = [];
  for (let i = 0; i < nStations; i++) {
    const x = (lpp * i) / (nStations - 1);
    const offsets: WaterlineOffset[] = [];
    for (let j = 0; j < nWaterlines; j++) {
      const z = (depth * j) / (nWaterlines - 1);
      offsets.push({ z, y: beam / 2 });
    }
    stations.push({ x, offsets });
  }
  return { stations };
}

/** Triangular-section prism (constant V section) — analytic reference hull. */
export function generateVPrism(lpp: number, beam: number, depth: number, nStations = 11, nWaterlines = 9): HullGeometry {
  const stations: Station[] = [];
  for (let i = 0; i < nStations; i++) {
    const x = (lpp * i) / (nStations - 1);
    const offsets: WaterlineOffset[] = [];
    for (let j = 0; j < nWaterlines; j++) {
      const z = (depth * j) / (nWaterlines - 1);
      offsets.push({ z, y: (beam / 2) * (z / depth) });
    }
    stations.push({ x, offsets });
  }
  return { stations };
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
