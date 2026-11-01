// ================= 天井側の設備：精緻版クレーン・ジブクレーン・ツールレール・エネルギーブーム・ガントリーローダ・レーザー投影・カメラ =================
const M2 = {
  alu:   std(0xd7dbe0, { roughness:0.35, metalness:0.7 }),
  rubber:std(0x1a1c1f, { roughness:0.95 }),
  hose:  std(0x2f7fd6, { roughness:0.6 }),
  hoseR: std(0xd13b3b, { roughness:0.6 }),
  cable: std(0x202226, { roughness:0.8 }),
  green: new THREE.MeshStandardMaterial({ color:0x2bff7a, emissive:0x2bff7a, emissiveIntensity:1.2, transparent:true, opacity:0.85 }),
  lens:  std(0x1b2a44, { roughness:0.1, metalness:0.5 }),
  orange:std(0xf08a24, { roughness:0.5 }),
  led:   new THREE.MeshStandardMaterial({ color:0x58a6ff, emissive:0x58a6ff, emissiveIntensity:1.0 }),
};

// ---- 天井クレーン（ダブルガーダ・歩廊・フェストゥーン・巻上ドラム・フックブロック）----
function makeCraneDetailed(span){
  const g = new THREE.Group(); const L = span;
  for (const dx of [-1.1, 1.1]){ boxAt(g, 0.55, 1.3, L, M.yellow, dx, 0, 0); boxAt(g, 0.75, 0.06, L, M.darkSteel, dx, 1.3, 0); boxAt(g, 0.75, 0.06, L, M.darkSteel, dx, -0.06, 0); }
  for (let z=-L/2+1; z<L/2; z+=2.0) boxAt(g, 2.1, 0.12, 0.08, M.yellow, 0, 1.3, z);            // ガーダ間つなぎ（トロリーレール受け）
  for (const dx of [-0.75, 0.75]) boxAt(g, 0.08, 0.1, L, M.darkSteel, dx, 1.42, 0);            // トロリーレール
  // 歩廊（片側）＋手摺
  boxAt(g, 0.8, 0.05, L, M.steel, -1.85, 1.28, 0); for (let z=-L/2+0.5; z<L/2; z+=1.5) boxAt(g, 0.05, 1.0, 0.05, M.darkSteel, -2.2, 1.33, z);
  boxAt(g, 0.05, 0.04, L, M.darkSteel, -2.2, 2.3, 0); boxAt(g, 0.05, 0.04, L, M.darkSteel, -2.2, 1.85, 0);
  // エンドトラック・車輪・走行モータ
  for (const z of [-L/2, L/2]){ boxAt(g, 3.6, 0.6, 0.9, M.darkSteel, 0, -0.45, z); for (const dx of [-1.45, 1.45]) cylAt(g, 0.28, 0.32, M.darkSteel, dx, -0.55, z, {rot:[0,0,Math.PI/2], seg:18});
    cylAt(g, 0.16, 0.5, M.machineDark, 1.9, -0.2, z, {rot:[0,0,Math.PI/2], seg:12}); boxAt(g, 0.5, 0.5, 0.6, M.safetyYellow, -2.1, -0.75, z); }
  // トロリー：フレーム・巻上ドラム・モータ・減速機・ロープ2本・フックブロック（シーブ付）
  const trolley = new THREE.Group(); trolley.userData.dyn = true; g.add(trolley);
  boxAt(trolley, 2.4, 0.35, 1.9, M.darkSteel, 0, 1.45, 0); for (const dx of [-0.75, 0.75]) for (const dz of [-0.7, 0.7]) cylAt(trolley, 0.14, 0.12, M.darkSteel, dx, 1.4, dz, {rot:[0,0,Math.PI/2], seg:12});
  const drum = cylAt(trolley, 0.3, 1.4, M.machineDark, 0.2, 1.95, -0.35, {rot:[0,0,Math.PI/2], seg:20}); for (let i=0;i<12;i++) cylAt(trolley, 0.31, 0.03, M.steel, -0.45+i*0.11, 1.95, -0.35, {rot:[0,0,Math.PI/2], seg:20});
  cylAt(trolley, 0.2, 0.6, M.machineBlue, 1.3, 1.95, -0.35, {rot:[0,0,Math.PI/2], seg:14}); boxAt(trolley, 0.5, 0.5, 0.5, M.machineDark, -1.0, 1.75, -0.35);
  boxAt(trolley, 0.5, 0.6, 0.8, M.machineWhite, 0.4, 1.8, 0.5); boxAt(trolley, 0.3, 0.2, 0.2, std(0xf2c230,{emissive:0xf2c230,emissiveIntensity:0.8}), 0.4, 2.4, 0.5);
  const ropes = [cylAt(trolley, 0.018, 1, M.cable, -0.25, 0, -0.35, {seg:6}), cylAt(trolley, 0.018, 1, M.cable, 0.25, 0, -0.35, {seg:6})]; ropes.forEach(r=>r.userData.dyn=true);
  const hook = new THREE.Group(); hook.position.set(0, 0, -0.35); trolley.add(hook);
  boxAt(hook, 0.7, 0.55, 0.3, M.yellow, 0, -0.1, 0); for (const dx of [-0.25, 0.25]) cylAt(hook, 0.2, 0.08, M.darkSteel, dx, 0.05, 0, {rot:[Math.PI/2,0,0], seg:16});
  cylAt(hook, 0.07, 0.4, M.darkSteel, 0, -0.5, 0, {seg:10}); const hk = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 18, Math.PI*1.4), M.darkSteel); hk.position.set(0, -0.72, 0); hk.rotation.z = Math.PI*0.8; hk.castShadow = true; hook.add(hk);
  // フェストゥーン（C レール＋ケーブルループ）
  boxAt(g, 0.08, 0.1, L, M.alu, 1.85, 1.0, 0);
  const loops = new THREE.Group(); g.add(loops); loops.userData.dyn = true;
  for (let i=0;i<7;i++){ const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 16, Math.PI), M2.cable); t.rotation.z = Math.PI; t.rotation.y = Math.PI/2; t.position.set(1.85, 0.95, 0); loops.add(t); }
  // 制御盤・警告灯・ホーン
  boxAt(g, 1.3, 0.9, 0.5, M.machineWhite, -1.1, 1.33, L/2-1.6); boxAt(g, 0.25, 0.35, 0.25, std(0xff3b3b,{emissive:0xff3b3b,emissiveIntensity:0.9}), 1.1, 1.36, L/2-0.6); cylAt(g, 0.12, 0.3, M.darkSteel, -0.4, 1.36, L/2-0.6, {rot:[Math.PI/2,0,0], seg:10});
  for (let i=0;i<6;i++) boxAt(g, 2.2, 0.08, 0.06, M.yellow, 0, 1.36, -L/2+2+i*(L-4)/5);
  g.userData.trolley = trolley; g.userData.ropes = ropes; g.userData.hook = hook; g.userData.drum = drum; g.userData.loops = loops; g.userData.span = L;
  return g;
}

