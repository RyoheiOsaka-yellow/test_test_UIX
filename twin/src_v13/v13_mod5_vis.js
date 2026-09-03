/* ================================================================
   ▼ 拡張モジュール5: 👁 スポンサー広告 視認測定（v12: レートカード対応）
   看板ごとに「どの客席から・どのように見えるか」を測定する。
   モデル: 3D視距離 × 文字視角(arcmin) × 正対度 × 着座視野 × 構造遮蔽
   等級閾値は可読性基準のプリセット（ロゴ / 文字 / 小文字）で切替。
   媒体評価はレートカード（掲出料・露出シェア・注視係数）から
   CPM・リーチ単価・割安割高を算出。CSV取込で実売レートカードに置換可能。
   席視点は一人称カメラ（首振り・画角ズーム・視野内看板HUD）。
================================================================ */
(function(){
'use strict';
let visMode=false, gradeView=true, thPreset='std', sortKey='cpm', rateReal=false;
const NV=SEAT.list.length;
const VIS={ready:false};
window.__visBoard=0;

const BOARDS_OK = ledBoards.length>0 && ledBoards[0].w!=null;

const GR_LABEL=['圏外(背面・視野外)','遮蔽','D 視認困難','C 限界','B 良好','A 明瞭'];
const GR_SHORT=['圏外','遮蔽','D','C','B','A'];
const GR_COL=['#3a4054','#ff5a5e','#8b93a8','#ff9a3d','#f5c400','#3ddc84'];

/* --- 等級閾値プリセット（文字高の視角[分]・1分=1/60°） ---
   視力1.0の分解能は1分。ランドルト環準拠で文字認識の下限は文字高5分前後、
   サイン計画の実務では確実な可読に10〜15分以上を見込む。 */
const TH={
 logo:{name:'ロゴ・図形（緩）', th:[8,18,36],
   note:'色面・シンボルマークの識別が成立する下限域。ブランド想起のみを評価する場合。'},
 std: {name:'文字可読（標準）', th:[14,30,55],
   note:'和文ロゴタイプ＋短い企業名が読める水準。既定値。'},
 fine:{name:'小文字・URL（厳）', th:[22,45,80],
   note:'細字・URL・電話番号まで読み取る想定。情報訴求型の掲出を評価する場合。'},
};

/* --- レートカード（仮単価・ダミー / CSV取込で実売に置換） ---
   annual: 年間掲出料[円]（ホーム30試合想定）
   share : 露出時間シェア（LED輪番=枠数の逆数、常時掲出=1.0）
   att   : 注視係数（動画LED=1.0 / リボン=0.85 / 静止看板=0.55） */
const HOME_GAMES=30, OPP=40;   /* OPP: 1試合あたり平均露出機会（ダミー定数） */
const RATE=ledBoards.map((b,i)=>{
  if(b.tier==='court') return {annual:i<2?9600000:6000000, share:1/6,  att:1.00, form:'コートサイドLED（6枠輪番）'};
  if(b.tier==='ribbon')return {annual:i<6?5400000:4200000, share:1/8,  att:0.85, form:'リボンビジョン（8枠輪番）'};
  return               {annual:i<10?7200000:4800000,      share:1.00, att:0.55, form:'壁面看板（常時掲出・静止）'};
});

/* --- 遮蔽判定用 構造プロキシ（レイヤー3・非描画） --- */
const occList=[];
const occBoxes=[
 [0.3,2.6,51.6,-20,2.0,0],[0.3,2.6,51.6,20,2.0,0],           /* 2Fフェイシア 西/東 */
 [39.7,2.6,0.3,0,2.0,-26],[39.7,2.6,0.3,0,2.0,26],           /* 2Fフェイシア 北/南 */
 [3.6,0.4,41,-30.6,8.35,0],[3.6,0.4,41,30.6,8.35,0],         /* 3Fスラブ */
 [7,3.6,7,0,13.2,0],                                          /* センタービジョン */
];
/* 段床は実段差プロファイルの段付きプロキシ（フラット近似だと自席側を過剰遮蔽する） */
for(let r=0;r<8;r+=2){                                        /* 2F固定スタンド: 2列毎 */
  const top=4.0+0.46*(r+1), h=top-3.3, cy=3.3+h/2;
  const cx=20.9+0.8*r, cz=26.9+0.8*r;
  occBoxes.push([1.6,h,53,-cx,cy,0],[1.6,h,53,cx,cy,0]);
  occBoxes.push([41,h,1.6,0,cy,-cz],[41,h,1.6,0,cy,cz]);
}
for(let r=0;r<6;r+=2){                                        /* 1F可動スタンド: 2列毎 */
  const top=0.35+0.38*(r+1), cx=14.59+0.78*r;
  occBoxes.push([1.56,top,36.6,-cx,top/2,0],[1.56,top,36.6,cx,top/2,0]);
}
occBoxes.forEach(p=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(p[0],p[1],p[2]),
    new THREE.MeshBasicMaterial({visible:false}));
  m.position.set(p[3],p[4],p[5]);
  m.layers.set(3);
  interior.add(m);
  occList.push(m);
});

