import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { PARTS, STAFF, TODAY, addMonths, fmtMan, properties, repairs, type Part } from '../data';
import { LEGEND, PART_COLOR, useStore } from '../ui';

const STRUCTURES = ['木造', '軽量鉄骨造', 'RC造'] as const;
const STRUCT_COLOR: Record<string, string> = { 木造: '#2a78d6', 軽量鉄骨造: '#eb6834', RC造: '#1baf7a' };
const BRANCHES = [...new Set(properties.map((p) => p.branch))];
const BANDS = [
  { label: '築10年未満', test: (a: number) => a < 10 },
  { label: '築10〜19年', test: (a: number) => a >= 10 && a < 20 },
  { label: '築20〜29年', test: (a: number) => a >= 20 && a < 30 },
  { label: '築30年以上', test: (a: number) => a >= 30 },
];
const BINS = [
  { label: '6.0未満', test: (s: number) => s < 6 },
  { label: '6.0〜6.9', test: (s: number) => s >= 6 && s < 7 },
  { label: '7.0〜7.9', test: (s: number) => s >= 7 && s < 8 },
  { label: '8.0〜8.9', test: (s: number) => s >= 8 && s < 9 },
  { label: '9.0以上', test: (s: number) => s >= 9 },
];
// 劣化度(10 - 評価点)を1色の濃淡で表す。濃いほど劣化が進んでいる
const HEAT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#104281'];
const heatColor = (score: number) => HEAT[Math.max(0, Math.min(HEAT.length - 1, Math.floor((9.5 - score) / 0.7)))];

const axis = { fontSize: 12, tickLine: false } as const;

