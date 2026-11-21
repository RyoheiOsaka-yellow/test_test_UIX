// グリッド A* 自動配線（4 配線層・45度配線・貫通ビア・引き剥がし再配線つき）
import { G, NL, padWorld } from './core.js';

const SQ2 = Math.SQRT2;
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
const VIA_COST = 12, RIP_COST = 45;

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

export class Router {
  constructor(board) { this.setBoard(board); }
  setBoard(board) {
    this.board = board;
    this.nx = Math.round(board.w / G) + 1;
    this.ny = Math.round(board.gridH / G) + 1;
    this.plane = this.nx * this.ny;
    const n = this.plane * NL;
    this.occ = new Int32Array(n);     // 0=空き, -1=禁止, >0=ネットID
    this.fixed = new Uint8Array(n);   // パッド・基板外など動かせないセル
    this.g = new Float32Array(n);
    this.par = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.pen = new Uint8Array(this.plane);      // 他ネットのパッド周辺を避けるためのコスト
    this.penOwner = new Int32Array(this.plane);
    this.gen = 0;
    this.rebuild();
  }
  cell(l, ix, iy) { return (l * this.ny + iy) * this.nx + ix; }
  inGrid(ix, iy) { return ix >= 0 && iy >= 0 && ix < this.nx && iy < this.ny; }

