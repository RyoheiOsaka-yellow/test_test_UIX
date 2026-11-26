// 強度計算の画面: 支持金具ごとの判定の一覧 → 選ぶと部材・接合・荷重の内訳と式。条件の変更、3D への表示、計算書（PDF・Excel）。
// 計算そのものは js/bim/strength.js。ここは見せ方だけ。
import * as THREE from 'three';
import { h, modal, toast, tabs, fmt } from './common.js';
import { analyzeParts, settingsOf, khOf, assumptionsText, DEFAULTS, KS_TABLE } from '../bim/strength.js';
import { downloadPdf, loadXLSX } from './pdfgen.js';
import { costParts } from '../bim/cost.js';
import { parseSpec } from '../geo/profiles.js';
import { ANGLES, UANGLES, CHANNELS, LIPCHANNELS, SQUARES, HBEAMS } from '../data/sections.js';

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
.st-quick{display:flex;flex-wrap:wrap;gap:6px 12px;margin:4px 0 8px}.st-q{display:flex;flex-direction:column;gap:2px;font-size:11px;color:#55554d;flex:1 1 170px}.st-q select{height:28px;border:1px solid #cfcabd;border-radius:6px;padding:0 6px;font:inherit;font-size:12px;background:#fff;color:#22221d}
.st-sub{font-size:12.5px;font-weight:700;margin:10px 0 5px}.st-fix{margin:8px 0 10px;padding:8px 10px;border:1px solid #e3d9b8;background:#fffcf0;border-radius:10px}.st-fix .st-sub{margin-top:0}
.st-extra{margin-bottom:10px}.st-xform{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}.st-xform input,.st-xform select{height:30px;border:1px solid #cfcabd;border-radius:6px;padding:0 8px;font:inherit;background:#fff;min-width:0}
.st-cmpbar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.st-cmpline{font-size:11.5px;color:#55554d;margin-top:6px}
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
  const up = upLocal(app, inst); const extra = extraLoadsOf(inst); const key = JSON.stringify([app.model.resolved(inst), inst.typeId, up.map(v => Math.round(v * 1000)), s, parts.length, extra]); const hit = cache.get(inst.id); if (hit && hit.key === key) return hit.res;
  let res; try { res = analyzeParts(parts, s, { up, extra }); } catch (e) { console.error(e); res = { error: e.message, ok: true, ratio: 0, items: [], members: [], connections: [], supports: [], warnings: ['計算できませんでした: ' + e.message], loads: { pipes: [], total: 0, self: 0, pipe: 0 } }; }
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
    h('h5', {}, '部材'), sel('angleMethod', '山形鋼の曲げの計算', [['principal', '主軸で計算（厳密）'], ['geometric', 'JIS の表の軸で計算（手計算と同じ）']]), inp('F', '鋼材の基準強度 F N/mm²（SS400 = 235）'), inp('deflLimit', 'たわみ制限 L/'), inp('deflLimitCant', 'たわみ制限（片持ち）L/'), inp('kFactor', '座屈長さ係数（空欄なら自動）', { placeholder: '自動' }),
    h('h5', {}, 'ボルト・アンカー'), inp('boltFt', 'ボルト 短期許容引張 N/mm²'), inp('boltFs', 'ボルト 短期許容せん断 N/mm²'), ...anchors,
    h('h5', {}, 'コンクリート・ベースプレート'), inp('Fc', 'コンクリートの設計基準強度 Fc N/mm²'), inp('edgeDist', 'アンカーのへりあき mm（空欄なら十分にある）', { placeholder: '例: 80' }), sel('coneCheck', 'コンクリートのコーン状破壊', [['true', '照査する'], ['false', '照査しない']]), sel('plateCheck', 'ベースプレートの曲げ', [['true', '照査する'], ['false', '照査しない']]), ...Object.keys(DEFAULTS.anchorEmbed).map(k => h('label', {}, h('span', {}, `アンカー ${k} 有効埋込み長さ mm`), el['e_' + k] = h('input', { type: 'number', step: 'any', value: s.anchorEmbed[k] }))),
    h('div', { class: 'hint' }, 'アンカーの値は、あと施工（金属拡張・おねじ形）の目安です。お使いの製品・コンクリートの条件に合わせて、メーカーの値に書き換えてください'));
  if (!canEdit) body.querySelectorAll('input,select').forEach(e => { e.disabled = true; });
  const m = modal({ title: '強度計算の条件（この案件）', body, wide: true, footer: [h('button', { class: 'btn', onClick: () => { if (!canEdit) return; app.project.strength = null; cache.clear(); app.scheduleAutosave?.(); m.close(); toast('条件を初期値に戻しました', 'ok'); onDone?.(); } }, '初期値に戻す'), h('button', { class: 'btn', onClick: () => m.close() }, '閉じる'), h('button', { class: 'btn primary', id: 'stSaveCond', disabled: !canEdit, onClick: () => {
    const num = k => { const v = el[k].value.trim(); return v === '' ? null : +v; }; const out = {};
    for (const k of ['zone', 'kvRatio', 'contentsDensity', 'insulDensity', 'F', 'deflLimit', 'deflLimitCant', 'boltFt', 'boltFs', 'Fc']) { const v = num(k); if (v != null && Number.isFinite(v) && v >= 0) out[k] = v; }
    for (const k of ['khManual', 'span', 'seismicSpan', 'kFactor', 'edgeDist']) { const v = num(k); out[k] = v != null && Number.isFinite(v) && v > 0 ? v : null; }
    for (const k of ['seismicClass', 'floor', 'seismicDir', 'contents', 'angleMethod']) out[k] = el[k].value; out.seismic = el.seismic.value === 'true'; out.rodSeismic = el.rodSeismic.value === 'true'; out.coneCheck = el.coneCheck.value === 'true'; out.plateCheck = el.plateCheck.value === 'true'; out.anchorEmbed = {}; for (const k of Object.keys(DEFAULTS.anchorEmbed)) { const v = +el['e_' + k].value; if (Number.isFinite(v) && v > 0) out.anchorEmbed[k] = v; }
    out.anchorShort = {}; for (const k of Object.keys(DEFAULTS.anchorShort)) { const v = +el['a_' + k].value; if (Number.isFinite(v) && v > 0) out.anchorShort[k] = v; }
    app.project.strength = out; cache.clear(); app.scheduleAutosave?.(); m.close(); toast('強度計算の条件を保存しました', 'ok'); onDone?.(); } }, '保存して計算し直す')] });
  return m;
}

// ---- 一覧と内訳 ----
const chkTable = items => h('table', { class: 'grid st-chk' }, h('thead', {}, h('tr', {}, ['部位', '項目', '値', '許容', '検定比', '判定', '荷重の組合せ'].map(x => h('th', {}, x)))), h('tbody', {}, items.map(it => h('tr', {}, h('td', {}, h('b', {}, it.part)), h('td', {}, it.label, h('div', { class: 'st-det' }, it.detail || '')), h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, `${it.value} ${it.unit}`), h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, it.limit ? `${it.kind === 'stress' ? '≤ ' : ''}${it.limit} ${it.unit}` : '—'), h('td', { style: { minWidth: '150px' } }, bar(it.ratio)), h('td', {}, h('span', { class: 'st-badge ' + lvl(it.ratio) }, verdict(it.ratio))), h('td', { class: 'st-det' }, it.caseName || '')))));
function detailOf(app, inst, res, redraw = () => { }) {
  const fam = app.model.familyOf(inst); const box = h('div', { class: 'st-detail', id: 'stDetail' }); box.append(h('h4', {}, `${inst.mark}　${fam.name}　`, h('span', { class: 'st-badge ' + lvl(res.ratio) }, `${rr(res.ratio)} ${verdict(res.ratio)}`)));
  for (const w of res.warnings || []) box.append(h('div', { class: 'st-warnbox' }, '⚠ ' + w));
  box.append(fixBlock(app, inst, res, redraw));
  const mItems = res.members.flatMap(m => m.checks), cItems = [...res.connections, ...res.items.filter(i => i.scope === 'system')];
  const loads = h('div', {}, extraBlock(app, inst, res, redraw), h('div', { class: 'st-sub' }, '配管の荷重'), h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, ['配管', '載る部材', '重さ kg/m（管 + 中身 + 保温）', '支持間隔 m', '荷重 N（長期）', '地震時 N（負担分）', '配管位置の変位 mm'].map(x => h('th', {}, x)))), h('tbody', {}, res.loads.pipes.length ? res.loads.pipes.map(p => h('tr', {}, h('td', {}, p.nominal), h('td', {}, p.on), h('td', {}, `${p.kgm}（${p.steel} + ${p.fluid} + ${p.insul}）`), h('td', {}, String(p.span)), h('td', {}, p.W.toLocaleString()), h('td', {}, `${p.Ws.toLocaleString()} × KH ${rr(res.KH || 0)}`), h('td', {}, String(p.disp)))) : [h('tr', {}, h('td', { colspan: 7 }, '配管の荷重はありません（自重だけで計算しています）'))])),
    h('p', { class: 'st-note' }, `配管 ${res.loads.pipe.toLocaleString()} N ＋ 部材の自重 ${res.loads.self.toLocaleString()} N${res.loads.extra ? ` ＋ 配管のほか ${res.loads.extra.toLocaleString()} N` : ''} ＝ ${res.loads.total.toLocaleString()} N。骨組み: 節点 ${res.model?.nodes ?? 0}、要素 ${res.model?.elems ?? 0}、支持点 ${res.model?.supports ?? 0}`),
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
      h('div', { class: 'st-card', style: { flex: '2 1 300px' } }, h('div', { class: 'k' }, '計算の条件'), h('div', { class: 's', style: { fontSize: '12px', color: '#33332d', margin: '3px 0 6px' }, id: 'stCond' }, condLine(s)), quickSwitches(app, s, draw), h('button', { class: 'btn sm', id: 'stCondBtn', onClick: () => strengthSettingsDialog(app, draw) }, 'ほかの条件を変える'), app.project.strengthRef ? h('div', { class: 'st-cmpline', id: 'stCmpLine' }, '計算書との突き合わせ: ' + cmpLine(compareRef(app))) : null)));
    const tb = h('tbody', {}); for (const { inst, res } of M.rows) { if (res.empty) continue; const fam = app.model.familyOf(inst); const tr = h('tr', { class: inst.id === current ? 'on' : '', 'data-inst': inst.id, onClick: () => { current = inst.id; app.select?.(inst.id); draw(); } }, h('td', {}, h('b', {}, inst.mark)), h('td', {}, fam.name), h('td', { style: { textAlign: 'right' } }, res.error ? '—' : `${(res.loads.total / 1000).toFixed(2)} kN`), h('td', { style: { minWidth: '170px' } }, res.error ? '—' : bar(res.ratio)), h('td', {}, res.error ? h('span', { class: 'st-det' }, '計算できません') : h('span', { class: 'st-badge ' + lvl(res.ratio) }, verdict(res.ratio))), h('td', { class: 'st-det' }, res.worst ? `${res.worst.part}: ${res.worst.label}（${res.worst.caseName}）` : (res.warnings?.[0] || ''))); tb.append(tr); }
    host.append(h('table', { class: 'grid st-list' }, h('thead', {}, h('tr', {}, ['符号', '種類', '荷重（配管 + 自重 + ほか）', '検定比（1.00 以下で OK）', '判定', '決まった項目'].map(x => h('th', {}, x)))), tb));
    const cur = M.rows.find(r => r.inst.id === current && !r.res.empty && !r.res.error) || M.ng[0] || M.worst; if (cur) { current = cur.inst.id; host.querySelector(`tr[data-inst="${current}"]`)?.classList.add('on'); host.append(detailOf(app, cur.inst, cur.res, draw)); }
    host.append(h('details', { style: { marginTop: '12px' } }, h('summary', { style: { cursor: 'pointer', fontSize: '12.5px' } }, 'この計算の仮定と、計算していないもの'), h('ul', { class: 'st-note' }, assumptionsText(s).map(t => h('li', {}, t)))));
    if (app.showStrength) app.drawLevels?.(); };
  draw();
  m = modal({ title: '強度計算（参考値）', body: host, wide: true, cls: 'st-modal', footer: [
    h('span', { class: 'st-det', style: { marginRight: 'auto' } }, '結果は参考値です。設計者の確認が必要です'),
    h('button', { class: 'btn', id: 'stLabels', onClick: () => { if (app.showStrength) { clearStrengthLabels(app); toast('3D の札を消しました'); } else { showStrengthLabels(app); m.close(); toast('3D に判定の札を出しました。札を押すと内訳が開きます', 'ok'); } } }, '3D に札を出す / 消す'),
    h('button', { class: 'btn', id: 'stCmp', onClick: () => openCompare(app, draw) }, '計算書と比べる'),
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
    sections.push({ heading: `${n++}. ${inst.mark}　${fam.name}　— 検定比 ${rr(res.ratio)}（${verdict(res.ratio)}）`, kv: [['荷重（配管 + 部材の自重）', `${res.loads.pipe.toLocaleString()} + ${res.loads.self.toLocaleString()}${res.loads.extra ? ` + ほか ${res.loads.extra.toLocaleString()}` : ''} = ${res.loads.total.toLocaleString()} N`], ['地震', res.KH > 0 ? `KH = ${rr(res.KH)}、KV = ${rr(res.KV)}${res.lateral === false ? '（水平力はかけていない: 吊ボルトの金具）' : ''}` : '計算しない'], ['骨組み', `節点 ${res.model.nodes}、要素 ${res.model.elems}、支持点 ${res.model.supports}`]], text: (res.warnings || []).map(w => '※ ' + w).join('\n') || undefined });
    if (res.loads.pipes.length) sections.push({ table: { cols: [col('配管', 14), col('載る部材', 34), col('重さ kg/m', 16, 'right'), col('管 / 中身 / 保温', 30), col('支持間隔 m', 16, 'right'), col('荷重 N', 16, 'right'), col('地震時の負担 N', 20, 'right'), col('変位 mm', 14, 'right')], rows: res.loads.pipes.map(p => [p.nominal, p.on, p.kgm, `${p.steel} / ${p.fluid} / ${p.insul}`, p.span, p.W.toLocaleString(), p.Ws.toLocaleString(), p.disp]) } });
    if (res.loads.extras?.length) sections.push({ table: { cols: [col('配管のほかの荷重', 50), col('重さ kg', 20, 'right'), col('荷重 N', 20, 'right'), col('載せる部材', 50)], rows: res.loads.extras.map(x => [x.name, x.kg, x.W.toLocaleString(), x.on]) } });
    const mi = res.members.flatMap(m => m.checks); if (mi.length) sections.push({ table: { cols: chkCols, rows: mi.map(chkRow) } });
    const ci = [...res.connections, ...res.items.filter(i => i.scope === 'system')]; if (ci.length) sections.push({ table: { cols: chkCols, rows: ci.map(chkRow) } });
    if (res.supports?.length) sections.push({ table: { cols: [col('支持点', 10), col('種類', 30), col('位置 mm', 40), col('反力 kN（長期）Fx / Fy / Fz', 50), col('モーメント kN·m Mx / My / Mz', 50)], rows: res.supports.map((sp, i) => [i + 1, `${sp.type === 'fixed' ? '固定' : 'ピン'}（${{ anchor: `アンカー ${sp.n} 本`, hole: 'アンカー穴', rod: '吊ボルト', rodhole: '吊ボルト穴', assumed: '仮定' }[sp.kind] || sp.kind}）`, sp.pos.join(' , '), sp.R.slice(0, 3).join(' / '), sp.R.slice(3).join(' / ')]) } }); }
  const cmp = compareRef(app); if (cmp) sections.push({ heading: `${n++}. 計算書との突き合わせ（${cmp.ref.dummy ? 'ダミーの計算書' : cmp.ref.name}）`, text: `${cmpLine(cmp)}${cmp.ref.dummy ? '\n※ ' + (cmp.ref.note || 'ダミーの計算書です') : ''}`, table: { cols: [col('符号', 14), col('部位', 44), col('項目', 40), col('計算書の検定比', 22, 'right'), col('ANGLEX の検定比', 22, 'right'), col('差', 14, 'right'), col('結果', 18)], rows: cmp.rows.map(r => [r.mark, r.part, r.label, rr(r.refRatio), rr(r.ratio), (r.diff >= 0 ? '+' : '−') + rr(Math.abs(r.diff)), CMP_LABEL[r.status][0]]) } });
  const t = toast('強度計算書を作っています…', 'info', 60000);
  try { await downloadPdf(`${safe(app.project.name)}_強度計算書.pdf`, { title: '強度計算書（参考）', subtitle: app.project.name, landscape: true, meta: [['プロジェクト', app.project.name], ['作成', new Date().toLocaleDateString('ja-JP')], ['作成者', app.user ? `${app.user().name}（${app.user().company}）` : ''], ['判定', M.ng.length ? `NG ${M.ng.length} 件 / ${M.live.length} 個` : `すべて OK（${M.live.length} 個）`], ['注意', '参考値です。設計者の確認が必要です']], sections: pdfSafe(sections), footer: 'ANGLEX 強度計算書（参考値）' }); t.remove(); toast('強度計算書（PDF）を書き出しました', 'ok'); } catch (e) { t.remove(); console.error(e); toast('PDF を作れませんでした: ' + e.message, 'bad'); }
}
export async function exportStrengthXlsx(app) {
  const M = strengthModel(app); if (!M.live.length) { toast('計算できる支持金具がありません', 'warn'); return; }
  try { const XLSX = await loadXLSX(); const wb = XLSX.utils.book_new(); const s = M.settings;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['符号', '種類', '荷重 N', '検定比', '判定', '決まった部位', '決まった項目', '荷重の組合せ'], ...M.live.map(({ inst, res }) => [inst.mark, app.model.familyOf(inst).name, res.loads.total, +rr(res.ratio), verdict(res.ratio), res.worst?.part || '', res.worst?.label || '', res.worst?.caseName || ''])]), '一覧');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['符号', '区分', '部位', '項目', '値', '単位', '許容', '検定比', '判定', '長期・短期', '荷重の組合せ', '内訳'], ...M.live.flatMap(({ inst, res }) => res.items.map(it => [inst.mark, { member: '部材', anchor: 'アンカー', plate: 'ベースプレート', bolt: 'ボルト', ubolt: 'U ボルト', weld: '溶接', system: '全体' }[it.scope] || it.scope, it.part, it.label, it.value, it.unit, it.limit, +rr(Math.min(it.ratio, 99)), verdict(it.ratio), it.term === 'short' ? '短期' : '長期', it.caseName, it.detail]))]), '照査');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['符号', '配管', '載る部材', '重さ kg/m', '管', '中身', '保温', '支持間隔 m', '荷重 N', '地震時の負担 N', '変位 mm'], ...M.live.flatMap(({ inst, res }) => res.loads.pipes.map(p => [inst.mark, p.nominal, p.on, p.kgm, p.steel, p.fluid, p.insul, p.span, p.W, p.Ws, p.disp]))]), '荷重');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['条件', condLine(s)], [], ...assumptionsText(s).map((t, i) => [`(${i + 1})`, t])]), '条件と仮定');
    XLSX.writeFile(wb, `${safe(app.project.name)}_強度計算.xlsx`); toast('強度計算（Excel）を書き出しました', 'ok'); } catch (e) { console.error(e); toast('Excel を作れませんでした: ' + e.message, 'bad'); }
}

