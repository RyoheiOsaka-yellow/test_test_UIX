// Canvas 描画。ワールド座標 mm、基板中心まわりの左右反転（裏返し）に対応。
import { LAYERS, NL, NET_WIDTH, VIA, padWorld, compBox, ROLES, netRole } from './core.js';

const C = {
  bg: '#0d1216', board: '#171d22', edge: '#c9a25a', bracket: '#56606b', via: '#d9dde2', hole: '#0d1216',
  padSig: '#f1d27a', padGnd: '#7f8a96', padPwr: '#e8955a', padNc: '#4d5661', padFar: '#3d4955', hi: '#ffffff', rats: '#e9eef5',
};
// 実物風表示の部品色（ファミリ別）
export const REAL = {
  gpu: '#2b4a3a', vram: '#16191c', ctl: '#1a1d21', ctl8: '#1a1d21', drmos: '#1a1d21', mon: '#1a1d21', mcu: '#1a1d21', buck: '#1a1d21', retimer: '#1a1d21', flash: '#1a1d21',
  ind: '#5d636a', indin: '#5d636a', indaux: '#4a4f55', bulk: '#b7862f', bulkin: '#9aa2ab', mlcc: '#a98f6c', res: '#23272c', shunt: '#8e959c', fuse: '#d8d2c2',
  pwrconn: '#121416', pwrconn8: '#121416', dp: '#aeb5bc', hdmi: '#aeb5bc', pcie: '#c9a25a', xtal: '#b9c0c7', fan: '#e6e2d6',
};
export const realColor = p => REAL[p.family] || (p.pads.length > 6 ? '#1a1d21' : p.pads.length === 2 ? '#a98f6c' : '#3a4047');
const ZONE_COL = { VCORE: '#f26d6d', VMEM: '#d98cf0', '+12V': '#f0d264', '+12V_IN': '#f0a04a', '+1V8': '#a3d977', '+PEX': '#7fe0c3' };

export function flipOf(S) { const f = S.view.flip; return Math.abs(f) < 0.03 ? (f < 0 ? -0.03 : 0.03) : f; }
export function toWorld(S, sx, sy) {
  const v = S.view, f = flipOf(S), bcx = S.board.w / 2;
  return { x: bcx + ((sx - S.cw / 2) / v.z + v.x - bcx) / f, y: (sy - S.ch / 2) / v.z + v.y };
}
export function toScreen(S, x, y) {
  const v = S.view, f = flipOf(S), bcx = S.board.w / 2;
  return { x: S.cw / 2 + (bcx + (x - bcx) * f - v.x) * v.z, y: S.ch / 2 + (y - v.y) * v.z };
}

function boardPath(ctx, b) {
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(b.w, 0); ctx.lineTo(b.w, b.h);
  if (b.tab) { const t = b.tab; ctx.lineTo(t.x1, b.h); ctx.lineTo(t.x1, b.h + t.h); ctx.lineTo(t.x0 + 13, b.h + t.h); ctx.lineTo(t.x0 + 13, b.h + 1); ctx.lineTo(t.x0 + 11, b.h + 1); ctx.lineTo(t.x0 + 11, b.h + t.h); ctx.lineTo(t.x0, b.h + t.h); ctx.lineTo(t.x0, b.h); }
  ctx.lineTo(0, b.h); ctx.closePath();
}

