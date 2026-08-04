/* =========================================================================
   AI STUDIO 簡易版（L4: 生成層）
   - テンプレート×テキスト×カラースキームで販促クリエイティブをCanvas生成
   - 勝ちそう度バッジ（scripted・将来は実データ駆動に置換、UI構造は不変）
   - A/B自動作成（差分チップ付き）・PNG書き出し・ギャラリー
   - 「棚割シミュレーターのPOPに適用」で勝ちそう度に応じたPOP係数を接続
   ========================================================================= */

const ST_TEMPLATES = {
  newpop: { label: '新商品POP' },
  sale: { label: 'セールPOP' },
  signage: { label: 'サイネージ静止画' },
  pricecard: { label: 'プライスカード' },
};
const ST_SCHEMES = {
  pink: { label: 'ピンク×シアン', c1: '#d55181', c2: '#0f9fba', bg: '#fff6fa' },
  red: { label: 'レッド×イエロー', c1: '#c53030', c2: '#e8b04b', bg: '#fffdf2' },
  navy: { label: 'ネイビー×ゴールド', c1: '#1f3a5f', c2: '#c9a227', bg: '#f6f8fb' },
  green: { label: 'グリーン×ホワイト', c1: '#147a55', c2: '#7fbf5f', bg: '#f4faf6' },
};
const STUDIO = { template: 'newpop', scheme: 'pink', variant: 0, score: 0, gallery: [] };

function strSeed(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

/* ---- 勝ちそう度（scripted heuristic） ---- */
function studioScore(cfg) {
  const r = mulberry32(strSeed(cfg.name + cfg.copy + cfg.template + cfg.scheme + cfg.variant))();
  let s = 52;
  if (cfg.copy.length > 0 && cfg.copy.length <= 12) s += 9;         // 短いコピーは強い
  else if (cfg.copy.length > 20) s -= 7;
  if (cfg.price > 0) s += 8;                                         // 価格明示
  if (cfg.template === 'sale') s += 5;
  if (cfg.template === 'signage') s += 3;
  if (cfg.scheme === 'red') s += 4;                                  // 高コントラスト
  if (cfg.scheme === 'navy') s -= 3;
  if (cfg.variant === 1) s += (r - 0.5) * 10;
  s += (r - 0.5) * 8;
  return clamp(Math.round(s), 18, 93);
}
function studioCTR(score) { return (0.8 + score / 100 * 2.4).toFixed(2); }

/* ---- Canvas 描画 ---- */
function drawCreative(ctx, W, H, cfg) {
  const sc = ST_SCHEMES[cfg.scheme];
  const c1 = cfg.variant === 1 ? sc.c2 : sc.c1;
  const c2 = cfg.variant === 1 ? sc.c1 : sc.c2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = sc.bg; ctx.fillRect(0, 0, W, H);

  const priceStr = cfg.price > 0 ? '¥' + Number(cfg.price).toLocaleString() : '';
  ctx.textAlign = 'center';

  if (cfg.template === 'newpop') {
    // 斜めリボン + 商品名 + 価格サークル
    ctx.save();
    ctx.translate(W / 2, H * 0.16); ctx.rotate(-0.06);
    ctx.fillStyle = c1; ctx.fillRect(-W * 0.62, -H * 0.07, W * 1.24, H * 0.14);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${H * 0.07}px sans-serif`;
    ctx.fillText('新登場', 0, H * 0.026);
    ctx.restore();
    ctx.fillStyle = '#16283c'; ctx.font = `700 ${H * 0.075}px sans-serif`;
    wrapText(ctx, cfg.name, W / 2, H * 0.44, W * 0.86, H * 0.085);
    ctx.fillStyle = c2; ctx.font = `600 ${H * 0.042}px sans-serif`;
    wrapText(ctx, cfg.copy, W / 2, H * 0.58, W * 0.85, H * 0.05);
    if (priceStr) {
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.arc(W * 0.72, H * 0.8, H * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${H * 0.052}px sans-serif`;
      ctx.fillText(priceStr, W * 0.72, H * 0.805);
      ctx.font = `600 ${H * 0.026}px sans-serif`;
      ctx.fillText('税込', W * 0.72, H * 0.855);
    }
    // 商品プレースホルダ
    ctx.fillStyle = c2 + '33';
    ctx.beginPath(); ctx.roundRect(W * 0.14, H * 0.66, W * 0.34, H * 0.26, 14); ctx.fill();
    ctx.strokeStyle = c2; ctx.strokeRect(W * 0.14, H * 0.66, W * 0.34, H * 0.26);
    ctx.fillStyle = c2; ctx.font = `600 ${H * 0.03}px sans-serif`;
    ctx.fillText('商品写真', W * 0.31, H * 0.8);
  } else if (cfg.template === 'sale') {
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H * 0.3);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${H * 0.11}px sans-serif`;
    ctx.fillText('SALE', W / 2, H * 0.2);
    ctx.fillStyle = '#16283c'; ctx.font = `700 ${H * 0.06}px sans-serif`;
    wrapText(ctx, cfg.name, W / 2, H * 0.44, W * 0.86, H * 0.07);
    // 価格バースト（星型）
    if (priceStr) {
      ctx.fillStyle = c2;
      burst(ctx, W / 2, H * 0.68, H * 0.17, 14);
      ctx.fillStyle = cfg.scheme === 'red' ? '#7a2020' : '#fff';
      ctx.font = `700 ${H * 0.07}px sans-serif`;
      ctx.fillText(priceStr, W / 2, H * 0.695);
    }
    ctx.fillStyle = c1; ctx.font = `600 ${H * 0.038}px sans-serif`;
    wrapText(ctx, cfg.copy, W / 2, H * 0.9, W * 0.85, H * 0.045);
  } else if (cfg.template === 'signage') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.roundRect(W * 0.08, H * 0.3, W * 0.84, H * 0.4, 18); ctx.fill();
    ctx.fillStyle = '#16283c'; ctx.font = `700 ${H * 0.065}px sans-serif`;
    wrapText(ctx, cfg.name, W / 2, H * 0.45, W * 0.76, H * 0.075);
    ctx.fillStyle = c1; ctx.font = `600 ${H * 0.038}px sans-serif`;
    wrapText(ctx, cfg.copy, W / 2, H * 0.58, W * 0.74, H * 0.045);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${H * 0.05}px sans-serif`;
    ctx.fillText('NEW', W / 2, H * 0.18);
    if (priceStr) { ctx.font = `700 ${H * 0.055}px sans-serif`; ctx.fillText(priceStr, W / 2, H * 0.85); }
  } else { // pricecard
    ctx.fillStyle = '#f9e78e'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, W - 20, H - 20); ctx.lineWidth = 1;
    ctx.fillStyle = '#16283c'; ctx.font = `700 ${H * 0.06}px sans-serif`;
    wrapText(ctx, cfg.name, W / 2, H * 0.26, W * 0.84, H * 0.07);
    if (priceStr) {
      ctx.fillStyle = '#c53030'; ctx.font = `700 ${H * 0.17}px sans-serif`;
      ctx.fillText(priceStr, W / 2, H * 0.6);
    }
    ctx.fillStyle = '#7a5c00'; ctx.font = `600 ${H * 0.036}px sans-serif`;
    wrapText(ctx, cfg.copy, W / 2, H * 0.82, W * 0.84, H * 0.045);
  }
}
function wrapText(ctx, text, x, y, maxW, lineH) {
  const chars = (text || '').split('');
  let line = '', yy = y;
  chars.forEach(ch => {
    if (ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lineH; }
    else line += ch;
  });
  if (line) ctx.fillText(line, x, yy);
}
function burst(ctx, cx, cy, r, spikes) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.72;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
}

