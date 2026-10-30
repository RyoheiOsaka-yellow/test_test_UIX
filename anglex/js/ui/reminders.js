// 催促・期限通知（クライアント側）: 起動時と 10 分ごとに 期限超過／期限 1 日以内／未回答 3 日以上 を数え、ダッシュボード ボタンにバッジ、起動時にトースト。
// サーバー版は /api/reminders（サーバーが 1 時間ごとに自動送信した記録も返す）、ローカル版は見積から同じルールで計算
import { $, $$, h, toast, modal, table, fmt } from './common.js';
import { remindersFor } from '../core/reminders.js';
import { openDashboard } from './dashboard.js';
export async function collectReminders(app) {
  const role = app.role();
  if (app.store.mode === 'server' && app.store.req) { try { const r = await app.store.req('GET', '/api/reminders'); return { items: r.items || [], log: r.log || [], smtp: !!r.smtp, server: true }; } catch { } }
  const projects = await app.store.listProjects({ all: true }).catch(() => []); const ests = []; for (const p of projects) { try { ests.push(...await app.store.listEstimates(p.id)); } catch { } }
  return { items: remindersFor(ests, role).map(r => ({ estId: r.est.id, no: r.est.no, projectName: r.est.projectName, projectId: r.est.projectId, kind: r.kind, days: r.days, label: r.label, waitingOn: r.waitingOn, due: r.est.due })), log: [], smtp: false, server: false };
}
let timer = null; let lastKey = '';
export function installReminderBadge(app, { every = 10 * 60 * 1000, toastOnStart = true } = {}) {
  const refresh = async (first) => { try { const r = await collectReminders(app); app.reminders = r; renderBadge(app, r.items); const key = r.items.map(x => x.estId + x.kind).join(','); if (first && toastOnStart && r.items.length) { const o = r.items.filter(x => x.kind === 'overdue').length; toast(`期限の通知: ${r.items.length} 件（超過 ${o}）— ダッシュボードで確認`, o ? 'bad' : 'warn', 6000); } lastKey = key; } catch (e) { console.warn('reminders', e); } };
  clearInterval(timer); timer = setInterval(() => refresh(false), every); setTimeout(() => refresh(true), 1500);
  app.refreshReminders = () => refresh(false);
}
function renderBadge(app, items) {
  for (const id of ['btnDashboard', 'btnDashboard2']) { const b = $('#' + id); if (!b) continue; let badge = b.querySelector('.rem-badge'); if (!items.length) { badge?.remove(); continue; } if (!badge) { badge = h('span', { class: 'rem-badge' }); b.style.position = 'relative'; b.append(badge); } const o = items.filter(x => x.kind === 'overdue').length; badge.textContent = String(items.length); badge.classList.toggle('bad', o > 0); badge.title = items.map(x => `${x.no} ${x.label}（${x.waitingOn}社）`).join('\n'); }
}
// 期限一覧（ダッシュボードの KPI から）: 対象・種類・経過日数・サーバー自動送信の記録
export function openReminders(app) {
  const r = app.reminders || { items: [], log: [] }; const kindChip = k => h('span', { class: 'chip ' + (k === 'overdue' ? 'bad' : 'warn') }, { overdue: '期限超過', due_soon: '期限間近', stale: '未回答' }[k] || k);
  const body = h('div', {}, h('div', { class: 'muted small', style: { marginBottom: '6px' } }, r.server ? (r.smtp ? 'サーバーが 1 時間ごとに担当会社へメールを自動送信します（同じ見積・種類は 24 時間に 1 通）。' : 'サーバー版: SMTP 未設定のため自動送信は outbox（server/data/reminders.log）に残します。SMTP_HOST を設定すると送信されます。') : 'ローカル版: 通知はこの画面とバッジのみ。サーバー版では担当会社へメールを自動送信できます。'),
    r.items.length ? table(['見積', '案件', '種類', '状況', '待ち先', '期限'], r.items.map(x => [x.no, x.projectName, kindChip(x.kind), x.label, x.waitingOn + '社', x.due || '—'])) : h('div', { class: 'pp-empty' }, '期限の近い見積・未回答の見積はありません'),
    r.log?.length ? h('details', { style: { marginTop: '8px' } }, h('summary', {}, `自動送信の記録（直近 ${r.log.length} 件）`), table(['日時', '見積', '種類', '宛先', '経路'], r.log.slice().reverse().map(x => [fmt.date(x.at), x.no, x.kind, (x.to || []).join(', ') || '（宛先なし）', x.via + (x.error ? ' ✗ ' + x.error : '')]))) : null);
  const m = modal({ title: `期限・催促の通知（${r.items.length}）`, wide: true, body, footer: [h('button', { class: 'btn', onClick: () => m.close() }, '閉じる'), h('button', { class: 'btn primary', onClick: () => { m.close(); openDashboard(app); } }, 'ダッシュボードへ')] });
}
