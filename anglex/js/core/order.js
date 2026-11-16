// 案件の進行（依頼から納品まで）。段階・期限・難易度・工場選定・履歴を持つ純粋ロジック。
// 画面（js/ui/order.js）とテストの両方から使う。案件ファイルの project.order に保存する。
// 難易度の基準、標準日数、工場の一覧は「仮の値」。導入先の実績で置き換える前提（docs/OPEN_ITEMS.md）。

export const STAGES = [
  { id: 'request', name: '相談・依頼', owner: '依頼者', hint: '顧客・現場・希望納期・数量を受け付ける' },
  { id: 'drawing', name: '図面共有', owner: '依頼者', hint: '図面や 3D を読み込み、位置を指してやり取りする' },
  { id: 'spec', name: '仕様整理', owner: '設計', hint: '材質・仕上げ・寸法の未確定をなくす' },
  { id: 'quote', name: '積算・見積', owner: '設計・販売', hint: '重量と加工から原価を出し、見積を確定する' },
  { id: 'shop', name: '作図・承認', owner: '設計', hint: '加工指示書と部品表を出し、承認をもらう' },
  { id: 'factory', name: '工場選定・手配', owner: '手配', hint: '加工内容に合う工場を選び、発注する' },
  { id: 'make', name: '製作', owner: '工場', hint: '切断・穴あけ・溶接・表面処理' },
  { id: 'inspect', name: '検査・書類', owner: '工場・品質', hint: '検査記録と品質書類をそろえる' },
  { id: 'deliver', name: '納品・検収', owner: '手配・依頼者', hint: '納品書を出し、検収を記録する' },
];
export const STATUS_JA = { todo: '未着手', doing: '進行中', done: '完了', hold: '保留' };
export const stageById = id => STAGES.find(s => s.id === id);

// 難易度の基準（仮）。点数の合計で A（標準）・B（やや複雑）・C（複雑）に分ける
export const DEFAULT_RULES = {
  // 標準日数（営業日）: 段階ごと、難易度ごと
  days: { request: { A: 1, B: 1, C: 1 }, drawing: { A: 1, B: 2, C: 3 }, spec: { A: 1, B: 2, C: 4 }, quote: { A: 2, B: 3, C: 5 }, shop: { A: 2, B: 4, C: 7 }, factory: { A: 1, B: 2, C: 3 }, make: { A: 5, B: 8, C: 14 }, inspect: { A: 1, B: 2, C: 3 }, deliver: { A: 2, B: 2, C: 3 } },
  galvDays: 4,           // 溶融亜鉛めっきがあるとき、製作に足す日数
  classB: 4, classC: 9,  // この点数以上で B・C
};

// 加工内容（モデルから数える）→ 難易度
// need: { parts, welds, weldLen, holes, miters, maxLen, mass, galv, sus, custom, kinds }
export function needsOf(rows = []) {
  const n = { parts: 0, steel: 0, welds: 0, weldLen: 0, holes: 0, miters: 0, maxLen: 0, mass: 0, galv: false, sus: false, custom: 0, bought: 0 };
  for (const pt of rows) {
    const q = pt.qty || 1; if (pt.ref) continue;
    if (pt.kind === 'weld') { n.welds += q; n.weldLen += (pt.length || 0) * q; continue; }
    n.parts += q;
    if (pt.kind === 'member' || pt.kind === 'plate') { n.steel += q; n.holes += (pt.holes?.length || 0) * q; if (pt.cuts && (pt.cuts.s || pt.cuts.e)) n.miters += q; n.maxLen = Math.max(n.maxLen, pt.length || 0); }
    else if (pt.kind === 'custom') n.custom += q; else n.bought += q;
    n.mass += (pt.mass || 0) * q;
    const f = String(pt.finish || ''); if (f.startsWith('HDZ')) n.galv = true; if (f.startsWith('SUS') || pt.material === 'SUS304') n.sus = true;
  }
  return n;
}
export function difficulty(need, rules = DEFAULT_RULES) {
  const reasons = []; let score = 0; const add = (pts, why) => { if (pts > 0) { score += pts; reasons.push({ pts, why }); } };
  add(need.steel > 40 ? 3 : need.steel > 15 ? 2 : need.steel > 5 ? 1 : 0, `鋼材の部品 ${need.steel} 点`);
  add(need.welds > 40 ? 3 : need.welds > 12 ? 2 : need.welds > 0 ? 1 : 0, `溶接 ${need.welds} か所`);
  add(need.miters > 6 ? 2 : need.miters > 0 ? 1 : 0, `斜め切り ${need.miters} 本`);
  add(need.holes > 60 ? 2 : need.holes > 20 ? 1 : 0, `穴 ${need.holes} 個`);
  add(need.maxLen > 6000 ? 2 : need.maxLen > 4000 ? 1 : 0, `最長 ${Math.round(need.maxLen)} mm`);
  add(need.galv ? 1 : 0, '溶融亜鉛めっき（外注の日数がかかる）');
  add(need.sus ? 2 : 0, 'ステンレス（溶接と仕上げに手間）');
  const cls = score >= rules.classC ? 'C' : score >= rules.classB ? 'B' : 'A';
  return { cls, score, reasons, label: { A: 'A 標準', B: 'B やや複雑', C: 'C 複雑' }[cls] };
}

