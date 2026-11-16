// 案件進行: 相談・依頼 → 図面共有 → 仕様整理 → 積算・見積 → 作図・承認 → 工場選定・手配 → 製作 → 検査・書類 → 納品・検収
// 段階ごとに「確認（自動で数えるもの + 手で付けるもの）」「次の一手」「期限」を並べ、履歴を残す。ロジックは js/core/order.js
import { $, h, modal, toast, fmt, table, promptDialog, confirmDialog, download, csv } from './common.js';
import * as OD from '../core/order.js';
import { summarize } from '../bim/weight.js';
import { downloadPdf } from './pdfgen.js';
import { pinCounts, togglePins } from './pins.js';
import { openAlerts } from './review.js';
import { openEstimate } from './estimate.js';
import { exportWorkOrderPDF, exportWeightPDF } from './reports.js';
import { openSchedules } from './schedules.js';
import { exportInspectionXLSX, exportInspectionPDF } from './inspection.js';

const CSS = `
.order-wrap{display:grid;grid-template-columns:250px 1fr;gap:14px;min-height:480px}
.order-head{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:10px}
.order-head .big{font-size:15px;font-weight:700}
.order-bar{flex:1 1 160px;height:8px;border-radius:4px;background:var(--line,#ddd);overflow:hidden;min-width:120px}
.order-bar>i{display:block;height:100%;background:var(--accent,#c8642a);transition:width .25s}
.order-steps{display:flex;flex-direction:column;gap:2px}
.order-step{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;cursor:pointer;border:1px solid transparent;text-align:left;background:none;color:inherit;font:inherit}
.order-step:hover{background:rgba(127,127,127,.10)}
.order-step.sel{border-color:var(--accent,#c8642a);background:rgba(200,100,42,.08)}
.order-step .dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;border:2px solid var(--line,#bbb);color:var(--muted,#888)}
.order-step.done .dot{background:var(--ok,#3e8e5a);border-color:var(--ok,#3e8e5a);color:#fff}
.order-step.doing .dot{border-color:var(--accent,#c8642a);color:var(--accent,#c8642a)}
.order-step.hold .dot{border-color:var(--warn,#c79a2a);color:var(--warn,#c79a2a)}
.order-step .nm{font-weight:600;font-size:13px}.order-step .sub{font-size:11px;color:var(--muted,#888)}
.order-step .late{color:var(--bad,#c0392b);font-weight:700}
.order-pane h3{margin:0 0 4px;font-size:15px}
.order-checks{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:4px}
.order-checks li{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:6px;background:rgba(127,127,127,.07);font-size:13px}
.order-checks li.ok{background:rgba(62,142,90,.10)}.order-checks li .mk{width:18px;text-align:center;font-weight:700}
.order-checks li.ok .mk{color:var(--ok,#3e8e5a)}.order-checks li.ng .mk{color:var(--bad,#c0392b)}
.order-checks li .why{margin-left:auto;font-size:11px;color:var(--muted,#888)}
.order-acts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.order-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin:8px 0}
.order-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted,#777)}
.order-form .wide{grid-column:1/-1}
.order-fac{display:grid;grid-template-columns:1fr auto;gap:6px 10px;padding:9px 10px;border:1px solid var(--line,#ddd);border-radius:8px;margin-bottom:6px}
.order-fac.best{border-color:var(--ok,#3e8e5a)}.order-fac.ng{opacity:.72}.order-fac.chosen{border-color:var(--accent,#c8642a);background:rgba(200,100,42,.06)}
.order-fac .t{font-weight:700}.order-fac .r{font-size:12px;color:var(--muted,#777)}
.order-hist{max-height:340px;overflow:auto}
.order-note{font-size:12px;color:var(--muted,#888);margin:6px 0}
.order-kpi{display:flex;gap:6px;flex-wrap:wrap}
@media(max-width:820px){.order-wrap{grid-template-columns:1fr}.order-form{grid-template-columns:1fr}}
`;
let cssDone = false; const ensureCss = () => { if (cssDone) return; cssDone = true; document.head.appendChild(h('style', { id: 'orderCss' }, CSS)); };

// 工場の一覧（会社で 1 つ。ブラウザに保存）
const FKEY = 'anglex.factories';
export function loadFactories() { try { const a = JSON.parse(localStorage.getItem(FKEY) || 'null'); if (Array.isArray(a) && a.length) return a; } catch { } return OD.SAMPLE_FACTORIES.map(f => ({ ...f, caps: [...f.caps] })); }
export function saveFactories(list) { try { localStorage.setItem(FKEY, JSON.stringify(list)); } catch { } }

export function orderNeed(app) { const rows = app.model.explodeParts().filter(r => !r.ref); const need = OD.needsOf(rows); try { need.mass = summarize(rows).total || need.mass; } catch { } return need; }
export function ensureOrder(app) { if (!app.project.order) { app.project.order = OD.newOrder({ project: app.project, user: app.user(), need: orderNeed(app) }); app.scheduleAutosave?.(); } return app.project.order; }
const save = app => { app.scheduleAutosave?.(); app.flowRefresh?.(); refreshOrderBadge(app); };

