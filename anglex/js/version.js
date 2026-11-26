// 画面ごとの版。ここを書き換えると、タイトル・切替ボタン・単一ファイルの名前（ANGLEX_v1.1.html など）がそろって変わる。
export const VERSION = { v1: '1.1', v2: '2.1', v3: '3.1' };
export const uiKey = () => document.body.dataset.ui === 'v3' ? 'v3' : document.getElementById('smBrand') ? 'v2' : 'v1';
export const verLabel = (k = uiKey()) => 'v' + VERSION[k];
// 単一ファイル版の名前: ANGLEX_v2.1.html / ANGLEX_v2.1_offline.html
export const distName = (k, suffix = '') => `ANGLEX_v${VERSION[k]}${suffix}.html`;
export function applyVersion() { const k = uiKey(); document.title = `ANGLEX ${verLabel(k)} — Fabrication Intelligence`; document.body.dataset.ver = VERSION[k];
  const set = (sel, text) => { for (const el of document.querySelectorAll(sel)) el.textContent = text; }; const other = k === 'v2' ? 'v1' : 'v2';
  if (k !== 'v3') { set('#btnSwitchUI, #smSwitchUI', `⇄ UI ${verLabel(other)}`); set('#btnToV3', `✦ ${verLabel('v3')}`); }
  for (const el of document.querySelectorAll('.brand-sub, .sm-sub')) if (!/v\d+\.\d+/.test(el.textContent)) el.textContent = `${el.textContent.trim()} · ${verLabel(k)}`; }
