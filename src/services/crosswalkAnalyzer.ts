import type { InspectionProfile, NormalizedBBox, StateReading } from '@/types/inspection'

/**
 * 横断歩道の安全監視（場面解析）。
 *
 * 入力は追跡された物体（歩行者 / 自転車 / 車両）の枠。プロファイルのゾーン多角形
 * （横断歩道・待機ゾーン・横断歩道付近）を使い、
 *   - 歩行者ごとに: 歩道 / 待機中 / 横断歩道付近 / 横断中 の状態
 *   - 車両ごとに:   走行中 / 停止、進行方向、横断歩道までの距離と到達予測時間
 * を出し、「横断中（または直前）の歩行者に、走行中の車両が数秒以内に到達する」場面を
 * 危険として採点する。判断はフレーム単位ではなく、状態の継続時間で確定する。
 */

type Cls = 'pedestrian' | 'vehicle' | 'other'

interface Hist {
  t: number
  cx: number
  cy: number
}

interface TrackMem {
  hist: Hist[]
  state: string
  since: number
}

export interface SceneItem {
  id: number
  label: string
  cls: string
  bbox: NormalizedBBox
}

const CLS_MAP: Record<string, Cls> = {
  person: 'pedestrian',
  bicycle: 'pedestrian',
  car: 'vehicle',
  truck: 'vehicle',
  bus: 'vehicle',
  motorcycle: 'vehicle',
}

export function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi
    if (hit) inside = !inside
  }
  return inside
}

function polygonCentroid(poly: Array<[number, number]>): [number, number] {
  let x = 0
  let y = 0
  for (const [px, py] of poly) {
    x += px
    y += py
  }
  return [x / poly.length, y / poly.length]
}

/** 点から多角形の縁までの最短距離（内側なら 0） */
function distanceToPolygon(x: number, y: number, poly: Array<[number, number]>): number {
  if (pointInPolygon(x, y, poly)) return 0
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j]
    const [x2, y2] = poly[i]
    const dx = x2 - x1
    const dy = y2 - y1
    const l2 = dx * dx + dy * dy || 1e-9
    let t = ((x - x1) * dx + (y - y1) * dy) / l2
    t = Math.max(0, Math.min(1, t))
    const px = x1 + t * dx
    const py = y1 + t * dy
    best = Math.min(best, Math.hypot(x - px, y - py))
  }
  return best
}

export class CrosswalkAnalyzer {
  private mem = new Map<number, TrackMem>()
  private crosswalk: Array<[number, number]>
  private waiting: Array<Array<[number, number]>>
  private near: Array<Array<[number, number]>>
  private cwCentre: [number, number]
  private lastTime = -Infinity
  private tta = 1.5 // この秒数以内に車両が横断歩道へ到達する見込みなら「接近」

  constructor(profile: InspectionProfile) {
    const zones = profile.zones ?? []
    this.crosswalk = zones.find((z) => z.kind === 'crosswalk')?.polygon ?? [
      [0.3, 0.4],
      [0.7, 0.4],
      [0.7, 0.6],
      [0.3, 0.6],
    ]
    this.waiting = zones.filter((z) => z.kind === 'waiting').map((z) => z.polygon)
    this.near = zones.filter((z) => z.kind === 'near').map((z) => z.polygon)
    this.cwCentre = polygonCentroid(this.crosswalk)
  }

  reset() {
    this.mem.clear()
  }

  static classOf(cls: string | undefined): Cls {
    return CLS_MAP[cls ?? ''] ?? 'other'
  }

