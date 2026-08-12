// A static server, because module scripts and an audio worklet both need an origin
// that is not file://. Nothing here is part of the app.
//
//   node serve.mjs [port]

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const root = new URL('.', import.meta.url).pathname
const port = Number(process.argv[2] ?? 8080)

const Types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
}

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const file = join(root, normalize(path === '/' ? '/index.html' : path))

  if (!file.startsWith(root)) {
    response.writeHead(403).end('forbidden')
    return
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, {
      'Content-Type': Types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    response.end(body)
  } catch {
    response.writeHead(404).end('not found')
  }
}).listen(port, () => console.log('jacquard-web on http://localhost:' + port))
