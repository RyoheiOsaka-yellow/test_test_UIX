
/* ───────── state ───────── */
const state={
  params:{...DEFAULT_PARAMS}, explode:0, explodeScale:1, explodeStyle:'axis', explodeSeq:'seq', renderMode:'solid', colorMode:'material',
  section:{on:false,axis:'x',pos:0,flip:false}, selection:new Set(), hidden:new Set(), grid:true, axes:true, shadow:true,
  edges:false, persp:true, turntable:false, led:true, labels:false, trails:true, ghostBase:false, hover:null, views:[], collapsed:new Set(), playing:false, playDir:1, filter:'', clashes:[]
};
const parts=new Map();
const log=(msg,cls='')=>{const o=$('#out');const t=new Date().toLocaleTimeString('ja-JP',{hour12:false});o.insertAdjacentHTML('beforeend',`<div><span class="t">${t}</span> <span class="${cls}">${msg}</span></div>`);o.scrollTop=o.scrollHeight;};

/* ───────── renderer / scene ───────── */
const vp=$('#viewport'), canvas=$('#gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.localClippingEnabled=true;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(35,1,1,5000);
scene.add(new THREE.HemisphereLight(0xffffff,0x7d8794,PRODUCT.ambient??0.9));
const key=new THREE.DirectionalLight(0xffffff,PRODUCT.keyLight??1.0); key.position.set(180,320,240); key.castShadow=true;
key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{left:-300,right:300,top:300,bottom:-300,near:10,far:1400}); key.shadow.bias=-0.0006; key.shadow.radius=3; scene.add(key);
const fill=new THREE.DirectionalLight(0xdfe8ff,0.35); fill.position.set(-260,120,-160); scene.add(fill);
const rim=new THREE.DirectionalLight(0xffffff,0.3); rim.position.set(60,80,-320); scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.ShadowMaterial({opacity:0.17}));
ground.rotation.x=-Math.PI/2; ground.position.y=PRODUCT.groundY-0.2; ground.receiveShadow=true; scene.add(ground);
const grid=new THREE.GridHelper(600,30,0x7f8ea3,0x9aa8ba); grid.position.y=PRODUCT.groundY-0.4; grid.material.transparent=true; grid.material.opacity=0.32; scene.add(grid);
const model=new THREE.Group(); scene.add(model);
const clipPlane=new THREE.Plane(V3(-1,0,0),0);
const edgeMat=new THREE.LineBasicMaterial({color:0x1b2230,transparent:true,opacity:0.9});
const illuMat=new THREE.MeshLambertMaterial({color:0xf7f8fa,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,side:THREE.DoubleSide});
const ghostMat=new THREE.MeshBasicMaterial({color:0x2f7de1,transparent:true,opacity:0.08,depthWrite:false,side:THREE.DoubleSide});
let glowMat=null;
// explode trails
const trailGeo=new THREE.BufferGeometry(); trailGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PART_DEFS.length*2*3),3));
const trailMat=new THREE.LineDashedMaterial({color:0x5d6675,dashSize:3,gapSize:2.5,transparent:true,opacity:0.7});
const trails=new THREE.LineSegments(trailGeo,trailMat); trails.frustumCulled=false; scene.add(trails);
const ghostGroup=new THREE.Group(); scene.add(ghostGroup);

