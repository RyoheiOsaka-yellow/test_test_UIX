/**
 * Probabilistic damage stability — attained subdivision index A against the
 * required index R (SOLAS II-1 structure, simplified as noted).
 *
 * What is taken from the regulations verbatim:
 *   - R for cargo ships (Reg 6):  R = 1 − 128/(Ls + 152)
 *   - the survivability factor s (Reg 7-2):
 *       s = K · [ (GZmax/0.12) · (Range/16) ]^{1/4}
 *     with GZmax capped at 0.12 m, Range at 16°, and
 *       K = 1                         θe ≤ 25°
 *       K = 0                         θe ≥ 30°
 *       K = √((30 − θe)/5)            between
 *
 * What is simplified (and shown in the UI as such):
 *   - the damage-location/length statistics behind the p factors use the
 *     canonical model of a uniformly distributed damage centre and a
 *     triangular damage-length density falling to zero at Jmax = 0.24·Ls,
 *     integrated numerically over the zone arrangement — rather than the
 *     piecewise-polynomial p(x1, x2) tables of Reg 7-1;
 *   - A is evaluated at the current loading condition instead of the
 *     regulation's three-draught weighting (0.4 ds + 0.4 dp + 0.2 dl);
 *   - damages are full-depth, full-beam, up to two adjacent zones.
 */

import type { DamageCase, GzPoint, L1Result } from './hydroL1.js';

export const JMAX = 0.24;

export interface SubdivisionZone {
  id: string;
  name: string;
  x0: number;
  x1: number;
  permeability: number;
}

export interface DamageCaseResult {
  zones: SubdivisionZone[];
  label: string;
  p: number;
  s: number;
  ps: number;
  /** damaged equilibrium heel [deg] */
  heelDeg: number;
  gzMax: number;
  rangeDeg: number;
  /** the solver failed to find a floating equilibrium → s = 0 */
  survives: boolean;
}

export interface SubdivisionResult {
  ls: number;
  required: number;
  attained: number;
  cases: DamageCaseResult[];
  /** probability mass of damages longer than two zones (not evaluated) */
  residualP: number;
  passed: boolean;
}

/** Required index R for cargo ships > 100 m (Reg 6). */
export function requiredIndex(ls: number): number {
  return 1 - 128 / (ls + 152);
}

/**
 * P(damage opens exactly this group of zones and nothing else), under the
 * simplified statistics: damage centre uniform along Ls, damage length with
 * a triangular density falling to zero at Jmax·Ls. A damage opens the zones
 * it overlaps, so it opens exactly the group when its aft end lies inside
 * the group's first zone and its forward end inside the last zone. At the
 * ship's ends the damage may run off the hull.
 */
export function damageProbability(
  ls: number,
  firstZone: { x0: number; x1: number },
  lastZone: { x0: number; x1: number },
): number {
  const lMax = JMAX * ls;
  const NC = 480;
  const NL = 240;
  let p = 0;
  const dl = lMax / NL;
  const dc = ls / NC;
  const foreEnd = firstZone.x0 <= 1e-9;
  const aftEnd = lastZone.x1 >= ls - 1e-9;
  for (let i = 0; i < NL; i++) {
    const l = (i + 0.5) * dl;
    const j = l / lMax;
    const fL = (2 / lMax) * (1 - j); // triangular density on length
    for (let k = 0; k < NC; k++) {
      const c = (k + 0.5) * dc;
      const x1 = c - l / 2;
      const x2 = c + l / 2;
      const loOk = (x1 >= firstZone.x0 - 1e-9 || foreEnd) && x1 < firstZone.x1 - 1e-9;
      const hiOk = (x2 <= lastZone.x1 + 1e-9 || aftEnd) && x2 > lastZone.x0 + 1e-9;
      if (loOk && hiOk) {
        p += fL * (1 / ls) * dl * dc;
      }
    }
  }
  return p;
}

