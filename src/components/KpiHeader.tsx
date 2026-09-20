import { useInspectionStore } from '@/services/inspectionStore'
import { GRADE_COLORS, GRADE_LABELS_JA, GRADE_ORDER } from '@/services/grading'

/** 5 段階グレードの分布（件数バー） */
function GradeDistribution({ grades, total }: { grades: Record<string, number>; total: number }) {
  const max = Math.max(1, ...GRADE_ORDER.map((g) => grades[g] ?? 0))
  return (
    <div className="flex min-w-[200px] flex-col gap-0.5 border-r border-border-2 px-4 py-2 last:border-r-0">
      <span className="label">グレード分布（A 良好 → E 不良）</span>
      <div className="flex items-end gap-2">
        {GRADE_ORDER.map((g) => {
          const n = grades[g] ?? 0
          return (
            <div key={g} className="flex flex-col items-center gap-[2px]" title={`${g} ${GRADE_LABELS_JA[g]}: ${n} 件`}>
              <span className="num text-[10px] leading-none" style={{ color: GRADE_COLORS[g] }}>{n}</span>
              <div className="flex h-[14px] w-[18px] items-end bg-border-2/60">
                <div className="w-full" style={{ height: `${Math.round((n / max) * 100)}%`, background: GRADE_COLORS[g], minHeight: n ? 2 : 0 }} />
              </div>
              <span className="text-[9px] font-semibold leading-none" style={{ color: GRADE_COLORS[g] }}>{g}</span>
            </div>
          )
        })}
        <span className="num ml-1 self-center text-[10px] text-ink-3">{total ? `${Math.round(((grades.A ?? 0) + (grades.B ?? 0)) / total * 100)}% A+B` : ''}</span>
      </div>
    </div>
  )
}

function Kpi({ label, value, unit, tone = 'text-ink' }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="flex min-w-[128px] flex-col gap-0.5 border-r border-border-2 px-4 py-2 last:border-r-0">
      <span className="label">{label}</span>
      <span className={`num text-[22px] leading-none ${tone}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] text-ink-3">{unit}</span>}
      </span>
    </div>
  )
}

export function KpiHeader() {
  const kpi = useInspectionStore((s) => s.kpi)
  const profile = useInspectionStore((s) => s.profile)
  const fmt = (n: number) => n.toLocaleString('ja-JP')
  return (
    <div className="panel flex items-stretch overflow-x-auto">
      <Kpi label={profile.kpiLabels?.total ?? '検査総数'} value={fmt(kpi.totalInspected)} />
      <Kpi label={profile.kpiLabels?.pass ?? '合格'} value={fmt(kpi.pass)} tone="text-green" />
      <Kpi label={profile.kpiLabels?.reject ?? '不良'} value={fmt(kpi.reject)} tone="text-red" />
      <Kpi label="確認待ち" value={fmt(kpi.pendingReview)} tone="text-violet" />
      <GradeDistribution grades={kpi.grades} total={kpi.totalInspected} />
      <Kpi label={profile.kpiLabels?.yield ?? '良品率'} value={kpi.totalInspected ? (kpi.yieldRate * 100).toFixed(1) : '—'} unit="%" tone="text-cyan" />
      <Kpi label="処理速度" value={kpi.throughputBpm ? kpi.throughputBpm.toFixed(0) : '—'} unit={profile.kpiLabels?.throughputUnit ?? '本/分'} />
      <Kpi label="判断遅延" value={kpi.decisionLatencyMs ? kpi.decisionLatencyMs.toFixed(0) : '—'} unit="ミリ秒" />
    </div>
  )
}
