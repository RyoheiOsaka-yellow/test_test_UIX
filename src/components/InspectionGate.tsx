import type { InspectionTrigger } from '@/types/inspection'

/** 検査トリガーの表示。ゲート型は線、ゾーン型は枠（DOM で描き、拡大縮小してもにじまない）。 */
export function InspectionGate({ visible, trigger, label }: { visible: boolean; trigger: InspectionTrigger; label: string }) {
  if (!visible) return null
  if (trigger.kind === 'zone') {
    const [x, y, w, h] = trigger.rect
    return (
      <div
        className="pointer-events-none absolute border border-dashed border-yellow/80"
        style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
      >
        <div className="absolute -top-[1px] left-0 -translate-y-full whitespace-nowrap bg-yellow px-1.5 py-[2px] text-[10px] font-semibold tracking-[0.12em] text-bg">
          {label}
        </div>
        <div className="absolute bottom-1 left-1.5 whitespace-nowrap text-[9.5px] tracking-[0.1em] text-yellow/80">
          滞留 {trigger.dwellSeconds.toFixed(1)}秒で判定
        </div>
      </div>
    )
  }
  const vertical = trigger.axis === 'x'
  const style = vertical ? { left: `${trigger.position * 100}%` } : { top: `${trigger.position * 100}%` }
  const arrow = vertical ? (trigger.direction === 1 ? '→' : '←') : trigger.direction === 1 ? '↓' : '↑'
  return (
    <div className={`pointer-events-none absolute ${vertical ? 'inset-y-0' : 'inset-x-0'}`} style={style}>
      <div className={`absolute border-dashed border-yellow/80 ${vertical ? 'inset-y-0 -left-px w-px border-l' : 'inset-x-0 -top-px h-px border-t'}`} />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 whitespace-nowrap bg-yellow px-1.5 py-[2px] text-[10px] font-semibold tracking-[0.12em] text-bg">
        {label} {arrow}
      </div>
      <div className="absolute top-8 left-2 whitespace-nowrap text-[9.5px] tracking-[0.1em] text-yellow/80">通過で判定 · 排出は模擬</div>
    </div>
  )
}
