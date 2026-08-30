
/* ================================================================
   L1 エントランス広場 — Figueroa St / Star Plaza 側
   カーテンウォール・キャノピー・サイネージ・入場ゲート（スキャン地点）・
   ヤシ並木・アクティベーションブース を BIM 相当の粒度で構築
================================================================ */
const ARENA_ROT = -27.3 * Math.PI / 180;
const PLAZA_C = { x: ARENA_C.x + Math.sin(ARENA_ROT) * -95 * -1 + 0, z: 0 };
(function fixPlazaC() {                       // ローカル -z(北側) へ 95m オフセット
  const lx = 0, lz = -95;
  PLAZA_C.x = ARENA_C.x + lx * Math.cos(ARENA_ROT) + lz * Math.sin(ARENA_ROT);
  PLAZA_C.z = ARENA_C.z - lx * Math.sin(ARENA_ROT) + lz * Math.cos(ARENA_ROT);
})();

/* カメラ注視点: ファサード正面（ローカル z=-58）*/
const plazaTarget = {
  x: ARENA_C.x + (-58) * Math.sin(ARENA_ROT),
  z: ARENA_C.z + (-58) * Math.cos(ARENA_ROT),
};
const plaza = new THREE.Group();
plaza.position.set(ARENA_C.x, 0, ARENA_C.z);
plaza.rotation.y = ARENA_ROT;
plaza.visible = false;
scene.add(plaza);
plaza.add(new THREE.HemisphereLight(0xbcd4ff, 0x141a26, 0.75));
(function plazaLights() {          // 広場の照明ポール相当
  for (const p of [[-46, -96], [46, -96], [0, -118], [-64, -58], [64, -58]]) {
    const L = new THREE.PointLight(0xcfe0ff, 1.25, 130, 1.6);
    L.position.set(p[0], 13, p[1]); plaza.add(L);
  }
})();

const GATES = [];      // 入場ゲート（1to1 ジャーニーのスキャン地点）

