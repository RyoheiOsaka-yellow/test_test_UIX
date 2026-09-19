import type { DecisionEngine, LineState, PlaybackRate, RawDetection, ScenarioId, VideoSource } from '@/types/inspection'
import { LINE_DECISION_OPTIONS, OBJECT_DECISION_OPTIONS } from '@/types/inspection'
import { SCENARIOS } from '@/data/scenarios'
import { assignConditions, generateTracks, timelineToTracks, type BottleTrack } from '@/data/demoDetections'
import { LINE_DECISION_JA, reasonJa } from '@/i18n/ja'
import { eventBus } from './eventBus'
import { createDecisionEngine } from './decisionEngine'
import { isJevConfigured } from './jevDecisionEngine'
import { inspectionStore } from './inspectionStore'
import { InternalClock, VideoClock, type PlaybackClock } from './playbackClock'
import { VideoDetectionSimulator } from './videoDetectionSimulator'

/**
 * 各層を結線する:
 *   クロック → シミュレータ（映像認識） → バス → ストア（ダッシュボード）
 *                          ↘ 判断エンジン（物体レベル）
 *   ストアの直近統計 → 判断エンジン（ラインレベル、数秒ごと）
 */
export class InspectionController {
  readonly bus = eventBus
  readonly store = inspectionStore
  readonly engine: DecisionEngine
  readonly simulator: VideoDetectionSimulator
  clock: PlaybackClock = new InternalClock(240)
  /** 実映像の追跡結果（detections.json）。動画が使えるときだけ使う。 */
  private realTracks: BottleTrack[] | null = null
  private detach: () => void
  private detachClock: () => void = () => {}
  private lineTimer: number | null = null
  private lineFailures = 0
  private lastLineDecision: string | null = null

  constructor() {
    this.engine = createDecisionEngine((err) => {
      this.store.update((s) => ({ engineFallbacks: s.engineFallbacks + 1, status: { ...s.status, jev: 'FALLBACK' } }))
      this.bus.emit('SYSTEM', `JEV API に接続できないため模擬判断へ切替（${String(err)}）`, { severity: 'warn' })
    })
    this.simulator = new VideoDetectionSimulator({
      bus: this.bus,
      decide: (state) => this.engine.decideObject(state, OBJECT_DECISION_OPTIONS),
    })
    this.detach = this.store.attach(this.bus)
    this.store.update((s) => ({
      mode: isJevConfigured() ? 'JEV_LIVE' : 'SIMULATION',
      status: { ...s.status, jev: isJevConfigured() ? 'LIVE' : 'SIMULATED' },
    }))
    this.loadScenario(this.store.getState().scenario)
    this.bus.emit('SYSTEM', `システム起動 · モード ${isJevConfigured() ? 'JEV接続' : 'シミュレーション'} · 判断エンジン ${this.engine.kind === 'jev' ? 'Jev' : '模擬'}`)
  }

  /** クロックを動画要素に接続する（無ければ内部クロック）。 */
  async attachVideo(video: HTMLVideoElement | null, source: VideoSource) {
    this.detachClock()
    this.clock.dispose()
    this.clock = video && source.kind === 'video' ? new VideoClock(video) : new InternalClock(240)
    this.clock.setRate(this.store.getState().playbackRate)
    this.detachClock = this.clock.subscribe(() => this.syncClockState())
    this.store.update(() => ({ videoSource: source }))
    if (source.kind === 'video') await this.loadRealDetections()
    this.loadScenario(this.store.getState().scenario)
    this.syncClockState()
  }

  /** 実映像の追跡結果を読み込む（単一HTMLに埋め込まれたもの → /demo/detections.json の順） */
  private async loadRealDetections() {
    if (this.realTracks) return
    let timeline: RawDetection[] | null = null
    const embedded = window.__JEV_EMBEDDED__?.detections
    if (embedded && embedded.length) timeline = embedded
    else {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}demo/detections.json`)
        if (res.ok) timeline = (await res.json()) as RawDetection[]
      } catch {
        timeline = null
      }
    }
    if (!timeline) return
    const tracks = timelineToTracks(timeline, { minDurationSeconds: 0.5 })
    if (tracks.some((t) => t.source === 'real')) {
      this.realTracks = tracks
      this.bus.emit('SYSTEM', `実映像の追跡結果を読込 · ${tracks.length} 本のトラック（ボトル検出: 事前計算 / キャップ判定: 疑似注入）`)
    }
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
    const useReal = this.realTracks && this.store.getState().videoSource?.kind === 'video'
    const tracks = useReal ? assignConditions(this.realTracks!, scenario) : generateTracks(scenario)
    this.simulator.load(tracks, scenario, this.clock.currentTime())
    this.store.update(() => ({ scenario: id, trackSource: useReal ? 'real' : 'synthetic' }))
    this.bus.emit('SYSTEM', `シナリオ読込: ${scenario.name}（追跡対象 ${tracks.length} 本 / ${useReal ? '実映像トラック' : '合成トラック'}）`)
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
    this.simulator.reset(0, false)
    this.store.resetStatistics()
    this.lastLineDecision = null
    this.lineFailures = 0
    this.bus.emit('SYSTEM', '最初から再開')
    void this.play()
  }

  setRate(rate: PlaybackRate) {
    this.clock.setRate(rate)
    this.store.update(() => ({ playbackRate: rate }))
  }

  /** クロックまでシミュレーションを進める。オーバーレイの描画ループから呼ぶ。 */
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

  /** 第2階層の判断: ライン全体。構造化した状態と明示的な選択肢を渡す。 */
  private async evaluateLine() {
    const s = this.store.getState()
    if (!s.playing) return
    const now = Date.now()
    const stats = this.store.windowStats(now)
    if (stats.total < 6) return
    const scenario = SCENARIOS[s.scenario]
    // 標本が少ないうちは観測値を基準値へ縮約する（事前分布 = 12 件相当）。
    // 序盤の不良1件だけで減速判断にならないようにする。
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
      this.bus.emit(
        'LINE_DECISION',
        `ライン JEV → ${LINE_DECISION_JA[result.decision]} ${Math.round(result.confidence * 100)}%（${reasonJa(result.reason)}）`,
        {
          severity: result.decision === 'NORMAL' ? 'ok' : result.decision === 'WATCH' ? 'warn' : 'error',
          data: { result, state },
        },
      )
    } else {
      this.store.update(() => ({ lineDecision: result }))
    }

    const shouldAlert = smoothedRejectRate >= scenario.alertRejectRate && stats.total >= 10
    if (shouldAlert !== s.lineAlert.active) {
      this.bus.emit(
        'ALERT',
        shouldAlert
          ? `異常警報 · 直近60秒の不良率 ${(smoothedRejectRate * 100).toFixed(1)}%（しきい値 ${(scenario.alertRejectRate * 100).toFixed(0)}%）`
          : `異常解除 · 不良率 ${(smoothedRejectRate * 100).toFixed(1)}%`,
        {
          severity: shouldAlert ? 'error' : 'ok',
          data: {
            active: shouldAlert,
            rejectRate: smoothedRejectRate,
            message: shouldAlert ? '不良率がしきい値を超過' : '',
          },
        },
      )
    }
  }

  dispose() {
    this.detach()
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
