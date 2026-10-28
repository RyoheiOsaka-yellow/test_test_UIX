// 業務フロー パネル: モデル → 確認 → 重量・集計 → 見積 → 共有（B社／C社）→ 確定 を 1 画面で。各段階の状態・数字・次の一手を並べる
import { $, h, modal, fmt, toast, confirmDialog, promptDialog, table } from './common.js';
import * as WF from '../core/workflow.js';
import { summarize } from '../bim/weight.js';
import { detectMisalignment } from '../bim/review.js';
import { openAlerts, openAlign } from './review.js';
import { openEstimate, createEstimate, reviewGate } from './estimate.js';
import { exportWeightPDF, exportWeightCSV, exportWeightXLSX, exportEstimatePDF, exportWorkOrderPDF } from './reports.js';
import { openSchedules } from './schedules.js';
import { openShowroom } from './showroom.js';
import { openReviewWizard } from './reviewWizard.js';
import { openCompare } from './compare.js';
import { renderRoleView } from './roleview.js';
import { branchName } from '../core/branches.js';
import { openPriceMaster } from './priceMaster.js';
import { handoffDialog, finalizeDialog, handoffMessage, showMessage, finalizeIssues } from './handoff.js';

const STAGE_ORDER = ['model', 'review', 'weight', 'estimate', 'share', 'final'];
export async function openFlow(app) {
  const host = h('div', { class: 'flow-wrap' }); const m = modal({ title: '業務フロー（図面 → 確認 → 重量 → 見積 → 共有 → 確定）', wide: true, cls: 'flow', body: host });
  let seq = 0; const render = async () => { const my = ++seq; const el = await buildFlow(app, render, m); if (my !== seq) return; host.innerHTML = ''; host.append(el); };
  await render(); app.flowRefresh = () => { if (document.body.contains(host)) render(); };
}
export async function buildFlow(app, rerender, m) {
  const role = app.role(); const user = app.user();
  const rows = app.model.explodeParts().filter(r => !r.ref); const s = summarize(rows); const nInst = app.model.instances.length;
  const open = app.openReviewCount(); let align = []; try { align = detectMisalignment(app); } catch { }
  const list = await app.store.listEstimates(app.project.id); const est = (app.currentEstimateId && list.find(e => e.id === app.currentEstimateId)) || list[0] || null; const T = est ? WF.totals(est) : null;
  const mine = est && est.currentOrg === role && est.status !== 'final';
  // B社・C社: 役割専用の簡略ビュー（受け取り → 入力 → 返す）
  if (role !== 'A') {
    const steps = role === 'B' ? [['受け取り', 'A社から見積を受け取る'], ['利益率を入力', '各行の利益率 → 販売価格'], ['返す／渡す', 'A社へ返す or C社へ渡す']] : [['受け取り', 'A社から見積を受け取る'], ['単価・納期・可否', '各行の工場単価・納期・受注可否'], ['A社へ回答', '回答すると A社が確定']];
    const cur = !est ? 0 : mine ? ((role === 'C' ? est.lines.some(l => l.factoryCost != null) : est.lines.some(l => l.bMarginPct != null)) ? 2 : 1) : 3;
    const stepper = h('div', { class: 'flow-steps' }, ...steps.map(([t, d], i) => h('div', { class: 'flow-step ' + (i < cur ? 'done' : i === cur ? 'cur' : 'todo') }, h('span', { class: 'no' }, i < cur ? '✓' : String(i + 1)), h('span', {}, h('div', {}, t), h('div', { class: 'muted small' }, d)))));
    const who = h('div', { class: 'flow-who' }, h('span', { class: 'chip' }, `${user.name}（${role}社: ${WF.ROLES[role].name}）`), h('span', { class: 'muted small' }, 'プロジェクト: ' + app.project.name), h('span', { class: 'chip ghost' }, branchName(app.project.branch)), h('span', { class: 'spacer' }), h('span', { class: 'muted small' }, role === 'B' ? '見えるのは A社提示単価と自社の利益率・販売価格だけです' : '見えるのは数量・仕様・質量と自社の工場単価・納期だけです'));
    return h('div', {}, who, stepper, est ? renderRoleView(app, est, rerender, m) : h('div', { class: 'pp-empty' }, 'まだ受け取った見積がありません。A社から受け渡しリンク（?handoff=…）が届くとここに表示されます。'));
  }
  // 段階の状態
  const st = { model: nInst ? 'done' : 'todo', review: !nInst ? 'todo' : (open + align.length) ? 'cur' : 'done', weight: nInst ? 'done' : 'todo', estimate: !est ? (nInst ? 'cur' : 'todo') : 'done', share: !est ? 'todo' : est.handoffs?.length ? 'done' : 'cur', final: est?.status === 'final' ? 'done' : est ? 'cur' : 'todo' };
  let cur = STAGE_ORDER.find(k => st[k] === 'cur') || (st.final === 'done' ? 'final' : 'model');
  const stepper = h('div', { class: 'flow-steps' }, ...STAGE_ORDER.map((k, i) => h('div', { class: 'flow-step ' + st[k] + (k === cur ? ' cur' : ''), onClick: () => document.querySelector(`.flow-card[data-k="${k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, h('span', { class: 'no' }, st[k] === 'done' ? '✓' : String(i + 1)), h('span', {}, { model: 'モデル', review: '確認', weight: '重量・集計', estimate: '見積', share: '共有', final: '確定' }[k]))));
  const card = (k, title, body, actions, note = null) => h('div', { class: 'flow-card ' + st[k] + (k === cur ? ' cur' : ''), 'data-k': k }, h('div', { class: 'fc-head' }, h('span', { class: 'fc-badge' }, st[k] === 'done' ? '✓ 済' : st[k] === 'cur' ? '▶ いま' : '未'), h('b', {}, title), note ? h('span', { class: 'muted small' }, note) : null), h('div', { class: 'fc-body' }, body), h('div', { class: 'fc-actions' }, ...actions));
  const kv = (k, v, cls = '') => h('div', { class: 'fc-kv ' + cls }, h('span', {}, k), h('b', {}, v));
  const go = (fn) => () => { fn(); };
  // ① モデル
  const c1 = card('model', '① 3D モデル（単一ソース）', h('div', { class: 'fc-grid' }, kv('インスタンス', nInst + ' 体'), kv('タイプ', app.model.types.length), kv('接合', app.model.joints.length), kv('要判断（推論）', app.model.instances.filter(i => i.status === 'review').length, app.model.instances.some(i => i.status === 'review') ? 'warn' : '')),
    [h('button', { class: 'btn sm primary', onClick: () => { m.close(); openShowroom(app); } }, 'ショールームから配置'), h('button', { class: 'btn sm', onClick: () => { m.close(); $('#btnCatalog')?.click(); } }, 'カタログ'), h('button', { class: 'btn sm', onClick: () => { m.close(); $('#btnImport')?.click(); } }, '図面を読込（DXF / PDF / IFC）')],
    '3D・質量・集計・見積はこのモデルから自動で派生します');
  // ② 確認
  const c2 = card('review', '② 人が確認する箇所', h('div', { class: 'fc-grid' }, kv('未処理の確認事項', open + ' 件', open ? 'bad' : 'ok'), kv('ズレ（隙間・レベル・穴）', align.length + ' 件', align.length ? 'warn' : 'ok'), kv('現場溶接', rows.filter(r => r.kind === 'weld' && r.site).length + ' 箇所'), kv('アンカー', rows.filter(r => r.kind === 'anchor').length + ' 本')),
    [h('button', { class: 'btn sm ' + (open ? 'primary' : ''), disabled: !open, title: '未確認をカード送りで処理。3D がその箇所へ寄ります', onClick: () => { m.close(); openReviewWizard(app); } }, `まとめて確認（${open}）`), h('button', { class: 'btn sm', onClick: () => { m.close(); openAlerts(app); } }, '確認リスト'), h('button', { class: 'btn sm' + (align.length ? ' primary' : ''), onClick: () => { m.close(); openAlign(app); } }, `ズレ補正（${align.length}）`)],
    open ? '未確認のまま受け渡すと工場側で手戻りになります（受け渡し時にゲートが掛かります）' : 'すべて確認済み。受け渡しできます');
  // ③ 重量・集計
  const parts = [['鋼材（穴控除後）', s.steelNet], ['めっき付着', s.zinc], ['ボルト類', s.fasteners], ['溶接金属', s.welds]]; const max = Math.max(1, ...parts.map(p => p[1]));
  const bars = h('div', { class: 'fc-bars' }, ...parts.map(([k, v]) => h('div', { class: 'fc-bar' }, h('span', { class: 'lbl' }, k), h('span', { class: 'track' }, h('span', { class: 'fill', style: { width: Math.round(v / max * 100) + '%' } })), h('span', { class: 'val' }, fmt.kg(v)))));
  const c3 = card('weight', '③ 重量計算・集計', h('div', {}, h('div', { class: 'fc-grid' }, kv('総質量', fmt.kg(s.total), 'big'), kv('表面積（めっき）', fmt.m2(s.areaM2)), kv('溶接長', Math.round(s.weldLength) + ' mm'), kv('穴 / 長穴', `${s.holeCount} / ${s.slotCount}`)), bars, h('div', { class: 'muted small' }, '算出: 形鋼は断面積×長さ×7.85、穴・長穴は体積控除。めっきは表面積×付着量（HDZ55 = 550 g/m²）。ボルト類は JIS 質量表、溶接は脚長²/2×長さ×7.85')),
    [h('button', { class: 'btn sm primary', onClick: () => exportWeightPDF(app) }, '重量計算書 PDF'), h('button', { class: 'btn sm', onClick: () => exportWeightXLSX(app) }, 'XLSX'), h('button', { class: 'btn sm', onClick: () => exportWeightCSV(app) }, 'CSV'), h('button', { class: 'btn sm', onClick: () => { m.close(); openSchedules(app); } }, '集計表（部材・ボルト・溶接・穴）')]);
  // ④ 見積
  const c4 = card('estimate', '④ 見積', est ? h('div', { class: 'fc-grid' }, kv('見積番号', `${est.no} Rev.${est.revision}`), kv('状態', WF.STATUS[est.status], est.status === 'final' ? 'ok' : 'warn'), role !== 'C' ? kv('販売価格 計（税別）', fmt.yen(T.b), 'big') : kv('工場原価 計', fmt.yen(T.factory), 'big'), kv('明細', est.lines.length + ' 行 / ' + fmt.kg(T.mass))) : h('div', { class: 'muted' }, '見積はまだありません。モデルから明細（品名・仕様・数量・質量・基準原価）を自動生成します。'),
    [role === 'A' ? h('button', { class: 'btn sm primary', onClick: async () => { const r = await createEstimate(app); if (r) { toast(`見積 ${r.no} を作成しました`, 'ok'); rerender(); } } }, est ? '＋ モデルから見積を再作成（新 Rev）' : '＋ モデルから見積を作成') : null, h('button', { class: 'btn sm', onClick: () => { m.close(); $('#btnEstimate')?.click(); } }, '見積ワークフローを開く'), role === 'A' ? h('button', { class: 'btn sm' + (est?.lines.some(l => l.learned) ? ' on' : ''), title: 'C社回答の蓄積から基準原価・納期の初期値を学習。単価表の見直し候補も表示', onClick: () => openPriceMaster(app, est) }, est?.lines.some(l => l.learned) ? `学習単価 ${est.lines.filter(l => l.learned).length} 行` : '単価マスタ（学習）') : null, est && est.revisions.length ? h('button', { class: 'btn sm', title: 'Rev 間・会社間の差分と変更理由', onClick: () => openCompare(app, est) }, '⇄ Rev 比較') : null, est ? h('button', { class: 'btn sm', onClick: () => exportEstimatePDF(app, est) }, '見積書 PDF') : null, est && role !== 'B' ? h('button', { class: 'btn sm', onClick: () => exportWorkOrderPDF(app, est) }, '加工指示書 PDF') : null]);
  // ⑤ 共有（受け渡し）
  const shareBody = h('div', {});
  if (est) {
    const dl = WF.deadlineInfo(est); shareBody.append(h('div', { class: 'fc-grid' }, kv('現在の担当', WF.ROLES[est.currentOrg].name, est.currentOrg === role ? 'ok' : ''), dl && dl.due ? kv('回答期限', dl.overdue ? `${dl.due}（${-dl.left} 日超過）` : `${dl.due}（残り ${dl.left} 日）`, dl.overdue ? 'bad' : dl.left <= 1 ? 'warn' : '') : kv('回答期限', '未設定'), dl && dl.since != null && est.status !== 'final' ? kv('未回答', `${dl.since} 日`, dl.since >= 3 ? 'warn' : '') : kv('受け渡し回数', (est.handoffs || []).length), kv('監査ログ', est.audit.length + ' 件')));
    shareBody.append(h('div', { class: 'flow-orgs' }, ...['A', 'B', 'C'].map(o => h('div', { class: 'flow-org' + (est.currentOrg === o ? ' cur' : '') }, h('b', {}, o + '社'), h('div', { class: 'small' }, WF.ROLES[o].name), h('div', { class: 'muted small' }, { A: '3D・数量・仕様・基準原価', B: '利益率・販売価格', C: '工場単価・納期・受注可否' }[o])))));
    const links = Object.entries(est.tokens || {}); if (links.length) shareBody.append(h('div', { class: 'flow-links' }, h('div', { class: 'muted small' }, '共有リンク（相手の会社はこのリンクで、自社の権限で同じ見積を開けます）'), ...links.map(([org, tok]) => { const link = location.origin + location.pathname + '?handoff=' + tok; return h('div', { class: 'flow-link' }, h('span', { class: 'chip' }, org + '社'), h('code', {}, link), h('button', { class: 'btn sm', onClick: async () => { try { await navigator.clipboard.writeText(link); toast('リンクをコピーしました', 'ok'); } catch { toast(link, 'info', 8000); } } }, 'コピー')); })));
    if (est.handoffs?.length) shareBody.append(h('details', {}, h('summary', {}, '受け渡し履歴'), table(['日時', '', '担当', '期限', 'メッセージ'], est.handoffs.slice().reverse().map(x => [fmt.date(x.at), `${x.from} → ${x.to}`, x.who, x.due || '—', x.note || '']))));
  } else shareBody.append(h('div', { class: 'muted' }, '見積を作成すると、B社（販売）・C社（加工工場）へリンクで受け渡せます。相手は自社の権限（見える項目・編集できる項目）で同じ見積を開きます。'));
  const shareActs = [];
  if (mine) for (const to of WF.ROLES[role].handoffTo) shareActs.push(h('button', { class: 'btn sm primary', onClick: () => handoffDialog(app, est, to, rerender) }, `→ ${to}社（${WF.ROLES[to].name.replace(/（.*?）/, '')}）へ渡す`));
  if (est && est.tokens && Object.keys(est.tokens).length) shareActs.push(h('button', { class: 'btn sm', title: '相手へ送る通知文（リンク・合計・期限）を再表示', onClick: () => { const to = Object.keys(est.tokens).pop(); showMessage(handoffMessage(app, est, to, location.origin + location.pathname + '?handoff=' + est.tokens[to], { due: est.due })); } }, '通知文を表示'));
  if (est && mine && role !== 'A') shareActs.push(h('button', { class: 'btn sm danger', onClick: async () => { const r = await promptDialog('差戻し', [{ key: 'note', label: '理由', type: 'textarea' }]); if (!r) return; await app.store.rejectEstimate(est.id, { who: user.name, org: role, note: r.note }); rerender(); } }, '差戻し'));
  const c5 = card('share', '⑤ 他社と共有（A社 → B社 → C社）', shareBody, shareActs, est && !mine ? (est.status === 'final' ? '確定済み' : `いまは ${WF.ROLES[est.currentOrg].name} が作業中。受け渡されると編集できます`) : null);
  // ⑥ 確定
  const issues = est ? finalizeIssues(est, { requiredLead: est.meta?.requiredLead ?? null }) : []; const leadInp = est && role === 'A' && est.status !== 'final' ? h('input', { type: 'number', value: est.meta?.requiredLead ?? '', placeholder: '例 14', style: { width: '70px' }, onChange: async e => { try { await app.store.editEstimate(est.id, { role, who: user.name, field: 'meta.requiredLead', value: e.target.value === '' ? null : +e.target.value }); rerender(); } catch (err) { toast(err.message, 'bad'); } } }) : null;
  const c6 = card('final', '⑥ 確定', est ? h('div', {}, h('div', { class: 'fc-grid' }, kv('状態', WF.STATUS[est.status], est.status === 'final' ? 'ok' : ''), kv('改訂', 'Rev.' + est.revision), est.status === 'final' ? kv('確定日時', fmt.date(est.audit.find(a => a.action === 'finalize')?.at)) : kv('確定前チェック', issues.length ? `${issues.length} 件（受注不可 ${issues.filter(i => i.kind === '受注不可').length} / 未回答 ${issues.filter(i => /未回答|未入力/.test(i.kind)).length} / 納期超過 ${issues.filter(i => i.kind === '納期超過').length}）` : '問題なし', issues.some(i => i.sev === 'bad') ? 'bad' : issues.length ? 'warn' : 'ok')), leadInp ? h('div', { class: 'small', style: { marginTop: '6px' } }, '要求納期（日）: ', leadInp, h('span', { class: 'muted' }, ' C社の回答納期がこれを超える行を確定前に止めます')) : null, issues.length && est.status !== 'final' ? h('ul', { class: 'fc-issues' }, ...issues.slice(0, 5).map(i => h('li', { class: i.sev }, `${i.l.no}. ${i.l.desc} — ${i.kind}`)), issues.length > 5 ? h('li', { class: 'muted' }, `ほか ${issues.length - 5} 件`) : null) : null) : h('div', { class: 'muted' }, 'C社の回答（工場原価・納期）を受けて A社が確定します。確定後は編集できず、改訂は新しい Rev になります。'),
    [est && role === 'A' && est.status !== 'final' ? h('button', { class: 'btn sm primary', onClick: () => finalizeDialog(app, est, rerender) }, '確定する（チェック付き）') : null, est?.status === 'final' ? h('button', { class: 'btn sm', onClick: () => exportEstimatePDF(app, est) }, '確定見積書 PDF') : null]);
  const who = h('div', { class: 'flow-who' }, h('span', { class: 'chip' }, `${user.name}（${role}社: ${WF.ROLES[role].name}）`), h('span', { class: 'muted small' }, 'プロジェクト: ' + app.project.name), h('span', { class: 'chip ghost', title: '案件の営業所（クリックで変更）', style: { cursor: 'pointer' }, onClick: () => app.setProjectBranch() }, branchName(app.project.branch)), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onClick: () => { m.close(); openEstimate(app); } }, '見積の詳細（明細・権限・監査ログ）'));
  return h('div', {}, who, stepper, h('div', { class: 'flow-cards' }, c1, c2, c3, c4, c5, c6));
}
