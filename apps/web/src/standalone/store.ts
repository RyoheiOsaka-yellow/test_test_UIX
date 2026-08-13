/**
 * In-browser model store for the standalone viewer.
 *
 * The full product keeps authoritative state in PostgreSQL behind an
 * event-sourced transaction service. This page has no server, so it holds the
 * projection in memory and runs the same analysis engines client-side — the
 * geometry and the physics are identical, only the persistence is missing.
 */

import {
  computeHydrostatics,
  defaultHeelAngles,
  demoEntities,
  runL1,
  tankState,
  type Entity,
  type HullEntityData,
  type HydroResult,
  type L1Result,
  type TankEntityData,
  type VesselEntityData,
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
