// 強度計算の画面: 支持金具ごとの判定の一覧 → 選ぶと部材・接合・荷重の内訳と式。条件の変更、3D への表示、計算書（PDF・Excel）。
// 計算そのものは js/bim/strength.js。ここは見せ方だけ。
import * as THREE from 'three';
import { h, modal, toast, tabs, fmt } from './common.js';
import { analyzeParts, settingsOf, khOf, assumptionsText, DEFAULTS, KS_TABLE } from '../bim/strength.js';
import { downloadPdf, loadXLSX } from './pdfgen.js';

const CSS = `
.st-sum{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}.st-card{flex:1 1 150px;border:1px solid var(--line-soft,#e5e2d8);border-radius:10px;padding:10px 12px;background:#fff}
.st-card .k{font-size:11px;color:#6b6b63}.st-card .v{font-size:22px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}.st-card .s{font-size:11px;color:#6b6b63}
.st-ok{color:#1f7a45}.st-warn{color:#a66a00}.st-ng{color:#b3261e}
.st-badge{display:inline-block;min-width:34px;text-align:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;color:#fff}.st-badge.ok{background:#1f7a45}.st-badge.warn{background:#c98a00}.st-badge.ng{background:#b3261e}
.st-bar{position:relative;height:8px;border-radius:4px;background:#ecebe4;min-width:90px;overflow:hidden}.st-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}.st-bar.ok i{background:#1f7a45}.st-bar.warn i{background:#c98a00}.st-bar.ng i{background:#b3261e}
.st-ratio{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;font-variant-numeric:tabular-nums}
table.grid.st-list tbody tr{cursor:pointer}table.grid.st-list tbody tr.on{background:#f3ecdf}table.grid.st-list td,table.grid.st-chk td{vertical-align:middle}
.st-detail{margin-top:12px;border-top:1px solid var(--line-soft,#e5e2d8);padding-top:10px}.st-detail h4{margin:0 0 6px;font-size:14px}
.st-note{font-size:11.5px;color:#6b6b63;line-height:1.6}.st-note li{margin:2px 0}.st-warnbox{background:#fff7e0;border:1px solid #ecd58a;border-radius:8px;padding:6px 10px;font-size:12px;margin:6px 0}
.st-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}.st-form label{display:flex;flex-direction:column;gap:3px;font-size:12px}.st-form label span{color:#55554d}.st-form h5{grid-column:1/-1;margin:8px 0 0;font-size:12.5px;border-bottom:1px solid var(--line-soft,#e5e2d8);padding-bottom:3px}
.st-form input,.st-form select{height:30px;border:1px solid #cfcabd;border-radius:6px;padding:0 8px;font:inherit;background:#fff}.st-form .hint{grid-column:1/-1;font-size:11px;color:#6b6b63}
.st-det{font-size:11px;color:#6b6b63}
.v-label.st-lbl{font:700 11px/1 system-ui,sans-serif;padding:4px 8px;border-radius:999px;border:0;color:#fff;cursor:pointer;pointer-events:auto;box-shadow:0 2px 6px rgba(0,0,0,.25);white-space:nowrap}.v-label.st-lbl.ok{background:#1f7a45}.v-label.st-lbl.warn{background:#c98a00}.v-label.st-lbl.ng{background:#b3261e}
@media (max-width:700px){.st-form{grid-template-columns:1fr}}`;
let cssDone = false; const css = () => { if (cssDone) return; cssDone = true; document.head.append(h('style', {}, CSS)); };
const lvl = r => r > 1 ? 'ng' : r >= 0.8 ? 'warn' : 'ok'; const verdict = r => r > 1 ? 'NG' : 'OK';
const rr = r => (Math.round(r * 100) / 100).toFixed(2);
const bar = r => h('div', { class: 'st-ratio' }, h('b', { class: 'st-' + lvl(r) }, r >= 99 ? '—' : rr(r)), h('div', { class: 'st-bar ' + lvl(r) }, h('i', { style: { width: Math.min(100, r * 100) + '%' } })));

