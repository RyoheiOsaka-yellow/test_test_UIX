
/* ================================================================
   座席ボウル生成 — 実容量 19,079席（バスケットボール構成）
   各席は 1レコード = 1顧客接点。区画/列/席番/席種/座標/向き/媒体露出を持つ。
   実 seatmap.csv が入ったらこの生成器を置き換えるだけで実測座標に切り替わる。
================================================================ */
const SEAT = { list: [], mesh: null, crowd: null, expB: null, maxB: null, byCat: {} };
const CAPACITY = { FLOOR: 1168, L100: 8594, PRM: 2430, SUITE: 1476, L300: 5411 };
const CAP_TOTAL = 19079;

setLoad(86, '座席 19,079 を生成中');
(function buildBowl() {
  const S = SEAT.list;
  const push = (x, y, z, ry, sec, row, num, tier, cat) =>
    S.push({ x, y, z, ry, sec, row, num, tier, cat, i: S.length });
  const faceCourt = (x, z) => Math.atan2(-x, -z);       // 常にコート中心を向く

  /* ---------- フロア / コートサイド（矩形配置） ---------- */
  (function floorSeats() {
    let n = 0;
    const rowL = 'ABCDEFGHJ';
    for (let r = 0; r < 7 && n < CAPACITY.FLOOR; r++) {       // サイドライン側
      const z = 9.5 + r * 0.95, len = 32 - r * 0.4;
      const cnt = Math.floor(len / SEAT_PITCH);
      for (let i = 0; i < cnt && n < CAPACITY.FLOOR; i++) {
        const x = -len / 2 + (i + 0.5) * (len / cnt);
        const cat = r < 2 ? 'CS' : 'FLR';
        push(x, 0.42 + r * 0.06, -z, faceCourt(x, -z), 'CS-N', r, i + 1, 'FLOOR', cat);
        push(x, 0.42 + r * 0.06, z, faceCourt(x, z), 'CS-S', r, i + 1, 'FLOOR', cat);
        n += 2;
      }
    }
    for (let r = 0; r < 5 && n < CAPACITY.FLOOR; r++) {       // ベースライン側
      const x = 16.8 + r * 0.95, len = 19;
      const cnt = Math.floor(len / SEAT_PITCH);
      for (let i = 0; i < cnt && n < CAPACITY.FLOOR; i++) {
        const z = -len / 2 + (i + 0.5) * (len / cnt);
        const cat = r < 2 ? 'CS' : 'FLR';
        push(-x, 0.42 + r * 0.06, z, faceCourt(-x, z), 'CS-W', r, i + 1, 'FLOOR', cat);
        push(x, 0.42 + r * 0.06, z, faceCourt(x, z), 'CS-E', r, i + 1, 'FLOOR', cat);
        n += 2;
      }
    }
    SEAT.__floorRowL = rowL;
  })();

  /* ---------- リング型ティア（100 / Premier / 300） ---------- */
  const AISLE = 0.85;                                    // 区画間通路の実効幅(m)
  function ringTier(key, tier, sections, cap) {
    let made = 0;
    const rows = [];
    for (let r = 0; r < tier.rows; r++) {
      const a = tier.a + r * tier.tread, b = tier.b + r * tier.tread;
      const y = tier.y0 + r * tier.rise + 0.42;
      const lut = ringLUT(a, b, 900);
      const per = lut.tot;
      const rowSeats = [];
      for (const sec of sections) {
        const f0 = sec.f0 + AISLE / per / 2, f1 = sec.f1 - AISLE / per / 2;
        const span = (f1 - f0) * per;
        if (span <= SEAT_PITCH) continue;
        const cnt = Math.floor(span / SEAT_PITCH);
        const mid = ringPt(a, b, fracToT(lut, (sec.f0 + sec.f1) / 2));
        const cat = catFor(key, mid[0], mid[1], a, b);
        for (let i = 0; i < cnt; i++) {
          const f = f0 + (i + 0.5) * (f1 - f0) / cnt;
          const p = ringPt(a, b, fracToT(lut, f));
          rowSeats.push({ x: p[0], y, z: p[1], ry: faceCourt(p[0], p[1]),
                          sec: sec.sec, row: r, num: i + 1, tier: key, cat });
        }
      }
      rows.push(rowSeats); made += rowSeats.length;
    }
    /* 目標席数に合わせて最上段から間引く（公式収容 19,079 に一致させる） */
    let over = made - cap;
    for (let r = rows.length - 1; r >= 0 && over > 0; r--) {
      const take = Math.min(over, rows[r].length);
      rows[r].splice(rows[r].length - take, take);
      over -= take;
    }
    for (const row of rows) for (const s of row) push(s.x, s.y, s.z, s.ry, s.sec, s.row, s.num, s.tier, s.cat);
  }
  ringTier('L100', TIER.L100, SECTION_100, CAPACITY.L100);
  ringTier('PRM', TIER.PRM, SECTION_PRM_SEATS, CAPACITY.PRM);
  ringTier('L300', TIER.L300, SECTION_300, CAPACITY.L300);

  /* ---------- Premier Box (PR1-PR18) ---------- */
  (function suiteSeats() {
    const per = CAPACITY.SUITE / SUITE_LAYOUT.length;      // 1ボックスあたり
    const lut = ringLUT(TIER.PRM.a - 0.5, TIER.PRM.b - 0.5, 900);
    let made = 0;
    SUITE_LAYOUT.forEach((s, si) => {
      const target = Math.round(per * (si + 1)) - made;
      const rowsN = 2, cols = Math.ceil(target / rowsN);
      for (let r = 0; r < rowsN; r++) {
        for (let i = 0; i < cols && made < CAPACITY.SUITE; i++) {
          const f = s.f0 + (s.f1 - s.f0) * ((i + 0.5) / cols) * 0.9 + (s.f1 - s.f0) * 0.05;
          const a = TIER.PRM.a - 0.5 + r * 0.95, b = TIER.PRM.b - 0.5 + r * 0.95;
          const p = ringPt(a, b, fracToT(lut, f));
          push(p[0], TIER.PRM.y0 + 0.5 + r * 0.36, p[1], faceCourt(p[0], p[1]),
               s.sec, r, i + 1, 'SUITE', 'SUI');
          made++;
        }
      }
    });
  })();

  /* 総数を 19,079 に厳密一致させる（差分は 300L 最上段で調整） */
  while (SEAT.list.length > CAP_TOTAL) SEAT.list.pop();
  SEAT.list.forEach((s, i) => s.i = i);
  SEAT.byCat = {};
  for (const s of SEAT.list) SEAT.byCat[s.cat] = (SEAT.byCat[s.cat] || 0) + 1;
})();

