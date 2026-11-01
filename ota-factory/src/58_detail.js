// ================= 外観・内観のディテール =================
// ---- テキスト面（バナー・アンドン・サイン用の Canvas テクスチャ） ----
function textCanvas(lines, opts={}){ const w = opts.w || 1024, h = opts.h || 512; const cvs = document.createElement("canvas"); cvs.width = w; cvs.height = h; const c = cvs.getContext("2d");
  c.fillStyle = opts.bg || "#111417"; c.fillRect(0,0,w,h); if (opts.accent){ c.fillStyle = opts.accent; c.fillRect(0,0,w,opts.accentH||18); }
  let y = opts.pad || 60; for (const ln of lines){ const [t, size, col, weight] = Array.isArray(ln) ? ln : [ln, 64, "#fff", 700]; c.font = `${weight||700} ${size}px -apple-system,"Hiragino Kaku Gothic ProN",Meiryo,sans-serif`; c.fillStyle = col; c.textBaseline = "top"; c.fillText(t, opts.pad||60, y); y += size*1.35; }
  if (opts.draw) opts.draw(c, w, h); const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function textPlane(tex, w, h, opts={}){ const m = new THREE.Mesh(G.plane(w, h), new THREE.MeshStandardMaterial({ map:tex, emissive:0xffffff, emissiveMap:tex, emissiveIntensity: opts.emis ?? 0.35, roughness:0.6, side: opts.double ? THREE.DoubleSide : THREE.FrontSide })); m.castShadow = false; return m; }

// ---- 平面図キャンバス（ロビー・HIL のデジタルツイン壁面） ----
let planTex = null;
function drawPlan(){ const w = 1024, h = 512; const cvs = planTex ? planTex.image : document.createElement("canvas"); cvs.width = w; cvs.height = h; const c = cvs.getContext("2d");
  c.fillStyle = "#0d1117"; c.fillRect(0,0,w,h); const sx = (w-80)/(SITE.w), sz = (h-80)/(SITE.d); const X = x => 40 + (x + SITE.w/2)*sx, Z = z => 40 + (z + SITE.d/2)*sz;
  c.strokeStyle = "#30363d"; c.lineWidth = 2; c.strokeRect(X(-SITE.w/2), Z(-SITE.d/2), SITE.w*sx, SITE.d*sz);
  for (const z of ZONES){ if (z[2] !== 1 && z[2] !== 0) continue; c.fillStyle = "#" + ZTYPE[z[3]].c.toString(16).padStart(6,"0") + (z[2]===0? "33" : "66"); c.fillRect(X(z[4]), Z(z[6]), (z[5]-z[4])*sx, (z[7]-z[6])*sz); c.strokeStyle = "#0d1117"; c.strokeRect(X(z[4]), Z(z[6]), (z[5]-z[4])*sx, (z[7]-z[6])*sz); }
  c.strokeStyle = "#f2c744"; c.lineWidth = 3; c.strokeRect(X(BLD.x0), Z(BLD.z0), BLD.w*sx, BLD.d*sz);
  for (const id in LANE_OBJ){ const o = LANE_OBJ[id]; if (o.lane.floor !== 1) continue; const col = "#" + LANE_RECIPES[o.lane.recipe].color.toString(16).padStart(6,"0"); c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); o.stationPos.forEach((p, i) => { if (i) c.lineTo(X(p.x), Z(p.z)); else c.moveTo(X(p.x), Z(p.z)); }); c.stroke();
    c.fillStyle = col; c.font = "700 22px sans-serif"; c.fillText(`${id} ${o.kpi.outLabel}`, X(o.lane.area[0])+6, Z(o.lane.area[2])+24); }
  c.fillStyle = "#e6edf3"; c.font = "700 26px sans-serif"; c.fillText("YELLOW FUSION FACTORY · DIGITAL TWIN · 1F  LIVE", 40, 10); c.font = "400 18px sans-serif"; c.fillStyle = "#9da7b3"; c.fillText(new Date().toLocaleDateString("ja-JP") + "  目標 " + DEMAND.target.toFixed(1) + " 台/月", 700, 14);
  if (!planTex){ planTex = new THREE.CanvasTexture(cvs); planTex.colorSpace = THREE.SRGBColorSpace; } planTex.needsUpdate = true; return planTex; }

