/* ================================================================
   ▼ 拡張モジュール3: 🏗 BIM場内ディテール
   階段（客席・3F接続・外周避難）・手すり・構造柱・ボミトリー開口を
   IFC風属性付きで生成。部材クリックで属性カード、レイヤー別表示切替。
   属性値はダミー — IFC/Revit連携で実部材属性へ置換可能。
================================================================ */
(function(){
'use strict';
let bimMode=false;
const bimGroup=new THREE.Group(); bimGroup.visible=false; interior.add(bimGroup);
const ELEMS=[];
const LAYER={stair:true, rail:true, col:true, vom:true};

const stepMat=new THREE.MeshStandardMaterial({color:0x3a4154, roughness:0.85});
const postMat=new THREE.MeshStandardMaterial({color:0x9aa2b8, roughness:0.55, metalness:0.55});
const railMat=new THREE.MeshStandardMaterial({color:0xf5c400, roughness:0.5, metalness:0.3});
const colMat =new THREE.MeshStandardMaterial({color:0x2c3140, roughness:0.8, metalness:0.2});
const frameMat=new THREE.MeshStandardMaterial({color:0x262c3d, roughness:0.8});
const voidMat=new THREE.MeshStandardMaterial({color:0x05070c, roughness:1});

const stepXf=[], stepOwner=[];
const postXf=[], postOwner=[];
const railMeshes=[];
const colGroup=new THREE.Group(), vomGroup=new THREE.Group();
bimGroup.add(colGroup, vomGroup);

function addElem(e){ ELEMS.push(e); return ELEMS.length-1; }

/* 段板生成（下端→上端、ry=進行方向） */
function rawFlight(idx, x0,z0,y0, x1,z1,y1, w, n){
  const dx=x1-x0, dz=z1-z0, run=Math.hypot(dx,dz), ry=Math.atan2(dx,dz);
  for(let k=0;k<n;k++){
    const t=(k+0.5)/n, topY=y0+(y1-y0)*(k+1)/n, base=Math.min(y0,y1)-0.22;
    stepXf.push({x:x0+dx*t, y:(base+topY)/2, z:z0+dz*t, sx:w, sy:topY-base, sz:run/n+0.02, ry});
    stepOwner.push(idx);
  }
}
/* 手すり1本（笠木＋支柱4本） */
function addRail(idx, ax,az,ay, bx,bz,by){
  for(let k=0;k<=3;k++){
    const t=k/3;
    postXf.push({x:ax+(bx-ax)*t, y:ay+(by-ay)*t+0.55, z:az+(bz-az)*t, sy:1.1});
    postOwner.push(idx);
  }
  const a=new THREE.Vector3(ax,ay+1.1,az), b=new THREE.Vector3(bx,by+1.1,bz);
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1), railMat);
  m.scale.set(a.distanceTo(b), 0.07, 0.07);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), b.clone().sub(a).normalize());
  m.userData.bimIdx=idx;
  railMeshes.push(m); bimGroup.add(m);
}
/* 直階段（段板＋両側手すり） */
function stairFlight(id, name, storey, x0,z0,y0, x1,z1,y1, w, n){
  const run=Math.hypot(x1-x0,z1-z0);
  const idx=addElem({id, ifc:'IfcStair', name, storey, cat:'stair', nSteps:n,
    material:'PC段板 + 鋼製ささら桁',
    dims:'W'+w.toFixed(2)+'m × '+n+'段（R'+Math.round((y1-y0)/n*1000)+' / T'+Math.round(run/n*1000)+'）'});
  rawFlight(idx, x0,z0,y0, x1,z1,y1, w, n);
  const rid=addElem({id:id+'-R', ifc:'IfcRailing', name:name+' 手すり', storey, cat:'rail',
    material:'スチール φ42.7 粉体塗装', dims:'H1.10m × 2本 / 延長'+(run*2).toFixed(1)+'m', len:run*2});
  const dx=x1-x0, dz=z1-z0, L=run||1, px=-dz/L, pz=dx/L;   /* 幅方向単位ベクトル */
  [-1,1].forEach(sg=>{
    const ox=px*sg*(w/2+0.07), oz=pz*sg*(w/2+0.07);
    addRail(rid, x0+ox,z0+oz,y0, x1+ox,z1+oz,y1);
  });
  return idx;
}

