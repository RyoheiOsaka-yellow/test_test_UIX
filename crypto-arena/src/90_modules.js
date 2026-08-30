
/* ================================================================
   モジュール: 2D席図 / 分析ボード / 個客ジャーニー再生
================================================================ */

/* ================= 2D 席図（3Dと双方向連動） ================= */
const m2 = document.getElementById('m2'), m2cv = document.getElementById('m2-cv');
let m2ctx = null, m2geo = null;
const M2_MODES = [['seg', 'セグメント'], ['ltv', 'LTV'], ['churn', '離反リスク'],
                  ['occ', '販売率'], ['cat', '席種'], ['exp', '露出'], ['grade', '視認等級']];

function open2D() {
  m2.style.display = 'flex';
  const box = m2cv.getBoundingClientRect();
  m2cv.width = Math.round(box.width * devicePixelRatio);
  m2cv.height = Math.round(box.height * devicePixelRatio);
  m2ctx = m2cv.getContext('2d');
  document.getElementById('m2-modes').innerHTML = M2_MODES.map(m =>
    '<button class="chip sm' + (seatMode === m[0] ? ' active' : '') + '" data-m2="' + m[0] + '">' +
    m[1] + '</button>').join('');
  document.getElementById('m2-modes').querySelectorAll('[data-m2]').forEach(b => b.onclick = () => {
    seatMode = b.dataset.m2; repaintSeats(); open2D(); renderPanel();
  });
  draw2D();
}
document.getElementById('m2-x').onclick = () => m2.style.display = 'none';
m2.onclick = e => { if (e.target === m2) m2.style.display = 'none'; };

function seatColor2D(i) {
  const s = SEAT.list[i];
  if (!SNAP.sold[i] && seatMode !== 'cat') return '#1c2130';
  if (seatMode === 'cat') return hex(CAT[s.cat].color);
  if (seatMode === 'occ') return '#' + heatC(SNAP.occ[i]).getHexString();
  if (seatMode === 'seg') return hex(SEGMENTS[fanAt(i).seg].color);
  if (seatMode === 'ltv') return '#' + heatC(clamp(fanAt(i).ltv / 90000, 0, 1)).getHexString();
  if (seatMode === 'churn') return '#' + heatC(fanAt(i).churn).getHexString();
  if (seatMode === 'exp') return '#' + heatC(expBoard < 0 ? s.exp
    : clamp(SEAT.expB[expBoard * SEAT.list.length + i] / SEAT.maxB[expBoard], 0, 1)).getHexString();
  if (seatMode === 'grade') return hex(GRADE_C[SEAT.grade[Math.max(0, expBoard) * SEAT.list.length + i]]);
  return '#3a465e';
}

