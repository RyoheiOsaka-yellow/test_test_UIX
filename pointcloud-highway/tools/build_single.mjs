#!/usr/bin/env node
// Bundle the app into ONE self-contained HTML file (dist/lidar-bim-highway.html):
// all modules inlined, site data embedded, the synthesis worker created from a Blob.
// Three.js is still loaded from the CDN (importmap), so the file needs internet access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** Strip local imports / exports so modules can be concatenated into one script. */
function flatten(src, { keepThree = true } = {}) {
  const imports = [];
  src = src.replace(/^import\s[^;]*?from\s+'(\.\/[^']+)';\s*$/gm, '');
  src = src.replace(/^import\s[^;]*?from\s+'(three[^']*)';\s*$/gm, (m) => { if (keepThree) imports.push(m.trim()); return ''; });
  src = src.replace(/^export\s+(?=(const|let|function|class|async))/gm, '');
  return { src, imports };
}

const order = ['geom', 'structure', 'synth', 'colormaps', 'shaders', 'edl', 'bim', 'camera', 'measure', 'annotations', 'las', 'main'];
const importSet = new Set();
let bundle = '';
for (const name of order) {
  let src = read(`src/${name}.js`);
  if (name === 'main') {
    src = src.replace("const NO_ELEM = 65535;\n", '');
    src = src.replace("new Worker(new URL('./synth.worker.js', import.meta.url), { type: 'module' })", 'new Worker(WORKER_URL)');
    src = src.replace("const res = await fetch(`./data/${key}.json`);\n  data = await res.json();", "data = JSON.parse(document.getElementById(`data-${key}`).textContent);");
    if (!src.includes('new Worker(WORKER_URL)') || !src.includes('data-${key}')) throw new Error('main.js patch points not found');
  }
  const f = flatten(src);
  f.imports.forEach((i) => importSet.add(i));
  bundle += `\n// ===== src/${name}.js =====\n${f.src}`;
}

// worker: geom + structure + synth as a classic script
const workerSrc = ['geom', 'structure', 'synth'].map((n) => flatten(read(`src/${n}.js`), { keepThree: false }).src).join('\n') +
  '\n' + flatten(read('src/synth.worker.js')).src;

const safe = (s) => s.replace(/<\//g, '<\\/');
const sites = ['hakozaki', 'ohashi'];
const dataTags = sites.map((s) => `<script type="application/json" id="data-${s}">${safe(read(`data/${s}.json`))}</script>`).join('\n');

let html = read('index.html');
html = html.replace('<script type="module" src="./src/main.js"></script>', `${dataTags}
<script type="text/plain" id="worker-src">${safe(workerSrc)}</script>
<script type="text/plain" id="las-src">${safe(read('src/las.js'))}</script>
<script type="module">
${[...importSet].join('\n')}
const WORKER_URL = URL.createObjectURL(new Blob([document.getElementById('worker-src').textContent], { type: 'text/javascript' }));
window.__LAS_SRC__ = document.getElementById('las-src').textContent;
${safe(bundle)}
</script>`);
html = html.replace('<title>LiDAR × BIM 都市高速</title>', '<title>LiDAR × BIM 都市高速（単体ファイル版）</title>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'lidar-bim-highway.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
