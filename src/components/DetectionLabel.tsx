import type { FrameDetection, InspectionProfile, OverlaySettings } from '@/types/inspection'
import { DECISION_JA, classJa } from '@/i18n/ja'
import { SKELETON } from '@/services/fallDetector'

/**
 * 検知1件分の描画ヘルパー（バウンディングボックス + ラベル）。
 * 60fps で描くため React を通さない純関数にしてある。
 */

export const CLASS_COLORS: Record<string, string> = {
  OK: '#39ff88',
  NG: '#ff5151',
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

const LABEL_FONT = '600 11px "JetBrains Mono", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif'
const TAG_FONT = '600 10.5px "JetBrains Mono", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif'
const STAMP_FONT = '700 13px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif'

const PERSON_STATE_JA = { NORMAL: '正常', FALLING: '転倒中', FALLEN: '転倒（床上）' } as const
const PERSON_STATE_COLOR = { NORMAL: '#39ff88', FALLING: '#ffd52a', FALLEN: '#ff5151' } as const

export function labelText(d: FrameDetection, settings: OverlaySettings, profile: InspectionProfile): string {
  const parts: string[] = []
  if (settings.trackingId) parts.push(d.label)
  if (d.personState) {
    parts.push(PERSON_STATE_JA[d.personState.state])
    if (d.personState.state === 'FALLEN') parts.push(`${d.personState.onGroundSeconds.toFixed(1)}秒`)
    if (settings.confidence) parts.push(`スコア ${d.personState.fallScore.toFixed(2)}`)
    return parts.join(' ')
  }
  if (profile.measurement && d.measurement) {
    parts.push(`${profile.measurement.label} ${(d.measurement.value * 100).toFixed(1)}%`)
    if (settings.confidence && Math.abs(d.measurement.tiltDeg) >= 1) parts.push(`傾き ${d.measurement.tiltDeg.toFixed(0)}°`)
    return parts.join(' ')
  }
  parts.push(classJa(d.detectionClass, profile))
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
  profile: InspectionProfile,
) {
  const [nx, ny, nw, nh] = d.bbox
  const x = nx * w
  const y = ny * h
  const bw = nw * w
  const bh = nh * h
  const color = d.personState ? PERSON_STATE_COLOR[d.personState.state] : (CLASS_COLORS[d.detectionClass] ?? '#31c6ff')
  const inspecting = d.phase === 'INSPECTING'
  // ゲート前の追跡中と、判定から2秒以上経った物体は簡略表示にして、
  // 検査中・判定直後だけを目立たせる（実映像は同時に30本以上映るため）
  const decidedAge = d.gateTime !== undefined ? now - d.gateTime : -1
  const compact = !d.personState && (d.phase === 'TRACKED' || (d.phase === 'DECIDED' && decidedAge > 2))

  if (settings.boundingBox) {
    ctx.save()
    ctx.strokeStyle = d.phase === 'TRACKED' ? '#31c6ff' : color
    ctx.lineWidth = inspecting ? 2 : 1
    ctx.globalAlpha = compact ? 0.55 : d.phase === 'DECIDED' ? 0.9 : 0.85
    ctx.strokeRect(x + 0.5, y + 0.5, bw, bh)

    const c = Math.min(10, bw * 0.3)
    ctx.lineWidth = compact ? 1.5 : 2.5
    ctx.globalAlpha = compact ? 0.7 : 1
    ctx.beginPath()
    ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y)
    ctx.moveTo(x + bw - c, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + c)
    ctx.moveTo(x, y + bh - c); ctx.lineTo(x, y + bh); ctx.lineTo(x + c, y + bh)
    ctx.moveTo(x + bw - c, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - c)
    ctx.stroke()

    if (inspecting) {
      ctx.globalAlpha = 0.08
      ctx.fillStyle = color
      ctx.fillRect(x, y, bw, bh)
    }
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

  // 人物プロファイル: 骨格を描く
  if (d.keypoints && settings.boundingBox) {
    const kp = d.keypoints
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.95
    for (const [a, b] of SKELETON) {
      if (kp[a * 3 + 2] < 0.3 || kp[b * 3 + 2] < 0.3) continue
      ctx.beginPath()
      ctx.moveTo(kp[a * 3] * w, kp[a * 3 + 1] * h)
      ctx.lineTo(kp[b * 3] * w, kp[b * 3 + 1] * h)
      ctx.stroke()
    }
    for (let i = 0; i < 17; i++) {
      if (kp[i * 3 + 2] < 0.3) continue
      ctx.beginPath()
      ctx.arc(kp[i * 3] * w, kp[i * 3 + 1] * h, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // 計測プロファイル: 推定した液面の線を枠内に描く
  if (profile.measurement && d.measurement && settings.boundingBox && !compact) {
    const bodyTop = y + bh * 0.2
    const bodyBottom = y + bh * 0.995
    const ly = bodyBottom - d.measurement.value * (bodyBottom - bodyTop)
    const dy = Math.tan((d.measurement.tiltDeg * Math.PI) / 180) * (bw / 2)
    ctx.save()
    ctx.strokeStyle = '#31c6ff'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(x, ly + dy)
    ctx.lineTo(x + bw, ly - dy)
    ctx.stroke()
    // 目標帯
    const t0 = bodyBottom - (profile.measurement.target + profile.measurement.tolerance) * (bodyBottom - bodyTop)
    const t1 = bodyBottom - (profile.measurement.target - profile.measurement.tolerance) * (bodyBottom - bodyTop)
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(57, 255, 136, 0.12)'
    ctx.fillRect(x, t0, bw, t1 - t0)
    ctx.restore()
  }

  if (compact) {
    if (settings.trackingId) {
      ctx.save()
      ctx.font = TAG_FONT
      ctx.fillStyle = 'rgba(49, 198, 255, 0.85)'
      ctx.textBaseline = 'bottom'
      ctx.fillText(d.label, x + 1, Math.max(10, y - 2))
      ctx.restore()
    }
  } else if (settings.trackingId || settings.confidence || settings.boundingBox) {
    const text = labelText(d, settings, profile)
    ctx.save()
    ctx.font = LABEL_FONT
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

  if (settings.jevDecision && d.decision && d.gateTime !== undefined) {
    const dc = DECISION_COLORS[d.decision.decision] ?? '#31c6ff'
    const dl = profile.decisionLabels?.[d.decision.decision] ?? DECISION_JA[d.decision.decision]
    const text = compact ? dl : `${dl} ${Math.round(d.decision.confidence * 100)}%`
    ctx.save()
    ctx.font = TAG_FONT
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

    // 不良判定の演出: 控えめな赤いリングと「不良」スタンプを約1.4秒
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
      ctx.font = STAMP_FONT
      ctx.fillStyle = '#ff5151'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${profile.decisionLabels?.REJECT ?? '不良'} ${profile.rejectAction}`, x + bw / 2, y + bh / 2 - 22 - k * 10)
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
