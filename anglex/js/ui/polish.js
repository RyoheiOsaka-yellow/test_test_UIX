// 操作の手触りをそろえる: ボタンの反応（押した感じ・キーボードの枠・処理中の表示）、すぐ出るツールチップ、コマンド検索（Ctrl / ⌘ + K）、
// リボンの横スクロール（ホイール・左右の送りボタン）、入力欄の誤操作防止。v1・v2 の両方の画面と、単一 HTML 版で同じように効くよう、スタイルもここから入れる。
import { h, toast } from './common.js';

const CSS = `
.btn,.rbtn,.tbtn,.q-btn,.icon-btn,.fmt-card,.tab,.rtab,.chip,.pin-row,.cmdk-row{transition:background-color .12s ease,border-color .12s ease,box-shadow .12s ease,color .12s ease,transform .08s ease,opacity .12s ease}
.btn:hover:not(:disabled),.fmt-card:hover{box-shadow:0 1px 4px rgba(0,0,0,.10)}
.btn:active:not(:disabled),.rbtn:active:not(:disabled),.tbtn:active:not(:disabled),.q-btn:active:not(:disabled),.icon-btn:active:not(:disabled),.fmt-card:active{transform:translateY(1px) scale(.985)}
.btn:focus-visible,.rbtn:focus-visible,.tbtn:focus-visible,.q-btn:focus-visible,.icon-btn:focus-visible,.fmt-card:focus-visible,.tab:focus-visible,.cmdk-open:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--accent,#b34a2a);outline-offset:2px}
.btn:disabled,.rbtn:disabled,.tbtn:disabled,.q-btn:disabled{opacity:.45;cursor:not-allowed}
.btn.primary:hover:not(:disabled){filter:brightness(1.06)}
.is-busy{position:relative;pointer-events:none;opacity:.75}
.is-busy::after{content:'';position:absolute;right:8px;top:50%;width:12px;height:12px;margin-top:-7px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:anx-spin .7s linear infinite}
.btn.is-busy,.fmt-card.is-busy{padding-right:28px}
@keyframes anx-spin{to{transform:rotate(360deg)}}
@keyframes anx-pop{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}
@keyframes anx-drop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.modal{animation:anx-pop .16s cubic-bezier(.2,.8,.3,1)}
.ctx-bar,.pin-pop,.vm-pop,.ctx-pop,.tpop.on,.tpop.show,.cmdk{animation:anx-drop .13s ease-out}
.modal-body,.pin-pop,.side,.pp-body{scroll-behavior:smooth}
#pinCnt.has-new{background:#c0392b;color:#fff;border-radius:9px;padding:0 6px}
button.has-new{box-shadow:inset 0 -2px 0 #c0392b}
.anx-tip{position:fixed;z-index:400;max-width:320px;background:#13130f;color:#f5f3ec;font-size:12px;line-height:1.5;padding:6px 9px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.28);pointer-events:none;opacity:0;transform:translateY(3px);transition:opacity .1s ease,transform .1s ease}
.anx-tip.show{opacity:1;transform:none}
.anx-tip kbd,.cmdk kbd{display:inline-block;font:600 11px/1.5 ui-monospace,monospace;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);border-radius:4px;padding:0 5px;margin-left:5px}
.cmdk-back{position:fixed;inset:0;z-index:300;background:rgba(19,19,15,.35);display:flex;justify-content:center;align-items:flex-start;padding-top:12vh;backdrop-filter:blur(2px)}
.cmdk{width:min(620px,92vw);background:var(--paper,#f5f3ec);border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
.cmdk input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line-soft,#d9d4c0);background:transparent;font:inherit;font-size:16px;padding:14px 16px;outline:none}
.cmdk-list{max-height:52vh;overflow:auto;padding:6px}
.cmdk-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:13.5px}
.cmdk-row.on{background:var(--accent-soft,#f3d7c8)}
.cmdk-row .g{font-size:11px;color:var(--ink-mute,#6f6f68);margin-left:auto;white-space:nowrap}
.cmdk-row .s{font-size:11.5px;color:var(--ink-mute,#6f6f68);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}
.cmdk kbd{background:#fff;border-color:var(--line,#c9c3ad);color:var(--ink,#1a1a17)}
.cmdk-foot{display:flex;gap:14px;padding:7px 14px;border-top:1px solid var(--line-soft,#d9d4c0);font-size:11.5px;color:var(--ink-mute,#6f6f68)}
.cmdk-open{margin-left:auto;display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-soft,#d9d4c0);background:var(--paper-card,#fbfaf5);color:var(--ink-mute,#6f6f68);border-radius:16px;padding:3px 12px;font:inherit;font-size:12px;cursor:pointer;align-self:center}
.cmdk-open:hover{border-color:var(--ink-mute,#6f6f68);color:var(--ink,#1a1a17)}
.cmdk-open kbd{font:600 10.5px/1.5 ui-monospace,monospace;border:1px solid var(--line,#c9c3ad);border-radius:4px;padding:0 4px;background:#fff}
.ribbon{min-width:0;max-width:100vw}.rscroll{position:relative;max-width:100vw;overflow:hidden}
.rscroll-btn{position:absolute;top:0;bottom:0;width:26px;border:0;cursor:pointer;z-index:3;font-size:15px;color:var(--ink,#1a1a17);display:none;align-items:center;justify-content:center}
.rscroll-btn.l{left:0;background:linear-gradient(90deg,var(--paper-card,#fbfaf5) 55%,transparent)}
.rscroll-btn.r{right:0;background:linear-gradient(270deg,var(--paper-card,#fbfaf5) 55%,transparent)}
.rscroll.can-l .rscroll-btn.l,.rscroll.can-r .rscroll-btn.r{display:flex}
.rpanel{scroll-behavior:smooth;scrollbar-width:none}.rpanel::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion:reduce){.modal,.ctx-bar,.pin-pop,.vm-pop,.ctx-pop,.tpop,.cmdk{animation:none}.btn,.rbtn,.tbtn,.q-btn,.icon-btn,.fmt-card,.anx-tip{transition:none}.rpanel,.modal-body{scroll-behavior:auto}}
`;
// 処理が終わるまでボタンを「処理中」にする（二度押しを防ぎ、動いていることが分かる）
export async function busy(el, fn) { if (!el || el.classList.contains('is-busy')) return typeof fn === 'function' ? fn() : fn; el.classList.add('is-busy'); el.setAttribute('aria-busy', 'true'); try { await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); return await (typeof fn === 'function' ? fn() : fn); } finally { el.classList.remove('is-busy'); el.removeAttribute('aria-busy'); } }

