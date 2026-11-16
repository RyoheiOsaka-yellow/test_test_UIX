// デモ版: 顧客に渡す試用版の入口。印（デモ版）、進め方の案内、感想メモ、最初の状態に戻す。
// 有効になる条件: ビルド時の旗（window.ANGLEX_DEMO）、URL の ?demo=1、または localStorage の anglex.demo=1
import { h, modal, toast, confirmDialog, download } from './common.js';
import { libraryStats } from './partPicker.js';

const CSS = `
.demo-badge{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:58;display:flex;gap:8px;align-items:center;padding:5px 10px 5px 12px;border-radius:10px 10px 0 0;background:#1d2733;color:#fff;font-size:12px;box-shadow:0 -2px 10px rgba(0,0,0,.2)}
.demo-badge b{letter-spacing:.08em;color:#ffcf8a}
.demo-badge button{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;border-radius:6px;padding:3px 8px;font:inherit;font-size:11.5px;cursor:pointer}
.demo-badge button:hover{background:rgba(255,255,255,.2)}
body[data-sm-view="signin"] .demo-badge .after-signin{display:none}
.demo-steps{display:flex;flex-direction:column;gap:8px;margin:10px 0}
.demo-step{display:grid;grid-template-columns:30px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line,#ddd);border-radius:10px}
.demo-step.done{border-color:var(--ok,#3e8e5a);background:rgba(62,142,90,.07)}
.demo-step .no{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:var(--accent,#c8642a);color:#fff}
.demo-step.done .no{background:var(--ok,#3e8e5a)}
.demo-step .t{font-weight:700}.demo-step .s{font-size:12px;color:var(--muted,#777)}
.demo-notes{font-size:12px;color:var(--muted,#777);line-height:1.7;margin:8px 0 0;padding-left:18px}
.demo-fb textarea{width:100%;min-height:120px}
`;
const KEY = 'anglex.demo', SEEN = 'anglex.demo.seen', DONE = 'anglex.demo.done', FB = 'anglex.demo.feedback';
export function isDemo() { try { if (globalThis.ANGLEX_DEMO === true) return true; if (new URLSearchParams(location.search).get('demo') === '1') return true; return localStorage.getItem(KEY) === '1'; } catch { return false; } }
const done = () => { try { return new Set(JSON.parse(localStorage.getItem(DONE) || '[]')); } catch { return new Set(); } };
const mark = id => { const d = done(); d.add(id); try { localStorage.setItem(DONE, JSON.stringify([...d])); } catch { } };

