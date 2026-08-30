/* ================================================================
   ▼ 拡張モジュール5: 👁 スポンサー広告 視認測定
   看板ごとに「どの客席から・どのように見えるか」を測定する。
   モデル: 3D視距離 × 文字視角（arcmin） × 正対度 × 構造遮蔽（レイキャスト）
   出力: 席別視認等級(A〜D/遮蔽/圏外)ヒートマップ・看板別実効視認・
         席選択で全看板への視線描画・席視点カメラ（実際の見え方）
   単価・係数はダミー — 媒体販売実績データ接続で実測化可能。
================================================================ */
(function(){
'use strict';
let visMode=false, gradeView=true;
const NV=SEAT.list.length;
const VIS={ready:false};
window.__visBoard=0;

/* 看板メタはモジュール4で付与済み（未付与なら中止） */
const BOARDS_OK = ledBoards.length>0 && ledBoards[0].w!=null;

const GR_LABEL=['圏外(背面・視野外)','遮蔽','D 視認困難','C 限界','B 良好','A 明瞭'];
const GR_SHORT=['圏外','遮蔽','D','C','B','A'];
const GR_COL=['#3a4054','#ff5a5e','#8b93a8','#ff9a3d','#f5c400','#3ddc84'];

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

/* --- 席×看板の視認計算（初回ON時に一括） --- */
function computeVis(){
  if(VIS.ready || !BOARDS_OK) return;
  scene.updateMatrixWorld(true);
  const NB=ledBoards.length;
  VIS.grade=new Uint8Array(NB*NV);
  VIS.score=new Float32Array(NB*NV);
  VIS.dist=new Float32Array(NB*NV);
  VIS.arc=new Float32Array(NB*NV);
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
      if(facing<=0.08 || sd<=-0.35){ VIS.grade[k]=0; continue; }
      const av=Math.atan2(Math.abs(dy), dH);
      const arc=letter*Math.max(0.35, Math.cos(av))/d3*3437.75;   /* 視角[分] */
      VIS.arc[k]=arc;
      O.set(MAIN_C.x+s.x, ey, MAIN_C.z+s.z);
      D.set(MAIN_C.x+b.x-O.x, b.y-O.y, MAIN_C.z+b.z-O.z);
      const L=D.length(); D.normalize();
      ray.set(O,D); ray.far=L-0.8;
      if(ray.intersectObjects(occl,false).length){ VIS.grade[k]=1; continue; }
      let eff=arc*(0.5+0.5*Math.min(1,facing*1.25));
      if(sd<0.25) eff*=0.75;                               /* 横〜斜め後方: 振り向き視認 */
      if(b.tier==='court' && dy<0.9 && dH>20) eff*=0.68;   /* 低い視点×遠距離: 前列観客・選手の断続遮蔽(推定) */
      VIS.score[k]=Math.min(1, eff/55);
      VIS.grade[k]= eff>=55?5 : eff>=30?4 : eff>=14?3 : 2;
    }
  });
  VIS.ready=true;
}
/* 販売率(占有)加重の看板別統計 — 対象試合の切替毎に再計算 */
function computeStats(){
  if(!VIS.ready) return [];
  return ledBoards.map((b,bi)=>{
    const cnt=[0,0,0,0,0,0];
    let eff=0, imp=0, dSum=0, dN=0;
    for(let i=0;i<NV;i++){
      const g=VIS.grade[bi*NV+i], s=SEAT.list[i];
      cnt[g]++;
      if(g>=4){ eff++; dSum+=VIS.dist[bi*NV+i]; dN++; }
      imp += s.occ*VIS.score[bi*NV+i];
    }
    return {bi, name:b.name, tier:b.tier, cnt, eff, imp, avgD:dN?dSum/dN:0, value:imp*620};
  });
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

/* --- 席視点カメラ（この席からの実際の見え方） --- */
let svSaved=null;
const svPill=document.createElement('div'); svPill.id='sv-exit'; document.body.appendChild(svPill);
function exitSeatView(flyBack){
  if(!svSaved) return;
  ctrl.minR=svSaved.minR; ctrl.maxPhi=svSaved.maxPhi;
  if(flyBack) flyTo(svSaved.target, svSaved.r, svSaved.phi, svSaved.th, 900);
  svSaved=null;
  svPill.style.display='none';
}
function seatView(i){
  const s=SEAT.list[i];
  if(level!=='arena') setLevel('arena', false);
  if(!svSaved){
    svSaved={minR:ctrl.minR, maxPhi:ctrl.maxPhi, target:ctrl.target.clone(),
      r:ctrl.sph.radius, phi:ctrl.sph.phi, th:ctrl.sph.theta};
  }
  ctrl.minR=1.5; ctrl.maxPhi=1.55;
  const eye=new THREE.Vector3(MAIN_C.x+s.x, s.y+1.25, MAIN_C.z+s.z);
  const tgt=new THREE.Vector3(MAIN_C.x, 1.4, MAIN_C.z);
  const sph=new THREE.Spherical().setFromVector3(eye.clone().sub(tgt));
  flyTo(tgt, sph.radius, sph.phi, sph.theta, 1100);
  svPill.style.display='block';
  svPill.innerHTML='◉ 席視点: '+s.sec+'ブロック '+(s.row+1)+'列 — この席からのコート・看板の見え方'
   +'<button id="sv-back">✕ 戻る</button>';
  document.getElementById('sv-back').onclick=()=> exitSeatView(true);
}
window.__seatview=seatView;

/* --- 2D席図との連携API --- */
window.__visActive=()=> visMode && VIS.ready;
window.__visGrade=(i)=> (visMode && VIS.ready) ? VIS.grade[window.__visBoard*NV+i] : -1;
window.__visGradeColor=(g)=> GR_COL[g]||'#20242f';
window.__visLegend=function(){
  const nm=BOARDS_OK?ledBoards[window.__visBoard].name:'—';
  return [5,4,3,2,1,0].map(g=>'<div class="li"><div class="sw" style="background:'+GR_COL[g]+'"></div>'+GR_SHORT[g]+'</div>').join('')
   +'<span style="margin-left:auto">対象: '+nm+'</span>';
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
   +'<div class="tk-actrow"><button id="vis-sv">👁 この席から実際に見る</button></div>'
   +'<div class="hint" style="margin-top:7px">等級 = 文字視角 × 正対度 × 構造遮蔽。視線（3D）は等級色で表示、赤 = 構造遮蔽。</div>';
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
  if(mv>5 || level!=='arena' || pcMode || !SEAT.mesh) return;
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
  d.title='スポンサー看板の客席別視認性測定（視角×正対×遮蔽）';
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

function visPanelHTML(){
  const st=computeStats();
  const sel=st[window.__visBoard];
  const rank=st.slice().sort((a,b)=>b.value-a.value);
  const rows=rank.map((r,ri)=>{
    const tot=r.cnt.reduce((a,b)=>a+b,0)||1;
    const bar=[5,4,3,2,1,0].map(g=>'<i style="width:'+(r.cnt[g]/tot*100)+'%;background:'+GR_COL[g]+'"></i>').join('');
    return '<button class="mode-btn '+(r.bi===window.__visBoard?'active':'')+'" data-vb="'+r.bi+'" style="padding:6px 9px">'
     +'<div class="dot" style="background:'+(r.tier==='court'?'#f5c400':r.tier==='ribbon'?'#7fd8ff':'#8b93a8')+'"></div>'
     +'<div style="flex:1">'+(ri+1)+'. '+r.name
     +'<span class="desc">有効視認 '+r.eff.toLocaleString()+'席 ・ 実効視認 '+Math.round(r.imp).toLocaleString()+' ・ 媒体価値 ¥'+Math.round(r.value/10000).toLocaleString()+'万/試合</span>'
     +'<div class="vis-mini">'+bar+'</div></div></button>';
  }).join('');
  const kpis= sel ?
    '<div class="kpi-grid" style="margin-bottom:7px">'
    +'<div class="kpi"><div class="v">'+sel.eff.toLocaleString()+'<small> 席</small></div><div class="l">有効視認席（B以上）</div></div>'
    +'<div class="kpi"><div class="v">'+Math.round(sel.imp).toLocaleString()+'</div><div class="l">実効視認（販売率加重）</div></div>'
    +'<div class="kpi"><div class="v">'+sel.avgD.toFixed(0)+'<small> m</small></div><div class="l">有効席の平均視距離</div></div>'
    +'<div class="kpi"><div class="v">¥'+Math.round(sel.value/10000).toLocaleString()+'<small> 万</small></div><div class="l">推定媒体価値/試合（ダミー単価）</div></div>'
    +'</div>' : '';
  return '<div class="sec" id="vis-sec"><div class="sec-t"><b>👁 視認測定</b> — 看板別 客席可視性（'+GAMES[curGame].name+'）</div>'
   +kpis
   +'<div class="row-btns" style="margin-bottom:7px">'
   +'<button class="chip '+(gradeView?'active':'')+'" id="vis-hm">等級ヒートマップ</button>'
   +'<button class="chip" id="vis-front">選択看板の正対ビュー</button></div>'
   +'<div class="mode-list">'+rows+'</div>'
   +'<div class="hint" style="margin-top:7px">等級 = 文字視角[分] × 正対度 × 構造遮蔽（フェイシア・躯体・スラブ・センタービジョンとのレイ交差判定）。<b>座席クリック</b>で席→全看板の視線と等級表、<b>この席から実際に見る</b>で席視点カメラ。単価・係数はダミー、媒体販売実績で実測化できます。</div></div>';
}
function bindVisPanel(){
  const sec=document.getElementById('vis-sec');
  if(!sec) return;
  sec.querySelectorAll('[data-vb]').forEach(b=> b.onclick=()=>{
    window.__visBoard=+b.dataset.vb;
    repaintSeats(); renderPanel();
    if(window.__m2redraw) window.__m2redraw();
  });
  const hm=document.getElementById('vis-hm');
  if(hm) hm.onclick=()=>{ gradeView=!gradeView; repaintSeats(); renderPanel(); };
  const fr=document.getElementById('vis-front');
  if(fr) fr.onclick=()=>{
    const b=ledBoards[window.__visBoard];
    const dist=Math.max(14, Math.min(40, b.w*0.7));
    const tgt=new THREE.Vector3(MAIN_C.x+b.x, b.y, MAIN_C.z+b.z);
    const eye=new THREE.Vector3(MAIN_C.x+b.x+b.nx*dist, b.y+dist*0.22, MAIN_C.z+b.z+b.nz*dist);
    const sph=new THREE.Spherical().setFromVector3(eye.clone().sub(tgt));
    flyTo(tgt, sph.radius, sph.phi, sph.theta, 1000);
  };
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
  if(visMode) toast('視認測定: 看板を選択すると席別の視認等級を表示。座席クリックで視線＋席視点カメラ', 3600);
};

applyVisVis();
})();
