// ================= 内部：設備・什器・MEP =================
const EQ_OBJ = {};      // id -> { group, data }
// グループ内の静的メッシュを材質ごとに結合（描画コール削減）。userData.dyn / joints を持つ部分は除外。
function compactGroup(grp){
  grp.updateMatrixWorld(true); const buckets = new Map(), remove = [];
  grp.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.isSprite || o.userData.dyn || Array.isArray(o.material)) return;
    let p = o.parent; while (p && p !== grp){ if (p.userData.joints || p.userData.dyn) return; p = p.parent; }
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld); if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(g); remove.push(o); });
  remove.forEach(o => o.parent.remove(o));
  for (const [mat, geos] of buckets){ const m = new THREE.Mesh(mergeGeometries(geos, false), mat); geos.forEach(g=>g.dispose()); m.castShadow = m.receiveShadow = true; grp.add(m); }
}
const ANIM = [];        // 稼働アニメ対象 { update(t,dt) }

function tagEq(group, data){ group.userData.eqId = data.id; group.traverse(o=>{ o.userData.eqId = data.id; }); EQ_OBJ[data.id] = { group, data }; }

// ---- 共通部品 ----
function signalTower(g, x, y, z){ cylAt(g, 0.05, 0.4, M.darkSteel, x, y, z, {seg:8}); for (const [i,c] of [[0,0xd13b3b],[1,0xf2c230],[2,0x3fb950]].entries()) cylAt(g, 0.07, 0.12, std(c,{emissive:c, emissiveIntensity:0.5}), x, y+0.4+i*0.13, z, {seg:10}); }
function pendant(g, x, y, z, ry=0){ const a = new THREE.Group(); a.position.set(x,y,z); a.rotation.y = ry;
  boxAt(a, 0.08, 0.08, 0.6, M.darkSteel, 0, 0, 0.3); boxAt(a, 0.08, 0.9, 0.08, M.darkSteel, 0, -0.9, 0.6);
  const p = boxAt(a, 0.45, 0.6, 0.08, M.machineDark, 0, -0.6, 0.62); boxAt(a, 0.36, 0.3, 0.02, M.screen, 0, -0.35, 0.67); boxAt(a, 0.36, 0.18, 0.02, std(0x8d939a), 0, -0.58, 0.67); g.add(a); return a; }
function chipConveyor(g, x, y, z, ry=0){ const c = new THREE.Group(); c.position.set(x,y,z); c.rotation.y = ry;
  const incl = boxAt(c, 0.5, 0.35, 2.2, M.machineDark, 0, 0.3, 1.1); incl.rotation.x = -0.35; incl.position.y = 0.95;
  boxAt(c, 0.5, 0.35, 1.4, M.machineDark, 0, 0.2, 0.2); boxAt(c, 0.9, 0.8, 0.9, std(0x5a6066,{metalness:0.5,roughness:0.5}), 0, 0, 2.3); g.add(c); }
function cabinet(g, w,h,d, x, z, ry=0, mat=M.machineWhite){ const c = new THREE.Group(); c.position.set(x,0,z); c.rotation.y=ry; boxAt(c, w,h,d, mat, 0,0,0); boxAt(c, w*0.9, 0.02, 0.02, M.darkSteel, 0, h*0.55, d/2+0.01); boxAt(c, 0.04, 0.25, 0.03, M.darkSteel, w*0.35, h*0.5, d/2+0.02); g.add(c); return c; }
function hazardBase(g, w, d, x, z){ for (let i=0;i<4;i++) boxAt(g, w, 0.03, d, i%2? M.blackMatte : M.safetyYellow, x, 0.001+i*0.0, z).scale.set(1-i*0.22,1,1-i*0.22); }

// ---- 6軸ロボット（関節参照付き） ----
function makeRobot(scale=1, mat=M.robotYellow){
  const r = new THREE.Group(); r.scale.setScalar(scale);
  cylAt(r, 0.38, 0.25, M.darkSteel, 0, 0, 0, {seg:20}); const j1 = new THREE.Group(); j1.position.y = 0.25; r.add(j1);
  cylAt(j1, 0.32, 0.45, mat, 0, 0, 0, {seg:20}); boxAt(j1, 0.5, 0.5, 0.35, mat, 0, 0.3, 0.1);
  const j2 = new THREE.Group(); j2.position.set(0, 0.75, 0.1); j1.add(j2);
  const upper = boxAt(j2, 0.3, 1.1, 0.34, mat, 0, 0, 0); cylAt(j2, 0.22, 0.4, M.darkSteel, 0, -0.2, 0, {rot:[0,0,Math.PI/2], seg:16});
  const j3 = new THREE.Group(); j3.position.set(0, 1.1, 0); j2.add(j3);
  boxAt(j3, 0.42, 0.36, 0.5, mat, 0, -0.18, 0.1); const fore = boxAt(j3, 0.24, 0.24, 1.2, mat, 0, -0.12, 0.7); cylAt(j3, 0.2, 0.46, M.darkSteel, 0, -0.18, 0, {rot:[0,0,Math.PI/2], seg:16});
  const j5 = new THREE.Group(); j5.position.set(0, 0, 1.3); j3.add(j5);
  cylAt(j5, 0.12, 0.3, M.darkSteel, 0, -0.15, 0, {rot:[0,0,Math.PI/2], seg:12}); boxAt(j5, 0.16, 0.16, 0.25, mat, 0, -0.08, 0.15);
  const tool = new THREE.Group(); tool.position.set(0, 0, 0.3); j5.add(tool); boxAt(tool, 0.22, 0.12, 0.12, M.darkSteel, 0, -0.06, 0.06); boxAt(tool, 0.04, 0.16, 0.14, M.darkSteel, -0.08, -0.08, 0.12); boxAt(tool, 0.04, 0.16, 0.14, M.darkSteel, 0.08, -0.08, 0.12);
  r.userData.joints = { j1, j2, j3, j5 }; r.userData.base = { j2: -0.4, j3: 0.9, j5: -0.5 };
  j2.rotation.x = -0.4; j3.rotation.x = 0.9; j5.rotation.x = -0.5;
  return r;
}
function animateRobot(r, phase, speed=0.6){
  const J = r.userData.joints; ANIM.push({ update(t){ const s = t*speed + phase; J.j1.rotation.y = Math.sin(s)*0.9; J.j2.rotation.x = -0.4 + Math.sin(s*1.3)*0.35; J.j3.rotation.x = 0.9 + Math.cos(s*0.9)*0.4; J.j5.rotation.x = -0.5 + Math.sin(s*2)*0.3; } });
}

// ---- 工作機械 ----
function makeMC5(){ const g = new THREE.Group();
  boxAt(g, 4.2, 0.35, 4.6, M.machineDark, 0, 0, 0); boxAt(g, 4.0, 2.9, 3.4, M.machineWhite, 0, 0.35, -0.5);
  boxAt(g, 4.0, 0.25, 3.4, M.machineDark, 0, 3.25, -0.5); boxAt(g, 1.4, 1.5, 1.2, M.machineWhite, -1.9, 1.2, -0.3); // ATC マガジン
  for (const dx of [-0.95, 0.95]){ boxAt(g, 1.7, 2.0, 0.08, M.machineDark, dx, 0.6, 1.22); boxAt(g, 1.3, 1.2, 0.03, M.machineWin, dx, 1.0, 1.27); }
  boxAt(g, 0.12, 2.0, 0.06, M.yellow, 0, 0.6, 1.28);
  boxAt(g, 1.2, 0.6, 1.2, M.steel, 0, 0.35, 0.2); cylAt(g, 0.25, 0.5, M.darkSteel, 0, 1.9, 0.2, {seg:16});   // テーブル・主軸
  pendant(g, 2.05, 2.0, 0.6); chipConveyor(g, 2.3, 0.0, -1.2, Math.PI/2); signalTower(g, 1.6, 3.5, -0.6);
  boxAt(g, 1.0, 0.9, 2.0, M.machineDark, -2.6, 0, -0.8); // クーラントタンク
  return g; }
