/**
 * Hydrostatics L1 — free-trim equilibrium and large-angle (GZ) stability.
 *
 * Where L0 answers "what are the hydrostatic properties at a given draft?",
 * L1 answers "where does this ship actually float, and how much righting
 * moment does it have when heeled?".
 *
 * Attitude model
 * --------------
 * The waterplane is a plane in ship coordinates. Its unit normal is the
 * earth-vertical direction expressed in the ship frame:
 *
 *   u = (−sinθ, −sinφ·cosθ, cosφ·cosθ)
 *
 * with heel φ (starboard down positive) and trim θ (bow up positive). A point
 * p is immersed when u·p ≤ c, so one scalar c fixes the sinkage. Two more
 * useful directions follow:
 *
 *   t = (0, cosφ, sinφ)   earth-transverse, ⟂ u for any θ
 *   l = u × t             earth-longitudinal
 *
 * Equilibrium at an imposed heel means solving two residuals for (c, θ):
 *   R₁ = ρ·V − W                 (buoyancy equals weight)
 *   R₂ = (B − G)·l               (no longitudinal moment ⇒ free trim)
 * and the righting lever is then simply GZ = (B − G)·t.
 *
 * Slack tanks are handled by *actual fluid shift* — the fluid surface in each
 * tank stays horizontal in the earth frame, and its centroid is recomputed
 * exactly at every attitude — rather than by the small-angle free-surface
 * correction used in L0. The FSC is still reported for the initial GM, where
 * it is the conventional quantity.
 */

import { integrateSamples } from './hydro.js';
import { halfBreadthAt } from './hydro.js';
import { boxBelowPlane } from './polyhedron.js';
import { immersedSection, stationPolygon, type P2 } from './section.js';
import type { HullGeometry, TankEntityData } from './types.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface LightshipData {
  /** Lightship mass [t] */
  mass: number;
  /** Longitudinal centre of gravity from AP [m] */
  lcg: number;
  /** Vertical centre of gravity above baseline [m] */
  vcg: number;
  /** Transverse centre of gravity from centerline [m] */
  tcg?: number;
}

/** A discrete weight item (cargo, stores, …) in the loading condition. */
export interface WeightItem {
  id: string;
  name?: string;
  mass: number;
  /** centre of gravity in hull coordinates */
  x: number;
  y: number;
  z: number;
}

export interface IdentifiedTank {
  id: string;
  data: TankEntityData;
}

