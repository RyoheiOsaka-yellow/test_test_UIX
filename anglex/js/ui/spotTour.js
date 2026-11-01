// 見どころの「次へ」送り: 寄った部材の未確認フラグ（溶接・穴・アンカー…）を 1 つずつ画面中央に寄せて順に回る。
// ピルの「確認 N」から開始。N / Shift+N で次／前、✓ でその場で確認済みにして次へ。Esc か「終了」で閉じる
import { $, h, toast } from './common.js';
import { buildChecklist } from '../bim/review.js';
import { setReview } from './review.js';
import * as THREE from 'three';
const KIND = { weld: '溶接', hole: '穴', anchor: 'アンカー', ubolt: 'Uボルト', rod: '吊ボルト', finish: '仕上げ', origin: '図面根拠', risk: 'リスク' };
const ORDER = ['weld', 'hole', 'anchor', 'ubolt', 'rod', 'finish', 'origin', 'risk'];
export function startTour(app, inst) {
  closeTour(app); const g = app.groups.get(inst.id); if (!g) return null;
  let items = []; try { items = buildChecklist(inst, app.instanceParts(inst)); } catch { }
  const rows = items.filter(i => i.status === 'open').sort((a, b) => (ORDER.indexOf(a.kind) + 1 || 99) - (ORDER.indexOf(b.kind) + 1 || 99));
  if (!rows.length) { toast(`${inst.mark}: 未確認の項目はありません`, 'ok'); return null; }
  const stage = $('#d3stage') || $('#stage'); const st = { inst, rows, i: 0, done: 0 }; app.tour = st;
  const pos = h('span', { class: 'tr-pos' }); const label = h('b', { class: 'tr-label' }); const need = h('span', { class: 'tr-need' });
  const bar = h('div', { class: 'tour-bar', role: 'status' }, pos, label, need,
    h('button', { class: 'btn sm primary', title: 'この項目を確認済みにして次へ（✓）', onClick: () => markTour(app, 'ok') }, '✓ 確認済'),
    h('button', { class: 'btn sm', title: '要対応（メモを残して次へ）', onClick: () => { const note = prompt('要対応のメモ（空でも可）', '') ?? null; if (note === null) return; markTour(app, 'open', note); } }, '✗ 要対応'),
    h('button', { class: 'btn sm', title: '前へ（Shift+N）', onClick: () => stepTour(app, -1) }, '‹ 前'),
    h('button', { class: 'btn sm', title: '次へ（N）', onClick: () => stepTour(app, 1) }, '次 ›'),
    h('button', { class: 'icon-btn', title: '終了（Esc）', onClick: () => closeTour(app) }, '✕'));
  stage.append(bar); st.bar = bar; st.render = () => { const it = st.rows[st.i]; if (!it) return; pos.textContent = `確認 ${st.i + 1}/${st.rows.length}`; label.textContent = `${KIND[it.kind] || it.kind}: ${it.label}`; need.textContent = it.need || ''; bar.classList.toggle('ok', it.status === 'ok'); highlight(app, it); };
  gotoTour(app, 0); return st;
}
// 項目の位置へ寄せる（位置のない項目は部材の中央へ）。距離は維持
export function gotoTour(app, i) { const st = app.tour; if (!st) return; st.i = Math.max(0, Math.min(st.rows.length - 1, i)); const it = st.rows[st.i]; const g = app.groups.get(st.inst.id); if (!g) return; g.updateWorldMatrix(true, false);
  if (it.pos) { const w = it.pos.clone().applyMatrix4(g.matrixWorld); app.viewer.focusPoint(w, { ms: 320 }); } else app.viewer.focusOn(g, { zoom: true }); st.render(); }
export function stepTour(app, d) { const st = app.tour; if (!st) return; if (st.i + d >= st.rows.length) { toast(`${st.inst.mark}: 最後の項目です（確認済 ${st.done}/${st.rows.length}）`, 'info'); return; } gotoTour(app, st.i + d); }
// ✓ 確認済 / ✗ 要対応 を記録して次へ。最後まで行ったら終了
export function markTour(app, status, note) { const st = app.tour; if (!st) return; const it = st.rows[st.i]; if (!it) return; setReview(app, st.inst, it.id, status, note ?? (status === 'ok' ? '見どころ送りで確認' : undefined)); it.status = status; if (status === 'ok') st.done++; app.refreshProps?.(); app.focusPill?.refresh?.();
  const next = st.rows.findIndex((r, k) => k > st.i && r.status === 'open'); if (next >= 0) gotoTour(app, next); else { const rest = st.rows.filter(r => r.status === 'open').length; toast(rest ? `一周しました。未確認 ${rest} 件が残っています` : `${st.inst.mark}: すべて確認済みにしました`, rest ? 'info' : 'ok'); if (!rest) closeTour(app); else st.render(); } }
function highlight(app, it) { for (const c of app.viewer.overlayRoot.children) if (c.element) c.element.classList.toggle('tour-now', !!it && c.userData.itemId === it.id && c.userData.instId === app.tour?.inst.id); }
export function closeTour(app) { const st = app.tour; if (!st) return; st.bar?.remove(); app.tour = null; highlight(app, null); app.focusPill?.refresh?.(); }
