import { useInspectionStore } from '@/services/inspectionStore'
import { Panel, decisionColor, pct } from './Panel'

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-[3px] w-full bg-border-2">
      <div className="h-full transition-[width] duration-150" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

export function DecisionPanel() {
  const cur = useInspectionStore((s) => s.currentObject)
  const mode = useInspectionStore((s) => s.mode)
  const d = cur?.decision
  return (
    <Panel
      title="JEV Decision Engine"
      right={<span className={`font-mono text-[9px] ${mode === 'JEV_LIVE' ? 'text-green' : 'text-cyan'}`}>{mode === 'JEV_LIVE' ? 'LIVE' : 'SIM'}</span>}
      bodyClassName="px-2.5 py-2"
    >
      <div className="label mb-1">Current object</div>
      <div className="flex items-baseline justify-between">
        <span className="label">ID</span>
        <span className="num text-[18px] text-ink">{cur?.objectId ?? '—'}</span>
      </div>

      <div className="label mt-3 mb-1">Vision</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] text-ink-2">Bottle</span>
            <span className="num text-[13px]">{cur ? pct(cur.bottleConfidence) : '—'}</span>
          </div>
          <Bar value={cur?.bottleConfidence ?? 0} color="#31c6ff" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] text-ink-2">Cap</span>
            <span className={`num text-[13px] ${cur && cur.capConfidence < 0.45 ? 'text-red' : cur && cur.capConfidence < 0.75 ? 'text-yellow' : ''}`}>
              {cur ? pct(cur.capConfidence) : '—'}
            </span>
          </div>
          <Bar value={cur?.capConfidence ?? 0} color={cur && cur.capConfidence < 0.45 ? '#ff5151' : cur && cur.capConfidence < 0.75 ? '#ffd52a' : '#39ff88'} />
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] text-ink-2">Cap position</span>
        <span className="num text-[11px] text-ink-2">{cur ? pct(cur.alignment) : '—'}</span>
      </div>

      <div className="label mt-3 mb-1">Jev decision</div>
      <div className={`num text-[26px] leading-none ${d ? decisionColor[d.decision] : cur ? 'text-yellow/80 pulse' : 'text-ink-3'}`}>
        {d?.decision ?? (cur ? 'EVALUATING' : 'STANDBY')}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <div className="label">Decision confidence</div>
          <div className="num text-[15px]">{d ? pct(d.confidence) : '—'}</div>
        </div>
        <div>
          <div className="label">Latency</div>
          <div className="num text-[15px]">{d ? `${d.latencyMs.toFixed(0)} ms` : '—'}</div>
        </div>
        <div className="col-span-2">
          <div className="label">Reason</div>
          <div className="font-mono text-[11px] text-ink">{d?.reason ?? '—'}</div>
        </div>
        <div className="col-span-2">
          <div className="label">Action</div>
          <div className={`font-mono text-[11px] ${d?.decision === 'REJECT' ? 'text-red' : 'text-ink'}`}>{d?.action ?? '—'}</div>
        </div>
      </div>

      <div className="label mt-3 mb-1">Options offered</div>
      <div className="flex flex-wrap gap-1">
        {(['PASS', 'RECHECK', 'REJECT', 'HUMAN_REVIEW'] as const).map((o) => (
          <span
            key={o}
            className={`border px-1.5 py-[1px] font-mono text-[9px] tracking-[0.1em] ${
              d?.decision === o ? `${decisionColor[o]} border-current` : 'border-border text-ink-3'
            }`}
          >
            {o}
          </span>
        ))}
      </div>
    </Panel>
  )
}
