import { useMemo, useState } from 'react';
import {
  computeHydrostatics,
  tankState,
  type BranchDto,
  type Entity,
  type HullEntityData,
  type HydroResult,
  type TankEntityData,
  type TransactionDto,
  type VesselDto,
  type VesselEntityData,
} from '@dock/shared';
import type { Snapshot } from './api.js';
import { api } from './api.js';
import type { PreviewState } from './App.js';

const fmt = (v: number, digits = 2) =>
  v.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits });

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export function TopBar(props: {
  vessel: (VesselDto & { branches: BranchDto[] }) | null;
  branch: BranchDto | null;
  viewVersion: number | null;
  onSelectBranch: (id: string) => void;
  onSetVersion: (v: number | null) => void;
  onHome: () => void;
}) {
  const { vessel, branch, viewVersion } = props;
  const head = branch?.headVersion ?? 0;
  const shown = viewVersion ?? head;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">⚓</span> Digital Dock <span className="v">v12</span>
      </div>
      <div className="vessel-name">{vessel?.name ?? '読み込み中…'}</div>
      <div className="controls">
        <label>
          ブランチ
          <select
            value={branch?.id ?? ''}
            onChange={(e) => props.onSelectBranch(e.target.value)}
          >
            {vessel?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (v{b.headVersion})
              </option>
            ))}
          </select>
        </label>
        <label>
          バージョン
          <span className="version-nav">
            <button
              disabled={shown <= 1}
              onClick={() => props.onSetVersion(Math.max(1, shown - 1))}
            >
              ◀
            </button>
            <span className="mono">
              v{shown}/{head}
            </span>
            <button
              disabled={shown >= head}
              onClick={() => props.onSetVersion(shown + 1 >= head ? null : shown + 1)}
            >
              ▶
            </button>
            {viewVersion !== null && (
              <button className="accent" onClick={() => props.onSetVersion(null)}>
                HEAD
              </button>
            )}
          </span>
        </label>
        <button onClick={props.onHome}>視点リセット</button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Entity tree / search
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  vessel: '船体情報',
  hull: '船殻',
  tank: 'タンク',
  compartment: '区画',
  deck: '甲板',
};