function draw2D() {
  if (!m2ctx || m2.style.display === 'none') return;
  const W = m2cv.width, H = m2cv.height, c = m2ctx;
  c.fillStyle = '#0b0f19'; c.fillRect(0, 0, W, H);
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (const s of SEAT.list) {
    if (s.x < mnx) mnx = s.x; if (s.x > mxx) mxx = s.x;
    if (s.z < mnz) mnz = s.z; if (s.z > mxz) mxz = s.z;
  }
  const pad = 34 * devicePixelRatio;
  const k = Math.min((W - pad * 2) / (mxx - mnx), (H - pad * 2) / (mxz - mnz));
  const ox = W / 2 - (mnx + mxx) / 2 * k, oz = H / 2 - (mnz + mxz) / 2 * k;
  m2geo = { k, ox, oz };
  const X = x => x * k + ox, Z = z => z * k + oz;

  /* コート */
  c.fillStyle = '#c8a06a';
  c.fillRect(X(-COURT.w / 2), Z(-COURT.h / 2), COURT.w * k, COURT.h * k);
  c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.4 * devicePixelRatio;
  c.strokeRect(X(-COURT.w / 2), Z(-COURT.h / 2), COURT.w * k, COURT.h * k);
  c.beginPath(); c.moveTo(X(0), Z(-COURT.h / 2)); c.lineTo(X(0), Z(COURT.h / 2)); c.stroke();
  c.fillStyle = '#552583'; c.font = '600 ' + (11 * devicePixelRatio) + 'px Oswald';
  c.textAlign = 'center'; c.fillText('LAKERS', X(0), Z(0) + 4 * devicePixelRatio);

  /* 座席 */
  const r = Math.max(1.1, 0.42 * k);
  for (let i = 0; i < SEAT.list.length; i++) {
    const s = SEAT.list[i];
    c.fillStyle = seatColor2D(i);
    c.fillRect(X(s.x) - r / 2, Z(s.z) - r / 2, r, r);
  }
  /* 区画ラベル */
  const cen = {};
  for (const s of SEAT.list) {
    const m = cen[s.sec] || (cen[s.sec] = { x: 0, z: 0, n: 0, tier: s.tier });
    m.x += s.x; m.z += s.z; m.n++;
  }
  c.font = '600 ' + (9.5 * devicePixelRatio) + 'px Oswald';
  for (const sec in cen) {
    const m = cen[sec];
    if (m.tier === 'SUITE' && m.n < 40) continue;
    c.fillStyle = 'rgba(233,237,246,.82)';
    c.fillText(sec, X(m.x / m.n), Z(m.z / m.n) + 3 * devicePixelRatio);
  }
  /* 選択席 */
  if (selSeat >= 0) {
    const s = SEAT.list[selSeat];
    c.strokeStyle = '#00c2ff'; c.lineWidth = 2 * devicePixelRatio;
    c.beginPath(); c.arc(X(s.x), Z(s.z), 7 * devicePixelRatio, 0, 7); c.stroke();
  }
  const k2 = AGG.kpi;
  document.getElementById('m2-ft').innerHTML =
    '<b style="color:var(--acc)">' + fmt(SEAT.list.length) + '席</b>　販売 ' + fmt(k2.sold) +
    '（' + (k2.occ * 100).toFixed(1) + '%）　平均単価 ' + usd(k2.avg) +
    '　<span style="color:var(--sub)">クリックで個客プロファイル / 3D側と同期</span>';
}
m2cv.addEventListener('click', e => {
  if (!m2geo) return;
  const r = m2cv.getBoundingClientRect();
  const px = (e.clientX - r.left) * devicePixelRatio, pz = (e.clientY - r.top) * devicePixelRatio;
  let best = -1, bd = 1e9;
  for (let i = 0; i < SEAT.list.length; i++) {
    const s = SEAT.list[i];
    const d = Math.hypot(s.x * m2geo.k + m2geo.ox - px, s.z * m2geo.k + m2geo.oz - pz);
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0 && bd < 22 * devicePixelRatio) { showFanCard(best); draw2D(); }
});

/* ================= 分析ボード ================= */
const board = document.getElementById('board');
document.getElementById('board-x').onclick = () => board.style.display = 'none';
board.onclick = e => { if (e.target === board) board.style.display = 'none'; };
const BOARD_TABS = [['media', '媒体・スポンサー'], ['seg', 'セグメント'],
                    ['price', '価格'], ['churn', 'リテンション']];
let boardTab = 'media';

function openBoard(tab) {
  boardTab = tab || boardTab;
  board.style.display = 'flex';
  document.getElementById('board-hd').querySelector('.t').textContent = '📊 分析ボード — ' + GAMES[curGame].name;
  document.getElementById('board-tabs').innerHTML = BOARD_TABS.map(t =>
    '<button class="chip sm' + (boardTab === t[0] ? ' active' : '') + '" data-bt="' + t[0] + '">' +
    t[1] + '</button>').join('');
  document.getElementById('board-tabs').querySelectorAll('[data-bt]').forEach(b =>
    b.onclick = () => openBoard(b.dataset.bt));
  const body = document.getElementById('board-body');
  body.innerHTML = boardTab === 'media' ? boardMedia()
    : boardTab === 'seg' ? boardSeg()
    : boardTab === 'price' ? boardPrice() : boardChurn();
  body.querySelectorAll('canvas[data-chart]').forEach(cv => drawChart(cv));
}

