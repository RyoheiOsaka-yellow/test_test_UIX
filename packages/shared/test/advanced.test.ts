import { describe, expect, it } from 'vitest';
import {
  computeStrength,
  crossCurves,
  defaultHeelAngles,
  evaluateWeather,
  generateBox,
  generateHull,
  interpTable,
  lightshipTrapezoid,
  runL1,
  solveFreeEquilibrium,
  windage,
  type L1Input,
} from '../src/index.js';

const DEG = Math.PI / 180;
const close = (actual: number, expected: number, tol: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
};

// ---------------------------------------------------------------------------
// Longitudinal strength
// ---------------------------------------------------------------------------

describe('longitudinal strength', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const rho = 1.025;
  const hull = generateBox(L, B, D, 41, 11);

  const boxInput = (mass: number, lcg: number, extras: L1Input['extraWeights'] = []): L1Input => ({
    rhoWater: rho,
    lightship: { mass, lcg, vcg: 5 },
    tanks: [],
    extraWeights: extras,
    lpp: L,
    beam: B,
  });

  it('lightship trapezoid reproduces mass and LCG exactly', () => {
    const w = lightshipTrapezoid(3000, 42, L);
    const n = 400;
    let m = 0;
    let mx = 0;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * L) / n;
      m += (w(x) * L) / n;
      mx += (w(x) * x * L) / n;
    }
    close(m, 3000, 0.5);
    close(mx / m, 42, 0.05);
  });

  it('uniform barge with uniform weight carries no shear and no moment', () => {
    // uniform weight over a box hull floating even keel: w(x) = b(x) everywhere
    const mass = L * B * 4 * rho;
    const r = computeStrength(hull, boxInput(mass, L / 2));
    const qMax = Math.max(...r.stations.map((s) => Math.abs(s.shear)));
    const mMax = Math.max(...r.stations.map((s) => Math.abs(s.moment)));
    // levers scale with W·L, so compare against that
    expect(qMax).toBeLessThan(mass * 0.005);
    expect(mMax).toBeLessThan(mass * L * 0.001);
  });

  it('a midship point load on a barge sags: positive moment peaking amidships', () => {
    const light = L * B * 2 * rho; // 2 m draft from lightship
    const cargo = 2000;
    const r = computeStrength(
      hull,
      boxInput(light, L / 2, [{ id: 'w', mass: cargo, x: L / 2, y: 0, z: 5 }]),
    );
    expect(r.maxSagging.value).toBeGreaterThan(0);
    close(r.maxSagging.x, L / 2, 6);
    // analytic estimate: point load W on uniform-buoyancy beam → M_mid = W·L/8,
    // reduced because the load is spread over L/20
    const analytic = (cargo * L) / 8;
    close(r.maxSagging.value, analytic, analytic * 0.15);
  });

  it('closes shear and moment at the perpendiculars', () => {
    const r = computeStrength(
      hull,
      boxInput(L * B * 3 * rho, 46, [{ id: 'w', mass: 1500, x: 70, y: 0, z: 5 }]),
    );
    const last = r.stations[r.stations.length - 1];
    expect(Math.abs(last.shear)).toBeLessThan(1e-6);
    expect(Math.abs(last.moment)).toBeLessThan(1e-6);
    expect(r.closure.shearResidual).toBeLessThan(0.02);
    expect(r.closure.momentResidual).toBeLessThan(0.03);
  });

  it('weight and buoyancy distributions integrate to the displacement', () => {
    const input = boxInput(L * B * 3 * rho, 50);
    const r = computeStrength(hull, input);
    const xs = r.stations.map((s) => s.x);
    const trap = (ys: number[]) => {
      let s = 0;
      for (let i = 1; i < xs.length; i++) s += ((ys[i - 1] + ys[i]) / 2) * (xs[i] - xs[i - 1]);
      return s;
    };
    const wTot = trap(r.stations.map((s) => s.weight));
    const bTot = trap(r.stations.map((s) => s.buoyancy));
    close(wTot, input.lightship.mass, input.lightship.mass * 0.001);
    close(bTot, r.equilibrium.displacement, r.equilibrium.displacement * 0.002);
  });
});

