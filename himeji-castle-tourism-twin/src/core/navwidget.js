/* ================= ◆ ナビゲーションウィジェット（右下）・キーボード操作・パネル折りたたみ =================
   コンパスリングを掴んで回す＝方位回転（クリック＝北を上へ）、縦スライダー＝俯角（真上〜真横）、＋／−＝ズーム、⌂＝姫路城へ、✋/⟳＝左ドラッグの役割
   矢印キー＝移動、Q/E＝回転、R/F＝傾き、+/-＝ズーム、N＝北を上へ、V＝視点ツール、F＝地図に集中 */
const NAV = { ring:null, needle:null, tilt:null, dragging:false, a0:0, th0:0, lastPhi:-1, lastTh:-99 };
function navInit(){
  NAV.ring = document.getElementById('nav-ring'); NAV.needle = document.getElementById('nav-needle'); NAV.tilt = document.getElementById('nav-tilt');
  if(!NAV.ring) return;
  const ringAngle = (e)=>{ const r = NAV.ring.getBoundingClientRect(); return Math.atan2(e.clientY-(r.top+r.height/2), e.clientX-(r.left+r.width/2)); };
  NAV.ring.addEventListener('pointerdown', e=>{ e.preventDefault(); NAV.ring.setPointerCapture(e.pointerId); NAV.dragging = true; NAV.moved = false; NAV.a0 = ringAngle(e); NAV.th0 = ctrl.sph.theta; inertia = null; if(tween) tween = null; });
  NAV.ring.addEventListener('pointermove', e=>{ if(!NAV.dragging) return; let da = ringAngle(e)-NAV.a0; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; if(Math.abs(da)>0.02) NAV.moved = true; ctrl.sph.theta = NAV.th0 - da; ctrl.apply(); });
  const up = e=>{ if(!NAV.dragging) return; NAV.dragging = false; if(!NAV.moved) navNorth(); };
  NAV.ring.addEventListener('pointerup', up); NAV.ring.addEventListener('pointercancel', up);
  NAV.tilt.addEventListener('input', ()=>{ if(tween) tween = null; ctrl.sph.phi = ctrl.minPhi + (ctrl.maxPhi-ctrl.minPhi)*(+NAV.tilt.value/100); ctrl.apply(); });
  document.getElementById('nav-plus').onclick = ()=> zoomBy(-0.33);
  document.getElementById('nav-minus').onclick = ()=> zoomBy(0.33);
  document.getElementById('nav-home').onclick = ()=> setLevel('city');
  const modeBtn = document.getElementById('nav-mode');
  modeBtn.onclick = ()=>{ endGrab(); primaryDragMode = primaryDragMode==='pan' ? 'rotate' : 'pan'; navSyncMode(); toast(primaryDragMode==='pan' ? '✋ 引っ張りモード：ドラッグで地図を引っ張る（離すと滑る）。右ドラッグ／握って待ってから（⟳）ドラッグ＝回転・傾き' : '⟳ 回転モード：ドラッグで地図を掴んで回す（横＝方位・縦＝真上〜真横）。右ドラッグ／Shift＋ドラッグ＝移動', 3200); };
  navSyncMode();
  /* キーボード */
  addEventListener('keydown', e=>{
    if(!ctrl.enabled) return; if(e.target.closest('input,textarea,select,[contenteditable]')) return;
    const k = e.key; const step = ctrl.sph.radius*0.045; let used = true;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize(); const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const nudge = (vx, vz)=>{ if(tween) tween = null; panInertia = { vx:vx/180, vz:vz/180, t:performance.now() }; };
    if(k==='ArrowUp')         nudge(fwd.x*step, fwd.z*step);
    else if(k==='ArrowDown')  nudge(-fwd.x*step, -fwd.z*step);
    else if(k==='ArrowLeft')  nudge(right.x*step, right.z*step);
    else if(k==='ArrowRight') nudge(-right.x*step, -right.z*step);
    else if(k==='q'||k==='Q') inertia = { v:0.0032, t:performance.now() };
    else if(k==='e'||k==='E') inertia = { v:-0.0032, t:performance.now() };
    else if(k==='r'||k==='R'){ ctrl.sph.phi -= 0.06; ctrl.apply(); }
    else if(k==='f'||k==='F') used = false;   // F ＝ 地図に集中（ui.js）
    else if(k==='+'||k==='='||k==='PageUp')  zoomBy(-0.25);
    else if(k==='-'||k==='_'||k==='PageDown') zoomBy(0.25);
    else if(k==='n'||k==='N') navNorth();
    else if(k==='Home') setLevel('city');
    else used = false;
    if(used) e.preventDefault();
  });
  addEventListener('keydown', e=>{ if((e.key==='t'||e.key==='T') && !e.target.closest('input,textarea,select')){ ctrl.sph.phi += 0.06; ctrl.apply(); } });   // T ＝ 傾ける（R と対）
}
function navNorth(){ let th = ctrl.sph.theta; th = th - Math.round(th/(2*Math.PI))*2*Math.PI; flyTo(ctrl.target.clone(), ctrl.sph.radius, ctrl.sph.phi, ctrl.sph.theta - th, 500); }
function navSyncMode(){
  const b = document.getElementById('nav-mode'); if(b){ b.textContent = primaryDragMode==='pan' ? '✋' : '⟳'; b.title = primaryDragMode==='pan' ? '左ドラッグ＝引っ張る（押すと回転に切替）' : '左ドラッグ＝回転（押すと引っ張るに切替）'; b.setAttribute('aria-pressed', primaryDragMode==='rotate'); }
  const d = document.getElementById('drag-mode'); if(d){ d.textContent = primaryDragMode==='pan' ? '移動中' : '回転中'; d.setAttribute('aria-pressed', primaryDragMode==='rotate'); }
  const hint = document.getElementById('nav-hint'); if(hint) hint.textContent = primaryDragMode==='pan' ? 'ドラッグ：引っ張る　右ドラッグ／握って待つ⟳：回す・傾ける　ホイール：ズーム　矢印／Q E／R T：移動・回転・傾き' : 'ドラッグ：掴んで回す（横＝回転・縦＝傾き）　右ドラッグ／Shift：引っ張る　ホイール：ズーム　矢印／Q E／R T';
}
function navTick(){
  if(!NAV.ring) return;
  if(Math.abs(ctrl.sph.theta-NAV.lastTh) > 1e-4){ NAV.lastTh = ctrl.sph.theta; NAV.needle.style.transform = `rotate(${-ctrl.sph.theta*180/Math.PI}deg)`; }
  if(!NAV.dragging && document.activeElement !== NAV.tilt && Math.abs(ctrl.sph.phi-NAV.lastPhi) > 1e-4){ NAV.lastPhi = ctrl.sph.phi; NAV.tilt.value = Math.round((ctrl.sph.phi-ctrl.minPhi)/(ctrl.maxPhi-ctrl.minPhi)*100); }
}
/* ---------- パネルの折りたたみ（全セクション・スタジオ・凡例）。状態は localStorage に保持 ---------- */
const FOLD = { key:'twin.fold.v1', st:{} };
try{ FOLD.st = JSON.parse(localStorage.getItem(FOLD.key)||'{}')||{}; }catch(e){ FOLD.st = {}; }
function foldSave(){ try{ localStorage.setItem(FOLD.key, JSON.stringify(FOLD.st)); }catch(e){} }
function foldKey(sec){ if(sec.id) return sec.id; const t = sec.querySelector('.sec-t'); return 'sec:' + (t ? t.textContent.replace(/[▾▸]/g,'').replace(/[（(].*$/,'').replace(/\d[\d,.]*/g,'#').trim().slice(0,40) : ''); }
function foldApply(root){
  (root||document).querySelectorAll('#panel-body .sec').forEach(sec=>{
    const t = sec.querySelector(':scope > .sec-t'); if(!t) return;
    const k = foldKey(sec); sec.dataset.fold = k;
    if(!t.querySelector('.fold-i')){ const i = document.createElement('span'); i.className='fold-i'; i.textContent='▾'; t.appendChild(i); t.classList.add('foldable'); t.setAttribute('role','button'); t.tabIndex = 0;
      const tog = ev=>{ if(ev.target.closest('button,input,select,a')) return; const f = !sec.classList.contains('folded'); sec.classList.toggle('folded', f); FOLD.st[k] = f; foldSave(); i.textContent = f?'▸':'▾'; };
      t.addEventListener('click', tog); t.addEventListener('keydown', ev=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); tog(ev); } }); }
    const f = !!FOLD.st[k]; sec.classList.toggle('folded', f); t.querySelector('.fold-i').textContent = f?'▸':'▾';
  });
  const all = document.getElementById('fold-all'); if(all){ const anyOpen = [...document.querySelectorAll('#panel-body .sec')].some(s=>!s.classList.contains('folded')); all.textContent = anyOpen ? '全て畳む' : '全て開く'; }
}
function foldAll(fold){ document.querySelectorAll('#panel-body .sec').forEach(sec=>{ const k = sec.dataset.fold||foldKey(sec); FOLD.st[k] = fold; }); foldSave(); foldApply(); }
function foldInit(){
  const all = document.getElementById('fold-all'); if(all) all.onclick = ()=>{ const anyOpen = [...document.querySelectorAll('#panel-body .sec')].some(s=>!s.classList.contains('folded')); foldAll(anyOpen); };
  const studio = document.getElementById('studio'), sf = document.getElementById('studio-fold');
  if(sf){ const apply = ()=>{ const f = !!FOLD.st['studio']; studio.classList.toggle('folded', f); sf.textContent = f?'▸':'▾'; sf.title = f?'表示設定を開く':'表示設定を畳む'; }; sf.onclick = ()=>{ FOLD.st['studio'] = !FOLD.st['studio']; foldSave(); apply(); }; apply(); }
  const lg = document.getElementById('precision-legend'), lf = document.getElementById('legend-fold');
  if(lf){ const apply = ()=>{ const f = !!FOLD.st['legend']; lg.classList.toggle('folded', f); lf.textContent = f?'▸':'▾'; }; lf.onclick = ()=>{ FOLD.st['legend'] = !FOLD.st['legend']; foldSave(); apply(); }; apply(); }
  const nv = document.getElementById('nav'), nf = document.getElementById('nav-fold');
  if(nf){ const apply = ()=>{ const f = !!FOLD.st['nav']; nv.classList.toggle('folded', f); nf.textContent = f?'◂':'▸'; nf.title = f?'ナビを開く':'ナビを畳む'; }; nf.onclick = ()=>{ FOLD.st['nav'] = !FOLD.st['nav']; foldSave(); apply(); }; apply(); }
  /* ヘッダー（見出し帯）の折りたたみ */
  const hdr = document.getElementById('hdr'), hf = document.getElementById('hdr-fold');
  if(hf && hdr){ const apply = ()=>{ const f = !!FOLD.st['hdr']; document.body.classList.toggle('hdr-folded', f); hf.textContent = f?'▾':'▴'; hf.title = f?'ヘッダーを開く':'ヘッダーを畳む'; }; hf.onclick = ()=>{ FOLD.st['hdr'] = !FOLD.st['hdr']; foldSave(); apply(); }; apply(); }
}
window.twinNav = { NAV, FOLD, foldAll, foldApply, navNorth };
