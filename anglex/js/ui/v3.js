// v3: 「空気のような」操作。画面いっぱいの 3D に、必要なときだけ道具が現れる。
// - 文字の帯（リボン・左右のパネル・状態行）は出さない。左右のパネルは引き出し（L / P）
// - 下の小さな道具箱（ドック）と、右下の「数字の札」（質量・金額）と「工場へ」だけを常に出す
// - 部材をクリックすると、その上に小さな輪（ハロー）と、つまめる点（寸法の取っ手）が出る。点をつまんで動かすと、その場で寸法が変わる
// - 見積と工場への送付は、下からせり上がる 1 枚の札で済ませる
// 同じエンジン（js/main.js の App）の上に重ねる。v1 の画面要素は隠すだけで、機能はすべて残る（コマンド検索から呼べる）
import * as THREE from 'three';
import { h, toast, download } from './common.js';
import { buildInstance } from '../bim/build.js';
import { estimateModel, yen } from '../bim/cost.js';
import * as OD from '../core/order.js';
import { loadFactories, orderNeed, ensureOrder } from './order.js';
import { openCommandPalette } from './polish.js';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { exportWeightXLSX, exportWorkOrderPDF, exportEstimatePDF } from './reports.js';
import { exportDXF } from './exports.js';
import { exportIFC4, exportNC1 } from './exportsMore.js';
import { ncOptions } from '../import/nc1.js';
import { exportInspectionXLSX } from './inspection.js';
import { createEstimate, openEstimate } from './estimate.js';
import { loadXLSX } from './pdfgen.js';

// ---------- 図像（線のアイコン。文字の代わり） ----------
const P = {
  plus: 'M12 5v14M5 12h14', cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5', wire: 'M4 19l5-12 5 9 6-11', import: 'M12 3v12M7 10l5 5 5-5M5 21h14', ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', more: 'M5 12h.01M12 12h.01M19 12h.01', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4', chat: 'M4 5h16v11H8l-4 4z', user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21c0-4 4-6 8-6s8 2 8 6',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4', undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3', move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  rotate: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5', copy: 'M8 8h12v12H8zM4 16V4h12', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7.5v.5', list: 'M4 6h16M4 12h16M4 18h10', x: 'M6 6l12 12M18 6 6 18',
  send: 'M3 11 21 3l-8 18-2-8z', check: 'M5 12l5 5 9-10', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', yen: 'M6 4l6 8 6-8M12 12v8M8 13h8M8 16h8',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', sheet: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16', file3d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5', nc: 'M4 18V6l8 12V6M15 6h5M15 12h4M15 18h5', clip: 'M9 4h6v3H9zM6 6h12v15H6zM9 12l2 2 4-4', draw: 'M4 20h16M6 16 16 6l2 2L8 18H6z',
  swap: 'M4 8h13l-3-3M20 16H7l3 3', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6', flow: 'M5 6a2 2 0 1 0 0 .01M19 18a2 2 0 1 0 0 .01M5 8v4a4 4 0 0 0 4 4h8', help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5', tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  cut: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6M8.5 7.5 20 19M8.5 16.5 20 5',
};
export function icon(name, size = 20) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('class', 'v3i'); s.innerHTML = `<path d="${P[name] || P.more}"/>`; return s; }

