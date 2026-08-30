
/* ================================================================
   L2 アリーナ内部 — BIM相当のディテールで構築
   ローカル座標: 原点=コート中心 / x=コート長軸(バスケットは x=±14.33) / y=上 / z=短軸
   建物方位は OSM フットプリントの主軸(27.3°)に合わせて interior 全体を回転
================================================================ */
const interior = new THREE.Group();
interior.position.set(ARENA_C.x, 0, ARENA_C.z);
interior.rotation.y = -27.3 * Math.PI / 180;
interior.visible = false;
scene.add(interior);

const bowlLight = new THREE.PointLight(0xfff4e0, 0, 420, 1.9);
bowlLight.position.set(0, 30, 0); interior.add(bowlLight);
const bowlAmb = new THREE.HemisphereLight(0xdce8ff, 0x0a0d16, 0);
interior.add(bowlAmb);

/* ---- ボウル形状（スーパー楕円リング） ---- */
const BOWL_N = 3.0;
function ringPt(a, b, t) {
  const c = Math.cos(t), s = Math.sin(t), p = 2 / BOWL_N;
  return [a * Math.sign(c) * Math.pow(Math.abs(c), p),
          b * Math.sign(s) * Math.pow(Math.abs(s), p)];
}
/* 周長パラメータ f∈[0,1) → 角度 t（等弧長サンプリング） */
function ringLUT(a, b, S) {
  const t = [], L = [0];
  let px = ringPt(a, b, 0)[0], py = ringPt(a, b, 0)[1], tot = 0;
  for (let i = 1; i <= S; i++) {
    const u = 2 * Math.PI * i / S, q = ringPt(a, b, u);
    tot += Math.hypot(q[0] - px, q[1] - py);
    px = q[0]; py = q[1]; t.push(u); L.push(tot);
  }
  return { L, tot, S };
}
function fracToT(lut, f) {
  const target = ((f % 1) + 1) % 1 * lut.tot;
  let lo = 0, hi = lut.L.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (lut.L[m] <= target) lo = m; else hi = m; }
  const k = (target - lut.L[lo]) / ((lut.L[hi] - lut.L[lo]) || 1);
  return 2 * Math.PI * (lo + k) / lut.S;
}

/* ---- ティア定義（実寸ベース。断面は段床 riser + tread） ---- */
const TIER = {
  /* 断面はティアが平面・断面ともに外へ積み上がるよう配置（下層の背後に上層が乗る） */
  L100: { a: 25.0, b: 17.5, rows: 24, tread: 0.82, rise: 0.45, y0: 1.55 },   // 背 a=44.7 / y=12.35
  PRM:  { a: 46.5, b: 39.0, rows: 11, tread: 0.90, rise: 0.42, y0: 15.00 },  // 背 a=56.4 / y=19.62
  L300: { a: 57.5, b: 50.0, rows: 9,  tread: 0.85, rise: 0.55, y0: 23.50 },  // 背 a=65.2 / y=28.45
};
const SEAT_PITCH = 0.52;

