#!/usr/bin/env node
// ANGLEX サーバ（依存なし）: 静的配信 + REST API（プロジェクト / 見積 / 多社ワークフロー / 変換中継）
// 使い方: node server/server.js [--port 8080] [--data ./server/data]   変換: ANGLEX_CONVERTER_URL=https://converter.example/convert
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import * as WF from '../js/core/workflow.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = +(opt('--port', process.env.PORT || 8080)); const DATA = path.resolve(opt('--data', path.join(__dirname, 'data'))); fs.mkdirSync(DATA, { recursive: true });
const DB_FILE = path.join(DATA, 'db.json');
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : { users: [], projects: {}, estimates: {}, sessions: {} };
if (!db.users.length) db.users = [ // 初期ユーザ（パスワードは全員 "anglex"。本番では /api/users で変更）
  { id: 'u_a1', name: '山田（A社 設計）', org: 'A', company: 'A社（設計・見積）', email: 'a@example.com', pw: hash('anglex') },
  { id: 'u_b1', name: '鈴木（B社 営業）', org: 'B', company: 'B社（商社・販売）', email: 'b@example.com', pw: hash('anglex') },
  { id: 'u_c1', name: '佐藤（C社 工場）', org: 'C', company: 'C社（加工工場）', email: 'c@example.com', pw: hash('anglex') }];
