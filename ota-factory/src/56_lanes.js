// ================= レーン自動生成・生産性 KPI・Factory OS 連携 =================
const LANE_OBJ = {};        // id -> { lane, group, stations, overlay, kpi, eqIds, anim:[...] }
let activeLane = null, activeModule = null;

const BUILDERS = { mc5:makeMC5, hmc:makeHMC, lathe:makeLathe, gantry:makeGantry, edm:makeEDM, grind:makeGrinder, robotcell:()=>makeRobotCell(true),
  load:makeLoadStation, wash:makeWash, store:makeStore, asmA:()=>makeAssembly("A"), asmB:()=>makeAssembly("B"), panel:makePanelStation, wiring:makeWiringStation, ptest:makePowerTest,
  laser:makeLaserCutter, brake:makePressBrake, weld:makeWeldCell, finish:makeFinishBooth, mask:makeMaskStation, booth:makePaintBooth, oven:makeOven, demoPrep:makeDemoPrep, demo:makeDemoStage, tcell:()=>{ const g = makeTestCellStation(); g.scale.set(0.76, 0.85, 0.8); return g; } };

// 実際のモデル寸法から占有寸法を測る（宣言値より大きければ上書き）
const FP_CACHE = {};
function measuredFp(t){ const S = STATION_TYPES[t]; if (!S.fp) return undefined; if (FP_CACHE[t]) return FP_CACHE[t]; const b = BUILDERS[S.kind]; if (!b) return FP_CACHE[t] = S.fp.slice();
  const g = b(); g.updateMatrixWorld(true); const bb = new THREE.Box3(); g.traverse(m => { if (m.isMesh && !m.isSprite) bb.union(new THREE.Box3().setFromObject(m)); }); g.traverse(m => { if (m.isMesh) m.geometry.dispose?.(); });
  const w = bb.isEmpty() ? 0 : bb.max.x - bb.min.x + 0.4, d = bb.isEmpty() ? 0 : bb.max.z - bb.min.z + 0.4; FP_OFF[t] = bb.isEmpty() ? [0,0] : [(bb.min.x + bb.max.x)/2, (bb.min.z + bb.max.z)/2]; return FP_CACHE[t] = [Math.max(S.fp[0], +w.toFixed(1)), Math.max(S.fp[1], +d.toFixed(1))]; }
const FP_OFF = {};   // モデル原点に対する箱中心のずれ（配置時に補正）
// レシピ＋パラメータ → ステーション配列（[type, n] を展開）
function expandStations(lane){
  const R = LANE_RECIPES[lane.recipe]; const ov = lane.override || {};
  // 注意: STATION_TYPES の n は表示名なので、台数 n は spread の後で上書きする
  const so = lane.stationOv || {};   // { type: { ct, n, auto, ppl } }
  const off = lane.offload || [];   // 他レーンへ外出しした工程（例: 組立の試験）
  const sts = R.stations.filter(([t]) => !off.includes(t)).map(([t, n], i) => ({ ...STATION_TYPES[t], fp: measuredFp(t), idx:i+1, type:t, n: so[t]?.n ?? ov[t] ?? n, label: STATION_TYPES[t].n, spec: STATION_TYPES[t].spec ? {...STATION_TYPES[t].spec} : {},
    ...(so[t]?.ct !== undefined ? { ct:so[t].ct } : {}), ...(so[t]?.auto ? { auto:so[t].auto } : {}), ...(so[t]?.ppl !== undefined ? { ppl:so[t].ppl } : {}) }));
  const aux = (R.aux||[]).map(([t,n], i) => ({ ...STATION_TYPES[t], fp: measuredFp(t), idx:"A"+(i+1), type:t, n, aux:true, label: STATION_TYPES[t].n, spec: STATION_TYPES[t].spec ? {...STATION_TYPES[t].spec} : {} }));
  return { sts, aux };
}

