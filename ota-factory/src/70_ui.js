// ================= UI・モード切替・ピック・ツアー・メインループ =================
const $ = id => document.getElementById(id);

// ---- 視点プリセット ----
const VIEWS = [
  ["全景",      { yaw:-0.6, pitch:0.42, dist:150, target:[0,6,0] }, "ext"],
  ["正面（南）",{ yaw:0.05, pitch:0.2, dist:125, target:[0,8,20] }, "ext"],
  ["俯瞰",      { yaw:-0.2, pitch:1.35, dist:210, target:[0,0,0] }, "ext"],
  ["東ドック",  { yaw:2.0, pitch:0.5, dist:60, target:[44,6,-14] }, "ext"],
  ["前庭・ロビー",{ yaw:-0.55, pitch:0.18, dist:70, target:[-30,4,24] }, "ext"],
  ["ホール全景",{ yaw:-0.5, pitch:0.5, dist:140, target:[0,5,-12] }, 1],
  ["機械加工",  { yaw:-2.5, pitch:0.55, dist:50, target:[-28,3,-14] }, 1],
  ["組立ベイ",  { yaw:-0.7, pitch:0.45, dist:42, target:[-2,4,-16] }, 1],
  ["試験セル",  { yaw:2.6, pitch:0.6, dist:40, target:[28,3,-6] }, 1],
  ["2F ソフト", { yaw:-1.05, pitch:0.42, dist:60, target:[-20,7,10] }, 2],
  ["3F 設計",   { yaw:-0.9, pitch:0.42, dist:60, target:[-20,11.5,10] }, 3],
];
let mode = "ext";   // ext | 1 | 2 | 3
function setMode(m, keepCam=false){
  mode = m; document.querySelectorAll("#nav [data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === String(m)));
  const f = m === "ext" ? 99 : Number(m);
  FL[1].visible = true; FL[2].visible = f >= 2; FL[3].visible = f >= 3; FL.roof.visible = f >= 4 || m === "ext";
  // 屋根は 1〜3F 表示時に外す。外観では全表示。
  $("crumb").innerHTML = m === "ext" ? "<b>外観</b> · 敷地全体" : `<b>${m}F</b> · 上階と屋根を外して表示（ドールハウス）`;
  dirtyShadow();
}
{ const v = $("views"); VIEWS.forEach(([n, cam, md]) => { const b = document.createElement("button"); b.className = "btn sm"; b.textContent = n; b.onclick = () => { if (walk.on) toggleWalk(false); setMode(md); setCam(cam); }; v.appendChild(b); }); }
document.querySelectorAll("#nav [data-mode]").forEach(b => b.onclick = () => { if (walk.on) toggleWalk(false); setMode(b.dataset.mode === "ext" ? "ext" : Number(b.dataset.mode)); const v = VIEWS.find(x => String(x[2]) === b.dataset.mode) ; if (v) setCam(v[1]); });
document.querySelectorAll("#tools [data-day]").forEach(b => b.onclick = () => { document.querySelectorAll("#tools [data-day]").forEach(x => x.classList.remove("on")); b.classList.add("on"); setDay(b.dataset.day); });

// ---- 稼働 再生/停止 ----
$("playBtn").onclick = () => { playing = !playing; $("playBtn").textContent = playing ? "⏸ 稼働" : "▶ 稼働"; $("playBtn").classList.toggle("on", playing); };

// ---- レイヤー ----
const LAYER_DEFS = [["structure","鉄骨架構・トラス"],["envelope","外皮・ガラス・間仕切り"],["equipment","機械設備"],["furniture","什器・オフィス"],["mep","MEP（ダクト・配管・照明）"],["overhead","天井工具（ガントリー・ツールレール・ブーム）"],["markings","床ライン・安全表示"],["people","人・車両（稼働）"],["labels","名称ラベル"],["green","植栽"],["context","周辺街区・道路"]];
const layerState = {};
function applyLayers(){ scene.traverse(o => { const l = o.userData.layer; if (l && layerState[l] !== undefined) o.visible = layerState[l]; }); if (LAYERS.green) LAYERS.green.visible = layerState.green; if (LAYERS.context) LAYERS.context.visible = layerState.context; dirtyShadow(); }
{ const list = $("layerList"); for (const [k, n] of LAYER_DEFS){ layerState[k] = true; const lb = document.createElement("label"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true; cb.onchange = () => { layerState[k] = cb.checked; applyLayers(); }; lb.appendChild(cb); lb.appendChild(document.createTextNode(n)); list.appendChild(lb); } }
$("layersBtn").onclick = () => { const p = $("layers"); const on = p.style.display !== "block"; p.style.display = on ? "block" : "none"; $("section").style.display = "none"; $("secBtn").classList.remove("on"); $("layersBtn").classList.toggle("on", on); };

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
$("secBtn").onclick = () => { const p = $("section"); secOn = p.style.display !== "block"; p.style.display = secOn ? "block" : "none"; $("layers").style.display = "none"; $("layersBtn").classList.remove("on"); $("secBtn").classList.toggle("on", secOn); applySection(); };
$("secOff").onclick = () => { secOn = false; $("section").style.display = "none"; $("secBtn").classList.remove("on"); applySection(); };

// ---- 歩行モード ----
function toggleWalk(on){
  walk.on = on; document.body.classList.toggle("walk", on); $("walkBtn").classList.toggle("on", on);
  if (on){ const t = camGoal.target; walk.pos.set(clamp(t.x, -58, 58), (mode === "ext" ? 0 : BLD.lv[Math.max(0, Number(mode) - 1)] || 0) + 1.65, clamp(t.z, -38, 38)); walk.yaw = camGoal.yaw + Math.PI; walk.pitch = -0.05; cvsEl.requestPointerLock?.(); }
  else { document.exitPointerLock?.(); camDirty = true; }
}
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
  let h = `<table class="ptbl"><tr><td>精密・大型部品</td><td class="n">${K.parts.toFixed(0)} 個/日</td></tr><tr><td>大型機 組立</td><td class="n">${K.machines.toFixed(1)} 台/月</td></tr><tr><td>制御盤</td><td class="n">${K.panels.toFixed(0)} 面/日</td></tr><tr><td>ソフト リリース</td><td class="n">${K.releases.toFixed(0)} 件/週</td></tr><tr><td>平均自動化率 / 無人運転</td><td class="n">${(K.autoAvg*100).toFixed(0)}% / ${K.unattended} h</td></tr></table><div class="sub">レーン定義（レシピ×区画×シフト）から自動算出。左下「レーン・生産性」で再構成できます。</div><div class="sep"></div>
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
  const p = $("info"); if (!e){ p.style.display = "none"; return; }
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
  { id:"mach-N", n:"機械加工エリア 北側（1F）", zone:"mach", floor:1, area:[-43,-13,-29.5,-12] },
  { id:"mach-S", n:"機械加工エリア 南側（1F）", zone:"mach", floor:1, area:[-43,-13,-11,1] },
  { id:"asm",    n:"大型組立ベイ A＋B（1F）",   zone:"asm1", floor:1, area:[-11,19,-29,1] },
  { id:"elab",   n:"電子・制御ラボ（1F）",      zone:"elab", floor:1, area:[-5.5,5.5,3,17] },
  { id:"recv",   n:"受入・資材置場を転用（1F）",zone:"recv", floor:1, area:[20.5,35.5,-29.5,-14.5] },
  { id:"yard",   n:"北側 屋外庇下ヤード",       zone:"north",floor:1, area:[8,32,-39,-33.5] },
  { id:"sw",     n:"ソフトウェア開発フロア（2F）",zone:"sw",  floor:2, area:[-36,34,3,17] },
];
const MAIN_STATION = { precision:"mc5", heavy:"gantry", assembly:"asmMech", panel:"panel", software:"hil" };
function slotOf(lane){ return LANE_SLOTS.find(sl => sl.zone === lane.zone && sl.area[2] === lane.area[2]) || LANE_SLOTS.find(sl => sl.zone === lane.zone); }
function laneCard(o){ const L = o.lane, R = LANE_RECIPES[L.recipe], k = o.kpi; const c = "#"+R.color.toString(16).padStart(6,"0"); const sl = slotOf(L);
  const chips = R.os.map(m => `<span class="chip" data-mod="${m}">${pe(OS_MODULES[m].n)}</span>`).join("");
  const mainT = MAIN_STATION[L.recipe]; const mainN = (L.override||{})[mainT] ?? (R.stations.find(x=>x[0]===mainT)||[0,1])[1];
  return `<div class="lane${activeLane===L.id?" on":""}" data-id="${L.id}" style="--c:${c}"><div class="lh"><b>${pe(L.id)}</b>${pe(R.n)}<small>${pe(sl? sl.n : L.zone)}</small></div><div class="desc">${pe(R.desc)}</div>
  <div class="kpi"><div><small>生産量</small><b class="big">${pe(k.outLabel)}</b></div><div><small>タクト（ボトルネック）</small><b>${pe(k.taktLabel)}</b></div><div><small>OEE</small><b>${(k.oee*100).toFixed(0)}%</b></div>
  <div><small>自動化率（時間）</small><b>${(k.autoRatio*100).toFixed(0)}%</b></div><div><small>要員 / 機械</small><b>${k.ppl.toFixed(1)} 人 / ${k.machines} 台</b></div><div><small>リードタイム</small><b>${pe(k.leadLabel)}</b></div></div>
  <div class="sub" style="margin-top:5px">ボトルネック: ${pe(k.bottleneck)} ／ 無人運転 ${k.unattended} h/日 ／ ${L.shifts.shifts} 直 × ${L.shifts.hours} h${o.lay.overflow>0? ` ／ <span class="warn" style="color:var(--bad)">区画を ${o.lay.overflow.toFixed(1)} m はみ出し</span>`:""}</div>
  <div class="chips">${chips}</div><div class="ctl"><button class="btn sm" data-act="view">3Dで見る</button><button class="btn sm" data-act="cfg">構成を変える</button><button class="btn sm" data-act="del">削除</button></div>
  <form class="cfg" hidden><label>レシピ<select name="recipe">${Object.keys(LANE_RECIPES).map(r=>`<option value="${r}"${r===L.recipe?" selected":""}>${pe(LANE_RECIPES[r].n)}</option>`).join("")}</select></label>
  <label>主要機械の台数<input name="main" type="number" min="1" max="6" value="${mainN}"></label><label>シフト数<input name="shifts" type="number" min="1" max="3" value="${L.shifts.shifts}"></label>
  <label>無人運転 h/日<input name="unattended" type="number" min="0" max="16" value="${L.shifts.unattended}"></label><label>区画<select name="slot">${LANE_SLOTS.map(sl=>`<option value="${sl.id}"${sl.id===(slotOf(L)||{}).id?" selected":""}>${pe(sl.n)}</option>`).join("")}</select></label>
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
  if (!L.oee) L.oee = { avail:0.88, perf:0.95, qual:0.985 }; generateLane(L); setActiveLane(L.id); afterLaneChange(); focusLane(L.id); }
function afterLaneChange(){ renderLanes(); renderOS(); renderLedger(); renderStats(); refreshLaneVis(); dirtyShadow(); }
function focusLane(id){ const o = LANE_OBJ[id]; if (!o) return; const L = o.lane; if (walk.on) toggleWalk(false); setMode(L.floor); const [x0,x1,z0,z1] = L.area; const w = Math.max(x1-x0, z1-z0);
  setCam({ yaw: L.floor===2? -0.9 : -0.6, pitch:0.62, dist: w*1.35, target:[(x0+x1)/2, BLD.lv[L.floor-1]+2, (z0+z1)/2] }); setActiveLane(id); renderLanes(); renderOS(); }
$("laneAdd").onclick = () => { let n = 6; while (LANE_OBJ["L"+n]) n++; const id = "L"+n; const fd = new Map([["recipe","precision"],["main","3"],["shifts","2"],["unattended","8"],["slot","recv"]]); applyLaneForm(id, fd); const card = document.querySelector(`.lane[data-id="${id}"] form`); if (card) card.hidden = false; };

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
  for (const h of hits){ if (h.object.isSprite) continue; let o = h.object; while (o){ if (o.userData.eqId) return o.userData.eqId; o = o.parent; } return null; } return null; }