// ---- アンドン表示板（レーンの KPI を表示、天井から吊る） ----
function makeAndon(o){ const L = o.lane, R = LANE_RECIPES[L.recipe], k = o.kpi; const col = "#" + R.color.toString(16).padStart(6,"0");
  const tex = textCanvas([[`${L.id}  ${R.n}`, 54, "#fff"], [`${k.outLabel}   OEE ${(k.oee*100).toFixed(0)}%`, 66, col], [`タクト ${k.taktLabel} ・ 自動化 ${(k.autoRatio*100).toFixed(0)}% ・ 要員 ${k.ppl.toFixed(1)}`, 40, "#c9d1d9", 500], [`状態: 稼働中   次の保全: ${7+(L.id.charCodeAt(1)%5)} 日後`, 40, "#3fb950", 500]], { accent:col, accentH:22, pad:44 });
  const g = new THREE.Group(); boxAt(g, 4.4, 2.3, 0.14, M.blackMatte, 0, -2.3, 0); const pl = textPlane(tex, 4.2, 2.1, { emis:0.45, double:false }); pl.position.set(0, -1.15, 0.08); g.add(pl); const pl2 = textPlane(tex, 4.2, 2.1, { emis:0.45 }); pl2.rotation.y = Math.PI; pl2.position.set(0, -1.15, -0.08); g.add(pl2);
  for (const dx of [-1.6, 1.6]) cylAt(g, 0.025, 1.6, M.steel, dx, -1.6, 0, {seg:6}).position.y = 0.8 - 1.6 + 0.8; cylAt(g, 0.025, 1.6, M.steel, -1.6, 0, 0, {seg:6}); cylAt(g, 0.025, 1.6, M.steel, 1.6, 0, 0, {seg:6});
  return g; }
// ---- 吊り下げバナー（ゾーン／レーン名） ----
function makeBanner(text, colorHex){ const col = "#" + colorHex.toString(16).padStart(6,"0"); const tex = textCanvas([[text, 120, "#111", 800]], { w:1024, h:256, bg:col, pad:40 });
  const g = new THREE.Group(); const pl = textPlane(tex, 6.4, 1.6, { emis:0.15, double:true }); pl.position.y = -0.8; g.add(pl); boxAt(g, 6.6, 0.06, 0.06, M.darkSteel, 0, 0, 0); for (const dx of [-3.0, 3.0]) cylAt(g, 0.012, 1.2, M2.cable, dx, 0.06, 0, {seg:4}); return g; }
// ---- 機械まわりの小物（切粉箱・工具カート・クーラント缶） ----
function makeMachineExtras(kind, w, d){ const g = new THREE.Group(); const rnd = sRand("extras" + kind + w);
  if (["mc5","hmc","lathe","gantry","edm","grind","laser"].includes(kind)){ const bx = w/2 + 0.6, bz = -d/2 + 0.6; boxAt(g, 0.8, 0.75, 0.8, std(0x5d6670,{metalness:0.5,roughness:0.5}), bx, 0.1, bz); boxAt(g, 0.7, 0.12, 0.7, std(0x9aa3ad,{metalness:0.7,roughness:0.4}), bx, 0.85, bz); for (const dx of [-0.3,0.3]) for (const dz of [-0.3,0.3]) cylAt(g, 0.06, 0.1, M.blackMatte, bx+dx, 0, bz+dz, {seg:8});   // 切粉箱
    boxAt(g, 0.5, 0.9, 0.5, std(0xc23b3b,{metalness:0.3}), bx, 0.12, bz+1.0); for (let i=0;i<4;i++) boxAt(g, 0.46, 0.02, 0.02, M.steel, bx, 0.28+i*0.2, bz+1.26); }
  if (["mc5","hmc","lathe"].includes(kind)) { cylAt(g, 0.16, 0.5, M.pipeBlue, -w/2 - 0.4, 0, d/2 - 0.5, {seg:12}); cylAt(g, 0.16, 0.5, M.pipeBlue, -w/2 - 0.4, 0, d/2 - 0.9, {seg:12}); }
  if (["asmA","asmB","weld","panel"].includes(kind)) { boxAt(g, 0.6, 1.0, 0.4, std(0x2a5ea8,{metalness:0.3}), w/2 + 0.8, 0, d/2 - 0.6); boxAt(g, 0.08, 0.9, 0.08, M.darkSteel, w/2 + 1.3, 0, d/2 - 0.6); boxAt(g, 0.3, 0.35, 0.06, std(0xf2f2f0), w/2 + 1.3, 0.9, d/2 - 0.6); }  // 作業指示ボード
  return g; }

