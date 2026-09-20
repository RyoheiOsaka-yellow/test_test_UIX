import type { StateReading } from '@/types/inspection'

/**
 * 転倒検知の時系列判定。
 *
 * 入力は追跡された人物の骨格（COCO 17 点）と枠。フレームごとに 5 つの特徴量を出し、
 * 約 1 秒の窓で状態機械を回して NORMAL / FALLING / FALLEN を決める。
 *
 *   1. 体の位置   … 腰の高さが立位時からどれだけ下がったか（枠高さ基準）
 *   2. 角度       … 肩の中心と腰の中心を結ぶ胴体の傾き（0 = 直立）
 *   3. 形状       … 枠の縦横比（横長ほど床に伏せている）
 *   4. 動き       … 腰の速度（立位時の枠高さ／秒）
 *   5. 姿勢信頼度 … キーポイント信頼度の平均
 *
 * 学習済み LSTM の代わりに、同じ 5 特徴量を使った規則ベースの判定（フェーズ1）。
 * 1 フレームだけでは「素早く座る」「床の近くで作業する」と区別できないので、
 * 落下（急な下降）を見た後に横たわった姿勢が続くことを転倒の確定条件にしている。
 */

const L_SHOULDER = 5, R_SHOULDER = 6, L_HIP = 11, R_HIP = 12

interface Sample {
  t: number
  hipY: number
  hipX: number
  height: number
  torsoDeg: number
  aspect: number
  poseConf: number
}

export class FallDetector {
  private samples: Sample[] = []
  private standingHeight = 0
  private standingHipY = 0
  private state: 'NORMAL' | 'FALLING' | 'FALLEN' = 'NORMAL'
  private stateSince = 0
  private lastFallImpulse = -Infinity
  private lastTime = -Infinity

  reset() {
    this.samples = []
    this.standingHeight = 0
    this.standingHipY = 0
    this.state = 'NORMAL'
    this.stateSince = 0
    this.lastFallImpulse = -Infinity
    this.lastTime = -Infinity
  }