cvsEl.addEventListener("pointerup", e => { if (walk.on || drag.moved > 6 || e.button !== 0) return; const id = pickAt(e.clientX, e.clientY); if (id) { selectEq(id); } else selectEq(null); });
let hoverTimer = 0;
cvsEl.addEventListener("pointermove", e => { if (walk.on || drag.on) return; const now = performance.now(); if (now - hoverTimer < 80) return; hoverTimer = now; const id = pickAt(e.clientX, e.clientY); if (id !== hoverId){ if (hoverId && hoverId !== selectedId) setHighlight(hoverId, false); hoverId = id; if (id && id !== selectedId) setHighlight(id, true); cvsEl.style.cursor = id ? "pointer" : ""; } });

// ---- 構想イメージ ----
{ const g = $("photoGrid"); PHOTOS.forEach(p => { const f = document.createElement("figure"); f.style.margin = 0; f.innerHTML = `<img src="${p.f}" alt="${pe(p.t)}" loading="lazy"><figcaption>${pe(p.t)}</figcaption>`; f.querySelector("img").onclick = () => { $("lbImg").src = p.f; $("lbCap").textContent = p.t; $("lightbox").style.display = "flex"; }; g.appendChild(f); }); }
$("lightbox").onclick = () => $("lightbox").style.display = "none";
$("photosBtn").onclick = () => { const p = $("photos"); const on = p.style.display !== "block"; p.style.display = on ? "block" : "none"; $("photosBtn").classList.toggle("on", on); };

