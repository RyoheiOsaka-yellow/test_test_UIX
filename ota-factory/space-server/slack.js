// Optional two-way bridge between Space channels and Slack channels.
// Outbound: chat.postMessage as the poster's name. Inbound: Events API (message.channels), signature-verified.
// Env: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_CHANNEL_MAP="all:C0123,partners:C0456"
import crypto from "node:crypto";

export function verifySlackSignature(secret, ts, body, signature, now = Date.now()){
  if (!secret || !ts || !signature) return false;
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const mac = "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
  const a = Buffer.from(mac), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class SlackBridge {
  constructor({ token, signingSecret, map, onInbound, fetchImpl = globalThis.fetch }){
    this.token = token || ""; this.secret = signingSecret || ""; this.onInbound = onInbound; this.fetch = fetchImpl;
    this.toSlack = new Map(); this.fromSlack = new Map(); this.names = new Map();
    for (const pair of String(map || "").split(",")){ const [ch, sid] = pair.split(":").map(s => (s || "").trim()); if (ch && sid){ this.toSlack.set(ch, sid); this.fromSlack.set(sid, ch); } }
    this.enabled = !!(this.token && this.toSlack.size);
  }
  async api(method, body){
    const r = await this.fetch(`https://slack.com/api/${method}`, { method:"POST", headers:{ "Authorization":`Bearer ${this.token}`, "Content-Type":"application/json; charset=utf-8" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!j.ok) throw new Error(`${method}: ${j.error}`); return j;
  }
  async outbound(m){
    if (!this.enabled) return; const sid = this.toSlack.get(m.ch); if (!sid) return;
    await this.api("chat.postMessage", { channel: sid, text: m.text, username: m.org ? `${m.name}（${m.org}）` : m.name, unfurl_links: false, unfurl_media: false });
  }
  async userName(uid){
    if (this.names.has(uid)) return this.names.get(uid);
    let name = uid; try { const j = await this.api("users.info", { user: uid }); name = j.user?.profile?.display_name || j.user?.real_name || uid; } catch {}
    this.names.set(uid, name); return name;
  }
  // Called with the raw request (rawBody already read by the server).
  async handleEvent(req){
    const ok = verifySlackSignature(this.secret, req.headers["x-slack-request-timestamp"], req.rawBody || "", req.headers["x-slack-signature"]);
    if (!ok){ const e = new Error("bad signature"); e.status = 401; throw e; }
    const body = JSON.parse(req.rawBody || "{}");
    if (body.type === "url_verification") return { __raw: String(body.challenge || "") };
    const ev = body.event || {};
    if (body.type === "event_callback" && ev.type === "message" && !ev.subtype && !ev.bot_id && ev.text){
      const ch = this.fromSlack.get(ev.channel);
      if (ch) this.onInbound({ ch, slackUser: ev.user, name: await this.userName(ev.user), text: ev.text });
    }
    return { ok: true };
  }
}
