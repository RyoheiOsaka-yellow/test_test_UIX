/* ================================================================
   L0 サイト詳細 — 実体(SOLID)モードで街の粒度を上げるレイヤー
   車線標示 / 横断歩道 / 歩道 / 街路灯（光溜まり付き）/ 街路樹 /
   建物の窓灯・航空障害灯 / フリーウェイ門型標識 / Metro 駅プラットフォーム /
   駐車区画 / アリーナ屋根（ドーム・屋上設備・屋上サイン）
   点描・線画は測量表現なので付加しない（gDetail は SOLID のみ表示）。
================================================================ */
const gDetail = new THREE.Group(); site.add(gDetail);
Object.assign(siteStats, { lights: 0, trees: 0, windows: 0, crosswalks: 0, stalls: 0 });

setLoad(72, '街路詳細（車線・街路灯・街路樹・窓灯）を生成中');
(function siteDetail() {
  const ARENA_D = [ARENA_C.x, -ARENA_C.z];                // データ座標系でのアリーナ中心
  const nearArena = (x, y, r) => Math.hypot(x - ARENA_D[0], y - ARENA_D[1]) < r;
  const inRange = (pts, r) => Math.hypot(pts[0][0], pts[0][1]) < r;
  const roadY = r => (r.b === 1 ? 7.5 + (r.ly || 1) * 1.6 : 0.18 + r.c * 0.05);
  const roadW = r => ROAD_W[r.c] * (r.ln ? clamp(r.ln / (r.c >= 3 ? 4 : 2), 0.7, 2.2) : 1);
  const lanesOf = r => r.ln || (r.c >= 4 ? 4 : 2);
  /* 折れ線を等間隔に歩く: cb(x, y, dx, dy) 。dx,dy は単位方向 */
  const walk = (pts, step, cb, offset) => {
    let carry = offset || 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
      const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L;
      let s = carry;
      while (s <= L) { cb(a[0] + dx * s, a[1] + dy * s, dx, dy); s += step; }
      carry = s - L;
    }
  };
  const inPoly = (x, y, p) => {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if (((p[i][1] > y) !== (p[j][1] > y)) &&
          (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c;
    }
    return c;
  };
  const openRing = poly => {
    const p = poly.slice();
    if (p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
    return p;
  };
  const lineMesh = (W, WC, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(WC, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: opacity < 1, opacity }));
  };

  /* ---------- 車線標示（センターライン・レーン破線・外側線） ---------- */
  (function laneMarks() {
    const W = [], WC = [];
    const white = [0.70, 0.73, 0.80], yellow = [0.86, 0.70, 0.22];
    const seg = (ax, ay, bx, by, y, col) => {
      W.push(ax, y, -ay, bx, y, -by); WC.push(col[0], col[1], col[2], col[0], col[1], col[2]);
    };
    for (const r of SCENE_DATA.roads) {
      if (r.c < 1 || r.b === -1 || !inRange(r.p, 1500)) continue;
      const w = roadW(r), n = lanesOf(r), y = roadY(r) + 0.025;
      const fw = r.c >= 4;
      /* レーン区分線: n-1 本。都市道路は中央を黄実線、他は白破線。フリーウェイは全て白破線 */
      for (let k = 1; k < n; k++) {
        const off = -w / 2 + w * k / n;
        const center = !fw && n % 2 === 0 && k === n / 2;
        if (center) {
          for (let i = 0; i < r.p.length - 1; i++) {
            const a = r.p[i], b = r.p[i + 1];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const nx = -(b[1] - a[1]) / L * off, ny = (b[0] - a[0]) / L * off;
            seg(a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny, y, yellow);
          }
        } else {
          walk(r.p, 9, (x, yy, dx, dy) => {
            const nx = -dy * off, ny = dx * off;
            seg(x + nx, yy + ny, x + nx + dx * 3, yy + ny + dy * 3, y, white);
          }, 2);
        }
      }
      /* 外側線（幹線以上） */
      if (r.c >= 2) for (const s of [-1, 1]) {
        const off = s * (w / 2 - 0.35);
        const col = (fw && s < 0) ? yellow : white;
        for (let i = 0; i < r.p.length - 1; i++) {
          const a = r.p[i], b = r.p[i + 1];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = -(b[1] - a[1]) / L * off, ny = (b[0] - a[0]) / L * off;
          seg(a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny, y, col);
        }
      }
    }
    const m = lineMesh(W, WC, 0.62); m.name = 'laneMarks'; gDetail.add(m);
  })();

  /* ---------- 歩道（車道の両脇に一段暗い帯。縁石の存在を読ませる） ---------- */
  (function sidewalks() {
    const B = new Builder(), col = [0.13, 0.15, 0.20];
    for (const r of SCENE_DATA.roads) {
      if (r.c < 1 || r.c > 3 || r.b || !inRange(r.p, 1500)) continue;
      addRibbon(B, r.p, roadW(r) + 6.5, 0.14, col);
    }
    gDetail.add(new THREE.Mesh(B.geom(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  })();

  /* ---------- 横断歩道（交差点の各流入路にゼブラ） ---------- */
  (function crosswalks() {
    const key = p => Math.round(p[0]) + ',' + Math.round(p[1]);
    const deg = {};
    const cand = SCENE_DATA.roads.filter(r => r.c >= 1 && !r.b && inRange(r.p, 1200) && r.p.length > 1);
    for (const r of cand) for (const e of [r.p[0], r.p[r.p.length - 1]]) deg[key(e)] = (deg[key(e)] || 0) + 1;
    const B = new Builder(), zc = [0.80, 0.83, 0.90];
    let n = 0;
    const zebra = (px, py, dx, dy, w, y) => {
      /* 進入方向 (dx,dy) に沿って交差点から 4m 手前に、道路幅いっぱいの縞を敷く */
      const nx = -dy, ny = dx;
      const stripes = Math.max(3, Math.floor(w / 1.1));
      for (let k = 0; k < stripes; k++) {
        const o = -w / 2 + (k + 0.5) * (w / stripes);
        const cx = px + nx * o, cy = py + ny * o;
        const a = [cx - nx * 0.28, cy - ny * 0.28], b = [cx + nx * 0.28, cy + ny * 0.28];
        B.quad([a[0], y, -a[1]], [b[0], y, -b[1]],
               [b[0] + dx * 2.6, y, -(b[1] + dy * 2.6)], [a[0] + dx * 2.6, y, -(a[1] + dy * 2.6)], zc);
      }
      n++;
    };
    for (const r of cand) {
      const w = roadW(r), y = roadY(r) + 0.03;
      for (const end of [0, 1]) {
        const e = end ? r.p[r.p.length - 1] : r.p[0];
        if ((deg[key(e)] || 0) < 3) continue;
        const q = end ? r.p[r.p.length - 2] : r.p[1];
        const L = Math.hypot(q[0] - e[0], q[1] - e[1]); if (L < 14) continue;
        const dx = (q[0] - e[0]) / L, dy = (q[1] - e[1]) / L;   // 交差点から離れる向き
        const d0 = (r.c >= 3 ? 11 : 8);
        zebra(e[0] + dx * d0, e[1] + dy * d0, dx, dy, w, y);
      }
    }
    siteStats.crosswalks = n;
    gDetail.add(new THREE.Mesh(B.geom(), new THREE.MeshBasicMaterial({ vertexColors: true,
      transparent: true, opacity: 0.85 })));
  })();

  /* ---------- 街路灯（ポール + 灯具 + 路面の光溜まり） ---------- */
  (function streetLights() {
    const spots = [];
    let side = 1;
    for (const r of SCENE_DATA.roads) {
      if (r.c < 1 || r.b === -1) continue;
      const fw = r.c >= 4;
      if (!inRange(r.p, fw ? 1600 : 1100)) continue;
      const w = roadW(r), y = roadY(r);
      walk(r.p, fw ? 55 : 36, (x, yy, dx, dy) => {
        if (nearArena(x, yy, 185)) return;
        side = -side;
        const off = side * (w / 2 + (fw ? 1.2 : 2.2));
        spots.push({ x: x - dy * off, y: yy + dx * off, h: fw ? 13 : 9.5, base: y, fw,
                     ang: Math.atan2(dx, -dy) });
      }, 12);
    }
    const N = spots.length; siteStats.lights = N;
    const poleG = new THREE.CylinderGeometry(0.11, 0.17, 1, 6);
    poleG.translate(0, 0.5, 0);
    const pole = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({
      color: 0x8b93a3, metalness: 0.6, roughness: 0.5 }), N);
    const headG = new THREE.BoxGeometry(1.2, 0.22, 0.4);
    const head = new THREE.InstancedMesh(headG, new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), N);
    /* 光溜まり: 放射グラデーションの加算平面 */
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,225,170,0.55)'); gr.addColorStop(0.5, 'rgba(255,215,150,0.16)');
    gr.addColorStop(1, 'rgba(255,205,130,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const poolG = new THREE.PlaneGeometry(1, 1); poolG.rotateX(-Math.PI / 2);
    const pool = new THREE.InstancedMesh(poolG, new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending }), N);
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(),
          S = new THREE.Vector3(), E = new THREE.Euler();
    spots.forEach((s, i) => {
      E.set(0, s.ang, 0); Q.setFromEuler(E);
      P.set(s.x, s.base, -s.y); S.set(1, s.h, 1); M.compose(P, Q, S); pole.setMatrixAt(i, M);
      /* 灯具は車道側へ 0.9m 張り出す */
      const ox = Math.cos(s.ang) * 0.6, oz = -Math.sin(s.ang) * 0.6;
      P.set(s.x + ox, s.base + s.h, -s.y + oz); S.set(1, 1, 1); M.compose(P, Q, S); head.setMatrixAt(i, M);
      const d = s.fw ? 26 : 16;
      P.set(s.x + ox * 2, s.base + 0.06, -s.y + oz * 2); S.set(d, 1, d); M.compose(P, Q, S); pool.setMatrixAt(i, M);
    });
    pole.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = pool.instanceMatrix.needsUpdate = true;
    gDetail.add(pole, head, pool);
  })();

  /* ---------- 街路樹・公園樹 ---------- */
  (function trees() {
    const spots = [];
    let side = 1;
    for (const r of SCENE_DATA.roads) {
      if (r.c > 1 || r.b || !inRange(r.p, 900)) continue;
      const w = roadW(r);
      walk(r.p, 24, (x, yy, dx, dy) => {
        if (nearArena(x, yy, 185)) return;
        side = -side;
        const off = side * (w / 2 + 3.0);
        const k = spots.length;
        spots.push({ x: x - dy * off + (hrand(k, 3) - 0.5) * 1.5, y: yy + dx * off + (hrand(k, 4) - 0.5) * 1.5,
                     s: 0.8 + hrand(k, 5) * 0.6 });
      }, 6);
    }
    for (const poly of SCENE_DATA.lu.park || []) {
      const p = openRing(poly);
      if (p.length < 3 || !inRange(p, 1600)) continue;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      if ((x1 - x0) * (y1 - y0) > 400000) continue;      // 巨大な公園ポリゴンは除外（点数抑制）
      for (let x = x0 + 6; x < x1; x += 13) for (let y = y0 + 6; y < y1; y += 13) {
        const k = spots.length;
        const jx = x + (hrand(k, 7) - 0.5) * 8, jy = y + (hrand(k, 8) - 0.5) * 8;
        if (!inPoly(jx, jy, p) || nearArena(jx, jy, 185)) continue;
        spots.push({ x: jx, y: jy, s: 1.0 + hrand(k, 9) * 0.9 });
        if (spots.length > 5000) break;
      }
    }
    const N = spots.length; siteStats.trees = N;
    const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1, 5); trunkG.translate(0, 0.5, 0);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }), N);
    const crownG = new THREE.IcosahedronGeometry(1, 1);
    const crown = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), N);
    primeInstanceColor(crown, N);
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    const C = new THREE.Color();
    spots.forEach((t, i) => {
      const h = 4.2 * t.s;
      P.set(t.x, 0.1, -t.y); S.set(1, h, 1); M.compose(P, Q, S); trunk.setMatrixAt(i, M);
      const r = 2.3 * t.s;
      P.set(t.x, 0.1 + h + r * 0.55, -t.y); S.set(r, r * 1.15, r); M.compose(P, Q, S); crown.setMatrixAt(i, M);
      C.setHSL(0.30 + hrand(i, 11) * 0.08, 0.45, 0.20 + hrand(i, 12) * 0.10);
      crown.setColorAt(i, C);
    });
    trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = true;
    crown.instanceColor.needsUpdate = true;
    gDetail.add(trunk, crown);
  })();

  /* ---------- 窓灯（夜景）と高層建物の航空障害灯 ----------
     200m 圏の建物は L1 で gClose ごと伏せるので、その窓灯も gClose 側に置く。 */
  (function windows() {
    const sets = { near: { P: [], C: [] }, far: { P: [], C: [] } };
    const R = [];
    const warm = [1.0, 0.86, 0.58], cool = [0.72, 0.84, 1.0];
    let k = 0;
    const facade = (poly, h, step, lit, radius) => {
      const p = openRing(poly);
      if (p.length < 3 || h < 10 || !inRange(p, radius)) return;
      const set = inRange(p, 200) ? sets.near : sets.far;
      if (area2(p) < 0) p.reverse();                        // 反時計回りに揃える（外向き法線 = (dy, -dx)）
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < step) continue;
        const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
        const n = Math.floor(L / step);
        for (let j = 0; j < n; j++) {
          const t = (j + 0.5) / n;
          const x = a[0] + (b[0] - a[0]) * t + nx * 0.3, y = a[1] + (b[1] - a[1]) * t + ny * 0.3;
          for (let z = 2.4; z < h - 1.2; z += 3.6) {
            k++;
            if (hrand(k, 21) > lit) continue;
            const col = hrand(k, 22) < 0.62 ? warm : cool;
            const v = 0.55 + hrand(k, 23) * 0.45;
            set.P.push(x, z, -y); set.C.push(col[0] * v, col[1] * v, col[2] * v);
          }
        }
      }
      if (h > 60) {                                          // 航空障害灯（屋上の四隅相当）
        for (let i = 0; i < p.length; i += Math.max(1, Math.floor(p.length / 4))) R.push(p[i][0], h + 1.2, -p[i][1]);
      }
    };
    for (const b of SCENE_DATA.buildings) facade(b.p, b.h || 0, 4.2, 0.42, 1700);
    for (const b of SCENE_DATA.mid) {
      const h = 7 + hrand(Math.round(b.p[0][0] * 7 + b.p[0][1]), 23) * 22;   // 20_site.js と同じ高さ
      facade(b.p, h, 7.5, 0.3, 2300);
    }
    /* 丸い柔らかなスプライト（正方形点にならないように） */
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(16, 16, 2, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(cv);
    const mkPts = set => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(set.P, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(set.C, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.1, sizeAttenuation: true, map: sprite,
        vertexColors: true, transparent: true, opacity: 0.9, alphaTest: 0.05, depthWrite: false }));
    };
    siteStats.windows = (sets.near.P.length + sets.far.P.length) / 3;
    gDetail.add(mkPts(sets.far));
    const nearPts = mkPts(sets.near); nearPts.name = 'winNear'; gClose.add(nearPts);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(R, 3));
    const beacon = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xff2a3c, size: 3.5, map: sprite,
      sizeAttenuation: true, transparent: true, opacity: 1, alphaTest: 0.05, depthWrite: false }));
    gDetail.add(beacon);
    FRAME_HOOKS.push((dt, now) => { beacon.material.opacity = (Math.sin(now / 420) > 0.2) ? 1 : 0.12; });
  })();

  /* ---------- フリーウェイ門型標識（I-110 / I-10） ---------- */
  (function gantries() {
    const cand = [];
    for (const r of SCENE_DATA.roads) {
      if (r.c < 4 || r.b === -1 || !inRange(r.p, 1500)) continue;
      walk(r.p, 260, (x, y, dx, dy) => { cand.push({ x, y, dx, dy, w: roadW(r), base: roadY(r) }); }, 90);
    }
    const picked = [];
    for (const c of cand) {
      if (nearArena(c.x, c.y, 220)) continue;
      if (picked.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 330)) continue;
      picked.push(c); if (picked.length >= 10) break;
    }
    const exits = ['EXIT 20B  Olympic Blvd', 'EXIT 9A  Pico Blvd  ·  L.A. LIVE', 'EXIT 21  Figueroa St',
                   'EXIT 9  Grand Ave', 'EXIT 20A  9th St', 'EXIT 8  Adams Blvd'];
    const post = new THREE.MeshStandardMaterial({ color: 0x8b93a3, metalness: 0.6, roughness: 0.45 });
    picked.forEach((c, i) => {
      const ns = Math.abs(c.dy) > Math.abs(c.dx);
      const title = ns ? 'I-110  Harbor Fwy  ' + (c.dy > 0 ? 'NORTH' : 'SOUTH')
                       : 'I-10  Santa Monica Fwy  ' + (c.dx > 0 ? 'EAST' : 'WEST');
      const cv = document.createElement('canvas'); cv.width = 768; cv.height = 192;
      const g = cv.getContext('2d');
      g.fillStyle = '#0f6a3a'; g.fillRect(0, 0, 768, 192);
      g.strokeStyle = '#e9edf6'; g.lineWidth = 6; g.strokeRect(8, 8, 752, 176);
      g.fillStyle = '#ffffff'; g.font = '600 46px Oswald'; g.textAlign = 'left';
      g.fillText(title, 32, 78);
      g.font = '500 40px Oswald'; g.fillText(exits[i % exits.length], 32, 150);
      g.fillStyle = '#fdb927'; g.fillRect(650, 120, 90, 8);
      const tex = new THREE.CanvasTexture(cv);
      const grp = new THREE.Group();
      const ang = Math.atan2(c.dx, -c.dy);                   // 進行方向（world）に法線を向ける
      grp.position.set(c.x, c.base, -c.y); grp.rotation.y = ang;
      const hw = c.w / 2 + 1.5;
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 7.5, 8), post);
        p.position.set(s * hw, 3.75, 0); grp.add(p);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.6, 0.7, 0.7), post);
      beam.position.set(0, 7.4, 0); grp.add(beam);
      /* 表裏それぞれ正像で読めるよう 2 枚を背中合わせに置く */
      const signM = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex,
        emissiveIntensity: 0.55, color: 0x0f6a3a });
      for (const f of [1, -1]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), signM);
        sign.position.set(hw * 0.25, 9.3, f * 0.12); sign.rotation.y = f > 0 ? 0 : Math.PI; grp.add(sign);
      }
      grp.userData = { kind: 'poi', name: '門型標識: ' + title,
        desc: exits[i % exits.length] + '<br>フリーウェイ経由の来場者が最初に接触する屋外媒体候補' };
      gDetail.add(grp);
    });
  })();

  /* ---------- Metro 駅（地上駅=プラットフォーム / 地下駅=出入口ヘッドハウス） ---------- */
  (function stations() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4b6, metalness: 0.6, roughness: 0.4 });
    const conc = new THREE.MeshStandardMaterial({ color: 0x5c6270, roughness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2a4a6e, transparent: true, opacity: 0.4,
      metalness: 0.5, roughness: 0.2, side: THREE.DoubleSide });
    const label = (txt, sub, w) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const g = cv.getContext('2d');
      g.fillStyle = '#111318'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(56, 64, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111318'; g.font = '700 58px Oswald'; g.textAlign = 'center'; g.fillText('M', 56, 85);
      g.fillStyle = '#ffffff'; g.font = '600 40px Oswald'; g.textAlign = 'left'; g.fillText(txt, 112, 60);
      g.fillStyle = '#fdb913'; g.font = '500 26px Oswald'; g.fillText(sub, 112, 104);
      const tex = new THREE.CanvasTexture(cv);
      return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
        new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex,
          emissiveIntensity: 0.7, color: 0x111318, side: THREE.DoubleSide }));
    };
    for (const s of SCENE_DATA.stations) {
      const d = Math.hypot(s.p[0], s.p[1]);
      if (d > 1300) continue;
      /* 最寄り線路セグメントの向きと地上/地下を拾う */
      let best = null, bd = Infinity;
      for (const r of SCENE_DATA.railMetro) for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dd = Math.hypot(mx - s.p[0], my - s.p[1]);
        if (dd < bd) { bd = dd; best = { a, b, r }; }
      }
      if (!best) continue;
      const dx = best.b[0] - best.a[0], dy = best.b[1] - best.a[1], L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;                        // 線路方向（データ座標）
      const ang = Math.atan2(ux, -uy);
      const grp = new THREE.Group();
      grp.position.set(s.p[0], 0, -s.p[1]); grp.rotation.y = ang;
      const underground = best.r.b === -1 || s.k === 'subway';
      const lines = best.r.n || 'Metro';
      if (underground) {
        /* 出入口ヘッドハウス（ガラス箱 + 階段）と駅名サイン */
        for (const sx of [-14, 14]) {
          const hh = new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 5), glass); hh.position.set(sx, 1.8, 7); grp.add(hh);
          const fr = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.3, 5.3), steel); fr.position.set(sx, 3.7, 7); grp.add(fr);
          const stair = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 6), conc); stair.position.set(sx, 0.2, 12); grp.add(stair);
          const totem = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.5, 0.5), steel); totem.position.set(sx + 5.5, 2.25, 4); grp.add(totem);
          const lb = label(s.n, lines, 8); lb.position.set(sx + 5.5, 5.4, 4); grp.add(lb);
        }
        grp.userData = { kind: 'station', name: s.n + '（出入口）',
          desc: '地下駅 / ' + lines + '<br>ヘッドハウス2箇所。改札通過 ≒ 来場 22 分前の接点' };
      } else {
        /* 地上駅: 相対式ホーム + 上屋 + 点字ブロック */
        for (const sz of [-5.2, 5.2]) {
          const pf = new THREE.Mesh(new THREE.BoxGeometry(72, 0.9, 3.6), conc); pf.position.set(0, 0.45, sz); grp.add(pf);
          const edge = new THREE.Mesh(new THREE.BoxGeometry(72, 0.02, 0.5),
            new THREE.MeshBasicMaterial({ color: 0xfdb913 }));
          edge.position.set(0, 0.92, sz - Math.sign(sz) * 1.5); grp.add(edge);
          const roof = new THREE.Mesh(new THREE.BoxGeometry(40, 0.25, 3.8),
            new THREE.MeshStandardMaterial({ color: 0x2a2f3b, roughness: 0.7 }));
          roof.position.set(0, 4.3, sz); grp.add(roof);
          for (let x = -18; x <= 18; x += 12) {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 8), steel);
            c.position.set(x, 2.6, sz + Math.sign(sz) * 1.2); grp.add(c);
          }
          const lb = label(s.n, lines, 9); lb.position.set(0, 3.2, sz + Math.sign(sz) * 1.85);
          lb.rotation.y = sz > 0 ? 0 : Math.PI; grp.add(lb);
          const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.5), steel);
          bench.position.set(8, 1.15, sz + Math.sign(sz) * 1.0); grp.add(bench);
        }
        grp.userData = { kind: 'station', name: s.n + '（ホーム）',
          desc: '地上駅 / ' + lines + '<br>相対式ホーム 72m・上屋 40m<br>アリーナ中心から ' + fmt(d) + ' m' };
      }
      gDetail.add(grp);
    }
  })();

  /* ---------- 駐車区画（白線） ---------- */
  (function stalls() {
    const W = [], WC = [], col = [0.34, 0.35, 0.42];
    let n = 0;
    for (const poly of SCENE_DATA.parking) {
      const p = openRing(poly);
      if (p.length < 3 || !inRange(p, 900)) continue;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      const alongX = (x1 - x0) >= (y1 - y0);                // 長辺方向に通路、短辺方向に区画
      for (let u = (alongX ? x0 : y0) + 1.5; u < (alongX ? x1 : y1); u += 2.7) {
        for (let v = (alongX ? y0 : x0) + 1; v < (alongX ? y1 : x1); v += 16) {
          for (const s of [0, 8]) {
            const vv = v + s + 1.5;
            const cx = alongX ? u : vv, cy = alongX ? vv : u;
            if (!inPoly(cx, cy, p)) continue;
            const ax = alongX ? u : vv - 2.5, ay = alongX ? vv - 2.5 : u;
            const bx = alongX ? u : vv + 2.5, by = alongX ? vv + 2.5 : u;
            W.push(ax, 0.16, -ay, bx, 0.16, -by); WC.push(col[0], col[1], col[2], col[0], col[1], col[2]);
            n++;
          }
        }
      }
      if (n > 9000) break;
    }
    siteStats.stalls = n;
    gDetail.add(lineMesh(W, WC, 0.8));
  })();
})();

