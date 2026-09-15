
/* ───────── pointer / picking ───────── */
const ray=new THREE.Raycaster();const ptr={down:false,btn:0,x:0,y:0,sx:0,sy:0,moved:false,lastX:0,lastY:0,has:false};const tipEl=$('#tip');
canvas.addEventListener('pointerdown',e=>{ptr.down=true;ptr.btn=e.button;ptr.sx=ptr.x=e.clientX;ptr.sy=ptr.y=e.clientY;ptr.moved=false;canvas.setPointerCapture(e.pointerId);tween=null;closePeek();});
canvas.addEventListener('pointermove',e=>{
  const r=canvas.getBoundingClientRect();ptr.lastX=(e.clientX-r.left)/r.width*2-1;ptr.lastY=-((e.clientY-r.top)/r.height)*2+1;ptr.has=true;
  tipEl.style.left=(e.clientX-r.left)+'px';tipEl.style.top=(e.clientY-r.top)+'px';
  if(!ptr.down)return;const dx=e.clientX-ptr.x,dy=e.clientY-ptr.y;ptr.x=e.clientX;ptr.y=e.clientY;
  if(Math.hypot(e.clientX-ptr.sx,e.clientY-ptr.sy)>4)ptr.moved=true;
  if(ptr.btn===0&&!e.shiftKey){orbit.theta-=dx*0.006;orbit.phi=clamp(orbit.phi-dy*0.006,0.0001,Math.PI-0.0001);}
  else{const k=orbit.radius*0.0016;const right=V3().setFromMatrixColumn(camera.matrix,0),up=V3().setFromMatrixColumn(camera.matrix,1);orbit.target.add(right.multiplyScalar(-dx*k)).add(up.multiplyScalar(dy*k));}
});
canvas.addEventListener('pointerup',e=>{ptr.down=false;if(!ptr.moved&&e.button===0){const hit=pick();if(hit)select([hit],e.ctrlKey||e.metaKey);else if(!(e.ctrlKey||e.metaKey))select([]);}});
canvas.addEventListener('dblclick',()=>{const hit=pick();if(hit){select([hit]);fitBox(new THREE.Box3().setFromObject(parts.get(hit).group));}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.radius=clamp(orbit.radius*(e.deltaY>0?1.1:0.9),40,3000);tween=null;},{passive:false});
canvas.addEventListener('pointerleave',()=>{ptr.has=false;state.hover=null;tipEl.style.display='none';applyMaterials();});
function pick(){if(!ptr.has)return null;ray.setFromCamera({x:ptr.lastX,y:ptr.lastY},camera);const list=[];for(const rt of parts.values())if(!state.hidden.has(rt.def.id))list.push(...rt.meshes);
  const hits=ray.intersectObjects(list,false);for(const h of hits){if(state.section.on&&clipPlane.distanceToPoint(h.point)<0)continue;return h.object.userData.partId;}return null;}
function updateHover(){if(ptr.down||!ptr.has)return;const id=pick();if(id!==state.hover){state.hover=id;applyMaterials();if(id){const rt=parts.get(id);tipEl.innerHTML=`${rt.state.name}<small>${id} · ${fmt(rt.mass,1)} g · 工程 ${rt.state.seq}</small>`;tipEl.style.display='block';}else tipEl.style.display='none';}}
let pinch=null;canvas.addEventListener('touchstart',e=>{if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});
canvas.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);orbit.radius=clamp(orbit.radius*pinch/d,40,3000);pinch=d;}},{passive:true});

