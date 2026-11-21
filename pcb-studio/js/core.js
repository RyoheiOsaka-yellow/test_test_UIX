// 基板モデルと幾何ヘルパ。単位は mm、配線グリッドは 0.5mm。
export const G = 0.5;
export const snap = v => Math.round(v / G) * G;

export const LAYERS = [
  { id: 0, key: 'F.Cu', label: 'L1 表層', color: '#f0714b' },
  { id: 1, key: 'In1.Cu', label: 'L3 内層(横)', color: '#e9bd4a' },
  { id: 2, key: 'In2.Cu', label: 'L4 内層(縦)', color: '#43c2ae' },
  { id: 3, key: 'B.Cu', label: 'L6 裏層', color: '#6f9bff' },
];
export const NL = LAYERS.length;

// 配線しない「プレーン」ネット（内層ベタで供給する想定）
export const NET_WIDTH = { signal: 0.16, diff: 0.24, power: 0.4, plane: 0.3 };

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class Board {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.tab = null;            // PCIe カードエッジ {x0,x1,h}
    this.comps = [];
    this.nets = new Map();      // name -> net
    this.netById = [null];
    this.groups = [];           // {id,label,kind,color}
    this.refSeq = {};
    this.idSeq = 1;
    this.meta = {};
  }
  get gridH() { return this.h + (this.tab ? this.tab.h : 0); }
  inside(x, y) {
    if (x < 0 || x > this.w || y < 0) return false;
    if (y <= this.h) return true;
    const t = this.tab;
    return !!t && x >= t.x0 && x <= t.x1 && y <= this.h + t.h;
  }
  group(id) { return this.groups.find(g => g.id === id); }
  ensureGroup(id, label, kind, color) {
    let g = this.group(id);
    if (!g) { g = { id, label, kind, color }; this.groups.push(g); }
    return g;
  }
  nextRef(prefix) {
    const n = (this.refSeq[prefix] || 0) + 1;
    this.refSeq[prefix] = n;
    return prefix + n;
  }
  add(part, x, y, o = {}) {
    const c = {
      id: this.idSeq++, ref: o.ref || this.nextRef(part.ref || 'U'), part,
      x: snap(x), y: snap(y), rot: o.rot || 0, side: o.side || 'T',
      group: o.group || 'grp_misc', fixed: !!o.fixed,
      near: o.near || null, nearR: o.nearR || 0, padNet: {},
    };
    this.comps.push(c);
    return c;
  }
  comp(id) { return this.comps.find(c => c.id === id); }
  net(name, cls = 'signal') {
    let n = this.nets.get(name);
    if (!n) {
      n = { name, id: this.netById.length, cls, pins: [], route: null };
      this.nets.set(name, n); this.netById.push(n);
    }
    return n;
  }
  connect(c, padName, netName, cls) {
    this.disconnect(c, padName);
    const n = this.net(netName, cls);
    n.pins.push({ c, p: padName });
    c.padNet[padName] = netName;
    return n;
  }
  disconnect(c, padName) {
    const nm = c.padNet[padName];
    if (!nm) return null;
    const n = this.nets.get(nm);
    delete c.padNet[padName];
    if (n) {
      n.pins = n.pins.filter(p => !(p.c === c && p.p === padName));
      if (!n.pins.length) { this.nets.delete(nm); this.netById[n.id] = null; }
    }
    return n;
  }
  remove(c) {
    for (const p of Object.keys(c.padNet)) this.disconnect(c, p);
    this.comps = this.comps.filter(x => x !== c);
    for (const o of this.comps) if (o.near === c.id) o.near = null;
  }
  netsOf(c) {
    const s = new Set();
    for (const nm of Object.values(c.padNet)) { const n = this.nets.get(nm); if (n) s.add(n); }
    return s;
  }
  newNetName() {
    let i = 1;
    while (this.nets.has('N$' + i)) i++;
    return 'N$' + i;
  }
}

export function padDef(c, name) { return c.part.padMap[name]; }

