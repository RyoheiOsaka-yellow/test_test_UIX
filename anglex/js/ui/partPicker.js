// 部材えらび: サインイン後のどの画面からでも開ける。カタログの章・名前・サイズで探し、選んだものを 3D に置く。
// 3D の画面でないとき（v2 のモード選択・案件一覧・チャット）は、置くときに 3D の画面へ移る。
import { h, modal, toast } from './common.js';
import { CATALOG } from '../data/catalog.js';
import '../data/catalog_more.js';
import { familyById, FAMILIES } from '../bim/families.js';
import { addTypeFromProduct } from './catalog.js';
import { thumbFor, thumbCached, loadThumbCache } from './thumbs.js';

const CSS = `
.parts-fab{position:fixed;right:0;top:58%;z-index:60;display:flex;flex-direction:column;align-items:center;gap:6px;height:auto;width:auto;padding:13px 7px;border:1px solid rgba(0,0,0,.18);border-right:none;border-radius:10px 0 0 10px;background:var(--accent,#c8642a);color:#fff;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;box-shadow:-2px 3px 12px rgba(0,0,0,.22);transition:padding .15s,filter .15s}
.parts-fab .lb{writing-mode:vertical-rl;white-space:nowrap;letter-spacing:.14em;line-height:1.2}
.parts-fab:hover{padding-right:12px;filter:brightness(1.08)}
.parts-fab .n{display:inline-block;min-width:18px;padding:2px 4px;border-radius:9px;background:#fff;color:var(--accent,#c8642a);font-size:11px;text-align:center;letter-spacing:0}
.parts-fab .n:empty{display:none}
body[data-sm-view="signin"] .parts-fab{display:none}
.pk-wrap{display:grid;grid-template-columns:190px minmax(0,1fr) 300px;grid-template-rows:minmax(0,1fr);gap:12px;height:min(70vh,680px)}
.pk-side,.pk-mid,.pk-detail{min-height:0}
.pk-side{overflow:auto;display:flex;flex-direction:column;gap:2px;padding-right:4px}
.pk-ch{display:flex;justify-content:space-between;gap:6px;padding:6px 8px;border-radius:7px;border:none;background:none;color:inherit;font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.pk-ch:hover{background:rgba(127,127,127,.12)}.pk-ch.on{background:var(--accent,#c8642a);color:#fff}
.pk-ch .c{opacity:.7;font-size:11px}
.pk-mid{display:flex;flex-direction:column;min-width:0}
.pk-bar{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.pk-bar input[type=search]{flex:1;min-width:0}
.pk-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;align-content:start;padding:2px}
.pk-card{border:1px solid var(--line,#d8d5cc);border-radius:9px;background:var(--panel,#fff);padding:6px;cursor:pointer;display:flex;flex-direction:column;gap:4px;text-align:left;color:inherit;font:inherit;transition:transform .12s,box-shadow .12s,border-color .12s}
.pk-card:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.12)}
.pk-card.sel{border-color:var(--accent,#c8642a);box-shadow:0 0 0 2px rgba(200,100,42,.25)}
.pk-card.na{opacity:.5}
.pk-card img,.pk-card .ph{width:100%;aspect-ratio:3/2;object-fit:contain;border-radius:6px;background:linear-gradient(180deg,#f3f1ea,#e4e1d8)}
.pk-card .nm{font-size:12px;font-weight:600;line-height:1.3}
.pk-card .mt{font-size:10.5px;color:var(--muted,#888)}
.pk-detail{overflow:auto;border-left:1px solid var(--line,#ddd);padding-left:12px;display:flex;flex-direction:column;gap:8px}
.pk-detail img{width:100%;aspect-ratio:3/2;object-fit:contain;border-radius:8px;background:linear-gradient(180deg,#f3f1ea,#e4e1d8)}
.pk-detail h3{margin:0;font-size:15px}
.pk-detail select,.pk-detail input{width:100%}
.pk-dims{font-size:11.5px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px}
.pk-dims dt{color:var(--muted,#888)}.pk-dims dd{margin:0}
.pk-tray{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:30px}
.pk-tray .chip{cursor:pointer}
.pk-note{font-size:11px;color:var(--muted,#888)}
@media(max-width:900px){.pk-wrap{grid-template-columns:1fr;grid-template-rows:none;height:auto}.pk-side{flex-direction:row;flex-wrap:wrap}.pk-detail{border-left:none;padding-left:0;border-top:1px solid var(--line,#ddd);padding-top:10px}.pk-grid{max-height:44vh}}
`;
let cssDone = false; const ensureCss = () => { if (cssDone) return; cssDone = true; document.head.appendChild(h('style', { id: 'partPickerCss' }, CSS)); };
const usable = p => p.kind !== '章扉解説' && p.category !== '参照資料' && !!familyById(p.family);
const sizeLabel = s => s ? (s.dims?.['サイズ'] || s.dims?.['管径称'] || s.dims?.['管径称(VP)'] || s.dims?.['サイズ呼称'] || s.sku) : '';
export function libraryStats() { const ps = CATALOG.products.filter(usable); return { products: ps.length, skus: ps.reduce((a, p) => a + (p.skus?.length || 0), 0), families: FAMILIES.length, chapters: new Set(ps.map(p => p.chapter)).size }; }