// ---- 配置（蛇行）：区画内で左→右、はみ出したら次の行で右→左 ----
function layoutLane(lane, sts){
  const [x0, x1, z0, z1] = lane.area; const usable = x1 - x0 - 1.0; const sideC = k => (typeof CLEARANCE !== "undefined" && CLEARANCE[k]) ? CLEARANCE[k][1] : 0.6; let gap = 0.6;
  const rows = [[]]; let cur = 0, row = 0;
  const units = []; for (const s of sts){ if (s.kind === "ref") { units.push({ s, ref:true }); continue; } for (let k=0;k<s.n;k++) units.push({ s, k, w:s.fp[0], d:s.fp[1] }); }
  let prevKind = null; for (const u of units){ if (u.ref) continue; gap = Math.max(0.6, sideC(u.s.kind), prevKind ? sideC(prevKind) : 0); if (cur + u.w > usable && rows[row].length){ row++; rows[row] = []; cur = 0; } rows[row].push(u); u.row = row; u.off = cur; cur += u.w + gap; prevKind = u.s.kind; }
  // 行ごとの奥行とピッチ（行0-1 間は 4 m 通路、以降は 2.5 m）
  let zTop = z0 + 0.5; const rowInfo = [];
  rows.forEach((r, i) => { const d = Math.max(...r.map(u=>u.d), 2); const aisle = i===0? 0 : (i%2===1? 2.6 : 1.8); zTop += aisle; rowInfo.push({ zTop, d, len: r.length? r[r.length-1].off + r[r.length-1].w : 0 }); zTop += d; });
  const over = zTop - z1; // 区画をはみ出す場合は圧縮（警告）
  for (const u of units){ if (u.ref) continue; const ri = rowInfo[u.row]; const dir = (u.row % 2 === 0) ? 1 : -1;
    const xs = dir === 1 ? (x0 + 0.5 + u.off + u.w/2) : (x0 + 0.5 + ri.len - u.off - u.w/2);
    u.x = xs; u.z = ri.zTop + ri.d/2; u.rot = (u.row % 2 === 0) ? 0 : Math.PI; if (u.s.kind==="gantry") u.rot = 0; }
  return { units, rows: rowInfo, overflow: Math.max(0, over) };
}

function resolveRef(ref, lane, prevPos){
  if (ref === "@lane") return prevPos;
  if (ref && ref.startsWith("@zone:")){ const z = ZONES.find(z=>z[0]===ref.slice(6)); return z ? { x:(z[4]+z[5])/2, z:(z[6]+z[7])/2, floor:z[2] } : prevPos; }
  const e = EQUIP.find(e=>e.id===ref); if (!e) return prevPos; const f = ZONES.find(z=>z[0]===e.zone)?.[2] ?? 1; return { x:e.x, z:e.z, floor:f, id:e.id };
}

