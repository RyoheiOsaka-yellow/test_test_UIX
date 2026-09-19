import { useInspectionStore } from '@/services/inspectionStore'
import { Panel, decisionColor, pct } from './Panel'

/** Second-level Jev: the line as a whole (NORMAL / WATCH / SLOW_LINE / STOP_LINE). */
export function LineDecisionPanel() {
  const ld = useInspectionStore((s) => s.lineDecision)
  const alert = useInspectionStore((s) => s.lineAlert)
  return (
    <Panel title="Line decision" right={<span className="font-mono text-[9px] text-ink-3">60s window</span>} bodyClassName="px-2.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className={`num text-[18px] ${ld ? decisionColor[ld.decision] ?? 'text-violet' : 'text-ink-3'}`}>{ld?.decision ?? 'NORMAL'}</span>
        <span className="num text-[12px] text-ink-2">{ld ? pct(ld.confidence) : '—'}</span>
      </div>
      <div className="mt-1 font-mono text-[10px] text-ink-3">{ld?.reason ?? 'awaiting window'}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(['NORMAL', 'WATCH', 'SLOW_LINE', 'STOP_LINE'] as const).map((o) => (
          <span
            key={o}
            className={`border px-1.5 py-[1px] font-mono text-[9px] tracking-[0.1em] ${
              ld?.decision === o ? `${decisionColor[o]} border-current` : 'border-border text-ink-3'
            }`}
          >
            {o}
          </span>
        ))}
      </div>
      {alert.active && (
        <div className="mt-2 border border-red/50 bg-red/10 px-2 py-1 font-mono text-[10px] text-red">
          {alert.message} · {pct(alert.rejectRate, 1)}
        </div>
      )}
    </Panel>
  )
}
