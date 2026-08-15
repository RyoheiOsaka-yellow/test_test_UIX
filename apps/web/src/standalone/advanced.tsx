/**
 * Charts for the advanced modules: longitudinal strength, KN cross curves,
 * the weather criterion figure and the intact/damaged GZ overlay.
 */

import { useState } from 'react';
import {
  bendingDistribution,
  shearDistribution,
  type GzPoint,
  type KnCurve,
  type StrengthResult,
  type WeatherResult,
} from '@dock/shared';
import { fmt } from './charts.js';

const M = { l: 56, r: 18, t: 16, b: 26 };

function niceStep(range: number): number {
  const raw = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, raw))));
  for (const m of [1, 2, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}

// ---------------------------------------------------------------------------
// Longitudinal strength — three stacked panels sharing the x axis
// ---------------------------------------------------------------------------

export function StrengthCharts(props: {
  result: StrengthResult;
  lpp: number;
  /** class-rule permissible values; drawn as dashed limit curves when given */
  envelope?: { permHog: number; permSag: number; permShear: number };
}) {
  const { result, lpp, envelope } = props;
  const xs = result.stations.map((s) => s.x);
  const W = 860;

  const panel = (
    title: string,
    unit: string,
    series: { label: string; values: number[]; cls: string; dashed?: boolean }[],
    H: number,
    shadeZero = false,
  ) => {
    const all = series.flatMap((s) => s.values);
    const lo = Math.min(0, ...all);
    const hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.08 + 1e-9;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const px = (x: number) => M.l + ((W - M.l - M.r) * x) / lpp;
    const py = (v: number) => H - M.b - ((H - M.b - M.t) * (v - y0)) / (y1 - y0);
    const step = niceStep(y1 - y0);
    const ticks: number[] = [];
    for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) ticks.push(v);
    const path = (vals: number[]) =>
      vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(xs[i]).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

    return (
      <figure className="chart" key={title}>
        <figcaption>
          <span className="chart-title">{title}</span>
          <span className="chart-sub">{unit}</span>
          {series.length > 1 && (
            <span className="legend">
              {series.map((s) => (
                <span key={s.label} className={`legend-item ${s.cls}`}>{s.label}</span>
              ))}
            </span>
          )}
        </figcaption>
        <div className="chart-frame">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}(${unit})`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.l} y1={py(v)} x2={W - M.r} y2={py(v)} className="grid" />
                <text x={M.l - 8} y={py(v) + 4} className="tick" textAnchor="end">
                  {Math.abs(v) >= 1000 ? `${fmt(v / 1000, 1)}k` : fmt(v, 0)}
                </text>
              </g>
            ))}
            <line x1={M.l} y1={py(0)} x2={W - M.r} y2={py(0)} className="axis" />
            {shadeZero &&
              series
                .filter((s) => !s.dashed)
                .map((s) => (
                  <path
                    key={`a${s.label}`}
                    d={`${path(s.values)} L${px(lpp).toFixed(1)},${py(0).toFixed(1)} L${px(0).toFixed(1)},${py(0).toFixed(1)} Z`}
                    className={`fill-${s.cls}`}
                  />
                ))}
            {series.map((s) => (
              <path
                key={s.label}
                d={path(s.values)}
                className={`sline ${s.cls}${s.dashed ? ' limit' : ''}`}
              />
            ))}
            <text x={M.l} y={H - 8} className="tick">AP</text>
            <text x={W - M.r} y={H - 8} className="tick" textAnchor="end">FP</text>
          </svg>
        </div>
      </figure>
    );
  };

  const shearSeries: { label: string; values: number[]; cls: string; dashed?: boolean }[] = [
    { label: 'Q', values: result.stations.map((s) => s.shear), cls: 'q' },
  ];
  const momentSeries: { label: string; values: number[]; cls: string; dashed?: boolean }[] = [
    { label: 'M', values: result.stations.map((s) => s.moment), cls: 'm' },
  ];
  if (envelope) {
    shearSeries.push(
      { label: '許容+', values: xs.map((x) => envelope.permShear * shearDistribution(x, lpp)), cls: 'lim', dashed: true },
      { label: '許容−', values: xs.map((x) => -envelope.permShear * shearDistribution(x, lpp)), cls: 'lim', dashed: true },
    );
    momentSeries.push(
      { label: '許容サギング', values: xs.map((x) => envelope.permSag * bendingDistribution(x, lpp)), cls: 'lim', dashed: true },
      { label: '許容ホギング', values: xs.map((x) => -envelope.permHog * bendingDistribution(x, lpp)), cls: 'lim', dashed: true },
    );
  }

  return (
    <>
      {panel(
        '重量・浮力分布',
        't/m',
        [
          { label: '重量 w(x)', values: result.stations.map((s) => s.weight), cls: 'w' },
          { label: '浮力 b(x)', values: result.stations.map((s) => s.buoyancy), cls: 'b' },
        ],
        200,
      )}
      {panel('せん断力 Q(x)' + (envelope ? ' と許容包絡線' : ''), 't', shearSeries, 190, true)}
      {panel(
        '曲げモーメント M(x) — サギング正' + (envelope ? ' と許容包絡線' : ''),
        't·m',
        momentSeries,
        210,
        true,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// KN cross curves
// ---------------------------------------------------------------------------

export function KnChart(props: { curves: KnCurve[] }) {
  const { curves } = props;
  if (!curves.length || !curves[0].points.length) return null;
  const W = 620;
  const H = 300;
  const disps = curves[0].points.map((p) => p.displacement);
  const dMin = disps[0];
  const dMax = disps[disps.length - 1];
  const knMax = Math.max(...curves.flatMap((c) => c.points.map((p) => p.kn)));
  const px = (d: number) => M.l + ((W - M.l - M.r - 34) * (d - dMin)) / (dMax - dMin);
  const py = (kn: number) => H - M.b - ((H - M.b - M.t) * kn) / (knMax * 1.06);

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">KN 交差曲線</span>
        <span className="chart-sub">GZ = KN − KG·sinφ で任意条件へ換算</span>
      </figcaption>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="KN交差曲線。排水量に対する各傾斜角のKN値">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={M.l} y1={py(knMax * f)} x2={W - M.r} y2={py(knMax * f)} className="grid" />
              <text x={M.l - 8} y={py(knMax * f) + 4} className="tick" textAnchor="end">
                {fmt(knMax * f, 1)}
              </text>
            </g>
          ))}
          <line x1={M.l} y1={py(0)} x2={W - M.r} y2={py(0)} className="axis" />
          {curves.map((c, i) => {
            const d = c.points
              .map((p, j) => `${j === 0 ? 'M' : 'L'}${px(p.displacement).toFixed(1)},${py(p.kn).toFixed(1)}`)
              .join(' ');
            const last = c.points[c.points.length - 1];
            return (
              <g key={c.heelDeg}>
                <path
                  d={d}
                  className="kn-line"
                  style={{ opacity: 0.45 + (0.55 * (i + 1)) / curves.length }}
                />
                <text x={px(last.displacement) + 6} y={py(last.kn) + 4} className="tick kn-tag">
                  {c.heelDeg}°
                </text>
              </g>
            );
          })}
          <text x={M.l} y={H - 8} className="tick">{fmt(dMin / 1000, 1)}k t</text>
          <text x={W - M.r - 34} y={H - 8} className="tick" textAnchor="end">{fmt(dMax / 1000, 1)}k t</text>
          <text x={M.l - 8} y={M.t + 2} className="tick unit" textAnchor="end">m</text>
        </svg>
      </div>
      <div className="chart-readout">
        <span className="note">自由トリム・KG = 0(キール基準)で解いた交差曲線。曲線ラベルは傾斜角。</span>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Weather criterion figure
// ---------------------------------------------------------------------------

export function WeatherFigure(props: { gz: GzPoint[]; weather: WeatherResult }) {
  const { gz, weather: w } = props;
  if (!w.applicable) return null;
  const W = 620;
  const H = 260;
  const maxA = Math.min(gz[gz.length - 1].heelDeg, Math.max(60, w.phi2 + 5));
  const minA = Math.min(0, w.phiWindward) - 2;
  const gzMax = Math.max(...gz.map((p) => p.gz), w.lw2) * 1.1;
  const gzMin = Math.min(0, -gzAtSigned(gz, Math.abs(minA))) - 0.1;
  const px = (a: number) => M.l + ((W - M.l - M.r) * (a - minA)) / (maxA - minA);
  const py = (v: number) => H - M.b - ((H - M.b - M.t) * (v - gzMin)) / (gzMax - gzMin);

  // signed GZ for the windward side: GZ(−φ) = −GZ(φ)
  function gzAtSigned(points: GzPoint[], deg: number): number {
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i + 1].heelDeg >= deg) {
        const a = points[i];
        const b = points[i + 1];
        const t = (deg - a.heelDeg) / (b.heelDeg - a.heelDeg);
        return a.gz + t * (b.gz - a.gz);
      }
    }
    return points[points.length - 1].gz;
  }
  const gzSigned = (deg: number) => (deg >= 0 ? gzAtSigned(gz, deg) : -gzAtSigned(gz, -deg));

  const samples: { a: number; v: number }[] = [];
  for (let a = minA; a <= maxA + 1e-9; a += 1) samples.push({ a, v: gzSigned(a) });
  const curvePath = samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${px(s.a).toFixed(1)},${py(s.v).toFixed(1)}`)
    .join(' ');

  const areaPath = (from: number, to: number): string => {
    const pts: string[] = [`M${px(from).toFixed(1)},${py(w.lw2).toFixed(1)}`];
    for (let a = from; a <= to + 1e-9; a += 0.5) {
      pts.push(`L${px(a).toFixed(1)},${py(gzSigned(a)).toFixed(1)}`);
    }
    pts.push(`L${px(to).toFixed(1)},${py(w.lw2).toFixed(1)} Z`);
    return pts.join(' ');
  };

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">気象基準</span>
        <span className="chart-sub">IS Code 2008 A/2.3 — 突風てこ lw2 との面積比較</span>
      </figcaption>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`気象基準の図。面積b ${fmt(w.areaB, 3)}、面積a ${fmt(w.areaA, 3)} メートルラジアン`}>
          <line x1={M.l} y1={py(0)} x2={W - M.r} y2={py(0)} className="axis" />
          <line x1={px(0)} y1={M.t} x2={px(0)} y2={H - M.b} className="grid" />
          <path d={areaPath(w.phiWindward, w.phi0)} className="area-a" />
          <path d={areaPath(w.phi0, w.phi2)} className="area-b" />
          <line x1={M.l} y1={py(w.lw1)} x2={W - M.r} y2={py(w.lw1)} className="lever lw1" />
          <line x1={M.l} y1={py(w.lw2)} x2={W - M.r} y2={py(w.lw2)} className="lever lw2" />
          <path d={curvePath} className="gz-line" />
          {[
            { a: w.phiWindward, t: 'φ0−φ1' },
            { a: w.phi0, t: 'φ0' },
            { a: w.phi2, t: 'φ2' },
          ].map((m) => (
            <g key={m.t}>
              <line x1={px(m.a)} y1={M.t} x2={px(m.a)} y2={H - M.b} className="guide" />
              <text x={px(m.a)} y={H - 10} className="tick" textAnchor="middle">{m.t}</text>
            </g>
          ))}
          <text x={W - M.r} y={py(w.lw1) - 4} className="tick lever-tag" textAnchor="end">lw1</text>
          <text x={W - M.r} y={py(w.lw2) - 4} className="tick lever-tag" textAnchor="end">lw2</text>
          <text x={px((w.phiWindward + w.phi0) / 2)} y={py(w.lw2) + 26} className="tick area-tag a" textAnchor="middle">a</text>
          <text x={px((w.phi0 + w.phi2) / 2)} y={py(w.lw2) - 12} className="tick area-tag b" textAnchor="middle">b</text>
        </svg>
      </div>
      <div className="chart-readout">
        <span className="tag">b / a</span>
        <span className="num strong">{Number.isFinite(w.ratio) ? fmt(w.ratio, 2) : '∞'}</span>
        <span className={w.passed ? 'wx-pass' : 'wx-fail'}>{w.passed ? '適合(b ≥ a)' : '不適合(b < a)'}</span>
        <span className="note">
          横揺れ角 φ1 = {fmt(w.phi1, 1)}° · 横揺れ周期 {fmt(w.rollPeriod, 1)} s · 風圧面積 {fmt(w.windage.area, 0)} m²
        </span>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Intact vs damaged GZ overlay
