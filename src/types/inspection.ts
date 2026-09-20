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
  class: 'object' | 'bottle' | 'ok' | 'ng' | 'capped' | 'uncapped' | 'person' | 'car' | 'bicycle' | 'motorcycle' | 'bus' | 'truck' | Lowercase<DetectionClass>
  /** Class confidence 0..1 (confidence of the reported class). */
  confidence: number
  /** Optional: explicit bottle-presence confidence. Defaults to ~0.95. */
  bottle_confidence?: number
  /** Optional: 検査属性の信頼度。無ければ class + confidence から導出。 */
  attribute_confidence?: number
  /** Optional: 位置ずれスコア 0..1 */
  alignment_score?: number
  /** Optional: 骨格キーポイント（COCO 17 点 × [x, y, conf]、正規化） */
  keypoints?: number[]
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
  /** 連続量の計測結果（充填量など）。計測プロファイルのみ */
  measurement?: MeasurementReading
  /** 骨格キーポイント（COCO 17 点 × [x, y, conf]、正規化）。人物プロファイルのみ */
  keypoints?: number[]
  /** 状態解析の結果（転倒検知・横断歩道監視）。状態解析プロファイルのみ */
  personState?: StateReading
  /** 物体クラス（person / car など。複数クラスのプロファイルのみ） */
  objectClass?: string
  /** 判定前の暫定グレード（検査中に色を変えるため） */
  provisionalGrade?: Grade
  /** 暫定の異常度 0..1 */
  liveSeverity?: number
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
export interface MeasurementReading {
  /** 計測値（充填率など、0..1） */
  value: number
  /** 計測の確からしさ 0..1 */
  confidence: number
  /** 傾き補正に使った液面の角度 [deg] */
  tiltDeg: number
  /** 合成映像のときだけ分かる真値（誤差表示用） */
  truth?: number
}

/** 状態解析（転倒検知・横断歩道監視など）の 1 物体分の結果 */
export interface StateReading {
  /** 状態コード（NORMAL / FALLING / FALLEN, WAITING / CROSSING / CLEAR など） */
  state: string
  stateLabel: string
  /** 正常 / 注意 / 警報 */
  level: 'normal' | 'watch' | 'alert'
  /** 異常スコア 0..1 */
  score: number
  /** 現在の状態の継続時間 [s] */
  holdSeconds: number
  /** 解析の確からしさ 0..1 */
  confidence: number
  /** 表示用の特徴量 */
  features: Array<{ key: string; label: string; value: number; unit?: string; digits?: number }>
  /** 補足（例: 接近車両の追跡番号） */
  note?: string
}

/** 互換名（転倒検知） */
export type PersonStateReading = StateReading

export interface MeasurementSpec {
  /** Jev へ送る項目名（fill_level など） */
  key: string
  label: string
  unit: string
  /** 目標値 0..1 */
  target: number
  /** 許容幅 0..1（±） */
  tolerance: number
  /** 画素解析の方式（既定: 液面） */
  method?: 'fill-level' | 'ripeness'
}

export interface InspectionState {
  objectId: string
  objectConfidence: number
  attributeConfidence: number
  alignmentScore?: number
  /** 連続量の計測（充填量など）。あれば判断はこちらを優先する */
  measurement?: { key: string; value: number; target: number; tolerance: number; confidence: number; tiltDeg: number; truth?: number }
  /** 状態解析（転倒検知・横断歩道監視）。あれば判断はこちらを優先する */
  scene?: { state: string; level: 'normal' | 'watch' | 'alert'; score: number; holdSeconds: number; confidence: number; features: Record<string, number> }
  /** 複数フレームで集めた証拠（検査ゾーン内の属性サンプル） */
  evidence?: {
    samples: number
    /** 属性信頼度（または計測値）の中央値 */
    median: number
    /** p10〜p90 の幅。大きいほど不安定 */
    spread: number
    /** 0..1（1 = 安定） */
    stability: number
    /** 直近のライン不良率（文脈） */
    recentRejectRate: number
  }
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

/** 5 段階グレード（A 良好 → E 不良）。判断（処置）とは独立した評価軸 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E'

/** 判断の根拠 1 件 */
export interface EvidenceItem {
  key: string
  label: string
  value: number
  unit?: string
  digits?: number
  /** 異常度への寄与（0..1、表示用） */
  weight?: number
}

export type DecisionEngineKind = 'simulation' | 'jev'

export interface DecisionResult {
  decision: ObjectDecision
  /** Engine's confidence in the decision, 0..1. */
  confidence: number
  /** 5 段階グレード */
  grade: Grade
  /** 異常度 0..1（グレードの元になった連続量） */
  severity: number
  /** 提示した選択肢ごとのスコア（合計 1）。エンジンが返せる場合のみ */
  optionScores?: Partial<Record<ObjectDecision, number>>
  /** 判断の根拠 */
  evidence?: EvidenceItem[]
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
  /** 直近ウィンドウでグレード B（許容 = 合格だが余裕小）だった割合。兆候の指標 */
  marginalRate?: number
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
  /** ライン全体のグレード */
  grade?: Grade
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
  decision: { result: ObjectDecision; confidence: number; reason: string; engine: DecisionEngineKind; grade?: Grade; severity?: number }
  /** 連続量の計測（充填量など） */
  measurement?: { key: string; value: number; target: number; tolerance: number; truth?: number }
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
  | {
      /** 状態遷移: 物体（人物）の状態が異常（転倒）と確定したら判定。ゲート無し */
      kind: 'state'
      /** 異常状態がこの秒数続いたら判定を確定する */
      confirmSeconds: number
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
  /** 連続量を実測するプロファイル（充填量など）。無ければ属性の有無を疑似注入する */
  measurement?: MeasurementSpec
  /** 動画が無いときに描く合成映像の種類（none: 映像なしの表示） */
  syntheticFeed?: 'bottles' | 'filling' | 'none'
  /** 状態解析の種類（trigger.kind === 'state' のとき） */
  analyzer?: 'fall' | 'crosswalk'
  /** 横断歩道監視: ゾーンの多角形（正規化座標） */
  zones?: Array<{ id: string; label: string; kind: 'crosswalk' | 'waiting' | 'near' | 'road'; polygon: Array<[number, number]> }>
  /** 物体クラスの表示名（person → 歩行者 など） */
  classLabels?: Record<string, string>
  /** 判断コードの表示名を差し替える（例: REJECT → 転倒 警報） */
  decisionLabels?: Partial<Record<ObjectDecision, string>>
  /** 損傷の重症度を検出枠の面積から決める（路面損傷スキャン）。fullArea = 面積比がこの値で最大重症度 */
  severityFromArea?: { fullArea: number; label: string }
  /** 走査距離の推定（速度仮定、模擬）。GPS が無いデモ用 */
  odometer?: { kmh: number }
  /** KPI の見出し差し替え（検査総数 / 合格 / 不良） */
  kpiLabels?: { total?: string; pass?: string; reject?: string; yield?: string; throughputUnit?: string }
  /** グレードの表示名を差し替える（例: A → 収穫適期） */
  gradeLabels?: Partial<Record<Grade, string>>
  /** 映像左上パネルに出すグレードのまとめ（例: 収穫可 = A+B） */
  gradeGroups?: Array<{ label: string; grades: Grade[]; tone?: string }>
  /** 追跡 ID による固有カウント（重複計上なし）を前面に出す */
  countUnique?: boolean
  /** false ならライン判断と異常警報を行わない（収穫判定など、不良率が異常を意味しない検査） */
  lineMonitoring?: boolean
}
