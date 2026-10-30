#!/usr/bin/env node
// ANGLEX サーバ（依存なし）: 静的配信 + REST API（プロジェクト / 見積 / 多社ワークフロー / 変換中継）
// 使い方: node server/server.js [--port 8080] [--data ./server/data]   変換: ANGLEX_CONVERTER_URL=https://converter.example/convert
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import * as WF from '../js/core/workflow.js';
import { remindersFor, shouldSend, reminderSubject } from '../js/core/reminders.js';
import { sendMail, smtpConfigured } from './mail.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = +(opt('--port', process.env.PORT || 8080)); const DATA = path.resolve(opt('--data', path.join(__dirname, 'data'))); fs.mkdirSync(DATA, { recursive: true });
const DB_FILE = path.join(DATA, 'db.json');
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : { users: [], projects: {}, estimates: {}, sessions: {} };
if (!db.users.length) db.users = [ // 初期ユーザ（パスワードは全員 "anglex"。本番では /api/users で変更）
  { id: 'u_a1', name: '山田（A社 設計）', org: 'A', company: 'A社（設計・見積）', email: 'a@example.com', pw: hash('anglex'), branch: 'TKY' },
  { id: 'u_a2', name: '田中（A社 大阪営業所）', org: 'A', company: 'A社（設計・見積）', email: 'a-osk@example.com', pw: hash('anglex'), branch: 'OSK' },
  { id: 'u_b1', name: '鈴木（B社 営業）', org: 'B', company: 'B社（商社・販売）', email: 'b@example.com', pw: hash('anglex'), branch: null, scope: 'all' },
  { id: 'u_c1', name: '佐藤（C社 工場）', org: 'C', company: 'C社（加工工場）', email: 'c@example.com', pw: hash('anglex'), branch: null, scope: 'all' }];
// 営業所の仕分け: 所属営業所のあるユーザーは自営業所の案件のみ（?all=1 で全営業所）。scope=all（工場・販売）は全営業所
function canSeeProject(u, p, all) { if (all || !u || u.scope === 'all' || !u.branch) return true; return !p.branch || p.branch === u.branch; }
let saveTimer = null; function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1)), 200); }
function hash(s) { return crypto.createHash('sha256').update('anglex:' + s).digest('hex'); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ico': 'image/x-icon', '.csv': 'text/csv' };
function send(res, code, obj, headers = {}) { const body = typeof obj === 'string' ? obj : JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(body); }
function readBody(req) { return new Promise((res, rej) => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => res(Buffer.concat(chunks))); req.on('error', rej); }); }
function auth(req) { const h = req.headers.authorization || ''; const t = h.replace(/^Bearer\s+/i, ''); const s = db.sessions[t]; if (!s) return null; const u = db.users.find(x => x.id === s.userId); return u ? { user: pub(u), token: t } : null; }
const pub = u => ({ id: u.id, name: u.name, org: u.org, company: u.company, email: u.email, branch: u.branch || null, scope: u.scope || null });
// 催促の自動送信: 1 時間ごとに 期限超過／期限 1 日以内／未回答 3 日以上 の見積を探し、担当会社のユーザー宛に送る（同じ見積・種類は 24 時間に 1 通）。
// SMTP 未設定なら送らず outbox（data/reminders.log）に本文を残す。/api/reminders で一覧、/api/reminders/run で手動実行（A社）
const REM_LOG = path.join(DATA, 'reminders.log');
function reminderText(est, r) { const to = est.currentOrg; const link = est.tokens?.[to] ? `${process.env.ANGLEX_PUBLIC_URL || 'http://localhost:' + PORT}/?handoff=${est.tokens[to]}` : '（業務フロー画面の共有リンク）'; const pending = to === 'C' ? est.lines.filter(l => l.factoryCost == null || l.accepted == null).length : to === 'B' ? est.lines.filter(l => l.bMarginPct == null).length : 0;
  return [`【ANGLEX 見積 ${est.no} Rev.${est.revision}】${est.projectName} — ご回答のお願い（自動送信）`, '', `${WF.ROLES[to].name} ご担当者様`, '', r.kind === 'overdue' ? `回答期限 ${est.due} を ${r.days} 日過ぎています。` : r.kind === 'due_soon' ? `回答期限 ${est.due} が${r.days <= 0 ? '本日' : '明日'}です。` : `受け渡しから ${r.days} 日が経過しています。`, pending ? `未入力の行: ${pending} / ${est.lines.length} 行` : null, '', '下記リンクから入力をお願いします（ログイン不要・貴社の権限で同じ見積を編集できます）。', link, '', '— ANGLEX（図面に、語らせる）自動通知'].filter(x => x != null).join('\n'); }
