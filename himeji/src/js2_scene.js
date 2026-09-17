
/* ================================================================
   3D シーン
================================================================ */
const wrap=$('canvas-wrap');
const renderer=new THREE.WebGLRenderer({antialias:true, alpha:true, logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.outputEncoding=THREE.sRGBEncoding; wrap.appendChild(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xdfe9f3);
scene.fog=new THREE.Fog(0xdfe9f3, 14000, 70000);
const camera=new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 2, 90000);
const amb=new THREE.HemisphereLight(0xe8f0ff, 0x8a8f7a, 0.95); scene.add(amb);
const sun=new THREE.DirectionalLight(0xfff3d8, 1.15); sun.position.set(-3000, 5000, 2500); scene.add(sun);
addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

/* オービットコントロール */
const ctrl={
  target:new THREE.Vector3(0,BASE_H,300), sph:new THREE.Spherical(3200,0.95,0.1),
  panning:false, rotating:false, px:0, py:0, enabled:true, minR:60, maxR:60000, minPhi:0.08, maxPhi:1.5,
  apply(){ this.sph.radius=clamp(this.sph.radius,this.minR,this.maxR); this.sph.phi=clamp(this.sph.phi,this.minPhi,this.maxPhi); camera.position.setFromSpherical(this.sph).add(this.target); camera.lookAt(this.target); }
};
ctrl.apply();
const el=renderer.domElement;
el.addEventListener('contextmenu', e=>e.preventDefault());
el.addEventListener('pointerdown', e=>{ if(!ctrl.enabled) return; if(e.button===0) ctrl.rotating=true; if(e.button===2) ctrl.panning=true; ctrl.px=e.clientX; ctrl.py=e.clientY; });
addEventListener('pointerup', ()=>{ ctrl.rotating=false; ctrl.panning=false; });
addEventListener('pointermove', e=>{ const dx=e.clientX-ctrl.px, dy=e.clientY-ctrl.py;
  if(ctrl.rotating){ ctrl.sph.theta-=dx*0.0048; ctrl.sph.phi-=dy*0.0042; ctrl.apply(); tween=null; }
  else if(ctrl.panning){ const s=ctrl.sph.radius*0.0013; const fwd=new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize(); const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).negate(); ctrl.target.addScaledVector(right,-dx*s).addScaledVector(fwd,dy*s); ctrl.apply(); tween=null; }
  ctrl.px=e.clientX; ctrl.py=e.clientY; });
el.addEventListener('wheel', e=>{ e.preventDefault(); ctrl.sph.radius*=(1+Math.sign(e.deltaY)*0.09); ctrl.apply(); tween=null; }, {passive:false});
let pinch=null;
el.addEventListener('touchstart', e=>{ if(e.touches.length===2){ pinch={d:Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY), r:ctrl.sph.radius}; ctrl.rotating=false; } }, {passive:true});
el.addEventListener('touchmove', e=>{ if(pinch && e.touches.length===2){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); ctrl.sph.radius=pinch.r*pinch.d/Math.max(1,d); ctrl.apply(); } }, {passive:true});
el.addEventListener('touchend', ()=>{ pinch=null; });
let tween=null;
function flyTo(target, radius, phi, theta, dur=1300){ tween={t0:performance.now(), dur, a:{t:ctrl.target.clone(), r:ctrl.sph.radius, p:ctrl.sph.phi, th:ctrl.sph.theta}, b:{t:new THREE.Vector3(target[0],target[1],target[2]), r:radius, p:phi, th:theta}}; }
function updateTween(now){ if(!tween) return; const k=sstep(0,1,(now-tween.t0)/tween.dur); ctrl.target.lerpVectors(tween.a.t,tween.b.t,k); ctrl.sph.radius=lerp(tween.a.r,tween.b.r,k); ctrl.sph.phi=lerp(tween.a.p,tween.b.p,k); ctrl.sph.theta=lerp(tween.a.th,tween.b.th,k); ctrl.apply(); if(k>=1) tween=null; }
const vAt=(id,dy=0)=>{ const s=SP[id]||NODE[id]; return [s.x, hAt(s.x,s.z)+dy, s.z]; };
const VIEWS={
  all:    ()=>({t:[0,BASE_H,300], r:3200, p:0.95, th:0.1}),
  castle: ()=>({t:[0,BASE_H+20,0], r:520, p:1.05, th:0.35}),
  otemae: ()=>({t:vAt('otemae'), r:700, p:1.1, th:0.05}),
  station:()=>({t:vAt('station'), r:620, p:1.05, th:-0.4}),
  kokoen: ()=>({t:vAt('kokoen'), r:420, p:1.0, th:0.9}),
  shosha: ()=>({t:vAt('shosha'), r:1400, p:1.05, th:-0.6}),
  top:    ()=>({t:[0,BASE_H,200], r:3600, p:0.1, th:0}),
  region: ()=>({t:[2500,0,-800], r:24000, p:0.78, th:0.2}),
};
function setView(v){ const V=VIEWS[v]?VIEWS[v]():null; if(!V) return; flyTo(V.t,V.r,V.p,V.th,1500); document.querySelectorAll('#view-crumb .crumb[data-v]').forEach(c=>c.classList.toggle('active',c.dataset.v===v)); if(v==='region' && typeof setArcs==='function' && !arcsOn) setArcs(true); }
document.querySelectorAll('#view-crumb .crumb[data-v]').forEach(c=>c.onclick=()=>setView(c.dataset.v));
const toastEl=$('toast'); let toastT=null;
function toast(msg, ms=2400){ toastEl.textContent=msg; toastEl.style.display='block'; clearTimeout(toastT); toastT=setTimeout(()=>toastEl.style.display='none', ms); }