// ---------------------------------------------------------------------------
// Cross curves (KN)
// ---------------------------------------------------------------------------

describe('KN cross curves', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const hull = generateBox(L, B, D, 21, 11);

  it('KN at small heel matches KM·sinφ for a box barge', () => {
    const T = 4;
    const disp = L * B * T * 1.025;
    const [c] = crossCurves(hull, {
      rhoWater: 1.025,
      lpp: L,
      beam: B,
      lcg: L / 2,
      displacements: [disp],
      heelsDeg: [2],
    });
    // KN ≈ KM·sinφ with KM = T/2 + B²/12T
    const km = T / 2 + (B * B) / (12 * T);
    close(c.points[0].kn, km * Math.sin(2 * DEG), 0.02);
  });

  it('GZ recovered from KN matches the direct solve', () => {
    const T = 4;
    const disp = L * B * T * 1.025;
    const KG = 5;
    const heels = [10, 20, 30];
    const curves = crossCurves(hull, {
      rhoWater: 1.025,
      lpp: L,
      beam: B,
      lcg: L / 2,
      displacements: [disp],
      heelsDeg: heels,
    });
    const input: L1Input = {
      rhoWater: 1.025,
      lightship: { mass: disp, lcg: L / 2, vcg: KG },
      tanks: [],
      lpp: L,
      beam: B,
    };
    const direct = runL1(hull, input, { heelAngles: defaultHeelAngles(40, 10) });
    for (const curve of curves) {
      const gzFromKn = curve.points[0].kn - KG * Math.sin(curve.heelDeg * DEG);
      const gzDirect = direct.gz.find((p) => p.heelDeg === curve.heelDeg)!.gz;
      close(gzFromKn, gzDirect, 5e-3);
    }
  });

  it('KN grows with heel through the working range', () => {
    const disp = L * B * 4 * 1.025;
    const curves = crossCurves(hull, {
      rhoWater: 1.025, lpp: L, beam: B, lcg: L / 2,
      displacements: [disp],
      heelsDeg: [10, 20, 30, 40],
    });
    const kns = curves.map((c) => c.points[0].kn);
    for (let i = 1; i < kns.length; i++) expect(kns[i]).toBeGreaterThan(kns[i - 1]);
  });
});

// ---------------------------------------------------------------------------
// Weather criterion
// ---------------------------------------------------------------------------

describe('weather criterion (IS Code 2.3)', () => {
  const L = 120;
  const B = 20;
  const D = 12;
  const hull = generateHull({ lpp: L, beam: B, depth: D });
  const input: L1Input = {
    rhoWater: 1.025,
    lightship: { mass: 2100, lcg: 54, vcg: 7.8 },
    tanks: [],
    extraWeights: [{ id: 'cargo', mass: 2600, x: 66, y: 0, z: 6.2 }],
    lpp: L,
    beam: B,
  };
  const l1 = runL1(hull, input, { heelAngles: defaultHeelAngles(75, 2.5) });

  it('interpolates the code tables correctly', () => {
    close(interpTable([[2.4, 1.0], [2.5, 0.98]], 2.45), 0.99, 1e-9);
    close(interpTable([[6, 0.1], [7, 0.098]], 5), 0.1, 1e-12); // clamps low
    close(interpTable([[6, 0.1], [7, 0.098]], 8), 0.098, 1e-12); // clamps high
  });

  it('windage area equals profile area above the waterline for a box', () => {
    const box = generateBox(100, 20, 10, 11, 5);
    const w = windage(box, 4);
    close(w.area, 100 * 6, 1e-6); // (D − T)·L
    close(w.centroidAboveWl, 3, 1e-6);
    close(w.leverZ, 3 + 2, 1e-6);
  });

  it('evaluates the criterion on a healthy condition', () => {
    const w = evaluateWeather({
      hull,
      gz: l1.gz,
      equilibrium: l1.equilibrium,
      gm0: l1.gm0,
      lpp: L,
      beam: B,
      kg: l1.equilibrium.kg,
      floodingAngleDeg: 40,
    });
    expect(w.applicable).toBe(true);
    expect(w.lw1).toBeGreaterThan(0);
    close(w.lw2, 1.5 * w.lw1, 5e-6); // both sides carry 1e-6 rounding
    expect(w.phi0).toBeGreaterThan(0);
    expect(w.phi0).toBeLessThan(16);
    expect(w.phi1).toBeGreaterThan(5); // roll-back angles are typically 10–25°
    expect(w.phi1).toBeLessThan(35);
    expect(w.rollPeriod).toBeGreaterThan(3);
    expect(w.areaB).toBeGreaterThan(0);
    expect(typeof w.passed).toBe('boolean');
  });

  it('a stiffer ship (larger GM) rolls faster', () => {
    const base = evaluateWeather({
      hull, gz: l1.gz, equilibrium: l1.equilibrium, gm0: l1.gm0,
      lpp: L, beam: B, kg: l1.equilibrium.kg, floodingAngleDeg: 40,
    });
    const stiffer = evaluateWeather({
      hull, gz: l1.gz, equilibrium: l1.equilibrium, gm0: l1.gm0 * 2,
      lpp: L, beam: B, kg: l1.equilibrium.kg, floodingAngleDeg: 40,
    });
    expect(stiffer.rollPeriod).toBeLessThan(base.rollPeriod);
  });

  it('reports non-applicability instead of nonsense when GM ≤ 0', () => {
    const w = evaluateWeather({
      hull, gz: l1.gz, equilibrium: l1.equilibrium, gm0: -0.2,
      lpp: L, beam: B, kg: l1.equilibrium.kg, floodingAngleDeg: 40,
    });
    expect(w.applicable).toBe(false);
    expect(w.reason).toMatch(/GM/);
  });
});

