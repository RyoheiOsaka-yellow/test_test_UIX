#!/usr/bin/env node
// The agent's eyes.
//
//   node tools/viewport.mjs shot street                      # a named pose
//   node tools/viewport.mjs shot block-a --from 120,60,-90 --to 0,8,0 --fov 40
//   node tools/viewport.mjs sweep morning                    # every pose, one file each
//   node tools/viewport.mjs poses                            # what poses exist
//   node tools/viewport.mjs diff /tmp/aaabench_qa/a.png /tmp/aaabench_qa/b.png
//
// Files land in /tmp/aaabench_qa/<name>.png and the path is printed. The image is NOT returned
// inline: a base64 PNG in the transcript costs thousands of tokens per look and you need to look
// constantly. Read the file instead.
//
// Every shot is judged before it is handed over — flat frames, boot errors and console noise are
// reported with the path, because a screenshot you did not check is a screenshot that can lie.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { launchBrowser, openGame, frameStats, ensureQaDir, parseArgs, vec, QA_DIR, URL_DEFAULT } from './lib/browser.mjs'

const a = parseArgs(process.argv.slice(2))
const cmd = a._[0]

if (!cmd || cmd === 'help') {
  console.log(fs.readFileSync(new URL(import.meta.url).pathname, 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'))
  process.exit(cmd ? 0 : 2)
}

if (cmd === 'diff') {
  diff(a._[1], a._[2])
} else {
  const browser = await launchBrowser()
  try {
    const width = Number(a.w || 1600)
    const height = Number(a.h || 900)
    const { page, ready, navError, boot, console: log } = await openGame(browser, { url: a.url || URL_DEFAULT, width, height })

    if (navError) fail(`could not open ${a.url || URL_DEFAULT} — ${navError}\nIs the dev server up? bin/health.sh will say.`)
    if (!boot.present) fail('the page loaded but window.__aaabench is missing. index.html lost its sensor stub.')
    if (!ready) {
      console.log('NOT READY — the page never reported a rendered frame.')
      if (boot.bootError) console.log(`boot error: ${boot.bootError}`)
      for (const e of boot.errors || []) console.log(`  ${e.level}: ${e.text}`)
      for (const e of log.filter((l) => l.level === 'error').slice(0, 10)) console.log(`  console ${e.level}: ${e.text}`)
    }

    if (cmd === 'poses') {
      console.log(JSON.stringify(await page.evaluate(() => window.__aaabench.listPoses()), null, 2))
    } else if (cmd === 'shot') {
      const name = a._[1] || 'shot'
      await aim(page, a, name)
      await settle(page, Number(a.wait || 400))
      await write(page, name, log)
    } else if (cmd === 'sweep') {
      const prefix = a._[1] || 'sweep'
      const poses = a.poses ? String(a.poses).split(',') : (await page.evaluate(() => window.__aaabench.listPoses())).map((p) => p.name)
      for (const pose of poses) {
        await page.evaluate((p) => window.__aaabench.setPose(p), pose)
        await settle(page, Number(a.wait || 400))
        await write(page, `${prefix}-${pose}`, log)
      }
    } else fail(`unknown command "${cmd}"`)
  } finally {
    await browser.close()
  }
}

async function aim(page, a, name) {
  const from = vec(a.from)
  if (from) {
    const to = vec(a.to, [0, 0, 0])
    await page.evaluate(([f, t, fov]) => window.__aaabench.lookFrom(f, t, fov), [from, to, Number(a.fov || 50)])
    return
  }
  const pose = a.pose || name
  const has = await page.evaluate((p) => window.__aaabench.listPoses().some((x) => x.name === p), pose)
  if (has) await page.evaluate((p) => window.__aaabench.setPose(p), pose)
  else if (a.pose) fail(`no pose "${pose}". Have: ${(await page.evaluate(() => window.__aaabench.listPoses())).map((p) => p.name).join(', ')}`)
  // else: no pose asked for and none matches the filename — shoot whatever the game camera sees,
  // which is the right default when the game has a camera of its own.
}

// Let the frame finish before photographing it. Streaming, lazy textures and one-shot layout
// passes all land a frame or two late, and a shot taken too early is a photograph of the loading
// state that reads as a broken build.
async function settle(page, ms) {
  await page.evaluate(() => window.__aaabench.waitFrames(3))
  if (ms > 0) await page.waitForTimeout(ms)
  await page.evaluate(() => window.__aaabench.waitFrames(2))
}

async function write(page, name, log) {
  ensureQaDir()
  const file = path.join(QA_DIR, `${name.replace(/[^\w.-]/g, '_')}.png`)
  await page.screenshot({ path: file })
  const fs_ = await frameStats(page)
  const stats = await page.evaluate(() => window.__aaabench.stats()).catch(() => ({}))
  const drained = await page.evaluate(() => window.__aaabench.drain()).catch(() => ({ errors: [] }))
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`${file}  (${kb} KB, ${stats.size ? stats.size.join('x') : '?'})`)
  console.log(`  frame: ${fs_.verdict}  luma ${fs_.meanLuma} sd ${fs_.stdDev} colours ${fs_.distinctColors}`)
  console.log(`  scene: ${stats.drawCalls} draws, ${fmt(stats.triangles)} tris, ${stats.meshes} meshes, ${stats.textures} textures, ${stats.fps} fps`)
  if (stats.camera) console.log(`  camera: at ${stats.camera.position?.join(', ')} fov ${stats.camera.fov} (${stats.inspecting || 'game camera'})`)
  const errs = [...(drained.errors || []), ...log.filter((l) => l.level === 'error')].slice(0, 8)
  for (const e of errs) console.log(`  ERROR ${e.text}`)
  log.length = 0
  console.log('  Read this file to SEE it. Judge it the way a stranger would, not the way its author would.')
}

function diff(x, y) {
  if (!x || !y) fail('diff needs two paths')
  try {
    const r = execFileSync('magick', ['compare', '-metric', 'RMSE', x, y, path.join(QA_DIR, 'diff.png')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    console.log(`RMSE: ${r} -> ${path.join(QA_DIR, 'diff.png')}`)
  } catch (e) {
    const out = (e.stderr || '').toString().trim()
    if (out && /\d/.test(out)) console.log(`RMSE: ${out}  ->  ${path.join(QA_DIR, 'diff.png')}`)
    else {
      const [sx, sy] = [fs.statSync(x).size, fs.statSync(y).size]
      console.log(`no ImageMagick — byte sizes only: ${sx} vs ${sy} (delta ${sy - sx >= 0 ? '+' : ''}${sy - sx})`)
    }
  }
}

// Function declarations, not consts: everything above runs under top-level await, before a
// `const` at the bottom of the module has been initialised. A helper defined with `const` down
// here throws "cannot access before initialization" on the very first shot.
function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : n
}
function fail(msg) {
  console.error(msg)
  process.exit(1)
}