/* ================= コート / フロア（興行フォーマット可変） ================= */
const COURT = { w: 28.65, h: 15.24 };
function courtTexture(kind) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 545;
  const c = cv.getContext('2d');
  const sx = 1024 / COURT.w, sy = 545 / COURT.h;
  if (kind === 'NHL') {
    c.fillStyle = '#aebfd2'; c.fillRect(0, 0, 1024, 545);
    c.strokeStyle = '#c8342c'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(512, 0); c.lineTo(512, 545); c.stroke();
    c.strokeStyle = '#2b5fb8';
    [372, 652].forEach(x => { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 545); c.stroke(); });
    c.strokeStyle = '#c8342c'; c.lineWidth = 3;
    c.beginPath(); c.arc(512, 272, 52, 0, 7); c.stroke();
    c.fillStyle = '#101820'; c.font = '700 44px Oswald'; c.textAlign = 'center';
    c.fillText('LA KINGS', 512, 250);
  } else if (kind === 'CONCERT') {
    c.fillStyle = '#15171f'; c.fillRect(0, 0, 1024, 545);
    for (let i = 0; i < 900; i++) {           // フロアGA（スタンディング）
      c.fillStyle = 'rgba(120,150,210,' + (0.06 + Math.random() * 0.1) + ')';
      c.fillRect(Math.random() * 1024, Math.random() * 545, 3, 3);
    }
    c.fillStyle = '#0a0c12'; c.fillRect(0, 0, 250, 545);   // ステージ
    c.fillStyle = '#00c2ff'; c.font = '700 40px Oswald'; c.textAlign = 'center';
    c.save(); c.translate(125, 272); c.rotate(-Math.PI / 2); c.fillText('STAGE', 0, 14); c.restore();
  } else {                                     // NBA（Lakers ホーム）
    c.fillStyle = '#7d5f38'; c.fillRect(0, 0, 1024, 545);
    for (let i = 0; i < 60; i++) {             // 木目
      c.fillStyle = 'rgba(92,68,36,' + (0.16 + Math.random() * 0.14) + ')';
      c.fillRect(0, i * 9.2, 1024, 4);
    }
    c.fillStyle = '#3c1a5e';                   // ペイントエリア（Lakers purple）
    c.fillRect(0, 272 - 2.45 * sy, 5.79 * sx, 4.9 * sy);
    c.fillRect(1024 - 5.79 * sx, 272 - 2.45 * sy, 5.79 * sx, 4.9 * sy);
    c.strokeStyle = '#1b1b1b'; c.lineWidth = 4;
    c.strokeRect(5, 5, 1014, 535);
    c.beginPath(); c.moveTo(512, 0); c.lineTo(512, 545); c.stroke();
    c.beginPath(); c.arc(512, 272, 1.8 * sx, 0, 7); c.stroke();
    [0, 1024].forEach((bx, i) => {             // 3Pライン
      const d = i ? -1 : 1;
      c.beginPath();
      c.arc(bx + d * 1.575 * sx, 272, 7.24 * sx, i ? Math.PI * 0.62 : -Math.PI * 0.38,
            i ? Math.PI * 1.38 : Math.PI * 0.38);
      c.stroke();
    });
    c.save(); c.translate(512, 272);           // センターロゴ
    c.fillStyle = '#3c1a5e'; c.beginPath(); c.arc(0, 0, 1.75 * sx, 0, 7); c.fill();
    c.fillStyle = '#fdb927'; c.font = '700 30px Oswald'; c.textAlign = 'center';
    c.fillText('LAKERS', 0, 10); c.restore();
    c.fillStyle = '#4a2270'; c.font = '700 34px Oswald';
    c.fillText('CRYPTO.COM ARENA', 512, 46);
    c.fillStyle = '#8a7a4a'; c.font = '600 20px Oswald';
    c.fillText('VISITOR', 300, 520); c.fillText('HOME', 730, 520);
  }
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return t;
}
const courtMat = new THREE.MeshStandardMaterial({ map: courtTexture('NBA'), roughness: 0.42 });
const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.w, COURT.h), courtMat);
court.rotation.x = -Math.PI / 2; court.position.y = 0.02; interior.add(court);

/* イベントフロア（コート外周の仮設フロア面） */
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(62, 46),
  new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.92 }));
hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.y = -0.02; interior.add(hallFloor);

function setFloorFormat(kind) {
  courtMat.map.dispose();
  courtMat.map = courtTexture(kind);
  courtMat.needsUpdate = true;
  hoops.visible = (kind === 'NBA');
  stageGrp.visible = (kind === 'CONCERT');
}

/* ---- ゴール（バックボード＝スポンサー面） ---- */
const hoops = new THREE.Group(); interior.add(hoops);
(function goals() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 150;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4f6fa'; c.fillRect(0, 0, 256, 150);
  c.strokeStyle = '#d9564a'; c.lineWidth = 6; c.strokeRect(96, 88, 64, 48);
  c.strokeStyle = '#1b1e28'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 142);
  c.fillStyle = '#1b1e28'; c.font = '700 22px Oswald'; c.textAlign = 'center';
  c.fillText('SPONSOR', 128, 34);
  c.fillStyle = '#552583'; c.font = '700 15px Oswald'; c.fillText('LAKERS', 128, 60);
  const tex = new THREE.CanvasTexture(cv);
  for (const x of [-14.33, 14.33]) {
    const g = new THREE.Group();
    const d = x > 0 ? 1 : -1;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.9, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x20242e }));
    pole.position.set(x + d * 1.5, 1.95, 0);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.05),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(x + d * 0.55, 3.15, 0);
    board.rotation.y = d > 0 ? -Math.PI / 2 : Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.022, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0xd9564a, emissive: 0x4a1008 }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(x, 3.05, 0);
    g.add(pole, board, rim); hoops.add(g);
  }
})();

