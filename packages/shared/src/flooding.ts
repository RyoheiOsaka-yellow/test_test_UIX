/**
 * Time-domain flooding — quasi-static transient of water ingress through a
 * breach, with an optional cross-flooding duct between a port/starboard pair
 * (the MSC.362(92)-style equalization-time calculation).
 *
 * Model
 * -----
 * Added-weight method: floodwater inside each damaged space is a virtual
 * tank whose contents move with the attitude (the exact box/plane fluid
 * solve the L1 engine already uses). At every step:
 *
 *   1. solve the free equilibrium for the current floodwater masses;
 *   2. heads: the breach's submergence below the outside waterline versus
 *      the internal floodwater level above it, both along earth-vertical;
 *   3. orifice flow  Q = Cd·A·√(2g·|Δh|)  through the breach, and the same
 *      law through the duct between the paired spaces;
 *   4. advance the volumes and repeat.
 *
 * The static damage modules use lost buoyancy (the survivability
 * convention); this transient uses added weight because the quantity of
 * interest is the water actually inside at each instant.
 */

import {
  solveFreeEquilibrium,
  verticalInShip,
  type EquilibriumState,
  type IdentifiedTank,
  type L1Input,
} from './hydroL1.js';
import { boxBelowPlane } from './polyhedron.js';
import type { HullGeometry, TankEntityData } from './types.js';

const G = 9.81;
const DEG = Math.PI / 180;

export interface FloodSpace {
  id: string;
  /** box extents [m] */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  permeability: number;
}

export interface BreachSpec {
  /** breach area [m²] */
  area: number;
  /** discharge coefficient */
  cd: number;
  /** breach centre height above baseline [m] */
  z: number;
}

export interface FloodingScenario {
  /** the breached space */
  space: FloodSpace;
  breach: BreachSpec;
  /** optional equalization duct to a mirrored space */
  duct?: {
    toSpace: FloodSpace;
    area: number;
    cd: number;
    /** duct height above baseline [m] */
    z: number;
  };
  dt: number;
  tMax: number;
}

export interface FloodingSample {
  t: number;
  heelDeg: number;
  trimDeg: number;
  draftMean: number;
  /** floodwater volumes [m³] */
  volBreached: number;
  volDuct: number;
  /** head at the breach [m]; ~0 at equalization with the sea */
  headBreach: number;
}

export interface FloodingResult {
  series: FloodingSample[];
  /** first time the P/S imbalance drops under 1° after the initial heel-off */
  equalizedAt: number | null;
  /** first time the sea/internal head closes under 5 cm */
  seaLevelledAt: number | null;
  /** simulation aborted: no floating equilibrium (loss of the ship) */
  capsizedAt: number | null;
  finalState: EquilibriumState | null;
}

/** floodable volume of a space [m³] */
export function floodableVolume(s: FloodSpace): number {
  return (s.x1 - s.x0) * (s.y1 - s.y0) * (s.z1 - s.z0) * s.permeability;
}

/**
 * Virtual tank carrying `vol` m³ of seawater in a damaged space.
 *
 * With permeability μ, water of volume v occupies gross volume v/μ up to its
 * level, mixed with structure. Modelling the tank at fill v/μ with an
 * effective density ρ·μ keeps both the mass (v·ρ) and the centroid (of the
 * gross flooded volume) exact under the fluid-shift solve.
 */
function floodTank(space: FloodSpace, vol: number, rho: number): IdentifiedTank {
  const cap = (space.x1 - space.x0) * (space.y1 - space.y0) * (space.z1 - space.z0);
  const mu = Math.min(1, Math.max(1e-6, space.permeability));
  const fillPercent = Math.min(100, (100 * vol) / (mu * cap));
  const data: TankEntityData = {
    kind: 'tank',
    name: `flood:${space.id}`,
    x0: space.x0, x1: space.x1,
    y0: space.y0, y1: space.y1,
    z0: space.z0, z1: space.z1,
    fluid: { name: 'Floodwater', density: rho * mu },
    fillPercent,
  };
  return { id: `flood:${space.id}`, data };
}

/** earth-height of a point in ship coordinates at the given attitude */
function earthHeight(state: EquilibriumState, x: number, y: number, z: number): number {
  const u = verticalInShip(state.heelDeg * DEG, state.trimDeg * DEG);
  return u.x * x + u.y * y + u.z * z;
}

