
/* ================================================================
   移動経路モデル — 来場OD × 交通手段 × 実道路ネットワーク
   出発地からアリーナのゲートまで A* で実経路を引き、タイムラインに沿って
   人流エージェントを走らせる。退場後は「直帰」と「周辺回遊」に分岐する。
   出発地の構成比は 1to1 レイヤーの商圏分布（AGG.reg）に追従する。
================================================================ */
const plazaToWorld = (lx, lz) => ({
  x: ARENA_C.x + lx * Math.cos(ARENA_ROT) + lz * Math.sin(ARENA_ROT),
  z: ARENA_C.z - lx * Math.sin(ARENA_ROT) + lz * Math.cos(ARENA_ROT),
});
const MODE_COL = { METRO: 0x00a8ff, CAR: 0xfdb927, WALK: 0x3ddc84, RIDESHARE: 0xff5fa2, RAIL: 0x8a5cc4 };

/* 指定方向にある最寄のフリーウェイ点（オフランプ相当）を実データから拾う */
function freewayPoint(dirX, dirZ) {
  let best = null, bs = -Infinity;
  for (const r of SCENE_DATA.roads) {
    if (r.c !== 4 || r.b === -1) continue;
    for (const p of r.p) {
      const x = p[0], z = -p[1];
      const d = Math.hypot(x - ARENA_C.x, z - ARENA_C.z);
      if (d < 260 || d > 2100) continue;
      const s = ((x - ARENA_C.x) * dirX + (z - ARENA_C.z) * dirZ) / d - d / 5200;
      if (s > bs) { bs = s; best = [x, z]; }
    }
  }
  return best;
}
/* 面積上位の駐車場重心 */
function bigParking(n) {
  return SCENE_DATA.parking.map(p => {
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    return { x: (Math.max(...xs) + Math.min(...xs)) / 2, z: -(Math.max(...ys) + Math.min(...ys)) / 2,
             area: w * h, d: 0 };
  }).map(o => (o.d = Math.hypot(o.x - ARENA_C.x, o.z - ARENA_C.z), o))
    .filter(o => o.d < 900)
    .sort((a, b) => b.area - a.area).slice(0, n);
}

setLoad(60, '道路ネットワークの経路を探索中');
const ORIGINS = [];
const flowGroup = new THREE.Group(); site.add(flowGroup);      // 経路ラインのレイヤー
const routeLines = new THREE.Group(); flowGroup.add(routeLines);

(function buildOrigins() {
  const stn = n => (SCENE_DATA.stations.find(s => s.n === n) || { p: [0, 0] }).p;
  const pico = stn('Pico'), seventh = stn('7th Street/Metro Center');
  const parks = bigParking(3);
  const fwN = freewayPoint(0, -1), fwS = freewayPoint(0, 1), fwE = freewayPoint(1, 0);
  const hotel = SCENE_DATA.pois.find(p => p.c === 'hotel');

  const defs = [
    { name: 'Pico 駅 (Metro A/E)', x: pico[0], z: -pico[1], mode: 'METRO', w: 0.14,
      regions: ['DTLA / Central LA', 'South Bay'] },
    { name: '7th St/Metro Center (A/B/D/E)', x: seventh[0], z: -seventh[1], mode: 'METRO', w: 0.09,
      regions: ['Westside', 'San Fernando Valley'] },
    { name: 'I-110 北からのオフランプ', p: fwN, mode: 'CAR', w: 0.16,
      regions: ['San Fernando Valley'] },
    { name: 'I-110 南からのオフランプ', p: fwS, mode: 'CAR', w: 0.15,
      regions: ['South Bay', 'Orange County'] },
    { name: 'I-10 東からのオフランプ', p: fwE, mode: 'CAR', w: 0.11,
      regions: ['Inland Empire'] },
    { name: 'L.A. LIVE 駐車場', x: parks[0] && parks[0].x, z: parks[0] && parks[0].z, mode: 'CAR', w: 0.12,
      regions: ['Orange County'] },
    { name: 'ライドシェア降車ゾーン', x: ARENA_C.x - 150, z: ARENA_C.z + 190, mode: 'RIDESHARE', w: 0.11,
      regions: ['Westside', 'Out of State'] },
    { name: '隣接ホテル徒歩 (JW/Ritz)', x: hotel ? hotel.p[0] : 0, z: hotel ? -hotel.p[1] : 0, mode: 'WALK', w: 0.07,
      regions: ['Out of State', 'International'] },
    { name: 'DTLA 徒歩', x: ARENA_C.x + 420, z: ARENA_C.z - 430, mode: 'WALK', w: 0.05,
      regions: ['DTLA / Central LA'] },
  ];

  /* 到達点: L1 の入場ゲート（ワールド座標） */
  const gateW = GATES.map(g => plazaToWorld(g.x, g.z));
  for (const d of defs) {
    const sx = d.p ? d.p[0] : d.x, sz = d.p ? d.p[1] : d.z;
    if (!isFinite(sx) || !isFinite(sz)) continue;
    const gate = gateW[ORIGINS.length % gateW.length];
    const walking = (d.mode === 'WALK' || d.mode === 'METRO');
    let pth = roadGraph.path(sx, sz, gate.x, gate.z, walking ? 'walk' : 'drive');
    if (!pth || pth.length < 2) pth = [[sx, sz], [gate.x, gate.z]];
    pth.unshift([sx, sz]);
    pth.push([gate.x, gate.z]);
    const col = MODE_COL[d.mode];
    ORIGINS.push({ ...d, x: sx, z: sz, col, route: measure(pth),
                   gateName: GATES[ORIGINS.length % GATES.length].name });
  }

  /* 経路の可視化（進行方向シェブロン付き） */
  for (const o of ORIGINS) {
    const pts = o.route.path.map(p => new THREE.Vector3(p[0], 1.6, p[1]));
    routeLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: o.col, transparent: true, opacity: 0.55 })));
    const step = Math.max(60, o.route.total / 26);
    for (let d = step; d < o.route.total - step; d += step) {
      const a = atDist(o.route, d), b = atDist(o.route, d + 12);
      const m = new THREE.Mesh(new THREE.ConeGeometry(4.5, 11, 3),
        new THREE.MeshBasicMaterial({ color: o.col, transparent: true, opacity: 0.75 }));
      m.position.set(a[0], 3, a[1]);
      m.rotation.set(Math.PI / 2, 0, -Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2);
      routeLines.add(m);
    }
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 3, 12),
      new THREE.MeshStandardMaterial({ color: o.col, emissive: o.col, emissiveIntensity: 0.7 }));
    pin.position.set(o.x, 2, o.z);
    pin.userData = { kind: 'origin', name: o.name,
      desc: '交通手段 <b>' + o.mode + '</b><br>アリーナまで ' + fmt(o.route.total) + ' m<br>' +
            '接続ゲート: ' + o.gateName };
    routeLines.add(pin);
  }
})();

