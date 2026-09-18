
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

/* ---------- メッシュ ---------- */
const MESH = { on:false, res:250, style:'3d', color:'density', group:new THREE.Group(), inst:null, cells:[], byKey:new Map(), dl:0, dn:0, max:300, dirty:true, lastPaint:0, hover:-1 };
MESH.group.visible=false; scene.add(MESH.group);
const MESH_RANGE = {x:3900, z:3500};
const MESH_HSCALE = {500:0.75, 250:1.0, 125:1.3};        // 柱の高さ係数（h = k × 人数^0.75。突出セルを圧縮しつつ順序は保つ）
const MESH_MINMAX = {500:800, 250:400, 125:200};        // 色スケール下限（人）
const MESH_RAMP = [[0,0x0d2a30],[0.35,0x176c66],[0.65,0x2ea892],[0.88,0x6fd6c0],[1,0xa9efe0]];   // 単一色相（ティール）暗→明で密度
const MESH_POI = SCENE_DATA.pois.filter(p=>p.n).map(p=>({n:p.n, x:p.p[0], z:-p.p[1]}));
function buildMesh(res){
  MESH.res = res;
  MESH.group.children.slice().forEach(o=>{ MESH.group.remove(o); if(o.geometry) o.geometry.dispose(); });
  const dl = res===500?1/240:res===250?1/480:1/960, dn = res===500?1/160:res===250?1/320:1/640;
  MESH.dl=dl; MESH.dn=dn;
  const sw=toLL(-MESH_RANGE.x, MESH_RANGE.z), ne=toLL(MESH_RANGE.x, -MESH_RANGE.z);
  const j0=Math.floor(sw.lat/dl), j1=Math.floor(ne.lat/dl), i0=Math.floor(sw.lon/dn), i1=Math.floor(ne.lon/dn);
  const cells=[];
  for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
    const lat0=j*dl, lon0=i*dn; const a=toXZ(lat0,lon0), b=toXZ(lat0+dl,lon0+dn);
    const cx=(a.x+b.x)/2, cz=(a.z+b.z)/2, w=b.x-a.x, d=a.z-b.z;
    if(Math.abs(cx)>MESH_RANGE.x || Math.abs(cz)>MESH_RANGE.z) continue;
    let near='', nd=1e9; for(const p of MESH_POI){ const q=(p.x-cx)**2+(p.z-cz)**2; if(q<nd){ nd=q; near=p.n; } }
    cells.push({i,j,cx,cz,w,d,y:TH(cx,cz),code:meshCode(lat0+dl/2,lon0+dn/2,res),v:0,seg:[0,0,0],near: nd<(w*w) ? near : ''});
  }
  MESH.cells=cells; MESH.byKey=new Map(cells.map((c,k)=>[c.i+','+c.j,k]));
  const geo=new THREE.BoxGeometry(1,1,1); geo.translate(0,0.5,0);
  const mat=new THREE.MeshStandardMaterial({transparent:true, opacity:0.9, roughness:0.7, metalness:0.05});
  const inst=new THREE.InstancedMesh(geo, mat, cells.length);
  inst.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cells.length*3),3);
  inst.frustumCulled=false; inst.userData={mesh:true};
  MESH.inst=inst; MESH.group.add(inst);
  MESH.max = MESH_MINMAX[res]; MESH.dirty=true;
  meshAccumulate(0); paintMesh();
}
function meshCell(x, z){ const ll=toLL(x,z); const k=MESH.byKey.get(Math.floor(ll.lon/MESH.dn)+','+Math.floor(ll.lat/MESH.dl)); return k===undefined ? -1 : k; }
function meshAccumulate(dtMin){
  if(!MESH.inst) return;
  const cells=MESH.cells, cnt=new Float32Array(cells.length*4);
  for(const a of agents){
    if(!segByFilter(a.seg)) continue;
    let x=a.cur.x, z=a.cur.z;
    if(a.state==='castle'){ /* 城内は城内ゾーン構成比（大手門〜大天守）で分散させて集計 */
      if(a.zr===undefined) a.zr=rnd(); let acc=0, zn=ZONES[ZONES.length-1]; for(const zz of ZONES){ acc+=zz.frac; if(a.zr<=acc){ zn=zz; break; } }
      x=zn.node.x+a.jx*0.35; z=zn.node.z+a.jz*0.35; }
    const k=meshCell(x,z); if(k<0) continue;
    cnt[k*4]+=AG_SCALE; cnt[k*4+1+SEG_KEYS.indexOf(a.seg)]+=AG_SCALE;
  }
  const kf = dtMin>0 ? Math.min(1, dtMin*0.10) : 1;
  let mx=0;
  cells.forEach((c,k)=>{ c.v += (cnt[k*4]-c.v)*kf; for(let s=0;s<3;s++) c.seg[s] += (cnt[k*4+1+s]-c.seg[s])*kf; if(c.v>mx) mx=c.v; });
  MESH.max += (Math.max(mx, MESH_MINMAX[MESH.res]) - MESH.max)*(dtMin>0?0.08:1);
  MESH.dirty=true;
}
const _MM=new THREE.Matrix4(), _MQ=new THREE.Quaternion(), _MS=new THREE.Vector3(), _MP=new THREE.Vector3(), _MC=new THREE.Color();
function paintMesh(){
  if(!MESH.inst || !MESH.dirty) return; MESH.dirty=false;
  const hs=MESH_HSCALE[MESH.res], flat=MESH.style==='2d';
  MESH.cells.forEach((c,k)=>{
    const r=Math.pow(Math.min(1, c.v/MESH.max), 0.45);   // 色は平方根寄りのスケール（少数セルも読めつつ階調を残す）
    const h = flat ? 2.2 : Math.max(0.9, Math.min(700, Math.pow(c.v, 0.75)*hs));
    _MP.set(c.cx, c.y+0.3, c.cz); _MS.set(c.w*0.9, h, c.d*0.9); _MM.compose(_MP,_MQ,_MS); MESH.inst.setMatrixAt(k,_MM);
    if(MESH.color==='seg' && c.v>=AG_SCALE){ let si=0; for(let s=1;s<3;s++) if(c.seg[s]>c.seg[si]) si=s; _MC.setHex(SEG[SEG_KEYS[si]].col).multiplyScalar(0.3+0.7*Math.pow(r,0.6)); }
    else { _MC.copy(rampC(MESH_RAMP, r)); if(c.v<AG_SCALE) _MC.multiplyScalar(flat?0.7:0.6); }
    if(k===MESH.hover) _MC.lerp(_WHITE, 0.45);
    MESH.inst.setColorAt(k,_MC);
  });
  MESH.inst.instanceMatrix.needsUpdate=true; MESH.inst.instanceColor.needsUpdate=true;
  MESH.inst.material.opacity = flat ? 0.86 : 0.74;
}
function meshTop(n=5){ return MESH.cells.filter(c=>c.v>=AG_SCALE).sort((a,b)=>b.v-a.v).slice(0,n); }
function setMesh(on){
  MESH.on=on; if(on && !MESH.inst) buildMesh(MESH.res);
  MESH.group.visible = on && level!=='wide';
  document.getElementById('mesh-toggle').classList.toggle('active', on);
  if(on){ if(level==='wide') setLevel('city'); toast(`メッシュ人流: 地域メッシュ ${MESH.res}m。柱の高さ＝滞在人数（1ドット＝${AG_SCALE}人）、色＝密度。ホバーでメッシュコードと人数`, 4200); }
  renderPanel();
}

