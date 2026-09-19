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

export const CAP_THRESHOLDS = {
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
 * Rule-based object decision. Thresholds are on cap confidence:
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
  const cap = clamp01(state.capConfidence)
  const bottle = clamp01(state.bottleConfidence)
  const align = state.alignmentScore ?? 1
  const recheckRound = state.previousFailures ?? 0

  let decision: ObjectDecision
  let confidence: number
  let reason: string

  if (!state.inspectionZone) {
    decision = 'RECHECK'
    confidence = 0.5
    reason = 'OUTSIDE_INSPECTION_ZONE'
  } else if (cap >= CAP_THRESHOLDS.pass) {
    decision = 'PASS'
    // confidence grows with distance from the threshold, tempered by bottle confidence
    confidence = 0.7 + 0.3 * ((cap - CAP_THRESHOLDS.pass) / (1 - CAP_THRESHOLDS.pass))
    confidence *= 0.9 + 0.1 * bottle
    reason = align < 0.6 ? 'CAP_OK_ALIGNMENT_LOW' : 'CAP_OK'
  } else if (cap >= CAP_THRESHOLDS.recheck) {
    // Recheck band. After one recheck round, escalate instead of looping forever.
    if (recheckRound >= 1) {
      decision = cap >= 0.6 ? 'PASS' : 'HUMAN_REVIEW'
      confidence = decision === 'PASS' ? 0.68 : 0.62
      reason = decision === 'PASS' ? 'CAP_OK_AFTER_RECHECK' : 'CAP_AMBIGUOUS_AFTER_RECHECK'
    } else {
      decision = 'RECHECK'
      confidence = 0.6 + 0.3 * ((cap - CAP_THRESHOLDS.recheck) / (CAP_THRESHOLDS.pass - CAP_THRESHOLDS.recheck))
      reason = align < 0.6 ? 'CAP_MISALIGNED' : 'CAP_LOW_CONFIDENCE'
    }
  } else if (cap >= CAP_THRESHOLDS.humanReview) {
    decision = 'HUMAN_REVIEW'
    confidence = 0.5 + 0.2 * (1 - (cap - CAP_THRESHOLDS.humanReview) / (CAP_THRESHOLDS.recheck - CAP_THRESHOLDS.humanReview))
    reason = 'CAP_AMBIGUOUS'
  } else {
    decision = 'REJECT'
    confidence = 0.8 + 0.2 * (1 - cap / CAP_THRESHOLDS.humanReview)
    confidence *= 0.9 + 0.1 * bottle
    reason = 'CAP_MISSING'
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
