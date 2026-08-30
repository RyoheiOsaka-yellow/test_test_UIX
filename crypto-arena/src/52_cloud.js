
/* ================================================================
   点群ビュー（L2 内部）— ボウルと構造体を点描で表現
   座席点群は席レイヤー（セグメント/LTV/離反/露出/視認等級…）と同期して
   色が変わるため、実体表示と同じ分析をそのまま点描で見せられる。
================================================================ */
const cloudGroup = new THREE.Group(); cloudGroup.visible = false; interior.add(cloudGroup);
let pcMode = false;

setLoad(92, '場内点群を生成中');
(function buildArenaCloud() {
  /* --- 座席点群（1席=1点。席レイヤーと同期） --- */
  const N = SEAT.list.length;
  const P = new Float32Array(N * 3), C = new Float32Array(N * 3);
  SEAT.list.forEach((s, i) => { P[i * 3] = s.x; P[i * 3 + 1] = s.y + 0.18; P[i * 3 + 2] = s.z; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  SEAT.cloud = new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.34, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95 }));
  SEAT.cloud.frustumCulled = false;
  cloudGroup.add(SEAT.cloud);

  /* --- 構造体点群（段床・コンコース・柱・トラス・媒体面） --- */
  const S = [], SC = [];
  const cStruct = new THREE.Color(0x2f6f9e), cSteel = new THREE.Color(0x7fb6dd),
        cMedia = new THREE.Color(0x00e0ff), cFloor = new THREE.Color(0x9a7a4a);
  const push = (x, y, z, c) => { S.push(x, y, z); SC.push(c.r, c.g, c.b); };

  /* 段床のノージング（各列の踏面先端）を等間隔サンプル */
  for (const key of ['L100', 'PRM', 'L300']) {
    const T = TIER[key];
    for (let r = 0; r <= T.rows; r++) {
      const a = T.a + r * T.tread, b = T.b + r * T.tread, y = T.y0 + r * T.rise;
      const lut = ringLUT(a, b, 600);
      const n = Math.round(lut.tot / 1.1);
      for (let i = 0; i < n; i++) {
        const p = ringPt(a, b, fracToT(lut, i / n));
        push(p[0], y, p[1], cStruct);
      }
    }
  }
  /* コンコース面・外周柱 */
  const backA = TIER.L300.a + TIER.L300.rows * TIER.L300.tread;
  const backB = TIER.L300.b + TIER.L300.rows * TIER.L300.tread;
  for (const [aa, bb, yy] of [[TIER.L100.a + TIER.L100.rows * TIER.L100.tread + 2,
                               TIER.L100.b + TIER.L100.rows * TIER.L100.tread + 2, 12.0],
                              [backA + 2, backB + 2, 28.0]]) {
    for (let k = 0; k < 6; k++) {
      const lut = ringLUT(aa + k * 1.8, bb + k * 1.8, 480);
      const n = Math.round(lut.tot / 1.6);
      for (let i = 0; i < n; i++) {
        const p = ringPt(aa + k * 1.8, bb + k * 1.8, fracToT(lut, i / n));
        push(p[0], yy, p[1], cStruct);
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const p = ringPt(backA + 12, backB + 12, 2 * Math.PI * i / 24);
    for (let y = 0; y < 34; y += 0.9) push(p[0], y, p[1], cSteel);
  }
  /* 屋根トラス（放射 + リング） */
  const aR = backA + 14, bR = backB + 14;
  for (let i = 0; i < 10; i++) {
    const t = 2 * Math.PI * i / 20;
    const o = ringPt(aR, bR, t), o2 = ringPt(aR, bR, t + Math.PI);
    for (let k = 0; k <= 90; k++) {
      const u = k / 90;
      push(lerp(o[0], o2[0], u), 34 + Math.sin(Math.PI * u) * 6.5, lerp(o[1], o2[1], u), cSteel);
    }
  }
  for (const k of [0.42, 0.62, 0.82, 1.0]) {
    const lut = ringLUT(aR * k, bR * k, 400);
    const n = Math.round(lut.tot / 1.6);
    for (let i = 0; i < n; i++) {
      const p = ringPt(aR * k, bR * k, fracToT(lut, i / n));
      push(p[0], 34 + Math.sin(Math.PI * (1 - k) * 0.5) * 6.2, p[1], cSteel);
    }
  }
  /* コートと媒体面 */
  for (let i = 0; i < 4200; i++) {
    const u = hrand(i, 71), v = hrand(i, 137);
    push((u - 0.5) * COURT.w, 0.06, (v - 0.5) * COURT.h, cFloor);
  }
  for (const b of ledBoards) {
    const n = Math.max(12, Math.round(b.w / 0.6));
    const tx = -b.nz, tz = b.nx;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1) - 0.5) * b.w;
      for (let h = 0; h < 3; h++)
        push(b.x + tx * u, (b.y || 1) + (h - 1) * b.h * 0.34, b.z + tz * u, cMedia);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(S, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(SC, 3));
  cloudGroup.add(new THREE.Points(sg, new THREE.PointsMaterial({
    size: 0.30, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.72 })));
  cloudGroup.userData.structPts = S.length / 3;
})();

/* 席レイヤーと同じ配色で点群を塗り替える */
function repaintSeatCloud() {
  if (!SEAT.cloud) return;
  const col = SEAT.cloud.geometry.attributes.color;
  const N = SEAT.list.length;
  const occNow = occAt(timeState.min);
  const DIM = new THREE.Color(0x123048), LIT = new THREE.Color(0x66e0ff);
  const C = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const s = SEAT.list[i];
    if (!SNAP.sold[i] && seatMode !== 'cat') C.setHex(0x14202f);
    else if (seatMode === 'cat') C.setHex(CAT[s.cat].color);
    else if (seatMode === 'occ') C.copy(heatC(SNAP.occ[i]));
    else if (seatMode === 'seg') C.setHex(SEGMENTS[fanAt(i).seg].color);
    else if (seatMode === 'ltv') C.copy(heatC(clamp(fanAt(i).ltv / 90000, 0, 1)));
    else if (seatMode === 'churn') C.copy(heatC(fanAt(i).churn));
    else if (seatMode === 'exp') C.copy(heatC(expBoard < 0 ? s.exp
      : clamp(SEAT.expB[expBoard * N + i] / SEAT.maxB[expBoard], 0, 1)));
    else if (seatMode === 'grade') C.setHex(GRADE_C[SEAT.grade[Math.max(0, expBoard) * N + i]]);
    else if (seatMode === 'price') C.copy(divC(s.pf || 1));
    else C.copy((i % 101) / 101 < occNow ? LIT : DIM);
    col.setXYZ(i, C.r, C.g, C.b);
  }
  col.needsUpdate = true;
}

function setPointCloud(on) {
  pcMode = on;
  cloudGroup.visible = on;
  SEAT.mesh.visible = !on;
  SEAT.crowd.visible = !on;
  bimGroup.visible = !on && SHOW.structure;
  trussGrp.visible = !on && SHOW.truss;
  roofSlab.visible = !on && SHOW.roof;
  interior.children.forEach(o => {
    if (o.userData && (o.userData.kind === 'led' || o.userData.kind === 'suite')) o.visible = !on;
  });
  court.visible = !on; hallFloor.visible = !on; hoops.visible = !on && GAMES[curGame].fmt === 'NBA';
  indoorSolid.visible = !on;
  if (on) repaintSeatCloud();
}
