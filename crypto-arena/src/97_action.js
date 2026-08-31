
/* ================================================================
   アクション・スタジオ（別ページ）
   分析しながら、その場でクリエイティブを作って配信する。
   ① 対象を決める（セグメント条件はセグメントビルダーと共有）
   ② クリエイティブを作る（クーポン / チケット / サンプル / 広告）
   ③ 配信して効果を見る（発行→引換のファネル・粗利・ROAS）
   配信するとオートメーション基盤にジャーニーとして載り、
   タイムライン再生に同期して実際に発火する。
================================================================ */
const ASSET = {
  COUPON: { name: 'クーポン', icon: 'ticket', redeem: 0.28,
    desc: '場内F&B・グッズの割引。着席直後や未購買層に効く' },
  TICKET: { name: 'チケット', icon: 'badge', redeem: 0.11,
    desc: '次戦・パック・席種アップグレード。体験直後の熱量を次回接点に変える' },
  SAMPLE: { name: 'サンプル', icon: 'gem', redeem: 0.46,
    desc: 'スポンサー商品の試供品配布。引換率が高く、後日購買に転換する' },
  AD:     { name: '広告', icon: 'eye', redeem: 0.021,
    desc: 'アプリ内・場内ビジョン・運用型。認知を広く取りに行く' },
};
const ACT = {
  type: 'COUPON',
  title: '20% OFF ・ Bibigo Kitchen',
  body: '{sec} から徒歩40秒の Bibigo Kitchen。今から20分間だけ20%オフです',
  sponsor: 'Bibigo', product: 'Bibigo Kitchen',
  discount: 20, price: 24, unitCost: 1.8, conv: 0.22,
  validMin: 20, cap: 6000, channel: 'PUSH', trigger: 'SEATED',
  holdout: 0.10, budget: 12000, preset: 'nopurchase',
  /* サンプリングと広告は原資がスポンサー側にあるのが実務。
     負担者を切り替えると、アリーナ側のP&Lは協賛収入として立つ。 */
  sponsorFunded: true, sponsorMargin: 1.45, live: [],
};
/* よく使う対象。セグメントビルダーと同じ SEG_FILTER を書き換えるので、
   ここで決めた対象がそのまま3D座席にも反映される。 */
const ACT_PRESETS = [
  { id: 'nopurchase', n: '場内 未購買', ic: 'ticket',
    f: { seg: [], reg: [], mode: [], tier: [], ltvMin: 0, churnMax: 1, gamesMin: 0,
         optin: false, app: true, expMin: 0 } },
  { id: 'churn', n: '離反リスク', ic: 'alert',
    f: { seg: ['SEASON', 'PARTIAL'], reg: [], mode: [], tier: [], ltvMin: 0, churnMax: 0.55,
         gamesMin: 0, optin: false, app: false, expMin: 0 } },
  { id: 'first', n: '初回・単券', ic: 'plus',
    f: { seg: ['SINGLE', 'RESALE'], reg: [], mode: [], tier: [], ltvMin: 0, churnMax: 1,
         gamesMin: 0, optin: false, app: true, expMin: 0 } },
  { id: 'tourist', n: '州外・観光', ic: 'walk',
    f: { seg: ['TOURIST'], reg: [], mode: [], tier: [], ltvMin: 0, churnMax: 1, gamesMin: 0,
         optin: false, app: false, expMin: 0 } },
  { id: 'vip', n: '高LTV', ic: 'gem',
    f: { seg: [], reg: [], mode: [], tier: [], ltvMin: 45000, churnMax: 1, gamesMin: 0,
         optin: false, app: false, expMin: 0 } },
  { id: 'upper', n: '300L 上層', ic: 'bowl',
    f: { seg: [], reg: [], mode: [], tier: ['L300'], ltvMin: 0, churnMax: 1, gamesMin: 0,
         optin: false, app: false, expMin: 0 } },
];
function applyPreset(id) {
  const p = ACT_PRESETS.find(x => x.id === id);
  if (!p) return;
  ACT.preset = id;
  SEG_FILTER.seg = new Set(p.f.seg); SEG_FILTER.reg = new Set(p.f.reg);
  SEG_FILTER.mode = new Set(p.f.mode); SEG_FILTER.tier = new Set(p.f.tier);
  SEG_FILTER.ltvMin = p.f.ltvMin; SEG_FILTER.churnMax = p.f.churnMax;
  SEG_FILTER.gamesMin = p.f.gamesMin; SEG_FILTER.optin = p.f.optin;
  SEG_FILTER.app = p.f.app; SEG_FILTER.expMin = p.f.expMin;
  segCompute();
  if (level === 'arena') { seatMode = 'segment'; repaintSeats(); if (pcMode) repaintSeatCloud(); }
}