/* ---------- テクスチャ・ラベル ---------- */
function cvs(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function makeLabel(text, size=18, color='#ffffff', bg=null, sub=null){
  const c=cvs(512,128), g=c.getContext('2d'); let fs=52; const F=(s)=>`700 ${s}px 'Noto Sans JP','Hiragino Sans',sans-serif`;
  g.font=F(fs); while(g.measureText(text).width>470 && fs>20){ fs-=2; g.font=F(fs); } g.textAlign='center'; g.textBaseline='middle';
  if(bg){ const w=Math.min(504, g.measureText(text).width+44); g.fillStyle=bg; g.beginPath(); g.roundRect? g.roundRect(256-w/2,22,w,sub?92:76,16):g.rect(256-w/2,22,w,76); g.fill(); }
  g.fillStyle=color; g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=bg?0:10; g.fillText(text,256,sub?52:60);
  if(sub){ g.font=`500 26px 'Noto Sans JP',sans-serif`; g.fillStyle=bg?'rgba(255,255,255,.8)':'#e5edf7'; g.fillText(sub,256,92); }
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t, transparent:true, depthTest:false, depthWrite:false})); sp.scale.set(size*4,size,1); sp.userData.size=size; sp.renderOrder=20; return sp;
}
const world=new THREE.Group(); scene.add(world);
const labels=new THREE.Group(); world.add(labels);
const pickables=[];
function pickable(m, info){ m.userData.info=info; pickables.push(m); return m; }
function addLabel(text, x, z, dy, size, color, bg, sub){ const l=makeLabel(text,size,color,bg,sub); l.position.set(x, hAt(x,z)+dy, z); labels.add(l); l.userData.base=[x,z,dy]; l.userData.dyn=true; return l; }
const DYN_LABELS=[]; function scaleLabels(){ const k=clamp(ctrl.sph.radius/700,0.9,40); for(const l of DYN_LABELS){ const s=l.userData.size*(l.userData.k||1); l.scale.set(s*4*k, s*k, 1); } }