/* --- 席×看板の幾何計算（初回のみ・閾値変更では再計算しない） --- */
function computeVis(){
  if(VIS.ready || !BOARDS_OK) return;
  scene.updateMatrixWorld(true);
  const NB=ledBoards.length;
  VIS.state=new Uint8Array(NB*NV);      /* 0=圏外 1=遮蔽 2=可視 */
  VIS.eff  =new Float32Array(NB*NV);    /* 実効視角[分]（正対・振向き補正込み） */
  VIS.grade=new Uint8Array(NB*NV);
  VIS.score=new Float32Array(NB*NV);
  VIS.dist =new Float32Array(NB*NV);
  VIS.arc  =new Float32Array(NB*NV);
  const ray=new THREE.Raycaster(); ray.layers.set(3);
  const O=new THREE.Vector3(), D=new THREE.Vector3();
  ledBoards.forEach((b,bi)=>{
    const letter=b.h*0.55;   /* 表示コンテンツの実効文字高 */
    /* リボンは取付母体のフェイシア（プロキシ0〜3=西東北南）を自己遮蔽から除外 */
    let occl=occList;
    if(b.tier==='ribbon'){ const host=bi-4; occl=occList.filter((m,ix)=>ix!==host); }
    for(let si=0;si<NV;si++){
      const s=SEAT.list[si], k=bi*NV+si;
      const ey=s.y+1.2;
      const dx=s.x-b.x, dz=s.z-b.z, dH=Math.hypot(dx,dz)||0.001, dy=ey-b.y;
      const d3=Math.sqrt(dH*dH+dy*dy);
      VIS.dist[k]=d3;
      const facing=(dx*b.nx+dz*b.nz)/dH;
      /* 着座視野: 座席の正面ベクトル × 看板方向（背後の看板は視野外） */
      const sd=(-dx*Math.sin(s.ry) - dz*Math.cos(s.ry))/dH;
      if(facing<=0.08 || sd<=-0.35){ VIS.state[k]=0; continue; }
      const av=Math.atan2(Math.abs(dy), dH);
      const arc=letter*Math.max(0.35, Math.cos(av))/d3*3437.75;   /* 視角[分] */
      VIS.arc[k]=arc;
      O.set(MAIN_C.x+s.x, ey, MAIN_C.z+s.z);
      D.set(MAIN_C.x+b.x-O.x, b.y-O.y, MAIN_C.z+b.z-O.z);
      const L=D.length(); D.normalize();
      ray.set(O,D); ray.far=L-0.8;
      if(ray.intersectObjects(occl,false).length){ VIS.state[k]=1; continue; }
      let eff=arc*(0.5+0.5*Math.min(1,facing*1.25));
      if(sd<0.25) eff*=0.75;                               /* 横〜斜め後方: 振り向き視認 */
      if(b.tier==='court' && dy<0.9 && dH>20) eff*=0.68;   /* 低い視点×遠距離: 前列観客・選手の断続遮蔽(推定) */
      VIS.state[k]=2; VIS.eff[k]=eff;
    }
  });
  VIS.ready=true;
  regrade();
}
/* 閾値プリセット適用（幾何は再利用・即時） */
function regrade(){
  if(!VIS.ready) return;
  const T=TH[thPreset].th;
  for(let k=0;k<VIS.state.length;k++){
    const st=VIS.state[k];
    if(st<2){ VIS.grade[k]=st; VIS.score[k]=0; continue; }
    const e=VIS.eff[k];
    VIS.grade[k]= e>=T[2]?5 : e>=T[1]?4 : e>=T[0]?3 : 2;
    VIS.score[k]=Math.min(1, e/T[2]);
  }
}
/* 看板別 媒体統計（販売率加重 × レートカード） */
function computeStats(){
  if(!VIS.ready) return [];
  const st=ledBoards.map((b,bi)=>{
    const cnt=[0,0,0,0,0,0];
    let effN=0, reach=0, dSum=0, dN=0;
    for(let i=0;i<NV;i++){
      const g=VIS.grade[bi*NV+i], s=SEAT.list[i];
      cnt[g]++;
      if(g>=4){ effN++; dSum+=VIS.dist[bi*NV+i]; dN++; }
      reach += s.occ*VIS.score[bi*NV+i];
    }
    const rc=RATE[bi];
    const rateGame=rc.annual/HOME_GAMES;
    const imp=reach*rc.share*rc.att*OPP;                 /* 延べ露出（imp/試合） */
    return {bi, name:b.name, tier:b.tier, cnt, eff:effN, reach, imp,
      avgD:dN?dSum/dN:0, rateGame, annual:rc.annual, form:rc.form,
      cpm: imp>0 ? rateGame/(imp/1000) : Infinity,
      cpr: reach>0 ? rateGame/reach : Infinity};
  });
  const fin=st.map(r=>r.cpm).filter(v=>isFinite(v)).sort((a,b)=>a-b);
  const med=fin.length?fin[Math.floor(fin.length/2)]:0;
  st.forEach(r=>{ r.ratio= med>0 ? r.cpm/med : 1; });
  return st;
}
/* レートカードCSV取込: board,annual_yen[,share][,attention] */
function parseRateCSV(txt){
  let n=0;
  txt.split(/\r?\n/).forEach(line=>{
    const c=line.split(',').map(s=>s.trim());
    if(c.length<2) return;
    const idx=ledBoards.findIndex(b=>b.name===c[0]);
    if(idx<0) return;
    const an=+c[1];
    if(!isFinite(an) || an<=0) return;
    RATE[idx].annual=an;
    if(c[2]!=null && c[2]!=='' && isFinite(+c[2])) RATE[idx].share=Math.max(0.01, Math.min(1, +c[2]));
    if(c[3]!=null && c[3]!=='' && isFinite(+c[3])) RATE[idx].att  =Math.max(0.10, Math.min(1, +c[3]));
    n++;
  });
  if(n>0) rateReal=true;
  return n;
}

