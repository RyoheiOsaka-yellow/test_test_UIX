// ================= BIM：MEP 系統（配管・ダクト・ケーブルラック・消火・床トレンチ）・属性・干渉チェック =================
// 系統定義。kind: pipe(円管) duct(角ダクト) tray(ケーブルラック) trench(床トレンチ)
const SYSTEMS = {
  SA: { n:"給気ダクト",            kind:"duct",  color:0x9fd3ff, size:[0.9,0.6], y:13.6, src:"屋上 AHU（北側）",           unit:"m" },
  EA: { n:"排気・集塵ダクト",      kind:"duct",  color:0xb8c0c8, size:[0.7,0.5], y:13.3, src:"集塵機（北壁 x=-20）→ 排気筒", unit:"m" },
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
  laser:["CA","EL","IT","EA"], punch:["CA","EL","IT"], brake:["EL","IT"], weld:["CA","EL","IT","EA"], finish:["CA","EA"], mask:["CW"], booth:["CA","EL","EA"], oven:["EL","EA"], demo:["EL","IT"], crane:["EL"], agv:[] };

// 設備種別ごとの設計負荷：EL kVA / CA L/min(ANR) / CW L/min / EA m³/h / IT ポート
const LOADS = { mc5:{EL:30,CA:300,CW:60,EA:900,IT:2}, hmc:{EL:35,CA:350,CW:80,EA:900,IT:2}, lathe:{EL:25,CA:200,CW:50,EA:600,IT:1}, gantry:{EL:80,CA:400,CW:120,EA:1500,IT:2}, edm:{EL:15,CW:30,IT:1}, grind:{EL:10,CW:40,EA:800,IT:1}, robotcell:{EL:6,CA:150,IT:2}, wash:{EL:12,CW:80}, store:{EL:2,IT:1}, load:{IT:1},
  asmA:{EL:20,CA:400,IT:4}, asmB:{EL:15,CA:300,IT:4}, bench:{EL:3,CA:100}, testcell:{EL:200,IT:4,EA:2000}, tcell:{EL:200,IT:4,EA:2000}, cmm:{EL:5,IT:1}, elab:{EL:20,IT:4}, panel:{EL:3,IT:1}, wiring:{EL:4,CA:120}, ptest:{EL:8,IT:1}, hil:{EL:30,IT:8}, server:{EL:150,IT:48,CH:60}, toolroom:{EL:5,CA:100},
  laser:{EL:60,CA:600,IT:1,EA:3000}, punch:{EL:35,CA:300,IT:1}, brake:{EL:25,IT:1}, weld:{EL:45,CA:150,IT:1,EA:2500}, finish:{CA:200,EA:2000}, mask:{CW:40}, booth:{EL:40,CA:800,EA:12000}, oven:{EL:30,EA:1500}, demo:{EL:15,IT:2}, crane:{EL:40} };
const LOAD_UNIT = { EL:"kVA", CA:"L/min", CW:"L/min", EA:"m³/h", IT:"port", CH:"kW", SA:"m³/h", FP:"—" };
// 負荷 → サイズ（簡易）: 配管は流量から呼び径、ダクトは風速 12 m/s の角ダクト、ラックは電流から幅
function sizeFor(sys, load){ const S = SYSTEMS[sys];
  if (sys === "CA"){ const dn = load <= 300 ? 25 : load <= 800 ? 32 : load <= 1500 ? 40 : load <= 3000 ? 50 : load <= 6000 ? 65 : 80; return { r: dn/2000, label:`φ${dn}` }; }
  if (sys === "CW"){ const dn = load <= 60 ? 25 : load <= 150 ? 32 : load <= 300 ? 40 : load <= 600 ? 50 : 65; return { r: dn/2000, label:`φ${dn}` }; }
  if (sys === "EA" || sys === "SA"){ const a = Math.max(0.04, load/3600/12); const side = Math.ceil(Math.sqrt(a)*20)/20; return { w: Math.max(0.3, side*1.3), h: Math.max(0.25, side*0.8), label:`${Math.round(Math.max(0.3, side*1.3)*1000)}×${Math.round(Math.max(0.25, side*0.8)*1000)}` }; }
  if (sys === "EL"){ const A = load*1000/(1.732*400); const w = A <= 100 ? 0.3 : A <= 300 ? 0.4 : A <= 600 ? 0.6 : A <= 1000 ? 0.8 : 1.0; return { w, h:0.1, label:`W${Math.round(w*1000)} · ${Math.round(A)} A` }; }
  if (sys === "IT"){ return { w: load <= 8 ? 0.15 : load <= 32 ? 0.3 : 0.4, h:0.08, label:`${load} port` }; }
  return { r:S.size[0], label:"" }; }