  // パッドと既存配線からグリッドを作り直す。パッドに潰された配線のネットを返す。
  rebuild() {
    const { occ, fixed, nx, ny, board } = this;
    occ.fill(0); fixed.fill(0); this.pen.fill(0); this.penOwner.fill(0);
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      if (!board.inside(ix * G, iy * G)) for (let l = 0; l < NL; l++) { const c = this.cell(l, ix, iy); occ[c] = -1; fixed[c] = 1; }
    }
    for (const c of board.comps) for (const pad of c.part.pads) {
      const p = padWorld(c, pad);
      const nm = c.padNet[pad.n], net = nm && board.nets.get(nm);
      const id = net ? net.id : -1;
      const x0 = Math.ceil((p.x - p.w / 2 - 0.1) / G - 1e-6), x1 = Math.floor((p.x + p.w / 2 + 0.1) / G + 1e-6);
      const y0 = Math.ceil((p.y - p.h / 2 - 0.1) / G - 1e-6), y1 = Math.floor((p.y + p.h / 2 + 0.1) / G + 1e-6);
      const cx = Math.round(p.x / G), cy = Math.round(p.y / G);
      const l0 = p.th ? 0 : (c.side === 'B' ? NL - 1 : 0), l1 = p.th ? NL - 1 : l0;
      if (net && net.cls !== 'plane' && net.pins.length > 1) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const ix = cx + dx, iy = cy + dy; if (!this.inGrid(ix, iy)) continue;
          const r = iy * nx + ix, v = dx || dy ? 3 : 9;
          if (v > this.pen[r]) { this.pen[r] = v; this.penOwner[r] = id; }
        }
      }
      for (let l = l0; l <= l1; l++) {
        for (let iy = Math.min(y0, cy); iy <= Math.max(y1, cy); iy++) for (let ix = Math.min(x0, cx); ix <= Math.max(x1, cx); ix++) {
          if (!this.inGrid(ix, iy)) continue;
          const k = this.cell(l, ix, iy);
          if (occ[k] === -1 && fixed[k] && id !== -1 && !board.inside(ix * G, iy * G)) continue;
          occ[k] = id; fixed[k] = 1;
        }
      }
    }
    const bad = new Set();
    for (const net of board.nets.values()) {
      if (!net.route) continue;
      for (const k of net.route.cells) {
        if (fixed[k] && occ[k] !== net.id) bad.add(net);
        else if (occ[k] && occ[k] !== net.id) bad.add(net);
        else occ[k] = net.id;
      }
    }
    return bad;
  }

  ripNet(net) {
    if (!net.route) return;
    const { occ, fixed } = this;
    for (const k of net.route.cells) if (occ[k] === net.id && !fixed[k]) occ[k] = 0;
    net.route = null;
  }
  ripAll() { for (const n of this.board.nets.values()) this.ripNet(n); }

  pinCells(pin) {
    const c = pin.c, pad = c.part.padMap[pin.p], p = padWorld(c, pad);
    const ix = Math.round(p.x / G), iy = Math.round(p.y / G);
    if (!this.inGrid(ix, iy)) return [];
    const out = [];
    if (p.th) for (let l = 0; l < NL; l++) out.push(this.cell(l, ix, iy));
    else out.push(this.cell(c.side === 'B' ? NL - 1 : 0, ix, iy));
    return out;
  }

  // sources(複数) から targets のいずれかまで探索。rip=true なら他ネットの配線を高コストで横切れる。
  search(id, sources, targets, rip) {
    const { occ, fixed, g, par, stamp, closed, nx, ny, plane, pen, penOwner } = this;
    const gen = ++this.gen;
    const tset = new Set(targets);
    const t0 = targets[0] % plane, tx = t0 % nx, ty = (t0 / nx) | 0;
    const heap = new Heap();
    const hfun = (ix, iy) => { const dx = Math.abs(ix - tx), dy = Math.abs(iy - ty); return (dx > dy ? dx + 0.4142 * dy : dy + 0.4142 * dx) * 1.001; };
    for (const s of sources) {
      stamp[s] = gen; g[s] = 0; par[s] = -1;
      const r = s % plane; heap.push(hfun(r % nx, (r / nx) | 0), s);
    }
    const pass = k => { const o = occ[k]; if (o === 0 || o === id) return 0; if (rip && o > 0 && !fixed[k]) return RIP_COST; return -1; };
    let found = -1, pops = 0;
    const LIMIT = rip ? 900000 : 600000;
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (tset.has(cur)) { found = cur; break; }
      if (++pops > LIMIT) break;
      const gc = g[cur], l = (cur / plane) | 0, r = cur - l * plane, ix = r % nx, iy = (r / nx) | 0;
      for (let d = 0; d < 8; d++) {
        const jx = ix + DX[d], jy = iy + DY[d];
        if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
        const k = cur + DX[d] + DY[d] * nx;
        const pc = pass(k); if (pc < 0) continue;
        let step = d < 4 ? 1 : SQ2;
        if (d >= 4) { // 斜め移動は角を横切らない（交差・短絡防止）
          const a = occ[cur + DX[d]], b = occ[cur + DY[d] * nx];
          if ((a !== 0 && a !== id) || (b !== 0 && b !== id)) continue;
        }
        if (l === 1 && DY[d] !== 0) step *= 1.6; else if (l === 2 && DX[d] !== 0) step *= 1.6; else if (l === 3) step *= 1.05;
        const rr = r + DX[d] + DY[d] * nx;
        if (pen[rr] && penOwner[rr] !== id) step += pen[rr];
        const ng = gc + step + pc;
        if (stamp[k] !== gen || ng < g[k]) { stamp[k] = gen; g[k] = ng; par[k] = cur; heap.push(ng + hfun(jx, jy), k); }
      }
      // 貫通ビア：全層で通行可能なときだけ層を替えられる
      let ok = true, extra = 0;
      for (let m = 0; m < NL && ok; m++) { const pc = pass(m * plane + r); if (pc < 0) ok = false; else extra += pc; }
      if (ok) for (let m = 0; m < NL; m++) {
        if (m === l) continue;
        const k = m * plane + r, ng = gc + VIA_COST + extra;
        if (stamp[k] !== gen || ng < g[k]) { stamp[k] = gen; g[k] = ng; par[k] = cur; heap.push(ng + hfun(ix, iy), k); }
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let k = found; k !== -1; k = par[k]) path.push(k);
    return path;
  }

  // 1 ネットを配線する。戻り値: 引き剥がしたネットの集合
  routeNet(net, rip = false) {
    this.ripNet(net);
    const { occ, fixed, plane, nx } = this, id = net.id;
    const route = { cells: [], segs: [], vias: [], fails: [], len: 0 };
    net.route = route;
    const ripped = new Set();
    if (net.cls === 'plane' || net.pins.length < 2) return ripped;
    const pc = net.pins.map(p => this.pinCells(p));
    const pos = net.pins.map(p => padWorld(p.c, p.c.part.padMap[p.p]));
    const done = [], todo = [];
    for (let i = 0; i < pc.length; i++) {
      // 他部品のパッドと重なっているピンは接続不能
      if (!pc[i].length || pc[i].every(k => occ[k] !== id)) route.fails.push(i);
      else if (!done.length) done.push(i); else todo.push(i);
    }
    if (!done.length) return ripped;
    const tree = [...pc[done[0]]];
    while (todo.length) {
      let bi = 0, bd = 1e18;
      for (let a = 0; a < todo.length; a++) for (const j of done) {
        const d = (pos[todo[a]].x - pos[j].x) ** 2 + (pos[todo[a]].y - pos[j].y) ** 2;
        if (d < bd) { bd = d; bi = a; }
      }
      const i = todo.splice(bi, 1)[0];
      const path = this.search(id, tree, pc[i], rip);
      if (!path) { route.fails.push(i); continue; }
      if (rip) for (const k of path) {
        const r = k % plane;
        for (let m = 0; m < NL; m++) { const o = occ[m * plane + r]; if (o > 0 && o !== id && !fixed[m * plane + r]) { const on = this.board.netById[o]; if (on && on.route) ripped.add(on); } }
      }
      for (const on of ripped) this.ripNet(on);
      // 経路を確定
      let seg = null;
      for (let q = 0; q < path.length; q++) {
        const k = path[q], l = (k / plane) | 0, r = k - l * plane, x = (r % nx) * G, y = ((r / nx) | 0) * G;
        const prev = q ? path[q - 1] : -1;
        if (prev >= 0 && ((prev / plane) | 0) !== l) { // 層替え＝ビア
          route.vias.push({ x, y });
          for (let m = 0; m < NL; m++) { const kk = m * plane + r; occ[kk] = id; route.cells.push(kk); }
          seg = null;
        }
        occ[k] = id; route.cells.push(k); tree.push(k);
        if (!seg) { seg = { l, pts: [x, y] }; route.segs.push(seg); }
        else {
          const p = seg.pts, n = p.length;
          route.len += Math.hypot(x - p[n - 2], y - p[n - 1]);
          if (n >= 4) { // 同一直線上なら点を伸ばすだけ
            const ax = p[n - 2] - p[n - 4], ay = p[n - 1] - p[n - 3], bx = x - p[n - 2], by = y - p[n - 1];
            if (Math.abs(ax * by - ay * bx) < 1e-9 && ax * bx + ay * by > 0) { p[n - 2] = x; p[n - 1] = y; continue; }
          }
          p.push(x, y);
        }
      }
      done.push(i);
    }
    route.segs = route.segs.filter(s => s.pts.length >= 4);
    return ripped;
  }

  order(nets) {
    const pr = { power: 0, diff: 1, signal: 2 };
    const span = n => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of n.pins) { const q = padWorld(p.c, p.c.part.padMap[p.p]); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      return (x1 - x0) + (y1 - y0);
    };
    return nets.filter(n => n.cls !== 'plane' && n.pins.length > 1)
      .map(n => [n, (pr[n.cls] ?? 2) * 1000 + span(n)]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  }

  // 配線ジェネレータ：1 ネットごとに進捗を yield する（アニメーション用）
  *routeMany(nets) {
    const list = this.order(nets), total = list.length;
    let i = 0;
    for (const n of list) { this.routeNet(n); yield { phase: 'route', i: ++i, total, net: n }; }
    // 失敗したネットは、邪魔な配線を引き剥がして再挑戦
    const tried = new Set();
    for (let round = 0; round < 3; round++) {
      const failed = list.filter(n => n.route && n.route.fails.length && !tried.has(n));
      if (!failed.length) break;
      for (const n of failed) {
        tried.add(n);
        const ripped = this.routeNet(n, true);
        yield { phase: 'ripup', i, total, net: n };
        for (const r of this.order([...ripped])) { this.routeNet(r); yield { phase: 'reroute', i, total, net: r }; }
      }
    }
  }
  routeAllSync(nets) { for (const _ of this.routeMany(nets || [...this.board.nets.values()])); }

  // 画面上の点にある配線のネット（表示中の層のうち手前優先）
  netAt(x, y, layers) {
    const ix = Math.round(x / G), iy = Math.round(y / G);
    if (!this.inGrid(ix, iy)) return null;
    for (const l of layers) { const o = this.occ[this.cell(l, ix, iy)]; if (o > 0) return this.board.netById[o]; }
    return null;
  }
  stats() {
    let total = 0, routed = 0, fails = 0, vias = 0, len = 0;
    for (const n of this.board.nets.values()) {
      if (n.cls === 'plane' || n.pins.length < 2) continue;
      total++;
      if (n.route) { if (!n.route.fails.length) routed++; fails += n.route.fails.length; vias += n.route.vias.length; len += n.route.len; }
      else fails += n.pins.length - 1;
    }
    return { total, routed, fails, vias, len };
  }
}
