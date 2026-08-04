/* =========================================================================
   棚割シミュレーター（Shelf Planner）
   - どの段・どの位置に置くか / どのPOPか / ベタ付け有無 / フェイス数で
     視線→手取→購買がどう変わるかを推計
   - ゴールデンゾーン（床上85〜150cm・什器売上の8〜9割が集中とされる）と
     POP効果（設置で認知+25%・売上最大2倍の事例）の通説値をデモ用に丸めて使用
   - 「3Dへ反映」で PLANO 係数として本体シミュレーションに接続
   ========================================================================= */

const SHELF_TIERS = [
  { name: '最下段', height: '床上30cm', mult: 0.55 },
  { name: '中下段', height: '床上75cm', mult: 0.95 },
  { name: 'ゴールデン', height: '床上115cm', mult: 1.40, golden: true },
  { name: '上段', height: '床上155cm', mult: 0.90 },
];
const SHELF_COLS = 8;
const SHELF_POPS = {
  none: { label: 'なし', g: 1.0, c: 1.0, cost: 0 },
  price: { label: 'プライスカード', g: 1.05, c: 1.15, cost: 200 },
  swing: { label: 'スイングPOP', g: 1.30, c: 1.05, cost: 400 },
  topboard: { label: 'トップボード', g: 1.22, c: 1.10, cost: 800 },
  floor: { label: '床置き大型POP', g: 1.45, c: 1.12, cost: 1500 },
};
const BETA_COST = 35;             // ベタ付けおまけ原価/個
const MARGIN = 0.35;              // 粗利率

const SP = { tier: 2, col: 4, faces: 2, pop: 'swing', beta: true, flow: 'right' };
const SP_BASE = { tier: 1, col: 2, faces: 1, pop: 'none', beta: false };

function spColMult(col, flow) {
  const peak = flow === 'right' ? 5.2 : 1.8;   // 入口側にピーク
  return 0.85 + 0.35 * Math.exp(-((col - peak) ** 2) / 4.5);
}
function spFaceOppCost() { return FKEY === 'depato' ? 2500 : 800; }  // フェイス増の機会コスト/日

function spDailyPasses() {
  const p = computeProjection();
  return p.visitors * (FKEY === 'depato' ? 0.35 : 0.52);
}

function spCalc(cfg) {
  const pop = SHELF_POPS[cfg.pop];
  const tierM = SHELF_TIERS[cfg.tier].mult;
  const colM = spColMult(cfg.col, SP.flow);
  const faceM = Math.pow(cfg.faces, 0.35);
  const gazeP = clamp(0.34 * tierM * colM * pop.g * faceM, 0.02, 0.92);
  const pickP = clamp(0.32 * (cfg.beta ? 1.25 : 1) * (1 + 0.05 * (cfg.faces - 1)), 0.02, 0.85);
  const convP = clamp(0.52 * pop.c * (cfg.beta ? 1.30 : 1), 0.02, 0.95);
  const passes = spDailyPasses();
  const gazeN = passes * gazeP;
  const pickN = gazeN * pickP;
  const units = pickN * convP;
  const price = promotedShelf().price;
  const sales = units * price;
  const cost = pop.cost + (cfg.beta ? BETA_COST * units : 0) + (cfg.faces - 1) * spFaceOppCost();
  return { passes, gazeP, pickP, convP, gazeN, pickN, units, sales, margin: sales * MARGIN, cost, tierM, colM, faceM, pop };
}
function spLift() {
  const cur = spCalc(SP), base = spCalc(Object.assign({}, SP_BASE));
  const netInc = (cur.units - base.units) * promotedShelf().price * MARGIN - cur.cost;
  return { cur, base, lift: base.units > 0 ? cur.units / base.units - 1 : 0, netInc };
}