/* ---- 席マッピング演出用のスイープ順（コート中心からの距離順） ----
   19,079席が1席ずつ個客レコードに紐づいていく様子を見せるために、
   各席へ 0..1 の「掃引位置」を与える。 */
const seatReveal = { on: false, t: 0, dur: 3.6, prog: 1, mode: 'radial',
                     done: false, needReset: false };
(function sweepOrder() {
  const N = SEAT.list.length;
  const key = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = SEAT.list[i];
    key[i] = Math.hypot(s.x, s.z) + s.y * 1.6;      // 近い席から外周・上層へ
  }
  const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => key[a] - key[b]);
  SEAT.rank = new Float32Array(N);
  idx.forEach((v, r) => { SEAT.rank[v] = r / (N - 1); });
})();

/* ================================================================
   スポンサー媒体 露出モデル
   w = 正対度^0.8 × 観客視線一致^0.5 × 距離減衰
   視認等級は文字視角(arcmin) = 文字高 / 視距離 × 3437.75 で判定
================================================================ */
setLoad(90, 'スポンサー露出を計算中');
(function exposure() {
  const N = SEAT.list.length, NB = ledBoards.length;
  SEAT.expB = new Float32Array(N * NB);
  SEAT.maxB = new Float32Array(NB);
  SEAT.grade = new Uint8Array(N * NB);          // 0:圏外 1:D 2:C 3:B 4:A
  for (let bi = 0; bi < NB; bi++) {
    const B = ledBoards[bi];
    let mx = 0;
    for (let i = 0; i < N; i++) {
      const s = SEAT.list[i];
      const dx = s.x - B.x, dy = s.y - (B.y || 1), dz = s.z - B.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const facing = (dx * B.nx + dz * B.nz) / Math.hypot(dx, dz || 1e-6);
      /* 座席の視線方向: mesh は rotation.y = ry でコート中心を向くので
         ローカル +z が (sin ry, cos ry) に写る。これが視線ベクトル。 */
      const vdx = Math.sin(s.ry), vdz = Math.cos(s.ry);
      const view = (-dx * vdx - dz * vdz) / (Math.hypot(dx, dz) || 1);
      let w = 0;
      if (facing > 0.02 && view > -0.15) {
        w = Math.pow(facing, 0.8) * Math.pow(Math.max(0.05, view + 0.15), 0.5)
          / (1 + Math.pow(dist / 22, 1.35));
      }
      SEAT.expB[bi * N + i] = w;
      if (w > mx) mx = w;
      /* 文字視角(arcmin) = 文字高 ÷ 視距離 × 3437.75。文字高は看板高の 55% を想定 */
      const arcmin = (B.h * 0.55) / dist * 3437.75;
      SEAT.grade[bi * N + i] = w <= 0 ? 0
        : (arcmin >= 60 ? 4 : arcmin >= 35 ? 3 : arcmin >= 18 ? 2 : arcmin >= 8 ? 1 : 0);
    }
    SEAT.maxB[bi] = mx || 1;
  }
  /* 席ごとの総合露出スコア（契約額加重・0..1に正規化） */
  let mx = 0;
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (let bi = 0; bi < NB; bi++) v += SEAT.expB[bi * N + i] / SEAT.maxB[bi] * ledBoards[bi].share;
    SEAT.list[i].exp = v; if (v > mx) mx = v;
  }
  for (const s of SEAT.list) s.exp = clamp(s.exp / (mx || 1), 0, 1);
})();

