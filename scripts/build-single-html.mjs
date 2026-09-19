/**
 * Vite のビルド結果を1つの HTML にまとめる（JS / CSS / デモ動画 / 追跡結果を埋め込み）。
 *   npm run build:single  →  dist/jev-visual-inspection.html
 * public/demo/<プロファイル>/ にある video.mp4（無ければ video.webm）、detections.json、
 * CREDIT.txt をプロファイルごとに埋め込む。サーバー不要でそのまま開ける。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const dist = join(root, 'dist')
let html = readFileSync(join(dist, 'index.html'), 'utf8')
const assets = join(dist, 'assets')

for (const file of readdirSync(assets)) {
  const content = readFileSync(join(assets, file), 'utf8')
  if (file.endsWith('.js')) {
    const safe = content.replace(/<\/script/gi, '<\\/script')
    html = html.replace(new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`), () => `<script type="module">\n${safe}\n</script>`)
  } else if (file.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`), () => `<style>\n${content}\n</style>`)
  }
}
html = html.replace(/<link rel="icon"[^>]*>\s*/, '')

// プロファイルごとのデモ資産
const demoRoot = join(root, 'public/demo')
const profiles = {}
let embeddedBytes = 0
if (existsSync(demoRoot)) {
  for (const dir of readdirSync(demoRoot)) {
    const p = join(demoRoot, dir)
    if (!statSync(p).isDirectory()) continue
    const entry = {}
    const video = [
      ['video.mp4', 'video/mp4'],
      ['video.webm', 'video/webm'],
    ].find(([f]) => existsSync(join(p, f)))
    if (video) {
      const buf = readFileSync(join(p, video[0]))
      entry.videoDataUrl = `data:${video[1]};base64,${buf.toString('base64')}`
      embeddedBytes += buf.length
    }
    if (existsSync(join(p, 'detections.json'))) entry.detections = JSON.parse(readFileSync(join(p, 'detections.json'), 'utf8'))
    if (existsSync(join(p, 'CREDIT.txt'))) entry.videoCredit = readFileSync(join(p, 'CREDIT.txt'), 'utf8').trim().split('\n')[0]
    if (Object.keys(entry).length) profiles[dir] = entry
  }
}
if (Object.keys(profiles).length) {
  const json = JSON.stringify({ profiles }).replace(/<\/script/gi, '<\\/script')
  html = html.replace('<script type="module">', () => `<script>window.__JEV_EMBEDDED__=${json}</script>\n<script type="module">`)
}

writeFileSync(join(dist, 'jev-visual-inspection.html'), html)

// Artifact 用: 本文のみ（ホスト側が文書の骨組みを付与する）
const inner = html
  .replace(/^[\s\S]*?<head>/, '')
  .replace(/<\/head>\s*<body>/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta[^>]*>\s*/g, '')
writeFileSync(join(dist, 'jev-visual-inspection.artifact.html'), inner)
console.log(
  'wrote dist/jev-visual-inspection.html (%d KB) · profiles: %s · video bytes %d KB',
  Math.round(html.length / 1024),
  Object.keys(profiles).join(', ') || 'none',
  Math.round(embeddedBytes / 1024),
)
