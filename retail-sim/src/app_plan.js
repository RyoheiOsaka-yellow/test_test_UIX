/* =========================================================================
   エリア実験・予算配分ページ
   - ジオリフト実験設計（AREA MAP）: エリア選定 → 検出力プレビュー → モニタリング → 校正反映
   - 予算配分シミュレーション（L3-1）: レスポンスカーブ＋限界iROAS均等化の逐次配分ソルバー
   - 店舗別γ 地域補正マップ（L2）: 人流が広告効果を増幅する度合い
   ========================================================================= */

/* ---------- ジオリフト（AREA MAP） ---------- */
const geoRng = mulberry32(4210);
const GEO = {
  budget: 300,                 // 実験予算（万円）
  assign: {},                  // districtId -> 'treat' | 'ctrl' | 'excl'
  running: false, result: null,
  calibrated: false, calibFactor: 1,
};
window.GEO = GEO;

const DISTRICT_NAMES = [
  '新宿', '渋谷', '池袋', '中野', '杉並',
  '練馬', '世田谷', '目黒', '品川', '港',
  '千代田', '文京', '豊島', '板橋', '北',
  '台東', '墨田', '江東', '大田', '荒川',
];
const DISTRICTS = DISTRICT_NAMES.map((name, i) => {
  const foot = Math.round(70 + geoRng() * 70);          // 人流指数
  const pre = [];
  for (let d = 0; d < 14; d++) {
    pre.push(foot * (1 + 0.06 * Math.sin((d + i) / 2.2) + (geoRng() - 0.5) * 0.07));
  }
  return { id: i, name, foot, pre, col: i % 5, row: Math.floor(i / 5) };
});

function geoSelection() {
  const treat = DISTRICTS.filter(d => GEO.assign[d.id] === 'treat');
  const ctrl = DISTRICTS.filter(d => GEO.assign[d.id] === 'ctrl');
  return { treat, ctrl };
}
function avgSeries(list) {
  if (!list.length) return null;
  const out = [];
  for (let d = 0; d < 14; d++) out.push(list.reduce((a, x) => a + x.pre[d], 0) / list.length);
  return out;
}
function geoPower() {
  const { treat, ctrl } = geoSelection();
  if (!treat.length || !ctrl.length) return { ready: false, treat, ctrl };
  const ts = avgSeries(treat), cs = avgSeries(ctrl);
  const diff = ts.map((v, i) => v - cs[i]);
  const mean = diff.reduce((a, v) => a + v, 0) / diff.length;
  const sigma = Math.sqrt(diff.reduce((a, v) => a + (v - mean) ** 2, 0) / diff.length);
  const meanTreat = ts.reduce((a, v) => a + v, 0) / ts.length;
  // MDE = (z_a/2 + z_b) × σ_diff × √(1/Nt+1/Nc) ／ √(T×0.7)（期間の自己相関補正）
  const mdeAbs = 2.8 * sigma * Math.sqrt(1 / treat.length + 1 / ctrl.length) / Math.sqrt(14 * 0.7);
  const mdePct = mdeAbs / meanTreat;
  const liftPct = 0.045 * (GEO.budget / 100) / Math.sqrt(treat.length);   // 予算→期待リフト
  // 近接ペア警告（隣接セル同士の処置/対照）
  let contamination = false;
  treat.forEach(a => ctrl.forEach(b => {
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1) contamination = true;
  }));
  return { ready: true, treat, ctrl, sigma, meanTreat, mdePct, liftPct, contamination, ts, cs };
}