/* ───────── labels / triad ───────── */
const labelsEl=$('#labels');const labelNodes=new Map();
function updateLabels(){
  const show=state.labels,w=canvas.clientWidth,h=canvas.clientHeight;const tmp=V3();
  for(const rt of parts.values()){const id=rt.def.id;const want=!state.hidden.has(id)&&(show||state.selection.has(id)||state.hover===id);
    let n=labelNodes.get(id);if(!want){if(n)n.hidden=true;continue;}
    if(!n){n=document.createElement('div');n.className='lab';labelsEl.appendChild(n);labelNodes.set(id,n);}
    tmp.copy(rt.centroid).sub(rt.group.userData.base).add(rt.group.position).project(camera);
    if(tmp.z>1){n.hidden=true;continue;}n.hidden=false;
    n.style.left=((tmp.x+1)/2*w)+'px';n.style.top=((1-tmp.y)/2*h)+'px';
    const sel=state.selection.has(id);n.className='lab'+(sel?' sel':'')+(show&&!sel&&state.hover!==id?' dim':'');
    const txt=sel?`${rt.state.name}<small>${id} · ${fmt(rt.mass,1)} g</small>`:`${rt.state.name}<small>${id}</small>`;if(n.dataset.t!==txt){n.innerHTML=txt;n.dataset.t=txt;}
  }
}
const tri=$('#triad'),tg=tri.getContext('2d');
function drawTriad(){
  tg.clearRect(0,0,192,192);const q=camera.quaternion.clone().invert();const cx=96,cy=96,L=64;
  const axes=[['X',V3(1,0,0),'#d9453f'],['Y',V3(0,1,0),'#3aa655'],['Z',V3(0,0,1),'#2f7de1']].map(a=>({n:a[0],p:a[1].applyQuaternion(q),c:a[2]})).sort((a,b)=>a.p.z-b.p.z);
  tg.lineWidth=3;tg.font='600 22px IBM Plex Mono, monospace';tg.textAlign='center';tg.textBaseline='middle';
  for(const a of axes){const x=cx+a.p.x*L,y=cy-a.p.y*L;tg.strokeStyle=a.c;tg.globalAlpha=0.55+0.45*(a.p.z+1)/2;tg.beginPath();tg.moveTo(cx,cy);tg.lineTo(x,y);tg.stroke();tg.fillStyle=a.c;tg.beginPath();tg.arc(x,y,13,0,Math.PI*2);tg.fill();tg.fillStyle='#fff';tg.fillText(a.n,x,y+1);}
  tg.globalAlpha=1;
}

/* ───────── loop ───────── */
let frames=0,fpsT=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  if(tween){const k=Math.min(1,(now-tween.t0)/tween.ms);const e=1-Math.pow(1-k,3);orbit.theta=tween.from.theta+(tween.to.theta-tween.from.theta)*e;orbit.phi=tween.from.phi+(tween.to.phi-tween.from.phi)*e;orbit.radius=tween.from.radius+(tween.to.radius-tween.from.radius)*e;orbit.target.lerpVectors(tween.from.target,tween.to.target,e);if(k>=1)tween=null;}
  if(state.turntable&&!ptr.down)orbit.theta+=0.004;
  tickExplode(now);applyCamera();updateHover();renderer.render(scene,camera);if(state.axes)drawTriad();updateLabels();
  frames++;if(now-fpsT>500){$('#stFps').textContent=`${Math.round(frames*1000/(now-fpsT))} fps`;frames=0;fpsT=now;if(!state.selection.size&&!$('[data-rp2="props"]').hidden&&!$('#dockRight').classList.contains('collapsed'))renderProps();}
}

