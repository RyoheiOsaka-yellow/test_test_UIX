// 冷却機構（ベースプレート＋フィン＋ファン）と部品の干渉チェック
// ベースプレート下面の高さより背の高い部品は、切り欠きがなければ干渉する。
// メモリと DrMOS は、下面との隙間をサーマルパッドで埋められるか（3mm 以下）を見る。
import { compBox, boxOverlap } from './core.js';
import { heightOf } from './view3d.js';

export const BASE_T = 3;          // ベースプレートの厚み (mm)
export function coolerCheck(b, cfg) {
  const gpu = b.comps.find(c => c.part.family === 'gpu'); if (!gpu) return null;
  let x0 = 1;
  for (const c of b.comps) if (c.fixed && c !== gpu) { const B = compBox(c); if (B.x0 < 8 && B.y1 - B.y0 > 6) x0 = Math.max(x0, B.x1 + 1); }
  const rect = { x0, y0: 1, x1: b.w - 1, y1: b.h - 1 };
  const gpuTop = heightOf(gpu.part) + 0.8, baseZ = Math.max(cfg.base, gpuTop);
  const hits = [], cuts = [], pads = [];
  for (const c of b.comps) {
    if ((c.side !== 'T' && !c.part.th) || c === gpu || c.part.family === 'hole' || c.part.family === 'pcie') continue;
    const B = compBox(c); if (!boxOverlap(B, rect)) continue;
    const h = heightOf(c.part), f = c.part.family;
    if (h > baseZ - 0.3) {
      if (c.part.th || cfg.cut) cuts.push({ ...compBox(c, 0.7), c, access: !!c.part.th });   // コネクタは常に開口が必要
      else hits.push({ c, h });
    } else if (f === 'vram' || f === 'drmos') pads.push({ c, f, gap: baseZ - h, ok: baseZ - h <= 3 });
  }
  const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
  const cutPct = cuts.reduce((s, q) => s + (Math.min(q.x1, rect.x1) - Math.max(q.x0, rect.x0)) * (Math.min(q.y1, rect.y1) - Math.max(q.y0, rect.y0)), 0) / area * 100;
  const thickness = 1.6 + baseZ + BASE_T + cfg.fin + 15;
  const sum = f => { const L = pads.filter(p => p.f === f); return L.length ? { n: L.length, min: Math.min(...L.map(p => p.gap)), max: Math.max(...L.map(p => p.gap)), bad: L.filter(p => !p.ok).length } : null; };
  return { rect, baseZ, gpuTop, gpu, hits, cuts, pads, cutPct, thickness, slots: Math.ceil(thickness / 20.32), fin: cfg.fin, fans: cfg.fans, vram: sum('vram'), drmos: sum('drmos') };
}
