// 冷却機構（段差つきベースプレート＋フィン＋ファン、裏面のバックプレート）と部品の干渉チェック
// ・ベースプレート下面より背の高い部品は、切り欠きがなければ干渉する
// ・下面の高さは「全体」「メモリの上」「VRM の上」で別々に決められる（段差つき）
// ・メモリと DrMOS は、下面との隙間をサーマルパッドで埋められるか（3mm 以下）を見る
// ・裏面はバックプレートとの干渉と、PCIe CEM 規格の裏面高さ制限との比較
import { compBox, boxOverlap } from './core.js';
import { heightOf } from './view3d.js';

export const BASE_T = 3, PLATE_T = 1.5;
// PCI Express CEM：1 スロットで許される部品面の高さ、裏面の高さ、スロット間隔 (mm)
// 2 スロット 34.80 / 3 スロット 55.12 / 裏面 2.67 / 間隔 20.32 は CEM 4.0 の本文・図で確認。1 スロット 14.47 は図面のみで未確認
export const CEM = { primary: [14.47, 34.80, 55.12], secondary: 2.67, pitch: 20.32 };
export const slotsFor = h => { const i = CEM.primary.findIndex(v => h <= v); return i >= 0 ? i + 1 : 3 + Math.ceil((h - CEM.primary[2]) / CEM.pitch); };

function zonesOf(b) {
  const mem = b.comps.filter(c => c.part.family === 'vram' && c.side === 'T').map(c => compBox(c, 2.5)), vrm = [];
  for (const g of b.groups) {
    const cs = b.comps.filter(c => c.group === g.id && c.side === 'T' && !c.part.th);
    if (!cs.some(c => c.part.family === 'drmos')) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of cs) { const B = compBox(c, 1.5); x0 = Math.min(x0, B.x0); y0 = Math.min(y0, B.y0); x1 = Math.max(x1, B.x1); y1 = Math.max(y1, B.y1); }
    vrm.push({ x0, y0, x1, y1 });
  }
  const inAny = (L, x, y) => L.some(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  return (x, y) => (inAny(mem, x, y) ? 'mem' : inAny(vrm, x, y) ? 'vrm' : 'base');
}
const topOf = (b, fam) => Math.max(0, ...b.comps.filter(c => c.part.family === fam && c.side === 'T').map(c => heightOf(c.part)));
// 段差のおすすめ：メモリ・DrMOS の上に 1mm 前後のサーマルパッドが入る高さ
export function recommend(b) {
  const gpu = b.comps.find(c => c.part.family === 'gpu');
  return { base: gpu ? +(heightOf(gpu.part) + 0.8).toFixed(1) : 3.2, mem: +(topOf(b, 'vram') + 1).toFixed(1), vrm: +(topOf(b, 'drmos') + 1.5).toFixed(1) };
}

export function coolerCheck(b, cfg) {
  const gpu = b.comps.find(c => c.part.family === 'gpu'); if (!gpu) return null;
  let x0 = 1;
  for (const c of b.comps) if (c.fixed && c !== gpu) { const B = compBox(c); if (B.x0 < 8 && B.y1 - B.y0 > 6) x0 = Math.max(x0, B.x1 + 1); }
  const rect = { x0, y0: 1, x1: b.w - 1, y1: b.h - 1 };
  const gpuTop = heightOf(gpu.part) + 0.8, base = Math.max(cfg.base, gpuTop);
  const und = { base, mem: cfg.step ? cfg.mem : base, vrm: cfg.step ? cfg.vrm : base }, zoneOf = zonesOf(b);
  const hits = [], cuts = [], pads = [], unknown = new Set();
  for (const c of b.comps) {
    if ((c.side !== 'T' && !c.part.th) || c === gpu || c.part.family === 'hole' || c.part.family === 'pcie') continue;
    const B = compBox(c); if (!boxOverlap(B, rect)) continue;
    const h = heightOf(c.part), f = c.part.family, z = und[zoneOf(c.x, c.y)];
    if (!c.part.htOk) unknown.add(c.part);
    if (h > z - 0.3) {
      if (c.part.th || cfg.cut) cuts.push({ ...compBox(c, 0.7), c, access: !!c.part.th });   // コネクタは常に開口が必要
      else hits.push({ c, h, z });
    } else if (f === 'vram' || f === 'drmos') pads.push({ c, f, gap: z - h, ok: z - h <= 3 });
  }
  const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
  const cutPct = cuts.reduce((s, q) => s + (Math.min(q.x1, rect.x1) - Math.max(q.x0, rect.x0)) * (Math.min(q.y1, rect.y1) - Math.max(q.y0, rect.y0)), 0) / area * 100;
  const top = Math.max(und.base, und.mem, und.vrm) + BASE_T, front = top + cfg.fin + 15;
  // 裏面
  const bot = b.comps.filter(c => c.side === 'B' && !c.part.th), maxB = Math.max(0, ...bot.map(c => heightOf(c.part)));
  const hitsB = cfg.backOn ? bot.filter(c => heightOf(c.part) > cfg.back - 0.2).map(c => ({ c, h: heightOf(c.part) })) : [];
  const rear = cfg.backOn ? cfg.back + PLATE_T : maxB;
  const sum = f => { const L = pads.filter(p => p.f === f); return L.length ? { n: L.length, min: Math.min(...L.map(p => p.gap)), max: Math.max(...L.map(p => p.gap)), bad: L.filter(p => !p.ok).length } : null; };
  return {
    rect, und, top, gpuTop, gpu, zoneOf, hits, cuts, pads, cutPct, unknown: unknown.size, fin: cfg.fin, fans: cfg.fans,
    front, rear, maxB, hitsB, backOn: cfg.backOn, back: cfg.back, thickness: front + 1.6 + rear,
    slots: slotsFor(front), vram: sum('vram'), drmos: sum('drmos'),
  };
}
