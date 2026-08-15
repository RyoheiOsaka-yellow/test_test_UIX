/**
 * Freeboard calculation — International Convention on Load Lines, 1966
 * (Type B ship, no superstructures, flat freeboard deck).
 *
 * The computation follows the convention's structure and shows every step:
 * tabular freeboard, block-coefficient and depth corrections, the sheer
 * deficiency addition (our generated hull has a flat deck, so the full
 * standard sheer is missing), the minimum bow height check, and the seasonal
 * marks with the fresh-water allowance.
 *
 * The Type B table is embedded at 10 m intervals over 90–200 m and
 * interpolated linearly — the convention's own table is metre-by-metre, so
 * values between grid points may differ by a few millimetres from the
 * official figures. Corrections for superstructures and trunks are zero by
 * construction (the model has none) and are listed as such rather than
 * silently omitted.
 */

import type { HydroResult } from './types.js';

/** ILLC Table B (Type B ships), freeboard [mm] at 10 m steps. */
const TABLE_B: [number, number][] = [
  [90, 1075],
  [100, 1271],
  [110, 1479],
  [120, 1690],
  [130, 1909],
  [140, 2130],
  [150, 2350],
  [160, 2560],
  [170, 2750],
  [180, 2930],
  [190, 3090],
  [200, 3264],
];

export function tabularFreeboardTypeB(lpp: number): number {
  if (lpp < TABLE_B[0][0] || lpp > TABLE_B[TABLE_B.length - 1][0]) {
    throw new Error(
      `Type B table embedded for ${TABLE_B[0][0]}–${TABLE_B[TABLE_B.length - 1][0]} m (got ${lpp})`,
    );
  }
  for (let i = 0; i < TABLE_B.length - 1; i++) {
    const [l0, f0] = TABLE_B[i];
    const [l1, f1] = TABLE_B[i + 1];
    if (lpp <= l1) return f0 + ((f1 - f0) * (lpp - l0)) / (l1 - l0);
  }
  return TABLE_B[TABLE_B.length - 1][1];
}

/** Standard sheer profile mean ordinate [mm] (reg. 38): each half, weights 1-3-3-1. */
export function standardSheerMean(lpp: number): number {
  const k = lpp / 3 + 10;
  const aft = (25 * k * 1 + 11.1 * k * 3 + 2.8 * k * 3 + 0 * 1) / 8;
  const fwd = (0 * 1 + 5.6 * k * 3 + 22.2 * k * 3 + 50 * k * 1) / 8;
  return (aft + fwd) / 2;
}

export interface FreeboardInput {
  lpp: number;
  beam: number;
  depth: number;
  /** block coefficient at 0.85·D (the convention's Cb reference) */
  cb85: number;
  /** actual mean sheer of the freeboard deck [mm] (0 for a flat deck) */
  actualSheerMean?: number;
  /** water density for the FWA [t/m³] */
  rhoWater: number;
  /** displacement and TPC at the summer draft, for the FWA */
  summerDisplacement?: number;
  summerTpc?: number;
}

export interface FreeboardStep {
  label: string;
  value: number;
  unit: 'mm';
  note?: string;
}

export interface FreeboardResult {
  steps: FreeboardStep[];
  /** assigned summer freeboard [m] */
  summerFreeboard: number;
  /** summer load-line draft [m] */
  summerDraft: number;
  tropicalDraft: number;
  winterDraft: number;
  /** fresh water allowance [mm], when displacement/TPC were supplied */
  fwa: number | null;
  /** minimum bow height required / actual [m] */
  bowHeightRequired: number;
  bowHeightActual: number;
  bowHeightPassed: boolean;
}

export function computeFreeboard(input: FreeboardInput): FreeboardResult {
  const { lpp, depth } = input;
  const steps: FreeboardStep[] = [];

  const tabular = tabularFreeboardTypeB(lpp);
  steps.push({ label: '基本乾舷(Type B 表)', value: Math.round(tabular), unit: 'mm' });

  // Cb correction (reg. 30): only when Cb > 0.68
  let f = tabular;
  if (input.cb85 > 0.68) {
    const factor = (input.cb85 + 0.68) / 1.36;
    f *= factor;
    steps.push({
      label: '方形係数修正',
      value: Math.round(f - tabular),
      unit: 'mm',
      note: `Cb=${input.cb85.toFixed(3)} > 0.68 → ×${factor.toFixed(4)}`,
    });
  } else {
    steps.push({
      label: '方形係数修正',
      value: 0,
      unit: 'mm',
      note: `Cb=${input.cb85.toFixed(3)} ≤ 0.68 → 修正なし`,
    });
  }

  // depth correction (reg. 31): +R(D − L/15) when D > L/15
  const l15 = lpp / 15;
  if (depth > l15) {
    const r = lpp < 120 ? lpp / 0.48 / 1000 : 250;
    const add = r * (depth - l15);
    f += add;
    steps.push({
      label: '深さ修正',
      value: Math.round(add),
      unit: 'mm',
      note: `D=${depth} m > L/15=${l15.toFixed(2)} m, R=${lpp < 120 ? (lpp / 0.48).toFixed(0) + ' mm/m' : '250 mm/m'}`,
    });
  } else {
    steps.push({ label: '深さ修正', value: 0, unit: 'mm', note: `D ≤ L/15` });
  }

  steps.push({
    label: '船楼・トランク控除',
    value: 0,
    unit: 'mm',
    note: '船楼なしのため控除 0',
  });

  // sheer correction (reg. 38): deficiency × (0.75 − S/2L), S = 0
  const stdSheer = standardSheerMean(lpp);
  const actSheer = input.actualSheerMean ?? 0;
  const deficiency = Math.max(0, stdSheer - actSheer);
  const sheerAdd = deficiency * 0.75;
  f += sheerAdd;
  steps.push({
    label: 'シアー不足加算',
    value: Math.round(sheerAdd),
    unit: 'mm',
    note: `標準シアー平均 ${Math.round(stdSheer)} mm − 実シアー ${Math.round(actSheer)} mm, 係数 0.75`,
  });

  const summerFreeboard = f / 1000;
  const summerDraft = depth - summerFreeboard;
  const tropicalDraft = summerDraft + summerDraft / 48;
  const winterDraft = summerDraft - summerDraft / 48;

  const fwa =
    input.summerDisplacement && input.summerTpc
      ? Math.round(input.summerDisplacement / (4 * input.summerTpc))
      : null;

  // minimum bow height (reg. 39), L < 250 m
  const bowHeightRequired =
    (56 * lpp * (1 - lpp / 500) * (1.36 / (input.cb85 + 0.68))) / 1000;
  const bowHeightActual = depth - summerDraft + actSheer / 1000;
  const round3 = (v: number) => Math.round(v * 1e3) / 1e3;

  return {
    steps,
    summerFreeboard: round3(summerFreeboard),
    summerDraft: round3(summerDraft),
    tropicalDraft: round3(tropicalDraft),
    winterDraft: round3(winterDraft),
    fwa,
    bowHeightRequired: round3(bowHeightRequired),
    bowHeightActual: round3(bowHeightActual),
    bowHeightPassed: bowHeightActual >= bowHeightRequired,
  };
}

/** Cb at 0.85·D per the convention's definition, from an L0 run at that draft. */
export function cbAt85Depth(l0At85: HydroResult): number {
  return l0At85.cb;
}
