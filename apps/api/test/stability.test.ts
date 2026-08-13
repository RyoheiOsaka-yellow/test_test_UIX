process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://dock:dock@127.0.0.1:5432/digitaldock_test';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { L1Result, Operation } from '@dock/shared';
import { closePool, getPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { createProject, createVessel, getBranch, insertBranch } from '../src/state.js';
import { commitOperations, previewTransaction } from '../src/services/transactions.js';
import { runStabilityL1, L1_KIND } from '../src/services/stability.js';
import { buildInitialOperations } from '../src/seed.js';

let branchId: string;

const FAST = { heelStepDeg: 5, maxHeelDeg: 50 };

beforeAll(async () => {
  const pool = getPool();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  const project = await createProject('Stability Test Project');
  const vessel = await createVessel(project.id, 'vessel:test', 'Test Vessel');
  const main = await insertBranch(vessel.id, 'main', null, null);
  branchId = main.id;
  await commitOperations(branchId, buildInitialOperations(), { baseVersion: 0 });
});

afterAll(async () => {
  await closePool();
});

const resultOf = (d: { result: Record<string, unknown> }) => d.result as unknown as L1Result;

describe('L1 stability service', () => {
  it('solves the floating attitude from the loading condition', async () => {
    const { derived } = await runStabilityL1({ branchId, ...FAST });
    const r = resultOf(derived);
    expect(r.equilibrium.converged).toBe(true);
    expect(r.equilibrium.draftMean).toBeGreaterThan(1);
    expect(r.equilibrium.draftMean).toBeLessThan(12);
    // buoyancy balances the weight of lightship plus tank contents
    expect(Math.abs(r.equilibrium.displacement - r.totalWeight)).toBeLessThan(0.05);
    expect(derived.kind).toBe(L1_KIND);
  });

  it('produces a GZ curve and evaluates the six IMO criteria', async () => {
    const { derived } = await runStabilityL1({ branchId, ...FAST });
    const r = resultOf(derived);
    expect(r.gz.length).toBeGreaterThan(5);
    expect(r.gz.every((p) => p.converged)).toBe(true);
    expect(r.criteria.map((c) => c.id).sort()).toEqual([
      'area30', 'area30to40', 'area40', 'gm0', 'gz30', 'maxGzAngle',
    ]);
    for (const c of r.criteria) {
      expect(c.reference).toMatch(/IS Code 2008/);
      expect(c.passed).toBe(c.margin >= 0);
    }
  });

  it('reports GM consistent with the free-surface correction', async () => {
    const { derived } = await runStabilityL1({ branchId, ...FAST });
    const r = resultOf(derived);
    expect(r.fsc).toBeGreaterThan(0); // WB2 tanks are slack in the seed
    expect(Math.abs(r.gm0 - (r.gmSolid - r.fsc))).toBeLessThan(1e-6);
  });

  it('is idempotent for identical inputs and pinned to the version', async () => {
    const head = (await getBranch(branchId))!.headVersion;
    const first = await runStabilityL1({ branchId, ...FAST });
    const second = await runStabilityL1({ branchId, ...FAST });
    expect(second.cached).toBe(true);
    expect(second.derived.id).toBe(first.derived.id);
    expect(first.derived.version).toBe(head);
  });

  it('a different loading condition produces a different immutable row', async () => {
    const base = await runStabilityL1({ branchId, ...FAST });
    const loaded = await runStabilityL1({
      branchId,
      ...FAST,
      extraWeights: [{ id: 'cargo:hold1', name: 'Hold 1 cargo', mass: 2600, x: 66, y: 0, z: 6.2 }],
    });
    expect(loaded.cached).toBe(false);
    expect(loaded.derived.id).not.toBe(base.derived.id);
    expect(loaded.derived.inputHash).not.toBe(base.derived.inputHash);
    const deeper = resultOf(loaded.derived).equilibrium.draftMean;
    expect(deeper).toBeGreaterThan(resultOf(base.derived).equilibrium.draftMean);
  });

  it('a commit that raises the centre of gravity reduces GM at the new version', async () => {
    const beforeVersion = (await getBranch(branchId))!.headVersion;
    const before = resultOf((await runStabilityL1({ branchId, ...FAST })).derived);
    await commitOperations(branchId, [
      {
        op: 'entity.update',
        id: 'vessel:self',
        patch: { lightship: { mass: 2100, lcg: 54, vcg: 10.4 } },
      },
    ]);
    const after = await runStabilityL1({ branchId, ...FAST });
    expect(after.cached).toBe(false);
    expect(after.derived.version).toBe(beforeVersion + 1);
    const r = resultOf(after.derived);
    expect(r.gm0).toBeLessThan(before.gm0);
    expect(r.gzMax).toBeLessThan(before.gzMax);
  });

  it('historical versions remain analysable after the change', async () => {
    const head = (await getBranch(branchId))!.headVersion;
    const old = await runStabilityL1({ branchId, version: head - 1, ...FAST });
    expect(old.derived.version).toBe(head - 1);
    expect(resultOf(old.derived).gm0).toBeGreaterThan(
      resultOf((await runStabilityL1({ branchId, ...FAST })).derived).gm0,
    );
  });

  it('caps the area criteria at the down-flooding angle', async () => {
    const wide = await runStabilityL1({ branchId, ...FAST, floodingAngleDeg: 40 });
    const narrow = await runStabilityL1({ branchId, ...FAST, floodingAngleDeg: 30 });
    const area40 = (d: typeof wide) =>
      resultOf(d.derived).criteria.find((c) => c.id === 'area40')!.actual;
    expect(area40(narrow)).toBeLessThan(area40(wide));
    expect(resultOf(narrow.derived).floodingAngleDeg).toBe(30);
  });

  it('rejects a heel step that would miss the criteria angles', async () => {
    await expect(runStabilityL1({ branchId, heelStepDeg: 7 })).rejects.toThrow(/divide 30/);
  });

  it('refuses to run without lightship data', async () => {
    const noLightship: Operation[] = [
      {
        op: 'entity.update',
        id: 'vessel:self',
        patch: {
          kind: 'vessel',
          name: 'MV Aurora',
          principal: { lpp: 120, beam: 20, depth: 12, designDraft: 7 },
          rhoWater: 1.025,
          kg: 7.4,
        },
        replace: true,
      },
    ];
    const tx = await commitOperations(branchId, noLightship, { description: 'drop lightship' });
    expect(tx.status).toBe('committed');
    await expect(runStabilityL1({ branchId, ...FAST })).rejects.toThrow(/lightship/);
  });

  it('validates lightship data on the way in', async () => {
    const preview = await previewTransaction(branchId, [
      {
        op: 'entity.update',
        id: 'vessel:self',
        patch: { lightship: { mass: -5, lcg: 54, vcg: 7.8 } },
      },
    ]);
    expect(preview.validation.ok).toBe(false);
    expect(preview.validation.errors[0]).toMatch(/lightship.mass/);
  });
});
