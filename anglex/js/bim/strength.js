// 強度計算: 支持金具 1 つを「立体の骨組み」として解き、許容応力度で照査する。
//   1) 部材の軸線から骨組み（節点・要素）を自動で作る。接している部材どうしは剛につなぐ
//   2) 荷重: 配管（管 + 中身 + 保温）× 支持間隔、自重、地震（水平 KH・鉛直 KV）
//   3) 直接剛性法（1 節点 6 自由度）で解き、部材の軸力・曲げ・せん断・たわみと、支持点の反力を出す
//   4) 部材は鋼構造の許容応力度（長期 F/1.5、短期はその 1.5 倍）で、アンカー・ボルト・U ボルト・溶接は簡易式で照査する
// 画面にも計算書にも「何を仮定したか」を必ず出す。結果は参考値で、設計者の確認に代わるものではない。
import { parseSpec, sectionProps as tableProps } from '../geo/profiles.js';
import { PIPES, PVC } from '../data/sections.js';

// ---------- 設定（案件ごとに project.strength で上書きできる） ----------
export const KS_TABLE = { S: { top: 2.0, mid: 1.5, low: 1.0 }, A: { top: 1.5, mid: 1.0, low: 0.6 }, B: { top: 1.0, mid: 0.6, low: 0.4 } };
export const DEFAULTS = {
  seismicClass: 'A', floor: 'mid', zone: 1.0, khManual: null, kvRatio: 0.5,   // 設計用水平震度 KH = KS × Z、鉛直 KV = KH × kvRatio
  seismic: true, seismicDir: 'both', rodSeismic: false,                                           // both: 管軸方向と管軸直角方向の両方
  contents: 'water', contentsDensity: 1000, insulDensity: 60,                  // 中身（満水・空・比重指定）、保温材 kg/m³
  span: null, seismicSpan: null,                                               // 支持間隔 m（null = 呼び径ごとの標準）、地震時に負担する配管長さ m（null = 支持間隔と同じ）
  F: 235, E: 205000, G: 79000, Fsus: 205, Esus: 193000,                        // SS400（t ≤ 40）と SUS304 の基準強度
  deflLimit: 300, deflLimitCant: 250, kFactor: null,                           // たわみ制限 L/300（片持ち L/250）、座屈長さ係数（null = 自動）
  angleMethod: 'principal',                                                    // 山形鋼の曲げ: principal = 断面の主軸で計算（厳密）、geometric = JIS の表の軸（手計算と同じ）
  boltFt: 176, boltFs: 101,                                                    // ボルトの短期許容 引張・せん断 N/mm²（SS400）。長期は 1/1.5
  anchorShort: { M8: 3.0, M10: 3.8, M12: 6.7, M16: 9.2, M20: 12.0, M24: 12.0 }, // あと施工アンカー（金属拡張・おねじ形）短期許容引抜 kN。長期は 1/1.5
  Fc: 18, anchorEmbed: { M8: 40, M10: 45, M12: 60, M16: 70, M20: 90, M24: 100 }, edgeDist: null, coneCheck: true, plateCheck: true, // コンクリートの設計基準強度 N/mm²、アンカーの有効埋込み長さ mm、へりあき mm（null = 十分にある）
  weldF: 235,                                                                  // 隅肉溶接の基準強度（母材 SS400）
};
export const stdSpan = n => n <= 25 ? 1.8 : n <= 40 ? 2.0 : n <= 50 ? 2.5 : n <= 80 ? 3.0 : n <= 100 ? 4.0 : 5.0; // 呼び径ごとの支持間隔の目安 m
export function settingsOf(project) { const s = { ...DEFAULTS, ...(project?.strength || {}) }; s.anchorShort = { ...DEFAULTS.anchorShort, ...(project?.strength?.anchorShort || {}) }; s.anchorEmbed = { ...DEFAULTS.anchorEmbed, ...(project?.strength?.anchorEmbed || {}) }; return s; }
export function khOf(s) { if (!s.seismic) return 0; if (s.khManual != null && s.khManual !== '') return +s.khManual; return (KS_TABLE[s.seismicClass]?.[s.floor] ?? 1.0) * (s.zone || 1); }
export const g0 = 9.80665;

// ---------- ベクトル ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

// ---------- 断面性能（mm 系）。長方形の集まりとして計算し、主軸の向きも出す ----------
function rectsOf(p) {
  switch (p.kind) {
    case 'L': return [[0, 0, p.A, p.t], [0, p.t, p.t, p.B]];
    case 'C': return [[0, 0, p.t1, p.H], [p.t1, 0, p.B, p.t2], [p.t1, p.H - p.t2, p.B, p.H]];
    case 'LC': return [[0, 0, p.t, p.H], [p.t, 0, p.A, p.t], [p.t, p.H - p.t, p.A, p.H], [p.A - p.t, p.t, p.A, p.C], [p.A - p.t, p.H - p.C, p.A, p.H - p.t]];
    case 'SQ': return [[0, 0, p.A, p.t], [0, p.B - p.t, p.A, p.B], [0, p.t, p.t, p.B - p.t], [p.A - p.t, p.t, p.A, p.B - p.t]];
    case 'H': return [[-p.t1 / 2, p.t2, p.t1 / 2, p.H - p.t2], [-p.B / 2, 0, p.B / 2, p.t2], [-p.B / 2, p.H - p.t2, p.B / 2, p.H]];
    case 'FB': return [[0, 0, p.w, p.t]];
    case 'PL': return [[0, 0, p.w || 100, p.t]];
  }
  return null;
}
const THREAD_P = { 6: 1.0, 8: 1.25, 10: 1.5, 12: 1.75, 14: 2.0, 16: 2.0, 18: 2.5, 20: 2.5, 22: 2.5, 24: 3.0, 30: 3.5 };
const W_THREAD = { 'W1/4': [6.35, 20], 'W5/16': [7.94, 18], 'W3/8': [9.525, 16], 'W1/2': [12.7, 12], 'W5/8': [15.875, 11], 'W3/4': [19.05, 10], 'W7/8': [22.225, 9], 'W1': [25.4, 8] };
// ねじの有効断面積 mm²（M: JIS 並目、W: ウィットねじ）
export function threadArea(M) { const s = String(M || 'M12').trim(); if (W_THREAD[s]) { const [d, tpi] = W_THREAD[s]; const p = 25.4 / tpi; return { d, As: Math.PI / 4 * (d - 0.9382 * p) ** 2, name: s }; } const d = parseFloat(s.replace(/^M/i, '')) || 12; const p = THREAD_P[Math.round(d)] || d * 0.14; return { d, As: Math.PI / 4 * (d - 0.9382 * p) ** 2, name: 'M' + d }; }
const anchorKey = M => { const t = threadArea(M); const sizes = [8, 10, 12, 16, 20, 24]; return 'M' + sizes.reduce((a, b) => Math.abs(b - t.d) < Math.abs(a - t.d) ? b : a, 8); };

export function sectionOf(spec, { principal = true } = {}) {
  const p = typeof spec === 'string' ? parseSpec(spec) : spec; if (!p) return null;
  if (p.kind === 'PIPE' || p.kind === 'RB') { const D = p.kind === 'PIPE' ? p.od : p.d, d = p.kind === 'PIPE' ? p.od - 2 * p.t : 0; const A = Math.PI / 4 * (D * D - d * d), I = Math.PI / 64 * (D ** 4 - d ** 4);
    return { kind: p.kind, round: true, A, cx: 0, cy: 0, Iu: I, Iv: I, theta: 0, J: 2 * I, tmax: p.kind === 'PIPE' ? p.t : D / 2, R: D / 2, r: D / 2, iu: Math.sqrt(I / A), iv: Math.sqrt(I / A), imin: Math.sqrt(I / A), shearK: p.kind === 'PIPE' ? 2 : 4 / 3, label: p.label, closed: true, pts: [] }; }
  const rs = rectsOf(p); if (!rs) return null;
  let A = 0, sx = 0, sy = 0; for (const [x0, y0, x1, y1] of rs) { const a = (x1 - x0) * (y1 - y0); A += a; sx += a * (x0 + x1) / 2; sy += a * (y0 + y1) / 2; }
  const cx = sx / A, cy = sy / A; let Ix = 0, Iy = 0, Ixy = 0, J = 0, tmax = 0;
  for (const [x0, y0, x1, y1] of rs) { const b = x1 - x0, hh = y1 - y0, a = b * hh, dx = (x0 + x1) / 2 - cx, dy = (y0 + y1) / 2 - cy; Ix += b * hh ** 3 / 12 + a * dy * dy; Iy += hh * b ** 3 / 12 + a * dx * dx; Ixy += a * dx * dy; const lo = Math.max(b, hh), sh = Math.min(b, hh); J += lo * sh ** 3 / 3; tmax = Math.max(tmax, sh); }
  let theta = 0; if (principal && Math.abs(Ixy) > 1e-6 * Math.max(Ix, Iy)) theta = 0.5 * Math.atan2(-2 * Ixy, Ix - Iy);
  const c = Math.cos(theta), s = Math.sin(theta); const Iu = Ix * c * c + Iy * s * s - Ixy * 2 * s * c, Iv = Ix * s * s + Iy * c * c + Ixy * 2 * s * c;
  const pts = []; let rmax = 0; for (const [x0, y0, x1, y1] of rs) for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const dx = x - cx, dy = y - cy; pts.push([dx * c + dy * s, -dx * s + dy * c]); rmax = Math.max(rmax, Math.hypot(dx, dy)); }
  const out = { kind: p.kind, A, cx, cy, Ix, Iy, Ixy, Iu, Iv, theta, J, tmax, r: rmax, iu: Math.sqrt(Iu / A), iv: Math.sqrt(Iv / A), imin: Math.sqrt(Math.min(Iu, Iv) / A), shearK: p.kind === 'FB' || p.kind === 'PL' ? 1.5 : 2, label: p.label, pts };
  // JIS の表に断面積と断面二次モーメントがある形鋼は、表の値に合わせる（角の丸みの分だけ、長方形の合計より小さい）
  try { const tb = tableProps(p); if (tb && /^JIS/.test(tb.source || '') && tb.A > 0 && tb.Ix > 0) { const kA = tb.A * 100 / A, kI = tb.Ix * 1e4 / Ix; if (kA > 0.8 && kA < 1.1 && kI > 0.8 && kI < 1.1) { out.A = A * kA; out.Iu *= kI; out.Iv *= kI; out.Ix = Ix * kI; out.Iy = Iy * kI; out.J *= kA; out.iu = Math.sqrt(out.Iu / out.A); out.iv = Math.sqrt(out.Iv / out.A); out.imin = Math.sqrt(Math.min(out.Iu, out.Iv) / out.A); out.table = tb.source; } } } catch { }
  if (p.kind === 'SQ') { const am = (p.A - p.t) * (p.B - p.t); out.J = 4 * am * am * p.t / (2 * ((p.A - p.t) + (p.B - p.t))); out.closed = true; }
  // 横座屈の低減に使う値（強軸まわりの曲げ）: せい h と圧縮フランジの面積 Af
  if (p.kind === 'C' || p.kind === 'H') { out.ltb = { h: p.H, Af: p.B * p.t2, iy: Math.sqrt(out.Iy / out.A) }; } else if (p.kind === 'LC') { out.ltb = { h: p.H, Af: p.A * p.t, iy: Math.sqrt(out.Iy / out.A) }; }
  return out;
}