// ---- 計算（支持金具ごと。部品と条件が同じ間は結果を使い回す） ----
const cache = new Map();
function upLocal(app, inst) { const g = app.groups?.get(inst.id); if (!g) return [0, 1, 0]; const v = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion.clone().invert()); return [v.x, v.y, v.z]; }
export function strengthOf(app, inst) {
  const s = settingsOf(app.project); let parts; try { parts = app.instanceParts(inst); } catch (e) { return { error: e.message, ok: true, ratio: 0, items: [], members: [], connections: [], warnings: ['部品を作れませんでした: ' + e.message], loads: { pipes: [], total: 0, self: 0, pipe: 0 } }; }
  const up = upLocal(app, inst); const key = JSON.stringify([app.model.resolved(inst), inst.typeId, up.map(v => Math.round(v * 1000)), s, parts.length]); const hit = cache.get(inst.id); if (hit && hit.key === key) return hit.res;
  let res; try { res = analyzeParts(parts, s, { up }); } catch (e) { console.error(e); res = { error: e.message, ok: true, ratio: 0, items: [], members: [], connections: [], supports: [], warnings: ['計算できませんでした: ' + e.message], loads: { pipes: [], total: 0, self: 0, pipe: 0 } }; }
  cache.set(inst.id, { key, res }); return res;
}
export function strengthModel(app) { const rows = app.model.instances.map(inst => ({ inst, res: strengthOf(app, inst) })); const live = rows.filter(r => !r.res.empty && !r.res.error); const ng = live.filter(r => !r.res.ok); const worst = live.slice().sort((a, b) => b.res.ratio - a.res.ratio)[0] || null; return { rows, live, ng, worst, settings: settingsOf(app.project) }; }
const condLine = s => { const KH = khOf(s); return `${s.seismic ? `地震 KH = ${rr(KH)}（${s.khManual != null && s.khManual !== '' ? '直接指定' : `耐震クラス ${s.seismicClass}・${{ top: '上層階・屋上', mid: '中間階', low: '1 階・地階' }[s.floor]}`}）、KV = ${rr(KH * s.kvRatio)}` : '地震は計算しない'} ／ 配管の中身: ${{ water: '満水', empty: '空', custom: `${s.contentsDensity} kg/m³` }[s.contents]} ／ 支持間隔: ${s.span > 0 ? s.span + ' m' : '呼び径ごとの目安'}`; };

// ---- 3D に判定の札を出す ----
// 札は、ほかの札（符号・確認の旗）と同じく 3D の描き直しのたびに作り直す。main.js の _drawLevels から drawStrengthLabels が呼ばれる
export function drawStrengthLabels(app) { css(); const m = strengthModel(app); for (const { inst, res } of m.live) { const g = app.groups.get(inst.id); if (!g) continue; const box = new THREE.Box3().setFromObject(g); if (box.isEmpty()) continue; const pos = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 110, (box.min.z + box.max.z) / 2); const o = app.viewer.label(`強度 ${rr(res.ratio)} ${verdict(res.ratio)}`, pos, 'st-lbl ' + lvl(res.ratio)); o.userData.instId = inst.id; o.element.title = res.worst ? `${res.worst.part}: ${res.worst.label}` : ''; o.element.addEventListener('click', e => { e.stopPropagation(); openStrength(app, { instId: inst.id }); }); } return m; }
export function clearStrengthLabels(app) { app.showStrength = false; app.drawLevels?.(); app.viewer.invalidate(); }
export function showStrengthLabels(app) { app.showStrength = true; app.drawLevels?.(); app.viewer.invalidate(); }

