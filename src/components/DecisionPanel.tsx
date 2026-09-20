import { actionJa, decisionJa, reasonJa } from '@/i18n/ja'
import { useInspectionStore, type InspectionStoreState } from '@/services/inspectionStore'
import type { InspectionProfile } from '@/types/inspection'
import { Panel, decisionColor, pct } from './Panel'

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

const STATE_JA = { NORMAL: '正常', FALLING: '転倒中', FALLEN: '転倒（床上）' } as const
const STATE_TONE = { NORMAL: 'text-green', FALLING: 'text-yellow', FALLEN: 'text-red' } as const

/** 人物プロファイル: 5 特徴量と状態機械の出力をライブ表示 */
function PersonBlock() {
  const live = useInspectionStore((s) => s.livePerson)
  const r = live?.reading
  const f = r?.features
  const fmt = (v: number | undefined, d = 2) => (v === undefined ? '—' : v.toFixed(d))
  return (
    <div className="border border-border-2 bg-bg/40 px-2 py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">状態（時系列判定）{live ? ` · ${live.objectId}` : ''}</span>
        <span className={`text-[16px] font-semibold leading-none ${r ? STATE_TONE[r.state] : 'text-ink-3'}`}>
          {r ? STATE_JA[r.state] : '—'}
          {r?.state === 'FALLEN' && <span className="num ml-1 text-[11px]">{r.onGroundSeconds.toFixed(1)}秒</span>}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">転倒スコア</span>
        <span className="num text-[13px]">{fmt(r?.fallScore)}</span>
      </div>
      <div className="h-[3px] w-full bg-border-2">
        <div className="h-full" style={{ width: `${Math.round((r?.fallScore ?? 0) * 100)}%`, background: r ? (r.state === 'FALLEN' ? '#ff5151' : r.state === 'FALLING' ? '#ffd52a' : '#39ff88') : '#25313d' }} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-[2px] text-[9.5px] text-ink-3">
        <span className="flex justify-between">体の位置（腰の低下）<span className="num text-ink-2">{fmt(f?.bodyPosition)}</span></span>
        <span className="flex justify-between">角度（胴の傾き）<span className="num text-ink-2">{f ? `${f.torsoAngleDeg.toFixed(0)}°` : '—'}</span></span>
        <span className="flex justify-between">形状（縦横比）<span className="num text-ink-2">{fmt(f?.aspectRatio)}</span></span>
        <span className="flex justify-between">動き（腰の速度）<span className="num text-ink-2">{fmt(f?.motion)}</span></span>
        <span className="col-span-2 flex justify-between">姿勢信頼度<span className="num text-ink-2">{fmt(f?.poseConfidence)}</span></span>
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

      <div className="label mt-3 mb-1">認識結果</div>
      {profile.measurement && (
        <MeasurementBlock cur={cur} spec={profile.measurement} />
      )}
      {profile.trigger.kind === 'state' && <PersonBlock />}
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

      <div className="label mt-3 mb-1">JEV の判断</div>
      <div className={`text-[26px] leading-none font-semibold ${d ? decisionColor[d.decision] : cur ? 'text-yellow/80 pulse' : 'text-ink-3'}`}>
        {d ? decisionJa(d.decision, profile) : cur ? '判断中' : '待機'}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
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

      <div className="label mt-3 mb-1">提示した選択肢</div>
      <div className="flex flex-wrap gap-1">
        {(['PASS', 'RECHECK', 'REJECT', 'HUMAN_REVIEW'] as const).map((o) => (
          <span
            key={o}
            className={`border px-1.5 py-[1px] text-[9.5px] tracking-[0.08em] ${
              d?.decision === o ? `${decisionColor[o]} border-current` : 'border-border text-ink-3'
            }`}
          >
            {decisionJa(o, profile)}
          </span>
        ))}
      </div>
    </Panel>
  )
}
