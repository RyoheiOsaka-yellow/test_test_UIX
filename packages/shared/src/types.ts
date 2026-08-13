/**
 * Digital Dock v12 — shared domain types.
 *
 * Coordinate system (hull frame):
 *   x — longitudinal, measured forward from the aft perpendicular (0 .. Lpp)
 *   y — transverse half-breadth, measured from centerline (starboard positive)
 *   z — vertical, measured up from the baseline (keel = 0)
 * Units: metres, tonnes, t/m³.
 */

// ---------------------------------------------------------------------------
// Semantic identity
// ---------------------------------------------------------------------------

/** Stable semantic entity id, e.g. `hull:main`, `tank:WB1.P`, `vessel:self`. */
export type SemanticId = string;

export type EntityKind = 'vessel' | 'hull' | 'tank' | 'compartment' | 'deck';

// ---------------------------------------------------------------------------
// Hull geometry — offsets table
// ---------------------------------------------------------------------------

/** Half-breadth `y` at height `z` above baseline. */
export interface WaterlineOffset {
  z: number;
  y: number;
}

/** Transverse section at longitudinal position `x`; offsets sorted by z ascending. */
export interface Station {
  x: number;
  offsets: WaterlineOffset[];
}

/** Lofted hull described by an offsets table; stations sorted by x ascending. */
export interface HullGeometry {
  stations: Station[];
}

export interface PrincipalDimensions {
  /** Length between perpendiculars [m] */
  lpp: number;
  /** Moulded beam [m] */
  beam: number;
  /** Moulded depth [m] */
  depth: number;
  /** Design draft [m] */
  designDraft: number;
}

// ---------------------------------------------------------------------------
// Entity payloads (projection data)
// ---------------------------------------------------------------------------

export interface VesselEntityData {
  kind: 'vessel';
  name: string;
  principal: PrincipalDimensions;
  /** Sea water density [t/m³] */
  rhoWater: number;
  /** Vertical centre of gravity above baseline [m] (lightship + fixed load, L0 assumption) */
  kg: number;
  /**
   * Lightship weight and centres. Required by the L1 free-trim/stability
   * engine, which solves for the floating attitude rather than assuming a
   * draft the way L0 does.
   */
  lightship?: {
    /** Lightship mass [t] */
    mass: number;
    /** Longitudinal centre of gravity from AP [m] */
    lcg: number;
    /** Vertical centre of gravity above baseline [m] */
    vcg: number;
    /** Transverse centre of gravity from centerline [m] */
    tcg?: number;
  };
}

export interface HullEntityData {
  kind: 'hull';
  name: string;
  geometry: HullGeometry;
}

export interface Fluid {
  name: string;
  /** density [t/m³] */
  density: number;
}

/** Axis-aligned box tank in hull coordinates. y0 < y1 (port tanks have negative y). */
export interface TankEntityData {
  kind: 'tank';
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  fluid: Fluid;
  /** Filling ratio 0..100 [%] */
  fillPercent: number;
}

export interface CompartmentEntityData {
  kind: 'compartment';
  name: string;
  x0: number;
  x1: number;
  purpose: string;
}

export interface DeckEntityData {
  kind: 'deck';
  name: string;
  z: number;
}

export type EntityData =
  | VesselEntityData
  | HullEntityData
  | TankEntityData
  | CompartmentEntityData
  | DeckEntityData;

export interface Entity {
  id: SemanticId;
  kind: EntityKind;
  data: EntityData;
}

export type RelationType = 'contains' | 'adjacent_to' | 'part_of';

export interface Relation {
  fromId: SemanticId;
  toId: SemanticId;
  type: RelationType;
}

// ---------------------------------------------------------------------------
// Transactions & events
// ---------------------------------------------------------------------------

export type OperationType =
  | 'entity.create'
  | 'entity.update'
  | 'entity.delete'
  | 'relation.create'
  | 'relation.delete';

export interface EntityCreateOp {
  op: 'entity.create';
  id: SemanticId;
  kind: EntityKind;
  data: EntityData;
}

/**
 * Patch of the entity data. Default is a shallow merge of top-level keys;
 * `replace: true` substitutes the whole payload (used by compensating
 * transactions to restore an exact prior state).
 */
export interface EntityUpdateOp {
  op: 'entity.update';
  id: SemanticId;
  patch: Record<string, unknown>;
  replace?: boolean;
}

export interface EntityDeleteOp {
  op: 'entity.delete';
  id: SemanticId;
}

