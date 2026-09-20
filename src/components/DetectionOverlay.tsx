import type { Ref } from 'react'
import type { InspectionProfile, InspectionTrigger, OverlaySettings } from '@/types/inspection'
import type { FrameSample } from '@/services/videoDetectionSimulator'
import { drawDetection } from './DetectionLabel'

/**
 * 映像に重ねる透明キャンバス。描画は親（VideoInspection）の requestAnimationFrame
 * ループから呼ばれ、枠の位置は React の状態を通らない。
 */
export function DetectionOverlay({ canvasRef }: { canvasRef: Ref<HTMLCanvasElement> }) {
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sample: FrameSample,
  settings: OverlaySettings,
  profile: InspectionProfile,
  trigger: InspectionTrigger,
) {
  ctx.clearRect(0, 0, w, h)
  if (!settings.overlay) return

  // 検査ゾーン（うっすら）
  if (settings.inspectionGate) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 213, 42, 0.035)'
    if (trigger.kind === 'gate') {
      if (trigger.axis === 'x') ctx.fillRect((trigger.position - trigger.zoneHalfWidth) * w, 0, trigger.zoneHalfWidth * 2 * w, h)
      else ctx.fillRect(0, (trigger.position - trigger.zoneHalfWidth) * h, w, trigger.zoneHalfWidth * 2 * h)
    } else if (trigger.kind === 'zone') {
      const [x, y, zw, zh] = trigger.rect
      ctx.fillRect(x * w, y * h, zw * w, zh * h)
    }
    ctx.restore()
  }

  // 横断歩道監視: ゾーンの多角形
  if (settings.inspectionGate && profile.zones) {
    const fill = { crosswalk: 'rgba(255, 81, 81, 0.22)', waiting: 'rgba(49, 198, 255, 0.22)', near: 'rgba(255, 170, 60, 0.18)', road: 'rgba(255,255,255,0.05)' } as const
    const stroke = { crosswalk: '#ff5151', waiting: '#31c6ff', near: '#ffaa3c', road: '#ffffff' } as const
    ctx.save()
    ctx.font = '600 10px "Noto Sans JP", "Hiragino Sans", sans-serif'
    for (const z of profile.zones) {
      ctx.beginPath()
      z.polygon.forEach(([px, py], i) => (i ? ctx.lineTo(px * w, py * h) : ctx.moveTo(px * w, py * h)))
      ctx.closePath()
      ctx.fillStyle = fill[z.kind]
      ctx.fill()
      ctx.strokeStyle = stroke[z.kind]
      ctx.lineWidth = 1
      ctx.setLineDash(z.kind === 'crosswalk' ? [] : [4, 3])
      ctx.stroke()
      ctx.setLineDash([])
      const [cx, cy] = z.polygon.reduce(([ax, ay], [px, py]) => [ax + px / z.polygon.length, ay + py / z.polygon.length], [0, 0])
      const tw = ctx.measureText(z.label).width + 8
      ctx.fillStyle = stroke[z.kind]
      ctx.fillRect(cx * w - tw / 2, cy * h - 7, tw, 14)
      ctx.fillStyle = '#080b10'
      ctx.textBaseline = 'middle'
      ctx.fillText(z.label, cx * w - tw / 2 + 4, cy * h + 0.5)
    }
    ctx.restore()
  }

  // カメラ劣化の色かぶり
  if (sample.cameraConfidence < 0.98) {
    const k = 1 - sample.cameraConfidence
    ctx.save()
    ctx.fillStyle = `rgba(255, 213, 42, ${k * 0.1})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  for (const d of sample.detections) drawDetection(ctx, d, w, h, settings, sample.time, profile)
}
