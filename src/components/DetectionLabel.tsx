import type { FrameDetection, OverlaySettings } from '@/types/inspection'

/**
 * Canvas drawing helpers for a single detection: bounding box + label.
 * Kept as pure functions so the overlay can render at 60fps without React.
 */

export const CLASS_COLORS: Record<string, string> = {
  CAPPED: '#39ff88',
  UNCAPPED: '#ff5151',
  LOW_CAP: '#ffd52a',
  MISALIGNED_CAP: '#ffd52a',
  DAMAGED_CAP: '#ff5151',
  NO_LABEL: '#31c6ff',
  LABEL_MISALIGNED: '#31c6ff',
  DEFORMED_BOTTLE: '#ff5151',
  FOREIGN_OBJECT: '#ff5151',
}

const DECISION_COLORS: Record<string, string> = {
  PASS: '#39ff88',
  REJECT: '#ff5151',
  RECHECK: '#ffd52a',
  HUMAN_REVIEW: '#b38cff',
}

export function labelText(d: FrameDetection, settings: OverlaySettings): string {
  const parts: string[] = []
  if (settings.trackingId) parts.push(d.label)
  parts.push(d.detectionClass)
  if (settings.confidence) parts.push(`${Math.round(d.classConfidence * 100)}%`)
  return parts.join(' ')
}

export function drawDetection(
  ctx: CanvasRenderingContext2D,
  d: FrameDetection,
  w: number,
  h: number,
  settings: OverlaySettings,
  now: number,
) {
  const [nx, ny, nw, nh] = d.bbox
  const x = nx * w
  const y = ny * h
  const bw = nw * w
  const bh = nh * h
  const color = CLASS_COLORS[d.detectionClass] ?? '#31c6ff'
  const inspecting = d.phase === 'INSPECTING'

  if (settings.boundingBox) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = inspecting ? 2 : 1.25
    ctx.globalAlpha = d.phase === 'DECIDED' ? 0.9 : 0.85
    ctx.strokeRect(x + 0.5, y + 0.5, bw, bh)

    // Corner brackets for a machine-vision feel.
    const c = Math.min(10, bw * 0.3)
    ctx.lineWidth = 2.5
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y)
    ctx.moveTo(x + bw - c, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + c)
    ctx.moveTo(x, y + bh - c); ctx.lineTo(x, y + bh); ctx.lineTo(x + c, y + bh)
    ctx.moveTo(x + bw - c, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - c)
    ctx.stroke()

    // Subtle fill while in the inspection zone.
    if (inspecting) {
      ctx.globalAlpha = 0.08
      ctx.fillStyle = color
      ctx.fillRect(x, y, bw, bh)
    }
    // Centre tick (tracking centroid).
    ctx.globalAlpha = 0.6
    ctx.lineWidth = 1
    const cx = x + bw / 2
    const cy = y + bh / 2
    ctx.beginPath()
    ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy)
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4)
    ctx.stroke()
    ctx.restore()
  }

  // Label
  if (settings.trackingId || settings.confidence || settings.boundingBox) {
    const text = labelText(d, settings)
    ctx.save()
    ctx.font = '600 11px "JetBrains Mono", "IBM Plex Mono", monospace'
    const tw = ctx.measureText(text).width + 10
    const th = 16
    let lx = x
    const ly = Math.max(0, y - th - 2)
    if (lx + tw > w) lx = w - tw
    ctx.fillStyle = color
    ctx.globalAlpha = 0.92
    ctx.fillRect(lx, ly, tw, th)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#080b10'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, lx + 5, ly + th / 2 + 0.5)
    ctx.restore()
  }

  // Decision tag (below the box) once the object is past the gate.
  if (settings.jevDecision && d.decision && d.gateTime !== undefined) {
    const dc = DECISION_COLORS[d.decision.decision] ?? '#31c6ff'
    const text = `${d.decision.decision} ${Math.round(d.decision.confidence * 100)}%`
    ctx.save()
    ctx.font = '600 10.5px "JetBrains Mono", "IBM Plex Mono", monospace'
    const tw = ctx.measureText(text).width + 10
    const th = 15
    let lx = x
    if (lx + tw > w) lx = w - tw
    const ly = Math.min(h - th, y + bh + 3)
    ctx.strokeStyle = dc
    ctx.fillStyle = 'rgba(8, 11, 16, 0.85)'
    ctx.lineWidth = 1
    ctx.fillRect(lx, ly, tw, th)
    ctx.strokeRect(lx + 0.5, ly + 0.5, tw, th)
    ctx.fillStyle = dc
    ctx.textBaseline = 'middle'
    ctx.fillText(text, lx + 5, ly + th / 2 + 0.5)
    ctx.restore()

    // Reject effect: a restrained red pulse ring + "REJECT" stamp for ~1.4s after the decision.
    const age = now - d.gateTime
    if (d.decision.decision === 'REJECT' && age >= 0 && age < 1.4) {
      const k = age / 1.4
      ctx.save()
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.strokeStyle = '#ff5151'
      ctx.lineWidth = 1.5
      const r = 10 + k * 26
      ctx.beginPath()
      ctx.arc(x + bw / 2, y + bh / 2, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = '700 13px "JetBrains Mono", "IBM Plex Mono", monospace'
      ctx.fillStyle = '#ff5151'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('REJECT', x + bw / 2, y + bh / 2 - 22 - k * 10)
      ctx.restore()
    } else if (d.decision.decision === 'PASS' && age >= 0 && age < 0.7) {
      const k = age / 0.7
      ctx.save()
      ctx.globalAlpha = (1 - k) * 0.7
      ctx.strokeStyle = '#39ff88'
      ctx.lineWidth = 1
      ctx.strokeRect(x - 2 - k * 4, y - 2 - k * 4, bw + 4 + k * 8, bh + 4 + k * 8)
      ctx.restore()
    }
  }
}
