import type { Ref } from 'react'
import type { OverlaySettings } from '@/types/inspection'
import type { FrameSample } from '@/services/videoDetectionSimulator'
import { drawDetection } from './DetectionLabel'

/**
 * Transparent canvas layered over the video. Drawing is driven by the parent's
 * requestAnimationFrame loop (see VideoInspection) so bounding boxes never go
 * through React state.
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
) {
  ctx.clearRect(0, 0, w, h)
  if (!settings.overlay) return

  // Inspection zone band (subtle).
  if (settings.inspectionGate) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 213, 42, 0.035)'
    ctx.fillRect((0.5 - 0.06) * w, 0, 0.12 * w, h)
    ctx.restore()
  }

  // Camera degradation veil.
  if (sample.cameraConfidence < 0.98) {
    const k = 1 - sample.cameraConfidence
    ctx.save()
    ctx.fillStyle = `rgba(255, 213, 42, ${k * 0.10})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  for (const d of sample.detections) drawDetection(ctx, d, w, h, settings, sample.time)
}
