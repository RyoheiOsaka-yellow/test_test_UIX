/**
 * Bundles the Vite build into one self-contained HTML file (JS + CSS inlined).
 *   npm run build:single  →  dist/jev-visual-inspection.html
 * Open the file directly in a browser; no server needed. Google Fonts are still
 * loaded from the network when available (system monospace fallback otherwise).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
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
// Favicon is a separate file; drop the link so the standalone page has no dangling reference.
html = html.replace(/<link rel="icon"[^>]*>\s*/, '')

writeFileSync(join(dist, 'jev-visual-inspection.html'), html)

// Artifact variant: body-only fragment (the artifact host supplies the document skeleton).
const inner = html.replace(/^[\s\S]*?<head>/, '').replace(/<\/head>\s*<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta[^>]*>\s*/g, '')
writeFileSync(join(dist, 'jev-visual-inspection.artifact.html'), inner)
console.log('wrote dist/jev-visual-inspection.html (%d KB)', Math.round(html.length / 1024))