// ---- ジブクレーン（柱取付 1 t）----
function makeJib(){ const g = new THREE.Group();
  cylAt(g, 0.22, 4.6, M.yellow, 0, 0, 0, {seg:16}); cylAt(g, 0.45, 0.06, M.darkSteel, 0, 0, 0, {seg:16}); for (let i=0;i<6;i++) cylAt(g, 0.04, 0.25, M.darkSteel, Math.cos(i)*0.36, 0, Math.sin(i)*0.36, {seg:6});
  const boom = new THREE.Group(); boom.position.y = 4.2; boom.userData.dyn = true; g.add(boom);
  boxAt(boom, 0.2, 0.3, 4.0, M.yellow, 0, -0.15, 2.0); boxAt(boom, 0.3, 0.05, 4.0, M.darkSteel, 0, 0.15, 2.0); boxAt(boom, 0.3, 0.05, 4.0, M.darkSteel, 0, -0.2, 2.0);
  boxAt(boom, 0.08, 0.08, 2.6, M.darkSteel, 0, 0.25, 1.3).rotation.x = -0.45;
  const tr = new THREE.Group(); tr.position.set(0, -0.2, 2.6); boom.add(tr); boxAt(tr, 0.35, 0.3, 0.4, M.machineDark, 0, -0.3, 0); boxAt(tr, 0.3, 0.5, 0.3, M.machineDark, 0, -0.8, 0);
  cylAt(tr, 0.012, 1.6, M.cable, 0, -2.4, 0, {seg:6}); boxAt(tr, 0.2, 0.25, 0.12, M.yellow, 0, -2.6, 0); const hk = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 14, Math.PI*1.4), M.darkSteel); hk.position.set(0, -2.7, 0); hk.rotation.z = Math.PI*0.8; tr.add(hk);
  g.userData.boom = boom; g.userData.trolley = tr; return g; }

