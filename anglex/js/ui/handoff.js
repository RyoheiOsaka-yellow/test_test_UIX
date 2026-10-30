// 受け渡し（通知文・期限つき）と 確定前チェック
import { h, modal, fmt, toast, promptDialog, table } from './common.js';
import * as WF from '../core/workflow.js';
import { reviewGate } from './estimate.js';
import { branchName } from '../core/branches.js';
import { recordFromEstimate } from '../core/pricing.js';

const plusDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// 相手に送る本文（メール／チャット用）
export function handoffMessage(app, est, to, link, { note = '', due = null, role = app.role() } = {}) {
  const T = WF.totals(est); const user = app.user(); const unanswered = to === 'C' ? est.lines.filter(l => l.factoryCost == null).length : to === 'B' ? est.lines.filter(l => l.bMarginPct == null).length : 0;
  const ask = { B: '各行の利益率を入力して販売価格を決めてください（A社へ返す or C社へ渡す）', C: '各行の工場単価・納期・受注可否を入力して A社へ回答してください', A: '内容をご確認のうえ、確定または差戻しをお願いします' }[to];
  const lines = [`【ANGLEX 見積 ${est.no} Rev.${est.revision}】${est.projectName}`, est.branch ? `営業所: ${branchName(est.branch)}` : null, '', `${WF.ROLES[to].name} ご担当者様`, '', `${WF.ROLES[role].name}（${user.name}）より見積を受け渡します。`, `下記リンクを開くと、貴社の権限で同じ見積を編集できます（ログイン不要・リンクが鍵です）。`, link, '', `■ お願い: ${ask}`, due ? `■ 回答期限: ${due}` : null, `■ 明細: ${est.lines.length} 行 / 総質量 ${fmt.kg(T.mass)}`, to !== 'C' ? `■ A社 提示 計: ${fmt.yen(T.a)}` : null, to === 'C' ? `■ 最長納期（現時点）: ${Math.max(0, ...est.lines.map(l => l.leadDays || 0)) || '—'} 日` : null, unanswered ? `■ 未入力の行: ${unanswered} 行` : null, note ? `\n${note}` : null, '', '— ANGLEX（図面に、語らせる）'];
  return lines.filter(x => x != null).join('\n');
}
// 催促文（期限超過・未回答が続くとき）
export function reminderMessage(app, est) {
  const dl = WF.deadlineInfo(est); const to = est.currentOrg; const link = est.tokens?.[to] ? location.origin + location.pathname + '?handoff=' + est.tokens[to] : '（リンクは業務フロー画面の「共有リンク」から）'; const T = WF.totals(est);
  const pending = to === 'C' ? est.lines.filter(l => l.factoryCost == null || l.accepted == null).length : to === 'B' ? est.lines.filter(l => l.bMarginPct == null).length : 0;
  const lines = [`【ANGLEX 見積 ${est.no} Rev.${est.revision}】${est.projectName} — ご回答のお願い（再送）`, '', `${WF.ROLES[to].name} ご担当者様`, '', dl?.overdue ? `回答期限 ${dl.due} を ${-dl.left} 日過ぎています。` : dl?.due ? `回答期限 ${dl.due}（残り ${dl.left} 日）が近づいています。` : `受け渡しから ${dl?.since ?? '—'} 日が経過しています。`, pending ? `未入力の行: ${pending} / ${est.lines.length} 行` : null, '', '下記リンクから入力をお願いします（ログイン不要・貴社の権限で同じ見積を編集できます）。', link, '', `■ 明細: ${est.lines.length} 行 / 総質量 ${fmt.kg(T.mass)}`, '', `${WF.ROLES[app.role()].name}（${app.user().name}）`, '— ANGLEX（図面に、語らせる）'];
  return lines.filter(x => x != null).join('\n');
}
export function showMessage(text, title = '通知文（コピーして送付）') {
  const ta = h('textarea', { class: 'msg-text', rows: 14 }, text); const m = modal({ title, body: h('div', {}, h('div', { class: 'muted small', style: { marginBottom: '6px' } }, 'メール・チャットに貼り付けてください。リンクを開いた相手は自社の権限で同じ見積を編集できます。'), ta), footer: [h('button', { class: 'btn', onClick: () => m.close() }, '閉じる'), h('button', { class: 'btn', onClick: () => { const s = encodeURIComponent(text.split('\n')[0]), b = encodeURIComponent(text); location.href = `mailto:?subject=${s}&body=${b}`; } }, 'メールで開く'), h('button', { class: 'btn primary', onClick: async () => { try { await navigator.clipboard.writeText(ta.value); toast('コピーしました', 'ok'); } catch { ta.select(); document.execCommand('copy'); toast('コピーしました', 'ok'); } } }, 'コピー')] }); return m;
}
// 受け渡しダイアログ: メッセージ + 期限 → 受け渡し → 通知文を表示
export async function handoffDialog(app, est, to, rerender, { gate = true, warn = null } = {}) {
  const role = app.role(); const user = app.user();
  if (gate && role === 'A') { const g = await reviewGate(app, '受け渡し'); if (!g.ok) return false; warn = [g.note, warn].filter(Boolean).join(' '); }
  const r = await promptDialog(`${WF.ROLES[to].name} へ受け渡し`, [{ key: 'note', label: 'メッセージ', type: 'textarea', value: '' }, { key: 'due', label: '回答期限', type: 'date', value: plusDays(to === 'C' ? 7 : 3) }]); if (!r) return false;
  try { const res = await app.store.handoffEstimate(est.id, { from: role, to, who: user.name, note: [warn, r.note].filter(Boolean).join(' '), due: r.due || null }); const link = location.origin + location.pathname + '?handoff=' + res.token; const fresh = (await app.store.listEstimates(est.projectId)).find(e => e.id === est.id) || est; if (role === 'C') { try { const n = await recordFromEstimate(app, fresh); if (n) toast(`工場単価・納期 ${n} 行を単価マスタ（学習）に記録しました`, 'info'); } catch (e) { console.warn('price history', e); } } const text = handoffMessage(app, fresh, to, link, { note: r.note, due: r.due, role }); try { await navigator.clipboard.writeText(text); } catch { } toast(`${WF.ROLES[to].name} へ受け渡しました（通知文をコピー）`, 'ok', 4000); showMessage(text); rerender?.(); app.flowRefresh?.(); return true; } catch (e) { toast(e.message, 'bad'); return false; }
}
// 確定前チェック: 受注不可・未回答・要求納期超過・利益率未入力 を一覧にして止める
export function finalizeIssues(est, { requiredLead = null } = {}) {
  const out = []; for (const l of est.lines) { if (l.accepted === false) out.push({ l, kind: '受注不可', detail: l.cNote || 'C社が受注不可と回答', sev: 'bad' }); if (l.factoryCost == null) out.push({ l, kind: '工場単価 未回答', detail: 'C社の工場単価がありません（A社基準原価で計算）', sev: 'warn' }); if (l.accepted == null) out.push({ l, kind: '受注可否 未回答', detail: 'C社の受注可否がありません', sev: 'warn' }); if (l.bMarginPct == null) out.push({ l, kind: '利益率 未入力', detail: 'B社の利益率がありません（販売価格 = A社提示）', sev: 'warn' }); if (requiredLead != null && l.leadDays != null && l.leadDays > requiredLead) out.push({ l, kind: '納期超過', detail: `納期 ${l.leadDays} 日 > 要求 ${requiredLead} 日`, sev: 'bad' }); }
  return out;
}
export function finalizeGate(app, est) {
  return new Promise(res => { const requiredLead = est.meta?.requiredLead ?? null; const issues = finalizeIssues(est, { requiredLead }); if (!issues.length) { res({ ok: true, note: '' }); return; }
    const bad = issues.filter(i => i.sev === 'bad').length; const body = h('div', {}, h('p', {}, h('b', { class: bad ? 'bad' : '' }, `${issues.length} 件の未解決`), bad ? '：受注不可・納期超過があります。' : '：未回答・未入力があります。', '確定すると以後編集できません。'), table(['No', '品名', '問題', '内容'], issues.map(i => [i.l.no, i.l.desc, h('span', { class: 'chip ' + i.sev }, i.kind), i.detail])), h('p', { class: 'muted small' }, '差戻して再回答を依頼するか、理由を付けて承知の上で確定してください（監査ログに記録されます）。'));
    const m = modal({ title: '確定前チェック', wide: true, body, footer: [h('button', { class: 'btn', onClick: () => { m.close(); res({ ok: false }); } }, 'キャンセル'), h('button', { class: 'btn danger', onClick: async () => { m.close(); const r = await promptDialog('承知の上で確定', [{ key: 'note', label: '理由（監査ログに残ります）', type: 'textarea', value: '' }]); if (!r || !r.note) { res({ ok: false }); return; } res({ ok: true, note: `確定前チェック ${issues.length} 件を承知: ${r.note}` }); } }, '承知の上で確定')] }); });
}
export async function finalizeDialog(app, est, rerender) {
  const g1 = await reviewGate(app, '確定'); if (!g1.ok) return false; const g2 = await finalizeGate(app, est); if (!g2.ok) return false;
  await app.store.finalizeEstimate(est.id, { who: app.user().name, org: app.role(), note: [g1.note, g2.note].filter(Boolean).join(' / ') }); try { await recordFromEstimate(app, est); } catch { } toast('確定しました', 'ok'); rerender?.(); app.flowRefresh?.(); return true;
}