/* ---- コンサート ステージ ---- */
const stageGrp = new THREE.Group(); stageGrp.visible = false; interior.add(stageGrp);
(function stage() {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 1.8, 22),
    new THREE.MeshStandardMaterial({ color: 0x0d1018, roughness: 0.8 }));
  deck.position.set(-19, 0.9, 0); stageGrp.add(deck);
  for (let i = 0; i < 3; i++) {                 // ステージLEDスクリーン
    const s = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 6.6),
      new THREE.MeshBasicMaterial({ color: [0x1a4f8a, 0x0f6ea8, 0x1a4f8a][i] }));
    s.position.set(-18.4, 6.4, (i - 1) * 6.2); s.rotation.y = Math.PI / 2; stageGrp.add(s);
  }
  const truss = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3c }));
  truss.position.set(-15, 12.5, 0); stageGrp.add(truss);
})();

/* ================================================================
   BIM構造 — 段床(riser/tread) / ボミトリー / 手すり / 通路階段 /
   コンコース / 外周柱 / 屋根トラス / スイートボックス
   各部材は IFC 風属性を userData に持ち、クリックで属性カードを出す
================================================================ */
const bimGroup = new THREE.Group(); interior.add(bimGroup);

function bimPush(mesh, type, tag, attrs) {
  mesh.userData = { kind: 'bim', type, tag, attrs };
  BIM_ELEMS.push(mesh);
  return mesh;
}

/* ---- 段床（客席スタンドのコンクリート断面）をリング押し出しで生成 ---- */
function buildRisers(B, tier, colTop, colFace, seg) {
  const S = seg || 240;
  for (let r = 0; r < tier.rows; r++) {
    const a0 = tier.a + r * tier.tread, b0 = tier.b + r * tier.tread;
    const a1 = a0 + tier.tread, b1 = b0 + tier.tread;
    const y0 = tier.y0 + r * tier.rise, y1 = y0 + tier.rise;
    for (let i = 0; i < S; i++) {
      const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
      const p0 = ringPt(a0, b0, t0), p1 = ringPt(a0, b0, t1);
      const q0 = ringPt(a1, b1, t0), q1 = ringPt(a1, b1, t1);
      /* 踏面 */
      B.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [q1[0], y0, q1[1]], [q0[0], y0, q0[1]], colTop);
      /* 蹴上げ（次段の立ち上がり） */
      B.quad([q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [q1[0], y1, q1[1]], [q0[0], y1, q0[1]], colFace);
    }
  }
}

setLoad(76, 'ボウル構造 (段床/ボミトリー/トラス) を生成中');
(function structure() {
  const B = new Builder();
  const top = [0.19, 0.20, 0.24], face = [0.11, 0.12, 0.15];
  buildRisers(B, TIER.L100, top, face);
  buildRisers(B, TIER.PRM, [0.17, 0.15, 0.21], [0.10, 0.09, 0.13], 200);
  buildRisers(B, TIER.L300, top, face, 260);
  const m = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.94, side: THREE.DoubleSide }));
  bimGroup.add(bimPush(m, 'IfcSlab', 'STAND-CONC', {
    '部材種別': '段床スラブ (Cast-in-place RC)', '踏面': '820 / 850 / 900 mm',
    '蹴上げ': '450 / 520 / 420 mm', '対象階': '100 / Premier / 300 Level',
    '備考': '実断面はBIM(IFC/Revit)接続で置換可能' }));

  /* --- ボウル底部の擁壁（フロアとの段差） --- */
  const W = new Builder(), wc = [0.09, 0.10, 0.13];
  const S = 200;
  for (let i = 0; i < S; i++) {
    const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
    const p0 = ringPt(TIER.L100.a, TIER.L100.b, t0), p1 = ringPt(TIER.L100.a, TIER.L100.b, t1);
    W.quad([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], TIER.L100.y0, p1[1]], [p0[0], TIER.L100.y0, p0[1]], wc);
  }
  bimGroup.add(new THREE.Mesh(W.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
})();

