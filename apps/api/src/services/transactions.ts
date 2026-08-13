/**
 * Transaction service — the only write path into a branch.
 *
 * Semantics (Digital Dock v12, Step 2):
 *  - preview validates and reports effects WITHOUT mutating the branch projection;
 *  - commit re-checks baseVersion against the branch head under a row lock,
 *    appends immutable events, increments the branch version exactly once and
 *    updates the head projection — all in a single SQL transaction;
 *  - revert never rewrites history: it commits a new compensating transaction.
 */

import type pg from 'pg';
import type {
  BranchDto,
  Entity,
  Operation,
  PreviewEffect,
  PreviewResultDto,
  Relation,
  TransactionDto,
} from '@dock/shared';
import { withTransaction } from '../db/pool.js';
import {
  appendEvent,
  deleteEntity,
  deleteRelation,
  getBranch,
  getBranchForUpdate,
  getEntity,
  getTransaction,
  insertBranch,
  insertTransaction,
  listEntities,
  listEventsForTransaction,
  listRelations,
  markTransaction,
  setBranchHead,
  upsertEntity,
  upsertRelation,
} from '../state.js';
import {
  applyOperation,
  buildModel,
  OperationError,
  rebuildAtVersion,
  type ProjectionModel,
} from './projection.js';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class VersionConflictError extends Error {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(`base version ${expected} does not match branch head ${actual}`);
    this.name = 'VersionConflictError';
  }
}

export class TransactionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionStateError';
  }
}

export { OperationError };

interface AppliedOp {
  op: Operation;
  effect: PreviewEffect;
  /** entity kind for entity ops (needed by event payloads) */
  kind: string | null;
}

/** Apply ops to a model, capturing per-op effects and entity kinds. */
function applyAll(model: ProjectionModel, operations: Operation[]): AppliedOp[] {
  const applied: AppliedOp[] = [];
  for (const op of operations) {
    const kindBefore =
      'id' in op ? (model.entities.get(op.id)?.kind ?? null) : null;
    const effect = applyOperation(model, op);
    const kind =
      op.op === 'entity.create'
        ? op.kind
        : 'id' in op
          ? (model.entities.get(op.id)?.kind ?? kindBefore)
          : null;
    applied.push({ op, effect, kind });
  }
  return applied;
}

