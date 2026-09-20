import type { Grade, ObjectDecision } from '@/types/inspection'

/**
 * 5 段階グレード。判断（処置）とは別に「どの程度良いか / 悪いか」を連続量の異常度から決める。
 *
 *   A 良好   … 異常度 < 0.15   （緑）
 *   B 許容   … 0.15 〜 0.30    （黄緑）  合格だが余裕が小さい
 *   C 要注意 … 0.30 〜 0.55    （黄）    再検査で確定する
 *   D 要対処 … 0.55 〜 0.80    （橙）    人の確認へ
 *   E 不良   … ≥ 0.80          （赤）    自動処置
 *
 * 異常度 0..1 はプロファイルの種類ごとに決める（属性信頼度 / 計測のずれ / 場面スコア / 面積）。
 */
export const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'E']

export const GRADE_COLORS: Record<Grade, string> = {
  A: '#39ff88',
  B: '#b6f24a',
  C: '#ffd52a',
  D: '#ff8c3a',
  E: '#ff5151',
}

export const GRADE_LABELS_JA: Record<Grade, string> = {
  A: '良好',
  B: '許容',
  C: '要注意',
  D: '要対処',
  E: '不良',
}

export const GRADE_THRESHOLDS = { B: 0.15, C: 0.3, D: 0.55, E: 0.8 } as const

export function gradeFromSeverity(severity: number): Grade {
  const s = Math.min(1, Math.max(0, severity))
  if (s < GRADE_THRESHOLDS.B) return 'A'
  if (s < GRADE_THRESHOLDS.C) return 'B'
  if (s < GRADE_THRESHOLDS.D) return 'C'
  if (s < GRADE_THRESHOLDS.E) return 'D'
  return 'E'
}

/** グレードに対応する既定の処置 */
export function decisionForGrade(grade: Grade, recheckRound: number): ObjectDecision {
  switch (grade) {
    case 'A':
    case 'B':
      return 'PASS'
    case 'C':
      return recheckRound >= 1 ? 'HUMAN_REVIEW' : 'RECHECK'
    case 'D':
      return 'HUMAN_REVIEW'
    case 'E':
      return 'REJECT'
  }
}

/**
 * 提示した選択肢ごとのスコア（合計 1）。異常度がどの帯にどれだけ近いかと、
 * 証拠のばらつき（不安定なほど再検査・人の確認へ）から作る。模擬エンジン用。
 */
export function optionScores(severity: number, stability: number, options: readonly ObjectDecision[]): Partial<Record<ObjectDecision, number>> {
  const s = Math.min(1, Math.max(0, severity))
  const k = 6
  const raw: Record<ObjectDecision, number> = {
    PASS: Math.exp(-k * Math.max(0, s - 0.25)),
    RECHECK: Math.exp(-k * Math.abs(s - 0.42)) * (1.3 - 0.6 * stability),
    HUMAN_REVIEW: Math.exp(-k * Math.abs(s - 0.68)) * (1.2 - 0.5 * stability),
    REJECT: Math.exp(-k * Math.max(0, 0.8 - s)),
  }
  let sum = 0
  for (const o of options) sum += raw[o]
  const out: Partial<Record<ObjectDecision, number>> = {}
  for (const o of options) out[o] = sum > 0 ? raw[o] / sum : 0
  return out
}

/** 帯の境界からの余裕（0 = 境界上、1 = 帯の中央）。確信度の材料。 */
export function marginToBoundary(severity: number): number {
  const s = Math.min(1, Math.max(0, severity))
  const edges = [0, GRADE_THRESHOLDS.B, GRADE_THRESHOLDS.C, GRADE_THRESHOLDS.D, GRADE_THRESHOLDS.E, 1]
  let best = 1
  for (let i = 0; i < edges.length - 1; i++) {
    if (s >= edges[i] && s < edges[i + 1]) {
      const half = (edges[i + 1] - edges[i]) / 2
      best = 1 - Math.abs(s - (edges[i] + half)) / half
    }
  }
  return Math.max(0, Math.min(1, best))
}

/** 区分線形写像（x の折れ点列 → 異常度） */
function piecewise(x: number, pts: ReadonlyArray<readonly [number, number]>): number {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    if (x <= x1) return y0 + ((x - x0) / Math.max(1e-9, x1 - x0)) * (y1 - y0)
  }
  return pts[pts.length - 1][1]
}

/**
 * 属性信頼度（キャップ有・ラベル有など）→ 異常度。
 *   ≥ 0.875 A / 0.75〜0.875 B / 0.45〜0.75 C / 0.20〜0.45 D / < 0.20 E
 * 従来の 0.75 / 0.45 / 0.20 しきい値をそのまま帯の境界にしている。
 */
export function attributeSeverity(attribute: number): number {
  const a = Math.min(1, Math.max(0, attribute))
  return piecewise(1 - a, [
    [0, 0],
    [0.125, GRADE_THRESHOLDS.B],
    [0.25, GRADE_THRESHOLDS.C],
    [0.55, GRADE_THRESHOLDS.D],
    [0.8, GRADE_THRESHOLDS.E],
    [1, 1],
  ])
}

