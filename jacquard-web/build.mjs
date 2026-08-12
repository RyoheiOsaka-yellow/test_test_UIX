// Folds the whole app into one HTML file that opens from anywhere, including a
// file:// origin.
//
//   node build.mjs [output]        # default jacquard.html
//
// There are two bundles rather than one, because the audio worklet is loaded as a
// module of its own: the page holds the second as a string and hands it over as a blob
// URL, since a single file has no separate module to point at. A page that cannot load
// a worklet module at all falls back to the push driver in FmSynth, which needs the
// DSP on the page anyway — so both bundles carry it, and the duplication is the price
// of the file being one file.
//
// The modules are wrapped rather than concatenated: every one keeps its own scope, so
// the several `clamp` helpers across this codebase go on being several. What the
// transform understands is the subset of the module syntax this project uses — named
// and namespace imports, and exported const, let, function and class — which is
// checked rather than assumed, so anything else fails the build instead of quietly
// producing a file that does not run.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative } from 'node:path'

const root = new URL('.', import.meta.url).pathname
const output = process.argv[2] ?? join(root, 'jacquard.html')

const ImportNamed = /^import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm
const ImportAll = /^import\s*\*\s*as\s*(\w+)\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm
const ImportBare = /^import\s+['"]([^'"]+)['"];?[ \t]*$/gm
const ExportDeclaration = /^export\s+(const|let|function|class|async function)\s+/gm
const AnyExport = /^export\b/m
const AnyImport = /^import\b/m

async function bundle(entry) {
  const modules = new Map()

  const load = async id => {
    if (modules.has(id)) return
    modules.set(id, null) // Claimed, so a cycle would not walk into itself

    const source = await readFile(join(root, id), 'utf8')
    const dependencies = []

    const resolve = specifier => {
      const path = normalize(join(dirname(id), specifier)).replace(/\\/g, '/')
      dependencies.push(path)
      return path
    }

    // A bundle is a classic script, where import.meta is not merely absent but a
    // syntax error — so a branch that never runs would still take the page down.
    let code = source.replace(/import\.meta\.url/g, 'location.href')

    code = code.replace(ImportNamed, (_, names, specifier) => {
      const list = names.split(',').map(name => name.trim()).filter(Boolean)
        .map(name => {
          const parts = name.split(/\s+as\s+/)
          return parts.length > 1 ? parts[0] + ': ' + parts[1] : name
        })
      return 'const { ' + list.join(', ') + ' } = __require(' +
             JSON.stringify(resolve(specifier)) + ');'
    })

    code = code.replace(ImportAll, (_, name, specifier) =>
      'const ' + name + ' = __require(' + JSON.stringify(resolve(specifier)) + ');')

    code = code.replace(ImportBare, (_, specifier) =>
      '__require(' + JSON.stringify(resolve(specifier)) + ');')

    const exported = []

    code = code.replace(ExportDeclaration, (match, keyword, offset, whole) => {
      const rest = whole.slice(offset + match.length)
      const name = /^([A-Za-z_$][\w$]*)/.exec(rest)
      if (name == null) throw new Error(id + ': cannot read the name in ' + match.trim())
      exported.push(name[1])
      return keyword + ' '
    })

    // Anything the transform did not understand is a build failure rather than a file
    // that loads and then does not run.
    if (AnyExport.test(code)) throw new Error(id + ': an export this build cannot fold')
    if (AnyImport.test(code)) throw new Error(id + ': an import this build cannot fold')

    for (const dependency of dependencies) await load(dependency)

    modules.set(id, { code, exported })
  }

  await load(entry)

  let text = ''

  for (const [id, module] of modules)
    text += '__modules[' + JSON.stringify(id) + '] = (__exports, __require) => {\n' +
            module.code + '\nObject.assign(__exports, { ' +
            module.exported.join(', ') + ' });\n};\n\n'

  return text
}

const Loader = `const __modules = {}, __loaded = {}
function __require(id) {
  if (__loaded[id]) return __loaded[id]
  const exports = __loaded[id] = {}
  __modules[id](exports, __require)
  return exports
}
`

const escape = text => text.replace(/<\/script/gi, '<\\/script')

const worklet = Loader + await bundle('src/audio/synth-processor.js') +
                '__require("src/audio/synth-processor.js")\n'

const app = Loader + await bundle('src/main.js') +
            '__require("src/main.js")\n'

const css = await readFile(join(root, 'style.css'), 'utf8')
const page = await readFile(join(root, 'index.html'), 'utf8')

const icon = /<link rel="icon"[^>]*>/.exec(page)?.[0] ?? ''

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>Jacquard — grid sequencer</title>
${icon}
<!-- Built from the sources in this directory by build.mjs. Edit those, not this. -->
<style>
${css}</style>
</head>
<body>
<div id="root"></div>
<script id="jacquard-worklet" type="text/plain">
${escape(worklet)}</script>
<script>
// The worklet's module, handed over as a blob because a single file has nowhere else
// to keep one. A page that refuses it falls back to the push driver inside FmSynth.
try {
  const source = document.getElementById('jacquard-worklet').textContent
  globalThis.__jacquardProcessorUrl =
    URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
} catch (error) {
  console.warn('no blob URL for the worklet; the push driver will render instead', error)
}
</script>
<script>
${escape(app)}</script>
</body>
</html>
`

await writeFile(output, html)

console.log('wrote ' + relative(root, output) + ' — ' +
            (html.length / 1024).toFixed(0) + 'kB')
