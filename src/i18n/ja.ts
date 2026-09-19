import type { DetectionClass, InspectionEventType, LineDecision, ObjectDecision } from '@/types/inspection'

/** 画面表示用の日本語ラベル。内部コード（PASS / REJECT など）は英字のまま保持し、表示時に変換する。 */

export const DECISION_JA: Record<ObjectDecision, string> = {
  PASS: '合格',
  RECHECK: '再検査',
  REJECT: '不良',
  HUMAN_REVIEW: '要確認',
}

export const LINE_DECISION_JA: Record<LineDecision, string> = {
  NORMAL: '正常',
  WATCH: '注視',
  SLOW_LINE: '減速',
  STOP_LINE: '停止',
  HUMAN_REVIEW: '要確認',
}

export const CLASS_JA: Record<DetectionClass, string> = {
  CAPPED: 'キャップ有',
  UNCAPPED: 'キャップ無',
  LOW_CAP: 'キャップ浅い',
  MISALIGNED_CAP: 'キャップずれ',
  DAMAGED_CAP: 'キャップ破損',
  NO_LABEL: 'ラベル無',
  LABEL_MISALIGNED: 'ラベルずれ',
  DEFORMED_BOTTLE: 'ボトル変形',
  FOREIGN_OBJECT: '異物',
}

export const REASON_JA: Record<string, string> = {
  CAP_OK: 'キャップ正常',
  CAP_OK_ALIGNMENT_LOW: 'キャップ正常（位置やや低）',
  CAP_OK_AFTER_RECHECK: '再検査後 正常',
  CAP_AMBIGUOUS_AFTER_RECHECK: '再検査後も判定不能',
  CAP_MISALIGNED: 'キャップずれ',
  CAP_LOW_CONFIDENCE: 'キャップ信頼度不足',
  CAP_AMBIGUOUS: 'キャップ判定不能',
  CAP_MISSING: 'キャップ欠落',
  JEV_UNCERTAIN: 'JEV 判断不確実',
  OUTSIDE_INSPECTION_ZONE: '検査ゾーン外',
  OPTION_NOT_OFFERED: '提示外の選択肢',
  JEV_DECISION: 'JEV 判断',
  WITHIN_TOLERANCE: '許容範囲内',
  REJECT_RATE_ELEVATED: '不良率 上昇',
  REJECT_RATE_HIGH: '不良率 高',
  REJECT_RATE_CRITICAL: '不良率 危険域',
  CAMERA_CONFIDENCE_LOW: 'カメラ信頼度 低下',
}

export const ACTION_JA: Record<string, string> = {
  RELEASE: '通過',
  'EJECT AT GATE 02': 'ゲート02で排出',
  'RE-SAMPLE FRAME': '再サンプリング',
  'QUEUE FOR REVIEW': '確認待ちへ',
}

export const EVENT_JA: Record<InspectionEventType, string> = {
  OBJECT_ENTERED: '進入',
  OBJECT_TRACKED: '追跡確定',
  INSPECTION_STARTED: '検査開始',
  CAP_CONFIDENCE: 'キャップ信頼度',
  INSPECTION_COMPLETED: '検査完了',
  PASS: '合格',
  RECHECK: '再検査',
  REJECT: '不良',
  HUMAN_REVIEW: '要確認',
  EJECT_TRIGGERED: '排出指令',
  ALERT: '警報',
  LINE_DECISION: 'ライン判断',
  OBJECT_EXITED: '退出',
  HUMAN_OVERRIDE: '人の判定',
  SYSTEM: 'システム',
}

export const reasonJa = (code: string | undefined) => (code ? (REASON_JA[code] ?? code) : '—')
export const actionJa = (code: string | undefined) => (code ? (ACTION_JA[code] ?? code) : '—')
export const decisionJa = (d: ObjectDecision | undefined) => (d ? DECISION_JA[d] : '—')
export const lineDecisionJa = (d: LineDecision | undefined) => (d ? LINE_DECISION_JA[d] : '—')
