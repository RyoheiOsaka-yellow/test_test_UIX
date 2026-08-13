import { useState } from 'react';
import type { HydroResult, L1Result } from '@dock/shared';

export const fmt = (v: number, d = 2) =>
  v.toLocaleString('ja-JP', { maximumFractionDigits: d, minimumFractionDigits: d });

/**
 * Righting-lever curve. One measure, one axis. The 0–30° band is shaded
 * because that area is the quantity the IS Code actually tests, and the 30°
 * and 40° bounds are drawn as guides rather than left to be inferred.
 */
export function GzChart(props: { result: L1Result }) {
  const [hover, setHover] = useState<{ heelDeg: number; gz: number } | null>(null);
  const pts = props.result.gz;
  if (pts.length < 2) return null;

  const W = 620;
  const H = 240;
  const PAD = { l: 46, r: 16, t: 16, b: 30 };
  const maxA = pts[pts.length - 1].heelDeg;
  const maxG = Math.max(0.2, ...pts.map((p) => p.gz));
  const minG = Math.min(0, ...pts.map((p) => p.gz));
  const px = (a: number) => PAD.l + ((W - PAD.l - PAD.r) * a) / maxA;
  const py = (g: number) => H - PAD.b - ((H - PAD.t - PAD.b) * (g - minG)) / (maxG - minG);

  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.heelDeg).toFixed(1)},${py(p.gz).toFixed(1)}`)
    .join(' ');
  const under30 = pts.filter((p) => p.heelDeg <= 30);
  const area =
    under30.length > 1
      ? `M${px(0).toFixed(1)},${py(0).toFixed(1)} ` +
        under30.map((p) => `L${px(p.heelDeg).toFixed(1)},${py(p.gz).toFixed(1)}`).join(' ') +
        ` L${px(30).toFixed(1)},${py(0).toFixed(1)} Z`
      : '';

  const ticks: number[] = [];
  for (let g = Math.ceil(minG * 2) / 2; g <= maxG + 1e-9; g += maxG > 2 ? 1 : 0.5) ticks.push(g);
  const shown = hover ?? { heelDeg: props.result.gzMaxAngleDeg, gz: props.result.gzMax };

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">復原てこ曲線 GZ</span>
        <span className="chart-sub">自由トリム・実液面移動</span>
      </figcaption>
      <div className="chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`復原てこ曲線。最大 GZ ${fmt(props.result.gzMax, 3)} m、傾斜角 ${fmt(props.result.gzMaxAngleDeg, 1)} 度`}
          onMouseMove={(e) => {
            const svg = (e.target as SVGElement).closest('svg')!;
            const r = svg.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * W;
            setHover(
              pts.reduce((a, b) => (Math.abs(px(b.heelDeg) - x) < Math.abs(px(a.heelDeg) - x) ? b : a)),
            );
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((g) => (
            <g key={g}>
              <line x1={PAD.l} y1={py(g)} x2={W - PAD.r} y2={py(g)} className="grid" />
              <text x={PAD.l - 8} y={py(g) + 4} className="tick" textAnchor="end">
                {fmt(g, 1)}
              </text>
            </g>
          ))}
          {area && <path d={area} className="gz-area" />}
          <line x1={PAD.l} y1={py(0)} x2={W - PAD.r} y2={py(0)} className="axis" />
          {[30, 40].map((a) =>
            a <= maxA ? (
              <g key={a}>
                <line x1={px(a)} y1={PAD.t} x2={px(a)} y2={H - PAD.b} className="guide" />
                <text x={px(a)} y={H - 10} className="tick" textAnchor="middle">
                  {a}°
                </text>
              </g>
            ) : null,
          )}
          <path d={line} className="gz-line" />
          {hover && (
            <line x1={px(hover.heelDeg)} y1={PAD.t} x2={px(hover.heelDeg)} y2={H - PAD.b} className="crosshair" />
          )}
          <circle cx={px(shown.heelDeg)} cy={py(shown.gz)} r={4.5} className="gz-dot" />
          <text x={PAD.l - 8} y={PAD.t + 2} className="tick unit" textAnchor="end">
            m
          </text>
          <text x={W - PAD.r} y={H - 10} className="tick" textAnchor="end">
            {fmt(maxA, 0)}°
          </text>
        </svg>
      </div>
      <div className="chart-readout">
        <span className="tag">{hover ? '傾斜角' : '最大 GZ'}</span>
        <span className="num">{fmt(shown.heelDeg, 1)}°</span>
        <span className="arrow">→</span>
        <span className="num strong">GZ {fmt(shown.gz, 3)} m</span>
        {!hover && <span className="note">網掛けは 0–30° の面積基準</span>}
      </div>
    </figure>
  );
}

/** Displacement against draft, with the current condition marked. */
export function DisplacementChart(props: {
  curve: { t: number; disp: number }[];
  draft: number;
  current: number;
}) {
  const [hover, setHover] = useState<{ t: number; disp: number } | null>(null);
  const { curve } = props;
  if (curve.length < 2) return null;
  const W = 620;
  const H = 168;
  const PAD = { l: 56, r: 16, t: 14, b: 28 };
  const maxT = curve[curve.length - 1].t;
  const maxD = curve[curve.length - 1].disp;
  const px = (t: number) => PAD.l + ((W - PAD.l - PAD.r) * t) / maxT;
  const py = (d: number) => H - PAD.b - ((H - PAD.t - PAD.b) * d) / maxD;
  const line = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.t).toFixed(1)},${py(p.disp).toFixed(1)}`)
    .join(' ');
  const shown = hover ?? { t: props.draft, disp: props.current };

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">排水量曲線</span>
        <span className="chart-sub">喫水 × 排水量</span>
      </figcaption>
      <div className="chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`排水量曲線。現在の喫水 ${fmt(props.draft)} m で排水量 ${fmt(props.current, 0)} トン`}
          onMouseMove={(e) => {
            const svg = (e.target as SVGElement).closest('svg')!;
            const r = svg.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * W;
            setHover(curve.reduce((a, b) => (Math.abs(px(b.t) - x) < Math.abs(px(a.t) - x) ? b : a)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} y1={py(maxD * f)} x2={W - PAD.r} y2={py(maxD * f)} className="grid" />
              <text x={PAD.l - 8} y={py(maxD * f) + 4} className="tick" textAnchor="end">
                {Math.round((maxD * f) / 1000)}k
              </text>
            </g>
          ))}
          <line x1={PAD.l} y1={py(0)} x2={W - PAD.r} y2={py(0)} className="axis" />
          <path d={line} className="disp-line" />
          {hover && <line x1={px(hover.t)} y1={PAD.t} x2={px(hover.t)} y2={H - PAD.b} className="crosshair" />}
          <circle cx={px(shown.t)} cy={py(shown.disp)} r={4.5} className="disp-dot" />
          <text x={PAD.l - 8} y={PAD.t + 2} className="tick unit" textAnchor="end">
            t
          </text>
          <text x={W - PAD.r} y={H - 8} className="tick" textAnchor="end">
            {fmt(maxT, 1)} m
          </text>
        </svg>
      </div>
      <div className="chart-readout">
        <span className="tag">喫水</span>
        <span className="num">{fmt(shown.t)} m</span>
        <span className="arrow">→</span>
        <span className="num strong">Δ {fmt(shown.disp, 0)} t</span>
      </div>
    </figure>
  );
}

