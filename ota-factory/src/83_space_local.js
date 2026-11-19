// ================= XANTALOS Space：オフライン体験版（サーバーなし） =================
// file:// で開いたとき、サーバーにつながらないとき、または ?demo を付けたときに使う。
// space-server と同じやり取り（WebSocket の t:"..." と /api/...）をブラウザの中で再現し、体験用の自動キャラクター 4 人を置く。
// データはこのブラウザの中だけ（再読み込みで会話は消える）。本当に複数人で使うには space-server が必要。
const SPL = { me:null, users:new Map(), bots:[], msgs:{}, channels:[], invites:[], att:[], seq:1, started:false, greeted:new Set(), myPos:{ x:-36, z:12.4, f:1, ry:Math.PI, mv:0, po:0 } };
const SPL_ROOMS = [
  { id:"mtgA",  name:"会議室 A",            f:2, x0:2,   x1:7,  z0:2, z1:18 },
  { id:"mtgB",  name:"会議室 B",            f:2, x0:7,   x1:12, z0:2, z1:18 },
  { id:"prj1",  name:"プロジェクトルーム 1", f:3, x0:-10, x1:-3, z0:2, z1:18 },
  { id:"prj2",  name:"プロジェクトルーム 2", f:3, x0:-3,  x1:4,  z0:2, z1:18 },
  { id:"board", name:"ボードルーム",         f:3, x0:10,  x1:16, z0:2, z1:18 },
];
const SPL_CHANNELS = [
  { id:"all",      name:"全体",         kind:"team", shared:0, zone:"" },
  { id:"mach",     name:"機械加工",     kind:"zone", shared:0, zone:"mach" },
  { id:"asm",      name:"組立ベイ",     kind:"zone", shared:0, zone:"asm1,asm2,tcell" },
  { id:"sw",       name:"ソフト開発",   kind:"zone", shared:0, zone:"sw,ctrl,hil" },
  { id:"design",   name:"設計",         kind:"zone", shared:0, zone:"design,mtg3" },
  { id:"cafe",     name:"カフェ・雑談", kind:"zone", shared:0, zone:"cafe,rest1,rest2" },
  { id:"partners", name:"工場間連携",   kind:"team", shared:1, zone:"" },
  { id:"x-川崎第二工場", name:"連携：川崎第二工場", kind:"partner", shared:1, zone:"", orgs:["川崎第二工場"] },
];
function splWanted(){ return location.protocol === "file:" || new URLSearchParams(location.search).has("demo"); }
function splRoomOf(p){ const r = p && SPL_ROOMS.find(r => r.f === p.f && p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1); return r ? r.id : ""; }
function splHears(lp, sp){ const rs = splRoomOf(sp), rl = splRoomOf(lp); if (rs || rl) return rs === rl; return lp.f === sp.f && Math.hypot(lp.x - sp.x, lp.z - sp.z) <= 10; }
function splPush(m){ setTimeout(() => spOnMsg(m), 0); }
function splPres(u){ const p = u.pos; return { id:u.id, name:u.name, role:u.role, org:u.org || "", avatar:u.avatar, status:u.status, checkedIn:!!u.checkedIn, zone:u.zone || "", room:splRoomOf(p), f:p.f, pos:{ x:p.x, z:p.z, f:p.f, ry:p.ry, po:p.po || 0 } }; }
function splCanAccess(u, ch){ if (ch.startsWith("dm:")) return ch.split(":").includes(u.id); if (ch.startsWith("eq:")) return u.role === "employee";
  const c = SPL.channels.find(x => x.id === ch); if (!c) return false; if (u.role === "employee") return true; return !!c.shared && (!c.orgs || !c.orgs.length || c.orgs.includes(u.org)); }
function splMsg(ch, u, text, ts){ const m = { id:SPL.seq++, ch, uid:u.id, name:u.name, org:u.role === "guest" ? u.org : "", role:u.role, text, ts: ts || Date.now(), src:"app" }; (SPL.msgs[ch] || (SPL.msgs[ch] = [])).push(m); return m; }
function splPost(ch, u, text){ const m = splMsg(ch, u, text); if (splCanAccess(SPL.me, ch)) splPush({ t:"msg", m }); return m; }
function splDmId(a, b){ return "dm:" + [a, b].sort().join(":"); }

