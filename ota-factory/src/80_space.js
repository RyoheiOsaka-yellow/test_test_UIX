// ================= XANTALOS Space（space.html のみ）：ログイン・アバター・移動・在席・チャット =================
// サーバー（space-server/）と WebSocket でつながり、全員の位置と会話を同期する。
const SP = { cfg:{}, token:"", me:null, ws:null, wsOk:false, retry:0, users:new Map(), avatars:new Map(), channels:[], dms:[], eqs:[], cur:"all", msgs:{}, more:{}, unread:{}, mention:{},
  near:[], pos:{ x:-36, z:12, f:1, ry:Math.PI, mv:0, po:0 }, keys:{}, target:null, sitAfter:null, fp:false, zone:"", lastSent:0, lastSentPos:"", design:false, npc:false, invite:new URLSearchParams(location.search).get("invite") || "", searching:"" };
const SP_STATUS = { "在席":"#3fb950", "集中":"#58a6ff", "会議中":"#f85149", "休憩":"#f2c744", "外出":"#8b949e" };
const SP_COLORS = ["#5b7fa6", "#2f6fd0", "#3fb950", "#f2a93b", "#d13b3b", "#bc8cff", "#2ec4b6", "#e9ecef"];
const SP_CHARS = [["casual_m","私服（男性）"],["casual_f","私服（女性）"],["worker_m","作業服（男性）"],["worker_f","作業服（女性）"]];
const SP_SPOTS = { "受付":[1,-36,12], "機械加工":[1,-28,-14.5], "組立ベイ":[1,4,-14.5], "試験セル":[1,30,-1], "ソフト開発（2F）":[2,-20,10], "設計（3F）":[3,-22,10], "カフェ（3F）":[3,26,9] };
const SP_EMO = { wave:["👋","手を振っています"], like:["👍","いいね！"], bow:["🙇","おじぎ"], clap:["👏","拍手"], coffee:["☕","休憩しませんか？"], ask:["✋","質問があります"], talk:["💬","話しかけています"] };
const SP_EMO_KEYS = ["wave", "like", "bow", "clap", "coffee", "ask"];
const spLS = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch {} }, del(k){ try { localStorage.removeItem(k); } catch {} } };
const spFloorY = f => BLD.lv[f - 1];