function makeHMC(){ const g = new THREE.Group();
  boxAt(g, 5.2, 0.35, 6.2, M.machineDark, 0, 0, 0); boxAt(g, 5.0, 3.0, 3.8, M.machineWhite, 0, 0.35, -1.0); boxAt(g, 5.0, 0.25, 3.8, M.machineDark, 0, 3.35, -1.0);
  boxAt(g, 3.0, 2.2, 2.2, M.machineWhite, 0, 0.35, 1.9); cylAt(g, 1.2, 0.3, M.steel, 0, 2.55, 1.9, {seg:24}); // パレットチェンジャ
  boxAt(g, 1.2, 1.4, 0.06, M.machineWin, 0, 1.0, 3.0); boxAt(g, 1.8, 2.0, 0.08, M.machineDark, 2.0, 0.6, 0.95); boxAt(g, 1.3, 1.1, 0.03, M.machineWin, 2.0, 1.0, 1.0);
  boxAt(g, 0.9, 1.6, 1.3, M.machineWhite, -2.9, 1.3, -1.0); cylAt(g, 0.9, 0.5, M.machineDark, -2.9, 3.0, -1.0, {seg:20}); // ツールマガジン
  pendant(g, 2.6, 2.1, 2.2, 0); chipConveyor(g, 2.8, 0, -2.2, Math.PI/2); signalTower(g, -1.8, 3.6, -1.5); return g; }
function makeLathe(){ const g = new THREE.Group();
  boxAt(g, 3.4, 0.3, 2.0, M.machineDark, 0, 0, 0); boxAt(g, 3.2, 1.8, 1.7, M.machineWhite, 0, 0.3, 0); boxAt(g, 3.2, 0.2, 1.7, M.machineDark, 0, 2.1, 0);
  boxAt(g, 1.6, 1.3, 0.06, M.machineDark, 0.2, 0.6, 0.86); boxAt(g, 1.2, 0.8, 0.03, M.machineWin, 0.2, 0.85, 0.9);
  boxAt(g, 0.45, 0.7, 0.08, M.machineDark, 1.3, 1.2, 0.87); boxAt(g, 0.36, 0.3, 0.02, M.screen, 1.3, 1.5, 0.92);
  chipConveyor(g, -2.0, 0, -0.3, 0); signalTower(g, -1.2, 2.3, 0); return g; }
function makeGantry(){ const g = new THREE.Group();
  boxAt(g, 10, 1.0, 3.2, M.machineDark, 0, 0, 0); boxAt(g, 4.2, 0.4, 2.6, M.steel, -1.5, 1.0, 0);         // ベッド・テーブル
  for (let i=0;i<8;i++) boxAt(g, 0.04, 0.02, 2.6, M.blackMatte, -1.5-2.0+i*0.55, 1.4, 0);                  // T溝
  for (const dz of [-2.4, 2.4]) boxAt(g, 1.0, 5.6, 1.0, M.machineWhite, 0, 0, dz);                          // コラム
  boxAt(g, 1.1, 1.0, 6.2, M.machineWhite, 0, 5.1, 0); boxAt(g, 1.3, 0.3, 6.4, M.machineDark, 0, 6.1, 0);   // クロスレール
  const saddle = boxAt(g, 0.9, 0.9, 0.9, M.machineDark, 0, 4.4, 0.4); const ram = boxAt(g, 0.5, 2.6, 0.5, M.steel, 0, 2.0, 0.4);
  const head = boxAt(g, 0.7, 0.6, 0.7, M.machineWhite, 0, 1.5, 0.4); saddle.userData.dyn = ram.userData.dyn = head.userData.dyn = true; cylAt(g, 0.12, 0.3, M.darkSteel, 0, 1.3, 0.4, {seg:12});
  ANIM.push({ update(t){ const dz = Math.sin(t*0.4)*1.0; saddle.position.z = 0.4+dz; ram.position.z = 0.4+dz; head.position.z = 0.4+dz; const dy = Math.sin(t*0.9)*0.3; ram.position.y = 3.3+dy; head.position.y = 1.8+dy; } });
  // 操作デッキ・階段・制御盤
  boxAt(g, 2.4, 0.1, 1.6, M.steel, 3.9, 1.6, 2.6); for (let i=0;i<6;i++) boxAt(g, 0.8, 0.05, 0.3, M.steel, 5.3, 0.27*i, 2.6+1.0-i*0.3);
  boxAt(g, 2.4, 1.0, 0.04, M.darkSteel, 3.9, 1.7, 3.4); boxAt(g, 0.04, 1.0, 1.6, M.darkSteel, 2.7, 1.7, 2.6);
  cabinet(g, 1.2, 2.0, 0.6, 3.5, 2.0, Math.PI, M.machineWhite); boxAt(g, 0.5, 0.35, 0.03, M.screen, 3.5, 3.0, 2.4);
  cabinet(g, 2.2, 2.2, 0.8, -4.0, -2.9, 0, M.machineWhite); cabinet(g, 2.2, 2.2, 0.8, -1.5, -2.9, 0, M.machineWhite); // 電気盤
  signalTower(g, 0, 6.4, 2.4); chipConveyor(g, -5.6, 0, -0.2, Math.PI/2);
  for (const x of [-5.2, 5.2]) for (const z of [-2.0, 2.0]) cylAt(g, 0.08, 1.0, M.yellow, x, 0, z, {seg:8});
  return g; }
function makeEDM(){ const g = new THREE.Group(); boxAt(g, 2.6, 0.3, 2.6, M.machineDark, 0, 0, 0); boxAt(g, 2.4, 2.1, 2.2, M.machineWhite, 0, 0.3, -0.1); boxAt(g, 2.4, 0.15, 2.2, M.machineDark, 0, 2.4, -0.1);
  boxAt(g, 1.4, 1.1, 0.04, M.machineWin, 0, 0.9, 1.0); boxAt(g, 0.5, 1.0, 0.5, M.machineWhite, 1.4, 1.1, 0.9); boxAt(g, 0.4, 0.3, 0.02, M.screen, 1.4, 1.6, 1.16);
  boxAt(g, 0.8, 0.9, 1.4, std(0x7a8aa0), -1.9, 0, 0); cylAt(g, 0.25, 0.3, M.steel, 0.6, 2.55, -0.8, {seg:16}); return g; }
function makeGrinder(){ const g = new THREE.Group(); boxAt(g, 2.6, 0.3, 1.8, M.machineDark, 0, 0, 0); boxAt(g, 2.4, 1.0, 1.4, std(0x4a7a5a), 0, 0.3, 0); boxAt(g, 0.8, 1.2, 1.0, std(0x4a7a5a), 0.5, 1.3, -0.2);
  cylAt(g, 0.3, 0.2, M.darkSteel, 0.1, 1.5, 0.3, {rot:[0,0,Math.PI/2], seg:20}); boxAt(g, 1.2, 0.1, 0.5, M.steel, -0.4, 1.3, 0.2); boxAt(g, 0.4, 0.5, 0.06, M.machineDark, 1.0, 1.0, 0.75); return g; }

// ---- ロボットセル ----
function makeRobotCell(big){ const g = new THREE.Group(); const w = 6, d = 6;
  for (let i=0;i<=3;i++){ for (const [x,z] of [[-w/2+i*2, -d/2],[-w/2+i*2, d/2],[-w/2, -d/2+i*2],[w/2, -d/2+i*2]]) boxAt(g, 0.08, 2.0, 0.08, M.safetyYellow, x, 0, z); }
  for (const [x,z,ry] of [[0,-d/2,0],[0,d/2,0],[-w/2,0,Math.PI/2],[w/2,0,Math.PI/2]]){ const p = mesh(G.plane(w, 1.9), M.mesh, x, 1.0, z, { ry, cast:false }); g.add(p); }
  boxAt(g, 1.0, 2.0, 0.04, M.darkSteel, w/2+0.0, 0, 1.5).rotation.y = Math.PI/2; // 扉
  const r = makeRobot(big? 1.35 : 1.0); r.position.set(0, 0.6, 0); cylAt(g, 0.5, 0.6, M.machineDark, 0, 0, 0, {seg:20}); g.add(r); animateRobot(r, big? 1.4 : 0.2, big? 0.45 : 0.7);
  // ワークストッカ（棚）
  for (const x of [-2.2, 2.2]){ boxAt(g, 1.2, 1.5, 0.8, M.darkSteel, x, 0, -2.0); for (let i=0;i<3;i++) boxAt(g, 1.1, 0.03, 0.75, M.steel, x, 0.3+i*0.5, -2.0); for (let i=0;i<3;i++) for (let k=0;k<3;k++) boxAt(g, 0.25, 0.22, 0.25, M.steel, x-0.35+k*0.35, 0.33+i*0.5, -2.0); }
  cabinet(g, 0.9, 1.9, 0.5, -2.4, 2.4, 0, M.machineWhite); boxAt(g, 0.8, 0.9, 0.8, M.steel, 1.8, 0, 2.0); // 制御盤・治具台
  for (const x of [-2.6, 2.6]) boxAt(g, 0.06, 1.6, 0.06, M.yellow, x, 0.2, 2.98);  // ライトカーテン
  signalTower(g, -2.4, 1.9, 2.4); return g; }