const MEP = { groups:{}, segs:[], mats:{}, offsets:{ y:{} }, visible:{}, loads:{} };
function mepMat(sys){ if (!MEP.mats[sys]) { const S = SYSTEMS[sys]; MEP.mats[sys] = new THREE.MeshStandardMaterial({ color:S.color, roughness: S.kind==="tray"? 0.5 : 0.35, metalness: S.kind==="tray"? 0.6 : 0.5 }); } return MEP.mats[sys]; }
function sysGroup(sys, floorG){ const key = sys + "@" + floorG.name; if (!MEP.groups[key]){ const g = new THREE.Group(); g.name = "mep_" + sys; g.userData.layer = "mep"; g.userData.sys = sys; floorG.add(g); MEP.groups[key] = g; } return MEP.groups[key]; }

// ---- 経路 → 形状 ----
// pts: [[x,y,z],...] の折れ線。系統の kind で円管／角ダクト／ラック／トレンチを生成し、継手（エルボ・スリーブ）を置く。
function routeMesh(sys, pts, meta, floorG){
  const S0 = SYSTEMS[sys]; const sz = meta.size || {}; const S = { ...S0, size: S0.kind === "pipe" ? [sz.r ?? S0.size[0]] : [sz.w ?? S0.size[0], sz.h ?? S0.size[1]] }; if (sz.label) meta.sizeLabel = sz.label; const m = mepMat(sys); const g = new THREE.Group(); g.userData.mep = { sys, ...meta }; let len = 0;
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
  // ---- 負荷集計：設備ごとの設計負荷を北幹線／南幹線／ストリップ別に合計し、幹線サイズを算定 ----
  const L = { N:{}, S:{}, total:{}, bySys:{} }; for (const k in SYSTEMS){ L.N[k] = 0; L.S[k] = 0; L.total[k] = 0; }
  for (const e of EQUIP){ const ld = LOADS[e.kind]; if (!ld) continue; const zone = ZONES.find(z=>z[0]===e.zone); const f = zone? zone[2] : 1; const side = (f === 1 && e.zone !== "north" && e.z < -14) ? "N" : "S";
    for (const k in ld){ if (!(k in L.total)) continue; L.total[k] += ld[k]; if (f === 1 && e.zone !== "north") L[side][k] += ld[k]; } }
  MEP.loads = L; const trunk = (sys, side) => sizeFor(sys, side === "N" ? L.N[sys] : side === "S" ? L.S[sys] : L.N[sys] + L.S[sys]);
  const eqSize = (sys, e) => sizeFor(sys, (LOADS[e.kind]||{})[sys] || 0);
  const diversity = 0.7;   // 需要率
  // 幹線：給気ダクトは北幹線（トラス内 14.0）、排気は南幹線（13.4）、消火は両幹線（13.1）、圧空・クーラント・電源・LAN は壁際の低い位置（7〜8.5）
  routeMesh("SA", [[22, 18.5, -40], [22, Y("SA"), -40], [22, Y("SA"), zN], [x0+4, Y("SA"), zN]], { name:"給気 主ダクト 北", from:"屋上 AHU", floor:1, size: sizeFor("SA", 18000), load:"18,000 m³/h" }, g1);
  routeMesh("SA", [[22, Y("SA"), zN], [x1-4, Y("SA"), zN]], { name:"給気 主ダクト 北（東）", from:"屋上 AHU", floor:1, size: sizeFor("SA", 9000), load:"9,000 m³/h" }, g1);
  for (let x = x0+6; x < x1-4; x += 8) addFitting("SA", [x, Y("SA")-0.55, zN], "diffuser", g1, { name:"吹出口 φ350" });
  for (const z of [-12]) { routeMesh("SA", [[-28, Y("SA"), zN], [-28, Y("SA"), z], [x1-8, Y("SA"), z]], { name:"給気 枝ダクト 中央", from:"主ダクト", floor:1, size: sizeFor("SA", 6000), load:"6,000 m³/h" }, g1); for (let x=-24; x<x1-8; x+=8) addFitting("SA", [x, Y("SA")-0.55, z], "diffuser", g1, { name:"吹出口 φ350" }); }
  routeMesh("EA", [[-18, 13.0, z0-0.4], [-18, Y("EA"), z0-0.4], [-18, Y("EA"), zS], [x0+4, Y("EA"), zS]], { name:"集塵 主ダクト", from:"集塵機", to:"排気筒 x=-20", floor:1, size: trunk("EA","all"), load:`${Math.round(L.N.EA+L.S.EA).toLocaleString()} m³/h` }, g1);
  routeMesh("EA", [[-18, Y("EA"), zS], [x1-10, Y("EA"), zS]], { name:"集塵 主ダクト（東）", from:"集塵機", floor:1, size: trunk("EA","S"), load:`${Math.round(L.S.EA).toLocaleString()} m³/h` }, g1);
  for (const z of [zN-0.9, zS+0.9]){ const zr = z<-10 ? z0+0.95 : zh-0.95; routeMesh("FP", [[x1-2.2, 0.5, zr], [x1-2.2, Y("FP"), zr], [x1-2.2, Y("FP"), z], [x0+2, Y("FP"), z]], { name:"消火 主管 " + (z<-10?"北":"南"), from:"消火ポンプ", floor:1 }, g1); addFitting("FP", [x1-2.2, 1.2, zr], "valve", g1, { name:"制御弁" }); }
  for (let x = x0+4; x < x1; x += 8){ routeMesh("FP", [[x, Y("FP"), zN-0.9], [x, Y("FP"), zS+0.9]], { name:`消火 枝管 x=${x}`, from:"主管", floor:1 }, g1); for (let z = zN+2; z < zS; z += 3) addFitting("FP", [x, Y("FP")-0.08, z], "sprinkler", g1, { name:"SP ヘッド" }); }
  routeMesh("CA", [[-47, 1.2, -36], [-47, Y("CA"), -36], [-47, Y("CA"), zN], [x0+1.2, Y("CA"), zN], [x1-1.2, Y("CA"), zN]], { name:"圧空 主管 北", from:"コンプレッサ室", floor:1, size: sizeFor("CA", (L.N.CA+L.S.CA)*diversity), load:`${Math.round((L.N.CA+L.S.CA)*diversity).toLocaleString()} L/min（需要率 ${diversity}）` }, g1);
  routeMesh("CA", [[x0+1.2, Y("CA"), zN], [x0+1.2, Y("CA"), zS], [x1-1.2, Y("CA"), zS]], { name:"圧空 主管 南", from:"主管 北", floor:1, size: sizeFor("CA", L.S.CA*diversity), load:`${Math.round(L.S.CA*diversity).toLocaleString()} L/min` }, g1);
  routeMesh("CW", [[x0-1, 0.8, -31.4], [x0+1.4, 0.8, -31.4], [x0+1.4, Y("CW"), -31.4], [x0+1.4, Y("CW"), zS], [x1-1.4, Y("CW"), zS]], { name:"クーラント 往管", from:"集中タンク", floor:1, size: sizeFor("CW", L.N.CW+L.S.CW), load:`${Math.round(L.N.CW+L.S.CW)} L/min` }, g1);
  routeMesh("CW", [[x0+1.4, Y("CW"), -31.4], [x0+1.4, Y("CW"), zN], [x1-1.4, Y("CW"), zN]], { name:"クーラント 往管 北", from:"集中タンク", floor:1, size: sizeFor("CW", L.N.CW), load:`${Math.round(L.N.CW)} L/min` }, g1);
  routeMesh("EL", [[-52, 1.0, -31.2], [-52, Y("EL"), -31.2], [x0+1.6, Y("EL"), -31.2], [x0+1.6, Y("EL"), zN], [x1-1.6, Y("EL"), zN]], { name:"電源幹線 北", from:"キュービクル", floor:1, size: sizeFor("EL", (L.N.EL+L.S.EL)*diversity), load:`${Math.round((L.N.EL+L.S.EL)*diversity)} kVA（需要率 ${diversity}）` }, g1);
  routeMesh("EL", [[x0+1.6, Y("EL"), zN], [x0+1.6, Y("EL"), zS], [x1-1.6, Y("EL"), zS]], { name:"電源幹線 南", from:"幹線 北", floor:1, size: sizeFor("EL", L.S.EL*diversity), load:`${Math.round(L.S.EL*diversity)} kVA` }, g1);
  routeMesh("EL", [[x1-1.6, Y("EL"), zS], [x1-1.6, lv[1]-1.0, zS], [x1-1.6, lv[1]-1.0, 10], [29, lv[1]-1.0, 10]], { name:"電源 立上り → 2F サーバー室", from:"幹線 南", to:"SV-01", floor:1 }, g1);
  routeMesh("IT", [[29, lv[1]+0.3, 10], [29, lv[1]-0.95, 10], [x1-2.0, lv[1]-0.95, 10], [x1-2.0, lv[1]-0.95, zS], [x1-2.0, Y("IT"), zS], [x0+2.0, Y("IT"), zS]], { name:"光ファイバー幹線 南", from:"サーバー室", to:"SV-01", floor:1, size: sizeFor("IT", L.N.IT+L.S.IT), load:`${L.N.IT+L.S.IT} port` }, g1);
  routeMesh("IT", [[x0+2.0, Y("IT"), zS], [x0+2.0, Y("IT"), zN], [x1-2.0, Y("IT"), zN]], { name:"光ファイバー幹線 北", from:"幹線 南", floor:1, size: sizeFor("IT", L.N.IT), load:`${L.N.IT} port` }, g1);
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
        routeMesh("EA", [[xd, y, zt], [xd, y, zd], [xd, yh, zd], [xd, yh, zh2], [e.x + 1.0, yh, zh2], [e.x + 1.0, 3.3, zh2]], { name:`集塵 枝 ${e.id}`, to:e.id, floor:1, size: eqSize("EA", e), load:`${(LOADS[e.kind]||{}).EA||0} m³/h` }, g1); addFitting("EA", [e.x + 1.0, 3.05, zh2], "hood", g1, { name:"吸込フード", to:e.id }); return; }
      const idx = ["CA","CW","EL","IT"].indexOf(sys);
      if (far){ const dx = avoidCol(dxFar) + idx*0.18; routeMesh(sys, [[dx, y, zt], [dx, 0.08, zt]], { name:`${S.n} 立下り ${e.id}`, to:e.id, floor:1, size: eqSize(sys, e), load:`${(LOADS[e.kind]||{})[sys]||0} ${LOAD_UNIT[sys]}` }, g1); routeMesh(sys, [[dx, 0.06, zt], [dx, 0.06, e.z], [e.x, 0.06, e.z]], { name:`${S.n} 床トレンチ ${e.id}`, to:e.id, floor:1, trench:true, load:`${(LOADS[e.kind]||{})[sys]||0} ${LOAD_UNIT[sys]}` }, g1); }
      else if (e.z > zh){ const dx = avoidCol(dxNear) + idx*0.14; const zEnd = bb ? bb.max.z - 0.6 : e.z; const yc = lv[1] - 1.0 - idx*0.12;   // 南側ストリップ：1F 天井内を通す
        routeMesh(sys, [[dx, y, zt], [dx, yc, zt], [dx, yc, zEnd], [dx, 1.6, zEnd]], { name:`${S.n} 枝 ${e.id}`, to:e.id, floor:1, size: eqSize(sys, e), load:`${(LOADS[e.kind]||{})[sys]||0} ${LOAD_UNIT[sys]}` }, g1); if (sys === "EL") addFitting("EL", [dx, 1.4, zEnd], "outlet", g1, { name:"動力盤 " + e.id, to:e.id }); }
      else { const cl = (typeof CLEARANCE !== "undefined" && CLEARANCE[e.kind]) ? CLEARANCE[e.kind][1] : 0.6; const gapOK = bb && (dxNear - bb.max.x) > cl + 0.3 + idx*0.14;
        if (gapOK || !bb){ const dx = avoidCol(dxNear) + idx*0.14; const zEnd = bb ? (north ? bb.min.z + 0.8 : bb.max.z - 0.8) : e.z; routeMesh(sys, [[dx, y, zt], [dx, y, zEnd], [dx, 1.6, zEnd]], { name:`${S.n} 枝 ${e.id}`, to:e.id, floor:1, size: eqSize(sys, e), load:`${(LOADS[e.kind]||{})[sys]||0} ${LOAD_UNIT[sys]}` }, g1); if (sys === "EL") addFitting("EL", [dx, 1.4, zEnd], "outlet", g1, { name:"動力盤 " + e.id, to:e.id }); }
        else { // 隙間が足りない：壁側で立下り、床トレンチで設備背面へ
          const dx = avoidCol(bb.min.x + 0.6 + idx*0.18); const zb = north ? bb.min.z - 0.3 : bb.max.z + 0.3;
          routeMesh(sys, [[dx, y, zt], [dx, 0.08, zt]], { name:`${S.n} 立下り ${e.id}`, to:e.id, floor:1, size: eqSize(sys, e), load:`${(LOADS[e.kind]||{})[sys]||0} ${LOAD_UNIT[sys]}` }, g1);
          routeMesh(sys, [[dx, 0.06, zt], [dx, 0.06, zb], [e.x, 0.06, zb]], { name:`${S.n} 床トレンチ ${e.id}`, to:e.id, floor:1, trench:true, load:`${(LOADS[e.kind]||{})[sys]||0} ${LOAD_UNIT[sys]}` }, g1); } } }); }
  applyMepVisibility();
}
function applyMepVisibility(){ for (const k in MEP.groups){ const g = MEP.groups[k]; const office = g.parent && g.parent.name !== "floor_1"; g.visible = (MEP.visible[g.userData.sys] ?? true) && (layerState?.mep ?? true) && !!(!office || MEP.office || MEP.walk); } }

