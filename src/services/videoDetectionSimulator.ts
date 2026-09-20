import type {
  DecisionResult,
  DetectionClass,
  FrameDetection,
  InspectionProfile,
  InspectionState,
  NormalizedBBox,
  ScenarioDefinition,
  TrackPhase,
} from '@/types/inspection'
import { OBJECT_DECISION_OPTIONS } from '@/types/inspection'
import { bboxAt, currentTrigger, exitTimeOf, gateProgress, gateTimeOf, inZone, keypointsAt, type BottleTrack } from '@/data/demoDetections'
import { FallDetector } from './fallDetector'
import { CrosswalkAnalyzer, type SceneItem } from './crosswalkAnalyzer'
import type { StateReading } from '@/types/inspection'
import { inspectionStore } from './inspectionStore'
import { PROFILES, DEFAULT_PROFILE_ID } from '@/profiles'
import { decisionJa } from '@/i18n/ja'
import type { EventBus } from './eventBus'
import { measureFillLevel, type FramePixelSource } from './fillLevelMeter'
import { harvestText, measureRipeness } from './ripenessMeter'
import { gradeLabel, areaSeverity, attributeSeverity, gradeFromSeverity, measurementSeverity, sceneSeverity, summarizeSamples } from './grading'
import type { MeasurementReading } from '@/types/inspection'

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
  /** ゾーン型トリガー: ゾーンに入った時刻 */
  zoneEnteredAt?: number
  trackedEmitted: boolean
  decisionRequested: boolean
  decision?: DecisionResult
  decisionTime?: number
  recheckRounds: number
  sampledAttribute?: number
  sampledObject?: number
  sampledAlignment?: number
  sampledMeasurement?: InspectionState['measurement']
  /** 排出ボトルがベルトから外れ始める時刻（合成トラックのみ） */
  ejectTime?: number
  /** 計測プロファイル: 移動平均した最新の計測値 */
  measurement?: MeasurementReading
  measureSamples: number
  /** 状態解析プロファイル: 転倒判定器（転倒検知）と最新状態 */
  fall?: FallDetector
  person?: StateReading
  personSince?: number
  /** 判定確定後に起き上がったら再度判定できるようにする */
  recoveredAt?: number
  /** 路面損傷: これまでに観測した最大の枠面積比 */
  maxArea?: number
  /** 検査中に集めた証拠（フレームごとの主要な読み: 属性信頼度 / 計測値 / 1−場面スコア） */
  evidence: number[]
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
  private profile: InspectionProfile = PROFILES[DEFAULT_PROFILE_ID]
  private lastTime = -Infinity
  private generation = 0
  /** ループ回数。周回ごとに追跡番号をずらして重複させない */
  private loopIndex = 0
  private idStride = 200
  /** 計測プロファイルで画素を読む元（映像 or 合成キャンバス）。VideoInspection が設定する */
  pixelSource: FramePixelSource | null = null
  private frameCounter = 0
  private lastLiveUpdate = 0
  /** 横断歩道監視: 場面全体の解析器 */
  private crosswalk: CrosswalkAnalyzer | null = null

  constructor(opts: SimulatorOptions) {
    this.bus = opts.bus
    this.decide = opts.decide
  }

  load(tracks: BottleTrack[], scenario: ScenarioDefinition, profile: InspectionProfile, startTime = 0) {
    this.generation++
    this.scenario = scenario
    this.profile = profile
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
      measureSamples: 0,
      evidence: [],
    }))
    this.lastLiveUpdate = 0
    this.crosswalk = profile.analyzer === 'crosswalk' ? new CrosswalkAnalyzer(profile) : null
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
      rt.sampledAttribute = undefined
      rt.zoneEnteredAt = undefined
      rt.ejectTime = undefined
      rt.measurement = undefined
      rt.measureSamples = 0
      rt.maxArea = undefined
      rt.evidence = []
      rt.fall?.reset()
      this.crosswalk?.reset()
      rt.person = undefined
      rt.personSince = undefined
      rt.recoveredAt = undefined
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

    const trigger = currentTrigger()
    const attrLabel = this.profile.attributeLabel
    const mspec = this.profile.measurement
    this.frameCounter++
    let sceneReadings: Map<number, StateReading> | null = null
    if (this.crosswalk) {
      const items: SceneItem[] = []
      for (const rt of this.runtimes) {
        if (rt.phase === 'EXITED' || !this.isVisible(rt, time)) continue
        items.push({ id: rt.track.id, label: rt.label, cls: rt.track.cls ?? 'object', bbox: bboxAt(rt.track, time) })
      }
      sceneReadings = this.crosswalk.update(time, items)
    }

    for (const rt of this.runtimes) {
      if (rt.phase === 'EXITED') continue
      const { label } = rt
      const bbox = bboxAt(rt.track, time)
      const cx = bbox[0] + bbox[2] / 2

      // 計測プロファイル: ゲート手前〜判定直後の物体は毎フレーム画素を読んで液面を求め、移動平均する
      if (mspec && this.pixelSource && (rt.phase === 'TRACKED' || rt.phase === 'INSPECTING' || rt.phase === 'DECIDED') && this.frameCounter % 2 === 0) {
        const g = trigger.kind === 'gate' ? gateProgress(bbox) : null
        const near = g ? g.p >= g.gate - g.half && g.p <= g.gate + 0.1 : inZone(bbox)
        if (near) {
          const img = this.pixelSource.crop(bbox, 40)
          const r = img ? (mspec.method === 'ripeness' ? measureRipeness(img) : measureFillLevel(img)) : null
          if (r) {
            const truth = rt.track.fillLevel
            if (!rt.measurement || rt.phase === 'DECIDED') {
              if (!rt.measurement) rt.measurement = { ...r, truth }
            } else {
              const a = rt.measureSamples < 4 ? 0.5 : 0.25
              rt.measurement = {
                value: rt.measurement.value + (r.value - rt.measurement.value) * a,
                confidence: rt.measurement.confidence + (r.confidence - rt.measurement.confidence) * a,
                tiltDeg: rt.measurement.tiltDeg + (r.tiltDeg - rt.measurement.tiltDeg) * a,
                truth,
              }
            }
            rt.measureSamples++
          }
        }
      }

      // 状態解析プロファイル: 毎フレーム状態を更新する（転倒検知は物体ごと、横断歩道監視は場面全体）
      if (trigger.kind === 'state' && rt.track.source === 'real' && rt.phase !== 'ENTERING' && this.isVisible(rt, time)) {
        const prevState = rt.person?.state ?? ''
        if (this.crosswalk) {
          const reading = sceneReadings?.get(rt.track.id)
          if (reading) rt.person = reading
        } else {
          if (!rt.fall) rt.fall = new FallDetector()
          rt.person = rt.fall.update(time, bbox, keypointsAt(rt.track, time))
        }
        const isSubject = this.crosswalk ? CrosswalkAnalyzer.classOf(rt.track.cls) === 'pedestrian' : true
        if (rt.person && isSubject) {
          const r = rt.person
          if (r.state !== prevState) {
            rt.personSince = time
            if (r.level !== 'normal' && rt.phase === 'TRACKED') {
              rt.phase = 'INSPECTING'
              const s = this.sampleReadings(rt, time)
              rt.sampledAttribute = s.attribute
              rt.sampledObject = s.object
              rt.sampledAlignment = s.alignment
              this.bus.emit('INSPECTION_STARTED', `${label} ${r.stateLabel}`, { objectId: label, videoTime: time, severity: 'warn' })
            } else if (this.crosswalk && r.state === 'CROSSING' && rt.phase === 'TRACKED') {
              rt.phase = 'INSPECTING'
              this.bus.emit('INSPECTION_STARTED', `${label} 横断開始`, { objectId: label, videoTime: time })
            } else if (r.level === 'normal' && (rt.phase === 'DECIDED' || rt.phase === 'INSPECTING')) {
              const finishedCrossing = this.crosswalk && (r.state === 'SIDEWALK' || r.state === 'WAITING')
              if (this.crosswalk && rt.phase === 'INSPECTING' && !rt.decisionRequested && finishedCrossing) {
                // 危険なく横断を終えた: 安全横断として判定を確定する
                rt.decisionRequested = true
                const s = this.sampleReadings(rt, time)
                rt.sampledAttribute = s.attribute
                rt.sampledObject = s.object
                rt.sampledAlignment = s.alignment
                void this.runDecision(rt, time, gen)
              } else if (!this.crosswalk) {
                this.bus.emit('OBJECT_TRACKED', `${label} 起き上がりを確認（警報解除）`, { objectId: label, videoTime: time, severity: 'ok', data: { recovered: true } })
                rt.phase = 'TRACKED'
                rt.decision = undefined
                rt.decisionTime = undefined
                rt.decisionRequested = false
                rt.recheckRounds = 0
                rt.recoveredAt = time
              } else if (rt.phase === 'DECIDED' && finishedCrossing) {
                this.bus.emit('OBJECT_TRACKED', `${label} 横断を完了（警報解除）`, { objectId: label, videoTime: time, severity: 'ok', data: { recovered: true } })
              }
            }
          }
          if (rt.phase === 'INSPECTING' && !rt.decisionRequested && r.level === 'alert' && time - (rt.personSince ?? time) >= trigger.confirmSeconds) {
            rt.decisionRequested = true
            const s = this.sampleReadings(rt, time)
            rt.sampledAttribute = s.attribute
            rt.sampledObject = s.object
            rt.sampledAlignment = s.alignment
            this.bus.emit('ATTRIBUTE_CONFIDENCE', `${label} ${r.stateLabel} ${r.holdSeconds.toFixed(1)}秒 · 異常スコア ${r.score.toFixed(2)}${r.note ? ' · ' + r.note : ''}`, {
              objectId: label,
              videoTime: time,
              data: { attributeConfidence: s.attribute, objectConfidence: s.object, alignment: s.alignment, scene: s.scene },
            })
            void this.runDecision(rt, time, gen)
          }
        }
        // 注目物体（異常スコア最大）の状態を約 5 Hz でストアへ
        if (time - this.lastLiveUpdate > 0.2 || time < this.lastLiveUpdate) {
          const best = this.runtimes
            .filter((r) => r.person && r.phase !== 'EXITED' && r.phase !== 'ENTERING' && this.isVisible(r, time))
            .sort((a, b) => b.person!.score - a.person!.score)[0]
          if (best?.person) {
            this.lastLiveUpdate = time
            inspectionStore.updateLivePerson(best.label, best.person)
          }
        }
      }

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
          this.bus.emit('OBJECT_TRACKED', `${label} 追跡確定 ${this.profile.objectLabel} ${pct(rt.track.objectConfidence)}`, {
            objectId: label,
            videoTime: time,
          })
        }
        let startInspection = false
        if (!rt.skipInspection && trigger.kind !== 'state') {
          if (trigger.kind === 'gate') {
            const g = gateProgress(bbox)
            startInspection = g.p >= g.gate - g.half
          } else if (inZone(bbox)) {
            startInspection = true
            rt.zoneEnteredAt = time
          }
        }
        if (startInspection) {
          rt.phase = 'INSPECTING'
          const s = this.sampleReadings(rt, time)
          rt.sampledAttribute = s.attribute
          rt.sampledObject = s.object
          rt.sampledAlignment = s.alignment
          rt.sampledMeasurement = s.measurement
          this.bus.emit('INSPECTION_STARTED', `${label} 検査開始`, { objectId: label, videoTime: time })
          this.bus.emit(
            'ATTRIBUTE_CONFIDENCE',
            s.measurement
              ? s.measurement.confidence > 0
                ? `${label} ${mspec?.label ?? attrLabel} ${(s.measurement.value * 100).toFixed(1)}%${mspec?.method === 'ripeness' ? ' · ' + harvestText(s.measurement.value) : ''}（計測信頼度 ${s.measurement.confidence.toFixed(2)}）`
                : `${label} ${mspec?.label ?? attrLabel} 計測中`
              : this.profile.severityFromArea
                ? `${label} ${this.profile.severityFromArea.label} ${((rt.maxArea ?? 0) * 100).toFixed(2)}% · 重症度 ${(1 - s.attribute).toFixed(2)}`
                : `${label} ${attrLabel}信頼度 ${s.attribute.toFixed(2)}`,
            {
              objectId: label,
              videoTime: time,
              data: { attributeConfidence: s.attribute, objectConfidence: s.object, alignment: s.alignment, measurement: s.measurement },
            },
          )
        }
      }

      // 複数フレームの証拠集め: 検査中（ゲート手前の帯・ステーション滞留・状態の確認中）は毎フレーム読みを蓄える
      if (rt.phase === 'INSPECTING' && !rt.decisionRequested) {
        const s = this.sampleReadings(rt, time)
        this.pushEvidence(rt, s)
      }

      if (rt.phase === 'INSPECTING' && !rt.decisionRequested && trigger.kind !== 'state') {
        let decideNow = false
        if (trigger.kind === 'gate') {
          const g = gateProgress(bbox)
          decideNow = g.p >= g.gate
        } else if (!inZone(bbox)) {
          // ゾーンから出た: 滞留時間を満たす前なら検査をやり直す
          rt.phase = 'TRACKED'
          rt.zoneEnteredAt = undefined
          this.bus.emit('OBJECT_TRACKED', `${label} ステーションから離脱（検査中断）`, { objectId: label, videoTime: time, severity: 'warn' })
        } else if (rt.zoneEnteredAt !== undefined && time - rt.zoneEnteredAt >= trigger.dwellSeconds) {
          decideNow = true
        }
        if (decideNow) {
          rt.decisionRequested = true
          if (mspec || this.profile.severityFromArea) {
            // 計測プロファイルはゲート通過時点の移動平均値、面積重症度はゲート通過時点の枠面積で判断する
            const s = this.sampleReadings(rt, time)
            rt.sampledAttribute = s.attribute
            rt.sampledObject = s.object
            rt.sampledAlignment = s.alignment
            rt.sampledMeasurement = s.measurement
          }
          void this.runDecision(rt, time, gen)
        }
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
        const lostWhileAbnormal = rt.person && rt.person.level !== 'normal'
        rt.person = undefined
        this.bus.emit('OBJECT_EXITED', lostWhileAbnormal ? `${label} 追跡終了（異常状態のまま見失い）` : `${label} 退出`, { objectId: label, videoTime: time, severity: lostWhileAbnormal ? 'warn' : 'info' })
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
    if (currentTrigger().kind === 'state' && rt.person) {
      const p = rt.person
      const attribute = clamp01(1 - p.score) * cam + 0.5 * (1 - cam)
      const object = clamp01((rt.track.objectConfidence + jitter(2) * 0.015 * (1 + noise)) * (0.6 + 0.4 * cam))
      const alignment = clamp01(1 - p.score)
      return {
        attribute,
        object,
        alignment,
        measurement: undefined as InspectionState['measurement'],
        scene: {
          state: p.state,
          level: p.level,
          score: p.score,
          holdSeconds: p.holdSeconds,
          confidence: p.confidence * cam,
          features: Object.fromEntries(p.features.map((f) => [f.key, f.value])),
        } as InspectionState['scene'],
      }
    }
    const sev = this.profile.severityFromArea
    if (sev) {
      // 路面損傷: 検出枠の面積比（実測）から重症度を出す。面積が大きいほど属性信頼度が下がり、不良（要補修）側へ
      const b = bboxAt(rt.track, time)
      // 手前に来るほど枠が大きくなるので、これまでの最大面積で重症度を決める
      rt.maxArea = Math.max(rt.maxArea ?? 0, b[2] * b[3])
      const area = rt.maxArea
      const severity = Math.min(1, area / sev.fullArea)
      const attribute = clamp01(1 - severity) * cam + 0.5 * (1 - cam)
      const object = clamp01((rt.track.objectConfidence + jitter(2) * 0.015 * (1 + noise)) * (0.6 + 0.4 * cam))
      return { attribute, object, alignment: clamp01(1 - Math.abs(b[0] + b[2] / 2 - 0.5) * 2), measurement: undefined as InspectionState['measurement'], scene: undefined as InspectionState['scene'] }
    }
    const mspec = this.profile.measurement
    if (mspec) {
      // 実測値から属性信頼度を作る: 目標からのずれが許容幅の n 倍なら 1 - 0.25n
      // 真値は決して使わない: まだ画素を読めていなければ「計測できていない」として扱う
      const m = rt.measurement
      const value = m ? m.value : 0
      const mconf = m ? m.confidence : 0
      const dev = Math.abs(value - mspec.target) / Math.max(1e-6, mspec.tolerance)
      const attribute = clamp01(1 - 0.25 * dev) * cam + 0.5 * (1 - cam)
      const object = clamp01((rt.track.objectConfidence + jitter(2) * 0.015 * (1 + noise)) * (0.6 + 0.4 * cam))
      const alignment = clamp01(1 - Math.abs(m?.tiltDeg ?? 0) / 10)
      return { attribute, object, alignment, measurement: { key: mspec.key, value, target: mspec.target, tolerance: mspec.tolerance, confidence: mconf * cam, tiltDeg: m?.tiltDeg ?? 0, truth: rt.track.fillLevel }, scene: undefined as InspectionState['scene'] }
    }
    let attribute = rt.track.attributeConfidence + jitter(1) * 0.03 * (1 + noise * 2)
    let object = rt.track.objectConfidence + jitter(2) * 0.015 * (1 + noise)
    // カメラ信頼度が下がると全ての読みが 0.5（判定不能）へ寄る
    attribute = attribute * cam + 0.5 * (1 - cam)
    object = object * (0.6 + 0.4 * cam)
    const alignment = clamp01(rt.track.alignmentScore + jitter(3) * 0.04)
    return { attribute: clamp01(attribute), object: clamp01(object), alignment, measurement: undefined as InspectionState['measurement'], scene: undefined as InspectionState['scene'] }
  }

  /** 証拠の主要な読み（プロファイル種別ごと）を蓄える。直近 60 件まで */
  private pushEvidence(rt: TrackRuntime, s: ReturnType<VideoDetectionSimulator['sampleReadings']>) {
    const v = s.measurement ? (s.measurement.confidence > 0 ? s.measurement.value : undefined) : s.scene ? 1 - s.scene.score : s.attribute
    if (v === undefined || !Number.isFinite(v)) return
    rt.evidence.push(v)
    // 状態解析は値が時間とともに変わるのが正常なので、状態の継続時間に合わせた直近の窓だけを安定度の材料にする
    // （継続 0.25〜1.5 秒 → 15〜90 フレーム）
    const cap = s.scene ? Math.round(Math.min(1.5, Math.max(0.25, s.scene.holdSeconds)) * 60) : 60
    while (rt.evidence.length > cap) rt.evidence.shift()
  }

  /** 蓄えた証拠の要約。中央値は属性プロファイルでは判断に、他では安定度の材料に使う */
  private buildEvidence(rt: TrackRuntime, finalReading: number): InspectionState['evidence'] {
    const sum = summarizeSamples(rt.evidence)
    const stats = inspectionStore.windowStats(Date.now())
    // 面積重症度は「これまでの最大面積」で決めるので、中央値ではなく最終値を代表値にする
    const median = this.profile.severityFromArea ? finalReading : sum.median
    return { samples: sum.samples, median, spread: sum.spread, stability: sum.stability, recentRejectRate: stats.rejectRate }
  }

  /** 生の読みから暫定の異常度（オーバーレイの色付け用） */
  private liveSeverity(rt: TrackRuntime, attribute: number, meas: MeasurementReading | undefined, area: number): number | undefined {
    if (rt.person) return sceneSeverity(rt.person.level, rt.person.score)
    const mspec = this.profile.measurement
    if (mspec) return meas && meas.confidence > 0 ? measurementSeverity(Math.abs(meas.value - mspec.target) / Math.max(1e-6, mspec.tolerance)) : undefined
    const sev = this.profile.severityFromArea
    if (sev) return areaSeverity(Math.max(rt.maxArea ?? 0, area) / sev.fullArea)
    return attributeSeverity(attribute)
  }

  private async runDecision(rt: TrackRuntime, time: number, gen: number) {
    const { label } = rt
    let previousFailures = 0
    let readings = {
      attribute: rt.sampledAttribute ?? rt.track.attributeConfidence,
      object: rt.sampledObject ?? rt.track.objectConfidence,
      alignment: rt.sampledAlignment ?? rt.track.alignmentScore,
      measurement: rt.sampledMeasurement,
      scene: rt.person ? this.sampleReadings(rt, time).scene : undefined,
    }
    const isAttributeProfile = !this.profile.measurement && !this.profile.severityFromArea && !readings.scene

    // 判断ループ: 再検査は1回だけ再サンプリングし、その後は最終判定
    for (let round = 0; round < 3; round++) {
      const evidence = this.buildEvidence(rt, readings.attribute)
      // 属性プロファイルは複数フレームの中央値を判断と表示の代表値にする
      if (isAttributeProfile && evidence && evidence.samples >= 3) readings = { ...readings, attribute: evidence.median }
      const state: InspectionState = {
        objectId: label,
        objectConfidence: readings.object,
        attributeConfidence: readings.attribute,
        alignmentScore: readings.alignment,
        measurement: readings.measurement,
        scene: readings.scene,
        evidence,
        inspectionZone: true,
        previousFailures,
        previousState: previousFailures > 0 ? 'recheck' : 'normal',
      }
      const result = await this.decide(state)
      if (gen !== this.generation || this.isExited(rt)) return

      const engineTag = result.engine === 'jev' ? 'JEV' : 'JEV(模擬)'
      const gradeTag = `${result.grade} ${gradeLabel(result.grade, this.profile)}`
      this.bus.emit(result.decision, `${label} ${engineTag} → ${gradeTag} · ${decisionJa(result.decision, this.profile)} ${pct(result.confidence)}（証拠 ${evidence?.samples ?? 0}フレーム）`, {
        objectId: label,
        videoTime: time,
        data: { decision: result, state, round },
      })

      if (result.decision === 'RECHECK') {
        previousFailures++
        rt.recheckRounds = previousFailures
        await new Promise((r) => setTimeout(r, readings.scene ? 1000 : 260))
        if (gen !== this.generation || this.isExited(rt)) return
        readings = this.sampleReadings(rt, this.lastTime, previousFailures)
        this.pushEvidence(rt, readings)
        this.bus.emit(
          'ATTRIBUTE_CONFIDENCE',
          readings.measurement
            ? `${label} ${this.profile.measurement?.label} ${(readings.measurement.value * 100).toFixed(1)}%（再計測 ${previousFailures}回目）`
            : readings.scene
              ? `${label} 経過観察 ${previousFailures}回目 · 状態 ${rt.person?.stateLabel ?? readings.scene.state} · 異常スコア ${readings.scene.score.toFixed(2)}`
              : `${label} ${this.profile.attributeLabel}信頼度 ${readings.attribute.toFixed(2)}（再検査 ${previousFailures}回目）`,
          {
            objectId: label,
            videoTime: this.lastTime,
            data: { attributeConfidence: readings.attribute, objectConfidence: readings.object, alignment: readings.alignment, measurement: readings.measurement },
          },
        )
        continue
      }

      rt.decision = result
      rt.decisionTime = this.lastTime
      rt.phase = 'DECIDED'
      rt.sampledAttribute = readings.attribute
      rt.sampledObject = readings.object
      rt.sampledAlignment = readings.alignment
      rt.sampledMeasurement = readings.measurement

      this.bus.emit(
        'INSPECTION_COMPLETED',
        `${label} 判定確定 ${result.grade} ${gradeLabel(result.grade, this.profile)} · ${decisionJa(result.decision, this.profile)}（${Math.round(result.latencyMs)}ミリ秒）`,
        {
          objectId: label,
          videoTime: this.lastTime,
          data: {
            decision: result,
            state,
            record: {
              timestamp: new Date().toISOString(),
              objectId: label,
              vision: { object: readings.object, attribute: readings.attribute, alignment: readings.alignment },
              measurement: readings.measurement ? { key: readings.measurement.key, value: readings.measurement.value, target: readings.measurement.target, tolerance: readings.measurement.tolerance, truth: rt.track.fillLevel } : undefined,
              decision: { result: result.decision, confidence: result.confidence, reason: result.reason, engine: result.engine, grade: result.grade, severity: result.severity },
              action: result.decision === 'REJECT' ? 'EJECT_SIMULATED' : result.action,
              latencyMs: result.latencyMs,
            },
          },
        },
      )

      if (result.decision === 'REJECT') {
        if (rt.track.source === 'synthetic') rt.ejectTime = this.lastTime + 0.35
        this.bus.emit('EJECT_TRIGGERED', `${label} ${this.profile.rejectAction}（模擬）`, {
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
        rt.phase === 'DECIDED' && rt.sampledAttribute !== undefined
          ? {
              attribute: rt.sampledAttribute,
              object: rt.sampledObject ?? track.objectConfidence,
              alignment: rt.sampledAlignment ?? track.alignmentScore,
            }
          : (() => {
              let attribute = track.attributeConfidence + smoothNoise(track.seed, time, 5) * 0.025 * (1 + noise * 2)
              let object = track.objectConfidence + smoothNoise(track.seed, time, 6) * 0.012 * (1 + noise)
              attribute = attribute * cam + 0.5 * (1 - cam)
              object = object * (0.6 + 0.4 * cam)
              return { attribute: clamp01(attribute), object: clamp01(object), alignment: track.alignmentScore }
            })()

      let detectionClass: DetectionClass = live.attribute >= 0.5 ? 'OK' : 'NG'
      let classConfidence = detectionClass === 'OK' ? live.attribute : 1 - live.attribute
      const mspec = this.profile.measurement
      const meas = mspec ? (rt.phase === 'DECIDED' && rt.sampledMeasurement ? { value: rt.sampledMeasurement.value, confidence: rt.sampledMeasurement.confidence, tiltDeg: rt.sampledMeasurement.tiltDeg, truth: track.fillLevel } : rt.measurement) : undefined
      if (mspec && meas) {
        detectionClass = Math.abs(meas.value - mspec.target) <= mspec.tolerance ? 'OK' : 'NG'
        classConfidence = meas.confidence
      }
      const sev = this.profile.severityFromArea
      if (sev) {
        const area = bbox[2] * bbox[3]
        detectionClass = area / sev.fullArea >= 0.5 ? 'NG' : 'OK'
        classConfidence = Math.min(1, area / sev.fullArea)
      }
      const keypoints = keypointsAt(track, time)
      if (rt.person) {
        detectionClass = rt.person.level === 'normal' ? 'OK' : 'NG'
        classConfidence = rt.person.level === 'normal' ? 1 - rt.person.score : rt.person.score
      }

      const liveSev = rt.decision ? rt.decision.severity : this.liveSeverity(rt, live.attribute, meas, bbox[2] * bbox[3])
      const provisionalGrade = rt.decision ? rt.decision.grade : liveSev !== undefined ? gradeFromSeverity(liveSev) : undefined

      detections.push({
        trackId: track.id,
        label: rt.label,
        bbox,
        detectionClass,
        classConfidence,
        provisionalGrade,
        liveSeverity: liveSev,
        objectConfidence: live.object,
        attributeConfidence: live.attribute,
        alignmentScore: live.alignment,
        centerX: cx,
        phase: rt.phase,
        measurement: meas,
        keypoints,
        personState: rt.person,
        objectClass: track.cls,
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
