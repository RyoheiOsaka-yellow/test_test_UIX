#!/usr/bin/env node
/* Zero-dependency static file server. Node 18+.
   Usage: node server.js [port]
   ES modules need HTTP rather than file://, and that is the only reason
   this exists. It serves the directory it lives in and accepts no writes. */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function resolveSafe(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const full = normalize(join(ROOT, p));
  // Refuse anything that escapes the served directory.
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed');
    return;
  }
  const file = resolveSafe(req.url || '/');
  if (!file) { res.writeHead(403).end('forbidden'); return; }

  let info;
  try {
    info = await stat(file);
    if (info.isDirectory()) throw new Error('dir');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': info.size,
    // The whole point of the project is that a reload shows the new code.
    'cache-control': 'no-cache',
    // Nothing here is fetched cross-origin, and nothing should be framed.
    'x-content-type-options': 'nosniff'
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`REGOLITH — http://localhost:${PORT}`);
});
