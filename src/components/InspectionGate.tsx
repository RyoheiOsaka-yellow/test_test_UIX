/** Vertical inspection gate line (DOM, so it stays crisp at any size). */
export function InspectionGate({ visible, x = 0.5 }: { visible: boolean; x?: number }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: `${x * 100}%` }}>
      <div className="absolute inset-y-0 -left-px w-px border-l border-dashed border-yellow/80" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 whitespace-nowrap bg-yellow px-1.5 py-[2px] font-mono text-[9.5px] font-semibold tracking-[0.16em] text-bg">
        INSPECTION GATE
      </div>
      <div className="absolute bottom-7 left-2 whitespace-nowrap font-mono text-[9px] tracking-[0.14em] text-yellow/80">
        GATE 02 · EJECT SIM
      </div>
    </div>
  )
}
