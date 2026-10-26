// 原価・見積エンジン: 材料費（kg単価）+ 加工費（切断・穴・溶接・曲げ・組立）+ 表面処理（めっき kg単価 / 塗装 m2）+ 副資材 + 管理費・利益
import { summarize } from './weight.js';
import { parseSpec } from '../geo/profiles.js';

export const DEFAULT_RATES = {
  version: 1, currency: 'JPY',
  steel: { SS400: 145, SUS304: 680, SGP: 185, STK400: 170, PVC: 95, ZAM: 190 },           // ¥/kg（材料）
  scrapFactor: 1.08,                                                                       // 歩留まり（端材）
  cut: { small: 180, medium: 320, large: 520 },                                           // ¥/カット（断面高さ ≤50 / ≤100 / それ以上）
  hole: { d13: 120, d20: 180, d30: 260, slot: 300 },                                      // ¥/穴
  weldPer100mm: { 3: 180, 4: 210, 6: 300, 8: 380, 10: 460, butt: 520 },                   // ¥/100mm
  bend: 260,                                                                              // ¥/曲げ
  assemblyPerPart: 160,                                                                   // ¥/部品（組立・仮付け）
  galvPerKg: 98, galvMin: 3500,                                                           // 溶融亜鉛めっき ¥/kg・最低料金
  ezPerKg: 60, ezMin: 2500,                                                               // 電気亜鉛めっき
  paintPerM2: 1300,                                                                       // サビ止め塗装 ¥/m2
  fasteners: { bolt: { M6: 25, M8: 35, M10: 48, M12: 65, M16: 120, M20: 190, M24: 300, 'W3/8': 48, 'W1/2': 65, 'W5/8': 120, 'W3/4': 190 }, ubolt: { 'W3/8': 180, 'W1/2': 260, 'W5/8': 420, 'W3/4': 650 }, anchor: { M10: 180, M12: 240, M16: 380 }, rodPerM: { 'W3/8': 160, 'W1/2': 260, M10: 160, M12: 260 }, nut: 18, washer: 8 },
  pipePerM: { SGP: 900 },
  overheadPct: 12, profitPct: 10,                                                         // 工場 一般管理費・利益（C社原価に乗せる）
  minOrder: 5000,
};
const r1 = v => Math.round(v);
function cutClass(spec) { const p = parseSpec(spec); if (!p) return 'small'; const h = p.kind === 'L' ? Math.max(p.A, p.B) : p.kind === 'C' || p.kind === 'H' || p.kind === 'LC' ? p.H : p.kind === 'SQ' ? Math.max(p.A, p.B) : p.kind === 'PIPE' ? p.od : p.kind === 'FB' ? p.w : p.kind === 'PL' ? Math.max(p.w || 0, p.h || 0) : 50; return h <= 50 ? 'small' : h <= 100 ? 'medium' : 'large'; }
function holeRate(h, R) { if (h.slot && h.slot.len > h.d) return R.hole.slot; return h.d <= 13 ? R.hole.d13 : h.d <= 20 ? R.hole.d20 : R.hole.d30; }
function weldRate(size, type, R) { if (type === 'butt') return R.weldPer100mm.butt; const keys = Object.keys(R.weldPer100mm).filter(k => !isNaN(+k)).map(Number).sort((a, b) => a - b); let k = keys[keys.length - 1]; for (const s of keys) if (size <= s) { k = s; break; } return R.weldPer100mm[k]; }