// ---- 組立ベイ：組立中の大型機 ----
function makeAssembly(variant){ const g = new THREE.Group();
  if (variant === "A"){ // 大型門型システム 組立中
    boxAt(g, 9.0, 0.6, 4.5, M.machineDark, 0, 0, 0); for (let i=0;i<4;i++) boxAt(g, 0.4, 0.2, 4.5, M.yellow, -3.3+i*2.2, 0.6, 0);  // ベースとレベリング
    boxAt(g, 1.0, 4.6, 1.1, M.machineWhite, -2.5, 0.6, -1.9); boxAt(g, 1.0, 4.6, 1.1, M.machineWhite, -2.5, 0.6, 1.9); boxAt(g, 1.1, 0.9, 4.8, M.machineWhite, -2.5, 5.2, 0); // 第1門
    boxAt(g, 1.0, 4.6, 1.1, M.machineWhite, 2.5, 0.6, -1.9); boxAt(g, 1.0, 2.6, 1.1, M.steel, 2.5, 0.6, 1.9);   // 第2門（片側は未設置→クレーン吊り中）
    boxAt(g, 3.8, 0.35, 2.4, M.steel, 0, 0.6, 0); boxAt(g, 0.6, 0.6, 0.6, M.machineDark, -2.5, 4.4, 0.6);
    // 作業足場（単管＋足場板＋手摺）
    for (const [x,z] of [[-4.0,-2.9],[-4.0,2.9],[-1.0,-2.9],[-1.0,2.9],[2.0,-2.9],[2.0,2.9],[5.0,-2.9],[5.0,2.9]]) cylAt(g, 0.03, 4.0, M.steel, x, 0, z, {seg:6});
    for (const z of [-2.9, 2.9]){ boxAt(g, 9.2, 0.06, 0.9, M.pallet, 0.5, 2.2, z); boxAt(g, 9.2, 0.03, 0.03, M.steel, 0.5, 3.2, z+Math.sign(z)*0.45); boxAt(g, 9.2, 0.03, 0.03, M.steel, 0.5, 2.7, z+Math.sign(z)*0.45); boxAt(g, 9.2, 0.03, 0.03, M.steel, 0.5, 2.2, z); boxAt(g, 9.2, 0.03, 0.03, M.steel, 0.5, 4.0, z); }
    for (let i=0;i<7;i++) boxAt(g, 0.7, 0.03, 0.25, M.steel, -5.0, 0.3*i, -2.0 + i*0.32);  // 階段
    // 周辺：工具カート、ケーブルリール、部品パレット、制御盤仮置き
    for (const [x,z] of [[5.8,-1.0],[5.8,1.2]]){ boxAt(g, 0.7, 0.9, 0.5, std(0xc23b3b,{metalness:0.3,roughness:0.5}), x, 0.15, z); for (let i=0;i<4;i++) boxAt(g, 0.66, 0.02, 0.02, M.steel, x, 0.3+i*0.2, z+0.26); for (const dx of [-0.25,0.25]) for (const dz of [-0.18,0.18]) cylAt(g, 0.07, 0.05, M.blackMatte, x+dx, 0.05, z+dz, {seg:10}); }
    cylAt(g, 0.35, 0.3, M.rackOrange, -5.6, 0.1, 2.8, {rot:[0,0,Math.PI/2], seg:16}); boxAt(g, 0.5, 0.6, 0.5, M.darkSteel, -5.6, 0, 2.8);
    for (const [x,z] of [[-6.5,-1.5],[-6.5,0.0],[-6.5,1.5]]){ boxAt(g, 1.1, 0.14, 1.1, M.pallet, x, 0, z); boxAt(g, 0.9, 0.5, 0.9, M.crate, x, 0.14, z); }
    cabinet(g, 1.8, 2.1, 0.7, 6.5, 2.9, Math.PI, M.machineWhite); cabinet(g, 1.8, 2.1, 0.7, 6.5, -2.9, 0, M.machineWhite);
    boxAt(g, 0.9, 1.1, 0.03, std(0xe8e8e0), -6.0, 1.3, -3.4); boxAt(g, 0.05, 1.2, 0.05, M.darkSteel, -6.0, 0.1, -3.4); // 工程ボード
  } else { // 自律搬送・ロボット統合セル
    boxAt(g, 8.0, 0.5, 4.0, M.darkSteel, 0, 0, 0); boxAt(g, 7.6, 0.08, 3.6, M.steel, 0, 0.5, 0);
    for (let i=0;i<3;i++){ boxAt(g, 2.2, 0.5, 0.8, M.darkSteel, -2.6+i*2.6, 0.58, -1.2); for (let k=0;k<10;k++) cylAt(g, 0.06, 0.78, M.steel, -2.6+i*2.6-1.0+k*0.22, 1.08, -1.2, {rot:[Math.PI/2,0,0], seg:8}); } // コンベヤ
    const r1 = makeRobot(1.1, M.robotWhite); r1.position.set(-1.5, 0.58, 0.8); g.add(r1); animateRobot(r1, 0.0, 0.8);
    const r2 = makeRobot(1.1, M.robotWhite); r2.position.set(1.8, 0.58, 0.8); g.add(r2); animateRobot(r2, 2.1, 0.8);
    cabinet(g, 1.6, 2.0, 0.6, 3.5, 1.6, -Math.PI/2, M.machineWhite); cabinet(g, 1.6, 2.0, 0.6, -3.5, 1.6, Math.PI/2, M.machineWhite);
    for (let i=0;i<4;i++){ boxAt(g, 0.08, 1.8, 0.08, M.safetyYellow, -3.9+i*2.6, 0.58, -1.9); } g.add(mesh(G.plane(7.8, 1.7), M.mesh, 0, 1.48, -1.9, {cast:false}));
    boxAt(g, 1.6, 0.35, 1.1, M.machineBlue, 0.4, 0.58, 1.6); cylAt(g, 0.08, 0.2, M.blackMatte, 0.4, 0.93, 1.6, {seg:12}); // AMR 試作機
    boxAt(g, 1.2, 1.8, 0.05, M.monitor, -4.6, 0.9, 2.4); boxAt(g, 1.1, 1.1, 0.02, M.screen, -4.6, 1.3, 2.43); boxAt(g, 0.1, 0.9, 0.1, M.darkSteel, -4.6, 0, 2.4); // 立会い用ディスプレイ
    for (const [x,z] of [[-5.5,-1.0],[-5.5,0.5]]){ boxAt(g, 1.1, 0.14, 1.1, M.pallet, x, 0, z); boxAt(g, 0.9, 0.6, 0.9, M.box, x, 0.14, z); }
    boxAt(g, 1.6, 0.75, 0.8, M.deskWhite, 5.5, 0, 2.6); for (const dx of [-0.4,0.4]) boxAt(g, 0.45, 0.45, 0.45, M.chair, 5.5+dx, 0, 3.4); // 立会い席
  }
  return g; }

function makeBench(){ const g = new THREE.Group();
  for (const x of [-1.3, 1.3]){ boxAt(g, 2.0, 0.12, 1.0, M.steel, x, 0.75, 0); for (const dx of [-0.9,0.9]) for (const dz of [-0.4,0.4]) boxAt(g, 0.06, 0.75, 0.06, M.darkSteel, x+dx, 0, dz); boxAt(g, 0.3, 0.25, 0.2, M.machineBlue, x-0.6, 0.87, 0.3); boxAt(g, 1.9, 0.04, 0.9, M.darkSteel, x, 0.3, 0); }
  boxAt(g, 0.7, 1.0, 0.5, std(0xc23b3b,{metalness:0.3}), -2.9, 0, -0.2); for (let i=0;i<5;i++) boxAt(g, 0.66, 0.02, 0.02, M.steel, -2.9, 0.15+i*0.18, 0.06);
  boxAt(g, 0.9, 1.9, 0.4, M.darkSteel, 2.9, 0, -0.3); for (let i=0;i<4;i++) boxAt(g, 0.85, 0.02, 0.36, M.steel, 2.9, 0.4+i*0.45, -0.3);
  for (let i=0;i<6;i++) boxAt(g, 0.08+Math.random()*0.2, 0.08, 0.08+Math.random()*0.15, M.steel, -1.8+i*0.5, 0.81, -0.2);
  return g; }
