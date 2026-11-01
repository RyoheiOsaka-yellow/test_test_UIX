// UI ユーティリティ: 要素生成・モーダル・トースト・フォーマット（ANGLEX 共通）
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v === false || v == null) { }
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) { if (c == null || c === false) continue; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); }
  return e;
}
export const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
export const fmt = {
  mm: (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : (+v).toFixed(d)),
  dev: (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d)),
  tol: t => { if (!t) return ''; const [u, l] = t; const f = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0'); if (Math.abs(u) === Math.abs(l) && u !== 0) return '±' + Math.abs(u).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0'); return `${f(u)} / ${f(l)}`; },
  date: s => s ? new Date(s).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
  min: m => m >= 60 ? `${Math.floor(m / 60)}時間${Math.round(m % 60) ? Math.round(m % 60) + '分' : ''}` : `${Math.round(m)}分`,
};
let toastHost = null;
export function toast(msg, kind = 'info', ms = 3200) {
  if (!toastHost) { toastHost = h('div', { class: 'toast-host' }); document.body.appendChild(toastHost); }
  while (toastHost.children.length >= 4) toastHost.firstElementChild.remove();
  const t = h('div', { class: 'toast ' + kind }, msg); toastHost.appendChild(t); requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms); return t;
}
export function modal({ title, body, wide = false, footer = null, onClose = null, cls = '' }) {
  const back = h('div', { class: 'modal-back' }); const box = h('div', { class: 'modal ' + (wide ? 'wide ' : '') + cls });
  const close = () => { back.remove(); onClose && onClose(); };
  box.append(h('div', { class: 'modal-head' }, h('div', { class: 'modal-title' }, title), h('button', { class: 'icon-btn', onClick: close, title: '閉じる' }, '✕')), h('div', { class: 'modal-body' }, body));
  if (footer) box.append(h('div', { class: 'modal-foot' }, footer)); back.append(box); back.addEventListener('click', e => { if (e.target === back) close(); }); document.body.appendChild(back); return { close, box, back };
}
export function download(name, content, type = 'application/octet-stream') { const blob = content instanceof Blob ? content : new Blob([content], { type }); const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
export function csv(rows) { return '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n'); }
export const STATUS_JA = { ok: '合格', warn: '注意', ng: '不合格', na: '未測定' };
export const STATUS_MARK = { ok: '✓', warn: '△', ng: '✗', na: '—' };