/* --- 2F客席 コーナー階段（4基・コーナー空きスペースに配置） --- */
[[-1,-1,'北西'],[1,-1,'北東'],[-1,1,'南西'],[1,1,'南東']].forEach((c,ci)=>{
  stairFlight('ST-2C-'+(ci+1), '2F客席コーナー階段 '+c[2], '2F',
    c[0]*21.3, c[1]*27.3, 3.9,  c[0]*26.7, c[1]*32.7, 7.2, 1.3, 16);
});
/* --- 1F可動スタンド端部階段（4基） --- */
[[-1,-1],[-1,1],[1,-1],[1,1]].forEach((c,ci)=>{
  stairFlight('ST-1R-'+(ci+1), '1F可動スタンド階段 '+(c[0]<0?'西':'東')+(c[1]<0?'北':'南'), '1F',
    c[0]*13.8, c[1]*18.8, 0.2,  c[0]*18.6, c[1]*18.8, 2.6, 1.1, 10);
});
/* --- 2Fコンコース → 3F 接続階段（4基） --- */
[[-1,-1],[-1,1],[1,-1],[1,1]].forEach((c,ci)=>{
  stairFlight('ST-3F-'+(ci+1), '3F接続階段 '+(c[0]<0?'西':'東')+(c[1]<0?'北':'南'), '2F→3F',
    c[0]*30.6, c[1]*23.0, 7.2,  c[0]*30.6, c[1]*20.6, 8.55, 1.2, 6);
});
/* --- 外周避難階段タワー（4基・折返し2フライト＋踊場） --- */
[[-1,-1],[1,-1],[-1,1],[1,1]].forEach((c,ci)=>{
  const sx=c[0], sz=c[1], nm=(sz<0?'北':'南')+(sx<0?'西':'東');
  const tid=addElem({id:'ST-EX-'+(ci+1), ifc:'IfcStair', name:'外周避難階段 '+nm, storey:'1F→2Fコンコース',
    cat:'stair', nSteps:25, material:'鉄骨階段（屋内避難経路）', dims:'W1.20m × 24段+踊場 R300/T317', fire:'避難安全検証対象'});
  rawFlight(tid, sx*29.3, sz*34.7, 0,   sx*29.3, sz*38.5, 3.6, 1.2, 12);
  stepXf.push({x:sx*30.0, y:3.49, z:sz*39.3, sx:2.7, sy:0.22, sz:1.5, ry:0}); stepOwner.push(tid);
  rawFlight(tid, sx*30.7, sz*38.5, 3.6, sx*30.7, sz*34.7, 7.2, 1.2, 12);
  const rid=addElem({id:'ST-EX-'+(ci+1)+'-R', ifc:'IfcRailing', name:'外周避難階段 '+nm+' 手すり', storey:'1F→2F',
    cat:'rail', material:'スチール フラットバー', dims:'H1.10m / 延長11.2m', len:11.2});
  addRail(rid, sx*28.6, sz*34.7, 0,   sx*28.6, sz*38.5, 3.6);
  addRail(rid, sx*31.4, sz*38.5, 3.6, sx*31.4, sz*34.7, 7.2);
});

/* --- 構造柱 --- */
const cid1=addElem({id:'COL-2F', ifc:'IfcColumn', name:'2Fスラブ支持柱（RC）', storey:'1F', cat:'col',
  material:'RC φ600 Fc36', n:16, dims:'φ0.60m × H3.3m × 16本'});
const colGeo=new THREE.CylinderGeometry(0.3,0.3,3.3,10);
[[-28.3,-28],[-28.3,-14],[-28.3,0],[-28.3,14],[-28.3,28],[28.3,-28],[28.3,-14],[28.3,0],[28.3,14],[28.3,28],
 [-13,-34.6],[0,-34.6],[13,-34.6],[-13,34.6],[0,34.6],[13,34.6]].forEach(p=>{
  const m=new THREE.Mesh(colGeo, colMat);
  m.position.set(p[0],1.65,p[1]); m.userData.bimIdx=cid1;
  colGroup.add(m);
});
const cid2=addElem({id:'COL-RF', ifc:'IfcColumn', name:'屋根トラス支持柱（S造）', storey:'1F→RF', cat:'col',
  material:'S造 BOX-500×500×22', n:4, dims:'□0.50m × H15.9m × 4本'});
[[-23.8,-22],[23.8,-22],[-23.8,22],[23.8,22]].forEach(p=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,15.9,0.5), colMat);
  m.position.set(p[0],7.95,p[1]); m.userData.bimIdx=cid2;
  colGroup.add(m);
});

/* --- 3F転落防止手すり --- */
const gid=addElem({id:'RL-3F', ifc:'IfcRailing', name:'3F転落防止手すり', storey:'3F', cat:'rail',
  material:'アルミ支柱 + 合わせガラス', dims:'H1.10m × L41m × 2面', len:82});
