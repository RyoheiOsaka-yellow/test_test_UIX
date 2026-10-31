// v3 シミュレータの「小さな正直な」構造モデル: 配管荷重 → 部材の曲げ・たわみ・軸力 → ボルト・アンカー・溶接 の照査を簡易式で計算する。
// FEM ではない。各項目に式と仮定を添え、画面に「何を計算し、何を省いたか」を示す。数値は目安であり、設計計算書の代わりにはならない。
import { parseSpec } from '../geo/profiles.js';
import { PIPES } from '../data/sections.js';
export const ASSUME = {
  E: 205000, sigmaA: 156, tauWeldA: 90, boltTauA: 120, anchorPull: { M8: 2.5, M10: 4, M12: 6, M16: 10, M20: 16 }, deflLimit: 300, g: 9.80665, water: true,
  spacing: n => n <= 25 ? 1.8 : n <= 40 ? 2.0 : n <= 50 ? 2.5 : n <= 80 ? 3.0 : n <= 100 ? 4.0 : 5.0,
};
export const ASSUME_TEXT = ['鋼材 SS400: ヤング率 E = 205,000 N/mm²、長期許容曲げ・引張 156 N/mm²', '配管荷重: SGP の鋼管質量（JIS G 3452）＋ 満水質量、支持間隔は呼び径ごとの標準値（15〜25A 1.8 m / 32〜40A 2.0 m / 50A 2.5 m / 65〜80A 3.0 m / 100A 4.0 m / 125A 以上 5.0 m）', '水平部材: 単純支持はりに配管荷重を中央集中荷重、自重を等分布荷重として曲げ応力 M/Z とたわみを計算。たわみ制限 L/300', '鉛直部材: 軸力 P/A と細長比 λ による許容圧縮の簡易低減（λ ≤ 120 で 1−0.4(λ/120)²、超える場合は 0.277(120/λ)²）', 'ボルト: 荷重を本数で等分、許容せん断 120 N/mm²（4.6 相当の仮定）。アンカー: 引抜許容 M10 4 kN / M12 6 kN / M16 10 kN（メーカー値ではない仮定）', '溶接: 隅肉ののど厚 0.7×脚長 × 有効長、許容せん断 90 N/mm²', '省略: 動荷重・地震・熱伸び・偏心・座屈の詳細・接合部の剛性。設計計算書の代わりにはなりません'];
// 断面性能（mm, mm², mm⁴, mm³）: 2 つの長方形の合成で近似
function rect(b, h) { return { A: b * h, I: b * h * h * h / 12 }; }
export function sectionProps(spec) {
  const p = parseSpec(spec); if (!p) return null;
  if (p.kind === 'L') { const a = p.A, b = p.B || p.A, t = p.t; const r1 = { b: t, h: a, y: a / 2 }, r2 = { b: b - t, h: t, y: t / 2 }; const A = r1.b * r1.h + r2.b * r2.h; const yc = (r1.b * r1.h * r1.y + r2.b * r2.h * r2.y) / A; const I = rect(r1.b, r1.h).I + r1.b * r1.h * (r1.y - yc) ** 2 + rect(r2.b, r2.h).I + r2.b * r2.h * (r2.y - yc) ** 2; const c = Math.max(yc, a - yc); return { kind: 'L', A, I, Z: I / c, i: Math.sqrt(I / A), h: a, label: `L-${a}x${b}x${t}` }; }
  if (p.kind === 'C' || p.kind === 'LC') { const H = p.H, B = p.B || p.A, tw = p.t1 || p.t, tf = p.t2 || p.t; const A = H * tw + 2 * (B - tw) * tf; const I = tw * H ** 3 / 12 + 2 * ((B - tw) * tf ** 3 / 12 + (B - tw) * tf * ((H - tf) / 2) ** 2); return { kind: p.kind, A, I, Z: I / (H / 2), i: Math.sqrt(I / A), h: H, label: spec }; }
  if (p.kind === 'FB') { const A = p.t * p.w; const I = p.t * p.w ** 3 / 12; return { kind: 'FB', A, I, Z: I / (p.w / 2), i: Math.sqrt(I / A), h: p.w, label: spec }; }
  if (p.kind === 'PL') { const w = p.w || 100, t = p.t; const A = t * w; const I = w * t ** 3 / 12; return { kind: 'PL', A, I, Z: I / (t / 2), i: Math.sqrt(I / A), h: t, label: spec }; }
  if (p.kind === '□' || p.kind === 'SQ') { const a = p.A || p.H || 50, t = p.t || 2.3; const A = a * a - (a - 2 * t) ** 2; const I = (a ** 4 - (a - 2 * t) ** 4) / 12; return { kind: '□', A, I, Z: I / (a / 2), i: Math.sqrt(I / A), h: a, label: spec }; }
  return null;
}
// 配管 1 本の荷重 N（鋼管 + 満水）× 支持間隔
export function pipeLoad(nominal) { const n = String(nominal).replace(/[^0-9A]/g, ''); const t = PIPES[n]; if (!t) return null; const num = parseInt(n, 10) || 50; const water = ASSUME.water ? Math.PI / 4 * (t.od - 2 * t.t) ** 2 * 1e-6 * 1000 : 0; const kgm = t.w + water; const span = ASSUME.spacing(num); return { nominal: n, kgm: Math.round(kgm * 100) / 100, span, N: Math.round(kgm * span * ASSUME.g), od: t.od }; }
const dirOf = pt => { const z = pt.pl?.basis?.[2] || pt.pl?.basis?.z || null; const b = pt.pl?.basis; const d = Array.isArray(b) ? b[2] : null; return d || [0, 0, 1]; };
// 1 インスタンスの照査
export function analyzeInstance(app, inst, k = 1) {
  const parts = app.instanceParts(inst); parts.forEach((p, i) => { p._idx = i; }); const pipes = parts.filter(p => p.kind === 'pipe' && p.ref); const loads = pipes.map(p => pipeLoad((p.name || p.spec || '').match(/(\d+)A/)?.[1] + 'A')).filter(Boolean);
  const P = loads.reduce((a, l) => a + l.N, 0) * k; const items = []; const members = parts.filter(p => (p.kind === 'member' || p.kind === 'plate') && !p.ref);
  const horiz = members.filter(m => { const d = dirOf(m); return Math.abs(d[1]) < 0.5; }), vert = members.filter(m => { const d = dirOf(m); return Math.abs(d[1]) >= 0.5; });
  const main = horiz.sort((a, b) => (b.length || 0) - (a.length || 0))[0];
  for (const m of members) { const s = sectionProps(m.spec); if (!s || !m.length) continue; const L = m.length; const selfW = s.A * 1e-6 * 7850 * ASSUME.g; // N/mm → per mm: A[m²]*7850*g per m → /1000 per mm
    const w = selfW / 1000; if (horiz.includes(m)) { const Pm = m === main ? P : 0; const M = Pm * L / 4 + w * L * L / 8; const sig = M / s.Z; const d = Pm * L ** 3 / (48 * ASSUME.E * s.I) + 5 * w * L ** 4 / (384 * ASSUME.E * s.I); items.push({ part: m, kind: 'bend', label: `${m.name || m.spec} 曲げ`, value: Math.round(sig * 10) / 10, unit: 'N/mm²', limit: ASSUME.sigmaA, ratio: sig / ASSUME.sigmaA, detail: `M = PL/4 + wL²/8 = ${Math.round(M / 1000)} N·m, Z = ${Math.round(s.Z)} mm³（P = ${Math.round(Pm)} N, L = ${L} mm）` }); items.push({ part: m, kind: 'defl', label: `${m.name || m.spec} たわみ`, value: Math.round(d * 100) / 100, unit: 'mm', limit: Math.round(L / ASSUME.deflLimit * 100) / 100, ratio: d / (L / ASSUME.deflLimit), detail: `δ = PL³/48EI + 5wL⁴/384EI, I = ${Math.round(s.I)} mm⁴, 制限 L/300` }); }
    else { const n = Math.max(1, vert.length); const Pv = P / n + w * L; const lam = L / Math.max(1, s.i); const red = lam <= 120 ? 1 - 0.4 * (lam / 120) ** 2 : 0.277 * (120 / lam) ** 2; const sa = ASSUME.sigmaA * red; const sig = Pv / s.A; items.push({ part: m, kind: 'axial', label: `${m.name || m.spec} 圧縮`, value: Math.round(sig * 10) / 10, unit: 'N/mm²', limit: Math.round(sa), ratio: sig / sa, detail: `P/A = ${Math.round(Pv)}/${Math.round(s.A)}、λ = ${Math.round(lam)}（低減 ${Math.round(red * 100)}%）` }); } }
  const bolts = parts.filter(p => p.kind === 'bolt' && !p.ref); if (bolts.length && P > 0) { const byM = {}; for (const b of bolts) (byM[b.M || 'M12'] ||= []).push(b); for (const [M, arr] of Object.entries(byM)) { const d = parseInt(M.slice(1), 10) || 12; const As = Math.PI / 4 * (d * 0.86) ** 2; const tau = P / arr.length / As; items.push({ part: arr[0], kind: 'bolt', label: `${M} ボルト ×${arr.length} せん断`, value: Math.round(tau * 10) / 10, unit: 'N/mm²', limit: ASSUME.boltTauA, ratio: tau / ASSUME.boltTauA, detail: `τ = P/(n·As)、As = ${Math.round(As)} mm²` }); } }
  const anchors = parts.filter(p => p.kind === 'anchor'); if (anchors.length && P > 0) { const M = anchors[0].M || 'M12'; const allow = (ASSUME.anchorPull[M] || 6) * 1000; const per = P / anchors.length; items.push({ part: anchors[0], kind: 'anchor', label: `${M} アンカー ×${anchors.length} 引抜`, value: Math.round(per / 100) / 10, unit: 'kN', limit: allow / 1000, ratio: per / allow, detail: `P/n（転倒による引抜は省略）` }); }
  const welds = parts.filter(p => p.kind === 'weld'); if (welds.length && P > 0) { const a = welds.reduce((s, w) => s + 0.7 * (w.size || 6) * (w.length || 0), 0); if (a > 0) { const tau = P / a; items.push({ part: welds[0], kind: 'weld', label: `溶接 ×${welds.length} せん断`, value: Math.round(tau * 10) / 10, unit: 'N/mm²', limit: ASSUME.tauWeldA, ratio: tau / ASSUME.tauWeldA, detail: `τ = P/Σ(0.7s·ℓ) = ${Math.round(P)}/${Math.round(a)}` }); } }
  const worst = items.slice().sort((x, y) => y.ratio - x.ratio)[0] || null; return { inst, P, loads, items, worst };
}
export function analyzeModel(app, k = 1) {
  const res = app.model.instances.map(i => { try { return analyzeInstance(app, i, k); } catch (e) { return { inst: i, P: 0, loads: [], items: [], worst: null, error: e.message }; } });
  const items = res.flatMap(r => r.items.map(it => ({ ...it, inst: r.inst }))); const worst = items.slice().sort((x, y) => y.ratio - x.ratio)[0] || null; const P = res.reduce((a, r) => a + r.P, 0);
  return { k, P, items, worst, perInst: res };
}
// 限界探索: 荷重倍率 k を増やし、最初に照査比 ≥ 1 になる項目と倍率
export function findLimit(app, { max = 12 } = {}) { const base = analyzeModel(app, 1); const cand = base.items.filter(it => it.ratio > 0).map(it => ({ it, k: 1 / it.ratio })).sort((a, b) => a.k - b.k)[0]; if (!cand) return null; return { k: Math.round(cand.k * 10) / 10, item: cand.it, over: cand.k <= 1, capped: cand.k > max }; }
