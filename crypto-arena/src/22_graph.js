
/* ================================================================
   道路グラフ & 経路探索
   OSM の道路 11,856 セグメントから連結グラフを構築し A* で経路探索する。
   ノード数が大きい（DTLA全域）ため最近傍探索は空間ハッシュで O(1) 近傍に落とす。
   歩行者は歩道相当（class 0-3）、車両は全クラスを使う。
================================================================ */
const roadGraph = (function () {
  const CELL = 5;                                   // ノード量子化格子(m)
  const nodes = [];                                 // {x,z,adj:[idx], cls}
  const idx = new Map();                            // 量子化キー -> ノード番号
  const key = (x, z) => Math.round(x / CELL) + '_' + Math.round(z / CELL);

  function node(x, z, cls) {
    const k = key(x, z);
    let i = idx.get(k);
    if (i === undefined) { i = nodes.length; nodes.push({ x, z, adj: [], cls }); idx.set(k, i); }
    else if (cls > nodes[i].cls) nodes[i].cls = cls;
    return i;
  }
  const link = (a, b) => {
    if (a === b) return;
    if (nodes[a].adj.indexOf(b) < 0) nodes[a].adj.push(b);
    if (nodes[b].adj.indexOf(a) < 0) nodes[b].adj.push(a);
  };
  for (const r of SCENE_DATA.roads) {
    if (r.b === -1) continue;                       // トンネルは地表動線に含めない
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = node(r.p[i][0], -r.p[i][1], r.c);
      const b = node(r.p[i + 1][0], -r.p[i + 1][1], r.c);
      link(a, b);
    }
  }

  /* --- 連結成分ラベリング ---
     OSM には本線につながらない私有地内通路や独立スタブが混ざる。
     最大成分を「本線ネットワーク」として扱い、経路探索の起終点はそこへ吸着させる。 */
  const comp = new Int32Array(nodes.length).fill(-1);
  let nc = 0, best = -1, bestSize = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i]; comp[i] = nc;
    let size = 0;
    while (stack.length) {
      const cur = stack.pop(); size++;
      for (const nb of nodes[cur].adj) if (comp[nb] < 0) { comp[nb] = nc; stack.push(nb); }
    }
    if (size > bestSize) { bestSize = size; best = nc; }
    nc++;
  }
  const mainComp = best;

  /* --- 空間ハッシュ（最近傍ノード探索用・粗い格子） --- */
  const GCELL = 60, grid = new Map();
  const gkey = (x, z) => Math.floor(x / GCELL) + '_' + Math.floor(z / GCELL);
  nodes.forEach((n, i) => {
    const k = gkey(n.x, n.z);
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); }
    a.push(i);
  });
  function nearest(x, z, maxCls, anyComp) {
    let best = -1, bd = Infinity;
    for (let ring = 0; ring <= 9 && best < 0; ring++) {
      const cx = Math.floor(x / GCELL), cz = Math.floor(z / GCELL);
      for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) {
        if (ring > 0 && Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const a = grid.get((cx + i) + '_' + (cz + j)); if (!a) continue;
        for (const n of a) {
          if (maxCls != null && nodes[n].cls > maxCls) continue;
          if (!anyComp && comp[n] !== mainComp) continue;     // 孤立スタブへの吸着を防ぐ
          const d = (nodes[n].x - x) ** 2 + (nodes[n].z - z) ** 2;
          if (d < bd) { bd = d; best = n; }
        }
      }
    }
    return best;
  }

  /* --- A*（バイナリヒープ / 幹線ほど低コスト = 車両は幹線を選ぶ） --- */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (f, v) {
    const a = this.a; a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  };
  Heap.prototype.pop = function () {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  };

  function path(x0, z0, x1, z1, mode) {
    const walk = mode === 'walk';
    const s = nearest(x0, z0, walk ? 3 : null), g = nearest(x1, z1, walk ? 3 : null);
    if (s < 0 || g < 0) return null;
    const gp = nodes[g];
    const came = new Int32Array(nodes.length).fill(-1);
    const cost = new Float64Array(nodes.length).fill(Infinity);
    const done = new Uint8Array(nodes.length);
    cost[s] = 0;
    const open = new Heap(); open.push(0, s);
    let guard = 0, found = false;
    while (open.a.length && guard++ < 220000) {
      const cur = open.pop()[1];
      if (cur === g) { found = true; break; }
      if (done[cur]) continue;
      done[cur] = 1;
      const cn = nodes[cur];
      for (const nb of cn.adj) {
        const nn = nodes[nb];
        if (walk && nn.cls === 4) continue;          // 歩行者はフリーウェイを歩けない
        /* 車両は幹線が速い。歩行者は幹線にも歩道があるので等価に扱い、
           フリーウェイだけを除外する（先の cls===4 判定）。 */
        const w = walk ? 1.0 : (1.35 - nn.cls * 0.08);
        const nc = cost[cur] + Math.hypot(nn.x - cn.x, nn.z - cn.z) * w;
        if (nc < cost[nb]) {
          cost[nb] = nc; came[nb] = cur;
          open.push(nc + Math.hypot(nn.x - gp.x, nn.z - gp.z), nb);
        }
      }
    }
    if (!found) return null;
    const out = [];
    for (let cur = g; cur >= 0; cur = came[cur]) out.push([nodes[cur].x, nodes[cur].z]);
    out.reverse();
    return out;
  }
  return { path, nearest, nodes, comp, mainComp, size: nodes.length,
           mainSize: bestSize, comps: nc };
})();

/* 折れ線に距離テーブルを付ける（エージェントの距離→座標変換用） */
function measure(pts) {
  const seg = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(total);
  }
  return { path: pts, seg, total };
}
function atDist(route, d) {
  const { path: p, seg } = route;
  const t = clamp(d, 0, seg[seg.length - 1]);
  let lo = 0, hi = seg.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (seg[m] <= t) lo = m; else hi = m; }
  const k = (t - seg[lo]) / Math.max(1e-6, seg[lo + 1] - seg[lo]);
  return [p[lo][0] + (p[lo + 1][0] - p[lo][0]) * k, p[lo][1] + (p[lo + 1][1] - p[lo][1]) * k];
}
