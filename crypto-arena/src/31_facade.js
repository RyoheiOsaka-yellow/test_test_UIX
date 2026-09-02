/* ================================================================
   L1 外観の作り込み — アリーナ本体（ロビー背後の楕円ボリューム）と広場の什器
   ・本体: プレキャストパネル外壁 + 目地 + 上層ガラス帯 + 低ドーム屋根 + 屋上設備
           + 屋上サイン + LEDリング + ウォールウォッシャー（チームカラー演出）
   ・広場: 照明ポール(旗付き) / Star Plaza 銅像 / 入場列スタンション / 保安検査ゲート
           / 案内トーテム / ベンチ / プランター / ボラード / ゴミ箱 / バス停 /
           ライドシェア乗降ゾーン / 自転車ラック / 舗装インレイ
   すべて plaza ローカル座標（-z が広場側=北東）。
================================================================ */
setLoad(81, 'アリーナ外観・広場什器を生成中');
(function facade() {
  const BA = 80, BB = 52, BZ = 20;                          // 本体楕円 半径と中心（z）
  const bodyPt = t => [Math.cos(t) * BA, BZ + Math.sin(t) * BB];
  const bodyN = t => { const n = [Math.cos(t) / BA, Math.sin(t) / BB]; const L = Math.hypot(n[0], n[1]); return [n[0] / L, n[1] / L]; };
  const NSEG = 96;
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness: 0.65, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.8 });

  /* ---- 本体外壁: 基壇 / パネル / ガラス帯 / パラペット ---- */
  const B = new Builder();
  const band = (y0, y1, col, k) => {
    for (let i = 0; i < NSEG; i++) {
      const p0 = bodyPt(2 * Math.PI * i / NSEG), p1 = bodyPt(2 * Math.PI * (i + 1) / NSEG);
      const c = (k && i % 2) ? [col[0] * 0.93, col[1] * 0.93, col[2] * 0.93] : col;
      B.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], c);
    }
  };
  band(0, 1.4, [0.16, 0.17, 0.21]);
  band(1.4, 8.0, [0.50, 0.53, 0.60], true);
  band(8.0, 15.0, [0.54, 0.57, 0.64], true);
  band(20.0, 24.0, [0.46, 0.49, 0.56]);
  const wall = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide }));
  wall.userData = { kind: 'bim', type: 'IfcWall', tag: 'EXT-PANEL',
    attrs: { '部材種別': 'プレキャストコンクリート外壁パネル (t=150, 骨材露出仕上)',
             'モジュール': 'W 5,200 × H 6,600 mm', '目地': '水平 5m ピッチ / 縦 パイラスター @ 10.5m',
             '断熱': '裏打ち硬質ウレタン 50mm', '外装照明': 'ウォールウォッシャー（RGBW）' } };
  plaza.add(wall); BIM_ELEMS.push(wall);
  const G = new Builder();
  for (let i = 0; i < NSEG; i++) {
    const p0 = bodyPt(2 * Math.PI * i / NSEG), p1 = bodyPt(2 * Math.PI * (i + 1) / NSEG);
    G.quad([p0[0] * 1.002, 15.0, p0[1]], [p1[0] * 1.002, 15.0, p1[1]], [p1[0] * 1.002, 20.0, p1[1]], [p0[0] * 1.002, 20.0, p0[1]], [0.12, 0.28, 0.46]);
  }
  const glz = new THREE.Mesh(G.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.12, metalness: 0.6, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
  glz.userData = { kind: 'bim', type: 'IfcCurtainWall', tag: 'FAC-GLASS-UPPER',
    attrs: { '部材種別': '上層コンコース ガラス帯（Low-E 複層）', '高さ': 'FL+15.0 〜 +20.0 m',
             '用途': '300 Level コンコースの外光採り・夜間は内照で外観に発光帯を作る' } };
  plaza.add(glz); BIM_ELEMS.push(glz);
  /* 目地・パイラスター・LED リング */
  (function joints() {
    const pts = y => { const a = []; for (let i = 0; i <= NSEG; i++) { const p = bodyPt(2 * Math.PI * i / NSEG); a.push(new THREE.Vector3(p[0] * 1.003, y, p[1])); } return a; };
    for (const y of [5, 10, 15, 20]) plaza.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts(y)),
      new THREE.LineBasicMaterial({ color: 0x2b3140 })));
    for (const y of [24.3, 20.4]) plaza.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts(y)),
      new THREE.LineBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: y > 24 ? 0.95 : 0.5 })));
    for (let i = 0; i < NSEG; i += 4) {
      const t = 2 * Math.PI * i / NSEG, p = bodyPt(t), n = bodyN(t);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 22.6, 0.6), dark);
      m.position.set(p[0] + n[0] * 0.3, 12.7, p[1] + n[1] * 0.3);
      m.rotation.y = Math.atan2(n[0], n[1]); plaza.add(m);
    }
  })();

  /* ---- 屋根（低ドーム 2段 + 天端プレート）と放射リブ ---- */
  (function roof() {
    const R = new Builder();
    const ring = (k, y0, k2, y1, col) => {
      for (let i = 0; i < NSEG; i++) {
        const t0 = 2 * Math.PI * i / NSEG, t1 = 2 * Math.PI * (i + 1) / NSEG;
        const p0 = bodyPt(t0), p1 = bodyPt(t1);
        const q0 = [p0[0] * k2, BZ + (p0[1] - BZ) * k2], q1 = [p1[0] * k2, BZ + (p1[1] - BZ) * k2];
        R.quad([p0[0] * k, y0, BZ + (p0[1] - BZ) * k], [p1[0] * k, y0, BZ + (p1[1] - BZ) * k],
               [q1[0], y1, q1[1]], [q0[0], y1, q0[1]], col);
      }
    };
    ring(1.0, 24.0, 0.78, 29.0, [0.30, 0.34, 0.42]);
    ring(0.78, 29.0, 0.42, 32.5, [0.34, 0.38, 0.46]);
    for (let i = 0; i < NSEG; i++) {
      const p0 = bodyPt(2 * Math.PI * i / NSEG), p1 = bodyPt(2 * Math.PI * (i + 1) / NSEG);
      R.tri([p0[0] * 0.42, 32.5, BZ + (p0[1] - BZ) * 0.42], [p1[0] * 0.42, 32.5, BZ + (p1[1] - BZ) * 0.42], [0, 32.5, BZ], [0.36, 0.40, 0.48]);
    }
    const m = new THREE.Mesh(R.geom(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    m.userData = { kind: 'bim', type: 'IfcRoof', tag: 'ROOF-MAIN',
      attrs: { '部材種別': '鋼製トラス屋根 + 金属折板（断熱・遮音）', '天端': 'FL+32.5 m',
               '勾配': '外周 1/4 → 中央 1/12', '排水': '外周樋 → 竪樋 24 本' } };
    plaza.add(m); BIM_ELEMS.push(m);
    const W = [];
    for (let i = 0; i < 24; i++) {
      const t = 2 * Math.PI * i / 24, p = bodyPt(t);
      W.push(p[0], 24.1, p[1], p[0] * 0.78, 29.1, BZ + (p[1] - BZ) * 0.78, p[0] * 0.78, 29.1, BZ + (p[1] - BZ) * 0.78, p[0] * 0.42, 32.6, BZ + (p[1] - BZ) * 0.42);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
    plaza.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1f2430 })));
    /* 屋上設備（機械室ペントハウス・冷却塔・点検歩廊） */
    const mech = new THREE.MeshStandardMaterial({ color: 0x6d7683, roughness: 0.8 });
    const ph = new THREE.Mesh(new THREE.BoxGeometry(28, 4, 12), mech); ph.position.set(4, 34.5, BZ + 22); plaza.add(ph);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3, 12), mech); t.position.set(-22 + i * 6, 34, BZ + 18); plaza.add(t); }
    for (let i = 0; i < 4; i++) { const u = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 3), mech); u.position.set(16 + i * 7, 33.6, BZ - 6); plaza.add(u); }
  })();

  /* ---- 屋上サイン（広場を向く大型文字） ---- */
  (function roofSign() {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
    const c = cv.getContext('2d');
    c.fillStyle = '#ffffff'; c.font = '600 92px Oswald'; c.textAlign = 'center';
    c.fillText('crypto.com', 380, 112);
    c.fillStyle = '#00c2ff'; c.fillRect(612, 30, 6, 100);
    c.fillStyle = '#ffffff'; c.fillText('ARENA', 800, 112);
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 7.2),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 1.1, color: 0x000000, transparent: true, side: THREE.DoubleSide }));
    m.position.set(0, 28.2, BZ - BB + 2.5); m.rotation.y = Math.PI;
    m.userData = { kind: 'poi', name: '屋上サイン', desc: 'Figueroa St / I-110 から視認されるネーミングライツ表示。<br>屋外露出量は交通量 × 視認時間で算定' };
    plaza.add(m);
    for (const x of [-18, 0, 18]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.5, 0.5), steel); p.position.set(x, 26.2, BZ - BB + 2.2); plaza.add(p); }
  })();

  /* ---- ウォールウォッシャー（外壁のチームカラー演出）と足元 LED ---- */
  (function wash() {
    const cols = [0x552583, 0xfdb927, 0x552583, 0x00c2ff];
    for (let i = 0; i < NSEG; i += 3) {
      const t = 2 * Math.PI * i / NSEG, p = bodyPt(t), n = bodyN(t);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 13),
        new THREE.MeshBasicMaterial({ color: cols[(i / 3 | 0) % cols.length], transparent: true, opacity: 0.16,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(p[0] + n[0] * 0.6, 8.2, p[1] + n[1] * 0.6); m.rotation.y = Math.atan2(n[0], n[1]);
      plaza.add(m);
      const led = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: cols[(i / 3 | 0) % cols.length] }));
      led.position.set(p[0] + n[0] * 0.9, 0.12, p[1] + n[1] * 0.9); led.rotation.y = m.rotation.y; plaza.add(led);
    }
  })();

  /* ---- 側面のサブエントランス / 背面の搬入ドック ---- */
  (function sideDoors() {
    const glassD = new THREE.MeshStandardMaterial({ color: 0x1d4a72, metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.6 });
    [[-0.06 * Math.PI, 'Premier Entrance (East)'], [-0.94 * Math.PI, 'Premier Entrance (West)']].forEach(([t, nm]) => {
      const p = bodyPt(t), n = bodyN(t), ang = Math.atan2(n[0], n[1]);
      const g = new THREE.Group(); g.position.set(p[0] + n[0] * 0.2, 0, p[1] + n[1] * 0.2); g.rotation.y = ang;
      const door = new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 0.3), glassD); door.position.y = 1.8; g.add(door);
      const can = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 3.2), dark); can.position.set(0, 4.1, 1.5); g.add(can);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d');
      c.fillStyle = '#0a1420'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#00e0a4'; c.font = '600 44px Oswald'; c.textAlign = 'center'; c.fillText(nm.toUpperCase(), 256, 64);
      const tex = new THREE.CanvasTexture(cv);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, color: 0x0a1420 }));
      s.position.set(0, 5.1, 1.6); g.add(s);
      g.userData = { kind: 'gate', name: nm, desc: 'Premier / Suite 会員専用入口。<br>会員証スキャンで <b>fan_id × 入場時刻</b> を取得' };
      plaza.add(g);
    });
    /* 搬入ドック（背面）: ロールアップドア 3連 + トレーラー */
    const dockT = 0.5 * Math.PI, p = bodyPt(dockT), n = bodyN(dockT);
    const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = Math.atan2(n[0], n[1]);
    for (let i = -1; i <= 1; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.6 }));
      d.position.set(i * 6, 2.2, 0.2); g.add(d);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0x2a2e38 })); slab.position.set(0, 0.6, 5.5); g.add(slab);
    for (const x of [-6, 6]) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.8, 14), new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.6 }));
      tr.position.set(x, 3.1, 14); g.add(tr);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 2.6), new THREE.MeshStandardMaterial({ color: 0x1b2a44 })); cab.position.set(x, 2.5, 22.4); g.add(cab);
    }
    g.userData = { kind: 'poi', name: '搬入ドック（Chick Hearn Ct 側）', desc: '興行搬入・F&B 納品。イベント日は 05:00〜 の入庫ピークが渋滞要因' };
    plaza.add(g);
  })();

  /* ================= 広場の什器 ================= */
  /* ---- 照明ポール（既存 PointLight の位置に実体を置く）+ 旗 ---- */
  (function poles() {
    const flags = [['LAKERS', '#552583', '#fdb927'], ['KINGS', '#111111', '#a2aaad'], ['SPARKS', '#702f8a', '#ffc72c'], ['crypto.com', '#0a1420', '#00c2ff']];
    [[-46, -96], [46, -96], [0, -118], [-64, -58], [64, -58]].forEach((p, i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 13, 8), steel); pole.position.set(p[0], 6.5, p[1]); plaza.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.16), steel); arm.position.set(p[0], 12.8, p[1]); plaza.add(arm);
      for (const s of [-1.4, 1.4]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1c9 })); h.position.set(p[0] + s, 12.7, p[1]); plaza.add(h); }
      const f = flags[i % flags.length];
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 384; const c = cv.getContext('2d');
      c.fillStyle = f[1]; c.fillRect(0, 0, 128, 384); c.fillStyle = f[2]; c.fillRect(0, 0, 128, 14); c.fillRect(0, 370, 128, 14);
      c.save(); c.translate(64, 192); c.rotate(-Math.PI / 2); c.font = '600 34px Oswald'; c.textAlign = 'center'; c.fillText(f[0], 0, 12); c.restore();
      const tex = new THREE.CanvasTexture(cv);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.7), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
      fl.position.set(p[0] + 0.62, 9.6, p[1]); plaza.add(fl);
    });
  })();

  /* ---- Star Plaza 銅像（実在のレジェンド像）---- */
  (function statues() {
    const S = [['Magic Johnson', 2004, 'Lakers'], ['Wayne Gretzky', 2002, 'Kings'], ['Kareem Abdul-Jabbar', 2012, 'Lakers'],
               ['Oscar De La Hoya', 2008, 'Boxing'], ['Jerry West', 2011, 'Lakers'], ['Luc Robitaille', 2015, 'Kings'],
               ['Shaquille O\'Neal', 2017, 'Lakers'], ['Chick Hearn', 2010, 'Lakers 実況'], ['Elgin Baylor', 2018, 'Lakers'],
               ['Kobe Bryant', 2024, 'Lakers'], ['Bob Miller', 2018, 'Kings 実況']];
    const bronze = new THREE.MeshStandardMaterial({ color: 0x7a5a33, metalness: 0.75, roughness: 0.45 });
    const granite = new THREE.MeshStandardMaterial({ color: 0x2c2f38, roughness: 0.5, metalness: 0.2 });
    S.forEach((s, i) => {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const x = side * (16 + k * 11), z = -104 + (k % 2) * 4;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI + side * 0.25;
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), granite); ped.position.y = 0.7; g.add(ped);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.0, 8), bronze); legs.position.y = 1.9; g.add(legs);
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 1.1, 8), bronze); torso.position.y = 2.95; g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), bronze); head.position.y = 3.85; g.add(head);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), bronze); arm.position.set(0.55, 3.2, 0.2); arm.rotation.z = 0.9; g.add(arm);
      const plq = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), new THREE.MeshBasicMaterial({ color: 0xc9a44a })); plq.position.set(0, 1.0, 0.92); g.add(plq);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      up.position.set(0, 1.42, 0); g.add(up);
      g.userData = { kind: 'poi', name: 'Star Plaza 銅像: ' + s[0], desc: s[2] + ' / 除幕 ' + s[1] + '年<br>撮影スポット = 滞留ポイント。周辺媒体の露出量が高い' };
      plaza.add(g);
    });
  })();

  /* ---- ゲート前: 保安検査ゲート + 入場列スタンション（ベルト式・蛇行 4 列）---- */
  (function gateKits() {
    const post = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness: 0.7, roughness: 0.3 });
    const beltC = new THREE.LineBasicMaterial({ color: 0x552583 });
    const magM = new THREE.MeshStandardMaterial({ color: 0xe6e9f0, roughness: 0.5 });
    for (const gt of GATES) {
      const g = new THREE.Group(); g.position.set(gt.x, 0, gt.z); g.rotation.y = gt.ang;
      /* 金属探知ゲート 5 基（ターンスタイル各レーン前）*/
      for (let k = -2; k <= 2; k++) {
        for (const s of [-0.32, 0.32]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.5), magM); p.position.set(k * 0.92 + s, 1.05, 2.0); g.add(p); }
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.5), magM); top.position.set(k * 0.92, 2.15, 2.0); g.add(top);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), new THREE.MeshBasicMaterial({ color: 0x3ddc84 })); lamp.position.set(k * 0.92, 2.24, 2.0); g.add(lamp);
      }
      const tbl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.6), post); tbl.position.set(3.2, 0.45, 2.0); g.add(tbl);
      /* スタンション: x 4 本 × z 5 列、ベルトは列ごとに横一直線、端で交互に折り返す */
      const xs = [-3.0, -1.0, 1.0, 3.0], zs = [3.6, 5.4, 7.2, 9.0, 10.8];
      const W = [];
      zs.forEach((z, zi) => {
        for (const x of xs) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 5), post); p.position.set(x, 0.48, z); g.add(p);
          const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 8), post); base.position.set(x, 0.015, z); g.add(base);
        }
        const open = zi % 2 ? 0 : 3;                          // 開いている端
        for (let i = 0; i < 3; i++) {
          if (zi < zs.length - 1 && i === (open === 0 ? 0 : 2)) continue;   // 折り返し口
          W.push(xs[i], 0.9, z, xs[i + 1], 0.9, z);
        }
        if (zi < zs.length - 1) { const x = open === 0 ? xs[3] : xs[0]; W.push(x, 0.9, z, x, 0.9, zs[zi + 1]); }
      });
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
      g.add(new THREE.LineSegments(bg, beltC));
      /* ゲート名サイン（自立式）*/
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d');
      c.fillStyle = '#0a1420'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#00c2ff'; c.fillRect(0, 0, 14, 128);
      c.fillStyle = '#ffffff'; c.font = '600 52px Oswald'; c.textAlign = 'left'; c.fillText(gt.name.split(' (')[0].toUpperCase(), 34, 62);
      c.fillStyle = '#8590a8'; c.font = '500 26px Oswald'; c.fillText('MOBILE TICKETS · BAG CHECK', 34, 104);
      const tex = new THREE.CanvasTexture(cv);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, color: 0x0a1420, side: THREE.DoubleSide }));
      sg.position.set(-4.4, 2.6, 6.5); g.add(sg);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), post); sp.position.set(-4.4, 1.1, 6.5); g.add(sp);
      plaza.add(g);
    }
  })();

  /* ---- 案内トーテム（デジタルサイネージ）---- */
  (function totems() {
    [[-60, -92, 'GATES A · B ▶', 'TEAM STORE  ·  RESTROOMS'], [60, -92, '◀ GATES D · E', 'PREMIER ENTRANCE  ·  ATM'],
     [0, -112, '▲ MAIN ENTRANCE', 'METRO PICO  ▼  6 min'], [-24, -60, 'DELTA SKY360° ▶', 'WILL CALL  ◀'], [30, -60, 'BOX OFFICE ▶', 'LOST & FOUND']].forEach(([x, z, a, b]) => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 768; const c = cv.getContext('2d');
      c.fillStyle = '#0a1420'; c.fillRect(0, 0, 256, 768); c.fillStyle = '#00c2ff'; c.fillRect(0, 0, 256, 10);
      c.fillStyle = '#ffffff'; c.font = '600 34px Oswald'; c.textAlign = 'center'; c.fillText(a, 128, 120);
      c.fillStyle = '#8590a8'; c.font = '500 22px Oswald'; c.fillText(b, 128, 170);
      c.fillStyle = '#fdb927'; c.font = '600 28px Oswald'; c.fillText('TONIGHT 7:30 PM', 128, 420); c.fillStyle = '#e9edf6'; c.fillText('LAKERS vs WARRIORS', 128, 460);
      c.fillStyle = '#3ddc84'; c.font = '500 22px Oswald'; c.fillText('DOORS OPEN 6:00 PM', 128, 520);
      const tex = new THREE.CanvasTexture(cv);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 0.36), dark); body.position.y = 1.7; g.add(body);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 3.0), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, color: 0x0a1420 }));
      scr.position.set(0, 1.75, 0.19); g.add(scr);
      g.userData = { kind: 'poi', name: 'デジタル案内トーテム', desc: '案内 + 当日興行の告知面。<br>滞留者へのプッシュ配信（クーポン/座席アップグレード）の起点' };
      plaza.add(g);
    });
  })();

  /* ---- ベンチ / プランター / ゴミ箱 / 自転車ラック / ボラード ---- */
  (function furniture() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.85 });
    const conc = new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.9 });
    const shrub = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.95, flatShading: true });
    const benchAt = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.55), wood); seat.position.y = 0.46; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.06), wood); back.position.set(0, 0.72, -0.26); g.add(back);
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.5), steel); l.position.set(s * 1.05, 0.23, 0); g.add(l); }
      plaza.add(g);
    };
    const planterAt = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 1.2), conc); b.position.y = 0.4; g.add(b);
      for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), shrub); s.position.set(i * 1.0, 1.1, 0); s.scale.y = 0.8; g.add(s); }
      plaza.add(g);
    };
    for (let i = 0; i < 8; i++) {
      const u = i / 7, ang = lerp(-Math.PI * 0.84, -Math.PI * 0.16, u);
      const x = Math.cos(ang) * 66, z = Math.sin(ang) * 54;
      benchAt(x, z, Math.atan2(-x, -z) + Math.PI);
      planterAt(x * 1.06 + 2.5, z * 1.06, Math.atan2(-x, -z));
    }
    [[-72, -100], [-48, -112], [48, -112], [72, -100], [-20, -118], [20, -118], [-38, -84], [38, -84]].forEach(p => {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 1.0, 10), dark); bin.position.set(p[0], 0.5, p[1]); plaza.add(bin);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10), steel); lid.position.set(p[0], 1.02, p[1]); plaza.add(lid);
    });
    for (let i = 0; i < 8; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 12, Math.PI), steel);
      r.position.set(-78 + i * 1.1, 0.02, -104); r.rotation.y = Math.PI / 2; plaza.add(r);
    }
    /* 街路側ボラード（反射帯付き） */
    const bolG = new THREE.CylinderGeometry(0.16, 0.16, 0.95, 8); bolG.translate(0, 0.475, 0);
    const N = 62;
    const bol = new THREE.InstancedMesh(bolG, new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.4, roughness: 0.5 }), N);
    const bandG = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 8); bandG.translate(0, 0.85, 0);
    const bnd = new THREE.InstancedMesh(bandG, new THREE.MeshBasicMaterial({ color: 0xfdb927 }), N);
    const M = new THREE.Matrix4();
    for (let i = 0; i < N; i++) { M.makeTranslation(-80 + i * 2.62, 0, -125.2); bol.setMatrixAt(i, M); bnd.setMatrixAt(i, M); }
    bol.instanceMatrix.needsUpdate = bnd.instanceMatrix.needsUpdate = true;
    plaza.add(bol, bnd);
    /* 縁石と歩道帯（Figueroa St 側） */
    const curb = new THREE.Mesh(new THREE.BoxGeometry(166, 0.16, 0.6), conc); curb.position.set(1, 0.08, -126.3); plaza.add(curb);
    const walkB = new THREE.Mesh(new THREE.BoxGeometry(166, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.95 })); walkB.position.set(1, 0.03, -130); plaza.add(walkB);
    /* ヤシの根元アップライト */
    for (let i = 0; i < 22; i++) {
      const u = i / 21, t = lerp(-Math.PI * 0.78, -Math.PI * 0.22, u * 1.14 - 0.07);
      const x = Math.cos(t) * 52 * 1.42, z = Math.sin(t) * 40 * 1.42;
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      l.position.set(x, 0.05, z); plaza.add(l);
    }
  })();

  /* ---- バス停 / ライドシェア乗降ゾーン ---- */
  (function transit() {
    const g = new THREE.Group(); g.position.set(-62, 0, -129);
    const glass = new THREE.MeshStandardMaterial({ color: 0x2a4a6e, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 2.2), dark); roof.position.y = 2.7; g.add(roof);
    for (const x of [-2.5, 2.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 6), steel); p.position.set(x, 1.35, 0.9); g.add(p); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.4), glass); back.position.set(0, 1.4, 1.0); g.add(back);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.45), steel); bench.position.set(0, 0.48, 0.6); g.add(bench);
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#111318'; c.fillRect(0, 0, 384, 128); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(48, 64, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111318'; c.font = '700 50px Oswald'; c.textAlign = 'center'; c.fillText('M', 48, 82);
    c.fillStyle = '#ffffff'; c.font = '600 34px Oswald'; c.textAlign = 'left'; c.fillText('Figueroa / 11th', 100, 58);
    c.fillStyle = '#fdb913'; c.font = '500 24px Oswald'; c.fillText('Lines 81 · 460 · J Line', 100, 100);
    const tex = new THREE.CanvasTexture(cv);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.8, color: 0x111318, side: THREE.DoubleSide }));
    sg.position.set(3.6, 2.4, 0.9); g.add(sg);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), steel); pole.position.set(3.6, 1.4, 0.9); g.add(pole);
    g.userData = { kind: 'poi', name: 'バス停 Figueroa / 11th', desc: 'Metro Bus 81 / 460 / J Line (Silver)。<br>降車 → Gate A まで徒歩 2 分' };
    plaza.add(g);
    /* ライドシェア乗降ゾーン（ピンクの路面標示 + サイン） */
    const cv2 = document.createElement('canvas'); cv2.width = 1024; cv2.height = 256; const c2 = cv2.getContext('2d');
    c2.fillStyle = 'rgba(255,95,162,0.55)'; c2.fillRect(0, 0, 1024, 256); c2.strokeStyle = '#ffffff'; c2.lineWidth = 10; c2.strokeRect(10, 10, 1004, 236);
    c2.fillStyle = '#ffffff'; c2.font = '700 110px Oswald'; c2.textAlign = 'center'; c2.fillText('RIDESHARE PICKUP', 512, 168);
    const t2 = new THREE.CanvasTexture(cv2);
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), new THREE.MeshBasicMaterial({ map: t2, transparent: true, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2; zone.rotation.z = Math.PI; zone.position.set(50, 0.05, -131.5);
    zone.userData = { kind: 'poi', name: 'ライドシェア乗降ゾーン', desc: 'Uber / Lyft 指定乗降。退場ピーク時の待機列 = 帰路PRの接点' };
    plaza.add(zone);
    for (const x of [36, 64]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), steel); p.position.set(x, 1.5, -128); plaza.add(p);
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: 0xff5fa2 })); s.position.set(x, 2.9, -128); plaza.add(s);
    }
  })();

  /* ---- 舗装インレイ（同心リング + ロゴ円）---- */
  (function paving() {
    const cz = -40 - 8;
    for (const r of [14, 22, 30, 38]) {
      const pts = []; for (let i = 0; i <= 72; i++) { const t = Math.PI + Math.PI * i / 72; pts.push(new THREE.Vector3(Math.cos(t) * r, 0.045, cz + Math.sin(t) * r * 0.8)); }
      plaza.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a5266 })));
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#0a1420'; c.beginPath(); c.arc(128, 128, 124, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#00c2ff'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 110, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffffff'; c.font = '600 40px Oswald'; c.textAlign = 'center'; c.fillText('crypto.com', 128, 122); c.font = '600 30px Oswald'; c.fillText('ARENA', 128, 160);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
    logo.rotation.x = -Math.PI / 2; logo.rotation.z = Math.PI; logo.position.set(0, 0.05, -66); plaza.add(logo);
  })();
})();
