import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, CheckCircle2, ChevronRight, CircleAlert, Clock3, Hourglass, MessageCircleQuestion, TrendingDown, Wallet } from 'lucide-react';
import {
  STATUSES,
  TODAY,
  addDays,
  addMonths,
  checkPlan,
  daysBetween,
  fmtDate,
  fmtMan,
  fmtYm,
  inspectionsOf,
  properties,
  propertyById,
  ratingLabel,
  type CheckKind,
  type Finding,
  type Property,
} from '../data';
import { CheckBadge, Empty, LEGEND, useStore } from '../ui';

const ME = '青木 涼';
const MY_BRANCH = '東京西支店';
type Scope = 'mine' | 'branch' | 'all';
const SCOPE_LABEL: Record<Scope, string> = { mine: '自分の担当', branch: '支店', all: '全社' };

const STALE_DAYS = 30;
const LANES: AgendaKindT[] = ['アフターサービス点検', '継続審査', '建物定期点検', '修繕期限'];
const LANE_SHORT: Record<AgendaKindT, string> = { アフターサービス点検: 'アフター', 継続審査: '継続審査', 建物定期点検: '定期点検', 修繕期限: '修繕期限' };
type AgendaKindT = CheckKind | '修繕期限';
const THIS_MONTH = TODAY.slice(0, 7);

interface Action {
  key: string;
  icon: typeof CircleAlert;
  tone: 'red' | 'amber' | 'blue' | 'teal';
  title: string;
  todo: string;
  items: { id: string; to: string; name: string; detail: string; tag: string; hot?: boolean }[];
  more: string;
}

type AgendaKind = CheckKind | '修繕期限';
interface AgendaItem {
  key: string;
  date: string;
  kind: AgendaKind;
  p: Property;
  text: string;
  to: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { findings } = useStore();
  const [scope, setScope] = useState<Scope>('mine');
  const [agendaAll, setAgendaAll] = useState(false);