  /** 1 フレーム分を入力して状態を返す。keypoints は [x,y,conf]×17（正規化） */
  update(t: number, bbox: [number, number, number, number], keypoints: number[] | undefined): StateReading {
    if (t < this.lastTime - 0.25) this.reset()
    this.lastTime = t
    const kp = (i: number) => ({ x: keypoints?.[i * 3] ?? NaN, y: keypoints?.[i * 3 + 1] ?? NaN, c: keypoints?.[i * 3 + 2] ?? 0 })
    const pts = [L_SHOULDER, R_SHOULDER, L_HIP, R_HIP].map(kp)
    const poseConf = keypoints ? keypoints.filter((_, i) => i % 3 === 2).reduce((a, b) => a + b, 0) / 17 : 0
    const good = (p: { c: number }) => p.c > 0.3
    const shoulder = good(pts[0]) && good(pts[1]) ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : null
    const hip = good(pts[2]) && good(pts[3]) ? { x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2 } : null
    const [bx, by, bw, bh] = bbox
    const hipY = hip ? hip.y : by + bh * 0.6
    const hipX = hip ? hip.x : bx + bw / 2
    const torsoDeg = shoulder && hip ? (Math.atan2(Math.abs(hip.x - shoulder.x), Math.abs(hip.y - shoulder.y)) * 180) / Math.PI : 0
    const aspect = bh > 0 ? bw / bh : 0

    // 立位の基準（最初の 1 秒 / 縦長で背が高い間に更新）
    if (aspect < 0.75 && bh > this.standingHeight * 0.9) {
      this.standingHeight = Math.max(this.standingHeight * 0.9, bh)
      this.standingHipY = this.standingHipY ? this.standingHipY * 0.8 + hipY * 0.2 : hipY
    }
    const ref = this.standingHeight || bh
    this.samples.push({ t, hipY, hipX, height: bh, torsoDeg, aspect, poseConf })
    while (this.samples.length && this.samples[0].t < t - 1.2) this.samples.shift()

    // 動き: 直近 0.3 秒の腰の速度（立位枠高さ / 秒）
    const past = this.samples.find((s) => s.t >= t - 0.35) ?? this.samples[0]
    const dt = Math.max(1e-3, t - past.t)
    const vy = (hipY - past.hipY) / dt / ref
    const motion = Math.hypot(hipY - past.hipY, hipX - past.hipX) / dt / ref
    const bodyPosition = Math.min(1, Math.max(0, (hipY - this.standingHipY) / ref))
    const heightRatio = bh / ref

    // 落下インパルス: 急な下降 + 背が低くなる
    if (vy > 0.9 || (vy > 0.5 && heightRatio < 0.8)) this.lastFallImpulse = t
    // 横たわり姿勢: 横長 or 胴が倒れている、かつ低い
    const lying = (aspect > 1.0 || torsoDeg > 55) && (heightRatio < 0.75 || bodyPosition > 0.25)
    const recentImpulse = t - this.lastFallImpulse < 1.5
    const calm = motion < 0.35

    let score = 0
    score += Math.min(1, bodyPosition / 0.35) * 0.3
    score += Math.min(1, Math.max(0, torsoDeg - 30) / 40) * 0.2
    score += Math.min(1, Math.max(0, aspect - 0.7) / 0.7) * 0.25
    score += (recentImpulse ? 0.25 : 0)
    score *= 0.6 + 0.4 * Math.min(1, poseConf / 0.7)

    const prev = this.state
    if (this.state === 'NORMAL') {
      if (recentImpulse && (lying || heightRatio < 0.7)) this.set('FALLING', t)
      else if (lying && calm && t - this.stateSince > 0.5 && score >= 0.5) this.set('FALLING', t)
    } else if (this.state === 'FALLING') {
      if (lying && calm && t - this.stateSince >= 0.3) this.set('FALLEN', t)
      else if (!lying && !recentImpulse && t - this.stateSince > 1.0) this.set('NORMAL', t)
    } else if (this.state === 'FALLEN') {
      if (!lying && heightRatio > 0.8 && aspect < 0.8 && this.samplesSince(t - 1.0).every((s) => s.aspect < 0.8)) this.set('NORMAL', t)
    }
    if (prev !== this.state && this.state === 'NORMAL') this.lastFallImpulse = -Infinity

    const fallScore = Math.min(1, this.state === 'FALLEN' ? Math.max(score, 0.6) : score)
    return {
      state: this.state,
      stateLabel: this.state === 'NORMAL' ? '正常' : this.state === 'FALLING' ? '転倒中' : '転倒（床上）',
      level: this.state === 'FALLEN' ? 'alert' : this.state === 'FALLING' ? 'watch' : 'normal',
      score: fallScore,
      holdSeconds: t - this.stateSince,
      confidence: poseConf,
      features: [
        { key: 'body_position', label: '体の位置（腰の低下）', value: bodyPosition },
        { key: 'torso_angle_deg', label: '角度（胴の傾き）', value: torsoDeg, unit: '°', digits: 0 },
        { key: 'aspect_ratio', label: '形状（縦横比）', value: aspect },
        { key: 'motion', label: '動き（腰の速度）', value: motion },
        { key: 'pose_confidence', label: '姿勢信頼度', value: poseConf },
      ],
    }
  }

  private set(state: 'NORMAL' | 'FALLING' | 'FALLEN', t: number) {
    this.state = state
    this.stateSince = t
  }

  private samplesSince(t0: number) {
    return this.samples.filter((s) => s.t >= t0)
  }
}

/** COCO 17 点の結線（骨格描画用） */
export const SKELETON: Array<[number, number]> = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 5], [0, 6], [0, 1], [0, 2], [1, 3], [2, 4],
]
