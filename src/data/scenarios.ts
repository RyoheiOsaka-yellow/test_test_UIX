import type { ScenarioDefinition, ScenarioId } from '@/types/inspection'

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  normal: {
    id: 'normal',
    name: 'Normal Production',
    description: 'CAPPED 95% / UNCAPPED 5%. Baseline line behaviour.',
    uncappedRate: 0.05,
    misalignedRate: 0.02,
    ambiguousRate: 0.01,
    noise: 0.15,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  high_reject: {
    id: 'high_reject',
    name: 'High Reject Rate',
    description: 'Quality incident: CAPPED 75% / UNCAPPED 25%. Anomaly alert raises after a short while.',
    uncappedRate: 0.25,
    misalignedRate: 0.03,
    ambiguousRate: 0.02,
    noise: 0.15,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  sensor_noise: {
    id: 'sensor_noise',
    name: 'Sensor Noise',
    description: 'Jittery boxes and confidence; many ambiguous reads escalate to HUMAN_REVIEW.',
    uncappedRate: 0.06,
    misalignedRate: 0.05,
    ambiguousRate: 0.18,
    noise: 0.85,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  cap_misalignment: {
    id: 'cap_misalignment',
    name: 'Cap Misalignment',
    description: 'Capper drifting: many caps land in the RECHECK band and get re-sampled at the gate.',
    uncappedRate: 0.05,
    misalignedRate: 0.28,
    ambiguousRate: 0.03,
    noise: 0.25,
    spacingSeconds: 0.95,
    alertRejectRate: 0.15,
  },
  confidence_drop: {
    id: 'confidence_drop',
    name: 'Camera Confidence Drop',
    description: 'Camera exposure fault between 18s and 48s; vision confidence collapses and the line decision escalates.',
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
    name: 'Line Congestion',
    description: 'Bottles bunch up on the belt; throughput spikes and boxes overlap.',
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
