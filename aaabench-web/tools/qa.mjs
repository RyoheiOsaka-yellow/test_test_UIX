#!/usr/bin/env node
// The instruments. Everything the running game can say about itself that is not a picture.
//
//   node tools/qa.mjs stats                     # one sample: draws, triangles, memory, fps
//   node tools/qa.mjs perf --seconds 8 --pose aerial
//   node tools/qa.mjs describe                  # what is in the scene, and how big it is
//   node tools/qa.mjs tree --depth 3
//   node tools/qa.mjs errors                    # everything the page has logged, drained
//   node tools/qa.mjs budget                    # measured against docs/workflow/metrics.md
//   node tools/qa.mjs calibrate                 # what this machine does with an empty stage
//   node tools/qa.mjs eval "window.__aaabench.describe().systems"
//
// Numbers lie in a specific way: they are all fine on an empty scene. Read them next to a
// screenshot of the same moment, never alone.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser, openGame, frameStats, parseArgs, resolveChromium, URL_DEFAULT } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = path.join(ROOT, '.harness-baseline.json')

// Every perf number is taken at this size, always. Frame cost on a software rasteriser is
// dominated by how many pixels were asked for, so a measurement whose resolution moved is a
// measurement of nothing.
const PERF_SIZE = { w: 960, h: 540 }

// Structural budgets are absolute — they describe the scene you built, not the machine you
// built it on, and they are what decides whether this world could run anywhere.
//
// Frame cost is relative on purpose. There may be no GPU under this browser; an absolute
// "60 fps" would then be either unreachable or meaningless, and tuning against it would teach
// the world nothing. `calibrate` measures what an empty stage costs on this machine, and the
// budget is how much more expensive your frame is allowed to be than that.
const BUDGET = {
  frameCostRatio: { want: 2.0, ceiling: 4.0 },
  drawCalls: { want: 900, ceiling: 2000 },
  triangles: { want: 3000000, ceiling: 8000000 },
  textures: { want: 250, ceiling: 600 },
  jsHeapMB: { want: 900, ceiling: 1800 },
}

const a = parseArgs(process.argv.slice(2))
const cmd = a._[0] || 'stats'
const perfMode = cmd === 'perf' || cmd === 'budget' || cmd === 'calibrate'

const browser = await launchBrowser()
try {
  const { page, ready, navError, boot, console: log } = await openGame(browser, {
    url: a.url || URL_DEFAULT,
    width: perfMode ? PERF_SIZE.w : Number(a.w || 1600),
    height: perfMode ? PERF_SIZE.h : Number(a.h || 900),
  })
  if (navError) {
    console.error(`cannot reach ${a.url || URL_DEFAULT}: ${navError}`)
    console.error('Is the dev server up? bin/health.sh will say.')
    process.exit(1)
  }
  if (a.pose) await page.evaluate((p) => window.__aaabench.setPose(p), a.pose).catch((e) => console.error(String(e)))

  if (cmd === 'errors') {
    const d = await page.evaluate(() => window.__aaabench.drain())
    print({ ready, bootError: d.bootError, pageErrors: d.errors, playwrightConsole: log })
  } else if (cmd === 'describe') {
    print(await page.evaluate(() => window.__aaabench.describe()))
  } else if (cmd === 'tree') {
    print(await page.evaluate((d) => window.__aaabench.tree(d), Number(a.depth || 2)))
  } else if (cmd === 'eval') {
    const src = a._.slice(1).join(' ')
    print(await page.evaluate(`(async () => { ${/\breturn\b/.test(src) ? src : 'return (' + src + ')'} })()`))
  } else if (cmd === 'calibrate') {
    if (!ready) console.error('WARNING: the page never reported a frame — calibrating against a broken build.')
    const r = await sample(page, Number(a.seconds || 6))
    const base = {
      when: new Date().toISOString(),
      chromium: resolveChromium(),
      size: PERF_SIZE,
      fps: r.fps,
      frameMsP50: r.frameMs.p50,
      note: 'empty-stage cost on this machine. budget compares against this, not against 60 fps.',
    }
    fs.writeFileSync(BASELINE, JSON.stringify(base, null, 2))
    print(base)
    console.error(`\nwritten to ${BASELINE}`)
  } else if (cmd === 'perf') {
    if (!ready) console.error('WARNING: the page never reported a frame — these numbers describe nothing.')
    print({ ...(await sample(page, Number(a.seconds || 4))), frame: await frameStats(page), baseline: readBaseline() })
  } else if (cmd === 'budget') {
    if (!ready) console.error('WARNING: the page never reported a frame — these numbers describe nothing.')
    verdict(await sample(page, Number(a.seconds || 6)), await frameStats(page))
  } else {
    const s = await page.evaluate(() => window.__aaabench.stats())
    print({ ...s, frame: await frameStats(page), bootError: boot.bootError || null })
  }
} finally {
  await browser.close()
}

async function sample(page, seconds) {
  return page.evaluate((ms) => window.__aaabench.perf(ms), seconds * 1000)
}

function readBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  } catch {
    return null
  }
}

function verdict(r, frame) {
  const base = readBaseline()
  const rows = []
  let over = false
  const judge = (label, value, spec) => {
    if (value == null) return
    const fatal = value > spec.ceiling
    over = over || fatal
    rows.push(
      `${fatal ? 'OVER  ' : value <= spec.want ? 'ok    ' : 'near  '} ${label.padEnd(14)} ${String(value).padStart(12)}   budget ${spec.want} (max ${spec.ceiling})`
    )
  }

  if (base && base.frameMsP50) {
    const ratio = +(r.frameMs.p50 / base.frameMsP50).toFixed(2)
    judge('frame cost ×', ratio, BUDGET.frameCostRatio)
    rows.push(`       ${'measured'.padEnd(14)} ${String(r.fps + ' fps').padStart(12)}   empty stage was ${base.fps} fps at ${base.size.w}x${base.size.h}`)
  } else {
    rows.push(`       ${'frame cost ×'.padEnd(14)} ${'unknown'.padStart(12)}   run: node tools/qa.mjs calibrate`)
    rows.push(`       ${'measured'.padEnd(14)} ${String(r.fps + ' fps').padStart(12)}   at ${PERF_SIZE.w}x${PERF_SIZE.h}`)
  }
  judge('drawCalls', r.drawCalls, BUDGET.drawCalls)
  judge('triangles', r.triangles, BUDGET.triangles)
  judge('textures', r.textures, BUDGET.textures)
  judge('jsHeapMB', r.jsHeapMB, BUDGET.jsHeapMB)

  console.log(rows.join('\n'))
  console.log(`\nframe: ${frame.verdict}`)
  console.log(
    frame.distinctColors <= 2
      ? 'The budget held on a frame with nothing in it. That is not a pass — go and look at the shot.'
      : over
        ? 'Over budget. Performance is part of the artifact, not a pass at the end.'
        : 'Within budget at this moment, at this camera. Check it again when the world is fuller and the camera is somewhere worse.'
  )
  process.exit(over ? 1 : 0)
}

function print(o) {
  console.log(JSON.stringify(o, null, 2))
}