/** Survivability factor s per Reg 7-2, from a damaged GZ curve. */
export function survivabilityFactor(
  gz: GzPoint[],
  equilibriumHeelDeg: number,
  floodingAngleDeg: number,
): { s: number; gzMax: number; rangeDeg: number } {
  const thetaE = Math.abs(equilibriumHeelDeg);
  // range: from equilibrium to vanishing (or the flooding bound)
  let vanish = Math.min(gz[gz.length - 1].heelDeg, floodingAngleDeg);
  let gzMax = 0;
  for (let i = 0; i < gz.length; i++) {
    const p = gz[i];
    if (p.heelDeg < thetaE) continue;
    if (p.heelDeg > floodingAngleDeg) break;
    gzMax = Math.max(gzMax, p.gz);
    if (i > 0 && gz[i - 1].gz > 0 && p.gz <= 0 && gz[i - 1].heelDeg >= thetaE) {
      const a = gz[i - 1];
      const t = a.gz / (a.gz - p.gz);
      vanish = a.heelDeg + t * (p.heelDeg - a.heelDeg);
      break;
    }
  }
  const range = Math.max(0, vanish - thetaE);

  let k: number;
  if (thetaE <= 25) k = 1;
  else if (thetaE >= 30) k = 0;
  else k = Math.sqrt((30 - thetaE) / 5);

  const s =
    k *
    Math.pow(
      (Math.min(gzMax, 0.12) / 0.12) * (Math.min(range, 16) / 16),
      1 / 4,
    );
  return { s: round4(s), gzMax: round4(gzMax), rangeDeg: round4(range) };
}

/** Build the single- and adjacent-two-zone damage cases. */
export function buildDamageCases(zones: SubdivisionZone[]): SubdivisionZone[][] {
  const cases: SubdivisionZone[][] = zones.map((z) => [z]);
  for (let i = 0; i < zones.length - 1; i++) {
    cases.push([zones[i], zones[i + 1]]);
  }
  return cases;
}

export interface SubdivisionEvaluatorDeps {
  /** damaged free-trim solve for a set of flooded zones */
  solveDamage: (damage: DamageCase[]) => L1Result;
  floodingAngleDeg: number;
}

export function evaluateSubdivision(
  ls: number,
  zones: SubdivisionZone[],
  deps: SubdivisionEvaluatorDeps,
): SubdivisionResult {
  const groups = buildDamageCases(zones);
  const cases: DamageCaseResult[] = [];
  let totalP = 0;

  for (const group of groups) {
    const p = damageProbability(ls, group[0], group[group.length - 1]);
    totalP += p;

    let s = 0;
    let heelDeg = 0;
    let gzMax = 0;
    let rangeDeg = 0;
    let survives = false;
    try {
      const damaged = deps.solveDamage(
        group.map((z) => ({ x0: z.x0, x1: z.x1, permeability: z.permeability })),
      );
      heelDeg = damaged.equilibrium.heelDeg;
      const sf = survivabilityFactor(
        damaged.gz,
        damaged.equilibrium.heelDeg,
        deps.floodingAngleDeg,
      );
      s = sf.s;
      gzMax = sf.gzMax;
      rangeDeg = sf.rangeDeg;
      survives = damaged.equilibrium.converged;
      if (!survives) s = 0;
    } catch {
      s = 0; // cannot float this damage → contributes nothing to A
    }

    cases.push({
      zones: group,
      label: group.map((z) => z.name).join(' + '),
      p: round4(p),
      s,
      ps: round4(p * s),
      heelDeg: round4(heelDeg),
      gzMax,
      rangeDeg,
      survives,
    });
  }

  const attained = cases.reduce((sum, c) => sum + c.ps, 0);
  const required = requiredIndex(ls);
  return {
    ls,
    required: round4(required),
    attained: round4(attained),
    cases,
    residualP: round4(Math.max(0, 1 - totalP)),
    passed: attained >= required,
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