// ---- 数量表 ----
function mepSchedule(){ const t = {}; for (const k in SYSTEMS) t[k] = { n:SYSTEMS[k].n, len:0, runs:0, fittings:0, load: MEP.loads.total ? MEP.loads.total[k] : 0, unit: LOAD_UNIT[k] }; for (const k in MEP.groups) MEP.groups[k].children.forEach(c => { const m = c.userData.mep; if (!m) return; if (m.length !== undefined){ t[m.sys].len += m.length; t[m.sys].runs++; } else t[m.sys].fittings++; }); return t; }

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

// ---- 保守スペース（設備周りの開放寸法）チェック ----
const CLEARANCE = { mc5:[1.0,0.8], hmc:[1.2,0.8], lathe:[1.0,0.6], gantry:[1.5,1.0], edm:[0.8,0.6], grind:[0.8,0.6], robotcell:[0.6,0.6], wash:[0.8,0.6], store:[1.0,0.3], load:[0.8,0.3],
  punch:[1.5,0.8], asmA:[2.0,1.5], asmB:[2.0,1.5], testcell:[1.0,1.0], tcell:[1.0,1.0], cmm:[1.0,0.8], panel:[1.0,0.5], wiring:[0.8,0.5], ptest:[0.8,0.5], laser:[1.2,1.0], brake:[1.5,0.6], weld:[0.8,0.6], finish:[0.8,0.5], mask:[0.8,0.5], booth:[1.5,1.0], oven:[1.5,0.8], demo:[1.0,1.0], hil:[1.0,0.6], server:[1.2,0.8], rack:[1.2,0.3], dock:[0,0], bigdoor:[0,0], crane:[0,0], agv:[0,0] };
