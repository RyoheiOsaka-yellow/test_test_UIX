// シェル（元デモ ANGLEX v1 の見た目）: サインイン → モード選択 → 案件管理 / かんたん見積チャット / 5 ステップ 3D 詳細モード
// エンジン（Model / Viewer / families / cost / review）はそのまま。ここは入口・ステッパー・ディテールカード・分解のみ。
import * as THREE from 'three';
import { $, $$, h, toast, confirmDialog, promptDialog, fmt, table } from './common.js';
import { DEMO_USERS } from '../core/store.js';
import { BRANCHES, branchName, branchShort, canSeeProject } from '../core/branches.js';
import * as WF from '../core/workflow.js';
import { familyById, CATEGORIES } from '../bim/families.js';
import { summarize } from '../bim/weight.js';
import { costParts, yen } from '../bim/cost.js';
import { buildChecklist, openCount, detectMisalignment, holeDSL } from '../bim/review.js';
import { parseSpec, sectionOutline, sectionProps, holeFaces, FACE_LABEL } from '../geo/profiles.js';
import { CATALOG } from '../data/catalog.js';
import { renderEstimatePanel, createEstimate } from './estimate.js';
import { renderDrawingView } from './importer.js';
import { openAlign, openAlerts } from './review.js';
import { addTypeFromProduct } from './catalog.js';

const STATUS_JA = { confirmed: '確定', inferred: '推論', review: '要判断' };
const STATUS_CLS = { confirmed: 'ok', inferred: 'warn', review: 'bad' };

