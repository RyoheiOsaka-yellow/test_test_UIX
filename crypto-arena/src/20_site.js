/* ================================================================
   L0 サイト — Downtown Los Angeles 実GIS (OpenStreetMap / ODbL)
   表示モード: SOLID(実体) / POINT(点描) / WIRE(線画) / BLUEPRINT(青焼き)
   交通インフラは bridge / tunnel / layer を反映して高架・地下を作り分ける
================================================================ */
const site = new THREE.Group(); scene.add(site);
const siteStats = { points: 0, segs: 0 };
const gSolid = new THREE.Group(); site.add(gSolid);   // 実体
const gPoint = new THREE.Group(); site.add(gPoint);   // 点描
const gWire  = new THREE.Group(); site.add(gWire);    // 線画 / 青焼き
const gInfra = new THREE.Group(); site.add(gInfra);   // 交通インフラ（全モード共通で表示）
const gMark  = new THREE.Group(); site.add(gMark);    // POI/駅マーカー（L0のみ）
const gClose = new THREE.Group(); site.add(gClose);   // 200m圏の建物（L1では詳細モデルに譲る）

/* ---- ジオメトリ組み立てヘルパ（マージ済みBufferGeometryを直接構築） ---- */
function Builder() { this.p = []; this.n = []; this.c = []; }
Builder.prototype.tri = function (a, b, c, col) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
  this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  if (col) for (let i = 0; i < 3; i++) this.c.push(col[0], col[1], col[2]);
};
Builder.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
Builder.prototype.geom = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
  if (this.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  return g;
};
const area2 = pts => { let s = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
  s += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return s / 2; };

/* ---- 建物押し出し（壁 + 屋根） ---- */
const tmpC = new THREE.Color();
function addBuilding(B, poly, h, colHex) {
  let p = poly.slice();
  if (p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  if (p.length < 3) return;
  if (area2(p) < 0) p.reverse();
  tmpC.setHex(colHex);
  const col = [tmpC.r, tmpC.g, tmpC.b];
  const dk = [tmpC.r * 0.62, tmpC.g * 0.62, tmpC.b * 0.66];
  for (let i = 0; i < p.length; i++) {          // 壁
    const a = p[i], b = p[(i + 1) % p.length];
    B.quad([a[0], 0, -a[1]], [b[0], 0, -b[1]], [b[0], h, -b[1]], [a[0], h, -a[1]], dk);
  }
  try {                                          // 屋根
    const f = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []);
    for (const t of f)
      B.tri([p[t[0]][0], h, -p[t[0]][1]], [p[t[2]][0], h, -p[t[2]][1]], [p[t[1]][0], h, -p[t[1]][1]], col);
  } catch (e) { /* 自己交差ポリゴンはスキップ */ }
}
/* 高さ→色（低層=暗い / 高層=明るい。DTLAのスカイラインを読み取れるように） */
const bldColor = h => {
  const k = clamp(h / 150, 0, 1);
  return new THREE.Color(0x2a3346).lerp(new THREE.Color(0x8fa6c4), k * k * 0.8 + k * 0.2).getHex();
};

/* ---- リボン（道路・線路を幅のある帯として敷く） ---- */
function addRibbon(B, pts, w, y, col) {
  const h = w / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy); if (L < 0.01) continue;
    const nx = -dy / L * h, ny = dx / L * h;
    /* z反転座標系では data 空間の左回りが描画空間で右回りになる。
       上向き法線（FrontSideで見える）になる順で頂点を積む。 */
    B.quad([a[0] - nx, y, -(a[1] - ny)], [b[0] - nx, y, -(b[1] - ny)],
           [b[0] + nx, y, -(b[1] + ny)], [a[0] + nx, y, -(a[1] + ny)], col);
  }
}