// [前後, 左右] m。箱を拡張した「保守ゾーン」が他設備のコア箱や MEP 立下りと交差すれば違反
function clearanceCheck(){ const boxes = {}; for (const id in EQ_OBJ){ const o = EQ_OBJ[id]; if (!o.group.visible || ["crane","agv","bigdoor","dock"].includes(o.data.kind)) continue; const b = new THREE.Box3(); o.group.updateMatrixWorld(true); o.group.traverse(m => { if (!m.isMesh || m.isSprite) return; let p = m; while (p && p !== o.group){ if (p.userData.extra) return; p = p.parent; } b.union(new THREE.Box3().setFromObject(m)); }); if (!b.isEmpty()) boxes[id] = b; }
  const res = []; const ids = Object.keys(boxes);
  for (const id of ids){ const e = EQ_OBJ[id].data; const c = CLEARANCE[e.kind] || [0.6,0.6]; if (!c[0] && !c[1]) continue; const rot = Math.abs(Math.sin(e.rot||0)) > 0.5; const dx = rot ? c[0] : c[1], dz = rot ? c[1] : c[0];
    const zone = boxes[id].clone(); zone.min.x -= dx; zone.max.x += dx; zone.min.z -= dz; zone.max.z += dz; zone.min.y += 0.3; zone.max.y = zone.min.y + 2.0;
    for (const other of ids){ if (other === id) continue; const ob = boxes[other].clone().expandByScalar(-0.15); if (zone.intersectsBox(ob)){ const c2 = zone.clone().intersect(ob); const sz = c2.getSize(new THREE.Vector3()); if (sz.x < 0.1 || sz.z < 0.1) continue; res.push({ kind:"equipment", id, other, obstacle:`${other} ${EQ_OBJ[other].data.name}`, at:c2.getCenter(new THREE.Vector3()), need:`${c[0]}/${c[1]} m` }); } }
    const zoneFB = zone.clone(); zoneFB.min.x += dx; zoneFB.max.x -= dx;
    for (const sg of MEP.segs){ if (sg.meta.trench || sg.floor !== 1) continue; if (Math.abs(sg.b.y - sg.a.y) < 0.5) continue; if (sg.meta.to === id) continue; const bb = new THREE.Box3().setFromPoints([sg.a, sg.b]).expandByScalar(sg.r); if (zoneFB.intersectsBox(bb)) res.push({ kind:"mep", id, obstacle:`${sg.sys} ${sg.meta.name}`, at:bb.getCenter(new THREE.Vector3()), need:`${c[0]}/${c[1]} m` }); } }
  const seen = new Set(); return res.filter(r => { const k = [r.id, r.other||r.obstacle].sort().join("|"); if (seen.has(k)) return false; seen.add(k); return true; }); }