// ---- 条件を変える ----
export function strengthSettingsDialog(app, onDone) {
  css(); const s = settingsOf(app.project); const canEdit = app.role?.() === 'A' || !app.role; const el = {};
  const inp = (key, label, attrs = {}) => h('label', {}, h('span', {}, label), el[key] = h('input', { type: 'number', step: 'any', value: s[key] ?? '', ...attrs }));
  const sel = (key, label, opts) => h('label', {}, h('span', {}, label), el[key] = h('select', {}, opts.map(([v, t]) => h('option', { value: v, selected: String(s[key]) === String(v) }, t))));
  const anchors = Object.keys(DEFAULTS.anchorShort).map(k => h('label', {}, h('span', {}, `アンカー ${k} 短期許容引抜 kN`), el['a_' + k] = h('input', { type: 'number', step: 'any', value: s.anchorShort[k] })));
  const body = h('div', { class: 'st-form' },
    h('h5', {}, '地震'), sel('seismic', '地震を計算する', [['true', 'する'], ['false', 'しない（長期だけ）']]), sel('seismicClass', '耐震クラス', [['S', 'S'], ['A', 'A'], ['B', 'B']]), sel('floor', '設置する階', [['top', '上層階・屋上・塔屋'], ['mid', '中間階'], ['low', '1 階・地階']]), inp('zone', '地域係数 Z'),
    inp('khManual', '水平震度 KH を直接指定（空欄なら上の表から）', { placeholder: '例: 1.0' }), inp('kvRatio', '鉛直震度 KV = KH ×'), sel('seismicDir', '水平力の向き', [['both', '管軸方向と管軸直角の両方'], ['cross', '管軸直角だけ'], ['axial', '管軸方向だけ']]), sel('rodSeismic', '吊ボルトで吊る金具にも水平力をかける', [['false', 'かけない（別の耐震支持で受ける）'], ['true', 'かける']]),
    h('div', { class: 'hint' }, `表の値: ${Object.entries(KS_TABLE).map(([c, v]) => `${c} = ${v.top} / ${v.mid} / ${v.low}`).join('、')}（上層階 / 中間階 / 1 階・地階）。指針の表と照らして使ってください`),
    h('h5', {}, '配管の荷重'), sel('contents', '配管の中身', [['water', '満水'], ['empty', '空'], ['custom', '密度を指定']]), inp('contentsDensity', '中身の密度 kg/m³（指定のとき）'), inp('insulDensity', '保温材の密度 kg/m³'), inp('span', '支持間隔 m（空欄なら呼び径ごとの目安）', { placeholder: '例: 2.0' }), inp('seismicSpan', '地震時に負担する配管長さ m（空欄なら支持間隔と同じ）', { placeholder: '例: 12' }),
    h('h5', {}, '部材'), sel('angleMethod', '山形鋼の曲げの計算', [['principal', '主軸で計算（安全側）'], ['geometric', 'JIS の表の軸で計算（手計算と同じ）']]), inp('F', '鋼材の基準強度 F N/mm²（SS400 = 235）'), inp('deflLimit', 'たわみ制限 L/'), inp('deflLimitCant', 'たわみ制限（片持ち）L/'), inp('kFactor', '座屈長さ係数（空欄なら自動）', { placeholder: '自動' }),
    h('h5', {}, 'ボルト・アンカー'), inp('boltFt', 'ボルト 短期許容引張 N/mm²'), inp('boltFs', 'ボルト 短期許容せん断 N/mm²'), ...anchors,
    h('div', { class: 'hint' }, 'アンカーの値は、あと施工（金属拡張・おねじ形）の目安です。お使いの製品・コンクリートの条件に合わせて、メーカーの値に書き換えてください'));
  if (!canEdit) body.querySelectorAll('input,select').forEach(e => { e.disabled = true; });
  const m = modal({ title: '強度計算の条件（この案件）', body, wide: true, footer: [h('button', { class: 'btn', onClick: () => { if (!canEdit) return; app.project.strength = null; cache.clear(); app.scheduleAutosave?.(); m.close(); toast('条件を初期値に戻しました', 'ok'); onDone?.(); } }, '初期値に戻す'), h('button', { class: 'btn', onClick: () => m.close() }, '閉じる'), h('button', { class: 'btn primary', id: 'stSaveCond', disabled: !canEdit, onClick: () => {
    const num = k => { const v = el[k].value.trim(); return v === '' ? null : +v; }; const out = {};
    for (const k of ['zone', 'kvRatio', 'contentsDensity', 'insulDensity', 'F', 'deflLimit', 'deflLimitCant', 'boltFt', 'boltFs']) { const v = num(k); if (v != null && Number.isFinite(v) && v >= 0) out[k] = v; }
    for (const k of ['khManual', 'span', 'seismicSpan', 'kFactor']) { const v = num(k); out[k] = v != null && Number.isFinite(v) && v > 0 ? v : null; }
    for (const k of ['seismicClass', 'floor', 'seismicDir', 'contents', 'angleMethod']) out[k] = el[k].value; out.seismic = el.seismic.value === 'true'; out.rodSeismic = el.rodSeismic.value === 'true';
    out.anchorShort = {}; for (const k of Object.keys(DEFAULTS.anchorShort)) { const v = +el['a_' + k].value; if (Number.isFinite(v) && v > 0) out.anchorShort[k] = v; }
    app.project.strength = out; cache.clear(); app.scheduleAutosave?.(); m.close(); toast('強度計算の条件を保存しました', 'ok'); onDone?.(); } }, '保存して計算し直す')] });
  return m;
}