// ---- 体験用キャラクター
const SPL_BOT_DEFS = [
  { id:"bot_takahashi", name:"高橋", role:"employee", avatar:{ char:"casual_m", color:"#2f6fd0" }, status:"在席", pos:{ f:1, x:-38.6, z:10.2 }, face:[-36, 12.4],
    hello:"ようこそ XANTALOS へ！WASD かクリックで歩けます。V キーで自分の目線にもなりますよ。", hint:"受付・案内",
    replies:["2F・3F へは下の「場所へ移動」から行けます。", "人をクリックすると「話しかける」「手を振る」が選べます。", "会議室の中の会話は外に漏れません。試してみてください。"] },
  { id:"bot_sato", name:"佐藤", role:"employee", avatar:{ char:"casual_f", color:"#2ec4b6" }, status:"休憩", seat:{ f:3, x:24.5, z:9.5 },
    hello:"お疲れさまです。椅子をクリックすると座れます。座ってお話ししましょう ☕", hint:"設計",
    replies:["なるほど、詳しく聞かせてください。", "その図面、3F の設計フロアで一緒に見ましょうか。", "いいですね。#設計 チャンネルにも共有しておきます。"] },
  { id:"bot_tanaka", name:"田中", role:"guest", org:"川崎第二工場", avatar:{ char:"worker_m", color:"#f2a93b" }, status:"会議中", pos:{ f:2, x:4.6, z:7.4 }, face:[2, 4.7],
    hello:"こちらへどうぞ。この部屋の会話は外には聞こえません。治具の打合せを始めましょう。", hint:"協力工場",
    replies:["承知しました。川崎第二工場でも確認します。", "治具の納品は来週火曜の予定です。", "図面の改訂、連携チャンネルに上げておきますね。"] },
  { id:"bot_suzuki", name:"鈴木", role:"employee", avatar:{ char:"worker_f", color:"#3fb950" }, status:"集中", pos:{ f:1, x:-30, z:-6 }, walker:{ x0:-41, x1:-15, z0:-26, z1:-3 },
    hello:"5 軸 MC の段取り中です。危ないので黄色い線の外からどうぞ！", hint:"機械加工",
    replies:["午後から試作ロットを流します。", "工具の摩耗データは Factory OS で見られます。", "了解です、段取りが終わったら声をかけますね。"] },
];
const SPL_KEYWORDS = [[/こんにち|おはよ|こんばん|はじめまして|よろしく/, "こんにちは！よろしくお願いします。"], [/ありがと/, "どういたしまして！"], [/休憩|コーヒー|カフェ|お茶/, "3F のカフェ、いいですね。ご一緒します ☕"],
  [/会議|打合せ|打ち合わせ|ミーティング/, "会議室 A・B が使えます。左のパネルの「会議室」から歩いて行けますよ。"], [/図面|設計|CAD/, "図面なら 3F の設計フロアに最新版があります。"]];

function splSeedMessages(){ const t = h => { const d = new Date(); d.setHours(h, Math.floor(Math.random() * 50), 0, 0); return d.getTime(); };
  const U = id => SPL.users.get(id); const yam = { id:"bot_yamamoto", name:"山本", role:"employee" };
  splMsg("all", yam, "【お知らせ】本日 14:00 から組立ベイ 2 で XR-200 の顧客立会いがあります。通路の確保をお願いします。", t(8));
  splMsg("all", U("bot_suzuki"), "了解です。午前中に治具の最終確認をしておきます。", t(8)); splMsg("all", U("bot_takahashi"), "受付は 13:40 にお迎えします。", t(9));
  splMsg("mach", U("bot_suzuki"), "MC-02 のスピンドル暖機が完了しました。午後から試作ロットを流します。", t(9));
  splMsg("asm", yam, "ベイ 3 のクレーン点検は 16 時からです。", t(10)); splMsg("sw", U("bot_sato"), "HIL の結果、制御周期 1 ms を安定して達成しました。", t(10));
  splMsg("design", U("bot_sato"), "XR-200 のフレーム改訂版（Rev.C）を共有フォルダに置きました。", t(11)); splMsg("cafe", U("bot_takahashi"), "今日のカフェのランチは大田区産の野菜カレーです 🍛", t(11));
  splMsg("partners", U("bot_tanaka"), "川崎第二工場です。来月の生産計画、こちらで共有します。", t(9)); splMsg("partners", U("bot_takahashi"), "ありがとうございます。受け入れ側の準備を進めます。", t(9));
  splMsg("x-川崎第二工場", U("bot_tanaka"), "治具の納品、予定通り来週火曜でお願いします。", t(10)); splMsg("x-川崎第二工場", U("bot_suzuki"), "承知しました。受入検査の枠を確保します。", t(10)); }

