// 操作ガイド（3D 上のオーバーレイ）: 初回起動時と「?」の「操作ガイドを再表示」で、パン・回転・中央へ・分解・部材を動かす を短い CSS アニメーションで案内する
import { $, h } from './common.js';
const KEY = 'anglex.guideSeen';
const CARDS = [
  { k: 'rotate', t: '回る', d: '左ドラッグで空間をぐるぐる回す（既定）', svg: '<svg viewBox="0 0 120 70"><rect class="gd-obj" x="45" y="22" width="30" height="26" rx="3"/><path class="gd-arc" d="M20 50 A45 28 0 0 1 100 50" /><g class="gd-cursor gd-rot"><path d="M0 0 l6 14 l-4 -1 l3 7 l-3 1 l-3 -7 l-3 3z"/></g></svg>' },
  { k: 'pan', t: '掴んで動かす', d: '右ドラッグで画面全体を掴んで動かす（✋/⟳ で左右を入替）', svg: '<svg viewBox="0 0 120 70"><g class="gd-pan"><rect class="gd-obj" x="30" y="22" width="30" height="26" rx="3"/><rect class="gd-obj light" x="68" y="30" width="22" height="18" rx="3"/></g><g class="gd-cursor gd-grab"><circle r="7"/></g></svg>' },
  { k: 'center', t: '中央へ', d: '部材をクリック（掴む）と中央へ寄り、そこを中心に回せる。空白をダブルクリックで全体を中央へ', svg: '<svg viewBox="0 0 120 70"><g class="gd-center"><rect class="gd-obj" x="80" y="40" width="26" height="20" rx="3"/></g><circle class="gd-cross" cx="60" cy="35" r="9"/><line class="gd-cross" x1="48" y1="35" x2="72" y2="35"/><line class="gd-cross" x1="60" y1="23" x2="60" y2="47"/></svg>' },
  { k: 'move', t: '部材を動かす', d: '選択した部材をそのままドラッグ（5mm 刻み・Shift で軸固定）/ G で矢印', svg: '<svg viewBox="0 0 120 70"><rect class="gd-ghost" x="30" y="24" width="30" height="24" rx="3"/><g class="gd-move"><rect class="gd-obj sel" x="30" y="24" width="30" height="24" rx="3"/></g><g class="gd-cursor gd-movec"><path d="M0 0 l6 14 l-4 -1 l3 7 l-3 1 l-3 -7 l-3 3z"/></g></svg>' },
  { k: 'explode', t: '分解', d: '部材を選択して「分解図」（スライダーで部品を開く）', svg: '<svg viewBox="0 0 120 70"><g class="gd-ex a"><rect class="gd-obj" x="40" y="30" width="40" height="8" rx="2"/></g><g class="gd-ex b"><rect class="gd-obj light" x="40" y="40" width="40" height="8" rx="2"/></g><g class="gd-ex c"><circle class="gd-obj dark" cx="48" cy="34" r="3"/><circle class="gd-obj dark" cx="72" cy="34" r="3"/></g></svg>' },
];
export function guideSeen() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
export function showGuide(app, { auto = false } = {}) {
  const stage = $('#d3stage') || $('#stage'); if (!stage || stage.querySelector('.guide-ov')) return null;
  const close = () => { ov.remove(); try { localStorage.setItem(KEY, '1'); } catch { } };
  const ov = h('div', { class: 'guide-ov', onClick: e => { if (e.target === ov) close(); } }, h('div', { class: 'guide-box' }, h('div', { class: 'guide-head' }, h('b', {}, '3D の操作'), h('span', { class: 'muted small' }, auto ? '初回だけ表示します（「?」キーからいつでも再表示）' : '「?」キーのショートカット一覧からも開けます'), h('button', { class: 'icon-btn', title: '閉じる', onClick: close }, '✕')),
    h('div', { class: 'guide-cards' }, ...CARDS.map(c => h('div', { class: 'guide-card ' + c.k }, (() => { const a = h('div', { class: 'guide-anim' }); a.innerHTML = c.svg; return a; })(), h('b', {}, c.t), h('div', { class: 'muted small' }, c.d)))),
    h('div', { class: 'guide-foot' }, h('span', { class: 'muted small' }, 'ホイール: カーソル位置でズーム ／ F: 全体表示 ／ Space 長押し: 掴む⇄回す を一時入替 ／ Esc: 選択解除 ／ タッチ: 1 本指で掴む・2 本指で回す／ズーム・長押しで部材を掴む ／ 右下の地図で移動' ), h('button', { class: 'btn sm primary', onClick: close }, 'はじめる'))));
  stage.append(ov); return ov;
}
export function maybeShowGuide(app) { if (guideSeen() || globalThis.__anglexNoGuide) return; setTimeout(() => { if (app.model.instances.length && !document.querySelector('.modal-back')) showGuide(app, { auto: true }); }, 1800); }