/* ================= 退場後の回遊フロー（直帰 / 周辺回遊） ================= */
const DISPERSAL = [];
(function buildDispersal() {
  const poi = n => SCENE_DATA.pois.find(p => p.n.indexOf(n) === 0);
  const defs = [
    { name: 'Metro で直帰', to: null, share: 0.23, spend: 0, col: 0x00a8ff, mode: 'METRO' },
    { name: '車で直帰（駐車場・フリーウェイ）', to: null, share: 0.38, spend: 0, col: 0xfdb927, mode: 'CAR' },
    { name: 'ライドシェアで直帰', to: null, share: 0.12, spend: 0, col: 0xff5fa2, mode: 'RIDESHARE' },
    { name: 'L.A. LIVE で飲食回遊', to: 'L.A. LIVE', share: 0.13, spend: 46, col: 0x3ddc84, mode: 'WALK' },
    { name: 'Fashion District 方面', to: 'Fashion District', share: 0.05, spend: 38, col: 0x00e0a4, mode: 'WALK' },
    { name: 'Grand Central Market 方面', to: 'Grand Central Market', share: 0.05, spend: 34, col: 0x8a5cc4, mode: 'WALK' },
    { name: 'Little Tokyo 方面', to: 'Little Tokyo', share: 0.04, spend: 52, col: 0xff8a3d, mode: 'WALK' },
  ];
  for (const d of defs) {
    let dest;
    if (d.to) { const p = poi(d.to); dest = p ? [p.p[0], -p.p[1]] : null; }
    if (!dest) {                                    // 直帰は出発地群へ戻す
      const o = ORIGINS.find(o => o.mode === d.mode) || ORIGINS[0];
      dest = [o.x, o.z];
    }
    const gate = plazaToWorld(GATES[0].x, GATES[0].z);
    let pth = roadGraph.path(gate.x, gate.z, dest[0], dest[1], d.mode === 'CAR' ? 'drive' : 'walk');
    if (!pth || pth.length < 2) pth = [[gate.x, gate.z], dest];
    DISPERSAL.push({ ...d, route: measure(pth) });
  }
})();

/* ================= 人流エージェント ================= */
const MAX_AGENTS = 1400;
const agents = [];
const agentMesh = (function () {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(3.2, 6, 5),
    new THREE.MeshBasicMaterial(), MAX_AGENTS);
  primeInstanceColor(m, MAX_AGENTS);
  m.count = 0; m.frustumCulled = false;
  flowGroup.add(m);
  return m;
})();
const flowState = { on: true, arrived: 0, inArena: 0, left: 0, spendTotal: 0, byDisp: {} };
let spawnAcc = 0;

