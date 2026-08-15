/**
 * 計算書 — the deliverable document. Screen shows it in the workspace theme;
 * printing swaps to a light, ink-on-paper stylesheet (see @media print).
 */

import type {
  EnvelopeCheck,
  FreeboardResult,
  GrainResult,
  L1Result,
  StrengthResult,
  SubdivisionResult,
  WeatherResult,
  WeightItem,
} from '@dock/shared';
import { fmt } from './charts.js';
import { GzChart } from './charts.js';
import { LoadingTable } from './tables.js';
import { WeatherFigure } from './advanced.js';
import type { Model } from './store.js';

export function ReportDoc(props: {
  model: Model;
  conditionName: string;
  cargo: WeightItem[];
  stability: L1Result | null;
  weather: WeatherResult | null;
  strength: StrengthResult | null;
  envelope: { check: EnvelopeCheck; permHog: number; permSag: number; permShear: number } | null;
  freeboard: FreeboardResult | null;
  damage: { zoneLabel: string; permeability: number; result: L1Result } | null;
  grain: GrainResult | null;
  subdivision: SubdivisionResult | null;
  onPrint: () => void;
}) {
  const { model, stability, weather, strength, envelope, freeboard, damage } = props;
  const p = model.vessel.principal;
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="report-doc">
      <header className="report-head">
        <div>
          <p className="report-eyebrow">復原性・縦強度計算書</p>
          <h2 className="report-title">{model.vessel.name}</h2>
          <p className="report-meta">
            積付条件: {props.conditionName} · Digital Dock v12 により作成 · {today} ·
            海水密度 ρ = {model.vessel.rhoWater} t/m³
          </p>
        </div>
        <button className="solve print-btn" onClick={props.onPrint}>
          印刷 / PDF 保存
        </button>
      </header>

      <section className="report-sec">
        <h3>1. 主要目</h3>
        <table className="eng report-table">
          <tbody>
            <tr><td className="txt">垂線間長 Lpp</td><td>{p.lpp} m</td>
                <td className="txt">型幅 B</td><td>{p.beam} m</td></tr>
            <tr><td className="txt">型深さ D</td><td>{p.depth} m</td>
                <td className="txt">計画喫水 d</td><td>{p.designDraft} m</td></tr>
            <tr><td className="txt">軽荷重量</td><td>{fmt(model.vessel.lightship!.mass, 0)} t</td>
                <td className="txt">軽荷重心 LCG / VCG</td>
                <td>{fmt(model.vessel.lightship!.lcg, 1)} / {fmt(model.vessel.lightship!.vcg, 1)} m</td></tr>
          </tbody>
        </table>
      </section>

      <section className="report-sec">
        <h3>2. 積付条件</h3>
        <LoadingTable model={model} cargo={props.cargo} />
      </section>

      {stability && (
        <section className="report-sec">
          <h3>3. 釣合状態と非損傷時復原性</h3>
          <table className="eng report-table">
            <tbody>
              <tr>
                <td className="txt">排水量</td><td>{fmt(stability.equilibrium.displacement, 0)} t</td>
                <td className="txt">喫水 AP / FP</td>
                <td>{fmt(stability.equilibrium.draftAP)} / {fmt(stability.equilibrium.draftFP)} m</td>
              </tr>
              <tr>
                <td className="txt">トリム(船尾)</td><td>{fmt(stability.equilibrium.trimByStern, 3)} m</td>
                <td className="txt">横傾斜</td><td>{fmt(stability.equilibrium.heelDeg, 2)} °</td>
              </tr>
              <tr>
                <td className="txt">GM₀(自由表面修正後)</td><td>{fmt(stability.gm0, 3)} m</td>
                <td className="txt">最大 GZ / 生起角</td>
                <td>{fmt(stability.gzMax, 3)} m / {fmt(stability.gzMaxAngleDeg, 1)} °</td>
              </tr>
            </tbody>
          </table>
          <GzChart result={stability} />
          <table className="eng report-table criteria-print">
            <thead>
              <tr>
                <th className="txt">IMO IS Code 2008 基準</th>
                <th>実績</th><th>要求</th><th>余裕</th><th>判定</th>
              </tr>
            </thead>
            <tbody>
              {stability.criteria.map((c) => (
                <tr key={c.id}>
                  <td className="txt">{c.description}({c.reference})</td>
                  <td>{fmt(c.actual, 3)} {c.unit}</td>
                  <td>{fmt(c.required, 3)}</td>
                  <td>{c.margin >= 0 ? '+' : ''}{fmt(c.margin, 3)}</td>
                  <td className={c.passed ? 'v-ok' : 'v-bad'}>{c.passed ? '適合' : '不適合'}</td>
                </tr>
              ))}
              {weather?.applicable && (
                <tr>
                  <td className="txt">気象基準 b ≥ a(A/2.3)</td>
                  <td>b/a = {Number.isFinite(weather.ratio) ? fmt(weather.ratio, 2) : '∞'}</td>
                  <td>≥ 1.00</td>
                  <td>{Number.isFinite(weather.ratio) ? fmt(weather.ratio - 1, 2) : '—'}</td>
                  <td className={weather.passed ? 'v-ok' : 'v-bad'}>{weather.passed ? '適合' : '不適合'}</td>
                </tr>
              )}
              {props.grain && (
                <tr>
                  <td className="txt">穀類復原性(Grain Code: 傾斜・残存面積・GM)</td>
                  <td>
                    θg {props.grain.heelAngleDeg === null ? '—' : fmt(props.grain.heelAngleDeg, 1) + '°'} ·{' '}
                    {fmt(props.grain.residualArea, 3)} m·rad
                  </td>
                  <td>≤12° · ≥0.075</td>
                  <td>—</td>
                  <td className={props.grain.passed ? 'v-ok' : 'v-bad'}>
                    {props.grain.passed ? '適合' : '不適合'}
                  </td>
                </tr>
              )}
              {props.subdivision && (
                <tr>
                  <td className="txt">確率論的区画指標(簡易 p × Reg 7-2 s)</td>
                  <td>A = {fmt(props.subdivision.attained, 3)}</td>
                  <td>R = {fmt(props.subdivision.required, 3)}</td>
                  <td>{fmt(props.subdivision.attained - props.subdivision.required, 3)}</td>
                  <td className={props.subdivision.passed ? 'v-ok' : 'v-bad'}>
                    {props.subdivision.passed ? '適合' : '不適合'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {weather?.applicable && stability && (
        <section className="report-sec">
          <h3>4. 気象基準の詳細</h3>
          <WeatherFigure gz={stability.gz} weather={weather} />
          <p className="report-note">
            風圧面積 {fmt(weather.windage.area, 0)} m²(中心 水線上 {fmt(weather.windage.centroidAboveWl, 2)} m)、
            定常風てこ lw1 = {fmt(weather.lw1, 4)} m、突風てこ lw2 = {fmt(weather.lw2, 4)} m。
            横揺れ角 φ1 = {fmt(weather.phi1, 1)}°
            (X1 = {fmt(weather.factors.x1, 2)}, X2 = {fmt(weather.factors.x2, 2)},
            r = {fmt(weather.factors.r, 3)}, s = {fmt(weather.factors.s, 3)},
            横揺れ周期 {fmt(weather.rollPeriod, 1)} s)。
          </p>
        </section>
      )}

      {strength && (
        <section className="report-sec">
          <h3>5. 静水中縦強度</h3>
          <table className="eng report-table">
            <tbody>
              <tr>
                <td className="txt">最大せん断力</td>
                <td>{fmt(Math.abs(strength.maxShear.value), 0)} t(x = {fmt(strength.maxShear.x, 1)} m)</td>
                <td className="txt">最大サギング</td>
                <td>{fmt(strength.maxSagging.value, 0)} t·m(x = {fmt(strength.maxSagging.x, 1)} m)</td>
              </tr>
              <tr>
                <td className="txt">最大ホギング</td>
                <td>{fmt(Math.abs(strength.maxHogging.value), 0)} t·m(x = {fmt(strength.maxHogging.x, 1)} m)</td>
                <td className="txt">積分閉合残差</td>
                <td>Q {fmt(strength.closure.shearResidual * 100, 2)}% · M {fmt(strength.closure.momentResidual * 100, 2)}%</td>
              </tr>
            </tbody>
          </table>
          {envelope && (
            <table className="eng report-table">
              <tbody>
                <tr>
                  <td className="txt">許容包絡線(サギング / ホギング / せん断)</td>
                  <td>
                    {fmt(envelope.permSag, 0)} / {fmt(envelope.permHog, 0)} t·m ·{' '}
                    {fmt(envelope.permShear, 0)} t
                  </td>
                  <td className="txt">利用率(最悪)</td>
                  <td className={envelope.check.passed ? 'v-ok' : 'v-bad'}>
                    {fmt(
                      Math.max(
                        envelope.check.saggingUtil,
                        envelope.check.hoggingUtil,
                        envelope.check.shearUtil,
                      ) * 100, 0,
                    )}
                    % — {envelope.check.passed ? '包絡線内' : '超過'}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="report-note">
            軽荷重量は全長台形分布(質量・LCG 厳密一致)、タンク液は各タンク範囲に均等分布、
            貨物は Lpp/20 の設置幅で分布。浮力は自由トリム釣合姿勢での断面積分布。
            許容値は IACS UR S7/S11 系の既定値(編集可)。
          </p>
        </section>
      )}

      {freeboard && (
        <section className="report-sec">
          <h3>{damage ? '7' : '6'}. 乾舷(ILLC 1966 · Type B)</h3>
          <table className="eng report-table">
            <tbody>
              <tr>
                <td className="txt">夏期乾舷 / 夏期満載喫水</td>
                <td>{fmt(freeboard.summerFreeboard, 3)} / {fmt(freeboard.summerDraft, 3)} m</td>
                <td className="txt">熱帯 / 冬期喫水</td>
                <td>{fmt(freeboard.tropicalDraft, 3)} / {fmt(freeboard.winterDraft, 3)} m</td>
              </tr>
              <tr>
                <td className="txt">淡水許容量 FWA</td>
                <td>{freeboard.fwa === null ? '—' : `${freeboard.fwa} mm`}</td>
                <td className="txt">船首高さ(実 / 要求)</td>
                <td className={freeboard.bowHeightPassed ? 'v-ok' : 'v-bad'}>
                  {fmt(freeboard.bowHeightActual, 2)} / {fmt(freeboard.bowHeightRequired, 2)} m —{' '}
                  {freeboard.bowHeightPassed ? '適合' : '不適合'}
                </td>
              </tr>
              {stability && (
                <tr>
                  <td className="txt">現条件平均喫水</td>
                  <td>{fmt(stability.equilibrium.draftMean, 3)} m</td>
                  <td className="txt">夏期満載までの余裕</td>
                  <td
                    className={
                      stability.equilibrium.draftMean <= freeboard.summerDraft ? 'v-ok' : 'v-bad'
                    }
                  >
                    {fmt(freeboard.summerDraft - stability.equilibrium.draftMean, 3)} m
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {damage && (
        <section className="report-sec">
          <h3>6. 損傷時復原性(喪失浮力法)</h3>
          <table className="eng report-table">
            <tbody>
              <tr>
                <td className="txt">浸水区画</td><td>{damage.zoneLabel}</td>
                <td className="txt">浸水率 μ</td><td>{fmt(damage.permeability * 100, 0)} %</td>
              </tr>
              <tr>
                <td className="txt">損傷時喫水 AP / FP</td>
                <td>{fmt(damage.result.equilibrium.draftAP)} / {fmt(damage.result.equilibrium.draftFP)} m</td>
                <td className="txt">損傷時 GM₀ / 最大 GZ</td>
                <td>{fmt(damage.result.gm0, 3)} m / {fmt(damage.result.gzMax, 3)} m</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <footer className="report-foot">
        <p>
          計算法: 断面は区分線形オフセットの厳密積分、船長方向はシンプソン則。
          釣合は浮力と重量の鉛直共線条件(自由トリム)。スラックタンクは実液面移動
          (四面体分割による箱・平面の厳密交差)。本書の数値はすべて本ページ内の
          計算エンジンによる。
        </p>
      </footer>
    </div>
  );
}
