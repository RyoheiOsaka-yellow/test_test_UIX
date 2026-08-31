
/* ================================================================
   左パネル — アイコン主体 / 全セクション折りたたみ可 / チャート内蔵
================================================================ */
const pb = document.getElementById('panel-body');
document.getElementById('panel-fold').innerHTML = ic('chev', 15);
document.getElementById('panel-fold').onclick = () => setRail(true);

/* レイヤーはアイコン + 短いラベルのグリッドで選ぶ */
const SEAT_MODES = [
  ['crowd', '観客', 'users', '在館率カーブに連動した実人数'],
  ['seg', 'セグメント', 'tag', 'シーズン券/単券/二次流通/州外'],
  ['od', '来場OD', 'route', 'どの出発地・手段から来た席か'],
  ['segment', '抽出', 'target', 'セグメントビルダーの条件に合う席'],
  ['journey', '接触本数', 'bolt', '当たっているジャーニー本数と発火'],
  ['ltv', 'LTV', 'gem', '個客生涯価値'],
  ['churn', '離反', 'alert', '更新確率が低い層'],
  ['occ', '販売率', 'chart', '区画×列の販売率'],
  ['cat', '席種', 'ticket', '価格カテゴリ'],
  ['exp', '露出', 'eye', '媒体別の実効露出重み'],
  ['grade', '視認等級', 'badge', '文字視角による A〜D 判定'],
  ['price', '価格', 'dollar', '現行 vs 推奨価格の乖離'],
];
const VIEW_MODES = [['solid', 'solid', 'SOLID 実体'], ['point', 'points', 'POINT 点描'],
                    ['wire', 'wire', 'WIRE 線画'], ['blueprint', 'blue', 'BLUEPRINT 青焼き']];

const bar = (label, v, max, col) =>
  '<div class="bar-row"><span title="' + label + '">' + label + '</span>' +
  '<div class="bar"><i style="width:' + clamp(v / (max || 1) * 100, 0, 100).toFixed(1) +
  '%;background:' + col + '"></i></div><b>' + fmt(v) + '</b></div>';
function kpiCard(v, l, cls) {
  return '<div class="kpi"><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div>' +
         '<div class="l">' + l + '</div></div>';
}
/* アイコンボタン列 */
const ibar = (attr, list, cur) => '<div class="ibar">' + list.map(x =>
  '<button class="ib' + ((Array.isArray(cur) ? cur.indexOf(x[0]) >= 0 : cur === x[0]) ? ' active' : '') +
  '" ' + attr + '="' + x[0] + '" data-tip="' + x[2] + '">' + ic(x[1], 16) + '</button>').join('') + '</div>';
const ibarT = (attr, list, cur) => '<div class="ibar">' + list.map(x =>
  '<button class="ib wide' + ((Array.isArray(cur) ? cur.indexOf(x[0]) >= 0 : cur === x[0]) ? ' active' : '') +
  '" ' + attr + '="' + x[0] + '"' + (x[3] ? ' data-tip="' + x[3] + '"' : '') + '>' +
  (x[1] ? ic(x[1], 14) : '') + x[2] + '</button>').join('') + '</div>';

const PANEL_TITLE = { site: 'L0 SITE — DOWNTOWN LA', plaza: 'L1 PLAZA — FIGUEROA',
                      arena: 'L2 BOWL — 19,079 SEATS' };
function renderPanel() {
  document.getElementById('panel-title').textContent = PANEL_TITLE[level] || '';
  if (level === 'arena') renderArenaPanel();
  else if (level === 'plaza') renderPlazaPanel();
  else renderSitePanel();
  bindSections(pb);
  flushViz();
}

