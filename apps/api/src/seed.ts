/**
 * Seeds the demo project: MV Aurora, a 120 m general cargo vessel with a
 * parametric hull, ballast/fuel/fresh-water tanks, compartments and decks.
 * Everything goes through the normal transaction path, so the branch history
 * starts with a single committed "initial import" transaction.
 */

import { fileURLToPath } from 'node:url';
import { generateHull, type Operation } from '@dock/shared';
import { closePool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { createProject, createVessel, insertBranch, listProjects } from './state.js';
import { commitOperations } from './services/transactions.js';
import { runHydro } from './services/hydro.js';

const LPP = 120;
const BEAM = 20;
const DEPTH = 12;
const DESIGN_DRAFT = 7;

const SW = { name: 'Sea Water Ballast', density: 1.025 };
const HFO = { name: 'Heavy Fuel Oil', density: 0.98 };
const FW = { name: 'Fresh Water', density: 1.0 };

function tank(
  id: string,
  name: string,
  box: [number, number, number, number, number, number],
  fluid: { name: string; density: number },
  fillPercent: number,
): Operation {
  const [x0, x1, y0, y1, z0, z1] = box;
  return {
    op: 'entity.create',
    id,
    kind: 'tank',
    data: { kind: 'tank', name, x0, x1, y0, y1, z0, z1, fluid, fillPercent },
  };
}

export function buildInitialOperations(): Operation[] {
  const hull = generateHull({ lpp: LPP, beam: BEAM, depth: DEPTH });

  const ops: Operation[] = [
    {
      op: 'entity.create',
      id: 'vessel:self',
      kind: 'vessel',
      data: {
        kind: 'vessel',
        name: 'MV Aurora',
        principal: { lpp: LPP, beam: BEAM, depth: DEPTH, designDraft: DESIGN_DRAFT },
        rhoWater: 1.025,
        kg: 7.4,
      },
    },
    {
      op: 'entity.create',
      id: 'hull:main',
      kind: 'hull',
      data: { kind: 'hull', name: 'Main Hull', geometry: hull },
    },

    // Aft peak / fore peak
    tank('tank:APT.C', 'Aft Peak Tank', [2, 12, -3, 3, 0, 5], SW, 60),
    tank('tank:FPT.C', 'Fore Peak Tank', [106, 116, -2.5, 2.5, 0, 5], SW, 0),

    // Double-bottom water ballast
    tank('tank:WB1.P', 'No.1 WB Tank (P)', [30, 54, -8, -0.5, 0, 1.8], SW, 100),
    tank('tank:WB1.S', 'No.1 WB Tank (S)', [30, 54, 0.5, 8, 0, 1.8], SW, 100),
    tank('tank:WB2.P', 'No.2 WB Tank (P)', [54, 78, -8, -0.5, 0, 1.8], SW, 35),
    tank('tank:WB2.S', 'No.2 WB Tank (S)', [54, 78, 0.5, 8, 0, 1.8], SW, 35),

    // Fuel and fresh water
    tank('tank:FO1.P', 'No.1 HFO Tank (P)', [78, 90, -7, -4, 0, 6], HFO, 85),
    tank('tank:FO1.S', 'No.1 HFO Tank (S)', [78, 90, 4, 7, 0, 6], HFO, 85),
    tank('tank:FW1.C', 'Fresh Water Tank', [12, 20, -4, 4, 6, 10], FW, 90),

    // Compartments & decks
    {
      op: 'entity.create',
      id: 'comp:ER',
      kind: 'compartment',
      data: { kind: 'compartment', name: 'Engine Room', x0: 12, x1: 30, purpose: 'machinery' },
    },
    {
      op: 'entity.create',
      id: 'comp:CH1',
      kind: 'compartment',
      data: { kind: 'compartment', name: 'Cargo Hold 1', x0: 30, x1: 66, purpose: 'cargo' },
    },
    {
      op: 'entity.create',
      id: 'comp:CH2',
      kind: 'compartment',
      data: { kind: 'compartment', name: 'Cargo Hold 2', x0: 66, x1: 102, purpose: 'cargo' },
    },
    {
      op: 'entity.create',
      id: 'deck:main',
      kind: 'deck',
      data: { kind: 'deck', name: 'Main Deck', z: DEPTH },
    },
    {
      op: 'entity.create',
      id: 'deck:tanktop',
      kind: 'deck',
      data: { kind: 'deck', name: 'Tank Top', z: 1.8 },
    },
  ];

  // Structure relations
  ops.push({ op: 'relation.create', fromId: 'vessel:self', toId: 'hull:main', type: 'contains' });
  for (const id of [
    'tank:APT.C', 'tank:FPT.C',
    'tank:WB1.P', 'tank:WB1.S', 'tank:WB2.P', 'tank:WB2.S',
    'tank:FO1.P', 'tank:FO1.S', 'tank:FW1.C',
    'comp:ER', 'comp:CH1', 'comp:CH2',
    'deck:main', 'deck:tanktop',
  ]) {
    ops.push({ op: 'relation.create', fromId: 'hull:main', toId: id, type: 'contains' });
  }
  return ops;
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