/* ---------- 地形 (DEM) + 地理院タイル ---------- */
const IMG={pale15:'__IMG_PALE15__', photo15:'__IMG_PHOTO15__', pale17:'__IMG_PALE17__', photo17:'__IMG_PHOTO17__'};
const TEX={}; const texLoader=new THREE.TextureLoader();
function tex(k){ if(!TEX[k]){ TEX[k]=texLoader.load(IMG[k]); TEX[k].encoding=THREE.sRGBEncoding; TEX[k].anisotropy=8; } return TEX[k]; }
const SEGS=191;
const terrGeo=new THREE.PlaneGeometry(MOS.size, MOS.size, SEGS, SEGS);
const coreGeo=new THREE.PlaneGeometry(CORE.w, CORE.h, 48, 88);
function shapeTerrain(){
  const p=terrGeo.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i)+MOS.cx, z=-p.getY(i)+MOS.cz; const inCore=Math.abs(x-CORE.cx)<CORE.w/2-20 && Math.abs(z-CORE.cz)<CORE.h/2-20; p.setZ(i, hAt(x,z)-(inCore?4:0)); } p.needsUpdate=true; terrGeo.computeVertexNormals();
  const q=coreGeo.attributes.position; for(let i=0;i<q.count;i++){ const x=q.getX(i)+CORE.cx, z=-q.getY(i)+CORE.cz; q.setZ(i, hAt(x,z)+0.8); } q.needsUpdate=true; coreGeo.computeVertexNormals();
}
shapeTerrain();
const terrMat=new THREE.MeshStandardMaterial({map:tex('pale15'), roughness:0.95, metalness:0});
const terrain=new THREE.Mesh(terrGeo, terrMat); terrain.rotation.x=-Math.PI/2; terrain.position.set(MOS.cx,0,MOS.cz); world.add(terrain);
const coreMat=new THREE.MeshStandardMaterial({map:tex('pale17'), roughness:0.95, metalness:0, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2});
const coreMesh=new THREE.Mesh(coreGeo, coreMat); coreMesh.rotation.x=-Math.PI/2; coreMesh.position.set(CORE.cx,0,CORE.cz); coreMesh.renderOrder=1; world.add(coreMesh);
/* 市域外の地面(広域) */
const outerGround=new THREE.Mesh(new THREE.PlaneGeometry(120000,120000), new THREE.MeshStandardMaterial({color:0xc9d5e0, roughness:1}));
outerGround.rotation.x=-Math.PI/2; outerGround.position.y=-3; world.add(outerGround);
/* 海(播磨灘: 南側) */
(function(){ const sea=new THREE.Mesh(new THREE.PlaneGeometry(120000,40000), new THREE.MeshStandardMaterial({color:0x9fc3e0, roughness:0.6, metalness:0.1})); sea.rotation.x=-Math.PI/2; sea.position.set(0,-2,HALF+4000+20000); world.add(sea); })();
let mapMode='pale';
function setMap(m){ mapMode=m; document.querySelectorAll('#map-seg button').forEach(b=>b.classList.toggle('active',b.dataset.map===m));
  if(m==='none'){ terrMat.map=null; terrMat.color.set(0xe3e8ee); coreMat.map=null; coreMat.color.set(0xe3e8ee); }
  else { terrMat.map=tex(m+'15'); coreMat.map=tex(m+'17'); terrMat.color.set(0xffffff); coreMat.color.set(0xffffff); }
  terrMat.needsUpdate=true; coreMat.needsUpdate=true; if(typeof drawMinimapBase==='function') drawMinimapBase(); }
document.querySelectorAll('#map-seg button').forEach(b=>b.onclick=()=>setMap(b.dataset.map));
function setTerrEx(on){ terrEx=on?2:1; shapeTerrain(); refreshHeights(); $('tg-terr').classList.toggle('active',on); }
function refreshHeights(){ labels.children.forEach(l=>{ const b=l.userData.base; if(b) l.position.y=hAt(b[0],b[1])+b[2]; }); bld.children.forEach(m=>{ const b=m.userData.base; if(b) m.position.y=hAt(b[0],b[1])+b[2]; }); rxGroup.children.forEach(m=>{ const b=m.userData.base; if(b) m.position.y=hAt(b[0],b[1])+b[2]; }); routeLines.forEach(r=>rebuildRouteLine(r)); }

/* ---------- 建物(簡易マッシング) ---------- */
const bld=new THREE.Group(); world.add(bld);
const M_WHITE=new THREE.MeshStandardMaterial({color:0xf7f7f2, roughness:0.6}), M_ROOF=new THREE.MeshStandardMaterial({color:0x2a3340, roughness:0.9}), M_STONE=new THREE.MeshStandardMaterial({color:0x8b8f86, roughness:1}),
      M_BLD=new THREE.MeshStandardMaterial({color:0xdfe4ea, roughness:0.8, transparent:true, opacity:0.92}), M_HOTEL=new THREE.MeshStandardMaterial({color:0xe9d5ff, roughness:0.7, transparent:true, opacity:0.95}),
      M_BRICK=new THREE.MeshStandardMaterial({color:0xb5563a, roughness:0.9}), M_GLASS=new THREE.MeshStandardMaterial({color:0x9fc3e0, roughness:0.3, metalness:0.4, transparent:true, opacity:0.9}), M_TEMPLE=new THREE.MeshStandardMaterial({color:0x6b3f2a, roughness:0.9});
