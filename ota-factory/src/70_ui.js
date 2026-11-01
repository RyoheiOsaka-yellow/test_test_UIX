// ================= UI・モード切替・ピック・ツアー・メインループ =================
const $ = id => document.getElementById(id);

// ---- 視点プリセット ----
const VIEWS = [
  ["全景",      { yaw:-0.6, pitch:0.42, dist:150, target:[0,6,0] }, "ext"],
  ["正面（南）",{ yaw:0.05, pitch:0.2, dist:125, target:[0,8,20] }, "ext"],
  ["俯瞰",      { yaw:-0.2, pitch:1.35, dist:210, target:[0,0,0] }, "ext"],
  ["東ドック",  { yaw:2.0, pitch:0.5, dist:60, target:[44,6,-14] }, "ext"],
  ["前庭・ロビー",{ yaw:-0.55, pitch:0.18, dist:70, target:[-30,4,24] }, "ext"],
  ["西面 夕景",  { yaw:-0.78, pitch:0.26, dist:32, target:[-44,5,-16] }, "ext", "dusk"],
  ["夜景",      { yaw:-0.5, pitch:0.3, dist:110, target:[0,6,10] }, "ext", "night"],
  ["ホール全景",{ yaw:-0.5, pitch:0.5, dist:140, target:[0,5,-12] }, 1],
  ["機械加工",  { yaw:-2.5, pitch:0.55, dist:50, target:[-28,3,-14] }, 1],
  ["組立ベイ",  { yaw:-0.7, pitch:0.45, dist:42, target:[-2,4,-16] }, 1],
  ["試験セル",  { yaw:2.6, pitch:0.6, dist:40, target:[28,3,-6] }, 1],
  ["2F ソフト", { yaw:-1.05, pitch:0.42, dist:60, target:[-20,7,10] }, 2],
  ["3F 設計",   { yaw:-0.9, pitch:0.42, dist:60, target:[-20,11.5,10] }, 3],
];
let mode = "ext";   // ext | 1 | 2 | 3
function setMode(m, keepCam=false){
  mode = m; document.querySelectorAll("#topbar [data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === String(m)));
  const f = m === "ext" ? 99 : Number(m);
  FL[1].visible = true; FL[2].visible = f >= 2; FL[3].visible = f >= 3; FL.roof.visible = f >= 4 || m === "ext";
  // 屋根は 1〜3F 表示時に外す。外観では全表示。
  $("crumb").innerHTML = m === "ext" ? "<b>外観</b> · 敷地全体" : `<b>${m}F</b> · 上階と屋根を外して表示（ドールハウス）`;
  dirtyShadow();
}
{ const v = $("views"); VIEWS.forEach(([n, cam, md, day]) => { const b = document.createElement("button"); b.className = "btn sm"; b.textContent = n; b.onclick = () => { if (walk.on) toggleWalk(false); setMode(md); setCam(cam); if (day){ document.querySelectorAll("#topbar [data-day]").forEach(x => x.classList.toggle("on", x.dataset.day===day)); setDay(day); } }; v.appendChild(b); }); }
document.querySelectorAll("#topbar [data-mode]").forEach(b => b.onclick = () => { if (walk.on) toggleWalk(false); setMode(b.dataset.mode === "ext" ? "ext" : Number(b.dataset.mode)); const v = VIEWS.find(x => String(x[2]) === b.dataset.mode) ; if (v) setCam(v[1]); });
document.querySelectorAll("#topbar [data-day]").forEach(b => b.onclick = () => { document.querySelectorAll("#topbar [data-day]").forEach(x => x.classList.remove("on")); b.classList.add("on"); setDay(b.dataset.day); });

// ---- 稼働 再生/停止 ----
$("playBtn").onclick = () => { playing = !playing; $("playBtn").textContent = playing ? "⏸ 稼働" : "▶ 稼働"; $("playBtn").classList.toggle("on", playing); };

// ---- レイヤー ----
const LAYER_DEFS = [["structure","鉄骨架構・トラス"],["envelope","外皮・ガラス・間仕切り"],["equipment","機械設備"],["furniture","什器・オフィス"],["mep","MEP（ダクト・配管・照明）"],["overhead","天井工具（ガントリー・ツールレール・ブーム）"],["markings","床ライン・安全表示"],["people","人・車両（稼働）"],["labels","名称ラベルを常時表示（OFF＝ホバー時のみ）"],["green","植栽"],["context","周辺街区・道路"]];
const layerState = {};
function applyLayers(){ scene.traverse(o => { const l = o.userData.layer; if (l && layerState[l] !== undefined) o.visible = layerState[l]; }); applyMepVisibility(); if (LAYERS.green) LAYERS.green.visible = layerState.green; if (LAYERS.context) LAYERS.context.visible = layerState.context; dirtyShadow(); }
{ const list = $("layerList"); for (const [k, n] of LAYER_DEFS){ layerState[k] = k !== "labels"; const lb = document.createElement("label"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = layerState[k]; cb.onchange = () => { layerState[k] = cb.checked; applyLayers(); }; lb.appendChild(cb); lb.appendChild(document.createTextNode(n)); list.appendChild(lb); } }
function leftPanel(id){ for (const [pid, bid] of [["layers","layersBtn"],["section","secBtn"],["bim","bimBtn"]]){ const on = pid === id; $(pid).style.display = on ? "block" : "none"; $(bid).classList.toggle("on", on); } document.body.classList.toggle("leftopen", !!id); MEP.office = id === "bim"; applyMepVisibility(); }
$("layersBtn").onclick = () => leftPanel($("layers").style.display === "block" ? null : "layers");

// ---- 断面 ----
const secPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10); let secAxis = "y", secOn = false;
function applySection(){
  const t = Number($("secRange").value) / 100;
  if (secAxis === "y"){ const h = lerp(1.5, 19, t); secPlane.normal.set(0, -1, 0); secPlane.constant = h; $("secLabel").textContent = `高さ ${h.toFixed(1)} m 以上をカット`; }
  else if (secAxis === "z"){ const z = lerp(BLD.z0 - 2, BLD.eaveZ + 2, t); secPlane.normal.set(0, 0, -1); secPlane.constant = z; $("secLabel").textContent = `z = ${z.toFixed(1)} m より南をカット（南から見る）`; }
  else { const x = lerp(BLD.x0 - 2, BLD.x1 + 2, t); secPlane.normal.set(-1, 0, 0); secPlane.constant = x; $("secLabel").textContent = `x = ${x.toFixed(1)} m より東をカット（東から見る）`; }
  renderer.clippingPlanes = secOn ? [secPlane] : []; camDirty = true;
}
$("secRange").oninput = applySection;
document.querySelectorAll("#section [data-ax]").forEach(b => b.onclick = () => { document.querySelectorAll("#section [data-ax]").forEach(x => x.classList.remove("on")); b.classList.add("on"); secAxis = b.dataset.ax; applySection(); });
$("secBtn").onclick = () => { secOn = $("section").style.display !== "block"; leftPanel(secOn ? "section" : null); applySection(); };
$("secOff").onclick = () => { secOn = false; leftPanel(null); applySection(); };

// ---- 歩行モード ----
let toggleWalk = function(on){
  walk.on = on; document.body.classList.toggle("walk", on); $("walkBtn").classList.toggle("on", on);
  if (on){ const t = camGoal.target; walk.pos.set(clamp(t.x, -58, 58), (mode === "ext" ? 0 : BLD.lv[Math.max(0, Number(mode) - 1)] || 0) + 1.65, clamp(t.z, -38, 38)); walk.yaw = camGoal.yaw + Math.PI; walk.pitch = -0.05; cvsEl.requestPointerLock?.(); }
  else { document.exitPointerLock?.(); camDirty = true; }
};
$("walkBtn").onclick = () => toggleWalk(!walk.on);
document.addEventListener("pointerlockchange", () => { if (walk.on && document.pointerLockElement !== cvsEl) toggleWalk(false); });
cvsEl.addEventListener("click", () => { if (walk.on && document.pointerLockElement !== cvsEl) cvsEl.requestPointerLock?.(); });

// ---- 計画概要 ----
function areaOf(z){ return (z[5] - z[4]) * (z[7] - z[6]); }
function renderStats(){
  const siteA = SITE.w * SITE.d, footA = BLD.w * BLD.d, f1 = footA, f2 = BLD.w * (BLD.z1 - BLD.zh), f3 = f2, total = f1 + f2 + f3;
  const staff = STAFF.reduce((a, s) => a + s[1], 0); const maxH = Math.max(...BLD.roofProfile.map(p => p[1])) + 0.45;
  const n = v => v.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  const K = allLaneKPI();
  const P = computePlant();
  let h = `<table class="ptbl"><tr><td>工場全体の能力 / 目標</td><td class="n">${isFinite(P.plantCap)? P.plantCap.toFixed(1):"—"} / ${P.target.toFixed(1)} 台/月</td></tr><tr><td>制約</td><td class="n" style="color:var(--bad)">${pe(P.bott.n)}</td></tr><tr><td>精密・大型部品</td><td class="n">${K.parts.toFixed(0)} 個/日</td></tr><tr><td>大型機 組立</td><td class="n">${K.machines.toFixed(1)} 台/月</td></tr><tr><td>制御盤</td><td class="n">${K.panels.toFixed(0)} 面/日</td></tr><tr><td>ソフト リリース</td><td class="n">${K.releases.toFixed(0)} 件/週</td></tr><tr><td>平均自動化率 / 無人運転</td><td class="n">${(K.autoAvg*100).toFixed(0)}% / ${K.unattended} h</td></tr></table><div class="sub">レーン定義（レシピ×区画×シフト）から自動算出。左下「レーン・生産性」で再構成できます。</div><div class="sep"></div>
  <div class="sub">${pe(SITE.name)}<br>${pe(SITE.zoning)}（建蔽率 ${SITE.bcrMax}% / 容積率 ${SITE.farMax}%）</div><div class="sep"></div><table>
  <tr><td>敷地面積</td><td class="n">${n(siteA)} ㎡</td><td class="sub">${SITE.w}×${SITE.d} m</td></tr>
  <tr><td>建築面積</td><td class="n">${n(footA)} ㎡</td><td class="sub">建蔽率 ${(footA/siteA*100).toFixed(1)}%</td></tr>
  <tr><td>延床面積</td><td class="n">${n(total)} ㎡</td><td class="sub">容積率 ${(total/siteA*100).toFixed(1)}%</td></tr>
  <tr><td>　1F 機械ホール＋ラボ</td><td class="n">${n(f1)} ㎡</td><td class="sub">軒高 ${BLD.eave} m</td></tr>
  <tr><td>　2F ソフトウェア</td><td class="n">${n(f2)} ㎡</td><td class="sub">＋テラス ${n(BLD.w*(BLD.terraceZ-BLD.z1))} ㎡</td></tr>
  <tr><td>　3F 設計・共用</td><td class="n">${n(f3)} ㎡</td><td class="sub">木天井</td></tr>
  <tr><td>最高高さ</td><td class="n">${maxH.toFixed(1)} m</td><td class="sub">折板屋根 棟</td></tr>
  <tr><td>想定人員</td><td class="n">${staff} 名</td><td class="sub">${EQUIP.length} 設備</td></tr></table><div class="sep"></div><h3>人員内訳</h3><table>`;
  for (const [name, num, t] of STAFF) h += `<tr><td><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#${ZTYPE[t].c.toString(16).padStart(6,"0")};margin-right:6px"></i>${pe(name)}</td><td class="n">${num} 名</td></tr>`;
  h += `</table><div class="sep"></div><h3>ゾーン凡例</h3><div class="legend">`;
  for (const k in ZTYPE) h += `<span><i style="background:#${ZTYPE[k].c.toString(16).padStart(6,"0")}"></i>${pe(ZTYPE[k].n)}</span>`;
  h += `</div><div class="sep"></div><div class="sub">${pe(SITE.road)}。${pe(SITE.heightNote)}。数値は構想段階の想定値で、敷地確定後に SITE / BLD の差替えで更新。</div>`;
  $("statsBody").innerHTML = h;
}

// ---- 設備台帳・詳細 ----
let selectedId = null, hoverId = null; const hiCache = new Map();
function setHighlight(id, on){ const o = EQ_OBJ[id]; if (!o) return; o.group.traverse(m => { if (!m.isMesh || !m.material || !m.material.emissive) return; if (on){ if (!hiCache.has(m)) hiCache.set(m, [m.material, m.material.clone()]); const mat = hiCache.get(m)[1]; mat.emissive.set(0xf2c744); mat.emissiveIntensity = 0.45; m.material = mat; } else if (hiCache.has(m)){ m.material = hiCache.get(m)[0]; } }); }
function zoneName(id){ const z = ZONES.find(z => z[0] === id); return z ? z[1] : id; }
function showInfo(e){
  const p = $("info"); document.body.classList.toggle("info", !!e); if (!e){ p.style.display = "none"; return; }
  const z = ZONES.find(z => z[0] === e.zone); let h = `<div class="sub">${pe(e.id)} · ${pe(zoneName(e.zone))}${z ? ` · ${z[2] ? z[2]+"F" : "屋外"}` : ""}</div><h2>${pe(e.name)}</h2><table>`;
  if (e.lane && LANE_OBJ[e.lane]) h += `<tr><td>レーン</td><td><a href="#" id="infoLane" style="color:var(--acc)">${pe(e.lane)} ${pe(LANE_RECIPES[LANE_OBJ[e.lane].lane.recipe].n)}</a></td></tr>`;
  for (const k in e.spec) h += `<tr><td>${pe(k)}</td><td>${pe(e.spec[k])}</td></tr>`;
  h += `<tr><td>位置</td><td>x ${e.x} m, z ${e.z} m</td></tr></table><div class="sep"></div><div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn sm" id="infoGo">設備へ寄る</button><button class="btn sm" id="infoClose">閉じる</button></div>`;
  p.innerHTML = h; p.style.display = "block"; $("infoGo").onclick = () => focusEq(e.id); $("infoClose").onclick = () => selectEq(null); const il = $("infoLane"); if (il) il.onclick = ev => { ev.preventDefault(); focusLane(e.lane); };
}
function selectEq(id){ if (selectedId) setHighlight(selectedId, false); selectedId = id; if (id) setHighlight(id, true); document.querySelectorAll(".eq").forEach(el => el.classList.toggle("on", el.dataset.id === id)); showInfo(id ? EQUIP.find(e => e.id === id) : null); }
function focusEq(id){ const e = EQUIP.find(x => x.id === id); if (!e) return; const f = ZONES.find(z => z[0] === e.zone)?.[2] ?? 1; if (walk.on) toggleWalk(false); if (mode === "ext" || Number(mode) < f) setMode(f); const y = BLD.lv[f - 1] + (e.kind === "crane" ? 10 : 2); const big = ["gantry","testcell","assembly","crane","server"].includes(e.kind); setCam({ yaw: camGoal.yaw, pitch:0.38, dist: big ? 34 : 18, target:[e.x, y, e.z] }); selectEq(id); }
function renderLedger(){ const q = ($("eqFilter").value || "").trim().toLowerCase(); const list = $("ledgerList"); list.innerHTML = ""; let n = 0;
  for (const e of EQUIP){ const zn = zoneName(e.zone); if (q && !(e.id + e.name + zn + e.kind + (e.lane||"")).toLowerCase().includes(q)) continue; n++;
    const d = document.createElement("div"); d.className = "eq" + (e.id === selectedId ? " on" : ""); d.dataset.id = e.id; d.innerHTML = `<b>${pe(e.id)}</b><span>${pe(e.name)}<br><small>${pe(zn)}${e.lane? " · "+pe(e.lane) : ""}</small></span>`; d.onclick = () => focusEq(e.id); list.appendChild(d); }
  $("eqCount").textContent = `${n}/${EQUIP.length}`; }
$("eqFilter").oninput = renderLedger;

// ---- 左下パネルのタブ ----
document.querySelectorAll("#ledger [data-tab]").forEach(b => b.onclick = () => { document.querySelectorAll("#ledger [data-tab]").forEach(x => x.classList.toggle("on", x === b)); document.querySelectorAll("#ledger .tabPane").forEach(p => p.classList.toggle("on", p.id === "tab-" + b.dataset.tab)); });

// ---- レーン：区画スロット・カード・再構成フォーム ----
const LANE_SLOTS = [
  { id:"mach-N", n:"機械加工エリア 北側（1F）", zone:"mach", floor:1, area:[-43,-13,-29.5,-6.4] },
  { id:"mach-S", n:"機械加工エリア 南側（1F）", zone:"mach", floor:1, area:[-43,-13,-6.0,1.5] },
  { id:"asm",    n:"大型組立ベイ 1〜4（1F）",    zone:"asm1", floor:1, area:[-11,35,-29,1] },
  { id:"elab",   n:"電子・制御ラボ（1F）",      zone:"elab", floor:1, area:[-5.5,5.5,3,17.6] },
  { id:"yard",   n:"北側 屋外庇下ヤード 東",    zone:"north",floor:1, area:[-13,44,-39.8,-30.5] },
  { id:"yard2",  n:"北側 屋外ヤード 西",        zone:"north",floor:1, area:[-44,-14,-39.8,-30.5] },
  { id:"tcell",  n:"試運転・試験セル区画（1F）", zone:"tcell",floor:1, area:[20.5,43,-14,1] },
  { id:"sw",     n:"ソフトウェア開発フロア（2F）",zone:"sw",  floor:2, area:[-36,34,3,17] },
];
const MAIN_STATION = { precision:"mc5", heavy:"gantry", assembly:"asmMech", panel:"panel", software:"hil", sheet:"weld", paint:"booth", demo:"demo", testing:"tcell" };
function slotOf(lane){ return LANE_SLOTS.find(sl => sl.zone === lane.zone && sl.area[2] === lane.area[2]) || LANE_SLOTS.find(sl => sl.zone === lane.zone); }
function laneCard(o){ const L = o.lane, R = LANE_RECIPES[L.recipe], k = o.kpi; const c = "#"+R.color.toString(16).padStart(6,"0"); const sl = slotOf(L);
  const chips = R.os.map(m => `<span class="chip" data-mod="${m}">${pe(OS_MODULES[m].n)}</span>`).join("");
  const mainT = MAIN_STATION[L.recipe]; const mainN = (L.override||{})[mainT] ?? (R.stations.find(x=>x[0]===mainT)||[0,1])[1];
  return `<div class="lane${activeLane===L.id?" on":""}" data-id="${L.id}" style="--c:${c}"><div class="lh"><b>${pe(L.id)}</b>${pe(R.n)}<small>${pe(sl? sl.n : L.zone)}</small></div><div class="desc">${pe(R.desc)}</div>
  <div class="kpi"><div><small>生産量</small><b class="big">${pe(k.outLabel)}</b></div><div><small>タクト（ボトルネック）</small><b>${pe(k.taktLabel)}</b></div><div><small>OEE</small><b>${(k.oee*100).toFixed(0)}%</b></div>
  <div><small>自動化率（時間）</small><b>${(k.autoRatio*100).toFixed(0)}%</b></div><div><small>要員 / 機械</small><b>${k.ppl.toFixed(1)} 人 / ${k.machines} 台</b></div><div><small>リードタイム</small><b>${pe(k.leadLabel)}</b></div></div>
  <div class="sub" style="margin-top:5px">${(()=>{ const n = clearanceCache ? clearanceCache.filter(r => (EQ_OBJ[r.id]?.data.lane) === L.id).length : 0; return n ? `<span style="color:var(--acc)">保守スペース侵害 ${n} 件</span> ／ ` : ""; })()}ボトルネック: ${pe(k.bottleneck)} ／ 無人運転 ${k.unattended} h/日 ／ ${L.shifts.shifts} 直 × ${L.shifts.hours} h${o.lay.overflow>0.05? ` ／ <span class="warn" style="color:var(--bad)">区画を ${o.lay.overflow.toFixed(1)} m はみ出し</span>`:""}</div>
  <div class="chips">${chips}</div><div class="ctl"><button class="btn sm" data-act="view">3Dで見る</button><button class="btn sm" data-act="cfg">構成を変える</button><button class="btn sm" data-act="del">削除</button></div>
  <form class="cfg" hidden><label>レシピ<select name="recipe">${Object.keys(LANE_RECIPES).map(r=>`<option value="${r}"${r===L.recipe?" selected":""}>${pe(LANE_RECIPES[r].n)}</option>`).join("")}</select></label>
  <label>主要機械の台数<input name="main" type="number" min="1" max="6" value="${mainN}"></label><label>シフト数<input name="shifts" type="number" min="1" max="3" value="${L.shifts.shifts}"></label>
  <label>無人運転 h/日<input name="unattended" type="number" min="0" max="16" value="${L.shifts.unattended}"></label><label>区画<select name="slot">${LANE_SLOTS.map(sl=>`<option value="${sl.id}"${sl.id===(slotOf(L)||{}).id?" selected":""}>${pe(sl.n)}</option>`).join("")}</select></label>
  <div class="sub" style="margin-top:6px">工程ごとの根拠値（標準時間・並列数・自動化・要員）</div><table class="stTbl"><tr><th>工程</th><th style="width:22%">時間</th><th style="width:14%">台数</th><th style="width:24%">自動化</th><th style="width:16%">要員</th></tr>${o.sts.map(st=>`<tr><td>S${st.idx} ${pe(st.label)}</td><td><input name="ct:${st.type}" type="number" step="0.5" min="0" value="${st.ct}"> <small>${st.unit}</small></td><td><input name="n:${st.type}" type="number" min="1" max="8" value="${st.n}"></td><td><select name="auto:${st.type}"><option value="auto"${st.auto==="auto"?" selected":""}>無人</option><option value="semi"${st.auto==="semi"?" selected":""}>監視付</option><option value="manual"${st.auto==="manual"?" selected":""}>手作業</option></select></td><td><input name="ppl:${st.type}" type="number" step="0.1" min="0" value="${st.ppl}"></td></tr>`).join("")}</table>
  <label>OEE 稼働率 / 性能 / 品質<span style="display:flex;gap:3px;width:56%"><input name="avail" type="number" step="0.01" min="0.3" max="1" value="${L.oee.avail}"><input name="perf" type="number" step="0.01" min="0.3" max="1" value="${L.oee.perf}"><input name="qual" type="number" step="0.01" min="0.5" max="1" value="${L.oee.qual}"></span></label>
  <div class="ctl"><span class="sub">同じ区画の既存レーンは置き換えます</span><button class="btn sm on" type="submit">生成</button></div></form></div>`; }
function renderLanes(){ const list = $("laneList"); list.innerHTML = Object.values(LANE_OBJ).sort((a,b)=>a.lane.id.localeCompare(b.lane.id)).map(laneCard).join("");
  list.querySelectorAll(".lane").forEach(card => { const id = card.dataset.id;
    card.onclick = ev => { if (ev.target.closest("form") || ev.target.closest("button") || ev.target.closest(".chip")) return; setActiveLane(activeLane === id ? null : id); renderLanes(); renderOS(); };
    card.querySelector('[data-act="view"]').onclick = () => focusLane(id);
    card.querySelector('[data-act="cfg"]').onclick = () => { const f = card.querySelector("form"); f.hidden = !f.hidden; };
    card.querySelector('[data-act="del"]').onclick = () => { removeLane(id); afterLaneChange(); };
    card.querySelectorAll(".chip").forEach(ch => ch.onclick = () => { setActiveModule(ch.dataset.mod); renderLanes(); renderOS(); document.querySelector('[data-tab="os"]').click(); });
    card.querySelector("form").onsubmit = ev => { ev.preventDefault(); applyLaneForm(id, new FormData(ev.target)); }; }); }
function applyLaneForm(id, fd){ const o = LANE_OBJ[id]; const L = o ? o.lane : { id, oee:{ avail:0.88, perf:0.95, qual:0.985 } }; const recipe = fd.get("recipe"); const sl = LANE_SLOTS.find(s=>s.id===fd.get("slot"));
  for (const oid in LANE_OBJ){ if (oid !== id && slotOf(LANE_OBJ[oid].lane)?.id === sl.id) removeLane(oid); }
  L.recipe = recipe; L.zone = sl.zone; L.floor = sl.floor; L.area = sl.area.slice(); L.override = { [MAIN_STATION[recipe]]: Math.max(1, Number(fd.get("main"))||1) }; if (recipe==="panel") L.override.wiring = L.override.panel;
  L.shifts = { hours:8, shifts: Number(fd.get("shifts"))||1, unattended: Number(fd.get("unattended"))||0, days: LANE_RECIPES[recipe].mode==="project"? 21 : 5 };
  if (!L.oee) L.oee = { avail:0.88, perf:0.95, qual:0.985 }; if (fd.get("avail")) L.oee = { avail:+fd.get("avail"), perf:+fd.get("perf"), qual:+fd.get("qual") };
  // 工程ごとの根拠値（レシピが同じ場合のみ引き継ぐ）
  const so = {}; const keys = typeof fd.keys === "function" ? [...fd.keys()] : []; for (const k of keys){ const [f, t] = k.split(":"); if (!t || !STATION_TYPES[t]) continue; so[t] = so[t] || {}; const v = fd.get(k); if (f==="ct") so[t].ct = +v; else if (f==="n") so[t].n = Math.max(1, +v|0); else if (f==="auto") so[t].auto = v; else if (f==="ppl") so[t].ppl = +v; }
  L.stationOv = (recipe === (o? o.lane.recipe : recipe) && keys.length) ? so : {}; if (L.override && L.stationOv[MAIN_STATION[recipe]]) L.stationOv[MAIN_STATION[recipe]].n = L.override[MAIN_STATION[recipe]];
  generateLane(L); if (!LANES.includes(L)) LANES.push(L); setActiveLane(L.id); afterLaneChange(); focusLane(L.id); }
function afterLaneChange(){ for (let i=LANES.length-1;i>=0;i--) if (!LANE_OBJ[LANES[i].id]) LANES.splice(i,1); refreshPlanTexture(); buildMEP(); if ($("bim").style.display === "block") renderBim(); if (clrOn) runClearance(); if (clashMarks) runClash(); renderLanes(); renderOS(); renderLedger(); renderPlant(); renderStats(); refreshLaneVis(); dirtyShadow(); }
function focusLane(id){ const o = LANE_OBJ[id]; if (!o) return; const L = o.lane; if (walk.on) toggleWalk(false); setMode(L.floor); const [x0,x1,z0,z1] = L.area; const w = Math.max(x1-x0, z1-z0);
  setCam({ yaw: L.floor===2? -0.9 : -0.6, pitch:0.62, dist: w*1.35, target:[(x0+x1)/2, BLD.lv[L.floor-1]+2, (z0+z1)/2] }); setActiveLane(id); renderLanes(); renderOS(); }
$("laneAdd").onclick = () => { let n = 6; while (LANE_OBJ["L"+n]) n++; const id = "L"+n; const fd = new Map([["recipe","precision"],["main","3"],["shifts","2"],["unattended","8"],["slot","recv"]]); applyLaneForm(id, fd); const card = document.querySelector(`.lane[data-id="${id}"] form`); if (card) card.hidden = false; };

$("laneSave").onclick = () => { const data = { version:3, demand:DEMAND, lanes: Object.values(LANE_OBJ).map(o => o.lane) }; const a = document.createElement("a"); a.download = "xantalos-lanes.json"; a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:"application/json" })); a.click(); };
$("laneLoad").onclick = () => $("laneFile").click();
$("laneFile").onchange = ev => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const d = JSON.parse(rd.result); if (!Array.isArray(d.lanes)) throw new Error("lanes がありません"); for (const id of Object.keys(LANE_OBJ)) removeLane(id); LANES.length = 0; if (d.demand?.target) DEMAND.target = d.demand.target; for (const L of d.lanes){ if (!LANE_RECIPES[L.recipe]) continue; LANES.push(L); generateLane(L); } afterLaneChange(); } catch (e) { alert("読込エラー: " + e.message); } ev.target.value = ""; }; rd.readAsText(f); };

