/**
 * Longitudinal strength — still-water shear force and bending moment.
 *
 * The classical loading-computer calculation:
 *
 *   load  q(x) = b(x) − w(x)      [t/m]   (net upward positive)
 *   shear Q(x) = ∫₀ˣ q dξ         [t]
 *   moment M(x) = ∫₀ˣ Q dξ        [t·m]   (sagging positive)
 *
 * Weight model
 * ------------
 *  - lightship: a trapezoid over the full length whose total mass and LCG
 *    match the lightship figures exactly (the classical "coffin diagram"
 *    simplification, stated openly rather than hidden);
 *  - tank fluids: uniform over each tank's own extent;
 *  - discrete weights: uniform over a short footprint (Lpp/20) centred on
 *    their LCG, clipped to the hull.
 *
 * Buoyancy comes from the free-trim equilibrium the L1 engine solves, so the
 * two distributions genuinely balance: total load and end moment close to
 * numerical accuracy, and the small residual is reported instead of silently
 * smeared. A linear closure correction (standard loading-computer practice)
 * is then applied so Q and M vanish identically at both perpendiculars.
 */

import { integrateSamples } from './hydro.js';
import {
  buoyancyAt,
  solveFreeEquilibrium,
  stationPolygonsOf,
  verticalInShip,
  type EquilibriumState,
  type L1Input,
} from './hydroL1.js';
import { immersedSection } from './section.js';
import type { HullGeometry } from './types.js';

export interface StrengthStation {
  x: number;
  /** weight per length [t/m] */
  weight: number;
  /** buoyancy per length [t/m] */
  buoyancy: number;
  /** net load per length, upward positive [t/m] */
  load: number;
  /** shear force [t] */
  shear: number;
  /** bending moment, sagging positive [t·m] */
  moment: number;
}

export interface StrengthResult {
  equilibrium: EquilibriumState;
  stations: StrengthStation[];
  maxShear: { x: number; value: number };
  /** most positive moment (sagging) */
  maxSagging: { x: number; value: number };
  /** most negative moment (hogging) */
  maxHogging: { x: number; value: number };
  /** closure residuals BEFORE correction, as fractions of the maxima */
  closure: { shearResidual: number; momentResidual: number };
}

/** Trapezoid w(x) = a + s·x over [0, L] with given total mass and LCG. */
export function lightshipTrapezoid(
  mass: number,
  lcg: number,
  lpp: number,
): (x: number) => number {
  // ∫w = a·L + s·L²/2 = M ; ∫w·x = a·L²/2 + s·L³/3 = M·lcg
  const L = lpp;
  const s = (12 * mass * (lcg - L / 2)) / (L * L * L);
  const a = mass / L - (s * L) / 2;
  return (x: number) => a + s * x;
}

export function computeStrength(hull: HullGeometry, input: L1Input): StrengthResult {
  const equilibrium = solveFreeEquilibrium(hull, input);
  const st = hull.stations;
  const xs = st.map((s) => s.x);
  const n = xs.length;
  const L = input.lpp;

  // ---- weight distribution -------------------------------------------------
  const lsw = lightshipTrapezoid(input.lightship.mass, input.lightship.lcg, L);
  const weight = xs.map(lsw);

  // Tributary cell of each station: half-way to its neighbours. A uniform
  // block is distributed by cell overlap, so the total mass is preserved
  // exactly regardless of how the block straddles the grid.
  const cellLo = xs.map((x, i) => (i === 0 ? x : (xs[i - 1] + x) / 2));
  const cellHi = xs.map((x, i) => (i === n - 1 ? x : (x + xs[i + 1]) / 2));
  const cellLen = xs.map((_, i) => Math.max(1e-9, cellHi[i] - cellLo[i]));

  const addUniform = (mass: number, x0: number, x1: number) => {
    const a = Math.max(0, Math.min(x0, x1));
    const b = Math.min(L, Math.max(x0, x1));
    if (b - a < 1e-9) return;
    const perM = mass / (b - a);
    for (let i = 0; i < n; i++) {
      const overlap = Math.min(b, cellHi[i]) - Math.max(a, cellLo[i]);
      if (overlap > 0) weight[i] += (perM * overlap) / cellLen[i];
    }
  };

  for (const t of input.tanks) {
    const cap =
      (t.data.x1 - t.data.x0) * (t.data.y1 - t.data.y0) * (t.data.z1 - t.data.z0);
    const mass =
      cap * (Math.min(100, Math.max(0, t.data.fillPercent)) / 100) * t.data.fluid.density;
    if (mass > 0) addUniform(mass, t.data.x0, t.data.x1);
  }
  const footprint = L / 20;
  for (const w of input.extraWeights ?? []) {
    addUniform(w.mass, w.x - footprint / 2, w.x + footprint / 2);
  }

  // ---- buoyancy distribution at the solved attitude ------------------------
  const polys = stationPolygonsOf(hull);
  const phi = (equilibrium.heelDeg * Math.PI) / 180;
  const theta = (equilibrium.trimDeg * Math.PI) / 180;
  const u = verticalInShip(phi, theta);
  const c = equilibrium.waterlineConstant;
  const buoyancy = xs.map((x, i) => {
    const sec = immersedSection(polys[i], u.y, u.z, c - u.x * x);
    return sec.area * input.rhoWater;
  });

  // ---- integrate -----------------------------------------------------------
  const load = xs.map((_, i) => buoyancy[i] - weight[i]);

  const cumulative = (ys: number[]): number[] => {
    const out = [0];
    for (let i = 1; i < n; i++) {
      out.push(out[i - 1] + ((ys[i - 1] + ys[i]) / 2) * (xs[i] - xs[i - 1]));
    }
    return out;
  };

  const shearRaw = cumulative(load);
  const maxAbsQ = Math.max(1e-9, ...shearRaw.map(Math.abs));
  const shearResidual = Math.abs(shearRaw[n - 1]) / maxAbsQ;

  // closure: remove the residual force as a uniform correction to the load
  const qCorr = shearRaw[n - 1] / L;
  const shear = shearRaw.map((q, i) => q - qCorr * xs[i]);

  const momentRaw = cumulative(shear);
  const maxAbsM = Math.max(1e-9, ...momentRaw.map(Math.abs));
  const momentResidual = Math.abs(momentRaw[n - 1]) / maxAbsM;
  // remove the residual end moment as a linear correction (zero at both ends)
  const moment = momentRaw.map((m, i) => m - (momentRaw[n - 1] * xs[i]) / L);

  const stations: StrengthStation[] = xs.map((x, i) => ({
    x,
    weight: round4(weight[i]),
    buoyancy: round4(buoyancy[i]),
    load: round4(load[i]),
    shear: round4(shear[i]),
    moment: round4(moment[i]),
  }));

  let iQ = 0;
  let iSag = 0;
  let iHog = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(shear[i]) > Math.abs(shear[iQ])) iQ = i;
    if (moment[i] > moment[iSag]) iSag = i;
    if (moment[i] < moment[iHog]) iHog = i;
  }

  return {
    equilibrium,
    stations,
    maxShear: { x: xs[iQ], value: round4(shear[iQ]) },
    maxSagging: { x: xs[iSag], value: round4(moment[iSag]) },
    maxHogging: { x: xs[iHog], value: round4(moment[iHog]) },
    closure: {
      shearResidual: round6(shearResidual),
      momentResidual: round6(momentResidual),
    },
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

// re-exported for tests
export { buoyancyAt };
export const _integrate = integrateSamples;
