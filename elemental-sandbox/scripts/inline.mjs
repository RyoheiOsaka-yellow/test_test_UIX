/**
 * Fold the built bundle into one self-contained HTML file.
 *
 * Reads dist-single/ (produced by `SINGLE_FILE=1 vite build`), pulls the CSS and
 * the IIFE bundle inline, and writes elemental-sandbox.html. The result has no
 * external requests at all — no scripts, no stylesheets, no images, no fonts
 * beyond the system stack — so it runs off a USB stick, out of an email
 * attachment, or from any static host.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist-single');
const out = path.join(root, 'elemental-sandbox.html');

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const read = (file) => fs.readFileSync(path.join(dist, file), 'utf8');

/** A literal </script> inside a string would close the tag we are wrapping in. */
const escapeForScript = (js) => js.replace(/<\/script/gi, '<\\/script');

/**
 * Always replace via a function. Passing a replacement *string* would let the
 * bundle's own bytes act as substitution patterns — minified code is full of
 * sequences like `$&` and `$'`, and String.replace would expand them into the
 * matched text, quietly corrupting the script.
 */
const put = (haystack, re, text) => haystack.replace(re, () => text);

let result = html;

// --- stylesheet --------------------------------------------------------------
const linkRe = /<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/i;
const link = result.match(linkRe);
if (!link) throw new Error('no stylesheet link found in the built HTML');
const css = read(path.basename(link[1]));
result = put(result, linkRe, `<style>\n${css}\n</style>`);

// --- script ------------------------------------------------------------------
const scriptRe = /<script[^>]*src="([^"]+)"[^>]*><\/script>/i;
const script = result.match(scriptRe);
if (!script) throw new Error('no script tag found in the built HTML');

const js = read(path.basename(script[1]));

// Vite labels the entry `type="module"` whatever format it emitted. The bundle
// itself has to be a classic script for this to work from file://, so check the
// contents rather than the tag Vite wrote, and drop the attribute on the way in.
if (/^\s*(import|export)[\s{*]/m.test(js)) {
  throw new Error('the bundle is still an ES module — build with SINGLE_FILE=1');
}
// Vite hoists the entry into <head>, which is fine for a deferred module and
// fatal for a classic script: it would run before <canvas> exists. Drop it from
// wherever Vite put it and re-insert it as the last thing in the body.
result = put(result, scriptRe, '');
if (!result.includes('</body>')) throw new Error('no </body> to place the script before');
result = put(
  result,
  '</body>',
  `  <script>\n${escapeForScript(js)}\n  </script>\n</body>`
);

// --- a note for anyone who opens the file in an editor -----------------------
result = put(
  result,
  '<head>',
  `<head>
    <!--
      Elemental Sandbox — a single self-contained file.

      Everything is inline: no network requests, no build step, no assets. Open
      it in any browser with WebGL 2. Built from the sources at
      elemental-sandbox/src; edit those and re-run \`npm run build:single\`
      rather than editing the bundle below.
    -->`
);

fs.writeFileSync(out, result);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`wrote ${path.relative(root, out)}  ${kb(Buffer.byteLength(result))}`);
console.log(`  css ${kb(Buffer.byteLength(css))}   js ${kb(Buffer.byteLength(js))}`);
