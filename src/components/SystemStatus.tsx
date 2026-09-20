import { useInspectionStore } from '@/services/inspectionStore'
import { Field, Panel } from './Panel'

export function SystemStatus() {
  const mode = useInspectionStore((s) => s.mode)
  const fallbacks = useInspectionStore((s) => s.engineFallbacks)
  const trackSource = useInspectionStore((s) => s.trackSource)
  const profile = useInspectionStore((s) => s.profile)
  const trigger = useInspectionStore((s) => s.trigger)
  return (
    <Panel title="システム" bodyClassName="px-2.5 py-1.5">
      <Field label="カメラ" value={profile.cameraName} mono={false} />
      <Field label="ライン" value={profile.lineName} mono={false} />
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
      <Field label="検査項目" value={`${profile.objectLabel}の${profile.attributeLabel}`} mono={false} />
      <Field label="認識モデル" value="試作ビジョン v0.1" mono={false} />
      <Field label={`${profile.objectLabel}検出`} value={trackSource === 'real' ? profile.detectorNote : '合成'} mono={false} />
      <Field label={`${profile.attributeLabel}判定`} value={profile.measurement ? '実測（画素の HSV 解析）' : '疑似注入'} mono={false} />
      <Field
        label="判定トリガー"
        value={
          trigger.kind === 'gate'
            ? `ゲート ${trigger.axis} = ${trigger.position.toFixed(2)}`
            : `ゾーン滞留 ${trigger.dwellSeconds.toFixed(1)}秒`
        }
      />
    </Panel>
  )
}
