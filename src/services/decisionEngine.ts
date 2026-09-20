import type {
  DecisionEngine,
  DecisionResult,
  InspectionState,
  LineDecision,
  LineDecisionResult,
  LineState,
  ObjectDecision,
} from '@/types/inspection'
import { jevDecisionEngine, isJevConfigured } from './jevDecisionEngine'
import { actionFor } from './decisionActions'

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
 * Rule-based object decision. Thresholds are on the inspected attribute's confidence
 * (cap / label / component presence):
 *   >= 0.75         PASS
 *   0.45 .. 0.75    RECHECK
 *   0.20 .. 0.45    HUMAN_REVIEW
 *   <  0.20         REJECT
 * A low decision confidence (< 0.65) always resolves to HUMAN_REVIEW ("JEV UNCERTAIN").
 */
export function simulateObjectDecision(
  state: InspectionState,
  options: readonly ObjectDecision[],
): Omit<DecisionResult, 'latencyMs' | 'engine'> {
  const cap = clamp01(state.attributeConfidence)
  const bottle = clamp01(state.objectConfidence)
  const align = state.alignmentScore ?? 1
  const recheckRound = state.previousFailures ?? 0

  let decision: ObjectDecision
  let confidence: number
  let reason: string

  if (state.scene) {
    // 状態解析（転倒検知・横断歩道監視）: 解析の水準と確からしさから通報の要否を決める
    const p = state.scene
    if (p.confidence < 0.3) {
      decision = 'HUMAN_REVIEW'
      confidence = clamp01(0.5 + p.confidence)
      reason = 'SCENE_UNCERTAIN'
    } else if (p.level === 'alert' && p.score >= 0.6) {
      decision = 'REJECT'
      confidence = clamp01(0.7 + 0.3 * p.score) * (0.8 + 0.2 * p.confidence)
      reason = 'SCENE_ALERT'
    } else if (p.level !== 'normal' || p.score >= 0.4) {
      decision = recheckRound >= 1 ? 'HUMAN_REVIEW' : 'RECHECK'
      confidence = clamp01(0.55 + 0.3 * p.score)
      reason = 'SCENE_WATCH'
    } else {
      decision = 'PASS'
      confidence = clamp01(0.85 + 0.15 * (1 - p.score))
      reason = 'SCENE_NORMAL'
    }
    if (!options.includes(decision)) decision = options.includes('HUMAN_REVIEW') ? 'HUMAN_REVIEW' : options[0]
    return { decision, confidence, reason, action: actionFor(decision) }
  }

  if (state.measurement) {
    // 連続量の計測（充填量など）: 目標からのずれを許容幅の倍数で評価する
    const m = state.measurement
    const dev = (m.value - m.target) / Math.max(1e-6, m.tolerance)
    const ad = Math.abs(dev)
    if (!state.inspectionZone) {
      decision = 'RECHECK'
      confidence = 0.5
      reason = 'OUTSIDE_INSPECTION_ZONE'
    } else if (m.confidence < 0.35) {
      decision = 'HUMAN_REVIEW'
      confidence = clamp01(0.5 + m.confidence * 0.4)
      reason = 'MEASUREMENT_UNCERTAIN'
    } else if (ad <= 1) {
      decision = 'PASS'
      confidence = clamp01((0.75 + 0.25 * (1 - ad)) * (0.7 + 0.3 * m.confidence))
      reason = 'FILL_OK'
    } else if (ad <= 2 && recheckRound < 1) {
      decision = 'RECHECK'
      confidence = clamp01(0.6 + 0.2 * (2 - ad))
      reason = 'FILL_MARGINAL'
    } else if (ad <= 2) {
      decision = ad <= 1.3 ? 'PASS' : 'HUMAN_REVIEW'
      confidence = decision === 'PASS' ? 0.68 : 0.62
      reason = decision === 'PASS' ? 'FILL_OK_AFTER_RECHECK' : 'FILL_MARGINAL_AFTER_RECHECK'
    } else {
      decision = 'REJECT'
      confidence = clamp01((0.75 + 0.25 * Math.min(1, (ad - 2) / 2)) * (0.7 + 0.3 * m.confidence))
      reason = dev < 0 ? 'UNDERFILL' : 'OVERFILL'
    }
    if (!options.includes(decision)) decision = options.includes('HUMAN_REVIEW') ? 'HUMAN_REVIEW' : options[0]
    return { decision, confidence, reason, action: actionFor(decision) }
  }

  if (!state.inspectionZone) {
    decision = 'RECHECK'
    confidence = 0.5
    reason = 'OUTSIDE_INSPECTION_ZONE'
  } else if (cap >= ATTRIBUTE_THRESHOLDS.pass) {
    decision = 'PASS'
    // confidence grows with distance from the threshold, tempered by bottle confidence
    confidence = 0.7 + 0.3 * ((cap - ATTRIBUTE_THRESHOLDS.pass) / (1 - ATTRIBUTE_THRESHOLDS.pass))
    confidence *= 0.9 + 0.1 * bottle
    reason = align < 0.6 ? 'ATTR_OK_ALIGNMENT_LOW' : 'ATTR_OK'
  } else if (cap >= ATTRIBUTE_THRESHOLDS.recheck) {
    // Recheck band. After one recheck round, escalate instead of looping forever.
    if (recheckRound >= 1) {
      decision = cap >= 0.6 ? 'PASS' : 'HUMAN_REVIEW'
      confidence = decision === 'PASS' ? 0.68 : 0.62
      reason = decision === 'PASS' ? 'ATTR_OK_AFTER_RECHECK' : 'ATTR_AMBIGUOUS_AFTER_RECHECK'
    } else {
      decision = 'RECHECK'
      confidence = 0.6 + 0.3 * ((cap - ATTRIBUTE_THRESHOLDS.recheck) / (ATTRIBUTE_THRESHOLDS.pass - ATTRIBUTE_THRESHOLDS.recheck))
      reason = align < 0.6 ? 'ATTR_MISALIGNED' : 'ATTR_LOW_CONFIDENCE'
    }
  } else if (cap >= ATTRIBUTE_THRESHOLDS.humanReview) {
    decision = 'HUMAN_REVIEW'
    confidence = 0.5 + 0.2 * (1 - (cap - ATTRIBUTE_THRESHOLDS.humanReview) / (ATTRIBUTE_THRESHOLDS.recheck - ATTRIBUTE_THRESHOLDS.humanReview))
    reason = 'ATTR_AMBIGUOUS'
  } else {
    decision = 'REJECT'
    confidence = 0.8 + 0.2 * (1 - cap / ATTRIBUTE_THRESHOLDS.humanReview)
    confidence *= 0.9 + 0.1 * bottle
    reason = 'ATTR_MISSING'
  }

  confidence = clamp01(confidence)

  // Uncertainty guard: never act automatically on a low-confidence decision.
  if (confidence < UNCERTAINTY_THRESHOLD && decision !== 'HUMAN_REVIEW' && decision !== 'RECHECK') {
    decision = 'HUMAN_REVIEW'
    reason = 'JEV_UNCERTAIN'
  }
  if (!options.includes(decision)) {
    decision = options.includes('HUMAN_REVIEW') ? 'HUMAN_REVIEW' : options[0]
    reason = 'OPTION_NOT_OFFERED'
  }

  return { decision, confidence, reason, action: actionFor(decision) }
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
  } else {
    decision = 'NORMAL'
    confidence = clamp01(0.9 - Math.max(0, excess))
    reason = 'WITHIN_TOLERANCE'
  }
  if (!options.includes(decision)) decision = options[0]
  return { decision, confidence, reason }
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