// ---------------------------------------------------------------- DOM
function spInjectUI(){
  const css = document.createElement("style"); css.textContent = `
  body.space #views, body.space #stats, body.space #ledger, body.space #hint, body.space #tourCard, body.space #tourBtn, body.space #photosBtn { display:none !important; }
  body.space.design #views, body.space.design #stats, body.space.design #ledger { display:flex !important; } body.space.design #stats, body.space.design #ledger { display:block !important; } body.space.design #ledger { display:flex !important; }
  body.space.design #spSide, body.space.design #spChat { display:none; } body.space #info { right:404px; bottom:68px; }
  #spLogin { position:fixed; inset:0; z-index:300; background:radial-gradient(circle at 50% 30%, #1c2430, #0b0e13 70%); display:flex; align-items:center; justify-content:center; }
  #spLogin .card { width:400px; max-width:92vw; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:26px; display:flex; flex-direction:column; gap:12px; }
  #spLogin img { width:220px; margin:0 auto 4px; display:block; } #spLogin h2 { margin:0; font-size:16px; text-align:center; } #spLogin .sub { text-align:center; }
  #spLogin input, #spSide input, #spSide select, #spChat input { background:#0d1117; color:var(--txt); border:1px solid var(--line); border-radius:7px; padding:8px 10px; font-size:13px; width:100%; }
  #spLogin .err { color:var(--bad); font-size:12px; min-height:16px; text-align:center; } .spInvite { background:#2a2312; border:1px solid #6b5520; color:#f2d48a; border-radius:8px; padding:8px 10px; font-size:12px; }
  .spAvGrid { display:grid; grid-template-columns:1fr 1fr; gap:6px; } .spAvGrid .btn { padding:9px; } .spColors { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; } .spColors i { width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid transparent; } .spColors i.on { border-color:#fff; }
  #spSide { position:absolute; top:56px; left:12px; bottom:12px; width:270px; display:flex; flex-direction:column; gap:8px; z-index:12; padding:10px; }
  #spChat { position:absolute; top:56px; right:12px; bottom:12px; width:380px; display:flex; flex-direction:column; z-index:12; padding:0; overflow:hidden; }
  .spMe { display:flex; gap:10px; align-items:center; } .spDot { width:10px; height:10px; border-radius:50%; display:inline-block; flex:none; } .spAv { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; color:#111; flex:none; }
  .spMe b { font-size:13px; } .spMe .sub { font-size:10.5px; } .spRow { display:flex; gap:6px; align-items:center; }
  .spList { overflow:auto; flex:1; min-height:0; } .spList h4 { margin:10px 0 4px; font-size:10.5px; color:var(--sub); letter-spacing:.06em; font-weight:600; display:flex; justify-content:space-between; align-items:center; }
  .spItem { display:flex; align-items:center; gap:7px; padding:4px 7px; border-radius:6px; cursor:pointer; font-size:12.5px; color:#c9d1d9; } .spItem:hover { background:#21262d; } .spItem.on { background:#2b3340; color:#fff; }
  .spItem .badge { margin-left:auto; background:var(--acc); color:#1a1400; border-radius:9px; font-size:10px; padding:0 6px; font-weight:700; } .spItem .badge.men { background:var(--bad); color:#fff; }
  .spItem .here { margin-left:auto; font-size:10px; color:var(--acc); } .spItem small { color:var(--sub); font-size:10.5px; margin-left:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90px; }
  .spGuest { font-size:9.5px; padding:0 5px; border-radius:4px; background:#6b3d12; color:#ffd7a3; margin-left:4px; white-space:nowrap; }
  #spChat header { padding:10px 14px; border-bottom:1px solid var(--line); } #spChat header b { font-size:14px; } #spChat header .sub { font-size:11px; }
  #spMsgs { flex:1; overflow:auto; padding:8px 12px; display:flex; flex-direction:column; gap:2px; } .spMsg { padding:3px 2px; font-size:13px; line-height:1.5; word-wrap:break-word; }
  .spMsg .h { display:flex; gap:6px; align-items:baseline; margin-top:6px; } .spMsg .h b { font-size:12.5px; } .spMsg .h small { color:var(--sub); font-size:10px; } .spMsg .t { white-space:pre-wrap; color:#dfe6ee; }
  .spMsg .t .men { background:#4a3a10; color:#ffd866; border-radius:3px; padding:0 2px; } .spMsg .t a { color:var(--acc2); } .spSlack { font-size:9.5px; padding:0 5px; border-radius:4px; background:#3b1f4e; color:#e3c4ff; }
  .spEmpty { color:var(--sub); font-size:12px; text-align:center; margin:auto; padding:20px; line-height:1.7; } .spMore { text-align:center; } .spMore .btn { font-size:11px; }
  #spCompose { display:flex; gap:6px; padding:10px; border-top:1px solid var(--line); } #spCompose .btn { flex:none; }
  #spBar { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); z-index:12; display:flex; gap:6px; align-items:center; padding:7px 9px; } body.space #spBar { left:calc(50% - 55px); }
  #spBar select { background:#21262d; color:var(--txt); border:1px solid var(--line); border-radius:7px; padding:5px 6px; font-size:12px; }
  #spBar .emo { font-size:15px; padding:2px 5px; min-width:28px; } #spBar .sep { width:1px; height:20px; background:var(--line); }
  #spHint { position:absolute; left:calc(50% - 55px); bottom:62px; transform:translateX(-50%); z-index:12; background:rgba(13,17,23,.82); border:1px solid var(--line); color:#e6edf3; border-radius:16px; padding:4px 12px; font-size:12px; display:none; pointer-events:none; } #spHint kbd { background:#2b3340; border-radius:4px; padding:0 5px; margin-right:4px; font:600 11px ui-monospace,monospace; }
  #spCross { position:fixed; left:50%; top:50%; width:6px; height:6px; margin:-3px 0 0 -3px; border-radius:50%; background:rgba(255,255,255,.8); box-shadow:0 0 0 1px rgba(0,0,0,.5); z-index:11; display:none; pointer-events:none; } body.spFP #spCross { display:block; }
  #spToast.info { background:#14283d; border-color:#2f6fd0; color:#d6e8ff; }
  #spToast { position:fixed; top:64px; left:50%; transform:translateX(-50%); z-index:320; background:#3a1d1d; border:1px solid #7a3030; color:#ffd1d1; padding:8px 14px; border-radius:8px; font-size:12.5px; display:none; }
  #spConn { color:var(--bad); font-size:11px; display:none; } body.spOffline #spConn { display:inline; }
  .spLink { word-break:break-all; background:#0d1117; border:1px solid var(--line); border-radius:6px; padding:6px; font-size:11px; }
  @media (max-width:1100px){ #spSide { width:220px; } #spChat { width:320px; } body.space #info { right:344px; } }
  @media (max-width:820px){ #spSide { display:none; } #spChat { width:auto; left:12px; top:auto; height:46vh; } #spBar { bottom:auto; top:56px; } body.space #info { display:none !important; } }`;
  document.head.appendChild(css);
  const html = `
  <div id="spLogin"><div class="card"><img src="img/xantalos_logo_white_1000.png" alt="XANTALOS" onerror="this.src=LOGO_W"><h2>XANTALOS Space</h2><div class="sub">工場の 3D 空間でチェックインして、歩いて、話す</div>
    <div id="spInviteNote" class="spInvite" hidden></div><div id="spGoogle" style="display:flex;justify-content:center"></div>
    <div id="spDev" hidden><div class="sub" style="margin-bottom:6px">試作用ログイン（Google 未設定時のみ）</div><div class="spRow"><input id="spDevName" placeholder="表示名" maxlength="30"><button class="btn on" id="spDevGo">入る</button></div></div>
    <div class="err" id="spLoginErr"></div></div></div>
  <div id="spAvatar" style="position:fixed;inset:0;z-index:310;display:none;align-items:center;justify-content:center;background:rgba(5,8,12,.7)"><div class="panel" style="position:static;width:380px;max-width:92vw;padding:20px;display:flex;flex-direction:column;gap:12px">
    <h3 style="margin:0;font-size:14px;color:var(--txt)">アバターを選ぶ</h3><div class="spAvGrid" id="spAvChars"></div><div class="sub">服の色</div><div class="spColors" id="spAvColors"></div>
    <button class="btn on" id="spAvSave" style="padding:9px">この見た目で入る</button></div></div>
  <aside id="spSide" class="panel">
    <div class="spMe"><div class="spAv" id="spMeAv"></div><div style="min-width:0;flex:1"><b id="spMeName"></b><div class="sub" id="spMeSub"></div></div><button class="btn sm" id="spLogout" title="ログアウト">⎋</button></div>
    <div class="spRow"><select id="spStatus">${Object.keys(SP_STATUS).map(s => `<option>${s}</option>`).join("")}</select><button class="btn sm" id="spCheck" style="flex:none;white-space:nowrap">チェックイン</button></div>
    <input id="spSearch" placeholder="メッセージを検索">
    <div class="spList" id="spList"></div>
    <div class="spRow" id="spAdmin" hidden><button class="btn sm" id="spInviteBtn" style="flex:1">社外の方を招待</button><button class="btn sm" id="spAttBtn" style="flex:1">出勤記録 CSV</button></div>
    <span id="spConn">接続が切れました。再接続しています…</span>
  </aside>
  <section id="spChat" class="panel"><header><b id="spChName"></b><div class="sub" id="spChDesc"></div></header><div id="spMsgs"></div>
    <div id="spCompose"><input id="spInput" maxlength="2000" placeholder="メッセージを送信"><button class="btn on" id="spSend">送信</button></div></section>
  <div id="spBar" class="panel"><select id="spGo"><option value="">場所へ移動…</option>${Object.keys(SP_SPOTS).map(k => `<option>${k}</option>`).join("")}</select>
    <button class="btn sm" id="spFP" title="自分の目線で歩く（V キー／ホイールで寄り切る）">👁 一人称</button><span class="sep"></span>
    ${SP_EMO_KEYS.map((k, i) => `<button class="btn sm emo" data-emo="${k}" title="${SP_EMO[k][1]}（${i + 1} キー）">${SP_EMO[k][0]}</button>`).join("")}<span class="sep"></span>
    <button class="btn sm" id="spNpc">NPC を表示</button><button class="btn sm" id="spDesign" hidden>設計ビュー</button>
    <span class="sub" style="font-size:12px;cursor:help" title="WASD／矢印：移動（Shift で速く）&#10;床をクリック：そこへ歩く&#10;椅子をクリック／E：座る・立つ&#10;人をクリック：話しかける・手を振る・DM&#10;V：一人称と三人称の切替&#10;1〜6：しぐさ&#10;Enter：チャット入力">？</span></div>
  <div id="spHint"></div><div id="spCross"></div>
  <div id="spToast"></div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
function spToast(t, kind){ const el = $("spToast"); el.textContent = t; el.className = kind || ""; el.style.display = "block"; clearTimeout(spToast.tm); spToast.tm = setTimeout(() => el.style.display = "none", 3500); }
async function spApi(p, opts = {}){ const r = await fetch(p, { ...opts, headers:{ "Content-Type":"application/json", ...(SP.token ? { Authorization:"Bearer " + SP.token } : {}), ...(opts.headers || {}) } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; }

// ---------------------------------------------------------------- login
async function spStart(){
  spInjectUI(); document.body.classList.add("space");
  try { SP.cfg = await spApi("/api/config"); } catch { $("spLoginErr").textContent = "サーバーに接続できません"; return; }
  if (SP.invite){ const n = $("spInviteNote"); n.hidden = false; n.textContent = "招待リンクから参加しています。ログインすると、招待元の工場との連携チャンネルに入れます。"; }
  const tok = spLS.get("xspace.token");
  if (tok){ SP.token = tok; try { const { user } = await spApi("/api/me"); return spAfterLogin(user); } catch { SP.token = ""; spLS.del("xspace.token"); } }
  if (SP.cfg.googleClientId){ const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = () => {
      google.accounts.id.initialize({ client_id: SP.cfg.googleClientId, callback: r => spLogin("/auth/google", { credential: r.credential, invite: SP.invite }) });
      google.accounts.id.renderButton($("spGoogle"), { theme:"filled_black", size:"large", text:"signin_with", shape:"pill", width:300 }); }; document.head.appendChild(s); }
  if (SP.cfg.devLogin){ $("spDev").hidden = false; $("spDevGo").onclick = () => spLogin("/auth/dev", { name: $("spDevName").value, invite: SP.invite }); $("spDevName").onkeydown = e => { if (e.key === "Enter") $("spDevGo").click(); }; }
}
async function spLogin(p, body){ try { const { token, user } = await spApi(p, { method:"POST", body: JSON.stringify(body) }); SP.token = token; spLS.set("xspace.token", token); spAfterLogin(user); } catch (e){ $("spLoginErr").textContent = e.message; } }
function spAfterLogin(user){
  SP.me = user; $("spLogin").style.display = "none"; document.body.classList.toggle("guest", user.role === "guest");
  if (user.role === "employee"){ $("spAdmin").hidden = false; $("spDesign").hidden = false; }
  if (!user.avatar || !user.avatar.char) spPickAvatar(() => spConnect()); else spConnect();
}
function spPickAvatar(done){
  const el = $("spAvatar"); el.style.display = "flex"; let ch = (SP.me.avatar && SP.me.avatar.char) || "casual_m", col = (SP.me.avatar && SP.me.avatar.color) || SP_COLORS[0];
  const draw = () => { $("spAvChars").innerHTML = SP_CHARS.map(([k, n]) => `<button class="btn${k === ch ? " on" : ""}" data-k="${k}">${n}</button>`).join(""); $("spAvColors").innerHTML = SP_COLORS.map(c => `<i style="background:${c}" class="${c === col ? "on" : ""}" data-c="${c}"></i>`).join("");
    $("spAvChars").querySelectorAll("button").forEach(b => b.onclick = () => { ch = b.dataset.k; draw(); }); $("spAvColors").querySelectorAll("i").forEach(b => b.onclick = () => { col = b.dataset.c; draw(); }); };
  draw(); $("spAvSave").onclick = () => { SP.me.avatar = { char:ch, color:col }; SP.pendingAvatar = SP.me.avatar; el.style.display = "none"; if (SP.wsOk) spSend({ t:"avatar", avatar:SP.me.avatar }); done && done(); };
}

// ---------------------------------------------------------------- connection
function spConnect(){
  const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"); SP.ws = ws;
  ws.onopen = () => { ws.send(JSON.stringify({ t:"hello", token:SP.token })); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } spOnMsg(m); };
  ws.onclose = (e) => { SP.wsOk = false; document.body.classList.add("spOffline"); if (e.code === 4003){ spLS.del("xspace.token"); location.reload(); return; } setTimeout(spConnect, Math.min(15000, 1000 * 2 ** SP.retry++)); };
}
function spSend(m){ if (SP.ws && SP.ws.readyState === 1) SP.ws.send(JSON.stringify(m)); }
function spOnMsg(m){
  switch (m.t){
    case "welcome": { SP.wsOk = true; SP.retry = 0; document.body.classList.remove("spOffline"); SP.me = { ...SP.me, ...m.me }; SP.channels = m.channels; SP.dms = m.dms;
      if (!SP.started){ SP.started = true; SP.pos = { ...SP.pos, ...m.pos }; spEnterWorld(); }
      SP.users.clear(); for (const u of m.users) SP.users.set(u.id, u); for (const u of m.users) spEnsureAvatar(u);
      if (SP.pendingAvatar){ spSend({ t:"avatar", avatar:SP.pendingAvatar }); SP.pendingAvatar = null; }
      if (!SP.channels.find(c => c.id === SP.cur)) SP.cur = (SP.channels[0] || {}).id || "near";
      spSendPos(true); spRenderSide(); spOpen(SP.cur); break; }
    case "pres": { const prev = SP.users.get(m.u.id); SP.users.set(m.u.id, m.u); if (m.u.id === SP.me.id) SP.me = { ...SP.me, ...m.u }; const a = spEnsureAvatar(m.u, true); if (!prev && a && m.u.id !== SP.me.id && m.u.pos){ a.cur = { ...m.u.pos }; a.tgt = { ...m.u.pos }; a.po = m.u.pos.po || 0; } spRenderSide(); break; }
    case "leave": { SP.users.delete(m.id); spRemoveAvatar(m.id); spRenderSide(); break; }
    case "mv": { for (const [id, x, z, f, ry, mv, po] of m.l){ if (id === SP.me.id) continue; const a = SP.avatars.get(id); if (a){ a.tgt = { x, z, f, ry }; a.mv = mv; a.po = po || 0; } const u = SP.users.get(id); if (u) u.f = f; } break; }
    case "msg": spOnChat(m.m); break;
    case "near": { SP.near.push(m.m); if (SP.near.length > 200) SP.near.shift(); spBubble(m.m.uid, m.m.text); if (SP.cur === "near") spRenderMsgs(); else if (m.m.uid !== SP.me.id){ SP.unread.near = (SP.unread.near || 0) + 1; spRenderSide(); } break; }
    case "hist": { if (m.denied){ spToast("このチャンネルは閲覧できません"); break; } const cur = SP.msgs[m.ch] || []; const ids = new Set(cur.map(x => x.id)); SP.msgs[m.ch] = m.msgs.filter(x => !ids.has(x.id)).concat(cur); SP.more[m.ch] = m.more; if (m.ch === SP.cur) spRenderMsgs(m.prepend); break; }
    case "chan": { if (m.c.kind === "dm" && !SP.dms.find(d => d.id === m.c.id)) SP.dms.unshift(m.c); spOpen(m.c.id); break; }
    case "chans": spRefreshChannels(); break;
    case "emo": spOnEmote(m); break;
    case "err": if (m.e !== "auth") spToast(m.e); break;
  }
}
function spRefreshChannels(){ if (SP.ws){ SP.ws.close(); } }   // 再接続で最新のチャンネル一覧を取り直す
function spOnChat(msg){
  (SP.msgs[msg.ch] || (SP.msgs[msg.ch] = [])).push(msg);
  if (msg.ch.startsWith("dm:") && !SP.dms.find(d => d.id === msg.ch)){ const peer = msg.ch.split(":").slice(1).find(x => x !== SP.me.id) || SP.me.id; const u = SP.users.get(peer); SP.dms.unshift({ id:msg.ch, kind:"dm", peer, name: u ? u.name : msg.name }); }
  if (msg.ch.startsWith("eq:") && !SP.eqs.find(e => e.id === msg.ch)) SP.eqs.unshift({ id:msg.ch, name: spEqName(msg.ch.slice(3)), kind:"eq" });
  if (msg.ch === SP.cur) spRenderMsgs(); else if (msg.uid !== SP.me.id){ SP.unread[msg.ch] = (SP.unread[msg.ch] || 0) + 1; if (spMentions(msg.text) || msg.ch.startsWith("dm:")) SP.mention[msg.ch] = 1; spRenderSide(); }
  spTitle();
}
function spMentions(t){ return SP.me && t.includes("@" + SP.me.name); }
function spTitle(){ const n = Object.values(SP.unread).reduce((a, b) => a + b, 0); document.title = (n ? `(${n}) ` : "") + "XANTALOS Space"; }
function spEqName(id){ const e = EQUIP.find(x => x.id === id); return e ? `${e.id} ${e.name}` : id; }

// ---------------------------------------------------------------- side panel
function spInitial(n){ return (n || "?").trim().slice(0, 1).toUpperCase(); }
function spPlace(u){ if (!u) return ""; const z = u.zone && ZONES.find(x => x[0] === u.zone); return z ? z[1].replace(/（.*）/, "") : (u.f ? `${u.f}F` : ""); }
function spChannelName(id){ if (id === "near") return "近くの人"; const c = SP.channels.find(x => x.id === id) || SP.dms.find(x => x.id === id) || SP.eqs.find(x => x.id === id); return c ? c.name : id.startsWith("eq:") ? spEqName(id.slice(3)) : id; }
function spRenderSide(){
  if (!SP.me) return; const me = SP.users.get(SP.me.id) || SP.me; const col = (me.avatar && me.avatar.color) || "#5b7fa6";
  $("spMeAv").style.background = col; $("spMeAv").textContent = spInitial(me.name); $("spMeName").textContent = me.name; $("spMeSub").innerHTML = (me.role === "guest" ? `ゲスト：${pe(me.org)}` : "社員") + ` ・ ${pe(spPlace(me) || "")}`;
  $("spStatus").value = me.status || "在席"; $("spCheck").textContent = me.checkedIn ? "チェックアウト" : "チェックイン"; $("spCheck").classList.toggle("on", !me.checkedIn);
  const zoneCh = SP.channels.find(c => c.zone && SP.zone && c.zone.split(",").includes(SP.zone));
  const nearN = [...SP.users.values()].filter(u => u.id !== SP.me.id && spIsNear(u)).length;
  const item = (id, label, extra = "") => { const un = SP.unread[id] || 0; return `<div class="spItem${SP.cur === id ? " on" : ""}" data-ch="${pe(id)}">${label}${extra}${un ? `<span class="badge${SP.mention[id] ? " men" : ""}">${un}</span>` : ""}</div>`; };
  let h = `<h4>チャンネル</h4>` + item("near", `🗣 近くの人`, `<small>${nearN} 人</small>`);
  for (const c of SP.channels) h += item(c.id, `# ${pe(c.name)}${c.shared ? ` <span class="spGuest">社外</span>` : ""}`, zoneCh && zoneCh.id === c.id ? `<span class="here">● いまここ</span>` : "");
  if (SP.eqs.length){ h += `<h4>設備スレッド</h4>`; for (const e of SP.eqs) h += item(e.id, `⚙ ${pe(e.name)}`); }
  h += `<h4>ダイレクトメッセージ</h4>`; for (const d of SP.dms){ const u = SP.users.get(d.peer); h += item(d.id, `<span class="spDot" style="background:${u ? SP_STATUS[u.status] || "#3fb950" : "#30363d"}"></span>${pe(d.name)}`); }
  const others = [...SP.users.values()].filter(u => u.id !== SP.me.id).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "employee" ? -1 : 1));
  h += `<h4>オンライン <span>${others.length + 1} 人</span></h4>`;
  for (const u of others) h += `<div class="spItem" data-user="${pe(u.id)}"><span class="spDot" style="background:${SP_STATUS[u.status] || "#3fb950"}"></span>${pe(u.name)}${u.role === "guest" ? `<span class="spGuest">${pe(u.org)}</span>` : ""}${u.checkedIn ? " ✓" : ""}<small>${pe(spPlace(u))}</small></div>`;
  if (!others.length) h += `<div class="sub" style="padding:4px 7px">ほかに誰もいません</div>`;
  const list = $("spList"); const st = list.scrollTop; list.innerHTML = h; list.scrollTop = st;
  list.querySelectorAll("[data-ch]").forEach(el => el.onclick = () => spOpen(el.dataset.ch));
  list.querySelectorAll("[data-user]").forEach(el => el.onclick = (ev) => spUserMenu(el.dataset.user, ev));
}
function spUserMenu(id, ev){ const u = SP.users.get(id); if (!u) return; const old = document.getElementById("spMenu"); if (old) old.remove();
  const m = document.createElement("div"); m.id = "spMenu"; m.className = "panel"; m.style.cssText = `position:fixed;left:${ev.clientX + 6}px;top:${ev.clientY}px;z-index:330;display:flex;flex-direction:column;gap:4px;padding:6px`;
  const near = spIsNear(u); m.style.left = Math.min(ev.clientX + 6, innerWidth - 190) + "px"; m.style.top = Math.min(ev.clientY, innerHeight - 190) + "px";
  m.innerHTML = `<div style="font-size:12px;padding:2px 4px 4px;color:var(--txt)"><b>${pe(u.name)}</b>${u.role === "guest" ? `<span class="spGuest">${pe(u.org)}</span>` : ""}<div class="sub" style="font-size:10.5px">${pe(u.status || "在席")} ・ ${pe(spPlace(u))}</div></div>
    <button class="btn sm" data-a="talk">💬 ${near ? "話しかける" : "そばへ行って話しかける"}</button><button class="btn sm" data-a="wave">👋 手を振る</button><button class="btn sm" data-a="dm">✉ メッセージ（DM）</button>`; document.body.appendChild(m);
  m.querySelector('[data-a="talk"]').onclick = () => { spTalkTo(id); m.remove(); };
  m.querySelector('[data-a="wave"]').onclick = () => { spEmote("wave", id); m.remove(); };
  m.querySelector('[data-a="dm"]').onclick = () => { spSend({ t:"dm", to:id }); m.remove(); };
  setTimeout(() => addEventListener("pointerdown", function h(e){ if (!m.contains(e.target)){ m.remove(); removeEventListener("pointerdown", h, true); } }, true), 0); }