function splStartBots(){ if (SPL.botsStarted) return; SPL.botsStarted = true;
  for (const d of SPL_BOT_DEFS){ const u = { ...d, checkedIn:true, pos:{ x:0, z:0, f:1, ry:0, mv:0, po:0, ...(d.pos || {}) } };
    if (d.seat){ const st = spSeatNear(d.seat.x, d.seat.z, d.seat.f, 3); if (st) Object.assign(u.pos, { f:st.f, x:st.x, z:st.z, ry:st.ry, po:1 }); else Object.assign(u.pos, { f:d.seat.f, x:d.seat.x, z:d.seat.z }); }
    if (d.face) u.pos.ry = Math.atan2(d.face[0] - u.pos.x, d.face[1] - u.pos.z);
    SPL.users.set(u.id, u); SPL.bots.push(u); }
  splSeedMessages();
  // 歩く人（鈴木）：機械加工エリアの空いた場所を巡回。通行グリッドができたら経路で歩く
  setInterval(splTickBots, 100); }
function splTickBots(){ const dt = 0.1; const out = [];
  for (const b of SPL.bots){ const p = b.pos;
    if (b.walker && !b.busy){ if (!b.path || !b.path.length){ if (!b.wait) b.wait = performance.now() + 1500 + Math.random() * 2500; if (performance.now() > b.wait && NAV.ready){ b.wait = 0; const w = b.walker;
          for (let k = 0; k < 12; k++){ const x = w.x0 + Math.random() * (w.x1 - w.x0), z = w.z0 + Math.random() * (w.z1 - w.z0); if (!navFree(1, x, z)) continue; const path = navPath(1, p.x, p.z, x, z); if (path && path.length){ b.path = path; break; } } } }
      if (b.path && b.path.length){ const t = b.path[0]; const dx = t.x - p.x, dz = t.z - p.z, l = Math.hypot(dx, dz); const s = Math.min(l, 1.3 * dt);
        if (l < 0.05){ b.path.shift(); if (!b.path.length){ p.mv = 0; out.push(b); } } else { p.x += dx / l * s; p.z += dz / l * s; p.ry = Math.atan2(dx, dz); p.mv = 1; out.push(b); } } }
    // 近づいたら一度だけあいさつ（会議室の人は同じ部屋に入ったら）
    const me = SPL.myPos; const near = b.id === "bot_tanaka" ? splRoomOf(me) === splRoomOf(p) && !!splRoomOf(p) : me.f === p.f && Math.hypot(me.x - p.x, me.z - p.z) < 3.2;
    if (near && !SPL.greeted.has(b.id)){ SPL.greeted.add(b.id); splBotFace(b); setTimeout(() => { splBotEmote(b, "wave", SPL.me.id); setTimeout(() => splBotSay(b, b.hello), 900); }, 500); } }
  if (out.length) splPush({ t:"mv", l: out.map(b => [b.id, +b.pos.x.toFixed(2), +b.pos.z.toFixed(2), b.pos.f, +b.pos.ry.toFixed(2), b.pos.mv, b.pos.po || 0]) }); }
function splBotFace(b){ if (b.pos.po) return; const me = SPL.myPos; b.pos.ry = Math.atan2(me.x - b.pos.x, me.z - b.pos.z); b.pos.mv = 0; splPush({ t:"mv", l:[[b.id, b.pos.x, b.pos.z, b.pos.f, b.pos.ry, 0, b.pos.po || 0]] }); }
function splBotSay(b, text){ const m = { ch:"near", uid:b.id, name:b.name, org:b.role === "guest" ? b.org : "", role:b.role, text, ts:Date.now(), src:"app", id:"n" + SPL.seq++, room:splRoomOf(b.pos) };
  if (splHears(SPL.myPos, b.pos)) splPush({ t:"near", m }); }
function splBotEmote(b, e, to){ if (splHears(SPL.myPos, b.pos) || to === SPL.me.id) splPush({ t:"emo", uid:b.id, name:b.name, e, to: to || "" }); }
function splBotReply(b, text){ for (const [re, r] of SPL_KEYWORDS) if (re.test(text)) return r; b.ri = ((b.ri || 0) + 1) % b.replies.length; return b.replies[b.ri]; }

