/**
 * In-browser model store for the standalone viewer.
 *
 * The full product keeps authoritative state in PostgreSQL behind an
 * event-sourced transaction service. This page has no server, so it holds the
 * projection in memory and runs the same analysis engines client-side — the
 * geometry and the physics are identical, only the persistence is missing.
 */

import {
  computeFreeboard,
  computeHydrostatics,
  computeStrength,
  crossCurves,
  defaultHeelAngles,
  defaultKnDisplacements,
  demoEntities,
  evaluateWeather,
  ruleEnvelope,
  runL1,
  solveAtHeel,
  tankState,
  weightsAt,
  type DamageInput,
  type Entity,
  type EquilibriumState,
  type FreeboardResult,
  type HullEntityData,
  type HydroResult,
  type KnCurve,
  type L1Input,
  type L1Result,
  type RuleEnvelope,
  type StrengthResult,
  type TankEntityData,
  type VesselEntityData,
  type WeatherResult,
  type WeightItem,
} from '@dock/shared';

export interface Model {
  entities: Entity[];
  vessel: VesselEntityData;
  hull: HullEntityData;
  tanks: { id: string; data: TankEntityData }[];
}

export function initialModel(): Model {
  return indexModel(demoEntities());
}

export function indexModel(entities: Entity[]): Model {
  return {
    entities,
    vessel: entities.find((e) => e.kind === 'vessel')!.data as VesselEntityData,
    hull: entities.find((e) => e.kind === 'hull')!.data as HullEntityData,
    tanks: entities
      .filter((e) => e.kind === 'tank')
      .map((e) => ({ id: e.id, data: e.data as TankEntityData })),
  };
}

/** Replace one tank's payload, returning a new model. */
export function withTank(model: Model, id: string, patch: Partial<TankEntityData>): Model {
  return indexModel(
    model.entities.map((e) =>
      e.id === id ? { ...e, data: { ...(e.data as TankEntityData), ...patch } } : e,
    ),
  );
}

export interface EnvelopeIssue {
  axis: 'x' | 'y' | 'z';
  message: string;
}

/**
 * The check the server performs on every transaction: a tank may approximate
 * the hull surface, but nothing may leave the vessel envelope.
 */
export function envelopeIssues(vessel: VesselEntityData, t: TankEntityData): EnvelopeIssue[] {
  const p = vessel.principal;
  const half = p.beam / 2;
  const out: EnvelopeIssue[] = [];
  if (t.x0 < 0 || t.x1 > p.lpp) {
    out.push({ axis: 'x', message: `船長方向 ${t.x0}…${t.x1} m が 0…${p.lpp} m の外側` });
  }
  if (t.y0 < -half || t.y1 > half) {
    out.push({ axis: 'y', message: `船幅方向 ${t.y0}…${t.y1} m が ±${half} m の外側` });
  }
  if (t.z0 < 0 || t.z1 > p.depth) {
    out.push({ axis: 'z', message: `深さ方向 ${t.z0}…${t.z1} m が 0…${p.depth} m の外側` });
  }
  if (!(t.x1 > t.x0 && t.y1 > t.y0 && t.z1 > t.z0)) {
    out.push({ axis: 'x', message: '各軸の上限は下限より大きい必要があります' });
  }
  return out;
}

export function runL0(model: Model, draft: number): HydroResult | null {
  try {
    return computeHydrostatics(
      model.hull.geometry,
      { draft, rhoWater: model.vessel.rhoWater, kg: model.vessel.kg },
      {
        lpp: model.vessel.principal.lpp,
        beam: model.vessel.principal.beam,
        tanks: model.tanks.map((t) => t.data),
      },
    );
  } catch {
    return null;
  }
}

export function runStability(
  model: Model,
  extraWeights: WeightItem[],
  heelStepDeg = 2.5,
): L1Result {
  return runL1(
    model.hull.geometry,
    {
      rhoWater: model.vessel.rhoWater,
      lightship: model.vessel.lightship!,
      tanks: model.tanks,
      extraWeights,
      lpp: model.vessel.principal.lpp,
      beam: model.vessel.principal.beam,
    },
    { heelAngles: defaultHeelAngles(75, heelStepDeg) },
  );
}

export function l1InputOf(
  model: Model,
  extraWeights: WeightItem[],
  damage?: DamageInput,
): L1Input {
  return {
    rhoWater: model.vessel.rhoWater,
    lightship: model.vessel.lightship!,
    tanks: model.tanks,
    extraWeights,
    lpp: model.vessel.principal.lpp,
    beam: model.vessel.principal.beam,
    damage,
  };
}

export function runStrengthCalc(model: Model, extraWeights: WeightItem[]): StrengthResult {
  return computeStrength(model.hull.geometry, l1InputOf(model, extraWeights));
}

export function runDamage(
  model: Model,
  extraWeights: WeightItem[],
  damage: DamageInput,
): L1Result {
  return runL1(model.hull.geometry, l1InputOf(model, extraWeights, damage), {
    heelAngles: defaultHeelAngles(75, 2.5),
  });
}

export function runWeather(model: Model, l1: L1Result): WeatherResult {
  return evaluateWeather({
    hull: model.hull.geometry,
    gz: l1.gz,
    equilibrium: l1.equilibrium,
    gm0: l1.gm0,
    lpp: model.vessel.principal.lpp,
    beam: model.vessel.principal.beam,
    kg: l1.equilibrium.kg,
    floodingAngleDeg: l1.floodingAngleDeg,
  });
}