const CSS = `
body.v3{background:#eef0ee}
body.v3 .topbar,body.v3 .ribbon,body.v3 .statusbar,body.v3 #instrBox,body.v3 .focus-pill,body.v3 .minimap,body.v3 .parts-fab,body.v3 .ctx-bar{display:none!important}
body.v3 .app{display:block;height:100vh}
body.v3 main.main{position:fixed;inset:0;display:block}
body.v3 .stage{position:absolute;inset:0}
body.v3.v3-instr #instrBox{display:flex!important;position:fixed;left:50%;bottom:92px;transform:translateX(-50%);width:min(640px,calc(100vw - 32px));z-index:62;border-radius:14px;box-shadow:0 10px 30px rgba(20,24,28,.18)}
/* 引き出し: 左 = 部材の一覧、右 = 詳しい値 */
body.v3 .side{position:fixed!important;top:64px;bottom:100px;width:320px;z-index:58;border:1px solid rgba(20,24,28,.08)!important;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 18px 50px rgba(20,24,28,.16);transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .18s;overflow:hidden}
body.v3 .side.left{left:14px;transform:translateX(calc(-100% - 30px));opacity:0}
body.v3 .side.right{right:14px;transform:translateX(calc(100% + 30px));opacity:0;width:340px}
body.v3.v3-list .side.left,body.v3.v3-props .side.right{transform:none;opacity:1}
body.v3 .side-head{font-size:12px;letter-spacing:.06em;color:#6b7280;padding:12px 16px 6px;border:none;background:none}
.v3i{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.v3-glass{background:rgba(255,255,255,.88);border:1px solid rgba(20,24,28,.07);box-shadow:0 6px 22px rgba(20,24,28,.10),0 1px 2px rgba(20,24,28,.06);border-radius:999px}
.v3-btn{position:relative;display:inline-grid;place-items:center;width:42px;height:42px;border:none;border-radius:999px;background:transparent;color:#1f2933;cursor:pointer;transition:background .14s,color .14s,transform .12s}
.v3-btn:hover{background:rgba(20,24,28,.06)}.v3-btn:active{transform:scale(.94)}
.v3-btn.on{background:#1f2933;color:#fff}
.v3-btn .tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(4px);white-space:nowrap;font-size:11.5px;padding:4px 8px;border-radius:7px;background:#1f2933;color:#fff;opacity:0;pointer-events:none;transition:opacity .14s,transform .14s}
.v3-btn .tip kbd{font:inherit;opacity:.65;margin-left:6px}
.v3-btn:hover .tip{opacity:1;transform:translateX(-50%) translateY(0);transition-delay:.25s}
.v3-top .v3-btn .tip{bottom:auto;top:calc(100% + 8px)}
.v3-btn .badge{position:absolute;top:5px;right:5px;min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:var(--accent,#b34a2a);color:#fff;font:600 9.5px/15px var(--font);text-align:center}
.v3-btn .badge:empty{display:none}
.v3-dock{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:2px;padding:5px}
.v3-dock .sep{width:1px;height:22px;background:rgba(20,24,28,.1);margin:0 4px}
.v3-dock .v3-btn.lead{background:#1f2933;color:#fff;width:46px;height:46px}
.v3-dock .v3-btn.lead:hover{background:#0f171e}
.v3-tl{position:fixed;left:16px;top:14px;z-index:60;display:flex;align-items:center;gap:8px;padding:5px 14px 5px 6px;cursor:pointer}
.v3-tl .mk{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#1f2933;color:#fff;font:700 13px/1 var(--font);letter-spacing:.02em}
.v3-tl .nm{font-weight:600;font-size:13.5px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-tl .st{font-size:11px;color:#6b7280}
.v3-top{position:fixed;right:16px;top:14px;z-index:60;display:flex;gap:2px;padding:4px}
.v3-left-tab{position:fixed;left:14px;top:50%;transform:translateY(-50%);z-index:57;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:16px;cursor:pointer;color:#1f2933}
.v3-left-tab b{font:600 12px var(--font)}
body.v3.v3-list .v3-left-tab{opacity:0;pointer-events:none}
.v3-br{position:fixed;right:16px;bottom:22px;z-index:60;display:flex;gap:8px;align-items:center}
.v3-num{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 16px;cursor:pointer;font-variant-numeric:tabular-nums;transition:transform .12s}
.v3-num:hover{transform:translateY(-1px)}
.v3-num .kg{font-size:12px;color:#6b7280}.v3-num .yen{font:700 17px var(--font);letter-spacing:.01em;color:#1f2933}
.v3-num .bump{animation:v3bump .5s}
@keyframes v3bump{0%{color:var(--accent,#b34a2a);transform:scale(1.06)}100%{color:inherit;transform:none}}
.v3-pill{display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 16px 0 12px;border:none;cursor:pointer;font:600 13px var(--font);color:#fff;background:var(--accent,#b34a2a);border-radius:999px;box-shadow:0 8px 22px rgba(179,74,42,.32);transition:transform .12s,filter .12s}
.v3-pill:hover{filter:brightness(1.06);transform:translateY(-1px)}
.v3-ring{width:44px;height:44px;display:grid;place-items:center;cursor:pointer;position:relative}
.v3-ring svg.r{position:absolute;inset:3px}.v3-ring b{font:600 10.5px var(--font)}
/* 選んだ部材の上の輪 */
.v3-halo{position:fixed;z-index:59;display:flex;align-items:center;gap:2px;padding:4px 4px 4px 12px;transform:translate(-50%,-100%);transition:opacity .12s;white-space:nowrap}
.v3-halo .who{display:flex;flex-direction:column;line-height:1.15;margin-right:6px}
.v3-halo .who b{font:600 12.5px var(--font)}.v3-halo .who span{font-size:11px;color:#6b7280;font-variant-numeric:tabular-nums}
.v3-halo .v3-btn{width:36px;height:36px}
.v3-halo .v3-btn .tip{bottom:auto;top:calc(100% + 8px)}
/* 寸法の取っ手 */
.v3-hd{position:fixed;z-index:58;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,.45);cursor:grab;touch-action:none;transition:transform .12s,box-shadow .12s}
.v3-hd:hover,.v3-hd.drag{transform:scale(1.25);box-shadow:0 0 0 6px rgba(37,99,235,.18),0 2px 10px rgba(37,99,235,.5)}
.v3-hd.drag{cursor:grabbing}
.v3-hd i{position:absolute;left:50%;top:50%;width:18px;height:2px;background:#2563eb;transform-origin:0 50%;pointer-events:none;opacity:.8}
.v3-hd .lb{position:absolute;left:18px;top:-24px;white-space:nowrap;font:600 11.5px var(--font);color:#1e3a8a;background:rgba(255,255,255,.92);padding:2px 7px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.12);opacity:0;transition:opacity .12s;pointer-events:none}
.v3-hd:hover .lb,.v3-hd.drag .lb{opacity:1}
.v3-hd.drag .lb{font-size:14px;padding:4px 9px}
body.v3-dragging .v3-hd:not(.drag),body.v3-dragging .v3-halo{opacity:0;pointer-events:none}
.v3-hover-tag{position:fixed;z-index:57;pointer-events:none;font:600 11.5px var(--font);padding:3px 8px;border-radius:7px;background:rgba(31,41,51,.86);color:#fff;transform:translate(14px,14px);opacity:0;transition:opacity .1s}
/* せり上がる札（見積・工場へ） */
.v3-sheet-back{position:fixed;inset:0;z-index:70;background:rgba(20,24,28,.18);opacity:0;transition:opacity .18s}
.v3-sheet{position:fixed;left:50%;bottom:16px;z-index:71;width:min(760px,calc(100vw - 24px));max-height:min(78vh,760px);overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 80px rgba(20,24,28,.28);transform:translate(-50%,40px);opacity:0;transition:transform .24s cubic-bezier(.2,.8,.2,1),opacity .18s;padding:18px 22px 20px}
.v3-sheet.in,.v3-sheet-back.in{opacity:1}.v3-sheet.in{transform:translate(-50%,0)}
.v3-sheet .grab{width:40px;height:4px;border-radius:2px;background:#d1d5db;margin:-6px auto 10px}
.v3-sheet h2{font:600 13px var(--font);color:#6b7280;margin:0 0 4px;letter-spacing:.04em}
.v3-sheet .x{position:absolute;right:12px;top:12px}
.v3-big{font:700 38px/1.1 var(--font);letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:#111827}
.v3-sub{color:#6b7280;font-size:12.5px;margin-top:4px;display:flex;gap:14px;flex-wrap:wrap}
.v3-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;margin:14px 0 6px;background:#f3f4f6}
.v3-bar i{display:block;height:100%}
.v3-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:#4b5563}
.v3-legend span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:var(--c)}
.v3-slider{display:flex;align-items:center;gap:10px;margin:14px 0 4px;font-size:12.5px;color:#374151}
.v3-slider input{flex:1;accent-color:var(--accent,#b34a2a)}
.v3-rows{margin-top:10px;border-top:1px solid #f0f0f0}
.v3-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:9px 4px;border-bottom:1px solid #f3f3f3;font-size:13px;cursor:pointer;border-radius:8px}
.v3-row:hover{background:#f8fafc}
.v3-row .n{font-weight:600}.v3-row .m{font-size:11px;color:#9ca3af}
.v3-row .q{color:#6b7280;font-variant-numeric:tabular-nums}.v3-row .a{font-weight:600;font-variant-numeric:tabular-nums;min-width:92px;text-align:right}
.v3-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.v3-act{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 16px 0 12px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;font:600 13px var(--font);color:#1f2933;cursor:pointer;transition:background .12s,border-color .12s}
.v3-act:hover{background:#f9fafb;border-color:#d1d5db}
.v3-act.primary{background:#1f2933;color:#fff;border-color:#1f2933}.v3-act.primary:hover{background:#0f171e}
.v3-act.accent{background:var(--accent,#b34a2a);border-color:var(--accent,#b34a2a);color:#fff}
.v3-act[disabled]{opacity:.45;pointer-events:none}
.v3-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0 4px}
.v3-tile{display:flex;flex-direction:column;gap:4px;padding:11px 12px;border-radius:14px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;text-align:left;font:inherit;color:inherit;transition:border-color .12s,background .12s,transform .12s;position:relative}
.v3-tile:hover{transform:translateY(-1px)}
.v3-tile.on{border-color:#1f2933;background:#f8fafc}
.v3-tile.on::after{content:"";position:absolute;top:10px;right:10px;width:16px;height:16px;border-radius:50%;background:#1f2933 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5 9-10'/%3E%3C/svg%3E") center/11px no-repeat}
.v3-tile .t{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;padding-right:20px;flex-wrap:wrap}.v3-tile .s{font-size:11.5px;color:#6b7280;line-height:1.35}
.v3-tile.ng{opacity:.55}
.v3-field{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.v3-field label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:#6b7280;flex:1;min-width:160px}
.v3-field input{height:38px;border-radius:10px;border:1px solid #e5e7eb;padding:0 10px;font:inherit;font-size:13px}
.v3-sec{font:600 12px var(--font);color:#6b7280;margin:16px 0 2px;letter-spacing:.04em}
.v3-done{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:#ecfdf5;color:#065f46;margin-top:14px;font-size:13px}
.v3-done .ck{width:30px;height:30px;border-radius:50%;background:#10b981;color:#fff;display:grid;place-items:center;animation:v3pop .35s}
@keyframes v3pop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
.v3-msg{width:100%;min-height:120px;border-radius:12px;border:1px solid #e5e7eb;padding:10px;font:12.5px/1.6 var(--font);margin-top:8px;resize:vertical}
/* 何もないとき */
.v3-empty{position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);z-index:55;text-align:center}
.v3-empty h1{font:600 22px var(--font);margin:0 0 6px;color:#111827}.v3-empty p{color:#6b7280;margin:0 0 18px;font-size:13px}
.v3-empty .v3-tiles{grid-template-columns:repeat(3,170px)}
.v3-empty .v3-tile{align-items:center;text-align:center;padding:18px 12px}
.v3-hint{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:59;font-size:12.5px;padding:8px 14px 8px 12px;display:flex;align-items:center;gap:8px;color:#1f2933;cursor:pointer;animation:v3up .3s}
@keyframes v3up{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
.v3-pop{position:fixed;z-index:65;padding:6px;border-radius:16px;display:flex;flex-direction:column;gap:2px;min-width:200px}
.v3-pop button{display:flex;align-items:center;gap:10px;padding:9px 12px;border:none;background:none;border-radius:10px;font:500 13px var(--font);color:#1f2933;cursor:pointer;text-align:left}
.v3-pop button:hover{background:rgba(20,24,28,.06)}.v3-pop button.on{background:#1f2933;color:#fff}
.v3-pop .sep{height:1px;background:rgba(20,24,28,.08);margin:4px 6px}
@media(max-width:720px){.v3-dock .opt{display:none}.v3-tl .st{display:none}.v3-empty .v3-tiles{grid-template-columns:1fr}.v3-br .v3-pill span{display:none}}
`;