// ---- 工場全体（需要 → 必要供給量 → 稼働率） ----
let linksOn = false;
function renderPlant(){ const P = refreshLinkLines(); LANE_LINK_LINES.visible = linksOn; const el = $("plantBody"); const n = v => isFinite(v) ? v.toFixed(v<10? 1:0) : "—";
  const bar = u => `<div class="bar"><i class="${u>1?"bad":u>0.85?"warn":""}" style="width:${Math.min(100, (isFinite(u)? u:1)*100).toFixed(0)}%"></i></div>`;
  let h = `<div class="sub">目標需要（大型機）とレーン能力から、必要物量・稼働率・工場全体のボトルネックを算出。BOM は 1 台あたりの想定数量。</div>
  <label class="fld" style="display:flex;justify-content:space-between;align-items:center;margin:8px 0;font-size:12px">目標 <b style="color:var(--acc)">${DEMAND.target.toFixed(1)} 台/月</b><input id="demand" type="range" min="0.5" max="8" step="0.5" value="${DEMAND.target}" style="width:52%;accent-color:var(--acc)"></label>
  <div class="plant-row" style="border-color:var(--acc)"><div class="lh"><span>工場全体の能力</span><b style="color:var(--acc)">${n(P.plantCap)} 台/月</b></div><div class="sub">制約: ${pe(P.bott.n)}${P.bott.lanes.length? "（"+P.bott.lanes.map(l=>l.id).join(", ")+"）":""} ／ 目標に対し ${isFinite(P.plantCap)&&P.plantCap>0? (P.target/P.plantCap*100).toFixed(0)+"%":"—"} 負荷${P.outsourced.length? "<br>外注前提: "+P.outsourced.map(pe).join("・") : ""}</div></div>
  <div class="plant-row${P.bott.n==="大型機 組立"?" bott":""}"><div class="lh"><span>大型機 組立（${P.limits[0].lanes.map(l=>l.id).join(", ")||"なし"}）</span><b>${P.target.toFixed(1)} / ${n(P.asmCap)} 台/月</b></div>${bar(P.asmUtil)}</div>
  <div class="sub" style="margin:6px 0 4px">供給レーン → 組立（必要量 / 能力 ・月）</div>`;
  for (const r of P.rows){ const supplied = r.lanes.length; h += `<div class="plant-row${P.bott.key===r.key?" bott":""}"><div class="lh"><span>${pe(r.n)}</span><b>${r.need.toFixed(0)} / ${supplied? r.cap.toFixed(0):"—"} ${r.unit}</b></div>${bar(r.util)}<div class="sub">${r.perUnit} ${r.unit}/台 × ${P.target} 台 ／ ${supplied? r.lanes.map(l=>`<span class="chip" style="border-color:#${l.color.toString(16).padStart(6,"0")}">${l.id} ${l.out.toFixed(0)}</span>`).join(" ") : '<span style="color:var(--bad)">供給レーンなし（外注前提）</span>'}${isFinite(r.util)&&r.util>1? ` <span style="color:var(--bad)">不足 ${(r.need-r.cap).toFixed(0)} ${r.unit}</span>`:""}</div></div>`; }
  h += `<div class="ctl" style="display:flex;gap:6px;justify-content:flex-end;margin-top:6px"><button class="btn sm${linksOn?" on":""}" id="linksBtn">3D に供給リンクを表示</button></div>`;
  // ---- 社内化 vs 外注 ----
  const M_ = v => isFinite(v) ? v.toFixed(v<10? 1:0) : "—";
  h += `<div class="sep"></div><h3>社内化 vs 外注（外注前提の品目）</h3><div class="sub" style="margin-bottom:6px">社内レーンを置いた場合の能力・要員・面積・投資と、外注の年間費用を比較。単価・設備費は想定値（<code>COST / capex / outsource</code>）。</div>`;
  const cmpItems = P.rows.filter(r => r.cap<=0 && INHOUSE[r.key]);
  if (!cmpItems.length) h += `<div class="sub">すべての品目に社内レーンがあります。</div>`;
  for (const r of cmpItems){ const ih = INHOUSE[r.key]; const slot = LANE_SLOTS.find(s=>s.id===ih.slot); const c = compareInhouse(r.key, slot); if (!c) continue;
    h += `<div class="plant-row"><div class="lh"><span>${pe(r.n)}</span><b>${c.need.toFixed(0)} ${r.unit}/月</b></div><table class="ptbl" style="margin-top:4px"><tr><th></th><th style="text-align:right">外注</th><th style="text-align:right">社内（${pe(LANE_RECIPES[ih.recipe].n)}）</th></tr>
    <tr><td>能力 / 稼働率</td><td class="n" style="color:var(--txt)">—</td><td class="n">${c.capM.toFixed(0)} ${r.unit}/月 ・ ${isFinite(c.util)? (c.util*100).toFixed(0)+"%":"—"}</td></tr>
    <tr><td>リードタイム</td><td class="n" style="color:var(--txt)">${c.os.leadDays} 日</td><td class="n">${c.leadIn} 日</td></tr>
    <tr><td>年間費用</td><td class="n" style="color:var(--txt)">${c.outsourceYear.toFixed(1)} 百万円</td><td class="n">${c.inhouseYear.toFixed(1)} 百万円<br><small style="color:var(--sub);font-weight:400">人件 ${c.laborYear.toFixed(1)} ・ 面積 ${c.areaYear.toFixed(1)} ・ 保守 ${c.maintYear.toFixed(1)}</small></td></tr>
    <tr><td>設備投資 / 面積 / 要員</td><td class="n" style="color:var(--txt)">0</td><td class="n">${c.ev.capex.toFixed(0)} 百万円 / ${c.ev.footprint.toFixed(0)} ㎡ / ${c.ev.kpi.ppl.toFixed(1)} 人</td></tr>
    <tr><td>年間差額 / 回収</td><td class="n" style="color:var(--txt)">—</td><td class="n" style="color:${c.saving>0?"var(--good)":"var(--bad)"}">${c.saving>=0?"+":""}${c.saving.toFixed(1)} 百万円 / ${isFinite(c.payback)? c.payback.toFixed(1)+" 年" : "回収不能"}</td></tr></table>
    <div class="sub" style="margin-top:4px">${pe(c.os.n)} ／ 社内案: ${c.cfg[0]} 直${c.cfg[1]? "＋無人 "+c.cfg[1]+" h":""}、区画 ${pe(slot.n)}${c.ev.overflow>0? ` <span style="color:var(--bad)">（${c.ev.overflow.toFixed(1)} m はみ出し）</span>`:""}。要員費は稼働率 ${isFinite(c.util)? (c.util*100).toFixed(0):"—"}% 換算（他レーンと共有）。${c.breakeven? `<b style="color:var(--acc)">需要 ${c.breakeven} 台/月以上で 7 年以内に回収。</b>` : "需要 12 台/月でも 7 年以内の回収に届かない。"}</div>
    <div class="ctl" style="display:flex;justify-content:flex-end;margin-top:5px"><button class="btn sm" data-inhouse="${r.key}">社内化する（レーンを追加）</button></div></div>`; }
  // ---- 組立シナリオ ----
  const SC = assemblyScenarios();
  if (SC.length){ h += `<div class="sep"></div><h3>組立の what-if シナリオ</h3><div class="sub" style="margin-bottom:6px">制約になりやすい大型機組立を、ベイ並列化と試験工程の外出しで比較。適用すると 3D とレーン定義が置き換わります。</div><table class="ptbl"><tr><th>案</th><th style="text-align:right">組立 台/月</th><th style="text-align:right">工場能力</th><th style="text-align:right">LT（日）</th><th style="text-align:right">要員</th><th style="text-align:right">追加投資</th><th></th></tr>`;
    SC.forEach((sc, i) => { const bott = sc.P.bott.n; h += `<tr><td>${pe(sc.n)}</td><td class="n">${sc.ev.kpi.out.toFixed(1)}</td><td class="n" style="color:${sc.P.plantCap>=P.target?"var(--good)":"var(--acc)"}">${M_(sc.P.plantCap)} <small style="color:var(--sub);font-weight:400">${pe(bott.replace("大型機 組立","組立"))}</small></td><td class="n">${(sc.ev.kpi.lead/8).toFixed(0)}${sc.tev? "+"+(sc.tev.kpi.lead/8).toFixed(0):""}</td><td class="n">${sc.ppl.toFixed(1)}</td><td class="n">${i? (sc.capex>=0?"+":"")+sc.capex.toFixed(0) : "—"}</td><td>${i? `<button class="btn sm" data-scn="${i}">適用</button>` : '<span class="sub">現状</span>'}</td></tr>`; });
    h += `</table><div class="sub" style="margin-top:4px">LT＝組立レーンのリードタイム（＋試験レーン）。投資は百万円。試験外出しは試験セル区画（既存 TC-01 を置換）に試験レーンを追加します。</div>`; }
  el.innerHTML = h; $("demand").oninput = ev => { DEMAND.target = +ev.target.value; renderPlant(); renderStats(); }; $("linksBtn").onclick = () => { linksOn = !linksOn; LANE_LINK_LINES.visible = linksOn; renderPlant(); if (linksOn){ if (mode==="ext") setMode(1); } };
  el.querySelectorAll("[data-inhouse]").forEach(b => b.onclick = () => { const key = b.dataset.inhouse; const ih = INHOUSE[key]; let n = 6; while (LANE_OBJ["L"+n]) n++; applyLaneForm("L"+n, new Map([["recipe", ih.recipe],["main", String((LANE_RECIPES[ih.recipe].stations.find(x=>x[0]===MAIN_STATION[ih.recipe])||[0,1])[1])],["shifts","2"],["unattended","6"],["slot", ih.slot]])); document.querySelector('[data-tab="plant"]').click(); });
  el.querySelectorAll("[data-scn]").forEach(b => b.onclick = () => applyScenario(SC[+b.dataset.scn])); }
