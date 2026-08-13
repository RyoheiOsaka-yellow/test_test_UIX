/**
 * Digital Dock v12 — MCP server (Step 4).
 *
 * Exposes the vessel model over the Model Context Protocol, backed by the
 * stable HTTP API. Semantic tool names use underscores because MCP/Claude
 * tool names are restricted to [a-zA-Z0-9_-]:
 *
 *   vessel.get           → vessel_get
 *   vessel.object.get    → vessel_object_get
 *   vessel.object.search → vessel_object_search
 *   tank.resize          → tank_resize   (preview; commit is explicit opt-in)
 *   hydro.run            → hydro_run
 *   branch.create        → branch_create
 *   transaction.revert   → transaction_revert
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const API_URL = process.env.DOCK_API_URL ?? 'http://127.0.0.1:8787';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: init?.body
      ? { 'content-type': 'application/json', ...(init?.headers ?? {}) }
      : (init?.headers ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (body as { error?: string }).error ?? `HTTP ${res.status}`,
      body,
    );
  }
  return body as T;
}

const asText = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const asError = (err: unknown) => ({
  isError: true,
  content: [
    {
      type: 'text' as const,
      text: err instanceof ApiError ? `API error ${err.status}: ${err.message}` : String(err),
    },
  ],
});

/** Resolve the demo vessel/branch when ids are omitted (single-vessel UX). */
async function resolveBranchId(branchId?: string): Promise<string> {
  if (branchId) return branchId;
  const projects = await api<{ id: string }[]>('/api/projects');
  if (!projects.length) throw new ApiError(404, 'no projects');
  const vessels = await api<{ id: string }[]>(`/api/projects/${projects[0].id}/vessels`);
  if (!vessels.length) throw new ApiError(404, 'no vessels');
  const vessel = await api<{ branches: { id: string; name: string }[] }>(
    `/api/vessels/${vessels[0].id}`,
  );
  const main = vessel.branches.find((b) => b.name === 'main') ?? vessel.branches[0];
  if (!main) throw new ApiError(404, 'vessel has no branches');
  return main.id;
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'digital-dock', version: '12.0.0' });

  server.tool(
    'vessel_get',
    'vessel.get — vessel metadata, its branches and head versions. ' +
      'Omit vesselId to get the default (first) vessel.',
    { vesselId: z.string().uuid().optional() },
    async ({ vesselId }) => {
      try {
        let id = vesselId;
        if (!id) {
          const projects = await api<{ id: string }[]>('/api/projects');
          const vessels = projects.length
            ? await api<{ id: string }[]>(`/api/projects/${projects[0].id}/vessels`)
            : [];
          id = vessels[0]?.id;
          if (!id) throw new ApiError(404, 'no vessels found');
        }
        return asText(await api(`/api/vessels/${id}`));
      } catch (err) {
        return asError(err);
      }
    },
  );

  server.tool(
    'vessel_object_get',
    'vessel.object.get — fetch one entity by stable semantic id ' +
      '(e.g. "hull:main", "tank:WB2.P"), optionally pinned to a version.',
    {
      semanticId: z.string(),
      branchId: z.string().uuid().optional(),
      version: z.number().int().nonnegative().optional(),
    },
    async ({ semanticId, branchId, version }) => {
      try {
        const b = await resolveBranchId(branchId);
        const qs = version === undefined ? '' : `?version=${version}`;
        return asText(await api(`/api/branches/${b}/entities/${encodeURIComponent(semanticId)}${qs}`));
      } catch (err) {
        return asError(err);
      }
    },
  );

  server.tool(
    'vessel_object_search',
    'vessel.object.search — search entities by kind and/or free-text query ' +
      'against semantic id and name, optionally at a historical version.',
    {
      q: z.string().optional(),
      kind: z.enum(['vessel', 'hull', 'tank', 'compartment', 'deck']).optional(),
      branchId: z.string().uuid().optional(),
      version: z.number().int().nonnegative().optional(),
    },
    async ({ q, kind, branchId, version }) => {
      try {
        const b = await resolveBranchId(branchId);
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (kind) params.set('kind', kind);
        if (version !== undefined) params.set('version', String(version));
        const query = params.toString() ? `?${params}` : '';
        const res = await api<{ version: number; entities: unknown[] }>(
          `/api/branches/${b}/entities${query}`,
        );
        return asText(res);
      } catch (err) {
        return asError(err);
      }
    },
  );

  server.tool(
    'tank_resize',
    'tank.resize — PREVIEW a tank geometry/fill change as a transaction. ' +
      'Never mutates the branch unless commit=true is passed explicitly. ' +
      'Returns the previewed effects and the transactionId.',
    {
      tankId: z.string().describe('semantic id, e.g. "tank:WB2.P"'),
      branchId: z.string().uuid().optional(),
      x0: z.number().optional(),
      x1: z.number().optional(),
      y0: z.number().optional(),
      y1: z.number().optional(),
      z0: z.number().optional(),
      z1: z.number().optional(),
      fillPercent: z.number().min(0).max(100).optional(),
      commit: z.boolean().default(false),
      description: z.string().optional(),
    },
    async ({ tankId, branchId, commit, description, ...patch }) => {
      try {
        const b = await resolveBranchId(branchId);
        const fields = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(fields).length === 0) {
          throw new ApiError(400, 'nothing to change — pass box coordinates and/or fillPercent');
        }
        let preview: { transactionId: string; validation: { ok: boolean; errors: string[] } };
        try {
          preview = await api(`/api/branches/${b}/transactions/preview`, {
            method: 'POST',
            body: JSON.stringify({
              operations: [{ op: 'entity.update', id: tankId, patch: fields }],
              description: description ?? `Resize ${tankId} (MCP)`,
            }),
          });
        } catch (err) {
          // the preview endpoint answers 422 with the full validation report
          if (err instanceof ApiError && err.status === 422 && err.body
              && typeof err.body === 'object' && 'validation' in err.body) {
            return asText({ mode: 'preview', ...(err.body as object) });
          }
          throw err;
        }
        if (!preview.validation.ok || !commit) {
          return asText({ mode: 'preview', ...preview });
        }
        const committed = await api(`/api/transactions/${preview.transactionId}/commit`, {
          method: 'POST',
        });
        return asText({ mode: 'committed', preview, transaction: committed });
      } catch (err) {
        return asError(err);
      }
    },
  );

  server.tool(
    'hydro_run',
    'hydro.run — compute Hydrostatics L0 (displacement, KB, BM, GM incl. ' +
      'free-surface correction, TPC, MCT, form coefficients) for a branch at an ' +
      'exact version. Results are immutable and cached per input hash.',
    {
      branchId: z.string().uuid().optional(),
      version: z.number().int().nonnegative().optional(),
      draft: z.number().positive().optional(),
      kg: z.number().positive().optional(),
    },
    async ({ branchId, version, draft, kg }) => {
      try {
        const b = await resolveBranchId(branchId);
        return asText(
          await api(`/api/branches/${b}/hydro/run`, {
            method: 'POST',
            body: JSON.stringify({ version, draft, kg }),
          }),
        );
      } catch (err) {
        return asError(err);
      }
    },
  );

  server.tool(
    'branch_create',
    'branch.create — fork a new branch from a source branch, optionally at a ' +
      'historical version. The fork is event-sourced and fully isolated.',
    {
      name: z.string().min(1),
      fromBranchId: z.string().uuid().optional(),
      atVersion: z.number().int().nonnegative().optional(),
    },
    async ({ name, fromBranchId, atVersion }) => {
      try {
        const source = await resolveBranchId(fromBranchId);
        const branch = await api<{ vesselId: string }>(`/api/branches/${source}`);
        return asText(
          await api(`/api/vessels/${branch.vesselId}/branches`, {
            method: 'POST',
            body: JSON.stringify({ name, fromBranchId: source, atVersion }),
          }),
        );
      } catch (err) {
        return asError(err);
      }
    },
  );

  server.tool(
    'transaction_revert',
    'transaction.revert — revert a committed transaction by committing a ' +
      'compensating transaction at a new version. History is never rewritten.',
    { transactionId: z.string().uuid() },
    async ({ transactionId }) => {
      try {
        return asText(await api(`/api/transactions/${transactionId}/revert`, { method: 'POST' }));
      } catch (err) {
        return asError(err);
      }
    },
  );

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