// ================= 追加分: すぐ切り替える条件・配管のほかの荷重・直し方の候補・計算書との突き合わせ =================
export function extraLoadsOf(inst) { try { const v = JSON.parse(inst?.params?.stLoads || '[]'); return Array.isArray(v) ? v.filter(x => +x.kg > 0) : []; } catch { return []; } }
const canEdit = app => !app.role || app.role() === 'A';
function setCond(app, patch) { app.project.strength = { ...(app.project.strength || {}), ...patch }; cache.clear(); app.scheduleAutosave?.(); }
// 決めごと 3 つは、一覧の上でその場で切り替えて結果を見比べられるようにする
function quickSwitches(app, s, draw) {
  const sel = (id, label, val, opts, on) => h('label', { class: 'st-q' }, h('span', {}, label), h('select', { id, onChange: e => { on(e.target.value); draw(); } }, opts.map(([v, t]) => h('option', { value: v, selected: String(val) === String(v) }, t))));
  const spans = [['', '支持間隔と同じ'], ['6', '6 m'], ['8', '8 m'], ['12', '12 m']]; if (s.seismicSpan > 0 && !spans.some(x => x[0] === String(s.seismicSpan))) spans.push([String(s.seismicSpan), `${s.seismicSpan} m`]);
  return h('div', { class: 'st-quick', id: 'stQuick' },
    sel('stQAngle', '山形鋼の曲げ', s.angleMethod, [['principal', '主軸で計算（厳密）'], ['geometric', 'JIS の表の軸（手計算と同じ）']], v => setCond(app, { angleMethod: v })),
    sel('stQRod', '吊ボルトの金具に水平の地震力', String(!!s.rodSeismic), [['false', 'かけない（別の耐震支持で受ける）'], ['true', 'かける']], v => setCond(app, { rodSeismic: v === 'true' })),
    sel('stQSpan', '地震時に負担する配管の長さ', s.seismicSpan > 0 ? String(s.seismicSpan) : '', spans, v => setCond(app, { seismicSpan: v ? +v : null })));
}