// ---- ツールチップ: title をすぐ（0.3 秒）出す。括弧つきのキー（例: (C)、(Ctrl+Z)）はキーの形で表示
function initTips() { let tip = null, timer = null, cur = null; const hide = () => { clearTimeout(timer); if (cur && cur.dataset.anxTitle != null) { cur.setAttribute('title', cur.dataset.anxTitle); delete cur.dataset.anxTitle; } cur = null; tip?.classList.remove('show'); };
  const show = el => { const text = el.dataset.anxTitle; if (!text) return; tip = tip || document.body.appendChild(h('div', { class: 'anx-tip', role: 'tooltip' })); tip.innerHTML = ''; const m = text.match(/^(.*?)[\s　]*[（(]((?:Ctrl|Shift|Alt|⌘)?\+?[A-Za-z0-9←→?\/]{1,6}(?:\s*\/\s*[A-Za-z0-9+←→]{1,10})*)[）)](.*)$/); if (m && m[2].length <= 12) { tip.append(m[1] + m[3]); for (const k of m[2].split('/')) tip.append(h('kbd', {}, k.trim())); } else tip.textContent = text;
    const r = el.getBoundingClientRect(); tip.style.left = '0px'; tip.style.top = '0px'; const tw = tip.offsetWidth, th = tip.offsetHeight; let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8; if (y + th > innerHeight - 6) y = r.top - th - 8; x = Math.max(6, Math.min(innerWidth - tw - 6, x)); tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('show'); };
  document.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const el = e.target.closest?.('button[title],a[title],[data-tip][title],.chip[title],select[title],.v-label[title]'); if (!el || el === cur) return; hide(); const t = el.getAttribute('title'); if (!t) return; cur = el; el.dataset.anxTitle = t; el.removeAttribute('title'); timer = setTimeout(() => show(el), 300); }, true);
  document.addEventListener('pointerout', e => { if (cur && !cur.contains(e.relatedTarget)) hide(); }, true); for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, hide, true); window.addEventListener('blur', e => { if (e.target === window) hide(); }); /* ウィンドウを離れたときだけ（部品のフォーカス移動では消さない） */ }

