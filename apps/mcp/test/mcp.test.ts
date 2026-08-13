process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://dock:dock@127.0.0.1:5432/digitaldock_test';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { closePool, getPool } from '../../api/src/db/pool.js';
import { migrate } from '../../api/src/db/migrate.js';
import { buildServer } from '../../api/src/server.js';
import { createProject, createVessel, getBranch, insertBranch } from '../../api/src/state.js';
import { commitOperations } from '../../api/src/services/transactions.js';
import { buildInitialOperations } from '../../api/src/seed.js';

let app: Awaited<ReturnType<typeof buildServer>>;
let client: Client;
let branchId: string;

const text = (res: any): any => JSON.parse(res.content[0].text);

beforeAll(async () => {
  const pool = getPool();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  const project = await createProject('MCP Test Project');
  const vessel = await createVessel(project.id, 'vessel:test', 'Test Vessel');
  const main = await insertBranch(vessel.id, 'main', null, null);
  branchId = main.id;
  await commitOperations(branchId, buildInitialOperations(), { baseVersion: 0 });

  app = await buildServer();
  const addr = await app.listen({ port: 0, host: '127.0.0.1' });
  process.env.DOCK_API_URL = addr;

  const { createServer } = await import('../src/server.js');
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
  await app?.close();
  await closePool();
});

describe('MCP server (Step 4)', () => {
  it('lists exactly the seven vessel tools', async () => {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'branch_create',
      'hydro_run',
      'tank_resize',
      'transaction_revert',
      'vessel_get',
      'vessel_object_get',
      'vessel_object_search',
    ]);
  });

  it('vessel_get resolves the default vessel with branches', async () => {
    const res = text(await client.callTool({ name: 'vessel_get', arguments: {} }));
    expect(res.name).toBe('Test Vessel');
    expect(res.branches[0].name).toBe('main');
  });

  it('vessel_object_get returns an entity by semantic id', async () => {
    const res = text(
      await client.callTool({
        name: 'vessel_object_get',
        arguments: { semanticId: 'tank:WB2.P' },
      }),
    );
    expect(res.id).toBe('tank:WB2.P');
    expect(res.data.fillPercent).toBe(35);
  });

  it('vessel_object_search filters by kind and query', async () => {
    const res = text(
      await client.callTool({
        name: 'vessel_object_search',
        arguments: { kind: 'tank', q: 'WB' },
      }),
    );
    expect(res.entities).toHaveLength(4);
    expect(res.entities.every((e: any) => e.kind === 'tank')).toBe(true);
  });

  it('tank_resize previews without mutating the branch', async () => {
    const before = await getBranch(branchId);
    const res = text(
      await client.callTool({
        name: 'tank_resize',
        arguments: { tankId: 'tank:WB2.P', fillPercent: 90 },
      }),
    );
    expect(res.mode).toBe('preview');
    expect(res.validation.ok).toBe(true);
    const after = await getBranch(branchId);
    expect(after!.headVersion).toBe(before!.headVersion);
  });

  it('tank_resize commit=true commits through the transaction service', async () => {
    const before = await getBranch(branchId);
    const res = text(
      await client.callTool({
        name: 'tank_resize',
        arguments: { tankId: 'tank:WB2.P', fillPercent: 55, commit: true },
      }),
    );
    expect(res.mode).toBe('committed');
    const after = await getBranch(branchId);
    expect(after!.headVersion).toBe(before!.headVersion + 1);
  });

  it('hydro_run returns an immutable derived result', async () => {
    const res = text(await client.callTool({ name: 'hydro_run', arguments: {} }));
    expect(res.derived.kind).toBe('hydrostatics.L0');
    expect(res.derived.result.displacement).toBeGreaterThan(0);
    const again = text(await client.callTool({ name: 'hydro_run', arguments: {} }));
    expect(again.cached).toBe(true);
    expect(again.derived.id).toBe(res.derived.id);
  });

  it('branch_create forks and transaction_revert compensates', async () => {
    const fork = text(
      await client.callTool({ name: 'branch_create', arguments: { name: 'mcp-what-if' } }),
    );
    expect(fork.parentBranchId).toBe(branchId);

    const resize = text(
      await client.callTool({
        name: 'tank_resize',
        arguments: { tankId: 'tank:WB1.P', fillPercent: 10, branchId: fork.id, commit: true },
      }),
    );
    const reverted = text(
      await client.callTool({
        name: 'transaction_revert',
        arguments: { transactionId: resize.transaction.id },
      }),
    );
    expect(reverted.revertOfTransactionId).toBe(resize.transaction.id);

    const tank = text(
      await client.callTool({
        name: 'vessel_object_get',
        arguments: { semanticId: 'tank:WB1.P', branchId: fork.id },
      }),
    );
    expect(tank.data.fillPercent).toBe(100); // back to the seeded value
  });

  it('surfaces API validation errors as tool errors', async () => {
    const res: any = await client.callTool({
      name: 'tank_resize',
      arguments: { tankId: 'tank:WB1.P', fillPercent: 40, x1: -999 },
    });
    const body = JSON.parse(res.content[0].text);
    expect(body.validation.ok).toBe(false);
    expect(body.validation.errors[0]).toMatch(/x1/);
  });
});
