
/* ================================================================
   等時線（アイソクロン）— アリーナからの到達圏
   道路グラフ上を Dijkstra で走らせ、リンクごとの走行速度から所要時間を積む。
   徒歩と車で速度モデルを分け、5/10/15/20/30分のバンドで色分けする。
   到達圏内の建物棟数から「圏内の受け皿（宿泊・飲食・駐車）」の規模も出す。
================================================================ */
const isoGroup = new THREE.Group(); isoGroup.visible = false; site.add(isoGroup);
/* データ範囲が半径3.3kmなので、車は短い刻みにしないとバンドが飽和する */
const ISO_BANDS = { drive: [3, 6, 9, 12, 15], walk: [5, 10, 15, 20, 30] };
const ISO = { mode: 'drive', bands: ISO_BANDS.drive, cost: null, mesh: null,
              stats: {}, built: false };
const ISO_COL = [0x00e5ff, 0x3ddc84, 0xfdb927, 0xff8a3d, 0xff5b4d, 0x2a3346];

/* リンク速度（m/分）— 試合日の混雑を織り込んだ実勢値 */
function linkSpeed(cls, mode) {
  if (mode === 'walk') return cls === 4 ? 0 : 80;          // 4.8 km/h・フリーウェイは不可
  return [200, 280, 330, 420, 900][cls];                   // 12 / 17 / 20 / 25 / 54 km/h
}

function computeIso(mode) {
  const N = roadGraph.nodes.length;
  const cost = new Float32Array(N).fill(Infinity);
  /* 起点は「アリーナの各ゲート」。単一点でなく入場口すべてを 0分 のシードにする */
  const seeds = [];
  for (const g of GATES) {
    const w = plazaToWorld(g.x, g.z);
    const n = roadGraph.nearest(w.x, w.z, mode === 'walk' ? 3 : null);
    if (n >= 0) seeds.push(n);
  }
  const c0 = roadGraph.nearest(ARENA_C.x, ARENA_C.z, mode === 'walk' ? 3 : null);
  if (c0 >= 0) seeds.push(c0);
  if (!seeds.length) return null;
  /* バケットキュー（分単位・0.25分刻み）で Dijkstra を回す */
  const STEP = 0.25, MAXB = Math.ceil(40 / STEP);
  const buckets = Array.from({ length: MAXB + 1 }, () => []);
  for (const n of seeds) { cost[n] = 0; buckets[0].push(n); }
  for (let b = 0; b <= MAXB; b++) {
    const q = buckets[b];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      if (cost[cur] < b * STEP - 1e-6) continue;
      const cn = roadGraph.nodes[cur];
      for (const nb of cn.adj) {
        const nn = roadGraph.nodes[nb];
        const v = linkSpeed(nn.cls, mode);
        if (!v) continue;
        const nc = cost[cur] + Math.hypot(nn.x - cn.x, nn.z - cn.z) / v;
        if (nc < cost[nb] && nc <= 40) {
          cost[nb] = nc;
          /* バケット番号は floor。round だと自分のコストより上のバケットに入り、
             そのバケットの陳腐化チェックで弾かれて展開が止まる。 */
          const bi = Math.min(MAXB, Math.floor(nc / STEP));
          buckets[bi].push(nb);
        }
      }
    }
    q.length = 0;
  }
  return cost;
}

const bandOf = t => {
  for (let i = 0; i < ISO.bands.length; i++) if (t <= ISO.bands[i]) return i;
  return ISO.bands.length;
};

function buildIso(mode) {
  ISO.mode = mode;
  ISO.bands = ISO_BANDS[mode] || ISO_BANDS.drive;
  ISO.cost = computeIso(mode);
  if (!ISO.cost) return;
  const P = [], C = [];
  const c = new THREE.Color();
  const nodes = roadGraph.nodes;
  const seen = new Set();
  for (let i = 0; i < nodes.length; i++) {
    if (!isFinite(ISO.cost[i])) continue;
    for (const j of nodes[i].adj) {
      if (!isFinite(ISO.cost[j])) continue;
      const k = i < j ? i * 1e7 + j : j * 1e7 + i;
      if (seen.has(k)) continue;
      seen.add(k);
      c.setHex(ISO_COL[bandOf(Math.max(ISO.cost[i], ISO.cost[j]))]);
      P.push(nodes[i].x, 2.2, nodes[i].z, nodes[j].x, 2.2, nodes[j].z);
      C.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  if (ISO.mesh) { isoGroup.remove(ISO.mesh); ISO.mesh.geometry.dispose(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  ISO.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  isoGroup.add(ISO.mesh);

  /* 到達圏の統計: バンド別のリンク延長と、圏内に含まれる建物棟数 */
  const km = new Float64Array(ISO.bands.length + 1);
  seen.clear();
  for (let i = 0; i < nodes.length; i++) {
    if (!isFinite(ISO.cost[i])) continue;
    for (const j of nodes[i].adj) {
      if (!isFinite(ISO.cost[j])) continue;
      const k = i < j ? i * 1e7 + j : j * 1e7 + i;
      if (seen.has(k)) continue;
      seen.add(k);
      km[bandOf(Math.max(ISO.cost[i], ISO.cost[j]))] +=
        Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) / 1000;
    }
  }
  /* 建物は最寄ノードの到達時間で代表させる（棟数 = 受け皿の規模の代理指標） */
  const bld = new Uint32Array(ISO.bands.length + 1);
  const all = SCENE_DATA.buildings.concat(SCENE_DATA.mid);
  for (const b of all) {
    const x = b.p[0][0], z = -b.p[0][1];
    if (Math.hypot(x - ARENA_C.x, z - ARENA_C.z) > 3200) continue;
    const n = roadGraph.nearest(x, z, null);
    if (n < 0 || !isFinite(ISO.cost[n])) { bld[ISO.bands.length]++; continue; }
    bld[bandOf(ISO.cost[n])]++;
  }
  ISO.stats = { km, bld, mode };
  ISO.built = true;
}
