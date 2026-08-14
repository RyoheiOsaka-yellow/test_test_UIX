/**
 * Cross curves of stability — KN(Δ, φ).
 *
 * KN is the righting lever measured from the keel (an assumed centre of
 * gravity at K), so a designer can obtain GZ for any loading condition as
 *
 *   GZ = KN − KG·sinφ    (with the free-surface-corrected KG)
 *
 * Each point is a full free-trim equilibrium solve of a rigid weight equal to
 * the displacement, placed at the given LCG with VCG = 0 — exactly the KN
 * convention — rather than a wall-sided approximation.
 */

import { solveAtHeel, type L1Input } from './hydroL1.js';
import type { HullGeometry } from './types.js';

export interface KnCurve {
  heelDeg: number;
  points: { displacement: number; kn: number; trimDeg: number }[];
}

export interface KnRequest {
  rhoWater: number;
  lpp: number;
  beam: number;
  /** LCG used for the free-trim solves (usually the condition's LCG) */
  lcg: number;
  displacements: number[];
  heelsDeg: number[];
}

export function crossCurves(hull: HullGeometry, req: KnRequest): KnCurve[] {
  const curves: KnCurve[] = req.heelsDeg.map((h) => ({ heelDeg: h, points: [] }));
  for (const disp of req.displacements) {
    const input: L1Input = {
      rhoWater: req.rhoWater,
      lightship: { mass: disp, lcg: req.lcg, vcg: 0 },
      tanks: [],
      lpp: req.lpp,
      beam: req.beam,
    };
    let warm: { c: number; theta: number } | undefined;
    for (const curve of curves) {
      const s = solveAtHeel(hull, input, curve.heelDeg, { start: warm });
      warm = { c: 0, theta: (s.trimDeg * Math.PI) / 180 };
      curve.points.push({
        displacement: disp,
        kn: Math.round(s.gz * 1e5) / 1e5, // VCG = 0 ⇒ GZ ≡ KN
        trimDeg: Math.round(s.trimDeg * 1e4) / 1e4,
      });
    }
  }
  return curves;
}

/** Sensible default sweep for a hull: 6 displacements to ~90% depth draft. */
export function defaultKnDisplacements(maxDisplacement: number): number[] {
  const out: number[] = [];
  for (let f = 0.25; f <= 1.0 + 1e-9; f += 0.15) {
    out.push(Math.round(maxDisplacement * f));
  }
  return out;
}