// ---- 配管のほかの荷重（機器・ダクト・ケーブルラックなど）----
function extraBlock(app, inst, res, redraw) {
  const list = extraLoadsOf(inst); const edit = canEdit(app); const save = next => { app.model.updateInstance(inst.id, { params: { stLoads: JSON.stringify(next) } }); redraw(); };
  const members = res.members.filter(m => !m.rod); const nameOf = idx => members.find(m => m.idx === idx)?.name || '自動';
  const name = h('input', { id: 'stXName', placeholder: '名前（例: ダクト、ケーブルラック、機器）', list: 'stXNames', style: { flex: '2 1 160px' } }), kg = h('input', { id: 'stXKg', type: 'number', min: 0, step: 'any', placeholder: '重さ kg', style: { flex: '1 1 80px' } }), on = h('select', { id: 'stXOn', style: { flex: '1 1 120px' } }, h('option', { value: '' }, '載せる部材: 自動'), members.map(m => h('option', { value: m.idx }, m.name))), pos = h('input', { id: 'stXPos', type: 'number', min: 0, max: 100, step: 1, value: 50, title: '部材の始まりからの位置 %', style: { flex: '0 1 70px' } });
  return h('div', { class: 'st-extra', id: 'stExtra' }, h('div', { class: 'st-sub' }, '配管のほかの荷重（機器・ダクト・ケーブルラックなど）'),
    list.length ? h('table', { class: 'grid' }, h('thead', {}, h('tr', {}, ['名前', '重さ kg', '荷重 N', '載せる部材', '位置 %', ''].map(x => h('th', {}, x)))), h('tbody', {}, list.map((x, i) => h('tr', {}, h('td', {}, x.name || '追加の荷重'), h('td', {}, String(x.kg)), h('td', {}, Math.round(x.kg * 9.80665).toLocaleString()), h('td', {}, x.partIndex == null ? `自動（${res.loads.extras?.[i]?.on || ''}）` : nameOf(x.partIndex)), h('td', {}, String(Math.round((x.pos ?? 0.5) * 100))), h('td', {}, edit ? h('button', { class: 'btn sm', onClick: () => save(list.filter((_, k) => k !== i)) }, '消す') : ''))))) : h('p', { class: 'st-note', style: { margin: '2px 0 6px' } }, 'まだありません。下の欄で足すと、長期の荷重と地震の力の両方に入ります'),
    edit ? h('div', { class: 'st-xform' }, name, h('datalist', { id: 'stXNames' }, ['ダクト', 'ケーブルラック', '機器', '弁・バルブ', '保温材（追加）'].map(v => h('option', { value: v }))), kg, on, pos, h('span', { class: 'st-det' }, '%'), h('button', { class: 'btn sm primary', id: 'stXAdd', onClick: () => { const v = +kg.value; if (!(v > 0)) { toast('重さ（kg）を入れてください', 'warn'); return; } save([...list, { name: name.value.trim() || '追加の荷重', kg: v, partIndex: on.value === '' ? null : +on.value, pos: Math.min(100, Math.max(0, +pos.value || 0)) / 100 }]); } }, '足す')) : null);
}

