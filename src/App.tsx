import { useEffect } from 'react'
import { Play, ScanLine } from 'lucide-react'
import { PROFILES, PROFILE_ORDER } from './profiles'
import { AnomalyPanel } from './components/AnomalyPanel'
import { ControlPanel } from './components/ControlPanel'
import { DecisionPanel } from './components/DecisionPanel'
import { EventLog } from './components/EventLog'
import { FactoryStatus } from './components/FactoryStatus'
import { HumanReviewQueue } from './components/HumanReviewQueue'
import { InspectionChart } from './components/InspectionChart'
import { KpiHeader } from './components/KpiHeader'
import { LineDecisionPanel } from './components/LineDecisionPanel'
import { ThresholdPanel } from './components/ThresholdPanel'
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
  const profile = useInspectionStore((s) => s.profile)

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
      <header className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <ScanLine size={16} className="text-cyan" />
          <div className="leading-tight">
            <div className="text-[12px] font-semibold tracking-[0.12em] text-ink">JEV 外観検査</div>
            <div className="label">
              {profile.lineName} · {profile.name} · 試作版 v0.1
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-stretch border border-border bg-panel" title="検査プロファイル">
          {PROFILE_ORDER.map((id) => {
            const p = PROFILES[id]
            const active = p.id === profile.id
            return (
              <button
                key={id}
                onClick={() => controller.selectProfile(id)}
                className={`whitespace-nowrap px-2 py-[3px] text-[10.5px] tracking-[0.02em] transition-colors ${
                  active ? 'bg-cyan/12 text-cyan' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
                } border-r border-border-2 last:border-r-0`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-yellow/60 bg-yellow/10 px-2 py-[3px] text-[9.5px] font-semibold tracking-[0.12em] text-yellow">デモモード</span>
          <span
            className={`border px-2 py-[3px] text-[9.5px] font-semibold tracking-[0.12em] ${
              mode === 'JEV_LIVE' ? 'border-green/60 bg-green/10 text-green' : 'border-cyan/60 bg-cyan/10 text-cyan'
            }`}
          >
            {mode === 'JEV_LIVE' ? 'JEV接続' : 'シミュレーション'}
          </span>
          {!playing && (
            <button className="btn btn-primary" onClick={() => controller.runDemo()}>
              <Play size={11} /> {demoStarted ? 'デモを再開' : 'デモ開始'}
            </button>
          )}
        </div>
        {alert.active && (
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap border border-red/60 bg-red/10 px-2 py-[3px] text-[10px] font-semibold tracking-[0.08em] text-red" title={alert.message}>
            <span className="dot pulse" /> 異常警報 {(alert.rejectRate * 100).toFixed(1)}%
          </div>
        )}
        <div className="ml-auto shrink-0">
          <FactoryStatus />
        </div>
      </header>

      <KpiHeader />

      <div className="grid min-h-0 flex-1 grid-cols-[212px_minmax(0,1fr)_300px] grid-rows-[minmax(0,1fr)_248px] gap-2">
        <aside className="row-span-2 flex min-h-0 flex-col gap-2 overflow-y-auto">
          <SystemStatus />
          <ScenarioSelector />
          <ControlPanel />
          <ThresholdPanel />
        </aside>

        <main className="min-h-0">
          <VideoInspection />
        </main>

        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto [&>section]:shrink-0">
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
