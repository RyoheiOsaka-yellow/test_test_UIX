// XANTALOS Space server — presence, avatars and chat on top of the factory model.
// HTTP: static files + auth + small JSON API. WebSocket (/ws): real-time positions, presence and messages.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { openDb } from "./db.js";
import { SlackBridge } from "./slack.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG = {
  port: Number(process.env.PORT || 8080),
  publicDir: path.resolve(HERE, process.env.PUBLIC_DIR || ".."),
  dataDir: path.resolve(HERE, process.env.DATA_DIR || "data"),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  employeeDomains: (process.env.EMPLOYEE_DOMAINS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
  adminEmails: (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
  devLogin: process.env.DEV_LOGIN ? process.env.DEV_LOGIN === "1" : !process.env.GOOGLE_CLIENT_ID,
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  publicUrl: process.env.PUBLIC_URL || "",
  nearRadius: 10,
};

// ---------------------------------------------------------------- channels
const DEFAULT_CHANNELS = [
  { id:"all",      name:"全体",         kind:"team",  shared:0, zone:"" },
  { id:"mach",     name:"機械加工",     kind:"zone",  shared:0, zone:"mach" },
  { id:"asm",      name:"組立ベイ",     kind:"zone",  shared:0, zone:"asm1,asm2,tcell" },
  { id:"sw",       name:"ソフト開発",   kind:"zone",  shared:0, zone:"sw,ctrl,hil" },
  { id:"design",   name:"設計",         kind:"zone",  shared:0, zone:"design,mtg3" },
  { id:"cafe",     name:"カフェ・雑談", kind:"zone",  shared:0, zone:"cafe,rest1,rest2" },
  { id:"partners", name:"工場間連携",   kind:"team",  shared:1, zone:"" },
];
const db = openDb(CONFIG.dataDir, DEFAULT_CHANNELS);
const slack = new SlackBridge({ token:process.env.SLACK_BOT_TOKEN, signingSecret:process.env.SLACK_SIGNING_SECRET, map:process.env.SLACK_CHANNEL_MAP, onInbound: handleSlackMessage });

export function dmId(a, b){ return "dm:" + [a, b].sort().join(":"); }
function channelOf(id){ return db.getChannel(id); }
// Access rules: employees see everything except other people's DMs; guests see shared channels for their org and their own DMs.
export function canAccess(user, ch){
  if (!user || !ch) return false;
  if (ch.startsWith("dm:")) return ch.split(":").slice(1).includes(user.id);
  if (ch.startsWith("eq:")) return user.role === "employee";
  const c = channelOf(ch); if (!c) return false;
  if (user.role === "employee") return true;
  if (!c.shared) return false;
  const orgs = c.orgs ? c.orgs.split("|").filter(Boolean) : [];
  return orgs.length === 0 || orgs.includes(user.org);
}
function visibleChannels(user){ return db.listChannels().filter(c => canAccess(user, c.id)); }
function dmChannels(user){ return db.listDmChannels(user.id).map(id => { const other = id.split(":").slice(1).find(x => x !== user.id) || user.id; const u = db.getUser(other); return { id, name: u ? u.name : "?", kind:"dm", peer: other }; }); }

// ---------------------------------------------------------------- sessions & auth
function newSession(userId){ const token = crypto.randomBytes(24).toString("base64url"); db.addSession(token, userId, Date.now() + CONFIG.sessionDays * 864e5); return token; }
function userFromToken(token){ if (!token) return null; const s = db.getSession(token); if (!s || s.expires < Date.now()) return null; return db.getUser(s.user_id); }
function bearer(req){ const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7) : ""; }
function cleanName(s, max = 40){ return String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max); }
function slug(s){ return cleanName(s, 40).toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, "-").replace(/^-|-$/g, "") || crypto.randomBytes(3).toString("hex"); }

