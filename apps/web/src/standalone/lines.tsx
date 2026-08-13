/**
 * Lines plan (線図) — the classical naval-architecture drawing set, computed
 * exactly from the offsets table:
 *
 *   側面線図  sheer profile with buttock lines  z(x) at y = const
 *   半幅平面図 half-breadth plan with waterlines y(x) at z = const
 *   正面線図  body plan: transverse sections, aft stations drawn to the left
 *            of the centreline and forward stations to the right
 *
 * Sections from the generator are monotone in z, so each buttock crossing is
 * found by scanning one offset segment pair; nothing here is sketched.
 */

import { halfBreadthAt, type HullGeometry, type Station } from '@dock/shared';

interface Pt {
  x: number;
  y: number;
}

const path = (pts: Pt[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

function stationTop(s: Station): number {
  return s.offsets.length ? s.offsets[s.offsets.length - 1].z : 0;
}

/** z where the station reaches half-breadth b, or null when it never does. */
function buttockZ(s: Station, b: number): number | null {
  const offs = s.offsets;
  if (!offs.length || offs[offs.length - 1].y < b) return null;
  for (let i = 0; i < offs.length - 1; i++) {
    const a = offs[i];
    const c = offs[i + 1];
    if (a.y <= b && c.y >= b) {
      const t = c.y - a.y < 1e-12 ? 0 : (b - a.y) / (c.y - a.y);
      return a.z + t * (c.z - a.z);
    }
  }
  return offs[0].y >= b ? offs[0].z : null;
}

export interface LinesData {
  lpp: number;
  beam: number;
  depth: number;
  designDraft: number;
  /** waterline curves y(x), one per z */
  waterlines: { z: number; pts: Pt[] }[];
  /** buttock curves z(x), one per y */
  buttocks: { y: number; pts: Pt[] }[];
  /** deck sheer z(x) */
  sheer: Pt[];
  /** body-plan sections: half-breadth polylines with side (-1 aft, +1 fwd) */
  sections: { x: number; side: -1 | 1; pts: Pt[] }[];
}

export function computeLines(
  hull: HullGeometry,
  dims: { lpp: number; beam: number; depth: number; designDraft: number },
): LinesData {
  const st = hull.stations;
  const half = dims.beam / 2;

  const wlLevels: number[] = [];
  for (let z = dims.depth / 8; z <= dims.depth - 1e-9; z += dims.depth / 8) wlLevels.push(z);
  const waterlines = wlLevels.map((z) => ({
    z,
    pts: st
      .map((s) => ({ x: s.x, y: Math.max(0, halfBreadthAt(s, Math.min(z, stationTop(s)))) }))
      .filter((p) => p.y > 1e-4),
  }));

  const btLevels = [half * 0.25, half * 0.5, half * 0.75];
  const buttocks = btLevels.map((y) => ({
    y,
    pts: st
      .map((s) => {
        const z = buttockZ(s, y);
        return z === null ? null : { x: s.x, y: z };
      })
      .filter((p): p is Pt => p !== null),
  }));

  const sheer = st.map((s) => ({ x: s.x, y: stationTop(s) }));

  // every second station keeps the body plan readable
  const sections = st
    .filter((_, i) => i % 2 === 0)
    .map((s) => {
      const side: -1 | 1 = s.x < dims.lpp / 2 ? -1 : 1;
      const N = 28;
      const zTop = stationTop(s);
      const pts: Pt[] = [];
      for (let j = 0; j <= N; j++) {
        const z = (zTop * j) / N;
        pts.push({ x: side * Math.max(0, halfBreadthAt(s, z)), y: z });
      }
      return { x: s.x, side, pts };
    })
    .filter((s) => s.pts.some((p) => Math.abs(p.x) > 1e-4));

  return { ...dims, waterlines, buttocks, sheer, sections };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const M = { l: 46, r: 18, t: 14, b: 26 };

function Frame(props: {
  w: number;
  h: number;
  title: string;
  sub: string;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <figure className="chart lines-fig">
      <figcaption>
        <span className="chart-title">{props.title}</span>
        <span className="chart-sub">{props.sub}</span>
      </figcaption>
      <div className="chart-frame">
        <svg viewBox={`0 0 ${props.w} ${props.h}`} role="img" aria-label={props.ariaLabel}>
          {props.children}
        </svg>
      </div>
    </figure>
  );
}

/** Sheer profile and half-breadth plan share the x scale, stacked like a lines plan. */
export function ProfileAndPlan(props: { data: LinesData }) {
  const d = props.data;
  const W = 860;
  const profH = 190;
  const planH = 170;
  const sx = (x: number) => M.l + ((W - M.l - M.r) * x) / d.lpp;

  const pz = (z: number) => profH - M.b - ((profH - M.b - M.t) * z) / d.depth;
  const py = (y: number) => planH - M.b - ((planH - M.b - M.t) * y) / (d.beam / 2);

  const stationsGrid = [0, 0.25, 0.5, 0.75, 1].map((f) => f * d.lpp);

  return (
    <>
      <Frame
        w={W}
        h={profH}
        title="側面線図"
        sub="バトックライン z(x)"
        ariaLabel="側面線図。甲板シアラインとバトックライン"
      >
        {stationsGrid.map((x) => (
          <line key={x} x1={sx(x)} y1={M.t} x2={sx(x)} y2={profH - M.b} className="grid" />
        ))}
        <line x1={sx(0)} y1={pz(d.designDraft)} x2={sx(d.lpp)} y2={pz(d.designDraft)} className="wl-design" />
        <text x={sx(d.lpp) - 4} y={pz(d.designDraft) - 4} className="tick wl-tag" textAnchor="end">
          計画喫水 {d.designDraft} m
        </text>
        <line x1={sx(0)} y1={pz(0)} x2={sx(d.lpp)} y2={pz(0)} className="axis" />
        <path d={path(d.sheer.map((p) => ({ x: sx(p.x), y: pz(p.y) })))} className="line-strong" />
        {d.buttocks.map((b) => (
          <path
            key={b.y}
            d={path(b.pts.map((p) => ({ x: sx(p.x), y: pz(p.y) })))}
            className="line-thin"
          />
        ))}
        {d.buttocks.map((b) =>
          b.pts.length ? (
            <text
              key={`t${b.y}`}
              x={sx(b.pts[Math.floor(b.pts.length / 2)].x)}
              y={pz(b.pts[Math.floor(b.pts.length / 2)].y) - 4}
              className="tick"
              textAnchor="middle"
            >
              B{b.y.toFixed(1)}
            </text>
          ) : null,
        )}
        <text x={sx(0)} y={profH - 8} className="tick">AP</text>
        <text x={sx(d.lpp)} y={profH - 8} className="tick" textAnchor="end">FP</text>
      </Frame>

      <Frame
        w={W}
        h={planH}
        title="半幅平面図"
        sub="ウォーターライン y(x)"
        ariaLabel="半幅平面図。各水線での半幅曲線"
      >
        {stationsGrid.map((x) => (
          <line key={x} x1={sx(x)} y1={M.t} x2={sx(x)} y2={planH - M.b} className="grid" />
        ))}
        <line x1={sx(0)} y1={py(0)} x2={sx(d.lpp)} y2={py(0)} className="axis" />
        <text x={sx(0) - 6} y={py(0) + 4} className="tick" textAnchor="end">CL</text>
        {props.data.waterlines.map((wl, i) => (
          <path
            key={wl.z}
            d={path(wl.pts.map((p) => ({ x: sx(p.x), y: py(p.y) })))}
            className={Math.abs(wl.z - d.designDraft) < 1e-6 ? 'line-strong' : 'line-thin'}
            style={{ opacity: 0.45 + (0.55 * (i + 1)) / props.data.waterlines.length }}
          />
        ))}
        <text x={sx(0)} y={planH - 8} className="tick">AP</text>
        <text x={sx(d.lpp)} y={planH - 8} className="tick" textAnchor="end">FP</text>
      </Frame>
    </>
  );
}

export function BodyPlan(props: { data: LinesData }) {
  const d = props.data;
  const W = 400;
  const H = 330;
  const half = d.beam / 2;
  const scale = Math.min(
    (W / 2 - M.r - 8) / half,
    (H - M.t - M.b) / d.depth,
  );
  const cx = W / 2;
  const bx = (y: number) => cx + y * scale;
  const bz = (z: number) => H - M.b - z * scale;

  return (
    <Frame
      w={W}
      h={H}
      title="正面線図"
      sub="船尾側 ← 中心線 → 船首側"
      ariaLabel="正面線図。左に船尾側、右に船首側の横断面群"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={bx(-half * f)} y1={M.t} x2={bx(-half * f)} y2={bz(0)} className="grid" />
          <line x1={bx(half * f)} y1={M.t} x2={bx(half * f)} y2={bz(0)} className="grid" />
        </g>
      ))}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={bx(-half)}
          y1={bz(d.depth * f)}
          x2={bx(half)}
          y2={bz(d.depth * f)}
          className="grid"
        />
      ))}
      <line x1={bx(-half)} y1={bz(d.designDraft)} x2={bx(half)} y2={bz(d.designDraft)} className="wl-design" />
      <line x1={cx} y1={M.t} x2={cx} y2={bz(0)} className="axis" />
      <line x1={bx(-half)} y1={bz(0)} x2={bx(half)} y2={bz(0)} className="axis" />
      {d.sections.map((s) => (
        <path
          key={`${s.x}`}
          d={path(s.pts.map((p) => ({ x: bx(p.x), y: bz(p.y) })))}
          className="line-thin section-line"
        />
      ))}
      <text x={bx(-half)} y={H - 8} className="tick">-B/2</text>
      <text x={cx} y={H - 8} className="tick" textAnchor="middle">CL</text>
      <text x={bx(half)} y={H - 8} className="tick" textAnchor="end">B/2</text>
    </Frame>
  );
}