/* ---- AREA MAP 描画 ---- */
let mapHits = [];
function drawGeoMap() {
  const cv = document.getElementById('cv-map');
  const setup = setupCanvas(cv, 330);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  const mL = 8, mT = 8, gw = (w - 16) / 5, gh = (h - 16) / 4;
  mapHits = [];
  const colors = {
    treat: ['#fdf2f6', '#d55181'], ctrl: ['#eff6fd', '#3f8fd6'],
    excl: ['#f0f2f5', '#b6c0cc'], none: ['#ffffff', '#d8e1ec'],
  };
  const p = geoPower();
  DISTRICTS.forEach(d => {
    const x = mL + d.col * gw, y = mT + d.row * gh;
    const st = GEO.assign[d.id] || 'none';
    const [fill, stroke] = colors[st];
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = st === 'none' ? 1 : 2;
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, gw - 6, gh - 6, 8); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = st === 'none' ? '#45586e' : stroke;
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(d.name, x + 11, y + 21);
    // 人流指数バー
    ctx.fillStyle = 'rgba(15,159,186,0.18)';
    ctx.fillRect(x + 11, y + gh - 20, (gw - 24), 5);
    ctx.fillStyle = '#0f9fba';
    ctx.fillRect(x + 11, y + gh - 20, (gw - 24) * (d.foot / 140), 5);
    ctx.fillStyle = '#9aa9bc'; ctx.font = '8.5px sans-serif';
    ctx.fillText('人流 ' + d.foot, x + 11, y + gh - 26);
    const badge = { treat: '処置', ctrl: '対照', excl: '除外' }[st];
    if (badge) {
      ctx.fillStyle = stroke; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(badge, x + gw - 10, y + 20);
    }
    mapHits.push({ x: x + 3, y: y + 3, w: gw - 6, h: gh - 6, id: d.id });
  });
  // 近接ペア警告（点線）
  if (p.ready && p.contamination) {
    ctx.strokeStyle = 'rgba(197,48,48,0.7)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    p.treat.forEach(a => p.ctrl.forEach(b => {
      if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1) {
        ctx.beginPath();
        ctx.moveTo(mL + a.col * gw + gw / 2, mT + a.row * gh + gh / 2);
        ctx.lineTo(mL + b.col * gw + gw / 2, mT + b.row * gh + gh / 2);
        ctx.stroke();
      }
    }));
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  document.getElementById('map-legend').innerHTML =
    `<span class="li"><span class="sw" style="background:#d55181"></span>処置群（広告増額）</span>` +
    `<span class="li"><span class="sw" style="background:#3f8fd6"></span>対照群</span>` +
    `<span class="li"><span class="sw" style="background:#b6c0cc"></span>除外</span>` +
    (p.ready && p.contamination ? `<span class="li" style="color:${COL.bad}">⚠ 近接ペア: 汚染リスク（点線）</span>` : '');
}
document.getElementById('cv-map').addEventListener('click', e => {
  if (GEO.running) return;
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const hit = mapHits.find(hh => mx >= hh.x && mx <= hh.x + hh.w && my >= hh.y && my <= hh.y + hh.h);
  if (!hit) return;
  const cur = GEO.assign[hit.id];
  GEO.assign[hit.id] = cur === 'treat' ? 'ctrl' : cur === 'ctrl' ? 'excl' : cur === 'excl' ? undefined : 'treat';
  renderGeo();
});

/* ---- 検出力プレビュー ---- */
function renderGeoPower() {
  const el = document.getElementById('geo-power');
  const p = geoPower();
  if (!p.ready) {
    el.innerHTML = `エリアを選定してください（処置群・対照群 各1以上）。<br>
      <span style="color:var(--text-faint)">製品が候補を自動提案し、運用者がクリックで調整します（状態1: エリア選定）。</span>`;
    return;
  }
  const detectable = p.liftPct >= p.mdePct;
  el.innerHTML = `
    <div>処置 ${p.treat.length}エリア / 対照 ${p.ctrl.length}エリア ・ 実験期間14日</div>
    <div style="margin-top:4px">予算 <b>${GEO.budget}万円</b> の期待リフト:
      <span class="pv">${fmtPct(p.liftPct, 1)}</span></div>
    <div>検出可能な最小効果（MDE）: <span class="pv">${fmtPct(p.mdePct, 1)}</span></div>
    <div class="${detectable ? 'power-ok' : 'power-ng'}" style="margin-top:4px;font-weight:700">
      ${detectable ? '✓ 検出可能 — この設計で実験できます' : '✗ 検出不能 — 予算増額かエリア追加が必要です'}
    </div>
    ${p.contamination ? `<div style="color:${COL.bad};margin-top:3px">⚠ 処置と対照が隣接。商圏の重なりによる汚染に注意（除外帯の設置を推奨）。</div>` : ''}`;
}

