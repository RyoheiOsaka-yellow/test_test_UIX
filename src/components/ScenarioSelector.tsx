import type { ScenarioId } from '@/types/inspection'
import { SCENARIOS, SCENARIO_ORDER, scenarioText } from '@/data/scenarios'
import { getController } from '@/services/inspectionController'
import { useInspectionStore } from '@/services/inspectionStore'
import { Panel } from './Panel'

export function ScenarioSelector() {
  const current = useInspectionStore((s) => s.scenario)
  const profile = useInspectionStore((s) => s.profile)
  const controller = getController()
  return (
    <Panel title="デモシナリオ" bodyClassName="px-1.5 py-1.5">
      {SCENARIO_ORDER.map((id: ScenarioId) => {
        const sc = SCENARIOS[id]
        const active = id === current
        return (
          <button
            key={id}
            onClick={() => controller.selectScenario(id)}
            title={scenarioText(sc.description, profile)}
            className={`flex w-full items-center gap-2 px-1.5 py-[4px] text-left text-[10.5px] transition-colors ${
              active ? 'bg-cyan/10 text-cyan' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
            }`}
          >
            <span className={`dot ${active ? 'text-cyan' : 'text-border'}`} />
            <span className="flex-1">{scenarioText(sc.name, profile)}</span>
            <span className="num text-[9px] text-ink-3">{Math.round(sc.ngRate * 100)}%</span>
          </button>
        )
      })}
      <div className="mt-1 border-t border-border-2 px-1.5 pt-1.5 text-[9.5px] leading-snug text-ink-3">
        {scenarioText(SCENARIOS[current].description, profile)}
      </div>
    </Panel>
  )
}
