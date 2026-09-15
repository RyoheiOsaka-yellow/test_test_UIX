
/* ───────── tree ───────── */
const ICONS={eye:'<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',eyeOff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 21 12a10 10 0 0 1-2 3M6.6 6.6A10 10 0 0 0 3 12a10 10 0 0 0 11 6.9"/></svg>',chev:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',chevD:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'};
function renderTree(){
  const el=$('#tree');const f=state.filter.toLowerCase();let html='';const rootCol=state.collapsed.has('root');
  html+=`<div class="tnode" data-node="root" style="padding-left:4px"><span class="tw" data-toggle="root">${rootCol?ICONS.chev:ICONS.chevD}</span><span class="ic grp" style="background:var(--accent)"></span><span class="lbl"><b>${PRODUCT.assy}</b><small>(${PRODUCT.assyInst})</small></span></div><div class="tchildren ${rootCol?'collapsed':''}">`;
  for(const g of GROUPS){
    const col=state.collapsed.has(g.id);const members=PART_DEFS.filter(d=>d.group===g.id);
    const allHidden=members.every(d=>state.hidden.has(d.id));const gm=members.reduce((s,d)=>s+parts.get(d.id).mass,0);
    html+=`<div class="tnode ${allHidden?'hidden-part':''}" data-node="${g.id}" style="padding-left:20px"><span class="tw" data-toggle="${g.id}">${col?ICONS.chev:ICONS.chevD}</span><span class="ic grp" style="background:${g.color}"></span><span class="lbl">${g.name}<small>(${g.id}.1 · ${fmt(gm,0)} g)</small></span><button class="eye" data-eyeg="${g.id}" title="サブAssyの表示切替">${allHidden?ICONS.eyeOff:ICONS.eye}</button></div><div class="tchildren ${col?'collapsed':''}">`;
    for(const d of members){const rt=parts.get(d.id);const hid=state.hidden.has(d.id),sel=state.selection.has(d.id);
      const match=f&&(rt.state.name.toLowerCase().includes(f)||d.en.toLowerCase().includes(f)||d.id.toLowerCase().includes(f));if(f&&!match)continue;
      html+=`<div class="tnode ${sel?'selected':''} ${hid?'hidden-part':''} ${match?'match':''}" data-part="${d.id}" style="padding-left:40px" title="${d.en}"><span class="tw"></span><span class="ic" style="background:${displayColor(rt)}"></span><span class="lbl">${rt.state.name}<small>${d.id}${rt.state.qty>1?' ×'+rt.state.qty:''}</small></span><button class="eye" data-eye="${d.id}" title="表示/非表示">${hid?ICONS.eyeOff:ICONS.eye}</button></div>`;}
    html+='</div>';
  }
  html+='</div>';el.innerHTML=html;
  $('#treeCount').textContent=`${PART_DEFS.length} 品番 / ${GROUPS.length} Assy${state.hidden.size?` · 非表示 ${state.hidden.size}`:''}`;
}
$('#tree').addEventListener('click',e=>{
  const tg=e.target.closest('[data-toggle]');if(tg){const k=tg.dataset.toggle;state.collapsed.has(k)?state.collapsed.delete(k):state.collapsed.add(k);renderTree();return;}
  const eye=e.target.closest('[data-eye]');if(eye){const id=eye.dataset.eye;state.hidden.has(id)?state.hidden.delete(id):state.hidden.add(id);applyMaterials();applyExplode();renderTree();renderBom();return;}
  const eyeg=e.target.closest('[data-eyeg]');if(eyeg){const ids=partsIn(d=>d.group===eyeg.dataset.eyeg);const all=ids.every(i=>state.hidden.has(i));ids.forEach(i=>all?state.hidden.delete(i):state.hidden.add(i));applyMaterials();applyExplode();renderTree();renderBom();return;}
  const pn=e.target.closest('[data-part]');if(pn){select([pn.dataset.part],e.ctrlKey||e.metaKey);return;}
  const gn=e.target.closest('[data-node]');if(gn&&gn.dataset.node!=='root'){select(partsIn(d=>d.group===gn.dataset.node),e.ctrlKey||e.metaKey);return;}
  if(gn)select(PART_DEFS.map(d=>d.id));
});
$('#tree').addEventListener('dblclick',e=>{const pn=e.target.closest('[data-part]');if(pn){select([pn.dataset.part]);fitBox(new THREE.Box3().setFromObject(parts.get(pn.dataset.part).group));}});
$('#expandAll').onclick=()=>{state.collapsed.clear();renderTree();};
$('#collapseAll').onclick=()=>{GROUPS.forEach(g=>state.collapsed.add(g.id));renderTree();};
$('#search').addEventListener('input',e=>{state.filter=e.target.value.trim();if(state.filter)state.collapsed.clear();renderTree();});

/* ───────── properties ───────── */
const dimStr=b=>{if(!b||b.isEmpty())return '—';const s=b.getSize(V3());return `${fmt(s.x,1)} × ${fmt(s.y,1)} × ${fmt(s.z,1)} mm`;};
const vecStr=v=>`(${fmt(v.x,0)}, ${fmt(v.y,0)}, ${fmt(v.z,0)})`;
function renderProps(){
  const el=$('#props');const sel=[...state.selection];
  if(sel.length===0){const deg=r=>fmt(THREE.MathUtils.radToDeg(r),0);
    el.innerHTML=`<div class="psec"><h4>シーンプロパティ</h4>
      <div class="prow"><span class="k">アップベクトル</span><span class="v">Y</span></div>
      <div class="prow"><span class="k">垂直 / 水平角</span><span class="v">${deg(Math.PI/2-orbit.phi)}° / ${deg(orbit.theta)}°</span></div>
      <div class="prow"><span class="k">視距離</span><span class="v">${fmt(orbit.radius,0)} mm</span></div>
      <div class="prow"><span class="k">投影</span><span class="v">${state.persp?'透視 (35°)':'平行 (6°)'}</span></div></div>
      <div class="psec"><h4>アセンブリ</h4>
      <div class="prow"><span class="k">部品点数</span><span class="v">${PART_DEFS.reduce((s,d)=>s+parts.get(d.id).state.qty,0)} 個 / ${PART_DEFS.length} 品番</span></div>
      <div class="prow"><span class="k">総質量</span><span class="v">${fmt(state.totalMass,1)} g</span></div>
      <div class="prow"><span class="k">外形 X×Y×Z</span><span class="v">${dimStr(state.assyBox)}</span></div>
      <div class="prow"><span class="k">自製 / 購入</span><span class="v">${PART_DEFS.filter(d=>parts.get(d.id).state.mb==='make').length} / ${PART_DEFS.filter(d=>parts.get(d.id).state.mb==='buy').length}</span></div>
      <div class="prow"><span class="k">分解工程</span><span class="v">${currentStep()} / ${N_STEPS}</span></div></div>
      <div class="pempty">ビューポートまたは構造ツリーで部品を選択すると、材質・色・Make/Buy・分解順序を編集できます。<br><kbd>Ctrl</kbd>+クリックで複数選択。</div>`;return;}
  if(sel.length>1){const rts=sel.map(id=>parts.get(id));const mass=rts.reduce((s,r)=>s+r.mass,0);
    el.innerHTML=`<div class="psec"><h4>複数選択 · ${sel.length} 部品</h4>
      <div class="prow"><span class="k">合計質量</span><span class="v">${fmt(mass,1)} g (${fmt(mass/state.totalMass*100,0)} %)</span></div>
      <div class="prow"><span class="k">外形</span><span class="v">${dimStr(visibleBox(state.selection))}</span></div></div>
      <div class="psec"><h4>一括編集</h4>
      <div class="prow"><label for="mMb">Make / Buy</label><select id="mMb"><option value="">— 変更なし —</option><option value="make">Make (自製)</option><option value="buy">Buy (購入)</option></select></div>
      <div class="prow"><label for="mOp">不透明度</label><span class="inl"><input type="range" id="mOp" min="0.05" max="1" step="0.05" value="1"><output>100%</output></span></div></div>
      <div class="psec"><h4>内訳</h4>${rts.map(r=>`<div class="prow"><span class="k">${r.def.id}</span><span class="v">${r.state.name} · ${fmt(r.mass,1)} g</span></div>`).join('')}</div>`;
    $('#mMb').onchange=e=>{if(!e.target.value)return;rts.forEach(r=>r.state.mb=e.target.value);applyMaterials();renderBom();renderTree();log(`${sel.length} 部品の Make/Buy を ${e.target.value} に変更`);};
    $('#mOp').oninput=e=>{rts.forEach(r=>r.state.opacity=+e.target.value);e.target.nextElementSibling.textContent=Math.round(e.target.value*100)+'%';applyMaterials();};return;}
  const rt=parts.get(sel[0]),d=rt.def,s=rt.state,g=GROUPS.find(x=>x.id===d.group),bx=rt.box.getSize(V3());
  el.innerHTML=`<div class="psec"><h4><span class="sw" style="background:${displayColor(rt)}"></span>${d.id} · ${d.en}</h4>
    <div class="prow"><label for="pName">名称</label><input type="text" id="pName" value="${s.name}"></div>
    <div class="prow"><span class="k">サブAssy</span><span class="v" style="font-family:var(--sans)"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${g.color};margin-right:6px"></span>${g.name}</span></div>
    <div class="prow"><label for="pMat">材質</label><select id="pMat">${Object.keys(MATERIALS).map(m=>`<option ${m===s.mat?'selected':''}>${m}</option>`).join('')}</select></div>
    <div class="prow"><span class="k">密度</span><span class="v">${fmt(MATERIALS[s.mat].d,2)} g/cm³ · ${CLASS_JP[MATERIALS[s.mat].cls]}</span></div>
    <div class="prow"><label for="pMb">Make / Buy</label><select id="pMb"><option value="make" ${s.mb==='make'?'selected':''}>Make (自製)</option><option value="buy" ${s.mb==='buy'?'selected':''}>Buy (購入)</option></select></div>
    <div class="prow"><label for="pQty">数量</label><input type="number" id="pQty" min="1" max="99" value="${s.qty}"></div></div>
    <div class="psec"><h4>分解手順</h4>
    <div class="prow"><label for="pSeq">工程番号</label><input type="number" id="pSeq" min="1" max="${N_STEPS}" value="${s.seq}"></div>
    <div class="prow"><label for="pTool">工具</label><input type="text" id="pTool" value="${s.tool}"></div>
    <div class="prow"><span class="k">分解ベクトル</span><span class="v">${vecStr(repVec(rt))} mm</span></div></div>
    <div class="psec"><h4>表示</h4>
    <div class="prow"><label for="pColor">色</label><span class="inl"><input type="color" id="pColor" value="${s.color}"><span class="v">${s.color}</span>${state.colorMode!=='material'?'<span style="color:var(--faint);font-size:11px">カラーコード表示中</span>':''}</span></div>
    <div class="prow"><label for="pOp">不透明度</label><span class="inl"><input type="range" id="pOp" min="0.05" max="1" step="0.05" value="${s.opacity}"><output>${Math.round(s.opacity*100)}%</output></span></div>
    <div class="prow"><label for="pVis">表示</label><input type="checkbox" id="pVis" ${state.hidden.has(d.id)?'':'checked'} style="justify-self:start;accent-color:var(--accent)"></div></div>
    <div class="psec"><h4>質量特性 (計算値)</h4>
    <div class="prow"><span class="k">体積</span><span class="v">${fmt(rt.vol/1000,2)} cm³</span></div>
    <div class="prow"><span class="k">質量</span><span class="v">${fmt(rt.mass,1)} g${s.qty>1?` (${fmt(rt.mass/s.qty,1)} g × ${s.qty})`:''}</span></div>
    <div class="prow"><span class="k">外形 X×Y×Z</span><span class="v">${fmt(bx.x,1)} × ${fmt(bx.y,1)} × ${fmt(bx.z,1)}</span></div>
    <div class="prow"><span class="k">重心 (組立時)</span><span class="v">${fmt(rt.centroid.x,1)}, ${fmt(rt.centroid.y,1)}, ${fmt(rt.centroid.z,1)}</span></div></div>`;
  $('#pName').onchange=e=>{s.name=e.target.value||d.name;renderTree();renderBom();renderSteps();};
  $('#pMat').onchange=e=>{s.mat=e.target.value;updateMass();applyMaterials();renderProps();renderBom();renderTree();renderMeasure();renderParam();log(`${d.id} 材質 → ${s.mat}`);};
  $('#pMb').onchange=e=>{s.mb=e.target.value;applyMaterials();renderBom();renderTree();};
  $('#pQty').onchange=e=>{s.qty=Math.max(1,+e.target.value|0);updateMass();renderProps();renderBom();renderTree();renderMeasure();renderParam();};
  $('#pSeq').onchange=e=>{const v=clamp(+e.target.value|0,1,N_STEPS);const other=[...parts.values()].find(r=>r!==rt&&r.state.seq===v);if(other)other.state.seq=s.seq;s.seq=v;applyExplode();renderSteps();renderProps();log(`${d.id} 工程番号 → ${v}`);};
  $('#pTool').onchange=e=>{s.tool=e.target.value;renderSteps();};
  $('#pColor').oninput=e=>{s.color=e.target.value;e.target.nextElementSibling.textContent=s.color;applyMaterials();renderTree();renderBom();};
  $('#pOp').oninput=e=>{s.opacity=+e.target.value;e.target.nextElementSibling.textContent=Math.round(s.opacity*100)+'%';applyMaterials();};
  $('#pVis').onchange=e=>{e.target.checked?state.hidden.delete(d.id):state.hidden.add(d.id);applyMaterials();applyExplode();renderTree();renderBom();};
}

/* ───────── parametric ───────── */
let rebuildTimer=null;
function computeResults(){const gm={};for(const g of GROUPS)gm[g.id]=PART_DEFS.filter(d=>d.group===g.id).reduce((t,d)=>t+parts.get(d.id).mass,0);return PRODUCT.results(state.ctx,state.assyBox||new THREE.Box3(),gm,state.totalMass);}
function renderParam(){
  const el=$('#param');const p=state.params;const res=computeResults();
  el.innerHTML=`<div class="psec"><h4>設計パラメータ</h4>${PARAM_DEFS.map(pd=>`<div class="param"><div class="t"><span>${pd.label}<small>${pd.k}</small></span><output>${fmt(p[pd.k],pd.step<1?1:0)} ${pd.unit}</output></div><input type="range" data-param="${pd.k}" min="${pd.min}" max="${pd.max}" step="${pd.step}" value="${p[pd.k]}" aria-label="${pd.label}"></div>`).join('')}</div>
    <div class="psec"><h4>目標と計算結果</h4><table class="targets"><thead><tr><th>項目</th><th>計算値</th><th>目標</th><th></th></tr></thead><tbody>
    ${TARGETS.map(t=>{const v=res[t.k];const ok=v<=t.target;return `<tr><td>${t.label}</td><td>${fmt(v,t.unit==='g'?0:1)} ${t.unit}</td><td>${t.op} ${t.target} ${t.unit}</td><td><span class="stat ${ok?'ok':'bad'}"><i></i>${ok?'OK':'NG'}</span></td></tr>`;}).join('')}</tbody></table></div>
    <div class="psec"><h4>質量内訳 (サブAssy)</h4>${GROUPS.map(g=>{const m=PART_DEFS.filter(d=>d.group===g.id).reduce((s,d)=>s+parts.get(d.id).mass,0);return `<div class="prow"><span class="k"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${g.color};margin-right:6px"></span>${g.id}</span><span class="v">${fmt(m,0)} g<div class="bar"><i style="width:${m/state.totalMass*100}%;background:${g.color}"></i></div></span></div>`;}).join('')}</div>`;
  el.querySelectorAll('[data-param]').forEach(inp=>{inp.oninput=e=>{const k=e.target.dataset.param,pd=PARAM_DEFS.find(x=>x.k===k);p[k]=+e.target.value;e.target.previousElementSibling.querySelector('output').textContent=`${fmt(p[k],pd.step<1?1:0)} ${pd.unit}`;
    if(k==='ledHue'){applyMaterials();return;}clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>{buildModel();renderAll();log(`パラメータ ${k} = ${p[k]} → モデル再生成`);},60);};});
}