export function runKnCurves(model: Model): KnCurve[] {
  const p = model.vessel.principal;
  // sweep to the displacement at ~90% depth draft
  const maxDisp = computeHydrostatics(
    model.hull.geometry,
    { draft: p.depth * 0.9, rhoWater: model.vessel.rhoWater, kg: model.vessel.kg },
    { lpp: p.lpp, beam: p.beam },
  ).displacement;
  const w = weightsAt(l1InputOf(model, []), 0, 0);
  return crossCurves(model.hull.geometry, {
    rhoWater: model.vessel.rhoWater,
    lpp: p.lpp,
    beam: p.beam,
    lcg: w.x,
    displacements: defaultKnDisplacements(maxDisp),
    heelsDeg: [10, 20, 30, 40, 50, 60],
  });
}

/** ILLC freeboard for this hull, with the summer-draft hydro figures filled in. */
export function runFreeboardCalc(model: Model): FreeboardResult {
  const p = model.vessel.principal;
  const l0 = (draft: number) =>
    computeHydrostatics(
      model.hull.geometry,
      { draft, rhoWater: model.vessel.rhoWater, kg: model.vessel.kg },
      { lpp: p.lpp, beam: p.beam },
    );
  const cb85 = l0(0.85 * p.depth).cb;
  // freeboard is independent of draft, so one pass suffices; the summer-draft
  // hydro figures for the FWA come from a second L0 run at that draft
  const first = computeFreeboard({
    lpp: p.lpp, beam: p.beam, depth: p.depth, cb85,
    rhoWater: model.vessel.rhoWater,
  });
  const atSummer = l0(first.summerDraft);
  return computeFreeboard({
    lpp: p.lpp, beam: p.beam, depth: p.depth, cb85,
    rhoWater: model.vessel.rhoWater,
    summerDisplacement: atSummer.displacement,
    summerTpc: atSummer.tpc,
  });
}

/** Class-rule envelope defaults for this hull (Cb at the design draft). */
export function ruleDefaults(model: Model): RuleEnvelope {
  const p = model.vessel.principal;
  const cb = computeHydrostatics(
    model.hull.geometry,
    { draft: p.designDraft, rhoWater: model.vessel.rhoWater, kg: model.vessel.kg },
    { lpp: p.lpp, beam: p.beam },
  ).cb;
  return ruleEnvelope({ lpp: p.lpp, beam: p.beam, cb });
}

// ---- damage zones ----------------------------------------------------------

export interface DamageZone {
  x0: number;
  x1: number;
  permeability: number;
  y0?: number;
  y1?: number;
}

/**
 * Flooded zones for a set of selected spaces. Compartments flood full-beam;
 * tanks flood their own transverse band, so a wing-tank damage is asymmetric.
 */
export function zonesForSpaces(model: Model, ids: string[], mu: number): DamageZone[] {
  const zones: DamageZone[] = [];
  for (const id of ids) {
    const e = model.entities.find((x) => x.id === id);
    if (!e) continue;
    if (e.kind === 'compartment') {
      const d = e.data as { x0: number; x1: number };
      zones.push({ x0: d.x0, x1: d.x1, permeability: mu });
    } else if (e.kind === 'tank') {
      const d = e.data as TankEntityData;
      zones.push({ x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, permeability: mu });
    }
  }
  return zones;
}

/**
 * Model an open cross-flooding arrangement: every transversely-limited zone
 * gains its mirror image, restoring symmetry. Duplicates (a pair the user
 * already selected on both sides) are collapsed by extent.
 */
export function withCrossFlooding(zones: DamageZone[]): DamageZone[] {
  const byKey = new Map<string, DamageZone>();
  const key = (z: DamageZone) =>
    `${z.x0}|${z.x1}|${z.y0 ?? 'f'}|${z.y1 ?? 'f'}`;
  for (const z of zones) byKey.set(key(z), z);
  for (const z of zones) {
    if (z.y0 === undefined || z.y1 === undefined) continue;
    if (Math.abs(z.y0 + z.y1) < 1e-9) continue; // already symmetric about CL
    const mirrored: DamageZone = { ...z, y0: -z.y1, y1: -z.y0 };
    byKey.set(key(mirrored), mirrored);
  }
  return [...byKey.values()];
}

/** True when any zone is off-centre (the case cross-flooding exists for). */
export function hasAsymmetricZone(zones: DamageZone[]): boolean {
  return zones.some(
    (z) => z.y0 !== undefined && z.y1 !== undefined && Math.abs(z.y0 + z.y1) > 1e-9,
  );
}

/** One equilibrium solve at an imposed heel, for the 3D lever inspection. */
export function inspectHeel(
  model: Model,
  extraWeights: WeightItem[],
  heelDeg: number,
): EquilibriumState {
  return solveAtHeel(model.hull.geometry, l1InputOf(model, extraWeights), heelDeg);
}

/** Deadweight summary of the current tank contents. */
export function tankSummary(model: Model) {
  let mass = 0;
  let capacity = 0;
  let volume = 0;
  let slack = 0;
  for (const t of model.tanks) {
    const s = tankState(t.data);
    mass += s.fluidMass;
    capacity += s.capacity;
    volume += s.fluidVolume;
    if (s.freeSurfaceMoment > 0) slack += 1;
  }
  return { mass, capacity, volume, slack };
}
