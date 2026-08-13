/**
 * Authoritative state access layer.
 *
 * v11 kept authoritative state in in-memory maps in this module; v12 replaces
 * that with PostgreSQL. Every read here goes to the database — there is no
 * process-local cache to drift out of sync.
 */

import type pg from 'pg';
import type {
  BranchDto,
  DerivedResultDto,
  Entity,
  EntityData,
  EventDto,
  ProjectDto,
  Relation,
  TransactionDto,
  VesselDto,
} from '@dock/shared';
import { getPool } from './db/pool.js';

type Queryable = pg.Pool | pg.PoolClient;

const q = (client?: Queryable): Queryable => client ?? getPool();

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

const mapProject = (r: any): ProjectDto => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at.toISOString(),
});

const mapVessel = (r: any): VesselDto => ({
  id: r.id,
  projectId: r.project_id,
  semanticId: r.semantic_id,
  name: r.name,
  createdAt: r.created_at.toISOString(),
});

const mapBranch = (r: any): BranchDto => ({
  id: r.id,
  vesselId: r.vessel_id,
  name: r.name,
  headVersion: Number(r.head_version),
  parentBranchId: r.parent_branch_id,
  forkedAtVersion: r.forked_at_version === null ? null : Number(r.forked_at_version),
  createdAt: r.created_at.toISOString(),
});

const mapTransaction = (r: any): TransactionDto => ({
  id: r.id,
  branchId: r.branch_id,
  status: r.status,
  baseVersion: Number(r.base_version),
  resultVersion: r.result_version === null ? null : Number(r.result_version),
  description: r.description,
  operations: r.operations,
  revertOfTransactionId: r.revert_of_transaction_id,
  createdAt: r.created_at.toISOString(),
  committedAt: r.committed_at ? r.committed_at.toISOString() : null,
});

const mapEvent = (r: any): EventDto => ({
  id: r.id,
  branchId: r.branch_id,
  transactionId: r.transaction_id,
  version: Number(r.version),
  seq: r.seq,
  type: r.type,
  payload: r.payload,
  createdAt: r.created_at.toISOString(),
});

const mapDerived = (r: any): DerivedResultDto => ({
  id: r.id,
  vesselId: r.vessel_id,
  branchId: r.branch_id,
  version: Number(r.version),
  kind: r.kind,
  inputHash: r.input_hash,
  result: r.result,
  createdAt: r.created_at.toISOString(),
});

const mapEntity = (r: any): Entity => ({
  id: r.semantic_id,
  kind: r.kind,
  data: r.data,
});

// ---------------------------------------------------------------------------
// Projects & vessels
// ---------------------------------------------------------------------------

export async function listProjects(client?: Queryable): Promise<ProjectDto[]> {
  const res = await q(client).query('SELECT * FROM projects ORDER BY created_at');
  return res.rows.map(mapProject);
}

export async function createProject(name: string, client?: Queryable): Promise<ProjectDto> {
  const res = await q(client).query(
    'INSERT INTO projects (name) VALUES ($1) RETURNING *',
    [name],
  );
  return mapProject(res.rows[0]);
}

export async function listVessels(projectId: string, client?: Queryable): Promise<VesselDto[]> {
  const res = await q(client).query(
    'SELECT * FROM vessels WHERE project_id = $1 ORDER BY created_at',
    [projectId],
  );
  return res.rows.map(mapVessel);
}

export async function getVessel(id: string, client?: Queryable): Promise<VesselDto | null> {
  const res = await q(client).query('SELECT * FROM vessels WHERE id = $1', [id]);
  return res.rows[0] ? mapVessel(res.rows[0]) : null;
}

