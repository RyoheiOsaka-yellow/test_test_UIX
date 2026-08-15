/**
 * Intact stability assessment against the IMO Intact Stability Code
 * (2008 IS Code, Part A, chapter 2.2 — general criteria for all ships).
 *
 * The criteria are evaluated on the free-trim GZ curve produced by the L1
 * engine. Where the Code refers to the down-flooding angle θf, this module
 * uses the value supplied with the request and falls back to 40° when none is
 * given — the deck-edge immersion angle is reported separately as information
 * and is deliberately NOT substituted for θf, since deck immersion is not by
 * itself a down-flooding event.
 */

import { halfBreadthAt, integrateSamples } from './hydro.js';
import {
  defaultHeelAngles,
  gzCurve,
  normalizeDamage,
  solveAtHeel,
  solveFreeEquilibrium,
  stationPolygonsOf,
  verticalInShip,
  type CriterionResult,
  type DamageInput,
  type EquilibriumState,
  type GzPoint,
  type L1Input,
  type L1Result,
} from './hydroL1.js';
import type { HullGeometry } from './types.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// GZ curve interrogation
// ---------------------------------------------------------------------------

/** Linear interpolation of the righting lever at an arbitrary heel. */
export function gzAt(points: GzPoint[], heelDeg: number): number {
  if (points.length === 0) return 0;
  if (heelDeg <= points[0].heelDeg) return points[0].gz;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (heelDeg <= b.heelDeg) {
      const t = (heelDeg - a.heelDeg) / (b.heelDeg - a.heelDeg);
      return a.gz + t * (b.gz - a.gz);
    }
  }
  return points[points.length - 1].gz;
}

/**
 * Area under the GZ curve between two heel angles [m·rad].
 * Sample points inside the interval are used as-is and the ends are
 * interpolated, so the bounds are honoured exactly.
 */
export function areaUnderGz(points: GzPoint[], fromDeg: number, toDeg: number): number {
  if (toDeg <= fromDeg) return 0;
  const xs: number[] = [fromDeg];
  const ys: number[] = [gzAt(points, fromDeg)];
  for (const p of points) {
    if (p.heelDeg > fromDeg + 1e-9 && p.heelDeg < toDeg - 1e-9) {
      xs.push(p.heelDeg);
      ys.push(p.gz);
    }
  }
  xs.push(toDeg);
  ys.push(gzAt(points, toDeg));
  return integrateSamples(xs.map((d) => d * DEG), ys);
}

/**
 * Maximum righting lever and the heel at which it occurs. The angle is refined
 * by fitting a parabola through the peak sample and its neighbours, so the
 * result is not quantised to the sampling step.
 */
export function maxGz(points: GzPoint[]): { gz: number; heelDeg: number } {
  if (points.length === 0) return { gz: 0, heelDeg: 0 };
  let k = 0;
  for (let i = 1; i < points.length; i++) if (points[i].gz > points[k].gz) k = i;
  if (k === 0 || k === points.length - 1) {
    return { gz: points[k].gz, heelDeg: points[k].heelDeg };
  }
  const y0 = points[k - 1].gz;
  const y1 = points[k].gz;
  const y2 = points[k + 1].gz;
  const denom = y0 - 2 * y1 + y2;
  if (Math.abs(denom) < 1e-12) return { gz: y1, heelDeg: points[k].heelDeg };
  const shift = (0.5 * (y0 - y2)) / denom; // in samples, within ±0.5
  const step = points[k + 1].heelDeg - points[k].heelDeg;
  const heelDeg = points[k].heelDeg + shift * step;
  const gz = y1 - 0.25 * (y0 - y2) * shift;
  return { gz, heelDeg };
}

