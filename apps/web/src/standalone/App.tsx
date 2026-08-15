import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkEnvelope,
  computeHydrostatics,
  tankState,
  type KnCurve,
  type L1Result,
  type StrengthResult,
  type TankEntityData,
  type WeatherResult,
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
  hasAsymmetricZone,
  initialModel,
  inspectHeel,
  ruleDefaults,
  runDamage,
  runFreeboardCalc,
  runKnCurves,
  runL0,
  runStability,
  runStrengthCalc,
  runWeather,
  withCrossFlooding,
  withTank,
  zonesForSpaces,
  type Model,
} from './store.js';
import {
  applyCondition,
  cargoAsWeights,
  evaluateCondition,
  loadSavedConditions,
  persistConditions,
  presetConditions,
  snapshotCondition,
  type ConditionRow,
  type LoadingCondition,
} from './conditions.js';
import { DisplacementChart, GzChart, StatTile, fmt, hydroTiles } from './charts.js';
import { BodyPlan, ProfileAndPlan, computeLines } from './lines.js';
import { HydroTable, LoadingTable } from './tables.js';
import { GzOverlay, KnChart, StrengthCharts, WeatherFigure } from './advanced.js';
import { ComparisonTable, ConditionManager } from './conditionsPanel.js';
import { FreeboardBreakdown, LoadLineMark } from './freeboardPanel.js';
import { ReportDoc } from './report.js';

type Module =
  | 'design'
  | 'lines'
  | 'hydro'
  | 'stability'
  | 'strength'
  | 'damage'
  | 'freeboard'
  | 'loading'
  | 'report';