// ---- ガイドツアー ----
let tourIdx = -1, tourTimer = null;
function tourGo(i){ if (i < 0 || i >= TOUR.length){ tourStop(); return; } tourIdx = i; const s = TOUR[i]; if (walk.on) toggleWalk(false);
  if (s.mode === "ext") setMode("ext"); else setMode(s.floor); setCam(s.cam);
  if (s.lane) setActiveLane(s.lane); else if (s.module) setActiveModule(s.module); else setActiveLane(null); renderLanes(); renderOS();
  if (s.module) document.querySelector('[data-tab="os"]').click(); else if (s.lane) document.querySelector('[data-tab="lanes"]').click();
  $("tourStep").textContent = `ガイドツアー ${i + 1} / ${TOUR.length}`; $("tourTitle").textContent = s.title; $("tourText").textContent = s.text; $("tourCard").style.display = "block";
  clearTimeout(tourTimer); tourTimer = setTimeout(() => tourGo(i + 1), 11000); }
function tourStop(){ clearTimeout(tourTimer); tourTimer = null; tourIdx = -1; $("tourCard").style.display = "none"; $("tourBtn").classList.remove("on"); setActiveLane(null); renderLanes(); renderOS(); }
$("tourBtn").onclick = () => { if (tourIdx >= 0) tourStop(); else { $("tourBtn").classList.add("on"); tourGo(0); } };
$("tourNext").onclick = () => tourGo(tourIdx + 1); $("tourPrev").onclick = () => tourGo(Math.max(0, tourIdx - 1)); $("tourStop").onclick = tourStop;