// ---- 直し方の候補: 決め手になっている所を 1 段上げたら、検定比・重さ・金額がどう変わるか ----
const SPEC_TABLES = { L: [ANGLES, UANGLES], C: [CHANNELS], LC: [LIPCHANNELS], SQ: [SQUARES], H: [HBEAMS] };
export function nextSpecs(specStr, n = 3) { const p = parseSpec(specStr); if (!p || !SPEC_TABLES[p.kind]) return []; const tbl = Object.assign({}, ...SPEC_TABLES[p.kind]); const cur = tbl[p.key]; if (!cur) return []; const prefix = String(specStr).match(/^[^\d]*/)[0];
  return Object.entries(tbl).filter(([k, v]) => v.Zx > cur.Zx * 1.02 && v.w > cur.w && parseSpec(prefix + k)?.kind === p.kind).sort((a, b) => a[1].w - b[1].w).slice(0, n).map(([k]) => prefix + k); }
export function suggestFixes(app, inst, res, { limit = 6, from = 0.8 } = {}) {
  const fam = app.model.familyOf(inst); const p = app.model.resolved(inst); const s = settingsOf(app.project); const up = upLocal(app, inst); const extra = extraLoadsOf(inst); let parts0; try { parts0 = app.instanceParts(inst); } catch { return []; }
  const cost = parts => { try { const c = costParts(parts, app.rates()); return { mass: c.weight.total, price: c.factoryPrice }; } catch { return { mass: 0, price: 0 }; } }; const base = cost(parts0);
  const cands = new Map(); const firstOf = new Map(); const addC = (label, override, it) => { const k = JSON.stringify(override); const why = `${it.part} ${it.label}`; if (!cands.has(k)) cands.set(k, { label, override, why }); const ik = it.scope + '|' + it.part; if (!firstOf.has(ik)) firstOf.set(ik, { label, override, why }); };
  const defs = fam.params || []; const optNext = (d, cur, n = 2) => { const o = (d.options || []).map(x => x[0]); const i = o.indexOf(cur); return i < 0 ? [] : o.slice(i + 1, i + 1 + n); };
  for (const it of res.items.filter(i => i.ratio >= from && i.scope !== 'system').sort((a, b) => b.ratio - a.ratio).slice(0, 4)) { const part = parts0[it.partIndex];
    if (it.scope === 'member' && part?.kind === 'member') for (const d of defs.filter(d => d.type === 'spec')) { const a = parseSpec(p[d.key]), b = parseSpec(part.spec); if (!a || !b || a.kind !== b.kind || a.key !== b.key) continue; for (const nx of nextSpecs(p[d.key], 3)) addC(`${d.label}: ${p[d.key]} → ${nx}`, { [d.key]: nx }, it); }
    if (it.scope === 'member' && part?.kind === 'rod') for (const d of defs.filter(d => d.type === 'select' && p[d.key] === part.M)) for (const nx of optNext(d, p[d.key])) addC(`${d.label}: ${p[d.key]} → ${nx}`, { [d.key]: nx }, it);
    if (it.scope === 'anchor' || it.scope === 'plate') { const M = (it.scope === 'anchor' ? part?.M : null) || p.anchorM; for (const d of defs.filter(d => d.type === 'select' && /anchor/i.test(d.key) && p[d.key] === M)) for (const nx of optNext(d, p[d.key])) addC(`${d.label}: ${p[d.key]} → ${nx}`, { [d.key]: nx }, it);
      const dn = defs.find(d => d.key === 'anchorN'); if (dn && +p.anchorN < 4) addC(`${dn.label}: ${p.anchorN} → 4`, { anchorN: 4 }, it);
      const dt = defs.find(d => d.key === 'baseT'); if (dt && it.scope === 'plate') for (const t of [12, 16, 19].filter(t => t > +p.baseT).slice(0, 2)) addC(`${dt.label}: ${p.baseT} → ${t} mm`, { baseT: t }, it); }
    if (it.scope === 'weld') { const d = defs.find(d => d.key === 'weldSize'); if (d) for (const t of [+p.weldSize + 1, +p.weldSize + 3].filter(t => t <= 12)) addC(`${d.label}: ${p.weldSize} → ${t} mm`, { weldSize: t }, it); } }
  // 決め手が 2 つ以上あるときは、それぞれの 1 段上をまとめた案も足す（1 つだけ直しても、次の決め手で止まるため）
  { const firsts = [...firstOf.values()].filter((c, i, a) => a.findIndex(x => Object.keys(x.override).some(k => k in c.override)) === i).slice(0, 3); if (firsts.length >= 2) { const k = Object.assign({}, ...firsts.map(c => c.override)); const ks = JSON.stringify(k); if (!cands.has(ks)) cands.set(ks, { label: firsts.map(c => c.label).join(' ＋ '), override: k, why: firsts.map(c => c.why).join('、') }); } }
  const out = []; for (const c of cands.values()) { try { const parts = app.instanceParts(inst, c.override); const r = analyzeParts(parts, s, { up, extra }); const k = cost(parts); out.push({ ...c, ratio: r.ratio, ok: r.ok, dMass: k.mass - base.mass, dPrice: k.price - base.price, worst: r.worst ? `${r.worst.part} ${r.worst.label}` : '' }); } catch (e) { console.warn('fix', c.label, e); } }
  return out.filter(c => c.ratio < res.ratio - 0.005).sort((a, b) => (a.ok === b.ok ? (a.ok ? a.dPrice - b.dPrice || a.ratio - b.ratio : a.ratio - b.ratio) : a.ok ? -1 : 1)).slice(0, limit);
}
function fixBlock(app, inst, res, redraw) {
  const box = h('div', { class: 'st-fix', id: 'stFix' }); const edit = canEdit(app); const sign = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
  const fill = from => { const list = suggestFixes(app, inst, res, { from }); box.innerHTML = ''; box.append(h('div', { class: 'st-sub' }, res.ratio > 1 ? '直し方の候補（NG を解消する案）' : '直し方の候補（余裕を増やす案）'));
    if (!list.length) { box.append(h('p', { class: 'st-note' }, 'この金具の寸法・仕様の中に、検定比を下げられる候補が見つかりませんでした。支持点や斜材を足す、支持間隔を詰める、などを検討してください')); return; }
    box.append(h('table', { class: 'grid st-fixt' }, h('thead', {}, h('tr', {}, ['案', '検定比（今 → この案）', '重さ', '金額（1 台）', 'この案で決まる所', ''].map(x => h('th', {}, x)))), h('tbody', {}, list.map((c, i) => h('tr', { 'data-fix': i }, h('td', {}, h('b', {}, c.label), h('div', { class: 'st-det' }, `対象: ${c.why}`)), h('td', { style: { whiteSpace: 'nowrap' } }, `${rr(res.ratio)} → `, h('b', { class: 'st-' + lvl(c.ratio) }, rr(c.ratio)), ' ', h('span', { class: 'st-badge ' + lvl(c.ratio) }, verdict(c.ratio))), h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, sign(c.dMass, v => v.toFixed(2)) + ' kg'), h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } }, sign(c.dPrice, v => '¥' + Math.round(v).toLocaleString())), h('td', { class: 'st-det' }, c.worst), h('td', {}, edit ? h('button', { class: 'btn sm primary', onClick: () => { app.model.updateInstance(inst.id, { params: c.override }); const ni = app.model.getInstance(inst.id); app.rebuildInstance?.(ni); toast(`${inst.mark}: ${c.label}`, 'ok'); redraw(); } }, 'この案にする') : ''))))));
    box.append(h('p', { class: 'st-note' }, '案を選ぶと、その金具の寸法・仕様が変わり、3D・重さ・見積もいっしょに変わります（元に戻すで取り消せます）')); };
  if (res.ratio >= 0.8) fill(0.8); else box.append(h('button', { class: 'btn sm', id: 'stFixBtn', onClick: () => fill(Math.max(0.05, res.ratio * 0.85)) }, '余裕を増やす候補を見る'));
  return box;
}

