/* =========================================================================
   xAD ダッシュボード層 v2（ライトテーマ・分析ボードページ）
   - 推計（点推定±CI＋確信度）/ ウォーターフォール / O2O二重接続ファネル
   - 時系列＋着地予測 / 棚別テーブル / ノベルティRCT検証 / 消費予測 / AIアクション
   - 3Dページ: ミニKPI＋売場詳細パネル
   ========================================================================= */

const COL = {
  s1: '#0f9fba', s2: '#d55181', s3: '#c98500', s4: '#9085e9',
  neutral: '#64748b', neutral2: '#94a3b8',
  good: '#147a55', warn: '#a36a06', bad: '#c53030', mute: '#64748b',
  text: '#45586e', dark: '#16283c', faint: '#8a99ad', grid: 'rgba(22,40,60,0.08)',
};
let activeView = '3d';
const SF = () => STORE.sampleFactor;   // ビーコンサンプリング拡大係数

/* ---------- 確信度ラベル ---------- */
function confChip(level) {
  const map = {
    hi: ['conf-hi', '確信度 高・推奨'],
    md: ['conf-md', '確信度 中・要サンプル'],
    lo: ['conf-lo', '確信度 低・互角'],
  };
  const [cls, label] = map[level];
  return `<span class="conf ${cls}">● ${label}</span>`;
}
function confShort(level) {
  return { hi: [COL.good, '高'], md: [COL.warn, '中'], lo: [COL.mute, '低'] }[level];
}

/* ---------- 推計（統一推計モデルの簡易版） ---------- */
function expectedComponents() {
  const visitors0 = STORE.arrivalBase * 60 * 14.4 * envMult();
  const footVisitors = visitors0 * (S.traffic - 1);
  const visitorsNoAd = visitors0 * S.traffic;
  const adIncVisits = visitorsNoAd * adReachLift();
  const visitors = visitorsNoAd + adIncVisits;
  const exposed = visitors * adExposureShare();
  const buyRate = STORE.buyRate, basket = STORE.basket;

  const baseline = visitors0 * buyRate * basket;
  const foot = footVisitors * buyRate * basket;
  const seasonal = baseline * WEATHER[S.weather].seasonal;
  const geoCal = (window.GEO && GEO.calibrated) ? GEO.calibFactor : 1;
  const adInc = (adIncVisits * buyRate * basket + exposed * promotedShelf().price * 0.15) * geoCal;
  const sigInc = S.signage ? visitors * 0.58 * promotedShelf().price * (FKEY === 'depato' ? 0.011 : 0.02) : 0;
  const treated = S.novelty ? visitors * 0.85 * S.novRate : 0;
  const novInc = treated * (0.10 * promotedShelf().price + buyRate * basket * 0.05);
  const total = baseline + foot + seasonal + adInc + sigInc + novInc;
  return { visitors, visitorsNoAd, adIncVisits, exposed, treated, baseline, foot, seasonal, adInc, sigInc, novInc, total };
}

function dayFrac() { return curveCumFrac(STATS.simSec); }
function blend(liveDaily, analytic) {
  const f = dayFrac();
  const w = clamp((f - 0.03) * 2.2, 0, 0.85);
  return w * liveDaily + (1 - w) * analytic;
}

function computeProjection() {
  const e = expectedComponents();
  const f = dayFrac();
  const totalRevenue = blend(STATS.revenue * SF() / f, e.total);
  const visitors = blend(STATS.visitors * SF() / f, e.visitors);
  const scale = totalRevenue / e.total;
  return {
    visitors, totalRevenue,
    baseline: e.baseline * scale, foot: e.foot * scale, seasonal: e.seasonal * scale,
    adInc: e.adInc * scale, sigInc: e.sigInc * scale, novInc: e.novInc * scale,
    adIncVisits: e.adIncVisits * (visitors / e.visitors),
    exposed: e.exposed, treated: e.treated,
  };
}
window.__computeProjection = computeProjection;

/* ---------- KPI ---------- */
function shelfTotals() {
  let passes = 0, gazes = 0, stops = 0, purch = 0;
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    passes += st.passes; gazes += st.gazes; stops += st.stops; purch += st.purchases;
  });
  return { passes, gazes, stops, purch };
}

