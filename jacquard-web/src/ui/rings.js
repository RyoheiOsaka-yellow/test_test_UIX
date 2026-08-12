// The runners, drawn as rings.
//
// One ring per CHAN lane, in the channel's own colour, sweeping as the runner walks
// its lane and starting again at the terminator — so a sixteen step lane and a four
// step one beside it turn at four to one, which is the thing about parallel lanes that
// the plane states and does not show.
//
// It answers a different question from the playheads. Those say which cell is
// sounding, cell by cell; this says how far round each lane is, all of them at once
// and without reading the plane. The two are never out of step because both come off
// the same runner.
//
// Drawn rather than laid out, for the reason the original gives for its own
// visualizer: a ring is a few hundred arcs a second and a panel would want an element
// per one.

import { channelHue } from './style.js'

// The card decides how wide this is, so the drawing reads its own box rather than
// holding a number of its own: a ring that overflowed its card would be the one thing
// on screen that does not fit.
const Track = 9
const Gap = 4

export class Rings {
  constructor() {
    this.node = document.createElement('div')
    this.node.className = 'panel rings-panel'

    const header = document.createElement('div')
    header.className = 'panel-header'
    header.textContent = 'Runners'

    const rule = document.createElement('div')
    rule.className = 'panel-rule'

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'rings'

    this.node.append(header, rule, this.canvas)
    this.context = this.canvas.getContext('2d')
  }

  draw(sequencer, project) {
    const ctx = this.context
    const ratio = window.devicePixelRatio || 1
    const size = this.canvas.clientWidth || 168

    if (this.canvas.width !== Math.floor(size * ratio)) {
      this.canvas.width = Math.floor(size * ratio)
      this.canvas.height = Math.floor(size * ratio)
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const centre = size / 2
    const runners = sequencer.runners.slice(0, 6)

    // The rings share what is left between the edge and the hole in the middle, so
    // that six of them read as well as two and the number in the centre is never
    // written over. They thin rather than crowd, which is what a ring can afford to
    // give up and a legible centre is not.
    const outer = centre - 6
    const hole = Math.max(centre * 0.42, 26)
    const spacing = runners.length > 0
      ? Math.min(Track + Gap, (outer - hole) / runners.length) : Track + Gap
    const track = Math.max(3, Math.min(Track, spacing - Gap))

    runners.forEach((runner, index) => {
      const radius = outer - index * spacing - track / 2
      if (radius < track) return

      const hue = channelHue(runner.channel)
      const lane = runner.playingLane ?? runner.lane
      const steps = Math.max(lane?.steps.length ?? 1, 1)

      // Where the runner is heard rather than where it has been scheduled to, so a
      // ring and a playhead are the same moment.
      const step = runner.playingStep >= 0 ? runner.playingStep : 0
      const swept = sequencer.isPlaying ? (step + 1) / steps : 0

      // The ground the ring turns on, so an empty one still reads as a lane.
      ctx.beginPath()
      ctx.arc(centre, centre, radius, 0, Math.PI * 2)
      ctx.strokeStyle = 'hsl(' + hue + ' 60% 60% / 0.12)'
      ctx.lineWidth = track
      ctx.shadowBlur = 0
      ctx.stroke()

      if (swept <= 0) return

      ctx.beginPath()
      ctx.arc(centre, centre, radius, -Math.PI / 2,
              -Math.PI / 2 + swept * Math.PI * 2)
      ctx.strokeStyle = 'hsl(' + hue + ' 95% 62%)'
      ctx.lineCap = 'round'
      ctx.shadowColor = 'hsl(' + hue + ' 95% 60% / 0.9)'
      ctx.shadowBlur = 14
      ctx.stroke()

      // The head of the sweep, which is the lit end a hardware sequencer has.
      const angle = -Math.PI / 2 + swept * Math.PI * 2
      ctx.beginPath()
      ctx.arc(centre + Math.cos(angle) * radius, centre + Math.sin(angle) * radius,
              Math.max(track / 2 - 1, 1.5), 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = 18
      ctx.fill()
    })

    ctx.shadowBlur = 0

    // The tempo everything here is turning at, which is the one number a ring cannot
    // say by itself.
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f4f6ff'
    ctx.font = '600 ' + Math.round(size * 0.19) + 'px ui-rounded, system-ui, sans-serif'
    ctx.shadowColor = 'rgba(160, 180, 255, 0.65)'
    ctx.shadowBlur = 16
    ctx.fillText(Math.round(project.tempo), centre, centre + Math.round(size * 0.035))

    // Just the unit under it: how many runners there are is already the number of
    // rings, and a caption long enough to say so would run out under them.
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(200, 205, 230, 0.55)'
    ctx.font = '500 9px ui-monospace, monospace'
    ctx.letterSpacing = '2px'
    ctx.fillText('BPM', centre, centre + Math.round(size * 0.13))
    ctx.letterSpacing = '0px'
  }
}
