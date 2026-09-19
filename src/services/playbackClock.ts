import type { PlaybackRate } from '@/types/inspection'

/**
 * Playback clock abstraction.
 *
 * Detection events are synchronised to *media time*, not wall time. With a demo
 * video the HTMLVideoElement is the clock; without one an internal clock drives
 * the synthetic feed. In production the equivalent is the camera frame
 * timestamp (RTSP PTS).
 */
export interface PlaybackClock {
  readonly kind: 'video' | 'internal'
  readonly duration: number
  currentTime(): number
  isPlaying(): boolean
  rate(): PlaybackRate
  play(): Promise<void> | void
  pause(): void
  seek(time: number): void
  setRate(rate: PlaybackRate): void
  /** Fires on play/pause/seek/ended state changes (not every frame). */
  subscribe(listener: () => void): () => void
  dispose(): void
}

abstract class BaseClock implements PlaybackClock {
  abstract readonly kind: 'video' | 'internal'
  abstract readonly duration: number
  protected listeners = new Set<() => void>()
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  protected notify() {
    this.listeners.forEach((l) => l())
  }
  abstract currentTime(): number
  abstract isPlaying(): boolean
  abstract rate(): PlaybackRate
  abstract play(): Promise<void> | void
  abstract pause(): void
  abstract seek(time: number): void
  abstract setRate(rate: PlaybackRate): void
  dispose() {
    this.listeners.clear()
  }
}

export class VideoClock extends BaseClock {
  readonly kind = 'video' as const
  private video: HTMLVideoElement
  private handlers: Array<[string, () => void]> = []

  constructor(video: HTMLVideoElement) {
    super()
    this.video = video
    video.loop = true
    const h = () => this.notify()
    for (const ev of ['play', 'pause', 'seeked', 'ended', 'ratechange', 'loadedmetadata']) {
      video.addEventListener(ev, h)
      this.handlers.push([ev, h])
    }
  }
  get duration() {
    return Number.isFinite(this.video.duration) ? this.video.duration : 0
  }
  currentTime() {
    return this.video.currentTime
  }
  isPlaying() {
    return !this.video.paused && !this.video.ended
  }
  rate() {
    return this.video.playbackRate as PlaybackRate
  }
  play() {
    return this.video.play().catch(() => undefined)
  }
  pause() {
    this.video.pause()
  }
  seek(time: number) {
    this.video.currentTime = time
    this.notify()
  }
  setRate(rate: PlaybackRate) {
    this.video.playbackRate = rate
  }
  dispose() {
    for (const [ev, h] of this.handlers) this.video.removeEventListener(ev, h)
    super.dispose()
  }
}

/** Internal clock used when no demo video is present (synthetic feed). */
export class InternalClock extends BaseClock {
  readonly kind = 'internal' as const
  readonly duration: number
  private base = 0 // media time at last anchor
  private anchor = 0 // performance.now() at last anchor
  private playing = false
  private playbackRate: PlaybackRate = 1

  constructor(duration = 240) {
    super()
    this.duration = duration
  }
  currentTime() {
    if (!this.playing) return this.base
    const t = this.base + ((performance.now() - this.anchor) / 1000) * this.playbackRate
    if (t >= this.duration) {
      // loop
      this.base = t % this.duration
      this.anchor = performance.now()
      this.notify()
      return this.base
    }
    return t
  }
  isPlaying() {
    return this.playing
  }
  rate() {
    return this.playbackRate
  }
  play() {
    if (this.playing) return
    this.anchor = performance.now()
    this.playing = true
    this.notify()
  }
  pause() {
    if (!this.playing) return
    this.base = this.currentTime()
    this.playing = false
    this.notify()
  }
  seek(time: number) {
    this.base = Math.max(0, Math.min(this.duration, time))
    this.anchor = performance.now()
    this.notify()
  }
  setRate(rate: PlaybackRate) {
    this.base = this.currentTime()
    this.anchor = performance.now()
    this.playbackRate = rate
    this.notify()
  }
}
