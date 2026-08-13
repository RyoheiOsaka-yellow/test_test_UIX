import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeHydrostatics,
  tankState,
  type L1Result,
  type TankEntityData,
  type WeightItem,
} from '@dock/shared';
import { DockScene, fluidKey, type GizmoMode, type TankBox } from '../scene.js';
import {
  envelopeIssues,
  initialModel,
  runL0,
  runStability,
  tankSummary,
  withTank,
  type Model,
} from './store.js';
import {
  DisplacementChart,
  GzChart,
  StatTile,
  fmt,
  hydroTiles,
} from './charts.js';

const FLUID_LABEL: Record<string, string> = {
  ballast: 'バラスト水',
  fuel: '燃料油',
  fresh: '清水',
  other: 'その他',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DockScene | null>(null);

  const [model, setModel] = useState<Model>(initialModel);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('off');
  const [draft, setDraft] = useState(model.vessel.principal.designDraft);
  const [mode, setMode] = useState<'L0' | 'L1'>('L0');
  const [cargo, setCargo] = useState({ mass: 0, x: 66, z: 6.2 });
  const [stability, setStability] = useState<L1Result | null>(null);
  const [solving, setSolving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);

  const modelRef = useRef(model);
  modelRef.current = model;

  // ---- three.js ------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new DockScene(mountRef.current);
    scene.onSelect = setSelectedId;
    scene.onDragPreview = (id, box) => applyBox(id, box, false);
    scene.onDragCommit = (id, box) => applyBox(id, box, true);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setModel(model.entities);
  }, [model]);

  // frame the vessel once, after the first model reaches the scene
  useEffect(() => {
    sceneRef.current?.setHome();
  }, []);

  useEffect(() => {
    sceneRef.current?.setGizmoMode(gizmoMode);
  }, [gizmoMode, selectedId]);

  useEffect(() => {
    sceneRef.current?.setSelected(selectedId);
    if (selectedId) sceneRef.current?.focusTank(selectedId);
    else setGizmoMode('off');
  }, [selectedId]);

  // The sea follows whichever analysis is on screen.
  useEffect(() => {
    if (mode === 'L1' && stability) {
      const e = stability.equilibrium;
      sceneRef.current?.setWaterAttitude({
        heelDeg: e.heelDeg,
        trimDeg: e.trimDeg,
        waterlineConstant: e.waterlineConstant,
      });
    } else {
      sceneRef.current?.setDraft(draft);
    }
  }, [mode, stability, draft, model]);

  /** A tank edit from either the gizmo or the number fields. */
  const applyBox = useCallback((id: string, box: TankBox, commit: boolean) => {
    const current = modelRef.current;
    const tank = current.tanks.find((t) => t.id === id);
    if (!tank) return;
    const next = { ...tank.data, ...box };
    const problems = envelopeIssues(current.vessel, next);
    if (problems.length) {
      setIssue(`${id.replace(/^tank:/, '')} は船体包絡の外です — ${problems[0].message}`);
      if (commit) sceneRef.current?.resetDrag();
      return;
    }
    setIssue(null);
    setModel(withTank(current, id, box));
  }, []);

  const patchTank = useCallback(
    (id: string, patch: Partial<TankEntityData>) => {
      const current = modelRef.current;
      const tank = current.tanks.find((t) => t.id === id);
      if (!tank) return;
      const problems = envelopeIssues(current.vessel, { ...tank.data, ...patch });
      if (problems.length) {
        setIssue(`${id.replace(/^tank:/, '')} は船体包絡の外です — ${problems[0].message}`);
        return;
      }
      setIssue(null);
      setModel(withTank(current, id, patch));
    },
    [],
  );

  // ---- analysis ------------------------------------------------------------
  const l0 = useMemo(() => runL0(model, draft), [model, draft]);

  const curve = useMemo(() => {
    const pts: { t: number; disp: number }[] = [];
    const depth = model.vessel.principal.depth;
    for (let i = 1; i <= 28; i++) {
      const t = (depth * i) / 28;
      try {
        const r = computeHydrostatics(
          model.hull.geometry,
          { draft: t, rhoWater: model.vessel.rhoWater, kg: model.vessel.kg },
          { lpp: model.vessel.principal.lpp, beam: model.vessel.principal.beam },
        );
        pts.push({ t, disp: r.displacement });
      } catch {
        /* below the first waterline */
      }
    }
    return pts;
  }, [model]);

  const solve = useCallback(() => {
    setSolving(true);
    setStability(null);
    // yield a frame so the button can show it is working
    window.setTimeout(() => {
      try {
        const extra: WeightItem[] =
          cargo.mass > 0
            ? [{ id: 'cargo:hold', name: '貨物', mass: cargo.mass, x: cargo.x, y: 0, z: cargo.z }]
            : [];
        setStability(runStability(modelRef.current, extra));
        setIssue(null);
      } catch (err) {
        setIssue(err instanceof Error ? err.message : String(err));
      } finally {
        setSolving(false);
      }
    }, 40);
  }, [cargo]);

  // a model change invalidates a solved attitude
  useEffect(() => {
    setStability(null);
  }, [model]);

  const selected = selectedId ? model.tanks.find((t) => t.id === selectedId) ?? null : null;
  const summary = useMemo(() => tankSummary(model), [model]);
  const p = model.vessel.principal;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="ident">
          <span className="mark" aria-hidden="true">⚓</span>
          <div>
            <h1>{model.vessel.name}</h1>
            <p className="dims">
              Lpp <b>{p.lpp}</b> m · 型幅 <b>{p.beam}</b> m · 型深さ <b>{p.depth}</b> m ·
              計画喫水 <b>{p.designDraft}</b> m
            </p>
          </div>
        </div>
        <div className="modes" role="tablist" aria-label="解析モード">
          <button
            role="tab"
            aria-selected={mode === 'L0'}
            className={mode === 'L0' ? 'mode on' : 'mode'}
            onClick={() => setMode('L0')}
          >
            L0 流体静力学
          </button>
          <button
            role="tab"
            aria-selected={mode === 'L1'}
            className={mode === 'L1' ? 'mode on' : 'mode'}
            onClick={() => setMode('L1')}
          >
            L1 復原性
          </button>
        </div>
      </header>

      {issue && (
        <div className="alert" role="status">
          <span className="alert-mark" aria-hidden="true">!</span>
          <span>{issue}</span>
          <button className="alert-close" onClick={() => setIssue(null)} aria-label="閉じる">
            ×
          </button>
        </div>
      )}

      <div className="stage">
        <div className="viewport" ref={mountRef} />
        <aside className="rail">
          {mode === 'L0' ? (
            <section className="card">
              <h2>喫水を与えて解く</h2>
              <label className="slider">
                <span className="slider-head">
                  <span>喫水 d</span>
                  <b className="num">{fmt(draft)} m</b>
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={p.depth}
                  step={0.05}
                  value={draft}
                  onChange={(e) => setDraft(Number(e.target.value))}
                />
              </label>
              {l0 ? (
                <div className="stats">
                  {hydroTiles(l0).map((t) => (
                    <StatTile key={t.label} {...t} />
                  ))}
                </div>
              ) : (
                <p className="muted">この喫水では計算できません。</p>
              )}
            </section>
          ) : (
            <section className="card">
              <h2>浮体姿勢を解く</h2>
              <p className="muted lead-in">
                軽荷重量とタンク内容、任意の貨物から、船がどこに浮くかを解きます。
              </p>
              <div className="fields">
                <label>
                  <span>貨物重量</span>
                  <input
                    type="number"
                    step={100}
                    min={0}
                    value={cargo.mass}
                    onChange={(e) => setCargo({ ...cargo, mass: Number(e.target.value) })}
                  />
                  <em>t</em>
                </label>
                <label>
                  <span>重心 LCG</span>
                  <input
                    type="number"
                    step={1}
                    value={cargo.x}
                    onChange={(e) => setCargo({ ...cargo, x: Number(e.target.value) })}
                  />
                  <em>m</em>
                </label>
                <label>
                  <span>重心 VCG</span>
                  <input
                    type="number"
                    step={0.5}
                    value={cargo.z}
                    onChange={(e) => setCargo({ ...cargo, z: Number(e.target.value) })}
                  />
                  <em>m</em>
                </label>
              </div>
              <button className="solve" onClick={solve} disabled={solving}>
                {solving ? '解いています…' : '釣合と復原性を計算'}
              </button>
              {stability && (
                <>
                  <div className={`verdict ${stability.allCriteriaPassed ? 'ok' : 'bad'}`}>
                    <span className="verdict-mark" aria-hidden="true">
                      {stability.allCriteriaPassed ? '✓' : '✗'}
                    </span>
                    <span>
                      IMO 復原性基準 {stability.allCriteriaPassed ? '適合' : '不適合'}
                    </span>
                  </div>
                  <div className="stats">
                    <StatTile
                      label="排水量"
                      value={fmt(stability.equilibrium.displacement, 0)}
                      unit="t"
                      emphasis
                    />
                    <StatTile
                      label="GM₀ 修正後"
                      value={fmt(stability.gm0, 3)}
                      unit="m"
                      emphasis
                      tone={stability.gm0 >= 0.15 ? 'ok' : 'bad'}
                    />
                    <StatTile label="船尾喫水" value={fmt(stability.equilibrium.draftAP, 3)} unit="m" />
                    <StatTile label="船首喫水" value={fmt(stability.equilibrium.draftFP, 3)} unit="m" />
                    <StatTile label="トリム 船尾" value={fmt(stability.equilibrium.trimByStern, 3)} unit="m" />
                    <StatTile label="横傾斜" value={fmt(stability.equilibrium.heelDeg, 2)} unit="°" />
                    <StatTile label="最大 GZ" value={fmt(stability.gzMax, 3)} unit="m" />
                    <StatTile label="最大 GZ 傾斜角" value={fmt(stability.gzMaxAngleDeg, 1)} unit="°" />
                  </div>
                </>
              )}
            </section>
          )}

          {selected && (
            <section className="card">
              <h2>
                <span className="tank-id">{selected.id.replace(/^tank:/, '')}</span> を編集
              </h2>
              <div className="gizmo">
                <span className="gizmo-label">3D 操作</span>
                {(['off', 'translate', 'scale'] as GizmoMode[]).map((m) => (
                  <button
                    key={m}
                    className={gizmoMode === m ? 'seg on' : 'seg'}
                    onClick={() => setGizmoMode(m)}
                    aria-pressed={gizmoMode === m}
                  >
                    {m === 'off' ? 'なし' : m === 'translate' ? '移動' : 'サイズ'}
                  </button>
                ))}
              </div>
              <label className="slider">
                <span className="slider-head">
                  <span>充填率</span>
                  <b className="num">{selected.data.fillPercent}%</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={selected.data.fillPercent}
                  onChange={(e) =>
                    patchTank(selected.id, { fillPercent: Number(e.target.value) })
                  }
                />
              </label>
              <div className="boxfields">
                {(
                  [
                    ['x0', '船尾端'], ['x1', '船首端'],
                    ['y0', '左舷'], ['y1', '右舷'],
                    ['z0', '底'], ['z1', '天井'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k}>
                    <span>{label}</span>
                    <input
                      type="number"
                      step={0.5}
                      value={selected.data[k]}
                      onChange={(e) => patchTank(selected.id, { [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <p className="muted">
                {FLUID_LABEL[fluidKey(selected.data.fluid.name)]} · 密度{' '}
                <span className="num">{selected.data.fluid.density}</span> t/m³ · 容量{' '}
                <span className="num">{fmt(tankState(selected.data).capacity, 1)}</span> m³
              </p>
            </section>
          )}
        </aside>
      </div>

      <div className="detail">
        {mode === 'L1' && stability ? (
          <>
            <GzChart result={stability} />
            <section className="card criteria-card">
              <h2>IMO 復原性基準 IS Code 2008 Part A 2.2</h2>
              <ul className="criteria">
                {stability.criteria.map((c) => (
                  <li key={c.id} className={c.passed ? 'ok' : 'bad'}>
                    <span className="crit-mark" aria-hidden="true">{c.passed ? '✓' : '✗'}</span>
                    <span className="crit-desc">{c.description}</span>
                    <span className="crit-actual num">
                      {fmt(c.actual, 3)} <em>{c.unit}</em>
                    </span>
                    <span className="crit-req num">要求 {fmt(c.required, 3)}</span>
                    <span className={`crit-margin num ${c.passed ? 'ok' : 'bad'}`}>
                      {c.margin >= 0 ? '+' : ''}
                      {fmt(c.margin, 3)}
                    </span>
                    <span className="crit-ref">{c.reference}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">
                甲板端没水角{' '}
                <span className="num">
                  {stability.deckImmersionAngleDeg === null
                    ? '—'
                    : `${fmt(stability.deckImmersionAngleDeg, 1)}°`}
                </span>{' '}
                · 復原力消失角{' '}
                <span className="num">
                  {stability.vanishingAngleDeg === null
                    ? '計算範囲外'
                    : `${fmt(stability.vanishingAngleDeg, 1)}°`}
                </span>{' '}
                · 面積基準の上限 <span className="num">{stability.floodingAngleDeg}°</span>
                {stability.gzMaxAtRangeEdge && ' · 最大 GZ は計算範囲の端にあり、実際の頂点はさらに大傾斜側'}
              </p>
            </section>
          </>
        ) : (
          <>
            <DisplacementChart curve={curve} draft={draft} current={l0?.displacement ?? 0} />
            <section className="card method">
              <h2>この計算について</h2>
              <dl>
                <dt>船型</dt>
                <dd>
                  オフセット表(41 ステーション × 17 水線)。断面は区分線形の多角形として
                  厳密に積分し、船長方向のみシンプソン則で近似します。
                </dd>
                <dt>自由表面</dt>
                <dd>
                  L0 は慣行どおり小傾斜の自由表面修正。L1 は箱タンクを四面体分割して
                  液面平面と厳密に交差させ、任意姿勢での実液面移動を解きます。
                </dd>
                <dt>釣合条件</dt>
                <dd>
                  浮力と重量が地球鉛直線上で一致すること。教科書の LCB = LCG は
                  この厳密条件から鉛直方向の項を落とした近似で、本エンジンは
                  LCB − LCG = −(KB − KG)·tanθ を満たします。
                </dd>
              </dl>
            </section>
          </>
        )}
        <section className="card tanks-card">
          <h2>タンク配置 — 行を選ぶと 3D で選択されます</h2>
          <ul className="tanklist">
              {model.tanks.map((t) => {
                const s = tankState(t.data);
                const key = fluidKey(t.data.fluid.name);
                return (
                  <li key={t.id}>
                    <button
                      className={t.id === selectedId ? 'tankrow on' : 'tankrow'}
                      onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                      aria-pressed={t.id === selectedId}
                    >
                      <span className="tank-head">
                        <span className={`swatch ${key}`} aria-hidden="true" />
                        <span className="tank-id">{t.id.replace(/^tank:/, '')}</span>
                        <span className="tank-name">{t.data.name}</span>
                      </span>
                      <span className="tank-meta">
                        <span className={`gauge ${key}`} aria-hidden="true">
                          <span style={{ width: `${t.data.fillPercent}%` }} />
                        </span>
                        <span className="tank-fill num">{t.data.fillPercent}%</span>
                        <span className="tank-mass num">{fmt(s.fluidMass, 0)} t</span>
                        {s.freeSurfaceMoment > 0 && <span className="slack">自由表面</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          <p className="totals num">
            合計 {fmt(summary.mass, 0)} t / 容量 {fmt(summary.capacity, 0)} m³ ·
            自由表面のあるタンク {summary.slack} 基
          </p>
        </section>

      </div>

      <footer className="colophon">
        <p>
          Digital Dock v12 — 単体版。3D 表示と L0 / L1 の計算はすべてこのページ内で
          実行しています。製品版はこれに PostgreSQL のイベントソーシング、
          ブランチとバージョン管理、プレビュー→コミットの取引、MCP サーバーが加わります。
        </p>
      </footer>
    </div>
  );
}
