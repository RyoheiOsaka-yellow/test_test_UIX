import type { FrameDetection, InspectionProfile, OverlaySettings } from '@/types/inspection'
import { DECISION_JA, classJa } from '@/i18n/ja'
import { SKELETON } from '@/services/fallDetector'
import { GRADE_COLORS, gradeLabel } from '@/services/grading'
import { harvestText } from '@/services/ripenessMeter'

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

const LEVEL_COLOR = { normal: '#39ff88', watch: '#ffd52a', alert: '#ff5151' } as const
const VEHICLE_COLOR = '#31c6ff'

export function labelText(d: FrameDetection, settings: OverlaySettings, profile: InspectionProfile): string {
  const parts: string[] = []
  if (settings.trackingId) parts.push(d.label)
  if (d.personState) {
    if (d.objectClass && profile.classLabels?.[d.objectClass]) parts.push(profile.classLabels[d.objectClass])
    parts.push(d.personState.stateLabel)
    if (d.personState.level === 'alert') parts.push(`${d.personState.holdSeconds.toFixed(1)}秒`)
    if (settings.confidence && d.personState.score > 0) parts.push(`スコア ${d.personState.score.toFixed(2)}`)
    return parts.join(' ')
  }
  if (profile.measurement?.method === 'ripeness' && d.measurement) {
    parts.push(`${profile.measurement.label} ${(d.measurement.value * 100).toFixed(0)}%`)
    if (settings.confidence) parts.push(harvestText(d.measurement.value))
    return parts.join(' ')
  }
  if (profile.measurement && d.measurement) {
    parts.push(`${profile.measurement.label} ${(d.measurement.value * 100).toFixed(1)}%`)
    if (settings.confidence && Math.abs(d.measurement.tiltDeg) >= 1) parts.push(`傾き ${d.measurement.tiltDeg.toFixed(0)}°`)
    return parts.join(' ')
  }
  if (profile.severityFromArea) {
    const area = d.bbox[2] * d.bbox[3]
    parts.push(classJa(d.detectionClass, profile))
    if (settings.confidence) parts.push(`${profile.severityFromArea.label} ${(area * 100).toFixed(1)}%`)
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
  const isVehicle = d.objectClass && ['car', 'truck', 'bus', 'motorcycle'].includes(d.objectClass)
  // 色は 5 段階グレード（A 緑 / B 黄緑 / C 黄 / D 橙 / E 赤）。判定前は暫定グレード、判定後は確定グレード
  const gradeColor = d.provisionalGrade ? GRADE_COLORS[d.provisionalGrade] : undefined
  const color = d.personState
    ? isVehicle && d.personState.level === 'normal'
      ? VEHICLE_COLOR
      : (gradeColor ?? LEVEL_COLOR[d.personState.level])
    : (gradeColor ?? CLASS_COLORS[d.detectionClass] ?? '#31c6ff')
  const inspecting = d.phase === 'INSPECTING'
  const uncertain = d.decision !== undefined && d.decision.confidence < 0.65
  // ゲート前の追跡中と、判定から2秒以上経った物体は簡略表示にして、
  // 検査中・判定直後だけを目立たせる（実映像は同時に30本以上映るため）
  const decidedAge = d.gateTime !== undefined ? now - d.gateTime : -1
  const compact = !d.personState && (d.phase === 'TRACKED' || (d.phase === 'DECIDED' && decidedAge > 2))

  if (settings.boundingBox) {
    ctx.save()
    ctx.strokeStyle = d.phase === 'TRACKED' ? '#31c6ff' : color
    ctx.lineWidth = inspecting ? 2 : 1
    ctx.globalAlpha = compact ? 0.55 : d.phase === 'DECIDED' ? 0.9 : 0.85
    // 確信度 0.65 未満の判定は破線（不確実 = 人の確認へ）
    if (uncertain) ctx.setLineDash([4, 3])
    ctx.strokeRect(x + 0.5, y + 0.5, bw, bh)
    ctx.setLineDash([])

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

    // 異常度バー（枠の下辺）: 長さ = 異常度、色 = グレード。検査中と判定直後のみ
    if (!compact && d.liveSeverity !== undefined && bw >= 24) {
      ctx.globalAlpha = 0.9
      ctx.fillStyle = 'rgba(8, 11, 16, 0.7)'
      ctx.fillRect(x, y + bh - 3, bw, 3)
      ctx.fillStyle = color
      ctx.fillRect(x, y + bh - 3, bw * Math.max(0.02, Math.min(1, d.liveSeverity)), 3)
    }
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
  if (profile.measurement && profile.measurement.method !== 'ripeness' && d.measurement && settings.boundingBox && !compact) {
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
    const gc = GRADE_COLORS[d.decision.grade]
    const dl = profile.decisionLabels?.[d.decision.decision] ?? DECISION_JA[d.decision.decision]
    const gradeText = compact ? d.decision.grade : `${d.decision.grade} ${gradeLabel(d.decision.grade, profile)}`
    const text = compact ? dl : `${dl} ${Math.round(d.decision.confidence * 100)}%${uncertain ? ' ?' : ''}`
    ctx.save()
    ctx.font = TAG_FONT
    const gw = ctx.measureText(gradeText).width + 8
    const tw = ctx.measureText(text).width + 10
    const th = 15
    let lx = x
    if (lx + gw + tw > w) lx = w - gw - tw
    const ly = Math.min(h - th, y + bh + 3)
    // グレード章（塗り）
    ctx.fillStyle = gc
    ctx.fillRect(lx, ly, gw, th)
    ctx.fillStyle = '#080b10'
    ctx.textBaseline = 'middle'
    ctx.fillText(gradeText, lx + 4, ly + th / 2 + 0.5)
    // 処置タグ（枠）
    ctx.strokeStyle = dc
    ctx.fillStyle = 'rgba(8, 11, 16, 0.85)'
    ctx.lineWidth = 1
    ctx.fillRect(lx + gw, ly, tw, th)
    if (uncertain) ctx.setLineDash([3, 2])
    ctx.strokeRect(lx + gw + 0.5, ly + 0.5, tw, th)
    ctx.setLineDash([])
    ctx.fillStyle = dc
    ctx.fillText(text, lx + gw + 5, ly + th / 2 + 0.5)
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