// ---------------------------------------------------------------- chat panel
function spOpen(ch){ SP.cur = ch; SP.unread[ch] = 0; SP.mention[ch] = 0; SP.searching = ""; spTitle();
  if (ch !== "near" && !SP.msgs[ch]){ SP.msgs[ch] = []; spSend({ t:"hist", ch }); }
  if (ch.startsWith("eq:") && !SP.eqs.find(e => e.id === ch)) SP.eqs.unshift({ id:ch, name: spEqName(ch.slice(3)), kind:"eq" });
  const c = SP.channels.find(x => x.id === ch);
  $("spChName").textContent = ch === "near" ? "🗣 近くの人" : ch.startsWith("dm:") ? spChannelName(ch) : ch.startsWith("eq:") ? "⚙ " + spEqName(ch.slice(3)) : "# " + spChannelName(ch);
  $("spChDesc").textContent = ch === "near" ? `半径 ${10} m・同じ階の人にだけ届きます。履歴は残りません。` : ch.startsWith("dm:") ? "ダイレクトメッセージ" : ch.startsWith("eq:") ? "この設備についての会話（社員のみ）" : c && c.shared ? "社外の方も参加しているチャンネルです" : c && c.kind === "zone" ? "この場所にいる人のチャンネル" : "社員のチャンネル";
  $("spInput").placeholder = ch === "near" ? "近くの人に話しかける" : `${spChannelName(ch)} へ送信`;
  spRenderSide(); spRenderMsgs(); }