// ---- 疑似 WebSocket：spSend(...) の宛先（close はチャンネル一覧の取り直しなので、つなぎ直す）
function splHandle(m){ const me = SPL.me; if (!me) return;
  switch (m.t){
    case "hello": { me.pos = SPL.myPos; splStartBots();
      const users = [me, ...SPL.bots].map(splPres); const chans = SPL.channels.filter(c => splCanAccess(me, c.id)).map(c => ({ ...c }));
      splPush({ t:"welcome", me: splPres(me), channels: chans, dms: SPL.dms || [], users, pos: SPL.myPos, rooms: SPL_ROOMS });
      if (!SPL.welcomed){ SPL.welcomed = true; setTimeout(() => { SP.near.push({ sys:true, text:"オフライン体験版です。サーバーなしで動いていて、周りの人は体験用の自動キャラクターです（高橋・佐藤・田中・鈴木）。", ts:Date.now() }); spToast("オフライン体験版：周りの人は体験用の自動キャラクターです", "info"); if (SP.cur === "near") spRenderMsgs(); }, 1200); }
      break; }
    case "mv": { const prevRoom = splRoomOf(SPL.myPos); Object.assign(SPL.myPos, { x:+m.x || 0, z:+m.z || 0, f:Math.max(1, Math.min(3, m.f | 0)), ry:+m.ry || 0, mv:m.mv ? 1 : 0, po:m.po === 1 ? 1 : 0 }); me.zone = m.zone || "";
      if (prevRoom !== splRoomOf(SPL.myPos)) splPush({ t:"pres", u: splPres(me) }); break; }
    case "say": { const ch = String(m.ch || ""), text = String(m.text || "").trim().slice(0, 2000); if (!text) return;
      if (ch === "near"){ const nm = { ch:"near", uid:me.id, name:me.name, org:me.role === "guest" ? me.org : "", role:me.role, text, ts:Date.now(), src:"app", id:"n" + SPL.seq++, room:splRoomOf(SPL.myPos) }; splPush({ t:"near", m:nm });
        const hearers = SPL.bots.filter(b => splHears(b.pos, SPL.myPos)).sort((a, c) => Math.hypot(a.pos.x - SPL.myPos.x, a.pos.z - SPL.myPos.z) - Math.hypot(c.pos.x - SPL.myPos.x, c.pos.z - SPL.myPos.z));
        const b = hearers[0]; if (b){ setTimeout(() => { splBotFace(b); splBotSay(b, splBotReply(b, text)); }, 1200 + Math.random() * 1000); } return; }
      if (!splCanAccess(me, ch)) return splPush({ t:"err", e:"このチャンネルには投稿できません" });
      splPost(ch, me, text);
      if (ch.startsWith("dm:")){ const peer = ch.split(":").slice(1).find(x => x !== me.id); const b = SPL.users.get(peer); if (b && b.replies) setTimeout(() => splPost(ch, b, splBotReply(b, text)), 1500); }
      else { const b = SPL.bots.find(x => text.includes("@" + x.name)) || (ch === "x-川崎第二工場" || ch === "partners" ? SPL.users.get("bot_tanaka") : null); if (b && (b.role === "employee" || splCanAccess(b, ch))) setTimeout(() => splPost(ch, b, splBotReply(b, text)), 1800); }
      break; }
    case "hist": { const ch = String(m.ch || ""); if (!splCanAccess(me, ch)) return splPush({ t:"hist", ch, msgs:[], denied:true }); splPush({ t:"hist", ch, msgs:(SPL.msgs[ch] || []).slice(-50), more:false }); break; }
    case "dm": { const to = SPL.users.get(String(m.to || "")); if (!to) return; const id = splDmId(me.id, to.id); const c = { id, name:to.name, kind:"dm", peer:to.id }; (SPL.dms || (SPL.dms = [])).find(d => d.id === id) || SPL.dms.unshift(c); splPush({ t:"chan", c }); break; }
    case "status": { me.status = String(m.s || "在席").slice(0, 12); splPush({ t:"pres", u: splPres(me) }); break; }
    case "checkin": { if (!me.checkedIn){ me.checkedIn = true; SPL.att.push({ date:new Date().toISOString().slice(0, 10), in:new Date().toISOString(), out:"" }); } splPush({ t:"pres", u: splPres(me) }); break; }
    case "checkout": { me.checkedIn = false; const r = SPL.att[SPL.att.length - 1]; if (r && !r.out) r.out = new Date().toISOString(); splPush({ t:"pres", u: splPres(me) }); break; }
    case "avatar": { me.avatar = m.avatar; spLS.set("xspace.local.avatar", JSON.stringify(m.avatar)); splPush({ t:"pres", u: splPres(me) }); break; }
    case "emo": { const e = String(m.e || ""); splPush({ t:"emo", uid:me.id, name:me.name, e, to:m.to || "" });
      const b = SPL.users.get(m.to); const mirror = { wave:"wave", bow:"bow", like:"like", clap:"clap", nod:"nod", ask:"nod", coffee:"like", point:"nod" };
      if (b && b.replies){ setTimeout(() => { splBotFace(b); if (e === "talk") splBotSay(b, "はい、どうしましたか？"); else splBotEmote(b, mirror[e] || "nod", me.id); }, 900); }
      else if (e === "wave") for (const x of SPL.bots) if (splHears(x.pos, SPL.myPos) && Math.hypot(x.pos.x - SPL.myPos.x, x.pos.z - SPL.myPos.z) < 6) setTimeout(() => { splBotFace(x); splBotEmote(x, "wave", me.id); }, 1000);
      break; }
  } }
