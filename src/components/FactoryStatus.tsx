import { useInspectionStore } from '@/services/inspectionStore'

const tone: Record<string, string> = {
  ONLINE: 'text-green',
  ACTIVE: 'text-green',
  RUNNING: 'text-green',
  LIVE: 'text-green',
  SIMULATED: 'text-cyan',
  IDLE: 'text-ink-3',
  PAUSED: 'text-yellow',
  DEGRADED: 'text-yellow',
  FALLBACK: 'text-yellow',
  OFFLINE: 'text-red',
  STOPPED: 'text-red',
}

export function FactoryStatus() {
  const status = useInspectionStore((s) => s.status)
  const items: Array<[string, string]> = [
    ['CAMERA', status.camera],
    ['VISION', status.vision],
    ['JEV', status.jev],
    ['LINE', status.line],
  ]
  return (
    <div className="flex items-stretch divide-x divide-border-2 border border-border bg-panel">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col justify-center gap-0.5 px-3 py-1">
          <span className="label">{k}</span>
          <span className={`flex items-center gap-1.5 font-mono text-[10.5px] font-semibold ${tone[v] ?? 'text-ink'}`}>
            <span className={`dot ${v === 'RUNNING' || v === 'ACTIVE' ? 'pulse' : ''}`} />
            {v}
          </span>
        </div>
      ))}
    </div>
  )
}