let saveTimer = null; function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1)), 200); }
function hash(s) { return crypto.createHash('sha256').update('anglex:' + s).digest('hex'); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.csv': 'text/csv' };
function send(res, code, obj, headers = {}) { const body = typeof obj === 'string' ? obj : JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(body); }
function readBody(req) { return new Promise((res, rej) => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => res(Buffer.concat(chunks))); req.on('error', rej); }); }
function auth(req) { const h = req.headers.authorization || ''; const t = h.replace(/^Bearer\s+/i, ''); const s = db.sessions[t]; if (!s) return null; const u = db.users.find(x => x.id === s.userId); return u ? { user: pub(u), token: t } : null; }
const pub = u => ({ id: u.id, name: u.name, org: u.org, company: u.company, email: u.email });
function canAccessEstimate(user, e) { if (!user) return false; if (user.org === 'A') return true; return e.currentOrg === user.org || e.handoffs.some(h => h.to === user.org); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const p = url.pathname;
  try {
    if (p.startsWith('/api/')) {
      const me = auth(req);
      if (p === '/api/health') return send(res, 200, { ok: true, mode: 'server', version: 1, converter: !!process.env.ANGLEX_CONVERTER_URL });
      if (p === '/api/login' && req.method === 'POST') { const b = JSON.parse(await readBody(req) || '{}'); const u = db.users.find(x => x.email === b.email); if (!u || u.pw !== hash(b.password || '')) return send(res, 401, { error: 'メールアドレスまたはパスワードが違います' }); const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = { userId: u.id, at: Date.now() }; persist(); return send(res, 200, { user: pub(u), token: t }); }
      if (p === '/api/me') { if (!me) return send(res, 401, { error: 'unauthorized' }); return send(res, 200, me); }
      if (p === '/api/handoff/' + p.split('/')[3] && req.method === 'GET') { const token = p.split('/')[3]; const e = Object.values(db.estimates).find(x => Object.values(x.tokens || {}).includes(token)); if (!e) return send(res, 404, { error: 'token not found' }); const org = Object.keys(e.tokens).find(k => e.tokens[k] === token); return send(res, 200, WF.redact(e, org)); }
      if (!me) return send(res, 401, { error: 'ログインが必要です' });
      if (p === '/api/projects' && req.method === 'GET') return send(res, 200, Object.values(db.projects).filter(x => me.user.org === 'A' || (x.sharedWith || []).includes(me.user.org)).map(x => ({ ...x, model: undefined, size: JSON.stringify(x.model || {}).length })));
      let m;
      if ((m = p.match(/^\/api\/projects\/([^/]+)$/))) { const id = m[1]; if (req.method === 'GET') { const x = db.projects[id]; if (!x) return send(res, 404, { error: 'not found' }); return send(res, 200, x); } if (req.method === 'PUT') { if (me.user.org !== 'A') return send(res, 403, { error: 'モデル・プロジェクトの編集は A社のみ' }); const b = JSON.parse(await readBody(req)); b.id = id; b.updatedAt = new Date().toISOString(); b.owner = me.user.id; db.projects[id] = b; persist(); return send(res, 200, b); } if (req.method === 'DELETE') { if (me.user.org !== 'A') return send(res, 403, { error: 'forbidden' }); delete db.projects[id]; persist(); return send(res, 200, { ok: true }); } }
      if (p === '/api/estimates' && req.method === 'GET') { const pid = url.searchParams.get('project'); return send(res, 200, Object.values(db.estimates).filter(e => (!pid || e.projectId === pid) && canAccessEstimate(me.user, e)).map(e => WF.redact(e, me.user.org))); }
      if ((m = p.match(/^\/api\/estimates\/([^/]+)(?:\/(edit|handoff|finalize|reject))?$/))) { const id = m[1], action = m[2]; const e = db.estimates[id];
        if (req.method === 'PUT' && !action) { if (me.user.org !== 'A') return send(res, 403, { error: '見積の作成・差替えは A社のみ' }); const b = JSON.parse(await readBody(req)); b.id = id; db.estimates[id] = b; persist(); return send(res, 200, b); }
        if (!e) return send(res, 404, { error: 'not found' }); if (!canAccessEstimate(me.user, e)) return send(res, 403, { error: 'この見積にはアクセスできません' });
        if (req.method === 'GET') return send(res, 200, WF.redact(e, me.user.org));
        const b = JSON.parse(await readBody(req) || '{}');
        try { if (action === 'edit') { if (b.role !== me.user.org) return send(res, 403, { error: '役割が一致しません' }); WF.applyEdit(e, { ...b, who: me.user.name }); } else if (action === 'handoff') { if (b.from !== me.user.org) return send(res, 403, { error: '役割が一致しません' }); const r = WF.handoff(e, { ...b, who: me.user.name }); persist(); return send(res, 200, { est: WF.redact(e, me.user.org), token: r.token }); } else if (action === 'finalize') WF.finalize(e, { who: me.user.name, org: me.user.org, note: b.note || '' }); else if (action === 'reject') WF.reject(e, { who: me.user.name, org: me.user.org, note: b.note }); } catch (err) { return send(res, 400, { error: err.message }); }
        persist(); return send(res, 200, WF.redact(e, me.user.org)); }
      if (p === '/api/export' && me.user.org === 'A') return send(res, 200, db);
      if (p === '/api/import' && req.method === 'POST' && me.user.org === 'A') { const b = JSON.parse(await readBody(req)); Object.assign(db.projects, b.projects || {}); Object.assign(db.estimates, b.estimates || {}); persist(); return send(res, 200, { ok: true }); }
      if (p === '/api/users' && req.method === 'GET' && me.user.org === 'A') return send(res, 200, db.users.map(pub));
      if (p === '/api/users' && req.method === 'POST' && me.user.org === 'A') { const b = JSON.parse(await readBody(req)); const u = { id: 'u_' + crypto.randomBytes(4).toString('hex'), name: b.name, org: b.org, company: b.company, email: b.email, pw: hash(b.password || 'anglex') }; db.users.push(u); persist(); return send(res, 200, pub(u)); }
      if (p === '/api/convert' && req.method === 'POST') { const conv = process.env.ANGLEX_CONVERTER_URL; if (!conv) return send(res, 501, { error: 'converter not configured', message: 'DWG/JWW/RVT の変換は ANGLEX_CONVERTER_URL（ODA File Converter 等のHTTPラッパ）を設定すると有効になります。現状は DXF / IFC / PDF / glTF を直接読み込んでください。' }); const body = await readBody(req); const r = await fetch(conv, { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body }); res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'x-anglex-format': r.headers.get('x-anglex-format') || 'dxf' }); res.end(Buffer.from(await r.arrayBuffer())); return; }
      return send(res, 404, { error: 'unknown api ' + p });
    }
    // 静的配信
    let f = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p)); if (!f.startsWith(ROOT)) return send(res, 403, 'forbidden'); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(data); });
  } catch (e) { console.error(e); send(res, 500, { error: e.message }); }
});
server.listen(PORT, () => console.log(`ANGLEX server  http://localhost:${PORT}  data=${DATA}  converter=${process.env.ANGLEX_CONVERTER_URL || '(none)'}`));