// 営業日（土日を除く）。祝日は見ていない
const DAY = 86400000;
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const parse = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const isBiz = d => d.getDay() !== 0 && d.getDay() !== 6;
export function addBizDays(dateStr, n) { let d = parse(dateStr); const step = n < 0 ? -1 : 1; let left = Math.abs(n); while (left > 0) { d = new Date(d.getTime() + step * DAY); if (isBiz(d)) left--; } return iso(d); }
export function bizDaysBetween(a, b) { let d = parse(a); const e = parse(b); let n = 0; const step = e >= d ? 1 : -1; while (iso(d) !== iso(e)) { d = new Date(d.getTime() + step * DAY); if (isBiz(d)) n += step; } return n; }
export const today = () => iso(new Date());

// 標準日数から各段階の期限を出す。start から順に積む。希望納期があれば、足りるかどうかも返す
export function planSchedule({ start = today(), due = null, cls = 'A', galv = false, rules = DEFAULT_RULES, factoryLead = null } = {}) {
  const out = {}; let cur = start; let total = 0;
  for (const s of STAGES) { let n = rules.days[s.id]?.[cls] ?? 1; if (s.id === 'make') { if (factoryLead != null) n = Math.max(n, factoryLead); if (galv) n += rules.galvDays; } total += n; cur = addBizDays(cur, n); out[s.id] = { days: n, due: cur }; }
  const finish = cur; const slack = due ? bizDaysBetween(finish, due) : null;
  return { stages: out, finish, total, slack, ok: slack == null || slack >= 0 };
}

export function newOrder({ project, user, need = null, start = today() } = {}) {
  const diff = difficulty(need || needsOf([])); const plan = planSchedule({ start, cls: diff.cls, galv: !!need?.galv });
  const stages = {}; for (const s of STAGES) stages[s.id] = { status: 'todo', due: plan.stages[s.id].due, doneAt: null, by: null, note: '', manual: {} };
  stages.request.status = 'doing';
  const y = new Date().getFullYear(); const no = 'J-' + y + '-' + String(Date.now() % 100000).padStart(5, '0');
  return { schema: 'anglex.order/1.0', no, createdAt: new Date().toISOString(), start,
    request: { customer: project?.client || '', site: '', contact: '', due: '', qty: 1, finish: '', notes: '' },
    difficulty: diff, stages, factory: null, factoryQuotes: [], changes: [], delivery: { date: '', receiver: '', accepted: null, note: '' },
    history: [{ at: new Date().toISOString(), who: user?.name || '', org: user?.org || '', stage: 'request', action: 'create', note: '案件を登録' }] };
}
export function log(order, { user, stage = null, action, note = '' }) { order.history.push({ at: new Date().toISOString(), who: user?.name || '', org: user?.org || '', stage, action, note }); return order; }

// いまの段階: 最初の「完了でない」段階
export function currentStage(order) { return STAGES.find(s => order.stages[s.id]?.status !== 'done') || null; }
export function progress(order) { const n = STAGES.filter(s => order.stages[s.id]?.status === 'done').length; return { done: n, total: STAGES.length, pct: Math.round(n / STAGES.length * 100) }; }
export function lateStages(order, now = today()) { return STAGES.filter(s => { const st = order.stages[s.id]; return st && st.status !== 'done' && st.due && st.due < now; }).map(s => s.id); }