/* ================= 建物 ================= */
setLoad(12, '建物を生成中 (near ' + SCENE_DATA.buildings.length + ' / mid ' + SCENE_DATA.mid.length + ')');
(function buildings() {
  const B = new Builder(), C = new Builder();
  for (const b of SCENE_DATA.buildings) {
    const h = b.h || (6 + hrand(b.p.length * 977 + Math.round(b.p[0][0]), 11) * 14);
    /* アリーナ200m圏は L1 で詳細モデル（広場・ファサード）に置き換えるため別メッシュに分ける */
    const near = Math.hypot(b.p[0][0], b.p[0][1]) < 200;
    addBuilding(near ? C : B, b.p, h, bldColor(h));
  }
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.05 });
  gSolid.add(new THREE.Mesh(B.geom(), m));
  gClose.add(new THREE.Mesh(C.geom(), m));

  const M = new Builder();
  for (const b of SCENE_DATA.mid) {
    const h = 7 + hrand(Math.round(b.p[0][0] * 7 + b.p[0][1]), 23) * 22;
    addBuilding(M, b.p, h, 0x1e2636);
  }
  gSolid.add(new THREE.Mesh(M.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, fog: true })));

  /* 遠景ドット（>2.8km の建物重心） */
  const d = SCENE_DATA.dots, pos = new Float32Array(d.length / 2 * 3);
  for (let i = 0, j = 0; i < d.length; i += 2) {
    pos[j++] = d[i]; pos[j++] = 9 + ((i * 37) % 23); pos[j++] = -d[i + 1];
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  site.add(new THREE.Points(dg, new THREE.PointsMaterial({
    color: 0x2e4468, size: 5.5, sizeAttenuation: true, transparent: true, opacity: 0.75 })));
})();

