import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeHydrostatics,
  tankState,
  type L1Result,
  type TankEntityData,
  type WeightItem,
} from '@dock/shared';
import {
  DockScene,
  fluidKey,
  type GizmoMode,
  type LayerVisibility,
  type TankBox,
  type ViewPreset,
} from '../scene.js';
import {
  envelopeIssues,
  initialModel,
  runL0,
  runStability,
  withTank,
  type Model,
} from './store.js';
import { DisplacementChart, GzChart, StatTile, fmt, hydroTiles } from './charts.js';
import { BodyPlan, ProfileAndPlan, computeLines } from './lines.js';
import { HydroTable, LoadingTable } from './tables.js';

type Module = 'design' | 'lines' | 'hydro' | 'stability' | 'loading';

const MODULES: { id: Module; label: string }[] = [
  { id: 'design', label: '設計' },
  { id: 'lines', label: '線図' },
  { id: 'hydro', label: '流体静力学' },
  { id: 'stability', label: '復原性' },
  { id: 'loading', label: '積付' },
];

const FLUID_LABEL: Record<string, string> = {
  ballast: 'バラスト水',
  fuel: '燃料油',
  fresh: '清水',
  other: 'その他',
};

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: 'iso', label: '等角' },
  { id: 'side', label: '側面' },
  { id: 'front', label: '正面' },
  { id: 'top', label: '平面' },
];

