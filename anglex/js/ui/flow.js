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

const STAGE_ORDER = ['model', 'review', 'weight', 'estimate', 'share', 'final'];
export async function openFlow(app) {
  const host = h('div', { class: 'flow-wrap' }); const m = modal({ title: '業務フロー（図面 → 確認 → 重量 → 見積 → 共有 → 確定）', wide: true, cls: 'flow', body: host });
  const render = async () => { host.innerHTML = ''; host.append(await buildFlow(app, render, m)); };
  await render(); app.flowRefresh = () => { if (document.body.contains(host)) render(); };
}
export async function buildFlow(app, rerender, m) {
  const role = app.role(); const user = app.user();
  const rows = app.model.explodeParts().filter(r => !r.ref); const s = summarize(rows); const nInst = app.model.instances.length;
  const open = app.openReviewCount(); let align = []; try { align = detectMisalignment(app); } catch { }
  const list = await app.store.listEstimates(app.project.id); const est = (app.currentEstimateId && list.find(e => e.id === app.currentEstimateId)) || list[0] || null; const T = est ? WF.totals(est) : null;
  const mine = est && est.currentOrg === role && est.status !== 'final';
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
    [h('button', { class: 'btn sm ' + (open ? 'primary' : ''), onClick: () => { m.close(); openAlerts(app); } }, `確認リスト（${open}）`), h('button', { class: 'btn sm' + (align.length ? ' primary' : ''), onClick: () => { m.close(); openAlign(app); } }, `ズレ補正（${align.length}）`)],
    open ? '未確認のまま受け渡すと工場側で手戻りになります（受け渡し時にゲートが掛かります）' : 'すべて確認済み。受け渡しできます');
  // ③ 重量・集計
  const parts = [['鋼材（穴控除後）', s.steelNet], ['めっき付着', s.zinc], ['ボルト類', s.fasteners], ['溶接金属', s.welds]]; const max = Math.max(1, ...parts.map(p => p[1]));
  const bars = h('div', { class: 'fc-bars' }, ...parts.map(([k, v]) => h('div', { class: 'fc-bar' }, h('span', { class: 'lbl' }, k), h('span', { class: 'track' }, h('span', { class: 'fill', style: { width: Math.round(v / max * 100) + '%' } })), h('span', { class: 'val' }, fmt.kg(v)))));
  const c3 = card('weight', '③ 重量計算・集計', h('div', {}, h('div', { class: 'fc-grid' }, kv('総質量', fmt.kg(s.total), 'big'), kv('表面積（めっき）', fmt.m2(s.areaM2)), kv('溶接長', Math.round(s.weldLength) + ' mm'), kv('穴 / 長穴', `${s.holeCount} / ${s.slotCount}`)), bars, h('div', { class: 'muted small' }, '算出: 形鋼は断面積×長さ×7.85、穴・長穴は体積控除。めっきは表面積×付着量（HDZ55 = 550 g/m²）。ボルト類は JIS 質量表、溶接は脚長²/2×長さ×7.85')),
    [h('button', { class: 'btn sm primary', onClick: () => exportWeightPDF(app) }, '重量計算書 PDF'), h('button', { class: 'btn sm', onClick: () => exportWeightXLSX(app) }, 'XLSX'), h('button', { class: 'btn sm', onClick: () => exportWeightCSV(app) }, 'CSV'), h('button', { class: 'btn sm', onClick: () => { m.close(); openSchedules(app); } }, '集計表（部材・ボルト・溶接・穴）')]);
  // ④ 見積
  const c4 = card('estimate', '④ 見積', est ? h('div', { class: 'fc-grid' }, kv('見積番号', `${est.no} Rev.${est.revision}`), kv('状態', WF.STATUS[est.status], est.status === 'final' ? 'ok' : 'warn'), role !== 'C' ? kv('販売価格 計（税別）', fmt.yen(T.b), 'big') : kv('工場原価 計', fmt.yen(T.factory), 'big'), kv('明細', est.lines.length + ' 行 / ' + fmt.kg(T.mass))) : h('div', { class: 'muted' }, '見積はまだありません。モデルから明細（品名・仕様・数量・質量・基準原価）を自動生成します。'),
    [role === 'A' ? h('button', { class: 'btn sm primary', onClick: async () => { const r = await createEstimate(app); if (r) { toast(`見積 ${r.no} を作成しました`, 'ok'); rerender(); } } }, est ? '＋ モデルから見積を再作成（新 Rev）' : '＋ モデルから見積を作成') : null, h('button', { class: 'btn sm', onClick: () => { m.close(); $('#btnEstimate')?.click(); } }, '見積ワークフローを開く'), est ? h('button', { class: 'btn sm', onClick: () => exportEstimatePDF(app, est) }, '見積書 PDF') : null, est && role !== 'B' ? h('button', { class: 'btn sm', onClick: () => exportWorkOrderPDF(app, est) }, '加工指示書 PDF') : null]);
  // ⑤ 共有（受け渡し）
  const shareBody = h('div', {});
  if (est) {
    shareBody.append(h('div', { class: 'fc-grid' }, kv('現在の担当', WF.ROLES[est.currentOrg].name, est.currentOrg === role ? 'ok' : ''), kv('受け渡し回数', (est.handoffs || []).length), kv('監査ログ', est.audit.length + ' 件')));
    shareBody.append(h('div', { class: 'flow-orgs' }, ...['A', 'B', 'C'].map(o => h('div', { class: 'flow-org' + (est.currentOrg === o ? ' cur' : '') }, h('b', {}, o + '社'), h('div', { class: 'small' }, WF.ROLES[o].name), h('div', { class: 'muted small' }, { A: '3D・数量・仕様・基準原価', B: '利益率・販売価格', C: '工場単価・納期・受注可否' }[o])))));
    const links = Object.entries(est.tokens || {}); if (links.length) shareBody.append(h('div', { class: 'flow-links' }, h('div', { class: 'muted small' }, '共有リンク（相手の会社はこのリンクで、自社の権限で同じ見積を開けます）'), ...links.map(([org, tok]) => { const link = location.origin + location.pathname + '?handoff=' + tok; return h('div', { class: 'flow-link' }, h('span', { class: 'chip' }, org + '社'), h('code', {}, link), h('button', { class: 'btn sm', onClick: async () => { try { await navigator.clipboard.writeText(link); toast('リンクをコピーしました', 'ok'); } catch { toast(link, 'info', 8000); } } }, 'コピー')); })));
    if (est.handoffs?.length) shareBody.append(h('details', {}, h('summary', {}, '受け渡し履歴'), table(['日時', '', '担当', 'メッセージ'], est.handoffs.slice().reverse().map(x => [fmt.date(x.at), `${x.from} → ${x.to}`, x.who, x.note || '']))));
  } else shareBody.append(h('div', { class: 'muted' }, '見積を作成すると、B社（販売）・C社（加工工場）へリンクで受け渡せます。相手は自社の権限（見える項目・編集できる項目）で同じ見積を開きます。'));
  const shareActs = [];
  if (mine) for (const to of WF.ROLES[role].handoffTo) shareActs.push(h('button', { class: 'btn sm primary', onClick: async () => { const gate = await reviewGate(app, '受け渡し'); if (!gate.ok) return; const r = await promptDialog(`${WF.ROLES[to].name} へ受け渡し`, [{ key: 'note', label: 'メッセージ', type: 'textarea', value: '' }]); if (!r) return; try { const res = await app.store.handoffEstimate(est.id, { from: role, to, who: user.name, note: [gate.note, r.note].filter(Boolean).join(' ') }); const link = location.origin + location.pathname + '?handoff=' + res.token; try { await navigator.clipboard.writeText(link); } catch { } toast(`${WF.ROLES[to].name} へ受け渡しました（リンクをコピー）`, 'ok', 5000); rerender(); } catch (e) { toast(e.message, 'bad'); } } }, `→ ${to}社（${WF.ROLES[to].name.replace(/（.*?）/, '')}）へ渡す`));
  if (est && mine && role !== 'A') shareActs.push(h('button', { class: 'btn sm danger', onClick: async () => { const r = await promptDialog('差戻し', [{ key: 'note', label: '理由', type: 'textarea' }]); if (!r) return; await app.store.rejectEstimate(est.id, { who: user.name, org: role, note: r.note }); rerender(); } }, '差戻し'));
  const c5 = card('share', '⑤ 他社と共有（A社 → B社 → C社）', shareBody, shareActs, est && !mine ? (est.status === 'final' ? '確定済み' : `いまは ${WF.ROLES[est.currentOrg].name} が作業中。受け渡されると編集できます`) : null);
  // ⑥ 確定
  const c6 = card('final', '⑥ 確定', est ? h('div', { class: 'fc-grid' }, kv('状態', WF.STATUS[est.status], est.status === 'final' ? 'ok' : ''), kv('改訂', 'Rev.' + est.revision), est.status === 'final' ? kv('確定日時', fmt.date(est.audit.find(a => a.action === 'finalize')?.at)) : null) : h('div', { class: 'muted' }, 'C社の回答（工場原価・納期）を受けて A社が確定します。確定後は編集できず、改訂は新しい Rev になります。'),
    [est && role === 'A' && est.status !== 'final' ? h('button', { class: 'btn sm primary', onClick: async () => { const gate = await reviewGate(app, '確定'); if (!gate.ok) return; if (!(await confirmDialog('この見積を確定しますか？（以後編集不可）'))) return; await app.store.finalizeEstimate(est.id, { who: user.name, org: role, note: gate.note }); toast('確定しました', 'ok'); rerender(); } }, '確定する') : null, est?.status === 'final' ? h('button', { class: 'btn sm', onClick: () => exportEstimatePDF(app, est) }, '確定見積書 PDF') : null]);
  const who = h('div', { class: 'flow-who' }, h('span', { class: 'chip' }, `${user.name}（${role}社: ${WF.ROLES[role].name}）`), h('span', { class: 'muted small' }, 'プロジェクト: ' + app.project.name), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onClick: () => { m.close(); openEstimate(app); } }, '見積の詳細（明細・権限・監査ログ）'));
  return h('div', {}, who, stepper, h('div', { class: 'flow-cards' }, c1, c2, c3, c4, c5, c6));
}