function renderKPIs() {
  const p = computeProjection();
  const t = shelfTotals();
  const gazeRate = t.passes ? t.gazes / t.passes : 0;
  const cvr = t.stops ? t.purch / t.stops : 0;
  const budgetYen = S.budget * 1e4;
  const iroas = budgetYen > 0 ? (p.adInc * 7) / budgetYen : 0;

  const kpis = [
    { label: '来店者数（予測）', value: fmtNum(p.visitors) + '人', ci: '±' + fmtNum(p.visitors * 0.06), conf: 'hi' },
    { label: '広告増分来店', value: '+' + fmtNum(p.adIncVisits) + '人', ci: '±' + fmtNum(p.adIncVisits * 0.18), conf: S.budget > 0 ? 'hi' : 'lo' },
    { label: '棚前 視線獲得率', value: fmtPct(gazeRate), ci: '±' + fmtPct(normalCI95(gazeRate, Math.max(t.passes, 1)), 1), conf: t.passes > 200 ? 'hi' : 'md' },
    { label: '立寄→購買 転換率', value: fmtPct(cvr), ci: '±' + fmtPct(normalCI95(cvr, Math.max(t.stops, 1)), 1), conf: t.stops > 120 ? 'hi' : 'md' },
    { label: '本日売上 着地', value: fmtYen(p.totalRevenue), ci: '±' + fmtYen(p.totalRevenue * 0.09), conf: 'md' },
    { label: '推計 iROAS' + ((window.GEO && GEO.calibrated) ? '（実験校正済）' : ''), value: iroas ? iroas.toFixed(2) + '×' : '—', ci: iroas ? '±' + (iroas * ((window.GEO && GEO.calibrated) ? 0.10 : 0.22)).toFixed(2) : '広告OFF', conf: S.budget > 0 ? 'hi' : 'lo' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="k-label">${k.label}</div>
      <div class="k-value">${k.value}</div>
      <div class="k-ci">${k.ci}</div>
      ${confChip(k.conf)}
    </div>`).join('');
}

/* ---------- ミニKPI（3Dページ） ---------- */
function renderMiniKPI() {
  const p = computeProjection();
  const r = noveltyStatsCalc();
  const items = [
    { l: '来店（予測）', v: fmtNum(p.visitors) + '人', s: '±' + fmtNum(p.visitors * 0.06) },
    { l: '広告増分来店', v: '+' + fmtNum(p.adIncVisits), s: '校正済み' },
    { l: '売上着地', v: fmtYen(p.totalRevenue), s: '±9%' },
    { l: 'RCTリフト', v: r.ready ? (r.d >= 0 ? '+' : '') + (r.d * 100).toFixed(1) + 'pt' : '収集中', s: r.ready ? 'z=' + r.z.toFixed(1) : (S.novelty ? `n=${r.n1 + r.n0}` : 'OFF') },
  ];
  document.getElementById('mini-kpi').innerHTML = items.map(i =>
    `<div class="mk"><div class="m-label">${i.l}</div><div class="m-value">${i.v}</div><div class="m-sub">${i.s}</div></div>`).join('');
}

/* ---------- 売場詳細パネル（3Dページ・棚クリック） ---------- */
function renderShelfDetail() {
  const panel = document.getElementById('shelf-detail');
  if (!selectedShelfId || !shelfById[selectedShelfId]) { panel.classList.remove('open'); return; }
  const s = shelfById[selectedShelfId];
  const st = STATS.shelves[s.id];
  const gazeRate = st.passes ? st.gazes / st.passes : 0;
  const stopRate = st.gazes ? st.stops / st.gazes : 0;
  const cvr = st.stops ? st.purchases / st.stops : 0;
  const maxV = Math.max(st.passes * SF(), 1);
  const isPromo = s === promotedShelf();
  const funnel = [
    ['通過', st.passes * SF(), COL.neutral],
    ['視線獲得', st.gazes * SF(), COL.s1],
    ['立寄', st.stops * SF(), COL.s4],
    ['購買', st.purchases * SF(), COL.good],
  ];
  panel.classList.add('open');
  document.getElementById('sd-body').innerHTML = `
    <div class="sd-name">${s.name}${isPromo ? '<span class="promo-tag">販促対象</span>' : ''}</div>
    <div class="sd-cat">カテゴリ: ${s.cat} ｜ 平均単価 ¥${s.price.toLocaleString()}</div>
    <div class="sd-fun">
      ${funnel.map(([l, v, c]) => `
        <div class="sd-frow"><span class="fl">${l}</span>
          <span class="fb"><div style="width:${Math.max(3, v / maxV * 100)}%;background:${c}"></div></span>
          <span class="fv">${fmtNum(v)}</span></div>`).join('')}
    </div>
    <div class="sd-metrics">
      <div class="sd-m"><div class="l">視線獲得率</div><div class="v">${fmtPct(gazeRate, 0)}</div></div>
      <div class="sd-m"><div class="l">視線→立寄</div><div class="v">${fmtPct(stopRate, 0)}</div></div>
      <div class="sd-m"><div class="l">立寄→購買</div><div class="v">${fmtPct(cvr, 0)}</div></div>
      <div class="sd-m"><div class="l">累計視線時間</div><div class="v">${fmtNum(st.gazeSec * SF())}s</div></div>
    </div>
    <div class="sd-cat" style="margin:8px 0 3px">注意の質（購買を説明する3成分）</div>
    <div class="sd-metrics">
      <div class="sd-m"><div class="l">1立寄の平均注視</div><div class="v">${st.dwellN ? (st.attnSum / st.dwellN).toFixed(1) : '—'}s</div></div>
      <div class="sd-m"><div class="l">ゴールデン帯シェア</div><div class="v">${st.gazeSec > 5 ? fmtPct(st.goldenSec / st.gazeSec, 0) : '—'}</div></div>
      <div class="sd-m"><div class="l">注視効率 /1,000s</div><div class="v">${st.gazeSec > 30 ? (st.purchases / st.gazeSec * 1000).toFixed(1) : '—'}</div></div>
      <div class="sd-m"><div class="l">購買者の平均注視</div><div class="v">${st.purchases ? (st.attnBuySum / st.purchases).toFixed(1) : '—'}s</div></div>
    </div>
    <div class="sd-note" style="margin-top:4px">購買者の平均注視が全体平均を大きく上回るほど、
      「見られること」が購買条件になっている売場。差が小さい売場は指名買いが中心。</div>
    ${(() => {
      const tot = st.phaseSec ? st.phaseSec.reduce((a2, b2) => a2 + b2, 0) : 0;
      if (tot < 20) return '';
      const mix = Array.from(st.phaseSec).map(v => v / tot);
      const back = st.putBackPrice + st.putBackOther;
      return `<div class="sd-cat" style="margin:8px 0 3px">棚前行動の4相</div>
        <div class="sp-factor"><span class="fl" style="width:76px">配分</span>
          <span class="fb" style="height:11px;background:transparent;display:flex;gap:1px">${
            mix.map((v, i) => `<span style="height:11px;background:${PHASE_COLORS[i]};width:${(v * 100).toFixed(1)}%;border-radius:2px"></span>`).join('')}</span>
          <span class="fv" style="width:104px">${mix.map(v => (v * 100).toFixed(0) + '%').join('/')}</span></div>
        <div class="legend" style="margin-top:3px">${PHASE_LABELS.map((l, i) =>
          `<span class="li"><span class="sw" style="background:${PHASE_COLORS[i]}"></span>${l}</span>`).join('')}</div>
        <div class="sd-note" style="margin-top:4px">平均候補 ${(st.candSum / Math.max(st.dwellN, 1)).toFixed(1)}点 ／
          手に取って戻した ${st.picks ? fmtPct(back / st.picks, 0) : '—'}（うち値札起因 ${back ? fmtPct(st.putBackPrice / back, 0) : '—'}）</div>`;
    })()}
    ${isPromo ? `<div class="sd-frow"><span class="fl">在庫</span>
      <span class="fb"><div style="width:${(stockState.units / stockState.cap * 100).toFixed(0)}%;background:${COL.s2}"></div></span>
      <span class="fv">${stockState.units}/${stockState.cap}</span></div>` : ''}
    <div class="sd-cat" style="margin:8px 0 3px">棚面の視線ヒート（実測グリッド ${GRID_U}×${GRID_V}）</div>
    <canvas id="sd-heat" height="74"></canvas>
    <div class="sd-note" style="margin-bottom:6px">下=最下段／上=上段。橙破線=ゴールデンゾーン（床上85〜150cm）。</div>
    <div class="sd-note">ビーコン粒度の実測サンプル。数値は本日累計${SF() > 1 ? `（1/${SF()}サンプリング×拡大推計）` : ''}（ライブ集計・推定バッジ）。</div>`;
  if (window.drawShelfHeatMini) drawShelfHeatMini(s.id);
}
window.__renderShelfDetail = renderShelfDetail;

/* ---------- canvas ヘルパ ---------- */
function setupCanvas(cv, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.parentElement.clientWidth;
  if (w <= 0) return null;
  cv.width = w * dpr; cv.height = cssH * dpr;
  cv.style.height = cssH + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: cssH };
}
const tipEl = document.getElementById('tooltip');
function showTip(x, y, html) {
  tipEl.innerHTML = html; tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.min(x + 14, window.innerWidth - r.width - 8) + 'px';
  tipEl.style.top = Math.min(y + 12, window.innerHeight - r.height - 8) + 'px';
}
function hideTip() { tipEl.style.display = 'none'; }

/* ---------- ウォーターフォール ---------- */
let wfHits = [];
function drawWaterfall() {
  const cv = document.getElementById('cv-waterfall');
  const setup = setupCanvas(cv, 240);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  const p = computeProjection();

  const novLive = noveltyStatsCalc();
  const items = [
    { label: 'ベースライン', sub: '広告なしでも来た分', v: p.baseline, color: COL.neutral, conf: 'hi' },
    { label: 'デジタル広告', sub: 'ジオリフト校正済み増分', v: p.adInc, color: COL.s2, conf: S.budget > 0 ? 'hi' : 'lo' },
    { label: '店内サイネージ', sub: 'FamilyMartVision型 店内接触増分', v: p.sigInc, color: '#e29ec0', conf: S.signage ? 'md' : 'lo' },
    { label: 'ノベルティ', sub: 'RCT実測ベース', v: p.novInc, color: COL.s3, conf: novLive.conf },
    { label: '人流（来店環境）', sub: '経路B: γ×人流偏差', v: p.foot, color: COL.s4, conf: 'md' },
    { label: '季節・天候（' + WEATHER[S.weather].short + '）', sub: '状態型シグナル: ' + WEATHER[S.weather].label, v: p.seasonal, color: COL.neutral2, conf: 'lo' },
  ];
  const total = items.reduce((a, i) => a + i.v, 0);

  const mL = 8, mR = 8, mT = 16, mB = 46;
  const plotW = w - mL - mR, plotH = h - mT - mB;
  const n = items.length + 1;
  const bw = Math.min(64, plotW / n - 12);
  const gap = (plotW - bw * n) / (n + 1);
  const maxV = total * 1.06;
  const y0 = mT + plotH;
  const yOf = v => y0 - (v / maxV) * plotH;

  wfHits = [];
  let cum = 0;
  items.forEach((it, i) => {
    const x = mL + gap + (bw + gap) * i;
    const yTop = yOf(cum + it.v), yBot = yOf(cum);
    ctx.fillStyle = it.color;
    roundBarTop(ctx, x, yTop, bw, Math.max(yBot - yTop, 2), 4);
    ctx.strokeStyle = 'rgba(70,90,110,0.3)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x + bw, yTop); ctx.lineTo(x + bw + gap, yTop); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL.dark; ctx.textAlign = 'center'; ctx.font = '600 10.5px sans-serif';
    ctx.fillText(fmtYen(it.v), x + bw / 2, yTop - 5);
    ctx.fillStyle = COL.text; ctx.font = '9.5px sans-serif';
    ctx.fillText(it.label, x + bw / 2, y0 + 14);
    const [cc, cl] = confShort(it.conf);
    ctx.fillStyle = cc;
    ctx.fillText('● ' + cl, x + bw / 2, y0 + 28);
    wfHits.push({ x, y: yTop, w: bw, h: yBot - yTop, it });
    cum += it.v;
  });
  const x = mL + gap + (bw + gap) * items.length;
  const yTop = yOf(total);
  ctx.fillStyle = COL.s1;
  roundBarTop(ctx, x, yTop, bw, y0 - yTop, 4);
  ctx.fillStyle = COL.dark; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(fmtYen(total), x + bw / 2, yTop - 5);
  ctx.fillStyle = COL.text; ctx.font = '9.5px sans-serif';
  ctx.fillText('総売上（予測）', x + bw / 2, y0 + 14);
  ctx.fillStyle = COL.good; ctx.fillText('点推定±9%', x + bw / 2, y0 + 28);
  wfHits.push({ x, y: yTop, w: bw, h: y0 - yTop, it: { label: '総売上（本日着地予測）', sub: '全要因合計', v: total, conf: 'md' } });

  document.getElementById('wf-legend').innerHTML =
    `<span class="li"><span class="sw" style="background:${COL.neutral}"></span>自然発生</span>` +
    `<span class="li"><span class="sw" style="background:${COL.s2}"></span>デジタル広告</span>` +
    `<span class="li"><span class="sw" style="background:#e29ec0"></span>店内サイネージ</span>` +
    `<span class="li"><span class="sw" style="background:${COL.s3}"></span>店頭ノベルティ</span>` +
    `<span class="li"><span class="sw" style="background:${COL.s4}"></span>人流</span>` +
    `<span class="li"><span class="sw" style="background:${COL.s1}"></span>合計</span>`;
}
function roundBarTop(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
}
document.getElementById('cv-waterfall').addEventListener('mousemove', e => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const hit = wfHits.find(hh => mx >= hh.x && mx <= hh.x + hh.w && my >= hh.y - 14 && my <= hh.y + hh.h);
  if (hit) {
    const ciPct = { hi: 0.08, md: 0.16, lo: 0.28 }[hit.it.conf] || 0.15;
    showTip(e.clientX, e.clientY,
      `<b>${hit.it.label}</b><br>${fmtYenFull(hit.it.v)}（±${fmtYen(hit.it.v * ciPct)}）<br><span style="color:${COL.faint}">${hit.it.sub || ''}</span>`);
  } else hideTip();
});
document.getElementById('cv-waterfall').addEventListener('mouseleave', hideTip);

/* ---------- O2O 二重接続ファネル ---------- */
function renderFunnel() {
  const p = computeProjection();
  const nv = STATS.nov;
  const budgetYen = S.budget * 1e4;
  const reach = Math.round(S.budget * STORE.reachPerBudget);
  const iroas = budgetYen > 0 ? (p.adInc * 7) / budgetYen : 0;

  document.getElementById('fun-upper').innerHTML = [
    { l: '広告接触（リーチ）', v: fmtNum(reach), s: '週次・媒体計' },
    { l: '増分来店', v: '+' + fmtNum(p.adIncVisits) + '人/日', s: '±' + fmtNum(p.adIncVisits * 0.18) + ' 校正済み' },
    { l: 'iROAS', v: iroas ? iroas.toFixed(2) + '×' : '—', s: iroas ? '±' + (iroas * 0.22).toFixed(2) : '広告OFF' },
  ].map(x => `<div class="fun-stage"><div class="f-label">${x.l}</div><div class="f-value">${x.v}</div><div class="f-sub">${x.s}</div></div>`).join('');

  const expPromo = p.exposed * 0.72 * 0.62 * 0.46 * dayFrac();
  const obsPromo = STATS.promoUnits * SF();
  let badge;
  if (S.budget === 0 || expPromo < 5) badge = `<span class="badge est">突合: 判定待ち（サンプル収集中）</span>`;
  else if (obsPromo > expPromo * 0.55) badge = `<span class="badge on">↕ 突合: 整合（来店増→購買が伴っている）</span>`;
  else badge = `<span class="badge warnb">↕ 突合: 乖離 — 来店は増えたが購買が伴わない</span>`;
  document.getElementById('fun-mid').innerHTML = badge;

  const sfNote = SF() > 1 ? `サンプル×${SF()}拡大` : '実数';
  document.getElementById('fun-lower').innerHTML = [
    { l: 'ノベルティ受取', v: fmtNum(nv.treat * SF()), s: sfNote + '・無作為割付' },
    { l: '対象商品 購買', v: fmtNum(nv.treatBuy * SF()), s: sfNote + '・POS紐付け' },
    { l: '再来店（予測）', v: fmtNum(STATS.returns * SF()), s: FKEY === 'depato' ? 'エムアイカード型ID-POSで実測化' : 'CRM接続で実測化' },
  ].map(x => `<div class="fun-stage"><div class="f-label">${x.l}</div><div class="f-value">${x.v}</div><div class="f-sub">${x.s}</div></div>`).join('');
}

/* ---------- 時系列チャート ---------- */
let timeHits = [];
function drawTimeChart() {
  const cv = document.getElementById('cv-time');
  const setup = setupCanvas(cv, 240);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  const p = computeProjection();
  const e = expectedComponents();

  const hist = HISTORY.slice(-14);
  const todayIdx = hist.length;
  const fc = [];
  for (let i = 1; i <= 3; i++) {
    const dow = (STATS.day + i - 1) % 7;
    fc.push(e.total * (dow >= 5 ? STORE.weekendFactor : 1.0));
  }
  const pts = [...hist.map(hh => hh.revenue), p.totalRevenue, ...fc];
  const maxV = Math.max(...pts) * 1.14;
  const minV = Math.min(...pts) * 0.82;

  const mL = 46, mR = 10, mT = 12, mB = 22;
  const plotW = w - mL - mR, plotH = h - mT - mB;
  const N = pts.length;
  const xOf = i => mL + (i / (N - 1)) * plotW;
  const yOf = v => mT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.faint; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
  for (let g = 0; g <= 3; g++) {
    const v = minV + (maxV - minV) * (g / 3);
    const y = yOf(v);
    ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(w - mR, y); ctx.stroke();
    ctx.fillText(fmtYen(v), mL - 5, y + 3);
  }

  const cpIdx = hist.findIndex(hh => hh.anomaly);
  if (cpIdx >= 0) {
    const x = xOf(cpIdx);
    ctx.strokeStyle = 'rgba(213,81,129,0.45)'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, mT + plotH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COL.s2; ctx.textAlign = 'center'; ctx.font = '9px sans-serif';
    ctx.fillText('▲ CP開始', x, mT + 9);
  }

  ctx.beginPath();
  const bandIdx = [todayIdx, todayIdx + 1, todayIdx + 2, todayIdx + 3];
  const bandVals = [p.totalRevenue, ...fc];
  bandIdx.forEach((bi, k) => { const x = xOf(bi), y = yOf(bandVals[k] * (1 + 0.09 + k * 0.025)); k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  for (let k = bandIdx.length - 1; k >= 0; k--) ctx.lineTo(xOf(bandIdx[k]), yOf(bandVals[k] * (1 - 0.09 - k * 0.025)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(15,159,186,0.10)'; ctx.fill();

  ctx.strokeStyle = COL.s1; ctx.lineWidth = 2; ctx.beginPath();
  hist.forEach((hh, i) => { const x = xOf(i), y = yOf(hh.revenue); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.lineTo(xOf(todayIdx), yOf(p.totalRevenue));
  ctx.stroke();
  ctx.setLineDash([5, 4]); ctx.beginPath();
  ctx.moveTo(xOf(todayIdx), yOf(p.totalRevenue));
  fc.forEach((v, k) => ctx.lineTo(xOf(todayIdx + 1 + k), yOf(v)));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = 1;

  const tx = xOf(todayIdx), ty = yOf(p.totalRevenue);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = COL.s1; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = COL.dark; ctx.font = '600 9.5px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('本日', tx, ty - 9);

  ctx.fillStyle = COL.faint; ctx.font = '8.5px sans-serif';
  [0, 6, 13].forEach(i => { if (hist[i]) ctx.fillText('D' + hist[i].day, xOf(i), h - 7); });
  ctx.fillText('+3日', xOf(N - 1), h - 7);

  timeHits = pts.map((v, i) => ({
    x: xOf(i), y: yOf(v), v,
    label: i < todayIdx ? `Day ${hist[i].day} 実績` : (i === todayIdx ? `Day ${STATS.day}（本日・予測）` : `+${i - todayIdx}日 予測`),
    kind: i < todayIdx ? 'hist' : 'fc',
    note: i < todayIdx && hist[i].anomaly ? '異常検知: デジタルCP開始による構造変化' : '',
  }));

  document.getElementById('time-legend').innerHTML =
    `<span class="li"><span class="sw" style="background:${COL.s1}"></span>日次売上 実績</span>` +
    `<span class="li"><span class="sw" style="background:rgba(15,159,186,.25)"></span>予測±区間</span>` +
    `<span class="li" style="color:${COL.s2}">▲ 異常検知イベント</span>`;
}
document.getElementById('cv-time').addEventListener('mousemove', e => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  let best = null, bd = 1e9;
  timeHits.forEach(hh => { const d = Math.abs(hh.x - mx); if (d < bd) { bd = d; best = hh; } });
  if (best && bd < 26) {
    showTip(e.clientX, e.clientY,
      `<b>${best.label}</b><br>${fmtYenFull(best.v)}${best.kind === 'fc' ? '（±9〜16%）' : ''}` +
      (best.note ? `<br><span style="color:${COL.s2}">${best.note}</span>` : ''));
  } else hideTip();
});
document.getElementById('cv-time').addEventListener('mouseleave', hideTip);

/* ---------- クロスメディア接触分析 ---------- */
function renderCross() {
  const el = document.getElementById('cross-body');
  if (!el) return;
  const c = STATS.cross;
  const groups = [
    ['非接触', c.none, COL.neutral],
    ['デジタル広告のみ', c.ad, COL.s2],
    ['店内サイネージのみ', c.sig, '#e29ec0'],
    ['広告 × サイネージ', c.both, COL.good],
  ];
  const baseRate = c.none.n > 3 ? c.none.buy / c.none.n : 0;
  const maxRate = Math.max(...groups.map(([, g]) => g.n > 3 ? g.buy / g.n : 0), 0.01);
  el.innerHTML = groups.map(([label, g, color]) => {
    const rate = g.n > 3 ? g.buy / g.n : 0;
    const lift = baseRate > 0 && g.n > 3 ? rate / baseRate : 0;
    return `
      <div class="sd-frow"><span class="fl" style="width:118px">${label}</span>
        <span class="fb"><div style="width:${Math.max(3, rate / maxRate * 100)}%;background:${color}"></div></span>
        <span class="fv" style="width:104px">${g.n > 3 ? fmtPct(rate) : '収集中'}
          <span style="color:var(--text-faint);font-weight:400">${lift > 0 && label !== '非接触' ? ` ×${lift.toFixed(1)}` : ''}</span></span></div>
      <div class="mde-text" style="margin:-2px 0 4px 126px">n=${fmtNum(g.n * SF())}（購買者ベース・${SF() > 1 ? 'サンプル×' + SF() + '拡大' : '実数'}）</div>`;
  }).join('') + `
    <div class="mde-text" style="margin-top:6px;line-height:1.6">
      販促商品の購買率を接触チャネル組合せ別に実測。モデルはFamilyMartVision実証（クロスメディア接触で商品購買伸長率 最大約1.7倍・
      <a href="https://www.family.co.jp/company/news_releases/2025/20250321_01.html" target="_blank" style="color:var(--accent)">ファミリーマート 2025年3月リリース</a>）と、
      サントリーのAIカメラ売場DX（<a href="https://markezine.jp/article/detail/46227" target="_blank" style="color:var(--accent)">MarkeZine</a>）を参考に較正。
    </div>`;
}

/* ---------- 棚別テーブル ---------- */
function renderShelfTable() {
  const rows = SHELVES
    .filter(s => !(s.promoted && !S.endcap && s.id === STORE.promoted.mainId))
    .map(s => {
      const st = STATS.shelves[s.id];
      // 注視効率: 1,000視線秒あたりの購買数（視線という投入に対する産出）
      const eff = st.gazeSec > 30 ? st.purchases / st.gazeSec * 1000 : null;
      return { s, st, gazeRate: st.passes ? st.gazes / st.passes : 0, cvr: st.stops ? st.purchases / st.stops : 0, eff };
    })
    .sort((a, b) => b.st.gazeSec - a.st.gazeSec);
  const maxGaze = Math.max(...rows.map(r => r.st.gazeSec), 1);
  const effs = rows.map(r => r.eff).filter(v => v != null).sort((a, b) => a - b);
  const effMed = effs.length ? effs[Math.floor(effs.length / 2)] : 0;
  document.getElementById('shelf-tbody').innerHTML = rows.slice(0, 10).map(r => `
    <tr class="srow" data-shelf="${r.s.id}">
      <td><span class="sname">${r.s.promoted ? '<span class="promo-tag">販促</span>' : ''}${r.s.name}</span></td>
      <td>${fmtNum(r.st.passes * SF())}</td>
      <td>${fmtPct(r.gazeRate, 0)}</td>
      <td>${fmtNum(r.st.stops * SF())}</td>
      <td>${fmtPct(r.cvr, 0)}</td>
      <td>${r.eff == null ? '—' : `<span style="color:${r.eff < effMed * 0.6 ? COL.warn : (r.eff > effMed * 1.5 ? COL.s1 : 'inherit')}">${r.eff.toFixed(1)}</span>`}</td>
      <td><span class="heatbar" style="width:${Math.max(4, (r.st.gazeSec / maxGaze) * 56)}px"></span></td>
    </tr>`).join('');
}
document.getElementById('shelf-tbody').addEventListener('click', e => {
  const tr = e.target.closest('.srow');
  if (!tr) return;
  switchView('3d');
  selectShelf(tr.dataset.shelf);
  focusShelf(tr.dataset.shelf);
});

/* ---------- ノベルティRCT検証 ---------- */
function noveltyStatsCalc() {
  const nv = STATS.nov;
  const n1 = nv.treat, n0 = nv.ctrl;
  if (!S.novelty || n1 < 5 || n0 < 5) return { ready: false, conf: 'lo', n1, n0 };
  const p1 = nv.treatBuy / n1, p0 = Math.max(nv.ctrlBuy / n0, 0.001);
  const d = p1 - p0;
  const se = Math.sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0);
  const z = se > 0 ? d / se : 0;
  const rel = p0 > 0 ? d / p0 : 0;
  const pbar = (nv.treatBuy + nv.ctrlBuy) / (n1 + n0);
  const mde = 2.8 * Math.sqrt(Math.max(pbar * (1 - pbar), 1e-4) * (1 / n1 + 1 / n0));
  const conf = z >= 1.96 ? 'hi' : (z >= 1.0 ? 'md' : 'lo');
  const spend1 = nv.treatRev / Math.max(n1, 1), spend0 = nv.ctrlRev / Math.max(n0, 1);
  return { ready: true, n1, n0, p1, p0, d, se, z, rel, mde, conf, spend1, spend0 };
}

function renderNovelty() {
  const el = document.getElementById('novelty-body');
  const badge = document.getElementById('badge-nov-mode');
  if (!S.novelty) {
    badge.textContent = 'ノベルティ: 停止中';
    el.innerHTML = `<div class="exp-off">配布OFF。「ノベルティ配布（RCT）」をONにすると、来店客を無作為に処置群/対照群へ割付け、対象商品の購買率リフトを統計検定します。</div>`;
    return;
  }
  badge.textContent = 'ノベルティ: RCT実施中';
  const r = noveltyStatsCalc();
  if (!r.ready) {
    el.innerHTML = `<div class="exp-off">サンプル収集中… 処置群 ${r.n1}人 / 対照群 ${r.n0}人（各5人以上で検定開始）</div>`;
    return;
  }
  const liftColor = r.conf === 'hi' ? COL.good : (r.conf === 'md' ? COL.warn : COL.mute);
  const sigProgress = clamp(Math.abs(r.z) / 1.96, 0, 1);
  el.innerHTML = `
    <div class="exp-grid">
      <div class="exp-cell"><div class="e-label">処置群（受取）n=${fmtNum(r.n1)}</div>
        <div class="e-value">${fmtPct(r.p1)}</div>
        <div class="e-label">対象商品購買率</div></div>
      <div class="exp-cell"><div class="e-label">対照群 n=${fmtNum(r.n0)}</div>
        <div class="e-value" style="color:${COL.text}">${fmtPct(r.p0)}</div>
        <div class="e-label">対象商品購買率</div></div>
    </div>
    <div class="exp-lift">
      <div class="lift-v" style="color:${liftColor}">${r.d >= 0 ? '+' : ''}${(r.d * 100).toFixed(1)}pt（${r.rel >= 0 ? '+' : ''}${fmtPct(r.rel, 0)}）</div>
      <div class="lift-ci">95%CI: ${((r.d - 1.96 * r.se) * 100).toFixed(1)} 〜 ${((r.d + 1.96 * r.se) * 100).toFixed(1)}pt ・ z=${r.z.toFixed(2)}</div>
      ${confChip(r.conf)}
    </div>
    <div class="mde-bar"><div style="width:${(sigProgress * 100).toFixed(0)}%"></div></div>
    <div class="mde-text">有意判定まで ${(sigProgress * 100).toFixed(0)}% ・ 現サンプルの検出可能最小効果（MDE）: ${(r.mde * 100).toFixed(1)}pt</div>
    <div class="mde-text" style="margin-top:3px">客単価: 処置 ${fmtYenFull(r.spend1)} / 対照 ${fmtYenFull(r.spend0)}（参考・推定バッジ）</div>
    ${SF() > 1 ? `<div class="mde-text" style="margin-top:3px">検定はビーコン計測サンプル（1/${SF()}）の実数 n で実施。全体推計は×${SF()}拡大。</div>` : ''}`;
}

/* ---------- 消費予測・在庫 ---------- */
function renderStock() {
  const hoursLeft = Math.max(22 - STATS.simSec / 3600, 0);
  const elapsedH = Math.max(STATS.simSec / 3600 - 10, 0.2);
  const promoRate = STATS.promoUnits * SF() / elapsedH;
  const eta = promoRate > 0.1 ? stockState.units / promoRate : Infinity;
  const rows = [];
  const etaStr = isFinite(eta)
    ? (eta < hoursLeft ? `本日 ${fmtClock(STATS.simSec + eta * 3600)} 欠品予測` : `残 ${eta.toFixed(1)}h で消化`)
    : '消化データ収集中';
  rows.push({
    name: STORE.promoName + '（販促）', pct: stockState.units / stockState.cap,
    eta: stockState.units <= 0 ? `欠品中・機会損失 ${stockState.missed}件` : etaStr,
    alert: stockState.units <= 0 || (isFinite(eta) && eta < hoursLeft), color: COL.s2,
  });
  const others = SHELVES.filter(s => !s.promoted && s.pop > 0.09).slice(0, 2);
  others.forEach(s => {
    const st = STATS.shelves[s.id];
    const sold = st.purchases * SF();
    const heavy = sold > (FKEY === 'depato' ? 5200 : 40);
    rows.push({
      name: s.name, pct: clamp(1 - sold / (FKEY === 'depato' ? 16000 : 150), 0, 1),
      eta: heavy ? '夕方 追加補充推奨' : '安定（自動補充）', alert: heavy, color: COL.s1,
    });
  });
  const dynLine = S.dynPricing
    ? (typeof dynPricingActive === 'function' && dynPricingActive()
      ? `<div class="mde-text" style="margin-top:5px;color:var(--status-warn);font-weight:600">⚡ AIダイナミックプライシング作動中: 17時以降・消化遅延のため自動値下げ -15%（トライアル型）</div>`
      : `<div class="mde-text" style="margin-top:5px">AIダイナミックプライシング: 待機中（17時以降・在庫消化が遅い場合に自動値下げ）</div>`)
    : '';
  document.getElementById('stock-body').innerHTML = dynLine + rows.map(r => `
    <div class="stock-row">
      <span class="s-name">${r.name}</span>
      <span class="s-bar"><div style="width:${(r.pct * 100).toFixed(0)}%;background:${r.color}"></div></span>
      <span class="s-eta ${r.alert ? 'stock-alert' : ''}">${r.eta}</span>
    </div>`).join('') +
    `<div class="mde-text" style="margin-top:6px">消化予測 = ライブ購買レート × デジタルCP・人流の先行指標（推定バッジ）。欠品中は機会損失（在庫内生性）を別カウント。</div>`;
}
function fmtClock(sec) {
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* ---------- AI アクションカード ---------- */
const actionState = {};
/* ---------- 棚前行動の4相 ---------- */
const PHASE_LABELS = ['定位', '探索', '比較', '取得'];
const PHASE_COLORS = ['#9aa9bc', '#0f9fba', '#c98500', '#d55181'];

function phaseRows() {
  return SHELVES.map(s => {
    const st = STATS.shelves[s.id];
    const tot = st.phaseSec ? st.phaseSec.reduce((a, b) => a + b, 0) : 0;
    if (tot < 30 || !st.dwellN) return null;
    const back = st.putBackPrice + st.putBackOther;
    return {
      s, st, tot,
      mix: Array.from(st.phaseSec).map(v => v / tot),
      cands: st.candSum / st.dwellN,
      backRate: st.picks ? back / st.picks : 0,
      priceShare: back ? st.putBackPrice / back : 0,
      dwellSec: tot / st.dwellN,
    };
  }).filter(Boolean);
}

function renderPhases() {
  const el = document.getElementById('phase-body');
  if (!el) return;
  const rows = phaseRows();
  if (!rows.length) { el.innerHTML = `<div class="exp-off">棚前行動を蓄積中…</div>`; return; }
  const all = [0, 1, 2, 3].map(i => rows.reduce((a, r) => a + r.st.phaseSec[i], 0));
  const allTot = all.reduce((a, b) => a + b, 0) || 1;
  // 探索比率が高い＝見つけにくい、比較比率が高い＝迷っている
  const scanHeavy = rows.slice().sort((a, b) => b.mix[1] - a.mix[1])[0];
  const cmpHeavy = rows.slice().sort((a, b) => b.mix[2] - a.mix[2])[0];
  const bar = mix => `<span class="fb" style="height:11px;background:transparent;display:flex;gap:1px">${
    mix.map((v, i) => `<span style="height:11px;background:${PHASE_COLORS[i]};width:${(v * 100).toFixed(1)}%;border-radius:2px"></span>`).join('')}</span>`;
  el.innerHTML = `
    <div class="mde-text" style="margin-bottom:7px">
      棚前の滞在は一様ではなく <b>定位 → 探索 → 比較 → 取得</b> の4相からなる。
      相ごとに視線の散り方が違い（定位=什器全体を素早く／比較=候補SKU間を往復／取得=1点＋値札）、
      どの相が長いかで「売れない理由」が切り分けられる。
      <b>探索が長い＝見つけにくい</b>（視認性・棚割の問題）、<b>比較が長い＝迷っている</b>（品揃え・価格の問題）。
    </div>
    <div class="sp-factor"><span class="fl">全売場 平均</span>${bar(all.map(v => v / allTot))}
      <span class="fv" style="width:112px">${all.map((v, i) => (v / allTot * 100).toFixed(0) + '%').join(' / ')}</span></div>
    <div class="legend" style="margin:4px 0 8px">
      ${PHASE_LABELS.map((l, i) => `<span class="li"><span class="sw" style="background:${PHASE_COLORS[i]}"></span>${l}</span>`).join('')}
    </div>
    <table style="width:100%">
      <thead><tr><th>売場</th><th>相の配分</th><th>平均滞在</th><th>候補数</th><th>戻し率</th><th>うち価格起因</th></tr></thead>
      <tbody>${rows.sort((a, b) => b.tot - a.tot).slice(0, 8).map(r => `
        <tr><td><span class="sname">${r.s.name}</span></td>
          <td style="min-width:110px">${bar(r.mix)}</td>
          <td>${r.dwellSec.toFixed(1)}s</td>
          <td>${r.cands.toFixed(1)}</td>
          <td>${fmtPct(r.backRate, 0)}</td>
          <td><span style="color:${r.priceShare > 0.5 ? COL.warn : 'inherit'}">${fmtPct(r.priceShare, 0)}</span></td></tr>`).join('')}
      </tbody>
    </table>
    <div class="power-box" style="margin-top:8px">
      探索比率が最も高いのは <b>${scanHeavy.s.name}</b>（${fmtPct(scanHeavy.mix[1], 0)}）— 目当てが見つけにくい可能性。
      比較比率が最も高いのは <b>${cmpHeavy.s.name}</b>（${fmtPct(cmpHeavy.mix[2], 0)}・平均候補 ${cmpHeavy.cands.toFixed(1)}点）— 迷いが大きい売場。
      ${confChip(allTot > 4000 ? 'hi' : 'md')}
    </div>
    <div class="sd-note" style="margin-top:5px">
      戻し率 = 手に取ったが購買に至らなかった割合。その内訳（値札を見て戻した / 他の理由）は
      取得相での価格確認をモデル化して分解している。転換率そのものは変えていない。
    </div>`;
}

/* ---------- 計測品質（真値 vs AIカメラ計測値） ---------- */
function measurementQuality() {
  let trueSec = 0, obsSec = 0, hit = 0, tot = 0, covW = 0, camW = 0, wsum = 0;
  const rows = [];
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    if (!st) return;
    trueSec += st.gazeSec; obsSec += st.gazeSecObs;
    hit += st.cellHit; tot += st.cellTot;
    covW += st.coverage * st.gazeSec; camW += st.camMean * st.gazeSec; wsum += st.gazeSec;
    rows.push({
      s, st,
      capture: st.gazeSec > 5 ? st.gazeSecObs / st.gazeSec : null,
      cell: st.cellTot > 20 ? st.cellHit / st.cellTot : null,
      cov: st.coverage, cams: st.camMean,
    });
  });
  if (!wsum) return null;
  return {
    trueSec, obsSec, capture: trueSec ? obsSec / trueSec : 0,
    cell: tot ? hit / tot : 0,
    cov: covW / wsum, cams: camW / wsum,
    rows: rows.sort((a, b) => (a.capture || 1) * (a.cov || 1) - (b.capture || 1) * (b.cov || 1)),
  };
}

/* 計測品質から確信度ラベルを決める（xAD の3段階表現に合わせる） */
function measConf(capture, cov, cell) {
  const sc = (capture || 0) * 0.4 + (cov || 0) * 0.35 + (cell || 0) * 0.25;
  return sc >= 0.68 ? 'hi' : sc >= 0.5 ? 'md' : 'lo';
}

function renderMeasQuality() {
  const el = document.getElementById('measq-body');
  if (!el) return;
  const m = measurementQuality();
  if (!m || m.trueSec < 100) { el.innerHTML = `<div class="exp-off">計測を蓄積中…</div>`; return; }
  const worst = m.rows.slice(0, 4);
  el.innerHTML = `
    <div class="mde-text" style="margin-bottom:7px">
      シミュレーションが生成した<b>真値</b>と、設置CCTV ${CAMS.length}台が実際に観測できた<b>計測値</b>を分けて集計している。
      AIカメラは画角外・什器や他客の陰・検出漏れで取りこぼし、頭部姿勢の推定誤差（σ≈${(CAM_POSE_SD * 57.3).toFixed(0)}°／1台・良条件）で
      注視セルがずれる。ダッシュボードの確信度ラベルはこの計測品質から決まる。
    </div>
    <div class="sd-metrics" style="margin-bottom:8px">
      <div class="sd-m"><div class="l">視線秒の捕捉率</div><div class="v">${fmtPct(m.capture, 1)}</div>
        <div class="l" style="margin-top:2px">${fmtNum(m.obsSec * SF())} / ${fmtNum(m.trueSec * SF())}s</div></div>
      <div class="sd-m"><div class="l">セル位置の一致率</div><div class="v">${fmtPct(m.cell, 0)}</div>
        <div class="l" style="margin-top:2px">${GRID_U}×${GRID_V}格子</div></div>
      <div class="sd-m"><div class="l">棚面カバレッジ</div><div class="v">${fmtPct(m.cov, 0)}</div>
        <div class="l" style="margin-top:2px">視線加重</div></div>
      <div class="sd-m"><div class="l">平均カメラ台数</div><div class="v">${m.cams.toFixed(1)}</div>
        <div class="l" style="margin-top:2px">多いほど姿勢が安定</div></div>
    </div>
    <div class="sd-cat" style="margin:6px 0 3px">計測品質が低い売場（この4つは数字を割り引いて読む）</div>
    <table id="measq-table" style="width:100%">
      <thead><tr><th>売場</th><th>カバレッジ</th><th>カメラ</th><th>捕捉率</th><th>セル一致</th><th>確信度</th></tr></thead>
      <tbody>${worst.map(r => `
        <tr><td><span class="sname">${r.s.name}</span></td>
          <td>${fmtPct(r.cov, 0)}</td>
          <td>${r.cams.toFixed(1)}</td>
          <td>${r.capture == null ? '—' : fmtPct(r.capture, 0)}</td>
          <td>${r.cell == null ? '—' : fmtPct(r.cell, 0)}</td>
          <td>${confChip(measConf(r.capture, r.cov, r.cell))}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="sd-note" style="margin-top:5px">
      「デジタルツイン（点群×CCTV）」の<b>ヒートの出どころ</b>を「AIカメラ計測値」へ切り替えると、
      実機が実際に取れるヒートマップを同じ画面で確認できる。
    </div>`;
}

function buildActions() {
  const p = computeProjection();
  const r = noveltyStatsCalc();
  const promoUnit = FKEY === 'depato' ? '個' : '個';
  const list = [];
  // 棚前4相から「売れない理由」を切り分けて打ち手にする
  const prs = phaseRows().filter(r => r.tot > 200);
  if (prs.length >= 4) {
    const back = prs.filter(r => r.st.picks > 20 && r.priceShare > 0.42 && r.backRate > 0.35)
      .sort((a, b) => b.st.picks * b.backRate * b.priceShare - a.st.picks * a.backRate * a.priceShare)[0];
    const scan = prs.filter(r => r.mix[1] > 0.58)
      .sort((a, b) => b.tot * b.mix[1] - a.tot * a.mix[1])[0];
    if (back) {
      const lost = Math.round(back.st.picks * back.backRate * back.priceShare * SF() * back.s.price * 0.35);
      list.push({
        key: 'phase-price', priority: 'med', category: '価格',
        title: `「${back.s.name}」は手に取った後の離脱が価格起因`,
        reason: `手に取った ${fmtNum(back.st.picks * SF())}件のうち ${fmtPct(back.backRate, 0)} が戻され、`
          + `そのうち ${fmtPct(back.priceShare, 0)} が取得相での値札確認による離脱。`
          + `探索・比較は通過できているので、視認性や棚割ではなく価格提示（プライスカード・バンドル・期間値引）の問題。`,
        impact: { metric: '粗利（円）', delta: Math.max(0, Math.round(lost * 0.3)), ci: Math.round(lost * 0.12) },
        confidence: 0.71, source: 'L2 / 棚前4相',
      });
    }
    if (scan) {
      list.push({
        key: 'phase-scan', priority: 'med', category: '売場',
        title: `「${scan.s.name}」は探索フェーズが ${fmtPct(scan.mix[1], 0)} と長い`,
        reason: `棚前滞在 平均${scan.dwellSec.toFixed(1)}秒のうち探索が ${fmtPct(scan.mix[1], 0)}、比較は ${fmtPct(scan.mix[2], 0)} しかない。`
          + `＝目当てが見つからずに時間を使っており、比較検討まで到達できていない。`
          + `カテゴリサイン・棚段の色分け・フェイス整理で「探す時間」を比較に振り替えられる。`,
        impact: { metric: '立寄→購買', delta: 3, ci: 2 },
        confidence: 0.66, source: 'L2 / 棚前4相',
      });
    }
  }

  // 計測できていない売場 ＝ 打ち手の前に「測れる状態」を作る必要がある
  const mq = measurementQuality();
  if (mq && mq.trueSec > 500) {
    // 注目されているのにカバレッジが低い売場を優先（測る価値 × 測れていなさ）
    const cand = mq.rows
      .filter(r => r.cov < 0.6 && r.st.gazeSec > mq.trueSec * 0.04)
      .map(r => ({ r, score: r.st.gazeSec * (1 - r.cov) }))
      .sort((a, b) => b.score - a.score)[0];
    if (cand) {
      const r = cand.r;
      const lostSec = Math.round(r.st.gazeSec * (1 - (r.capture || 0)) * SF());
      list.push({
        key: 'cam-add', priority: 'high', category: '計測',
        title: `「${r.s.name}」向けにCCTVを1台増設`,
        reason: `棚面カバレッジ ${fmtPct(r.cov, 0)}・平均 ${r.cams.toFixed(1)}台・セル位置一致率 ${r.cell == null ? '—' : fmtPct(r.cell, 0)}。`
          + `視線秒の取りこぼしが ${fmtNum(lostSec)}秒/日 あり、この売場の棚割判断は現状では確信度を上げられない。`
          + `増設すると多視点になり頭部姿勢の推定誤差が縮む（σ ∝ 1/√台数）。`
          + `計測は打ち手ではないが、打ち手の確信度を上げる前提条件。`,
        impact: { metric: '捕捉率', delta: Math.round((0.93 - (r.capture || 0)) * 100), ci: 4 },
        confidence: 0.88, source: 'L0 / カバレッジ',
        apply: () => addCameraFor(r.s.id),
      });
    }
  }
  // 視線は取れているのに売れていない売場 ＝ 置き場所ではなく中身（商品・価格・POP）の問題
  const effRows = SHELVES.map(s => {
    const st = STATS.shelves[s.id];
    return { s, st, eff: st.gazeSec > 300 ? st.purchases / st.gazeSec * 1000 : null };
  }).filter(r => r.eff != null);
  if (effRows.length >= 4) {
    const sorted = effRows.map(r => r.eff).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const worst = effRows.filter(r => r.eff < med * 0.72).sort((a, b) => b.st.gazeSec - a.st.gazeSec)[0];
    if (worst && med > 0) {
      const lost = Math.round((med - worst.eff) / 1000 * worst.st.gazeSec * SF() * worst.s.price * 0.35);
      list.push({
        key: 'attn-waste', priority: 'high', category: '売場',
        title: `「${worst.s.name}」の注視効率が中央値の${Math.round(worst.eff / med * 100)}%`,
        reason: `視線は ${fmtNum(worst.st.gazeSec * SF())}秒 獲得しているが、1,000視線秒あたりの購買は ${worst.eff.toFixed(1)}個（全売場中央値 ${med.toFixed(1)}個）。`
          + `見られていないのではなく、見たうえで選ばれていない＝置き場所ではなく商品・価格・POPの問題。`
          + `ゴールデン帯シェアは ${fmtPct(worst.st.goldenSec / Math.max(worst.st.gazeSec, 1), 0)}、`
          + `購買者の平均注視 ${worst.st.purchases ? (worst.st.attnBuySum / worst.st.purchases).toFixed(1) : '—'}秒 vs 全体 ${worst.st.dwellN ? (worst.st.attnSum / worst.st.dwellN).toFixed(1) : '—'}秒。`,
        impact: { metric: '粗利（円）', delta: Math.max(0, lost), ci: Math.round(Math.max(0, lost) * 0.35) },
        confidence: worst.st.gazeSec > 2000 ? 0.79 : 0.62, source: 'L2 / 注視効率',
      });
    }
  }
  if (S.budget < 70) {
    list.push({
      key: 'budget-up', priority: 'high', category: '予算',
      title: `デジタルCP予算を+${Math.min(30, 100 - S.budget)}万円/週`,
      reason: `限界iROASが閾値1.0を上回っており飽和まで余地。人流レベル${S.traffic.toFixed(1)}×の現況では広告効果の地域補正γが正で、広告を厚くすべき局面（経路B）。`,
      impact: { metric: '増分来店', delta: Math.round(p.adIncVisits * 0.55), ci: Math.round(p.adIncVisits * 0.2) },
      confidence: 0.86, source: 'L3-1 / geolift',
    });
  } else {
    list.push({
      key: 'budget-hold', priority: 'med', category: '予算',
      title: 'CP予算は現状維持（飽和帯）',
      reason: 'レスポンスカーブが飽和域に接近。追加投下の限界iROASが1.0を割る推計のため、増額よりクリエイティブ・売場の改善を優先。',
      impact: { metric: '機会損失回避', delta: 0, ci: 0 },
      confidence: 0.74, source: 'L3-1',
    });
  }
  if (!S.endcap) {
    list.push({
      key: 'endcap-on', priority: 'high', category: '売場',
      title: FKEY === 'depato' ? '催事プロモ台を設置' : 'エンド陳列を導入（販促棚）',
      reason: 'シミュレーション上、販促什器は棚前視線を約1.9倍化。広告接触客の指名来店の受け皿として棚内フェイスでは取りこぼしが発生。',
      impact: { metric: '販促商品販売', delta: Math.round(STATS.promoUnits * SF() * 0.9 + 18), ci: Math.round(8 * SF()) },
      confidence: 0.81, source: 'creative / shelf-sim',
    });
  } else {
    list.push({
      key: 'endcap-expand', priority: 'med', category: '売場',
      title: FKEY === 'depato' ? '第2催事スペースへ横展開' : 'G3エンドへ横展開（クロスMD）',
      reason: '既存売場の立寄客と販促商品購買層の重なりが視線データで確認できる。第2接触機会の追加が有効と推計。',
      impact: { metric: '販促商品販売', delta: Math.round(Math.max(STATS.promoUnits * SF(), 10) * 0.35), ci: Math.round(6 * SF()) },
      confidence: 0.66, source: 'shelf-sim',
    });
  }
  if (S.novelty && r.ready && r.conf === 'hi') {
    list.push({
      key: 'nov-scale', priority: 'high', category: '店頭CP',
      title: 'ノベルティ配布を夕方ピーク帯へ集中',
      reason: `RCTで購買率リフト${(r.d * 100).toFixed(1)}pt が有意（z=${r.z.toFixed(1)}）。効果確定につき、来店の多い17-20時に配布を寄せてリーチ効率を最大化。`,
      impact: { metric: '対象商品購買', delta: Math.round(r.d * p.visitors * 0.3), ci: Math.round(r.se * 1.96 * p.visitors * 0.3) },
      confidence: 0.9, source: 'RCT / novelty',
    });
  } else if (S.novelty) {
    list.push({
      key: 'nov-wait', priority: 'low', category: '店頭CP',
      title: 'ノベルティRCT: サンプル収集を継続',
      reason: r.ready
        ? `リフトは${(r.d * 100).toFixed(1)}ptだが未有意（z=${r.z.toFixed(1)}）。現MDE ${(r.mde * 100).toFixed(1)}ptまで検出力不足。配布率を上げるか収集継続を推奨。`
        : 'サンプル不足のため判定不能。配布を継続し検定可能なサンプルサイズを確保する。',
      impact: { metric: '検定完了', delta: 0, ci: 0 },
      confidence: 0.55, source: 'RCT / power-analysis',
    });
  } else {
    list.push({
      key: 'nov-on', priority: 'med', category: '店頭CP',
      title: 'ノベルティ配布をRCT設計で再開',
      reason: '配布効果が未検証のまま停止中。無作為割付で再開すれば、投資対効果をロジカルに判定できる（検証なき施策は継続判断が不能）。',
      impact: { metric: '検証開始', delta: 0, ci: 0 },
      confidence: 0.7, source: 'RCT / design',
    });
  }
  // 天候・競合・レジのイベント駆動アクション
  if (S.weather === 'hot') {
    list.push({
      key: 'weather-hot', priority: 'high', category: '天候連動',
      title: '冷ケース前サイネージ強化＆飲料・アイス発注増',
      reason: '猛暑シグナル検知。飲料カテゴリ需要+45%・アイス系+80%の推計。天候は状態型シグナルとして推計モデルの季節項に自動反映済み。',
      impact: { metric: '飲料売上', delta: Math.round(p.totalRevenue * 0.04 / 100), ci: Math.round(p.totalRevenue * 0.015 / 100) },
      confidence: 0.78, source: 'weather / L1-1',
    });
  }
  if (S.rival) {
    list.push({
      key: 'rival-defense', priority: 'high', category: '競合対応',
      title: '競合セール検知: 防衛CP（予算+20万・サイネージ枠増）',
      reason: '近隣競合のセールにより推定人流-15%。流出抑止には店頭接点の強化が有効。ジオリフトの対照エリアで競合影響を分離可能。',
      impact: { metric: '流出防止', delta: Math.round(p.visitors * 0.06), ci: Math.round(p.visitors * 0.03) },
      confidence: 0.62, source: 'competitor / geolift',
    });
  }
  if (STATS.balked * SF() > (FKEY === 'depato' ? 400 : 15)) {
    list.push({
      key: 'queue-staff', priority: 'med', category: 'オペレーション',
      title: 'ピーク帯のレジ増員（行列離脱の抑制）',
      reason: `行列離脱が${fmtNum(STATS.balked * SF())}人発生（推定${fmtYen(STATS.balkedRev * SF())}の機会損失）。昼・夕ピークのレジ人員追加で回収可能。`,
      impact: { metric: '機会損失回収', delta: Math.round(STATS.balked * SF() * 0.7), ci: Math.round(STATS.balked * SF() * 0.25) },
      confidence: 0.72, source: 'queue-sim',
    });
  }
  return list;
}

function renderActions() {
  const list = buildActions();
  document.getElementById('actions').innerHTML = list.map(a => {
    const st = actionState[a.key] || { status: 'pending' };
    let verif = '';
    if (st.status === 'exec') {
      const elapsed = STATS.simSec - st.execSimSec;
      verif = elapsed > 3600
        ? `<span class="a-done">✓ 実行済み → 効果確認: ${a.impact.metric} +${a.impact.delta}（推計と整合）</span>`
        : `<span class="a-done" style="color:${COL.warn}">実行済み → 効果確認中（±${a.impact.ci}）</span>`;
    } else if (st.status === 'hold') verif = `<span class="a-done" style="color:${COL.mute}">保留中</span>`;
    else if (st.status === 'reject') verif = `<span class="a-done" style="color:${COL.mute}">却下</span>`;
    const impactStr = a.impact.delta > 0 ? `期待インパクト: ${a.impact.metric} +${a.impact.delta}${a.impact.ci ? `（±${a.impact.ci}）` : ''}/日` : '';
    const confLv = a.confidence >= 0.8 ? 'hi' : a.confidence >= 0.6 ? 'md' : 'lo';
    return `
      <div class="action p-${a.priority}">
        <div class="a-head"><span class="a-pri">${a.priority.toUpperCase()}</span><span class="a-cat">${a.category} ｜ source: ${a.source}</span></div>
        <div class="a-title">${a.title}</div>
        <div class="a-reason">${a.reason}</div>
        ${impactStr ? `<div class="a-impact">${impactStr}</div>` : ''}
        <div class="a-foot">
          ${confChip(confLv)}
          ${verif}
          <span class="a-btns">
            <button data-act="${a.key}" data-op="exec">実行</button>
            <button data-act="${a.key}" data-op="hold">保留</button>
            <button data-act="${a.key}" data-op="reject">却下</button>
          </span>
        </div>
      </div>`;
  }).join('');
}
document.getElementById('actions').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const prev = actionState[b.dataset.act];
  actionState[b.dataset.act] = { status: b.dataset.op, execSimSec: STATS.simSec };
  // 実行がシミュレーション側の状態を変えるアクション（例: CCTV増設）はここで適用する
  if (b.dataset.op === 'exec' && (!prev || prev.status !== 'exec')) {
    const act = buildActions().find(x => x.key === b.dataset.act);
    if (act && act.apply) { act.apply(); renderMeasQuality(); renderShelfTable(); }
  }
  renderActions();
});

/* ---------- ベンチマーク較正カード ---------- */
function renderBenchmark() {
  const el = document.getElementById('benchmark-body');
  if (!el) return;
  el.innerHTML = `
    <table id="bench-table" style="width:100%;border-collapse:collapse;font-size:10.5px">
      <thead><tr>
        <th style="text-align:left;font-weight:500;font-size:9px;color:var(--text-faint);padding:2px 5px;border-bottom:1px solid var(--panel-border)">項目</th>
        <th style="text-align:left;font-weight:500;font-size:9px;color:var(--text-faint);padding:2px 5px;border-bottom:1px solid var(--panel-border)">公開統計（実データ）</th>
        <th style="text-align:left;font-weight:500;font-size:9px;color:var(--text-faint);padding:2px 5px;border-bottom:1px solid var(--panel-border)">本シミュレーションの設定</th>
      </tr></thead>
      <tbody>${STORE.benchmark.map(b => `
        <tr>
          <td style="padding:4px 5px;color:var(--text-primary);font-weight:600;border-bottom:1px solid #eef2f7;white-space:nowrap">${b.k}</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">${b.real}</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">${b.sim}</td>
        </tr>`).join('')}</tbody>
    </table>
    <div style="font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:.08em;margin:10px 0 4px">組み込んだ店頭DX・リテールメディアの実例（実名）</div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <tbody>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary);border-bottom:1px solid #eef2f7;white-space:nowrap">ファミリーマート<br>FamilyMartVision</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">全国約10,800店の店内サイネージ網。認知率55.5%（2025年）。JR東日本企画との実証でクロスメディア接触時の商品購買伸長率が最大約1.7倍。→ 本シミュの「店内サイネージ出稿」トグルとクロスメディア係数（広告×サイネージ=×1.7）に反映。</td></tr>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary);border-bottom:1px solid #eef2f7">サントリー<br>AIカメラ売場DX</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">AIカメラで棚前滞在時間などショッパー行動を可視化し、行動パターン別プロモーションと店頭サイネージのA/Bテストを実施。→ 本シミュの棚前視線・滞在計測（AIカメラ／ビーコンLOG）と棚割シミュレーターの発想元。</td></tr>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary);border-bottom:1px solid #eef2f7">トライアル<br>Retail AI</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">店内AIカメラ約700台で棚前行動を分析し棚割へ反映。AIカメラ連動の自動値下げ（ダイナミックプライシング）を実運用。→ 本シミュの「AIダイナミックプライシング」トグル（17時以降・消化遅延で-15%）に反映。</td></tr>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary)">三越伊勢丹<br>広告メディア事業</td>
          <td style="padding:4px 5px;color:var(--text-secondary)">大型ビジョン・店内サイネージ・エムアイカード媒体等を広告枠として外販（百貨店リテールメディア）。イベント出店支援も提供。→ 百貨店モードの催事プロモ台・ID-POS実測表記に反映。</td></tr>
      </tbody>
    </table>
    <div class="mde-text" style="margin-top:7px;line-height:1.7">
      出典（実名）:
      <a href="https://www.jfa-fc.or.jp/particle/320.html" target="_blank" style="color:var(--accent)">日本フランチャイズチェーン協会（JFA）コンビニエンスストア統計</a>（客単価748.5円=2025年11月・既存店）／
      <a href="https://www.ryutsuu.biz/strategy/r102113.html" target="_blank" style="color:var(--accent)">流通ニュース</a>・<a href="https://diamond-rm.net/market/accounting/515637/" target="_blank" style="color:var(--accent)">ダイヤモンド・チェーンストア</a>（セブン‐イレブン70.3万／ローソン60.3万／ファミリーマート57.3万円=2025年度上期 全店平均日販）／
      <a href="https://www.meti.go.jp/statistics/tyo/syoudou/result/kakuho_2.html" target="_blank" style="color:var(--accent)">経済産業省 商業動態統計</a>（百貨店の飲食料品構成比28.3%）／
      <a href="https://toyokeizai.net/articles/-/665558" target="_blank" style="color:var(--accent)">東洋経済オンライン</a>（伊勢丹新宿本店 2022年度売上 過去最高）／
      <a href="https://www.family.co.jp/company/news_releases/2025/20250321_01.html" target="_blank" style="color:var(--accent)">ファミリーマート ニュースリリース</a>（クロスメディア実証）／
      <a href="https://markezine.jp/article/detail/46227" target="_blank" style="color:var(--accent)">MarkeZine</a>（サントリー AIカメラ売場DX）／
      <a href="https://business.nikkei.com/atcl/gen/19/00096/092500148/" target="_blank" style="color:var(--accent)">日経ビジネス</a>（トライアル AIカメラ自動値下げ）／
      <a href="https://www.imhds.co.jp/biz-solution/business/miad/index.html" target="_blank" style="color:var(--accent)">三越伊勢丹グループ 広告メディアガイド</a>。
      数値はデモ用に丸めたダミーデータであり、実在チェーン・店舗の実績値そのものではありません。
    </div>`;
}

/* ---------- 顧客セグメント（ペルソナ） ---------- */
function renderPersona() {
  const el = document.getElementById('persona-body');
  if (!el) return;
  const tot = Math.max(Object.values(STATS.personas).reduce((a, p) => a + p.n, 0), 1);
  const colors = { commuter: '#0f9fba', homemaker: '#e07b39', student: '#7a5fd0', senior: '#64748b', inbound: '#45b3a2' };
  el.innerHTML = Object.entries(STATS.personas).map(([k, p]) => {
    const P = PERSONAS[k];
    const share = p.n / tot;
    const buyRate = p.n ? p.buyers / p.n : 0;
    const basket = p.buyers ? p.revenue / p.buyers : 0;
    return `
      <div class="media-row">
        <span class="ml" style="width:138px;color:${colors[k]}">● ${P.label}</span>
        <span class="mb"><span class="bar" style="width:${(share * 100).toFixed(0)}%;background:${colors[k]}"></span></span>
        <span class="mv" style="width:150px">構成 ${fmtPct(share, 0)} ・ n=${fmtNum(p.n * SF())}<br>
          <span style="color:var(--text-faint)">購買率${fmtPct(buyRate, 0)} ・ 客単価${basket ? fmtYenFull(basket) : '—'}</span></span>
      </div>`;
  }).join('') + `
    <div class="mde-text" style="margin-top:6px">時間帯でペルソナ構成が変化（昼・夕=通勤、日中=主婦/主夫・シニア、夕方=学生。百貨店は訪日客・シニア比率が上昇）。動線・滞在時間・カテゴリ選好・客単価がペルソナ別に異なる。</div>`;
}

/* ---------- レジ・オペレーション ---------- */
function renderRegops() {
  const el = document.getElementById('regops-body');
  if (!el) return;
  const avgWait = STATS.waitN ? STATS.waitSum / STATS.waitN : 0;
  const rows = REGS.map((r, i) => `
    <div class="media-row">
      <span class="ml">レジ${i + 1}番</span>
      <span class="mb"><span class="bar" style="width:${clamp(r.queue.length / 8 * 100, 2, 100)}%;background:${r.queue.length >= 4 ? COL.warn : COL.s1}"></span></span>
      <span class="mv">${r.open ? '稼働中 ・ 行列 ' + r.queue.length + '人' : '閉鎖中'}</span>
    </div>`).join('');
  const lost = STATS.balkedRev * SF();
  el.innerHTML = rows + `
    <div class="sp-kpis" style="margin-top:8px">
      <div class="kpi"><div class="k-label">平均待ち時間</div><div class="k-value">${avgWait.toFixed(0)}秒</div><div class="k-ci">n=${fmtNum(STATS.waitN * SF())}</div></div>
      <div class="kpi"><div class="k-label">最大行列</div><div class="k-value">${STATS.maxQueue}人</div><div class="k-ci">${STATS.reg2Opened ? 'レジ2番 自動開放済み' : '—'}</div></div>
      <div class="kpi"><div class="k-label">行列離脱（機会損失）</div><div class="k-value" style="color:${STATS.balked > 0 ? COL.bad : 'inherit'}">${fmtNum(STATS.balked * SF())}人</div><div class="k-ci">推定 ${fmtYen(lost)} 相当</div></div>
    </div>
    <div class="mde-text">行列が${FKEY === 'depato' ? 7 : 5}人以上のとき約45%が購入を諦めて退店（balking）。混雑検知でレジを自動開放。ピーク帯の人員計画の検証に使用。</div>`;
}

/* ---------- BEACON LOG ---------- */
function renderBeacon() {
  document.getElementById('beacon-lines').innerHTML = BEACON_LINES.map(l =>
    `<div><span class="t">${l.t}</span><span class="${l.cls || ''}">${l.msg}</span></div>`).join('');
}

/* ---------- ビュー・施設切替 / 折り畳み ---------- */
function switchView(view) {
  activeView = view;
  document.querySelectorAll('#view-seg button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  ['analytics', 'shelf', 'plan', 'studio'].forEach(v =>
    document.getElementById('page-' + v).classList.toggle('active', view === v));
  if (view === 'analytics') requestAnimationFrame(() => { refreshCharts(); refreshDash(); });
  if (view === 'shelf' && window.renderShelfSim) requestAnimationFrame(() => window.renderShelfSim());
  if (view === 'plan' && window.renderPlanPage) requestAnimationFrame(() => window.renderPlanPage());
  if (view === 'studio' && window.renderStudioPage) requestAnimationFrame(() => window.renderStudioPage());
}

function bindControls() {
  const $ = id => document.getElementById(id);
  $('ctl-budget').addEventListener('input', e => {
    S.budget = +e.target.value;
    $('v-budget').textContent = S.budget + '万円';
    refreshCharts();
  });
  $('ctl-novelty').addEventListener('change', e => {
    S.novelty = e.target.checked;
    $('novrate-row').style.opacity = S.novelty ? 1 : 0.35;
    refreshCharts();
  });
  $('ctl-novrate').addEventListener('input', e => {
    S.novRate = +e.target.value / 100;
    $('v-novrate').textContent = e.target.value + '%';
  });
  $('ctl-traffic').addEventListener('input', e => {
    S.traffic = +e.target.value / 100;
    $('v-traffic').textContent = S.traffic.toFixed(1) + '×';
    refreshCharts();
  });
  $('ctl-endcap').addEventListener('change', e => { S.endcap = e.target.checked; refreshCharts(); });
  $('ctl-signage').addEventListener('change', e => { S.signage = e.target.checked; refreshCharts(); });
  $('ctl-dynp').addEventListener('change', e => { S.dynPricing = e.target.checked; });
  document.getElementById('ctl-weather').addEventListener('click', e => {
    const b = e.target.closest('button[data-w]');
    if (!b) return;
    S.weather = b.dataset.w;
    document.querySelectorAll('#ctl-weather button').forEach(x => x.classList.toggle('active', x === b));
    beacon(`天候シグナル更新: ${WEATHER[S.weather].label}`, '');
    refreshCharts();
  });
  $('ctl-rival').addEventListener('change', e => {
    S.rival = e.target.checked;
    if (S.rival) beacon('競合店セールを検知（推定人流 -15%）', 'seg-ad');
    refreshCharts(); renderActions();
  });
  ['shelfheat', 'floorheat', 'gaze', 'cones', 'trails', 'labels'].forEach(k => {
    $('ly-' + k).addEventListener('change', e => S.layers[k] = e.target.checked);
  });
  document.querySelectorAll('.spd-btn').forEach(b => {
    b.addEventListener('click', () => {
      S.speed = +b.dataset.spd;
      document.querySelectorAll('.spd-btn').forEach(x => x.classList.toggle('active', x === b));
    });
  });
  $('btn-pause').addEventListener('click', () => {
    S.paused = !S.paused;
    $('btn-pause').textContent = S.paused ? '▶ 再開' : '❚❚ 停止';
  });
  document.querySelectorAll('.cam-grid button').forEach(b => {
    b.addEventListener('click', () => {
      const c = b.dataset.cam;
      if (c === 'follow') pickFollowTarget();
      else tweenCam(Object.assign({}, STORE.camPresets[c]));
    });
  });
  // ビュー切替
  document.querySelectorAll('#view-seg button').forEach(b => {
    b.addEventListener('click', () => switchView(b.dataset.view));
  });
  // 施設切替
  document.querySelectorAll('#facility-seg button').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.fac === FKEY) return;
      document.querySelectorAll('#facility-seg button').forEach(x => x.classList.toggle('active', x === b));
      loadFacility(b.dataset.fac);
      Object.keys(actionState).forEach(k => delete actionState[k]);
      if (window.__shelfFacilityReset) window.__shelfFacilityReset();
      refreshDash(); refreshCharts(); renderActions();
      if (activeView === 'shelf' && window.renderShelfSim) window.renderShelfSim();
    });
  });
  // オーバーレイ折り畳み（ヘッダクリック）
  document.querySelectorAll('.ovl-head[data-collapse]').forEach(head => {
    head.addEventListener('click', () => {
      const ovl = head.closest('.ovl');
      ovl.classList.toggle('collapsed');
      head.querySelector('.tgl').textContent = ovl.classList.contains('collapsed') ? '+' : '−';
    });
  });
  // カード折り畳み
  document.querySelectorAll('.card-title[data-ccollapse]').forEach(title => {
    title.addEventListener('click', () => {
      const card = title.closest('.card');
      card.classList.toggle('collapsed');
      title.querySelector('.ctgl').textContent = card.classList.contains('collapsed') ? '▸' : '▾';
      if (!card.classList.contains('collapsed')) refreshCharts();
    });
  });
  // 売場詳細を閉じる
  document.getElementById('sd-close').addEventListener('click', () => selectShelf(null));
  window.addEventListener('resize', refreshCharts);
}