function pyr(w,h,mat,x,z,y0=0,info=null){ const m=new THREE.Mesh(new THREE.ConeGeometry(w*0.72,h,4),mat); m.position.set(x,hAt(x,z)+y0+h/2,z); m.rotation.y=Math.PI/4; m.userData.base=[x,z,y0+h/2]; bld.add(m); if(info) pickable(m,info); return m; }
function box(w,h,d,mat,x,z,ry=0,y0=0,info=null){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,hAt(x,z)+y0+h/2,z); m.rotation.y=ry; m.userData.base=[x,z,y0+h/2]; bld.add(m); if(info) pickable(m,info); return m; }
/* 姫路城 大天守 (5層6階・地下1階, 高さ 石垣14.85 m + 建物31.5 m) */
(function(){
  const cx=0, cz=0; const info={kind:'spot', ref:SP.castle};
  const K=1.35; box(52*K,15*K,48*K,M_STONE,cx,cz,0,0,info);
  const tiers=[[36,7.5,32],[31,6.5,27],[26,6,22],[21,5.5,17],[15,5.5,12]].map(t=>t.map(v=>v*K)); let y=15*K;
  tiers.forEach((t,i)=>{ box(t[0],t[1],t[2],M_WHITE,cx,cz,0,y,info); const last=i===tiers.length-1; if(last){ pyr(t[0]+8,9,M_ROOF,cx,cz,y+t[1],info); } else { box(t[0]+8,1.4,t[2]+8,M_ROOF,cx,cz,0,y+t[1],info); pyr(t[0]+2,3.2,M_ROOF,cx,cz,y+t[1]+1.4,info); } y+=t[1]+1.4+(last?0:3.2)-3.2*(last?0:1)+ (last?0:3.2); });
  /* 小天守群(西・乾・東) */
  [[-22,4,18,14,3],[-18,-20,16,13,3],[22,-6,14,11,2]].forEach(k=>{ box(11,10,11,M_STONE,cx+k[0],cz+k[1],0,0,info); let yy=10; for(let i=0;i<k[4];i++){ const w=k[2]-i*3; box(w,4.6,w-2,M_WHITE,cx+k[0],cz+k[1],0,yy,info); if(i===k[4]-1) pyr(w+4,4,M_ROOF,cx+k[0],cz+k[1],yy+4.6,info); else box(w+4,0.9,w+2,M_ROOF,cx+k[0],cz+k[1],0,yy+4.6,info); yy+=5.5; } });
  /* 石垣・櫓(菱の門周辺) */
  const hishi=NODE.hishi; box(28,7,10,M_STONE,hishi.x,hishi.z,0,0,{kind:'sensor',ref:SENSORS[3]}); box(24,6,8,M_WHITE,hishi.x,hishi.z,0,7,info); box(28,0.9,12,M_ROOF,hishi.x,hishi.z,0,13,info);
  const ot=NODE.otemon; box(26,6,9,M_STONE,ot.x,ot.z,0,0,{kind:'spot',ref:SP.sannomaru}); box(22,5,7,M_WHITE,ot.x,ot.z,0,6,{kind:'spot',ref:SP.sannomaru}); box(26,0.9,10,M_ROOF,ot.x,ot.z,0,11,{kind:'spot',ref:SP.sannomaru});
})();
/* 姫路駅 · 駅ビル · 商業 · 公共 */
(function(){
  const st=LL(34.8265,134.6903); box(300,9,44,M_GLASS,st[0],st[1],-0.06,0,{kind:'gate',ref:GATES[1]}); box(330,6,26,M_BLD,st[0],st[1]-40,-0.06,10,{kind:'gate',ref:GATES[0]}); /* 新幹線高架 */
  const pi=LL(34.8276,134.6895); box(120,24,60,M_BLD,pi[0],pi[1],0,0,{kind:'spot',ref:SP.station});
  const pe=LL(34.8280,134.6925); box(60,22,50,M_BLD,pe[0],pe[1],0,0,{kind:'spot',ref:SP.station});
  const eg=LL(34.8347,134.6926); box(70,34,60,M_BLD,eg[0],eg[1],0,0,{kind:'spot',ref:SP.eagle});
  const art=SP.art; box(80,14,26,M_BRICK,art.x,art.z,0.1,0,{kind:'spot',ref:art}); box(80,0.8,28,M_ROOF,art.x,art.z,0.1,14,{kind:'spot',ref:art});
  const hi=SP.hist; box(60,16,50,M_BLD,hi.x,hi.z,0,0,{kind:'spot',ref:hi});
  const li=SP.lit; box(40,14,40,M_BLD,li.x,li.z,0.4,0,{kind:'spot',ref:li});
  const zoo=SP.zoo; box(30,6,20,M_BLD,zoo.x,zoo.z,0,0,{kind:'spot',ref:zoo});
  const ko=SP.kokoen; box(26,6,18,M_TEMPLE,ko.x+30,ko.z+20,0,0,{kind:'spot',ref:ko}); box(30,0.9,22,M_ROOF,ko.x+30,ko.z+20,0,6,{kind:'spot',ref:ko});
  const sh=SP.shosha; [[0,0,34],[-40,20,22],[35,-15,22]].forEach(k=>{ box(k[2],12,k[2]*0.8,M_TEMPLE,sh.x+k[0],sh.z+k[1],0.3,0,{kind:'spot',ref:sh}); box(k[2]+8,1.4,k[2]*0.8+8,M_ROOF,sh.x+k[0],sh.z+k[1],0.3,12,{kind:'spot',ref:sh}); });
  const hm=SP.hiromine; box(20,8,14,M_TEMPLE,hm.x,hm.z,0,0,{kind:'spot',ref:hm}); box(26,1,18,M_ROOF,hm.x,hm.z,0,8,{kind:'spot',ref:hm});
  const tg=SP.tegara; box(60,26,60,M_BLD,tg.x,tg.z,0.2,0,{kind:'spot',ref:tg}); box(14,60,14,M_BLD,tg.x+80,tg.z-40,0,0,{kind:'spot',ref:tg});
  /* 大手前通り沿いのオフィス・商業(簡易) */
  const lots=[[34.8290,134.6926,40,28],[34.8300,134.6945,38,30],[34.8312,134.6926,36,26],[34.8322,134.6946,40,32],[34.8330,134.6925,34,24],[34.8340,134.6948,46,26],[34.8296,134.6912,30,20],[34.8308,134.6910,30,18],[34.8320,134.6910,28,16],[34.8286,134.6948,44,34],[34.8305,134.6960,30,22],[34.8318,134.6960,30,20],[34.8255,134.6925,50,30],[34.8248,134.6880,40,28]];
  lots.forEach(l=>{ const p=LL(l[0],l[1]); box(l[2],l[3],l[2]*0.8,M_BLD,p[0],p[1],0,0,null); });
  /* ホテル */
  HOTELS.forEach(h=>{ box(34,h.h,28,M_HOTEL,h.x,h.z,0,0,{kind:'hotel',ref:h}); });
  /* 駐車場(平面) · バス乗降場 */
  GATES.filter(g=>g.kind==='park'||g.kind==='bus').forEach(g=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(g.kind==='bus'?60:80, g.kind==='bus'?30:60), new THREE.MeshStandardMaterial({color:g.kind==='bus'?0xb45309:0xf59e0b, roughness:1, transparent:true, opacity:0.55})); m.rotation.x=-Math.PI/2; m.position.set(g.x,hAt(g.x,g.z)+1.2,g.z); m.userData.base=[g.x,g.z,1.2]; bld.add(m); pickable(m,{kind:'gate',ref:g}); });
})();
/* ラベル */
SPOTS.forEach(s=>{ if(s.id==='otemae') return; addLabel(s.name, s.x, s.z, s.id==='castle'?75:(s.kind==='temple'?40:28), s.id==='castle'?26:16, '#ffffff', KIND_COL[s.kind]+'dd'); });
GATES.forEach(g=>{ if(g.kind==='rail') return; addLabel(g.name, g.x, g.z, 16, 11, '#ffffff', 'rgba(11,31,75,.75)'); });
addLabel('姫路駅 (新幹線・JR・山陽電車)', GATES[0].x, GATES[0].z+10, 40, 18, '#ffffff', 'rgba(26,94,217,.9)');
addLabel('大手前通り', SP.otemae.x, SP.otemae.z, 30, 14, '#ffffff', 'rgba(245,158,11,.85)');
HOTELS.forEach(h=>{ addLabel(h.name, h.x, h.z, h.h+14, 10, '#ffffff', 'rgba(192,38,211,.7)'); });
labels.children.forEach(l=>DYN_LABELS.push(l));
/* 地名(山・川) */
[['広峰山・増位山',34.8720,134.6960],['市川',34.8450,134.7180],['夢前川',34.8350,134.6500],['姫路バイパス(国道2号)',34.8150,134.6700],['山陽自動車道',34.8700,134.7150],['播但線',34.8600,134.7150],['姫新線',34.8600,134.6600]].forEach(n=>{ const p=LL(n[1],n[2]); const l=addLabel(n[0], p[0], p[1], 60, 14, '#0b1f4b', null); l.userData.k=1.3; DYN_LABELS.push(l); });

