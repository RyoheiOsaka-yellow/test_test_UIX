import { describe, expect, it } from 'vitest';
import {
  canonicalStringify,
  computeHydrostatics,
  generateBox,
  generateHull,
  generateVPrism,
  tankState,
} from '../src/index.js';
import type { TankEntityData } from '../src/index.js';

const relClose = (actual: number, expected: number, tol = 1e-6) => {
  const scale = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected) / scale).toBeLessThan(tol);
};

describe('hydrostatics — box barge (analytic reference)', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const T = 5;
  const rho = 1.025;
  const kg = 5;
  const hull = generateBox(L, B, D);
  const r = computeHydrostatics(hull, { draft: T, rhoWater: rho, kg }, { lpp: L, beam: B });

  it('volume and displacement are exact', () => {
    relClose(r.volume, L * B * T);
    relClose(r.displacement, L * B * T * rho);
  });

  it('centres of buoyancy', () => {
    relClose(r.kb, T / 2);
    relClose(r.lcb, L / 2);
  });

  it('waterplane properties', () => {
    relClose(r.awp, L * B);
    relClose(r.lcf, L / 2);
    relClose(r.it, (L * Math.pow(B, 3)) / 12);
    relClose(r.il, (B * Math.pow(L, 3)) / 12);
  });

  it('metacentric values', () => {
    const bmt = (L * Math.pow(B, 3)) / 12 / (L * B * T);
    relClose(r.bmt, bmt);
    relClose(r.kmt, T / 2 + bmt);
    relClose(r.gmtSolid, T / 2 + bmt - kg);
    relClose(r.gmt, r.gmtSolid); // no tanks → no free-surface correction
  });

  it('TPC and MCT1cm', () => {
    relClose(r.tpc, (L * B * rho) / 100);
    const gml = T / 2 + (B * Math.pow(L, 3)) / 12 / (L * B * T) - kg;
    relClose(r.mct1cm, (r.displacement * gml) / (100 * L));
  });

  it('form coefficients are 1 for a box', () => {
    relClose(r.cb, 1);
    relClose(r.cp, 1);
    relClose(r.cm, 1);
    relClose(r.cw, 1);
  });
});

describe('hydrostatics — V-prism (analytic reference)', () => {
  const L = 60;
  const B = 12;
  const D = 6;
  const T = 3;
  const hull = generateVPrism(L, B, D);
  const r = computeHydrostatics(hull, { draft: T, rhoWater: 1.0, kg: 2 }, { lpp: L, beam: B });

  it('triangular section integrates exactly', () => {
    // y(z) = (B/2D)·z → section area = 2·∫₀ᵀ y dz = (B/2D)·T²... with B/2D = 1 → 9 m²
    relClose(r.volume, 9 * L);
    relClose(r.kb, (2 / 3) * T); // centroid of triangle from apex
  });

  it('waterplane at draft', () => {
    const yT = (B / (2 * D)) * T; // = 3
    relClose(r.awp, 2 * yT * L);
    relClose(r.it, (2 / 3) * L * Math.pow(yT, 3));
    relClose(r.bmt, r.it / r.volume);
  });
});

describe('partial-depth drafts interpolate linearly', () => {
  it('box volume scales linearly with draft between waterlines', () => {
    const hull = generateBox(50, 10, 8, 11, 5); // waterlines every 2 m
    const r = computeHydrostatics(hull, { draft: 3.17, rhoWater: 1.025, kg: 3 }, { lpp: 50, beam: 10 });
    relClose(r.volume, 50 * 10 * 3.17);
  });
});

describe('tanks', () => {
  const tank: TankEntityData = {
    kind: 'tank',
    name: 'WB1.P',
    x0: 10, x1: 20, y0: -5, y1: 0, z0: 0, z1: 2,
    fluid: { name: 'SW Ballast', density: 1.025 },
    fillPercent: 50,
  };

  it('capacity, volume, mass', () => {
    const s = tankState(tank);
    relClose(s.capacity, 10 * 5 * 2);
    relClose(s.fluidVolume, 50);
    relClose(s.fluidMass, 50 * 1.025);
  });

  it('free-surface moment for slack tank, zero when pressed or empty', () => {
    const slack = tankState(tank);
    relClose(slack.freeSurfaceMoment, 1.025 * (10 * Math.pow(5, 3)) / 12);
    const full = tankState({ ...tank, fillPercent: 100 });
    expect(full.freeSurfaceMoment).toBe(0);
    const empty = tankState({ ...tank, fillPercent: 0 });
    expect(empty.freeSurfaceMoment).toBe(0);
  });

  it('free-surface correction reduces GM', () => {
    const hull = generateBox(100, 20, 10);
    const base = computeHydrostatics(hull, { draft: 5, rhoWater: 1.025, kg: 5 }, { lpp: 100, beam: 20 });
    const withTank = computeHydrostatics(
      hull,
      { draft: 5, rhoWater: 1.025, kg: 5 },
      { lpp: 100, beam: 20, tanks: [tank] },
    );
    expect(withTank.gmt).toBeLessThan(base.gmt);
    relClose(withTank.fsc, tankState(tank).freeSurfaceMoment / base.displacement, 1e-6);
  });
});

describe('parametric hull generator', () => {
  const L = 120;
  const B = 20;
  const D = 12;
  const hull = generateHull({ lpp: L, beam: B, depth: D });

  it('produces a plausible merchant-ship form', () => {
    const r = computeHydrostatics(hull, { draft: 7, rhoWater: 1.025, kg: 7.5 }, { lpp: L, beam: B });
    expect(r.cb).toBeGreaterThan(0.45);
    expect(r.cb).toBeLessThan(0.9);
    expect(r.cw).toBeGreaterThan(r.cb); // waterplane fuller than block
    expect(r.kb).toBeGreaterThan(0.5 * 7 * 0.8); // KB above 40% draft for normal forms
    expect(r.gmtSolid).toBeGreaterThan(0);
  });

  it('displacement grows monotonically with draft', () => {
    let prev = 0;
    for (const t of [2, 4, 6, 8, 10]) {
      const r = computeHydrostatics(hull, { draft: t, rhoWater: 1.025, kg: 7 }, { lpp: L, beam: B });
      expect(r.volume).toBeGreaterThan(prev);
      prev = r.volume;
    }
  });

  it('sections never exceed half beam and are symmetric in definition', () => {
    for (const s of hull.stations) {
      for (const o of s.offsets) {
        expect(o.y).toBeLessThanOrEqual(B / 2 + 1e-9);
        expect(o.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('canonical stringify', () => {
  it('is independent of key order', () => {
    const a = canonicalStringify({ b: 1, a: [{ y: 2, x: 3 }] });
    const b = canonicalStringify({ a: [{ x: 3, y: 2 }], b: 1 });
    expect(a).toBe(b);
  });
});