/* ---------- 棚プレビュー描画 ---------- */
let spHits = [];
function drawShelfPreview() {
  const cv = document.getElementById('cv-shelf');
  const setup = setupCanvas(cv, 360);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);

  const mL = 104, mR = 16, mT = 34, mB = 30;
  const plotW = w - mL - mR, plotH = h - mT - mB;
  const tierH = plotH / 4;
  const colW = plotW / SHELF_COLS;
  spHits = [];

  // ゴールデンゾーン帯（85-150cm ≒ 段3の帯＋段4の下端）
  const gTop = mT + tierH * 0.85, gBot = mT + tierH * 2.15;
  ctx.fillStyle = 'rgba(201,133,0,0.10)';
  ctx.fillRect(mL - 8, gTop, plotW + 8, gBot - gTop);
  ctx.strokeStyle = 'rgba(201,133,0,0.5)'; ctx.setLineDash([4, 3]);
  ctx.strokeRect(mL - 8, gTop, plotW + 8, gBot - gTop);
  ctx.setLineDash([]);

  // 什器フレーム
  ctx.strokeStyle = 'rgba(92,113,134,0.7)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(mL, mT, plotW, plotH);
  ctx.lineWidth = 1;

  const pop = SHELF_POPS[SP.pop];
  let maxAttn = 0;
  for (let t = 0; t < 4; t++) for (let c = 0; c < SHELF_COLS; c++) {
    const a = SHELF_TIERS[t].mult * spColMult(c, SP.flow);
    if (a > maxAttn) maxAttn = a;
  }

  for (let t = 0; t < 4; t++) {
    const rowY = mT + (3 - t) * tierH;         // t=0 が最下段（下に描画）
    // 段板
    ctx.strokeStyle = 'rgba(92,113,134,0.45)';
    ctx.beginPath(); ctx.moveTo(mL, rowY + tierH); ctx.lineTo(mL + plotW, rowY + tierH); ctx.stroke();
    // 段ラベル
    ctx.fillStyle = SHELF_TIERS[t].golden ? '#a36a06' : '#7a8ba0';
    ctx.font = SHELF_TIERS[t].golden ? '600 9.5px sans-serif' : '9.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(SHELF_TIERS[t].name, mL - 14, rowY + tierH / 2 - 2);
    ctx.fillText(SHELF_TIERS[t].height.replace('床上', ''), mL - 14, rowY + tierH / 2 + 11);

    for (let c = 0; c < SHELF_COLS; c++) {
      const x = mL + c * colW;
      const isPromoSlot = t === SP.tier && c >= SP.col && c < SP.col + SP.faces;
      // 視線ヒート
      const attn = SHELF_TIERS[t].mult * spColMult(c, SP.flow) / maxAttn;
      ctx.fillStyle = `rgba(29,111,184,${(attn * 0.30).toFixed(3)})`;
      ctx.fillRect(x + 1, rowY + 1, colW - 2, tierH - 2);
      // 商品ブロック
      const pw = (colW - 14) / 3;
      for (let i = 0; i < 3; i++) {
        const px = x + 5 + i * (pw + 2);
        const ph = tierH * (0.42 + ((c * 3 + i) % 3) * 0.07);
        const py = rowY + tierH - 4 - ph;
        if (isPromoSlot) {
          ctx.fillStyle = '#e36ba0';
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = '#b03a66'; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
          if (SP.beta) { // ベタ付けおまけ
            ctx.fillStyle = '#c98500';
            ctx.beginPath(); ctx.arc(px + pw - 3, py + 4, 3, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          ctx.fillStyle = ['#c3cedb', '#aebfd2', '#b8c9c2', '#cfc6b8'][(t + c + i) % 4];
          ctx.fillRect(px, py, pw, ph);
        }
      }
      spHits.push({ x: x, y: rowY, w: colW, h: tierH, tier: t, col: c });
    }
  }

  // 選択スロットの枠
  const selX = mL + SP.col * colW, selY = mT + (3 - SP.tier) * tierH;
  ctx.strokeStyle = '#0f9fba'; ctx.lineWidth = 2;
  ctx.strokeRect(selX + 1, selY + 1, colW * SP.faces - 2, tierH - 2);
  ctx.lineWidth = 1;

  // POP描画
  ctx.textAlign = 'center';
  if (SP.pop === 'topboard') {
    ctx.fillStyle = '#d55181';
    ctx.fillRect(mL + plotW * 0.25, mT - 22, plotW * 0.5, 16);
    ctx.fillStyle = '#fff'; ctx.font = '600 10px sans-serif';
    ctx.fillText('新商品 ' + STORE.promoName, mL + plotW * 0.5, mT - 10);
  } else if (SP.pop === 'swing') {
    const fx = selX + colW * SP.faces;
    ctx.fillStyle = '#d55181';
    ctx.beginPath();
    ctx.moveTo(fx, selY + 6); ctx.lineTo(fx + 30, selY + 12); ctx.lineTo(fx, selY + 20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 7px sans-serif';
    ctx.fillText('NEW', fx + 13, selY + 15);
  } else if (SP.pop === 'price') {
    ctx.fillStyle = '#f4d03f';
    ctx.fillRect(selX + 3, selY + tierH - 15, colW * SP.faces - 6, 12);
    ctx.fillStyle = '#7a5c00'; ctx.font = '600 8px sans-serif';
    ctx.fillText('¥' + promotedShelf().price, selX + colW * SP.faces / 2, selY + tierH - 6);
  } else if (SP.pop === 'floor') {
    ctx.fillStyle = 'rgba(213,81,129,0.85)';
    ctx.fillRect(mL + plotW * 0.32, mT + plotH + 4, plotW * 0.36, 18);
    ctx.fillStyle = '#fff'; ctx.font = '600 9px sans-serif';
    ctx.fillText('店頭大型POP', mL + plotW * 0.5, mT + plotH + 17);
  }

  // 導線矢印
  ctx.fillStyle = '#7a8ba0'; ctx.font = '9.5px sans-serif';
  const arrow = SP.flow === 'right' ? '◀ 客動線（入口side）' : '客動線（入口side） ▶';
  ctx.textAlign = SP.flow === 'right' ? 'right' : 'left';
  ctx.fillText(arrow, SP.flow === 'right' ? mL + plotW : mL, mT + plotH + 24);

  document.getElementById('sp-legend').innerHTML =
    `<span class="li"><span class="sw" style="background:#e36ba0"></span>${STORE.promoName}（${SP.faces}フェイス）</span>` +
    `<span class="li"><span class="sw" style="background:rgba(29,111,184,.35)"></span>視線ヒート予測</span>` +
    `<span class="li"><span class="sw" style="background:rgba(201,133,0,.35)"></span>ゴールデンゾーン</span>` +
    `<span class="li"><span class="sw" style="background:#c98500;border-radius:50%"></span>ベタ付けおまけ</span>`;
}

document.getElementById('cv-shelf').addEventListener('click', e => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const hit = spHits.find(s => mx >= s.x && mx < s.x + s.w && my >= s.y && my < s.y + s.h);
  if (hit) {
    SP.tier = hit.tier;
    SP.col = Math.min(hit.col, SHELF_COLS - SP.faces);
    renderShelfSim();
  }
});
document.getElementById('cv-shelf').addEventListener('mousemove', e => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const hit = spHits.find(s => mx >= s.x && mx < s.x + s.w && my >= s.y && my < s.y + s.h);
  if (hit) {
    const test = spCalc(Object.assign({}, SP, { tier: hit.tier, col: Math.min(hit.col, SHELF_COLS - SP.faces) }));
    showTip(e.clientX, e.clientY,
      `<b>${SHELF_TIERS[hit.tier].name}（${SHELF_TIERS[hit.tier].height}）・${hit.col + 1}列目</b><br>` +
      `ここに置いた場合: 約${fmtNum(test.units)}個/日<br>` +
      `<span style="color:${COL.faint}">視線係数 ×${(test.tierM * test.colM).toFixed(2)}（クリックで配置）</span>`);
  } else hideTip();
});
document.getElementById('cv-shelf').addEventListener('mouseleave', hideTip);

