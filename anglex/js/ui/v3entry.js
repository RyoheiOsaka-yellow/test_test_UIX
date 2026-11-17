// v3 の入口: サインイン → ホーム（新しく作る・図面から・サンプル・続きから）→ 3D の作業。
// 3D の上に薄く重ねる。後ろではモデルがゆっくり回る（秒 30 枚・軽い描画）。v1・v2 には関係しない（v3.js からだけ呼ぶ）
import { h, toast } from './common.js';
import { DEMO_USERS } from '../core/store.js';
import { BRANCHES, branchName } from '../core/branches.js';
import * as OD from '../core/order.js';
import { icon } from './v3.js';

const CSS = `
.v3-entry{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:radial-gradient(1200px 700px at 30% 20%,rgba(255,255,255,.80),rgba(240,242,240,.90) 60%,rgba(232,235,233,.94));opacity:0;transition:opacity .28s ease;overflow:auto;padding:24px 16px}
.v3-entry.in{opacity:1}
body.v3-at-entry .v3-dock,body.v3-at-entry .v3-top,body.v3-at-entry .v3-br,body.v3-at-entry .v3-tl,body.v3-at-entry .v3-left-tab,body.v3-at-entry .v3-zoom,body.v3-at-entry .v3-hint,body.v3-at-entry .v3-empty,body.v3-at-entry .v3-halo,body.v3-at-entry .v3-hd,body.v3-at-entry .v3-hover-tag,body.v3-at-entry .demo-badge{display:none!important}
.v3-brand{display:flex;flex-direction:column;align-items:center;gap:4px;margin-bottom:22px;text-align:center}
.v3-brand .wm{font:700 30px/1 var(--font);letter-spacing:.32em;color:#111827;padding-left:.32em}
.v3-brand .tg{font-size:14px;color:#374151;letter-spacing:.08em}
.v3-brand .sb{font:500 10.5px var(--font);letter-spacing:.3em;color:#9ca3af;text-transform:uppercase}
.v3-card{width:min(440px,calc(100vw - 32px));background:rgba(255,255,255,.94);border:1px solid rgba(20,24,28,.06);border-radius:24px;box-shadow:0 30px 80px rgba(20,24,28,.14),0 2px 6px rgba(20,24,28,.05);padding:26px 26px 22px}
.v3-card h2{font:600 15px var(--font);margin:0 0 4px;color:#111827}.v3-card .lead{font-size:12.5px;color:#6b7280;margin:0 0 16px}
.v3-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.v3-role{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px 10px;border-radius:14px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;font:600 12.5px var(--font);color:#1f2933;transition:border-color .12s,background .12s,transform .12s}
.v3-role:hover{transform:translateY(-1px)}.v3-role.on{border-color:#1f2933;background:#f8fafc}
.v3-role span{font:400 10.5px var(--font);color:#6b7280}
.v3-in{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:11.5px;color:#6b7280}
.v3-in input,.v3-in select{height:42px;border-radius:12px;border:1px solid #e5e7eb;padding:0 12px;font:inherit;font-size:14px;color:#111827;background:#fff;transition:border-color .12s,box-shadow .12s}
.v3-in input:focus,.v3-in select:focus{outline:none;border-color:#1f2933;box-shadow:0 0 0 3px rgba(31,41,51,.08)}
.v3-go{width:100%;height:48px;margin-top:8px;border:none;border-radius:14px;background:#1f2933;color:#fff;font:600 15px var(--font);letter-spacing:.06em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .12s,transform .12s}
.v3-go:hover{background:#0f171e}.v3-go:active{transform:scale(.99)}
.v3-note{font-size:11px;color:#9ca3af;text-align:center;margin-top:12px}
.v3-home{width:min(980px,calc(100vw - 32px))}
.v3-home-top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.v3-home-top .hi{font:600 24px var(--font);color:#111827}.v3-home-top .who{font-size:12.5px;color:#6b7280}
.v3-home-top .sp{flex:1}
.v3-link{border:none;background:none;color:#4b5563;font:500 12.5px var(--font);cursor:pointer;padding:8px 10px;border-radius:10px;display:inline-flex;align-items:center;gap:6px}.v3-link:hover{background:rgba(20,24,28,.06)}
.v3-starts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:26px}
.v3-start{display:flex;flex-direction:column;gap:8px;padding:20px 18px;border-radius:20px;border:1px solid rgba(20,24,28,.06);background:rgba(255,255,255,.92);box-shadow:0 10px 30px rgba(20,24,28,.08);cursor:pointer;text-align:left;font:inherit;color:#111827;transition:transform .14s,box-shadow .14s}
.v3-start:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(20,24,28,.12)}
.v3-start .ic{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#1f2933;color:#fff}
.v3-start.alt .ic{background:#f1f5f9;color:#1f2933}
.v3-start b{font:600 15px var(--font)}.v3-start span{font-size:12px;color:#6b7280;line-height:1.5}
.v3-sec2{display:flex;align-items:baseline;gap:10px;margin:0 2px 10px}.v3-sec2 b{font:600 13px var(--font);color:#374151}.v3-sec2 span{font-size:11.5px;color:#9ca3af}
.v3-projs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.v3-proj{display:grid;grid-template-columns:44px 1fr;gap:4px 12px;align-items:center;padding:14px;border-radius:16px;border:1px solid rgba(20,24,28,.06);background:rgba(255,255,255,.9);cursor:pointer;text-align:left;font:inherit;color:#111827;transition:transform .12s,box-shadow .12s}
.v3-proj:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(20,24,28,.10)}
.v3-proj .rg{grid-row:span 2;width:44px;height:44px;position:relative;display:grid;place-items:center;font:600 10.5px var(--font);color:#374151}
.v3-proj .rg svg{position:absolute;inset:0}
.v3-proj .nm{font:600 13.5px var(--font);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-proj .mt{font-size:11.5px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-proj.cur{border-color:#1f2933}
/* 販売・工場の役割では、形を変える道具を出さない（見る・測る・見積・コメントは使える） */
body[data-v3role="B"] #v3Add,body[data-v3role="B"] #v3Wire,body[data-v3role="B"] #v3Import,body[data-v3role="B"] #v3Instr,body[data-v3role="C"] #v3Add,body[data-v3role="C"] #v3Wire,body[data-v3role="C"] #v3Import,body[data-v3role="C"] #v3Instr,body[data-v3role="B"] #v3Dock .opt,body[data-v3role="C"] #v3Dock .opt{display:none!important}
.v3-empty-projs{padding:18px;border-radius:16px;border:1px dashed #d1d5db;color:#6b7280;font-size:12.5px;text-align:center}
@media(max-width:760px){.v3-starts{grid-template-columns:1fr}.v3-home-top .hi{font-size:20px}}
`;
const ROLES = [{ org: 'A', icon: 'cube', t: '設計・見積', s: 'A社' }, { org: 'B', icon: 'yen', t: '販売', s: 'B社' }, { org: 'C', icon: 'truck', t: '加工工場', s: 'C社' }];
const SS = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { } } };
let cssDone = false;

