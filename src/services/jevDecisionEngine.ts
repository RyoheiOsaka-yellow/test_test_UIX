import type {
  DecisionEngine,
  DecisionResult,
  InspectionState,
  LineDecision,
  LineDecisionResult,
  LineState,
  ObjectDecision,
} from '@/types/inspection'
import { actionFor } from './decisionActions'

/**
 * Jev API adapter (MODE B: REAL JEV MODE).
 *
 * Active only when TYPESAFE_API_KEY is present in the server environment. The
 * browser never sees the key: requests go to `/api/jev/decide`, which the Vite
 * dev server (or a production proxy) forwards with the credential attached.
 *
 * Design principle enforced here: Jev is NOT a chatbot. We send a structured
 * state and an explicit, closed set of options, and expect a structured
 * `{ decision, confidence, reason }` back. No free-form questions, ever.
 */

export function isJevConfigured(): boolean {
  return typeof __JEV_KEY_PRESENT__ !== 'undefined' && __JEV_KEY_PRESENT__ === true
}

export interface JevObjectRequest {
  /** 検査プロファイルごとのタスク名（例: bottle_cap_inspection / parcel_label_inspection） */
  task: string
  level: 'object'
  state: {
    object_type: string
    object_id: string
    /** 検査属性のキー（cap / shipping_label / component） */
    attribute: string
    object_confidence: number
    attribute_confidence: number
    alignment_score: number
    inspection_zone: boolean
    previous_failures: number
    previous_state: string
  }
  options: readonly ObjectDecision[]
}

export interface JevLineRequest {
  task: string
  level: 'line'
  state: {
    reject_rate: number
    normal_rate: number
    camera_confidence: number
    line_speed_bpm: number
    previous_failures: number
    window_seconds: number
  }
  options: readonly LineDecision[]
}

export interface JevResponse<T extends string> {
  decision: T
  confidence: number
  reason?: string
}

const ENDPOINT = '/api/jev/decide'
const TIMEOUT_MS = 2500

async function postDecision<T extends string>(
  body: JevObjectRequest | JevLineRequest,
  allowed: readonly T[],
): Promise<{ result: JevResponse<T>; latencyMs: number }> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Jev API ${res.status}`)
    const json = (await res.json()) as Partial<JevResponse<T>>
    if (typeof json.decision !== 'string' || !allowed.includes(json.decision as T)) {
      throw new Error(`Jev returned an option that was not offered: ${String(json.decision)}`)
    }
    const confidence = typeof json.confidence === 'number' ? json.confidence : 0
    return {
      result: { decision: json.decision as T, confidence, reason: json.reason },
      latencyMs: performance.now() - started,
    }
  } finally {
    clearTimeout(timer)
  }
}

export class JevDecisionEngine implements DecisionEngine {
  readonly kind = 'jev' as const
  /** 現在の検査プロファイル（task 名と項目名に使う） */
  task = 'bottle_cap_inspection'
  objectKey = 'bottle'
  attributeKey = 'cap'

  setProfile(p: { jevTask: string; objectKey: string; attributeKey: string }) {
    this.task = p.jevTask
    this.objectKey = p.objectKey
    this.attributeKey = p.attributeKey
  }

  async decideObject(state: InspectionState, options: readonly ObjectDecision[]): Promise<DecisionResult> {
    const body: JevObjectRequest = {
      task: this.task,
      level: 'object',
      state: {
        object_type: this.objectKey,
        object_id: state.objectId,
        attribute: this.attributeKey,
        object_confidence: round(state.objectConfidence),
        attribute_confidence: round(state.attributeConfidence),
        alignment_score: round(state.alignmentScore ?? 1),
        inspection_zone: state.inspectionZone,
        previous_failures: state.previousFailures ?? 0,
        previous_state: state.previousState ?? 'normal',
      },
      options,
    }
    const { result, latencyMs } = await postDecision(body, options)
    let decision = result.decision
    let reason = result.reason ?? 'JEV_DECISION'
    if (result.confidence < 0.65 && decision !== 'HUMAN_REVIEW' && options.includes('HUMAN_REVIEW')) {
      decision = 'HUMAN_REVIEW'
      reason = 'JEV_UNCERTAIN'
    }
    return { decision, confidence: result.confidence, reason, latencyMs, engine: 'jev', action: actionFor(decision) }
  }

  async decideLine(state: LineState, options: readonly LineDecision[]): Promise<LineDecisionResult> {
    const body: JevLineRequest = {
      task: this.task,
      level: 'line',
      state: {
        reject_rate: round(state.rejectRate),
        normal_rate: round(state.normalRate),
        camera_confidence: round(state.cameraConfidence),
        line_speed_bpm: Math.round(state.lineSpeedBpm),
        previous_failures: state.previousFailures,
        window_seconds: state.windowSeconds,
      },
      options,
    }
    const { result, latencyMs } = await postDecision(body, options)
    return {
      decision: result.decision,
      confidence: result.confidence,
      reason: result.reason ?? 'JEV_DECISION',
      latencyMs,
      engine: 'jev',
    }
  }
}

const round = (v: number) => Math.round(v * 1000) / 1000

export const jevDecisionEngine = new JevDecisionEngine()