/* ================= 座席 / 観客 インスタンス描画 ================= */
(function meshes() {
  /* 座席（座面 + 背もたれ） */
  const B = new Builder(), c = [1, 1, 1];
  B.quad([-0.21, 0, -0.19], [0.21, 0, -0.19], [0.21, 0, 0.21], [-0.21, 0, 0.21], c);       // 座面
  B.quad([-0.21, 0, 0.19], [0.21, 0, 0.19], [0.21, 0.42, 0.23], [-0.21, 0.42, 0.23], c);   // 背
  const g = B.geom();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 });
  const mesh = new THREE.InstancedMesh(g, mat, SEAT.list.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(),
        E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
  SEAT.list.forEach((s, i) => {
    E.set(0, s.ry, 0); Q.setFromEuler(E); P.set(s.x, s.y, s.z);
    M.compose(P, Q, S1); mesh.setMatrixAt(i, M);
    mesh.setColorAt(i, new THREE.Color(0x2b3346));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  interior.add(mesh); SEAT.mesh = mesh;

  /* 観客（在館率に応じて可変） */
  const C = new Builder();
  C.quad([-0.16, 0.30, -0.1], [0.16, 0.30, -0.1], [0.16, 0.92, -0.02], [-0.16, 0.92, -0.02], c);
  C.quad([-0.10, 0.92, -0.04], [0.10, 0.92, -0.04], [0.10, 1.14, 0.0], [-0.10, 1.14, 0.0], c);
  const cm = new THREE.InstancedMesh(C.geom(),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }), SEAT.list.length);
  cm.frustumCulled = false; primeInstanceColor(cm, SEAT.list.length); cm.count = 0;
  interior.add(cm); SEAT.crowd = cm;
})();
