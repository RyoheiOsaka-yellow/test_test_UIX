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
import { GRADE_LABELS_JA, GRADE_ORDER, GRADE_THRESHOLDS, alignScores, gradeFromSeverity, optionScores } from './grading'
import { simulateObjectDecision } from './decisionEngine'

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
    /** 連続量の計測（充填量など）。計測プロファイルのみ */
    measurement?: { key: string; value: number; target: number; tolerance: number; confidence: number; tilt_deg: number }
    /** 状態解析（転倒検知・横断歩道監視）。状態解析プロファイルのみ */
    scene?: { state: string; level: string; score: number; hold_seconds: number; confidence: number; features: Record<string, number> }
    /** 複数フレームで集めた証拠の要約 */
    evidence?: { samples: number; median: number; spread: number; stability: number; recent_reject_rate: number }
  }
  options: readonly ObjectDecision[]
  /** 判断とは別に返してほしい 5 段階グレードの定義（Jev はこの尺度で grade を返す） */
  grading: { scale: readonly string[]; labels: Record<string, string>; thresholds: Record<string, number> }
}

export interface JevLineRequest {
  task: string
  level: 'line'
  state: {
    reject_rate: number
    /** 直近ウィンドウのグレード B（許容）率 */
    marginal_rate: number
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
  /** 5 段階グレード（A〜E）。Jev が返せる場合のみ */
  grade?: string
  /** 異常度 0..1。Jev が返せる場合のみ */
  severity?: number
  /** 提示した選択肢ごとのスコア。Jev が返せる場合のみ */
  option_scores?: Record<string, number>
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
    const optionScoresRaw =
      json.option_scores && typeof json.option_scores === 'object'
        ? Object.fromEntries(Object.entries(json.option_scores).filter(([, v]) => typeof v === 'number') as Array<[string, number]>)
        : undefined
    return {
      result: {
        decision: json.decision as T,
        confidence,
        reason: json.reason,
        grade: typeof json.grade === 'string' ? json.grade.toUpperCase() : undefined,
        severity: typeof json.severity === 'number' ? json.severity : undefined,
        option_scores: optionScoresRaw,
      },
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
        ...(state.measurement
          ? {
              measurement: {
                key: state.measurement.key,
                value: round(state.measurement.value),
                target: round(state.measurement.target),
                tolerance: round(state.measurement.tolerance),
                confidence: round(state.measurement.confidence),
                tilt_deg: round(state.measurement.tiltDeg),
              },
            }
          : {}),
        ...(state.scene
          ? {
              scene: {
                state: state.scene.state,
                level: state.scene.level,
                score: round(state.scene.score),
                hold_seconds: round(state.scene.holdSeconds),
                confidence: round(state.scene.confidence),
                features: Object.fromEntries(Object.entries(state.scene.features).map(([k, v]) => [k, round(v)])),
              },
            }
          : {}),
        ...(state.evidence
          ? {
              evidence: {
                samples: state.evidence.samples,
                median: round(state.evidence.median),
                spread: round(state.evidence.spread),
                stability: round(state.evidence.stability),
                recent_reject_rate: round(state.evidence.recentRejectRate),
              },
            }
          : {}),
      },
      options,
      grading: { scale: GRADE_ORDER, labels: GRADE_LABELS_JA, thresholds: GRADE_THRESHOLDS },
    }
    const { result, latencyMs } = await postDecision(body, options)
    let decision = result.decision
    let reason = result.reason ?? 'JEV_DECISION'
    if (result.confidence < 0.65 && decision !== 'HUMAN_REVIEW' && options.includes('HUMAN_REVIEW')) {
      decision = 'HUMAN_REVIEW'
      reason = 'JEV_UNCERTAIN'
    }
    // グレード・異常度・選択肢スコアは Jev が返せばそれを使い、無ければ同じ証拠からローカル規則で補う
    const local = simulateObjectDecision(state, options)
    const severity = typeof result.severity === 'number' ? Math.min(1, Math.max(0, result.severity)) : local.severity
    const grade = result.grade && (GRADE_ORDER as readonly string[]).includes(result.grade) ? (result.grade as DecisionResult['grade']) : gradeFromSeverity(severity)
    const scores = result.option_scores
      ? alignScores(Object.fromEntries(Object.entries(result.option_scores).filter(([k]) => options.includes(k as ObjectDecision))) as Partial<Record<ObjectDecision, number>>, decision)
      : alignScores(optionScores(severity, state.evidence?.stability ?? 0.7, options), decision)
    return {
      decision,
      confidence: result.confidence,
      reason,
      grade,
      severity,
      optionScores: scores,
      evidence: local.evidence,
      latencyMs,
      engine: 'jev',
      action: actionFor(decision),
    }
  }

  async decideLine(state: LineState, options: readonly LineDecision[]): Promise<LineDecisionResult> {
    const body: JevLineRequest = {
      task: this.task,
      level: 'line',
      state: {
        reject_rate: round(state.rejectRate),
        marginal_rate: round(state.marginalRate ?? 0),
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
      grade: result.grade && (GRADE_ORDER as readonly string[]).includes(result.grade) ? (result.grade as LineDecisionResult['grade']) : undefined,
      latencyMs,
      engine: 'jev',
    }
  }
}

const round = (v: number) => Math.round(v * 1000) / 1000

export const jevDecisionEngine = new JevDecisionEngine()
