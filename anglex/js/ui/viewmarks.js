// 視点ブックマーク: 今の視点に名前を付けて案件に保存（project.views）。一覧から戻れる。
// 「PDF」を付けた視点は、見積・加工指示書の 3D スナップ／分解図の撮影角度にそのまま使われる（部材に寄った視点はその部材の、全体の視点は全体スナップの角度）
import { $, h, toast, promptDialog } from './common.js';
import * as THREE from 'three';
const uid = () => 'V' + Math.random().toString(36).slice(2, 8);
export function listViewmarks(app) { return (app.project.views ||= []); }
export function captureView(app, name) { const v = app.viewer; const f = v.focusObj; const focus = f?.userData?.instId || null; const inst = focus ? app.model.getInstance(focus) : null; const vm = { id: uid(), name: name || (inst ? `${inst.mark}${v.focusMode === 'zoom' ? ' に寄った' : ' 中心'}` : `視点 ${listViewmarks(app).length + 1}`), p: v.camera.position.toArray().map(x => Math.round(x * 10) / 10), t: v.controls.target.toArray().map(x => Math.round(x * 10) / 10), focus, mode: focus ? v.focusMode : null, pdf: false, at: new Date().toISOString(), by: app.user?.().name || '' }; return vm; }
export async function saveViewmark(app, name = null) { if (name == null) { const r = await promptDialog('視点を保存', [{ key: 'name', label: '名前', value: captureView(app).name }, { key: 'pdf', label: 'PDF の撮影角度', type: 'select', value: '0', options: [['0', '使わない'], ['1', '使う（見積・指示書のスナップをこの角度で）']] }]); if (!r) return null; name = r.name; var pdf = r.pdf === '1'; } const vm = captureView(app, name); vm.pdf = !!pdf; if (vm.pdf) for (const o of listViewmarks(app)) if (o.focus === vm.focus) o.pdf = false; listViewmarks(app).push(vm); app.scheduleAutosave?.(); toast(`視点「${vm.name}」を保存しました${vm.pdf ? '（PDF の撮影角度）' : ''}`, 'ok'); app.viewmarksRefresh?.(); return vm; }
export function gotoViewmark(app, vm) { const v = app.viewer; if (!vm) return false; v.pushView(); const g = vm.focus ? app.groups.get(vm.focus) : null; v._setFocus(g || null, g ? vm.mode : null); if (g && vm.focus !== app.selection) app.select(vm.focus); v.animateTo(new THREE.Vector3(...vm.p), new THREE.Vector3(...vm.t), { ms: 420 }); v.orthoControls.target.set(...vm.t); return true; }
export function removeViewmark(app, id) { const list = listViewmarks(app); const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1); app.scheduleAutosave?.(); app.viewmarksRefresh?.(); }
export function setViewmarkPdf(app, id, on) { for (const o of listViewmarks(app)) { if (o.id === id) { o.pdf = !!on; if (on) for (const q of listViewmarks(app)) if (q !== o && q.focus === o.focus) q.pdf = false; } } app.scheduleAutosave?.(); app.viewmarksRefresh?.(); }
// PDF 用の視点: その部材に寄った／中心にした PDF 視点、なければ null
export function pdfViewFor(app, instId) { return listViewmarks(app).find(v => v.pdf && v.focus === (instId || null)) || null; }
// 一覧ポップオーバー（リボン／ツールストリップの「☆ 視点」、B キー）
export function toggleViewmarks(app, anchorEl) { const old = document.querySelector('.vm-pop'); if (old) { old.remove(); app.viewmarksRefresh = null; return; }
  const stage = $('#d3stage') || $('#stage'); if (!stage) return; const pop = h('div', { class: 'vm-pop', onClick: e => e.stopPropagation() }); stage.append(pop);
  const render = () => { pop.innerHTML = ''; pop.append(h('div', { class: 'vm-head' }, h('b', {}, '☆ 視点ブックマーク'), h('button', { class: 'btn sm primary', title: '今の視点に名前を付けて保存（Shift+B）', onClick: () => saveViewmark(app) }, '＋ 今の視点を保存'), h('button', { class: 'icon-btn', onClick: () => toggleViewmarks(app) }, '✕')));
    const list = listViewmarks(app); if (!list.length) { pop.append(h('div', { class: 'muted small', style: { padding: '6px 2px' } }, 'まだありません。部材に寄って「＋ 今の視点を保存」。PDF を付けると見積・指示書のスナップがその角度になります')); return; }
    for (const vm of list) { const inst = vm.focus ? app.model.getInstance(vm.focus) : null; pop.append(h('div', { class: 'vm-row' + (vm.pdf ? ' pdf' : ''), 'data-id': vm.id }, h('button', { class: 'vm-go', title: 'この視点へ', onClick: () => gotoViewmark(app, vm) }, h('b', {}, vm.name), h('span', { class: 'muted small' }, inst ? ` ${inst.mark}${vm.mode === 'zoom' ? '（寄る）' : ''}` : ' 全体')),
      h('button', { class: 'chip' + (vm.pdf ? ' on' : ''), title: vm.pdf ? 'PDF の撮影角度に使っています（押して解除）' : '見積・指示書の 3D スナップ／分解図をこの角度で撮る', onClick: () => setViewmarkPdf(app, vm.id, !vm.pdf) }, '📷 PDF'),
      h('button', { class: 'icon-btn', title: '名前を変更', onClick: async () => { const r = await promptDialog('名前を変更', [{ key: 'name', label: '名前', value: vm.name }]); if (r && r.name) { vm.name = r.name; app.scheduleAutosave?.(); render(); } } }, '✎'),
      h('button', { class: 'icon-btn', title: '削除', onClick: () => removeViewmark(app, vm.id) }, '✕'))); } };
  app.viewmarksRefresh = render; render();
  if (anchorEl) { const r = anchorEl.getBoundingClientRect(), s = stage.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(s.width - 320, r.left - s.left)) + 'px'; pop.style.top = '10px'; }
  setTimeout(() => document.addEventListener('click', function off(e) { if (!pop.contains(e.target)) { pop.remove(); app.viewmarksRefresh = null; } document.removeEventListener('click', off); }), 0);
}
