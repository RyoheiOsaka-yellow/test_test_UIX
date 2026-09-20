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