// ---- レーン生成 ----
function generateLane(lane){
  removeLane(lane.id);
  const R = LANE_RECIPES[lane.recipe]; const { sts, aux } = expandStations(lane); const lay = layoutLane(lane, [...sts, ...aux]);
  const g = new THREE.Group(); g.name = "lane_"+lane.id; g.userData.layer = "equipment"; floorGroup(lane.floor).add(g);
  const yF = BLD.lv[lane.floor-1]; const animStart = ANIM.length; const eqIds = [];
  const stationPos = [];   // 工程順の代表点
  let prev = { x:(lane.area[0]+lane.area[1])/2, z:(lane.area[2]+lane.area[3])/2, floor:lane.floor };
  for (const s of [...sts, ...aux]){
    if (s.kind === "ref"){ const p = resolveRef(s.ref, lane, prev); s.pos = p; if (!s.aux) stationPos.push({ ...p, s }); prev = p; continue; }
    const us = lay.units.filter(u=>u.s===s); const cx = us.reduce((a,u)=>a+u.x,0)/us.length, cz = us.reduce((a,u)=>a+u.z,0)/us.length;
    s.pos = { x:cx, z:cz, floor:lane.floor }; s.units = us; if (!s.aux) stationPos.push({ x:cx, z:cz, floor:lane.floor, s }); prev = s.pos;
    us.forEach((u, k) => { const b = BUILDERS[s.kind]; if (!b) return; const grp = b(); compactGroup(grp); const ex = makeMachineExtras(s.kind, s.fp[0], s.fp[1]); ex.userData.extra = true; compactGroup(ex); grp.add(ex); const off = FP_OFF[s.type] || [0,0]; const sgn = Math.abs(u.rot) > 1 ? -1 : 1; grp.position.set(u.x - sgn*off[0], yF, u.z - sgn*off[1]); grp.rotation.y = u.rot;
      const id = `${lane.id}-S${s.idx}${s.n>1? String.fromCharCode(97+k) : ""}`; const e = { id, kind:s.kind, name: s.n > 1 ? `${STATION_TYPES[s.type].n} #${k+1}` : STATION_TYPES[s.type].n, x:+u.x.toFixed(1), z:+u.z.toFixed(1), rot:u.rot, zone:lane.zone, lane:lane.id, station:s.idx, generated:true,
        spec:{ レーン:`${lane.id} ${R.n}`, 工程:`S${s.idx}${s.aux? "（補助）":""} ${s.n>1? s.n+" 台並列" : ""}`, 標準時間:`${s.ct} ${s.unit}/${R.unitName}`, 自動化:s.auto==="auto"? "無人運転可" : s.auto==="semi"? "監視付き自動" : "手作業", ...s.spec } };
      EQUIP.push(e); tagEq(grp, e); eqIds.push(id); g.add(grp);
      const lb = makeLabel(`${id}  ${e.name}`, { scale:0.65, bg:"rgba(13,17,23,0.65)" }); lb.position.set(0, s.kind==="gantry"? 7.2 : s.kind==="asmA"? 6.5 : 3.6, 0); lb.userData.kind = "eq"; lb.userData.floor = lane.floor; grp.add(lb); });
  }
  // ---- 床のレーン表示（流れの帯・工程マーカー・工程タグ）----
  const ov = new THREE.Group(); ov.name = "laneOverlay"; ov.userData.layer = "markings"; g.add(ov);
  const col = new THREE.Color(R.color); const strips = [];
  for (let i=0;i<stationPos.length-1;i++){ const a = stationPos[i], b = stationPos[i+1]; if (a.floor !== b.floor) { flowLine(ov, [new THREE.Vector3(a.x, BLD.lv[a.floor-1]+1.5, a.z), new THREE.Vector3(a.x, Math.max(BLD.lv[a.floor-1], BLD.lv[b.floor-1])+4, a.z), new THREE.Vector3(b.x, Math.max(BLD.lv[a.floor-1], BLD.lv[b.floor-1])+4, b.z), new THREE.Vector3(b.x, BLD.lv[b.floor-1]+1.5, b.z)], col, 0.8, 0.5); continue; }
    const L = Math.hypot(b.x-a.x, b.z-a.z); if (L < 0.5) continue; const tex = arrowTex().clone(); tex.needsUpdate = true; tex.repeat.set(L/2, 1);
    const mat = new THREE.MeshBasicMaterial({ map:tex, color:col, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide });
    const m = new THREE.Mesh(G.plane(L, 1.2), mat); m.rotation.x = -Math.PI/2; m.rotation.z = -Math.atan2(b.z-a.z, b.x-a.x); m.position.set((a.x+b.x)/2, yF+0.08, (a.z+b.z)/2); m.renderOrder = 3; ov.add(m); strips.push(m); }
  stationPos.forEach((p, i) => { if (p.floor !== lane.floor) return; const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 28), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.8, depthWrite:false })); ring.rotation.x = -Math.PI/2; ring.position.set(p.x, yF+0.085, p.z); ring.renderOrder = 4; ov.add(ring);
    const s = p.s; const tag = makeLabel(`S${s.idx}  ${s.n>1? "×"+s.n+" " : ""}${s.ct? s.ct+" "+s.unit : ""}`, { scale:0.55, bg:"rgba(20,24,30,0.8)", accent:"#"+R.color.toString(16).padStart(6,"0") }); tag.position.set(p.x, yF+1.2, p.z); tag.userData.kind = "tag"; tag.userData.laneId = lane.id; tag.userData.floor = lane.floor; ov.add(tag); });
  const anim = { update(t){ for (const m of strips) m.material.map.offset.x = -t*0.35; } }; ANIM.push(anim);
  // ---- 天井設備 ----
  const oh = new THREE.Group(); oh.name = "overhead"; oh.userData.layer = "overhead"; g.add(oh); const ceilY = lane.zone==="north" ? 5.9 : lane.floor===1 ? (lane.zone==="mach"||lane.zone==="asm1"||lane.zone==="asm2" ? 12.6 : BLD.lv[1]-0.8) : BLD.lv[lane.floor]-0.8;
  const row0 = lay.rows[0]; const laneLen = lane.area[1]-lane.area[0]-1; const cxL = (lane.area[0]+lane.area[1])/2;
  for (const k of R.overhead){
    if (k==="gantryLoader"){ const mcs = lay.units.filter(u=>u.s.kind==="mc5" && u.row===0); if (!mcs.length) continue; const xs = mcs.map(u=>u.x); const xa = Math.min(...xs)-3.2, xb = Math.max(...xs)+3.2; const z = mcs[0].z; const gl = makeGantryLoader(xb-xa, 6.6, xs.map(x=>x-(xa+xb)/2)); gl.position.set((xa+xb)/2, yF, z); oh.add(gl); animOverhead("gantryLoader", gl, 0); }
    else if (k==="toolRail"){ const len = Math.min(laneLen, 30); const z = lane.recipe==="assembly" ? (row0.zTop + row0.d/2) : (row0.zTop + row0.d + 2.0); const low = lane.zone==="elab" || lane.zone==="north"; const railY = low ? 3.6 : 6.6; const hl = Math.max(0.6, ceilY - railY); const tr = makeToolRail(len, hl, lane.recipe==="panel"? 2 : 4); tr.position.set(cxL, yF+railY, z); if (low){ tr.userData.trolleys.forEach(o=>{ o.tool.position.y = -1.6; }); } oh.add(tr); animOverhead("toolRail", tr, 0); }
    else if (k==="boom"){ const boomY = (lane.zone==="elab" || lane.zone==="north") ? 3.3 : 6.5; const hl = Math.max(0.3, ceilY - yF - boomY); for (const [i, x] of [cxL-laneLen*0.3, cxL+laneLen*0.3].entries()){ const bm = makeEnergyBoom(hl); bm.position.set(x, yF + boomY, row0.zTop + row0.d + (lane.recipe==="assembly"? -1 : 1.5)); oh.add(bm); animOverhead("boom", bm, i*1.3); } }
    else if (k==="jib"){ const gu = lay.units.find(u=>u.s.kind==="gantry"); if (!gu) continue; const j = makeJib(); j.position.set(gu.x + gu.w/2 + 1.2, yF, gu.z + 1.5); oh.add(j); animOverhead("jib", j, 0.4); }
    else if (k==="laser"){ const au = lay.units.find(u=>u.s.kind==="asmA"); if (!au) continue; const lp = makeLaserProjector(9.4, 4.9); lp.position.set(au.x, 0, au.z); placeLaser(lp, ceilY, yF, 9.4, 4.9); oh.add(lp); animOverhead("laser", lp, 0); }
    else if (k==="cams"){ for (let x=lane.area[0]+3; x<lane.area[1]-1; x+=8){ const c = makeCamNode(); c.position.set(x, ceilY, lane.area[2]+1.5); c.rotation.y = Math.PI; oh.add(c); } }
    else if (k==="crane"){ /* 既設 CR-01/02 を使用 */ }
  }
  // 区画内に残る固定設備（ラック等）は転用に伴い非表示にし、レーン削除時に復元
  const hidden = []; for (const id in EQ_OBJ){ const o = EQ_OBJ[id]; if (o.data.generated || !["rack","bench","testcell"].includes(o.data.kind)) continue; const [x0,x1,z0,z1] = lane.area; const f = ZONES.find(z=>z[0]===o.data.zone)?.[2] ?? 1;
    if (f===lane.floor && o.data.x>x0 && o.data.x<x1 && o.data.z>z0 && o.data.z<z1 && o.group.visible){ o.group.visible = false; hidden.push(id); } }
  oh.children.slice().forEach(c => compactGroup(c));
  // アンドン表示板（レーン中央の天井から）とレーン名バナー
  const kpi0 = computeLaneKPI(lane, sts); const cxA = (lane.area[0]+lane.area[1])/2, czA = lane.area[2] + 1.5;
  if (lane.floor === 1 && lane.zone !== "north"){ const an = makeAndon({ lane, kpi:kpi0 }); an.position.set(cxA, Math.min(ceilY - 0.2, yF + 9.0), czA); an.scale.setScalar(0.8); oh.add(an);
    const bn = makeBanner(`${lane.id}  ${R.n}`, R.color); bn.position.set(cxA - 6.5, Math.min(ceilY - 0.2, yF + 8.4), czA); bn.scale.setScalar(0.8); oh.add(bn); }
  else if (lane.zone === "north"){ const an = makeAndon({ lane, kpi:kpi0 }); an.position.set(cxA, 5.4, -31.2); an.scale.setScalar(0.7); oh.add(an); }
  const obj = { lane, group:g, sts, aux, lay, stationPos, overlay:ov, eqIds, anim: ANIM.slice(animStart), strips, hidden };
  obj.kpi = computeLaneKPI(lane, sts); LANE_OBJ[lane.id] = obj; return obj;
}
function removeLane(id){ const o = LANE_OBJ[id]; if (!o) return; o.group.parent?.remove(o.group); for (const h of o.hidden||[]) if (EQ_OBJ[h]) EQ_OBJ[h].group.visible = true; for (const a of o.anim){ const i = ANIM.indexOf(a); if (i>=0) ANIM.splice(i,1); }
  for (const eid of o.eqIds){ const i = EQUIP.findIndex(e=>e.id===eid); if (i>=0) EQUIP.splice(i,1); delete EQ_OBJ[eid]; } delete LANE_OBJ[id]; }

