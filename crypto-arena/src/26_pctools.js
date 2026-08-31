
/* ================================================================
   点群ツール — 断面（クリッピング）/ 計測 / 開示アニメーション
   実務の点群ビューアで最初に使う3つ。断面はシェーダの半空間カット、
   計測は点群へのレイキャストで2点間の実距離を出す。
================================================================ */
const pcTools = { measure: false, pts: [], line: null, marks: [], plane: null, label: null };

/* --- 断面プレーンの可視化（どこで切っているかを見せる） --- */
(function sectionPlane() {
  const g = new THREE.PlaneGeometry(5200, 900);
  const m = new THREE.MeshBasicMaterial({ color: 0x00c2ff, transparent: true,
    opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  pcTools.plane = new THREE.Mesh(g, m);
  pcTools.plane.visible = false;
  site.add(pcTools.plane);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(g),
    new THREE.LineBasicMaterial({ color: 0x00c2ff, transparent: true, opacity: 0.55 }));
  pcTools.plane.add(e);
})();
function updateSectionPlane() {
  const p = pcTools.plane;
  p.visible = (PCTOOL.clipAxis !== 'off' && viewMode === 'point');
  if (!p.visible) return;
  p.rotation.set(0, 0, 0);
  if (PCTOOL.clipAxis === 'x') {
    p.position.set(ARENA_C.x + PCTOOL.clipPos, 250, ARENA_C.z);
    p.rotation.y = Math.PI / 2;
  } else if (PCTOOL.clipAxis === 'z') {
    p.position.set(ARENA_C.x, 250, ARENA_C.z + PCTOOL.clipPos);
  } else {
    p.position.set(ARENA_C.x, PCTOOL.clipPos, ARENA_C.z);
    p.rotation.x = -Math.PI / 2;
  }
}

/* --- 計測: 点群にレイキャストして2点間距離を出す --- */
const measureRay = new THREE.Raycaster();
measureRay.params.Points.threshold = 7;
function measurePick(e) {
  const nd = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  measureRay.setFromCamera(nd, camera);
  const targets = [];
  gPoint.traverse(o => { if (o.isPoints) targets.push(o); });
  const hits = measureRay.intersectObjects(targets, false);
  if (!hits.length) return null;
  return hits[0].point.clone();
}
function measureAdd(p) {
  pcTools.pts.push(p);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfdb927 }));
  dot.position.copy(p); site.add(dot); pcTools.marks.push(dot);
  if (pcTools.pts.length === 2) {
    const [a, b] = pcTools.pts;
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    pcTools.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfdb927 }));
    site.add(pcTools.line); pcTools.marks.push(pcTools.line);
    const d = a.distanceTo(b);
    const dh = Math.hypot(b.x - a.x, b.z - a.z), dv = Math.abs(b.y - a.y);
    showInfo('📏 計測',
      '<b style="color:var(--gold);font-size:15px">' + d.toFixed(1) + ' m</b>（3D距離）<br>' +
      '水平 ' + dh.toFixed(1) + ' m / 高低差 ' + dv.toFixed(1) + ' m<br>' +
      '<span style="color:var(--sub)">徒歩 ' + (dh / 80).toFixed(1) + ' 分 相当（80m/分）</span><br>' +
      '<span style="color:var(--sub)">もう一度クリックで新しい計測を開始</span>');
    pcTools.pts = [];
  } else {
    measureClear(true);
    pcTools.pts = [p];
    const d2 = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfdb927 }));
    d2.position.copy(p); site.add(d2); pcTools.marks.push(d2);
    showInfo('📏 計測', '始点を取得しました。<b>2点目</b>をクリックしてください。');
  }
}
function measureClear(keepInfo) {
  for (const m of pcTools.marks) site.remove(m);
  pcTools.marks.length = 0; pcTools.pts.length = 0;
  if (!keepInfo) hideInfo();
}
function setMeasure(on) {
  pcTools.measure = on;
  if (!on) measureClear();
  else showInfo('📏 計測', '点群上を<b>2点クリック</b>すると実距離を表示します。');
  el.style.cursor = on ? 'crosshair' : '';
}

/* --- 開示アニメーション: スキャンが読み込まれるように点が増える --- */
const reveal = { on: false, t: 0, dur: 2.6 };
function startReveal() {
  reveal.on = true; reveal.t = 0;
  PCTOOL.reveal = 0; pcApply();
}
FRAME_HOOKS.push(function (dt) {
  if (reveal.on) {
    reveal.t += dt;
    PCTOOL.reveal = clamp(reveal.t / reveal.dur, 0, 1);
    pcApply();
    if (PCTOOL.reveal >= 1) reveal.on = false;
  }
  updateSectionPlane();
});
