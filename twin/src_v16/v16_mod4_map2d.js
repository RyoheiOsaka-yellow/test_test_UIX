/* ================================================================
   ▼ 拡張モジュール4: 🗺 2D席図 — チケット / FC会員データ連動
   参考席図（ホワイトリング形式）準拠の平面席図。3D座席と双方向連動、
   席種・販売率・FC会員・露出・視認等級を2Dで確認できる。
   FC会員データはダミー — CLUB BREX / J-ticket実データ接続で置換可能。
================================================================ */
(function(){
'use strict';
let m2Open=false, m2Mode='cat', selSeat=-1, fc3d=false, prevMode='crowd';
const N2=SEAT.list.length;
const hexOf=c=>'#'+c.getHexString();

/* --- 看板メタ（生成順: コートサイド4 → リボン4 → 壁面4） --- */
const BMETA=[
 {y:0.85,h:0.95,w:22,tier:'court'},{y:0.85,h:0.95,w:22,tier:'court'},
 {y:0.85,h:0.95,w:14,tier:'court'},{y:0.85,h:0.95,w:14,tier:'court'},
 {y:2.65,h:0.7,w:51,tier:'ribbon'},{y:2.65,h:0.7,w:51,tier:'ribbon'},
 {y:2.65,h:0.7,w:39,tier:'ribbon'},{y:2.65,h:0.7,w:39,tier:'ribbon'},
 {y:12.5,h:2.3,w:40,tier:'wall'},{y:12.5,h:2.3,w:40,tier:'wall'},
 {y:11,h:2.3,w:34,tier:'wall'},{y:11,h:2.3,w:34,tier:'wall'},
];
if(ledBoards.length && ledBoards[0].w==null)
  ledBoards.forEach((b,i)=>{ if(BMETA[i]) Object.assign(b, BMETA[i]); });

/* --- FC会員ダミーデータ（決定論的・席種で構成比が変化） --- */
const FC_META=[['年間シート','#f5c400'],['プラチナ会員','#b8c4e8'],['ゴールド会員','#ff9a3d'],['レギュラー会員','#3ddc84'],['FC非会員','#4a5066']];
const FC=new Uint8Array(N2);
(function(){
  const cum={prem:[0.45,0.60,0.75,0.90], S2:[0.30,0.42,0.60,0.80], S3:[0.08,0.16,0.32,0.60]};
  SEAT.list.forEach((s,i)=>{
    const r=(((i*2654435761+123456789)>>>0)%1000)/1000;
    const c=s.cat==='S2'?cum.S2:(s.cat==='S3'?cum.S3:cum.prem);
    FC[i]= r<c[0]?0 : r<c[1]?1 : r<c[2]?2 : r<c[3]?3 : 4;
  });
})();
const isSold=i=> (i%97)/97 < SEAT.list[i].occ;

/* --- セクション定義 --- */
const SEC_NAME={WF:'コートサイド西(仮設)', EF:'ベンチサイド東', NF:'エンド北', SF:'エンド南',
  WR:'1F可動 西', ER:'1F可動 東', W2:'2F指定 西', E2:'2F指定 東', N2:'2F指定 北', S2:'2F指定 南', W3:'3F自由 西', E3:'3F自由 東'};
const SEC_ORDER=['WF','EF','NF','SF','WR','ER','W2','E2','N2','S2','W3','E3'];
const secCent={};
SEAT.list.forEach(s=>{
  const m=secCent[s.sec]||(secCent[s.sec]={x:0,z:0,n:0});
  m.x+=s.x; m.z+=s.z; m.n++;
});
Object.values(secCent).forEach(m=>{ m.x/=m.n; m.z/=m.n; });

/* --- パネルDOM --- */
const M2W=368, M2H=400, PXM=M2W/79;      /* 4.66px/m, x∈±39.5 z∈±43 */
const X2=x=>(x+39.5)*PXM, Y2=z=>(z+43)*PXM;
const m2=document.createElement('div'); m2.id='map2d-panel';
m2.innerHTML='<div id="m2-head"><span class="t">🗺 2D席図</span><span class="g" id="m2-game"></span>'
 +'<button id="m2-close" title="閉じる">✕</button></div>'
 +'<canvas id="map2d-cv" width="'+(M2W*2)+'" height="'+(M2H*2)+'"></canvas>'
 +'<div id="m2-chips"></div><div id="m2-legend"></div><div id="m2-detail"></div><div id="m2-tbl"></div>';
document.body.appendChild(m2);
const cv=document.getElementById('map2d-cv');
const cx2=cv.getContext('2d'); cx2.setTransform(2,0,0,2,0,0);
const m2Detail=document.getElementById('m2-detail');

/* --- 3Dビーコン（2Dで選択した席の位置表示） --- */
const beacon=new THREE.Mesh(new THREE.ConeGeometry(0.5,2.0,8),
  new THREE.MeshBasicMaterial({color:0xf5c400}));
beacon.rotation.x=Math.PI; beacon.visible=false;
interior.add(beacon);

function seatNoL(i){
  const s=SEAT.list[i]; let n=1, j=i-1;
  while(j>=0 && SEAT.list[j].sec===s.sec && SEAT.list[j].row===s.row){ n++; j--; }
  return n;
}
function seatColor(s, i){
  if(m2Mode==='cat') return hexOf(new THREE.Color(CAT[s.cat].color));
  if(m2Mode==='occ') return hexOf(heatC(s.occ));
  if(m2Mode==='fc')  return isSold(i) ? FC_META[FC[i]][1] : '#20242f';
  if(m2Mode==='exp'){
    if(expBoard<0) return hexOf(heatC(s.exp));
    return hexOf(heatC(Math.min(1, SEAT.expB[expBoard*N2+i]/(SEAT.maxB[expBoard]||1))));
  }
  if(m2Mode==='vis' && window.__visGrade){
    const g=window.__visGrade(i);
    return g>=0 ? window.__visGradeColor(g) : '#20242f';
  }
  return '#2a3044';
}
function draw(){
  cx2.clearRect(0,0,M2W,M2H);
  cx2.fillStyle='#0a0c12'; cx2.fillRect(0,0,M2W,M2H);
  if(m2Mode==='official' && window.__m2official){ window.__m2official(cx2, M2W, M2H); document.getElementById('m2-game').textContent=GAMES[curGame].name+'｜公式ブロック（仮対応）'; drawChips(); drawLegend(); drawTable(); return; }
  /* コート */
  cx2.fillStyle='#8a6f45';
  cx2.fillRect(X2(-7.5),Y2(-14),15*PXM,28*PXM);
  cx2.strokeStyle='#c9a36a'; cx2.lineWidth=1;
  cx2.strokeRect(X2(-7.5),Y2(-14),15*PXM,28*PXM);
  cx2.beginPath(); cx2.arc(X2(0),Y2(0),1.8*PXM,0,6.2832); cx2.stroke();
  /* 看板（帯） */
  ledBoards.forEach((b,i)=>{
    if(b.w==null) return;
    const sel=(m2Mode==='vis'||m2Mode==='exp') && (window.__visBoard===i || expBoard===i);
    cx2.strokeStyle= sel?'#ffffff' : b.tier==='court'?'#f5c400' : b.tier==='ribbon'?'#7fd8ff' : '#8b93a8';
    cx2.lineWidth= sel?3:2;
    cx2.beginPath();
    if(Math.abs(b.nx)>0.5){ cx2.moveTo(X2(b.x),Y2(b.z-b.w/2)); cx2.lineTo(X2(b.x),Y2(b.z+b.w/2)); }
    else { cx2.moveTo(X2(b.x-b.w/2),Y2(b.z)); cx2.lineTo(X2(b.x+b.w/2),Y2(b.z)); }
    cx2.stroke();
  });
  /* 座席 */
  SEAT.list.forEach((s,i)=>{
    cx2.fillStyle=seatColor(s,i);
    cx2.fillRect(X2(s.x)-1.1, Y2(s.z)-1.1, 2.2, 2.2);
  });
  /* セクションラベル */
  cx2.font='700 9px Oswald, sans-serif'; cx2.textAlign='center'; cx2.textBaseline='middle';
  const so={}, sn={};
  if(m2Mode==='occ'){ SEAT.list.forEach(s=>{ so[s.sec]=(so[s.sec]||0)+s.occ; sn[s.sec]=(sn[s.sec]||0)+1; }); }
  SEC_ORDER.forEach(k=>{
    const m=secCent[k]; if(!m) return;
    cx2.fillStyle='rgba(10,12,18,.72)';
    const t = m2Mode==='occ' ? k+' '+Math.round(so[k]/sn[k]*100)+'%' : k;
    const tw=cx2.measureText(t).width;
    cx2.fillRect(X2(m.x)-tw/2-3, Y2(m.z)-7, tw+6, 13);
    cx2.fillStyle='#e8eaf2';
    cx2.fillText(t, X2(m.x), Y2(m.z));
  });
  /* 選択席マーカー */
  if(selSeat>=0){
    const s=SEAT.list[selSeat];
    cx2.strokeStyle='#ffffff'; cx2.lineWidth=1.6;
    cx2.beginPath(); cx2.arc(X2(s.x),Y2(s.z),5,0,6.2832); cx2.stroke();
  }
  document.getElementById('m2-game').textContent=GAMES[curGame].name+'｜'+(CALIB[curGame]?'実測校正済':'合成値');
  drawChips(); drawLegend(); drawTable();
}
function drawChips(){
  const modes=[['cat','席種'],['occ','販売率'],['fc','FC会員'],['exp','露出'],['vis','視認等級'],['official','公式席図']];
  const elC=document.getElementById('m2-chips');
  elC.innerHTML=modes.map(m=>'<button class="chip '+(m2Mode===m[0]?'active':'')+'" data-m2="'+m[0]+'">'+m[1]+'</button>').join('')
   +'<button class="chip '+(fc3d?'active':'')+'" id="m2-fc3d" title="FC会員の色分けを3D座席にも反映">FC→3D反映</button>';
  elC.querySelectorAll('[data-m2]').forEach(b=> b.onclick=()=>{
    if(b.dataset.m2==='vis' && !(window.__visActive && window.__visActive())){
      toast('視認等級は「👁 視認測定」モードをONにすると表示できます'); return;
    }
    m2Mode=b.dataset.m2; draw();
  });
  document.getElementById('m2-fc3d').onclick=()=>{
    fc3d=!fc3d;
    if(fc3d){ if(seatMode!=='fc2d') prevMode=seatMode; seatMode='fc2d'; if(level!=='arena') setLevel('arena', true); }
    else if(seatMode==='fc2d') seatMode=prevMode;
    repaintSeats(); renderPanel(); draw();
    if(fc3d) toast('FC会員構成を3D座席へ反映しました（表示レイヤー選択で解除）');
  };
}
function drawLegend(){
  const lg=document.getElementById('m2-legend');
  const li=(c,t)=>'<div class="li"><div class="sw" style="background:'+c+'"></div>'+t+'</div>';
  if(m2Mode==='cat') lg.innerHTML=Object.values(CAT).map(c=>li(hexOf(new THREE.Color(c.color)), c.name)).join('');
  else if(m2Mode==='occ') lg.innerHTML=li('#20315e','低')+li('#3ddc84','中')+li('#ff6b5e','完売間近')+'<span style="margin-left:auto">ラベル＝ブロック販売率</span>';
  else if(m2Mode==='fc'){
    let cnt=[0,0,0,0,0], sold=0;
    SEAT.list.forEach((s,i)=>{ if(isSold(i)){ sold++; cnt[FC[i]]++; } });
    const rate=sold?Math.round((sold-cnt[4])/sold*100):0;
    lg.innerHTML=FC_META.map(f=>li(f[1],f[0])).join('')
     +'<span style="margin-left:auto">販売席のFC率 <b style="color:var(--brex)">'+rate+'%</b>・年間 '+cnt[0]+'席（ダミー）</span>';
  }
  else if(m2Mode==='exp') lg.innerHTML=li('#20315e','低露出')+li('#f5c400','高露出')+'<span style="margin-left:auto">'+(expBoard<0?'全看板合成':'看板単体（露出解析で選択中）')+'</span>';
  else if(m2Mode==='vis' && window.__visLegend) lg.innerHTML=window.__visLegend();
  else if(m2Mode==='official' && window.__m2officialLegend) lg.innerHTML=window.__m2officialLegend();
  else lg.innerHTML='';
}
function drawTable(){
  const agg={};
  SEAT.list.forEach((s,i)=>{
    const a=agg[s.sec]||(agg[s.sec]={n:0,occ:0,exp:0,fc:0,sold:0});
    a.n++; a.occ+=s.occ; a.exp+=s.exp;
    if(isSold(i)){ a.sold++; if(FC[i]<4) a.fc++; }
  });
  const selSec=selSeat>=0?SEAT.list[selSeat].sec:null;
  const rows=SEC_ORDER.filter(k=>agg[k]).map(k=>{
    const a=agg[k];
    return '<tr'+(k===selSec?' class="hl"':'')+'><td>'+k+'　<span style="color:var(--sub)">'+SEC_NAME[k]+'</span></td>'
     +'<td>'+a.n+'</td><td>'+Math.round(a.occ/a.n*100)+'%</td>'
     +'<td>'+(a.sold?Math.round(a.fc/a.sold*100):0)+'%</td>'
     +'<td>'+Math.round(a.exp/a.n*100)+'</td></tr>';
  }).join('');
  document.getElementById('m2-tbl').innerHTML=
    '<table><tr><th>ブロック</th><th>席数</th><th>販売</th><th>FC率</th><th>露出</th></tr>'+rows+'</table>';
}
function showDetail(i){
  const s=SEAT.list[i], cat=CAT[s.cat];
  let vis='';
  if(window.__visSeatTop) vis=window.__visSeatTop(i);
  m2Detail.style.display='block';
  m2Detail.innerHTML='<b style="color:var(--brex)">'+s.sec+'ブロック '+(s.row+1)+'列 '+seatNoL(i)+'番</b>　'
   +cat.name+' ¥'+cat.price.toLocaleString()
   +(s.rec&&s.rec!==cat.price?' → <b style="color:var(--brex)">推奨 ¥'+s.rec.toLocaleString()+'</b>':'')
   +'<br>販売率 '+(s.occ*100).toFixed(0)+'%　露出 '+(s.exp*100).toFixed(0)+'pt　'
   +'<span style="color:'+FC_META[FC[i]][1]+'">'+(isSold(i)?FC_META[FC[i]][0]:'未販売')+'</span>（ダミー）'
   +(vis?'<br>'+vis:'')
   +'<div class="tk-actrow"><button id="m2-fly">🏀 3Dで席へ移動</button>'
   +(window.__seatview?'<button id="m2-sv">👁 この席から見る</button>':'')+'</div>';
  document.getElementById('m2-fly').onclick=()=>{
    if(window.__svExit) window.__svExit();
    if(level!=='arena') setLevel('arena', true);
    setTimeout(()=>{
      const th=Math.atan2(s.x, s.z);
      flyTo(new THREE.Vector3(MAIN_C.x+s.x*0.55, s.y*0.5+1, MAIN_C.z+s.z*0.55), 34, 1.05, th, 900);
    }, level!=='arena'?260:0);
  };
  const sv=document.getElementById('m2-sv');
  if(sv) sv.onclick=()=> window.__seatview(i);
}
function selectSeat(i, fromCanvas){
  selSeat=i;
  const s=SEAT.list[i];
  beacon.position.set(s.x, s.y+2.6, s.z);
  beacon.visible = level==='arena' && m2Open;
  showDetail(i);
  draw();
}
window.__m2select=function(i){ if(m2Open) selectSeat(i, false); };
window.__m2setDetail=function(html){ m2Detail.style.display='block'; m2Detail.innerHTML=html; };
window.__m2redraw=function(){ if(m2Open) requestDraw(); };

/* --- canvasインタラクション --- */
function nearestSeat(mx, my){
  let best=-1, bd=60;   /* 7.7px以内 */
  for(let i=0;i<N2;i++){
    const s=SEAT.list[i];
    const dx=X2(s.x)-mx, dy=Y2(s.z)-my, d=dx*dx+dy*dy;
    if(d<bd){ bd=d; best=i; }
  }
  return best;
}
cv.addEventListener('mousemove', e=>{
  const r=cv.getBoundingClientRect();
  if(m2Mode==='official'){ if(window.__m2officialHover) window.__m2officialHover((e.clientX-r.left)*M2W/r.width, (e.clientY-r.top)*M2H/r.height, e); return; }
  const i=nearestSeat((e.clientX-r.left)*M2W/r.width, (e.clientY-r.top)*M2H/r.height);
  if(i>=0){
    const s=SEAT.list[i], cat=CAT[s.cat];
    tip.style.display='block';
    tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY-40)+'px';
    tip.innerHTML='<span class="t-nm">'+s.sec+'ブロック '+(s.row+1)+'列 '+seatNoL(i)+'番</span><br>'
     +cat.name+'　¥'+cat.price.toLocaleString()+'<br>販売率 '+(s.occ*100).toFixed(0)+'%　'
     +(isSold(i)?FC_META[FC[i]][0]:'未販売');
  } else tip.style.display='none';
});
cv.addEventListener('mouseleave', ()=>{ tip.style.display='none'; });
cv.addEventListener('click', e=>{
  const r=cv.getBoundingClientRect();
  if(m2Mode==='official'){ if(window.__m2officialClick){ window.__m2officialClick((e.clientX-r.left)*M2W/r.width, (e.clientY-r.top)*M2H/r.height); draw(); } return; }
  const i=nearestSeat((e.clientX-r.left)*M2W/r.width, (e.clientY-r.top)*M2H/r.height);
  if(i>=0) selectSeat(i, true);
});

/* --- 3D側の座席クリック → 2Dへ同期 --- */
let mDown=null;
el.addEventListener('pointerdown', e=>{ mDown=[e.clientX,e.clientY]; });
el.addEventListener('pointerup', e=>{
  if(!mDown) return;
  const mv=Math.hypot(e.clientX-mDown[0], e.clientY-mDown[1]); mDown=null;
  if(mv>5 || !m2Open || level!=='arena' || pcMode || !SEAT.mesh || window.__svActive) return;
  const hits=pick(e, [SEAT.mesh], false);
  if(hits.length && hits[0].instanceId!=null) selectSeat(hits[0].instanceId, false);
});

/* --- 再描画スロットリング --- */
let pend=false;
function requestDraw(){
  if(pend || !m2Open) return;
  pend=true;
  requestAnimationFrame(()=>{ pend=false; if(m2Open) draw(); });
}
const baseRepaint4=repaintSeats;
repaintSeats=function(){
  baseRepaint4();
  /* FC会員 3D反映（表示レイヤー'fc2d'時に色を上書き） */
  if(seatMode==='fc2d' && SEAT.mesh){
    const C=new THREE.Color();
    SEAT.list.forEach((s,i)=>{
      C.set(isSold(i)?FC_META[FC[i]][1]:'#262b3c');
      SEAT.mesh.setColorAt(i, C);
    });
    SEAT.mesh.instanceColor.needsUpdate=true;
  }
  if(seatMode!=='fc2d') fc3d=false;
  requestDraw();
};
const baseSetLevel4=setLevel;
setLevel=function(lv, fly){
  baseSetLevel4(lv, fly);
  beacon.visible = level==='arena' && m2Open && selSeat>=0;
};

/* --- ヘッダーボタン --- */
const m2Btn=(function(){
  const d=document.createElement('div');
  d.className='crumb'; d.id='map2d-toggle'; d.textContent='🗺 2D席図';
  d.title='2D平面席図: 席種・販売率・FC会員・露出を平面で確認（3Dと双方向連動）';
  document.getElementById('lvl-crumb').appendChild(d);
  return d;
})();
function setM2(open){
  m2Open=open;
  m2.style.display=open?'block':'none';
  m2Btn.classList.toggle('active', open);
  beacon.visible = open && level==='arena' && selSeat>=0;
  if(open) draw();
}
m2Btn.onclick=()=>{
  setM2(!m2Open);
  if(m2Open) toast('2D席図: 席クリックで詳細＋3D連動。FC会員モードで会員構成を確認できます', 3400);
};
document.getElementById('m2-close').onclick=()=> setM2(false);
})();