// 段階ごとの確認。auto は画面の状態から数える。manual は人が付ける
export async function stageChecks(app, order, stageId, ctx = null) {
  const c = ctx || await orderContext(app); const st = order.stages[stageId]; const man = (key, label) => ({ key, label, manual: true, ok: !!st.manual?.[key] }); const auto = (ok, label, why = '') => ({ label, ok: !!ok, why });
  switch (stageId) {
    case 'request': return [auto(order.request.customer, '顧客名が入っている'), auto(order.request.due, '希望納期が入っている'), man('agreed', '依頼の内容を依頼者と確認した')];
    case 'drawing': return [auto(c.hasDrawing || c.instances > 0, '図面またはモデルがある', c.hasDrawing ? '図面あり' : `部材 ${c.instances}`), auto(c.pinsOpen === 0, '未解決のコメントがない', `未解決 ${c.pinsOpen}`)];
    case 'spec': return [auto(c.instances > 0, '部材が 1 つ以上ある', `部材 ${c.instances}`), auto(c.openReview === 0, '確認事項が残っていない', `残り ${c.openReview}`), man('agreed', '材質と仕上げを依頼者と確認した')];
    case 'quote': return [auto(!!c.est, '見積がある', c.est ? c.est.no : ''), auto(c.est?.status === 'final', '見積が確定している', c.est ? c.estStatus : '')];
    case 'shop': return [man('workorder', '加工指示書を出した'), man('approved', '承認をもらった')];
    case 'factory': return [auto(!!order.factory, '工場が決まっている', order.factory?.name || ''), man('ordered', '注文書を送った')];
    case 'make': return [man('started', '製作を始めた'), man('finished', '製作が終わった')];
    case 'inspect': return [auto(!!c.inspection, '検査記録を読み込んだ', c.inspection ? `合格 ${c.inspection.counts?.ok ?? 0}` : ''), auto(c.inspection && !(c.inspection.counts?.ng > 0), '不合格がない', c.inspection ? `不合格 ${c.inspection.counts?.ng ?? 0}` : ''), man('docs', '品質書類（ミルシート・めっき証明など）をそろえた')];
    case 'deliver': return [auto(order.delivery.date, '納品日が入っている', order.delivery.date), auto(order.delivery.receiver, '受け取った人が入っている', order.delivery.receiver), auto(order.delivery.accepted === true, '検収が済んでいる', order.delivery.accepted === false ? '不合格' : '')];
  }
  return [];
}
export async function orderContext(app) {
  let list = []; try { list = await app.store.listEstimates(app.project.id); } catch { }
  const est = (app.currentEstimateId && list.find(e => e.id === app.currentEstimateId)) || list[0] || null; let pc = { open: 0 }; try { pc = pinCounts(app); } catch { }
  let WFS = null; try { WFS = (await import('../core/workflow.js')).STATUS; } catch { }
  return { instances: app.model.instances.length, hasDrawing: !!app.drawing, pinsOpen: pc.open ?? 0, openReview: app.openReviewCount(), est, estStatus: est ? (WFS?.[est.status] || est.status) : '', inspection: app.project.inspection || null, need: orderNeed(app) };
}

export function refreshOrderBadge(app) { const b = document.getElementById('orderCnt'); const btn = document.getElementById('btnOrder'); if (!btn) return; const o = app.project?.order; if (!o) { if (b) b.textContent = ''; btn.classList.remove('has-late'); return; } const cur = OD.currentStage(o); const late = OD.lateStages(o).length; if (b) b.textContent = cur ? `${OD.STAGES.indexOf(cur) + 1}/${OD.STAGES.length}` : '✓'; btn.classList.toggle('has-late', late > 0); btn.title = cur ? `案件進行: いまは「${cur.name}」${late ? `（期限を過ぎた段階 ${late}）` : ''}` : '案件進行: 納品・検収まで完了'; }

