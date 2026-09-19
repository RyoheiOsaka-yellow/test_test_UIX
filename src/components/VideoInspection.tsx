import { useEffect, useRef, useState } from 'react'
import { Video, VideoOff } from 'lucide-react'
import type { VideoSource } from '@/types/inspection'
import { getController } from '@/services/inspectionController'
import { inspectionStore, useInspectionStore } from '@/services/inspectionStore'
import { DetectionOverlay, drawOverlay } from './DetectionOverlay'
import { InspectionGate } from './InspectionGate'
import { InspectorPanel } from './InspectorPanel'
import { SyntheticFeed, drawSyntheticFeed } from './SyntheticFeed'
import { formatClock } from './Panel'

const VIDEO_CANDIDATES = ['/demo/bottling-line.mp4', '/demo/sample.mp4']

async function probeVideo(): Promise<VideoSource> {
  for (const url of VIDEO_CANDIDATES) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      const type = res.headers.get('content-type') ?? ''
      if (res.ok && type.startsWith('video/')) return { kind: 'video', url }
    } catch {
      /* ignore and try next */
    }
  }
  return { kind: 'placeholder' }
}

/**
 * Main video stage: video (or synthetic feed) + canvas overlay + gate + inspector panel.
 * Owns the requestAnimationFrame loop that advances the simulator and paints
 * detections in sync with media time.
 */
export function VideoInspection() {
  const [source, setSource] = useState<VideoSource | 'probing'>('probing')
  const overlay = useInspectionStore((s) => s.overlay)
  const mode = useInspectionStore((s) => s.mode)
  const scenario = useInspectionStore((s) => s.scenario)
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay

  const videoRef = useRef<HTMLVideoElement>(null)
  const feedRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let cancelled = false
    probeVideo().then((src) => {
      if (!cancelled) setSource(src)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Attach the clock once the source is known (video element or internal clock).
  useEffect(() => {
    if (source === 'probing') return
    const controller = getController()
    controller.attachVideo(videoRef.current, source)
  }, [source])

  // rAF loop: tick simulator → sample detections → draw.
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

    let lastClockPaint = 0
    const frame = () => {
      const t = controller.tick()
      const sample = controller.simulator.sample(t)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawOverlay(ctx, w, h, sample, overlayRef.current)
      if (feedCtx) {
        feedCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawSyntheticFeed(feedCtx, w, h, t, controller.simulator.groundTruth(t))
      }
      if (timeRef.current) timeRef.current.textContent = `T+${t.toFixed(2).padStart(6, '0')}s`
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
    }
  }, [source])

  const isVideo = source !== 'probing' && source.kind === 'video'
  const isPlaceholder = source !== 'probing' && source.kind === 'placeholder'

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center">
      <div
        ref={stageRef}
        className="scanline relative aspect-video max-h-full max-w-full overflow-hidden border border-border bg-black"
        style={{ width: 'min(100%, calc(100% * 1))', height: 'auto' }}
      >
        {isVideo && (
          <video
            ref={videoRef}
            src={source.url}
            className="absolute inset-0 h-full w-full object-fill"
            muted
            playsInline
            preload="auto"
            onEnded={() => inspectionStore.update(() => ({}))}
          />
        )}
        {isPlaceholder && <SyntheticFeed canvasRef={feedRef} />}
        {source === 'probing' && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tracking-[0.2em] text-ink-3">
            PROBING VIDEO SOURCE…
          </div>
        )}

        <DetectionOverlay canvasRef={canvasRef} />
        <InspectionGate visible={overlay.overlay && overlay.inspectionGate} />
        <InspectorPanel />

        {/* Top-right: camera / feed metadata */}
        <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1 font-mono text-[10px]">
          <div className="flex items-center gap-2 border border-border/80 bg-bg/80 px-2 py-1 text-ink-2 backdrop-blur-[2px]">
            {isVideo ? <Video size={11} className="text-green" /> : <VideoOff size={11} className="text-yellow" />}
            <span>CAM-01</span>
            <span className="text-ink-3">·</span>
            <span ref={clockRef} className="num text-ink">
              {formatClock(Date.now())}
            </span>
            <span className="text-ink-3">·</span>
            <span ref={timeRef} className="num text-cyan">
              T+000.00s
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`border px-1.5 py-[2px] text-[9px] font-semibold tracking-[0.18em] ${
                mode === 'JEV_LIVE' ? 'border-green/60 bg-green/10 text-green' : 'border-cyan/60 bg-cyan/10 text-cyan'
              }`}
            >
              {mode === 'JEV_LIVE' ? 'JEV LIVE' : 'SIMULATION'}
            </span>
            {isPlaceholder && (
              <span className="border border-yellow/60 bg-yellow/10 px-1.5 py-[2px] text-[9px] font-semibold tracking-[0.18em] text-yellow">
                SYNTHETIC FEED
              </span>
            )}
          </div>
        </div>

        {/* Bottom-left: source hint */}
        <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[9.5px] tracking-[0.12em] text-ink-3">
          {isPlaceholder
            ? 'NO VIDEO FILE · PLACE /public/demo/bottling-line.mp4 TO USE REAL FOOTAGE'
            : isVideo
              ? `SOURCE ${source.url}`
              : ''}
          <span className="ml-3 text-ink-3/70">SCENARIO {scenario.toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}
