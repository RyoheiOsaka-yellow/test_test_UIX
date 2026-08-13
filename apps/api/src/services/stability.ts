/**
 * Hydrostatics L1 service — free-trim equilibrium and IMO intact stability,
 * persisted with the same immutability contract as L0: one row per
 * (branch, version, kind, input hash), never recomputed in place.
 */

import {
  canonicalStringify,
  defaultHeelAngles,
  runL1,
  type HullEntityData,
  type L1Input,
  type TankEntityData,
  type VesselEntityData,
  type WeightItem,
  type DerivedResultDto,
} from '@dock/shared';
import { findDerivedResult, getBranch, insertDerivedResult } from '../state.js';
import { getEntitiesAtVersion, NotFoundError, OperationError } from './transactions.js';
import { sha256 } from './hydro.js';

export const L1_KIND = 'stability.L1';

export interface L1RunRequest {
  branchId: string;
  /** defaults to the branch head */
  version?: number;
  /** additional discrete weights (cargo, stores) for this loading condition */
  extraWeights?: WeightItem[];
  /** down-flooding angle [deg]; the area criteria are capped at min(40°, θf) */
  floodingAngleDeg?: number;
  /** heel sampling step for the GZ curve [deg] */
  heelStepDeg?: number;
  /** largest heel evaluated [deg] */
  maxHeelDeg?: number;
}

export async function runStabilityL1(req: L1RunRequest): Promise<{
  cached: boolean;
  derived: DerivedResultDto;
}> {
  const branch = await getBranch(req.branchId);
  if (!branch) throw new NotFoundError(`branch ${req.branchId} not found`);

  const { version, entities } = await getEntitiesAtVersion(req.branchId, req.version);

  const vessel = entities.find((e) => e.kind === 'vessel')?.data as VesselEntityData | undefined;
  const hull = entities.find((e) => e.kind === 'hull')?.data as HullEntityData | undefined;
  if (!vessel) throw new OperationError('branch has no vessel entity');
  if (!hull) throw new OperationError('branch has no hull entity');
  if (!vessel.lightship) {
    throw new OperationError(
      'vessel has no lightship data — L1 solves for the floating attitude and ' +
        'needs lightship mass, LCG and VCG',
    );
  }

  const tanks = entities
    .filter((e) => e.kind === 'tank')
    .map((e) => ({ id: e.id, data: e.data as TankEntityData }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const extraWeights = [...(req.extraWeights ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  for (const w of extraWeights) {
    if (!(w.mass > 0)) throw new OperationError(`weight ${w.id}: mass must be positive`);
    if (![w.x, w.y, w.z].every(Number.isFinite)) {
      throw new OperationError(`weight ${w.id}: centre of gravity must be finite`);
    }
  }

  const heelStepDeg = req.heelStepDeg ?? 2;
  const maxHeelDeg = req.maxHeelDeg ?? 60;
  if (heelStepDeg <= 0 || heelStepDeg > 10) {
    throw new OperationError('heelStepDeg must be within (0, 10]');
  }
  if (maxHeelDeg < 40 || maxHeelDeg > 90) {
    throw new OperationError('maxHeelDeg must be within [40, 90]');
  }
  // 30° and 40° must be sample points for the area criteria to be exact
  if (Math.abs(30 / heelStepDeg - Math.round(30 / heelStepDeg)) > 1e-9) {
    throw new OperationError('heelStepDeg must divide 30° so the criteria angles are sampled');
  }
  const floodingAngleDeg = req.floodingAngleDeg ?? 40;
  if (floodingAngleDeg <= 0 || floodingAngleDeg > 90) {
    throw new OperationError('floodingAngleDeg must be within (0, 90]');
  }

  const input: L1Input = {
    rhoWater: vessel.rhoWater,
    lightship: vessel.lightship,
    tanks,
    extraWeights,
    lpp: vessel.principal.lpp,
    beam: vessel.principal.beam,
  };

  const hashInput = {
    kind: L1_KIND,
    rhoWater: input.rhoWater,
    lightship: input.lightship,
    lpp: input.lpp,
    beam: input.beam,
    geometry: hull.geometry,
    tanks: tanks.map((t) => ({
      id: t.id,
      x0: t.data.x0, x1: t.data.x1,
      y0: t.data.y0, y1: t.data.y1,
      z0: t.data.z0, z1: t.data.z1,
      fluidDensity: t.data.fluid.density,
      fillPercent: t.data.fillPercent,
    })),
    extraWeights,
    floodingAngleDeg,
    heelStepDeg,
    maxHeelDeg,
  };
  const inputHash = sha256(canonicalStringify(hashInput));

  const existing = await findDerivedResult(req.branchId, version, L1_KIND, inputHash);
  if (existing) return { cached: true, derived: existing };

  const result = runL1(hull.geometry, input, {
    floodingAngleDeg,
    heelAngles: defaultHeelAngles(maxHeelDeg, heelStepDeg),
  });

  const derived = await insertDerivedResult({
    vesselId: branch.vesselId,
    branchId: branch.id,
    version,
    kind: L1_KIND,
    inputHash,
    result: result as unknown as Record<string, unknown>,
  });
  return { cached: false, derived };
}
