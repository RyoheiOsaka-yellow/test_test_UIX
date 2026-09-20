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
      <Field
        label={`${profile.attributeLabel}判定`}
        value={profile.trigger.kind === 'state' ? (profile.analyzer === 'crosswalk' ? '場面解析（ゾーン + 車両接近）' : '時系列判定（5特徴量）') : profile.measurement ? (profile.measurement.method === 'ripeness' ? '実測（色相の画素解析）' : profile.measurement.method === 'size' ? '実測（追跡枠の大きさ・基準比）' : '実測（画素の HSV 解析）') : profile.severityFromArea ? '検出枠の面積から算出' : '疑似注入'}
        mono={false}
      />
      <Field
        label="判定トリガー"
        value={
          trigger.kind === 'gate'
            ? `ゲート ${trigger.axis} = ${trigger.position.toFixed(2)}`
            : trigger.kind === 'zone'
              ? `ゾーン滞留 ${trigger.dwellSeconds.toFixed(1)}秒`
              : `状態遷移（${trigger.confirmSeconds.toFixed(1)}秒で確定）`
        }
      />
    </Panel>
  )
}
