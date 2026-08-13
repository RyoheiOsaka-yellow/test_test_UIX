// The sensor contract.
//
// This file is the harness's, not the world's. Everything the operator's tools can see —
// screenshots from a named camera, frame times, draw calls, what is actually in the scene,
// what threw — comes through `window.__aaabench`. The tools call nothing else and know
// nothing else about your code.
//
// You may restructure the entire project around it. Keep the surface answering honestly:
// blind sensors do not make a run look better, they make it unmeasurable, and an
// unmeasurable run is a failed one. If your world needs a sensor this does not have, add it.

const FRAME_WINDOW = 240 // ~4s at 60fps: long enough to see a hitch, short enough to be current

export function installHarness(ctx) {
  const A = (window.__aaabench = window.__aaabench || { errors: [], logs: [] })
  const frameTimes = []
  const poses = new Map()
  let inspecting = null // pose name while the inspection camera is driving
  let last = performance.now()

  const inspector = new ctx.THREE.PerspectiveCamera(50, aspect(), 1, 40000)
  ctx.inspector = inspector
  ctx.renderCamera = () => (inspecting ? inspector : ctx.camera)

  function aspect() {
    return Math.max(1e-3, window.innerWidth / window.innerHeight)
  }

  Object.assign(A, {
    version: 1,
    ready: false,
    frames: 0,
    timeScale: 1,
    paused: false,

    // ---------------------------------------------------------------- frame accounting
    // main.js calls this once per rendered frame, after render(), so renderer.info holds
    // this frame's numbers rather than the previous one's.
    frame(now) {
      const dt = now - last
      last = now
      A.frames++
      frameTimes.push(dt)
      if (frameTimes.length > FRAME_WINDOW) frameTimes.shift()
      if (!A.ready && A.frames >= 2) {
        A.ready = true
        const el = document.getElementById('boot')
        if (el) el.hidden = true
      }
    },

    waitFrames(n = 2) {
      const target = A.frames + n
      return new Promise((resolve) => {
        const tick = () => (A.frames >= target ? resolve(A.frames) : requestAnimationFrame(tick))
        tick()
      })
    },

    // ---------------------------------------------------------------- numbers
    stats() {
      const r = ctx.renderer.info
      const sorted = [...frameTimes].sort((a, b) => a - b)
      const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0
      const mean = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1)
      let objects = 0
      let meshes = 0
      let lights = 0
      ctx.scene.traverse((o) => {
        objects++
        if (o.isMesh || o.isInstancedMesh) meshes++
        if (o.isLight) lights++
      })
      return {
        ready: A.ready,
        frames: A.frames,
        fps: mean ? +(1000 / mean).toFixed(1) : 0,
        frameMs: { p50: +pick(0.5).toFixed(2), p95: +pick(0.95).toFixed(2), worst: +Math.max(...sorted, 0).toFixed(2) },
        drawCalls: r.render.calls,
        triangles: r.render.triangles,
        programs: r.programs ? r.programs.length : null,
        geometries: r.memory.geometries,
        textures: r.memory.textures,
        objects,
        meshes,
        lights,
        jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
        pixelRatio: ctx.renderer.getPixelRatio(),
        size: [window.innerWidth, window.innerHeight],
        camera: cameraReport(inspecting ? inspector : ctx.camera),
        inspecting,
      }
    },

    // Sample honestly over a window rather than reporting one frame. A single frame after a
    // reload is always fast; the question is whether it holds.
    async perf(ms = 3000) {
      const t0 = performance.now()
      const f0 = A.frames
      await new Promise((r) => setTimeout(r, ms))
      const dt = performance.now() - t0
      const frames = A.frames - f0
      return { seconds: +(dt / 1000).toFixed(2), frames, fps: +((frames / dt) * 1000).toFixed(1), ...A.stats() }
    },

    // ---------------------------------------------------------------- what is actually there
    // The analogue of walking the outliner. Cheap enough to call constantly; it is how you
    // check that the thing you just spawned exists, at the size and place you meant.
    describe() {
      const box = new ctx.THREE.Box3()
      const byType = {}
      const named = []
      ctx.scene.traverse((o) => {
        byType[o.type] = (byType[o.type] || 0) + 1
        if (o.name && o.parent === ctx.scene) named.push(o.name)
        if (o.isMesh && o.geometry) {
          o.geometry.computeBoundingBox?.()
          if (o.geometry.boundingBox) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
        }
      })
      const size = box.isEmpty() ? [0, 0, 0] : box.getSize(new ctx.THREE.Vector3()).toArray().map((n) => +n.toFixed(1))
      return {
        byType,
        topLevel: named.slice(0, 200),
        boundsMeters: size,
        systems: (ctx.systems || []).map((s) => s.name),
        poses: [...poses.keys()],
      }
    },

    tree(depth = 2) {
      const walk = (o, d) => ({
        name: o.name || o.type,
        type: o.type,
        children: d <= 0 ? o.children.length : o.children.slice(0, 60).map((c) => walk(c, d - 1)),
      })
      return walk(ctx.scene, depth)
    },

    // ---------------------------------------------------------------- eyes
    // A pose is a camera you can return to. Fixed poses are what make two screenshots
    // comparable — "the aerial got worse" is only a sentence if the aerial is the same shot.
    addPose(name, def) {
      poses.set(name, def)
      return name
    },
    listPoses() {
      return [...poses.entries()].map(([name, p]) => ({ name, note: p.note || '' }))
    },
    setPose(name) {
      const p = poses.get(name)
      if (!p) throw new Error(`no pose "${name}" — have: ${[...poses.keys()].join(', ') || 'none'}`)
      const at = p.position(ctx)
      const look = p.target(ctx)
      inspector.fov = p.fov || 50
      inspector.aspect = aspect()
      inspector.position.set(at[0], at[1], at[2])
      inspector.lookAt(look[0], look[1], look[2])
      inspector.updateProjectionMatrix()
      inspecting = name
      return cameraReport(inspector)
    },
    // Free look, for when a pose is not where you need to be.
    lookFrom(position, target, fov = 50) {
      inspector.fov = fov
      inspector.aspect = aspect()
      inspector.position.set(...position)
      inspector.lookAt(...target)
      inspector.updateProjectionMatrix()
      inspecting = 'free'
      return cameraReport(inspector)
    },
    releaseCamera() {
      inspecting = null
      return cameraReport(ctx.camera)
    },

    // ---------------------------------------------------------------- determinism for capture
    // A screenshot taken at devicePixelRatio 2 on one machine and 1 on another is not the same
    // measurement. Captures pin it.
    setPixelRatio(x) {
      ctx.renderer.setPixelRatio(x)
      ctx.renderer.setSize(window.innerWidth, window.innerHeight, false)
      return ctx.renderer.getPixelRatio()
    },

    pause() {
      A.paused = true
    },
    resume() {
      A.paused = false
      last = performance.now()
    },
    setTimeScale(x) {
      A.timeScale = Math.max(0, Number(x) || 0)
      return A.timeScale
    },

    // ---------------------------------------------------------------- what went wrong
    drain() {
      const out = { errors: A.errors.splice(0), logs: A.logs.splice(0), bootError: A.bootError }
      return out
    },
  })

  function cameraReport(cam) {
    const dir = new ctx.THREE.Vector3()
    cam.getWorldDirection(dir)
    return {
      position: cam.position.toArray().map((n) => +n.toFixed(1)),
      forward: dir.toArray().map((n) => +n.toFixed(3)),
      fov: cam.fov,
    }
  }

  window.addEventListener('resize', () => {
    inspector.aspect = aspect()
    inspector.updateProjectionMatrix()
  })

  return A
}
