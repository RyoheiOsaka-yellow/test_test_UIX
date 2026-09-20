import { RotateCcw } from 'lucide-react'
import { getController } from '@/services/inspectionController'
import { useInspectionStore } from '@/services/inspectionStore'
import { GRADE_COLORS, GRADE_THRESHOLDS, gradeLabel, type GradeThresholds } from '@/services/grading'
import { Panel } from './Panel'

const ROWS: Array<{ key: keyof GradeThresholds; from: 'A' | 'B' | 'C' | 'D'; to: 'B' | 'C' | 'D' | 'E' }> = [
  { key: 'B', from: 'A', to: 'B' },
  { key: 'C', from: 'B', to: 'C' },
  { key: 'D', from: 'C', to: 'D' },
  { key: 'E', from: 'D', to: 'E' },
]

/** グレード境界（異常度）をプロファイルごとに調整する。変更は必ずイベントログに残る */
export function ThresholdPanel() {
  const t = useInspectionStore((s) => s.gradeThresholds)
  const profile = useInspectionStore((s) => s.profile)
  const controller = getController()
  const changed = ROWS.some((r) => Math.abs(t[r.key] - GRADE_THRESHOLDS[r.key]) > 1e-6)
  return (
    <Panel
      title="グレード境界"
      right={
        <button className={`flex items-center gap-1 text-[9px] ${changed ? 'text-yellow hover:text-ink' : 'text-ink-3'}`} onClick={() => controller.resetGradeThresholds()} disabled={!changed} title="既定値に戻す">
          <RotateCcw size={9} /> 既定
        </button>
      }
      bodyClassName="px-2.5 py-2"
    >
      <div className="flex flex-col gap-[3px]" title={`異常度の境界。C 境界より下が合格、E 境界以上が不良。変更はイベントログに記録され、${profile.name} にだけ効きます`}>
        {ROWS.map((r) => (
          <label key={r.key} className="flex items-center gap-2">
            <span className="flex w-[64px] shrink-0 items-center gap-1 text-[9.5px]">
              <span style={{ color: GRADE_COLORS[r.from] }}>{r.from}</span>
              <span className="text-ink-3">|</span>
              <span style={{ color: GRADE_COLORS[r.to] }}>{r.to}</span>
              <span className="truncate text-ink-3">{gradeLabel(r.to, profile)}</span>
            </span>
            <input
              type="range"
              min={0.03}
              max={0.98}
              step={0.01}
              value={t[r.key]}
              onChange={(e) => controller.setGradeThreshold(r.key, Number(e.target.value))}
              className="h-[3px] flex-1 accent-cyan"
              style={{ accentColor: GRADE_COLORS[r.to] }}
            />
            <span className={`num w-[30px] shrink-0 text-right text-[10px] ${Math.abs(t[r.key] - GRADE_THRESHOLDS[r.key]) > 1e-6 ? 'text-yellow' : 'text-ink-2'}`}>{t[r.key].toFixed(2)}</span>
          </label>
        ))}
      </div>
    </Panel>
  )
}