function makeRack(levels=3, bays=4){ const g = new THREE.Group(); const L = bays*2.0, d = 1.1;
  for (let i=0;i<=bays;i++) for (const z of [-d/2, d/2]) boxAt(g, 0.09, levels*1.6+0.4, 0.09, M.rack, -L/2+i*2.0, 0, z);
  for (let l=1;l<=levels;l++) for (const z of [-d/2, d/2]) boxAt(g, L, 0.12, 0.08, M.rackOrange, 0, l*1.6-0.12, z);
  const rnd = sRand("rack"+levels+bays);
  for (let l=0;l<levels;l++) for (let b=0;b<bays;b++) for (const k of [-0.5, 0.5]){ if (rnd()<0.25) continue; const x = -L/2+b*2.0+1.0+k*0.9, y = l===0? 0 : l*1.6; boxAt(g, 0.8, 0.14, 1.0, M.pallet, x, y, 0);
    const h = 0.4+rnd()*0.8; boxAt(g, 0.75, h, 0.9, rnd()<0.5? M.box : M.crate, x, y+0.14, 0); }
  for (const x of [-L/2-0.3, L/2+0.3]) for (const z of [-d/2, d/2]) boxAt(g, 0.1, 0.4, 0.1, M.safetyYellow, x, 0, z);
  return g; }
function makeDock(){ const g = new THREE.Group(); boxAt(g, 2.2, 0.08, 2.6, M.darkSteel, -1.1, 0.0, 0); for (const z of [-1.9, 1.9]) boxAt(g, 0.5, 0.5, 0.3, M.blackMatte, 0.0, 0.2, z); for (const z of [-2.2, 2.2]) cylAt(g, 0.1, 1.0, M.safetyYellow, -2.6, 0, z, {seg:8}); boxAt(g, 1.4, 0.3, 0.3, M.safetyYellow, -1.0, 0, -2.4); return g; }
function makeTestCell(){ const g = new THREE.Group(); const w = 13, d = 11, h = 6;
  for (let i=0;i<=Math.round(w/2);i++) for (const z of [-d/2, d/2]) boxAt(g, 0.15, h, 0.15, M.darkSteel, -w/2+i*2, 0, z);
  for (let i=0;i<=Math.round(d/2);i++) for (const x of [-w/2, w/2]) boxAt(g, 0.15, h, 0.15, M.darkSteel, x, 0, -d/2+i*2);
  for (const [x,z,ry,L] of [[0,-d/2,0,w],[0,d/2,0,w],[-w/2,0,Math.PI/2,d],[w/2,0,Math.PI/2,d]]){ g.add(mesh(G.plane(L, h-1.2), M.glassIn, x, 1.2+(h-1.2)/2, z, {ry, cast:false})); const p = boxAt(g, L, 1.2, 0.12, std(0x3b4046,{roughness:0.95}), x, 0, z); p.rotation.y = ry; }
  boxAt(g, w, 0.4, d, std(0x3b4046,{roughness:0.95}), 0, h, 0);                                     // 吸音天井
  const door = boxAt(g, 2.0, 2.4, 0.08, M.darkSteel, -w/2, 0, 2.5); door.rotation.y = Math.PI/2;
  // 試験中の機械（中型）＋センサー・配線
  boxAt(g, 5.0, 0.5, 2.6, M.machineDark, -1.5, 0, -1.0); boxAt(g, 4.6, 2.6, 2.2, M.machineWhite, -1.5, 0.5, -1.0); boxAt(g, 0.8, 1.2, 0.8, M.steel, 0.2, 3.1, -1.0);
  const spindle = cylAt(g, 0.18, 0.9, M.darkSteel, 0.2, 2.2, -1.0, {seg:14}); spindle.userData.dyn = true; ANIM.push({ update(t){ spindle.rotation.y = t*20; } });
  for (const [x,z] of [[-4.8,2.5],[3.5,2.5],[3.5,-4.0]]){ cylAt(g, 0.04, 1.6, M.darkSteel, x, 0, z, {seg:8}); cylAt(g, 0.3, 0.25, M.darkSteel, x, 0, z, {seg:12}); boxAt(g, 0.15, 0.15, 0.25, M.machineDark, x, 1.6, z); } // 計測スタンド
  boxAt(g, 1.8, 1.8, 0.6, M.machineWhite, 4.8, 0, -3.5); boxAt(g, 1.6, 0.9, 0.03, M.screen, 4.8, 2.2, -3.2); boxAt(g, 1.8, 1.1, 0.06, M.monitor, 4.8, 2.1, -3.25);
  boxAt(g, 2.0, 0.75, 0.9, M.deskWhite, 4.2, 0, 3.8); boxAt(g, 0.45, 0.45, 0.45, M.chair, 4.2, 0, 4.6); boxAt(g, 0.6, 0.38, 0.05, M.screen, 4.2, 0.8, 3.6);
  for (let i=0;i<3;i++) boxAt(g, 0.06, 0.06, 7, M.darkSteel, -3+i*0.3, 5.5, 0);
  return g; }
function makeCMM(){ const g = new THREE.Group();
  boxAt(g, 3.0, 0.9, 1.8, M.darkSteel, 0, 0, 0); boxAt(g, 2.8, 0.3, 1.6, std(0x202326,{roughness:0.2,metalness:0.1}), 0, 0.9, 0);   // 御影石定盤
  for (const z of [-1.0, 1.0]) boxAt(g, 0.3, 1.8, 0.25, M.machineWhite, 0.4, 1.2, z); boxAt(g, 0.3, 0.3, 2.3, M.machineWhite, 0.4, 3.0, 0);
  const col = boxAt(g, 0.18, 1.4, 0.18, M.machineWhite, 0.4, 1.7, 0.3); col.userData.dyn = true; cylAt(g, 0.03, 0.3, M.darkSteel, 0.4, 1.4, 0.3, {seg:8});
  ANIM.push({ update(t){ col.position.z = Math.sin(t*0.5)*0.6; col.position.y = 2.4 + Math.sin(t*0.8)*0.2; } });
  boxAt(g, 0.5, 0.4, 0.3, M.steel, -0.6, 1.2, -0.2);
  boxAt(g, 1.6, 0.75, 0.8, M.deskWhite, -3.0, 0, 0); boxAt(g, 0.55, 0.35, 0.04, M.screen, -3.0, 0.85, -0.2); boxAt(g, 0.45, 0.45, 0.45, M.chair, -3.0, 0, 0.8);
  boxAt(g, 1.2, 1.0, 0.8, M.machineWhite, 3.0, 0, 0.5); cylAt(g, 0.2, 0.5, M.darkSteel, 3.0, 1.0, 0.5, {seg:16}); boxAt(g, 0.3, 0.6, 0.3, M.machineWhite, 3.0, 1.2, 0.2);  // 真円度測定機
  return g; }
function makeElab(){ const g = new THREE.Group();
  for (let i=0;i<4;i++){ const x = -4.5+i*3; boxAt(g, 1.6, 2.0, 0.5, M.machineWhite, x, 0, -4.5); boxAt(g, 1.4, 1.6, 0.04, M.darkSteel, x, 0.2, -4.22); for (let k=0;k<4;k++) boxAt(g, 1.2, 0.1, 0.06, std(0x6a7f95), x, 0.45+k*0.35, -4.2);
    boxAt(g, 1.8, 0.75, 0.8, M.desk, x, 0, -2.0); boxAt(g, 0.45, 0.45, 0.45, M.chair, x, 0, -1.2); boxAt(g, 0.5, 0.32, 0.04, M.screen, x+0.4, 0.85, -2.2); boxAt(g, 0.6, 0.2, 0.3, M.machineDark, x-0.5, 0.75, -2.2); }
  for (let i=0;i<3;i++){ boxAt(g, 1.0, 2.0, 0.45, M.darkSteel, -4+i*1.1, 0, 5.5); for (let k=0;k<5;k++) boxAt(g, 0.95, 0.02, 0.42, M.steel, -4+i*1.1, 0.3+k*0.38, 5.5); for (let k=0;k<5;k++) for (let b=0;b<3;b++) boxAt(g, 0.28, 0.14, 0.35, M.machineBlue, -4.35+i*1.1+b*0.32, 0.33+k*0.38, 5.5); }
  boxAt(g, 3.0, 0.9, 1.2, M.deskWhite, 3.5, 0, 4.0); boxAt(g, 0.8, 0.5, 0.5, M.machineDark, 2.5, 0.9, 4.0); boxAt(g, 0.6, 0.4, 0.4, M.machineDark, 4.2, 0.9, 4.0); // 耐電圧試験
  return g; }