// ---- スクリーンショット ----
$("shotBtn").onclick = () => { renderer.render(scene, camera); const a = document.createElement("a"); a.download = `yellow-ota-factory-${Date.now()}.png`; a.href = renderer.domElement.toDataURL("image/png"); a.click(); };

// ---- キーボード ----
addEventListener("keydown", e => { if (e.target.tagName === "INPUT") return; const k = e.key;
  if (k === "1") { setMode(1); } else if (k === "2") { setMode(2); } else if (k === "3") { setMode(3); } else if (k === "4" || k === "0") { setMode("ext"); }
  else if (k === "t" || k === "T") $("tourBtn").click(); else if (k === "Escape") { if (walk.on) toggleWalk(false); selectEq(null); tourStop(); } });

// ================= 構築 & メインループ =================
function build(){
  buildSite(); buildBuilding(); buildInterior(); for (const L of LANES) generateLane(L); scene.add(FLOW_LINES); buildMovers();
  for (const k in LAYERS) { if (k === "green" || k === "context") LAYERS[k].userData.layer = k; }
  // 人・車両レイヤー：階グループ内の作業者にも付与
  scene.traverse(o => { if (o.userData.legs) o.userData.layer = "people"; });
  renderStats(); renderLedger(); renderLanes(); renderOS(); setDay("day"); setMode("ext"); setCam(VIEWS[0][1], true); refitLabels();
  $("loading").style.display = "none";
}
const clock = new THREE.Clock(); let frame = 0;
function updateLabels(){
  const d = walk.on ? 12 : camGoal.dist; const f = mode === "ext" ? 0 : Number(mode);
  for (const sp of LABELS){ const k = sp.userData.kind; if (!k){ sp.visible = layerState.labels; continue; }
    if (k === "zone") sp.visible = layerState.labels && !walk.on && d > 28 && (sp.userData.floor === 0 ? (d > 60 && mode === "ext") : (mode !== "ext" && sp.userData.floor === f));
    else sp.visible = layerState.labels && d < 90 && (walk.on || mode !== "ext") && (mode === "ext" || sp.userData.floor <= f); }
}
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
window.__factory = { scene, camera, renderer, EQUIP, ZONES, BLD, SITE, setMode, setCam, setDay, focusEq, focusLane, FL, LAYERS, LANE_OBJ, generateLane, removeLane, allLaneKPI, setActiveLane, setActiveModule, applyLaneForm };