const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } } };
const fmtMM = v => (Math.round(v * 10) / 10).toLocaleString('ja-JP');
const btn = (name, tip, onClick, { key = null, cls = '', id = null } = {}) => h('button', { class: 'v3-btn ' + cls, id, 'aria-label': tip, onClick }, icon(name), h('span', { class: 'tip' }, tip, key ? h('kbd', {}, key) : null));
const click = id => () => document.getElementById(id)?.click();

export function initV3(app) {
  if (app.v3) return app.v3; document.body.classList.add('v3'); document.head.appendChild(h('style', { id: 'v3css' }, CSS));
  const V = app.v3 = { handles: [], drag: null, hover: null, sheet: null, margin: +LS.get('anglex.v3.margin', 15) };
  // 見どころ表示の自動回転は使わない（取っ手をつまむ前に動き出さないように）
  app.turntableOn = () => false; app.viewer.setTurntable?.(false);
  const v = app.viewer;

  // ---------- 左上: 案件 ----------
  const tl = h('div', { class: 'v3-tl v3-glass', id: 'v3Project', title: '案件のメニュー', onClick: e => projectMenu(app, e.currentTarget) }, h('div', { class: 'mk' }, 'A'), h('div', {}, h('div', { class: 'nm', id: 'v3ProjName' }, app.project.name), h('div', { class: 'st', id: 'v3ProjSt' }, '自動で保存')));
  // ---------- 右上: 探す・コメント・使い方・利用者 ----------
  const pinBtn = btn('chat', 'コメント', click('btnPins'), { key: 'K', id: 'v3Pins' }); pinBtn.append(h('span', { class: 'badge', id: 'v3PinN' }));
  const flagBtn = btn('flag', '確認すること（3D に旗を出す）', () => { setLabels(app, 'alerts', true); click('btnAlerts')(); }, { id: 'v3Flags' }); flagBtn.append(h('span', { class: 'badge', id: 'v3FlagN' }));
  const top = h('div', { class: 'v3-top v3-glass' }, btn('search', 'やりたいことを探す', () => openCommandPalette(app), { key: 'Ctrl K', id: 'v3Search' }), flagBtn, pinBtn, btn('help', '使い方', () => app.showShortcuts?.(), { key: '?' }), btn('user', '利用者と役割', () => app.userMenu()));
  // ---------- 下: 道具箱 ----------
  const dock = h('div', { class: 'v3-dock v3-glass', id: 'v3Dock' },
    btn('plus', '部材を足す', () => app.openPartPicker?.(), { key: 'B', cls: 'lead', id: 'v3Add' }),
    btn('wire', '線から組む', click('btnWire'), { id: 'v3Wire' }), btn('import', '図面・ファイルを読む', click('btnImport'), { id: 'v3Import' }), h('span', { class: 'sep' }),
    btn('ruler', '測る', click('btnMeasure'), { id: 'v3Measure' }), btn('eye', '見え方', e => viewMenu(app, e.currentTarget), { key: 'V', id: 'v3View' }), btn('draw', '言葉で指示', () => toggleInstr(), { key: '/', cls: 'opt', id: 'v3Instr' }), h('span', { class: 'sep opt' }),
    btn('undo', '元に戻す', click('btnUndo'), { key: 'Ctrl Z', cls: 'opt' }), btn('redo', 'やり直す', click('btnRedo'), { key: 'Ctrl Y', cls: 'opt' }), btn('more', 'ほかの機能', () => openCommandPalette(app), { id: 'v3More' }));
  // ---------- 右下: 数字の札・案件の進み・工場へ ----------
  const num = h('div', { class: 'v3-num v3-glass', id: 'v3Num', title: '見積を見る (E)', onClick: () => openEstimateSheet(app) }, h('span', { class: 'kg', id: 'v3Kg' }, '— kg'), h('span', { class: 'yen', id: 'v3Yen' }, '¥—'), h('span', { class: 'v3-btn', style: { width: '30px', height: '30px' } }, icon('yen', 16)));
  const ring = h('div', { class: 'v3-ring v3-glass', id: 'v3Ring', title: '案件の進み（依頼から納品まで）', onClick: () => app.openOrder?.() });
  const send = h('button', { class: 'v3-pill', id: 'v3Send', title: '工場へ送る (T)', onClick: () => openFactorySheet(app) }, icon('truck', 18), h('span', {}, '工場へ'));
  const br = h('div', { class: 'v3-br' }, ring, num, send);
  // ---------- 左: 部材の一覧のつまみ ----------
  const ltab = h('div', { class: 'v3-left-tab v3-glass', id: 'v3ListTab', title: '部材の一覧 (L)', onClick: () => toggle('v3-list') }, icon('list', 18), h('b', { id: 'v3Count' }, '0'));
  const hoverTag = h('div', { class: 'v3-hover-tag' });
  document.body.append(tl, top, dock, br, ltab, hoverTag);
  // 左右の引き出しに閉じるボタン
  for (const [sel, cls] of [['.side.left', 'v3-list'], ['.side.right', 'v3-props']]) { const head = document.querySelector(sel + ' .side-head'); if (head && !head.querySelector('.v3-btn')) { head.style.display = 'flex'; head.style.alignItems = 'center'; head.append(h('span', { style: { flex: 1 } }), btn('x', '閉じる', () => document.body.classList.remove(cls))); } }
  const toggle = cls => { document.body.classList.toggle(cls); v.invalidate?.(1, true); };
  const toggleInstr = () => { document.body.classList.toggle('v3-instr'); if (document.body.classList.contains('v3-instr')) setTimeout(() => document.getElementById('instrInput')?.focus(), 50); };
  V.toggle = toggle;

  // ---------- 選択 → 輪と取っ手 ----------
  const halo = h('div', { class: 'v3-halo v3-glass', id: 'v3Halo', style: { display: 'none' } });
  document.body.append(halo); V.halo = halo;
  const origSelect = app.select.bind(app);
  app.select = (id, opts) => { const r = origSelect(id, opts); try { onSelect(app, id); } catch (e) { console.warn('v3 select', e); } return r; };
  // 数字の札（モデルが変わるたび）
  const origStatus = app.updateStatus.bind(app); let numT = 0;
  app.updateStatus = (...a) => { const r = origStatus(...a); clearTimeout(numT); numT = setTimeout(() => refreshNumbers(app), 120); return r; };
  // 描くたびに輪・取っ手・ホバーの位置を合わせる（止まっているときは何もしない）
  // 案件を開き直したとき（モデルが入れ替わる）も、数字・空のときの案内・輪を合わせる
  const origAll = app.refreshAll.bind(app); app.refreshAll = (...a) => { const r = origAll(...a); try { refreshNumbers(app); onSelect(app, app.selection); } catch { } return r; };
  const origRender = v.render.bind(v); v.render = (...a) => { const r = origRender(...a); try { syncOverlays(app); } catch { } return r; };
  // ホバー: 触れそうな部材をうっすら囲む
  const canvas = v.renderer.domElement; let hvT = 0, lastEv = null;
  canvas.addEventListener('pointermove', e => { lastEv = e; if (hvT) return; hvT = requestAnimationFrame(() => { hvT = 0; hoverAt(app, lastEv, hoverTag); }); });
  canvas.addEventListener('pointerleave', () => { setHover(app, null); hoverTag.style.opacity = 0; });
  canvas.addEventListener('pointerdown', () => { hoverTag.style.opacity = 0; });
  // キー
  document.addEventListener('keydown', e => { const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey) return; if (document.querySelector('.modal-back,.cmdk-back')) return;
    const k = e.key.toLowerCase(); if (k === 'e') { e.preventDefault(); openEstimateSheet(app); } else if (k === 't') { e.preventDefault(); openFactorySheet(app); } else if (k === 'l') { e.preventDefault(); toggle('v3-list'); } else if (k === 'p') { e.preventDefault(); toggle('v3-props'); } else if (k === 'v') { e.preventDefault(); viewMenu(app, document.getElementById('v3View')); } else if (e.key === 'Escape' && V.sheet) { e.preventDefault(); closeSheet(app); } });
  // 何もないときの案内と、はじめの一言
  // 3D の中の文字の札（符号・高さの線・溶接記号・確認の旗）は既定で隠す。「見え方」から出せる
  setLabels(app, 'all', LS.get('anglex.v3.labels', '0') === '1', false);
  refreshNumbers(app); onSelect(app, app.selection); hint(app);
  return V;
}