/* ---- 効果試算 ---- */
function actCalc() {
  const k = SEG_STATE.kpi.n ? SEG_STATE.kpi : segCompute();
  const C = CHANNELS[ACT.channel], T = ASSET[ACT.type];
  const eligible = Math.round(k.n * (C.req === 'optin' ? k.optin : C.req === 'app' ? k.app : 1));
  const reach = Math.round(eligible * C.deliver);
  const issued = Math.min(reach, ACT.cap);
  /* 席番号やゲートを差し込んだ文面はパーソナライズ効果で反応が上がる */
  const personal = /\{(sec|gate|row|seat|tenure|games)\}/.test(ACT.body) ? 1.34 : 1.0;
  const rT = clamp(T.redeem * C.mult * personal, 0, 0.92);   // 施策群の引換率
  const rC = clamp(T.redeem * ORGANIC_RATIO, 0, 0.92);       // 対照群（配信しない）
  const nH = Math.round(issued * ACT.holdout), nT = issued - nH;
  const redeemT = nT * rT, redeemH = nH * rC;
  const inc = nT * (rT - rC);                                 // 同人数換算の増分
  /* 種別ごとの1件あたり粗利 */
  let unit = 0, rev = 0, cogs = 0, note = '';
  if (ACT.type === 'COUPON') {
    const net = ACT.price * (1 - ACT.discount / 100);
    unit = net - ACT.price * 0.38;
    rev = inc * net; cogs = inc * ACT.price * 0.38;
    note = '実収 ' + usd(net) + '（定価 ' + usd(ACT.price) + ' − 割引 ' + ACT.discount +
           '%）− 原価率38% = 粗利 ' + usd(unit) + ' / 件';
  } else if (ACT.type === 'TICKET') {
    const net = ACT.price * (1 - ACT.discount / 100);
    unit = net; rev = inc * net; cogs = 0;
    note = '次戦単価 ' + usd(ACT.price) + ' − 割引 ' + ACT.discount + '% = ' + usd(net) +
           '。空席を埋める分の限界費用はほぼ0なので全額が粗利';
  } else if (ACT.type === 'SAMPLE') {
    const future = ACT.price * ACT.conv;
    unit = future * 0.6 - ACT.unitCost;
    rev = inc * future; cogs = issued * ACT.unitCost;
    note = '配布原価 ' + usd(ACT.unitCost) + ' / 件（発行数ぶん発生）。' +
           '後日購買 転換率 ' + (ACT.conv * 100).toFixed(0) + '% × 単価 ' + usd(ACT.price);
  } else {
    unit = ACT.price * 0.6;
    rev = inc * ACT.price; cogs = inc * ACT.price * 0.4;
    note = '想定単価 ' + usd(ACT.price) + ' × 粗利率60%';
  }
  const media = issued * C.cost + C.fixed;
  const sponsorable = (ACT.type === 'SAMPLE' || ACT.type === 'AD') && ACT.sponsorFunded;
  /* スポンサー負担のときは、配布原価とメディア費をスポンサーが持ち、
     アリーナはそれにマージンを乗せた協賛収入を受け取る。 */
  const sponsorRev = sponsorable ? (media + cogs) * (ACT.sponsorMargin - 1) : 0;
  const cost = sponsorable ? 0 : media + cogs;
  const totalRev = rev + sponsorRev;
  const profit = totalRev - cost;
  return { k, C, T, eligible, reach, issued, nH, nT, rT, rC, redeemT, redeemH, inc,
           rev, cogs, media, cost, profit, unit, note, personal,
           sponsorable, sponsorRev, totalRev,
           roas: cost > 0 ? totalRev / cost : 0,
           over: !sponsorable && media + cogs > ACT.budget };
}

