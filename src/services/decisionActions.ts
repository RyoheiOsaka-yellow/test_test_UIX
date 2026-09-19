import type { ObjectDecision } from '@/types/inspection'

/** 判断から導く処置コード。表示名はプロファイル / i18n が与える。フェーズ1では PLC に一切触れない。 */
export type ActionCode = 'RELEASE' | 'EJECT' | 'RE_SAMPLE' | 'QUEUE_REVIEW'

export function actionFor(decision: ObjectDecision): ActionCode {
  switch (decision) {
    case 'PASS':
      return 'RELEASE'
    case 'REJECT':
      return 'EJECT'
    case 'RECHECK':
      return 'RE_SAMPLE'
    case 'HUMAN_REVIEW':
      return 'QUEUE_REVIEW'
  }
}