// ---- 外観ディテール ----
function buildExteriorDetail(){
  const { x0, x1, z0, zh, z1, terraceZ, lv, eave } = BLD; const W = x1 - x0; const g1 = floorGroup(1), g3 = floorGroup(3); const E = new Merger(), S3 = new Merger(), site = layer("site"); const SG = new Merger();
  // 南面 3F：木製縦ルーバー（0.6 m ピッチ、テラス上部の日除け）
  for (let x = x0 + 0.3; x <= x1 - 0.3; x += 0.6) S3.box(0.08, 13.4 - lv[2] - 0.2, 0.45, M.timber, x, lv[2] + 0.1, z1 + 0.55);
  S3.box(W, 0.12, 0.5, M.timberDark, (x0+x1)/2, 13.3, z1 + 0.55); S3.box(W, 0.12, 0.5, M.timberDark, (x0+x1)/2, lv[2] + 0.05, z1 + 0.55);
  // 2F テラス：木デッキ手前の格子ルーバー（軽く）
  for (let x = x0 + 0.3; x <= x1 - 0.3; x += 1.2) E.box(0.06, 1.1, 0.06, M.timberDark, x, lv[1], terraceZ - 0.3);
  // 東面：屋外避難階段（3F → 地上）
  { const bx = x1 + 1.6, bz = 8; for (const [dx, dz] of [[-1.2,-2.6],[1.2,-2.6],[-1.2,2.6],[1.2,2.6]]) E.box(0.18, lv[2] + 0.4, 0.18, M.darkSteel, bx+dx, 0, bz+dz);
    for (let f=0; f<2; f++){ const yb = lv[f], yt = lv[f+1], n = 12, rh = (yt-yb)/n; for (let i=0;i<n;i++){ const half = i < n/2; const t = half ? i : i - n/2; E.box(1.0, rh, 0.28, M.steel, half ? bx-0.6 : bx+0.6, yb + i*rh, half ? bz+2.2 - t*0.36 : bz-2.2 + t*0.36); }
      E.box(2.6, 0.1, 1.2, M.steel, bx, yb + (yt-yb)/2 - 0.05, bz + (f%2? -2.9 : 2.9)); E.box(2.6, 0.1, 1.2, M.steel, bx, yt - 0.05, bz + (f%2? 2.9 : -2.9)); }
    for (const dz of [-3.4, 3.4]) { E.box(2.6, 0.04, 0.04, M.darkSteel, bx, lv[2] + 1.0, bz + dz); E.box(2.6, 0.04, 0.04, M.darkSteel, bx, lv[1] + 1.0, bz + dz); }
    for (const dx of [-1.3, 1.3]) { E.box(0.04, lv[2] + 1.1, 0.04, M.darkSteel, bx+dx, 0, bz-3.4); E.box(0.04, lv[2] + 1.1, 0.04, M.darkSteel, bx+dx, 0, bz+3.4); }
    for (const y of [lv[1], lv[2]]) E.box(0.3, 2.2, 1.0, M.darkSteel, x1 - 0.1, y, bz + 2.9);   // 各階の非常口
    E.box(0.8, 0.2, 0.3, std(0x2ecc71,{emissive:0x2ecc71,emissiveIntensity:0.8}), x1 + 0.1, 2.3, 10); }
  // 北面：折板の目地（横ライン）・換気ガラリ・竪樋
  for (let y = 1; y < 9; y += 1.0) E.box(W, 0.03, 0.04, std(0x9aa0a6,{metalness:0.5}), (x0+x1)/2, y, z0 - 0.02);
  for (const x of [-30, -10, 10, 30]){ E.box(2.4, 1.6, 0.12, M.darkSteel, x, 6.4, z0 - 0.08); for (let i=0;i<7;i++) E.boxC(2.2, 0.05, 0.2, M.steel, x, 6.5 + i*0.22, z0 - 0.1, [0.6,0,0]); }
  for (let x = x0 + 4; x < x1; x += 16) { E.cyl(0.08, eave - 0.4, M.steel, x, 0, z0 - 0.25, 8); E.box(0.3, 0.3, 0.4, M.steel, x, eave - 0.5, z0 - 0.2); }
  for (const x of [-20, 20]) { E.cyl(0.45, 3.0, M.duct, x, 13.2, -28.5, 14); E.cyl(0.55, 0.25, M.darkSteel, x, 16.2, -28.5, 14); }   // 排気筒（集塵・溶接ヒューム）
  // 西面：駐車場側の社名サインと庇
  E.box(10, 0.1, 2.2, M.darkSteel, x0 - 1.2, lv[1] - 0.4, 10); for (const z of [9.2, 10.8]) E.cyl(0.06, 1.0, M.steel, x0 - 2.2, lv[1] - 0.4, z, 8);
  E.flush(g1, { name:"extDetail", layer:"envelope" }); S3.flush(g3, { name:"louvers3F", layer:"envelope" });
  // ---- 外構 ----
  // 守衛所・ゲートバー（東側トラック入口）
  SG.box(3.2, 2.8, 2.6, M.white, 47.5, 0, 36.5); SG.box(3.0, 1.1, 0.06, M.glassTint, 47.5, 1.3, 37.85); SG.box(0.06, 1.1, 2.4, M.glassTint, 46.0, 1.3, 36.5); SG.box(3.8, 0.15, 3.2, M.darkSteel, 47.5, 2.8, 36.5);
  SG.cyl(0.18, 1.2, M.darkSteel, 50.0, 0, 38.5, 10); SG.box(0.5, 0.6, 0.5, M.darkSteel, 50.0, 0.9, 38.5); SG.boxC(7.0, 0.1, 0.12, std(0xffffff), 53.5, 1.4, 38.5); for (let i=0;i<7;i+=2) SG.boxC(1.0, 0.11, 0.13, std(0xd13b3b), 50.5 + i, 1.4, 38.5);
  SG.box(0.1, 2.4, 0.1, M.darkSteel, 58, 0, 34); SG.box(1.6, 1.0, 0.05, M.white, 58, 1.6, 34);
  // EV 充電スタンド（駐車場南端 4 台）
  for (let i=0;i<4;i++){ const z = 30.5 - i*2.6; SG.box(0.35, 1.4, 0.25, std(0x2b6f4e), -57.6, 0, z); SG.box(0.3, 0.3, 0.02, M.screen, -57.6, 0.9, z + 0.13); SG.box(0.12, 0.05, 0.6, M2.cable, -57.4, 0.6, z + 0.3); }
  // 駐輪場の屋根・ごみ置場・喫煙所
  SG.box(8.0, 0.08, 2.4, M.roofMetal, -41.5, 2.3, 30); for (const x of [-45, -38]) for (const z of [29, 31]) SG.cyl(0.06, 2.3, M.steel, x, 0, z, 8);
  SG.box(6, 2.0, 0.1, M.wallMetal, -54, 0, -24); SG.box(0.1, 2.0, 4, M.wallMetal, -57, 0, -22); SG.box(0.1, 2.0, 4, M.wallMetal, -51, 0, -22); for (let i=0;i<3;i++) SG.box(1.2, 1.2, 1.0, [std(0x3a7bd5), std(0x3fb950), std(0x9aa0a6)][i], -55.6 + i*1.6, 0, -21.5);
  SG.box(4, 0.08, 3, M.roofMetal, 40, 2.4, 30); for (const x of [38.3, 41.7]) for (const z of [28.7, 31.3]) SG.cyl(0.05, 2.4, M.steel, x, 0, z, 8); SG.box(2.0, 0.45, 0.5, M.timber, 40, 0.4, 31);
  // 植栽升・シンボルツリー（前庭中央）
  SG.cyl(2.4, 0.5, M.curb, -8, 0, 33, 24); SG.cyl(2.2, 0.08, M.grass, -8, 0.5, 33, 24);
  SG.flush(site, { name:"siteDetail2" });
  { const t = new THREE.Group(); t.position.set(-8, 0.5, 33); cylAt(t, 0.28, 4.5, M.trunk, 0, 0, 0, {seg:10, rt:0.2}); for (const [dx,dy,dz,r] of [[0,5.8,0,3.2],[1.6,5.0,0.8,2.2],[-1.5,5.2,-0.6,2.1],[0.4,7.2,-0.4,2.0]]) { const c = mesh(G.sph(r, 14), M.leaf, dx, dy, dz); t.add(c); } layer("green").add(t); }
}

