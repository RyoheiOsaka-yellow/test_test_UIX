// グリッド A* 自動配線（4 配線層・45度配線・貫通ビア・引き剥がし再配線つき）
import { G, NL, padWorld, NET_WIDTH, CLEAR, VIA } from './core.js';

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
    this.viaNet = new Int32Array(this.plane);   // 各格子点のビアの持ち主
    this.thAt = new Uint8Array(this.plane);      // スルーホールパッドの中心
    this.viaKeep = new Int32Array(this.plane);  // 他ネットのパッドに近すぎてビアを打てない格子点（0=可, id=そのネットのみ可, -1=不可）
    this.pen = new Uint8Array(this.plane);      // 他ネットのパッド周辺を避けるためのコスト
    this.penOwner = new Int32Array(this.plane);
    this.gen = 0; this.viaCost = VIA_COST;
    this.rebuild();
  }
  cell(l, ix, iy) { return (l * this.ny + iy) * this.nx + ix; }
  inGrid(ix, iy) { return ix >= 0 && iy >= 0 && ix < this.nx && iy < this.ny; }

  // パッドと既存配線からグリッドを作り直す。パッドに潰された配線のネットを返す。
  // fixed: 0=配線可, 1=パッド本体, 2=パッド周囲のクリアランス域, 4=基板外・基板端
  rebuild() {
    const { occ, fixed, nx, ny, board, viaNet } = this;
    occ.fill(0); fixed.fill(0); viaNet.fill(0); this.thAt.fill(0); this.viaKeep.fill(0); this.pen.fill(0); this.penOwner.fill(0);
    const vk = this.viaKeep, vr = VIA.d / 2 + CLEAR + 0.001;
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      if (!board.inside(ix * G, iy * G, 0.75)) for (let l = 0; l < NL; l++) { const c = this.cell(l, ix, iy); occ[c] = -1; fixed[c] = 4; }
    }
    const halo = CLEAR + NET_WIDTH.signal / 2;
    for (const pass of [1, 2]) for (const c of board.comps) for (const pad of c.part.pads) {
      const p = padWorld(c, pad);
      const nm = c.padNet[pad.n], net = nm && board.nets.get(nm);
      const id = net ? net.id : -1, m = pass === 1 ? 0.1 : halo;
      const x0 = Math.ceil((p.x - p.w / 2 - m) / G - 1e-6), x1 = Math.floor((p.x + p.w / 2 + m) / G + 1e-6);
      const y0 = Math.ceil((p.y - p.h / 2 - m) / G - 1e-6), y1 = Math.floor((p.y + p.h / 2 + m) / G + 1e-6);
      const cx = Math.round(p.x / G), cy = Math.round(p.y / G);
      const l0 = p.th ? 0 : (c.side === 'B' ? NL - 1 : 0), l1 = p.th ? NL - 1 : l0;
      if (pass === 1 && p.th && this.inGrid(cx, cy)) this.thAt[cy * nx + cx] = 1;
      if (pass === 1) { // ビア禁止域：パッド外形から（ビア半径＋クリアランス）以内
        const bx0 = Math.ceil((p.x - p.w / 2 - vr) / G), bx1 = Math.floor((p.x + p.w / 2 + vr) / G), by0 = Math.ceil((p.y - p.h / 2 - vr) / G), by1 = Math.floor((p.y + p.h / 2 + vr) / G);
        for (let iy = by0; iy <= by1; iy++) for (let ix = bx0; ix <= bx1; ix++) {
          if (!this.inGrid(ix, iy)) continue;
          const dx = Math.abs(ix * G - p.x), dy = Math.abs(iy * G - p.y);
          const d = p.round ? Math.hypot(dx, dy) - p.w / 2 : Math.hypot(Math.max(0, dx - p.w / 2), Math.max(0, dy - p.h / 2));
          if (d >= vr) continue;
          const r = iy * nx + ix; vk[r] = vk[r] === 0 || vk[r] === id ? id : -1;
        }
      }
      if (pass === 1 && net && net.cls !== 'plane' && net.pins.length > 1) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { // 引き出し口をふさがせない
          const ix = cx + dx, iy = cy + dy; if (!this.inGrid(ix, iy)) continue;
          const far = Math.max(Math.abs(dx), Math.abs(dy)); if (far === 2 && p.round) continue;   // BGA は 1 マス分だけ
          const r = iy * nx + ix, v = far === 0 ? 9 : 3;
          if (v > this.pen[r]) { this.pen[r] = v; this.penOwner[r] = id; }
        }
      }
      for (let l = l0; l <= l1; l++) {
        for (let iy = Math.min(y0, cy); iy <= Math.max(y1, cy); iy++) for (let ix = Math.min(x0, cx); ix <= Math.max(x1, cx); ix++) {
          if (!this.inGrid(ix, iy)) continue;
          const k = this.cell(l, ix, iy);
          if (pass === 1) { occ[k] = id; fixed[k] = 1; }
          else if (fixed[k] === 1) continue;                       // 他パッドの本体
          else if (occ[k] === 0 || (fixed[k] === 4 && id !== -1)) { occ[k] = id; fixed[k] = 2; }
          else if (occ[k] !== id) { occ[k] = -1; if (!fixed[k]) fixed[k] = 2; }   // 2 つのネットのクリアランス域が重なる
        }
      }
    }
    const bad = new Set();
    for (const net of board.nets.values()) {
      if (!net.route) continue;
      for (const k of net.route.cells) {
        if (occ[k] && occ[k] !== net.id) bad.add(net);
        else occ[k] = net.id;
      }
      for (const v of net.route.vias) viaNet[Math.round(v.y / G) * nx + Math.round(v.x / G)] = net.id;
    }
    return bad;
  }

  ripNet(net) {
    if (!net.route) return;
    const { occ, fixed, viaNet, nx } = this;
    for (const k of net.route.cells) if (occ[k] === net.id && !fixed[k]) occ[k] = 0;
    for (const v of net.route.vias) { const r = Math.round(v.y / G) * nx + Math.round(v.x / G); if (viaNet[r] === net.id) viaNet[r] = 0; }
    net.route = null;
    if (this.log) this.log.push(net, null);
  }
  // ビアを打てるか（位置の条件）：他ネットのパッド・ビアから 0.2mm 以上離れ、角をかすめる斜め配線もないこと
  viaNear(id, r) {
    const { occ, viaNet, viaKeep, nx, ny, plane } = this, ix = r % nx, iy = (r / nx) | 0;
    if (viaKeep[r] !== 0 && viaKeep[r] !== id) return false;
    if (ix < 1 || iy < 1 || ix >= nx - 1 || iy >= ny - 1) return false;
    for (let d = 0; d < 4; d++) { const v = viaNet[r + DX[d] + DY[d] * nx]; if (v && v !== id) return false; }
    for (let m = 0; m < NL; m++) {
      const k = m * plane + r, e = occ[k + 1], w = occ[k - 1], s2 = occ[k + nx], n = occ[k - nx];
      const f = o => o > 0 && o !== id;
      if ((f(e) && (e === s2 || e === n)) || (f(w) && (w === s2 || w === n))) return false;
    }
    return true;
  }
  viaOk(id, r) {
    for (let m = 0; m < NL; m++) { const o = this.occ[m * this.plane + r]; if (o !== 0 && o !== id) return false; }
    return this.viaNear(id, r);
  }
  // 電源・GND ピンを内層プレーンへ落とすビア。パッド内に打てなければ隣の格子へ短く引き出す。
  connectPlanes() {
    const { occ, viaNet, nx, plane, board } = this;
    for (const net of board.nets.values()) {
      if (net.cls !== 'plane') continue;
      this.ripNet(net);
      const route = { cells: [], segs: [], vias: [], fails: [], len: 0, plane: true, smd: 0 };
      net.route = route; if (this.log) this.log.push(net, route);
      const id = net.id;
      const drop = r => { viaNet[r] = id; route.vias.push({ x: (r % nx) * G, y: ((r / nx) | 0) * G }); for (let m = 0; m < NL; m++) { occ[m * plane + r] = id; route.cells.push(m * plane + r); } };
      const par = new Map();
      net.pins.forEach((pin, i) => {
        const pad = pin.c.part.padMap[pin.p]; if (pad.th) return;
        route.smd++;
        const p = padWorld(pin.c, pad), ix = Math.round(p.x / G), iy = Math.round(p.y / G);
        if (!this.inGrid(ix, iy)) { route.fails.push(i); return; }
        const l = pin.c.side === 'B' ? NL - 1 : 0, r0 = iy * nx + ix, base = l * plane;
        // パッドの層を幅優先でたどり、ビアを打てる最寄りの格子点を探す（最大 12 歩）
        par.clear(); par.set(r0, -1);
        let front = [r0], hit = -1;
        for (let depth = 0; depth <= 12 && hit < 0 && front.length; depth++) {
          const next = [];
          for (const r of front) {
            if (viaNet[r] === id || (this.thAt[r] && occ[r] === id) || this.viaOk(id, r)) { hit = r; break; }
            const x = r % nx, y = (r / nx) | 0;
            for (let d = 0; d < 8; d++) {
              const jx = x + DX[d], jy = y + DY[d]; if (!this.inGrid(jx, jy)) continue;
              const rr = jy * nx + jx; if (par.has(rr)) continue;
              const o = occ[base + rr]; if (o !== 0 && o !== id) continue;
              if (d >= 4) { const a = occ[base + r + DX[d]], b = occ[base + r + DY[d] * nx]; if ((a !== 0 && a !== id) || (b !== 0 && b !== id)) continue; }
              par.set(rr, r); next.push(rr);
            }
          }
          front = next;
        }
        if (hit < 0) { route.fails.push(i); return; }
        if (viaNet[hit] !== id && !this.thAt[hit]) drop(hit);   // スルーホールはそれ自体がプレーンにつながる
        if (hit !== r0) {
          const pts = [];
          for (let r = hit; r !== -1; r = par.get(r)) { pts.push((r % nx) * G, ((r / nx) | 0) * G); occ[base + r] = id; route.cells.push(base + r); }
          route.segs.push({ l, pts });
        }
      });
    }
  }

  // keepManual: 手で引いた配線は残す
  ripAll(keepManual) { for (const n of this.board.nets.values()) if (!(keepManual && n.route && n.route.manual)) this.ripNet(n); }

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
  // noVia: 層を替えない（手配線用）。limit: 探索の打ち切り
  search(id, sources, targets, rip, noVia, limit) {
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
    const byId = this.board.netById;
    const pass = k => { const o = occ[k]; if (o === 0 || o === id) return 0; if (rip && o > 0 && !fixed[k] && !(byId[o] && byId[o].route && byId[o].route.manual)) return RIP_COST; return -1; };
    let found = -1, pops = 0;
    const LIMIT = limit || (rip ? 900000 : 600000);
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
      let ok = !noVia && this.viaNear(id, r), extra = 0;
      for (let m = 0; m < NL && ok; m++) { const pc = pass(m * plane + r); if (pc < 0) ok = false; else extra += pc; }
      if (ok) for (let m = 0; m < NL; m++) {
        if (m === l) continue;
        const k = m * plane + r, ng = gc + this.viaCost + extra;
        if (stamp[k] !== gen || ng < g[k]) { stamp[k] = gen; g[k] = ng; par[k] = cur; heap.push(ng + hfun(ix, iy), k); }
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let k = found; k !== -1; k = par[k]) path.push(k);
    return path;
  }

  // 1 ネットを配線する。戻り値: 引き剥がしたネットの集合
  // 探索で得た経路を配線として確定する（占有の書き込み、ビア、折れ線の組み立て）
  commitPath(net, route, path, tree) {
    const { occ, plane, nx } = this, id = net.id;
    let seg = null;
    for (let q = 0; q < path.length; q++) {
      const k = path[q], l = (k / plane) | 0, r = k - l * plane, x = (r % nx) * G, y = ((r / nx) | 0) * G;
      const prev = q ? path[q - 1] : -1;
      if (prev >= 0 && ((prev / plane) | 0) !== l) { // 層替え＝ビア
        route.vias.push({ x, y });
        for (let m = 0; m < NL; m++) { const kk = m * plane + r; occ[kk] = id; route.cells.push(kk); }
        this.viaNet[r] = id;
        seg = null;
      }
      occ[k] = id; route.cells.push(k); if (tree) tree.push(k);
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
  }
  // 2 ピンのネットを、内層の中継点を経由する遠回りの経路に引き直して target の長さに近づける。
  // 表層が混んでいて蛇行を入れられないときに使う。うまくいかなければ元に戻して false。
  detour(net, target) {
    if (net.pins.length !== 2) return false;
    const { occ, fixed, nx, plane } = this, id = net.id;
    const pc = net.pins.map(p => this.pinCells(p)), pos = net.pins.map(p => padWorld(p.c, p.c.part.padMap[p.p]));
    if (!pc[0].length || !pc[1].length) return false;
    const D = Math.hypot(pos[1].x - pos[0].x, pos[1].y - pos[0].y), need = target - 2 * 0.5;   // ビア前後のぶんを少し見込む
    if (need <= D + 1) return false;
    const off = Math.sqrt((need / 2) ** 2 - (D / 2) ** 2), mx = (pos[0].x + pos[1].x) / 2, my = (pos[0].y + pos[1].y) / 2;
    const ux = (pos[1].x - pos[0].x) / (D || 1), uy = (pos[1].y - pos[0].y) / (D || 1);
    const old = net.route;
    for (const scale of [1, 0.9, 0.8, 1.1, 0.7, 0.6]) for (const sgn of [1, -1]) for (const l of [1, 2]) for (const along of [0, 1.5, -1.5]) {
      const wx = Math.round((mx + ux * along - uy * off * scale * sgn) / G), wy = Math.round((my + uy * along + ux * off * scale * sgn) / G);
      if (!this.inGrid(wx, wy)) continue;
      const w = this.cell(l, wx, wy); if (occ[w] !== 0) continue;
      this.ripNet(net);
      const route = { cells: [], segs: [], vias: [], fails: [], len: 0 }; net.route = route;
      const leg1 = this.search(id, pc[0], [w], false, false, 120000);
      if (leg1) {
        this.commitPath(net, route, leg1);
        const hold = route.cells.filter(k => !fixed[k] && k !== w); for (const k of hold) occ[k] = -1;   // 2 本目が 1 本目をなぞらないよう一時的にふさぐ
        const leg2 = this.search(id, [w], pc[1], false, false, 120000);
        for (const k of hold) occ[k] = id;
        if (leg2) {
          this.commitPath(net, route, leg2); route.segs = route.segs.filter(q => q.pts.length >= 4);
          this.connectivity(net);
          if (!route.fails.length && route.len <= target + 0.6) { if (this.log) this.log.push(net, route); return true; }
        }
      }
    }
    // どの中継点でもだめなら、元の配線をそのまま戻す
    this.ripNet(net);
    if (old && old.cells.every(k => occ[k] === 0 || occ[k] === id)) { for (const k of old.cells) occ[k] = id; for (const v of old.vias) this.viaNet[Math.round(v.y / G) * nx + Math.round(v.x / G)] = id; net.route = old; if (this.log) this.log.push(net, old); }
    else this.routeNet(net);
    return false;
  }
  routeNet(net, rip = false) {
    this.ripNet(net);
    const { occ, fixed, plane, nx } = this, id = net.id;
    const route = { cells: [], segs: [], vias: [], fails: [], len: 0 };
    net.route = route; if (this.log) this.log.push(net, route);
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
      this.commitPath(net, route, path, tree);
      done.push(i);
    }
    route.segs = route.segs.filter(s => s.pts.length >= 4);
    return ripped;
  }

  // 等長グループ：メモリ 1 枚ぶんの信号、映像出力 1 ポートぶんのレーン
  static matchKey(net) {
    const m = /^(MEM\d+)_/.exec(net.name) || /^(DP\d+|HDMI)_ML/.exec(net.name);
    return m ? m[1] : null;
  }
  matchGroups() {
    const g = new Map();
    for (const n of this.board.nets.values()) { const k = Router.matchKey(n); if (k) { if (!g.has(k)) g.set(k, []); g.get(k).push(n); } }
    return g;
  }
  // 直線・斜めの区間にコの字の蛇行（ミアンダ）を挿入して target まで配線長を伸ばす
  lengthen(net, target) {
    const { occ, nx } = this, r = net.route, W = 2, id = net.id;
    const free = (l, x, y) => this.inGrid(x, y) && occ[this.cell(l, x, y)] === 0;
    const mine = (l, x, y) => { if (!this.inGrid(x, y)) return false; const o = occ[this.cell(l, x, y)]; return o === 0 || o === id; };
    // (x,y) から (dx,dy) へ 1 歩進めるか。斜めは両脇に他ネットがないこと。
    const step = (l, x, y, dx, dy) => free(l, x + dx, y + dy) && (!dx || !dy || (mine(l, x + dx, y) && mine(l, x, y + dy)));
    for (let guard = 0; guard < 80; guard++) {
      const rem = target - r.len;
      if (rem < 0.6) break;
      let best = null;
      for (const seg of r.segs) {
        const p = seg.pts, l = seg.l;
        for (let i = 0; i + 3 < p.length; i += 2) {
          const ax = Math.round(p[i] / G), ay = Math.round(p[i + 1] / G), bx = Math.round(p[i + 2] / G), by = Math.round(p[i + 3] / G);
          const ddx = bx - ax, ddy = by - ay;
          if (ddx && ddy && Math.abs(ddx) !== Math.abs(ddy)) continue;
          const n = Math.max(Math.abs(ddx), Math.abs(ddy)); if (n < W + 2) continue;
          const ux = Math.sign(ddx), uy = Math.sign(ddy), sl = G * Math.hypot(ux, uy);
          const cap = Math.min(10, Math.floor((rem + 0.25) / (2 * sl))); if (cap < 1) continue;
          for (const sd of [1, -1]) {
            const vx = -uy * sd, vy = ux * sd;
            for (let s2 = 1; s2 + W <= n - 1; s2++) {
              let h = 0;
              for (; h < cap; h++) {
                const k = h + 1; let ok = true;
                for (const t of [s2, s2 + W]) { const x = ax + ux * t + vx * h, y = ay + uy * t + vy * h; if (!step(l, x, y, vx, vy)) ok = false; }
                for (let t = s2; t < s2 + W && ok; t++) { // 折り返し部分（高さ k の行）
                  const x = ax + ux * t + vx * k, y = ay + uy * t + vy * k;
                  if (t > s2 && !free(l, x, y)) ok = false;
                  if (ux && uy && !(mine(l, x + ux, y) && mine(l, x, y + uy))) ok = false;
                }
                if (!ok) break;
              }
              if (h > 0 && (!best || h * sl > best.h * best.sl)) best = { seg, i, ax, ay, ux, uy, vx, vy, s: s2, h, sl };
            }
          }
        }
      }
      if (!best) break;
      const { seg, i, ax, ay, ux, uy, vx, vy, s: s0, h, sl } = best;
      const pt = (t, k) => [(ax + ux * t + vx * k) * G, (ay + uy * t + vy * k) * G];
      seg.pts.splice(i + 2, 0, ...pt(s0, 0), ...pt(s0, h), ...pt(s0 + W, h), ...pt(s0 + W, 0));
      for (let k = 1; k <= h; k++) for (const t of [s0, s0 + W]) { const c = this.cell(seg.l, ax + ux * t + vx * k, ay + uy * t + vy * k); occ[c] = id; r.cells.push(c); }
      for (let t = s0; t <= s0 + W; t++) { const c = this.cell(seg.l, ax + ux * t + vx * h, ay + uy * t + vy * h); occ[c] = id; r.cells.push(c); }
      r.len += 2 * h * sl; r.tuned = (r.tuned || 0) + 1;
    }
  }
  tuneGroup(nets) {
    const ok = nets.filter(n => n.route && !n.route.fails.length && n.route.segs.length);
    if (ok.length < 2) return;
    const target = Math.max(...ok.map(n => n.route.len));
    for (const n of ok) if (n.route.len < target - 0.5) this.lengthen(n, target);
    // 蛇行を入れきれなかったネットは、内層へ遠回りさせてから仕上げる
    for (const n of ok) if (n.route.len < target - 1 && this.detour(n, target)) this.lengthen(n, target);
  }
  matchStats() {
    let groups = 0, good = 0, worst = 0;
    for (const nets of this.matchGroups().values()) {
      const ok = nets.filter(n => n.route && !n.route.fails.length && n.route.segs.length);
      if (ok.length < 2) continue;
      const L = ok.map(n => n.route.len), d = Math.max(...L) - Math.min(...L);
      groups++; if (d <= 1.0 && ok.length === nets.length) good++; worst = Math.max(worst, d);
    }
    return { groups, good, worst };
  }

  // 配線順：スイッチノード → 差動 → 信号（短い順）→ 多ピンのバイアス電源
  order(nets) {
    const pr = { power: 0, diff: 1, signal: 2 };
    const span = n => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of n.pins) { const q = padWorld(p.c, p.c.part.padMap[p.p]); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      return (x1 - x0) + (y1 - y0);
    };
    return nets.filter(n => n.cls !== 'plane' && n.pins.length > 1)
      .map(n => [n, (n.cls === 'power' && n.pins.length > 2 ? 3 : pr[n.cls] ?? 2) * 1000 + span(n)]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  }

  // 配線ジェネレータ：1 ネットごとに進捗を yield する（アニメーション用）
  *routeMany(nets) {
    // 等長グループの一員を配線し直すときは、グループ全体をやり直す
    const groups = this.matchGroups(), touched = new Set(), all = new Set(nets);
    for (const n of nets) { const k = Router.matchKey(n); if (k) { touched.add(k); for (const m of groups.get(k)) all.add(m); } }
    for (const n of this.board.nets.values()) if (n.cls === 'plane') this.ripNet(n);
    const list = this.order([...all].filter(n => !(n.route && n.route.manual))), total = list.length;   // 手配線は引き直さない
    let i = 0;
    for (const n of list) { this.routeNet(n); yield { phase: 'route', i: ++i, total, net: n }; }
    // 失敗したネットは、邪魔な配線を引き剥がして再挑戦
    const tried = new Map(), pool = new Set(list);   // pool: 今回触ったネット（引き剥がされて引き直したものも含む）
    for (let round = 0; round < 5; round++) {
      const failed = [...pool].filter(n => n.route && n.route.fails.length && (tried.get(n) || 0) < 2);
      if (!failed.length) break;
      for (const n of failed) {
        tried.set(n, (tried.get(n) || 0) + 1);
        const ripped = this.routeNet(n, true);
        yield { phase: 'ripup', i, total, net: n };
        for (const r of this.order([...ripped])) { this.routeNet(r); pool.add(r); yield { phase: 'reroute', i, total, net: r }; const k = Router.matchKey(r); if (k) touched.add(k); }
      }
    }
    // それでも残ったネットは、ピンの周囲 5mm にある配線をまとめて剥がし、先に通してから周りを引き直す
    for (let pass2 = 0; pass2 < 2; pass2++) for (const n of [...pool].filter(q => q.route && q.route.fails.length)) {
      const around = new Set(), { occ, nx, plane } = this;
      for (const pin of n.pins) {
        const p = padWorld(pin.c, pin.c.part.padMap[pin.p]), cx = Math.round(p.x / G), cy = Math.round(p.y / G);
        for (let m = 0; m < NL; m++) for (let y = cy - 10; y <= cy + 10; y++) for (let x = cx - 10; x <= cx + 10; x++) {
          if (!this.inGrid(x, y)) continue;
          const o = occ[m * plane + y * nx + x]; if (o <= 0 || o === n.id) continue;
          const a = this.board.netById[o]; if (a && a.cls !== 'plane' && a.route && !a.route.manual) around.add(a);
        }
      }
      for (const a of around) this.ripNet(a);
      this.routeNet(n); yield { phase: 'ripup', i, total, net: n };
      for (const a of this.order([...around])) {
        this.routeNet(a); pool.add(a);
        if (a.route.fails.length) for (const r of this.order([...this.routeNet(a, true)])) { this.routeNet(r); pool.add(r); }
        yield { phase: 'reroute', i, total, net: a };
        const k = Router.matchKey(a); if (k) touched.add(k);
      }
    }
    // 等長化（短い配線を最長に合わせる）。合わせきれないグループは、遠回りしている配線を
    // 引き剥がし優先で引き直してから、もう一度だけ試す。
    const queue = this.tune === false ? [] : [...touched], fixed2 = new Set();
    const spread = k => { const L = groups.get(k).filter(n => n.route && !n.route.fails.length && n.route.segs.length).map(n => n.route.len); return L.length > 1 ? Math.max(...L) - Math.min(...L) : 0; };
    const retune = k => { for (const n of groups.get(k)) if (n.route && n.route.tuned) this.routeNet(n); this.tuneGroup(groups.get(k)); };
    while (queue.length) {
      const k = queue.shift();
      retune(k);
      if (spread(k) > 1 && !fixed2.has(k)) {
        fixed2.add(k);
        for (const n of groups.get(k)) if (n.route && n.route.tuned) this.routeNet(n);
        const L = groups.get(k).map(n => n.route.len).sort((a, b) => a - b), med = L[L.length >> 1];
        for (const o of groups.get(k).filter(n => n.route.len > med * 1.3 + 1.5)) {
          this.viaCost = 2;                       // 迂回よりビアを選ばせる
          const rip = this.routeNet(o, true); this.viaCost = VIA_COST;
          for (const r of this.order([...rip])) {
            this.routeNet(r);
            const k2 = Router.matchKey(r); if (k2 && k2 !== k && !queue.includes(k2)) queue.push(k2);
          }
        }
        this.tuneGroup(groups.get(k));
      }
      yield { phase: 'tune', i, total, net: groups.get(k)[0], key: k };
    }
    this.connectPlanes();
    yield { phase: 'plane', i, total, net: list[0] || { name: '' }, key: '電源・GND ピンをプレーンへ接続' };
  }
  // ───── 手配線 ─────
  // ネットの導通を調べ、つながっていないピンを route.fails に入れる
  connectivity(net) {
    const { occ, fixed, viaNet, thAt, nx, ny, plane } = this, id = net.id, r = net.route;
    if (!r) return;
    const own = new Set(r.cells), seen = new Set(), stack = [];
    const ok = k => own.has(k) || (fixed[k] === 1 && occ[k] === id);
    const pc = net.pins.map(p => this.pinCells(p));
    for (const k of pc[0] || []) { seen.add(k); stack.push(k); }
    while (stack.length) {
      const k = stack.pop(), l = (k / plane) | 0, q = k - l * plane, x = q % nx, y = (q / nx) | 0;
      for (let d = 0; d < 8; d++) { const jx = x + DX[d], jy = y + DY[d]; if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue; const kk = k + DX[d] + DY[d] * nx; if (!seen.has(kk) && ok(kk)) { seen.add(kk); stack.push(kk); } }
      if (viaNet[q] === id || (thAt[q] && occ[k] === id)) for (let m = 0; m < NL; m++) { const kk = m * plane + q; if (!seen.has(kk)) { seen.add(kk); stack.push(kk); } }
    }
    r.fails = []; pc.forEach((cs, i) => { if (i && !cs.some(k => seen.has(k))) r.fails.push(i); });
  }
  // 手配線を始める：既存の自動配線は消し、手配線の入れ物を用意する
  manualBegin(net) {
    if (!net.route || !net.route.manual) { this.ripNet(net); net.route = { cells: [], segs: [], vias: [], fails: [], len: 0, manual: true }; if (this.log) this.log.push(net, net.route); }
    this.connectivity(net);
    return net.route;
  }
  // 現在の層だけで (ax,ay) から (bx,by) への経路（格子座標）。なければ null
  manualPath(net, l, ax, ay, bx, by, limit = 60000) {
    if (!this.inGrid(ax, ay) || !this.inGrid(bx, by)) return null;
    const path = this.search(net.id, [this.cell(l, ax, ay)], [this.cell(l, bx, by)], false, true, limit);
    return path ? path.reverse() : null;
  }
  manualAdd(net, path) {
    const { occ, plane, nx } = this, r = net.route, l = (path[0] / plane) | 0, pts = [];
    for (const k of path) {
      const q = k - l * plane, x = (q % nx) * G, y = ((q / nx) | 0) * G, n = pts.length;
      occ[k] = net.id; r.cells.push(k);
      if (n >= 2) r.len += Math.hypot(x - pts[n - 2], y - pts[n - 1]);
      if (n >= 4) { const ax = pts[n - 2] - pts[n - 4], ay = pts[n - 1] - pts[n - 3], bx = x - pts[n - 2], by = y - pts[n - 1]; if (Math.abs(ax * by - ay * bx) < 1e-9 && ax * bx + ay * by > 0) { pts[n - 2] = x; pts[n - 1] = y; continue; } }
      pts.push(x, y);
    }
    if (pts.length >= 4) r.segs.push({ l, pts });
    this.connectivity(net);
  }
  manualVia(net, ix, iy) {
    const q = iy * this.nx + ix;
    if (this.viaNet[q] === net.id) return true;
    if (!this.viaOk(net.id, q)) return false;
    this.viaNet[q] = net.id; net.route.vias.push({ x: ix * G, y: iy * G });
    for (let m = 0; m < NL; m++) { this.occ[m * this.plane + q] = net.id; net.route.cells.push(m * this.plane + q); }
    return true;
  }
  // 手配線の segs / vias から格子の占有を作り直す。通れない場合は false
  stampManual(net, r, check) {
    const cells = []; let clash = false, len = 0;
    const put = k => { if (this.occ[k] !== 0 && this.occ[k] !== net.id) clash = true; cells.push(k); };
    for (const q of r.segs) for (let i = 0; i + 3 < q.pts.length; i += 2) {
      let x = Math.round(q.pts[i] / G), y = Math.round(q.pts[i + 1] / G); const bx = Math.round(q.pts[i + 2] / G), by = Math.round(q.pts[i + 3] / G);
      len += Math.hypot(q.pts[i + 2] - q.pts[i], q.pts[i + 3] - q.pts[i + 1]);
      for (let g = 0; g < 4000; g++) { if (this.inGrid(x, y)) put(this.cell(q.l, x, y)); if (x === bx && y === by) break; x += Math.sign(bx - x); y += Math.sign(by - y); }
    }
    for (const v of r.vias) { const q = Math.round(v.y / G) * this.nx + Math.round(v.x / G); for (let m = 0; m < NL; m++) put(m * this.plane + q); }
    if (check && clash) return false;
    for (const k of cells) this.occ[k] = net.id;
    for (const v of r.vias) this.viaNet[Math.round(v.y / G) * this.nx + Math.round(v.x / G)] = net.id;
    r.cells = cells; r.len = len;
    return true;
  }
  // 手配線の一部を消した・一手戻したあとに呼ぶ
  manualRebuild(net) {
    const r = net.route, { occ, fixed, viaNet, nx, plane } = this;
    for (const k of r.cells) { if (occ[k] === net.id && !fixed[k]) occ[k] = 0; const q = k % plane; if (viaNet[q] === net.id) viaNet[q] = 0; }
    // どの線にもつながらなくなったビアは外す
    const ends = new Set(); for (const q of r.segs) for (let i = 0; i < q.pts.length; i += 2) ends.add(q.pts[i] + ',' + q.pts[i + 1]);
    r.vias = r.vias.filter(v => ends.has(v.x + ',' + v.y));
    this.stampManual(net, r, false); this.connectivity(net);
  }
  // 点 (x,y) の近くにある手配線の線分
  manualSegAt(x, y, layers) {
    let best = null, bd = 0.45;
    for (const net of this.board.nets.values()) {
      if (!net.route || !net.route.manual) continue;
      net.route.segs.forEach((q, si) => {
        if (!layers.includes(q.l)) return;
        for (let i = 0; i + 3 < q.pts.length; i += 2) {
          const ax = q.pts[i], ay = q.pts[i + 1], bx = q.pts[i + 2], by = q.pts[i + 3], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)), d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
          if (d < bd) { bd = d; best = { net, si, l: q.l, x: Math.round((ax + dx * t) / G) * G, y: Math.round((ay + dy * t) / G) * G }; }
        }
      });
    }
    return best;
  }
  // 保存しておいた手配線を戻す
  restoreManual(list) {
    for (const d of list || []) {
      const net = this.board.nets.get(d.net); if (!net) continue;
      const r = { cells: [], segs: d.segs.map(q => ({ l: q.l, pts: [...q.pts] })), vias: d.vias.map(v => ({ ...v })), fails: [], len: 0, manual: true };
      if (!this.stampManual(net, r, true)) continue;          // 部品が動いて通れなくなった手配線は捨てる
      net.route = r; this.connectivity(net);
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
    let pPins = 0, pFail = 0, pVias = 0;
    for (const n of this.board.nets.values()) if (n.cls === 'plane' && n.route) { pPins += n.route.smd; pFail += n.route.fails.length; pVias += n.route.vias.length; }
    return { total, routed, fails, vias, len, pPins, pFail, pVias };
  }
}
