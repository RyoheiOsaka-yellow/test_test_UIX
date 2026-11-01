// ================= 各階の部屋ごとの作り込み（床仕上げ・建具・什器・サイン・コア内部） =================
const FLOOR_FIN = {   // ゾーン別の床仕上げ
  lobby:"wood", show:"polished", cmm:"epoxyGreen", elab:"esd", tool:"epoxyGrey", insp:"epoxyGrey", rest1:"vinyl", core1:"tile", core2w:"tile", core2e:"tile", core3w:"tile", core3e:"tile",
  sw:"carpet2", hil:"esd", mtg2:"carpetDark", ctrl:"carpet2", srv:"raised", rest2:"vinyl", design:"wood", mtg3:"carpetDark", exec:"carpetDark", cafe:"tileWarm",
};
const FIN_MAT = {};
function finMat(k){ if (FIN_MAT[k]) return FIN_MAT[k];
  const mk = { wood: ()=> M.woodFloor, polished: ()=> std(0xd0d3d6, { roughness:0.25, metalness:0.1 }), epoxyGreen: ()=> std(0x5f8f72, { roughness:0.35 }), epoxyGrey: ()=> std(0xb7bcc1, { roughness:0.4 }),
    esd: ()=> std(0x8e949b, { map: canvasTex("esd", 256, (c,w,h)=>{ c.fillStyle="#8e949b"; c.fillRect(0,0,w,h); c.strokeStyle="#6d737a"; c.lineWidth=2; for (let i=0;i<=w;i+=64){ c.beginPath(); c.moveTo(i,0); c.lineTo(i,h); c.stroke(); c.beginPath(); c.moveTo(0,i); c.lineTo(w,i); c.stroke(); } c.strokeStyle="#3fb950"; c.lineWidth=1; for (let i=32;i<w;i+=64){ c.beginPath(); c.moveTo(i,0); c.lineTo(i,h); c.stroke(); } }, { repeat:[12,12] }), roughness:0.6 }),
    vinyl: ()=> std(0xd9d2c3, { roughness:0.5 }), tile: ()=> std(0xc9cbc9, { map: TEX.paving([8,8]), roughness:0.5 }), carpet2: ()=> std(0x5f6b78, { map: canvasTex("carpet2", 256, (c,w,h,rnd)=>{ for (let y=0;y<h;y+=64) for (let x=0;x<w;x+=64){ const v = ((x+y)/64)%2 ? 95 : 110; c.fillStyle=`rgb(${v-10},${v},${v+12})`; c.fillRect(x,y,64,64); } for (let i=0;i<4000;i++){ c.fillStyle=`rgba(0,0,0,${(rnd()*0.2).toFixed(2)})`; c.fillRect(rnd()*w, rnd()*h, 2, 2); } }, { repeat:[20,8] }), roughness:1 }),
    carpetDark: ()=> std(0x3d4653, { roughness:1 }), raised: ()=> std(0xdcdfe2, { map: TEX.paving([10,8]), roughness:0.5 }), tileWarm: ()=> std(0xd8c7ae, { map: TEX.paving([10,8]), roughness:0.6 }) };
  FIN_MAT[k] = (mk[k] || mk.vinyl)(); return FIN_MAT[k]; }

