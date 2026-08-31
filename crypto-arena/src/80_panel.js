
/* ================================================================
   左パネル UI / 個客カード / タイムライン
================================================================ */
const pb = document.getElementById('panel-body');
const SEAT_MODES = [
  ['crowd', '観客', '在館率カーブに連動した実人数表示', 0x9aa6bd],
  ['seg',   'セグメント', 'シーズン券/単券/二次流通/州外 …', 0xfdb927],
  ['od',    '来場OD', 'どの出発地・交通手段から来た席か', 0x00a8ff],
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
    (viewMode === 'point' ?
      '<div class="row-btns" style="margin-top:7px" id="pcm">' +
      [['class', '分類'], ['height', '高さ'], ['intensity', '疑似反射強度']].map(m =>
        '<button class="chip sm' + (pcColorMode === m[0] ? ' active' : '') + '" data-pcm="' + m[0] + '">' +
        m[1] + '</button>').join('') + '</div>' +
      (pcColorMode === 'class' ? '<div class="legend" style="margin-top:7px">' +
        PC_CLASS_NAME.map((n, i) => '<div class="li"><div class="sw" style="background:' +
          hex(PC_CLASS_COL[i]) + '"></div>' + n + '</div>').join('') + '</div>' : '') +
      '<div class="hint" style="margin-top:6px">点群は <b>' + fmt(siteStats.points) +
      ' 点</b>。LASの classification 相当で地表/建物（低中層・高層）/鉄道/アリーナに分類し、' +
      '高さ・疑似反射強度でも着色できます。</div>' : '') +
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

    '<div class="sec"><div class="sec-t"><b>移動経路</b> — 実道路ネットワーク上の来場OD</div>' +
    '<div class="row-btns" style="margin-bottom:7px">' +
      '<button class="chip' + (flowState.on ? ' active' : '') + '" id="tg-flow">人流エージェント</button>' +
      '<button class="chip' + (routeLines.visible ? ' active' : '') + '" id="tg-route">経路ライン</button>' +
    '</div>' +
    '<div class="legend">' + ORIGINS.map((o, i) =>
      '<div class="li" data-org="' + i + '" style="cursor:pointer">' +
      '<div class="sw" style="background:' + hex(o.col) + '"></div>' + o.name +
      '　<b style="color:var(--txt)">' + fmt(o.route.total) + 'm</b></div>').join('') + '</div>' +
    '<div class="hint" style="margin-top:7px">道路グラフ <b>' + fmt(roadGraph.size) +
    ' ノード</b>に A*（歩行者は幹線を避け、車両は幹線を優先）で経路を引いています。' +
    '出発地の構成比は <b>1to1レイヤーの商圏分布に追従</b>。クリックで視点移動。</div>' +
    '<div class="kpi-grid" style="margin-top:8px">' +
      kpiCard(fmt(flowState.arrived), '到着済み', 'k') +
      kpiCard(fmt(flowState.inArena), '在館', 'g') +
      kpiCard(fmt(flowState.left), '退場済み') +
      kpiCard(usd(flowState.spendTotal), '場外消費 累計', 'p') +
    '</div>' +
    '<div class="hint" style="margin-top:6px">人数は到着/退場カーブの積分値。' +
    '表示中の球は<b>1体 ≒ ' + fmt(flowState.perAgent) + ' 人</b>のサンプルです。</div></div>' +

    '<div class="sec"><div class="sec-t"><b>賑わいヒートマップ</b> — 通り単位</div>' +
    '<div class="row-btns" id="hm">' +
      '<button class="chip sm' + (siteLayer === 'none' ? ' active' : '') + '" data-hm="none">OFF</button>' +
      '<button class="chip sm' + (siteLayer === 'heat' && HEAT.mode === 'base' ? ' active' : '') + '" data-hm="base">通常日</button>' +
      '<button class="chip sm' + (siteLayer === 'heat' && HEAT.mode === 'game' ? ' active' : '') + '" data-hm="game">試合日</button>' +
      '<button class="chip sm' + (siteLayer === 'heat' && HEAT.mode === 'delta' ? ' active' : '') + '" data-hm="delta">アリーナ寄与</button>' +
    '</div>' +
    (siteLayer === 'heat' ? '<div class="grad-bar" style="margin-top:7px"></div>' +
      '<div class="grad-lbl"><span>低</span><span>高</span></div>' +
      '<div class="hint" style="margin-top:6px">通常日の街の素の賑わい（POI・商業地・駅）に、' +
      '来場/回遊の経路沿い上乗せを重ねたもの。<b>アリーナ寄与＝差分</b>で、' +
      '興行が周辺のどの通りにどれだけ人を落としているかを見ます。</div>' : '') + '</div>' +

    '<div class="sec"><div class="sec-t"><b>OD分析</b> — ガウスKDE + ODアーク</div>' +
    '<div class="row-btns" id="odm">' +
      '<button class="chip sm' + (siteLayer !== 'od' ? ' active' : '') + '" data-od="off">OFF</button>' +
      '<button class="chip sm' + (siteLayer === 'od' && KDE.mode === 'auto' ? ' active' : '') + '" data-od="auto">時間連動</button>' +
      '<button class="chip sm' + (siteLayer === 'od' && KDE.mode === 'arr' ? ' active' : '') + '" data-od="arr">到着OD</button>' +
      '<button class="chip sm' + (siteLayer === 'od' && KDE.mode === 'dep' ? ' active' : '') + '" data-od="dep">退場OD</button>' +
      '<button class="chip sm' + (siteLayer === 'od' && KDE.mode === 'both' ? ' active' : '') + '" data-od="both">両方</button>' +
    '</div>' +
    (siteLayer === 'od' ? '<div class="row-btns" id="odbw" style="margin-top:6px">' +
      [0.7, 1.0, 1.4].map(b => '<button class="chip sm' + (KDE.bw === b ? ' active' : '') +
        '" data-bw="' + b + '">σ×' + b.toFixed(1) + '</button>').join('') + '</div>' +
      '<div class="hint" style="margin-top:6px">山の高さ＝<b>人数 × 正規カーネル N(μ,σ²) の重ね合わせ</b>。' +
      'タイムライン ▶ で「出発地の山 → アリーナへ質量移動 → 回遊先へ分散」。' +
      'アークの太さ＝シェア、色の変化＝流れの向き。</div>' +
      '<div class="sec-t" style="margin-top:8px">退場後の回遊</div>' +
      DISPERSAL.map(d => bar(d.name, Math.round((AGG.kpi.sold || 0) * d.share), AGG.kpi.sold || 1,
        hex(d.col))).join('') +
      '<div class="hint" style="margin-top:6px">回遊組の場外消費 推計 <b>' +
      usd(DISPERSAL.reduce((a, d) => a + (AGG.kpi.sold || 0) * d.share * d.spend, 0)) +
      '</b> / 1興行。これは<b>アリーナが街に落とす金額</b>で、自治体・周辺事業者向けの数字になります。</div>'
      : '') + '</div>' +

    '<div class="sec"><div class="sec-t"><b>到達圏</b> — 道路グラフ上の等時線</div>' +
    '<div class="row-btns" id="isom">' +
      '<button class="chip sm' + (siteLayer !== 'iso' ? ' active' : '') + '" data-iso="off">OFF</button>' +
      '<button class="chip sm' + (siteLayer === 'iso' && ISO.mode === 'drive' ? ' active' : '') + '" data-iso="drive">車</button>' +
      '<button class="chip sm' + (siteLayer === 'iso' && ISO.mode === 'walk' ? ' active' : '') + '" data-iso="walk">徒歩</button>' +
    '</div>' +
    (siteLayer === 'iso' && ISO.built ?
      '<div class="legend" style="margin-top:7px">' +
      ISO.bands.map((b, i) => '<div class="li"><div class="sw" style="background:' + hex(ISO_COL[i]) +
        '"></div>〜' + b + ' 分　<b style="color:var(--txt)">' + ISO.stats.km[i].toFixed(1) + ' km / ' +
        fmt(ISO.stats.bld[i]) + ' 棟</b></div>').join('') + '</div>' +
      '<div class="hint" style="margin-top:6px">アリーナから Dijkstra。リンク速度は' +
      '<b>車 12〜54 km/h</b>（道路クラス別・試合日実勢）/ <b>徒歩 4.8 km/h</b>。' +
      '建物棟数は圏内の宿泊・飲食・駐車の<b>受け皿規模</b>の代理指標です。</div>' : '') +
    '</div>' +

    '<div class="sec"><button class="tool-btn" id="open-od">📊 OD分析ボードを開く</button></div>' +
    '<div class="sec"><button class="tool-btn" id="go-arena">▶ L2 ボウル内部へ（19,079席の1to1分析）</button></div>';

  pb.querySelectorAll('[data-vm]').forEach(b => b.onclick = () => setViewMode(b.dataset.vm));
  pb.querySelectorAll('[data-pcm]').forEach(b => b.onclick = () => setPointColorMode(b.dataset.pcm));
  const tf = document.getElementById('tg-flow');
  if (tf) tf.onclick = () => { flowState.on = !flowState.on; renderPanel(); };
  const tr = document.getElementById('tg-route');
  if (tr) tr.onclick = () => { routeLines.visible = !routeLines.visible; renderPanel(); };
  pb.querySelectorAll('[data-org]').forEach(d => d.onclick = () => {
    const o = ORIGINS[+d.dataset.org];
    flyTo(o.x, 6, o.z, 420, cam.yaw, 0.5);
    showInfo(o.name, '交通手段 <b>' + o.mode + '</b><br>アリーナまで ' + fmt(o.route.total) +
      ' m<br>接続ゲート: ' + o.gateName + '<br>想定シェア ' + (o.w * 100).toFixed(0) + '%');
  });
  pb.querySelectorAll('[data-hm]').forEach(b => b.onclick = () => setSiteLayer('heat', b.dataset.hm));
  pb.querySelectorAll('[data-od]').forEach(b => b.onclick = () => setSiteLayer('od', b.dataset.od));
  pb.querySelectorAll('[data-iso]').forEach(b => b.onclick = () => setSiteLayer('iso', b.dataset.iso));
  const oo = document.getElementById('open-od');
  if (oo) oo.onclick = () => openBoard('od');
  pb.querySelectorAll('[data-bw]').forEach(b => b.onclick = () => {
    KDE.bw = +b.dataset.bw; updateKDE(); renderPanel();
  });
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

    (seatMode === 'od' ?
      '<div class="sec"><div class="sec-t"><b>出発地で絞り込む</b> — OD × 席の交差分析</div>' +
      '<div class="row-btns" id="odf">' +
      '<button class="chip sm' + (odFocus < 0 ? ' active' : '') + '" data-odf="-1">全出発地</button>' +
      AGG.od.map((m, i) => '<button class="chip sm' + (odFocus === i ? ' active' : '') +
        '" data-odf="' + i + '" style="border-color:' + hex(m.o.col) + '44">' +
        m.o.name.replace(/（.*/, '').slice(0, 14) + ' ' + fmt(m.n) + '</button>').join('') +
      '</div>' +
      (odFocus >= 0 ? (function () {
        const m = AGG.od[odFocus];
        const T = ['FLOOR', 'L100', 'PRM', 'SUITE', 'L300'];
        return '<div class="kpi-grid" style="margin-top:8px">' +
          kpiCard(fmt(m.n), '人数', 'k') +
          kpiCard(Math.round(m.avgMin) + '<small>分</small>', '平均所要') +
          kpiCard(usd(m.avgLtv), '平均LTV', 'g') +
          kpiCard(usd(m.rev), 'チケット収益', 'g') +
        '</div><div class="sec-t" style="margin-top:8px">席ティア内訳</div>' +
        T.map(t => bar(t, m.tier[t] || 0, m.n || 1, '#00c2ff')).join('') +
        '<div class="sec-t" style="margin-top:7px">セグメント内訳</div>' +
        Object.keys(SEGMENTS).filter(k => m.seg[k]).map(k =>
          bar(SEGMENTS[k].name, m.seg[k], m.n || 1, hex(SEGMENTS[k].color))).join('');
      })() : '') +
      '<div class="hint" style="margin-top:7px">出発地を選ぶと<b>その出発地から来た席だけが着色</b>されます。' +
      '「遠方 × 上層」なのか「遠方 × プレミア」なのかが座席上で読めるので、' +
      '交通・宿泊を束ねたパッケージの設計対象が特定できます。</div></div>' : '') +

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

    '<div class="sec"><div class="sec-t"><b>場内動線</b> — コンコース回遊 → ボミトリー → 着席</div>' +
    '<div class="row-btns" style="margin-bottom:6px">' +
      '<button class="chip' + (indoorState.on ? ' active' : '') + '" id="tg-in">人流</button>' +
      '<button class="chip' + (indoorState.showCong ? ' active' : '') + '" id="tg-cong">混雑度</button>' +
      '<button class="chip' + (pcMode ? ' active' : '') + '" id="tg-pc">点群ビュー</button>' +
    '</div>' +
    '<div class="kpi-grid">' +
      kpiCard(fmt(inMesh.count * indoorState.perAgent), 'コンコース滞留', 'k') +
      kpiCard(fmt(STANDS.length), '売店 / POS地点') +
      kpiCard(fmt(STANDS.reduce((a, s) => a + s.served, 0)), '売店 レジ通過') +
      kpiCard(usd(indoorState.posRev), '場内POS 売上', 'g') +
    '</div>' +
    (indoorState.showCong ? '<div class="grad-bar" style="margin-top:7px"></div>' +
      '<div class="grad-lbl"><span>閑散</span><span>LOS E 1.8人/m²</span></div>' : '') +
    '<div class="hint" style="margin-top:6px">歩行速度 75 m/分でコンコース環状動線を歩き、' +
    '42%が売店に立ち寄り（滞留2-5分）、担当ボミトリーからブロックへ降下します。' +
    '<b>点群ビュー</b>は席レイヤーの配色と同期するので、点描のまま同じ分析が読めます。</div></div>' +

    '<div class="sec"><div class="sec-t"><b>BIM 表示</b> — 見通しの確保</div>' +
    ['roof:屋根スラブ', 'truss:屋根トラス/キャットウォーク', 'structure:段床・柱・手すり・ボミトリー',
     'suites:Premier Box', 'media:スポンサー媒体'].map(x => {
      const [k, n] = x.split(':');
      return '<label class="ck-row"><input type="checkbox" data-show="' + k + '"' +
        (SHOW[k] ? ' checked' : '') + '>' + n + '</label>';
    }).join('') +
    '<div class="hint" style="margin-top:6px">部材をクリックすると <b>IFC風の属性カード</b>が開きます。' +
    'BIM/IFC 連携で実部材属性へ置換可能です。</div></div>' +

    (function bimBrowserHTML() {
      const T = bimTypes();
      const rows = Object.keys(T).sort().map(k =>
        '<button class="mode-btn' + (bimBrowse.type === k ? ' active' : '') + '" data-bt2="' + k + '"' +
        ' style="padding:6px 9px">' +
        '<div class="dot" style="background:' + (bimBrowse.type === k ? '#00c2ff' : '#3d4a6b') + '"></div>' +
        '<div style="flex:1"><span style="font-family:var(--mono);font-size:11px">' + k + '</span>' +
        '<span class="desc">' + T[k].length + ' 部材 — ' +
        (T[k][0].userData.attrs['部材種別'] || T[k][0].userData.attrs['用途'] || '') + '</span></div>' +
        '</button>').join('');
      const list = bimBrowse.type ? T[bimBrowse.type].slice(0, 24).map((e, i) =>
        '<button class="chip sm" data-bel="' + BIM_ELEMS.indexOf(e) + '">' + e.userData.tag + '</button>').join('') : '';
      return '<div class="sec"><div class="sec-t"><b>BIM 要素ブラウザ</b> — ' +
        fmt(BIM_ELEMS.length) + ' 部材 / ' + Object.keys(T).length + ' 種別</div>' +
        '<div class="mode-list">' + rows + '</div>' +
        (bimBrowse.type ? '<div class="row-btns" style="margin-top:7px">' + list + '</div>' : '') +
        '<div class="hint" style="margin-top:6px">種別をクリックすると<b>その種別だけを残して他を透過</b>します。' +
        'タグをクリックで該当部材へ視点移動し、IFC属性を表示。</div></div>';
    })() +

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
    seatMode = b.dataset.sm; repaintSeats();
    if (pcMode) repaintSeatCloud();
    renderPanel();
  });
  pb.querySelectorAll('[data-odf]').forEach(b => b.onclick = () => {
    odFocus = +b.dataset.odf; repaintSeats();
    if (pcMode) repaintSeatCloud();
    if (typeof draw2D === 'function') draw2D();
    renderPanel();
  });
  pb.querySelectorAll('[data-bd]').forEach(b => b.onclick = () => {
    expBoard = +b.dataset.bd; repaintSeats();
    if (pcMode) repaintSeatCloud();
    renderPanel();
  });
  pb.querySelectorAll('[data-bt2]').forEach(b => b.onclick = () => bimIsolate(b.dataset.bt2));
  pb.querySelectorAll('[data-bel]').forEach(b => b.onclick = () => bimFocus(BIM_ELEMS[+b.dataset.bel]));
  const qq = id => document.getElementById(id);
  if (qq('tg-in')) qq('tg-in').onclick = () => { indoorState.on = !indoorState.on; renderPanel(); };
  if (qq('tg-cong')) qq('tg-cong').onclick = () => { setCongestion(!indoorState.showCong); renderPanel(); };
  if (qq('tg-pc')) qq('tg-pc').onclick = () => { setPointCloud(!pcMode); renderPanel(); };
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
    for (const h of TICK_HOOKS) h();
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
