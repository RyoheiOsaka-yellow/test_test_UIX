
/* ================================================================
   BIM 拡張 — 扉/ポータル・トイレ・照明バトン・スピーカー・通路手すり
   および BIM要素ブラウザ（種別で絞り込み、要素へ視点移動）
================================================================ */
setLoad(94, 'BIM部材を追加生成中');
(function extraBim() {
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a3346, metalness: 0.4, roughness: 0.5 });
  const spaceMat = new THREE.MeshStandardMaterial({ color: 0x1c3550, transparent: true,
    opacity: 0.34, side: THREE.DoubleSide });
  const rigMat = new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.7 });

  /* --- ボミトリー扉（客席ポータル） --- */
  VOMS.forEach((v, i) => {
    const ang = Math.atan2(v.x, v.z);
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 0.22), doorMat);
    d.position.set(v.x * 1.03, v.y - 1.2, v.z * 1.03);
    d.rotation.y = ang + Math.PI / 2;
    d.userData = { kind: 'bim', type: 'IfcDoor', tag: 'DR-' + v.label,
      attrs: { '部材種別': '客席ポータル扉（両開き・防音仕様）',
               '有効寸法': 'W 2,400 × H 2,300 mm', '遮音性能': 'Rw 42 dB',
               '接続': v.label + ' → 客席ブロック',
               '避難': '避難方向に開く（IBC 1010.1.2）' } };
    indoorSolid.add(d); BIM_ELEMS.push(d);
  });

  /* --- トイレ（IfcSpace として面積・器具数を持つ） --- */
  const c0 = CONC[0], c1 = CONC[1];
  [[c0, 8, '100'], [c1, 6, '300']].forEach(([c, n, lv]) => {
    for (let i = 0; i < n; i++) {
      const f = (i + 0.82) / n;
      const p = ringPt(c.a + 5.5, c.b + 5.5, fracToT(c.lut, f));
      const box = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6), spaceMat);
      box.position.set(p[0], c.y + 1.6, p[1]);
      box.rotation.y = Math.atan2(p[0], p[1]) + Math.PI / 2;
      const male = i % 2 === 0;
      box.userData = { kind: 'bim', type: 'IfcSpace', tag: 'WC-' + lv + String(i + 1).padStart(2, '0'),
        attrs: { '用途': male ? '便所（男子）' : '便所（女子）',
                 '床面積': '54 m²', '器具数': male ? '大便器6 / 小便器12 / 洗面6' : '大便器16 / 洗面8',
                 'レベル': lv + ' Level コンコース',
                 '算定根拠': 'IBC 2902 Table（観客席 19,079 に対する所要器具数）' } };
      indoorSolid.add(box); BIM_ELEMS.push(box);
    }
  });

  /* --- 照明バトン / スピーカーアレイ（キャットウォーク吊り） --- */
  const aR = TIER.L300.a + TIER.L300.rows * TIER.L300.tread + 14;
  const bR = TIER.L300.b + TIER.L300.rows * TIER.L300.tread + 14;
  for (let i = 0; i < 12; i++) {
    const t = 2 * Math.PI * i / 12;
    const p = ringPt(aR * 0.62, bR * 0.62, t);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(9, 0.42, 0.42), rigMat);
    bar.position.set(p[0], 32.2, p[1]);
    bar.rotation.y = Math.atan2(p[0], p[1]);
    bar.userData = { kind: 'bim', type: 'IfcFlowTerminal', tag: 'LX-' + (i + 1),
      attrs: { '部材種別': '照明バトン（ムービングライト 12台 / パーライト 8台）',
               '吊点': 'キャットウォーク R=' + Math.round(aR * 0.62) + ' m',
               '積載': '480 kg', '電源': '3φ200V 63A × 2回路',
               '用途': '興行演出・スポンサー演出（コンサート時は増設）' } };
    trussGrp.add(bar); BIM_ELEMS.push(bar);
    if (i % 2 === 0) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.4), rigMat);
      sp.position.set(p[0] * 1.12, 30.4, p[1] * 1.12);
      sp.rotation.y = Math.atan2(p[0], p[1]) + Math.PI / 2;
      sp.rotateX(0.42);
      sp.userData = { kind: 'bim', type: 'IfcAudioVisualAppliance', tag: 'SP-' + (i / 2 + 1),
        attrs: { '部材種別': 'ラインアレイスピーカー（8素子）',
                 '最大音圧': '138 dB SPL @1m', '指向角': '水平90° × 垂直10°',
                 'カバー範囲': '100/300 Level 客席', '吊り': 'キャットウォーク直吊り' } };
      trussGrp.add(sp); BIM_ELEMS.push(sp);
    }
  }

  /* --- 客席通路の手すり（ボミトリーごと） --- */
  const G = new Builder(), rc = [0.46, 0.50, 0.60];
  for (const v of VOMS) {
    const T = v.label[4] === '1' ? TIER.L100 : TIER.L300;
    const ang = Math.atan2(v.x, v.z);
    for (let r = 0; r < T.rows; r += 2) {
      const a = T.a + r * T.tread, b = T.b + r * T.tread;
      const y = T.y0 + r * T.rise;
      const p0 = ringPt(a, b, Math.atan2(v.z, v.x));
      const p1 = ringPt(a + T.tread * 2, b + T.tread * 2, Math.atan2(v.z, v.x));
      for (const s of [-0.62, 0.62]) {
        const nx = -Math.sin(ang) * s, nz = Math.cos(ang) * s;
        G.quad([p0[0] + nx, y + 0.1, p0[1] + nz], [p1[0] + nx, y + 2 * T.rise + 0.1, p1[1] + nz],
               [p1[0] + nx, y + 2 * T.rise + 1.0, p1[1] + nz], [p0[0] + nx, y + 1.0, p0[1] + nz], rc);
      }
    }
  }
  const rails = new THREE.Mesh(G.geom(), new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
  rails.userData = { kind: 'bim', type: 'IfcRailing', tag: 'RAIL-AISLE',
    attrs: { '部材種別': '通路中間手すり（SUS304 φ38.1）', '高さ': 'H=900 mm',
             '設置': '全ボミトリー通路の両側', '準拠': 'IBC 1030.16 Handrails' } };
  bimGroup.add(rails); BIM_ELEMS.push(rails);
})();

