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
import { CONVEYOR, bboxAt, exitTimeOf, gateTimeOf, type BottleTrack } from '@/data/demoDetections'
import type { EventBus } from './eventBus'

/**
 * SIMULATION MODE computer-vision layer.
 *
 * Replays bottle tracks against the playback clock and produces per-frame
 * detections with tracking jitter. Also owns the object lifecycle state machine
 * (ENTERING → TRACKED → INSPECTING → DECIDED → EXITED) and emits structured
 * events on the bus. The decision itself is delegated through `decide`, so the
 * decision engine (simulation or Jev) can be swapped without touching this file.
 *
 * Production replacement: a detector (YOLO / RT-DETR via ONNX Runtime) plus a
 * tracker (ByteTrack) that emits the same `FrameDetection` objects.
 */

export type DecideFn = (state: InspectionState) => Promise<DecisionResult>

interface TrackRuntime {
  track: BottleTrack
  label: string
  phase: TrackPhase
  gateTime: number
  exitTime: number
  trackedEmitted: boolean
  inspectionStarted: boolean
  decisionRequested: boolean
  decision?: DecisionResult
  decisionTime?: number
  recheckRounds: number
  /** Cap confidence sampled at the gate (with noise / camera effects applied). */
  sampledCap?: number
  sampledBottle?: number
  sampledAlignment?: number
  /** Time at which an ejected bottle leaves the belt. */
  ejectTime?: number
}

export interface SimulatorOptions {
  bus: EventBus
  decide: DecideFn
}

export interface FrameSample {
  time: number
  detections: FrameDetection[]
  /** Camera confidence multiplier at this time (1 = nominal). */
  cameraConfidence: number
}

const smoothNoise = (seed: number, t: number, k: number) =>
  Math.sin(t * (2.3 + k * 0.7) + seed * 0.001) * 0.5 + Math.sin(t * (5.1 + k * 1.3) + seed * 0.0007) * 0.3 + Math.sin(t * 11.7 + seed * 0.0003) * 0.2

export class VideoDetectionSimulator {
  private bus: EventBus
  private decide: DecideFn
  private runtimes: TrackRuntime[] = []
  private scenario: ScenarioDefinition | null = null
  private lastTime = -Infinity
  private generation = 0

  constructor(opts: SimulatorOptions) {
    this.bus = opts.bus
    this.decide = opts.decide
  }

  load(tracks: BottleTrack[], scenario: ScenarioDefinition, startTime = 0) {
    this.generation++
    this.scenario = scenario
    this.runtimes = tracks.map((track) => ({
      track,
      label: `#${String(track.id).padStart(3, '0')}`,
      phase: 'ENTERING',
      gateTime: gateTimeOf(track),
      exitTime: exitTimeOf(track),
      trackedEmitted: false,
      inspectionStarted: false,
      decisionRequested: false,
      recheckRounds: 0,
    }))
    this.reset(startTime)
  }

  /** Reset lifecycle state for a seek/loop. Objects already past the gate are silently skipped. */
  reset(time: number) {
    this.generation++
    for (const rt of this.runtimes) {
      const cx = this.centerX(rt, time)
      rt.trackedEmitted = false
      rt.inspectionStarted = false
      rt.decisionRequested = false
      rt.decision = undefined
      rt.decisionTime = undefined
      rt.recheckRounds = 0
      rt.sampledCap = undefined
      rt.ejectTime = undefined
      if (cx >= CONVEYOR.gateX) rt.phase = 'EXITED'
      else rt.phase = 'ENTERING'
    }
    this.lastTime = time
  }

  cameraConfidence(time: number): number {
    return this.scenario?.cameraConfidence?.(time) ?? 1
  }

  private centerX(rt: TrackRuntime, time: number) {
    return CONVEYOR.entryX + (time - rt.track.enterTime) * rt.track.speed
  }