[-1,1].forEach(sg=>{
  for(let z=-20; z<=20; z+=1.6){ postXf.push({x:sg*28.75, y:8.9, z, sy:1.1}); postOwner.push(gid); }
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,41.2), railMat);
  m.position.set(sg*28.75, 9.47, 0); m.userData.bimIdx=gid;
  railMeshes.push(m); bimGroup.add(m);
});

/* --- ボミトリー開口（コンコース→客席 7箇所・既存人流の降下位置と一致） --- */
VOM_FRACS.forEach((f,i)=>{
  const p=RING.at(f*RING.tot);
  const vid=addElem({id:'VOM-'+(i+1), ifc:'IfcOpeningElement', name:'ボミトリー開口 V'+(i+1), storey:'2Fコンコース',
    cat:'vom', material:'RC開口 + スチール方立', dims:'W2.40m × H2.20m'});
  const g=new THREE.Group();
  g.position.set(p[0]*1.06, 7.2, p[1]*1.06);
  g.lookAt(new THREE.Vector3(0,7.2,0));
  [[-1.35,1.15,0.3,2.3],[1.35,1.15,0.3,2.3]].forEach(j=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(j[2],j[3],0.35), frameMat);
    m.position.set(j[0],j[1],0); g.add(m);
  });
  const lin=new THREE.Mesh(new THREE.BoxGeometry(3.0,0.4,0.35), frameMat);
  lin.position.set(0,2.4,0); g.add(lin);
  const vd=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.2,0.12), voidMat);
  vd.position.set(0,1.1,0.06); g.add(vd);
  g.traverse(o=>{ o.userData.bimIdx=vid; });
  vomGroup.add(g);
});

/* --- インスタンス化 --- */
const M4=new THREE.Matrix4(), Q4=new THREE.Quaternion(), P4=new THREE.Vector3(), S4=new THREE.Vector3(), E4=new THREE.Euler();
const stepInst=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), stepMat, stepXf.length);
stepXf.forEach((s,i)=>{
  E4.set(0,s.ry,0); Q4.setFromEuler(E4); P4.set(s.x,s.y,s.z); S4.set(s.sx,s.sy,s.sz);
  M4.compose(P4,Q4,S4); stepInst.setMatrixAt(i,M4);
});
bimGroup.add(stepInst);
const postInst=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035,0.035,1,6), postMat, postXf.length);
postXf.forEach((s,i)=>{
  E4.set(0,0,0); Q4.setFromEuler(E4); P4.set(s.x,s.y,s.z); S4.set(1,s.sy,1);
  M4.compose(P4,Q4,S4); postInst.setMatrixAt(i,M4);
});
bimGroup.add(postInst);

/* --- 数量集計 --- */
const QTY=(function(){
  const st=ELEMS.filter(e=>e.cat==='stair');
  const rl=ELEMS.filter(e=>e.cat==='rail');
  return {
    stairN: st.length, stepN: st.reduce((s,e)=>s+(e.nSteps||0),0),
    railN: rl.length, railL: rl.reduce((s,e)=>s+(e.len||0),0),
    colN: 20, vomN: VOM_FRACS.length,
  };
})();

/* --- レイヤー適用 --- */
function applyBimLayers(){
  stepInst.visible=LAYER.stair;
  postInst.visible=LAYER.rail;
  railMeshes.forEach(m=>{ m.visible=LAYER.rail; });
  colGroup.visible=LAYER.col;
  vomGroup.visible=LAYER.vom;
}

/* --- 属性カード --- */
const bimCard=document.createElement('div'); bimCard.id='bim-card'; document.body.appendChild(bimCard);
function showBimCard(idx){
  const e=ELEMS[idx];
  const row=(k,v)=>'<div class="bim-row"><span>'+k+'</span><b>'+v+'</b></div>';
  bimCard.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
   +'<div style="font-weight:700;color:#3ddc84;font-size:13px">🏗 '+e.name+'</div>'
   +'<button id="bim-x" style="border:1px solid var(--line);background:var(--panel2);color:var(--sub);border-radius:6px;width:22px;height:22px;cursor:pointer">✕</button></div>'
   +row('部材ID', e.id)
   +row('IFCクラス', e.ifc)
   +row('階・区画', e.storey)
   +row('材質・仕様', e.material)
   +row('寸法', e.dims)
   +(e.fire?row('防災区分', e.fire):'')
   +row('点検記録', '2026-02 目視良好（ダミー）')
   +'<div class="hint" style="margin-top:8px">属性はダミー値。IFC / Revitモデル連携で実部材属性（部材符号・強度・点検履歴）に置換可能です。</div>';
  bimCard.style.display='block';
  const tkc=document.getElementById('ticket-card'); if(tkc) tkc.style.display='none';
  document.getElementById('bim-x').onclick=()=> bimCard.style.display='none';
}

