import type { DecisionEngine, InspectionProfile, LineState, PlaybackRate, RawDetection, ScenarioId, VideoSource } from '@/types/inspection'
import { DEFAULT_GATE, LINE_DECISION_OPTIONS, OBJECT_DECISION_OPTIONS } from '@/types/inspection'
import { SCENARIOS, scenarioText } from '@/data/scenarios'
import { assignConditions, configureTrigger, generateTracks, timelineToTracks, type BottleTrack } from '@/data/demoDetections'
import { PROFILES } from '@/profiles'
import { LINE_DECISION_JA, reasonJa } from '@/i18n/ja'
import { eventBus } from './eventBus'
import { createDecisionEngine } from './decisionEngine'
import { isJevConfigured, jevDecisionEngine } from './jevDecisionEngine'
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
  /** プロファイルごとの実映像追跡結果（detections.json）。動画が使えるときだけ使う。 */
  private realTracksByProfile = new Map<string, BottleTrack[]>()
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
    jevDecisionEngine.setProfile(this.store.getState().profile)
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
    this.loadScenario(this.store.getState().scenario)
    this.syncClockState()
  }

  /**
   * プロファイルの映像を使ってよいか判定する。実映像には必ず事前追跡結果（detections.json）が
   * 必要で、無い場合は合成映像に切り替える（実映像の上に合成の枠を出して「検出している」ように
   * 見せることはしない）。
   */
  async resolveVideoSource(profile: InspectionProfile, probed: VideoSource): Promise<VideoSource> {
    if (probed.kind !== 'video') return probed
    await this.loadRealDetections(profile)
    if (this.realTracksByProfile.has(profile.id)) return probed
    this.bus.emit('SYSTEM', `${profile.name}: 追跡結果（detections.json）が無いため合成映像で動かします`, { severity: 'warn' })
    return { kind: 'placeholder' }
  }

  /** 実映像の追跡結果を読み込む（単一HTMLに埋め込まれたもの → /demo/<dir>/detections.json の順） */
  private async loadRealDetections(profile: InspectionProfile) {
    if (this.realTracksByProfile.has(profile.id)) return
    let timeline: RawDetection[] | null = null
    const embedded = window.__JEV_EMBEDDED__?.profiles?.[profile.id]?.detections
    if (embedded && embedded.length) timeline = embedded
    else {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}demo/${profile.mediaDir}/detections.json`)
        if (res.ok) timeline = (await res.json()) as RawDetection[]
      } catch {
        timeline = null
      }
    }
    if (!timeline) return
    const tracks = timelineToTracks(timeline, { minDurationSeconds: 0.5 })
    if (tracks.some((t) => t.source === 'real')) {
      this.realTracksByProfile.set(profile.id, tracks)
      this.bus.emit(
        'SYSTEM',
        `実映像の追跡結果を読込 · ${tracks.length} 個のトラック（${profile.objectLabel}検出: 事前計算 / ${profile.attributeLabel}判定: 疑似注入）`,
      )
    }
  }

  /** 検査プロファイル（物体・属性・トリガー・映像）を切り替える */
  selectProfile(id: string) {
    const profile = PROFILES[id]
    if (!profile || profile.id === this.store.getState().profile.id) return
    this.pause()
    this.lastLineDecision = null
    this.lineFailures = 0
    this.store.resetStatistics()
    this.store.update(() => ({ profile, videoSource: null, trackSource: 'synthetic', anomaly: null }))
    jevDecisionEngine.setProfile(profile)
    this.bus.emit('SYSTEM', `検査プロファイル切替: ${profile.name}（${profile.lineName}）`)
    // 映像の再探索は VideoInspection が profile の変化を見て attachVideo() を呼ぶ
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
    const s = this.store.getState()
    const profile = s.profile
    const real = this.realTracksByProfile.get(profile.id)
    const useReal = !!real && s.videoSource?.kind === 'video'
    // 合成トラックは常に左→右に流れるので、動画が無いときは既定ゲートに固定する
    // （合成映像を前提に設計されたプロファイルは自分のトリガーを使う）
    const trigger = useReal || profile.syntheticFeed ? profile.trigger : DEFAULT_GATE
    configureTrigger(trigger)
    const tracks = useReal ? assignConditions(real!, scenario) : generateTracks(scenario, { measurement: profile.measurement })
    this.simulator.load(tracks, scenario, profile, this.clock.currentTime())
    this.store.update(() => ({ scenario: id, trackSource: useReal ? 'real' : 'synthetic', trigger }))
    this.bus.emit(
      'SYSTEM',
      `シナリオ読込: ${scenarioText(scenario.name, profile)}（追跡対象 ${tracks.length} 個 / ${useReal ? '実映像トラック' : '合成トラック'}）`,
    )
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
        `ライン JEV → ${LINE_DECISION_JA[result.decision]} ${Math.round(result.confidence * 100)}%（${reasonJa(result.reason, s.profile)}）`,
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
