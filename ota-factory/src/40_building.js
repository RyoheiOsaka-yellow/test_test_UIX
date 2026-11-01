// ================= 建屋：架構・外皮・床・コア =================
const FL = {};      // 階ごとのグループ（表示切替用）: 1,2,3, roof
function floorGroup(f){ if(!FL[f]){ const g = new THREE.Group(); g.name = "floor_"+f; FL[f] = g; scene.add(g); } return FL[f]; }

// 屋根プロファイル補間 y(z)
function roofY(z){
  const p = BLD.roofProfile; if (z <= p[0][0]) return p[0][1]; if (z >= p[p.length-1][0]) return p[p.length-1][1];
  for (let i=0;i<p.length-1;i++){ const [z0,y0]=p[i], [z1,y1]=p[i+1]; if (z>=z0 && z<=z1) return lerp(y0, y1, (z-z0)/(z1-z0)); }
  return BLD.eave;
}

function buildBuilding(){
  const { x0, x1, z0, zh, z1, terraceZ, eaveZ, lv, eave, craneRail, grid } = BLD;
  const S = new Merger();   // 構造（1Fに属させ常時表示）
  const R = new Merger();   // 屋根まわり
  const E1 = new Merger(), E2 = new Merger(), E3 = new Merger(); // 階別 外皮・床・壁
  const g1 = floorGroup(1), g2 = floorGroup(2), g3 = floorGroup(3), gr = floorGroup("roof");
  const W = x1 - x0;

  // ---------- 柱 ----------
  const cols = []; for (let x=x0; x<=x1+0.01; x+=grid) cols.push(x);
  for (const x of cols){
    S.box(0.7, eave, 0.7, M.yellow, x, 0, z0+0.6);                 // 北側 主柱（黄）
    S.box(0.7, eave, 0.7, M.yellow, x, 0, zh-0.6);                  // ホール南側 主柱（黄）
    S.box(0.45, lv[2]+4.1, 0.45, M.steel, x, 0, z1-0.5);           // 南ファサード 柱
    if (x>x0 && x<x1) S.box(0.45, lv[2]+4.1, 0.45, M.steel, x, 0, 10); // ストリップ中間柱
    // クレーン受けブラケット + ランウェイ
    S.box(1.0, 0.5, 0.9, M.yellow, x, craneRail-1.3, z0+1.35); S.box(1.0, 0.5, 0.9, M.yellow, x, craneRail-1.3, zh-1.35);
  }
  for (const zr of [z0+1.35, zh-1.35]){ S.box(W+1, 0.9, 0.4, M.darkSteel, (x0+x1)/2, craneRail-0.9, zr); S.box(W+1, 0.12, 0.12, M.steel, (x0+x1)/2, craneRail, zr); }
  // 壁つなぎ（胴縁）北面
  for (const y of [3, 6, 9, 12]) S.box(W, 0.15, 0.15, M.darkSteel, (x0+x1)/2, y, z0+0.95);

  // ---------- 屋根トラス（各通り）----------
  const prof = BLD.roofProfile;
  function trussAt(x, m){
    // 上弦材：プロファイルに沿う
    for (let i=0;i<prof.length-1;i++){ const [za,ya]=prof[i], [zb,yb]=prof[i+1]; const L = Math.hypot(zb-za, yb-ya); const ang = Math.atan2(yb-ya, zb-za);
      m.boxC(0.25, 0.3, L, M.darkSteel, x, (ya+yb)/2 - 0.5, (za+zb)/2, [-ang, 0, 0]); }
    // 下弦材：ホール部は水平 y=12.8、ストリップ部は y=13.3
    m.box(0.25, 0.25, (zh - z0) + 0.5, M.darkSteel, x, 12.8, (z0+zh)/2 - 0.25);
    m.box(0.25, 0.25, (eaveZ - zh) - 0.5, M.darkSteel, x, 13.3, (zh+eaveZ)/2);
    // 束材・斜材
    for (let z=z0; z<=eaveZ-0.5; z+=4){ const yb = z<zh? 12.8 : 13.3, yt = roofY(z)-0.5; const h = yt - yb; if (h<0.3) continue;
      m.box(0.12, h, 0.12, M.steel, x, yb, z);
      const zn = Math.min(z+4, eaveZ); const ytn = roofY(zn)-0.5; const L = Math.hypot(zn-z, ytn-yb); const ang = Math.atan2(ytn-yb, zn-z);
      m.boxC(0.08, 0.08, L, M.steel, x, (yb+ytn)/2, (z+zn)/2, [-ang, 0, 0]); }
  }
  for (const x of cols) trussAt(x, R);
  // 母屋（屋根下面、東西方向）
  for (let z=z0+1; z<eaveZ; z+=2){ const y = roofY(z)-0.28; const sl = (roofY(z+0.5)-roofY(z-0.5)); R.boxC(W+2, 0.18, 0.12, M.steel, (x0+x1)/2, y, z, [-Math.atan(sl), 0, 0]); }
  // 2F/3F 床梁（東西・南北）
  for (const [f, y] of [[2, lv[1]], [3, lv[2]]]){ const m = f===2? E2 : E3;
    for (const x of cols) m.box(0.3, 0.6, (f===2? terraceZ : z1) - zh + 2, M.darkSteel, x, y-0.65, ((f===2? terraceZ : z1) + zh - 2)/2);
    for (const z of [zh-1.0, 10, z1-0.5]) m.box(W, 0.6, 0.3, M.darkSteel, (x0+x1)/2, y-0.65, z); }

  // ---------- 屋根（折板）----------
  function roofExtrude(offset, thick, mat, zFrom, zTo, xa, xb, target){
    const pts = prof.filter(p=>p[0]>=zFrom-0.01 && p[0]<=zTo+0.01).map(([z,y])=>[z, y+offset]);
    if (pts[0][0] > zFrom) pts.unshift([zFrom, roofY(zFrom)+offset]); if (pts[pts.length-1][0] < zTo) pts.push([zTo, roofY(zTo)+offset]);
    const shape = new THREE.Shape(); shape.moveTo(-pts[0][0], pts[0][1]); for (let i=1;i<pts.length;i++) shape.lineTo(-pts[i][0], pts[i][1]);
    for (let i=pts.length-1;i>=0;i--) shape.lineTo(-pts[i][0], pts[i][1]-thick); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: xb-xa, bevelEnabled:false });
    const m = new THREE.Mesh(geo, mat); m.rotation.y = Math.PI/2; m.position.x = xa; m.castShadow = true; m.receiveShadow = true; target.add(m); return m;
  }
  roofExtrude(0, 0.45, M.roofMetal, z0-1, eaveZ, x0-1.2, x1+1.2, gr).name = "roofTop";
  // 折板のリブ（山）：プロファイル各区間に沿って 0.5 m ピッチ
  { const ribM = std(0xe3e7ea, { roughness:0.4, metalness:0.45 }); const segs = [[z0-1, prof[0][1]], ...prof.slice(1)]; const RB = new Merger();
    for (let i=0;i<segs.length-1;i++){ const [za,ya]=segs[i], [zb,yb]=segs[i+1]; const L = Math.hypot(zb-za, yb-ya); const ang = Math.atan2(yb-ya, zb-za);
      for (let x=x0-1.0; x<=x1+1.0; x+=0.5) RB.boxC(0.14, 0.09, L-0.05, ribM, x, (ya+yb)/2+0.04, (za+zb)/2, [-ang,0,0]); }
    RB.flush(gr, { name:"roofRibs", layer:"envelope", cast:false }); }
  // ホール内側 デッキ（薄グレー）と、ストリップ・キャンチ部の木天井
  roofExtrude(-0.5, 0.05, M.hallGlow, z0-0.5, zh, x0, x1, gr);
  const soffit = mesh(G.plane(W+2.4, eaveZ - zh), M.timber, (x0+x1)/2, 13.65, (zh+eaveZ)/2, { rot:[Math.PI/2,0,0], cast:false }); soffit.material = M.timber.clone(); soffit.material.map = TEX.timber([1, 44]); gr.add(soffit);
  // 木ルーバー（軒下に 30cm ピッチ）
  for (let z=zh+0.3; z<eaveZ-0.3; z+=0.3) R.box(W+2.4, 0.12, 0.06, M.timber, (x0+x1)/2, 13.45, z);
  // 鋸歯型トップライト（北向き）
  for (const zc of [-27, -22, -17]){ const yb = roofY(zc); const h = 2.2; const lidZ = 3.6; const ye = roofY(zc+lidZ)+0.05;
    const glass = mesh(G.plane(W-2, h), M.glass, (x0+x1)/2, yb+h/2, zc, { cast:false, ry:Math.PI }); gr.add(glass);
    const L = Math.hypot(lidZ, ye-(yb+h)); R.boxC(W-1.6, 0.25, L, M.roofMetal, (x0+x1)/2, (yb+h+ye)/2, zc+lidZ/2, [-Math.atan2(ye-(yb+h), lidZ), 0, 0]);
    for (let x=x0+1; x<x1; x+=2) R.box(0.1, h, 0.1, M.mullion, x, yb, zc);
    R.box(W-1.6, 0.15, 0.3, M.roofMetal, (x0+x1)/2, yb+h-0.1, zc); R.boxC(0.3, h, lidZ, M.roofMetal, x0+0.9, yb+h/2, zc+lidZ/2); R.boxC(0.3, h, lidZ, M.roofMetal, x1-0.9, yb+h/2, zc+lidZ/2); }
  // 妻壁（東・西）: 屋根プロファイルに合わせたパネル（ホール部のみ。ストリップ部はガラス/折板）
  function gableShape(zFrom, zTo, yBase){ const sh = new THREE.Shape(); sh.moveTo(-zFrom, yBase); for (let z=zFrom; z<=zTo; z+=1) sh.lineTo(-z, roofY(z)-0.45); sh.lineTo(-zTo, roofY(zTo)-0.45); sh.lineTo(-zTo, yBase); sh.closePath(); return sh; }
  // 東妻壁：折板（出荷扉含む）
  { const geo = new THREE.ExtrudeGeometry(gableShape(z0, zh, 0), { depth:0.3, bevelEnabled:false }); const m = new THREE.Mesh(geo, M.wallMetal); m.rotation.y = Math.PI/2; m.position.x = x1-0.3; m.castShadow = m.receiveShadow = true; g1.add(m); }
  // 西妻壁：ホール部は全面ガラス（駐車場側から機械が見える）、上部三角は折板
  { const geo = new THREE.ExtrudeGeometry(gableShape(z0, zh, 12.5), { depth:0.3, bevelEnabled:false }); const m = new THREE.Mesh(geo, M.wallMetal); m.rotation.y = Math.PI/2; m.position.x = x0; g1.add(m); }
  // 東側 折れファサード（ストリップ部 z 2〜24：屋根が壁として折り下がる）
  { const sh = new THREE.Shape(); sh.moveTo(-zh, 0); sh.lineTo(-eaveZ, 0); sh.lineTo(-eaveZ, roofY(eaveZ)-0.4); sh.lineTo(-zh, roofY(zh)-0.4); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth:0.35, bevelEnabled:false }); const m = new THREE.Mesh(geo, M.wallMetal); m.rotation.y = Math.PI/2; m.position.set(x1-0.2, 0, 0); m.rotation.z = 0.0; m.castShadow = m.receiveShadow = true;
    // 上端を外へ 1.2m 倒す（折れ感）
    m.geometry.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, 0, 0, 0, 0.085)); g1.add(m); }

  // ---------- 外壁・カーテンウォール ----------
  const mullV = [], mullH = [];   // インスタンス化用 [x,y,z,h,ry]
  function curtain(target, m, xa, xb, za, zb, yb, yt, opts={}){
    // 平面 (xa,za)-(xb,zb) の鉛直ガラス面 + マリオン
    const L = Math.hypot(xb-xa, zb-za), ry = Math.atan2(xb-xa, zb-za) + Math.PI/2; const cx=(xa+xb)/2, cz=(za+zb)/2;
    const gl = mesh(G.plane(L, yt-yb), opts.mat || M.glass, cx, (yb+yt)/2, cz, { ry, cast:false }); gl.userData.layer="envelope"; target.add(gl);
    const n = Math.round(L/(opts.pitch||2)); for (let i=0;i<=n;i++){ const t=i/n; mullV.push([lerp(xa,xb,t), yb, lerp(za,zb,t), yt-yb, ry]); }
    for (const y of (opts.transoms||[])) if (y>yb && y<yt) m.boxC(L, 0.1, 0.12, M.mullion, cx, y, cz, [0, ry, 0]);
    m.boxC(L, 0.15, 0.2, M.mullion, cx, yb+0.08, cz, [0, ry, 0]); m.boxC(L, 0.15, 0.2, M.mullion, cx, yt-0.08, cz, [0, ry, 0]);
  }
  // 南ファサード 1F / 2F / 3F
  curtain(g1, E1, x0, x1, z1, z1, 0, lv[1], { transoms:[2.6], pitch:2 });
  curtain(g2, E2, x0, x1, z1, z1, lv[1], lv[2], { transoms:[7.3], pitch:2 });
  curtain(g3, E3, x0, x1, z1, z1, lv[2], 13.5, { transoms:[11.6], pitch:2 });
  // 西面：ホール（ガラス 0〜12.5）とストリップ
  curtain(g1, E1, x0, x0, z0, zh, 0, 12.5, { transoms:[4, 8], pitch:2 });
  curtain(g1, E1, x0, x0, zh, z1, 0, lv[1], { transoms:[2.6] }); curtain(g2, E2, x0, x0, zh, terraceZ, lv[1], lv[2], { transoms:[7.3] }); curtain(g3, E3, x0, x0, zh, z1, lv[2], 13.5, { transoms:[11.6] });
  // 北面：折板 + ハイサイド窓
  E1.box(W, 9, 0.3, M.wallMetal, (x0+x1)/2, 0, z0+0.15); E1.box(W, 1.6, 0.3, M.wallMetal, (x0+x1)/2, 12, z0+0.15);
  curtain(g1, E1, x1, x0, z0+0.1, z0+0.1, 9, 12, { transoms:[10.5], pitch:4 });
  // 東面 1F ストリップ：折れファサード裏のガラス（受入検査・コア）
  E1.box(0.3, 0.3, z1-zh, M.mullion, x1-0.35, 0, (zh+z1)/2);
  // 東妻壁の扉（出荷ドック 2 + 大扉）
  for (const e of EQUIP.filter(e=>e.kind==="dock")){ E1.box(0.2, 4.5, 3.5, M.darkSteel, x1-0.1, 0, e.z); for (let y=0.6;y<4.5;y+=0.9) E1.box(0.26, 0.06, 3.5, M.steel, x1-0.1, y, e.z); E1.box(0.5, 1.2, 2.4, M.steel, x1+0.3, 0, e.z); E1.box(0.6, 0.6, 3.2, std(0x222,{roughness:0.9}), x1+0.3, 0.6, e.z); }
  { const e = EQUIP.find(e=>e.kind==="bigdoor"); E1.box(0.25, 7, 8, M.darkSteel, x1-0.1, 0, e.z); for (let y=0.6;y<7;y+=0.9) E1.box(0.3, 0.06, 8, M.steel, x1-0.1, y, e.z); E1.box(0.3, 0.3, 8.4, M.yellow, x1-0.1, 7, e.z); }
  // 外部 人用ドア（北・東）
  E1.box(0.3, 2.2, 1.0, M.darkSteel, x0+6, 0, z0+0.1); E1.box(0.3, 2.2, 1.0, M.darkSteel, x1-0.1, 0, 10);

  // ---------- 外観ディテール：木質エントランス・スパンドレル・屋上設備 ----------
  // 南西の木質ポータル（ロビー前に 3.5 m 張り出す）
  E1.box(0.35, lv[1]-0.3, 3.6, M.timberDark, x0+0.2, 0, z1+1.8); E1.box(0.35, lv[1]-0.3, 3.6, M.timberDark, x0+14, 0, z1+1.8);
  E1.box(14.2, 0.5, 3.8, M.timberDark, x0+7.1, lv[1]-0.8, z1+1.8); E1.box(14.2, 0.6, 0.3, M.timberDark, x0+7.1, lv[1]-0.9, z1+3.5);
  E1.box(14.2, 0.08, 0.6, M.lampWarm, x0+7.1, lv[1]-0.85, z1+2.6);
  E1.box(0.3, lv[1]-0.7, z1-zh, M.timberDark, x0+0.35, 0, (zh+z1)/2);                       // 西面 1F は木質壁（ロビー背面）
  E1.box(2.4, 2.6, 0.12, M.glassTint, x0+7.1, 0, z1+0.2); E1.box(0.1, 2.6, 0.12, M.mullion, x0+5.9, 0, z1+0.2); E1.box(0.1, 2.6, 0.12, M.mullion, x0+8.3, 0, z1+0.2); E1.box(2.6, 0.1, 0.12, M.mullion, x0+7.1, 2.6, z1+0.2);
  // スパンドレル（階の帯）：3F 床レベルと屋根下
  E3.box(W, 0.6, 0.1, M.spandrel, (x0+x1)/2, lv[2]-0.6, z1+0.08); E3.box(W, 0.35, 0.1, M.concreteWhite, (x0+x1)/2, 13.5, z1+0.08);
  E2.box(W, 0.55, 0.3, M.concreteWhite, (x0+x1)/2, lv[1]-0.3, terraceZ-0.15);              // テラス先端の白い帯
  // 屋上：太陽光パネル（棟1→谷の南斜面）と空調屋外機
  { const pvM = new Merger(); const za = -15, zb = -5; const sl = (roofY(zb)-roofY(za))/(zb-za); const ang = Math.atan(sl);
    for (let z=za+0.6; z<zb; z+=2.1) for (let x=x0+3; x<x1-3; x+=2.1){ pvM.boxC(2.0, 0.06, 1.0, M.solar, x, roofY(z)+0.28, z, [-ang,0,0]); pvM.boxC(0.08, 0.2, 0.08, M.steel, x-0.8, roofY(z)+0.12, z, [-ang,0,0]); }
    for (const x of [20, 26, 32]){ pvM.box(3.0, 1.8, 2.0, std(0xd0d4d8,{metalness:0.4,roughness:0.5}), x, roofY(-3.6)+0.4, -3.6); pvM.box(2.8, 0.12, 1.8, M.darkSteel, x, roofY(-3.6)+2.2, -3.6); for (let k=0;k<6;k++) pvM.box(2.6, 0.03, 0.08, M.darkSteel, x, roofY(-3.6)+0.6+k*0.22, -2.6); pvM.box(3.4, 0.4, 2.4, M.darkSteel, x, roofY(-3.6), -3.6); }
    pvM.flush(gr, { name:"roofEquip", layer:"envelope" }); }
  // ---------- 床・スラブ・天井 ----------
  const hallFloor = mesh(G.plane(W, zh-z0), M.epoxy, (x0+x1)/2, 0.06, (z0+zh)/2, { rot:[-Math.PI/2,0,0], cast:false }); hallFloor.name="hallFloor"; g1.add(hallFloor);
  const stripFloor = mesh(G.plane(W, z1-zh), std(0xc9ccd0,{ map:TEX.concrete([20,4]), roughness:0.6 }), (x0+x1)/2, 0.06, (zh+z1)/2, { rot:[-Math.PI/2,0,0], cast:false }); g1.add(stripFloor);
  // 2F スラブ（テラス含む）
  E2.box(W, 0.3, terraceZ-zh+2, M.concrete, (x0+x1)/2, lv[1]-0.3, (zh-2+terraceZ)/2);
  g2.add(mesh(G.plane(W, z1-zh), M.carpet, (x0+x1)/2, lv[1]+0.01, (zh+z1)/2, { rot:[-Math.PI/2,0,0], cast:false }));
  g2.add(mesh(G.plane(W, terraceZ-z1), M.paving, (x0+x1)/2, lv[1]+0.01, (z1+terraceZ)/2, { rot:[-Math.PI/2,0,0], cast:false }));
  g2.add(mesh(G.plane(W, 2), M.steel, (x0+x1)/2, lv[1]+0.01, zh-1, { rot:[-Math.PI/2,0,0], cast:false })); // ホール側バルコニー（グレーチング風）
  // テラス手摺・植栽プランター
  E2.box(W, 1.1, 0.04, M.glassTint, (x0+x1)/2, lv[1], terraceZ-0.1); E2.box(W, 0.06, 0.08, M.darkSteel, (x0+x1)/2, lv[1]+1.1, terraceZ-0.1);
  E2.box(W-2, 0.6, 1.4, M.curb, (x0+x1)/2, lv[1], terraceZ-1.0);
  // バルコニー手摺（ホール側）
  E2.box(W, 1.1, 0.04, M.glassTint, (x0+x1)/2, lv[1], zh-2.0); E2.box(W, 0.06, 0.08, M.darkSteel, (x0+x1)/2, lv[1]+1.1, zh-2.0);
  // 3F スラブ
  E3.box(W, 0.3, z1-zh+1, M.concrete, (x0+x1)/2, lv[2]-0.3, (zh-1+z1)/2);
  g3.add(mesh(G.plane(W, z1-zh), M.woodFloor, (x0+x1)/2, lv[2]+0.01, (zh+z1)/2, { rot:[-Math.PI/2,0,0], cast:false }));
  g3.add(mesh(G.plane(W, 1), M.steel, (x0+x1)/2, lv[2]+0.01, zh-0.5, { rot:[-Math.PI/2,0,0], cast:false }));
  E3.box(W, 1.1, 0.04, M.glassTint, (x0+x1)/2, lv[2], zh-1.0); E3.box(W, 0.06, 0.08, M.darkSteel, (x0+x1)/2, lv[2]+1.1, zh-1.0);
  // 1F ストリップ天井（2Fスラブ下 / 木ルーバー）・2F 天井（3Fスラブ下）
  for (let z=zh+0.3; z<terraceZ; z+=0.3) E2.box(W, 0.1, 0.05, M.timber, (x0+x1)/2, lv[1]-0.75, z);
  for (let z=zh+0.3; z<z1; z+=0.3) E3.box(W, 0.1, 0.05, M.timber, (x0+x1)/2, lv[2]-0.75, z);
  g2.add(mesh(G.plane(W, terraceZ-zh), M.ceilingGlow, (x0+x1)/2, lv[1]-0.68, (zh+terraceZ)/2, { rot:[Math.PI/2,0,0], cast:false }));
  g3.add(mesh(G.plane(W, z1-zh), M.ceilingGlow, (x0+x1)/2, lv[2]-0.68, (zh+z1)/2, { rot:[Math.PI/2,0,0], cast:false }));

  // ---------- ホール⇔ストリップ境界（z=2）の壁・ガラス ----------
  // 1F：ロビー/ショールームはガラス・開放、他は壁＋ドア
  for (const zn of ZONES.filter(z=>z[2]===1 && z[6]===2 && z[7]===18)){ const [id, name, , , xa, xb] = zn; const cx=(xa+xb)/2, w=xb-xa;
    if (id==="show") continue;                                   // 吹抜け・開放
    if (id==="lobby" || id==="cmm" || id==="elab"){ curtain(g1, E1, xa, xb, zh, zh, 0, lv[1]-0.7, { transoms:[2.6], mat:M.glassIn, pitch:2 }); }
    else { E1.box(w, lv[1]-0.7, 0.2, M.gypsum, cx, 0, zh); E1.box(1.0, 2.2, 0.25, M.darkSteel, cx, 0, zh); } }
  // 2F/3F：全面ガラス（ホールを見下ろす）
  curtain(g2, E2, x0, x1, zh, zh, lv[1], lv[2]-0.7, { transoms:[7.3], mat:M.glassIn, pitch:2 });
  curtain(g3, E3, x0, x1, zh, zh, lv[2], 13.5, { transoms:[11.6], mat:M.glassIn, pitch:2 });
  // ゾーン間仕切り（1F/2F/3F ストリップ内）
  for (const f of [1,2,3]){ const m = f===1?E1: f===2?E2: E3; const g = f===1?g1: f===2?g2: g3; const y = lv[f-1]; const h = (f===3? 13.5 : lv[f]-0.7) - y;
    const zs = ZONES.filter(z=>z[2]===f && z[6]===2 && z[7]===18).sort((a,b)=>a[4]-b[4]);
    for (let i=0;i<zs.length-1;i++){ const xb = zs[i][5]; const t = zs[i][3], tn = zs[i+1][3]; const glassy = (f>1) || t==="pub" || tn==="pub" || t==="lab" || tn==="lab";
      if (zs[i][0]==="lobby" && zs[i+1][0]==="show") continue;
      if (glassy) curtain(g, m, xb, xb, zh+0.2, z1-0.5, y, y+h, { transoms:[y+2.6], mat:M.glassIn, pitch:2 }); else m.box(0.15, h, z1-zh-0.7, M.gypsum, xb, y, (zh+z1)/2);
      m.box(0.2, 2.2, 1.0, M.darkSteel, xb, y, zh+3); } }
  // 計測室は恒温のため二重壁（ホール側にも壁）
  E1.box(10, lv[1]-0.7, 0.2, M.gypsum, -11, 0, zh+0.5);

  // ---------- コア（階段・EV）----------
  function core(xa, xb, m, g){ const cx=(xa+xb)/2;
    m.box(xb-xa, 13.5, 0.2, M.gypsum, cx, 0, 12);                       // コア背面壁
    m.box(2.6, 13.8, 2.6, M.concrete, xa+1.6, 0, 4.0);                  // EV シャフト
    m.box(0.1, 13.8, 2.2, M.darkSteel, xa+2.95, 0, 4.0);
    for (const y of lv){ m.box(1.4, 2.2, 0.1, M.steel, xa+1.6, y, 5.35); }
    // 階段：1F→2F→3F 折返し
    for (let f=0; f<2; f++){ const yb = lv[f], yt = lv[f+1]; const n = 14; const rh = (yt-yb)/n;
      for (let i=0;i<n;i++){ const half = i<n/2; const t = half? i : i-n/2; m.box(1.3, rh, 0.28, M.steel, half? xa+5.0 : xa+6.4, yb+i*rh, half? 14.5 - t*0.28 : 12.5 + t*0.28); }
      m.box(2.8, 0.15, 1.2, M.steel, xa+5.7, yb+(yt-yb)/2-0.1, 12.0); m.box(0.04, 1.0, 5.0, M.darkSteel, xa+5.7, yb+rh*7, 14.5); }
    m.box(0.15, 2.2, 1.0, M.darkSteel, xb-0.2, 0, 16);                // WC 入口
    for (const y of lv){ m.box(3.5, 2.8, 0.15, M.gypsum, xb-1.9, y, 10.0); m.box(0.15, 2.8, 4.0, M.gypsum, xb-3.6, y, 12.0); }
  }
  core(x0, x0+8, E1, g1); core(x1-8, x1, E1, g1);
  // 2F⇔3F 吹抜け階段（ソフトと設計をつなぐ）
  { const xa = -22; const n = 14, rh = (lv[2]-lv[1])/n; for (let i=0;i<n;i++) E2.box(2.0, rh, 0.3, M.timber, xa, lv[1]+i*rh, 9 + i*0.32);
    E2.box(0.05, 1.0, n*0.32, M.glassTint, xa-1.0, lv[1]+rh*n/2, 9 + n*0.16); E2.box(0.05, 1.0, n*0.32, M.glassTint, xa+1.0, lv[1]+rh*n/2, 9 + n*0.16); }

  // ---------- マリオン インスタンス化 ----------
  const mI = new THREE.InstancedMesh(G.box(0.12, 1, 0.12), M.mullion, mullV.length); const tmp = new THREE.Object3D();
  mullV.forEach(([x,y,z,h,ry], i)=>{ tmp.position.set(x, y+h/2, z); tmp.rotation.set(0, ry, 0); tmp.scale.set(1, h, 1); tmp.updateMatrix(); mI.setMatrixAt(i, tmp.matrix); });
  mI.castShadow = true; mI.instanceMatrix.needsUpdate = true; mI.userData.layer = "envelope"; g1.add(mI);

  S.flush(g1, { name:"structure", layer:"structure" }); R.flush(gr, { name:"roofStruct", layer:"structure" });
  E1.flush(g1, { name:"env1", layer:"envelope" }); E2.flush(g2, { name:"env2", layer:"envelope" }); E3.flush(g3, { name:"env3", layer:"envelope" });

  { const sg = makeLabel("YELLOW", { scale:1.1, color:"#1a1400", bg:"rgba(242,199,68,0.97)" }); sg.position.set(x0+7, lv[1]-1.4, z1+3.7); sg.userData.kind = "sign"; g1.add(sg);
    const sg2 = makeLabel("YELLOW  FUSION FACTORY", { scale:0.9, color:"#1a1400", bg:"rgba(242,199,68,0.97)" }); sg2.position.set(x1+0.9, 12.5, 12); sg2.userData.kind = "sign"; g1.add(sg2); }
  // ---------- ゾーンラベル ----------
  for (const z of ZONES){ const [id, name, f, type, xa, xb, za, zb] = z; const g = f===0? layer("site") : floorGroup(f); const y = f===0? 0.3 : lv[f-1] + (f===1 && za<2? 6.5 : 3.0);
    const lb = makeLabel(name, { scale: 1.0, accent:"#"+ZTYPE[type].c.toString(16).padStart(6,"0") }); lb.position.set((xa+xb)/2, y, (za+zb)/2); lb.userData.zone = id; lb.userData.kind = "zone"; lb.userData.floor = f; g.add(lb); }
}
