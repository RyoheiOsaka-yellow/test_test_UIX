import type { DecisionEngine, LineState, PlaybackRate, ScenarioId, VideoSource } from '@/types/inspection'
import { LINE_DECISION_OPTIONS, OBJECT_DECISION_OPTIONS } from '@/types/inspection'
import { SCENARIOS } from '@/data/scenarios'
import { generateTracks } from '@/data/demoDetections'
import { eventBus } from './eventBus'
import { createDecisionEngine } from './decisionEngine'
import { isJevConfigured } from './jevDecisionEngine'
import { inspectionStore } from './inspectionStore'
import { InternalClock, VideoClock, type PlaybackClock } from './playbackClock'
import { VideoDetectionSimulator } from './videoDetectionSimulator'

/**
 * Wires the layers together:
 *   clock → simulator (CV) → bus → store (dashboard)
 *                    ↘ decision engine (object level)
 *   store window stats → decision engine (line level, every few seconds)
 */
export class InspectionController {
  readonly bus = eventBus
  readonly store = inspectionStore
  readonly engine: DecisionEngine
  readonly simulator: VideoDetectionSimulator
  clock: PlaybackClock = new InternalClock(240)
  private detachStore: () => void
  private detachClock: () => void = () => {}
  private lineTimer: number | null = null
  private lineFailures = 0
  private lastLineDecision: string | null = null

  constructor() {
    this.engine = createDecisionEngine((err) => {
      this.store.update((s) => ({ engineFallbacks: s.engineFallbacks + 1, status: { ...s.status, jev: 'FALLBACK' } }))
      this.bus.emit('SYSTEM', `JEV API unavailable, falling back to simulation (${String(err)})`, { severity: 'warn' })
    })
    this.simulator = new VideoDetectionSimulator({
      bus: this.bus,
      decide: (state) => this.engine.decideObject(state, OBJECT_DECISION_OPTIONS),
    })
    this.detachStore = this.store.attach(this.bus)
    this.store.update((s) => ({
      mode: isJevConfigured() ? 'JEV_LIVE' : 'SIMULATION',
      status: { ...s.status, jev: isJevConfigured() ? 'LIVE' : 'SIMULATED' },
    }))
    this.loadScenario(this.store.getState().scenario)
    this.bus.emit('SYSTEM', `System initialised · mode ${isJevConfigured() ? 'JEV LIVE' : 'SIMULATION'} · engine ${this.engine.kind}`)
  }

  /** Attach the clock to a real video element, or fall back to the internal clock. */
  attachVideo(video: HTMLVideoElement | null, source: VideoSource) {
    this.detachClock()
    this.clock.dispose()
    this.clock = video && source.kind === 'video' ? new VideoClock(video) : new InternalClock(240)
    this.clock.setRate(this.store.getState().playbackRate)
    this.detachClock = this.clock.subscribe(() => this.syncClockState())
    this.store.update(() => ({ videoSource: source }))
    this.simulator.reset(this.clock.currentTime())
    this.syncClockState()
  }

  private syncClockState() {
    const playing = this.clock.isPlaying()
    this.store.update((s) => ({
      playing,
      status: { ...s.status, line: playing ? 'RUNNING' : 'PAUSED', vision: playing ? 'ACTIVE' : 'IDLE' },
    }))
  }

  loadScenario(id: ScenarioId) {
    const scenario = SCENARIOS[id]
    const tracks = generateTracks(scenario)
    this.simulator.load(tracks, scenario, this.clock.currentTime())
    this.store.update(() => ({ scenario: id }))
    this.bus.emit('SYSTEM', `Scenario loaded: ${scenario.name} (${tracks.length} tracked objects)`)
  }

  selectScenario(id: ScenarioId) {
    this.clock.seek(0)
    this.store.resetStatistics()
    this.lastLineDecision = null
    this.lineFailures = 0
    this.loadScenario(id)
  }

  runDemo() {
    if (this.store.getState().demoStartedAt === null) {
      this.store.update(() => ({ demoStartedAt: Date.now() }))
    }
    void this.play()
  }

  async play() {
    await this.clock.play()
    this.startLineLoop()
    this.syncClockState()
  }

