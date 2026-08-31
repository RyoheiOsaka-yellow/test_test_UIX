
/* ================================================================
   チャート基盤 — キャンバス描画の共通ライブラリ
   配色は dataviz の検証器（OKLab / CVD ΔE / コントラスト）を通した
   ダークサーフェス用パレット。系列色は固定順で割り当て、循環させない。
   全チャートにホバー（クロスヘア + ツールチップ）を標準装備する。
================================================================ */
/* ダーク面（3Dビュー上のパネル）と ライト面（分析画面）で別々に検証したパレットを持つ。
   どちらも dataviz の検証器を通した値で、明度帯・彩度・CVD ΔE・コントラストを満たす。
   ライト面の一部色は 3:1 未満のため「相補（直接ラベル・凡例・表）」を必ず添える。 */
const VIZ_DARK = {
  ser: ['#1e8fd0', '#c98500', '#199e70', '#d95926', '#9085e9', '#d55181', '#008300', '#e66767'],
  seq: ['#0b2f47', '#12496b', '#1a6693', '#2585bd', '#4aa8dd', '#86cdf0'],
  div: ['#1e8fd0', '#6b7280', '#d95926'],
  st: { good: '#199e70', warn: '#c98500', serious: '#d95926', critical: '#e66767' },
  ink: '#e9edf6', ink2: '#9aa5bb', ink3: '#66718a',
  grid: 'rgba(154,165,187,.16)', axis: 'rgba(154,165,187,.34)', surf: '#151b28',
};
const VIZ_LIGHT = {
  ser: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  seq: ['#dbeafd', '#a9d0f5', '#6fb0ea', '#3a8ad9', '#1f63ad', '#123f73'],
  div: ['#2a78d6', '#9aa0a8', '#eb6834'],
  st: { good: '#1a7f56', warn: '#b07800', serious: '#c9501f', critical: '#c62d2c' },
  ink: '#14181f', ink2: '#4c5563', ink3: '#78818f',
  grid: 'rgba(20,24,31,.10)', axis: 'rgba(20,24,31,.22)', surf: '#ffffff',
};
let VIZ = VIZ_DARK;
/* キャンバスがライト面の中にあるかで自動的にパレットを切り替える */
function vizTheme(cv) {
  VIZ = (cv && cv.closest && cv.closest('.lightsurf')) ? VIZ_LIGHT : VIZ_DARK;
  return VIZ;
}
const vizSeq = t => {
  const a = VIZ.seq, u = clamp(t, 0, 1) * (a.length - 1);
  const i = Math.min(a.length - 2, Math.floor(u)), k = u - i;
  const p = (h, j) => parseInt(h.slice(j, j + 2), 16);
  const c0 = a[i], c1 = a[i + 1];
  const m = j => Math.round(p(c0, j) + (p(c1, j) - p(c0, j)) * k);
  return 'rgb(' + m(1) + ',' + m(3) + ',' + m(5) + ')';
};
const vizDiv = t => {                              /* t: -1..1 */
  const u = clamp(t, -1, 1);
  const A = u < 0 ? VIZ.div[0] : VIZ.div[2], B = VIZ.div[1], k = 1 - Math.abs(u);
  const p = (h, j) => parseInt(h.slice(j, j + 2), 16);
  const m = j => Math.round(p(A, j) + (p(B, j) - p(A, j)) * k);
  return 'rgb(' + m(1) + ',' + m(3) + ',' + m(5) + ')';
};

/* ---- 共有ツールチップ ---- */
const vizTip = document.createElement('div');
vizTip.id = 'viz-tip';
document.body.appendChild(vizTip);
const tipShow = (x, y, html) => {
  vizTip.innerHTML = html;
  vizTip.style.display = 'block';
  const r = vizTip.getBoundingClientRect();
  vizTip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x + 14)) + 'px';
  vizTip.style.top = Math.min(innerHeight - r.height - 8, Math.max(8, y - r.height - 10)) + 'px';
};
const tipHide = () => { vizTip.style.display = 'none'; };

