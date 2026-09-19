import { useInspectionStore } from '@/services/inspectionStore'

/** 映像左上のオーバーレイパネル: キャップ検査 */
export function InspectorPanel() {
  const kpi = useInspectionStore((s) => s.kpi)
  const playing = useInspectionStore((s) => s.playing)
  const rows: Array<[string, string, string?]> = [
    ['処理数', String(kpi.totalInspected)],
    ['キャップ有', String(kpi.pass), 'text-green'],
    ['キャップ無', String(kpi.reject), 'text-red'],
  ]
  return (
    <div className="pointer-events-none absolute top-3 left-3 w-[188px] border border-border/80 bg-bg/80 backdrop-blur-[2px]">
      <div className="border-b border-border/60 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-ink-2">
        ボトルキャップ検査
      </div>
      <div className="px-2.5 py-1.5">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex items-baseline justify-between py-[1.5px]">
            <span className="text-[10px] text-ink-3">{k}</span>
            <span className={`num text-[12px] ${c ?? 'text-ink'}`}>{v}</span>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between border-t border-border/60 pt-1.5">
          <span className="text-[10px] text-ink-3">良品率</span>
          <span className="num text-[13px] text-cyan">{kpi.totalInspected ? `${(kpi.yieldRate * 100).toFixed(1)}%` : '—'}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] text-ink-3">状態</span>
          <span className={`flex items-center gap-1.5 text-[10px] ${playing ? 'text-green' : 'text-yellow'}`}>
            <span className={`dot ${playing ? 'pulse' : ''}`} />
            {playing ? '稼働中' : '待機'}
          </span>
        </div>
      </div>
    </div>
  )
}