/* ---- クリエイティブ プレビュー（実物に近い見た目で出す） ---- */
function actPreview() {
  const T = ASSET[ACT.type];
  const sample = SEG_STATE.matched ? SEAT.list.findIndex((s, i) => SEG_STATE.matched[i]) : -1;
  const s = sample >= 0 ? SEAT.list[sample] : SEAT.list[0];
  const f = sample >= 0 && SNAP.sold[sample] ? fanAt(sample) : null;
  const body = f ? renderText(ACT.body, f, s) : ACT.body;
  const code = 'XA-' + (ACT.type[0]) + (Math.abs(hash32(ACT.title.length * 31 + ACT.discount, 7)) % 900000 + 100000);
  const bars = Array.from({ length: 42 }, (_, i) =>
    '<i style="width:' + (1 + (hash32(i, 3) % 3)) + 'px"></i>').join('');

  if (ACT.type === 'COUPON') return '<div class="cr cr-coupon">' +
    '<div class="cr-hd"><span class="cr-br">CRYPTO.COM ARENA</span>' +
    '<span class="cr-tag">COUPON</span></div>' +
    '<div class="cr-big">' + ACT.discount + '<small>% OFF</small></div>' +
    '<div class="cr-pr">' + ACT.product + '</div>' +
    '<div class="cr-bd">' + body + '</div>' +
    '<div class="cr-perf"></div>' +
    '<div class="cr-ft"><div><b>有効</b> 発行から ' + ACT.validMin + ' 分</div>' +
    '<div><b>座席</b> Sec ' + s.sec + ' Row ' + (s.row + 1) + '</div></div>' +
    '<div class="cr-bar">' + bars + '</div><div class="cr-code">' + code + '</div></div>';

  if (ACT.type === 'TICKET') return '<div class="cr cr-ticket">' +
    '<div class="cr-stub"><div class="cr-st1">LAL</div><div class="cr-st2">NEXT<br>GAME</div></div>' +
    '<div class="cr-main"><div class="cr-hd"><span class="cr-br">CRYPTO.COM ARENA</span>' +
    '<span class="cr-tag">TICKET OFFER</span></div>' +
    '<div class="cr-big">' + ACT.discount + '<small>% OFF</small></div>' +
    '<div class="cr-pr">' + ACT.product + '</div>' +
    '<div class="cr-bd">' + body + '</div>' +
    '<div class="cr-ft"><div><b>定価</b> ' + usd(ACT.price) + '</div>' +
    '<div><b>優待</b> ' + usd(Math.round(ACT.price * (1 - ACT.discount / 100))) + '</div>' +
    '<div><b>期限</b> ' + ACT.validMin + ' 日</div></div>' +
    '<div class="cr-code">' + code + '</div></div></div>';

  if (ACT.type === 'SAMPLE') return '<div class="cr cr-sample">' +
    '<div class="cr-hd"><span class="cr-br">' + ACT.sponsor + ' × CRYPTO.COM ARENA</span>' +
    '<span class="cr-tag">SAMPLE</span></div>' +
    '<div class="cr-gift">' + ic('gem', 30) + '</div>' +
    '<div class="cr-pr">' + ACT.product + '</div>' +
    '<div class="cr-bd">' + body + '</div>' +
    '<div class="cr-ft"><div><b>引換</b> 100L コンコース Team Store</div>' +
    '<div><b>お一人様</b> 1点</div></div>' +
    '<div class="cr-bar">' + bars + '</div><div class="cr-code">' + code + '</div></div>';

  return '<div class="cr cr-ad">' +
    '<div class="cr-adimg">' + ic('bolt', 26) +
      '<span>' + ACT.sponsor + '</span></div>' +
    '<div class="cr-adbody"><div class="cr-tag2">SPONSORED</div>' +
    '<div class="cr-adh">' + ACT.title + '</div>' +
    '<div class="cr-bd">' + body + '</div>' +
    '<div class="cr-cta">詳しく見る</div></div></div>';
}

/* ================= 画面 ================= */
const actPage = document.createElement('div');
actPage.id = 'actpage';
actPage.innerHTML = '<div id="ac-kpi"></div><div id="ac-grid">' +
  '<div id="ac-left"><div class="ap-h">① 対象を決める</div><div id="ac-l"></div></div>' +
  '<div id="ac-mid"><div class="ap-h">② クリエイティブを作る</div><div id="ac-m"></div></div>' +
  '<div id="ac-right"><div class="ap-h">③ 配信して効果を見る</div><div id="ac-r"></div></div>' +
  '</div>';
