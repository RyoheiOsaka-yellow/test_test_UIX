#!/usr/bin/env node
// Play-in-editor. The only tool here that touches the game the way a person would.
//
//   node tools/play.mjs                                  # default session: walk, look, capture
//   node tools/play.mjs --seconds 30 --shots 6
//   node tools/play.mjs --script '[{"key":"w","hold":4},{"mouse":[300,0]},{"click":[800,450]},{"key":"m"}]'
//   node tools/play.mjs --script session.json --keep-open
//
// Steps run in order:
//   {"key":"w","hold":4}     hold a key for N seconds        {"key":"Escape"} taps it
//   {"mouse":[dx,dy]}        move the pointer, for mouse-look (pointer lock included)
//   {"click":[x,y]}          click at viewport coordinates — this is how menus get tested
//   {"wait":2}               do nothing for N seconds
//   {"shot":"name"}          capture right here
//
// It reports three things the numbers cannot: whether input moved anything, whether the frame
// changed while you played, and what the page logged while you were in there. A game where the
// camera never moves and the pixels never change is not a game yet, however clean the console is.

import path from 'node:path'
import fs from 'node:fs'
import { launchBrowser, openGame, frameStats, ensureQaDir, parseArgs, QA_DIR, URL_DEFAULT } from './lib/browser.mjs'

const a = parseArgs(process.argv.slice(2))
const seconds = Number(a.seconds || 15)
const shots = Number(a.shots || 4)
const name = a.name || 'play'

const script = a.script
  ? JSON.parse(fs.existsSync(a.script) ? fs.readFileSync(a.script, 'utf8') : a.script)
  : defaultSession(seconds, shots)

const browser = await launchBrowser()
const { page, ready, navError, boot, console: log } = await openGame(browser, {
  url: a.url || URL_DEFAULT,
  width: Number(a.w || 1280),
  height: Number(a.h || 720),
  capture: false, // play at the real pixel ratio; this is the experience, not a measurement
})
if (navError) {
  console.error(`cannot reach ${a.url || URL_DEFAULT}: ${navError}`)
  process.exit(1)
}
if (!ready) {
  console.log('NOT READY — the page never reported a rendered frame. Playing anyway; expect nothing.')
  if (boot.bootError) console.log(`boot error: ${boot.bootError}`)
}

ensureQaDir()
await page.evaluate(() => window.__aaabench.releaseCamera()).catch(() => {}) // play through the GAME camera
await page.mouse.move(640, 360)
await page.click('canvas', { position: { x: 640, y: 360 } }).catch(() => {}) // most games want a click to take input

const before = await snapshot(page)
const startFrames = before.frames
const t0 = Date.now()
let n = 0

for (const step of script) {
  if (step.key !== undefined) {
    if (step.hold) {
      await page.keyboard.down(step.key)
      await page.waitForTimeout(step.hold * 1000)
      await page.keyboard.up(step.key)
    } else {
      await page.keyboard.press(step.key)
      await page.waitForTimeout(150)
    }
  } else if (step.mouse) {
    const [dx, dy] = step.mouse
    const steps = 24
    for (let i = 0; i < steps; i++) {
      await page.mouse.move(640 + (dx * (i + 1)) / steps, 360 + (dy * (i + 1)) / steps)
      await page.waitForTimeout(16)
    }
  } else if (step.click) {
    await page.mouse.click(step.click[0], step.click[1])
    await page.waitForTimeout(400)
  } else if (step.wait) {
    await page.waitForTimeout(step.wait * 1000)
  } else if (step.shot) {
    const file = path.join(QA_DIR, `${name}-${String(++n).padStart(2, '0')}-${step.shot}.png`)
    await page.screenshot({ path: file })
    const f = await frameStats(page)
    console.log(`${file}  ${f.verdict}  (luma ${f.meanLuma}, colours ${f.distinctColors})`)
  }
}

const after = await snapshot(page)
const secs = (Date.now() - t0) / 1000
const moved = dist(before.camera?.position, after.camera?.position)
const turned = dist(before.camera?.forward, after.camera?.forward)
const drained = await page.evaluate(() => window.__aaabench.drain()).catch(() => ({ errors: [] }))

console.log('')
console.log(`played ${secs.toFixed(1)}s, ${after.frames - startFrames} frames, ${(((after.frames - startFrames) / secs) || 0).toFixed(1)} fps average`)
console.log(`camera moved ${moved.toFixed(1)}m and turned ${turned.toFixed(3)} over the session`)
if (moved < 0.5 && turned < 0.01) {
  console.log('  input changed NOTHING. Either nothing is listening, or what listens is not driving the camera.')
}
console.log(`draws ${after.drawCalls}, tris ${after.triangles}, heap ${after.jsHeapMB ?? '?'}MB`)
const errs = [...(drained.errors || []), ...log.filter((l) => l.level === 'error')]
if (errs.length) {
  console.log(`${errs.length} error(s) during play:`)
  for (const e of errs.slice(0, 12)) console.log(`  ${e.text}`)
} else console.log('no errors logged during play')
console.log(`shots: ${QA_DIR}/${name}-*.png — Read them. A session you did not watch is a session you did not run.`)

if (!a['keep-open']) await browser.close()

function defaultSession(seconds, shots) {
  // Enough to find out whether this is a game: does it start, does it accept input, does the
  // view change, does anything happen while you stand still.
  const unit = Math.max(1, Math.floor(seconds / 6))
  const s = [{ shot: 'open' }, { wait: 1 }, { shot: 'idle' }]
  s.push({ key: 'w', hold: unit }, { shot: 'walked' })
  s.push({ mouse: [400, 0] }, { shot: 'turned' })
  s.push({ key: 'w', hold: unit }, { key: 'Space' }, { shot: 'jumped' })
  s.push({ key: 'm' }, { wait: 1 }, { shot: 'map-key' })
  s.push({ key: 'Escape' }, { wait: 1 }, { shot: 'escape-key' })
  while (s.filter((x) => x.shot).length > shots + 2) s.splice(s.findIndex((x) => x.shot === 'idle'), 1)
  return s
}

async function snapshot(page) {
  return page.evaluate(() => window.__aaabench.stats()).catch(() => ({}))
}

function dist(a, b) {
  if (!a || !b) return 0
  return Math.hypot(...a.map((v, i) => v - b[i]))
}
