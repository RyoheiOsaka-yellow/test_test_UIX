
/* ================================================================
   左パネル UI / 個客カード / タイムライン
================================================================ */
const pb = document.getElementById('panel-body');
const SEAT_MODES = [
  ['crowd', '観客', '在館率カーブに連動した実人数表示', 0x9aa6bd],
  ['seg',   'セグメント', 'シーズン券/単券/二次流通/州外 …', 0xfdb927],
  ['ltv',   'LTV', '個客生涯価値のヒートマップ', 0x3ddc84],
  ['churn', '離反リスク', '更新確率が低い層を席上で特定', 0xff5b4d],
  ['occ',   '販売率', '区画×列の販売率', 0x4da3ff],
  ['cat',   '席種', '価格カテゴリ', 0xff8a3d],
  ['exp',   'スポンサー露出', '媒体別の実効露出重み', 0x00e0a4],
  ['grade', '視認等級', '文字視角(arcmin)による A〜D 判定', 0x8a5cc4],
  ['price', '価格最適化', '現行価格 vs 推奨価格の乖離', 0xff5fa2],
];
const VIEW_MODES = [['solid', 'SOLID 実体'], ['point', 'POINT 点描'],
                    ['wire', 'WIRE 線画'], ['blueprint', 'BLUEPRINT 青焼き']];

const bar = (label, v, max, col) =>
  '<div class="bar-row"><span title="' + label + '">' + label + '</span>' +
  '<div class="bar"><i style="width:' + clamp(v / (max || 1) * 100, 0, 100).toFixed(1) +
  '%;background:' + col + '"></i></div><b>' + fmt(v) + '</b></div>';

function kpiCard(v, l, cls) {
  return '<div class="kpi"><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div>' +
         '<div class="l">' + l + '</div></div>';
}

function renderPanel() {
  if (level === 'arena') return renderArenaPanel();
  if (level === 'plaza') return renderPlazaPanel();
  renderSitePanel();
}

/* ---------- L0 ---------- */
function renderSitePanel() {
  const st = SCENE_DATA;
  pb.innerHTML =
    '<div class="sec"><div class="sec-t"><b>表示モード</b> — 外部環境</div>' +
    '<div class="row-btns" id="vm">' + VIEW_MODES.map(m =>
      '<button class="chip' + (viewMode === m[0] ? ' active' : '') + '" data-vm="' + m[0] + '">' +
      m[1] + '</button>').join('') + '</div>' +
    '<div class="hint" style="margin-top:7px">実体 / <b>点描</b>（外形を等間隔サンプリングした擬似点群） / ' +
    '線画 / <b>青焼き</b>（図面表現）を切り替え。街区とアリーナの関係を、' +
    '見せたい相手に応じた表現で提示できます。</div></div>' +

    '<div class="sec"><div class="sec-t"><b>サイト構成</b> — OpenStreetMap 実データ</div>' +
    '<div class="kpi-grid">' +
      kpiCard(fmt(st.buildings.length), '近景 建物') +
      kpiCard(fmt(st.mid.length + st.dots.length / 2), '中〜遠景 建物') +
      kpiCard(fmt(st.roads.length), '道路セグメント') +
      kpiCard(fmt(siteStats.points), '点描 ポイント') +
    '</div></div>' +

    '<div class="sec"><div class="sec-t"><b>交通インフラ</b> — 高架/地上/地下を作り分け</div>' +
    '<div class="legend">' +
      '<div class="li"><div class="sw" style="background:#a08a56"></div>フリーウェイ I-110 / I-10（高架は橋脚付き）</div>' +
      '<div class="li"><div class="sw" style="background:#5c6f9b"></div>幹線 Figueroa / Olympic / Pico</div>' +
      '<div class="li"><div class="sw" style="background:#0072ce"></div>Metro A Line</div>' +
      '<div class="li"><div class="sw" style="background:#fdb913"></div>Metro E Line</div>' +
      '<div class="li"><div class="sw" style="background:#e4002b"></div>Metro B Line（地下・半透過）</div>' +
      '<div class="li"><div class="sw" style="background:#a05da5"></div>Metro D Line（地下・半透過）</div>' +
    '</div>' +
    '<div class="hint" style="margin-top:7px">最寄 <b>Pico 駅</b>（A/E Line）はアリーナ中心から約 280m。' +
    '橋梁 ' + fmt(st.roads.filter(r => r.b === 1).length) + ' / トンネル ' +
    fmt(st.roads.filter(r => r.b === -1).length) + ' セグメントを OSM の bridge/tunnel/layer から反映。</div></div>' +

    '<div class="sec"><div class="sec-t"><b>POI</b> — 回遊・クロス送客の対象</div>' +
    '<div class="legend">' + SCENE_DATA.pois.slice(0, 8).map(p =>
      '<div class="li"><div class="sw" style="background:' + hex(POI_COL[p.c] || 0x8590a8) +
      '"></div>' + p.n + '</div>').join('') + '</div></div>' +

    '<div class="sec"><button class="tool-btn" id="go-arena">▶ L2 ボウル内部へ（19,079席の1to1分析）</button></div>';

  pb.querySelectorAll('[data-vm]').forEach(b => b.onclick = () => setViewMode(b.dataset.vm));
  const ga = document.getElementById('go-arena');
  if (ga) ga.onclick = () => setLevel('arena', true);
}

