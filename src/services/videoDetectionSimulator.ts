import type {
  DecisionResult,
  DetectionClass,
  FrameDetection,
  InspectionState,
  NormalizedBBox,
  ScenarioDefinition,
  TrackPhase,
} from '@/types/inspection'
import { OBJECT_DECISION_OPTIONS } from '@/types/inspection'
import { CONVEYOR, bboxAt, centerXAt, exitTimeOf, gateTimeOf, type BottleTrack } from '@/data/demoDetections'
import { DECISION_JA } from '@/i18n/ja'
import type { EventBus } from './eventBus'

/**
 * シミュレーションモードの映像認識層。
 *
 * 再生クロックに同期してトラック（合成 or 実映像の追跡結果）を再生し、
 * フレームごとの検知結果を返す。物体のライフサイクル
 * （進入 → 追跡 → 検査 → 判定 → 退出）の状態機械もここが持ち、
 * 構造化イベントをバスへ流す。判断そのものは `decide` に委譲するので、
 * 判断エンジン（模擬 / Jev）はこのファイルを触らずに差し替えられる。
 *
 * 本番では YOLO / RT-DETR + ByteTrack が同じ `FrameDetection` を出す。
 */

export type DecideFn = (state: InspectionState) => Promise<DecisionResult>

interface TrackRuntime {
  track: BottleTrack
  label: string
  phase: TrackPhase
  gateTime: number
  exitTime: number
  /** リセット時点で既にゲートを過ぎていた（検査対象外） */
  skipInspection: boolean
  trackedEmitted: boolean
  decisionRequested: boolean
  decision?: DecisionResult
  decisionTime?: number
  recheckRounds: number
  sampledCap?: number
  sampledBottle?: number
  sampledAlignment?: number
  /** 排出ボトルがベルトから外れ始める時刻（合成トラックのみ） */
  ejectTime?: number
}

export interface SimulatorOptions {
  bus: EventBus
  decide: DecideFn
}

export interface FrameSample {
  time: number
  detections: FrameDetection[]
  /** カメラ信頼度係数（1 = 正常） */
  cameraConfidence: number
}

const smoothNoise = (seed: number, t: number, k: number) =>
  Math.sin(t * (2.3 + k * 0.7) + seed * 0.001) * 0.5 +
  Math.sin(t * (5.1 + k * 1.3) + seed * 0.0007) * 0.3 +
  Math.sin(t * 11.7 + seed * 0.0003) * 0.2

const pct = (v: number) => `${Math.round(v * 100)}%`

export class VideoDetectionSimulator {
  private bus: EventBus
  private decide: DecideFn
  private runtimes: TrackRuntime[] = []
  private scenario: ScenarioDefinition | null = null
  private lastTime = -Infinity
  private generation = 0
  /** ループ回数。周回ごとに追跡番号をずらして重複させない */
  private loopIndex = 0
  private idStride = 200

  constructor(opts: SimulatorOptions) {
    this.bus = opts.bus
    this.decide = opts.decide
  }

  load(tracks: BottleTrack[], scenario: ScenarioDefinition, startTime = 0) {
    this.generation++
    this.scenario = scenario
    this.loopIndex = 0
    const maxId = tracks.reduce((m, t) => Math.max(m, t.id), 0)
    this.idStride = Math.max(100, Math.ceil((maxId + 1) / 100) * 100)
    this.runtimes = tracks.map((track) => ({
      track,
      label: '',
      phase: 'ENTERING',
      gateTime: gateTimeOf(track),
      exitTime: exitTimeOf(track),
      skipInspection: false,
      trackedEmitted: false,
      decisionRequested: false,
      recheckRounds: 0,
    }))
    this.reset(startTime, false)
  }

  private relabel() {
    for (const rt of this.runtimes) rt.label = `#${String(rt.track.id + this.loopIndex * this.idStride).padStart(3, '0')}`
  }

