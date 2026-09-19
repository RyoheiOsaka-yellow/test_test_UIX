
/* ================= 3D人流表現 — 地域メッシュ柱 / 軌跡ライン / 階層ビュー =================
   ・メッシュ: 総務省 地域メッシュ（JIS X 0410）準拠。4次(500m) / 5次(250m) / 6次(125m)。柱の高さ＝滞在人数、色＝密度 or 主セグメント
   ・軌跡: 来訪者ごとの1日の移動軌跡を線で蓄積（建物は半透明の白）。時空間モードは高さ＝経過時刻
   ・階層: 大天守・駅・商業施設の「階ごとの滞留」を積層スラブで表示（高さ情報による階層分離のイメージ）
   数値はシミュレーション由来の想定値（実測ではありません） */
const DEG_MX = 111320*Math.cos(CLAT*Math.PI/180), DEG_MY = 110574;
const toLL = (x, z)=> ({lat: CLAT - z/DEG_MY, lon: CLON + x/DEG_MX});
const toXZ = (lat, lon)=> ({x:(lon-CLON)*DEG_MX, z:-(lat-CLAT)*DEG_MY});
function meshCode(lat, lon, res){
  const p=Math.floor(lat*1.5), u=Math.floor(lon-100);
  const q=Math.floor((lat*1.5-p)*8), v=Math.floor((lon-100-u)*8);
  const r=Math.floor(((lat*1.5-p)*8-q)*10), w=Math.floor(((lon-100-u)*8-v)*10);
  let code=`${p}${u}-${q}${v}-${r}${w}-`;
  let la=((lat*1.5-p)*8-q)*10-r, lo=((lon-100-u)*8-v)*10-w;
  const levels = res===500?1:res===250?2:3;
  for(let i=0;i<levels;i++){ const a=la<0.5?0:1, b=lo<0.5?0:1; code += (a*2+b+1); la=(la-a*0.5)*2; lo=(lo-b*0.5)*2; }
  return code;
}
function rampC(stops, v){
  v = clamp(v, 0, 1);
  for(let i=0;i<stops.length-1;i++){ if(v <= stops[i+1][0]){ const k=(v-stops[i][0])/(stops[i+1][0]-stops[i][0]); return new THREE.Color(stops[i][1]).lerp(new THREE.Color(stops[i+1][1]), k); } }
  return new THREE.Color(stops[stops.length-1][1]);
}

/* ---------- メッシュ（地域メッシュ JIS / 正方グリッド 50-100-250m / ヘックス ≈H3） ----------
   スタイル: 3d 柱（高さ＝人数^0.75） / 2d 面（GIS風） / column 円柱（対数段階: 100人 低・1,000人 中・5,000人 高） / hex 六角柱（大きさ＝滞留割合）
   情報軸: 高さ＝人数、色＝密度（Blue→Cyan→Yellow→Orange→Red）または主セグメント、不透明度＝信頼度（サンプル数）、サイズ＝滞留（ヘックス） */