/* ---------- L1 ---------- */
function renderPlazaPanel() {
  const k = AGG.kpi;
  pb.innerHTML =
    '<div class="sec"><div class="sec-t"><b>L1 エントランス広場</b> — Figueroa / Star Plaza</div>' +
    '<div class="kpi-grid">' +
      kpiCard(String(GATES.length), '入場ゲート') +
      kpiCard('25', 'ターンスタイル') +
      kpiCard(fmt(k.sold || 0), '本日 入場者', 'g') +
      kpiCard(clockStr(timeState.min), '現在時刻', 'k') +
    '</div></div>' +
    '<div class="sec"><div class="sec-t"><b>ゲート</b> — スキャン地点</div><div class="legend">' +
    GATES.map(g => '<div class="li"><div class="sw" style="background:#00c2ff"></div>' + g.name + '</div>').join('') +
    '</div><div class="hint" style="margin-top:7px">ターンスタイルの通過で <b>fan_id × 入場時刻 × ゲート</b> を取得。' +
    'これがジャーニー分析の起点になり、到着分布から OD・交通手段を実測化できます。</div></div>' +
    '<div class="sec"><div class="sec-t"><b>BIM 要素</b></div><div class="hint">' +
    'カーテンウォール（ユニット式 Low-E複層）・キャノピー・マリオン・サイネージ・' +
    'ターンスタイル・植栽を部材単位で保持。<b>クリックで IFC風属性</b>を表示します。</div></div>' +
    '<div class="sec"><button class="tool-btn" id="go-arena2">▶ L2 ボウル内部へ</button></div>';
  const g = document.getElementById('go-arena2');
  if (g) g.onclick = () => setLevel('arena', true);
}