  /** シーク / ループ時のリセット。既にゲートを過ぎている物体は検査しない。 */
  reset(time: number, countLoop = true) {
    this.generation++
    if (countLoop && time < 1 && this.lastTime > 1) this.loopIndex++
    this.relabel()
    for (const rt of this.runtimes) {
      rt.trackedEmitted = false
      rt.decisionRequested = false
      rt.decision = undefined
      rt.decisionTime = undefined
      rt.recheckRounds = 0
      rt.sampledCap = undefined
      rt.ejectTime = undefined
      rt.skipInspection = !Number.isFinite(rt.gateTime) || rt.gateTime <= time
      rt.phase = this.isPast(rt, time) ? 'EXITED' : 'ENTERING'
    }
    this.lastTime = time
  }

  cameraConfidence(time: number): number {
    return this.scenario?.cameraConfidence?.(time) ?? 1
  }

  private isVisible(rt: TrackRuntime, time: number): boolean {
    if (rt.track.source === 'real') return time >= rt.track.enterTime && time <= rt.exitTime
    const b = bboxAt(rt.track, time)
    return b[0] + b[2] >= 0 && b[0] <= 1
  }

  private isPast(rt: TrackRuntime, time: number): boolean {
    if (rt.track.source === 'real') return time > rt.exitTime
    const b = bboxAt(rt.track, time)
    return b[0] > 1
  }

  /** 状態機械を time まで進める。アニメーションフレームごとに1回呼ぶ。 */
  update(time: number) {
    if (time < this.lastTime - 0.25) this.reset(time)
    this.lastTime = time
    const gen = this.generation

    for (const rt of this.runtimes) {
      if (rt.phase === 'EXITED') continue
      const { label } = rt
      const cx = centerXAt(rt.track, time)

      if (rt.phase === 'ENTERING') {
        if (this.isPast(rt, time)) {
          rt.phase = 'EXITED'
          continue
        }
        if (!this.isVisible(rt, time)) continue
        rt.phase = 'TRACKED'
        this.bus.emit('OBJECT_ENTERED', `${label} 進入検知`, {
          objectId: label,
          videoTime: time,
          data: { bbox: bboxAt(rt.track, time) },
        })
      }

      if (rt.phase === 'TRACKED') {
        if (!rt.trackedEmitted && time >= rt.track.enterTime + 0.3 && (rt.track.source === 'real' || cx > 0.12)) {
          rt.trackedEmitted = true
          this.bus.emit('OBJECT_TRACKED', `${label} 追跡確定 ボトル ${pct(rt.track.bottleConfidence)}`, {
            objectId: label,
            videoTime: time,
          })
        }
        if (!rt.skipInspection && cx >= CONVEYOR.gateX - CONVEYOR.zoneHalfWidth) {
          rt.phase = 'INSPECTING'
          const s = this.sampleReadings(rt, time)
          rt.sampledCap = s.cap
          rt.sampledBottle = s.bottle
          rt.sampledAlignment = s.alignment
          this.bus.emit('INSPECTION_STARTED', `${label} 検査開始`, { objectId: label, videoTime: time })
          this.bus.emit('CAP_CONFIDENCE', `${label} キャップ信頼度 ${s.cap.toFixed(2)}`, {
            objectId: label,
            videoTime: time,
            data: { capConfidence: s.cap, bottleConfidence: s.bottle, alignment: s.alignment },
          })
        }
      }

      if (rt.phase === 'INSPECTING' && !rt.decisionRequested && cx >= CONVEYOR.gateX) {
        rt.decisionRequested = true
        void this.runDecision(rt, time, gen)
      }

      if (
        rt.phase === 'DECIDED' &&
        rt.track.source === 'synthetic' &&
        rt.decision?.decision === 'REJECT' &&
        rt.ejectTime !== undefined &&
        time >= rt.ejectTime + 0.9
      ) {
        rt.phase = 'EXITED'
        this.bus.emit('OBJECT_EXITED', `${label} 退出（排出済）`, { objectId: label, videoTime: time })
        continue
      }

      if (this.isPast(rt, time)) {
        rt.phase = 'EXITED'
        this.bus.emit('OBJECT_EXITED', `${label} 退出`, { objectId: label, videoTime: time })
      }
    }
  }