const MESH = { on:false, kind:'sq', res:10, opacity:.90, gap:.10, lock:false, colorMax:0, epoch:0, style:'3d', color:'density', group:new THREE.Group(), inst:null, cells:[], byKey:new Map(), dl:0, dn:0, max:300, dirty:true, lastPaint:0, hover:-1, shapeKey:'' };
MESH.group.visible=false; scene.add(MESH.group);
const MESH_RANGE = {x:3900, z:3500};
const MESH_HSCALE = {500:0.75, 250:1.0, 125:1.3, 100:1.4, 50:1.9, 174:1.15, 66:1.7};   // 柱の高さ係数（h = k × 人数^0.75）
const MESH_MINMAX = {500:800, 250:400, 125:200, 100:160, 50:80, 174:300, 66:120};      // 色スケール下限（人）
const DENS_RAMP = [[0,0x2959d9],[0.25,0x33d9f2],[0.5,0xffd84d],[0.75,0xff8c26],[1,0xf23333]];   // 混雑度 低 Blue→Cyan→Yellow→Orange→Red 高
const MESH_POI = SCENE_DATA.pois.filter(p=>p.n).map(p=>({n:p.n, x:p.p[0], z:-p.p[1]}));
const HEX_R = {174:174, 66:66};    // 六角形の外接半径 m（H3 res9 ≒ 174m、res10 ≒ 66m 相当）
function nearPOI(cx, cz, lim){ let near='', nd=1e9; for(const p of MESH_POI){ const q=(p.x-cx)**2+(p.z-cz)**2; if(q<nd){ nd=q; near=p.n; } } return nd<lim*lim ? near : ''; }
/* Precision mesh: sparse, exact aggregation. No generated samples. */
function meshIndex(x,z){
  if(MESH.kind==='jis'){const ll=toLL(x,z);return [Math.floor(ll.lon/MESH.dn),Math.floor(ll.lat/MESH.dl)];}
  if(MESH.kind==='sq') return [Math.floor(x/MESH.res),Math.floor(z/MESH.res)];
  const R=MESH.res,qf=(Math.sqrt(3)/3*x-z/3)/R,rf=2*z/(3*R);
  let q=Math.round(qf),r=Math.round(rf),s=Math.round(-qf-rf);
  const dq=Math.abs(q-qf),dr=Math.abs(r-rf),ds=Math.abs(s+qf+rf);
  if(dq>dr&&dq>ds)q=-r-s;else if(dr>ds)r=-q-s;
  return [q,r];
}
function meshEnsure(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>MESH_RANGE.x||Math.abs(z)>MESH_RANGE.z)return -1;
  const [i,j]=meshIndex(x,z),key=i+','+j,old=MESH.byKey.get(key);if(old!==undefined)return old;
  let cx,cz,w,d,code;
  if(MESH.kind==='jis'){
    const a=toXZ(j*MESH.dl,i*MESH.dn),b=toXZ((j+1)*MESH.dl,(i+1)*MESH.dn);
    cx=(a.x+b.x)/2;cz=(a.z+b.z)/2;w=b.x-a.x;d=a.z-b.z;code=meshCode((j+.5)*MESH.dl,(i+.5)*MESH.dn,MESH.res);
  }else if(MESH.kind==='hex'){
    cx=Math.sqrt(3)*MESH.res*(i+j/2);cz=1.5*MESH.res*j;w=Math.sqrt(3)*MESH.res;d=2*MESH.res;code=`H${MESH.res}-${i}:${j}`;
  }else{cx=(i+.5)*MESH.res;cz=(j+.5)*MESH.res;w=d=MESH.res;code=`G${MESH.res}-${i}:${j}`;}
  const k=MESH.cells.length;
  MESH.cells.push({i,j,cx,cz,w,d,area:MESH.kind==='hex'?3*Math.sqrt(3)/2*MESH.res*MESH.res:w*d,y:TH(cx,cz),code,v:0,stay:0,seg:[0,0,0],near:nearPOI(cx,cz,Math.max(w,45)),in:{},out:{},ag:[]});
  MESH.byKey.set(key,k);return k;
}
function meshPosition(a){
  if(a.state!=='castle')return a.cur;
  if(a.zr===undefined)a.zr=rnd();let acc=0,zn=ZONES[ZONES.length-1];for(const zz of ZONES){acc+=zz.frac;if(a.zr<=acc){zn=zz;break;}}
  return {x:zn.node.x+a.jx*.35,z:zn.node.z+a.jz*.35};
}
function buildMesh(res,kind){
  MESH.res=res;if(kind)MESH.kind=kind;MESH.epoch=(MESH.epoch||0)+1;MESH.hover=-1;
  if(window.twinDb)twinDb.meshKey='';
  MESH.group.children.slice().forEach(o=>{MESH.group.remove(o);o.geometry?.dispose();o.material?.dispose();});
  MESH.fade=[];MESH.inst=null;MESH.shapeKey='';MESH.cells=[];MESH.byKey=new Map();
  if(MESH.kind==='jis'){MESH.dl=res===500?1/240:res===250?1/480:1/960;MESH.dn=res===500?1/160:res===250?1/320:1/640;}
  MESH.max=1;MESH.dirty=true;
  if(!(window.twinDb&&twinDb.on))meshAccumulate(0);else meshRebuildShape();
  paintMesh();
}
function meshRebuildShape(){
  const shape=MESH.style==='column'?'col':MESH.kind==='hex'?'hex':'box';
  const capacity=Math.max(256,2**Math.ceil(Math.log2(Math.max(1,MESH.cells.length))));
  const key=shape+'|'+capacity;
  if(key===MESH.shapeKey&&MESH.inst){MESH.inst.count=MESH.cells.length;return;}
  MESH.shapeKey=key;
  if(MESH.inst){MESH.group.remove(MESH.inst);MESH.inst.geometry.dispose();MESH.inst.material.dispose();}
  const geo=shape==='box'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,shape==='hex'?6:24,1);
  geo.translate(0,.5,0);
  const mat=new THREE.MeshStandardMaterial({transparent:true,opacity:MESH.opacity,roughness:.55,metalness:.08,emissive:0x103d45,emissiveIntensity:.18});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCellPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCellPosition=position;');
    const edge=shape==='box'?'smoothstep(.455,.495,max(abs(vCellPosition.x),abs(vCellPosition.z)))':shape==='hex'?'smoothstep(.83,.865,max(abs(vCellPosition.x),max(abs(.5*vCellPosition.x+.8660254*vCellPosition.z),abs(.5*vCellPosition.x-.8660254*vCellPosition.z))))':'smoothstep(.91,.99,length(vCellPosition.xz))';
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCellPosition;').replace('#include <dithering_fragment>',`float rim=${edge}; float cap=smoothstep(.975,1.0,vCellPosition.y); gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb*.55+vec3(.24,.37,.38),rim*cap*.65);\n#include <dithering_fragment>`);
  };
  mat.customProgramCacheKey=()=>shape;
  const inst=new THREE.InstancedMesh(geo,mat,capacity);inst.count=MESH.cells.length;
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);inst.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled=false;inst.userData={mesh:true};MESH.inst=inst;MESH.group.add(inst);MESH.dirty=true;
}
function meshCell(x,z){const [i,j]=meshIndex(x,z);const k=MESH.byKey.get(i+','+j);return k===undefined?-1:k;}
function agTh(){return window.twinDb&&twinDb.on?1:AG_SCALE;}
function meshAccumulate(dtMin){
  if(window.twinDb&&twinDb.on)return;
  const cells=MESH.cells,tnow=timeState.min,bkt=Math.floor((tnow+360)/10);
  cells.forEach(c=>{c.v=0;c.stay=0;c.seg.fill(0);c.ag.length=0;});
  for(const a of agents){
    if(!segByFilter(a.seg))continue;const p=meshPosition(a),k=meshEnsure(p.x,p.z);
    if(a.meshEpoch!==MESH.epoch){a.meshEpoch=MESH.epoch;a.cellK=-1;}
    if(k!==a.cellK){if(a.cellK>=0&&cells[a.cellK]){const c=cells[a.cellK];c.out[bkt]=(c.out[bkt]||0)+1;}if(k>=0){const c=cells[k];c.in[bkt]=(c.in[bkt]||0)+1;}a.cellK=k;}
    if(k<0)continue;const c=cells[k];c.ag.push(a);c.v+=AG_SCALE;const si=SEG_KEYS.indexOf(a.seg);if(si>=0)c.seg[si]+=AG_SCALE;if(a.state!=='move')c.stay+=AG_SCALE;
  }
  let mx=0;cells.forEach(c=>{mx=Math.max(mx,c.v);if(c.v>(c.peak||0)){c.peak=c.v;c.peakT=tnow;}});MESH.max=Math.max(1,mx);
  meshRebuildShape();MESH.dirty=true;
}
const _MM=new THREE.Matrix4(),_MQ=new THREE.Quaternion(),_MS=new THREE.Vector3(),_MP=new THREE.Vector3(),_MC=new THREE.Color();
function columnH(people){return people<=0?0:12*Math.log2(1+people/8);}
function meshArea(c){return c.area||(MESH.kind==='hex'?3*Math.sqrt(3)/2*MESH.res*MESH.res:c.w*c.d);}
function meshDensity(c){return c.v*10000/meshArea(c);}
function paintMesh(){
  if(!MESH.inst||!MESH.dirty)return;MESH.dirty=false;
  const flat=MESH.style==='2d',col=MESH.style==='column',hex=MESH.kind==='hex',hs=CONFIG.peopleFlow.heightScale;
  const active=MESH.cells.filter(c=>c.v>0),dens=active.map(meshDensity).sort((a,b)=>a-b);
  if(!MESH.lock||!MESH.colorMax)MESH.colorMax=Math.max(1,dens[Math.max(0,Math.ceil(dens.length*.95)-1)]||1);
  let total=0;
  MESH.cells.forEach((c,k)=>{
    const r=Math.log1p(Math.min(1,meshDensity(c)/MESH.colorMax)*9)/Math.log(10);
    const h=flat?1.4:Math.min(600,(col?columnH(c.v):Math.pow(c.v,.65)*2.8)*hs);
    let sx,sz;if(col)sx=sz=Math.min(c.w,c.d)*.32;else if(hex)sx=sz=MESH.res*(1-MESH.gap);else{sx=c.w*(1-MESH.gap);sz=c.d*(1-MESH.gap);}
    if(c.v<=0)sx=sz=0;
    _MP.set(c.cx,c.y+.7,c.cz);_MS.set(sx,Math.max(.01,h),sz);_MM.compose(_MP,_MQ,_MS);MESH.inst.setMatrixAt(k,_MM);
    if(MESH.color==='seg'&&!c.db){let si=0;for(let s=1;s<3;s++)if(c.seg[s]>c.seg[si])si=s;_MC.setHex(SEG[SEG_KEYS[si]].col);}
    else _MC.copy(rampC(DENS_RAMP,r));
    if(k===MESH.hover)_MC.lerp(_WHITE,.4);MESH.inst.setColorAt(k,_MC);total+=c.v;
  });
  MESH.active=active.length;MESH.total=total;
  MESH.inst.instanceMatrix.needsUpdate=true;MESH.inst.instanceColor.needsUpdate=true;
  MESH.inst.material.opacity=typeof CONT!=='undefined'&&CONT.on ? .26 : MESH.opacity;
  precisionRefresh();
}

