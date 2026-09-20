import { useInspectionStore } from '@/services/inspectionStore'
import { GRADE_COLORS, GRADE_ORDER } from '@/services/grading'

/** 映像左上のオーバーレイパネル: キャップ検査 */
export function InspectorPanel() {
  const kpi = useInspectionStore((s) => s.kpi)
  const playing = useInspectionStore((s) => s.playing)
  const profile = useInspectionStore((s) => s.profile)
  const entered = useInspectionStore((s) => s.objectsEntered)
  const km = useInspectionStore((s) => s.scanDistanceKm)
  const rows: Array<[string, string, string?]> = [
    [profile.kpiLabels?.total ?? '処理数', String(kpi.totalInspected)],
    [profile.okLabel, String(kpi.pass), 'text-green'],
    [profile.ngLabel, String(kpi.reject), 'text-red'],
  ]
  return (
    <div className="w-[188px] border border-border/80 bg-bg/80 backdrop-blur-[2px]">
      <div className="border-b border-border/60 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-ink-2">
        {profile.name}
      </div>
      <div className="px-2.5 py-1.5">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex items-baseline justify-between py-[1.5px]">
            <span className="text-[10px] text-ink-3">{k}</span>
            <span className={`num text-[12px] ${c ?? 'text-ink'}`}>{v}</span>
          </div>
        ))}
        {profile.countUnique && (
          <div className="flex items-baseline justify-between py-[1.5px]">
            <span className="text-[10px] text-ink-3">固有ID数（重複計上なし）</span>
            <span className="num text-[12px] text-cyan">{entered}</span>
          </div>
        )}
        {profile.gradeGroups?.map((g) => (
          <div key={g.label} className="flex items-baseline justify-between py-[1.5px]">
            <span className="text-[10px] text-ink-3">{g.label}</span>
            <span className={`num text-[12px] ${g.tone ?? 'text-ink'}`}>{g.grades.reduce((a, k) => a + (kpi.grades[k] ?? 0), 0)}</span>
          </div>
        ))}
        {profile.odometer && (
          <>
            <div className="flex items-baseline justify-between py-[1.5px]">
              <span className="text-[10px] text-ink-3">検出（追跡ID）</span>
              <span className="num text-[12px] text-cyan">{entered}</span>
            </div>
            <div className="flex items-baseline justify-between py-[1.5px]">
              <span className="text-[10px] text-ink-3">走査距離（{profile.odometer.kmh}km/h 仮定）</span>
              <span className="num text-[12px] text-ink">{km.toFixed(2)} km</span>
            </div>
            <div className="flex items-baseline justify-between py-[1.5px]">
              <span className="text-[10px] text-ink-3">損傷密度</span>
              <span className="num text-[12px] text-ink">{km > 0.005 ? (entered / km).toFixed(0) : '—'} 件/km</span>
            </div>
          </>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1.5">
          <span className="text-[10px] text-ink-3">グレード</span>
          <span className="flex gap-[6px]">
            {GRADE_ORDER.map((g) => (
              <span key={g} className="num text-[10px] leading-none" style={{ color: GRADE_COLORS[g] }}>
                {g}<span className="text-ink-2">{kpi.grades[g] ?? 0}</span>
              </span>
            ))}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[10px] text-ink-3">{profile.kpiLabels?.yield ?? '良品率'}</span>
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
