import { Check, X } from 'lucide-react'
import { reasonJa } from '@/i18n/ja'
import { getController } from '@/services/inspectionController'
import { useInspectionStore } from '@/services/inspectionStore'
import { Panel, pct } from './Panel'

export function HumanReviewQueue() {
  const queue = useInspectionStore((s) => s.reviewQueue)
  const profile = useInspectionStore((s) => s.profile)
  const controller = getController()
  return (
    <Panel
      title="人による確認待ち"
      right={<span className={`num text-[10px] ${queue.length ? 'text-violet' : 'text-ink-3'}`}>{queue.length}</span>}
      className="max-h-[220px]"
      bodyClassName="overflow-y-auto"
    >
      {queue.length === 0 ? (
        <div className="px-2.5 py-2 text-[10.5px] text-ink-3">確認待ちはありません</div>
      ) : (
        queue.map((item) => (
          <div key={item.objectId + item.timestamp} className="flex items-center gap-2 border-b border-border-2 px-2.5 py-1.5 last:border-b-0">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="num text-[12px] text-ink">{item.objectId}</span>
                <span className="text-[10px] text-violet">{profile.attributeLabel}? {pct(item.attributeConfidence)}</span>
              </div>
              <div className="text-[9.5px] text-ink-3">
                JEV {pct(item.jevConfidence)} · {reasonJa(item.reason, profile)}
              </div>
            </div>
            <button className="btn btn-primary !px-1.5 !py-1" onClick={() => controller.store.resolveReview(item.objectId, 'PASS', controller.bus)} title="合格にする">
              <Check size={11} /> 合格
            </button>
            <button
              className="btn !border-red/50 !bg-red/10 !px-1.5 !py-1 !text-red"
              onClick={() => controller.store.resolveReview(item.objectId, 'REJECT', controller.bus)}
              title="不良にする"
            >
              <X size={11} /> 不良
            </button>
          </div>
        ))
      )}
    </Panel>
  )
}