// ---- 一覧と内訳 ----
const chkTable = items => h('table', { class: 'grid st-chk' }, h('thead', {}, h('tr', {}, ['部位', '項目', '値', '許容', '検定比', '判定', '荷重の組合せ'].map(x => h('th', {}, x)))), h('tbody', {}, items.map(it => h('tr', {}, h('td', {}, h('b', {}, it.part)), h('td', {}, it.label, h('div', { class: 'st-det' }, it.detail || '')), h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, `${it.value} ${it.unit}`), h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, it.limit ? `${it.kind === 'stress' ? '≤ ' : ''}${it.limit} ${it.unit}` : '—'), h('td', { style: { minWidth: '150px' } }, bar(it.ratio)), h('td', {}, h('span', { class: 'st-badge ' + lvl(it.ratio) }, verdict(it.ratio))), h('td', { class: 'st-det' }, it.caseName || '')))));
function detailOf(app, inst, res) {
  const fam = app.model.familyOf(inst); const box = h('div', { class: 'st-detail', id: 'stDetail' }); box.append(h('h4', {}, `${inst.mark}　${fam.name}　`, h('span', { class: 'st-badge ' + lvl(res.ratio) }, `${rr(res.ratio)} ${verdict(res.ratio)}`)));
  for (const w of res.warnings || []) box.append(h('div', { class: 'st-warnbox' }, '⚠ ' + w));
  const mItems = res.members.flatMap(m => m.checks), cItems = [...res.connections, ...res.items.filter(i => i.scope === 'system')];
  const loads = h('div', {}, h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, ['配管', '載る部材', '重さ kg/m（管 + 中身 + 保温）', '支持間隔 m', '荷重 N（長期）', '地震時 N（負担分）', '配管位置の変位 mm'].map(x => h('th', {}, x)))), h('tbody', {}, res.loads.pipes.length ? res.loads.pipes.map(p => h('tr', {}, h('td', {}, p.nominal), h('td', {}, p.on), h('td', {}, `${p.kgm}（${p.steel} + ${p.fluid} + ${p.insul}）`), h('td', {}, String(p.span)), h('td', {}, p.W.toLocaleString()), h('td', {}, `${p.Ws.toLocaleString()} × KH ${rr(res.KH || 0)}`), h('td', {}, String(p.disp)))) : [h('tr', {}, h('td', { colspan: 7 }, '配管の荷重はありません（自重だけで計算しています）'))])),
    h('p', { class: 'st-note' }, `配管 ${res.loads.pipe.toLocaleString()} N ＋ 部材の自重 ${res.loads.self.toLocaleString()} N ＝ ${res.loads.total.toLocaleString()} N。骨組み: 節点 ${res.model?.nodes ?? 0}、要素 ${res.model?.elems ?? 0}、支持点 ${res.model?.supports ?? 0}`),
    h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, ['支持点', '種類', '位置 mm', '反力 kN（長期）Fx / Fy / Fz', 'モーメント kN·m Mx / My / Mz'].map(x => h('th', {}, x)))), h('tbody', {}, (res.supports || []).map((sp, i) => h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, `${sp.type === 'fixed' ? '固定' : 'ピン'}（${{ anchor: `アンカー ${sp.n} 本`, hole: 'アンカー穴', rod: '吊ボルト', rodhole: '吊ボルト穴', assumed: '仮定' }[sp.kind] || sp.kind}）`), h('td', {}, sp.pos.join(' , ')), h('td', {}, sp.R.slice(0, 3).join(' / ')), h('td', {}, sp.R.slice(3).join(' / ')))))));
  box.append(tabs([{ label: `部材（${mItems.length}）`, body: mItems.length ? chkTable(mItems.slice().sort((a, b) => b.ratio - a.ratio)) : h('p', { class: 'st-note' }, '照査する部材がありません') }, { label: `接合・アンカー（${cItems.length}）`, body: cItems.length ? chkTable(cItems.slice().sort((a, b) => b.ratio - a.ratio)) : h('p', { class: 'st-note' }, '照査できる接合（アンカー・ボルト・U ボルト・溶接）が図にありません') }, { label: '荷重・反力', body: loads }]));
  return box;
}
export function openStrength(app, { instId = null } = {}) {
  css(); const host = h('div', {}); let current = instId || app.selection || null; let m;
  const draw = () => { const M = strengthModel(app); const s = M.settings; host.innerHTML = '';
    if (!M.live.length) { host.append(h('p', {}, '計算できる支持金具がありません。形鋼や吊ボルトを使った部材を置くと、ここに結果が出ます。')); return; }
    const w = M.worst; host.append(h('div', { class: 'st-sum' },
      h('div', { class: 'st-card' }, h('div', { class: 'k' }, '判定'), h('div', { class: 'v ' + (M.ng.length ? 'st-ng' : 'st-ok'), id: 'stVerdict' }, M.ng.length ? `NG ${M.ng.length} 件` : 'すべて OK'), h('div', { class: 's' }, `${M.live.length} 個の支持金具を計算`)),
      h('div', { class: 'st-card' }, h('div', { class: 'k' }, 'いちばん厳しい所（検定比）'), h('div', { class: 'v st-' + lvl(w.res.ratio), id: 'stMax' }, rr(w.res.ratio)), h('div', { class: 's' }, w.res.worst ? `${w.inst.mark}: ${w.res.worst.part} ${w.res.worst.label}` : '')),
      h('div', { class: 'st-card', style: { flex: '2 1 300px' } }, h('div', { class: 'k' }, '計算の条件'), h('div', { class: 's', style: { fontSize: '12px', color: '#33332d', margin: '3px 0 6px' }, id: 'stCond' }, condLine(s)), h('button', { class: 'btn sm', id: 'stCondBtn', onClick: () => strengthSettingsDialog(app, draw) }, '条件を変える'))));
    const tb = h('tbody', {}); for (const { inst, res } of M.rows) { if (res.empty) continue; const fam = app.model.familyOf(inst); const tr = h('tr', { class: inst.id === current ? 'on' : '', 'data-inst': inst.id, onClick: () => { current = inst.id; app.select?.(inst.id); draw(); } }, h('td', {}, h('b', {}, inst.mark)), h('td', {}, fam.name), h('td', { style: { textAlign: 'right' } }, res.error ? '—' : `${(res.loads.total / 1000).toFixed(2)} kN`), h('td', { style: { minWidth: '170px' } }, res.error ? '—' : bar(res.ratio)), h('td', {}, res.error ? h('span', { class: 'st-det' }, '計算できません') : h('span', { class: 'st-badge ' + lvl(res.ratio) }, verdict(res.ratio))), h('td', { class: 'st-det' }, res.worst ? `${res.worst.part}: ${res.worst.label}（${res.worst.caseName}）` : (res.warnings?.[0] || ''))); tb.append(tr); }
    host.append(h('table', { class: 'grid st-list' }, h('thead', {}, h('tr', {}, ['符号', '種類', '荷重（配管 + 自重）', '検定比（1.00 以下で OK）', '判定', '決まった項目'].map(x => h('th', {}, x)))), tb));
    const cur = M.rows.find(r => r.inst.id === current && !r.res.empty && !r.res.error) || M.ng[0] || M.worst; if (cur) { current = cur.inst.id; host.querySelector(`tr[data-inst="${current}"]`)?.classList.add('on'); host.append(detailOf(app, cur.inst, cur.res)); }
    host.append(h('details', { style: { marginTop: '12px' } }, h('summary', { style: { cursor: 'pointer', fontSize: '12.5px' } }, 'この計算の仮定と、計算していないもの'), h('ul', { class: 'st-note' }, assumptionsText(s).map(t => h('li', {}, t)))));
    if (app.showStrength) app.drawLevels?.(); };
  draw();
  m = modal({ title: '強度計算（参考値）', body: host, wide: true, cls: 'st-modal', footer: [
    h('span', { class: 'st-det', style: { marginRight: 'auto' } }, '結果は参考値です。設計者の確認が必要です'),
    h('button', { class: 'btn', id: 'stLabels', onClick: () => { if (app.showStrength) { clearStrengthLabels(app); toast('3D の札を消しました'); } else { showStrengthLabels(app); m.close(); toast('3D に判定の札を出しました。札を押すと内訳が開きます', 'ok'); } } }, '3D に札を出す / 消す'),
    h('button', { class: 'btn', id: 'stXlsx', onClick: () => exportStrengthXlsx(app) }, 'Excel'),
    h('button', { class: 'btn primary', id: 'stPdf', onClick: () => exportStrengthPdf(app) }, '強度計算書 PDF')] });
  m.box.style.maxWidth = 'min(1180px, 96vw)'; return m;
}

