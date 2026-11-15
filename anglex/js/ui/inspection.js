// 検査記録シート: 加工指示と一緒に工場へ渡す、記入用の書式。設計値をあらかじめ印字し、実測・判定・証明書番号の欄を空けておく。
//   1) 寸法検査  2) 穴検査  3) 溶接検査  4) 表面処理  5) 材料証明（ミルシート）台帳
// 許容差は社内の目安値。契約の基準が別にある場合は、その値に書き換えて使う。
import { toast, download } from './common.js';
import { downloadPdf, loadXLSX } from './pdfgen.js';
import { memberWeight } from '../bim/weight.js';
import { parseSpec, cutsLabel } from '../geo/profiles.js';
import { partContexts } from '../bim/partinfo.js';
import { GALV } from '../data/sections.js';

export const TOL = { length: '±2', holePos: '±1', holeDia: '+0.5 / 0', weldLeg: '0 〜 +2' };
const r1 = v => Math.round(v * 10) / 10; const BL = '';
const safe = s => String(s).replace(/[\\/:*?"<>|]/g, '_');

export function inspectionData(app) { const dim = [], holes = [], welds = [], finish = [], mill = new Map();
  for (const inst of app.model.instances) { let parts = []; try { parts = app.instanceParts(inst); } catch { continue; } const ctx = partContexts(app, inst, parts); const fin = new Map();
    parts.forEach((pt, i) => { const c = ctx[i]; if (!c) return; const sp = parseSpec(pt.spec); const L = sp?.kind === 'PL' ? (sp.h || pt.length || 0) : (pt.length || 0); let w = null; try { w = memberWeight(pt); } catch { }
      dim.push([c.mark, `${c.asmName} ／ ${c.name}${c.roleJa && c.roleJa !== c.name ? '（' + c.roleJa + '）' : ''}`, pt.spec, r1(L), TOL.length, pt.cuts ? cutsLabel(pt.cuts) : '直角', BL, BL]);
      for (const h of pt.holes || []) holes.push([c.mark, h.face, r1(h.z), r1(h.s), h.slot ? `φ${h.d}×${h.slot.len}` : `φ${h.d}`, TOL.holePos, TOL.holeDia, BL, BL, BL, BL]);
      const fk = pt.finish || 'HDZ'; const f = fin.get(fk) || { area: 0, n: 0 }; f.area += w?.areaM2 || 0; f.n++; fin.set(fk, f);
      const mk = `${pt.spec}|${pt.material || 'SS400'}`; const m = mill.get(mk) || { spec: pt.spec, material: pt.material || 'SS400', n: 0, len: 0, kg: 0 }; m.n++; m.len += L; m.kg += w?.gross || 0; mill.set(mk, m); });
    const wg = new Map(); for (const w of parts) { if (w.kind !== 'weld') continue; const k = `${w.group || '溶接'}|${w.weldType || 'fillet'}|${w.size}|${w.site ? 1 : 0}`; const g = wg.get(k) || { group: w.group || '溶接', type: w.weldType === 'butt' ? '突合せ' : '隅肉', size: w.size, site: !!w.site, len: 0 }; g.len += w.length || 0; wg.set(k, g); }
    for (const g of wg.values()) welds.push([inst.mark, g.group, g.type, g.size, Math.round(g.len), g.site ? '現場' : '工場', TOL.weldLeg, BL, BL, BL]);
    for (const [fk, f] of fin) finish.push([inst.mark, fk, GALV[fk] ?? (String(fk).startsWith('HDZ') ? 550 : '—'), f.n, Math.round(f.area * 1000) / 1000, BL, BL, BL]); }
  return { dim, holes, welds, finish, mill: [...mill.values()].map(m => [m.spec, m.material, m.n, Math.round(m.len), Math.round(m.kg * 100) / 100, BL, BL]) }; }

const T = {
  dim: { heading: '1. 寸法検査', cols: [['符号', 12], ['所属・部品', 40], ['仕様', 20], ['設計長さ mm', 13, 'right'], ['許容差', 9], ['端部', 22], ['実測 mm', 13], ['判定', 8]] },
  holes: { heading: '2. 穴検査', cols: [['符号', 12], ['面', 8], ['位置 z', 10, 'right'], ['位置 s', 10, 'right'], ['径', 12], ['位置の許容差', 12], ['径の許容差', 12], ['実測 z', 10], ['実測 s', 10], ['実測 径', 10], ['判定', 8]] },
  welds: { heading: '3. 溶接検査', cols: [['符号', 10], ['箇所', 36], ['種類', 9], ['脚長 mm', 9, 'right'], ['長さ mm', 10, 'right'], ['区分', 8], ['脚長の許容差', 13], ['外観', 12], ['実測 脚長', 11], ['判定', 8]] },
  finish: { heading: '4. 表面処理', cols: [['符号', 12], ['仕上げ', 14], ['規格付着量 g/m²', 16, 'right'], ['部品数', 9, 'right'], ['表面積 m²', 12, 'right'], ['膜厚・付着量 実測', 20], ['証明書番号', 22], ['判定', 8]] },
  mill: { heading: '5. 材料証明（ミルシート）台帳', cols: [['仕様', 26], ['材質', 12], ['本数', 8, 'right'], ['総長さ mm', 13, 'right'], ['質量 kg', 12, 'right'], ['ミルシート番号', 30], ['確認', 9]] },
};
export async function exportInspectionPDF(app) { const d = inspectionData(app); if (!d.dim.length) { toast('検査の対象になる鋼材がありません', 'warn'); return null; } const t = toast('検査記録シートを作成中…', 'info', 20000);
  try { await downloadPdf(`${safe(app.project.name)}_検査記録シート.pdf`, { title: '検査記録シート', subtitle: app.project.name, landscape: true, meta: [['プロジェクト', app.project.name], ['作成', new Date().toLocaleDateString('ja-JP')], ['作成者', app.user().name + '（' + app.user().company + '）'], ['許容差', `長さ ${TOL.length} mm、穴位置 ${TOL.holePos} mm、穴径 ${TOL.holeDia} mm、脚長 ${TOL.weldLeg} mm（社内の目安値。契約の基準がある場合はその値に書き換える）`]],
      sections: [...Object.entries(T).map(([k, def]) => ({ heading: `${def.heading}（${d[k].length} 行）`, table: { cols: def.cols.map(([label, w, align]) => ({ label, w, align })), rows: d[k].length ? d[k] : [def.cols.map((_, i) => i === 0 ? '該当なし' : '')] } })), { heading: '記入欄', kv: [['検査日', '　　　　年　　月　　日'], ['検査者', '　　　　　　　　　　'], ['承認者', '　　　　　　　　　　'], ['特記事項', '　　　　　　　　　　']] }] });
    t.remove(); toast(`検査記録シート（寸法 ${d.dim.length}・穴 ${d.holes.length}・溶接 ${d.welds.length} 行）を書き出しました`, 'ok'); return d; } catch (e) { t.remove(); console.error(e); toast('検査記録シートの作成に失敗: ' + e.message, 'bad', 7000); return null; } }
export async function exportInspectionXLSX(app) { const d = inspectionData(app); if (!d.dim.length) { toast('検査の対象になる鋼材がありません', 'warn'); return null; } const XLSX = await loadXLSX(); const wb = XLSX.utils.book_new();
  for (const [k, def] of Object.entries(T)) { const ws = XLSX.utils.aoa_to_sheet([[def.heading], def.cols.map(c => c[0]), ...d[k]]); ws['!cols'] = def.cols.map(c => ({ wch: Math.round(c[1] * 1.1) })); XLSX.utils.book_append_sheet(wb, ws, def.heading.replace(/^\d+\.\s*/, '').replace(/[（）()]/g, '').slice(0, 28)); }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); download(`${safe(app.project.name)}_検査記録シート.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); toast('検査記録シート（Excel、5 シート）を書き出しました', 'ok'); return d; }