/* ---- 描画ヘルパ ---- */
/* ラベルは文字数ではなく実測幅で詰める。日本語は文字数だと収まらず左へはみ出す。 */
function fitText(c, t, maxW) {
  if (c.measureText(t).width <= maxW) return t;
  let s2 = t;
  while (s2.length > 1 && c.measureText(s2 + '…').width > maxW) s2 = s2.slice(0, -1);
  return s2 + '…';
}
function vizSetup(cv, h) {
  vizTheme(cv);
  const dpr = Math.min(devicePixelRatio, 2);
  const w = cv.clientWidth || cv.parentElement.clientWidth || 300;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round((h || +cv.getAttribute('height') || 160) * dpr);
  cv.style.height = (cv.height / dpr) + 'px';
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, cv.height / dpr);
  c.font = '10px "Noto Sans JP", sans-serif';
  return { c, W: w, H: cv.height / dpr, dpr };
}
/* 上端だけ 4px 丸めた棒（データ端は丸め、ベースラインは直角） */
function barPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, Math.abs(h));
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h);
  c.closePath();
}
function vizAxes(c, W, H, P, yMax, yFmt, xLabels, opt) {
  opt = opt || {};
  const ticks = opt.ticks || 4;
  c.strokeStyle = VIZ.grid; c.lineWidth = 1;
  c.fillStyle = VIZ.ink3; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let i = 0; i <= ticks; i++) {
    const v = yMax * i / ticks, y = Math.round(H - P.b - (H - P.t - P.b) * i / ticks) + 0.5;
    c.beginPath(); c.moveTo(P.l, y); c.lineTo(W - P.r, y); c.stroke();
    c.fillText(yFmt ? yFmt(v) : fmt(v), P.l - 6, y);
  }
  if (xLabels) {
    c.textAlign = 'center'; c.textBaseline = 'top';
    const n = xLabels.length, step = Math.ceil(n / (opt.xTicks || 8));
    for (let i = 0; i < n; i += step) {
      const x = P.l + (W - P.l - P.r) * (n > 1 ? i / (n - 1) : 0.5);
      c.fillText(xLabels[i], x, H - P.b + 6);
    }
  }
}
function vizLegend(c, W, items, y) {
  c.textAlign = 'left'; c.textBaseline = 'middle';
  let x = 0;
  const parts = items.map(s => ({ s, w: c.measureText(s.name).width + 20 }));
  const over = parts.reduce((a, p) => a + p.w, 0) - W + 4;
  if (over > 0) for (const p of parts) {
    p.s = { name: fitText(c, p.s.name, Math.max(24, p.w - 20 - over / parts.length)),
            color: p.s.color };
    p.w = c.measureText(p.s.name).width + 20;
  }
  const total = parts.reduce((a, p) => a + p.w, 0);
  x = Math.max(2, (W - total) / 2);
  for (const p of parts) {
    c.fillStyle = p.s.color;
    c.beginPath(); c.roundRect ? c.roundRect(x, y - 3.5, 8, 7, 2) : c.rect(x, y - 3.5, 8, 7);
    c.fill();
    c.fillStyle = VIZ.ink2;
    c.fillText(p.s.name, x + 12, y);
    x += p.w;
  }
}
/* ホバー登録: hits = [{x,y,r,html}] （r は当たり半径） */
function vizHover(cv, hits, crossX) {
  cv.__hits = hits;
  if (cv.__bound) return;
  cv.__bound = true;
  cv.style.cursor = 'crosshair';
  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const h of (cv.__hits || [])) {
      const d = h.free ? Math.abs(h.x - mx) : Math.hypot(h.x - mx, h.y - my);
      if (d < (h.r || 14) && d < bd) { bd = d; best = h; }
    }
    if (best) tipShow(e.clientX, e.clientY, best.html); else tipHide();
  });
  cv.addEventListener('mouseleave', tipHide);
}