// ---------- 案件のメニュー・見え方のメニュー ----------
function popover(anchor, items, { up = false } = {}) { document.querySelector('.v3-pop')?.remove(); const box = h('div', { class: 'v3-pop v3-glass' }, items.map(it => it === '-' ? h('div', { class: 'sep' }) : h('button', { class: it.on ? 'on' : '', onClick: () => { box.remove(); it.run(); } }, icon(it.icon || 'more', 18), it.label))); document.body.append(box); const r = anchor.getBoundingClientRect(); const bw = box.offsetWidth, bh = box.offsetHeight; box.style.left = Math.max(8, Math.min(innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + 'px'; box.style.top = (up || r.top > innerHeight / 2 ? r.top - bh - 10 : r.bottom + 10) + 'px'; setTimeout(() => { const off = e => { if (!box.contains(e.target)) { box.remove(); removeEventListener('pointerdown', off, true); } }; addEventListener('pointerdown', off, true); }, 0); return box; }
function projectMenu(app, anchor) { popover(anchor, [{ icon: 'plus', label: '新しい案件', run: click('btnNew') }, { icon: 'list', label: '案件を開く', run: click('btnOpen') }, { icon: 'draw', label: '名前を変える', run: click('btnRename') }, '-', { icon: 'flow', label: '案件の進み（依頼から納品）', run: () => app.openOrder?.() }, { icon: 'layers', label: '案件の一覧（ダッシュボード）', run: click('btnDashboard') }, { icon: 'doc', label: '書き出し（21 形式）', run: click('btnFormats') }, '-', { icon: 'swap', label: 'v2 の画面で開く', run: () => app.switchUI('v2') }, { icon: 'swap', label: 'v1 の画面で開く', run: () => app.switchUI('v1') }]); }
function viewMenu(app, anchor) { const s = app.viewer.displayStyle; const set = st => { const sel = document.querySelector('#selStyle'); if (sel) { sel.value = st; sel.dispatchEvent(new Event('change')); } else app.viewer.setDisplayStyle(st); }; popover(anchor, [{ icon: 'cube', label: '本物らしく（材質）', on: s === 'realistic', run: () => set('realistic') }, { icon: 'eye', label: '形を見やすく（線あり）', on: s === 'shaded-edges', run: () => set('shaded-edges') }, { icon: 'layers', label: '透かす', on: s === 'ghost', run: () => set('ghost') }, '-', { icon: 'tag', label: LS.get('anglex.v3.labels', '0') === '1' ? '文字の札を隠す' : '文字の札を出す（符号・高さ・溶接・旗）', run: () => setLabels(app, 'all', LS.get('anglex.v3.labels', '0') !== '1') }, { icon: 'cut', label: '断面で切る', run: click('btnSection') }, { icon: 'move', label: '分解して見る', run: click('btnExplodeView') }, { icon: 'search', label: '全体を見る', run: click('btnFit') }], { up: true }); }

// 3D の中の文字の札: 'all' = 符号・高さの線・溶接記号・確認の旗、'alerts' = 確認の旗だけ
function setLabels(app, which, on, remember = true) { const ids = which === 'alerts' ? ['chkAlerts'] : ['chkTags', 'chkLevels', 'chkWeldSym', 'chkAlerts']; for (const id of ids) { const el = document.getElementById(id); if (el && el.checked !== on) { el.checked = on; el.dispatchEvent(new Event('change', { bubbles: true })); } } if (remember && which === 'all') LS.set('anglex.v3.labels', on ? '1' : '0'); app.viewer.invalidate?.(); }

// ---------- 数字の札 ----------
export function estimateNow(app) { if (!app.model.instances.length) return null; try { const em = estimateModel(app.model, app.rates()); return { ...em, withMargin: Math.round(em.subtotal * (1 + (app.v3?.margin || 0) / 100)) }; } catch (e) { console.warn('estimate', e); return null; } }
function refreshNumbers(app) {
  const em = estimateNow(app); const kg = document.getElementById('v3Kg'), yn = document.getElementById('v3Yen'); const n = app.model.instances.length;
  if (kg) kg.textContent = em ? `${em.totalMass.toLocaleString('ja-JP', { maximumFractionDigits: 1 })} kg` : '— kg';
  if (yn) { const t = em ? yen(em.withMargin) : '¥—'; if (yn.textContent !== t) { yn.textContent = t; yn.classList.remove('bump'); void yn.offsetWidth; yn.classList.add('bump'); } }
  const c = document.getElementById('v3Count'); if (c) c.textContent = String(n); const fl = document.getElementById('v3FlagN'); if (fl) { let k = 0; try { k = app.openReviewCount(); } catch { } fl.textContent = k ? String(k) : ''; } const pn = document.getElementById('v3PinN'); if (pn) pn.textContent = (document.getElementById('pinCnt')?.textContent || '').replace(/[^\d]/g, '');
  const nm = document.getElementById('v3ProjName'); if (nm) nm.textContent = app.project.name;
  const ring = document.getElementById('v3Ring'); if (ring) { const o = app.project.order; const p = o ? OD.progress(o) : null; const cur = o ? OD.currentStage(o) : null; const late = o ? OD.lateStages(o).length : 0; const C = 2 * Math.PI * 17; ring.innerHTML = `<svg class="r" viewBox="0 0 38 38"><circle cx="19" cy="19" r="17" fill="none" stroke="#e5e7eb" stroke-width="3"/><circle cx="19" cy="19" r="17" fill="none" stroke="${late ? '#c0392b' : '#1f2933'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (p ? p.pct / 100 : 0))}" transform="rotate(-90 19 19)"/></svg><b>${o ? (cur ? OD.STAGES.indexOf(cur) + 1 : '✓') : '案件'}</b>`; ring.title = o ? `案件の進み: ${cur ? cur.name : '完了'}（${p.done}/${p.total}）${late ? ` ・ 期限を過ぎた段階 ${late}` : ''}` : '案件の進み（依頼から納品まで）を始める'; }
  showEmpty(app, n === 0); if (app.v3?.sheet?.kind === 'estimate') app.v3.sheet.render();
}
function showEmpty(app, on) { let el = document.getElementById('v3Empty'); if (!on) { el?.remove(); return; } if (el) return; el = h('div', { class: 'v3-empty', id: 'v3Empty' }, h('h1', {}, '何を作りますか'), h('p', {}, '部材を選ぶか、図面を読み込むと、ここに 3D が現れます'), h('div', { class: 'v3-tiles' }, h('button', { class: 'v3-tile', onClick: () => app.openPartPicker?.() }, icon('plus', 26), h('span', { class: 't' }, '部材を選ぶ'), h('span', { class: 's' }, '203 製品から')), h('button', { class: 'v3-tile', onClick: click('btnImport') }, icon('import', 26), h('span', { class: 't' }, '図面を読む'), h('span', { class: 's' }, 'DXF・PDF・IFC ほか')), h('button', { class: 'v3-tile', onClick: click('btnDemoModel') }, icon('cube', 26), h('span', { class: 't' }, 'サンプルを開く'), h('span', { class: 's' }, '配管サポート一式')))); document.body.append(el); }
function hint(app) { const step = +LS.get('anglex.v3.hint', 0); const tips = ['部材をクリックすると、青い点が出ます。点をつまんで動かすと、その場で寸法が変わります', '右下の金額をクリックすると、見積が開きます。「工場へ」で資料をまとめて送れます', 'やりたいことは、右上の虫めがね（Ctrl + K）から名前で探せます']; if (step >= tips.length) return; const el = h('div', { class: 'v3-hint v3-glass', id: 'v3Hint', onClick: () => { el.remove(); LS.set('anglex.v3.hint', step + 1); setTimeout(() => hint(app), 400); } }, icon('spark', 16), tips[step], h('span', { style: { color: '#9ca3af', marginLeft: '6px' } }, 'わかった')); document.getElementById('v3Hint')?.remove(); document.body.append(el); }

// ---------- 選択: 輪と寸法の取っ手 ----------
const tmpV = new THREE.Vector3();
function project(app, p) { const v = app.viewer; const r = v.renderer.domElement.getBoundingClientRect(); tmpV.copy(p).project(v.activeCamera); return { x: r.left + (tmpV.x + 1) / 2 * r.width, y: r.top + (1 - tmpV.y) / 2 * r.height, behind: tmpV.z > 1 }; }
function onSelect(app, id) {
  const V = app.v3; if (!V || V.drag) return; for (const hd of V.handles) hd.el.remove(); V.handles = []; V.selId = id || null; V.probeSeq = (V.probeSeq || 0) + 1; const halo = V.halo;
  if (!id) { halo.style.display = 'none'; return; }
  const inst = app.model.getInstance(id); if (!inst) { halo.style.display = 'none'; return; }
  const fam = app.model.familyOf(inst); const t = app.model.getType(inst.typeId); let kg = 0, price = 0; try { const em = estimateModel({ instances: [inst], joints: [], getType: x => app.model.getType(x), familyOf: x => app.model.familyOf(x), resolved: x => app.model.resolved(x), getInstance: x => app.model.getInstance(x) }, app.rates()); kg = em.totalMass; price = em.lines[0]?.unitCost || 0; } catch { }
  const editable = app.role() === 'A';
  halo.innerHTML = ''; const spec = (t?.name || '').replace(fam.name, '').replace(/^[\s（(]+|[）)]+$/g, '').trim(); halo.append(h('div', { class: 'who', title: t?.name || '' }, h('b', {}, `${inst.mark}  ${fam.name.replace(/（.*?）/g, '')}`.slice(0, 30)), h('span', {}, [spec.slice(0, 24), `${kg.toLocaleString('ja-JP', { maximumFractionDigits: 1 })} kg`, yen(price)].filter(Boolean).join(' ・ '))),
    editable ? btn('move', '動かす', () => app.setGizmo('translate'), { key: 'G' }) : null, editable ? btn('rotate', '90° 回す', () => rotate90(app, inst.id), { key: 'R' }) : null, editable ? btn('copy', '複製', click('btnDup')) : null, editable ? btn('link', 'つなぐ（溶接・ボルト）', click('btnJoint')) : null,
    btn('info', '詳しい値', () => { document.body.classList.add('v3-props'); app.viewer.invalidate?.(1, true); }, { key: 'P' }), editable ? btn('trash', '消す', click('btnDelete'), { key: 'Del' }) : null);
  halo.style.display = 'flex'; syncOverlays(app);
  if (editable) probeHandles(app, inst, V.probeSeq);
}
function rotate90(app, id) { const inst = app.model.getInstance(id); if (!inst) return; const rot = [...(inst.rot || [0, 0, 0])]; rot[1] = (rot[1] || 0) + Math.PI / 2; app.model.updateInstance(id, { rot }); const g = app.groups.get(id); if (g) { g.rotation.set(...rot); app.viewer.invalidate(); } app.syncInstanceTransform?.(app.model.getInstance(id)); app.select(id); }
// 取っ手を探す: 長さの値を少し変えて形を作り直し、外形のどの面がどれだけ動くかを調べる
async function probeHandles(app, inst, seq) {
  const V = app.v3; const fam = app.model.familyOf(inst); const p = app.model.resolved(inst); const idle = () => new Promise(r => (globalThis.requestIdleCallback || (f => setTimeout(f, 16)))(r, { timeout: 120 }));
  const boxOf = over => { const g = buildInstance(app.instanceParts(inst, over), { lod: 200, showRefs: false, showSite: true }); const b = new THREE.Box3().setFromObject(g); g.traverse(o => { if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose(); }); return b; };
  let b0; try { b0 = boxOf(null); } catch { return; } if (b0.isEmpty()) return;
  const cands = fam.params.filter(d => d.type === 'length' && typeof p[d.key] === 'number' && !d.hidden).slice(0, 16); const best = new Map();
  for (const d of cands) { await idle(); if (V.probeSeq !== seq) return; const v0 = p[d.key]; const step = Math.max(10, Math.abs(v0) * 0.1); let b1; try { b1 = boxOf({ [d.key]: v0 + step }); } catch { continue; } if (b1.isEmpty()) continue;
    const mv = [-(b1.min.x - b0.min.x), b1.max.x - b0.max.x, -(b1.min.y - b0.min.y), b1.max.y - b0.max.y, -(b1.min.z - b0.min.z), b1.max.z - b0.max.z]; let f = -1, m = 0; mv.forEach((x, i) => { if (Math.abs(x) > Math.abs(m)) { m = x; f = i; } });
    if (f < 0 || Math.abs(m) < step * 0.25) continue; const k = m / step; const pri = (d.group === '寸法' || !d.group ? 2 : d.group === 'ベース' ? 1 : 0) + (Math.abs(k) >= 0.4 && Math.abs(k) <= 1.25 ? 0.5 : 0); const cur = best.get(f); if (!cur || pri > cur.pri || (pri === cur.pri && Math.abs(Math.abs(k) - 1) < Math.abs(Math.abs(cur.k) - 1))) best.set(f, { d, k, face: f, v0, pri }); }
  if (V.probeSeq !== seq || V.selId !== inst.id) return;
  for (const hd of V.handles) hd.el.remove(); V.handles = [];
  for (const it of best.values()) { const axis = it.face >> 1, side = it.face & 1; const c = b0.getCenter(new THREE.Vector3()); const local = c.clone(); local.setComponent(axis, side ? b0.max.getComponent(axis) : b0.min.getComponent(axis)); const dir = new THREE.Vector3().setComponent(axis, side ? 1 : -1);
    const el = h('div', { class: 'v3-hd', 'data-key': it.d.key, title: '' }, h('i'), h('span', { class: 'lb' }, `${it.d.label.replace(/（.*?）/g, '')}  ${fmtMM(it.v0)} mm`)); document.body.append(el);
    const hd = { ...it, local, dir, el, size: b0.getSize(new THREE.Vector3()) }; V.handles.push(hd); el.addEventListener('pointerdown', e => startDrag(app, inst.id, hd, e)); }
  syncOverlays(app);
}
function syncOverlays(app) {
  const V = app.v3; if (!V) return; const v = app.viewer;
  if (V.selId) { const g = app.groups.get(V.selId); if (g) { const r = v.screenRect(g); const cr = v.renderer.domElement.getBoundingClientRect(); if (r) { const x = cr.left + (r.x0 + r.x1) / 2, y = cr.top + r.y0 - 14; V.halo.style.left = Math.max(170, Math.min(innerWidth - 170, x)) + 'px'; V.halo.style.top = Math.max(120, y) + 'px'; } g.updateWorldMatrix(true, false);
    for (const hd of V.handles) { const w = g.localToWorld(hd.local.clone()); const out = g.localToWorld(hd.local.clone().add(hd.dir.clone().multiplyScalar(Math.max(30, hd.size.length() * 0.05)))); const a = project(app, w), b = project(app, out); hd.el.style.display = a.behind ? 'none' : ''; hd.el.style.left = b.x + 'px'; hd.el.style.top = b.y + 'px'; const ang = Math.atan2(a.y - b.y, a.x - b.x); const arm = hd.el.querySelector('i'); arm.style.width = Math.min(60, Math.hypot(a.x - b.x, a.y - b.y)) + 'px'; arm.style.transform = `rotate(${ang}rad)`; hd.screen = { a, b }; } } }
  if (V.hoverBox) V.hoverBox.update();
}
// つまんで動かす: 画面上の向きに沿った指の移動 → mm → 値
function startDrag(app, id, hd, e) {
  e.preventDefault(); e.stopPropagation(); const V = app.v3; const v = app.viewer; const inst = app.model.getInstance(id); const g = app.groups.get(id); if (!inst || !g) return;
  const w0 = g.localToWorld(hd.local.clone()); const w1 = g.localToWorld(hd.local.clone().add(hd.dir.clone().multiplyScalar(100))); const s0 = project(app, w0), s1 = project(app, w1); const sx = s1.x - s0.x, sy = s1.y - s0.y; const px100 = Math.hypot(sx, sy) || 1; const ux = sx / px100, uy = sy / px100;
  const d = hd.d; const lo = d.min ?? 10, hi = d.max ?? 1e6; let val = hd.v0, raf = 0; const start = { x: e.clientX, y: e.clientY };
  V.drag = { id, hd }; hd.el.classList.add('drag'); document.body.classList.add('v3-dragging'); v.controls.enabled = false; hd.el.setPointerCapture?.(e.pointerId);
  const lb = hd.el.querySelector('.lb'); const name = d.label.replace(/（.*?）/g, '');
  const move = ev => { const along = (ev.clientX - start.x) * ux + (ev.clientY - start.y) * uy; const mm = along / px100 * 100; const snap = ev.shiftKey ? 1 : 10; let nv = hd.v0 + mm / hd.k; nv = Math.round(nv / snap) * snap; nv = Math.max(lo, Math.min(hi, nv)); if (nv === val) return; val = nv; lb.textContent = `${name}  ${fmtMM(val)} mm  (${val - hd.v0 >= 0 ? '+' : ''}${fmtMM(val - hd.v0)})`;
    // 取っ手は面と一緒に動かす
    const shift = hd.dir.clone().multiplyScalar(hd.k * (val - hd.v0)); const gw = app.groups.get(id); const a = project(app, gw.localToWorld(hd.local.clone().add(shift).add(hd.dir.clone().multiplyScalar(Math.max(30, hd.size.length() * 0.05))))); hd.el.style.left = a.x + 'px'; hd.el.style.top = a.y + 'px';
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; preview(app, id, { [d.key]: val }); }); };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); cancelAnimationFrame(raf); v.controls.enabled = true; hd.el.classList.remove('drag'); document.body.classList.remove('v3-dragging'); V.drag = null;
    if (val !== hd.v0) { app.model.updateInstance(id, { params: { [d.key]: val } }); const ni = app.model.getInstance(id); app.rebuildInstance(ni); app.select(id); toast(`${name}  ${fmtMM(hd.v0)} → ${fmtMM(val)} mm`, 'ok', 1600); LS.set('anglex.v3.hint', Math.max(1, +LS.get('anglex.v3.hint', 0))); document.getElementById('v3Hint')?.remove(); } else onSelect(app, id); };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// 動かしている間の仮の形（モデルには書かない。離したときに 1 回だけ書く = 元に戻すも 1 回）
