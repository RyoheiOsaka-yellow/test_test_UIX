#!/usr/bin/env node
// The control surface.
//
// One long-lived headless browser attached to the running game, exposed over MCP. The agent
// gets eyes (captures from named poses), instruments (frame cost, draw calls, what is in the
// scene), a console, a way to run arbitrary code inside the page, and a way to play it.
//
// Two decisions worth knowing about, because they shape how it feels to use:
//
//   1. Images are returned as PATHS, never inline. A 1600x900 PNG is ~1.5 MB of base64; at the
//      rate this loop wants to look at things, inlining them would eat the context in an hour.
//      Read the file instead — you have a Read tool and it sees images.
//   2. The page is persistent. State you build up in it (a spawned actor, a paused clock, a
//      pose you added) survives between calls, exactly like an editor session. `reload` is how
//      you throw that away deliberately, rather than having every call throw it away for you.
//
// Started by the harness, not by hand: bin/run-agent.sh writes the .mcp.json that launches this
// over stdio. `node mcp/server.mjs --selftest` checks it can reach the game and exits.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import { launchBrowser, openGame, frameStats, ensureQaDir, QA_DIR, URL_DEFAULT } from '../tools/lib/browser.mjs'

let browser = null
let page = null
let consoleLog = []

async function ensurePage(force = false) {
  if (force && browser) {
    await browser.close().catch(() => {})
    browser = null
    page = null
  }
  if (page && !page.isClosed()) {
    // A dev-server restart leaves the page alive but blank; the sensors are the tell.
    const alive = await page.evaluate(() => !!window.__aaabench).catch(() => false)
    if (alive) return page
  }
  if (!browser) browser = await launchBrowser()
  const opened = await openGame(browser, { url: URL_DEFAULT, width: 1600, height: 900 })
  page = opened.page
  consoleLog = opened.console
  if (opened.navError) throw new Error(`cannot reach ${URL_DEFAULT}: ${opened.navError} — is the dev server up? (bin/health.sh)`)
  if (!opened.ready) {
    const detail = opened.boot?.bootError ? `boot error: ${opened.boot.bootError}` : 'no rendered frame yet'
    // Not fatal. A page that never renders is exactly the thing you need to inspect.
    consoleLog.push({ level: 'warn', text: `page opened but never reported ready (${detail})` })
  }
  return page
}

const text = (s) => ({ content: [{ type: 'text', text: typeof s === 'string' ? s : JSON.stringify(s, null, 2) }] })

async function withPage(fn) {
  try {
    return await fn(await ensurePage())
  } catch (e) {
    // One retry on a fresh browser: a crashed renderer and a restarted dev server both look
    // like this, and both are fixed by reconnecting rather than by the agent debugging them.
    try {
      return await fn(await ensurePage(true))
    } catch (e2) {
      return text(`FAILED: ${e2.message || e2}\n(first attempt: ${e.message || e})`)
    }
  }
}

async function settle(p, ms = 300) {
  await p.evaluate(() => window.__aaabench.waitFrames(3)).catch(() => {})
  if (ms) await p.waitForTimeout(ms)
  await p.evaluate(() => window.__aaabench.waitFrames(2)).catch(() => {})
}

async function report(p, file) {
  const [f, s, drained] = await Promise.all([
    frameStats(p),
    p.evaluate(() => window.__aaabench.stats()).catch(() => ({})),
    p.evaluate(() => window.__aaabench.drain()).catch(() => ({ errors: [] })),
  ])
  const errs = [...(drained.errors || []), ...consoleLog.filter((l) => l.level === 'error')].slice(0, 10)
  consoleLog = []
  return [
    file ? `${file}  (${(fs.statSync(file).size / 1024).toFixed(0)} KB)` : null,
    file ? 'Read that file to SEE it. Judge it the way a stranger would.' : null,
    `frame: ${f.verdict}  (luma ${f.meanLuma}, sd ${f.stdDev}, ${f.distinctColors} colours)`,
    `scene: ${s.drawCalls} draws · ${s.triangles?.toLocaleString?.('en-US')} tris · ${s.meshes} meshes · ${s.textures} textures · ${s.fps} fps`,
    s.camera ? `camera: ${s.inspecting || 'game camera'} at ${s.camera.position?.join(', ')} fov ${s.camera.fov}` : null,
    errs.length ? `errors:\n${errs.map((e) => '  ' + e.text).join('\n')}` : 'no errors since the last look',
  ]
    .filter(Boolean)
    .join('\n')
}

const server = new McpServer({ name: 'agentcity', version: '1.0.0' })