/* ───────── BOM / steps / measure ───────── */
function renderBom(){
  const rows=PART_DEFS.map((d,i)=>{const rt=parts.get(d.id),s=rt.state;const g=GROUPS.find(x=>x.id===d.group);
    return `<tr class="${state.selection.has(d.id)?'sel':''}" data-bom="${d.id}"><td class="n">${i+1}</td><td class="pn">${d.id}</td><td><span class="sw" style="background:${displayColor(rt)}"></span>${s.name}</td><td class="dim">${d.en}</td><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${g.color};margin-right:5px"></span>${g.id}</td><td>${s.mat}</td><td class="n">${s.qty}</td><td class="n">${fmt(rt.vol/1000,2)}</td><td class="n">${fmt(rt.mass,1)}</td><td><span class="mb ${s.mb}">${s.mb.toUpperCase()}</span></td><td class="n">${s.seq}</td><td>${state.hidden.has(d.id)?'<span style="color:var(--faint)">非表示</span>':'表示'}</td></tr>`;}).join('');
  $('#bom').innerHTML=`<thead><tr><th class="n">#</th><th>部品番号</th><th>名称</th><th>English</th><th>Assy</th><th>材質</th><th class="n">数量</th><th class="n">体積 cm³</th><th class="n">質量 g</th><th>Make/Buy</th><th class="n">工程</th><th>状態</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="6">合計 · ${PART_DEFS.length} 品番</td><td class="n">${PART_DEFS.reduce((s,d)=>s+parts.get(d.id).state.qty,0)}</td><td class="n">${fmt([...parts.values()].reduce((s,r)=>s+r.vol*r.state.qty,0)/1000,1)}</td><td class="n">${fmt(state.totalMass,1)}</td><td colspan="3"></td></tr></tfoot>`;
}
$('#bom').addEventListener('click',e=>{const tr=e.target.closest('[data-bom]');if(tr)select([tr.dataset.bom],e.ctrlKey||e.metaKey);});
$('#bom').addEventListener('dblclick',e=>{const tr=e.target.closest('[data-bom]');if(tr){select([tr.dataset.bom]);fitBox(new THREE.Box3().setFromObject(parts.get(tr.dataset.bom).group));}});
function dirText(v){const ax=[['X',v.x],['Y',v.y],['Z',v.z]].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));const m=ax[0];const dom=Math.abs(m[1])/v.length();return `${dom>0.92?'':'斜め '}${m[1]>=0?'+':'−'}${m[0]} 方向 · ${fmt(v.length(),0)} mm`;}
function renderSteps(){
  const el=$('#steps');const t=state.explode/100;
  el.innerHTML=seqSorted().map((rt,i)=>{const k=partT(rt,t);const cls=k>=0.999?'done':k>0?'active':'';const sel=state.selection.has(rt.def.id);
    return `<div class="step ${cls} ${sel?'selected':''}" data-step="${i+1}" data-pid="${rt.def.id}"><span class="num">${i+1}</span><span><b style="font-weight:500">${rt.state.name}</b> <small style="color:var(--faint);font-family:var(--mono)">${rt.def.id}${rt.state.qty>1?' ×'+rt.state.qty:''}</small><div class="d">${dirText(repVec(rt))}${rt.def.shell?' · 外装':''}</div></span><span class="tool">${rt.state.tool}</span></div>`;}).join('');
}
function highlightSteps(){const t=state.explode/100;const rows=$('#steps').children;const order=seqSorted();for(let i=0;i<rows.length;i++){const k=partT(order[i],t);rows[i].classList.toggle('done',k>=0.999);rows[i].classList.toggle('active',k>0&&k<0.999);}}
$('#steps').addEventListener('click',e=>{const s=e.target.closest('[data-step]');if(!s)return;select([s.dataset.pid]);animateExplode(stepTarget(+s.dataset.step));});
function renderMeasure(){
  const el=$('#measure');const ids=state.selection.size?state.selection:new Set(PART_DEFS.map(d=>d.id));const rts=[...ids].map(i=>parts.get(i));
  const mass=rts.reduce((s,r)=>s+r.mass,0),vol=rts.reduce((s,r)=>s+r.vol*r.state.qty,0);
  const cg=V3();rts.forEach(r=>cg.add(r.centroid.clone().multiplyScalar(r.mass)));if(mass>0)cg.divideScalar(mass);
  const box=new THREE.Box3();rts.forEach(r=>box.union(r.box));const sz=box.getSize(V3()),mn=box.min,mx=box.max;
  const title=state.selection.size?`選択 ${rts.length} 部品`:'アセンブリ全体';let extra='';
  if(rts.length===2){const dv=rts[1].centroid.clone().sub(rts[0].centroid);extra=`<div class="mcard"><h5>重心間距離 · ${rts[0].def.id} ↔ ${rts[1].def.id}</h5><div class="big">${fmt(dv.length(),2)}<small>mm</small></div><div class="kv"><span>ΔX</span><b>${fmt(dv.x,2)}</b><span>ΔY</span><b>${fmt(dv.y,2)}</b><span>ΔZ</span><b>${fmt(dv.z,2)}</b></div></div>`;}
  if(state.clashes.length)extra+=`<div class="mcard"><h5>干渉チェック結果</h5><div class="big" style="color:var(--bad)">${state.clashes.length}<small>ペア</small></div><div class="kv">${state.clashes.slice(0,6).map(c=>`<span>${c[0]} ↔ ${c[1]}</span><b>${fmt(c[2],1)} mm³</b>`).join('')}</div></div>`;
  el.innerHTML=`<div class="mcard"><h5>${title} · 質量</h5><div class="big">${fmt(mass,1)}<small>g</small></div><div class="kv"><span>体積</span><b>${fmt(vol/1000,2)} cm³</b><span>平均密度</span><b>${vol?fmt(mass/(vol/1000),2):'—'} g/cm³</b><span>総質量比</span><b>${fmt(mass/state.totalMass*100,1)} %</b></div></div>
    <div class="mcard"><h5>バウンディングボックス</h5><div class="big">${fmt(sz.x,1)} × ${fmt(sz.y,1)} × ${fmt(sz.z,1)}<small>mm</small></div><div class="kv"><span>min</span><b>${fmt(mn.x,1)}, ${fmt(mn.y,1)}, ${fmt(mn.z,1)}</b><span>max</span><b>${fmt(mx.x,1)}, ${fmt(mx.y,1)}, ${fmt(mx.z,1)}</b><span>対角</span><b>${fmt(sz.length(),1)} mm</b></div></div>
    <div class="mcard"><h5>重心 (組立状態)</h5><div class="big">${fmt(cg.x,1)}, ${fmt(cg.y,1)}, ${fmt(cg.z,1)}<small>mm</small></div><div class="kv"><span>設置面からの高さ</span><b>${fmt(cg.y-PRODUCT.groundY,1)} mm</b><span>ベース中心からの偏心</span><b>${fmt(Math.hypot(cg.x,cg.z),1)} mm</b></div></div>${extra}`;
}
function runClash(){ // mesh-level AABB overlap between parts in the assembled state
  const list=[...parts.values()];const out=[];const nested=new Set(PRODUCT.nested);
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];const key=[a.def.id,b.def.id].sort().join('|');if(nested.has(key))continue;if(!a.box.intersectsBox(b.box))continue;
    let best=0;for(const ba of a.meshBoxes)for(const bb of b.meshBoxes){if(!ba.intersectsBox(bb))continue;const s=ba.clone().intersect(bb).getSize(V3());best=Math.max(best,s.x*s.y*s.z);}
    if(best>50)out.push([a.def.id,b.def.id,best]);}
  state.clashes=out.sort((x,y)=>y[2]-x[2]);applyMaterials();renderMeasure();$('#hudClash').hidden=!out.length;$('#hudClash').innerHTML=`干渉 <b>${out.length}</b> ペア`;
  log(out.length?`干渉チェック: ${out.length} ペアで AABB 重なり (最大 ${fmt(out[0][2],0)} mm³) — 赤表示`:'干渉チェック: 重なりなし',out.length?'w':'g');showBottom('measure');
}

