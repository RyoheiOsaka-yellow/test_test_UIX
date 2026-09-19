import { LINE_DECISION_JA, reasonJa } from '@/i18n/ja'
import { useInspectionStore } from '@/services/inspectionStore'
import { Panel, decisionColor, pct } from './Panel'

/** 第2階層の Jev: ライン全体の判断（正常 / 注視 / 減速 / 停止） */
export function LineDecisionPanel() {
  const ld = useInspectionStore((s) => s.lineDecision)
  const alert = useInspectionStore((s) => s.lineAlert)
  const profile = useInspectionStore((s) => s.profile)
  return (
    <Panel title="ライン判断" right={<span className="text-[9px] text-ink-3">直近60秒</span>} bodyClassName="px-2.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className={`text-[18px] font-semibold ${ld ? decisionColor[ld.decision] ?? 'text-violet' : 'text-ink-3'}`}>
          {ld ? LINE_DECISION_JA[ld.decision] : '正常'}
        </span>
        <span className="num text-[12px] text-ink-2">{ld ? pct(ld.confidence) : '—'}</span>
      </div>
      <div className="mt-1 text-[10px] text-ink-3">{ld ? reasonJa(ld.reason, profile) : '統計の蓄積待ち'}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(['NORMAL', 'WATCH', 'SLOW_LINE', 'STOP_LINE'] as const).map((o) => (
          <span
            key={o}
            className={`border px-1.5 py-[1px] text-[9.5px] tracking-[0.08em] ${
              ld?.decision === o ? `${decisionColor[o]} border-current` : 'border-border text-ink-3'
            }`}
          >
            {LINE_DECISION_JA[o]}
          </span>
        ))}
      </div>
      {alert.active && (
        <div className="mt-2 border border-red/50 bg-red/10 px-2 py-1 text-[10px] text-red">
          {alert.message} · {pct(alert.rejectRate, 1)}
        </div>
      )}
    </Panel>
  )
}
