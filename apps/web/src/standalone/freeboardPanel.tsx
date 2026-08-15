/**
 * 乾舷 module — ILLC computation breakdown and the load line mark drawn to
 * scale on the hull side, with the seasonal marks and the current condition's
 * mean draft for comparison.
 */

import type { FreeboardResult } from '@dock/shared';
import { fmt } from './charts.js';

export function FreeboardBreakdown(props: { fb: FreeboardResult }) {
  const { fb } = props;
  return (
    <section className="card table-card">
      <h2>乾舷計算(ILLC 1966 · Type B · 船楼なし)</h2>
      <div className="table-scroll">
        <table className="eng">
          <thead>
            <tr>
              <th className="txt">項目</th>
              <th>値<br /><span>mm</span></th>
              <th className="txt">備考</th>
            </tr>
          </thead>
          <tbody>
            {fb.steps.map((s) => (
              <tr key={s.label}>
                <td className="txt">{s.label}</td>
                <td>{s.value.toLocaleString('ja-JP')}</td>
                <td className="txt note-cell">{s.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="txt">夏期乾舷</td>
              <td>{Math.round(fb.summerFreeboard * 1000).toLocaleString('ja-JP')}</td>
              <td className="txt note-cell">夏期満載喫水 {fmt(fb.summerDraft, 3)} m</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted">
        Type B 表は 90–200 m を 10 m 刻みで内蔵し線形補間(条約原表は 1 m 刻みのため
        中間長さで数 mm の差が出ます)。船楼・トランクは本モデルに存在しないため控除 0。
      </p>
    </section>
  );
}

/** The load line mark (Plimsoll mark) drawn to draft scale. */
export function LoadLineMark(props: {
  fb: FreeboardResult;
  depth: number;
  /** current condition mean draft [m], marked with an arrow when given */
  currentDraft: number | null;
}) {
  const { fb, depth } = props;
  const W = 460;
  const H = 340;
  const PAD = { t: 30, b: 26 };
  // draft scale: show from a little below winter to the deck
  const dMin = fb.winterDraft - 0.8;
  const dMax = depth + 0.3;
  const y = (draft: number) =>
    H - PAD.b - ((H - PAD.t - PAD.b) * (draft - dMin)) / (dMax - dMin);

  const fwaM = (fb.fwa ?? 0) / 1000;
  const marks: { id: string; label: string; draft: number; fresh?: boolean }[] = [
    { id: 'TF', label: 'TF 熱帯淡水', draft: fb.tropicalDraft + fwaM, fresh: true },
    { id: 'F', label: 'F 淡水', draft: fb.summerDraft + fwaM, fresh: true },
    { id: 'T', label: 'T 熱帯', draft: fb.tropicalDraft },
    { id: 'S', label: 'S 夏期', draft: fb.summerDraft },
    { id: 'W', label: 'W 冬期', draft: fb.winterDraft },
  ];

  const cx = 150; // ring centre
  const combX = 250; // seasonal comb vertical
  const ringR = 26;

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">満載喫水線標識</span>
        <span className="chart-sub">喫水スケールに対する実寸配置</span>
      </figcaption>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="満載喫水線標識(プリムソルマーク)">
          {/* deck line */}
          <rect x={cx - 60} y={y(depth) - 3} width={120} height={6} className="ll-deck" />
          <text x={cx - 66} y={y(depth) + 4} className="tick" textAnchor="end">甲板線 D {depth} m</text>

          {/* ring with the summer line through its centre */}
          <circle cx={cx} cy={y(fb.summerDraft)} r={ringR} className="ll-ring" />
          <line
            x1={cx - ringR - 22} y1={y(fb.summerDraft)}
            x2={cx + ringR + 22} y2={y(fb.summerDraft)}
            className="ll-line strong"
          />

          {/* seasonal comb */}
          <line x1={combX} y1={y(marks[0].draft) - 8} x2={combX} y2={y(fb.winterDraft) + 8} className="ll-line" />
          {marks.map((m) => (
            <g key={m.id}>
              <line
                x1={combX} y1={y(m.draft)}
                x2={combX + 34} y2={y(m.draft)}
                className={`ll-line${m.fresh ? ' fresh' : ''}`}
              />
              <text x={combX + 40} y={y(m.draft) + 4} className={`tick ll-tag${m.fresh ? ' fresh' : ''}`}>
                {m.label} {fmt(m.draft, 3)} m
              </text>
            </g>
          ))}

          {/* current condition draft */}
          {props.currentDraft !== null && (
            <g>
              <line x1={40} y1={y(props.currentDraft)} x2={W - 24} y2={y(props.currentDraft)} className="ll-current" />
              <text x={44} y={y(props.currentDraft) - 5} className="tick ll-current-tag">
                現条件 平均喫水 {fmt(props.currentDraft, 3)} m
              </text>
            </g>
          )}

          {/* baseline */}
          <line x1={40} y1={y(dMin) + 2} x2={W - 24} y2={y(dMin) + 2} className="axis" />
        </svg>
      </div>
      <div className="chart-readout">
        <span className="tag">FWA</span>
        <span className="num">{fb.fwa === null ? '—' : `${fb.fwa} mm`}</span>
        <span className="tag">船首高さ</span>
        <span className="num">
          {fmt(fb.bowHeightActual, 2)} m / 要求 {fmt(fb.bowHeightRequired, 2)} m
        </span>
        <span className={fb.bowHeightPassed ? 'wx-pass' : 'wx-fail'}>
          {fb.bowHeightPassed ? '適合' : '不適合'}
        </span>
      </div>
    </figure>
  );
}
