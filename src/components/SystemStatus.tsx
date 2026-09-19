import { useInspectionStore } from '@/services/inspectionStore'
import { Field, Panel } from './Panel'

export function SystemStatus() {
  const mode = useInspectionStore((s) => s.mode)
  const fallbacks = useInspectionStore((s) => s.engineFallbacks)
  return (
    <Panel title="System" bodyClassName="px-2.5 py-1.5">
      <Field label="Camera" value="CAM-01" />
      <Field label="Line" value="Bottling Line A" mono={false} />
      <Field
        label="Mode"
        value={
          <span className={mode === 'JEV_LIVE' ? 'text-green' : 'text-cyan'}>
            {mode === 'JEV_LIVE' ? 'JEV LIVE' : 'SIMULATION'}
            {fallbacks > 0 && <span className="ml-1 text-yellow">(fallback ×{fallbacks})</span>}
          </span>
        }
      />
      <Field label="Inspection" value="Bottle Cap" mono={false} />
      <Field label="Model" value="Prototype Vision v0.1" />
      <Field label="Tracker" value="Keyframe replay" mono={false} />
      <Field label="Classes" value="CAPPED · UNCAPPED" />
      <Field label="Gate" value="x = 0.50" />
    </Panel>
  )
}