function applyScenario(sc){ const asmO = Object.values(LANE_OBJ).find(o => LANE_RECIPES[o.lane.recipe].consumes); if (!asmO) return; const L = asmO.lane; Object.assign(L, { stationOv: sc.L.stationOv || {}, override: sc.L.override || {}, offload: sc.L.offload || [] }); generateLane(L);
  for (const id in LANE_OBJ) if (LANE_OBJ[id].lane.recipe === "testing") removeLane(id);
  if (sc.tev){ const T = cloneLane(sc.tev.lane); LANES.push(T); generateLane(T); }
  afterLaneChange(); document.querySelector('[data-tab="plant"]').click(); focusLane(L.id); linksOn = true; renderPlant(); }

// ---- Factory OS パネル ----
function renderOS(){ const el = $("osList"); let h = "";
  for (const [ly, name] of OS_LAYERS){ h += `<div class="os-layer"><h4>${ly}. ${pe(name)}</h4>`;
    for (const key in OS_MODULES){ const m = OS_MODULES[key]; if (m.layer !== ly) continue; const lanes = Object.values(LANE_OBJ).filter(o => LANE_RECIPES[o.lane.recipe].os.includes(key));
      h += `<div class="mod${activeModule===key?" on":""}" data-mod="${key}"><b>${pe(m.n)}</b><p>${pe(m.d)}</p><div class="chips">${lanes.map(o=>`<span class="chip" style="border-color:#${LANE_RECIPES[o.lane.recipe].color.toString(16).padStart(6,"0")}">${pe(o.lane.id)} ${pe(LANE_RECIPES[o.lane.recipe].n)}</span>`).join("") || '<span class="sub">（使用レーンなし）</span>'}</div></div>`; }
    h += `</div>`; }
  el.innerHTML = h; el.querySelectorAll(".mod").forEach(d => d.onclick = () => { setActiveModule(activeModule === d.dataset.mod ? null : d.dataset.mod); renderOS(); renderLanes(); }); }