// ---- 計算書との突き合わせ: 手計算や社内の計算書の検定比を読み込み、ANGLEX の結果と 1 行ずつ比べる ----
const cmpKey = (mark, part, label) => [mark, part, label].map(x => String(x ?? '').replace(/\s+/g, '')).join('|');
function calcRows(app, sOverride = null) { const out = []; const s = sOverride || settingsOf(app.project); for (const inst of app.model.instances) { let res; if (sOverride) { try { res = analyzeParts(app.instanceParts(inst), s, { up: upLocal(app, inst), extra: extraLoadsOf(inst) }); } catch { continue; } } else res = strengthOf(app, inst); if (!res || res.empty || res.error) continue; for (const it of res.items) if (it.scope !== 'system') out.push({ mark: inst.mark, part: it.part, label: it.label, unit: it.unit, value: it.value, ratio: Math.min(it.ratio, 99) }); } return out; }
// ダミーの計算書: 手計算でよく使う前提（山形鋼は JIS の表の軸、座屈長さ係数 1.0）で計算した値を、計算書の形にしたもの。機能を試すためのもので、実際の計算書ではない
export function dummyRef(app) { const s0 = settingsOf(app.project); const s = { ...s0, angleMethod: s0.angleMethod === 'geometric' ? 'principal' : 'geometric', kFactor: 1.0 }; return { name: 'ダミーの計算書', dummy: true, note: `手計算でよく使う前提（山形鋼は${s.angleMethod === 'geometric' ? ' JIS の表の軸' : '主軸'}、座屈長さ係数 1.0）で作ったダミーです。実際の計算書ではありません`, at: new Date().toISOString(), rows: calcRows(app, s).map(r => ({ ...r, ratio: Math.round(r.ratio * 100) / 100, note: 'ダミー' })) }; }
export function compareRef(app, ref = app.project.strengthRef) { if (!ref?.rows?.length) return null; const now = new Map(calcRows(app).map(r => [cmpKey(r.mark, r.part, r.label), r])); const used = new Set(); const rows = [], missing = [];
  for (const r of ref.rows) { const k = cmpKey(r.mark, r.part, r.label); const n = now.get(k); if (!n || !Number.isFinite(+r.ratio)) { missing.push(r); continue; } used.add(k); const a = +r.ratio, b = n.ratio; const d = b - a; const flip = (a > 1) !== (b > 1); const status = flip ? 'flip' : Math.abs(d) <= Math.max(0.02, a * 0.05) ? 'same' : Math.abs(d) <= Math.max(0.05, a * 0.15) ? 'near' : 'check'; rows.push({ ...r, refRatio: a, ratio: b, diff: d, status, unit: n.unit, value: n.value }); }
  const counts = { same: 0, near: 0, check: 0, flip: 0 }; for (const r of rows) counts[r.status]++; rows.sort((x, y) => ({ flip: 0, check: 1, near: 2, same: 3 })[x.status] - ({ flip: 0, check: 1, near: 2, same: 3 })[y.status] || Math.abs(y.diff) - Math.abs(x.diff));
  return { ref, rows, missing, extraNow: [...now.keys()].filter(k => !used.has(k)).length, counts }; }
