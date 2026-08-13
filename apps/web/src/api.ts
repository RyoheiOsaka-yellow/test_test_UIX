import type {
  BranchDto,
  DerivedResultDto,
  Entity,
  Operation,
  PreviewResultDto,
  ProjectDto,
  Relation,
  TransactionDto,
  VesselDto,
} from '@dock/shared';

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message);
  }
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`, body);
  }
  return body as T;
}

export interface Snapshot {
  branchId: string;
  version: number;
  entities: Entity[];
  relations: Relation[];
}

export const api = {
  projects: () => j<ProjectDto[]>('/api/projects'),
  vessels: (projectId: string) => j<VesselDto[]>(`/api/projects/${projectId}/vessels`),
  vessel: (id: string) => j<VesselDto & { branches: BranchDto[] }>(`/api/vessels/${id}`),
  branch: (id: string) => j<BranchDto>(`/api/branches/${id}`),

  entities: (branchId: string, opts: { version?: number; kind?: string; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (opts.version !== undefined) p.set('version', String(opts.version));
    if (opts.kind) p.set('kind', opts.kind);
    if (opts.q) p.set('q', opts.q);
    const qs = p.toString() ? `?${p}` : '';
    return j<Snapshot>(`/api/branches/${branchId}/entities${qs}`);
  },

  transactions: (branchId: string) => j<TransactionDto[]>(`/api/branches/${branchId}/transactions`),

  preview: (branchId: string, operations: Operation[], description: string, baseVersion?: number) =>
    j<PreviewResultDto>(`/api/branches/${branchId}/transactions/preview`, {
      method: 'POST',
      body: JSON.stringify({ operations, description, baseVersion }),
    }),

  commit: (transactionId: string) =>
    j<TransactionDto>(`/api/transactions/${transactionId}/commit`, { method: 'POST' }),

  revert: (transactionId: string) =>
    j<TransactionDto>(`/api/transactions/${transactionId}/revert`, { method: 'POST' }),

  createBranch: (vesselId: string, name: string, fromBranchId: string, atVersion?: number) =>
    j<BranchDto>(`/api/vessels/${vesselId}/branches`, {
      method: 'POST',
      body: JSON.stringify({ name, fromBranchId, atVersion }),
    }),

  hydroRun: (branchId: string, body: { version?: number; draft?: number; kg?: number }) =>
    j<{ cached: boolean; derived: DerivedResultDto }>(`/api/branches/${branchId}/hydro/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  hydroList: (branchId: string, version?: number) => {
    const qs = version === undefined ? '' : `?version=${version}`;
    return j<DerivedResultDto[]>(`/api/branches/${branchId}/hydro${qs}`);
  },
};
