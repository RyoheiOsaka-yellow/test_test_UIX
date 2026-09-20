import type { MeasurementReading, NormalizedBBox } from '@/types/inspection'

/**
 * 液面（充填量）の画素解析。
 *
 * 入力はボトルの枠を切り出した小さな画像（ImageData）。各行の「液体らしさ」を
 * HSV（彩度が高く、明度がやや低い）で採点し、上下 5% の行を捨てた上で
 * パーセンタイル（p10 / p90）から閾値を決めて液面の行を求める。
 * 左右の列で別々に液面を求めて傾きを推定し、その平均高さを充填率にする
 * （傾いた円筒では左右の平均高さが体積相当の高さになる）。
 * 時間方向の平滑化（移動平均）は呼び出し側（シミュレータ）が行う。
 *
 * 実映像でも合成映像でも同じコードが走る。合成映像では真値と比較できる。
 */

export interface FramePixelSource {
  /** 正規化座標の枠を切り出し、幅 targetW px に縮小した ImageData を返す（取れなければ null） */
  crop(bbox: NormalizedBBox, targetW: number): ImageData | null
}

/** <video> または <canvas> を元画像として枠を切り出す */
export class CanvasPixelSource implements FramePixelSource {
  private off = document.createElement('canvas')
  private ctx = this.off.getContext('2d', { willReadFrequently: true })!
  constructor(private source: () => HTMLVideoElement | HTMLCanvasElement | null) {}

  crop(bbox: NormalizedBBox, targetW: number): ImageData | null {
    const src = this.source()
    if (!src) return null
    const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.width
    const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.height
    if (!sw || !sh) return null
    const sx = Math.max(0, bbox[0] * sw)
    const sy = Math.max(0, bbox[1] * sh)
    const sww = Math.min(sw - sx, bbox[2] * sw)
    const shh = Math.min(sh - sy, bbox[3] * sh)
    if (sww < 4 || shh < 4) return null
    const dw = Math.max(8, Math.round(targetW))
    const dh = Math.max(8, Math.round((shh / sww) * dw))
    if (this.off.width !== dw || this.off.height !== dh) {
      this.off.width = dw
      this.off.height = dh
    }
    try {
      this.ctx.drawImage(src, sx, sy, sww, shh, 0, 0, dw, dh)
      return this.ctx.getImageData(0, 0, dw, dh)
    } catch {
      return null
    }
  }
}

export interface MeterOptions {
  /** 枠の上端からこの割合までは首・肩として無視する（胴の上端） */
  neckFraction?: number
  /** 胴の下端（枠の上端からの割合） */
  bottomFraction?: number
  /** 中央のこの割合の列だけを使う（枠の縁の背景を避ける） */
  centerFraction?: number
}

function rowScores(img: ImageData, c0: number, c1: number): Float32Array {
  const { width: W, height: H, data } = img
  const scores = new Float32Array(H)
  for (let y = 0; y < H; y++) {
    let acc = 0
    let n = 0
    for (let x = c0; x < c1; x++) {
      const i = (y * W + x) * 4
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const s = max > 0 ? (max - min) / max : 0
      const v = max
      acc += s + 0.5 * (1 - v)
      n++
    }
    scores[y] = n ? acc / n : 0
  }
  return scores
}

function percentile(sorted: Float32Array, p: number): number {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[i]
}

/** 下から上へ走査して、閾値を下回る行が3行続いた最初の位置を液面とする */
function surfaceRow(scores: Float32Array, threshold: number, top: number, bottom: number): number | null {
  let miss = 0
  let liquidSeen = false
  for (let y = bottom - 1; y >= top; y--) {
    if (scores[y] >= threshold) {
      miss = 0
      liquidSeen = true
    } else {
      miss++
      if (miss >= 3) return liquidSeen ? y + miss : null
    }
  }
  return liquidSeen ? top : null
}

export function measureFillLevel(img: ImageData, opts: MeterOptions = {}): MeasurementReading | null {
  const neck = opts.neckFraction ?? 0.2
  const centre = opts.centerFraction ?? 0.5
  const { width: W, height: H } = img
  if (W < 8 || H < 16) return null
  const top = Math.floor(H * neck)
  const bottom = Math.floor(H * (opts.bottomFraction ?? 0.995))
  const bodyH = bottom - top
  if (bodyH < 8) return null

  const c0 = Math.floor((W * (1 - centre)) / 2)
  const c1 = Math.ceil((W * (1 + centre)) / 2)
  const mid = rowScores(img, c0, c1)
  const left = rowScores(img, c0, Math.max(c0 + 1, Math.floor((c0 + c1) / 2)))
  const right = rowScores(img, Math.floor((c0 + c1) / 2), c1)

  // パーセンタイルで閾値を決める（極端な行を無視）
  const body = Float32Array.from(mid.slice(top, bottom)).sort()
  const p10 = percentile(body, 0.1)
  const p90 = percentile(body, 0.9)
  const contrast = p90 - p10
  if (contrast < 0.04) return { value: 0, confidence: 0, tiltDeg: 0 }
  const threshold = (p10 + p90) / 2

  const rowM = surfaceRow(mid, threshold, top, bottom)
  const rowL = surfaceRow(left, threshold, top, bottom)
  const rowR = surfaceRow(right, threshold, top, bottom)
  if (rowM === null) return { value: 0, confidence: Math.min(1, contrast / 0.25) * 0.5, tiltDeg: 0 }

  // 傾き補正: 左右の液面の平均高さを採用し、角度を記録する
  const rl = rowL ?? rowM
  const rr = rowR ?? rowM
  const level = (rl + rr) / 2
  const colDist = Math.max(1, (c1 - c0) / 2)
  const tiltDeg = (Math.atan2(rl - rr, colDist) * 180) / Math.PI
  const fill = Math.min(1, Math.max(0, (bottom - level) / bodyH))
  const agreement = 1 - Math.min(1, Math.abs(rl - rr) / (bodyH * 0.25))
  const confidence = Math.min(1, contrast / 0.25) * (0.5 + 0.5 * agreement)
  return { value: fill, confidence, tiltDeg }
}