// ---------- 許容応力度（鋼構造の許容応力度設計。長期。短期は 1.5 倍） ----------
export function allowables(F, E = 205000) { const ft = F / 1.5, fs = F / (1.5 * Math.sqrt(3)); const Lam = Math.sqrt(Math.PI * Math.PI * E / (0.6 * F)); return { F, ft, fs, Lam }; }
export function fcOf(F, E, lambda) { const Lam = Math.sqrt(Math.PI * Math.PI * E / (0.6 * F)); if (lambda <= Lam) { const q = (lambda / Lam) ** 2; return (1 - 0.4 * q) * F / (1.5 + 2 / 3 * q); } return 0.277 * F / (lambda / Lam) ** 2; }
// 曲げ（強軸まわり、溝形・H 形）: 横座屈を考えた許容曲げ。fb = min(ft, max(式 1, 式 2))
export function fbOf(F, E, sec, lb) { const ft = F / 1.5; if (!sec.ltb || !(lb > 0)) return ft; const Lam = Math.sqrt(Math.PI * Math.PI * E / (0.6 * F)); const f1 = (1 - 0.4 * (lb / sec.ltb.iy) ** 2 / (Lam * Lam)) * ft; const f2 = 89000 / (lb * sec.ltb.h / sec.ltb.Af); return Math.min(ft, Math.max(f1, f2, 0)); }

// ---------- 立体骨組みの解析（直接剛性法） ----------
// nodes: [[x,y,z]]、elems: [{ i, j, A, Iu, Iv, J, E, G, eu:[u 軸の向き] }]、supports: Map(節点 → 'fixed' | 'pinned')、loads: [Float64Array(6n)]
// 戻り値: { u:[ケースごとの変位], forces(c, e) → 要素端の断面力（局所）, reactions(c) → Map(節点 → [Fx,Fy,Fz,Mx,My,Mz]), unstable:[bool] }
export function solveFrame3D({ nodes, elems, supports, loads }) {
  const n = nodes.length, N = 6 * n; const K = new Float64Array(N * N); const el = [];
  for (const e of elems) {
    const pi = nodes[e.i], pj = nodes[e.j]; const d = sub(pj, pi); const L = len(d); if (!(L > 1e-6)) { el.push(null); continue; }
    const e1 = mul(d, 1 / L); let e2 = sub(e.eu, mul(e1, dot(e.eu, e1))); if (len(e2) < 1e-6) e2 = Math.abs(e1[1]) < 0.9 ? cross([0, 1, 0], e1) : cross([1, 0, 0], e1); e2 = norm(e2); const e3 = cross(e1, e2);
    const { A, J, E, G } = e; const Iz = e.Iv, Iy = e.Iu; /* 局所 y = u 軸、局所 z = v 軸。y 方向のたわみは v 軸まわりの曲げ（Iv）、z 方向は u 軸まわり（Iu） */
    const k = new Float64Array(144); const S = (a, b, v) => { k[a * 12 + b] = v; k[b * 12 + a] = v; };
    const a = E * A / L, t = G * J / L, bz = E * Iz / L ** 3, by = E * Iy / L ** 3;
    S(0, 0, a); S(6, 6, a); S(0, 6, -a); S(3, 3, t); S(9, 9, t); S(3, 9, -t);
    S(1, 1, 12 * bz); S(7, 7, 12 * bz); S(1, 7, -12 * bz); S(1, 5, 6 * bz * L); S(1, 11, 6 * bz * L); S(5, 7, -6 * bz * L); S(7, 11, -6 * bz * L); S(5, 5, 4 * bz * L * L); S(11, 11, 4 * bz * L * L); S(5, 11, 2 * bz * L * L);
    S(2, 2, 12 * by); S(8, 8, 12 * by); S(2, 8, -12 * by); S(2, 4, -6 * by * L); S(2, 10, -6 * by * L); S(4, 8, 6 * by * L); S(8, 10, 6 * by * L); S(4, 4, 4 * by * L * L); S(10, 10, 4 * by * L * L); S(4, 10, 2 * by * L * L);
    const R = [e1, e2, e3]; const T = new Float64Array(144); for (let b = 0; b < 4; b++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) T[(b * 3 + r) * 12 + b * 3 + c] = R[r][c];
    const kT = new Float64Array(144); for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { let s = 0; for (let m = 0; m < 12; m++) s += k[r * 12 + m] * T[m * 12 + c]; kT[r * 12 + c] = s; }
    const dof = [0, 1, 2, 3, 4, 5].map(q => e.i * 6 + q).concat([0, 1, 2, 3, 4, 5].map(q => e.j * 6 + q));
    for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { let s = 0; for (let m = 0; m < 12; m++) s += T[m * 12 + r] * kT[m * 12 + c]; K[dof[r] * N + dof[c]] += s; }
    el.push({ kT, dof, L, R });
  }
  // 拘束
  const fixed = new Uint8Array(N); for (const [nd, type] of supports) { const m = type === 'fixed' ? 6 : 3; for (let q = 0; q < m; q++) fixed[nd * 6 + q] = 1; }
  const free = []; for (let q = 0; q < N; q++) if (!fixed[q]) free.push(q); const nf = free.length;
  // 不安定な向き（機構）があっても解けるよう、ごく弱いばねを足す。その向きに力がかかると変位が極端に大きくなるので、後で「不安定」と判定できる
  let kmaxT = 0, kmaxR = 0; for (let q = 0; q < N; q++) { const v = K[q * N + q]; if (q % 6 < 3) kmaxT = Math.max(kmaxT, v); else kmaxR = Math.max(kmaxR, v); }
  const Kf = new Float64Array(nf * nf); for (let r = 0; r < nf; r++) { const fr = free[r]; for (let c = 0; c < nf; c++) Kf[r * nf + c] = K[fr * N + free[c]]; Kf[r * nf + r] += (fr % 6 < 3 ? kmaxT : kmaxR) * 1e-10 + 1e-12; }
  // コレスキー分解
  let ok = true; for (let j = 0; j < nf && ok; j++) { let s = Kf[j * nf + j]; for (let m = 0; m < j; m++) s -= Kf[j * nf + m] ** 2; if (!(s > 0)) { ok = false; break; } const d = Math.sqrt(s); Kf[j * nf + j] = d; for (let i = j + 1; i < nf; i++) { let v = Kf[i * nf + j]; for (let m = 0; m < j; m++) v -= Kf[i * nf + m] * Kf[j * nf + m]; Kf[i * nf + j] = v / d; } }
  const us = [], unstable = [];
  for (const F of loads) { const u = new Float64Array(N); if (ok && nf) { const y = new Float64Array(nf); for (let i = 0; i < nf; i++) { let v = F[free[i]]; for (let m = 0; m < i; m++) v -= Kf[i * nf + m] * y[m]; y[i] = v / Kf[i * nf + i]; } for (let i = nf - 1; i >= 0; i--) { let v = y[i]; for (let m = i + 1; m < nf; m++) v -= Kf[m * nf + i] * y[m]; y[i] = v / Kf[i * nf + i]; u[free[i]] = y[i]; } }
    us.push(u); let umax = 0; for (let q = 0; q < N; q++) if (q % 6 < 3) umax = Math.max(umax, Math.abs(u[q])); unstable.push(!ok || !Number.isFinite(umax) || umax > 1e4); }
  const forces = (c, ei) => { const E = el[ei]; if (!E) return null; const u = us[c]; const f = new Float64Array(12); for (let r = 0; r < 12; r++) { let s = 0; for (let m = 0; m < 12; m++) s += E.kT[r * 12 + m] * u[E.dof[m]]; f[r] = s; }
    // 断面力（正の面にはたらく合力）: 始端は −f、終端は +f。N は引張が正、Mu・Mv は u 軸・v 軸まわり
    return { L: E.L, R: E.R, i: { N: -f[0], Vu: -f[1], Vv: -f[2], T: -f[3], Mu: -f[4], Mv: -f[5] }, j: { N: f[6], Vu: f[7], Vv: f[8], T: f[9], Mu: f[10], Mv: f[11] } }; };
  const reactions = c => { const u = us[c], F = loads[c]; const out = new Map(); for (const [nd, type] of supports) { const r = [0, 0, 0, 0, 0, 0]; const m = type === 'fixed' ? 6 : 3; for (let q = 0; q < m; q++) { const row = nd * 6 + q; let s = -F[row]; for (let cc = 0; cc < N; cc++) { const kv = K[row * N + cc]; if (kv !== 0) s += kv * u[cc]; } r[q] = s; } out.set(nd, r); } return out; };
  return { u: us, forces, reactions, unstable, ok };
}

