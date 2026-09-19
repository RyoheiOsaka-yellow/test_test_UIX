/**
 * Core domain types for the JEV Visual Inspection prototype.
 *
 * Architecture:
 *   VIDEO → OBJECT DETECTION → STRUCTURED EVENTS → JEV DECISION ENGINE → ACTION → DASHBOARD
 *
 * Everything that crosses a layer boundary is typed here so that the CV layer,
 * the decision layer and the dashboard can be swapped independently.
 */

// ---------------------------------------------------------------------------
// Computer Vision layer
// ---------------------------------------------------------------------------

/**
 * 検知クラス。OK / NG は「検査属性（キャップ・ラベル・部品など）が有る / 無い」を表す汎用クラスで、
 * 表示名は検査プロファイルが与える。以下の拡張クラスは将来用（フェーズ1では無効）。
 */
export type DetectionClass =
  | 'OK'
  | 'NG'
  | 'LOW_CAP'
  | 'MISALIGNED_CAP'
  | 'DAMAGED_CAP'
  | 'NO_LABEL'
  | 'LABEL_MISALIGNED'
  | 'DEFORMED_BOTTLE'
  | 'FOREIGN_OBJECT'

export const ENABLED_CLASSES: readonly DetectionClass[] = ['OK', 'NG']

/** Normalized bounding box: [x, y, width, height], each in 0..1 of the frame. */
export type NormalizedBBox = [x: number, y: number, width: number, height: number]

/**
 * One keyframe of the mock detection timeline (`/public/demo/detections.json`).
 * Multiple entries with the same `id` form a track; the simulator interpolates
 * between them. This is the contract a real tracker (ByteTrack / SORT) would
 * emit per frame.
 */
export interface RawDetection {
  /** Video time in seconds. */
  time: number
  /** Stable track id. */
  id: number
  bbox: NormalizedBBox
  /** 'object' = 物体のみ検出（検査属性は未判定。シナリオ側で割り当て）。'capped' / 'uncapped' は互換用。 */
  class: 'object' | 'bottle' | 'ok' | 'ng' | 'capped' | 'uncapped' | Lowercase<DetectionClass>
  /** Class confidence 0..1 (confidence of the reported class). */
  confidence: number
  /** Optional: explicit bottle-presence confidence. Defaults to ~0.95. */
  bottle_confidence?: number
  /** Optional: 検査属性の信頼度。無ければ class + confidence から導出。 */
  attribute_confidence?: number
  /** Optional: 位置ずれスコア 0..1 */
  alignment_score?: number
}

/** A per-frame detection produced by the CV layer (real or simulated). */
export interface FrameDetection {
  trackId: number
  /** Display id, e.g. "#014". */
  label: string
  bbox: NormalizedBBox
  detectionClass: DetectionClass
  /** Confidence of the reported class, 0..1. */
  classConfidence: number
  /** 物体そのものの検出信頼度 */
  objectConfidence: number
  /** 検査属性（キャップ / ラベル / 部品）の信頼度 */
  attributeConfidence: number
  alignmentScore: number
  /** Center x in normalized coordinates. */
  centerX: number
  /** Lifecycle phase from the tracker's point of view. */
  phase: TrackPhase
  /** Final decision, once the object crossed the gate. */
  decision?: DecisionResult
  /** Video time at which the object crossed the gate. */
  gateTime?: number
}

export type TrackPhase = 'ENTERING' | 'TRACKED' | 'INSPECTING' | 'DECIDED' | 'EXITED'

// ---------------------------------------------------------------------------
// Decision layer (Jev)
// ---------------------------------------------------------------------------

/**
 * Structured state handed to the decision engine. Never natural language:
 * the engine is asked to choose among explicit options, not "what should we do?".
 */
export interface InspectionState {
  objectId: string
  objectConfidence: number
  attributeConfidence: number
  alignmentScore?: number
  inspectionZone: boolean
  /** Number of prior RECHECK rounds on this object. */
  previousFailures?: number
  /** Previous state of the object as seen by the engine. */
  previousState?: 'normal' | 'recheck' | 'unknown'
}

export type ObjectDecision = 'PASS' | 'RECHECK' | 'REJECT' | 'HUMAN_REVIEW'

export const OBJECT_DECISION_OPTIONS: readonly ObjectDecision[] = [
  'PASS',
  'RECHECK',
  'REJECT',
  'HUMAN_REVIEW',
]

export type DecisionEngineKind = 'simulation' | 'jev'

export interface DecisionResult {
  decision: ObjectDecision
  /** Engine's confidence in the decision, 0..1. */
  confidence: number
  /** Machine-readable reason code, e.g. CAP_MISSING, CAP_OK, JEV_UNCERTAIN. */
  reason: string
  latencyMs: number
  engine: DecisionEngineKind
  /** Action derived from the decision (simulated in Phase 1; never touches a PLC). */
  action: string
}

/** Second-level (line) decision. */
export interface LineState {
  rejectRate: number
  normalRate: number
  cameraConfidence: number
  lineSpeedBpm: number
  previousFailures: number
  windowSeconds: number
}

export type LineDecision = 'NORMAL' | 'WATCH' | 'SLOW_LINE' | 'STOP_LINE' | 'HUMAN_REVIEW'

export const LINE_DECISION_OPTIONS: readonly LineDecision[] = [
  'NORMAL',
  'WATCH',
  'SLOW_LINE',
  'STOP_LINE',
  'HUMAN_REVIEW',
]

