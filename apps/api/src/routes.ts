import type { FastifyInstance } from 'fastify';
import type { Operation } from '@dock/shared';
import {
  getBranch,
  getTransaction,
  getVessel,
  listBranches,
  listDerivedResults,
  listEvents,
  listProjects,
  listTransactions,
  listVessels,
} from './state.js';
import {
  commitTransaction,
  createBranchFrom,
  getEntitiesAtVersion,
  getEntityAt,
  NotFoundError,
  previewTransaction,
  revertTransaction,
} from './services/transactions.js';
import { runHydro } from './services/hydro.js';
import { runStabilityL1 } from './services/stability.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true, service: 'digital-dock-api', version: 12 }));

  // -- projects & vessels ---------------------------------------------------

  app.get('/api/projects', async () => listProjects());

  app.get<{ Params: { id: string } }>('/api/projects/:id/vessels', async (req) =>
    listVessels(req.params.id),
  );

  app.get<{ Params: { id: string } }>('/api/vessels/:id', async (req) => {
    const vessel = await getVessel(req.params.id);
    if (!vessel) throw new NotFoundError(`vessel ${req.params.id} not found`);
    const branches = await listBranches(vessel.id);
    return { ...vessel, branches };
  });

  app.post<{
    Params: { id: string };
    Body: { name: string; fromBranchId: string; atVersion?: number };
  }>('/api/vessels/:id/branches', async (req, reply) => {
    const { name, fromBranchId, atVersion } = req.body ?? ({} as never);
    if (!name || !fromBranchId) {
      return reply.code(400).send({ error: 'name and fromBranchId are required' });
    }
    const source = await getBranch(fromBranchId);
    if (!source || source.vesselId !== req.params.id) {
      throw new NotFoundError(`branch ${fromBranchId} not found on vessel ${req.params.id}`);
    }
    const branch = await createBranchFrom(fromBranchId, name, { atVersion });
    return reply.code(201).send(branch);
  });

  // -- branches ---------------------------------------------------------------

  app.get<{ Params: { id: string } }>('/api/branches/:id', async (req) => {
    const branch = await getBranch(req.params.id);
    if (!branch) throw new NotFoundError(`branch ${req.params.id} not found`);
    return branch;
  });

  app.get<{
    Params: { id: string };
    Querystring: { kind?: string; q?: string; version?: string };
  }>('/api/branches/:id/entities', async (req) => {
    const version = req.query.version === undefined ? undefined : Number(req.query.version);
    const { version: v, entities, relations } = await getEntitiesAtVersion(req.params.id, version);
    let list = entities;
    if (req.query.kind) list = list.filter((e) => e.kind === req.query.kind);
    if (req.query.q) {
      const needle = req.query.q.toLowerCase();
      list = list.filter(
        (e) =>
          e.id.toLowerCase().includes(needle) ||
          ((e.data as { name?: string }).name ?? '').toLowerCase().includes(needle),
      );
    }
    return { branchId: req.params.id, version: v, entities: list, relations };
  });

  app.get<{
    Params: { id: string; semanticId: string };
    Querystring: { version?: string };
  }>('/api/branches/:id/entities/:semanticId', async (req) => {
    const version = req.query.version === undefined ? undefined : Number(req.query.version);
    const entity = await getEntityAt(req.params.id, req.params.semanticId, version);
    if (!entity) {
      throw new NotFoundError(`entity ${req.params.semanticId} not found on branch`);
    }
    return entity;
  });

  app.get<{ Params: { id: string } }>('/api/branches/:id/transactions', async (req) => {
    const branch = await getBranch(req.params.id);
    if (!branch) throw new NotFoundError(`branch ${req.params.id} not found`);
    return listTransactions(req.params.id);
  });

  app.get<{ Params: { id: string }; Querystring: { toVersion?: string } }>(
    '/api/branches/:id/events',
    async (req) => {
      const branch = await getBranch(req.params.id);
      if (!branch) throw new NotFoundError(`branch ${req.params.id} not found`);
      const toVersion =
        req.query.toVersion === undefined ? undefined : Number(req.query.toVersion);
      return listEvents(req.params.id, { toVersion });
    },
  );

  // -- transactions -----------------------------------------------------------

  app.post<{
    Params: { id: string };
    Body: { operations: Operation[]; baseVersion?: number; description?: string };
  }>('/api/branches/:id/transactions/preview', async (req, reply) => {
    const { operations, baseVersion, description } = req.body ?? ({} as never);
    const preview = await previewTransaction(req.params.id, operations ?? [], {
      baseVersion,
      description,
    });
    return reply.code(preview.validation.ok ? 200 : 422).send(preview);
  });

  app.get<{ Params: { id: string } }>('/api/transactions/:id', async (req) => {
    const tx = await getTransaction(req.params.id);
    if (!tx) throw new NotFoundError(`transaction ${req.params.id} not found`);
    return tx;
  });

  app.post<{ Params: { id: string } }>('/api/transactions/:id/commit', async (req) =>
    commitTransaction(req.params.id),
  );

  app.post<{ Params: { id: string } }>('/api/transactions/:id/revert', async (req) =>
    revertTransaction(req.params.id),
  );

  // -- hydrostatics -----------------------------------------------------------

  app.post<{
    Params: { id: string };
    Body: { version?: number; draft?: number; kg?: number };
  }>('/api/branches/:id/hydro/run', async (req) => {
    const { version, draft, kg } = req.body ?? {};
    return runHydro({ branchId: req.params.id, version, draft, kg });
  });

  app.post<{
    Params: { id: string };
    Body: {
      version?: number;
      extraWeights?: import('@dock/shared').WeightItem[];
      floodingAngleDeg?: number;
      heelStepDeg?: number;
      maxHeelDeg?: number;
    };
  }>('/api/branches/:id/stability/run', async (req) => {
    const body = req.body ?? {};
    return runStabilityL1({ branchId: req.params.id, ...body });
  });

  app.get<{
    Params: { id: string };
    Querystring: { version?: string; kind?: string };
  }>('/api/branches/:id/hydro', async (req) => {
    const branch = await getBranch(req.params.id);
    if (!branch) throw new NotFoundError(`branch ${req.params.id} not found`);
    const version = req.query.version === undefined ? undefined : Number(req.query.version);
    return listDerivedResults(req.params.id, { version, kind: req.query.kind });
  });
}