  pause() {
    this.clock.pause()
    this.syncClockState()
  }

  restart() {
    this.clock.seek(0)
    this.simulator.reset(0)
    this.store.resetStatistics()
    this.lastLineDecision = null
    this.lineFailures = 0
    this.bus.emit('SYSTEM', 'Restarted')
    void this.play()
  }

  setRate(rate: PlaybackRate) {
    this.clock.setRate(rate)
    this.store.update(() => ({ playbackRate: rate }))
  }

  /** Advance simulation to the clock. Called from the overlay's rAF loop. */
  tick() {
    const t = this.clock.currentTime()
    this.simulator.update(t)
    const cam = this.simulator.cameraConfidence(t)
    const s = this.store.getState()
    const camStatus = cam < 0.75 ? 'DEGRADED' : 'ONLINE'
    if (Math.abs(s.cameraConfidence - cam) > 0.02 || s.status.camera !== camStatus) {
      this.store.update((st) => ({ cameraConfidence: cam, status: { ...st.status, camera: camStatus } }))
    }
    return t
  }

  private startLineLoop() {
    if (this.lineTimer !== null) return
    this.lineTimer = window.setInterval(() => void this.evaluateLine(), 5000)
  }

  /** Second-level decision: the line as a whole. Structured state, explicit options. */
  private async evaluateLine() {
    const s = this.store.getState()
    if (!s.playing) return
    const now = Date.now()
    const stats = this.store.windowStats(now)
    if (stats.total < 6) return
    const scenario = SCENARIOS[s.scenario]
    // Shrink the observed rate towards the nominal rate while the sample is small
    // (Bayesian prior of PRIOR_WEIGHT observations), so a single early reject
    // never trips SLOW_LINE on its own.
    const PRIOR_WEIGHT = 12
    const NORMAL_RATE = 0.05
    const smoothedRejectRate = (stats.rejects + NORMAL_RATE * PRIOR_WEIGHT) / (stats.total + PRIOR_WEIGHT)
    const state: LineState = {
      rejectRate: smoothedRejectRate,
      normalRate: NORMAL_RATE,
      cameraConfidence: s.cameraConfidence,
      lineSpeedBpm: s.kpi.throughputBpm,
      previousFailures: this.lineFailures,
      windowSeconds: 60,
    }
    const result = await this.engine.decideLine(state, LINE_DECISION_OPTIONS)
    if (result.decision !== 'NORMAL') this.lineFailures++
    else this.lineFailures = 0
    const key = `${result.decision}:${result.reason}`
    if (key !== this.lastLineDecision) {
      this.lastLineDecision = key
      this.bus.emit('LINE_DECISION', `LINE JEV → ${result.decision} ${Math.round(result.confidence * 100)}% (${result.reason})`, {
        severity: result.decision === 'NORMAL' ? 'ok' : result.decision === 'WATCH' ? 'warn' : 'error',
        data: { result, state },
      })
    } else {
      this.store.update(() => ({ lineDecision: result }))
    }

    const shouldAlert = smoothedRejectRate >= scenario.alertRejectRate && stats.total >= 10
    if (shouldAlert !== s.lineAlert.active) {
      this.bus.emit(
        'ALERT',
        shouldAlert
          ? `ANOMALY ALERT · reject rate ${(smoothedRejectRate * 100).toFixed(1)}% over 60s (threshold ${(scenario.alertRejectRate * 100).toFixed(0)}%)`
          : `Anomaly cleared · reject rate ${(smoothedRejectRate * 100).toFixed(1)}%`,
        {
          severity: shouldAlert ? 'error' : 'ok',
          data: {
            active: shouldAlert,
            rejectRate: smoothedRejectRate,
            message: shouldAlert ? 'REJECT RATE ABOVE THRESHOLD' : '',
          },
        },
      )
    }
  }

  dispose() {
    this.detachStore()
    this.detachClock()
    this.clock.dispose()
    if (this.lineTimer !== null) window.clearInterval(this.lineTimer)
  }
}

let controller: InspectionController | null = null
export function getController(): InspectionController {
  if (!controller) controller = new InspectionController()
  return controller
}