function spFmt(t){ let s = pe(t).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`); if (SP.me) s = s.replace(new RegExp("@" + pe(SP.me.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), x => `<span class="men">${x}</span>`); return s; }
function spRenderMsgs(prepend){
  const box = $("spMsgs"); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60; const prevH = box.scrollHeight;
  const list = SP.searching ? SP.searchResults || [] : SP.cur === "near" ? SP.near : (SP.msgs[SP.cur] || []);
  let h = ""; if (!SP.searching && SP.more[SP.cur]) h += `<div class="spMore"><button class="btn sm" id="spMoreBtn">さらに前を読む</button></div>`;
  if (!list.length) h += `<div class="spEmpty">${SP.searching ? "見つかりませんでした" : SP.cur === "near" ? "近くにいる人に話しかけてみましょう。<br>アバターの頭上に吹き出しが出ます。" : "まだメッセージはありません。"}</div>`;
  let prev = null;
  for (const m of list){ const grouped = !SP.searching && prev && prev.uid === m.uid && m.ts - prev.ts < 5 * 60e3; const u = SP.users.get(m.uid); const col = (u && u.avatar && u.avatar.color) || "#8b949e";
    h += `<div class="spMsg">${grouped ? "" : `<div class="h"><span class="spDot" style="background:${col}"></span><b>${pe(m.name)}</b>${m.org ? `<span class="spGuest">${pe(m.org)}</span>` : ""}${m.src === "slack" ? `<span class="spSlack">Slack</span>` : ""}<small>${SP.searching ? pe(spChannelName(m.ch)) + " ・ " : ""}${new Date(m.ts).toLocaleString("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}</small></div>`}<div class="t">${spFmt(m.text)}</div></div>`; prev = m; }
  box.innerHTML = h; const mb = $("spMoreBtn"); if (mb) mb.onclick = () => { const first = (SP.msgs[SP.cur] || [])[0]; if (first) spSend({ t:"hist", ch:SP.cur, before:first.id }); SP.prependNext = true; };
  if (prepend || SP.prependNext){ box.scrollTop = box.scrollHeight - prevH; SP.prependNext = false; } else if (atBottom || !prepend) box.scrollTop = box.scrollHeight; }
function spSubmit(){ const inp = $("spInput"); const text = inp.value.trim(); if (!text) return; if (SP.searching){ SP.searching = ""; } spSend({ t:"say", ch:SP.cur, text }); inp.value = ""; }

// ---------------------------------------------------------------- avatars
function spTag(u){ const cvs = document.createElement("canvas"); const c = cvs.getContext("2d"); const fs = 34; const name = u.name + (u.role === "guest" ? `（${u.org}）` : ""); c.font = `700 ${fs}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`;
  const w = Math.ceil(c.measureText(name).width + 64); cvs.width = w; cvs.height = fs + 22; c.font = `700 ${fs}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`;
  c.fillStyle = u.role === "guest" ? "rgba(90,50,14,0.92)" : "rgba(13,17,23,0.85)"; c.beginPath(); c.roundRect(0, 0, w, cvs.height, 14); c.fill();
  c.fillStyle = SP_STATUS[u.status] || "#3fb950"; c.beginPath(); c.arc(24, cvs.height / 2, 9, 0, 6.3); c.fill(); c.fillStyle = "#fff"; c.textBaseline = "middle"; c.fillText(name, 44, cvs.height / 2 + 2);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false, depthWrite:false, sizeAttenuation:false, transparent:true }));
  const hN = 0.026; sp.scale.set(w / cvs.height * hN / (innerWidth / innerHeight), hN, 1); sp.renderOrder = 70; sp.userData.aspect = w / cvs.height; return sp; }
function spBubbleSprite(text, big){ const cvs = document.createElement("canvas"); const c = cvs.getContext("2d"); const fs = big ? 52 : 30; c.font = `500 ${fs}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`;
  const lines = []; let line = ""; for (const ch of text.slice(0, 80)){ if (c.measureText(line + ch).width > 420){ lines.push(line); line = ""; } line += ch; } lines.push(line);
  const w = Math.ceil(Math.max(...lines.map(l => c.measureText(l).width)) + 40), h = lines.length * fs * 1.3 + 28; cvs.width = w; cvs.height = h + 14; c.font = `500 ${fs}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`;
  c.fillStyle = "rgba(255,255,255,0.96)"; c.beginPath(); c.roundRect(0, 0, w, h, 16); c.fill(); c.beginPath(); c.moveTo(w / 2 - 12, h); c.lineTo(w / 2, h + 14); c.lineTo(w / 2 + 12, h); c.fill();
  c.fillStyle = "#111"; c.textBaseline = "top"; lines.forEach((l, i) => c.fillText(l, 20, 14 + i * fs * 1.3));
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false, depthWrite:false, sizeAttenuation:false, transparent:true }));
  const hN = 0.024 * (cvs.height / 56); sp.scale.set(cvs.width / cvs.height * hN / (innerWidth / innerHeight), hN, 1); sp.renderOrder = 71; sp.center.set(0.5, 0); return sp; }
const SP_ROOT = new THREE.Group(); SP_ROOT.name = "spaceAvatars";
function spEnsureAvatar(u, refresh){
  let a = SP.avatars.get(u.id); const key = JSON.stringify(u.avatar || {}), tagKey = JSON.stringify([u.name, u.status, u.org, u.role]);
  if (a && a.key === key){ if (a.tagKey !== tagKey){ a.g.remove(a.tag); a.tag = spTag(u); a.tag.position.y = 1.95; a.g.add(a.tag); a.tagKey = tagKey; } return a; }
  let keep = null; if (a){ keep = { cur:a.cur, tgt:a.tgt, mv:a.mv, po:a.po }; spRemoveAvatar(u.id); a = null; }
  const g = new THREE.Group(); g.userData.spUser = u.id; const fb = makeWorker(u.avatar && u.avatar.char && u.avatar.char.startsWith("worker") ? "hall" : "office"); fb.userData.spFallback = true; g.add(fb);
  const tag = spTag(u); tag.position.y = 1.95; g.add(tag); SP_ROOT.add(g);
  const isMe = u.id === SP.me.id; const p = isMe ? SP.pos : (u.pos || { x:-36, z:12, f:u.f || 1, ry:0 });
  a = { g, tag, key, tagKey, cur:{ x:p.x, z:p.z, f:p.f || 1, ry:p.ry || 0 }, tgt:{ x:p.x, z:p.z, f:p.f || 1, ry:p.ry || 0 }, mv:0, po: p.po || 0, blend:0, bubble:null, until:0, ...(keep || {}) }; SP.avatars.set(u.id, a);
  const char = (u.avatar && u.avatar.char) || "casual_m";
  loadChar(char).then(ch => { if (SP.avatars.get(u.id) !== a) return; const root = SkeletonUtils.clone(ch.scene); root.scale.setScalar(1.72 / ch.h);
    const of = outfit(char.startsWith("worker") ? "hall" : "office", sRand("sp" + u.id)); const col = (u.avatar && u.avatar.color) || "#5b7fa6"; of.Shirt = col; if (char.startsWith("worker")) of.Vest = col; dressChar(root, of);
    root.traverse(o => { if (o.isMesh) o.userData.spUser = u.id; }); fb.visible = false; g.add(root);
    const mx = new THREE.AnimationMixer(root); const idle = mx.clipAction(ch.anims.find(x => x.name === "Idle")); const walk = mx.clipAction(ch.anims.find(x => x.name === "Walk")); idle.play(); walk.play(); walk.setEffectiveWeight(0);
    const sitClip = ch.anims.find(x => x.name === "SitDown"); const sit = sitClip ? mx.clipAction(sitClip) : null; if (sit){ sit.setLoop(THREE.LoopOnce); sit.clampWhenFinished = true; }
    root.rotation.order = "YXZ"; Object.assign(a, { mx, idle, walk, sit, root, scale: 1.72 / ch.h, sitting:false }); spSitPose(char).then(o => { a.sitOff = o; }).catch(() => {}); dirtyShadow(); }).catch(() => {});
  return a; }
function spRemoveAvatar(id){ const a = SP.avatars.get(id); if (!a) return; SP_ROOT.remove(a.g); SP.avatars.delete(id); }
function spBubble(uid, text, ms = 7000, big = false){ const a = SP.avatars.get(uid); if (!a) return; if (a.bubble) a.g.remove(a.bubble); a.bubble = spBubbleSprite(text, big); a.bubble.position.y = a.po === 1 ? 1.75 : 2.3; a.g.add(a.bubble); a.until = performance.now() + ms; }
function spIsNear(u){ const a = SP.avatars.get(u.id); if (!a) return false; return a.cur.f === SP.pos.f && Math.hypot(a.cur.x - SP.pos.x, a.cur.z - SP.pos.z) <= 10; }

// ---------------------------------------------------------------- movement & camera
function spBounds(f, x, z){ const { x0, x1, z0, zh, z1, terraceZ } = BLD;
  if (f === 1) return [clamp(x, -SITE.w / 2 + 0.5, SITE.w / 2 - 0.5), clamp(z, -SITE.d / 2 + 0.5, SITE.d / 2 + 14)];
  if (f === 2) return [clamp(x, x0 + 0.5, x1 - 0.5), clamp(z, zh - 1.8, terraceZ - 0.6)];
  return [clamp(x, x0 + 0.5, x1 - 0.5), clamp(z, zh - 0.8, z1 - 0.5)]; }
function spSendPos(force){ const p = SP.pos; const s = [p.x.toFixed(2), p.z.toFixed(2), p.f, p.ry.toFixed(1), p.mv, p.po].join(); const now = performance.now();
  if (!force && (s === SP.lastSentPos || now - SP.lastSent < 120) && now - SP.lastSent < 2000) return; SP.lastSent = now; SP.lastSentPos = s; spSend({ t:"mv", x:p.x, z:p.z, f:p.f, ry:p.ry, mv:p.mv, po:p.po, zone:SP.zone }); }
function spViewFor(p){ if (p.f >= 2) return p.f; const { x0, x1, z0 } = BLD; return (p.x > x0 - 0.5 && p.x < x1 + 0.5 && p.z > z0 - 0.5 && p.z < BLD.z1 + 0.5) ? 1 : "ext"; }
// ---------------------------------------------------------------- seats（座る）
let SP_SEATS = null;
function spFloorOf(y){ let best = 0, bd = 0.7; BLD.lv.forEach((ly, i) => { const d = Math.abs(y - ly); if (d < bd){ bd = d; best = i + 1; } }); return best; }
function spSeats(){ if (SP_SEATS) return SP_SEATS; SP_SEATS = []; const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const s of SEATS_RAW){ let top = s.parent; while (top.parent) top = top.parent; if (top !== scene) continue;
    s.parent.updateWorldMatrix(true, false); s.parent.getWorldQuaternion(q); e.setFromQuaternion(q, "YXZ");
    for (const [x, y, z, ry] of s.list){ v.set(x, y, z).applyMatrix4(s.parent.matrixWorld); const f = spFloorOf(v.y); if (f) SP_SEATS.push({ x:v.x, z:v.z, f, ry: ry + e.y }); } }
  return SP_SEATS; }
function spSeatNear(x, z, f, r){ let best = null, bd = r; for (const st of spSeats()){ if (st.f !== f) continue; const d = Math.hypot(st.x - x, st.z - z); if (d < bd){ bd = d; best = st; } } return best; }
function spSeatTaken(st){ for (const [id, a] of SP.avatars){ if (id !== SP.me.id && a.po === 1 && a.cur.f === st.f && Math.hypot(a.cur.x - st.x, a.cur.z - st.z) < 0.35) return true; } return false; }
function spSitAt(st){ if (spSeatTaken(st)) return spToast("この席は使われています", "info");
  SP.sitAfter = st; SP.target = { x: st.x, z: st.z }; }
function spDoSit(st){ const p = SP.pos; SP.sitAfter = null; SP.target = null; Object.assign(p, { x:st.x, z:st.z, ry:st.ry, po:1, mv:0 }); spSendPos(true); }
function spStand(){ const p = SP.pos; if (!p.po) return; p.po = 0; p.x += Math.sin(p.ry) * 0.55; p.z += Math.cos(p.ry) * 0.55; spSendPos(true); }
// 着席ポーズ（SitDown の最終姿勢）で腰を座面に合わせるためのオフセット。キャラごとに 1 回だけ計算
const SP_SITPOSE = {};
function spSitPose(char){ return SP_SITPOSE[char] || (SP_SITPOSE[char] = loadChar(char).then(ch => { const b = bakePose(ch, "SitDown"); b.parts.forEach(x => x.geo.dispose()); return { ax:b.anchor.x, az:b.anchor.z, minY:b.minY }; })); }

// ---------------------------------------------------------------- 一人称
function spSetFP(on){ if (SP.design) return; SP.fp = on; document.body.classList.toggle("spFP", on); $("spFP").classList.toggle("on", on); $("spFP").textContent = on ? "👁 三人称" : "👁 一人称";
  if (on){ camGoal.pitch = camState.pitch = 0.35; } else setCam({ dist:11, pitch:0.38 }); camDirty = true; }
const _spDir = new THREE.Vector3();
function spCamFP(){ if (!SP.started || !SP.fp || SP.design) return false;
  const s = camState, g = camGoal; s.yaw = lerp(s.yaw, g.yaw, 0.35); s.pitch = lerp(s.pitch, g.pitch, 0.35); s.dist = g.dist; s.target.copy(g.target);
  const p = SP.pos; const lp = clamp((0.35 - s.pitch) * 1.4, -1.2, 0.75);
  camera.position.set(p.x - Math.sin(s.yaw) * 0.12, spFloorY(p.f) + (p.po ? 1.2 : 1.62), p.z - Math.cos(s.yaw) * 0.12);
  _spDir.set(-Math.sin(s.yaw) * Math.cos(lp), Math.sin(lp), -Math.cos(s.yaw) * Math.cos(lp)).add(camera.position); camera.lookAt(_spDir); return true; }

// ---------------------------------------------------------------- しぐさ・話しかける
function spEmote(e, to){ if (!SP_EMO[e]) return; spSend({ t:"emo", e, to: to || "" }); }
function spOnEmote(m){ const a = SP.avatars.get(m.uid); const [icon, label] = SP_EMO[m.e] || ["", ""]; if (!icon) return;
  if (a){ spBubble(m.uid, icon, 2600, true); a.emo = { e:m.e, t0:performance.now() }; }
  if (m.to === SP.me.id && m.uid !== SP.me.id){ spToast(`${m.name} さんが${m.e === "talk" ? "話しかけています" : label} ${icon}`, "info");
    if (m.e === "talk" && a){ const p = SP.pos; if (!p.po && !p.mv){ p.ry = Math.atan2(a.cur.x - p.x, a.cur.z - p.z); spSendPos(true); } if (SP.cur !== "near") SP.unread.near = (SP.unread.near || 0) + 1, SP.mention.near = 1, spRenderSide(); } } }
function spTalkTo(id){ const a = SP.avatars.get(id); if (!a) return; const p = SP.pos; const u = SP.users.get(id);
  if (a.cur.f !== p.f || Math.hypot(a.cur.x - p.x, a.cur.z - p.z) > 2.2){ spStand(); const ang = Math.atan2(p.x - a.cur.x, p.z - a.cur.z); const fr = a.po === 1 ? a.cur.ry : ang;   // 座っている相手には正面から
    if (a.cur.f !== p.f){ Object.assign(p, { f:a.cur.f, x:a.cur.x + Math.sin(fr) * 1.4, z:a.cur.z + Math.cos(fr) * 1.4 }); SP.target = null; }
    else { const [tx, tz] = spBounds(p.f, a.cur.x + Math.sin(fr) * 1.3, a.cur.z + Math.cos(fr) * 1.3); SP.target = { x:tx, z:tz }; }
    SP.faceAfter = id; }
  else if (!p.po){ p.ry = Math.atan2(a.cur.x - p.x, a.cur.z - p.z); spSendPos(true); }
  spEmote("talk", id); spOpen("near"); const inp = $("spInput"); inp.placeholder = `${u ? u.name : ""} さんに話しかける（近くの人に届きます）`; inp.focus(); }

// ---------------------------------------------------------------- tick
let spPrevT = performance.now();
function spTick(){
  requestAnimationFrame(spTick); const now = performance.now(); const dt = Math.min(0.05, (now - spPrevT) / 1000); spPrevT = now; if (!SP.started) return;
  const p = SP.pos; const k = SP.keys; let ix = 0, iz = 0;
  if (k.KeyW || k.ArrowUp) iz += 1; if (k.KeyS || k.ArrowDown) iz -= 1; if (k.KeyA || k.ArrowLeft) ix -= 1; if (k.KeyD || k.ArrowRight) ix += 1;
  let dx = 0, dz = 0; const yaw = camState.yaw; const sp = (k.ShiftLeft || k.ShiftRight ? 6 : 3.2) * dt;
  if (ix || iz){ SP.target = null; SP.sitAfter = null; SP.faceAfter = null; if (p.po) spStand(); const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); dx = fx * iz + rx * ix; dz = fz * iz + rz * ix; const l = Math.hypot(dx, dz); dx = dx / l * sp; dz = dz / l * sp; }
  else if (SP.target){ const tx = SP.target.x - p.x, tz = SP.target.z - p.z, l = Math.hypot(tx, tz);
    if (l < 0.15 || (SP.sitAfter && l < 0.6)){ SP.target = null; if (SP.sitAfter) spDoSit(SP.sitAfter); else if (SP.faceAfter){ const a = SP.avatars.get(SP.faceAfter); if (a) p.ry = Math.atan2(a.cur.x - p.x, a.cur.z - p.z); SP.faceAfter = null; spSendPos(true); } }
    else { const s = Math.min(l, 3.2 * dt); dx = tx / l * s; dz = tz / l * s; } }
  p.mv = (dx || dz) ? 1 : 0; if (p.mv){ [p.x, p.z] = spBounds(p.f, p.x + dx, p.z + dz); p.ry = Math.atan2(dx, dz); }
  else if (SP.fp && !p.po){ const want = yaw + Math.PI; if (Math.abs(Math.atan2(Math.sin(want - p.ry), Math.cos(want - p.ry))) > 0.05) p.ry = want; }   // 一人称では見ている方向を向く
  const zn = zoneAt(p.x, p.z, p.f); const zid = zn ? zn[0] : ""; if (zid !== SP.zone){ SP.zone = zid; spSendPos(true); spRenderSide(); } else spSendPos(false);
  const v = SP.fp ? "ext" : spViewFor(p); if (!SP.design && v !== mode) setMode(v);   // 一人称は天井・上階も表示
  if (!SP.design){ camGoal.target.set(p.x, spFloorY(p.f) + (p.po ? 1.0 : 1.3), p.z); camDirty = true; }
  // 操作ヒント（座れる席が近い／座っている）
  if (now - (SP.hintAt || 0) > 200){ SP.hintAt = now; const h = $("spHint"); let t = "";
    if (p.po) t = "<kbd>E</kbd>立ち上がる ・ WASD でも立てます"; else if (!SP.design){ const st = spSeatNear(p.x, p.z, p.f, 1.6); if (st) t = "<kbd>E</kbd>座る"; }
    if (t !== SP.hintTxt){ SP.hintTxt = t; h.innerHTML = t; h.style.display = t ? "block" : "none"; } }
  // アバター更新
  const viewF = mode === "ext" ? 1 : Number(mode);
  for (const [id, a] of SP.avatars){ const isMe = id === SP.me.id;
    if (isMe){ a.cur = { x:p.x, z:p.z, f:p.f, ry:p.ry }; a.mv = p.mv; a.po = p.po; }
    else { const t = Math.min(1, dt * 8); a.cur.x += (a.tgt.x - a.cur.x) * t; a.cur.z += (a.tgt.z - a.cur.z) * t; a.cur.f = a.tgt.f; a.cur.ry = lerpAngle(a.cur.ry, a.tgt.ry, t); }
    a.g.position.set(a.cur.x, spFloorY(a.cur.f), a.cur.z); a.g.children.forEach(c => { if (!c.isSprite) c.rotation.y = a.cur.ry; });
    a.g.visible = SP.design || (SP.fp ? !isMe && a.cur.f === p.f && Math.hypot(a.cur.x - p.x, a.cur.z - p.z) < 45 : (mode === "ext" ? a.cur.f === 1 : a.cur.f <= viewF));
    const sit = a.po === 1;
    if (a.mx){
      if (sit !== a.sitting && a.sit){ a.sitting = sit; if (sit){ a.sit.reset(); a.sit.setEffectiveWeight(1); a.sit.play(); } else { a.sit.stop(); a.root.position.set(0, 0, 0); } }
      if (a.sitting){ a.idle.setEffectiveWeight(0); a.walk.setEffectiveWeight(0); a.blend = 0;
        if (a.sitOff){ const o = a.sitOff, sc = a.scale, lx = -o.ax * sc, lz = (-o.az + 0.12) * sc, c = Math.cos(a.cur.ry), sn = Math.sin(a.cur.ry); a.root.position.set(lx * c + lz * sn, -o.minY * sc, -lx * sn + lz * c); } }
      else { a.blend += ((a.mv ? 1 : 0) - a.blend) * Math.min(1, dt * 8); a.walk.setEffectiveWeight(a.blend); a.idle.setEffectiveWeight(1 - a.blend); }
      a.mx.update(dt); }
    else { const w = a.g.children.find(c => c.userData.spFallback); if (w && w.userData.legs){ const ph = a.mv ? Math.sin(now / 1000 * 7) * 0.45 : 0; w.userData.legs[0].rotation.x = sit ? -1.4 : ph; w.userData.legs[1].rotation.x = sit ? -1.4 : -ph; w.position.y = sit ? 0.05 : 0; } }
    // しぐさ：手を振る・拍手は小さく跳ねる、おじぎは前に傾ける
    const body = a.root || a.g.children.find(c => c.userData.spFallback);
    if (a.emo && body){ const t = (now - a.emo.t0) / 1000;
      if (t > 1.4){ a.emo = null; body.rotation.x = 0; if (!a.sitting) body.position.y = 0; }
      else if (a.emo.e === "bow") body.rotation.x = Math.sin(Math.min(1, t / 1.2) * Math.PI) * 0.45;
      else if (!a.sitting) body.position.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.09 * (1 - t / 1.4); }
    if (a.bubble && now > a.until){ a.g.remove(a.bubble); a.bubble = null; } }
}
// 三人称カメラの遮蔽回避：注視点→カメラの線分上に建物などがあれば手前に寄せる（6 Hz で判定、滑らかに追従）
const SP_CAM = { ray:new THREE.Raycaster(), last:0, clip:Infinity, cur:Infinity, list:[], listAt:0 };
function spCamTargets(){ const out = [];
  (function walk(o){ if (!o.visible || o === SP_ROOT || o.isSprite || o.isLine || o.isPoints) return;
    if (o.isMesh){ const m = Array.isArray(o.material) ? o.material[0] : o.material; const g = o.geometry;
      if (m && !(m.transparent && m.opacity < 0.6) && m.colorWrite !== false){ if (!g.boundingSphere) g.computeBoundingSphere(); if (g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 0.7) out.push(o); } }
    for (const c of o.children) walk(c); })(scene);
  return out; }
function spCamCollide(pos, tgt){
  if (!SP.started || SP.design) { SP_CAM.cur = Infinity; return; }
  const now = performance.now(); const d = pos.distanceTo(tgt);
  if (now - SP_CAM.last > 160){ SP_CAM.last = now;
    if (now - SP_CAM.listAt > 1500){ SP_CAM.list = spCamTargets(); SP_CAM.listAt = now; }
    const dir = pos.clone().sub(tgt).normalize(); SP_CAM.ray.set(tgt, dir); SP_CAM.ray.near = 0.6; SP_CAM.ray.far = d;
    const hit = SP_CAM.ray.intersectObjects(SP_CAM.list, false)[0]; SP_CAM.clip = hit ? Math.max(2.2, hit.distance - 0.4) : Infinity; }
  const goal = Math.min(SP_CAM.clip, d); SP_CAM.cur = SP_CAM.cur === Infinity ? goal : SP_CAM.cur + (goal - SP_CAM.cur) * 0.2;
  if (SP_CAM.cur < d - 0.01){ pos.sub(tgt).multiplyScalar(SP_CAM.cur / d).add(tgt); camDirty = true; }
}
function spEnterWorld(){
  scene.add(SP_ROOT); setMode(spViewFor(SP.pos)); setCam({ yaw:0, pitch:0.38, dist:11, target:[SP.pos.x, spFloorY(SP.pos.f) + 1.3, SP.pos.z] }, true); camCollide = spCamCollide; camOverride = spCamFP;
  spNpc(false); setInterval(() => { if (!SP.npc) spNpc(false); }, 4000); spTick();
  addEventListener("resize", () => { for (const a of SP.avatars.values()) for (const s of [a.tag, a.bubble]) if (s){ const hN = s.scale.y; s.scale.x = s.material.map.image.width / s.material.map.image.height * hN / (innerWidth / innerHeight); } });
}
function spNpc(on){ SP.npc = on; $("spNpc").classList.toggle("on", on); $("spNpc").textContent = on ? "NPC を隠す" : "NPC を表示";
  scene.traverse(o => { if (o === SP_ROOT) return; let inSp = false; for (let q = o.parent; q; q = q.parent) if (q === SP_ROOT){ inSp = true; break; } if (inSp) return;
    if (o.userData.person || (o.userData.legs && !o.userData.spFallback) || o.name === "seatedPeople") o.visible = on; }); dirtyShadow(); }

// ---------------------------------------------------------------- input wiring
function spWire(){
  const typing = e => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
  addEventListener("keydown", e => { if (typing(e)) return;
    if (SP.started && !SP.design && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey){
      if (/^[1-6]$/.test(e.key)){ spEmote(SP_EMO_KEYS[+e.key - 1]); e.stopPropagation(); return; }
      if (e.code === "KeyV"){ spSetFP(!SP.fp); e.stopPropagation(); return; }
      if (e.code === "KeyE"){ const p = SP.pos; if (p.po) spStand(); else { const st = spSeatNear(p.x, p.z, p.f, 1.6); if (st) spSitAt(st); } e.stopPropagation(); return; }
      if (e.key === "Escape" && SP.fp){ spSetFP(false); return; } }
    if (SP.started && !SP.design && /^[tT0-4]$/.test(e.key)){ e.stopPropagation(); return; } if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)){ SP.keys[e.code] = true; if (e.code.startsWith("Arrow")) e.preventDefault(); } if (e.key === "Enter" && SP.started){ $("spInput").focus(); e.preventDefault(); } }, true);
  addEventListener("keyup", e => { SP.keys[e.code] = false; });
  addEventListener("blur", () => { SP.keys = {}; });
  $("spInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing){ e.preventDefault(); spSubmit(); } if (e.key === "Escape") e.target.blur(); e.stopPropagation(); });
  $("spSend").onclick = spSubmit;
  $("spStatus").onchange = e => spSend({ t:"status", s:e.target.value });
  $("spCheck").onclick = () => { const me = SP.users.get(SP.me.id) || SP.me; spSend({ t: me.checkedIn ? "checkout" : "checkin" }); };
  $("spLogout").onclick = async () => { try { await spApi("/auth/logout", { method:"POST" }); } catch {} spLS.del("xspace.token"); location.href = location.pathname; };
  $("spSearch").addEventListener("keydown", async e => { e.stopPropagation(); if (e.key !== "Enter") return; const q = e.target.value.trim(); if (!q){ SP.searching = ""; return spOpen(SP.cur); }
    try { const { results } = await spApi("/api/search?q=" + encodeURIComponent(q)); SP.searching = q; SP.searchResults = results.slice().reverse(); $("spChName").textContent = `🔍 「${q}」の検索結果`; $("spChDesc").textContent = `${results.length} 件`; spRenderMsgs(); } catch (err){ spToast(err.message); } });
  $("spGo").onchange = e => { const s = SP_SPOTS[e.target.value]; if (s){ Object.assign(SP.pos, { f:s[0], x:s[1], z:s[2], po:0 }); SP.sitAfter = null; SP.target = null; spSendPos(true); } e.target.value = ""; };
  $("spNpc").onclick = () => spNpc(!SP.npc);
  $("spFP").onclick = () => spSetFP(!SP.fp);
  document.querySelectorAll("#spBar [data-emo]").forEach(b => b.onclick = () => spEmote(b.dataset.emo));
  cvsEl.addEventListener("wheel", e => { if (!SP.started || SP.design) return; if (SP.fp && e.deltaY > 0) spSetFP(false); else if (!SP.fp && e.deltaY < 0 && camGoal.dist <= 3.01) spSetFP(true); }, { passive:true });
  $("spDesign").onclick = () => { if (SP.fp) spSetFP(false); SP.design = !SP.design; document.body.classList.toggle("design", SP.design); $("spDesign").classList.toggle("on", SP.design); $("spDesign").textContent = SP.design ? "チャットに戻る" : "設計ビュー"; if (!SP.design) setCam({ dist:11, pitch:0.38 }); };
  $("spInviteBtn").onclick = async () => { const org = prompt("招待する工場・会社の名前"); if (!org) return; const email = prompt("招待する方のメールアドレス（空欄なら誰でも使えるリンク）", "") || "";
    try { const r = await spApi("/api/invites", { method:"POST", body: JSON.stringify({ org, email }) }); try { await navigator.clipboard.writeText(r.url); } catch {}
      SP.msgs.__invite = true; $("spMsgs").insertAdjacentHTML("beforeend", `<div class="spMsg"><div class="h"><b>招待リンクを作りました</b><small>${pe(r.org)}</small></div><div class="t">チャンネル「連携：${pe(r.org)}」に参加できます。30 日間有効です。<div class="spLink">${pe(r.url)}</div></div></div>`); $("spMsgs").scrollTop = 1e9; } catch (err){ spToast(err.message); } };
  $("spAttBtn").onclick = async () => { try { const r = await fetch("/api/attendance?format=csv", { headers:{ Authorization:"Bearer " + SP.token } }); if (!r.ok) throw new Error("取得できませんでした"); const b = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); } catch (err){ spToast(err.message); } };
  // 3D 上のクリック：アバター → DM、設備 → スレッド、床 → そこへ歩く
  cvsEl.addEventListener("pointerup", e => { if (!SP.started || SP.design || drag.moved > 6 || e.button !== 0) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const ah = ray.intersectObject(SP_ROOT, true).find(h => !h.object.isSprite && h.object.userData.spUser && h.object.visible); if (ah){ const uid = ah.object.userData.spUser; if (uid !== SP.me.id) spUserMenu(uid, e); return; }
    { const pt = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(spFloorY(SP.pos.f) + 0.45)), pt)){ const st = spSeatNear(pt.x, pt.z, SP.pos.f, 0.4); if (st){ spStand(); spSitAt(st); return; } } }
    const id = pickAt(e.clientX, e.clientY); if (typeof id === "string" && SP.me.role === "employee"){ spOpen("eq:" + id); return; }
    const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -spFloorY(SP.pos.f)); const pt = new THREE.Vector3(); if (ray.ray.intersectPlane(pl, pt)){ spStand(); SP.sitAfter = null; const [bx, bz] = spBounds(SP.pos.f, pt.x, pt.z); SP.target = { x:bx, z:bz }; } });
}
// ファクトリーモデルの構築完了を待ってから起動
{ const t = setInterval(() => { const l = document.getElementById("loading"); if (l && l.style.display === "none"){ clearInterval(t); spStart().then(spWire).catch(err => console.error(err)); } }, 120); }
window.__space = SP; window.__spaceFn = { spSeats, spSeatNear, spSitAt, spStand, spSetFP, spTalkTo, spEmote, SEATS_RAW };   // 検証用
