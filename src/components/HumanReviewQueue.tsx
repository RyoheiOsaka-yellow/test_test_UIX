import { Check, X } from 'lucide-react'
import { reasonJa } from '@/i18n/ja'
import { getController } from '@/services/inspectionController'
import { useInspectionStore } from '@/services/inspectionStore'
import { Panel, pct } from './Panel'
import { GradeBadge } from './DecisionPanel'
import { GRADE_COLORS, GRADE_ORDER } from '@/services/grading'

/** 人の判定をグレード別に集計し、しきい値の見直し余地を示す */
function ReviewFeedback() {
  const stats = useInspectionStore((s) => s.reviewStats)
  const t = useInspectionStore((s) => s.gradeThresholds)
  const rows = GRADE_ORDER.map((g) => ({ g, ...stats[g], n: stats[g].pass + stats[g].reject })).filter((r) => r.n > 0)
  if (!rows.length) return null
  const hints: string[] = []
  const d = rows.find((r) => r.g === 'D')
  if (d && d.n >= 5 && d.pass / d.n >= 0.6) hints.push(`D の ${Math.round((d.pass / d.n) * 100)}% を人が合格にしています → D 境界（${t.D.toFixed(2)}）を上げる余地`)
  const c = rows.find((r) => r.g === 'C')
  if (c && c.n >= 5 && c.reject / c.n >= 0.6) hints.push(`C の ${Math.round((c.reject / c.n) * 100)}% を人が不良にしています → C 境界（${t.C.toFixed(2)}）を下げる余地`)
  const e = rows.find((r) => r.g === 'E')
  if (e && e.n >= 3 && e.pass / e.n >= 0.5) hints.push(`E でも人が合格にする例が多い → E 境界（${t.E.toFixed(2)}）を上げる余地`)
  return (
    <div className="border-t border-border-2 px-2.5 py-1.5 text-[9.5px] text-ink-3">
      <div className="mb-[2px] flex items-center justify-between">
        <span>人の判定 × JEV グレード</span>
        <span className="num">{rows.reduce((a, r) => a + r.n, 0)} 件</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-[2px]">
        {rows.map((r) => (
          <span key={r.g} className="flex items-center gap-1">
            <span className="font-semibold" style={{ color: GRADE_COLORS[r.g] }}>{r.g}</span>
            <span className="num text-ink-2">合格 {r.pass}</span>
            <span className="num text-ink-2">不良 {r.reject}</span>
            <span className="num">（人が合格 {Math.round((r.pass / r.n) * 100)}%）</span>
          </span>
        ))}
      </div>
      {hints.map((h) => (
        <div key={h} className="mt-[3px] text-yellow">{h}</div>
      ))}
    </div>
  )
}

export function HumanReviewQueue() {
  const queue = useInspectionStore((s) => s.reviewQueue)
  const profile = useInspectionStore((s) => s.profile)
  const controller = getController()
  return (
    <Panel
      title="人による確認待ち"
      right={<span className={`num text-[10px] ${queue.length ? 'text-violet' : 'text-ink-3'}`}>{queue.length}</span>}
      className="max-h-[260px]"
      bodyClassName="overflow-y-auto"
    >
      {queue.length === 0 ? (
        <div className="px-2.5 py-2 text-[10.5px] text-ink-3">確認待ちはありません</div>
      ) : (
        queue.map((item) => (
          <div key={item.objectId + item.timestamp} className="flex items-center gap-2 border-b border-border-2 px-2.5 py-1.5 last:border-b-0">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="num text-[12px] text-ink">{item.objectId}</span>
                <GradeBadge grade={item.grade} size="sm" />
                <span className="text-[10px] text-violet">{profile.attributeLabel}? {pct(item.attributeConfidence)}</span>
              </div>
              <div className="text-[9.5px] text-ink-3">
                JEV {pct(item.jevConfidence)} · {reasonJa(item.reason, profile)}
              </div>
            </div>
            <button className="btn btn-primary !px-1.5 !py-1" onClick={() => controller.store.resolveReview(item.objectId, 'PASS', controller.bus)} title="合格にする">
              <Check size={11} /> 合格
            </button>
            <button
              className="btn !border-red/50 !bg-red/10 !px-1.5 !py-1 !text-red"
              onClick={() => controller.store.resolveReview(item.objectId, 'REJECT', controller.bus)}
              title="不良にする"
            >
              <X size={11} /> 不良
            </button>
          </div>
        ))
      )}
      <ReviewFeedback />
    </Panel>
  )
}
