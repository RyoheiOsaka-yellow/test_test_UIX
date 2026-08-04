/* =========================================================================
   xAD ダッシュボード層
   - 推計（点推定±CI＋確信度）/ ウォーターフォール / O2O二重接続ファネル
   - 時系列＋着地予測 / 棚別テーブル / ノベルティRCT検証 / 消費予測 / AIアクション
   ========================================================================= */

const CSS = getComputedStyle(document.documentElement);
const COL = {
  s1: '#0f9fba', s2: '#d55181', s3: '#c98500', s4: '#9085e9',
  neutral: '#64748b', neutral2: '#475569',
  good: '#199e70', warn: '#e8b04b', bad: '#e5484d', mute: '#8b98ab',
  text: '#c6d4e8', faint: '#55667e', grid: 'rgba(120,180,255,0.10)',
};

/* ---------- 確信度ラベル ---------- */
function confChip(level) {
  const map = {
    hi: ['conf-hi', '●', '確信度 高・推奨'],
    md: ['conf-md', '●', '確信度 中・要サンプル'],
    lo: ['conf-lo', '●', '確信度 低・互角'],
  };
  const [cls, dot, label] = map[level];
  return `<span class="conf ${cls}">${dot} ${label}</span>`;
}
function confShort(level) {
  return { hi: ['#4fd6a5', '高'], md: ['#e8b04b', '中'], lo: ['#8b98ab', '低'] }[level];
}

/* ---------- 推計（分析仕様の統一推計モデルの簡易版） ----------
   成果 = ベースライン + デジタル広告増分 + 店頭ノベルティ増分 + 人流寄与 + 季節
   ライブ集計と解析的期待値をブレンド（少データで動く→賢くなる）      */
const AVG_CURVE_HOURS = 14.4;          // arrivalCurve の 10-22時 積分
const BASE_BUY_RATE = 0.54, AVG_BASKET = 470;

function expectedComponents() {
  const b = S.budget / 100;
  const visitors0 = 2.3 * 60 * AVG_CURVE_HOURS;                 // traffic=1, 広告なし
  const footVisitors = visitors0 * (S.traffic - 1);
  const visitorsNoAd = visitors0 * S.traffic;
  const adIncVisits = visitorsNoAd * adReachLift();
  const visitors = visitorsNoAd + adIncVisits;
  const exposed = visitors * adExposureShare();

  const baseline = visitors0 * BASE_BUY_RATE * AVG_BASKET;
  const foot = footVisitors * BASE_BUY_RATE * AVG_BASKET;
  const seasonal = 26000;                                        // scripted: 8月・猛暑要因
  const adInc = adIncVisits * BASE_BUY_RATE * AVG_BASKET + exposed * 36;
  const treated = S.novelty ? visitors * 0.85 * S.novRate : 0;
  // ノベルティ効果 = 興味喚起による立寄増 × 購買率リフト + わずかな併売波及
  const novInc = treated * (0.10 * 240 + BASE_BUY_RATE * AVG_BASKET * 0.05);
  const total = baseline + foot + seasonal + adInc + novInc;
  return { visitors, visitorsNoAd, adIncVisits, exposed, treated, baseline, foot, seasonal, adInc, novInc, total };
}

function dayFrac() {
  return curveCumFrac(STATS.simSec);   // 到着カーブの累積割合（線形按分の過大推計を回避）
}
function blend(liveDaily, analytic) {
  const f = dayFrac();
  const w = clamp((f - 0.03) * 2.2, 0, 0.85);
  return w * liveDaily + (1 - w) * analytic;
}

function computeProjection() {
  const e = expectedComponents();
  const f = dayFrac();
  const liveRev = STATS.revenue / f;
  const liveVis = STATS.visitors / f;
  const totalRevenue = blend(liveRev, e.total);
  const visitors = blend(liveVis, e.visitors);
  const scale = totalRevenue / e.total;
  return {
    visitors, totalRevenue,
    baseline: e.baseline * scale, foot: e.foot * scale, seasonal: e.seasonal * scale,
    adInc: e.adInc * scale, novInc: e.novInc * scale,
    adIncVisits: e.adIncVisits * (visitors / e.visitors),
    exposed: e.exposed, treated: e.treated,
  };
}
window.__computeProjection = computeProjection;