function tbl(head, rows) {
  return '<table class="dt"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map((v, i) =>
      '<td' + (i ? ' class="n"' : '') + '>' + v + '</td>').join('') + '</tr>').join('') + '</table>';
}
function boardMedia() {
  const B = AGG.board.slice().sort((a, b) => b.score - a.score);
  const tot = B.reduce((a, b) => a + b.contract, 0);
  return '<div class="bcard wide"><h4>媒体別 実効露出と単価妥当性</h4>' +
    tbl(['媒体', '種別', '視認席数', '実効露出', '年間契約', '実効露出単価', 'A等級席'],
      B.map(b => [b.name, b.type, fmt(b.viewers), b.score.toFixed(0), usd(b.contract),
                  '$' + b.cpe.toFixed(2), fmt(b.gradeA)])) +
    '<div class="hint" style="margin-top:9px">実効露出 = Σ(座席×媒体の露出重み)。' +
    '<b>実効露出単価 = 年間契約額 ÷ (実効露出 × 年44興行)</b>＝「1人に1試合しっかり見られるために払っている額」。' +
    '単価が突出して高い媒体は価格是正、低い媒体は値上げ余地。契約額はダミー — ' +
    'sponsor_inventory.csv 投入で実額に置換されます。</div></div>' +
    '<div class="bcard"><h4>媒体タイプ別 契約額構成（総額 ' + usd(tot) + '）</h4>' +
    '<canvas data-chart="mediaBar" height="200"></canvas></div>' +
    '<div class="bcard"><h4>視認等級の分布（全媒体合計）</h4>' +
    '<canvas data-chart="gradePie" height="200"></canvas></div>';
}
function boardSeg() {
  const k = AGG.kpi;
  const rows = Object.keys(SEGMENTS).map(s => {
    const n = AGG.seg[s] || 0;
    return [SEGMENTS[s].name, fmt(n), (n / Math.max(1, k.sold) * 100).toFixed(1) + '%'];
  });
  return '<div class="bcard"><h4>セグメント別 構成</h4>' +
    tbl(['セグメント', '人数', '構成比'], rows) + '</div>' +
    '<div class="bcard"><h4>商圏別 構成</h4>' +
    tbl(['エリア', '人数', '構成比'], REGIONS.map(r => {
      const n = AGG.reg[r.n] || 0;
      return [r.n, fmt(n), (n / Math.max(1, k.sold) * 100).toFixed(1) + '%'];
    })) + '</div>' +
    '<div class="bcard wide"><h4>区画別 サマリ（販売率 / 収益）</h4>' +
    '<canvas data-chart="secBar" height="220"></canvas>' +
    '<div class="hint" style="margin-top:8px">区画ごとの販売率と収益。' +
    '低販売率かつ高露出の区画は<b>値付けが需要に追いついていない</b>候補です。</div></div>';
}
function boardPrice() {
  const rows = Object.keys(CAT).map(c => {
    const seats = SEAT.list.filter(s => s.cat === c);
    if (!seats.length) return null;
    const rec = seats.reduce((a, s) => a + s.rec, 0) / seats.length;
    return [CAT[c].name, fmt(seats.length), usd(CAT[c].price), usd(rec),
            ((rec / CAT[c].price - 1) * 100).toFixed(1) + '%'];
  }).filter(Boolean);
  return '<div class="bcard wide"><h4>席種別 推奨価格</h4>' +
    tbl(['席種', '席数', '現行定価', '推奨価格', '乖離'], rows) +
    '<div class="hint" style="margin-top:9px">推奨価格 = 定価 × f、' +
    '<b>f = 0.74 + 0.40×区画販売率 + 0.12×露出 + 0.08×需要弾性</b>（0.82〜1.32でクリップ）。' +
    '全席適用時の増分は <b>' + usd(AGG.price.opt - AGG.price.cur) + '</b>。</div></div>' +
    '<div class="bcard wide"><h4>価格乖離の分布</h4><canvas data-chart="priceHist" height="200"></canvas></div>';
}
function boardChurn() {
  const buckets = [0, 0, 0, 0, 0];
  let atRisk = 0, riskLtv = 0;
  for (let i = 0; i < SEAT.list.length; i++) {
    if (!SNAP.sold[i]) continue;
    const f = fanAt(i);
    buckets[Math.min(4, Math.floor(f.churn * 5))]++;
    if (f.churn > 0.55 && (f.seg === 'SEASON' || f.seg === 'PARTIAL')) { atRisk++; riskLtv += f.ltv; }
  }
  const nba = {};
  for (let i = 0; i < SEAT.list.length; i++) {
    if (!SNAP.sold[i]) continue;
    const f = fanAt(i);
    const m = nba[f.nba.t] || (nba[f.nba.t] = { n: 0, up: f.nba.up, val: 0 });
    m.n++; m.val += f.ltv * f.nba.up * 0.16;
  }
  return '<div class="bcard"><h4>離反リスク分布</h4>' +
    '<canvas data-chart="churnBar" height="200"></canvas></div>' +
    '<div class="bcard"><h4>要対応：シーズン券 高リスク層</h4>' +
    '<div class="fc-kpi" style="grid-template-columns:1fr 1fr">' +
    '<div><div class="v">' + fmt(atRisk) + '</div><div class="l">高リスク保有者</div></div>' +
    '<div><div class="v">' + usd(riskLtv) + '</div><div class="l">毀損しうるLTV</div></div></div>' +
    '<div class="hint" style="margin-top:8px">更新見込 45%未満のシーズン/部分券保有者。' +
    '3Dの<b>離反リスク</b>レイヤーで座席上の分布を確認できます — ' +
    '特定区画に固まる場合は<b>席の体験そのもの</b>（視認・動線・設備）が原因の可能性。</div></div>' +
    '<div class="bcard wide"><h4>Next Best Action 別 想定インパクト</h4>' +
    tbl(['アクション', '対象人数', '期待CVR上振れ', '想定増分'],
      Object.entries(nba).sort((a, b) => b[1].val - a[1].val).map(([t, m]) =>
        [t, fmt(m.n), '+' + (m.up * 100).toFixed(0) + '%', usd(m.val)])) + '</div>';
}