export interface L1Input {
  rhoWater: number;
  lightship: LightshipData;
  tanks: IdentifiedTank[];
  extraWeights?: WeightItem[];
  /** Lpp, used for the perpendicular drafts and trim reporting */
  lpp: number;
  beam: number;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface EquilibriumState {
  converged: boolean;
  iterations: number;
  heelDeg: number;
  trimDeg: number;
  /** Waterplane constant: a point p is immersed where u·p ≤ c. */
  waterlineConstant: number;
  /** Moulded draft at the aft perpendicular (x = 0) [m] */
  draftAP: number;
  /** Moulded draft at the forward perpendicular (x = Lpp) [m] */
  draftFP: number;
  /** Mean of the perpendicular drafts [m] */
  draftMean: number;
  /** Positive by the stern [m] */
  trimByStern: number;
  volume: number;
  displacement: number;
  lcb: number;
  tcb: number;
  kb: number;
  lcg: number;
  tcg: number;
  kg: number;
  /** Righting lever at this heel [m] */
  gz: number;
}

export interface GzPoint {
  heelDeg: number;
  gz: number;
  trimDeg: number;
  draftMean: number;
  converged: boolean;
}

export interface CriterionResult {
  id: string;
  reference: string;
  description: string;
  required: number;
  actual: number;
  unit: string;
  /** true when `actual` must be at least `required` */
  atLeast: boolean;
  passed: boolean;
  /** actual − required, signed so positive is always margin in hand */
  margin: number;
}

export interface L1Result {
  equilibrium: EquilibriumState;
  totalWeight: number;
  /** Initial metacentric height, solid and corrected for free surfaces */
  gmSolid: number;
  fsc: number;
  gm0: number;
  kmt: number;
  bmt: number;
  awp: number;
  tpc: number;
  gz: GzPoint[];
  gzMax: number;
  gzMaxAngleDeg: number;
  /** Heel at which GZ returns to zero (range of positive stability) [deg] */
  vanishingAngleDeg: number | null;
  /** Heel at which the deck edge first immerses [deg] */
  deckImmersionAngleDeg: number | null;
  /** Angle used as the upper bound for the area criteria [deg] */
  floodingAngleDeg: number;
  criteria: CriterionResult[];
  allCriteriaPassed: boolean;
}

// ---------------------------------------------------------------------------
// Attitude helpers
// ---------------------------------------------------------------------------

export interface Attitude {
  /** heel [rad], starboard down positive */
  phi: number;
  /** trim [rad], bow up positive */
  theta: number;
  /** waterplane constant: immersed where u·p ≤ c */
  c: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function verticalInShip(phi: number, theta: number): Vec3 {
  return {
    x: -Math.sin(theta),
    y: -Math.sin(phi) * Math.cos(theta),
    z: Math.cos(phi) * Math.cos(theta),
  };
}

export function transverseInShip(phi: number): Vec3 {
  return { x: 0, y: Math.cos(phi), z: Math.sin(phi) };
}

export function longitudinalInShip(phi: number, theta: number): Vec3 {
  return {
    x: -Math.cos(theta),
    y: Math.sin(theta) * Math.sin(phi),
    z: -Math.sin(theta) * Math.cos(phi),
  };
}

// ---------------------------------------------------------------------------
// Buoyancy
// ---------------------------------------------------------------------------

/**
 * Section polygons for a hull, memoised per geometry object. An L1 run solves
 * the equilibrium a few hundred times over the same offsets table, so building
 * the polygons once is worth the cache.
 */
const polygonCache = new WeakMap<HullGeometry, P2[][]>();

export function stationPolygonsOf(hull: HullGeometry): P2[][] {
  let polys = polygonCache.get(hull);
  if (!polys) {
    polys = hull.stations.map(stationPolygon);
    polygonCache.set(hull, polys);
  }
  return polys;
}

interface Buoyancy {
  volume: number;
  bx: number;
  by: number;
  bz: number;
}

/** Immersed volume and centre of buoyancy at a given attitude. */
export function buoyancyAt(
  polys: P2[][],
  xs: number[],
  att: Attitude,
): Buoyancy {
  const u = verticalInShip(att.phi, att.theta);
  const areas: number[] = new Array(xs.length);
  const my: number[] = new Array(xs.length);
  const mz: number[] = new Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const s = immersedSection(polys[i], u.y, u.z, att.c - u.x * xs[i]);
    areas[i] = s.area;
    my[i] = s.area * s.cy;
    mz[i] = s.area * s.cz;
  }
  const volume = integrateSamples(xs, areas);
  if (volume <= 0) return { volume: 0, bx: 0, by: 0, bz: 0 };
  return {
    volume,
    bx: integrateSamples(xs, areas.map((a, i) => a * xs[i])) / volume,
    by: integrateSamples(xs, my) / volume,
    bz: integrateSamples(xs, mz) / volume,
  };
}

// ---------------------------------------------------------------------------
// Weights (with actual fluid shift in slack tanks)
// ---------------------------------------------------------------------------

export interface WeightSummary {
  mass: number;
  x: number;
  y: number;
  z: number;
  /** Σ ρ·i of slack tanks, for the conventional free-surface correction [t·m] */
  freeSurfaceMoment: number;
}

/** Fluid centroid inside a box tank at the given attitude (exact). */
export function tankFluidCentroid(
  tank: TankEntityData,
  phi: number,
  theta: number,
): { mass: number; x: number; y: number; z: number; volume: number } {
  const box = { x0: tank.x0, x1: tank.x1, y0: tank.y0, y1: tank.y1, z0: tank.z0, z1: tank.z1 };
  const capacity =
    (box.x1 - box.x0) * (box.y1 - box.y0) * (box.z1 - box.z0);
  const fill = Math.min(100, Math.max(0, tank.fillPercent)) / 100;
  const target = capacity * fill;
  const mass = target * tank.fluid.density;

  if (fill <= 1e-9) {
    return { mass: 0, x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, z: box.z0, volume: 0 };
  }
  if (fill >= 1 - 1e-9) {
    return {
      mass,
      x: (box.x0 + box.x1) / 2,
      y: (box.y0 + box.y1) / 2,
      z: (box.z0 + box.z1) / 2,
      volume: target,
    };
  }

  // The fluid surface is horizontal in the earth frame: same normal as the
  // waterplane. Bisect the plane constant until the volume matches the fill.
  const u = verticalInShip(phi, theta);
  let lo = Infinity;
  let hi = -Infinity;
  for (const cx of [box.x0, box.x1]) {
    for (const cy of [box.y0, box.y1]) {
      for (const cz of [box.z0, box.z1]) {
        const v = u.x * cx + u.y * cy + u.z * cz;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  }
  let best = boxBelowPlane(box, u, (lo + hi) / 2);
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    best = boxBelowPlane(box, u, mid);
    if (best.volume > target) hi = mid;
    else lo = mid;
    if (Math.abs(best.volume - target) < 1e-12 * Math.max(1, capacity)) break;
  }
  return { mass, x: best.cx, y: best.cy, z: best.cz, volume: best.volume };
}

/** Total weight and centre of gravity at a given attitude. */
export function weightsAt(input: L1Input, phi: number, theta: number): WeightSummary {
  let mass = input.lightship.mass;
  let mx = input.lightship.mass * input.lightship.lcg;
  let my = input.lightship.mass * (input.lightship.tcg ?? 0);
  let mz = input.lightship.mass * input.lightship.vcg;
  let fsm = 0;

  for (const t of input.tanks) {
    const f = tankFluidCentroid(t.data, phi, theta);
    if (f.mass <= 0) continue;
    mass += f.mass;
    mx += f.mass * f.x;
    my += f.mass * f.y;
    mz += f.mass * f.z;
    const fill = t.data.fillPercent / 100;
    if (fill > 1e-6 && fill < 1 - 1e-6) {
      const l = t.data.x1 - t.data.x0;
      const b = t.data.y1 - t.data.y0;
      fsm += (t.data.fluid.density * l * b * b * b) / 12;
    }
  }

  for (const w of input.extraWeights ?? []) {
    mass += w.mass;
    mx += w.mass * w.x;
    my += w.mass * w.y;
    mz += w.mass * w.z;
  }

  if (mass <= 0) throw new Error('loading condition has no weight');
  return { mass, x: mx / mass, y: my / mass, z: mz / mass, freeSurfaceMoment: fsm };
}

// ---------------------------------------------------------------------------
// Equilibrium solve
// ---------------------------------------------------------------------------

export class EquilibriumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquilibriumError';
  }
}