export function initShell(app) {
  const sh = { step: 1, maxStep: 1, view: 'signin', chat: null, balloons: false, _t: null };
  app.shell = sh;
  // ---------- 画面切替 ----------
  sh.showView = name => {
    sh.view = name; const root = $('#sm-root'); const appEl = $('#app');
    if (name === 'app') { root.classList.add('sm-hidden'); appEl.classList.remove('sm-hidden'); app.viewer.resize(); app.viewer.invalidate(2); return; }
    appEl.classList.add('sm-hidden'); root.classList.remove('sm-hidden');
    $$('.sm-view').forEach(v => v.classList.toggle('sm-active', v.id === 'sm-view-' + name));
    $('#smTopbar').style.display = name === 'signin' ? 'none' : 'flex';
    $('#smAcctName').textContent = `${app.user().name} ・ ${WF.ROLES[app.user().org]?.name || ''}`;
    if (name === 'projects') renderProjects();
    if (name === 'chat' && !sh.chat) chatStart();
  };
  sh.enterApp = step => { sh.showView('app'); const n = step || (app.model.instances.length ? 4 : 1); sh.unlockFor(); sh.goStep(n); };
  // ---------- サインイン ----------
  const fillBranches = () => { const sel = $('#sm-inBranch'); if (!sel) return; sel.innerHTML = ''; for (const b of BRANCHES) sel.append(h('option', { value: b.code }, b.name)); }; fillBranches();
  const signIn = async () => {
    const email = $('#sm-inEmail').value.trim(); const pass = $('#sm-inPass').value; const org = $('#sm-inOrg').value;
    if (app.store.mode === 'server') { try { await app.store.login(email, pass); } catch (e) { toast('サインイン失敗: ' + e.message, 'bad'); return; } }
    else { const br = $('#sm-inBranch')?.value || null; const pool = app.store.d?.users || DEMO_USERS; const u = (org === 'A' ? pool.find(x => x.org === 'A' && x.branch === br) : null) || pool.find(x => x.org === org) || DEMO_USERS[0]; await app.switchUser({ ...u, branch: org === 'A' ? (br || u.branch) : u.branch, name: email && !email.includes('@example.com') ? `${email.split('@')[0]}（${u.company || u.org + '社'}）` : u.name }); }
    app.renderUser(); toast(`サインインしました: ${app.user().name}`, 'ok'); sh.showView('modeselect');
  };
  $('#smSignIn').addEventListener('click', signIn); $('#sm-inPass').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  $('#smSignOut').addEventListener('click', () => { sh.chat = null; sh.showView('signin'); });
  $('#smToMode').addEventListener('click', () => sh.showView('modeselect')); $('#smBrand').addEventListener('click', () => sh.showView('projects'));
  $('#smModeChat').addEventListener('click', () => sh.showView('chat')); $('#smMode3D').addEventListener('click', () => sh.enterApp()); $('#smModeProjects').addEventListener('click', () => sh.showView('projects'));
  $('#smNewChat').addEventListener('click', () => { sh.chat = null; sh.showView('chat'); }); $('#smNewDrawing').addEventListener('click', async () => { await app.newProject(); sh.enterApp(1); });
  $('#smChatTo3D').addEventListener('click', () => sh.enterApp(app.model.instances.length ? 4 : 1));
  $('#appBrand').addEventListener('click', () => sh.showView('projects')); $('#btnProjects').addEventListener('click', () => sh.showView('projects'));
  // ---------- 案件管理 ----------
  async function renderProjects() {
    const host = $('#sm-projGrid'); host.innerHTML = ''; const u = app.user(); const allP = await app.store.listProjects(); const projects = allP.filter(p => canSeeProject(u, p, { all: sh.allBranches })); const ests = await app.store.listEstimates();
    if (u.branch && u.scope !== 'all') host.append(h('div', { class: 'sm-branch-bar' }, h('span', { class: 'muted small' }, sh.allBranches ? `全営業所の案件（${allP.length}）` : `${branchName(u.branch)} の案件（${projects.length} / 全 ${allP.length}）`), h('button', { class: 'sm-btn', onClick: () => { sh.allBranches = !sh.allBranches; renderProjects(); } }, sh.allBranches ? '自営業所だけ' : '全営業所を表示')));
    else host.append(h('div', { class: 'sm-branch-bar' }, h('span', { class: 'muted small' }, `全営業所の案件（${projects.length}）`), ...BRANCHES.map(b => { const n = projects.filter(p => p.branch === b.code).length; return n ? h('span', { class: 'chip ghost' }, `${b.short} ${n}`) : null; })));
    if (!projects.length) { host.append(h('div', { class: 'sm-empty' }, '案件がありません。「＋ 新規案件」から始めるか、サンプル DXF／サンプルモデルを読み込んでください。')); return; }
    const groups = new Map(); for (const p of projects) { const k = p.client || '顧客未設定'; (groups.get(k) || groups.set(k, []).get(k)).push(p); }
    for (const [client, list] of groups) {
      const sent = ests.filter(e => list.some(p => p.id === e.projectId) && e.status !== 'draft').length;
      const card = h('div', { class: 'sm-cust' }, h('div', { class: 'sm-cust-h' }, h('div', { class: 'sm-cust-name' }, '🏢 ' + client), h('div', { class: 'sm-cust-meta' }, `案件 ${list.length} 件 ・ 受け渡し見積 ${sent} 通`)));
      const grid = h('div', { class: 'sm-cust-projs' });
      for (const p of list) {
        const pe = ests.filter(e => e.projectId === p.id); const latest = pe[0]; const ni = p.model?.instances?.length || 0; const nt = p.model?.types?.length || 0;
        const st = latest ? latest.status : 'draft'; const stCls = { draft: 'draft', to_B: 'estimating', to_C: 'estimating', from_C: 'estimating', final: 'confirmed', rejected: 'archived' }[st] || 'draft';
        const tot = latest ? WF.totals(latest) : null;
        const pc = h('div', { class: 'sm-pcard' + (p.id === app.project.id ? ' cur' : '') },
          h('div', { class: 'sm-pc-h' }, h('div', {}, h('div', { class: 'sm-pc-name' }, p.name, ' ', h('span', { class: 'chip ghost', style: { fontSize: '10px' } }, branchShort(p.branch))), h('div', { class: 'sm-pc-client' }, `${ni} インスタンス / ${nt} タイプ ・ 更新 ${fmt.date(p.updatedAt)}`)), h('span', { class: 'sm-pc-status ' + stCls }, latest ? WF.STATUS[st] : '未見積')),
          h('div', { class: 'sm-pc-stats' }, h('div', { class: 'sm-pc-stat' }, h('div', { class: 'k' }, '見積'), h('div', { class: 'v' }, String(pe.length))), h('div', { class: 'sm-pc-stat' }, h('div', { class: 'k' }, '最新 見積額（税抜）'), h('div', { class: 'v' + (tot ? '' : ' warn') }, tot ? yen(tot.b) : '—')), latest ? h('span', { class: 'sm-ver ' + (latest.status !== 'draft' ? 'sent' : '') , style: { alignSelf: 'center', marginLeft: 'auto' } }, `Rev.${latest.revision} ${latest.status !== 'draft' ? '受け渡し済' : '下書き'}`) : null),
          pe.length ? h('div', { class: 'sm-pc-hist' }, h('div', { class: 'sm-hist-h' }, '見積バージョン履歴'), ...pe.slice(0, 4).map(e => h('div', { class: 'sm-hist-row' }, h('span', { class: 'sm-hist-v' }, 'v' + e.revision), h('span', { class: 'sm-hist-no' }, e.no), h('span', { class: 'sm-hist-d' }, fmt.date(e.updatedAt)), h('span', { class: 'sm-hist-t' }, yen(WF.totals(e).b)), h('span', { class: 'sm-hist-s' }, `${WF.STATUS[e.status]} / ${WF.ROLES[e.currentOrg].name}`)))) : null,
          h('div', { class: 'sm-pc-actions' }, h('button', { class: 'sm-btn primary', onClick: async () => { await openProject(p.id); sh.enterApp(app.model.instances.length ? 4 : 1); } }, '再開（3D）'), h('button', { class: 'sm-btn', onClick: async () => { await openProject(p.id); sh.enterApp(5); } }, '見積'), h('button', { class: 'sm-btn', onClick: async () => { await openProject(p.id); sh.enterApp(3); } }, '部材選択'), app.role() === 'A' ? h('button', { class: 'sm-btn', onClick: async () => { if (!(await confirmDialog(`「${p.name}」を削除しますか？`, { danger: true }))) return; await app.store.deleteProject(p.id); renderProjects(); } }, '削除') : null));
        grid.append(pc);
      }
      card.append(grid); host.append(card);
    }
  }
  async function openProject(id) { if (id === app.project.id) return; const full = await app.store.getProject(id); if (full) await app.loadProjectData(full); }
  sh.renderProjects = renderProjects;
  // ---------- ステッパー ----------
  sh.unlockFor = () => { const n = app.model.instances.length; const hasDwg = !!app.drawing; sh.maxStep = Math.max(sh.maxStep, n ? 5 : hasDwg ? 3 : 1); };
  // コンパクトモード: ウィンドウ高 700px 未満では 3D カードを先頭・全幅にし、他のカードは見出しだけ（クリックで開閉）
  const applyCompact = () => { const on = innerHeight < 700; document.body.classList.toggle('compact', on); }; applyCompact(); addEventListener('resize', applyCompact);
  $$('.dcard-head').forEach(hd => hd.addEventListener('click', e => { if (!document.body.classList.contains('compact') || e.target.closest('button,input,select,a')) return; const card = hd.closest('.dcard'); if (card && card.id !== 'card3d') card.classList.toggle('open'); }));
  sh.goStep = n => {
    sh.unlockFor(); if (n > sh.maxStep) { toast(n <= 3 ? '図面を読み込むか、サンプルを選んでください' : '部材を配置するとディテール・見積へ進めます', 'warn'); return; }
    sh.step = n; $$('.wf-step').forEach(s => { const k = +s.dataset.step; s.classList.toggle('active', k === n); s.classList.toggle('done', k < n); s.classList.toggle('locked', k > sh.maxStep); });
    for (let k = 1; k <= 5; k++) $('#pane' + k).hidden = k !== n; $('#stage').scrollTop = 0; $('#fabChat').style.display = n === 4 && app.role() === 'A' ? 'flex' : 'none';
    if (n === 3) { renderDrawingView(app, $('#drawing')); $('#drawing').classList.toggle('dark', !!app.drawing); renderDetectList(); }
    if (n === 4) { app.viewer.resize(); app.viewer.invalidate(2); renderDetail(); if (!app.selection && app.model.instances.length) { app.select(app.model.instances[0].id); app.viewer.fit(); } }
    if (n === 5) renderEstimatePanel(app, $('#estHost'));
  };
  $$('.wf-step').forEach(s => s.addEventListener('click', () => sh.goStep(+s.dataset.step)));
  $('#btnBackToSelect').addEventListener('click', () => sh.goStep(3)); $('#btnToQuote').addEventListener('click', () => sh.goStep(5));
  $('#uploadZone').addEventListener('click', () => $('#fileInput').click());
  $('#wsTabPlan').addEventListener('click', () => { sh.goStep(4); app.setView('plan'); });
  // ---------- 分析ログ ----------
  let t0 = 0; sh.analysisStart = name => { sh.showView('app'); sh.maxStep = Math.max(sh.maxStep, 2); sh.goStep(2); t0 = performance.now(); $('#alog').innerHTML = ''; $('#recHost').innerHTML = ''; $('#anTitle').textContent = '図面を読み解いています'; $('#anSub').textContent = name; sh.analysisProgress(5, '読込'); sh.analysisLog(`取込: ${name}`, 'ac'); };
  sh.analysisLog = (txt, cls = '') => { const el = h('div', { class: 'ln' }, h('span', { class: 'ts' }, '+' + ((performance.now() - t0) / 1000).toFixed(1).padStart(4, '0') + 's'), h('span', { class: cls }, txt)); $('#alog').append(el); $('#alog').scrollTop = 99999; };
  sh.analysisProgress = (pct, txt) => { $('#pf').style.width = pct + '%'; $('#pl-pct').textContent = pct + '%'; if (txt) $('#pl-txt').textContent = txt; };
  sh.analysisDone = (rec) => { sh.analysisProgress(100, '完了 — 配置する部材を選んでください'); $('#anTitle').textContent = '読込完了'; if (rec) { const n = rec.members?.length || 0; const c = s => rec.members.filter(m => m.status === s).length; sh.analysisLog(`部材候補 ${n} 件: 確定 ${c('confirmed')} / 推論 ${c('inferred')} / 要判断 ${c('review')}（リスク行列 Case B）`, 'ok'); if (rec.notes?.length) sh.analysisLog(`注記・加工指示テキスト ${rec.notes.length} 件`, ''); } };
  // ---------- 検出部材リスト（③） ----------
  function renderDetectList() {
    const host = $('#detectList'); host.innerHTML = ''; const insts = app.model.instances; $('#detectCount').textContent = `${insts.length} 件`;
    if (!insts.length) { host.append(h('div', { class: 'sm-empty' }, '部材がありません。図面を読み込むか、3D ディテールのカタログから配置してください。')); return; }
    const byCat = new Map(); for (const i of insts) { const fam = app.model.familyOf(i); const k = fam.category || 'その他'; (byCat.get(k) || byCat.set(k, []).get(k)).push(i); }
    for (const [cat, list] of byCat) { host.append(h('div', { class: 'detect-group-label' }, cat)); for (const i of list) { const t = app.model.getType(i.typeId); const p = app.model.resolved(i); const items = buildChecklist(i, app.instanceParts(i)); const open = openCount(items); const conf = i.status === 'confirmed' ? 98 : i.status === 'inferred' ? 80 : 55;
      host.append(h('div', { class: 'detect-row' + (i.id === app.selection ? ' sel' : ''), onClick: () => { app.select(i.id); sh.goStep(4); app.viewer.fit(app.groups.get(i.id)); } }, h('div', { class: 'detect-swatch ' + i.status }), h('div', { class: 'detect-info' }, h('div', { class: 'detect-name' }, i.mark + ' ' + t.name, h('span', { class: 'chip ' + (i.source === 'import' ? 'warn' : 'ghost') }, i.source === 'import' ? '図面' : '配置'), open ? h('span', { class: 'chip bad' }, `⚑ ${open}`) : null), h('div', { class: 'detect-spec' }, [p.spec || p.colSpec || p.beamSpec || '', p.L ? `L=${p.L}` : p.W ? `W=${p.W}` : '', p.pipes || '', p.finish || ''].filter(Boolean).join(' ・ '))), h('div', { class: 'detect-conf ' + STATUS_CLS[i.status] }, `${STATUS_JA[i.status]} ${conf}%`, h('div', { class: 'conf-bar' }, h('div', { class: 'conf-fill', style: { width: conf + '%', background: 'currentColor' } }))))); } }
  }
  sh.renderDetectList = renderDetectList;
  app.onDrawingPick = memberId => { const inst = app.model.instances.find(i => i.importRef === memberId); if (inst) { app.select(inst.id); sh.goStep(4); app.viewer.fit(app.groups.get(inst.id)); } else toast('この認識枠はまだモデルに配置されていません（読込・分析 → 配置）', 'warn'); };
  // ---------- ディテール（④） ----------
  function renderDetail() {
    const inst = app.selectedInstance(); const open = app.openReviewCount(); const cnt = $('#alertCnt'); cnt.textContent = open || ''; cnt.classList.toggle('on', !!open);
    if (!inst) { $('#detMark').textContent = app.project.name; $('#detSpec').textContent = `${app.model.instances.length} インスタンス / ${app.model.types.length} タイプ — 3D 上の部材をクリック、または「部材選択」から選んでください`; $('#detStatus').textContent = ''; for (const id of ['sectionHost', 'integHost', 'explodeHost', 'catalogHost']) $('#' + id).innerHTML = '<div class="pp-empty">部材を選択してください</div>'; renderCost(null); return; }
    const t = app.model.getType(inst.typeId); const fam = app.model.familyOf(inst); const p = app.model.resolved(inst); const parts = app.instanceParts(inst);
    $('#detMark').textContent = `${inst.mark} ${t.name}`; $('#detSwatch').style.background = { confirmed: 'var(--ok)', inferred: 'var(--warn)', review: 'var(--bad)' }[inst.status]; $('#detStatus').textContent = `${STATUS_JA[inst.status]}${inst.source === 'import' ? ' ・ 図面読込' : ''} ・ ${fam.name}`; $('#detStatus').className = 'dcard-badge ' + (inst.status === 'confirmed' ? '' : 'ai');
    $('#detSpec').textContent = [p.spec || p.colSpec, p.L ? `L=${p.L}` : '', p.W ? `W=${p.W}` : '', p.H ? `H=${p.H}` : '', p.pipes ? `配管 ${p.pipes}` : '', p.finish, `部品 ${parts.filter(x => !x.ref).length} 点`].filter(Boolean).join(' ・ ');
    renderSection(inst, parts); renderInteg(inst); renderExplode(inst, parts); renderCost(inst, parts); renderCatalogMatch(inst, fam);
  }
  sh.renderDetail = renderDetail;
  // 断面図 SVG（外形・板厚・穴の面別一覧）
  function renderSection(inst, parts) {
    const host = $('#sectionHost'); host.innerHTML = ''; const mem = parts.find(x => !x.ref && ['member', 'plate', 'pipe'].includes(x.kind)); if (!mem) { host.append(h('div', { class: 'pp-empty' }, '断面を持つ部品がありません')); return; }
    const sp = parseSpec(mem.spec); if (!sp) { host.append(h('div', { class: 'pp-empty' }, mem.spec)); return; }
    let pts; try { pts = sectionOutline(sp); } catch { pts = null; }
    const sprops = (() => { try { return sectionProps(sp); } catch { return null; } })();
    if (pts && pts.length) {
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); const w = x1 - x0 || 1, hh = y1 - y0 || 1; const pad = Math.max(w, hh) * 0.28; const vb = `${x0 - pad} ${-(y1 + pad)} ${w + 2 * pad} ${hh + 2 * pad}`;
      const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + (-q[1])).join(' ') + ' Z'; const sw = Math.max(w, hh) / 160; const fs = Math.max(w, hh) / 14;
      const svg = `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="#dfe3e8" stroke="#1a1a17" stroke-width="${sw}" stroke-linejoin="round"/>
        <line x1="${x0}" y1="${-(y0 - pad * 0.45)}" x2="${x1}" y2="${-(y0 - pad * 0.45)}" class="dim-line" stroke-width="${sw}"/><text x="${(x0 + x1) / 2}" y="${-(y0 - pad * 0.62)}" class="dim-txt" style="font-size:${fs}px" text-anchor="middle">${Math.round(w)}</text>
        <line x1="${x1 + pad * 0.45}" y1="${-y0}" x2="${x1 + pad * 0.45}" y2="${-y1}" class="dim-line" stroke-width="${sw}"/><text x="${x1 + pad * 0.62}" y="${-(y0 + y1) / 2}" class="dim-txt" style="font-size:${fs}px" text-anchor="middle" transform="rotate(90 ${x1 + pad * 0.62} ${-(y0 + y1) / 2})">${Math.round(hh)}</text></svg>`;
      host.insertAdjacentHTML('beforeend', svg);
    }
    const dims = h('div', { class: 'sec-dims' }, h('span', {}, `仕様 ${sp.label || mem.spec}`), sp.t ? h('span', {}, `t=${sp.t}`) : null, h('span', {}, `L=${Math.round(mem.length)}`), sprops?.area ? h('span', {}, `断面積 ${Math.round(sprops.area)} mm²`) : null, sprops?.unitMass ? h('span', {}, `単位質量 ${sprops.unitMass} kg/m`) : null, mem.finish ? h('span', {}, mem.finish) : null);
    host.append(dims);
    const holes = (mem.holes || []); if (holes.length) { const byFace = {}; for (const hole of holes) (byFace[hole.face] ||= []).push(hole); host.append(h('div', { class: 'pp-group-title', style: { marginTop: '10px' } }, `穴（${holes.length}）`), table(['面', '位置 z / s', '径', '用途'], holes.slice(0, 40).map(hole => [FACE_LABEL[hole.face] || hole.face, `${hole.z} / ${hole.s}`, hole.slot ? `${hole.d}×${hole.slot.len} 長穴` : `φ${hole.d}`, { anchor: 'アンカー', ubolt: 'Uボルト', rod: '吊ボルト', joint: '接合', extra: '指示' }[hole.kind] || (hole.extra ? '指示' : hole.id ? '接合' : '一般')]))); }
    const others = parts.filter(x => !x.ref && ['member', 'plate', 'pipe'].includes(x.kind) && x !== mem); if (others.length) host.append(h('div', { class: 'muted small', style: { marginTop: '8px' } }, `他の断面部品: ${[...new Set(others.map(x => x.spec))].join(', ')}（分解図で部品ごとに確認）`));
  }
  // 整合チェック: 干渉 + ズレ + 接合
  function renderInteg(inst) {
    const host = $('#integHost'); host.innerHTML = ''; let clashes = [], align = [];
    try { clashes = app.findClashes().filter(c => c.a.id === inst.id || c.b.id === inst.id); } catch (e) { console.error(e); }
    try { align = detectMisalignment(app).filter(a => a.instIds.includes(inst.id)); } catch (e) { console.error(e); }
    const joints = app.model.joints.filter(j => j.a === inst.id || j.b === inst.id);
    host.append(h('div', { class: 'integ-sum' }, h('span', { class: 'chip ' + (clashes.length ? 'bad' : 'ok') }, `干渉 ${clashes.length}`), h('span', { class: 'chip ' + (align.length ? 'warn' : 'ok') }, `ズレ ${align.length}`), h('span', { class: 'chip ' + (joints.some(j => j.warning) ? 'warn' : 'ghost') }, `接合 ${joints.length}`)));
    $('#integBadge').textContent = clashes.length + align.length ? `${clashes.length + align.length} 件` : 'OK';
    const list = h('div', { class: 'integ-list' });
    for (const c of clashes) list.append(h('div', { class: 'integ-row bad' }, h('span', {}, `干渉: ${c.a.mark} ${c.pa} × ${c.b.mark} ${c.pb}（重なり ${Math.round(c.vol).toLocaleString()} mm³）`), h('button', { class: 'btn sm', onClick: () => { app.viewer.controls.target.copy(c.c); app.viewer.camera.position.copy(c.c.clone().add(new THREE.Vector3(500, 400, 500))); app.viewer.invalidate(2); } }, '注視')));
    for (const a of align) list.append(h('div', { class: 'integ-row warn' }, h('span', {}, a.label), a.fix ? h('button', { class: 'btn sm primary', onClick: () => { try { a.fix(); toast('補正: ' + a.fixLabel, 'ok'); } catch (e) { toast(e.message, 'bad'); } app.refreshBrowser(); app.refreshProps(); renderDetail(); } }, a.fixLabel) : h('span', { class: 'muted small' }, a.fixLabel)));
    for (const j of joints) list.append(h('div', { class: 'integ-row ' + (j.warning ? 'warn' : 'ok') }, h('span', {}, `接合 ${j.label}${j.warning ? ' — ' + j.warning : ''}`), h('button', { class: 'btn sm', onClick: () => app.selectJoint(j.id) }, '詳細')));
    if (!clashes.length && !align.length && !joints.length) list.append(h('div', { class: 'integ-row ok' }, h('span', {}, '干渉・ズレはありません。接合が未定義なら「加工 → 接合」で溶接／ボルトを定義してください。')));
    host.append(list, h('div', { class: 'cost-foot' }, h('button', { class: 'btn sm', onClick: () => app.clashCheck() }, '干渉チェック（全体）'), h('button', { class: 'btn sm', onClick: () => openAlign(app) }, 'ズレ補正（全体）'), h('button', { class: 'btn sm', onClick: () => openAlerts(app) }, '確認リスト')));
  }
  // 分解図: スライダー・バルーン・部品表・個別部材化
  function renderExplode(inst, parts) {
    const host = $('#explodeHost'); host.innerHTML = ''; const fam = app.model.familyOf(inst); const real = parts.filter(x => !x.ref && x.kind !== 'weld'); const welds = parts.filter(x => x.kind === 'weld');
    $('#explodeBadge').textContent = `${real.length} 部品 / 溶接 ${welds.length}`;
    const rng = $('#rngExplode'); const slider = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: rng.value, onInput: e => { rng.value = e.target.value; app.viewer.setExplode(+e.target.value, app.groups.get(inst.id) || null); app.drawLevels?.(); } }); // 選択部材だけを分解（モデル全体ではなく）
    host.append(h('div', { class: 'explode-ctl' }, h('span', {}, '分解'), slider, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: sh.balloons, onChange: e => { sh.balloons = e.target.checked; app.setBalloons(e.target.checked ? inst.id : null); } }), 'バルーン'), h('button', { class: 'btn sm', onClick: () => { slider.value = 0; rng.value = 0; app.viewer.setExplode(0); } }, '戻す')));
    const sumItems = summarize(real).items || [];
    const rows = real.map((pt, i) => { const w = sumItems.find(x => x === pt || x.name === pt.name); const mass = w?.mass ?? w?.total ?? null; const proc = [pt.holes?.length ? `穴 ${pt.holes.length}` : null, pt.kind === 'member' || pt.kind === 'plate' ? '切断' : null].filter(Boolean).join(' / '); return [h('span', { class: 'balloon' }, String(i + 1)), pt.name || pt.kind, pt.spec || pt.M || pt.custom || '', pt.length ? `${Math.round(pt.length)}` : '', mass != null ? fmt.kg(mass) : '—', proc || '—']; });
    host.append(h('table', { class: 'bom-table' }, h('thead', {}, h('tr', {}, ['No', '部品', '仕様', '長さ', '質量', '加工'].map((x, i) => h('th', { class: i >= 3 ? 'r' : '' }, x)))), h('tbody', {}, rows.map(r => h('tr', {}, r.map((c, i) => h('td', { class: i >= 3 ? 'r' : '' }, c instanceof Node ? c : String(c))))))));
    if (welds.length) host.append(h('div', { class: 'muted small', style: { marginTop: '6px' } }, `溶接 ${welds.length} 本 / 総長 ${Math.round(welds.reduce((a, w) => a + w.length, 0))} mm（${welds.filter(w => w.site).length} 本が現場）`));
    const canUngroup = fam.id !== 'member' && fam.id !== 'plate' && real.some(x => ['member', 'plate', 'pipe'].includes(x.kind));
    host.append(h('div', { class: 'cost-foot' }, h('button', { class: 'btn sm primary', disabled: !canUngroup || app.role() !== 'A', title: canUngroup ? '組立品を単材・板のインスタンスに分解（穴・仕様・配置を保持）' : '単材／板は分解できません', onClick: async () => { if (!(await confirmDialog(`${inst.mark} を ${real.filter(x => ['member', 'plate', 'pipe'].includes(x.kind)).length} 個の個別部材に分解しますか？\nボルト類・溶接は集計から外れます（接合として再定義できます）。元に戻すには Ctrl+Z。`))) return; app.ungroupInstance(inst.id); } }, '分解（個別部材化）'), h('button', { class: 'btn sm', onClick: () => app.screenshotAndDownload?.() ?? $('#btnShot').click() }, '分解図を画像保存')));
  }
  // 積算
  function renderCost(inst, parts) {
    const host = $('#costHost'); host.innerHTML = ''; const R = app.rates();
    const allRows = app.model.explodeParts().filter(r => !r.ref); const allSum = summarize(allRows); const allCost = costParts(allRows, R);
    if (inst) { const c = costParts(parts, R); const s = c.weight; host.append(h('div', { class: 'cost-kpis' }, kpi('質量', fmt.kg(s.total)), kpi('材料費', yen(c.material)), kpi('加工費（切断・穴・溶接・組立）', yen(c.cut + c.hole + c.weld + c.bend + c.assembly)), kpi('工場原価（1 台）', yen(c.factoryPrice))), h('div', { class: 'cost-break' }, `めっき ${yen(c.finish)}（付着 ${fmt.kg(s.zinc)}）/ ボルト類 ${yen(c.fasteners)} / 一般管理費 ${yen(c.overhead)} / 利益 ${yen(c.profit)}${c.siteWeld ? ` / 現場溶接 ${yen(c.siteWeld)}` : ''}`)); }
    host.append(h('div', { class: 'pp-group-title', style: { marginTop: '12px' } }, `モデル全体（${app.model.instances.length} インスタンス）`), h('div', { class: 'cost-kpis' }, kpi('総質量', fmt.kg(allSum.total)), kpi('鋼材（穴控除後）', fmt.kg(allSum.steelNet)), kpi('溶接長', Math.round(allSum.weldLength) + ' mm'), kpi('工場原価 合計', yen(allCost.factoryPrice))), h('div', { class: 'cost-foot' }, h('button', { class: 'btn sm', onClick: () => $('#btnSchedules').click() }, '集計表'), h('button', { class: 'btn sm', onClick: () => $('#btnWeightPdf').click() }, '重量計算書 PDF'), h('button', { class: 'btn sm', onClick: () => $('#btnWeightXlsx').click() }, 'XLSX'), h('button', { class: 'btn sm', onClick: () => $('#btnRates').click() }, '単価表'), h('button', { class: 'btn sm primary', onClick: () => sh.goStep(5) }, '概算見積へ →')));
  }
  const kpi = (l, v) => h('div', { class: 'cost-kpi' }, h('div', { class: 'cost-kpi-label' }, l), h('div', { class: 'cost-kpi-value' }, v));
  // カタログ照合
  function renderCatalogMatch(inst, fam) {
    const host = $('#catalogHost'); host.innerHTML = ''; const prods = CATALOG.products.filter(p => p.family === fam.id).slice(0, 6);
    if (!prods.length) { host.append(h('div', { class: 'muted small' }, `ファミリ「${fam.name}」に対応するカタログ製品はありません（特注加工品として見積）。`)); return; }
    host.append(h('div', { class: 'sc-readnote' }, h('b', {}, `${fam.name}`), ` に該当するカタログ製品 ${prods.length} 件。寸法・仕様が一致すれば規格品として、異なれば特注加工品（第14章）として発注区分を判断します。`));
    host.append(h('div', { class: 'catalog-match' }, ...prods.map(p => h('div', { class: 'oc-row' }, h('span', { class: 'oc-lbl' }, `${p.pid} / 第${p.chapter}章`), h('span', { class: 'oc-val' }, p.name, h('span', { class: 'muted small' }, p.skus?.length ? `（${p.skus.length} SKU / ${p.finish || ''}）` : '')), h('button', { class: 'btn sm', onClick: () => { try { addTypeFromProduct(app, p, p.skus?.[0]); toast('カタログからタイプを追加しました', 'ok'); } catch (e) { toast(e.message, 'bad'); } } }, 'タイプ追加')))));
  }
  // ---------- ツールストリップ ----------
  $$('.tmenu > .tbtn[data-menu]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const m = b.parentElement; const open = m.classList.contains('open'); $$('.tmenu.open').forEach(x => x.classList.remove('open')); if (!open) m.classList.add('open'); }));
  document.addEventListener('click', e => { if (!e.target.closest('.tmenu')) $$('.tmenu.open').forEach(x => x.classList.remove('open')); });
  $$('.tpop .tbtn').forEach(b => b.addEventListener('click', () => $$('.tmenu.open').forEach(x => x.classList.remove('open'))));
  $('#btnLegend').addEventListener('click', () => { const on = $('#legendPanel').classList.toggle('open'); $('#btnLegend').classList.toggle('active', on); if (on) app.refreshBrowser(); });
  $('#btnZoomIn').addEventListener('click', () => zoom(0.8)); $('#btnZoomOut').addEventListener('click', () => zoom(1.25));
  function zoom(f) { const v = app.viewer; const d = v.camera.position.clone().sub(v.controls.target).multiplyScalar(f); v.camera.position.copy(v.controls.target.clone().add(d)); v.controls.update(); v.invalidate(2); }
  $('#fabChat').addEventListener('click', () => { const b = $('#instrBox'); b.hidden = !b.hidden; $('#fabChat').classList.toggle('on', !b.hidden); if (!b.hidden) $('#instrInput').focus(); });
  $('#btnUngroup').addEventListener('click', () => { const i = app.selectedInstance(); if (!i) { toast('分解する組立品を選択してください', 'warn'); return; } app.ungroupInstance(i.id); });
  // ---------- 更新フック ----------
  sh.onSelect = () => { if (sh.view !== 'app') return; if (sh.step === 4) renderDetail(); if (sh.step === 3) renderDetectList(); };
  sh.onModelChange = () => { clearTimeout(sh._t); sh._t = setTimeout(() => { if (sh.view !== 'app') return; sh.unlockFor(); $$('.wf-step').forEach(s => s.classList.toggle('locked', +s.dataset.step > sh.maxStep)); if (sh.step === 4) renderDetail(); if (sh.step === 3) renderDetectList(); }, 120); };
  sh.onProjectLoaded = () => { sh.maxStep = 1; sh.unlockFor(); if (sh.view === 'app') sh.goStep(Math.min(sh.step, sh.maxStep)); };
  // ---------- かんたん見積チャット ----------
  const PRODUCTS = [['門型架台(ベース付)', 'portal_frame', { base: true }], ['門型架台', 'portal_frame', { base: false }], ['L型ブラケット', 'bracket_L', {}], ['三角ブラケット', 'bracket_tri', {}], ['吊りサポート（アングル）', 'hanger_support', {}], ['チャンネルサポート', 'channel_stand', {}], ['アングルポール', 'pole', {}], ['鋼板加工（穴あけ板）', 'plate', {}]].filter(x => familyById(x[1]));
  const SIZES = ['20A', '25A', '32A', '40A', '50A', '65A', '80A', '100A', '125A', '150A']; const FINISHES = [['HDZ', '溶融亜鉛めっき（ドブ）'], ['EZ', '電気亜鉛めっき'], ['BLACK', '黒皮（無処理）'], ['SUS304', 'ステンレス SUS304']];
  function chatStart() { sh.chat = { step: 0, product: null, size: null, finish: null, qty: null, inst: null }; $('#sm-chatInner').innerHTML = ''; bot('かんたん見積へようこそ。いくつか選んでいくだけで、確認すべき加工指示と概算が出ます。\nまず、何を製作しますか？', 'カタログ第13・14章', PRODUCTS.map(p => [p[0], () => pickProduct(p)])); }
  function bot(text, src, opts) { const inner = $('#sm-chatInner'); const el = h('div', { class: 'sm-msg bot' }, h('div', { class: 'sm-ava' }, 'A'), h('div', { class: 'sm-content' }, h('div', { class: 'sm-bubble' }, text), src ? h('span', { class: 'sm-src catalog' }, src) : null, opts?.length ? h('div', { class: 'sm-opts' }, ...opts.map(([lbl, fn, cls]) => h('button', { class: 'sm-opt' + (cls ? ' ' + cls : ''), onClick: e => { $$('.sm-opt', e.target.parentElement).forEach(b => b.classList.toggle('sel', b === e.target)); fn(); } }, lbl))) : null)); inner.append(el); inner.parentElement.scrollTop = 1e9; return el; }
  function user(text) { const inner = $('#sm-chatInner'); inner.append(h('div', { class: 'sm-msg user' }, h('div', { class: 'sm-bubble' }, text))); inner.parentElement.scrollTop = 1e9; }
  function pickProduct(p) { sh.chat.product = p; sh.chat.step = 1; user(p[0]); const needPipe = ['portal_frame', 'bracket_L', 'bracket_tri', 'hanger_support', 'channel_stand', 'pole'].includes(p[1]); if (needPipe) bot('載せる配管の呼び径は？（複数は「125A,32A」のように自由入力）', 'JIS G 3452 SGP 外径 → Uボルト寸法', SIZES.map(s => [s, () => pickSize(s)])); else pickSize(null); }
  function pickSize(s) { sh.chat.size = s; sh.chat.step = 2; if (s) user(s); bot('仕上げは？', 'JIS H 8641 めっき付着量 → 重量・単価', FINISHES.map(f => [f[1], () => pickFinish(f[0])])); }
  function pickFinish(f) { sh.chat.finish = f; sh.chat.step = 3; user(FINISHES.find(x => x[0] === f)[1]); bot('数量は？', null, ['1', '2', '4', '8', '10'].map(n => [n + ' 台', () => pickQty(+n)])); }
  function pickQty(n) { sh.chat.qty = n; sh.chat.step = 4; user(n + ' 台'); const typing = bot('', null); typing.querySelector('.sm-bubble').className = 'sm-bubble sm-typing'; typing.querySelector('.sm-bubble').append(h('span'), h('span'), h('span')); setTimeout(() => { typing.remove(); buildFromChat(); }, 600); }
  function buildFromChat() {
    const c = sh.chat; const [label, famId, extra] = c.product; const fam = familyById(famId); const params = { ...extra }; if (c.size && fam.params.some(d => d.key === 'pipes')) params.pipes = c.size; if (fam.params.some(d => d.key === 'finish')) params.finish = c.finish;
    const tname = `${label}${c.size ? ' ' + c.size : ''} ${c.finish}`; const t = app.model.addType(famId, tname, params); const x0 = app.model.instances.length ? Math.max(...app.model.instances.map(i => i.pos[0])) + 1200 : 0; let first = null;
    for (let i = 0; i < c.qty; i++) { const inst = app.model.addInstance(t.id, { pos: [x0, 0, i * 900], params: {} }); inst.status = 'inferred'; inst.reviewReasons = ['チャット概算: 寸法はファミリ既定値（図面根拠なし）']; if (!first) first = inst; }
    c.inst = first; app.rebuildAll(); app.refreshBrowser();
    const parts = app.instanceParts(first); const cost = costParts(parts, app.rates()); const s = cost.weight; const items = buildChecklist(first, parts); const total = cost.factoryPrice * c.qty;
    const est = h('div', { class: 'sm-est' }, h('div', { class: 'sm-est-h' }, h('span', { class: 'lab' }, '概算（工場原価・税抜）'), h('span', { class: 'tot' }, yen(total), h('small', {}, `${c.qty} 台 ・ ${fmt.kg(s.total * c.qty)}`))), h('div', { class: 'sm-est-b' }, h('div', { class: 'sm-cost-split' }, h('span', {}, `材料 ${yen(cost.material)}`), h('span', {}, `加工 ${yen(cost.cut + cost.hole + cost.weld + cost.bend + cost.assembly)}`), h('span', {}, `めっき ${yen(cost.finish)}`), h('span', {}, `ボルト類 ${yen(cost.fasteners)}`), h('span', {}, `管理・利益 ${yen(cost.overhead + cost.profit)}`), h('span', {}, '／台')), h('div', { class: 'sm-jassume' }, `寸法はファミリ「${fam.name}」の既定値（W・H・持出し等）で算定。図面があれば 3D 詳細モードで読み込むと確定値に置き換わります。`), ...items.slice(0, 8).map(it => h('div', { class: 'sm-jrow' }, h('span', { class: 'sm-jdot ' + (it.status === 'open' ? 'amber' : 'green') }), h('span', { class: 'sm-jtype' }, { weld: '溶接', hole: '穴あけ', anchor: 'アンカー', ubolt: 'Uボルト', rod: '吊ボルト', finish: '仕上げ', origin: '図面根拠', risk: 'リスク' }[it.kind] || it.kind), h('span', { class: 'sm-jval' }, it.label), h('span', { class: 'sm-jbadge ' + (it.status === 'open' ? 'amber' : 'green') }, it.status === 'open' ? '要確認' : 'OK')))), h('div', { class: 'sm-est-foot' }, h('span', { class: 'verdict' }, '確認事項 ', h('b', {}, String(openCount(items))), ' 件 — 3D で確定すると見積精度が上がります')));
    const inner = $('#sm-chatInner'); inner.append(h('div', { class: 'sm-msg bot' }, h('div', { class: 'sm-ava' }, 'A'), h('div', { class: 'sm-content', style: { width: '100%' } }, h('div', { class: 'sm-bubble' }, `${tname} × ${c.qty} 台 の概算です。モデルに ${c.qty} 体を配置しました（符号 ${first.mark}〜）。`), est)));
    inner.append(h('div', { class: 'sm-actions' }, h('button', { class: 'sm-cta', onClick: () => { app.select(first.id); sh.enterApp(4); app.viewer.fit(app.groups.get(first.id)); } }, '3D で加工指示を確定する →', h('small', {}, '溶接・穴・Uボルトの確認')), h('div', { class: 'sm-act-row' }, h('button', { class: 'sm-btn2', onClick: async () => { const r = await createEstimate(app); if (r) { toast('見積を作成しました', 'ok'); sh.enterApp(5); } } }, '見積書を作成（A社 → B社へ）'), h('button', { class: 'sm-btn2', onClick: () => { sh.chat = { ...sh.chat, step: 0 }; bot('追加で製作するものはありますか？', null, PRODUCTS.map(p => [p[0], () => pickProduct(p)])); } }, '別の製品を追加'))));
    inner.parentElement.scrollTop = 1e9;
  }
  $('#smChatForm').addEventListener('submit', e => { e.preventDefault(); const f = $('#sm-chatField'); const txt = f.value.trim(); if (!txt) return; f.value = ''; chatFree(txt); });
  function chatFree(txt) {
    const c = sh.chat || (sh.chat = { step: 0 }); const prod = PRODUCTS.find(p => txt.includes(p[0].replace(/\(.*\)/, '')) || txt.includes(p[0]));
    const sizes = (txt.match(/\d+\s*A/g) || []).map(s => s.replace(/\s/g, '')); const fin = txt.match(/ステン|SUS/) ? 'SUS304' : txt.match(/電気/) ? 'EZ' : txt.match(/黒|無処理/) ? 'BLACK' : txt.match(/めっき|ドブ|HDZ/) ? 'HDZ' : null; const qty = txt.match(/(\d+)\s*(台|個|本|set|セット)/);
    user(txt);
    if (c.step === 0) { if (!prod) { bot('製品名が分かりませんでした。下から選んでください。', null, PRODUCTS.map(p => [p[0], () => pickProduct(p)])); return; } c.product = prod; c.step = 1; }
    if (c.step === 1) { if (sizes.length) { c.size = sizes.join(','); c.step = 2; } else { bot('配管の呼び径は？', null, SIZES.map(s => [s, () => pickSize(s)])); return; } }
    if (c.step === 2) { if (fin) { c.finish = fin; c.step = 3; } else { bot('仕上げは？', null, FINISHES.map(f => [f[1], () => pickFinish(f[0])])); return; } }
    if (c.step === 3) { if (qty) { c.qty = +qty[1]; c.step = 4; buildFromChat(); } else bot('数量は？', null, ['1', '2', '4', '8', '10'].map(n => [n + ' 台', () => pickQty(+n)])); return; }
    if (c.step >= 4) { if (prod) { c.product = prod; c.size = sizes.join(',') || c.size; c.finish = fin || c.finish; c.qty = qty ? +qty[1] : c.qty; buildFromChat(); } else bot('次は「3D で加工指示を確定する」か、別の製品名を入力してください。'); }
  }
  // ---------- 起動 ----------
  sh.start = () => {
    const qp = new URLSearchParams(location.search); const v = qp.get('view');
    if (qp.get('handoff')) { sh.enterApp(5); return; }
    if (v === '3d') { sh.showView('app'); sh.enterApp(app.model.instances.length ? 4 : 1); return; }
    if (v === 'chat') { sh.showView('chat'); return; } if (v === 'projects') { sh.showView('projects'); return; }
    fillBranches(); sh.showView('signin');
  };
  return sh;
}
