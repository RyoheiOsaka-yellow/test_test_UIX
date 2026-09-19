import type { ScenarioDefinition, ScenarioId } from '@/types/inspection'

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  normal: {
    id: 'normal',
    name: '通常生産',
    description: 'キャップ有 95% / キャップ無 5%。基準となるラインの挙動。',
    uncappedRate: 0.05,
    misalignedRate: 0.02,
    ambiguousRate: 0.01,
    noise: 0.15,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  high_reject: {
    id: 'high_reject',
    name: '不良率上昇',
    description: '品質トラブル: キャップ有 75% / キャップ無 25%。しばらくすると異常警報が上がる。',
    uncappedRate: 0.25,
    misalignedRate: 0.03,
    ambiguousRate: 0.02,
    noise: 0.15,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  sensor_noise: {
    id: 'sensor_noise',
    name: 'センサーノイズ',
    description: '枠と信頼度が揺れ、判定不能な読みが多く「要確認」へ回る。',
    uncappedRate: 0.06,
    misalignedRate: 0.05,
    ambiguousRate: 0.18,
    noise: 0.85,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  cap_misalignment: {
    id: 'cap_misalignment',
    name: 'キャップずれ',
    description: '打栓機のずれ: 多くのキャップが「再検査」帯に入り、ゲートで再サンプリングされる。',
    uncappedRate: 0.05,
    misalignedRate: 0.28,
    ambiguousRate: 0.03,
    noise: 0.25,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  confidence_drop: {
    id: 'confidence_drop',
    name: 'カメラ信頼度低下',
    description: '18〜48秒にカメラ露出異常。認識の信頼度が崩れ、ライン判断が「要確認」へ上がる。',
    uncappedRate: 0.05,
    misalignedRate: 0.02,
    ambiguousRate: 0.02,
    noise: 0.3,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
    cameraConfidence: (t) => {
      const local = t % 120
      if (local < 18 || local > 48) return 1
      const ramp = Math.min(1, (local - 18) / 4, (48 - local) / 4)
      return 1 - 0.45 * ramp
    },
  },
  line_congestion: {
    id: 'line_congestion',
    name: 'ライン渋滞',
    description: 'ベルト上でボトルが詰まり、処理速度が跳ね上がって枠が重なる。',
    uncappedRate: 0.07,
    misalignedRate: 0.03,
    ambiguousRate: 0.02,
    noise: 0.2,
    spacingSeconds: 0.42,
    alertRejectRate: 0.15,
  },
}

export const SCENARIO_ORDER: ScenarioId[] = [
  'normal',
  'high_reject',
  'sensor_noise',
  'cap_misalignment',
  'confidence_drop',
  'line_congestion',
]