function arrowTex(){ return canvasTex("arrow", 128, (c,w,h)=>{ c.clearRect(0,0,w,h); c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(0, h*0.42, w, h*0.16); c.fillStyle = "rgba(255,255,255,0.95)"; c.beginPath(); c.moveTo(w*0.55, h*0.18); c.lineTo(w*0.9, h*0.5); c.lineTo(w*0.55, h*0.82); c.closePath(); c.fill(); }, { repeat:[1,1] }); }
const FLOW_UNI = { t:{ value:0 } };
function flowMat(col, dash, gap, op=0.9){ return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:{ color:{ value:new THREE.Color(col) }, t:FLOW_UNI.t, dash:{ value:dash }, gap:{ value:gap }, op:{ value:op } },
  vertexShader:"attribute float lineDistance; varying float vD; void main(){ vD = lineDistance; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:"uniform vec3 color; uniform float t,dash,gap,op; varying float vD; void main(){ float p = mod(vD - t*3.0, dash+gap); if (p > dash) discard; gl_FragColor = vec4(color, op); }" }); }
function flowLine(parent, pts, col, dash=0.6, gap=0.9, op=0.9){ const geo = new THREE.BufferGeometry().setFromPoints(pts); const l = new THREE.Line(geo, flowMat(col, dash, gap, op)); l.computeLineDistances(); l.userData.isFlow = true; parent.add(l); return l; }

// ---- KPI ----
function computeLaneKPI(lane, sts){
  const R = LANE_RECIPES[lane.recipe]; const o = lane.oee; const oee = o.avail*o.perf*o.qual; const sh = lane.shifts;
  const work = sts.filter(s=>s.ct>0); const takts = work.map(s=>s.ct/s.n); const bi = takts.indexOf(Math.max(...takts)); const takt = takts[bi]; const bott = work[bi];
  const ctSum = work.reduce((a,s)=>a+s.ct,0); const autoRatio = work.reduce((a,s)=>a+(s.auto==="auto"? s.ct:0),0)/ctSum;
  const ppl = sts.reduce((a,s)=>a+s.ppl*s.n,0); const lead = work.reduce((a,s)=>a+s.ct/s.n,0);
  const unattended = bott.auto==="auto" ? sh.unattended : 0; const attended = sh.hours*sh.shifts;
  let out, outLabel, period, nightShare = 0;
  const perHour = bott.unit === "min" ? 60 : 1;   // ct の単位に合わせる
  if (R.mode==="flow"){ const hrs = attended + unattended; out = hrs*perHour*oee/takt; nightShare = unattended/hrs; outLabel = `${out < 10 ? out.toFixed(1) : out.toFixed(0)} ${R.unitName}/日`; period = "日"; }
  else if (R.mode==="project"){ const hrs = attended*(sh.days||21); out = hrs*oee/takt; outLabel = `${out.toFixed(1)} ${R.unitName}/月`; period = "月"; }
  else { const hrs = (sh.days||5)*(attended+unattended); out = hrs*oee/takt; nightShare = unattended/(attended+unattended); outLabel = `${out.toFixed(0)} ${R.unitName}/週`; period = "週"; }
  const unit = bott.unit; const machines = sts.filter(s=>s.kind!=="ref").reduce((a,s)=>a+s.n,0);
  return { oee, takt, taktLabel:`${takt%1? takt.toFixed(1):takt} ${unit}`, bottleneck:`S${bott.idx} ${bott.n}`.replace(/ \d+$/, "")+` ${bott.n>1? "×"+bott.n+" ":""}${STATION_TYPES[bott.type].n}`, autoRatio, ppl, lead, leadLabel: unit==="min"? `${(lead).toFixed(0)} min` : `${lead.toFixed(0)} h（${(lead/8).toFixed(1)} 日）`, out, outLabel, period, nightShare, machines, unattended };
}
function allLaneKPI(){ const r = { parts:0, machines:0, panels:0, releases:0, ppl:0, auto:[], unattended:0 };
  for (const id in LANE_OBJ){ const o = LANE_OBJ[id], R = LANE_RECIPES[o.lane.recipe], k = o.kpi; if (o.lane.recipe==="panel") r.panels += k.out; else if (R.mode==="flow") r.parts += k.out; else if (R.mode==="project") r.machines += k.out; else r.releases += k.out; r.ppl += k.ppl; r.auto.push(k.autoRatio); r.unattended = Math.max(r.unattended, k.unattended); }
  r.autoAvg = r.auto.length? r.auto.reduce((a,b)=>a+b,0)/r.auto.length : 0; return r; }

// ---- 選択表示：帯の強調 + データフロー（各工程 → Edge DC）----
const FLOW_LINES = new THREE.Group(); FLOW_LINES.name = "flowLines";
function setActiveLane(id){ activeLane = id; activeModule = null; refreshLaneVis(); }
function setActiveModule(mod){ activeModule = mod; activeLane = null; refreshLaneVis(); }
function refreshLaneVis(){
  FLOW_LINES.clear(); const dc = EQUIP.find(e=>e.id==="SV-01"); const dcP = dc ? new THREE.Vector3(dc.x, BLD.lv[1]+1.5, dc.z) : new THREE.Vector3(29, 6.5, 10);
  for (const id in LANE_OBJ){ const o = LANE_OBJ[id]; const R = LANE_RECIPES[o.lane.recipe]; const on = activeLane ? id===activeLane : activeModule ? R.os.includes(activeModule) : false;
    const op = (activeLane||activeModule) ? (on? 0.9 : 0.15) : 0.55; o.strips.forEach(m=>{ m.material.opacity = op; }); o.overlay.traverse(c=>{ if (c.userData.isFlow) c.material.uniforms.op.value = on? 1 : 0.35; });
    if (on){ o.stationPos.forEach((p, i)=>{ const y = BLD.lv[p.floor-1]+1.0; const pts = [new THREE.Vector3(p.x, y, p.z), new THREE.Vector3(p.x, y+3+(i%3), p.z), new THREE.Vector3(dcP.x, dcP.y+6, dcP.z), dcP];
        flowLine(FLOW_LINES, new THREE.CatmullRomCurve3(pts).getPoints(40), R.color, 0.6, 0.9, 0.85); }); } }
}
ANIM.push({ update(t){ FLOW_UNI.t.value = t; } });

// ================= 工場全体ライン：需要（台/月）→ 必要供給量 → 稼働率・全体ボトルネック =================
const LANE_LINK_LINES = new THREE.Group(); LANE_LINK_LINES.name = "laneLinks";
function monthlyOut(o){ const R = LANE_RECIPES[o.lane.recipe]; const k = o.kpi; return R.mode==="flow" ? k.out*WORK_DAYS : R.mode==="project" ? k.out : k.out*WORK_WEEKS; }
function computePlant(entries){
  const lanes = entries || Object.values(LANE_OBJ).map(o=>({ lane:o.lane, kpi:o.kpi })); const asm = lanes.filter(o => LANE_RECIPES[o.lane.recipe].consumes);
  const asmCap = asm.reduce((a,o)=>a+o.kpi.out, 0);                       // 台/月
  const items = {}; for (const key in BOM) items[key] = { ...BOM[key], key, cap:0, lanes:[] };
  for (const o of lanes){ const R = LANE_RECIPES[o.lane.recipe]; if (!R.supplies || !items[R.supplies]) continue; const m = monthlyOut(o); items[R.supplies].cap += m; items[R.supplies].lanes.push({ id:o.lane.id, out:m, color:R.color }); }
  const target = DEMAND.target; const rows = Object.values(items).map(it => { const need = target*it.perUnit; const util = it.cap>0 ? need/it.cap : Infinity; const support = it.cap/it.perUnit; return { ...it, need, util, support }; });
  const asmUtil = asmCap>0 ? target/asmCap : Infinity;
  // 社内供給レーンが無い品目は外注前提として能力制約から外す（画面では「供給レーンなし」と表示）
  const limits = [{ n:"大型機 組立", support:asmCap, util:asmUtil, lanes: asm.map(o=>({ id:o.lane.id, color:LANE_RECIPES[o.lane.recipe].color })) }, ...rows.filter(r=>r.cap>0).map(r=>({ n:r.n, support:r.support, util:r.util, lanes:r.lanes, key:r.key }))];
  const plantCap = Math.min(...limits.map(l=>l.support)); const bott = limits.reduce((a,b)=> b.support < a.support ? b : a, limits[0]);
  const outsourced = rows.filter(r=>r.cap<=0).map(r=>r.key);
  return { target, asmCap, asmUtil, rows, plantCap, bott, limits, outsourced };
}
// 3D：供給レーン → 組立レーンの物量リンク（床上の流線、太さ・色＝稼働率）
function refreshLinkLines(){
  LANE_LINK_LINES.clear(); const P = computePlant(); const asm = Object.values(LANE_OBJ).find(o => LANE_RECIPES[o.lane.recipe].consumes); if (!asm) return P;
  const dst = asm.stationPos[0]; const dstF = asm.lane.floor;
  for (const r of P.rows){ for (const ln of r.lanes){ const o = LANE_OBJ[ln.id]; if (!o) continue; const src = o.stationPos[o.stationPos.length-1]; const util = r.util; const col = util > 1 ? 0xff4d4d : util > 0.85 ? 0xf2c744 : 0x3fb950;
      const ya = BLD.lv[src.floor-1]+0.5, yb = BLD.lv[dstF-1]+0.5; const mid = new THREE.Vector3((src.x+dst.x)/2, Math.max(ya,yb)+ (src.floor!==dstF? 6 : 2.5), (src.z+dst.z)/2);
      const pts = new THREE.CatmullRomCurve3([new THREE.Vector3(src.x, ya, src.z), mid, new THREE.Vector3(dst.x, yb, dst.z)]).getPoints(48);
      const l = flowLine(LANE_LINK_LINES, pts, col, 1.2, 0.8, 0.95); l.userData.link = r.key;
      const lb = makeLabel(`${r.key}  ${r.need.toFixed(0)} / ${r.cap.toFixed(0)} ${r.unit}/月  ${isFinite(util)? (util*100).toFixed(0)+"%" : "供給なし"}`, { scale:0.6, bg: util>1? "rgba(120,20,20,0.85)" : "rgba(13,17,23,0.8)", accent:"#"+ln.color.toString(16).padStart(6,"0") }); lb.position.copy(mid); lb.position.y += 0.8; lb.userData.kind = "link"; LANE_LINK_LINES.add(lb); } }
  return P;
}

// ================= 3D を作らずにレーン定義を評価（what-if 用） =================
function evalLane(laneDef){ const { sts } = expandStations(laneDef); const lay = layoutLane(laneDef, sts); const kpi = computeLaneKPI(laneDef, sts);
  const fp = sts.filter(x=>x.kind!=="ref").reduce((a,x)=>a+x.fp[0]*x.fp[1]*x.n, 0); const capex = sts.filter(x=>x.kind!=="ref").reduce((a,x)=>a+(x.capex||0)*x.n, 0);
  return { lane:laneDef, kpi, sts, footprint: fp*1.6, capex, overflow: lay.overflow }; }
function cloneLane(L, patch){ return Object.assign(JSON.parse(JSON.stringify(L)), patch||{}); }
// ---- 社内化 vs 外注 ----
function compareInhouse(key, slot, target){ const k0 = key.replace(/^_/, ""); const it = BOM[k0], ih = INHOUSE[k0]; if (!it || !ih || !slot) return null; target = target ?? DEMAND.target; const need = target*it.perUnit; const os = it.outsource;
  // 必要量をぎりぎり満たすシフト構成を選ぶ（1直 → 1直＋無人4h → 2直＋無人6h → 3直＋無人8h）
  const cfgs = [[1,0],[1,4],[2,6],[3,8]]; let ev, capM, cfg;
  for (const [sh, un] of cfgs){ cfg = [sh, un]; const L = { id:"試算", recipe:ih.recipe, zone:slot.zone, floor:slot.floor, area:slot.area.slice(), shifts:{ hours:8, shifts:sh, unattended:un, days:5 }, oee:{ avail:0.85, perf:0.92, qual:0.98 } }; ev = evalLane(L); capM = monthlyOut(ev); if (capM >= need) break; }
  const util = capM>0 ? need/capM : Infinity;
  const outsourceYear = need*12*os.unitCost/100;                                          // 百万円/年
  const laborFull = ev.kpi.ppl*COST.laborPerPerson, laborYear = laborFull*Math.min(1, Math.max(util, 0.25)); // 要員は稼働率に応じて他レーンと共有（下限 25%）
  const areaYear = ev.footprint*COST.areaRentPerM2, maintYear = ev.capex*0.05;
  const inhouseYear = laborYear + areaYear + maintYear; const saving = outsourceYear - inhouseYear; const payback = saving>0 ? ev.capex/saving : Infinity;
  const leadIn = ev.kpi.unit==="min" ? Math.max(1, Math.ceil(ev.kpi.lead/60/8)) : Math.ceil(ev.kpi.lead/8);
  // 損益分岐となる需要（台/月）：回収 7 年以内になる最小の目標
  let breakeven = null; if (target !== undefined && !key.startsWith("_")){ for (let t=0.5; t<=12; t+=0.5){ const c = compareInhouse("_"+key, slot, t); if (c && isFinite(c.payback) && c.payback <= 7){ breakeven = t; break; } } }
  return { key:key.replace(/^_/, ""), it, os, need, L:ev.lane, ev, capM, cfg, util, outsourceYear, laborYear, laborFull, areaYear, maintYear, inhouseYear, saving, payback, leadIn, slot, breakeven }; }
// ---- 組立シナリオ ----
function assemblyScenarios(){ const asmO = Object.values(LANE_OBJ).find(o => LANE_RECIPES[o.lane.recipe].consumes); if (!asmO) return [];
  const base = asmO.lane; const others = Object.values(LANE_OBJ).filter(o => o !== asmO && o.lane.recipe !== "testing").map(o=>({ lane:o.lane, kpi:o.kpi }));
  const tslot = LANE_SLOTS.find(s=>s.id==="tcell"); const testLane = { id:"LT", recipe:"testing", zone:tslot.zone, floor:tslot.floor, area:tslot.area.slice(), shifts:{ hours:8, shifts:2, unattended:8, days:21 }, oee:{ avail:0.9, perf:0.95, qual:1 } };
  const mk = (n, patch, withTest) => { const L = cloneLane(base, patch); const ev = evalLane(L); const entries = [...others, { lane:L, kpi:ev.kpi }]; let tev = null; if (withTest){ tev = evalLane(testLane); entries.push({ lane:testLane, kpi:tev.kpi }); }
    const P = computePlant(entries); return { n, L, ev, tev, P, capex: ev.capex - asmO.kpi.capex0 + (tev? tev.capex : 0), ppl: ev.kpi.ppl + (tev? tev.kpi.ppl : 0) }; };
  const cur = evalLane(base); asmO.kpi.capex0 = cur.capex;
  const so = base.stationOv || {}; const nMech = so.asmMech?.n ?? base.override?.asmMech ?? 1; const nWire = so.asmWire?.n ?? 1;
  const ov = (m, w) => ({ stationOv: Object.assign(cloneLane(so), { asmMech: Object.assign({}, so.asmMech, { n:m }), asmWire: Object.assign({}, so.asmWire, { n:w }) }), override: Object.assign({}, base.override, { asmMech:m }) });
  return [ mk("現状", {}, false), mk(`配線・ソフト結合ベイ 2 並列（×${nWire+1}）`, ov(nMech, nWire+1), false), mk(`機械組立ベイ +1（×${nMech+1}）`, ov(nMech+1, nWire), false), mk("試験を試験レーンへ外出し（試験セル ×2）", Object.assign({ offload:["test"] }), true), mk("配線 2 並列 ＋ 試験外出し", Object.assign(ov(nMech, nWire+1), { offload:["test"] }), true) ];
}