  /** Advance the lifecycle state machine to `time`. Call once per animation frame. */
  update(time: number) {
    if (time < this.lastTime - 0.25) this.reset(time)
    this.lastTime = time
    const gen = this.generation

    for (const rt of this.runtimes) {
      if (rt.phase === 'EXITED') continue
      const cx = this.centerX(rt, time)
      const halfW = rt.track.width / 2
      const { label } = rt

      if (rt.phase === 'ENTERING') {
        if (cx + halfW < 0) continue
        if (cx - halfW > 1) {
          rt.phase = 'EXITED'
          continue
        }
        rt.phase = 'TRACKED'
        this.bus.emit('OBJECT_ENTERED', `${label} OBJECT_ENTERED`, {
          objectId: label,
          videoTime: time,
          data: { bbox: bboxAt(rt.track, time) },
        })
      }

      if (rt.phase === 'TRACKED') {
        if (!rt.trackedEmitted && cx > 0.12) {
          rt.trackedEmitted = true
          this.bus.emit('OBJECT_TRACKED', `${label} OBJECT_TRACKED conf ${(rt.track.bottleConfidence * 100).toFixed(0)}%`, {
            objectId: label,
            videoTime: time,
          })
        }
        if (cx >= CONVEYOR.gateX - CONVEYOR.zoneHalfWidth) {
          rt.phase = 'INSPECTING'
          rt.inspectionStarted = true
          const s = this.sampleReadings(rt, time)
          rt.sampledCap = s.cap
          rt.sampledBottle = s.bottle
          rt.sampledAlignment = s.alignment
          this.bus.emit('INSPECTION_STARTED', `${label} INSPECTION_STARTED`, { objectId: label, videoTime: time })
          this.bus.emit('CAP_CONFIDENCE', `${label} CAP_CONFIDENCE ${s.cap.toFixed(2)}`, {
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

      if (rt.phase === 'DECIDED' && rt.decision?.decision === 'REJECT' && rt.ejectTime !== undefined && time >= rt.ejectTime + 0.9) {
        rt.phase = 'EXITED'
        this.bus.emit('OBJECT_EXITED', `${label} OBJECT_EXITED (EJECTED)`, { objectId: label, videoTime: time })
        continue
      }

      if (cx - halfW > 1) {
        // Left the frame. If still deciding, the decision result will be dropped silently.
        rt.phase = 'EXITED'
        this.bus.emit('OBJECT_EXITED', `${label} OBJECT_EXITED`, { objectId: label, videoTime: time })
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
    // Low camera confidence pulls every reading towards 0.5 (ambiguity), and lowers bottle confidence.
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

    // Decision loop: RECHECK re-samples once, then a final decision is taken.
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

      const pct = Math.round(result.confidence * 100)
      const engineTag = result.engine === 'jev' ? 'JEV' : 'JEV(sim)'
      this.bus.emit(result.decision, `${label} ${engineTag} → ${result.decision} ${pct}%`, {
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
        this.bus.emit('CAP_CONFIDENCE', `${label} CAP_CONFIDENCE ${readings.cap.toFixed(2)} (recheck ${previousFailures})`, {
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

      this.bus.emit('INSPECTION_COMPLETED', `${label} INSPECTION_COMPLETED ${result.decision} (${Math.round(result.latencyMs)} ms)`, {
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
      })

      if (result.decision === 'REJECT') {
        rt.ejectTime = this.lastTime + 0.35
        this.bus.emit('EJECT_TRIGGERED', `${label} EJECT_TRIGGERED (SIMULATED, GATE 02)`, {
          objectId: label,
          videoTime: this.lastTime,
          data: { simulated: true },
        })
      }
      return
    }
  }

  /** Per-frame detections for the overlay. Pure function of time and lifecycle state. */
  sample(time: number): FrameSample {
    const noise = this.scenario?.noise ?? 0.2
    const cam = this.cameraConfidence(time)
    const detections: FrameDetection[] = []

    for (const rt of this.runtimes) {
      if (rt.phase === 'EXITED' || rt.phase === 'ENTERING') continue
      const { track } = rt
      const base = bboxAt(track, time)
      const cx = base[0] + base[2] / 2
      if (cx + base[2] / 2 < 0 || cx - base[2] / 2 > 1) continue

      // Tracking jitter: small, smooth, scenario-scaled.
      const j = 0.0025 + noise * 0.008
      const bbox: NormalizedBBox = [
        base[0] + smoothNoise(track.seed, time, 1) * j,
        base[1] + smoothNoise(track.seed, time, 2) * j,
        base[2] * (1 + smoothNoise(track.seed, time, 3) * j * 2),
        base[3] * (1 + smoothNoise(track.seed, time, 4) * j),
      ]

      // Ejected bottles get pushed off the belt (downwards) after the gate.
      if (rt.ejectTime !== undefined && time >= rt.ejectTime) {
        const k = Math.min(1, (time - rt.ejectTime) / 0.9)
        bbox[1] += k * k * 0.5
        bbox[0] += k * 0.02
      }

      const live = rt.phase === 'DECIDED' && rt.sampledCap !== undefined
        ? { cap: rt.sampledCap, bottle: rt.sampledBottle ?? track.bottleConfidence, alignment: rt.sampledAlignment ?? track.capPositionScore }
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

  /** Ground-truth positions for the synthetic feed renderer (not detections). */
  groundTruth(time: number) {
    const out: Array<{ track: BottleTrack; bbox: NormalizedBBox; ejected: number }> = []
    for (const rt of this.runtimes) {
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
