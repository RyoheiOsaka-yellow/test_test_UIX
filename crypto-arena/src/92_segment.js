
/* ================================================================
   セグメントビルダー & キャンペーン試算
   19,079席の個客レコードに条件を重ねて対象を切り出し、
   ・3D座席に即時反映（該当席だけ発光）
   ・KPI（人数 / LTV / 収益 / 更新見込）をライブ集計
   ・チャネル別のリーチ・コスト・CV・ROIを試算
   ・CRM投入用の CSV を書き出す
   までを一つの画面で回す。1to1施策の「対象定義 → 効果試算 → 実行データ」の導線。
================================================================ */
const SEG_FILTER = {
  seg: new Set(), reg: new Set(), mode: new Set(), tier: new Set(),
  ltvMin: 0, ltvMax: 200000, churnMin: 0, churnMax: 1,
  gamesMin: 0, optin: false, app: false, expMin: 0,
};
const SEG_STATE = { matched: null, n: 0, kpi: {}, saved: [], name: '' };

function segMatch(i) {
  if (!SNAP.sold[i]) return false;
  const s = SEAT.list[i], f = fanAt(i), F = SEG_FILTER;
  if (F.seg.size && !F.seg.has(f.seg)) return false;
  if (F.reg.size && !F.reg.has(f.reg.n)) return false;
  if (F.mode.size && !F.mode.has(f.org.mode)) return false;
  if (F.tier.size && !F.tier.has(s.tier)) return false;
  if (f.ltv < F.ltvMin || f.ltv > F.ltvMax) return false;
  const renew = 1 - f.churn;
  if (renew < F.churnMin || renew > F.churnMax) return false;
  if (f.gamesLtm < F.gamesMin) return false;
  if (F.optin && !f.optin) return false;
  if (F.app && !f.app) return false;
  if (s.exp < F.expMin) return false;
  return true;
}
function segCompute() {
  const N = SEAT.list.length;
  const m = new Uint8Array(N);
  let n = 0, ltv = 0, rev = 0, fb = 0, churn = 0, optin = 0, app = 0, paid = 0;
  const byNba = {}, bySeg = {}, byReg = {};
  for (let i = 0; i < N; i++) {
    if (!segMatch(i)) continue;
    m[i] = 1; n++;
    const f = fanAt(i);
    ltv += f.ltv; rev += f.paid; paid += f.paid; fb += f.fb + f.merch;
    churn += f.churn; if (f.optin) optin++; if (f.app) app++;
    byNba[f.nba.id] = (byNba[f.nba.id] || 0) + 1;
    bySeg[f.seg] = (bySeg[f.seg] || 0) + 1;
    byReg[f.reg.n] = (byReg[f.reg.n] || 0) + 1;
  }
  SEG_STATE.matched = m; SEG_STATE.n = n;
  SEG_STATE.kpi = { n, ltv, rev, fb, paid,
    avgLtv: n ? ltv / n : 0, avgPaid: n ? paid / n : 0,
    renew: n ? 1 - churn / n : 0, optin: n ? optin / n : 0, app: n ? app / n : 0,
    byNba, bySeg, byReg };
  return SEG_STATE.kpi;
}

/* ---- チャネル経済性（実勢レンジ）----
   cost = 1通あたり変動費 / fixed = 制作・運用の固定費 / mult = 反応率の相対効き */