/* ---- 手すり（各ティア最前列・最後列 / 通路） ---- */
(function rails() {
  const G = new Builder(), rc = [0.42, 0.46, 0.55];
  const bar = (a, b, y, h) => {
    const S = 220;
    for (let i = 0; i < S; i++) {
      const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
      const p0 = ringPt(a, b, t0), p1 = ringPt(a, b, t1);
      G.quad([p0[0], y, p0[1]], [p1[0], y, p1[1]], [p1[0], y + h, p1[1]], [p0[0], y + h, p0[1]], rc);
    }
  };
  bar(TIER.L100.a - 0.15, TIER.L100.b - 0.15, TIER.L100.y0, 1.05);
  bar(TIER.L300.a - 0.15, TIER.L300.b - 0.15, TIER.L300.y0, 1.15);
  bar(TIER.PRM.a - 0.15, TIER.PRM.b - 0.15, TIER.PRM.y0, 1.0);
  const m = new THREE.Mesh(G.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide }));
  bimGroup.add(bimPush(m, 'IfcRailing', 'RAIL-BOWL', {
    '部材種別': '転落防止手すり (SUS304 φ48.6)', '高さ': 'H=1,050 / 1,150 mm',
    '設置位置': '各ティア最前列', '準拠': 'IBC 1015 Guards' }));
})();

