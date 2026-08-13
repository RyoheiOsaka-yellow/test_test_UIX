/**
 * The demo vessel — MV Aurora, a 120 m general cargo ship.
 *
 * This lives in the shared package because it is domain data, not server
 * fixture data: the API seeds a branch from it, and the standalone viewer
 * builds its whole model from it without a database.
 */

import { generateHull } from './hullgen.js';
import type {
  CompartmentEntityData,
  DeckEntityData,
  Entity,
  Fluid,
  Relation,
  TankEntityData,
  VesselEntityData,
} from './types.js';

export const DEMO_LPP = 120;
export const DEMO_BEAM = 20;
export const DEMO_DEPTH = 12;
export const DEMO_DESIGN_DRAFT = 7;

export const SW: Fluid = { name: 'Sea Water Ballast', density: 1.025 };
export const HFO: Fluid = { name: 'Heavy Fuel Oil', density: 0.98 };
export const FW: Fluid = { name: 'Fresh Water', density: 1.0 };

interface TankSpec {
  id: string;
  name: string;
  box: [number, number, number, number, number, number];
  fluid: Fluid;
  fill: number;
}

export const DEMO_TANKS: TankSpec[] = [
  { id: 'tank:APT.C', name: 'Aft Peak Tank', box: [2, 12, -3, 3, 0, 5], fluid: SW, fill: 60 },
  { id: 'tank:FPT.C', name: 'Fore Peak Tank', box: [106, 116, -2.5, 2.5, 0, 5], fluid: SW, fill: 0 },
  { id: 'tank:WB1.P', name: 'No.1 WB Tank (P)', box: [30, 54, -8, -0.5, 0, 1.8], fluid: SW, fill: 100 },
  { id: 'tank:WB1.S', name: 'No.1 WB Tank (S)', box: [30, 54, 0.5, 8, 0, 1.8], fluid: SW, fill: 100 },
  { id: 'tank:WB2.P', name: 'No.2 WB Tank (P)', box: [54, 78, -8, -0.5, 0, 1.8], fluid: SW, fill: 35 },
  { id: 'tank:WB2.S', name: 'No.2 WB Tank (S)', box: [54, 78, 0.5, 8, 0, 1.8], fluid: SW, fill: 35 },
  { id: 'tank:FO1.P', name: 'No.1 HFO Tank (P)', box: [78, 90, -7, -4, 0, 6], fluid: HFO, fill: 85 },
  { id: 'tank:FO1.S', name: 'No.1 HFO Tank (S)', box: [78, 90, 4, 7, 0, 6], fluid: HFO, fill: 85 },
  { id: 'tank:FW1.C', name: 'Fresh Water Tank', box: [12, 20, -4, 4, 6, 10], fluid: FW, fill: 90 },
];

export const DEMO_COMPARTMENTS: { id: string; data: CompartmentEntityData }[] = [
  { id: 'comp:ER', data: { kind: 'compartment', name: 'Engine Room', x0: 12, x1: 30, purpose: 'machinery' } },
  { id: 'comp:CH1', data: { kind: 'compartment', name: 'Cargo Hold 1', x0: 30, x1: 66, purpose: 'cargo' } },
  { id: 'comp:CH2', data: { kind: 'compartment', name: 'Cargo Hold 2', x0: 66, x1: 102, purpose: 'cargo' } },
];

export const DEMO_DECKS: { id: string; data: DeckEntityData }[] = [
  { id: 'deck:main', data: { kind: 'deck', name: 'Main Deck', z: DEMO_DEPTH } },
  { id: 'deck:tanktop', data: { kind: 'deck', name: 'Tank Top', z: 1.8 } },
];

export function demoVesselData(): VesselEntityData {
  return {
    kind: 'vessel',
    name: 'MV Aurora',
    principal: {
      lpp: DEMO_LPP,
      beam: DEMO_BEAM,
      depth: DEMO_DEPTH,
      designDraft: DEMO_DESIGN_DRAFT,
    },
    rhoWater: 1.025,
    kg: 7.4,
    // engine room aft, so the lightship centre sits a little abaft midship
    lightship: { mass: 2100, lcg: 54, vcg: 7.8 },
  };
}

export function demoTankData(spec: TankSpec): TankEntityData {
  const [x0, x1, y0, y1, z0, z1] = spec.box;
  return {
    kind: 'tank',
    name: spec.name,
    x0, x1, y0, y1, z0, z1,
    fluid: spec.fluid,
    fillPercent: spec.fill,
  };
}

/** Every entity of the demo vessel, in a stable order. */
export function demoEntities(): Entity[] {
  return [
    { id: 'vessel:self', kind: 'vessel', data: demoVesselData() },
    {
      id: 'hull:main',
      kind: 'hull',
      data: {
        kind: 'hull',
        name: 'Main Hull',
        geometry: generateHull({ lpp: DEMO_LPP, beam: DEMO_BEAM, depth: DEMO_DEPTH }),
      },
    },
    ...DEMO_TANKS.map((t): Entity => ({ id: t.id, kind: 'tank', data: demoTankData(t) })),
    ...DEMO_COMPARTMENTS.map((c): Entity => ({ id: c.id, kind: 'compartment', data: c.data })),
    ...DEMO_DECKS.map((d): Entity => ({ id: d.id, kind: 'deck', data: d.data })),
  ];
}

/** Structural relations of the demo vessel. */
export function demoRelations(): Relation[] {
  const contained = [
    ...DEMO_TANKS.map((t) => t.id),
    ...DEMO_COMPARTMENTS.map((c) => c.id),
    ...DEMO_DECKS.map((d) => d.id),
  ];
  return [
    { fromId: 'vessel:self', toId: 'hull:main', type: 'contains' },
    ...contained.map((id): Relation => ({ fromId: 'hull:main', toId: id, type: 'contains' })),
  ];
}