  /** 全物体の状態を一度に更新する（車両と歩行者の関係を見るため） */
  update(t: number, items: SceneItem[]): Map<number, StateReading> {
    if (t < this.lastTime - 0.25) this.reset()
    this.lastTime = t
    const out = new Map<number, StateReading>()
    const seen = new Set<number>()

    // 履歴の更新
    for (const it of items) {
      seen.add(it.id)
      const cx = it.bbox[0] + it.bbox[2] / 2
      const cy = it.bbox[1] + it.bbox[3] * (CrosswalkAnalyzer.classOf(it.cls) === 'pedestrian' ? 0.95 : 0.7) // 足元 / 車体の接地付近
      let m = this.mem.get(it.id)
      if (!m) {
        m = { hist: [], state: '', since: t }
        this.mem.set(it.id, m)
      }
      m.hist.push({ t, cx, cy })
      while (m.hist.length && m.hist[0].t < t - 1.0) m.hist.shift()
    }
    for (const id of [...this.mem.keys()]) if (!seen.has(id)) this.mem.delete(id)

    // 車両: 速度・接近判定
    const vehicles: Array<{ id: number; label: string; speed: number; moving: boolean; approaching: boolean; tta: number; dist: number; cx: number; cy: number }> = []
    for (const it of items) {
      if (CrosswalkAnalyzer.classOf(it.cls) !== 'vehicle') continue
      const m = this.mem.get(it.id)!
      const last = m.hist[m.hist.length - 1]
      const past = m.hist.find((h) => h.t <= t - 0.4) ?? m.hist[0]
      const dt = Math.max(1e-3, last.t - past.t)
      const vx = (last.cx - past.cx) / dt
      const vy = (last.cy - past.cy) / dt
      const speed = Math.hypot(vx, vy) // 画面幅/秒
      const moving = speed > 0.05 && m.hist.length > 3
      const dist = distanceToPolygon(last.cx, last.cy, this.crosswalk)
      const inApproach = this.near.some((p) => pointInPolygon(last.cx, last.cy, p))
      // 横断歩道中心へ向かう速度成分
      const dxc = this.cwCentre[0] - last.cx
      const dyc = this.cwCentre[1] - last.cy
      const dc = Math.hypot(dxc, dyc) || 1e-6
      const closing = (vx * dxc + vy * dyc) / dc
      const tta = closing > 0.02 ? dist / closing : Infinity
      // 接近: 横断歩道上をある程度の速度で走行中、または接近車道ゾーン内で横断歩道へ向かい数秒以内に到達
      const approaching = moving && ((dist === 0 && speed > 0.08) || (inApproach && closing > 0.03 && tta <= this.tta))
      const state = dist === 0 && moving ? 'ON_CROSSWALK' : moving ? 'MOVING' : 'STOPPED'
      if (m.state !== state) {
        m.state = state
        m.since = t
      }
      vehicles.push({ id: it.id, label: it.label, speed, moving, approaching, tta, dist, cx: last.cx, cy: last.cy })
      out.set(it.id, {
        state,
        stateLabel: state === 'STOPPED' ? '停止' : state === 'ON_CROSSWALK' ? '横断歩道を通過中' : approaching ? '走行中（接近）' : '走行中',
        level: 'normal',
        score: 0,
        holdSeconds: t - m.since,
        confidence: Math.min(1, m.hist.length / 6),
        features: [
          { key: 'speed', label: '速度（画面幅/秒）', value: speed },
          { key: 'time_to_crosswalk', label: '横断歩道まで（秒）', value: Number.isFinite(tta) ? tta : 99, digits: 1 },
        ],
      })
    }

    // 歩行者: ゾーン状態と危険採点
    for (const it of items) {
      if (CrosswalkAnalyzer.classOf(it.cls) !== 'pedestrian') continue
      const m = this.mem.get(it.id)!
      const last = m.hist[m.hist.length - 1]
      const past = m.hist.find((h) => h.t <= t - 0.4) ?? m.hist[0]
      const speed = Math.hypot(last.cx - past.cx, last.cy - past.cy) / Math.max(1e-3, last.t - past.t)
      const onCrosswalk = pointInPolygon(last.cx, last.cy, this.crosswalk)
      const inWaiting = this.waiting.some((p) => pointInPolygon(last.cx, last.cy, p))
      const inNear = this.near.some((p) => pointInPolygon(last.cx, last.cy, p))
      const state = onCrosswalk ? 'CROSSING' : inNear ? 'NEAR' : inWaiting ? 'WAITING' : 'SIDEWALK'
      if (m.state !== state) {
        m.state = state
        m.since = t
      }
      // 最も危険な車両: 接近中で、かつこの歩行者の近く（画面幅の 30% 以内）にいるもの
      const threats = vehicles
        .filter((v) => v.approaching && Math.hypot(v.cx - last.cx, v.cy - last.cy) <= 0.3)
        .sort((a, b) => a.tta - b.tta)
      const worst = threats[0]
      let score = 0
      if (state === 'CROSSING') score = 0.2
      else if (state === 'NEAR') score = 0.12
      else if (state === 'WAITING') score = 0.05
      // 緊急度: 横断歩道上の車両は速度で、接近中の車両は到達予測時間で評価
      const urgencyOf = (v: typeof worst) =>
        !v ? 0 : v.dist === 0 ? Math.min(1, v.speed / 0.2) : Number.isFinite(v.tta) ? Math.max(0, 1 - v.tta / this.tta) : 0
      if (worst && state === 'CROSSING') {
        score += 0.3 + 0.5 * urgencyOf(worst) // 警報（0.6 以上）には緊急度 0.2 以上が必要
      } else if (worst && state === 'NEAR') {
        score += 0.2 + 0.2 * urgencyOf(worst) // 最大 0.52 = 注意止まり
      }
      score = Math.min(1, score)
      const level: StateReading['level'] = score >= 0.6 ? 'alert' : score >= 0.35 ? 'watch' : 'normal'
      const labels: Record<string, string> = { CROSSING: '横断中', NEAR: '横断歩道付近', WAITING: '待機中', SIDEWALK: '歩道' }
      out.set(it.id, {
        state,
        stateLabel: labels[state] + (worst && level !== 'normal' ? '・車両接近' : ''),
        level,
        score,
        holdSeconds: t - m.since,
        confidence: Math.min(1, m.hist.length / 6),
        features: [
          { key: 'zone', label: 'ゾーン', value: state === 'CROSSING' ? 3 : state === 'NEAR' ? 2 : state === 'WAITING' ? 1 : 0, digits: 0 },
          { key: 'walk_speed', label: '歩行速度（画面幅/秒）', value: speed },
          { key: 'approaching_vehicles', label: '接近車両（台）', value: threats.length, digits: 0 },
          { key: 'min_time_to_arrival', label: '最短到達（秒）', value: worst && Number.isFinite(worst.tta) ? worst.tta : 99, digits: 1 },
        ],
        note: worst ? `接近車両 ${worst.label}` : undefined,
      })
    }
    return out
  }
}
