import type { InspectionTrigger, NormalizedBBox, RawDetection, ScenarioDefinition } from '@/types/inspection'
import { DEFAULT_GATE } from '@/types/inspection'

/**
 * 検知データ（合成 / 実映像トラック）
 *
 * トラック（1つの物体の軌跡）は2種類:
 *  - synthetic: 等速でコンベア上を左→右に流れる合成トラック（動画ファイルが無いとき）
 *  - real:      実映像に対して物体検出＋追跡を事前実行したキーフレーム列
 *               （/public/demo/<プロファイル>/detections.json）
 *
 * どちらの場合も検査属性（キャップ・ラベル・部品の有無）はフェーズ1では
 * 学習済みモデルが無いため、シナリオに従って決定的に割り当てる（= 疑似欠陥注入）。
 */

export type TruthCondition = 'OK' | 'NG' | 'MISALIGNED' | 'AMBIGUOUS'

export interface TrackKeyframe {
  t: number
  bbox: NormalizedBBox
  confidence?: number
}

export interface BottleTrack {
  id: number
  source: 'synthetic' | 'real'
  enterTime: number
  speed: number
  y: number
  width: number
  height: number
  truth: TruthCondition
  objectConfidence: number
  attributeConfidence: number
  alignmentScore: number
  seed: number
  keyframes?: TrackKeyframe[]
}

export const CONVEYOR = {
  entryX: -0.12,
  exitX: 1.12,
  speed: 0.19,
  bottleWidth: 0.075,
  bottleHeight: 0.46,
  bottleY: 0.3,
} as const

// ---------------------------------------------------------------------------
// 検査トリガー（ゲート / ゾーン）。プロファイル切替時に configureTrigger() で差し替える。
// ---------------------------------------------------------------------------

let activeTrigger: InspectionTrigger = DEFAULT_GATE

export function configureTrigger(trigger: InspectionTrigger) {
  activeTrigger = trigger
}

export function currentTrigger(): InspectionTrigger {
  return activeTrigger
}

/** ゲート型: 流れ方向に沿った進行度（0→1 で増える向きに正規化）とゲート位置 */
export function gateProgress(bbox: NormalizedBBox): { p: number; gate: number; half: number } {
  const t = activeTrigger
  if (t.kind !== 'gate') return { p: 0, gate: Infinity, half: 0 }
  const c = t.axis === 'x' ? bbox[0] + bbox[2] / 2 : bbox[1] + bbox[3] / 2
  return t.direction === 1 ? { p: c, gate: t.position, half: t.zoneHalfWidth } : { p: 1 - c, gate: 1 - t.position, half: t.zoneHalfWidth }
}

/** ゾーン型: 中心がゾーン内か */
export function inZone(bbox: NormalizedBBox): boolean {
  const t = activeTrigger
  if (t.kind !== 'zone') return false
  const cx = bbox[0] + bbox[2] / 2
  const cy = bbox[1] + bbox[3] / 2
  const [zx, zy, zw, zh] = t.rect
  return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
}

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
    case 'OK':
      return { attributeConfidence: between(rng, 0.8, 0.99), alignmentScore: between(rng, 0.82, 0.99), objectConfidence: between(rng, 0.93, 0.995) }
    case 'NG':
      return { attributeConfidence: between(rng, 0.03, 0.18), alignmentScore: between(rng, 0.05, 0.3), objectConfidence: between(rng, 0.9, 0.99) }
    case 'MISALIGNED':
      return { attributeConfidence: between(rng, 0.47, 0.73), alignmentScore: between(rng, 0.25, 0.55), objectConfidence: between(rng, 0.9, 0.99) }
    case 'AMBIGUOUS':
      return { attributeConfidence: between(rng, 0.22, 0.44), alignmentScore: between(rng, 0.3, 0.7), objectConfidence: between(rng, 0.85, 0.97) }
  }
}

function drawTruth(scenario: ScenarioDefinition, rng: () => number): TruthCondition {
  const r = rng()
  if (r < scenario.ngRate) return 'NG'
  if (r < scenario.ngRate + scenario.misalignedRate) return 'MISALIGNED'
  if (r < scenario.ngRate + scenario.misalignedRate + scenario.ambiguousRate) return 'AMBIGUOUS'
  return 'OK'
}

export interface GenerateOptions {
  durationSeconds?: number
  seed?: number
}

/** 合成トラックを生成する（動画ファイルが無い場合）。 */
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