/* ================= 折れ線 / 面 ================= */
function vizLine(cv, o) {
  const { c, W, H } = vizSetup(cv, o.h);
  const P = { l: o.padL || 46, r: 10, t: 10, b: o.legend === false ? 22 : 34 };
  const S = o.series, n = S[0].data.length;
  let mx = o.yMax || 0;
  if (!o.yMax) for (const s of S) for (const v of s.data) if (v > mx) mx = v;
  mx = mx * 1.12 || 1;
  vizAxes(c, W, H, P, mx, o.yFmt, o.x, o);
  const px = i => P.l + (W - P.l - P.r) * (n > 1 ? i / (n - 1) : 0.5);
  const py = v => H - P.b - (H - P.t - P.b) * (v / mx);
  const hits = [];
  S.forEach((s, si) => {
    const col = s.color || VIZ.ser[si % VIZ.ser.length];
    if (o.area) {
      c.beginPath(); c.moveTo(px(0), py(0));
      s.data.forEach((v, i) => c.lineTo(px(i), py(v)));
      c.lineTo(px(n - 1), py(0)); c.closePath();
      c.fillStyle = col + '22'; c.fill();
    }
    c.beginPath();
    s.data.forEach((v, i) => i ? c.lineTo(px(i), py(v)) : c.moveTo(px(i), py(v)));
    c.strokeStyle = col; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
    /* 直接ラベル（4系列以下のとき最終点に添える） */
    if (S.length <= 4 && o.direct !== false) {
      c.fillStyle = VIZ.ink2; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(s.name, px(n - 1) - 2, py(s.data[n - 1]) - 5);
    }
  });
  for (let i = 0; i < n; i++) {
    hits.push({ x: px(i), y: 0, r: (W - P.l - P.r) / Math.max(1, n - 1) / 2 + 2, free: true,
      html: '<b>' + (o.x ? o.x[i] : i) + '</b>' + S.map((s, si) =>
        '<div><i style="background:' + (s.color || VIZ.ser[si % VIZ.ser.length]) + '"></i>' +
        s.name + ' <b>' + (o.tipFmt ? o.tipFmt(s.data[i]) : fmt(s.data[i])) + '</b></div>').join('') });
  }
  if (S.length >= 2 && o.legend !== false) vizLegend(c, W, S.map((s, i) =>
    ({ name: s.name, color: s.color || VIZ.ser[i % VIZ.ser.length] })), H - 8);
  vizHover(cv, hits);
}

/* ================= 縦棒（グループ / 積み上げ） ================= */
function vizBars(cv, o) {
  const { c, W, H } = vizSetup(cv, o.h);
  const P = { l: o.padL || 46, r: 10, t: 10, b: o.legend === false ? 24 : 36 };
  const S = o.series, n = o.x.length;
  let mx = 0;
  if (o.stacked) for (let i = 0; i < n; i++) {
    let t = 0; for (const s of S) t += s.data[i] || 0; if (t > mx) mx = t;
  } else for (const s of S) for (const v of s.data) if (v > mx) mx = v;
  mx = mx * 1.1 || 1;
  vizAxes(c, W, H, P, mx, o.yFmt, o.x, o);
  const slot = (W - P.l - P.r) / n;
  const bw = o.stacked ? Math.min(28, slot * 0.62)
    : Math.min(20, (slot * 0.72) / S.length);
  const base = H - P.b;
  const hits = [];
  for (let i = 0; i < n; i++) {
    let acc = 0;
    S.forEach((s, si) => {
      const col = s.color || VIZ.ser[si % VIZ.ser.length];
      const v = s.data[i] || 0;
      const h = (v / mx) * (H - P.t - P.b);
      const x = o.stacked ? P.l + slot * i + (slot - bw) / 2
        : P.l + slot * i + (slot - bw * S.length - 2 * (S.length - 1)) / 2 + si * (bw + 2);
      const y = o.stacked ? base - acc - h : base - h;
      if (h > 0.4) {
        c.fillStyle = col;
        /* 積み上げの継ぎ目は 2px のサーフェス色ギャップで分ける */
        barPath(c, x, y + (o.stacked && acc > 0 ? 0 : 0), bw, h - (o.stacked ? 2 : 0), 4);
        c.fill();
      }
      hits.push({ x: x + bw / 2, y: y + h / 2, r: Math.max(10, bw / 2 + 3),
        html: '<b>' + o.x[i] + '</b><div><i style="background:' + col + '"></i>' + s.name +
              ' <b>' + (o.tipFmt ? o.tipFmt(v) : fmt(v)) + '</b></div>' });
      if (o.stacked) acc += h;
    });
  }
  if (S.length >= 2 && o.legend !== false) vizLegend(c, W, S.map((s, i) =>
    ({ name: s.name, color: s.color || VIZ.ser[i % VIZ.ser.length] })), H - 9);
  vizHover(cv, hits);
}

