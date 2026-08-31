
/* ================================================================
   分析エンジン — KPI / セグメント / 媒体価値 / 価格最適化 / 視認等級
================================================================ */
const AGG = { seg: {}, reg: {}, cat: {}, board: [], price: { cur: 0, opt: 0 },
              kpi: {}, sec: {}, od: [], odMatrix: {}, gate: {} };

function computeKPIs() {
  const N = SEAT.list.length, NB = ledBoards.length;
  const seg = {}, reg = {}, cat = {}, sec = {}, gate = {};
  /* OD集計: 出発地ごとの人数・所要・収益・席ティア/セグメント内訳 */
  const od = ORIGINS.map(o => ({ o, n: 0, min: 0, km: 0, ltv: 0, rev: 0, fb: 0,
                                 tier: {}, seg: {}, reg: {} }));
  const odMatrix = {};
  let sold = 0, rev = 0, ltv = 0, fb = 0, merch = 0, churnSum = 0, optin = 0, expSum = 0;
  const boardViewers = new Float64Array(NB), boardScore = new Float64Array(NB);
  /* 満席時の露出（媒体デリバリー率の分母）— 初回のみ算出してキャッシュ */
  if (!AGG.boardFull) {
    AGG.boardFull = new Float64Array(NB);
    for (let bi = 0; bi < NB; bi++) {
      let t = 0;
      for (let i = 0; i < N; i++) t += SEAT.expB[bi * N + i] / SEAT.maxB[bi];
      AGG.boardFull[bi] = t || 1;
    }
  }
  const gradeCnt = new Uint32Array(NB * 5);

  for (let i = 0; i < N; i++) {
    const s = SEAT.list[i];
    const m = sec[s.sec] || (sec[s.sec] = { n: 0, sold: 0, rev: 0, cat: s.cat, tier: s.tier });
    m.n++;
    cat[s.cat] = (cat[s.cat] || 0) + 1;
    if (!SNAP.sold[i]) continue;
    const f = fanAt(i);
    sold++; m.sold++;
    rev += f.paid; m.rev += f.paid;
    ltv += f.ltv; fb += f.fb; merch += f.merch; churnSum += f.churn; expSum += s.exp;
    if (f.optin) optin++;
    seg[f.seg] = (seg[f.seg] || 0) + 1;
    reg[f.reg.n] = (reg[f.reg.n] || 0) + 1;
    gate[f.gate] = (gate[f.gate] || 0) + 1;
    const M = od[f.oi];
    M.n++; M.min += f.minutes; M.km += f.tripKm;
    M.ltv += f.ltv; M.rev += f.paid; M.fb += f.fb + f.merch;
    M.tier[s.tier] = (M.tier[s.tier] || 0) + 1;
    M.seg[f.seg] = (M.seg[f.seg] || 0) + 1;
    M.reg[f.reg.n] = (M.reg[f.reg.n] || 0) + 1;
    const row = odMatrix[f.reg.n] || (odMatrix[f.reg.n] = {});
    row[f.org.name] = (row[f.org.name] || 0) + 1;
    for (let bi = 0; bi < NB; bi++) {
      const w = SEAT.expB[bi * N + i];
      if (w > 0.02) { boardViewers[bi]++; boardScore[bi] += w / SEAT.maxB[bi]; }
      gradeCnt[bi * 5 + SEAT.grade[bi * N + i]]++;
    }
  }
  AGG.seg = seg; AGG.reg = reg; AGG.cat = cat; AGG.sec = sec; AGG.gate = gate;
  for (const m of od) {
    m.avgMin = m.n ? m.min / m.n : 0;
    m.avgKm = m.n ? m.km / m.n : 0;
    m.avgLtv = m.n ? m.ltv / m.n : 0;
  }
  AGG.od = od; AGG.odMatrix = odMatrix;
  AGG.board = ledBoards.map((b, bi) => {
    const gr = [0, 1, 2, 3, 4].map(k => gradeCnt[bi * 5 + k]);
    const eff = boardScore[bi];
    return { name: b.name, id: b.id, type: b.type, viewers: boardViewers[bi],
             score: eff, contract: b.contract,
             /* 実効露出単価 CPE: 契約額 ÷ 年間実効露出人数（実効露出 × 年44興行）。
                「1人に1試合しっかり見られるために払っている額」= 媒体間で直接比較できる指標 */
             cpe: b.contract / Math.max(1, eff * 44),
             gradeA: gr[4], gradeB: gr[3], gradeC: gr[2], gradeD: gr[1], out: gr[0] };
  });

  /* 価格最適化: f = 0.74 + 0.40×区画販売率 + 0.12×露出 + 0.08×需要弾性(二次流通プレミア) */
  let cur = 0, opt = 0;
  for (let i = 0; i < N; i++) {
    const s = SEAT.list[i];
    const m = sec[s.sec];
    const so = m.sold / m.n;
    const resale = clamp(so * 1.25 - 0.35, 0, 0.6);
    const k = clamp(0.74 + 0.40 * so + 0.12 * s.exp + 0.08 * resale, 0.82, 1.32);
    s.pf = k;
    s.rec = Math.max(10, Math.round(CAT[s.cat].price * k / 5) * 5);
    if (SNAP.sold[i]) { cur += CAT[s.cat].price; opt += s.rec; }
  }
  AGG.price = { cur, opt };

  AGG.kpi = {
    sold, cap: N, occ: sold / N, rev,
    avg: sold ? rev / sold : 0,
    ltv, fb, merch, fbTotal: fb + merch,
    churn: sold ? churnSum / sold : 0,
    optin: sold ? optin / sold : 0,
    exp: sold ? expSum / sold : 0,
    season: ((seg.SEASON || 0) + (seg.PARTIAL || 0)) / Math.max(1, sold),
    outState: ((reg['Out of State'] || 0) + (reg['International'] || 0)) / Math.max(1, sold),
    /* 当該興行の媒体デリバリー額 = Σ (年間契約 ÷ 年44興行) × (今回の実効露出 ÷ 満席時の実効露出)。
       シーズンを通して積むと契約総額に一致する設計 */
    mediaValue: AGG.board.reduce((a, b, i) =>
      a + (b.contract / 44) * (b.score / AGG.boardFull[i]), 0),
  };
}

