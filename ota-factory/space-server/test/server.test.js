// node --test test/  — runs the server in-process on a random port with a temp database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import WebSocket from "ws";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xspace-"));
process.env.DATA_DIR = tmp; process.env.DEV_LOGIN = "1"; delete process.env.GOOGLE_CLIENT_ID;
const mod = await import("../server.js");
const { verifySlackSignature, SlackBridge } = await import("../slack.js");
let base, wsBase;
before(async () => { await new Promise(r => mod.server.listen(0, r)); const { port } = mod.server.address(); base = `http://127.0.0.1:${port}`; wsBase = `ws://127.0.0.1:${port}/ws`; });
after(() => { mod.server.close(); fs.rmSync(tmp, { recursive: true, force: true }); setTimeout(() => process.exit(0), 50); });

const post = (p, body, token) => fetch(base + p, { method:"POST", headers:{ "Content-Type":"application/json", ...(token ? { Authorization:"Bearer " + token } : {}) }, body: JSON.stringify(body) }).then(async r => ({ status:r.status, body: await r.json() }));
const get = (p, token) => fetch(base + p, { headers: token ? { Authorization:"Bearer " + token } : {} }).then(async r => ({ status:r.status, body: await r.json().catch(() => null) }));
function client(token){
  const ws = new WebSocket(wsBase); const inbox = [];
  const ready = new Promise((res, rej) => { ws.on("open", () => ws.send(JSON.stringify({ t:"hello", token }))); ws.on("message", d => { const m = JSON.parse(d); inbox.push(m); if (m.t === "welcome") res(m); }); ws.on("error", rej); });
  const wait = (pred, ms = 2000) => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { const m = inbox.find(pred); if (m){ clearInterval(iv); res(m); } else if (Date.now() - t0 > ms){ clearInterval(iv); rej(new Error("timeout")); } }, 10); });
  return { ws, inbox, ready, wait, send: m => ws.send(JSON.stringify(m)), close: () => ws.close() };
}

test("slack signature verification", () => {
  const secret = "s3cret", ts = String(Math.floor(Date.now() / 1000)), body = '{"a":1}';
  const sig = "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
  assert.equal(verifySlackSignature(secret, ts, body, sig), true);
  assert.equal(verifySlackSignature(secret, ts, body + " ", sig), false);
  assert.equal(verifySlackSignature(secret, String(Number(ts) - 900), body, sig), false);
});

test("slack outbound maps channels and names guests", async () => {
  const calls = []; const fake = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { json: async () => ({ ok:true }) }; };
  const b = new SlackBridge({ token:"xoxb", signingSecret:"x", map:"partners:C1", fetchImpl:fake, onInbound(){} });
  await b.outbound({ ch:"partners", name:"佐藤", org:"A 工場", text:"こんにちは" }); await b.outbound({ ch:"all", name:"x", text:"y" });
  assert.equal(calls.length, 1); assert.equal(calls[0].body.channel, "C1"); assert.equal(calls[0].body.username, "佐藤（A 工場）");
});