/* ---------- L2 ---------- */
function renderArenaPanel() {
  const k = AGG.kpi, G = GAMES[curGame];
  const segRows = Object.keys(SEGMENTS).map(s =>
    bar(SEGMENTS[s].name, AGG.seg[s] || 0, k.sold, hex(SEGMENTS[s].color))).join('');
  const regRows = REGIONS.map(r =>
    bar(r.n, AGG.reg[r.n] || 0, k.sold, hex(r.col))).join('');
  const boardOpts = ledBoards.map((b, i) =>
    '<button class="chip sm' + (expBoard === i ? ' active' : '') + '" data-bd="' + i + '">' +
    b.name + '</button>').join('');

  pb.innerHTML =
    '<div class="sec"><div class="sec-t"><b>興行</b> — フロア形状と需要が切り替わる</div>' +
    '<div class="row-btns" id="gm">' + Object.keys(GAMES).map(g =>
      '<button class="chip sm' + (curGame === g ? ' active' : '') + '" data-gm="' + g + '">' +
      GAMES[g].name.replace('vs ', '').replace(' (Sold Out)', '') + '</button>').join('') +
    '</div><div class="hint" style="margin-top:6px">' + G.name + '　' + G.date +
    '　<b>' + G.fmt + '</b> 構成</div></div>' +

    '<div class="sec"><div class="sec-t"><b>KPI</b> — ' + fmt(k.cap) + '席</div>' +
    '<div class="kpi-grid">' +
      kpiCard((k.occ * 100).toFixed(1) + '<small>%</small>', '販売率') +
      kpiCard(fmt(k.sold), '販売席数', 'k') +
      kpiCard(usd(k.rev), 'チケット収益', 'g') +
      kpiCard(usd(k.avg), '平均単価', 'g') +
      kpiCard(usd(k.fbTotal), '場内購買 推計') +
      kpiCard(usd(k.mediaValue), '媒体デリバリー額', 'p') +
      kpiCard((k.season * 100).toFixed(0) + '<small>%</small>', 'シーズン券比率') +
      kpiCard((k.outState * 100).toFixed(0) + '<small>%</small>', '州外・海外比率') +
    '</div></div>' +

    '<div class="sec"><div class="sec-t"><b>座席レイヤー</b> — 1to1 の切り口</div>' +
    '<div class="mode-list" id="sm">' + SEAT_MODES.map(m =>
      '<button class="mode-btn' + (seatMode === m[0] ? ' active' : '') + '" data-sm="' + m[0] + '">' +
      '<div class="dot" style="background:' + hex(m[3]) + '"></div><div style="flex:1">' + m[1] +
      '<span class="desc">' + m[2] + '</span></div></button>').join('') + '</div></div>' +

    ((seatMode === 'exp' || seatMode === 'grade') ?
      '<div class="sec"><div class="sec-t"><b>対象媒体</b></div><div class="row-btns" id="bd">' +
      '<button class="chip sm' + (expBoard < 0 ? ' active' : '') + '" data-bd="-1">全媒体 合成</button>' +
      boardOpts + '</div>' +
      (seatMode === 'grade' ?
        '<div class="legend" style="margin-top:7px">' +
        ['圏外', 'D 視認困難', 'C 判読可', 'B 良好', 'A 最良'].map((n, i) =>
          '<div class="li"><div class="sw" style="background:' + hex(GRADE_C[i]) + '"></div>' + n + '</div>').join('') +
        '</div>' : '<div class="grad-bar" style="margin-top:7px"></div>' +
        '<div class="grad-lbl"><span>低露出</span><span>高露出</span></div>') +
      '<div class="hint" style="margin-top:6px">視認等級は <b>文字高 ÷ 視距離 × 3437.75 = 文字視角(arcmin)</b> で判定。' +
      'A≥60′ / B≥35′ / C≥18′ / D≥8′。</div></div>' : '') +

    ((seatMode === 'ltv' || seatMode === 'churn' || seatMode === 'occ') ?
      '<div class="sec"><div class="grad-bar"></div><div class="grad-lbl"><span>' +
      (seatMode === 'churn' ? '低リスク' : '低') + '</span><span>' +
      (seatMode === 'churn' ? '高リスク' : '高') + '</span></div></div>' : '') +

    '<div class="sec"><div class="sec-t"><b>セグメント構成</b>（販売席 ' + fmt(k.sold) + '）</div>' + segRows + '</div>' +
    '<div class="sec"><div class="sec-t"><b>商圏</b> — 来場元</div>' + regRows + '</div>' +

    '<div class="sec"><div class="sec-t"><b>価格最適化</b></div>' +
    '<div class="kpi-grid">' +
      kpiCard(usd(AGG.price.cur), '現行 定価ベース') +
      kpiCard(usd(AGG.price.opt), '推奨価格ベース', 'g') +
    '</div><div class="hint" style="margin-top:6px">係数 <b>f = 0.74 + 0.40×区画販売率 + 0.12×露出 + 0.08×需要弾性</b>' +
    '（0.82〜1.32）。差分 <b>' + usd(AGG.price.opt - AGG.price.cur) + '</b>（' +
    ((AGG.price.opt / Math.max(1, AGG.price.cur) - 1) * 100).toFixed(1) + '%）</div></div>' +

    '<div class="sec"><div class="sec-t"><b>BIM 表示</b> — 見通しの確保</div>' +
    ['roof:屋根スラブ', 'truss:屋根トラス/キャットウォーク', 'structure:段床・柱・手すり・ボミトリー',
     'suites:Premier Box', 'media:スポンサー媒体'].map(x => {
      const [k, n] = x.split(':');
      return '<label class="ck-row"><input type="checkbox" data-show="' + k + '"' +
        (SHOW[k] ? ' checked' : '') + '>' + n + '</label>';
    }).join('') +
    '<div class="hint" style="margin-top:6px">部材をクリックすると <b>IFC風の属性カード</b>が開きます。' +
    'BIM/IFC 連携で実部材属性へ置換可能です。</div></div>' +

    '<div class="sec"><div class="sec-t"><b>ツール</b></div>' +
    '<button class="tool-btn" id="open-2d" style="margin-bottom:6px">🗺 2D 席図を開く</button>' +
    '<button class="tool-btn" id="open-board" style="margin-bottom:6px">📊 分析ボード（媒体・セグメント・価格）</button>' +
    '<button class="tool-btn" id="open-journey" style="margin-bottom:6px">🚶 個客ジャーニー再生</button>' +
    '<label class="tool-btn" style="display:block;text-align:center">📥 tickets.csv を読み込む' +
    '<input type="file" id="csv" accept=".csv" style="display:none"></label></div>' +

    '<div class="sec"><div class="hint">表示中のデータは <b>合成（決定的PRNG）</b>です。' +
    'docs/DATA_SPEC.md の tickets.csv / fans.csv を投入すると、同じ画面のまま実測に切り替わります。</div></div>';

  pb.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => {
    curGame = b.dataset.gm;
    setFloorFormat(GAMES[curGame].fmt);
    buildSnapshot(); repaintSeats(); renderPanel();
    toast(GAMES[curGame].name + ' — フロア構成 <b>' + GAMES[curGame].fmt + '</b> / 販売率 ' +
      (AGG.kpi.occ * 100).toFixed(1) + '%', 3000);
  });
  pb.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => {
    seatMode = b.dataset.sm; repaintSeats(); renderPanel();
  });
  pb.querySelectorAll('[data-bd]').forEach(b => b.onclick = () => {
    expBoard = +b.dataset.bd; repaintSeats(); renderPanel();
  });
  pb.querySelectorAll('[data-show]').forEach(c => c.onchange = () => {
    SHOW[c.dataset.show] = c.checked;
    applyShow();
    if (c.dataset.show === 'media') interior.children.forEach(o => {
      if (o.userData && o.userData.kind === 'led') o.visible = SHOW.media;
    });
  });
  const q = id => document.getElementById(id);
  if (q('open-2d')) q('open-2d').onclick = open2D;
  if (q('open-board')) q('open-board').onclick = () => openBoard('media');
  if (q('open-journey')) q('open-journey').onclick = startJourney;
  if (q('csv')) q('csv').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const n = parseTicketsCSV(rd.result);
      buildSnapshot(); repaintSeats(); renderPanel();
      toast('実測データ <b>' + n + '行</b> を反映しました（区画別販売率を上書き）', 3600);
    };
    rd.readAsText(f);
  };
}

