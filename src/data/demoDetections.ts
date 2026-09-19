import type { NormalizedBBox, RawDetection, ScenarioDefinition } from '@/types/inspection'

/**
 * Deterministic mock detection data.
 *
 * A scenario is expanded into a set of bottle tracks. Each track is a bottle
 * travelling left → right on the conveyor with a ground-truth condition and a
 * baseline vision reading. The simulator turns these into per-frame detections
 * with tracking jitter, so the overlay looks like a live tracker, not a slideshow.
 *
 * The same tracks can be serialised to the `/public/demo/detections.json`
 * keyframe format (see `tracksToTimeline`) and read back (`timelineToTracks`),
 * which is the contract a real detector + tracker would emit.
 */

export type TruthCondition = 'CAPPED' | 'UNCAPPED' | 'MISALIGNED' | 'AMBIGUOUS'

export interface BottleTrack {
  id: number
  /** Video time at which the bottle centre is at CONVEYOR.entryX. */
  enterTime: number
  /** Horizontal speed in normalized frame units per second. */
  speed: number
  y: number
  width: number
  height: number
  truth: TruthCondition
  bottleConfidence: number
  capConfidence: number
  capPositionScore: number
  /** Per-track noise seed for smooth jitter. */
  seed: number
}

export const CONVEYOR = {
  /** Normalized x where a bottle centre starts (off-screen left). */
  entryX: -0.12,
  /** Normalized x where a bottle is considered gone (off-screen right). */
  exitX: 1.12,
  /** Inspection gate position (normalized x). */
  gateX: 0.5,
  /** Half-width of the inspection zone around the gate. */
  zoneHalfWidth: 0.09,
  /** Default conveyor speed, normalized units per second. */
  speed: 0.19,
  bottleWidth: 0.075,
  bottleHeight: 0.46,
  bottleY: 0.3,
} as const

/** Small deterministic PRNG (mulberry32). */
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

export interface GenerateOptions {
  durationSeconds?: number
  seed?: number
}

/**
 * Expand a scenario into bottle tracks.
 *
 * Demo guarantee: the belt is already populated at t=0 and one of the first
 * bottles to reach the gate is UNCAPPED, so a REJECT is visible within ~5s.
 */
export function generateTracks(scenario: ScenarioDefinition, opts: GenerateOptions = {}): BottleTrack[] {
  const duration = opts.durationSeconds ?? 240
  const rng = createRng(opts.seed ?? hashScenario(scenario.id))
  const tracks: BottleTrack[] = []

  // Start before t=0 so bottles are already on the belt when the demo starts.
  const travel = (CONVEYOR.exitX - CONVEYOR.entryX) / CONVEYOR.speed
  let t = -travel + 0.6
  let id = 1
  let clumpRemaining = 0

  while (t < duration) {
    let truth: TruthCondition
    const r = rng()
    if (r < scenario.uncappedRate) truth = 'UNCAPPED'
    else if (r < scenario.uncappedRate + scenario.misalignedRate) truth = 'MISALIGNED'
    else if (r < scenario.uncappedRate + scenario.misalignedRate + scenario.ambiguousRate) truth = 'AMBIGUOUS'
    else truth = 'CAPPED'

    const readings = readingsFor(truth, rng)
    const width = CONVEYOR.bottleWidth * between(rng, 0.94, 1.06)
    const height = CONVEYOR.bottleHeight * between(rng, 0.97, 1.03)
    tracks.push({
      id,
      enterTime: t,
      speed: CONVEYOR.speed,
      y: CONVEYOR.bottleY + between(rng, -0.012, 0.012),
      width,
      height,
      truth,
      ...readings,
      seed: Math.floor(rng() * 1e9),
    })
    id++

    // Spacing: normal jitter, with occasional clumps for congestion scenarios.
    let gap = scenario.spacingSeconds * between(rng, 0.8, 1.25)
    if (scenario.spacingSeconds < 0.6) {
      if (clumpRemaining > 0) {
        gap = CONVEYOR.bottleWidth / CONVEYOR.speed * between(rng, 1.05, 1.3)
        clumpRemaining--
      } else if (rng() < 0.35) {
        clumpRemaining = 2 + Math.floor(rng() * 3)
      }
    }
    t += Math.max(gap, (CONVEYOR.bottleWidth * 1.05) / CONVEYOR.speed)
  }

  // Demo guarantee: the bottle that reaches the gate between ~3s and ~6s is UNCAPPED.
  const gateOffset = (CONVEYOR.gateX - CONVEYOR.entryX) / CONVEYOR.speed
  const target = tracks.find((tr) => tr.enterTime + gateOffset >= 3 && tr.enterTime + gateOffset <= 6.5)
  if (target && target.truth !== 'UNCAPPED') {
    const r2 = createRng(target.seed)
    Object.assign(target, { truth: 'UNCAPPED' as const, ...readingsFor('UNCAPPED', r2) })
  }
  // And the very first bottle to reach the gate is CAPPED, so the first visible decision is a clean PASS.
  const first = tracks.find((tr) => tr.enterTime + gateOffset >= 0.4)
  if (first && first !== target && first.truth !== 'CAPPED') {
    const r3 = createRng(first.seed)
    Object.assign(first, { truth: 'CAPPED' as const, ...readingsFor('CAPPED', r3) })
  }

  return tracks
}

function hashScenario(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function bboxAt(track: BottleTrack, time: number): NormalizedBBox {
  const cx = CONVEYOR.entryX + (time - track.enterTime) * track.speed
  return [cx - track.width / 2, track.y, track.width, track.height]
}

export function gateTimeOf(track: BottleTrack): number {
  return track.enterTime + (CONVEYOR.gateX - CONVEYOR.entryX) / track.speed
}

export function exitTimeOf(track: BottleTrack): number {
  return track.enterTime + (CONVEYOR.exitX - CONVEYOR.entryX) / track.speed
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** Serialise tracks to the `/public/demo/detections.json` keyframe format. */
export function tracksToTimeline(tracks: BottleTrack[]): RawDetection[] {
  const out: RawDetection[] = []
  for (const tr of tracks) {
    const cls = tr.capConfidence >= 0.5 ? 'capped' : 'uncapped'
    const confidence = cls === 'capped' ? tr.capConfidence : 1 - tr.capConfidence
    const times = [tr.enterTime, gateTimeOf(tr), exitTimeOf(tr)]
    for (const time of times) {
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

/**
 * Read a keyframe timeline back into tracks. A single keyframe per id is
 * extrapolated with the default conveyor speed; multiple keyframes derive speed
 * from the first and last.
 */
export function timelineToTracks(timeline: RawDetection[]): BottleTrack[] {
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
    const cx0 = first.bbox[0] + first.bbox[2] / 2
    const cx1 = last.bbox[0] + last.bbox[2] / 2
    const speed = last.time > first.time && cx1 > cx0 ? (cx1 - cx0) / (last.time - first.time) : CONVEYOR.speed
    const enterTime = first.time - (cx0 - CONVEYOR.entryX) / speed
    const isCapped = first.class === 'capped'
    const capConfidence = first.cap_confidence ?? (isCapped ? first.confidence : 1 - first.confidence)
    const truth: TruthCondition =
      capConfidence >= 0.75 ? 'CAPPED' : capConfidence >= 0.45 ? 'MISALIGNED' : capConfidence >= 0.2 ? 'AMBIGUOUS' : 'UNCAPPED'
    tracks.push({
      id,
      enterTime,
      speed,
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
