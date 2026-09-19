import { useEffect } from 'react'
import { Play, ScanLine } from 'lucide-react'
import { AnomalyPanel } from './components/AnomalyPanel'
import { ControlPanel } from './components/ControlPanel'
import { DecisionPanel } from './components/DecisionPanel'
import { EventLog } from './components/EventLog'
import { FactoryStatus } from './components/FactoryStatus'
import { HumanReviewQueue } from './components/HumanReviewQueue'
import { InspectionChart } from './components/InspectionChart'
import { KpiHeader } from './components/KpiHeader'
import { LineDecisionPanel } from './components/LineDecisionPanel'
import { ScenarioSelector } from './components/ScenarioSelector'
import { SystemStatus } from './components/SystemStatus'
import { VideoInspection } from './components/VideoInspection'
import { getController } from './services/inspectionController'
import { useInspectionStore } from './services/inspectionStore'

export default function App() {
  const controller = getController()
  const playing = useInspectionStore((s) => s.playing)
  const mode = useInspectionStore((s) => s.mode)
  const alert = useInspectionStore((s) => s.lineAlert)
  const demoStarted = useInspectionStore((s) => s.demoStartedAt)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        if (controller.store.getState().playing) controller.pause()
        else void controller.play()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controller])

  return (
    <div className="app flex h-full min-h-0 flex-col gap-2 p-2">
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <ScanLine size={16} className="text-cyan" />
          <div className="leading-tight">
            <div className="font-mono text-[12px] font-semibold tracking-[0.18em] text-ink">JEV VISUAL INSPECTION</div>
            <div className="label">Bottling Line A · Cap presence · Prototype v0.1</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-yellow/60 bg-yellow/10 px-2 py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.18em] text-yellow">DEMO MODE</span>
          <span
            className={`border px-2 py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.18em] ${
              mode === 'JEV_LIVE' ? 'border-green/60 bg-green/10 text-green' : 'border-cyan/60 bg-cyan/10 text-cyan'
            }`}
          >
            {mode === 'JEV_LIVE' ? 'JEV LIVE' : 'SIMULATION'}
          </span>
          {!playing && (
            <button className="btn btn-primary" onClick={() => controller.runDemo()}>
              <Play size={11} /> {demoStarted ? 'Resume demo' : 'Run demo'}
            </button>
          )}
        </div>
        {alert.active && (
          <div className="flex items-center gap-2 border border-red/60 bg-red/10 px-2 py-[3px] font-mono text-[10px] font-semibold tracking-[0.12em] text-red">
            <span className="dot pulse" /> ANOMALY ALERT · {alert.message} · {(alert.rejectRate * 100).toFixed(1)}%
          </div>
        )}
        <div className="ml-auto">
          <FactoryStatus />
        </div>
      </header>

      <KpiHeader />

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 grid-cols-[212px_minmax(0,1fr)_300px] grid-rows-[minmax(0,1fr)_248px] gap-2">
        <aside className="row-span-2 flex min-h-0 flex-col gap-2 overflow-y-auto">
          <SystemStatus />
          <ScenarioSelector />
          <ControlPanel />
        </aside>

        <main className="min-h-0">
          <VideoInspection />
        </main>

        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <DecisionPanel />
          <AnomalyPanel />
          <HumanReviewQueue />
          <LineDecisionPanel />
        </aside>

        <div className="col-span-2 grid min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
          <InspectionChart />
          <EventLog />
        </div>
      </div>
    </div>
  )
}