// ---- 計算書 ----
const safe = s => String(s || 'project').replace(/[\\/:*?"<>|]/g, '_');
const col = (label, w, align) => ({ label, w, align });
// PDF に埋め込む日本語フォントにはギリシャ文字（σ・τ・λ・Σ）がないので、言葉に置き換える
const pdfSafe = v => typeof v === 'string' ? v.replace(/σc/g, '圧縮応力').replace(/σt/g, '引張応力').replace(/σb/g, '曲げ応力').replace(/σ/g, '応力').replace(/τ/g, 'せん断応力').replace(/λ/g, '細長比').replace(/Σ/g, '合計 ') : Array.isArray(v) ? v.map(pdfSafe) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pdfSafe(x)])) : v;
export async function exportStrengthPdf(app) {
  const M = strengthModel(app); const s = M.settings; if (!M.live.length) { toast('計算できる支持金具がありません', 'warn'); return; }
  const chkCols = [col('部位', 26), col('項目', 22), col('値', 14, 'right'), col('許容', 14, 'right'), col('検定比', 10, 'right'), col('判定', 8), col('荷重の組合せ', 30), col('内訳', 66)];
  const chkRow = it => [it.part, it.label, `${it.value} ${it.unit}`, it.limit ? `${it.limit} ${it.unit}` : '—', it.ratio >= 99 ? '—' : rr(it.ratio), verdict(it.ratio), it.caseName || '', it.detail || ''];
  const sections = [
    { heading: '1. 結果の一覧', table: { cols: [col('符号', 14), col('種類', 40), col('荷重 kN', 14, 'right'), col('検定比', 12, 'right'), col('判定', 10), col('決まった項目', 80)], rows: M.live.map(({ inst, res }) => [inst.mark, app.model.familyOf(inst).name, (res.loads.total / 1000).toFixed(2), rr(res.ratio), verdict(res.ratio), res.worst ? `${res.worst.part}: ${res.worst.label}（${res.worst.caseName}）` : '']) } },
    { heading: '2. 計算の条件と仮定', text: `条件: ${condLine(s)}\n` + assumptionsText(s).map((t, i) => `(${i + 1}) ${t}`).join('\n') }];
  let n = 3; for (const { inst, res } of M.live) { const fam = app.model.familyOf(inst);
    sections.push({ heading: `${n++}. ${inst.mark}　${fam.name}　— 検定比 ${rr(res.ratio)}（${verdict(res.ratio)}）`, kv: [['荷重（配管 + 部材の自重）', `${res.loads.pipe.toLocaleString()} + ${res.loads.self.toLocaleString()} = ${res.loads.total.toLocaleString()} N`], ['地震', res.KH > 0 ? `KH = ${rr(res.KH)}、KV = ${rr(res.KV)}${res.lateral === false ? '（水平力はかけていない: 吊ボルトの金具）' : ''}` : '計算しない'], ['骨組み', `節点 ${res.model.nodes}、要素 ${res.model.elems}、支持点 ${res.model.supports}`]], text: (res.warnings || []).map(w => '※ ' + w).join('\n') || undefined });
    if (res.loads.pipes.length) sections.push({ table: { cols: [col('配管', 14), col('載る部材', 34), col('重さ kg/m', 16, 'right'), col('管 / 中身 / 保温', 30), col('支持間隔 m', 16, 'right'), col('荷重 N', 16, 'right'), col('地震時の負担 N', 20, 'right'), col('変位 mm', 14, 'right')], rows: res.loads.pipes.map(p => [p.nominal, p.on, p.kgm, `${p.steel} / ${p.fluid} / ${p.insul}`, p.span, p.W.toLocaleString(), p.Ws.toLocaleString(), p.disp]) } });
    const mi = res.members.flatMap(m => m.checks); if (mi.length) sections.push({ table: { cols: chkCols, rows: mi.map(chkRow) } });
    const ci = [...res.connections, ...res.items.filter(i => i.scope === 'system')]; if (ci.length) sections.push({ table: { cols: chkCols, rows: ci.map(chkRow) } });
    if (res.supports?.length) sections.push({ table: { cols: [col('支持点', 10), col('種類', 30), col('位置 mm', 40), col('反力 kN（長期）Fx / Fy / Fz', 50), col('モーメント kN·m Mx / My / Mz', 50)], rows: res.supports.map((sp, i) => [i + 1, `${sp.type === 'fixed' ? '固定' : 'ピン'}（${{ anchor: `アンカー ${sp.n} 本`, hole: 'アンカー穴', rod: '吊ボルト', rodhole: '吊ボルト穴', assumed: '仮定' }[sp.kind] || sp.kind}）`, sp.pos.join(' , '), sp.R.slice(0, 3).join(' / '), sp.R.slice(3).join(' / ')]) } }); }
  const t = toast('強度計算書を作っています…', 'info', 60000);
  try { await downloadPdf(`${safe(app.project.name)}_強度計算書.pdf`, { title: '強度計算書（参考）', subtitle: app.project.name, landscape: true, meta: [['プロジェクト', app.project.name], ['作成', new Date().toLocaleDateString('ja-JP')], ['作成者', app.user ? `${app.user().name}（${app.user().company}）` : ''], ['判定', M.ng.length ? `NG ${M.ng.length} 件 / ${M.live.length} 個` : `すべて OK（${M.live.length} 個）`], ['注意', '参考値です。設計者の確認が必要です']], sections: pdfSafe(sections), footer: 'ANGLEX 強度計算書（参考値）' }); t.remove(); toast('強度計算書（PDF）を書き出しました', 'ok'); } catch (e) { t.remove(); console.error(e); toast('PDF を作れませんでした: ' + e.message, 'bad'); }
}
export async function exportStrengthXlsx(app) {
  const M = strengthModel(app); if (!M.live.length) { toast('計算できる支持金具がありません', 'warn'); return; }
  try { const XLSX = await loadXLSX(); const wb = XLSX.utils.book_new(); const s = M.settings;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['符号', '種類', '荷重 N', '検定比', '判定', '決まった部位', '決まった項目', '荷重の組合せ'], ...M.live.map(({ inst, res }) => [inst.mark, app.model.familyOf(inst).name, res.loads.total, +rr(res.ratio), verdict(res.ratio), res.worst?.part || '', res.worst?.label || '', res.worst?.caseName || ''])]), '一覧');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['符号', '区分', '部位', '項目', '値', '単位', '許容', '検定比', '判定', '長期・短期', '荷重の組合せ', '内訳'], ...M.live.flatMap(({ inst, res }) => res.items.map(it => [inst.mark, { member: '部材', anchor: 'アンカー', bolt: 'ボルト', ubolt: 'U ボルト', weld: '溶接', system: '全体' }[it.scope] || it.scope, it.part, it.label, it.value, it.unit, it.limit, +rr(Math.min(it.ratio, 99)), verdict(it.ratio), it.term === 'short' ? '短期' : '長期', it.caseName, it.detail]))]), '照査');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['符号', '配管', '載る部材', '重さ kg/m', '管', '中身', '保温', '支持間隔 m', '荷重 N', '地震時の負担 N', '変位 mm'], ...M.live.flatMap(({ inst, res }) => res.loads.pipes.map(p => [inst.mark, p.nominal, p.on, p.kgm, p.steel, p.fluid, p.insul, p.span, p.W, p.Ws, p.disp]))]), '荷重');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['条件', condLine(s)], [], ...assumptionsText(s).map((t, i) => [`(${i + 1})`, t])]), '条件と仮定');
    XLSX.writeFile(wb, `${safe(app.project.name)}_強度計算.xlsx`); toast('強度計算（Excel）を書き出しました', 'ok'); } catch (e) { console.error(e); toast('Excel を作れませんでした: ' + e.message, 'bad'); }
}
void fmt;
