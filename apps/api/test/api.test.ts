process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://dock:dock@127.0.0.1:5432/digitaldock_test';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Operation, TankEntityData } from '@dock/shared';
import { closePool, getPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import {
  createProject,
  createVessel,
  getBranch,
  getEntity,
  insertBranch,
  listEntities,
  listEvents,
  listTransactions,
} from '../src/state.js';
import {
  commitOperations,
  commitTransaction,
  createBranchFrom,
  getEntitiesAtVersion,
  previewTransaction,
  revertTransaction,
  VersionConflictError,
} from '../src/services/transactions.js';
import { runHydro } from '../src/services/hydro.js';
import { buildInitialOperations } from '../src/seed.js';

let branchId: string;
let vesselId: string;

beforeAll(async () => {
  const pool = getPool();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  const project = await createProject('Test Project');
  const vessel = await createVessel(project.id, 'vessel:test', 'Test Vessel');
  vesselId = vessel.id;
  const main = await insertBranch(vessel.id, 'main', null, null);
  branchId = main.id;
  await commitOperations(branchId, buildInitialOperations(), {
    baseVersion: 0,
    description: 'Initial import',
  });
});

afterAll(async () => {
  await closePool();
});

const resizeOp = (fill: number): Operation => ({
  op: 'entity.update',
  id: 'tank:WB2.P',
  patch: { fillPercent: fill },
});

describe('Step 2 — preview does not mutate the branch projection', () => {
  it('leaves head version, entities and events untouched', async () => {
    const before = await getBranch(branchId);
    const preview = await previewTransaction(branchId, [resizeOp(80)], {
      description: 'preview only',
    });
    expect(preview.validation.ok).toBe(true);
    expect(preview.effects).toHaveLength(1);
    expect((preview.effects[0].after as TankEntityData).fillPercent).toBe(80);

    const after = await getBranch(branchId);
    expect(after!.headVersion).toBe(before!.headVersion);
    const tank = await getEntity(branchId, 'tank:WB2.P');
    expect((tank!.data as TankEntityData).fillPercent).toBe(35); // unchanged
    const events = await listEvents(branchId);
    expect(events.every((e) => e.transactionId !== preview.transactionId)).toBe(true);
  });

  it('rejects a tank dragged outside the vessel envelope', async () => {
    const preview = await previewTransaction(branchId, [
      { op: 'entity.update', id: 'tank:WB2.P', patch: { z0: 10.1, z1: 13.5 } },
    ]);
    expect(preview.validation.ok).toBe(false);
    expect(preview.validation.errors[0]).toMatch(/leaves the vessel envelope/);
    expect(preview.validation.errors[0]).toMatch(/z 10.1…13.5 outside 0…12/);
  });

  it('accepts a tank moved to a valid position inside the envelope', async () => {
    const preview = await previewTransaction(branchId, [
      { op: 'entity.update', id: 'tank:WB2.P', patch: { z0: 9, z1: 11.5 } },
    ]);
    expect(preview.validation.ok).toBe(true);
  });

  it('reports validation errors without creating a transaction', async () => {
    const preview = await previewTransaction(branchId, [
      { op: 'entity.update', id: 'tank:WB2.P', patch: { fillPercent: 150 } },
    ]);
    expect(preview.validation.ok).toBe(false);
    expect(preview.validation.errors[0]).toMatch(/fillPercent/);
    expect(preview.transactionId).toBe('');
  });
});

describe('Step 2 — commit semantics', () => {
  it('commits a previewed transaction: version +1, events appended, projection updated', async () => {
    const before = await getBranch(branchId);
    const preview = await previewTransaction(branchId, [resizeOp(75)], {
      description: 'fill WB2.P to 75%',
    });
    const tx = await commitTransaction(preview.transactionId);

    expect(tx.status).toBe('committed');
    expect(tx.resultVersion).toBe(before!.headVersion + 1);

    const after = await getBranch(branchId);
    expect(after!.headVersion).toBe(before!.headVersion + 1); // incremented exactly once

    const tank = await getEntity(branchId, 'tank:WB2.P');
    expect((tank!.data as TankEntityData).fillPercent).toBe(75);

    const events = await listEvents(branchId);
    const txEvents = events.filter((e) => e.transactionId === tx.id);
    expect(txEvents).toHaveLength(1);
    expect(txEvents[0].version).toBe(tx.resultVersion);
    expect((txEvents[0].payload as any).before.fillPercent).toBe(35);
    expect((txEvents[0].payload as any).after.fillPercent).toBe(75);
  });

  it('rejects a commit whose baseVersion no longer matches the head', async () => {
    const p1 = await previewTransaction(branchId, [resizeOp(50)]);
    const p2 = await previewTransaction(branchId, [resizeOp(60)]);
    await commitTransaction(p1.transactionId);
    await expect(commitTransaction(p2.transactionId)).rejects.toThrow(VersionConflictError);
    const tank = await getEntity(branchId, 'tank:WB2.P');
    expect((tank!.data as TankEntityData).fillPercent).toBe(50); // loser left no trace
  });

  it('serializes concurrent direct commits — both succeed in some order', async () => {
    const before = await getBranch(branchId);
    const [a, b] = await Promise.all([
      commitOperations(branchId, [resizeOp(10)]),
      commitOperations(branchId, [resizeOp(20)]),
    ]);
    const after = await getBranch(branchId);
    expect(after!.headVersion).toBe(before!.headVersion + 2);
    expect(new Set([a.resultVersion, b.resultVersion]).size).toBe(2);
  });

  it('events are immutable at the database level', async () => {
    const pool = getPool();
    const ev = await pool.query('SELECT id FROM events LIMIT 1');
    await expect(
      pool.query(`UPDATE events SET type = 'tampered' WHERE id = $1`, [ev.rows[0].id]),
    ).rejects.toThrow(/immutable/);
    await expect(
      pool.query('DELETE FROM events WHERE id = $1', [ev.rows[0].id]),
    ).rejects.toThrow(/immutable/);
  });
});

describe('Step 2 — revert creates a compensating transaction', () => {
  it('restores the previous state at a NEW version and keeps history intact', async () => {
    const tankBefore = await getEntity(branchId, 'tank:WB2.P');
    const fillBefore = (tankBefore!.data as TankEntityData).fillPercent;

    const tx = await commitOperations(branchId, [resizeOp(99)], { description: 'to revert' });
    const headAfterCommit = (await getBranch(branchId))!.headVersion;

    const revert = await revertTransaction(tx.id);
    expect(revert.revertOfTransactionId).toBe(tx.id);
    expect(revert.resultVersion).toBe(headAfterCommit + 1); // forward, not rewound

    const tankAfter = await getEntity(branchId, 'tank:WB2.P');
    expect((tankAfter!.data as TankEntityData).fillPercent).toBe(fillBefore);
    expect(tankAfter!.data).toEqual(tankBefore!.data); // exact restoration

    const original = (await listTransactions(branchId)).find((t) => t.id === tx.id);
    expect(original!.status).toBe('reverted');
    const events = await listEvents(branchId);
    expect(events.some((e) => e.transactionId === tx.id)).toBe(true); // history preserved
  });

  it('reverts entity creation by deleting, and restores relations', async () => {
    const ops: Operation[] = [
      {
        op: 'entity.create',
        id: 'tank:TEST.C',
        kind: 'tank',
        data: {
          kind: 'tank', name: 'Test Tank',
          x0: 60, x1: 66, y0: -2, y1: 2, z0: 2, z1: 5,
          fluid: { name: 'FW', density: 1 }, fillPercent: 40,
        },
      },
      { op: 'relation.create', fromId: 'hull:main', toId: 'tank:TEST.C', type: 'contains' },
    ];
    const tx = await commitOperations(branchId, ops);
    expect(await getEntity(branchId, 'tank:TEST.C')).not.toBeNull();

    await revertTransaction(tx.id);
    expect(await getEntity(branchId, 'tank:TEST.C')).toBeNull();
  });
});

describe('Step 2 — branches and rebuild-at-version', () => {
  it('rebuilds an exact historical projection from events', async () => {
    const head = (await getBranch(branchId))!.headVersion;
    const v1 = await getEntitiesAtVersion(branchId, 1);
    expect(v1.entities.length).toBeGreaterThan(10);
    const wb2AtV1 = v1.entities.find((e) => e.id === 'tank:WB2.P');
    expect((wb2AtV1!.data as TankEntityData).fillPercent).toBe(35); // as initially imported
    const now = await getEntitiesAtVersion(branchId, head);
    expect(now.entities.length).toBe((await listEntities(branchId)).length);
  });

  it('forks a branch whose divergence stays isolated', async () => {
    const fork = await createBranchFrom(branchId, 'what-if');
    expect(fork.parentBranchId).toBe(branchId);
    expect(fork.headVersion).toBe(1); // the import transaction

    const mainCount = (await listEntities(branchId)).length;
    expect((await listEntities(fork.id)).length).toBe(mainCount);

    await commitOperations(fork.id, [resizeOp(5)]);
    const onFork = await getEntity(fork.id, 'tank:WB2.P');
    const onMain = await getEntity(branchId, 'tank:WB2.P');
    expect((onFork!.data as TankEntityData).fillPercent).toBe(5);
    expect((onMain!.data as TankEntityData).fillPercent).not.toBe(5);
  });

  it('forks from a historical version', async () => {
    const fork = await createBranchFrom(branchId, 'from-v1', { atVersion: 1 });
    const wb2 = await getEntity(fork.id, 'tank:WB2.P');
    expect((wb2!.data as TankEntityData).fillPercent).toBe(35);
    expect(fork.forkedAtVersion).toBe(1);
  });
});

describe('Step 3 — hydrostatics as immutable derived results', () => {
  it('persists a result pinned to the exact branch version', async () => {
    const head = (await getBranch(branchId))!.headVersion;
    const { cached, derived } = await runHydro({ branchId });
    expect(cached).toBe(false);
    expect(derived.version).toBe(head);
    expect(derived.vesselId).toBe(vesselId);
    expect(derived.kind).toBe('hydrostatics.L0');
    const r = derived.result as Record<string, number>;
    expect(r.displacement).toBeGreaterThan(0);
    expect(r.gmt).toBeLessThan(r.gmtSolid); // slack WB2 tanks produce a free-surface correction
  });

  it('re-running identical inputs returns the stored row (idempotent)', async () => {
    const first = await runHydro({ branchId, draft: 6.5 });
    const second = await runHydro({ branchId, draft: 6.5 });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.derived.id).toBe(first.derived.id);
  });

  it('a new commit yields a new version and therefore a new result row', async () => {
    const before = await runHydro({ branchId });
    await commitOperations(branchId, [resizeOp(65)]);
    const after = await runHydro({ branchId });
    expect(after.cached).toBe(false);
    expect(after.derived.id).not.toBe(before.derived.id);
    expect(after.derived.version).toBe(before.derived.version + 1);
  });

  it('historical versions can be analysed and results stay separate', async () => {
    const head = (await getBranch(branchId))!.headVersion;
    const historical = await runHydro({ branchId, version: 1 });
    expect(historical.derived.version).toBe(1);
    expect(historical.derived.version).not.toBe(head);
  });

  it('derived results are immutable at the database level', async () => {
    const pool = getPool();
    const row = await pool.query('SELECT id FROM derived_results LIMIT 1');
    await expect(
      pool.query(`UPDATE derived_results SET result = '{}'::jsonb WHERE id = $1`, [row.rows[0].id]),
    ).rejects.toThrow(/immutable/);
  });
});