let googleClient = null;
async function verifyGoogle(credential){
  if (!CONFIG.googleClientId) throw httpErr(400, "Google login is not configured");
  if (!googleClient){ const { OAuth2Client } = await import("google-auth-library"); googleClient = new OAuth2Client(CONFIG.googleClientId); }
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: CONFIG.googleClientId });
  const p = ticket.getPayload();
  if (!p.email_verified) throw httpErr(403, "Google account email is not verified");
  return { email: p.email.toLowerCase(), name: p.name || p.email, picture: p.picture || "", hd: (p.hd || "").toLowerCase() };
}
// Decide role: company domain => employee; otherwise a valid invite => guest of that org.
function resolveLogin({ email, name, invite }){
  const domain = email.split("@")[1] || "";
  if (CONFIG.employeeDomains.includes(domain) || CONFIG.adminEmails.includes(email)) return { role:"employee", org:"", name };
  const inv = invite ? db.getInvite(invite) : null;
  if (!inv) throw httpErr(403, "社外の方は招待リンクからログインしてください");
  if (inv.email && inv.email !== email) throw httpErr(403, "この招待は別のメールアドレス宛てです");
  if (inv.expires && inv.expires < Date.now()) throw httpErr(403, "招待リンクの有効期限が切れています");
  db.useInvite(inv.code);
  return { role:"guest", org: inv.org, name };
}
function loginUser({ email, name, role, org, picture }){
  const id = "u_" + crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);
  const prev = db.getUser(id);
  db.upsertUser({ id, email, name: cleanName(name) || email, role, org: org || "", picture: picture || "", avatar: prev ? prev.avatar : "" });
  return { token: newSession(id), user: publicUser(db.getUser(id)) };
}
export function publicUser(u){ if (!u) return null; let avatar = {}; try { avatar = JSON.parse(u.avatar || "{}"); } catch {} return { id:u.id, name:u.name, role:u.role, org:u.org, picture:u.picture, avatar }; }