/* ───────── layout: docks / ribbon / presentation ───────── */
const LS='studio-layout-'+PRODUCT.mark;
function saveLayout(){try{localStorage.setItem(LS,JSON.stringify({left:$('#dockLeft').classList.contains('collapsed'),right:$('#dockRight').classList.contains('collapsed'),bottom:$('#dockBottom').classList.contains('collapsed'),ribbon:$('#ribbon').classList.contains('collapsed')}));}catch{}}
function loadLayout(){try{const v=JSON.parse(localStorage.getItem(LS)||'null');if(!v)return;setDock('left',v.left);setDock('right',v.right);setDock('bottom',v.bottom);setRibbon(v.ribbon);}catch{}}
const dockEl={left:$('#dockLeft'),right:$('#dockRight'),bottom:$('#dockBottom')};
let layoutFit=null;function refit(){clearTimeout(layoutFit);layoutFit=setTimeout(()=>fitAll(350),220);}
function setDock(k,collapsed){dockEl[k].classList.toggle('collapsed',!!collapsed);refit();if(k==='bottom')$('#bottomChev').innerHTML=collapsed?'<path d="m6 15 6-6 6 6"/>':'<path d="m6 9 6 6 6-6"/>';saveLayout();}
function expandDock(k){if(dockEl[k].classList.contains('collapsed'))setDock(k,false);dockEl[k].hidden=false;}
$$('[data-collapse]').forEach(b=>b.onclick=()=>setDock(b.dataset.collapse,true));
$$('[data-expand]').forEach(b=>b.onclick=()=>setDock(b.dataset.expand,false));
function setRibbon(collapsed){$('#ribbon').classList.toggle('collapsed',!!collapsed);refit();$('#ribbon').classList.remove('peek');$('#ribbonCol').querySelector('span').textContent=collapsed?'展開':'折りたたむ';$('#ribbonCol').querySelector('svg').innerHTML=collapsed?'<path d="m6 15 6-6 6 6"/>':'<path d="m6 9 6 6 6-6"/>';saveLayout();}
function closePeek(){$('#ribbon').classList.remove('peek');}
$('#ribbonCol').onclick=()=>setRibbon(!$('#ribbon').classList.contains('collapsed'));
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#ribbon'))closePeek();});
$$('[data-rt]').forEach(b=>b.onclick=()=>{const rb=$('#ribbon');const already=b.getAttribute('aria-selected')==='true';$$('[data-rt]').forEach(x=>x.setAttribute('aria-selected',x===b));$$('[data-rp]').forEach(p=>p.hidden=p.dataset.rp!==b.dataset.rt);
  if(rb.classList.contains('collapsed')){rb.classList.toggle('peek',!(already&&rb.classList.contains('peek')));}
  if(b.dataset.rt==='design'){expandDock('right');showRight('param');}});
$$('[data-rt]').forEach(b=>b.ondblclick=()=>setRibbon(!$('#ribbon').classList.contains('collapsed')));
function setPresent(on){document.body.classList.toggle('present',on);$('#present').setAttribute('aria-pressed',on);if(on){state.turntable=true;$('#optTurn').checked=true;setTimeout(()=>fitAll(500),200);}else{state.turntable=false;$('#optTurn').checked=false;setTimeout(()=>fitAll(400),200);}log(on?'プレゼンモード ON (P で解除)':'プレゼンモード OFF');}
$('#present').onclick=()=>setPresent(!document.body.classList.contains('present'));
$('#resetUi').onclick=()=>{setDock('left',false);setDock('right',false);setDock('bottom',false);setRibbon(false);['paneLeft','paneRight','paneBottom'].forEach(i=>{$('#'+i).checked=true;});Object.values(dockEl).forEach(d=>d.hidden=false);showLeft('tree');showRight('props');showBottom('steps');setTimeout(()=>fitAll(400),200);log('レイアウトを初期化');};