let clearanceGroup = null;
function showClearanceZones(on){ if (clearanceGroup){ scene.remove(clearanceGroup); clearanceGroup = null; } if (!on) return; clearanceGroup = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color:0xf2c744, transparent:true, opacity:0.12, depthWrite:false, side:THREE.DoubleSide });
  for (const id in EQ_OBJ){ const o = EQ_OBJ[id]; const c = CLEARANCE[o.data.kind]; if (!o.group.visible || !c || (!c[0] && !c[1])) continue; const b = new THREE.Box3(); o.group.traverse(m => { if (!m.isMesh || m.isSprite) return; let p = m; while (p && p !== o.group){ if (p.userData.extra) return; p = p.parent; } b.union(new THREE.Box3().setFromObject(m)); }); if (b.isEmpty()) continue;
    const rot = Math.abs(Math.sin(o.data.rot||0)) > 0.5; const dx = rot ? c[0] : c[1], dz = rot ? c[1] : c[0]; const sz = b.getSize(new THREE.Vector3()); const ctr = b.getCenter(new THREE.Vector3()); const m = new THREE.Mesh(G.box(sz.x + 2*dx, 0.05, sz.z + 2*dz), mat); m.position.set(ctr.x, b.min.y + 0.12, ctr.z); clearanceGroup.add(m); const ed = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color:0xf2c744, transparent:true, opacity:0.6 })); ed.position.copy(m.position); clearanceGroup.add(ed); }
  scene.add(clearanceGroup); }
