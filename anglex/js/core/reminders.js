// 催促・期限通知の判定（純粋ロジック。クライアントのバッジ／ダッシュボードとサーバーの自動送信で同じルール）
import { deadlineInfo, ROLES } from './workflow.js';
// 対象: 未確定の見積のうち 期限超過 / 期限 1 日以内 / 未回答 3 日以上。kind は重い順に 1 つ
export function reminderKind(est, now = new Date()) {
  if (!est || est.status === 'final') return null; const dl = deadlineInfo(est, now); if (!dl) return null;
  if (dl.overdue) return { kind: 'overdue', days: -dl.left, label: `期限超過 ${-dl.left} 日` };
  if (dl.left != null && dl.left <= 1) return { kind: 'due_soon', days: dl.left, label: dl.left <= 0 ? '本日が期限' : '期限は明日' };
  if ((dl.since ?? 0) >= 3 && est.handoffs?.length) return { kind: 'stale', days: dl.since, label: `未回答 ${dl.since} 日` };
  return null;
}
// 役割ごとの対象: A社は全件（追う側）、B社・C社は自社が担当中のもの（答える側）
export function remindersFor(ests, role, now = new Date()) {
  const out = []; for (const e of ests) { const r = reminderKind(e, now); if (!r) continue; if (role !== 'A' && e.currentOrg !== role) continue; out.push({ est: e, ...r, waitingOn: e.currentOrg, waitingOnName: ROLES[e.currentOrg]?.name || e.currentOrg }); }
  const w = { overdue: 0, due_soon: 1, stale: 2 }; return out.sort((a, b) => w[a.kind] - w[b.kind] || (b.days || 0) - (a.days || 0));
}
// サーバー自動送信の判定: 同じ見積・同じ種類は 24 時間に 1 通まで
export function shouldSend(est, kind, log, now = new Date()) { const last = (log || []).filter(x => x.estId === est.id && x.kind === kind).map(x => new Date(x.at).getTime()).sort((a, b) => b - a)[0]; return !last || now.getTime() - last >= 24 * 3600 * 1000; }
export function reminderSubject(est, r) { return `【ANGLEX】見積 ${est.no} Rev.${est.revision} ${r.label}（${est.projectName}）`; }
