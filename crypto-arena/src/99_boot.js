/* ================= 起動 & メインループ ================= */
setLoad(96, 'シーンを初期化中');
setViewMode('solid');
setCam(ARENA_C.x, 20, ARENA_C.z, 620, -0.55, 0.48);

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
setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 260);
window.__ready = true;
