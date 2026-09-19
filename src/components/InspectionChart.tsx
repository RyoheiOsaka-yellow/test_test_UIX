import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useInspectionStore } from '@/services/inspectionStore'
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
    <div className="border border-border bg-panel-2 px-2 py-1 font-mono text-[10px]">
      <div className="text-ink-3">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-3">
          <span className="text-ink-2">{p.name}</span>
          <span className="num" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.value <= 1 && p.name === 'cap' ? `${Math.round(p.value * 100)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** PASS / REJECT per second over the last 60 s. */
export function PassRejectChart() {
  const series = useInspectionStore((s) => s.series)
  const now = useNowSecond()
  const data = useMemo(() => {
    const map = new Map(series.map((p) => [p.t, p]))
    const out: Array<{ t: number; label: string; PASS: number; REJECT: number }> = []
    for (let i = 59; i >= 0; i--) {
      const t = now - i * 1000
      const p = map.get(t)
      out.push({ t, label: `-${i}s`, PASS: p?.pass ?? 0, REJECT: p?.reject ?? 0 })
    }
    return out
  }, [series, now])
  const totals = data.reduce((a, p) => ({ pass: a.pass + p.PASS, reject: a.reject + p.REJECT }), { pass: 0, reject: 0 })

  return (
    <Panel
      title="Pass / Reject"
      right={
        <span className="flex items-center gap-2 font-mono text-[9px]">
          <span className="text-ink-3">60 s</span>
          <span className="flex items-center gap-1 text-green">
            <span className="dot" /> PASS <span className="num text-ink-2">{totals.pass}</span>
          </span>
          <span className="flex items-center gap-1 text-red">
            <span className="dot" /> REJECT <span className="num text-ink-2">{totals.reject}</span>
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
          <Area type="stepAfter" dataKey="PASS" stroke="#39ff88" fill="#39ff88" fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} dot={false} />
          <Area type="stepAfter" dataKey="REJECT" stroke="#ff5151" fill="#ff5151" fillOpacity={0.18} strokeWidth={1.5} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  )
}

/** Cap confidence at the gate, per inspected object. */
export function CapConfidenceChart() {
  const capSeries = useInspectionStore((s) => s.capSeries)
  const data = useMemo(() => capSeries.slice(-60).map((p) => ({ id: p.objectId, cap: p.cap, decision: p.decision })), [capSeries])
  return (
    <Panel
      title="Cap confidence"
      right={
        <span className="flex items-center gap-2 font-mono text-[9px] text-ink-3">
          <span className="text-green">0.75</span>
          <span className="text-yellow">0.45</span>
          <span className="text-red">0.20</span>
          <span>thresholds</span>
        </span>
      }
      bodyClassName="px-1 py-1"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#1a242e" vertical={false} />
          <XAxis dataKey="id" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#25313d' }} interval="preserveStartEnd" minTickGap={30} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={axisStyle} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: '#25313d' }} />
          <ReferenceLine y={0.75} stroke="#39ff88" strokeOpacity={0.5} strokeDasharray="3 3" />
          <ReferenceLine y={0.45} stroke="#ffd52a" strokeOpacity={0.5} strokeDasharray="3 3" />
          <ReferenceLine y={0.2} stroke="#ff5151" strokeOpacity={0.5} strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="cap"
            stroke="#31c6ff"
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: { decision: string }; index?: number }) => {
              const c = props.payload?.decision === 'REJECT' ? '#ff5151' : props.payload?.decision === 'PASS' ? '#39ff88' : '#b38cff'
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={2.5} fill={c} stroke="#111820" strokeWidth={1} />
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  )
}

export function InspectionChart() {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2">
      <PassRejectChart />
      <CapConfidenceChart />
    </div>
  )
}