// 進め方: それぞれ「やってみる」で、その機能が開く
export function demoSteps(app) {
  const click = id => () => document.getElementById(id)?.click(); const to3d = async () => { const sh = app.shell; if (sh && sh.view !== 'app') { sh.showView('app'); sh.maxStep = Math.max(sh.maxStep, app.model.instances.length ? 5 : 1); sh.goStep(app.model.instances.length ? 4 : 1); await new Promise(r => setTimeout(r, 80)); } };
  return [
    { id: 'sample', t: 'サンプルの架台を開く', s: '配管サポート一式のサンプルを 3D で開きます。回す・寄る・部材をクリックして寸法を変える、を試せます', run: async () => { await to3d(); click('btnDemoModel')(); } },
    { id: 'parts', t: '部材を選んで 3D に置く', s: `カタログの ${libraryStats().products} 製品から選びます。画面の右端の「部材を選ぶ」からも、いつでも開けます（B キー）`, run: () => app.openPartPicker?.() },
    { id: 'flow', t: '重量と見積を見る', s: '業務フローの画面で、重量の集計から見積、相手先への受け渡しまでを順に見られます', run: async () => { await to3d(); click('btnFlow')(); } },
    { id: 'order', t: '案件の進行を見る（依頼から納品まで）', s: '段階ごとの確認、期限、工場の選定、書類（注文書・検査記録・納品書）をまとめた画面です', run: async () => { await to3d(); app.openOrder?.(); } },
    { id: 'export', t: '図面・データを書き出す', s: 'IFC・STEP・DXF・NC データ・PDF・Excel など。書き出したファイルは、手元のソフトで開いて確かめられます', run: async () => { await to3d(); click('btnFormats')(); } },
  ];
}
export function openDemoGuide(app) {
  if (document.querySelector('.modal.demoguide')) return null; let m = null; const host = h('div', {}); const st = libraryStats();
  const draw = () => { host.innerHTML = ''; const d = done(); const steps = demoSteps(app);
    host.append(h('p', {}, 'ANGLEX のデモ版です。下の順に試すと、ひととおりの流れが 10 分ほどで分かります。どこから始めても構いません。'),
      h('div', { class: 'demo-steps' }, steps.map((s, i) => h('div', { class: 'demo-step' + (d.has(s.id) ? ' done' : ''), 'data-step': s.id }, h('span', { class: 'no' }, d.has(s.id) ? '✓' : String(i + 1)), h('div', {}, h('div', { class: 't' }, s.t), h('div', { class: 's' }, s.s)), h('button', { class: 'btn sm primary', 'data-act': 'try', onClick: async () => { mark(s.id); m.close(); try { await s.run(); } catch (e) { toast('開けませんでした: ' + e.message, 'warn'); } } }, 'やってみる')))),
      h('ul', { class: 'demo-notes' }, h('li', {}, 'データは、このブラウザの中だけに保存されます。外部には送りません。'), h('li', {}, '単価・工場の一覧・検査の許容差・難易度の基準は、サンプルの値です。'), h('li', {}, `カタログの部材（${st.products} 製品・${st.skus} サイズ）のうち「形は推定」と付いたものは、寸法表の数値から形を起こしています。細部は実物と違うことがあります。`), h('li', {}, '気づいたことは「感想をメモ」に書くと、ファイルにして送れます。'))); };
  draw(); m = modal({ title: 'デモの進め方', cls: 'demoguide', body: host, footer: [h('button', { class: 'btn', onClick: () => { m.close(); openFeedback(app); } }, '感想をメモ'), h('button', { class: 'btn', onClick: () => resetDemo() }, '最初の状態に戻す'), h('button', { class: 'btn primary', onClick: () => m.close() }, '閉じる')] }); try { localStorage.setItem(SEEN, '1'); } catch { } return m;
}
export function openFeedback(app) {
  let notes = []; try { notes = JSON.parse(localStorage.getItem(FB) || '[]'); } catch { } const ta = h('textarea', { placeholder: '例: 部材の一覧に ○○ が欲しい / 見積の内訳で △△ が分かりにくい' }); const list = h('div', {}); let m = null;
  const draw = () => { list.innerHTML = ''; if (!notes.length) { list.append(h('p', { class: 'muted small' }, 'まだメモはありません')); return; } list.append(h('ol', { class: 'demo-notes' }, notes.map((n, i) => h('li', {}, `${n.at.slice(0, 16).replace('T', ' ')}（${n.where}）: ${n.text} `, h('a', { href: '#', onClick: e => { e.preventDefault(); notes.splice(i, 1); save(); draw(); } }, '消す'))))); };
  const save = () => { try { localStorage.setItem(FB, JSON.stringify(notes)); } catch { } };
  const add = () => { const t = ta.value.trim(); if (!t) return; notes.push({ at: new Date().toISOString(), where: app.shell ? (app.shell.view === 'app' ? `3D 手順 ${app.shell.step}` : app.shell.view) : (app.view || '3d'), text: t }); ta.value = ''; save(); draw(); };
  draw(); m = modal({ title: '感想をメモ（デモ版）', cls: 'demo-fb', body: h('div', {}, h('p', { class: 'muted small' }, '使ってみて気づいたことを書き留めます。ファイルにして、担当者へ送ってください。メモはこのブラウザの中に保存されます。'), ta, h('div', { style: { margin: '8px 0' } }, h('button', { class: 'btn sm primary', 'data-act': 'fb-add', onClick: add }, 'メモを足す')), list), footer: [h('button', { class: 'btn', 'data-act': 'fb-save', onClick: () => { add(); if (!notes.length) { toast('メモがありません', 'warn'); return; } download('ANGLEX_デモの感想.txt', ['ANGLEX デモ版の感想', `書き出し: ${new Date().toLocaleString('ja-JP')}`, '', ...notes.map((n, i) => `${i + 1}. [${n.at.slice(0, 16).replace('T', ' ')} / ${n.where}] ${n.text}`)].join('\r\n'), 'text/plain'); toast('感想をファイルにしました', 'ok'); } }, 'ファイルにする'), h('button', { class: 'btn primary', onClick: () => m.close() }, '閉じる')] }); return m;
}
export async function resetDemo() { if (!await confirmDialog('このブラウザに保存されているデモのデータ（案件・見積・コメント・設定）をすべて消して、最初の状態に戻します。よろしいですか。', { ok: '最初の状態に戻す', danger: true })) return; try { for (const k of Object.keys(localStorage)) if (k.startsWith('anglex')) localStorage.removeItem(k); } catch { } try { indexedDB.deleteDatabase('anglex'); } catch { } location.reload(); }

export function initDemo(app) {
  if (!isDemo()) return false; globalThis.__anglexDemo = true; document.body.classList.add('anx-demo'); document.head.appendChild(h('style', { id: 'demoCss' }, CSS));
  document.body.appendChild(h('div', { class: 'demo-badge', id: 'demoBadge' }, h('b', {}, 'デモ版'), h('span', {}, '試用のためのデータで動いています'), h('button', { id: 'btnDemoGuide', class: 'after-signin', onClick: () => openDemoGuide(app) }, '進め方'), h('button', { id: 'btnDemoFeedback', class: 'after-signin', onClick: () => openFeedback(app) }, '感想をメモ')));
  const note = document.getElementById('smAuthNote'); if (note) note.textContent = '※ デモ版です。何も入力せずに「サインイン」を押してください。';
  app.openDemoGuide = () => openDemoGuide(app);
  // 初回だけ、サインインのあとに進め方を出す
  const first = () => { try { if (localStorage.getItem(SEEN) === '1') return; } catch { } if (globalThis.__anglexNoGuide) return; setTimeout(() => { if (!document.querySelector('.modal-back')) openDemoGuide(app); }, 500); };
  const sh = app.shell; if (sh) { const orig = sh.showView; let shown = false; sh.showView = name => { const r = orig(name); if (!shown && name !== 'signin') { shown = true; first(); } return r; }; } else first();
  return true;
}