/* ================= 座席の塗り分け ================= */
let seatMode = 'crowd';      // crowd | cat | occ | seg | ltv | churn | exp | grade | price
let expBoard = -1;           // 露出/視認モードで対象とする看板 index
let odFocus = -1;            // ODモードで絞り込む出発地 index（-1 = 全出発地）
const heatC = v => {
  const stops = [[0, 0x16224a], [0.28, 0x2e7fb8], [0.55, 0x3ddc84], [0.78, 0xfdb927], [1, 0xff5b4d]];
  for (let i = 0; i < stops.length - 1; i++)
    if (v <= stops[i + 1][0]) {
      const k = (v - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return new THREE.Color(stops[i][1]).lerp(new THREE.Color(stops[i + 1][1]), k);
    }
  return new THREE.Color(0xff5b4d);
};
const divC = f => {
  if (f <= 1) return new THREE.Color(0x2e7fb8).lerp(new THREE.Color(0x3d465f), clamp((f - 0.82) / 0.18, 0, 1));
  return new THREE.Color(0x3d465f).lerp(new THREE.Color(0xff5b4d), clamp((f - 1) / 0.32, 0, 1));
};
const GRADE_C = [0x20242f, 0x54607c, 0x4da3ff, 0x3ddc84, 0xfdb927];
const EMPTY_C = new THREE.Color(0x1c2130);

function repaintSeats() {
  if (!SEAT.mesh) return;
  const N = SEAT.list.length;
  const occNow = occAt(timeState.min);
  const C = new THREE.Color();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(),
        E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
  let ci = 0;
  const crowdOn = (seatMode === 'crowd');
  for (let i = 0; i < N; i++) {
    const s = SEAT.list[i];
    const sold = SNAP.sold[i];
    if (!sold && seatMode !== 'cat') C.copy(EMPTY_C);
    else if (seatMode === 'cat') C.setHex(CAT[s.cat].color);
    else if (seatMode === 'occ') C.copy(heatC(SNAP.occ[i]));
    else if (seatMode === 'seg') C.setHex(SEGMENTS[fanAt(i).seg].color);
    else if (seatMode === 'ltv') C.copy(heatC(clamp(fanAt(i).ltv / 90000, 0, 1)));
    else if (seatMode === 'churn') C.copy(heatC(fanAt(i).churn));
    else if (seatMode === 'exp') C.copy(heatC(expBoard < 0 ? s.exp
      : clamp(SEAT.expB[expBoard * N + i] / SEAT.maxB[expBoard], 0, 1)));
    else if (seatMode === 'grade') C.setHex(GRADE_C[SEAT.grade[Math.max(0, expBoard) * N + i]]);
    else if (seatMode === 'od') {
      const f = fanAt(i);
      C.setHex(odFocus < 0 || f.oi === odFocus ? f.org.col : 0x1a2030);
    }
    else if (seatMode === 'segment') {
      C.setHex(SEG_STATE.matched && SEG_STATE.matched[i] ? 0x00e5ff : 0x151b26);
    }
    else if (seatMode === 'price') C.copy(divC(s.pf || 1));
    else C.setHex(0x232a3a);
    SEAT.mesh.setColorAt(i, C);
    if (crowdOn && sold && (i % 101) / 101 < occNow && SEAT.crowd) {
      E.set(0, s.ry, 0); Q.setFromEuler(E); P.set(s.x, s.y - 0.2, s.z);
      M.compose(P, Q, S1);
      SEAT.crowd.setMatrixAt(ci, M);
      const t = hrand(i, 0x77);
      SEAT.crowd.setColorAt(ci, new THREE.Color(t < 0.46 ? 0xa878e0 : t < 0.76 ? 0xffd25e : 0xdfe6f2));
      ci++;
    }
  }
  SEAT.crowd.count = crowdOn ? ci : 0;
  SEAT.mesh.instanceColor.needsUpdate = true;
  SEAT.crowd.instanceMatrix.needsUpdate = true;
  if (SEAT.crowd.instanceColor) SEAT.crowd.instanceColor.needsUpdate = true;
}

/* ---- 席ラベル ---- */
function seatLabel(i) {
  const s = SEAT.list[i];
  const rowName = s.tier === 'FLOOR' ? 'ABCDEFGHJ'[s.row] || String(s.row + 1) : String(s.row + 1);
  return 'Sec ' + s.sec + ' / Row ' + rowName + ' / Seat ' + s.num;
}
/* ---- 席から見た看板 上位n ---- */
function topBoards(i, n) {
  const N = SEAT.list.length;
  return ledBoards.map((b, bi) => ({ b, bi,
      w: SEAT.expB[bi * N + i] / SEAT.maxB[bi], g: SEAT.grade[bi * N + i] }))
    .filter(x => x.w > 0.02).sort((a, b) => b.w - a.w).slice(0, n);
}