/** 実映像トラックにシナリオの状態（属性の有無など）を割り当てる。幾何と検出信頼度は実測値のまま。 */
export function assignConditions(base: BottleTrack[], scenario: ScenarioDefinition, seed?: number): BottleTrack[] {
  const rng = createRng(seed ?? hashString(scenario.id + ':real'))
  const tracks = base.map((tr) => {
    const truth = drawTruth(scenario, rng)
    const r = readingsFor(truth, rng)
    return {
      ...tr,
      truth,
      attributeConfidence: r.attributeConfidence,
      alignmentScore: r.alignmentScore,
      objectConfidence: tr.keyframes?.length ? meanConfidence(tr.keyframes, r.objectConfidence) : r.objectConfidence,
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
  return Math.min(0.99, 0.55 + m * 0.5)
}

/** 最初に判定される物体は OK、3〜7.5秒で判定される1つは NG にする（デモ保証） */
function applyDemoGuarantee(tracks: BottleTrack[]) {
  const withGate = tracks
    .map((tr) => ({ tr, g: gateTimeOf(tr) }))
    .filter((x) => Number.isFinite(x.g))
    .sort((a, b) => a.g - b.g)
  const target = withGate.find((x) => x.g >= 3 && x.g <= 7.5)
  if (target && target.tr.truth !== 'NG') {
    Object.assign(target.tr, { truth: 'NG' as const, ...readingsFor('NG', createRng(target.tr.seed)) })
  }
  const first = withGate.find((x) => x.g >= 0.4)
  if (first && first.tr !== target?.tr && first.tr.truth !== 'OK') {
    Object.assign(first.tr, { truth: 'OK' as const, ...readingsFor('OK', createRng(first.tr.seed)) })
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

export function bboxAt(track: BottleTrack, time: number): NormalizedBBox {
  const kfs = track.keyframes
  if (kfs && kfs.length) {
    if (time <= kfs[0].t) return kfs[0].bbox
    if (time >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].bbox
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

/**
 * 判定が確定する時刻（ゲート型: 中心がゲートを横切る時刻 / ゾーン型: ゾーンに入ってから dwell 経過）。
 * 到達しなければ Infinity。
 */
export function gateTimeOf(track: BottleTrack): number {
  const t = activeTrigger
  const kfs = track.keyframes
  if (t.kind === 'gate') {
    if (kfs && kfs.length) {
      for (let i = 1; i < kfs.length; i++) {
        const a = gateProgress(kfs[i - 1].bbox)
        const b = gateProgress(kfs[i].bbox)
        if (a.p < a.gate && b.p >= b.gate) {
          const k = (a.gate - a.p) / (b.p - a.p)
          return kfs[i - 1].t + (kfs[i].t - kfs[i - 1].t) * k
        }
      }
      return Infinity
    }
    // 合成トラックは常に x 方向 左→右
    const gateX = t.axis === 'x' ? (t.direction === 1 ? t.position : 1 - t.position) : 0.5
    return track.enterTime + (gateX - CONVEYOR.entryX) / track.speed
  }
  // ゾーン型: 連続してゾーン内にいる時間が dwell を超えた最初の時刻
  if (!kfs || !kfs.length) return Infinity
  let entered: number | null = null
  for (const k of kfs) {
    if (inZone(k.bbox)) {
      if (entered === null) entered = k.t
      if (k.t - entered >= t.dwellSeconds) return entered + t.dwellSeconds
    } else entered = null
  }
  return Infinity
}

export function exitTimeOf(track: BottleTrack): number {
  const kfs = track.keyframes
  if (kfs && kfs.length) return kfs[kfs.length - 1].t
  return track.enterTime + (CONVEYOR.exitX - CONVEYOR.entryX) / track.speed
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

export function tracksToTimeline(tracks: BottleTrack[]): RawDetection[] {
  const out: RawDetection[] = []
  for (const tr of tracks) {
    if (tr.keyframes?.length) {
      for (const k of tr.keyframes) {
        out.push({ time: round3(k.t), id: tr.id, bbox: k.bbox.map(round3) as NormalizedBBox, class: 'object', confidence: round3(k.confidence ?? tr.objectConfidence) })
      }
      continue
    }
    const cls = tr.attributeConfidence >= 0.5 ? 'ok' : 'ng'
    const confidence = cls === 'ok' ? tr.attributeConfidence : 1 - tr.attributeConfidence
    for (const time of [tr.enterTime, gateTimeOf(tr), exitTimeOf(tr)]) {
      if (!Number.isFinite(time) || time < 0) continue
      out.push({
        time: round3(time),
        id: tr.id,
        bbox: bboxAt(tr, time).map(round3) as NormalizedBBox,
        class: cls,
        confidence: round3(confidence),
        bottle_confidence: round3(tr.objectConfidence),
        attribute_confidence: round3(tr.attributeConfidence),
        alignment_score: round3(tr.alignmentScore),
      })
    }
  }
  return out.sort((a, b) => a.time - b.time || a.id - b.id)
}

export interface TimelineOptions {
  minDurationSeconds?: number
}

/** キーフレーム形式を読み込む。 */
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
    const isOk = first.class === 'ok' || first.class === 'capped'
    const knownAttr = isOk || first.class === 'ng' || first.class === 'uncapped'
    const attributeConfidence = first.attribute_confidence ?? (knownAttr ? (isOk ? first.confidence : 1 - first.confidence) : 0.9)
    const truth: TruthCondition =
      attributeConfidence >= 0.75 ? 'OK' : attributeConfidence >= 0.45 ? 'MISALIGNED' : attributeConfidence >= 0.2 ? 'AMBIGUOUS' : 'NG'
    const common = {
      id,
      y: first.bbox[1],
      width: first.bbox[2],
      height: first.bbox[3],
      truth,
      objectConfidence: first.bottle_confidence ?? 0.95,
      attributeConfidence,
      alignmentScore: first.alignment_score ?? (isOk ? 0.9 : 0.2),
      seed: id * 7919,
    }
    if (frames.length >= 2) {
      if (last.time - first.time < minDur) continue
      tracks.push({
        ...common,
        source: 'real',
        enterTime: first.time,
        speed: 0,
        keyframes: frames.map((f) => ({ t: f.time, bbox: f.bbox, confidence: knownAttr ? f.bottle_confidence : f.confidence })),
      })
      continue
    }
    const cx0 = first.bbox[0] + first.bbox[2] / 2
    tracks.push({ ...common, source: 'synthetic', enterTime: first.time - (cx0 - CONVEYOR.entryX) / CONVEYOR.speed, speed: CONVEYOR.speed })
  }
  return tracks.sort((a, b) => a.enterTime - b.enterTime)
}