/* ---- BIM要素ブラウザ ---- */
const bimBrowse = { type: null, hl: null, savedMat: null };
function bimTypes() {
  const t = {};
  for (const e of BIM_ELEMS) {
    const k = e.userData.type;
    (t[k] = t[k] || []).push(e);
  }
  return t;
}
function bimIsolate(type) {
  bimBrowse.type = (bimBrowse.type === type) ? null : type;
  const T = bimTypes();
  for (const k in T) for (const e of T[k]) {
    e.userData.__dim = !!(bimBrowse.type && k !== bimBrowse.type);
    if (e.material && e.material.opacity !== undefined) {
      if (e.userData.__dim) {
        if (!e.userData.__o) e.userData.__o = [e.material.transparent, e.material.opacity];
        e.material.transparent = true; e.material.opacity = 0.08;
      } else if (e.userData.__o) {
        e.material.transparent = e.userData.__o[0];
        e.material.opacity = e.userData.__o[1];
        delete e.userData.__o;
      }
    }
  }
  renderPanel();
}
function bimFocus(e) {
  const b = new THREE.Box3().setFromObject(e);
  const c = b.getCenter(new THREE.Vector3());
  const w = interior.localToWorld(interior.worldToLocal(c.clone()));
  flyTo(w.x, w.y, w.z, Math.max(22, b.getSize(new THREE.Vector3()).length() * 3.2), cam.yaw, 0.42);
  showInfo(e.userData.type + ' — ' + e.userData.tag,
    Object.entries(e.userData.attrs).map(([k, v]) =>
      '<b style="color:var(--txt)">' + k + '</b>: ' + v).join('<br>'));
}