/** First heel above the peak where the righting lever vanishes. */
export function vanishingAngle(points: GzPoint[]): number | null {
  const peak = maxGz(points);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (b.heelDeg <= peak.heelDeg) continue;
    if (a.gz > 0 && b.gz <= 0) {
      const t = a.gz / (a.gz - b.gz);
      return a.heelDeg + t * (b.heelDeg - a.heelDeg);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Waterplane properties at the equilibrium attitude
// ---------------------------------------------------------------------------

export interface WaterplaneProps {
  awp: number;
  it: number;
  bmt: number;
  kmt: number;
  tpc: number;
}

/**
 * Upright waterplane properties at a trimmed attitude. Each station is cut at
 * its own local waterline, so trim is accounted for exactly.
 */
export function waterplaneAt(
  hull: HullGeometry,
  state: EquilibriumState,
  rhoWater: number,
  damage?: DamageInput,
): WaterplaneProps {
  const u = verticalInShip(0, state.trimDeg * DEG);
  const xs = hull.stations.map((s) => s.x);
  const halfB = hull.stations.map((s, i) => {
    const zWl = (state.waterlineConstant - u.x * xs[i]) / u.z;
    return Math.max(0, halfBreadthAt(s, zWl));
  });
  const zones = normalizeDamage(damage);
  // per-station waterplane width and transverse inertia integrand, with each
  // flooded zone's strip removed (limited to its transverse band, if any)
  const widths: number[] = new Array(xs.length);
  const inertias: number[] = new Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const b = halfB[i];
    let w = 2 * b;
    let iy = (2 / 3) * b * b * b; // ∫ y² dy over [−b, b]
    for (const z of zones) {
      if (xs[i] < z.x0 - 1e-9 || xs[i] > z.x1 + 1e-9) continue;
      const mu = Math.min(1, Math.max(0, z.permeability));
      const lo = Math.max(z.y0 ?? -b, -b);
      const hi = Math.min(z.y1 ?? b, b);
      if (hi <= lo) continue;
      w -= mu * (hi - lo);
      iy -= (mu * (hi * hi * hi - lo * lo * lo)) / 3;
    }
    widths[i] = Math.max(0, w);
    inertias[i] = Math.max(0, iy);
  }
  const awp = integrateSamples(xs, widths);
  const it = integrateSamples(xs, inertias);
  const bmt = state.volume > 0 ? it / state.volume : 0;
  return {
    awp,
    it,
    bmt,
    kmt: state.kb + bmt,
    tpc: (awp * rhoWater) / 100,
  };
}

/**
 * Smallest clearance of the deck edge above the waterplane across all
 * stations. Negative once the deck edge is immersed.
 */
export function deckEdgeClearance(hull: HullGeometry, state: EquilibriumState): number {
  const u = verticalInShip(state.heelDeg * DEG, state.trimDeg * DEG);
  let min = Infinity;
  for (const s of hull.stations) {
    const top = s.offsets[s.offsets.length - 1];
    if (!top) continue;
    // heel is to starboard, so the +y deck edge is the low one
    const value = u.x * s.x + u.y * top.y + u.z * top.z - state.waterlineConstant;
    min = Math.min(min, value);
  }
  return Number.isFinite(min) ? min : 0;
}

// ---------------------------------------------------------------------------
// IMO criteria
// ---------------------------------------------------------------------------

function criterion(
  id: string,
  reference: string,
  description: string,
  actual: number,
  required: number,
  unit: string,
  atLeast = true,
): CriterionResult {
  const margin = atLeast ? actual - required : required - actual;
  return {
    id,
    reference,
    description,
    required,
    actual: Math.round(actual * 1e6) / 1e6,
    unit,
    atLeast,
    passed: margin >= 0,
    margin: Math.round(margin * 1e6) / 1e6,
  };
}

export interface StabilityOptions {
  /** Down-flooding angle [deg]; the area criteria are capped at min(40°, θf). */
  floodingAngleDeg?: number;
  /** Heel sampling for the GZ curve. */
  heelAngles?: number[];
}

export function evaluateCriteria(
  points: GzPoint[],
  gm0: number,
  opts: { floodingAngleDeg: number },
): CriterionResult[] {
  const theta40 = Math.min(40, opts.floodingAngleDeg);
  const peak = maxGz(points);
  return [
    criterion(
      'area30',
      'IS Code 2008 A/2.2.1',
      '復原てこ曲線下の面積(0°〜30°)',
      areaUnderGz(points, 0, 30),
      0.055,
      'm·rad',
    ),
    criterion(
      'area40',
      'IS Code 2008 A/2.2.1',
      `復原てこ曲線下の面積(0°〜${theta40}°)`,
      areaUnderGz(points, 0, theta40),
      0.09,
      'm·rad',
    ),
    criterion(
      'area30to40',
      'IS Code 2008 A/2.2.1',
      `復原てこ曲線下の面積(30°〜${theta40}°)`,
      areaUnderGz(points, 30, theta40),
      0.03,
      'm·rad',
    ),
    criterion(
      'gz30',
      'IS Code 2008 A/2.2.2',
      '30°以上における復原てこ GZ',
      gzAt(points, 30),
      0.2,
      'm',
    ),
    criterion(
      'maxGzAngle',
      'IS Code 2008 A/2.2.3',
      '最大復原てこが生じる傾斜角',
      peak.heelDeg,
      25,
      'deg',
    ),
    criterion(
      'gm0',
      'IS Code 2008 A/2.2.4',
      '初期メタセンタ高さ GM₀(自由表面修正後)',
      gm0,
      0.15,
      'm',
    ),
  ];
}

// ---------------------------------------------------------------------------
// Top-level L1 run
// ---------------------------------------------------------------------------

export function runL1(
  hull: HullGeometry,
  input: L1Input,
  opts: StabilityOptions = {},
): L1Result {
  // touch the polygon cache once so repeated solves reuse it
  stationPolygonsOf(hull);

  const equilibrium = solveFreeEquilibrium(hull, input);
  const wp = waterplaneAt(hull, equilibrium, input.rhoWater, input.damage);

  const gmSolid = wp.kmt - equilibrium.kg;
  const fsm = fsmOf(input);
  const fsc = equilibrium.displacement > 0 ? fsm / equilibrium.displacement : 0;
  const gm0 = gmSolid - fsc;

  const angles = opts.heelAngles ?? defaultHeelAngles();
  const points = gzCurve(hull, input, angles);

  const peak = maxGz(points);
  const floodingAngleDeg = opts.floodingAngleDeg ?? 40;
  const criteria = evaluateCriteria(points, gm0, { floodingAngleDeg });

  // deck immersion: first heel where the deck edge clearance turns negative
  let deckImmersionAngleDeg: number | null = null;
  let prev: { a: number; m: number } | null = null;
  for (const p of points) {
    const st = solveAtHeel(hull, input, p.heelDeg, {
      start: { c: 0, theta: p.trimDeg * DEG },
    });
    const m = deckEdgeClearance(hull, st);
    if (prev && prev.m > 0 && m <= 0) {
      deckImmersionAngleDeg = prev.a + ((p.heelDeg - prev.a) * prev.m) / (prev.m - m);
      break;
    }
    prev = { a: p.heelDeg, m };
  }

  return {
    equilibrium,
    totalWeight: round6(equilibrium.displacement),
    gmSolid: round6(gmSolid),
    fsc: round6(fsc),
    gm0: round6(gm0),
    kmt: round6(wp.kmt),
    bmt: round6(wp.bmt),
    awp: round6(wp.awp),
    tpc: round6(wp.tpc),
    gz: points,
    gzMax: round6(peak.gz),
    gzMaxAngleDeg: round6(peak.heelDeg),
    gzMaxAtRangeEdge:
      points.length > 1 && peak.heelDeg >= points[points.length - 1].heelDeg - 1e-9,
    vanishingAngleDeg: nullableRound(vanishingAngle(points)),
    deckImmersionAngleDeg: nullableRound(deckImmersionAngleDeg),
    floodingAngleDeg,
    criteria,
    allCriteriaPassed: criteria.every((c) => c.passed),
  };
}

function fsmOf(input: L1Input): number {
  let fsm = 0;
  for (const t of input.tanks) {
    const fill = t.data.fillPercent / 100;
    if (fill <= 1e-6 || fill >= 1 - 1e-6) continue;
    const l = t.data.x1 - t.data.x0;
    const b = t.data.y1 - t.data.y0;
    fsm += (t.data.fluid.density * l * b * b * b) / 12;
  }
  return fsm;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const nullableRound = (v: number | null): number | null => (v === null ? null : round6(v));
