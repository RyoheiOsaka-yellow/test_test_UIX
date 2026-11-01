// ================= BIM：MEP 系統（配管・ダクト・ケーブルラック・消火・床トレンチ）・属性・干渉チェック =================
// 系統定義。kind: pipe(円管) duct(角ダクト) tray(ケーブルラック) trench(床トレンチ)
const SYSTEMS = {
  SA: { n:"給気ダクト",            kind:"duct",  color:0x9fd3ff, size:[0.9,0.6], y:14.0, src:"屋上 AHU（北側）",           unit:"m" },
  EA: { n:"排気・集塵ダクト",      kind:"duct",  color:0xb8c0c8, size:[0.7,0.5], y:13.4, src:"集塵機（北壁 x=-20）→ 排気筒", unit:"m" },
  CA: { n:"圧縮空気 0.7 MPa",      kind:"pipe",  color:0x2f6fd0, size:[0.08],    y:7.4,  src:"コンプレッサ室（北西）",     unit:"m" },
  CW: { n:"クーラント・工業用水",  kind:"pipe",  color:0x2ec4b6, size:[0.1],     y:7.1,  src:"クーラント集中タンク（南西）", unit:"m" },
  FP: { n:"消火（スプリンクラー）",kind:"pipe",  color:0xd13b3b, size:[0.1],     y:13.1, src:"消火ポンプ室（東コア）",     unit:"m" },
  EL: { n:"電源幹線 ケーブルラック",kind:"tray", color:0xf2a93b, size:[0.6,0.1], y:7.9,  src:"キュービクル（北西）",       unit:"m" },
  IT: { n:"LAN・制御ネットワーク", kind:"tray",  color:0x3fb950, size:[0.3,0.08],y:8.3,  src:"サーバー室（2F 東）",        unit:"m" },
  CH: { n:"冷温水（空調）",        kind:"pipe",  color:0xbc8cff, size:[0.07],    y:0,    src:"屋上 空調屋外機",            unit:"m" },
};
// 設備種別が必要とする系統
const NEEDS = { mc5:["CA","CW","EL","IT","EA"], hmc:["CA","CW","EL","IT","EA"], lathe:["CA","CW","EL","IT","EA"], gantry:["CA","CW","EL","IT","EA"], edm:["CW","EL","IT"], grind:["CW","EL","IT","EA"], robotcell:["CA","EL","IT"], wash:["CW","EL"], store:["EL","IT"], load:["IT"],
  asmA:["CA","EL","IT"], asmB:["CA","EL","IT"], bench:["CA","EL"], testcell:["EL","IT","EA"], tcell:["EL","IT","EA"], cmm:["EL","IT"], elab:["EL","IT"], panel:["EL","IT"], wiring:["CA","EL"], ptest:["EL","IT"], hil:["EL","IT"], server:["EL","IT","CH"], toolroom:["CA","EL"],
  laser:["CA","EL","IT","EA"], brake:["EL","IT"], weld:["CA","EL","IT","EA"], finish:["CA","EA"], mask:["CW"], booth:["CA","EL","EA"], oven:["EL","EA"], demo:["EL","IT"], crane:["EL"], agv:[] };

const MEP = { groups:{}, segs:[], mats:{}, offsets:{ y:{} }, visible:{} };
function mepMat(sys){ if (!MEP.mats[sys]) { const S = SYSTEMS[sys]; MEP.mats[sys] = new THREE.MeshStandardMaterial({ color:S.color, roughness: S.kind==="tray"? 0.5 : 0.35, metalness: S.kind==="tray"? 0.6 : 0.5 }); } return MEP.mats[sys]; }
function sysGroup(sys, floorG){ const key = sys + "@" + floorG.name; if (!MEP.groups[key]){ const g = new THREE.Group(); g.name = "mep_" + sys; g.userData.layer = "mep"; g.userData.sys = sys; floorG.add(g); MEP.groups[key] = g; } return MEP.groups[key]; }

