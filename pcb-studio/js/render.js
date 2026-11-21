// Canvas 描画。ワールド座標 mm、基板中心まわりの左右反転（裏返し）に対応。
import { LAYERS, NL, NET_WIDTH, padWorld, compBox } from './core.js';

const C = {
  bg: '#0d1216', board: '#171d22', edge: '#c9a25a', bracket: '#56606b', via: '#d9dde2', hole: '#0d1216',
  padSig: '#f1d27a', padGnd: '#7f8a96', padPwr: '#e8955a', padNc: '#4d5661', padFar: '#3d4955', hi: '#ffffff', rats: '#e9eef5',
};
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
  ctx.fillStyle = C.bracket; ctx.fillRect(-3.2, -5, 1.2, b.h + 9);
  boardPath(ctx, b); ctx.fillStyle = C.board; ctx.fill();
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
  const nets = [...b.nets.values()].filter(n => n.route && n.route.segs.length);
  for (const l of order) {
    if (!S.layerVis[l]) continue;
    ctx.strokeStyle = LAYERS[l].color;
    ctx.globalAlpha = hi || hg ? 0.2 : (l === order[NL - 1] ? 1 : 0.85);
    for (const cls of ['signal', 'diff', 'power']) {
      ctx.beginPath();
      for (const n of nets) {
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
  // ビア
  if (v.z > 1.2) {
    ctx.globalAlpha = hi || hg ? 0.3 : 1; ctx.fillStyle = C.via; ctx.beginPath();
    for (const n of nets) for (const q of n.route.vias) { ctx.moveTo(q.x + 0.3, q.y); ctx.arc(q.x, q.y, 0.3, 0, 6.2832); }
    ctx.fill();
    if (v.z > 5) { ctx.fillStyle = C.hole; ctx.beginPath(); for (const n of nets) for (const q of n.route.vias) { ctx.moveTo(q.x + 0.13, q.y); ctx.arc(q.x, q.y, 0.13, 0, 6.2832); } ctx.fill(); }
    if (hi && hi.route) { ctx.globalAlpha = 1; ctx.fillStyle = C.hi; ctx.beginPath(); for (const q of hi.route.vias) { ctx.moveTo(q.x + 0.36, q.y); ctx.arc(q.x, q.y, 0.36, 0, 6.2832); } ctx.fill(); }
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
  for (const c of comps) {
    if (c.side !== nearSide && !c.part.th) continue;
    const B = compBox(c), col = gcol(c), sel = S.sel.has(c), dim = hg && hg !== c.group;
    ctx.fillStyle = col; ctx.globalAlpha = dim ? 0.05 : sel ? 0.5 : (c.part.pads.length > 60 ? 0.16 : 0.3);
    ctx.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    ctx.globalAlpha = dim ? 0.2 : 1; ctx.strokeStyle = sel ? '#ffffff' : col; ctx.lineWidth = sel ? 2 * px : px;
    ctx.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
  }
  ctx.globalAlpha = 1;
  for (const c of S.sel) if (c.side !== nearSide && !c.part.th) { const B = compBox(c); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * px; ctx.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0); }

  // ラッツネスト
  if (S.show.rats && S.rats.length) {
    ctx.lineWidth = px; ctx.strokeStyle = C.rats; ctx.globalAlpha = hi ? 0.15 : 0.5; ctx.beginPath();
    for (const r of S.rats) { if (hi && r.net === hi) continue; ctx.moveTo(r.a.x, r.a.y); ctx.lineTo(r.b.x, r.b.y); }
    ctx.stroke();
    if (hi) { ctx.globalAlpha = 1; ctx.lineWidth = 1.5 * px; ctx.beginPath(); for (const r of S.rats) if (r.net === hi) { ctx.moveTo(r.a.x, r.a.y); ctx.lineTo(r.b.x, r.b.y); } ctx.stroke(); }
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
      ctx.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; ctx.fillStyle = '#f4f6f8';
      const big = wpx > 110 && hpx > 44;
      ctx.fillText(c.ref, s.x, s.y - (big ? fs * 0.7 : 0));
      if (big) { ctx.font = `400 ${Math.max(9, fs * 0.8)}px "IBM Plex Sans JP", system-ui, sans-serif`; ctx.fillStyle = '#c4ccd4'; ctx.fillText(c.part.pn, s.x, s.y + fs * 0.7, wpx - 8); }
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
export function drawLayerTexture(ctx, b, kind, sc) {
  const l = kind === 'top' ? 0 : kind === 'bottom' ? 3 : kind, outer = kind === 'top' || kind === 'bottom';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  boardPath(ctx, b);
  if (outer) { ctx.fillStyle = C.board; ctx.fill(); ctx.lineWidth = 0.3; ctx.strokeStyle = C.edge; ctx.stroke(); }
  else { ctx.fillStyle = LAYERS[l].color; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 0.8; ctx.lineWidth = 0.25; ctx.strokeStyle = LAYERS[l].color; ctx.stroke(); ctx.globalAlpha = 1; }
  const nets = [...b.nets.values()].filter(n => n.route && n.route.segs.length);
  ctx.strokeStyle = LAYERS[l].color;
  for (const cls of ['signal', 'diff', 'power']) {
    ctx.beginPath();
    for (const n of nets) { if (n.cls !== cls) continue; for (const s of n.route.segs) { if (s.l !== l) continue; const p = s.pts; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); } }
    ctx.lineWidth = Math.max(NET_WIDTH[cls], (outer ? 1.6 : 2.4) / sc); ctx.stroke();
  }
  ctx.fillStyle = C.via; ctx.beginPath();
  for (const n of nets) for (const q of n.route.vias) { ctx.moveTo(q.x + 0.3, q.y); ctx.arc(q.x, q.y, 0.3, 0, 6.2832); }
  ctx.fill();
  if (!outer) return;
  const side = kind === 'top' ? 'T' : 'B';
  for (const [key, col] of [['gnd', C.padGnd], ['pwr', C.padPwr], ['sig', C.padSig]]) {
    ctx.fillStyle = col; ctx.beginPath();
    for (const c of b.comps) for (const pad of c.part.pads) {
      if (c.side !== side && !pad.th) continue;
      const nm = c.padNet[pad.n], n = nm && b.nets.get(nm);
      const k = nm === 'GND' || !n ? 'gnd' : n.cls === 'plane' ? 'pwr' : 'sig';
      if (k !== key) continue;
      const p = padWorld(c, pad); ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }
    ctx.fill();
  }
}
