/* ================================================================
   L2 内部の作り込み — BIM の粒度を一段上げる
   ・外周エンベロープ壁（クリアストーリー帯・案内サインバンド）
   ・コンコース天井 + ダウンライト / ボミトリー ポータル + 区画サイン
   ・区画番号プレート（全区画・アトラス1枚）/ 通路段鼻ライト
   ・チャンピオンシップバナー / 永久欠番（Lakers・Kings・Sparks）
   ・センターハング増強（アンダーベリー LED・上部ハロー・吊りケーブル）
   ・スポーツ照明（キャットウォーク投光器）/ 選手入場トンネル / スイート内装
   点群ビューでは detailGroup ごと伏せる（52_cloud.js setPointCloud）。
================================================================ */
const detailGroup = new THREE.Group(); interior.add(detailGroup);

setLoad(93, '場内ディテール（壁・天井・サイン・バナー）を生成中');
(function interiorDetail() {
  const back100a = TIER.L100.a + TIER.L100.rows * TIER.L100.tread;
  const back100b = TIER.L100.b + TIER.L100.rows * TIER.L100.tread;
  const back300a = TIER.L300.a + TIER.L300.rows * TIER.L300.tread;
  const back300b = TIER.L300.b + TIER.L300.rows * TIER.L300.tread;
  const aOut = back300a + 12, bOut = back300b + 12;         // 外周柱リング
  const ringQuads = (B, a, b, y0, y1, col, S, k) => {
    for (let i = 0; i < S; i++) {
      const p0 = ringPt(a, b, 2 * Math.PI * i / S), p1 = ringPt(a, b, 2 * Math.PI * (i + 1) / S);
      const c = (k && (i % k === 0)) ? null : col;
      if (!c) continue;
      B.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], c);
    }
  };
  const ringSlab = (B, a, b, w, y, col, S) => {
    for (let i = 0; i < S; i++) {
      const t0 = 2 * Math.PI * i / S, t1 = 2 * Math.PI * (i + 1) / S;
      const p0 = ringPt(a, b, t0), p1 = ringPt(a, b, t1), q0 = ringPt(a + w, b + w, t0), q1 = ringPt(a + w, b + w, t1);
      B.quad([p0[0], y, p0[1]], [p1[0], y, p1[1]], [q1[0], y, q1[1]], [q0[0], y, q0[1]], col);
    }
  };
  const bandTex = (items, w, h, bg, fg) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const seg = w / items.length;
    items.forEach((s, i) => {
      c.fillStyle = i % 2 ? fg : '#ffffff'; c.font = '600 ' + Math.round(h * 0.5) + 'px Oswald';
      c.textAlign = 'center'; c.fillText(s, i * seg + seg / 2, h * 0.68);
    });
    const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; return t;
  };

  /* ---------- 外周エンベロープ壁（柱間パネル + クリアストーリー + サインバンド） ---------- */
  (function envelope() {
    const B = new Builder();
    const S = 96, aw = aOut + 0.6, bw = bOut + 0.6;
    ringQuads(B, aw, bw, 0, 12.4, [0.085, 0.09, 0.115], S);
    ringQuads(B, aw, bw, 13.6, 28.4, [0.09, 0.095, 0.12], S);
    ringQuads(B, aw, bw, 29.6, 29.8, [0.12, 0.13, 0.16], S);
    ringQuads(B, aw, bw, 33.4, 34.2, [0.10, 0.105, 0.13], S);
    const wall = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
    wall.userData = { kind: 'bim', type: 'IfcWall', tag: 'ENV-WALL',
      attrs: { '部材種別': '外周エンベロープ壁（PCa パネル + 内装 GL ボード）', '高さ': 'FL±0 〜 +34.2 m',
               '開口': 'クリアストーリー FL+29.8〜33.4 / コンコース サインバンド', '遮音': 'Rw 55 dB（屋外騒音対策）' } };
    detailGroup.add(wall); BIM_ELEMS.push(wall);
    /* クリアストーリー（上層のガラス帯。外光/夜間は外観の発光帯） */
    const G = new Builder();
    ringQuads(G, aw, bw, 29.8, 33.4, [0.16, 0.34, 0.55], S);
    const cl = new THREE.Mesh(G.geom(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x1f4d78, emissiveIntensity: 0.35,
      roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    detailGroup.add(cl);
    /* コンコース案内サインバンド（内側に向けたリボン状の連続サイン） */
    const mk = (a, b, y0, y1, items, bg, fg) => {
      const P = [], N = [], UV = [];
      const SS = 160;
      for (let i = 0; i < SS; i++) {
        const t0 = 2 * Math.PI * i / SS, t1 = 2 * Math.PI * (i + 1) / SS;
        const p0 = ringPt(a, b, t0), p1 = ringPt(a, b, t1);
        const u0 = i / SS * 12, u1 = (i + 1) / SS * 12;
        P.push(p0[0], y0, p0[1], p0[0], y1, p0[1], p1[0], y1, p1[1], p0[0], y0, p0[1], p1[0], y1, p1[1], p1[0], y0, p1[1]);
        const L = Math.hypot(p0[0], p0[1]) || 1;
        for (let k = 0; k < 6; k++) N.push(-p0[0] / L, 0, -p0[1] / L);
        UV.push(u0, 0, u0, 1, u1, 1, u0, 0, u1, 1, u1, 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      const tex = bandTex(items, 2048, 64, bg, fg);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, color: bg, side: THREE.DoubleSide }));
      m.userData = { kind: 'led', name: '案内サインバンド ' + items[0] };
      detailGroup.add(m);
    };
    mk(aw - 0.05, bw - 0.05, 12.4, 13.6, ['◀ SECTIONS 101–110', 'RESTROOMS', 'TEAM STORE ▶', 'SECTIONS 111–119 ▶', 'FIRST AID', '◀ PREMIER LEVEL', 'CONCESSIONS', 'GATE A ▶'], '#101826', '#00c2ff');
    mk(aw - 0.05, bw - 0.05, 28.4, 29.6, ['◀ SECTIONS 301–317', 'RESTROOMS', 'ELEVATORS ▶', 'SECTIONS 318–334 ▶', 'GUEST SERVICES', '◀ ESCALATORS', 'CONCESSIONS', 'EXIT ▶'], '#1a1026', '#fdb927');
  })();

  /* ---------- コンコース天井（スラブ下端）+ ダウンライト、100L 背後の床延長 ---------- */
  (function ceilings() {
    const B = new Builder(), cc = [0.11, 0.115, 0.14], fc = [0.075, 0.08, 0.10];
    ringSlab(B, back100a + 2.0, back100b + 2.0, aOut - back100a - 1.6, 14.6, cc, 220);   // 100L 天井（Premier 床下）
    ringSlab(B, back100a + 13.0, back100b + 13.0, aOut - back100a - 12.6, 12.0, fc, 220); // 100L 床の延長（クラブ/BOH 側）
    ringSlab(B, back300a + 2.0, back300b + 2.0, aOut - back300a - 1.6, 32.0, cc, 220);   // 300L 天井
    const m = new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
    m.userData = { kind: 'bim', type: 'IfcCovering', tag: 'CLG-CONC',
      attrs: { '部材種別': 'コンコース天井（岩綿吸音板 + 設備点検口）', '天井高': '100L 2.6 m / 300L 4.0 m',
               '照明': 'LED ダウンライト φ150 @4.0 m 千鳥', '設備': 'スプリンクラー・スピーカー・サイネージ電源' } };
    detailGroup.add(m); BIM_ELEMS.push(m);
    const P = [];
    [[back100a + 4.5, back100b + 4.5, 14.5], [back100a + 9.5, back100b + 9.5, 14.5], [back300a + 4.0, back300b + 4.0, 31.9], [back300a + 8.0, back300b + 8.0, 31.9]].forEach(([a, b, y]) => {
      const lut = ringLUT(a, b, 400), n = Math.round(lut.tot / 4.0);
      for (let i = 0; i < n; i++) { const p = ringPt(a, b, fracToT(lut, i / n)); P.push(p[0], y, p[1]); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    detailGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1d6, size: 0.55, sizeAttenuation: true })));
  })();

  /* ---------- ボミトリー ポータル（枠 + 区画サイン） ---------- */
  const secAt = (list, f) => { const ff = ((f % 1) + 1) % 1; for (const s of list) { if (ff >= s.f0 && ff < s.f1) return s.sec; if (ff + 1 >= s.f0 && ff + 1 < s.f1) return s.sec; } return list[0].sec; };
  const lut100 = ringLUT(TIER.L100.a, TIER.L100.b, 720), lut300 = ringLUT(TIER.L300.a, TIER.L300.b, 720);
  (function portals() {
    const frame = new THREE.MeshStandardMaterial({ color: 0x252b3a, roughness: 0.6, metalness: 0.3 });
    VOMS.forEach((v, i) => {
      const is100 = v.label[4] === '1';
      const idx = +v.label.slice(5) - 1, cnt = is100 ? 19 : 17;
      const f = (idx + 0.5) / cnt;
      const sec = secAt(is100 ? SECTION_100 : SECTION_300, f);
      const ang = Math.atan2(v.x, v.z);
      const g = new THREE.Group(); g.position.set(v.x * 1.045, v.y - 2.6, v.z * 1.045); g.rotation.y = ang;
      for (const s of [-1.6, 1.6]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.5), frame); j.position.set(s, 1.6, 0); g.add(j); }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.5), frame); lintel.position.set(0, 3.45, 0); g.add(lintel);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d');
      c.fillStyle = '#0a1420'; c.fillRect(0, 0, 256, 96); c.fillStyle = is100 ? '#00c2ff' : '#fdb927'; c.fillRect(0, 0, 256, 8);
      c.fillStyle = '#ffffff'; c.font = '700 54px Oswald'; c.textAlign = 'center'; c.fillText(sec, 128, 70);
      const tex = new THREE.CanvasTexture(cv);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, color: 0x0a1420, side: THREE.DoubleSide }));
      sg.position.set(0, 4.2, 0); g.add(sg);
      g.userData = { kind: 'poi', name: 'ポータル ' + v.label + ' → Section ' + sec, desc: (is100 ? '100' : '300') + ' Level コンコースから客席への進入口。<br>Wi-Fi AP / ビーコンで着席検知' };
      detailGroup.add(g);
      v.sec = sec;
    });
  })();

  /* ---------- 区画番号プレート（全区画 / 1枚のアトラス） ---------- */
  (function plates() {
    const items = [];
    const add = (list, tier, lut, off, y) => {
      for (const s of list) {
        const t = fracToT(lut, (s.f0 + s.f1) / 2);
        const p = ringPt(tier.a + off, tier.b + off, t);
        items.push({ txt: s.sec, x: p[0], z: p[1], y, ang: Math.atan2(-p[0], -p[1]) });
      }
    };
    add(SECTION_100, TIER.L100, lut100, -0.9, TIER.L100.y0 + 1.25);
    add(SECTION_300, TIER.L300, lut300, -0.9, TIER.L300.y0 + 1.35);
    const lutP = ringLUT(TIER.PRM.a, TIER.PRM.b, 720);
    add(SECTION_PRM, TIER.PRM, lutP, -0.9, TIER.PRM.y0 + 1.2);
    const cols = 16, rows = Math.ceil(items.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * 128; cv.height = rows * 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#0d1420'; c.fillRect(0, 0, cv.width, cv.height);
    items.forEach((it, i) => {
      const cx = (i % cols) * 128, cy = Math.floor(i / cols) * 64;
      c.fillStyle = it.txt[0] === 'P' ? '#00e0a4' : it.txt[0] === '3' ? '#fdb927' : '#00c2ff'; c.fillRect(cx + 6, cy + 6, 116, 4);
      c.fillStyle = '#ffffff'; c.font = '700 40px Oswald'; c.textAlign = 'center'; c.fillText(it.txt, cx + 64, cy + 50);
    });
    const tex = new THREE.CanvasTexture(cv);
    const P = [], UV = [];
    items.forEach((it, i) => {
      const u0 = (i % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(i / cols) / rows, v0 = v1 - 1 / rows;
      const w = 1.5, h = 0.75, tx = Math.cos(it.ang) * w / 2, tz = -Math.sin(it.ang) * w / 2;
      const a = [it.x - tx, it.y - h / 2, it.z - tz], b = [it.x + tx, it.y - h / 2, it.z + tz];
      const cc = [it.x + tx, it.y + h / 2, it.z + tz], d = [it.x - tx, it.y + h / 2, it.z - tz];
      P.push(...a, ...b, ...cc, ...a, ...cc, ...d);
      UV.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.userData = { kind: 'poi', name: '区画番号プレート', desc: '各区画最前列の手すりに設置（' + items.length + ' 枚）' };
    detailGroup.add(m);
  })();

  /* ---------- 通路段鼻ライト（ボミトリー階段の両端） ---------- */
  (function stepLights() {
    const P = [];
    for (const v of VOMS) {
      const is100 = v.label[4] === '1', T = is100 ? TIER.L100 : TIER.L300;
      const t = Math.atan2(v.z, v.x), w = is100 ? 0.036 : 0.030;
      for (let r = 0; r < T.rows; r++) {
        const a = T.a + r * T.tread + 0.1, b = T.b + r * T.tread + 0.1, y = T.y0 + r * T.rise + 0.06;
        for (const s of [-0.6, 0.6]) { const p = ringPt(a, b, t + s * w); P.push(p[0], y, p[1]); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    detailGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd28a, size: 0.22, sizeAttenuation: true })));
  })();

  /* ---------- バナー（優勝旗・永久欠番）: 屋根から吊る ---------- */
  (function banners() {
    const mkTex = (top, big, sub, bg, fg, fg2) => {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 208; const c = cv.getContext('2d');
      c.fillStyle = bg; c.fillRect(0, 0, 128, 208);
      c.fillStyle = fg; c.fillRect(0, 0, 128, 6); c.fillRect(0, 202, 128, 6);
      c.textAlign = 'center';
      c.fillStyle = fg2; c.font = '600 15px Oswald'; c.fillText(top, 64, 46);
      c.fillStyle = fg; c.font = '700 ' + (big.length > 4 ? 30 : 56) + 'px Oswald'; c.fillText(big, 64, 122);
      c.fillStyle = fg2; c.font = '600 14px Oswald'; c.fillText(sub, 64, 170);
      return new THREE.CanvasTexture(cv);
    };
    const hang = (tex, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry; detailGroup.add(m);
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y + 1.4, z), new THREE.Vector3(x, 39.5, z)]);
      detailGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x3a4152 })));
    };
    /* Lakers 優勝旗 17（+x エンド、2段） */
    const champs = [1949, 1950, 1952, 1953, 1954, 1972, 1980, 1982, 1985, 1987, 1988, 2000, 2001, 2002, 2009, 2010, 2020];
    champs.forEach((yr, i) => {
      const row = i < 9 ? 0 : 1, k = row ? i - 9 : i, n = row ? 8 : 9;
      const z = (k - (n - 1) / 2) * 2.4;
      hang(mkTex('LOS ANGELES LAKERS', String(yr), 'WORLD CHAMPIONS', '#552583', '#fdb927', '#e9edf6'), 57.5 - row * 2.2, 33.6 - row * 3.0, z, Math.PI / 2);
    });
    /* 永久欠番（-x エンド） */
    const ret = [['8', 'KOBE BRYANT'], ['13', 'WILT CHAMBERLAIN'], ['22', 'ELGIN BAYLOR'], ['24', 'KOBE BRYANT'], ['25', 'GAIL GOODRICH'],
                 ['32', 'MAGIC JOHNSON'], ['33', 'KAREEM ABDUL-JABBAR'], ['34', 'SHAQUILLE O\'NEAL'], ['42', 'JAMES WORTHY'],
                 ['44', 'JERRY WEST'], ['52', 'JAMAAL WILKES'], ['MIC', 'CHICK HEARN']];
    ret.forEach(([num, name], i) => {
      const row = i < 6 ? 0 : 1, k = row ? i - 6 : i;
      const z = (k - 2.5) * 2.4;
      hang(mkTex('LAKERS', num, name, '#fdb927', '#552583', '#2a1340'), -57.5 + row * 2.2, 33.6 - row * 3.0, z, Math.PI / 2);
    });
    /* Kings（+z サイド）と Sparks（-z サイド） */
    const kings = [['2012', 'STANLEY CUP CHAMPIONS'], ['2014', 'STANLEY CUP CHAMPIONS'], ['4', 'ROB BLAKE'], ['16', 'MARCEL DIONNE'], ['18', 'DAVE TAYLOR'],
                   ['20', 'LUC ROBITAILLE'], ['23', 'DUSTIN BROWN'], ['30', 'ROGIE VACHON'], ['99', 'WAYNE GRETZKY']];
    kings.forEach(([big, sub], i) => hang(mkTex('LOS ANGELES KINGS', big, sub, '#111111', '#a2aaad', '#e9edf6'), (i - 4) * 2.4, 32.5, 50.5, 0));
    [['2001', 'WNBA CHAMPIONS'], ['2002', 'WNBA CHAMPIONS'], ['2016', 'WNBA CHAMPIONS']].forEach(([big, sub], i) =>
      hang(mkTex('LOS ANGELES SPARKS', big, sub, '#702f8a', '#ffc72c', '#e9edf6'), (i - 1) * 2.4, 32.5, -50.5, 0));
  })();

  /* ---------- センターハング増強: アンダーベリー LED / 上部ハロー / 吊りケーブル ---------- */
  (function centerhung() {
    const under = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 0.9, 32, 1, true),
      (() => { const t = ledTex(['crypto.com', 'Delta', 'Kia', 'AMEX', 'BODYARMOR', 'Verizon'], ['#00d4ff', '#fdb927', '#e9edf6'], 2048, 64);
               t.wrapS = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, color: 0x0a0d16, side: THREE.DoubleSide }); })());
    under.position.y = 21.5 - 3.0; under.userData = { kind: 'led', name: 'センターハング アンダーベリー LED' }; interior.add(under);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 1.2, 40, 1, true),
      (() => { const t = ledTex(['LAKERS', 'KINGS', 'SPARKS', 'crypto.com ARENA'], ['#fdb927', '#a2aaad', '#ffc72c', '#00d4ff'], 2048, 72);
               t.wrapS = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.8, color: 0x0a0d16, side: THREE.DoubleSide }); })());
    halo.position.y = 21.5 + 4.4; halo.userData = { kind: 'led', name: 'センターハング 上部ハロー LED' }; interior.add(halo);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x1a1f2b, roughness: 0.6 }));
    disc.position.y = 21.5 + 5.1; detailGroup.add(disc);
    const W = [];
    for (let i = 0; i < 8; i++) { const t = 2 * Math.PI * i / 8; W.push(Math.cos(t) * 5.5, 26.8, Math.sin(t) * 5.5, Math.cos(t) * 5.5, 40.0, Math.sin(t) * 5.5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
    detailGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x556070 })));
  })();

  /* ---------- スポーツ照明（キャットウォークの投光器アレイ） ---------- */
  (function sportsLights() {
    const aR = back300a + 14, bR = back300b + 14;
    const pos = [];
    for (const [k, n] of [[0.5, 56], [0.75, 72]]) for (let i = 0; i < n; i++) {
      const p = ringPt(aR * k, bR * k, 2 * Math.PI * i / n); pos.push([p[0], 32.7, p[1]]);
    }
    const N = pos.length;
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 0.45), new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.6 }), N);
    const lens = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), N);
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1);
    pos.forEach((p, i) => {
      const yaw = Math.atan2(-p[0], -p[2]);
      E.set(0.55, yaw, 0, 'YXZ'); Q.setFromEuler(E);
      P.set(p[0], p[1], p[2]); M.compose(P, Q, S); body.setMatrixAt(i, M);
      const fx = Math.sin(yaw) * 0.25, fz = Math.cos(yaw) * 0.25;
      P.set(p[0] + fx, p[1] - 0.14, p[2] + fz); M.compose(P, Q, S); lens.setMatrixAt(i, M);
    });
    body.instanceMatrix.needsUpdate = lens.instanceMatrix.needsUpdate = true;
    body.userData = { kind: 'bim', type: 'IfcLightFixture', tag: 'SPL-RIG',
      attrs: { '部材種別': 'LED スポーツ投光器 1,200W（' + N + ' 台）', '照度': 'コート面 2,000 lx（4K 中継対応・フリッカーフリー）',
               '取付': 'キャットウォーク R=0.5 / 0.75', '制御': 'DMX 演出連動（入場演出・ハーフタイム）' } };
    trussGrp.add(body, lens); BIM_ELEMS.push(body);
  })();

  /* ---------- 選手入場トンネル（コーナー 2 箇所） ---------- */
  (function tunnels() {
    const darkM = new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 1 });
    [[0.30 * Math.PI, 'LAKERS'], [1.30 * Math.PI, 'VISITORS']].forEach(([t, nm]) => {
      const p = ringPt(TIER.L100.a + 2.6, TIER.L100.b + 2.6, t);
      const ang = Math.atan2(-p[0], -p[1]);
      const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = ang;
      const box = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 7.0), darkM); box.position.y = 1.5; g.add(box);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 6.8), new THREE.MeshBasicMaterial({ color: nm === 'LAKERS' ? 0x552583 : 0x2a3346 })); strip.position.y = 0.03; g.add(strip);
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d');
      c.fillStyle = nm === 'LAKERS' ? '#552583' : '#0a1420'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#fdb927'; c.font = '700 60px Oswald'; c.textAlign = 'center'; c.fillText(nm, 256, 70);
      const tex = new THREE.CanvasTexture(cv);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, color: 0x0a1420, side: THREE.DoubleSide }));
      s.position.set(0, 3.45, 3.4); g.add(s);
      for (const sx of [-2.0, 2.0]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), new THREE.MeshBasicMaterial({ color: 0x00c2ff })); l.position.set(sx, 1.4, 3.45); g.add(l); }
      g.userData = { kind: 'poi', name: '選手入場トンネル（' + nm + '）', desc: 'ロッカールーム ⇄ コート。入場演出時はスポーツ照明を DMX で減光' };
      detailGroup.add(g);
    });
  })();

  /* ---------- スイート内装（バーカウンター・TV）---------- */
  (function suiteInteriors() {
    const lut = ringLUT(TIER.PRM.a - 0.5, TIER.PRM.b - 0.5, 720);
    const bar = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.5, metalness: 0.2 });
    const tvT = ledTex(['LAL 102', 'GSW 98'], ['#fdb927', '#e9edf6'], 512, 128, '#05070c');
    const tvM = new THREE.MeshStandardMaterial({ map: tvT, emissive: 0xffffff, emissiveMap: tvT, emissiveIntensity: 0.9, color: 0x05070c });
    for (const s of SUITE_LAYOUT) {
      const t = fracToT(lut, (s.f0 + s.f1) / 2);
      const p = ringPt(TIER.PRM.a - 0.5, TIER.PRM.b - 0.5, t);
      const w = Math.abs(s.f1 - s.f0) * lut.tot * 0.86, ang = Math.atan2(p[0], p[1]);
      const cx = p[0] * 1.07, cz = p[1] * 1.07;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.05, 0.6), bar); b.position.set(cx, TIER.PRM.y0 + 0.85, cz); b.rotation.y = ang + Math.PI / 2;
      const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), tvM); tv.position.set(cx * 1.008, TIER.PRM.y0 + 2.3, cz * 1.008); tv.rotation.y = Math.atan2(-p[0], -p[1]);
      b.userData = { kind: 'suite', name: s.sec }; tv.userData = { kind: 'suite', name: s.sec };
      interior.add(b, tv); SUITES.push(b, tv);
    }
  })();
})();
