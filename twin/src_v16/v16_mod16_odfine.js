/* ================================================================
   ▼ 拡張モジュール16: ◎ OD分析の細分化（v16）
   起点を「メッシュ起点」に細分化（建物代理点の密度×距離減衰の重力モデル）。
   起点→最寄りハブ（駅/LRT/駐車場）→アリーナの幹・枝の階層アーク、
   ハブ圏外は直行アーク。目的地はPOI・LRT各停留場・宿泊集積へ分解。
   KDEサーフェスは高解像度（208×136）に差替。OD行列パネルと行ホバーで強調。
================================================================ */
(function(){
'use strict';
const odBtn=document.getElementById('od-toggle');
const odOn=()=> !!odBtn && odBtn.classList.contains('active') && level!=='arena';
const sstep=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
const hx6=c=>'#'+c.toString(16).padStart(6,'0');
const G=new THREE.Group(); G.visible=false; scene.add(G);
const OF={cell:250, tree:true, hiKDE:true, zones:[], hubs:[], dests:[], hover:null};
const A={x:MAIN_C.x, z:MAIN_C.z};
const dots=SCENE_DATA.dots;

/* --- ハブ（幹）: 既存OD起点と同じ位置 --- */
OF.hubs=[
 {name:'JR宇都宮駅', x:stn.p[0], z:-stn.p[1], col:0x4da3ff, r:1300},
 {name:'LRT 駅東公園前', x:SCENE_DATA.lrt?SCENE_DATA.lrt.p[0]:-270, z:SCENE_DATA.lrt?-SCENE_DATA.lrt.p[1]:368, col:0xffa24a, r:900},
];
(function(){ const pk=(typeof ORIGINS!=='undefined')&&ORIGINS.find(o=>o.name==='駐車場A'); if(pk) OF.hubs.push({name:'駐車場A（車）', x:pk.x, z:pk.z, col:0x3ddc84, r:700}); })();

/* --- メッシュ起点（重力モデル）: 半径2.6km内 --- */
function buildZones(cell){
  const R=2600, nx=Math.ceil(2*R/cell);
  const cnt=new Map();
  for(let i=0;i<dots.length;i+=2){
    const x=dots[i], z=-dots[i+1]; if(Math.hypot(x-A.x,z-A.z)>R) continue;
    const ci=Math.floor((x-(A.x-R))/cell), cj=Math.floor((z-(A.z-R))/cell), k=cj*nx+ci;
    cnt.set(k,(cnt.get(k)||0)+1);
  }
  const zs=[]; let tot=0;
  cnt.forEach((n,k)=>{
    if(n<10) return;
    const ci=k%nx, cj=(k-ci)/nx, x=A.x-R+(ci+0.5)*cell, z=A.z-R+(cj+0.5)*cell;
    const d=Math.hypot(x-A.x,z-A.z); if(d<250) return;
    const w=n/(1+Math.pow(d/900,1.6));
    let hub=null, hd=1e9; OF.hubs.forEach(h=>{ const dd=Math.hypot(x-h.x,z-h.z); if(dd<h.r && dd<hd){ hd=dd; hub=h; } });
    const dir=['北','北東','東','南東','南','南西','西','北西'][Math.round(((Math.atan2(x-A.x, -(z-A.z))*180/Math.PI)+360)%360/45)%8];
    zs.push({x,z,n,w,hub,d,name:dir+' '+(d/1000).toFixed(1)+'km'});
    tot+=w;
  });
  zs.forEach(z=>{ z.share=0.62*z.w/tot; });   /* 近隣居住・通勤圏 62% / 残りは既存ゲートウェイ */
  zs.sort((a,b)=>b.share-a.share);
  const kept=zs.slice(0,120); const kt=kept.reduce((a,z)=>a+z.share,0); kept.forEach(z=>{ z.share=z.share*0.62/(kt||1); });
  return kept;
}
/* --- 目的地の細分化 --- */
function buildDests(){
  const ds=[];
  const poiP=n=>{ const p=SCENE_DATA.pois.find(q=>q.n===n); return p?{x:p.p[0], z:-p.p[1]}:null; };
  SCENE_DATA.pois.forEach(p=>{ ds.push({name:'回遊: '+p.n, x:p.p[0], z:-p.p[1], share:({shop:0.035,tour:0.02,biz:0.03,edu:0.006})[p.c]||0.01, col:0xe87ca0, sig:130}); });
  LRT_STOPS.forEach((s,i)=>{ ds.push({name:'直帰: LRT '+s.n, x:s.p[0], z:-s.p[1], share:0.18*Math.pow(0.72,i)/3.1, col:0xffa24a, sig:110}); });
  if(HOTELS.length){ const cx=HOTELS.reduce((a,h)=>a+h.p[0],0)/HOTELS.length, cz=-HOTELS.reduce((a,h)=>a+h.p[1],0)/HOTELS.length; ds.push({name:'宿泊: 駅周辺ホテル集積', x:cx, z:cz, share:0.036, col:0x35d0c0, sig:160}); }
  return ds;
}

/* --- アーク（基底と同じ位相帯シェーダー） --- */
const unis=[];
function arc(a,b,col,share,thin,tag){
  const mid=new THREE.Vector3((a.x+b.x)/2,0,(a.z+b.z)/2), d=Math.hypot(a.x-b.x,a.z-b.z);
  mid.y=(thin?18:45)+d*(thin?0.10:0.16);
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x,5,a.z), mid, new THREE.Vector3(b.x,5,b.z));
  const geo=new THREE.TubeGeometry(curve, thin?28:48, (thin?1.0:2.5)+share*(thin?90:24), 5, false);
  const uni={uCol:{value:new THREE.Color(col)}, uTime:{value:Math.random()*4}, uAct:{value:0}, uSel:{value:1}, tag};
  const mat=new THREE.ShaderMaterial({uniforms:uni, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'varying vec2 vUv; uniform vec3 uCol; uniform float uTime,uAct,uSel; void main(){ float band=pow(0.5+0.5*sin((vUv.x*3.0-uTime)*6.28318),3.0); float head=smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x); float a=uAct*uSel*(0.10+0.55*band)*head; gl_FragColor=vec4(uCol*(0.55+0.75*band),a); }'});
  G.add(new THREE.Mesh(geo,mat)); unis.push(uni); return uni;
}
const arrG=new THREE.Group(), depG=new THREE.Group(), lblG=new THREE.Group(); G.add(arrG,depG,lblG);
let arrU=[], depU=[];
function clear(g){ while(g.children.length){ const c=g.children.pop(); if(c.geometry) c.geometry.dispose(); if(c.material){ if(c.material.map) c.material.map.dispose(); c.material.dispose(); } } }
function rebuild(){
  clear(arrG); clear(depG); clear(lblG); unis.length=0; arrU=[]; depU=[];
  OF.zones=buildZones(OF.cell); OF.dests=buildDests();
  OF.zones.forEach(z=>{
    const to = (OF.tree && z.hub) ? z.hub : A;
    arrU.push(arc(z, to, z.hub ? z.hub.col : 0x9ab0ff, z.share, true, z));
    /* 起点メッシュのフットプリント（薄い板） */
    const m=new THREE.Mesh(new THREE.BoxGeometry(OF.cell*0.86, 1.2, OF.cell*0.86), new THREE.MeshBasicMaterial({color: z.hub?z.hub.col:0x9ab0ff, transparent:true, opacity:0.10+Math.min(0.5, z.share*14), blending:THREE.AdditiveBlending, depthWrite:false}));
    m.position.set(z.x, 1.6, z.z); lblG.add(m);
  });
  OF.dests.forEach(d=>{ depU.push(arc(A, d, d.col, d.share, true, d)); });
  /* 主要メッシュのラベル（上位8） */
  OF.zones.slice(0,8).forEach(z=>{ const lb=makeLabel(z.name+' '+(z.share*100).toFixed(1)+'%', 8, hx6(z.hub?z.hub.col:0x9ab0ff)); lb.position.set(z.x, 40, z.z); lblG.add(lb); });
  kde.lastT=-99;
}