// 期限の引き直し: 難易度・希望納期・工場の納期が変わったとき。完了した段階の期限は動かさない
export function replan(order, { need = null, rules = DEFAULT_RULES, user = null, reason = '' } = {}) {
  if (need) order.difficulty = difficulty(need, rules);
  const cur = currentStage(order); if (!cur) return order;
  const idx = STAGES.indexOf(cur); const prevDone = idx > 0 ? (order.stages[STAGES[idx - 1].id].doneAt || '').slice(0, 10) : ''; let start = prevDone || order.start || today(); if (start < today() && idx > 0) start = today();
  const galv = need ? need.galv : /溶融|HDZ|ドブ/.test(order.request.finish || '');
  let d = start; for (const s of STAGES.slice(idx)) { let n = rules.days[s.id]?.[order.difficulty.cls] ?? 1; if (s.id === 'make') { if (order.factory?.leadDays != null) n = Math.max(n, order.factory.leadDays); if (galv) n += rules.galvDays; } d = addBizDays(d, n); order.stages[s.id].due = d; }
  if (user) log(order, { user, stage: cur.id, action: 'replan', note: reason || `期限を引き直し（難易度 ${order.difficulty.cls}、完了見込み ${d}）` });
  return order;
}
export function finishDate(order) { return order.stages.deliver?.due || null; }
export function dueSlack(order) { const due = order.request?.due; const fin = finishDate(order); if (!due || !fin) return null; return bizDaysBetween(fin, due); }

// 段階を進める。checks = [{ ok, label, manual }]。未達があるときは force と理由が要る
export function completeStage(order, stageId, { user, checks = [], force = false, note = '' } = {}) {
  const st = order.stages[stageId]; if (!st) throw new Error('段階がありません: ' + stageId);
  const idx = STAGES.findIndex(s => s.id === stageId); const before = STAGES.slice(0, idx).filter(s => order.stages[s.id].status !== 'done');
  if (before.length && !force) return { ok: false, reason: `前の段階が終わっていません: ${before.map(s => s.name).join('、')}` };
  const open = checks.filter(c => !c.ok); if (open.length && !force) return { ok: false, reason: `確認が残っています: ${open.map(c => c.label).join('、')}`, open };
  st.status = 'done'; st.doneAt = new Date().toISOString(); st.by = user?.name || ''; if (note) st.note = note;
  log(order, { user, stage: stageId, action: force && (open.length || before.length) ? 'complete-forced' : 'complete', note: (force && open.length ? `未達のまま完了（${open.map(c => c.label).join('、')}）` : '完了') + (note ? ' / ' + note : '') });
  const next = STAGES[idx + 1]; if (next && order.stages[next.id].status === 'todo') order.stages[next.id].status = 'doing';
  return { ok: true, next: next?.id || null };
}
export function reopenStage(order, stageId, { user, note = '' } = {}) { const st = order.stages[stageId]; st.status = 'doing'; st.doneAt = null; log(order, { user, stage: stageId, action: 'reopen', note: note || '差し戻し' }); return order; }
export function setHold(order, stageId, hold, { user, note = '' } = {}) { const st = order.stages[stageId]; st.status = hold ? 'hold' : 'doing'; log(order, { user, stage: stageId, action: hold ? 'hold' : 'resume', note }); return order; }

// 変更の記録（発注後の変更も時系列で残す）
export function addChange(order, { user, what, costDelta = 0, dayDelta = 0 }) {
  const c = { id: 'C' + (order.changes.length + 1), at: new Date().toISOString(), who: user?.name || '', stage: currentStage(order)?.id || 'deliver', what, costDelta: +costDelta || 0, dayDelta: +dayDelta || 0 };
  order.changes.push(c);
  if (c.dayDelta) for (const s of STAGES) { const st = order.stages[s.id]; if (st.status !== 'done' && st.due) st.due = addBizDays(st.due, c.dayDelta); }
  log(order, { user, stage: c.stage, action: 'change', note: `${what}${c.costDelta ? `（金額 ${c.costDelta > 0 ? '+' : ''}${c.costDelta.toLocaleString('ja-JP')} 円）` : ''}${c.dayDelta ? `（納期 ${c.dayDelta > 0 ? '+' : ''}${c.dayDelta} 日）` : ''}` });
  return c;
}