/* ================= 横棒（ランキング・直接ラベル） ================= */
function vizHBars(cv, o) {
  const rows = o.rows.slice(0, o.limit || 12);
  const rowH = o.rowH || 22;
  const { c, W, H } = vizSetup(cv, rows.length * rowH + 8);
  const labW = o.labW || Math.min(150, W * 0.42);
  const valW = o.valW || 62;
  const mx = o.max || Math.max(1, ...rows.map(r => r.value));
  const hits = [];
  rows.forEach((r, i) => {
    const y = i * rowH + 4, bh = rowH - 9;
    c.fillStyle = VIZ.ink2; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(fitText(c, r.label, labW - 12), labW - 8, y + bh / 2);
    const bw = Math.max(1, (W - labW - valW) * (r.value / mx));
    c.fillStyle = r.color || VIZ.ser[i % VIZ.ser.length];
    c.beginPath();
    const rr = Math.min(4, bw);
    c.moveTo(labW, y); c.lineTo(labW + bw - rr, y);
    c.quadraticCurveTo(labW + bw, y, labW + bw, y + rr);
    c.lineTo(labW + bw, y + bh - rr);
    c.quadraticCurveTo(labW + bw, y + bh, labW + bw - rr, y + bh);
    c.lineTo(labW, y + bh); c.closePath(); c.fill();
    c.fillStyle = VIZ.ink; c.textAlign = 'right';
    c.fillText(o.vFmt ? o.vFmt(r.value) : fmt(r.value), W - 4, y + bh / 2);
    hits.push({ x: labW + bw / 2, y: y + bh / 2, r: Math.max(12, bh),
      html: '<b>' + r.label + '</b><div>' + (o.vFmt ? o.vFmt(r.value) : fmt(r.value)) +
            (r.sub ? '<br><span style="color:#9aa5bb">' + r.sub + '</span>' : '') + '</div>' });
  });
  vizHover(cv, hits);
}

/* ================= ドーナツ（構成 + 中央のヒーロー数値） ================= */
function vizDonut(cv, o) {
  const { c, W, H } = vizSetup(cv, o.h || 168);
  const sl = o.slices.filter(s => s.value > 0);
  const tot = sl.reduce((a, s) => a + s.value, 0) || 1;
  const cx = o.legendRight ? W * 0.30 : W / 2, cy = H / 2 - (o.legendRight ? 0 : 6);
  const R = Math.min(cx - 6, cy - 6, o.r || 62), r0 = R * 0.60;
  let a0 = -Math.PI / 2;
  const hits = [];
  sl.forEach((s, i) => {
    const col = s.color || VIZ.ser[i % VIZ.ser.length];
    const a1 = a0 + (s.value / tot) * Math.PI * 2;
    /* 隣接セグメントは 2px のサーフェス色ギャップで分ける */
    const gap = 1.6 / R;
    c.beginPath();
    c.arc(cx, cy, R, a0 + gap, Math.max(a0 + gap, a1 - gap));
    c.arc(cx, cy, r0, Math.max(a0 + gap, a1 - gap), a0 + gap, true);
    c.closePath(); c.fillStyle = col; c.fill();
    const am = (a0 + a1) / 2;
    hits.push({ x: cx + Math.cos(am) * (R + r0) / 2, y: cy + Math.sin(am) * (R + r0) / 2, r: 20,
      html: '<b>' + s.label + '</b><div><i style="background:' + col + '"></i>' +
            (o.vFmt ? o.vFmt(s.value) : fmt(s.value)) + ' ・ ' +
            (s.value / tot * 100).toFixed(1) + '%</div>' });
    a0 = a1;
  });
  if (o.center) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = VIZ.ink; c.font = '600 19px Oswald, sans-serif';
    c.fillText(o.center.v, cx, cy - 5);
    c.font = '9px "Noto Sans JP", sans-serif'; c.fillStyle = VIZ.ink3;
    c.fillText(o.center.l, cx, cy + 12);
  }
  /* 凡例は必ず出す（識別を色だけに依存させない） */
  c.font = '10px "Noto Sans JP", sans-serif';
  if (o.legendRight) {
    c.textAlign = 'left'; c.textBaseline = 'middle';
    const lx = W * 0.58, top = cy - sl.length * 7.5;
    sl.forEach((s, i) => {
      const y = top + i * 15;
      c.fillStyle = s.color || VIZ.ser[i % VIZ.ser.length];
      c.fillRect(lx, y - 3.5, 8, 7);
      c.fillStyle = VIZ.ink2;
      c.fillText(fitText(c, s.label, W - lx - 46), lx + 12, y);
      c.fillStyle = VIZ.ink; c.textAlign = 'right';
      c.fillText((s.value / tot * 100).toFixed(0) + '%', W - 4, y);
      c.textAlign = 'left';
    });
  } else vizLegend(c, W, sl.map((s, i) =>
    ({ name: s.label, color: s.color || VIZ.ser[i % VIZ.ser.length] })), H - 7);
  vizHover(cv, hits);
}