/* 商圏実績（AGG.reg）に追従した出発地シェア */
function originWeights() {
  const total = AGG.kpi && AGG.kpi.sold ? AGG.kpi.sold : 0;
  return ORIGINS.map(o => {
    if (!total || !o.regions) return o.w;
    let s = 0;
    for (const rn of o.regions) s += (AGG.reg[rn] || 0) / total;
    return Math.max(0.01, s / o.regions.length + o.w * 0.4);
  });
}
function pickIdx(ws) {
  let t = 0; for (const w of ws) t += w;
  let x = Math.random() * t;
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; }
  return 0;
}
/* 到着カーブ: 開場17:00 → ピーク19:10 → ティップオフ19:30でほぼ収束 */
function arrivalRate(m) {
  if (m < 17 * 60 || m > 19 * 60 + 45) return 0;
  const u = (m - 17 * 60) / 165;
  return Math.exp(-Math.pow((u - 0.78) / 0.30, 2));
}
function egressRate(m) {
  if (m < 21 * 60 + 50 || m > 22 * 60 + 50) return 0;
  return Math.exp(-Math.pow((m - (22 * 60 + 6)) / 15, 2));
}
/* 正規化CDF（人数カウンタは曲線の積分から出す。エージェントは可視化のサンプル） */
const CDF = (function () {
  const A = [], E = [];
  let sa = 0, se = 0;
  for (let m = T0; m <= T1; m++) { sa += arrivalRate(m); se += egressRate(m); A.push(sa); E.push(se); }
  const ta = sa || 1, te = se || 1;
  return {
    arr: m => A[clamp(Math.round(m - T0), 0, A.length - 1)] / ta,
    dep: m => E[clamp(Math.round(m - T0), 0, E.length - 1)] / te,
  };
})();

/* 1エージェントが代表する人数（表示密度から逆算して掲示する） */
flowState.perAgent = 1;

FRAME_HOOKS.push(function agentTick(dt) {
  if (!flowState.on || level === 'arena') { agentMesh.count = 0; return; }
  const dtMin = timeState.play ? dt * timeState.speed : 0;
  const m = timeState.min;
  const sold = AGG.kpi.sold || 16000;

  /* --- 人数カウンタは到着/退場カーブの積分（エージェント数に依存しない） --- */
  const ap = CDF.arr(m), dp = CDF.dep(m);
  flowState.arrived = Math.round(sold * ap);
  flowState.left = Math.round(sold * dp);
  flowState.inArena = Math.max(0, flowState.arrived - flowState.left);
  flowState.spendTotal = Math.round(
    DISPERSAL.reduce((a, D) => a + sold * D.share * D.spend, 0) * dp);

  /* --- 表示population は瞬間流量に比例させ、不足分だけ補充する --- */
  const aR = arrivalRate(m), eR = egressRate(m);
  const target = Math.round(MAX_AGENTS * clamp(aR * 0.85 + eR * 0.95, 0, 1));
  const ws = originWeights();
  let guard = 0;
  while (agents.length < target && guard++ < 90) {
    const leaving = eR > aR;
    if (leaving) {
      const D = DISPERSAL[pickIdx(DISPERSAL.map(x => x.share))];
      agents.push({ r: D.route, d: Math.random() * D.route.total * 0.2,
        v: (D.mode === 'CAR' ? 300 : 74) * (0.75 + Math.random() * 0.5),
        col: D.col, out: true, jit: Math.random() * 6.28 });
    } else {
      const o = ORIGINS[pickIdx(ws)];
      agents.push({ r: o.route, d: Math.random() * o.route.total * 0.85,
        v: (o.mode === 'CAR' || o.mode === 'RIDESHARE' ? 340 : 78) * (0.75 + Math.random() * 0.5),
        col: o.col, out: false, jit: Math.random() * 6.28 });
    }
  }
  /* 1エージェント = 何人か（瞬間の道路上人数 ÷ 表示体数） */
  const onRoad = Math.max(1, sold * (aR * 0.10 + eR * 0.12));
  flowState.perAgent = Math.max(1, Math.round(onRoad / Math.max(1, agents.length)));

  /* --- 移動（完走したら消さずに再投入して密度を保つ） --- */
  const M = new THREE.Matrix4(), C = new THREE.Color();
  const scale = clamp(cam.dist / 620, 0.5, 3.4);
  const V = new THREE.Vector3(scale, scale, scale);
  let n = 0;
  for (let i = agents.length - 1; i >= 0; i--) {
    const a = agents[i];
    a.d += a.v * dtMin;
    if (a.d >= a.r.total) {
      if (agents.length > target) { agents.splice(i, 1); continue; }
      a.d = 0;                                   // リサイクル
    }
    const p = atDist(a.r, a.d);
    M.makeTranslation(p[0] + Math.sin(a.jit) * 4.5, 3.4, p[1] + Math.cos(a.jit) * 4.5);
    M.scale(V);
    agentMesh.setMatrixAt(n, M);
    agentMesh.setColorAt(n, C.setHex(a.col));
    n++;
  }
  agentMesh.count = n;
  agentMesh.instanceMatrix.needsUpdate = true;
  if (agentMesh.instanceColor) agentMesh.instanceColor.needsUpdate = true;
});

/* タイムラインを戻したときは人流をリセット */
TICK_HOOKS.push(function () {
  if (timeState.min < 17 * 60 && (flowState.arrived || agents.length)) {
    agents.length = 0;
    flowState.arrived = flowState.inArena = flowState.left = flowState.spendTotal = 0;
    flowState.byDisp = {};
  }
});