// ---------------------------------------------------------------- live state
const online = new Map();   // userId -> { user, socks:Set, pos:{x,z,f,ry,mv}, status, zone, dirty }
function presenceOf(o){ const p = o.pos; return { ...publicUser(o.user), status:o.status, checkedIn: !!db.openAttendance(o.user.id), zone:o.zone, f:p.f, pos:{ x:p.x, z:p.z, f:p.f, ry:p.ry } }; }
function sendTo(ws, msg){ if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(msg, filter){ const data = JSON.stringify(msg); for (const o of online.values()){ if (filter && !filter(o)) continue; for (const ws of o.socks) if (ws.readyState === 1) ws.send(data); } }
function deliver(m){ broadcast({ t:"msg", m }, o => canAccess(o.user, m.ch)); }

export function postMessage({ ch, user, text, src = "app" }){
  text = String(text || "").replace(/\r/g, "").trim().slice(0, 2000);
  if (!text) return null;
  if (ch.startsWith("eq:") && !db.getChannel(ch)) db.addChannel({ id:ch, name:ch.slice(3), kind:"eq", shared:0, zone:"", orgs:"" });
  const m = { ch, uid:user.id, name:user.name, org:user.org || "", role:user.role, text, ts:Date.now(), src };
  m.id = db.addMessage(m);
  deliver(m);
  if (src !== "slack") slack.outbound(m).catch(e => console.warn("slack outbound", e.message));
  return m;
}
async function handleSlackMessage({ ch, slackUser, name, text }){
  const user = { id:"slack:" + slackUser, name: name + "（Slack）", org:"", role:"employee" };
  postMessage({ ch, user, text, src:"slack" });
}

// ---------------------------------------------------------------- HTTP
function httpErr(status, message){ const e = new Error(message); e.status = status; return e; }
async function readJson(req, limit = 64 * 1024){ let size = 0; const chunks = []; for await (const c of req){ size += c.length; if (size > limit) throw httpErr(413, "body too large"); chunks.push(c); } const raw = Buffer.concat(chunks).toString("utf8"); req.rawBody = raw; if (!raw) return {}; try { return JSON.parse(raw); } catch { throw httpErr(400, "invalid json"); } }
function json(res, status, obj){ res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" }); res.end(JSON.stringify(obj)); }
function requireUser(req, role){ const u = userFromToken(bearer(req)); if (!u) throw httpErr(401, "login required"); if (role && u.role !== role) throw httpErr(403, "forbidden"); return u; }
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp", ".glb":"model/gltf-binary", ".svg":"image/svg+xml", ".md":"text/markdown; charset=utf-8" };
function serveStatic(req, res){
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/space.html";
  const file = path.resolve(CONFIG.publicDir, "." + p);
  if (!file.startsWith(CONFIG.publicDir + path.sep) || file.includes(`${path.sep}space-server${path.sep}`) || path.basename(file).startsWith(".")) return json(res, 404, { error:"not found" });
  fs.stat(file, (err, st) => { if (err || !st.isFile()) return json(res, 404, { error:"not found" });
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": file.endsWith(".glb") ? "public, max-age=86400" : "no-cache" });
    fs.createReadStream(file).pipe(res); });
}
const routes = {
  "GET /api/config": async () => ({ googleClientId: CONFIG.googleClientId, devLogin: CONFIG.devLogin, slack: slack.enabled }),
  "POST /auth/google": async (req) => { const b = await readJson(req); const g = await verifyGoogle(b.credential); const r = resolveLogin({ email:g.email, name:g.name, invite:b.invite }); return loginUser({ email:g.email, name:r.name, role:r.role, org:r.org, picture:g.picture }); },
  "POST /auth/dev": async (req) => { if (!CONFIG.devLogin) throw httpErr(403, "dev login disabled"); const b = await readJson(req); const name = cleanName(b.name); if (!name) throw httpErr(400, "name required");
    if (b.invite){ const inv = db.getInvite(b.invite); if (!inv) throw httpErr(403, "invalid invite"); db.useInvite(inv.code); return loginUser({ email:`dev+${slug(name)}@guest.local`, name, role:"guest", org:inv.org }); }
    return loginUser({ email:`dev+${slug(name)}@employee.local`, name, role:"employee", org:"" }); },
  "POST /auth/logout": async (req) => { db.deleteSession(bearer(req)); return { ok:true }; },
  "GET /api/me": async (req) => ({ user: publicUser(requireUser(req)) }),
  "POST /api/invites": async (req) => { const u = requireUser(req, "employee"); const b = await readJson(req); const org = cleanName(b.org); if (!org) throw httpErr(400, "org required");
    const code = crypto.randomBytes(12).toString("base64url"); const chId = "x-" + slug(org);
    if (!db.getChannel(chId)) db.addChannel({ id:chId, name:"連携：" + org, kind:"team", shared:1, zone:"", orgs:org });
    db.addInvite({ code, org, email:(b.email || "").toLowerCase(), created_by:u.id, expires: Date.now() + 30 * 864e5 });
    broadcast({ t:"chans" }, o => o.user.role === "employee");
    const base = CONFIG.publicUrl || `http://${req.headers.host}`; return { code, org, channel:chId, url:`${base}/space.html?invite=${code}` }; },
  "GET /api/invites": async (req) => { requireUser(req, "employee"); return { invites: db.listInvites() }; },
  "GET /api/attendance": async (req, url) => { requireUser(req, "employee"); const day = url.searchParams.get("date") || new Date().toISOString().slice(0, 10); const rows = db.attendanceOn(day);
    if (url.searchParams.get("format") === "csv") return { __csv: "name,org,role,check_in,check_out\n" + rows.map(r => [r.name, r.org, r.role, new Date(r.in_ts).toISOString(), r.out_ts ? new Date(r.out_ts).toISOString() : ""].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") };
    return { date:day, rows }; },
  "GET /api/search": async (req, url) => { const u = requireUser(req); const q = cleanName(url.searchParams.get("q"), 100); if (q.length < 2) return { results: [] }; return { results: db.search(q, 200).filter(m => canAccess(u, m.ch)).slice(0, 50) }; },
  "POST /slack/events": async (req) => { await readJson(req, 512 * 1024); return slack.handleEvent(req); },
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"); const key = `${req.method} ${url.pathname}`; const h = routes[key];
  if (!h){ if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res); return json(res, 404, { error:"not found" }); }
  try { const out = await h(req, url); if (out && out.__csv){ res.writeHead(200, { "Content-Type":"text/csv; charset=utf-8" }); return res.end("﻿" + out.__csv); } if (out && out.__raw !== undefined){ res.writeHead(out.status || 200, { "Content-Type":"text/plain" }); return res.end(out.__raw); } json(res, 200, out); }
  catch (e){ json(res, e.status || 500, { error: e.status ? e.message : "server error" }); if (!e.status) console.error(e); }
});

// ---------------------------------------------------------------- WebSocket
const wss = new WebSocketServer({ server, path:"/ws", maxPayload: 16 * 1024 });
wss.on("connection", (ws) => {
  let me = null; let bucket = { n:6, t:Date.now() };
  const allow = () => { const now = Date.now(); bucket.n = Math.min(6, bucket.n + (now - bucket.t) / 1000); bucket.t = now; if (bucket.n < 1) return false; bucket.n -= 1; return true; };
  const timer = setTimeout(() => { if (!me) ws.close(4001, "hello timeout"); }, 10000);
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!me){
      if (m.t !== "hello") return; const u = userFromToken(m.token); if (!u){ sendTo(ws, { t:"err", e:"auth" }); return ws.close(4003, "auth"); }
      clearTimeout(timer); let o = online.get(u.id);
      if (!o){ o = { user:u, socks:new Set(), pos:{ x:-36, z:12, f:1, ry:Math.PI, mv:0 }, status:"在席", zone:"", dirty:true }; online.set(u.id, o); }
      o.user = u; o.socks.add(ws); me = o;
      sendTo(ws, { t:"welcome", me: presenceOf(o), channels: visibleChannels(u), dms: dmChannels(u), users: [...online.values()].map(presenceOf), pos:o.pos });
      broadcast({ t:"pres", u: presenceOf(o) });
      return;
    }
    const u = me.user;
    switch (m.t){
      case "mv": { const n = v => Number.isFinite(+v) ? +v : 0; me.pos = { x:n(m.x), z:n(m.z), f:Math.max(1, Math.min(3, n(m.f) | 0)), ry:n(m.ry), mv: m.mv ? 1 : 0 }; me.dirty = true;
        const zone = typeof m.zone === "string" ? m.zone.slice(0, 20) : ""; if (zone !== me.zone){ me.zone = zone; broadcast({ t:"pres", u: presenceOf(me) }); } break; }
      case "say": { if (!allow()) return sendTo(ws, { t:"err", e:"送信が速すぎます。少し待ってください" }); const ch = String(m.ch || "");
        if (ch === "near"){ const text = String(m.text || "").trim().slice(0, 500); if (!text) return; const msg = { ch:"near", uid:u.id, name:u.name, org:u.org, role:u.role, text, ts:Date.now(), src:"app", id:"n" + Date.now() };
          broadcast({ t:"near", m: msg }, o => o === me || (o.pos.f === me.pos.f && Math.hypot(o.pos.x - me.pos.x, o.pos.z - me.pos.z) <= CONFIG.nearRadius)); return; }
        if (!canAccess(u, ch)) return sendTo(ws, { t:"err", e:"このチャンネルには投稿できません" });
        postMessage({ ch, user:u, text:m.text }); break; }
      case "hist": { const ch = String(m.ch || ""); if (!canAccess(u, ch)) return sendTo(ws, { t:"hist", ch, msgs:[], denied:true }); const msgs = db.history(ch, Number(m.before) || Infinity, 50); sendTo(ws, { t:"hist", ch, msgs, more: msgs.length === 50 }); break; }
      case "dm": { const to = db.getUser(String(m.to || "")); if (!to) return; const id = dmId(u.id, to.id); sendTo(ws, { t:"chan", c:{ id, name:to.name, kind:"dm", peer:to.id } }); break; }
      case "status": { me.status = cleanName(m.s, 12) || "在席"; broadcast({ t:"pres", u: presenceOf(me) }); break; }
      case "checkin": { if (!db.openAttendance(u.id)) db.checkIn(u.id); broadcast({ t:"pres", u: presenceOf(me) }); break; }
      case "checkout": { db.checkOut(u.id); broadcast({ t:"pres", u: presenceOf(me) }); break; }
      case "avatar": { const a = m.avatar || {}; const av = { char: ["worker_m","worker_f","casual_m","casual_f"].includes(a.char) ? a.char : "casual_m", color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#5b7fa6" };
        db.setAvatar(u.id, JSON.stringify(av)); me.user = db.getUser(u.id); broadcast({ t:"pres", u: presenceOf(me) }); break; }
    }
  });
  ws.on("close", () => { clearTimeout(timer); if (!me) return; me.socks.delete(ws); if (me.socks.size === 0){ online.delete(me.user.id); broadcast({ t:"leave", id: me.user.id }); } });
});
// position fan-out at 10 Hz
setInterval(() => { const l = []; for (const o of online.values()) if (o.dirty){ o.dirty = false; const p = o.pos; l.push([o.user.id, +p.x.toFixed(2), +p.z.toFixed(2), p.f, +p.ry.toFixed(2), p.mv]); } if (l.length) broadcast({ t:"mv", l }); }, 100);
setInterval(() => db.purgeSessions(), 3600e3);

if (process.argv[1] === fileURLToPath(import.meta.url)){
  server.listen(CONFIG.port, () => console.log(`XANTALOS Space on :${CONFIG.port}  (google:${CONFIG.googleClientId ? "on" : "off"}, devLogin:${CONFIG.devLogin}, slack:${slack.enabled ? "on" : "off"}, public:${CONFIG.publicDir})`));
}
export { server, db };