function makeToolroom(){ const g = new THREE.Group();
  for (let i=0;i<8;i++){ const x = -4.2+i*1.2; boxAt(g, 1.0, 1.4, 0.7, std(0x6b7178,{metalness:0.4,roughness:0.5}), x, 0, -5.5); for (let k=0;k<6;k++) boxAt(g, 0.9, 0.02, 0.02, M.steel, x, 0.15+k*0.22, -5.14); }
  boxAt(g, 1.4, 1.2, 1.0, M.machineWhite, -2.0, 0, 0); boxAt(g, 0.3, 0.9, 0.3, M.machineWhite, -2.0, 1.2, -0.2); cylAt(g, 0.05, 0.3, M.darkSteel, -2.0, 1.2, 0.2, {rot:[Math.PI/2,0,0], seg:8}); boxAt(g, 0.5, 0.35, 0.04, M.screen, -1.3, 1.6, 0.0); // プリセッタ
  boxAt(g, 2.0, 0.8, 1.0, M.steel, 1.5, 0, 0.5); for (let i=0;i<8;i++) cylAt(g, 0.05, 0.35, M.darkSteel, 0.7+i*0.22, 0.8, 0.5, {seg:8});
  return g; }
function makeHIL(){ const g = new THREE.Group();
  for (let i=0;i<2;i++){ boxAt(g, 0.7, 2.0, 0.9, M.machineDark, -3.5+i*1.0, 0, -4.5); for (let k=0;k<8;k++) boxAt(g, 0.6, 0.04, 0.02, std(0x3fb950,{emissive:0x3fb950,emissiveIntensity:0.6}), -3.5+i*1.0, 0.3+k*0.2, -4.04); }  // リアルタイム機
  for (let i=0;i<2;i++) cabinet(g, 1.6, 2.0, 0.6, 0.5+i*1.9, -4.5, 0, M.machineWhite);  // 実機制御盤
  boxAt(g, 2.4, 0.8, 1.2, M.steel, 3.5, 0, 0.5); cylAt(g, 0.25, 0.8, M.machineBlue, 3.0, 1.0, 0.5, {rot:[0,0,Math.PI/2], seg:16}); cylAt(g, 0.25, 0.6, M.darkSteel, 4.0, 1.0, 0.5, {rot:[0,0,Math.PI/2], seg:16}); // モータ・負荷試験ベンチ
  boxAt(g, 5.0, 2.0, 0.08, M.monitor, -1.5, 1.0, 7.2); boxAt(g, 4.8, 1.8, 0.02, M.screen, -1.5, 1.1, 7.15);  // 大型ディスプレイウォール
  for (let i=0;i<3;i++){ boxAt(g, 1.6, 0.73, 0.8, M.deskWhite, -3+i*2.0, 0, 3.5); boxAt(g, 0.45, 0.45, 0.45, M.chair, -3+i*2.0, 0, 2.6); for (const dx of [-0.35, 0.35]) boxAt(g, 0.55, 0.34, 0.03, M.screen, -3+i*2.0+dx, 0.85, 3.7); }
  const r = makeRobot(0.7, M.robotWhite); r.position.set(3.2, 0.8, 4.5); boxAt(g, 1.2, 0.8, 1.2, M.steel, 3.2, 0, 4.5); g.add(r); animateRobot(r, 0.9, 0.9);
  return g; }
function makeServer(){ const g = new THREE.Group();
  for (let i=0;i<8;i++){ const x = -4.2+i*1.2; boxAt(g, 0.7, 2.1, 1.1, M.blackMatte, x, 0, 0); boxAt(g, 0.62, 1.95, 0.02, std(0x2a2e33), x, 0.08, 0.56); for (let k=0;k<12;k++) boxAt(g, 0.02, 0.02, 0.02, std(k%3? 0x3fb950 : 0x58a6ff, {emissive:k%3? 0x3fb950 : 0x58a6ff, emissiveIntensity:1}), x-0.25, 0.2+k*0.15, 0.58); }
  boxAt(g, 10, 0.1, 1.6, M.darkSteel, 0, 2.1, 0); boxAt(g, 10, 2.1, 0.04, M.glassIn, 0, 0, 0.9); boxAt(g, 10, 2.1, 0.04, M.glassIn, 0, 0, -0.9);  // 熱通路封じ込め
  for (const x of [-4.8, 4.8]) boxAt(g, 1.0, 2.0, 0.8, std(0xd8dcdf,{metalness:0.4}), x, 0, 3.0); boxAt(g, 1.6, 1.9, 0.7, M.machineWhite, 0, 0, 4.5);  // 空調・UPS
  boxAt(g, 9.8, 0.4, 8, std(0xd0d4d8,{transparent:true,opacity:0.35}), 0, -0.4, 1.5); // フリーアクセス床（薄）
  return g; }
function makeAGV(){ const g = new THREE.Group(); boxAt(g, 1.6, 0.35, 1.1, M.machineBlue, 0, 0.06, 0); boxAt(g, 1.5, 0.05, 1.0, M.safetyYellow, 0, 0.41, 0); boxAt(g, 1.1, 0.14, 1.1, M.pallet, 0, 0.46, 0); boxAt(g, 0.9, 0.6, 0.9, M.crate, 0, 0.6, 0);
  cylAt(g, 0.08, 0.1, M.blackMatte, 0.7, 0.41, 0.45, {seg:12}); cylAt(g, 0.08, 0.1, M.blackMatte, -0.7, 0.41, -0.45, {seg:12}); for (const dx of [-0.5,0.5]) for (const dz of [-0.45,0.45]) cylAt(g, 0.1, 0.08, M.blackMatte, dx, 0.0, dz, {rot:[Math.PI/2,0,0], seg:10}); return g; }
function makeCrane(){ const g = new THREE.Group(); const span = BLD.zh - BLD.z0 - 2.7; // レール間
  for (const dx of [-1.0, 1.0]) boxAt(g, 0.5, 1.1, span, M.yellow, dx, 0, 0);            // 主桁 ×2
  for (const z of [-span/2, span/2]){ boxAt(g, 3.2, 0.5, 0.8, M.darkSteel, 0, -0.3, z); for (const dx of [-1.3,1.3]) cylAt(g, 0.25, 0.3, M.darkSteel, dx, -0.45, z, {rot:[0,0,Math.PI/2], seg:16}); } // エンドトラック・車輪
  const trolley = new THREE.Group(); trolley.userData.dyn = true; g.add(trolley); boxAt(trolley, 2.6, 0.5, 1.4, M.darkSteel, 0, 1.1, 0); boxAt(trolley, 0.9, 0.8, 0.9, M.machineDark, -0.6, 1.6, 0); cylAt(trolley, 0.3, 0.9, M.darkSteel, 0.6, 1.35, 0, {rot:[0,0,Math.PI/2], seg:16});
  const rope = cylAt(trolley, 0.02, 1, M.darkSteel, 0, 0, 0, {seg:6}); const hook = new THREE.Group(); trolley.add(hook); boxAt(hook, 0.4, 0.3, 0.3, M.darkSteel, 0, 0, 0); boxAt(hook, 0.12, 0.5, 0.25, M.yellow, 0, -0.5, 0);
  boxAt(g, 1.2, 0.3, 0.6, M.darkSteel, 0, 0.9, span/2-1.5); boxAt(g, 0.6, 0.25, 0.25, std(0xf2c230,{emissive:0xf2c230,emissiveIntensity:0.6}), 0, 1.25, span/2-1.5);  // 制御盤・警告灯
  for (let i=0;i<6;i++) boxAt(g, 2.1, 0.08, 0.06, M.yellow, 0, 1.1, -span/2+2+i*(span-4)/5);
  g.userData.trolley = trolley; g.userData.rope = rope; g.userData.hook = hook; return g; }

// ---- レーン用ステーション ----
function makeLoadStation(){ const g = new THREE.Group();
  boxAt(g, 1.6, 0.6, 1.2, M.steel, -0.4, 0, 0); for (let i=0;i<3;i++) boxAt(g, 0.4+Math.random()*0.3, 0.25, 0.4+Math.random()*0.3, std(0x8d939a,{metalness:0.6,roughness:0.4}), -0.9+i*0.5, 0.6, (i%2)*0.3-0.15);   // 素材（鋼材ブロック）
  boxAt(g, 1.1, 0.14, 1.1, M.pallet, 0.9, 0, 0.1); boxAt(g, 0.9, 0.3, 0.9, M.crate, 0.9, 0.14, 0.1);
  boxAt(g, 0.08, 1.4, 0.08, M.darkSteel, 0.5, 0, -0.95); boxAt(g, 0.5, 0.35, 0.05, M.monitor, 0.5, 1.35, -0.95); boxAt(g, 0.46, 0.3, 0.02, M.screen, 0.5, 1.37, -0.92);   // 投入指示端末
  boxAt(g, 0.7, 0.8, 0.5, std(0xc23b3b,{metalness:0.3}), -1.1, 0.15, -0.9); for (const dx of [-0.25,0.25]) for (const dz of [-0.18,0.18]) cylAt(g, 0.06, 0.05, M.blackMatte, -1.1+dx, 0.05, -0.9+dz, {seg:8});
  return g; }