/* ---- 生成・表示 ---- */
function studioCfg(variant) {
  return {
    template: STUDIO.template, scheme: STUDIO.scheme,
    name: document.getElementById('st-name').value || STORE.promoName,
    copy: document.getElementById('st-copy').value || '',
    price: +document.getElementById('st-price').value || 0,
    variant: variant || 0,
  };
}
function studioGenerate(pushGallery) {
  const cv = document.getElementById('cv-creative');
  const ctx = cv.getContext('2d');
  const cfg = studioCfg(STUDIO.variant);
  drawCreative(ctx, cv.width, cv.height, cfg);
  const score = studioScore(cfg);
  STUDIO.score = score;
  const lv = score >= 65 ? 'hi' : score >= 45 ? 'md' : 'lo';
  const color = { hi: COL.good, md: COL.warn, lo: COL.mute }[lv];
  document.getElementById('st-score').innerHTML = `
    <span class="sv" style="color:${color}">勝ちそう度 ${score}%</span>
    <span style="font-size:11px;color:var(--text-faint)"> ・ 予想CTR ${studioCTR(score)}%</span><br>
    ${confChip(lv)}
    <div class="mde-text" style="margin-top:3px">現状はscriptedスコア。本番は過去の勝ちクリエイティブ分析による実データ駆動に置換（UI構造は不変）。</div>`;
  if (pushGallery) {
    STUDIO.gallery.unshift({ url: cv.toDataURL('image/png'), score, cfg: Object.assign({}, cfg), label: ST_TEMPLATES[cfg.template].label });
    if (STUDIO.gallery.length > 8) STUDIO.gallery.pop();
    renderGallery();
  }
  document.getElementById('ab-area').innerHTML = '';
  return score;
}