function meshTop(n=5){ return MESH.cells.filter(c=>c.v>=agTh()).sort((a,b)=>b.v-a.v).slice(0,n); }
function setMesh(on){
  MESH.on=on; if(on && !MESH.inst) buildMesh(MESH.res, MESH.kind);
  MESH.group.visible = on && level!=='wide';
  document.getElementById('mesh-toggle').classList.toggle('active', on);
  if(on){ if(level==='wide') setLevel('city'); toast(`メッシュ人流: ${MESH.kind==='jis'?'地域メッシュ':MESH.kind==='sq'?'正方グリッド':'ヘックス'} ${MESH.res}m。高さ＝滞在人数（1ドット＝${AG_SCALE}人）、色＝面積あたり人口密度。ホバーでメッシュコードと人数`, 4200); }
  renderPanel();
}

/* ---------- 軌跡ライン（1日の移動軌跡を蓄積） ---------- */
const TRAJ = { on:false, mode:'ground', MAXSEG:400000, MAXSTOP:30000, n:0, up:0, sn:0, sup:0, full:false, step:36, tScale:0.6, group:new THREE.Group(), trips:0 };
TRAJ.group.visible=false; scene.add(TRAJ.group);
(function trajInit(){
  TRAJ.pos=new Float32Array(TRAJ.MAXSEG*6); TRAJ.col=new Float32Array(TRAJ.MAXSEG*6); TRAJ.gy=new Float32Array(TRAJ.MAXSEG*2); TRAJ.tt=new Float32Array(TRAJ.MAXSEG*2);
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(TRAJ.pos,3)); g.setAttribute('color', new THREE.BufferAttribute(TRAJ.col,3)); g.setAttribute('t', new THREE.BufferAttribute(TRAJ.tt,1)); g.setDrawRange(0,0);
  g.attributes.position.setUsage(THREE.DynamicDrawUsage); g.attributes.color.setUsage(THREE.DynamicDrawUsage); g.attributes.t.setUsage(THREE.DynamicDrawUsage);
  /* 累積（uAnim=0）と動く軌跡（uAnim=1: 現在時刻から uTrail 分の窓だけを、頭が明るく尾が消える TripsLayer 相当）を1つのシェーダで */
  TRAJ.mat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, vertexColors:true,
    uniforms:{ uNow:{value:0}, uTrail:{value:40}, uAnim:{value:0}, uOpacity:{value:0.5} },
    vertexShader:'attribute float t; varying float vT; varying vec3 vC; void main(){ vT=t; vC=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform float uNow,uTrail,uAnim,uOpacity; varying float vT; varying vec3 vC; void main(){ if(uAnim>0.5){ float age=uNow-vT; if(age<0.0||age>uTrail) discard; float f=1.0-age/uTrail; gl_FragColor=vec4(mix(vC,vec3(1.0),0.4*f*f)*(0.5+0.9*f), 0.12+0.88*f); } else { gl_FragColor=vec4(vC, uOpacity); } }' });
  TRAJ.geo=g; TRAJ.line=new THREE.LineSegments(g, TRAJ.mat);
  TRAJ.line.frustumCulled=false; TRAJ.group.add(TRAJ.line);
  TRAJ.spos=new Float32Array(TRAJ.MAXSTOP*3); TRAJ.scol=new Float32Array(TRAJ.MAXSTOP*3); TRAJ.sgy=new Float32Array(TRAJ.MAXSTOP); TRAJ.stt=new Float32Array(TRAJ.MAXSTOP);
  const sg=new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(TRAJ.spos,3)); sg.setAttribute('color', new THREE.BufferAttribute(TRAJ.scol,3)); sg.setDrawRange(0,0);
  TRAJ.sgeo=sg; TRAJ.stops=new THREE.Points(sg, new THREE.PointsMaterial({size:13, vertexColors:true, transparent:true, opacity:0.95, depthWrite:false, sizeAttenuation:true}));
  TRAJ.stops.frustumCulled=false; TRAJ.group.add(TRAJ.stops);
})();
function trajY(gy, t){ return TRAJ.mode==='time' ? gy + (t+360)*TRAJ.tScale*0.75 : gy; }
function trajColor(a){ if(!a.tjc){ const c=new THREE.Color(SEG[a.seg].col); c.offsetHSL(0, 0, (rnd()-0.5)*0.22); a.tjc=c; } return a.tjc; }
function trajPush(a, x, z){
  if(!a.tjl){ a.tjl=[x,z,timeState.min]; TRAJ.trips++; return; }
  if(TRAJ.full) return;
  const dx=x-a.tjl[0], dz=z-a.tjl[1]; if(dx*dx+dz*dz < TRAJ.step*TRAJ.step) return;
  const n=TRAJ.n; if(n>=TRAJ.MAXSEG){ TRAJ.full=true; return; }
  const y0=TH(a.tjl[0],a.tjl[1])+4, y1=TH(x,z)+4, c=trajColor(a), o=n*6, P=TRAJ.pos, C=TRAJ.col;
  P[o]=a.tjl[0]; P[o+1]=trajY(y0,a.tjl[2]); P[o+2]=a.tjl[1]; P[o+3]=x; P[o+4]=trajY(y1,timeState.min); P[o+5]=z;
  C[o]=c.r; C[o+1]=c.g; C[o+2]=c.b; C[o+3]=c.r; C[o+4]=c.g; C[o+5]=c.b;
  TRAJ.gy[n*2]=y0; TRAJ.gy[n*2+1]=y1; TRAJ.tt[n*2]=a.tjl[2]; TRAJ.tt[n*2+1]=timeState.min;
  a.tjl=[x,z,timeState.min]; TRAJ.n=n+1;
}
function trajStop(a, x, z){
  if(TRAJ.sn>=TRAJ.MAXSTOP) return;
  const n=TRAJ.sn, c=trajColor(a), gy=TH(x,z)+5;
  TRAJ.spos[n*3]=x; TRAJ.spos[n*3+1]=trajY(gy,timeState.min); TRAJ.spos[n*3+2]=z;
  TRAJ.scol[n*3]=c.r; TRAJ.scol[n*3+1]=c.g; TRAJ.scol[n*3+2]=c.b; TRAJ.sgy[n]=gy; TRAJ.stt[n]=timeState.min;
  TRAJ.sn=n+1; a.tjl=[x,z,timeState.min];
}
function trajUpload(){
  const g=TRAJ.geo;
  if(TRAJ.n>TRAJ.up){ const pa=g.attributes.position, ca=g.attributes.color, ta=g.attributes.t; pa.updateRange={offset:TRAJ.up*6, count:(TRAJ.n-TRAJ.up)*6}; ca.updateRange={offset:TRAJ.up*6, count:(TRAJ.n-TRAJ.up)*6}; ta.updateRange={offset:TRAJ.up*2, count:(TRAJ.n-TRAJ.up)*2}; pa.needsUpdate=true; ca.needsUpdate=true; ta.needsUpdate=true; g.setDrawRange(0, TRAJ.n*2); TRAJ.up=TRAJ.n; }
  if(TRAJ.sn>TRAJ.sup){ const pa=TRAJ.sgeo.attributes.position, ca=TRAJ.sgeo.attributes.color; pa.updateRange={offset:TRAJ.sup*3, count:(TRAJ.sn-TRAJ.sup)*3}; ca.updateRange={offset:TRAJ.sup*3, count:(TRAJ.sn-TRAJ.sup)*3}; pa.needsUpdate=true; ca.needsUpdate=true; TRAJ.sgeo.setDrawRange(0, TRAJ.sn); TRAJ.sup=TRAJ.sn; }
}
function trajRelayout(){
  const P=TRAJ.pos; for(let i=0;i<TRAJ.n*2;i++) P[i*3+1]=trajY(TRAJ.gy[i], TRAJ.tt[i]);
  for(let i=0;i<TRAJ.sn;i++) TRAJ.spos[i*3+1]=trajY(TRAJ.sgy[i], TRAJ.stt[i]);
  TRAJ.up=0; TRAJ.sup=0; TRAJ.geo.attributes.position.updateRange={offset:0,count:-1}; TRAJ.sgeo.attributes.position.updateRange={offset:0,count:-1}; trajUpload();
}
function trajReset(){ TRAJ.n=0; TRAJ.up=0; TRAJ.sn=0; TRAJ.sup=0; TRAJ.full=false; TRAJ.trips=0; TRAJ.geo.setDrawRange(0,0); TRAJ.sgeo.setDrawRange(0,0); agents.forEach(a=>{ a.tjl=null; }); }
/* 建物のゴースト表示（半透明の白） */
const GHOST = { on:false, saved:null, mats:()=>[MAT.bldg, MAT.bldgNamed].concat((typeof PL!=='undefined' && PL.matL2) ? [PL.matL2] : []) };
function setGhost(on){
  if(GHOST.on===on) return; GHOST.on=on; const mats=GHOST.mats();
  if(on){ GHOST.saved=mats.map(m=>({color:m.color.getHex(), opacity:m.opacity, transparent:m.transparent, depthWrite:m.depthWrite, emissive:m.emissive.getHex(), ei:m.emissiveIntensity}));
    mats.forEach(m=>{ m.color.setHex(0xdfe9ee); m.transparent=true; m.opacity=0.2; m.depthWrite=false; m.emissive.setHex(0x8fa4ad); m.emissiveIntensity=0.35; m.needsUpdate=true; }); }
  else if(GHOST.saved){ mats.forEach((m,i)=>{ const s=GHOST.saved[i]; m.color.setHex(s.color); m.opacity=s.opacity; m.transparent=s.transparent; m.depthWrite=s.depthWrite; m.emissive.setHex(s.emissive); m.emissiveIntensity=s.ei; m.needsUpdate=true; }); }
}
function setTraj(on){
  TRAJ.on=on; TRAJ.group.visible = on && level!=='wide'; setGhost(on);
  document.getElementById('traj-toggle').classList.toggle('active', on);
  if(on){ if(level==='wide') setLevel('city'); trajUpload(); toast('軌跡ライン: 来訪者ごとの移動軌跡を1日分蓄積（点＝滞留した場所）。建物は半透明表示。「時空間」で高さ＝時刻', 4200); }
  renderPanel();
}