// ---- ツールバランサー・レール（天井吊り、ナットランナ／電動工具が吊下がる）----
function makeToolRail(len, hangerLen=6.0, tools=3){ const g = new THREE.Group();
  boxAt(g, len, 0.16, 0.12, M2.alu, 0, 0, 0); boxAt(g, len, 0.03, 0.2, M2.alu, 0, -0.03, 0);
  for (let x=-len/2+1; x<=len/2-1; x+=4){ cylAt(g, 0.025, hangerLen, M.steel, x, 0.16, 0, {seg:6}); boxAt(g, 0.25, 0.06, 0.25, M.darkSteel, x, 0.1, 0); }
  boxAt(g, 0.06, 0.08, len, M2.cable, 0.15, 0.1, 0).rotation.y = Math.PI/2;   // 電源・エアのフラットケーブルダクト
  const trolleys = [];
  for (let i=0;i<tools;i++){ const t = new THREE.Group(); t.userData.dyn = true; t.position.x = -len/2 + (i+0.5)*len/tools; g.add(t);
    boxAt(t, 0.3, 0.18, 0.22, M.darkSteel, 0, -0.22, 0); for (const dx of [-0.1,0.1]) cylAt(t, 0.05, 0.03, M.darkSteel, dx, -0.1, 0.12, {rot:[Math.PI/2,0,0], seg:10});
    cylAt(t, 0.12, 0.28, M.safetyYellow, 0, -0.55, 0, {seg:14}); cylAt(t, 0.04, 0.1, M.darkSteel, 0, -0.65, 0, {seg:8});   // スプリングバランサ
    const cab = cylAt(t, 0.012, 1.9, M2.cable, 0, -2.55, 0, {seg:6}); const hose = cylAt(t, 0.02, 2.3, M2.hose, 0.08, -2.9, 0.05, {seg:6});
    const tool = new THREE.Group(); tool.position.y = -2.6; t.add(tool);                                                       // 電動ナットランナ（角度式）
    cylAt(tool, 0.045, 0.5, M.machineDark, 0, -0.5, 0, {seg:10}); boxAt(tool, 0.09, 0.12, 0.2, M.machineDark, 0, -0.62, 0.05); cylAt(tool, 0.05, 0.12, M.yellow, 0, -0.28, 0, {seg:10});
    boxAt(tool, 0.035, 0.18, 0.035, std(0xc8ccd0,{metalness:0.8,roughness:0.3}), 0, -0.68, 0); boxAt(tool, 0.06, 0.03, 0.03, M2.led, 0, -0.35, 0.05);
    trolleys.push({ t, tool, phase: i*1.7 }); }
  g.userData.trolleys = trolleys; g.userData.len = len; return g; }

// ---- エネルギーサプライブーム（関節式：電源・圧空・LAN をワークへ届ける）----
function makeEnergyBoom(hangerLen=5.0){ const g = new THREE.Group();
  boxAt(g, 0.5, 0.08, 0.5, M.darkSteel, 0, 0, 0); cylAt(g, 0.09, hangerLen, M.steel, 0, 0.08, 0, {seg:12});
  const a1 = new THREE.Group(); a1.userData.dyn = true; g.add(a1); boxAt(a1, 0.16, 0.2, 2.4, M.white, 0, -0.3, 1.2); cylAt(a1, 0.14, 0.4, M.darkSteel, 0, -0.4, 0, {seg:14});
  const a2 = new THREE.Group(); a2.position.set(0, -0.2, 2.4); a1.add(a2); boxAt(a2, 0.14, 0.18, 2.0, M.white, 0, -0.18, 1.0); cylAt(a2, 0.12, 0.3, M.darkSteel, 0, -0.25, 0, {seg:14});
  const head = new THREE.Group(); head.position.set(0, -0.3, 2.0); a2.add(head);
  cylAt(head, 0.07, 1.4, M.steel, 0, -1.4, 0, {seg:10}); boxAt(head, 0.5, 0.7, 0.3, M.machineWhite, 0, -2.1, 0);
  for (let i=0;i<3;i++) cylAt(head, 0.035, 0.08, M2.hose, -0.15+i*0.15, -2.15, 0.15, {rot:[Math.PI/2,0,0], seg:8}); for (let i=0;i<2;i++) boxAt(head, 0.12, 0.1, 0.03, M.blackMatte, -0.1+i*0.2, -1.75, 0.15); boxAt(head, 0.12, 0.03, 0.02, M2.led, 0, -1.5, 0.16);
  cylAt(head, 0.02, 3.0, M2.hose, 0.1, -4.9, 0.1, {seg:6}); cylAt(head, 0.02, 3.0, M2.cable, -0.1, -4.9, 0.1, {seg:6});
  g.userData.a1 = a1; g.userData.a2 = a2; return g; }