// ---- ピック ----
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function pickAt(x, y){ ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const targets = [FL[1], FL[2], FL[3]].filter(g => g.visible); const hits = ray.intersectObjects(targets, true);
  for (const h of hits){ if (h.object.isSprite) continue; let o = h.object; if (o.userData.mep) return { mep:o.userData.mep, obj:o }; while (o){ if (o.userData.eqId) return o.userData.eqId; o = o.parent; } return null; } return null; }
cvsEl.addEventListener("pointerup", e => { if (walk.on || drag.moved > 6 || e.button !== 0) return; const id = pickAt(e.clientX, e.clientY); if (id && id.mep) { selectEq(null); showMepInfo(id.mep); } else if (id) { selectEq(id); } else selectEq(null); });
let hoverTimer = 0;
cvsEl.addEventListener("pointermove", e => { if (walk.on || drag.on) return; const now = performance.now(); if (now - hoverTimer < 80) return; hoverTimer = now; const id0 = pickAt(e.clientX, e.clientY); const id = (id0 && id0.mep) ? null : id0; cvsEl.style.cursor = id0 ? "pointer" : ""; hoverUpdate(e, id0); if (id !== hoverId){ if (hoverId && hoverId !== selectedId) setHighlight(hoverId, false); hoverId = id; if (id && id !== selectedId) setHighlight(id, true); } });