document.body.appendChild(actPage);
let actOpen = false;
function openAction() {
  actOpen = true;
  actPage.style.display = 'flex';
  actPage.classList.add('lightsurf');
  document.getElementById('panel').style.display = 'none';
  document.getElementById('rail-wrap').style.display = 'none';
  if (!SEG_STATE.matched) applyPreset(ACT.preset);
  segCompute();
  renderAction();
}
function closeAction() {
  actOpen = false;
  actPage.style.display = 'none';
  document.getElementById('panel').style.display = UI.rail ? 'none' : 'flex';
  document.getElementById('rail-wrap').style.display = UI.rail ? 'block' : 'none';
}

function renderAction() {
  if (!actOpen) return;
  const c = actCalc(), k = c.k;
  const liveIssued = ACT.live.reduce((a, L) => a + (AUTO.byJ[L.id] ? AUTO.byJ[L.id].sent : 0), 0);
  const liveRedeem = ACT.live.reduce((a, L) =>
    a + (AUTO.byJ[L.id] ? AUTO.byJ[L.id].sent : 0) * L.rT, 0);
  const liveProfit = ACT.live.reduce((a, L) => {
    const sent = AUTO.byJ[L.id] ? AUTO.byJ[L.id].sent : 0;
    const prog = sent / Math.max(1, L.issuedPlan || L.issued);
    return a + sent * L.rT * L.unit + (L.sponsorRev || 0) * clamp(prog, 0, 1)
             - (L.sponsorRev ? 0 : sent * CHANNELS[L.ch].cost);
  }, 0);

  document.getElementById('ac-kpi').innerHTML =
    '<div class="ap-title">' + ic('ticket', 17) + ' ACTION STUDIO' +
    '<small>分析しながら、その場でクーポン・チケット・サンプル・広告を作って配信する</small></div>' +
    [[fmt(ACT.live.length), '配信中キャンペーン', ''],
     [fmt(k.n), '選択中の対象', 'k'],
     [fmt(Math.round(liveIssued)), '発行済み', ''],
     [fmt(Math.round(liveRedeem)), '引換・反応', 'g'],
     [usd(liveProfit), '実績 粗利', 'g'],
     [c.cost > 0 ? c.roas.toFixed(1) + '<small>×</small>' : '—', '試算 ROAS', 'p']]
      .map(x => '<div class="kpi"><div class="v ' + x[2] + '">' + x[0] + '</div>' +
                '<div class="l">' + x[1] + '</div></div>').join('') +
    '<button class="close-x" id="ac-x" style="margin-left:auto">' + ic('close', 15) + '</button>';
  document.getElementById('ac-x').onclick = closeAction;

  /* ---------- ① 対象 ---------- */
  document.getElementById('ac-l').innerHTML =
    '<div class="lgrid" style="grid-template-columns:repeat(3,1fr)">' +
    ACT_PRESETS.map(p => '<button class="lg' + (ACT.preset === p.id ? ' active' : '') +
      '" data-pre="' + p.id + '" data-tip="対象をこの条件に切り替える">' + ic(p.ic, 16) +
      '<span>' + p.n + '</span></button>').join('') + '</div>' +
    '<div class="kpi-grid" style="margin-top:9px">' +
      '<div class="kpi"><div class="v">' + fmt(k.n) + '</div><div class="l">対象人数（' +
        (k.n / Math.max(1, AGG.kpi.sold) * 100).toFixed(1) + '%）</div></div>' +
      '<div class="kpi"><div class="v g">' + usd(k.avgLtv) + '</div><div class="l">平均LTV</div></div>' +
      '<div class="kpi"><div class="v k">' + (k.renew * 100).toFixed(0) +
        '<small>%</small></div><div class="l">平均 更新見込</div></div>' +
      '<div class="kpi"><div class="v p">' + (k.app * 100).toFixed(0) +
        '<small>%</small></div><div class="l">アプリ保有</div></div>' +
    '</div>' +
    '<div class="sec-t" style="margin-top:10px">構成</div>' +
    vizCanvas({ type: 'donut', h: 152, legendRight: true, vFmt: v => fmt(v) + ' 人',
      slices: Object.keys(k.bySeg || {}).sort((a, b) => k.bySeg[b] - k.bySeg[a])
        .map((x, i) => ({ label: SEGMENTS[x].name, value: k.bySeg[x], color: VIZ_LIGHT.ser[i % 8] })),
      center: { v: fmt(k.n), l: '対象' } }, 152) +
    '<div class="sec-t" style="margin-top:8px">席ティア</div>' +
    (function () {
      const t = {};
      for (let i = 0; i < SEAT.list.length; i++)
        if (SEG_STATE.matched && SEG_STATE.matched[i])
          t[SEAT.list[i].tier] = (t[SEAT.list[i].tier] || 0) + 1;
      const JA = { FLOOR: 'フロア', L100: '100L', PRM: 'Premier', SUITE: 'Box', L300: '300L' };
      return vizCanvas({ type: 'hbars', rowH: 20, labW: 66, valW: 56, vFmt: v => fmt(v) + '人',
        rows: Object.keys(t).sort((a, b) => t[b] - t[a])
          .map((x, i) => ({ label: JA[x] || x, value: t[x], color: VIZ_LIGHT.ser[i % 8] })) });
    })() +
    '<div class="hint" style="margin-top:9px">対象は<b>セグメントビルダーと共有</b>しています。' +
    '選ぶと3Dの該当席が光るので、どのブロックに固まっているかを見ながら決められます。' +
    '細かい条件はセグメントビルダーで作り込めます。</div>' +
    '<button class="tool-btn" id="ac-seg" style="margin-top:8px">' + ic('target', 14) +
    ' セグメントビルダーで詳細条件</button>';

  /* ---------- ② クリエイティブ ---------- */
  const isCoupon = ACT.type === 'COUPON', isTicket = ACT.type === 'TICKET';
  const isSample = ACT.type === 'SAMPLE', isAd = ACT.type === 'AD';
  const fld = (id, label, val, type, attrs) =>
    '<div class="ac-f"><label>' + label + '</label>' +
    '<input id="' + id + '" type="' + (type || 'text') + '" value="' + val + '" ' +
    (attrs || '') + '></div>';
  document.getElementById('ac-m').innerHTML =
    '<div class="lgrid" style="grid-template-columns:repeat(4,1fr)">' +
    Object.keys(ASSET).map(t => '<button class="lg' + (ACT.type === t ? ' active' : '') +
      '" data-at="' + t + '" data-tip="' + ASSET[t].desc + '">' + ic(ASSET[t].icon, 17) +
      '<span>' + ASSET[t].name + '</span></button>').join('') + '</div>' +
    '<div class="hint" style="margin:8px 0">' + ASSET[ACT.type].desc + '</div>' +
    '<div class="ac-prev">' + actPreview() + '</div>' +
    '<div class="ac-form">' +
      fld('ac-title', 'タイトル', ACT.title.replace(/"/g, '&quot;')) +
      '<div class="ac-f"><label>本文（差し込み可）</label>' +
      '<textarea id="ac-body" rows="2">' + ACT.body + '</textarea></div>' +
      fld('ac-product', isAd ? '訴求商品' : '対象商品', ACT.product.replace(/"/g, '&quot;')) +
      (isSample || isAd ? fld('ac-sponsor', 'スポンサー', ACT.sponsor) : '') +
      (isAd ? '' : fld('ac-disc', '割引率 %', ACT.discount, 'number', 'min="0" max="90" step="5"')) +
      fld('ac-price', isSample ? '転換後の想定単価 $' : isTicket ? '次戦単価 $' :
          isAd ? '想定単価 $' : '定価 $', ACT.price, 'number', 'min="1" step="1"') +
      (isSample ? fld('ac-cost', '配布原価 $/件', ACT.unitCost, 'number', 'min="0" step="0.1"') +
        fld('ac-conv', '後日購買 転換率 %', Math.round(ACT.conv * 100), 'number', 'min="1" max="90"') : '') +
      fld('ac-valid', isTicket ? '有効期限（日）' : '有効時間（分）', ACT.validMin, 'number', 'min="1"') +
      fld('ac-cap', '発行上限', ACT.cap, 'number', 'min="100" step="100"') +
    '</div>' +
    '<div class="hint" style="margin-top:8px">差し込み: <b>{sec}</b> 区画 / <b>{row}</b> 列 / ' +
    '<b>{gate}</b> ゲート / <b>{tenure}</b> 継続年数 / <b>{games}</b> 来場回数。' +
    (c.personal > 1 ? '<b style="color:var(--ok)">パーソナライズ適用中（反応 ×' +
      c.personal.toFixed(2) + '）</b>' : '差し込みを入れると反応が上がります（×1.34）') + '</div>';

  /* ---------- ③ 配信 ---------- */
  document.getElementById('ac-r').innerHTML =
    '<div class="sec-t">チャネル</div>' +
    '<div class="ibar">' + Object.keys(CHANNELS).map(ch =>
      '<button class="ib wide' + (ACT.channel === ch ? ' active' : '') + '" data-ach="' + ch +
      '" data-tip="到達 ' + (CHANNELS[ch].deliver * 100).toFixed(0) + '% / 単価 ' +
      usd(CHANNELS[ch].cost) + '">' + CHANNELS[ch].name + '</button>').join('') + '</div>' +
    '<div class="sec-t" style="margin-top:9px">配信タイミング</div>' +
    '<div class="ibar">' + Object.keys(TRIG).map(t =>
      '<button class="ib wide' + (ACT.trigger === t ? ' active' : '') + '" data-atr="' + t +
      '">' + TRIG[t].icon + ' ' + TRIG[t].n + '</button>').join('') + '</div>' +
    '<div class="ac-f" style="margin-top:9px"><label>ホールドアウト（配信しない対照群） ' +
      (ACT.holdout * 100).toFixed(0) + '%</label>' +
      '<input id="ac-hold" type="range" min="0" max="0.3" step="0.01" value="' + ACT.holdout + '"></div>' +
    '<div class="ac-f"><label>予算上限 ' + usd(ACT.budget) + '</label>' +
      '<input id="ac-budget" type="range" min="1000" max="80000" step="1000" value="' +
      ACT.budget + '"></div>' +
    '<div class="sec-t" style="margin-top:10px">発行 → 引換 ファネル</div>' +
    vizCanvas({ type: 'funnel', vFmt: v => fmt(v) + ' 件', steps: [
      { label: '対象', value: k.n },
      { label: c.C.req === 'app' ? '配信可（アプリ）' : c.C.req === 'optin' ? '配信可（オプトイン）' : '配信可',
        value: c.eligible },
      { label: '到達', value: c.reach },
      { label: '発行（上限 ' + fmt(ACT.cap) + '）', value: c.issued },
      { label: '引換・反応', value: Math.round(c.redeemT) },
    ] }) +
    ((ACT.type === 'SAMPLE' || ACT.type === 'AD') ?
      '<div class="sec-t" style="margin-top:10px">原資の負担者</div>' +
      '<div class="ibar"><button class="ib wide' + (ACT.sponsorFunded ? ' active' : '') +
      '" data-fund="1" data-tip="配布原価とメディア費をスポンサーが負担し、アリーナは協賛収入を得る">' +
      ic('gem', 14) + 'スポンサー負担</button>' +
      '<button class="ib wide' + (!ACT.sponsorFunded ? ' active' : '') +
      '" data-fund="0" data-tip="アリーナが自社費用で実施する">' +
      ic('bowl', 14) + '自社負担</button></div>' +
      (ACT.sponsorFunded ? '<div class="ac-f" style="margin-top:7px">' +
        '<label>協賛マージン ×' + ACT.sponsorMargin.toFixed(2) + '</label>' +
        '<input id="ac-margin" type="range" min="1.05" max="2" step="0.05" value="' +
        ACT.sponsorMargin + '"></div>' : '') : '') +
    '<div class="sec-t" style="margin-top:10px">効果試算</div>' +
    tbl(['項目', '金額'], [
      ['引換（施策群 ' + (c.rT * 100).toFixed(1) + '%）', fmt(Math.round(c.redeemT)) + ' 件'],
      ['対照群 同率換算', fmt(Math.round(c.nT * c.rC)) + ' 件'],
      ['<b>増分</b>', '<b style="color:var(--acc)">+' + fmt(Math.round(c.inc)) + ' 件</b>'],
      ['1件あたり粗利', usd(c.unit)],
      ['<b>増分売上</b>', '<b>' + usd(c.rev) + '</b>'],
      ['配信コスト', (c.sponsorable ? '<span style="color:var(--sub)">' + usd(c.media) +
        '（スポンサー）</span>' : usd(c.media))],
      ['原価', (c.sponsorable ? '<span style="color:var(--sub)">' + usd(c.cogs) +
        '（スポンサー）</span>' : usd(c.cogs))],
      ...(c.sponsorable ? [['協賛収入（マージン ×' + ACT.sponsorMargin.toFixed(2) + '）',
        '<b style="color:var(--gold)">' + usd(c.sponsorRev) + '</b>']] : []),
      ['<b>増分粗利</b>', '<b style="color:' + (c.profit > 0 ? 'var(--ok)' : 'var(--warn)') + '">' +
        usd(c.profit) + '</b>'],
      ['<b>ROAS</b>', c.cost > 0
        ? '<b style="color:var(--acc)">' + c.roas.toFixed(1) + '×</b>'
        : '<b style="color:var(--ok)">自社コスト 0（全額スポンサー負担）</b>'],
    ]) +
    '<div class="hint" style="margin-top:8px">' + c.note + '</div>' +
    (c.over ? '<div class="hint" style="margin-top:7px;border-left-color:var(--warn)">' +
      '<b style="color:var(--warn)">予算超過</b> — 必要 ' + usd(c.media + c.cogs) +
      ' に対し上限 ' + usd(ACT.budget) + '。発行上限を下げるか予算を上げてください。</div>' : '') +
    '<button class="ac-go' + (c.over || c.inc < 1 ? ' off' : '') + '" id="ac-go">' +
      ic('bolt', 16) + ' このアクションを配信する</button>' +
    (ACT.live.length ? '<div class="sec-t" style="margin-top:12px">配信中キャンペーン</div>' +
      ACT.live.map(L => {
        const sent = AUTO.byJ[L.id] ? AUTO.byJ[L.id].sent : 0;
        return '<div class="ac-live"><div class="ac-live-h">' + ic(ASSET[L.type].icon, 13) +
          '<b>' + L.title + '</b><button class="ac-stop" data-stop="' + L.id + '" ' +
          'data-tip="配信を停止">' + ic('close', 12) + '</button></div>' +
          '<div class="ac-live-b">' + ASSET[L.type].name + ' ／ ' + CHANNELS[L.ch].name +
          ' ／ ' + TRIG[L.trig].n + '</div>' +
          '<div class="ac-live-b">発行 <b>' + fmt(sent) + '</b> / ' + fmt(L.issued) +
          '　引換 <b>' + fmt(Math.round(sent * L.rT)) + '</b>' +
          '　粗利 <b>' + usd(sent * L.rT * L.unit) + '</b></div>' +
          '<div class="ac-live-bar"><i style="width:' +
          clamp(sent / Math.max(1, L.issued) * 100, 0, 100).toFixed(1) + '%"></i></div></div>';
      }).join('') : '');

  /* --- バインド --- */
  const P = actPage;
  P.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => {
    applyPreset(b.dataset.pre); renderAction();
  });
  P.querySelectorAll('[data-at]').forEach(b => b.onclick = () => {
    ACT.type = b.dataset.at;
    const D = { COUPON: { title: '20% OFF ・ Bibigo Kitchen', product: 'Bibigo Kitchen',
        body: '{sec} から徒歩40秒の Bibigo Kitchen。今から20分間だけ20%オフです',
        discount: 20, price: 24, validMin: 20, trigger: 'SEATED', channel: 'PUSH' },
      TICKET: { title: '次戦 20% OFF', product: '次戦チケット（1試合）',
        body: '本日はありがとうございました。今夜だけ、次戦のチケットが20%オフです',
        discount: 20, price: 265, validMin: 3, trigger: 'LEFT_500M', channel: 'PUSH' },
      SAMPLE: { title: 'BODYARMOR 新フレーバー 無料引換', product: 'BODYARMOR 500ml',
        sponsor: 'BODYARMOR', body: 'ハーフタイムに 100L コンコースで1本お受け取りいただけます',
        price: 4.2, unitCost: 1.8, conv: 0.22, validMin: 45, trigger: 'HALFTIME', channel: 'PUSH' },
      AD: { title: 'Delta ─ LAから世界へ', product: 'Delta SkyMiles', sponsor: 'Delta',
        body: '観戦のあとは、次の旅へ。SkyMiles 会員登録で 5,000 マイル',
        price: 62, validMin: 7, trigger: 'GAME_END', channel: 'PAID' } }[ACT.type];
    Object.assign(ACT, D);
    renderAction();
  });
  P.querySelectorAll('[data-fund]').forEach(b => b.onclick = () => {
    ACT.sponsorFunded = b.dataset.fund === '1'; renderAction();
  });
  const mg = document.getElementById('ac-margin');
  if (mg) mg.oninput = () => { ACT.sponsorMargin = +mg.value; renderAction(); };
  P.querySelectorAll('[data-ach]').forEach(b => b.onclick = () => { ACT.channel = b.dataset.ach; renderAction(); });
  P.querySelectorAll('[data-atr]').forEach(b => b.onclick = () => { ACT.trigger = b.dataset.atr; renderAction(); });
  const on = (id, key, num) => {
    const e = document.getElementById(id);
    if (e) e.oninput = () => { ACT[key] = num ? +e.target.value : e.target.value; renderAction(); };
  };
  on('ac-title', 'title'); on('ac-body', 'body'); on('ac-product', 'product');
  on('ac-sponsor', 'sponsor');
  on('ac-disc', 'discount', 1); on('ac-price', 'price', 1); on('ac-cost', 'unitCost', 1);
  on('ac-valid', 'validMin', 1); on('ac-cap', 'cap', 1);
  on('ac-hold', 'holdout', 1); on('ac-budget', 'budget', 1);
  const cv = document.getElementById('ac-conv');
  if (cv) cv.oninput = () => { ACT.conv = +cv.value / 100; renderAction(); };
  const sg = document.getElementById('ac-seg');
  if (sg) sg.onclick = () => { closeAction(); openSeg(); };
  const go = document.getElementById('ac-go');
  if (go) go.onclick = dispatchAction;
  P.querySelectorAll('[data-stop]').forEach(b => b.onclick = () => {
    const id = b.dataset.stop;
    const k2 = JOURNEYS.findIndex(j => j.id === id);
    if (k2 >= 0) JOURNEYS.splice(k2, 1);
    ACT.live = ACT.live.filter(L => L.id !== id);
    buildAutomation(); renderAction();
    toast('配信を停止しました', 2200);
  });
  flushViz();
}

/* ---- 配信: オートメーション基盤にジャーニーとして載せる ---- */
function dispatchAction() {
  const c = actCalc();
  if (c.over || c.inc < 1) return;
  const F = { seg: [...SEG_FILTER.seg], reg: [...SEG_FILTER.reg], mode: [...SEG_FILTER.mode],
              tier: [...SEG_FILTER.tier], ltvMin: SEG_FILTER.ltvMin, churnMax: SEG_FILTER.churnMax,
              gamesMin: SEG_FILTER.gamesMin, optin: SEG_FILTER.optin, app: SEG_FILTER.app };
  const id = 'ACT-' + (ACT.live.length + 1) + '-' + (Date.now() % 10000);
  const text = ACT.body;
  const J = { id, on: true, trig: ACT.trigger, ch: ACT.channel,
    offer: ACT.type === 'TICKET' ? 'WINBACK' : ACT.type === 'SAMPLE' ? 'MERCH' :
           ACT.type === 'AD' ? 'TOUR_BUNDLE' : 'FB_OFFER',
    name: ASSET[ACT.type].name + '｜' + ACT.title,
    why: 'ACTION STUDIO から配信。' + ASSET[ACT.type].desc,
    f: F, text, cond: null, msg: (f, s) => renderText(text, f, s),
    holdout: ACT.holdout, ab: false, abShare: 0.5, chB: ACT.channel, offerB: null,
    cap: ACT.cap, custom: true, fromAction: true };
  JOURNEYS.push(J);
  ACT.live.push({ id, type: ACT.type, title: ACT.title, ch: ACT.channel, trig: ACT.trigger,
                  issued: c.issued, rT: c.rT, unit: c.unit,
                  sponsorRev: c.sponsorRev, issuedPlan: c.issued });
  buildAutomation();
  autoStep(timeState.min);
  renderAction();
  toast(ic('bolt', 13) + ' <b>' + ACT.title + '</b> を配信開始 — 対象 ' + fmt(c.k.n) +
    ' 人 / 発行上限 ' + fmt(c.issued) + ' / 想定粗利 ' + usd(c.profit) +
    '。タイムライン ▶ で発火します', 6000);
}