/* ================= アリーナ外殻の作り込み（L0 SOLID） =================
   平屋根の押し出しだったものに、ドーム状の屋根・屋上設備・屋上サイン・
   上層ガラス帯・パネル目地を追加する。 */
(function arenaRoof() {
  const poly = SCENE_DATA.arena.outer;
  if (!poly || poly.length < 4) return;
  let p = poly.slice();
  if (p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  if (area2(p) < 0) p.reverse();
  let cx = 0, cy = 0; for (const q of p) { cx += q[0]; cy += q[1]; } cx /= p.length; cy /= p.length;
  const scaled = k => p.map(q => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k]);
  const B = new Builder();
  const band = (r0, y0, r1, y1, col) => {
    for (let i = 0; i < p.length; i++) {
      const a = r0[i], b = r0[(i + 1) % p.length], c = r1[(i + 1) % p.length], d = r1[i];
      B.quad([a[0], y0, -a[1]], [b[0], y0, -b[1]], [c[0], y1, -c[1]], [d[0], y1, -d[1]], col);
    }
  };
  const r1 = scaled(0.80), r2 = scaled(0.42);
  band(p, 26.0, r1, 30.5, [0.36, 0.41, 0.50]);
  band(r1, 30.5, r2, 33.5, [0.42, 0.47, 0.56]);
  try {
    const f = THREE.ShapeUtils.triangulateShape(r2.map(q => new THREE.Vector2(q[0], q[1])), []);
    for (const t of f) B.tri([r2[t[0]][0], 33.5, -r2[t[0]][1]], [r2[t[2]][0], 33.5, -r2[t[2]][1]],
                             [r2[t[1]][0], 33.5, -r2[t[1]][1]], [0.44, 0.49, 0.58]);
  } catch (e) { }
  /* 上層ガラス帯（FL+19〜24）: 外壁からわずかに外へ出す */
  const g0 = scaled(1.004);
  const G = new Builder();
  for (let i = 0; i < p.length; i++) {
    const a = g0[i], b = g0[(i + 1) % p.length];
    G.quad([a[0], 19.0, -a[1]], [b[0], 19.0, -b[1]], [b[0], 24.2, -b[1]], [a[0], 24.2, -a[1]], [0.14, 0.30, 0.48]);
  }
  arenaShell.add(new THREE.Mesh(B.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.65, metalness: 0.2 })));
  arenaShell.add(new THREE.Mesh(G.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 })));
  /* パネル目地（水平） */
  const W = [];
  for (const y of [6.5, 13.0]) for (let i = 0; i < p.length; i++) {
    const a = g0[i], b = g0[(i + 1) % p.length]; W.push(a[0], y, -a[1], b[0], y, -b[1]);
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3));
  arenaShell.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.45 })));
  /* 屋上設備（空調機・冷却塔）と点検歩廊 */
  const mech = new THREE.MeshStandardMaterial({ color: 0x6d7683, roughness: 0.8 });
  [[0.15, 0.15, 12, 4, 6], [-0.18, 0.1, 9, 3.2, 5], [0.05, -0.2, 14, 3.4, 5], [-0.12, -0.14, 6, 2.6, 6]].forEach(([kx, ky, w, h, dpt]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), mech);
    m.position.set(cx + kx * 120, 33.5 + h / 2, -(cy + ky * 100)); arenaShell.add(m);
  });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.0, 12), mech);
    t.position.set(cx + 28 + i * 6, 35, -(cy - 22)); arenaShell.add(t);
  }
  /* 屋上サイン "crypto.com ARENA"（広場側=北東を向く） */
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.font = '600 92px Oswald'; c.textAlign = 'center';
  c.fillText('crypto.com', 380, 112);
  c.fillStyle = '#00c2ff'; c.fillRect(612, 30, 6, 100);
  c.fillStyle = '#ffffff'; c.fillText('ARENA', 800, 112);
  const tex = new THREE.CanvasTexture(cv);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(44, 6.9),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex,
      emissiveIntensity: 1.1, color: 0x000000, transparent: true, side: THREE.DoubleSide }));
  const R = -27.3 * Math.PI / 180;                          // 30_entrance.js の ARENA_ROT と同値
  const toW = (lx, lz) => ({ x: ARENA_C.x + lx * Math.cos(R) + lz * Math.sin(R),
                             z: ARENA_C.z - lx * Math.sin(R) + lz * Math.cos(R) });
  const sp = toW(0, -62);
  sign.position.set(sp.x, 30.5, sp.z);
  sign.rotation.y = R + Math.PI;
  sign.userData = { kind: 'poi', name: '屋上サイン', desc: 'Figueroa / I-110 側から視認される屋上ネーミングライツ表示' };
  arenaShell.add(sign);
  for (const sx of [-16, 0, 16]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), mech);
    const pp = toW(sx, -60);
    post.position.set(pp.x, 28, pp.z); arenaShell.add(post);
  }
})();
