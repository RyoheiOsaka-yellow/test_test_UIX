
/* ================================================================
   場内動線（L2）— コンコース回遊 → ボミトリー → 着席
   ゲート入場 → コンコース環状動線を歩行 → 売店に立ち寄り → 担当ボミトリーから
   ブロックへ降下、というシーケンスを実寸のリング上で再現する。
   混雑度はコンコースを72分割したビンの滞留人数で色分けする。
================================================================ */
const indoorGroup = new THREE.Group(); interior.add(indoorGroup);
/* 実体（売店・昇降設備）は点群ビューで伏せられるよう別グループに分ける */
const indoorSolid = new THREE.Group(); indoorGroup.add(indoorSolid);
const CONC = [
  { key: 'L100', a: TIER.L100.a + TIER.L100.rows * TIER.L100.tread + 6.5,
    b: TIER.L100.b + TIER.L100.rows * TIER.L100.tread + 6.5, y: 12.4, tier: 'L100' },
  { key: 'L300', a: TIER.L300.a + TIER.L300.rows * TIER.L300.tread + 6.0,
    b: TIER.L300.b + TIER.L300.rows * TIER.L300.tread + 6.0, y: 28.4, tier: 'L300' },
];
CONC.forEach(c => { c.lut = ringLUT(c.a, c.b, 720); });
const cPt = (c, f) => ringPt(c.a, c.b, fracToT(c.lut, f));

/* ---- 売店（F&B / グッズ）= POS地点。BIM部材としても属性を持つ ---- */
const STANDS = [];
setLoad(93, '売店・コンコース動線を生成中');
(function stands() {
  const NAMES_FB = ['Bibigo Kitchen', 'Shake Shack', 'Cauldron Ice Cream', 'Tacos 1850',
                    'Modelo Cantina', 'Chick-fil-A', 'Pink\'s Hot Dogs', 'Blaze Pizza',
                    'Coors Light Bar', 'Sushi Roku'];
  const NAMES_MR = ['Team Store', 'Lakers Locker Room', 'Kings Fan Shop', 'Hat Bar'];
  let n = 0;
  CONC.forEach((c, ci) => {
    const count = ci === 0 ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const f = (i + 0.35) / count;
      const p = cPt(c, f);
      const isMerch = (i % 5 === 4);
      const name = isMerch ? NAMES_MR[n % NAMES_MR.length] : NAMES_FB[n % NAMES_FB.length];
      const w = isMerch ? 7 : 9;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, 3.0, 3.4),
        new THREE.MeshStandardMaterial({ color: isMerch ? 0x3a2550 : 0x1e2836, roughness: 0.82 }));
      const ang = Math.atan2(p[0], p[1]);
      box.position.set(p[0] * 1.055, c.y + 1.5, p[1] * 1.055);
      box.rotation.y = ang + Math.PI / 2;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.2),
        new THREE.MeshStandardMaterial({ color: isMerch ? 0xfdb927 : 0x00c2ff,
          emissive: isMerch ? 0x6a4c00 : 0x00485f, emissiveIntensity: 1.0 }));
      sign.position.copy(box.position); sign.position.y = c.y + 3.2;
      sign.rotation.y = box.rotation.y;
      const st = { id: (isMerch ? 'MR-' : 'FB-') + c.key.slice(1) + String(i + 1).padStart(2, '0'),
                   name, type: isMerch ? 'MERCH' : 'FB', c: ci, f, x: p[0], z: p[1], y: c.y,
                   lanes: isMerch ? 3 : 5, queue: 0, served: 0, revenue: 0 };
      box.userData = { kind: 'stand', st,
        name: st.name + '（' + st.id + '）',
        desc: '種別 ' + st.type + ' / レジ ' + st.lanes + '通り<br>' +
              CONC[ci].key + ' コンコース<br><b>POSログが fan_id に紐づく地点</b>' };
      indoorSolid.add(box, sign);
      STANDS.push(st); n++;
    }
  });
})();