/* ---- ボミトリー（客席への進入開口）と通路階段 ---- */
const VOMS = [];
(function vomitories() {
  const G = new Builder(), vc = [0.05, 0.055, 0.07], sc = [0.26, 0.27, 0.32];
  const lut100 = ringLUT(TIER.L100.a, TIER.L100.b, 720);
  const lut300 = ringLUT(TIER.L300.a, TIER.L300.b, 720);
  const mk = (tier, lut, f, wFrac, label) => {
    const t = fracToT(lut, f);
    const rowsY = tier.y0 + tier.rows * tier.rise;
    const aB = tier.a + tier.rows * tier.tread, bB = tier.b + tier.rows * tier.tread;
    const p = ringPt(aB, bB, t);
    VOMS.push({ x: p[0], z: p[1], y: rowsY, label });
    /* 開口（暗い箱として掘り込みを表現） */
    const w = wFrac;
    for (let k = -1; k <= 1; k += 2) {
      const q = ringPt(aB + 2.4, bB + 2.4, t + k * w);
      const r = ringPt(aB, bB, t + k * w);
      G.quad([r[0], rowsY - 2.6, r[1]], [q[0], rowsY - 2.6, q[1]],
             [q[0], rowsY + 0.4, q[1]], [r[0], rowsY + 0.4, r[1]], vc);
    }
    /* 通路階段（段板を段床に沿って積む） */
    for (let r = 0; r < tier.rows; r++) {
      const a0 = tier.a + r * tier.tread, b0 = tier.b + r * tier.tread;
      const y = tier.y0 + r * tier.rise + 0.02;
      const s0 = ringPt(a0, b0, t - w * 0.55), s1 = ringPt(a0, b0, t + w * 0.55);
      const e0 = ringPt(a0 + tier.tread, b0 + tier.tread, t - w * 0.55);
      const e1 = ringPt(a0 + tier.tread, b0 + tier.tread, t + w * 0.55);
      G.quad([s0[0], y, s0[1]], [s1[0], y, s1[1]], [e1[0], y, e1[1]], [e0[0], y, e0[1]], sc);
    }
  };
  for (let i = 0; i < 19; i++) mk(TIER.L100, lut100, (i + 0.5) / 19, 0.036, 'VOM-1' + String(i + 1).padStart(2, '0'));
  for (let i = 0; i < 17; i++) mk(TIER.L300, lut300, (i + 0.5) / 17, 0.030, 'VOM-3' + String(i + 1).padStart(2, '0'));
  const m = new THREE.Mesh(G.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  bimGroup.add(bimPush(m, 'IfcStair', 'VOM-STAIR', {
    '部材種別': 'ボミトリー開口 + 客席通路階段', '数量': '100L×19 / 300L×17',
    '有効幅': '1,120 mm', '準拠': 'IBC 1030 Assembly Aisles' }));
})();

/* ---- コンコース（100 / 300 の外周スラブ）と外周柱 ---- */
(function concourse() {
  const B = new Builder(), cc = [0.085, 0.09, 0.115], col = [0.10, 0.105, 0.13];
  const ringSlab = (a, b, w, y) => {
    const S = 220;
    for (let i = 0; i < S; i++) {
      const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
      const p0 = ringPt(a, b, t0), p1 = ringPt(a, b, t1);
      const q0 = ringPt(a + w, b + w, t0), q1 = ringPt(a + w, b + w, t1);
      B.quad([p0[0], y, p0[1]], [p1[0], y, p1[1]], [q1[0], y, q1[1]], [q0[0], y, q0[1]], cc);
    }
  };
  const back100 = TIER.L100.a + TIER.L100.rows * TIER.L100.tread;
  const back300a = TIER.L300.a + TIER.L300.rows * TIER.L300.tread;
  const back300b = TIER.L300.b + TIER.L300.rows * TIER.L300.tread;
  ringSlab(back100 + 2.0, TIER.L100.b + TIER.L100.rows * TIER.L100.tread + 2.0, 11, 12.0);
  ringSlab(back300a + 2.0, back300b + 2.0, 10, 28.0);

  /* 外周柱（RC 800角・24本） */
  const NC = 24, aOut = back300a + 12, bOut = back300b + 12;
  for (let i = 0; i < NC; i++) {
    const p = ringPt(aOut, bOut, 2 * Math.PI * i / NC), s = 0.8;
    for (const d of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const n = [-d[1], d[0]];
      B.quad([p[0] + (d[0] - n[0]) * s, 0, p[1] + (d[1] - n[1]) * s],
             [p[0] + (d[0] + n[0]) * s, 0, p[1] + (d[1] + n[1]) * s],
             [p[0] + (d[0] + n[0]) * s, 34, p[1] + (d[1] + n[1]) * s],
             [p[0] + (d[0] - n[0]) * s, 34, p[1] + (d[1] - n[1]) * s], col);
    }
  }
  const m = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
  bimGroup.add(bimPush(m, 'IfcColumn', 'STR-COL/SLAB', {
    '部材種別': 'RC柱 800×800 / コンコーススラブ t=200',
    '本数': '外周柱 24本', 'レベル': 'FL+12.0 / FL+28.0',
    '構造設計': 'John A. Martin & Associates（実建物）' }));
})();

/* ---- 屋根トラス（放射 + リング） / キャットウォーク ---- */
const roofSlab = new THREE.Group(); interior.add(roofSlab);
const trussGrp = new THREE.Group(); interior.add(trussGrp);
(function roof() {
  const B = new Builder(), tc = [0.10, 0.105, 0.13], cw = [0.075, 0.08, 0.10];
  const aR = TIER.L300.a + TIER.L300.rows * TIER.L300.tread + 14;
  const bR = TIER.L300.b + TIER.L300.rows * TIER.L300.tread + 14;
  const beam = (p0, y0, p1, y1, s) => {
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L * s, nz = dx / L * s;
    B.quad([p0[0] + nx, y0, p0[1] + nz], [p1[0] + nx, y1, p1[1] + nz],
           [p1[0] - nx, y1, p1[1] - nz], [p0[0] - nx, y0, p0[1] - nz], tc);
    B.quad([p0[0] + nx, y0 + s * 1.6, p0[1] + nz], [p1[0] + nx, y1 + s * 1.6, p1[1] + nz],
           [p1[0] - nx, y1 + s * 1.6, p1[1] - nz], [p0[0] - nx, y0 + s * 1.6, p0[1] - nz], tc);
  };
  const NR = 20;
  for (let i = 0; i < NR; i++) {              // 放射トラス（中央がドーム状に上がる）
    const t = 2 * Math.PI * i / NR;
    const o = ringPt(aR, bR, t), o2 = ringPt(aR, bR, t + Math.PI);
    const steps = 12;
    for (let k = 0; k < steps; k++) {
      const u0 = k / steps, u1 = (k + 1) / steps;
      const p0 = [lerp(o[0], o2[0], u0), lerp(o[1], o2[1], u0)];
      const p1 = [lerp(o[0], o2[0], u1), lerp(o[1], o2[1], u1)];
      const y0 = 34 + Math.sin(Math.PI * u0) * 6.5, y1 = 34 + Math.sin(Math.PI * u1) * 6.5;
      if (i < NR / 2) beam(p0, y0, p1, y1, 0.42);
    }
  }
  for (const k of [0.42, 0.62, 0.82, 1.0]) {  // リングトラス
    const S = 40, aa = aR * k, bb = bR * k, y = 34 + Math.sin(Math.PI * (1 - k) * 0.5) * 6.2;
    for (let i = 0; i < S; i++) {
      const p0 = ringPt(aa, bb, 2 * Math.PI * i / S), p1 = ringPt(aa, bb, 2 * Math.PI * (i + 1) / S);
      beam(p0, y, p1, y, 0.34);
    }
  }
  /* キャットウォーク（照明・音響吊り込み動線） */
  for (const k of [0.5, 0.75]) {
    const S = 48, aa = aR * k, bb = bR * k;
    for (let i = 0; i < S; i++) {
      const p0 = ringPt(aa, bb, 2 * Math.PI * i / S), p1 = ringPt(aa, bb, 2 * Math.PI * (i + 1) / S);
      const dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * 0.9, nz = dx / L * 0.9, y = 33.2;
      B.quad([p0[0] + nx, y, p0[1] + nz], [p1[0] + nx, y, p1[1] + nz],
             [p1[0] - nx, y, p1[1] - nz], [p0[0] - nx, y, p0[1] - nz], cw);
    }
  }
  /* 屋根スラブ */
  const S = 60, R = new Builder(), rc = [0.07, 0.08, 0.11];
  for (let i = 0; i < S; i++) {
    const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
    const p0 = ringPt(aR, bR, t0), p1 = ringPt(aR, bR, t1);
    R.tri([p0[0], 34, p0[1]], [p1[0], 34, p1[1]], [0, 41, 0], rc);
  }
  roofSlab.add(new THREE.Mesh(R.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })));
  const m = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.3, roughness: 0.75, side: THREE.DoubleSide }));
  trussGrp.add(bimPush(m, 'IfcBeam', 'ROOF-TRUSS', {
    '部材種別': '屋根トラス（放射20 + リング4）+ キャットウォーク',
    '最高高さ': 'FL+41.0 m', 'スパン': '約 130 m',
    '用途': '照明バトン・音響・センターハング吊点' }));
})();