function doorPlate(g, text, x, y, z, ry=0){ const lb = makeLabel(text, { scale:0.45, bg:"rgba(240,241,243,0.95)", color:"#111" }); lb.position.set(x, y, z); lb.userData.kind = "eq"; lb.userData.floor = g === floorGroup(1) ? 1 : g === floorGroup(2) ? 2 : 3; g.add(lb); }
function phoneBooth(m, x, z, y){ m.box(1.2, 2.3, 1.2, std(0x2f3540), x, y, z); m.box(1.0, 1.6, 0.04, M.glassTint, x, y+0.5, z+0.6); m.box(0.8, 0.04, 0.5, M.deskWhite, x, y+1.0, z-0.2); m.box(0.4, 0.4, 0.4, M.chair, x, y+0.1, z+0.1); }
function printer(m, x, z, y){ m.box(1.0, 1.1, 0.7, std(0xe8e9ea), x, y, z); m.box(0.9, 0.08, 0.6, M.darkSteel, x, y+1.1, z); m.box(0.3, 0.04, 0.2, M.screen, x+0.25, y+1.18, z+0.15); }
function lockers(m, x0, x1, z, y, ry=0){ for (let x=x0; x<x1; x+=0.45){ m.box(0.42, 1.8, 0.5, std(0x9aa5ae,{metalness:0.4}), x+0.22, y, z, ry); m.box(0.3, 0.02, 0.02, M.darkSteel, x+0.22, y+1.0, z+0.26, ry); } }
function vending(m, x, z, y, col){ m.box(1.0, 1.9, 0.8, std(col), x, y, z); m.box(0.7, 1.2, 0.03, M.glassTint, x-0.1, y+0.5, z+0.41); m.box(0.2, 0.3, 0.02, M.screen, x+0.35, y+1.2, z+0.41); }
function wcFixtures(m, xa, xb, z, y){ for (let x=xa+0.6; x<xb-0.4; x+=0.9){ m.box(0.4, 0.4, 0.7, M.white, x, y, z+0.5); m.box(0.4, 0.5, 0.2, M.white, x, y+0.4, z+0.85); m.box(0.04, 2.0, 1.4, std(0xdde1e5), x+0.45, y, z+0.6); } for (let x=xa+0.6; x<xb-0.4; x+=0.8){ m.box(0.5, 0.15, 0.4, M.white, x, y+0.8, z-1.6); m.cyl(0.02, 0.25, M.steel, x, y+0.95, z-1.7, 6); } m.box(xb-xa-0.6, 0.8, 0.03, M.glassIn, (xa+xb)/2, y+1.0, z-1.85); }
function elevatorCar(m, x, z, y, h){ m.box(2.2, h, 0.04, std(0xc0c6cc,{metalness:0.6,roughness:0.3}), x, y, z); m.box(0.02, h-0.2, 0.02, M.darkSteel, x, y+0.1, z+0.03); m.box(0.5, 0.15, 0.03, std(0xd13b3b,{emissive:0xd13b3b,emissiveIntensity:0.8}), x, y+h+0.15, z+0.03); m.box(0.2, 0.3, 0.05, M.darkSteel, x+1.4, y+1.0, z+0.03); }
function whiteboard(m, x, z, y, ry=0){ m.box(1.8, 1.2, 0.04, std(0xf8f8f6), x, y+0.9, z, ry); m.box(1.9, 0.05, 0.08, M.darkSteel, x, y+0.86, z, ry); }
function standingDesk(m, x, z, y){ m.box(1.4, 0.03, 0.7, M.deskWhite, x, y+1.05, z); m.box(0.06, 1.05, 0.5, M.darkSteel, x-0.6, y, z); m.box(0.06, 1.05, 0.5, M.darkSteel, x+0.6, y, z); m.box(0.6, 0.36, 0.03, M.screen, x, y+1.2, z-0.25); }
function kitchenette(m, x, z, y){ m.box(3.0, 0.9, 0.6, M.deskWhite, x, y, z); m.box(3.0, 0.04, 0.65, std(0x4a4f55,{roughness:0.3}), x, y+0.9, z); m.box(0.5, 0.3, 0.4, std(0xdfe3e6), x-1.0, y+0.94, z); m.box(0.4, 0.45, 0.4, M.blackMatte, x+0.2, y+0.94, z); m.box(0.7, 1.8, 0.7, std(0xe8e9ea,{metalness:0.4}), x+2.2, y, z); m.box(3.0, 0.7, 0.35, M.deskWhite, x, y+1.5, z-0.15); }
function spotTrack(m, x0, x1, z, y){ m.box(x1-x0, 0.05, 0.06, M.darkSteel, (x0+x1)/2, y, z); for (let x=x0+1; x<x1; x+=2.5){ m.cyl(0.06, 0.2, M.darkSteel, x, y-0.2, z, 8); m.cyl(0.07, 0.04, M.lampWarm, x, y-0.24, z, 8); } }
function downlights(m, xa, xb, za, zb, y, pitch=3){ for (let x=xa+pitch/2; x<xb; x+=pitch) for (let z=za+pitch/2; z<zb; z+=pitch) m.cyl(0.12, 0.02, M.lamp, x, y, z, 10); }
function glassDoor(m, x, z, y, w=1.8, ry=0){ m.box(w, 2.3, 0.05, M.glassTint, x, y, z, ry); m.box(0.08, 2.3, 0.1, M.mullion, x-w/2, y, z, ry); m.box(0.08, 2.3, 0.1, M.mullion, x+w/2, y, z, ry); m.box(w, 0.1, 0.1, M.mullion, x, y+2.3, z, ry); m.box(0.04, 0.6, 0.06, M.steel, x+0.2, y+0.8, z+0.05, ry); }
function pedestal(m, x, z, y){ m.box(1.6, 0.6, 1.6, std(0xf0f0ee), x, y, z); m.box(1.7, 0.02, 1.7, M.lampWarm, x, y+0.6, z); }

