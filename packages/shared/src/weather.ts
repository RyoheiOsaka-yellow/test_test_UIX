/**
 * Severe wind and rolling criterion — IMO 2008 IS Code, Part A, 2.3
 * (the "weather criterion").
 *
 * The ship is assumed to bear a steady beam wind (heeling lever lw1), roll
 * to windward by the code's rolling angle φ1 from the resulting equilibrium
 * φ0, and then be struck by a gust (lw2 = 1.5·lw1). The criterion compares
 * the capsizing-side area a with the righting-side area b under the gust
 * lever: b ≥ a.
 *
 * Inputs the code needs beyond the GZ curve — windage area and its lever,
 * roll-period coefficients — are computed from the actual hull profile and
 * the loading condition; the code's X1, X2, s tables are embedded and
 * linearly interpolated.
 */

import { halfBreadthAt, integrateSamples } from './hydro.js';
import type { EquilibriumState, GzPoint } from './hydroL1.js';
import { gzAt } from './stability.js';
import type { HullGeometry } from './types.js';

const DEG = Math.PI / 180;
const G = 9.81;
/** wind pressure, unrestricted service [Pa] */
const P_WIND = 504;

// ---- code tables (2008 IS Code, Part A, table 2.3.4) -----------------------

const X1_TABLE: [number, number][] = [
  [2.4, 1.0], [2.5, 0.98], [2.6, 0.96], [2.7, 0.95], [2.8, 0.93],
  [2.9, 0.91], [3.0, 0.9], [3.1, 0.88], [3.2, 0.86], [3.4, 0.82], [3.5, 0.8],
];
const X2_TABLE: [number, number][] = [
  [0.45, 0.75], [0.5, 0.82], [0.55, 0.89], [0.6, 0.95], [0.65, 0.97], [0.7, 1.0],
];
const S_TABLE: [number, number][] = [
  [6, 0.1], [7, 0.098], [8, 0.093], [12, 0.065], [14, 0.053],
  [16, 0.044], [18, 0.038], [20, 0.035],
];

export function interpTable(table: [number, number][], v: number): number {
  if (v <= table[0][0]) return table[0][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (v <= x1) return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0);
  }
  return table[table.length - 1][1];
}

// ---- windage from the hull profile ----------------------------------------

export interface Windage {
  /** lateral area above the waterline [m²] */
  area: number;
  /** height of its centroid above the waterline [m] */
  centroidAboveWl: number;
  /** lever Z: windage centroid to half-draft [m] */
  leverZ: number;
}

/**
 * Lateral silhouette between the deck sheer and the waterline. The code
 * measures the wind lever Z from the centre of the windage area to the
 * centre of the underwater lateral area, conventionally taken at T/2.
 */
export function windage(hull: HullGeometry, meanDraft: number): Windage {
  const xs = hull.stations.map((s) => s.x);
  const heights = hull.stations.map((s) => {
    const top = s.offsets.length ? s.offsets[s.offsets.length - 1].z : 0;
    return Math.max(0, top - meanDraft);
  });
  const area = integrateSamples(xs, heights);
  const firstMoment = integrateSamples(xs, heights.map((h) => (h * h) / 2));
  const centroidAboveWl = area > 1e-9 ? firstMoment / area : 0;
  return {
    area,
    centroidAboveWl,
    leverZ: centroidAboveWl + meanDraft / 2,
  };
}

// ---- criterion -------------------------------------------------------------

export interface WeatherInput {
  hull: HullGeometry;
  gz: GzPoint[];
  equilibrium: EquilibriumState;
  /** free-surface-corrected GM [m] */
  gm0: number;
  lpp: number;
  beam: number;
  /** corrected KG [m] — used for OG in the roll-back angle */
  kg: number;
  /** down-flooding angle bound for φ2 [deg] */
  floodingAngleDeg: number;
  /** bilge-keel factor k (1.0 for none) */
  k?: number;
}

export interface WeatherResult {
  applicable: boolean;
  /** why the criterion could not be evaluated, when applicable = false */
  reason?: string;
  windage: Windage;
  /** steady-wind heeling lever [m] */
  lw1: number;
  /** gust heeling lever [m] */
  lw2: number;
  /** equilibrium heel under steady wind [deg] */
  phi0: number;
  /** roll-back angle from the code formula [deg] */
  phi1: number;
  /** windward limit of area a [deg] */
  phiWindward: number;
  /** lee limit of area b [deg] */
  phi2: number;
  rollPeriod: number;
  factors: { x1: number; x2: number; k: number; r: number; s: number };
  /** capsizing-side area [m·rad] */
  areaA: number;
  /** righting-side area [m·rad] */
  areaB: number;
  ratio: number;
  passed: boolean;
}