export async function openOrder(app, { tab = 'flow', stage = null } = {}) {
  ensureCss(); const order = ensureOrder(app); const user = app.user(); let sel = stage || OD.currentStage(order)?.id || 'deliver'; let curTab = tab; let m = null;
  const host = h('div', { class: 'order-host' });
  const tabsBar = h('div', { class: 'tabs' }); const TABS = [['flow', '進行'], ['factory', '工場'], ['history', '変更と履歴'], ['docs', '書類'], ['board', '全案件']];
  const render = async () => {
    const ctx = await orderContext(app); host.innerHTML = ''; tabsBar.innerHTML = ''; for (const [id, name] of TABS) tabsBar.append(h('button', { class: 'tab' + (curTab === id ? ' on' : ''), 'data-tab': id, onClick: () => { curTab = id; render(); } }, name));
    host.append(head(ctx), tabsBar);
    if (curTab === 'flow') host.append(await flowTab(ctx)); else if (curTab === 'factory') host.append(factoryTab(ctx)); else if (curTab === 'history') host.append(historyTab()); else if (curTab === 'docs') host.append(docsTab(ctx)); else host.append(await boardTab());
    refreshOrderBadge(app);
  };
  const head = ctx => { const p = OD.progress(order); const cur = OD.currentStage(order); const slack = OD.dueSlack(order); const late = OD.lateStages(order);
    return h('div', { class: 'order-head' }, h('span', { class: 'big' }, order.no), h('span', { class: 'chip ghost' }, order.request.customer || '顧客未入力'), h('span', { class: 'chip ' + ({ A: 'ok', B: 'warn', C: 'bad' }[order.difficulty.cls]), title: order.difficulty.reasons.map(r => `${r.why} +${r.pts}`).join('\n') || '加工が少ない' }, '難易度 ' + order.difficulty.label),
      h('span', { class: 'chip ghost' }, cur ? `いま: ${cur.name}` : '完了'), h('div', { class: 'order-bar', title: `${p.done} / ${p.total} 段階` }, h('i', { style: { width: p.pct + '%' } })), h('span', { class: 'muted small' }, `${p.pct}%`),
      h('span', { class: 'chip ' + (slack == null ? 'ghost' : slack < 0 ? 'bad' : 'ok'), 'data-k': 'slack' }, slack == null ? `完了見込み ${OD.finishDate(order) || '—'}` : slack < 0 ? `希望納期に ${-slack} 日足りない` : `希望納期まで余裕 ${slack} 日`), late.length ? h('span', { class: 'chip bad' }, `期限を過ぎた段階 ${late.length}`) : null); };

  // ---- 進行 ----
  const flowTab = async ctx => { const steps = h('div', { class: 'order-steps' }); const now = OD.today();
    OD.STAGES.forEach((s, i) => { const st = order.stages[s.id]; const late = st.status !== 'done' && st.due && st.due < now; steps.append(h('button', { class: `order-step ${st.status}${sel === s.id ? ' sel' : ''}`, 'data-stage': s.id, onClick: () => { sel = s.id; render(); } }, h('span', { class: 'dot' }, st.status === 'done' ? '✓' : String(i + 1)), h('span', {}, h('div', { class: 'nm' }, s.name), h('div', { class: 'sub' }, `${s.owner} ・ ${OD.STATUS_JA[st.status]}`)), h('span', { class: 'sub' + (late ? ' late' : '') }, st.status === 'done' ? (st.doneAt || '').slice(5, 10).replace('-', '/') + ' 済' : (st.due || '').slice(5).replace('-', '/')))); });
    return h('div', { class: 'order-wrap' }, steps, await stagePane(ctx)); };
  const stagePane = async ctx => { const s = OD.stageById(sel); const st = order.stages[sel]; const checks = await stageChecks(app, order, sel, ctx); const pane = h('div', { class: 'order-pane' });
    pane.append(h('h3', {}, s.name, ' ', h('span', { class: 'chip ' + ({ done: 'ok', doing: 'warn', hold: 'warn', todo: 'ghost' }[st.status]) }, OD.STATUS_JA[st.status])), h('div', { class: 'order-note' }, `${s.hint}。担当: ${s.owner}。期限: ${st.due || '—'}${st.doneAt ? `。完了: ${fmt.date(st.doneAt)}（${st.by || ''}）` : ''}`));
    if (sel === 'request') pane.append(requestForm()); if (sel === 'deliver') pane.append(deliveryForm());
    pane.append(h('ul', { class: 'order-checks' }, checks.map(c => h('li', { class: c.ok ? 'ok' : 'ng' }, c.manual ? h('input', { type: 'checkbox', checked: c.ok, disabled: st.status === 'done', 'data-check': c.key, onChange: e => { (st.manual ||= {})[c.key] = e.target.checked; OD.log(order, { user, stage: sel, action: 'note', note: `${c.label}: ${e.target.checked ? 'はい' : 'いいえ'}` }); save(app); render(); } }) : h('span', { class: 'mk' }, c.ok ? '✓' : '!'), h('span', {}, c.label), h('span', { class: 'why' }, c.manual ? '手で付ける' : (c.why || '自動'))))));
    pane.append(h('div', { class: 'order-acts' }, stageActions(ctx)));
    const note = h('input', { placeholder: 'メモ（完了のときに履歴へ残します）', value: st.note || '', style: { width: '100%' }, onChange: e => { st.note = e.target.value; save(app); } }); pane.append(note);
    const foot = h('div', { class: 'order-acts' });
    if (st.status !== 'done') { foot.append(h('button', { class: 'btn primary', 'data-act': 'complete', onClick: async () => { let r = OD.completeStage(order, sel, { user, checks, note: note.value }); if (!r.ok) { const ok = await confirmDialog(`${r.reason}。\nこのまま完了にしますか（履歴に「未達あり」と残ります）。`, { ok: 'このまま完了', danger: true }); if (!ok) return; r = OD.completeStage(order, sel, { user, checks, force: true, note: note.value }); } save(app); toast(`「${s.name}」を完了にしました`, 'ok'); if (r.next) sel = r.next; render(); } }, 'この段階を完了にする'), h('button', { class: 'btn', onClick: () => { OD.setHold(order, sel, st.status !== 'hold', { user }); save(app); render(); } }, st.status === 'hold' ? '保留を解く' : '保留にする')); }
    else foot.append(h('button', { class: 'btn', 'data-act': 'reopen', onClick: async () => { const r = await promptDialog('差し戻しの理由', [{ key: 'note', label: '理由', type: 'text', value: '' }]); if (!r) return; OD.reopenStage(order, sel, { user, note: r.note }); save(app); render(); } }, '差し戻す'));
    pane.append(foot); return pane; };
  const field = (label, input, cls = '') => h('label', { class: cls }, label, input);
  const requestForm = () => { const q = order.request; const inp = (k, type = 'text', ph = '') => h('input', { type, value: q[k] ?? '', placeholder: ph, 'data-req': k, onChange: e => { q[k] = type === 'number' ? +e.target.value : e.target.value; if (k === 'due' || k === 'finish') OD.replan(order, { need: orderNeed(app) }); OD.log(order, { user, stage: 'request', action: 'request', note: `${{ customer: '顧客', site: '現場', contact: '連絡先', due: '希望納期', qty: '数量', finish: '表面処理', notes: '要望' }[k]}: ${e.target.value}` }); save(app); render(); } });
    return h('div', { class: 'order-form' }, field('顧客', inp('customer', 'text', '例: ○○設備工業')), field('現場', inp('site', 'text', '例: △△ビル 3F 機械室')), field('連絡先', inp('contact')), field('希望納期', inp('due', 'date')), field('数量（セット）', inp('qty', 'number')), field('表面処理', inp('finish', 'text', '例: 溶融亜鉛めっき')), field('要望・注意', inp('notes'), 'wide')); };
  const deliveryForm = () => { const d = order.delivery; return h('div', { class: 'order-form' }, field('納品日', h('input', { type: 'date', value: d.date || '', 'data-del': 'date', onChange: e => { d.date = e.target.value; OD.log(order, { user, stage: 'deliver', action: 'deliver', note: '納品日: ' + d.date }); save(app); render(); } })), field('受け取った人', h('input', { value: d.receiver || '', 'data-del': 'receiver', onChange: e => { d.receiver = e.target.value; save(app); render(); } })), field('検収', h('select', { 'data-del': 'accepted', onChange: e => { d.accepted = e.target.value === '' ? null : e.target.value === 'ok'; OD.log(order, { user, stage: 'deliver', action: 'accept', note: d.accepted ? '検収 合格' : d.accepted === false ? '検収 不合格' : '検収 未実施' }); save(app); render(); } }, [['', '未実施'], ['ok', '合格'], ['ng', '不合格']].map(([v, t]) => h('option', { value: v, selected: (d.accepted === true ? 'ok' : d.accepted === false ? 'ng' : '') === v }, t)))), field('メモ', h('input', { value: d.note || '', onChange: e => { d.note = e.target.value; save(app); } }))); };
  const jump = fn => () => { m.close(); setTimeout(fn, 60); }; const B = (label, fn, attrs = {}) => h('button', { class: 'btn sm', onClick: fn, ...attrs }, label);
  const stageActions = ctx => { const st = order.stages[sel]; const mark = k => { (st.manual ||= {})[k] = true; save(app); };
    switch (sel) {
      case 'request': return [B('希望納期から期限を引き直す', () => { OD.replan(order, { need: ctx.need, user }); save(app); render(); toast('期限を引き直しました', 'ok'); })];
      case 'drawing': return [B('ファイルを読み込む', jump(() => document.getElementById('btnImport')?.click())), B(`コメントを見る（未解決 ${ctx.pinsOpen}）`, jump(() => togglePins(app)))];
      case 'spec': return [B('部材を選ぶ', jump(() => app.openPartPicker?.())), B(`確認事項を見る（残り ${ctx.openReview}）`, jump(() => openAlerts(app))), B('難易度を数え直す', () => { OD.replan(order, { need: ctx.need, user, reason: '' }); save(app); render(); })];
      case 'quote': return [B(ctx.est ? '見積を開く' : '見積を作る', jump(() => openEstimate(app))), B('重量計算書 PDF', () => exportWeightPDF(app))];
      case 'shop': return [B('加工指示書 PDF', async () => { if (!ctx.est) { toast('先に見積を作ってください（加工指示書は見積の明細から出します）', 'warn'); return; } await exportWorkOrderPDF(app, ctx.est); mark('workorder'); OD.log(order, { user, stage: 'shop', action: 'doc', note: '加工指示書を出力' }); render(); }), B('部品表・集計表', jump(() => openSchedules(app))), B('承認を記録', async () => { const r = await promptDialog('承認の記録', [{ key: 'who', label: '承認した人', type: 'text', value: order.request.contact || '' }, { key: 'note', label: 'メモ', type: 'text', value: '' }]); if (!r || !r.who) return; mark('approved'); st.approver = r.who; OD.log(order, { user, stage: 'shop', action: 'note', note: `承認: ${r.who}${r.note ? ' / ' + r.note : ''}` }); render(); }, { 'data-act': 'approve' })];
      case 'factory': return [B('工場を選ぶ', () => { curTab = 'factory'; render(); }, { 'data-act': 'to-factory' }), B('注文書 PDF', () => orderSheetPDF(app, order, ctx).then(() => { mark('ordered'); OD.log(order, { user, stage: 'factory', action: 'doc', note: '注文書を出力' }); render(); }))];
      case 'make': return [B('変更を記録', () => changeDialog())];
      case 'inspect': return [B('検査記録シート（Excel）', () => exportInspectionXLSX(app)), B('検査記録シート（PDF）', () => exportInspectionPDF(app)), B('記入済みを読み込む', jump(() => document.getElementById('btnImport')?.click())), B('品質書類の一覧 PDF', () => qualityListPDF(app, order, ctx))];
      case 'deliver': return [B('納品書 PDF', () => deliveryNotePDF(app, order, ctx, false).then(() => OD.log(order, { user, stage: 'deliver', action: 'doc', note: '納品書を出力' }))), B('検収書 PDF', () => deliveryNotePDF(app, order, ctx, true))];
    } return []; };

  // ---- 工場 ----
  const factoryTab = ctx => { const facs = loadFactories(); const need = ctx.need; const recs = OD.recommendFactories(facs, need, { due: order.stages.make?.due || null }); const box = h('div', {});
    box.append(h('div', { class: 'order-kpi' }, h('span', { class: 'chip ghost' }, `鋼材 ${need.steel} 点`), h('span', { class: 'chip ghost' }, `溶接 ${need.welds} か所`), h('span', { class: 'chip ghost' }, `穴 ${need.holes} 個`), h('span', { class: 'chip ghost' }, `斜め切り ${need.miters} 本`), h('span', { class: 'chip ghost' }, `最長 ${Math.round(need.maxLen)} mm`), h('span', { class: 'chip ghost' }, `質量 ${fmt.kg(need.mass)}`), need.galv ? h('span', { class: 'chip warn' }, '溶融亜鉛めっき') : null, need.sus ? h('span', { class: 'chip warn' }, 'ステンレス') : null),
      h('div', { class: 'order-note' }, 'この案件の加工内容に合う順に並べています。工場の一覧はサンプル（架空）です。「工場の一覧を編集」で自社の取引先に置き換えてください。'));
    recs.forEach((r, i) => { const f = r.factory; const chosen = order.factory?.id === f.id; box.append(h('div', { class: 'order-fac' + (r.ok && i === 0 ? ' best' : '') + (r.ok ? '' : ' ng') + (chosen ? ' chosen' : ''), 'data-fac': f.id }, h('div', {}, h('div', { class: 't' }, f.name, ' ', h('span', { class: 'chip ghost' }, f.region), r.ok && i === 0 ? h('span', { class: 'chip ok' }, 'おすすめ') : null, chosen ? h('span', { class: 'chip warn' }, '選定済') : null, r.late ? h('span', { class: 'chip bad' }, '製作の期限に間に合わない') : null), h('div', { class: 'r' }, `できる加工: ${f.caps.map(c => OD.CAP_JA[c]).join('・')} ／ めっき: ${OD.GALV_JA[f.galv]} ／ ステンレス: ${f.sus ? '可' : '不可'} ／ 最長 ${f.maxLen} mm・${f.maxMass} kg まで`), h('div', { class: 'r' }, `納期の目安 ${r.lead} 営業日（${r.ready} ごろ） ／ 単価の係数 ${f.rate.toFixed(2)} ／ 混み具合 ${f.load}% ／ 品質 ${'★'.repeat(f.quality)}`), r.miss.length ? h('div', { class: 'r', style: { color: 'var(--bad,#c0392b)' } }, '満たせない条件: ' + r.miss.join('、')) : r.good.length ? h('div', { class: 'r', style: { color: 'var(--ok,#3e8e5a)' } }, r.good.join('・')) : null),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, h('button', { class: 'btn sm' + (r.ok ? ' primary' : ''), 'data-act': 'choose', onClick: async () => { if (!r.ok && !await confirmDialog(`${f.name} は条件を満たしていません（${r.miss.join('、')}）。それでも選びますか。`, { ok: '選ぶ', danger: true })) return; OD.chooseFactory(order, r, { user }); OD.replan(order, { need, user, reason: `工場の納期（${r.lead} 日）で期限を引き直し` }); save(app); render(); toast(`${f.name} を選びました`, 'ok'); } }, chosen ? '選び直す' : 'この工場にする'), h('button', { class: 'btn sm', onClick: async () => { const q = await promptDialog(`${f.name} の見積を記録`, [{ key: 'price', label: '金額（円）', type: 'number', value: 0 }, { key: 'leadDays', label: '納期（営業日）', type: 'number', value: r.lead }]); if (!q) return; OD.addFactoryQuote(order, { factoryId: f.id, name: f.name, price: q.price, leadDays: q.leadDays, user }); save(app); render(); } }, '見積を記録')))); });
    if (order.factoryQuotes.length) box.append(h('h4', {}, '工場の見積の記録'), table(['日時', '工場', '金額', '納期'], order.factoryQuotes.map(q => [fmt.date(q.at), q.name, fmt.yen(q.price), q.leadDays + ' 日']), { cls: 'small' }));
    box.append(h('div', { class: 'order-acts' }, B('工場の一覧を編集', () => factoryEditor(render), { 'data-act': 'fac-edit' }), B('一覧を CSV で出す', () => download('ANGLEX_工場一覧.csv', csv([['ID', '名前', '地域', '加工', 'めっき', 'ステンレス', '最長mm', '最大kg', '標準納期', '混み具合%', '単価係数', '品質', 'メモ'], ...facs.map(f => [f.id, f.name, f.region, f.caps.join(' '), f.galv, f.sus ? 1 : 0, f.maxLen, f.maxMass, f.leadDays, f.load, f.rate, f.quality, f.note || ''])]), 'text/csv'))));
    return box; };
  const factoryEditor = done => { const facs = loadFactories(); const body = h('div', {}); const draw = () => { body.innerHTML = ''; body.append(h('p', { class: 'muted small' }, '加工は cut（切断）drill（穴あけ）weld（溶接）miter（斜め切り）bend（曲げ）を空白で区切って書きます。めっきは inhouse（自社）outsource（外注）none（不可）。'), h('table', { class: 'grid small' }, h('thead', {}, h('tr', {}, ['名前', '地域', '加工', 'めっき', 'SUS', '最長', '最大kg', '納期', '混み%', '係数', '品質', ''].map(x => h('th', {}, x)))), h('tbody', {}, facs.map((f, i) => { const inp = (k, w, conv = v => v) => h('input', { value: Array.isArray(f[k]) ? f[k].join(' ') : f[k], style: { width: w + 'px' }, onChange: e => { f[k] = conv(e.target.value); } }); return h('tr', {}, h('td', {}, inp('name', 130)), h('td', {}, inp('region', 50)), h('td', {}, inp('caps', 150, v => v.split(/\s+/).filter(Boolean))), h('td', {}, inp('galv', 74)), h('td', {}, h('input', { type: 'checkbox', checked: f.sus, onChange: e => { f.sus = e.target.checked; } })), h('td', {}, inp('maxLen', 56, Number)), h('td', {}, inp('maxMass', 56, Number)), h('td', {}, inp('leadDays', 40, Number)), h('td', {}, inp('load', 40, Number)), h('td', {}, inp('rate', 44, Number)), h('td', {}, inp('quality', 34, Number)), h('td', {}, h('button', { class: 'icon-btn', title: '削除', onClick: () => { facs.splice(i, 1); draw(); } }, '✕'))); }))), h('button', { class: 'btn sm', onClick: () => { facs.push({ id: 'F' + Date.now().toString(36), name: '新しい工場', region: '', caps: ['cut', 'drill'], galv: 'none', sus: false, maxLen: 6000, maxMass: 300, leadDays: 5, load: 50, rate: 1, quality: 3, note: '' }); draw(); } }, '＋ 工場を足す')); }; draw();
    const mm = modal({ title: '工場の一覧', wide: true, body, footer: [h('button', { class: 'btn', onClick: () => { localStorage.removeItem(FKEY); mm.close(); done(); toast('サンプルの一覧に戻しました', 'info'); } }, 'サンプルに戻す'), h('button', { class: 'btn primary', onClick: () => { saveFactories(facs); mm.close(); done(); toast('工場の一覧を保存しました', 'ok'); } }, '保存')] }); };

  // ---- 変更と履歴 ----
  const changeDialog = async () => { const r = await promptDialog('変更を記録', [{ key: 'what', label: '変更の内容', type: 'text', value: '' }, { key: 'costDelta', label: '金額の増減（円）', type: 'number', value: 0 }, { key: 'dayDelta', label: '納期の増減（営業日）', type: 'number', value: 0 }]); if (!r || !r.what) return; OD.addChange(order, { user, ...r }); save(app); render(); toast('変更を記録しました', 'ok'); };
  const historyTab = () => { const rows = [...order.history].reverse(); const cost = order.changes.reduce((s, c) => s + c.costDelta, 0), days = order.changes.reduce((s, c) => s + c.dayDelta, 0);
    return h('div', {}, h('div', { class: 'order-acts' }, B('変更を記録', changeDialog, { 'data-act': 'change' }), B('履歴を CSV で出す', () => download(`${order.no}_履歴.csv`, csv([['日時', '段階', '種類', '内容', '記録した人'], ...order.history.map(x => [x.at, OD.stageById(x.stage)?.name || '', OD.ACTION_JA[x.action] || x.action, x.note, x.who])]), 'text/csv')), h('span', { class: 'chip ghost' }, `変更 ${order.changes.length} 件`), cost ? h('span', { class: 'chip warn' }, `金額 ${cost > 0 ? '+' : ''}${fmt.yen(cost)}`) : null, days ? h('span', { class: 'chip warn' }, `納期 ${days > 0 ? '+' : ''}${days} 日`) : null),
      h('div', { class: 'order-hist' }, table(['日時', '段階', '種類', '内容', '記録した人'], rows.map(x => [fmt.date(x.at), OD.stageById(x.stage)?.name || '', OD.ACTION_JA[x.action] || x.action, x.note, x.who]), { cls: 'small' }))); };

  // ---- 書類 ----
  const docsTab = ctx => { const row = (stage, name, state, btn) => [OD.stageById(stage).name, name, state, btn]; const est = ctx.est;
    const rows = [row('quote', '重量計算書', ctx.instances ? '出せます' : '部材なし', B('PDF', () => exportWeightPDF(app))), row('quote', '見積書', est ? `${est.no}（${ctx.estStatus}）` : '見積なし', B('見積を開く', jump(() => openEstimate(app)))), row('shop', '加工指示書', est ? '出せます' : '見積が要ります', B('PDF', () => est ? exportWorkOrderPDF(app, est) : toast('先に見積を作ってください', 'warn'))), row('shop', '部品表・集計表', ctx.instances ? '出せます' : '部材なし', B('開く', jump(() => openSchedules(app)))), row('factory', '注文書', order.factory ? order.factory.name : '工場が未選定', B('PDF', () => orderSheetPDF(app, order, ctx))), row('inspect', '検査記録シート', ctx.inspection ? `読み込み済（不合格 ${ctx.inspection.counts?.ng ?? 0}）` : '未記入', B('Excel', () => exportInspectionXLSX(app))), row('inspect', '品質書類の一覧', '出せます', B('PDF', () => qualityListPDF(app, order, ctx))), row('deliver', '納品書', order.delivery.date || '納品日が未入力', B('PDF', () => deliveryNotePDF(app, order, ctx, false))), row('deliver', '検収書', order.delivery.accepted === true ? '合格' : order.delivery.accepted === false ? '不合格' : '未実施', B('PDF', () => deliveryNotePDF(app, order, ctx, true)))];
    return h('div', {}, h('div', { class: 'order-note' }, '段階ごとに要る書類です。帳票は、いまのモデルと見積の内容から作ります。'), table(['段階', '書類', '状態', ''], rows, { cls: 'small' })); };

  // ---- 全案件 ----
  const boardTab = async () => { let list = []; try { list = await app.store.listProjects(); } catch { } const cur = app.projectData(); const all = [cur, ...list.filter(p => p.id !== cur.id)]; const now = OD.today();
    const rows = all.slice(0, 60).map(p => { const o = p.order; if (!o) return [p.name, '—', '未登録', '—', '—', '']; const c = OD.currentStage(o); const st = c ? o.stages[c.id] : null; const late = st && st.due && st.due < now; return [p.name + (p.id === cur.id ? '（開いている案件）' : ''), o.no, c ? c.name : '完了', st?.due || '—', late ? h('span', { class: 'chip bad' }, '期限超過') : h('span', { class: 'chip ghost' }, `${OD.progress(o).pct}%`), o.request?.customer || '']; });
    const by = {}; for (const p of all) { const c = p.order ? (OD.currentStage(p.order)?.name || '完了') : '未登録'; by[c] = (by[c] || 0) + 1; }
    return h('div', {}, h('div', { class: 'order-kpi' }, Object.entries(by).map(([k, v]) => h('span', { class: 'chip ghost' }, `${k} ${v}`))), h('div', { class: 'order-note' }, 'このブラウザ（またはサーバー）に保存されている案件の一覧です。案件を開くと、その案件の進行を見られます。'), table(['案件', '番号', 'いまの段階', '期限', '状態', '顧客'], rows, { cls: 'small' })); };

  m = modal({ title: '案件進行（依頼から納品まで）', wide: true, cls: 'order', body: host }); await render(); return { order, close: m.close, render };
}

