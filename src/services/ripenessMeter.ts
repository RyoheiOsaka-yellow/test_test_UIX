import type { MeasurementReading } from '@/types/inspection'

/**
 * トマトの熟度（色づき）の画素解析。
 *
 * 入力は果実の枠を切り出した小さな画像（ImageData）。枠の中央の楕円だけを見て
 * （縁の葉や背景を避ける）、彩度のある画素を色相で採点する:
 *   赤 1.0 / 橙 0.75 / 黄 0.45 / 黄緑 0.2 / 緑 0.0
 * 熟度 = 採点の平均（0 = 緑い実、1 = 完熟）。確からしさ = 果実色の画素の割合。
 * 時間方向の平滑化（移動平均）は呼び出し側（シミュレータ）が行う。
 *
 * 収穫までの日数は熟度から表引き（緑 14 日 / 半熟 6 日 / 完熟 0 日を線形補間）。
 * 品種や気候で変わる目安であり、生育速度の実測ではない。
 */
export function measureRipeness(img: ImageData): MeasurementReading | null {
  const { width: W, height: H, data } = img
  if (W < 6 || H < 6) return null
  const cx = (W - 1) / 2
  const cy = (H - 1) / 2
  const rx = W * 0.42
  const ry = H * 0.42
  let total = 0
  let fruit = 0
  let acc = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy > 1) continue
      total++
      const i = (y * W + x) * 4
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const v = max
      const sat = max > 0 ? (max - min) / max : 0
      if (v < 0.2) continue
      let h = 0
      const d = max - min
      if (d > 1e-6) {
        if (max === r) h = ((g - b) / d) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h *= 60
        if (h < 0) h += 360
      }
      let score: number | null = null
      if (h < 18 || h >= 335) score = sat >= 0.35 ? 1 : null
      else if (h < 40) score = sat >= 0.35 ? 0.75 : null
      else if (h < 62) score = sat >= 0.3 ? 0.45 : null
      else if (h < 80) score = sat >= 0.22 ? 0.2 : null
      else if (h < 170) score = sat >= 0.22 ? 0 : null
      if (score === null) continue
      fruit++
      acc += score
    }
  }
  if (!total || fruit < 12) return null
  const value = acc / fruit
  const fraction = fruit / total
  const confidence = Math.min(1, fraction / 0.55) * Math.min(1, fruit / 60)
  return { value, confidence, tiltDeg: 0 }
}

/** 熟度 0..1 → 収穫までの目安日数（緑 14 日 / 半熟 6 日 / 完熟 0 日） */
export function daysToHarvest(ripeness: number): number {
  const r = Math.min(1, Math.max(0, ripeness))
  if (r >= 0.85) return 0
  if (r >= 0.5) return Math.round(6 * (1 - (r - 0.5) / 0.35))
  return Math.round(14 - 16 * r)
}

/** 熟度の段階名 */
export function ripenessStage(ripeness: number): string {
  const r = ripeness
  if (r >= 0.85) return '完熟'
  if (r >= 0.65) return '色づき中'
  if (r >= 0.35) return '色づき始め'
  return '緑い実'
}

/** 表示用: 「収穫適期」または「収穫まで約 n 日」 */
export function harvestText(ripeness: number): string {
  const d = daysToHarvest(ripeness)
  return d <= 0 ? '収穫適期' : `収穫まで約${d}日`
}