// ---- 経路 → 形状 ----
// pts: [[x,y,z],...] の折れ線。系統の kind で円管／角ダクト／ラック／トレンチを生成し、継手（エルボ・スリーブ）を置く。
function routeMesh(sys, pts, meta, floorG){
  const S = SYSTEMS[sys]; const m = mepMat(sys); const g = new THREE.Group(); g.userData.mep = { sys, ...meta }; let len = 0;
  const v = pts.map(p => new THREE.Vector3(...p));
  for (let i=0;i<v.length-1;i++){ const a = v[i], b = v[i+1]; const d = b.clone().sub(a); const L = d.length(); if (L < 0.01) continue; len += L; const mid = a.clone().add(b).multiplyScalar(0.5);
    let mesh; const kind = meta.trench ? "trench" : S.kind;
    if (kind === "pipe"){ mesh = new THREE.Mesh(G.cyl(S.size[0], L, 10), m); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.clone().normalize()); }
    else if (kind === "duct"){ const horiz = Math.abs(d.y) < 0.01; mesh = new THREE.Mesh(G.box(horiz && Math.abs(d.x) > Math.abs(d.z) ? L : S.size[0], horiz ? S.size[1] : L, horiz && Math.abs(d.z) >= Math.abs(d.x) ? L : S.size[0]), m); if (horiz && Math.abs(d.x) <= Math.abs(d.z)) mesh.geometry = G.box(S.size[0], S.size[1], L); }
    else if (kind === "tray"){ const horiz = Math.abs(d.y) < 0.01; const alongX = Math.abs(d.x) > Math.abs(d.z); mesh = new THREE.Mesh(horiz ? G.box(alongX ? L : S.size[0], S.size[1], alongX ? S.size[0] : L) : G.box(S.size[0], L, S.size[1]), m); }
    else { const alongX = Math.abs(d.x) > Math.abs(d.z); mesh = new THREE.Mesh(G.box(alongX ? L : 0.3, 0.06, alongX ? 0.3 : L), m); }
    mesh.position.copy(mid); mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.mep = g.userData.mep; g.add(mesh);
    MEP.segs.push({ sys, a:a.clone(), b:b.clone(), r: S.kind==="pipe" ? S.size[0] : S.size[0]/2, h: S.kind==="pipe" ? S.size[0] : (S.size[1]||0.3)/2, obj:mesh, meta:g.userData.mep, floor: meta.floor||1 });
    // 継手
    if (i < v.length-2 && S.kind === "pipe"){ const el = new THREE.Mesh(G.sph(S.size[0]*1.25, 8), m); el.position.copy(b); el.userData.mep = g.userData.mep; g.add(el); }
    if (i < v.length-2 && S.kind === "duct"){ const el = new THREE.Mesh(G.box(S.size[0]+0.06, S.size[1]+0.06, S.size[0]+0.06), m); el.position.copy(b); el.userData.mep = g.userData.mep; g.add(el); }
  }
  g.userData.mep.length = len; sysGroup(sys, floorG).add(g); return g;
}
function addFitting(sys, p, kind, floorG, extra){ const m = mepMat(sys); const g = new THREE.Group(); g.userData.mep = { sys, kind, ...extra }; let mesh;
  if (kind === "diffuser"){ mesh = new THREE.Mesh(G.box(0.6, 0.12, 0.6), M.duct); const neck = new THREE.Mesh(G.cyl(0.18, 0.6, 10), m); neck.position.y = 0.36; g.add(neck); }
  else if (kind === "sprinkler"){ mesh = new THREE.Mesh(G.cyl(0.03, 0.12, 6), M.steel); const head = new THREE.Mesh(G.sph(0.05, 6), std(0xd13b3b)); head.position.y = -0.1; g.add(head); }
  else if (kind === "valve"){ mesh = new THREE.Mesh(G.sph(0.14, 8), M.darkSteel); const hw = new THREE.Mesh(G.cyl(0.14, 0.04, 10), std(0xd13b3b)); hw.position.y = 0.16; g.add(hw); }
  else if (kind === "outlet"){ mesh = new THREE.Mesh(G.box(0.25, 0.35, 0.12), M.machineWhite); }
  else if (kind === "hood"){ mesh = new THREE.Mesh(G.cyl(0.35, 0.5, 12, 0.18), m); }
  else mesh = new THREE.Mesh(G.box(0.2,0.2,0.2), m);
  mesh.userData.mep = g.userData.mep; g.add(mesh); g.position.set(...p); sysGroup(sys, floorG).add(g); return g; }