/* ---------------- L0 ---------------- */
function renderSitePanel() {
  const st = SCENE_DATA;
  const roadByClass = [0, 1, 2, 3, 4].map(c => ({
    label: ['生活道路', '補助幹線', '幹線(2級)', '幹線(1級)', 'フリーウェイ'][c],
    value: st.roads.filter(r => r.c === c).length, color: VIZ.ser[[2, 0, 4, 1, 3][c]] }));
  const clsCount = [0, 0, 0, 0, 0];
  if (PCD.cls) for (let i = 0; i < PCD.cls.length; i += 7) clsCount[PCD.cls[i]] += 7;

  /* 到着 / 退場カーブ（人流の時間分布） */
  const curveX = [], arr = [], eg = [];
  for (let m = T0; m <= T1; m += 15) {
    curveX.push(clockStr(m));
    arr.push(Math.round(arrivalRate(m) * (AGG.kpi.sold || 16000) * 0.09));
    eg.push(Math.round(egressRate(m) * (AGG.kpi.sold || 16000) * 0.11));
  }

  pb.innerHTML =
    sec('ui-view', 'layers', '表示モード',
      ibar('data-vm', VIEW_MODES, viewMode) +
      (viewMode === 'point' ?
        '<div class="ibar" style="margin-top:6px">' +
        [['class', '分類'], ['height', '高さ'], ['intensity', '反射強度']].map(m =>
          '<button class="ib wide' + (pcColorMode === m[0] ? ' active' : '') +
          '" data-pcm="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' : '') +
      '<div class="hint" style="margin-top:7px">実体 / <b>点描</b> / 線画 / <b>青焼き</b>。' +
      '見せたい相手に応じた表現で提示できます。</div>') +

    (viewMode === 'point' ? sec('ui-pc', 'points', '点群ツール',
      '<div class="sec-t">クラス表示</div>' +
      PC_CLASS_NAME.map((n, i) =>
        '<label class="ck-row"><input type="checkbox" data-pck="' + i + '"' +
        (PCTOOL.mask[i] ? ' checked' : '') + '>' +
        '<span style="width:9px;height:9px;border-radius:2px;display:inline-block;background:' +
        hex(PC_CLASS_COL[i]) + '"></span>' + n + '</label>').join('') +
      vizCanvas({ type: 'donut', h: 132, legendRight: true,
        slices: PC_CLASS_NAME.map((n, i) => ({ label: n, value: clsCount[i],
          color: VIZ.ser[i % VIZ.ser.length] })),
        center: { v: (siteStats.points / 1e6).toFixed(2) + 'M', l: '点' },
        vFmt: v => fmt(v) + ' 点' }, 132) +
      '<div class="sec-t" style="margin-top:8px">点サイズ <b style="color:var(--acc)">' +
      PCTOOL.size.toFixed(1) + '</b></div>' +
      '<input type="range" id="pcsize" min="0.6" max="6" step="0.2" value="' + PCTOOL.size +
      '" style="width:100%;accent-color:var(--acc)">' +
      '<div class="sec-t" style="margin-top:8px">断面</div>' +
      ibarT('data-pcc', [['off', '', 'OFF'], ['x', 'cut', 'X'], ['z', 'cut', 'Z'],
                         ['y', 'cut', '水平']], PCTOOL.clipAxis) +
      (PCTOOL.clipAxis !== 'off' ?
        '<input type="range" id="pcclippos" min="' + (PCTOOL.clipAxis === 'y' ? 0 : -2000) +
        '" max="' + (PCTOOL.clipAxis === 'y' ? 340 : 2000) + '" step="10" value="' + PCTOOL.clipPos +
        '" style="width:100%;margin-top:6px;accent-color:var(--acc)">' +
        '<div class="hint" style="margin-top:5px">切断位置 <b>' + fmt(PCTOOL.clipPos) +
        ' m</b>（アリーナ中心基準）</div>' : '') +
      '<div class="ibar" style="margin-top:8px">' +
      '<button class="ib' + (pcTools.measure ? ' active' : '') + '" id="pcmeasure" ' +
        'data-tip="2点クリックで実距離を計測">' + ic('ruler', 16) + '</button>' +
      '<button class="ib" id="pcreveal" data-tip="点が読み込まれる演出を再生">' +
        ic('play', 16) + '</button></div>') : '') +

    sec('ui-stat', 'chart', 'サイト構成', 
      '<div class="kpi-grid">' +
        kpiCard(fmt(st.buildings.length), '近景 建物') +
        kpiCard(fmt(st.mid.length + st.dots.length / 2), '中〜遠景 建物') +
        kpiCard(fmt(st.roads.length), '道路セグメント') +
        kpiCard(fmt(siteStats.points), '点描ポイント') +
      '</div>' +
      '<div class="sec-t" style="margin-top:9px">道路クラス別 本数</div>' +
      vizCanvas({ type: 'hbars', rows: roadByClass, rowH: 20, labW: 96, valW: 52 })) +

    sec('ui-infra', 'train', '交通インフラ',
      '<div class="legend">' +
        '<div class="li"><div class="sw" style="background:#a08a56"></div>フリーウェイ I-110 / I-10</div>' +
        '<div class="li"><div class="sw" style="background:#5c6f9b"></div>幹線 Figueroa / Olympic / Pico</div>' +
        '<div class="li"><div class="sw" style="background:#0072ce"></div>Metro A Line</div>' +
        '<div class="li"><div class="sw" style="background:#fdb913"></div>Metro E Line</div>' +
        '<div class="li"><div class="sw" style="background:#e4002b"></div>Metro B Line（地下）</div>' +
        '<div class="li"><div class="sw" style="background:#a05da5"></div>Metro D Line（地下）</div>' +
      '</div>' +
      '<div class="sec-t" style="margin-top:9px">構造別 セグメント数</div>' +
      vizCanvas({ type: 'hbars', rowH: 20, labW: 78, valW: 52, rows: [
        { label: '地上', value: st.roads.filter(r => !r.b).length, color: VIZ.ser[0] },
        { label: '橋梁・高架', value: st.roads.filter(r => r.b === 1).length, color: VIZ.ser[1] },
        { label: 'トンネル', value: st.roads.filter(r => r.b === -1).length, color: VIZ.ser[4] },
      ] }) +
      '<div class="hint" style="margin-top:6px">最寄 <b>Pico 駅</b>（A/E Line）は 280m。' +
      'OSM の bridge/tunnel/layer から高架・地下を作り分けています。</div>') +

    sec('ui-flow', 'route', '移動経路',
      '<div class="ibar">' +
      '<button class="ib wide' + (flowState.on ? ' active' : '') + '" id="tg-flow">' +
        ic('users', 14) + '人流</button>' +
      '<button class="ib wide' + (routeLines.visible ? ' active' : '') + '" id="tg-route">' +
        ic('route', 14) + '経路</button></div>' +
      '<div class="sec-t" style="margin-top:8px">出発地（経路長）</div>' +
      vizCanvas({ type: 'hbars', rowH: 20, labW: 132, valW: 54, vFmt: v => fmt(v) + 'm',
        rows: ORIGINS.map(o => ({ label: o.name.replace(/（.*/, ''), value: Math.round(o.route.total),
          color: hex(o.col), sub: o.mode + ' ／ ' + o.gateName })) }) +
      '<div class="sec-t" style="margin-top:9px">到着・退場の時間分布</div>' +
      vizCanvas({ type: 'line', h: 128, area: true, x: curveX, padL: 40, xTicks: 5,
        series: [{ name: '到着', data: arr, color: VIZ.ser[0] },
                 { name: '退場', data: eg, color: VIZ.ser[3] }],
        tipFmt: v => fmt(v) + ' 人/15分' }, 128) +
      '<div class="kpi-grid" style="margin-top:8px">' +
        kpiCard(fmt(flowState.arrived), '到着済み', 'k') +
        kpiCard(fmt(flowState.inArena), '在館', 'g') +
        kpiCard(fmt(flowState.left), '退場済み') +
        kpiCard(usd(flowState.spendTotal), '場外消費', 'p') +
      '</div>' +
      '<div class="hint" style="margin-top:6px">道路グラフ <b>' + fmt(roadGraph.size) +
      ' ノード</b>に A*。球は<b>1体 ≒ ' + fmt(flowState.perAgent) + ' 人</b>のサンプルです。</div>',
      { badge: fmt(ORIGINS.length) + ' 起点' }) +

    sec('ui-heat', 'gauge', '賑わいヒートマップ',
      ibarT('data-hm', [['none', '', 'OFF'], ['base', '', '通常日'], ['game', '', '試合日'],
                        ['delta', '', 'アリーナ寄与']],
        siteLayer === 'heat' ? HEAT.mode : 'none') +
      (siteLayer === 'heat' ? '<div class="grad-bar" style="margin-top:7px"></div>' +
        '<div class="grad-lbl"><span>低</span><span>高</span></div>' +
        '<div class="hint" style="margin-top:6px">通常日の素の賑わいに来場/回遊の経路沿い上乗せを重ねたもの。' +
        '<b>アリーナ寄与＝差分</b>で、どの通りにどれだけ人を落としているかを見ます。</div>' : '')) +

    sec('ui-od', 'target', 'OD分析',
      ibarT('data-od', [['off', '', 'OFF'], ['auto', 'clock', '時間連動'], ['arr', '', '到着'],
                        ['dep', '', '退場'], ['both', '', '両方']],
        siteLayer === 'od' ? KDE.mode : 'off') +
      (siteLayer === 'od' ?
        '<div class="ibar" style="margin-top:6px">' + [0.7, 1.0, 1.4].map(b =>
          '<button class="ib wide' + (KDE.bw === b ? ' active' : '') + '" data-bw="' + b +
          '">σ×' + b.toFixed(1) + '</button>').join('') + '</div>' +
        '<div class="sec-t" style="margin-top:9px">退場後の回遊先</div>' +
        vizCanvas({ type: 'donut', h: 150, legendRight: true, vFmt: v => fmt(v) + ' 人',
          slices: DISPERSAL.map((d, i) => ({ label: d.name.replace(/（.*/, ''),
            value: Math.round((AGG.kpi.sold || 0) * d.share), color: VIZ.ser[i % VIZ.ser.length] })),
          center: { v: usd(DISPERSAL.reduce((a, d) => a + (AGG.kpi.sold || 0) * d.share * d.spend, 0)),
                    l: '場外消費 / 興行' } }, 150) : '') +
      '<button class="tool-btn" id="open-od" style="margin-top:8px">' + ic('chart', 14) +
      ' OD分析ボードを開く</button>') +

    sec('ui-iso', 'clock', '到達圏（等時線）',
      ibarT('data-iso', [['off', '', 'OFF'], ['drive', 'car', '車'], ['walk', 'walk', '徒歩']],
        siteLayer === 'iso' ? ISO.mode : 'off') +
      (siteLayer === 'iso' && ISO.built ?
        vizCanvas({ type: 'hbars', rowH: 20, labW: 60, valW: 58, vFmt: v => v.toFixed(1) + 'km',
          rows: ISO.bands.map((b, i) => ({ label: '〜' + b + '分', value: ISO.stats.km[i],
            color: hex(ISO_COL[i]), sub: fmt(ISO.stats.bld[i]) + ' 棟' })) }) +
        '<div class="hint" style="margin-top:6px">道路グラフ上の Dijkstra。' +
        '建物棟数は圏内の<b>受け皿規模</b>の代理指標です。</div>' : '')) +

    sec('ui-poi', 'tag', 'POI',
      '<div class="legend">' + SCENE_DATA.pois.slice(0, 10).map(p =>
        '<div class="li"><div class="sw" style="background:' + hex(POI_COL[p.c] || 0x8590a8) +
        '"></div>' + p.n + '</div>').join('') + '</div>') +

    '<button class="tool-btn" id="go-arena">' + ic('bowl', 14) +
    ' L2 ボウル内部へ（19,079席の1to1分析）</button>';

  const q = id => document.getElementById(id);
  pb.querySelectorAll('[data-vm]').forEach(b => b.onclick = () => setViewMode(b.dataset.vm));
  pb.querySelectorAll('[data-pcm]').forEach(b => b.onclick = () => setPointColorMode(b.dataset.pcm));
  pb.querySelectorAll('[data-pck]').forEach(c => c.onchange = () => {
    PCTOOL.mask[+c.dataset.pck] = c.checked ? 1 : 0; pcApply();
  });
  pb.querySelectorAll('[data-pcc]').forEach(b => b.onclick = () => {
    PCTOOL.clipAxis = b.dataset.pcc;
    PCTOOL.clipPos = PCTOOL.clipAxis === 'y' ? 120 : 0;
    pcApply(); renderPanel();
  });
  if (q('pcsize')) q('pcsize').oninput = e => { PCTOOL.size = +e.target.value; pcApply(); };
  if (q('pcclippos')) q('pcclippos').oninput = e => { PCTOOL.clipPos = +e.target.value; pcApply(); };
  if (q('pcmeasure')) q('pcmeasure').onclick = () => { setMeasure(!pcTools.measure); renderPanel(); };
  if (q('pcreveal')) q('pcreveal').onclick = () => startReveal();
  if (q('tg-flow')) q('tg-flow').onclick = () => { flowState.on = !flowState.on; renderPanel(); };
  if (q('tg-route')) q('tg-route').onclick = () => { routeLines.visible = !routeLines.visible; renderPanel(); };
  pb.querySelectorAll('[data-hm]').forEach(b => b.onclick = () => setSiteLayer('heat', b.dataset.hm));
  pb.querySelectorAll('[data-od]').forEach(b => b.onclick = () => setSiteLayer('od', b.dataset.od));
  pb.querySelectorAll('[data-iso]').forEach(b => b.onclick = () => setSiteLayer('iso', b.dataset.iso));
  pb.querySelectorAll('[data-bw]').forEach(b => b.onclick = () => {
    KDE.bw = +b.dataset.bw; updateKDE(); renderPanel();
  });
  if (q('open-od')) q('open-od').onclick = () => openBoard('od');
  if (q('go-arena')) q('go-arena').onclick = () => setLevel('arena', true);
}

/* ---------------- L1 ---------------- */
function renderPlazaPanel() {
  const k = AGG.kpi;
  const gateRows = Object.entries(AGG.gate || {}).sort((a, b) => b[1] - a[1])
    .map((g, i) => ({ label: g[0].replace(/ \(.*/, ''), value: g[1], color: VIZ.ser[i % VIZ.ser.length],
                      sub: g[0] }));
  pb.innerHTML =
    sec('ui-plz', 'plaza', 'エントランス広場',
      '<div class="kpi-grid">' +
        kpiCard(String(GATES.length), '入場ゲート') +
        kpiCard('25', 'ターンスタイル') +
        kpiCard(fmt(k.sold || 0), '本日 入場者', 'g') +
        kpiCard(clockStr(timeState.min), '現在時刻', 'k') +
      '</div>' +
      '<div class="hint" style="margin-top:7px">アリーナ200m圏の粗いOSMマスは非表示になり、' +
      'カーテンウォール・キャノピー・ゲートの詳細モデルに差し替わります。</div>') +

    sec('ui-gate', 'ticket', 'ゲート別 入場',
      vizCanvas({ type: 'hbars', rowH: 21, labW: 108, valW: 58,
        rows: gateRows.length ? gateRows : [{ label: '—', value: 0 }] }) +
      '<div class="hint" style="margin-top:6px">ターンスタイル通過で <b>fan_id × 入場時刻 × ゲート</b> を取得。' +
      'ジャーニー分析の起点になります。</div>') +

    sec('ui-bim', 'layers', 'BIM 要素',
      '<div class="hint">カーテンウォール（ユニット式 Low-E複層）・キャノピー・マリオン・' +
      'サイネージ・ターンスタイル・植栽を部材単位で保持。<b>クリックで IFC風属性</b>を表示します。</div>') +

    '<button class="tool-btn" id="go-arena2">' + ic('bowl', 14) + ' L2 ボウル内部へ</button>';
  const g = document.getElementById('go-arena2');
  if (g) g.onclick = () => setLevel('arena', true);
}

/* ---------------- L2 ---------------- */
function renderArenaPanel() {
  const k = AGG.kpi, G = GAMES[curGame];
  const segRows = Object.keys(SEGMENTS).filter(s => AGG.seg[s])
    .sort((a, b) => AGG.seg[b] - AGG.seg[a])
    .map((s, i) => ({ label: SEGMENTS[s].name, value: AGG.seg[s], color: VIZ.ser[i % VIZ.ser.length] }));
  const regRows = REGIONS.map((r, i) => ({ label: r.n, value: AGG.reg[r.n] || 0,
    color: VIZ.ser[i % VIZ.ser.length] })).sort((a, b) => b.value - a.value);
  /* ティア別 収益 */
  const tierRev = {};
  for (let i = 0; i < SEAT.list.length; i++) {
    if (!SNAP.sold[i]) continue;
    const s = SEAT.list[i];
    tierRev[s.tier] = (tierRev[s.tier] || 0) + fanAt(i).paid;
  }
  const TIER_JA = { FLOOR: 'フロア', L100: '100 Level', PRM: 'Premier', SUITE: 'Box', L300: '300 Level' };
  const tierRows = Object.keys(tierRev).sort((a, b) => tierRev[b] - tierRev[a])
    .map((t, i) => ({ label: TIER_JA[t] || t, value: Math.round(tierRev[t]),
      color: VIZ.ser[i % VIZ.ser.length] }));
  /* 価格係数のヒストグラム */
  const hist = new Array(10).fill(0);
  for (const s of SEAT.list) hist[clamp(Math.floor(((s.pf || 1) - 0.82) / 0.5 * 10), 0, 9)]++;

  pb.innerHTML =
    sec('ui-game', 'ticket', '興行',
      '<div class="ibar">' + Object.keys(GAMES).map(g =>
        '<button class="ib wide' + (curGame === g ? ' active' : '') + '" data-gm="' + g +
        '" data-tip="' + GAMES[g].name + ' ' + GAMES[g].date + '">' +
        GAMES[g].name.replace('vs ', '').replace(' (Sold Out)', '').slice(0, 16) +
        '</button>').join('') + '</div>' +
      '<div class="hint" style="margin-top:6px">' + G.name + '　' + G.date +
      '　<b>' + G.fmt + '</b> 構成</div>', { badge: G.fmt }) +

    sec('ui-kpi', 'chart', 'KPI',
      '<div class="kpi-grid">' +
        kpiCard((k.occ * 100).toFixed(1) + '<small>%</small>', '販売率') +
        kpiCard(fmt(k.sold), '販売席数', 'k') +
        kpiCard(usd(k.rev), 'チケット収益', 'g') +
        kpiCard(usd(k.avg), '平均単価', 'g') +
        kpiCard(usd(k.fbTotal), '場内購買 推計') +
        kpiCard(usd(k.mediaValue), '媒体デリバリー', 'p') +
      '</div>' +
      vizCanvas({ type: 'donut', h: 150, legendRight: true, vFmt: v => fmt(v) + ' 席',
        slices: [{ label: '販売済', value: k.sold, color: VIZ.ser[0] },
                 { label: '空席', value: k.cap - k.sold, color: '#2a3346' }],
        center: { v: (k.occ * 100).toFixed(1) + '%', l: '販売率' } }, 150) +
      '<div class="sec-t" style="margin-top:8px">ティア別 チケット収益</div>' +
      vizCanvas({ type: 'hbars', rowH: 20, labW: 84, valW: 74, vFmt: usd, rows: tierRows }),
      { badge: fmt(k.cap) + '席' }) +

    sec('ui-map', 'target', '席マッピング',
      '<button class="tool-btn" id="rv-play">' + ic('play', 14) + ' 席マッピングを再生</button>' +
      '<div class="hint" style="margin-top:6px">コート中心から外周・上層へ掃引しながら、' +
      '1席ずつ生成して個客レコードに紐づけます。<br>紐付け済み <b id="rv-count">' +
      fmt(Math.round(clamp(seatReveal.prog, 0, 1) * SEAT.list.length)) + '</b> / ' +
      fmt(SEAT.list.length) + ' 席</div>') +

    sec('ui-layer', 'layers', '座席レイヤー',
      '<div class="lgrid">' + SEAT_MODES.map(m =>
        '<button class="lg' + (seatMode === m[0] ? ' active' : '') + '" data-sm="' + m[0] +
        '" data-tip="' + m[3] + '">' + ic(m[2], 17) + '<span>' + m[1] + '</span></button>').join('') +
      '</div>' +
      ((seatMode === 'exp' || seatMode === 'grade') ?
        '<div class="sec-t" style="margin-top:8px">対象媒体</div>' +
        '<div class="row-btns">' +
        '<button class="chip sm' + (expBoard < 0 ? ' active' : '') + '" data-bd="-1">全媒体</button>' +
        ledBoards.map((b, i) => '<button class="chip sm' + (expBoard === i ? ' active' : '') +
          '" data-bd="' + i + '">' + b.name + '</button>').join('') + '</div>' +
        (seatMode === 'grade' ? '<div class="legend" style="margin-top:7px">' +
          ['圏外', 'D 視認困難', 'C 判読可', 'B 良好', 'A 最良'].map((n, i) =>
            '<div class="li"><div class="sw" style="background:' + hex(GRADE_C[i]) + '"></div>' +
            n + '</div>').join('') + '</div>' :
          '<div class="grad-bar" style="margin-top:7px"></div>' +
          '<div class="grad-lbl"><span>低露出</span><span>高露出</span></div>') : '') +
      (seatMode === 'od' ?
        '<div class="sec-t" style="margin-top:8px">出発地で絞り込む</div>' +
        '<div class="row-btns">' +
        '<button class="chip sm' + (odFocus < 0 ? ' active' : '') + '" data-odf="-1">全出発地</button>' +
        AGG.od.map((m, i) => '<button class="chip sm' + (odFocus === i ? ' active' : '') +
          '" data-odf="' + i + '">' + m.o.name.replace(/（.*/, '').slice(0, 12) + '</button>').join('') +
        '</div>' +
        (odFocus >= 0 ? vizCanvas({ type: 'hbars', rowH: 19, labW: 74, valW: 48,
          rows: ['FLOOR', 'L100', 'PRM', 'SUITE', 'L300'].map((t, i) =>
            ({ label: TIER_JA[t], value: AGG.od[odFocus].tier[t] || 0, color: VIZ.ser[i] })) }) : '')
        : '') +
      ((seatMode === 'ltv' || seatMode === 'churn' || seatMode === 'occ') ?
        '<div class="grad-bar" style="margin-top:8px"></div><div class="grad-lbl"><span>' +
        (seatMode === 'churn' ? '低リスク' : '低') + '</span><span>' +
        (seatMode === 'churn' ? '高リスク' : '高') + '</span></div>' : '')) +

    sec('ui-seg', 'tag', 'セグメント構成',
      vizCanvas({ type: 'donut', h: 158, legendRight: true, vFmt: v => fmt(v) + ' 人',
        slices: segRows, center: { v: fmt(k.sold), l: '販売席' } }, 158)) +

    sec('ui-reg', 'route', '商圏（来場元）',
      vizCanvas({ type: 'hbars', rowH: 20, labW: 118, valW: 52, rows: regRows })) +

    sec('ui-price', 'dollar', '価格最適化',
      '<div class="kpi-grid">' +
        kpiCard(usd(AGG.price.cur), '現行 定価ベース') +
        kpiCard(usd(AGG.price.opt), '推奨価格ベース', 'g') +
      '</div>' +
      '<div class="sec-t" style="margin-top:8px">価格係数の分布</div>' +
      vizCanvas({ type: 'bars', h: 118, padL: 40, xTicks: 5,
        x: hist.map((_, i) => (0.82 + i * 0.05).toFixed(2)),
        series: [{ name: '席数', data: hist, color: VIZ.ser[0] }], legend: false,
        tipFmt: v => fmt(v) + ' 席' }, 118) +
      '<div class="hint" style="margin-top:6px">f = 0.74 + 0.40×区画販売率 + 0.12×露出 + 0.08×需要弾性。' +
      '差分 <b>' + usd(AGG.price.opt - AGG.price.cur) + '</b>（' +
      ((AGG.price.opt / Math.max(1, AGG.price.cur) - 1) * 100).toFixed(1) + '%）</div>') +

    sec('ui-indoor', 'users', '場内動線',
      '<div class="ibar">' +
      '<button class="ib wide' + (indoorState.on ? ' active' : '') + '" id="tg-in">' +
        ic('users', 14) + '人流</button>' +
      '<button class="ib wide' + (indoorState.showCong ? ' active' : '') + '" id="tg-cong">' +
        ic('gauge', 14) + '混雑度</button>' +
      '<button class="ib wide' + (pcMode ? ' active' : '') + '" id="tg-pc">' +
        ic('points', 14) + '点群</button></div>' +
      '<div class="kpi-grid" style="margin-top:7px">' +
        kpiCard(fmt(inMesh.count * indoorState.perAgent), 'コンコース滞留', 'k') +
        kpiCard(fmt(STANDS.length), '売店 / POS地点') +
        kpiCard(fmt(STANDS.reduce((a, s) => a + s.served, 0)), 'レジ通過') +
        kpiCard(usd(indoorState.posRev), '場内POS 売上', 'g') +
      '</div>' +
      (indoorState.showCong ? '<div class="grad-bar" style="margin-top:7px"></div>' +
        '<div class="grad-lbl"><span>閑散</span><span>LOS E 1.8人/m²</span></div>' : '')) +

    sec('ui-bim', 'plaza', 'BIM 表示',
      ['roof:屋根スラブ', 'truss:トラス/キャットウォーク', 'structure:段床・柱・手すり',
       'suites:Premier Box', 'media:スポンサー媒体'].map(x => {
        const [key, n] = x.split(':');
        return '<label class="ck-row"><input type="checkbox" data-show="' + key + '"' +
          (SHOW[key] ? ' checked' : '') + '>' + n + '</label>';
      }).join('') +
      (function () {
        const T = bimTypes();
        return '<div class="sec-t" style="margin-top:8px">要素ブラウザ（' + fmt(BIM_ELEMS.length) +
          ' 部材 / ' + Object.keys(T).length + ' 種別）</div>' +
          '<div class="row-btns">' + Object.keys(T).sort().map(kk =>
            '<button class="chip sm' + (bimBrowse.type === kk ? ' active' : '') + '" data-bt2="' + kk +
            '" data-tip="' + (T[kk][0].userData.attrs['部材種別'] ||
              T[kk][0].userData.attrs['用途'] || '') + '">' + kk.replace('Ifc', '') +
            ' ' + T[kk].length + '</button>').join('') + '</div>' +
          (bimBrowse.type ? '<div class="row-btns" style="margin-top:6px">' +
            T[bimBrowse.type].slice(0, 24).map(e =>
              '<button class="chip sm" data-bel="' + BIM_ELEMS.indexOf(e) + '">' +
              e.userData.tag + '</button>').join('') + '</div>' : '');
      })()) +

    sec('ui-tool', 'filter', 'ツール',
      '<button class="tool-btn" id="open-auto" style="margin-bottom:5px">' + ic('bolt', 14) +
        ' オートメーション・コンソール</button>' +
      '<button class="tool-btn" id="open-seg" style="margin-bottom:5px">' + ic('target', 14) +
        ' セグメントビルダー & 試算</button>' +
      '<button class="tool-btn" id="open-2d" style="margin-bottom:5px">' + ic('map2d', 14) +
        ' 2D 席図</button>' +
      '<button class="tool-btn" id="open-board" style="margin-bottom:5px">' + ic('chart', 14) +
        ' 分析ボード</button>' +
      '<button class="tool-btn" id="open-journey" style="margin-bottom:5px">' + ic('walk', 14) +
        ' 個客ジャーニー再生</button>' +
      '<label class="tool-btn" style="display:block;text-align:center">' + ic('csv', 14) +
      ' tickets.csv を読み込む<input type="file" id="csv" accept=".csv" style="display:none"></label>' +
      '<div class="hint" style="margin-top:7px">表示中のデータは<b>合成（決定的PRNG）</b>です。' +
      'docs/DATA_SPEC.md の tickets.csv / fans.csv を投入すると実測に切り替わります。</div>');

  const q = id => document.getElementById(id);
  pb.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => {
    curGame = b.dataset.gm;
    setFloorFormat(GAMES[curGame].fmt);
    buildSnapshot(); buildAutomation(); repaintSeats(); renderPanel();
    toast(GAMES[curGame].name + ' — フロア構成 <b>' + GAMES[curGame].fmt + '</b> / 販売率 ' +
      (AGG.kpi.occ * 100).toFixed(1) + '%', 3000);
  });
  pb.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => {
    seatMode = b.dataset.sm; repaintSeats();
    if (pcMode) repaintSeatCloud();
    renderPanel();
  });
  pb.querySelectorAll('[data-bd]').forEach(b => b.onclick = () => {
    expBoard = +b.dataset.bd; repaintSeats();
    if (pcMode) repaintSeatCloud();
    renderPanel();
  });
  pb.querySelectorAll('[data-odf]').forEach(b => b.onclick = () => {
    odFocus = +b.dataset.odf; repaintSeats();
    if (pcMode) repaintSeatCloud();
    if (typeof draw2D === 'function') draw2D();
    renderPanel();
  });
  pb.querySelectorAll('[data-show]').forEach(c => c.onchange = () => {
    SHOW[c.dataset.show] = c.checked;
    applyShow();
    if (c.dataset.show === 'media') interior.children.forEach(o => {
      if (o.userData && o.userData.kind === 'led') o.visible = SHOW.media;
    });
  });
  pb.querySelectorAll('[data-bt2]').forEach(b => b.onclick = () => bimIsolate(b.dataset.bt2));
  pb.querySelectorAll('[data-bel]').forEach(b => b.onclick = () => bimFocus(BIM_ELEMS[+b.dataset.bel]));
  if (q('rv-play')) q('rv-play').onclick = () => startSeatReveal();
  if (q('tg-in')) q('tg-in').onclick = () => { indoorState.on = !indoorState.on; renderPanel(); };
  if (q('tg-cong')) q('tg-cong').onclick = () => { setCongestion(!indoorState.showCong); renderPanel(); };
  if (q('tg-pc')) q('tg-pc').onclick = () => { setPointCloud(!pcMode); renderPanel(); };
  if (q('open-auto')) q('open-auto').onclick = openAuto;
  if (q('open-seg')) q('open-seg').onclick = openSeg;
  if (q('open-2d')) q('open-2d').onclick = open2D;
  if (q('open-board')) q('open-board').onclick = () => openBoard('od');
  if (q('open-journey')) q('open-journey').onclick = startJourney;
  if (q('csv')) q('csv').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const n = parseTicketsCSV(rd.result);
      buildSnapshot(); buildAutomation(); repaintSeats(); renderPanel();
      toast('実測データ <b>' + n + '行</b> を反映しました', 3600);
    };
    rd.readAsText(f);
  };
}