// ---- 歩行モード：天井内の設備（2F/3F の MEP）も見えるようにし、ホール内では名称を近距離だけ表示 ----
const _toggleWalk0 = toggleWalk;
toggleWalk = function(on){ _toggleWalk0(on); MEP.walk = on; applyMepVisibility(); };

// ---- BIM・MEP パネル ----
let xray = false, clashMarks = null;
const XRAY_MATS = () => [M.gypsum, M.concrete, M.roofMetal, M.wallMetal, M.timber, M.timberDark, M.concreteWhite, M.spandrel, M.ceiling, M.ceilingGlow, M.hallGlow, M.epoxy, M.carpet, M.woodFloor, M.mullion, M.paving, M.asphalt, ...Object.values(FIN_MAT)];
function setXray(on){ xray = on; for (const m of XRAY_MATS()){ if (!m) continue; if (on){ m.userData._op = m.opacity; m.userData._tr = m.transparent; m.transparent = true; m.opacity = 0.12; m.depthWrite = false; } else if (m.userData._op !== undefined){ m.opacity = m.userData._op; m.transparent = m.userData._tr; m.depthWrite = true; } m.needsUpdate = true; } $("xrayBtn").classList.toggle("on", on); dirtyShadow(); }
function showMepInfo(m){ const p = $("info"); document.body.classList.add("info"); const S = SYSTEMS[m.sys]; p.innerHTML = `<div class="sub">MEP · ${pe(S.n)}</div><h2>${pe(m.name || m.kind || "")}</h2><table>
  <tr><td>系統</td><td>${pe(m.sys)} ${pe(S.n)}</td></tr><tr><td>種別</td><td>${S.kind==="pipe"?"配管":S.kind==="duct"?"ダクト":S.kind==="tray"?"ケーブルラック":"床トレンチ"}${m.trench?"（床トレンチ）":""}</td></tr>
  <tr><td>寸法</td><td>${S.kind==="pipe"? "φ"+Math.round(S.size[0]*2000)+" mm" : S.size.map(v=>Math.round(v*1000)).join("×")+" mm"}</td></tr>${m.length!==undefined? `<tr><td>延長</td><td>${m.length.toFixed(1)} m</td></tr>`:""}
  ${m.load? `<tr><td>設計負荷</td><td>${pe(m.load)}</td></tr>`:""}${m.sizeLabel? `<tr><td>算定サイズ</td><td>${pe(m.sizeLabel)}</td></tr>`:""}<tr><td>供給元</td><td>${pe(m.from || S.src)}</td></tr>${m.to? `<tr><td>接続先</td><td>${pe(m.to)}</td></tr>`:""}<tr><td>設計高さ</td><td>${(S.y + (MEP.offsets.y[m.sys]||0)).toFixed(1)} m${MEP.offsets.y[m.sys]? "（調整 "+MEP.offsets.y[m.sys].toFixed(1)+" m）":""}</td></tr></table>
  <div class="sep"></div><div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn sm" id="infoClose">閉じる</button></div>`; p.style.display = "block"; $("infoClose").onclick = () => showInfo(null); }