  const d = useMemo(() => {
    const props = properties.filter((p) => (scope === 'mine' ? p.staff === ME : scope === 'branch' ? p.branch === MY_BRANCH : true));
    const ids = new Set(props.map((p) => p.id));
    const scopeQs = scope === 'mine' ? `&staff=${encodeURIComponent(ME)}` : scope === 'branch' ? `&branch=${encodeURIComponent(MY_BRANCH)}` : '';
    const open = findings.filter((f) => ids.has(f.propertyId) && f.severity !== 'ok' && f.status !== '完了');
    const urgent = open.filter((f) => f.severity === 'urgent');
    const wait = (f: Finding) => daysBetween(f.statusDate, TODAY);
    const pname = (f: Finding) => propertyById.get(f.propertyId)!.name;
    const fItem = (f: Finding, tag: string, hot = false) => ({ id: f.id, to: `/properties/${f.propertyId}?f=${f.id}`, name: pname(f), detail: `${f.part}|${f.location} ${f.title}`, tag, hot });

    // ---------- 今日やること ----------
    const overdueDue = urgent
      .filter((f) => f.dueBy && f.dueBy < THIS_MONTH)
      .sort((a, b) => (a.dueBy! < b.dueBy! ? -1 : 1));
    const waitingOwner = open.filter((f) => f.status === '提案済' && wait(f) >= STALE_DAYS).sort((a, b) => wait(b) - wait(a));
    const stuckInside = open
      .filter((f) => (f.status === '未対応' || f.status === '見積中') && wait(f) >= STALE_DAYS)
      .sort((a, b) => (a.severity === b.severity ? wait(b) - wait(a) : a.severity === 'urgent' ? -1 : 1));
    const plans = props.flatMap((p) => checkPlan(p).filter((c) => c.next).map((c) => ({ p, ...c, next: c.next! })));
    const checkSoon = plans.filter((c) => daysBetween(TODAY, c.next) <= 30).sort((a, b) => (a.next < b.next ? -1 : 1));
    const daysLabel = (n: number) => (n < 0 ? `${-n}日超過` : n === 0 ? '本日' : `あと${n}日`);

    const actions: Action[] = [
      {
        key: 'overdue',
        icon: CircleAlert,
        tone: 'red',
        title: '推奨時期を過ぎた早急案件',
        todo: '着工・完了までの段取りを急ぐ',
        items: overdueDue.map((f) => fItem(f, `${fmtYm(f.dueBy)}まで・${f.status}`, true)),
        more: `/records?tab=findings&sev=urgent&due=${encodeURIComponent('期限超過')}${scopeQs}`,
      },
      {
        key: 'owner',
        icon: MessageCircleQuestion,
        tone: 'blue',
        title: `提案後${STALE_DAYS}日以上、回答待ち`,
        todo: 'オーナー様へ再度ご連絡',
        items: waitingOwner.map((f) => fItem(f, `${wait(f)}日`, wait(f) >= 90)),
        more: `/records?tab=findings&st=${encodeURIComponent('提案済')}&stale=${STALE_DAYS}${scopeQs}`,
      },
      {
        key: 'inside',
        icon: Hourglass,
        tone: 'amber',
        title: `社内で${STALE_DAYS}日以上止まっている`,
        todo: '見積の依頼・催促をする',
        items: stuckInside.map((f) => fItem(f, `${f.status} ${wait(f)}日`, f.severity === 'urgent')),
        more: `/records?tab=findings&stale=${STALE_DAYS}&inside=1${scopeQs}`,
      },
      {
        key: 'check',
        icon: CalendarClock,
        tone: 'teal',
        title: '30日以内の点検・審査',
        todo: '日程を調整し、オーナー様へ連絡',
        items: checkSoon.map((c) => {
          const n = daysBetween(TODAY, c.next);
          return { id: c.p.id + c.kind, to: `/properties/${c.p.id}`, name: c.p.name, detail: `${c.kind} ${c.nextLabel}`, tag: daysLabel(n), hot: n < 0 };
        }),
        more: '/properties?sort=nextInspection',
      },
    ];

    // ---------- 主要指標 ----------
    const horizon = addMonths(TODAY, 36).slice(0, 7);
    const within3y = open.filter((f) => f.dueBy && f.dueBy <= horizon);

    // ---------- 修繕推奨額の見通し(期限超過を別に示す) ----------
    const lastYear = Number(TODAY.slice(0, 4)) + 4;
    const buckets = ['期限超過', ...Array.from({ length: 5 }, (_, i) => `${Number(TODAY.slice(0, 4)) + i}`), `${lastYear + 1}以降`];
    const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
    const byYear = buckets.map((b) => ({
      key: b,
      label: narrow ? (b === '期限超過' ? '超過' : /^\d{4}$/.test(b) ? `${b.slice(2)}年` : `${b.slice(2, 4)}年〜`) : /^\d{4}$/.test(b) ? `${b}年` : b,
      早急: 0,
      経過観察: 0,
      total: 0,
      count: 0,
    }));
    for (const f of open) {
      if (!f.dueBy) continue;
      const y = Number(f.dueBy.slice(0, 4));
      const i = f.dueBy < THIS_MONTH ? 0 : y > lastYear ? buckets.length - 1 : buckets.indexOf(String(y));
      if (i < 0) continue;
      const man = Math.round(f.estCost / 10000);
      byYear[i][f.severity === 'urgent' ? '早急' : '経過観察'] += man;
      byYear[i].total += man;
      byYear[i].count += 1;
    }

    // ---------- 対応の進み具合(停滞を併記) ----------
    const pipeline = STATUSES.filter((s) => s !== '完了').map((s) => {
      const fs = open.filter((f) => f.status === s);
      return { status: s, count: fs.length, cost: fs.reduce((a, f) => a + f.estCost, 0), stale: fs.filter((f) => wait(f) >= STALE_DAYS).length };
    });

    // ---------- 今後90日の予定 ----------
    const agenda: AgendaItem[] = [
      ...plans
        .filter((c) => daysBetween(TODAY, c.next) <= 90)
        .map((c) => ({ key: c.p.id + c.kind, date: c.next, kind: c.kind as AgendaKind, p: c.p, text: c.nextLabel, to: `/properties/${c.p.id}` })),
      ...open
        .filter((f) => f.dueBy && f.dueBy >= THIS_MONTH && f.dueBy <= addMonths(TODAY, 3).slice(0, 7) && f.status !== '工事中' && f.status !== '承認済')
        .map((f) => ({
          key: f.id,
          date: `${f.dueBy}-28`,
          kind: '修繕期限' as AgendaKind,
          p: propertyById.get(f.propertyId)!,
          text: `${f.part}|${f.location} の修繕推奨時期(${f.status})`,
          to: `/properties/${f.propertyId}?f=${f.id}`,
        })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));

    // ---------- 評価が下がった物件 ----------
    const drops = props
      .map((p) => {
        const hist = [...inspectionsOf(p.id)].sort((a, b) => (a.date < b.date ? -1 : 1));
        if (hist.length < 2) return null;
        const last = hist[hist.length - 1];
        const prev = hist[hist.length - 2];
        return { p, hist, delta: Math.round((last.score - prev.score) * 10) / 10, last };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.last.score - b.last.score);

    return { props, open, urgent, within3y, actions, byYear, pipeline, agenda, drops, scopeQs, plans };
  }, [findings, scope]);

  const maxPipe = Math.max(1, ...d.pipeline.map((p) => p.count));
  const overdueChecks = d.plans.filter((c) => c.next < TODAY).length;
  const soonChecks = d.plans.filter((c) => c.next >= TODAY && daysBetween(TODAY, c.next) <= 90).length;
  const todoTotal = d.actions.reduce((s, a) => s + a.items.length, 0);
  const actNow = d.actions.filter((a) => a.items.length > 0);
  const actNone = d.actions.filter((a) => a.items.length === 0);
  const topAction = [...actNow].sort((a, b) => b.items.length - a.items.length)[0];
  const urgentNew = d.urgent.filter((f) => f.status === '未対応').length;
  const proposed = d.open.filter((f) => f.status === '提案済');
  const proposedStale = proposed.filter((f) => daysBetween(f.statusDate, TODAY) >= STALE_DAYS).length;
  const cost3y = d.within3y.reduce((s, f) => s + f.estCost, 0);
  const cost3yUrgent = d.within3y.filter((f) => f.severity === 'urgent').reduce((s, f) => s + f.estCost, 0);
  const urgentBy = new Map<string, number>();
  for (const f of d.urgent) urgentBy.set(f.propertyId, (urgentBy.get(f.propertyId) ?? 0) + 1);

  // 予定を月ごとにまとめる(期限超過は先頭)
  const agendaShown = agendaAll ? d.agenda : d.agenda.slice(0, 5);
  const groups: { label: string; items: AgendaItem[] }[] = [];
  for (const a of agendaShown) {
    const label = a.date < TODAY ? '期限超過' : `${Number(a.date.slice(0, 4))}年${Number(a.date.slice(5, 7))}月`;
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <>
      <div className="page-head db-head">
        <div>
          <h1>ダッシュボード</h1>
          <p className="sub">
            {fmtDate(TODAY)} 時点 ／ {SCOPE_LABEL[scope]}
            {scope === 'branch' && `(${MY_BRANCH})`} {d.props.length}棟・{d.props.reduce((s, p) => s + p.units, 0).toLocaleString()}戸
          </p>
        </div>
        <div className="seg" role="group" aria-label="表示範囲">
          {(['mine', 'branch', 'all'] as Scope[]).map((s) => (
            <button key={s} className={scope === s ? 'on' : ''} aria-pressed={scope === s} onClick={() => setScope(s)}>
              {SCOPE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <p className="db-lead">
        {todoTotal === 0 ? (
          '今日、対応が必要な案件はありません。'
        ) : (
          <>
            今日動く案件は <b>{todoTotal}件</b> です。
            {topAction && (
              <>
                最も多いのは「{topAction.title}」の <b>{topAction.items.length}件</b>。
              </>
            )}
          </>
        )}
      </p>

      {/* ---------- 主要指標 ---------- */}
      <div className="kpis">
        <Link to={`/records?tab=findings&sev=urgent${d.scopeQs}`} className="kpi">
          <span className="ico red">
            <CircleAlert size={18} />
          </span>
          <small>早急対応が必要な指摘</small>
          <b>
            {d.urgent.length}
            <em>件</em>
          </b>
          <Meter
            parts={[
              { label: '未着手', v: urgentNew, color: '#d92d20' },
              { label: '対応中', v: d.urgent.length - urgentNew, color: '#f1b5ae' },
            ]}
          />
        </Link>
        <Link to={`/records?tab=findings&st=${encodeURIComponent('提案済')}${d.scopeQs}`} className="kpi">
          <span className="ico blue">
            <MessageCircleQuestion size={18} />
          </span>
          <small>オーナー様の回答待ち</small>
          <b>
            {proposed.length}
            <em>件</em>
          </b>
          <Meter
            parts={[
              { label: `${STALE_DAYS}日以上`, v: proposedStale, color: '#2a62d6' },
              { label: `${STALE_DAYS}日未満`, v: proposed.length - proposedStale, color: '#bccff4' },
            ]}
          />
        </Link>
        <Link to="/properties?sort=nextInspection" className="kpi">
          <span className="ico teal">
            <CalendarClock size={18} />
          </span>
          <small>90日以内の点検・審査</small>
          <b>
            {soonChecks + overdueChecks}
            <em>件</em>
            {overdueChecks > 0 && <em className="danger">うち超過 {overdueChecks}</em>}
          </b>
          <Meter
            parts={LANES.slice(0, 3).map((k, i) => ({
              label: LANE_SHORT[k],
              v: d.plans.filter((c) => c.kind === k && daysBetween(TODAY, c.next) <= 90).length,
              color: ['#2a78d6', '#d99a00', '#1baf7a'][i],
            }))}
          />
        </Link>
        <Link to={`/records?tab=findings${d.scopeQs}`} className="kpi">
          <span className="ico green">
            <Wallet size={18} />
          </span>
          <small>今後3年の修繕推奨額(概算)</small>
          <b>
            {Math.round(cost3y / 10000).toLocaleString()}
            <em>万円</em>
          </b>
          <Meter
            unit="万円"
            parts={[
              { label: '早急', v: Math.round(cost3yUrgent / 10000), color: '#d92d20' },
              { label: '経過観察', v: Math.round((cost3y - cost3yUrgent) / 10000), color: '#f5a524' },
            ]}
          />
        </Link>
      </div>

      {/* ---------- 今日やること ---------- */}
      <section className="card db-todo">
        <header>
          <h2>
            今日やること <span className="db-count">{todoTotal}件</span>
          </h2>
          <span className="hint">止まっている案件と、近づいている期限</span>
        </header>
        {actNow.length === 0 ? (
          <Empty>今日、対応が必要な案件はありません</Empty>
        ) : (
          <div className="db-actions">
            {actNow.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className={`db-action tone-${a.tone}`}>
                  <div className="db-action-head">
                    <span className="ico">
                      <Icon size={17} />
                    </span>
                    <div>
                      <b>{a.title}</b>
                      <small>{a.todo}</small>
                    </div>
                    <strong>{a.items.length}</strong>
                  </div>
                  <ul>
                    {a.items.slice(0, 3).map((it) => (
                      <li key={it.id}>
                        <Link to={it.to}>
                          <span>
                            <b>{it.name}</b>
                            <small>{it.detail}</small>
                          </span>
                          <em className={it.hot ? 'hot' : ''}>{it.tag}</em>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link className="db-more" to={a.more}>
                    {a.items.length > 3 ? `ほか${a.items.length - 3}件も見る` : '一覧で見る'} <ChevronRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        {actNone.length > 0 && (
          <p className="db-clear">
            {actNone.map((a) => (
              <span key={a.key}>
                <CheckCircle2 size={14} /> {a.title}: なし
              </span>
            ))}
          </p>
        )}
      </section>

      {/* ---------- 対応の流れ ---------- */}
      <section className="card db-flow">
        <header>
          <h2>対応の流れ</h2>
          <span className="hint">指摘がどの段階に何件あるか。「停滞」は同じ段階のまま{STALE_DAYS}日以上</span>
        </header>
        <div className="flow">
          <div className="flow-groups" aria-hidden>
            <span style={{ gridColumn: 'span 2' }}>社内で対応</span>
            <span>オーナー様の判断</span>
            <span style={{ gridColumn: 'span 2' }}>工事</span>
          </div>
          <div className="flow-steps">
            {d.pipeline.map((p) => (
              <Link key={p.status} to={`/records?tab=findings&st=${encodeURIComponent(p.status)}${d.scopeQs}`} className={`flow-step ${p.count === 0 ? 'zero' : ''}`}>
                <span className="flow-name">{p.status}</span>
                <b>
                  {p.count}
                  <em>件</em>
                </b>
                <small>{fmtMan(p.cost)}</small>
                <span className="flow-bar">
                  <i style={{ width: `${(p.count / maxPipe) * 100}%` }} />
                </span>
                <span className={`db-stale ${p.stale > 0 ? 'on' : ''}`}>
                  {p.stale > 0 ? (
                    <>
                      <Clock3 size={12} /> {p.stale}件 停滞
                    </>
                  ) : (
                    '停滞なし'
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="db-grid">
        {/* ---------- 修繕推奨額の見通し ---------- */}
        <section className="card">
          <header>
            <h2>修繕推奨額の見通し</h2>
            <span className="hint">未完了の指摘を推奨時期で集計(万円)。棒を押すと一覧へ</span>
          </header>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={d.byYear} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cfd6e2' }} fontSize={12} interval={0} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={(v) => Number(v).toLocaleString()} />
                <Tooltip
                  formatter={(v, n) => [`${Number(v).toLocaleString()}万円`, n]}
                  labelFormatter={(l, p) => `${l}(${p?.[0]?.payload?.count ?? 0}件)`}
                  cursor={{ fill: '#f1f4f9' }}
                />
                <Legend iconType="circle" {...LEGEND} />
                <Bar
                  dataKey="早急"
                  stackId="a"
                  fill="#d92d20"
                  stroke="#fff"
                  strokeWidth={2}
                  maxBarSize={44}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(e: { payload?: { key: string } }) => e.payload && navigate(`/records?tab=findings&due=${encodeURIComponent(e.payload.key)}${d.scopeQs}`)}
                />
                <Bar
                  dataKey="経過観察"
                  stackId="a"
                  fill="#f5a524"
                  stroke="#fff"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(e: { payload?: { key: string } }) => e.payload && navigate(`/records?tab=findings&due=${encodeURIComponent(e.payload.key)}${d.scopeQs}`)}
                >
                  <LabelList dataKey="total" position="top" fontSize={12} fill="#1c2433" formatter={(v: unknown) => (Number(v) > 0 ? Number(v).toLocaleString() : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {d.byYear[0].total > 0 && (
            <p className="note db-warn">
              <CircleAlert size={14} /> 推奨時期を過ぎた修繕が {d.byYear[0].count}件・{d.byYear[0].total.toLocaleString()}万円 あります。
            </p>
          )}
        </section>

        {/* ---------- 今後90日の予定 ---------- */}
        <section className="card">
          <header>
            <h2>今後90日の予定</h2>
            <span className="hint">点検・審査と、修繕の推奨時期</span>
          </header>
          {d.agenda.length === 0 ? (
            <Empty>90日以内の予定はありません</Empty>
          ) : (
            <div className="agenda">
              <div className="lanes" role="img" aria-label="今後90日の予定を種別ごとに時間軸で示した図">
                {LANES.map((k) => (
                  <div className="lane" key={k}>
                    <span className="lane-name">{LANE_SHORT[k]}</span>
                    <span className="lane-track">
                      {d.agenda
                        .filter((a) => a.kind === k)
                        .map((a) => {
                          const n = daysBetween(TODAY, a.date);
                          return (
                            <Link
                              key={a.key}
                              to={a.to}
                              className={`lane-dot lk-${LANES.indexOf(k)} ${n < 0 ? 'over' : ''}`}
                              style={{ left: `${Math.max(0, Math.min(100, (n / 90) * 100))}%` }}
                              title={`${a.p.name} ${a.text}(${n < 0 ? `${-n}日超過` : `あと${n}日`})`}
                              aria-label={`${a.p.name} ${a.text}`}
                            />
                          );
                        })}
                    </span>
                  </div>
                ))}
                <div className="lane lane-axis">
                  <span className="lane-name" />
                  <span className="lane-track">
                    {[0, 30, 60, 90].map((n) => (
                      <i key={n} style={{ left: `${(n / 90) * 100}%` }}>
                        {n === 0 ? '今日' : `${Number(addDays(TODAY, n).slice(5, 7))}/${Number(addDays(TODAY, n).slice(8, 10))}`}
                      </i>
                    ))}
                  </span>
                </div>
              </div>
              {groups.map((g) => (
                <div key={g.label} className={g.label === '期限超過' ? 'over' : ''}>
                  <h3>
                    {g.label} <span>{g.items.length}件</span>
                  </h3>
                  <ul>
                    {g.items.map((a) => (
                      <li key={a.key}>
                        <Link to={a.to}>
                          <time>{a.kind === '修繕期限' ? '月内' : `${Number(a.date.slice(5, 7))}/${Number(a.date.slice(8, 10))}`}</time>
                          {a.kind === '修繕期限' ? <span className="ck k-fix">修繕期限</span> : <CheckBadge kind={a.kind} short />}
                          <span className="agenda-text">
                            <b>{a.p.name}</b>
                            <small>{a.text}</small>
                          </span>
                          {scope !== 'mine' && <span className="muted small nowrap">{a.p.staff}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {d.agenda.length > 5 && (
                <button className="more-link" onClick={() => setAgendaAll(!agendaAll)}>
                  {agendaAll ? '閉じる' : `残り${d.agenda.length - 5}件を表示`}
                </button>
              )}
            </div>
          )}
        </section>

      </div>

      <div className="db-grid">
        {/* ---------- 物件の状態マップ ---------- */}
        <section className="card">
          <header>
            <h2>物件の状態マップ</h2>
            <span className="hint">1マスが1棟。評価の低い順。押すと物件詳細へ</span>
          </header>
          <div className={`pmap ${d.props.length <= 12 ? 'named' : ''}`}>
            {[...d.props]
              .sort((a, b) => a.overall - b.overall)
              .map((p) => {
                const u = urgentBy.get(p.id) ?? 0;
                return (
                  <Link key={p.id} to={`/properties/${p.id}`} className={`pmap-tile j-${ratingLabel(p.overall)}`} title={`${p.name}(${ratingLabel(p.overall)}${u ? `・早急 ${u}件` : ''})`} aria-label={`${p.name} 総合評価${p.overall.toFixed(1)}`}>
                    <b>{p.overall.toFixed(1)}</b>
                    <span>{p.name}</span>
                    {u > 0 && <i>{u}</i>}
                  </Link>
                );
              })}
          </div>
          <div className="pmap-legend">
            {(['要改善', '注意', '良好', '優良'] as const).map((j) => (
              <span key={j}>
                <i className={`j-${j}`} /> {j} {d.props.filter((p) => ratingLabel(p.overall) === j).length}棟
              </span>
            ))}
            <span>
              <i className="dot" /> 早急対応の指摘あり(数字は件数)
            </span>
          </div>
        </section>

        {/* ---------- 評価が下がった物件 ---------- */}
        <section className="card">
          <header>
            <h2>
              <TrendingDown size={17} className="db-h-ico" />
              前回点検から評価が下がった物件
            </h2>
            <Link className="hint link" to="/analytics">
              データ分析で詳しく
            </Link>
          </header>
          {d.drops.length === 0 ? (
            <Empty>評価が下がった物件はありません</Empty>
          ) : (
            <ul className="drops">
              {d.drops.slice(0, 6).map(({ p, hist, delta, last }) => (
                <li key={p.id}>
                  <Link to={`/properties/${p.id}`}>
                    <span className="drops-name">
                      <b>{p.name}</b>
                      <small>
                        築{p.age}年・{p.structure} ／ 前回 {fmtDate(last.date)}
                      </small>
                    </span>
                    <Spark values={hist.map((h) => h.score)} />
                    <span className="drops-score">
                      <b>{last.score.toFixed(1)}</b>
                      <small className={`judge-${ratingLabel(last.score)}`}>{ratingLabel(last.score)}</small>
                    </span>
                    <span className="drops-delta">▼{Math.abs(delta).toFixed(1)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/** 指標タイルの内訳バー。色に頼らないよう、内訳を文字でも示す */
function Meter({ parts, unit = '' }: { parts: { label: string; v: number; color: string }[]; unit?: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  return (
    <span className="meter">
      <span className="meter-bar" aria-hidden>
        {total === 0 ? <i className="none" style={{ flex: 1 }} /> : parts.filter((p) => p.v > 0).map((p) => <i key={p.label} style={{ flex: p.v, background: p.color }} />)}
      </span>
      <span className="meter-cap">
        {parts.map((p) => (
          <span key={p.label}>
            <i style={{ background: p.color }} />
            {p.label} {p.v.toLocaleString()}
            {unit}
          </span>
        ))}
      </span>
    </span>
  );
}

/** 点検ごとの総合評価の推移(小さな折れ線)。最新の点を強調する */
function Spark({ values }: { values: number[] }) {
  const w = 84;
  const h = 28;
  const lo = Math.min(...values) - 0.3;
  const hi = Math.max(...values) + 0.3;
  const x = (i: number) => 4 + (i * (w - 8)) / Math.max(1, values.length - 1);
  const y = (v: number) => 3 + ((hi - v) / (hi - lo)) * (h - 6);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`評価の推移 ${values.map((v) => v.toFixed(1)).join('→')}`}>
      <polyline points={pts} fill="none" stroke="#98a2b3" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4" fill="#d92d20" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
