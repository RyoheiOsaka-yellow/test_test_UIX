import { useEffect, useRef, useState } from 'react'
import { Video, VideoOff } from 'lucide-react'
import type { InspectionProfile, VideoSource } from '@/types/inspection'
import { SCENARIOS, scenarioText } from '@/data/scenarios'
import { getController } from '@/services/inspectionController'
import { useInspectionStore } from '@/services/inspectionStore'
import { DetectionOverlay, drawOverlay } from './DetectionOverlay'
import { InspectionGate } from './InspectionGate'
import { InspectorPanel } from './InspectorPanel'
import { SyntheticFeed, drawSyntheticFeed } from './SyntheticFeed'
import { drawSyntheticFillingFeed } from './SyntheticFillingFeed'
import { CanvasPixelSource } from '@/services/fillLevelMeter'
import { formatClock } from './Panel'

/** 動画ソースの探索: 単一HTMLへの埋め込み → /demo/<dir>/video.mp4 → .webm → 合成映像 */
async function probeVideo(profile: InspectionProfile): Promise<VideoSource> {
  const embedded = window.__JEV_EMBEDDED__?.profiles?.[profile.id]?.videoDataUrl
  if (embedded) return { kind: 'video', url: embedded }
  for (const rel of [`demo/${profile.mediaDir}/video.mp4`, `demo/${profile.mediaDir}/video.webm`]) {
    const url = `${import.meta.env.BASE_URL}${rel}`
    try {
      const res = await fetch(url, { method: 'HEAD' })
      const type = res.headers.get('content-type') ?? ''
      if (res.ok && type.startsWith('video/')) return { kind: 'video', url }
    } catch {
      /* 次の候補へ */
    }
  }
  return { kind: 'placeholder' }
}

/**
 * メインの映像ステージ: 動画（または合成映像）+ キャンバス重畳 + ゲート + 検査パネル。
 * requestAnimationFrame のループを持ち、シミュレータを進めて検知結果を
 * メディア時刻に同期して描画する。
 */
