import type { NormalizedBBox, RawDetection, ScenarioDefinition } from '@/types/inspection'

/**
 * 検知データ（モック / 実映像トラック）
 *
 * トラック（1本のボトルの軌跡）は2種類:
 *  - synthetic: 等速でコンベア上を流れる合成トラック（動画ファイルが無いとき）
 *  - real:      実映像に対して物体検出＋追跡（YOLO + ByteTrack）を事前実行した
 *               キーフレーム列（/public/demo/detections.json）
 *
 * どちらの場合も「キャップ有無」はフェーズ1では学習済みモデルが無いため、
 * シナリオに従って決定的に割り当てる（= 疑似欠陥注入）。UI 上で明示する。
 */

export type TruthCondition = 'CAPPED' | 'UNCAPPED' | 'MISALIGNED' | 'AMBIGUOUS'

export interface TrackKeyframe {
  t: number
  bbox: NormalizedBBox
  /** 検出器のボトル信頼度（実トラックのみ） */
  confidence?: number
}

export interface BottleTrack {
  id: number
  source: 'synthetic' | 'real'
  /** synthetic: 中心が CONVEYOR.entryX を通過する時刻 / real: 最初のキーフレーム時刻 */
  enterTime: number
  /** synthetic のみ: 正規化座標での横方向速度 [1/s] */
  speed: number
  y: number
  width: number
  height: number
  truth: TruthCondition
  bottleConfidence: number
  capConfidence: number
  capPositionScore: number
  /** トラック固有の乱数シード */
  seed: number
  /** real のみ: 補間に使うキーフレーム列（時刻昇順） */
  keyframes?: TrackKeyframe[]
}

export const CONVEYOR = {
  entryX: -0.12,
  exitX: 1.12,
  /** 検査ゲート位置（正規化 x） */
  gateX: 0.5,
  /** 検査ゾーンの半幅 */
  zoneHalfWidth: 0.06,
  speed: 0.19,
  bottleWidth: 0.075,
  bottleHeight: 0.46,
  bottleY: 0.3,
} as const

/** 決定的な乱数（mulberry32） */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo)

function readingsFor(truth: TruthCondition, rng: () => number) {
  switch (truth) {
    case 'CAPPED':
      return {
        capConfidence: between(rng, 0.8, 0.99),
        capPositionScore: between(rng, 0.82, 0.99),
        bottleConfidence: between(rng, 0.93, 0.995),
      }
    case 'UNCAPPED':
      return {
        capConfidence: between(rng, 0.03, 0.18),
        capPositionScore: between(rng, 0.05, 0.3),
        bottleConfidence: between(rng, 0.9, 0.99),
      }
    case 'MISALIGNED':
      return {
        capConfidence: between(rng, 0.47, 0.73),
        capPositionScore: between(rng, 0.25, 0.55),
        bottleConfidence: between(rng, 0.9, 0.99),
      }
    case 'AMBIGUOUS':
      return {
        capConfidence: between(rng, 0.22, 0.44),
        capPositionScore: between(rng, 0.3, 0.7),
        bottleConfidence: between(rng, 0.85, 0.97),
      }
  }
}

function drawTruth(scenario: ScenarioDefinition, rng: () => number): TruthCondition {
  const r = rng()
  if (r < scenario.uncappedRate) return 'UNCAPPED'
  if (r < scenario.uncappedRate + scenario.misalignedRate) return 'MISALIGNED'
  if (r < scenario.uncappedRate + scenario.misalignedRate + scenario.ambiguousRate) return 'AMBIGUOUS'
  return 'CAPPED'
}

export interface GenerateOptions {
  durationSeconds?: number
  seed?: number
}

/**
 * 合成トラックを生成する（動画ファイルが無い場合）。
 * デモ保証: t=0 で既にベルト上にボトルがあり、最初にゲートへ到達する数本のうち
 * 1本は必ず UNCAPPED（約5秒以内に不良判定が見える）。
 */
export function generateTracks(scenario: ScenarioDefinition, opts: GenerateOptions = {}): BottleTrack[] {
  const duration = opts.durationSeconds ?? 240
  const rng = createRng(opts.seed ?? hashString(scenario.id))
  const tracks: BottleTrack[] = []

  const travel = (CONVEYOR.exitX - CONVEYOR.entryX) / CONVEYOR.speed
  let t = -travel + 0.6
  let id = 1
  let clumpRemaining = 0

  while (t < duration) {
    const truth = drawTruth(scenario, rng)
    const readings = readingsFor(truth, rng)
    tracks.push({
      id,
      source: 'synthetic',
      enterTime: t,
      speed: CONVEYOR.speed,
      y: CONVEYOR.bottleY + between(rng, -0.012, 0.012),
      width: CONVEYOR.bottleWidth * between(rng, 0.94, 1.06),
      height: CONVEYOR.bottleHeight * between(rng, 0.97, 1.03),
      truth,
      ...readings,
      seed: Math.floor(rng() * 1e9),
    })
    id++

    let gap = scenario.spacingSeconds * between(rng, 0.8, 1.25)
    if (scenario.spacingSeconds < 0.6) {
      if (clumpRemaining > 0) {
        gap = (CONVEYOR.bottleWidth / CONVEYOR.speed) * between(rng, 1.05, 1.3)
        clumpRemaining--
      } else if (rng() < 0.35) {
        clumpRemaining = 2 + Math.floor(rng() * 3)
      }
    }
    t += Math.max(gap, (CONVEYOR.bottleWidth * 1.05) / CONVEYOR.speed)
  }

  applyDemoGuarantee(tracks)
  return tracks
}

