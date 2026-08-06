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
        const n = lv.tracks || 2, np = lv.platforms || 1;
        const L = lv.l * 0.96;
        const span = lv.w * (np === 2 ? 0.5 : 0.86);
        const trackXs = [];
        for (let i = 0; i < n; i++) trackXs.push(n === 1 ? 0 : -span / 2 + span * i / (n - 1));
        // 線路: バラスト帯 + レール2条 + 枕木
        for (const tx of trackXs) {
          const ballast = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, L),
            new THREE.MeshBasicMaterial({ color: lv.future ? 0x5c1620 : 0x223048, transparent: true, opacity: 0.85 }));
          ballast.position.set(tx, 0.3, 0);
          lg.add(ballast);
        }
        const rv = [], sv = [];
        for (const tx of trackXs) {
          for (const o of [-0.75, 0.75]) rv.push(tx + o, 0.55, -L / 2, tx + o, 0.55, L / 2);
          for (let s = -L / 2 + 2; s < L / 2; s += 8) sv.push(tx - 1.1, 0.48, s, tx + 1.1, 0.48, s);
        }
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv), 3));
        lg.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({
          color: lv.future ? FUTURE_RED : 0xd8e4ff, transparent: true, opacity: lv.future ? 0.95 : 0.7 })));
        const sg2 = new THREE.BufferGeometry();
        sg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sv), 3));
        lg.add(new THREE.LineSegments(sg2, new THREE.LineBasicMaterial({
          color: lv.future ? 0x7a2530 : 0x3a4a68, transparent: true, opacity: 0.6 })));
        // ホーム面 + 縁の警戒ライン + 昇降設備
        const pw = Math.max(3.5, lv.w * (np === 1 ? 0.28 : 0.2));
        const pXs = np === 1 ? [0] : np === 2 ? [-(lv.w / 2 - pw / 2 - 0.5), lv.w / 2 - pw / 2 - 0.5]
                  : [-(lv.w / 2 - pw / 2 - 0.5), 0, lv.w / 2 - pw / 2 - 0.5];
        for (const px of pXs) {
          const pf = new THREE.Mesh(
            new THREE.BoxGeometry(pw, 1.1, L * 0.94),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: lv.future ? 0.5 : 0.35 }));
          pf.position.set(px, 0.85, 0);
          lg.add(pf);
          const ev = [];
          for (const o of [-pw / 2 + 0.5, pw / 2 - 0.5])
            ev.push(px + o, 1.5, -L * 0.46, px + o, 1.5, L * 0.46);
          const eg = new THREE.BufferGeometry();
          eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ev), 3));
          lg.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
            color: 0xffd94d, transparent: true, opacity: 0.85 })));
          // 階段(橙)×2 / エスカレーター(黄) / EV(緑)
          for (const zq of [-L / 4, L / 4]) {
            const stair = new THREE.Mesh(new THREE.BoxGeometry(Math.min(3, pw * 0.5), 2.4, 5),
              new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.75 }));
            stair.position.set(px, 2.2, -zq);
            lg.add(stair);
          }
          const esc = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2, pw * 0.35), 2.4, 6),
            new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.7 }));
          esc.position.set(px, 2.2, L / 8);
          lg.add(esc);
          const evtr = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.2, 10),
            new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.8 }));
          evtr.position.set(px, 2.6, -L / 12);
          lg.add(evtr);
          // ホーム上屋(キャノピー)+支柱列 (地上・高架ホームのみ)
          if (lv.z >= -1) {
            const canopy = new THREE.Mesh(new THREE.BoxGeometry(pw + 1.6, 0.25, L * 0.88),
              new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }));
            canopy.position.set(px, 4.6, 0);
            lg.add(canopy);
            const ce = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(pw + 1.6, 0.25, L * 0.88)),
              new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }));
            ce.position.copy(canopy.position);
            lg.add(ce);
            const colGeo = new THREE.CylinderGeometry(0.28, 0.28, 3.4, 6);
            const colMat = new THREE.MeshBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.55 });
            for (let s = -L * 0.4; s <= L * 0.4; s += 16) {
              const c1 = new THREE.Mesh(colGeo, colMat);
              c1.position.set(px, 2.8, s);
              lg.add(c1);
            }
            // ホームドア(縁の低い柵)
            for (const o of [-pw / 2 + 0.3, pw / 2 - 0.3]) {
              const pd = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, L * 0.9),
                new THREE.MeshBasicMaterial({ color: 0x88e8ff, transparent: true, opacity: 0.25 }));
              pd.position.set(px + o, 1.95, 0);
              lg.add(pd);
            }
          }
        }
      }
      if (lv.kind === 'concourse') {
        // 改札(白いゲート列)
        const ng = Math.max(4, Math.round(lv.w / 8));
        for (let i = 0; i < ng; i++) {
          const gate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 2.2),
            new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.85 }));
          gate.position.set(-lv.w / 2 + (i + 0.5) * (lv.w / ng), 1.2, 0);
          lg.add(gate);
        }
      }
      // レベル名ラベル(小)
      const lvLabel = labelSprite(lv.name.split(' — ')[0], lv.future ? '#ff6b7a' : '#9fd8ff', 0.55);
      lvLabel.position.set((lv.dx || 0) + lv.w / 2 + 10, lv.z + 3, -(lv.dy || 0) - lv.l / 2);
      sg.add(lvLabel);
      sg.add(lg);
      plate.userData.info = { station: st.name, level: lv.name, desc: st.desc, future: !!lv.future };
      plate.userData.flyPos = sg.position.clone().add(new THREE.Vector3(lv.dx || 0, lv.z, -(lv.dy || 0)));
      pickables.push(plate);
    }

    // 駅シェル(躯体ワイヤーフレーム, 主要駅のみ)
    if (st.major) {
      const zs0 = st.levels.map(l => l.z);
      const zmin0 = Math.min(...zs0, 0) - 3, zmax0 = Math.max(...zs0) + 6;
      const wMax = Math.max(...st.levels.map(l => l.w)) + 12;
      const lMax = Math.max(...st.levels.map(l => l.l)) + 12;
      const mainLv = st.levels.reduce((a, b) => (b.l > a.l ? b : a));
      const shell = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(wMax, zmax0 - zmin0, lMax)),
        new THREE.LineBasicMaterial({ color: 0x4a6a9a, transparent: true, opacity: 0.3 }));
      shell.position.y = (zmin0 + zmax0) / 2;
      shell.rotation.y = -(mainLv.brg || 0) * Math.PI / 180;
      sg.add(shell);
    }
    // 階間の階段接続(ジグザグ)
    {
      const sorted = [...st.levels].sort((a, b) => a.z - b.z);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const z1 = sorted[i].z, z2 = sorted[i + 1].z;
        if (z2 - z1 < 3) continue;
        for (const sgn of [1, -1]) {
          const pts = [
            new THREE.Vector3(sgn * 8, z1 + 0.6, 6),
            new THREE.Vector3(sgn * 12, (z1 + z2) / 2, 0),
            new THREE.Vector3(sgn * 8, z2 + 0.6, -6),
          ];
          const zig = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.7 }));
          sg.add(zig);
        }
      }
    }
    // 連絡通路(白破線, 整備案準拠)
    if (st.links) {
      for (const [x1, y1, z1, x2, y2, z2] of st.links) {
        const g2 = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, z1, -y1), new THREE.Vector3(x2, z2, -y2)]);
        const dl = new THREE.Line(g2, new THREE.LineDashedMaterial({
          color: 0xffffff, transparent: true, opacity: 0.75, dashSize: 3, gapSize: 2.4 }));
        dl.computeLineDistances();
        sg.add(dl);
        // 立坑(垂直区間のシャフト)
        if (Math.abs(z2 - z1) > 5 && Math.hypot(x2 - x1, y2 - y1) < 5) {
          const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(3, 3, Math.abs(z2 - z1), 12, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.10, side: THREE.DoubleSide }));
          shaft.position.set((x1 + x2) / 2, (z1 + z2) / 2, -(y1 + y2) / 2);
          sg.add(shaft);
        }
      }
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
    plate.userData.info = { station: name, level: (z > 2 ? '高架' : z < -2 ? '地下' : '地上') + 'ホーム(模式)', future: false };
    plate.userData.flyPos = sg.position.clone().add(new THREE.Vector3(0, z, 0));
    pickables.push(plate);
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