// orbit camera
const orbit={theta:0.78,phi:1.12,radius:520,target:V3(0,60,0)};
let tween=null;
function applyCamera(){camera.position.setFromSpherical(new THREE.Spherical(orbit.radius,orbit.phi,orbit.theta)).add(orbit.target);camera.lookAt(orbit.target);}
function goTo(to,ms=450){
  if(reduced||ms===0){Object.assign(orbit,{theta:to.theta??orbit.theta,phi:to.phi??orbit.phi,radius:to.radius??orbit.radius});if(to.target)orbit.target.copy(to.target);tween=null;return;}
  const from={theta:orbit.theta,phi:orbit.phi,radius:orbit.radius,target:orbit.target.clone()};
  let dt=(to.theta??from.theta)-from.theta; dt=Math.atan2(Math.sin(dt),Math.cos(dt));
  tween={t0:performance.now(),ms,from,to:{theta:from.theta+dt,phi:to.phi??from.phi,radius:to.radius??from.radius,target:to.target?to.target.clone():from.target.clone()}};
}
const VIEWS={iso:{theta:0.78,phi:1.12},front:{theta:0,phi:Math.PI/2},back:{theta:Math.PI,phi:Math.PI/2},top:{theta:0,phi:0.0001},bottom:{theta:0,phi:Math.PI-0.0001},left:{theta:-Math.PI/2,phi:Math.PI/2},right:{theta:Math.PI/2,phi:Math.PI/2}};
function resize(){const w=vp.clientWidth,h=vp.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(vp);

/* ───────── geometry helpers ───────── */
function volumeCentroid(geom){
  const pos=geom.attributes.position,idx=geom.index;const a=V3(),b=V3(),c=V3(),cr=V3();let vol=0,cx=0,cy=0,cz=0;
  const n=idx?idx.count:pos.count;
  for(let i=0;i<n;i+=3){const ia=idx?idx.getX(i):i,ib=idx?idx.getX(i+1):i+1,ic=idx?idx.getX(i+2):i+2;
    a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);
    const v=a.dot(cr.copy(b).cross(c))/6;vol+=v;cx+=v*(a.x+b.x+c.x)/4;cy+=v*(a.y+b.y+c.y)/4;cz+=v*(a.z+b.z+c.z)/4;}
  if(Math.abs(vol)<1e-3){geom.computeBoundingBox();return {vol:0,centroid:geom.boundingBox.getCenter(V3())};}
  return {vol:Math.abs(vol),centroid:V3(cx/vol,cy/vol,cz/vol)};
}
function makeLogoTexture(){
  const cv=document.createElement('canvas');cv.width=cv.height=512;const g=cv.getContext('2d');
  g.textAlign='center';g.textBaseline='middle';g.font='italic 700 92px "IBM Plex Sans","Segoe UI",Arial,sans-serif';
  g.fillStyle='#1c4f9c';g.fillText('VolaTrap',246,256);const w=g.measureText('VolaTrap').width;
  g.fillStyle='#43b04a';g.beginPath();g.arc(246+w/2+30,236,11,0,Math.PI*2);g.fill();g.beginPath();g.arc(246+w/2+30,278,11,0,Math.PI*2);g.fill();g.fillRect(246-w/2,300,w*0.55,6);
  const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;
}
const logoTex=PRODUCT.logo?makeLogoTexture():null;
function makeMaterial(def){
  const cls=(MATERIALS[def.mat]||{}).cls;
  const soft=cls==='textile'||cls==='foam'||cls==='elastomer';
  const m=new THREE.MeshPhysicalMaterial({color:def.color,roughness:cls==='metal'?0.35:cls==='glass'?0.1:soft?0.9:cls==='composite'?0.3:0.42,metalness:cls==='metal'?0.55:0,clearcoat:cls==='plastic'?0.45:cls==='glass'?0.8:cls==='composite'?0.6:cls==='metal'?0.25:0,clearcoatRoughness:0.35,side:THREE.DoubleSide});
  if(def.decal&&logoTex){m.map=logoTex;m.transparent=true;m.alphaTest=0.05;m.clearcoat=0;}
  return m;
}

