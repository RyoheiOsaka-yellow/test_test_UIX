import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImagePlus,
  Mail,
  MessageCircle,
  Monitor,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import {
  PARTS,
  fmtDate,
  fmtMan,
  fmtYen,
  fmtYm,
  inspectionsOf,
  peerAverage,
  propertyById,
  ratingLabel,
  regionAverage,
  repairsOf,
  type Finding,
  type Inspection,
  type Part,
  type Property,
  type Repair,
} from '../data';
import { DEFAULT_SIM, deferredCosts, openCost, projectScores, simulate } from '../sim';
import { Empty, LEGEND, SeverityBadge, Stars, useStore } from '../ui';

type Variant = 'desktop' | 'tablet' | 'phone';
const PIN = { urgent: '#d92d20', watch: '#f5a524', ok: '#12925a' } as const;
const TABS = ['建物の状態', '修繕箇所', '修繕の理由', '履歴'];

const RISK: Record<Part, string> = {
  外壁: '雨水が浸入して躯体が傷み、補修範囲が広がります',
  屋根: '雨漏りが起き、下地の腐食につながります',
  防水: '室内への漏水で、入居者様の一時退去や補償が発生します',
  構造: '鉄部の腐食が進み、安全性が下がります',
  設備: '故障による断水や排水不良で、入居者様の生活に支障が出ます',
};
// 国土交通省「民間賃貸住宅の計画修繕ガイドブック(管理業者向け)」の実質利回り試算
const YIELD = {
  木造: { with: 2.78, without: 2.13 },
  RC造: { with: 2.53, without: 1.9 },
};

function judge(score: number) {
  if (score < 6.1) return { cls: 'bad', text: '要対応' };
  if (score < 7.4) return { cls: 'mid', text: '注意' };
  return { cls: 'good', text: '良好' };
}

const rateCls = (score: number) => (score >= 7 ? 'good' : score >= 6 ? 'mid' : 'bad');

// ---------- ダミー写真(全景・中景・近景) ----------

const WALL: Record<Part, [string, string]> = {
  外壁: ['#d8d2c6', '#f1ede4'],
  屋根: ['#8b95a1', '#b8c2cc'],
  防水: ['#a9b8ad', '#d3ded6'],
  構造: ['#c3beb8', '#e5e1dc'],
  設備: ['#b3bdca', '#dbe2ea'],
};
const SHOT_KINDS = ['全景', '中景', '近景'] as const;
type ShotKind = (typeof SHOT_KINDS)[number];
const kindOf = (i: number): ShotKind => (i === 0 ? '全景' : i === 1 ? '中景' : '近景');

