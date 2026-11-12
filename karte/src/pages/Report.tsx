import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, Printer } from 'lucide-react';
import {
  PARTS,
  TODAY,
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
  type Property,
} from '../data';
import { DEFAULT_SIM, openCost, simulate } from '../sim';
import { CycleCard } from '../Cycle';
import { Empty, LEGEND, SeverityBadge, Stars, useStore } from '../ui';
import { Shot } from '../Shot';

const PIN_COLOR = { urgent: '#d92d20', watch: '#f5a524', ok: '#12925a' } as const;
const COMPANY = '(管理会社名)';

function judge(score: number): { cls: string; text: string } {
  if (score < 6.1) return { cls: 'bad', text: '要対応' };
  if (score < 7.4) return { cls: 'mid', text: '注意' };
  return { cls: 'good', text: '良好' };
}

function Sheet({ p, page, total, children }: { p: Property; page: number; total: number; children: ReactNode }) {
  return (
    <section className="sheet">
      <header className="sheet-head">
        <span>
          <b>建物カルテ</b> {p.name}
        </span>
        <span>
          発行日 {fmtDate(TODAY)} ／ {page} / {total}
        </span>
      </header>
      <div className="sheet-body">{children}</div>
      <footer className="sheet-foot">
        <span>
          {COMPANY} {p.branch} ／ 担当 {p.staff}
        </span>
        <span>本書の費用・時期は点検時点の概算です。正式なお見積りで確定します。 ／ AAA</span>
      </footer>
    </section>
  );
}

