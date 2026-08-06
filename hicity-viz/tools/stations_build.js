/* 駅構造(渋谷構内図スタイルの階層モデル)+ 路線3Dプロファイル + 新空港線(構想・赤) */
import * as THREE from 'three';
import { STATIONS, MINOR_STATIONS, RAIL_LINES } from './stations_data.js';

const FUTURE_RED = 0xff2d44;

export function buildStations(toLocal, W, labelSprite) {
  const group = new THREE.Group();          // 全駅構造
  const futureGroup = new THREE.Group();    // 新空港線(構想)
  const railGroup = new THREE.Group();      // 路線3Dライン
  const pickables = [];                     // raycast対象 {mesh, info}
  const flyTargets = {};                    // id -> {pos, name}

  const mkBoxLines = (w, l, h, color, opacity = 0.85) => {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, l));
    return new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: true }));
  };

  for (const st of STATIONS) {
    const [x, y] = toLocal(st.lon, st.lat);
    const sg = new THREE.Group();
    sg.position.copy(W(x, y, 0));
    flyTargets[st.id] = { pos: W(x, y, 0), name: st.name };

    for (const lv of st.levels) {
      const color = lv.future ? FUTURE_RED : lv.color;
      const brg = (lv.brg || 0) * Math.PI / 180;
      const lg = new THREE.Group();
      lg.position.set(lv.dx || 0, lv.z, -(lv.dy || 0));
      lg.rotation.y = -brg;

      // フロアプレート
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(lv.w, 0.5, lv.l),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: lv.future ? 0.30 : 0.16, depthWrite: false,
        }));
      lg.add(plate);
      const edge = mkBoxLines(lv.w, lv.l, 0.5, color, lv.future ? 1.0 : 0.8);
      lg.add(edge);

      if (lv.kind === 'platform') {
        const n = lv.tracks || 2;
        const span = lv.w * 0.9;
        for (let i = 0; i < n; i++) {
          const off = n === 1 ? 0 : -span / 2 + span * i / (n - 1);
          const tr = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.35, lv.l * 0.98),
            new THREE.MeshBasicMaterial({ color: lv.future ? FUTURE_RED : 0xd8e4ff, transparent: true, opacity: lv.future ? 0.9 : 0.55 }));
          tr.position.set(off, 0.55, 0);
          lg.add(tr);
        }
        // ホーム面(線路間の帯)
        const np = lv.platforms || 1;
        for (let i = 0; i < np; i++) {
          const off = np === 1 ? 0 : -lv.w / 4 + (lv.w / 2) * i / (np - 1);
          const pf = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(3, lv.w / (n + 1)), 1.1, lv.l * 0.92),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: lv.future ? 0.5 : 0.35 }));
          pf.position.set(off + (n > 1 ? (span / (n - 1)) / 2 * (np === 1 ? 0 : 1) : 0) * 0, 0.85, 0);
          if (np === 2) pf.position.x = (i === 0 ? -1 : 1) * span / 4;
          lg.add(pf);
        }
      }
      sg.add(lg);
      plate.userData.info = { station: st.name, level: lv.name, desc: st.desc, future: !!lv.future };
      pickables.push(plate);
    }

    // 垂直動線(階段/EVの柱)
    const zs = st.levels.map(l => l.z);
    const zmin = Math.min(...zs, 0), zmax = Math.max(...zs, 0);
    if (zmax - zmin > 3) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, zmax - zmin + 2, 10),
        new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.5 }));
      col.position.y = (zmin + zmax) / 2;
      sg.add(col);
      const col2 = col.clone(); col2.position.x = 14; sg.add(col2);
    }

    const sp = labelSprite(st.name + '駅', st.major ? '#ffffff' : '#9fb0c8', st.major ? 1.15 : 0.85);
    sp.position.y = Math.max(...zs) + 14;
    sg.add(sp);
    group.add(sg);
  }

  // 小駅: ミニホーム
  for (const [name, lon, lat, z, brg] of MINOR_STATIONS) {
    const [x, y] = toLocal(lon, lat);
    const sg = new THREE.Group();
    sg.position.copy(W(x, y, 0));
    const lg = new THREE.Group();
    lg.position.y = z; lg.rotation.y = -brg * Math.PI / 180;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 90),
      new THREE.MeshBasicMaterial({ color: 0x4a7aa8, transparent: true, opacity: 0.35 }));
    lg.add(plate);
    lg.add(mkBoxLines(14, 90, 0.8, 0x6d9cc8, 0.5));
    sg.add(lg);
    const sp = labelSprite(name, '#7d93b5', 0.62);
    sp.position.y = z + 9;
    sg.add(sp);
    group.add(sg);
  }

  // 路線3Dライン(高さプロファイル付き)
  for (const line of RAIL_LINES) {
    const pts = line.pts.map(([lon, lat, z]) => {
      const [x, y] = toLocal(lon, lat);
      return W(x, y, z);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const smooth = curve.getPoints(pts.length * 24);
    const geo = new THREE.BufferGeometry().setFromPoints(smooth);
    let mat;
    if (line.dashed) {
      mat = new THREE.LineDashedMaterial({ color: line.color, transparent: true, opacity: 0.95, dashSize: 14, gapSize: 10 });
    } else {
      mat = new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: line.future ? 1.0 : 0.85 });
    }
    const ln = new THREE.Line(geo, mat);
    if (line.dashed) ln.computeLineDistances();
    ln.userData.info = { station: line.name, level: line.desc || '', future: !!line.future };
    (line.future ? futureGroup : railGroup).add(ln);
    if (line.future) {
      // 発光の重ね描き
      const glow = new THREE.Line(geo.clone(),
        new THREE.LineBasicMaterial({ color: FUTURE_RED, transparent: true, opacity: 0.28 }));
      glow.scale.set(1, 1.02, 1);
      futureGroup.add(glow);
      const lbPos = smooth[Math.floor(smooth.length / 2)];
      const lb = labelSprite(line.name, '#ff6b7a', 0.95);
      lb.position.copy(lbPos).add(new THREE.Vector3(0, 22, 0));
      futureGroup.add(lb);
      // トンネル断面(整備案のオレンジ表現): 幅9m×高さ6.5mの矩形チューブ
      if (line.tunnel) {
        const w2 = 4.5, hUp = 2.8, hDn = 3.7;
        const vs = [], idx = [];
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < smooth.length; i++) {
          const p = smooth[i];
          const q = smooth[Math.min(i + 1, smooth.length - 1)];
          const tan = q.clone().sub(smooth[Math.max(0, i - 1)]).setY(0).normalize();
          const nrm = new THREE.Vector3().crossVectors(tan, up).normalize();
          const a = p.clone().addScaledVector(nrm, w2), b = p.clone().addScaledVector(nrm, -w2);
          vs.push(a.x, p.y + hUp, a.z,  b.x, p.y + hUp, b.z,
                  b.x, p.y - hDn, b.z,  a.x, p.y - hDn, a.z);
          if (i > 0) {
            const k = 4 * i, j = k - 4;
            for (const [s0, s1] of [[0, 1], [1, 2], [2, 3], [3, 0]])
              idx.push(j + s0, j + s1, k + s0, j + s1, k + s1, k + s0);
          }
        }
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vs), 3));
        tg.setIndex(idx);
        const tunnel = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({
          color: 0xff9a3d, transparent: true, opacity: line.dashed ? 0.10 : 0.16,
          side: THREE.DoubleSide, depthWrite: false,
        }));
        futureGroup.add(tunnel);
      }
      // 坑口(地下化区間の入口)マーカー
      if (line.portal) {
        const [px, py] = toLocal(line.portal.lon, line.portal.lat);
        const wedge = new THREE.Mesh(
          new THREE.ConeGeometry(6, 10, 4),
          new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 }));
        wedge.position.copy(W(px, py, 6));
        futureGroup.add(wedge);
        const pl = labelSprite(line.portal.label, '#ffd166', 0.7);
        pl.position.copy(W(px, py, 18));
        futureGroup.add(pl);
      }
    }
  }

  return { group, futureGroup, railGroup, pickables, flyTargets };
}
