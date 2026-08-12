/* ============================================================
   SINGLE-FILE BUILD

     node build/single-file.mjs [out.html]

   The game itself has no build step and does not need one. This exists
   for a different reason: ES modules cannot be loaded over file://, so
   double-clicking index.html gets you a blank page. Folding every
   module and the stylesheet into one document fixes that, and gives
   you something you can email.

   It is not a minifier and it does not rewrite anything clever. Each
   module keeps its own scope inside a function, and a nine-line
   registry stands in for `import`.
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const ENTRY = 'main.js';

/* ---------- module graph ---------- */

const IMPORT_RE = /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;

const key = (absPath) => posix.normalize(relative(SRC, absPath).split(/[\\/]/).join('/'));

async function collect(idKey, seen = new Map()) {
  if (seen.has(idKey)) return seen;
  const abs = join(SRC, idKey);
  const source = await readFile(abs, 'utf8');
  seen.set(idKey, { idKey, abs, source, deps: [] });

  const deps = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    deps.push(key(resolve(dirname(abs), m[2])));
  }
  seen.get(idKey).deps = deps;
  for (const d of deps) await collect(d, seen);
  return seen;
}

/* ---------- transform one module ---------- */

function transform(idKey, source) {
  const exported = new Set();

  let out = source.replace(IMPORT_RE, (_all, names, spec, offset, whole) => {
    const target = posix.normalize(
      posix.join(posix.dirname(idKey), spec.replace(/^\.\//, ''))
    );
    const bindings = names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const as = s.split(/\s+as\s+/);
        return as.length === 2 ? `${as[0].trim()}: ${as[1].trim()}` : s;
      })
      .join(', ');
    void offset; void whole;
    return `const { ${bindings} } = __req(${JSON.stringify(target)});`;
  });

  // export const / let / function / class / function*
  out = out.replace(
    /^([ \t]*)export\s+(const|let|var|class|async function\*?|function\*?)\s+([A-Za-z_$][\w$]*)/gm,
    (_all, indent, kind, name) => {
      exported.add(name);
      return `${indent}${kind} ${name}`;
    }
  );

  // export { a, b as c };
  out = out.replace(/^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm, (_all, names) => {
    for (const raw of names.split(',')) {
      const n = raw.trim();
      if (!n) continue;
      exported.add(n.split(/\s+as\s+/).pop().trim());
    }
    return '';
  });

  if (/^[ \t]*export\s/m.test(out)) {
    throw new Error(`${idKey}: an export form this packager does not understand survived`);
  }

  const tail = [...exported].map((n) => `  __e.${n} = ${n};`).join('\n');
  return `__def(${JSON.stringify(idKey)}, function (__e, __req) {\n${out}\n${tail}\n});`;
}

/* ---------- assemble ---------- */

const graph = await collect(ENTRY);
const modules = [...graph.values()].filter((m) => m.idKey !== ENTRY);
modules.push(graph.get(ENTRY));           // entry last: it has side effects

const bundle = `(function () {
'use strict';
/* Nine lines standing in for the module loader. Each module below keeps
   its own scope; __req runs one exactly once and caches what it set on
   its exports object. */
const __mods = Object.create(null);
function __def(id, fn) { __mods[id] = { fn, exports: null }; }
function __req(id) {
  const m = __mods[id];
  if (!m) throw new Error('module not bundled: ' + id);
  if (!m.exports) { m.exports = {}; m.fn(m.exports, __req); }
  return m.exports;
}

${modules.map((m) => transform(m.idKey, m.source)).join('\n\n')}

__req(${JSON.stringify(ENTRY)});
})();`;

let html = await readFile(join(ROOT, 'index.html'), 'utf8');
const css = await readFile(join(SRC, 'ui/styles.css'), 'utf8');

html = html.replace(
  /[ \t]*<link rel="stylesheet" href="src\/ui\/styles\.css">\n?/,
  `<style>\n${css}</style>\n`
);
html = html.replace(
  /[ \t]*<script type="module" src="src\/main\.js"><\/script>/,
  `<script>\n${bundle}\n</script>`
);
// A single file has to say so, since there is no repository around it.
html = html.replace(
  '<div class="boot-spec" id="bootSpec"></div>',
  '<div class="boot-spec" id="bootSpec"></div>\n    <div class="boot-spec">SINGLE-FILE BUILD · RUNS FROM file://</div>'
);

if (html.includes('src/main.js') || html.includes('src/ui/styles.css')) {
  throw new Error('a reference to the unbundled sources survived');
}

const out = process.argv[2] || join(ROOT, 'regolith.html');
await writeFile(out, html);
console.log(
  `${relative(process.cwd(), out)} — ${modules.length} modules, ${(html.length / 1024).toFixed(0)} KB`
);