/* ================= 散布図（サイズ付き） ================= */
function vizScatter(cv, o) {
  const { c, W, H } = vizSetup(cv, o.h || 200);
  const P = { l: o.padL || 46, r: 12, t: 12, b: 30 };
  const pts = o.points;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = o.xMin != null ? o.xMin : Math.min(...xs), x1 = o.xMax != null ? o.xMax : Math.max(...xs);
  const y1 = o.yMax != null ? o.yMax : Math.max(...ys) * 1.1;
  vizAxes(c, W, H, P, y1, o.yFmt, null, o);
  const px = v => P.l + (W - P.l - P.r) * ((v - x0) / Math.max(1e-6, x1 - x0));
  const py = v => H - P.b - (H - P.t - P.b) * (v / (y1 || 1));
  /* X軸目盛 */
  c.fillStyle = VIZ.ink3; c.textAlign = 'center'; c.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const v = x0 + (x1 - x0) * i / 4;
    c.fillText(o.xFmt ? o.xFmt(v) : fmt(v), px(v), H - P.b + 6);
  }
  if (o.xLab) { c.textAlign = 'right'; c.fillText(o.xLab, W - P.r, H - 11); }
  if (o.yLab) { c.save(); c.translate(11, P.t + 4); c.textAlign = 'left'; c.fillText(o.yLab, 0, 0); c.restore(); }
  const hits = [];
  pts.forEach((p, i) => {
    const R = Math.max(4, p.r || 5);
    c.beginPath(); c.arc(px(p.x), py(p.y), R, 0, 7);
    c.fillStyle = (p.color || VIZ.ser[0]) + 'cc'; c.fill();
    /* 重なりは 2px のサーフェス色リングで分離する */
    c.strokeStyle = VIZ.surf; c.lineWidth = 2; c.stroke();
    hits.push({ x: px(p.x), y: py(p.y), r: R + 8,
      html: '<b>' + (p.label || '') + '</b><div>' +
        (o.xLab || 'x') + ' <b>' + (o.xFmt ? o.xFmt(p.x) : fmt(p.x)) + '</b><br>' +
        (o.yLab || 'y') + ' <b>' + (o.yFmt ? o.yFmt(p.y) : fmt(p.y)) + '</b>' +
        (p.sub ? '<br><span style="color:#9aa5bb">' + p.sub + '</span>' : '') + '</div>' });
  });
  vizHover(cv, hits);
}

/* ================= ファネル ================= */
function vizFunnel(cv, o) {
  const st = o.steps;
  const { c, W, H } = vizSetup(cv, st.length * 30 + 8);
  const top = st[0].value || 1;
  const hits = [];
  st.forEach((s, i) => {
    const y = i * 30 + 4, h = 21;
    const w = (W - 8) * (s.value / top);
    c.fillStyle = i === st.length - 1 ? VIZ.st.good : vizSeq(1 - i / Math.max(1, st.length - 1));
    c.beginPath();
    const rr = Math.min(4, w / 2);
    c.moveTo(4, y); c.lineTo(4 + w - rr, y);
    c.quadraticCurveTo(4 + w, y, 4 + w, y + rr);
    c.lineTo(4 + w, y + h - rr);
    c.quadraticCurveTo(4 + w, y + h, 4 + w - rr, y + h);
    c.lineTo(4, y + h); c.closePath(); c.fill();
    c.fillStyle = VIZ.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(s.label, 10, y + h / 2);
    c.textAlign = 'right';
    c.fillText((o.vFmt ? o.vFmt(s.value) : fmt(s.value)), W - 6, y + h / 2);
    if (i) {
      c.fillStyle = VIZ.ink3; c.textAlign = 'left';
      c.fillText('▼ ' + (s.value / (st[i - 1].value || 1) * 100).toFixed(1) + '%', 10, y + h + 4);
    }
    hits.push({ x: w / 2, y: y + h / 2, r: 16,
      html: '<b>' + s.label + '</b><div>' + (o.vFmt ? o.vFmt(s.value) : fmt(s.value)) +
            '<br><span style="color:#9aa5bb">先頭比 ' + (s.value / top * 100).toFixed(1) +
            '%</span></div>' });
  });
  vizHover(cv, hits);
}