// ---- コマンド検索（Ctrl / ⌘ + K）: 画面のボタンと、よく使う操作を名前で探して実行する
const RECENT_KEY = 'anglex.cmdk.recent';
function collect(app, extra) { const seen = new Set(); const out = []; for (const b of document.querySelectorAll('button[id]')) { if (!/^btn/.test(b.id) || b.id === 'btnCmdk' || seen.has(b.id)) continue; const label = (b.textContent || '').replace(/\s+/g, ' ').replace(/[▾▸]/g, '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s*[\d/✓]+$/, '').trim() || (b.getAttribute('title') || b.dataset.anxTitle || '').split(/[（(。:：]/)[0].trim(); if (!label || label.length > 40) continue; seen.add(b.id); const group = b.closest('.rgroup')?.querySelector('.rgroup-title')?.textContent || b.closest('.tmenu')?.querySelector('[data-menu]')?.textContent?.replace(/[▾\s]/g, '') || ''; out.push({ id: b.id, label, sub: (b.getAttribute('title') || b.dataset.anxTitle || '').slice(0, 70), group, disabled: b.disabled, run: () => b.click() }); }
  for (const x of extra) out.push({ ...x, id: 'x:' + x.label }); return out; }
export function openCommandPalette(app) { if (document.querySelector('.cmdk-back')) return null; const extra = [
    { label: '線から組む（3D で線を引く）', group: '配置', sub: '3D の中をクリックして基準線を引く', run: () => import('./wireDraw.js').then(x => x.startWireDraw(app)) },
    { label: '検査記録シート PDF', group: '帳票', sub: '寸法・穴・溶接・表面処理・ミルシート台帳', run: () => import('./inspection.js').then(x => x.exportInspectionPDF(app)) },
    { label: '検査記録シート Excel', group: '帳票', sub: '実測値を入力して返してもらう', run: () => import('./inspection.js').then(x => x.exportInspectionXLSX(app)) },
    { label: '強度計算', group: '確認', sub: '配管の重さと地震の力で、部材・アンカー・ボルト・溶接を照査（参考値）', run: () => import('./strength.js').then(x => x.openStrength(app)) },
    { label: '計算書と比べる（強度計算）', group: '確認', sub: '手計算や社内の計算書の検定比を読み込んで、1 行ずつ比べる。ダミーでも試せる', run: () => import('./strength.js').then(x => x.openCompare(app)) },
    { label: '強度計算の条件', group: '設定', sub: '耐震クラス・設置階・配管の中身・支持間隔・許容値（この案件）', run: () => import('./strength.js').then(x => x.strengthSettingsDialog(app)) },
    { label: '強度計算書を書き出す（PDF）', group: '書き出し', sub: '条件・荷重・部材と接合の照査・支持点の反力', run: () => import('./strength.js').then(x => x.exportStrengthPdf(app)) },
    { label: '検査の許容差', group: '設定', sub: '長さ・穴位置・穴径・溶接脚長の許容差（この案件）', run: () => import('./inspection.js').then(x => x.tolerancesDialog(app)) },
    { label: 'コメントを書き出す（ファイル）', group: 'コメント', sub: 'コメントだけを相手に渡す', run: () => import('./pins.js').then(x => x.exportPinsJSON(app)) },
    { label: 'ピンを立てる', group: 'コメント', sub: '3D の部材や図面の位置にコメントを付ける', run: () => import('./pins.js').then(x => x.startPinTool(app)) },
    { label: 'すべての形式で書出し…', group: '書出し', sub: 'IFC・DXF・NC・帳票など', run: () => import('./formats.js').then(x => x.openFormats(app, 'export')) }];
  const all = collect(app, extra); let recent = []; try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { } let rows = [], idx = 0;
  const inp = h('input', { placeholder: 'やりたいことを入力（例: 穴、見積、IFC、コメント、線）', 'aria-label': 'コマンド検索' }); const list = h('div', { class: 'cmdk-list', role: 'listbox' }); const back = h('div', { class: 'cmdk-back' }, h('div', { class: 'cmdk', onClick: e => e.stopPropagation() }, inp, list, h('div', { class: 'cmdk-foot' }, h('span', {}, '↑↓ 選ぶ'), h('span', {}, 'Enter 実行'), h('span', {}, 'Esc 閉じる'))));
  const close = () => back.remove(); const run = c => { if (!c || c.disabled) return; close(); recent = [c.id, ...recent.filter(x => x !== c.id)].slice(0, 8); try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch { } try { c.run(); } catch (e) { toast('実行できませんでした: ' + e.message, 'bad'); } };
  const norm = s => String(s).toLowerCase().replace(/[\s　]/g, '').replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)); const render = () => { const q = norm(inp.value); const score = c => { if (!q) { const r = recent.indexOf(c.id); return r >= 0 ? 100 - r : 1; } const L = norm(c.label), S = norm(c.sub + c.group); if (L.startsWith(q)) return 90; if (L.includes(q)) return 70; if (S.includes(q)) return 40; let i = 0; for (const ch of L) if (ch === q[i]) i++; return i === q.length ? 20 : 0; };
    rows = all.map(c => ({ c, s: score(c) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.c); idx = Math.min(idx, Math.max(0, rows.length - 1)); list.innerHTML = ''; if (!rows.length) list.append(h('div', { class: 'cmdk-row', style: { color: '#888' } }, '見つかりません')); rows.forEach((c, i) => list.append(h('div', { class: 'cmdk-row' + (i === idx ? ' on' : ''), role: 'option', 'data-cmd': c.id, style: { opacity: c.disabled ? .45 : 1 }, onClick: () => run(c), onMouseMove: () => { if (idx !== i) { idx = i; list.querySelectorAll('.cmdk-row').forEach((r, k) => r.classList.toggle('on', k === i)); } } }, h('b', {}, c.label), c.sub ? h('span', { class: 's' }, c.sub) : null, h('span', { class: 'g' }, !inp.value && recent.includes(c.id) ? '最近使った' : c.group)))); list.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); };
  inp.addEventListener('input', () => { idx = 0; render(); }); inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(rows.length - 1, idx + 1); render(); } else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); render(); } else if (e.key === 'Enter') { e.preventDefault(); run(rows[idx]); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
  back.addEventListener('click', close); document.body.appendChild(back); render(); inp.focus(); return { close, count: all.length }; }