function studioAB() {
  const cvA = document.createElement('canvas'); cvA.width = 380; cvA.height = 480;
  const cvB = document.createElement('canvas'); cvB.width = 380; cvB.height = 480;
  const cfgA = studioCfg(0), cfgB = studioCfg(1);
  drawCreative(cvA.getContext('2d'), 380, 480, cfgA);
  drawCreative(cvB.getContext('2d'), 380, 480, cfgB);
  const sA = studioScore(cfgA), sB = studioScore(cfgB);
  const winA = sA >= sB;
  document.getElementById('ab-area').innerHTML = `
    <div class="ab-wrap">
      ${[[cvA, sA, 'A', winA], [cvB, sB, 'B', !winA]].map(([cv, s, label, win]) => `
        <div class="ab-cell" style="${win ? 'border-color:' + COL.good : ''}">
          <img src="${cv.toDataURL('image/png')}" />
          <div class="win" style="color:${win ? COL.good : 'var(--text-muted)'}">${label}案 勝ちそう度 ${s}% ${win ? '👑' : ''}</div>
          <div style="font-size:9.5px;color:var(--text-faint)">予想CTR ${studioCTR(s)}%</div>
        </div>`).join('')}
    </div>
    <div class="chipset"><span>差分: 配色反転</span><span>差分: 強調色スワップ</span><span>同一コピー・同一価格</span></div>`;
  STUDIO.gallery.unshift({ url: cvA.toDataURL('image/png'), score: sA, cfg: cfgA, label: 'A案' });
  STUDIO.gallery.unshift({ url: cvB.toDataURL('image/png'), score: sB, cfg: cfgB, label: 'B案' });
  if (STUDIO.gallery.length > 8) STUDIO.gallery.length = 8;
  renderGallery();
}

function renderGallery() {
  document.getElementById('studio-gallery').innerHTML = STUDIO.gallery.map((g, i) => `
    <div class="g-item" data-i="${i}" style="cursor:pointer">
      <img src="${g.url}" />
      <div class="g-meta">${g.label} ・ 勝ちそう度${g.score}%</div>
    </div>`).join('') || '<div class="exp-off">まだ生成物がありません。「生成する」または「A/B自動作成」を押してください。</div>';
}
document.getElementById('studio-gallery').addEventListener('click', e => {
  const item = e.target.closest('.g-item');
  if (!item) return;
  const g = STUDIO.gallery[+item.dataset.i];
  if (!g) return;
  STUDIO.template = g.cfg.template; STUDIO.scheme = g.cfg.scheme; STUDIO.variant = g.cfg.variant;
  document.getElementById('st-name').value = g.cfg.name;
  document.getElementById('st-copy').value = g.cfg.copy;
  document.getElementById('st-price').value = g.cfg.price;
  syncStudioButtons();
  studioGenerate(false);
});

/* ---- 棚割POPへの適用 ---- */
document.getElementById('st-apply').addEventListener('click', () => {
  const score = STUDIO.score || studioGenerate(false);
  SHELF_POPS.ai = {
    label: `AI生成POP（勝ちそう度${score}%）`,
    g: +(1.12 + score / 100 * 0.4).toFixed(2),
    c: +(1.03 + score / 100 * 0.14).toFixed(2),
    cost: 300,
  };
  SP.pop = 'ai';
  if (window.renderPopRadio) renderPopRadio();
  if (window.renderShelfSim) renderShelfSim();
  beacon(`AI STUDIO製POPを棚割へ適用（勝ちそう度${score}%）`, 'seg-buy');
  switchView('shelf');
});

document.getElementById('st-download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'xad_creative.png';
  a.href = document.getElementById('cv-creative').toDataURL('image/png');
  a.click();
});

/* ---- バインド ---- */
function syncStudioButtons() {
  document.querySelectorAll('#st-template button').forEach(b => b.classList.toggle('active', b.dataset.t === STUDIO.template));
  document.querySelectorAll('#st-scheme button').forEach(b => b.classList.toggle('active', b.dataset.s === STUDIO.scheme));
}
(function initStudio() {
  document.getElementById('st-template').innerHTML = Object.entries(ST_TEMPLATES).map(([k, v]) =>
    `<button data-t="${k}" class="${k === STUDIO.template ? 'active' : ''}">${v.label}</button>`).join('');
  document.getElementById('st-scheme').innerHTML = Object.entries(ST_SCHEMES).map(([k, v]) =>
    `<button data-s="${k}" class="${k === STUDIO.scheme ? 'active' : ''}">${v.label}</button>`).join('');
  document.getElementById('st-template').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (!b) return; STUDIO.template = b.dataset.t; syncStudioButtons(); studioGenerate(false);
  });
  document.getElementById('st-scheme').addEventListener('click', e => {
    const b = e.target.closest('button[data-s]');
    if (!b) return; STUDIO.scheme = b.dataset.s; syncStudioButtons(); studioGenerate(false);
  });
  document.getElementById('st-generate').addEventListener('click', () => { STUDIO.variant = 0; studioGenerate(true); });
  document.getElementById('st-ab').addEventListener('click', studioAB);
  document.getElementById('st-name').value = STORE.promoName;
})();

function renderStudioPage() {
  if (!document.getElementById('st-name').value) document.getElementById('st-name').value = STORE.promoName;
  studioGenerate(false);
  renderGallery();
}
window.renderStudioPage = renderStudioPage;