/* ───────── build model ───────── */
function buildModel(){
  const t0=performance.now();
  while(model.children.length){const ch=model.children.pop();ch.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  while(ghostGroup.children.length){ghostGroup.children.pop();}
  const p=state.params;const ctx=PRODUCT.makeCtx(p);state.ctx=ctx;const R=ctx.R||60;
  let tris=0;
  for(const def of PART_DEFS){
    let rt=parts.get(def.id);
    if(!rt){rt={def,mat:makeMaterial(def),state:{name:def.name,mat:def.mat,mb:def.mb,color:def.color,opacity:def.opacity??1,qty:def.qty,seq:def.seq,tool:def.tool},group:null,meshes:[]};parts.set(def.id,rt);}
    const b=def.build(ctx);
    const g=new THREE.Group();g.position.copy(b.pos);if(b.quat)g.quaternion.copy(b.quat);
    g.userData={partId:def.id,base:b.pos.clone(),explode:b.explode.clone()};
    rt.meshes=[];rt.exMax=0;const gh=new THREE.Group();gh.position.copy(b.pos);if(b.quat)gh.quaternion.copy(b.quat);
    for(const ms of b.meshes){
      const m=new THREE.Mesh(ms.g,rt.mat);if(ms.pos)m.position.fromArray(ms.pos);if(ms.rot)m.rotation.fromArray(ms.rot);if(ms.quat)m.quaternion.copy(ms.quat);
      m.castShadow=!def.decal;m.receiveShadow=true;m.userData.partId=def.id;if(ms.vol)m.userData.vol=ms.vol;m.userData.base=m.position.clone();if(ms.ex){m.userData.ex=V3().fromArray(ms.ex);rt.exMax=Math.max(rt.exMax||0,m.userData.ex.length());}
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(ms.g,28),edgeMat);m.add(e);
      g.add(m);rt.meshes.push(m);tris+=(ms.g.index?ms.g.index.count:ms.g.attributes.position.count)/3;
      if(!def.decal){const gm=new THREE.Mesh(ms.g,ghostMat);gm.position.copy(m.position);gm.quaternion.copy(m.quaternion);gh.add(gm);}
    }
    if(def.led){if(!glowMat)glowMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.2,blending:THREE.AdditiveBlending,depthWrite:false});
      const halo=new THREE.Mesh(new THREE.TorusGeometry(R-6.5,7,10,96),glowMat);halo.userData.glow=true;g.add(halo);rt.halo=halo;}
    rt.group=g;model.add(g);rt.ghost=gh;ghostGroup.add(gh);
    g.updateMatrixWorld(true);let vol=0;const c=V3();
    for(const m of rt.meshes){const vc=volumeCentroid(m.geometry);const v=m.userData.vol||vc.vol;const w=vc.centroid.applyMatrix4(m.matrixWorld);vol+=v;c.add(w.multiplyScalar(v));}
    rt.vol=vol;rt.centroid=vol>0?c.divideScalar(vol):g.position.clone();rt.box=new THREE.Box3().setFromObject(g);rt.meshBoxes=rt.meshes.map(m=>new THREE.Box3().setFromObject(m));
  }
  state.tris=Math.round(tris);
  updateMass();applyExplode();applyMaterials();applyClip();
  log(`モデル生成完了: ${PART_DEFS.length} 品番 / ${state.tris.toLocaleString()} 三角形 / ${(performance.now()-t0).toFixed(0)} ms`,'g');
}
function updateMass(){
  let total=0;for(const rt of parts.values()){const dens=(MATERIALS[rt.state.mat]||{d:1}).d;rt.mass=rt.vol/1000*dens*(rt.def.qtyInGeom?1:rt.state.qty);total+=rt.mass;}
  state.totalMass=total;const box=new THREE.Box3();for(const rt of parts.values())box.union(rt.box);state.assyBox=box;
  $('#stMass').innerHTML=`総質量 <b>${fmt(total,0)} g</b>`;$('#stTri').innerHTML=`<b>${state.tris.toLocaleString()}</b> 三角形`;
}

/* ───────── explode (sequenced) ───────── */
const seqSorted=()=>[...parts.values()].sort((a,b)=>a.state.seq-b.state.seq);
function partT(rt,t){ if(state.explodeSeq==='all')return smooth(clamp(t,0,1));
  const order=seqSorted().indexOf(rt);const s=order/N_STEPS*0.62,w=0.38;return smooth(clamp((t-s)/w,0,1)); }