function makeWash(){ const g = new THREE.Group(); boxAt(g, 2.6, 0.2, 2.0, M.machineDark, 0, 0, 0); boxAt(g, 2.2, 1.9, 1.9, std(0xd8dde2,{metalness:0.6,roughness:0.35}), -0.2, 0.2, 0); boxAt(g, 1.0, 0.6, 0.04, M.machineWin, -0.2, 1.1, 0.96);
  cylAt(g, 0.12, 0.6, M.steel, 0.3, 2.1, -0.4, {seg:10}); boxAt(g, 0.5, 0.9, 0.5, M.machineWhite, 1.05, 0.2, -0.6); boxAt(g, 0.4, 0.3, 0.02, M.screen, 1.05, 1.0, -0.33);
  for (const x of [-1.5, 1.4]) { boxAt(g, 0.8, 0.1, 0.9, M.steel, x, 0.75, 0.3); for (let i=0;i<4;i++) cylAt(g, 0.04, 0.85, M.darkSteel, x-0.3+i*0.2, 0.8, 0.3, {rot:[Math.PI/2,0,0], seg:6}); boxAt(g, 0.5, 0.3, 0.5, M.mesh, x, 0.85, 0.3); }
  return g; }
function makeStore(){ const g = new THREE.Group(); const w = 3.2, d = 1.2, lv = 4;
  for (const x of [-w/2, 0, w/2]) for (const z of [-d/2, d/2]) boxAt(g, 0.06, 2.2, 0.06, M.darkSteel, x, 0, z);
  for (let l=0;l<lv;l++){ boxAt(g, w, 0.03, d, M.steel, 0, 0.2+l*0.55, 0); for (let i=0;i<8;i++){ boxAt(g, 0.34, 0.26, 0.5, l%2? M.machineBlue : M.rackOrange, -w/2+0.2+i*0.39, 0.23+l*0.55, 0.1); boxAt(g, 0.04, 0.02, 0.01, (i+l)%3? M2.led : std(0x3fb950,{emissive:0x3fb950,emissiveIntensity:1}), -w/2+0.2+i*0.39, 0.21+l*0.55, d/2+0.02); } }
  boxAt(g, 0.5, 0.35, 0.04, M.monitor, w/2+0.3, 1.5, 0.2); boxAt(g, 0.46, 0.3, 0.02, M.screen, w/2+0.3, 1.52, 0.23); boxAt(g, 0.06, 1.5, 0.06, M.darkSteel, w/2+0.3, 0, 0.2); return g; }
function makePanelStation(){ const g = new THREE.Group();
  boxAt(g, 1.6, 0.1, 1.0, M.steel, 0, 0.5, 0.3); for (const dx of [-0.7,0.7]) for (const dz of [-0.1,0.7]) boxAt(g, 0.06, 0.5, 0.06, M.darkSteel, dx, 0, dz);   // 架台
  boxAt(g, 1.2, 1.8, 0.4, M.machineWhite, 0, 0.6, 0.3); const door = boxAt(g, 0.58, 1.75, 0.03, M.machineWhite, 0.9, 0.62, 0.3); door.rotation.y = -1.2;
  boxAt(g, 1.1, 1.6, 0.02, std(0xe9c46a), 0, 0.7, 0.52); for (let i=0;i<4;i++) boxAt(g, 1.0, 0.1, 0.06, std(0x6a7f95), 0, 0.85+i*0.35, 0.55); for (let i=0;i<10;i++) boxAt(g, 0.06, 0.09, 0.07, i%3? std(0x8f9aa8) : M.machineBlue, -0.45+i*0.1, 1.18, 0.56);
  boxAt(g, 2.4, 2.0, 0.4, M.darkSteel, 0, 0, -1.3); for (let k=0;k<4;k++){ boxAt(g, 2.3, 0.02, 0.38, M.steel, 0, 0.4+k*0.45, -1.3); for (let b=0;b<6;b++) boxAt(g, 0.3, 0.2, 0.3, (b+k)%2? M.machineBlue : M.rackOrange, -1.0+b*0.38, 0.42+k*0.45, -1.3); }   // ピッキング棚
  boxAt(g, 0.06, 1.5, 0.06, M.darkSteel, 1.1, 0, -0.5); boxAt(g, 0.5, 0.35, 0.04, M.monitor, 1.1, 1.45, -0.5); boxAt(g, 0.46, 0.3, 0.02, M.screen, 1.1, 1.47, -0.47);
  return g; }
function makeWiringStation(){ const g = new THREE.Group();
  boxAt(g, 2.2, 0.05, 0.9, M.deskWhite, 0, 0.75, 0.4); for (const dx of [-1.0,1.0]) boxAt(g, 0.06, 0.75, 0.8, M.darkSteel, dx, 0, 0.4); boxAt(g, 0.45, 0.45, 0.45, M.chair, 0, 0, 1.2);
  boxAt(g, 1.0, 0.5, 0.6, M.machineWhite, -0.5, 0.8, 0.3); boxAt(g, 0.3, 0.2, 0.02, M.screen, -0.5, 1.1, 0.61);   // ワイヤ加工機
  boxAt(g, 0.6, 0.3, 0.3, M.machineDark, 0.5, 0.8, 0.3); cylAt(g, 0.03, 0.25, M.steel, 0.5, 1.1, 0.3, {seg:6});     // 圧着機
  boxAt(g, 2.2, 1.6, 0.3, M.darkSteel, 0, 0, -0.9); for (let i=0;i<8;i++) cylAt(g, 0.12, 0.2, [M2.hose, M2.hoseR, M2.cable, std(0xf2c230)][i%4], -0.9+i*0.26, 1.0, -0.9, {rot:[0,0,Math.PI/2], seg:12});  // 電線リール
  boxAt(g, 0.06, 1.3, 0.06, M.darkSteel, 1.3, 0.75, -0.2); boxAt(g, 0.3, 0.2, 0.02, M.screen, 1.3, 1.9, -0.2);    // AR 端末
  return g; }
function makePowerTest(){ const g = new THREE.Group();
  for (const [x,z] of [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]]) cylAt(g, 0.04, 1.0, M.safetyYellow, x, 0, z, {seg:8}); for (const [a,b] of [[[-1.3,-1.3],[1.3,-1.3]],[[1.3,-1.3],[1.3,1.3]],[[1.3,1.3],[-1.3,1.3]]]) { const L = Math.hypot(b[0]-a[0], b[1]-a[1]); const c = boxAt(g, L, 0.02, 0.02, M.safetyYellow, (a[0]+b[0])/2, 0.9, (a[1]+b[1])/2); c.rotation.y = -Math.atan2(b[1]-a[1], b[0]-a[0]); }
  boxAt(g, 1.2, 1.8, 0.4, M.machineWhite, 0, 0, 0); boxAt(g, 0.8, 1.4, 0.3, M.machineWhite, -1.3, 0, -0.3); boxAt(g, 0.6, 0.3, 0.02, M.screen, -1.3, 1.0, -0.14); for (let i=0;i<3;i++) cylAt(g, 0.03, 0.06, M2.hoseR, -1.5+i*0.2, 0.6, -0.14, {rot:[Math.PI/2,0,0], seg:8});
  boxAt(g, 0.05, 1.2, 0.05, M.darkSteel, 1.2, 0, 0.8); for (const [i,c] of [[0,0xd13b3b],[1,0xf2c230],[2,0x3fb950]].entries()) cylAt(g, 0.06, 0.1, std(c,{emissive:c,emissiveIntensity:0.6}), 1.2, 1.2+i*0.11, 0.8, {seg:10});
  return g; }