server.registerTool(
  'viewport_capture',
  {
    title: 'Capture the viewport',
    description:
      'Photograph the running game and write a PNG to ' +
      QA_DIR +
      '. Give a pose name, or an explicit camera with from/to. Returns the file path plus what the frame and the scene measured — Read the file to actually see it.',
    inputSchema: {
      name: z.string().describe('file name, without extension'),
      pose: z.string().optional().describe('a registered pose (viewport_poses lists them)'),
      from: z.array(z.number()).length(3).optional().describe('camera position [x,y,z] in metres'),
      to: z.array(z.number()).length(3).optional().describe('look-at target [x,y,z]'),
      fov: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      settleMs: z.number().optional().describe('wait before the shot; raise it when things stream in late'),
    },
  },
  async ({ name, pose, from, to, fov, width, height, settleMs }) =>
    withPage(async (p) => {
      if (width || height) await p.setViewportSize({ width: width || 1600, height: height || 900 })
      if (from) await p.evaluate(([f, t, v]) => window.__aaabench.lookFrom(f, t, v), [from, to || [0, 0, 0], fov || 50])
      else if (pose) await p.evaluate((x) => window.__aaabench.setPose(x), pose)
      await settle(p, settleMs ?? 300)
      ensureQaDir()
      const file = path.join(QA_DIR, `${name.replace(/[^\w.-]/g, '_')}.png`)
      await p.screenshot({ path: file })
      return text(await report(p, file))
    })
)

server.registerTool(
  'viewport_poses',
  {
    title: 'List / add camera poses',
    description:
      'Poses are fixed cameras you can return to; two shots of the same pose are comparable, two free-hand shots are not. Add one per district or landmark you keep re-checking.',
    inputSchema: {
      add: z
        .object({ name: z.string(), from: z.array(z.number()).length(3), to: z.array(z.number()).length(3), fov: z.number().optional(), note: z.string().optional() })
        .optional(),
    },
  },
  async ({ add }) =>
    withPage(async (p) => {
      if (add)
        await p.evaluate((d) => {
          window.__aaabench.addPose(d.name, { note: d.note || '', fov: d.fov || 50, position: () => d.from, target: () => d.to })
        }, add)
      return text(await p.evaluate(() => window.__aaabench.listPoses()))
    })
)

server.registerTool(
  'scene_describe',
  {
    title: 'What is in the scene',
    description: 'Object counts by type, top-level names, world bounds in metres, running systems, registered poses. The cheap check that what you just built exists, at the size you meant.',
    inputSchema: { tree: z.boolean().optional().describe('also return the scene graph'), depth: z.number().optional() },
  },
  async ({ tree, depth }) =>
    withPage(async (p) => {
      const d = await p.evaluate(() => window.__aaabench.describe())
      if (tree) d.tree = await p.evaluate((n) => window.__aaabench.tree(n), depth || 2)
      return text(d)
    })
)

server.registerTool(
  'perf_sample',
  {
    title: 'Measure the frame',
    description:
      'Sample frame cost over a window at a fixed 960x540, plus draw calls, triangles, textures and heap. Frame cost is only meaningful against the empty-stage baseline (bin/setup-capabilities.sh writes one) — the structural numbers are absolute.',
    inputSchema: { seconds: z.number().optional(), pose: z.string().optional() },
  },
  async ({ seconds, pose }) =>
    withPage(async (p) => {
      await p.setViewportSize({ width: 960, height: 540 })
      if (pose) await p.evaluate((x) => window.__aaabench.setPose(x), pose)
      const r = await p.evaluate((ms) => window.__aaabench.perf(ms), (seconds || 5) * 1000)
      let baseline = null
      try {
        baseline = JSON.parse(fs.readFileSync(new URL('../.harness-baseline.json', import.meta.url), 'utf8'))
      } catch {}
      const ratio = baseline?.frameMsP50 ? +(r.frameMs.p50 / baseline.frameMsP50).toFixed(2) : null
      await p.setViewportSize({ width: 1600, height: 900 })
      return text({ ...r, baseline, frameCostVsEmptyStage: ratio, budget: 'want ≤2.0×, ceiling 4.0×' })
    })
)

server.registerTool(
  'console_drain',
  {
    title: 'Read and clear the console',
    description: 'Everything the page has logged since the last drain: errors, warnings, logs, failed requests, and any error thrown during boot.',
    inputSchema: {},
  },
  async () =>
    withPage(async (p) => {
      const d = await p.evaluate(() => window.__aaabench.drain())
      const out = { bootError: d.bootError || null, errors: d.errors, logs: d.logs.slice(-60), transport: consoleLog }
      consoleLog = []
      return text(out)
    })
)