/* ---------- 路線・道路 (折れ線) ---------- */
const routeLines=[];
function rebuildRouteLine(r){ const pts=[]; const step=60; for(let s=0;s<=r.len;s+=step){ const p=routeAt(r,s); pts.push(new THREE.Vector3(p[0], hAt(p[0],p[1])+r.elev+0.6, p[1])); } r.line.geometry.dispose(); r.line.geometry=new THREE.BufferGeometry().setFromPoints(pts); }
Object.values(ROUTES).forEach(r=>{ r.line=new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:r.col, transparent:true, opacity:r.kind==='bus'?0.9:0.7})); rebuildRouteLine(r); world.add(r.line); routeLines.push(r); });
/* 歩行ネットワーク(薄く) */
const walkLines=(function(){ const pts=[]; EDGES.forEach(e=>{ const a=NODE[e[0]], b=NODE[e[1]]; if(!a||!b) return; const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/40); for(let i=0;i<n;i++){ const k0=i/n,k1=(i+1)/n; const x0=lerp(a.x,b.x,k0),z0=lerp(a.z,b.z,k0),x1=lerp(a.x,b.x,k1),z1=lerp(a.z,b.z,k1); pts.push(new THREE.Vector3(x0,hAt(x0,z0)+1,z0), new THREE.Vector3(x1,hAt(x1,z1)+1,z1)); } }); const l=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:0xe11d74, transparent:true, opacity:0.35})); world.add(l); return l; })();