// パッドのワールド座標。裏面部品は X を鏡像にする。
export function padWorld(c, pad) {
  let x = c.side === 'B' ? -pad.x : pad.x, y = pad.y, w = pad.w, h = pad.h;
  const r = c.rot;
  if (r === 90) { [x, y] = [-y, x]; [w, h] = [h, w]; }
  else if (r === 180) { x = -x; y = -y; }
  else if (r === 270) { [x, y] = [y, -x]; [w, h] = [h, w]; }
  return { x: c.x + x, y: c.y + y, w, h, th: !!pad.th, round: !!pad.round };
}
export function pinPos(pin) { return padWorld(pin.c, pin.c.part.padMap[pin.p]); }

export function compBox(c, m = 0) {
  const sw = c.rot % 180 ? c.part.h : c.part.w, sh = c.rot % 180 ? c.part.w : c.part.h;
  return { x0: c.x - sw / 2 - m, y0: c.y - sh / 2 - m, x1: c.x + sw / 2 + m, y1: c.y + sh / 2 + m };
}
export function boxOverlap(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}
// 同じ面で干渉するか（スルーホール部品は両面を占有）
export function sameSide(a, b) { return a.side === b.side || a.part.th || b.part.th; }

// 未配線の接続（ラッツネスト）を列挙
export function ratsnest(board) {
  const out = [];
  for (const n of board.nets.values()) {
    if (n.cls === 'plane' || n.pins.length < 2) continue;
    const pts = n.pins.map(pinPos);
    if (n.route && !n.route.fails.length) continue;
    if (n.route) {
      const bad = new Set(n.route.fails);
      for (const i of bad) {
        let best = -1, bd = 1e18;
        for (let j = 0; j < pts.length; j++) {
          if (bad.has(j)) continue;
          const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
        if (best >= 0) out.push({ net: n, a: pts[i], b: pts[best] });
      }
      continue;
    }
    // Prim 法の最小全域木
    const inT = new Uint8Array(pts.length); inT[0] = 1;
    for (let k = 1; k < pts.length; k++) {
      let bi = -1, bj = -1, bd = 1e18;
      for (let i = 0; i < pts.length; i++) {
        if (!inT[i]) continue;
        for (let j = 0; j < pts.length; j++) {
          if (inT[j]) continue;
          const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
          if (d < bd) { bd = d; bi = i; bj = j; }
        }
      }
      inT[bj] = 1; out.push({ net: n, a: pts[bi], b: pts[bj] });
    }
  }
  return out;
}

export function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

// 保存・取り消し用のシリアライズ（配線は保存せず再計算する）
export function serialize(board) {
  return {
    w: board.w, h: board.h, tab: board.tab, meta: board.meta, groups: board.groups,
    refSeq: board.refSeq,
    comps: board.comps.map(c => ({
      id: c.id, ref: c.ref, part: c.part.id, x: c.x, y: c.y, rot: c.rot, side: c.side,
      group: c.group, fixed: c.fixed, near: c.near, nearR: c.nearR, padNet: c.padNet,
    })),
    nets: [...board.nets.values()].map(n => [n.name, n.cls]),
  };
}
export function deserialize(data, partsById) {
  const b = new Board(data.w, data.h);
  b.tab = data.tab; b.meta = data.meta || {}; b.groups = data.groups || [];
  b.refSeq = { ...(data.refSeq || {}) };
  const cls = new Map(data.nets || []);
  for (const d of data.comps) {
    const part = partsById[d.part];
    if (!part) continue;
    const c = b.add(part, d.x, d.y, { ref: d.ref, rot: d.rot, side: d.side, group: d.group, fixed: d.fixed, near: d.near, nearR: d.nearR });
    c.id = d.id; b.idSeq = Math.max(b.idSeq, d.id + 1);
    for (const [p, nm] of Object.entries(d.padNet || {})) if (part.padMap[p]) b.connect(c, p, nm, cls.get(nm) || 'signal');
  }
  return b;
}
