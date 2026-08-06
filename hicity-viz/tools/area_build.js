/* 大田区全域 OSMレイヤー: 建物点群 / 道路 / 鉄道(実線形) / 水域 / 空港 / 区境界 / GSIタイル */
import * as THREE from 'three';

export function buildArea(A, W) {
  const layers = {};
  const mk = () => new THREE.Group();
  layers.bld = mk(); layers.roads = mk(); layers.osmrail = mk();
  layers.water = mk(); layers.aero = mk(); layers.boundary = mk(); layers.gsi = mk();

  const heightColor = h => {
    // navy → cyan → green → yellow (高さランプ)
    const stops = [[0, 0x20315e], [12, 0x2e7fb8], [30, 0x3ddc84], [60, 0xf5c400], [120, 0xff6b5e]];
    let c0 = stops[0], c1 = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++)
      if (h >= stops[i][0] && h <= stops[i + 1][0]) { c0 = stops[i]; c1 = stops[i + 1]; break; }
    const t = Math.min(1, Math.max(0, (h - c0[0]) / Math.max(1, c1[0] - c0[0])));
    return new THREE.Color(c0[1]).lerp(new THREE.Color(c1[1]), t);
  };

  /* ---- 建物点群 ---- */
  {
    const pos = [], col = [];
    const c = new THREE.Color();
    // far: oriented bbox perimeter points (roof ring + mid ring)
    const F = A.bldFar || [];
    for (let i = 0; i < F.length; i += 6) {
      const cx = F[i], cy = F[i + 1], w = F[i + 2], l = F[i + 3];
      const ang = F[i + 4] * Math.PI / 180, h = F[i + 5];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const per = 2 * (w + l);
      const step = per > 160 ? 7 : per > 90 ? 6 : 5;
      const n = Math.max(4, Math.floor(per / step));
      const midSlice = h >= 15;   // 高い建物のみ中間スライス
      c.copy(heightColor(h));
      for (let k = 0; k < n; k++) {
        let d = per * k / n, px, py;
        if (d < w) { px = -w / 2 + d; py = -l / 2; }
        else if (d < w + l) { px = w / 2; py = -l / 2 + (d - w); }
        else if (d < 2 * w + l) { px = w / 2 - (d - w - l); py = l / 2; }
        else { px = -w / 2; py = l / 2 - (d - 2 * w - l); }
        const x = cx + px * ca - py * sa, y = cy + px * sa + py * ca;
        pos.push(x, h, -y);
        col.push(c.r, c.g, c.b);
        if (midSlice) {
          pos.push(x, h * 0.5, -y);
          col.push(c.r * 0.55, c.g * 0.55, c.b * 0.55);
        }
      }
    }
    // near: full footprint rings, denser slices
    for (const b of (A.bldNear || [])) {
      const h = b[0];
      c.copy(heightColor(h));
      const zs = h > 20 ? [h, h * 0.66, h * 0.33] : [h, h * 0.5];
      for (let i = 1; i + 3 < b.length; i += 2) {
        const x1 = b[i], y1 = b[i + 1], x2 = b[i + 2], y2 = b[i + 3];
        const seg = Math.hypot(x2 - x1, y2 - y1);
        const n = Math.max(1, Math.floor(seg / 3));
        for (let k = 0; k < n; k++) {
          const x = x1 + (x2 - x1) * k / n, y = y1 + (y2 - y1) * k / n;
          for (const z of zs) {
            const f = z === h ? 1 : 0.55;
            pos.push(x, z, -y);
            col.push(c.r * f, c.g * f, c.b * f);
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6, vertexColors: true, transparent: true, opacity: 0.85,
      sizeAttenuation: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    layers.bld.add(pts);
    layers.bld.userData.count = pos.length / 3;
  }

  const addLines = (parent, ways, color, opacity, y = 0.4) => {
    const v = [];
    for (const wy of ways)
      for (let i = 0; i + 1 < wy.length; i++)
        v.push(wy[i][0], y, -wy[i][1], wy[i + 1][0], y, -wy[i + 1][1]);
    if (!v.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
    const ls = new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    ls.frustumCulled = false;
    parent.add(ls);
  };

  /* ---- 道路 ---- */
  const ribbon = (parent, ways, half, color, opacity, y) => {
    const vs = [], idx = [];
    let base = 0;
    for (const p of ways) {
      if (p.length < 2) continue;
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const nx = -dy, ny = dx;
        vs.push(p[i][0] + nx * half, y, -(p[i][1] + ny * half));
        vs.push(p[i][0] - nx * half, y, -(p[i][1] - ny * half));
        if (i > 0) { const k = base + 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
      base += 2 * p.length;
    }
    if (!vs.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vs), 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    m.frustumCulled = false;
    parent.add(m);
  };
  const [r0, r1, r2] = A.roads || [[], [], []];
  // 生活道路: ライン / 幹線: リボン+センターライン
  addLines(layers.roads, r2, 0x46527a, 0.5, 0.3);
  ribbon(layers.roads, r1, 5, 0x2e3a5c, 0.75, 0.45);
  addLines(layers.roads, r1, 0x7c8cb8, 0.5, 0.55);
  ribbon(layers.roads, r0, 8, 0x3a4a74, 0.9, 0.6);
  addLines(layers.roads, r0, 0xc8d4f4, 0.85, 0.75);

  /* ---- 鉄道(OSM実線形, 地表の下敷き) ---- */
  addLines(layers.osmrail, A.rail || [], 0xb8c4de, 0.4, 0.6);

  /* ---- 水域 ---- */
  {
    const matF = new THREE.MeshBasicMaterial({ color: 0x0e2a44, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    for (const ring of (A.waterFill || [])) {
      if (ring.length < 3) continue;
      const sh = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], -p[1])));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), matF);
      m.rotation.x = -Math.PI / 2; m.position.y = 0.15;
      layers.water.add(m);
    }
    addLines(layers.water, A.waterLine || [], 0x2e6a9e, 0.7, 0.25);
  }

  /* ---- 空港(滑走路リボン+誘導路+エプロン) ---- */
  {
    for (const rw of (A.runways || [])) {
      const p = rw.p; if (p.length < 2) continue;
      const half = (rw.w || 60) / 2;
      const vs = [], idx = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const nx = -dy, ny = dx;
        vs.push(p[i][0] + nx * half, 0.5, -(p[i][1] + ny * half));
        vs.push(p[i][0] - nx * half, 0.5, -(p[i][1] - ny * half));
        if (i > 0) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vs), 3));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2a3448, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      layers.aero.add(m);
      addLines(layers.aero, [p], 0xd8e4ff, 0.8, 0.9);
    }
    addLines(layers.aero, A.taxiways || [], 0x4a5a7a, 0.55, 0.6);
    const matA = new THREE.MeshBasicMaterial({ color: 0x1c2536, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    for (const ring of (A.aprons || [])) {
      if (ring.length < 3) continue;
      const sh = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], -p[1])));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), matA);
      m.rotation.x = -Math.PI / 2; m.position.y = 0.1;
      layers.aero.add(m);
    }
  }

  /* ---- 区境界 ---- */
  addLines(layers.boundary, A.boundary || [], 0x00e5ff, 0.55, 1.2);

  return layers;
}