/* ---------- 階層ビュー（高さ方向の滞留 — 階ごとの積層スラブ） ---------- */
const stnProf = t=> 0.35+0.8*Math.exp(-Math.pow((t-210)/110,2))+0.9*Math.exp(-Math.pow((t-680)/120,2));
const shopProf = t=> 0.08+sstep(240,420,t)*(1-sstep(740,900,t));
const scnK = ()=> Math.sqrt(SCN[curScn].castle/7500);
const FLOOR_DEFS = [
  {id:'tenshu', n:'姫路城 大天守', at:()=>({x:CASTLE.x+120, z:CASTLE.z+30}), link:()=>({x:CASTLE.x+14, z:CASTLE.z}), foot:[34,30], fh:7.5,
    floors:['地階','1階','2階','3階','4階','5階','6階（最上階）'], share:[0.05,0.19,0.17,0.16,0.14,0.13,0.16], cap:[60,220,200,180,170,150,120],
    people:()=> zoneStats().find(z=>z.z.n==='大天守').occ, note:'階段が一方通行になる混雑時は上層階ほど滞留（想定）'},
  {id:'stn', n:'JR姫路駅（駅ビル含む）', at:()=>STN, foot:[130,52], fh:10,
    floors:['地下 グランフェスタ','1階 改札外・バス乗り場','2階 コンコース・改札','3階 在来線ホーム','3階 新幹線ホーム'], share:[0.14,0.22,0.30,0.22,0.12], cap:[900,1500,1800,1400,900],
    people:t=> (500+2600*stnProf(t))*scnK(), note:'乗車人員 91,574人/日（JR西日本 2023年度）を時間帯換算'},
  {id:'piole', n:'ピオレ姫路', at:()=>({x:P('ピオレ姫路').x, z:P('ピオレ姫路').z}), foot:[80,46], fh:8,
    floors:['1階','2階','3階','4階','5階','6階','7階 レストラン'], share:[0.24,0.18,0.14,0.12,0.11,0.10,0.11], cap:[520,420,380,360,340,320,300],
    people:t=> 1700*shopProf(t)*scnK(), note:'駅直結の商業施設（想定値）'},
  {id:'sanyo', n:'山陽百貨店（山陽姫路駅）', at:()=>({x:P('山陽姫路駅').x+30, z:P('山陽姫路駅').z-30}), foot:[70,50], fh:8,
    floors:['地下1階 食品','1階','2階','3階','4階','5階','6階','7階'], share:[0.20,0.19,0.13,0.11,0.10,0.10,0.09,0.08], cap:[420,400,300,280,260,260,240,220],
    people:t=> 1150*shopProf(t)*scnK(), note:'山陽電鉄 直上の百貨店（想定値）'},
];
const FLOORS = { on:false, group:new THREE.Group(), items:[], last:0 };
FLOORS.group.visible=false; scene.add(FLOORS.group);
const LVL_COL = { ok:0x3ddc84, mid:0xffd166, hi:0xff6b5e };
function buildFloors(){
  FLOOR_DEFS.forEach(d=>{
    const at=d.at(), base=TH(at.x, at.z);
    const g=new THREE.Group(); const item={d, g, slabs:[], labels:[], txt:[]};
    d.floors.forEach((fn,i)=>{
      const y=base + i*d.fh;
      const box=new THREE.Mesh(new THREE.BoxGeometry(d.foot[0], d.fh-0.9, d.foot[1]), new THREE.MeshStandardMaterial({color:0x3ddc84, transparent:true, opacity:0.5, roughness:0.6, emissive:0x3ddc84, emissiveIntensity:0.25, depthWrite:false}));
      box.position.set(at.x, y+(d.fh-0.9)/2+0.4, at.z); box.userData={floor:true, name:d.n, fi:i, id:d.id};
      const edge=new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.35})); edge.position.copy(box.position);
      g.add(box, edge); item.slabs.push(box);
      const lb=makeLabel(fn, 9, '#e8f4f2', 500); lb.position.set(at.x + d.foot[0]/2 + 34, y + d.fh*0.5, at.z); g.add(lb); item.labels.push(lb); item.txt.push('');
    });
    const title=makeLabel(d.n, 10, '#ffd166'); title.position.set(at.x, base + d.floors.length*d.fh + 14, at.z); g.add(title);
    if(d.link){ const l=d.link(); const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(l.x, TH(l.x,l.z)+2, l.z), new THREE.Vector3(at.x, base+1, at.z)]), new THREE.LineBasicMaterial({color:0xffd166, transparent:true, opacity:0.6})); g.add(ln); }
    FLOORS.group.add(g); FLOORS.items.push(item);
  });
}
function floorStats(){
  const t=timeState.min;
  return FLOOR_DEFS.map(d=>{ const tot=d.people(t); return {d, tot, rows:d.floors.map((fn,i)=>{ const n=tot*d.share[i], load=n/d.cap[i]; return {fn, n, load, lvl: load<0.5?'ok':(load<0.85?'mid':'hi')}; })}; });
}
function updateFloors(force){
  if(!FLOORS.on) return; const now=performance.now(); if(!force && now-FLOORS.last<350) return; FLOORS.last=now;
  if(!FLOORS.items.length) buildFloors();
  const st=floorStats();
  FLOORS.items.forEach((it,k)=>{
    st[k].rows.forEach((r,i)=>{
      const box=it.slabs[i]; box.material.color.setHex(LVL_COL[r.lvl]); box.material.emissive.setHex(LVL_COL[r.lvl]); box.material.opacity=0.28+Math.min(0.55, r.load*0.5);
      const s=0.6+Math.min(0.6, r.load*0.5); box.scale.set(s,1,s);
      const txt=`${r.fn}　${fmt(r.n)}人`;
      if(it.txt[i]!==txt){ it.txt[i]=txt; const old=it.labels[i]; const lb=makeLabel(txt, 9, r.lvl==='hi'?'#ff9b90':r.lvl==='mid'?'#ffe2a3':'#d9f7e6', 500); lb.position.copy(old.position); it.g.remove(old); if(old.material.map) old.material.map.dispose(); old.material.dispose(); it.g.add(lb); it.labels[i]=lb; }
    });
  });
}
function setFloors(on){
  FLOORS.on=on; FLOORS.group.visible = on && level!=='wide';
  document.getElementById('floor-toggle').classList.toggle('active', on);
  if(on){ if(level==='wide') setLevel('city'); updateFloors(true); if(level==='city') flyTo(new THREE.Vector3((STN.x+CASTLE.x)/2, TH((STN.x+CASTLE.x)/2,(STN.z+CASTLE.z)/2), (STN.z+CASTLE.z)/2+80), 1500, 1.05, -0.5, 1200); toast('階層ビュー: 大天守・駅・商業施設の「階ごとの滞留」を積層表示（高さ情報による階層分離のイメージ・想定値）', 4200); }
  renderPanel();
}

