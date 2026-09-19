import { useInspectionStore } from '@/services/inspectionStore'

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
  const fmt = (n: number) => n.toLocaleString('ja-JP')
  return (
    <div className="panel flex items-stretch overflow-x-auto">
      <Kpi label="検査総数" value={fmt(kpi.totalInspected)} />
      <Kpi label="合格" value={fmt(kpi.pass)} tone="text-green" />
      <Kpi label="不良" value={fmt(kpi.reject)} tone="text-red" />
      <Kpi label="確認待ち" value={fmt(kpi.pendingReview)} tone="text-violet" />
      <Kpi label="良品率" value={kpi.totalInspected ? (kpi.yieldRate * 100).toFixed(1) : '—'} unit="%" tone="text-cyan" />
      <Kpi label="処理速度" value={kpi.throughputBpm ? kpi.throughputBpm.toFixed(0) : '—'} unit="本/分" />
      <Kpi label="判断遅延" value={kpi.decisionLatencyMs ? kpi.decisionLatencyMs.toFixed(0) : '—'} unit="ミリ秒" />
    </div>
  )
}