  private isExited(rt: TrackRuntime): boolean {
    return rt.phase === 'EXITED'
  }

  private sampleReadings(rt: TrackRuntime, time: number, round = 0) {
    const noise = this.scenario?.noise ?? 0.2
    const cam = this.cameraConfidence(time)
    const jitter = (k: number) => smoothNoise(rt.track.seed + round * 17, time, k)
    let cap = rt.track.capConfidence + jitter(1) * 0.03 * (1 + noise * 2)
    let bottle = rt.track.bottleConfidence + jitter(2) * 0.015 * (1 + noise)
    // カメラ信頼度が下がると全ての読みが 0.5（判定不能）へ寄る
    cap = cap * cam + 0.5 * (1 - cam)
    bottle = bottle * (0.6 + 0.4 * cam)
    const alignment = clamp01(rt.track.capPositionScore + jitter(3) * 0.04)
    return { cap: clamp01(cap), bottle: clamp01(bottle), alignment }
  }

  private async runDecision(rt: TrackRuntime, time: number, gen: number) {
    const { label } = rt
    let previousFailures = 0
    let readings = {
      cap: rt.sampledCap ?? rt.track.capConfidence,
      bottle: rt.sampledBottle ?? rt.track.bottleConfidence,
      alignment: rt.sampledAlignment ?? rt.track.capPositionScore,
    }

    // 判断ループ: 再検査は1回だけ再サンプリングし、その後は最終判定
    for (let round = 0; round < 3; round++) {
      const state: InspectionState = {
        objectId: label,
        bottleConfidence: readings.bottle,
        capConfidence: readings.cap,
        alignmentScore: readings.alignment,
        inspectionZone: true,
        previousFailures,
        previousState: previousFailures > 0 ? 'recheck' : 'normal',
      }
      const result = await this.decide(state)
      if (gen !== this.generation || this.isExited(rt)) return

      const engineTag = result.engine === 'jev' ? 'JEV' : 'JEV(模擬)'
      this.bus.emit(result.decision, `${label} ${engineTag} → ${DECISION_JA[result.decision]} ${pct(result.confidence)}`, {
        objectId: label,
        videoTime: time,
        data: { decision: result, state, round },
      })

      if (result.decision === 'RECHECK') {
        previousFailures++
        rt.recheckRounds = previousFailures
        await new Promise((r) => setTimeout(r, 260))
        if (gen !== this.generation || this.isExited(rt)) return
        readings = this.sampleReadings(rt, this.lastTime, previousFailures)
        this.bus.emit('CAP_CONFIDENCE', `${label} キャップ信頼度 ${readings.cap.toFixed(2)}（再検査 ${previousFailures}回目）`, {
          objectId: label,
          videoTime: this.lastTime,
          data: { capConfidence: readings.cap, bottleConfidence: readings.bottle, alignment: readings.alignment },
        })
        continue
      }

      rt.decision = result
      rt.decisionTime = this.lastTime
      rt.phase = 'DECIDED'
      rt.sampledCap = readings.cap
      rt.sampledBottle = readings.bottle
      rt.sampledAlignment = readings.alignment

      this.bus.emit(
        'INSPECTION_COMPLETED',
        `${label} 検査完了 ${DECISION_JA[result.decision]}（${Math.round(result.latencyMs)}ミリ秒）`,
        {
          objectId: label,
          videoTime: this.lastTime,
          data: {
            decision: result,
            state,
            record: {
              timestamp: new Date().toISOString(),
              objectId: label,
              vision: { bottle: readings.bottle, cap: readings.cap, alignment: readings.alignment },
              decision: { result: result.decision, confidence: result.confidence, reason: result.reason, engine: result.engine },
              action: result.decision === 'REJECT' ? 'EJECT_SIMULATED' : result.action.replace(/ /g, '_'),
              latencyMs: result.latencyMs,
            },
          },
        },
      )

      if (result.decision === 'REJECT') {
        if (rt.track.source === 'synthetic') rt.ejectTime = this.lastTime + 0.35
        this.bus.emit('EJECT_TRIGGERED', `${label} 排出指令（模擬・ゲート02）`, {
          objectId: label,
          videoTime: this.lastTime,
          data: { simulated: true },
        })
      }
      return
    }
  }