/* ---- モニタリング ---- */
function drawGeoChart() {
  const cv = document.getElementById('cv-geo');
  const setup = setupCanvas(cv, 150);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);
  const p = geoPower();
  if (!p.ready) { ctx.fillStyle = COL.faint; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('（選定後に処置/対照の推移を表示）', w / 2, h / 2); return; }

  let ts = p.ts.slice(), cs = p.cs.slice();
  if (GEO.result) { ts = ts.concat(GEO.result.tPost); cs = cs.concat(GEO.result.cPost); }
  const N = ts.length;
  const all = ts.concat(cs);
  const maxV = Math.max(...all) * 1.06, minV = Math.min(...all) * 0.94;
  const mL2 = 30, mR2 = 6, mT2 = 8, mB2 = 16;
  const xOf = i => mL2 + (i / (N - 1)) * (w - mL2 - mR2);
  const yOf = v => mT2 + (h - mT2 - mB2) * (1 - (v - minV) / (maxV - minV));

  ctx.strokeStyle = COL.grid;
  for (let g = 0; g <= 2; g++) { const y = mT2 + (h - mT2 - mB2) * g / 2; ctx.beginPath(); ctx.moveTo(mL2, y); ctx.lineTo(w - mR2, y); ctx.stroke(); }
  if (N > 14) {
    const x = xOf(13.5);
    ctx.strokeStyle = 'rgba(22,40,60,0.4)'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, mT2); ctx.lineTo(x, h - mB2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = COL.text; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('介入', x, mT2 + 8);
  }
  const line = (arr, color, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; if (dash) ctx.setLineDash([4, 3]);
    ctx.beginPath(); arr.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
  };
  line(cs, '#3f8fd6'); line(ts, '#d55181');
  ctx.fillStyle = COL.faint; ctx.font = '8.5px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('赤=処置 青=対照(合成)', mL2 + 2, h - 4);
}

function geoStart() {
  const p = geoPower();
  if (!p.ready) return;
  const lift = p.liftPct;
  const tPost = [], cPost = [];
  for (let d = 0; d < 14; d++) {
    const base = p.cs[(d + 3) % 14] * (1 + (geoRng() - 0.5) * 0.05);
    cPost.push(base);
    const ramp = Math.min(1, (d + 1) / 4);
    tPost.push(base * (1 + lift * ramp * (0.85 + geoRng() * 0.3)) + (p.ts[d % 14] - p.cs[d % 14]));
  }
  // 実証iROAS = モデル予測 × 実証ギャップ（管理画面ベースの楽観を実験が引き戻す。scripted 0.78〜0.96）
  const modelIroas = Math.max((computeProjection().adInc * 7) / Math.max(S.budget * 1e4, 1), 0.3);
  const iroasMeasured = modelIroas * (0.78 + geoRng() * 0.18);
  const incSales = iroasMeasured * GEO.budget * 1e4;
  const incVisits = incSales / (STORE.basket * STORE.buyRate);
  GEO.running = true;
  GEO.result = { tPost, cPost, incVisits, incSales, iroasMeasured };
  renderGeo();
}

function renderGeoResult() {
  const el = document.getElementById('geo-result');
  if (!GEO.result) { el.innerHTML = ''; return; }
  const r = GEO.result;
  const modelIroas = (computeProjection().adInc * 7) / Math.max(S.budget * 1e4, 1);
  const calib = clamp(r.iroasMeasured / Math.max(modelIroas, 0.05), 0.6, 1.15);
  el.innerHTML = `
    <div class="power-box">
      <b>実験結果（14日間・ASCM合成対照）</b><br>
      増分来店 <span class="pv">+${fmtNum(r.incVisits)}人</span>（±${fmtNum(r.incVisits * 0.16)}）・
      増分売上 <span class="pv">${fmtYen(r.incSales)}</span><br>
      実証iROAS <span class="pv">${r.iroasMeasured.toFixed(2)}×</span> ／ モデル予測 ${modelIroas.toFixed(2)}× →
      較正係数 <b>${calib.toFixed(2)}</b> ${confChip(r.iroasMeasured > 1 ? 'hi' : 'md')}
      <div class="sp-btnrow" style="margin-top:7px">
        <button id="geo-calib">較正係数をモデルへ反映</button>
        <button id="geo-stop" class="ghost">実験を終了</button>
      </div>
    </div>`;
  document.getElementById('geo-calib').addEventListener('click', () => {
    GEO.calibrated = true; GEO.calibFactor = calib;
    document.getElementById('geo-badge').style.display = '';
    beacon(`ジオリフト校正をモデルへ反映（×${calib.toFixed(2)}）`, 'seg-buy');
    renderGeo(); refreshCharts();
  });
  document.getElementById('geo-stop').addEventListener('click', () => {
    GEO.running = false; GEO.result = null; renderGeo();
  });
}