// ---------- 配管 1 本の重さ kg/m（管 + 中身 + 保温） ----------
export function pipeMass(part, s) {
  const isVP = /^VP|^VU/i.test(part.spec || ''); const sp = parseSpec(part.spec); let num = parseInt(String(part.nominal || ''), 10);
  if (!num) { const od0 = part.od || sp?.od || 60.5; let bd = Infinity; for (const [k, v] of Object.entries(PIPES)) { const d = Math.abs(v.od - od0); if (d < bd) { bd = d; num = parseInt(k, 10); } } } /* 呼び径がない配管は、外径がいちばん近い SGP とみなす */
  const tbl = isVP ? PVC[String(num)] : PIPES[num + 'A']; const od = part.od || sp?.od || tbl?.od || 60.5, t = tbl?.t || sp?.t || 3.8; const di = od - 2 * t;
  const steel = isVP ? Math.PI / 4 * (od * od - di * di) * 1e-6 * 1430 : (tbl?.w ?? Math.PI / 4 * (od * od - di * di) * 1e-6 * 7850);
  const rho = s.contents === 'empty' ? 0 : s.contents === 'custom' ? (+s.contentsDensity || 0) : 1000; const fluid = Math.PI / 4 * di * di * 1e-6 * rho;
  const ins = +part.insul || 0; const insul = ins > 0 ? Math.PI / 4 * ((od + 2 * ins) ** 2 - od * od) * 1e-6 * (+s.insulDensity || 0) : 0;
  const span = (s.span > 0 ? +s.span : stdSpan(num)) * (s.spanK > 0 ? +s.spanK : 1); const sspan = s.seismicSpan > 0 ? +s.seismicSpan : span; /* spanK: この金具だけ支持間隔を詰める（直し方の候補） */
  const kgm = steel + fluid + insul; return { nominal: num + 'A', od, kgm, steel, fluid, insul, span, sspan, W: kgm * span * g0, Ws: kgm * sspan * g0 };
}

// 線分どうしの最近点。戻り値 { s, t, dist }（s, t は各線分の始点からの長さ）
function segSeg(a0, a1, b0, b1) {
  const d1 = sub(a1, a0), d2 = sub(b1, b0), r = sub(a0, b0); const A = dot(d1, d1), E = dot(d2, d2), F = dot(d2, r); let s, t;
  if (A < 1e-9 && E < 1e-9) return { s: 0, t: 0, dist: len(r) };
  if (A < 1e-9) { s = 0; t = Math.min(1, Math.max(0, F / E)); } else { const C = dot(d1, r); if (E < 1e-9) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else { const B = dot(d1, d2), den = A * E - B * B; s = den > 1e-9 * A * E ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0; t = (B * s + F) / E; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (B - C) / A)); } } }
  const pa = add(a0, mul(d1, s)), pb = add(b0, mul(d2, t)); return { s: s * Math.sqrt(A), t: t * Math.sqrt(E), dist: len(sub(pa, pb)), parallel: Math.abs(dot(norm(d1), norm(d2))) > 0.999 };
}
const ptSeg = (p, a, b) => { const d = sub(b, a); const L2 = dot(d, d) || 1; const t = Math.min(1, Math.max(0, dot(sub(p, a), d) / L2)); const q = add(a, mul(d, t)); return { t: t * Math.sqrt(L2), dist: len(sub(p, q)), q }; };

