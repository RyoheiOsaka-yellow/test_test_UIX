// 検査記録シート: 加工指示と一緒に工場へ渡す、記入用の書式。設計値をあらかじめ印字し、実測・判定・証明書番号の欄を空けておく。
//   1) 寸法検査  2) 穴検査  3) 溶接検査  4) 表面処理  5) 材料証明（ミルシート）台帳
// 許容差は社内の目安値。契約の基準が別にある場合は、その値に書き換えて使う。
import { h, modal, table, toast, download, promptDialog } from './common.js';
import { downloadPdf, loadXLSX } from './pdfgen.js';
import { memberWeight } from '../bim/weight.js';
import { parseSpec, cutsLabel } from '../geo/profiles.js';
import { partContexts } from '../bim/partinfo.js';
import { GALV } from '../data/sections.js';
import * as THREE from 'three';
import { addPin } from './pins.js';

// 許容差（案件ごとに設定できる。project.tolerances）。既定は社内の目安値
export const TOL_DEFAULT = { length: 2, holePos: 1, holeDiaPlus: 0.5, holeDiaMinus: 0, weldLegPlus: 2, weldLegMinus: 0 };
export function tolerances(app) { return { ...TOL_DEFAULT, ...(app?.project?.tolerances || {}) }; }
const tolText = t => ({ length: `±${t.length}`, holePos: `±${t.holePos}`, holeDia: `+${t.holeDiaPlus} / ${t.holeDiaMinus ? '-' + t.holeDiaMinus : '0'}`, weldLeg: `${t.weldLegMinus ? '-' + t.weldLegMinus : '0'} 〜 +${t.weldLegPlus}` });
export const TOL = tolText(TOL_DEFAULT);
export async function tolerancesDialog(app) { const t = tolerances(app); const r = await promptDialog('検査の許容差（この案件）', [{ key: 'length', label: '長さ ± mm', type: 'number', value: t.length }, { key: 'holePos', label: '穴位置 ± mm', type: 'number', value: t.holePos }, { key: 'holeDiaPlus', label: '穴径 ＋側 mm', type: 'number', value: t.holeDiaPlus }, { key: 'holeDiaMinus', label: '穴径 −側 mm', type: 'number', value: t.holeDiaMinus }, { key: 'weldLegPlus', label: '溶接脚長 ＋側 mm', type: 'number', value: t.weldLegPlus }, { key: 'weldLegMinus', label: '溶接脚長 −側 mm', type: 'number', value: t.weldLegMinus }]); if (!r) return null; const out = {}; for (const k of Object.keys(TOL_DEFAULT)) { const v = Math.abs(+r[k]); out[k] = isFinite(v) ? v : TOL_DEFAULT[k]; } app.project.tolerances = out; app.scheduleAutosave?.(); toast('検査の許容差を保存しました。検査記録シートと合否の判定に使います', 'ok'); return out; }
const r1 = v => Math.round(v * 10) / 10; const BL = '';
const safe = s => String(s).replace(/[\\/:*?"<>|]/g, '_');

export function inspectionData(app) { const TOL = tolText(tolerances(app)); const dim = [], holes = [], welds = [], finish = [], mill = new Map();
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
  try { await downloadPdf(`${safe(app.project.name)}_検査記録シート.pdf`, { title: '検査記録シート', subtitle: app.project.name, landscape: true, meta: [['プロジェクト', app.project.name], ['作成', new Date().toLocaleDateString('ja-JP')], ['作成者', app.user().name + '（' + app.user().company + '）'], ['許容差', (TT => `長さ ${TT.length} mm、穴位置 ${TT.holePos} mm、穴径 ${TT.holeDia} mm、脚長 ${TT.weldLeg} mm（${app.project.tolerances ? 'この案件の設定値' : '社内の目安値。「検査の許容差」で案件ごとに設定できます'}）`)(tolText(tolerances(app)))]],
      sections: [...Object.entries(T).map(([k, def]) => ({ heading: `${def.heading}（${d[k].length} 行）`, table: { cols: def.cols.map(([label, w, align]) => ({ label, w, align })), rows: d[k].length ? d[k] : [def.cols.map((_, i) => i === 0 ? '該当なし' : '')] } })), { heading: '記入欄', kv: [['検査日', '　　　　年　　月　　日'], ['検査者', '　　　　　　　　　　'], ['承認者', '　　　　　　　　　　'], ['特記事項', '　　　　　　　　　　']] }] });
    t.remove(); toast(`検査記録シート（寸法 ${d.dim.length}・穴 ${d.holes.length}・溶接 ${d.welds.length} 行）を書き出しました`, 'ok'); return d; } catch (e) { t.remove(); console.error(e); toast('検査記録シートの作成に失敗: ' + e.message, 'bad', 7000); return null; } }
export async function exportInspectionXLSX(app) { const d = inspectionData(app); if (!d.dim.length) { toast('検査の対象になる鋼材がありません', 'warn'); return null; } const XLSX = await loadXLSX(); const wb = XLSX.utils.book_new();
  for (const [k, def] of Object.entries(T)) { const ws = XLSX.utils.aoa_to_sheet([[def.heading], def.cols.map(c => c[0]), ...d[k]]); ws['!cols'] = def.cols.map(c => ({ wch: Math.round(c[1] * 1.1) })); XLSX.utils.book_append_sheet(wb, ws, def.heading.replace(/^\d+\.\s*/, '').replace(/[（）()]/g, '').slice(0, 28)); }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); download(`${safe(app.project.name)}_検査記録シート.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); toast('検査記録シート（Excel、5 シート）を書き出しました', 'ok'); return d; }

// ---- 読み戻し: 記入済みの検査記録シート（Excel）を取り込み、実測値を許容差と比べて合否を集計する。外れた項目だけを一覧にする
const SHEETS = { dim: '寸法検査', holes: '穴検査', welds: '溶接検査', finish: '表面処理', mill: '材料証明ミルシート台帳' };
export function isInspectionWorkbook(wb) { return !!wb?.SheetNames?.includes(SHEETS.dim); }
const numOf = v => { if (v == null || v === '') return null; const m = String(v).replace(/[，,]/g, '').match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
export function judgeInspection(app, wb, XLSX) { const t = tolerances(app); const rows = k => { const ws = wb.Sheets[SHEETS[k]]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).slice(2).filter(r => r.some(c => c !== '')) : []; }; const fails = []; const c = { ok: 0, ng: 0, blank: 0 }; const e = 1e-6;
  const put = (ok, f) => { if (ok) c.ok++; else { c.ng++; fails.push(f); } };
  for (const r of rows('dim')) { const d = numOf(r[3]), m = numOf(r[6]); if (m == null) { c.blank++; continue; } put(Math.abs(m - d) <= t.length + e, { sheet: '寸法', mark: r[0], item: `${r[2]} 長さ`, design: d, measured: m, diff: Math.round((m - d) * 100) / 100, tol: `±${t.length}` }); }
  for (const r of rows('holes')) { const z = numOf(r[2]), sv = numOf(r[3]), d = numOf(r[4]); const mz = numOf(r[7]), ms = numOf(r[8]), md = numOf(r[9]); if (mz == null && ms == null && md == null) { c.blank++; continue; }
    if (mz != null) put(Math.abs(mz - z) <= t.holePos + e, { sheet: '穴', mark: r[0], item: `${r[1]} 面 z${z} s${sv} の位置 z`, design: z, measured: mz, diff: Math.round((mz - z) * 100) / 100, tol: `±${t.holePos}` }); if (ms != null) put(Math.abs(ms - sv) <= t.holePos + e, { sheet: '穴', mark: r[0], item: `${r[1]} 面 z${z} s${sv} の位置 s`, design: sv, measured: ms, diff: Math.round((ms - sv) * 100) / 100, tol: `±${t.holePos}` }); if (md != null) put(md - d <= t.holeDiaPlus + e && d - md <= t.holeDiaMinus + e, { sheet: '穴', mark: r[0], item: `${r[1]} 面 z${z} s${sv} の径`, design: d, measured: md, diff: Math.round((md - d) * 100) / 100, tol: `+${t.holeDiaPlus} / -${t.holeDiaMinus}` }); }
  for (const r of rows('welds')) { const leg = numOf(r[3]), m = numOf(r[8]); const look = String(r[7] || ''); if (m == null && !look) { c.blank++; continue; } if (m != null) put(m - leg <= t.weldLegPlus + e && leg - m <= t.weldLegMinus + e, { sheet: '溶接', mark: r[0], item: `${r[1]} 脚長`, design: leg, measured: m, diff: Math.round((m - leg) * 100) / 100, tol: `-${t.weldLegMinus} 〜 +${t.weldLegPlus}` }); if (look) put(!/不|NG|×|否/i.test(look), { sheet: '溶接', mark: r[0], item: `${r[1]} 外観`, design: '良', measured: look, diff: '', tol: '外観' }); }
  for (const r of rows('finish')) { const sp = numOf(r[2]), m = numOf(r[5]); if (m == null) { c.blank++; continue; } if (sp != null) put(m + e >= sp, { sheet: '表面処理', mark: r[0], item: `${r[1]} 付着量`, design: sp, measured: m, diff: Math.round((m - sp) * 10) / 10, tol: '規格値以上' }); else c.ok++; }
  let millBlank = 0; for (const r of rows('mill')) if (!String(r[5] || '').trim()) millBlank++; c.blank += millBlank;
  return { counts: c, fails, millBlank, tolerances: t }; }
export async function importInspection(app, file) { const XLSX = await loadXLSX(); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); if (!isInspectionWorkbook(wb)) return null; const res = judgeInspection(app, wb, XLSX); app.project.inspection = { at: Date.now(), file: file.name, by: app.user().name, counts: res.counts, fails: res.fails }; app.scheduleAutosave?.(); showInspectionResult(app, res, file.name); return res; }
export function showInspectionResult(app, res, name = '') { const c = res.counts; let m = null; const body = h('div', {}, h('p', {}, h('b', {}, name), ' を読み取りました。 ', h('span', { class: 'chip ok' }, `合格 ${c.ok}`), ' ', h('span', { class: 'chip ' + (c.ng ? 'bad' : 'ghost') }, `不合格 ${c.ng}`), ' ', h('span', { class: 'chip ghost' }, `未記入 ${c.blank}`)), h('p', { class: 'muted small' }, `許容差: 長さ ±${res.tolerances.length}、穴位置 ±${res.tolerances.holePos}、穴径 +${res.tolerances.holeDiaPlus} / -${res.tolerances.holeDiaMinus}、脚長 -${res.tolerances.weldLegMinus} 〜 +${res.tolerances.weldLegPlus}（mm）`),
    res.fails.length ? table(['検査', '符号', '項目', '設計', '実測', '差', '許容差'], res.fails.map(f => [f.sheet, f.mark, f.item, f.design, f.measured, f.diff, f.tol]), { cls: 'small' }) : h('p', { class: 'chip ok', style: { display: 'inline-block' } }, '記入された項目は、すべて許容差の中です'));
  m = modal({ title: `検査記録の合否（不合格 ${c.ng} 件）`, wide: true, body, footer: [h('button', { class: 'btn', onClick: () => tolerancesDialog(app) }, '許容差を変える'), res.fails.length ? h('button', { class: 'btn', 'data-act': 'insp-pins', title: '不合格の項目を、その部材のピン（コメント）にする', onClick: async () => { const n = await failsToPins(app, res.fails); m.close(); toast(`不合格 ${n} 件をコメントのピンにしました`, 'ok'); } }, '不合格をピンにする') : null, h('button', { class: 'btn primary', onClick: () => m.close() }, '閉じる')].filter(Boolean) }); return m; }
// 不合格の項目を、その部品の位置のピンにする（符号 MF-1-3 → 架台 MF-1 の 3 番目の鋼材）
export async function failsToPins(app, fails) { let n = 0; const by = new Map(); for (const f of fails) { const k = String(f.mark); (by.get(k) || by.set(k, []).get(k)).push(f); }
  for (const [mark, list] of by) { const whole = app.model.instances.find(i => i.mark === mark); /* 溶接・表面処理は架台の符号（MF-1）、寸法・穴は部品番号つき（MF-1-3） */ const mm = whole ? null : mark.match(/^(.*)-(\d+)$/); const inst = whole || app.model.instances.find(i => i.mark === (mm ? mm[1] : mark)); if (!inst) continue; let pos = null, part = ''; try { const ctx = partContexts(app, inst).filter(Boolean); const c = mm ? ctx.find(x => x.no === +mm[2]) : null; if (c) { pos = c.pos; part = c.name; } } catch { } if (!pos) { const g = app.groups.get(inst.id); if (!g) continue; pos = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).toArray(); }
    const pin = addPin(app, { text: `検査 不合格（${mark}）\n` + list.map(f => `・${f.sheet} ${f.item}: 設計 ${f.design} / 実測 ${f.measured}（差 ${f.diff}、許容差 ${f.tol}）`).join('\n'), pos, instId: inst.id, part }); if (pin) n++; } return n; }