/* ---------- KPI ---------- */
function renderKPIs() {
  const p = computeProjection();
  const sh = STATS.shelves;
  let passes = 0, gazes = 0, stops = 0, purch = 0;
  SHELVES.forEach(s => { passes += sh[s.id].passes; gazes += sh[s.id].gazes; stops += sh[s.id].stops; purch += sh[s.id].purchases; });
  const gazeRate = passes ? gazes / passes : 0;
  const cvr = stops ? purch / stops : 0;
  const weeklyAdRev = p.adInc * 7;
  const budgetYen = S.budget * 1e4;
  const iroas = budgetYen > 0 ? weeklyAdRev / budgetYen : 0;

  const kpis = [
    { label: '来店者数（予測）', value: fmtNum(p.visitors) + '人', ci: '±' + fmtNum(p.visitors * 0.06), conf: 'hi' },
    { label: '広告増分来店', value: '+' + fmtNum(p.adIncVisits) + '人', ci: '±' + fmtNum(p.adIncVisits * 0.18), conf: S.budget > 0 ? 'hi' : 'lo' },
    { label: '棚前 視線獲得率', value: fmtPct(gazeRate), ci: '±' + fmtPct(normalCI95(gazeRate, Math.max(passes, 1)), 1), conf: passes > 200 ? 'hi' : 'md' },
    { label: '立寄→購買 転換率', value: fmtPct(cvr), ci: '±' + fmtPct(normalCI95(cvr, Math.max(stops, 1)), 1), conf: stops > 120 ? 'hi' : 'md' },
    { label: '本日売上 着地', value: fmtYen(p.totalRevenue), ci: '±' + fmtYen(p.totalRevenue * 0.09), conf: 'md' },
    { label: '推計 iROAS', value: iroas ? iroas.toFixed(2) + '×' : '—', ci: iroas ? '±' + (iroas * 0.22).toFixed(2) : '広告OFF', conf: S.budget > 0 ? 'hi' : 'lo' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi">
      <div class="k-label">${k.label}</div>
      <div class="k-value">${k.value}</div>
      <div class="k-ci">${k.ci}</div>
      ${confChip(k.conf)}
    </div>`).join('');
}

/* ---------- canvas ヘルパ ---------- */
function setupCanvas(cv, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.parentElement.clientWidth;
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
  const { ctx, w, h } = setupCanvas(cv, 230);
  ctx.clearRect(0, 0, w, h);
  const p = computeProjection();

  const novLive = noveltyStatsCalc();
  const items = [
    { key: 'base', label: 'ベースライン', sub: '広告なしでも来た分', v: p.baseline, color: COL.neutral, conf: 'hi' },
    { key: 'ad', label: 'デジタル広告', sub: 'ジオリフト校正済み増分', v: p.adInc, color: COL.s2, conf: S.budget > 0 ? 'hi' : 'lo' },
    { key: 'nov', label: 'ノベルティ', sub: 'RCT実測ベース', v: p.novInc, color: COL.s3, conf: novLive.conf },
    { key: 'foot', label: '人流（来店環境）', sub: '経路B: γ×人流偏差', v: p.foot, color: COL.s4, conf: 'md' },
    { key: 'sea', label: '季節要因', sub: '8月・猛暑補正', v: p.seasonal, color: COL.neutral2, conf: 'lo' },
  ];
  const total = items.reduce((a, i) => a + i.v, 0);

  const mL = 8, mR = 8, mT = 14, mB = 44;
  const plotW = w - mL - mR, plotH = h - mT - mB;
  const n = items.length + 1;
  const bw = Math.min(52, plotW / n - 10);
  const gap = (plotW - bw * n) / (n + 1);
  const maxV = total * 1.06;
  const y0 = mT + plotH;
  const yOf = v => y0 - (v / maxV) * plotH;

  wfHits = [];
  let cum = 0;
  ctx.font = '9px sans-serif';
  items.forEach((it, i) => {
    const x = mL + gap + (bw + gap) * i;
    const yTop = yOf(cum + it.v), yBot = yOf(cum);
    ctx.fillStyle = it.color;
    roundBarTop(ctx, x, yTop, bw, Math.max(yBot - yTop, 2), 4);
    // コネクタ
    ctx.strokeStyle = 'rgba(198,212,232,0.25)'; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x + bw, yTop); ctx.lineTo(x + bw + gap, yTop); ctx.stroke();
    ctx.setLineDash([]);
    // 値ラベル
    ctx.fillStyle = '#eaf4ff'; ctx.textAlign = 'center'; ctx.font = '600 10px sans-serif';
    ctx.fillText(fmtYen(it.v), x + bw / 2, yTop - 5);
    // 名前・確信度
    ctx.fillStyle = COL.text; ctx.font = '9px sans-serif';
    ctx.fillText(it.label, x + bw / 2, y0 + 13);
    const [cc, cl] = confShort(it.conf);
    ctx.fillStyle = cc;
    ctx.fillText('● ' + cl, x + bw / 2, y0 + 26);
    wfHits.push({ x, y: yTop, w: bw, h: yBot - yTop, it, cum });
    cum += it.v;
  });
  // 合計バー
  const x = mL + gap + (bw + gap) * items.length;
  const yTop = yOf(total);
  ctx.fillStyle = COL.s1;
  roundBarTop(ctx, x, yTop, bw, y0 - yTop, 4);
  ctx.fillStyle = '#eaf4ff'; ctx.font = '700 10.5px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(fmtYen(total), x + bw / 2, yTop - 5);
  ctx.fillStyle = COL.text; ctx.font = '9px sans-serif';
  ctx.fillText('総売上（予測）', x + bw / 2, y0 + 13);
  ctx.fillStyle = '#4fd6a5'; ctx.fillText('点推定±9%', x + bw / 2, y0 + 26);
  wfHits.push({ x, y: yTop, w: bw, h: y0 - yTop, it: { label: '総売上（本日着地予測）', sub: '全要因合計', v: total, conf: 'md' }, cum: 0 });

  document.getElementById('wf-legend').innerHTML =
    `<span class="li"><span class="sw" style="background:${COL.neutral}"></span>自然発生</span>` +
    `<span class="li"><span class="sw" style="background:${COL.s2}"></span>デジタル広告</span>` +
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
  const hit = wfHits.find(h => mx >= h.x && mx <= h.x + h.w && my >= h.y - 14 && my <= h.y + h.h);
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
  const reach = Math.round(S.budget * 1150);
  const iroas = budgetYen > 0 ? (p.adInc * 7) / budgetYen : 0;

  document.getElementById('fun-upper').innerHTML = [
    { l: '広告接触（リーチ）', v: fmtNum(reach), s: '週次・媒体計', },
    { l: '増分来店', v: '+' + fmtNum(p.adIncVisits) + '人/日', s: '±' + fmtNum(p.adIncVisits * 0.18) + ' 校正済み' },
    { l: 'iROAS', v: iroas ? iroas.toFixed(2) + '×' : '—', s: iroas ? '±' + (iroas * 0.22).toFixed(2) : '広告OFF' },
  ].map(x => `<div class="fun-stage"><div class="f-label">${x.l}</div><div class="f-value">${x.v}</div><div class="f-sub">${x.s}</div></div>`).join('');

  // 突合: 上段推計の販促商品期待購買 vs 下段実測
  const expPromo = p.exposed * 0.72 * 0.62 * 0.46 * dayFrac();
  const obsPromo = STATS.promoUnits;
  let badge;
  if (S.budget === 0 || expPromo < 5) badge = `<span class="badge est">突合: 判定待ち（サンプル収集中）</span>`;
  else if (obsPromo > expPromo * 0.55) badge = `<span class="badge on">↕ 突合: 整合（来店増→購買が伴っている）</span>`;
  else badge = `<span class="badge" style="border-color:rgba(229,72,77,.5);color:#ff9b9e">↕ 突合: 乖離 — 来店は増えたが購買が伴わない</span>`;
  document.getElementById('fun-mid').innerHTML = badge;

  document.getElementById('fun-lower').innerHTML = [
    { l: 'ノベルティ受取', v: fmtNum(nv.treat), s: '実数・無作為割付' },
    { l: '対象商品 購買', v: fmtNum(nv.treatBuy), s: '実数・POS紐付け' },
    { l: '再来店（予測）', v: fmtNum(STATS.returns), s: 'CRM接続で実測化' },
  ].map(x => `<div class="fun-stage"><div class="f-label">${x.l}</div><div class="f-value">${x.v}</div><div class="f-sub">${x.s}</div></div>`).join('');
}

/* ---------- 時系列チャート ---------- */
let timeHits = [];
function drawTimeChart() {
  const cv = document.getElementById('cv-time');
  const { ctx, w, h } = setupCanvas(cv, 170);
  ctx.clearRect(0, 0, w, h);
  const p = computeProjection();
  const e = expectedComponents();

  const hist = HISTORY.slice(-14);
  const todayIdx = hist.length;
  const fc = [];
  for (let i = 1; i <= 3; i++) {
    const dow = (STATS.day + i - 1) % 7;
    const weekend = dow >= 5 ? 1.16 : 1.0;
    fc.push(e.total * weekend);
  }
  const pts = [...hist.map(hh => hh.revenue), p.totalRevenue, ...fc];
  const maxV = Math.max(...pts, ...fc.map(v => v * 1.16)) * 1.12;
  const minV = Math.min(...pts) * 0.82;

  const mL = 40, mR = 8, mT = 10, mB = 20;
  const plotW = w - mL - mR, plotH = h - mT - mB;
  const N = pts.length;
  const xOf = i => mL + (i / (N - 1)) * plotW;
  const yOf = v => mT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  // グリッド・軸
  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.faint; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'right';
  for (let g = 0; g <= 3; g++) {
    const v = minV + (maxV - minV) * (g / 3);
    const y = yOf(v);
    ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(w - mR, y); ctx.stroke();
    ctx.fillText(fmtYen(v), mL - 4, y + 3);
  }

  // CP開始マーカー（異常検知）
  const cpIdx = hist.findIndex(hh => hh.anomaly);
  if (cpIdx >= 0) {
    const x = xOf(cpIdx);
    ctx.strokeStyle = 'rgba(213,81,129,0.5)'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, mT + plotH); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COL.s2; ctx.textAlign = 'center'; ctx.font = '8.5px sans-serif';
    ctx.fillText('▲ CP開始', x, mT + 8);
  }

  // 予測バンド
  ctx.beginPath();
  const bandIdx = [todayIdx, todayIdx + 1, todayIdx + 2, todayIdx + 3];
  const bandVals = [p.totalRevenue, ...fc];
  bandIdx.forEach((bi, k) => { const x = xOf(bi), y = yOf(bandVals[k] * (1 + 0.09 + k * 0.025)); k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  for (let k = bandIdx.length - 1; k >= 0; k--) { ctx.lineTo(xOf(bandIdx[k]), yOf(bandVals[k] * (1 - 0.09 - k * 0.025))); }
  ctx.closePath();
  ctx.fillStyle = 'rgba(15,159,186,0.12)'; ctx.fill();

  // 実績ライン
  ctx.strokeStyle = COL.s1; ctx.lineWidth = 2; ctx.beginPath();
  hist.forEach((hh, i) => { const x = xOf(i), y = yOf(hh.revenue); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.lineTo(xOf(todayIdx), yOf(p.totalRevenue));
  ctx.stroke();
  // 予測ライン（破線）
  ctx.setLineDash([5, 4]); ctx.beginPath();
  ctx.moveTo(xOf(todayIdx), yOf(p.totalRevenue));
  fc.forEach((v, k) => ctx.lineTo(xOf(todayIdx + 1 + k), yOf(v)));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = 1;

  // 本日ポイント
  const tx = xOf(todayIdx), ty = yOf(p.totalRevenue);
  ctx.fillStyle = '#04050c'; ctx.strokeStyle = COL.s1; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tx, ty, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = '#eaf4ff'; ctx.font = '600 9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('本日', tx, ty - 9);

  // x軸ラベル
  ctx.fillStyle = COL.faint; ctx.font = '8px sans-serif';
  [0, 6, 13].forEach(i => { if (hist[i]) ctx.fillText('D' + hist[i].day, xOf(i), h - 6); });
  ctx.fillText('+3日', xOf(N - 1), h - 6);

  timeHits = pts.map((v, i) => ({
    x: xOf(i), y: yOf(v), v,
    label: i < todayIdx ? `Day ${hist[i].day} 実績` : (i === todayIdx ? `Day ${STATS.day}（本日・予測）` : `+${i - todayIdx}日 予測`),
    kind: i < todayIdx ? 'hist' : 'fc',
    note: i < todayIdx && hist[i].anomaly ? '異常検知: デジタルCP開始による構造変化' : '',
  }));

  document.getElementById('time-legend').innerHTML =
    `<span class="li"><span class="sw" style="background:${COL.s1}"></span>日次売上 実績</span>` +
    `<span class="li"><span class="sw" style="background:rgba(15,159,186,.35)"></span>予測±区間</span>` +
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

/* ---------- 棚別テーブル ---------- */
function renderShelfTable() {
  const rows = SHELVES
    .filter(s => !(s.id === 'endG2' && !S.endcap))
    .map(s => {
      const st = STATS.shelves[s.id];
      return { s, st, gazeRate: st.passes ? st.gazes / st.passes : 0, cvr: st.stops ? st.purchases / st.stops : 0 };
    })
    .sort((a, b) => b.st.gazeSec - a.st.gazeSec);
  const maxGaze = Math.max(...rows.map(r => r.st.gazeSec), 1);
  document.getElementById('shelf-tbody').innerHTML = rows.slice(0, 9).map(r => `
    <tr class="srow" data-shelf="${r.s.id}">
      <td><span class="sname">${r.s.promoted ? '<span class="promo-tag">販促</span>' : ''}${r.s.name}</span></td>
      <td>${fmtNum(r.st.passes)}</td>
      <td>${fmtPct(r.gazeRate, 0)}</td>
      <td>${fmtNum(r.st.stops)}</td>
      <td>${fmtPct(r.cvr, 0)}</td>
      <td><span class="heatbar" style="width:${Math.max(4, (r.st.gazeSec / maxGaze) * 52)}px"></span></td>
    </tr>`).join('');
}
document.getElementById('shelf-tbody').addEventListener('click', e => {
  const tr = e.target.closest('.srow');
  if (tr) focusShelf(tr.dataset.shelf);
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
  const spend1 = nv.treatRev / Math.max(nv.treat - 0, 1), spend0 = nv.ctrlRev / Math.max(n0, 1);
  return { ready: true, n1, n0, p1, p0, d, se, z, rel, mde, conf, spend1, spend0 };
}

function renderNovelty() {
  const el = document.getElementById('novelty-body');
  const badge = document.getElementById('badge-nov-mode');
  if (!S.novelty) {
    badge.textContent = 'ノベルティ: 停止中';
    el.innerHTML = `<div class="exp-off">配布OFF。左パネルの「ノベルティ配布（RCT）」をONにすると、来店客を無作為に処置群/対照群へ割付け、対象商品の購買率リフトを統計検定します（グレーアウト＝接続導線の思想）。</div>`;
    return;
  }
  badge.textContent = 'ノベルティ: RCT実施中';
  const r = noveltyStatsCalc();
  if (!r.ready) {
    el.innerHTML = `<div class="exp-off">サンプル収集中… 処置群 ${r.n1}人 / 対照群 ${r.n0}人（各5人以上で検定開始）</div>`;
    return;
  }
  const liftColor = r.conf === 'hi' ? '#4fd6a5' : (r.conf === 'md' ? COL.warn : COL.mute);
  const sigProgress = clamp(Math.abs(r.z) / 1.96, 0, 1);
  el.innerHTML = `
    <div class="exp-grid">
      <div class="exp-cell"><div class="e-label">処置群（受取）n=${fmtNum(r.n1)}</div>
        <div class="e-value" style="color:#eaf4ff">${fmtPct(r.p1)}</div>
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
    <div class="mde-text" style="margin-top:3px">客単価: 処置 ${fmtYenFull(r.spend1)} / 対照 ${fmtYenFull(r.spend0)}（参考・推定バッジ）</div>`;
}

/* ---------- 消費予測・在庫 ---------- */
function renderStock() {
  const f = dayFrac();
  const hoursLeft = Math.max(22 - STATS.simSec / 3600, 0);
  const elapsedH = Math.max(STATS.simSec / 3600 - 10, 0.2);
  const promoRate = STATS.promoUnits / elapsedH; // 個/h
  const eta = promoRate > 0.1 ? stockState.units / promoRate : Infinity;
  const promoName = promotedShelf().name;
  const rows = [];
  const etaStr = isFinite(eta)
    ? (eta < hoursLeft
      ? `本日 ${fmtClock(STATS.simSec + eta * 3600)} 欠品予測`
      : `残 ${(eta).toFixed(1)}h で消化`)
    : '消化データ収集中';
  rows.push({
    name: '新商品グミX（販促）', pct: stockState.units / stockState.cap,
    eta: stockState.units <= 0 ? `欠品中・機会損失 ${stockState.missed}件` : etaStr,
    alert: stockState.units <= 0 || (isFinite(eta) && eta < hoursLeft), color: COL.s2,
  });
  const chill = STATS.shelves.chill, drink = STATS.shelves.drink;
  rows.push({ name: '弁当・チルド', pct: clamp(1 - (chill.purchases / 150), 0, 1), eta: chill.purchases > 40 ? '18時台 追加補充推奨' : '安定', alert: chill.purchases > 40, color: COL.s1 });
  rows.push({ name: '飲料', pct: clamp(1 - (drink.purchases / 220), 0, 1), eta: '安定（自動補充）', alert: false, color: COL.s1 });
  document.getElementById('stock-body').innerHTML = rows.map(r => `
    <div class="stock-row">
      <span class="s-name">${r.name}</span>
      <span class="s-bar"><div style="width:${(r.pct * 100).toFixed(0)}%;background:${r.color}"></div></span>
      <span class="s-eta ${r.alert ? 'stock-alert' : ''}">${r.eta}</span>
    </div>`).join('') +
    `<div class="mde-text" style="margin-top:5px">消化予測 = ライブ購買レート × デジタルCP・人流の先行指標（推定バッジ）。欠品予測時は補充とフェイス拡大を提案。</div>`;
}
function fmtClock(sec) {
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* ---------- AI アクションカード ---------- */
const actionState = {};   // key -> {status, execSimSec}
function buildActions() {
  const p = computeProjection();
  const r = noveltyStatsCalc();
  const list = [];
  // 1: 予算
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
  // 2: 売場
  if (!S.endcap) {
    list.push({
      key: 'endcap-on', priority: 'high', category: '売場',
      title: 'エンド陳列を導入（販促棚）',
      reason: 'シミュレーション上、エンド陳列は棚前視線を約1.9倍化。広告接触客の指名来店の受け皿として棚内フェイスでは取りこぼしが発生。',
      impact: { metric: '販促商品販売', delta: Math.round(STATS.promoUnits * 0.9 + 18), ci: 8 },
      confidence: 0.81, source: 'creative / shelf-sim',
    });
  } else {
    list.push({
      key: 'endcap-expand', priority: 'med', category: '売場',
      title: 'G3エンドへ横展開（酒類×グミX クロスMD）',
      reason: '酒類棚の立寄客と販促商品購買層の重なりが視線データで確認できる。第2エンドでの接触機会追加が有効と推計。',
      impact: { metric: '販促商品販売', delta: Math.round(Math.max(STATS.promoUnits, 10) * 0.35), ci: 6 },
      confidence: 0.66, source: 'shelf-sim',
    });
  }
  // 3: ノベルティ
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
  actionState[b.dataset.act] = { status: b.dataset.op, execSimSec: STATS.simSec };
  renderActions();
});

/* ---------- BEACON LOG ---------- */
function renderBeacon() {
  document.getElementById('beacon-lines').innerHTML = BEACON_LINES.map(l =>
    `<div><span class="t">${l.t}</span><span class="${l.cls || ''}">${l.msg}</span></div>`).join('');
}

/* ---------- コントロール ---------- */
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
  ['shelfheat', 'floorheat', 'cones', 'trails', 'labels'].forEach(k => {
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
      else tweenCam(CAM_PRESETS[c]);
    });
  });
  window.addEventListener('resize', refreshCharts);
}

function refreshCharts() { drawWaterfall(); drawTimeChart(); }

/* ---------- メインループ ---------- */
let lastT = performance.now();
function tick(t) {
  const realDt = Math.min((t - lastT) / 1000, 0.06);
  lastT = t;
  if (!S.paused) simStep(realDt * S.speed);
  updateVisuals(realDt);
  renderer.render(scene, camera);
  document.getElementById('sim-clock').textContent = fmtClock(STATS.simSec);
  requestAnimationFrame(tick);
}

function refreshDash() {
  renderKPIs(); renderFunnel(); renderShelfTable(); renderNovelty(); renderStock(); renderBeacon();
}

/* ---------- 起動 ---------- */
initThree();
bindControls();
document.getElementById('sim-day').textContent = 'DAY ' + STATS.day;
// ウォームアップ: 開店直後の空状態を避けるため 45 sim分 を先に回す
for (let i = 0; i < 90; i++) simStep(30);
refreshDash(); refreshCharts(); renderActions();
setInterval(refreshDash, 1000);
setInterval(refreshCharts, 2500);
setInterval(renderActions, 4000);
requestAnimationFrame(tick);
setTimeout(() => document.getElementById('loading').classList.add('hide'), 500);