/* ---------- 結果パネル ---------- */
function renderShelfResult() {
  const { cur, base, lift, netInc } = spLift();
  const ci = 0.12;
  const funnel = [
    ['棚前通過', cur.passes, 1, COL.neutral],
    ['視線獲得', cur.gazeN, cur.gazeP, COL.s1],
    ['手に取り', cur.pickN, cur.pickP, COL.s4],
    ['購買', cur.units, cur.convP, COL.good],
  ];
  const maxN = cur.passes;
  const liftColor = lift > 0.15 ? COL.good : (lift > -0.05 ? COL.warn : COL.bad);
  document.getElementById('sp-result').innerHTML = `
    ${funnel.map(([l, v, p, c]) => `
      <div class="sd-frow"><span class="fl">${l}</span>
        <span class="fb"><div style="width:${Math.max(2.5, v / maxN * 100)}%;background:${c}"></div></span>
        <span class="fv">${fmtNum(v)}${l !== '棚前通過' ? `<span style="color:var(--text-faint);font-weight:400"> (${fmtPct(p, 0)})</span>` : ''}</span></div>`).join('')}
    <div class="sp-kpis">
      <div class="kpi"><div class="k-label">販売数 / 日</div><div class="k-value">${fmtNum(cur.units)}個</div><div class="k-ci">±${fmtNum(cur.units * ci)}</div></div>
      <div class="kpi"><div class="k-label">売上 / 日</div><div class="k-value">${fmtYen(cur.sales)}</div><div class="k-ci">±${fmtYen(cur.sales * ci)}</div></div>
      <div class="kpi"><div class="k-label">対 基準配置</div><div class="k-value" style="color:${liftColor}">${lift >= 0 ? '+' : ''}${fmtPct(lift, 0)}</div><div class="k-ci">基準: 中下段1F・POPなし</div></div>
    </div>
    <div class="sd-frow"><span class="fl">増分粗利 − コスト</span>
      <span class="fv" style="width:auto;color:${netInc > 0 ? COL.good : COL.bad}">${netInc >= 0 ? '+' : ''}${fmtYenFull(netInc)}/日</span></div>
    <div class="mde-text" style="margin-top:2px">コスト内訳: POP ${fmtYenFull(cur.pop.cost)} ＋ おまけ ${SP.beta ? fmtYenFull(BETA_COST * cur.units) : '¥0'} ＋ フェイス機会コスト ${fmtYenFull((SP.faces - 1) * spFaceOppCost())}</div>
    ${confChip(cur.passes > 400 ? 'hi' : 'md')}`;
}