function renderBim(){ const sch = mepSchedule(); const el = $("bimSys"); let total = 0; el.innerHTML = Object.keys(SYSTEMS).map(k => { const S = SYSTEMS[k]; total += sch[k].len; return `<label class="sysrow"><input type="checkbox" data-sys="${k}" ${MEP.visible[k]===false?"":"checked"}><i style="background:#${S.color.toString(16).padStart(6,"0")}"></i>${pe(k)} ${pe(S.n)}<span class="len">${sch[k].len.toFixed(0)} m · ${sch[k].fittings} 器具${sch[k].load? "<br>負荷 "+Math.round(sch[k].load).toLocaleString()+" "+pe(sch[k].unit) : ""}</span></label>`; }).join("");
  $("bimSum").textContent = `延長 ${total.toFixed(0)} m`; el.querySelectorAll("input").forEach(cb => cb.onchange = () => { MEP.visible[cb.dataset.sys] = cb.checked; applyMepVisibility(); });
  const sel = $("bimSysSel"); if (!sel.options.length){ for (const k in SYSTEMS){ const o = document.createElement("option"); o.value = k; o.textContent = k + " " + SYSTEMS[k].n; sel.appendChild(o); } }
  $("bimH").value = MEP.offsets.y[sel.value] || 0; $("bimHLabel").textContent = `${(MEP.offsets.y[sel.value]||0) >= 0 ? "+" : ""}${(MEP.offsets.y[sel.value]||0).toFixed(1)} m（設計 ${SYSTEMS[sel.value].y} m）`; }