// ---------------------------------------------------------------------------

export function GzOverlay(props: {
  intact: GzPoint[] | null;
  damaged: GzPoint[];
}) {
  const { intact, damaged } = props;
  const W = 620;
  const H = 240;
  const maxA = damaged[damaged.length - 1].heelDeg;
  const all = [...(intact ?? []), ...damaged];
  const hi = Math.max(0.1, ...all.map((p) => p.gz)) * 1.08;
  const lo = Math.min(0, ...damaged.map((p) => p.gz)) - 0.05;
  const px = (a: number) => M.l + ((W - M.l - M.r) * a) / maxA;
  const py = (v: number) => H - M.b - ((H - M.b - M.t) * (v - lo)) / (hi - lo);
  const path = (pts: GzPoint[]) =>
    pts
      .filter((p) => p.heelDeg <= maxA + 1e-9)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.heelDeg).toFixed(1)},${py(p.gz).toFixed(1)}`)
      .join(' ');

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">復原てこ曲線 — 損傷時</span>
        <span className="legend">
          {intact && <span className="legend-item intact">非損傷</span>}
          <span className="legend-item damaged">損傷時</span>
        </span>
      </figcaption>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="非損傷時と損傷時の復原てこ曲線の比較">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={M.l} y1={py(hi * f)} x2={W - M.r} y2={py(hi * f)} className="grid" />
          ))}
          <line x1={M.l} y1={py(0)} x2={W - M.r} y2={py(0)} className="axis" />
          {[15, 30, 45, 60].filter((a) => a < maxA).map((a) => (
            <text key={a} x={px(a)} y={H - 10} className="tick" textAnchor="middle">{a}°</text>
          ))}
          {intact && <path d={path(intact)} className="gz-line intact-line" />}
          <path d={path(damaged)} className="gz-line damaged-line" />
          <text x={M.l - 8} y={M.t + 2} className="tick unit" textAnchor="end">m</text>
        </svg>
      </div>
    </figure>
  );
}