export function EntityPanel(props: {
  snapshot: Snapshot | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const list = props.snapshot?.entities ?? [];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? list.filter(
          (e) =>
            e.id.toLowerCase().includes(needle) ||
            ((e.data as { name?: string }).name ?? '').toLowerCase().includes(needle),
        )
      : list;
    const byKind = new Map<string, Entity[]>();
    for (const e of filtered) {
      byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
    }
    return byKind;
  }, [props.snapshot, q]);

  return (
    <div className="section">
      <h2>オブジェクト</h2>
      <input
        className="search"
        placeholder="検索 (id / 名称)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {['vessel', 'hull', 'tank', 'compartment', 'deck'].map((kind) => {
        const items = groups.get(kind) ?? [];
        if (!items.length) return null;
        return (
          <div key={kind} className="entity-group">
            <h3>
              {KIND_LABEL[kind]} <span className="count">{items.length}</span>
            </h3>
            <ul>
              {items.map((e) => {
                const data = e.data as { name?: string; fillPercent?: number };
                return (
                  <li
                    key={e.id}
                    className={e.id === props.selectedId ? 'selected' : ''}
                    onClick={() =>
                      props.onSelect(e.id === props.selectedId ? null : e.id)
                    }
                  >
                    <span className="mono id">{e.id}</span>
                    <span className="name">
                      {data.name}
                      {kind === 'tank' && data.fillPercent !== undefined
                        ? ` — ${data.fillPercent}%`
                        : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hydrostatics panel
// ---------------------------------------------------------------------------

export function HydroPanel(props: {
  snapshot: Snapshot | null;
  branch: BranchDto | null;
  vesselData: VesselEntityData | undefined;
  draft: number | null;
  onDraft: (d: number) => void;
  atHead: boolean;
  viewVersion: number | null;
}) {
  const { snapshot, vesselData } = props;
  const [persisted, setPersisted] = useState<{
    version: number;
    hash: string;
    cached: boolean;
  } | null>(null);
  const [running, setRunning] = useState(false);

  const hull = snapshot?.entities.find((e) => e.kind === 'hull')?.data as
    | HullEntityData
    | undefined;
  const tanks = useMemo(
    () =>
      (snapshot?.entities ?? [])
        .filter((e) => e.kind === 'tank')
        .map((e) => e.data as TankEntityData),
    [snapshot],
  );

  const draft = props.draft ?? vesselData?.principal.designDraft ?? 0;

  // Live (client-side) L0 — same engine as the server, for instant feedback.
  const live: HydroResult | null = useMemo(() => {
    if (!hull || !vesselData || !(draft > 0)) return null;
    try {
      return computeHydrostatics(
        hull.geometry,
        { draft, rhoWater: vesselData.rhoWater, kg: vesselData.kg },
        { lpp: vesselData.principal.lpp, beam: vesselData.principal.beam, tanks },
      );
    } catch {
      return null;
    }
  }, [hull, vesselData, tanks, draft]);

  const curve = useMemo(() => {
    if (!hull || !vesselData) return [];
    const pts: { t: number; disp: number }[] = [];
    const depth = vesselData.principal.depth;
    for (let i = 1; i <= 24; i++) {
      const t = (depth * i) / 24;
      try {
        const r = computeHydrostatics(
          hull.geometry,
          { draft: t, rhoWater: vesselData.rhoWater, kg: vesselData.kg },
          { lpp: vesselData.principal.lpp, beam: vesselData.principal.beam },
        );
        pts.push({ t, disp: r.displacement });
      } catch {
        /* below first waterline */
      }
    }
    return pts;
  }, [hull, vesselData]);

  const persist = async () => {
    if (!props.branch) return;
    setRunning(true);
    try {
      const res = await api.hydroRun(props.branch.id, {
        draft,
        version: props.viewVersion ?? undefined,
      });
      setPersisted({
        version: res.derived.version,
        hash: res.derived.inputHash.slice(0, 12),
        cached: res.cached,
      });
    } finally {
      setRunning(false);
    }
  };

  if (!vesselData) return null;
  const depth = vesselData.principal.depth;

  return (
    <div className="section">
      <h2>流体静力学 L0</h2>
      <label className="slider-row">
        <span>
          喫水 d = <b className="mono">{fmt(draft)} m</b>
        </span>
        <input
          type="range"
          min={0.5}
          max={depth}
          step={0.05}
          value={draft}
          onChange={(e) => props.onDraft(Number(e.target.value))}
        />
      </label>

      {live && (
        <>
          <div className="tiles">
            <Tile label="排水量 Δ" value={fmt(live.displacement, 0)} unit="t" main />
            <Tile label="GM(修正) " value={fmt(live.gmt, 3)} unit="m" main />
            <Tile label="KB" value={fmt(live.kb, 3)} unit="m" />
            <Tile label="BMt" value={fmt(live.bmt, 3)} unit="m" />
            <Tile label="KMt" value={fmt(live.kmt, 3)} unit="m" />
            <Tile label="FSC" value={fmt(live.fsc, 3)} unit="m" />
            <Tile label="TPC" value={fmt(live.tpc, 2)} unit="t/cm" />
            <Tile label="MCT1cm" value={fmt(live.mct1cm, 1)} unit="t·m" />
            <Tile label="LCB" value={fmt(live.lcb, 2)} unit="m" />
            <Tile label="LCF" value={fmt(live.lcf, 2)} unit="m" />
            <Tile label="Cb / Cw" value={`${fmt(live.cb, 3)} / ${fmt(live.cw, 3)}`} unit="" />
            <Tile label="Cp / Cm" value={`${fmt(live.cp, 3)} / ${fmt(live.cm, 3)}`} unit="" />
          </div>
          <DisplacementCurve curve={curve} draft={draft} current={live.displacement} />
        </>
      )}

      <div className="persist-row">
        <button className="primary" disabled={running || !props.branch} onClick={persist}>
          {running ? '実行中…' : 'L0 を実行して保存'}
        </button>
        {persisted && (
          <span className="persist-note mono">
            v{persisted.version} · {persisted.hash}… {persisted.cached ? '(キャッシュ)' : '(新規)'}
          </span>
        )}
      </div>
      <p className="hint">
        表示値はクライアント側で同一エンジンにより即時計算。「実行して保存」で
        ブランチの正確なバージョンに対する不変の derived result として永続化します。
      </p>
    </div>
  );
}

function Tile(props: { label: string; value: string; unit: string; main?: boolean }) {
  return (
    <div className={`tile ${props.main ? 'main' : ''}`}>
      <div className="tile-label">{props.label}</div>
      <div className="tile-value">
        {props.value}
        {props.unit && <span className="tile-unit"> {props.unit}</span>}
      </div>
    </div>
  );
}

function DisplacementCurve(props: {
  curve: { t: number; disp: number }[];
  draft: number;
  current: number;
}) {
  const [hover, setHover] = useState<{ t: number; disp: number } | null>(null);
  const { curve } = props;
  if (curve.length < 2) return null;
  const W = 264;
  const H = 96;
  const PAD = { l: 8, r: 8, t: 8, b: 16 };
  const maxT = curve[curve.length - 1].t;
  const maxD = curve[curve.length - 1].disp;
  const px = (t: number) => PAD.l + ((W - PAD.l - PAD.r) * t) / maxT;
  const py = (d: number) => H - PAD.b - ((H - PAD.t - PAD.b) * d) / maxD;
  const path = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.t).toFixed(1)},${py(p.disp).toFixed(1)}`).join(' ');

  return (
    <div className="curve">
      <div className="curve-title">排水量曲線(喫水 × 排水量)</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
          const t = ((e.clientX - rect.left) / rect.width) * W;
          const nearest = curve.reduce((a, b) =>
            Math.abs(px(b.t) - t) < Math.abs(px(a.t) - t) ? b : a,
          );
          setHover(nearest);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="axis" />
        <path d={path} className="curve-line" />
        <circle cx={px(props.draft)} cy={py(props.current)} r={3.5} className="curve-dot" />
        {hover && (
          <>
            <line x1={px(hover.t)} y1={PAD.t} x2={px(hover.t)} y2={H - PAD.b} className="crosshair" />
            <circle cx={px(hover.t)} cy={py(hover.disp)} r={3} className="curve-dot hover" />
          </>
        )}
        <text x={PAD.l} y={H - 4} className="axis-label">0</text>
        <text x={W - PAD.r} y={H - 4} className="axis-label" textAnchor="end">
          {fmt(maxT, 1)} m
        </text>
      </svg>
      <div className="curve-readout mono">
        {hover
          ? `d=${fmt(hover.t)} m → Δ=${fmt(hover.disp, 0)} t`
          : `d=${fmt(props.draft)} m → Δ=${fmt(props.current, 0)} t`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tank editor (preview → commit workflow)
// ---------------------------------------------------------------------------

export function TankEditor(props: {
  tankId: string;
  tank: TankEntityData;
  editable: boolean;
  busy: boolean;
  previewState: PreviewState | null;
  onPreview: (tankId: string, patch: Record<string, unknown>) => void;
  onCommit: () => void;
  onDiscard: () => void;
}) {
  const { tank } = props;
  const [form, setForm] = useState({
    x0: tank.x0, x1: tank.x1,
    y0: tank.y0, y1: tank.y1,
    z0: tank.z0, z1: tank.z1,
    fillPercent: tank.fillPercent,
  });

  const dirty =
    form.x0 !== tank.x0 || form.x1 !== tank.x1 ||
    form.y0 !== tank.y0 || form.y1 !== tank.y1 ||
    form.z0 !== tank.z0 || form.z1 !== tank.z1 ||
    form.fillPercent !== tank.fillPercent;

  const state = tankState({ ...tank, ...form });
  const hasPreview = props.previewState?.tankId === props.tankId;

  const num = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: Number(e.target.value) }),
    disabled: !props.editable,
    type: 'number' as const,
    step: 0.1,
  });

  return (
    <div className="section">
      <h2>
        タンク編集 <span className="mono id">{props.tankId}</span>
      </h2>
      <div className="grid3">
        <label>x0 <input {...num('x0')} /></label>
        <label>x1 <input {...num('x1')} /></label>
        <label>充填率% <input {...num('fillPercent')} step={1} min={0} max={100} /></label>
        <label>y0 <input {...num('y0')} /></label>
        <label>y1 <input {...num('y1')} /></label>
        <label>z0 <input {...num('z0')} /></label>
        <label>z1 <input {...num('z1')} /></label>
      </div>
      <div className="tank-stats mono">
        容量 {fmt(state.capacity, 1)} m³ · 液量 {fmt(state.fluidVolume, 1)} m³ ·{' '}
        {fmt(state.fluidMass, 1)} t
        {state.freeSurfaceMoment > 0 && ` · FSM ${fmt(state.freeSurfaceMoment, 1)} t·m`}
      </div>
      {props.editable ? (
        <div className="btn-row">
          <button
            disabled={!dirty || props.busy}
            onClick={() => {
              const patch: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(form)) {
                if ((tank as unknown as Record<string, unknown>)[k] !== v) patch[k] = v;
              }
              props.onPreview(props.tankId, patch);
            }}
          >
            プレビュー
          </button>
          <button className="primary" disabled={!hasPreview || props.busy} onClick={props.onCommit}>
            コミット
          </button>
          <button disabled={!hasPreview || props.busy} onClick={props.onDiscard}>
            破棄
          </button>
        </div>
      ) : (
        <p className="hint">過去バージョン表示中は編集できません。</p>
      )}
      {hasPreview && (
        <p className="hint ok">
          プレビュー中(破線表示)— base v{props.previewState!.preview.baseVersion}。
          コミットで確定します。
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History / branches
// ---------------------------------------------------------------------------

export function HistoryPanel(props: {
  transactions: TransactionDto[];
  busy: boolean;
  editable: boolean;
  onRevert: (id: string) => void;
  onCreateBranch: (name: string, atVersion?: number) => void;
  onViewVersion: (v: number | null) => void;
}) {
  const [branchName, setBranchName] = useState('');
  const committed = props.transactions.filter((t) => t.status !== 'previewed');

  return (
    <div className="section">
      <h2>履歴とブランチ</h2>
      <div className="btn-row">
        <input
          className="search"
          placeholder="新ブランチ名 (fork from HEAD)"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
        />
        <button
          disabled={!branchName.trim() || props.busy}
          onClick={() => {
            props.onCreateBranch(branchName.trim());
            setBranchName('');
          }}
        >
          作成
        </button>
      </div>
      <ul className="history">
        {committed.map((t) => (
          <li key={t.id} className={t.status}>
            <div className="tx-head">
              <button
                className="link mono"
                title="このバージョンを表示"
                onClick={() => t.resultVersion && props.onViewVersion(t.resultVersion)}
              >
                v{t.resultVersion}
              </button>
              <span className={`status ${t.status}`}>
                {t.status === 'committed' ? '確定' : '取消済'}
              </span>
              {t.status === 'committed' && !t.revertOfTransactionId && (
                <button
                  className="link danger"
                  disabled={props.busy || !props.editable}
                  onClick={() => props.onRevert(t.id)}
                >
                  取り消す
                </button>
              )}
            </div>
            <div className="tx-desc">{t.description || '(説明なし)'}</div>
            <div className="tx-meta mono">
              {t.operations.length} ops ·{' '}
              {new Date(t.committedAt ?? t.createdAt).toLocaleString('ja-JP')}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