// ---------------------------------------------------------------------------
// Damage stability (lost buoyancy)
// ---------------------------------------------------------------------------

describe('damage stability — lost buoyancy', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const rho = 1.025;
  const hull = generateBox(L, B, D, 41, 11);
  const intactInput: L1Input = {
    rhoWater: rho,
    lightship: { mass: L * B * 4 * rho, lcg: L / 2, vcg: 5 },
    tanks: [],
    lpp: L,
    beam: B,
  };

  it('zero permeability changes nothing', () => {
    const intact = solveFreeEquilibrium(hull, intactInput);
    const damaged = solveFreeEquilibrium(hull, {
      ...intactInput,
      damage: { x0: 40, x1: 60, permeability: 0 },
    });
    close(damaged.draftMean, intact.draftMean, 1e-6);
    close(damaged.trimByStern, intact.trimByStern, 1e-6);
  });

  it('a symmetric midship flood sinks the barge by the analytic amount', () => {
    // Lost buoyancy over l = 20 m with μ = 1: new draft T' from
    // (L − l)·B·T' = L·B·T  → T' = T·L/(L−l) = 5 m
    const damaged = solveFreeEquilibrium(hull, {
      ...intactInput,
      damage: { x0: 40, x1: 60, permeability: 1 },
    });
    close(damaged.draftMean, 5, 0.15); // station-resolution tolerance
    close(damaged.trimByStern, 0, 0.02);
    close(damaged.heelDeg, 0, 1e-6);
  });

  it('an end flood trims the vessel toward the damage', () => {
    const damaged = solveFreeEquilibrium(hull, {
      ...intactInput,
      damage: { x0: 0, x1: 20, permeability: 0.85 },
    });
    expect(damaged.trimByStern).toBeGreaterThan(0.5); // stern-down
    expect(damaged.draftMean).toBeGreaterThan(4);
  });

  it('damage reduces GM through the lost waterplane', () => {
    const intact = runL1(hull, intactInput, { heelAngles: defaultHeelAngles(40, 10) });
    const damaged = runL1(
      hull,
      { ...intactInput, damage: { x0: 40, x1: 60, permeability: 1 } },
      { heelAngles: defaultHeelAngles(40, 10) },
    );
    expect(damaged.gm0).toBeLessThan(intact.gm0);
    expect(damaged.gzMax).toBeLessThan(intact.gzMax);
    expect(damaged.equilibrium.displacement).toBeCloseTo(intact.equilibrium.displacement, 0);
  });
});