// ---- オフィス什器 ----
function deskCluster(m, x, z, people, ry=0){ // 4席アイランド（m: Merger）
  const rot = ry; const R = (dx,dz)=>[x + dx*Math.cos(rot) - dz*Math.sin(rot), z + dx*Math.sin(rot) + dz*Math.cos(rot)];
  for (const [sx,sz] of [[-0.8,-0.75],[0.8,-0.75],[-0.8,0.75],[0.8,0.75]]){ const [px,pz] = R(sx, sz); const side = Math.sign(sz);
    m.box(1.5, 0.03, 0.75, M.deskWhite, px, 0.72, pz, rot); for (const dx of [-0.65, 0.65]) { const [lx,lz] = R(sx+dx, sz); m.box(0.05, 0.72, 0.6, M.darkSteel, lx, 0, lz, rot); }
    const [mx,mz] = R(sx, sz - side*0.25); m.box(0.6, 0.36, 0.03, M.screen, mx, 0.85, mz, rot); m.box(0.2, 0.12, 0.15, M.darkSteel, mx, 0.73, mz, rot);
    const [cx,cz] = R(sx, sz + side*0.75); m.box(0.46, 0.08, 0.46, M.chair, cx, 0.42, cz, rot); m.box(0.44, 0.5, 0.06, M.chair, cx, 0.5, cz + side*0.2, rot); m.cyl(0.03, 0.42, M.darkSteel, cx, 0, cz, 8); m.box(0.5, 0.04, 0.5, M.darkSteel, cx, 0.02, cz, rot);
    if (people && Math.random() < 0.55) seatedPerson(m, cx, cz, rot + (side>0? Math.PI : 0)); }
  m.box(3.2, 0.5, 0.05, std(0xcbd5df), x, 0.72, z, rot);   // 中央パーティション
  { const p = R(1.9, 0); m.box(0.4, 0.5, 0.4, M.pot, p[0], 0, p[1], rot); m.box(0.5, 0.7, 0.5, M.plant, p[0], 0.5, p[1], rot); }
}
function seatedPerson(m, x, z, ry){ m.box(0.42, 0.55, 0.26, Math.random()<0.5? M.shirt : M.uniform2, x, 0.48, z, ry); m.cyl(0.11, 0.24, M.skin, x, 1.02, z, 10); m.box(0.4, 0.12, 0.45, M.uniform, x, 0.45, z, ry); }
function meetingRoom(m, x0, x1, z0, z1, y){ const cx=(x0+x1)/2, cz=(z0+z1)/2, L = Math.min(x1-x0-2, 4.5);
  m.box(L, 0.05, 1.3, M.desk, cx, y+0.73, cz); m.box(0.12, 0.73, 1.0, M.darkSteel, cx-L/2+0.4, y, cz); m.box(0.12, 0.73, 1.0, M.darkSteel, cx+L/2-0.4, y, cz);
  for (let i=0;i<Math.floor(L/0.8); i++) for (const dz of [-1.0, 1.0]){ const px = cx-L/2+0.5+i*0.8; m.box(0.46, 0.08, 0.46, M.chair, px, y+0.42, cz+dz); m.box(0.44, 0.5, 0.06, M.chair, px, y+0.5, cz+dz+Math.sign(dz)*0.2); m.cyl(0.03, 0.42, M.darkSteel, px, y, cz+dz, 8); }
  m.box(2.2, 1.3, 0.06, M.monitor, cx, y+1.0, z1-0.6); m.box(2.1, 1.2, 0.02, M.screen, cx, y+1.05, z1-0.63); m.box(3.0, 1.2, 0.03, std(0xf8f8f6), cx, y+0.9, z0+0.3);
}
function sofaSet(m, x, z, y, ry=0){ m.box(2.0, 0.42, 0.9, std(0x6b7c8a,{roughness:0.95}), x, y, z, ry); m.box(2.0, 0.4, 0.2, std(0x6b7c8a,{roughness:0.95}), x, y+0.42, z-0.35, ry); m.box(1.0, 0.4, 0.6, M.timber, x, y, z+1.2, ry); }
function cafeTable(m, x, z, y){ m.cyl(0.55, 0.04, M.timber, x, y+0.72, z, 20); m.cyl(0.04, 0.72, M.darkSteel, x, y, z, 8); m.cyl(0.25, 0.02, M.darkSteel, x, y, z, 14);
  for (let k=0;k<4;k++){ const a = k*Math.PI/2; const px = x+Math.cos(a)*0.85, pz = z+Math.sin(a)*0.85; m.box(0.4, 0.06, 0.4, M.chair, px, y+0.42, pz, -a); m.cyl(0.02, 0.42, M.darkSteel, px, y, pz, 6); m.box(0.4, 0.42, 0.05, M.chair, px+Math.cos(a)*0.2, y+0.48, pz+Math.sin(a)*0.2, -a); if (Math.random()<0.35) seatedPerson(m, px, pz, -a+Math.PI/2); } }
function plantBig(m, x, z, y){ m.cyl(0.35, 0.5, M.pot, x, y, z, 12); m.cyl(0.04, 1.2, M.trunk, x, y+0.5, z, 6); m.add(G.sph(0.6, 10), M.plant, new THREE.Matrix4().setPosition(x, y+1.9, z)); m.add(G.sph(0.45, 10), M.plant, new THREE.Matrix4().setPosition(x+0.3, y+1.5, z-0.2)); }
function lockerRow(m, x0, x1, z, y){ for (let x=x0; x<x1; x+=0.45) { m.box(0.42, 1.8, 0.5, std(0x9aa5ae,{metalness:0.4}), x+0.22, y, z); m.box(0.3, 0.02, 0.02, M.darkSteel, x+0.22, y+1.0, z+0.26); } }

