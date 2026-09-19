import type { Ref } from 'react'
import type { BottleTrack } from '@/data/demoDetections'
import { CONVEYOR } from '@/data/demoDetections'
import type { NormalizedBBox } from '@/types/inspection'

/**
 * Placeholder video source. Rendered only when neither
 * /demo/bottling-line.mp4 nor /demo/sample.mp4 exists. It draws a stylised
 * conveyor from the same track data the simulator uses, so the demo runs
 * end-to-end without a video file. Clearly labelled as SYNTHETIC in the UI.
 */
export function SyntheticFeed({ canvasRef }: { canvasRef: Ref<HTMLCanvasElement> }) {
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full bg-[#0a0e14]" />
}

export interface TruthItem {
  track: BottleTrack
  bbox: NormalizedBBox
  ejected: number
}

export function drawSyntheticFeed(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, items: TruthItem[]) {
  // Background: floor + belt.
  ctx.clearRect(0, 0, w, h)
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0c1118')
  grad.addColorStop(1, '#070a0e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  const beltTop = 0.72 * h
  const beltBottom = 0.86 * h
  ctx.fillStyle = '#161c24'
  ctx.fillRect(0, beltTop, w, beltBottom - beltTop)
  // Belt slats moving with the conveyor.
  const slat = 0.05 * w
  const offset = ((time * CONVEYOR.speed * w) % slat + slat) % slat
  ctx.strokeStyle = '#212a35'
  ctx.lineWidth = 1
  for (let x = -slat + offset; x < w + slat; x += slat) {
    ctx.beginPath()
    ctx.moveTo(x, beltTop)
    ctx.lineTo(x - 6, beltBottom)
    ctx.stroke()
  }
  // Guide rails.
  ctx.fillStyle = '#2b3642'
  ctx.fillRect(0, beltTop - 3, w, 3)
  ctx.fillRect(0, beltBottom, w, 4)
  // Back wall line + light strip.
  ctx.fillStyle = '#10161d'
  ctx.fillRect(0, 0.2 * h, w, 2)
  ctx.fillStyle = 'rgba(49,198,255,0.06)'
  ctx.fillRect(0, 0.2 * h, w, 0.52 * h)

  for (const it of items) drawBottle(ctx, w, h, it)

  // Vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.95)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}

function drawBottle(ctx: CanvasRenderingContext2D, w: number, h: number, it: TruthItem) {
  const [nx, ny, nw, nh] = it.bbox
  const x = nx * w
  const y = ny * h
  const bw = nw * w
  const bh = nh * h
  const cx = x + bw / 2

  ctx.save()
  if (it.ejected > 0) {
    const k = it.ejected
    ctx.translate(cx, y + bh)
    ctx.rotate(k * 0.9)
    ctx.translate(-cx, -(y + bh))
    ctx.translate(k * 0.02 * w, k * k * 0.5 * h)
    ctx.globalAlpha = 1 - k * 0.7
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath()
  ctx.ellipse(cx, y + bh + 3, bw * 0.55, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body (PET bottle silhouette)
  const capH = bh * 0.09
  const neckH = bh * 0.1
  const shoulderY = y + capH + neckH
  const bodyTop = shoulderY + bh * 0.08
  ctx.beginPath()
  ctx.moveTo(cx - bw * 0.18, y + capH)
  ctx.lineTo(cx - bw * 0.18, shoulderY)
  ctx.quadraticCurveTo(cx - bw * 0.5, shoulderY + bh * 0.02, cx - bw * 0.5, bodyTop)
  ctx.lineTo(cx - bw * 0.5, y + bh - 6)
  ctx.quadraticCurveTo(cx - bw * 0.5, y + bh, cx - bw * 0.4, y + bh)
  ctx.lineTo(cx + bw * 0.4, y + bh)
  ctx.quadraticCurveTo(cx + bw * 0.5, y + bh, cx + bw * 0.5, y + bh - 6)
  ctx.lineTo(cx + bw * 0.5, bodyTop)
  ctx.quadraticCurveTo(cx + bw * 0.5, shoulderY + bh * 0.02, cx + bw * 0.18, shoulderY)
  ctx.lineTo(cx + bw * 0.18, y + capH)
  ctx.closePath()
  const g = ctx.createLinearGradient(x, 0, x + bw, 0)
  g.addColorStop(0, 'rgba(150, 190, 220, 0.16)')
  g.addColorStop(0.35, 'rgba(210, 235, 255, 0.34)')
  g.addColorStop(0.6, 'rgba(120, 160, 200, 0.16)')
  g.addColorStop(1, 'rgba(90, 120, 150, 0.22)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(200, 225, 245, 0.35)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Liquid
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(70, 150, 210, 0.28)'
  ctx.fillRect(x, bodyTop + bh * 0.06, bw, bh)
  ctx.restore()

  // Label band
  ctx.fillStyle = 'rgba(230, 240, 250, 0.16)'
  ctx.fillRect(cx - bw * 0.5 + 1, y + bh * 0.52, bw - 2, bh * 0.22)
  ctx.fillStyle = 'rgba(49,198,255,0.35)'
  ctx.fillRect(cx - bw * 0.5 + 1, y + bh * 0.52, bw - 2, 3)

  // Cap (depending on ground truth)
  const truth = it.track.truth
  const capW = bw * 0.42
  if (truth === 'CAPPED' || truth === 'MISALIGNED' || truth === 'AMBIGUOUS') {
    ctx.save()
    if (truth === 'MISALIGNED') {
      ctx.translate(cx, y + capH)
      ctx.rotate(0.28)
      ctx.translate(-cx, -(y + capH))
      ctx.translate(bw * 0.08, -2)
    }
    if (truth === 'AMBIGUOUS') ctx.globalAlpha *= 0.5
    ctx.fillStyle = '#2d7fe0'
    ctx.fillRect(cx - capW / 2, y, capW, capH)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(cx - capW / 2, y, capW, 2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    for (let i = 1; i < 4; i++) ctx.fillRect(cx - capW / 2 + (capW / 4) * i, y, 1, capH)
    ctx.restore()
  } else {
    // Open neck ring
    ctx.strokeStyle = 'rgba(220, 235, 250, 0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(cx, y + capH, bw * 0.18, 2.5, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}
