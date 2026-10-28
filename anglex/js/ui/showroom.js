// カタログ ショールーム: 製品を選ぶとその場で 3D に現れ、並んでいく（もう一度選ぶと消える）
import { $, h, toast, confirmDialog } from './common.js';
import { CATALOG } from '../data/catalog.js';
import { familyById } from '../bim/families.js';
import { addTypeFromProduct } from './catalog.js';
import { thumbFor, thumbCached, loadThumbCache, warmThumbs } from './thumbs.js';

const CH_LABEL = { 1: '吊バンド', 13: 'アングル・チャンネルブラケット', 14: '特注加工品' };

export function openShowroom(app) {
  const old = document.querySelector('.showroom'); if (old) { old.remove(); return; }
  const stage = $('#d3stage') || $('#stage'); if (!stage) return; const editable = app.role() === 'A';
  const state = { q: '', ch: null, skuSel: new Map() };
  const panel = h('div', { class: 'showroom', onClick: e => e.stopPropagation() });
  const head = h('div', { class: 'sr-head' }, h('div', {}, h('b', {}, 'カタログ ショールーム'), h('div', { class: 'muted small' }, `日栄インテック ${CATALOG.products.length} 製品 / ${CATALOG.products.reduce((a, p) => a + (p.skus?.length || 0), 0)} SKU（Drive から取込）`)), h('button', { class: 'icon-btn', title: '閉じる', onClick: () => panel.remove() }, '✕'));
  let qT = 0; const search = h('input', { class: 'sr-search', placeholder: '製品名・型番・ファミリで検索（例: 門型 / バンド / 50A）', onInput: e => { state.q = e.target.value.trim(); cancelAnimationFrame(qT); qT = requestAnimationFrame(renderList); } });
  const chips = h('div', { class: 'sr-chips' }, h('button', { class: 'chip on', onClick: e => { state.ch = null; setChip(e.target); } }, 'すべて'), ...CATALOG.chapters.map(c => h('button', { class: 'chip', onClick: e => { state.ch = c.no; setChip(e.target); } }, `第${c.no}章 ${CH_LABEL[c.no] || c.name}（${c.count}）`)));
  const setChip = el => { chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === el)); renderList(); };
  const list = h('div', { class: 'sr-list' }); const foot = h('div', { class: 'sr-foot' });
  panel.append(head, search, chips, list, foot); stage.append(panel);
  const placedOf = p => app.model.instances.filter(i => { const t = app.model.getType(i.typeId); return t && t.params.__pid === p.pid && i.source === 'catalog'; });
  function renderList() {
    list.innerHTML = ''; const q = state.q.toLowerCase(); const prods = CATALOG.products.filter(p => (!state.ch || p.chapter === state.ch) && (!q || [p.name, p.pid, p.code, p.family, p.sub, familyById(p.family)?.name, ...(p.skus || []).map(s => s.sku)].filter(Boolean).join(' ').toLowerCase().includes(q)));
    let n = 0; for (const p of prods) { const fam = (p.kind === '章扉解説' || p.category === '参照資料') ? null : familyById(p.family); const placed = placedOf(p); const skus = p.skus || []; const skuSel = state.skuSel.get(p.pid) ?? 0;
      const row = h('div', { class: 'sr-row' + (placed.length ? ' placed' : '') + (fam ? '' : ' na'), title: fam ? (placed.length ? 'クリックで 3D から消す' : 'クリックで 3D に配置') : 'このカタログ項目は 3D ファミリ未対応（参照資料など）', onClick: () => { if (!fam || !editable) return; if (placed.length) { for (const i of placed) app.removeInstance(i.id); toast(`${p.name} を 3D から消しました`, 'info'); } else app.placeProduct(p, skus[skuSel] || null); renderList(); renderFoot(); } },
        h('div', { class: 'sr-sw', style: { background: placed.length ? 'var(--accent)' : fam ? 'var(--ok)' : 'var(--line)' } }), fam ? thumbEl(p, skus[skuSel]) : h('div', { class: 'sr-thumb na' }),
        h('div', { class: 'sr-info' }, h('div', { class: 'sr-name' }, p.name, placed.length ? h('span', { class: 'chip bad' }, placed.map(i => i.mark).join(' ')) : null), h('div', { class: 'sr-meta' }, `${p.pid} ・ 第${p.chapter}章 ${p.sub || ''} ・ ${fam ? fam.name : '未対応'} ・ ${p.finish || ''}${skus.length ? ` ・ ${skus.length} SKU` : ''}`), skus.length > 1 && fam ? h('select', { class: 'sr-sku', onClick: e => e.stopPropagation(), onChange: e => { state.skuSel.set(p.pid, +e.target.value); } }, ...skus.map((s, i) => h('option', { value: i, selected: i === skuSel }, s.sku + ' ' + Object.entries(s.dims || {}).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(' ')))) : null),
        h('div', { class: 'sr-act' }, fam ? h('span', { class: 'chip ' + (placed.length ? 'bad' : 'ghost') }, placed.length ? '表示中' : '＋ 3D へ') : h('span', { class: 'chip ghost' }, '—')));
      list.append(row); if (++n >= 200) break; }
    if (!n) list.append(h('div', { class: 'pp-empty' }, '該当する製品がありません'));
  }
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { const el = e.target; io.unobserve(el); thumbFor(el._p, el._sku, url => { if (url) { el.src = url; el.classList.add('ok'); } else el.classList.add('na'); }); } }, { root: list, rootMargin: '200px' }) : null;
  function thumbEl(p, sku) { const img = h('img', { class: 'sr-thumb', alt: '', title: '3D サムネイル' }); img._p = p; img._sku = sku || null; const hit = thumbCached(p, sku || null); if (hit) { img.src = hit; img.classList.add('ok', 'instant'); return img; } if (io) io.observe(img); else thumbFor(p, sku || null, url => { if (url) img.src = url; }); return img; }
  // 永続キャッシュ（IndexedDB）を読み込んだら差し替え、残りは空き時間に先回り生成（次回は全件即表示）
  loadThumbCache().then(n => { if (!document.body.contains(panel)) return; if (n) renderList(); const all = CATALOG.products.filter(p => p.kind !== '章扉解説' && p.category !== '参照資料' && familyById(p.family)).map(p => [p, (p.skus || [])[state.skuSel.get(p.pid) ?? 0] || null]); warmThumbs(all, { budgetMs: 20000 }); });
  function renderFoot() { const placed = app.model.instances.filter(i => i.source === 'catalog'); foot.innerHTML = ''; foot.append(h('span', { class: 'muted small' }, `展示中 ${placed.length} 体`), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onClick: () => { app.layoutShowroom(); toast('格子に並べ直しました', 'ok'); } }, '並べ直す'), h('button', { class: 'btn sm', disabled: placed.length < 2, title: '展示中の部材をまとめて選択（整列・配管へ取付・複製・削除）', onClick: () => { app.select(placed[0].id); for (const i of placed.slice(1)) app.multi.add(i.id); app.applyMultiVisual(); } }, 'まとめて選択'), h('button', { class: 'btn sm', onClick: () => { const g = placed.length ? app.groups.get(placed[placed.length - 1].id) : null; if (g) app.viewer.focusOn(g); app.viewer.fit(); } }, '全体表示'), h('button', { class: 'btn sm danger', disabled: !placed.length || !editable, onClick: async () => { if (!(await confirmDialog(`展示中の ${placed.length} 体を 3D から消しますか？（カタログから再配置できます）`))) return; for (const i of placed) app.removeInstance(i.id); renderList(); renderFoot(); } }, 'すべて消去')); }
  renderList(); renderFoot(); setTimeout(() => search.focus(), 50);
  app.showroomRefresh = () => { if (document.body.contains(panel)) { renderList(); renderFoot(); } };
}