/* ================= スイート / Premier ボックス (PR1-PR18) ================= */
const SUITES = [];
(function suites() {
  const lut = ringLUT(TIER.PRM.a - 0.5, TIER.PRM.b - 0.5, 720);
  /* 周方向配置: 南側 PR5-PR9 → 西 205-210 → 北 PR10-PR18 → 東 214-219 → 南 PR1-PR4 */
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2a4a6e, transparent: true, opacity: 0.34, metalness: 0.5, roughness: 0.15,
    side: THREE.DoubleSide });
  const frame = new THREE.MeshStandardMaterial({ color: 0x1a1d26, roughness: 0.8 });
  const layout = SUITE_LAYOUT;                 // 50_bowl.js で定義（席番と共有）
  for (const s of layout) {
    const t = fracToT(lut, (s.f0 + s.f1) / 2);
    const p = ringPt(TIER.PRM.a - 0.5, TIER.PRM.b - 0.5, t);
    const w = Math.abs(s.f1 - s.f0) * lut.tot * 0.86;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, 3.1, 5.4), glass);
    const ang = Math.atan2(p[0], p[1]);
    box.position.set(p[0] * 1.045, TIER.PRM.y0 + 1.55, p[1] * 1.045);
    box.rotation.y = ang + Math.PI / 2;
    box.userData = { kind: 'suite', name: s.sec };
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w, 0.34, 5.6), frame);
    sill.position.copy(box.position); sill.position.y = TIER.PRM.y0 + 0.15;
    sill.rotation.y = box.rotation.y;
    interior.add(box, sill);
    SUITES.push(box);
  }
})();