// ---------- 工場 ----------
// サンプルの工場（架空）。導入先の取引先に置き換える
export const SAMPLE_FACTORIES = [
  { id: 'F1', name: 'サンプル工場 A', region: '関東', caps: ['cut', 'drill', 'weld', 'miter'], galv: 'outsource', sus: false, maxLen: 6000, maxMass: 300, leadDays: 6, load: 60, rate: 1.00, quality: 4, note: '小物の架台が得意' },
  { id: 'F2', name: 'サンプル工場 B', region: '関東', caps: ['cut', 'drill', 'weld', 'miter', 'bend'], galv: 'inhouse', sus: true, maxLen: 9000, maxMass: 1500, leadDays: 9, load: 80, rate: 1.12, quality: 5, note: 'めっきまで一貫。ステンレス可' },
  { id: 'F3', name: 'サンプル工場 C', region: '中部', caps: ['cut', 'drill'], galv: 'none', sus: false, maxLen: 6000, maxMass: 200, leadDays: 3, load: 30, rate: 0.90, quality: 3, note: '切断と穴あけのみ。短納期' },
  { id: 'F4', name: 'サンプル工場 D', region: '関西', caps: ['cut', 'drill', 'weld', 'miter', 'bend'], galv: 'outsource', sus: true, maxLen: 12000, maxMass: 3000, leadDays: 10, load: 50, rate: 1.05, quality: 4, note: '長尺と重量物に対応' },
];
export const CAP_JA = { cut: '切断', drill: '穴あけ', weld: '溶接', miter: '斜め切り', bend: '曲げ' };
export const GALV_JA = { inhouse: '自社', outsource: '外注', none: '不可' };

// 加工内容に合う工場を並べる。満たせない条件がある工場は下に回し、理由を付ける
export function recommendFactories(factories, need, { region = '', due = null, start = today() } = {}) {
  const want = []; if (need.steel) want.push('cut'); if (need.holes) want.push('drill'); if (need.welds) want.push('weld'); if (need.miters) want.push('miter');
  return factories.map(f => {
    const miss = []; for (const c of want) if (!f.caps.includes(c)) miss.push(CAP_JA[c] + 'ができない');
    if (need.galv && f.galv === 'none') miss.push('溶融亜鉛めっきの手配ができない'); if (need.sus && !f.sus) miss.push('ステンレスを扱わない');
    if (need.maxLen > f.maxLen) miss.push(`最長 ${Math.round(need.maxLen)} mm が入らない（上限 ${f.maxLen}）`); if (need.mass > f.maxMass) miss.push(`質量 ${Math.round(need.mass)} kg が上限 ${f.maxMass} を超える`);
    const lead = f.leadDays + (need.galv ? (f.galv === 'inhouse' ? 2 : 4) : 0) + Math.round(f.load / 25); const ready = addBizDays(start, lead);
    const good = [];
    let score = 100 - miss.length * 100; score -= (f.rate - 1) * 120; score -= lead * 2; score += f.quality * 6; score -= f.load * 0.15;
    if (region && f.region === region) { score += 8; good.push('同じ地域'); } if (need.galv && f.galv === 'inhouse') { score += 6; good.push('めっきまで一貫'); }
    if (f.rate <= 0.95) good.push('単価が低い'); if (lead <= 6) good.push('納期が短い'); if (f.quality >= 5) good.push('品質の評価が高い');
    const late = due ? ready > due : false; if (late) { score -= 25; }
    return { factory: f, ok: !miss.length, miss, good, lead, ready, late, score: Math.round(score) };
  }).sort((a, b) => (b.ok - a.ok) || (b.score - a.score));
}
export function chooseFactory(order, rec, { user, price = null, note = '' } = {}) {
  const f = rec.factory; order.factory = { id: f.id, name: f.name, region: f.region, leadDays: rec.lead, rate: f.rate, chosenAt: new Date().toISOString(), price, note, forced: !rec.ok, miss: rec.miss };
  log(order, { user, stage: 'factory', action: 'factory', note: `工場を選定: ${f.name}（納期 ${rec.lead} 日）${rec.ok ? '' : ' ※満たせない条件あり: ' + rec.miss.join('、')}${note ? ' / ' + note : ''}` });
  return order;
}
export function addFactoryQuote(order, { factoryId, name, price, leadDays, user }) { order.factoryQuotes.push({ factoryId, name, price: +price || 0, leadDays: +leadDays || 0, at: new Date().toISOString() }); log(order, { user, stage: 'factory', action: 'fquote', note: `工場の見積: ${name} ${(+price || 0).toLocaleString('ja-JP')} 円 / ${leadDays} 日` }); return order; }

export const ACTION_JA = { create: '登録', complete: '完了', 'complete-forced': '完了（未達あり）', reopen: '差し戻し', hold: '保留', resume: '再開', change: '変更', factory: '工場選定', fquote: '工場見積', replan: '期限の引き直し', request: '依頼内容', doc: '書類', deliver: '納品', accept: '検収', note: 'メモ' };
