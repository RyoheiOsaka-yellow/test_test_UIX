
/* ================================================================
   モジュール: 2D席図 / 分析ボード / 個客ジャーニー再生
================================================================ */

/* ================= 2D 席図（3Dと双方向連動） ================= */
const m2 = document.getElementById('m2'), m2cv = document.getElementById('m2-cv');
let m2ctx = null, m2geo = null;
const M2_MODES = [['seg', 'セグメント'], ['segment', '抽出セグメント'], ['journey', '接触本数'], ['od', '来場OD'], ['ltv', 'LTV'], ['churn', '離反リスク'],
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
  if (seatMode === 'journey') {
    const n = AUTO.seatCount ? AUTO.seatCount[i] : 0;
    return n ? '#' + heatC(clamp(n / 5, 0, 1)).getHexString() : '#151b26';
  }
  if (seatMode === 'segment')
    return SEG_STATE.matched && SEG_STATE.matched[i] ? '#00e5ff' : '#151b26';
  if (seatMode === 'od') {
    const f = fanAt(i);
    return odFocus < 0 || f.oi === odFocus ? hex(f.org.col) : '#1a2030';
  }
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
const BOARD_TABS = [['od', 'route', 'OD・移動'], ['media', 'eye', '媒体・スポンサー'],
                    ['seg', 'tag', 'セグメント'], ['price', 'dollar', '価格'],
                    ['churn', 'alert', 'リテンション']];
let boardTab = 'media';

function openBoard(tab) {
  boardTab = tab || boardTab;
  board.style.display = 'flex';
  document.getElementById('board-hd').querySelector('.t').textContent = '📊 分析ボード — ' + GAMES[curGame].name;
  document.getElementById('board-tabs').innerHTML = BOARD_TABS.map(t =>
    '<button class="ib wide' + (boardTab === t[0] ? ' active' : '') + '" data-bt="' + t[0] + '">' +
    ic(t[1], 14) + t[2] + '</button>').join('');
  document.getElementById('board-tabs').querySelectorAll('[data-bt]').forEach(b =>
    b.onclick = () => openBoard(b.dataset.bt));
  const body = document.getElementById('board-body');
  body.innerHTML = boardTab === 'od' ? boardOD()
    : boardTab === 'media' ? boardMedia()
    : boardTab === 'seg' ? boardSeg()
    : boardTab === 'price' ? boardPrice() : boardChurn();
  flushViz();
  bindSections(body);
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
    (function () {
      const t = {};
      for (const b of AGG.board) t[b.type] = (t[b.type] || 0) + b.contract;
      return vizCanvas({ type: 'donut', h: 190, legendRight: true, vFmt: usd,
        slices: Object.keys(t).map((k, i) => ({ label: k, value: t[k], color: VIZ.ser[i] })),
        center: { v: usd(tot), l: '年間契約 総額' } }, 190);
    })() + '</div>' +
    '<div class="bcard"><h4>視認等級の分布（全媒体合計）</h4>' +
    (function () {
      const g = [0, 0, 0, 0, 0];
      for (const b of AGG.board) { g[4] += b.gradeA; g[3] += b.gradeB; g[2] += b.gradeC;
        g[1] += b.gradeD; g[0] += b.out; }
      return vizCanvas({ type: 'bars', h: 190, padL: 46, legend: false,
        x: ['圏外', 'D', 'C', 'B', 'A'], tipFmt: v => fmt(v) + ' 席',
        series: [{ name: '席数', data: g, color: VIZ.ser[0] }] }, 190);
    })() + '</div>' +
    '<div class="bcard wide"><h4>実効露出 × 実効露出単価 — 媒体の割安・割高</h4>' +
    vizCanvas({ type: 'scatter', h: 250, padL: 56, xLab: '実効露出（人）', yLab: '実効露出単価 $',
      xFmt: v => fmt(v), yFmt: v => '$' + v.toFixed(1),
      points: AGG.board.map((b, i) => ({ x: b.score, y: b.cpe, r: 4 + Math.sqrt(b.contract) / 260,
        color: VIZ.ser[['COURTSIDE_LED', 'RIBBON', 'SCOREBOARD', 'WALL'].indexOf(b.type) + 1] ||
               VIZ.ser[0], label: b.name,
        sub: b.type + ' ／ 年間契約 ' + usd(b.contract) })) }, 250) +
    '<div class="hint" style="margin-top:8px">円の大きさ＝年間契約額。' +
    '<b>右下ほど割安（露出が多いのに単価が低い）</b>＝値上げ余地、' +
    '左上ほど割高＝価格是正の対象です。</div></div>';
}
function boardSeg() {
  const k = AGG.kpi;
  const rows = Object.keys(SEGMENTS).map(s => {
    const n = AGG.seg[s] || 0;
    return [SEGMENTS[s].name, fmt(n), (n / Math.max(1, k.sold) * 100).toFixed(1) + '%'];
  });
  const segSlices = Object.keys(SEGMENTS).filter(x => AGG.seg[x])
    .sort((a, b) => AGG.seg[b] - AGG.seg[a])
    .map((x, i) => ({ label: SEGMENTS[x].name, value: AGG.seg[x], color: VIZ.ser[i % 8] }));
  const secs = Object.entries(AGG.sec).filter(x => x[1].n > 60);
  return '<div class="bcard"><h4>セグメント別 構成</h4>' +
    vizCanvas({ type: 'donut', h: 190, legendRight: true, vFmt: v => fmt(v) + ' 人',
      slices: segSlices, center: { v: fmt(k.sold), l: '販売席' } }, 190) +
    tbl(['セグメント', '人数', '構成比'], rows) + '</div>' +
    '<div class="bcard"><h4>商圏別 構成</h4>' +
    vizCanvas({ type: 'hbars', rowH: 22, labW: 132, valW: 76, vFmt: v => fmt(v) + ' 人',
      rows: REGIONS.map((r, i) => ({ label: r.n, value: AGG.reg[r.n] || 0, color: VIZ.ser[i % 8],
        sub: ((AGG.reg[r.n] || 0) / Math.max(1, k.sold) * 100).toFixed(1) + '%' }))
        .sort((a, b) => b.value - a.value) }) + '</div>' +
    '<div class="bcard wide"><h4>区画別 販売率 × 露出 — 値付けが需要に追いついていない区画</h4>' +
    vizCanvas({ type: 'scatter', h: 270, padL: 52, xLab: '露出スコア', yLab: '販売率 %',
      xMin: 0, xMax: 1, yMax: 105, xFmt: v => (v * 100).toFixed(0), yFmt: v => v.toFixed(0) + '%',
      points: secs.map(([nm, m]) => {
        const seats = SEAT.list.filter(s => s.sec === nm);
        const ex = seats.reduce((a, s) => a + s.exp, 0) / Math.max(1, seats.length);
        const so = m.sold / m.n * 100;
        return { x: ex, y: so, r: 3 + Math.sqrt(m.n) / 3.2, label: 'Sec ' + nm,
          color: so < 75 && ex > 0.5 ? VIZ.st.serious : VIZ.ser[0],
          sub: fmt(m.sold) + ' / ' + fmt(m.n) + ' 席 ・ ' + usd(m.rev) };
      }) }, 270) +
    '<div class="hint" style="margin-top:8px">円の大きさ＝区画の席数。' +
    '<b style="color:' + VIZ.st.serious + '">右下（高露出なのに低販売率）</b>の区画は、' +
    '媒体価値の高い席が売り切れていないということ。値付けか売り方の見直し対象です。</div></div>';
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
    '<div class="bcard"><h4>価格係数の分布</h4>' +
    (function () {
      const b = new Array(12).fill(0);
      for (const s2 of SEAT.list) b[clamp(Math.floor(((s2.pf || 1) - 0.82) / 0.5 * 12), 0, 11)]++;
      return vizCanvas({ type: 'bars', h: 210, padL: 46, legend: false,
        x: b.map((_, i) => (0.82 + i * 0.0417).toFixed(2)), tipFmt: v => fmt(v) + ' 席',
        series: [{ name: '席数', data: b, color: VIZ.ser[0] }] }, 210);
    })() + '</div>' +
    '<div class="bcard"><h4>席種別 現行 vs 推奨</h4>' +
    (function () {
      const cats = Object.keys(CAT).filter(c => SEAT.list.some(s2 => s2.cat === c));
      const cur = [], rec = [];
      for (const c of cats) {
        const seats = SEAT.list.filter(s2 => s2.cat === c);
        cur.push(CAT[c].price);
        rec.push(Math.round(seats.reduce((a, s2) => a + s2.rec, 0) / seats.length));
      }
      return vizCanvas({ type: 'bars', h: 210, padL: 52, yFmt: v => '$' + fmt(v),
        x: cats, tipFmt: usd,
        series: [{ name: '現行定価', data: cur, color: VIZ.ser[0] },
                 { name: '推奨価格', data: rec, color: VIZ.ser[1] }] }, 210);
    })() + '</div>';
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
    vizCanvas({ type: 'bars', h: 200, padL: 50, legend: false,
      x: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'], tipFmt: v => fmt(v) + ' 人',
      series: [{ name: '人数', data: buckets, color: VIZ.ser[0] }] }, 200) +
    '<div class="hint" style="margin-top:8px">横軸は<b>離反リスク</b>。' +
    '右に寄るほど更新見込が低い層です。</div></div>' +
    '<div class="bcard"><h4>要対応：シーズン券 高リスク層</h4>' +
    '<div class="fc-kpi" style="grid-template-columns:1fr 1fr">' +
    '<div><div class="v">' + fmt(atRisk) + '</div><div class="l">高リスク保有者</div></div>' +
    '<div><div class="v">' + usd(riskLtv) + '</div><div class="l">毀損しうるLTV</div></div></div>' +
    '<div class="hint" style="margin-top:8px">更新見込 45%未満のシーズン/部分券保有者。' +
    '3Dの<b>離反リスク</b>レイヤーで座席上の分布を確認できます — ' +
    '特定区画に固まる場合は<b>席の体験そのもの</b>（視認・動線・設備）が原因の可能性。</div></div>' +
    '<div class="bcard wide"><h4>Next Best Action 別 想定インパクト</h4>' +
    vizCanvas({ type: 'hbars', rowH: 24, labW: 190, valW: 96, vFmt: usd,
      rows: Object.entries(nba).sort((a, b) => b[1].val - a[1].val).map(([t, m], i) =>
        ({ label: t, value: Math.round(m.val), color: VIZ.ser[i % 8],
           sub: '対象 ' + fmt(m.n) + ' 人 ／ 期待CVR上振れ +' + (m.up * 100).toFixed(0) + '%' })) }) +
    '<div class="hint" style="margin-top:8px">想定増分 = 対象人数 × LTV × 期待上振れ × 0.16。' +
    'バーにカーソルを合わせると対象人数と上振れ率が出ます。</div></div>';
}


/* ================= OD・移動 ボード ================= */
function boardOD() {
  const k = AGG.kpi, sold = k.sold || 1;
  const od = AGG.od.slice().sort((a, b) => b.n - a.n);

  /* --- 交通手段別 --- */
  const byMode = {};
  for (const m of AGG.od) {
    const e = byMode[m.o.mode] || (byMode[m.o.mode] = { n: 0, min: 0, km: 0, rev: 0, fb: 0 });
    e.n += m.n; e.min += m.min; e.km += m.km; e.rev += m.rev; e.fb += m.fb;
  }
  const modeRows = Object.entries(byMode).sort((a, b) => b[1].n - a[1].n).map(([mo, e]) =>
    [mo, fmt(e.n), (e.n / sold * 100).toFixed(1) + '%',
     (e.km / Math.max(1, e.n)).toFixed(1) + ' km',
     Math.round(e.min / Math.max(1, e.n)) + ' 分',
     usd(e.rev / Math.max(1, e.n)), usd(e.fb / Math.max(1, e.n))]);

  /* --- 駐車需要 --- */
  const carN = (byMode.CAR ? byMode.CAR.n : 0);
  const OCC = 2.6;                                   // 1台あたり乗車人数
  const need = Math.round(carN / OCC);
  const ratio = need / Math.max(1, PARK_CAP.stalls);

  /* --- OD行列（商圏 × 出発地） --- */
  const origins = AGG.od.map(m => m.o.name);
  const mtxHead = ['商圏 \\ 出発地'].concat(origins.map(n => n.replace(/（.*/, '').slice(0, 12)));
  const mtxRows = REGIONS.map(r => {
    const row = AGG.odMatrix[r.n] || {};
    return [r.n].concat(origins.map(o => row[o] ? fmt(row[o]) : '·'));
  });
  mtxRows.push(['<b>計</b>'].concat(AGG.od.map(m => '<b>' + fmt(m.n) + '</b>')));

  /* --- 出発地 × 席ティア --- */
  const TIERS = ['FLOOR', 'L100', 'PRM', 'SUITE', 'L300'];
  const tierRows = od.map(m => [m.o.name.replace(/（.*/, '')].concat(
    TIERS.map(t => m.tier[t] ? fmt(m.tier[t]) : '·')));

  /* --- 退場OD（回遊） --- */
  const dispRows = DISPERSAL.map(d => {
    const n = Math.round(sold * d.share);
    return [d.name, d.mode, fmt(n), (d.share * 100).toFixed(1) + '%',
            d.spend ? usd(d.spend) : '—', d.spend ? usd(n * d.spend) : '—',
            fmt(d.route.total) + ' m'];
  });
  const outSpend = DISPERSAL.reduce((a, d) => a + sold * d.share * d.spend, 0);

  /* --- ゲート負荷 --- */
  const gateRows = Object.entries(AGG.gate).sort((a, b) => b[1] - a[1]).map(([g, n]) =>
    [g, fmt(n), (n / sold * 100).toFixed(1) + '%',
     fmt(Math.round(n / 25 / 2.2)) + ' 分', fmt(Math.round(n * 0.32))]);

  /* --- 等時線 --- */
  const isoRows = ISO.built ? ISO.bands.map((b, i) =>
    ['〜' + b + ' 分', ISO.stats.km[i].toFixed(1) + ' km',
     fmt(ISO.stats.bld[i]) + ' 棟']).concat([['圏外',
       ISO.stats.km[ISO.bands.length].toFixed(1) + ' km',
       fmt(ISO.stats.bld[ISO.bands.length]) + ' 棟']]) : null;

  return '<div class="bcard wide"><h4>出発地別 OD サマリ — ' + GAMES[curGame].name + '</h4>' +
    tbl(['出発地', '手段', '人数', 'シェア', '平均距離', '平均所要', '平均LTV', 'チケット収益', '場内購買'],
      od.map(m => [m.o.name, m.o.mode, fmt(m.n), (m.n / sold * 100).toFixed(1) + '%',
        m.avgKm.toFixed(1) + ' km', Math.round(m.avgMin) + ' 分',
        usd(m.avgLtv), usd(m.rev), usd(m.fb)])) +
    '<div class="hint" style="margin-top:9px">所要は<b>ドアツードア</b>推計＝当日移動距離÷手段別速度 ' +
    '＋ 端末アクセス徒歩（経路長÷80m/分）＋ 待ち時間（Metro 7分 / 配車 6分 / 駐車 9分）。' +
    '州外・海外客は市内に宿泊している前提で、<b>居住地距離ではなく宿泊拠点からの距離</b>を使っています。' +
    '経路長は実道路グラフ上の A* 解です。</div></div>' +

    '<div class="bcard"><h4>交通手段別</h4>' +
    vizCanvas({ type: 'donut', h: 176, legendRight: true, vFmt: v => fmt(v) + ' 人',
      slices: Object.entries(byMode).sort((a, b) => b[1].n - a[1].n).map(([mo, e], i) =>
        ({ label: mo, value: e.n, color: VIZ.ser[i % 8] })),
      center: { v: fmt(sold), l: '来場者' } }, 176) +
    tbl(['手段', '人数', 'シェア', '平均距離', '平均所要', '平均単価', '場内購買/人'], modeRows) +
    '</div>' +

    '<div class="bcard"><h4>駐車需要 vs 徒歩圏の供給</h4>' +
    '<div class="fc-kpi" style="grid-template-columns:1fr 1fr 1fr">' +
    '<div><div class="v">' + fmt(need) + '</div><div class="l">必要台数（' + OCC + '人/台）</div></div>' +
    '<div><div class="v">' + fmt(PARK_CAP.stalls) + '</div><div class="l">800m圏 供給 (' + PARK_CAP.lots + '区画)</div></div>' +
    '<div><div class="v" style="color:' + (ratio > 1 ? 'var(--warn)' : 'var(--ok)') + '">' +
      (ratio * 100).toFixed(0) + '%</div><div class="l">充足率</div></div></div>' +
    '<div class="hint" style="margin-top:8px">供給は OSM の駐車場ポリゴン実面積（' +
    fmt(PARK_CAP.m2) + ' m²）を <b>1台=28m²</b>（通路込み）で換算した推計。' +
    (ratio > 1 ? '<b style="color:var(--warn)">需要超過</b>のため、路上・遠方駐車と' +
      'ライドシェア/Metroへの転換が発生している想定です。' : '圏内で概ね吸収できる水準です。') +
    '</div></div>' +

    '<div class="bcard wide"><h4>OD行列 — 商圏 × 出発地（人数）</h4>' +
    vizCanvas({ type: 'heat', labW: 128, vFmt: v => fmt(v) + ' 人',
      rows: REGIONS.map(r => r.n),
      cols: AGG.od.map(m => m.o.name.replace(/（.*/, '').slice(0, 10)),
      values: REGIONS.map(r => AGG.od.map(m => (AGG.odMatrix[r.n] || {})[m.o.name] || 0)) }) +
    '<div style="overflow-x:auto;margin-top:10px">' + tbl(mtxHead, mtxRows) + '</div>' +
    '<div class="hint" style="margin-top:8px">個客レコードの商圏に整合する出発地を割り当てた結果。' +
    '<b>実データでは fans.zip5 と tickets.scanned_at / gate から実測OD行列に置換</b>できます。</div></div>' +

    '<div class="bcard wide"><h4>出発地 × 席ティア</h4>' +
    tbl(['出発地'].concat(TIERS), tierRows) +
    '<div class="hint" style="margin-top:8px">遠方ほど上層に寄るのか、プレミアに寄るのか。' +
    '<b>遠方かつ高単価</b>のセルは、宿泊・交通を束ねたパッケージ販売の対象です。</div></div>' +

    '<div class="bcard"><h4>ゲート別 負荷</h4>' +
    vizCanvas({ type: 'hbars', rowH: 23, labW: 128, valW: 74, vFmt: v => fmt(v) + ' 人',
      rows: Object.entries(AGG.gate).sort((a, b) => b[1] - a[1]).map(([g, n], i) =>
        ({ label: g.replace(/ \(.*/, ''), value: n, color: VIZ.ser[i % 8],
           sub: g + ' ／ 想定所要 ' + fmt(Math.round(n / 25 / 2.2)) + ' 分' })) }) +
    tbl(['ゲート', '入場者', 'シェア', '想定所要', 'ピーク時/10分'], gateRows) +
    '<div class="hint" style="margin-top:8px">所要はターンスタイル25通り・1通り2.2人/分での捌き時間。' +
    'ピーク時は開場後60分に32%が集中する想定。</div></div>' +

    '<div class="bcard"><h4>到達圏（等時線・' + (ISO.mode === 'walk' ? '徒歩' : '車') + '）</h4>' +
    (isoRows ? tbl(['到達時間', '道路延長', '建物'], isoRows) +
      '<div class="hint" style="margin-top:8px">道路グラフ上の Dijkstra。' +
      'リンク速度は車 12〜54km/h（道路クラス別・試合日実勢）、徒歩 4.8km/h。' +
      '建物棟数は<b>圏内の受け皿（宿泊・飲食・駐車）の規模</b>の代理指標です。</div>'
      : '<div class="hint">L0 パネルの「到達圏」から計算してください。</div>') + '</div>' +

    '<div class="bcard wide"><h4>退場OD — 直帰と周辺回遊</h4>' +
    vizCanvas({ type: 'hbars', rowH: 24, labW: 196, valW: 96, vFmt: usd,
      rows: DISPERSAL.map((d, i) => ({ label: d.name, value: Math.round(sold * d.share * d.spend),
        color: VIZ.ser[i % 8],
        sub: fmt(Math.round(sold * d.share)) + ' 人 ／ 客単価 ' +
             (d.spend ? usd(d.spend) : '—') + ' ／ ' + fmt(d.route.total) + 'm' })) }) +
    tbl(['行き先', '手段', '人数', 'シェア', '客単価', '場外消費', '経路長'], dispRows) +
    '<div class="hint" style="margin-top:9px">1興行あたりの<b>場外消費 ' + usd(outSpend) +
    '</b>。年44興行で <b>' + usd(outSpend * 44) + '</b>。' +
    'これはアリーナが周辺の街に落とす金額で、自治体・周辺事業者・スポンサーに対する' +
    '「地域経済インパクト」の根拠になります。</div></div>';
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
FRAME_HOOKS.push(function (dt) {
  journeyTick(dt);
  if (journey.marker.visible) journey.marker.children[1].rotation.z += dt * 1.6;
});