export function evaluateWeather(input: WeatherInput): WeatherResult {
  const d = input.equilibrium.draftMean;
  const disp = input.equilibrium.displacement;
  const w = windage(input.hull, d);

  const fail = (reason: string): WeatherResult => ({
    applicable: false,
    reason,
    windage: w,
    lw1: 0, lw2: 0, phi0: 0, phi1: 0, phiWindward: 0, phi2: 0,
    rollPeriod: 0,
    factors: { x1: 0, x2: 0, k: input.k ?? 1, r: 0, s: 0 },
    areaA: 0, areaB: 0, ratio: 0,
    passed: false,
  });

  if (input.gm0 <= 0) return fail('GM が正でないため横揺れ周期を定義できません');
  if (disp <= 0) return fail('排水量が正ではありません');

  // levers: the code takes lw1 constant with heel
  const lw1 = (P_WIND * w.area * w.leverZ) / (1000 * G * disp);
  const lw2 = 1.5 * lw1;

  // φ0: steady-wind equilibrium — first crossing of GZ = lw1
  let phi0: number | null = null;
  for (let i = 0; i < input.gz.length - 1; i++) {
    const a = input.gz[i];
    const b = input.gz[i + 1];
    if ((a.gz - lw1) <= 0 && (b.gz - lw1) > 0) {
      const t = (lw1 - a.gz) / (b.gz - a.gz);
      phi0 = a.heelDeg + t * (b.heelDeg - a.heelDeg);
      break;
    }
    if (i === 0 && a.gz - lw1 > 0) {
      phi0 = a.heelDeg;
      break;
    }
  }
  if (phi0 === null) return fail('定常風てこ lw1 と GZ 曲線が交差しません');
  if (phi0 > 16) return fail(`定常風での傾斜 φ0 = ${phi0.toFixed(1)}° が 16° を超過(2.3.1.2 不適合)`);

  // roll-back angle φ1 (2.3.4)
  const bd = input.beam / d;
  const x1 = interpTable(X1_TABLE, bd);
  const cb = input.equilibrium.volume / (input.lpp * input.beam * d);
  const x2 = interpTable(X2_TABLE, cb);
  const og = input.kg - d;
  const r = 0.73 + (0.6 * og) / d;
  const c = 0.373 + 0.023 * bd - 0.043 * (input.lpp / 100);
  const rollPeriod = (2 * c * input.beam) / Math.sqrt(input.gm0);
  const s = interpTable(S_TABLE, rollPeriod);
  const k = input.k ?? 1;
  const phi1 = 109 * k * x1 * x2 * Math.sqrt(Math.max(0, r * s));

  const phiWindward = phi0 - phi1;
  const phi2 = Math.min(50, input.floodingAngleDeg, vanishingOr(input.gz, 50));

  // areas between GZ and the gust lever
  const net = (deg: number) => gzAt(input.gz, Math.max(0, deg)) - lw2;
  const windwardNet = (deg: number) =>
    (deg >= 0 ? gzAt(input.gz, deg) : -gzAt(input.gz, -deg)) - lw2;

  const areaA = Math.max(0, -integrate(windwardNet, phiWindward, phi0));
  const areaB = Math.max(0, integrate(net, phi0, phi2));

  const ratio = areaA > 1e-9 ? areaB / areaA : Number.POSITIVE_INFINITY;
  return {
    applicable: true,
    windage: {
      area: round4(w.area),
      centroidAboveWl: round4(w.centroidAboveWl),
      leverZ: round4(w.leverZ),
    },
    lw1: round6(lw1),
    lw2: round6(lw2),
    phi0: round4(phi0),
    phi1: round4(phi1),
    phiWindward: round4(phiWindward),
    phi2: round4(phi2),
    rollPeriod: round4(rollPeriod),
    factors: {
      x1: round4(x1),
      x2: round4(x2),
      k,
      r: round4(r),
      s: round4(s),
    },
    areaA: round6(areaA),
    areaB: round6(areaB),
    ratio: Number.isFinite(ratio) ? round4(ratio) : ratio,
    passed: areaB >= areaA,
  };
}

function vanishingOr(points: GzPoint[], fallback: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].gz > 0 && points[i + 1].gz <= 0) {
      const t = points[i].gz / (points[i].gz - points[i + 1].gz);
      return points[i].heelDeg + t * (points[i + 1].heelDeg - points[i].heelDeg);
    }
  }
  return fallback;
}

/** Simpson integration of f over [aDeg, bDeg], result in m·rad. */
function integrate(f: (deg: number) => number, aDeg: number, bDeg: number): number {
  if (bDeg <= aDeg) return 0;
  const n = 40; // even
  const h = (bDeg - aDeg) / n;
  let sum = f(aDeg) + f(bDeg);
  for (let i = 1; i < n; i++) {
    sum += f(aDeg + i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return ((sum * h) / 3) * DEG;
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