// ---------- 部品の一覧 → 骨組み ----------
export function buildFrame(parts, s, { up = [0, 1, 0], extra = [] } = {}) {
  const warnings = []; const mem = [];
  parts.forEach((pt, idx) => {
    if (pt.ref) return;
    if (pt.kind === 'member') { const p = parseSpec(pt.spec); const sec = p && sectionOf(p, { principal: s.angleMethod !== 'geometric' }); if (!sec || !(pt.length > 1)) return; const [ex, ey, ez] = pt.pl.basis; const o = add(pt.pl.pos, add(mul(ex, sec.cx), mul(ey, sec.cy))); const c = Math.cos(sec.theta), sn = Math.sin(sec.theta);
      const sus = /SUS/i.test(pt.material || '') || /SUS/i.test(pt.finish || ''); mem.push({ idx, part: pt, sec, a: o, b: add(o, mul(ez, pt.length)), L: pt.length, d: ez, eu: add(mul(ex, c), mul(ey, sn)), F: sus ? s.Fsus : s.F, E: sus ? s.Esus : s.E, G: s.G, name: pt.name || pt.spec, spec: pt.spec }); }
    else if (pt.kind === 'rod') { const th = threadArea(pt.M); const dd = Math.sqrt(4 * th.As / Math.PI); const sec = sectionOf({ kind: 'RB', d: dd, label: `吊ボルト ${th.name}` }); const [ex, , ez] = pt.pl.basis; const L = pt.L || pt.length || 300; mem.push({ idx, part: pt, sec, rod: true, th, a: [...pt.pl.pos], b: add(pt.pl.pos, mul(ez, L)), L, d: ez, eu: ex, F: s.F, E: s.E, G: s.G, name: pt.name || `吊ボルト ${th.name}`, spec: th.name }); }
  });
  if (!mem.length) return { empty: true, warnings: ['計算できる部材（形鋼・吊ボルト）がありません'] };
  // 吊ボルトで吊られる部材は、軸線を吊ボルトの真下へ寄せる（数 mm〜十数 mm の心ずれで、振り子のように振れる解になるのを防ぐ）
  for (const M of mem) { if (M.rod) continue; let off = [0, 0, 0], n = 0; for (const R of mem) { if (!R.rod) continue; const r = segSeg(M.a, M.b, R.a, R.b); if (r.dist > M.sec.r + R.sec.r + 12) continue; off = add(off, sub(add(R.a, mul(R.d, r.t)), add(M.a, mul(M.d, r.s)))); n++; } if (n) { off = mul(off, 1 / n); M.a = add(M.a, off); M.b = add(M.b, off); } }
  // 部材ごとの「節点を置く位置」（始点からの長さ）と、その位置どうしのつながり
  const pts = []; const mk = (m, t, tag = null) => { const q = { m, t: Math.min(m.L, Math.max(0, t)), g: pts.length, tag }; pts.push(q); return q; };
  const find = i => { while (pts[i].g !== i) { pts[i].g = pts[pts[i].g].g; i = pts[i].g; } return i; }, union = (p, q) => { const a = find(pts.indexOf(p)), b = find(pts.indexOf(q)); if (a !== b) pts[a].g = b; };
  for (const m of mem) { m.p0 = mk(m, 0); m.p1 = mk(m, m.L); }
  const snap = (m, t, other) => { const e = Math.min(m.L * 0.45, Math.max((other?.sec.r || 0) + 12, m.L * 0.06)); return t < e ? 0 : t > m.L - e ? m.L : t; };
  for (let i = 0; i < mem.length; i++) for (let j = i + 1; j < mem.length; j++) { const A = mem[i], B = mem[j]; const tol = A.sec.r + B.sec.r + 12;
    if (segSeg(A.a, A.b, B.a, B.b).parallel) { for (const [P, Q] of [[A, B], [B, A]]) for (const end of [0, P.L]) { const pp = end ? P.b : P.a; const r = ptSeg(pp, Q.a, Q.b); if (r.dist <= tol) union(end ? P.p1 : P.p0, mk(Q, snap(Q, r.t, P))); } continue; }
    const r = segSeg(A.a, A.b, B.a, B.b); if (r.dist > tol) continue; const ta = snap(A, r.s, B), tb = snap(B, r.t, A); union(ta === 0 ? A.p0 : ta === A.L ? A.p1 : mk(A, ta), tb === 0 ? B.p0 : tb === B.L ? B.p1 : mk(B, tb)); }
  const nearest = (p, maxD = Infinity, only = null) => { let best = null; for (const m of mem) { if (only && !only(m)) continue; const r = ptSeg(p, m.a, m.b); if (r.dist < (best?.dist ?? maxD)) best = { m, t: r.t, dist: r.dist }; } return best; };
  // 支持点: アンカー → その近くの部材の点。2 本以上が同じ点に集まれば固定、1 本ならピン
  const supportsRaw = []; const anchors = parts.map((pt, idx) => ({ pt, idx })).filter(x => x.pt.kind === 'anchor' && !x.pt.ref);
  for (const a of anchors) { const nr = nearest(a.pt.pl.pos, 400, m => !m.rod); if (!nr) continue; const t = snap(nr.m, nr.t, null); let grp = supportsRaw.find(g => g.m === nr.m && Math.abs(g.t - t) < 45 && g.kind === 'anchor'); if (!grp) supportsRaw.push(grp = { m: nr.m, t, kind: 'anchor', items: [] }); grp.items.push(a); }
  if (!anchors.length) { // 図にアンカーがないとき: 「アンカー用の穴」を支持点にする
    parts.forEach(pt => { if (pt.ref || !pt.holes) return; const hs = pt.holes.filter(hh => hh.kind === 'anchor'); if (!hs.length) return; const m = mem.find(x => x.part === pt);
      if (m) { for (const hh of hs) { const t = snap(m, hh.z, null); let grp = supportsRaw.find(g => g.m === m && Math.abs(g.t - t) < 45); if (!grp) supportsRaw.push(grp = { m, t, kind: 'hole', items: [] }); grp.items.push({ hole: hh }); } }
      else if (pt.kind === 'plate' && pt.pl) { const [ex, ey, ez] = pt.pl.basis; const pp = parseSpec(pt.spec); const c = add(pt.pl.pos, add(mul(ex, (pp?.w || 0) / 2), mul(ez, (pt.length || 0) / 2))); const nr = nearest(c, 300, x => !x.rod); if (nr) { const t = snap(nr.m, nr.t, null); let grp = supportsRaw.find(g => g.m === nr.m && Math.abs(g.t - t) < 45); if (!grp) supportsRaw.push(grp = { m: nr.m, t, kind: 'hole', items: [] }); for (const hh of hs) grp.items.push({ hole: hh }); void ey; } } }); }
  // 吊ボルト: 部材につながっていない側の端をピン支持（スラブのインサート）。吊ボルト用の穴だけがある場合はその位置
  for (const m of mem.filter(x => x.rod)) { const c0 = find(pts.indexOf(m.p0)) !== pts.indexOf(m.p0) || pts.some(q => q !== m.p0 && find(pts.indexOf(q)) === find(pts.indexOf(m.p0))), c1 = pts.some(q => q !== m.p1 && find(pts.indexOf(q)) === find(pts.indexOf(m.p1))); const top = dot(sub(m.b, m.a), up) >= 0 ? 1 : 0; const end = c0 && !c1 ? 1 : c1 && !c0 ? 0 : top; supportsRaw.push({ m, t: end ? m.L : 0, kind: 'rod', items: [{ pt: m.part, idx: m.idx }] }); }
  if (!mem.some(x => x.rod)) parts.forEach(pt => { if (pt.ref || !pt.holes) return; const m = mem.find(x => x.part === pt); if (!m) return; for (const hh of pt.holes.filter(q => q.kind === 'rod')) supportsRaw.push({ m, t: snap(m, hh.z, null), kind: 'rodhole', items: [{ hole: hh }] }); });
  let assumed = false;
  if (!supportsRaw.length) { // 支持点が読み取れないとき: 自由な端のうち、いちばん上（吊り）か下（床置き）を固定と仮定
    assumed = true; const ends = []; for (const m of mem) for (const [q, p] of [[m.p0, m.a], [m.p1, m.b]]) if (!pts.some(o => o !== q && find(pts.indexOf(o)) === find(pts.indexOf(q)))) ends.push({ m, t: q.t, y: dot(p, up) });
    const pipesY = parts.filter(pt => pt.kind === 'pipe').map(pt => dot(pt.pl.pos, up)); const all = mem.flatMap(m => [dot(m.a, up), dot(m.b, up)]); const lo = Math.min(...all), hi = Math.max(...all); const hang = pipesY.length && pipesY.reduce((x, y) => x + y, 0) / pipesY.length < (lo + hi) / 2 - 1;
    const cand = ends.length ? ends : mem.flatMap(m => [{ m, t: 0, y: dot(m.a, up) }, { m, t: m.L, y: dot(m.b, up) }]); const ext = hang ? Math.max(...cand.map(e => e.y)) : Math.min(...cand.map(e => e.y));
    for (const e of cand) if (Math.abs(e.y - ext) < 6) supportsRaw.push({ m: e.m, t: e.t, kind: 'assumed', items: [] });
    warnings.push(`支持点が図から読み取れないため、${hang ? 'いちばん上' : 'いちばん下'}の端を固定と仮定しました`); }
  for (const g of supportsRaw) g.p = g.t === 0 ? g.m.p0 : g.t === g.m.L ? g.m.p1 : mk(g.m, g.t, 'sup');
  // 配管の荷重点
  const pipes = []; parts.forEach((pt, idx) => { if (pt.kind !== 'pipe' || !pt.ref || !pt.pl) return; const ez = pt.pl.basis[2]; const c = add(pt.pl.pos, mul(ez, (pt.length || 0) / 2)); const nr = nearest(c); if (!nr) return; const t = snap(nr.m, nr.t, null); const mass = pipeMass(pt, s); pipes.push({ idx, part: pt, c, axis: ez, m: nr.m, ecc: nr.dist, p: t === 0 ? nr.m.p0 : t === nr.m.L ? nr.m.p1 : mk(nr.m, t, 'load'), ...mass }); });
  // 配管のほかの荷重（機器・ダクト・ケーブルラックなど）。載せる部材と位置（0〜1）を指定。部材の指定がなければ、配管が載る部材か、いちばん長い横の部材
  const extras = []; for (const x of extra || []) { const kg = +x.kg; if (!(kg > 0)) continue; const m = mem.find(q => q.idx === x.partIndex) || pipes[0]?.m || mem.filter(q => !q.rod).sort((a, b) => (Math.abs(dot(a.d, up)) < 0.5 ? b.L : 0) - (Math.abs(dot(b.d, up)) < 0.5 ? a.L : 0) || b.L - a.L)[0] || mem[0]; const t = snap(m, Math.min(1, Math.max(0, x.pos ?? 0.5)) * m.L, null); extras.push({ name: x.name || '追加の荷重', kg, m, p: t === 0 ? m.p0 : t === m.L ? m.p1 : mk(m, t, 'load'), W: kg * g0 }); }
  // 同じ部材の同じ位置（2 mm 以内）に置いた点は 1 つの節点にまとめる（配管と追加の荷重が同じ位置にあると、長さ 0 の要素ができて骨組みが切れるのを防ぐ）
  for (const m of mem) { const mine = pts.filter(q => q.m === m).sort((x, y) => x.t - y.t); for (let k = 1; k < mine.length; k++) if (mine[k].t - mine[k - 1].t < 2) union(mine[k], mine[k - 1]); }
  // 節点と要素
  const nodes = [], nodeOf = new Map(); const groupPos = new Map(); for (const q of pts) { const gi = find(pts.indexOf(q)); const pos = add(q.m.a, mul(q.m.d, q.t)); const g = groupPos.get(gi) || { sum: [0, 0, 0], n: 0, mid: null }; g.sum = add(g.sum, pos); g.n++; if (q.t > 0 && q.t < q.m.L && !q.m.rod) g.mid = g.mid || pos; groupPos.set(gi, g); }
  const nodeFor = q => { const gi = find(pts.indexOf(q)); if (!nodeOf.has(gi)) { const g = groupPos.get(gi); nodeOf.set(gi, nodes.length); nodes.push(g.mid || mul(g.sum, 1 / g.n)); } return nodeOf.get(gi); };
  const elems = []; for (const m of mem) { const mine = pts.filter(q => q.m === m).sort((x, y) => x.t - y.t); const chain = []; for (const q of mine) { const nd = nodeFor(q); if (chain.length && chain[chain.length - 1].nd === nd) continue; chain.push({ nd, t: q.t }); }
    m.nodes = []; m.elems = [];
    for (let k = 0; k < chain.length - 1; k++) { const A = chain[k], B = chain[k + 1]; const span = len(sub(nodes[B.nd], nodes[A.nd])); const nsub = span > 600 ? 4 : span > 250 ? 3 : span > 90 ? 2 : 1; let prev = A.nd; if (!m.nodes.length) m.nodes.push({ nd: A.nd, t: A.t });
      for (let q = 1; q <= nsub; q++) { let nd; if (q === nsub) nd = B.nd; else { nd = nodes.length; nodes.push(add(nodes[A.nd], mul(sub(nodes[B.nd], nodes[A.nd]), q / nsub))); } m.elems.push(elems.length); elems.push({ i: prev, j: nd, A: m.sec.A, Iu: m.sec.Iu, Iv: m.sec.Iv, J: m.sec.J, E: m.E, G: m.G, eu: m.eu, mem: m }); m.nodes.push({ nd, t: A.t + (B.t - A.t) * q / nsub }); prev = nd; } }
    if (!m.elems.length) warnings.push(`${m.name}: 長さが短すぎるため計算から外しました`); }
  const supports = new Map(), supInfo = []; for (const g of supportsRaw) { const nd = nodeFor(g.p); const type = g.kind === 'anchor' || g.kind === 'hole' || g.kind === 'assumed' ? 'fixed' : 'pinned'; /* アンカーで面に締め付けた点は固定、吊ボルトの上端はピン */ const prev = supInfo.find(x => x.nd === nd); if (prev) { prev.items.push(...g.items); if (type === 'fixed' || prev.items.length >= 2 && prev.kind !== 'rod') { prev.type = 'fixed'; supports.set(nd, 'fixed'); } continue; } supports.set(nd, type); supInfo.push({ nd, type, kind: g.kind, items: [...g.items], m: g.m }); }
  for (const p of pipes) p.nd = nodeFor(p.p); for (const x of extras) x.nd = nodeFor(x.p);
  // 部材の端が「自由」か（片持ち）
  const useCount = new Map(); for (const e of elems) for (const nd of [e.i, e.j]) useCount.set(nd, (useCount.get(nd) || 0) + 1);
  for (const m of mem) { if (!m.nodes.length) continue; const n0 = m.nodes[0].nd, n1 = m.nodes[m.nodes.length - 1].nd; m.free0 = useCount.get(n0) === 1 && !supports.has(n0); m.free1 = useCount.get(n1) === 1 && !supports.has(n1); m.cant = m.free0 !== m.free1; m.vertical = Math.abs(dot(m.d, up)) > 0.9; }
  const hasBrace = mem.some(m => !m.rod && Math.abs(dot(m.d, up)) > 0.25 && Math.abs(dot(m.d, up)) < 0.9);
  return { mem, nodes, elems, supports, supInfo, pipes, extras, warnings, assumed, hasBrace, up };
}