export function StatTile(props: {
  label: string;
  value: string;
  unit?: string;
  emphasis?: boolean;
  tone?: 'ok' | 'bad';
}) {
  return (
    <div className={`stat${props.emphasis ? ' lead' : ''}${props.tone ? ` ${props.tone}` : ''}`}>
      <span className="stat-label">{props.label}</span>
      <span className="stat-value">
        {props.value}
        {props.unit && <span className="stat-unit">{props.unit}</span>}
      </span>
    </div>
  );
}

export function hydroTiles(r: HydroResult) {
  return [
    { label: '排水量 Δ', value: fmt(r.displacement, 0), unit: 't', emphasis: true },
    { label: 'GM 修正後', value: fmt(r.gmt, 3), unit: 'm', emphasis: true },
    { label: 'KB', value: fmt(r.kb, 3), unit: 'm' },
    { label: 'BMt', value: fmt(r.bmt, 3), unit: 'm' },
    { label: 'KMt', value: fmt(r.kmt, 3), unit: 'm' },
    { label: '自由表面修正', value: fmt(r.fsc, 3), unit: 'm' },
    { label: 'TPC', value: fmt(r.tpc, 2), unit: 't/cm' },
    { label: 'MCT 1cm', value: fmt(r.mct1cm, 1), unit: 't·m' },
    { label: 'LCB', value: fmt(r.lcb, 2), unit: 'm' },
    { label: 'LCF', value: fmt(r.lcf, 2), unit: 'm' },
    { label: '方形係数 Cb', value: fmt(r.cb, 3), unit: '' },
    { label: '水線面係数 Cw', value: fmt(r.cw, 3), unit: '' },
  ];
}
