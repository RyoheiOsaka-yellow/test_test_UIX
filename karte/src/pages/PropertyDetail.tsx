import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Bell, CalendarClock, ChevronRight, Eye, EyeOff, FileText, Mail, MessageCircle, Printer, X } from 'lucide-react';
import {
  PARTS,
  STATUSES,
  TODAY,
  daysBetween,
  fmtDate,
  fmtMan,
  fmtYen,
  fmtYm,
  inspectionsOf,
  peerAverage,
  propertyById,
  ratingLabel,
  repairsOf,
  type Finding,
  type FindingStatus,
  type Part,
  type Repair,
} from '../data';
import { DEFAULT_SIM, openCost, simulate, type SimParams } from '../sim';
import { Empty, Photo, SeverityBadge, Stars, StatusBadge, useStore } from '../ui';
import { CycleCard } from '../Cycle';

const PIN_COLOR = { urgent: '#d92d20', watch: '#f5a524', ok: '#12925a' } as const;

export default function PropertyDetail() {
  const { id } = useParams();
  const p = propertyById.get(id ?? '');
  const store = useStore();
  const [params, setParams] = useSearchParams();
  const ownerView = params.get('view') === 'owner';

  const findings = useMemo(() => store.findings.filter((f) => f.propertyId === id), [store.findings, id]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [part, setPart] = useState<Part | null>(null);
  const [sim, setSim] = useState<SimParams>(DEFAULT_SIM);
  const [beforeAfter, setBeforeAfter] = useState<Repair | null>(null);
  const [notify, setNotify] = useState(p?.notify ?? { mail: true, line: false, push: false });
  const [showAllLog, setShowAllLog] = useState(false);

  useEffect(() => {
    const fromUrl = params.get('f');
    const first = findings.find((f) => f.severity === 'urgent') ?? findings.find((f) => f.severity === 'watch') ?? findings[0];
    setSelectedId(fromUrl && findings.some((f) => f.id === fromUrl) ? fromUrl : (first?.id ?? null));
    setPart(null);
    setSim(DEFAULT_SIM);
    if (p) setNotify(p.notify);
    // 物件が切り替わったときだけ初期化する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!p) return <Empty>物件が見つかりません。</Empty>;

  const peer = peerAverage(p);
  const insp = inspectionsOf(p.id);
  const reps = repairsOf(p.id);
  const acts = store.activities.filter((a) => a.propertyId === p.id && (!ownerView || a.ownerVisible));
  const selected = findings.find((f) => f.id === selectedId) ?? null;
  const open = findings.filter((f) => f.severity !== 'ok' && f.status !== '完了');
  const urgent = open.filter((f) => f.severity === 'urgent');
  const nextDue = open.map((f) => f.dueBy).filter(Boolean).sort()[0] ?? null;
  const dueFinding = open.find((f) => f.dueBy === nextDue);
  const total = openCost(findings);
  const baseYearly = p.units * 5000;
  const result = simulate(total, baseYearly, sim);
  const inspDays = daysBetween(TODAY, p.nextInspection);
  const trend = [...insp].reverse();
  const listed = findings.filter((f) => !part || f.part === part);

  const radarData = PARTS.map((k) => ({ part: k, 当物件: p.scores[k], 類似物件平均: peer.scores[k] }));

  const toggleOwner = () => {
    const next = new URLSearchParams(params);
    if (ownerView) next.delete('view');
    else next.set('view', 'owner');
    setParams(next, { replace: true });
  };

  return (
    <div className={ownerView ? 'detail owner' : 'detail'}>
      {ownerView ? (
        <div className="owner-bar no-print">
          <span>
            <Eye size={15} /> オーナー様向け表示中(社内メモ・担当情報・社内ステータスは非表示)
          </span>
          <button className="btn light" onClick={toggleOwner}>
            <EyeOff size={15} /> 社内表示に戻る
          </button>
        </div>
      ) : (
        <nav className="crumb no-print">
          <Link to="/properties">物件を探す</Link>
          <ChevronRight size={13} />
          <span>{p.name}</span>
        </nav>
      )}

      <div className="page-head">
        <div>
          <h1>
            {p.name}
            {ownerView && <span className="h1-sub"> 建物カルテ</span>}
          </h1>
          <p className="sub">{p.address}</p>
          <div className="chips">
            <span>築{p.age}年({p.builtYear}年築)</span>
            <span>{p.structure}</span>
            <span>
              {p.floors}階建・{p.units}戸
            </span>
            <span>オーナー: {p.owner} 様</span>
            {!ownerView && (
              <>
                <span>担当: {p.staff}</span>
                <span>{p.branch}</span>
                <span>{p.id}</span>
              </>
            )}
          </div>
        </div>
        <div className="actions no-print">
          {!ownerView && (
            <button className="btn primary" onClick={toggleOwner}>
              <Eye size={15} /> オーナー向け表示
            </button>
          )}
          <button className="btn" onClick={() => window.print()}>
            <Printer size={15} /> 報告書(PDF)出力
          </button>
        </div>
      </div>

      <div className={`alert ${urgent.length ? 'red' : open.length ? 'amber' : 'green'}`}>
        <div>
          <small>次に必要な修繕</small>
          {nextDue && dueFinding ? (
            <b>
              {fmtYm(nextDue)}までに「{dueFinding.part}|{dueFinding.location}」
              {open.length > 1 && <> ほか{open.length - 1}件</>}
            </b>
          ) : (
            <b>現在、修繕が必要な箇所はありません</b>
          )}
        </div>
        <div>
          <small>未完了の指摘</small>
          <b>
            早急 {urgent.length}件 ／ 経過観察 {open.length - urgent.length}件
          </b>
        </div>
        <div>
          <small>修繕概算(合計)</small>
          <b>{total ? fmtMan(total) : '—'}</b>
        </div>
        <div>
          <small>
            <CalendarClock size={12} /> 次回点検
          </small>
          <b>
            {fmtDate(p.nextInspection)}
            {inspDays < 0 && <em className="over"> {-inspDays}日超過</em>}
          </b>
        </div>
      </div>

      <div className="karte-grid">
        {/* ① 建物コンディション */}
        <section className="card">
          <header>
            <h2>
              <i className="no">1</i>建物コンディション
            </h2>
            <span className="hint">今の状態を一目で把握</span>
          </header>
          <div className="cond">
            <div className="cond-left">
              <small>総合評価(10点満点)</small>
              <div className="bigscore">
                {p.overall.toFixed(1)}
                <span> / 10</span>
              </div>
              <Stars score={p.overall} />
              <div className={`rating r-${ratingLabel(p.overall)}`}>{ratingLabel(p.overall)}</div>
              <div className="trend">
                <small>評価の推移</small>
                <div className="trend-row">
                  {trend.map((t, i) => (
                    <span key={t.id}>
                      <b className={i === trend.length - 1 ? 'cur' : ''}>{t.score.toFixed(1)}</b>
                      <i>{t.date.slice(0, 4)}</i>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="cond-right">
              <div style={{ height: 232 }}>
                <ResponsiveContainer>
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="#d9dfe9" />
                    <PolarAngleAxis
                      dataKey="part"
                      tick={(props: any) => {
                        const name = props.payload.value as Part;
                        const on = part === name;
                        return (
                          <g
                            transform={`translate(${props.x},${props.y})`}
                            onClick={() => setPart(on ? null : name)}
                            style={{ cursor: 'pointer' }}
                          >
                            <text textAnchor={props.textAnchor} dy={4} fontSize={12.5} fontWeight={700} fill={on ? '#2563eb' : '#1c2433'}>
                              {name} {p.scores[name].toFixed(1)}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar dataKey="類似物件平均" stroke="#5b6577" strokeWidth={1.5} strokeDasharray="4 4" fill="none" isAnimationActive={false} />
                    <Radar dataKey="当物件" stroke="#12925a" strokeWidth={2} fill="#12925a" fillOpacity={0.14} isAnimationActive={false} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => Number(v).toFixed(1)} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="note">
                類似物件平均 = {peer.label}の{peer.count}棟の平均。項目名をクリックすると、下の指摘一覧をその部位で絞り込みます。
              </p>
            </div>
          </div>
        </section>

        {/* ② 要修繕箇所の見える化 */}
        <section className="card">
          <header>
            <h2>
              <i className="no">2</i>要修繕箇所の見える化
            </h2>
            <span className="hint">どこに問題があるか一目で分かる</span>
          </header>
          <div className="spot">
            <div className="site">
              <SitePlan site={p.site} findings={findings} selectedId={selectedId} onSelect={setSelectedId} />
              <div className="legend">
                <SeverityBadge severity="urgent" />
                <SeverityBadge severity="watch" />
                <SeverityBadge severity="ok" />
              </div>
            </div>
            <div className="spot-detail">
              {selected ? (
                <>
                  <div className="spot-title">
                    <b>
                      {selected.part}|{selected.location}
                    </b>
                    <SeverityBadge severity={selected.severity} />
                  </div>
                  <p className="spot-name">{selected.title}</p>
                  <p className="spot-desc">{selected.description}</p>
                  <dl className="kv">
                    {selected.dueBy && (
                      <>
                        <dt>推奨時期</dt>
                        <dd>{fmtYm(selected.dueBy)}まで</dd>
                      </>
                    )}
                    {selected.estCost > 0 && (
                      <>
                        <dt>概算費用</dt>
                        <dd>{fmtYen(selected.estCost)}</dd>
                      </>
                    )}
                    <dt>指摘日</dt>
                    <dd>{fmtDate(selected.foundDate)}</dd>
                  </dl>
                  <small className="muted">写真 {selected.photos}枚(最大10枚まで登録可能)</small>
                  <div className="photos">
                    {Array.from({ length: Math.min(selected.photos, 5) }, (_, i) => (
                      <Photo key={i} part={selected.part} seed={i + selected.pin.x} after={selected.severity === 'ok'} />
                    ))}
                    {selected.photos > 5 && <span className="photo-more">+{selected.photos - 5}</span>}
                  </div>
                  {!ownerView && selected.memo && <p className="memo">社内メモ: {selected.memo}</p>}
                </>
              ) : (
                <Empty>登録された指摘はありません</Empty>
              )}
            </div>
          </div>
        </section>

        {/* ③ 将来修繕シミュレーション */}
        <section className="card">
          <header>
            <h2>
              <i className="no">3</i>将来修繕シミュレーション
            </h2>
            <span className="hint">今修繕する理由が分かる</span>
          </header>
          {total === 0 ? (
            <Empty>未完了の要対応指摘がないため、試算対象はありません。</Empty>
          ) : (
            <div className="sim">
              <div className="sim-left">
                <p>
                  修繕を<b>{sim.defer}年先送り</b>すると、同じ箇所の修繕費が
                </p>
                <div className="sim-extra">
                  約{Math.round(result.extra / 10000).toLocaleString()}万円
                  <small>増える見込み</small>
                </div>
                <p className="muted small">
                  今: {fmtMan(total)} → {sim.defer}年後: {fmtMan(result.deferred)}(×{result.mult.toFixed(2)})
                </p>
                {nextDue && <div className="sim-reco">{fmtYm(nextDue)}までの修繕を推奨します</div>}
              </div>
              <div className="sim-right">
                <div style={{ height: 210 }}>
                  <ResponsiveContainer>
                    <LineChart data={result.rows} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e7ebf2" vertical={false} />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} ticks={['現在', '5年後', '10年後', '15年後']} axisLine={{ stroke: '#cfd6e2' }} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(v / 10000)}`} />
                      <Tooltip formatter={(v) => fmtMan(Number(v))} />
                      <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine x={`${sim.defer}年後`} stroke="#d92d20" strokeDasharray="3 3" />
                      <Line type="stepAfter" dataKey="neglect" name="放置した場合" stroke="#d92d20" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="linear" dataKey="now" name="今修繕する場合" stroke="#12925a" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="note">累積修繕コスト(万円)。日常の小修繕費(年{fmtMan(baseYearly)})は両方に含みます。</p>
              </div>
              <details className="sim-basis" open={!ownerView}>
                <summary>試算の前提(変更できます)</summary>
                <div className="sliders">
                  <label>
                    先送りする年数 <b>{sim.defer}年</b>
                    <input type="range" min={1} max={10} value={sim.defer} onChange={(e) => setSim({ ...sim, defer: Number(e.target.value) })} />
                  </label>
                  <label>
                    工事費の上昇率 <b>年{(sim.inflation * 100).toFixed(0)}%</b>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      value={sim.inflation * 100}
                      onChange={(e) => setSim({ ...sim, inflation: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label>
                    劣化による補修範囲の拡大 <b>年{(sim.spread * 100).toFixed(0)}%</b>
                    <input
                      type="range"
                      min={0}
                      max={15}
                      value={sim.spread * 100}
                      onChange={(e) => setSim({ ...sim, spread: Number(e.target.value) / 100 })}
                    />
                  </label>
                </div>
                <p className="note">
                  計算式: 先送り後の費用 = 現在の概算費用 × (1+工事費上昇率)<sup>年数</sup> × (1+補修範囲拡大率)<sup>年数</sup>。
                  初期値はデモ用の仮定であり、実際の見積・劣化診断に置き換える前提です。
                </p>
              </details>
            </div>
          )}
        </section>

        {/* ④ 点検・修繕履歴 */}
        <section className="card">
          <header>
            <h2>
              <i className="no">4</i>点検・修繕履歴
            </h2>
            <span className="hint">過去の内容と費用の推移が分かる</span>
          </header>
          <h3>点検履歴</h3>
          <div className="table-wrap">
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>点検日</th>
                  <th className="r">総合評価</th>
                  <th>主な指摘内容</th>
                  <th>次回点検</th>
                  <th>報告書</th>
                </tr>
              </thead>
              <tbody>
                {insp.map((i) => (
                  <tr key={i.id}>
                    <td className="nowrap">{fmtDate(i.date)}</td>
                    <td className="r num">{i.score.toFixed(1)}</td>
                    <td>{i.summary}</td>
                    <td className="nowrap">{i.nextInYears}年後</td>
                    <td>
                      <button className="iconbtn" title="報告書を表示(デモでは印刷画面を開きます)" onClick={() => window.print()}>
                        <FileText size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>
            修繕履歴
            {reps.length > 0 && <span className="hint"> 累計 {fmtYen(reps.reduce((s, r) => s + r.cost, 0))}</span>}
          </h3>
          {reps.length === 0 ? (
            <Empty>修繕の記録はまだありません</Empty>
          ) : (
            <div className="table-wrap">
              <table className="tbl compact">
                <thead>
                  <tr>
                    <th>修繕日</th>
                    <th>修繕箇所</th>
                    <th>修繕内容</th>
                    <th className="r">金額(税込)</th>
                    <th>前後写真</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => (
                    <tr key={r.id}>
                      <td className="nowrap">{fmtDate(r.date)}</td>
                      <td>{r.place}</td>
                      <td>{r.work}</td>
                      <td className="r num">{fmtYen(r.cost)}</td>
                      <td>
                        <button className="linkbtn" onClick={() => setBeforeAfter(r)}>
                          比較 <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <CycleCard p={p} repairs={reps} ownerView={ownerView} />

      {/* 指摘事項一覧 */}
      <section className="card">
        <header>
          <h2>指摘事項と対応状況</h2>
          <div className="seg small no-print">
            <button className={!part ? 'on' : ''} onClick={() => setPart(null)}>
              すべて
            </button>
            {PARTS.map((k) => (
              <button key={k} className={part === k ? 'on' : ''} onClick={() => setPart(k)}>
                {k}
              </button>
            ))}
          </div>
        </header>
        {listed.length === 0 ? (
          <Empty>{part}の指摘はありません</Empty>
        ) : (
          <div className="table-wrap">
            <table className="tbl hover">
              <thead>
                <tr>
                  <th>緊急度</th>
                  <th>部位|箇所</th>
                  <th>指摘内容</th>
                  <th>推奨時期</th>
                  <th className="r">概算費用</th>
                  <th>対応状況</th>
                  {!ownerView && <th>社内メモ</th>}
                </tr>
              </thead>
              <tbody>
                {listed.map((f) => (
                  <tr key={f.id} className={f.id === selectedId ? 'sel' : ''} onClick={() => setSelectedId(f.id)}>
                    <td>
                      <SeverityBadge severity={f.severity} short />
                    </td>
                    <td className="nowrap strong">
                      {f.part}|{f.location}
                    </td>
                    <td>{f.title}</td>
                    <td className="nowrap">{f.dueBy ? `${fmtYm(f.dueBy)}まで` : '—'}</td>
                    <td className="r num">{f.estCost ? fmtYen(f.estCost) : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {ownerView || f.severity === 'ok' ? (
                        <StatusBadge status={ownerLabel(f, ownerView)} />
                      ) : (
                        <select
                          className={`status-select st-${f.status}`}
                          value={f.status}
                          aria-label={`${f.id}の対応状況`}
                          onChange={(e) => store.setStatus(f.id, e.target.value as FindingStatus)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    {!ownerView && <td className="muted small">{f.memo || '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!ownerView && <p className="note">対応状況を変更すると、下の連携記録に自動で追記されます。</p>}
      </section>

      {/* 連携記録 */}
      <section className="card">
        <header>
          <h2>{ownerView ? 'これまでの経過' : '連携記録(点検・提案・オーナー連絡・工事)'}</h2>
          <span className="hint">{acts.length}件</span>
        </header>
        <ol className="timeline">
          {(showAllLog ? acts : acts.slice(0, 8)).map((a) => (
            <li key={a.id}>
              <time>{fmtDate(a.date)}</time>
              <span className={`tag t-${a.type}`}>{a.type}</span>
              <span className="tl-text">
                {a.text}
                <small>
                  {a.actor}
                  {a.channel && ` ／ ${a.channel}`}
                  {!ownerView && !a.ownerVisible && ' ／ 社内のみ'}
                </small>
              </span>
            </li>
          ))}
        </ol>
        {acts.length > 8 && (
          <button className="more-link no-print" onClick={() => setShowAllLog((v) => !v)}>
            {showAllLog ? '折りたたむ' : `すべて表示(残り${acts.length - 8}件)`}
          </button>
        )}
      </section>

      <section className="card notify no-print">
        <div>
          <b>お知らせ・通知</b>
          <small>点検結果や修繕提案を、オーナー様が選んだ方法でお知らせします。</small>
        </div>
        <label className={notify.mail ? 'on' : ''}>
          <input type="checkbox" checked={notify.mail} onChange={(e) => setNotify({ ...notify, mail: e.target.checked })} />
          <Mail size={15} /> メール通知
        </label>
        <label className={notify.line ? 'on' : ''}>
          <input type="checkbox" checked={notify.line} onChange={(e) => setNotify({ ...notify, line: e.target.checked })} />
          <MessageCircle size={15} /> LINE通知
        </label>
        <label className={notify.push ? 'on' : ''}>
          <input type="checkbox" checked={notify.push} onChange={(e) => setNotify({ ...notify, push: e.target.checked })} />
          <Bell size={15} /> プッシュ通知
        </label>
      </section>

      {beforeAfter && (
        <div className="modal-veil" onClick={() => setBeforeAfter(null)}>
          <div className="modal" role="dialog" aria-label="修繕前後の比較" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>
                修繕前後の比較: {beforeAfter.place} {beforeAfter.work}
              </h2>
              <button className="iconbtn" onClick={() => setBeforeAfter(null)} aria-label="閉じる">
                <X size={18} />
              </button>
            </header>
            <div className="ba">
              <figure>
                <Photo part={beforeAfter.part} seed={3} label="修繕前(サンプル)" />
                <figcaption>修繕前</figcaption>
              </figure>
              <figure>
                <Photo part={beforeAfter.part} seed={3} after label="修繕後(サンプル)" />
                <figcaption>修繕後 {fmtDate(beforeAfter.date)}</figcaption>
              </figure>
            </div>
            <p className="note">
              {fmtYen(beforeAfter.cost)} ／ 施工: {beforeAfter.contractor}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** オーナー向けには社内の細かい状況を出さず、分かりやすい言葉に丸める */
function ownerLabel(f: Finding, ownerView: boolean): FindingStatus {
  if (!ownerView) return f.status;
  if (f.status === '未対応' || f.status === '見積中') return '見積中';
  return f.status;
}

function SitePlan({
  site,
  findings,
  selectedId,
  onSelect,
}: {
  site: { buildings: { x: number; y: number; w: number; h: number; label: string }[]; parking: { x: number; y: number; w: number; h: number; label: string } };
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const pk = site.parking;
  return (
    <svg viewBox="0 0 400 290" className="siteplan" role="img" aria-label="建物配置図">
      <rect x="0" y="0" width="400" height="290" fill="#eef1f5" />
      <rect x="0" y="252" width="400" height="38" fill="#d5dae2" />
      <line x1="0" x2="400" y1="271" y2="271" stroke="#fff" strokeDasharray="14 10" strokeWidth="2" />
      <rect x="40" y="24" width="320" height="226" rx="4" fill="#e2ecd9" stroke="#c3cfb8" />
      <rect x={pk.x} y={pk.y} width={pk.w} height={pk.h} fill="#dfe3ea" stroke="#c5ccd8" />
      {Array.from({ length: Math.floor(pk.w / 21) }, (_, i) => (
        <line key={i} x1={pk.x + 21 * (i + 1)} x2={pk.x + 21 * (i + 1)} y1={pk.y} y2={pk.y + pk.h} stroke="#c5ccd8" />
      ))}
      <text x={pk.x + pk.w / 2} y={pk.y + pk.h / 2 + 4} textAnchor="middle" fontSize="10" fill="#7a8494">
        {pk.label}
      </text>
      {site.buildings.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fbfcfd" stroke="#9aa5b6" strokeWidth="1.5" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize="11" fill="#7a8494">
            {b.label}
          </text>
        </g>
      ))}
      <text x="368" y="40" fontSize="10" fill="#7a8494" textAnchor="middle">
        N
      </text>
      <path d="M368 44 l-4 10 h8 z" fill="#7a8494" />
      {findings.map((f) => {
        const on = f.id === selectedId;
        return (
          <g
            key={f.id}
            transform={`translate(${f.pin.x},${f.pin.y})`}
            onClick={() => onSelect(f.id)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`${f.part} ${f.location}`}
          >
            {on && <circle r="15" fill={PIN_COLOR[f.severity]} opacity="0.2" />}
            <path
              d="M0 0 C-9 -11 -9 -22 0 -22 C9 -22 9 -11 0 0 Z"
              fill={PIN_COLOR[f.severity]}
              stroke="#fff"
              strokeWidth={on ? 2.2 : 1.2}
              transform={on ? 'scale(1.25)' : undefined}
            />
            <circle cy={on ? -17.5 : -14} r={on ? 4 : 3.2} fill="#fff" />
          </g>
        );
      })}
    </svg>
  );
}