export interface RelationCreateOp {
  op: 'relation.create';
  fromId: SemanticId;
  toId: SemanticId;
  type: RelationType;
}

export interface RelationDeleteOp {
  op: 'relation.delete';
  fromId: SemanticId;
  toId: SemanticId;
  type: RelationType;
}

export type Operation =
  | EntityCreateOp
  | EntityUpdateOp
  | EntityDeleteOp
  | RelationCreateOp
  | RelationDeleteOp;

export type TransactionStatus = 'previewed' | 'committed' | 'reverted';

// ---------------------------------------------------------------------------
// Hydrostatics
// ---------------------------------------------------------------------------

export interface HydroCondition {
  /** Even-keel draft [m] */
  draft: number;
  /** Water density [t/m³] */
  rhoWater: number;
  /** Vertical centre of gravity above baseline [m] */
  kg: number;
}

export interface HydroResult {
  condition: HydroCondition;
  /** Moulded volume of displacement [m³] */
  volume: number;
  /** Displacement [t] */
  displacement: number;
  /** Longitudinal centre of buoyancy from aft perpendicular [m] */
  lcb: number;
  /** Vertical centre of buoyancy above baseline (KB) [m] */
  kb: number;
  /** Waterplane area [m²] */
  awp: number;
  /** Longitudinal centre of flotation from AP [m] */
  lcf: number;
  /** Transverse waterplane inertia about centerline [m⁴] */
  it: number;
  /** Longitudinal waterplane inertia about LCF [m⁴] */
  il: number;
  /** Transverse metacentric radius BM_T = I_T / V [m] */
  bmt: number;
  /** Longitudinal metacentric radius BM_L = I_L / V [m] */
  bml: number;
  /** KM_T = KB + BM_T [m] */
  kmt: number;
  /** KM_L = KB + BM_L [m] */
  kml: number;
  /** Solid transverse metacentric height GM_T = KM_T − KG [m] */
  gmtSolid: number;
  /** Free-surface correction ΣρᵢIᵢ / Δ [m] */
  fsc: number;
  /** Corrected GM_T = GM_T,solid − FSC [m] */
  gmt: number;
  /** Longitudinal metacentric height [m] */
  gml: number;
  /** Tonnes per centimetre immersion [t/cm] */
  tpc: number;
  /** Moment to change trim 1 cm [t·m/cm] */
  mct1cm: number;
  /** Block coefficient */
  cb: number;
  /** Prismatic coefficient */
  cp: number;
  /** Midship section coefficient */
  cm: number;
  /** Waterplane coefficient */
  cw: number;
  /** Midship section area [m²] */
  midshipArea: number;
  /** Total tank fluid mass considered in FSC [t] */
  tankFluidMass: number;
}

export interface TankState {
  /** Geometric capacity [m³] */
  capacity: number;
  /** Fluid volume at current fill [m³] */
  fluidVolume: number;
  /** Fluid mass [t] */
  fluidMass: number;
  /** Free-surface moment ρ·i (0 when pressed full or empty) [t·m] */
  freeSurfaceMoment: number;
}

// ---------------------------------------------------------------------------
// API surface types
// ---------------------------------------------------------------------------

export interface ProjectDto {
  id: string;
  name: string;
  createdAt: string;
}

export interface VesselDto {
  id: string;
  projectId: string;
  semanticId: SemanticId;
  name: string;
  createdAt: string;
}

export interface BranchDto {
  id: string;
  vesselId: string;
  name: string;
  headVersion: number;
  parentBranchId: string | null;
  forkedAtVersion: number | null;
  createdAt: string;
}

export interface TransactionDto {
  id: string;
  branchId: string;
  status: TransactionStatus;
  baseVersion: number;
  resultVersion: number | null;
  description: string;
  operations: Operation[];
  revertOfTransactionId: string | null;
  createdAt: string;
  committedAt: string | null;
}

export interface EventDto {
  id: string;
  branchId: string;
  transactionId: string;
  version: number;
  seq: number;
  type: OperationType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DerivedResultDto {
  id: string;
  vesselId: string;
  branchId: string;
  version: number;
  kind: string;
  inputHash: string;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface PreviewEffect {
  id: SemanticId;
  action: 'create' | 'update' | 'delete';
  before: EntityData | null;
  after: EntityData | null;
}

export interface PreviewResultDto {
  transactionId: string;
  branchId: string;
  baseVersion: number;
  effects: PreviewEffect[];
  validation: { ok: boolean; errors: string[] };
}
