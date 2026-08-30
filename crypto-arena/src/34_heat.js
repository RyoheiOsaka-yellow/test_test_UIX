
/* ================================================================
   賑わいヒートマップ（通り単位）と OD分析（ガウスKDE + グラデーションアーク）
   ・賑わい: 通常日の街の素の賑わい（POI/ホテル/駅/商業地）に対し、
     試合日はアリーナ発の人流が経路沿いに上乗せされる。差分＝アリーナ寄与。
   ・OD: 出発地/回遊先を正規カーネル N(μ,σ²) の重ね合わせで面表示し、
     タイムライン再生で「出発地の山 → アリーナへ質量移動 → 回遊先へ分散」を見せる。
================================================================ */

/* ---------------- 通り単位 賑わいヒートマップ ---------------- */
const HEAT = { obj: null, meta: [], base: null, game: null, mode: 'game', built: false, stats: {} };
const heatGroup = new THREE.Group(); heatGroup.visible = false; site.add(heatGroup);

(function buildHeat() {
  const pos = [], meta = [];
  for (const r of SCENE_DATA.roads) {
    if (r.c > 3 || r.b === -1) continue;                 // 幹線〜生活道路のみ
    for (let i = 0; i < r.p.length - 1; i++) {
      pos.push(r.p[i][0], 1.1, -r.p[i][1], r.p[i + 1][0], 1.1, -r.p[i + 1][1]);
      meta.push([r.p[i][0], -r.p[i][1], r.c], [r.p[i + 1][0], -r.p[i + 1][1], r.c]);
    }
  }
  HEAT.meta = meta;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(meta.length * 3), 3));
  HEAT.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  heatGroup.add(HEAT.obj);

  /* --- 通常日のベース賑わい: POI / ホテル / 駅 / 商業地 --- */
  const src = [];
  for (const p of SCENE_DATA.pois) {
    const w = { shop: 1.0, ent: 0.9, tour: 0.72, biz: 0.55, hotel: 0.45, rail: 0.85 }[p.c] || 0.4;
    src.push([p.p[0], -p.p[1], w, 260]);
  }
  for (const s of SCENE_DATA.stations) {
    const d = Math.hypot(s.p[0], s.p[1]);
    if (d < 3000) src.push([s.p[0], -s.p[1], 0.7, 200]);
  }
  for (const poly of SCENE_DATA.lu.retail) {
    const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length;
    const cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
    src.push([cx, -cy, 0.22, 150]);
  }
  const n = meta.length;
  HEAT.base = new Float32Array(n);
  HEAT.game = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = meta[i];
    let e = v[2] === 3 ? 0.42 : v[2] === 2 ? 0.18 : v[2] === 1 ? 0.08 : 0.03;
    for (const s of src) {
      const dx = v[0] - s[0], dy = v[1] - s[1];
      e += s[2] * Math.exp(-(dx * dx + dy * dy) / (2 * s[3] * s[3]));
    }
    HEAT.base[i] = e;
  }
  HEAT.built = true;
})();