/* ---------- センサー ---------- */
const rxGroup=new THREE.Group(); world.add(rxGroup); rxGroup.visible=false; const RXM=[];
SENSORS.forEach(s=>{ const g=new THREE.Group(); const y=hAt(s.x,s.z); g.position.set(s.x,y,s.z); g.userData.base=[s.x,s.z,0];
  if(!s.virt){ const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,9,6), new THREE.MeshStandardMaterial({color:0x22c55e})); pole.position.y=4.5; g.add(pole); const head=new THREE.Mesh(new THREE.SphereGeometry(2.4,10,8), new THREE.MeshStandardMaterial({color:0x22c55e, emissive:0x22c55e, emissiveIntensity:0.5})); head.position.y=10; g.add(head); pickable(head,{kind:'sensor',ref:s}); }
  const ring=new THREE.Mesh(new THREE.RingGeometry(s.r*0.92,s.r,48), new THREE.MeshBasicMaterial({color:0x22c55e, transparent:true, opacity:s.virt?0.25:0.6, side:THREE.DoubleSide, depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=1.5; g.add(ring);
  const pulse=new THREE.Mesh(new THREE.RingGeometry(0.9,1,40), new THREE.MeshBasicMaterial({color:0x22c55e, transparent:true, opacity:0.5, side:THREE.DoubleSide, depthWrite:false})); pulse.rotation.x=-Math.PI/2; pulse.position.y=1.6; g.add(pulse);
  const lb=makeLabel(s.id+' '+s.name, 12, '#ffffff', 'rgba(21,128,61,.85)'); lb.position.y=s.virt?60:16; g.add(lb); DYN_LABELS.push(lb);
  rxGroup.add(g); RXM.push({g,pulse,ph:Math.random()}); });
function renderRx(now){ if(!rxGroup.visible) return; RXM.forEach((m,i)=>{ const r=SENSORS[i]; const k=((now*0.0006)+m.ph)%1; m.pulse.scale.set(r.r*k,r.r*k,1); m.pulse.material.opacity=0.5*(1-k); }); }

/* ---------- 広域レイヤー ---------- */
const regGroup=new THREE.Group(); world.add(regGroup);
(function(){
  /* 距離リング */
  [50,100,200,300].forEach(km=>{ const r=R0+km*KM; const ring=new THREE.Mesh(new THREE.RingGeometry(r-25,r,128), new THREE.MeshBasicMaterial({color:0x8a93a3, transparent:true, opacity:0.35, side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.y=-1; regGroup.add(ring); const l=makeLabel(`${km} km`, 28, '#5b6472', null); l.position.set(r*0.71,60,-r*0.71); regGroup.add(l); DYN_LABELS.push(l); });
  /* 市域枠 */
  const fr=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(MOS.cx-HALF,30,MOS.cz-HALF),new THREE.Vector3(MOS.cx+HALF,30,MOS.cz-HALF),new THREE.Vector3(MOS.cx+HALF,30,MOS.cz+HALF),new THREE.Vector3(MOS.cx-HALF,30,MOS.cz+HALF)]), new THREE.LineBasicMaterial({color:0x1a5ed9})); regGroup.add(fr);
  const cityLbl=makeLabel('姫路市 (地理院タイル 9 km四方 · 実寸)', 36, '#0b1f4b', null); cityLbl.position.set(MOS.cx, 500, MOS.cz-HALF-400); regGroup.add(cityLbl); DYN_LABELS.push(cityLbl);
  /* ノード */
  Object.values(REG).forEach(n=>{ const air=n.kind==='air'; const m=new THREE.Mesh(air?new THREE.ConeGeometry(420,700,4):new THREE.CylinderGeometry(380,380,200,24), new THREE.MeshStandardMaterial({color:air?0xf59e0b:0x1a5ed9, roughness:0.6})); m.position.set(n.x,air?350:100,n.z); regGroup.add(m); pickable(m,{kind:'region',ref:n}); n.mesh=m;
    const l=makeLabel(n.name, 44, '#ffffff', air?'rgba(180,83,9,.9)':'rgba(11,31,75,.88)', n.sub); l.position.set(n.x,n.ly||1100,n.z); regGroup.add(l); DYN_LABELS.push(l); });
  ABROAD.forEach(a=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(520,16,12), new THREE.MeshStandardMaterial({color:0x2ec4c6, roughness:0.5})); m.position.set(a.x,520,a.z); regGroup.add(m); pickable(m,{kind:'abroad',ref:a}); a.mesh=m;
    const l=makeLabel(a.name, 48, '#ffffff', 'rgba(14,116,144,.9)', '海外発 · 関空/成田・羽田経由'); l.position.set(a.x,1500,a.z); regGroup.add(l); DYN_LABELS.push(l); });
  /* 新幹線・在来線の幹線(広域: 東西) */
  const mk=(pts,col,w)=>{ const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p[0],8,p[1]))), new THREE.LineBasicMaterial({color:col, transparent:true, opacity:0.55})); regGroup.add(l); };
  mk([[REG.fukuoka.x,REG.fukuoka.z],[REG.hiroshima.x,REG.hiroshima.z],[REG.okayama.x,REG.okayama.z],[-HALF,MOS.cz+150],[HALF,MOS.cz+150],[REG.kobe.x,REG.kobe.z],[REG.osaka.x,REG.osaka.z],[REG.kyoto.x,REG.kyoto.z],[REG.nagoya.x,REG.nagoya.z],[REG.tokyo.x,REG.tokyo.z]],0x1a5ed9);
  mk([[HALF,MOS.cz+200],[REG.kobe.x,REG.kobe.z+300],[REG.osaka.x,REG.osaka.z+300],[REG.kix.x,REG.kix.z]],0xf59e0b);
  mk([[0,MOS.cz-HALF],[REG.kinosaki.x,REG.kinosaki.z]],0x2ec4c6);
  mk([[-HALF*0.6,MOS.cz+HALF],[REG.awaji.x,REG.awaji.z],[REG.takamatsu.x,REG.takamatsu.z]],0x64748b);
})();
