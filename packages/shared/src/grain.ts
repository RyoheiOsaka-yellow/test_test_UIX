/**
 * Grain stability — International Grain Code (MSC.23(59)) intact criteria.
 *
 * Bulk grain can shift when the ship rolls. The Code postulates a surface
 * shift of 15° in filled/trimmed compartments and 25° in partly filled ones,
 * turning the free-surface transverse inertia of each grain surface into a
 * volumetric heeling moment:
 *
 *   VHM = Σ (l·b³/12)·tan δ           [m⁴]
 *   λ0  = VHM / (SF · Δ)              [m]     heeling arm at 0°
 *   λ40 = 0.8·λ0                              linear between
 *
 * Criteria (A 7):
 *   1. heel from grain shift θg ≤ 12° (or the deck-edge immersion angle,
 *      whichever is less)
 *   2. residual area between the GZ curve and the heeling-arm line, from θg
 *      to min(40°, θf, angle of maximum residual lever) ≥ 0.075 m·rad
 *   3. GM₀ (free-surface corrected) ≥ 0.30 m
 *
 * Hold surfaces here are the demo model's rectangles (full beam × hold
 * length); a real assignment would use the Code's tabulated VHMs per hold
 * and filling depth.
 */

import type { GzPoint } from './hydroL1.js';

const DEG = Math.PI / 180;

export interface GrainHold {
  id: string;
  name: string;
  /** grain surface dimensions [m] */
  length: number;
  breadth: number;
  /** filled & trimmed (15°) or partly filled (25°) */
  partlyFilled: boolean;
}

export interface GrainInput {
  holds: GrainHold[];
  /** stowage factor [m³/t] — wheat ≈ 1.25–1.35 */
  stowageFactor: number;
  displacement: number;
  gz: GzPoint[];
  gm0: number;
  /** upper bounds for the residual-area integration [deg] */
  floodingAngleDeg: number;
  deckImmersionAngleDeg: number | null;
}

export interface GrainCriterion {
  id: 'heel' | 'residual' | 'gm';
  description: string;
  actual: number;
  required: number;
  unit: string;
  passed: boolean;
}

export interface GrainResult {
  /** total volumetric heeling moment [m⁴] */
  vhm: number;
  /** heeling arms [m] */
  lambda0: number;
  lambda40: number;
  /** heel from grain shift [deg]; null when the arm never crosses GZ */
  heelAngleDeg: number | null;
  /** upper bound used for the residual area [deg] */
  residualToDeg: number;
  residualArea: number;
  criteria: GrainCriterion[];
  passed: boolean;
}

/** Heeling arm λ(θ): λ0 at 0°, 0.8·λ0 at 40°, linear, held beyond 40°. */
export function grainArm(lambda0: number, thetaDeg: number): number {
  const t = Math.min(Math.max(thetaDeg, 0), 40);
  return lambda0 * (1 - 0.005 * t); // 1 → 0.8 over 0..40°
}

function gzAt(points: GzPoint[], deg: number): number {
  if (deg <= points[0].heelDeg) return points[0].gz;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (deg <= b.heelDeg) {
      const t = (deg - a.heelDeg) / (b.heelDeg - a.heelDeg);
      return a.gz + t * (b.gz - a.gz);
    }
  }
  return points[points.length - 1].gz;
}

export function evaluateGrain(input: GrainInput): GrainResult {
  const vhm = input.holds.reduce(
    (sum, h) =>
      sum +
      ((h.length * Math.pow(h.breadth, 3)) / 12) *
        Math.tan((h.partlyFilled ? 25 : 15) * DEG),
    0,
  );
  const lambda0 = vhm / (input.stowageFactor * input.displacement);
  const lambda40 = 0.8 * lambda0;

  // θg: first crossing of GZ(θ) = λ(θ)
  const diff = (deg: number) => gzAt(input.gz, deg) - grainArm(lambda0, deg);
  let heelAngleDeg: number | null = null;
  const maxDeg = input.gz[input.gz.length - 1].heelDeg;
  let prev = diff(0);
  for (let d = 0.25; d <= maxDeg + 1e-9; d += 0.25) {
    const cur = diff(d);
    if (prev < 0 && cur >= 0) {
      heelAngleDeg = d - 0.25 * (cur / (cur - prev + 1e-12));
      break;
    }
    prev = cur;
  }
  if (diff(0) >= 0) heelAngleDeg = 0; // GZ already above the arm

  // residual area bound: min(40°, θf, angle of maximum residual lever)
  let maxResidualAt = 40;
  let best = -Infinity;
  for (let d = heelAngleDeg ?? 0; d <= Math.min(maxDeg, 60); d += 0.5) {
    const r = diff(d);
    if (r > best) {
      best = r;
      maxResidualAt = d;
    }
  }
  const residualToDeg = Math.min(40, input.floodingAngleDeg, Math.max(maxResidualAt, heelAngleDeg ?? 0));

  let residualArea = 0;
  if (heelAngleDeg !== null && residualToDeg > heelAngleDeg) {
    const n = 60;
    const h = (residualToDeg - heelAngleDeg) / n;
    let sum = Math.max(0, diff(heelAngleDeg)) + Math.max(0, diff(residualToDeg));
    for (let i = 1; i < n; i++) {
      sum += Math.max(0, diff(heelAngleDeg + i * h)) * (i % 2 === 0 ? 2 : 4);
    }
    residualArea = ((sum * h) / 3) * DEG;
  }

  const heelLimit = Math.min(12, input.deckImmersionAngleDeg ?? 12);
  const criteria: GrainCriterion[] = [
    {
      id: 'heel',
      description: `穀類移動による傾斜角(限度は 12° と甲板端没水角の小さい方)`,
      actual: round4(heelAngleDeg ?? Infinity),
      required: round4(heelLimit),
      unit: 'deg',
      passed: heelAngleDeg !== null && heelAngleDeg <= heelLimit,
    },
    {
      id: 'residual',
      description: `残存面積(θg〜${round4(residualToDeg)}°)`,
      actual: round4(residualArea),
      required: 0.075,
      unit: 'm·rad',
      passed: residualArea >= 0.075,
    },
    {
      id: 'gm',
      description: 'GM₀(自由表面修正後)',
      actual: round4(input.gm0),
      required: 0.3,
      unit: 'm',
      passed: input.gm0 >= 0.3,
    },
  ];

  return {
    vhm: round4(vhm),
    lambda0: round4(lambda0),
    lambda40: round4(lambda40),
    heelAngleDeg: heelAngleDeg === null ? null : round4(heelAngleDeg),
    residualToDeg: round4(residualToDeg),
    residualArea: round4(residualArea),
    criteria,
    passed: criteria.every((c) => c.passed),
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
