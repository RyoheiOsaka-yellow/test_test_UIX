import { describe, expect, it } from 'vitest';
import {
  areaUnderGz,
  boxBelowPlane,
  clipHalfPlane,
  computeHydrostatics,
  defaultHeelAngles,
  evaluateCriteria,
  generateBox,
  generateHull,
  gzAt,
  gzCurve,
  maxGz,
  polygonAreaCentroid,
  rectPolygon,
  runL1,
  solveAtHeel,
  solveFreeEquilibrium,
  stationPolygon,
  tankFluidCentroid,
  transverseInShip,
  verticalInShip,
  weightsAt,
  type L1Input,
  type TankEntityData,
} from '../src/index.js';

const DEG = Math.PI / 180;

const close = (actual: number, expected: number, tol: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
};

// ---------------------------------------------------------------------------
// Section geometry
// ---------------------------------------------------------------------------

describe('section polygon and clipping', () => {
  const box = generateBox(100, 20, 10, 11, 5);
  const poly = stationPolygon(box.stations[5]);

  it('builds a closed rectangle for a box station', () => {
    const { area, cy, cz } = polygonAreaCentroid(poly);
    close(area, 20 * 10, 1e-9);
    close(cy, 0, 1e-9);
    close(cz, 5, 1e-9);
  });

  it('clipping at a horizontal waterline gives the immersed rectangle', () => {
    const cut = clipHalfPlane(poly, 0, 1, 4); // z <= 4
    const { area, cz } = polygonAreaCentroid(cut);
    close(area, 20 * 4, 1e-9);
    close(cz, 2, 1e-9);
  });

  it('clipping at a heeled waterline conserves the wedge transfer', () => {
    // For a wall-sided section the immersed area is unchanged by heel about
    // the centroid of the waterplane, only the centroid shifts.
    const phi = 10 * DEG;
    const u = verticalInShip(phi, 0);
    // choose c so the waterline passes through (0, 4): u.y*0 + u.z*4 = c
    const c = u.z * 4;
    const cut = clipHalfPlane(poly, u.y, u.z, c);
    const { area, cy } = polygonAreaCentroid(cut);
    close(area, 20 * 4, 1e-9); // wedge in = wedge out
    // centroid shift = i·tanφ / v  with i = L·B³/12 per unit length = B³/12
    const i = Math.pow(20, 3) / 12;
    close(cy, (i * Math.tan(phi)) / (20 * 4), 1e-9);
  });

  it('a section entirely above the waterline has zero area', () => {
    expect(polygonAreaCentroid(clipHalfPlane(poly, 0, 1, -1)).area).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Box clipped by a plane
// ---------------------------------------------------------------------------

describe('boxBelowPlane', () => {
  const box = { x0: 0, x1: 10, y0: -3, y1: 3, z0: 0, z1: 4 };
  const capacity = 10 * 6 * 4;

  it('returns the whole box when fully below the plane', () => {
    const r = boxBelowPlane(box, { x: 0, y: 0, z: 1 }, 100);
    close(r.volume, capacity, 1e-9);
    close(r.cx, 5, 1e-9);
    close(r.cy, 0, 1e-9);
    close(r.cz, 2, 1e-9);
  });

  it('returns nothing when entirely above', () => {
    expect(boxBelowPlane(box, { x: 0, y: 0, z: 1 }, -1).volume).toBe(0);
  });

  it('matches the analytic slab for a horizontal cut', () => {
    const r = boxBelowPlane(box, { x: 0, y: 0, z: 1 }, 1.5);
    close(r.volume, 10 * 6 * 1.5, 1e-9);
    close(r.cz, 0.75, 1e-9);
    close(r.cy, 0, 1e-9);
  });

  it('matches the analytic wedge for an inclined cut', () => {
    // Plane through the box mid-height, heeled: the wedge that leaves one side
    // equals the wedge that enters the other, so the volume stays half and only
    // the centroid moves, by i·tanφ/v with i = L·B³/12 and v = L·B·h.
    const phi = 8 * DEG;
    const u = verticalInShip(phi, 0);
    const c = u.z * 2; // through (y=0, z=2)
    const r = boxBelowPlane(box, u, c);
    close(r.volume, capacity / 2, 1e-9);
    const B = 6;
    const h = 2;
    close(r.cy, ((B * B) / (12 * h)) * Math.tan(phi), 1e-9);
  });

  it('is exact under a combined heel and trim', () => {
    const u = verticalInShip(6 * DEG, 3 * DEG);
    // a plane below every corner leaves the box untouched
    const cAll = Math.max(
      ...[0, 10].flatMap((x) => [-3, 3].flatMap((y) => [0, 4].map((z) => u.x * x + u.y * y + u.z * z))),
    );
    close(boxBelowPlane(box, u, cAll + 1).volume, capacity, 1e-9);
  });
});

// ---------------------------------------------------------------------------
// Tank fluid shift
// ---------------------------------------------------------------------------

describe('tank fluid centroid (actual fluid shift)', () => {
  const tank: TankEntityData = {
    kind: 'tank',
    name: 'T',
    x0: 20, x1: 40, y0: -6, y1: 0, z0: 0, z1: 3,
    fluid: { name: 'SW', density: 1.025 },
    fillPercent: 50,
  };

  it('upright slack tank sits at the geometric centre of its fluid', () => {
    const f = tankFluidCentroid(tank, 0, 0);
    close(f.volume, 20 * 6 * 3 * 0.5, 1e-8);
    close(f.x, 30, 1e-8);
    close(f.y, -3, 1e-8);
    close(f.z, 0.75, 1e-8);
    close(f.mass, 180 * 1.025, 1e-7);
  });

  it('pressed-full and empty tanks need no solve', () => {
    const full = tankFluidCentroid({ ...tank, fillPercent: 100 }, 12 * DEG, 2 * DEG);
    close(full.z, 1.5, 1e-12);
    close(full.y, -3, 1e-12);
    expect(tankFluidCentroid({ ...tank, fillPercent: 0 }, 12 * DEG, 0).mass).toBe(0);
  });

  it('heeling shifts the fluid centroid by i·tanφ/v at small angles', () => {
    const phi = 4 * DEG;
    const f = tankFluidCentroid(tank, phi, 0);
    close(f.volume, 180, 1e-7);
    const b = 6;
    const l = 20;
    const i = (l * b * b * b) / 12;
    const v = 180;
    close(f.y - -3, (i * Math.tan(phi)) / v, 1e-6);
  });

  it('conserves fluid volume at every attitude', () => {
    for (const [phi, theta] of [[0, 0], [5, 1], [20, -2], [45, 3]]) {
      const f = tankFluidCentroid(tank, phi * DEG, theta * DEG);
      close(f.volume, 180, 1e-6);
    }
  });
});

// ---------------------------------------------------------------------------
// Equilibrium — analytic box barge
// ---------------------------------------------------------------------------

describe('free-trim equilibrium — box barge', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const hull = generateBox(L, B, D, 21, 11);
  const rho = 1.025;

  const input = (lcg: number, vcg: number, mass: number): L1Input => ({
    rhoWater: rho,
    lightship: { mass, lcg, vcg },
    tanks: [],
    lpp: L,
    beam: B,
  });

  it('floats at the draft that matches the weight', () => {
    const mass = L * B * 4 * rho; // exactly 4 m draft
    const s = solveFreeEquilibrium(hull, input(L / 2, 5, mass));
    expect(s.converged).toBe(true);
    close(s.draftMean, 4, 1e-6);
    close(s.trimByStern, 0, 1e-6);
    close(s.displacement, mass, 1e-4);
    close(s.kb, 2, 1e-6);
  });

  it('trims until buoyancy and weight are vertically collinear', () => {
    const mass = L * B * 4 * rho;
    const lcg = 45; // 5 m aft of midship
    const s = solveFreeEquilibrium(hull, input(lcg, 5, mass));
    expect(s.converged).toBe(true);
    // The exact condition is that B and G share an earth-vertical line, which
    // in ship coordinates leaves a lever from the vertical separation:
    //   LCB − LCG = −(KB − KG)·tanθ
    // The textbook "LCB = LCG" is this relation with the second term dropped.
    close(s.lcb - s.lcg, -(s.kb - s.kg) * Math.tan(s.trimDeg * DEG), 1e-3);
    close(s.lcb, lcg, 0.1); // still within 10 cm of the classical statement
    expect(s.trimByStern).toBeGreaterThan(0); // trims by the stern
    // mean draft is preserved because the waterplane is rectangular
    close(s.draftMean, 4, 5e-3);
    // analytic trim: t = W·(LCG−LCF)/MCT, MCT = Δ·GML/(100·L)
    const l0 = computeHydrostatics(hull, { draft: 4, rhoWater: rho, kg: 5 }, { lpp: L, beam: B });
    const analytic = (mass * (L / 2 - lcg)) / (l0.mct1cm * 100);
    close(s.trimByStern, analytic, 0.05);
  });

  it('stays upright when TCG is on the centreline', () => {
    const s = solveFreeEquilibrium(hull, input(L / 2, 5, L * B * 4 * rho));
    close(s.heelDeg, 0, 1e-9);
    close(s.gz, 0, 1e-9);
  });

  it('rejects a weight the hull cannot support', () => {
    expect(() => solveFreeEquilibrium(hull, input(L / 2, 5, 1e7))).toThrow(/cannot float/);
  });
});

// ---------------------------------------------------------------------------
// GZ — wall-sided formula check
// ---------------------------------------------------------------------------

describe('GZ curve — box barge against the wall-sided formula', () => {
  const L = 100;
  const B = 20;
  const D = 10;
  const T = 4;
  const rho = 1.025;
  const KG = 5;
  const hull = generateBox(L, B, D, 21, 11);
  const input: L1Input = {
    rhoWater: rho,
    lightship: { mass: L * B * T * rho, lcg: L / 2, vcg: KG },
    tanks: [],
    lpp: L,
    beam: B,
  };

  // KB = T/2, BM = B²/(12T)
  const KB = T / 2;
  const BM = (B * B) / (12 * T);
  const GM = KB + BM - KG;

  it('initial slope of the GZ curve equals GM', () => {
    const s = solveAtHeel(hull, input, 1);
    close(s.gz / Math.sin(1 * DEG), GM, 0.02);
  });

  it('follows GZ = (GM + ½·BM·tan²φ)·sinφ while wall-sided', () => {
    for (const deg of [2, 5, 10, 15]) {
      const phi = deg * DEG;
      const s = solveAtHeel(hull, input, deg);
      const wallSided = (GM + 0.5 * BM * Math.pow(Math.tan(phi), 2)) * Math.sin(phi);
      close(s.gz, wallSided, 2e-3);
    }
  });

  it('deviates from the wall-sided formula once the deck edge immerses', () => {
    // deck edge immerses at tanφ = (D−T)/(B/2) = 6/10 → φ ≈ 30.96°
    const deg = 40;
    const phi = deg * DEG;
    const s = solveAtHeel(hull, input, deg);
    const wallSided = (GM + 0.5 * BM * Math.pow(Math.tan(phi), 2)) * Math.sin(phi);
    expect(s.gz).toBeLessThan(wallSided);
    expect(s.gz).toBeGreaterThan(0);
  });

  it('the curve is monotone through the initial range and peaks once', () => {
    const pts = gzCurve(hull, input, defaultHeelAngles(60, 5));
    expect(pts.every((p) => p.converged)).toBe(true);
    const peak = maxGz(pts);
    expect(peak.gz).toBeGreaterThan(0);
    expect(peak.heelDeg).toBeGreaterThan(20);
    expect(peak.heelDeg).toBeLessThan(60);
  });
});

// ---------------------------------------------------------------------------
// Curve interrogation helpers
// ---------------------------------------------------------------------------

describe('GZ curve interrogation', () => {
  // synthetic curve GZ = 0.5·sin(φ): area 0→30° = 0.5·(1−cos30°)
  const pts = defaultHeelAngles(60, 2).map((a) => ({
    heelDeg: a,
    gz: 0.5 * Math.sin(a * DEG),
    trimDeg: 0,
    draftMean: 5,
    converged: true,
  }));

  it('integrates the area under the curve', () => {
    close(areaUnderGz(pts, 0, 30), 0.5 * (1 - Math.cos(30 * DEG)), 1e-5);
    close(
      areaUnderGz(pts, 30, 40),
      0.5 * (Math.cos(30 * DEG) - Math.cos(40 * DEG)),
      1e-5,
    );
  });

  it('area is additive across the 30° split', () => {
    // Composite Simpson pairs samples differently either side of the split, so
    // additivity holds to the accuracy of the rule rather than exactly. The
    // gap is six orders of magnitude below the smallest Code threshold.
    close(areaUnderGz(pts, 0, 40), areaUnderGz(pts, 0, 30) + areaUnderGz(pts, 30, 40), 1e-5);
  });

  it('interpolates GZ between samples', () => {
    close(gzAt(pts, 30), 0.5 * Math.sin(30 * DEG), 1e-12);
    close(gzAt(pts, 31), 0.5 * Math.sin(31 * DEG), 1e-3);
  });

  it('refines the peak angle beyond the sampling step', () => {
    const peaked = defaultHeelAngles(60, 4).map((a) => ({
      heelDeg: a,
      gz: 1 - Math.pow((a - 33) / 30, 2),
      trimDeg: 0,
      draftMean: 5,
      converged: true,
    }));
    const peak = maxGz(peaked);
    close(peak.heelDeg, 33, 0.5); // not snapped to the 32°/36° samples
  });
});

// ---------------------------------------------------------------------------
// IMO criteria
// ---------------------------------------------------------------------------

describe('IMO IS Code criteria', () => {
  const good = defaultHeelAngles(60, 2).map((a) => ({
    heelDeg: a,
    gz: 0.9 * Math.sin(a * DEG) * Math.cos((a * DEG) / 3),
    trimDeg: 0,
    draftMean: 5,
    converged: true,
  }));

  it('passes a healthy curve and reports margins', () => {
    const res = evaluateCriteria(good, 1.2, { floodingAngleDeg: 40 });
    expect(res).toHaveLength(6);
    expect(res.every((c) => c.passed)).toBe(true);
    for (const c of res) expect(c.margin).toBeGreaterThanOrEqual(0);
  });

  it('fails a tender ship on GM and on the area criteria', () => {
    const tender = good.map((p) => ({ ...p, gz: p.gz * 0.15 }));
    const res = evaluateCriteria(tender, 0.05, { floodingAngleDeg: 40 });
    const byId = Object.fromEntries(res.map((c) => [c.id, c]));
    expect(byId.gm0.passed).toBe(false);
    expect(byId.area30.passed).toBe(false);
    expect(byId.gz30.passed).toBe(false);
    expect(byId.gm0.margin).toBeLessThan(0);
  });

  it('caps the area criteria at the down-flooding angle', () => {
    const full = evaluateCriteria(good, 1.2, { floodingAngleDeg: 40 });
    const flooded = evaluateCriteria(good, 1.2, { floodingAngleDeg: 32 });
    const a40 = (r: typeof full) => r.find((c) => c.id === 'area40')!.actual;
    expect(a40(flooded)).toBeLessThan(a40(full));
  });
});

// ---------------------------------------------------------------------------
// End-to-end L1 on the parametric hull
// ---------------------------------------------------------------------------

describe('runL1 on a realistic hull with slack tanks', () => {
  const L = 120;
  const B = 20;
  const D = 12;
  const hull = generateHull({ lpp: L, beam: B, depth: D });
  const tank = (
    id: string,
    x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    fill: number,
  ) => ({
    id,
    data: {
      kind: 'tank' as const,
      name: id,
      x0, x1, y0, y1, z0, z1,
      fluid: { name: 'Sea Water Ballast', density: 1.025 },
      fillPercent: fill,
    },
  });

  const input: L1Input = {
    rhoWater: 1.025,
    lightship: { mass: 2100, lcg: 54, vcg: 7.8 },
    tanks: [
      tank('tank:WB1.P', 30, 54, -8, -0.5, 0, 1.8, 100),
      tank('tank:WB1.S', 30, 54, 0.5, 8, 0, 1.8, 100),
      tank('tank:WB2.P', 54, 78, -8, -0.5, 0, 1.8, 35),
      tank('tank:WB2.S', 54, 78, 0.5, 8, 0, 1.8, 35),
    ],
    extraWeights: [{ id: 'cargo:hold1', mass: 2600, x: 66, y: 0, z: 6.2 }],
    lpp: L,
    beam: B,
  };

  const result = runL1(hull, input, { heelAngles: defaultHeelAngles(60, 5) });

  it('finds an equilibrium that balances weight and buoyancy', () => {
    expect(result.equilibrium.converged).toBe(true);
    const totalMass = 2100 + 2600 + weightsAt(input, 0, 0).mass - 2100 - 2600;
    close(result.equilibrium.displacement, weightsAt(input, 0, 0).mass, 1e-2);
    expect(totalMass).toBeGreaterThan(0);
    close(result.equilibrium.lcb, result.equilibrium.lcg, 1e-2);
  });

  it('floats upright at a sensible draft', () => {
    close(result.equilibrium.heelDeg, 0, 1e-6);
    expect(result.equilibrium.draftMean).toBeGreaterThan(1);
    expect(result.equilibrium.draftMean).toBeLessThan(D);
  });

  it('reports GM consistent with the initial slope of the GZ curve', () => {
    const small = solveAtHeel(hull, input, 2);
    close(small.gz / Math.sin(2 * DEG), result.gm0, 0.06);
  });

  it('applies the free-surface correction to GM', () => {
    expect(result.fsc).toBeGreaterThan(0);
    close(result.gm0, result.gmSolid - result.fsc, 1e-9);
  });

  it('produces a GZ curve with a peak and evaluates all six criteria', () => {
    expect(result.gz.length).toBeGreaterThan(5);
    expect(result.gzMax).toBeGreaterThan(0);
    expect(result.gzMaxAngleDeg).toBeGreaterThan(0);
    expect(result.criteria).toHaveLength(6);
    expect(typeof result.allCriteriaPassed).toBe('boolean');
  });

  it('detects deck edge immersion within the sampled range', () => {
    expect(result.deckImmersionAngleDeg).not.toBeNull();
    expect(result.deckImmersionAngleDeg!).toBeGreaterThan(0);
  });

  it('a higher VCG reduces GM and the righting levers', () => {
    const raised = runL1(
      hull,
      { ...input, lightship: { ...input.lightship, vcg: 10.5 } },
      { heelAngles: defaultHeelAngles(40, 10) },
    );
    expect(raised.gm0).toBeLessThan(result.gm0);
    expect(raised.gzMax).toBeLessThan(result.gzMax);
  });
});
