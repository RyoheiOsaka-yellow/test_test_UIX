/**
 * Loading conditions — named tank fills + cargo, with presets, persistence
 * and a comparison runner that evaluates every condition against the same
 * full battery: equilibrium, IMO criteria, the weather criterion, still-water
 * strength against the class envelopes, and the summer-draft margin.
 */

import {
  checkEnvelope,
  type L1Result,
  type StrengthResult,
  type WeatherResult,
  type WeightItem,
} from '@dock/shared';
import {
  runStability,
  runStrengthCalc,
  runWeather,
  withTank,
  type Model,
} from './store.js';

export interface CargoSpec {
  mass: number;
  x: number;
  z: number;
}

export interface LoadingCondition {
  id: string;
  name: string;
  /** tank semantic id → fill percent */
  fills: Record<string, number>;
  cargo: CargoSpec;
  /** presets ship with the app; user conditions can be deleted */
  preset?: boolean;
}

export function presetConditions(model: Model): LoadingCondition[] {
  const fills = (f: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const t of model.tanks) out[t.id] = f[t.id] ?? 0;
    return out;
  };
  return [
    {
      id: 'preset:full-departure',
      name: '満載出港',
      preset: true,
      fills: fills({
        'tank:FO1.P': 98, 'tank:FO1.S': 98, 'tank:FW1.C': 100,
        'tank:APT.C': 0, 'tank:FPT.C': 0,
        'tank:WB1.P': 0, 'tank:WB1.S': 0, 'tank:WB2.P': 0, 'tank:WB2.S': 0,
      }),
      cargo: { mass: 5200, x: 66, z: 6.8 },
    },
    {
      id: 'preset:full-arrival',
      name: '満載入港(消耗品10%)',
      preset: true,
      fills: fills({
        'tank:FO1.P': 10, 'tank:FO1.S': 10, 'tank:FW1.C': 10,
        'tank:APT.C': 30, 'tank:FPT.C': 0,
        'tank:WB1.P': 0, 'tank:WB1.S': 0, 'tank:WB2.P': 0, 'tank:WB2.S': 0,
      }),
      cargo: { mass: 5200, x: 66, z: 6.8 },
    },
    {
      id: 'preset:ballast-departure',
      name: 'バラスト出港',
      preset: true,
      fills: fills({
        'tank:FO1.P': 95, 'tank:FO1.S': 95, 'tank:FW1.C': 100,
        'tank:APT.C': 60, 'tank:FPT.C': 100,
        'tank:WB1.P': 100, 'tank:WB1.S': 100, 'tank:WB2.P': 100, 'tank:WB2.S': 100,
      }),
      cargo: { mass: 0, x: 66, z: 6.2 },
    },
    {
      id: 'preset:lightship',
      name: '軽荷状態',
      preset: true,
      fills: fills({}),
      cargo: { mass: 0, x: 66, z: 6.2 },
    },
  ];
}

/**
 * Cargo as a weight item. For strength it is spread over a hold-like extent
 * of Lpp/2 centred on its LCG (clipped inside the hull) — the demo ship's two
 * cargo holds span 30–102 m, and bulk cargo is not a point load. Equilibrium
 * and stability use the centre of gravity either way.
 */
export function cargoAsWeights(model: Model, cargo: CargoSpec): WeightItem[] {
  if (cargo.mass <= 0) return [];
  const lpp = model.vessel.principal.lpp;
  const half = lpp / 4;
  return [
    {
      id: 'cargo:hold',
      name: '貨物',
      mass: cargo.mass,
      x: cargo.x,
      y: 0,
      z: cargo.z,
      x0: Math.max(0, cargo.x - half),
      x1: Math.min(lpp, cargo.x + half),
    },
  ];
}

/** Apply a condition's fills to the model (unknown tank ids are ignored). */
export function applyCondition(model: Model, cond: LoadingCondition): Model {
  let next = model;
  for (const t of model.tanks) {
    const fill = cond.fills[t.id];
    if (fill !== undefined && fill !== t.data.fillPercent) {
      next = withTank(next, t.id, { fillPercent: fill });
    }
  }
  return next;
}

export function snapshotCondition(
  model: Model,
  cargo: CargoSpec,
  name: string,
): LoadingCondition {
  const fills: Record<string, number> = {};
  for (const t of model.tanks) fills[t.id] = t.data.fillPercent;
  return { id: `user:${Date.now().toString(36)}`, name, fills, cargo };
}

// ---- persistence (sandbox-safe) -------------------------------------------

const STORAGE_KEY = 'digital-dock.conditions.v1';

export function loadSavedConditions(): LoadingCondition[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoadingCondition[];
    return Array.isArray(parsed) ? parsed.filter((c) => c && c.id && c.fills) : [];
  } catch {
    return []; // storage unavailable in this host — conditions stay in memory
  }
}

export function persistConditions(conds: LoadingCondition[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conds.filter((c) => !c.preset)));
    return true;
  } catch {
    return false;
  }
}

// ---- comparison ------------------------------------------------------------

export interface ConditionRow {
  condition: LoadingCondition;
  stability: L1Result;
  weather: WeatherResult;
  strength: StrengthResult;
  envelope: ReturnType<typeof checkEnvelope>;
  /** margin to the summer load line [m]; negative = overloaded */
  summerMargin: number | null;
  allPassed: boolean;
}

export function evaluateCondition(
  baseModel: Model,
  cond: LoadingCondition,
  perms: { permHog: number; permSag: number; permShear: number },
  summerDraft: number | null,
): ConditionRow {
  const model = applyCondition(baseModel, cond);
  const cargoWeights: WeightItem[] = cargoAsWeights(model, cond.cargo);
  const stability = runStability(model, cargoWeights, 5);
  const weather = runWeather(model, stability);
  const strength = runStrengthCalc(model, cargoWeights);
  const envelope = checkEnvelope(
    strength.stations,
    model.vessel.principal.lpp,
    perms.permHog,
    perms.permSag,
    perms.permShear,
  );
  const summerMargin =
    summerDraft === null ? null : summerDraft - stability.equilibrium.draftMean;
  const allPassed =
    stability.allCriteriaPassed &&
    (!weather.applicable || weather.passed) &&
    envelope.passed &&
    (summerMargin === null || summerMargin >= 0);
  return { condition: cond, stability, weather, strength, envelope, summerMargin, allPassed };
}
