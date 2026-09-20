import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useInspectionStore } from '@/services/inspectionStore'
import { GRADE_COLORS } from '@/services/grading'
import { Panel } from './Panel'

const axisStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#5b6878' }

function useNowSecond() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000) * 1000)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000) * 1000), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-panel-2 px-2 py-1 text-[10px]">
      <div className="text-ink-3">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-3">
          <span className="text-ink-2">{p.name}</span>
          <span className="num" style={{ color: p.color }}>
            {p.name === '信頼度' ? `${Math.round(p.value * 100)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 直近60秒の合格 / 不良（1秒刻み） */
export function PassRejectChart() {
  const series = useInspectionStore((s) => s.series)
  const now = useNowSecond()
  const data = useMemo(() => {
    const map = new Map(series.map((p) => [p.t, p]))
    const out: Array<{ t: number; label: string; 合格: number; 不良: number }> = []
    for (let i = 59; i >= 0; i--) {
      const t = now - i * 1000
      const p = map.get(t)
      out.push({ t, label: `-${i}秒`, 合格: p?.pass ?? 0, 不良: p?.reject ?? 0 })
    }
    return out
  }, [series, now])
  const totals = data.reduce((a, p) => ({ pass: a.pass + p.合格, reject: a.reject + p.不良 }), { pass: 0, reject: 0 })

  return (
    <Panel
      title="合格 / 不良 推移"
      right={
        <span className="flex items-center gap-2 text-[9px]">
          <span className="text-ink-3">直近60秒</span>
          <span className="flex items-center gap-1 text-green">
            <span className="dot" /> 合格 <span className="num text-ink-2">{totals.pass}</span>
          </span>
          <span className="flex items-center gap-1 text-red">
            <span className="dot" /> 不良 <span className="num text-ink-2">{totals.reject}</span>
          </span>
        </span>
      }
      bodyClassName="px-1 py-1"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#1a242e" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#25313d' }} interval={14} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: '#25313d' }} />
          <Area type="stepAfter" dataKey="合格" stroke="#39ff88" fill="#39ff88" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} dot={false} />
          <Area type="stepAfter" dataKey="不良" stroke="#ff5151" fill="#ff5151" fillOpacity={0.18} strokeWidth={1.5} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  )
}

/** ゲート通過時のキャップ信頼度（検査対象ごと） */
/** 人物プロファイル: 転倒スコアの時系列（直近 60 秒） */
function FallScoreChart() {
  const series = useInspectionStore((s) => s.liveSeries)
  const isCrosswalk = useInspectionStore((s) => s.profile.analyzer === 'crosswalk')
  const now = useNowSecond()
  const data = useMemo(() => series.map((p) => ({ label: `-${Math.max(0, Math.round((now - p.t) / 1000))}秒`, t: p.t, スコア: p.value })), [series, now])
  return (
    <Panel title={isCrosswalk ? '危険スコア（時系列）' : '転倒スコア（時系列）'} right={<span className="text-[9px] text-ink-3">直近60秒 · 0.6 以上で警報</span>} bodyClassName="px-1 py-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#1a242e" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#25313d' }} interval="preserveStartEnd" minTickGap={40} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: '#25313d' }} />
          <ReferenceLine y={0.6} stroke="#ff5151" strokeOpacity={0.5} strokeDasharray="3 3" />
          <Area type="monotone" dataKey="スコア" stroke="#ff5151" fill="#ff5151" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function CapConfidenceChart() {
  const capSeries = useInspectionStore((s) => s.capSeries)
  const profile = useInspectionStore((s) => s.profile)
  const data = useMemo(() => capSeries.slice(-60).map((p) => ({ id: p.objectId, 信頼度: p.attribute, decision: p.decision, grade: p.grade })), [capSeries])
  const m = profile.measurement
  const ripeness = m?.method === 'ripeness'
  const isSize = m?.method === 'size'
  const yMax = isSize ? 2 : 1
  return (
    <Panel
      title={m ? `${m.label}（実測）` : `${profile.attributeLabel}信頼度`}
      right={
        ripeness && m ? (
          <span className="flex items-center gap-2 text-[9px] text-ink-3">
            <span className="text-green">収穫可 ≥ {((m.target - m.tolerance) * 100).toFixed(0)}%</span>
            <span>点の色 = グレード</span>
          </span>
        ) : isSize && m ? (
          <span className="flex items-center gap-2 text-[9px] text-ink-3">
            <span className="text-green">基準比 {m.target.toFixed(2)}× ±{m.tolerance.toFixed(2)}</span>
            <span>点の色 = グレード</span>
          </span>
        ) : m ? (
          <span className="flex items-center gap-2 text-[9px] text-ink-3">
            <span className="text-green">目標 {(m.target * 100).toFixed(0)}% ±{(m.tolerance * 100).toFixed(0)}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[9px] text-ink-3">
            <span className="text-green">0.75</span>
            <span className="text-yellow">0.45</span>
            <span className="text-red">0.20</span>
            <span>しきい値 · 点の色 = グレード</span>
          </span>
        )
      }
      bodyClassName="px-1 py-1"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#1a242e" vertical={false} />
          <XAxis dataKey="id" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#25313d' }} interval="preserveStartEnd" minTickGap={30} />
          <YAxis domain={[0, yMax]} ticks={isSize ? [0, 0.5, 1, 1.5, 2] : [0, 0.25, 0.5, 0.75, 1]} tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: '#25313d' }} />
          {ripeness && m ? (
            <>
              <ReferenceLine y={m.target - m.tolerance} stroke="#39ff88" strokeOpacity={0.6} strokeDasharray="3 3" />
              <ReferenceLine y={m.target - 2.4 * m.tolerance} stroke="#ff5151" strokeOpacity={0.4} strokeDasharray="3 3" />
            </>
          ) : m ? (
            <>
              <ReferenceLine y={m.target} stroke="#39ff88" strokeOpacity={0.6} />
              <ReferenceLine y={m.target + m.tolerance} stroke="#39ff88" strokeOpacity={0.4} strokeDasharray="3 3" />
              <ReferenceLine y={m.target - m.tolerance} stroke="#39ff88" strokeOpacity={0.4} strokeDasharray="3 3" />
              <ReferenceLine y={m.target + 2 * m.tolerance} stroke="#ff5151" strokeOpacity={0.4} strokeDasharray="3 3" />
              <ReferenceLine y={m.target - 2 * m.tolerance} stroke="#ff5151" strokeOpacity={0.4} strokeDasharray="3 3" />
            </>
          ) : (
            <>
              <ReferenceLine y={0.75} stroke="#39ff88" strokeOpacity={0.5} strokeDasharray="3 3" />
              <ReferenceLine y={0.45} stroke="#ffd52a" strokeOpacity={0.5} strokeDasharray="3 3" />
              <ReferenceLine y={0.2} stroke="#ff5151" strokeOpacity={0.5} strokeDasharray="3 3" />
            </>
          )}
          <Line
            type="monotone"
            dataKey="信頼度"
            stroke="#31c6ff"
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: { decision: string; grade?: keyof typeof GRADE_COLORS }; index?: number }) => {
              const g = props.payload?.grade
              const c = g ? GRADE_COLORS[g] : props.payload?.decision === 'REJECT' ? '#ff5151' : props.payload?.decision === 'PASS' ? '#39ff88' : '#b38cff'
              const review = props.payload?.decision === 'HUMAN_REVIEW'
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={review ? 3.2 : 2.5} fill={c} stroke={review ? '#b38cff' : '#111820'} strokeWidth={review ? 1.5 : 1} />
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function InspectionChart() {
  const isState = useInspectionStore((s) => s.profile.trigger.kind === 'state')
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2">
      <PassRejectChart />
      {isState ? <FallScoreChart /> : <CapConfidenceChart />}
    </div>
  )
}