export function signedIn() { return SS.get('anglex.v3.in') === '1'; }
export function initEntry(app) {
  if (!cssDone) { cssDone = true; document.head.appendChild(h('style', { id: 'v3entryCss' }, CSS)); }
  app.v3.showEntry = view => showEntry(app, view); app.v3.signOut = () => signOut(app);
  if (!signedIn()) showEntry(app, 'signin');
}
function ring(pct, late) { const C = 2 * Math.PI * 19; return `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="#e5e7eb" stroke-width="3"/><circle cx="22" cy="22" r="19" fill="none" stroke="${late ? '#c0392b' : '#1f2933'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 22 22)"/></svg>`; }
function spin(app, on) { const c = app.viewer.controls; c.autoRotate = on; c.autoRotateSpeed = on ? 0.35 : 2; app.viewer.invalidate(1, true); }

export function showEntry(app, view = 'signin') {
  document.querySelector('.v3-entry')?.remove(); document.querySelector('.v3-sheet,.v3-sheet-back')?.remove(); document.body.classList.remove('v3-list', 'v3-props'); document.body.classList.add('v3-at-entry');
  app.select?.(null); spin(app, true); document.body.dataset.smView = 'signin'; /* 部材えらびの B キーなどを入口では効かせない */
  const box = h('div', { class: 'v3-entry', id: 'v3Entry', 'data-view': view }); document.body.append(box); box.append(view === 'home' ? homeView(app) : signinView(app)); requestAnimationFrame(() => box.classList.add('in'));
  if (view === 'signin') setTimeout(() => box.querySelector('[data-k="email"]')?.focus(), 80);
  return box;
}
export function hideEntry(app) { const box = document.querySelector('.v3-entry'); spin(app, false); delete document.body.dataset.smView; document.body.dataset.v3role = app.role(); app.refreshAll?.(); document.body.classList.remove('v3-at-entry'); if (!box) return; box.classList.remove('in'); setTimeout(() => box.remove(), 280); app.viewer.invalidate?.(2); }