const LAYER_DEFS: { key: keyof LayerVisibility; label: string }[] = [
  { key: 'hull', label: '船殻' },
  { key: 'frames', label: 'フレーム' },
  { key: 'tanks', label: 'タンク' },
  { key: 'labels', label: 'ラベル' },
  { key: 'water', label: '水面' },
];

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DockScene | null>(null);

  const [module, setModule] = useState<Module>('design');
  const [model, setModel] = useState<Model>(initialModel);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('off');
  const [layers, setLayers] = useState<LayerVisibility>({
    hull: true, frames: true, tanks: true, labels: true, water: true,
  });
  const [clipOn, setClipOn] = useState(false);
  const [clipX, setClipX] = useState(model.vessel.principal.lpp / 2);
  const [draft, setDraft] = useState(model.vessel.principal.designDraft);
  const [cargo, setCargo] = useState({ mass: 0, x: 66, z: 6.2 });
  const [stability, setStability] = useState<L1Result | null>(null);
  const [solving, setSolving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);

  const modelRef = useRef(model);
  modelRef.current = model;

  const cargoWeights = useMemo(
    (): WeightItem[] =>
      cargo.mass > 0
        ? [{ id: 'cargo:hold', name: '貨物', mass: cargo.mass, x: cargo.x, y: 0, z: cargo.z }]
        : [],
    [cargo],
  );

  // ---- three.js ------------------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new DockScene(mountRef.current);
    scene.onSelect = setSelectedId;
    scene.onDragPreview = (id, box) => applyBox(id, box, false);
    scene.onDragCommit = (id, box) => applyBox(id, box, true);
    sceneRef.current = scene;
    scene.setHome();
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setModel(model.entities);
  }, [model]);

  useEffect(() => {
    sceneRef.current?.setGizmoMode(module === 'design' ? gizmoMode : 'off');
  }, [gizmoMode, selectedId, module]);

  useEffect(() => {
    sceneRef.current?.setSelected(selectedId);
    if (selectedId) sceneRef.current?.focusTank(selectedId);
    else setGizmoMode('off');
  }, [selectedId]);

  useEffect(() => {
    sceneRef.current?.setVisibility(layers);
  }, [layers, model]);

  useEffect(() => {
    sceneRef.current?.setClipX(clipOn ? clipX : null);
  }, [clipOn, clipX, model]);

  // the lines module hides the canvas; re-measure it on the way back
  useEffect(() => {
    if (module !== 'lines') {
      requestAnimationFrame(() => sceneRef.current?.resize());
    }
  }, [module]);

  // sea follows the module: solved attitude in stability, level draft elsewhere
  useEffect(() => {
    if (module === 'stability' && stability) {
      const e = stability.equilibrium;
      sceneRef.current?.setWaterAttitude({
        heelDeg: e.heelDeg,
        trimDeg: e.trimDeg,
        waterlineConstant: e.waterlineConstant,
      });
    } else {
      sceneRef.current?.setDraft(draft);
    }
  }, [module, stability, draft, model]);

  // ---- edits ---------------------------------------------------------------
  const applyBox = useCallback((id: string, box: TankBox, commit: boolean) => {
    const current = modelRef.current;
    const tank = current.tanks.find((t) => t.id === id);
    if (!tank) return;
    const problems = envelopeIssues(current.vessel, { ...tank.data, ...box });
    if (problems.length) {
      setIssue(`${id.replace(/^tank:/, '')} は船体包絡の外です — ${problems[0].message}`);
      if (commit) sceneRef.current?.resetDrag();
      return;
    }
    setIssue(null);
    setModel(withTank(current, id, box));
  }, []);

  const patchTank = useCallback((id: string, patch: Partial<TankEntityData>) => {
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
  }, []);

  // ---- analysis ------------------------------------------------------------
  const l0 = useMemo(() => runL0(model, draft), [model, draft]);

  const dispCurve = useMemo(() => {
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
      } catch { /* below first waterline */ }
    }
    return pts;
  }, [model]);

  const lines = useMemo(
    () => computeLines(model.hull.geometry, model.vessel.principal),
    [model],
  );

  const solve = useCallback(() => {
    setSolving(true);
    setStability(null);
    window.setTimeout(() => {
      try {
        setStability(runStability(modelRef.current, cargoWeights));
        setIssue(null);
      } catch (err) {
        setIssue(err instanceof Error ? err.message : String(err));
      } finally {
        setSolving(false);
      }
    }, 40);
  }, [cargoWeights]);

  useEffect(() => {
    setStability(null);
  }, [model]);

  const selected = selectedId ? model.tanks.find((t) => t.id === selectedId) ?? null : null;
  const p = model.vessel.principal;
  const showViewport = module !== 'lines';

  const cargoFields = (
    <div className="fields">
      <label>
        <span>貨物重量</span>
        <input
          type="number" step={100} min={0}
          value={cargo.mass}
          onChange={(e) => setCargo({ ...cargo, mass: Number(e.target.value) })}
        />
        <em>t</em>
      </label>
      <label>
        <span>重心 LCG</span>
        <input
          type="number" step={1}
          value={cargo.x}
          onChange={(e) => setCargo({ ...cargo, x: Number(e.target.value) })}
        />
        <em>m</em>
      </label>
      <label>
        <span>重心 VCG</span>
        <input
          type="number" step={0.5}
          value={cargo.z}
          onChange={(e) => setCargo({ ...cargo, z: Number(e.target.value) })}
        />
        <em>m</em>
      </label>
    </div>
  );

  // ---- UI ------------------------------------------------------------------
  return (
    <div className="shell">
      <header className="masthead">
        <div className="ident">
          <span className="mark" aria-hidden="true">⚓</span>
          <div>
            <h1>Digital Dock <span className="product-sub">Designer</span></h1>
            <p className="dims">
              {model.vessel.name} — Lpp <b>{p.lpp}</b> m · B <b>{p.beam}</b> m · D <b>{p.depth}</b> m
            </p>
          </div>
        </div>
        <nav className="modules" role="tablist" aria-label="モジュール">
          {MODULES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={module === m.id}
              className={module === m.id ? 'mode on' : 'mode'}
              onClick={() => setModule(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
      </header>

      {issue && (
        <div className="alert" role="status">
          <span className="alert-mark" aria-hidden="true">!</span>
          <span>{issue}</span>
          <button className="alert-close" onClick={() => setIssue(null)} aria-label="閉じる">×</button>
        </div>
      )}

      <div className="workspace">
        {/* ---- model tree ---- */}
        <aside className="tree">
          <h2 className="tree-head">モデル</h2>
          <div className="tree-node root">{model.vessel.name}</div>
          <div className="tree-node mono">hull:main</div>
          <h2 className="tree-head">タンク</h2>
          <ul className="tree-list">
            {model.tanks.map((t) => {
              const s = tankState(t.data);
              const key = fluidKey(t.data.fluid.name);
              return (
                <li key={t.id}>
                  <button
                    className={t.id === selectedId ? 'tree-row on' : 'tree-row'}
                    onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                    aria-pressed={t.id === selectedId}
                  >
                    <span className={`swatch ${key}`} aria-hidden="true" />
                    <span className="tree-id">{t.id.replace(/^tank:/, '')}</span>
                    <span className={`gauge ${key}`} aria-hidden="true">
                      <span style={{ width: `${t.data.fillPercent}%` }} />
                    </span>
                    <span className="tree-mass num">{fmt(s.fluidMass, 0)}t</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <h2 className="tree-head">表示レイヤ</h2>
          <ul className="layer-list">
            {LAYER_DEFS.map((l) => (
              <li key={l.key}>
                <label className="layer-row">
                  <input
                    type="checkbox"
                    checked={layers[l.key]}
                    onChange={(e) => setLayers({ ...layers, [l.key]: e.target.checked })}
                  />
                  <span>{l.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </aside>

        {/* ---- centre ---- */}
        <main className="centre">
          {showViewport && (
            <div className="viewbar">
              <div className="viewbar-group" role="group" aria-label="視点">
                {VIEWS.map((v) => (
                  <button key={v.id} className="vbtn" onClick={() => sceneRef.current?.setView(v.id)}>
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="viewbar-group clip-group">
                <label className="clip-toggle">
                  <input
                    type="checkbox"
                    checked={clipOn}
                    onChange={(e) => setClipOn(e.target.checked)}
                  />
                  <span>断面クリップ</span>
                </label>
                {clipOn && (
                  <>
                    <input
                      className="clip-slider"
                      type="range"
                      min={1}
                      max={p.lpp - 1}
                      step={0.5}
                      value={clipX}
                      onChange={(e) => setClipX(Number(e.target.value))}
                      aria-label="断面位置"
                    />
                    <span className="num clip-x">x = {fmt(clipX, 1)} m</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div
            className="viewport"
            ref={mountRef}
            style={{ display: showViewport ? undefined : 'none' }}
          />
          {module === 'lines' && (
            <div className="lines-board">
              <ProfileAndPlan data={lines} />
              <div className="lines-row">
                <BodyPlan data={lines} />
                <section className="card particulars">
                  <h2>主要目</h2>
                  <dl className="parts">
                    <div><dt>垂線間長 Lpp</dt><dd className="num">{p.lpp} m</dd></div>
                    <div><dt>型幅 B</dt><dd className="num">{p.beam} m</dd></div>
                    <div><dt>型深さ D</dt><dd className="num">{p.depth} m</dd></div>
                    <div><dt>計画喫水 d</dt><dd className="num">{p.designDraft} m</dd></div>
                    {l0 && (
                      <>
                        <div><dt>排水量(現喫水)</dt><dd className="num">{fmt(l0.displacement, 0)} t</dd></div>
                        <div><dt>方形係数 Cb</dt><dd className="num">{fmt(l0.cb, 3)}</dd></div>
                        <div><dt>柱形係数 Cp</dt><dd className="num">{fmt(l0.cp, 3)}</dd></div>
                        <div><dt>LCB</dt><dd className="num">{fmt(l0.lcb, 2)} m</dd></div>
                      </>
                    )}
                  </dl>
                  <p className="muted">
                    線図はオフセット表(41 ステーション × 17 水線)からの厳密描画。
                    ステーションは 1 本おき、水線は D/8 間隔、バトックは B/8・B/4・3B/8。
                  </p>
                </section>
              </div>
            </div>
          )}
        </main>

        {/* ---- properties rail ---- */}
        <aside className="rail">
          {module === 'design' && (
            selected ? (
              <section className="card">
                <h2><span className="tank-id">{selected.id.replace(/^tank:/, '')}</span> を編集</h2>
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
                    type="range" min={0} max={100} step={1}
                    value={selected.data.fillPercent}
                    onChange={(e) => patchTank(selected.id, { fillPercent: Number(e.target.value) })}
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
                        type="number" step={0.5}
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
            ) : (
              <section className="card">
                <h2>プロパティ</h2>
                <p className="muted">
                  左のツリーまたは 3D ビューでタンクを選択すると、寸法と充填率を
                  ここで編集できます。移動/サイズのギズモも使えます。
                </p>
                <p className="muted">
                  上のツールバーで視点切替・レイヤ表示・断面クリップを操作できます。
                </p>
              </section>
            )
          )}

          {module === 'lines' && (
            <section className="card">
              <h2>線図</h2>
              <p className="muted">
                側面線図(バトックライン)・半幅平面図(ウォーターライン)・
                正面線図(横断面)の 3 面図。すべて船型オフセットからの計算で、
                装飾的なフェアリングは入れていません。
              </p>
            </section>
          )}

          {module === 'hydro' && (
            <section className="card">
              <h2>喫水を与えて解く</h2>
              <label className="slider">
                <span className="slider-head">
                  <span>喫水 d</span>
                  <b className="num">{fmt(draft)} m</b>
                </span>
                <input
                  type="range" min={0.5} max={p.depth} step={0.05}
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
          )}

          {module === 'stability' && (
            <section className="card">
              <h2>浮体姿勢を解く</h2>
              {cargoFields}
              <button className="solve" onClick={solve} disabled={solving}>
                {solving ? '解いています…' : '釣合と復原性を計算'}
              </button>
              {stability && (
                <>
                  <div className={`verdict ${stability.allCriteriaPassed ? 'ok' : 'bad'}`}>
                    <span className="verdict-mark" aria-hidden="true">
                      {stability.allCriteriaPassed ? '✓' : '✗'}
                    </span>
                    <span>IMO 復原性基準 {stability.allCriteriaPassed ? '適合' : '不適合'}</span>
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
                  </div>
                </>
              )}
            </section>
          )}

          {module === 'loading' && (
            <section className="card">
              <h2>貨物(積付条件)</h2>
              {cargoFields}
              <p className="muted">
                タンクの充填率は「設計」モジュールで変更します。ここで組んだ積付
                条件は「復原性」の釣合解にそのまま使われます。
              </p>
            </section>
          )}
        </aside>
      </div>

      {/* ---- detail band ---- */}
      {module === 'hydro' && (
        <div className="detail">
          <DisplacementChart curve={dispCurve} draft={draft} current={l0?.displacement ?? 0} />
          <HydroTable model={model} highlightDraft={draft} />
        </div>
      )}
      {module === 'stability' && stability && (
        <div className="detail">
          <GzChart result={stability} />
          <section className="card criteria-card">
            <h2>IMO 復原性基準 IS Code 2008 Part A 2.2</h2>
            <ul className="criteria">
              {stability.criteria.map((c) => (
                <li key={c.id} className={c.passed ? 'ok' : 'bad'}>
                  <span className="crit-mark" aria-hidden="true">{c.passed ? '✓' : '✗'}</span>
                  <span className="crit-desc">{c.description}</span>
                  <span className="crit-actual num">{fmt(c.actual, 3)} <em>{c.unit}</em></span>
                  <span className="crit-req num">要求 {fmt(c.required, 3)}</span>
                  <span className={`crit-margin num ${c.passed ? 'ok' : 'bad'}`}>
                    {c.margin >= 0 ? '+' : ''}{fmt(c.margin, 3)}
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
              {stability.gzMaxAtRangeEdge && ' · 最大 GZ は計算範囲の端'}
            </p>
          </section>
        </div>
      )}
      {module === 'loading' && (
        <div className="detail">
          <LoadingTable model={model} cargo={cargoWeights} />
        </div>
      )}

      {/* ---- status bar ---- */}
      <footer className="statusbar num">
        <span className="status-mode">{MODULES.find((m) => m.id === module)?.label}</span>
        {module === 'stability' && stability ? (
          <>
            <span>d(AP/FP) {fmt(stability.equilibrium.draftAP)} / {fmt(stability.equilibrium.draftFP)} m</span>
            <span>heel {fmt(stability.equilibrium.heelDeg, 2)}°</span>
            <span>Δ {fmt(stability.equilibrium.displacement, 0)} t</span>
          </>
        ) : (
          <>
            <span>d {fmt(draft)} m</span>
            {l0 && <span>Δ {fmt(l0.displacement, 0)} t</span>}
            {l0 && <span>GM {fmt(l0.gmt, 3)} m</span>}
          </>
        )}
        {selectedId && <span className="sel">選択: {selectedId}</span>}
        <span className="status-note">Digital Dock v12 単体版 — 全計算をページ内で実行</span>
      </footer>
    </div>
  );
}