$("bimBtn").onclick = () => { const on = $("bim").style.display !== "block"; leftPanel(on ? "bim" : null); if (on){ renderBim(); if (mode === "ext") setMode(1); } };
$("bimSysSel").onchange = renderBim;
$("bimH").oninput = ev => { const k = $("bimSysSel").value; MEP.offsets.y[k] = +ev.target.value; buildMEP(); renderBim(); if (clashMarks) runClash(); };
function runClash(){ const res = clashCheck(); if (clashMarks) scene.remove(clashMarks); clashMarks = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color:0xff3b3b, transparent:true, opacity:0.75, depthTest:false }); res.forEach(r => { const m = new THREE.Mesh(G.sph(0.45, 10), mat); m.position.copy(r.at); m.renderOrder = 60; clashMarks.add(m); }); scene.add(clashMarks);
  const el = $("clashList"); if (!res.length){ el.innerHTML = `<div class="sub" style="color:var(--good)">干渉なし（MEP ${MEP.segs.length} 区間 vs 架構・クレーン走行範囲・設備）</div>`; return; }
  const byKind = { structure:0, crane:0, equipment:0 }; res.forEach(r => byKind[r.kind]++);
  el.innerHTML = `<div class="sub" style="margin-bottom:4px"><b style="color:var(--bad)">${res.length} 件</b>：架構 ${byKind.structure} ／ クレーン走行範囲 ${byKind.crane} ／ 設備 ${byKind.equipment}。クリックで寄る。</div>` + res.slice(0, 40).map((r, i) => `<div class="clash ${r.kind}" data-i="${i}"><b>${pe(r.sys)}</b> ${pe(r.seg)}<br><span class="sub">× ${pe(r.obstacle)} @ (${r.at.x.toFixed(1)}, ${r.at.y.toFixed(1)}, ${r.at.z.toFixed(1)})</span></div>`).join("") + (res.length > 40 ? `<div class="sub">…他 ${res.length-40} 件</div>` : "");
  el.querySelectorAll(".clash").forEach(d => d.onclick = () => { const r = res[+d.dataset.i]; if (mode === "ext") setMode(1); setCam({ yaw: camGoal.yaw, pitch:0.35, dist:14, target:[r.at.x, r.at.y, r.at.z] }); showMepInfo(r.obj.userData.mep); }); }
$("clashBtn").onclick = () => { if (clashMarks){ scene.remove(clashMarks); clashMarks = null; $("clashList").innerHTML = ""; $("clashBtn").classList.remove("on"); return; } $("clashBtn").classList.add("on"); runClash(); };
let clrOn = false, clearanceCache = null;
function runClearance(){ const res = clearanceCheck(); clearanceCache = res; renderLanes(); showClearanceZones(true); const el = $("clearList"); if (!res.length){ el.innerHTML = `<div class="sub" style="color:var(--good)">保守スペースの侵害なし（${Object.keys(EQ_OBJ).length} 設備）</div>`; return; }
  el.innerHTML = `<div class="sub" style="margin-bottom:4px"><b style="color:var(--acc)">${res.length} 件</b>：設備間 ${res.filter(r=>r.kind==="equipment").length} ／ MEP 立下り ${res.filter(r=>r.kind==="mep").length}。黄の枠が保守ゾーン（前後/左右）。</div>` + res.slice(0, 30).map((r, i) => `<div class="clash equipment" data-i="${i}"><b>${pe(r.id)}</b> ${pe(EQ_OBJ[r.id].data.name)} <span class="sub">必要 ${pe(r.need)}</span><br><span class="sub">× ${pe(r.obstacle)}</span></div>`).join("");
  el.querySelectorAll(".clash").forEach(d => d.onclick = () => { const r = res[+d.dataset.i]; if (mode === "ext") setMode(1); setCam({ yaw: camGoal.yaw, pitch:0.5, dist:16, target:[r.at.x, r.at.y, r.at.z] }); selectEq(r.id); }); }
$("clearBtn").onclick = () => { clrOn = !clrOn; $("clearBtn").classList.toggle("on", clrOn); if (clrOn) runClearance(); else { showClearanceZones(false); $("clearList").innerHTML = ""; } };
$("xrayBtn").onclick = () => setXray(!xray);
$("mepCsv").onclick = () => { const sch = mepSchedule(); let csv = "系統,名称,種別,寸法,延長 m,区間数,器具数\n"; for (const k in sch){ const S = SYSTEMS[k]; csv += `${k},${S.n},${S.kind},${S.kind==="pipe"? "φ"+Math.round(S.size[0]*2000) : S.size.map(v=>Math.round(v*1000)).join("x")},${sch[k].len.toFixed(1)},${sch[k].runs},${sch[k].fittings}\n`; } const a = document.createElement("a"); a.download = "xantalos-mep.csv"; a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type:"text/csv" })); a.click(); };

// ---- 構想イメージ ----
{ const g = $("photoGrid"); PHOTOS.forEach(p => { const f = document.createElement("figure"); f.style.margin = 0; f.innerHTML = `<img src="${p.f}" alt="${pe(p.t)}" loading="lazy"><figcaption>${pe(p.t)}</figcaption>`; f.querySelector("img").onclick = () => { $("lbImg").src = p.f; $("lbCap").textContent = p.t; $("lightbox").style.display = "flex"; }; g.appendChild(f); }); }
$("lightbox").onclick = () => $("lightbox").style.display = "none";
$("photosBtn").onclick = () => { const p = $("photos"); const on = p.style.display !== "block"; p.style.display = on ? "block" : "none"; $("photosBtn").classList.toggle("on", on); };

