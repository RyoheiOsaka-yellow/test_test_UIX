import type { DetectionClass, InspectionEventType, InspectionProfile, LineDecision, ObjectDecision } from '@/types/inspection'

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

export const EXTRA_CLASS_JA: Partial<Record<DetectionClass, string>> = {
  LOW_CAP: 'キャップ浅い',
  MISALIGNED_CAP: 'キャップずれ',
  DAMAGED_CAP: 'キャップ破損',
  NO_LABEL: 'ラベル無',
  LABEL_MISALIGNED: 'ラベルずれ',
  DEFORMED_BOTTLE: 'ボトル変形',
  FOREIGN_OBJECT: '異物',
}

/** 検知クラスの表示名（OK / NG はプロファイルの語彙） */
export const classJa = (cls: DetectionClass, profile: InspectionProfile) =>
  cls === 'OK' ? profile.okLabel : cls === 'NG' ? profile.ngLabel : (EXTRA_CLASS_JA[cls] ?? cls)


export const ACTION_JA: Record<string, string> = {
  RELEASE: '通過',
  EJECT: '排出',
  RE_SAMPLE: '再サンプリング',
  QUEUE_REVIEW: '確認待ちへ',
}

export const EVENT_JA: Record<InspectionEventType, string> = {
  OBJECT_ENTERED: '進入',
  OBJECT_TRACKED: '追跡確定',
  INSPECTION_STARTED: '検査開始',
  ATTRIBUTE_CONFIDENCE: '属性信頼度',
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

export const reasonJa = (code: string | undefined, profile: InspectionProfile) => (code ? (profile.reasons[code] ?? code) : '—')
export const actionJa = (code: string | undefined, profile: InspectionProfile) =>
  code === 'EJECT' ? profile.rejectAction : code ? (ACTION_JA[code] ?? code) : '—'
export const decisionJa = (d: ObjectDecision | undefined, profile?: InspectionProfile) =>
  d ? (profile?.decisionLabels?.[d] ?? DECISION_JA[d]) : '—'
export const lineDecisionJa = (d: LineDecision | undefined) => (d ? LINE_DECISION_JA[d] : '—')