function buildFloorDetail(){
  const { x0, x1, zh, z1, lv } = BLD;
  // ---- 床仕上げ（ゾーンごと）----
  for (const z of ZONES){ const [id, name, f, type, xa, xb, za, zb] = z; const fin = FLOOR_FIN[id]; if (!fin || f === 0) continue; const g = floorGroup(f); const y = lv[f-1] + 0.025;
    const pl = mesh(G.plane(xb - xa - 0.3, zb - za - 0.3), finMat(fin), (xa+xb)/2, y, (za+zb)/2, { rot:[-Math.PI/2,0,0], cast:false }); pl.userData.layer = "furniture"; g.add(pl); }
  const F1 = new Merger(), F2 = new Merger(), F3 = new Merger(); const g1 = floorGroup(1), g2 = floorGroup(2), g3 = floorGroup(3); const y1 = 0, y2 = lv[1], y3 = lv[2];
  // ---- 1F ロビー：セキュリティゲート・サイネージ・傘立て ----
  for (let i=0;i<3;i++){ const x = -33 + i*1.1; F1.box(0.2, 1.0, 1.4, std(0xdfe3e6,{metalness:0.5,roughness:0.3}), x, y1, 10); F1.box(0.18, 0.6, 0.05, M.glassTint, x, y1+0.55, 10.5); F1.box(0.1, 0.03, 0.2, std(0x3fb950,{emissive:0x3fb950,emissiveIntensity:1}), x, y1+1.0, 10.5); }
  F1.box(0.6, 2.2, 0.15, M.blackMatte, -30.5, y1, 15); F1.box(0.5, 1.8, 0.02, M.screen, -30.5, y1+0.3, 15.08); F1.box(0.4, 0.6, 0.4, M.darkSteel, -43, y1, 5); F1.box(1.2, 0.02, 0.6, std(0x3b3f45), -36, y1+0.001, 3.5);
  spotTrack(F1, -44, -16, 6, lv[1]-0.9); spotTrack(F1, -44, -16, 14, lv[1]-0.9); doorPlate(g1, "受付 / RECEPTION", -40, 2.6, 7, 0);
  // ---- ショールーム：展示台・キオスク・実機モデル ----
  pedestal(F1, -19, 5, y1); pedestal(F1, -27, 5, y1); const rb = makeRobot(0.7, M.robotWhite); rb.position.set(-19, 0.6, 5); g1.add(rb); animateRobot(rb, 0.4, 0.7);
  const amr = makeAGV(); amr.scale.setScalar(0.8); amr.position.set(-27, 0.6, 5); g1.add(amr);
  F1.box(0.5, 1.1, 0.4, M.white, -22.5, y1, 14.5); F1.box(0.45, 0.3, 0.02, M.screen, -22.5, y1+0.85, 14.71); doorPlate(g1, "ショールーム / SHOWROOM", -23, 2.6, 3.2, 0);
  // ---- 計測室：前室（二重扉）・温度表示・防振スラブ ----
  F1.box(0.15, lv[1]-0.7, 2.6, M.gypsum, -13.5, y1, 4.3); F1.box(2.6, lv[1]-0.7, 0.15, M.gypsum, -14.8, y1, 5.6); glassDoor(F1, -14.8, 3.0, y1, 1.0, 0); glassDoor(F1, -12.2, 5.6, y1, 1.0, 0);
  F1.box(5.0, 0.12, 3.6, std(0x9ba3ab), -11, y1+0.03, 9); F1.box(0.5, 0.3, 0.05, M.screen, -8, y1+1.8, 2.25); doorPlate(g1, "精密計測室 20±0.5℃", -11, 2.6, 3.2, 0);
  // ---- 電子ラボ：部品ビン壁・静電対策表示 ----
  for (let i=0;i<10;i++) for (let k=0;k<4;k++) F1.box(0.3, 0.2, 0.3, [M.machineBlue, M.rackOrange, std(0x3fb950)][(i+k)%3], -5.3 + i*0.42, y1+0.4+k*0.45, 17.4); F1.box(4.4, 2.2, 0.3, M.darkSteel, -3.4, y1, 17.6);
  doorPlate(g1, "電子・制御ラボ（ESD）", 0, 2.6, 3.2, 0);
  // ---- 工具室：カウンター（シャッター付） ----
  F1.box(4.0, 1.1, 0.6, M.deskWhite, 11, y1, 3.0); F1.box(4.0, 1.5, 0.08, std(0x9aa0a6,{metalness:0.6}), 11, y1+2.3, 3.0); for (let i=0;i<8;i++) F1.box(4.0, 0.03, 0.1, M.darkSteel, 11, y1+2.35+i*0.18, 3.05); doorPlate(g1, "工具室 / TOOL CRIB", 11, 2.6, 2.5, 0);
  // ---- 受入検査：ゲージキャビネット・計測アーム ----
  F1.box(2.4, 1.9, 0.6, M.machineWhite, 26, y1, 17.4); F1.box(0.4, 0.4, 0.4, M.machineDark, 18.5, y1+0.9, 6); F1.cyl(0.05, 1.3, M.machineWhite, 18.5, y1+1.3, 6, 8); doorPlate(g1, "受入検査 / INCOMING QC", 22, 2.6, 3.2, 0);
  // ---- 休憩・更衣：テーブル・自販機・流し ----
  for (const x of [29.5, 32.5]){ F1.box(1.6, 0.04, 0.8, M.timber, x, y1+0.72, 9); F1.box(0.06, 0.72, 0.6, M.darkSteel, x-0.6, y1, 9); F1.box(0.06, 0.72, 0.6, M.darkSteel, x+0.6, y1, 9); for (const dz of [-0.9, 0.9]) F1.box(0.42, 0.45, 0.42, M.chair, x, y1, 9+dz); }
  vending(F1, 29, 3.3, y1, 0xd13b3b); vending(F1, 30.2, 3.3, y1, 0x2a5ea8); kitchenette(F1, 33.5, 3.4, y1); doorPlate(g1, "休憩・更衣 / LOCKER", 32, 2.6, 2.5, 0);
  // ---- 1F コア：WC・EV かご扉 ----
  wcFixtures(F1, -43.5, -37.5, 14.5, y1); wcFixtures(F1, 37.5, 43.5, 14.5, y1); elevatorCar(F1, -42.4, 5.4, y1, 2.2); elevatorCar(F1, 37.6, 5.4, y1, 2.2);
  downlights(F1, x0, x1, zh, z1, lv[1]-0.72, 3.5);
  // ---- 2F：フォンブース・複合機・ロッカー・ホワイトボード・立ち机・キッチン ----
  for (const x of [-8, -6.6, 34.5]) phoneBooth(F2, x, 4.2, y2); printer(F2, -34, 4.0, y2); printer(F2, 12.5, 4.0, y2); lockers(F2, -35.5, -30, 17.6, y2);
  for (const x of [-28, -12, 20]) whiteboard(F2, x, 2.9, y2); for (const x of [-30, -24, -18]) standingDesk(F2, x, 16.4, y2); kitchenette(F2, 35, 8, y2);
  F2.box(0.6, 1.2, 0.06, std(0xf8f8f6), -8, y2+0.9, 17.5); F2.box(2.0, 1.4, 0.05, M.monitor, 18, y2+0.9, 17.5); F2.box(1.9, 1.3, 0.02, M.screen, 18, y2+0.95, 17.47);   // プロジェクトボード・ダッシュボード
  for (let i=0;i<2;i++){ F2.box(1.2, 0.8, 0.7, M.deskWhite, 15+i*4.0, y2, 15.5); F2.box(0.5, 0.3, 0.4, M.machineDark, 15+i*4.0, y2+0.8, 15.5); F2.box(0.4, 0.25, 0.02, M.screen, 15+i*4.0, y2+0.95, 15.72); }  // 制御ベンチ（オシロ）
  F2.box(9.6, 0.15, 0.6, std(0xd0d4d8), 29, y2, 13.6); F2.box(1.2, 2.2, 0.12, M.darkSteel, 25.5, y2, 13.9); F2.box(0.3, 0.3, 0.03, M.screen, 25.5, y2+1.4, 13.97);   // サーバー室ランプ・扉・入退室
  wcFixtures(F2, 37.5, 43.5, 14.5, y2); elevatorCar(F2, -42.4, 5.4, y2, 2.2); elevatorCar(F2, 37.6, 5.4, y2, 2.2); downlights(F2, x0+8, x1-8, 3, 17, lv[2]-0.72, 4);
  doorPlate(g2, "ソフトウェア開発 / SW ENGINEERING", -22, y2+2.6, 3.2, 0); doorPlate(g2, "HIL ラボ", -3, y2+2.6, 3.2, 0); doorPlate(g2, "制御・組込開発", 18, y2+2.6, 3.2, 0); doorPlate(g2, "サーバー室（入室制限）", 29, y2+2.6, 3.2, 0);
  // ---- 3F：プロッタ・サンプル棚・模型台・役員ボードルーム・カフェ厨房 ----
  F3.box(1.6, 1.0, 0.8, std(0xe8e9ea), -34.5, y3, 16.4); F3.box(1.5, 0.3, 0.1, M.darkSteel, -34.5, y3+1.0, 16.2); for (let i=0;i<5;i++) F3.box(2.4, 0.03, 0.4, M.steel, -12, y3+0.4+i*0.5, 17.4); F3.box(2.5, 2.6, 0.45, M.darkSteel, -12, y3, 17.5);
  F3.box(2.4, 0.9, 1.4, M.timber, -20, y3, 16.2); F3.box(2.2, 0.08, 1.2, std(0xe6e1d6), -20, y3+0.9, 16.2);   // 模型台
  F3.box(4.0, 0.05, 1.4, std(0x4a3626,{roughness:0.4}), 13, y3+0.73, 10); for (let i=0;i<5;i++) for (const dz of [-1.0, 1.0]){ F3.box(0.46, 0.08, 0.46, M.chair, 11.2+i*0.9, y3+0.42, 10+dz); F3.box(0.44, 0.5, 0.06, M.chair, 11.2+i*0.9, y3+0.5, 10+dz+Math.sign(dz)*0.2); }
  F3.box(0.15, 3.3, 15.5, M.glassIn, 10, y3, 10); F3.box(0.15, 3.3, 15.5, M.glassIn, 16, y3, 10); doorPlate(g3, "ボードルーム", 13, y3+2.6, 3.2, 0);
  F3.box(5.0, 0.9, 2.4, std(0xdfe3e6,{metalness:0.4}), 31, y3, 15.5); F3.box(1.0, 0.5, 0.7, std(0x8d939a,{metalness:0.6}), 30, y3+0.9, 15.5); F3.box(2.0, 0.6, 1.0, std(0xd8dcdf,{metalness:0.5}), 32.5, y3+0.9, 15.5); F3.box(5.2, 0.8, 0.1, M.timberDark, 31, y3+2.4, 16.6); // 厨房
  for (let x = 18; x < 36; x += 1.0) { F3.box(0.4, 0.75, 0.4, M.chair, x, y3, 3.4); } F3.box(18, 0.04, 0.5, M.timber, 27, y3+1.0, 3.0);   // 窓際カウンター席
  for (let i=0;i<3;i++) F3.box(1.0, 1.8, 0.35, M.timberDark, 35.5, y3, 6+i*1.2);
  wcFixtures(F3, 37.5, 43.5, 14.5, y3); elevatorCar(F3, -42.4, 5.4, y3, 2.2); elevatorCar(F3, 37.6, 5.4, y3, 2.2); downlights(F3, x0+8, x1-8, 3, 17, 13.4, 4);
  doorPlate(g3, "設計 / DESIGN", -23, y3+2.6, 3.2, 0); doorPlate(g3, "カフェテリア / CAFE", 26, y3+2.6, 3.2, 0);
  // ---- ホール床：資材区画の黄黒ハッチ・パレット位置・歩行者通路 ----
  for (let i=0;i<10;i++) F1.box(0.12, 0.012, 14, i%2? M.safetyYellow : M.blackMatte, 36.2 + i*0.1, y1+0.075, -22); for (let k=0;k<3;k++) F1.box(1.3, 0.012, 0.08, M.line, 40, y1+0.075, -27+k*4.5);
  for (let x=x0+2; x<x1-2; x+=2) F1.box(1.0, 0.012, 0.1, std(0x3fb950), x+0.5, y1+0.075, -15.9);
  F1.flush(g1, { name:"floorDetail1", layer:"furniture" }); F2.flush(g2, { name:"floorDetail2", layer:"furniture" }); F3.flush(g3, { name:"floorDetail3", layer:"furniture" });
  g2.children.filter(c=>c.name==="floorDetail2").forEach(()=>{}); // y は絶対座標で配置済み
}