// parts → 原価内訳
export function costParts(parts, R = DEFAULT_RATES) {
  const sum = summarize(parts.filter(p => !p.ref));
  const c = { material: 0, cut: 0, hole: 0, weld: 0, bend: 0, assembly: 0, finish: 0, fasteners: 0, pipe: 0, lines: [], weight: sum };
  let galvKg = 0, ezKg = 0, paintM2 = 0; let steelParts = 0;
  for (const it of sum.items) {
    const q = it.qty || 1;
    if (it.kind === 'member' || it.kind === 'plate' || it.kind === 'pipe') {
      if (it.ref) continue; const w = it.detail; const matKey = it.material === 'SUS304' ? 'SUS304' : it.spec?.startsWith('SGP') || it.spec?.startsWith('PIPE') ? 'SGP' : it.spec?.startsWith('VP') ? 'PVC' : 'SS400';
      const mat = w.net * (R.steel[matKey] || R.steel.SS400) * R.scrapFactor * q; c.material += mat;
      const cuts = (it.kind === 'plate' ? 4 : 2) * q; const cutC = cuts * R.cut[cutClass(it.spec)]; c.cut += cutC;
      let holeC = 0; for (const h of it.holes || []) holeC += holeRate(h, R) * q; c.hole += holeC;
      const bends = (it.pattern === 'drainpan' ? 4 : 0) * q; c.bend += bends * R.bend;
      if (it.finish && it.finish.startsWith('HDZ')) galvKg += w.net * q; else if (it.finish === 'EZ') ezKg += w.net * q; else if (it.finish === 'PAINT') paintM2 += w.areaM2 * q;
      steelParts += q; c.lines.push({ name: it.name, kind: it.kind, qty: q, mass: it.mass, material: r1(mat), cut: cutC, hole: holeC, finish: it.finish });
    } else if (it.kind === 'weld') { const len = (it.length || 0) * (it.sides || 1) * q; const wc = len / 100 * weldRate(it.size, it.weldType, R); c.weld += wc; }
    else if (it.kind === 'bolt') { c.fasteners += (R.fasteners.bolt[it.M] || 60) * q; }
    else if (it.kind === 'ubolt') { c.fasteners += (R.fasteners.ubolt[it.M] || 300) * q; }
    else if (it.kind === 'anchor') { c.fasteners += (R.fasteners.anchor[it.M] || 240) * q; }
    else if (it.kind === 'rod') { c.fasteners += (R.fasteners.rodPerM[it.M] || 200) * (it.L || 1000) / 1000 * q + 2 * R.fasteners.nut * q; }
    else if (it.kind === 'nut') c.fasteners += R.fasteners.nut * q; else if (it.kind === 'washer') c.fasteners += R.fasteners.washer * q;
    else if (it.kind === 'custom') { if (it.mass) { c.material += it.mass * R.steel.SS400 * R.scrapFactor * q; if (it.finish && it.finish.startsWith('HDZ')) galvKg += it.mass * q; steelParts += q; c.cut += R.cut.small * q; c.lines.push({ name: it.name, kind: 'custom', qty: q, mass: it.mass * q, material: r1(it.mass * R.steel.SS400 * q) }); } }
  }
  if (galvKg > 0) c.finish += Math.max(R.galvMin, galvKg * R.galvPerKg); if (ezKg > 0) c.finish += Math.max(R.ezMin, ezKg * R.ezPerKg); if (paintM2 > 0) c.finish += paintM2 * R.paintPerM2;
  c.assembly = steelParts * R.assemblyPerPart;
  c.direct = c.material + c.cut + c.hole + c.weld + c.bend + c.assembly + c.finish + c.fasteners;
  c.overhead = c.direct * R.overheadPct / 100; c.profit = (c.direct + c.overhead) * R.profitPct / 100;
  c.factoryPrice = r1(c.direct + c.overhead + c.profit);
  for (const k of ['material', 'cut', 'hole', 'weld', 'bend', 'assembly', 'finish', 'fasteners', 'direct', 'overhead', 'profit']) c[k] = r1(c[k]);
  c.galvKg = Math.round(galvKg * 100) / 100; c.paintM2 = Math.round(paintM2 * 1000) / 1000;
  return c;
}
// モデル全体 → 見積明細（インスタンス単位）。同一タイプ・同一パラメータは数量まとめ
export function estimateModel(model, R = DEFAULT_RATES) {
  const lines = []; const groups = new Map();
  for (const inst of model.instances) { const t = model.getType(inst.typeId); const fam = model.familyOf(inst); const p = model.resolved(inst); const key = t.id + JSON.stringify(p); if (!groups.has(key)) groups.set(key, { typeId: t.id, typeName: t.name, family: fam.name, familyId: fam.id, params: p, marks: [], insts: [] }); const g = groups.get(key); g.marks.push(inst.mark); g.insts.push(inst.id); }
  // 接合（インスタンス間）
  const jointParts = model.joints.flatMap(j => j.parts || []);
  for (const g of groups.values()) { const fam = model.familyOf(model.getInstance(g.insts[0])); const parts = fam.parts(g.params, { model }); const c = costParts(parts, R); lines.push({ id: 'ln_' + g.typeId + '_' + g.marks[0], typeId: g.typeId, desc: g.typeName, family: g.family, familyId: g.familyId, marks: g.marks, qty: g.insts.length, unit: '台', spec: specSummary(fam, g.params), mass: c.weight.total, unitCost: c.factoryPrice, cost: c, amount: c.factoryPrice * g.insts.length }); }
  if (jointParts.length) { const c = costParts(jointParts, R); lines.push({ id: 'ln_joints', desc: '現場/工場 接合（溶接・ボルト）', family: '接合', marks: model.joints.map(j => j.label || j.type), qty: 1, unit: '式', spec: `${model.joints.length} 箇所`, mass: c.weight.total, unitCost: c.factoryPrice, cost: c, amount: c.factoryPrice }); }
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, subtotal: Math.max(subtotal, lines.length ? R.minOrder : 0), rates: R, totalMass: Math.round(lines.reduce((s, l) => s + l.mass * l.qty, 0) * 100) / 100 };
}
function specSummary(fam, p) { const keys = ['spec', 'colSpec', 'beamSpec', 'W', 'H', 'L', 'A', 'D', 'pipes', 'finish']; return keys.filter(k => p[k] !== undefined && p[k] !== '').map(k => `${k}=${p[k]}`).join(' '); }
export const yen = n => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