/* ================= 地面・土地利用・駐車場 ================= */
setLoad(26, '地表面を生成中');
(function ground() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(17000, 17000),
    new THREE.MeshStandardMaterial({ color: 0x060910, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; g.position.y = -0.4; site.add(g);

  const LU = { park: 0x16321f, retail: 0x231a2c, edu: 0x14263a, water: 0x0d2740 };
  const B = new Builder();
  for (const k in SCENE_DATA.lu) {
    tmpC.setHex(LU[k]); const col = [tmpC.r, tmpC.g, tmpC.b];
    for (const poly of SCENE_DATA.lu[k]) {
      let p = poly.slice();
      if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
      if (p.length < 3) continue;
      if (area2(p) < 0) p.reverse();
      try {
        const f = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []);
        for (const t of f)
          B.tri([p[t[0]][0], 0.05, -p[t[0]][1]], [p[t[2]][0], 0.05, -p[t[2]][1]],
                [p[t[1]][0], 0.05, -p[t[1]][1]], col);
      } catch (e) { }
    }
  }
  gSolid.add(new THREE.Mesh(B.geom(), new THREE.MeshBasicMaterial({ vertexColors: true })));

  /* 駐車場（試合日の需要ヒートの対象。宇都宮版と同じくレイヤーとして保持） */
  const P = new Builder(); const pc = [0.16, 0.13, 0.09];
  for (const poly of SCENE_DATA.parking) {
    let p = poly.slice();
    if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    if (p.length < 3) continue;
    if (area2(p) < 0) p.reverse();
    try {
      const f = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []);
      for (const t of f)
        P.tri([p[t[0]][0], 0.12, -p[t[0]][1]], [p[t[2]][0], 0.12, -p[t[2]][1]],
              [p[t[1]][0], 0.12, -p[t[1]][1]], pc);
    } catch (e) { }
  }
  const pm = new THREE.Mesh(P.geom(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  pm.name = 'parking'; gSolid.add(pm);
})();

/* ================= 道路（クラス別 幅・色・高架/地下） ================= */
setLoad(40, '道路網 ' + SCENE_DATA.roads.length + ' を生成中');

const ROAD_W = [5.5, 9, 13, 18, 27];                    // c=0..4 車道幅(m)
const ROAD_COL = [];
ROAD_COL[0] = 0x333e57;   // residential / service
ROAD_COL[1] = 0x3f4d6d;   // tertiary
ROAD_COL[2] = 0x475a80;   // secondary
ROAD_COL[3] = 0x5c6f9b;   // primary  (Figueroa / Olympic / Pico)
ROAD_COL[4] = 0xa08a56;   // motorway (I-110 Harbor Fwy / I-10 Santa Monica Fwy)

(function roads() {
  const B = new Builder();
  const bridges = [];
  for (const r of SCENE_DATA.roads) {
    const c = r.c, w = ROAD_W[c] * (r.ln ? clamp(r.ln / (c >= 3 ? 4 : 2), 0.7, 2.2) : 1);
    tmpC.setHex(ROAD_COL[c]);
    const col = [tmpC.r, tmpC.g, tmpC.b];
    if (r.b === -1) continue;                           // トンネルは地表に描かない
    if (r.b === 1) { bridges.push(r); continue; }       // 高架は別レイヤーで橋脚付き
    addRibbon(B, r.p, w, 0.18 + c * 0.05, col);
  }
  gSolid.add(new THREE.Mesh(B.geom(), new THREE.MeshBasicMaterial({ vertexColors: true })));

  /* --- 高架構造（橋桁 + 橋脚）: フリーウェイ ランプ・跨線橋を立体で再現 --- */
  const D = new Builder();
  const deckC = [0.20, 0.19, 0.17], pierC = [0.13, 0.13, 0.15];
  for (const r of bridges) {
    const y = 7.5 + (r.ly || 1) * 1.6, w = ROAD_W[r.c];
    addRibbon(D, r.p, w, y, deckC);
    for (let i = 0; i < r.p.length - 1; i++) {          // 桁側面
      const a = r.p[i], b = r.p[i + 1];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy); if (L < 0.01) continue;
      const nx = -dy / L * w / 2, ny = dx / L * w / 2;
      for (const s of [1, -1]) {
        D.quad([a[0] + nx * s, y, -(a[1] + ny * s)], [b[0] + nx * s, y, -(b[1] + ny * s)],
               [b[0] + nx * s, y - 1.6, -(b[1] + ny * s)], [a[0] + nx * s, y - 1.6, -(a[1] + ny * s)], pierC);
      }
    }
    for (let i = 0; i < r.p.length; i += 2) {           // 橋脚
      const q = r.p[i], s = 1.5;
      for (const d of [[1, 0], [0, 1]])
        D.quad([q[0] - d[0] * s, 0, -(q[1] - d[1] * s)], [q[0] + d[0] * s, 0, -(q[1] + d[1] * s)],
               [q[0] + d[0] * s, y - 1.6, -(q[1] + d[1] * s)], [q[0] - d[0] * s, y - 1.6, -(q[1] - d[1] * s)], pierC);
    }
  }
  const deckMesh = new THREE.Mesh(D.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  deckMesh.name = 'bridgeDeck';
  gInfra.add(deckMesh);
})();

/* ================= 鉄道 — Metro A/B/D/E Line & 貨物線 ================= */
setLoad(56, 'Metro 鉄道網を生成中');
const METRO_COL = {                                     // LA Metro 公式ラインカラー
  'Metro A Line': 0x0072ce, 'Metro E Line': 0xfdb913,
  'Metro B Line': 0xe4002b, 'Metro D Line': 0xa05da5,
  'Metro A & E Lines': 0x1f9bd8, 'Metro B & D Lines': 0xc43a63,
};
const railInfo = { tunnel: 0, grade: 0, elev: 0 };
(function rails() {
  const G = new Builder(), U = new Builder(), E = new Builder();
  for (const r of SCENE_DATA.railMetro) {
    const cHex = METRO_COL[r.n] || 0x6f7f9c;
    tmpC.setHex(cHex);
    const col = [tmpC.r, tmpC.g, tmpC.b];
    if (r.b === -1) { railInfo.tunnel++; addRibbon(U, r.p, 6.5, -7.5, col); }
    else if (r.b === 1) { railInfo.elev++; addRibbon(E, r.p, 7, 9.5, col); }
    else { railInfo.grade++; addRibbon(G, r.p, 6.5, 0.55, col); }
  }
  const mk = (b, o) => new THREE.Mesh(b.geom(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: o < 1, opacity: o, depthWrite: o >= 1 }));
  gInfra.add(mk(G, 1));
  const uMesh = mk(U, 0.42); uMesh.name = 'railTunnel'; gInfra.add(uMesh);   // 地下は半透過で「見せる」
  gInfra.add(mk(E, 1));

  const H = new Builder(), hc = [0.30, 0.26, 0.22];
  for (const r of SCENE_DATA.railHeavy) addRibbon(H, r.p, 5, 0.5, hc);
  gInfra.add(new THREE.Mesh(H.geom(), new THREE.MeshBasicMaterial({ vertexColors: true })));
})();

