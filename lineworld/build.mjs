// Bundles the game into one self-contained lineworld.html that runs from
// file:// with no server. Run: npm run build
//
// Everything -- three.js, all modules, the CSS and the markup -- ends up inline
// in a single file, which keeps the "no assets" promise literal.

import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  legalComments: 'inline',
  target: ['es2020'],
  alias: { three: join(here, 'vendor/three/three.module.min.js') },
  write: false,
});

const js = result.outputFiles[0].text;
const html = await readFile(join(here, 'index.html'), 'utf8');

const out = html
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  // a function replacer, so `$&` and friends in the minified code stay literal
  .replace(
    /<script type="module" src="\.\/src\/main\.js"><\/script>/,
    () => `<script>\n${js}\n</script>`,
  );

if (out.includes('src/main.js')) throw new Error('script tag was not replaced');

const file = join(here, 'lineworld.html');
await writeFile(file, out);
console.log(`${file}  ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`);