/* ================= 個客カード ================= */
const fanCard = document.getElementById('fan-card');
const hideFanCard = () => { fanCard.style.display = 'none'; selSeat = -1; };
let selSeat = -1;

function showFanCard(i) {
  selSeat = i;
  const s = SEAT.list[i], f = fanAt(i), sold = SNAP.sold[i];
  const seg = SEGMENTS[f.seg];
  const tb = topBoards(i, 4);
  const gradeName = ['圏外', 'D', 'C', 'B', 'A'];
  if (!sold) {
    fanCard.innerHTML = '<div class="fc-hd"><div><div class="fc-id">空席</div>' +
      '<div class="fc-seat">' + seatLabel(i) + '</div></div>' +
      '<button class="fc-x" id="fc-x">✕</button></div>' +
      '<div style="font-size:11px;color:var(--sub);margin-top:8px">' + CAT[s.cat].name +
      '　定価 ' + usd(CAT[s.cat].price) + ' → 推奨 <b style="color:var(--gold)">' + usd(s.rec) + '</b>' +
      '<br>区画販売率 ' + (SNAP.occ[i] * 100).toFixed(0) + '%　露出スコア ' + (s.exp * 100).toFixed(0) + 'pt</div>' +
      '<div class="fc-nba"><div class="h">NEXT BEST ACTION</div>' +
      '<div class="b">未販売。近接区画の高LTV層へ<b>アップグレード枠</b>として提示、' +
      'または当日ダイナミックプライシング対象。</div></div>';
  } else {
    fanCard.innerHTML =
      '<div class="fc-hd"><div><div class="fc-id">' + f.fid + '</div>' +
      '<div class="fc-seat">' + seatLabel(i) + '　' + CAT[s.cat].name + '</div></div>' +
      '<button class="fc-x" id="fc-x">✕</button></div>' +
      '<div>' +
        '<span class="fc-badge" style="background:' + hex(seg.color) + '22;color:' + hex(seg.color) +
        ';border:1px solid ' + hex(seg.color) + '">' + seg.name + '</span>' +
        '<span class="fc-badge" style="background:' + hex(f.reg.col) + '22;color:' + hex(f.reg.col) +
        ';border:1px solid ' + hex(f.reg.col) + '">' + f.reg.n + '</span>' +
        '<span class="fc-badge" style="background:#ffffff10;color:var(--sub);border:1px solid var(--line)">' +
        f.age + '</span>' +
        (f.app ? '<span class="fc-badge" style="background:#00c2ff22;color:var(--acc);border:1px solid var(--acc)">APP</span>' : '') +
      '</div>' +
      '<div class="fc-kpi">' +
        '<div><div class="v">' + usd(f.ltv) + '</div><div class="l">LTV</div></div>' +
        '<div><div class="v">' + f.gamesLtm + '</div><div class="l">来場 / 直近1年</div></div>' +
        '<div><div class="v">' + f.tenure + '<span style="font-size:10px">y</span></div><div class="l">継続年数</div></div>' +
      '</div>' +
      '<div class="sec-t" style="margin-top:4px">今回の取引</div>' +
      '<div style="font-size:11px;color:var(--sub);line-height:1.7">' +
        '定価 ' + usd(f.face) + ' → 実売 <b style="color:var(--txt)">' + usd(f.paid) + '</b>' +
        '（' + ((f.paid / f.face - 1) * 100).toFixed(0) + '%）<br>' +
        '入場 ' + clockStr(f.arrival) + '　' + f.gate + '<br>' +
        '場内購買 F&B ' + usd(f.fb) + ' / グッズ ' + usd(f.merch) +
      '</div>' +
      '<div class="sec-t" style="margin-top:9px">RFM</div>' +
      bar('R 直近性', f.rfmR, 5, '#00c2ff') + bar('F 頻度', f.rfmF, 5, '#3ddc84') +
      bar('M 金額', f.rfmM, 5, '#fdb927') +
      '<div class="sec-t" style="margin-top:9px">離反リスク</div>' +
      '<div class="bar-row"><span>更新見込</span><div class="bar"><i style="width:' +
      ((1 - f.churn) * 100).toFixed(0) + '%;background:' +
      (f.churn > 0.55 ? '#ff5b4d' : f.churn > 0.3 ? '#fdb927' : '#3ddc84') + '"></i></div>' +
      '<b>' + ((1 - f.churn) * 100).toFixed(0) + '%</b></div>' +
      '<div class="sec-t" style="margin-top:9px">この席から見えるスポンサー媒体</div>' +
      (tb.length ? tb.map(x =>
        '<div class="bar-row"><span title="' + x.b.name + '">' + x.b.name + '</span>' +
        '<div class="bar"><i style="width:' + (x.w * 100).toFixed(0) + '%;background:' +
        hex(GRADE_C[x.g]) + '"></i></div><b>' + gradeName[x.g] + '</b></div>').join('')
        : '<div style="font-size:10px;color:var(--sub)">有効な視認媒体なし</div>') +
      '<div class="fc-nba"><div class="h">NEXT BEST ACTION</div>' +
      '<div class="b">' + f.nba.t + '<br><span style="color:var(--sub);font-size:10.5px">' +
      f.nba.d(f.seg) + '</span></div>' +
      '<div class="u">期待CVR上振れ +' + (f.nba.up * 100).toFixed(0) + '%　' +
      '想定増分 ' + usd(Math.round(f.ltv * f.nba.up * 0.16)) + ' / 人</div></div>';
  }
  fanCard.style.display = 'block';
  const x = document.getElementById('fc-x');
  if (x) x.onclick = hideFanCard;
  if (typeof draw2D === 'function') draw2D();
}