/* --- クリック（座席より手前のBIM部材を優先） --- */
let bDown=null;
el.addEventListener('pointerdown', e=>{ bDown=[e.clientX,e.clientY]; });
el.addEventListener('pointerup', e=>{
  if(!bDown) return;
  const mv=Math.hypot(e.clientX-bDown[0], e.clientY-bDown[1]); bDown=null;
  if(mv>5 || !bimMode || level!=='arena' || pcMode) return;
  const hits=pick(e, [bimGroup], true);
  if(!hits.length) return;
  const seatHits=SEAT.mesh ? pick(e, [SEAT.mesh], false) : [];
  if(seatHits.length && seatHits[0].distance < hits[0].distance) return;   /* 座席が手前 → チケットカード側 */
  const o=hits[0].object;
  let idx=null;
  if(o===stepInst && hits[0].instanceId!=null) idx=stepOwner[hits[0].instanceId];
  else if(o===postInst && hits[0].instanceId!=null) idx=postOwner[hits[0].instanceId];
  else { let cur=o; while(cur && cur.userData.bimIdx==null) cur=cur.parent; if(cur) idx=cur.userData.bimIdx; }
  if(idx!=null) showBimCard(idx);
});

/* --- ヘッダーボタン --- */
const bimBtn=(function(){
  const d=document.createElement('div');
  d.className='crumb'; d.id='bim-toggle'; d.textContent='🏗 BIM詳細';
  d.title='場内BIMディテール: 階段・手すり・柱・開口部（IFC風属性）';
  document.getElementById('lvl-crumb').appendChild(d);
  return d;
})();
function applyBimVis(){
  bimGroup.visible = bimMode && level==='arena';
  bimBtn.classList.toggle('active', bimMode);
  if(!bimGroup.visible) bimCard.style.display='none';
}
const baseSetLevel3=setLevel;
setLevel=function(lv, fly){ baseSetLevel3(lv, fly); applyBimVis(); };

function bimPanelHTML(){
  const ch=(k,l)=>'<button class="chip '+(LAYER[k]?'active':'')+'" data-bl="'+k+'">'+l+'</button>';
  return '<div class="sec" id="bim-sec"><div class="sec-t"><b>🏗 BIM</b> 場内ディテール — 部材レイヤー</div>'
   +'<div class="row-btns" style="margin-bottom:7px">'
   +ch('stair','階段')+ch('rail','手すり')+ch('col','構造柱')+ch('vom','開口部')+'</div>'
   +'<div class="kpi-grid">'
   +'<div class="kpi"><div class="v">'+QTY.stairN+'<small> 基</small></div><div class="l">階段（総'+QTY.stepN+'段）</div></div>'
   +'<div class="kpi"><div class="v">'+Math.round(QTY.railL)+'<small> m</small></div><div class="l">手すり延長（'+QTY.railN+'系統）</div></div>'
   +'<div class="kpi"><div class="v">'+QTY.colN+'<small> 本</small></div><div class="l">構造柱（RC16+S造4）</div></div>'
   +'<div class="kpi"><div class="v">'+QTY.vomN+'<small> 箇所</small></div><div class="l">ボミトリー開口</div></div>'
   +'</div>'
   +'<div class="hint" style="margin-top:7px">部材クリックで<b>IFC風属性カード</b>（部材ID・材質・寸法・点検記録）。避難階段は場内人流のボミトリー降下位置と整合。属性はダミー、IFC/Revit連携で実データ化できます。</div></div>';
}
function bindBimPanel(){
  const sec=document.getElementById('bim-sec');
  if(!sec) return;
  sec.querySelectorAll('[data-bl]').forEach(b=> b.onclick=()=>{
    LAYER[b.dataset.bl]=!LAYER[b.dataset.bl];
    b.classList.toggle('active');
    applyBimLayers();
  });
}
const baseRenderPanel3=renderPanel;
renderPanel=function(){
  baseRenderPanel3();
  if(bimMode && level==='arena'){ pb.insertAdjacentHTML('afterbegin', bimPanelHTML()); bindBimPanel(); }
};

bimBtn.onclick=()=>{
  bimMode=!bimMode;
  if(bimMode && level!=='arena') setLevel('arena', true);
  applyBimVis(); renderPanel();
  if(bimMode) toast('BIM詳細: 階段・手すり・柱・開口部を表示（部材クリックで属性カード）', 3200);
};

applyBimLayers();
applyBimVis();
})();