export default function Report() {
  const { id } = useParams();
  const p = propertyById.get(id ?? '');
  const store = useStore();
  if (!p) return <Empty>物件が見つかりません。</Empty>;

  const findings = store.findings.filter((f) => f.propertyId === p.id);
  const sevOrder = { urgent: 0, watch: 1, ok: 2 } as const;
  const open = findings
    .filter((f) => f.severity !== 'ok' && f.status !== '完了')
    .sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || (a.dueBy ?? '9').localeCompare(b.dueBy ?? '9'));
  const urgent = open.filter((f) => f.severity === 'urgent');
  const peer = peerAverage(p);
  const insp = inspectionsOf(p.id);
  const reps = repairsOf(p.id);
  const total = openCost(findings);
  const sim = simulate(total, p.units * 5000, DEFAULT_SIM);
  const nextDue = open.map((f) => f.dueBy).filter(Boolean).sort()[0] ?? null;
  const weak = PARTS.filter((k) => p.scores[k] < peer.scores[k]).sort((a, b) => p.scores[a] - peer.scores[a] - (p.scores[b] - peer.scores[b]));
  const radarData = PARTS.map((k) => ({ part: k, 当物件: p.scores[k], 類似物件平均: peer.scores[k] }));
  const prev = insp[1];

  // 推奨時期ごとにまとめた修繕計画
  const plan = [...new Set(open.map((f) => f.dueBy!))].sort().map((due) => {
    const items = open.filter((f) => f.dueBy === due);
    return { due, items, cost: items.reduce((s, f) => s + f.estCost, 0) };
  });

  const points: ReactNode[] = [
    <>
      建物全体の状態は<b>「{ratingLabel(p.overall)}」({p.overall.toFixed(1)}点)</b>です。
      {weak.length > 0 ? (
        <>
          ただし<b>{weak.slice(0, 2).join('と')}</b>は、類似物件の平均を下回っています。
        </>
      ) : (
        <>すべての部位が、類似物件の平均以上です。</>
      )}
      {prev && prev.score > p.overall && <> 前回点検({prev.date.slice(0, 4)}年)の{prev.score.toFixed(1)}点から下がっています。</>}
    </>,
    open.length > 0 ? (
      <>
        修繕が必要な箇所が<b>{open.length}件</b>あります(早急 {urgent.length}件、経過観察 {open.length - urgent.length}件)。 最も早い推奨時期は
        <b>{fmtYm(nextDue)}</b>です。
      </>
    ) : (
      <>現在、修繕が必要な箇所はありません。次回点検まで現状の維持管理を続けます。</>
    ),
    total > 0 ? (
      <>
        修繕の概算は合計<b>{fmtMan(total)}</b>です。{DEFAULT_SIM.defer}年先送りすると、同じ箇所の費用が
        <b>約{Math.round(sim.extra / 10000).toLocaleString()}万円増える</b>見込みです(試算)。
      </>
    ) : (
      <>次回の定期点検は{fmtDate(p.nextInspection)}を予定しています。</>
    ),
  ];

  // 指摘は1ページ目に4件、以降は1ページ6件ずつ。指摘が多いときは履歴と進め方を別ページに分ける
  const chunks: Finding[][] = [];
  for (let i = 0; i < open.length; ) {
    const size = chunks.length === 0 ? 4 : 6;
    chunks.push(open.slice(i, i + size));
    i += size;
  }
  const splitLast = open.length > 4;
  const pages = 1 + chunks.length + 1 + (splitLast ? 1 : 0);

  const history = (
    <>
      <h2 className="rp-h">
        <i>{open.length > 0 ? 7 : 4}</i>これまでの点検と修繕
      </h2>
      <div className="rp-hist">
        <div>
          <h3>点検</h3>
          <table className="rp-tbl compact">
            <thead>
              <tr>
                <th>点検日</th>
                <th className="r">評価</th>
                <th>主な指摘</th>
              </tr>
            </thead>
            <tbody>
              {insp.slice(0, 4).map((i) => (
                <tr key={i.id}>
                  <td className="nowrap">{fmtDate(i.date)}</td>
                  <td className="r num">{i.score.toFixed(1)}</td>
                  <td>{i.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>修繕{reps.length > 0 && <span> 累計 {fmtYen(reps.reduce((s, r) => s + r.cost, 0))}</span>}</h3>
          {reps.length === 0 ? (
            <p className="rp-note">修繕の記録はありません。</p>
          ) : (
            <table className="rp-tbl compact">
              <thead>
                <tr>
                  <th>修繕日</th>
                  <th>内容</th>
                  <th className="r">金額(税込)</th>
                </tr>
              </thead>
              <tbody>
                {reps.slice(0, 4).map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td>
                      {r.place} {r.work}
                    </td>
                    <td className="r num">{fmtYen(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <h2 className="rp-h">
        <i>{open.length > 0 ? 8 : 5}</i>今後の進め方
      </h2>
      <ol className="rp-steps">
        {(open.length > 0
          ? [
              ['本書のご説明', '担当より内容をご説明します'],
              ['お見積り', '協力会社の正式な見積をご提示します'],
              ['ご判断', '実施する工事と時期をお決めいただきます'],
              ['工事', '日程を調整し、入居者様へご案内します'],
              ['完了のご報告', '修繕前後の写真とともにご報告します'],
            ]
          : [
              ['本書のご説明', '担当より内容をご説明します'],
              ['日常の維持管理', '清掃・巡回で状態を確認します'],
              ['次回の定期点検', `${fmtDate(p.nextInspection)}を予定しています`],
            ]
        ).map(([t, st], i) => (
          <li key={t}>
            <span>{i + 1}</span>
            <b>{t}</b>
            <small>{st}</small>
          </li>
        ))}
      </ol>
      <div className="rp-contact">
        <b>お問い合わせ</b>
        <span>
          {COMPANY} {p.branch} 担当 {p.staff} ／ TEL 00-0000-0000(平日 9:00〜18:00)
        </span>
      </div>
    </>
  );

  return (
    <div className="report">
      <div className="report-bar no-print">
        <Link to={`/properties/${p.id}`} className="btn light">
          <ArrowLeft size={15} /> カルテに戻る
        </Link>
        <span>お客様にお渡しする建物カルテ(A4・{pages}ページ)</span>
        <button className="btn primary" onClick={() => window.print()}>
          <Printer size={15} /> 印刷 / PDFで保存
        </button>
      </div>

      {/* ---------- 1ページ目: 結論と建物の状態 ---------- */}
      <Sheet p={p} page={1} total={pages}>
        <div className="rp-title">
          <div>
            <small>建物カルテ ご報告書</small>
            <h1>{p.name}</h1>
            <p>
              {p.address} ／ 築{p.age}年({p.builtYear}年築)・{p.structure}・{p.floors}階建・{p.units}戸
            </p>
          </div>
          <div className="rp-photo">
            <Shot part="外壁" kind="全景" seed={0} after />
          </div>
          <div className="rp-to">
            <b>{p.owner} 様</b>
            <span>点検実施日 {fmtDate(p.lastInspection)}</span>
          </div>
        </div>

        <h2 className="rp-h">
          <i>1</i>今回のご報告の要点
        </h2>
        <ol className="rp-points">
          {points.map((pt, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              <p>{pt}</p>
            </li>
          ))}
        </ol>

        <div className="rp-kpis">
          <div>
            <small>総合評価</small>
            <b className="green">
              {p.overall.toFixed(1)}
              <em> / 10</em>
            </b>
            <span>
              <Stars score={p.overall} /> {ratingLabel(p.overall)}
            </span>
          </div>
          <div>
            <small>修繕が必要な箇所</small>
            <b>
              {open.length}
              <em> 件</em>
            </b>
            <span>うち早急 {urgent.length}件</span>
          </div>
          <div>
            <small>修繕の概算(合計)</small>
            <b>{total ? Math.round(total / 10000).toLocaleString() : '—'}
              {total > 0 && <em> 万円</em>}
            </b>
            <span>正式なお見積りで確定</span>
          </div>
          <div>
            <small>最も早い推奨時期</small>
            <b className="mid">{nextDue ? fmtYm(nextDue) : '—'}</b>
            <span>次回点検 {fmtDate(p.nextInspection)}</span>
          </div>
        </div>

        <h2 className="rp-h">
          <i>2</i>建物の現在の状態
        </h2>
        <div className="rp-cond">
          <RadarChart width={300} height={206} data={radarData} outerRadius="68%">
            <PolarGrid stroke="#d9dfe9" />
            <PolarAngleAxis dataKey="part" tick={{ fontSize: 12, fontWeight: 700, fill: '#1c2433' }} />
            <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
            <Radar dataKey="類似物件平均" stroke="#5b6577" strokeWidth={1.5} strokeDasharray="4 4" fill="none" isAnimationActive={false} />
            <Radar dataKey="当物件" stroke="#12925a" strokeWidth={2} fill="#12925a" fillOpacity={0.14} isAnimationActive={false} />
            <Legend iconType="plainline" {...LEGEND} />
          </RadarChart>
          <table className="rp-tbl">
            <thead>
              <tr>
                <th>部位</th>
                <th className="r">評価</th>
                <th className="r">類似物件平均</th>
                <th className="r">差</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {PARTS.map((k) => {
                const diff = p.scores[k] - peer.scores[k];
                const j = judge(p.scores[k]);
                return (
                  <tr key={k}>
                    <td className="strong">{k}</td>
                    <td className="r num strong">{p.scores[k].toFixed(1)}</td>
                    <td className="r num">{peer.scores[k].toFixed(1)}</td>
                    <td className={`r num ${diff < 0 ? 'neg' : ''}`}>
                      {diff >= 0 ? '+' : '−'}
                      {Math.abs(diff).toFixed(1)}
                    </td>
                    <td>
                      <span className={`rp-judge ${j.cls}`}>{j.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="rp-note">
          評価は10点満点です(8点以上: 優良 ／ 7点台: 良好 ／ 6点台: 注意 ／ 6点未満: 要改善)。 類似物件平均は、当社管理の{peer.label}の
          {peer.count}棟の平均です。
        </p>

        <h2 className="rp-h">
          <i>3</i>部位ごとの修繕時期の目安
        </h2>
        <CycleCard p={p} repairs={reps} ownerView />
      </Sheet>

      {/* ---------- 2ページ目: 修繕が必要な箇所 ---------- */}
      {chunks.map((chunk, ci) => (
        <Sheet p={p} page={2 + ci} total={pages} key={ci}>
          <h2 className="rp-h">
            <i>4</i>修繕が必要な箇所{ci > 0 && '(つづき)'}
          </h2>
          {ci === 0 && (
            <div className="rp-site">
              <NumberedSitePlan site={p.site} findings={open} />
              <div>
                <p className="rp-lead">配置図の番号は、下の一覧の番号と対応しています。緊急度の高い順に並べています。</p>
                <ul className="rp-legend">
                  <li>
                    <SeverityBadge severity="urgent" /> 放置すると漏水や落下など二次被害のおそれがあるもの
                  </li>
                  <li>
                    <SeverityBadge severity="watch" /> 現時点で支障はないが、計画的な補修が必要なもの
                  </li>
                </ul>
              </div>
            </div>
          )}
          <div className="rp-findings">
            {chunk.map((f) => (
              <article key={f.id} className={`rp-finding ${f.severity}`}>
                <span className="rp-num" style={{ background: PIN_COLOR[f.severity] }}>
                  {open.indexOf(f) + 1}
                </span>
                <div className="rp-f-main">
                  <h3>
                    {f.part}|{f.location}
                    <SeverityBadge severity={f.severity} />
                  </h3>
                  <b>{f.title}</b>
                  <p>{f.description}</p>
                </div>
                <div className="rp-f-photos">
                  <Shot part={f.part} kind="全景" seed={f.pin.x} />
                  <Shot part={f.part} kind="中景" seed={f.pin.x} />
                </div>
                <dl className="rp-f-kv">
                  <dt>推奨時期</dt>
                  <dd>{fmtYm(f.dueBy)}まで</dd>
                  <dt>概算費用</dt>
                  <dd>{fmtYen(f.estCost)}</dd>
                </dl>
              </article>
            ))}
          </div>
        </Sheet>
      ))}

      {/* ---------- 3ページ目: 理由・ご提案・履歴 ---------- */}
      <Sheet p={p} page={1 + chunks.length + 1} total={pages}>
        {open.length > 0 && (
          <>
            <h2 className="rp-h">
              <i>5</i>なぜ今、修繕をおすすめするのか
            </h2>
            <div className="rp-why">
              <LineChart width={330} height={172} data={sim.rows} margin={{ top: 8, right: 26, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e7ebf2" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} ticks={['現在', '5年後', '10年後', '15年後']} axisLine={{ stroke: '#cfd6e2' }} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(v / 10000)}`} />
                <ReferenceLine x={`${DEFAULT_SIM.defer}年後`} stroke="#d92d20" strokeDasharray="3 3" />
                <Line type="stepAfter" dataKey="neglect" name="先送りした場合" stroke="#d92d20" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="linear" dataKey="now" name="今修繕する場合" stroke="#12925a" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Legend iconType="plainline" {...LEGEND} />
              </LineChart>
              <div>
                <div className="rp-compare">
                  <div>
                    <small>今修繕する場合</small>
                    <b>{fmtMan(total)}</b>
                  </div>
                  <span>→</span>
                  <div className="bad">
                    <small>{DEFAULT_SIM.defer}年先送りした場合</small>
                    <b>{fmtMan(sim.deferred)}</b>
                  </div>
                  <div className="diff">
                    <small>差額</small>
                    <b>+{fmtMan(sim.extra)}</b>
                  </div>
                </div>
                <ul className="rp-reasons">
                  <li>
                    <b>劣化は広がります。</b>ひび割れや防水の傷みは、雨水の浸入で補修範囲が広がります。
                  </li>
                  <li>
                    <b>工事費は上がっています。</b>建設資材の価格は、この5年間で約4割上昇しています。
                  </li>
                  <li>
                    <b>入居にも影響します。</b>入居者の7割が、住まい選びで建物の傷みや維持管理を重視しています。
                  </li>
                </ul>
              </div>
            </div>
            <p className="rp-note">
              グラフは累積の修繕費(万円)の試算です。前提: 工事費の上昇 年{DEFAULT_SIM.inflation * 100}%、劣化による補修範囲の拡大 年
              {DEFAULT_SIM.spread * 100}%。実際の金額は建物の状態とお見積りにより異なります。 出典: 日本建設業連合会資料(2026年7月)、国土交通省「民間賃貸住宅の計画修繕ガイドブック」。
            </p>

            <h2 className="rp-h">
              <i>6</i>ご提案する修繕計画
            </h2>
            <table className="rp-tbl">
              <thead>
                <tr>
                  <th>実施時期の目安</th>
                  <th>工事の対象</th>
                  <th>緊急度</th>
                  <th className="r">概算費用</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((g) =>
                  g.items.map((f, i) => (
                    <tr key={f.id} className={i === 0 ? 'grp' : ''}>
                      {i === 0 && (
                        <td rowSpan={g.items.length} className="strong nowrap">
                          {fmtYm(g.due)}まで
                          <div className="rp-sub">小計 {fmtMan(g.cost)}</div>
                        </td>
                      )}
                      <td>
                        <span className="rp-ref">{open.indexOf(f) + 1}</span>
                        {f.part}|{f.location} {f.title}
                      </td>
                      <td>
                        <SeverityBadge severity={f.severity} short />
                      </td>
                      <td className="r num">{fmtYen(f.estCost)}</td>
                    </tr>
                  )),
                )}
                <tr className="rp-total">
                  <td colSpan={3}>合計(概算)</td>
                  <td className="r num">{fmtYen(total)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {!splitLast && history}
      </Sheet>

      {splitLast && (
        <Sheet p={p} page={pages} total={pages}>
          {history}
        </Sheet>
      )}
    </div>
  );
}

function NumberedSitePlan({ site, findings }: { site: Property['site']; findings: Finding[] }) {
  const pk = site.parking;
  return (
    <svg viewBox="0 0 400 290" className="siteplan" role="img" aria-label="建物配置図">
      <rect width="400" height="290" fill="#eef1f5" />
      <rect y="252" width="400" height="38" fill="#d5dae2" />
      <line x1="0" x2="400" y1="271" y2="271" stroke="#fff" strokeDasharray="14 10" strokeWidth="2" />
      <rect x="40" y="24" width="320" height="226" rx="4" fill="#e2ecd9" stroke="#c3cfb8" />
      <rect x={pk.x} y={pk.y} width={pk.w} height={pk.h} fill="#dfe3ea" stroke="#c5ccd8" />
      <text x={pk.x + pk.w / 2} y={pk.y + pk.h / 2 + 4} textAnchor="middle" fontSize="11" fill="#667085">
        {pk.label}
      </text>
      {site.buildings.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fbfcfd" stroke="#9aa5b6" strokeWidth="1.5" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize="12" fill="#667085">
            {b.label}
          </text>
        </g>
      ))}
      <text x="368" y="40" fontSize="11" fill="#667085" textAnchor="middle">
        N
      </text>
      <path d="M368 44 l-4 10 h8 z" fill="#667085" />
      {findings.map((f, i) => (
        <g key={f.id} transform={`translate(${f.pin.x},${f.pin.y})`}>
          <circle r="12" fill={PIN_COLOR[f.severity]} stroke="#fff" strokeWidth="2" />
          <text textAnchor="middle" dy="4.5" fontSize="13" fontWeight="700" fill="#fff">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