export function draw(ctx, S) {
  const { board: b, view: v, cw, ch, dpr } = S;
  const f = flipOf(S), back = f < 0, px = 1 / v.z;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cw, ch);
  const world = () => ctx.setTransform(v.z * f * dpr, 0, 0, v.z * dpr, (cw / 2 + (b.w / 2 * (1 - f) - v.x) * v.z) * dpr, (ch / 2 - v.y * v.z) * dpr);
  world();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // 基板とブラケット
  if (v.z > 2.2) { // 背景の 10mm グリッド
    ctx.fillStyle = '#1b242c';
    const gx0 = Math.floor(Math.min(toWorld(S, 0, 0).x, toWorld(S, cw, 0).x) / 10) * 10, gx1 = Math.max(toWorld(S, 0, 0).x, toWorld(S, cw, 0).x), gy0 = Math.floor(toWorld(S, 0, 0).y / 10) * 10, gy1 = toWorld(S, 0, ch).y;
    for (let y = gy0; y <= gy1; y += 10) for (let x = gx0; x <= gx1; x += 10) ctx.fillRect(x - px, y - px, 2 * px, 2 * px);
  }
  ctx.fillStyle = C.bracket; ctx.fillRect(-3.2, -5, 1.2, b.h + 9);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18 * dpr; ctx.shadowOffsetY = 5 * dpr;
  boardPath(ctx, b); ctx.fillStyle = S.style === 'real' ? '#12181c' : C.board; ctx.fill(); ctx.restore();
  boardPath(ctx, b);
  ctx.lineWidth = Math.max(0.25, px); ctx.strokeStyle = C.edge; ctx.stroke();

  const a0 = toWorld(S, 0, 0), a1 = toWorld(S, cw, ch);
  const vx0 = Math.min(a0.x, a1.x), vx1 = Math.max(a0.x, a1.x), vy0 = a0.y, vy1 = a1.y;
  const vis = c => { const B = compBox(c, 1); return B.x1 >= vx0 && B.x0 <= vx1 && B.y1 >= vy0 && B.y0 <= vy1; };
  const nearSide = back ? 'B' : 'T';
  const hi = S.hiNet, hg = S.hiGroup;
  const comps = b.comps.filter(vis);
  const gcol = c => (b.group(c.group) || {}).color || '#9aa3ad';

  // 電源プレーン：供給経路（最小全域木）に沿った帯状のベタ。幅は想定電流に比例。
  if (S.show.zones && S.zones.length) {
    ctx.save(); boardPath(ctx, b); ctx.clip();
    for (const z of S.zones) {
      const col = ZONE_COL[z.name] || '#888', on = hi && hi.name === z.name;
      ctx.beginPath();
      for (const n of z.nodes) { ctx.moveTo(n.x, n.y); ctx.lineTo(n.x, n.y + 0.01); }
      for (const [i, j] of z.edges) { ctx.moveTo(z.nodes[i].x, z.nodes[i].y); ctx.lineTo(z.nodes[j].x, z.nodes[j].y); }
      ctx.lineWidth = z.w; ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.stroke();
      ctx.lineWidth = Math.max(0.1, z.w - 2 * px); ctx.strokeStyle = C.board; ctx.globalAlpha = 1; ctx.stroke();
      ctx.strokeStyle = col; ctx.globalAlpha = on ? 0.3 : 0.1; ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // 自動配置の領域制約
  if (S.regions) {
    ctx.lineWidth = 1.5 * px; ctx.setLineDash([6 * px, 4 * px]);
    for (const r of S.regions) { ctx.strokeStyle = r.color; ctx.globalAlpha = 0.9; ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.globalAlpha = 0.05; ctx.fillStyle = r.color; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // 奥側の部品外形
  if (S.show.far) {
    ctx.lineWidth = px; ctx.setLineDash([3 * px, 3 * px]);
    for (const c of comps) {
      if (c.side === nearSide || c.part.th) continue;
      const B = compBox(c);
      ctx.globalAlpha = hg && hg !== c.group ? 0.1 : 0.38; ctx.strokeStyle = gcol(c);
      ctx.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // 配線（奥の層から）
  const order = back ? [0, 1, 2, 3] : [3, 2, 1, 0];
  const routedAll = [...b.nets.values()].filter(n => n.route && (n.route.segs.length || n.route.vias.length));
  const nets = routedAll.filter(n => !n.route.plane), planeNets = routedAll.filter(n => n.route.plane);
  const real = S.style === 'real';
  for (const l of order) {
    if (!S.layerVis[l]) continue;
    ctx.strokeStyle = LAYERS[l].color;
    ctx.globalAlpha = hi || hg ? 0.2 : (l === order[NL - 1] ? 1 : 0.85) * (real ? 0.6 : 1);
    if (S.roleWires) {   // 役割の色で光らせる
      const ga = ctx.globalAlpha; ctx.globalAlpha = hi || hg ? 0.2 : 1;
      for (const role of ROLES) {
        ctx.beginPath();
        for (const n of routedAll) { if (n.route.plane || netRole(n) !== role) continue; for (const s of n.route.segs) { if (s.l !== l) continue; const p = s.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); } }
        ctx.strokeStyle = role.color; ctx.globalCompositeOperation = 'lighter'; const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * 0.22; ctx.lineWidth = Math.max(0.6, 5 * px); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a0; ctx.lineWidth = Math.max(0.15, px); ctx.stroke();
      }
      ctx.globalAlpha = ga; ctx.strokeStyle = LAYERS[l].color; continue;
    }
    for (const cls of ['signal', 'diff', 'power', 'plane']) {
      ctx.beginPath();
      for (const n of routedAll) {
        if (n.cls !== cls) continue;
        for (const s of n.route.segs) { if (s.l !== l) continue; const p = s.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); }
      }
      if (cls === 'diff' && v.z > 3.5) { // 差動ペアは 2 本線として描く
        ctx.lineWidth = 0.34; ctx.stroke();
        const ga = ctx.globalAlpha; ctx.globalAlpha = 1; ctx.strokeStyle = C.board; ctx.lineWidth = 0.12; ctx.stroke();
        ctx.globalAlpha = ga; ctx.strokeStyle = LAYERS[l].color;
      } else { ctx.lineWidth = Math.max(NET_WIDTH[cls], px); ctx.stroke(); }
    }
  }
  ctx.globalAlpha = 1;
  // 強調ネット
  if (hi && hi.route) for (const l of order) {
    if (!S.layerVis[l]) continue;
    ctx.beginPath();
    for (const s of hi.route.segs) { if (s.l !== l) continue; const p = s.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); }
    ctx.lineWidth = Math.max(NET_WIDTH[hi.cls] * 2.2, 4 * px); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.35; ctx.stroke();
    ctx.lineWidth = Math.max(NET_WIDTH[hi.cls] * 1.3, 2 * px); ctx.strokeStyle = LAYERS[l].color; ctx.globalAlpha = 1; ctx.stroke();
  }
  // 電流の流れ（供給元 → 負荷）
  if (S.show.flow && S.show.zones && v.z > 1.5) {
    ctx.setLineDash([1.4, 2.6]); ctx.lineDashOffset = -(S.time || 0) * 9; ctx.lineWidth = Math.max(0.45, 1.5 * px); ctx.globalAlpha = hi || hg ? 0.25 : 0.95;
    for (const z of S.zones) {
      if (!z.flow.length) continue;
      ctx.strokeStyle = ZONE_COL[z.name] || '#fff'; ctx.beginPath();
      for (const [i, j] of z.flow) { ctx.moveTo(z.nodes[i].x, z.nodes[i].y); ctx.lineTo(z.nodes[j].x, z.nodes[j].y); }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
  }
  // ビア（信号ビアと、電源・GND をプレーンへ落とすビア）
  const vr = VIA.d / 2;
  if (v.z > 3 && S.show.pvias) {
    ctx.globalAlpha = hi || hg ? 0.25 : 0.8; ctx.fillStyle = '#56606b'; ctx.beginPath();
    for (const n of planeNets) { if (hi === n) continue; for (const q of n.route.vias) { if (q.x < vx0 || q.x > vx1 || q.y < vy0 || q.y > vy1) continue; if (v.z > 7) { ctx.moveTo(q.x + vr, q.y); ctx.arc(q.x, q.y, vr, 0, 6.2832); } else ctx.rect(q.x - vr, q.y - vr, VIA.d, VIA.d); } }
    ctx.fill();
  }
  if (v.z > 1.2) {
    ctx.globalAlpha = hi || hg ? 0.3 : 1; ctx.fillStyle = C.via; ctx.beginPath();
    for (const n of nets) for (const q of n.route.vias) { ctx.moveTo(q.x + vr, q.y); ctx.arc(q.x, q.y, vr, 0, 6.2832); }
    ctx.fill();
    if (v.z > 5) { ctx.fillStyle = C.hole; ctx.beginPath(); for (const n of nets) for (const q of n.route.vias) { ctx.moveTo(q.x + VIA.drill / 2, q.y); ctx.arc(q.x, q.y, VIA.drill / 2, 0, 6.2832); } ctx.fill(); }
    if (hi && hi.route) { ctx.globalAlpha = 1; ctx.fillStyle = C.hi; ctx.beginPath(); for (const q of hi.route.vias) { if (v.z > 3 || !hi.route.plane) { ctx.moveTo(q.x + vr * 1.2, q.y); ctx.arc(q.x, q.y, vr * 1.2, 0, 6.2832); } } ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // パッド
  const buckets = { far: [], nc: [], gnd: [], pwr: [], sig: [], hi: [] };
  for (const c of comps) {
    const near = c.side === nearSide;
    if (!near && !c.part.th && !S.show.far) continue;
    const dim = hg && hg !== c.group;
    for (const pad of c.part.pads) {
      if (Math.max(pad.w, pad.h) * v.z < 1.1) continue;
      const p = padWorld(c, pad), nm = c.padNet[pad.n];
      let k;
      if (hi && nm === hi.name) k = 'hi';
      else if (dim || (!near && !p.th)) k = 'far';
      else if (!nm) k = 'nc';
      else if (nm === 'GND') k = 'gnd';
      else { const n = b.nets.get(nm); k = n && n.cls === 'plane' ? 'pwr' : 'sig'; }
      buckets[k].push(p);
    }
  }
  const cols = { far: C.padFar, nc: C.padNc, gnd: C.padGnd, pwr: C.padPwr, sig: C.padSig, hi: C.hi };
  for (const k of ['far', 'nc', 'gnd', 'pwr', 'sig', 'hi']) {
    const arr = buckets[k]; if (!arr.length) continue;
    ctx.fillStyle = cols[k]; ctx.globalAlpha = (hi || hg) && k !== 'hi' && k !== 'far' ? (hg ? 0.9 : 0.45) : 1; ctx.beginPath();
    for (const p of arr) {
      if (p.round && p.w * v.z > 5) { ctx.moveTo(p.x + p.w / 2, p.y); ctx.arc(p.x, p.y, p.w / 2, 0, 6.2832); }
      else ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 手前側の部品
  const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h); };
  for (const c of comps) {
    if (c.side !== nearSide && !c.part.th) continue;
    const B = compBox(c), col = gcol(c), sel = S.sel.has(c), dim = hg && hg !== c.group, w = B.x1 - B.x0, h = B.y1 - B.y0, fam = c.part.family;
    if (real && fam !== 'pcie') {
      // 実物風：不透明なパッケージ、シルクの外形、1 番ピンの印
      ctx.globalAlpha = dim ? 0.25 : 1; ctx.fillStyle = realColor(c.part);
      if (fam === 'bulkin') { ctx.beginPath(); ctx.arc(c.x, c.y, Math.min(w, h) / 2, 0, 6.2832); } else rr(B.x0, B.y0, w, h, fam === 'mlcc' || fam === 'res' ? 0.08 : 0.35);
      ctx.fill();
      if (fam === 'gpu') { ctx.fillStyle = '#c3c9cf'; rr(c.x - w * 0.24, c.y - h * 0.24, w * 0.48, h * 0.48, 0.6); ctx.fill(); }
      else if (fam === 'ind' || fam === 'indin') { ctx.fillStyle = '#747a81'; rr(B.x0 + w * 0.12, B.y0 + h * 0.12, w * 0.76, h * 0.76, 0.8); ctx.fill(); }
      else if (fam === 'bulkin') { ctx.fillStyle = '#5b3f88'; ctx.beginPath(); ctx.arc(c.x, c.y, Math.min(w, h) / 2, -1.2, 0.4); ctx.lineTo(c.x, c.y); ctx.fill(); }
      else if ((fam === 'mlcc' || fam === 'bulk' || fam === 'res') && w * v.z > 6) { ctx.fillStyle = '#c9ced4'; const e = (c.rot % 180 ? h : w) * 0.2; if (c.rot % 180) { ctx.fillRect(B.x0, B.y0, w, e); ctx.fillRect(B.x0, B.y1 - e, w, e); } else { ctx.fillRect(B.x0, B.y0, e, h); ctx.fillRect(B.x1 - e, B.y0, e, h); } }
      if (c.part.pads.length > 6 && w * v.z > 14) { ctx.fillStyle = '#8c949c'; ctx.beginPath(); ctx.arc(B.x0 + 0.7, B.y0 + 0.7, 0.28, 0, 6.2832); ctx.fill(); }
      ctx.strokeStyle = sel ? '#ffffff' : 'rgba(235,238,240,0.5)'; ctx.lineWidth = sel ? 2 * px : Math.min(0.12, px);
      if (fam !== 'bulkin') { rr(B.x0, B.y0, w, h, 0.35); ctx.stroke(); }
      continue;
    }
    ctx.fillStyle = col; ctx.globalAlpha = dim ? 0.05 : sel ? 0.5 : (c.part.pads.length > 60 ? 0.16 : 0.3);
    rr(B.x0, B.y0, w, h, 0.3); ctx.fill();
    ctx.globalAlpha = dim ? 0.2 : 1; ctx.strokeStyle = sel ? '#ffffff' : col; ctx.lineWidth = sel ? 2 * px : px;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const c of S.sel) if (c.side !== nearSide && !c.part.th) { const B = compBox(c); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * px; ctx.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0); }

  // ラッツネスト
  if (S.show.rats && S.rats.length) {
    ctx.lineWidth = px; ctx.globalAlpha = hi ? 0.2 : 0.75;
    for (const role of ROLES) {   // 役割ごとに色を分ける
      ctx.strokeStyle = role.color; ctx.beginPath();
      for (const r of S.rats) { if ((hi && r.net === hi) || netRole(r.net) !== role) continue; ctx.moveTo(r.a.x, r.a.y); ctx.lineTo(r.b.x, r.b.y); }
      const a0 = ctx.globalAlpha; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a0 * 0.3; ctx.lineWidth = 5 * px; ctx.stroke();   // 発光のにじみ
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a0; ctx.lineWidth = px; ctx.stroke();
    }
    if (hi) { ctx.globalAlpha = 1; ctx.lineWidth = 1.5 * px; ctx.strokeStyle = C.rats; ctx.beginPath(); for (const r of S.rats) if (r.net === hi) { ctx.moveTo(r.a.x, r.a.y); ctx.lineTo(r.b.x, r.b.y); } ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // 配置中のゴースト・配線ツールのラバーバンド
  if (S.ghost) {
    const g = S.ghost, B = compBox(g);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * px; ctx.setLineDash([3 * px, 3 * px]); ctx.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0); ctx.setLineDash([]);
    ctx.fillStyle = C.padSig; ctx.globalAlpha = 0.8; ctx.beginPath();
    for (const pad of g.part.pads) { const p = padWorld(g, pad); ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); }
    ctx.fill(); ctx.globalAlpha = 1;
  }
  if (S.manPrev) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.15, 1.5 * px); ctx.setLineDash([2 * px, 2 * px]); ctx.beginPath(); S.manPrev.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.setLineDash([]); }
  if (S.wire) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * px; ctx.setLineDash([2 * px, 3 * px]); ctx.beginPath(); ctx.moveTo(S.wire.from.x, S.wire.from.y); ctx.lineTo(S.wire.to.x, S.wire.to.y); ctx.stroke(); ctx.setLineDash([]); }
  if (S.hoverPad) { const p = S.hoverPad; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * px; ctx.strokeRect(p.x - p.w / 2 - 0.15, p.y - p.h / 2 - 0.15, p.w + 0.3, p.h + 0.3); }

  // ラベル（スクリーン座標）
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (S.show.labels) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const c of comps) {
      if (c.side !== nearSide && !c.part.th) continue;
      const B = compBox(c), wpx = (B.x1 - B.x0) * v.z * Math.abs(f), hpx = (B.y1 - B.y0) * v.z;
      if (wpx < 30 || hpx < 12) continue;
      const s = toScreen(S, c.x, c.y), fs = Math.max(9, Math.min(15, Math.min(wpx, hpx) * 0.3));
      ctx.globalAlpha = hg && hg !== c.group ? 0.25 : 1;
      const lightBody = S.style === 'real' && /^(gpu|dp|hdmi|bulk|bulkin|fan|xtal|shunt|fuse|mlcc|ind|indin|pcie)$/.test(c.part.family);
      ctx.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; ctx.fillStyle = lightBody ? '#14181c' : '#f4f6f8';
      const big = wpx > 110 && hpx > 44;
      ctx.fillText(c.ref, s.x, s.y - (big ? fs * 0.7 : 0));
      if (big) { ctx.font = `400 ${Math.max(9, fs * 0.8)}px "IBM Plex Sans JP", system-ui, sans-serif`; ctx.fillStyle = lightBody ? '#2c343b' : '#c4ccd4'; ctx.fillText(c.part.pn, s.x, s.y + fs * 0.7, (c.part.family === 'gpu' && S.style === 'real' ? wpx * 0.46 : wpx) - 8); }
    }
    ctx.globalAlpha = 1;
  }
  if (S.regions) {
    ctx.font = '600 11px "IBM Plex Sans JP", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const used = [];
    for (const r of S.regions) {
      const p = toScreen(S, f < 0 ? r.x1 : r.x0, r.y0); let y = p.y + 3;
      while (used.some(u => Math.abs(u[0] - p.x) < 60 && Math.abs(u[1] - y) < 13)) y += 13;
      used.push([p.x, y]); ctx.fillStyle = r.color; ctx.fillText(r.label, p.x + 4, y);
    }
  }
  if (S.issues && S.issues.length && !S.regions) { // 問題箇所のマーカー
    ctx.strokeStyle = '#f07272'; ctx.lineWidth = 2; ctx.beginPath();
    for (const q of S.issues) { if ((q.side === 'B') !== back) continue; const p = toScreen(S, q.x, q.y); ctx.moveTo(p.x + 9, p.y); ctx.arc(p.x, p.y, 9, 0, 6.2832); }
    ctx.stroke();
  }
  if (S.marquee) { const m = S.marquee; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.setLineDash([]); }
  if (back) { ctx.fillStyle = '#6f9bff'; ctx.font = '600 12px "IBM Plex Sans JP", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('裏面から見た表示', 12, 32); }
}