/* ---- 駅マーカー（Pico / 7th St Metro Center ほか） ---- */
const stationMarks = [];
(function stations() {
  const geo = new THREE.CylinderGeometry(7, 7, 2.4, 14);
  const ring = new THREE.RingGeometry(11, 13.5, 24);
  for (const s of SCENE_DATA.stations) {
    if (Math.hypot(s.p[0], s.p[1]) > 2600) continue;
    const near = Math.hypot(s.p[0], s.p[1]) < 700;
    const col = near ? 0x00c2ff : 0x53688c;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: near ? 0.8 : 0.3 }));
    m.position.set(s.p[0], 1.4, -s.p[1]);
    m.userData = { kind: 'station', name: s.n,
      desc: (s.k === 'subway' ? '地下鉄駅' : 'ライトレール駅') +
            '<br>アリーナ中心から ' + fmt(Math.hypot(s.p[0], s.p[1])) + ' m' };
    gMark.add(m); stationMarks.push(m);
    const rr = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: near ? 0.55 : 0.25, side: THREE.DoubleSide }));
    rr.rotation.x = -Math.PI / 2; rr.position.set(s.p[0], 0.7, -s.p[1]); gMark.add(rr);
  }
})();

/* ================= アリーナ外殻（L0 のクリック対象） ================= */
const ARENA_C = { x: 17.6, z: -13.4 };                  // OSM フットプリント重心
const arenaShell = new THREE.Group(); site.add(arenaShell);
(function shell() {
  const poly = SCENE_DATA.arena.outer;
  if (!poly || poly.length < 4) return;
  const B = new Builder();
  const wall = [0.55, 0.60, 0.68], roof = [0.30, 0.36, 0.46];
  let p = poly.slice();
  if (p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  if (area2(p) < 0) p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    B.quad([a[0], 0, -a[1]], [b[0], 0, -b[1]], [b[0], 26, -b[1]], [a[0], 26, -a[1]], wall);
  }
  try {
    const f = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), []);
    for (const t of f)
      B.tri([p[t[0]][0], 26, -p[t[0]][1]], [p[t[2]][0], 26, -p[t[2]][1]], [p[t[1]][0], 26, -p[t[1]][1]], roof);
  } catch (e) { }
  const m = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.6, metalness: 0.25 }));
  m.userData = { kind: 'arena', name: 'Crypto.com Arena',
    desc: '収容 19,079（バスケ）/ 18,250（アイスホッケー）/ 20,000（コンサート）<br>' +
          '1999年開業・設計 NBBJ・建設費 $375M<br><b>クリックで L2 ボウル内部へ</b>' };
  arenaShell.add(m);

  /* 外周を縁取る青いLEDリング（実際の外装照明の再現） */
  const pts = p.map(q => new THREE.Vector3(q[0], 26.4, -q[1]));
  pts.push(pts[0].clone());
  const lg = new THREE.BufferGeometry().setFromPoints(pts);
  for (const y of [26.4, 22.8, 19.2]) {
    const l = new THREE.Line(lg, new THREE.LineBasicMaterial({
      color: 0x00c2ff, transparent: true, opacity: y > 25 ? 0.95 : 0.45 }));
    l.position.y = y - 26.4; arenaShell.add(l);
  }
})();

/* ================= POI ================= */
const POI_COL = { ent: 0xff5fa2, tour: 0x3ddc84, shop: 0xfdb927, biz: 0x4da3ff,
                  hotel: 0x8a5cc4, rail: 0x00c2ff };
(function pois() {
  const geo = new THREE.ConeGeometry(9, 22, 4);
  for (const p of SCENE_DATA.pois) {
    const c = POI_COL[p.c] || 0x8590a8;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 }));
    m.position.set(p.p[0], 26, -p.p[1]);
    m.rotation.x = Math.PI;
    m.userData = { kind: 'poi', name: p.n, desc: p.d };
    gMark.add(m);
  }
})();

