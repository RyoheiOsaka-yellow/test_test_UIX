/** 縦の検査ゲート線（DOM で描き、拡大縮小しても線がにじまないようにする） */
export function InspectionGate({ visible, x = 0.5 }: { visible: boolean; x?: number }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: `${x * 100}%` }}>
      <div className="absolute inset-y-0 -left-px w-px border-l border-dashed border-yellow/80" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 whitespace-nowrap bg-yellow px-1.5 py-[2px] text-[10px] font-semibold tracking-[0.12em] text-bg">
        検査ゲート
      </div>
      <div className="absolute top-8 left-2 whitespace-nowrap text-[9.5px] tracking-[0.1em] text-yellow/80">
        ゲート02 · 排出（模擬）
      </div>
    </div>
  )
}