server.registerTool(
  'eval_js',
  {
    title: 'Run code inside the running game',
    description:
      'Evaluate JavaScript in the page and return the result as JSON. The live scene is at window.__aaabench and whatever your code exposes. This is the scripting surface: spawn something, move it, measure it, delete it, without a reload.',
    inputSchema: { code: z.string().describe('a JS expression, or statements ending in a return') },
  },
  async ({ code }) =>
    withPage(async (p) => {
      const wrapped = `(async () => { ${/\breturn\b/.test(code) ? code : `return (${code})`} })()`
      try {
        const r = await p.evaluate(wrapped)
        return text(r === undefined ? 'undefined' : r)
      } catch (e) {
        return text(`threw: ${e.message || e}`)
      }
    })
)

server.registerTool(
  'play',
  {
    title: 'Play it',
    description:
      'Drive the game with real input on the game camera, capture frames as you go, and report whether input changed anything. Steps: {"key":"w","hold":4} {"mouse":[dx,dy]} {"click":[x,y]} {"wait":2} {"shot":"name"}.',
    inputSchema: { name: z.string().optional(), steps: z.array(z.record(z.any())).optional(), seconds: z.number().optional() },
  },
  async ({ name, steps, seconds }) =>
    withPage(async (p) => {
      const label = (name || 'play').replace(/[^\w.-]/g, '_')
      const script = steps?.length
        ? steps
        : [{ shot: 'open' }, { key: 'w', hold: Math.max(1, (seconds || 10) / 4) }, { shot: 'walked' }, { mouse: [400, 0] }, { shot: 'turned' }]
      ensureQaDir()
      await p.evaluate(() => window.__aaabench.releaseCamera()).catch(() => {})
      await p.click('canvas', { position: { x: 800, y: 450 } }).catch(() => {})
      const before = await p.evaluate(() => window.__aaabench.stats()).catch(() => ({}))
      const shots = []
      let i = 0
      for (const s of script) {
        if (s.key && s.hold) {
          await p.keyboard.down(s.key)
          await p.waitForTimeout(s.hold * 1000)
          await p.keyboard.up(s.key)
        } else if (s.key) {
          await p.keyboard.press(s.key)
          await p.waitForTimeout(150)
        } else if (s.mouse) {
          for (let k = 0; k < 24; k++) {
            await p.mouse.move(800 + (s.mouse[0] * (k + 1)) / 24, 450 + (s.mouse[1] * (k + 1)) / 24)
            await p.waitForTimeout(16)
          }
        } else if (s.click) {
          await p.mouse.click(s.click[0], s.click[1])
          await p.waitForTimeout(400)
        } else if (s.wait) {
          await p.waitForTimeout(s.wait * 1000)
        } else if (s.shot) {
          const file = path.join(QA_DIR, `${label}-${String(++i).padStart(2, '0')}-${String(s.shot).replace(/[^\w.-]/g, '_')}.png`)
          await p.screenshot({ path: file })
          shots.push(file)
        }
      }
      const after = await p.evaluate(() => window.__aaabench.stats()).catch(() => ({}))
      const d = (a, b) => (a && b ? Math.hypot(...a.map((v, k) => v - b[k])) : 0)
      const moved = d(before.camera?.position, after.camera?.position)
      const turned = d(before.camera?.forward, after.camera?.forward)
      return text(
        [
          shots.length ? shots.join('\n') : '(no shots requested)',
          `camera moved ${moved.toFixed(1)}m, turned ${turned.toFixed(3)}`,
          moved < 0.5 && turned < 0.01 ? 'input changed NOTHING — nothing is listening, or what listens does not drive the camera' : '',
          await report(p, null),
        ]
          .filter(Boolean)
          .join('\n')
      )
    })
)

server.registerTool(
  'reload',
  {
    title: 'Reload the page',
    description: 'Throw away page state and boot the game again — after a change the dev server could not hot-reload, or to check that a cold start still works. Reports whether it came back.',
    inputSchema: {},
  },
  async () =>
    withPage(async (p) => {
      await p.reload({ waitUntil: 'domcontentloaded' })
      const ok = await p
        .waitForFunction(() => window.__aaabench && window.__aaabench.ready, null, { timeout: 90000, polling: 250 })
        .then(() => true)
        .catch(() => false)
      return text(`${ok ? 'reloaded and rendering' : 'RELOADED BUT NEVER RENDERED A FRAME'}\n${await report(p, null)}`)
    })
)

if (process.argv.includes('--selftest')) {
  const p = await ensurePage()
  console.log(await report(p, null))
  await browser?.close()
  process.exit(0)
}

await server.connect(new StdioServerTransport())
process.on('SIGTERM', async () => {
  await browser?.close().catch(() => {})
  process.exit(0)
})
