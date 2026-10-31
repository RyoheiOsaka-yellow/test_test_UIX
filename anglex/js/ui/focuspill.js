// 掴んだ部材のピル: 部材をクリック（掴む）して中央へ寄せた後、画面の隅に「◎ MF-2 を中心に回しています」を出し続ける。
// 回している間も何を中心にしているかが分かる。「全体へ」ボタンか Esc で全体中心に戻す。部材が消えたら自動で隠す
import { $, h } from './common.js';
export function installFocusPill(app) {
  const stage = $('#d3stage') || $('#stage'); if (!stage || stage.querySelector('.focus-pill')) return null; const v = app.viewer;
  const name = h('b'); const btn = h('button', { class: 'fp-clear', title: '全体を中央へ戻す（Esc）', onClick: () => app.clearFocus() }, '全体へ');
  const pill = h('div', { class: 'focus-pill', role: 'status' }, h('span', { class: 'fp-dot' }, '◎'), name, h('span', { class: 'fp-text' }, ' を中心に回しています'), btn); stage.append(pill);
  const st = { inst: null }; app.focusPill = st;
  const show = obj => { const id = obj?.userData?.instId; const inst = id ? app.model.getInstance(id) : null; st.inst = inst; if (!inst) { pill.classList.remove('on'); return; } name.textContent = inst.mark || inst.name || '部材'; pill.classList.add('on'); };
  v.onFocusChange = show; show(v.focusObj);
  // 部材が削除・置換されたら隠す（モデル変更時に存在を確認）
  app.model.on('change', () => { if (st.inst && !app.model.getInstance(st.inst.id)) { v._setFocus(null); } });
  return pill;
}