/* --- 高解像度KDE（基底の103×79を隠して差替） --- */
const kde={mesh:null, lastT:-99};
(function(){
  const geo=new THREE.PlaneGeometry(5200,3400,208,136); geo.rotateX(-Math.PI/2);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*3),3));
  kde.mesh=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.62, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
  kde.mesh.position.set(-500,2.2,-100); G.add(kde.mesh);
})();
let baseKde=null;
scene.traverse(o=>{ if(o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.widthSegments===103 && o.geometry.parameters.heightSegments===79) baseKde=o; });
function sources(t){
  const arr=sstep(55,185,t), dep=sstep(322,405,t), s=[];
  OF.zones.forEach(z=> s.push([z.x,z.z,z.share*(1-arr),140]));
  OF.hubs.forEach(h=> s.push([h.x,h.z,0.10*(1-arr),160]));
  s.push([520,-1520,0.12*(1-arr),330]); s.push([-2680,1160,0.08*(1-arr),360]);
  s.push([A.x,A.z,Math.max(0,arr-dep)*1.05,210]);
  OF.dests.forEach(d=> s.push([d.x,d.z,d.share*dep,d.sig]));
  [[OF.hubs[0],0.25],[OF.hubs[1]||OF.hubs[0],0.06],[OF.hubs[2]||OF.hubs[0],0.32]].forEach(p=> s.push([p[0].x,p[0].z,p[1]*dep,150]));
  return s.filter(v=>v[2]>0.003);
}
function updateKde(force){
  if(!OF.hiKDE || !odOn()) return;
  const t=timeState.min; if(!force && Math.abs(t-kde.lastT)<1.2) return; kde.lastT=t;
  const srcs=sources(t), pos=kde.mesh.geometry.attributes.position, col=kde.mesh.geometry.attributes.color;
  const ox=kde.mesh.position.x, oz=kde.mesh.position.z, n=pos.count, H=new Float32Array(n); let mx=0.0001;
  for(let i=0;i<n;i++){
    const wx=pos.getX(i)+ox, wz=pos.getZ(i)+oz; let h=0;
    for(let k=0;k<srcs.length;k++){ const sg=srcs[k][3]; const dx=wx-srcs[k][0], dz=wz-srcs[k][1], d2=dx*dx+dz*dz; if(d2<sg*sg*9) h+=srcs[k][2]*Math.exp(-d2/(2*sg*sg)); }
    H[i]=h; if(h>mx) mx=h;
  }
  const c=new THREE.Color();
  for(let i=0;i<n;i++){ const k=H[i]/mx; pos.setY(i,k*250); c.copy(heatC(Math.min(1,k*1.12))).multiplyScalar(Math.min(1,0.10+k*1.4)); col.setXYZ(i,c.r,c.g,c.b); }
  pos.needsUpdate=true; col.needsUpdate=true;
}
function applyVis(){
  const on=odOn(); G.visible=on;
  if(baseKde) baseKde.visible = on ? !OF.hiKDE : baseKde.visible;
  if(on && OF.hiKDE) updateKde(true);
}
let last=performance.now();
const baseLoop16=loop;
loop=function(now){
  baseLoop16(now);
  const dt=Math.min(0.1,(now-last)/1000); last=now;
  const on=odOn(); if(G.visible!==on) applyVis();
  if(!on) return;
  updateKde(false);
  const t=timeState.min;
  const aw=sstep(48,70,t)*(1-sstep(188,220,t)), dw=sstep(315,335,t)*(1-sstep(408,420,t));
  arrU.forEach(u=>{ u.uAct.value=aw; u.uSel.value = OF.hover ? (u.tag===OF.hover || (u.tag.hub && u.tag.hub===OF.hover) ? 1 : 0.12) : 1; });
  depU.forEach(u=>{ u.uAct.value=dw; u.uSel.value = OF.hover ? (u.tag===OF.hover ? 1 : 0.12) : 1; });
  unis.forEach(u=> u.uTime.value+=dt*0.55);
};
if(odBtn) odBtn.addEventListener('click', ()=> setTimeout(applyVis, 0));
const baseSetLevel16=setLevel;
setLevel=function(lv,fly){ baseSetLevel16(lv,fly); applyVis(); };

