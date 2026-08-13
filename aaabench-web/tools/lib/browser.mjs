// One place that knows how to get a browser onto the running game, because three tools and an
// MCP server all need exactly the same thing and any drift between them shows up as
// "the screenshot tool sees a different world than the perf tool", which is a very expensive
// hour to debug.

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

export const QA_DIR = process.env.AAABENCH_QA_DIR || '/tmp/aaabench_qa'
export const PORT = process.env.AAABENCH_PORT || '5173'
export const URL_DEFAULT = process.env.AAABENCH_URL || `http://127.0.0.1:${PORT}/`

// Playwright resolves its browser by build number, so a browser installed for a different
// Playwright version is invisible to it — executablePath() then returns a path that does not
// exist and launch() fails with a "run playwright install" message that is wrong here, because
// a perfectly good Chromium is sitting on disk. Look for it.
export function resolveChromium() {
  const tried = []
  const ok = (p) => {
    tried.push(p)
    try {
      return p && fs.existsSync(p) && fs.statSync(p).isFile() ? p : null
    } catch {
      return null
    }
  }
  if (process.env.AAABENCH_CHROMIUM) {
    const p = ok(process.env.AAABENCH_CHROMIUM)
    if (p) return p
  }
  try {
    const p = ok(chromium.executablePath())
    if (p) return p
  } catch {}
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', `${process.env.HOME}/.cache/ms-playwright`].filter(Boolean)
  for (const root of roots) {
    let entries = []
    try {
      entries = fs.readdirSync(root)
    } catch {
      continue
    }
    for (const e of entries.filter((e) => e.startsWith('chromium')).sort().reverse()) {
      for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = ok(path.join(root, e, sub))
        if (p) return p
      }
    }
    const bare = ok(path.join(root, 'chromium'))
    if (bare) return bare
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) if (ok(p)) return p
  throw new Error(`no Chromium found. Set AAABENCH_CHROMIUM. Looked at:\n  ${tried.join('\n  ')}`)
}

// SwiftShader, deliberately. There is no GPU here, and a run whose frame budget was measured on
// a software rasteriser is still a real measurement as long as every run is measured the same
// way — what it is not is a claim about a gaming PC. Say which one you ran when you report.
export const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--mute-audio',
  '--hide-scrollbars',
]

export async function launchBrowser(opts = {}) {
  return chromium.launch({ executablePath: resolveChromium(), args: LAUNCH_ARGS, ...opts })
}

// Open the game and wait for it to say it is up. The timeout is generous because a world that
// streams 300 MB of geometry is slow, not broken — but it always returns, with whatever the page
// managed to say about itself, so a hang is reported rather than hung on.
export async function openGame(browser, { url = URL_DEFAULT, width = 1600, height = 900, capture = true, timeout = 90000 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const console_ = []
  page.on('console', (m) => console_.push({ level: m.type(), text: m.text().slice(0, 2000) }))
  page.on('pageerror', (e) => console_.push({ level: 'error', text: String(e).slice(0, 2000) }))
  page.on('requestfailed', (r) => console_.push({ level: 'warn', text: `request failed: ${r.url()} (${r.failure()?.errorText})` }))

  const target = capture ? withParam(url, 'capture', '1') : url
  let navError = null
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 })
  } catch (e) {
    navError = String(e).split('\n')[0]
  }

  let ready = false
  if (!navError) {
    try {
      await page.waitForFunction(() => window.__aaabench && window.__aaabench.ready, null, { timeout, polling: 250 })
      ready = true
    } catch {
      ready = false
    }
  }

  const boot = await page
    .evaluate(() => ({
      present: !!window.__aaabench,
      ready: !!(window.__aaabench && window.__aaabench.ready),
      bootError: window.__aaabench && window.__aaabench.bootError,
      errors: (window.__aaabench && window.__aaabench.errors || []).slice(-20),
    }))
    .catch(() => ({ present: false }))

  return { page, console: console_, ready, navError, boot }
}

function withParam(url, k, v) {
  const u = new global.URL(url)
  u.searchParams.set(k, v)
  return u.toString()
}

// Is this screenshot showing anything at all?
//
// The most expensive failure in this loop is a tool that cheerfully writes a 40 KB PNG of a
// uniform grey void while the agent reads the filename and believes a city is there. Sampling
// the frame costs milliseconds and turns that into a sentence.
export async function frameStats(page) {
  return page.evaluate(() => {
    const src = document.querySelector('canvas')
    if (!src) return { error: 'no canvas' }
    const w = 160
    const h = Math.max(1, Math.round((src.height / src.width) * w))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    g.drawImage(src, 0, 0, w, h)
    const d = g.getImageData(0, 0, w, h).data
    let sum = 0
    let sum2 = 0
    const seen = new Set()
    const n = w * h
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255
      sum += l
      sum2 += l * l
      seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4))
    }
    const mean = sum / n
    const variance = Math.max(0, sum2 / n - mean * mean)
    return {
      meanLuma: +mean.toFixed(3),
      stdDev: +Math.sqrt(variance).toFixed(3),
      distinctColors: seen.size,
      verdict:
        seen.size <= 2 ? 'FLAT — one colour. Nothing is being drawn, or the camera is inside something.' :
        Math.sqrt(variance) < 0.02 ? 'NEARLY FLAT — almost no contrast. Suspect empty sky, fog, or an unlit scene.' :
        'has content',
    }
  })
}

export function ensureQaDir() {
  fs.mkdirSync(QA_DIR, { recursive: true })
  return QA_DIR
}

export function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      out[k] = v !== undefined ? v : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
    } else out._.push(a)
  }
  return out
}

export const vec = (s, fallback = null) => (typeof s === 'string' ? s.split(',').map(Number) : fallback)