function renderShelfFactors() {
  const { cur } = spLift();
  const rows = [
    ['段位置（' + SHELF_TIERS[SP.tier].name + '）', cur.tierM, COL.s1, 'ゴールデンゾーン基準'],
    ['横位置（' + (SP.col + 1) + '列目・動線' + (SP.flow === 'right' ? '右' : '左') + '）', cur.colM, COL.s1, '入口側ほど有利'],
    ['フェイス数 ×' + SP.faces, cur.faceM, COL.s1, '視線獲得の逓減あり'],
    ['POP: ' + cur.pop.label + '（視線）', cur.pop.g, COL.s2, ''],
    ['POP: ' + cur.pop.label + '（転換）', cur.pop.c, COL.s2, ''],
    ['ベタ付け（手取・転換）', SP.beta ? 1.25 * 1.30 : 1.0, COL.s3, SP.beta ? 'RCT実測と整合' : 'OFF'],
  ];
  const maxM = 2.0;
  document.getElementById('sp-factors').innerHTML = rows.map(([l, m, c, note]) => `
    <div class="sp-factor"><span class="fl">${l}</span>
      <span class="fb"><div style="width:${clamp(m / maxM * 100, 3, 100)}%;background:${c}"></div></span>
      <span class="fv">×${m.toFixed(2)}</span></div>
    ${note ? `<div class="mde-text" style="margin:-2px 0 3px 156px">${note}</div>` : ''}`).join('');
}