export default function Analytics() {
  const { findings } = useStore();
  const navigate = useNavigate();
  const [branch, setBranch] = useState('');
  const [structure, setStructure] = useState('');

  const d = useMemo(() => {
    const props = properties.filter((p) => (!branch || p.branch === branch) && (!structure || p.structure === structure));
    const ids = new Set(props.map((p) => p.id));
    const open = findings.filter((f) => ids.has(f.propertyId) && f.severity !== 'ok' && f.status !== '完了');
    const urgentBy = new Map<string, number>();
    for (const f of open) if (f.severity === 'urgent') urgentBy.set(f.propertyId, (urgentBy.get(f.propertyId) ?? 0) + 1);

    const scatter = STRUCTURES.map((s) => ({
      name: s,
      data: props.filter((p) => p.structure === s).map((p) => ({ x: p.age, y: p.overall, id: p.id, name: p.name, urgent: urgentBy.get(p.id) ?? 0 })),
    })).filter((s) => s.data.length > 0);

    const heat = BANDS.map((b) => {
      const ps = props.filter((p) => b.test(p.age));
      return {
        band: b.label,
        count: ps.length,
        cells: PARTS.map((part) => (ps.length ? ps.reduce((s, p) => s + p.scores[part], 0) / ps.length : null)),
      };
    });

    const years = Array.from({ length: 8 }, (_, i) => String(2019 + i));
    const spend = years.map((y) => {
      const row: Record<string, number | string> = { year: `${y}年` };
      for (const part of PARTS) row[part] = 0;
      for (const r of repairs) {
        if (ids.has(r.propertyId) && r.date.startsWith(y)) row[r.part] = (row[r.part] as number) + Math.round(r.cost / 10000);
      }
      return row;
    });

    const byPart = PARTS.map((part) => {
      const fs = open.filter((f) => f.part === part);
      return {
        part,
        早急: fs.filter((f) => f.severity === 'urgent').length,
        経過観察: fs.filter((f) => f.severity === 'watch').length,
        cost: fs.reduce((s, f) => s + f.estCost, 0),
      };
    });

    const dist = BINS.map((b) => ({ bin: b.label, 棟数: props.filter((p) => b.test(p.overall)).length }));

    const staff = STAFF.map((name) => {
      const mine = new Set(props.filter((p) => p.staff === name).map((p) => p.id));
      const fs = open.filter((f) => mine.has(f.propertyId));
      return {
        name,
        棟数: mine.size,
        社内で対応中: fs.filter((f) => f.status === '未対応' || f.status === '見積中').length,
        オーナー判断待ち: fs.filter((f) => f.status === '提案済').length,
        '承認済・工事中': fs.filter((f) => f.status === '承認済' || f.status === '工事中').length,
      };
    }).filter((s) => s.棟数 > 0);

    const horizon = addMonths(TODAY, 36).slice(0, 7);
    const branches = BRANCHES.filter((b) => !branch || b === branch)
      .map((b) => {
        const ps = props.filter((p) => p.branch === b);
        const bid = new Set(ps.map((p) => p.id));
        const fs = open.filter((f) => bid.has(f.propertyId));
        return {
          branch: b,
          count: ps.length,
          avg: ps.length ? ps.reduce((s, p) => s + p.overall, 0) / ps.length : 0,
          urgent: fs.filter((f) => f.severity === 'urgent').length,
          overdue: ps.filter((p) => p.nextInspection < TODAY).length,
          cost: fs.filter((f) => f.dueBy && f.dueBy <= horizon).reduce((s, f) => s + f.estCost, 0),
        };
      })
      .filter((b) => b.count > 0)
      .sort((a, b) => b.urgent - a.urgent);

    return { props, open, scatter, heat, spend, byPart, dist, staff, branches };
  }, [findings, branch, structure]);

  const maxUrgent = Math.max(1, ...d.branches.map((b) => b.urgent));
  const maxCost = Math.max(1, ...d.branches.map((b) => b.cost));
  const avgAll = d.props.length ? d.props.reduce((s, p) => s + p.overall, 0) / d.props.length : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>データ分析</h1>
          <p className="sub">
            対象 {d.props.length}棟 ／ 平均評価 {avgAll.toFixed(1)} ／ 未完了の指摘 {d.open.length}件
          </p>
        </div>
        <div className="filters inline">
          <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="支店">
            <option value="">支店: すべて</option>
            {BRANCHES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select value={structure} onChange={(e) => setStructure(e.target.value)} aria-label="構造">
            <option value="">構造: すべて</option>
            {STRUCTURES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>築年数と総合評価</h2>
            <span className="hint">1点が1棟。右下ほど古くて状態が悪い。点をクリックでカルテへ</span>
          </header>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 18 }}>
                <CartesianGrid stroke="#e7ebf2" />
                <XAxis type="number" dataKey="x" name="築年数" domain={[0, 40]} tickCount={5} {...axis} axisLine={{ stroke: '#cfd6e2' }} label={{ value: '築年数(年)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#667085' }} />
                <YAxis type="number" dataKey="y" name="総合評価" domain={[4, 10]} tickCount={7} {...axis} axisLine={false} width={34} />
                <ZAxis range={[70, 70]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { name: string; x: number; y: number; urgent: number };
                    return (
                      <div className="tip">
                        <b>{p.name}</b>
                        <span>
                          築{p.x}年 ／ 総合 {p.y.toFixed(1)} ／ 早急 {p.urgent}件
                        </span>
                      </div>
                    );
                  }}
                />
                <Legend iconType="circle" verticalAlign="top" align="right" {...LEGEND} />
                {d.scatter.map((s) => (
                  <Scatter
                    key={s.name}
                    name={s.name}
                    data={s.data}
                    fill={STRUCT_COLOR[s.name]}
                    stroke="#fff"
                    strokeWidth={1.5}
                    isAnimationActive={false}
                    style={{ cursor: 'pointer' }}
                    onClick={(e: any) => navigate(`/properties/${e.id ?? e.payload?.id}`)}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <header>
            <h2>築年帯 × 部位の平均評価</h2>
            <span className="hint">色が濃いほど劣化が進んでいる</span>
          </header>
          <div className="heat" role="table" aria-label="築年帯と部位ごとの平均評価">
            <div className="heat-row head" role="row">
              <span />
              {PARTS.map((p) => (
                <b key={p} role="columnheader">
                  {p}
                </b>
              ))}
            </div>
            {d.heat.map((row) => (
              <div className="heat-row" role="row" key={row.band}>
                <span role="rowheader">
                  {row.band}
                  <small>{row.count}棟</small>
                </span>
                {row.cells.map((v, i) =>
                  v === null ? (
                    <i key={i} className="heat-cell none">
                      —
                    </i>
                  ) : (
                    <i
                      key={i}
                      className="heat-cell"
                      title={`${row.band}・${PARTS[i]}: 平均 ${v.toFixed(1)}`}
                      style={{ background: heatColor(v), color: v < 7.4 ? '#fff' : '#0d366b' }}
                    >
                      {v.toFixed(1)}
                    </i>
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="heat-legend">
            <span>良好</span>
            {HEAT.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
            <span>劣化</span>
          </div>
          <p className="note">築年数が進むほど、どの部位から評価が下がるかを確認できます。数値は平均評価(10点満点)。</p>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>年別の修繕費(実績)</h2>
            <span className="hint">部位別の内訳(万円)</span>
          </header>
          <div style={{ height: 270 }}>
            <ResponsiveContainer>
              <BarChart data={d.spend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" vertical={false} />
                <XAxis dataKey="year" {...axis} axisLine={{ stroke: '#cfd6e2' }} />
                <YAxis {...axis} axisLine={false} width={48} />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()}万円`} cursor={{ fill: '#f1f4f9' }} />
                <Legend iconType="circle" {...LEGEND} />
                {PARTS.map((part: Part, i) => (
                  <Bar
                    key={part}
                    dataKey={part}
                    stackId="a"
                    fill={PART_COLOR[part]}
                    stroke="#fff"
                    strokeWidth={1}
                    maxBarSize={40}
                    radius={i === PARTS.length - 1 ? [4, 4, 0, 0] : 0}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <header>
            <h2>部位別の未完了指摘</h2>
            <span className="hint">件数。右端は概算額の合計</span>
          </header>
          <div style={{ height: 270 }}>
            <ResponsiveContainer>
              <BarChart data={d.byPart} layout="vertical" margin={{ top: 8, right: 84, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axis} axisLine={false} />
                <YAxis type="category" dataKey="part" {...axis} axisLine={{ stroke: '#cfd6e2' }} width={44} />
                <Tooltip formatter={(v) => `${v}件`} cursor={{ fill: '#f1f4f9' }} />
                <Legend iconType="circle" {...LEGEND} />
                <Bar dataKey="早急" stackId="a" fill="#d92d20" stroke="#fff" strokeWidth={1} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="経過観察" stackId="a" fill="#f5a524" stroke="#fff" strokeWidth={1} maxBarSize={22} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="cost" position="right" formatter={(v: any) => fmtMan(Number(v))} fontSize={12} fill="#667085" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>総合評価の分布</h2>
            <span className="hint">棟数</span>
          </header>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={d.dist} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" vertical={false} />
                <XAxis dataKey="bin" {...axis} axisLine={{ stroke: '#cfd6e2' }} />
                <YAxis allowDecimals={false} {...axis} axisLine={false} width={30} />
                <Tooltip formatter={(v) => `${v}棟`} cursor={{ fill: '#f1f4f9' }} />
                <Bar dataKey="棟数" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                  <LabelList dataKey="棟数" position="top" fontSize={12} fill="#1c2433" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <header>
            <h2>担当者別の指摘の状況</h2>
            <span className="hint">未完了の指摘件数。どこで止まっているか</span>
          </header>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={d.staff} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axis} axisLine={false} />
                <YAxis type="category" dataKey="name" {...axis} axisLine={{ stroke: '#cfd6e2' }} width={78} />
                <Tooltip formatter={(v) => `${v}件`} cursor={{ fill: '#f1f4f9' }} />
                <Legend iconType="circle" {...LEGEND} />
                <Bar dataKey="社内で対応中" stackId="a" fill="#2a78d6" stroke="#fff" strokeWidth={1} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="オーナー判断待ち" stackId="a" fill="#eb6834" stroke="#fff" strokeWidth={1} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="承認済・工事中" stackId="a" fill="#1baf7a" stroke="#fff" strokeWidth={1} maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card">
        <header>
          <h2>支店別サマリー</h2>
          <span className="hint">早急対応の多い順</span>
        </header>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>支店</th>
                <th className="r">管理棟数</th>
                <th>平均評価</th>
                <th>早急対応の指摘</th>
                <th className="r">点検期限超過</th>
                <th>今後3年の修繕推奨額</th>
              </tr>
            </thead>
            <tbody>
              {d.branches.map((b) => (
                <tr key={b.branch}>
                  <td className="strong">{b.branch}</td>
                  <td className="r num">{b.count}棟</td>
                  <td>
                    <span className="inbar">
                      <b className="num">{b.avg.toFixed(1)}</b>
                      <span className="track">
                        <span style={{ width: `${b.avg * 10}%`, background: '#2a78d6' }} />
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="inbar">
                      <b className="num">{b.urgent}件</b>
                      <span className="track">
                        <span style={{ width: `${(b.urgent / maxUrgent) * 100}%`, background: '#d92d20' }} />
                      </span>
                    </span>
                  </td>
                  <td className={`r num ${b.overdue ? 'danger' : ''}`}>{b.overdue}棟</td>
                  <td>
                    <span className="inbar wide">
                      <b className="num">{fmtMan(b.cost)}</b>
                      <span className="track">
                        <span style={{ width: `${(b.cost / maxCost) * 100}%`, background: '#667085' }} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          明細は <Link to="/records">指摘・修繕データ</Link> で検索・CSV出力できます。
        </p>
      </section>
    </>
  );
}