/* ================= 演出・媒体 — センターハング / LED / リボン ================= */
const ledBoards = [];      // {x,z,y,nx,nz,w,h,name,type,contract,share}
function ledTex(names, cols, wpx, hpx, bg) {
  const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx;
  const c = cv.getContext('2d');
  c.fillStyle = bg || '#0a0d16'; c.fillRect(0, 0, wpx, hpx);
  const seg = wpx / names.length;
  names.forEach((n, i) => {
    c.fillStyle = cols[i % cols.length];
    c.font = '700 ' + Math.round(hpx * 0.52) + 'px Oswald';
    c.textAlign = 'center';
    c.fillText(n, i * seg + seg / 2, hpx * 0.70);
  });
  return new THREE.CanvasTexture(cv);
}
setLoad(82, 'スポンサー媒体を生成中');
(function media() {
  /* --- コートサイドLED（4面） --- */
  const CS = [
    { w: 26, x: 0, z: -9.6, ry: 0, nx: 0, nz: 1, nm: 'Delta', id: 'LED-CS-N', v: 2100000 },
    { w: 26, x: 0, z: 9.6, ry: Math.PI, nx: 0, nz: -1, nm: 'crypto.com', id: 'LED-CS-S', v: 3400000 },
    { w: 15, x: -16.4, z: 0, ry: Math.PI / 2, nx: 1, nz: 0, nm: 'American Express', id: 'LED-CS-W', v: 1500000 },
    { w: 15, x: 16.4, z: 0, ry: -Math.PI / 2, nx: -1, nz: 0, nm: 'Bibigo', id: 'LED-CS-E', v: 1500000 },
  ];
  for (const b of CS) {
    const tex = ledTex([b.nm], ['#00d4ff'], 1024, 96);
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.95, 0.22),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 1.15, color: 0x0a0d16 }));
    m.position.set(b.x, 0.5, b.z); m.rotation.y = b.ry;
    m.userData = { kind: 'led', name: b.nm };
    interior.add(m);
    ledBoards.push({ x: b.x, z: b.z, y: 0.5, nx: b.nx, nz: b.nz, w: b.w, h: 0.95,
      name: b.nm, id: b.id, type: 'COURTSIDE_LED', contract: b.v, share: 1 / 4 });
  }
  /* --- リボンビジョン（100Lフェイシア 全周） --- */
  const rNames = ['crypto.com', 'Delta', 'BODYARMOR', 'AMEX', 'Bibigo', 'Kia', 'STATE FARM', 'Verizon'];
  const rTex = ledTex(rNames, ['#fdb927', '#00d4ff', '#e9edf6'], 2048, 48);
  const rMat = new THREE.MeshStandardMaterial({ map: rTex, emissive: 0xffffff,
    emissiveMap: rTex, emissiveIntensity: 0.8, color: 0x0a0d16, side: THREE.DoubleSide });
  (function ribbon() {
    const a = TIER.L100.a + TIER.L100.rows * TIER.L100.tread + 1.2;
    const b = TIER.L100.b + TIER.L100.rows * TIER.L100.tread + 1.2;
    const S = 160, P = [], NRM = [], UV = [];
    const y0 = 12.6, y1 = 13.5;
    for (let i = 0; i < S; i++) {
      const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
      const p0 = ringPt(a, b, t0), p1 = ringPt(a, b, t1);
      const u0 = i / S, u1 = (i + 1) / S;
      P.push(p0[0], y0, p0[1], p1[0], y0, p1[1], p1[0], y1, p1[1],
             p0[0], y0, p0[1], p1[0], y1, p1[1], p0[0], y1, p0[1]);
      const n0 = [-p0[0], 0, -p0[1]], L0 = Math.hypot(n0[0], n0[2]) || 1;
      for (let k = 0; k < 6; k++) NRM.push(n0[0] / L0, 0, n0[2] / L0);
      UV.push(u0 * 6, 0, u1 * 6, 0, u1 * 6, 1, u0 * 6, 0, u1 * 6, 1, u0 * 6, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(NRM, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    rTex.wrapS = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, rMat);
    m.userData = { kind: 'led', name: 'リボンビジョン（全周）' };
    interior.add(m);
    /* 露出計算用に4方位へ分解して登録 */
    const quads = [['N', 0, -b, 0, 1], ['S', 0, b, 0, -1], ['W', -a, 0, 1, 0], ['E', a, 0, -1, 0]];
    for (const q of quads)
      ledBoards.push({ x: q[1], z: q[2], y: 13.0, nx: q[3], nz: q[4],
        w: q[0] === 'N' || q[0] === 'S' ? a * 1.4 : b * 1.4, h: 0.9,
        name: 'リボンビジョン ' + q[0], id: 'RIB-' + q[0], type: 'RIBBON',
        contract: 900000, share: 1 / 8 });
  })();

  /* --- センターハング スコアボード --- */
  const scr = [];
  const sg = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const tex = scoreTex(i);
    const w = i % 2 === 0 ? 8.2 : 5.6;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.6),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.95, color: 0x05070c, side: THREE.DoubleSide }));
    const ang = i * Math.PI / 2;
    m.position.set(Math.sin(ang) * (i % 2 === 0 ? 2.9 : 4.2), 0, Math.cos(ang) * (i % 2 === 0 ? 2.9 : 4.2));
    m.rotation.y = ang;
    sg.add(m); scr.push(tex);
  }
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.6, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0d1a2c, emissive: 0x00527a,
      emissiveIntensity: 0.7, side: THREE.DoubleSide }));
  halo.position.y = 3.1; sg.add(halo);
  sg.position.y = 21.5;
  sg.userData = { kind: 'led', name: 'センターハング スコアボード' };
  interior.add(sg);
  for (let i = 0; i < 4; i++) {
    const ang = i * Math.PI / 2;
    ledBoards.push({ x: Math.sin(ang) * 3, z: Math.cos(ang) * 3, y: 21.5,
      nx: Math.sin(ang), nz: Math.cos(ang), w: 8.2, h: 4.6,
      name: 'センターハング ' + ['N', 'E', 'S', 'W'][i], id: 'SCB-' + i,
      type: 'SCOREBOARD', contract: 2600000, share: 1 / 4 });
  }
  window.__scoreTex = scr;

  /* --- 上層 壁面スポンサーパネル --- */
  const wallNames = [['STATE FARM', 'Kia'], ['Verizon', 'BODYARMOR'],
                     ['Toyota', 'Herbalife'], ['UCLA Health', 'Coors Light']];
  const aW = TIER.L300.a + TIER.L300.rows * TIER.L300.tread + 3;
  const bW = TIER.L300.b + TIER.L300.rows * TIER.L300.tread + 3;
  const dirs = [[0, -1, 0, 0], [1, 0, Math.PI / 2, 1], [0, 1, Math.PI, 2], [-1, 0, -Math.PI / 2, 3]];
  dirs.forEach((d, i) => {
    const tex = ledTex(wallNames[i], ['#fdb927', '#9fb4d8'], 1024, 128, '#111622');
    const w = d[0] !== 0 ? bW * 1.1 : aW * 1.1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.0),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0x666666, emissiveMap: tex,
        emissiveIntensity: 0.45, color: 0x111622, side: THREE.FrontSide }));
    m.position.set(d[0] * aW, 31.5, d[1] * bW);
    m.rotation.y = Math.atan2(-d[0] * aW, -d[1] * bW);   // 法線をコート中心へ向ける
    m.userData = { kind: 'led', name: '壁面: ' + wallNames[i].join(' / ') };
    interior.add(m);
    ledBoards.push({ x: d[0] * aW, z: d[1] * bW, y: 31.5, nx: -d[0], nz: -d[1],
      w: w, h: 3.0, name: '壁面看板 ' + ['N', 'E', 'S', 'W'][i], id: 'WALL-' + i,
      type: 'WALL', contract: 620000, share: 1 });
  });
})();

