
/* ================================================================
   レベル管理 (L0 サイト / L1 エントランス広場 / L2 ボウル内部) と
   マウス操作 / ピッキング
================================================================ */
let level = 'site';
const crumbs = [...document.querySelectorAll('.crumb')];

function setLevel(lv, fly) {
  level = lv;
  crumbs.forEach(c => c.classList.toggle('active', c.dataset.lv === lv));
  const inArena = lv === 'arena';
  interior.visible = inArena;
  site.visible = !inArena;
  plaza.visible = (lv === 'plaza');
  gMark.visible = (lv === 'site');
  flowGroup.visible = (lv !== 'arena');
  heatGroup.visible = (siteLayer === 'heat' && lv !== 'arena');
  odGroup.visible = (siteLayer === 'od' && lv !== 'arena');
  isoGroup.visible = (siteLayer === 'iso' && lv !== 'arena');
  indoorGroup.visible = inArena;
  arenaShell.visible = (lv === 'site' && viewMode === 'solid');   // L1では詳細ファサードに差し替え
  gClose.visible = (lv !== 'plaza' && viewMode === 'solid');
  bowlLight.intensity = inArena ? 2.1 : 0;
  hemi.intensity = inArena ? 0.46 : 0.95;
  sun.intensity = inArena ? 0.25 : 1.05;
  applyShow();
  bowlAmb.intensity = inArena ? 0.62 : 0;
  scene.fog.near = inArena ? 400 : (lv === 'plaza' ? 260 : 900);
  scene.fog.far = inArena ? 2600 : (lv === 'plaza' ? 1800 : 5200);
  hideInfo();
  hideFanCard();
  const go = fly ? flyTo : setCam;
  if (lv === 'site') go(ARENA_C.x, 20, ARENA_C.z, 620, -0.55, 0.48);
  else if (lv === 'plaza') go(plazaTarget.x, 9, plazaTarget.z, 96, Math.PI + ARENA_ROT, 0.22);
  else go(ARENA_C.x, 12, ARENA_C.z, 168, -0.7, 0.80);
  renderPanel();
}
/* L0 の解析レイヤー（賑わい / OD）— 排他切替 */
let siteLayer = 'none';
function setSiteLayer(kind, opt) {
  if (kind === 'heat') {
    if (opt === 'none') siteLayer = 'none';
    else { siteLayer = 'heat'; HEAT.mode = opt; if (!HEAT.max) computeGameHeat(); else paintHeat(); }
  } else if (kind === 'od') {
    if (opt === 'off') siteLayer = 'none';
    else { siteLayer = 'od'; KDE.mode = opt; }
  } else if (kind === 'iso') {
    if (opt === 'off') siteLayer = 'none';
    else { siteLayer = 'iso'; if (!ISO.built || ISO.mode !== opt) buildIso(opt); }
  }
  heatGroup.visible = (siteLayer === 'heat' && level !== 'arena');
  odGroup.visible = (siteLayer === 'od' && level !== 'arena');
  isoGroup.visible = (siteLayer === 'iso' && level !== 'arena');
  if (odGroup.visible) updateKDE();
  renderPanel();
}

function applyShow() {
  roofSlab.visible = SHOW.roof;
  trussGrp.visible = SHOW.truss;
  bimGroup.visible = SHOW.structure;
  SUITES.forEach(o => { o.visible = SHOW.suites; });
}
crumbs.forEach(c => c.onclick = () => setLevel(c.dataset.lv, true));

/* ---- マウス / タッチ ---- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hit(e, objs, recursive) {
  ndc.x = (e.clientX / innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(objs, !!recursive);
}
let drag = null, moved = 0;
el.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; moved = 0; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
  moved += Math.abs(dx) + Math.abs(dy);
  drag = [e.clientX, e.clientY];
  cam.yaw = cam.tyaw = cam.yaw - dx * 0.0042;
  cam.pitch = cam.tpitch = clamp(cam.pitch + dy * 0.0034, 0.06, 1.45);
  cam.fly = 0; applyCam(0);
});
el.addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.exp(e.deltaY * 0.0011);
  cam.dist = cam.tdist = clamp(cam.dist * k, level === 'arena' ? 10 : 60,
                               level === 'arena' ? 420 : 6000);
  cam.fly = 0; applyCam(0);
}, { passive: false });
addEventListener('keydown', e => {
  const step = cam.dist * 0.05;
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  if (e.key === 'ArrowUp' || e.key === 'w') { cam.tx -= s * step; cam.tz -= c * step; }
  else if (e.key === 'ArrowDown' || e.key === 's') { cam.tx += s * step; cam.tz += c * step; }
  else if (e.key === 'ArrowLeft' || e.key === 'a') { cam.tx -= c * step; cam.tz += s * step; }
  else if (e.key === 'ArrowRight' || e.key === 'd') { cam.tx += c * step; cam.tz -= s * step; }
  else if (e.key === '1') setLevel('site', true);
  else if (e.key === '2') setLevel('plaza', true);
  else if (e.key === '3') setLevel('arena', true);
  else return;
  cam.ttx = cam.tx; cam.ttz = cam.tz; cam.fly = 0; applyCam(0);
});

/* ---- クリック: サイトでは施設、ボウルでは座席 → 個客カード ---- */
el.addEventListener('click', e => {
  if (moved > 6) return;
  if (level === 'arena') {
    if (SEAT.mesh) {
      const h = hit(e, [SEAT.mesh]);
      if (h.length && h[0].instanceId != null) { showFanCard(h[0].instanceId); return; }
    }
    const h2 = hit(e, interior.children, true);
    for (const q of h2) {
      let o = q.object;
      while (o && !o.userData.kind) o = o.parent;
      if (o && o.userData.kind) {
        if (o.userData.kind === 'bim')
          showInfo(o.userData.type + ' — ' + o.userData.tag,
            Object.entries(o.userData.attrs).map(([k, v]) =>
              '<b style="color:var(--txt)">' + k + '</b>: ' + v).join('<br>'));
        else showInfo(o.userData.name || o.userData.kind, o.userData.desc || '');
        return;
      }
    }
    hideInfo();
    return;
  }
  const objs = [];
  site.traverse(o => { if (o.userData && o.userData.kind) objs.push(o); });
  const h = hit(e, objs);
  if (h.length) {
    const u = h[0].object.userData;
    if (u.kind === 'arena') { setLevel('arena', true); toast('L2 ボウル内部へ — 座席をクリックすると<b>個客プロファイル</b>が開きます', 4200); return; }
    showInfo(u.name, u.desc || '');
  } else hideInfo();
});