/* ============ 列車運行シミュレーション(運転間隔ダイヤ・目安) ============ */
const HEADWAY = {  // 時間帯別の運転間隔[分] (0=運行なし)。実ダイヤを参考にした目安
  'jr-keihin':      h => h < 5 ? 0 : h < 7 ? 6 : h < 9 ? 3.5 : h < 16 ? 5 : h < 20 ? 4 : h < 24 ? 7 : 0,
  'keikyu-main':    h => h < 5 ? 0 : h < 7 ? 8 : h < 9 ? 4 : h < 17 ? 7 : h < 20 ? 5 : h < 24 ? 9 : 0,
  'keikyu-airport': h => h < 5 ? 0 : h < 7 ? 9 : h < 9 ? 5 : h < 17 ? 8 : h < 20 ? 6 : h < 24 ? 10 : 0,
  'monorail':       h => h < 5 ? 0 : h < 7 ? 8 : h < 9 ? 4 : h < 18 ? 5.5 : h < 21 ? 5 : h < 24 ? 9 : 0,
  'tokyu-tamagawa': h => h < 5 ? 0 : h < 7 ? 9 : h < 9 ? 5 : h < 17 ? 7.5 : h < 20 ? 6 : h < 24 ? 10 : 0,
  'tokyu-ikegami':  h => h < 5 ? 0 : h < 7 ? 9 : h < 9 ? 5 : h < 17 ? 7.5 : h < 20 ? 6 : h < 24 ? 10 : 0,
  'rinkai':         h => h < 5 ? 0 : h < 7 ? 10 : h < 9 ? 5 : h < 17 ? 8 : h < 20 ? 6 : h < 24 ? 10 : 0,
  'asakusa':        h => h < 5 ? 0 : h < 7 ? 9 : h < 9 ? 4.5 : h < 17 ? 7 : h < 20 ? 5 : h < 24 ? 9 : 0,
  'shinkuko-1':     h => h < 5 ? 0 : h < 7 ? 10 : h < 9 ? 6 : h < 20 ? 8 : h < 24 ? 10 : 0,
  'shinkuko-2':     h => h < 5 ? 0 : h < 7 ? 10 : h < 9 ? 6 : h < 20 ? 8 : h < 24 ? 10 : 0,
};
export function buildTrains(toLocal, W) {
  const group = new THREE.Group();
  const sims = [];
  RAIL_LINES.forEach((line, li) => {
    const pts = line.pts.map(([lon, lat, z]) => { const [x, y] = toLocal(lon, lat); return W(x, y, z + 1.6); });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    const len = curve.getLength();
    const geo = new THREE.BoxGeometry(3.4, 3.4, 42);
    const mat = new THREE.MeshBasicMaterial({ color: line.color, transparent: true, opacity: line.future ? 0.95 : 0.85 });
    const CAP = 26;
    const im = new THREE.InstancedMesh(geo, mat, CAP);
    im.frustumCulled = false;
    im.userData.future = !!line.future;
    group.add(im);
    sims.push({ line, curve, len, im, CAP, phase: li * 47 });
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const Zaxis = new THREE.Vector3(0, 0, 1);
  function update(simT, showFuture) {
    for (const s of sims) {
      const hw = (HEADWAY[s.line.id] || (() => 8))(Math.floor(simT / 3600) % 24) * 60;
      const speed = (s.line.speed || 40) / 3.6;      // m/s
      const T = s.len / speed;
      let w = 0;
      if (hw > 0 && (!s.im.userData.future || showFuture)) {
        for (const dir of [0, 1]) {
          const ph = s.phase + dir * hw * 0.5;
          const k0 = Math.ceil((simT - ph - T) / hw), k1 = Math.floor((simT - ph) / hw);
          for (let k = k0; k <= k1 && w < s.CAP; k++) {
            const u = (simT - ph - k * hw) / T;
            if (u < 0 || u > 1) continue;
            const uu = dir ? 1 - u : u;
            const p = s.curve.getPointAt(uu);
            const tan = s.curve.getTangentAt(uu);
            if (dir) tan.negate();
            tan.y = 0; tan.normalize();
            q.setFromUnitVectors(Zaxis, tan);
            m4.compose(p, q, new THREE.Vector3(1, 1, 1));
            s.im.setMatrixAt(w++, m4);
          }
        }
      }
      s.im.count = w;
      s.im.instanceMatrix.needsUpdate = true;
    }
  }
  return { group, update };
}

/* ============ 駅勢圏 人流ヒート(乗降人員×時間帯・概算) ============ */
/* 乗降人員[人/日]: 京急2024年度公表値ほか、複合駅・他社局は概算 */
export const RIDERSHIP = [
  ['蒲田', 260000, 'commuter', 'JR+東急 概算'], ['京急蒲田', 61303, 'commuter', '京急 2024年度'],
  ['大森', 135000, 'commuter', 'JR 概算'], ['大井町', 370000, 'commuter', 'JR+りんかい+東急 概算'],
  ['天空橋', 8000, 'office', 'HICity開業後 概算'], ['穴守稲荷', 20698, 'commuter', '京急 2024年度'],
  ['大鳥居', 30660, 'commuter', '京急 2024年度'], ['糀谷', 26000, 'commuter', '概算'],
  ['羽田空港第3ターミナル', 56000, 'airport', '京急36,613+モノレール概算'],
  ['羽田空港第1・第2ターミナル', 150000, 'airport', '京急111,697+モノレール概算'],
  ['平和島', 30000, 'commuter', '概算'], ['大森町', 15000, 'commuter', '概算'],
  ['梅屋敷', 13000, 'commuter', '概算'], ['雑色', 29000, 'commuter', '概算'],
  ['六郷土手', 14000, 'commuter', '概算'], ['池上', 36000, 'commuter', '概算'],
  ['蓮沼', 9000, 'commuter', '概算'], ['矢口渡', 12000, 'commuter', '概算'],
  ['武蔵新田', 14000, 'commuter', '概算'], ['下丸子', 15000, 'commuter', '概算'],
  ['鵜の木', 8000, 'commuter', '概算'], ['久が原', 12000, 'commuter', '概算'],
  ['千鳥町', 9000, 'commuter', '概算'], ['御嶽山', 14000, 'commuter', '概算'],
  ['雪が谷大塚', 17000, 'commuter', '概算'], ['大森海岸', 6000, 'commuter', '概算'],
  ['立会川', 15000, 'commuter', '概算'], ['流通センター', 12000, 'office', '概算'],
  ['昭和島', 2500, 'office', '概算'], ['整備場', 2000, 'office', '概算'],
  ['新整備場', 4000, 'office', '概算'], ['西馬込', 26000, 'commuter', '概算'],
  ['馬込', 14000, 'commuter', '概算'],
];
// 時間帯係数(合計≈1になる正規化前の形状): 通勤=朝夕ピーク / 空港=日中フラット / 業務=日中
const PROFILE = {
  commuter: h => { const p = [.1,.05,.03,.03,.05,.3,1.2,2.6,2.2,1,.7,.7,.8,.7,.7,.8,1,1.6,2.2,1.8,1.2,.9,.6,.3]; return p[h] || 0; },
  airport:  h => { const p = [.3,.15,.1,.1,.3,.8,1.3,1.5,1.4,1.3,1.3,1.3,1.3,1.3,1.4,1.4,1.4,1.5,1.5,1.4,1.2,1,.8,.5]; return p[h] || 0; },
  office:   h => { const p = [.05,.03,.03,.03,.05,.2,.8,1.8,2.4,1.6,1,1,1.2,1,.9,.9,1,1.4,1.8,1.2,.7,.4,.2,.1]; return p[h] || 0; },
};
export function buildRidership(toLocal, W, nodes) {
  const group = new THREE.Group();
  const items = [];
  const ramp = t => {
    const a = new THREE.Color(0x123a66), b = new THREE.Color(0x00b7d9), c = new THREE.Color(0xffc94d), d = new THREE.Color(0xff6b5e);
    return t < 0.45 ? a.clone().lerp(b, t / 0.45) : t < 0.8 ? b.clone().lerp(c, (t - 0.45) / 0.35) : c.clone().lerp(d, Math.min(1, (t - 0.8) / 0.2));
  };
  for (const [name, R, prof, src] of RIDERSHIP) {
    const nd = nodes[name];
    if (!nd) continue;
    const radius = 90 + Math.sqrt(R) * 0.55;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.copy(W(nd.x, nd.y, 0.9));
    disc.userData.info = { station: name, level: `乗降 約${R.toLocaleString()}人/日(${src})`, future: false };
    group.add(disc);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1, 14),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8 }));
    bar.position.copy(W(nd.x + 34, nd.y + 20, 0));
    bar.userData.info = disc.userData.info;
    group.add(bar);
    items.push({ R, prof, disc, bar });
  }
  function update(simT) {
    const h = Math.floor(simT / 3600) % 24;
    const frac = (simT / 3600) % 1;
    for (const it of items) {
      const f = PROFILE[it.prof];
      const w = f(h) * (1 - frac) + f((h + 1) % 24) * frac;   // 時間内補間
      const inten = Math.min(1, (it.R / 370000) * 0.55 + 0.45 * (w / 2.6));
      const col = ramp(inten * Math.min(1, w / 1.4));
      it.disc.material.color = col;
      it.disc.material.opacity = 0.08 + 0.3 * Math.min(1, w / 2.6);
      const hgt = Math.max(1.5, it.R / 370000 * 160 * (0.25 + 0.75 * w / 2.6));
      it.bar.scale.y = hgt;
      it.bar.position.y = hgt / 2 + 0.5;
      it.bar.material.color = col;
    }
  }
  return { group, update, pickables: items.flatMap(i => [i.disc, i.bar]) };
}