// ================= 配置 =================
function buildInterior(){
  const g1 = floorGroup(1), g2 = floorGroup(2), g3 = floorGroup(3); const lv = BLD.lv;
  const eqG = new THREE.Group(); eqG.name = "equipment"; eqG.userData.layer = "equipment"; g1.add(eqG);
  const F1 = new Merger(), F2 = new Merger(), F3 = new Merger();   // 什器（静的）
  const builders = { mc5:makeMC5, hmc:makeHMC, lathe:makeLathe, gantry:makeGantry, edm:makeEDM, grind:makeGrinder, bench:makeBench, dock:makeDock, testcell:makeTestCell, cmm:makeCMM, elab:makeElab, toolroom:makeToolroom, hil:makeHIL, server:makeServer, agv:makeAGV, crane:()=>makeCraneDetailed(BLD.zh - BLD.z0 - 2.7),
    robotcell: ()=>makeRobotCell(false), rack: ()=>makeRack(3,4), assembly: ()=>makeAssembly("A") };
  for (const e of EQUIP){
    let b = builders[e.kind]; if (!b) continue;
    if (e.id==="RC-02") b = ()=>makeRobotCell(true); if (e.id==="AS-B") b = ()=>makeAssembly("B"); if (e.zone==="recv") b = ()=>makeRack(4,4);
    if (e.kind==="bigdoor") continue;
    const grp = b(); compactGroup(grp); const floorIdx = ZONES.find(z=>z[0]===e.zone)?.[2] ?? 1; const y = lv[floorIdx-1];
    grp.position.set(e.x, e.kind==="crane"? BLD.craneRail+0.62 : y, e.z); grp.rotation.y = e.rot||0; tagEq(grp, e);
    (floorIdx===1? eqG : floorGroup(floorIdx)).add(grp);
    if (e.kind!=="agv" && e.kind!=="crane"){ const lb = makeLabel(e.id+"  "+e.name, { scale:0.7, bg:"rgba(13,17,23,0.65)" }); lb.position.set(0, (e.kind==="gantry"? 7.2 : e.kind==="testcell"? 6.8 : 4.0), 0); lb.userData.kind = "eq"; lb.userData.floor = floorIdx; grp.add(lb); }
  }
  // 大扉のタグ（ピック用に薄い当たり板）
  { const e = EQUIP.find(e=>e.kind==="bigdoor"); const grp = new THREE.Group(); grp.position.set(e.x, 0, e.z); const hit = mesh(G.box(0.3, 7, 8), M.darkSteel, 0, 3.5, 0, {cast:false}); hit.material = new THREE.MeshBasicMaterial({visible:false}); grp.add(hit); tagEq(grp, e); eqG.add(grp); }

  // ---- ホール床のライン・安全表示 ----
  const L = new Merger(); const { x0, x1, z0, zh } = BLD;
  L.box(x1-x0-2, 0.015, 0.12, M.line, 0, 0.07, -16.2); L.box(x1-x0-2, 0.015, 0.12, M.line, 0, 0.07, -11.8);   // 中央通路 4m
  for (const x of [-12, 4, 20, 36]) { L.box(0.12, 0.015, zh-z0-2, M.line, x, 0.07, (z0+zh)/2); }                   // ベイ境界
  for (let x=x0+2; x<x1-2; x+=2) L.box(1.0, 0.015, 0.12, std(0x3fb950), x+0.5, 0.072, -10.5);                      // 歩行者通路（緑破線）
  for (let i=0;i<6;i++) L.box(0.12, 0.015, 5, M.line, 38+i*1.0, 0.07, -14);                                        // ドック前ハッチング
  for (const x of cols_(BLD)) { for (const z of [z0+0.6, zh-0.6]) { L.box(0.76, 1.0, 0.76, M.safetyYellow, x, 0, z); L.box(0.78, 0.12, 0.78, M.blackMatte, x, 0.3, z); L.box(0.78, 0.12, 0.78, M.blackMatte, x, 0.6, z); L.box(0.3, 0.6, 0.2, M.pipeRed, x+0.5, 1.2, z-0.2); } }
  for (const [x,z] of [[42,-28],[42,-20],[42,-12]]) L.cyl(0.1, 1.0, M.safetyYellow, x, 0, z, 8);
  L.flush(g1, { name:"floorLines", layer:"markings", cast:false });

  // ---- 1F ロビー・ショールーム ----
  F1.box(4.0, 1.1, 0.8, M.timber, -40, 0, 8); F1.box(4.2, 0.05, 0.9, M.deskWhite, -40, 1.1, 8); sofaSet(F1, -34, 13, 0, 0); sofaSet(F1, -34, 5, 0, Math.PI); plantBig(F1, -42.5, 15, 0); plantBig(F1, -31, 16, 0);
  F1.box(5, 2.4, 0.08, M.monitor, -37, 1.0, 16.8); F1.box(4.8, 2.2, 0.02, M.screen, -37, 1.1, 16.75);
  F1.box(5.0, 0.4, 3.0, std(0xe4e4e0), -23, 0, 10); const demo = makeLathe(); demo.position.set(-23, 0.4, 10); demo.rotation.y = Math.PI; g1.add(demo);    // 実機展示（開発機スケールモデル代替）
  F1.box(1.2, 1.0, 0.8, std(0xe4e4e0), -27.5, 0, 14); F1.box(1.0, 0.7, 0.03, M.screen, -27.5, 1.0, 13.6);   // 説明パネル
  for (const x of [-20, -17]) plantBig(F1, x, 16.5, 0);
  lockerRow(F1, 29, 35, 16.5, 0); F1.box(2.2, 0.75, 0.9, M.desk, 32, 0, 6); for (const dz of [-0.8,0.8]) F1.box(0.46, 0.45, 0.46, M.chair, 32, 0, 6+dz);  // 休憩・更衣
  // 受入検査
  for (let i=0;i<3;i++){ F1.box(1.1, 0.14, 1.1, M.pallet, 18+i*1.6, 0, 14); F1.box(0.9, 0.7, 0.9, M.box, 18+i*1.6, 0.14, 14); } F1.box(3.0, 0.9, 1.2, M.steel, 23, 0, 6); F1.box(0.6, 0.4, 0.05, M.screen, 23, 1.0, 5.6); F1.box(0.5, 0.5, 0.5, M.machineWhite, 25.5, 0.9, 6.5);
  F1.flush(g1, { name:"furn1", layer:"furniture" });

  // ---- 2F ----
  for (let r=0;r<2;r++) for (let c=0;c<7;c++) deskCluster(F2, -33+c*3.8, 6.0+r*6.5, true);   // ソフト 56席
  for (let c=0;c<2;c++) for (let r=0;r<2;r++) deskCluster(F2, 15+c*4.2, 6.0+r*6.5, true);                             // 制御・組込 16席
  meetingRoom(F2, 2, 7, 2, 18, 0); meetingRoom(F2, 7, 12, 2, 18, 0);
  sofaSet(F2, -10, 15.5, 0, 0); plantBig(F2, -36, 16, 0); plantBig(F2, -8, 16.5, 0); plantBig(F2, 24, 16.5, 0);
  for (const x of [34.5, 35.5]) { F2.box(0.9, 2.2, 0.9, std(0x4a5560), x, 0, 15); }
  // 2F テラス 什器（木ベンチ・テーブル）
  for (const x of [-30, -10, 10, 30]){ F2.box(2.0, 0.05, 0.8, M.timber, x, 0.7, 20.4); F2.box(0.1, 0.7, 0.7, M.darkSteel, x-0.9, 0, 20.4); F2.box(0.1, 0.7, 0.7, M.darkSteel, x+0.9, 0, 20.4); for (const dx of [-0.6,0.6]) F2.box(0.4, 0.45, 0.4, M.chair, x+dx, 0, 19.3); }
  F2.flush(g2, { name:"furn2", layer:"furniture" }); g2.children.filter(c=>c.name==="furn2").forEach(c=>c.position.y = lv[1]);

  // ---- 3F ----
  for (let r=0;r<2;r++) for (let c=0;c<5;c++) deskCluster(F3, -33+c*4.6, 6.0+r*6.5, true);     // 設計 40席
  meetingRoom(F3, -10, -3, 2, 18, 0); meetingRoom(F3, -3, 4, 2, 18, 0);
  for (let c=0;c<3;c++) deskCluster(F3, 6.5+c*3.4, 9.5, true);                                 // 役員・管理 12席
  for (let r=0;r<2;r++) for (let c=0;c<5;c++) cafeTable(F3, 18.5+c*3.4, 6.0+r*6.0, 0);          // カフェテリア
  F3.box(6.0, 1.0, 0.9, M.timber, 28, 0, 16.5); F3.box(6.2, 0.05, 1.0, M.deskWhite, 28, 1.0, 16.5); F3.box(1.0, 0.6, 0.6, std(0xd8dcdf,{metalness:0.4}), 30, 1.05, 16.5);
  plantBig(F3, 16.5, 16.5, 0); plantBig(F3, 35, 16.5, 0); plantBig(F3, -36, 16.5, 0); sofaSet(F3, 12, 15.5, 0, 0);
  F3.flush(g3, { name:"furn3", layer:"furniture" }); g3.children.filter(c=>c.name==="furn3").forEach(c=>c.position.y = lv[2]);

  // ---- MEP（ダクト・ケーブルラック・配管・照明）----
  const P = new Merger(); const W = x1-x0;
  for (const z of [-22, -6]){ P.cyl(0.45, W-4, M.duct, 0, 12.3, z, 20, [0,0,Math.PI/2]); for (let x=x0+6; x<x1-4; x+=8){ P.cyl(0.2, 0.8, M.duct, x, 11.5, z, 12); P.box(0.9, 0.08, 0.9, M.duct, x, 11.4, z); } }
  for (const z of [z0+1.9, zh-1.9]){ P.box(W-2, 0.1, 0.5, M.tray, 0, 11.6, z); P.box(W-2, 0.1, 0.5, M.tray, 0, 12.4, z); }
  P.cyl(0.06, W-2, M.pipeBlue, 0, 9.0, z0+2.0, 8, [0,0,Math.PI/2]); P.cyl(0.06, W-2, M.pipeBlue, 0, 9.0, zh-2.0, 8, [0,0,Math.PI/2]);
  P.cyl(0.08, W-2, M.pipeRed, 0, 12.9, z0+2.4, 8, [0,0,Math.PI/2]); P.cyl(0.08, W-2, M.pipeRed, 0, 12.9, zh-2.4, 8, [0,0,Math.PI/2]);
  for (const e of EQUIP.filter(e=>["mc5","hmc","lathe","gantry","edm","grind","robotcell"].includes(e.kind))) { const zr = e.z<-14? z0+2.0 : zh-2.0; P.cyl(0.03, 9.0-2.5, M.pipeBlue, e.x+1.5, 2.5, zr, 6); P.cyl(0.03, Math.abs(e.z-zr), M.pipeBlue, e.x+1.5, 2.5, (e.z+zr)/2, 6, [Math.PI/2,0,0]); }
  // 照明（ホール：ハイベイ列 ／ オフィス：ライン照明）
  const lampI = []; for (const z of [-26, -19, -12, -5]) for (let x=x0+4; x<x1; x+=6) lampI.push([x, 11.2, z, 1.2, 0.08, 0.3]);
  for (let x=x0+3; x<x1; x+=4) for (const z of [5, 9, 13]) { lampI.push([x, lv[1]-0.72, z, 3.0, 0.05, 0.15]); lampI.push([x, lv[2]-0.72, z, 3.0, 0.05, 0.15]); lampI.push([x, 13.4, z, 3.0, 0.05, 0.15]); }
  for (let x=x0+3; x<x1; x+=4) lampI.push([x, lv[1]-0.72, 20, 0.3, 0.05, 0.3]);
  for (const [x,y,z,w,h,d] of lampI) P.box(w, h, d, M.lamp, x, y, z);
  P.flush(g1, { name:"mep", layer:"mep", cast:false });
}
function cols_(b){ const a=[]; for (let x=b.x0; x<=b.x1+0.01; x+=b.grid) a.push(x); return a; }
