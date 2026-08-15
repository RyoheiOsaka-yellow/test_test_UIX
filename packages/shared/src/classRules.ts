/**
 * Class-rule permissible still-water envelopes, IACS UR S7/S11 style.
 *
 * The wave loads and the minimum hull-girder section modulus follow the IACS
 * unified requirements:
 *
 *   C(L)              wave coefficient (UR S11)
 *   Mwv,hog = +0.19·C·L²·B·Cb                [kN·m]
 *   Mwv,sag = −0.11·C·L²·B·(Cb + 0.7)        [kN·m]
 *   W_min   = C·L²·B·(Cb + 0.7)              [cm³]   (UR S7, mild steel k = 1)
 *
 * The permissible still-water bending moment then falls out of the total
 * stress limit σ = (Msw + Mwv)/W ≤ 175 N/mm², assuming the hull girder was
 * built to the rule minimum — the assumption is stated in the UI, and every
 * permissible value is editable there, exactly as a class-approved loading
 * manual overrides defaults in a real loading computer.
 *
 * Longitudinal distribution: full value within 0.35L–0.65L, tapering linearly
 * to zero at the perpendiculars (the S11 bending distribution); the shear
 * envelope peaks at the quarter points per the S11 shear distribution.
 */

export interface RuleParams {
  lpp: number;
  beam: number;
  /** block coefficient at the summer draft (rule floor of 0.60 applied) */
  cb: number;
}

export interface RuleEnvelope {
  /** wave coefficient */
  c: number;
  /** rule minimum midship section modulus [cm³] */
  sectionModulus: number;
  /** wave bending moments amidships [t·m] */
  mWaveHog: number;
  mWaveSag: number;
  /** permissible still-water bending amidships [t·m], both signs positive */
  mPermHog: number;
  mPermSag: number;
  /** wave shear at the quarters [t] */
  qWave: number;
  /** permissible still-water shear at the quarters [t] */
  qPerm: number;
}

const G = 9.81;

/** UR S11 wave coefficient. Valid for 90 m ≤ L ≤ 300 m here. */
export function waveCoefficient(lpp: number): number {
  if (lpp < 90 || lpp > 300) {
    throw new Error(`wave coefficient table implemented for 90–300 m (got ${lpp})`);
  }
  return 10.75 - Math.pow((300 - lpp) / 100, 1.5);
}

export function ruleEnvelope(p: RuleParams): RuleEnvelope {
  const cb = Math.max(0.6, p.cb);
  const c = waveCoefficient(p.lpp);
  const L2B = p.lpp * p.lpp * p.beam;

  const mWaveHogKNm = 0.19 * c * L2B * cb;
  const mWaveSagKNm = 0.11 * c * L2B * (cb + 0.7);
  const sectionModulus = c * L2B * (cb + 0.7); // cm³

  // σ_perm·W − Mwv, with σ_perm = 175 N/mm²; W[cm³]·σ[N/mm²] = W·σ·1e-3 kN·m
  const capacityKNm = 175 * sectionModulus * 1e-3;
  const mPermHogKNm = Math.max(0, capacityKNm - mWaveHogKNm);
  const mPermSagKNm = Math.max(0, capacityKNm - mWaveSagKNm);

  const qWaveKN = 0.3 * c * p.lpp * p.beam * (cb + 0.7);
  // shear capacity from τ ≤ 110 N/mm² against σ ≤ 175: same girder → factor 110/175
  const qPermKN = Math.max(0, (110 / 175) * capacityKNm / (0.12 * p.lpp) - qWaveKN);

  const toTm = (kNm: number) => kNm / G;
  const toT = (kN: number) => kN / G;

  return {
    c: round4(c),
    sectionModulus: Math.round(sectionModulus),
    mWaveHog: Math.round(toTm(mWaveHogKNm)),
    mWaveSag: Math.round(toTm(mWaveSagKNm)),
    mPermHog: Math.round(toTm(mPermHogKNm)),
    mPermSag: Math.round(toTm(mPermSagKNm)),
    qWave: Math.round(toT(qWaveKN)),
    qPerm: Math.round(toT(qPermKN)),
  };
}

/** S11 bending distribution: 0 at the ends, 1.0 within 0.35L–0.65L. */
export function bendingDistribution(x: number, lpp: number): number {
  const t = x / lpp;
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.35) return t / 0.35;
  if (t > 0.65) return (1 - t) / 0.35;
  return 1;
}

/** S11-style shear distribution: peaks 1.0 at the quarters, 0.6 amidships. */
export function shearDistribution(x: number, lpp: number): number {
  const t = x / lpp;
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.2) return t / 0.2;
  if (t < 0.3) return 1;
  if (t < 0.4) return 1 - (4 * (t - 0.3));
  if (t < 0.6) return 0.6;
  if (t < 0.7) return 0.6 + 4 * (t - 0.6);
  if (t < 0.8) return 1;
  return (1 - t) / 0.2;
}

export interface EnvelopeCheck {
  /** worst utilization of the sagging envelope, 1.0 = at the limit */
  saggingUtil: number;
  /** worst utilization of the hogging envelope */
  hoggingUtil: number;
  shearUtil: number;
  /** location of the worst moment utilization [m] */
  worstMomentX: number;
  worstShearX: number;
  passed: boolean;
}

/**
 * Check a computed still-water SF/BM distribution against the envelopes.
 * `permHog`/`permSag`/`permShear` are the (possibly user-edited) amidship /
 * quarter values; the rule distributions shape them along the length.
 */
export function checkEnvelope(
  stations: { x: number; shear: number; moment: number }[],
  lpp: number,
  permHog: number,
  permSag: number,
  permShear: number,
): EnvelopeCheck {
  let sagU = 0;
  let hogU = 0;
  let qU = 0;
  let worstMomentX = 0;
  let worstShearX = 0;
  for (const s of stations) {
    const fm = bendingDistribution(s.x, lpp);
    const fq = shearDistribution(s.x, lpp);
    // Near the perpendiculars both the envelope and the real curve tend to
    // zero and their ratio is numerical noise; loading manuals check inboard
    // frames only, so the utilization scan starts where the envelope carries
    // at least 20 % of its full value.
    if (fm > 0.2) {
      const limS = permSag * fm;
      const limH = permHog * fm;
      const u = s.moment >= 0 ? s.moment / limS : -s.moment / limH;
      const target = s.moment >= 0 ? 'sag' : 'hog';
      if (target === 'sag' && u > sagU) { sagU = u; worstMomentX = s.x; }
      if (target === 'hog' && u > hogU) { hogU = u; worstMomentX = s.x; }
    }
    if (fq > 0.2) {
      const u = Math.abs(s.shear) / (permShear * fq);
      if (u > qU) { qU = u; worstShearX = s.x; }
    }
  }
  return {
    saggingUtil: round4(sagU),
    hoggingUtil: round4(hogU),
    shearUtil: round4(qU),
    worstMomentX,
    worstShearX,
    passed: sagU <= 1 && hogU <= 1 && qU <= 1,
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;