function Shot({ part, kind, seed, after }: { part: Part; kind: ShotKind; seed: number; after?: boolean }) {
  const wall = WALL[part][after ? 1 : 0];
  const s = (Math.round(seed) * 31) % 40;
  const stain = after ? 'none' : '#00000018';
  return (
    <svg className="shot" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${part}の${kind}写真(サンプル)`}>
      {kind === '全景' && (
        <>
          <rect width="160" height="120" fill="#cfe3f5" />
          <rect y="98" width="160" height="22" fill="#b8c2ae" />
          <rect x="18" y="30" width="124" height="68" fill={wall} />
          <rect x="14" y="26" width="132" height="6" fill="#7d8792" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3, 4].map((c) => (
              <rect key={`${r}${c}`} x={27 + c * 23} y={38 + r * 20} width="13" height="11" fill="#8fa9c4" stroke="#fff" strokeWidth="1" />
            )),
          )}
          {!after && (
            <>
              <ellipse cx={50 + s * 1.6} cy={56 + (s % 3) * 14} rx="13" ry="10" fill={stain} />
              <circle cx={50 + s * 1.6} cy={56 + (s % 3) * 14} r="15" fill="none" stroke="#d92d20" strokeWidth="2.2" strokeDasharray="5 3" />
            </>
          )}
        </>
      )}
      {kind === '中景' && (
        <>
          <rect width="160" height="120" fill={wall} />
          {[24, 48, 72, 96].map((y) => (
            <line key={y} x1="0" x2="160" y1={y} y2={y} stroke="#0000000f" />
          ))}
          <rect x="104" y="18" width="42" height="52" fill="#8fa9c4" stroke="#fff" strokeWidth="2.5" />
          <line x1="125" x2="125" y1="18" y2="70" stroke="#fff" strokeWidth="2" />
          {!after && (
            <>
              <ellipse cx={52 + s} cy="72" rx="26" ry="16" fill={stain} />
              <path d={`M${40 + s} 22 l-5 18 l8 10 l-6 20 l9 12 l-4 20`} fill="none" stroke="#3b3632" strokeWidth="1.6" strokeLinecap="round" />
              <rect x={22 + s} y="14" width="50" height="98" fill="none" stroke="#d92d20" strokeWidth="1.8" strokeDasharray="5 3" />
            </>
          )}
        </>
      )}
      {kind === '近景' && (
        <>
          <rect width="160" height="120" fill={wall} />
          {[30, 60, 90].map((y) => (
            <line key={y} x1="0" x2="160" y1={y} y2={y} stroke="#0000000f" />
          ))}
          {!after && (
            <>
              <ellipse cx={96 - s / 2} cy="80" rx="30" ry="16" fill={stain} />
              <path
                d={`M${60 + s} 0 l-10 24 l14 14 l-12 26 l16 16 l-8 26 l6 14`}
                fill="none"
                stroke="#2f2a27"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d={`M${64 + s} 38 l14 8 l10 -4`} fill="none" stroke="#2f2a27" strokeWidth="1.4" strokeLinecap="round" />
              <rect x="8" y="88" width="46" height="22" rx="2" fill="#fff" stroke="#9aa5b6" />
              <text x="31" y="103" textAnchor="middle" fontSize="10" fill="#1c2433">
                幅 0.5mm
              </text>
            </>
          )}
        </>
      )}
      <text x="6" y="12" fontSize="9" fill="#00000066">
        サンプル画像
      </text>
    </svg>
  );
}

/** 修繕前後をスライダーで見比べる */
function BeforeAfter({ part }: { part: Part }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="ba-slider">
      <div className="ba-stage">
        <Shot part={part} kind="全景" seed={2} after />
        <div className="ba-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Shot part={part} kind="全景" seed={2} />
        </div>
        <span className="ba-line" style={{ left: `${pos}%` }} />
        <b className="ba-tag l">修繕前</b>
        <b className="ba-tag r">修繕後イメージ</b>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="修繕前後の比較位置" />
    </div>
  );
}

// ---------- 地図風の建物配置図 ----------

function SiteMap({
  site,
  findings,
  selectedId,
  onSelect,
}: {
  site: Property['site'];
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const pk = site.parking;
  return (
    <svg viewBox="0 0 400 290" className="sitemap" role="img" aria-label="建物配置図">
      <rect width="400" height="290" fill="#e9ecf1" />
      {/* 周辺の区画と道路 */}
      {[
        [4, 4, 28, 60],
        [4, 72, 28, 80],
        [4, 160, 28, 82],
        [60, 2, 90, 16],
        [160, 2, 120, 16],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="2" fill="#d9dde4" />
      ))}
      <rect x="0" y="252" width="400" height="38" fill="#fff" />
      <rect x="366" y="0" width="34" height="252" fill="#fff" />
      <line x1="0" x2="366" y1="271" y2="271" stroke="#cfd6e2" strokeDasharray="14 10" strokeWidth="2" />
      <text x="150" y="285" fontSize="9" fill="#8a94a6">
        市道(幅員 6m)
      </text>
      {/* 敷地 */}
      <rect x="40" y="24" width="320" height="226" rx="4" fill="#dfead3" stroke="#b9c8ab" strokeWidth="1.5" />
      {[52, 52, 52, 346, 346].map((x, i) => (
        <circle key={i} cx={x} cy={i < 3 ? 38 + i * 96 : 36 + (i - 3) * 190} r="7" fill="#9fc089" />
      ))}
      <rect x={pk.x} y={pk.y} width={pk.w} height={pk.h} fill="#d5dae2" stroke="#bcc4d1" />
      {Array.from({ length: Math.max(0, Math.floor(pk.w / 21) - 1) }, (_, i) => (
        <line key={i} x1={pk.x + 21 * (i + 1)} x2={pk.x + 21 * (i + 1)} y1={pk.y} y2={pk.y + pk.h} stroke="#fff" />
      ))}
      <text x={pk.x + pk.w / 2} y={pk.y + pk.h / 2 + 4} textAnchor="middle" fontSize="11" fill="#667085">
        {pk.label}
      </text>
      {site.buildings.map((b) => (
        <g key={b.label}>
          <rect x={b.x + 3} y={b.y + 3} width={b.w} height={b.h} fill="#00000014" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fbfcfd" stroke="#8a94a6" strokeWidth="1.5" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#667085">
            {b.label}
          </text>
        </g>
      ))}
      <g transform="translate(383,26)">
        <path d="M0 -14 l-6 16 h12 z" fill="#667085" />
        <text y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#667085">
          N
        </text>
      </g>
      {findings.map((f, i) => {
        const on = f.id === selectedId;
        return (
          <g key={f.id} transform={`translate(${f.pin.x},${f.pin.y})`} onClick={() => onSelect(f.id)} style={{ cursor: 'pointer' }} role="button" aria-label={`${i + 1} ${f.part} ${f.location}`}>
            <circle r="22" fill="transparent" />
            {on && <circle r="19" fill={PIN[f.severity]} opacity="0.22" />}
            <g transform={on ? 'scale(1.2)' : undefined}>
              <path d="M0 4 C-13 -12 -13 -27 0 -27 C13 -27 13 -12 0 4 Z" fill={PIN[f.severity]} stroke="#fff" strokeWidth="1.8" />
              <text y="-10" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
                {i + 1}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- 本体 ----------

function initialVariant(): Variant {
  const w = window.innerWidth;
  // タッチ端末(iPadの横向きなど)は幅が広くてもページ送り型にする
  const touch = window.matchMedia('(pointer: coarse)').matches;
  return w < 700 ? 'phone' : w < (touch ? 1400 : 1100) ? 'tablet' : 'desktop';
}

export default function MyPage() {
  const { id } = useParams();
  const p = propertyById.get(id ?? '');
  const store = useStore();
  const [variant, setVariant] = useState<Variant>(initialVariant);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState<'age' | 'region'>('age');
  const [chart, setChart] = useState<'cost' | 'cumulative' | 'score'>('cost');
  const [lightbox, setLightbox] = useState<{ f: Finding; i: number } | null>(null);
  const [ba, setBa] = useState<{ part: Part; title: string; note: string } | null>(null);
  const [notify, setNotify] = useState({ mail: true, line: true, push: false });
  const [slide, setSlide] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const all = useMemo(() => store.findings.filter((f) => f.propertyId === id), [store.findings, id]);
  const sevOrder = { urgent: 0, watch: 1, ok: 2 } as const;
  const findings = useMemo(() => [...all].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]), [all]);

  useEffect(() => {
    setSelectedId(findings[0]?.id ?? null);
    if (p) setNotify(p.notify);
    // 物件が切り替わったときだけ初期化する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        setBa(null);
      }
      if (lightbox && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const n = lightbox.f.photos;
        setLightbox({ f: lightbox.f, i: (lightbox.i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (!p) return <Empty>物件が見つかりません。</Empty>;

  const open = findings.filter((f) => f.severity !== 'ok' && f.status !== '完了');
  const selected = findings.find((f) => f.id === selectedId) ?? null;
  const insp = inspectionsOf(p.id);
  const reps = repairsOf(p.id);
  const peer = compare === 'age' ? peerAverage(p) : regionAverage(p);
  const total = openCost(all);
  const sim = simulate(total, p.units * 5000, DEFAULT_SIM);
  const bars = deferredCosts(total, DEFAULT_SIM);
  const proj = projectScores(p.scores, [...new Set(open.map((f) => f.part))], insp);
  const nextDue = open.map((f) => f.dueBy).filter(Boolean).sort()[0] ?? null;
  const yieldRef = p.structure === 'RC造' ? { ...YIELD.RC造, label: 'RC造' } : { ...YIELD.木造, label: '木造' };
  const paged = variant !== 'desktop';
  const big = variant === 'phone';
  const tick = big ? 13 : 12;

  const goTo = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setSlide(i);
  };
  const selectFinding = (fid: string) => {
    setSelectedId(fid);
    if (paged && slide !== 1) goTo(1);
  };
  const selectPart = (part: Part) => {
    const f = findings.find((x) => x.part === part);
    if (f) selectFinding(f.id);
  };

  // ---------- ① 建物コンディション ----------
  const block1 = (
    <section className="mp-card" key="b1">
      <header>
        <h2>
          <i>1</i>建物コンディション
        </h2>
        <span>今の状態を一目で把握</span>
      </header>
      <div className="b1">
        <div className="b1-score">
          <small>総合評価(10点満点)</small>
          <div className="mp-big">
            {p.overall.toFixed(1)}
            <span> / 10</span>
          </div>
          <div>
            <Stars score={p.overall} /> <b className={`mp-judge ${rateCls(p.overall)}`}>{ratingLabel(p.overall)}</b>
          </div>
          <div className="b1-next">
            <CalendarClock size={big ? 20 : 17} />
            <span>
              <small>{nextDue ? '次に必要な修繕' : '次回点検'}</small>
              <b>{nextDue ? `${fmtYm(nextDue)}まで` : fmtDate(p.nextInspection)}</b>
            </span>
          </div>
        </div>
        <div className="b1-radar">
          <ResponsiveContainer>
            <RadarChart data={PARTS.map((k) => ({ part: k, 当物件: p.scores[k], 類似物件平均: peer.scores[k] }))} outerRadius="68%">
              <PolarGrid stroke="#d9dfe9" />
              <PolarAngleAxis dataKey="part" tick={{ fontSize: big ? 14 : 12.5, fontWeight: 700, fill: '#1c2433' }} />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar dataKey="類似物件平均" stroke="#5b6577" strokeWidth={1.5} strokeDasharray="4 4" fill="none" isAnimationActive={false} />
              <Radar dataKey="当物件" stroke="#12925a" strokeWidth={2.2} fill="#12925a" fillOpacity={0.15} isAnimationActive={false} />
              <Legend iconType="plainline" {...LEGEND} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="b1-parts">
          <div className="mp-seg" role="group" aria-label="比較対象">
            <button className={compare === 'age' ? 'on' : ''} onClick={() => setCompare('age')}>
              築年数が近い物件
            </button>
            <button className={compare === 'region' ? 'on' : ''} onClick={() => setCompare('region')}>
              同じ地域の物件
            </button>
          </div>
          {PARTS.map((k) => {
            const j = judge(p.scores[k]);
            const diff = p.scores[k] - peer.scores[k];
            return (
              <button key={k} className="b1-row" onClick={() => selectPart(k)} title={`${k}の修繕箇所を見る`}>
                <b>{k}</b>
                <span className="b1-bar">
                  <span className={`fill ${j.cls}`} style={{ width: `${p.scores[k] * 10}%` }} />
                  <i style={{ left: `${peer.scores[k] * 10}%` }} title={`類似物件平均 ${peer.scores[k].toFixed(1)}`} />
                </span>
                <b className="num">{p.scores[k].toFixed(1)}</b>
                <span className={`b1-diff ${diff < 0 ? 'neg' : ''}`}>
                  平均{diff >= 0 ? '+' : '−'}
                  {Math.abs(diff).toFixed(1)}
                </span>
                <span className={`mp-judge ${j.cls}`}>{j.text}</span>
              </button>
            );
          })}
          <p className="mp-note">
            ┃は類似物件平均({peer.label}・{peer.count}棟)。項目を押すと修繕箇所へ移動します。
          </p>
        </div>
      </div>
      {insp.length > 1 && (
        <div className="b1-trend">
          <div>
            <b>評価の推移</b>
            <small>点検ごとの総合評価</small>
          </div>
          <div style={{ height: big ? 110 : 92 }}>
            <ResponsiveContainer>
              <LineChart data={[...insp].reverse().map((i) => ({ year: `${i.date.slice(0, 4)}年`, 総合評価: i.score }))} margin={{ top: 24, right: 28, left: 28, bottom: 0 }}>
                <XAxis dataKey="year" fontSize={tick} tickLine={false} axisLine={{ stroke: '#cfd6e2' }} />
                <YAxis hide domain={['dataMin - 0.6', 'dataMax + 0.2']} />
                <Line dataKey="総合評価" stroke="#12925a" strokeWidth={2.2} dot={{ r: 4.5, fill: '#12925a', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false}>
                  <LabelList dataKey="総合評価" position="top" fontSize={big ? 15 : 13} fontWeight={700} fill="#1c2433" formatter={(v: any) => Number(v).toFixed(1)} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="b1-guide">
        <b>評価の見方</b>
        <span className="mp-judge good">8点以上 優良</span>
        <span className="mp-judge good">7点台 良好</span>
        <span className="mp-judge mid">6点台 注意</span>
        <span className="mp-judge bad">6点未満 要改善</span>
      </div>
    </section>
  );

  // ---------- ② 要修繕箇所の見える化 ----------
  const block2 = (
    <section className="mp-card" key="b2">
      <header>
        <h2>
          <i>2</i>要修繕箇所の見える化
        </h2>
        <span>どこに問題があるか一目で分かる</span>
      </header>
      {findings.length === 0 ? (
        <Empty>登録された指摘はありません</Empty>
      ) : (
        <div className="b2">
          <div className="b2-map">
            <SiteMap site={p.site} findings={findings} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="b2-legend">
              <SeverityBadge severity="urgent" />
              <SeverityBadge severity="watch" />
              <SeverityBadge severity="ok" />
            </div>
            <div className="b2-chips">
              {findings.map((f, i) => (
                <button key={f.id} className={f.id === selectedId ? 'on' : ''} onClick={() => setSelectedId(f.id)}>
                  <i style={{ background: PIN[f.severity] }}>{i + 1}</i>
                  {f.part}|{f.location}
                </button>
              ))}
            </div>
          </div>
          {selected && (
            <div className="b2-detail">
              <div className="b2-title">
                <b>
                  {selected.part}|{selected.location}
                </b>
                <SeverityBadge severity={selected.severity} />
              </div>
              <p className="b2-name">{selected.title}</p>
              <p className="b2-desc">{selected.description}</p>
              {selected.dueBy && (
                <dl className="b2-kv">
                  <div>
                    <dt>推奨時期</dt>
                    <dd>{fmtYm(selected.dueBy)}まで</dd>
                  </div>
                  <div>
                    <dt>概算費用</dt>
                    <dd>{fmtYen(selected.estCost)}</dd>
                  </div>
                </dl>
              )}
              <div className="b2-photo-head">
                <b>写真 {selected.photos}枚</b>
                <span>押すと大きく表示(最大10枚)</span>
              </div>
              <div className="b2-photos">
                {Array.from({ length: Math.min(selected.photos, big ? 4 : 5) }, (_, i) => (
                  <button key={i} onClick={() => setLightbox({ f: selected, i })} aria-label={`写真${i + 1}を拡大`}>
                    <Shot part={selected.part} kind={kindOf(i)} seed={selected.pin.x + i} after={selected.severity === 'ok'} />
                    <em>{kindOf(i)}</em>
                  </button>
                ))}
                {selected.photos > (big ? 4 : 5) ? (
                  <button className="more" onClick={() => setLightbox({ f: selected, i: big ? 4 : 5 })}>
                    +{selected.photos - (big ? 4 : 5)}枚
                  </button>
                ) : (
                  <span className="add" title="デモでは追加できません">
                    <ImagePlus size={18} />
                    写真を追加
                  </span>
                )}
              </div>
              {selected.severity !== 'ok' && (
                <button
                  className="mp-btn wide"
                  onClick={() => setBa({ part: selected.part, title: `${selected.part}|${selected.location}`, note: `修繕した場合の仕上がりイメージです。概算 ${fmtYen(selected.estCost)}` })}
                >
                  修繕前後のイメージを見る <ChevronRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );

  // ---------- ③ 将来修繕シミュレーション ----------
  const chartEl = (kind: 'cost' | 'cumulative' | 'score', h: number) => (
    <div style={{ height: h }}>
      <ResponsiveContainer>
        {kind === 'cost' ? (
          <BarChart data={bars} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e7ebf2" vertical={false} />
            <XAxis dataKey="label" fontSize={tick} tickLine={false} axisLine={{ stroke: '#cfd6e2' }} />
            <YAxis fontSize={tick} tickLine={false} axisLine={false} width={big ? 46 : 42} tickFormatter={(v) => `${Math.round(v / 10000)}`} />
            <Tooltip formatter={(v) => fmtMan(Number(v))} cursor={{ fill: '#f1f4f9' }} />
            <Bar dataKey="cost" name="修繕費" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
              {bars.map((b) => (
                <Cell key={b.label} fill={b.year === 0 ? '#12925a' : '#d92d20'} fillOpacity={b.year === 0 ? 1 : 0.55 + b.year * 0.045} />
              ))}
              <LabelList dataKey="cost" position="top" fontSize={big ? 14 : 12.5} fontWeight={700} fill="#1c2433" formatter={(v: any) => fmtMan(Number(v))} />
            </Bar>
          </BarChart>
        ) : kind === 'cumulative' ? (
          <LineChart data={sim.rows} margin={{ top: 8, right: 26, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e7ebf2" vertical={false} />
            <XAxis dataKey="label" fontSize={tick} tickLine={false} ticks={['現在', '5年後', '10年後', '15年後']} axisLine={{ stroke: '#cfd6e2' }} />
            <YAxis fontSize={tick} tickLine={false} axisLine={false} width={big ? 46 : 42} tickFormatter={(v) => `${Math.round(v / 10000)}`} />
            <Tooltip formatter={(v) => fmtMan(Number(v))} />
            <Legend iconType="plainline" {...LEGEND} />
            <Line type="stepAfter" dataKey="neglect" name="放置した場合" stroke="#d92d20" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="now" name="今修繕する場合" stroke="#12925a" strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        ) : (
          <LineChart data={proj.rows} margin={{ top: 8, right: 26, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e7ebf2" vertical={false} />
            <XAxis dataKey="label" fontSize={tick} tickLine={false} ticks={['現在', '5年後', '10年後']} axisLine={{ stroke: '#cfd6e2' }} />
            <YAxis fontSize={tick} tickLine={false} axisLine={false} width={30} domain={[3, 10]} tickCount={8} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}点`} />
            <Legend iconType="plainline" {...LEGEND} />
            <Line type="linear" dataKey="neglect" name="放置した場合" stroke="#d92d20" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="repair" name="今修繕する場合" stroke="#12925a" strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
  const CHART_LABEL = { cost: '修繕費の比較', cumulative: '累積コスト', score: '建物評価の見通し' } as const;
  const CHART_NOTE = {
    cost: '同じ箇所を、今修繕する場合と先送りした場合の費用(万円)。',
    cumulative: '将来の累積修繕コスト(万円)。日常の小修繕費を含みます。',
    score: `総合評価の見通し(10点満点)。過去の点検と同じペース(年${proj.rate.toFixed(2)}点)で低下すると仮定。`,
  } as const;

  const block3 = (
    <section className="mp-card" key="b3">
      <header>
        <h2>
          <i>3</i>将来修繕シミュレーション
        </h2>
        <span>今修繕する理由が分かる</span>
      </header>
      {total === 0 ? (
        <Empty>現在、修繕が必要な箇所はありません。次回点検は{fmtDate(p.nextInspection)}です。</Empty>
      ) : (
        <div className="b3">
          <div className="b3-lead">
            <p>
              修繕を{DEFAULT_SIM.defer}年放置した場合、
              <br />
              修繕費が大きく増える可能性があります。
            </p>
            <div className="b3-extra">
              約{Math.round(sim.extra / 10000).toLocaleString()}万円
              <small>の追加コスト増</small>
            </div>
            <div className="b3-compare">
              <span>
                <small>今修繕</small>
                <b>{fmtMan(total)}</b>
              </span>
              <ChevronRight size={16} />
              <span>
                <small>{DEFAULT_SIM.defer}年後</small>
                <b className="neg">{fmtMan(sim.deferred)}</b>
              </span>
            </div>
            {nextDue && <div className="b3-reco">{fmtYm(nextDue)}までの修繕を推奨します</div>}
          </div>
          <div className="b3-chart">
            {variant === 'tablet' ? (
              <div className="b3-two">
                {(['cost', 'score'] as const).map((k) => (
                  <div key={k}>
                    <h3>{CHART_LABEL[k]}</h3>
                    {chartEl(k, 210)}
                    <p className="mp-note">{CHART_NOTE[k]}</p>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="mp-seg" role="group" aria-label="グラフの種類">
                  {(['cost', 'cumulative', 'score'] as const).map((k) => (
                    <button key={k} className={chart === k ? 'on' : ''} onClick={() => setChart(k)}>
                      {big && k === 'score' ? '評価の見通し' : CHART_LABEL[k]}
                    </button>
                  ))}
                </div>
                {chartEl(chart, big ? 250 : 215)}
                <p className="mp-note">{CHART_NOTE[chart]}</p>
              </>
            )}
          </div>
          <div className="b3-risk">
            <h3>放置した場合に起こりうること</h3>
            <ul>
              {[...new Set(open.map((f) => f.part))].slice(0, 3).map((part) => (
                <li key={part}>
                  <b>{part}</b>
                  {RISK[part]}
                </li>
              ))}
            </ul>
          </div>
          <div className="b3-yield">
            <h3>計画的な修繕は、物件の収益を守ります</h3>
            <div className="yield-row">
              <span>計画修繕あり</span>
              <span className="track">
                <span style={{ width: `${(yieldRef.with / 3) * 100}%`, background: '#12925a' }} />
              </span>
              <b>{yieldRef.with.toFixed(2)}%</b>
            </div>
            <div className="yield-row">
              <span>計画修繕なし</span>
              <span className="track">
                <span style={{ width: `${(yieldRef.without / 3) * 100}%`, background: '#98a2b3' }} />
              </span>
              <b>{yieldRef.without.toFixed(2)}%</b>
            </div>
            <p className="mp-note">実質利回りの試算({yieldRef.label}の賃貸住宅)。出典: 国土交通省 計画修繕ガイドブック</p>
          </div>
          <p className="mp-note b3-foot">
            ※ 費用と評価の見通しは、過去の修繕実績・地域特性などをもとにした試算です(工事費上昇 年{DEFAULT_SIM.inflation * 100}%、補修範囲の拡大 年
            {DEFAULT_SIM.spread * 100}%と仮定)。
          </p>
        </div>
      )}
    </section>
  );

  // ---------- ④ 点検・修繕履歴 ----------
  const repTotal = reps.reduce((s, r) => s + r.cost, 0);
  const block4 = (
    <section className="mp-card" key="b4">
      <header>
        <h2>
          <i>4</i>点検・修繕履歴
        </h2>
        <span>過去の内容と費用の推移が分かる</span>
      </header>
      <div className="b4">
        <div>
          <h3>
            点検履歴一覧 <small>{insp.length}件</small>
          </h3>
          {big ? (
            <ul className="b4-cards">
              {insp.map((i: Inspection) => (
                <li key={i.id}>
                  <div>
                    <b>{fmtDate(i.date)}</b>
                    <span>{i.summary}</span>
                    <small>次回点検 {i.nextInYears}年後</small>
                  </div>
                  <strong className={`mp-judge ${rateCls(i.score)}`}>{i.score.toFixed(1)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <table className="mp-tbl">
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
                {insp.map((i: Inspection) => (
                  <tr key={i.id}>
                    <td className="nowrap">{fmtDate(i.date)}</td>
                    <td className="r num strong">{i.score.toFixed(1)}</td>
                    <td>{i.summary}</td>
                    <td className="nowrap">{i.nextInYears}年後</td>
                    <td>
                      <Link to={`/properties/${p.id}/report`} className="pdf" aria-label="報告書を開く">
                        <FileText size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3>
            修繕履歴一覧 <small>{reps.length}件 ／ 累計 {fmtYen(repTotal)}</small>
          </h3>
          {reps.length === 0 ? (
            <Empty>修繕の記録はまだありません</Empty>
          ) : big ? (
            <ul className="b4-cards">
              {reps.map((r: Repair) => (
                <li key={r.id}>
                  <button onClick={() => setBa({ part: r.part, title: `${r.place} ${r.work}`, note: `${fmtDate(r.date)} 完了 ／ ${fmtYen(r.cost)} ／ 施工: ${r.contractor}` })}>
                    <div>
                      <b>{fmtDate(r.date)}</b>
                      <span>
                        {r.place} {r.work}
                      </span>
                      <small>押すと修繕前後の写真を表示</small>
                    </div>
                    <strong>{fmtMan(r.cost)}</strong>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <table className="mp-tbl">
              <thead>
                <tr>
                  <th>修繕日</th>
                  <th>修繕箇所</th>
                  <th>修繕内容</th>
                  <th className="r">金額(税込)</th>
                  <th>詳細</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r: Repair) => (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date)}</td>
                    <td>{r.place}</td>
                    <td>{r.work}</td>
                    <td className="r num strong">{fmtYen(r.cost)}</td>
                    <td>
                      <button
                        className="mp-link"
                        onClick={() => setBa({ part: r.part, title: `${r.place} ${r.work}`, note: `${fmtDate(r.date)} 完了 ／ ${fmtYen(r.cost)} ／ 施工: ${r.contractor}` })}
                      >
                        詳細 <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );

  const blocks = [block1, block2, block3, block4];

  const notifyBar = (
    <div className="mp-notify">
      <label className={notify.mail ? 'on' : ''}>
        <input type="checkbox" checked={notify.mail} onChange={(e) => setNotify({ ...notify, mail: e.target.checked })} />
        <Mail size={big ? 20 : 16} />
        <span>メール通知</span>
      </label>
      <label className={notify.line ? 'on' : ''}>
        <input type="checkbox" checked={notify.line} onChange={(e) => setNotify({ ...notify, line: e.target.checked })} />
        <MessageCircle size={big ? 20 : 16} />
        <span>LINE通知</span>
      </label>
      <label className={notify.push ? 'on' : ''}>
        <input type="checkbox" checked={notify.push} onChange={(e) => setNotify({ ...notify, push: e.target.checked })} />
        <Bell size={big ? 20 : 16} />
        <span>プッシュ通知</span>
      </label>
    </div>
  );
  const reportBtn = (
    <Link to={`/properties/${p.id}/report`} className="mp-btn primary">
      <FileText size={big ? 20 : 16} /> {big ? 'レポート' : '報告書(PDF)出力'}
    </Link>
  );

  const overlay: ReactNode = (
    <>
      {lightbox && (
        <div className="mp-overlay" onClick={() => setLightbox(null)}>
          <div className="lb" role="dialog" aria-label="写真の拡大表示" onClick={(e) => e.stopPropagation()}>
            <header>
              <b>
                {lightbox.f.part}|{lightbox.f.location} — {kindOf(lightbox.i)}
              </b>
              <span>
                {lightbox.i + 1} / {lightbox.f.photos}
              </span>
              <button onClick={() => setLightbox(null)} aria-label="閉じる">
                <X size={22} />
              </button>
            </header>
            <div className="lb-stage">
              <button className="nav" onClick={() => setLightbox({ f: lightbox.f, i: (lightbox.i + lightbox.f.photos - 1) % lightbox.f.photos })} aria-label="前の写真">
                <ChevronLeft size={26} />
              </button>
              <Shot part={lightbox.f.part} kind={kindOf(lightbox.i)} seed={lightbox.f.pin.x + lightbox.i} after={lightbox.f.severity === 'ok'} />
              <button className="nav" onClick={() => setLightbox({ f: lightbox.f, i: (lightbox.i + 1) % lightbox.f.photos })} aria-label="次の写真">
                <ChevronRight size={26} />
              </button>
            </div>
            <div className="lb-thumbs">
              {Array.from({ length: lightbox.f.photos }, (_, i) => (
                <button key={i} className={i === lightbox.i ? 'on' : ''} onClick={() => setLightbox({ f: lightbox.f, i })} aria-label={`写真${i + 1}`}>
                  <Shot part={lightbox.f.part} kind={kindOf(i)} seed={lightbox.f.pin.x + i} after={lightbox.f.severity === 'ok'} />
                </button>
              ))}
            </div>
            <p>{lightbox.f.title}。全景 → 中景 → 近景の順に、問題箇所の位置と状態を確認できます。</p>
          </div>
        </div>
      )}
      {ba && (
        <div className="mp-overlay" onClick={() => setBa(null)}>
          <div className="lb" role="dialog" aria-label="修繕前後の比較" onClick={(e) => e.stopPropagation()}>
            <header>
              <b>修繕前後の比較: {ba.title}</b>
              <button onClick={() => setBa(null)} aria-label="閉じる">
                <X size={22} />
              </button>
            </header>
            <BeforeAfter part={ba.part} />
            <p>{ba.note}</p>
            <p className="sub">つまみを左右に動かすと見比べられます。画像はデモ用のサンプルです。</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={`mp-page ${paged ? 'paged' : ''}`}>
      <div className="mp-toolbar no-print">
        <Link to={`/properties/${p.id}`} className="btn light">
          <ArrowLeft size={15} /> <span>社内画面に戻る</span>
        </Link>
        <div className="seg" role="group" aria-label="表示デバイス">
          <button className={variant === 'desktop' ? 'on' : ''} onClick={() => setVariant('desktop')}>
            <Monitor size={15} /> ブラウザ
          </button>
          <button className={variant === 'tablet' ? 'on' : ''} onClick={() => setVariant('tablet')}>
            <Tablet size={15} /> iPad
          </button>
          <button className={variant === 'phone' ? 'on' : ''} onClick={() => setVariant('phone')}>
            <Smartphone size={15} /> スマホ
          </button>
        </div>
      </div>

      <div className={`mp-device d-${variant}`}>
        <div className={`mp v-${variant}`}>
          <header className="mp-head">
            <div>
              <b>建物カルテ(マイページ)</b>
              <span>{p.name}</span>
            </div>
            <div className="mp-user">
              <span className="ic">
                <Mail size={18} />
                <i>3</i>
              </span>
              <span className="ic">
                <Bell size={18} />
                <i>1</i>
              </span>
              <b>{p.owner} 様</b>
            </div>
          </header>

          {paged ? (
            <>
              <nav className="mp-tabs" aria-label="ページ">
                {TABS.map((t, i) => (
                  <button key={t} className={slide === i ? 'on' : ''} onClick={() => goTo(i)} aria-current={slide === i}>
                    <i>{i + 1}</i>
                    <span>{t}</span>
                  </button>
                ))}
              </nav>
              <div
                className="mp-swipe"
                ref={scroller}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const i = Math.round(el.scrollLeft / el.clientWidth);
                  if (i !== slide) setSlide(i);
                }}
              >
                {blocks.map((b, i) => (
                  <div className="mp-slide" key={i}>
                    {b}
                    {i < 3 ? (
                      <button className="mp-next" onClick={() => goTo(i + 1)}>
                        次へ: {i + 2} {TABS[i + 1]} <ChevronRight size={18} />
                      </button>
                    ) : (
                      <div className="mp-end">{notifyBar}</div>
                    )}
                  </div>
                ))}
              </div>
              <footer className="mp-bottom">
                <div className="mp-dots" aria-hidden>
                  {TABS.map((t, i) => (
                    <i key={t} className={slide === i ? 'on' : ''} />
                  ))}
                  <span>左右にスワイプ</span>
                </div>
                {reportBtn}
              </footer>
            </>
          ) : (
            <>
              <div className="mp-grid">{blocks}</div>
              <footer className="mp-foot">
                <div>
                  <b>お知らせ・通知</b>
                  <small>点検結果や修繕提案などを、メール・LINE・プッシュ通知でお知らせします。</small>
                </div>
                {notifyBar}
                {reportBtn}
              </footer>
            </>
          )}
          {overlay}
        </div>
      </div>
    </div>
  );
}