function renderShelfRef() {
  document.getElementById('sp-ref').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <tbody>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary);border-bottom:1px solid #eef2f7;white-space:nowrap">ゴールデンゾーン</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">床上85〜150cmが最も視認・手に取りされやすく、垂直ゴンドラでは<b>什器売上の8〜9割がこの帯に集中</b>するとされる（エイジス、インパクトホールディングス、リテール・リーダーズ等の解説）。本モデルでは段係数 0.55〜1.40 に丸めて反映。</td></tr>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary);border-bottom:1px solid #eef2f7">POP広告効果</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">POP設置で<b>商品認知率が平均25%以上向上、売上が導入1週間で約2倍</b>に伸びた事例報告（キンコーズ・ジャパン、ミセダス等のコラム）。本モデルでは種類別に視線×1.05〜1.45／転換×1.05〜1.15に丸めて反映。</td></tr>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary);border-bottom:1px solid #eef2f7">ベタ付け（おまけ添付）</td>
          <td style="padding:4px 5px;color:var(--text-secondary);border-bottom:1px solid #eef2f7">本プロトタイプ内のノベルティRCT（無作為化比較試験）の実測リフトと整合するよう、手取×1.25・転換×1.30 に設定。おまけ原価35円/個をROIに計上。</td></tr>
        <tr><td style="padding:4px 5px;font-weight:600;color:var(--text-primary)">店舗トラフィック</td>
          <td style="padding:4px 5px;color:var(--text-secondary)">棚前通過人数は現在の施設（${STORE.label}: ${STORE.storeName}）のライブ推計から供給。日本フランチャイズチェーン協会（JFA）統計・セブン‐イレブン／ローソン／ファミリーマート決算・経済産業省 商業動態統計・伊勢丹新宿本店の報道値で較正（分析ボードの「ベンチマーク較正」参照）。</td></tr>
      </tbody>
    </table>
    <div class="mde-text" style="margin-top:7px">係数はいずれも公開情報の通説・事例値をデモ用に丸めたもの。実運用ではビーコン実測＋RCTで店舗別に較正する。</div>`;
}

/* ---------- 最適化・3D反映 ---------- */
function spOptimize() {
  let best = null;
  for (let t = 0; t < 4; t++) for (let c = 0; c <= SHELF_COLS - 1; c++)
    for (let f = 1; f <= 4; f++) {
      if (c > SHELF_COLS - f) continue;
      for (const popKey of Object.keys(SHELF_POPS)) for (const beta of [false, true]) {
        const cfg = { tier: t, col: c, faces: f, pop: popKey, beta };
        const r = spCalc(cfg);
        const baseU = spCalc(Object.assign({}, SP_BASE)).units;
        const net = (r.units - baseU) * promotedShelf().price * MARGIN - r.cost;
        if (!best || net > best.net) best = { cfg, net, r };
      }
    }
  const el = document.getElementById('sp-suggest');
  const b = best.cfg;
  el.classList.add('show');
  el.innerHTML = `
    <b style="color:var(--text-primary)">💡 最適配置の提案（増分粗利−コスト 最大化）</b><br>
    ${SHELF_TIERS[b.tier].name}（${SHELF_TIERS[b.tier].height}）・${b.col + 1}列目〜 / ${b.faces}フェイス /
    POP: ${SHELF_POPS[b.pop].label} / ベタ付け: ${b.beta ? 'あり' : 'なし'}<br>
    期待効果: 約${fmtNum(best.r.units)}個/日・差引 <b style="color:${COL.good}">+${fmtYenFull(best.net)}/日</b>
    <div class="sp-btnrow" style="margin-top:7px"><button id="sp-adopt">この提案を適用</button></div>`;
  document.getElementById('sp-adopt').addEventListener('click', () => {
    Object.assign(SP, best.cfg);
    document.getElementById('sp-faces').value = SP.faces;
    document.getElementById('sp-beta').checked = SP.beta;
    renderShelfSim();
  });
}

function spApplyTo3D() {
  const cur = spCalc(SP), base = spCalc(Object.assign({}, SP_BASE, { tier: 2, col: 4, faces: 2, pop: 'none', beta: false }));
  PLANO.attn = clamp(cur.gazeP / Math.max(base.gazeP, 0.01), 0.4, 2.5);
  PLANO.conv = clamp(cur.convP / Math.max(base.convP, 0.01), 0.4, 2.2);
  document.getElementById('sp-applied').style.display = '';
  beacon(`棚割変更を3Dへ反映（視線×${PLANO.attn.toFixed(2)}・転換×${PLANO.conv.toFixed(2)}）`, 'seg-buy');
}

/* ---------- 描画・バインド ---------- */
function renderShelfSim() {
  document.getElementById('sp-target').textContent = `対象: ${STORE.promoName}（¥${promotedShelf().price.toLocaleString()}）`;
  drawShelfPreview();
  renderShelfResult();
  renderShelfFactors();
  renderShelfRef();
}
window.renderShelfSim = renderShelfSim;
window.__shelfFacilityReset = function () {
  document.getElementById('sp-applied').style.display = 'none';
  PLANO.attn = 1; PLANO.conv = 1;
  document.getElementById('sp-suggest').classList.remove('show');
};

function renderPopRadio() {
  const popWrap = document.getElementById('sp-pop');
  popWrap.innerHTML = Object.entries(SHELF_POPS).map(([k, v]) =>
    `<button data-pop="${k}" class="${k === SP.pop ? 'active' : ''}">${v.label}${v.cost ? `（${v.cost}円/日）` : ''}</button>`).join('');
}
window.renderPopRadio = renderPopRadio;

(function bindShelfControls() {
  const popWrap = document.getElementById('sp-pop');
  renderPopRadio();
  popWrap.addEventListener('click', e => {
    const b = e.target.closest('button[data-pop]');
    if (!b) return;
    SP.pop = b.dataset.pop;
    renderPopRadio();
    renderShelfSim();
  });
  document.getElementById('sp-faces').addEventListener('input', e => {
    SP.faces = +e.target.value;
    SP.col = Math.min(SP.col, SHELF_COLS - SP.faces);
    document.getElementById('sp-v-faces').textContent = SP.faces;
    renderShelfSim();
  });
  document.getElementById('sp-beta').addEventListener('change', e => { SP.beta = e.target.checked; renderShelfSim(); });
  document.getElementById('sp-flow').addEventListener('click', e => {
    const b = e.target.closest('button[data-flow]');
    if (!b) return;
    SP.flow = b.dataset.flow;
    document.querySelectorAll('#sp-flow button').forEach(x => x.classList.toggle('active', x === b));
    renderShelfSim();
  });
  document.getElementById('sp-optimize').addEventListener('click', spOptimize);
  document.getElementById('sp-apply').addEventListener('click', spApplyTo3D);
  document.getElementById('sp-reset').addEventListener('click', () => {
    Object.assign(SP, { tier: 2, col: 4, faces: 2, pop: 'swing', beta: true, flow: 'right' });
    document.getElementById('sp-faces').value = 2;
    document.getElementById('sp-v-faces').textContent = 2;
    document.getElementById('sp-beta').checked = true;
    document.getElementById('sp-suggest').classList.remove('show');
    window.__shelfFacilityReset();
    renderShelfSim();
  });
})();