/* ---- 個客の直近12ヶ月ジャーニー（来場・接触・CV・更新見込の推移） ---- */
const MON = ['9', '10', '11', '12', '1', '2', '3', '4', '5', '6', '7', '8'];
function fanTimelineSVG(i, f) {
  const W = 292, H = 92, PADL = 4, PADR = 4, top = 12, base = H - 22;
  const cw = (W - PADL - PADR) / 12;
  /* NBAシーズン（10〜4月）に来場が集中するよう配分する */
  const season = [0.02, 0.13, 0.15, 0.14, 0.14, 0.13, 0.13, 0.10, 0.03, 0.01, 0.01, 0.01];
  const visits = new Array(12).fill(0);
  let left = f.gamesLtm;
  for (let m = 0; m < 12 && left > 0; m++) {
    const want = Math.round(f.gamesLtm * season[m] + (hrand(i, 900 + m) - 0.5) * 1.2);
    const v = clamp(want, 0, left);
    visits[m] = v; left -= v;
  }
  if (left > 0) visits[11] += left;
  const mx = Math.max(1, ...visits);
  /* 接触本数はオートメーションの実績、CVは反応率から決定的にロール */
  const touches = AUTO.seatCount ? AUTO.seatCount[i] : 0;
  const parts = [];
  parts.push('<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
  /* 来場バー */
  for (let m = 0; m < 12; m++) {
    const x = PADL + m * cw, h = visits[m] / mx * (base - top);
    parts.push('<rect x="' + (x + 2).toFixed(1) + '" y="' + (base - h).toFixed(1) +
      '" width="' + (cw - 4).toFixed(1) + '" height="' + h.toFixed(1) +
      '" rx="1.5" fill="' + (visits[m] ? '#fdb927' : '#1c2130') + '" opacity="' +
      (visits[m] ? 0.85 : 1) + '"/>');
    parts.push('<text x="' + (x + cw / 2).toFixed(1) + '" y="' + (H - 9) +
      '" fill="#5f6b83" font-size="8" text-anchor="middle">' + MON[m] + '</text>');
    if (visits[m]) parts.push('<text x="' + (x + cw / 2).toFixed(1) + '" y="' +
      (base - h - 2.5).toFixed(1) + '" fill="#fdb927" font-size="7.5" text-anchor="middle">' +
      visits[m] + '</text>');
  }
  /* 更新見込の推移（体験と接触で少しずつ変わる想定） */
  const pts = [];
  for (let m = 0; m < 12; m++) {
    const drift = (visits[m] ? 0.035 : -0.018) + (m < 6 ? 0.004 : -0.004);
    const v = clamp((1 - f.churn) + drift * (11 - m) - 0.02 * (hrand(i, 800 + m) - 0.5), 0.03, 0.99);
    pts.push((PADL + m * cw + cw / 2).toFixed(1) + ',' + (top + (1 - v) * (base - top)).toFixed(1));
  }
  parts.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#3ddc84" ' +
    'stroke-width="1.4" opacity="0.9"/>');
  /* 接触マーカー（直近3ヶ月に集中） */
  for (let k = 0; k < Math.min(touches, 8); k++) {
    const m = 9 + (k % 3);
    const x = PADL + m * cw + cw / 2 + ((k / 3 | 0) - 1) * 3.4;
    parts.push('<circle cx="' + x.toFixed(1) + '" cy="' + (top - 5) + '" r="2.1" fill="#00c2ff"/>');
  }
  parts.push('<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base +
    '" stroke="#28324a" stroke-width="1"/>');
  parts.push('</svg>');
  return parts.join('');
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
      '<button class="fc-x" id="fc-x" data-tip="閉じる">' + ic('close', 13) + '</button></div>' +
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
      '<button class="fc-x" id="fc-x" data-tip="閉じる">' + ic('close', 13) + '</button></div>' +
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
      '<div class="sec-t" style="margin-top:10px">直近12ヶ月のジャーニー</div>' +
      '<div class="fc-tl">' + fanTimelineSVG(i, f) + '</div>' +
      '<div class="fc-lg">' +
        '<span><i style="background:#fdb927"></i>来場（計 ' + f.gamesLtm + '）</span>' +
        '<span><i style="background:#3ddc84"></i>更新見込の推移</span>' +
        '<span><i style="background:#00c2ff"></i>接触 ' +
          (AUTO.seatCount ? AUTO.seatCount[i] : 0) + '本</span>' +
      '</div>' +
      '<div class="fc-nba"><div class="h">NEXT BEST ACTION</div>' +
      '<div class="b">' + f.nba.t + '<br><span style="color:var(--sub);font-size:10.5px">' +
      f.nba.d(f.seg) + '</span></div>' +
      '<div class="u">期待CVR上振れ +' + (f.nba.up * 100).toFixed(0) + '%　' +
      '想定増分 ' + usd(Math.round(f.ltv * f.nba.up * 0.16)) + ' / 人</div></div>';
  }
  fanCard.innerHTML += '<button class="tool-btn" id="fc-pov" style="margin-top:9px">' +
    ic('eye', 14) + ' この席から見る（席視点カメラ）</button>';
  fanCard.style.display = 'block';
  const pv = document.getElementById('fc-pov');
  if (pv) pv.onclick = () => enterPOV(i);
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
    for (const h of TICK_HOOKS) h();
  };
  play.onclick = () => {
    timeState.play = !timeState.play;
    play.innerHTML = ic(timeState.play ? 'pause' : 'play', 15);
  };
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