// ---- 自動ルーティング ----
function buildMEP(){
  for (const k in MEP.groups) MEP.groups[k].parent?.remove(MEP.groups[k]); MEP.groups = {}; MEP.segs = [];
  const { x0, x1, z0, zh, z1, lv } = BLD; const g1 = floorGroup(1), g2 = floorGroup(2), g3 = floorGroup(3); const W = x1 - x0; const Y = sys => SYSTEMS[sys].y + (MEP.offsets.y[sys] || 0);
  const zN = z0 + 2.2, zS = zh - 2.2;   // 北・南の幹線位置（壁際、クレーン走行範囲の外ではないが高さで回避）
  // 幹線：給気ダクトは北幹線（トラス内 14.0）、排気は南幹線（13.4）、消火は両幹線（13.1）、圧空・クーラント・電源・LAN は壁際の低い位置（7〜8.5）
  routeMesh("SA", [[22, 18.5, -40], [22, Y("SA"), -40], [22, Y("SA"), zN], [x0+4, Y("SA"), zN]], { name:"給気 主ダクト 北", from:"屋上 AHU", floor:1 }, g1);
  routeMesh("SA", [[22, Y("SA"), zN], [x1-4, Y("SA"), zN]], { name:"給気 主ダクト 北（東）", from:"屋上 AHU", floor:1 }, g1);
  for (let x = x0+6; x < x1-4; x += 8) addFitting("SA", [x, Y("SA")-0.55, zN], "diffuser", g1, { name:"吹出口 φ350" });
  for (const z of [-12]) { routeMesh("SA", [[-28, Y("SA"), zN], [-28, Y("SA"), z], [x1-8, Y("SA"), z]], { name:"給気 枝ダクト 中央", from:"主ダクト", floor:1 }, g1); for (let x=-24; x<x1-8; x+=8) addFitting("SA", [x, Y("SA")-0.55, z], "diffuser", g1, { name:"吹出口 φ350" }); }
  routeMesh("EA", [[-18, 13.0, z0-0.4], [-18, Y("EA"), z0-0.4], [-18, Y("EA"), zS], [x0+4, Y("EA"), zS]], { name:"集塵 主ダクト", from:"集塵機", to:"排気筒 x=-20", floor:1 }, g1);
  routeMesh("EA", [[-18, Y("EA"), zS], [x1-10, Y("EA"), zS]], { name:"集塵 主ダクト（東）", from:"集塵機", floor:1 }, g1);
  for (const z of [zN, zS]){ const zr = z<-10 ? z0+0.95 : zh-0.95; routeMesh("FP", [[x1-4.5, 0.5, zr], [x1-4.5, Y("FP"), zr], [x1-4.5, Y("FP"), z], [x0+2, Y("FP"), z]], { name:"消火 主管 " + (z<-10?"北":"南"), from:"消火ポンプ", floor:1 }, g1); addFitting("FP", [x1-4.5, 1.2, zr], "valve", g1, { name:"制御弁" }); }
  for (let x = x0+4; x < x1; x += 8){ routeMesh("FP", [[x, Y("FP"), zN], [x, Y("FP"), zS]], { name:`消火 枝管 x=${x}`, from:"主管", floor:1 }, g1); for (let z = zN+2; z < zS; z += 3) addFitting("FP", [x, Y("FP")-0.08, z], "sprinkler", g1, { name:"SP ヘッド" }); }
  routeMesh("CA", [[-47, 1.2, -36], [-47, Y("CA"), -36], [-47, Y("CA"), zN], [x0+1.2, Y("CA"), zN], [x1-1.2, Y("CA"), zN]], { name:"圧空 主管 北", from:"コンプレッサ室", floor:1 }, g1);
  routeMesh("CA", [[x0+1.2, Y("CA"), zN], [x0+1.2, Y("CA"), zS], [x1-1.2, Y("CA"), zS]], { name:"圧空 主管 南", from:"主管 北", floor:1 }, g1);
  routeMesh("CW", [[x0-1, 0.8, -28], [x0+1.4, 0.8, -28], [x0+1.4, Y("CW"), -28], [x0+1.4, Y("CW"), zS], [x1-1.4, Y("CW"), zS]], { name:"クーラント 往管", from:"集中タンク", floor:1 }, g1);
  routeMesh("CW", [[x0+1.4, Y("CW"), -28], [x0+1.4, Y("CW"), zN], [x1-1.4, Y("CW"), zN]], { name:"クーラント 往管 北", from:"集中タンク", floor:1 }, g1);
  routeMesh("EL", [[-52, 1.0, -31.2], [-52, Y("EL"), -31.2], [x0+1.6, Y("EL"), -31.2], [x0+1.6, Y("EL"), zN], [x1-1.6, Y("EL"), zN]], { name:"電源幹線 北（600A）", from:"キュービクル", floor:1 }, g1);
  routeMesh("EL", [[x0+1.6, Y("EL"), zN], [x0+1.6, Y("EL"), zS], [x1-1.6, Y("EL"), zS]], { name:"電源幹線 南", from:"幹線 北", floor:1 }, g1);
  routeMesh("EL", [[x1-1.6, Y("EL"), zS], [x1-1.6, lv[1]-1.0, zS], [x1-1.6, lv[1]-1.0, 10], [29, lv[1]-1.0, 10]], { name:"電源 立上り → 2F サーバー室", from:"幹線 南", to:"SV-01", floor:1 }, g1);
  routeMesh("IT", [[29, lv[1]+0.3, 10], [29, lv[1]-0.95, 10], [x1-2.0, lv[1]-0.95, 10], [x1-2.0, lv[1]-0.95, zS], [x1-2.0, Y("IT"), zS], [x0+2.0, Y("IT"), zS]], { name:"光ファイバー幹線 南", from:"サーバー室", to:"SV-01", floor:1 }, g1);
  routeMesh("IT", [[x0+2.0, Y("IT"), zS], [x0+2.0, Y("IT"), zN], [x1-2.0, Y("IT"), zN]], { name:"光ファイバー幹線 北", from:"幹線 南", floor:1 }, g1);
  // 2F/3F：冷温水（天井内）とスプリンクラー、LAN
  for (const [g, y, f] of [[g2, lv[1], 2], [g3, lv[2], 3]]){ const yc = (f===2? lv[2] : 13.5) - 0.95; routeMesh("CH", [[26, 18.2, -3.6], [26, yc, -3.6], [26, yc, 10], [x0+2, yc, 10]], { name:`冷温水 ${f}F 幹線`, from:"屋上 空調機", floor:f }, g);
    for (let x = x0+5; x < x1-5; x += 10) addFitting("CH", [x, yc-0.3, 10], "outlet", g, { name:"ファンコイル" });
    routeMesh("FP", [[x1-4.5, y, 12.5], [x1-4.5, yc+0.2, 12.5], [x0+2, yc+0.2, 12.5]], { name:`消火 ${f}F 枝管`, from:"主管", floor:f }, g); for (let x=x0+4; x<x1; x+=4) addFitting("FP", [x, yc+0.12, 12.5], "sprinkler", g, { name:"SP ヘッド" });
    routeMesh("IT", [[29, y+0.3, 10], [29, yc-0.1, 10], [x0+2, yc-0.1, 6]], { name:`LAN ${f}F 幹線`, from:"サーバー室", to:"SV-01", floor:f }, g); }
  // 設備への枝（壁際の幹線 → 立下り → 床トレンチ or 直接）。立下り位置は設備の箱を避けて決める
  const boxCore = grp => { const bb = new THREE.Box3(); grp.updateMatrixWorld(true); grp.traverse(o => { if (!o.isMesh || o.isSprite) return; let p = o; while (p && p !== grp){ if (p.userData.extra) return; p = p.parent; } if (o.userData.extra) return; const b = new THREE.Box3().setFromObject(o); bb.union(b); }); return bb; };
  const EQBOX = {}; for (const id in EQ_OBJ){ const o = EQ_OBJ[id]; if (!o.group.visible) continue; const bb = boxCore(o.group); if (!bb.isEmpty()) EQBOX[id] = bb; }
  const colX = x => { const k = Math.round((x - x0) / BLD.grid); return x0 + k*BLD.grid; }; const avoidCol = x => Math.abs(x - colX(x)) < 0.7 ? colX(x) + 0.8 : x;
  const slotFree = (x, zWall) => { for (const id in EQBOX){ const bb = EQBOX[id]; if (bb.min.x - 0.5 < x && bb.max.x + 0.5 > x && Math.min(Math.abs(bb.min.z - zWall), Math.abs(bb.max.z - zWall)) < 7) return false; } return true; };
  const riserSlot = (x, zWall) => { let best = null; for (let k=0; k<=BLD.w/4; k++){ const xs = x0 + 2 + k*4; if (!slotFree(xs, zWall)) continue; if (best === null || Math.abs(xs - x) < Math.abs(best - x)) best = xs; } return best ?? x; };
  const midSpan = x => { const k = Math.round((x - x0) / BLD.grid - 0.5); return x0 + BLD.grid * (k + 0.5); };
  for (const e of EQUIP){ const needs = NEEDS[e.kind]; if (!needs || !needs.length) continue; const zone = ZONES.find(z=>z[0]===e.zone); const f = zone? zone[2] : 1; if (f !== 1 || e.zone === "north") continue;
    const north = e.z < -14; const zt = north ? zN : zS; const bb = EQBOX[e.id]; const far = Math.abs(e.z - zt) > 5.5;
    // 隣接設備との隙間の中心に立下りを置く（箱の右端から次の設備の左端まで）
    let dxNear = bb ? bb.max.x + 0.35 : e.x + 1.4; if (bb){ let nextMin = Infinity; for (const id in EQBOX){ if (id === e.id) continue; const o = EQBOX[id]; if (o.min.x > bb.max.x - 0.2 && o.max.z > bb.min.z && o.min.z < bb.max.z && o.min.x < nextMin) nextMin = o.min.x; } if (isFinite(nextMin)) dxNear = (bb.max.x + nextMin)/2 - 0.22; }
    const dxFar = riserSlot(e.x, north ? z0 : zh);
    needs.forEach((sys, i) => { const S = SYSTEMS[sys]; if (!["CA","CW","EL","IT","EA"].includes(sys)) return; const y = Y(sys);
      if (sys === "EA"){ if (!["mc5","hmc","lathe","grind","laser","weld","finish","booth","oven","tcell","testcell"].includes(e.kind)) return; if (e.z > -14 && e.z < 0) return;
        const xd = midSpan(e.x), zd = north ? z0 + 0.6 : zh - 0.6, zh2 = e.z + (north ? -1.3 : 1.3); const yh = (e.kind === "gantry" || e.kind === "testcell" || e.kind === "tcell") ? 7.0 : 4.3;
        routeMesh("EA", [[xd, y, zt], [xd, y, zd], [xd, yh, zd], [xd, yh, zh2], [e.x + 1.0, yh, zh2], [e.x + 1.0, 3.3, zh2]], { name:`集塵 枝 ${e.id}`, to:e.id, floor:1 }, g1); addFitting("EA", [e.x + 1.0, 3.05, zh2], "hood", g1, { name:"吸込フード", to:e.id }); return; }
      const idx = ["CA","CW","EL","IT"].indexOf(sys);
      if (far){ const dx = avoidCol(dxFar) + idx*0.18; routeMesh(sys, [[dx, y, zt], [dx, 0.08, zt]], { name:`${S.n} 立下り ${e.id}`, to:e.id, floor:1 }, g1); routeMesh(sys, [[dx, 0.06, zt], [dx, 0.06, e.z], [e.x, 0.06, e.z]], { name:`${S.n} 床トレンチ ${e.id}`, to:e.id, floor:1, trench:true }, g1); }
      else if (e.z > zh){ const dx = avoidCol(dxNear) + idx*0.14; const zEnd = bb ? bb.max.z - 0.6 : e.z; const yc = lv[1] - 1.0 - idx*0.12;   // 南側ストリップ：1F 天井内を通す
        routeMesh(sys, [[dx, y, zt], [dx, yc, zt], [dx, yc, zEnd], [dx, 1.6, zEnd]], { name:`${S.n} 枝 ${e.id}`, to:e.id, floor:1 }, g1); if (sys === "EL") addFitting("EL", [dx, 1.4, zEnd], "outlet", g1, { name:"動力盤 " + e.id, to:e.id }); }
      else { const dx = avoidCol(dxNear) + idx*0.14; const zEnd = bb ? (north ? bb.min.z + 0.8 : bb.max.z - 0.8) : e.z; routeMesh(sys, [[dx, y, zt], [dx, y, zEnd], [dx, 1.6, zEnd]], { name:`${S.n} 枝 ${e.id}`, to:e.id, floor:1 }, g1); if (sys === "EL") addFitting("EL", [dx, 1.4, zEnd], "outlet", g1, { name:"動力盤 " + e.id, to:e.id }); } }); }
  applyMepVisibility();
}
function applyMepVisibility(){ for (const k in MEP.groups){ const g = MEP.groups[k]; const office = g.parent && g.parent.name !== "floor_1"; g.visible = (MEP.visible[g.userData.sys] ?? true) && (layerState?.mep ?? true) && (!office || MEP.office); } }

