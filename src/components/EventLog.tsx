import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play } from 'lucide-react'
import type { EventSeverity, InspectionEventType } from '@/types/inspection'
import { exportEventsCsv, exportEventsJson, exportInspectionsCsv } from '@/services/exportLog'
import { inspectionStore, useInspectionStore } from '@/services/inspectionStore'
import { Panel, formatClock } from './Panel'

const severityTone: Record<EventSeverity, string> = {
  info: 'text-ink-2',
  ok: 'text-green',
  warn: 'text-yellow',
  error: 'text-red',
}

const typeTone: Partial<Record<InspectionEventType, string>> = {
  REJECT: 'text-red',
  EJECT_TRIGGERED: 'text-red',
  ALERT: 'text-red',
  PASS: 'text-green',
  RECHECK: 'text-yellow',
  HUMAN_REVIEW: 'text-violet',
  HUMAN_OVERRIDE: 'text-violet',
  LINE_DECISION: 'text-cyan',
  SYSTEM: 'text-cyan',
}

export function EventLog() {
  const events = useInspectionStore((s) => s.events)
  const [follow, setFollow] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (follow && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [events, follow])

  const shown = events.slice(-160)

  return (
    <Panel
      title="イベントログ"
      right={
        <div className="relative flex items-center gap-1.5">
          <span className="num text-[9px] text-ink-3">{events.length} 件</span>
          <button className={`btn !px-1.5 !py-[2px] ${follow ? 'btn-active' : ''}`} onClick={() => setFollow((f) => !f)} title="自動スクロール">
            {follow ? <Pause size={10} /> : <Play size={10} />}
          </button>
          <button className="btn !px-1.5 !py-[2px]" onClick={() => setExportOpen((o) => !o)} title="ダウンロード">
            <Download size={10} /> 書き出し
          </button>
          {exportOpen && (
            <div className="absolute top-full right-0 z-20 mt-1 flex w-48 flex-col border border-border bg-panel-2 py-1 shadow-xl">
              {[
                ['イベントログ · JSON', () => exportEventsJson(inspectionStore.getState().events, inspectionStore.getState().records)],
                ['イベントログ · CSV', () => exportEventsCsv(inspectionStore.getState().events)],
                ['検査記録 · CSV', () => exportInspectionsCsv(inspectionStore.getState().records)],
              ].map(([label, fn]) => (
                <button
                  key={label as string}
                  className="px-3 py-1.5 text-left text-[10.5px] tracking-[0.04em] text-ink hover:bg-border-2"
                  onClick={() => {
                    ;(fn as () => void)()
                    setExportOpen(false)
                  }}
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
        </div>
      }
      bodyClassName="overflow-y-auto"
    >
      <div ref={bodyRef} className="h-full overflow-y-auto">
        {shown.map((e) => (
          <div key={e.seq} className="log-row">
            <span className="num text-ink-3">{formatClock(e.timestamp)}</span>
            <span className="num text-ink-2">{e.objectId ?? '—'}</span>
            <span className={typeTone[e.type] ?? severityTone[e.severity]}>{e.message.replace(/^#\d+\s/, '')}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
