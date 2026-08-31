/* ================= 起動 & メインループ ================= */
setLoad(94, '1to1 データを生成中');
buildSnapshot();
repaintSeats();
setLoad(97, 'シーンを初期化中');
/* 起動は点群から。スキャンが読み込まれるように点が立ち上がり、
   カメラが引きからアリーナへ寄っていく。 */
setViewMode('point');
setPointColorMode('class');
setFloorFormat(GAMES[curGame].fmt);
setLevel('site', false);
setCam(ARENA_C.x, 60, ARENA_C.z, 2600, -1.35, 0.62);
flyTo(ARENA_C.x, 20, ARENA_C.z, 780, -0.62, 0.40);
startReveal();
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
  for (const h of FRAME_HOOKS) h(dt, now);
  renderer.render(scene, camera);
}
applyCam(0);
requestAnimationFrame(loop);
setLoad(100, '準備完了');
toast('<b>Crypto.com Arena デジタルツイン</b> — 起動時は <b>点群</b>（' +
      fmt(siteStats.points) + '点・LAS分類）。左パネルで実体/線画/青焼きに切替、' +
      'アリーナをクリックで内部へ。座席クリックで<b>個客プロファイル</b>が開きます', 7000);
setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 260);
/* ヘッダのタブとタイムラインをアイコン化する */
(function iconifyChrome() {
  const L = { site: ['site', 'L0 サイト俯瞰 — DTLA実GIS'], plaza: ['plaza', 'L1 エントランス広場'],
              arena: ['bowl', 'L2 ボウル内部 — 19,079席'] };
  document.querySelectorAll('.crumb[data-lv]').forEach(c => {
    const k = L[c.dataset.lv];
    c.innerHTML = ic(k[0], 15) + '<span>' + c.textContent.trim() + '</span>';
    c.dataset.tip = k[1];
  });
  const a = document.getElementById('crumb-auto');
  a.innerHTML = ic('bolt', 15) + '<span>AUTOMATION</span>';
  a.dataset.tip = 'マーケティング・オートメーション コンソール';
  const p = document.getElementById('tl-play');
  p.innerHTML = ic('play', 15);
  p.dataset.tip = '再生 / 一時停止';
  const inf = document.getElementById('info-x');
  if (inf) inf.innerHTML = ic('close', 13);
  for (const id of ['m2-x', 'board-x', 'segb-x', 'jb-x', 'ap-x'])
    { const e = document.getElementById(id); if (e) { e.innerHTML = ic('close', 15); e.dataset.tip = '閉じる'; } }
})();

document.getElementById('crumb-auto').onclick = () => {
  if (AUTO.page) closeAuto(); else openAuto();
};
buildAutomation();
window.__ready = true;