async function runReminders({ force = false } = {}) {
  const now = new Date(); db.reminders = db.reminders || []; const sent = []; const skipped = [];
  for (const r of remindersFor(Object.values(db.estimates), 'A', now)) { const est = r.est; if (!force && !shouldSend(est, r.kind, db.reminders, now)) { skipped.push({ estId: est.id, kind: r.kind }); continue; }
    const rcpts = db.users.filter(u => u.org === est.currentOrg && u.email && (u.scope === 'all' || !u.branch || !est.branch || u.branch === est.branch)).map(u => u.email); const subject = reminderSubject(est, r); const text = reminderText(est, r);
    let via = 'outbox', error = null; if (smtpConfigured() && rcpts.length) { try { await sendMail({ to: rcpts, subject, text }); via = 'smtp'; } catch (e) { error = e.message; } }
    const rec = { at: now.toISOString(), estId: est.id, no: est.no, kind: r.kind, days: r.days, to: rcpts, via, error }; db.reminders.push(rec); sent.push(rec);
    try { fs.appendFileSync(REM_LOG, `=== ${rec.at} ${subject}\nTo: ${rcpts.join(', ') || '(宛先なし)'}  via: ${via}${error ? '  error: ' + error : ''}\n${text}\n\n`); } catch { } }
  if (sent.length) { db.reminders = db.reminders.slice(-2000); persist(); } return { at: now.toISOString(), sent, skipped: skipped.length, smtp: smtpConfigured() };
}
// 週次まとめ（目標未達の図面様式）: 7 日に 1 回、営業所ごとに 要判断率 > 目標 の様式を A社ユーザーへ（SMTP or outbox）
const TARGET = +(process.env.ANGLEX_REVIEW_TARGET || 20);
async function runWeeklySummary({ force = false } = {}) {
  const now = new Date(); if (!force && db.lastWeekly && now - new Date(db.lastWeekly) < 7 * 86400000) return { skipped: true }; const stats = db.learnStats || []; const groups = new Map();
  for (const x of stats) { if (!x.members) continue; const k = `${x.branch || '—'}|${x.kind || '—'}`; const g = groups.get(k) || { branch: x.branch || '—', kind: x.kind || '—', n: 0, members: 0, review: 0 }; g.n++; g.members += x.members; g.review += x.review; groups.set(k, g); }
  const rows = [...groups.values()].map(g => ({ ...g, rate: Math.round(g.review / g.members * 100) })).filter(g => g.rate > TARGET).sort((a, b) => b.rate - a.rate); const sent = [];
  const byBranch = new Map(); for (const r of rows) { const a = byBranch.get(r.branch) || []; a.push(r); byBranch.set(r.branch, a); }
  for (const [branch, list] of byBranch) { const rcpts = db.users.filter(u => u.org === 'A' && u.email && (u.scope === 'all' || !u.branch || branch === '—' || u.branch === branch)).map(u => u.email); const subject = `【ANGLEX】週次: 要判断率が目標 ${TARGET}% を超えている図面様式（${branch}）`; const text = [`${branch} 営業所 ご担当者様`, '', `要判断率が目標（${TARGET}%）を超えている図面様式があります。検証キットの返送（feedback_template.csv）や図面上の修正を、上の様式から優先すると効果が大きいです。`, '', ...list.map(r => `・${r.kind}: 要判断率 ${r.rate}%（読込 ${r.n} 回・候補 ${r.members}）目標まで ${r.rate - TARGET} pt`), '', '管理画面「学習の状態」で詳細を確認できます。', '— ANGLEX 自動通知'].join('\n'); let via = 'outbox', error = null; if (smtpConfigured() && rcpts.length) { try { await sendMail({ to: rcpts, subject, text }); via = 'smtp'; } catch (e) { error = e.message; } } try { fs.appendFileSync(REM_LOG, `=== ${now.toISOString()} ${subject}\nTo: ${rcpts.join(', ') || '(宛先なし)'}  via: ${via}${error ? '  error: ' + error : ''}\n${text}\n\n`); } catch { } sent.push({ branch, styles: list.length, to: rcpts, via, error }); }
  db.lastWeekly = now.toISOString(); persist(); return { at: db.lastWeekly, target: TARGET, sent };
}
if (process.env.ANGLEX_REMINDERS !== '0') setInterval(() => runWeeklySummary().catch(e => console.error('[weekly]', e.message)), 60 * 60 * 1000).unref();
if (process.env.ANGLEX_REMINDERS !== '0') setInterval(() => runReminders().then(r => { if (r.sent.length) console.log(`[reminders] ${r.sent.length} 件を ${r.smtp ? 'SMTP' : 'outbox'} へ`); }).catch(e => console.error('[reminders]', e.message)), 60 * 60 * 1000).unref();
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
      if (p === '/api/projects' && req.method === 'GET') return send(res, 200, Object.values(db.projects).filter(x => (me.user.org === 'A' || (x.sharedWith || []).includes(me.user.org)) && canSeeProject(me.user, x, url.searchParams.get('all') === '1')).map(x => ({ ...x, model: undefined, size: JSON.stringify(x.model || {}).length })));
      let m;
      if ((m = p.match(/^\/api\/projects\/([^/]+)$/))) { const id = m[1]; if (req.method === 'GET') { const x = db.projects[id]; if (!x) return send(res, 404, { error: 'not found' }); return send(res, 200, x); } if (req.method === 'PUT') { if (me.user.org !== 'A') return send(res, 403, { error: 'モデル・プロジェクトの編集は A社のみ' }); const b = JSON.parse(await readBody(req)); b.id = id; b.updatedAt = new Date().toISOString(); b.owner = me.user.id; db.projects[id] = b; persist(); return send(res, 200, b); } if (req.method === 'DELETE') { if (me.user.org !== 'A') return send(res, 403, { error: 'forbidden' }); delete db.projects[id]; persist(); return send(res, 200, { ok: true }); } }
      if (p === '/api/estimates' && req.method === 'GET') { const pid = url.searchParams.get('project'); return send(res, 200, Object.values(db.estimates).filter(e => (!pid || e.projectId === pid) && canAccessEstimate(me.user, e)).map(e => WF.redact(e, me.user.org))); }
      if ((m = p.match(/^\/api\/estimates\/([^/]+)(?:\/(edit|handoff|finalize|reject|meeting))?$/))) { const id = m[1], action = m[2]; const e = db.estimates[id];
        if (req.method === 'PUT' && !action) { if (me.user.org !== 'A') return send(res, 403, { error: '見積の作成・差替えは A社のみ' }); const b = JSON.parse(await readBody(req)); b.id = id; db.estimates[id] = b; persist(); return send(res, 200, b); }
        if (!e) return send(res, 404, { error: 'not found' }); if (!canAccessEstimate(me.user, e)) return send(res, 403, { error: 'この見積にはアクセスできません' });
        if (req.method === 'GET') return send(res, 200, WF.redact(e, me.user.org));
        const b = JSON.parse(await readBody(req) || '{}');
        try { if (action === 'edit') { if (b.role !== me.user.org) return send(res, 403, { error: '役割が一致しません' }); WF.applyEdit(e, { ...b, who: me.user.name }); } else if (action === 'handoff') { if (b.from !== me.user.org) return send(res, 403, { error: '役割が一致しません' }); const r = WF.handoff(e, { ...b, who: me.user.name }); persist(); return send(res, 200, { est: WF.redact(e, me.user.org), token: r.token }); } else if (action === 'meeting') { const r = WF.addMeeting(e, { ...b, who: me.user.name, org: me.user.org }); persist(); return send(res, 200, r); } else if (action === 'finalize') WF.finalize(e, { who: me.user.name, org: me.user.org, note: b.note || '' }); else if (action === 'reject') WF.reject(e, { who: me.user.name, org: me.user.org, note: b.note }); } catch (err) { return send(res, 400, { error: err.message }); }
        persist(); return send(res, 200, WF.redact(e, me.user.org)); }
      if (p === '/api/prices' && req.method === 'GET') return send(res, 200, (db.prices || []).filter(r => me.user.org !== 'B'));
      if (p === '/api/prices' && req.method === 'POST') { const rows = JSON.parse(await readBody(req) || '[]'); db.prices = (db.prices || []).concat(rows).slice(-20000); persist(); return send(res, 200, { ok: true, n: db.prices.length }); }
      if (p === '/api/branches' && req.method === 'GET') return send(res, 200, db.branches || null);
      if (p === '/api/branches' && req.method === 'POST' && me.user.org === 'A') { db.branches = JSON.parse(await readBody(req) || '[]'); persist(); return send(res, 200, db.branches); }
      if (p === '/api/users/bulk' && req.method === 'POST' && me.user.org === 'A') { const list = JSON.parse(await readBody(req) || '[]'); const next = list.map(u => { const ex = db.users.find(x => x.id === u.id || x.email === u.email); return { id: u.id || ex?.id || ('u_' + crypto.randomBytes(4).toString('hex')), name: u.name, org: u.org, company: u.company, email: u.email, branch: u.branch || null, scope: u.scope || null, pw: ex?.pw || hash('anglex') }; }); if (!next.some(u => u.id === me.user.id)) return send(res, 400, { error: '自分自身は削除できません' }); db.users = next; persist(); return send(res, 200, db.users.map(pub)); }
      if (p === '/api/learnstats' && req.method === 'GET') return send(res, 200, (db.learnStats || []).filter(x => me.user.org === 'A'));
      if (p === '/api/learnstats' && req.method === 'POST') { const rows = JSON.parse(await readBody(req) || '[]'); db.learnStats = (db.learnStats || []).concat(rows.map(r => ({ ...r, by: me.user.name }))).slice(-5000); persist(); return send(res, 200, { ok: true, n: db.learnStats.length }); }
      if (p === '/api/learn' && req.method === 'GET') return send(res, 200, db.learn || []);
      if (p === '/api/learn' && req.method === 'POST') { const rows = JSON.parse(await readBody(req) || '[]'); db.learn = (db.learn || []).concat(rows).slice(-20000); persist(); return send(res, 200, { ok: true, n: db.learn.length }); }
      if (p === '/api/reminders' && req.method === 'GET') return send(res, 200, { items: remindersFor(Object.values(db.estimates).filter(e => canAccessEstimate(me.user, e)), me.user.org).map(r => ({ estId: r.est.id, no: r.est.no, projectName: r.est.projectName, kind: r.kind, days: r.days, label: r.label, waitingOn: r.waitingOn, due: r.est.due })), log: me.user.org === 'A' ? (db.reminders || []).slice(-50) : [], smtp: smtpConfigured() });
      if (p === '/api/reminders/run' && req.method === 'POST' && me.user.org === 'A') return send(res, 200, await runReminders({ force: url.searchParams.get('force') === '1' }));
      if (p === '/api/weekly/run' && req.method === 'POST' && me.user.org === 'A') return send(res, 200, await runWeeklySummary({ force: url.searchParams.get('force') === '1' }));
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
server.listen(PORT, () => console.log(`ANGLEX server  http://localhost:${PORT}  data=${DATA}  converter=${process.env.ANGLEX_CONVERTER_URL || '(none)'}  reminders=${process.env.ANGLEX_REMINDERS === '0' ? 'off' : (smtpConfigured() ? 'smtp ' + process.env.SMTP_HOST : 'outbox')}`));
