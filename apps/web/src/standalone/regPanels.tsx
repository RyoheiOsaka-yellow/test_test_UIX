/**
 * Regulatory panels: grain stability, the probabilistic subdivision index and
 * the time-domain flooding transient.
 */

import type {
  FloodingResult,
  GrainResult,
  SubdivisionResult,
} from '@dock/shared';
import { fmt } from './charts.js';

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------

export function GrainCard(props: {
  holds: { id: string; name: string }[];
  partlyFilledIds: string[];
  stowageFactor: number;
  result: GrainResult | null;
  onTogglePartly: (id: string, partly: boolean) => void;
  onStowageFactor: (sf: number) => void;
}) {
  const r = props.result;
  return (
    <section className="card">
      <h2>穀類復原性 — International Grain Code</h2>
      <div className="grain-holds">
        {props.holds.map((h) => {
          const partly = props.partlyFilledIds.includes(h.id);
          return (
            <label key={h.id} className="grain-hold">
              <span className="space-name">{h.name}</span>
              <span className="grain-mode" role="group" aria-label={`${h.name} の積付`}>
                <button
                  className={partly ? 'seg' : 'seg on'}
                  onClick={() => props.onTogglePartly(h.id, false)}
                  aria-pressed={!partly}
                >
                  満載トリム済 15°
                </button>
                <button
                  className={partly ? 'seg on' : 'seg'}
                  onClick={() => props.onTogglePartly(h.id, true)}
                  aria-pressed={partly}
                >
                  部分積付 25°
                </button>
              </span>
            </label>
          );
        })}
      </div>
      <div className="fields sf-field">
        <label>
          <span>載貨係数 SF</span>
          <input
            type="number" step={0.05} min={0.8} max={3}
            value={props.stowageFactor}
            onChange={(e) => props.onStowageFactor(Number(e.target.value))}
          />
          <em>m³/t</em>
        </label>
      </div>
      {r ? (
        <>
          <div className={`verdict ${r.passed ? 'ok' : 'bad'}`}>
            <span className="verdict-mark" aria-hidden="true">{r.passed ? '✓' : '✗'}</span>
            <span>Grain Code {r.passed ? '適合' : '不適合'}</span>
          </div>
          <ul className="criteria">
            {r.criteria.map((c) => (
              <li key={c.id} className={c.passed ? 'ok' : 'bad'}>
                <span className="crit-mark" aria-hidden="true">{c.passed ? '✓' : '✗'}</span>
                <span className="crit-desc">{c.description}</span>
                <span className="crit-actual num">
                  {Number.isFinite(c.actual) ? fmt(c.actual, 3) : '—'} <em>{c.unit}</em>
                </span>
                <span className="crit-req num">
                  {c.id === 'heel' ? '≤' : '≥'} {fmt(c.required, 3)}
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">
            仮定容積傾斜モーメント {fmt(r.vhm, 0)} m⁴ → 傾斜てこ λ0 = {fmt(r.lambda0, 3)} m
            (40° で 0.8·λ0)。穀類面はこのモデルでは各船倉の全幅矩形
            (実務では Code の VHM 表と給食装置・サドルを反映します)。
          </p>
        </>
      ) : (
        <p className="muted">「復原性」の釣合解が前提です(自動計算されます)。</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Probabilistic subdivision index
// ---------------------------------------------------------------------------

export function SubdivisionCard(props: {
  result: SubdivisionResult | null;
  busy: boolean;
  onCompute: () => void;
}) {
  const r = props.result;
  return (
    <section className="card table-card">
      <h2>確率論的区画指標 — 達成指標 A と要求指標 R</h2>
      {!r && (
        <>
          <p className="muted">
            区画配置(ピーク + 各区画)から単一・隣接 2 区画の浸水ケースを構成し、
            各ケースを喪失浮力法で解いて A = Σ p·s を求めます。s は SOLAS II-1
            Reg 7-2 の式、p は簡易統計モデル(位置一様 × 長さ三角分布、
            Jmax = 0.24)による近似で、3 喫水加重は行いません。
          </p>
          <button className="solve" onClick={props.onCompute} disabled={props.busy}>
            {props.busy ? '9 ケースを解いています…' : 'A / R を計算'}
          </button>
        </>
      )}
      {r && (
        <>
          <div className={`verdict ${r.passed ? 'ok' : 'bad'}`}>
            <span className="verdict-mark" aria-hidden="true">{r.passed ? '✓' : '✗'}</span>
            <span>
              A = {fmt(r.attained, 3)} {r.passed ? '≥' : '<'} R = {fmt(r.required, 3)}(Ls = {r.ls} m)
            </span>
          </div>
          <div className="table-scroll">
            <table className="eng">
              <thead>
                <tr>
                  <th className="txt">浸水ケース</th>
                  <th>p</th>
                  <th>横傾斜<br /><span>deg</span></th>
                  <th>GZmax<br /><span>m</span></th>
                  <th>範囲<br /><span>deg</span></th>
                  <th>s</th>
                  <th>p·s</th>
                </tr>
              </thead>
              <tbody>
                {r.cases.map((c) => (
                  <tr key={c.label} className={c.s < 0.5 ? 'cmp-fail-row' : ''}>
                    <td className="txt">{c.label}</td>
                    <td>{fmt(c.p, 4)}</td>
                    <td>{fmt(c.heelDeg, 1)}</td>
                    <td>{fmt(c.gzMax, 3)}</td>
                    <td>{fmt(c.rangeDeg, 1)}</td>
                    <td>{fmt(c.s, 3)}</td>
                    <td>{fmt(c.ps, 4)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="txt">Σ(3 区画以上の損傷 p = {fmt(r.residualP, 3)} は未評価)</td>
                  <td colSpan={5} />
                  <td>{fmt(r.attained, 4)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Flooding transient
// ---------------------------------------------------------------------------

const M = { l: 52, r: 16, t: 14, b: 26 };

export function TransientChart(props: { result: FloodingResult }) {
  const { series, equalizedAt, seaLevelledAt, capsizedAt } = props.result;
  if (series.length < 2) return null;
  const W = 620;
  const H = 220;
  const tMax = series[series.length - 1].t;
  const heels = series.map((s) => s.heelDeg);
  const hLo = Math.min(0, ...heels) - 0.5;
  const hHi = Math.max(1, ...heels) + 0.5;
  const px = (t: number) => M.l + ((W - M.l - M.r) * t) / tMax;
  const py = (h: number) => H - M.b - ((H - M.b - M.t) * (h - hLo)) / (hHi - hLo);
  const path = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${px(s.t).toFixed(1)},${py(s.heelDeg).toFixed(1)}`)
    .join(' ');

  const volH = 150;
  const vMax = Math.max(...series.map((s) => Math.max(s.volBreached, s.volDuct)), 1);
  const pvy = (v: number) => volH - M.b - ((volH - M.b - M.t) * v) / (vMax * 1.05);
  const volPath = (key: 'volBreached' | 'volDuct') =>
    series.map((s, i) => `${i === 0 ? 'M' : 'L'}${px(s.t).toFixed(1)},${pvy(s[key]).toFixed(1)}`).join(' ');
  const hasDuct = series.some((s) => s.volDuct > 0);

  const event = (t: number | null, label: string, cls: string) =>
    t !== null && t <= tMax ? (
      <g>
        <line x1={px(t)} y1={M.t} x2={px(t)} y2={H - M.b} className={`guide ${cls}`} />
        <text x={px(t) + 4} y={M.t + 10} className={`tick ${cls}`}>{label} {fmt(t, 0)}s</text>
      </g>
    ) : null;

  return (
    <>
      <figure className="chart">
        <figcaption>
          <span className="chart-title">浸水過渡 — 横傾斜の時間履歴</span>
          <span className="chart-sub">準静的・オリフィス流</span>
        </figcaption>
        <div className="chart-frame">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="浸水過渡解析の横傾斜時間履歴">
            {[0.25, 0.5, 0.75, 1].map((f) => {
              const h = hLo + (hHi - hLo) * f;
              return (
                <g key={f}>
                  <line x1={M.l} y1={py(h)} x2={W - M.r} y2={py(h)} className="grid" />
                  <text x={M.l - 8} y={py(h) + 4} className="tick" textAnchor="end">{fmt(h, 1)}</text>
                </g>
              );
            })}
            <line x1={M.l} y1={py(0)} x2={W - M.r} y2={py(0)} className="axis" />
            <path d={path} className="gz-line" />
            {event(equalizedAt, '均圧', 'ev-eq')}
            {event(seaLevelledAt, '海面一致', 'ev-sea')}
            {event(capsizedAt, '復原力喪失', 'ev-cap')}
            <text x={W - M.r} y={H - 8} className="tick" textAnchor="end">{fmt(tMax, 0)} s</text>
            <text x={M.l - 8} y={M.t + 2} className="tick unit" textAnchor="end">deg</text>
          </svg>
        </div>
        <div className="chart-readout">
          <span className="tag">最大横傾斜</span>
          <span className="num strong">
            {fmt(Math.max(...heels.map(Math.abs)), 2)}°
          </span>
          {equalizedAt !== null && (
            <span className="wx-pass">均圧完了 {fmt(equalizedAt, 0)} 秒(&lt; 1°)</span>
          )}
          {capsizedAt !== null && <span className="wx-fail">t = {fmt(capsizedAt, 0)} s で復原力喪失</span>}
        </div>
      </figure>

      <figure className="chart">
        <figcaption>
          <span className="chart-title">浸水量の時間履歴</span>
          {hasDuct && (
            <span className="legend">
              <span className="legend-item vb">損傷区画</span>
              <span className="legend-item vd">均圧側</span>
            </span>
          )}
        </figcaption>
        <div className="chart-frame">
          <svg viewBox={`0 0 ${W} ${volH}`} role="img" aria-label="浸水量の時間履歴">
            {[0.5, 1].map((f) => (
              <g key={f}>
                <line x1={M.l} y1={pvy(vMax * f)} x2={W - M.r} y2={pvy(vMax * f)} className="grid" />
                <text x={M.l - 8} y={pvy(vMax * f) + 4} className="tick" textAnchor="end">
                  {fmt(vMax * f, 0)}
                </text>
              </g>
            ))}
            <line x1={M.l} y1={pvy(0)} x2={W - M.r} y2={pvy(0)} className="axis" />
            <path d={volPath('volBreached')} className="sline vb" />
            {hasDuct && <path d={volPath('volDuct')} className="sline vd" />}
            <text x={M.l - 8} y={M.t + 2} className="tick unit" textAnchor="end">m³</text>
            <text x={W - M.r} y={volH - 8} className="tick" textAnchor="end">{fmt(tMax, 0)} s</text>
          </svg>
        </div>
      </figure>
    </>
  );
}
