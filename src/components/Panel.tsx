import type { ReactNode } from 'react'

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      {title !== undefined && (
        <header className="panel-title">
          <span>{title}</span>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export function Field({ label, value, mono = true, className = '' }: { label: string; value: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-[3px] ${className}`}>
      <span className="label">{label}</span>
      <span className={`${mono ? 'num' : ''} text-[11px] text-ink`}>{value}</span>
    </div>
  )
}

export const decisionColor: Record<string, string> = {
  PASS: 'text-green',
  REJECT: 'text-red',
  RECHECK: 'text-yellow',
  HUMAN_REVIEW: 'text-violet',
  NORMAL: 'text-green',
  WATCH: 'text-yellow',
  SLOW_LINE: 'text-yellow',
  STOP_LINE: 'text-red',
}

export const decisionHex: Record<string, string> = {
  PASS: '#39ff88',
  REJECT: '#ff5151',
  RECHECK: '#ffd52a',
  HUMAN_REVIEW: '#b38cff',
}

export function formatClock(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`