/* ================= タイムライン ================= */
(function timeline() {
  const track = document.getElementById('tl-track');
  const fill = track.querySelector('.fill'), knob = track.querySelector('.knob');
  const clock = document.getElementById('tl-clock'), ph = document.getElementById('tl-phase');
  const play = document.getElementById('tl-play');
  for (const p of PHASES) {
    const d = document.createElement('div');
    d.className = 'ph'; d.textContent = p[1];
    d.style.left = ((p[0] - T0) / (T1 - T0) * 100) + '%';
    track.appendChild(d);
  }
  window.onTick = function () {
    const u = (timeState.min - T0) / (T1 - T0);
    fill.style.width = (u * 100) + '%';
    knob.style.left = (u * 100) + '%';
    clock.textContent = clockStr(timeState.min);
    ph.textContent = phaseAt(timeState.min);
    if (level === 'arena' && seatMode === 'crowd') repaintSeats();
    paintScore(gameState());
  };
  play.onclick = () => { timeState.play = !timeState.play; play.textContent = timeState.play ? '❚❚' : '▶'; };
  const seek = e => {
    const r = track.getBoundingClientRect();
    timeState.min = T0 + clamp((e.clientX - r.left) / r.width, 0, 1) * (T1 - T0);
    onTick();
  };
  track.onpointerdown = e => { seek(e); track.setPointerCapture(e.pointerId); track.onpointermove = seek; };
  track.onpointerup = () => { track.onpointermove = null; };
})();

/* 試合状況（スコアボード表示用） */
function gameState() {
  const m = timeState.min, G = GAMES[curGame];
  if (m < 19 * 60 + 30) return { away: G.away || 'GUEST', aScore: 0, hScore: 0, label: G.fmt === 'CONCERT' ? 'DOORS OPEN' : 'TIP-OFF 7:30', live: false, clock: '' };
  if (m > 22 * 60) return { away: G.away || 'GUEST', aScore: 108, hScore: 116, label: 'FINAL', live: false, clock: '' };
  const p = (m - (19 * 60 + 30)) / 150;
  const q = clamp(Math.ceil(p * 4), 1, 4);
  return { away: G.away || 'GUEST', aScore: Math.round(108 * p), hScore: Math.round(116 * p),
           label: 'Q' + q, live: true, clock: String(11 - Math.floor((p * 4 % 1) * 11)).padStart(2, '0') + ':' + String(Math.floor(hrand(Math.floor(m), 5) * 59)).padStart(2, '0') };
}