/* ───────── tabs ───────── */
function showLeft(k){$$('[data-lt]').forEach(b=>b.setAttribute('aria-selected',b.dataset.lt===k));$$('[data-lp]').forEach(p=>p.hidden=p.dataset.lp!==k);$('#leftTitle').textContent={tree:'構造',views:'ビュー',sets:'選択セット'}[k];}
$$('[data-lt]').forEach(b=>b.onclick=()=>showLeft(b.dataset.lt));
function showBottom(k){$$('[data-bt]').forEach(x=>x.setAttribute('aria-selected',x.dataset.bt===k));$$('[data-bp]').forEach(p=>p.hidden=p.dataset.bp!==k);expandDock('bottom');$('#paneBottom').checked=true;if(k==='steps')renderSteps();if(k==='measure')renderMeasure();}
$$('[data-bt]').forEach(b=>b.onclick=()=>showBottom(b.dataset.bt));
function showRight(k){$$('[data-rtab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.rtab===k));$$('[data-rp2]').forEach(p=>p.hidden=p.dataset.rp2!==k);}
$$('[data-rtab]').forEach(b=>b.onclick=()=>showRight(b.dataset.rtab));

/* ───────── controls ───────── */
$$('[data-view]').forEach(b=>b.onclick=()=>goTo(VIEWS[b.dataset.view]));
$('#fit').onclick=$('#fit2').onclick=()=>fitAll();
$$('[data-zoom]').forEach(b=>b.onclick=()=>{orbit.radius=clamp(orbit.radius/+b.dataset.zoom,40,3000);});
$('#focusSel').onclick=()=>{if(state.selection.size)fitBox(visibleBox(state.selection));else fitAll();};
const RMS=['solid','wire','ghost','illust'];
$('#renderMode').onclick=e=>{const b=e.target.closest('[data-rm]');if(!b)return;state.renderMode=b.dataset.rm;syncControls();applyMaterials();};
$('#cycleRender').onclick=()=>{state.renderMode=RMS[(RMS.indexOf(state.renderMode)+1)%RMS.length];syncControls();applyMaterials();log(`レンダーモード: ${state.renderMode}`);};
$('#colorMode').onclick=e=>{const b=e.target.closest('[data-cm]');if(!b)return;state.colorMode=b.dataset.cm;syncControls();applyMaterials();renderTree();renderBom();renderProps();};
$('#explodeStyle').onclick=e=>{const b=e.target.closest('[data-es]');if(!b)return;state.explodeStyle=b.dataset.es;syncControls();applyExplode();renderSteps();};
$('#explodeSeq').onclick=e=>{const b=e.target.closest('[data-sq]');if(!b)return;state.explodeSeq=b.dataset.sq;syncControls();applyExplode();renderSteps();};
$('#secAxis').onclick=e=>{const b=e.target.closest('[data-ax]');if(!b)return;state.section.axis=b.dataset.ax;syncControls();applyClip();};
$('#secFlip').onclick=()=>{state.section.flip=!state.section.flip;applyClip();};
$('#secOn').onchange=e=>{state.section.on=e.target.checked;applyClip();};
$('#toggleSec').onclick=()=>{state.section.on=!state.section.on;$('#secOn').checked=state.section.on;applyClip();};
$('#secPos').oninput=e=>{state.section.pos=+e.target.value;applyClip();};
$('#explode').oninput=e=>{explodeAnim=null;state.playing=false;setPlayIcon();state.explode=+e.target.value;applyExplode();};
$$('[data-explode]').forEach(b=>b.onclick=()=>{state.playing=false;setPlayIcon();animateExplode(+b.dataset.explode,900);});
$('#play').onclick=togglePlay;
$('#stepNext').onclick=()=>{state.playing=false;setPlayIcon();animateExplode(stepTarget(Math.min(N_STEPS,currentStep()+1)),500);};
$('#stepPrev').onclick=()=>{state.playing=false;setPlayIcon();animateExplode(stepTarget(Math.max(0,currentStep()-1)),500);};
$('#explodeScale').oninput=e=>{state.explodeScale=+e.target.value;$('#explodeScaleOut').textContent=fmt(state.explodeScale,2)+'×';applyExplode();};
$('#optTrails').onchange=e=>{state.trails=e.target.checked;applyExplode();applyMaterials();};
$('#tgTrails').onclick=()=>{state.trails=!state.trails;$('#optTrails').checked=state.trails;applyExplode();applyMaterials();};
$('#optGhostBase').onchange=e=>{state.ghostBase=e.target.checked;applyExplode();};
$('#optLabels').onchange=e=>{state.labels=e.target.checked;applyMaterials();};
function toggleLabels(){state.labels=!state.labels;$('#optLabels').checked=state.labels;applyMaterials();}
$('#tgLabels').onclick=$('#toggleLabels').onclick=toggleLabels;
$('#ledPower').oninput=e=>{state.params.ledPower=+e.target.value;$('#ledPowerOut').textContent=fmt(state.params.ledPower,2);applyMaterials();};
$('#optLed').onchange=e=>{state.led=e.target.checked;applyMaterials();};
$('#optGrid').onchange=e=>{state.grid=e.target.checked;applyMaterials();};
$('#optAxes').onchange=e=>{state.axes=e.target.checked;applyMaterials();};
$('#optShadow').onchange=e=>{state.shadow=e.target.checked;applyMaterials();};
$('#optEdges').onchange=e=>{state.edges=e.target.checked;applyMaterials();};
$('#optTurn').onchange=e=>{state.turntable=e.target.checked;};
$('#optPersp').onchange=e=>setPersp(e.target.checked);
$('#paneLeft').onchange=e=>{dockEl.left.hidden=!e.target.checked;refit();};
$('#paneRight').onchange=e=>{dockEl.right.hidden=!e.target.checked;refit();};
$('#paneBottom').onchange=e=>{dockEl.bottom.hidden=!e.target.checked;refit();};
function isolateSelection(){if(!state.selection.size)return;PART_DEFS.forEach(d=>{if(!state.selection.has(d.id))state.hidden.add(d.id);else state.hidden.delete(d.id);});applyMaterials();applyExplode();renderTree();renderBom();fitBox(visibleBox(state.selection));log(`分離表示: ${state.selection.size} 部品`);}
$('#isolate').onclick=isolateSelection;
$('#hideSel').onclick=()=>{state.selection.forEach(i=>state.hidden.add(i));applyMaterials();applyExplode();renderTree();renderBom();};
$('#showAll').onclick=()=>{state.hidden.clear();applyMaterials();applyExplode();renderTree();renderBom();};
$('#selShell').onclick=()=>select(partsIn(d=>d.shell));
$('#selInner').onclick=()=>select(partsIn(d=>d.group==='A3'));
$('#clearSel').onclick=()=>select([]);
$('#measureSel').onclick=()=>showBottom('measure');
$('#measureAll').onclick=()=>{select([]);showBottom('measure');};
$('#clash').onclick=runClash;
$('#openParam').onclick=()=>{expandDock('right');showRight('param');};
$('#paramReset').onclick=()=>{state.params={...DEFAULT_PARAMS};$('#ledPower').value=DEFAULT_PARAMS.ledPower;buildModel();renderAll();log('パラメータを初期値に戻しました');};
$('#paramOpt').onclick=()=>{const t=TARGETS[0].target;let it=0;while(state.totalMass>t&&it<40){if(!PRODUCT.optimizeStep(state.params))break;buildModel();it++;}
  renderAll();expandDock('right');showRight('param');log(`質量最適化: ${it} 反復 → 総質量 ${fmt(state.totalMass,0)} g (目標 ≤ ${t} g)`,state.totalMass<=t?'g':'w');};
$('#exportJson').onclick=async()=>{const data={product:PRODUCT.assyInst,params:state.params,results:computeResults(),steps:seqSorted().map((r,i)=>({step:i+1,id:r.def.id,name:r.state.name,tool:r.state.tool,direction:repVec(r).toArray().map(v=>+v.toFixed(1))})),parts:PART_DEFS.map(d=>({id:d.id,...parts.get(d.id).state,volume_cm3:+(parts.get(d.id).vol/1000).toFixed(3),mass_g:+parts.get(d.id).mass.toFixed(2),group:d.group}))};
  const s=JSON.stringify(data,null,2);try{await navigator.clipboard.writeText(s);log('設計データ (JSON) をクリップボードにコピーしました','g');}catch{log('クリップボードに書き込めませんでした。出力タブに表示します','w');}$('#out').insertAdjacentHTML('beforeend',`<pre style="margin:4px 0;color:var(--muted)">${s.slice(0,1500)}${s.length>1500?'\n…':''}</pre>`);showBottom('out');};
$('#copyBom').onclick=async()=>{const tsv=['部品番号\t名称\tEnglish\tAssy\t材質\t数量\t体積cm3\t質量g\tMakeBuy\t工程\t工具',...PART_DEFS.map(d=>{const r=parts.get(d.id);return [d.id,r.state.name,d.en,d.group,r.state.mat,r.state.qty,(r.vol/1000).toFixed(2),r.mass.toFixed(1),r.state.mb,r.state.seq,r.state.tool].join('\t');})].join('\n');try{await navigator.clipboard.writeText(tsv);log('BOM (TSV) をコピーしました','g');}catch{log('クリップボードに書き込めませんでした','w');}};
function syncControls(){$$('[data-rm]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.rm===state.renderMode));$$('[data-cm]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.cm===state.colorMode));$$('[data-es]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.es===state.explodeStyle));$$('[data-sq]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sq===state.explodeSeq));$$('[data-ax]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ax===state.section.axis));$('#secOn').checked=state.section.on;$('#secPos').value=state.section.pos;}
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;const k=e.key.toLowerCase();
  if(k==='f')fitAll();else if(k==='e')animateExplode(state.explode>50?0:100,900);else if(k===' '){e.preventDefault();togglePlay();}else if(k==='arrowright'){e.preventDefault();$('#stepNext').click();}else if(k==='arrowleft'){e.preventDefault();$('#stepPrev').click();}
  else if(k==='escape'){if(document.body.classList.contains('present'))setPresent(false);else select([]);}else if(k==='i')goTo(VIEWS.iso);else if(k==='p')setPresent(!document.body.classList.contains('present'));else if(k==='s')$('#toggleSec').click();else if(k==='l')toggleLabels();
  else if(k==='h'&&state.selection.size)$('#hideSel').click();else if(k==='a'&&e.ctrlKey){e.preventDefault();select(PART_DEFS.map(d=>d.id));}});
