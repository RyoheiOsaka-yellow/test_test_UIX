// 多社見積ワークフロー（A社: 見積作成 → B社: 利益上乗せ → C社: 加工工場 原価回答）
// 役割ごとに「編集できる項目」を限定し、受け渡し（ハンドオフ）ごとに改訂を凍結・監査ログを残す。
// このモジュールは純粋ロジック。クライアント（localStorage）でもサーバ（server/server.js）でも同じルールで検証する。
export const ROLES = {
  A: { id: 'A', name: '見積作成（設計・元請）', color: '#1f5f8b', edits: ['model', 'lines.qty', 'lines.desc', 'lines.baseCost', 'lines.aMarginPct', 'meta', 'rates'], sees: ['lines.baseCost', 'lines.factoryCost', 'lines.bMarginPct', 'lines.price'], handoffTo: ['B', 'C'] },
  B: { id: 'B', name: '販売（商社・代理店）', color: '#8a5a1f', edits: ['lines.bMarginPct', 'lines.bNote', 'meta.customer'], sees: ['lines.baseCost', 'lines.bMarginPct', 'lines.price'], handoffTo: ['C', 'A'] },
  C: { id: 'C', name: '加工工場', color: '#3e6b4a', edits: ['lines.factoryCost', 'lines.leadDays', 'lines.cNote', 'lines.accepted'], sees: ['lines.factoryCost', 'lines.qty', 'lines.desc', 'lines.spec'], handoffTo: ['A', 'B'] },
};
export const STATUS = { draft: 'A社 作成中', to_B: 'B社 確認中（利益設定）', to_C: 'C社 原価見積中', from_C: 'C社 回答済', final: '確定', rejected: '差戻し' };
export function canEdit(role, field) { const r = ROLES[role]; if (!r) return false; return r.edits.some(e => field === e || field.startsWith(e + '.') || (e.endsWith('*') && field.startsWith(e.slice(0, -1)))); }
export function canSee(role, field) { const r = ROLES[role]; if (!r) return false; if (role === 'A') return true; return r.sees.includes(field) || r.edits.includes(field); }