/* ============ 経路検索(簡易・所要時間は目安) ============ */
export function buildRouteGraph(toLocal) {
  // ノード: 駅名 → ローカル座標
  const nodes = {};
  for (const st of STATIONS) { const [x, y] = toLocal(st.lon, st.lat); nodes[st.name] = { x, y, major: st.major }; }
  for (const [name, lon, lat] of MINOR_STATIONS) { const [x, y] = toLocal(lon, lat); nodes[name] = { x, y, major: false }; }
  // モノレール空港側端点を第1・第2ターミナル駅ノードへ吸着させる別名座標
  const ALIAS = [[139.7830, 35.5440, '羽田空港第1・第2ターミナル'], [139.7877, 35.5498, '羽田空港第1・第2ターミナル']];
  const lineGroupOf = id => id.startsWith('shinkuko') ? 'shinkuko' : id;
  const edges = [];
  for (const line of RAIL_LINES) {
    const pts = line.pts.map(([lon, lat, z]) => { const [x, y] = toLocal(lon, lat); return { x, y, z, lon, lat }; });
    let prevNode = null, prevIdx = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let hit = null, best = 130;
      for (const [name, nd] of Object.entries(nodes)) {
        const d = Math.hypot(nd.x - p.x, nd.y - p.y);
        if (d < best) { best = d; hit = name; }
      }
      if (!hit) for (const [alon, alat, name] of ALIAS)
        if (Math.abs(p.lon - alon) < 1e-4 && Math.abs(p.lat - alat) < 1e-4) hit = name;
      if (hit) {
        if (prevNode && hit !== prevNode) {
          let dist = 0;
          for (let k = prevIdx; k < i; k++)
            dist += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
          const seg = pts.slice(prevIdx, i + 1).map(q => [q.x, q.y, q.z]);
          edges.push({ a: prevNode, b: hit, line: line.id, lg: lineGroupOf(line.id),
                       name: line.name, future: !!line.future, dist, seg });
        }
        prevNode = hit; prevIdx = i;
      }
    }
  }
  // 徒歩連絡(900m以内の駅間、道のり係数1.3)
  const names = Object.keys(nodes);
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = nodes[names[i]], b = nodes[names[j]];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 900) {
        edges.push({ a: names[i], b: names[j], line: 'walk', lg: 'walk', name: '徒歩',
                     future: false, dist: d * 1.3,
                     seg: [[a.x, a.y, 1], [b.x, b.y, 1]] });
      }
    }
  const speeds = {}; for (const l of RAIL_LINES) speeds[l.id] = l.speed || 40;
  speeds.walk = 4.8;
  return { nodes, edges, speeds };
}