/* ---------- パネル（メッシュ / 軌跡 / 階層） ---------- */
const PAIR_COL = { wkd:'#3f8fd8', hol:'#c8811f' };
function residenceRows(){
  const groups = [['海外',['in']],['大阪府',['osaka']],['京都・滋賀・奈良',['kyoto']],['東京・首都圏',['tokyo']],['名古屋・東海',['nagoya']],['岡山・広島',['okayama']],['九州・沖縄',['kyushu']],['兵庫県内（市外）',['kakogawa','sanyo_loc','tatsuno','fukusaki']],['車（京阪神・岡山）',['car_e','car_w']]];
  const daily = (scn, ids)=>{ const sc=SCN[scn]; const tot=sc.castle*CITY_FACTOR; let v=0; ids.forEach(id=>{ if(id==='in') v+=tot*sc.mix.in; else { const o=ORIGIN_BY_ID[id]; v+=tot*sc.mix[o.seg]*o.share; } }); return v; };
  return groups.map(g=>[g[0], daily('wkd', g[1]), daily('wke', g[1])]);
}
function svgPairAbs(rows, W=248){
  const rh=19, L=92, R=48, H=rows.length*rh+16, mx=Math.max(...rows.flatMap(r=>[r[1],r[2]]));
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="平日と土日祝の居住地別来訪者数"><text x="${L}" y="9" font-size="8.5" fill="${PAIR_COL.wkd}">■ 平日</text><text x="${L+44}" y="9" font-size="8.5" fill="${PAIR_COL.hol}">■ 土日祝</text>
    ${rows.map((r,i)=>{ const y=14+i*rh, w1=(W-L-R)*r[1]/mx, w2=(W-L-R)*r[2]/mx;
      return `<text x="${L-6}" y="${y+11}" font-size="8.5" fill="#9eafb9" text-anchor="end">${r[0]}</text><rect x="${L}" y="${y+2}" width="${w1.toFixed(1)}" height="5" rx="2" fill="${PAIR_COL.wkd}"/><text x="${L+w1+3}" y="${y+7}" font-size="7.5" fill="#e8eaf2">${fmt(r[1])}</text><rect x="${L}" y="${y+9}" width="${w2.toFixed(1)}" height="5" rx="2" fill="${PAIR_COL.hol}"/><text x="${L+w2+3}" y="${y+14}" font-size="7.5" fill="#e8eaf2">${fmt(r[2])}</text>`; }).join('')}</svg>`;
}
function svgDonut(parts, label, R=30){
  const C=2*Math.PI*(R-7); let off=0;
  return `<svg viewBox="0 0 ${R*2} ${R*2+14}" width="${R*2}" role="img" aria-label="${label}"><g transform="translate(${R},${R}) rotate(-90)">${parts.map(p=>{ const len=C*p[1]; const s=`<circle r="${R-7}" fill="none" stroke="${p[2]}" stroke-width="11" stroke-dasharray="${(len-1.5).toFixed(1)} ${(C-len+1.5).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`; off+=len; return s; }).join('')}</g><text x="${R}" y="${R+4}" text-anchor="middle" font-size="9" fill="#e8eaf2" font-family="Oswald">${(parts[0][1]*100).toFixed(0)}%</text><text x="${R}" y="${R*2+10}" text-anchor="middle" font-size="8" fill="#9eafb9">${label}</text></svg>`;
}
function meshSec(){
  if(!MESH.on)return '';
  const chip=(k,v,l)=>`<button class="chip ${MESH[k]===v?'active':''}" data-mesh="${k}:${v}">${l}</button>`;
  const rchip=(kind,res,l)=>`<button class="chip ${MESH.kind===kind&&MESH.res===res?'active':''}" data-meshres="${kind}:${res}">${l}</button>`;
  const kind=MESH.kind==='hex'?'hex':'sq';
  return `<div class="sec"><div class="sec-t"><b>高精細メッシュ</b> — ${MESH.res}m ${kind==='hex'?'六角形の一辺':'正方形の一辺'}</div>
  <div class="row-btns">${[5,10,25,50,100,250].map(n=>rchip(kind,n,n+'m')).join('')}</div>
  <div class="row-btns" style="margin-top:8px">${FLOWVIS.mode!=='column'&&FLOWVIS.mode!=='contour'?chip('style','3d','立体')+chip('style','2d','平面'):''}${chip('color','density','人口密度')}${!(window.twinDb&&twinDb.on)?chip('color','seg','来訪者属性'):''}</div>
  <div class="hint" style="margin-top:8px">${window.twinDb&&twinDb.on?'API取得点または集計値を表示。5〜25m・六角形は取得点の再集計（最大20,000点）。母集団総数ではありません。':'シミュレーション位置をセルに集計。1ドット＝'+AG_SCALE+'人。人数のないセルは非表示。'}<br>細分化は表示・集計単位の変更です。位置データの測定精度は向上しません。${kind==='hex'?'六角形はローカル座標グリッド（H3 IDではありません）。':''}</div>
  <details style="margin-top:10px"><summary>地域メッシュ（JIS）</summary><div class="row-btns" style="margin-top:8px">${[125,250,500].map(n=>rchip('jis',n,n+'m')).join('')}</div></details>
  <div class="sec-t" style="margin-top:14px">滞在人数 上位セル</div><div id="mesh-top"></div></div>`;
}
function trajSec(){
  if(!TRAJ.on) return '';
  return `<div class="sec"><div class="sec-t"><b>〜 軌跡ライン</b> — 来訪者ごとの1日の動き</div>
      <div class="row-btns" style="margin-bottom:6px"><button class="chip ${!TRAJ.anim?'active':''}" data-traj="static">累積（1日分）</button><button class="chip ${TRAJ.anim?'active':''}" data-traj="anim">動く軌跡（時間窓）</button><button class="chip ${TRAJ.mode==='ground'?'active':''}" data-traj="ground">地表</button><button class="chip ${TRAJ.mode==='time'?'active':''}" data-traj="time">時空間</button><button class="chip" data-traj="clear">クリア</button></div>
      ${TRAJ.anim ? `<div class="studio-label" style="margin:6px 0 4px">時間窓 <output id="trail-v">${TRAJ.mat.uniforms.uTrail.value} 分</output></div><input id="trail-r" type="range" min="10" max="120" step="5" value="${TRAJ.mat.uniforms.uTrail.value}" style="width:100%">` : ''}
      <div class="kpi-grid"><div class="kpi"><div class="v" id="traj-trips">${fmt(TRAJ.trips)}</div><div class="l">記録トリップ（1ドット＝${AG_SCALE}人）</div></div><div class="kpi"><div class="v" id="traj-segs">${fmt(TRAJ.n)}</div><div class="l">線分数${TRAJ.full?'（上限）':''}</div></div></div>
      <div class="legend" style="margin-top:6px"><div class="li"><div class="sw" style="background:#65beff"></div>海外　<div class="sw" style="background:#62e4ab"></div>国内　<div class="sw" style="background:#ef91bb"></div>近隣　<b>●</b> 滞留した場所</div></div>
      <div class="hint" style="margin-top:6px">線＝道路網上の移動軌跡（同じ色相の明暗で個人を区別）、点＝城・回遊先・宿泊での滞留。「動く軌跡」は現在時刻から時間窓分だけを頭が明るく尾が消える形で再生（進む速さ＝歩行速度）。「時空間」では高さが時刻（00:00＝地表 → 24:00＝${Math.round(1440*TRAJ.tScale*0.75)}m）で、上に行くほど遅い時間。実データでは携帯位置情報のトリップ復元（総務省 GPS-ODと同様）で作成。</div></div>`;
}
function floorSec(){
  if(!FLOORS.on) return '';
  return `<div class="sec"><div class="sec-t"><b>≡ 階層ビュー</b> — 高さ方向の滞留（階ごと）</div><div id="floor-rows"></div>
      <div class="legend" style="margin-top:6px"><div class="li"><div class="sw" style="background:#3ddc84"></div>快適　<div class="sw" style="background:#ffd166"></div>やや混雑　<div class="sw" style="background:#ff6b5e"></div>混雑（容量比）</div></div>
      <div class="hint" style="margin-top:6px">緯度経度だけでは分からない<b>階（高さ）ごとの人の動き・滞留</b>を分離する表現。大天守は入場制限と階段の一方通行で上層階に滞留が集中、駅は改札階・ホーム階の分離、商業施設は階別の回遊が見える。実データは気圧センサ付き位置情報・BLE/Wi-Fi・階別カメラで取得する想定。</div></div>`;
}
function updateFlowPanels(){
  const mt=document.getElementById('mesh-top');
  if(mt){ mt.innerHTML = meshTop(5).map(c=>{ let si=0; for(let s=1;s<3;s++) if(c.seg[s]>c.seg[si]) si=s; return `<div class="zone-row"><div class="zn">${c.near||'—'}<small>${MESH.kind==='hex'?'ヘックス':'メッシュ'} ${c.code}</small></div>${c.db ? `<span class="pill" style="border-color:#33d9f2;color:#33d9f2">${c.meta&&c.meta.congestion_index!=null?'混雑 '+(+c.meta.congestion_index*100).toFixed(0)+'%':'DB'}</span>` : `<span class="pill" style="border-color:${hx6(SEG[SEG_KEYS[si]].col)};color:${hx6(SEG[SEG_KEYS[si]].col)}">${SEG[SEG_KEYS[si]].name.replace('（県外）','')}</span>`}<div class="zv">${fmt(c.v)}<small style="font-size:9px;color:var(--sub)"> 人</small></div></div>`; }).join('') || '<div class="hint">滞在中の来訪者がありません（▶ で再生）</div>'; }
  const tt=document.getElementById('traj-trips'); if(tt){ tt.textContent=fmt(TRAJ.trips); document.getElementById('traj-segs').textContent=fmt(TRAJ.n); }
  const fr=document.getElementById('floor-rows');
  if(fr){ fr.innerHTML = floorStats().map(s=>`<div class="floor-b"><div class="floor-t">${s.d.n}<b>${fmt(s.tot)}人</b></div>${s.rows.slice().reverse().map(r=>`<div class="floor-r"><span>${r.fn}</span><div class="bar"><i style="width:${Math.min(100,r.load*100).toFixed(0)}%;background:${hx6(LVL_COL[r.lvl])}"></i></div><b>${fmt(r.n)}</b></div>`).join('')}<small>${s.d.note}</small></div>`).join(''); }
}
function bindFlow3D(){
  document.querySelectorAll('[data-mesh]').forEach(b=> b.onclick=()=>{ const [k,v]=b.dataset.mesh.split(':'); MESH[k]=v; meshRebuildShape(); MESH.dirty=true; paintMesh(); renderPanel(); });
  document.querySelectorAll('[data-meshres]').forEach(b=> b.onclick=()=>{ const [kind,res]=b.dataset.meshres.split(':'); precisionRes(+res, kind); });
  document.querySelectorAll('[data-traj]').forEach(b=> b.onclick=()=>{ const v=b.dataset.traj; if(v==='clear') trajReset(); else if(v==='static'||v==='anim') setTripsAnim(v==='anim'); else { TRAJ.mode=v; trajRelayout(); } renderPanel(); });
  const tr=document.getElementById('trail-r'); if(tr) tr.oninput=e=>{ TRAJ.mat.uniforms.uTrail.value=+e.target.value; document.getElementById('trail-v').value=e.target.value+' 分'; };
}
function updateFlow3D(dtMin, now){
  if(MESH.on){ MESH.group.visible=level!=='wide'; const key=timeState.min+'|'+segFilter+'|'+MESH.epoch; if(now-MESH.lastPaint>160){ MESH.lastPaint=now; if(key!==MESH.lastDataKey){MESH.lastDataKey=key;meshAccumulate(0);} paintMesh(); } }
  if(TRAJ.on){ TRAJ.group.visible = level!=='wide'; trajUpload(); }
  if(FLOORS.on){ FLOORS.group.visible = level!=='wide'; updateFloors(false); }
}
function meshTip(e){
  if(!MESH.on || !MESH.inst || !MESH.group.visible) return false;
  const hits = pick(e, [MESH.inst], false);
  if(!hits.length){ if(MESH.hover>=0){ MESH.hover=-1; MESH.dirty=true; } return false; }
  const k=hits[0].instanceId, c=MESH.cells[k]; if(!c||c.v<=0)return false; if(k!==MESH.hover){ MESH.hover=k; MESH.dirty=true; }
  const tot=Math.max(1,c.v);
  tip.style.display='block'; tip.style.left=Math.max(8,Math.min(innerWidth-320,e.clientX+14))+'px'; tip.style.top=Math.max(8,Math.min(innerHeight-160,e.clientY+10))+'px';
  if(c.db){ const m=c.meta||{}; tip.innerHTML = `<span class="t-nm">${c.near||'メッシュ'}</span><span style="color:var(--sub)">｜${c.code}</span><br>人数 <b>${fmt(c.v)}人</b>${m.density!=null?`・密度 ${(+m.density).toFixed(0)}人/ha・混雑 ${(+m.congestion_index*100).toFixed(0)}%`:''}<br><span style="color:var(--sub)">${m.inflow!=null?`流入 ${fmt(m.inflow)}・流出 ${fmt(m.outflow)}・`:''}DB（${twinDb.source}）・クリックで詳細</span>`; return true; }
  tip.innerHTML = `<span class="t-nm">${c.near||'メッシュ'}</span><span style="color:var(--sub)">｜${c.code}</span><br>現在 滞在 <b>${fmt(c.v)}人</b>（海外 ${(c.seg[0]/tot*100).toFixed(0)}%・国内 ${(c.seg[1]/tot*100).toFixed(0)}%・近隣 ${(c.seg[2]/tot*100).toFixed(0)}%）<br><span style="color:var(--sub)">滞留中 ${(c.stay/tot*100).toFixed(0)}%・クリックで詳細</span>`;
  return true;
}
document.getElementById('mesh-toggle').onclick = ()=> setMesh(!MESH.on);
document.getElementById('traj-toggle').onclick = ()=> setTraj(!TRAJ.on);
document.getElementById('floor-toggle').onclick = ()=> setFloors(!FLOORS.on);