function preview(app, id, over) { const inst = app.model.getInstance(id); const old = app.groups.get(id); if (!inst || !old) return; let g; try { g = buildInstance(app.instanceParts(inst, over), { lod: Math.min(app.lod, 300), showRefs: app.showRefs, showSite: app.showSite }); } catch { return; } g.userData.instId = id; g.position.set(...inst.pos); g.rotation.set(...(inst.rot || [0, 0, 0])); app.viewer.remove(old); old.traverse(o => { if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose(); }); app.groups.set(id, g); app.viewer.modelRoot.add(g); app.viewer.applyDisplayStyle(g); app.viewer.select(g); app.viewer.invalidate(); }

// ---------- ホバー ----------
function hoverAt(app, e, tag) { const V = app.v3; if (!e || V.drag || e.buttons) return; let hit = null; try { hit = app.viewer.pick(e); } catch { } const id = hit?.instance?.userData?.instId || null; setHover(app, id && id !== V.selId ? id : null); app.viewer.renderer.domElement.style.cursor = id ? 'pointer' : ''; if (id && id !== V.selId) { const inst = app.model.getInstance(id); const t = inst && app.model.getType(inst.typeId); tag.textContent = inst ? `${inst.mark}  ${t?.name || ''}`.slice(0, 40) : ''; tag.style.left = e.clientX + 'px'; tag.style.top = e.clientY + 'px'; tag.style.opacity = 1; } else tag.style.opacity = 0; }
function setHover(app, id) { const V = app.v3; if (V.hover === id) return; V.hover = id; const v = app.viewer; if (V.hoverBox) { v.scene.remove(V.hoverBox); V.hoverBox.geometry.dispose(); V.hoverBox = null; } const g = id && app.groups.get(id); if (g) { const bh = new THREE.BoxHelper(g, 0x2563eb); bh.material.transparent = true; bh.material.opacity = 0.55; bh.material.depthTest = false; bh.renderOrder = 999; bh.userData.helper = true; bh.userData.noPick = true; v.scene.add(bh); V.hoverBox = bh; } v.invalidate(1, true); }

