/* ================================================================
   ▼ 拡張モジュール8: 🎛 UIX（v13）
   ツールバー再編（階層／表示／分析／ツール）、起動スプラッシュ、
   キーボードショートカット＋ヘルプ、視点プリセット、PNG撮影、
   ステータスバー（階層・時刻・席数・FPS）、パネル節の折畳、
   ツールチップの画面内クランプ。
================================================================ */
(function(){
'use strict';
const $=(id)=>document.getElementById(id);

/* --- ツールバー: 既存の動的ボタンをグループへ再配置 --- */
const tb=document.createElement('div'); tb.id='toolbar';
tb.innerHTML='<div class="tb-grp" id="tb-view"><span class="tb-l">表示</span></div>'
 +'<div class="tb-grp" id="tb-ana"><span class="tb-l">分析</span></div>'
 +'<div class="tb-grp" id="tb-tool"><span class="tb-l">ツール</span></div>';
document.body.appendChild(tb);
const move=(id, grp)=>{ const e=$(id); if(e) $(grp).appendChild(e); };
['pc-toggle','bim-toggle','map2d-toggle'].forEach(id=>move(id,'tb-view'));
['vps-toggle','od-toggle','cross-toggle','tour-toggle','vis-toggle'].forEach(id=>move(id,'tb-ana'));
function tool(id, txt, title){
  const d=document.createElement('div'); d.className='crumb'; d.id=id; d.textContent=txt; d.title=title;
  $('tb-tool').appendChild(d); return d;
}
const viewBtn=tool('view-toggle','◎ 視点 ▾','視点プリセット');
const shotBtn=tool('shot-btn','📷','現在の画面をPNG保存');
const helpBtn=tool('help-btn','？','操作ガイド・ショートカット（?）');

/* --- 視点プリセット --- */
const VIEWS=[
 {k:'1', name:'サイト俯瞰', sub:'東西5.4km・駅→アリーナ', run:()=> setLevel('site', true)},
 {k:'',  name:'駅からアリーナへ', sub:'JR宇都宮駅と複合体を同一画面に', run:()=>{
    if(level==='arena') setLevel('site', false);
    const s=SCENE_DATA.station ? {x:SCENE_DATA.station.p[0], z:-SCENE_DATA.station.p[1]} : {x:MAIN_C.x-900, z:MAIN_C.z};
    flyTo(new THREE.Vector3((s.x+MAIN_C.x)/2, 0, (s.z+MAIN_C.z)/2), 1500, 0.72, Math.atan2(s.x-MAIN_C.x, s.z-MAIN_C.z)+Math.PI*0.5, 1500); }},
 {k:'2', name:'エントランス広場', sub:'出店シミュレーション', run:()=> setLevel('plaza', true)},
 {k:'',  name:'ファサード（夕景）', sub:'西面サイン・キャノピーを正面から', run:()=>{
    if(level==='arena') setLevel('site', false);
    flyTo(new THREE.Vector3(MAIN_C.x-40, 10, MAIN_C.z), 210, 1.25, -Math.PI/2+0.35, 1400); }},
 {k:'3', name:'コート全景', sub:'アリーナ内部・標準ビュー', run:()=> setLevel('arena', true)},
 {k:'',  name:'コートサイド低視点', sub:'ベンチ側からの低いアングル', run:()=>{
    if(level!=='arena') setLevel('arena', false);
    flyTo(new THREE.Vector3(MAIN_C.x, 1.6, MAIN_C.z), 21, 1.22, -0.55, 1200); }},
 {k:'',  name:'2Fスタンド俯瞰', sub:'客席全体と看板の関係', run:()=>{
    if(level!=='arena') setLevel('arena', false);
    flyTo(new THREE.Vector3(MAIN_C.x, 4, MAIN_C.z), 62, 0.62, 0.8, 1200); }},
 {k:'',  name:'屋根トラス見上げ', sub:'照明バトン・センタービジョン', run:()=>{
    if(level!=='arena') setLevel('arena', false);
    flyTo(new THREE.Vector3(MAIN_C.x, 12, MAIN_C.z), 30, 1.42, 0.3, 1200); }},
];
const vm=document.createElement('div'); vm.id='view-menu';
vm.innerHTML=VIEWS.map((v,i)=>'<button class="vm" data-v="'+i+'"><span>◎</span><span style="flex:1">'+v.name+'<small>'+v.sub+'</small></span>'+(v.k?'<kbd>'+v.k+'</kbd>':'')+'</button>').join('');
document.body.appendChild(vm);
vm.querySelectorAll('[data-v]').forEach(b=> b.onclick=()=>{ vm.style.display='none'; if(window.__svExit) window.__svExit(); VIEWS[+b.dataset.v].run(); });
viewBtn.onclick=(e)=>{ e.stopPropagation(); vm.style.display = vm.style.display==='block' ? 'none' : 'block'; };
addEventListener('pointerdown', e=>{ if(vm.style.display==='block' && !vm.contains(e.target) && e.target!==viewBtn) vm.style.display='none'; }, true);

/* --- PNG撮影（描画直後にtoDataURL） --- */
shotBtn.onclick=()=>{
  renderer.render(scene, camera);
  const url=renderer.domElement.toDataURL('image/png');
  const a=document.createElement('a');
  a.href=url; a.download='brex_arena_twin_'+clockStr(timeState.min).replace(':','')+'_'+level+'.png';
  document.body.appendChild(a); a.click(); a.remove();
  toast('画面をPNGとして保存しました');
};

/* --- ヘルプ / ショートカット --- */
const help=document.createElement('div'); help.id='help';
const K=(k,t)=>'<div class="kr"><kbd>'+k+'</kbd><span>'+t+'</span></div>';
help.innerHTML='<div class="box"><button id="help-x">✕ 閉じる</button>'
 +'<h3>操作ガイド — ブレックスアリーナ宇都宮 デジタルツイン</h3>'
 +'<div class="cols"><div>'
 +'<h4>基本操作</h4>'
 +K('ドラッグ','回転')+K('右ドラッグ','平行移動')+K('ホイール','ズーム')
 +K('クリック','アリーナ→内部へ ／ 座席→チケットカード ／ 部材→BIM属性')
 +K('▶','タイムライン再生（15:00〜22:00・空と場内演出が連動）')
 +'<h4>席視点（一人称）</h4>'
 +K('ドラッグ','首振り')+K('ホイール','画角ズーム（望遠）')+K('← →','首振り')+K('Esc','終了')
 +'</div><div>'
 +'<h4>ショートカット</h4>'
 +K('1 / 2 / 3','L0 サイト ／ L1 広場 ／ L2 アリーナ')
 +K('Space','タイムライン 再生／停止')
 +K('P','点群ビュー')+K('B','BIM詳細')+K('M','2D席図')+K('V','視認測定')
 +K('H','左パネルの折畳')+K('R / D / ⌫','選択物の回転／複製／削除')
 +K('?','このガイド')
 +'<h4>パネル</h4>'
 +K('見出し','クリックでセクションを折畳（状態は保持）')
 +'</div></div></div>';
document.body.appendChild(help);
$('help-x').onclick=()=> help.style.display='none';
help.addEventListener('click', e=>{ if(e.target===help) help.style.display='none'; });
helpBtn.onclick=()=>{ help.style.display = help.style.display==='block' ? 'none' : 'block'; };

const click=(id)=>{ const e=$(id); if(e) e.click(); };
addEventListener('keydown', e=>{
  const t=e.target, tag=t && t.tagName;
  if(tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || (t && t.isContentEditable)) return;
  if(e.ctrlKey || e.metaKey || e.altKey) return;
  if(window.__svActive) return;                     /* 席視点中は専用キー操作 */
  switch(e.key){
    case '1': setLevel('site', true); break;
    case '2': setLevel('plaza', true); break;
    case '3': setLevel('arena', true); break;
    case ' ': if(tag==='BUTTON') return; e.preventDefault(); click('tl-play'); break;
    case 'p': case 'P': click('pc-toggle'); break;
    case 'b': case 'B': click('bim-toggle'); break;
    case 'm': case 'M': click('map2d-toggle'); break;
    case 'v': case 'V': click('vis-toggle'); break;
    case 'h': case 'H': { const p=$('panel'); if(p.classList.contains('collapsed')) $('panel-tab').click(); else $('panel-toggle').click(); break; }
    case '?': helpBtn.click(); break;
    case 'Escape': if(help.style.display==='block'){ help.style.display='none'; e.stopImmediatePropagation(); } vm.style.display='none'; break;
    default: return;
  }
}, true);   /* capture: 基底のEscape（→サイト階層）より先に処理 */

/* --- パネル節の折畳（見出しクリック・再描画後も状態保持） --- */
const FOLDS=new Set();
const pbEl=$('panel-body');
pbEl.addEventListener('click', e=>{
  const h=e.target.closest('.sec-t'); if(!h || !pbEl.contains(h)) return;
  if(e.target.closest('button,input,label')) return;
  const sec=h.parentElement; if(!sec || !sec.classList.contains('sec')) return;   /* 節直下の見出しのみ */
  const key=h.textContent.trim().slice(0,40);
  const on=sec.classList.toggle('fold');
  if(on) FOLDS.add(key); else FOLDS.delete(key);
});
function applyFolds(){
  if(!FOLDS.size) return;
  pbEl.querySelectorAll('.sec').forEach(sec=>{
    const h=sec.querySelector(':scope>.sec-t'); if(!h) return;
    sec.classList.toggle('fold', FOLDS.has(h.textContent.trim().slice(0,40)));
  });
}
const baseRenderPanel8=renderPanel;
renderPanel=function(){ baseRenderPanel8(); applyFolds(); };

/* --- ツールチップの画面内クランプ --- */
addEventListener('pointermove', e=>{
  if(tip.style.display!=='block') return;
  const r=tip.getBoundingClientRect();
  if(r.right>innerWidth-8)  tip.style.left=Math.max(8, e.clientX-14-r.width)+'px';
  if(r.bottom>innerHeight-8) tip.style.top=Math.max(8, e.clientY-10-r.height)+'px';
});

/* --- ステータスバー＋FPS（描画ループをラップ） --- */
const sb=document.createElement('div'); sb.id='statusbar';
sb.innerHTML='<span class="sb" id="sb-lv">L0 サイト俯瞰</span><span class="sb">座席 <b>'+SEAT.list.length.toLocaleString()+'</b></span>'
 +'<span class="sb" id="sb-mode"></span><span class="sb fps"><b id="sb-fps">—</b> fps</span>';
document.body.appendChild(sb);
const LV_NAME={site:'L0 サイト俯瞰', plaza:'L1 エントランス', arena:'L2 アリーナ内部'};
let frames=0, fpsT=performance.now(), fps=0, totalFrames=0;
const baseLoop=loop;
loop=function(now){
  baseLoop(now);
  /* 基底が色更新フラグを立てないテナント行列の色バッファを同期 */
  if(typeof tQueueMesh!=='undefined' && tQueueMesh.instanceColor && tQueueMesh.count>0) tQueueMesh.instanceColor.needsUpdate=true;
  frames++; totalFrames++;
  if(now-fpsT>=1000){
    fps=Math.round(frames*1000/(now-fpsT)); frames=0; fpsT=now;
    $('sb-fps').textContent=fps;
    $('sb-lv').textContent=LV_NAME[level]||level;
    const on=['pc-toggle','bim-toggle','map2d-toggle','vps-toggle','od-toggle','tour-toggle','vis-toggle']
      .filter(id=>{ const e=$(id); return e && e.classList.contains('active'); }).length;
    $('sb-mode').innerHTML='モード <b>'+on+'</b> ON　<b>'+clockStr(timeState.min)+'</b>';
  }
  if(splash && ((totalFrames>=24 && now-t0>1100) || now-t0>3500)){ splash.classList.add('out'); setTimeout(()=>{ if(splash){ splash.remove(); splash=null; } }, 700); }
};

/* --- 起動スプラッシュ --- */
let splash=document.createElement('div'); splash.id='splash';
splash.innerHTML='<div class="lg">X<i>BUILD</i></div><div class="tt">ブレックスアリーナ宇都宮 デジタルツイン</div>'
 +'<div class="bar"><i></i></div><div class="hint"><kbd>?</kbd> で操作ガイド　／　<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> で階層移動</div>';
document.body.appendChild(splash);
const t0=performance.now();
})();