// ---------- 留め具の群（アンカー・ボルト）: 群の中心にはたらく力 F とモーメント M から、1 本ごとの引張・せん断を出す ----------
export function groupForces(points, axis, F, M, { minLever = 40 } = {}) {
  const n = points.length; if (!n) return []; const c = mul(points.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / n); const ax = norm(axis);
  let e1 = cross(ax, [1, 0, 0]); if (len(e1) < 0.1) e1 = cross(ax, [0, 0, 1]); e1 = norm(e1); const e2 = cross(ax, e1);
  const loc = points.map(p => { const r = sub(p, c); return [dot(r, e1), dot(r, e2)]; }); let S11 = 0, S22 = 0; for (const [a, b] of loc) { S11 += a * a; S22 += b * b; }
  const lev = n * minLever * minLever; S11 = Math.max(S11, lev * 0.5); S22 = Math.max(S22, lev * 0.5); /* 一直線に並ぶ群は、板の端までの腕（最小 40 mm 相当）で受けると仮定 */
  const Fa = dot(F, ax), F1 = dot(F, e1), F2 = dot(F, e2), M1 = dot(M, e1), M2 = dot(M, e2), Mt = dot(M, ax); const Sp = Math.max(S11 + S22, lev);
  return loc.map(([a, b], i) => { const T = Fa / n + M1 * b / S22 - M2 * a / S11; const q1 = F1 / n - Mt * b / Sp, q2 = F2 / n + Mt * a / Sp; return { i, T, Q: Math.hypot(q1, q2) }; });
}
// ボルト 1 本の照査（引張とせん断の組合せ: fts = min(ft, 1.4ft − 1.6τ)）
function boltCheck(T, Q, As, ft, fs) { const tau = Q / As, sig = Math.max(0, T) / As; const fts = Math.max(0, Math.min(ft, 1.4 * ft - 1.6 * tau)); return { tau, sig, fts, rShear: tau / fs, rTens: fts > 0 ? sig / fts : (sig > 0 ? 99 : 0) }; }

