// カタログブラウザ: Drive 由来の製品DB（151製品 / 700 SKU）を章・サブカテゴリ・検索で絞り込み、タイプとして登録／配置
import { h, modal, toast, esc } from './common.js';
import { CATALOG } from '../data/catalog.js';
import { familyById } from '../bim/families.js';
import { pipeOD } from '../data/sections.js';
export function openCatalog(app) {
  let q = '', chapter = 'all', sub = 'all', selected = null, sku = null;
  const list = h('div', { class: 'cat-list' }); const detail = h('div', { class: 'cat-detail' });
  const chapters = CATALOG.chapters; const subs = () => [...new Set(CATALOG.products.filter(p => chapter === 'all' || p.chapter === +chapter).map(p => p.sub))];
  const chapSel = h('select', { onChange: e => { chapter = e.target.value; sub = 'all'; refreshSubs(); render(); } }, h('option', { value: 'all' }, `全章（${CATALOG.products.length}）`), chapters.map(c => h('option', { value: c.no }, `${c.no}章 ${c.name}（${c.count}）`)));
  const subSel = h('select', { onChange: e => { sub = e.target.value; render(); } }); const refreshSubs = () => { subSel.innerHTML = ''; subSel.append(h('option', { value: 'all' }, '全サブカテゴリ'), subs().map(s => h('option', { value: s }, s))); }; refreshSubs();
  const search = h('input', { placeholder: '商品名・型番・管理番号・用途で検索', onInput: e => { q = e.target.value.trim(); render(); } });
  function matches(p) { if (chapter !== 'all' && p.chapter !== +chapter) return false; if (sub !== 'all' && p.sub !== sub) return false; if (!q) return true; const hay = [p.name, p.pid, p.code, p.sub, p.notes, ...(p.models || [])].join(' ').toLowerCase(); return q.toLowerCase().split(/\s+/).every(w => hay.includes(w)); }
  function render() { list.innerHTML = ''; const ps = CATALOG.products.filter(matches); list.append(h('div', { class: 'cat-count' }, `${ps.length} 件`)); for (const p of ps.slice(0, 400)) { const fam = familyById(p.family); list.append(h('div', { class: 'cat-item' + (selected === p ? ' sel' : ''), onClick: () => { selected = p; sku = p.skus[0] || null; render(); renderDetail(); } }, h('div', { class: 'cat-item-head' }, h('span', { class: 'chip ghost' }, p.pid), h('span', { class: 'chip ' + (p.kind === '特注加工品' ? 'warn' : 'ok') }, p.kind), p.nameInferred ? h('span', { class: 'chip ghost', title: '1章の商品名シートは未取得のため寸法パターンから推定' }, '名称推定') : null), h('div', { class: 'cat-item-name' }, p.name), h('div', { class: 'cat-item-sub' }, `${p.chapter}章 ${p.sub}${p.code ? ' / 管理番号 ' + p.code : ''}${p.skus.length ? ' / SKU ' + p.skus.length : ''}`), h('div', { class: 'cat-item-fam' }, '3D: ', fam ? fam.name : '—'))); } }
  function renderDetail() { detail.innerHTML = ''; const p = selected; if (!p) { detail.append(h('div', { class: 'pp-empty' }, '左の一覧から製品を選択')); return; } const fam = familyById(p.family);
    detail.append(h('h3', {}, p.name), h('div', { class: 'cat-meta' }, h('span', { class: 'chip ghost' }, p.pid), p.code ? h('span', { class: 'chip ghost' }, '管理番号 ' + p.code) : null, h('span', { class: 'chip ghost' }, p.maker || ''), p.page ? h('span', { class: 'chip ghost' }, 'カタログ p.' + p.page) : null, h('span', { class: 'chip ' + (p.finish === 'SUS304' ? 'ok' : 'ghost') }, p.finish)));
    if (p.parsed && Object.keys(p.parsed).length) detail.append(h('dl', { class: 'cat-dl' }, Object.entries(p.parsed).filter(([k]) => k !== 'other').map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]), (p.parsed.other || []).map(v => [h('dt', {}, '備考'), h('dd', {}, v)]))); else if (p.notes) detail.append(h('p', { class: 'cat-notes' }, p.notes));
    if (p.orderFields?.length) detail.append(h('div', { class: 'cat-order' }, h('b', {}, '注文時確認（特注品）'), h('ul', {}, p.orderFields.map(f => h('li', {}, f)))));
    if (p.models?.length) detail.append(h('div', { class: 'cat-models' }, h('b', {}, '型番'), h('div', { class: 'chips' }, p.models.map(m => h('span', { class: 'chip' }, m)))));
    if (p.skus.length) { const sel = h('select', { onChange: e => { sku = p.skus.find(s => s.sku === e.target.value); renderSku(); } }, p.skus.map(s => h('option', { value: s.sku, selected: sku && s.sku === sku.sku }, `SKU ${s.sku}  ${s.dims['管径称'] || s.dims['管径称(VP)'] || s.dims['サイズ'] || s.dims['サイズ呼称'] || ''}`))); const skuBox = h('div', { class: 'cat-sku' }); const renderSku = () => { skuBox.innerHTML = ''; if (!sku) return; skuBox.append(h('table', { class: 'grid tight' }, h('tbody', {}, Object.entries(sku.dims).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))))); }; renderSku(); detail.append(h('div', { class: 'cat-models' }, h('b', {}, `寸法表（${p.skus.length} SKU）`), sel, skuBox)); }
    detail.append(h('div', { class: 'cat-fam' }, h('b', {}, '3D ファミリ'), ' ', fam ? fam.name : '（形状なし）', fam?.params ? h('div', { class: 'pp-note' }, 'パラメータ: ' + fam.params.map(d => d.label).slice(0, 8).join('、') + (fam.params.length > 8 ? '…' : '')) : null));
    detail.append(h('div', { class: 'cat-actions' }, h('button', { class: 'btn primary', disabled: !fam, onClick: () => { const t = addTypeFromProduct(app, p, sku); toast(`タイプ「${t.name}」を登録しました`, 'ok'); app.refreshBrowser(); } }, 'タイプとして登録'), h('button', { class: 'btn', disabled: !fam, onClick: () => { const t = addTypeFromProduct(app, p, sku); const inst = app.model.addInstance(t.id, { pos: app.nextPlacePos() }); app.rebuildInstance(inst); app.select(inst.id); app.refreshBrowser(); m.close(); toast(`${inst.mark} を配置しました`, 'ok'); } }, '登録して配置'))); }
  const m = modal({ title: `部材カタログ（${CATALOG.products.length} 製品 / ${CATALOG.products.reduce((s, p) => s + p.skus.length, 0)} SKU）— Google Drive 製品マスタより`, wide: true, cls: 'catalog', body: h('div', { class: 'cat-wrap' }, h('div', { class: 'cat-side' }, h('div', { class: 'cat-filters' }, search, chapSel, subSel), list), detail) });
  render(); renderDetail(); setTimeout(() => search.focus(), 50);
}
// 製品 + SKU → ファミリパラメータ
// 製品 + SKU → ファミリ ID・パラメータ・タイプ名（タイプを作らずに計算。サムネイル生成でも使う）
export function productParams(p, sku) {
  const fam = familyById(p.family); if (!fam) throw new Error('ファミリ未対応: ' + p.family); const params = { ...(p.familyParams || {}) };
  params.finish = p.finish === 'HDZ' ? 'HDZ' : p.finish === 'SUS304' ? 'SUS304' : p.finish === 'ZAM' ? 'ZAM' : 'EZ'; if (p.finish === 'SUS304') params.material = 'SUS304';
  if (sku) { const d = sku.dims; const num = s => { const m = String(s || '').match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
    if (d['適合配管径']) params.od = num(d['適合配管径']); else if (d['管径称']) params.od = pipeOD(d['管径称'], 'SGP') || num(d['管径称']); else if (d['管径称(VP)']) params.od = pipeOD(d['管径称(VP)'].replace('A', ''), 'VP') || num(d['管径称(VP)']);
    if (d['t×B']) { const m = d['t×B'].match(/(\d+(?:\.\d+)?)×(\d+)/); if (m) { params.t = +m[1]; params.B = +m[2]; } } if (d['t']) params.t = num(d['t']); if (d['B']) params.B = num(d['B']);
    if (d['d']) params.d = /^M/.test(d['d']) ? d['d'] : 'W' + d['d'].replace(/^W/, ''); if (d['C']) params.C = num(d['C']); if (d['H']) params.H = num(d['H']); if (d['L1']) params.L1 = num(d['L1']); if (d['L2']) params.L2 = num(d['L2']); if (d['ゴム厚']) params.rubber = num(d['ゴム厚']);
    if (d['締付ボルトナット']) { const m = d['締付ボルトナット'].match(/M(\d+)×(\d+)/); if (m) params.bolt = `M${m[1]}x${m[2]}`; }
    if (d['L']) params.L = num(d['L']); if (d['板厚']) params.t = num(d['板厚']); if (d['φ']) params.phi = num(d['φ']); if (d['P']) params.P = num(d['P']); if (d['d1']) params.d1 = num(d['d1']);
    params.__sku = sku.sku; }
  params.__pid = p.pid;
  // ファミリに無いキーは除外（__ 系は保持）
  const keys = new Set(fam.params.map(x => x.key)); for (const k of Object.keys(params)) if (!keys.has(k) && !k.startsWith('__')) delete params[k];
  const name = p.name + (sku ? ` ${sku.dims['管径称'] || sku.dims['管径称(VP)'] || sku.dims['サイズ'] || sku.sku}` : '');
  return { familyId: fam.id, name, params };
}
export function addTypeFromProduct(app, p, sku) { const existing = app.model.types.find(t => t.params.__pid === p.pid && t.params.__sku === (sku ? sku.sku : null)); if (existing) return existing; const pp = productParams(p, sku); return app.model.addType(pp.familyId, pp.name, pp.params); }