export interface LineDecisionResult {
  decision: LineDecision
  confidence: number
  reason: string
  latencyMs: number
  engine: DecisionEngineKind
}

/** Adapter contract. Swap the simulation engine for the Jev API without touching the UI. */
export interface DecisionEngine {
  readonly kind: DecisionEngineKind
  decideObject(state: InspectionState, options: readonly ObjectDecision[]): Promise<DecisionResult>
  decideLine(state: LineState, options: readonly LineDecision[]): Promise<LineDecisionResult>
}

// ---------------------------------------------------------------------------
// Event layer
// ---------------------------------------------------------------------------

export type InspectionEventType =
  | 'OBJECT_ENTERED'
  | 'OBJECT_TRACKED'
  | 'INSPECTION_STARTED'
  | 'ATTRIBUTE_CONFIDENCE'
  | 'INSPECTION_COMPLETED'
  | 'PASS'
  | 'RECHECK'
  | 'REJECT'
  | 'HUMAN_REVIEW'
  | 'EJECT_TRIGGERED'
  | 'ALERT'
  | 'LINE_DECISION'
  | 'OBJECT_EXITED'
  | 'HUMAN_OVERRIDE'
  | 'SYSTEM'

export type EventSeverity = 'info' | 'ok' | 'warn' | 'error'

export interface InspectionEvent {
  seq: number
  type: InspectionEventType
  /** Wall-clock timestamp, ms since epoch. */
  timestamp: number
  /** Video time in seconds, if the event is tied to playback. */
  videoTime?: number
  objectId?: string
  message: string
  severity: EventSeverity
  data?: Record<string, unknown>
}

/** Recorded inspection (what would be persisted to PostgreSQL / TimescaleDB). */
export interface InspectionRecord {
  timestamp: string
  objectId: string
  vision: { object: number; attribute: number; alignment: number }
  decision: { result: ObjectDecision; confidence: number; reason: string; engine: DecisionEngineKind }
  action: string
  latencyMs: number
  /** Set when a human overrode the automated decision. */
  humanOverride?: ObjectDecision
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export type ScenarioId =
  | 'normal'
  | 'high_reject'
  | 'sensor_noise'
  | 'cap_misalignment'
  | 'confidence_drop'
  | 'line_congestion'

export interface ScenarioDefinition {
  id: ScenarioId
  name: string
  description: string
  /** 属性が欠けている（NG）物体の割合 */
  ngRate: number
  /** 位置ずれ（再検査帯）の割合 */
  misalignedRate: number
  /** 判定不能（要確認帯）の割合 */
  ambiguousRate: number
  /** Extra per-frame jitter in bbox and confidence, 0..1. */
  noise: number
  /** Mean spacing between bottles in seconds. */
  spacingSeconds: number
  /** Optional global camera confidence multiplier over time (seconds → 0..1). */
  cameraConfidence?: (time: number) => number
  /** Anomaly alert threshold (reject rate over rolling window). */
  alertRejectRate: number
}

// ---------------------------------------------------------------------------
// Overlay / UI settings
// ---------------------------------------------------------------------------

export interface OverlaySettings {
  overlay: boolean
  boundingBox: boolean
  confidence: boolean
  trackingId: boolean
  inspectionGate: boolean
  jevDecision: boolean
}

export type PlaybackRate = 0.5 | 1 | 2

export type VideoSource =
  | { kind: 'video'; url: string }
  | { kind: 'placeholder' }

// ---------------------------------------------------------------------------
// 検査プロファイル（物体・検査属性・トリガー・映像をひとまとめにした設定）
// ---------------------------------------------------------------------------

export type GateAxis = 'x' | 'y'

export type InspectionTrigger =
  | {
      /** 流れる物体がゲート線を横切った瞬間に判定 */
      kind: 'gate'
      axis: GateAxis
      /** 正規化座標でのゲート位置 */
      position: number
      /** +1: 座標が増える向きに流れる（左→右 / 上→下）、-1: 逆 */
      direction: 1 | -1
      /** 検査ゾーンの半幅 */
      zoneHalfWidth: number
    }
  | {
      /** 据え置きの作業ステーション: ゾーン内に一定時間とどまったら判定 */
      kind: 'zone'
      rect: NormalizedBBox
      dwellSeconds: number
    }

export const DEFAULT_GATE: InspectionTrigger = { kind: 'gate', axis: 'x', position: 0.5, direction: 1, zoneHalfWidth: 0.06 }

export interface InspectionProfile {
  id: string
  /** 表示名（例: ボトルキャップ検査） */
  name: string
  lineName: string
  cameraName: string
  /** 物体の表示名（ボトル / 小包 / 基板） */
  objectLabel: string
  /** 検査属性の表示名（キャップ / 配送ラベル / 部品実装） */
  attributeLabel: string
  alignmentLabel: string
  okLabel: string
  ngLabel: string
  /** 理由コード → 表示文 */
  reasons: Record<string, string>
  /** 不良時の処置（表示） */
  rejectAction: string
  /** 「位置ずれ」シナリオの名前 */
  misalignedScenarioName: string
  /** Jev へ送る task 名と項目名 */
  jevTask: string
  objectKey: string
  attributeKey: string
  trigger: InspectionTrigger
  /** public/demo/<dir>/ に video.mp4 / detections.json / CREDIT.txt を置く */
  mediaDir: string
  /** 検出器の説明（表示用） */
  detectorNote: string
  triggerLabel: string
}
