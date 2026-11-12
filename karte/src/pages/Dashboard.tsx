import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, ChevronRight, CircleAlert, Hourglass, Wallet } from 'lucide-react';
import { PARTS, STATUSES, TODAY, addMonths, daysBetween, fmtDate, fmtMan, fmtYm, properties, propertyById } from '../data';
import { Empty, LEGEND, StatusBadge, useStore } from '../ui';

const ME = '青木 涼';

export default function Dashboard() {
  const { findings } = useStore();
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  const d = useMemo(() => {
    const props = properties.filter((p) => scope === 'all' || p.staff === ME);
    const ids = new Set(props.map((p) => p.id));
    const open = findings.filter((f) => ids.has(f.propertyId) && f.severity !== 'ok' && f.status !== '完了');
    const urgent = open.filter((f) => f.severity === 'urgent');
    const horizon = addMonths(TODAY, 36).slice(0, 7);
    const within3y = open.filter((f) => f.dueBy && f.dueBy <= horizon);

    const overdue = props.filter((p) => p.nextInspection < TODAY);
    const soon = props.filter((p) => p.nextInspection >= TODAY && daysBetween(TODAY, p.nextInspection) <= 90);

    const years = ['2026', '2027', '2028', '2029', '2030', '2031'];
    const byYear = years.map((y) => ({ year: `${y}年`, 早急: 0, 経過観察: 0 }));
    for (const f of open) {
      if (!f.dueBy) continue;
      const y = f.dueBy.slice(0, 4);
      const i = Math.max(0, Math.min(years.length - 1, years.indexOf(y) === -1 ? (y < '2026' ? 0 : 5) : years.indexOf(y)));
      byYear[i][f.severity === 'urgent' ? '早急' : '経過観察'] += Math.round(f.estCost / 10000);
    }

    const pipeline = STATUSES.filter((s) => s !== '完了').map((s) => ({
      status: s,
      count: open.filter((f) => f.status === s).length,
      cost: open.filter((f) => f.status === s).reduce((a, f) => a + f.estCost, 0),
    }));

    const queue = urgent
      .filter((f) => f.status === '未対応' || f.status === '見積中' || f.status === '提案済')
      .map((f) => ({ f, wait: daysBetween(f.statusDate, TODAY) }))
      .sort((a, b) => (a.f.dueBy! < b.f.dueBy! ? -1 : a.f.dueBy! > b.f.dueBy! ? 1 : b.wait - a.wait));

    const byPart = PARTS.map((part) => {
      const fs = open.filter((f) => f.part === part);
      return {
        part,
        早急: fs.filter((f) => f.severity === 'urgent').length,
        経過観察: fs.filter((f) => f.severity === 'watch').length,
        cost: fs.reduce((s, f) => s + f.estCost, 0),
      };
    });
    const bins = [
      { bin: '6.0未満', lo: 0, hi: 6 },
      { bin: '6.0〜6.9', lo: 6, hi: 7 },
      { bin: '7.0〜7.9', lo: 7, hi: 8 },
      { bin: '8.0〜8.9', lo: 8, hi: 9 },
      { bin: '9.0以上', lo: 9, hi: 11 },
    ].map((b) => ({ bin: b.bin, 棟数: props.filter((p) => p.overall >= b.lo && p.overall < b.hi).length }));

    const insp = [...overdue, ...soon].sort((a, b) => (a.nextInspection < b.nextInspection ? -1 : 1));

    return { props, open, urgent, within3y, overdue, soon, byYear, pipeline, queue, insp, byPart, bins };
  }, [findings, scope]);

  const maxPipe = Math.max(1, ...d.pipeline.map((p) => p.count));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ダッシュボード</h1>
          <p className="sub">
            {fmtDate(TODAY)} 時点 ／ 管理 {d.props.length}棟・{d.props.reduce((s, p) => s + p.units, 0).toLocaleString()}戸
          </p>
        </div>
        <div className="seg" role="group" aria-label="表示範囲">
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
            全社
          </button>
          <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>
            自分の担当
          </button>
        </div>
      </div>

      <div className="kpis">
        <Link to="/records?tab=findings&sev=urgent" className="kpi">
          <span className="ico red">
            <CircleAlert size={18} />
          </span>
          <small>早急対応が必要な指摘</small>
          <b>
            {d.urgent.length}
            <em>件</em>
          </b>
          <span className="foot">うち未着手 {d.urgent.filter((f) => f.status === '未対応').length}件</span>
        </Link>
        <Link to="/records?tab=findings&st=未対応" className="kpi">
          <span className="ico amber">
            <Hourglass size={18} />
          </span>
          <small>オーナー未提案の指摘</small>
          <b>
            {d.open.filter((f) => f.status === '未対応' || f.status === '見積中').length}
            <em>件</em>
          </b>
          <span className="foot">未対応・見積中の合計</span>
        </Link>
        <Link to="/properties?sort=nextInspection" className="kpi">
          <span className="ico blue">
            <CalendarClock size={18} />
          </span>
          <small>点検期限</small>
          <b>
            {d.overdue.length}
            <em>棟 超過</em>
          </b>
          <span className="foot">90日以内に期限 {d.soon.length}棟</span>
        </Link>
        <div className="kpi">
          <span className="ico green">
            <Wallet size={18} />
          </span>
          <small>今後3年の修繕推奨額(概算)</small>
          <b>
            {Math.round(d.within3y.reduce((s, f) => s + f.estCost, 0) / 10000).toLocaleString()}
            <em>万円</em>
          </b>
          <span className="foot">{d.within3y.length}件の指摘が対象</span>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>修繕推奨時期ごとの概算額</h2>
            <span className="hint">未完了の指摘を推奨時期の年で集計(万円)</span>
          </header>
          <div style={{ height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={d.byYear} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#cfd6e2' }} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()}万円`} cursor={{ fill: '#f1f4f9' }} />
                <Legend iconType="circle" {...LEGEND} />
                <Bar dataKey="早急" stackId="a" fill="#d92d20" stroke="#fff" strokeWidth={1} maxBarSize={44} />
                <Bar dataKey="経過観察" stackId="a" fill="#f5a524" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <header>
            <h2>対応の進み具合</h2>
            <span className="hint">指摘が「誰のボールで止まっているか」</span>
          </header>
          <div className="pipe">
            {d.pipeline.map((p) => (
              <Link key={p.status} to={`/records?tab=findings&st=${p.status}`} className="pipe-row">
                <StatusBadge status={p.status} />
                <span className="pipe-track">
                  <span className={`pipe-fill st-${p.status}`} style={{ width: `${(p.count / maxPipe) * 100}%` }} />
                </span>
                <b className="num">{p.count}件</b>
                <span className="num muted">{fmtMan(p.cost)}</span>
              </Link>
            ))}
          </div>
          <p className="note">
            「未対応」「見積中」は社内、「提案済」はオーナー様の判断待ちです。行をクリックすると該当の指摘一覧を開きます。
          </p>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>部位別の未完了指摘</h2>
            <span className="hint">件数。右端は概算額の合計</span>
          </header>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={d.byPart} layout="vertical" margin={{ top: 4, right: 84, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="part" tickLine={false} axisLine={{ stroke: '#cfd6e2' }} fontSize={12} width={44} />
                <Tooltip formatter={(v) => `${v}件`} cursor={{ fill: '#f1f4f9' }} />
                <Legend iconType="circle" {...LEGEND} />
                <Bar dataKey="早急" stackId="a" fill="#d92d20" stroke="#fff" strokeWidth={1} maxBarSize={20} isAnimationActive={false} />
                <Bar dataKey="経過観察" stackId="a" fill="#f5a524" stroke="#fff" strokeWidth={1} maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="cost" position="right" formatter={(v: any) => fmtMan(Number(v))} fontSize={12} fill="#667085" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <header>
            <h2>総合評価の分布</h2>
            <Link className="hint link" to="/analytics">
              データ分析でさらに見る
            </Link>
          </header>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={d.bins} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" vertical={false} />
                <XAxis dataKey="bin" tickLine={false} axisLine={{ stroke: '#cfd6e2' }} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={30} />
                <Tooltip formatter={(v) => `${v}棟`} cursor={{ fill: '#f1f4f9' }} />
                <Bar dataKey="棟数" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                  <LabelList dataKey="棟数" position="top" fontSize={12} fill="#1c2433" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid-2 wide-left">
        <section className="card">
          <header>
            <h2>優先して動く案件</h2>
            <span className="hint">早急対応のうち承認前のもの。推奨時期が近い順</span>
          </header>
          {d.queue.length === 0 ? (
            <Empty>承認待ちの早急案件はありません</Empty>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>物件 / 指摘</th>
                    <th>推奨時期</th>
                    <th className="r">概算</th>
                    <th>状況</th>
                    <th className="r">停滞</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.queue.slice(0, 9).map(({ f, wait }) => {
                    const p = propertyById.get(f.propertyId)!;
                    return (
                      <tr key={f.id}>
                        <td>
                          <Link to={`/properties/${p.id}?f=${f.id}`} className="strong">
                            {p.name}
                          </Link>
                          <div className="muted small">
                            {f.part}|{f.location} {f.title}
                          </div>
                        </td>
                        <td className="nowrap">
                          {fmtYm(f.dueBy)}まで
                          {f.dueBy! < TODAY.slice(0, 7) && <div className="danger small">推奨時期を超過</div>}
                        </td>
                        <td className="r num">{fmtMan(f.estCost)}</td>
                        <td>
                          <StatusBadge status={f.status} />
                        </td>
                        <td className={`r num ${wait > 180 ? 'danger' : ''}`}>{wait}日</td>
                        <td className="r">
                          <Link to={`/properties/${p.id}?f=${f.id}`} aria-label="物件詳細を開く" className="iconlink">
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {d.queue.length > 9 && (
            <Link className="more-link" to="/records?tab=findings&sev=urgent">
              残り {d.queue.length - 9}件を見る
            </Link>
          )}
        </section>

        <section className="card">
          <header>
            <h2>点検期限</h2>
            <span className="hint">超過と90日以内</span>
          </header>
          {d.insp.length === 0 ? (
            <Empty>期限が近い物件はありません</Empty>
          ) : (
            <ul className="list">
              {d.insp.slice(0, 9).map((p) => {
                const days = daysBetween(TODAY, p.nextInspection);
                return (
                  <li key={p.id}>
                    <Link to={`/properties/${p.id}`}>
                      <span>
                        <b>{p.name}</b>
                        <small>
                          {p.staff} ／ 前回 {fmtDate(p.lastInspection)}
                        </small>
                      </span>
                      <span className={`pill ${days < 0 ? 'red' : 'amber'}`}>
                        {days < 0 ? `${-days}日超過` : `あと${days}日`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