test("dev login, invites, access rules and chat", async () => {
  assert.equal((await get("/api/config")).body.devLogin, true);
  const emp = await post("/auth/dev", { name:"山田" }); assert.equal(emp.status, 200); assert.equal(emp.body.user.role, "employee");
  const emp2 = await post("/auth/dev", { name:"鈴木" });
  // guest without invite is not possible; with invite becomes guest of that org
  const bad = await post("/auth/dev", { name:"外部", invite:"nope" }); assert.equal(bad.status, 403);
  const inv = await post("/api/invites", { org:"川崎第二工場" }, emp.body.token); assert.equal(inv.status, 200); assert.match(inv.body.url, /invite=/);
  const guest = await post("/auth/dev", { name:"田中", invite: inv.body.code }); assert.equal(guest.body.user.role, "guest"); assert.equal(guest.body.user.org, "川崎第二工場");
  assert.equal((await post("/api/invites", { org:"x" }, guest.body.token)).status, 403, "guests cannot invite");
  assert.equal((await get("/api/attendance", guest.body.token)).status, 403, "guests cannot read attendance");

  const a = client(emp.body.token), b = client(emp2.body.token), g = client(guest.body.token);
  const [wa, , wg] = await Promise.all([a.ready, b.ready, g.ready]);
  assert.ok(wa.channels.find(c => c.id === "all")); assert.ok(wa.channels.find(c => c.id === inv.body.channel));
  const gch = wg.channels.map(c => c.id); assert.ok(gch.includes("partners")); assert.ok(gch.includes(inv.body.channel)); assert.ok(!gch.includes("all"), "guest must not see internal channels");

  // internal message: employees receive it, guest does not and cannot post or read history
  a.send({ t:"say", ch:"all", text:"社内連絡" }); await b.wait(m => m.t === "msg" && m.m.text === "社内連絡");
  g.send({ t:"say", ch:"all", text:"侵入" }); await g.wait(m => m.t === "err");
  g.send({ t:"hist", ch:"all" }); const h = await g.wait(m => m.t === "hist" && m.ch === "all"); assert.equal(h.denied, true);
  await new Promise(r => setTimeout(r, 150)); assert.ok(!g.inbox.find(m => m.t === "msg" && m.m.ch === "all"));

  // shared channel reaches the guest; DM only reaches the two parties
  g.send({ t:"say", ch:inv.body.channel, text:"納期の件です" }); await a.wait(m => m.t === "msg" && m.m.text === "納期の件です" && m.m.org === "川崎第二工場");
  const dm = mod.dmId(emp.body.user.id, guest.body.user.id); a.send({ t:"say", ch:dm, text:"個別にどうぞ" }); await g.wait(m => m.t === "msg" && m.m.ch === dm);
  await new Promise(r => setTimeout(r, 150)); assert.ok(!b.inbox.find(m => m.t === "msg" && m.m.ch === dm), "third party must not receive DM");

  // proximity chat: only within 10 m on the same floor
  a.send({ t:"mv", x:0, z:0, f:1, ry:0 }); b.send({ t:"mv", x:5, z:0, f:1, ry:0 }); g.send({ t:"mv", x:40, z:0, f:1, ry:0 }); await new Promise(r => setTimeout(r, 150));
  a.send({ t:"say", ch:"near", text:"近くの人へ" }); await b.wait(m => m.t === "near" && m.m.text === "近くの人へ");
  await new Promise(r => setTimeout(r, 150)); assert.ok(!g.inbox.find(m => m.t === "near"), "far user must not hear");

  // sitting pose is fanned out; gestures reach nearby users and the addressed user, but are validated
  a.send({ t:"mv", x:0, z:0, f:1, ry:0, po:1 }); await b.wait(m => m.t === "mv" && m.l.some(r => r[0] === emp.body.user.id && r[6] === 1));
  a.send({ t:"emo", e:"wave", to:guest.body.user.id }); await b.wait(m => m.t === "emo" && m.e === "wave"); await g.wait(m => m.t === "emo" && m.to === guest.body.user.id);
  a.send({ t:"emo", e:"<script>" }); await new Promise(r => setTimeout(r, 150)); assert.ok(!b.inbox.find(m => m.t === "emo" && m.e !== "wave"), "unknown gestures are dropped");

  // history and search respect access
  const hist = await new Promise(r => { a.send({ t:"hist", ch:"all" }); a.wait(m => m.t === "hist" && m.ch === "all").then(r); }); assert.equal(hist.msgs.at(-1).text, "社内連絡");
  assert.equal((await get("/api/search?q=" + encodeURIComponent("社内"), guest.body.token)).body.results.length, 0);
  assert.equal((await get("/api/search?q=" + encodeURIComponent("社内"), emp.body.token)).body.results.length, 1);

  // check-in shows in presence and attendance
  a.send({ t:"checkin" }); await b.wait(m => m.t === "pres" && m.u.id === emp.body.user.id && m.u.checkedIn);
  const att = await get("/api/attendance", emp.body.token); assert.equal(att.body.rows.length, 1);
  // static files: model served, server source not exposed
  assert.equal((await fetch(base + "/space.html")).status, 200);
  assert.equal((await fetch(base + "/space-server/server.js")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e/%2e%2e/etc/hostname")).status, 404, "path traversal blocked");
  assert.equal((await fetch(base + "/space-server/data/space.db")).status, 404, "database not served");
  a.close(); b.close(); g.close();
});
