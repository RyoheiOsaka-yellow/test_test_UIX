import { Pause, Play, RotateCcw } from 'lucide-react'
import type { OverlaySettings, PlaybackRate } from '@/types/inspection'
import { getController } from '@/services/inspectionController'
import { useInspectionStore } from '@/services/inspectionStore'
import { Panel } from './Panel'

const TOGGLES: Array<[keyof OverlaySettings, string]> = [
  ['overlay', '検知オーバーレイ'],
  ['boundingBox', '枠線'],
  ['confidence', '信頼度'],
  ['trackingId', '追跡番号'],
  ['inspectionGate', '検査ゲート'],
  ['jevDecision', 'JEV 判断'],
]

export function ControlPanel() {
  const playing = useInspectionStore((s) => s.playing)
  const rate = useInspectionStore((s) => s.playbackRate)
  const overlay = useInspectionStore((s) => s.overlay)
  const controller = getController()

  const setOverlay = (key: keyof OverlaySettings) =>
    controller.store.update((s) => ({ overlay: { ...s.overlay, [key]: !s.overlay[key] } }))

  return (
    <Panel title="操作" bodyClassName="px-2.5 py-2">
      <div className="flex gap-1">
        {playing ? (
          <button className="btn flex-1 justify-center" onClick={() => controller.pause()}>
            <Pause size={11} /> 一時停止
          </button>
        ) : (
          <button className="btn btn-primary flex-1 justify-center" onClick={() => void controller.play()}>
            <Play size={11} /> 再生
          </button>
        )}
        <button className="btn" onClick={() => controller.restart()} title="最初から">
          <RotateCcw size={11} />
        </button>
      </div>

      <div className="label mt-3 mb-1">再生速度</div>
      <div className="flex gap-1">
        {([0.5, 1, 2] as PlaybackRate[]).map((r) => (
          <button key={r} className={`btn flex-1 justify-center ${rate === r ? 'btn-active' : ''}`} onClick={() => controller.setRate(r)}>
            {r}倍
          </button>
        ))}
      </div>

      <div className="label mt-3 mb-1">表示</div>
      <div className="flex flex-col">
        {TOGGLES.map(([key, label]) => {
          const on = overlay[key]
          const disabled = key !== 'overlay' && !overlay.overlay
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => setOverlay(key)}
              className="flex items-center justify-between py-[3px] text-[10.5px] text-ink-2 hover:text-ink disabled:opacity-40"
            >
              <span>{label}</span>
              <span className={`flex h-[12px] w-[22px] items-center border px-[1px] ${on ? 'border-green/60 bg-green/15' : 'border-border bg-bg'}`}>
                <span className={`h-[8px] w-[8px] transition-transform ${on ? 'translate-x-[10px] bg-green' : 'translate-x-0 bg-ink-3'}`} />
              </span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