// 3D 表示用のテクスチャ。kind: 'top' | 'bottom' | 1 | 2（内層）。sc = px/mm
// 表裏は「緑のレジスト → 配線が進むと銅色のベタ」に見せ、部品の外形枠（コートヤード）とパッドを描く。
export function drawLayerTexture(ctx, b, kind, sc, opt = {}) {
  const l = kind === 'top' ? 0 : kind === 'bottom' ? 3 : kind, outer = kind === 'top' || kind === 'bottom';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const routed = [...b.nets.values()].filter(n => n.route && (n.route.segs.length || n.route.vias.length));
  const path = cls => { ctx.beginPath(); for (const n of routed) { if (cls && n.cls !== cls) continue; for (const s of n.route.segs) { if (s.l !== l) continue; const p = s.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); } } };
  boardPath(ctx, b);
  if (!outer) {
    ctx.fillStyle = LAYERS[l].color; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 0.8; ctx.lineWidth = 0.25; ctx.strokeStyle = LAYERS[l].color; ctx.stroke(); ctx.globalAlpha = 1;
    path(); ctx.strokeStyle = LAYERS[l].color; ctx.lineWidth = Math.max(NET_WIDTH.signal, 2.4 / sc); ctx.stroke();
    ctx.fillStyle = C.via; ctx.beginPath();
    for (const n of routed) { if (n.route.plane) continue; for (const q of n.route.vias) { ctx.moveTo(q.x + VIA.d / 2, q.y); ctx.arc(q.x, q.y, VIA.d / 2, 0, 6.2832); } }
    ctx.fill();
    return;
  }
  const pour = Math.max(0, Math.min(1, opt.pour || 0)), side = kind === 'top' ? 'T' : 'B';
  if (opt.finish && opt.finish !== 'ref') { drawRealBoard(ctx, b, l, side, sc, pour, opt, routed, path); return; }
  ctx.fillStyle = '#1e4632'; ctx.fill();
  if (pour > 0) { ctx.globalAlpha = pour; ctx.fillStyle = '#7d5546'; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.save(); boardPath(ctx, b); ctx.clip();
  // 配線：周囲を暗く抜いて（クリアランス）、明るい銅色で引く
  path(); ctx.strokeStyle = pour > 0.05 ? '#4a3128' : '#17382a'; ctx.lineWidth = Math.max(0.6, 5 / sc); ctx.stroke();
  ctx.strokeStyle = '#ff7a52'; ctx.lineWidth = Math.max(NET_WIDTH.signal, 1.8 / sc); ctx.stroke();
  // 部品の外形枠
  ctx.strokeStyle = 'rgba(226,240,232,0.55)'; ctx.lineWidth = Math.max(0.12, 1 / sc);
  for (const c of b.comps) {
    if (c.side !== side && !c.part.th) continue;
    const B = compBox(c, 0.25);
    if (c.part.family === 'hole') { ctx.strokeRect(c.x - 3.2, c.y - 3.2, 6.4, 6.4); continue; }
    ctx.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
  }
  // パッドとビア
  ctx.fillStyle = '#d9dde2'; ctx.beginPath();
  for (const n of routed) { if (n.route.plane) continue; for (const q of n.route.vias) { ctx.moveTo(q.x + VIA.d / 2, q.y); ctx.arc(q.x, q.y, VIA.d / 2, 0, 6.2832); } }
  ctx.fill();
  for (const [key, col] of [['gnd', '#b79a55'], ['pwr', '#e0a85a'], ['sig', '#f1d27a'], ['hole', '#060708']]) {
    ctx.fillStyle = col; ctx.beginPath();
    for (const c of b.comps) for (const pad of c.part.pads) {
      if (c.side !== side && !pad.th) continue;
      const nm = c.padNet[pad.n], n = nm && b.nets.get(nm);
      const k = c.part.family === 'hole' ? 'hole' : nm === 'GND' || !n ? 'gnd' : n.cls === 'plane' ? 'pwr' : 'sig';
      if (k !== key) continue;
      const p = padWorld(c, pad);
      if (p.round || pad.th) { ctx.moveTo(p.x + p.w / 2, p.y); ctx.arc(p.x, p.y, p.w / 2, 0, 6.2832); } else ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }
    ctx.fill();
  }
  ctx.restore();
  boardPath(ctx, b); ctx.lineWidth = 0.35; ctx.strokeStyle = '#b9d2c4'; ctx.stroke();
}

