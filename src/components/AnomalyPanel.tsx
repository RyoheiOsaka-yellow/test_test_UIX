import { AlertTriangle } from 'lucide-react'
import { useInspectionStore } from '@/services/inspectionStore'
import { Field, Panel, formatClock, pct } from './Panel'

export function AnomalyPanel() {
  const a = useInspectionStore((s) => s.anomaly)
  if (!a) {
    return (
      <Panel title="Anomaly" bodyClassName="px-2.5 py-2">
        <div className="font-mono text-[10.5px] text-ink-3">No anomaly detected</div>
      </Panel>
    )
  }
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5 text-red">
          <AlertTriangle size={11} /> Anomaly detected
        </span>
      }
      className="border-red/50"
      bodyClassName="px-2.5 py-1.5"
    >
      <div key={a.timestamp} className="flash-red -mx-2.5 px-2.5">
        <Field label="Bottle" value={<span className="text-[13px]">{a.objectId}</span>} />
        <Field label="Issue" value={<span className="text-red">{a.issue}</span>} />
        <Field label="Confidence" value={pct(a.confidence)} />
        <Field label="Action" value={<span className="text-red">{a.action}</span>} />
        <Field label="Timestamp" value={formatClock(a.timestamp)} />
      </div>
    </Panel>
  )
}
