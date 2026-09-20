import type { BottleTrack } from '@/data/demoDetections'
import type { NormalizedBBox } from '@/types/inspection'

/**
 * 充填ラインの合成映像。半透明の白いボトルがコンベアを左→右に流れ、
 * 充填ノズルの下（x 0.34〜0.54）を通る間に液体が上がる。
 * 液面の計測はこの描画結果の画素を読んで行う（描画パラメータは計測側に渡さない）。
 */

export interface FillItem {
  track: BottleTrack
  bbox: NormalizedBBox
  ejected: number
}

export const FILLER_ZONE = { start: 0.34, end: 0.54 }

/** 現在のボトル位置での液面（真値に向けて充填中） */
export function fillProgress(track: BottleTrack, cx: number): number {
  const target = track.fillLevel ?? 0
  const k = Math.min(1, Math.max(0, (cx - FILLER_ZONE.start) / (FILLER_ZONE.end - FILLER_ZONE.start)))
  return target * k
}

export function drawSyntheticFillingFeed(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, items: FillItem[]) {
  ctx.clearRect(0, 0, w, h)
  // 背景（明るい作業室）
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#dfe3e6')
  g.addColorStop(1, '#b9bfc4')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // 奥の装置（ステンレスの箱）
  ctx.fillStyle = '#9aa3a9'
  ctx.fillRect(0.0 * w, 0.08 * h, w, 0.22 * h)
  ctx.fillStyle = '#7d868c'
  ctx.fillRect(0.0 * w, 0.28 * h, w, 0.03 * h)

  // 充填ステーション（黒いフレーム + 2本のノズル）
  const zx = FILLER_ZONE.start * w
  const zw = (FILLER_ZONE.end - FILLER_ZONE.start) * w
  ctx.fillStyle = '#23272b'
  ctx.fillRect(zx - 0.02 * w, 0.06 * h, zw + 0.04 * w, 0.05 * h)
  ctx.fillRect(zx - 0.02 * w, 0.06 * h, 0.012 * w, 0.3 * h)
  ctx.fillRect(zx + zw + 0.008 * w, 0.06 * h, 0.012 * w, 0.3 * h)
  for (const nx of [0.42, 0.48]) {
    ctx.fillStyle = '#cfd6da'
    ctx.fillRect(nx * w - 3, 0.11 * h, 6, 0.2 * h)
    ctx.fillStyle = '#2f353a'
    ctx.fillRect(nx * w - 5, 0.3 * h, 10, 0.05 * h)
    // 液の流れ（ノズル直下にボトルがあるときだけ）
    const under = items.find((it) => Math.abs(it.bbox[0] + it.bbox[2] / 2 - nx) < 0.02)
    if (under) {
      ctx.fillStyle = 'rgba(240, 196, 70, 0.75)'
      ctx.fillRect(nx * w - 1.5, 0.35 * h, 3, (under.bbox[1] + under.bbox[3] * 0.1) * h - 0.35 * h)
    }
  }

  // ベルト
  const beltTop = 0.72 * h
  ctx.fillStyle = '#cbb08a'
  ctx.fillRect(0, beltTop, w, 0.1 * h)
  ctx.strokeStyle = '#b39a76'
  ctx.lineWidth = 1
  const slat = 0.03 * w
  const offset = ((time * 0.19 * w) % slat + slat) % slat
  for (let x = -slat + offset; x < w + slat; x += slat) {
    ctx.beginPath()
    ctx.moveTo(x, beltTop)
    ctx.lineTo(x, beltTop + 0.1 * h)
    ctx.stroke()
  }
  ctx.fillStyle = '#2a2e32'
  ctx.fillRect(0, beltTop + 0.1 * h, w, 0.04 * h)
  // 手前のガイドレール
  ctx.fillStyle = '#1f2326'
  ctx.fillRect(0, 0.655 * h, w, 0.025 * h)

  for (const it of items) drawBottle(ctx, w, h, it)
}

function drawBottle(ctx: CanvasRenderingContext2D, w: number, h: number, it: FillItem) {
  const [nx, ny, nw, nh] = it.bbox
  const x = nx * w
  const y = ny * h
  const bw = nw * w
  const bh = nh * h
  const cx = x + bw / 2
  const track = it.track

  ctx.save()
  if (it.ejected > 0) {
    const k = it.ejected
    ctx.translate(k * 0.02 * w, k * k * 0.5 * h)
    ctx.globalAlpha = 1 - k * 0.7
  }

  // 形: 首（上 14%）+ 肩 + 胴
  const neckH = bh * 0.14
  const neckW = bw * 0.36
  const bodyTop = y + neckH + bh * 0.06
  const path = new Path2D()
  path.moveTo(cx - neckW / 2, y)
  path.lineTo(cx + neckW / 2, y)
  path.lineTo(cx + neckW / 2, y + neckH)
  path.quadraticCurveTo(cx + bw / 2, y + neckH + 2, cx + bw / 2, bodyTop)
  path.lineTo(cx + bw / 2, y + bh - 5)
  path.quadraticCurveTo(cx + bw / 2, y + bh, cx + bw / 2 - 5, y + bh)
  path.lineTo(cx - bw / 2 + 5, y + bh)
  path.quadraticCurveTo(cx - bw / 2, y + bh, cx - bw / 2, y + bh - 5)
  path.lineTo(cx - bw / 2, bodyTop)
  path.quadraticCurveTo(cx - bw / 2, y + neckH + 2, cx - neckW / 2, y + neckH)
  path.closePath()

  // 半透明の白い樹脂
  ctx.fillStyle = 'rgba(246, 248, 250, 0.92)'
  ctx.fill(path)

  // 液体（胴の内側、傾いた液面）
  const fill = fillProgress(track, nx + nw / 2)
  if (fill > 0.005) {
    const bodyH = y + bh - bodyTop
    const level = y + bh - fill * bodyH
    const tilt = ((track.tiltDeg ?? 0) * Math.PI) / 180
    const dy = Math.tan(tilt) * (bw / 2)
    const contrast = track.liquidContrast ?? 1
    ctx.save()
    ctx.clip(path)
    ctx.fillStyle = `rgba(232, 176, 44, ${0.16 + 0.42 * contrast})`
    ctx.beginPath()
    ctx.moveTo(cx - bw / 2, level + dy)
    ctx.lineTo(cx + bw / 2, level - dy)
    ctx.lineTo(cx + bw / 2, y + bh + 2)
    ctx.lineTo(cx - bw / 2, y + bh + 2)
    ctx.closePath()
    ctx.fill()
    // メニスカス（やや濃い線）
    ctx.strokeStyle = `rgba(190, 130, 20, ${0.35 + 0.4 * contrast})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - bw / 2, level + dy)
    ctx.lineTo(cx + bw / 2, level - dy)
    ctx.stroke()
    ctx.restore()
  }

  // 輪郭とハイライト
  ctx.strokeStyle = 'rgba(150, 160, 168, 0.9)'
  ctx.lineWidth = 1
  ctx.stroke(path)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(cx - bw * 0.36, bodyTop + 4, bw * 0.08, bh * 0.5)
  ctx.restore()
}