export async function createVessel(
  projectId: string,
  semanticId: string,
  name: string,
  client?: Queryable,
): Promise<VesselDto> {
  const res = await q(client).query(
    'INSERT INTO vessels (project_id, semantic_id, name) VALUES ($1, $2, $3) RETURNING *',
    [projectId, semanticId, name],
  );
  return mapVessel(res.rows[0]);
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export async function getBranch(id: string, client?: Queryable): Promise<BranchDto | null> {
  const res = await q(client).query('SELECT * FROM branches WHERE id = $1', [id]);
  return res.rows[0] ? mapBranch(res.rows[0]) : null;
}

/** Lock the branch row for the duration of the surrounding SQL transaction. */
export async function getBranchForUpdate(id: string, client: pg.PoolClient): Promise<BranchDto | null> {
  const res = await client.query('SELECT * FROM branches WHERE id = $1 FOR UPDATE', [id]);
  return res.rows[0] ? mapBranch(res.rows[0]) : null;
}

export async function listBranches(vesselId: string, client?: Queryable): Promise<BranchDto[]> {
  const res = await q(client).query(
    'SELECT * FROM branches WHERE vessel_id = $1 ORDER BY created_at',
    [vesselId],
  );
  return res.rows.map(mapBranch);
}

export async function insertBranch(
  vesselId: string,
  name: string,
  parentBranchId: string | null,
  forkedAtVersion: number | null,
  client?: Queryable,
): Promise<BranchDto> {
  const res = await q(client).query(
    `INSERT INTO branches (vessel_id, name, parent_branch_id, forked_at_version)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [vesselId, name, parentBranchId, forkedAtVersion],
  );
  return mapBranch(res.rows[0]);
}

export async function setBranchHead(
  branchId: string,
  headVersion: number,
  client: pg.PoolClient,
): Promise<void> {
  await client.query('UPDATE branches SET head_version = $2 WHERE id = $1', [
    branchId,
    headVersion,
  ]);
}

// ---------------------------------------------------------------------------
// Transactions & events
// ---------------------------------------------------------------------------

export async function insertTransaction(
  fields: {
    branchId: string;
    status: string;
    baseVersion: number;
    description: string;
    operations: unknown;
    revertOfTransactionId?: string | null;
  },
  client?: Queryable,
): Promise<TransactionDto> {
  const res = await q(client).query(
    `INSERT INTO transactions (branch_id, status, base_version, description, operations, revert_of_transaction_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *`,
    [
      fields.branchId,
      fields.status,
      fields.baseVersion,
      fields.description,
      JSON.stringify(fields.operations),
      fields.revertOfTransactionId ?? null,
    ],
  );
  return mapTransaction(res.rows[0]);
}

export async function getTransaction(id: string, client?: Queryable): Promise<TransactionDto | null> {
  const res = await q(client).query('SELECT * FROM transactions WHERE id = $1', [id]);
  return res.rows[0] ? mapTransaction(res.rows[0]) : null;
}

export async function listTransactions(branchId: string, client?: Queryable): Promise<TransactionDto[]> {
  const res = await q(client).query(
    'SELECT * FROM transactions WHERE branch_id = $1 ORDER BY created_at DESC',
    [branchId],
  );
  return res.rows.map(mapTransaction);
}

export async function markTransaction(
  id: string,
  status: string,
  resultVersion: number | null,
  client: pg.PoolClient,
): Promise<void> {
  await client.query(
    `UPDATE transactions
       SET status = $2,
           result_version = COALESCE($3, result_version),
           committed_at = CASE WHEN $2 = 'committed' THEN now() ELSE committed_at END
     WHERE id = $1`,
    [id, status, resultVersion],
  );
}

export async function appendEvent(
  fields: {
    branchId: string;
    transactionId: string;
    version: number;
    seq: number;
    type: string;
    payload: unknown;
  },
  client: pg.PoolClient,
): Promise<void> {
  await client.query(
    `INSERT INTO events (branch_id, transaction_id, version, seq, type, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      fields.branchId,
      fields.transactionId,
      fields.version,
      fields.seq,
      fields.type,
      JSON.stringify(fields.payload),
    ],
  );
}

export async function listEvents(
  branchId: string,
  opts: { toVersion?: number } = {},
  client?: Queryable,
): Promise<EventDto[]> {
  const res = opts.toVersion === undefined
    ? await q(client).query(
        'SELECT * FROM events WHERE branch_id = $1 ORDER BY version, seq',
        [branchId],
      )
    : await q(client).query(
        'SELECT * FROM events WHERE branch_id = $1 AND version <= $2 ORDER BY version, seq',
        [branchId, opts.toVersion],
      );
  return res.rows.map(mapEvent);
}

export async function listEventsForTransaction(
  transactionId: string,
  client?: Queryable,
): Promise<EventDto[]> {
  const res = await q(client).query(
    'SELECT * FROM events WHERE transaction_id = $1 ORDER BY seq',
    [transactionId],
  );
  return res.rows.map(mapEvent);
}

// ---------------------------------------------------------------------------
// Projection: entities & relations (branch head)
// ---------------------------------------------------------------------------

export async function listEntities(
  branchId: string,
  opts: { kind?: string } = {},
  client?: Queryable,
): Promise<Entity[]> {
  const res = opts.kind
    ? await q(client).query(
        'SELECT * FROM entities WHERE branch_id = $1 AND kind = $2 ORDER BY semantic_id',
        [branchId, opts.kind],
      )
    : await q(client).query(
        'SELECT * FROM entities WHERE branch_id = $1 ORDER BY semantic_id',
        [branchId],
      );
  return res.rows.map(mapEntity);
}

export async function getEntity(
  branchId: string,
  semanticId: string,
  client?: Queryable,
): Promise<Entity | null> {
  const res = await q(client).query(
    'SELECT * FROM entities WHERE branch_id = $1 AND semantic_id = $2',
    [branchId, semanticId],
  );
  return res.rows[0] ? mapEntity(res.rows[0]) : null;
}

export async function upsertEntity(
  branchId: string,
  entity: { id: string; kind: string; data: EntityData },
  version: number,
  client: pg.PoolClient,
): Promise<void> {
  await client.query(
    `INSERT INTO entities (branch_id, semantic_id, kind, data, created_version, updated_version)
     VALUES ($1, $2, $3, $4::jsonb, $5, $5)
     ON CONFLICT (branch_id, semantic_id)
     DO UPDATE SET kind = $3, data = $4::jsonb, updated_version = $5`,
    [branchId, entity.id, entity.kind, JSON.stringify(entity.data), version],
  );
}

export async function deleteEntity(
  branchId: string,
  semanticId: string,
  client: pg.PoolClient,
): Promise<void> {
  await client.query('DELETE FROM entities WHERE branch_id = $1 AND semantic_id = $2', [
    branchId,
    semanticId,
  ]);
}

export async function listRelations(branchId: string, client?: Queryable): Promise<Relation[]> {
  const res = await q(client).query(
    'SELECT * FROM relations WHERE branch_id = $1 ORDER BY from_id, to_id, type',
    [branchId],
  );
  return res.rows.map((r: any) => ({ fromId: r.from_id, toId: r.to_id, type: r.type }));
}

export async function upsertRelation(
  branchId: string,
  rel: Relation,
  version: number,
  client: pg.PoolClient,
): Promise<void> {
  await client.query(
    `INSERT INTO relations (branch_id, from_id, to_id, type, updated_version)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (branch_id, from_id, to_id, type) DO UPDATE SET updated_version = $5`,
    [branchId, rel.fromId, rel.toId, rel.type, version],
  );
}

export async function deleteRelation(
  branchId: string,
  rel: Relation,
  client: pg.PoolClient,
): Promise<void> {
  await client.query(
    'DELETE FROM relations WHERE branch_id = $1 AND from_id = $2 AND to_id = $3 AND type = $4',
    [branchId, rel.fromId, rel.toId, rel.type],
  );
}

// ---------------------------------------------------------------------------
// Derived results
// ---------------------------------------------------------------------------

export async function findDerivedResult(
  branchId: string,
  version: number,
  kind: string,
  inputHash: string,
  client?: Queryable,
): Promise<DerivedResultDto | null> {
  const res = await q(client).query(
    `SELECT * FROM derived_results
     WHERE branch_id = $1 AND version = $2 AND kind = $3 AND input_hash = $4`,
    [branchId, version, kind, inputHash],
  );
  return res.rows[0] ? mapDerived(res.rows[0]) : null;
}

export async function listDerivedResults(
  branchId: string,
  opts: { version?: number; kind?: string } = {},
  client?: Queryable,
): Promise<DerivedResultDto[]> {
  const conds = ['branch_id = $1'];
  const params: unknown[] = [branchId];
  if (opts.version !== undefined) {
    params.push(opts.version);
    conds.push(`version = $${params.length}`);
  }
  if (opts.kind) {
    params.push(opts.kind);
    conds.push(`kind = $${params.length}`);
  }
  const res = await q(client).query(
    `SELECT * FROM derived_results WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
  return res.rows.map(mapDerived);
}

export async function insertDerivedResult(
  fields: {
    vesselId: string;
    branchId: string;
    version: number;
    kind: string;
    inputHash: string;
    result: unknown;
  },
  client?: Queryable,
): Promise<DerivedResultDto> {
  const res = await q(client).query(
    `INSERT INTO derived_results (vessel_id, branch_id, version, kind, input_hash, result)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (branch_id, version, kind, input_hash) DO NOTHING
     RETURNING *`,
    [
      fields.vesselId,
      fields.branchId,
      fields.version,
      fields.kind,
      fields.inputHash,
      JSON.stringify(fields.result),
    ],
  );
  if (res.rows[0]) return mapDerived(res.rows[0]);
  // lost a race to an identical insert — the stored row is byte-identical by construction
  const existing = await findDerivedResult(
    fields.branchId,
    fields.version,
    fields.kind,
    fields.inputHash,
    client,
  );
  if (!existing) throw new Error('derived result insert failed');
  return existing;
}
