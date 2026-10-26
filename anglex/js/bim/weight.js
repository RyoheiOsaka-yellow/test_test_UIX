// 重量・表面積・めっき付着量・溶接金属量の計算（JIS 単位質量優先、穴控除、めっき質量加算）
import { parseSpec, sectionProps, decompose, assignHoles, holeArea, holePerimeter } from '../geo/profiles.js';
import { boltMass } from '../geo/fasteners.js';
import { GALV, DENSITY, UBOLTS, BOLTS } from '../data/sections.js';

export const KG = v => Math.round(v * 1000) / 1000;

// 部材（形鋼・板・管）: 生材質量、穴控除、表面積、めっき質量
export function memberWeight({ spec, length, holes = [], finish = 'HDZ', material = 'SS400' }) {
  const p = typeof spec === 'string' ? parseSpec(spec) : spec; if (!p) return null;
  const sp = sectionProps(p); const L = length || (p.kind === 'PL' ? (p.h || 0) : 0);
  const rho = DENSITY[material] || DENSITY.SS400;
  let gross = sp.w * (L / 1000) * (material === 'SUS304' ? DENSITY.SUS304 / DENSITY.SS400 : 1); // kg
  if (p.kind === 'PL') gross = p.t * (p.w || 0) * (p.h || L) / 1e6 * rho / 1000 * 1000 / 1000; // t*w*h [mm3] → cm3 /1000 → kg: mm3*1e-3 = cm3; cm3*rho = g; /1000 = kg
  if (p.kind === 'PL') gross = p.t * (p.w || 0) * (p.h || L) * rho / 1e6;
  // 表面積（mm2）: 板構成から 2×面積 + 周長×厚（端面）、管は内外周×L
  let area = 0, holeVol = 0, holeCount = 0, slotCount = 0;
  if (p.kind === 'PIPE' || p.kind === 'RB') {
    area = p.kind === 'RB' ? Math.PI * p.d * L + 2 * Math.PI * p.d * p.d / 4 : Math.PI * p.od * L + Math.PI * (p.od - 2 * p.t) * L + 2 * Math.PI * (p.od * p.od - Math.pow(p.od - 2 * p.t, 2)) / 4;
  } else {
    const plates = decompose(p, L); assignHoles(plates, holes);
    for (const pl of plates) {
      area += 2 * pl.w * pl.h + 2 * (pl.w + pl.h) * pl.t;
      for (const h of pl.holes) { const a = holeArea(h); holeVol += a * pl.t; area += -2 * a + holePerimeter(h) * pl.t; if (h.slot && h.slot.len > h.d) slotCount++; else holeCount++; }
    }
  }
  const holeDeduct = holeVol * rho / 1e6; // kg
  const net = Math.max(0, gross - holeDeduct);
  const gpm2 = GALV[finish] ?? (finish && finish.startsWith('HDZ') ? GALV.HDZ55 : 0);
  const zinc = area / 1e6 * gpm2 / 1000; // m2 × g/m2 → g → kg
  return { profile: p, props: sp, length: L, gross: KG(gross), holeDeduct: KG(holeDeduct), net: KG(net), areaM2: Math.round(area / 1e6 * 10000) / 10000, zinc: KG(zinc), total: KG(net + zinc), holeCount, slotCount, finish, source: sp.source };
}
// 溶接: 隅肉 脚長 s, 長さ L（mm）, 両側なら ×2。余盛り 10%
export function weldWeight({ type = 'fillet', size = 6, length = 0, sides = 1 }) {
  let vol; if (type === 'butt') vol = (size * size * Math.tan(Math.PI / 6) + (size * 1.6 + 2) * Math.max(1.2, size * 0.18) * 0.66) * length; else if (type === 'plug') vol = Math.PI * size * size / 4 * 6; else vol = size * size / 2 * 1.1 * length * sides;
  return { mass: KG(vol * DENSITY.SS400 / 1e6), length: length * (type === 'fillet' ? sides : 1), vol };
}
export function fastenerWeight(kind, M, L = 40, qty = 1) {
  const b = BOLTS[M] || BOLTS.M12;
  if (kind === 'ubolt') { const R = (L / 2); const rodLen = Math.PI * R + 2 * (R + 60); return { mass: KG(qty * (Math.PI * b.d * b.d / 4 * rodLen * 7.85e-6 + 2 * boltMass(M, 0, { washer: 1, nut: 1 }))) }; }
  if (kind === 'anchor') return { mass: KG(qty * boltMass(M, 90, { washer: 1, nut: 1, springWasher: 1 })) };
  if (kind === 'rod') return { mass: KG(qty * (Math.PI * b.d * b.d / 4 * L * 7.85e-6 * 0.94 + 2 * boltMass(M, 0, { washer: 0, nut: 1 }))) };
  if (kind === 'nut') return { mass: KG(qty * boltMass(M, 0, { washer: 0, nut: 1 })) };
  if (kind === 'washer') return { mass: KG(qty * boltMass(M, 0, { washer: 1, nut: 0 })) };
  return { mass: KG(qty * boltMass(M, L, { washer: 2, nut: 1 })) };
}
// 部品配列の集計（parts: {kind, spec, length, holes, finish, qty, M, L, weldType, size, sides}）
export function summarize(parts) {
  const out = { steelGross: 0, steelNet: 0, zinc: 0, fasteners: 0, welds: 0, total: 0, areaM2: 0, weldLength: 0, holeCount: 0, slotCount: 0, items: [] };
  for (const pt of parts) {
    const q = pt.qty || 1; let row = { ...pt, qty: q };
    if (pt.kind === 'member' || pt.kind === 'plate' || pt.kind === 'pipe') { const w = memberWeight(pt); if (!w) continue; row.each = w.total; row.mass = KG(w.total * q); out.steelGross += w.gross * q; out.steelNet += w.net * q; out.zinc += w.zinc * q; out.areaM2 += w.areaM2 * q; out.holeCount += w.holeCount * q; out.slotCount += w.slotCount * q; row.detail = w; }
    else if (pt.kind === 'weld') { const w = weldWeight({ type: pt.weldType || 'fillet', size: pt.size, length: pt.length, sides: pt.sides || 1 }); row.each = w.mass; row.mass = KG(w.mass * q); out.welds += w.mass * q; out.weldLength += w.length * q; }
    else if (['bolt', 'ubolt', 'anchor', 'rod', 'nut', 'washer'].includes(pt.kind)) { const w = fastenerWeight(pt.kind, pt.M || 'M12', pt.L || pt.od || 40, 1); row.each = w.mass; row.mass = KG(w.mass * q); out.fasteners += w.mass * q; }
    else if (pt.mass != null) { row.each = pt.mass; row.mass = KG(pt.mass * q); if (pt.kind === 'custom' && pt.custom !== 'can') { const z = (pt.areaM2 || 0) * ((GALV[pt.finish] ?? (pt.finish && pt.finish.startsWith('HDZ') ? GALV.HDZ55 : 0)) / 1000); out.steelGross += pt.mass * q; out.steelNet += pt.mass * q; out.zinc += z * q; out.areaM2 += (pt.areaM2 || 0) * q; row.mass = KG((pt.mass + z) * q); row.each = KG(pt.mass + z); } else out.fasteners += pt.mass * q; }
    out.items.push(row);
  }
  out.total = KG(out.steelNet + out.zinc + out.fasteners + out.welds); for (const k of ['steelGross', 'steelNet', 'zinc', 'fasteners', 'welds']) out[k] = KG(out[k]); out.areaM2 = Math.round(out.areaM2 * 1000) / 1000;
  return out;
}