// ---- 天井ガントリーローダ（MC 列に素材・完成品を無人供給）----
function makeGantryLoader(len, span, stations){ const g = new THREE.Group(); const y = 5.6;
  for (const dz of [-span/2, span/2]){ boxAt(g, len, 0.5, 0.3, M.machineWhite, 0, y, dz); boxAt(g, len, 0.06, 0.08, M.steel, 0, y+0.5, dz); boxAt(g, len, 0.08, 0.4, M2.cable, 0, y-0.1, dz+0.3*Math.sign(dz));
    for (const x of [-len/2+0.3, len/2-0.3]) { boxAt(g, 0.3, y, 0.3, M.machineWhite, x, 0, dz); boxAt(g, 0.9, 0.05, 0.9, M.darkSteel, x, 0, dz); boxAt(g, 0.6, 0.4, 0.5, M.safetyYellow, x, 0.05, dz+Math.sign(dz)*0.45); } }
  const bridge = new THREE.Group(); bridge.userData.dyn = true; bridge.position.y = y+0.56; g.add(bridge);
  boxAt(bridge, 0.5, 0.5, span+0.8, M.machineWhite, 0, 0, 0); for (const dz of [-span/2, span/2]) boxAt(bridge, 1.2, 0.3, 0.5, M.machineDark, 0, -0.3, dz);
  boxAt(bridge, 0.35, 0.35, 0.35, M.machineBlue, 0.5, 0.5, -span/2+0.6);
  const sad = new THREE.Group(); sad.position.z = 0; bridge.add(sad); boxAt(sad, 0.9, 0.7, 0.9, M.machineDark, 0, 0.2, 0);
  const mast = new THREE.Group(); mast.position.y = 0.2; sad.add(mast); boxAt(mast, 0.3, 4.2, 0.3, M.steel, 0, -3.6, 0); boxAt(mast, 0.6, 0.4, 0.6, M.machineWhite, 0, -4.0, 0);
  const grip = new THREE.Group(); grip.position.y = -4.0; mast.add(grip); for (const dx of [-0.25,0.25]) boxAt(grip, 0.08, 0.5, 0.3, M.darkSteel, dx, -0.5, 0); cylAt(grip, 0.1, 0.2, M.machineBlue, 0, -0.2, 0, {seg:10});
  const work = boxAt(grip, 0.45, 0.3, 0.3, M.steel, 0, -0.5, 0);
  g.userData = { bridge, sad, mast, grip, work, stations:stations.map(x=>x), len, span }; return g; }

// ---- レーザー投影（据付基準・部品位置を床に描く）----
function makeLaserProjector(w, d){ const g = new THREE.Group();
  boxAt(g, 0.5, 0.25, 0.5, M.machineWhite, 0, -0.25, 0); cylAt(g, 0.08, 0.1, M2.lens, 0, -0.35, 0, {seg:12}); cylAt(g, 0.03, 0.4, M.steel, 0, 0, 0, {seg:6});
  const lines = new THREE.Group(); lines.userData.dyn = true; g.add(lines);
  const yF = -1;  // 床（後で位置合わせ）
  const mk = (x,z,lx,lz)=>{ const m = boxAt(lines, lx, 0.012, lz, M2.green, x, yF, z); m.castShadow = false; m.receiveShadow = false; return m; };
  mk(0, -d/2, w, 0.05); mk(0, d/2, w, 0.05); mk(-w/2, 0, 0.05, d); mk(w/2, 0, 0.05, d); mk(0, 0, w*0.3, 0.04); mk(0, 0, 0.04, d*0.3);
  for (const [x,z] of [[-w/3,-d/3],[w/3,-d/3],[-w/3,d/3],[w/3,d/3]]) { const r = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.3, 20), M2.green); r.rotation.x = -Math.PI/2; r.position.set(x, yF+0.012, z); lines.add(r); }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.55, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color:0x2bff7a, transparent:true, opacity:0.05, side:THREE.DoubleSide, depthWrite:false })); beam.position.y = -0.5; g.add(beam);
  g.userData.lines = lines; g.userData.beam = beam; return g; }