// ---------- サインイン ----------
function signinView(app) {
  let org = 'A'; const pool = () => app.store.d?.users || DEMO_USERS;
  const email = h('input', { type: 'email', 'data-k': 'email', autocomplete: 'username', placeholder: 'you@example.com', value: '' });
  const pass = h('input', { type: 'password', 'data-k': 'pass', autocomplete: 'current-password', placeholder: '••••••' });
  const branch = h('select', { 'data-k': 'branch' }, BRANCHES.map(b => h('option', { value: b.code }, b.name)));
  const brRow = h('label', { class: 'v3-in' }, '営業所', branch);
  const fill = () => { const u = pool().find(x => x.org === org && (org !== 'A' || x.branch === branch.value)) || pool().find(x => x.org === org) || DEMO_USERS[0]; email.placeholder = u.email; brRow.style.display = org === 'A' ? '' : 'none'; };
  { const a = pool().find(x => x.org === 'A' && x.branch); if (a && BRANCHES.some(b => b.code === a.branch)) branch.value = a.branch; } branch.addEventListener('change', fill);
  const roles = h('div', { class: 'v3-roles' }, ROLES.map(r => h('button', { type: 'button', class: 'v3-role' + (r.org === org ? ' on' : ''), 'data-org': r.org, onClick: e => { org = r.org; roles.querySelectorAll('.v3-role').forEach(x => x.classList.toggle('on', x.dataset.org === org)); fill(); } }, icon(r.icon, 22), r.t, h('span', {}, r.s))));
  const go = async () => {
    btnGo.disabled = true; try {
      if (app.store.mode === 'server') { await app.store.login(email.value.trim() || email.placeholder, pass.value); }
      else { const br = branch.value; const u = (org === 'A' ? pool().find(x => x.org === 'A' && x.branch === br) : null) || pool().find(x => x.org === org) || DEMO_USERS[0]; await app.store.login(u.email); const s = app.store.session?.(); if (s && org === 'A' && br && s.user.branch !== br) { s.user = { ...s.user, branch: br }; app.store.save?.(); } /* 選んだ営業所で入る */ }
      app.renderUser?.(); SS.set('anglex.v3.in', '1'); toast(`ようこそ、${app.user().name.replace(/（.*）/, '')} さん`, 'ok', 1800); showEntry(app, 'home');
    } catch (e) { toast('サインインできませんでした: ' + e.message, 'bad'); } finally { btnGo.disabled = false; } };
  const btnGo = h('button', { class: 'v3-go', id: 'v3SignIn', onClick: go }, 'はじめる');
  for (const el of [email, pass]) el.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) go(); });
  fill();
  return h('div', {}, h('div', { class: 'v3-brand' }, h('div', { class: 'wm' }, 'ANGLEX'), h('div', { class: 'tg' }, '図面に、語らせる。'), h('div', { class: 'sb' }, 'Fabrication Intelligence')),
    h('div', { class: 'v3-card' }, h('h2', {}, 'サインイン'), h('p', { class: 'lead' }, 'あなたの役割を選んでください。画面と、さわれる操作が変わります。'), roles, brRow, h('label', { class: 'v3-in' }, 'メールアドレス', email), h('label', { class: 'v3-in' }, 'パスワード', pass), btnGo,
      h('div', { class: 'v3-note' }, app.store.mode === 'server' ? 'サーバーの利用者でサインインします' : 'デモ用の認証です。何も入力せずに「はじめる」で進めます')));
}

