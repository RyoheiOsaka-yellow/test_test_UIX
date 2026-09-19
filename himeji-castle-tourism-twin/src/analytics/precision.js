/* ================= Precision Mesh — 5〜250m の高精細メッシュ操作（右パネル）: 参照版 Himeji_Urban_Twin_Precision_1 から移植 ================= */
/* Shared, always available mesh controls. Explicit settings take priority over AI. */
function precisionRes(res,kind=MESH.kind){
  if(window.twinAi)twinAi.user.viz=true;
  if(window.twinDb)twinDb.autoLod=false;
  if(kind==='jis'&&![125,250,500].includes(res))kind='sq';
  if(kind==='jis'&&FLOWVIS.mode==='hex'){FLOWVIS.mode='grid';MESH.style='3d';}
  buildMesh(res,kind);renderPanel();precisionRefresh();
}
function precisionRefresh(){
  const root=document.getElementById('precision-controls');if(!root)return;
  document.querySelectorAll('[data-quick-mode]').forEach(b=>{const on=b.dataset.quickMode===FLOWVIS.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
  document.querySelectorAll('[data-quick-res]').forEach(b=>{const on=+b.dataset.quickRes===MESH.res;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
  const hex=MESH.kind==='hex',db=window.twinDb&&twinDb.on;
  document.getElementById('precision-size').textContent=(hex?'六角形の一辺':'正方形の一辺')+' '+MESH.res+' m';
  document.querySelector('.precision-eyebrow span').textContent=db?'API / '+(DBSRC.source==='synthetic'?'合成データ':DBSRC.source):'SIMULATION / 想定データ';
  const el=document.getElementById('precision-stats');
  el.textContent=MESH.on?`${fmt(MESH.active||0)} セル · ${fmt(MESH.total||0)} 人${db?'（取得範囲）':'（集計範囲・想定）'}`:'グリッド・ヘックス・柱で細かさを調整';
  const legend=document.getElementById('precision-legend');legend.hidden=!MESH.on||level==='wide';
  const max=document.getElementById('precision-max');max.textContent=fmt(MESH.colorMax||0)+' 人/ha 以上';
  document.getElementById('precision-legend-title').textContent=MESH.color==='seg'?'来訪者属性 / 主セグメント':'人口密度 / 人数 ÷ セル面積';
  document.getElementById('precision-density-key').hidden=MESH.color==='seg';
  document.getElementById('precision-seg-key').hidden=MESH.color!=='seg';
  document.getElementById('precision-meta').textContent=`${hex?'HEX':'GRID'} ${MESH.res} m${hex?'（一辺）':''} · ${fmt(MESH.active||0)} cells · ${MESH.lock?'固定色スケール':'95%点基準・対数配色'}`;
  document.getElementById('precision-h-note').textContent=MESH.style==='2d'?'面の色＝人口密度':`高さ＝人数の非線形表示 ×${CONFIG.peopleFlow.heightScale.toFixed(1)}（建物高と比較不可）`;
}
function precisionInit(){
  document.getElementById('precision-mobile-toggle').onclick=()=>document.getElementById('view-settings').click();
  new ResizeObserver(()=>document.documentElement.style.setProperty('--timeline-height',document.getElementById('timeline').offsetHeight+'px')).observe(document.getElementById('timeline'));
  document.querySelectorAll('[data-quick-mode]').forEach(b=>b.onclick=()=>{if(window.twinAi)twinAi.user.viz=true;setFlowMode(b.dataset.quickMode);precisionRefresh();});
  document.querySelectorAll('[data-quick-res]').forEach(b=>b.onclick=()=>{if(!MESH.on)setFlowMode('grid');precisionRes(+b.dataset.quickRes);});
  for(const [id,key,out,suffix] of [['mesh-height','heightScale','mesh-height-value','×'],['mesh-opacity','opacity','mesh-opacity-value','%'],['mesh-gap','gap','mesh-gap-value','%']]){
    document.getElementById(id).oninput=e=>{const v=+e.target.value;if(key==='heightScale')CONFIG.peopleFlow[key]=v;else MESH[key]=v/100;document.getElementById(out).value=key==='heightScale'?'×'+v.toFixed(1):v+'%';MESH.dirty=true;paintMesh();};
  }
  document.getElementById('mesh-lock').onchange=e=>{MESH.lock=e.target.checked;MESH.dirty=true;paintMesh();};
  document.getElementById('precision-focus').onclick=()=>{const c=meshTop(1)[0];if(!c){toast('この時刻には表示対象の人流がありません');return;}flyTo(new THREE.Vector3(c.cx,c.y,c.cz),Math.max(260,MESH.res*14),.82,-.35,800);};
  document.getElementById('precision-export').onclick=()=>{
    const rows=[['cell_id','shape','resolution_m','area_m2','people','people_per_ha','time','source'],...MESH.cells.filter(c=>c.v>0).map(c=>[c.code,MESH.kind,MESH.res,meshArea(c).toFixed(2),c.v,meshDensity(c).toFixed(2),clockStr(timeState.min),c.db?('API:'+DBSRC.source):'synthetic'])];
    const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='himeji_mesh_'+MESH.res+'m_'+clockStr(timeState.min).replace(':','')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  new ResizeObserver(()=>{document.documentElement.style.setProperty('--header-bottom',document.getElementById('hdr').offsetHeight+'px');}).observe(document.getElementById('hdr'));
  precisionRefresh();
}