/* --- パネル: OD細分化（基底のOD節の直後） --- */
function panelHTML(){
  const ch=(k,v,l)=>'<button class="chip '+(OF[k]===v?'active':'')+'" data-of="'+k+'" data-v="'+v+'">'+l+'</button>';
  const hubRows=OF.hubs.map(h=>{ const zs=OF.zones.filter(z=>z.hub===h); const sh=zs.reduce((a,z)=>a+z.share,0);
    return '<div class="li odf-row" data-hub="'+h.name+'"><div class="sw" style="background:'+hx6(h.col)+'"></div>'+h.name+'　<b style="color:var(--txt)">'+(sh*100).toFixed(1)+'%</b><span style="color:var(--sub)">　枝 '+zs.length+'メッシュ</span></div>'; }).join('');
  const direct=OF.zones.filter(z=>!z.hub);
  const zoneRows=OF.zones.slice(0,10).map((z,i)=>'<div class="li odf-row" data-zone="'+OF.zones.indexOf(z)+'"><div class="sw" style="background:'+hx6(z.hub?z.hub.col:0x9ab0ff)+'"></div>'+(i+1)+'. '+z.name+'　<b style="color:var(--txt)">'+(z.share*100).toFixed(1)+'%</b><span style="color:var(--sub)">　'+(z.hub?'→ '+z.hub.name:'直行')+'・建物'+z.n+'</span></div>').join('');
  return '<div class="sec" id="odf-sec"><div class="sec-t"><b>◎ OD細分化</b> — メッシュ起点 '+OF.zones.length+'・目的地 '+OF.dests.length+'</div>'
   +'<div class="row-btns" style="margin-bottom:5px">'+ch('cell',250,'起点250m')+ch('cell',500,'起点500m')+ch('tree',true,'幹＋枝')+ch('tree',false,'全て直行')+ch('hiKDE',true,'KDE高解像')+ch('hiKDE',false,'KDE標準')+'</div>'
   +'<div class="sec-t">ハブ集約（幹）</div><div class="legend">'+hubRows+'<div class="li"><div class="sw" style="background:#9ab0ff"></div>ハブ圏外 直行　<b style="color:var(--txt)">'+(direct.reduce((a,z)=>a+z.share,0)*100).toFixed(1)+'%</b><span style="color:var(--sub)">　'+direct.length+'メッシュ</span></div></div>'
   +'<div class="sec-t" style="margin-top:6px">起点メッシュ 上位10（ホバーで強調）</div><div class="legend">'+zoneRows+'</div>'
   +'<div class="hint" style="margin-top:6px">起点シェア＝建物代理点数 ÷ (1+(距離/900m)^1.6) の重力モデル（近隣・通勤圏 62%、既存ゲートウェイ 38%）。目的地はPOI・LRT各停留場・宿泊集積へ分解。xPop等の実測ODで置換可能。</div></div>';
}
function bind(){
  const sec=document.getElementById('odf-sec'); if(!sec) return;
  sec.querySelectorAll('[data-of]').forEach(b=> b.onclick=()=>{ const k=b.dataset.of, v=b.dataset.v; OF[k]= (v==='true')?true:(v==='false')?false:+v; rebuild(); applyVis(); renderPanel(); });
  sec.querySelectorAll('.odf-row').forEach(r=>{
    r.onmouseenter=()=>{ OF.hover = r.dataset.hub ? OF.hubs.find(h=>h.name===r.dataset.hub) : OF.zones[+r.dataset.zone]; };
    r.onmouseleave=()=>{ OF.hover=null; };
  });
}
const baseRenderPanel16=renderPanel;
renderPanel=function(){
  baseRenderPanel16();
  const od=document.getElementById('od-sec');
  if(od && odOn()){ od.insertAdjacentHTML('afterend', panelHTML()); bind(); }
};
rebuild();
window.__odFine=OF;
})();