const TRANSFER_MIN = (g1, g2) => {
  if (g1 === null || g1 === g2) return 0;
  if (g1 === 'walk' || g2 === 'walk') return 1;             // 改札出入り
  const pair = [g1, g2].sort().join('|');
  if (pair === 'keikyu-airport|keikyu-main') return 1;      // 直通多数
  if (pair === 'shinkuko|tokyu-tamagawa') return 0;         // 直通前提(構想)
  if (pair === 'keikyu-airport|shinkuko') return 1;         // 第2期直通(構想)
  return 4;                                                 // 乗換
};

export function findRoute(graph, from, to, useFuture) {
  const adj = {};
  for (const e of graph.edges) {
    if (e.future && !useFuture) continue;
    (adj[e.a] ||= []).push({ ...e, to: e.b });
    (adj[e.b] ||= []).push({ ...e, to: e.a, seg: [...e.seg].reverse() });
  }
  const key = (n, g) => n + '|' + g;
  const distMap = { [key(from, 'null')]: 0 };
  const prev = {};
  const pq = [[0, from, 'null']];
  let goal = null;
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, n, g] = pq.shift();
    if (d > (distMap[key(n, g)] ?? 1e18)) continue;
    if (n === to) { goal = key(n, g); break; }
    for (const e of (adj[n] || [])) {
      const ride = e.dist / 1000 / (graph.speeds[e.line] || 40) * 60 + (e.line === 'walk' ? 0 : 0.8);
      const nd = d + TRANSFER_MIN(g === 'null' ? null : g, e.lg) + ride;
      const k2 = key(e.to, e.lg);
      if (nd < (distMap[k2] ?? 1e18)) {
        distMap[k2] = nd; prev[k2] = { from: key(n, g), edge: e };
        pq.push([nd, e.to, e.lg]);
      }
    }
  }
  if (!goal) return null;
  const path = [];
  let cur = goal;
  while (prev[cur]) { path.unshift(prev[cur].edge); cur = prev[cur].from; }
  const lines = [];
  for (const e of path) if (!lines.length || lines[lines.length - 1] !== e.name) lines.push(e.name);
  return { minutes: Math.round(distMap[goal]), edges: path, lines };
}
