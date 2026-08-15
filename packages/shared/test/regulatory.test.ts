import { describe, expect, it } from 'vitest';
import {
  buildDamageCases,
  damageProbability,
  defaultHeelAngles,
  evaluateGrain,
  evaluateSubdivision,
  floodableVolume,
  generateBox,
  grainArm,
  requiredIndex,
  runL1,
  simulateFlooding,
  survivabilityFactor,
  JMAX,
  type FloodSpace,
  type GzPoint,
  type L1Input,
  type SubdivisionZone,
} from '../src/index.js';

const DEG = Math.PI / 180;
const close = (actual: number, expected: number, tol: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
};

const sineCurve = (gm: number, scale = 1): GzPoint[] =>
  defaultHeelAngles(75, 2.5).map((a) => ({
    heelDeg: a,
    gz: scale * gm * Math.sin(a * DEG) * Math.cos((a * DEG) / 2.2),
    trimDeg: 0,
    draftMean: 5,
    converged: true,
  }));

// ---------------------------------------------------------------------------
// Grain Code
// ---------------------------------------------------------------------------

describe('grain stability (IMO Grain Code)', () => {
  const holds = [
    { id: 'CH1', name: 'Hold 1', length: 36, breadth: 20, partlyFilled: false },
    { id: 'CH2', name: 'Hold 2', length: 36, breadth: 20, partlyFilled: true },
  ];

  it('volumetric heeling moment follows l·b³/12·tanδ per hold', () => {
    const r = evaluateGrain({
      holds,
      stowageFactor: 1.3,
      displacement: 8000,
      gz: sineCurve(3),
      gm0: 3,
      floodingAngleDeg: 40,
      deckImmersionAngleDeg: 30,
    });
    const i = (36 * 8000) / 12; // l·b³/12 per hold
    const expected = i * Math.tan(15 * DEG) + i * Math.tan(25 * DEG);
    close(r.vhm, expected, 1);
    close(r.lambda0, expected / (1.3 * 8000), 1e-4); // results carry 1e-4 rounding
    close(r.lambda40, 0.8 * r.lambda0, 1e-4);
  });

  it('the heeling arm is linear from λ0 to 0.8·λ0 at 40°', () => {
    close(grainArm(1, 0), 1, 1e-12);
    close(grainArm(1, 20), 0.9, 1e-12);
    close(grainArm(1, 40), 0.8, 1e-12);
    close(grainArm(1, 55), 0.8, 1e-12); // held beyond 40°
  });

  it('a stiff, trimmed-full ship passes and a tender one fails', () => {
    // full-beam grain surfaces are punishing; passing needs trimmed holds
    // (15° shift), a healthy displacement and a strong GZ curve
    const trimmedHolds = holds.map((h) => ({ ...h, partlyFilled: false }));
    const base = {
      holds: trimmedHolds,
      stowageFactor: 1.5,
      displacement: 12000,
      floodingAngleDeg: 40,
      deckImmersionAngleDeg: 30 as number | null,
    };
    const stiff = evaluateGrain({ ...base, gz: sineCurve(4), gm0: 4 });
    expect(stiff.passed).toBe(true);
    expect(stiff.heelAngleDeg).not.toBeNull();
    expect(stiff.heelAngleDeg!).toBeLessThan(12);

    const tender = evaluateGrain({ ...base, gz: sineCurve(0.2), gm0: 0.2 });
    expect(tender.passed).toBe(false);
    const byId = Object.fromEntries(tender.criteria.map((c) => [c.id, c]));
    expect(byId.gm.passed).toBe(false);
  });

  it('more displacement means a smaller heeling arm and heel', () => {
    const light = evaluateGrain({
      holds, stowageFactor: 1.3, displacement: 6000,
      gz: sineCurve(3), gm0: 3, floodingAngleDeg: 40, deckImmersionAngleDeg: null,
    });
    const heavy = evaluateGrain({
      holds, stowageFactor: 1.3, displacement: 18000,
      gz: sineCurve(3), gm0: 3, floodingAngleDeg: 40, deckImmersionAngleDeg: null,
    });
    expect(heavy.lambda0).toBeLessThan(light.lambda0);
    expect(heavy.heelAngleDeg!).toBeLessThan(light.heelAngleDeg!);
  });
});