// ---------- ホーム ----------
function greet() { const hr = new Date().getHours(); return hr < 10 ? 'おはようございます' : hr < 18 ? 'こんにちは' : 'こんばんは'; }
function homeView(app) {
  const u = app.user(); const who = u.name.replace(/（.*）/, ''); const projs = h('div', { class: 'v3-projs', id: 'v3Projs' });
  const enter = async fn => { hideEntry(app); try { await fn?.(); } catch (e) { console.warn(e); } app.viewer.invalidate?.(2); };
  const start = (cls, ic, t, s, run, id) => h('button', { class: 'v3-start ' + cls, 'data-start': id, onClick: () => enter(run) }, h('div', { class: 'ic' }, icon(ic, 22)), h('b', {}, t), h('span', {}, s));
  const canEdit = app.role() === 'A';
  const wrap = h('div', { class: 'v3-home' },
    h('div', { class: 'v3-home-top' }, h('div', {}, h('div', { class: 'hi' }, `${greet()}、${who} さん`), h('div', { class: 'who' }, `${u.company || u.org + '社'}${u.branch ? ' ・ ' + branchName(u.branch) : ''}`)), h('span', { class: 'sp' }), h('button', { class: 'v3-link', id: 'v3SignOut', onClick: () => signOut(app) }, icon('swap', 16), '役割を変える・サインアウト')),
    h('div', { class: 'v3-starts' },
      canEdit ? start('', 'plus', '新しく作る', '部材を選んで、3D で組み立てる', async () => { await app.newProject(); setTimeout(() => app.openPartPicker?.(), 120); }, 'new') : null,
      canEdit ? start('alt', 'import', '図面から作る', 'DXF・PDF・IFC などを読み込んで、部材を拾う', async () => { await app.newProject(); setTimeout(() => document.getElementById('btnImport')?.click(), 120); }, 'drawing') : null,
      start('alt', 'cube', 'サンプルで試す', '配管サポート一式を開いて、さわってみる', async () => { document.getElementById('btnDemoModel')?.click(); }, 'sample'),
      canEdit ? null : start('alt', 'flow', '届いた案件を見る', '見積・加工の依頼を、案件の一覧から開く', async () => { document.getElementById('btnDashboard')?.click(); }, 'inbox')),
    h('div', { class: 'v3-sec2' }, h('b', {}, '続きから'), h('span', { id: 'v3ProjCount' }, '')), projs,
    h('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '14px' } }, h('button', { class: 'v3-link', onClick: () => enter(() => document.getElementById('btnDashboard')?.click()) }, icon('layers', 16), 'すべての案件（ダッシュボード）')));
  fillProjects(app, projs, enter);
  return wrap;
}
async function fillProjects(app, host, enter) {
  let list = []; try { list = await app.listProjectsVisible({}); } catch { } const cur = app.project?.id; const all = list.slice(0, 9); const cnt = document.getElementById('v3ProjCount'); if (cnt) cnt.textContent = list.length ? `${list.length} 件` : '';
  host.innerHTML = ''; if (!all.length) { host.append(h('div', { class: 'v3-empty-projs' }, 'まだ案件がありません。「新しく作る」か「サンプルで試す」から始めましょう')); return; }
  const now = OD.today();
  for (const p of all) { const o = p.order; const pr = o ? OD.progress(o) : null; const st = o ? OD.currentStage(o) : null; const late = o ? OD.lateStages(o, now).length : 0; const n = p.model?.instances?.length || 0; const when = (p.updatedAt || p.createdAt || '').slice(0, 10).replace(/-/g, '/');
    const rg = h('div', { class: 'rg' }); rg.innerHTML = ring(pr ? pr.pct : 0, late) + `<span style="position:relative">${o ? (st ? OD.STAGES.indexOf(st) + 1 : '✓') : n}</span>`;
    host.append(h('button', { class: 'v3-proj' + (p.id === cur ? ' cur' : ''), 'data-pid': p.id, title: o ? `案件の進み: ${st ? st.name : '完了'}` : `部材 ${n} 点`, onClick: () => enter(async () => { if (p.id !== cur) { const d = await app.store.getProject(p.id); if (d) await app.loadProjectData(d); } app.viewer.fit?.(); }) }, rg, h('div', { class: 'nm' }, p.name || '（名前なし）'), h('div', { class: 'mt' }, [p.client, o ? (st ? st.name : '納品済み') : `部材 ${n} 点`, when].filter(Boolean).join(' ・ ')))); }
}
async function signOut(app) { try { await app.store.logout?.(); } catch { } SS.set('anglex.v3.in', null); showEntry(app, 'signin'); }