function placeLaser(g, yCeil, yFloor, w, d){ g.position.y = yCeil; const h = yCeil - yFloor; g.userData.lines.position.y = -h + 1.0 + 0.09; g.userData.beam.scale.y = h; g.userData.beam.position.y = -h/2; }

// ---- 天井カメラ・UWB アンカー（人・AGV・部品の位置をリアルタイムで把握）----
function makeCamNode(){ const g = new THREE.Group(); cylAt(g, 0.03, 0.8, M.steel, 0, -0.8, 0, {seg:6}); boxAt(g, 0.18, 0.12, 0.28, M.machineWhite, 0, -0.95, 0); cylAt(g, 0.05, 0.08, M2.lens, 0, -0.93, 0.16, {rot:[Math.PI/2,0,0], seg:10});
  cylAt(g, 0.05, 0.14, M.white, 0.25, -0.9, 0, {seg:8}); cylAt(g, 0.008, 0.25, M.darkSteel, 0.25, -1.14, 0, {seg:4}); boxAt(g, 0.04, 0.02, 0.02, M2.led, 0.1, -0.86, 0.14); return g; }

// ---- 天井設備の稼働アニメ ----
function animOverhead(kind, g, phase=0){
  if (kind==="toolRail"){ ANIM.push({ update(t){ for (const tr of g.userData.trolleys){ const s = t*0.25+tr.phase; tr.t.position.x = (-g.userData.len/2 + 1.5) + (g.userData.len-3)*(0.5+0.5*Math.sin(s*0.6+tr.phase)); tr.tool.rotation.z = Math.sin(s*2.1)*0.12; tr.tool.position.y = -2.6 + Math.sin(s*1.3)*0.25; } } }); }
  else if (kind==="boom"){ ANIM.push({ update(t){ g.userData.a1.rotation.y = Math.sin(t*0.15+phase)*0.9; g.userData.a2.rotation.y = Math.sin(t*0.22+phase)*0.8; } }); }
  else if (kind==="jib"){ ANIM.push({ update(t){ g.userData.boom.rotation.y = Math.sin(t*0.2+phase)*1.1; g.userData.trolley.position.z = 2.0+Math.sin(t*0.35+phase)*1.2; } }); }
  else if (kind==="gantryLoader"){ const u = g.userData; const st = u.stations.length? u.stations : [0]; ANIM.push({ update(t){ const cyc = 12, k = ((t*0.5+phase)/cyc) % st.length, i = Math.floor(k), f = k - i; const xa = st[i], xb = st[(i+1)%st.length];
      const move = f < 0.5 ? Math.min(1, f/0.4) : 1; u.bridge.position.x = lerp(xa, xb, move); const down = f > 0.55 && f < 0.95 ? Math.sin((f-0.55)/0.4*Math.PI) : 0; u.mast.position.y = 0.2 - down*2.2; u.work.visible = (i % 2 === 0); u.sad.position.z = Math.sin(t*0.1+phase)*0.8; } }); }
  else if (kind==="laser"){ ANIM.push({ update(t){ g.userData.lines.visible = (Math.floor(t*2) % 7) !== 0; } }); }
  else if (kind==="crane"){ const u = g.userData; ANIM.push({ update(t){ const s = t*0.12 + phase; u.trolley.position.z = Math.sin(s*1.7)*(u.span/2-3); const L = 3.5 + 2.5*(0.5+0.5*Math.sin(s*2.3)); u.ropes.forEach(r=>{ r.scale.y = L; r.position.y = 1.3 - L/2; }); u.hook.position.y = 1.3 - L; u.drum.rotation.x = t*1.5;
      const n = u.loops.children.length; const zt = u.trolley.position.z; u.loops.children.forEach((lp, i)=>{ lp.position.z = lerp(u.span/2-0.8, zt+0.6, i/(n-1)); lp.scale.setScalar(0.5 + 0.5*Math.min(1, Math.abs(u.span/2-0.8-zt)/12)); }); } }); }
}