  /** オーバーレイ用のフレーム検知結果。時刻と状態機械の純関数。 */
  sample(time: number): FrameSample {
    const noise = this.scenario?.noise ?? 0.2
    const cam = this.cameraConfidence(time)
    const detections: FrameDetection[] = []

    for (const rt of this.runtimes) {
      if (rt.phase === 'EXITED' || rt.phase === 'ENTERING') continue
      const { track } = rt
      if (!this.isVisible(rt, time)) continue
      const base = bboxAt(track, time)
      const cx = base[0] + base[2] / 2

      // 追跡ジッター: 実トラックは検出器由来の揺れが既にあるので小さめ
      const j = (0.0025 + noise * 0.008) * (track.source === 'real' ? 0.4 : 1)
      const bbox: NormalizedBBox = [
        base[0] + smoothNoise(track.seed, time, 1) * j,
        base[1] + smoothNoise(track.seed, time, 2) * j,
        base[2] * (1 + smoothNoise(track.seed, time, 3) * j * 2),
        base[3] * (1 + smoothNoise(track.seed, time, 4) * j),
      ]

      if (rt.ejectTime !== undefined && time >= rt.ejectTime) {
        const k = Math.min(1, (time - rt.ejectTime) / 0.9)
        bbox[1] += k * k * 0.5
        bbox[0] += k * 0.02
      }

      const live =
        rt.phase === 'DECIDED' && rt.sampledCap !== undefined
          ? {
              cap: rt.sampledCap,
              bottle: rt.sampledBottle ?? track.bottleConfidence,
              alignment: rt.sampledAlignment ?? track.capPositionScore,
            }
          : (() => {
              let cap = track.capConfidence + smoothNoise(track.seed, time, 5) * 0.025 * (1 + noise * 2)
              let bottle = track.bottleConfidence + smoothNoise(track.seed, time, 6) * 0.012 * (1 + noise)
              cap = cap * cam + 0.5 * (1 - cam)
              bottle = bottle * (0.6 + 0.4 * cam)
              return { cap: clamp01(cap), bottle: clamp01(bottle), alignment: track.capPositionScore }
            })()

      const detectionClass: DetectionClass = live.cap >= 0.5 ? 'CAPPED' : 'UNCAPPED'
      const classConfidence = detectionClass === 'CAPPED' ? live.cap : 1 - live.cap

      detections.push({
        trackId: track.id,
        label: rt.label,
        bbox,
        detectionClass,
        classConfidence,
        bottleConfidence: live.bottle,
        capConfidence: live.cap,
        capPositionScore: live.alignment,
        centerX: cx,
        phase: rt.phase,
        decision: rt.decision,
        gateTime: rt.decisionTime,
      })
    }
    return { time, detections, cameraConfidence: cam }
  }

  /** 合成映像描画用の真値位置（検知結果ではない） */
  groundTruth(time: number) {
    const out: Array<{ track: BottleTrack; bbox: NormalizedBBox; ejected: number }> = []
    for (const rt of this.runtimes) {
      if (rt.track.source !== 'synthetic') continue
      const bbox = bboxAt(rt.track, time)
      const cx = bbox[0] + bbox[2] / 2
      if (cx + bbox[2] / 2 < -0.05 || cx - bbox[2] / 2 > 1.05) continue
      let ejected = 0
      if (rt.ejectTime !== undefined && time >= rt.ejectTime) ejected = Math.min(1, (time - rt.ejectTime) / 0.9)
      out.push({ track: rt.track, bbox, ejected })
    }
    return out
  }

  get options() {
    return OBJECT_DECISION_OPTIONS
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