/* ---- スコアボード テクスチャ（試合連動） ---- */
function scoreTex(i) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
  const t = new THREE.CanvasTexture(cv);
  t.__cv = cv; t.__c = cv.getContext('2d'); t.__i = i;
  return t;
}
function paintScore(g) {
  for (const tex of (window.__scoreTex || [])) {
    const c = tex.__c;
    c.fillStyle = '#05070c'; c.fillRect(0, 0, 512, 288);
    c.fillStyle = '#552583'; c.fillRect(0, 0, 512, 8);
    c.textAlign = 'center';
    c.fillStyle = '#8590a8'; c.font = '600 22px Oswald';
    c.fillText(g.away, 128, 60); c.fillText('LAKERS', 384, 60);
    c.fillStyle = '#e9edf6'; c.font = '600 76px Oswald';
    c.fillText(String(g.aScore), 128, 140);
    c.fillStyle = '#fdb927'; c.fillText(String(g.hScore), 384, 140);
    c.fillStyle = g.live ? '#3ddc84' : '#8590a8'; c.font = '600 26px Oswald';
    c.fillText(g.label, 256, 200);
    if (g.clock) { c.fillStyle = '#e9edf6'; c.font = '600 34px Oswald'; c.fillText(g.clock, 256, 244); }
    c.fillStyle = '#00c2ff'; c.font = '600 15px Oswald';
    c.fillText('CRYPTO.COM ARENA', 256, 275);
    tex.needsUpdate = true;
  }
}