export function VideoInspection() {
  const [source, setSource] = useState<VideoSource | 'probing'>('probing')
  const overlay = useInspectionStore((s) => s.overlay)
  const mode = useInspectionStore((s) => s.mode)
  const scenario = useInspectionStore((s) => s.scenario)
  const trackSource = useInspectionStore((s) => s.trackSource)
  const profile = useInspectionStore((s) => s.profile)
  const trigger = useInspectionStore((s) => s.trigger)
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay
  const profileRef = useRef(profile)
  profileRef.current = profile
  const triggerRef = useRef(trigger)
  triggerRef.current = trigger

  const videoRef = useRef<HTMLVideoElement>(null)
  const feedRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let cancelled = false
    setSource('probing')
    probeVideo(profile)
      .then((src) => getController().resolveVideoSource(profile, src))
      .then((src) => {
        if (!cancelled) setSource(src)
      })
    return () => {
      cancelled = true
    }
  }, [profile])

  useEffect(() => {
    if (source === 'probing') return
    void getController().attachVideo(videoRef.current, source)
  }, [source])

  useEffect(() => {
    if (source === 'probing') return
    const controller = getController()
    const stage = stageRef.current!
    const canvas = canvasRef.current!
    const feed = feedRef.current
    const ctx = canvas.getContext('2d')!
    const feedCtx = feed?.getContext('2d') ?? null
    let raf = 0
    let w = 0
    let h = 0
    let dpr = 1

    const resize = () => {
      const rect = stage.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      for (const c of [canvas, feed]) {
        if (!c) continue
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(stage)
    resize()

    // 計測プロファイル用: 画素の読み出し元（実映像なら <video>、合成なら合成キャンバス）
    controller.simulator.pixelSource = new CanvasPixelSource(() => (source.kind === 'video' ? videoRef.current : feedRef.current))

    let lastClockPaint = 0
    const frame = () => {
      const t = controller.tick()
      const sample = controller.simulator.sample(t)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawOverlay(ctx, w, h, sample, overlayRef.current, profileRef.current, triggerRef.current)
      if (feedCtx) {
        feedCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        if (profileRef.current.syntheticFeed === 'filling') drawSyntheticFillingFeed(feedCtx, w, h, t, controller.simulator.groundTruth(t))
        else if (profileRef.current.syntheticFeed === 'none') {
          feedCtx.fillStyle = '#0a0e14'
          feedCtx.fillRect(0, 0, w, h)
        } else drawSyntheticFeed(feedCtx, w, h, t, controller.simulator.groundTruth(t))
      }
      if (timeRef.current) timeRef.current.textContent = `再生 ${t.toFixed(2)}秒`
      const now = performance.now()
      if (clockRef.current && now - lastClockPaint > 40) {
        lastClockPaint = now
        clockRef.current.textContent = formatClock(Date.now())
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controller.simulator.pixelSource = null
    }
  }, [source])

  const isVideo = source !== 'probing' && source.kind === 'video'
  const isPlaceholder = source !== 'probing' && source.kind === 'placeholder'
  const credit = window.__JEV_EMBEDDED__?.profiles?.[profile.id]?.videoCredit

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center">
      <div ref={stageRef} className="scanline relative aspect-video max-h-full max-w-full overflow-hidden border border-border bg-black" style={{ width: '100%', height: 'auto' }}>
        {isVideo && (
          <video
            ref={videoRef}
            src={source.url}
            className="absolute inset-0 h-full w-full object-fill"
            muted
            playsInline
            preload="auto"
            onError={() => {
              // 再生できない（コーデック非対応など）場合は合成映像へ退避する
              getController().bus.emit('SYSTEM', '動画を再生できないため合成映像へ切り替えました', { severity: 'warn' })
              setSource({ kind: 'placeholder' })
            }}
          />
        )}
        {isPlaceholder && <SyntheticFeed canvasRef={feedRef} />}
        {source === 'probing' && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] tracking-[0.2em] text-ink-3">映像ソースを確認中…</div>
        )}

        <DetectionOverlay canvasRef={canvasRef} />
        <InspectionGate visible={overlay.overlay && overlay.inspectionGate} trigger={trigger} label={trackSource === 'real' || profile.syntheticFeed ? profile.triggerLabel : '検査ゲート'} />
        <InspectorPanel />

        <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1 text-[10px]">
          <div className="flex items-center gap-2 border border-border/80 bg-bg/80 px-2 py-1 text-ink-2 backdrop-blur-[2px]">
            {isVideo ? <Video size={11} className="text-green" /> : <VideoOff size={11} className="text-yellow" />}
            <span>{profile.cameraName}</span>
            <span className="text-ink-3">·</span>
            <span ref={clockRef} className="num text-ink">
              {formatClock(Date.now())}
            </span>
            <span className="text-ink-3">·</span>
            <span ref={timeRef} className="num text-cyan">
              再生 0.00秒
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`border px-1.5 py-[2px] text-[9.5px] font-semibold tracking-[0.12em] ${
                mode === 'JEV_LIVE' ? 'border-green/60 bg-green/10 text-green' : 'border-cyan/60 bg-cyan/10 text-cyan'
              }`}
            >
              {mode === 'JEV_LIVE' ? 'JEV接続' : 'シミュレーション'}
            </span>
            {isPlaceholder && (
              <span className="border border-yellow/60 bg-yellow/10 px-1.5 py-[2px] text-[9.5px] font-semibold tracking-[0.12em] text-yellow">合成映像</span>
            )}
            {isVideo && (
              <span className="border border-cyan/60 bg-cyan/10 px-1.5 py-[2px] text-[9.5px] font-semibold tracking-[0.12em] text-cyan">
                {trackSource === 'real' ? '実映像 · 事前追跡' : '実映像'}
              </span>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute top-[178px] left-3 flex max-w-[260px] flex-col gap-0.5 text-[9.5px] leading-tight tracking-[0.06em] text-ink-3">
          {isPlaceholder &&
            (profile.measurement
              ? `合成映像 · ${profile.measurement.label}は画素の HSV 解析で実測（public/demo/${profile.mediaDir}/video.mp4 を置くと実映像でも同じ計測が走ります）`
              : profile.syntheticFeed === 'none'
                ? `映像なし · public/demo/${profile.mediaDir}/video.mp4 と骨格追跡結果を置くと動きます`
                : `動画ファイルなし · public/demo/${profile.mediaDir}/video.mp4 を置くと実映像に切り替わります`)}
          {isVideo &&
            (credit ??
              `${profile.objectLabel}検出: 事前追跡 · ${profile.attributeLabel}判定: ${
                profile.trigger.kind === 'state' ? (profile.analyzer === 'crosswalk' ? '場面解析' : '時系列判定') : profile.measurement ? '画素解析で実測' : '疑似注入'
              }`)}
          <span className="text-ink-3/70">シナリオ: {scenarioText(SCENARIOS[scenario].name, profile)}</span>
        </div>
      </div>
    </div>
  )
}