/**
 * 実映像トラックにシナリオの状態（キャップ有無など）を割り当てる。
 * 幾何（位置・大きさ・時刻）と検出器のボトル信頼度は実測値のまま。
 */
export function assignConditions(base: BottleTrack[], scenario: ScenarioDefinition, seed?: number): BottleTrack[] {
  const rng = createRng(seed ?? hashString(scenario.id + ':real'))
  const tracks = base.map((tr) => {
    const truth = drawTruth(scenario, rng)
    const r = readingsFor(truth, rng)
    return {
      ...tr,
      truth,
      capConfidence: r.capConfidence,
      capPositionScore: r.capPositionScore,
      // 検出器の信頼度があればそれを優先
      bottleConfidence: tr.keyframes?.length ? meanConfidence(tr.keyframes, r.bottleConfidence) : r.bottleConfidence,
      seed: Math.floor(rng() * 1e9),
    }
  })
  applyDemoGuarantee(tracks)
  return tracks
}

function meanConfidence(kfs: TrackKeyframe[], fallback: number) {
  const vals = kfs.map((k) => k.confidence).filter((c): c is number => typeof c === 'number')
  if (!vals.length) return fallback
  const m = vals.reduce((a, b) => a + b, 0) / vals.length
  // 検出器の生スコアはやや低めに出るので表示用に軽く持ち上げる（上限 0.99）
  return Math.min(0.99, 0.55 + m * 0.5)
}

/** 最初にゲートへ到達するボトルは CAPPED、3〜7秒でゲートに到達する1本は UNCAPPED にする */
function applyDemoGuarantee(tracks: BottleTrack[]) {
  const withGate = tracks
    .map((tr) => ({ tr, g: gateTimeOf(tr) }))
    .filter((x) => Number.isFinite(x.g))
    .sort((a, b) => a.g - b.g)
  const target = withGate.find((x) => x.g >= 3 && x.g <= 7.5)
  if (target && target.tr.truth !== 'UNCAPPED') {
    Object.assign(target.tr, { truth: 'UNCAPPED' as const, ...readingsFor('UNCAPPED', createRng(target.tr.seed)) })
  }
  const first = withGate.find((x) => x.g >= 0.4)
  if (first && first.tr !== target?.tr && first.tr.truth !== 'CAPPED') {
    Object.assign(first.tr, { truth: 'CAPPED' as const, ...readingsFor('CAPPED', createRng(first.tr.seed)) })
  }
}

export function hashString(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 時刻 time におけるバウンディングボックス（正規化座標） */
export function bboxAt(track: BottleTrack, time: number): NormalizedBBox {
  const kfs = track.keyframes
  if (kfs && kfs.length) {
    if (time <= kfs[0].t) return kfs[0].bbox
    if (time >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].bbox
    // 二分探索
    let lo = 0
    let hi = kfs.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (kfs[mid].t <= time) lo = mid
      else hi = mid
    }
    const a = kfs[lo]
    const b = kfs[hi]
    const k = b.t === a.t ? 0 : (time - a.t) / (b.t - a.t)
    return [
      a.bbox[0] + (b.bbox[0] - a.bbox[0]) * k,
      a.bbox[1] + (b.bbox[1] - a.bbox[1]) * k,
      a.bbox[2] + (b.bbox[2] - a.bbox[2]) * k,
      a.bbox[3] + (b.bbox[3] - a.bbox[3]) * k,
    ]
  }
  const cx = CONVEYOR.entryX + (time - track.enterTime) * track.speed
  return [cx - track.width / 2, track.y, track.width, track.height]
}

export function centerXAt(track: BottleTrack, time: number): number {
  const b = bboxAt(track, time)
  return b[0] + b[2] / 2
}

/** 中心がゲートを通過する時刻（通過しなければ Infinity） */
export function gateTimeOf(track: BottleTrack): number {
  const kfs = track.keyframes
  if (kfs && kfs.length) {
    for (let i = 1; i < kfs.length; i++) {
      const c0 = kfs[i - 1].bbox[0] + kfs[i - 1].bbox[2] / 2
      const c1 = kfs[i].bbox[0] + kfs[i].bbox[2] / 2
      if (c0 < CONVEYOR.gateX && c1 >= CONVEYOR.gateX) {
        const k = (CONVEYOR.gateX - c0) / (c1 - c0)
        return kfs[i - 1].t + (kfs[i].t - kfs[i - 1].t) * k
      }
    }
    return Infinity
  }
  return track.enterTime + (CONVEYOR.gateX - CONVEYOR.entryX) / track.speed
}