// 実物に近い基板面：ソルダーレジスト越しに見える銅箔（ベタと配線）、金めっきのパッド、
// レジストで覆われたビア、白いシルク（外形・部品番号・1 番ピン）、めっきされた取り付け穴。
// opt.aux=true のときは陰影用のマップを描く（R=凹凸, G=粗さ, B=金属度）。
const FINISH = {
  green: { base: '#0a3522', cu: '#176b41', gap: '#082c1c', silk: '#f1f1ea', gold: '#d8b560', edge: '#0a2f1e' },
  black: { base: '#101214', cu: '#26292d', gap: '#0b0c0e', silk: '#eeeeea', gold: '#d8b560', edge: '#08090a' },
};
function drawRealBoard(ctx, b, l, side, sc, pour, opt, routed, path) {
  const aux = !!opt.aux, F = FINISH[opt.finish] || FINISH.green;
  const col = aux ? { base: 'rgb(84,122,0)', cu: 'rgb(150,112,0)', gap: 'rgb(70,125,0)', silk: 'rgb(196,235,0)', gold: 'rgb(178,74,255)', edge: 'rgb(84,122,0)' } : F;
  boardPath(ctx, b); ctx.fillStyle = col.base; ctx.fill();
  ctx.save(); boardPath(ctx, b); ctx.clip();
  // 外層の GND ベタ（配線が進むにつれて現れる）
  if (pour > 0) { ctx.globalAlpha = pour; ctx.fillStyle = col.cu; ctx.fillRect(0.8, 0.8, b.w - 1.6, b.gridH - 1.6); ctx.globalAlpha = 1; }
  // 配線：ベタとの間に隙間を空けて、銅箔の色で
  path(); ctx.strokeStyle = col.gap; ctx.lineWidth = NET_WIDTH.signal + 0.42; ctx.stroke();
  ctx.strokeStyle = col.cu; ctx.lineWidth = Math.max(NET_WIDTH.signal + 0.02, 1.4 / sc); ctx.stroke();
  // ビア（レジストで覆われた小さなふくらみ）
  if (!opt.fast) {
    ctx.fillStyle = col.gap; ctx.beginPath();
    for (const n of routed) for (const q of n.route.vias) { ctx.moveTo(q.x + 0.36, q.y); ctx.arc(q.x, q.y, 0.36, 0, 6.2832); }
    ctx.fill();
    ctx.fillStyle = col.cu; ctx.beginPath();
    for (const n of routed) for (const q of n.route.vias) { ctx.moveTo(q.x + VIA.d / 2, q.y); ctx.arc(q.x, q.y, VIA.d / 2, 0, 6.2832); }
    ctx.fill();
    if (!aux && sc >= 10) { ctx.fillStyle = col.gap; ctx.beginPath(); for (const n of routed) for (const q of n.route.vias) { ctx.moveTo(q.x + 0.08, q.y); ctx.arc(q.x, q.y, 0.08, 0, 6.2832); } ctx.fill(); }
  }
  // パッド：レジストの開口 → 金めっき
  const mine = c => c.side === side || c.part.th;
  for (const passN of [0, 1]) {
    ctx.fillStyle = passN ? col.gold : col.gap; ctx.beginPath();
    const m = passN ? 0 : 0.09;
    for (const c of b.comps) { if (c.part.family === 'hole') continue; for (const pad of c.part.pads) {
      if (c.side !== side && !pad.th) continue;
      const p = padWorld(c, pad);
      if (p.round || pad.th) { ctx.moveTo(p.x + p.w / 2 + m, p.y); ctx.arc(p.x, p.y, p.w / 2 + m, 0, 6.2832); } else ctx.rect(p.x - p.w / 2 - m, p.y - p.h / 2 - m, p.w + 2 * m, p.h + 2 * m);
    } }
    ctx.fill();
  }
  // スルーホールと取り付け穴
  ctx.fillStyle = aux ? 'rgb(0,255,0)' : '#050506'; ctx.beginPath();
  for (const c of b.comps) for (const pad of c.part.pads) { if (!pad.th) continue; const p = padWorld(c, pad), r = c.part.family === 'hole' ? p.w / 2 : Math.max(0.2, p.w * 0.28); ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, 6.2832); }
  ctx.fill();
  ctx.strokeStyle = col.gold; ctx.lineWidth = 0.45; ctx.beginPath();
  for (const c of b.comps) if (c.part.family === 'hole') { ctx.moveTo(c.x + 2.1, c.y); ctx.arc(c.x, c.y, 2.1, 0, 6.2832); }
  ctx.stroke();
  // シルク
  if (!opt.fast) {
    ctx.strokeStyle = ctx.fillStyle = col.silk; ctx.lineWidth = 0.13; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const boxes = b.comps.filter(c => mine(c) && c.part.family !== 'hole').map(c => ({ ...compBox(c, 0.1), c }));
    for (const c of b.comps) {
      if (!mine(c) || c.part.family === 'pcie' || c.part.family === 'hole') continue;
      const B = compBox(c, 0.18), w = B.x1 - B.x0, h = B.y1 - B.y0, small = c.part.pads.length === 2 && w * h < 9;
      if (small) { // チップ部品は両脇の線だけ
        ctx.beginPath(); if (w >= h) { ctx.moveTo(B.x0 + w * 0.3, B.y0); ctx.lineTo(B.x1 - w * 0.3, B.y0); ctx.moveTo(B.x0 + w * 0.3, B.y1); ctx.lineTo(B.x1 - w * 0.3, B.y1); } else { ctx.moveTo(B.x0, B.y0 + h * 0.3); ctx.lineTo(B.x0, B.y1 - h * 0.3); ctx.moveTo(B.x1, B.y0 + h * 0.3); ctx.lineTo(B.x1, B.y1 - h * 0.3); } ctx.stroke();
        continue;
      }
      const k = Math.min(1.2, w * 0.18, h * 0.18);     // 角だけの外形線
      ctx.beginPath();
      for (const [x, y, dx, dy] of [[B.x0, B.y0, 1, 1], [B.x1, B.y0, -1, 1], [B.x1, B.y1, -1, -1], [B.x0, B.y1, 1, -1]]) { ctx.moveTo(x + dx * k, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * k); }
      ctx.stroke();
      if (c.part.pads.length > 2) { ctx.beginPath(); ctx.arc(B.x0 - 0.35, B.y0 - 0.35, 0.22, 0, 6.2832); ctx.fill(); }
      if (aux || sc < 8) continue;
      // 部品番号は、ほかの部品に隠れない側（上 → 下 → 右 → 左）へ置く。空きがなければ省く
      const fs = Math.max(0.7, Math.min(1.5, Math.min(w, 12) * 0.2)), tw = c.ref.length * fs * 0.62 + 0.4, th = fs + 0.3;
      let at = null;
      for (const [tx, ty] of [[c.x, B.y0 - th / 2 - 0.1], [c.x, B.y1 + th / 2 + 0.1], [B.x1 + tw / 2 + 0.2, c.y], [B.x0 - tw / 2 - 0.2, c.y]]) {
        const R = { x0: tx - tw / 2, y0: ty - th / 2, x1: tx + tw / 2, y1: ty + th / 2 };
        if (R.x0 < 0.6 || R.y0 < 0.6 || R.x1 > b.w - 0.6 || R.y1 > b.h - 0.6) continue;
        if (boxes.some(q => q.c !== c && R.x1 > q.x0 && R.x0 < q.x1 && R.y1 > q.y0 && R.y0 < q.y1)) continue;
        at = [tx, ty]; boxes.push({ ...R, c: null }); break;
      }
      if (!at) continue;
      ctx.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.save(); ctx.translate(at[0], at[1]); if (side === 'B') ctx.scale(-1, 1); ctx.fillText(c.ref, 0, 0); ctx.restore();
    }
    if (!aux && side === 'T' && b.tab) { // 基板名のシルク
      ctx.font = '700 1.7px "IBM Plex Mono", ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('GPU-KIBAN STUDIO   REV A   ' + Math.round(b.w) + 'x' + Math.round(b.h) + 'mm', b.tab.x1 + 5, b.h - 1.7);
    }
  }
  ctx.restore();
  boardPath(ctx, b); ctx.lineWidth = 0.3; ctx.strokeStyle = col.edge; ctx.stroke();
}