function renderAll(){renderTree();renderProps();renderBom();renderSteps();renderMeasure();renderParam();renderSets();}

/* ───────── init ───────── */
$('#prodMark').textContent=PRODUCT.mark;$('#prodName').textContent=PRODUCT.name;$('#prodTag').textContent=PRODUCT.tag;$('#crumbA').textContent=PRODUCT.crumbA;$('#crumbB').textContent=PRODUCT.crumbB;$('#revTag').textContent=PRODUCT.rev;document.title=PRODUCT.name;$('#ledRow').hidden=!PRODUCT.hasLed;
resize();buildModel();renderAll();applyCamera();fitAll(0);applyCamera();
const presets=[['初期ビュー (等角)',{...VIEWS.iso}],['正面',{...VIEWS.front}],['全分解 (順次)',{...VIEWS.iso,explode:100}],['断面 X · 透過',{theta:0.35,phi:1.25,section:{on:true,axis:'x',pos:0,flip:false},renderMode:'ghost'}]];
for(const [name,v] of presets){state.explode=v.explode||0;state.renderMode=v.renderMode||'solid';Object.assign(state.section,v.section||{on:false});applyExplode();applyMaterials();applyClip();Object.assign(orbit,{theta:v.theta,phi:v.phi});applyCamera();fitAll(0);applyCamera();snapshotView(name);}
state.explode=0;state.renderMode='solid';state.section.on=false;state.activeView=0;syncControls();applyExplode();applyMaterials();applyClip();Object.assign(orbit,VIEWS.iso);applyCamera();fitAll(0);applyCamera();renderViews();
loadLayout();setTimeout(()=>fitAll(0),50);
log(`${PRODUCT.name} (${PRODUCT.rev}) 起動 · Three.js r128 · 単位 mm / g`);
log(PRODUCT.hints);
requestAnimationFrame(loop);
})();
</script>
</body>
</html>