/** internal floodwater surface height (earth frame) inside a space */
function internalSurface(
  space: FloodSpace,
  vol: number,
  state: EquilibriumState,
  rho: number,
): number | null {
  if (vol <= 1e-9) return null;
  void rho;
  // exact level: bisection on the horizontal plane constant until the
  // box-below-plane volume matches the gross flooded volume vol/μ
  const u = verticalInShip(state.heelDeg * DEG, state.trimDeg * DEG);
  const corners: number[] = [];
  for (const cx of [space.x0, space.x1])
    for (const cy of [space.y0, space.y1])
      for (const cz of [space.z0, space.z1])
        corners.push(u.x * cx + u.y * cy + u.z * cz);
  let lo = Math.min(...corners);
  let hi = Math.max(...corners);
  const cap = (space.x1 - space.x0) * (space.y1 - space.y0) * (space.z1 - space.z0);
  const target = Math.min(vol / Math.max(1e-6, space.permeability), cap);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const v = boxBelowPlane(
      { x0: space.x0, x1: space.x1, y0: space.y0, y1: space.y1, z0: space.z0, z1: space.z1 },
      { x: u.x, y: u.y, z: u.z },
      mid,
    ).volume;
    if (v < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function simulateFlooding(
  hull: HullGeometry,
  intact: L1Input,
  scenario: FloodingScenario,
): FloodingResult {
  const rho = intact.rhoWater;
  const spaces: { space: FloodSpace; vol: number }[] = [
    { space: scenario.space, vol: 0 },
  ];
  if (scenario.duct) spaces.push({ space: scenario.duct.toSpace, vol: 0 });

  const series: FloodingSample[] = [];
  let seaLevelledAt: number | null = null;
  let capsizedAt: number | null = null;
  let lastState: EquilibriumState | null = null;

  for (let t = 0; t <= scenario.tMax + 1e-9; t += scenario.dt) {
    const input: L1Input = {
      ...intact,
      tanks: [
        ...intact.tanks,
        ...spaces.filter((s) => s.vol > 1e-9).map((s) => floodTank(s.space, s.vol, rho)),
      ],
    };
    let state: EquilibriumState;
    try {
      state = solveFreeEquilibrium(hull, input);
      if (!state.converged) throw new Error('no equilibrium');
    } catch {
      capsizedAt = t;
      break;
    }
    lastState = state;

    // heads at the breach
    const breachY = scenario.space.y1 > 0 ? scenario.space.y1 : scenario.space.y0;
    const zSea = state.waterlineConstant;
    const zBreach = earthHeight(state, (scenario.space.x0 + scenario.space.x1) / 2, breachY, scenario.breach.z);
    const inside = internalSurface(scenario.space, spaces[0].vol, state, rho);
    const extHead = Math.max(0, zSea - zBreach);
    const intHead = inside === null ? 0 : Math.max(0, inside - zBreach);
    const head = extHead - intHead;

    series.push({
      t,
      heelDeg: round4(state.heelDeg),
      trimDeg: round4(state.trimDeg),
      draftMean: round4(state.draftMean),
      volBreached: round4(spaces[0].vol),
      volDuct: round4(spaces[1]?.vol ?? 0),
      headBreach: round4(head),
    });

    if (seaLevelledAt === null && t > 0 && Math.abs(head) < 0.05) seaLevelledAt = t;

    // inflow through the breach
    const q = scenario.breach.cd * scenario.breach.area * Math.sign(head) *
      Math.sqrt(2 * G * Math.abs(head));
    spaces[0].vol = clampVol(spaces[0].vol + q * scenario.dt, scenario.space);

    // duct flow toward the mirrored space
    if (scenario.duct && spaces[1]) {
      const d = scenario.duct;
      const zDuctA = earthHeight(state, (scenario.space.x0 + scenario.space.x1) / 2, (scenario.space.y0 + scenario.space.y1) / 2, d.z);
      const zDuctB = earthHeight(state, (d.toSpace.x0 + d.toSpace.x1) / 2, (d.toSpace.y0 + d.toSpace.y1) / 2, d.z);
      const surfA = internalSurface(scenario.space, spaces[0].vol, state, rho);
      const surfB = internalSurface(d.toSpace, spaces[1].vol, state, rho);
      const headA = surfA === null ? 0 : Math.max(0, surfA - zDuctA);
      const headB = surfB === null ? 0 : Math.max(0, surfB - zDuctB);
      const dh = headA - headB;
      const qd = d.cd * d.area * Math.sign(dh) * Math.sqrt(2 * G * Math.abs(dh));
      const move = qd * scenario.dt;
      const moved = Math.min(Math.abs(move), spaces[move > 0 ? 0 : 1].vol);
      spaces[0].vol = clampVol(spaces[0].vol - Math.sign(move) * moved, scenario.space);
      spaces[1].vol = clampVol(spaces[1].vol + Math.sign(move) * moved, d.toSpace);
    }
  }

  // equalization: the first time the heel returns below 1° after its peak
  // (a duct so effective the heel never exceeds 1° equalizes at the peak)
  let equalizedAt: number | null = null;
  if (series.length) {
    let peak = 0;
    for (let i = 1; i < series.length; i++) {
      if (Math.abs(series[i].heelDeg) > Math.abs(series[peak].heelDeg)) peak = i;
    }
    if (Math.abs(series[peak].heelDeg) <= 1) {
      equalizedAt = series[peak].t;
    } else {
      for (let i = peak; i < series.length; i++) {
        if (Math.abs(series[i].heelDeg) < 1) {
          equalizedAt = series[i].t;
          break;
        }
      }
    }
  }

  return { series, equalizedAt, seaLevelledAt, capsizedAt, finalState: lastState };
}

function clampVol(v: number, space: FloodSpace): number {
  return Math.min(Math.max(0, v), floodableVolume(space));
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
