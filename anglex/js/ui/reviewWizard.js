// まとめて確認ウィザード: 未確認の確認事項を種類別にカード送りで処理。3D がその箇所へ自動で寄る
import { $, h, toast } from './common.js';
import { buildChecklist, REVIEW_KINDS } from '../bim/review.js';
import { setReview, weldInstructionDialog, holeInstructionDialog } from './review.js';
import * as THREE from 'three';
import { recordConfirmation } from '../import/learn.js';

const ORDER = ['joint', 'weld', 'hole', 'anchor', 'ubolt', 'rod', 'origin', 'risk', 'finish', 'length']; const KIND_LABEL = k => k === 'joint' ? '接合（提案）' : (REVIEW_KINDS[k] || k);
export function closeReviewWizard(app) { document.querySelector('.wiz-panel')?.remove(); document.removeEventListener('keydown', app._wizKeys || (() => { })); app._wizKeys = null; app.wizard = null; }
export function openReviewWizard(app, { kind = null } = {}) {
  closeReviewWizard(app); const stage = $('#d3stage') || $('#stage'); if (!stage) return; if (app.role() !== 'A') { toast('確認作業は A社（見積作成）の担当です', 'warn'); return; }
  const collect = () => { const rows = [];
    // 提案で追加した接合（状態: 推論）もカードに。3D はその穴（points の中心）へ寄り、確定／外す を 1 クリックで
    for (const j of app.model.joints) { if (j.status !== 'inferred') continue; const a = app.model.getInstance(j.a), b = app.model.getInstance(j.b); if (!a || !b) continue; const mid = j.points?.length ? j.points.reduce((acc, p) => acc.map((v, i) => v + p[i] / j.points.length), [0, 0, 0]) : null; rows.push({ inst: a, joint: j, it: { id: 'joint:' + j.id, kind: 'joint', label: j.label || `${a.mark}–${b.mark} ${j.M || ''} ボルト`, need: `${a.mark} と ${b.mark} の穴位置が一致するためボルト接合を提案しました（${j.M} × ${j.count}）。図面の接合指示と合っていれば確定、違えば外してください`, world: mid } }); }
    for (const inst of app.model.instances) { let items = []; try { items = buildChecklist(inst, app.instanceParts(inst)); } catch { } for (const it of items) if (it.status === 'open') rows.push({ inst, it }); } rows.sort((a, b) => ORDER.indexOf(a.it.kind) - ORDER.indexOf(b.it.kind) || a.inst.mark.localeCompare(b.inst.mark)); return rows; };
  const all = collect(); if (!all.length) { toast('未確認の項目はありません', 'ok'); return; }
  const st = { rows: kind ? all.filter(r => r.it.kind === kind) : all, i: 0, done: 0, kind, total: all.length };
  const panel = h('div', { class: 'wiz-panel', onClick: e => e.stopPropagation() }); stage.append(panel); app.wizard = st;
  const counts = {}; for (const r of all) counts[r.it.kind] = (counts[r.it.kind] || 0) + 1;
  const focus = (r) => { const g = app.groups.get(r.inst.id); if (!g) return; if (r.joint) { try { app.selectJoint?.(r.joint.id); } catch { app.select(r.inst.id); } if (r.it.world) { app.viewer.focusPoint(new THREE.Vector3(...r.it.world), { dist: 900 }); return; } } app.select(r.inst.id); g.updateWorldMatrix(true, false); if (r.it.pos) { const w = r.it.pos.clone().applyMatrix4(g.matrixWorld); app.viewer.focusPoint(w, { dist: Math.max(900, new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).length() * 0.9) }); } else app.viewer.focusOn(g); };
  const next = () => { st.i++; render(); }; const prev = () => { st.i = Math.max(0, st.i - 1); render(); };
  const mark = (status, note) => { const r = st.rows[st.i]; if (!r) return; if (r.joint) { const j = app.model.joints.find(x => x.id === r.joint.id); if (j) { if (status === 'ok') { j.status = 'confirmed'; j.note = note || j.note; } else { app.model.removeJoint(j.id); } app.rebuildAll(); app.refreshBrowser(); } st.done++; app.flowRefresh?.(); next(); return; } setReview(app, r.inst, r.it.id, status, note); st.done++; app.refreshProps(); app.drawLevels(); app.flowRefresh?.(); next(); };
  function render() {
    panel.innerHTML = ''; const r = st.rows[st.i];
    const chips = h('div', { class: 'wiz-chips' }, h('button', { class: 'chip' + (!st.kind ? ' on' : ''), onClick: () => openReviewWizard(app) }, `すべて ${all.length}`), ...ORDER.filter(k => counts[k]).map(k => h('button', { class: 'chip' + (st.kind === k ? ' on' : ''), onClick: () => openReviewWizard(app, { kind: k }) }, `${KIND_LABEL(k)} ${counts[k]}`)));
    const head = h('div', { class: 'wiz-head' }, h('b', {}, 'まとめて確認'), h('span', { class: 'muted small' }, `${Math.min(st.i + 1, st.rows.length)} / ${st.rows.length}` + (st.done ? `（処理 ${st.done}）` : '')), h('button', { class: 'icon-btn', title: '閉じる', onClick: () => closeReviewWizard(app) }, '✕'));
    const bar = h('div', { class: 'wiz-bar' }, h('span', { style: { width: Math.round(st.i / Math.max(1, st.rows.length) * 100) + '%' } }));
    panel.append(head, bar, chips);
    if (!r) { panel.append(h('div', { class: 'wiz-done' }, h('div', { style: { fontSize: '20px' } }, '✓'), h('div', {}, `この一覧は終わりです（処理 ${st.done} 件）`), h('div', { class: 'muted small' }, `未確認 残り ${collect().length} 件`)), h('div', { class: 'wiz-actions' }, h('button', { class: 'btn sm primary', onClick: () => openReviewWizard(app) }, '残りを続ける'), h('button', { class: 'btn sm', onClick: () => closeReviewWizard(app) }, '閉じる'))); return; }
    focus(r); const it = r.it; const type = app.model.getType(r.inst.typeId);
    const note = h('input', { class: 'wiz-note', placeholder: 'メモ（任意）: 例 図面 D4 の注記で確認' });
    panel.append(h('div', { class: 'wiz-card' }, h('div', { class: 'wiz-kind' }, h('span', { class: 'chip ' + (it.kind === 'joint' ? 'warn' : 'bad') }, KIND_LABEL(it.kind)), h('b', {}, r.inst.mark), h('span', { class: 'muted' }, type?.name || '')), h('div', { class: 'wiz-label' }, it.label), h('div', { class: 'wiz-need' }, '確認ポイント: ', it.need), note));
    const acts = h('div', { class: 'wiz-actions' });
    acts.append(h('button', { class: 'btn sm primary', title: 'Enter', onClick: () => mark('ok', note.value) }, it.kind === 'joint' ? '✓ 接合を確定（Enter）' : '✓ 確認済（Enter）'));
    if (it.kind === 'joint') acts.append(h('button', { class: 'btn sm danger', title: 'この接合を外す（提案を却下）', onClick: () => mark('remove', note.value) }, '外す'));
    if (it.kind === 'weld') acts.append(h('button', { class: 'btn sm', onClick: async () => { await weldInstructionDialog(app, r.inst, it); render(); } }, '溶接指示…'));
    if (it.kind === 'hole') acts.append(h('button', { class: 'btn sm', onClick: async () => { await holeInstructionDialog(app, r.inst, it); render(); } }, '穴あけ指示…'));
    if (it.kind === 'origin' || it.kind === 'risk') acts.append(h('button', { class: 'btn sm', title: 'この部材を確定（推論→確定）', onClick: () => { app.model.updateInstance(r.inst.id, { status: 'confirmed' }); app.rebuildInstance(r.inst); recordConfirmation(app, app.model.getInstance(r.inst.id)).catch(() => { }); st.rows = st.rows.filter(x => x.inst.id !== r.inst.id || x.it.kind !== 'origin'); mark('ok', note.value || '図面根拠を確認し確定'); } }, '部材を確定'));
    acts.append(h('button', { class: 'btn sm', title: '→', onClick: next }, 'スキップ →'), h('button', { class: 'btn sm', title: '←', disabled: st.i === 0, onClick: prev }, '← 戻る'));
    const same = st.rows.filter((x, k) => k >= st.i && x.it.kind === it.kind).length; if (same > 1 && it.kind !== 'joint') acts.append(h('button', { class: 'btn sm', onClick: () => { const rest = st.rows.slice(st.i).filter(x => x.it.kind === it.kind); for (const x of rest) setReview(app, x.inst, x.it.id, 'ok', note.value); st.done += rest.length; st.rows = st.rows.filter((x, k) => k < st.i || x.it.kind !== it.kind); app.refreshProps(); app.drawLevels(); app.flowRefresh?.(); render(); } }, `残りの${KIND_LABEL(it.kind)} ${same} 件を確認済に`));
    panel.append(acts);
    setTimeout(() => note.focus(), 30);
  }
  app._wizKeys = e => { if (!document.body.contains(panel)) return; const tg = e.target; if ((tg && tg.matches && tg.matches('textarea,select')) || document.querySelector('.modal-back')) return; if (e.key === 'Enter') { e.preventDefault(); mark('ok', panel.querySelector('.wiz-note')?.value || ''); } else if (e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); } };
  document.addEventListener('keydown', app._wizKeys);
  render();
}