/* ---- 簡易チャート ---- */
function drawChart(cv) {
  const dpr = devicePixelRatio;
  cv.width = cv.clientWidth * dpr; cv.height = cv.height * dpr / (cv.height / cv.height);
  cv.height = (cv.getAttribute('height') | 0) * dpr;
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const kind = cv.dataset.chart;
  const pad = 30 * dpr;
  const barsOf = (labels, vals, cols) => {
    const mx = Math.max(...vals, 1), n = vals.length;
    const bw = (W - pad * 2) / n * 0.68;
    vals.forEach((v, i) => {
      const x = pad + (W - pad * 2) / n * (i + 0.5) - bw / 2;
      const h = (H - pad * 1.7) * (v / mx);
      c.fillStyle = cols[i % cols.length];
      c.fillRect(x, H - pad - h, bw, h);
      c.fillStyle = '#8590a8'; c.font = (9 * dpr) + 'px sans-serif'; c.textAlign = 'center';
      c.save(); c.translate(x + bw / 2, H - pad + 11 * dpr);
      if (n > 8) c.rotate(-0.9);
      c.fillText(labels[i], 0, 0); c.restore();
    });
  };
  if (kind === 'mediaBar') {
    const t = {};
    for (const b of AGG.board) t[b.type] = (t[b.type] || 0) + b.contract;
    barsOf(Object.keys(t), Object.values(t), ['#00c2ff', '#fdb927', '#3ddc84', '#8a5cc4', '#ff5fa2']);
  } else if (kind === 'gradePie') {
    const g = [0, 0, 0, 0, 0];
    for (const b of AGG.board) { g[4] += b.gradeA; g[3] += b.gradeB; g[2] += b.gradeC; g[1] += b.gradeD; g[0] += b.out; }
    barsOf(['圏外', 'D', 'C', 'B', 'A'], g, ['#20242f', '#54607c', '#4da3ff', '#3ddc84', '#fdb927']);
  } else if (kind === 'secBar') {
    const e = Object.entries(AGG.sec).filter(x => x[1].n > 60)
      .sort((a, b) => b[1].sold / b[1].n - a[1].sold / a[1].n).slice(0, 26);
    barsOf(e.map(x => x[0]), e.map(x => x[1].sold / x[1].n * 100),
      ['#00c2ff', '#4da3ff']);
  } else if (kind === 'priceHist') {
    const b = new Array(12).fill(0);
    for (const s of SEAT.list) b[clamp(Math.floor(((s.pf || 1) - 0.82) / 0.5 * 12), 0, 11)]++;
    barsOf(b.map((_, i) => (0.82 + i * 0.0417).toFixed(2)), b, ['#2e7fb8', '#3ddc84', '#fdb927', '#ff5b4d']);
  } else if (kind === 'churnBar') {
    const b = [0, 0, 0, 0, 0];
    for (let i = 0; i < SEAT.list.length; i++) if (SNAP.sold[i]) b[Math.min(4, Math.floor(fanAt(i).churn * 5))]++;
    barsOf(['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'], b,
      ['#3ddc84', '#00e0a4', '#fdb927', '#ff8a3d', '#ff5b4d']);
  }
}