setLoad(80, 'エントランス広場を生成中');
(function entrance() {
  const B = new Builder();
  const deck = [0.26, 0.27, 0.30], curb = [0.34, 0.35, 0.38];
  /* --- 広場デッキ（舗装パターン） --- */
  for (let i = 0; i < 27; i++) for (let j = 0; j < 16; j++) {
    const x = -80 + i * 6, z = -126 + j * 6;
    const k = ((i + j) % 2) ? 1 : 0.88;
    B.quad([x, 0.02, z], [x + 5.9, 0.02, z], [x + 5.9, 0.02, z + 5.9], [x, 0.02, z + 5.9],
           [deck[0] * k, deck[1] * k, deck[2] * k]);
  }
  plaza.add(new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9 })));

  /* --- カーテンウォール（湾曲ガラスファサード + マリオン） --- */
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1d4a72, metalness: 0.65, roughness: 0.12,
    transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const mullMat = new THREE.MeshStandardMaterial({ color: 0xb9c4d4, metalness: 0.7, roughness: 0.35 });
  const FA = 52, FB = 40;                       // ファサード円弧の半径
  const arc0 = -Math.PI * 0.78, arc1 = -Math.PI * 0.22, NSEG = 34;
  const fpt = u => {
    const t = lerp(arc0, arc1, u);
    return [Math.cos(t) * FA, Math.sin(t) * FB];
  };
  const G = new Builder(), gc = [1, 1, 1];
  for (let i = 0; i < NSEG; i++) {
    const p0 = fpt(i / NSEG), p1 = fpt((i + 1) / NSEG);
    G.quad([p0[0], 1.2, p0[1]], [p1[0], 1.2, p1[1]], [p1[0], 19, p1[1]], [p0[0], 19, p0[1]], gc);
  }
  const gm = new THREE.Mesh(G.geom(), glassMat);
  gm.userData = { kind: 'bim', type: 'IfcCurtainWall', tag: 'FAC-GLASS-N',
    attrs: { '部材種別': 'ユニット式カーテンウォール (Low-E複層 8+12A+8)',
             '見付け': 'マリオン @1,530 mm', '高さ': 'FL+1.2 〜 +19.0 m',
             '外装照明': 'RGB LED グレージング（試合日はチームカラーへ切替）' } };
  plaza.add(gm); BIM_ELEMS.push(gm);
  for (let i = 0; i <= NSEG; i++) {             // マリオン
    const p = fpt(i / NSEG);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 17.8, 0.5), mullMat);
    m.position.set(p[0], 10.1, p[1]);
    m.rotation.y = Math.atan2(p[0], p[1]);
    plaza.add(m);
  }
  for (const y of [1.2, 7.2, 13.2, 19]) {       // 方立（水平材）
    const pts = [];
    for (let i = 0; i <= NSEG; i++) { const p = fpt(i / NSEG); pts.push(new THREE.Vector3(p[0], y, p[1])); }
    plaza.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xb9c4d4 })));
  }

  /* --- 外装 LEDリング（実建物の青色ライティング） --- */
  for (const y of [20.2, 21.6]) {
    const pts = [];
    for (let i = 0; i <= NSEG * 2; i++) { const p = fpt(i / (NSEG * 2)); pts.push(new THREE.Vector3(p[0] * 1.02, y, p[1] * 1.02)); }
    plaza.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x00c2ff })));
  }

  /* --- エントランス キャノピー --- */
  const can = new THREE.Mesh(new THREE.BoxGeometry(34, 0.7, 9),
    new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.7 }));
  can.position.set(0, 8.4, -FB - 4.2);
  can.userData = { kind: 'bim', type: 'IfcRoof', tag: 'CANOPY-MAIN',
    attrs: { '部材種別': 'エントランスキャノピー（鋼製・持出し 4.2m）',
             '天端高': 'FL+9.1 m', '下端': 'FL+8.4 m', '排水': '内樋（両端 φ100 竪樋）' } };
  plaza.add(can); BIM_ELEMS.push(can);
  for (const x of [-15, -5, 5, 15]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 8.4, 10), mullMat);
    c.position.set(x, 4.2, -FB - 7.6); plaza.add(c);
  }

  /* --- サイネージ "crypto.com ARENA" --- */
  (function sign() {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#0a1420'; c.fillRect(0, 0, 1024, 128);
    c.fillStyle = '#ffffff'; c.font = '600 62px Oswald'; c.textAlign = 'center';
    c.fillText('crypto.com', 380, 90);
    c.fillStyle = '#00c2ff'; c.fillRect(600, 26, 4, 76);
    c.fillStyle = '#ffffff'; c.font = '600 62px Oswald';
    c.fillText('ARENA', 760, 90);
    const t = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.25),
      new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t,
        emissiveIntensity: 1.2, color: 0x0a1420 }));
    m.position.set(0, 10.6, -FB - 4.6);
    m.rotation.y = Math.PI;              // 広場側（外向き）に向ける
    m.userData = { kind: 'poi', name: 'メインサイネージ', desc: 'Figueroa St 側 主入口サイン' };
    plaza.add(m);
  })();

  /* --- 入場ゲート（チケットスキャン地点 = ジャーニーの起点） --- */
  const GATE_NAMES = ['Gate A (Figueroa)', 'Gate B (Star Plaza)', 'Gate C (11th St)',
                      'Gate D (Chick Hearn)', 'Gate E (Premier)'];
  GATE_NAMES.forEach((nm, gi) => {
    const u = 0.12 + gi * 0.19;
    const p = fpt(u);
    const g = new THREE.Group();
    const ang = Math.atan2(p[0], p[1]);
    for (let k = -2; k <= 2; k++) {             // ターンスタイル 5レーン
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x2b3346, metalness: 0.5, roughness: 0.4 }));
      t.position.set(k * 0.92, 0.55, 0); g.add(t);
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x00c2ff, emissive: 0x00c2ff, emissiveIntensity: 1.2 }));
      sc.position.set(k * 0.92, 1.16, -0.5); g.add(sc);
    }
    g.position.set(p[0] * 1.16, 0, p[1] * 1.16);
    g.rotation.y = ang;
    g.userData = { kind: 'gate', name: nm,
      desc: 'ターンスタイル5レーン<br>チケットスキャンにより <b>fan_id × 入場時刻</b> を取得し、<br>' +
            'ジャーニー分析の起点になる' };
    plaza.add(g);
    GATES.push({ name: nm, x: p[0] * 1.16, z: p[1] * 1.16, ang });
  });

  /* --- ヤシ並木（実際のFigueroa沿いの植栽） --- */
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 9, 7);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a4032, roughness: 1 });
  const frondM = new THREE.MeshStandardMaterial({ color: 0x2c5c34, roughness: 0.9,
    side: THREE.DoubleSide });
  for (let i = 0; i < 22; i++) {
    const u = i / 21;
    const p = fpt(u * 1.14 - 0.07);
    const x = p[0] * 1.42, z = p[1] * 1.42;
    const t = new THREE.Mesh(trunk, trunkM); t.position.set(x, 4.5, z);
    plaza.add(t);
    for (let k = 0; k < 7; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.55), frondM);
      f.position.set(x, 9.2, z);
      f.rotation.set(0.42 + hrand(i * 7 + k, 3) * 0.3, k * 0.9, 0);
      f.translateX(1.55);
      plaza.add(f);
    }
  }

  /* --- アクティベーションブース / グッズキオスク（POS地点） --- */
  const BOOTHS = [['crypto.com 体験ブース', -34, -66], ['Team Store 屋外', 26, -70],
                  ['Delta ラウンジ受付', -12, -78], ['F&B キオスク', 40, -52]];
  for (const [nm, x, z] of BOOTHS) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 3.1, 4),
      new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 0.8 }));
    b.position.y = 1.55;
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.22, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x00c2ff, emissive: 0x00506e, emissiveIntensity: 0.8 }));
    top.position.y = 3.2;
    g.add(b, top); g.position.set(x, 0, z);
    g.userData = { kind: 'poi', name: nm, desc: '屋外POS / アクティベーション地点。<br>購買ログが fan_id に紐づく' };
    plaza.add(g);
  }

  /* --- 屋外ビジョン --- */
  const bigCv = document.createElement('canvas'); bigCv.width = 512; bigCv.height = 288;
  const bc = bigCv.getContext('2d');
  bc.fillStyle = '#101a2c'; bc.fillRect(0, 0, 512, 288);
  bc.fillStyle = '#fdb927'; bc.font = '700 46px Oswald'; bc.textAlign = 'center';
  bc.fillText('LAKERS', 256, 120);
  bc.fillStyle = '#e9edf6'; bc.font = '600 26px Oswald';
  bc.fillText('TONIGHT 7:30 PM', 256, 168);
  bc.fillStyle = '#00c2ff'; bc.font = '600 20px Oswald';
  bc.fillText('CRYPTO.COM ARENA', 256, 218);
  const bt = new THREE.CanvasTexture(bigCv);
  const big = new THREE.Mesh(new THREE.PlaneGeometry(16, 9),
    new THREE.MeshStandardMaterial({ map: bt, emissive: 0xffffff, emissiveMap: bt,
      emissiveIntensity: 0.9, color: 0x101a2c }));
  big.position.set(-46, 12, -74); big.rotation.y = 0.55;
  big.userData = { kind: 'poi', name: '屋外ビジョン', desc: '広場滞留者向けの媒体。滞留人数×時間で露出量を算定' };
  plaza.add(big);
})();