/* ================================================================
   表示モード — SOLID / POINT(点描) / WIRE(線画) / BLUEPRINT(青焼き)
   点描: 建物外形を等間隔サンプリングした擬似点群（LiDAR/フォトグラメトリ相当の見え方）
   線画/青焼き: 稜線のみ。図面表現に切り替えて構造と街区の関係を読む
================================================================ */
setLoad(70, '点群 / 線画レイヤーを生成中');
/* 点群の分類（LAS classification 相当）: 0=地表/道路 1=建物 2=高層建物 3=鉄道 4=アリーナ */
const PC_CLASS_COL = [0x4a6f96, 0x63d9ff, 0xbfe9ff, 0xa05da5, 0x00e5ff];
const PC_CLASS_NAME = ['地表・道路', '建物 (低〜中層)', '建物 (高層)', '鉄道', 'アリーナ'];
let pcColorMode = 'class';                               // class | height | intensity
const PCD = { cls: null, y: null, maxY: 1 };

(function altViews() {
  const P = [], PC = [], PK = [], PH = [];               // position / color / class / height
  const W = [], WC = [];                                 // 線分 position / color
  const cB = new THREE.Color(0x63d9ff), cR = new THREE.Color(0x3a6a9e), cM = new THREE.Color(0x2f5f8c);

  const sampleRing = (poly, y, step, col, cls) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(L / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        P.push(a[0] + (b[0] - a[0]) * t, y, -(a[1] + (b[1] - a[1]) * t));
        PC.push(col.r, col.g, col.b);
        PK.push(cls); PH.push(y);
      }
    }
  };
  const edgeRing = (poly, y, col) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      W.push(a[0], y, -a[1], b[0], y, -b[1]);
      WC.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
  };

  for (const bl of SCENE_DATA.buildings) {
    let p = bl.p.slice();
    if (p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    if (p.length < 3) continue;
    const h = bl.h || 11;
    const lv = clamp(Math.round(h / 9), 2, 7);           // 高さ方向のサンプル段数
    const cls = h > 60 ? 2 : 1;
    for (let i = 0; i <= lv; i++) sampleRing(p, h * i / lv, 2.6, cB, i === 0 ? 0 : cls);
    edgeRing(p, 0, cB); edgeRing(p, h, cB);
    for (const q of p) {                                  // 垂直稜線
      W.push(q[0], 0, -q[1], q[0], h, -q[1]);
      WC.push(cB.r, cB.g, cB.b, cB.r, cB.g, cB.b);
    }
  }
  for (const bl of SCENE_DATA.mid) {
    let p = bl.p.slice();
    if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    if (p.length < 3) continue;
    const h = 7 + hrand(Math.round(p[0][0] * 7 + p[0][1]), 23) * 22;
    sampleRing(p, h, 3.4, cM, h > 60 ? 2 : 1); sampleRing(p, 0, 5.0, cM, 0);
    edgeRing(p, h, cM);
  }
  for (const r of SCENE_DATA.roads) {                     // 道路は中心線をサンプル
    const col = r.c >= 3 ? cB : cR, step = r.c >= 3 ? 3.5 : 6;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const y = r.b === 1 ? 8.5 : (r.b === -1 ? -6 : 0.2);
      const n = Math.max(1, Math.round(L / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        P.push(a[0] + (b[0] - a[0]) * t, y, -(a[1] + (b[1] - a[1]) * t));
        PC.push(col.r, col.g, col.b);
        PK.push(0); PH.push(y);
      }
      W.push(a[0], y, -a[1], b[0], y, -b[1]);
      WC.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
  }
  /* アリーナ外殻も点群 / 線画に含める */
  const ap = SCENE_DATA.arena.outer.slice();
  if (ap.length > 3) {
    const cA = new THREE.Color(0x00e5ff);
    for (let i = 0; i <= 8; i++) sampleRing(ap, 26 * i / 8, 1.6, cA, 4);
    edgeRing(ap, 0, cA); edgeRing(ap, 26, cA);
    for (const q of ap) { W.push(q[0], 0, -q[1], q[0], 26, -q[1]);
      WC.push(cA.r, cA.g, cA.b, cA.r, cA.g, cA.b); }
  }

  /* Metro / 貨物線も点群に含める（分類=3） */
  const cR2 = new THREE.Color(0xa05da5);
  for (const list of [SCENE_DATA.railMetro, SCENE_DATA.railHeavy]) {
    for (const r of list) {
      const y = r.b === 1 ? 9.5 : (r.b === -1 ? -7.5 : 0.6);
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          P.push(a[0] + (b[0] - a[0]) * t, y, -(a[1] + (b[1] - a[1]) * t));
          PC.push(cR2.r, cR2.g, cR2.b); PK.push(3); PH.push(y);
        }
      }
    }
  }
  PCD.cls = Uint8Array.from(PK);
  PCD.y = Float32Array.from(PH);
  /* 100万点超のスプレッドは呼び出しスタックを溢れさせるのでループで求める */
  let my = 1; for (const v of PH) if (v > my) my = v;
  PCD.maxY = my;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(PC, 3));
  gPoint.add(new THREE.Points(pg, new THREE.PointsMaterial({
    size: 1.9, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.92 })));
  gPoint.userData.geo = pg;

  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
  wg.setAttribute('color', new THREE.Float32BufferAttribute(WC, 3));
  gWire.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55 })));
  gWire.userData.mat = gWire.children[0].material;
  gWire.userData.geo = wg;
  siteStats.points = P.length / 3;
  siteStats.segs = W.length / 6;
})();