/* ---------- 軌跡ライン（1日の移動軌跡を蓄積） ---------- */
const TRAJ = { on:false, mode:'ground', MAXSEG:400000, MAXSTOP:30000, n:0, up:0, sn:0, sup:0, full:false, step:36, tScale:0.6, group:new THREE.Group(), trips:0 };
TRAJ.group.visible=false; scene.add(TRAJ.group);
(function trajInit(){
  TRAJ.pos=new Float32Array(TRAJ.MAXSEG*6); TRAJ.col=new Float32Array(TRAJ.MAXSEG*6); TRAJ.gy=new Float32Array(TRAJ.MAXSEG*2); TRAJ.tt=new Float32Array(TRAJ.MAXSEG*2);
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(TRAJ.pos,3)); g.setAttribute('color', new THREE.BufferAttribute(TRAJ.col,3)); g.setDrawRange(0,0);
  g.attributes.position.setUsage(THREE.DynamicDrawUsage); g.attributes.color.setUsage(THREE.DynamicDrawUsage);
  TRAJ.geo=g; TRAJ.line=new THREE.LineSegments(g, new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false}));
  TRAJ.line.frustumCulled=false; TRAJ.group.add(TRAJ.line);
  TRAJ.spos=new Float32Array(TRAJ.MAXSTOP*3); TRAJ.scol=new Float32Array(TRAJ.MAXSTOP*3); TRAJ.sgy=new Float32Array(TRAJ.MAXSTOP); TRAJ.stt=new Float32Array(TRAJ.MAXSTOP);
  const sg=new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(TRAJ.spos,3)); sg.setAttribute('color', new THREE.BufferAttribute(TRAJ.scol,3)); sg.setDrawRange(0,0);
  TRAJ.sgeo=sg; TRAJ.stops=new THREE.Points(sg, new THREE.PointsMaterial({size:13, vertexColors:true, transparent:true, opacity:0.95, depthWrite:false, sizeAttenuation:true}));
  TRAJ.stops.frustumCulled=false; TRAJ.group.add(TRAJ.stops);
})();
function trajY(gy, t){ return TRAJ.mode==='time' ? gy + t*TRAJ.tScale : gy; }
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
  if(TRAJ.n>TRAJ.up){ const pa=g.attributes.position, ca=g.attributes.color; pa.updateRange={offset:TRAJ.up*6, count:(TRAJ.n-TRAJ.up)*6}; ca.updateRange={offset:TRAJ.up*6, count:(TRAJ.n-TRAJ.up)*6}; pa.needsUpdate=true; ca.needsUpdate=true; g.setDrawRange(0, TRAJ.n*2); TRAJ.up=TRAJ.n; }
  if(TRAJ.sn>TRAJ.sup){ const pa=TRAJ.sgeo.attributes.position, ca=TRAJ.sgeo.attributes.color; pa.updateRange={offset:TRAJ.sup*3, count:(TRAJ.sn-TRAJ.sup)*3}; ca.updateRange={offset:TRAJ.sup*3, count:(TRAJ.sn-TRAJ.sup)*3}; pa.needsUpdate=true; ca.needsUpdate=true; TRAJ.sgeo.setDrawRange(0, TRAJ.sn); TRAJ.sup=TRAJ.sn; }
}
function trajRelayout(){
  const P=TRAJ.pos; for(let i=0;i<TRAJ.n*2;i++) P[i*3+1]=trajY(TRAJ.gy[i], TRAJ.tt[i]);
  for(let i=0;i<TRAJ.sn;i++) TRAJ.spos[i*3+1]=trajY(TRAJ.sgy[i], TRAJ.stt[i]);
  TRAJ.up=0; TRAJ.sup=0; TRAJ.geo.attributes.position.updateRange={offset:0,count:-1}; TRAJ.sgeo.attributes.position.updateRange={offset:0,count:-1}; trajUpload();
}
function trajReset(){ TRAJ.n=0; TRAJ.up=0; TRAJ.sn=0; TRAJ.sup=0; TRAJ.full=false; TRAJ.trips=0; TRAJ.geo.setDrawRange(0,0); TRAJ.sgeo.setDrawRange(0,0); agents.forEach(a=>{ a.tjl=null; }); }
/* 建物のゴースト表示（半透明の白） */
const GHOST = { on:false, saved:null, mats:()=>[MAT.bldg, MAT.bldgNamed] };
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
  if(!MESH.on) return '';
  const chip=(k,v,l,cls='')=>`<button class="chip ${cls} ${MESH[k]===v?'active':''}" data-mesh="${k}:${v}">${l}</button>`;
  const donut=s=>{ const m=SCN[s].mix; return svgDonut([['海外',m.in,hx6(SEG.in.col)],['国内',m.dom,hx6(SEG.dom.col)],['近隣',m.loc,hx6(SEG.loc.col)]], s==='wkd'?'平日 海外比率':'土日祝 海外比率'); };
  return `<div class="sec"><div class="sec-t"><b>▦ メッシュ人流</b> — 地域メッシュ（JIS X 0410）の滞在人数</div>
      <div class="row-btns" style="margin-bottom:6px">${chip('res',500,'500m（4次）')}${chip('res',250,'250m（5次）')}${chip('res',125,'125m（6次）')}</div>
      <div class="row-btns" style="margin-bottom:6px">${chip('style','3d','3D 柱')}${chip('style','2d','2D 面（GIS風）')}${chip('color','density','色＝密度')}${chip('color','seg','色＝主セグメント')}</div>
      ${MESH.color==='density' ? `<div class="grad-bar mesh"></div><div class="grad-lbl"><span>0人</span><span>${fmt(MESH.max)}人以上</span></div>` : `<div class="legend"><div class="li"><div class="sw" style="background:#65beff"></div>海外が最多　<div class="sw" style="background:#62e4ab"></div>国内が最多　<div class="sw" style="background:#ef91bb"></div>近隣が最多</div></div>`}
      <div class="sec-t" style="margin-top:10px">滞在人数 上位メッシュ（現在時刻）</div><div id="mesh-top"></div>
      <div class="hint" style="margin-top:6px">柱の高さ＝メッシュ内の滞在人数（1ドット＝${AG_SCALE}人）、色＝密度（√スケール）。城内は城内ゾーン構成で分散集計。携帯位置情報の500mメッシュ集計が実データの最小単位で、250m/125mはWi-Fi・カメラ・入城券で補完する想定。</div></div>
    <div class="sec"><div class="sec-t">居住地別 来訪者数 — 平日 vs 土日祝（人/日・想定）</div>${svgPairAbs(residenceRows())}
      <div style="display:flex;gap:14px;justify-content:center;margin-top:4px">${donut('wkd')}${donut('wke')}</div>
      <div class="hint" style="margin-top:4px">平日 ${fmt(SCN.wkd.castle*CITY_FACTOR)}人／土日祝 ${fmt(SCN.wke.castle*CITY_FACTOR)}人（市内来訪者・観光動向調査の居住地構成から換算）</div></div>`;
}
function trajSec(){
  if(!TRAJ.on) return '';
  return `<div class="sec"><div class="sec-t"><b>〜 軌跡ライン</b> — 来訪者ごとの1日の動き</div>
      <div class="row-btns" style="margin-bottom:6px"><button class="chip ${TRAJ.mode==='ground'?'active':''}" data-traj="ground">地表に沿う</button><button class="chip ${TRAJ.mode==='time'?'active':''}" data-traj="time">時空間（高さ＝時刻）</button><button class="chip" data-traj="clear">軌跡をクリア</button></div>
      <div class="kpi-grid"><div class="kpi"><div class="v" id="traj-trips">${fmt(TRAJ.trips)}</div><div class="l">記録トリップ（1ドット＝${AG_SCALE}人）</div></div><div class="kpi"><div class="v" id="traj-segs">${fmt(TRAJ.n)}</div><div class="l">線分数${TRAJ.full?'（上限）':''}</div></div></div>
      <div class="legend" style="margin-top:6px"><div class="li"><div class="sw" style="background:#65beff"></div>海外　<div class="sw" style="background:#62e4ab"></div>国内　<div class="sw" style="background:#ef91bb"></div>近隣　<b>●</b> 滞留した場所</div></div>
      <div class="hint" style="margin-top:6px">線＝道路網上の移動軌跡（同じ色相の明暗で個人を区別）、点＝城・回遊先・宿泊での滞留。「時空間」では高さが時刻（06:00＝地表 → 24:00＝${Math.round(1080*TRAJ.tScale)}m）で、上に行くほど遅い時間。実データでは携帯位置情報のトリップ復元（総務省 GPS-ODと同様）で作成。</div></div>`;
}
function floorSec(){
  if(!FLOORS.on) return '';
  return `<div class="sec"><div class="sec-t"><b>≡ 階層ビュー</b> — 高さ方向の滞留（階ごと）</div><div id="floor-rows"></div>
      <div class="legend" style="margin-top:6px"><div class="li"><div class="sw" style="background:#3ddc84"></div>快適　<div class="sw" style="background:#ffd166"></div>やや混雑　<div class="sw" style="background:#ff6b5e"></div>混雑（容量比）</div></div>
      <div class="hint" style="margin-top:6px">緯度経度だけでは分からない<b>階（高さ）ごとの人の動き・滞留</b>を分離する表現。大天守は入場制限と階段の一方通行で上層階に滞留が集中、駅は改札階・ホーム階の分離、商業施設は階別の回遊が見える。実データは気圧センサ付き位置情報・BLE/Wi-Fi・階別カメラで取得する想定。</div></div>`;
}
function updateFlowPanels(){
  const mt=document.getElementById('mesh-top');
  if(mt){ mt.innerHTML = meshTop(5).map(c=>{ let si=0; for(let s=1;s<3;s++) if(c.seg[s]>c.seg[si]) si=s; return `<div class="zone-row"><div class="zn">${c.near||'—'}<small>${MESH.res}m メッシュ ${c.code}</small></div><span class="pill" style="border-color:${hx6(SEG[SEG_KEYS[si]].col)};color:${hx6(SEG[SEG_KEYS[si]].col)}">${SEG[SEG_KEYS[si]].name.replace('（県外）','')}</span><div class="zv">${fmt(c.v)}<small style="font-size:9px;color:var(--sub)"> 人</small></div></div>`; }).join('') || '<div class="hint">滞在中の来訪者がありません（▶ で再生）</div>'; }
  const tt=document.getElementById('traj-trips'); if(tt){ tt.textContent=fmt(TRAJ.trips); document.getElementById('traj-segs').textContent=fmt(TRAJ.n); }
  const fr=document.getElementById('floor-rows');
  if(fr){ fr.innerHTML = floorStats().map(s=>`<div class="floor-b"><div class="floor-t">${s.d.n}<b>${fmt(s.tot)}人</b></div>${s.rows.slice().reverse().map(r=>`<div class="floor-r"><span>${r.fn}</span><div class="bar"><i style="width:${Math.min(100,r.load*100).toFixed(0)}%;background:${hx6(LVL_COL[r.lvl])}"></i></div><b>${fmt(r.n)}</b></div>`).join('')}<small>${s.d.note}</small></div>`).join(''); }
}
function bindFlow3D(){
  document.querySelectorAll('[data-mesh]').forEach(b=> b.onclick=()=>{ const [k,v]=b.dataset.mesh.split(':'); if(k==='res'){ buildMesh(+v); } else { MESH[k]=v; MESH.dirty=true; } renderPanel(); });
  document.querySelectorAll('[data-traj]').forEach(b=> b.onclick=()=>{ const v=b.dataset.traj; if(v==='clear') trajReset(); else { TRAJ.mode=v; trajRelayout(); } renderPanel(); });
}
function updateFlow3D(dtMin, now){
  if(MESH.on){ MESH.group.visible = level!=='wide'; if(dtMin>0 || MESH.dirty){ if(dtMin>0) meshAccumulate(dtMin); if(now-MESH.lastPaint>90){ MESH.lastPaint=now; paintMesh(); } } }
  if(TRAJ.on){ TRAJ.group.visible = level!=='wide'; trajUpload(); }
  if(FLOORS.on){ FLOORS.group.visible = level!=='wide'; updateFloors(false); }
}
function meshTip(e){
  if(!MESH.on || !MESH.inst || !MESH.group.visible) return false;
  const hits = pick(e, [MESH.inst], false);
  if(!hits.length){ if(MESH.hover>=0){ MESH.hover=-1; MESH.dirty=true; } return false; }
  const k=hits[0].instanceId, c=MESH.cells[k]; if(k!==MESH.hover){ MESH.hover=k; MESH.dirty=true; }
  const tot=Math.max(1,c.v);
  tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+10)+'px';
  tip.innerHTML = `<span class="t-nm">${c.near||'メッシュ'}</span><span style="color:var(--sub)">｜${MESH.res}m メッシュ ${c.code}</span><br>現在 滞在 <b>${fmt(c.v)}人</b>（海外 ${(c.seg[0]/tot*100).toFixed(0)}%・国内 ${(c.seg[1]/tot*100).toFixed(0)}%・近隣 ${(c.seg[2]/tot*100).toFixed(0)}%）`;
  return true;
}
document.getElementById('mesh-toggle').onclick = ()=> setMesh(!MESH.on);
document.getElementById('traj-toggle').onclick = ()=> setTraj(!TRAJ.on);
document.getElementById('floor-toggle').onclick = ()=> setFloors(!FLOORS.on);