const CHANNELS = {
  EMAIL: { name: 'メール',     cost: 0.004, fixed: 1800, deliver: 0.97, open: 0.24, mult: 1.00, req: 'optin' },
  PUSH:  { name: 'アプリPush', cost: 0.0015, fixed: 900, deliver: 1.00, open: 0.42, mult: 0.72, req: 'app' },
  SMS:   { name: 'SMS',        cost: 0.021, fixed: 2200, deliver: 0.96, open: 0.92, mult: 1.28, req: 'optin' },
  PAID:  { name: '運用型広告', cost: 0.011, fixed: 6000, deliver: 0.72, open: 1.00, mult: 0.34, req: null },
  DM:    { name: 'DM（郵送）', cost: 0.85,  fixed: 3500, deliver: 0.92, open: 0.62, mult: 0.88, req: null },
};
/* オファー別の素の反応率（コントロール群相当）と 1CVあたりの価値 */
const OFFER_RESP = {
  RENEW: 0.22, WINBACK: 0.06, UPGRADE: 0.08, CONVERT: 0.05,
  FB_OFFER: 0.12, MERCH: 0.035, HOSPITALITY: 0.02, TOUR_BUNDLE: 0.07,
};
const OFFER_VALUE = {
  UPGRADE:     k => k.avgPaid * 0.45,
  RENEW:       k => k.avgLtv * 0.26,
  WINBACK:     k => k.avgPaid * 1.0,
  FB_OFFER:    () => 18,
  MERCH:       () => 42,
  CONVERT:     k => k.avgPaid * 6,
  HOSPITALITY: () => 28000,
  TOUR_BUNDLE: () => 120,
};
const CAMPAIGN = { channel: 'EMAIL', offer: 'RENEW', resp: OFFER_RESP.RENEW, respTouched: false };

function campaignCalc() {
  const k = SEG_STATE.kpi;
  const C = CHANNELS[CAMPAIGN.channel];
  const act = NBA_ACTIONS.find(a => a.id === CAMPAIGN.offer) || NBA_ACTIONS[0];
  /* 到達可能母数はチャネルの前提（オプトイン / アプリ保有）で絞られる */
  const eligible = Math.round(k.n * (C.req === 'optin' ? k.optin : C.req === 'app' ? k.app : 1));
  const reach = Math.round(eligible * C.deliver);
  const engaged = reach * C.open;
  /* 反応率はコントロール（素の反応）と、NBAで最適化した施策の差分で見る。
     売上を丸ごと施策の成果に計上せず、増分だけを評価するのがアップリフトの考え方。 */
  const respC = clamp(CAMPAIGN.resp * C.mult, 0, 0.85);
  const respT = clamp(respC * (1 + act.up), 0, 0.9);
  const cvC = reach * respC, cvT = reach * respT;
  const inc = cvT - cvC;
  const value = OFFER_VALUE[act.id] ? OFFER_VALUE[act.id](k) : 100;
  const cost = eligible * C.cost + C.fixed;
  const incRev = inc * value;
  return { C, act, eligible, reach, engaged, respC, respT, cvC, cvT, inc, value,
           revTotal: cvT * value, incRev, cost,
           roi: cost > 0 ? incRev / cost : 0, profit: incRev - cost,
           cpa: inc > 0 ? cost / inc : 0 };
}

/* ---- CSV 書き出し（CRM投入用） ---- */
function segExportCSV() {
  const rows = ['fan_id,section,row,seat,tier,price_category,segment,region,age_band,' +
                'tenure_years,games_ltm,ltv_usd,paid_usd,renew_prob,rfm_r,rfm_f,rfm_m,' +
                'origin,mode,travel_min,email_optin,app,next_best_action'];
  const m = SEG_STATE.matched;
  for (let i = 0; i < SEAT.list.length; i++) {
    if (!m || !m[i]) continue;
    const s = SEAT.list[i], f = fanAt(i);
    rows.push([f.fid, s.sec, s.row + 1, s.num, s.tier, s.cat, f.seg, '"' + f.reg.n + '"', f.age,
      f.tenure, f.gamesLtm, f.ltv, f.paid, (1 - f.churn).toFixed(3), f.rfmR, f.rfmF, f.rfmM,
      '"' + f.org.name + '"', f.org.mode, f.minutes, f.optin ? 1 : 0, f.app ? 1 : 0,
      f.nba.id].join(','));
  }
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'segment_' + (SEG_STATE.name || 'untitled').replace(/\s+/g, '_') +
               '_' + curGame + '_' + SEG_STATE.n + 'rows.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('CSV を書き出しました — <b>' + fmt(SEG_STATE.n) + ' 行</b>（fan_id・席・属性・NBA付き）', 4000);
}

