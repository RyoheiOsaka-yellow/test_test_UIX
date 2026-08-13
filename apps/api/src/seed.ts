/**
 * Seeds the demo project: MV Aurora, a 120 m general cargo vessel with a
 * parametric hull, ballast/fuel/fresh-water tanks, compartments and decks.
 * Everything goes through the normal transaction path, so the branch history
 * starts with a single committed "initial import" transaction.
 */

import { fileURLToPath } from 'node:url';
import { demoEntities, demoRelations, type Operation } from '@dock/shared';
import { closePool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { createProject, createVessel, insertBranch, listProjects } from './state.js';
import { commitOperations } from './services/transactions.js';
import { runHydro } from './services/hydro.js';

export function buildInitialOperations(): Operation[] {
  return [
    ...demoEntities().map((e): Operation => ({
      op: 'entity.create',
      id: e.id,
      kind: e.kind,
      data: e.data,
    })),
    ...demoRelations().map((r): Operation => ({
      op: 'relation.create',
      fromId: r.fromId,
      toId: r.toId,
      type: r.type,
    })),
  ];
}

export async function seed(): Promise<{ projectId: string; vesselId: string; branchId: string }> {
  await migrate();
  const existing = (await listProjects()).find((p) => p.name === 'Digital Dock Demo');
  if (existing) {
    console.log('demo project already seeded; skipping');
    return { projectId: existing.id, vesselId: '', branchId: '' };
  }

  const project = await createProject('Digital Dock Demo');
  const vessel = await createVessel(project.id, 'vessel:mv-aurora', 'MV Aurora');
  const main = await insertBranch(vessel.id, 'main', null, null);

  const tx = await commitOperations(main.id, buildInitialOperations(), {
    baseVersion: 0,
    description: 'Initial import of MV Aurora',
  });
  console.log(`seeded MV Aurora — branch main @ v${tx.resultVersion}`);

  const { derived } = await runHydro({ branchId: main.id });
  const r = derived.result as Record<string, number>;
  console.log(
    `hydrostatics L0 @ design draft: Δ=${r.displacement} t, KB=${r.kb} m, GMt=${r.gmt} m, Cb=${r.cb}`,
  );
  return { projectId: project.id, vesselId: vessel.id, branchId: main.id };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => closePool())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