// ---- リボンの横スクロール: ホイールで横に送る。はみ出しているときだけ、左右に送りボタンを出す
function initRibbonScroll() { for (const p of document.querySelectorAll('.rpanel')) { if (p.parentElement.classList.contains('rscroll')) continue; const wrap = h('div', { class: 'rscroll' }); p.parentElement.insertBefore(wrap, p); wrap.appendChild(p); const mk = (cls, txt, dir) => h('button', { class: 'rscroll-btn ' + cls, tabindex: '-1', 'aria-label': dir < 0 ? '左へ' : '右へ', onClick: () => p.scrollBy({ left: dir * Math.max(240, p.clientWidth * 0.6), behavior: 'smooth' }) }, txt); wrap.append(mk('l', '‹', -1), mk('r', '›', 1));
    const upd = () => { wrap.classList.toggle('can-l', p.scrollLeft > 4); wrap.classList.toggle('can-r', p.scrollLeft + p.clientWidth < p.scrollWidth - 4); wrap.style.display = getComputedStyle(p).display === 'none' ? 'none' : ''; }; p.addEventListener('scroll', upd, { passive: true }); p.addEventListener('wheel', e => { if (p.scrollWidth <= p.clientWidth || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; e.preventDefault(); p.scrollLeft += e.deltaY; }, { passive: false }); new ResizeObserver(upd).observe(p); new MutationObserver(upd).observe(p, { attributes: true, attributeFilter: ['class'] }); upd(); } }

export function initPolish(app) { if (document.getElementById('anx-polish')) return; const st = document.createElement('style'); st.id = 'anx-polish'; st.textContent = CSS; document.head.appendChild(st); try { initTips(); } catch (e) { console.warn('tips', e); } try { initRibbonScroll(); } catch (e) { console.warn('ribbon', e); }
  // コマンド検索の入口（リボンのタブの右、または v2 のボタン列）と、キー
  const host = document.querySelector('.ribbon-tabs') || document.querySelector('#btnAlerts')?.parentElement; if (host && !document.getElementById('btnCmdk')) host.appendChild(h('button', { class: 'cmdk-open', id: 'btnCmdk', title: 'やりたいことを名前で探して実行します', onClick: () => openCommandPalette(app) }, '🔍 コマンド検索', h('kbd', {}, /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K')));
  window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopPropagation(); openCommandPalette(app); return; }
    // 入力ダイアログ: 1 行の入力欄で Enter を押すと、決定ボタンを押したことにする
    if (e.key === 'Enter' && !e.isComposing && e.target?.matches?.('.modal-body > .form input:not([type=checkbox]):not([type=file])')) { const m = e.target.closest('.modal'); const b = m?.querySelector('.modal-foot .btn.primary'); if (b && !b.disabled) { e.preventDefault(); b.click(); } } }, true);
  // 数値の入力欄の上でホイールを回しても、値が変わらないようにする
  document.addEventListener('wheel', e => { const a = document.activeElement; if (a && a.type === 'number' && a === e.target) a.blur(); }, { passive: true, capture: true }); }