/* ───────── views / sets ───────── */
function captureThumb(){renderer.render(scene,camera);const c=document.createElement('canvas');c.width=192;c.height=120;const g=c.getContext('2d');const s=renderer.domElement;const r=Math.max(192/s.width,120/s.height);const w=s.width*r,h=s.height*r;g.drawImage(s,(192-w)/2,(120-h)/2,w,h);return c.toDataURL('image/jpeg',0.8);}
function snapshotView(name){const v={name,theta:orbit.theta,phi:orbit.phi,radius:orbit.radius,target:orbit.target.clone(),explode:state.explode,renderMode:state.renderMode,colorMode:state.colorMode,section:{...state.section},thumb:captureThumb()};state.views.push(v);state.activeView=state.views.length-1;renderViews();return v;}
function applyView(v,ms){state.explode=v.explode;state.renderMode=v.renderMode;state.colorMode=v.colorMode;Object.assign(state.section,v.section);syncControls();applyExplode();applyMaterials();applyClip();goTo(v,ms);}
function renderViews(){$('#views').innerHTML=state.views.map((v,i)=>`<div class="vcard ${state.activeView===i?'active':''}" data-view-i="${i}"><img src="${v.thumb}" alt=""><div>${v.name}<button class="del" data-del="${i}" title="削除">✕</button></div></div>`).join('');}
$('#views').addEventListener('click',e=>{const del=e.target.closest('[data-del]');if(del){state.views.splice(+del.dataset.del,1);state.activeView=-1;renderViews();return;}const c=e.target.closest('[data-view-i]');if(c){state.activeView=+c.dataset.viewI;applyView(state.views[state.activeView]);renderViews();}});
$('#saveView').onclick=$('#snap').onclick=()=>{snapshotView(`ビュー ${state.views.length+1}`);log('現在のビューを保存しました');expandDock('left');showLeft('views');};
const SETS=PRODUCT.sets;
const setPred=s=>d=>s.pred(d,parts.get(d.id).state);
function renderSets(){$('#sets').innerHTML=SETS.map((s,i)=>`<div class="set" data-set="${i}"><span class="sw" style="background:${s.color}"></span>${s.name}<span class="n">${PART_DEFS.filter(setPred(s)).length}</span></div>`).join('');}
$('#sets').addEventListener('click',e=>{const s=e.target.closest('[data-set]');if(s){const st=SETS[+s.dataset.set];select(partsIn(setPred(st)),e.ctrlKey||e.metaKey);log(`選択セット「${st.name}」を適用`);}});
