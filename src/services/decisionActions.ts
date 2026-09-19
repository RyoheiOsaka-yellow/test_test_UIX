import type { ObjectDecision } from '@/types/inspection'

/** Action derived from a decision. Simulation only: no PLC is ever addressed in Phase 1. */
export function actionFor(decision: ObjectDecision): string {
  switch (decision) {
    case 'PASS':
      return 'RELEASE'
    case 'REJECT':
      return 'EJECT AT GATE 02'
    case 'RECHECK':
      return 'RE-SAMPLE FRAME'
    case 'HUMAN_REVIEW':
      return 'QUEUE FOR REVIEW'
  }
}
