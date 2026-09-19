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

const label: Record<string, string> = {
  ONLINE: '正常',
  OFFLINE: '切断',
  DEGRADED: '劣化',
  ACTIVE: '稼働',
  IDLE: '待機',
  SIMULATED: '模擬',
  LIVE: '接続',
  FALLBACK: '退避',
  RUNNING: '稼働',
  PAUSED: '停止中',
  STOPPED: '停止',
}

export function FactoryStatus() {
  const status = useInspectionStore((s) => s.status)
  const items: Array<[string, string]> = [
    ['カメラ', status.camera],
    ['認識', status.vision],
    ['JEV', status.jev],
    ['ライン', status.line],
  ]
  return (
    <div className="flex items-stretch divide-x divide-border-2 border border-border bg-panel">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col justify-center gap-0.5 px-3 py-1">
          <span className="label">{k}</span>
          <span className={`flex items-center gap-1.5 text-[10.5px] font-semibold ${tone[v] ?? 'text-ink'}`}>
            <span className={`dot ${v === 'RUNNING' || v === 'ACTIVE' ? 'pulse' : ''}`} />
            {label[v] ?? v}
          </span>
        </div>
      ))}
    </div>
  )
}
