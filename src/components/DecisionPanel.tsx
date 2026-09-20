import { actionJa, decisionJa, reasonJa } from '@/i18n/ja'
import { useInspectionStore, type InspectionStoreState } from '@/services/inspectionStore'
import { GRADE_COLORS, GRADE_LABELS_JA, GRADE_ORDER, GRADE_THRESHOLDS } from '@/services/grading'
import type { DecisionResult, InspectionProfile } from '@/types/inspection'
import { Panel, decisionColor, decisionHex, pct } from './Panel'

/** 5 段階グレードの帯（A 緑 → E 赤）と異常度の位置 */
export function GradeScale({ severity, grade, compact = false }: { severity?: number; grade?: DecisionResult['grade']; compact?: boolean }) {
  const edges = [0, GRADE_THRESHOLDS.B, GRADE_THRESHOLDS.C, GRADE_THRESHOLDS.D, GRADE_THRESHOLDS.E, 1]
  return (
    <div>
      <div className="relative flex h-[7px] w-full gap-[1px]">
        {GRADE_ORDER.map((g, i) => (
          <div
            key={g}
            className="h-full"
            style={{ width: `${(edges[i + 1] - edges[i]) * 100}%`, background: GRADE_COLORS[g], opacity: grade ? (grade === g ? 1 : 0.28) : 0.5 }}
          />
        ))}
        {severity !== undefined && (
          <div className="absolute -top-[2px] h-[11px] w-[2px] bg-ink" style={{ left: `calc(${Math.min(100, Math.max(0, severity * 100))}% - 1px)` }} />
        )}
      </div>
      {!compact && (
        <div className="mt-[2px] flex text-[8.5px] text-ink-3">
          {GRADE_ORDER.map((g, i) => (
            <span key={g} style={{ width: `${(edges[i + 1] - edges[i]) * 100}%`, color: grade === g ? GRADE_COLORS[g] : undefined }} className="truncate">
              {g} {GRADE_LABELS_JA[g]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** グレード章（大きな 1 文字 + 日本語） */
export function GradeBadge({ grade, size = 'md' }: { grade?: DecisionResult['grade']; size?: 'sm' | 'md' }) {
  const c = grade ? GRADE_COLORS[grade] : '#25313d'
  return (
    <span
      className={`inline-flex items-center gap-1 border font-semibold leading-none ${size === 'md' ? 'px-2 py-1 text-[13px]' : 'px-1 py-[1px] text-[9.5px]'}`}
      style={{ borderColor: c, color: c, background: `${c}1a` }}
    >
      <span className={size === 'md' ? 'text-[18px]' : 'text-[11px]'}>{grade ?? '—'}</span>
      {grade && <span>{GRADE_LABELS_JA[grade]}</span>}
    </span>
  )
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-[3px] w-full bg-border-2">
      <div className="h-full transition-[width] duration-150" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

function MeasurementBlock({ cur, spec }: { cur: ReturnType<typeof useInspectionStore<InspectionStoreState['currentObject']>>; spec: NonNullable<InspectionProfile['measurement']> }) {
  const mae = useInspectionStore((s) => s.measurementMeanAbsError)
  const m = cur?.measurement
  const dev = m ? (m.value - spec.target) / spec.tolerance : 0
  const tone = !m ? 'text-ink-3' : Math.abs(dev) <= 1 ? 'text-green' : Math.abs(dev) <= 2 ? 'text-yellow' : 'text-red'
  const lo = spec.target - spec.tolerance
  const hi = spec.target + spec.tolerance
  return (
    <div className="border border-border-2 bg-bg/40 px-2 py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">{spec.label}（実測）</span>
        <span className={`num text-[20px] leading-none ${tone}`}>{m ? `${(m.value * 100).toFixed(1)}%` : '—'}</span>
      </div>
      <div className="relative mt-1.5 h-[6px] w-full bg-border-2">
        <div className="absolute inset-y-0 bg-green/25" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
        <div className="absolute inset-y-0 w-px bg-green" style={{ left: `${spec.target * 100}%` }} />
        {m && <div className="absolute -top-[2px] h-[10px] w-[2px] bg-cyan" style={{ left: `calc(${m.value * 100}% - 1px)` }} />}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-x-2 text-[9.5px] text-ink-3">
        <span>目標 <span className="num text-ink-2">{(spec.target * 100).toFixed(0)}% ±{(spec.tolerance * 100).toFixed(0)}</span></span>
        <span>傾き <span className="num text-ink-2">{m ? `${m.tiltDeg.toFixed(1)}°` : '—'}</span></span>
        <span>計測信頼度 <span className="num text-ink-2">{m ? pct(m.confidence) : '—'}</span></span>
        {m && typeof m.truth === 'number' && (
          <span className="col-span-3">
            真値 <span className="num text-ink-2">{(m.truth * 100).toFixed(1)}%</span> · 誤差 <span className="num text-ink-2">{((m.value - m.truth) * 100).toFixed(1)}pt</span>
            {mae !== null && (
              <>
                {' '}· 平均絶対誤差 <span className="num text-ink-2">{(mae * 100).toFixed(2)}pt</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

const LEVEL_TONE = { normal: 'text-green', watch: 'text-yellow', alert: 'text-red' } as const
const LEVEL_HEX = { normal: '#39ff88', watch: '#ffd52a', alert: '#ff5151' } as const

/** 状態解析プロファイル: 状態機械の出力と特徴量をライブ表示 */
function StateBlock({ scoreLabel }: { scoreLabel: string }) {
  const live = useInspectionStore((s) => s.livePerson)
  const r = live?.reading
  return (
    <div className="border border-border-2 bg-bg/40 px-2 py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">状態（時系列判定）{live ? ` · ${live.objectId}` : ''}</span>
        <span className={`text-[15px] font-semibold leading-none ${r ? LEVEL_TONE[r.level] : 'text-ink-3'}`}>
          {r ? r.stateLabel : '—'}
          {r && r.level !== 'normal' && <span className="num ml-1 text-[11px]">{r.holdSeconds.toFixed(1)}秒</span>}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">{scoreLabel}</span>
        <span className="num text-[13px]">{r ? r.score.toFixed(2) : '—'}</span>
      </div>
      <div className="h-[3px] w-full bg-border-2">
        <div className="h-full" style={{ width: `${Math.round((r?.score ?? 0) * 100)}%`, background: r ? LEVEL_HEX[r.level] : '#25313d' }} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-[2px] text-[9.5px] text-ink-3">
        {(r?.features ?? []).map((f) => (
          <span key={f.key} className="flex justify-between gap-2">
            <span className="truncate">{f.label}</span>
            <span className="num shrink-0 text-ink-2">
              {f.value.toFixed(f.digits ?? 2)}
              {f.unit ?? ''}
            </span>
          </span>
        ))}
        {r?.note && <span className="col-span-2 text-ink-2">{r.note}</span>}
      </div>
    </div>
  )
}

export function DecisionPanel() {
  const cur = useInspectionStore((s) => s.currentObject)
  const mode = useInspectionStore((s) => s.mode)
  const profile = useInspectionStore((s) => s.profile)
  const d = cur?.decision
  return (
    <Panel
      title="JEV 判断エンジン"
      right={<span className={`text-[9px] ${mode === 'JEV_LIVE' ? 'text-green' : 'text-cyan'}`}>{mode === 'JEV_LIVE' ? '接続' : '模擬'}</span>}
      bodyClassName="px-2.5 py-2"
    >
      <div className="label mb-1">現在の対象</div>
      <div className="flex items-baseline justify-between">
        <span className="label">追跡番号</span>
        <span className="num text-[18px] text-ink">{cur?.objectId ?? '—'}</span>
      </div>

      <div className="label mt-2 mb-1">認識結果</div>
      {profile.measurement && (
        <MeasurementBlock cur={cur} spec={profile.measurement} />
      )}
      {profile.trigger.kind === 'state' && <StateBlock scoreLabel={profile.analyzer === 'crosswalk' ? '危険スコア' : '転倒スコア'} />}
      <div className={`grid grid-cols-2 gap-x-3 gap-y-1 ${profile.measurement ? 'mt-2' : ''}`}>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-ink-2">{profile.objectLabel}</span>
            <span className="num text-[13px]">{cur ? pct(cur.objectConfidence) : '—'}</span>
          </div>
          <Bar value={cur?.objectConfidence ?? 0} color="#31c6ff" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-ink-2">{profile.attributeLabel}</span>
            <span className={`num text-[13px] ${cur && cur.attributeConfidence < 0.45 ? 'text-red' : cur && cur.attributeConfidence < 0.75 ? 'text-yellow' : ''}`}>
              {cur ? pct(cur.attributeConfidence) : '—'}
            </span>
          </div>
          <Bar
            value={cur?.attributeConfidence ?? 0}
            color={cur && cur.attributeConfidence < 0.45 ? '#ff5151' : cur && cur.attributeConfidence < 0.75 ? '#ffd52a' : '#39ff88'}
          />
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">{profile.alignmentLabel}</span>
        <span className="num text-[11px] text-ink-2">{cur ? pct(cur.alignment) : '—'}</span>
      </div>

      <div className="label mt-2 mb-1">JEV の判断</div>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-[26px] leading-none font-semibold ${d ? decisionColor[d.decision] : cur ? 'text-yellow/80 pulse' : 'text-ink-3'}`}>
          {d ? decisionJa(d.decision, profile) : cur ? '判断中' : '待機'}
        </div>
        <GradeBadge grade={d?.grade} />
      </div>
      <div className="mt-1.5">
        <div className="mb-[2px] flex items-baseline justify-between">
          <span className="label">グレード / 異常度</span>
          <span className="num text-[11px] text-ink-2">{d ? d.severity.toFixed(2) : '—'}</span>
        </div>
        <GradeScale severity={d?.severity} grade={d?.grade} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-[2px]">
        <div>
          <div className="label">判断の確信度</div>
          <div className="num text-[15px]">{d ? pct(d.confidence) : '—'}</div>
        </div>
        <div>
          <div className="label">遅延</div>
          <div className="num text-[15px]">{d ? `${d.latencyMs.toFixed(0)} ミリ秒` : '—'}</div>
        </div>
        <div className="col-span-2">
          <div className="label">理由</div>
          <div className="text-[11px] text-ink">{reasonJa(d?.reason, profile)}</div>
        </div>
        <div className="col-span-2">
          <div className="label">処置</div>
          <div className={`text-[11px] ${d?.decision === 'REJECT' ? 'text-red' : 'text-ink'}`}>{actionJa(d?.action, profile)}</div>
        </div>
      </div>

      <div className="label mt-2 mb-1">提示した選択肢と各スコア</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-[3px]">
        {(['PASS', 'RECHECK', 'REJECT', 'HUMAN_REVIEW'] as const).map((o) => {
          const score = d?.optionScores?.[o] ?? 0
          const chosen = d?.decision === o
          return (
            <div key={o} className={`border px-1.5 py-[2px] ${chosen ? 'border-current' : 'border-border'} ${chosen ? decisionColor[o] : 'text-ink-3'}`}>
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate text-[9.5px] tracking-[0.06em]">{decisionJa(o, profile)}</span>
                <span className={`num shrink-0 text-[10px] ${chosen ? '' : 'text-ink-3'}`}>{d ? pct(score) : '—'}</span>
              </div>
              <div className="mt-[2px] h-[3px] w-full bg-border-2">
                <div className="h-full transition-[width] duration-200" style={{ width: `${Math.round(score * 100)}%`, background: decisionHex[o], opacity: chosen ? 1 : 0.45 }} />
              </div>
            </div>
          )
        })}
      </div>

      {d?.evidence && d.evidence.length > 0 && (
        <>
          <div className="label mt-2 mb-1">判断の根拠（証拠）</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-[1px] text-[9.5px] text-ink-3">
            {d.evidence.slice(0, 6).map((e) => (
              <span key={e.key} className="flex justify-between gap-2">
                <span className="truncate">{e.label}</span>
                <span className="num shrink-0 text-ink-2">
                  {e.value.toFixed(e.digits ?? 2)}
                  {e.unit ?? ''}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
