import { AlertTriangle } from 'lucide-react'
import { DECISION_JA, reasonJa } from '@/i18n/ja'
import { useInspectionStore } from '@/services/inspectionStore'
import { Field, Panel, formatClock, pct } from './Panel'

export function AnomalyPanel() {
  const a = useInspectionStore((s) => s.anomaly)
  const profile = useInspectionStore((s) => s.profile)
  if (!a) {
    return (
      <Panel title="異常検知" bodyClassName="px-2.5 py-2">
        <div className="text-[10.5px] text-ink-3">異常は検知されていません</div>
      </Panel>
    )
  }
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5 text-red">
          <AlertTriangle size={11} /> 異常を検知
        </span>
      }
      className="border-red/50"
      bodyClassName="px-2.5 py-1.5"
    >
      <div key={a.timestamp} className="flash-red -mx-2.5 px-2.5">
        <Field label={profile.objectLabel} value={<span className="text-[13px]">{a.objectId}</span>} />
        <Field label="内容" value={<span className="text-red">{reasonJa(a.issue, profile)}</span>} mono={false} />
        <Field label="確信度" value={pct(a.confidence)} />
        <Field label="処置" value={<span className="text-red">{DECISION_JA.REJECT}・{profile.rejectAction}</span>} mono={false} />
        <Field label="時刻" value={formatClock(a.timestamp)} />
      </div>
    </Panel>
  )
}