const MODULES: { id: Module; label: string }[] = [
  { id: 'design', label: '設計' },
  { id: 'lines', label: '線図' },
  { id: 'hydro', label: '流体静力学' },
  { id: 'stability', label: '復原性' },
  { id: 'strength', label: '縦強度' },
  { id: 'damage', label: '損傷時' },
  { id: 'freeboard', label: '乾舷' },
  { id: 'loading', label: '積付' },
  { id: 'report', label: '帳票' },
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
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [solving, setSolving] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [kn, setKn] = useState<KnCurve[] | null>(null);
  const [knBusy, setKnBusy] = useState(false);
  /** heel inspection slider [deg]; null = show the solved equilibrium */
  const [inspect, setInspect] = useState<number | null>(null);
  const [strength, setStrength] = useState<StrengthResult | null>(null);
  const [strengthBusy, setStrengthBusy] = useState(false);
  /** flooded spaces (compartment/tank ids), permeability, cross-flood toggle */
  const [dmgSel, setDmgSel] = useState<string[]>(['comp:CH1']);
  const [dmgMu, setDmgMu] = useState(0.7);
  const [crossFlood, setCrossFlood] = useState(true);
  const [dmgResult, setDmgResult] = useState<L1Result | null>(null);
  /** pre-equalization state, shown when cross-flooding applies */
  const [dmgPre, setDmgPre] = useState<L1Result | null>(null);
  const [dmgBusy, setDmgBusy] = useState(false);
  // class-rule permissible values (editable, prefilled from UR S7/S11 defaults)
  const [perms, setPerms] = useState(() => {
    const env = ruleDefaults(initialModel());
    return { permHog: env.mPermHog, permSag: env.mPermSag, permShear: env.qPerm };
  });
  const [conditions, setConditions] = useState<LoadingCondition[]>(() => [
    ...presetConditions(initialModel()),
    ...loadSavedConditions(),
  ]);
  const [activeCondId, setActiveCondId] = useState<string | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const [cmpRows, setCmpRows] = useState<ConditionRow[] | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);

  const modelRef = useRef(model);
  modelRef.current = model;

  const cargoWeights = useMemo(
    (): WeightItem[] => cargoAsWeights(modelRef.current, cargo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cargo, model],
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

  // sea follows the module: the stability and damage effects below own the
  // attitude when they have a solution; everything else shows the level draft
  useEffect(() => {
    const solvedHere =
      (module === 'stability' && stability) || (module === 'damage' && dmgResult);
    if (!solvedHere) sceneRef.current?.setDraft(draft);
  }, [module, stability, dmgResult, draft, model]);

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
    setWeather(null);
    window.setTimeout(() => {
      try {
        const r = runStability(modelRef.current, cargoWeights);
        setStability(r);
        setWeather(runWeather(modelRef.current, r));
        setIssue(null);
      } catch (err) {
        setIssue(err instanceof Error ? err.message : String(err));
      } finally {
        setSolving(false);
      }
    }, 40);
  }, [cargoWeights]);

  const computeKn = useCallback(() => {
    setKnBusy(true);
    window.setTimeout(() => {
      try {
        setKn(runKnCurves(modelRef.current));
      } catch (err) {
        setIssue(err instanceof Error ? err.message : String(err));
      } finally {
        setKnBusy(false);
      }
    }, 40);
  }, []);

  const computeStrengthNow = useCallback(() => {
    setStrengthBusy(true);
    window.setTimeout(() => {
      try {
        setStrength(runStrengthCalc(modelRef.current, cargoWeights));
        setIssue(null);
      } catch (err) {
        setIssue(err instanceof Error ? err.message : String(err));
      } finally {
        setStrengthBusy(false);
      }
    }, 40);
  }, [cargoWeights]);

  const computeDamage = useCallback(() => {
    setDmgBusy(true);
    setDmgResult(null);
    setDmgPre(null);
    window.setTimeout(() => {
      try {
        const zones = zonesForSpaces(modelRef.current, dmgSel, dmgMu);
        if (!zones.length) throw new Error('浸水させる区画・タンクを選択してください');
        if (crossFlood && hasAsymmetricZone(zones)) {
          // pre-equalization first, then the equalized state that stands
          setDmgPre(runDamage(modelRef.current, cargoWeights, zones));
          setDmgResult(
            runDamage(modelRef.current, cargoWeights, withCrossFlooding(zones)),
          );
        } else {
          setDmgResult(runDamage(modelRef.current, cargoWeights, zones));
        }
        setIssue(null);
      } catch (err) {
        setIssue(err instanceof Error ? err.message : String(err));
      } finally {
        setDmgBusy(false);
      }
    }, 40);
  }, [cargoWeights, dmgSel, dmgMu, crossFlood]);

  // ---- loading conditions --------------------------------------------------
  const applyCond = useCallback((c: LoadingCondition) => {
    setModel((m) => applyCondition(m, c));
    setCargo(c.cargo);
    setActiveCondId(c.id);
  }, []);

  const saveCond = useCallback(
    (name: string) => {
      const snap = snapshotCondition(modelRef.current, cargo, name);
      setConditions((prev) => {
        const next = [...prev, snap];
        setStorageOk(persistConditions(next));
        return next;
      });
      setActiveCondId(snap.id);
    },
    [cargo],
  );

  const deleteCond = useCallback((id: string) => {
    setConditions((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setStorageOk(persistConditions(next));
      return next;
    });
    setActiveCondId((cur) => (cur === id ? null : cur));
  }, []);

  const freeboard = useMemo(() => {
    try {
      return runFreeboardCalc(model);
    } catch {
      return null; // hull outside the embedded Type B table range
    }
  }, [model]);

  const compareAll = useCallback(() => {
    setCmpBusy(true);
    setCmpRows(null);
    // evaluate sequentially so the UI can breathe between conditions
    const conds = [...conditions];
    const rows: ConditionRow[] = [];
    const step = (i: number) => {
      if (i >= conds.length) {
        setCmpRows(rows);
        setCmpBusy(false);
        return;
      }
      window.setTimeout(() => {
        try {
          rows.push(
            evaluateCondition(modelRef.current, conds[i], perms, freeboard?.summerDraft ?? null),
          );
        } catch (err) {
          setIssue(`条件「${conds[i].name}」の評価に失敗: ${err instanceof Error ? err.message : err}`);
        }
        step(i + 1);
      }, 30);
    };
    step(0);
  }, [conditions, perms, freeboard]);

  // a model or loading-condition change invalidates everything derived from it
  // (KN excepted on cargo changes: it is a hull property, independent of loading)
  useEffect(() => {
    setStability(null);
    setWeather(null);
    setStrength(null);
    setDmgResult(null);
    setDmgPre(null);
    setInspect(null);
    setCmpRows(null);
  }, [model, cargoWeights]);

  useEffect(() => {
    setKn(null);
  }, [model]);

  // entering a module auto-runs its main calculation when the inputs are ready;
  // the report also fills in the strength section so its numbers are complete
  useEffect(() => {
    if (module === 'strength' && !strength && !strengthBusy) computeStrengthNow();
    if ((module === 'stability' || module === 'report') && !stability && !solving) solve();
    if (module === 'report' && !strength && !strengthBusy) computeStrengthNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, stability, strength]);

  // 3D lever inspection: markers at the inspected (or equilibrium) heel
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (module !== 'stability' || !stability) {
      scene.setMarkers(null);
      return;
    }
    const state =
      inspect === null
        ? stability.equilibrium
        : inspectHeel(modelRef.current, cargoWeights, inspect);
    scene.setWaterAttitude({
      heelDeg: state.heelDeg,
      trimDeg: state.trimDeg,
      waterlineConstant: state.waterlineConstant,
    });
    scene.setMarkers({
      b: { x: state.lcb, y: state.tcb, z: state.kb },
      g: { x: state.lcg, y: state.tcg, z: state.kg },
      gz: state.gz,
      heelDeg: state.heelDeg,
      trimDeg: state.trimDeg,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, stability, inspect]);

  // flooded-zone visuals in the damage module
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (module !== 'damage') {
      scene.setDamageZone(null);
      return;
    }
    let zones = zonesForSpaces(model, dmgSel, dmgMu);
    if (crossFlood && hasAsymmetricZone(zones) && dmgResult) {
      zones = withCrossFlooding(zones);
    }
    scene.setDamageZone(zones);
    if (dmgResult) {
      const e = dmgResult.equilibrium;
      scene.setWaterAttitude({
        heelDeg: e.heelDeg,
        trimDeg: e.trimDeg,
        waterlineConstant: e.waterlineConstant,
      });
    }
  }, [module, dmgSel, dmgMu, crossFlood, dmgResult, model]);

  const selected = selectedId ? model.tanks.find((t) => t.id === selectedId) ?? null : null;
  const p = model.vessel.principal;
  const showViewport = module !== 'lines' && module !== 'report';
  const floodableSpaces = model.entities.filter(
    (e) => e.kind === 'compartment' || e.kind === 'tank',
  );
  const dmgLabel = dmgSel
    .map((id) => {
      const e = model.entities.find((x) => x.id === id);
      return (e?.data as { name?: string })?.name ?? id;
    })
    .join('、');
  const strengthEnvelopeCheck =
    strength && checkEnvelope(strength.stations, p.lpp, perms.permHog, perms.permSag, perms.permShear);
  const activeCondName =
    conditions.find((c) => c.id === activeCondId)?.name ?? '手動条件';

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
          {module === 'report' && (
            <div className="lines-board">
              <ReportDoc
                model={model}
                conditionName={activeCondName}
                cargo={cargoWeights}
                stability={stability}
                weather={weather}
                strength={strength}
                envelope={
                  strengthEnvelopeCheck
                    ? { check: strengthEnvelopeCheck, ...perms }
                    : null
                }
                freeboard={freeboard}
                damage={
                  dmgResult
                    ? {
                        zoneLabel: dmgLabel,
                        permeability: dmgMu,
                        result: dmgResult,
                      }
                    : null
                }
                onPrint={() => window.print()}
              />
            </div>
          )}
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
                  <label className="slider">
                    <span className="slider-head">
                      <span>傾斜検分 — B・G と GZ を 3D 表示</span>
                      <b className="num">
                        {inspect === null ? '釣合' : `${fmt(inspect, 0)}°`}
                      </b>
                    </span>
                    <input
                      type="range" min={0} max={60} step={1}
                      value={inspect ?? Math.round(Math.abs(stability.equilibrium.heelDeg))}
                      onChange={(e) => setInspect(Number(e.target.value))}
                    />
                  </label>
                  {inspect !== null && (
                    <button className="seg" onClick={() => setInspect(null)}>
                      釣合姿勢に戻す
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {module === 'strength' && (
            <section className="card">
              <h2>静水中縦強度</h2>
              {cargoFields}
              <button className="solve" onClick={computeStrengthNow} disabled={strengthBusy}>
                {strengthBusy ? '計算中…' : 'SF / BM を計算'}
              </button>
              {strength && (
                <>
                  <div className="stats">
                    <StatTile
                      label="最大せん断力"
                      value={fmt(Math.abs(strength.maxShear.value), 0)}
                      unit="t"
                      emphasis
                    />
                    <StatTile
                      label={strength.maxSagging.value >= Math.abs(strength.maxHogging.value) ? '最大サギング' : '最大ホギング'}
                      value={fmt(
                        Math.max(strength.maxSagging.value, Math.abs(strength.maxHogging.value)), 0,
                      )}
                      unit="t·m"
                      emphasis
                    />
                    <StatTile label="Q 位置" value={fmt(strength.maxShear.x, 1)} unit="m" />
                    <StatTile
                      label="M 位置"
                      value={fmt(
                        strength.maxSagging.value >= Math.abs(strength.maxHogging.value)
                          ? strength.maxSagging.x
                          : strength.maxHogging.x, 1,
                      )}
                      unit="m"
                    />
                  </div>
                  <p className="muted">
                    閉合残差 Q {fmt(strength.closure.shearResidual * 100, 2)}% ·
                    M {fmt(strength.closure.momentResidual * 100, 2)}%
                    (補正前、最大値比)。
                  </p>
                </>
              )}
            </section>
          )}

          {module === 'strength' && (
            <section className="card">
              <h2>許容値(クラス規則系)</h2>
              <div className="fields perm-fields">
                <label>
                  <span>許容サギング</span>
                  <input
                    type="number" step={500}
                    value={perms.permSag}
                    onChange={(e) => setPerms({ ...perms, permSag: Number(e.target.value) })}
                  />
                  <em>t·m</em>
                </label>
                <label>
                  <span>許容ホギング</span>
                  <input
                    type="number" step={500}
                    value={perms.permHog}
                    onChange={(e) => setPerms({ ...perms, permHog: Number(e.target.value) })}
                  />
                  <em>t·m</em>
                </label>
                <label>
                  <span>許容せん断力</span>
                  <input
                    type="number" step={50}
                    value={perms.permShear}
                    onChange={(e) => setPerms({ ...perms, permShear: Number(e.target.value) })}
                  />
                  <em>t</em>
                </label>
              </div>
              <button
                className="seg"
                onClick={() => {
                  const env = ruleDefaults(modelRef.current);
                  setPerms({ permHog: env.mPermHog, permSag: env.mPermSag, permShear: env.qPerm });
                }}
              >
                UR S7/S11 既定値に戻す
              </button>
              {strengthEnvelopeCheck && (
                <>
                  <div className={`verdict ${strengthEnvelopeCheck.passed ? 'ok' : 'bad'}`}>
                    <span className="verdict-mark" aria-hidden="true">
                      {strengthEnvelopeCheck.passed ? '✓' : '✗'}
                    </span>
                    <span>許容包絡線 {strengthEnvelopeCheck.passed ? '内' : '超過'}</span>
                  </div>
                  <div className="stats">
                    <StatTile
                      label="サギング利用率"
                      value={fmt(strengthEnvelopeCheck.saggingUtil * 100, 0)}
                      unit="%"
                      tone={strengthEnvelopeCheck.saggingUtil <= 1 ? 'ok' : 'bad'}
                    />
                    <StatTile
                      label="ホギング利用率"
                      value={fmt(strengthEnvelopeCheck.hoggingUtil * 100, 0)}
                      unit="%"
                      tone={strengthEnvelopeCheck.hoggingUtil <= 1 ? 'ok' : 'bad'}
                    />
                    <StatTile
                      label="せん断利用率"
                      value={fmt(strengthEnvelopeCheck.shearUtil * 100, 0)}
                      unit="%"
                      tone={strengthEnvelopeCheck.shearUtil <= 1 ? 'ok' : 'bad'}
                    />
                    <StatTile
                      label="最悪位置"
                      value={fmt(strengthEnvelopeCheck.worstMomentX, 1)}
                      unit="m"
                    />
                  </div>
                </>
              )}
              <p className="muted">
                既定値は IACS UR S7/S11 の波浪荷重と最小断面係数から導出
                (船体桁が規則最小要求で設計されたと仮定)。承認済み積付マニュアルの
                値があればここで上書きします。
              </p>
            </section>
          )}

          {module === 'freeboard' && freeboard && (
            <section className="card">
              <h2>乾舷と満載喫水線</h2>
              <div className="stats">
                <StatTile
                  label="夏期乾舷"
                  value={fmt(freeboard.summerFreeboard, 3)}
                  unit="m"
                  emphasis
                />
                <StatTile
                  label="夏期満載喫水"
                  value={fmt(freeboard.summerDraft, 3)}
                  unit="m"
                  emphasis
                />
                <StatTile label="熱帯" value={fmt(freeboard.tropicalDraft, 3)} unit="m" />
                <StatTile label="冬期" value={fmt(freeboard.winterDraft, 3)} unit="m" />
                <StatTile
                  label="FWA"
                  value={freeboard.fwa === null ? '—' : String(freeboard.fwa)}
                  unit="mm"
                />
                <StatTile
                  label="船首高さ"
                  value={fmt(freeboard.bowHeightActual, 2)}
                  unit="m"
                  tone={freeboard.bowHeightPassed ? 'ok' : 'bad'}
                />
              </div>
              {stability && (
                <div
                  className={`verdict ${
                    stability.equilibrium.draftMean <= freeboard.summerDraft ? 'ok' : 'bad'
                  }`}
                >
                  <span className="verdict-mark" aria-hidden="true">
                    {stability.equilibrium.draftMean <= freeboard.summerDraft ? '✓' : '✗'}
                  </span>
                  <span>
                    現条件 {fmt(stability.equilibrium.draftMean, 3)} m —{' '}
                    {stability.equilibrium.draftMean <= freeboard.summerDraft
                      ? `余裕 ${fmt(freeboard.summerDraft - stability.equilibrium.draftMean, 3)} m`
                      : `過積載 ${fmt(stability.equilibrium.draftMean - freeboard.summerDraft, 3)} m`}
                  </span>
                </div>
              )}
              {!stability && (
                <p className="muted">
                  現条件との照合には「復原性」モジュールで釣合を解いてください。
                </p>
              )}
            </section>
          )}

          {module === 'damage' && (
            <section className="card">
              <h2>損傷時復原性 — 喪失浮力法</h2>
              <div className="space-list" role="group" aria-label="浸水させる区画・タンク">
                {floodableSpaces.map((e) => {
                  const d = e.data as { name: string; x0: number; x1: number; y0?: number };
                  const isTank = e.kind === 'tank';
                  const on = dmgSel.includes(e.id);
                  return (
                    <label key={e.id} className={`space-row${on ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(ev) =>
                          setDmgSel((prev) =>
                            ev.target.checked
                              ? [...prev, e.id]
                              : prev.filter((x) => x !== e.id),
                          )
                        }
                      />
                      <span className="space-name">
                        {d.name}
                        {isTank && <em className="wing-tag">舷側</em>}
                      </span>
                      <span className="space-extent num">
                        x {d.x0}–{d.x1}
                      </span>
                    </label>
                  );
                })}
              </div>
              <label className="slider">
                <span className="slider-head">
                  <span>浸水率 μ</span>
                  <b className="num">{fmt(dmgMu * 100, 0)}%</b>
                </span>
                <input
                  type="range" min={0.4} max={1} step={0.05}
                  value={dmgMu}
                  onChange={(e) => setDmgMu(Number(e.target.value))}
                />
              </label>
              <label className="clip-toggle">
                <input
                  type="checkbox"
                  checked={crossFlood}
                  onChange={(e) => setCrossFlood(e.target.checked)}
                />
                <span>クロスフラッディング(左右均圧管で対称化)</span>
              </label>
              <button className="solve" onClick={computeDamage} disabled={dmgBusy}>
                {dmgBusy ? '解いています…' : '損傷時釣合を解く'}
              </button>
              {dmgPre && dmgResult && (
                <div className="equalize-note">
                  <span className="tag">均圧効果</span>
                  <span className="num">
                    横傾斜 {fmt(dmgPre.equilibrium.heelDeg, 1)}° → {fmt(dmgResult.equilibrium.heelDeg, 1)}°
                  </span>
                  <span className="num muted-inline">
                    (平均喫水 {fmt(dmgPre.equilibrium.draftMean, 2)} → {fmt(dmgResult.equilibrium.draftMean, 2)} m)
                  </span>
                </div>
              )}
              {dmgResult && (
                <>
                  <div className={`verdict ${dmgResult.gm0 > 0.05 && dmgResult.gzMax > 0.1 ? 'ok' : 'bad'}`}>
                    <span className="verdict-mark" aria-hidden="true">
                      {dmgResult.gm0 > 0.05 && dmgResult.gzMax > 0.1 ? '✓' : '✗'}
                    </span>
                    <span>
                      残存復原性 {dmgResult.gm0 > 0.05 && dmgResult.gzMax > 0.1 ? '確保' : '不足'}
                      (参考: GM&gt;0.05 m かつ GZmax&gt;0.1 m)
                    </span>
                  </div>
                  <div className="stats">
                    <StatTile
                      label="損傷時 GM₀" value={fmt(dmgResult.gm0, 3)} unit="m" emphasis
                      tone={dmgResult.gm0 > 0.05 ? 'ok' : 'bad'}
                    />
                    <StatTile
                      label="損傷時最大 GZ" value={fmt(dmgResult.gzMax, 3)} unit="m" emphasis
                      tone={dmgResult.gzMax > 0.1 ? 'ok' : 'bad'}
                    />
                    <StatTile label="船尾喫水" value={fmt(dmgResult.equilibrium.draftAP, 3)} unit="m" />
                    <StatTile label="船首喫水" value={fmt(dmgResult.equilibrium.draftFP, 3)} unit="m" />
                    <StatTile label="トリム 船尾" value={fmt(dmgResult.equilibrium.trimByStern, 3)} unit="m" />
                    <StatTile label="平均喫水" value={fmt(dmgResult.equilibrium.draftMean, 3)} unit="m" />
                  </div>
                </>
              )}
              <p className="muted">
                喪失浮力法: 排水量・重心は非損傷のまま、浸水範囲の浮力と水線面を
                (1 − μ)に低減して釣合を解き直します。
              </p>
            </section>
          )}

          {module === 'report' && (
            <section className="card">
              <h2>計算書</h2>
              <p className="muted">
                現在の積付条件から計算書を組み立てます。復原性は自動計算されます。
                縦強度・損傷時・KN 曲線は各モジュールで計算すると本書に載ります。
              </p>
              <button className="solve" onClick={() => window.print()}>
                印刷 / PDF 保存
              </button>
            </section>
          )}

          {module === 'loading' && (
            <>
              <ConditionManager
                conditions={conditions}
                activeId={activeCondId}
                busy={cmpBusy}
                storageOk={storageOk}
                onApply={applyCond}
                onSaveCurrent={saveCond}
                onDelete={deleteCond}
                onCompare={compareAll}
              />
              <section className="card">
                <h2>貨物</h2>
                {cargoFields}
                <p className="muted">
                  タンクの充填率は「設計」モジュール、または上の条件の適用で
                  変わります。ここで組んだ条件が全モジュールの解析に使われます。
                </p>
              </section>
            </>
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
          {weather?.applicable ? (
            <WeatherFigure gz={stability.gz} weather={weather} />
          ) : (
            weather && (
              <section className="card">
                <h2>気象基準</h2>
                <p className="muted">評価不能: {weather.reason}</p>
              </section>
            )
          )}
          <section className="card">
            <h2>KN 交差曲線</h2>
            {kn ? (
              <KnChart curves={kn} />
            ) : (
              <>
                <p className="muted">
                  排水量 × 傾斜角の交差曲線(KN)。任意の条件の GZ は
                  GZ = KN − KG·sinφ で得られます。42 回の自由トリム釣合解を伴います。
                </p>
                <button className="solve" onClick={computeKn} disabled={knBusy}>
                  {knBusy ? '計算中…(数秒)' : 'KN 曲線を計算'}
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {module === 'strength' && strength && (
        <div className="detail strength-detail">
          <StrengthCharts result={strength} lpp={p.lpp} envelope={perms} />
        </div>
      )}
      {module === 'freeboard' && freeboard && (
        <div className="detail">
          <LoadLineMark
            fb={freeboard}
            depth={p.depth}
            currentDraft={stability?.equilibrium.draftMean ?? null}
          />
          <FreeboardBreakdown fb={freeboard} />
        </div>
      )}
      {module === 'damage' && dmgResult && (
        <div className="detail">
          <GzOverlay intact={stability?.gz ?? null} damaged={dmgResult.gz} />
          <section className="card">
            <h2>損傷時判定の考え方</h2>
            <p className="muted">
              浸水区画「{dmgLabel}」を浸水率 μ = {fmt(dmgMu * 100, 0)}% で解放し、
              喪失浮力法で釣合を解き直しました。舷側タンクの浸水は非対称で、船は損傷側へ
              傾斜します。クロスフラッディングを有効にすると均圧管で左右対称化された
              最終状態を解き、均圧前後の横傾斜を併記します。参考判定は SOLAS 系の
              残存復原性の目安(GM &gt; 0.05 m・GZmax &gt; 0.1 m)であり、正式な
              区画基準の適用は対象船種の規則によります。
            </p>
          </section>
        </div>
      )}
      {module === 'loading' && (
        <div className="detail">
          {cmpRows && <ComparisonTable rows={cmpRows} summerDraft={freeboard?.summerDraft ?? null} />}
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