/* ---- エスカレーター / エレベーター / 階段（レベル間動線・BIM部材） ---- */
(function verticalCirculation() {
  const esc = [], mat = new THREE.MeshStandardMaterial({ color: 0x39445c, metalness: 0.55, roughness: 0.42 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a4a6e, transparent: true,
    opacity: 0.32, side: THREE.DoubleSide });
  const c0 = CONC[0], c1 = CONC[1];
  for (let i = 0; i < 6; i++) {
    const f = (i + 0.5) / 6;
    const p0 = cPt(c0, f), p1 = cPt(c1, f);
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const run = Math.hypot(dx, dz) + 14, rise = c1.y - c0.y;
    const len = Math.hypot(run, rise);
    const g = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, len), mat);
    const mx = (p0[0] * 1.10 + p1[0] * 1.02) / 2, mz = (p0[1] * 1.10 + p1[1] * 1.02) / 2;
    g.position.set(mx, (c0.y + c1.y) / 2 + 0.6, mz);
    g.rotation.y = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    g.rotateX(-Math.atan2(rise, run));
    g.userData = { kind: 'bim', type: 'IfcTransportElement', tag: 'ESC-' + (i + 1),
      attrs: { '部材種別': 'エスカレーター（公共交通仕様 1200形）',
               '揚程': (c1.y - c0.y).toFixed(1) + ' m',
               '定格速度': '0.5 m/s', '公称輸送能力': '6,750 人/時',
               '接続': '100 Level コンコース ⇄ 300 Level コンコース' } };
    indoorSolid.add(g); BIM_ELEMS.push(g);
    /* 併設エレベーター（バリアフリー動線） */
    if (i % 3 === 0) {
      const el2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, c1.y - c0.y + 3.2, 3.2), glass);
      el2.position.set(p0[0] * 1.16, (c0.y + c1.y) / 2 + 1.2, p0[1] * 1.16);
      el2.userData = { kind: 'bim', type: 'IfcTransportElement', tag: 'ELV-' + (i / 3 + 1),
        attrs: { '部材種別': '乗用エレベーター（車椅子仕様・展望型）',
                 '積載': '1,150 kg / 17人', '速度': '90 m/min',
                 'サービス階': 'Floor / 100L / Premier / 300L',
                 '準拠': 'ADA 2010 Standards §407' } };
      indoorSolid.add(el2); BIM_ELEMS.push(el2);
    }
  }
})();

/* ---- コンコース混雑ヒート（72ビン） ---- */
const CBIN = 72;
const congestion = { L100: new Float32Array(CBIN), L300: new Float32Array(CBIN), band: [] };
(function bands() {
  CONC.forEach((c, ci) => {
    const P = [], C = [];
    for (let i = 0; i < CBIN; i++) {
      const f0 = i / CBIN, f1 = (i + 1) / CBIN;
      const i0 = ringPt(c.a - 3.2, c.b - 3.2, fracToT(c.lut, f0));
      const i1 = ringPt(c.a - 3.2, c.b - 3.2, fracToT(c.lut, f1));
      const o0 = ringPt(c.a + 3.2, c.b + 3.2, fracToT(c.lut, f0));
      const o1 = ringPt(c.a + 3.2, c.b + 3.2, fracToT(c.lut, f1));
      const y = c.y + 0.06;
      P.push(i0[0], y, i0[1], i1[0], y, i1[1], o1[0], y, o1[1],
             i0[0], y, i0[1], o1[0], y, o1[1], o0[0], y, o0[1]);
      for (let k = 0; k < 6; k++) C.push(0, 0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true,
      transparent: true, opacity: 0.75, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false;
    indoorGroup.add(m);
    congestion.band.push(m);
  });
})();

/* ---- 場内エージェント ---- */
const MAX_IN = 1100;
const inAgents = [];
const inMesh = (function () {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 6, 5),
    new THREE.MeshBasicMaterial(), MAX_IN);
  primeInstanceColor(m, MAX_IN);
  m.count = 0; m.frustumCulled = false; indoorGroup.add(m);
  return m;
})();
const indoorState = { on: true, showCong: false, seated: 0, posRev: 0, perAgent: 1 };

/* 席 → 担当ボミトリーの周長比 */
function seatFrac(s) {
  const t = Math.atan2(s.z, s.x);
  const c = s.tier === 'L300' ? CONC[1] : CONC[0];
  /* 角度 → 周長比は等分近似で十分（表示用） */
  let f = t / (2 * Math.PI); if (f < 0) f += 1;
  return f;
}
function spawnIndoor(out) {
  const N = SEAT.list.length;
  let i = -1;
  for (let g = 0; g < 60; g++) {
    const k = (Math.random() * N) | 0;
    const t = SEAT.list[k].tier;
    if (SNAP.sold[k] && t !== 'FLOOR' && t !== 'SUITE') { i = k; break; }
  }
  if (i < 0) return null;
  const s = SEAT.list[i];
  const ci = s.tier === 'L300' ? 1 : 0;
  const target = seatFrac(s);
  const entry = (Math.floor(Math.random() * 5) + 0.5) / 5;      // 5ゲートに対応する進入点
  let d = target - entry;                                       // 環状の近い回り方向
  if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
  const span = Math.abs(d) || 0.02;
  /* 42%が売店に立ち寄る。立ち寄り位置は動線上の進捗で持つ */
  const pool = STANDS.filter(t => t.c === ci);
  const stand = (Math.random() < 0.42 && pool.length)
    ? pool[Math.floor(Math.random() * pool.length)] : null;
  return { ci, from: out ? target : entry, dir: out ? -(Math.sign(d) || 1) : (Math.sign(d) || 1),
    f: out ? target : entry, span, prog: 0, phase: out ? 1 : 0, s, seat: i,
    stand, standAt: stand ? 0.25 + Math.random() * 0.5 : -1, stopped: false,
    wait: 0, out: !!out, col: out ? 0xff8a3d : (stand ? 0x00e0a4 : 0x00c2ff) };
}