/* ---- 点群の着色モード（分類 / 高さ / 疑似反射強度） ---- */
function setPointColorMode(mode) {
  pcColorMode = mode;
  const g = gPoint.userData.geo;
  if (!g) return;
  const col = g.attributes.color, n = col.count;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    if (mode === 'class') c.setHex(PC_CLASS_COL[PCD.cls[i]]);
    else if (mode === 'height') {
      const u = clamp(PCD.y[i] / Math.min(PCD.maxY, 180), 0, 1);
      c.setHSL(0.62 - u * 0.62, 0.85, 0.32 + u * 0.34);
    } else {
      /* 疑似反射強度: 面の向き（水平ほど高反射）＋クラス別の材質差 */
      const k = PCD.cls[i];
      const base = k === 0 ? 0.72 : k === 3 ? 0.86 : k === 4 ? 0.94 : 0.40;
      const v = clamp(base + ((i * 2654435761) % 97) / 97 * 0.22 - 0.11, 0, 1);
      c.setRGB(v * 0.85, v * 0.95, v);
    }
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  if (typeof renderPanel === 'function') renderPanel();
}

/* ---- モード適用 ---- */
let viewMode = 'solid';                                   // solid | point | wire | blueprint
function setViewMode(m) {
  viewMode = m;
  const lineish = (m === 'wire' || m === 'blueprint');
  gSolid.visible = (m === 'solid');
  gPoint.visible = (m === 'point');
  gWire.visible = lineish;
  gClose.visible = (m === 'solid' && level !== 'plaza');
  const deck = gInfra.getObjectByName('bridgeDeck');
  if (deck) deck.visible = !lineish;          // 線画では稜線が高架を表現するので実体は伏せる
  arenaShell.visible = (m === 'solid' && level !== 'plaza');
  wrap.classList.toggle('pc-grad', m === 'point');
  wrap.classList.toggle('bp-grad', m === 'blueprint');
  const wm = gWire.userData.mat;
  if (m === 'blueprint') {
    scene.background = new THREE.Color(0x0a1836);
    scene.fog.color.setHex(0x0a1836);
    wm.vertexColors = false; wm.color.setHex(0xdfe9ff); wm.opacity = 0.72;
  } else {
    scene.background = null;
    scene.fog.color.setHex(m === 'point' ? 0x04243f : 0x080b12);
    renderer.setClearColor(m === 'point' ? 0x000000 : 0x080b12, m === 'point' ? 0 : 1);
    wm.vertexColors = true; wm.color.setHex(0xffffff); wm.opacity = 0.55;
  }
  wm.needsUpdate = true;
  if (typeof renderPanel === 'function') renderPanel();
}
