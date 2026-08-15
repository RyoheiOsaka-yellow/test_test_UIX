import { describe, expect, it } from 'vitest';
import {
  bendingDistribution,
  checkEnvelope,
  computeFreeboard,
  generateBox,
  ruleEnvelope,
  shearDistribution,
  solveFreeEquilibrium,
  standardSheerMean,
  tabularFreeboardTypeB,
  waveCoefficient,
  type L1Input,
} from '../src/index.js';

const close = (actual: number, expected: number, tol: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
};

// ---------------------------------------------------------------------------
// Class-rule envelopes
// ---------------------------------------------------------------------------

describe('class-rule envelopes (UR S7/S11 style)', () => {
  it('wave coefficient matches the S11 formula', () => {
    close(waveCoefficient(120), 10.75 - Math.pow(1.8, 1.5), 1e-9); // 8.335
    close(waveCoefficient(300), 10.75, 1e-9);
    expect(() => waveCoefficient(50)).toThrow(/90–300/);
  });

  it('produces plausible magnitudes for a 120 m cargo ship', () => {
    const env = ruleEnvelope({ lpp: 120, beam: 20, cb: 0.7 });
    // sagging wave moment ~ 0.11·8.335·120²·20·1.4 kN·m ≈ 3.70e5 kN·m ≈ 37,700 t·m
    close(env.mWaveSag, 37700, 1500);
    expect(env.mWaveHog).toBeGreaterThan(30000);
    expect(env.mPermSag).toBeGreaterThan(0);
    expect(env.mPermHog).toBeGreaterThan(env.mPermSag); // sag wave moment is larger
    expect(env.qPerm).toBeGreaterThan(500);
    expect(env.qPerm).toBeLessThan(10000);
  });

  it('applies the rule floor Cb = 0.60', () => {
    const low = ruleEnvelope({ lpp: 120, beam: 20, cb: 0.45 });
    const floor = ruleEnvelope({ lpp: 120, beam: 20, cb: 0.6 });
    expect(low.mWaveHog).toBe(floor.mWaveHog);
  });

  it('distributions are 1.0 amidships and 0 at the perpendiculars', () => {
    close(bendingDistribution(60, 120), 1, 1e-12);
    close(bendingDistribution(0, 120), 0, 1e-12);
    close(bendingDistribution(21, 120), 0.5, 1e-9); // 0.175L
    close(shearDistribution(30, 120), 1, 1e-12); // quarter point
    close(shearDistribution(60, 120), 0.6, 1e-12);
    close(shearDistribution(0, 120), 0, 1e-12);
  });

  it('checkEnvelope finds the worst utilization and its location', () => {
    const lpp = 100;
    // curves shaped exactly like the envelopes → uniform, known utilization
    const stations = [];
    for (let x = 0; x <= lpp; x += 5) {
      stations.push({
        x,
        shear: 800 * shearDistribution(x, lpp),
        moment: 30000 * bendingDistribution(x, lpp),
      });
    }
    const chk = checkEnvelope(stations, lpp, 50000, 40000, 1000);
    close(chk.saggingUtil, 30000 / 40000, 1e-6);
    close(chk.shearUtil, 800 / 1000, 1e-6);
    expect(chk.passed).toBe(true);
    const fail = checkEnvelope(stations, lpp, 50000, 20000, 1000);
    expect(fail.passed).toBe(false);
    expect(fail.saggingUtil).toBeGreaterThan(1);

    // a hogging curve exercises the other envelope
    const hog = checkEnvelope(
      stations.map((s) => ({ ...s, moment: -s.moment })),
      lpp, 40000, 50000, 1000,
    );
    close(hog.hoggingUtil, 30000 / 40000, 1e-6);
  });
});

// ---------------------------------------------------------------------------
// Freeboard (ILLC)
// ---------------------------------------------------------------------------