/* --- 視線描画（席選択時） --- */
const rayGroup=new THREE.Group(); rayGroup.visible=false; interior.add(rayGroup);
function clearRays(){
  while(rayGroup.children.length){
    const c=rayGroup.children.pop();
    if(c.geometry) c.geometry.dispose();
    if(c.material) c.material.dispose();
  }
}
function drawRays(i){
  clearRays();
  const s=SEAT.list[i], eye=new THREE.Vector3(s.x, s.y+1.2, s.z);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6), new THREE.MeshBasicMaterial({color:0xffffff}));
  dot.position.copy(eye); rayGroup.add(dot);
  ledBoards.forEach((b,bi)=>{
    const g=VIS.grade[bi*NV+i];
    if(g===0) return;                     /* 背面はスキップ */
    const geo=new THREE.BufferGeometry().setFromPoints([eye, new THREE.Vector3(b.x,b.y,b.z)]);
    const ln=new THREE.Line(geo, new THREE.LineBasicMaterial({
      color:new THREE.Color(GR_COL[g]), transparent:true, opacity:g===1?0.45:0.8}));
    rayGroup.add(ln);
  });
  rayGroup.visible = visMode && level==='arena';
}

/* ================================================================
   席視点 一人称カメラ（首振り・画角ズーム・視野内看板HUD）
================================================================ */
const SV={active:false, i:-1, yaw:0, pitch:0, fov:52, saved:null,
  eye:new THREE.Vector3(), raf:0, drag:null, lastHud:0};
window.__svActive=false;
const svPill=document.createElement('div'); svPill.id='sv-exit'; document.body.appendChild(svPill);
const svHud=document.createElement('div'); svHud.id='sv-hud'; document.body.appendChild(svHud);
const svCross=document.createElement('div'); svCross.id='sv-cross'; document.body.appendChild(svCross);