const REF_HEAD = ['符号', '部位', '項目', '単位', '計算書の値', '計算書の検定比', '備考'];
export async function exportRefSheet(app, { dummy = false } = {}) { try { const XLSX = await loadXLSX(); const rows = dummy ? dummyRef(app).rows : calcRows(app).map(r => ({ ...r, value: '', ratio: '', note: '' })); if (!rows.length) { toast('計算できる支持金具がありません', 'warn'); return; } const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([REF_HEAD, ...rows.map(r => [r.mark, r.part, r.label, r.unit, r.value, r.ratio, r.note || ''])]), '計算書');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['使い方'], ['「計算書」のシートの「計算書の検定比」の列に、手計算や社内の計算書の値を入れて、ANGLEX の「計算書と比べる」で読み込みます'], ['符号・部位・項目の 3 つが同じ行どうしを比べます。行は消しても、順番を変えてもかまいません'], [dummy ? 'このファイルはダミーです。手計算でよく使う前提（山形鋼は JIS の表の軸、座屈長さ係数 1.0）で ANGLEX が作った値で、実際の計算書ではありません' : '「計算書の値」の列は参考で、比べるのは検定比です']]), '使い方');
    XLSX.writeFile(wb, `${safe(app.project.name)}_${dummy ? 'ダミーの計算書' : '計算書のひな形'}.xlsx`); toast(dummy ? 'ダミーの計算書（Excel）を書き出しました' : '計算書のひな形（Excel）を書き出しました', 'ok'); } catch (e) { console.error(e); toast('Excel を作れませんでした: ' + e.message, 'bad'); } }