// ---------- 1 つの支持金具を計算する ----------
export function analyzeParts(parts, settings, opts = {}) {
  const s = settings; const fr = buildFrame(parts, s, opts); if (fr.empty) return { empty: true, ok: true, ratio: 0, items: [], members: [], connections: [], warnings: fr.warnings, loads: { pipes: [], extras: [], extra: 0, pipe: 0, total: 0, self: 0 } };
  const { mem, nodes, elems, supports, supInfo, pipes, extras, up } = fr; const N = nodes.length * 6; const warnings = [...fr.warnings];
  const hung = mem.some(m => m.rod); const lateral = !(hung && !s.rodSeismic); /* 吊ボルトで吊る金具は、設定で指定しない限り水平の地震力をかけない（別の耐震支持で受ける前提） */
  const KH = khOf(s), KV = KH * (s.kvRatio ?? 0.5);
  // 水平の 2 方向: 管軸方向 h1 と管軸直角 h2
  let h1 = pipes.length ? sub(pipes[0].axis, mul(up, dot(pipes[0].axis, up))) : [1, 0, 0]; if (len(h1) < 0.1) h1 = Math.abs(up[0]) < 0.9 ? cross(up, [0, 0, 1]) : [0, 0, 1]; h1 = norm(sub(h1, mul(up, dot(h1, up)))); const h2 = norm(cross(up, h1));
  // 荷重ベクトル: G（長期）、E1・E2（水平の地震）、EV（鉛直の地震、上向き）
  const G = new Float64Array(N), E1 = new Float64Array(N), E2 = new Float64Array(N), EV = new Float64Array(N); const put = (V, nd, dir, mag) => { for (let q = 0; q < 3; q++) V[nd * 6 + q] += dir[q] * mag; };
  let self = 0; for (const e of elems) { const L = len(sub(nodes[e.j], nodes[e.i])); const w = e.A * L * 7.85e-6 * g0 * (e.mem.F === s.Fsus ? 7.93 / 7.85 : 1); self += w; for (const nd of [e.i, e.j]) { put(G, nd, up, -w / 2); put(E1, nd, h1, KH * w / 2); put(E2, nd, h2, KH * w / 2); put(EV, nd, up, KV * w / 2); } }
  let Wp = 0, Wps = 0; for (const p of pipes) { Wp += p.W; Wps += p.Ws; put(G, p.nd, up, -p.W); put(E1, p.nd, h1, KH * p.Ws); put(E2, p.nd, h2, KH * p.Ws); put(EV, p.nd, up, KV * p.Ws); }
  let Wx = 0; for (const x of extras) { Wx += x.W; put(G, x.nd, up, -x.W); put(E1, x.nd, h1, KH * x.W); put(E2, x.nd, h2, KH * x.W); put(EV, x.nd, up, KV * x.W); }
  const sol = solveFrame3D({ nodes, elems, supports, loads: [G, E1, E2, EV] });
  // 組合せ: 長期 = G、短期 = G ± 水平 ± 鉛直
  const cases = [{ key: 'L', name: '長期（常時）', term: 'long', c: [1, 0, 0, 0] }];
  if (KH > 0 && !lateral) { for (const sv of [1, -1]) cases.push({ key: `SV${sv > 0 ? 'u' : 'd'}`, name: `短期（地震 鉛直${sv > 0 ? '上' : '下'}）`, term: 'short', c: [1, 0, 0, sv] }); warnings.push('吊ボルトで吊る金具のため、水平の地震力はかけていません（別の耐震支持・振れ止めで受ける前提。設定で変えられます）'); }
  else if (KH > 0) { const dirs = s.seismicDir === 'cross' ? [[2, '管軸直角']] : s.seismicDir === 'axial' ? [[1, '管軸方向']] : [[1, '管軸方向'], [2, '管軸直角']];
    for (const [k, label] of dirs) for (const sh of [1, -1]) for (const sv of [1, -1]) { const c = [1, 0, 0, sv]; c[k] = sh; cases.push({ key: `S${k}${sh > 0 ? '+' : '-'}${sv > 0 ? 'u' : 'd'}`, name: `短期（地震 ${label}${sh > 0 ? '＋' : '−'}・鉛直${sv > 0 ? '上' : '下'}）`, term: 'short', c, dir: k }); } }
  const unstableDir = [false, sol.unstable[1], sol.unstable[2], sol.unstable[3]]; if (sol.unstable[0]) warnings.push('常時の荷重に対して骨組みが不安定です（支持点か接合が足りません）');
  const lateralNote = []; if (KH > 0 && lateral) { if (unstableDir[1]) lateralNote.push('管軸方向'); if (unstableDir[2]) lateralNote.push('管軸直角'); }
  const liveCases = cases.filter(c => !sol.unstable[0] && !(c.dir && unstableDir[c.dir]) && !(c.term === 'short' && unstableDir[3]));
  const comb = (c, f) => c.c.reduce((a, k, q) => a + (k ? k * f(q) : 0), 0);
  const elemForces = elems.map((_, ei) => [0, 1, 2, 3].map(q => sol.forces(q, ei)));
  const endForce = (c, ei, end) => { const o = {}; for (const key of ['N', 'Vu', 'Vv', 'T', 'Mu', 'Mv']) o[key] = comb(c, q => elemForces[ei][q] ? elemForces[ei][q][end][key] : 0); return o; };
  const disp = (c, nd) => [0, 1, 2, 3, 4, 5].map(q => comb(c, k => sol.u[k][nd * 6 + q]));
  const items = []; const members = [];
  const push = (it) => { it.ratio = Number.isFinite(it.ratio) ? it.ratio : 99; items.push(it); return it; };
  // ---- 部材 ----
  for (const m of mem) { if (!m.elems.length) continue; const sec = m.sec; const al = allowables(m.F, m.E); const kf = s.kFactor > 0 ? +s.kFactor : m.cant ? 2.0 : (m.vertical && !fr.hasBrace && !m.rod) ? 1.5 : 1.0; const lk = kf * m.L, lambda = lk / sec.imin; const fc0 = fcOf(m.F, m.E, lambda), fb0 = fbOf(m.F, m.E, sec, m.L);
    const rec = { idx: m.idx, name: m.name, spec: m.spec, L: r1(m.L), rod: !!m.rod, lambda: r1(lambda), kf, checks: [] }; const best = {};
    const keep = (key, it) => { if (!best[key] || it.ratio > best[key].ratio) best[key] = it; };
    for (const c of liveCases) { const mult = c.term === 'short' ? 1.5 : 1; const ft = (m.rod ? s.boltFt / 1.5 : al.ft) * mult, fc = fc0 * mult, fbu = (sec.Iu >= sec.Iv ? fb0 : al.ft) * mult, fbv = (sec.Iv > sec.Iu ? fb0 : al.ft) * mult, fs = (m.rod ? s.boltFs / 1.5 : al.fs) * mult;
      for (const ei of m.elems) for (const end of ['i', 'j']) { const f = endForce(c, ei, end); const n = f.N / sec.A; let r = 0, sigMax = 0, sb = 0;
        if (sec.round) { const Mr = Math.hypot(f.Mu, f.Mv); sb = Mr * sec.R / sec.Iu; const sbn = sb / (m.rod ? ft : fbu); r = Math.max(n >= 0 ? n / ft + sbn : -n / fc + sbn, sbn - (n >= 0 ? n / ft : 0)); sigMax = Math.abs(n) + sb; }
        else for (const [u, v] of sec.pts) { const su = f.Mu * v / sec.Iu, sv = -f.Mv * u / sec.Iv; const nb = su / fbu + sv / fbv; const rr = Math.max(nb + n / ft, -nb + (n < 0 ? -n / fc : -n / ft)); if (rr > r) r = rr; sigMax = Math.max(sigMax, Math.abs(n + su + sv)); sb = Math.max(sb, Math.abs(su + sv)); }
        keep('comb_' + c.term, { ratio: r, value: sigMax, f, n, sb, c, ft, fc, fb: Math.min(fbu, fbv) });
        const V = Math.hypot(f.Vu, f.Vv); const tau = sec.shearK * V / sec.A + (sec.J > 0 ? Math.abs(f.T) * sec.tmax / sec.J : 0); keep('shear', { ratio: tau / fs, value: tau, limit: fs, V, T: f.T, c });
        if (m.rod && f.N < -1) keep('rodcomp', { ratio: 1.01, value: -f.N, c }); if (f.N < -1) rec.comp = true; } }
    for (const term of ['long', 'short']) { const b = best['comb_' + term]; if (!b) continue; const comp = b.n < 0; const lim = comp ? b.fc : b.ft;
      const ra = Math.abs(b.n) / lim, rb = Math.max(0, b.ratio - ra); /* 検定比の内訳: 軸力の分と曲げの分 */
      rec.checks.push(push({ scope: 'member', partIndex: m.idx, part: m.name, kind: 'stress', term, label: `${m.rod ? '引張＋曲げ' : comp ? '圧縮＋曲げ' : '引張＋曲げ'}（${term === 'long' ? '長期' : '短期'}）`, value: r2(b.ratio), unit: '', limit: 1, ratio: b.ratio, caseName: b.c.name, sigma: r1(b.value), sigmaN: r1(Math.abs(b.n)), sigmaB: r1(b.sb), fa: r1(lim), fb: r1(b.fb),
        detail: `${comp ? 'σc/fc' : 'σt/ft'} + σb/fb = ${r1(Math.abs(b.n))}/${r1(lim)} + ${r1(b.sb)}/${r1(b.fb)} = ${r2(ra)} + ${r2(rb)}（N/mm²）。N = ${r2(Math.abs(b.f.N) / 1000)} kN（${comp ? '圧縮' : '引張'}）、M = ${r2(Math.hypot(b.f.Mu, b.f.Mv) / 1e6)} kN·m${comp ? `、λ = ${r1(lambda)}（座屈長さ係数 ${kf}）` : ''}${m.rod && b.sb > 0.3 * b.ft ? '。吊ボルトに曲げがかかっています（振れ止めが必要です）' : ''}` })); }
    if (best.shear && best.shear.value > 0.05) rec.checks.push(push({ scope: 'member', partIndex: m.idx, part: m.name, kind: 'shear', term: best.shear.c.term, label: 'せん断', value: r1(best.shear.value), unit: 'N/mm²', limit: r1(best.shear.limit), ratio: best.shear.ratio, caseName: best.shear.c.name, detail: `Q = ${r2(best.shear.V / 1000)} kN、ねじり T = ${r2(Math.abs(best.shear.T) / 1e6)} kN·m` }));
    if (best.rodcomp) rec.checks.push(push({ scope: 'member', partIndex: m.idx, part: m.name, kind: 'rodcomp', term: best.rodcomp.c.term, label: '吊ボルトに圧縮', value: r2(best.rodcomp.value / 1000), unit: 'kN', limit: 0, ratio: 1.01, caseName: best.rodcomp.c.name, detail: '吊ボルトは圧縮を受けられません。振れ止めや突っ張りが必要です' }));
    if (!m.rod && rec.comp && lambda > 250) rec.checks.push(push({ scope: 'member', partIndex: m.idx, part: m.name, kind: 'slender', term: 'long', label: '細長比', value: r1(lambda), unit: '', limit: 250, ratio: lambda / 250, caseName: '—', detail: `λ = lk / i = ${r1(lk)} / ${r1(sec.imin)}（圧縮材の目安 250 以下）` }));
    // たわみ（長期）: 両端がつながる部材は弦からのずれ、片持ちは根元からのずれ
    if (!m.rod && !sol.unstable[0] && m.nodes.length >= 2) { const c = cases[0]; const first = m.nodes[0], last = m.nodes[m.nodes.length - 1]; let dmax = 0; const lim = m.L / (m.cant ? s.deflLimitCant : s.deflLimit);
      if (m.cant) { const root = m.free0 ? last : first, tip = m.free0 ? first : last; const ur = disp(c, root.nd), ut = disp(c, tip.nd); const rv = sub(nodes[tip.nd], nodes[root.nd]); const rigid = add(ur.slice(0, 3), cross(ur.slice(3), rv)); dmax = len(sub(ut.slice(0, 3), rigid)); }
      else { const u0 = disp(c, first.nd).slice(0, 3), u1 = disp(c, last.nd).slice(0, 3); const span = (last.t - first.t) || 1; for (const q of m.nodes) { const k = (q.t - first.t) / span; const uq = disp(c, q.nd).slice(0, 3); const rel = sub(uq, add(mul(u0, 1 - k), mul(u1, k))); const perp = sub(rel, mul(m.d, dot(rel, m.d))); dmax = Math.max(dmax, len(perp)); } }
      if (dmax > 0.005) rec.checks.push(push({ scope: 'member', partIndex: m.idx, part: m.name, kind: 'defl', term: 'long', label: 'たわみ（長期）', value: r2(dmax), unit: 'mm', limit: r2(lim), ratio: dmax / lim, caseName: c.name, detail: `制限 L/${m.cant ? s.deflLimitCant : s.deflLimit}（L = ${r1(m.L)} mm${m.cant ? '、片持ち' : ''}）` })); }
    rec.worst = rec.checks.slice().sort((a, b) => b.ratio - a.ratio)[0] || null; members.push(rec); }
  // ---- 支持点の反力とアンカー ----
  const connections = []; const reac = [0, 1, 2, 3].map(q => sol.reactions(q)); const reaction = (c, nd) => [0, 1, 2, 3, 4, 5].map(q => comb(c, k => reac[k].get(nd)?.[q] || 0));
  const centroid = mul(mem.reduce((a, m) => add(a, add(m.a, m.b)), [0, 0, 0]), 1 / (2 * mem.length)); const supOut = [];
  for (const sp of supInfo) { const pos = nodes[sp.nd]; const Rl = reaction(cases[0], sp.nd); supOut.push({ pos: pos.map(r1), type: sp.type, kind: sp.kind, n: sp.items.length, R: Rl.map((v, q) => q < 3 ? r2(v / 1000) : r3(v / 1e6)) });
    if (sp.kind !== 'anchor' || !sp.items.length) continue; const pts = sp.items.map(a => a.pt.pl.pos); const M0 = sp.items[0].pt.M || 'M12'; const th = threadArea(M0); let axis = sp.items[0].pt.pl.basis[2]; const gc = mul(pts.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / pts.length); if (dot(axis, sub(centroid, gc)) < 0) axis = mul(axis, -1); /* 軸は「コンクリートから構造物へ」向き */
    const TaS = s.anchorShort[anchorKey(M0)] ?? 3.8; let wT = null, wQ = null;
    const key = anchorKey(M0); const le = s.anchorEmbed[key] ?? 60; const Ac0 = Math.PI * le * (le + th.d); const rproj = Math.sqrt(Ac0 / Math.PI); let wC = null, wP = null;
    // ベースプレート: 支持点の近くの板（アンカー穴のある板）
    const plate = s.plateCheck ? parts.filter(pt => pt.kind === 'plate' && !pt.ref && pt.pl && (pt.holes || []).some(hh => hh.kind === 'anchor')).map(pt => { const pp = parseSpec(pt.spec); const [ex, , ez] = pt.pl.basis; const w = pp?.w || 0, hh = pp?.h || pt.length || 0; return { pt, pp, w, hh, c: add(pt.pl.pos, add(mul(ex, w / 2), mul(ez, hh / 2))) }; }).filter(q => q.pp?.t > 0).sort((x, y) => len(sub(x.c, gc)) - len(sub(y.c, gc)))[0] : null; const plateOk = plate && len(sub(plate.c, gc)) < Math.max(plate.w, plate.hh, 120);
    const secS = sp.m.sec; const hmin = secS.round ? secS.R : Math.min(Math.max(...secS.pts.map(q => Math.abs(q[0]))), Math.max(...secS.pts.map(q => Math.abs(q[1]))));
    for (const c of liveCases) { const R = reaction(c, sp.nd); const F = mul(R.slice(0, 3), -1); /* アンカーにかかる力 = −反力 */ const Mn = mul(R.slice(3), -1); const Mc = add(Mn, cross(sub(pos, gc), F)); const mult = c.term === 'short' ? 1 : 1 / 1.5;
      for (const b of groupForces(pts, axis, F, Mc)) { const Ta = TaS * 1000 * mult;
        if (b.T > 1 && s.coneCheck) { let k = 1; const near2 = pts.map((q, qi) => qi === b.i ? Infinity : len(sub(q, pts[b.i]))).sort((x, y) => x - y).slice(0, 2); for (const d of near2) if (d < 2 * rproj) k *= 0.5 * (1 + d / (2 * rproj)); if (s.edgeDist > 0 && s.edgeDist < rproj) k *= 0.5 * (1 + s.edgeDist / rproj); k = Math.max(0.25, k); const Tc = (c.term === 'short' ? 2 / 3 : 1 / 3) * 0.31 * Math.sqrt(s.Fc) * Ac0 * k; const r = b.T / Tc; if (!wC || r > wC.ratio) wC = { ratio: r, T: b.T, Tc, k, c }; }
        if (b.T > 1 && plateOk) { const ap = pts[b.i]; const dAxis = ptSeg(ap, sp.m.a, sp.m.b).dist; const e = Math.max(10, dAxis - hmin); const beff = Math.max(20, Math.min(2 * e + th.d, Math.min(plate.w, plate.hh) || 2 * e + th.d)); const sig = 6 * b.T * e / (beff * plate.pp.t ** 2); const lim = sp.m.F / 1.3 * (c.term === 'short' ? 1.5 : 1); const r = sig / lim; if (!wP || r > wP.ratio) wP = { ratio: r, sig, lim, e, beff, T: b.T, c }; }
 const bc = boltCheck(b.T, b.Q, th.As, s.boltFt * mult, s.boltFs * mult); const rT = Math.max(Math.max(0, b.T) / Ta, bc.rTens); if (!wT || rT > wT.ratio) wT = { ratio: rT, T: b.T, Ta, c, bc }; if (!wQ || bc.rShear > wQ.ratio) wQ = { ratio: bc.rShear, Q: b.Q, c, bc, fs: s.boltFs * mult }; } }
    const label = `アンカー ${th.name} ×${pts.length}`; const first = sp.items[0].idx;
    if (wT) connections.push(push({ scope: 'anchor', partIndex: first, part: label, kind: 'anchorT', term: wT.c.term, label: '引抜', value: r2(Math.max(0, wT.T) / 1000), unit: 'kN/本', limit: r2(wT.Ta / 1000), ratio: wT.ratio, caseName: wT.c.name, detail: `許容引抜 ${r2(wT.Ta / 1000)} kN（${wT.c.term === 'short' ? '短期' : '長期 = 短期 ÷ 1.5'}、あと施工 金属拡張 おねじ形の目安）。ボルト本体は σ = ${r1(wT.bc.sig)} ≤ fts = ${r1(wT.bc.fts)} N/mm²` }));
    if (wC) connections.push(push({ scope: 'anchor', partIndex: first, part: label, kind: 'anchorCone', term: wC.c.term, label: 'コンクリートのコーン状破壊', value: r2(wC.T / 1000), unit: 'kN/本', limit: r2(wC.Tc / 1000), ratio: wC.ratio, caseName: wC.c.name, detail: `許容 = φ × 0.31√Fc × Ac × 低減 = ${wC.c.term === 'short' ? '2/3' : '1/3'} × 0.31√${s.Fc} × ${Math.round(Ac0)} mm² × ${r2(wC.k)}（有効埋込み ${le} mm、Ac = π·le·(le + d)。となりのアンカー${s.edgeDist > 0 ? '・へりあき' : ''}と重なる分を低減）` }));
    if (wP) connections.push(push({ scope: 'plate', partIndex: parts.indexOf(plate.pt), part: `${plate.pt.name || 'ベースプレート'} t${plate.pp.t}`, kind: 'basePlate', term: wP.c.term, label: 'ベースプレートの曲げ', value: r1(wP.sig), unit: 'N/mm²', limit: r1(wP.lim), ratio: wP.ratio, caseName: wP.c.name, detail: `M = T × e = ${r2(wP.T / 1000)} kN × ${r1(wP.e)} mm、有効幅 ${r1(wP.beff)} mm、σ = 6M/(b·t²)、許容 F/1.3${wP.c.term === 'short' ? ' × 1.5' : ''}（アンカーの引張で板が片持ちに曲がると仮定）` }));
    if (wQ && wQ.Q > 1) connections.push(push({ scope: 'anchor', partIndex: first, part: label, kind: 'anchorQ', term: wQ.c.term, label: 'せん断', value: r1(wQ.bc.tau), unit: 'N/mm²', limit: r1(wQ.fs), ratio: wQ.ratio, caseName: wQ.c.name, detail: `Q = ${r2(wQ.Q / 1000)} kN/本、有効断面積 ${r1(th.As)} mm²` })); }
  // ---- 部材の端の力（接合の照査に使う）----
  const memberEnd = (p, maxD = 120) => { let best = null; for (const m of mem) { if (!m.elems.length || m.rod) continue; for (const [end, pos, ei, key] of [[0, m.a, m.elems[0], 'i'], [1, m.b, m.elems[m.elems.length - 1], 'j']]) { const d = len(sub(pos, p)); if (d < (best?.d ?? maxD)) best = { m, end, ei, key, d, nd: end ? m.nodes[m.nodes.length - 1].nd : m.nodes[0].nd }; } } return best; };
  // 断面力（局所）→ 全体座標の力とモーメント。相手側にはたらく向き（大きさだけ使うので符号は問わない）
  const endVec = (c, me) => { const f = endForce(c, me.ei, me.key); const R = elemForces[me.ei][0]?.R || [me.m.d, me.m.eu, cross(me.m.d, me.m.eu)]; const F = add(add(mul(R[0], f.N), mul(R[1], f.Vu)), mul(R[2], f.Vv)); const M = add(add(mul(R[0], f.T), mul(R[1], f.Mu)), mul(R[2], f.Mv)); return { F, M, f }; };
  // ---- ボルト（接合）----
  const bolts = parts.map((pt, idx) => ({ pt, idx })).filter(x => x.pt.kind === 'bolt' && !x.pt.ref && x.pt.pl); const bgroups = [];
  for (const b of bolts) { let g = bgroups.find(q => q.M === (b.pt.M || 'M12') && q.group === (b.pt.group || '') && q.items.some(o => len(sub(o.pt.pl.pos, b.pt.pl.pos)) < 260)); if (!g) bgroups.push(g = { M: b.pt.M || 'M12', group: b.pt.group || '', items: [] }); g.items.push(b); }
  for (const g of bgroups) { const pts = g.items.map(b => b.pt.pl.pos); const gc = mul(pts.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / pts.length); const th = threadArea(g.M); const axis = g.items[0].pt.pl.basis[2]; const me = memberEnd(gc); let nd = null; if (!me) { let bd = 200; nodes.forEach((p, i) => { if (supports.has(i)) { const d = len(sub(p, gc)); if (d < bd) { bd = d; nd = i; } } }); if (nd == null) continue; }
    let wT = null, wQ = null; for (const c of liveCases) { let F, M, at; if (me) { const v = endVec(c, me); F = v.F; M = v.M; at = nodes[me.nd]; } else { const R = reaction(c, nd); F = R.slice(0, 3); M = R.slice(3); at = nodes[nd]; } const Mc = add(M, cross(sub(at, gc), F)); const mult = c.term === 'short' ? 1 : 1 / 1.5;
      for (const sign of [1, -1]) for (const b of groupForces(pts, axis, mul(F, sign), mul(Mc, sign))) { const bc = boltCheck(b.T, b.Q, th.As, s.boltFt * mult, s.boltFs * mult); if (!wT || bc.rTens > wT.ratio) wT = { ratio: bc.rTens, bc, T: b.T, c, ft: s.boltFt * mult }; if (!wQ || bc.rShear > wQ.ratio) wQ = { ratio: bc.rShear, bc, Q: b.Q, c, fs: s.boltFs * mult }; } }
    const label = `ボルト ${th.name} ×${pts.length}${g.group ? `（${g.group}）` : ''}`; const first = g.items[0].idx;
    if (wQ && wQ.Q > 1) connections.push(push({ scope: 'bolt', partIndex: first, part: label, kind: 'boltQ', term: wQ.c.term, label: 'せん断', value: r1(wQ.bc.tau), unit: 'N/mm²', limit: r1(wQ.fs), ratio: wQ.ratio, caseName: wQ.c.name, detail: `Q = ${r2(wQ.Q / 1000)} kN/本、有効断面積 ${r1(th.As)} mm²` }));
    if (wT && wT.T > 1) connections.push(push({ scope: 'bolt', partIndex: first, part: label, kind: 'boltT', term: wT.c.term, label: '引張', value: r1(wT.bc.sig), unit: 'N/mm²', limit: r1(wT.bc.fts), ratio: wT.ratio, caseName: wT.c.name, detail: `T = ${r2(wT.T / 1000)} kN/本、せん断との組合せ fts = min(ft, 1.4ft − 1.6τ)` })); }
  // ---- U ボルト: 配管が部材から離れる向きの力は 2 本の脚の引張、横向きの力はせん断 ----
  const ubolts = parts.map((pt, idx) => ({ pt, idx })).filter(x => x.pt.kind === 'ubolt' && !x.pt.ref && x.pt.pl);
  for (const p of pipes) { const ub = ubolts.filter(u => String(u.pt.nominal) === String(p.part.nominal) && len(sub(u.pt.pl.pos, p.c)) < p.od * 2 + 200).sort((a, b) => len(sub(a.pt.pl.pos, p.c)) - len(sub(b.pt.pl.pos, p.c)))[0]; if (!ub) continue; const th = threadArea(ub.pt.M); const q = add(p.m.a, mul(p.m.d, p.p.t)); let nrm = sub(p.c, q); nrm = sub(nrm, mul(p.axis, dot(nrm, p.axis))); if (len(nrm) < 1) nrm = up; nrm = norm(nrm);
    let wT = null, wQ = null; for (const c of liveCases) { const F = add(add(add(mul(up, -p.W * c.c[0]), mul(h1, KH * p.Ws * c.c[1])), mul(h2, KH * p.Ws * c.c[2])), mul(up, KV * p.Ws * c.c[3])); const T = Math.max(0, dot(F, nrm)) / 2; const lat = sub(sub(F, mul(nrm, dot(F, nrm))), mul(p.axis, dot(F, p.axis))); const Q = len(lat) / 2; const mult = c.term === 'short' ? 1 : 1 / 1.5; const bc = boltCheck(T, Q, th.As, s.boltFt * mult, s.boltFs * mult);
      if (!wT || bc.rTens > wT.ratio) wT = { ratio: bc.rTens, bc, T, c }; if (!wQ || bc.rShear > wQ.ratio) wQ = { ratio: bc.rShear, bc, Q, c, fs: s.boltFs * mult }; }
    const label = `U ボルト ${th.name}（${p.nominal}）`;
    if (wT && wT.T > 1) connections.push(push({ scope: 'ubolt', partIndex: ub.idx, part: label, kind: 'uboltT', term: wT.c.term, label: '引張', value: r1(wT.bc.sig), unit: 'N/mm²', limit: r1(wT.bc.fts), ratio: wT.ratio, caseName: wT.c.name, detail: `T = ${r2(wT.T / 1000)} kN/脚（2 本の脚で等分）` }));
    if (wQ && wQ.Q > 1) connections.push(push({ scope: 'ubolt', partIndex: ub.idx, part: label, kind: 'uboltQ', term: wQ.c.term, label: 'せん断', value: r1(wQ.bc.tau), unit: 'N/mm²', limit: r1(wQ.fs), ratio: wQ.ratio, caseName: wQ.c.name, detail: `Q = ${r2(wQ.Q / 1000)} kN/脚` })); }
  // ---- 溶接（隅肉）: 群ごとに、のど断面（0.7 × 脚長）の線の集まりとして、力とモーメントから最大の応力を出す ----
  const welds = parts.map((pt, idx) => ({ pt, idx })).filter(x => x.pt.kind === 'weld' && !x.pt.ref && x.pt.from && x.pt.to && x.pt.weldType !== 'butt'); const wgroups = []; /* 同じ名前でも、離れた所（左右の柱頭など）は別の群にする */ for (const w of welds) { const k = w.pt.group || '溶接'; const mid = mul(add(w.pt.from, w.pt.to), 0.5); let g = wgroups.find(q => q.name === k && q.ws.some(o => len(sub(mul(add(o.pt.from, o.pt.to), 0.5), mid)) < 170)); if (!g) wgroups.push(g = { name: k, ws: [] }); g.ws.push(w); }
  for (const { name, ws } of wgroups) { let Aw = 0, cs = [0, 0, 0]; for (const w of ws) { const a = 0.7 * (w.pt.size || 6) * (w.pt.length || len(sub(w.pt.to, w.pt.from))); Aw += a; cs = add(cs, mul(mul(add(w.pt.from, w.pt.to), 0.5), a)); } if (!(Aw > 0)) continue; const gc = mul(cs, 1 / Aw); const me = memberEnd(gc, 90); if (!me) continue;
    // 慣性テンソル（のど断面の線）
    const I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const w of ws) { const th = 0.7 * (w.pt.size || 6); const l = w.pt.length || len(sub(w.pt.to, w.pt.from)); const a = th * l; const r = sub(mul(add(w.pt.from, w.pt.to), 0.5), gc); const d = norm(sub(w.pt.to, w.pt.from)); const rr = dot(r, r); for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) I[x][y] += a * ((x === y ? rr : 0) - r[x] * r[y]) + a * (l * l / 12) * ((x === y ? 1 : 0) - d[x] * d[y]) + (x === y ? a * th * th / 12 : 0); }
    const inv = inv3(I); if (!inv) continue; let w0 = null; const fw = s.weldF / (1.5 * Math.sqrt(3));
    for (const c of liveCases) { const v = endVec(c, me); const at = nodes[me.nd]; const Mc = add(v.M, cross(sub(at, gc), v.F)); const om = mulM(inv, Mc); const mult = c.term === 'short' ? 1.5 : 1; for (const w of ws) for (const p of [w.pt.from, w.pt.to]) { const tv = add(mul(v.F, 1 / Aw), cross(om, sub(p, gc))); const tau = len(tv); const ratio = tau / (fw * mult); if (!w0 || ratio > w0.ratio) w0 = { ratio, tau, c, lim: fw * mult, F: len(v.F), M: len(Mc) }; } }
    if (w0 && w0.tau > 0.05) connections.push(push({ scope: 'weld', partIndex: ws[0].idx, part: `溶接（${name}）`, kind: 'weld', term: w0.c.term, label: 'のど断面のせん断', value: r1(w0.tau), unit: 'N/mm²', limit: r1(w0.lim), ratio: w0.ratio, caseName: w0.c.name, detail: `脚長 ${ws[0].pt.size || 6} mm × ${ws.length} 本、のど断面積 ${r1(Aw)} mm²、F = ${r2(w0.F / 1000)} kN、M = ${r3(w0.M / 1e6)} kN·m` })); }
  // ---- まとめ ----
  if (lateralNote.length) { const onlyRods = mem.every(m => m.rod) || mem.some(m => m.rod); push({ scope: 'system', partIndex: mem[0].idx, part: '全体', kind: 'unstable', term: 'short', label: `水平の地震力（${lateralNote.join('・')}）`, value: 0, unit: '', limit: 0, ratio: 1.01, caseName: '短期', detail: onlyRods ? '吊ボルトだけでは水平力を受けられません。振れ止め（斜材・ブレース）か、別の耐震支持が必要です' : 'この向きの水平力を受ける部材・支持がありません。斜材や支持点を足してください' }); warnings.push(`${lateralNote.join('・')}の水平力に対して不安定です`); }
  const pipeOut = pipes.map(p => { const u = sol.unstable[0] ? [0, 0, 0] : disp(cases[0], p.nd).slice(0, 3); return { nominal: p.nominal, kgm: r2(p.kgm), steel: r2(p.steel), fluid: r2(p.fluid), insul: r2(p.insul), span: p.span, sspan: p.sspan, W: Math.round(p.W), Ws: Math.round(p.Ws), on: p.m.name, ecc: r1(p.ecc), disp: r2(len(u)) }; });
  const worst = items.slice().sort((a, b) => b.ratio - a.ratio)[0] || null; const ratio = worst ? worst.ratio : 0;
  return { ok: ratio <= 1, ratio, worst, items, members, connections, supports: supOut, warnings, assumed: fr.assumed, KH, KV, lateral, hung, cases: cases.map(c => c.name), loads: { pipes: pipeOut, pipe: Math.round(Wp), pipeSeismic: Math.round(Wps), self: Math.round(self), extra: Math.round(Wx), extras: extras.map(x => ({ name: x.name, kg: x.kg, W: Math.round(x.W), on: x.m.name, partIndex: x.m.idx })), total: Math.round(Wp + self + Wx) }, model: { nodes: nodes.length, elems: elems.length, supports: supInfo.length } };
}
function inv3(m) { const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2]; const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g; const det = a * A + b * B + c * C; if (!(Math.abs(det) > 1e-9)) return null; return [[A / det, (c * h - b * i) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, (c * d - a * f) / det], [C / det, (b * g - a * h) / det, (a * e - b * d) / det]]; }
const mulM = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

