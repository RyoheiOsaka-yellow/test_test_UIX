/**
 * Vite のビルド結果を1つの HTML にまとめる（JS / CSS / デモ動画 / 追跡結果を埋め込み）。
 *   npm run build:single  →  dist/jev-visual-inspection.html
 * サーバー不要でそのまま開ける。動画は public/demo/bottling-line.mp4 があれば
 * data URI として埋め込む（無ければ合成映像で動く）。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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

// デモ資産の埋め込み
const embedded = {}
const videoCandidates = [
  ['public/demo/bottling-line.mp4', 'video/mp4'],
  ['public/demo/bottling-line.webm', 'video/webm'],
]
const video = videoCandidates.map(([p, mime]) => [join(root, p), mime]).find(([p]) => existsSync(p))
if (video) {
  const [videoPath, mime] = video
  embedded.videoDataUrl = `data:${mime};base64,${readFileSync(videoPath).toString('base64')}`
  const creditPath = join(root, 'public/demo/CREDIT.txt')
  if (existsSync(creditPath)) embedded.videoCredit = readFileSync(creditPath, 'utf8').trim().split('\n')[0]
}
const detPath = join(root, 'public/demo/detections.json')
if (existsSync(detPath)) embedded.detections = JSON.parse(readFileSync(detPath, 'utf8'))
if (Object.keys(embedded).length) {
  const json = JSON.stringify(embedded).replace(/<\/script/gi, '<\\/script')
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
console.log('wrote dist/jev-visual-inspection.html (%d KB)%s', Math.round(html.length / 1024), embedded.videoDataUrl ? ' with embedded video' : '')