FRAME_HOOKS.push(function indoorTick(dt) {
  if (level !== 'arena' || !indoorState.on) { inMesh.count = 0; return; }
  const dtMin = timeState.play ? dt * timeState.speed : dt * 0.6;
  const m = timeState.min;
  const arr = arrivalRate(m), eg = egressRate(m);

  /* 表示population は瞬間流量に比例（屋外と同じ考え方）。不足分を補充する */
  const target = Math.round(MAX_IN * clamp(arr * 0.9 + eg * 1.0, 0, 1));
  let guard = 0;
  while (inAgents.length < target && guard++ < 70) {
    const a = spawnIndoor(eg > arr);
    if (!a) break;
    a.prog = Math.random() * a.span * 0.7;                      // 初期分散
    inAgents.push(a);
  }
  const scaleP = (AGG.kpi.sold || 16000) * (arr * 0.12 + eg * 0.16);
  indoorState.perAgent = Math.max(1, Math.round(scaleP / Math.max(1, inAgents.length)));

  const M = new THREE.Matrix4(), C = new THREE.Color();
  congestion.L100.fill(0); congestion.L300.fill(0);
  let n = 0;
  for (let i = inAgents.length - 1; i >= 0; i--) {
    const a = inAgents[i], c = CONC[a.ci];
    if (a.wait > 0) { a.wait -= dtMin; }
    else if (a.phase === 0) {
      a.prog += (75 * dtMin) / c.lut.tot;                       // 歩行 75 m/分
      if (!a.stopped && a.stand && a.prog >= a.span * a.standAt) {
        a.stopped = true;
        a.wait = 2.2 + Math.random() * 3.2;                     // 売店滞留（分）
        a.stand.served++;
        const rev = a.stand.type === 'MERCH' ? 48 : 22;
        a.stand.revenue += rev; indoorState.posRev += rev;
      }
      a.f = ((a.from + a.dir * a.prog) % 1 + 1) % 1;
      if (a.prog >= a.span) { a.phase = 1; a.prog = 0; }
    } else {
      a.prog += dtMin * (a.out ? 0.7 : 0.9);
      if (a.prog >= 1) {
        if (!a.out) indoorState.seated++;
        if (inAgents.length > target) { inAgents.splice(i, 1); continue; }
        const nx = spawnIndoor(eg > arr);                        // リサイクル
        if (nx) inAgents[i] = nx; else { inAgents.splice(i, 1); }
        continue;
      }
    }
    let x, y, z;
    const p = ringPt(c.a, c.b, fracToT(c.lut, a.f));
    if (a.phase === 0) {
      const j = ((i % 7) - 3) * 0.006;
      x = p[0] * (1 + j); y = c.y + 0.9; z = p[1] * (1 + j);
      const bin = Math.floor(a.f * CBIN) % CBIN;
      (a.ci === 0 ? congestion.L100 : congestion.L300)[bin] += 1;
    } else {
      const u = a.out ? 1 - a.prog : a.prog;
      x = lerp(p[0], a.s.x, u); z = lerp(p[1], a.s.z, u);
      y = lerp(c.y + 0.9, a.s.y + 0.85, u);
    }
    M.makeTranslation(x, y, z);
    inMesh.setMatrixAt(n, M);
    inMesh.setColorAt(n, C.setHex(a.wait > 0 ? 0xfdb927 : a.col));
    n++;
  }
  inMesh.count = n;
  inMesh.instanceMatrix.needsUpdate = true;
  if (inMesh.instanceColor) inMesh.instanceColor.needsUpdate = true;
  if (indoorState.showCong) paintCongestion();
});

function paintCongestion() {
  CONC.forEach((c, ci) => {
    const band = congestion.band[ci];
    const bins = ci === 0 ? congestion.L100 : congestion.L300;
    const col = band.geometry.attributes.color;
    const C = new THREE.Color();
    /* 1エージェント ≒ 実人数 sold/表示数 のスケールで密度[人/m²]に換算 */
    const scale = (AGG.kpi.sold || 16000) / Math.max(60, inMesh.count);
    for (let i = 0; i < CBIN; i++) {
      const area = (c.lut.tot / CBIN) * 6.4;
      const dens = bins[i] * scale / area;
      C.copy(heatC(clamp(dens / 1.8, 0, 1)));               // LOS E 相当 1.8人/m² で上限
      for (let k = 0; k < 6; k++) col.setXYZ(i * 6 + k, C.r, C.g, C.b);
    }
    col.needsUpdate = true;
  });
}
function setCongestion(on) {
  indoorState.showCong = on;
  congestion.band.forEach(b => b.visible = on);
}