// ---------------------------------------------------------------------------
// Probabilistic subdivision
// ---------------------------------------------------------------------------

describe('probabilistic subdivision index', () => {
  it('required index matches Reg 6', () => {
    close(requiredIndex(120), 1 - 128 / 272, 1e-9); // ≈ 0.5294
  });

  it('damage probabilities over all case groups sum below 1 with a remainder', () => {
    const ls = 120;
    const zones: SubdivisionZone[] = [
      { id: 'z1', name: 'A', x0: 0, x1: 30, permeability: 0.85 },
      { id: 'z2', name: 'B', x0: 30, x1: 70, permeability: 0.7 },
      { id: 'z3', name: 'C', x0: 70, x1: 120, permeability: 0.7 },
    ];
    const groups = buildDamageCases(zones);
    expect(groups).toHaveLength(5); // 3 singles + 2 pairs
    let total = 0;
    for (const g of groups) {
      total += damageProbability(ls, g[0], g[g.length - 1]);
    }
    expect(total).toBeGreaterThan(0.8); // most damages hit ≤ 2 zones
    expect(total).toBeLessThanOrEqual(1.000001);
  });

  it('a longer zone collects more probability', () => {
    const ls = 120;
    const small = damageProbability(ls, { x0: 0, x1: 20 }, { x0: 0, x1: 20 });
    const large = damageProbability(ls, { x0: 0, x1: 60 }, { x0: 0, x1: 60 });
    expect(large).toBeGreaterThan(small);
  });

  it('survivability factor follows Reg 7-2', () => {
    const gz = sineCurve(2);
    const good = survivabilityFactor(gz, 0, 60);
    close(good.s, 1, 1e-6); // GZmax and range both at their caps
    const heeled = survivabilityFactor(gz, 27.5, 60);
    expect(heeled.s).toBeLessThan(good.s); // K = √(2.5/5)
    close(heeled.s / survivabilityFactor(gz, 25, 60).s, Math.sqrt((30 - 27.5) / 5), 0.05);
    const lost = survivabilityFactor(gz, 35, 60);
    expect(lost.s).toBe(0);
  });

  it('evaluates A against R for the box barge and finds it survivable', () => {
    const L = 120;
    const hull = generateBox(L, 20, 10, 41, 11);
    const input: L1Input = {
      rhoWater: 1.025,
      lightship: { mass: L * 20 * 3 * 1.025, lcg: L / 2, vcg: 4 },
      tanks: [],
      lpp: L,
      beam: 20,
    };
    const zones: SubdivisionZone[] = [
      { id: 'z1', name: 'fore', x0: 0, x1: 40, permeability: 0.7 },
      { id: 'z2', name: 'mid', x0: 40, x1: 80, permeability: 0.7 },
      { id: 'z3', name: 'aft', x0: 80, x1: 120, permeability: 0.7 },
    ];
    const result = evaluateSubdivision(L, zones, {
      solveDamage: (damage) =>
        runL1(hull, { ...input, damage }, { heelAngles: defaultHeelAngles(40, 10) }),
      floodingAngleDeg: 40,
    });
    expect(result.cases).toHaveLength(5);
    // a roomy box barge at shallow draft survives every single-zone flood
    for (const c of result.cases.slice(0, 3)) {
      expect(c.survives).toBe(true);
      expect(c.s).toBeGreaterThan(0.9);
    }
    expect(result.attained).toBeGreaterThan(0);
    expect(result.attained).toBeLessThanOrEqual(1);
    close(result.required, requiredIndex(L), 1e-4); // result carries 1e-4 rounding
    expect(typeof result.passed).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Time-domain flooding
// ---------------------------------------------------------------------------

describe('time-domain flooding', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const hull = generateBox(L, B, D, 21, 11);
  const intact: L1Input = {
    rhoWater: 1.025,
    lightship: { mass: L * B * 3 * 1.025, lcg: L / 2, vcg: 4.5 },
    tanks: [],
    lpp: L,
    beam: B,
  };
  const wing = (side: 'P' | 'S'): FloodSpace => ({
    id: `W${side}`,
    x0: 40, x1: 60,
    y0: side === 'P' ? -B / 2 : 2,
    y1: side === 'P' ? -2 : B / 2,
    z0: 0, z1: 6,
    permeability: 0.95,
  });

  it('floodable volume respects permeability', () => {
    close(floodableVolume(wing('S')), 20 * 8 * 6 * 0.95, 1e-9);
  });

  it('a wing breach heels the ship over time; volume grows monotonically', () => {
    const r = simulateFlooding(hull, intact, {
      space: wing('S'),
      breach: { area: 0.5, cd: 0.6, z: 1 },
      dt: 5,
      tMax: 120,
    });
    expect(r.capsizedAt).toBeNull();
    expect(r.series.length).toBeGreaterThan(10);
    const heels = r.series.map((s) => s.heelDeg);
    expect(Math.max(...heels)).toBeGreaterThan(1); // heels toward the breach
    for (let i = 1; i < r.series.length; i++) {
      expect(r.series[i].volBreached).toBeGreaterThanOrEqual(r.series[i - 1].volBreached - 1e-6);
    }
    // inflow slows as the head closes
    const q1 = r.series[1].volBreached - r.series[0].volBreached;
    const qEnd = r.series[r.series.length - 1].volBreached - r.series[r.series.length - 2].volBreached;
    expect(qEnd).toBeLessThan(q1);
  });

  it('a cross-flooding duct equalizes the heel that a plain breach leaves', () => {
    const noDuct = simulateFlooding(hull, intact, {
      space: wing('S'),
      breach: { area: 0.8, cd: 0.6, z: 1 },
      dt: 5,
      tMax: 300,
    });
    const withDuct = simulateFlooding(hull, intact, {
      space: wing('S'),
      breach: { area: 0.8, cd: 0.6, z: 1 },
      duct: { toSpace: wing('P'), area: 0.4, cd: 0.6, z: 0.3 },
      dt: 5,
      tMax: 300,
    });
    const lastNo = noDuct.series[noDuct.series.length - 1];
    const lastDuct = withDuct.series[withDuct.series.length - 1];
    expect(Math.abs(lastDuct.heelDeg)).toBeLessThan(Math.abs(lastNo.heelDeg));
    expect(lastDuct.volDuct).toBeGreaterThan(0); // water crossed the duct
    expect(withDuct.equalizedAt).not.toBeNull();
  });

  it('a larger duct equalizes faster', () => {
    const slow = simulateFlooding(hull, intact, {
      space: wing('S'),
      breach: { area: 0.8, cd: 0.6, z: 1 },
      duct: { toSpace: wing('P'), area: 0.15, cd: 0.6, z: 0.3 },
      dt: 5,
      tMax: 400,
    });
    const fast = simulateFlooding(hull, intact, {
      space: wing('S'),
      breach: { area: 0.8, cd: 0.6, z: 1 },
      duct: { toSpace: wing('P'), area: 0.6, cd: 0.6, z: 0.3 },
      dt: 5,
      tMax: 400,
    });
    expect(fast.equalizedAt).not.toBeNull();
    if (slow.equalizedAt !== null) {
      expect(fast.equalizedAt!).toBeLessThanOrEqual(slow.equalizedAt);
    }
  });

  it('volumes never exceed the floodable volume', () => {
    const r = simulateFlooding(hull, intact, {
      space: wing('S'),
      breach: { area: 2, cd: 0.6, z: 0.5 },
      dt: 5,
      tMax: 400,
    });
    const cap = floodableVolume(wing('S'));
    for (const s of r.series) {
      expect(s.volBreached).toBeLessThanOrEqual(cap + 1e-6);
    }
  });
});