function geoPropose() {
  GEO.assign = {};
  // 人流指数が近いペアを3組選び処置/対照に割付、その隣接は除外
  const sorted = DISTRICTS.slice().sort((a, b) => a.foot - b.foot);
  let pairs = 0;
  for (let i = 0; i + 1 < sorted.length && pairs < 3; i += 2) {
    const a = sorted[i], b = sorted[i + 1];
    const adjacent = Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
    if (adjacent) continue;
    GEO.assign[a.id] = pairs % 2 === 0 ? 'treat' : 'ctrl';
    GEO.assign[b.id] = pairs % 2 === 0 ? 'ctrl' : 'treat';
    pairs++;
  }
  renderGeo();
}

function renderGeo() {
  drawGeoMap(); renderGeoPower(); drawGeoChart(); renderGeoResult();
}

/* ---------- 予算配分シミュレーション（L3-1） ---------- */
const MEDIA = [
  { key: 'google', name: 'Google検索', a: 5.2, b: 0.50, cur: 0.30 },
  { key: 'meta', name: 'Meta', a: 3.6, b: 0.62, cur: 0.40 },
  { key: 'tiktok', name: 'TikTok', a: 2.2, b: 0.72, cur: 0.15 },
  { key: 'line', name: 'LINE', a: 1.9, b: 0.68, cur: 0.10 },
  { key: 'retail', name: '店内サイネージ', a: 1.7, b: 0.75, cur: 0.05 },
];
const ALLOC = { mode: 'normal' };
function mediaOutcome(m, spend) { return m.a * Math.pow(Math.max(spend, 0), m.b); }
function mediaMarginal(m, spend) { return m.a * m.b * Math.pow(Math.max(spend, 0.5), m.b - 1); }

function solveAllocation() {
  const total = Math.max(S.budget, 10);
  const cur = MEDIA.map(m => m.cur * total);
  const lo = MEDIA.map((m, i) => ALLOC.mode === 'normal' ? cur[i] * 0.7 : 0);
  const hi = MEDIA.map((m, i) => ALLOC.mode === 'normal' ? cur[i] * 1.3 : total);
  const rec = lo.slice();
  let remain = total - rec.reduce((a, v) => a + v, 0);
  const step = Math.max(total / 200, 0.25);
  let guard = 0;
  while (remain > 1e-6 && guard++ < 4000) {
    let bi = -1, bm = -1;
    MEDIA.forEach((m, i) => {
      if (rec[i] >= hi[i]) return;
      const mg = mediaMarginal(m, rec[i]);
      if (mg > bm) { bm = mg; bi = i; }
    });
    if (bi < 0) break;
    const add = Math.min(step, remain, hi[bi] - rec[bi]);
    rec[bi] += add; remain -= add;
  }
  const curCV = cur.reduce((a, v, i) => a + mediaOutcome(MEDIA[i], v), 0);
  const recCV = rec.reduce((a, v, i) => a + mediaOutcome(MEDIA[i], v), 0);
  return { total, cur, rec, curCV, recCV };
}

function renderAlloc() {
  const el = document.getElementById('alloc-body');
  if (!el) return;
  const r = solveAllocation();
  const maxSpend = Math.max(...r.cur, ...r.rec, 1);
  const deltas = MEDIA.map((m, i) => ({ m, d: r.rec[i] - r.cur[i], mg: mediaMarginal(m, r.rec[i]) }));
  const up = deltas.slice().sort((a, b) => b.d - a.d)[0];
  const down = deltas.slice().sort((a, b) => a.d - b.d)[0];
  const dCV = r.recCV - r.curCV;
  el.innerHTML = MEDIA.map((m, i) => `
    <div class="media-row">
      <span class="ml">${m.name}</span>
      <span class="mb">
        <span class="bar" style="width:${(r.cur[i] / maxSpend * 100).toFixed(1)}%;background:#b6c4d4"></span>
        <span class="bar" style="width:${(r.rec[i] / maxSpend * 100).toFixed(1)}%;background:${COL.s1}"></span>
      </span>
      <span class="mv">${Math.round(r.cur[i])}→<b>${Math.round(r.rec[i])}万</b><br>
        <span style="color:var(--text-faint)">限界ROAS ${deltas[i].mg.toFixed(2)}</span></span>
    </div>`).join('') + `
    <div class="legend" style="margin-top:6px">
      <span class="li"><span class="sw" style="background:#b6c4d4"></span>現状</span>
      <span class="li"><span class="sw" style="background:${COL.s1}"></span>推奨（限界ROAS均等化）</span>
    </div>
    <div class="power-box" style="margin-top:9px">
      合計成果: <b>${r.curCV.toFixed(0)}件</b> → <span class="pv power-ok">${r.recCV.toFixed(0)}件</span>
      （+${dCV.toFixed(1)}件 ±${(dCV * 0.35).toFixed(1)}） ${confChip(dCV > 2 ? 'hi' : 'md')}<br>
      <span style="color:var(--text-muted)">${up.m.name}は伸びしろがあり+${up.d.toFixed(0)}万円、${down.m.name}は飽和域のため${down.d.toFixed(0)}万円。
      すべての媒体で「最後の1円の効果」が等しくなる点に配分（週次予算 ${r.total}万円・シナリオの広告予算と連動）。</span>
    </div>`;
}
document.getElementById('alloc-mode').addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]');
  if (!b) return;
  ALLOC.mode = b.dataset.mode;
  document.querySelectorAll('#alloc-mode button').forEach(x => x.classList.toggle('active', x === b));
  renderAlloc();
});