function refreshCharts() {
  if (activeView !== 'analytics') return;
  drawWaterfall(); drawTimeChart();
}

/* ---------- メインループ ---------- */
let lastT = performance.now();
function tick(t) {
  const realDt = Math.min((t - lastT) / 1000, 0.06);
  lastT = t;
  if (!S.paused) simStep(realDt * S.speed);
  if (activeView === '3d') {
    updateVisuals(realDt);
    renderer.render(scene, camera);
  }
  document.getElementById('sim-clock').textContent = fmtClock(STATS.simSec);
  requestAnimationFrame(tick);
}

function refreshDash() {
  renderMiniKPI(); renderBeacon();
  if (selectedShelfId) renderShelfDetail();
  if (activeView === 'analytics') {
    renderKPIs(); renderFunnel(); renderCross(); renderPhases(); renderMeasQuality(); renderShelfTable(); renderNovelty(); renderStock(); renderBenchmark();
    renderPersona(); renderRegops();
  }
}

/* ---------- 起動 ---------- */
initThree();
bindControls();
document.getElementById('sim-day').textContent = 'DAY ' + STATS.day;
// ウォームアップ: 12:30 まで先行実行してダッシュボードにデータを貯める
while (STATS.simSec < 12.5 * 3600) simStep(30);
refreshDash(); renderActions();
setInterval(refreshDash, 1000);
setInterval(() => { if (activeView === 'analytics') { renderKPIs(); renderFunnel(); renderShelfTable(); renderNovelty(); renderStock(); refreshCharts(); } }, 2500);
setInterval(renderActions, 4000);
requestAnimationFrame(tick);
setTimeout(() => document.getElementById('loading').classList.add('hide'), 500);