// ---------- せり上がる札 ----------
function openSheet(app, kind, build) { closeSheet(app, true); const back = h('div', { class: 'v3-sheet-back', onClick: () => closeSheet(app) }); const box = h('div', { class: 'v3-sheet', id: 'v3Sheet', 'data-kind': kind }); document.body.append(back, box); const S = app.v3.sheet = { kind, box, back, render: () => { const st = box.scrollTop; box.innerHTML = ''; box.append(h('div', { class: 'grab' }), h('span', { class: 'x' }, btn('x', '閉じる (Esc)', () => closeSheet(app))), build(S)); box.scrollTop = st; } }; S.render(); requestAnimationFrame(() => { back.classList.add('in'); box.classList.add('in'); }); return S; }
function closeSheet(app, now = false) { const S = app.v3?.sheet; if (!S) return; app.v3.sheet = null; S.box.classList.remove('in'); S.back.classList.remove('in'); const rm = () => { S.box.remove(); S.back.remove(); }; now ? rm() : setTimeout(rm, 220); }

// 見積: 大きな金額、内訳の帯、利益のつまみ、明細（クリックで 3D のその部材へ）
const CAT = [['material', '材料', '#64748b'], ['cut', '切断', '#0ea5e9'], ['hole', '穴あけ', '#22c55e'], ['weld', '溶接', '#f59e0b'], ['bend', '曲げ', '#a855f7'], ['assembly', '組立', '#14b8a6'], ['finish', '表面処理', '#ef4444'], ['fasteners', 'ボルト類・購入品', '#6366f1'], ['overhead', '管理費', '#94a3b8'], ['profit', '工場の利益', '#cbd5e1']];
export function openEstimateSheet(app) {
  return openSheet(app, 'estimate', () => { const em = estimateNow(app); const wrap = h('div', {}); if (!em) { wrap.append(h('h2', {}, '見積'), h('p', {}, '部材を置くと、ここに金額が出ます')); return wrap; }
    const tot = {}; for (const l of em.lines) for (const [k] of CAT) tot[k] = (tot[k] || 0) + (l.cost?.[k] || 0) * l.qty; const sum = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
    const big = h('div', { class: 'v3-big', id: 'v3EstTotal' }, yen(em.withMargin));
    const slider = h('input', { type: 'range', min: 0, max: 40, step: 1, value: app.v3.margin, 'data-k': 'margin', onInput: e => { app.v3.margin = +e.target.value; LS.set('anglex.v3.margin', app.v3.margin); const m = estimateNow(app); big.textContent = yen(m.withMargin); mv.textContent = `${app.v3.margin}%`; refreshNumbers(app); } }); const mv = h('b', {}, `${app.v3.margin}%`);
    wrap.append(h('h2', {}, '見積（税別）'), big, h('div', { class: 'v3-sub' }, h('span', {}, `工場の原価 ${yen(em.subtotal)}`), h('span', {}, `質量 ${em.totalMass.toLocaleString('ja-JP')} kg`), h('span', {}, `部材 ${app.model.instances.length} 点 ・ 明細 ${em.lines.length} 行`)),
      h('div', { class: 'v3-slider' }, h('span', {}, '利益'), slider, mv),
      h('div', { class: 'v3-bar' }, CAT.filter(([k]) => tot[k] > 0).map(([k, n, c]) => h('i', { title: `${n} ${yen(tot[k])}`, style: { width: (tot[k] / sum * 100) + '%', background: c } }))),
      h('div', { class: 'v3-legend' }, CAT.filter(([k]) => tot[k] > 0).map(([k, n, c]) => h('span', { style: { '--c': c } }, `${n} ${Math.round(tot[k] / sum * 100)}%`))),
      h('div', { class: 'v3-rows' }, em.lines.map(l => h('div', { class: 'v3-row', title: '3D でこの部材を見る', onClick: () => { const inst = app.model.instances.find(i => l.marks.includes(i.mark)); if (inst) { closeSheet(app); app.select(inst.id); const g = app.groups.get(inst.id); if (g) app.viewer.focusOn(g); } } }, h('div', {}, h('div', { class: 'n' }, l.desc), h('div', { class: 'm' }, `${l.marks.slice(0, 6).join(' ')}${l.marks.length > 6 ? ' …' : ''} ・ ${(l.mass || 0).toLocaleString('ja-JP', { maximumFractionDigits: 1 })} kg/${l.unit}`)), h('span', { class: 'q' }, `${l.qty} ${l.unit} × ${yen(l.unitCost)}`), h('span', { class: 'a' }, yen(l.amount * (1 + app.v3.margin / 100)))))),
      h('div', { class: 'v3-acts' }, h('button', { class: 'v3-act primary', 'data-act': 'est-pdf', onClick: async e => { const b = e.currentTarget; b.disabled = true; try { const est = await currentEstimate(app); if (est) await exportEstimatePDF(app, est); } finally { b.disabled = false; } } }, icon('doc', 18), '見積書 PDF'), h('button', { class: 'v3-act', onClick: () => exportWeightXLSX(app) }, icon('sheet', 18), '重量計算書 Excel'), h('button', { class: 'v3-act', onClick: () => { closeSheet(app); openEstimate(app); } }, icon('info', 18), '詳しく・受け渡し'), h('button', { class: 'v3-act accent', onClick: () => openFactorySheet(app) }, icon('truck', 18), '工場へ'))); return wrap; });
}
async function currentEstimate(app) { let list = []; try { list = await app.store.listEstimates(app.project.id); } catch { } const est = (app.currentEstimateId && list.find(e => e.id === app.currentEstimateId)) || list[0]; return est || await createEstimate(app); }

