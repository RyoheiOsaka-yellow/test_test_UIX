
/* ================================================================
   席視点カメラ（View from seat）
   その席の目線に立ち、コートの見え方・視距離・俯角・
   どの看板がどの等級で読めるかを実測して提示する。
   チケット商品の価値と、スポンサー媒体の価値を同じ画面で説明できる。
================================================================ */
const POV = { i: -1, on: false, fov: 0, hud: null };

(function povHud() {
  const d = document.createElement('div');
  d.id = 'pov-hud';
  d.style.display = 'none';
  document.body.appendChild(d);
  POV.hud = d;
})();

function seatEye(i) {
  const s = SEAT.list[i];
  /* 目線は座面から 1.12m。わずかにコート側へ寄せて前列の背もたれを避ける */
  const dir = new THREE.Vector3(-s.x, 0, -s.z).normalize();
  return { x: s.x + dir.x * 0.18, y: s.y + 1.12, z: s.z + dir.z * 0.18 };
}
function enterPOV(i) {
  if (level !== 'arena') setLevel('arena', false);
  POV.i = i; POV.on = true;
  const s = SEAT.list[i], e = seatEye(i);
  /* interior はワールドに対して回転・移動しているので、ローカル→ワールド変換する */
  const w = interior.localToWorld(new THREE.Vector3(e.x, e.y, e.z));
  const t = interior.localToWorld(new THREE.Vector3(0, 1.1, 0));
  cam.pov = { x: w.x, y: w.y, z: w.z, tx: t.x, ty: t.y, tz: t.z };
  if (!POV.fov) POV.fov = camera.fov;
  camera.fov = 58;                       // 人の有効視野に近づける
  camera.updateProjectionMatrix();
  applyCam(0);
  SEAT.mesh.visible = false;             // 自席の背もたれで視界を塞がない
  hideFanCard();
  renderPovHud(i);
  POV.hud.style.display = 'block';
  document.getElementById('panel').style.display = 'none';
}
function exitPOV() {
  POV.on = false; cam.pov = null;
  if (POV.fov) { camera.fov = POV.fov; camera.updateProjectionMatrix(); }
  SEAT.mesh.visible = !pcMode;
  POV.hud.style.display = 'none';
  document.getElementById('panel').style.display = 'flex';
  flyTo(ARENA_C.x, 12, ARENA_C.z, 168, cam.yaw, 0.78);
  applyCam(0);
}
function renderPovHud(i) {
  const s = SEAT.list[i], e = seatEye(i);
  const f = SNAP.sold[i] ? fanAt(i) : null;
  /* コート中心までの視距離と俯角 */
  const hor = Math.hypot(e.x, e.z);
  const dist = Math.hypot(hor, e.y - 1.1);
  const dep = Math.atan2(e.y - 1.1, hor) * 180 / Math.PI;
  /* 一番近いバスケットまでの距離（NBA構成のとき） */
  const hoop = Math.min(Math.hypot(e.x - 14.33, e.z), Math.hypot(e.x + 14.33, e.z));
  const grades = ['圏外', 'D 視認困難', 'C 判読可', 'B 良好', 'A 最良'];
  const N = SEAT.list.length;
  const boards = ledBoards.map((b, bi) => ({ b, g: SEAT.grade[bi * N + i],
      w: SEAT.expB[bi * N + i] / SEAT.maxB[bi] }))
    .filter(x => x.g > 0).sort((a, b) => b.w - a.w).slice(0, 6);
  const aCnt = boards.filter(x => x.g === 4).length;

  POV.hud.innerHTML =
    '<div class="pv-x" id="pv-x">✕ 視点を戻す</div>' +
    '<div class="pv-card">' +
      '<div class="pv-t">Sec ' + s.sec + ' · Row ' +
        (s.tier === 'FLOOR' ? ('ABCDEFGHJ'[s.row] || s.row + 1) : s.row + 1) +
        ' · Seat ' + s.num + '</div>' +
      '<div class="pv-s">' + CAT[s.cat].name + '　定価 ' + usd(CAT[s.cat].price) +
        '　推奨 <b>' + usd(s.rec || CAT[s.cat].price) + '</b></div>' +
      '<div class="pv-g">' +
        '<div><b>' + dist.toFixed(1) + '</b><span>m コート中心まで</span></div>' +
        '<div><b>' + hoop.toFixed(1) + '</b><span>m 最寄リングまで</span></div>' +
        '<div><b>' + dep.toFixed(1) + '°</b><span>俯角</span></div>' +
        '<div><b>' + (s.exp * 100).toFixed(0) + '</b><span>露出スコア</span></div>' +
      '</div>' +
      '<div class="pv-h">この席から読めるスポンサー媒体（' + aCnt + ' 面が A 等級）</div>' +
      boards.map(x =>
        '<div class="pv-b"><span>' + x.b.name + '</span>' +
        '<i style="background:' + hex(GRADE_C[x.g]) + '"></i>' +
        '<em>' + grades[x.g].split(' ')[0] + '</em></div>').join('') +
      (f ? '<div class="pv-h">この席の個客</div>' +
        '<div class="pv-f">' + f.fid + '　' + SEGMENTS[f.seg].name + '　' + f.reg.n +
        '<br>LTV ' + usd(f.ltv) + '　更新見込 ' + ((1 - f.churn) * 100).toFixed(0) + '%</div>'
        : '<div class="pv-h">空席</div>') +
      '<div class="pv-n">目線高 座面 +1.12m ／ 画角 58°。' +
      '視認等級は文字視角（文字高 ÷ 視距離 × 3437.75 arcmin）で判定しています。</div>' +
    '</div>';
  document.getElementById('pv-x').onclick = exitPOV;
}
/* POV中はマウスで見回せる（軌道カメラではなく視線方向を回す） */
addEventListener('pointermove', e => {
  if (!POV.on || !drag || !cam.pov) return;
  const P = cam.pov;
  const dx = e.movementX || 0, dy = e.movementY || 0;
  const v = new THREE.Vector3(P.tx - P.x, P.ty - P.y, P.tz - P.z);
  const r = v.length();
  let yaw = Math.atan2(v.x, v.z) - dx * 0.004;
  let pit = clamp(Math.asin(v.y / r) - dy * 0.003, -0.9, 0.7);
  P.tx = P.x + Math.sin(yaw) * Math.cos(pit) * r;
  P.ty = P.y + Math.sin(pit) * r;
  P.tz = P.z + Math.cos(yaw) * Math.cos(pit) * r;
  applyCam(0);
});
addEventListener('keydown', e => { if (e.key === 'Escape' && POV.on) exitPOV(); });