// ---- 数量表 ----
function mepSchedule(){ const t = {}; for (const k in SYSTEMS) t[k] = { n:SYSTEMS[k].n, len:0, runs:0, fittings:0 }; for (const k in MEP.groups) MEP.groups[k].children.forEach(c => { const m = c.userData.mep; if (!m) return; if (m.length !== undefined){ t[m.sys].len += m.length; t[m.sys].runs++; } else t[m.sys].fittings++; }); return t; }

// ---- 干渉チェック（MEP セグメント vs 架構・クレーン走行範囲・設備）----
function clashCheck(){
  const { x0, x1, z0, zh, craneRail, grid } = BLD; const obstacles = [];
  for (let x=x0; x<=x1+0.01; x+=grid){ for (const z of [z0+0.6, zh-0.6]) obstacles.push({ n:`柱 x=${x}`, kind:"structure", box:new THREE.Box3(new THREE.Vector3(x-0.35, 0, z-0.35), new THREE.Vector3(x+0.35, 14, z+0.35)) });
    obstacles.push({ n:`トラス下弦 x=${x}`, kind:"structure", box:new THREE.Box3(new THREE.Vector3(x-0.13, 12.67, z0), new THREE.Vector3(x+0.13, 12.93, zh)) }); }
  obstacles.push({ n:"クレーン走行範囲（10t ×2）", kind:"crane", box:new THREE.Box3(new THREE.Vector3(x0, craneRail-0.9, z0+1.35), new THREE.Vector3(x1, craneRail+3.0, zh-1.35)) });
  for (const id in EQ_OBJ){ const o = EQ_OBJ[id]; if (!o.group.visible || o.data.kind==="crane" || o.data.kind==="agv") continue; const b = new THREE.Box3(); o.group.updateMatrixWorld(true); o.group.traverse(m => { if (!m.isMesh || m.isSprite) return; let p = m; while (p && p !== o.group){ if (p.userData.extra) return; p = p.parent; } b.union(new THREE.Box3().setFromObject(m)); }); if (b.isEmpty()) continue; b.expandByScalar(-0.25); b.min.y += 0.2; obstacles.push({ n:`${id} ${o.data.name}`, kind:"equipment", box:b }); }
  const res = []; const seen = new Set();
  for (const s of MEP.segs){ if (s.floor !== 1) continue; const b = new THREE.Box3().setFromPoints([s.a, s.b]).expandByScalar(s.r); b.min.y = Math.min(s.a.y, s.b.y) - s.h; b.max.y = Math.max(s.a.y, s.b.y) + s.h; if (s.meta.trench) continue;
    for (const o of obstacles){ if (!b.intersectsBox(o.box)) continue; if (o.kind === "equipment" && s.meta.to && o.n.startsWith(s.meta.to)) continue; // 自分の設備への接続は除外
      const key = s.meta.name + "|" + o.n; if (seen.has(key)) continue; seen.add(key); const c = b.clone().intersect(o.box); const center = c.getCenter(new THREE.Vector3());
      res.push({ sys:s.sys, seg:s.meta.name, obstacle:o.n, kind:o.kind, at:center, obj:s.obj }); } }
  return res;
}