/* 試合日 = ベース + 来場経路沿いの上乗せ。経路の通過人数で重み付けする */
function computeGameHeat() {
  const n = HEAT.meta.length;
  const att = AGG.kpi.sold || 16000;
  const ws = ORIGINS.map(o => o.w);
  const wsum = ws.reduce((a, b) => a + b, 0);
  /* 経路を 30m 刻みでサンプルし、通過人数を線源として置く */
  const lines = [];
  ORIGINS.forEach((o, i) => {
    const share = ws[i] / wsum, people = att * share;
    for (let d = 0; d < o.route.total; d += 30) {
      const p = atDist(o.route, d);
      lines.push([p[0], p[1], people / 4200, 95]);
    }
  });
  DISPERSAL.forEach(D => {
    const people = att * D.share;
    for (let d = 0; d < D.route.total; d += 30) {
      const p = atDist(D.route, d);
      lines.push([p[0], p[1], people / 5200, 85]);
    }
  });
  /* アリーナ本体の集客そのもの */
  lines.push([ARENA_C.x, ARENA_C.z, att / 2300, 330]);
  let mx = 0;
  for (let i = 0; i < n; i++) {
    const v = HEAT.meta[i];
    let add = 0;
    for (const s of lines) {
      const dx = v[0] - s[0], dy = v[1] - s[1];
      const d2 = dx * dx + dy * dy;
      if (d2 > s[3] * s[3] * 9) continue;
      add += s[2] * Math.exp(-d2 / (2 * s[3] * s[3]));
    }
    HEAT.game[i] = HEAT.base[i] + add;
    if (HEAT.game[i] > mx) mx = HEAT.game[i];
  }
  HEAT.max = mx || 1;
  /* 差分（アリーナ寄与）は自前の最大値で正規化する。
     game の最大はアリーナ直近が支配するため、それで割ると街区側が潰れてしまう。 */
  let dmx = 0, up = 0;
  for (let i = 0; i < n; i++) {
    const d = HEAT.game[i] - HEAT.base[i];
    if (d > dmx) dmx = d;
    up += HEAT.game[i] / Math.max(0.02, HEAT.base[i]);
  }
  HEAT.deltaMax = dmx || 1;
  HEAT.stats = { avgUp: up / n, max: mx, deltaMax: dmx };
  paintHeat();
}
function paintHeat() {
  if (!HEAT.built) return;
  const col = HEAT.obj.geometry.attributes.color;
  const n = HEAT.meta.length;
  let baseMax = 1; for (const v of HEAT.base) if (v > baseMax) baseMax = v;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let v;
    if (HEAT.mode === 'base') v = HEAT.base[i] / baseMax;
    else if (HEAT.mode === 'game') v = HEAT.game[i] / HEAT.max;
    else v = clamp((HEAT.game[i] - HEAT.base[i]) / HEAT.deltaMax, 0, 1);       // アリーナ寄与
    const k = clamp(Math.pow(v, 0.62), 0, 1);
    c.copy(heatC(k));
    /* 寄与ゼロの通りは黒へ落として、加算合成でも「効いていない」ことが読めるようにする */
    const f = HEAT.mode === 'delta' ? clamp(k * 2.6, 0, 1) : clamp(0.30 + k * 0.9, 0, 1);
    col.setXYZ(i, c.r * f, c.g * f, c.b * f);
  }
  col.needsUpdate = true;
}

/* ---------------- OD分析: ガウスKDE サーフェス + アーク ---------------- */
const odGroup = new THREE.Group(); odGroup.visible = false; site.add(odGroup);
const KDE = { N: 128, span: 4400, mesh: null, bw: 1.0, mode: 'auto' };

(function buildKDE() {
  const N = KDE.N, S = KDE.span;
  const g = new THREE.PlaneGeometry(S, S, N - 1, N - 1);
  g.rotateX(-Math.PI / 2);
  g.translate(ARENA_C.x, 0, ARENA_C.z);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(N * N * 3), 3));
  KDE.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  odGroup.add(KDE.mesh);
})();

/* 時刻に応じて「出発地 → アリーナ → 回遊先」へ質量を移す */
function kdeSources(m) {
  const att = AGG.kpi.sold || 16000;
  const arr = clamp(smooth(17 * 60, 19 * 60 + 20, m), 0, 1);          // 到着の進捗
  const dep = clamp(smooth(21 * 60 + 55, 22 * 60 + 45, m), 0, 1);     // 退場の進捗
  const src = [];
  const ws = ORIGINS.map(o => o.w), wsum = ws.reduce((a, b) => a + b, 0);
  const showArr = KDE.mode === 'arr' || KDE.mode === 'both' ||
                  (KDE.mode === 'auto' && m < 21 * 60 + 55);
  const showDep = KDE.mode === 'dep' || KDE.mode === 'both' ||
                  (KDE.mode === 'auto' && m >= 21 * 60 + 55);
  if (showArr) ORIGINS.forEach((o, i) => {
    const p = att * ws[i] / wsum * (KDE.mode === 'auto' ? (1 - arr) : 1);
    if (p > 1) src.push([o.x, o.z, p, 165 * KDE.bw]);
  });
  if (showDep) DISPERSAL.forEach(D => {
    const end = atDist(D.route, D.route.total);
    const p = att * D.share * (KDE.mode === 'auto' ? dep : 1);
    if (p > 1) src.push([end[0], end[1], p, 175 * KDE.bw]);
  });
  const inArena = att * (KDE.mode === 'auto' ? arr * (1 - dep) : 0.5);
  if (inArena > 1) src.push([ARENA_C.x, ARENA_C.z, inArena, 195 * KDE.bw]);
  return src;
}
function updateKDE() {
  if (!odGroup.visible) return;
  const N = KDE.N, S = KDE.span, half = S / 2;
  const pos = KDE.mesh.geometry.attributes.position;
  const col = KDE.mesh.geometry.attributes.color;
  const src = kdeSources(timeState.min);
  const c = new THREE.Color();
  let mx = 0;
  const vals = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ARENA_C.x - half + S * i / (N - 1);
    const z = ARENA_C.z - half + S * j / (N - 1);
    let v = 0;
    for (const s of src) {
      const dx = x - s[0], dz = z - s[1], sg = s[3];
      const d2 = dx * dx + dz * dz;
      if (d2 > sg * sg * 9) continue;
      v += s[2] * Math.exp(-d2 / (2 * sg * sg));
    }
    const k = j * N + i; vals[k] = v; if (v > mx) mx = v;
  }
  mx = mx || 1;
  for (let k = 0; k < N * N; k++) {
    const u = vals[k] / mx;
    pos.setY(k, Math.pow(u, 0.75) * 230);
    c.copy(heatC(clamp(Math.pow(u, 0.6), 0, 1)));
    col.setXYZ(k, c.r * u * 1.4, c.g * u * 1.4, c.b * u * 1.4);
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  KDE.mesh.geometry.computeVertexNormals();
}