/* ================= UI ================= */
const segModal = document.createElement('div');
segModal.id = 'segb';
segModal.innerHTML = '<div id="segb-box">' +
  '<div id="segb-hd"><div class="t">🎯 セグメントビルダー & キャンペーン試算</div>' +
  '<input id="segb-name" placeholder="セグメント名" style="background:var(--panel2);border:1px solid var(--line);' +
  'color:var(--txt);border-radius:7px;padding:5px 9px;font-size:11px;font-family:var(--jp);width:180px">' +
  '<button class="close-x" id="segb-x">✕</button></div>' +
  '<div id="segb-body"></div></div>';
document.body.appendChild(segModal);
document.getElementById('segb-x').onclick = () => closeSeg();
segModal.onclick = e => { if (e.target === segModal) closeSeg(); };
document.getElementById('segb-name').oninput = e => { SEG_STATE.name = e.target.value; };

function openSeg() {
  segModal.style.display = 'flex';
  document.getElementById('segb-box').classList.add('lightsurf');
  if (seatMode !== 'segment') { seatMode = 'segment'; }
  segCompute(); repaintSeats();
  if (pcMode) repaintSeatCloud();
  renderSeg(); renderPanel();
}
function closeSeg() { segModal.style.display = 'none'; }

const chips = (id, list, set) => '<div class="row-btns" data-mset="' + id + '">' +
  list.map(x => '<button class="chip sm' + (set.has(x[0]) ? ' active' : '') +
    '" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';

function renderSeg() {
  const k = segCompute();
  const c = campaignCalc();
  const sold = AGG.kpi.sold || 1;
  const body = document.getElementById('segb-body');
  const rng = (id, min, max, step, val, label) =>
    '<div class="sec-t" style="margin-top:8px">' + label +
    ' <b style="color:var(--acc)">' + val + '</b></div>' +
    '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step +
    '" value="' + val + '" style="width:100%;accent-color:var(--acc)">';

  body.innerHTML =
    '<div class="bcard"><h4>① 対象を定義する</h4>' +
    '<div class="sec-t">セグメント</div>' +
      chips('seg', Object.keys(SEGMENTS).map(x => [x, SEGMENTS[x].name]), SEG_FILTER.seg) +
    '<div class="sec-t" style="margin-top:8px">商圏</div>' +
      chips('reg', REGIONS.map(r => [r.n, r.n]), SEG_FILTER.reg) +
    '<div class="sec-t" style="margin-top:8px">交通手段</div>' +
      chips('mode', [['CAR', '車'], ['METRO', 'Metro'], ['RIDESHARE', 'ライドシェア'], ['WALK', '徒歩']], SEG_FILTER.mode) +
    '<div class="sec-t" style="margin-top:8px">席ティア</div>' +
      chips('tier', [['FLOOR', 'フロア'], ['L100', '100L'], ['PRM', 'Premier'],
                     ['SUITE', 'Box'], ['L300', '300L']], SEG_FILTER.tier) +
    rng('f-ltv', 0, 120000, 2000, SEG_FILTER.ltvMin, 'LTV 下限 $') +
    rng('f-renew', 0, 1, 0.05, SEG_FILTER.churnMax.toFixed(2), '更新見込 上限（離反リスク抽出）') +
    rng('f-games', 0, 41, 1, SEG_FILTER.gamesMin, '直近1年の来場 下限') +
    rng('f-exp', 0, 1, 0.05, SEG_FILTER.expMin.toFixed(2), '媒体露出スコア 下限') +
    '<div style="margin-top:9px">' +
    '<label class="ck-row"><input type="checkbox" id="f-optin"' + (SEG_FILTER.optin ? ' checked' : '') +
    '>メール配信可（オプトイン済）</label>' +
    '<label class="ck-row"><input type="checkbox" id="f-app"' + (SEG_FILTER.app ? ' checked' : '') +
    '>アプリ保有</label></div>' +
    '<div class="row-btns" style="margin-top:9px">' +
    '<button class="tool-btn" id="seg-reset" style="width:auto;padding:6px 12px">条件をクリア</button></div>' +
    '</div>' +

    '<div class="bcard"><h4>② 対象の規模と価値</h4>' +
    '<div class="kpi-grid">' +
      '<div class="kpi"><div class="v">' + fmt(k.n) + '</div><div class="l">対象人数（全体の ' +
        (k.n / sold * 100).toFixed(1) + '%）</div></div>' +
      '<div class="kpi"><div class="v g">' + usd(k.ltv) + '</div><div class="l">LTV 合計</div></div>' +
      '<div class="kpi"><div class="v g">' + usd(k.avgLtv) + '</div><div class="l">平均LTV</div></div>' +
      '<div class="kpi"><div class="v k">' + (k.renew * 100).toFixed(0) + '<small>%</small></div>' +
        '<div class="l">平均 更新見込</div></div>' +
      '<div class="kpi"><div class="v">' + usd(k.rev) + '</div><div class="l">今興行 チケット収益</div></div>' +
      '<div class="kpi"><div class="v">' + usd(k.fb) + '</div><div class="l">今興行 場内購買</div></div>' +
      '<div class="kpi"><div class="v p">' + (k.optin * 100).toFixed(0) + '<small>%</small></div>' +
        '<div class="l">メール配信可</div></div>' +
      '<div class="kpi"><div class="v p">' + (k.app * 100).toFixed(0) + '<small>%</small></div>' +
        '<div class="l">アプリ保有</div></div>' +
    '</div>' +
    '<div class="sec-t" style="margin-top:10px">構成（セグメント）</div>' +
    vizCanvas({ type: 'donut', h: 156, legendRight: true, vFmt: v => fmt(v) + ' 人',
      slices: Object.keys(k.bySeg).sort((a, b) => k.bySeg[b] - k.bySeg[a])
        .map((x, i) => ({ label: SEGMENTS[x].name, value: k.bySeg[x], color: VIZ.ser[i % 8] })),
      center: { v: fmt(k.n), l: '対象人数' } }, 156) +
    '<div class="sec-t" style="margin-top:8px">構成（商圏）</div>' +
    vizCanvas({ type: 'hbars', rowH: 20, labW: 128, valW: 60, vFmt: v => fmt(v) + '人',
      rows: Object.keys(k.byReg).sort((a, b) => k.byReg[b] - k.byReg[a])
        .map((x, i) => ({ label: x, value: k.byReg[x], color: VIZ.ser[i % 8] })) }) +
    '<div class="hint" style="margin-top:9px">条件を変えると<b>3Dの座席が即時に光ります</b>。' +
    'どのブロックに固まっているかが分かると、席を軸にした打ち手（隣接席の押さえ、' +
    'ブロック単位の体験改善）に落とせます。</div></div>' +

    '<div class="bcard wide"><h4>③ キャンペーンを試算する</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div><div class="sec-t">チャネル</div>' +
      '<div class="row-btns" data-camp="channel">' + Object.keys(CHANNELS).map(x =>
        '<button class="chip sm' + (CAMPAIGN.channel === x ? ' active' : '') + '" data-v="' + x + '">' +
        CHANNELS[x].name + '</button>').join('') + '</div>' +
      '<div class="sec-t" style="margin-top:8px">オファー</div>' +
      '<div class="row-btns" data-camp="offer">' + NBA_ACTIONS.map(a =>
        '<button class="chip sm' + (CAMPAIGN.offer === a.id ? ' active' : '') + '" data-v="' + a.id + '">' +
        a.t + '</button>').join('') + '</div>' +
      rng('c-cvr', 0.005, 0.5, 0.005, CAMPAIGN.resp.toFixed(3), 'ベース反応率（コントロール群）') +
      '<div class="hint" style="margin-top:8px">' +
      'コントロール反応率 = ベース × チャネル係数 <b>' + c.C.mult.toFixed(2) + '</b> = <b>' +
      (c.respC * 100).toFixed(1) + '%</b><br>' +
      '施策反応率 = コントロール × (1 + NBA上振れ <b>+' + (c.act.up * 100).toFixed(0) + '%</b>) = <b>' +
      (c.respT * 100).toFixed(1) + '%</b><br>' +
      '評価は<b>増分（施策 − コントロール）</b>のみ。売上を丸ごと施策の成果にしません。<br>' +
      '<span style="color:var(--sub)">※ここでのコントロールは「同じチャネルで最適化なしのオファーを送った場合」。' +
      'ジャーニービルダーの<b>ホールドアウトは一切配信しない群</b>で、比較の基準が異なります。</span></div>' +
      '</div>' +
    '<div>' +
    vizCanvas({ type: 'funnel', vFmt: v => fmt(v) + ' 人', steps: [
      { label: '対象人数', value: k.n },
      { label: c.C.req === 'optin' ? '配信可（オプトイン）' : c.C.req === 'app' ? '配信可（アプリ）' : '配信可',
        value: c.eligible },
      { label: '到達', value: c.reach },
      { label: '開封・視認', value: Math.round(c.engaged) },
      { label: 'CV（施策）', value: Math.round(c.cvT) },
    ] }) +
    tbl(['ファネル', '人数 / 金額'], [
      ['対象人数', fmt(k.n)],
      [c.C.req === 'optin' ? '配信可（オプトイン）' : c.C.req === 'app' ? '配信可（アプリ保有）' : '配信可',
        fmt(c.eligible)],
      ['到達（' + (c.C.deliver * 100).toFixed(0) + '%）', fmt(c.reach)],
      ['開封・視認（' + (c.C.open * 100).toFixed(0) + '%）', fmt(Math.round(c.engaged))],
      ['CV：コントロール', fmt(Math.round(c.cvC))],
      ['CV：施策', fmt(Math.round(c.cvT))],
      ['<b>増分CV</b>', '<b style="color:var(--acc)">+' + fmt(Math.round(c.inc)) + '</b>'],
      ['1CVあたり価値', usd(c.value)],
      ['<b>増分売上</b>', '<b style="color:var(--gold)">' + usd(c.incRev) + '</b>'],
      ['コスト（変動 @' + usd(c.C.cost) + ' + 固定 ' + usd(c.C.fixed) + '）', usd(c.cost)],
      ['増分CPA', c.inc > 0 ? usd(c.cpa) : '—'],
      ['<b>増分粗利</b>', '<b style="color:' + (c.profit > 0 ? 'var(--ok)' : 'var(--warn)') + '">' +
        usd(c.profit) + '</b>'],
      ['<b>増分ROAS</b>', '<b style="color:var(--acc)">' + c.roi.toFixed(1) + '×</b>'],
    ]) + '</div></div>' +
    (function verdict() {
      const ok = c.roi >= 1 && c.inc >= 1;
      const why = c.inc < 1 ? '増分CVが1件に満たない — 母数が小さすぎるか、反応率が低すぎます。'
        : c.roi < 1 ? '固定費（' + usd(c.C.fixed) + '）を回収できません — ' +
          '安価なチャネル（メール/Push）に寄せるか、単価の高いオファーに変えてください。'
        : c.roi < 3 ? '成立しますが薄利です。対象を絞って反応率を上げる余地があります。'
        : '十分に成立します。この条件でCSVを書き出して配信キューに載せられます。';
      return '<div class="hint" style="margin-top:10px;border-left-color:' +
        (ok ? 'var(--ok)' : 'var(--warn)') + '"><b style="color:' +
        (ok ? 'var(--ok)' : 'var(--warn)') + '">' +
        (ok ? '✔ 実行可能' : '✕ 現条件では非推奨') + '</b> — ' + why + '</div>';
    })() +
    '<div class="row-btns" style="margin-top:12px">' +
    '<button class="tool-btn" id="seg-save" style="width:auto;padding:8px 14px">💾 このセグメントを保存</button>' +
    '<button class="tool-btn" id="seg-csv" style="width:auto;padding:8px 14px">📤 CRM用 CSV を書き出す（' +
      fmt(k.n) + '行）</button>' +
    '<button class="tool-btn" id="seg-2d" style="width:auto;padding:8px 14px">🗺 2D席図で見る</button>' +
    '</div>' +
    (SEG_STATE.saved.length ? '<div class="sec-t" style="margin-top:10px">保存済みセグメント</div>' +
      tbl(['名前', '人数', 'LTV合計', '更新見込', '想定粗利'],
        SEG_STATE.saved.map(s => [s.name, fmt(s.n), usd(s.ltv),
          (s.renew * 100).toFixed(0) + '%', usd(s.profit)])) : '') +
    '<div class="hint" style="margin-top:9px">単価・CTR・CVRは業界実勢レンジの初期値です。' +
    'crm_engagement.csv（配信ログ）を投入すると<b>自社の実績値に置き換わり</b>、' +
    '試算がそのまま実績ベースの予測になります。</div></div>';

  /* --- バインド --- */
  flushViz();
  body.querySelectorAll('[data-mset]').forEach(g => {
    const key = g.dataset.mset;
    g.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      const set = SEG_FILTER[key], v = b.dataset.v;
      if (set.has(v)) set.delete(v); else set.add(v);
      segCompute(); repaintSeats(); if (pcMode) repaintSeatCloud();
      if (typeof draw2D === 'function') draw2D();
      renderSeg();
    });
  });
  body.querySelectorAll('[data-camp]').forEach(g => {
    const key = g.dataset.camp;
    g.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      CAMPAIGN[key] = b.dataset.v;
      /* オファーを変えたら、手動調整していない限り既定の反応率に戻す */
      if (key === 'offer' && !CAMPAIGN.respTouched) CAMPAIGN.resp = OFFER_RESP[b.dataset.v] || 0.08;
      renderSeg();
    });
  });
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.oninput = fn; };
  const refresh = () => { segCompute(); repaintSeats(); if (pcMode) repaintSeatCloud();
    if (typeof draw2D === 'function') draw2D(); renderSeg(); };
  on('f-ltv', e => { SEG_FILTER.ltvMin = +e.target.value; refresh(); });
  on('f-renew', e => { SEG_FILTER.churnMax = +e.target.value; refresh(); });
  on('f-games', e => { SEG_FILTER.gamesMin = +e.target.value; refresh(); });
  on('f-exp', e => { SEG_FILTER.expMin = +e.target.value; refresh(); });
  on('c-cvr', e => { CAMPAIGN.resp = +e.target.value; CAMPAIGN.respTouched = true; renderSeg(); });
  const chk = (id, key) => {
    const e = document.getElementById(id);
    if (e) e.onchange = () => { SEG_FILTER[key] = e.checked; refresh(); };
  };
  chk('f-optin', 'optin'); chk('f-app', 'app');
  const btn = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  btn('seg-reset', () => {
    SEG_FILTER.seg.clear(); SEG_FILTER.reg.clear(); SEG_FILTER.mode.clear(); SEG_FILTER.tier.clear();
    SEG_FILTER.ltvMin = 0; SEG_FILTER.churnMax = 1; SEG_FILTER.gamesMin = 0;
    SEG_FILTER.expMin = 0; SEG_FILTER.optin = false; SEG_FILTER.app = false;
    refresh();
  });
  btn('seg-csv', segExportCSV);
  btn('seg-2d', () => { closeSeg(); open2D(); });
  btn('seg-save', () => {
    const cc = campaignCalc();
    SEG_STATE.saved.push({ name: SEG_STATE.name || 'セグメント' + (SEG_STATE.saved.length + 1),
      n: k.n, ltv: k.ltv, renew: k.renew, profit: cc.profit });
    renderSeg();
    toast('セグメントを保存しました', 2200);
  });
}
