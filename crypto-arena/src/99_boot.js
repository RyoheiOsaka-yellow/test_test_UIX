/* ================= 起動 & メインループ ================= */
setLoad(94, '1to1 データを生成中');
buildSnapshot();
repaintSeats();
setLoad(97, 'シーンを初期化中');
setViewMode('solid');
setFloorFormat(GAMES[curGame].fmt);
setLevel('site', false);
onTick();

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (cam.fly) {
    applyCam(1 - Math.pow(0.001, dt));
    if (Math.abs(cam.dist - cam.tdist) < 1.2 && Math.abs(cam.yaw - cam.tyaw) < 0.01) cam.fly = 0;
  }
  if (timeState.play) {
    timeState.min += dt * timeState.speed;
    if (timeState.min > T1) timeState.min = T0;
    if (typeof onTick === 'function') onTick();
  }
  if (typeof frameHook === 'function') frameHook(dt, now);
  renderer.render(scene, camera);
}
applyCam(0);
requestAnimationFrame(loop);
setLoad(100, '準備完了');
toast('<b>Crypto.com Arena デジタルツイン</b> — L0で表示モードを切替、アリーナをクリックで L2 内部へ。' +
      '座席をクリックすると <b>個客プロファイル</b>が開きます', 6000);
setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 260);
window.__ready = true;
