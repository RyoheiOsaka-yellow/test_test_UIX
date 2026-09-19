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
  const fmt = (n: number) => n.toLocaleString('en-US')
  return (
    <div className="panel flex items-stretch overflow-x-auto">
      <Kpi label="Total inspected" value={fmt(kpi.totalInspected)} />
      <Kpi label="Pass" value={fmt(kpi.pass)} tone="text-green" />
      <Kpi label="Reject" value={fmt(kpi.reject)} tone="text-red" />
      <Kpi label="Review" value={fmt(kpi.pendingReview)} tone="text-violet" />
      <Kpi label="Yield" value={kpi.totalInspected ? (kpi.yieldRate * 100).toFixed(1) : '—'} unit="%" tone="text-cyan" />
      <Kpi label="Throughput" value={kpi.throughputBpm ? kpi.throughputBpm.toFixed(0) : '—'} unit="BPM" />
      <Kpi label="Decision latency" value={kpi.decisionLatencyMs ? kpi.decisionLatencyMs.toFixed(0) : '—'} unit="ms" />
    </div>
  )
}