/* ================= 個客ジャーニー再生 ================= */
const journey = { on: false, i: -1, t: 0, marker: null, path: [], fan: null };
(function mkMarker() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x00c2ff, emissive: 0x00c2ff, emissiveIntensity: 1.4 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  g.add(b, ring); g.visible = false;
  interior.add(g); journey.marker = g;
})();

function startJourney() {
  /* 高LTV × 高離反リスクの席を選ぶ（＝最も打ち手の価値が高い個客） */
  let best = -1, bs = -1;
  for (let i = 0; i < SEAT.list.length; i += 7) {
    if (!SNAP.sold[i]) continue;
    const f = fanAt(i);
    const sc = f.ltv / 90000 * 0.6 + f.churn * 0.4;
    if (sc > bs) { bs = sc; best = i; }
  }
  if (best < 0) return;
  const s = SEAT.list[best], f = fanAt(best);
  journey.i = best; journey.fan = f; journey.on = true; journey.t = 0;
  /* 経路: ゲート → コンコース → ボミトリー → 着席 */
  const backA = TIER.L100.a + TIER.L100.rows * TIER.L100.tread + 6;
  const backB = TIER.L100.b + TIER.L100.rows * TIER.L100.tread + 6;
  const ang = Math.atan2(s.x, s.z);
  const conc = [Math.sin(ang) * backA * 0.98, 12.4, Math.cos(ang) * backB * 0.98];
  const vom = [s.x * 1.35, TIER.L100.y0 + TIER.L100.rows * TIER.L100.rise, s.z * 1.35];
  journey.path = [
    [Math.sin(ang) * backA * 1.5, 1.2, Math.cos(ang) * backB * 1.5],
    conc, vom, [s.x, s.y + 0.6, s.z]
  ];
  journey.marker.visible = true;
  setLevel('arena', true);
  showFanCard(best);
  toast('🚶 ジャーニー再生: <b>' + f.fid + '</b>（' + SEGMENTS[f.seg].name + ' / LTV ' + usd(f.ltv) +
    ' / 更新見込 ' + ((1 - f.churn) * 100).toFixed(0) + '%）<br>' +
    f.gate + ' 入場 ' + clockStr(f.arrival) + ' → コンコース → ' + seatLabel(best), 6000);
}
function journeyTick(dt) {
  if (!journey.on) return;
  journey.t += dt * 0.26;
  if (journey.t >= 1) { journey.t = 1; journey.on = false; }
  const P = journey.path, n = P.length - 1;
  const u = journey.t * n, k = Math.min(n - 1, Math.floor(u)), w = u - k;
  const a = P[k], b = P[k + 1];
  journey.marker.position.set(lerp(a[0], b[0], w), lerp(a[1], b[1], w) + 0.9, lerp(a[2], b[2], w));
}
window.frameHook = function (dt) {
  journeyTick(dt);
  if (journey.marker.visible) journey.marker.children[1].rotation.z += dt * 1.6;
};