function applyFPV(){
  camera.position.copy(SV.eye);
  camera.rotation.set(SV.pitch, SV.yaw, 0, 'YXZ');
  camera.fov=SV.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
function courtYaw(){                       /* コート中心を向く yaw */
  const f=new THREE.Vector3(MAIN_C.x,1.4,MAIN_C.z).sub(SV.eye).normalize();
  return {yaw:Math.atan2(-f.x,-f.z), pitch:Math.asin(Math.max(-1,Math.min(1,f.y)))};
}
function angDiff(a,b){ let d=a-b; while(d>Math.PI)d-=6.2831853; while(d<-Math.PI)d+=6.2831853; return d; }
function boardsInView(){
  const v=new THREE.Vector3(), out=[];
  ledBoards.forEach((b,bi)=>{
    v.set(MAIN_C.x+b.x, b.y, MAIN_C.z+b.z).project(camera);
    if(v.z<1 && Math.abs(v.x)<1.02 && Math.abs(v.y)<1.02){
      const k=bi*NV+SV.i;
      out.push({bi, name:b.name, ndc:Math.hypot(v.x,v.y),
        g:VIS.ready?VIS.grade[k]:0, d:VIS.ready?VIS.dist[k]:0, a:VIS.ready?VIS.arc[k]:0});
    }
  });
  out.sort((p,q)=>p.ndc-q.ndc);
  return out;
}
function renderHud(){
  const s=SEAT.list[SV.i];
  const cy=courtYaw().yaw;
  const rel=-angDiff(SV.yaw, cy)*57.2958;            /* コート正面基準の首振り角 */
  const zoom=Math.tan(26*Math.PI/180)/Math.tan(SV.fov/2*Math.PI/180);
  const iv=boardsInView();
  /* コンパス帯（±90°を可視化・視野内看板を位置表示） */
  let comp='<div class="cen"></div>';
  for(let a=-90;a<=90;a+=30){
    const x=(a+90)/180*100;
    comp+='<div class="tick" style="left:'+x+'%"></div>';
    if(Math.abs(a)<90)     /* 両端はラベルが見切れるため目盛りのみ */
      comp+='<div class="lbl" style="left:'+x+'%">'+(a===0?'正面':(a>0?'+':'')+a+'°')+'</div>';
  }
  iv.forEach(r=>{
    const b=ledBoards[r.bi];
    const ba=-angDiff(Math.atan2(-(b.x-s.x), -(b.z-s.z)), cy)*57.2958;
    const rx=(ba-rel)/180*100+50;
    if(rx>=0 && rx<=100) comp+='<div class="bd" style="left:'+rx+'%;background:'+GR_COL[r.g]+'"></div>';
  });
  const rows=iv.slice(0,5).map(r=>'<div class="r"><span class="gr-chip" style="background:'+GR_COL[r.g]+'">'+GR_SHORT[r.g]+'</span>'
    +'<span class="nm">'+r.name+'</span><span class="d">'+r.d.toFixed(0)+'m</span></div>').join('')
    || '<div class="r" style="color:var(--sub)">視野内に看板なし — ドラッグで首を振ってください</div>';
  const f=iv[0];
  const focus=f
    ? '<div id="sv-focus"><b style="color:'+GR_COL[f.g]+'">'+GR_LABEL[f.g]+'</b> — '+f.name
      +'<br>視距離 '+f.d.toFixed(1)+'m ／ 文字視角 '+f.a.toFixed(1)+"'"
      +(zoom>1.15?'（画角'+SV.fov.toFixed(0)+'°で肉眼比 約'+zoom.toFixed(1)+'倍）':'')+'</div>'
    : '';
  svHud.innerHTML='<div class="hd">◉ 席視点 — '+s.sec+'ブロック '+(s.row+1)+'列</div>'
   +'<div id="sv-compass">'+comp+'</div>'
   +'<div class="sv-kv"><span>首振り角（コート正面基準）</span><b>'+(rel>=0?'+':'')+rel.toFixed(0)+'°</b></div>'
   +'<div class="sv-kv"><span>俯仰角</span><b>'+(SV.pitch*57.2958>=0?'+':'')+(SV.pitch*57.2958).toFixed(0)+'°</b></div>'
   +'<div class="sv-kv"><span>画角（水平）</span><b>'+SV.fov.toFixed(0)+'°'+(zoom>1.15?' ・約'+zoom.toFixed(1)+'倍':'')+'</b></div>'
   +'<div id="sv-inview"><div class="sv-kv" style="margin-bottom:2px"><span>視野内の看板</span><b>'+iv.length+' / '+ledBoards.length+'</b></div>'+rows+'</div>'
   +focus;
}
function loopFPV(){
  if(!SV.active) return;
  SV.raf=requestAnimationFrame(loopFPV);
  applyFPV();
  const now=performance.now();
  if(now-SV.lastHud>140){ SV.lastHud=now; renderHud(); }
}
function startFPV(){
  SV.active=true; window.__svActive=true;
  ctrl.enabled=false;
  /* 視界を塞ぐ既存オーバーレイを退避（HUDが視野内看板をライブ表示する） */
  tip.style.display='none';
  visCard.style.display='none';
  const tkc=document.getElementById('ticket-card');
  if(tkc) tkc.style.display='none';
  const c=courtYaw();
  SV.yaw=c.yaw; SV.pitch=c.pitch; SV.fov=52;
  svHud.style.display='block';
  svCross.style.display='block';
  applyFPV(); renderHud(); loopFPV();
}
function showPill(){
  const s=SEAT.list[SV.i];
  svPill.style.display='flex';
  svPill.innerHTML='<span>◉ 席視点: '+s.sec+'ブロック '+(s.row+1)+'列</span>'
   +'<span class="ops">ドラッグ=首振り ／ ホイール=画角ズーム ／ <kbd>←</kbd><kbd>→</kbd>首振り <kbd>Esc</kbd>終了</span>'
   +'<button id="sv-front">コート正面</button><button id="sv-back">✕ 戻る</button>';
  document.getElementById('sv-back').onclick=()=> exitSeatView(true);
  document.getElementById('sv-front').onclick=()=>{
    const c=courtYaw(); SV.yaw=c.yaw; SV.pitch=c.pitch; SV.fov=52;
  };
}
function seatView(i){
  if(level!=='arena') setLevel('arena', false);
  if(!VIS.ready) computeVis();
  const s=SEAT.list[i];
  if(!SV.saved){
    SV.saved={minR:ctrl.minR, maxPhi:ctrl.maxPhi, target:ctrl.target.clone(),
      r:ctrl.sph.radius, phi:ctrl.sph.phi, th:ctrl.sph.theta, fov:camera.fov};
  }
  SV.i=i;
  SV.eye.set(MAIN_C.x+s.x, s.y+1.25, MAIN_C.z+s.z);
  ctrl.minR=1.2; ctrl.maxPhi=1.55;
  const tgt=new THREE.Vector3(MAIN_C.x, 1.4, MAIN_C.z);
  const sph=new THREE.Spherical().setFromVector3(SV.eye.clone().sub(tgt));
  showPill();
  flyTo(tgt, sph.radius, sph.phi, sph.theta, 1100, startFPV);
}
function exitSeatView(flyBack){
  if(!SV.saved) return;
  const wasActive=SV.active;
  SV.active=false; window.__svActive=false;
  cancelAnimationFrame(SV.raf);
  camera.fov=SV.saved.fov; camera.updateProjectionMatrix();
  ctrl.enabled=true; ctrl.minR=SV.saved.minR; ctrl.maxPhi=SV.saved.maxPhi;
  if(flyBack && wasActive){
    /* FPVの向きを等価なオービット状態に置き換えてから引き（カメラの飛びを防ぐ） */
    const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    ctrl.target.copy(SV.eye).addScaledVector(fwd, 12);
    const sp=new THREE.Spherical().setFromVector3(SV.eye.clone().sub(ctrl.target));
    ctrl.sph.radius=sp.radius; ctrl.sph.phi=sp.phi; ctrl.sph.theta=sp.theta;
    flyTo(SV.saved.target, SV.saved.r, SV.saved.phi, SV.saved.th, 900);
  } else {
    ctrl.target.copy(SV.saved.target);
    ctrl.sph.radius=SV.saved.r; ctrl.sph.phi=SV.saved.phi; ctrl.sph.theta=SV.saved.th;
    ctrl.apply();
  }
  SV.saved=null;
  svPill.style.display='none'; svHud.style.display='none'; svCross.style.display='none';
}
window.__seatview=seatView;
window.__svExit=()=>{ if(SV.saved) exitSeatView(false); };

/* FPV中はキャンバス上のポインタ操作を首振りに専有する。
   ※ 対象要素での capture は登録順を覆さないため、window の capture 段で消費する
   （HUD・ピル等のUIはキャンバス外なので素通しし、ボタン操作を妨げない）。 */
const onCanvas=(e)=> SV.active && e.target===el;
addEventListener('pointerdown', e=>{
  if(!onCanvas(e)) return;
  SV.drag=[e.clientX, e.clientY];
  el.style.cursor='grabbing';
  e.stopImmediatePropagation();
}, true);
addEventListener('pointermove', e=>{
  if(!SV.active) return;
  if(SV.drag){
    SV.yaw   -= (e.clientX-SV.drag[0])*0.0030*(SV.fov/52);
    SV.pitch -= (e.clientY-SV.drag[1])*0.0026*(SV.fov/52);
    SV.pitch = Math.max(-1.15, Math.min(1.15, SV.pitch));
    SV.drag=[e.clientX, e.clientY];
    tip.style.display='none';
    e.stopImmediatePropagation();
  } else if(onCanvas(e)){
    tip.style.display='none';
    e.stopImmediatePropagation();
  }
}, true);
['pointerup','pointercancel'].forEach(ev=>{
  addEventListener(ev, e=>{
    if(!SV.active) return;
    const dragging=!!SV.drag;
    SV.drag=null; el.style.cursor='default';
    if(dragging || onCanvas(e)) e.stopImmediatePropagation();
  }, true);
});
addEventListener('wheel', e=>{
  if(!onCanvas(e)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  SV.fov=Math.max(16, Math.min(75, SV.fov*(1+Math.sign(e.deltaY)*0.10)));
}, {capture:true, passive:false});
addEventListener('keydown', e=>{
  if(!SV.active) return;
  const step=0.06*(SV.fov/52);
  if(e.key==='ArrowLeft'){ SV.yaw+=step; }
  else if(e.key==='ArrowRight'){ SV.yaw-=step; }
  else if(e.key==='ArrowUp'){ SV.pitch=Math.min(1.15, SV.pitch+step*0.7); }
  else if(e.key==='ArrowDown'){ SV.pitch=Math.max(-1.15, SV.pitch-step*0.7); }
  else if(e.key==='Escape'){ exitSeatView(true); }
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

/* --- 2D席図との連携API --- */
window.__visActive=()=> visMode && VIS.ready;
window.__visGrade=(i)=> (visMode && VIS.ready) ? VIS.grade[window.__visBoard*NV+i] : -1;
window.__visGradeColor=(g)=> GR_COL[g]||'#20242f';
window.__visLegend=function(){
  const nm=BOARDS_OK?ledBoards[window.__visBoard].name:'—';
  return [5,4,3,2,1,0].map(g=>'<div class="li"><div class="sw" style="background:'+GR_COL[g]+'"></div>'+GR_SHORT[g]+'</div>').join('')
   +'<span style="margin-left:auto">対象: '+nm+'（'+TH[thPreset].name+'）</span>';
};
window.__visSeatTop=function(i){
  if(!(visMode && VIS.ready)) return '';
  const arr=ledBoards.map((b,bi)=>({nm:b.name, g:VIS.grade[bi*NV+i], d:VIS.dist[bi*NV+i]}))
    .sort((a,b)=> b.g-a.g || a.d-b.d).slice(0,3);
  return '視認上位: '+arr.map(a=>a.nm+' <b style="color:'+GR_COL[a.g]+'">'+GR_SHORT[a.g]+'</b>').join(' ・ ');
};

/* --- 席クリック → 視認カード＋視線＋「この席から見る」 --- */
const visCard=document.createElement('div'); visCard.id='vis-card'; document.body.appendChild(visCard);
function showVisCard(i){
  const s=SEAT.list[i];
  const rows=ledBoards.map((b,bi)=>({b, bi, g:VIS.grade[bi*NV+i], d:VIS.dist[bi*NV+i], a:VIS.arc[bi*NV+i]}))
    .sort((x,y)=> y.g-x.g || x.d-y.d)
    .map(r=>'<div class="vis-row"><span class="gr-chip" style="background:'+GR_COL[r.g]+'">'+GR_SHORT[r.g]+'</span>'
      +'<span class="nm">'+r.b.name+'</span>'
      +'<span class="d">'+r.d.toFixed(0)+'m'+(r.g>=2?'・'+r.a.toFixed(0)+"'":'')+'</span></div>').join('');
  visCard.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
   +'<div style="font-weight:700;color:#ff7cc0;font-size:12px">👁 '+s.sec+'ブロック '+(s.row+1)+'列 からの看板視認</div>'
   +'<button id="vis-x" style="border:1px solid var(--line);background:var(--panel2);color:var(--sub);border-radius:6px;width:22px;height:22px;cursor:pointer;flex-shrink:0">✕</button></div>'
   +rows
   +'<div class="tk-actrow"><button id="vis-sv">👁 この席から実際に見る（首振り可）</button></div>'
   +'<div class="hint" style="margin-top:7px">等級 = 文字視角 × 正対度 × 構造遮蔽（閾値: '+TH[thPreset].name+'）。視線（3D）は等級色で表示、赤 = 構造遮蔽。</div>';
  visCard.style.display='block';
  document.getElementById('vis-x').onclick=()=>{ visCard.style.display='none'; clearRays(); };
  document.getElementById('vis-sv').onclick=()=> seatView(i);
  drawRays(i);
}
let vDown=null;
el.addEventListener('pointerdown', e=>{ vDown=[e.clientX,e.clientY]; });
el.addEventListener('pointerup', e=>{
  if(!vDown) return;
  const mv=Math.hypot(e.clientX-vDown[0], e.clientY-vDown[1]); vDown=null;
  if(mv>5 || level!=='arena' || pcMode || !SEAT.mesh || SV.active) return;
  const hits=pick(e, [SEAT.mesh], false);
  if(!hits.length || hits[0].instanceId==null) return;
  const i=hits[0].instanceId;
  /* チケットカードへ「この席から見る」を追記（モジュール1のカード表示後に実行される） */
  const tkc=document.getElementById('ticket-card');
  if(tkc && tkc.style.display==='block' && !document.getElementById('tk-sv')){
    tkc.insertAdjacentHTML('beforeend',
      '<div class="tk-actrow"><button id="tk-sv">👁 この席からの見え方</button></div>');
    document.getElementById('tk-sv').onclick=()=> seatView(i);
  }
  if(visMode && VIS.ready) showVisCard(i);
});

/* --- ヘッダーボタン --- */
const visBtn=(function(){
  const d=document.createElement('div');
  d.className='crumb'; d.id='vis-toggle'; d.textContent='👁 視認測定';
  d.title='スポンサー看板の客席別視認性測定（視角×正対×遮蔽・レートカード連動）';
  document.getElementById('lvl-crumb').appendChild(d);
  return d;
})();
function applyVisVis(){
  visBtn.classList.toggle('active', visMode);
  rayGroup.visible = visMode && level==='arena';
  if(!visMode){ visCard.style.display='none'; clearRays(); }
}
const baseSetLevel5=setLevel;
setLevel=function(lv, fly){
  exitSeatView(false);
  baseSetLevel5(lv, fly);
  applyVisVis();
};

const yen=(v)=>'¥'+Math.round(v).toLocaleString();
function visPanelHTML(){
  const st=computeStats();
  const sel=st[window.__visBoard];
  const rank=st.slice().sort((a,b)=>
    sortKey==='cpm' ? a.cpm-b.cpm : (sortKey==='reach' ? b.reach-a.reach : b.rateGame-a.rateGame));
  const rows=rank.map((r,ri)=>{
    const tot=r.cnt.reduce((a,b)=>a+b,0)||1;
    const bar=[5,4,3,2,1,0].map(g=>'<i style="width:'+(r.cnt[g]/tot*100)+'%;background:'+GR_COL[g]+'"></i>').join('');
    const tag= r.ratio<0.8 ? ['割安','#3ddc84'] : (r.ratio>1.25 ? ['割高','#ff6b5e'] : ['適正','#8b93a8']);
    return '<button class="mode-btn '+(r.bi===window.__visBoard?'active':'')+'" data-vb="'+r.bi+'" style="padding:6px 9px">'
     +'<div class="dot" style="background:'+(r.tier==='court'?'#f5c400':r.tier==='ribbon'?'#7fd8ff':'#8b93a8')+'"></div>'
     +'<div style="flex:1">'+(ri+1)+'. '+r.name
     +'<span class="rate-chip" style="background:'+tag[1]+';color:#10131c">'+tag[0]+'</span>'
     +'<span class="desc">CPM '+yen(r.cpm)+' ／ 実効リーチ '+Math.round(r.reach).toLocaleString()+'席 ／ 掲出料 '+yen(r.rateGame/10000)+'万/試合</span>'
     +'<div class="vis-mini">'+bar+'</div></div></button>';
  }).join('');
  const kpis= sel ?
    '<div class="kpi-grid" style="margin-bottom:7px">'
    +'<div class="kpi"><div class="v">'+sel.eff.toLocaleString()+'<small> 席</small></div><div class="l">有効視認席（B以上）</div></div>'
    +'<div class="kpi"><div class="v">'+Math.round(sel.reach).toLocaleString()+'</div><div class="l">実効リーチ（販売率×品質加重）</div></div>'
    +'<div class="kpi"><div class="v">'+yen(sel.cpm)+'</div><div class="l">CPM（¥/1,000露出）</div></div>'
    +'<div class="kpi"><div class="v">'+yen(sel.cpr)+'</div><div class="l">リーチ単価（¥/席・試合）</div></div>'
    +'</div>'
    +'<div class="hint" style="margin-bottom:7px">'+sel.form+'　掲出料 '+yen(sel.annual/10000)+'万/年（'+HOME_GAMES+'試合）＝ '+yen(sel.rateGame/10000)+'万/試合　'
    +'露出シェア '+(RATE[sel.bi].share*100).toFixed(0)+'%　注視係数 '+RATE[sel.bi].att.toFixed(2)+'</div>' : '';
  const thChips=Object.entries(TH).map(([k,v])=>
    '<button class="chip '+(thPreset===k?'active':'')+'" data-th="'+k+'">'+v.name+'</button>').join('');
  const T=TH[thPreset].th;
  const sortChips=[['cpm','コスパ(CPM)'],['reach','リーチ'],['rate','掲出料']].map(s=>
    '<button class="chip '+(sortKey===s[0]?'active':'')+'" data-sk="'+s[0]+'">'+s[1]+'</button>').join('');
  return '<div class="sec" id="vis-sec"><div class="sec-t"><b>👁 視認測定</b> — 看板別 客席可視性（'+GAMES[curGame].name+'）</div>'
   +kpis
   +'<div class="sec-t">視認等級の閾値 — 文字高視角[分]</div>'
   +'<div class="row-btns" style="margin-bottom:5px" id="vis-th">'+thChips+'</div>'
   +'<div class="hint" style="margin-bottom:7px">A ≥ '+T[2]+"' ／ B ≥ "+T[1]+"' ／ C ≥ "+T[0]+"' （1分 = 1/60°）。"+TH[thPreset].note
   +'<br>視力1.0の分解能が1分、文字認識の下限が文字高5分前後という視覚特性を基準にしています。</div>'
   +'<div class="sec-t">レートカード — '+(rateReal?'<b style="color:var(--ok)">実売取込済</b>':'<span style="color:var(--sub)">仮単価（ダミー）</span>')+'</div>'
   +'<input type="file" id="rate-in" accept=".csv,text/csv" style="display:none">'
   +'<button class="tool-btn" id="rate-btn">レートカードCSVを読み込んで単価を上書き</button>'
   +'<div class="hint" style="margin:6px 0 7px">列: board,annual_yen,share,attention（例: リボンビジョン 西,5400000,0.125,0.85）。board = 看板名。share = 露出時間シェア（輪番なら 1/枠数）、attention = 注視係数。年間額は '+HOME_GAMES+' 試合で割って試合単価に換算します。</div>'
   +'<div class="sec-t">並び替え</div>'
   +'<div class="row-btns" style="margin-bottom:7px" id="vis-sort">'+sortChips+'</div>'
   +'<div class="row-btns" style="margin-bottom:7px">'
   +'<button class="chip '+(gradeView?'active':'')+'" id="vis-hm">等級ヒートマップ</button>'
   +'<button class="chip" id="vis-front">選択看板の正対ビュー</button></div>'
   +'<div class="mode-list">'+rows+'</div>'
   +'<div class="hint" style="margin-top:7px">CPM = 掲出料 ÷（実効リーチ × 露出シェア × 注視係数 × 露出機会'+OPP+'回/試合 ÷1000）。割安/割高は全看板CPM中央値比（0.8/1.25倍）。<b>座席クリック</b>で視線と等級表、<b>この席から実際に見る</b>で首振り可能な席視点カメラ。</div></div>';
}
function bindVisPanel(){
  const sec=document.getElementById('vis-sec');
  if(!sec) return;
  sec.querySelectorAll('[data-vb]').forEach(b=> b.onclick=()=>{
    window.__visBoard=+b.dataset.vb;
    repaintSeats(); renderPanel();
    if(window.__m2redraw) window.__m2redraw();
  });
  sec.querySelectorAll('[data-th]').forEach(b=> b.onclick=()=>{
    thPreset=b.dataset.th; regrade();
    repaintSeats(); renderPanel();
    if(window.__m2redraw) window.__m2redraw();
    toast('視認閾値を「'+TH[thPreset].name+'」に切替（A≥'+TH[thPreset].th[2]+"' / B≥"+TH[thPreset].th[1]+"'）");
  });
  sec.querySelectorAll('[data-sk]').forEach(b=> b.onclick=()=>{ sortKey=b.dataset.sk; renderPanel(); });
  const hm=document.getElementById('vis-hm');
  if(hm) hm.onclick=()=>{ gradeView=!gradeView; repaintSeats(); renderPanel(); };
  const fr=document.getElementById('vis-front');
  if(fr) fr.onclick=()=>{
    if(SV.saved) exitSeatView(false);
    const b=ledBoards[window.__visBoard];
    const dist=Math.max(14, Math.min(40, b.w*0.7));
    const tgt=new THREE.Vector3(MAIN_C.x+b.x, b.y, MAIN_C.z+b.z);
    const eye=new THREE.Vector3(MAIN_C.x+b.x+b.nx*dist, b.y+dist*0.22, MAIN_C.z+b.z+b.nz*dist);
    const sph=new THREE.Spherical().setFromVector3(eye.clone().sub(tgt));
    flyTo(tgt, sph.radius, sph.phi, sph.theta, 1000);
  };
  const rb=document.getElementById('rate-btn'), ri=document.getElementById('rate-in');
  if(rb){
    rb.onclick=()=> ri.click();
    ri.onchange=()=>{
      const f=ri.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        const n=parseRateCSV(rd.result);
        toast(n>0 ? n+'面の単価をレートカードとして適用しました' : 'CSVを解釈できませんでした（列: board,annual_yen,share,attention）');
        renderPanel();
      };
      rd.readAsText(f);
    };
  }
}
const baseRenderPanel5=renderPanel;
renderPanel=function(){
  baseRenderPanel5();
  if(visMode && level==='arena' && VIS.ready){ pb.insertAdjacentHTML('afterbegin', visPanelHTML()); bindVisPanel(); }
};
const baseRepaint5=repaintSeats;
repaintSeats=function(){
  baseRepaint5();
  if(visMode && gradeView && VIS.ready && level==='arena' && SEAT.mesh){
    const C=new THREE.Color();
    for(let i=0;i<NV;i++){
      C.set(GR_COL[VIS.grade[window.__visBoard*NV+i]]);
      SEAT.mesh.setColorAt(i, C);
    }
    SEAT.mesh.instanceColor.needsUpdate=true;
  }
};

visBtn.onclick=()=>{
  visMode=!visMode;
  if(visMode){
    if(level!=='arena') setLevel('arena', true);
    if(!VIS.ready){ computeVis(); }
  }
  applyVisVis(); repaintSeats(); renderPanel();
  if(window.__m2redraw) window.__m2redraw();
  if(visMode) toast('視認測定: 閾値プリセットとレートカードでCPM評価。座席クリック→「この席から実際に見る」で首振り視点', 3800);
};

applyVisVis();
})();