// ---- ガイドツアー ----
let tourIdx = -1, tourTimer = null;
function tourGo(i){ if (i < 0 || i >= TOUR.length){ tourStop(); return; } tourIdx = i; const s = TOUR[i]; if (walk.on) toggleWalk(false);
  if (s.mode === "ext") setMode("ext"); else setMode(s.floor); setCam(s.cam);
  if (s.lane) setActiveLane(s.lane); else if (s.module) setActiveModule(s.module); else setActiveLane(null); linksOn = !!s.plant; renderPlant(); renderLanes(); renderOS();
  if (s.module) document.querySelector('[data-tab="os"]').click(); else if (s.plant) document.querySelector('[data-tab="plant"]').click(); else if (s.lane) document.querySelector('[data-tab="lanes"]').click();
  document.body.classList.add("tour"); $("tourStep").textContent = `ガイドツアー ${i + 1} / ${TOUR.length}`; $("tourTitle").textContent = s.title; $("tourText").textContent = s.text; $("tourCard").style.display = "block";
  clearTimeout(tourTimer); tourTimer = setTimeout(() => tourGo(i + 1), 11000); }
function tourStop(){ document.body.classList.remove("tour"); clearTimeout(tourTimer); tourTimer = null; tourIdx = -1; $("tourCard").style.display = "none"; $("tourBtn").classList.remove("on"); setActiveLane(null); linksOn = false; renderPlant(); renderLanes(); renderOS(); }
$("tourBtn").onclick = () => { if (tourIdx >= 0) tourStop(); else { $("tourBtn").classList.add("on"); tourGo(0); } };
$("tourNext").onclick = () => tourGo(tourIdx + 1); $("tourPrev").onclick = () => tourGo(Math.max(0, tourIdx - 1)); $("tourStop").onclick = tourStop;

// ---- スクリーンショット ----
$("shotBtn").onclick = () => { renderer.render(scene, camera); const a = document.createElement("a"); a.download = `xantalos-ota-${Date.now()}.png`; a.href = renderer.domElement.toDataURL("image/png"); a.click(); };

// ---- キーボード ----
addEventListener("keydown", e => { if (e.target.tagName === "INPUT") return; const k = e.key;
  if (k === "1") { setMode(1); } else if (k === "2") { setMode(2); } else if (k === "3") { setMode(3); } else if (k === "4" || k === "0") { setMode("ext"); }
  else if (k === "t" || k === "T") $("tourBtn").click(); else if (k === "Escape") { if (walk.on) toggleWalk(false); selectEq(null); tourStop(); } });

// ================= 構築 & メインループ =================
function build(){
  buildSite(); buildBuilding(); buildInterior(); for (const L of LANES) generateLane(L); scene.add(FLOW_LINES); scene.add(LANE_LINK_LINES); LANE_LINK_LINES.visible = false; buildExteriorDetail(); buildInteriorDetail(); buildFloorDetail(); buildMEP(); buildMovers();
  for (const k in LAYERS) { if (k === "green" || k === "context") LAYERS[k].userData.layer = k; }
  // 人・車両レイヤー：階グループ内の作業者にも付与
  scene.traverse(o => { if (o.userData.legs) o.userData.layer = "people"; });
  renderStats(); renderLedger(); renderLanes(); renderOS(); renderPlant(); setDay("day"); setMode("ext"); setCam(VIEWS[0][1], true); refitLabels();
  $("loading").style.display = "none";
}
const clock = new THREE.Clock(); let frame = 0;
let hoverLabel = null, hoverZone = null;
function updateLabels(){
  const d = walk.on ? 12 : camGoal.dist; const f = mode === "ext" ? 0 : Number(mode); const all = layerState.labels;   // レイヤー「名称ラベル」ON で全表示
  for (const sp of LABELS){ const k = sp.userData.kind; if (k === "sign"){ sp.visible = true; continue; } if (k === "link"){ sp.visible = linksOn; continue; }
    if (!all){ sp.visible = (sp === hoverLabel) || (k === "zone" && sp.userData.zone === hoverZone) || (k === "tag" && sp.userData.laneId === activeLane); continue; }
    if (!k){ sp.visible = true; continue; }
    if (k === "zone") sp.visible = !walk.on && d > 28 && (sp.userData.floor === 0 ? (d > 60 && mode === "ext") : (mode !== "ext" && sp.userData.floor === f));
    else sp.visible = d < 90 && (walk.on || mode !== "ext") && (mode === "ext" || sp.userData.floor <= f); }
}
// ---- ホバーツールチップ（設備・MEP・ゾーン） ----
const tip = document.createElement("div"); tip.id = "tip"; document.body.appendChild(tip);
function zoneAt(x, z, f){ for (const zn of ZONES){ if (zn[2] !== f) continue; if (x >= zn[4] && x <= zn[5] && z >= zn[6] && z <= zn[7]) return zn; } return null; }
const floorPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
function hoverUpdate(e, id0){
  let html = "", lb = null; hoverZone = null;
  if (id0 && id0.mep){ const m = id0.mep, S = SYSTEMS[m.sys]; html = `<b>${pe(S.n)}</b><br>${pe(m.name || m.kind || "")}${m.length? ` · ${m.length.toFixed(1)} m` : ""}${m.sizeLabel? ` · ${pe(m.sizeLabel)}` : ""}`; }
  else if (id0){ const eq = EQUIP.find(x => x.id === id0); if (eq){ html = `<b>${pe(eq.id)}</b> ${pe(eq.name)}<br><span>${pe(zoneName(eq.zone))}${eq.lane? " · "+pe(eq.lane) : ""}</span>`; const o = EQ_OBJ[id0]; if (o) o.group.traverse(c => { if (c.isSprite && c.userData.kind === "eq" && !lb) lb = c; }); } }
  else if (!walk.on){ // 床のゾーン
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const f = mode === "ext" ? 1 : Number(mode); floorPlane.constant = -BLD.lv[f-1]; const pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(floorPlane, pt)){ const zn = zoneAt(pt.x, pt.z, f) || (mode === "ext" ? zoneAt(pt.x, pt.z, 0) : null); if (zn){ hoverZone = zn[0]; const hc = ZONES.filter(z => z[0] === zn[0]); html = `<b>${pe(zn[1])}</b><br><span>${pe(ZTYPE[zn[3]].n)}${zn[8]? " · "+zn[8]+" 名" : ""}</span>`; } } }
  hoverLabel = lb; tip.style.display = html ? "block" : "none"; if (html){ tip.innerHTML = html; tip.style.left = (e.clientX + 14) + "px"; tip.style.top = (e.clientY + 16) + "px"; }
}
cvsEl.addEventListener("pointerleave", () => { tip.style.display = "none"; hoverLabel = null; hoverZone = null; });
function loop(){
  requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); frame++;
  updateLabels();
  if (playing) updateMovers(dt);
  updateWalk(dt); applyCam();
  if (shadowDirty || (playing && frame % 3 === 0)){ renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  renderer.render(scene, camera);
}
$("loadMsg").textContent = "敷地・建屋・設備を生成しています…";
setTimeout(() => { try { build(); } catch (err) { $("loadMsg").textContent = "構築エラー: " + err.message; console.error(err); throw err; } loop(); }, 30);
window.THREE = THREE; window.__factory = { scene, camera, renderer, buildMEP, clearanceCheck, LOADS, clashCheck, mepSchedule, runClash, setXray, MEP, SYSTEMS, EQUIP, ZONES, BLD, SITE, DEMAND, assemblyScenarios, applyScenario, compareInhouse, LANE_SLOTS, setMode, setCam, setDay, focusEq, focusLane, FL, LAYERS, LANE_OBJ, generateLane, removeLane, allLaneKPI, computePlant, renderPlant, setActiveLane, setActiveModule, applyLaneForm, showLinks:(v)=>{ linksOn=v; renderPlant(); } };