function splConnect(){ const ws = { readyState:1, send: json => { let m; try { m = JSON.parse(json); } catch { return; } setTimeout(() => splHandle(m), 0); }, close(){ setTimeout(splConnect, 30); } }; SP.ws = ws; ws.send(JSON.stringify({ t:"hello" })); }

// ---- 疑似 /api
async function splApi(p, opts = {}){ const body = opts.body ? JSON.parse(opts.body) : {}; const path = p.split("?")[0], q = new URLSearchParams(p.split("?")[1] || "");
  if (path === "/api/config") return { googleClientId:"", devLogin:true, slack:false, local:true };
  if (path === "/auth/dev"){ const name = String(body.name || "").trim().slice(0, 30); if (!name) throw new Error("表示名を入れてください");
    let role = "employee", org = ""; const inv = String(body.invite || ""); if (inv){ if (!inv.startsWith("demo:")) throw new Error("この招待リンクは使えません"); role = "guest"; org = decodeURIComponent(inv.slice(5)) || "協力工場"; }
    let avatar = {}; try { avatar = JSON.parse(spLS.get("xspace.local.avatar") || "{}"); } catch {}
    SPL.me = { id:"me_" + role, name, role, org, avatar, status:"在席", checkedIn:false, pos:SPL.myPos }; SPL.users.set(SPL.me.id, SPL.me);
    if (role === "guest" && !SPL.channels.find(c => c.id === "x-" + org)) SPL.channels.push({ id:"x-" + org, name:"連携：" + org, kind:"partner", shared:1, zone:"", orgs:[org] });
    return { token:"local", user:{ id:SPL.me.id, name, role, org, avatar } }; }
  if (path === "/api/me"){ if (!SPL.me) throw new Error("auth"); return { user:SPL.me }; }
  if (path === "/auth/logout"){ SPL.me = null; return { ok:true }; }
  if (path === "/api/invites" && opts.method === "POST"){ if (SPL.me.role !== "employee") throw new Error("権限がありません"); const org = String(body.org || "").trim().slice(0, 40); if (!org) throw new Error("工場名を入れてください");
    if (!SPL.channels.find(c => c.id === "x-" + org)){ const c = { id:"x-" + org, name:"連携：" + org, kind:"partner", shared:1, zone:"", orgs:[org] }; SPL.channels.push(c); splPush({ t:"chans" }); }
    const url = location.href.split(/[?#]/)[0] + "?demo&invite=" + encodeURIComponent("demo:" + org); return { code:"demo", org, channel:"x-" + org, url }; }
  if (path === "/api/search"){ const s = (q.get("q") || "").toLowerCase(); const res = []; for (const ch in SPL.msgs) if (splCanAccess(SPL.me, ch)) for (const m of SPL.msgs[ch]) if (m.text.toLowerCase().includes(s)) res.push(m); return { results: res.sort((a, b) => b.ts - a.ts).slice(0, 50) }; }
  if (path === "/api/attendance") return { rows: SPL.att };
  throw new Error("オフライン体験版では使えません"); }
function splAttendanceCsv(){ return "date,check_in,check_out\n" + SPL.att.map(r => [r.date, r.in, r.out].join(",")).join("\n"); }
function splInit(){ SP.local = true; SPL.channels = SPL_CHANNELS.map(c => ({ ...c })); }