function eventPayload(a: AppliedOp): Record<string, unknown> {
  const { op, effect, kind } = a;
  switch (op.op) {
    case 'entity.create':
    case 'entity.update':
    case 'entity.delete':
      return { id: op.id, kind, before: effect.before, after: effect.after };
    case 'relation.create':
    case 'relation.delete':
      return { fromId: op.fromId, toId: op.toId, type: op.type };
  }
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function previewTransaction(
  branchId: string,
  operations: Operation[],
  opts: { baseVersion?: number; description?: string } = {},
): Promise<PreviewResultDto> {
  const branch = await getBranch(branchId);
  if (!branch) throw new NotFoundError(`branch ${branchId} not found`);
  const baseVersion = opts.baseVersion ?? branch.headVersion;
  if (baseVersion !== branch.headVersion) {
    throw new VersionConflictError(baseVersion, branch.headVersion);
  }
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new OperationError('transaction needs at least one operation');
  }

  // Work purely on an in-memory copy — the projection tables are not touched.
  const model = buildModel(await listEntities(branchId), await listRelations(branchId));
  let applied: AppliedOp[];
  try {
    applied = applyAll(model, operations);
  } catch (err) {
    if (err instanceof OperationError) {
      return {
        transactionId: '',
        branchId,
        baseVersion,
        effects: [],
        validation: { ok: false, errors: [err.message] },
      };
    }
    throw err;
  }

  const tx = await insertTransaction({
    branchId,
    status: 'previewed',
    baseVersion,
    description: opts.description ?? '',
    operations,
  });

  return {
    transactionId: tx.id,
    branchId,
    baseVersion,
    effects: applied.map((a) => a.effect),
    validation: { ok: true, errors: [] },
  };
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

/** Commit a previously previewed transaction. */
export async function commitTransaction(transactionId: string): Promise<TransactionDto> {
  return withTransaction(async (client) => {
    const tx = await getTransaction(transactionId, client);
    if (!tx) throw new NotFoundError(`transaction ${transactionId} not found`);
    if (tx.status !== 'previewed') {
      throw new TransactionStateError(`transaction is ${tx.status}, expected previewed`);
    }
    await commitOnClient(client, tx);
    const committed = await getTransaction(transactionId, client);
    return committed!;
  });
}

/** Preview + commit in one call (used by seeding, forks and reverts). */
export async function commitOperations(
  branchId: string,
  operations: Operation[],
  opts: {
    baseVersion?: number;
    description?: string;
    revertOfTransactionId?: string | null;
  } = {},
): Promise<TransactionDto> {
  return withTransaction(async (client) => {
    const branch = await getBranchForUpdate(branchId, client);
    if (!branch) throw new NotFoundError(`branch ${branchId} not found`);
    const tx = await insertTransaction(
      {
        branchId,
        status: 'previewed',
        baseVersion: opts.baseVersion ?? branch.headVersion,
        description: opts.description ?? '',
        operations,
        revertOfTransactionId: opts.revertOfTransactionId ?? null,
      },
      client,
    );
    await commitOnClient(client, tx, branch);
    const committed = await getTransaction(tx.id, client);
    return committed!;
  });
}

/**
 * Core commit path. Runs on an open SQL transaction; the branch row lock
 * serializes concurrent commits so the version check is race-free.
 */
async function commitOnClient(
  client: pg.PoolClient,
  tx: TransactionDto,
  lockedBranch?: BranchDto,
): Promise<void> {
  const branch = lockedBranch ?? (await getBranchForUpdate(tx.branchId, client));
  if (!branch) throw new NotFoundError(`branch ${tx.branchId} not found`);

  if (tx.baseVersion !== branch.headVersion) {
    throw new VersionConflictError(tx.baseVersion, branch.headVersion);
  }

  const model = buildModel(
    await listEntities(branch.id, {}, client),
    await listRelations(branch.id, client),
  );
  const applied = applyAll(model, tx.operations); // throws OperationError on invalid ops

  const newVersion = branch.headVersion + 1;

  // 1. append immutable events
  for (let seq = 0; seq < applied.length; seq++) {
    await appendEvent(
      {
        branchId: branch.id,
        transactionId: tx.id,
        version: newVersion,
        seq,
        type: applied[seq].op.op,
        payload: eventPayload(applied[seq]),
      },
      client,
    );
  }

  // 2. update head projection
  for (const a of applied) {
    const { op, effect } = a;
    if (op.op === 'entity.create' || op.op === 'entity.update') {
      await upsertEntity(
        branch.id,
        { id: op.id, kind: a.kind!, data: effect.after! },
        newVersion,
        client,
      );
    } else if (op.op === 'entity.delete') {
      await deleteEntity(branch.id, op.id, client);
    } else if (op.op === 'relation.create') {
      await upsertRelation(
        branch.id,
        { fromId: op.fromId, toId: op.toId, type: op.type },
        newVersion,
        client,
      );
    } else if (op.op === 'relation.delete') {
      await deleteRelation(
        branch.id,
        { fromId: op.fromId, toId: op.toId, type: op.type },
        client,
      );
    }
  }

  // 3. mark transaction committed, 4. advance the branch head exactly once
  await markTransaction(tx.id, 'committed', newVersion, client);
  await setBranchHead(branch.id, newVersion, client);
}

// ---------------------------------------------------------------------------
// Revert (compensating transaction)
// ---------------------------------------------------------------------------

export async function revertTransaction(transactionId: string): Promise<TransactionDto> {
  const original = await getTransaction(transactionId);
  if (!original) throw new NotFoundError(`transaction ${transactionId} not found`);
  if (original.status !== 'committed') {
    throw new TransactionStateError(
      `only committed transactions can be reverted (status: ${original.status})`,
    );
  }

  const events = await listEventsForTransaction(transactionId);
  const compensating: Operation[] = [];
  for (const ev of [...events].reverse()) {
    const p = ev.payload as Record<string, any>;
    switch (ev.type) {
      case 'entity.create':
        compensating.push({ op: 'entity.delete', id: p.id });
        break;
      case 'entity.update':
        compensating.push({ op: 'entity.update', id: p.id, patch: p.before, replace: true });
        break;
      case 'entity.delete':
        compensating.push({ op: 'entity.create', id: p.id, kind: p.kind, data: p.before });
        break;
      case 'relation.create':
        compensating.push({ op: 'relation.delete', fromId: p.fromId, toId: p.toId, type: p.type });
        break;
      case 'relation.delete':
        compensating.push({ op: 'relation.create', fromId: p.fromId, toId: p.toId, type: p.type });
        break;
      default:
        throw new Error(`unknown event type ${ev.type}`);
    }
  }

  return withTransaction(async (client) => {
    const branch = await getBranchForUpdate(original.branchId, client);
    if (!branch) throw new NotFoundError(`branch ${original.branchId} not found`);
    const tx = await insertTransaction(
      {
        branchId: branch.id,
        status: 'previewed',
        baseVersion: branch.headVersion,
        description: `Revert of transaction ${original.id}`,
        operations: compensating,
        revertOfTransactionId: original.id,
      },
      client,
    );
    await commitOnClient(client, tx, branch);
    // history stays intact — the original keeps its events, only the status flips
    await markTransaction(original.id, 'reverted', null, client);
    const committed = await getTransaction(tx.id, client);
    return committed!;
  });
}

// ---------------------------------------------------------------------------
// Branch fork
// ---------------------------------------------------------------------------

/**
 * Create a branch from a source branch at an exact version. The fork is
 * seeded through the normal commit path (an "import" transaction), so the new
 * branch is fully event-sourced from version 0.
 */
export async function createBranchFrom(
  sourceBranchId: string,
  name: string,
  opts: { atVersion?: number } = {},
): Promise<BranchDto> {
  const source = await getBranch(sourceBranchId);
  if (!source) throw new NotFoundError(`branch ${sourceBranchId} not found`);
  const atVersion = opts.atVersion ?? source.headVersion;
  if (atVersion < 0 || atVersion > source.headVersion) {
    throw new OperationError(
      `version ${atVersion} out of range (0..${source.headVersion})`,
    );
  }

  let entities: Entity[];
  let relations: Relation[];
  if (atVersion === source.headVersion) {
    entities = await listEntities(source.id);
    relations = await listRelations(source.id);
  } else {
    const model = await rebuildAtVersion(source.id, atVersion);
    entities = [...model.entities.values()];
    relations = [...model.relations.values()];
  }

  const ops: Operation[] = [
    ...entities.map(
      (e): Operation => ({ op: 'entity.create', id: e.id, kind: e.kind, data: e.data }),
    ),
    ...relations.map(
      (r): Operation => ({
        op: 'relation.create',
        fromId: r.fromId,
        toId: r.toId,
        type: r.type,
      }),
    ),
  ];

  const branch = await insertBranch(source.vesselId, name, source.id, atVersion);
  if (ops.length > 0) {
    await commitOperations(branch.id, ops, {
      baseVersion: 0,
      description: `Fork of branch "${source.name}" @ v${atVersion}`,
    });
  }
  const created = await getBranch(branch.id);
  return created!;
}

// ---------------------------------------------------------------------------
// Entity reads pinned to a version
// ---------------------------------------------------------------------------

export async function getEntitiesAtVersion(
  branchId: string,
  version?: number,
): Promise<{ version: number; entities: Entity[]; relations: Relation[] }> {
  const branch = await getBranch(branchId);
  if (!branch) throw new NotFoundError(`branch ${branchId} not found`);
  const v = version ?? branch.headVersion;
  if (v === branch.headVersion) {
    return {
      version: v,
      entities: await listEntities(branchId),
      relations: await listRelations(branchId),
    };
  }
  if (v < 0 || v > branch.headVersion) {
    throw new OperationError(`version ${v} out of range (0..${branch.headVersion})`);
  }
  const model = await rebuildAtVersion(branchId, v);
  return {
    version: v,
    entities: [...model.entities.values()],
    relations: [...model.relations.values()],
  };
}

export async function getEntityAt(
  branchId: string,
  semanticId: string,
  version?: number,
): Promise<Entity | null> {
  const branch = await getBranch(branchId);
  if (!branch) throw new NotFoundError(`branch ${branchId} not found`);
  if (version === undefined || version === branch.headVersion) {
    return getEntity(branchId, semanticId);
  }
  const model = await rebuildAtVersion(branchId, version);
  return model.entities.get(semanticId) ?? null;
}
