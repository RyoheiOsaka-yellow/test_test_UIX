import { useSyncExternalStore } from 'react'
import type {
  DecisionResult,
  InspectionEvent,
  InspectionProfile,
  InspectionTrigger,
  InspectionRecord,
  InspectionState,
  LineDecisionResult,
  ObjectDecision,
  OverlaySettings,
  PlaybackRate,
  ScenarioId,
  VideoSource,
} from '@/types/inspection'
import { DEFAULT_GATE } from '@/types/inspection'
import { DEFAULT_PROFILE_ID, PROFILES } from '@/profiles'
import type { EventBus } from './eventBus'

/**
 * Dashboard state, derived from the event stream.
 *
 * Deliberately a tiny external store (useSyncExternalStore) instead of React
 * state so that the 60fps overlay never goes through React, while the
 * dashboard re-renders only on events (a few per second).
 */

export interface KpiState {
  totalInspected: number
  pass: number
  reject: number
  recheck: number
  humanReview: number
  /** Objects currently pending human review. */
  pendingReview: number
  yieldRate: number
  throughputBpm: number
  decisionLatencyMs: number
}

export interface CurrentObject {
  objectId: string
  objectConfidence: number
  attributeConfidence: number
  alignment: number
  measurement?: { key: string; value: number; target: number; tolerance: number; confidence: number; tiltDeg: number; truth?: number }
  decision?: DecisionResult
  state?: InspectionState
  updatedAt: number
}

export interface AnomalyInfo {
  objectId: string
  issue: string
  confidence: number
  action: string
  timestamp: number
}

export interface ReviewItem {
  objectId: string
  attributeConfidence: number
  objectConfidence: number
  jevConfidence: number
  reason: string
  timestamp: number
}

export interface SeriesPoint {
  /** Wall-clock second (ms since epoch, floored to the second). */
  t: number
  pass: number
  reject: number
  review: number
}

export interface CapPoint {
  t: number
  objectId: string
  attribute: number
  decision: ObjectDecision
}

export interface LineAlert {
  active: boolean
  rejectRate: number
  since: number
  message: string
}

export interface FactoryStatus {
  camera: 'ONLINE' | 'OFFLINE' | 'DEGRADED'
  vision: 'ACTIVE' | 'IDLE'
  jev: 'SIMULATED' | 'LIVE' | 'FALLBACK'
  line: 'RUNNING' | 'PAUSED' | 'STOPPED'
}

export interface InspectionStoreState {
  profile: InspectionProfile
  /** 現在有効な検査トリガー（合成映像のときは既定ゲート） */
  trigger: InspectionTrigger
  mode: 'SIMULATION' | 'JEV_LIVE'
  engineFallbacks: number
  scenario: ScenarioId
  videoSource: VideoSource | null
  /** 追跡データの由来: 実映像の事前追跡結果 or 合成 */
  trackSource: 'real' | 'synthetic'
  playing: boolean
  playbackRate: PlaybackRate
  overlay: OverlaySettings
  kpi: KpiState
  events: InspectionEvent[]
  records: InspectionRecord[]
  currentObject: CurrentObject | null
  anomaly: AnomalyInfo | null
  reviewQueue: ReviewItem[]
  series: SeriesPoint[]
  capSeries: CapPoint[]
  lineDecision: LineDecisionResult | null
  lineAlert: LineAlert
  status: FactoryStatus
  cameraConfidence: number
  demoStartedAt: number | null
  /** 計測プロファイル（合成映像）: 計測値と真値の絶対誤差の平均 */
  measurementMeanAbsError: number | null
  measurementSamples: number
}

const MAX_EVENTS = 400
const MAX_RECORDS = 2000
const SERIES_WINDOW_S = 60
const CAP_SERIES_MAX = 80

export function initialState(): InspectionStoreState {
  return {
    profile: PROFILES[DEFAULT_PROFILE_ID],
    trigger: DEFAULT_GATE,
    mode: 'SIMULATION',
    engineFallbacks: 0,
    scenario: 'normal',
    videoSource: null,
    trackSource: 'synthetic',
    playing: false,
    playbackRate: 1,
    overlay: {
      overlay: true,
      boundingBox: true,
      confidence: true,
      trackingId: true,
      inspectionGate: true,
      jevDecision: true,
    },
    kpi: {
      totalInspected: 0,
      pass: 0,
      reject: 0,
      recheck: 0,
      humanReview: 0,
      pendingReview: 0,
      yieldRate: 0,
      throughputBpm: 0,
      decisionLatencyMs: 0,
    },
    events: [],
    records: [],
    currentObject: null,
    anomaly: null,
    reviewQueue: [],
    series: [],
    capSeries: [],
    lineDecision: null,
    lineAlert: { active: false, rejectRate: 0, since: 0, message: '' },
    status: { camera: 'ONLINE', vision: 'IDLE', jev: 'SIMULATED', line: 'PAUSED' },
    cameraConfidence: 1,
    demoStartedAt: null,
    measurementMeanAbsError: null,
    measurementSamples: 0,
  }
}