describe('freeboard (ILLC 1966, Type B)', () => {
  it('tabular values and interpolation', () => {
    close(tabularFreeboardTypeB(120), 1690, 1e-9);
    close(tabularFreeboardTypeB(100), 1271, 1e-9);
    close(tabularFreeboardTypeB(125), (1690 + 1909) / 2, 1e-9);
    expect(() => tabularFreeboardTypeB(80)).toThrow(/90–200/);
  });

  it('standard sheer mean follows regulation 38 ordinates', () => {
    // k = L/3 + 10; mean = ((25+33.3+8.4)k/8 + (16.8+66.6+50)k/8)/2 = 12.5065·k
    const L = 120;
    const k = L / 3 + 10;
    close(standardSheerMean(L), ((25 + 3 * 11.1 + 3 * 2.8) / 8 + (3 * 5.6 + 3 * 22.2 + 50) / 8) / 2 * k, 1e-6);
  });

  it('computes a full breakdown for the demo ship', () => {
    const fb = computeFreeboard({
      lpp: 120, beam: 20, depth: 12,
      cb85: 0.62, // below 0.68 → no Cb correction
      rhoWater: 1.025,
      summerDisplacement: 12000,
      summerTpc: 19.5,
    });
    const byLabel = Object.fromEntries(fb.steps.map((s) => [s.label, s.value]));
    expect(byLabel['基本乾舷(Type B 表)']).toBe(1690);
    expect(byLabel['方形係数修正']).toBe(0);
    // D=12 > L/15=8 → +250·4 = 1000 mm
    expect(byLabel['深さ修正']).toBe(1000);
    expect(byLabel['シアー不足加算']).toBeGreaterThan(300); // flat deck pays for missing sheer
    expect(fb.summerFreeboard).toBeGreaterThan(2.6);
    // each figure is rounded to a millimetre independently
    close(fb.summerDraft, 12 - fb.summerFreeboard, 2e-3);
    close(fb.tropicalDraft, fb.summerDraft * (1 + 1 / 48), 2e-3);
    close(fb.winterDraft, fb.summerDraft * (1 - 1 / 48), 2e-3);
    expect(fb.fwa).toBe(Math.round(12000 / (4 * 19.5)));
  });

  it('applies the Cb correction above 0.68', () => {
    const lo = computeFreeboard({ lpp: 120, beam: 20, depth: 12, cb85: 0.68, rhoWater: 1.025 });
    const hi = computeFreeboard({ lpp: 120, beam: 20, depth: 12, cb85: 0.8, rhoWater: 1.025 });
    expect(hi.summerFreeboard).toBeGreaterThan(lo.summerFreeboard);
  });

  it('checks minimum bow height', () => {
    const fb = computeFreeboard({ lpp: 120, beam: 20, depth: 12, cb85: 0.62, rhoWater: 1.025 });
    // required ≈ 56·120·(1−0.24)·(1.36/1.30)/1000 ≈ 5.34 m
    close(fb.bowHeightRequired, 5.34, 0.1);
    expect(typeof fb.bowHeightPassed).toBe('boolean');
    close(fb.bowHeightActual, fb.summerFreeboard, 1e-9); // flat deck: bow height = freeboard
  });
});

// ---------------------------------------------------------------------------
// Multi-zone asymmetric flooding & cross-flooding
// ---------------------------------------------------------------------------

describe('multi-zone and asymmetric flooding', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const rho = 1.025;
  const hull = generateBox(L, B, D, 41, 11);
  const base: L1Input = {
    rhoWater: rho,
    lightship: { mass: L * B * 4 * rho, lcg: L / 2, vcg: 5 },
    tanks: [],
    lpp: L,
    beam: B,
  };

  it('two half-beam zones equal one full-beam zone', () => {
    const full = solveFreeEquilibrium(hull, {
      ...base,
      damage: { x0: 40, x1: 60, permeability: 0.8 },
    });
    const halves = solveFreeEquilibrium(hull, {
      ...base,
      damage: [
        { x0: 40, x1: 60, permeability: 0.8, y0: -B / 2, y1: 0 },
        { x0: 40, x1: 60, permeability: 0.8, y0: 0, y1: B / 2 },
      ],
    });
    close(halves.draftMean, full.draftMean, 1e-6);
    close(halves.heelDeg, full.heelDeg, 1e-6);
  });

  it('a one-sided wing flood heels the ship toward the damage', () => {
    const damaged = solveFreeEquilibrium(hull, {
      ...base,
      damage: { x0: 40, x1: 60, permeability: 1, y0: 0, y1: B / 2 }, // starboard side
    });
    expect(damaged.heelDeg).toBeGreaterThan(2); // heels to starboard (positive)
    expect(damaged.draftMean).toBeGreaterThan(4);
  });

  it('cross-flooding (mirrored zone) removes the heel but adds sinkage', () => {
    const oneSide = solveFreeEquilibrium(hull, {
      ...base,
      damage: { x0: 40, x1: 60, permeability: 1, y0: 0, y1: B / 2 },
    });
    const equalized = solveFreeEquilibrium(hull, {
      ...base,
      damage: [
        { x0: 40, x1: 60, permeability: 1, y0: 0, y1: B / 2 },
        { x0: 40, x1: 60, permeability: 1, y0: -B / 2, y1: 0 },
      ],
    });
    close(equalized.heelDeg, 0, 1e-6);
    expect(equalized.draftMean).toBeGreaterThan(oneSide.draftMean);
  });

  it('two separate compartments flood deeper than either alone', () => {
    const one = solveFreeEquilibrium(hull, {
      ...base,
      damage: [{ x0: 20, x1: 35, permeability: 0.85 }],
    });
    const two = solveFreeEquilibrium(hull, {
      ...base,
      damage: [
        { x0: 20, x1: 35, permeability: 0.85 },
        { x0: 65, x1: 80, permeability: 0.85 },
      ],
    });
    expect(two.draftMean).toBeGreaterThan(one.draftMean);
    close(two.trimByStern, 0, 0.05); // symmetric pair fore/aft of midship
  });
});