/* ---------- 店舗別γ（L2） ---------- */
const GAMMA_STORES = [
  { name: '新宿駅前店（コンビニ）', foot: 132, gamma: 0.42, conf: 'hi', fac: 'conbini' },
  { name: '渋谷センター街店', foot: 128, gamma: 0.38, conf: 'hi' },
  { name: '池袋東口店', foot: 118, gamma: 0.31, conf: 'md' },
  { name: '中野店', foot: 96, gamma: 0.18, conf: 'md' },
  { name: '郊外ロードサイド店', foot: 64, gamma: 0.04, conf: 'lo' },
  { name: '百貨店 新宿本店（デパ地下）', foot: 140, gamma: 0.51, conf: 'hi', fac: 'depato' },
];
function renderGamma() {
  const el = document.getElementById('gamma-body');
  if (!el) return;
  el.innerHTML = GAMMA_STORES.map(s => {
    const active = s.fac === FKEY;
    const v = clamp(s.gamma / 0.55, 0, 1);
    const color = `rgb(${Math.round(lerp(159, 29, v))},${Math.round(lerp(196, 111, v))},${Math.round(lerp(232, 184, v))})`;
    const advice = s.gamma >= 0.3 ? '広告を厚くすべき店舗' : s.gamma >= 0.1 ? '中間' : '立地で完結（広告効果薄）';
    return `
      <div class="media-row" style="${active ? 'background:#f0f7fa;border-radius:7px;padding:4px 6px' : ''}">
        <span class="ml" style="width:172px">${active ? '▶ ' : ''}${s.name}</span>
        <span class="mb"><span class="bar" style="width:${(v * 100).toFixed(0)}%;background:${color}"></span></span>
        <span class="mv">γ=${s.gamma.toFixed(2)}<br><span style="color:var(--text-faint)">${advice}</span></span>
      </div>
      <div class="mde-text" style="margin:-1px 0 4px 180px">人流指数 ${s.foot} ・ ${confChip(s.conf)}</div>`;
  }).join('') + `
    <div class="mde-text" style="margin-top:7px;line-height:1.6">
      γ = 経路B「メディア効果 × (1+γ×人流偏差)」の店舗別係数（多階層ベイズ・partial pooling）。
      データが薄い店舗は地域→全体の事前分布に縮約され、γ=0（人流が広告効果を変調しない）も正直に許容する。
      濃い=広告を厚くすべき店舗、薄い=立地で完結。
    </div>`;
}

/* ---------- ページ描画 ---------- */
function renderPlanPage() {
  renderGeo(); renderAlloc(); renderGamma();
}
window.renderPlanPage = renderPlanPage;

document.getElementById('geo-budget').addEventListener('input', e => {
  GEO.budget = +e.target.value;
  document.getElementById('v-geobudget').textContent = GEO.budget + '万円';
  renderGeoPower();
  if (GEO.result) renderGeoResult();
});
document.getElementById('geo-propose').addEventListener('click', geoPropose);
document.getElementById('geo-start').addEventListener('click', geoStart);
document.getElementById('geo-clear').addEventListener('click', () => {
  GEO.assign = {}; GEO.running = false; GEO.result = null; renderGeo();
});