/** トラックが消える時刻 */
export function exitTimeOf(track: BottleTrack): number {
  const kfs = track.keyframes
  if (kfs && kfs.length) return kfs[kfs.length - 1].t
  return track.enterTime + (CONVEYOR.exitX - CONVEYOR.entryX) / track.speed
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** トラックを /public/demo/detections.json のキーフレーム形式へ変換 */
export function tracksToTimeline(tracks: BottleTrack[]): RawDetection[] {
  const out: RawDetection[] = []
  for (const tr of tracks) {
    if (tr.keyframes?.length) {
      for (const k of tr.keyframes) {
        out.push({ time: round3(k.t), id: tr.id, bbox: k.bbox.map(round3) as NormalizedBBox, class: 'bottle', confidence: round3(k.confidence ?? tr.bottleConfidence) })
      }
      continue
    }
    const cls = tr.capConfidence >= 0.5 ? 'capped' : 'uncapped'
    const confidence = cls === 'capped' ? tr.capConfidence : 1 - tr.capConfidence
    for (const time of [tr.enterTime, gateTimeOf(tr), exitTimeOf(tr)]) {
      if (time < 0) continue
      out.push({
        time: round3(time),
        id: tr.id,
        bbox: bboxAt(tr, time).map(round3) as NormalizedBBox,
        class: cls,
        confidence: round3(confidence),
        bottle_confidence: round3(tr.bottleConfidence),
        cap_confidence: round3(tr.capConfidence),
        cap_position_score: round3(tr.capPositionScore),
      })
    }
  }
  return out.sort((a, b) => a.time - b.time || a.id - b.id)
}

export interface TimelineOptions {
  /** これより短いトラックは捨てる [s] */
  minDurationSeconds?: number
}

/**
 * キーフレーム形式を読み込む。
 *  - 同一 id の複数キーフレーム → 補間トラック（real）
 *  - id につき1件だけ → 既定のコンベア速度で外挿（synthetic 相当）
 * class が capped/uncapped の場合はその信頼度を初期値として使い、
 * "bottle"（キャップ未判定）の場合はシナリオ側で割り当てる。
 */
export function timelineToTracks(timeline: RawDetection[], opts: TimelineOptions = {}): BottleTrack[] {
  const minDur = opts.minDurationSeconds ?? 0.5
  const byId = new Map<number, RawDetection[]>()
  for (const d of timeline) {
    const list = byId.get(d.id) ?? []
    list.push(d)
    byId.set(d.id, list)
  }
  const tracks: BottleTrack[] = []
  for (const [id, frames] of byId) {
    frames.sort((a, b) => a.time - b.time)
    const first = frames[0]
    const last = frames[frames.length - 1]
    const isCapped = first.class === 'capped'
    const knownCap = first.class === 'capped' || first.class === 'uncapped'
    const capConfidence = first.cap_confidence ?? (knownCap ? (isCapped ? first.confidence : 1 - first.confidence) : 0.9)
    const truth: TruthCondition =
      capConfidence >= 0.75 ? 'CAPPED' : capConfidence >= 0.45 ? 'MISALIGNED' : capConfidence >= 0.2 ? 'AMBIGUOUS' : 'UNCAPPED'

    if (frames.length >= 2) {
      if (last.time - first.time < minDur) continue
      tracks.push({
        id,
        source: 'real',
        enterTime: first.time,
        speed: 0,
        y: first.bbox[1],
        width: first.bbox[2],
        height: first.bbox[3],
        truth,
        bottleConfidence: first.bottle_confidence ?? 0.95,
        capConfidence,
        capPositionScore: first.cap_position_score ?? (isCapped ? 0.9 : 0.2),
        seed: id * 7919,
        keyframes: frames.map((f) => ({ t: f.time, bbox: f.bbox, confidence: knownCap ? f.bottle_confidence : f.confidence })),
      })
      continue
    }
    const cx0 = first.bbox[0] + first.bbox[2] / 2
    tracks.push({
      id,
      source: 'synthetic',
      enterTime: first.time - (cx0 - CONVEYOR.entryX) / CONVEYOR.speed,
      speed: CONVEYOR.speed,
      y: first.bbox[1],
      width: first.bbox[2],
      height: first.bbox[3],
      truth,
      bottleConfidence: first.bottle_confidence ?? 0.95,
      capConfidence,
      capPositionScore: first.cap_position_score ?? (isCapped ? 0.9 : 0.2),
      seed: id * 7919,
    })
  }
  return tracks.sort((a, b) => a.enterTime - b.enterTime)
}
