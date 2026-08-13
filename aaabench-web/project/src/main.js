import * as THREE from 'three'
import { installHarness } from './engine/harness.js'
import { registerDefaultPoses } from './engine/cameras.js'
import { createWorld } from './world/index.js'
import { mountGame } from './game/index.js'

const canvas = document.getElementById('viewport')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  // preserveDrawingBuffer costs a little bandwidth and buys the ability to read the frame
  // back out of the canvas — toDataURL, pixel probes, anything that inspects what was drawn
  // rather than what was meant to be drawn. Keep it.
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
})

const params = new URLSearchParams(location.search)
// Captures run at pixelRatio 1 so two screenshots of the same pose are the same measurement
// on any machine. Interactive play gets the real ratio.
const capture = params.has('capture')
renderer.setPixelRatio(capture ? 1 : Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight, false)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 40000)
camera.position.set(0, 1.7, 30)

const clock = new THREE.Clock()

// Everything downstream is handed this one object. Systems push themselves onto `systems`
// and get ticked; nothing needs a global.
const ctx = { THREE, renderer, scene, camera, clock, systems: [] }

const A = installHarness(ctx)
registerDefaultPoses(A, ctx)

await createWorld(ctx)
mountGame(ctx)

if (params.get('pose')) {
  try {
    A.setPose(params.get('pose'))
  } catch (e) {
    console.error(String(e))
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight, false)
})

renderer.setAnimationLoop((now) => {
  const dt = Math.min(clock.getDelta(), 0.1) * A.timeScale // clamped: a tab that was backgrounded
  if (!A.paused) {                                          // must not teleport every system
    for (const s of ctx.systems) {
      try {
        s.update?.(dt, now)
      } catch (e) {
        // One broken system must not stop the frame — a black page hides every other fault.
        console.error(`system "${s.name}" threw: ${e && e.stack ? e.stack : e}`)
        s.update = null
      }
    }
  }
  renderer.render(scene, ctx.renderCamera())
  A.frame(now)
})