export async function importRefFile(app, file) { const XLSX = await loadXLSX(); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const ws = wb.Sheets['計算書'] || wb.Sheets[wb.SheetNames[0]]; const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); const hi = aoa.findIndex(r => r.some(c => /符号/.test(String(c))) && r.some(c => /検定比/.test(String(c)))); if (hi < 0) throw new Error('「符号」と「検定比」の見出しがある表が見つかりません');
  const hd = aoa[hi].map(String); const ci = re => hd.findIndex(c => re.test(c)); const c = { mark: ci(/符号/), part: ci(/部位/), label: ci(/項目/), unit: ci(/単位/), value: ci(/計算書の値|^値/), ratio: ci(/検定比/), note: ci(/備考/) }; if (c.part < 0 || c.label < 0) throw new Error('「部位」と「項目」の列が必要です');
  const rows = aoa.slice(hi + 1).filter(r => String(r[c.mark]).trim() && String(r[c.ratio]).trim() !== '' && Number.isFinite(+r[c.ratio])).map(r => ({ mark: String(r[c.mark]).trim(), part: String(r[c.part]).trim(), label: String(r[c.label]).trim(), unit: c.unit >= 0 ? String(r[c.unit]) : '', value: c.value >= 0 ? r[c.value] : '', ratio: +r[c.ratio], note: c.note >= 0 ? String(r[c.note]) : '' })); if (!rows.length) throw new Error('検定比が入っている行がありません');
  const ref = { name: file.name, dummy: rows.every(r => /ダミー/.test(r.note)), at: new Date().toISOString(), rows }; app.project.strengthRef = ref; app.scheduleAutosave?.(); return ref; }