export class InspectionStore {
  private state: InspectionStoreState = initialState()
  private listeners = new Set<() => void>()
  /** Gate-crossing timestamps for throughput (wall clock, ms). */
  private gateTimes: number[] = []
  private latencyEma: number | null = null

  getState = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<InspectionStoreState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  update(fn: (s: InspectionStoreState) => Partial<InspectionStoreState>) {
    this.set(fn(this.state))
  }

  attach(bus: EventBus) {
    return bus.subscribe((event) => this.handleEvent(event))
  }

  resetStatistics() {
    this.gateTimes = []
    this.latencyEma = null
    const s = this.state
    this.set({
      ...initialState(),
      profile: s.profile,
      trigger: s.trigger,
      mode: s.mode,
      scenario: s.scenario,
      videoSource: s.videoSource,
      trackSource: s.trackSource,
      playing: s.playing,
      playbackRate: s.playbackRate,
      overlay: s.overlay,
      status: s.status,
      demoStartedAt: s.demoStartedAt,
    })
  }

  private handleEvent(event: InspectionEvent) {
    const s = this.state
    const events = s.events.length >= MAX_EVENTS ? [...s.events.slice(-MAX_EVENTS + 1), event] : [...s.events, event]
    const patch: Partial<InspectionStoreState> = { events }

    switch (event.type) {
      case 'ATTRIBUTE_CONFIDENCE': {
        const d = event.data as { attributeConfidence: number; objectConfidence: number; alignment: number; measurement?: CurrentObject['measurement'] }
        patch.currentObject = {
          objectId: event.objectId!,
          attributeConfidence: d.attributeConfidence,
          objectConfidence: d.objectConfidence,
          alignment: d.alignment,
          measurement: d.measurement,
          decision: s.currentObject && s.currentObject.objectId === event.objectId ? s.currentObject.decision : undefined,
          updatedAt: event.timestamp,
        }
        break
      }
      case 'PASS':
      case 'RECHECK':
      case 'REJECT':
      case 'HUMAN_REVIEW': {
        const d = event.data as { decision: DecisionResult; state: InspectionState }
        patch.currentObject = {
          objectId: event.objectId!,
          attributeConfidence: d.state.attributeConfidence,
          objectConfidence: d.state.objectConfidence,
          alignment: d.state.alignmentScore ?? 1,
          measurement: d.state.measurement,
          decision: d.decision,
          state: d.state,
          updatedAt: event.timestamp,
        }
        if (event.type === 'RECHECK') {
          patch.kpi = { ...s.kpi, recheck: s.kpi.recheck + 1 }
        }
        break
      }
      case 'INSPECTION_COMPLETED': {
        const d = event.data as { decision: DecisionResult; state: InspectionState; record: InspectionRecord }
        const kpi = { ...s.kpi }
        kpi.totalInspected++
        if (d.decision.decision === 'PASS') kpi.pass++
        else if (d.decision.decision === 'REJECT') kpi.reject++
        else if (d.decision.decision === 'HUMAN_REVIEW') {
          kpi.humanReview++
          kpi.pendingReview++
        }
        this.gateTimes.push(event.timestamp)
        const cutoff = event.timestamp - 60_000
        while (this.gateTimes.length && this.gateTimes[0] < cutoff) this.gateTimes.shift()
        this.latencyEma =
          this.latencyEma === null ? d.decision.latencyMs : this.latencyEma * 0.8 + d.decision.latencyMs * 0.2
        kpi.decisionLatencyMs = this.latencyEma
        kpi.throughputBpm = this.throughput(event.timestamp)
        kpi.yieldRate = kpi.totalInspected ? kpi.pass / kpi.totalInspected : 0
        patch.kpi = kpi

        const rec = d.record
        if (rec.measurement && typeof rec.measurement.truth === 'number') {
          const err = Math.abs(rec.measurement.value - rec.measurement.truth)
          const n = s.measurementSamples
          patch.measurementMeanAbsError = ((s.measurementMeanAbsError ?? 0) * n + err) / (n + 1)
          patch.measurementSamples = n + 1
        }
        const records = s.records.length >= MAX_RECORDS ? [...s.records.slice(-MAX_RECORDS + 1), d.record] : [...s.records, d.record]
        patch.records = records

        patch.series = bump(s.series, event.timestamp, d.decision.decision)
        const capPoint: CapPoint = { t: event.timestamp, objectId: event.objectId!, attribute: d.state.measurement ? d.state.measurement.value : d.state.attributeConfidence, decision: d.decision.decision }
        patch.capSeries = [...s.capSeries.slice(-CAP_SERIES_MAX + 1), capPoint]

        if (d.decision.decision === 'HUMAN_REVIEW') {
          patch.reviewQueue = [
            ...s.reviewQueue,
            {
              objectId: event.objectId!,
              attributeConfidence: d.state.attributeConfidence,
              objectConfidence: d.state.objectConfidence,
              jevConfidence: d.decision.confidence,
              reason: d.decision.reason,
              timestamp: event.timestamp,
            },
          ].slice(-12)
        }
        if (d.decision.decision === 'REJECT') {
          patch.anomaly = {
            objectId: event.objectId!,
            issue: d.decision.reason,
            confidence: d.decision.confidence,
            action: 'REJECT',
            timestamp: event.timestamp,
          }
        }
        break
      }
      case 'LINE_DECISION': {
        patch.lineDecision = event.data?.result as LineDecisionResult
        break
      }
      case 'ALERT': {
        const d = event.data as { active: boolean; rejectRate: number; message: string }
        patch.lineAlert = { active: d.active, rejectRate: d.rejectRate, since: d.active ? event.timestamp : 0, message: d.message }
        break
      }
      default:
        break
    }
    this.set(patch)
  }