/* ================= マトリクス（ヒートグリッド） ================= */
function vizHeat(cv, o) {
  const { c, W, H } = vizSetup(cv, o.rows.length * 20 + 34);
  const labW = o.labW || 104;
  const cw = (W - labW - 4) / o.cols.length, ch = 18;
  let mx = 0;
  for (const r of o.values) for (const v of r) if (v > mx) mx = v;
  mx = mx || 1;
  c.fillStyle = VIZ.ink3; c.textAlign = 'center'; c.textBaseline = 'bottom';
  o.cols.forEach((cl, j) => c.fillText(cl, labW + cw * (j + 0.5), 12));
  const hits = [];
  o.rows.forEach((rw, i) => {
    const y = 16 + i * 20;
    c.fillStyle = VIZ.ink2; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(fitText(c, rw, labW - 12), labW - 8, y + ch / 2);
    o.cols.forEach((cl, j) => {
      const v = o.values[i][j] || 0;
      c.fillStyle = v ? vizSeq(Math.pow(v / mx, 0.6)) : 'rgba(154,165,187,.07)';
      c.fillRect(labW + cw * j + 1, y + 1, cw - 2, ch - 2);   /* 2px ギャップ */
      if (v && cw > 30) {
        c.fillStyle = v / mx > 0.55 ? '#08121c' : VIZ.ink2;
        c.textAlign = 'center';
        c.fillText(fmt(v), labW + cw * (j + 0.5), y + ch / 2);
      }
      hits.push({ x: labW + cw * (j + 0.5), y: y + ch / 2, r: Math.min(cw, ch) / 2 + 2,
        html: '<b>' + rw + ' × ' + cl + '</b><div>' + (o.vFmt ? o.vFmt(v) : fmt(v)) + '</div>' });
    });
  });
  vizHover(cv, hits);
}

/* ================= スパークライン（凡例なし・単系列） ================= */
function vizSpark(cv, o) {
  const { c, W, H } = vizSetup(cv, o.h || 34);
  const d = o.data, n = d.length;
  const mx = Math.max(...d) || 1, mn = o.zero ? 0 : Math.min(...d);
  const px = i => (W - 2) * (n > 1 ? i / (n - 1) : 0.5) + 1;
  const py = v => H - 3 - (H - 8) * ((v - mn) / Math.max(1e-6, mx - mn));
  c.beginPath(); c.moveTo(px(0), H - 1);
  d.forEach((v, i) => c.lineTo(px(i), py(v)));
  c.lineTo(px(n - 1), H - 1); c.closePath();
  c.fillStyle = (o.color || VIZ.ser[0]) + '26'; c.fill();
  c.beginPath();
  d.forEach((v, i) => i ? c.lineTo(px(i), py(v)) : c.moveTo(px(i), py(v)));
  c.strokeStyle = o.color || VIZ.ser[0]; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(px(n - 1), py(d[n - 1]), 3, 0, 7);
  c.fillStyle = o.color || VIZ.ser[0]; c.fill();
  const hits = d.map((v, i) => ({ x: px(i), y: 0, r: (W / Math.max(1, n - 1)) / 2 + 2, free: true,
    html: '<b>' + (o.x ? o.x[i] : i) + '</b><div>' + (o.vFmt ? o.vFmt(v) : fmt(v)) + '</div>' }));
  vizHover(cv, hits);
}

/* data-viz 属性のついた canvas をまとめて描画する */
function drawVizIn(root) {
  (root || document).querySelectorAll('canvas[data-viz]').forEach(cv => {
    const spec = cv.__spec;
    if (!spec) return;
    ({ line: vizLine, bars: vizBars, hbars: vizHBars, donut: vizDonut,
       scatter: vizScatter, funnel: vizFunnel, heat: vizHeat, spark: vizSpark }[spec.type] ||
     vizBars)(cv, spec);
  });
}
/* HTML文字列の中に置くためのプレースホルダ。描画は setVizSpec で後から差す */
let vizSeq_ = 0;
function vizCanvas(spec, h, cls) {
  const id = 'viz' + (++vizSeq_);
  VIZ_PENDING.push([id, spec]);
  return '<canvas data-viz id="' + id + '" height="' + (h || 160) + '"' +
         (cls ? ' class="' + cls + '"' : '') + '></canvas>';
}
const VIZ_PENDING = [];
function flushViz() {
  while (VIZ_PENDING.length) {
    const [id, spec] = VIZ_PENDING.shift();
    const cv = document.getElementById(id);
    if (!cv) continue;
    cv.__spec = spec;
    ({ line: vizLine, bars: vizBars, hbars: vizHBars, donut: vizDonut,
       scatter: vizScatter, funnel: vizFunnel, heat: vizHeat, spark: vizSpark }[spec.type] ||
     vizBars)(cv, spec);
  }
}