export function initPartPicker(app) {
  ensureCss(); app.partTray = app.partTray || []; app.openPartPicker = opts => openPartPicker(app, opts);
  if (!document.getElementById('btnParts')) document.body.appendChild(h('button', { class: 'parts-fab', id: 'btnParts', title: '部材をカタログから選んで 3D に置く（どの画面からでも開けます）', onClick: () => openPartPicker(app) }, h('span', { class: 'lb' }, '部材を選ぶ'), h('span', { class: 'n', id: 'partsTrayN' })));
  // v2: いまの画面（サインイン・モード選択・案件一覧・チャット・3D）を body に持たせ、サインインの画面では隠す
  const sh = app.shell; if (sh && !sh._pkWrapped) { sh._pkWrapped = true; const orig = sh.showView; sh.showView = name => { document.body.dataset.smView = name; return orig(name); }; document.body.dataset.smView = sh.view || 'signin'; }
  document.addEventListener('keydown', e => { if (e.key !== 'b' && e.key !== 'B') return; if (e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return; if (document.body.dataset.smView === 'signin' || document.querySelector('.modal-back')) return; e.preventDefault(); openPartPicker(app); });
}
const trayBadge = app => { const n = document.getElementById('partsTrayN'); if (n) n.textContent = app.partTray.length ? String(app.partTray.reduce((a, t) => a + t.qty, 0)) : ''; };

// 選んだ部材を 3D に置く。3D の画面でなければ移ってから置く
export async function placeParts(app, items) {
  if (!items.length) return [];
  if (app.role() !== 'A') { toast('部材を置けるのは A社（設計）の役割だけです。右上の利用者を切り替えてください', 'warn'); return []; }
  const sh = app.shell; if (sh && sh.view !== 'app') { sh.showView('app'); sh.maxStep = Math.max(sh.maxStep, 5); sh.goStep(4); await new Promise(r => setTimeout(r, 60)); } else if (sh && sh.step !== 4) { sh.maxStep = Math.max(sh.maxStep, 5); sh.goStep(4); } else if (!sh && app.view !== '3d') app.setView('3d');
  const made = []; for (const it of items) for (let k = 0; k < it.qty; k++) { const inst = app.placeProduct(it.p, it.sku); if (inst) made.push(inst); }
  if (made.length) { app.shell?.unlockFor?.(); app.shell?.onModelChange?.(); try { app.viewer.resize?.(); const g = app.groups.get(made[made.length - 1].id); if (g) app.viewer.focusOn(g); } catch { } app.viewer.invalidate?.(2); toast(`${made.length} 点を 3D に置きました（${made.slice(0, 4).map(i => i.mark).join('、')}${made.length > 4 ? ' ほか' : ''}）`, 'ok'); }
  return made;
}

export function openPartPicker(app, { q = '', chapter = null, pid = null } = {}) {
  ensureCss(); if (document.querySelector('.modal.partpicker')) return null;
  const state = { q, ch: chapter, sel: null, sku: null, qty: 1, only3d: true }; const tray = app.partTray = app.partTray || [];
  const chapters = () => { const by = new Map(); for (const p of CATALOG.products) { if (state.only3d && !usable(p)) continue; const c = by.get(p.chapter) || { no: p.chapter, name: p.chapterName || '', n: 0 }; c.n++; by.set(p.chapter, c); } return [...by.values()].sort((a, b) => a.no - b.no); };
  const match = p => { if (state.only3d && !usable(p)) return false; if (state.ch != null && p.chapter !== state.ch) return false; if (!state.q) return true; const hay = [p.name, p.pid, p.code, p.sub, p.chapterName, familyById(p.family)?.name, p.notes, ...(p.skus || []).slice(0, 40).map(s => s.sku)].filter(Boolean).join(' ').toLowerCase(); return state.q.toLowerCase().split(/\s+/).every(w => hay.includes(w)); };
  const side = h('div', { class: 'pk-side' }), grid = h('div', { class: 'pk-grid' }), detail = h('div', { class: 'pk-detail' }), trayEl = h('div', { class: 'pk-tray' }), count = h('span', { class: 'pk-note' });
  const search = h('input', { type: 'search', placeholder: '名前・用途・サイズで探す（例: 立バンド 50A / ローラー / 防振）', value: state.q, onInput: e => { state.q = e.target.value.trim(); renderGrid(); } });
  const only = h('label', { class: 'pk-note', style: { display: 'flex', gap: '4px', alignItems: 'center', whiteSpace: 'nowrap' } }, h('input', { type: 'checkbox', checked: true, onChange: e => { state.only3d = e.target.checked; renderSide(); renderGrid(); } }), '3D にできるものだけ');
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { const el = e.target; io.unobserve(el); thumbFor(el._p, el._sku, url => { if (url) el.src = url; }); } }, { root: grid, rootMargin: '300px' }) : null;
  const thumb = (p, sku) => { if (!usable(p)) return h('div', { class: 'ph' }); const img = h('img', { alt: '', loading: 'lazy' }); img._p = p; img._sku = sku || null; const hit = thumbCached(p, sku || null); if (hit) img.src = hit; else if (io) io.observe(img); else thumbFor(p, sku || null, url => { if (url) img.src = url; }); return img; };
  function renderSide() { side.innerHTML = ''; const chs = chapters(); const total = chs.reduce((a, c) => a + c.n, 0); side.append(h('button', { class: 'pk-ch' + (state.ch == null ? ' on' : ''), onClick: () => { state.ch = null; renderSide(); renderGrid(); } }, h('span', {}, 'すべて'), h('span', { class: 'c' }, total))); for (const c of chs) side.append(h('button', { class: 'pk-ch' + (state.ch === c.no ? ' on' : ''), 'data-ch': c.no, onClick: () => { state.ch = c.no; renderSide(); renderGrid(); } }, h('span', {}, `${c.no} ${c.name}`), h('span', { class: 'c' }, c.n))); }
  function renderGrid() { grid.innerHTML = ''; const ps = CATALOG.products.filter(match); count.textContent = `${ps.length} 製品`; for (const p of ps.slice(0, 240)) { const ok = usable(p); const fam = familyById(p.family); grid.append(h('button', { class: 'pk-card' + (state.sel === p ? ' sel' : '') + (ok ? '' : ' na'), 'data-pid': p.pid, title: ok ? '' : 'この項目は 3D の型がありません', onClick: () => select(p) }, thumb(p, (p.skus || [])[0]), h('div', { class: 'nm' }, p.name), h('div', { class: 'mt' }, `${p.chapter} 章 ・ ${(p.skus || []).length || 1} サイズ${fam ? '' : ' ・ 3D なし'}`))); } if (!ps.length) grid.append(h('div', { class: 'pp-empty' }, '当てはまる部材がありません。言葉を変えるか、「すべて」を選んでください')); }
  function select(p) { state.sel = p; state.sku = (p.skus || [])[0] || null; state.qty = 1; grid.querySelectorAll('.pk-card').forEach(c => c.classList.toggle('sel', c.dataset.pid === p.pid)); renderDetail(); }
  function renderDetail() { detail.innerHTML = ''; const p = state.sel; if (!p) { detail.append(h('div', { class: 'pp-empty' }, '左の一覧から部材を選ぶと、サイズと寸法が出ます'), h('div', { class: 'pk-note' }, 'B キーでも、この画面を開けます')); return; } const fam = familyById(p.family); const ok = usable(p);
    const img = h('img', { alt: '' }); const setImg = () => { const hit = thumbCached(p, state.sku); if (hit) img.src = hit; else thumbFor(p, state.sku, url => { if (url && state.sel === p) img.src = url; }); }; if (ok) setImg();
    const dims = h('dl', { class: 'pk-dims' }); const drawDims = () => { dims.innerHTML = ''; if (!state.sku) return; for (const [k, v] of Object.entries(state.sku.dims || {}).slice(0, 14)) if (v !== null && v !== '') dims.append(h('dt', {}, k), h('dd', {}, String(v))); };
    const skuSel = (p.skus || []).length > 1 ? h('select', { 'data-k': 'sku', onChange: e => { state.sku = p.skus[+e.target.value]; drawDims(); if (ok) setImg(); } }, p.skus.map((s, i) => h('option', { value: i }, sizeLabel(s)))) : null; drawDims();
    detail.append(ok ? img : h('div', { class: 'pp-empty' }, '3D の型がありません'), h('h3', {}, p.name), h('div', { class: 'chips' }, h('span', { class: 'chip ghost' }, `${p.chapter} 章 ${p.chapterName || ''}`), fam ? h('span', { class: 'chip ghost' }, fam.name) : null, p.shapeGuess ? h('span', { class: 'chip warn', title: '寸法の数値は寸法表から取りましたが、寸法図は確認できていません。細かい形は推定です' }, '形は推定') : null, p.nameInferred ? h('span', { class: 'chip ghost' }, '名称推定') : null),
      p.notes ? h('div', { class: 'pk-note' }, p.notes) : null, skuSel ? h('label', { class: 'pk-note' }, `サイズ（${p.skus.length} 種類）`, skuSel) : null, dims,
      h('label', { class: 'pk-note' }, '数量', h('input', { type: 'number', min: 1, max: 50, value: 1, 'data-k': 'qty', onChange: e => { state.qty = Math.max(1, Math.min(50, +e.target.value || 1)); } })),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, h('button', { class: 'btn primary', disabled: !ok, 'data-act': 'place', onClick: async () => { const made = await placeParts(app, [{ p, sku: state.sku, qty: state.qty }]); if (made.length) m.close(); } }, '3D に置く'), h('button', { class: 'btn', disabled: !ok, 'data-act': 'add', onClick: () => { const hit = tray.find(t => t.p === p && t.sku === state.sku); if (hit) hit.qty += state.qty; else tray.push({ p, sku: state.sku, qty: state.qty }); renderTray(); toast(`「${p.name} ${sizeLabel(state.sku)}」をリストに入れました`, 'info', 1600); } }, 'リストに入れる'))); }
  function renderTray() { trayEl.innerHTML = ''; trayBadge(app); if (!tray.length) { trayEl.append(h('span', { class: 'pk-note' }, 'リストは空です。複数の部材をまとめて置きたいときは「リストに入れる」を使います')); return; } trayEl.append(h('span', { class: 'pk-note' }, 'リスト:'), ...tray.map((t, i) => h('span', { class: 'chip', title: 'クリックで外す', onClick: () => { tray.splice(i, 1); renderTray(); } }, `${t.p.name} ${sizeLabel(t.sku)} ×${t.qty} ✕`)), h('button', { class: 'btn sm primary', 'data-act': 'place-all', onClick: async () => { const made = await placeParts(app, [...tray]); if (made.length) { tray.length = 0; trayBadge(app); m.close(); } } }, `まとめて 3D に置く（${tray.reduce((a, t) => a + t.qty, 0)}）`), h('button', { class: 'btn sm', onClick: () => { tray.length = 0; renderTray(); } }, '空にする')); }
  const st = libraryStats();
  const m = modal({ title: `部材を選ぶ（${st.products} 製品 ・ ${st.skus} サイズ ・ 3D の型 ${st.families} 種類）`, wide: true, cls: 'partpicker', body: h('div', {}, h('div', { class: 'pk-wrap' }, side, h('div', { class: 'pk-mid' }, h('div', { class: 'pk-bar' }, search, only, count), grid), detail), h('div', { style: { marginTop: '10px' } }, trayEl)), onClose: () => { io?.disconnect(); trayBadge(app); } });
  renderSide(); renderGrid(); renderDetail(); renderTray(); loadThumbCache().then(() => { if (document.body.contains(grid)) renderGrid(); }); setTimeout(() => search.focus(), 60);
  if (pid) { const p = CATALOG.products.find(x => x.pid === pid); if (p) select(p); }
  return m;
}