function repVec(rt){const v=explodeVec(rt);if(v.length()>0.5)return v;const m=rt.meshes.find(m=>m.userData.ex);return m?m.userData.ex.clone():v;}
function explodeVec(rt){
  const g=rt.group;const ex=g.userData.explode.clone();
  if(state.explodeStyle==='radial'){const c=(state.ctx&&state.ctx.center)||V3(0,0,0);const r=g.userData.base.clone().sub(c);if(r.length()<1)r.set(0,0,1);return r.normalize().multiplyScalar(ex.length()*0.9).add(ex.multiplyScalar(0.35));}
  return ex;
}
function applyExplode(){
  const t=state.explode/100;const pos=trailGeo.attributes.position;let i=0,anyMoved=false;
  for(const rt of parts.values()){
    const k=partT(rt,t)*state.explodeScale;const ex=explodeVec(rt).multiplyScalar(k);
    rt.group.position.copy(rt.group.userData.base).add(ex);
    for(const m of rt.meshes)if(m.userData.ex)m.position.copy(m.userData.base).add(m.userData.ex.clone().multiplyScalar(k));
    const moved=(ex.length()+rt.exMax*k)>0.5&&!state.hidden.has(rt.def.id);anyMoved=anyMoved||moved;
    const b=rt.group.userData.base,e=rt.group.position;const c=rt.centroid.clone().sub(b);
    if(moved){pos.setXYZ(i++,b.x+c.x,b.y+c.y,b.z+c.z);pos.setXYZ(i++,e.x+c.x,e.y+c.y,e.z+c.z);}
    rt.ghost.visible=state.ghostBase&&moved;
  }
  trailGeo.setDrawRange(0,i);pos.needsUpdate=true;trails.computeLineDistances();trails.visible=state.trails&&i>0;
  $('#explode').value=Math.round(state.explode);$('#explodeOut').textContent=`${Math.round(state.explode)} %`;
  const done=currentStep();$('#stepInfo').innerHTML=`工程 <b>${done} / ${N_STEPS}</b>${done>0&&done<=N_STEPS?` · ${seqSorted()[done-1].state.name}`:''}`;
  if(!$('[data-bp="steps"]').hidden)highlightSteps();
}
function currentStep(){const t=state.explode/100;let n=0;for(const rt of seqSorted()){if(partT(rt,t)>=0.999)n++;else break;}return n;}
function stepTarget(k){ if(k<=0)return 0;if(state.explodeSeq==='all')return 100;const s=(k-1)/N_STEPS*0.62+0.38;return Math.min(100,s*100+0.01); }
let explodeAnim=null;
function animateExplode(to,ms=700){const from=state.explode;if(reduced){state.explode=to;applyExplode();return;}const t0=performance.now();explodeAnim={t0,ms,from,to};}
function tickExplode(now){if(!explodeAnim)return;const {t0,ms,from,to}=explodeAnim;const k=Math.min(1,(now-t0)/ms);const e=1-Math.pow(1-k,3);state.explode=from+(to-from)*e;applyExplode();if(k>=1){explodeAnim=null;if(state.playing){state.playing=false;setPlayIcon();}}}
function setPlayIcon(){$('#playIco').innerHTML=state.playing?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';}
function togglePlay(){ if(state.playing){state.playing=false;explodeAnim=null;setPlayIcon();return;}
  state.playing=true;setPlayIcon();const to=state.explode>=99?0:100;const dist=Math.abs(to-state.explode)/100;animateExplode(to,Math.max(600,4200*dist)); }

/* ───────── materials / clip ───────── */
function displayColor(rt){
  const d=rt.def,s=rt.state;
  switch(state.colorMode){
    case 'makebuy':return s.mb==='make'?'#3fae5c':'#3b7dd8';
    case 'group':return GROUPS.find(g=>g.id===d.group).color;
    case 'matclass':return CLASS_COLORS[(MATERIALS[s.mat]||{}).cls]||'#999';
    case 'mass':{const mx=Math.max(...[...parts.values()].map(r=>r.mass));const t=Math.sqrt(rt.mass/mx);return `hsl(${Math.round(210-210*t)},72%,${Math.round(58-14*t)}%)`;}
    default:return s.color;
  }
}
function applyMaterials(){
  const rm=state.renderMode;const ledC=new THREE.Color().setHSL((state.params.ledHue||0)/360,0.82,0.6);const ledP=state.params.ledPower??1;const selC=new THREE.Color(0x2f7de1);
  const clashSet=new Set(state.clashes.flat());
  for(const rt of parts.values()){
    const m=rt.mat,d=rt.def,vis=!state.hidden.has(d.id);rt.group.visible=vis;
    const sel=state.selection.has(d.id),hov=state.hover===d.id;
    m.color.set(displayColor(rt));if(d.decal&&state.colorMode==='material')m.color.set('#ffffff');
    if(clashSet.has(d.id)&&state.colorMode==='material')m.color.set('#e0483f');
    m.wireframe=rm==='wire';
    let op=rt.state.opacity;if(rm==='ghost'&&d.shell)op=Math.min(op,0.14);
    m.opacity=op;m.transparent=op<1||d.decal;m.depthWrite=op>=0.5;
    m.emissive.set(0x000000);m.emissiveIntensity=1;
    if(d.led&&state.led&&state.colorMode==='material'){m.emissive.copy(ledC);m.emissiveIntensity=ledP;m.color.copy(ledC).lerp(new THREE.Color(0xffffff),0.3);}
    if(sel){m.emissive.lerp(selC,d.led?0.5:1);m.emissiveIntensity=d.led?m.emissiveIntensity:0.45;}
    else if(hov){m.emissive.lerp(selC,d.led?0.25:1);m.emissiveIntensity=d.led?m.emissiveIntensity:0.18;}
    if(rt.halo){rt.halo.visible=d.led&&state.led&&state.colorMode==='material'&&rm!=='wire';glowMat.color.copy(ledC);glowMat.opacity=0.12*ledP;}
    const illus=rm==='illust';
    for(const mesh of rt.meshes){mesh.material=illus?illuMat:m;mesh.castShadow=state.shadow&&!d.decal&&op>0.5;mesh.children[0].visible=illus||state.edges;}
    m.needsUpdate=true;
  }
  const cs=getComputedStyle(document.documentElement);edgeMat.color.set(cs.getPropertyValue('--edge').trim()||'#1b2230');trailMat.color.set(cs.getPropertyValue('--muted').trim()||'#5d6675');
  $('#hudMode').textContent=`${{solid:'ソリッド',wire:'ワイヤフレーム',ghost:'透過',illust:'イラスト'}[rm]} · ${state.persp?'透視':'平行'}${state.colorMode!=='material'?' · '+{makebuy:'Make/Buy',group:'サブAssy',matclass:'材質分類',mass:'質量ヒート'}[state.colorMode]:''}`;
  key.castShadow=state.shadow;ground.visible=state.shadow;grid.visible=state.grid;$('#triad').style.display=state.axes?'':'none';
  $('#labels').style.display=state.labels||state.selection.size||state.hover?'':'none';
  $('#tgLabels').setAttribute('aria-pressed',state.labels);$('#toggleLabels').setAttribute('aria-pressed',state.labels);$('#tgTrails').setAttribute('aria-pressed',state.trails);$('#toggleSec').setAttribute('aria-pressed',state.section.on);
  trails.visible=state.trails&&trailGeo.drawRange.count>0;
  renderLegend();
}
function applyClip(){
  const s=state.section;const planes=s.on?[clipPlane]:[];
  const ax={x:V3(1,0,0),y:V3(0,1,0),z:V3(0,0,1)}[s.axis];
  const box=state.assyBox||new THREE.Box3(V3(-100,-20,-60),V3(200,180,60));const c=box.getCenter(V3()),sz=box.getSize(V3());
  const ext=({x:sz.x,y:sz.y,z:sz.z})[s.axis]/2;const pos=({x:c.x,y:c.y,z:c.z})[s.axis]+s.pos/100*ext;
  const sign=s.flip?1:-1;clipPlane.normal.copy(ax).multiplyScalar(sign);clipPlane.constant=-sign*pos;
  for(const rt of parts.values()){rt.mat.clippingPlanes=planes;rt.mat.clipShadows=true;rt.mat.needsUpdate=true;}
  illuMat.clippingPlanes=planes;edgeMat.clippingPlanes=planes;ghostMat.clippingPlanes=planes;if(glowMat)glowMat.clippingPlanes=planes;
  $('#hudSec').hidden=!s.on;$('#hudSec').textContent=`断面 ${s.axis.toUpperCase()} ${s.pos>=0?'+':''}${fmt(s.pos/100*ext,0)} mm`;
  $('#secPosOut').textContent=`${s.pos>=0?'+':''}${fmt(s.pos/100*ext,0)} mm`;$('#toggleSec').setAttribute('aria-pressed',s.on);
}
function renderLegend(){
  const el=$('#legend');const cm=state.colorMode;let items=[];
  if(cm==='makebuy')items=[['#3fae5c','Make · 自製'],['#3b7dd8','Buy · 購入']];
  else if(cm==='group')items=GROUPS.map(g=>[g.color,`${g.id} ${g.name}`]);
  else if(cm==='matclass')items=Object.keys(CLASS_COLORS).map(k=>[CLASS_COLORS[k],CLASS_JP[k]]);
  else if(cm==='mass')items=[['hsl(210,72%,58%)','軽い'],['hsl(105,72%,51%)','中'],['hsl(0,72%,44%)','重い']];
  if(state.clashes.length&&cm==='material')items.push(['#e0483f','干渉あり']);
  el.classList.toggle('show',items.length>0);el.innerHTML=items.map(i=>`<span><i style="background:${i[0]}"></i>${i[1]}</span>`).join('');
}

/* ───────── fit / focus / selection ───────── */
function fitBox(box,ms=450){if(box.isEmpty())return;const c=box.getCenter(V3()),r=box.getSize(V3()).length()/2;const rad=r/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.02;goTo({radius:rad,target:c},ms);}
function visibleBox(ids){const b=new THREE.Box3();for(const rt of parts.values()){if(state.hidden.has(rt.def.id))continue;if(ids&&!ids.has(rt.def.id))continue;b.union(new THREE.Box3().setFromObject(rt.group));}return b;}
function fitAll(ms){fitBox(visibleBox(),ms);}
function setPersp(on){const nf=on?35:6;const k=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.tan(THREE.MathUtils.degToRad(nf/2));camera.fov=nf;camera.updateProjectionMatrix();orbit.radius*=k;state.persp=on;applyMaterials();}
function select(ids,add=false){if(!add)state.selection.clear();for(const id of ids)if(state.selection.has(id)&&add)state.selection.delete(id);else state.selection.add(id);onSelectionChange();}
function onSelectionChange(){applyMaterials();renderTree();renderProps();renderBom();renderMeasure();$('#stSel').textContent=`${state.selection.size}/${PART_DEFS.length} 部品を選択`;}
function partsIn(pred){return PART_DEFS.filter(pred).map(d=>d.id);}