/**
 * 計測のずれ（許容幅の倍数 |value − target| / tolerance）→ 異常度。
 *   ≤ 0.5 A / 0.5〜1.0 B / 1.0〜1.6 C / 1.6〜2.4 D / ≥ 2.4 E
 */
export function measurementSeverity(deviationInTolerances: number): number {
  const d = Math.abs(deviationInTolerances)
  return piecewise(d, [
    [0, 0],
    [0.5, GRADE_THRESHOLDS.B],
    [1.0, GRADE_THRESHOLDS.C],
    [1.6, GRADE_THRESHOLDS.D],
    [2.4, GRADE_THRESHOLDS.E],
    [4.4, 1],
  ])
}

/**
 * 場面解析（転倒・横断歩道）の水準とスコア → 異常度。
 *   normal: スコア 0..0.4 を A〜B に、watch: C〜D、alert: D〜E（0.6 以上で E）
 */
export function sceneSeverity(level: 'normal' | 'watch' | 'alert', score: number): number {
  const s = Math.min(1, Math.max(0, score))
  if (level === 'alert') {
    // 警報水準でスコア 0.6 以上は E 帯の内側（0.85〜1）に置き、境界近傍で不確実扱いにならないようにする
    return s >= 0.6 ? piecewise(s, [[0.6, 0.85], [1, 1]]) : piecewise(s, [[0, GRADE_THRESHOLDS.D], [0.6, GRADE_THRESHOLDS.E]])
  }
  if (level === 'watch' || s >= 0.4) {
    return piecewise(s, [[0, GRADE_THRESHOLDS.C], [0.4, GRADE_THRESHOLDS.C + 0.1], [0.6, GRADE_THRESHOLDS.D], [1, GRADE_THRESHOLDS.E - 0.01]])
  }
  return piecewise(s, [[0, 0], [0.4, GRADE_THRESHOLDS.C - 0.01]])
}

/** 面積比（0..1、1 = 基準面積以上）→ 異常度。そのまま線形。 */
export function areaSeverity(areaRatio: number): number {
  return Math.min(1, Math.max(0, areaRatio))
}

/**
 * 処置の境界（PASS | RECHECK | HUMAN_REVIEW | REJECT = 0.30 / 0.55 / 0.80）からの余裕。
 * 0 = 境界上、1 = 十分離れている。確信度の主材料。
 */
export function decisionMargin(severity: number): number {
  const s = Math.min(1, Math.max(0, severity))
  let m: number
  if (s < GRADE_THRESHOLDS.C) m = (GRADE_THRESHOLDS.C - s) / 0.15
  else if (s < GRADE_THRESHOLDS.D) m = Math.min(s - GRADE_THRESHOLDS.C, GRADE_THRESHOLDS.D - s) / 0.125
  else if (s < GRADE_THRESHOLDS.E) m = Math.min(s - GRADE_THRESHOLDS.D, GRADE_THRESHOLDS.E - s) / 0.125
  else m = (s - GRADE_THRESHOLDS.E) / 0.1
  return Math.max(0, Math.min(1, m))
}

/**
 * 確信度の合成: 境界からの余裕 × 証拠の安定度 × 物体信頼度。
 * 境界のごく近く（余裕 < 0.1）で 0.65 を下回り、不確実として人の確認へ回る。
 */
export function composeConfidence(severity: number, stability: number, objectConfidence: number, readingConfidence = 1): number {
  const margin = decisionMargin(severity)
  const base = 0.62 + 0.38 * Math.pow(margin, 0.7)
  const c = base * (0.88 + 0.12 * stability) * (0.95 + 0.05 * objectConfidence) * (0.85 + 0.15 * readingConfidence)
  return Math.max(0, Math.min(1, c))
}

/** 選択肢スコアを、実際に選んだ処置が最大になるよう整合させる（表示の一貫性のため） */
export function alignScores(scores: Partial<Record<ObjectDecision, number>>, chosen: ObjectDecision): Partial<Record<ObjectDecision, number>> {
  const entries = Object.entries(scores) as Array<[ObjectDecision, number]>
  if (!entries.length || scores[chosen] === undefined) return scores
  const top = Math.max(...entries.map(([, v]) => v))
  const out = { ...scores }
  if ((out[chosen] ?? 0) < top) out[chosen] = top * 1.15
  const sum = (Object.values(out) as number[]).reduce((a, b) => a + b, 0)
  for (const k of Object.keys(out) as ObjectDecision[]) out[k] = (out[k] ?? 0) / sum
  return out
}

/** 標本の要約（中央値・p10〜p90 幅・安定度） */
export function summarizeSamples(samples: readonly number[]): { samples: number; median: number; spread: number; stability: number } {
  const n = samples.length
  if (!n) return { samples: 0, median: 0, spread: 0, stability: 0.7 }
  const s = [...samples].sort((a, b) => a - b)
  const q = (p: number) => s[Math.min(n - 1, Math.max(0, Math.round((n - 1) * p)))]
  const median = q(0.5)
  const spread = n >= 3 ? q(0.9) - q(0.1) : 0
  // 幅 0.25 で安定度 0、幅 0 で 1。標本 3 未満は「まだ分からない」= 0.6
  const stability = n >= 3 ? Math.max(0, Math.min(1, 1 - spread / 0.25)) : 0.6
  return { samples: n, median, spread, stability }
}