// ---------- 帳票 ----------
const safe = s => String(s || 'ANGLEX').replace(/[\\/:*?"<>|]/g, '_');
function itemRows(app) { const by = new Map(); for (const inst of app.model.instances) { const t = app.model.getType(inst.typeId); const fam = app.model.familyOf(inst); const k = t.id; let mass = 0; try { mass = summarize(app.instanceParts(inst).filter(p => !p.ref)).total || 0; } catch { } const e = by.get(k) || { name: t.name, family: fam.name, marks: [], qty: 0, mass: 0 }; e.marks.push(inst.mark); e.qty++; e.mass += mass; by.set(k, e); } return [...by.values()]; }
function headMeta(app, order) { return [['案件番号', order.no], ['案件名', app.project.name], ['顧客', order.request.customer || '—'], ['現場', order.request.site || '—'], ['希望納期', order.request.due || '—'], ['発行日', OD.today()]]; }
export async function deliveryNotePDF(app, order, ctx, accept = false) {
  const items = itemRows(app); if (!items.length) { toast('部材がありません', 'warn'); return null; } const d = order.delivery;
  const sections = [{ heading: accept ? '検収の対象' : '納品の内容', table: { cols: [{ label: 'No.', w: 30, align: 'right' }, { label: '品名', w: 190 }, { label: '種類', w: 120 }, { label: '符号', w: 110 }, { label: '数量', w: 36, align: 'right' }, { label: '質量 kg', w: 54, align: 'right' }], rows: items.map((x, i) => [i + 1, x.name, x.family, x.marks.slice(0, 6).join(' ') + (x.marks.length > 6 ? ' …' : ''), x.qty, x.mass.toFixed(1)]) } },
    { heading: accept ? '検収の結果' : '納品の記録', kv: accept ? [['検収', d.accepted === true ? '合格' : d.accepted === false ? '不合格' : '未実施'], ['受け取った人', d.receiver || ''], ['納品日', d.date || ''], ['メモ', d.note || ''], ['検収者の署名', ''], ['検収日', '']] : [['納品日', d.date || ''], ['納品先', order.request.site || ''], ['受け取った人', d.receiver || ''], ['製作', order.factory?.name || ''], ['受領の署名', '']] }];
  if (accept && ctx?.inspection) sections.push({ heading: '検査の結果（検査記録シートより）', kv: [['合格', String(ctx.inspection.counts?.ok ?? 0)], ['不合格', String(ctx.inspection.counts?.ng ?? 0)], ['未記入', String(ctx.inspection.counts?.blank ?? 0)], ['読み込んだファイル', ctx.inspection.file || '']] });
  await downloadPdf(`${safe(app.project.name)}_${accept ? '検収書' : '納品書'}.pdf`, { title: accept ? '検収書' : '納品書', subtitle: app.project.name, meta: headMeta(app, order), sections, footer: 'ANGLEX' }); toast(`${accept ? '検収書' : '納品書'}を出力しました`, 'ok'); return true;
}
export async function orderSheetPDF(app, order, ctx) {
  const items = itemRows(app); if (!items.length) { toast('部材がありません', 'warn'); return null; } const need = ctx?.need || orderNeed(app); const f = order.factory;
  await downloadPdf(`${safe(app.project.name)}_注文書.pdf`, { title: '注文書（製作の依頼）', subtitle: app.project.name, meta: [...headMeta(app, order), ['発注先', f?.name || '（未選定）'], ['製作の期限', order.stages.make?.due || '—']],
    sections: [{ heading: '製作する品目', table: { cols: [{ label: 'No.', w: 30, align: 'right' }, { label: '品名', w: 200 }, { label: '種類', w: 130 }, { label: '符号', w: 100 }, { label: '数量', w: 36, align: 'right' }, { label: '質量 kg', w: 54, align: 'right' }], rows: items.map((x, i) => [i + 1, x.name, x.family, x.marks.slice(0, 5).join(' ') + (x.marks.length > 5 ? ' …' : ''), x.qty, x.mass.toFixed(1)]) } },
      { heading: '加工の内容', kv: [['鋼材の部品', `${need.steel} 点`], ['溶接', `${need.welds} か所`], ['穴', `${need.holes} 個`], ['斜め切り', `${need.miters} 本`], ['最長', `${Math.round(need.maxLen)} mm`], ['質量', `${need.mass.toFixed(1)} kg`], ['表面処理', need.galv ? '溶融亜鉛めっき あり' : (order.request.finish || '指定なし')], ['難易度', order.difficulty.label]] },
      { heading: '添付する書類', text: '加工指示書、部品表、NC データ（DSTV）、3D モデル（IFC・STEP）。検査記録シートは、製作後に記入して返送してください。' }], footer: 'ANGLEX' }); toast('注文書を出力しました', 'ok'); return true;
}
export async function qualityListPDF(app, order, ctx) {
  const need = ctx?.need || orderNeed(app); const ins = ctx?.inspection; const st = order.stages.inspect;
  const rows = [['検査記録（寸法・穴・溶接・表面処理）', ins ? `読み込み済: 合格 ${ins.counts?.ok ?? 0} / 不合格 ${ins.counts?.ng ?? 0} / 未記入 ${ins.counts?.blank ?? 0}` : '未記入', ins ? (ins.counts?.ng ? '要対応' : '済') : ''], ['ミルシート（鋼材検査証明書）の台帳', need.steel ? '検査記録シートの「ミルシート台帳」に記入' : '対象なし', ''], ['溶融亜鉛めっきの試験成績書', need.galv ? '要' : '対象なし', ''], ['ステンレス材の材料証明', need.sus ? '要' : '対象なし', ''], ['出荷前の写真', '要', ''], ['加工指示書（最終版）', order.stages.shop?.manual?.workorder ? '出力済' : '未出力', ''], ['承認の記録', order.stages.shop?.approver ? `承認: ${order.stages.shop.approver}` : '未記録', '']];
  await downloadPdf(`${safe(app.project.name)}_品質書類の一覧.pdf`, { title: '品質書類の一覧', subtitle: app.project.name, meta: headMeta(app, order), sections: [{ heading: 'そろえる書類', table: { cols: [{ label: '書類', w: 220 }, { label: '状態', w: 230 }, { label: '確認', w: 60 }], rows } }, { heading: '確認', kv: [['品質書類をそろえた', st?.manual?.docs ? 'はい' : 'いいえ'], ['確認した人', ''], ['確認日', '']] }], footer: 'ANGLEX' }); toast('品質書類の一覧を出力しました', 'ok'); return true;
}