// ---------- 仮定の説明（画面と計算書に必ず出す） ----------
export function assumptionsText(s) { const KH = khOf(s);
  return [
    `骨組み: 部材の図心を通る線で立体の骨組みを作り、接している部材どうしは剛接合として解いています（直接剛性法、1 節点 6 自由度）。接合部の偏心・部分的な固定度は考えていません`,
    `支持点: アンカーで締め付けた点は固定、吊ボルトの上端（スラブ側）はピンと仮定しています。1 列に並ぶアンカーの直角方向のモーメントは、腕の長さ 40 mm 相当で受けると仮定しています`,
    `荷重（長期）: 配管 = （管 + ${s.contents === 'empty' ? '中身なし' : s.contents === 'custom' ? `中身 ${s.contentsDensity} kg/m³` : '満水'} + 保温 ${s.insulDensity} kg/m³）× 支持間隔${s.span > 0 ? ` ${s.span} m` : '（呼び径ごとの目安: 25A まで 1.8 m、40A まで 2.0 m、50A 2.5 m、80A まで 3.0 m、100A 4.0 m、それ以上 5.0 m）'}。部材の自重を含みます（板・ボルトの重さは含みません）`,
    s.seismic ? `荷重（短期）: 地震 = 設計用水平震度 KH = ${r2(KH)}${s.khManual != null && s.khManual !== '' ? '（直接指定）' : `（耐震クラス ${s.seismicClass}・${{ top: '上層階・屋上', mid: '中間階', low: '1 階・地階' }[s.floor]}、地域係数 ${s.zone}）`}、鉛直 KV = KH × ${s.kvRatio}。水平は管軸方向と管軸直角方向を別々にかけ、鉛直の上下と組み合わせています。地震時に負担する配管長さは${s.seismicSpan > 0 ? ` ${s.seismicSpan} m` : '支持間隔と同じ'}` : '荷重（短期）: 地震は計算していません',
    `部材: 許容応力度設計（SS400 F = ${s.F} N/mm²。長期 引張・曲げ F/1.5、せん断 F/1.5√3、圧縮は細長比による低減、短期は 1.5 倍）。溝形・H 形の強軸まわりの曲げは横座屈による低減を入れています`,
    s.angleMethod === 'geometric' ? '山形鋼の曲げ: JIS の表と同じ軸（脚に平行な軸）で計算しています（手計算の慣例）。断面の主軸で計算する場合とは、結果が変わります' : '山形鋼の曲げ: 断面の主軸で計算しています（山形鋼は脚に平行な軸が主軸ではないため）。脚に平行な軸で計算する手計算とは、結果が変わります',
    `座屈長さ: ${s.kFactor > 0 ? `係数 ${s.kFactor}（指定）` : '片持ち 2.0、斜材のない骨組みの柱 1.5、そのほか 1.0'} × 部材の長さ。たわみ制限 L/${s.deflLimit}（片持ち L/${s.deflLimitCant}）`,
    `ボルト・U ボルト・吊ボルト: 有効断面積で計算。短期許容 引張 ${s.boltFt}・せん断 ${s.boltFs} N/mm²（長期は 1/1.5）、引張とせん断の組合せは fts = min(ft, 1.4ft − 1.6τ)`,
    `アンカー: 短期許容引抜 ${Object.entries(s.anchorShort).map(([k, v]) => `${k} ${v}`).join('、')} kN（あと施工 金属拡張 おねじ形の目安。長期は 1/1.5）。コンクリートの強度・厚さ・へりあき・施工の条件で変わるので、メーカーの値で確かめてください`,
    `溶接: 隅肉。のど厚 0.7 × 脚長、長期許容 ${r1(s.weldF / (1.5 * Math.sqrt(3)))} N/mm²（短期 1.5 倍）。溶接の群の図心まわりで、力とモーメントから最大の応力を出しています`,
    `コンクリート: アンカーの引張によるコーン状破壊を、許容 = φ × 0.31√Fc × Ac（Fc = ${s.Fc} N/mm²、φ は短期 2/3・長期 1/3、Ac = π·le·(le + d)、有効埋込み ${Object.entries(s.anchorEmbed).map(([k, v]) => `${k} ${v}`).join('、')} mm）で照査。となりのアンカー${s.edgeDist > 0 ? `とへりあき ${s.edgeDist} mm` : ''}で投影面積が重なる分は簡易に低減しています${s.edgeDist > 0 ? '' : '（へりあきは十分にあると仮定）'}`,
    'ベースプレート: アンカーの引張で、柱の縁からアンカーまでを片持ちとして曲がると仮定（有効幅 = 2e + アンカー径、許容 F/1.3、短期 1.5 倍）。圧縮側の支圧は見ていません',
    '配管のほかの荷重（機器・ダクト・ケーブルラックなど）は、金具ごとに重さ・載せる部材・位置を指定して足せます。地震時は同じ震度をかけます',
    '計算していないもの: バンド・サドルなど帯板の金具そのもの、コンクリートのせん断側の破壊（へりあき方向）、ベースプレートの支圧、穴による断面の欠損、局部座屈、疲労、熱による伸び、配管そのものの応力、建物側の強度',
    'この結果は参考値です。設計者による確認と、適用する基準・指針との照合が必要です',
  ]; }
