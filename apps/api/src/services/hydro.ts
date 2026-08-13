/**
 * Hydrostatics L0 service (Step 3).
 *
 * Results are persisted as immutable derived_results rows pinned to the exact
 * (vessel, branch, version) whose projection produced the inputs, keyed by a
 * canonical input hash. Re-running with identical inputs returns the stored
 * row — derived results are never recomputed in place or overwritten.
 */

import { createHash } from 'node:crypto';
import {
  canonicalStringify,
  computeHydrostatics,
  type DerivedResultDto,
  type HullEntityData,
  type HydroCondition,
  type TankEntityData,
  type VesselEntityData,
} from '@dock/shared';
import { findDerivedResult, getBranch, insertDerivedResult } from '../state.js';
import { getEntitiesAtVersion, NotFoundError, OperationError } from './transactions.js';

export const HYDRO_KIND = 'hydrostatics.L0';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface HydroRunRequest {
  branchId: string;
  /** defaults to the branch head */
  version?: number;
  /** defaults to the vessel design draft */
  draft?: number;
  /** defaults to the vessel KG */
  kg?: number;
}

export async function runHydro(req: HydroRunRequest): Promise<{
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
  const tanks = entities
    .filter((e) => e.kind === 'tank')
    .map((e) => ({ id: e.id, data: e.data as TankEntityData }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const condition: HydroCondition = {
    draft: req.draft ?? vessel.principal.designDraft,
    rhoWater: vessel.rhoWater,
    kg: req.kg ?? vessel.kg,
  };
  if (!(condition.draft > 0) || condition.draft > vessel.principal.depth) {
    throw new OperationError(
      `draft must be within (0, ${vessel.principal.depth}]`,
    );
  }

  const input = {
    kind: HYDRO_KIND,
    condition,
    lpp: vessel.principal.lpp,
    beam: vessel.principal.beam,
    geometry: hull.geometry,
    tanks: tanks.map((t) => ({
      id: t.id,
      x0: t.data.x0, x1: t.data.x1,
      y0: t.data.y0, y1: t.data.y1,
      z0: t.data.z0, z1: t.data.z1,
      fluidDensity: t.data.fluid.density,
      fillPercent: t.data.fillPercent,
    })),
  };
  const inputHash = sha256(canonicalStringify(input));

  const existing = await findDerivedResult(req.branchId, version, HYDRO_KIND, inputHash);
  if (existing) return { cached: true, derived: existing };

  const result = computeHydrostatics(hull.geometry, condition, {
    lpp: vessel.principal.lpp,
    beam: vessel.principal.beam,
    tanks: tanks.map((t) => t.data),
  });

  const derived = await insertDerivedResult({
    vesselId: branch.vesselId,
    branchId: branch.id,
    version,
    kind: HYDRO_KIND,
    inputHash,
    result: result as unknown as Record<string, unknown>,
  });
  return { cached: false, derived };
}
