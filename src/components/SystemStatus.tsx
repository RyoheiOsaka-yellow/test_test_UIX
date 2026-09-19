import { useInspectionStore } from '@/services/inspectionStore'
import { Field, Panel } from './Panel'

export function SystemStatus() {
  const mode = useInspectionStore((s) => s.mode)
  const fallbacks = useInspectionStore((s) => s.engineFallbacks)
  const trackSource = useInspectionStore((s) => s.trackSource)
  return (
    <Panel title="システム" bodyClassName="px-2.5 py-1.5">
      <Field label="カメラ" value="カメラ01" mono={false} />
      <Field label="ライン" value="充填ライン A" mono={false} />
      <Field
        label="モード"
        value={
          <span className={mode === 'JEV_LIVE' ? 'text-green' : 'text-cyan'}>
            {mode === 'JEV_LIVE' ? 'JEV接続' : 'シミュレーション'}
            {fallbacks > 0 && <span className="ml-1 text-yellow">（模擬へ退避 ×{fallbacks}）</span>}
          </span>
        }
        mono={false}
      />
      <Field label="検査項目" value="ボトルキャップ" mono={false} />
      <Field label="認識モデル" value="試作ビジョン v0.1" mono={false} />
      <Field label="ボトル検出" value={trackSource === 'real' ? '事前追跡（実映像）' : '合成'} mono={false} />
      <Field label="キャップ判定" value="疑似注入" mono={false} />
      <Field label="ゲート位置" value="x = 0.50" />
    </Panel>
  )
}
