import type {
  DecisionEngine,
  DecisionResult,
  EvidenceItem,
  InspectionState,
  LineDecision,
  LineDecisionResult,
  LineState,
  ObjectDecision,
} from '@/types/inspection'
import { jevDecisionEngine, isJevConfigured } from './jevDecisionEngine'
import { actionFor } from './decisionActions'
import {
  alignScores,
  getGradeThresholds,
  attributeSeverity,
  composeConfidence,
  decisionForGrade,
  decisionMargin,
  gradeFromSeverity,
  measurementSeverity,
  optionScores,
  sceneSeverity,
} from './grading'

export { actionFor }

/**
 * Decision adapter.
 *
 * Phase 1 ships a rule-based SIMULATION engine that mirrors the contract of the
 * Jev engine exactly: structured state in, one of the offered options out, with
 * a confidence, a reason code and a latency. `createDecisionEngine()` picks the
 * Jev adapter when a TYPESAFE_API_KEY is configured and falls back to
 * simulation otherwise (and on any Jev failure at runtime).
 */

/** Below this confidence the engine is considered uncertain and defers to a human. */
export const UNCERTAINTY_THRESHOLD = 0.65

export const ATTRIBUTE_THRESHOLDS = {
  pass: 0.75,
  recheck: 0.45,
  humanReview: 0.2,
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Pseudo latency so the UI shows a realistic decision-latency KPI. */
function simulatedLatency(): number {
  return 42 + Math.random() * 70
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * 模擬エンジンの物体判断。
 *
 * 1. 証拠を 1 本の「異常度」0..1 に写像する（属性信頼度 / 計測のずれ / 場面スコア / 面積比）
 * 2. 異常度から 5 段階グレード A〜E を決める
 * 3. グレードに応じた処置を選ぶ（A/B 合格・C 再検査・D 人の確認・E 不良）
 * 4. 確信度 = 処置境界からの余裕 × 複数フレーム証拠の安定度 × 物体信頼度
 *    確信度 < 0.65 の自動処置は必ず人の確認へ（JEV UNCERTAIN）
 * 5. 提示した選択肢ごとのスコアと根拠一覧を返す
 */
export function simulateObjectDecision(
  state: InspectionState,
  options: readonly ObjectDecision[],
): Omit<DecisionResult, 'latencyMs' | 'engine'> {
  const bottle = clamp01(state.objectConfidence)
  const align = state.alignmentScore ?? 1
  const recheckRound = state.previousFailures ?? 0
  const ev = state.evidence
  const stability = ev ? ev.stability : 0.7
  const evidence: EvidenceItem[] = []

  let severity: number
  let decision: ObjectDecision
  let confidence: number
  let reason: string

  const finish = (): Omit<DecisionResult, 'latencyMs' | 'engine'> => {
    severity = clamp01(severity)
    const grade = gradeFromSeverity(severity)
    confidence = clamp01(confidence)
    // 不確実性ガード: 確信度の低い自動処置はしない
    if (confidence < UNCERTAINTY_THRESHOLD && decision !== 'HUMAN_REVIEW' && decision !== 'RECHECK') {
      decision = 'HUMAN_REVIEW'
      reason = 'JEV_UNCERTAIN'
    }
    if (!options.includes(decision)) {
      decision = options.includes('HUMAN_REVIEW') ? 'HUMAN_REVIEW' : options[0]
      reason = 'OPTION_NOT_OFFERED'
    }
    if (ev) {
      evidence.push({ key: 'samples', label: '証拠フレーム数', value: ev.samples, digits: 0 })
      evidence.push({ key: 'stability', label: '証拠の安定度', value: ev.stability, digits: 2, weight: 1 - ev.stability })
      if (ev.recentRejectRate > 0) evidence.push({ key: 'recent_reject_rate', label: `直近の不良率（文脈）`, value: ev.recentRejectRate * 100, unit: '%', digits: 1 })
    }
    evidence.push({ key: 'object_confidence', label: '物体信頼度', value: bottle, digits: 2 })
    evidence.push({ key: 'margin', label: '処置境界からの余裕', value: decisionMargin(severity), digits: 2 })
    const scores = alignScores(optionScores(severity, stability, options), decision)
    return { decision, confidence, reason, grade, severity, optionScores: scores, evidence, action: actionFor(decision) }
  }

  if (state.scene) {
    // 状態解析（転倒検知・横断歩道監視）: 解析の水準と確からしさから通報の要否を決める
    const p = state.scene
    severity = sceneSeverity(p.level, p.score)
    evidence.push({ key: 'scene_score', label: '異常スコア', value: p.score, digits: 2, weight: severity })
    evidence.push({ key: 'hold', label: '状態の継続', value: p.holdSeconds, unit: '秒', digits: 1 })
    evidence.push({ key: 'scene_confidence', label: '解析の確からしさ', value: p.confidence, digits: 2 })
    const grade = gradeFromSeverity(severity)
    if (p.confidence < 0.3) {
      decision = 'HUMAN_REVIEW'
      confidence = clamp01(0.5 + p.confidence)
      reason = 'SCENE_UNCERTAIN'
    } else {
      decision = decisionForGrade(grade, recheckRound)
      confidence = composeConfidence(severity, stability, bottle, p.confidence)
      reason = grade === 'E' ? 'SCENE_ALERT' : grade === 'D' ? 'SCENE_CAUTION' : grade === 'C' ? 'SCENE_WATCH' : 'SCENE_NORMAL'
    }
    return finish()
  }

  if (state.measurement) {
    // 連続量の計測（充填量など）: 目標からのずれを許容幅の倍数で評価する
    const m = state.measurement
    const dev = (m.value - m.target) / Math.max(1e-6, m.tolerance)
    const ad = Math.abs(dev)
    severity = measurementSeverity(ad)
    evidence.push({ key: 'measurement', label: '計測値', value: m.value * 100, unit: '%', digits: 1 })
    evidence.push({ key: 'deviation', label: '目標からのずれ', value: dev, unit: '×許容幅', digits: 2, weight: severity })
    evidence.push({ key: 'measurement_confidence', label: '計測信頼度', value: m.confidence, digits: 2 })
    if (Math.abs(m.tiltDeg) >= 1) evidence.push({ key: 'tilt', label: '液面の傾き', value: m.tiltDeg, unit: '°', digits: 1 })
    const grade = gradeFromSeverity(severity)
    if (!state.inspectionZone) {
      decision = 'RECHECK'
      confidence = 0.5
      reason = 'OUTSIDE_INSPECTION_ZONE'
    } else if (m.confidence < 0.35) {
      decision = 'HUMAN_REVIEW'
      confidence = clamp01(0.5 + m.confidence * 0.4)
      reason = 'MEASUREMENT_UNCERTAIN'
    } else if (grade === 'C' && recheckRound >= 1) {
      // 再計測後も境界域: 境界に近く安定していれば合格、そうでなければ人の確認
      const nearPass = severity < getGradeThresholds().C + 0.06 && stability >= 0.6
      decision = nearPass ? 'PASS' : 'HUMAN_REVIEW'
      confidence = nearPass ? 0.68 : 0.62
      reason = nearPass ? 'FILL_OK_AFTER_RECHECK' : 'FILL_MARGINAL_AFTER_RECHECK'
    } else {
      decision = decisionForGrade(grade, recheckRound)
      confidence = composeConfidence(severity, stability, bottle, m.confidence)
      reason =
        grade === 'A' ? 'FILL_OK'
        : grade === 'B' ? 'FILL_OK_MARGINAL'
        : grade === 'C' ? 'FILL_MARGINAL'
        : grade === 'D' ? 'FILL_DEVIATION'
        : dev < 0 ? 'UNDERFILL' : 'OVERFILL'
    }
    return finish()
  }

  // 属性の有無（キャップ・ラベル・部品）/ 面積重症度: 複数フレームの中央値を優先する
  const cap = clamp01(ev && ev.samples >= 3 ? ev.median : state.attributeConfidence)
  severity = attributeSeverity(cap)
  evidence.push({ key: 'attribute', label: ev && ev.samples >= 3 ? '属性信頼度（中央値）' : '属性信頼度', value: cap, digits: 2, weight: severity })
  if (ev && ev.samples >= 3) evidence.push({ key: 'spread', label: 'フレーム間のばらつき', value: ev.spread, digits: 3 })
  evidence.push({ key: 'alignment', label: '位置の整合', value: align, digits: 2, weight: align < 0.6 ? 0.3 : 0 })
  const grade = gradeFromSeverity(severity)

  if (!state.inspectionZone) {
    decision = 'RECHECK'
    confidence = 0.5
    reason = 'OUTSIDE_INSPECTION_ZONE'
  } else if (ev && ev.samples >= 5 && ev.stability < 0.25 && grade !== 'E') {
    // 証拠が大きくばらつく: 中央値がどこにあっても人に見せる
    decision = recheckRound >= 1 ? 'HUMAN_REVIEW' : 'RECHECK'
    confidence = clamp01(0.55 + 0.1 * ev.stability)
    reason = 'EVIDENCE_UNSTABLE'
  } else if (grade === 'C' && recheckRound >= 1) {
    const nearPass = severity < getGradeThresholds().C + 0.08 && stability >= 0.5
    decision = nearPass ? 'PASS' : 'HUMAN_REVIEW'
    confidence = nearPass ? 0.68 : 0.62
    reason = nearPass ? 'ATTR_OK_AFTER_RECHECK' : 'ATTR_AMBIGUOUS_AFTER_RECHECK'
  } else {
    decision = decisionForGrade(grade, recheckRound)
    confidence = composeConfidence(severity, stability, bottle)
    reason =
      grade === 'A' ? (align < 0.6 ? 'ATTR_OK_ALIGNMENT_LOW' : 'ATTR_OK')
      : grade === 'B' ? (align < 0.6 ? 'ATTR_OK_ALIGNMENT_LOW' : 'ATTR_OK_MARGINAL')
      : grade === 'C' ? (align < 0.6 ? 'ATTR_MISALIGNED' : 'ATTR_LOW_CONFIDENCE')
      : grade === 'D' ? 'ATTR_AMBIGUOUS'
      : 'ATTR_MISSING'
  }
  return finish()
}

/** Rule-based line decision over a rolling window. */
export function simulateLineDecision(
  state: LineState,
  options: readonly LineDecision[],
): Omit<LineDecisionResult, 'latencyMs' | 'engine'> {
  const { rejectRate, normalRate, cameraConfidence } = state
  const excess = rejectRate - normalRate
  let decision: LineDecision
  let confidence: number
  let reason: string

  if (cameraConfidence < 0.7) {
    decision = 'HUMAN_REVIEW'
    confidence = 0.6 + 0.3 * (1 - cameraConfidence)
    reason = 'CAMERA_CONFIDENCE_LOW'
  } else if (rejectRate >= 0.3) {
    decision = 'STOP_LINE'
    confidence = clamp01(0.75 + excess)
    reason = 'REJECT_RATE_CRITICAL'
  } else if (rejectRate >= 0.18) {
    decision = 'SLOW_LINE'
    confidence = clamp01(0.7 + excess)
    reason = 'REJECT_RATE_HIGH'
  } else if (rejectRate >= normalRate * 2 && rejectRate >= 0.08) {
    decision = 'WATCH'
    confidence = clamp01(0.65 + excess)
    reason = 'REJECT_RATE_ELEVATED'
  } else if ((state.marginalRate ?? 0) >= 0.35) {
    // 不良率はまだ基準内でも、合格の多くが「許容（B）」= 余裕小なら兆候として注視する
    decision = 'WATCH'
    confidence = clamp01(0.6 + 0.4 * Math.min(1, ((state.marginalRate ?? 0) - 0.35) / 0.3))
    reason = 'MARGINAL_RATE_ELEVATED'
  } else {
    decision = 'NORMAL'
    confidence = clamp01(0.9 - Math.max(0, excess))
    reason = 'WITHIN_TOLERANCE'
  }
  if (!options.includes(decision)) decision = options[0]
  // ライン全体のグレード: 不良率を異常度へ（基準率で B、0.18 で D、0.30 で E）
  const T = getGradeThresholds()
  let severity = clamp01(
    rejectRate <= normalRate ? (rejectRate / Math.max(1e-6, normalRate)) * T.B
    : rejectRate <= 0.18 ? T.B + ((rejectRate - normalRate) / (0.18 - normalRate)) * (T.D - T.B)
    : rejectRate <= 0.3 ? T.D + ((rejectRate - 0.18) / 0.12) * (T.E - T.D)
    : T.E + ((rejectRate - 0.3) / 0.3) * (1 - T.E),
  )
  // 許容率が高いときはライン全体のグレードも 1 段悪い側へ寄せる（最大で C 帯まで）
  if (reason === 'MARGINAL_RATE_ELEVATED') severity = Math.max(severity, T.C + 0.02)
  return { decision, confidence, reason, grade: gradeFromSeverity(severity) }
}

export class SimulationDecisionEngine implements DecisionEngine {
  readonly kind = 'simulation' as const

  async decideObject(state: InspectionState, options: readonly ObjectDecision[]): Promise<DecisionResult> {
    const latencyMs = simulatedLatency()
    await sleep(latencyMs)
    return { ...simulateObjectDecision(state, options), latencyMs, engine: 'simulation' }
  }

  async decideLine(state: LineState, options: readonly LineDecision[]): Promise<LineDecisionResult> {
    const latencyMs = simulatedLatency()
    await sleep(latencyMs)
    return { ...simulateLineDecision(state, options), latencyMs, engine: 'simulation' }
  }
}

/** Wraps the Jev adapter with automatic fallback to simulation. */
class FallbackDecisionEngine implements DecisionEngine {
  readonly kind = 'jev' as const
  private primary: DecisionEngine
  private fallback: DecisionEngine
  private failures = 0
  onFallback?: (error: unknown) => void

  constructor(primary: DecisionEngine, fallback: DecisionEngine) {
    this.primary = primary
    this.fallback = fallback
  }

  async decideObject(state: InspectionState, options: readonly ObjectDecision[]): Promise<DecisionResult> {
    try {
      const r = await this.primary.decideObject(state, options)
      this.failures = 0
      return r
    } catch (err) {
      this.failures++
      this.onFallback?.(err)
      return this.fallback.decideObject(state, options)
    }
  }

  async decideLine(state: LineState, options: readonly LineDecision[]): Promise<LineDecisionResult> {
    try {
      return await this.primary.decideLine(state, options)
    } catch (err) {
      this.onFallback?.(err)
      return this.fallback.decideLine(state, options)
    }
  }
}

export const simulationDecisionEngine = new SimulationDecisionEngine()

export function createDecisionEngine(onFallback?: (error: unknown) => void): DecisionEngine {
  if (isJevConfigured()) {
    const engine = new FallbackDecisionEngine(jevDecisionEngine, simulationDecisionEngine)
    engine.onFallback = onFallback
    return engine
  }
  return simulationDecisionEngine
}