// 工場へ: 送り先（おすすめ順）、送るもの（札を押して選ぶ）、納期 → まとめて 1 つの ZIP と送り状
const PACK = [{ id: 'work', icon: 'clip', t: '加工指示書', s: 'PDF ・ 部材ごとの寸法・穴・溶接', on: true }, { id: 'bom', icon: 'sheet', t: '部品表', s: 'Excel ・ 重量と数量（数式入り）', on: true }, { id: 'dxf', icon: 'draw', t: '加工図', s: 'DXF ・ 板の外形と穴', on: true }, { id: 'nc', icon: 'nc', t: 'NC データ', s: 'DSTV ・ 形鋼と板', on: true }, { id: 'ifc', icon: 'file3d', t: '3D モデル', s: 'IFC4 ・ 形を確かめる用', on: true }, { id: 'insp', icon: 'check', t: '検査記録シート', s: 'Excel ・ 記入して返送', on: true }];
export function openFactorySheet(app) {
  if (!app.model.instances.length) { toast('先に部材を置いてください', 'warn'); return null; }
  const order = ensureOrder(app); const need = orderNeed(app); const recs = OD.recommendFactories(loadFactories(), need, { due: order.stages.make?.due || null }); const st = app.v3.factory || (app.v3.factory = { fid: order.factory?.id || recs.find(r => r.ok)?.factory.id || recs[0]?.factory.id, pack: Object.fromEntries(PACK.map(p => [p.id, p.on])), due: order.request?.due || order.stages.make?.due || OD.addBizDays(OD.today(), 10), memo: '', result: null });
  return openSheet(app, 'factory', S => { const wrap = h('div', {}); const rec = recs.find(r => r.factory.id === st.fid) || recs[0];
    wrap.append(h('h2', {}, '工場へ送る'), h('div', { class: 'v3-big', style: { fontSize: '26px' } }, rec ? rec.factory.name : '工場を選んでください'), h('div', { class: 'v3-sub' }, h('span', {}, `鋼材 ${need.steel} 点 ・ 溶接 ${need.welds} か所 ・ 穴 ${need.holes} 個`), h('span', {}, `${need.mass.toFixed(1)} kg`), need.galv ? h('span', {}, '溶融亜鉛めっき') : null),
      h('div', { class: 'v3-sec' }, '送り先（加工内容に合う順）'), h('div', { class: 'v3-tiles' }, recs.slice(0, 4).map((r, i) => h('button', { class: 'v3-tile' + (st.fid === r.factory.id ? ' on' : '') + (r.ok ? '' : ' ng'), 'data-fac': r.factory.id, onClick: () => { st.fid = r.factory.id; S.render(); } }, h('span', { class: 't' }, r.factory.name, r.ok && i === 0 ? h('span', { style: { fontSize: '10.5px', color: '#059669' } }, 'おすすめ') : null), h('span', { class: 's' }, `${r.lead} 営業日 ・ ${r.factory.region}`), h('span', { class: 's' }, r.ok ? (r.good.slice(0, 2).join('・') || '条件を満たす') : '× ' + r.miss[0])))),
      h('div', { class: 'v3-sec' }, '送るもの'), h('div', { class: 'v3-tiles' }, PACK.map(p => h('button', { class: 'v3-tile' + (st.pack[p.id] ? ' on' : ''), 'data-pack': p.id, onClick: () => { st.pack[p.id] = !st.pack[p.id]; S.render(); } }, h('span', { class: 't' }, icon(p.icon, 16), p.t), h('span', { class: 's' }, p.s)))),
      h('div', { class: 'v3-field' }, h('label', {}, '納期', h('input', { type: 'date', value: st.due, onChange: e => { st.due = e.target.value; } })), h('label', {}, 'ひとこと（任意）', h('input', { value: st.memo, placeholder: '例: 搬入は平日の午前', onChange: e => { st.memo = e.target.value; } }))),
      h('div', { class: 'v3-acts' }, h('button', { class: 'v3-act accent', 'data-act': 'pack', disabled: !Object.values(st.pack).some(Boolean) || !rec, onClick: async e => { const b = e.currentTarget; b.disabled = true; b.lastChild.textContent = 'まとめています…'; try { st.result = await buildPackage(app, rec, st); } catch (err) { console.error(err); toast('まとめられませんでした: ' + err.message, 'bad'); } S.render(); } }, icon('send', 18), h('span', {}, 'まとめて ZIP にする')), h('button', { class: 'v3-act', onClick: () => { closeSheet(app); app.openOrder?.({ tab: 'factory' }); } }, icon('flow', 18), '工場の一覧・案件の進み')));
    if (st.result) { const r = st.result; const ta = h('textarea', { class: 'v3-msg', readOnly: true }, r.message); wrap.append(h('div', { class: 'v3-done', id: 'v3Done' }, h('span', { class: 'ck' }, icon('check', 18)), h('div', {}, h('b', {}, `${r.zipName} を作りました`), h('div', { style: { fontSize: '12px' } }, `${r.files.length} ファイル（${r.files.map(f => f.split('.').pop().toUpperCase()).filter((x, i, a) => a.indexOf(x) === i).join('・')}）・ ${(r.size / 1024).toFixed(0)} KB。案件の進みに記録しました`))), ta, h('div', { class: 'v3-acts' }, h('button', { class: 'v3-act primary', onClick: async () => { try { await navigator.clipboard.writeText(r.message); toast('送り状をコピーしました', 'ok'); } catch { ta.select(); document.execCommand('copy'); toast('送り状をコピーしました', 'ok'); } } }, icon('copy', 18), '送り状をコピー'), h('button', { class: 'v3-act', onClick: () => download(r.zipName, r.blob, 'application/zip') }, icon('import', 18), 'もう一度保存'))); }
    return wrap; });
}
// 書き出しを受け止めて 1 つの ZIP に（各機能の「保存」を一時的にこちらへ向ける）
export async function capture(fn) { const got = []; const prev = globalThis.__anglexCapture; const X = window.XLSX; const ow = X?.writeFile; globalThis.__anglexCapture = got; if (X) X.writeFile = (wb, name) => { got.push({ name, blob: new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })]) }); }; try { await fn(); } finally { globalThis.__anglexCapture = prev || null; if (X) X.writeFile = ow; } return got; } // 入れ子でも外側の受け止めに戻す
export async function buildPackage(app, rec, st) {
  const f = rec.factory; const order = ensureOrder(app); const need = orderNeed(app); const files = {}; const added = []; const safe = s => String(s || '').replace(/[\\/:*?"<>|]/g, '_');
  if (st.pack.bom || st.pack.insp) await loadXLSX();
  const est = st.pack.work ? await currentEstimate(app) : null;
  const jobs = [['work', () => est && exportWorkOrderPDF(app, est)], ['bom', () => exportWeightXLSX(app)], ['dxf', () => exportDXF(app)], ['nc', () => exportNC1(app, ncOptions())], ['ifc', () => exportIFC4(app, { geometry: 'swept', schema: 'IFC4' })], ['insp', () => exportInspectionXLSX(app)]];
  for (const [id, run] of jobs) { if (!st.pack[id]) continue; const got = await capture(run); for (const g of got) { const buf = new Uint8Array(await g.blob.arrayBuffer()); let n = safe(g.name); while (files[n]) n = n.replace(/(\.[^.]+)?$/, '_2$1'); files[n] = buf; added.push(n); } }
  const items = PACK.filter(p => st.pack[p.id]).map(p => p.t);
  const message = [`【加工のお願い】${app.project.name}　案件番号 ${order.no}`, '', `${f.name} ご担当者様`, '', '添付の資料で製作をお願いします。', `・納期: ${st.due || '別途ご相談'}`, `・内容: 部材 ${app.model.instances.length} 点（鋼材 ${need.steel} 点、溶接 ${need.welds} か所、穴 ${need.holes} 個）、質量 約 ${need.mass.toFixed(1)} kg`, need.galv ? '・表面処理: 溶融亜鉛めっき' : null, `・同封: ${items.join('、')}`, st.pack.insp ? '・検査記録シートは、製作後に実測値を記入してご返送ください（そのまま読み込んで合否を集計します）。' : null, st.memo ? `・${st.memo}` : null, '', '形は 3D モデル（IFC）を開くとご確認いただけます。ご不明な点はご連絡ください。'].filter(x => x !== null).join('\n');
  files['送り状.txt'] = strToU8(message.replace(/\n/g, '\r\n')); added.unshift('送り状.txt');
  const zip = zipSync(files, { level: 6 }); const zipName = `${safe(app.project.name)}_${safe(f.name)}_送付資料.zip`; const blob = new Blob([zip], { type: 'application/zip' }); download(zipName, blob, 'application/zip');
  OD.chooseFactory(order, rec, { user: app.user(), note: '工場へ送る（v3）' }); OD.log(order, { user: app.user(), stage: 'factory', action: 'doc', note: `送付資料を作成: ${items.join('、')}（${zipName}）` }); const stg = order.stages.factory; (stg.manual ||= {}).ordered = true; if (st.pack.work) (order.stages.shop.manual ||= {}).workorder = true; app.scheduleAutosave?.(); refreshNumbers(app);
  return { zipName, blob, size: blob.size, files: added, message };
}