// 見積ドキュメント
export function newEstimate({ projectId, projectName, lines, rates, author, org }) {
  const now = new Date().toISOString();
  return { id: 'E' + Date.now().toString(36), no: 'Q-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000), projectId, projectName, status: 'draft', currentOrg: 'A', revision: 1, createdAt: now, updatedAt: now,
    meta: { customer: '', site: '', deliveryDate: '', terms: '工場渡し / 税別', validity: '30日', notes: '' },
    lines: lines.map((l, i) => ({ id: l.id || 'ln' + i, no: i + 1, desc: l.desc, spec: l.spec || '', family: l.family, marks: l.marks || [], qty: l.qty, unit: l.unit || '台', mass: l.mass || 0, breakdown: l.cost ? { material: l.cost.material, cut: l.cost.cut, hole: l.cost.hole, weld: l.cost.weld, bend: l.cost.bend, assembly: l.cost.assembly, finish: l.cost.finish, fasteners: l.cost.fasteners, overhead: l.cost.overhead, profit: l.cost.profit } : null,
      baseCost: l.unitCost, aMarginPct: 10, factoryCost: null, bMarginPct: 15, leadDays: null, accepted: null, bNote: '', cNote: '' })),
    rates, revisions: [], audit: [{ at: now, who: author, org, action: 'create', note: '見積を作成' }], handoffs: [], tokens: {} };
}
// 単価の決定: C社回答があれば factoryCost、なければ A社の基準原価。 A社マージン → B社マージンの順に乗せる
export function linePrices(l) { const factory = l.factoryCost != null ? l.factoryCost : l.baseCost; const aPrice = Math.round(factory * (1 + (l.aMarginPct || 0) / 100)); const bPrice = Math.round(aPrice * (1 + (l.bMarginPct || 0) / 100)); return { factory, aPrice, bPrice, amountFactory: factory * l.qty, amountA: aPrice * l.qty, amountB: bPrice * l.qty }; }
export function totals(est) { const t = { factory: 0, a: 0, b: 0, mass: 0 }; for (const l of est.lines) { const p = linePrices(l); t.factory += p.amountFactory; t.a += p.amountA; t.b += p.amountB; t.mass += (l.mass || 0) * l.qty; } t.tax = Math.round(t.b * 0.1); t.bWithTax = t.b + t.tax; t.mass = Math.round(t.mass * 100) / 100; return t; }
// 役割で見える価格列（B社には C社原価を見せない、C社には販売価格を見せない）
export function visibleColumns(role) { return { A: ['baseCost', 'factoryCost', 'aPrice', 'bMarginPct', 'bPrice'], B: ['aPrice', 'bMarginPct', 'bPrice'], C: ['factoryCost', 'leadDays', 'accepted'] }[role] || []; }
// 編集の適用（権限検証つき）
export function applyEdit(est, { role, who, lineId, field, value }) {
  const f = lineId ? 'lines.' + field : field; if (!canEdit(role, f)) throw new Error(`${ROLES[role]?.name || role} は「${field}」を編集できません`);
  if (est.currentOrg !== role) throw new Error(`現在は ${ROLES[est.currentOrg].name} の担当段階です。${ROLES[role].name} は編集できません`);
  const now = new Date().toISOString(); let before;
  if (lineId) { const l = est.lines.find(x => x.id === lineId); if (!l) throw new Error('明細がありません'); before = l[field]; l[field] = value; } else { const [a, b] = field.split('.'); if (b) { before = est[a][b]; est[a][b] = value; } else { before = est[a]; est[a] = value; } }
  est.updatedAt = now; est.audit.push({ at: now, who, org: role, action: 'edit', field: f, lineId, before, after: value }); return est;
}
// 受け渡し: 現段階の内容を改訂として凍結し、次の会社へ
export function handoff(est, { from, to, who, note = '', due = null }) {
  if (est.currentOrg !== from) throw new Error('受け渡し元が現在の担当と一致しません'); if (!ROLES[from].handoffTo.includes(to)) throw new Error(`${from} → ${to} の受け渡しは定義されていません`);
  const now = new Date().toISOString(); const snap = JSON.parse(JSON.stringify({ lines: est.lines, meta: est.meta, totals: totals(est) }));
  est.revisions.push({ rev: est.revision, org: from, who, at: now, note, snapshot: snap }); est.revision += 1; est.currentOrg = to;
  est.status = to === 'B' ? 'to_B' : to === 'C' ? 'to_C' : (from === 'C' ? 'from_C' : 'draft');
  const token = 'h_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); est.tokens[to] = token; est.handoffs.push({ at: now, from, to, who, note, token, due: due || null }); est.due = due || null;
  est.audit.push({ at: now, who, org: from, action: 'handoff', note: `${ROLES[from].name} → ${ROLES[to].name}` + (note ? '：' + note : '') }); est.updatedAt = now; return { est, token };
}
export function finalize(est, { who, org, note = '' }) { if (org !== 'A') throw new Error('確定は A社のみ'); est.status = 'final'; est.currentOrg = 'A'; est.due = null; const now = new Date().toISOString(); est.audit.push({ at: now, who, org, action: 'finalize', note: '見積を確定' + (note ? '：' + note : '') }); est.updatedAt = now; return est; }
export function reject(est, { who, org, note }) { const now = new Date().toISOString(); est.status = 'rejected'; est.currentOrg = 'A'; est.audit.push({ at: now, who, org, action: 'reject', note: note || '差戻し' }); est.updatedAt = now; return est; }
// 役割向けの表示用フィルタ（見せてはいけない列を落とす）
export function redact(est, role) { if (role === 'A') return est; const e = JSON.parse(JSON.stringify(est)); for (const l of e.lines) { if (role === 'B') { delete l.factoryCost; delete l.breakdown; delete l.cNote; delete l.leadDays; l.aPrice = linePrices(l).aPrice; delete l.baseCost; delete l.aMarginPct; } if (role === 'C') { delete l.baseCost; delete l.aMarginPct; delete l.bMarginPct; delete l.bNote; } } if (role !== 'A') delete e.rates; return e; }
// 差分（改訂比較）
export function diffRevisions(a, b) { const out = []; const map = new Map(a.lines.map(l => [l.id, l])); for (const l of b.lines) { const o = map.get(l.id); if (!o) { out.push({ lineId: l.id, change: 'added' }); continue; } for (const k of ['qty', 'baseCost', 'factoryCost', 'aMarginPct', 'bMarginPct', 'leadDays', 'accepted']) if (o[k] !== l[k]) out.push({ lineId: l.id, desc: l.desc, field: k, before: o[k], after: l[k] }); } return out; }

// 期限・未回答日数（業務フロー／ダッシュボード用）
export function deadlineInfo(est, now = new Date()) {
  if (!est || est.status === 'final') return null; const last = est.handoffs?.[est.handoffs.length - 1] || null; const since = last ? Math.floor((now - new Date(last.at)) / 86400000) : null;
  const due = est.due ? new Date(est.due) : null; const left = due ? Math.ceil((due - now) / 86400000) : null;
  return { due: est.due, left, overdue: left != null && left < 0, since, waitingOn: est.currentOrg };
}