const CMP_LABEL = { same: ['一致', 'ok'], near: ['近い', 'warn'], check: ['要確認', 'ng'], flip: ['判定が逆', 'ng'] };
const cmpLine = c => c ? `一致 ${c.counts.same}・近い ${c.counts.near}・要確認 ${c.counts.check + c.counts.flip}${c.missing.length ? `・相手なし ${c.missing.length}` : ''}（${c.ref.dummy ? 'ダミーの計算書' : c.ref.name}）` : '';
export function openCompare(app, onDone) {
  css(); const host = h('div', { id: 'stCmpBody' }); const edit = canEdit(app); const file = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', style: { display: 'none' }, id: 'stCmpFile', onChange: async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const r = await importRefFile(app, f); toast(`計算書を読み込みました（${r.rows.length} 行）`, 'ok'); draw(); onDone?.(); } catch (err) { toast('読み込めませんでした: ' + err.message, 'bad', 6000); } } });
  const draw = () => { host.innerHTML = ''; const c = compareRef(app);
    host.append(h('p', { class: 'st-note', style: { marginTop: 0 } }, '手計算や社内の計算書の検定比を読み込み、ANGLEX の結果と 1 行ずつ比べます。符号・部位・項目の 3 つが同じ行どうしを比べます。計算書がまだなければ、ダミーで動きを試せます'),
      h('div', { class: 'st-cmpbar' }, h('button', { class: 'btn', id: 'stCmpTpl', onClick: () => exportRefSheet(app) }, 'ひな形を書き出す（Excel）'), h('button', { class: 'btn', id: 'stCmpDummyX', onClick: () => exportRefSheet(app, { dummy: true }) }, 'ダミーの計算書を書き出す（Excel）'), h('button', { class: 'btn', id: 'stCmpLoad', disabled: !edit, onClick: () => file.click() }, '計算書を読み込む'), h('button', { class: 'btn primary', id: 'stCmpDummy', disabled: !edit, onClick: () => { app.project.strengthRef = dummyRef(app); app.scheduleAutosave?.(); toast('ダミーの計算書と比べました', 'ok'); draw(); onDone?.(); } }, 'ダミーで試す'), c ? h('button', { class: 'btn', id: 'stCmpClear', disabled: !edit, onClick: () => { app.project.strengthRef = null; app.scheduleAutosave?.(); draw(); onDone?.(); } }, '比べるのをやめる') : null, file));
    if (!c) { host.append(h('p', { class: 'st-note' }, 'まだ計算書を読み込んでいません')); return; }
    if (c.ref.dummy) host.append(h('div', { class: 'st-warnbox' }, '⚠ ' + (c.ref.note || 'ダミーの計算書と比べています。実際の計算書ではありません')));
    host.append(h('div', { class: 'st-sum' }, ...[['same', '一致（差 5% 以内）'], ['near', '近い（差 15% 以内）'], ['check', '要確認（差が大きい）'], ['flip', '判定が逆（OK と NG）']].map(([k, t]) => h('div', { class: 'st-card' }, h('div', { class: 'k' }, t), h('div', { class: 'v st-' + CMP_LABEL[k][1], id: 'stCmp_' + k }, String(c.counts[k]))))));
    host.append(h('table', { class: 'grid st-chk', id: 'stCmpTable' }, h('thead', {}, h('tr', {}, ['符号', '部位', '項目', '計算書の検定比', 'ANGLEX の検定比', '差', '結果'].map(x => h('th', {}, x)))), h('tbody', {}, c.rows.map(r => h('tr', {}, h('td', {}, h('b', {}, r.mark)), h('td', {}, r.part), h('td', {}, r.label), h('td', { style: { textAlign: 'right' } }, rr(r.refRatio)), h('td', { style: { textAlign: 'right' } }, h('b', { class: 'st-' + lvl(r.ratio) }, rr(r.ratio))), h('td', { style: { textAlign: 'right' } }, (r.diff >= 0 ? '+' : '−') + rr(Math.abs(r.diff))), h('td', {}, h('span', { class: 'st-badge ' + CMP_LABEL[r.status][1] }, CMP_LABEL[r.status][0])))))));
    if (c.missing.length || c.extraNow) host.append(h('p', { class: 'st-note' }, `${c.missing.length ? `計算書にあって ANGLEX に相手がない行: ${c.missing.length}（${c.missing.slice(0, 4).map(r => `${r.mark} ${r.part} ${r.label}`).join('、')}${c.missing.length > 4 ? ' ほか' : ''}）。` : ''}${c.extraNow ? `ANGLEX にあって計算書にない項目: ${c.extraNow}` : ''}`)); };
  draw(); const m = modal({ title: '計算書と比べる', body: host, wide: true, cls: 'st-cmp', footer: [h('button', { class: 'btn', onClick: () => m.close() }, '閉じる')] }); m.box.style.maxWidth = 'min(1080px, 96vw)'; return m;
}
void fmt;
