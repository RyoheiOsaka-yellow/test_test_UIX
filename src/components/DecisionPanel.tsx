import { DECISION_JA, actionJa, reasonJa } from '@/i18n/ja'
import { useInspectionStore } from '@/services/inspectionStore'
import { Panel, decisionColor, pct } from './Panel'

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-[3px] w-full bg-border-2">
      <div className="h-full transition-[width] duration-150" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

export function DecisionPanel() {
  const cur = useInspectionStore((s) => s.currentObject)
  const mode = useInspectionStore((s) => s.mode)
  const d = cur?.decision
  return (
    <Panel
      title="JEV 判断エンジン"
      right={<span className={`text-[9px] ${mode === 'JEV_LIVE' ? 'text-green' : 'text-cyan'}`}>{mode === 'JEV_LIVE' ? '接続' : '模擬'}</span>}
      bodyClassName="px-2.5 py-2"
    >
      <div className="label mb-1">現在の対象</div>
      <div className="flex items-baseline justify-between">
        <span className="label">追跡番号</span>
        <span className="num text-[18px] text-ink">{cur?.objectId ?? '—'}</span>
      </div>

      <div className="label mt-3 mb-1">認識結果</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-ink-2">ボトル</span>
            <span className="num text-[13px]">{cur ? pct(cur.bottleConfidence) : '—'}</span>
          </div>
          <Bar value={cur?.bottleConfidence ?? 0} color="#31c6ff" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-ink-2">キャップ</span>
            <span className={`num text-[13px] ${cur && cur.capConfidence < 0.45 ? 'text-red' : cur && cur.capConfidence < 0.75 ? 'text-yellow' : ''}`}>
              {cur ? pct(cur.capConfidence) : '—'}
            </span>
          </div>
          <Bar value={cur?.capConfidence ?? 0} color={cur && cur.capConfidence < 0.45 ? '#ff5151' : cur && cur.capConfidence < 0.75 ? '#ffd52a' : '#39ff88'} />
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-[10px] text-ink-2">キャップ位置</span>
        <span className="num text-[11px] text-ink-2">{cur ? pct(cur.alignment) : '—'}</span>
      </div>

      <div className="label mt-3 mb-1">JEV の判断</div>
      <div className={`text-[26px] leading-none font-semibold ${d ? decisionColor[d.decision] : cur ? 'text-yellow/80 pulse' : 'text-ink-3'}`}>
        {d ? DECISION_JA[d.decision] : cur ? '判断中' : '待機'}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <div className="label">判断の確信度</div>
          <div className="num text-[15px]">{d ? pct(d.confidence) : '—'}</div>
        </div>
        <div>
          <div className="label">遅延</div>
          <div className="num text-[15px]">{d ? `${d.latencyMs.toFixed(0)} ミリ秒` : '—'}</div>
        </div>
        <div className="col-span-2">
          <div className="label">理由</div>
          <div className="text-[11px] text-ink">{reasonJa(d?.reason)}</div>
        </div>
        <div className="col-span-2">
          <div className="label">処置</div>
          <div className={`text-[11px] ${d?.decision === 'REJECT' ? 'text-red' : 'text-ink'}`}>{actionJa(d?.action)}</div>
        </div>
      </div>

      <div className="label mt-3 mb-1">提示した選択肢</div>
      <div className="flex flex-wrap gap-1">
        {(['PASS', 'RECHECK', 'REJECT', 'HUMAN_REVIEW'] as const).map((o) => (
          <span
            key={o}
            className={`border px-1.5 py-[1px] text-[9.5px] tracking-[0.08em] ${
              d?.decision === o ? `${decisionColor[o]} border-current` : 'border-border text-ink-3'
            }`}
          >
            {DECISION_JA[o]}
          </span>
        ))}
      </div>
    </Panel>
  )
}