/* --- ODアーク（帯・進行方向へ流れる） --- */
const arcs = [];
(function buildArcs() {
  const mk = (from, to, share, colA, colB, up) => {
    const SEG = 46, W = clamp(share * 130, 3, 26);
    const P = [], C = [], UV = [];
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const h = clamp(len * 0.30, 40, 320) * (up ? 1 : 0.8);
    const pt = t => {
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c2 = t * t;
      return [a * from[0] + b * mid[0] + c2 * to[0],
              b * h + Math.sin(Math.PI * t) * h * 0.35,
              a * from[1] + b * mid[1] + c2 * to[1]];
    };
    const ca = new THREE.Color(colA), cb = new THREE.Color(colB), cc = new THREE.Color();
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG, t1 = (i + 1) / SEG;
      const p0 = pt(t0), p1 = pt(t1);
      const dx = p1[0] - p0[0], dz = p1[2] - p0[2];
      const L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * W / 2, nz = dx / L * W / 2;
      const A = [p0[0] + nx, p0[1], p0[2] + nz], B = [p0[0] - nx, p0[1], p0[2] - nz];
      const Cq = [p1[0] - nx, p1[1], p1[2] - nz], D = [p1[0] + nx, p1[1], p1[2] + nz];
      P.push(...A, ...B, ...Cq, ...A, ...Cq, ...D);
      for (const [t, k] of [[t0, 0], [t0, 1], [t1, 2], [t0, 3], [t1, 4], [t1, 5]]) {
        cc.copy(ca).lerp(cb, t);
        C.push(cc.r, cc.g, cc.b);
      }
      UV.push(t0, 0, t0, 1, t1, 1, t0, 0, t1, 1, t1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
      opacity: 0.62, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(g, mat);
    odGroup.add(m);
    arcs.push({ mesh: m, up });
  };
  for (const o of ORIGINS) mk([o.x, o.z], [ARENA_C.x, ARENA_C.z], o.w, o.col, 0x00c2ff, true);
  for (const D of DISPERSAL) {
    const e = atDist(D.route, D.route.total);
    mk([ARENA_C.x, ARENA_C.z], [e[0], e[1]], D.share, 0x00c2ff, D.col, false);
  }
})();

let odAcc = 0;
FRAME_HOOKS.push(function (dt) {
  if (!odGroup.visible) return;
  odAcc += dt;
  if (odAcc > 0.22) { odAcc = 0; updateKDE(); }
  const m = timeState.min;
  const arr = clamp(smooth(17 * 60, 19 * 60 + 20, m), 0, 1);
  const dep = clamp(smooth(21 * 60 + 55, 22 * 60 + 45, m), 0, 1);
  for (const a of arcs) {
    const on = KDE.mode === 'both' ? 1
      : KDE.mode === 'arr' ? (a.up ? 1 : 0)
      : KDE.mode === 'dep' ? (a.up ? 0 : 1)
      : (a.up ? 1 - arr * 0.75 : dep);
    a.mesh.visible = on > 0.04;
    a.mesh.material.opacity = 0.22 + on * 0.5;
  }
});