/* GSI 航空写真タイル(オンライン時のみ; 読み込めたタイルだけ追加)
   opts: { toLocal(lon,lat)->[x,y], W(x,y,h)->Vector3, TH: 回転角rad, lonC, latC } */
export function buildGsiTiles(group, opts) {
  const { toLocal, W, TH, lonC, latC } = opts;
  const lon2tx = (lon, z) => (lon + 180) / 360 * 2 ** z;
  const lat2ty = (lat, z) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z;
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  for (const [Z, N, y0, dim] of [[14, 5, -0.5, 0x808aa0], [16, 4, -0.25, 0x9aa2b8]]) {
    const ctx = lon2tx(lonC, Z), cty = lat2ty(latC, Z);
    const mpt = 40075016.686 * Math.cos(latC * Math.PI / 180) / 2 ** Z;
    for (let dx = -N; dx <= N; dx++) for (let dy = -N; dy <= N; dy++) {
      const tx = Math.floor(ctx) + dx, ty = Math.floor(cty) + dy;
      const lon = (tx + 0.5) / 2 ** Z * 360 - 180;
      const n = Math.PI - 2 * Math.PI * (ty + 0.5) / 2 ** Z;
      const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      const [x, y] = toLocal(lon, lat);
      const url = `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${Z}/${tx}/${ty}.jpg`;
      loader.load(url, tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        const holder = new THREE.Group();
        holder.position.copy(W(x, y, y0));
        holder.rotation.y = TH;
        const pl = new THREE.Mesh(
          new THREE.PlaneGeometry(mpt, mpt),
          new THREE.MeshBasicMaterial({ map: tex, color: dim }));
        pl.rotation.x = -Math.PI / 2;
        holder.add(pl);
        group.add(holder);
      });
    }
  }
}