  /** Human override of a HUMAN_REVIEW decision. */
  resolveReview(objectId: string, decision: Extract<ObjectDecision, 'PASS' | 'REJECT'>, bus: EventBus) {
    const s = this.state
    const item = s.reviewQueue.find((r) => r.objectId === objectId)
    if (!item) return
    const records = s.records.map((r) =>
      r.objectId === objectId && r.decision.result === 'HUMAN_REVIEW' && !r.humanOverride
        ? { ...r, humanOverride: decision, action: decision === 'REJECT' ? 'EJECT_SIMULATED_MANUAL' : 'RELEASE_MANUAL' }
        : r,
    )
    const kpi = { ...s.kpi }
    kpi.pendingReview = Math.max(0, kpi.pendingReview - 1)
    if (decision === 'PASS') kpi.pass++
    else kpi.reject++
    kpi.yieldRate = kpi.totalInspected ? kpi.pass / kpi.totalInspected : 0
    this.set({ reviewQueue: s.reviewQueue.filter((r) => r.objectId !== objectId), records, kpi })
    bus.emit('HUMAN_OVERRIDE', `${objectId} 人の判定 → ${decision === 'PASS' ? '合格' : '不良'}`, {
      objectId,
      data: { decision, attributeConfidence: item.attributeConfidence },
    })
  }

  private throughput(now: number): number {
    if (this.gateTimes.length < 2) return this.gateTimes.length * 60
    const span = Math.max(5_000, now - this.gateTimes[0])
    return (this.gateTimes.length / span) * 60_000
  }

  /** Stats over the trailing window, used for line-level decisions. */
  windowStats(now: number, windowMs = 60_000) {
    const recent = this.state.records.filter((r) => Date.parse(r.timestamp) >= now - windowMs)
    const total = recent.length
    const rejects = recent.filter((r) => (r.humanOverride ?? r.decision.result) === 'REJECT').length
    const reviews = recent.filter((r) => r.decision.result === 'HUMAN_REVIEW' && !r.humanOverride).length
    return { total, rejects, reviews, rejectRate: total ? rejects / total : 0, reviewRate: total ? reviews / total : 0 }
  }
}

function bump(series: SeriesPoint[], timestamp: number, decision: ObjectDecision): SeriesPoint[] {
  const sec = Math.floor(timestamp / 1000) * 1000
  const cutoff = sec - SERIES_WINDOW_S * 1000
  const next = series.filter((p) => p.t >= cutoff)
  let last = next[next.length - 1]
  if (!last || last.t !== sec) {
    last = { t: sec, pass: 0, reject: 0, review: 0 }
    next.push(last)
  } else {
    last = { ...last }
    next[next.length - 1] = last
  }
  if (decision === 'PASS') last.pass++
  else if (decision === 'REJECT') last.reject++
  else if (decision === 'HUMAN_REVIEW') last.review++
  return next
}

export const inspectionStore = new InspectionStore()

export function useInspectionStore<T>(selector: (s: InspectionStoreState) => T): T {
  return useSyncExternalStore(inspectionStore.subscribe, () => selector(inspectionStore.getState()))
}
