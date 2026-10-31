// 掴んだ部材のピル: 部材をクリック（掴む）して中央へ寄せた後、3D の上中央に「◎ MF-2 を中心に回しています」を出し続ける。
// 回している間も何を中心にしているかが分かる。「全体へ」ボタンか Esc で全体中心に戻す。部材が消えたら自動で隠す。
// 寄った（ダブルクリック）ときは「穴 4 / 溶接 2 / 確認 1」の見どころの数、‹ › の視点履歴、⟳ 自動回り込みの入／切も載せる
import { $, h } from './common.js';
export function installFocusPill(app) {
  const stage = $('#d3stage') || $('#stage'); if (!stage || stage.querySelector('.focus-pill')) return null; const v = app.viewer;
  const name = h('b'); const text = h('span', { class: 'fp-text' }, ' を中心に回しています'); const counts = h('span', { class: 'fp-counts' });
  const back = h('button', { class: 'fp-nav', title: '前の視点へ（Alt+←）', onClick: () => app.viewBack() }, '‹'); const fwd = h('button', { class: 'fp-nav', title: '次の視点へ（Alt+→）', onClick: () => app.viewForward() }, '›');
  const tt = h('button', { class: 'fp-tt', title: '自動回り込み: 寄った状態で 3 秒操作がないと、その部材を中心にゆっくり回る（触ると止まる）。押して入／切', onClick: () => app.toggleTurntable() }, '⟳ 自動');
  const btn = h('button', { class: 'fp-clear', title: '全体を中央へ戻す（Esc）', onClick: () => app.clearFocus() }, '全体へ');
  const pill = h('div', { class: 'focus-pill', role: 'status' }, back, fwd, h('span', { class: 'fp-dot' }, '◎'), name, text, counts, tt, btn); stage.append(pill);
  const st = { inst: null, mode: null }; app.focusPill = st;
  const refresh = () => { const inst = st.inst; if (!inst) { pill.classList.remove('on'); return; } name.textContent = inst.mark || inst.name || '部材'; const zoom = st.mode === 'zoom'; text.textContent = zoom ? ' に寄っています' : ' を中心に回しています';
    if (zoom) { const c = app.spotCounts(inst); const parts = [`穴 ${c.holes}`, `溶接線 ${c.welds}`]; if (c.anchors) parts.push(`アンカー ${c.anchors}`); parts.push(`確認 ${c.open}`); counts.textContent = parts.join(' / '); counts.title = '寄った部材の見どころ: 穴・溶接・アンカーの数と未確認の件数。他の部材のラベルは一時的に隠しています'; } else counts.textContent = '';
    tt.style.display = zoom ? '' : 'none'; tt.classList.toggle('on', app.turntableOn()); tt.classList.toggle('live', !!v.controls.autoRotate); back.disabled = !v.canBack; fwd.disabled = !v.canForward; pill.classList.add('on'); };
  st.refresh = refresh;
  const show = (obj, mode) => { const id = obj?.userData?.instId; const inst = id ? app.model.getInstance(id) : null; st.inst = inst; st.mode = inst ? mode : null; app.setSpot(inst && mode === 'zoom' ? inst.id : null); refresh(); };
  v.onFocusChange = show; v.onHistoryChange = () => { if (st.inst) refresh(); }; v.onTurntable = () => { if (st.inst) refresh(); }; show(v.focusObj, v.focusMode);
  // 部材が削除・置換されたら隠す（モデル変更時に存在を確認）
  app.model.on('change', () => { if (st.inst && !app.model.getInstance(st.inst.id)) { v._setFocus(null); } else if (st.inst && st.mode === 'zoom') setTimeout(refresh, 60); });
  return pill;
}
