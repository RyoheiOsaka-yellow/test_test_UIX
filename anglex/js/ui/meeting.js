// 打合せの予約（オンライン確認）: Google カレンダー / Outlook（Teams 会議）/ .ics を、見積の受け渡しリンク付きで生成する。
// ログイン連携（OAuth）なしで動く「リンク方式」。Google Meet の URL 自動発行や空き時間の参照は、サーバー版で各社の OAuth を設定したときに追加する。
import { h, modal, toast, promptDialog, download, fmt } from './common.js';
import * as WF from '../core/workflow.js';
const pad = n => String(n).padStart(2, '0');
const fmtUTC = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const fmtLocal = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
export function meetingLinks({ title, start, minutes = 30, details = '', attendees = [], location = 'オンライン' }) {
  const end = new Date(start.getTime() + minutes * 60000); const q = encodeURIComponent;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${q(title)}&dates=${fmtUTC(start)}/${fmtUTC(end)}&details=${q(details)}&location=${q(location)}${attendees.length ? '&add=' + q(attendees.join(',')) : ''}`;
  const outlook = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${q(title)}&startdt=${q(start.toISOString())}&enddt=${q(end.toISOString())}&body=${q(details)}&location=${q(location)}&online=1${attendees.length ? '&to=' + q(attendees.join(';')) : ''}`;
  const teams = `https://teams.microsoft.com/l/meeting/new?subject=${q(title)}&startTime=${q(start.toISOString())}&endTime=${q(end.toISOString())}&content=${q(details)}${attendees.length ? '&attendees=' + q(attendees.join(',')) : ''}`;
  const meet = 'https://meet.google.com/new';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ANGLEX//JP', 'BEGIN:VEVENT', `UID:${Date.now()}@anglex`, `DTSTAMP:${fmtUTC(new Date())}`, `DTSTART:${fmtUTC(start)}`, `DTEND:${fmtUTC(end)}`, `SUMMARY:${title.replace(/[,;]/g, ' ')}`, `DESCRIPTION:${details.replace(/\n/g, '\\n').replace(/[,;]/g, ' ')}`, `LOCATION:${location}`, ...attendees.map(a => `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${a}`), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { google, outlook, teams, meet, ics, end };
}
// 見積の打合せ: 相手会社のユーザー（メール）を参加者に、受け渡しリンクと合計を本文に
export async function meetingDialog(app, est, rerender) {
  const role = app.role(); const other = est.currentOrg === role ? (est.handoffs?.slice(-1)[0]?.from || 'A') : est.currentOrg; const users = (app.store.d?.users || []).filter(u => u.org === other && u.email).map(u => u.email);
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); const def = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
  const r = await promptDialog('オンライン打合せを予約', [{ key: 'title', label: '件名', type: 'text', value: `【ANGLEX】見積 ${est.no} Rev.${est.revision} 確認（${est.projectName}）` }, { key: 'start', label: '日時', type: 'datetime-local', value: def }, { key: 'minutes', label: '所要（分）', type: 'number', value: 30 }, { key: 'attendees', label: '参加者メール（, 区切り）', type: 'text', value: users.join(', ') }, { key: 'tool', label: '会議ツール', type: 'select', value: 'google', options: [['google', 'Google カレンダー（Meet は予定内で追加）'], ['outlook', 'Outlook 予定（Teams 会議を自動で付ける）'], ['teams', 'Teams 会議を直接作成'], ['ics', '.ics をダウンロード（任意のカレンダー）']] }, { key: 'note', label: '議題・メモ', type: 'textarea', value: `確認事項: 要判断 / 単価・納期 / 確定可否` }]); if (!r) return null;
  const start = new Date(r.start); if (isNaN(start)) { toast('日時を確認してください', 'warn'); return null; } const attendees = String(r.attendees || '').split(/[,;\s]+/).map(s => s.trim()).filter(s => /@/.test(s));
  const link = est.tokens?.[other] ? location.origin + location.pathname + '?handoff=' + est.tokens[other] : location.origin + location.pathname; const T = WF.totals(est);
  const details = [`ANGLEX 見積 ${est.no} Rev.${est.revision} ${est.projectName}`, `状態: ${WF.STATUS[est.status]} / 明細 ${est.lines.length} 行 / 総質量 ${fmt.kg(T.mass)}`, `見積を開く（相手の権限で同じ見積）: ${link}`, '', r.note || ''].join('\n');
  const L = meetingLinks({ title: r.title, start, minutes: +r.minutes || 30, details, attendees });
  // 記録（監査ログに残す。相手にも見える）
  try { await app.store.addMeeting(est.id, { who: app.user().name, org: role, at: start.toISOString(), minutes: +r.minutes || 30, title: r.title, tool: r.tool, attendees }); } catch (e) { console.warn('meeting record', e); }
  if (r.tool === 'ics') download(`anglex_meeting_${est.no}.ics`, L.ics, 'text/calendar'); else window.open(L[r.tool], '_blank', 'noopener');
  const m = modal({ title: '打合せの予約リンク', body: h('div', {}, h('p', { class: 'muted small' }, 'カレンダーが別タブで開きます（ポップアップが止められた場合は下のリンクから）。Google カレンダーでは予定内の「Google Meet のビデオ会議を追加」で Meet URL が付きます。Outlook は Teams 会議を自動で付けます。'), h('div', { class: 'flow-links' }, ...[['Google カレンダー', L.google], ['Outlook（Teams 会議つき）', L.outlook], ['Teams 会議を直接作成', L.teams], ['Google Meet を今すぐ開始', L.meet]].map(([k, u]) => h('div', { class: 'flow-link' }, h('span', { class: 'chip' }, k), h('a', { href: u, target: '_blank', rel: 'noopener' }, u.slice(0, 80) + '…')))), h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onClick: () => download(`anglex_meeting_${est.no}.ics`, L.ics, 'text/calendar') }, '.ics をダウンロード'), ' ', h('button', { class: 'btn sm', onClick: async () => { try { await navigator.clipboard.writeText(details); toast('本文をコピーしました', 'ok'); } catch { } } }, '本文をコピー'))), footer: [h('button', { class: 'btn primary', onClick: () => { m.close(); rerender?.(); app.flowRefresh?.(); } }, '閉じる')] });
  return L;
}