interface SolveOpts {
  /** starting guess, used to warm-start successive heel angles */
  start?: { c: number; theta: number };
  tolVolume?: number;
  tolMoment?: number;
  maxIter?: number;
}

/**
 * Solve sinkage and trim at an imposed heel. Two-dimensional Newton with a
 * numerical Jacobian, bracketed on the sinkage so a bad Jacobian cannot walk
 * the solution out of the hull.
 */
export function solveAtHeel(
  hull: HullGeometry,
  input: L1Input,
  heelDeg: number,
  opts: SolveOpts = {},
): EquilibriumState {
  const polys = stationPolygonsOf(hull);
  const xs = hull.stations.map((s) => s.x);
  const phi = heelDeg * DEG;
  const zTop = Math.max(
    ...hull.stations.map((s) => (s.offsets.length ? s.offsets[s.offsets.length - 1].z : 0)),
  );
  const tolV = opts.tolVolume ?? 1e-7;
  const tolM = opts.tolMoment ?? 1e-7;
  const maxIter = opts.maxIter ?? 60;

  const W = weightsAt(input, phi, 0).mass;
  const targetVolume = W / input.rhoWater;

  // sinkage bracket: c spans the extreme values of u·p over the hull box
  const cRange = (theta: number): [number, number] => {
    const u = verticalInShip(phi, theta);
    let lo = Infinity;
    let hi = -Infinity;
    const yMax = input.beam;
    for (const x of [0, input.lpp]) {
      for (const y of [-yMax, yMax]) {
        for (const z of [0, zTop * 1.5]) {
          const v = u.x * x + u.y * y + u.z * z;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
    }
    return [lo, hi];
  };

  /** Sinkage for a given trim: monotone in c, so bisection is unconditionally safe. */
  const solveSinkage = (theta: number): number => {
    let [lo, hi] = cRange(theta);
    const volAt = (c: number) => buoyancyAt(polys, xs, { phi, theta, c }).volume;
    if (volAt(hi) < targetVolume) {
      throw new EquilibriumError(
        `vessel cannot float this weight: required volume ${targetVolume.toFixed(1)} m³ ` +
          `exceeds the hull capacity ${volAt(hi).toFixed(1)} m³`,
      );
    }
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      if (volAt(mid) < targetVolume) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  let theta = opts.start?.theta ?? 0;
  let c = opts.start?.c ?? solveSinkage(theta);
  let iterations = 0;
  let converged = false;

  /** Longitudinal moment residual at a trim, with the sinkage re-solved. */
  const momentResidual = (th: number): { r: number; c: number; b: Buoyancy; g: WeightSummary } => {
    const cc = solveSinkage(th);
    const b = buoyancyAt(polys, xs, { phi, theta: th, c: cc });
    const g = weightsAt(input, phi, th);
    const l = longitudinalInShip(phi, th);
    const r = (b.bx - g.x) * l.x + (b.by - g.y) * l.y + (b.bz - g.z) * l.z;
    return { r, c: cc, b, g };
  };

  // Secant on trim; the sinkage is eliminated internally by bisection, which
  // keeps the outer iteration one-dimensional and well behaved.
  let th0 = theta;
  let f0 = momentResidual(th0);
  let th1 = theta + 0.5 * DEG;
  let f1 = momentResidual(th1);
  let last = f1;

  for (iterations = 0; iterations < maxIter; iterations++) {
    if (Math.abs(f1.r) < tolM * Math.max(1, input.lpp)) {
      converged = true;
      last = f1;
      break;
    }
    const denom = f1.r - f0.r;
    let th2: number;
    if (Math.abs(denom) < 1e-15) {
      th2 = th1 + 0.1 * DEG;
    } else {
      th2 = th1 - (f1.r * (th1 - th0)) / denom;
      // keep trim physically sensible; ±25° covers any real equilibrium
      const lim = 25 * DEG;
      if (!Number.isFinite(th2)) th2 = th1;
      th2 = Math.max(-lim, Math.min(lim, th2));
    }
    th0 = th1;
    f0 = f1;
    th1 = th2;
    f1 = momentResidual(th1);
    last = f1;
  }

  theta = th1;
  c = last.c;
  const b = last.b;
  const g = last.g;
  const u = verticalInShip(phi, theta);
  const t = transverseInShip(phi);
  const gz = (b.bx - g.x) * t.x + (b.by - g.y) * t.y + (b.bz - g.z) * t.z;

  // moulded drafts on the centerline at the perpendiculars
  const draftAt = (x: number) => (c - u.x * x) / u.z;
  const draftAP = draftAt(0);
  const draftFP = draftAt(input.lpp);

  if (Math.abs(b.volume - targetVolume) > tolV * Math.max(1, targetVolume)) {
    converged = false;
  }

  return {
    converged,
    iterations,
    heelDeg,
    trimDeg: theta / DEG,
    waterlineConstant: c,
    draftAP: round6(draftAP),
    draftFP: round6(draftFP),
    draftMean: round6((draftAP + draftFP) / 2),
    trimByStern: round6(draftAP - draftFP),
    volume: round6(b.volume),
    displacement: round6(b.volume * input.rhoWater),
    lcb: round6(b.bx),
    tcb: round6(b.by),
    kb: round6(b.bz),
    lcg: round6(g.x),
    tcg: round6(g.y),
    kg: round6(g.z),
    gz: round6(gz),
  };
}

/** Free equilibrium: heel is solved for as well (non-zero only when TCG ≠ 0). */
export function solveFreeEquilibrium(hull: HullGeometry, input: L1Input): EquilibriumState {
  const upright = solveAtHeel(hull, input, 0);
  if (Math.abs(upright.gz) < 1e-6) return upright;

  // secant on heel until the righting lever vanishes
  let h0 = 0;
  let s0 = upright;
  let h1 = upright.gz > 0 ? 1 : -1;
  let s1 = solveAtHeel(hull, input, h1, { start: { c: 0, theta: s0.trimDeg * DEG } });
  for (let i = 0; i < 40; i++) {
    if (Math.abs(s1.gz) < 1e-6) return s1;
    const denom = s1.gz - s0.gz;
    if (Math.abs(denom) < 1e-15) break;
    const h2 = h1 - (s1.gz * (h1 - h0)) / denom;
    h0 = h1;
    s0 = s1;
    h1 = Math.max(-89, Math.min(89, h2));
    s1 = solveAtHeel(hull, input, h1, { start: { c: 0, theta: s0.trimDeg * DEG } });
  }
  return s1;
}

// ---------------------------------------------------------------------------
// GZ curve
// ---------------------------------------------------------------------------

export function gzCurve(
  hull: HullGeometry,
  input: L1Input,
  angles: number[],
): GzPoint[] {
  const out: GzPoint[] = [];
  let warm: { c: number; theta: number } | undefined;
  for (const a of angles) {
    const s = solveAtHeel(hull, input, a, { start: warm });
    warm = { c: 0, theta: s.trimDeg * DEG };
    out.push({
      heelDeg: a,
      gz: s.gz,
      trimDeg: round6(s.trimDeg),
      draftMean: s.draftMean,
      converged: s.converged,
    });
  }
  return out;
}

/** Default heel sampling: 2° to 60°, so 30° and 40° are exact sample points. */
export function defaultHeelAngles(maxDeg = 60, stepDeg = 2): number[] {
  const out: number[] = [];
  for (let a = 0; a <= maxDeg + 1e-9; a += stepDeg) out.push(round6(a));
  return out;
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

export { round6 as roundL1 };
