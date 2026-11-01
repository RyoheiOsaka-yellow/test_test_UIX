// ================= 敷地・周辺環境（大田区 工業地域） =================
const LAYERS = {};  // name -> Group
function layer(name){ if(!LAYERS[name]){ const g = new THREE.Group(); g.name = name; LAYERS[name] = g; scene.add(g); } return LAYERS[name]; }

function buildSite(){
  const site = layer("site"), ctx = layer("context"), green = layer("green");
  const mg = new Merger();
  const hw = SITE.w/2, hd = SITE.d/2;  // 60, 40

  // ---- 広域地面 ----
  const ground = mesh(G.plane(1600,1600), std(0x9a9c98,{roughness:1}), 0, -0.05, 0, { rot:[-Math.PI/2,0,0], cast:false }); ground.name="ground"; ctx.add(ground);

  // ---- 前面道路（南）幅員12m、歩道3m ----
  const road = mesh(G.plane(SITE.w+300, 12), M.asphalt, 0, 0.0, hd+3+6, { rot:[-Math.PI/2,0,0], cast:false }); ctx.add(road);
  for (const z of [hd+1.5, hd+12+1.5+3]){ const sw = mesh(G.plane(SITE.w+300, 3), M.paving, 0, 0.12, z, { rot:[-Math.PI/2,0,0], cast:false }); ctx.add(sw);
    mg.box(SITE.w+300, 0.15, 0.25, M.curb, 0, 0, z + (z<hd+5? 1.5 : -1.5)); }
  // 東側道路（トラック進入）幅8m
  const roadE = mesh(G.plane(8, SITE.d+60), M.asphalt, hw+2+4, 0.0, 0, { rot:[-Math.PI/2,0,0], cast:false }); ctx.add(roadE);
  const swE = mesh(G.plane(2, SITE.d+60), M.paving, hw+1, 0.12, 0, { rot:[-Math.PI/2,0,0], cast:false }); ctx.add(swE);
  // 車線・横断歩道
  for (let x=-hw-140; x<hw+140; x+=8) mg.box(4, 0.02, 0.15, M.lineWhite, x+2, 0.01, hd+3+6);
  for (let i=0;i<12;i++) mg.box(0.45, 0.02, 10, M.lineWhite, -hw-4 + i*1.0, 0.012, hd+3+6);
  for (let i=0;i<12;i++) mg.box(0.45, 0.02, 10, M.lineWhite, 22 + i*1.0, 0.012, hd+3+6);
  // 街灯・電柱・架線（大田区の街路らしさ）
  const poles = [];
  for (let x=-hw-130; x<=hw+130; x+=30){ const z = hd+12+3+2.0; mg.cyl(0.18, 11, M.pole, x, 0, z, 10); mg.box(2.2, 0.12, 0.12, M.pole, x, 10.2, z); mg.box(2.2, 0.12, 0.12, M.pole, x, 9.4, z); poles.push([x,z]); }
  const wireMat = new THREE.LineBasicMaterial({ color:0x2a2a2a });
  for (const dy of [10.2, 9.4]) for (const dx of [-1, 1]){ const pts = []; for (const [x,z] of poles){ pts.push(new THREE.Vector3(x+dx*0.9, dy, z)); if (poles.indexOf) {} }
    const geo = new THREE.BufferGeometry().setFromPoints(pts); const l = new THREE.Line(geo, wireMat); ctx.add(l); }
  for (let x=-hw+10; x<hw; x+=24){ mg.cyl(0.12, 8, M.darkSteel, x, 0, hd+1.2, 8); mg.box(1.6, 0.12, 0.3, M.darkSteel, x+0.8, 8, hd+1.2); mg.box(0.5, 0.12, 0.25, M.lamp, x+1.4, 7.9, hd+1.2); }

  // ---- 隣接建物（低層工場・倉庫・集合住宅の群）----
  const rnd = sRand("ota-neighbors");
  const nb = new Merger();
  function block(x, z, w, d, h, kind){
    const mat = kind===0? M.neighbor : kind===1? M.neighbor2 : std(0xdedbd3,{roughness:0.85});
    nb.box(w, h, d, mat, x, 0, z);
    if (kind===0){ // 鋸屋根工場
      const n = Math.max(1, Math.round(w/8)); for (let i=0;i<n;i++) nb.boxC(w/n*0.98, 2.2, d*0.98, M.neighborRoof, x - w/2 + w/n*(i+0.5), h+0.9, z, [0,0,0.25]);
    } else if (kind===1){ nb.box(w*0.96, 0.6, d*0.96, M.neighborRoof, x, h, z); nb.box(3, 2.4, 3, M.neighbor2, x+w/4, h+0.6, z+d/4); }
    else { for (let f=1; f<h/3; f++) for (let i=0;i<Math.floor(w/4);i++) nb.box(2.2, 1.4, 0.15, M.glassTint, x-w/2+2+i*4, f*3+1.0, z+d/2+0.05); nb.box(w*0.96, 0.4, d*0.96, M.neighborRoof, x, h, z); }
  }
  const cells = [];
  for (let gx=-6; gx<=6; gx++) for (let gz=-5; gz<=5; gz++){
    const cx = gx*44, cz = gz*44;
    if (Math.abs(cx) < hw+22 && Math.abs(cz) < hd+22) continue;       // 自敷地＋道路帯を除外
    if (cz > hd && cz < hd+30) continue;
    const n = 1 + Math.floor(rnd()*2);
    for (let k=0;k<n;k++){ const w = 14+rnd()*22, d = 12+rnd()*22, kind = rnd()<0.5?0:(rnd()<0.6?1:2);
      const h = kind===2? 9+Math.floor(rnd()*5)*3 : 6+rnd()*6;
      block(cx + (k? 18:-6) + rnd()*4, cz + rnd()*8 - 4, w, d, h, kind); }
  }
  nb.flush(ctx, { name:"neighbors" });
  // 周辺街路の樹木（まばら）
  const treesCtx = []; for (let i=0;i<60;i++){ const x = -hw-140 + rnd()*(SITE.w+280), z = hd+16.5 + (rnd()<0.5? 0 : 0); if (Math.abs(x) < 10) continue; treesCtx.push([x, z, 0.7+rnd()*0.4]); }

  // ---- 敷地 ----
  const slab = mesh(G.plane(SITE.w, SITE.d), std(0xd9d7d0, { map:TEX.paving([48,32]), roughness:0.85 }), 0, 0.02, 0, { rot:[-Math.PI/2,0,0], cast:false }); slab.name="siteSlab"; site.add(slab);
  // 車路・駐車場・ヤードはアスファルト、建物まわりは明るいコンクリート舗装
  site.add(mesh(G.plane(16, SITE.d), M.asphalt, -hw+8, 0.03, 0, { rot:[-Math.PI/2,0,0], cast:false }));
  site.add(mesh(G.plane(16, SITE.d), M.asphalt, hw-8, 0.03, 0, { rot:[-Math.PI/2,0,0], cast:false }));
  site.add(mesh(G.plane(SITE.w-32, 10), M.asphalt, 0, 0.03, -hd+5, { rot:[-Math.PI/2,0,0], cast:false }));
  addClouds(ctx);
  // 前庭プラザ（舗装 + 芝 + 植栽帯）
  const plazaMat = std(0xd2cfc6, { map:TEX.paving([30,6]), roughness:0.85 });
  site.add(mesh(G.plane(SITE.w, 16), plazaMat, 0, 0.05, BLD.z1+6+2, { rot:[-Math.PI/2,0,0], cast:false }));
  const beds = [[-38, 33, 14, 5],[-14, 35, 16, 4],[8, 33, 14, 5],[32, 35, 16, 4],[-52,30,8,6]];
  for (const [x,z,w,d] of beds){ mg.box(w, 0.45, d, M.curb, x, 0, z); green.add(mesh(G.plane(w-0.4, d-0.4), M.grass, x, 0.46, z, { rot:[-Math.PI/2,0,0], cast:false })); }
  // ベンチ・ボラード・サイン
  for (const [x,z] of [[-30,28],[-6,28],[18,28],[40,28]]){ mg.box(2.4, 0.08, 0.5, M.timber, x, 0.42, z); mg.box(0.12, 0.4, 0.45, M.darkSteel, x-1, 0.05, z); mg.box(0.12, 0.4, 0.45, M.darkSteel, x+1, 0.05, z); }
  for (let x=-42; x<=42; x+=6) mg.cyl(0.12, 0.9, M.darkSteel, x, 0.05, hd-0.6, 10);
  mg.box(5, 2.2, 0.35, M.darkSteel, -50, 0.2, 36); mg.box(4.6, 1.6, 0.05, M.yellow, -50, 0.5, 35.8);
  const sign = makeLabel("YELLOW  FUSION FACTORY  OTA", { scale:0.8, color:"#111", bg:"rgba(246,203,47,0.95)" }); sign.position.set(-50, 2.9, 35.5); site.add(sign);

  // ---- 西側 駐車場 + ソーラーカーポート ----
  const px = -hw+8; // 中心 x=-52
  for (let z=-34; z<=34; z+=2.6){ mg.box(5.0, 0.02, 0.12, M.lineWhite, px-5.5, 0.03, z); mg.box(5.0, 0.02, 0.12, M.lineWhite, px+5.5, 0.03, z); }
  for (const cx of [px-5.5, px+5.5]){ for (let z=-33; z<=33; z+=11){ mg.cyl(0.18, 3.0, M.steel, cx, 0, z, 10); mg.box(0.3, 0.3, 5.2, M.steel, cx, 3.0, z); }
    mg.boxC(5.6, 0.12, 72, M.steel, cx, 3.35, 0, [0,0,0.08]); mg.boxC(5.4, 0.06, 71.6, M.solar, cx, 3.45, 0, [0,0,0.08]); }
  // 車（インスタンス）
  const carBody = new THREE.InstancedMesh(G.box(1.75, 0.6, 4.3), M.car, 40), carTop = new THREE.InstancedMesh(G.box(1.6, 0.55, 2.4), M.glassTint, 40);
  const carCols = [0xd8dde2, 0x24262a, 0x8a1c1c, 0xcfd3d6, 0x3a4c6b, 0xe8e8e8];
  let ci = 0; const tmp = new THREE.Object3D();
  for (const cx of [px-5.5, px+5.5]) for (let z=-33; z<=33; z+=2.6){ if (rnd() < 0.3) continue; if (ci>=40) break;
    tmp.position.set(cx, 0.55, z); tmp.rotation.set(0, Math.PI/2, 0); tmp.updateMatrix(); carBody.setMatrixAt(ci, tmp.matrix); carBody.setColorAt(ci, new THREE.Color(carCols[Math.floor(rnd()*carCols.length)]));
    tmp.position.set(cx-0.2, 1.12, z); tmp.updateMatrix(); carTop.setMatrixAt(ci, tmp.matrix); ci++; }
  carBody.count = ci; carTop.count = ci; carBody.castShadow = true; carBody.instanceMatrix.needsUpdate = true; carTop.instanceMatrix.needsUpdate = true; if (carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
  site.add(carBody); site.add(carTop);
  // 駐輪場
  for (let i=0;i<10;i++) mg.box(0.06, 0.8, 1.7, M.steel, -44.5 + i*0.7, 0.05, 30);

  // ---- 東側ヤード（トラック動線）・門 ----
  mg.box(0.5, 0.02, 60, M.lineWhite, 50, 0.03, 0); for (let z=-30; z<30; z+=6) mg.box(0.25, 0.02, 3, M.line, 55, 0.03, z);
  mg.box(0.4, 2.2, 0.4, M.darkSteel, 46, 0, hd); mg.box(0.4, 2.2, 0.4, M.darkSteel, 58, 0, hd); mg.box(11.6, 0.08, 0.08, M.steel, 52, 2.0, hd);
  // 北側：キュービクル・コンプレッサ室・屋外試験ヤードの庇
  for (let i=0;i<3;i++){ mg.box(3.2, 2.4, 1.6, std(0xbfc6cc,{metalness:0.4,roughness:0.5}), -36+i*3.6, 0.2, -36); mg.box(3.0, 0.1, 1.5, M.darkSteel, -36+i*3.6, 2.6, -36); }
  mg.box(8, 3.2, 4, M.wallMetal, -20, 0, -36); mg.box(8.4, 0.3, 4.4, M.darkSteel, -20, 3.2, -36);
  mg.cyl(0.9, 2.8, std(0xd8dcdf,{metalness:0.5,roughness:0.4}), -10, 0.2, -36.5, 20); mg.cyl(0.9, 2.8, std(0xd8dcdf,{metalness:0.5,roughness:0.4}), -7.5, 0.2, -36.5, 20);
  for (const x of [8, 20, 32]) { mg.cyl(0.2, 5, M.steel, x, 0, -33, 10); mg.cyl(0.2, 5, M.steel, x, 0, -39, 10); }
  mg.box(26, 0.25, 7, M.roofMetal, 20, 5, -36);
  // 外周フェンス（南面以外）
  for (let x=-hw; x<=hw; x+=4){ mg.box(0.08, 2.0, 0.08, M.fence, x, 0, -hd); }
  for (let z=-hd; z<=hd; z+=4){ mg.box(0.08, 2.0, 0.08, M.fence, -hw, 0, z); if (z<hd-8) mg.box(0.08, 2.0, 0.08, M.fence, hw, 0, z); }
  const fenceMesh = new THREE.MeshStandardMaterial({ map:TEX.mesh([30,1]), transparent:true, alphaTest:0.4, side:THREE.DoubleSide, color:0x8a9299, roughness:0.6, metalness:0.5 });
  site.add(mesh(G.plane(SITE.w, 2), fenceMesh, 0, 1, -hd, { cast:false })); site.add(mesh(G.plane(SITE.d, 2), fenceMesh, -hw, 1, 0, { ry:Math.PI/2, cast:false })); site.add(mesh(G.plane(SITE.d-8, 2), fenceMesh, hw, 1, -4, { ry:Math.PI/2, cast:false }));
  // 歩道境界の生垣
  for (const x of [-56, -47.5, 47.5, 56]) { mg.box(6, 1.0, 1.2, M.leaf, x, 0.1, hd-1.0); }

  mg.flush(site, { name:"siteStatic" });

  // ---- 樹木（インスタンス）----
  const trees = [];
  for (const [x,z,w,d] of beds) for (let i=0;i<Math.max(2, Math.floor(w/4)); i++) trees.push([x - w/2 + 2 + i*(w-4)/Math.max(1,Math.floor(w/4)-1||1), z + (rnd()-0.5)*(d-2), 0.9+rnd()*0.5]);
  for (let z=-32; z<=32; z+=8) trees.push([-45.5, z, 0.7+rnd()*0.3]);   // 駐車場との緩衝帯
  for (let x=-40; x<=40; x+=16) trees.push([x, -33.5, 0.8+rnd()*0.3]);   // 北側
  trees.push(...treesCtx);
  const trunkI = new THREE.InstancedMesh(G.cyl(0.14, 3.2, 8, 0.1), M.trunk, trees.length);
  const can1 = new THREE.InstancedMesh(G.sph(1.9, 12), M.leaf, trees.length), can2 = new THREE.InstancedMesh(G.sph(1.4, 10), M.leaf2, trees.length);
  const leafCols = [0x4f8a3c, 0x5f9a44, 0x6aa24a, 0x7fae4e, 0x4a7f3a, 0x8fb04a];
  trees.forEach(([x,z,s], i)=>{ const col = new THREE.Color(leafCols[i % leafCols.length]); tmp.rotation.set(0, i*1.7, 0); tmp.scale.set(s, s, s); tmp.position.set(x, 1.6*s, z); tmp.updateMatrix(); trunkI.setMatrixAt(i, tmp.matrix);
    tmp.scale.set(s*(0.9+(i%3)*0.1), s*(0.85+(i%2)*0.2), s); tmp.position.set(x, 4.2*s, z); tmp.updateMatrix(); can1.setMatrixAt(i, tmp.matrix); can1.setColorAt(i, col);
    tmp.scale.set(s, s, s); tmp.position.set(x+0.8*s, 5.2*s, z-0.5*s); tmp.updateMatrix(); can2.setMatrixAt(i, tmp.matrix); can2.setColorAt(i, col.clone().multiplyScalar(1.12)); });
  [trunkI, can1, can2].forEach(m => { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; green.add(m); });
  // ボラード照明（前庭の歩行路）・エントランス前の足元灯
  for (let x=-40; x<=40; x+=8){ mg.cyl(0.07, 0.9, M.darkSteel, x+2, 0.05, 26, 8); mg.cyl(0.075, 0.12, M.bollardLight, x+2, 0.85, 26, 8); }
  for (const [x,z] of [[-42,22.8],[-32,22.8],[-37,19]]) mg.box(0.3, 0.08, 0.3, M.bollardLight, x, 0.05, z);
  mg.flush(site, { name:"siteLights", cast:false });
  // 低木（植栽帯）
  const shrubs = []; for (const [x,z,w,d] of beds) for (let i=0;i<Math.floor(w*1.5);i++) shrubs.push([x-w/2+0.6+rnd()*(w-1.2), z-d/2+0.6+rnd()*(d-1.2), 0.5+rnd()*0.5]);
  for (let x=-42; x<=42; x+=1.2) shrubs.push([x, BLD.terraceZ-1.0, 0.5+rnd()*0.3]);  // 2Fテラス植栽（高さは後で）
  const shrubI = new THREE.InstancedMesh(G.sph(0.5, 8), M.leaf2, shrubs.length);
  shrubs.forEach(([x,z,s],i)=>{ const terr = Math.abs(z-(BLD.terraceZ-1.0))<0.01; tmp.scale.set(s, s*0.8, s); tmp.position.set(x, (terr? BLD.lv[1]+0.6 : 0.5)+0.3*s, z); tmp.updateMatrix(); shrubI.setMatrixAt(i, tmp.matrix); });
  shrubI.castShadow = true; shrubI.instanceMatrix.needsUpdate = true; green.add(shrubI);
  tmp.scale.set(1,1,1);
}