// ---- 内観ディテール ----
function buildInteriorDetail(){
  const { x0, x1, z0, zh, z1, lv } = BLD; const W = x1 - x0; const g1 = floorGroup(1), g2 = floorGroup(2), g3 = floorGroup(3); const I1 = new Merger(), I2 = new Merger(), I3 = new Merger();
  // 吸音バッフル（2F/3F オフィス天井）
  for (const [m, y] of [[I2, lv[1]-0.7], [I3, lv[2]-0.7]]) for (let x = x0 + 9; x < x1 - 9; x += 1.2) for (const z of [4.5, 8.5, 12.5]) m.box(0.05, 0.45, 2.4, std(0xdfe3e6, {roughness:0.95}), x, y - 0.5, z);
  // ロビー：デジタルツイン壁面（既存ディスプレイを差し替え）・受付サイン
  const tex = drawPlan(); const wall = textPlane(tex, 5.6, 2.8, { emis:0.5 }); wall.position.set(-37, 2.0, 16.72); wall.rotation.y = Math.PI; g1.add(wall); wall.userData.plan = true;
  I1.box(6.0, 3.2, 0.12, M.blackMatte, -37, 0.4, 16.85);
  const logo = textCanvas([["YELLOW", 150, "#1a1400", 900], ["FUSION FACTORY · OTA", 44, "#1a1400", 600]], { w:1024, h:384, bg:"#f2c744", pad:70 }); const lg = textPlane(logo, 4.0, 1.5, { emis:0.1 }); lg.position.set(-41, 3.2, 17.78); lg.rotation.y = Math.PI; g1.add(lg);
  // HIL ラボの大型ディスプレイにも同じ平面図
  const wall2 = textPlane(tex, 4.6, 1.7, { emis:0.5 }); wall2.position.set(-4.5, lv[1] + 1.15, 17.13); wall2.rotation.y = Math.PI; g2.add(wall2); wall2.userData.plan = true;
  // ホール：通路の横断帯（ゼブラ）と AGV 停止線
  for (const x of [-12, 4, 20]) for (let i=0;i<8;i++) I1.box(0.4, 0.015, 4.0, M.lineWhite, x - 1.6 + i*0.45, 0.071, -14);
  for (const [x,z] of [[-30,-14],[-14,-14],[6,-14],[26,-14]]) I1.box(0.15, 0.015, 4.0, M.pipeRed, x, 0.072, z);
  // 救急・手洗い・消火器ステーション（各ベイ境界の柱脇）
  for (const x of [-12, 4, 20, 36]) { I1.box(0.5, 0.6, 0.25, M.white, x + 0.9, 1.2, zh - 0.3); I1.box(0.4, 0.1, 0.02, std(0xd13b3b), x + 0.9, 1.45, zh - 0.17); I1.box(0.6, 0.9, 0.5, std(0xdde3e8,{metalness:0.4}), x + 0.9, 0, zh - 0.5); }
  // 2F ソフトフロア：ホール側バルコニーに立ち見用カウンターとモニタ
  for (let x = -30; x <= 20; x += 10) { I2.box(3.0, 0.05, 0.5, M.deskWhite, x, lv[1] + 1.05, zh - 1.75); I2.box(0.05, 1.05, 0.4, M.darkSteel, x - 1.3, lv[1], zh - 1.75); I2.box(0.05, 1.05, 0.4, M.darkSteel, x + 1.3, lv[1], zh - 1.75); }
  // 3F カフェテリア：ペンダント照明・植栽
  for (let x = 18; x <= 34; x += 3.4) for (const z of [6, 12]) { I3.cyl(0.01, 1.2, M2.cable, x, lv[2] + 2.6, z, 4); I3.cyl(0.22, 0.25, M.lampWarm, x, lv[2] + 2.35, z, 14); }
  I1.flush(g1, { name:"intDetail1", layer:"furniture" }); I2.flush(g2, { name:"intDetail2", layer:"furniture" }); I3.flush(g3, { name:"intDetail3", layer:"furniture" });
}
function refreshPlanTexture(){ if (planTex) drawPlan(); }
