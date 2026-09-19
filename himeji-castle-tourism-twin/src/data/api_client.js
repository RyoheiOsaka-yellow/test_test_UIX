/* ================= データソース切替: ブラウザ内シミュレーション（synthetic） ⇄ Human Flow API（PostgreSQL/PostGIS + 3DCityDB） =================
   ・ブラウザは PostgreSQL に直接つながない。必ず infra/api（FastAPI）の /api/* を経由する（ARCHITECTURE_DB.md）
   ・既存レイヤーへの対応: /api/people/current → 点、/api/mesh → グリッド/カラム/等高線（mesh_stats）、/api/trajectory → 軌跡（TRAJ）、
     /api/od → 流線（FLOWA）、/api/stays → ヒートマップ（HEATV）、/api/buildings → 3DCityDB 建物（LOD1 押し出し / LOD2 面）
   ・ズームに応じた LOD: 250m → 100m → 50m → サンプル点（ctrl.sph.radius で切替）
   ・DB の値は「実人数」。1ドット＝AG_SCALE 人 のスケールは使わない。source は API が返すもの（synthetic は合成データと明示） */
const DBSRC = {
  on:false, base:'', ok:false, health:null, err:'', source:'synthetic', bucket:5, autoLod:true, lod:'100', bld:false, bldLod2:true,
  dayStart:0, dateLabel:'', lastKey:'', inflight:new Map(), stat:{}, kpi:null, series:[], heat:[], pts:null, ptsN:0, bldGroup:new THREE.Group(), bldL1:null, bldL2:new Map(), bldL2Key:'',
  lastTick:0, meshKey:'', shapeKey:'', last:{}, toastOnce:{}
};
DBSRC.bldGroup.visible=false; scene.add(DBSRC.bldGroup);
const DB_DEFAULT_BBOX = [134.648, 34.800, 134.735, 34.872];   // mobility.default_bbox() と同じ（姫路駅〜姫路城〜書写周辺）
const DB_LOD_RADIUS = { 250:4500, 100:1800, 50:700 };          // カメラ距離（m）がこれ以上なら その解像度
function dbBase(){
  if(DBSRC.base) return DBSRC.base;
  const c = (window.TWIN_CONFIG && TWIN_CONFIG.api && TWIN_CONFIG.api.base) || '';
  if(c) return c;
  return (location.protocol.startsWith('http') && location.port!=='') ? location.origin : 'http://localhost:8000';
}
function dbIso(min){ return new Date(DBSRC.dayStart + (min+360)*60000).toISOString(); }
function dbMinOf(epochSec){ return (epochSec*1000 - DBSRC.dayStart)/60000 - 360; }
function dbViewBBox(pad=1.6){
  const t=ctrl.target, r=Math.max(400, ctrl.sph.radius*pad);
  const a=toLL(t.x-r, t.z+r), b=toLL(t.x+r, t.z-r);
  return [Math.max(DB_DEFAULT_BBOX[0], a.lon), Math.max(DB_DEFAULT_BBOX[1], a.lat), Math.min(DB_DEFAULT_BBOX[2], b.lon), Math.min(DB_DEFAULT_BBOX[3], b.lat)].map(v=>+v.toFixed(4)).join(',');
}
function dbLodNow(){ const r=ctrl.sph.radius; return r>=DB_LOD_RADIUS[250] ? '250' : r>=DB_LOD_RADIUS[100] ? '100' : r>=DB_LOD_RADIUS[50] ? '50' : 'points'; }
async function dbFetch(key, path, apply){
  if(DBSRC.inflight.has(key)) return;
  const url = dbBase()+path; const t0=performance.now(); DBSRC.inflight.set(key, url);
  try{
    const r = await fetch(url, {cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+r.statusText);
    const j = await r.json(); DBSRC.stat[key.split('|')[0]] = {ms:Math.round(performance.now()-t0), bytes:+(r.headers.get('content-length')||0), n:(j.features||j.cells||j.flows||j.series||[]).length};
    DBSRC.ok=true; DBSRC.err=''; apply(j);
  }catch(e){ DBSRC.err = e.message; DBSRC.ok=false; }
  finally{ DBSRC.inflight.delete(key); }
}
/* ---------- 接続・メタ情報（/api/health） ---------- */
async function dbConnect(){
  DBSRC.health=null; DBSRC.err='';
  try{
    const r = await fetch(dbBase()+'/api/health', {cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+r.statusText);
    const h = await r.json(); DBSRC.health=h; DBSRC.ok=true;
    const srcs = Object.keys(h.sources||{}); if(srcs.length && !srcs.includes(DBSRC.source)) DBSRC.source = srcs[0];
    const rng = (h.sources||{})[DBSRC.source];
    if(rng){ const t0=new Date(rng[0]); const jst=new Date(t0.getTime()+9*3600000); DBSRC.dayStart = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - 9*3600000; DBSRC.dateLabel = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth()+1).padStart(2,'0')}-${String(jst.getUTCDate()).padStart(2,'0')}`; }
    else { DBSRC.dayStart = Date.UTC(2026,9,4) - 9*3600000; DBSRC.dateLabel='2026-10-04'; }
    dbFetch('series', `/api/people/series?t=${encodeURIComponent(dbIso(0))}&bucket=60&source=${DBSRC.source}`, j=>{ DBSRC.series=j.series||[]; });
  }catch(e){ DBSRC.err = e.message; DBSRC.ok=false; }
  DBSRC.lastKey=''; renderPanel();
}
function setDbSource(on){
  DBSRC.on = on;
  if(on){ if(!DBSRC.health) dbConnect(); DBSRC.lastKey=''; DBSRC.shapeKey=''; if(typeof toast==='function') toast('データソース: DB / API（PostgreSQL + PostGIS + 3DCityDB）。人流は API の source（synthetic＝合成データ）を表示。ブラウザ内シミュレーションのドットは非表示', 5200); }
  else { if(DBSRC.pts) DBSRC.pts.visible=false; DBSRC.bldGroup.visible=false; DBSRC.heat=[]; if(typeof syncRefinement==='function') syncRefinement();
    if(MESH.on){ buildMesh(MESH.res, MESH.kind); } if(TRAJ.on){ trajReset(); } FLOWA.dirty=true; FLOWA.last=0; FLOWA.rows=[]; }
  const el=document.getElementById('render-status'); if(el && !on) el.textContent='人流シミュレーション';
  renderPanel();
}
/* ---------- 点（/api/people/current） ---------- */
function dbEnsurePoints(){
  if(DBSRC.pts) return;
  const N=(window.TWIN_CONFIG && TWIN_CONFIG.api && TWIN_CONFIG.api.maxPoints)||20000;
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3),3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N*3),3)); g.setDrawRange(0,0);
  const m=new THREE.ShaderMaterial({transparent:true, depthWrite:false, vertexColors:true,
    vertexShader:'varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(4200.0/max(1.0,-mv.z),3.0,7.0); }',
    fragmentShader:'varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(mix(vC,vec3(1.0),.2), 1.0-smoothstep(.3,.5,d)); }'});
  DBSRC.pts=new THREE.Points(g,m); DBSRC.pts.frustumCulled=false; DBSRC.pts.renderOrder=6; scene.add(DBSRC.pts);
}
const _DBC_MOVE=new THREE.Color(0x65beff), _DBC_STAY=new THREE.Color(0xffb347);
function dbApplyPoints(fc){
  dbEnsurePoints(); const g=DBSRC.pts.geometry, P=g.attributes.position.array, C=g.attributes.color.array, N=P.length/3; let n=0, spd=0, nm=0;
  DBSRC.ptsRaw = fc.features;
  for(const f of fc.features){ if(n>=N) break; const [lon,lat]=f.geometry.coordinates; const p=toXZ(lat,lon); const s=f.properties.speed||0; const c = s<0.3 ? _DBC_STAY : _DBC_MOVE;
    P[n*3]=p.x; P[n*3+1]=TH(p.x,p.z)+2.2; P[n*3+2]=p.z; C[n*3]=c.r; C[n*3+1]=c.g; C[n*3+2]=c.b; n++; if(s>=0.3){ spd+=s; nm++; } }
  DBSRC.ptsN=n; DBSRC.speed = nm? spd/nm : 0; g.setDrawRange(0,n); g.attributes.position.needsUpdate=true; g.attributes.color.needsUpdate=true;
}
/* ---------- メッシュ（/api/mesh → MESH.cells を DB のセルで置き換え） ---------- */
function dbApplyMesh(j){
  const res=j.res, cells=[]; const tnow=timeState.min, bkt=Math.floor((tnow+360)/10);
  for(const c of j.cells){ const p=toXZ(c.position[1], c.position[0]); if(Math.abs(p.x)>MESH_RANGE.x||Math.abs(p.z)>MESH_RANGE.z) continue;
    const v=c.people_count, stay = c.avg_stay_sec ? v*Math.min(1, c.avg_stay_sec/900) : 0; const inb={}, outb={}; inb[bkt]=c.inflow; outb[bkt]=c.outflow;
    cells.push({db:true, i:Math.floor(p.x/res), j:Math.floor(p.z/res), cx:p.x, cz:p.z, w:res, d:res, y:TH(p.x,p.z), code:c.mesh_id, v, stay, seg:[0,0,0], near:nearPOI(p.x,p.z,res), in:inb, out:outb, ag:[], meta:c, peak:v, peakT:tnow}); }
  if(MESH.kind!=='sq' || MESH.res!==res){ MESH.kind='sq'; MESH.res=res; }
  MESH.cells=cells; MESH.byKey=new Map(cells.map((c,k)=>[c.i+','+c.j,k]));
  let mx=0; cells.forEach(c=>{ if(c.v>mx) mx=c.v; }); MESH.max = Math.max(mx, 10);   // 色スケール上限＝この時刻の最大人数（実人数）
  if(MESH.inst && MESH.res!==DBSRC.prevRes){ const old=MESH.inst; old.material=old.material.clone(); old.material.transparent=true; MESH.fade=(MESH.fade||[]); MESH.fade.push({inst:old}); MESH.inst=null; }   // 解像度が変わったら旧セルを残して cross fade
  DBSRC.prevRes=res;
  MESH.shapeKey=''; meshRebuildShape(); MESH.dirty=true; paintMesh(); if(MESH.fade && MESH.fade.length) MESH.inst.material.opacity=0.05;
  DBSRC.busyCells = cells.filter(c=> c.meta.density>=160).length;   // 100m 換算 160人/ha 以上を混雑（シミュレーション側と同じ閾値）
}
/* 地域メッシュ / ヘックスは mesh_stats に無いので 点を既存のセルに客側で集計（人数＝ユニーク person） */
function dbBinPoints(fc){
  const cells=MESH.cells; cells.forEach(c=>{ c.v=0; c.stay=0; c.seg=[0,0,0]; c.ag=[]; c.db=true; });
  for(const f of fc.features){ const [lon,lat]=f.geometry.coordinates; const p=toXZ(lat,lon); const k=meshCell(p.x,p.z); if(k<0) continue; const c=cells[k]; c.v++; if((f.properties.speed||0)<0.3) c.stay++; }
  let mx=0; cells.forEach(c=>{ if(c.v>mx) mx=c.v; if(c.v>(c.peak||0)){ c.peak=c.v; c.peakT=timeState.min; } }); MESH.max=Math.max(mx, (MESH_MINMAX[MESH.res]||100)/4); MESH.dirty=true; paintMesh();
}
/* ---------- 軌跡（/api/trajectory → TRAJ のバッファに直接書く） ---------- */
function dbHashColor(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; const c=new THREE.Color(); c.setHSL((h%360)/360, 0.65, 0.62); return c; }
function dbApplyTraj(fc){
  if(!TRAJ.geo) return;
  TRAJ.n=0; TRAJ.up=0; TRAJ.full=false; TRAJ.trips=0; TRAJ.geo.setDrawRange(0,0);   // 線分だけ初期化（滞在点は /api/stays が別に埋めるので trajReset は使わない）
  const P=TRAJ.pos, C=TRAJ.col;
  for(const f of fc.features){ const co=f.geometry.coordinates, ts=f.properties.timestamps||[]; if(co.length<2) continue; TRAJ.trips++; const col=dbHashColor(f.properties.person_hash||'');
    let px=null, pz=null, pt=0;
    for(let i=0;i<co.length;i++){ const p=toXZ(co[i][1], co[i][0]); const t = ts[i]!=null ? dbMinOf(ts[i]) : timeState.min;
      if(px!==null){ const dx=p.x-px, dz=p.z-pz; if(dx*dx+dz*dz < 4*4 && i<co.length-1) continue; if(TRAJ.n>=TRAJ.MAXSEG){ TRAJ.full=true; break; }
        const n=TRAJ.n, o=n*6, y0=TH(px,pz)+4, y1=TH(p.x,p.z)+4;
        P[o]=px; P[o+1]=trajY(y0,pt); P[o+2]=pz; P[o+3]=p.x; P[o+4]=trajY(y1,t); P[o+5]=p.z;
        C[o]=col.r; C[o+1]=col.g; C[o+2]=col.b; C[o+3]=col.r; C[o+4]=col.g; C[o+5]=col.b;
        TRAJ.gy[n*2]=y0; TRAJ.gy[n*2+1]=y1; TRAJ.tt[n*2]=pt; TRAJ.tt[n*2+1]=t; TRAJ.n=n+1; }
      px=p.x; pz=p.z; pt=t; }
    if(TRAJ.full) break; }
  trajUpload();
}
function dbApplyStaysAsStops(fc){
  if(!TRAJ.sgeo) return; TRAJ.sn=0; TRAJ.sup=0;
  for(const f of fc.features){ if(TRAJ.sn>=TRAJ.MAXSTOP) break; const [lon,lat]=f.geometry.coordinates; const p=toXZ(lat,lon); const n=TRAJ.sn, gy=TH(p.x,p.z)+5, c=dbHashColor(f.properties.person_hash||''), t=dbMinOf(Date.parse(f.properties.start_time)/1000);
    TRAJ.spos[n*3]=p.x; TRAJ.spos[n*3+1]=trajY(gy,t); TRAJ.spos[n*3+2]=p.z; TRAJ.scol[n*3]=c.r; TRAJ.scol[n*3+1]=c.g; TRAJ.scol[n*3+2]=c.b; TRAJ.sgy[n]=gy; TRAJ.stt[n]=t; TRAJ.sn=n+1; }
  TRAJ.sgeo.setDrawRange(0,0); trajUpload();
}
/* ---------- 滞在（/api/stays → ヒートマップのスプラット点。重み＝滞在時間） ---------- */
function dbApplyStays(fc){
  const H=[]; for(const f of fc.features){ const [lon,lat]=f.geometry.coordinates; const p=toXZ(lat,lon); H.push(p.x, p.z, Math.min(1.6, 0.4+ (f.properties.duration_sec||0)/1800)); }
  DBSRC.heat=H;
}
/* ---------- OD（/api/od → 流線アーク） ---------- */
function dbApplyFlow(j){
  FLOWA.meshes.forEach(m=>{ FLOWA.group.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); const i=arcUnis.indexOf(m.uni); if(i>=0) arcUnis.splice(i,1); }); FLOWA.meshes=[];
  const rows = j.flows.map(f=>({from:f.origin_name||f.origin_id, to:f.destination_name||f.destination_id, n:f.people, real:true, seg:[0,0,0], a:toXZ(f.source_position[1], f.source_position[0]), b:toXZ(f.target_position[1], f.target_position[0])}));
  FLOWA.rows=rows; FLOWA.dirty=false; FLOWA.last=performance.now();
  const mx=rows.length?rows[0].n:1;
  rows.slice(0,48).forEach(r=>{ const share=r.n/mx; const col=densC(Math.pow(share,0.55)); FLOWA.meshes.push(buildArcT(r.a, r.b, col.getHex(), share, FLOWA.group, 0.18)); });
  const fr=document.getElementById('flow-rows'); if(fr) fr.innerHTML=flowRowsHTML();
}
/* ---------- 3DCityDB 建物（/api/buildings）: LOD1 押し出し（全域）＋ LOD2 面（カメラ近傍） ---------- */
function dbMergeGeos(geos){   // 非インデックスの position を連結（BufferGeometryUtils 無しで動く）
  const arrs=geos.map(g=>{ const n=g.index?g.toNonIndexed():g; return n.attributes.position.array; }); let total=0; arrs.forEach(a=>total+=a.length);
  const pos=new Float32Array(total); let o=0; arrs.forEach(a=>{ pos.set(a,o); o+=a.length; }); geos.forEach(g=>g.dispose());
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.computeVertexNormals(); return geo;
}
const DB_BLD_MAT = { l1:new THREE.MeshStandardMaterial({color:0x3fbfd8, transparent:true, opacity:0.55, roughness:0.6, metalness:0.05, emissive:0x1a6f85, emissiveIntensity:0.25, side:THREE.DoubleSide}),
                     roof:new THREE.MeshStandardMaterial({color:0x8fe3ff, roughness:0.7, side:THREE.DoubleSide, emissive:0x2b8fb0, emissiveIntensity:0.2}),
                     wall:new THREE.MeshStandardMaterial({color:0x3fbfd8, roughness:0.75, side:THREE.DoubleSide, emissive:0x175f73, emissiveIntensity:0.18}),
                     ground:new THREE.MeshStandardMaterial({color:0x22606f, roughness:0.9, side:THREE.DoubleSide}) };
function dbRingToShape(ring){ const s=new THREE.Shape(); ring.forEach((c,i)=>{ const p=toXZ(c[1],c[0]); if(i===0) s.moveTo(p.x,p.z); else s.lineTo(p.x,p.z); }); return s; }
function dbApplyBuildingsL1(fc){
  if(DBSRC.bldL1){ DBSRC.bldGroup.remove(DBSRC.bldL1); DBSRC.bldL1.geometry.dispose(); DBSRC.bldL1=null; }
  const geos=[];
  for(const f of fc.features){ const g=f.geometry; if(!g) continue; const polys = g.type==='Polygon' ? [g.coordinates] : g.type==='MultiPolygon' ? g.coordinates : []; const h=Math.max(3, f.properties.height||6);
    for(const rings of polys){ if(!rings.length || rings[0].length<4) continue; const shape=dbRingToShape(rings[0]); rings.slice(1).forEach(r=>{ const hole=new THREE.Path(); r.forEach((c,i)=>{ const p=toXZ(c[1],c[0]); if(i===0) hole.moveTo(p.x,p.z); else hole.lineTo(p.x,p.z); }); shape.holes.push(hole); });
      const c0=toXZ(rings[0][0][1], rings[0][0][0]); const base=TH(c0.x,c0.z);
      const geo=new THREE.ExtrudeGeometry(shape, {depth:h, bevelEnabled:false}); geo.rotateX(Math.PI/2); geo.translate(0, base+h, 0);   // Shape は (x, z) 平面 → 回転で xz に置き、y に押し出し
      geos.push(geo); } }
  if(!geos.length) return;
  const mesh = new THREE.Mesh(dbMergeGeos(geos), DB_BLD_MAT.l1);
  mesh.userData={dbBuilding:true}; DBSRC.bldL1=mesh; DBSRC.bldGroup.add(mesh); DBSRC.bldN=fc.features.length;
}
/* LOD2: 各面（3D ポリゴン）を支配平面へ投影して三角形化（ShapeUtils.triangulateShape）*/
function dbFaceGeometry(poly, base){
  const ring=poly[0]; if(!ring || ring.length<4) return null;
  const pts=ring.slice(0,-1).map(c=>{ const p=toXZ(c[1],c[0]); return new THREE.Vector3(p.x, base+(c[2]||0), p.z); });
  const n=new THREE.Vector3(); for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; n.x+=(a.y-b.y)*(a.z+b.z); n.y+=(a.z-b.z)*(a.x+b.x); n.z+=(a.x-b.x)*(a.y+b.y); }
  if(n.lengthSq()<1e-9) return null; n.normalize();
  const u=new THREE.Vector3(); (Math.abs(n.y)>0.8 ? u.set(1,0,0) : u.set(0,1,0)); const ax=new THREE.Vector3().crossVectors(n,u).normalize(), ay=new THREE.Vector3().crossVectors(ax,n).normalize();
  const p2=pts.map(p=>new THREE.Vector2(p.dot(ax), p.dot(ay))); const tris=THREE.ShapeUtils.triangulateShape(p2, []); if(!tris.length) return null;
  const pos=new Float32Array(tris.length*9); let k=0; for(const t of tris){ for(const i of t){ pos[k++]=pts[i].x; pos[k++]=pts[i].y; pos[k++]=pts[i].z; } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3)); g.computeVertexNormals(); return g;
}
function dbApplyBuildingsL2(fc, key){
  DBSRC.bldL2.forEach(m=>{ DBSRC.bldGroup.remove(m); m.children.forEach(c=>c.geometry.dispose()); }); DBSRC.bldL2.clear();
  const byKind={roof:[], wall:[], ground:[]};
  for(const f of fc.features){ const c0 = f.properties.faces && f.properties.faces.length ? f.properties.faces[0].g.coordinates[0][0][0] : null; if(!c0) continue; const p0=toXZ(c0[1],c0[0]); const base=TH(p0.x,p0.z)-(f.properties.ground_z||0);
    for(const face of f.properties.faces){ const kind = /Roof/.test(face.k) ? 'roof' : /Ground/.test(face.k) ? 'ground' : 'wall'; const polys = face.g.type==='Polygon' ? [face.g.coordinates] : face.g.coordinates; for(const poly of polys){ const g=dbFaceGeometry(poly, base); if(g) byKind[kind].push(g); } } }
  const grp=new THREE.Group();
  for(const kind of Object.keys(byKind)){ if(!byKind[kind].length) continue; const m=new THREE.Mesh(dbMergeGeos(byKind[kind]), DB_BLD_MAT[kind]); m.userData={dbBuilding:true, lod:2}; grp.add(m); }
  DBSRC.bldGroup.add(grp); DBSRC.bldL2.set(key, grp); DBSRC.bldL2N=fc.features.length;
}
function setDbBuildings(on){
  DBSRC.bld=on; DBSRC.bldGroup.visible = on && DBSRC.on;
  if(on && !DBSRC.bldL1) dbFetch('bld1', '/api/buildings?lod=1&limit=50000', dbApplyBuildingsL1);
  if(on && typeof toast==='function') toast('3DCityDB の建物（citydb スキーマ・PLATEAU CityGML 取込分）を水色で重ねて表示。LOD1＝フットプリント押し出し、近づくと LOD2 の屋根・壁面', 4200);
  renderPanel();
}
/* ---------- KPI（/api/people/bbox + /api/people/series） ---------- */
function dbUpdateAna(k){
  const K=DBSRC.kpi, S=DBSRC.series; const tnow=dbIso(timeState.min);
  const cur = S.filter(s=> s.t<=tnow).slice(-1)[0], prev = S.filter(s=> s.t<=dbIso(timeState.min-60)).slice(-1)[0];
  let peak=null; S.forEach(s=>{ if(!peak || s.people>peak.people) peak=s; });
  const clockOf = iso=> { const d=new Date(d0=Date.parse(iso)); const m=Math.round((d.getTime()-DBSRC.dayStart)/60000)-360; return clockStr(m); }; let d0;
  const ratio = (cur && prev && prev.people>0) ? cur.people/prev.people : null;
  k.innerHTML =
    kpi(K ? fmt(K.people_now) : '…', '現在 滞在人口（bbox 内・直近5分）') +
    kpi(K ? fmt(K.inflow) : '…', '流入（直近1時間・bbox 境界）') +
    kpi(K ? fmt(K.outflow) : '…', '流出（直近1時間・bbox 境界）') +
    kpi(K && K.avg_stay_sec ? Math.round(K.avg_stay_sec/60)+'<small> 分</small>' : '—', '平均滞在時間（stays）') +
    kpi(peak ? fmt(peak.people)+`<small> ${clockOf(peak.t)}</small>` : '—', 'ピーク人数（当日・1h ユニーク）') +
    kpi(String(DBSRC.busyCells||0), '混雑メッシュ数（density ≥160人/ha）') +
    kpi(DBSRC.speed ? DBSRC.speed.toFixed(2)+'<small> m/s</small>' : '—', '平均移動速度（移動中の点）') +
    kpi(ratio!=null ? (ratio>=1?'+':'')+((ratio-1)*100).toFixed(0)+'<small> %</small>' : '—', '前時間帯比（1h ユニーク人数）') +
    kpi(`<span style="font-size:13px">${FLOWA.rows.length ? FLOWA.rows[0].from : '—'}</span>`, '主要 Origin（OD 最多）') +
    kpi(`<span style="font-size:13px">${FLOWA.rows.length ? FLOWA.rows[0].to : '—'}</span>`, '主要 Destination（OD 最多）');
}
/* ---------- メッシュ詳細（/api/mesh/{id}: 当日時系列・ピーク・OD） ---------- */
function dbMeshCard(c, e){
  const m=c.meta||{};   // 地域メッシュ/ヘックス（客側集計）は meta 無し
  const row=(k,v)=>`<span>${k}</span><b>${v}</b>`;
  mcard.innerHTML = `<div class="bc-h"><b>${c.near||'メッシュ'}　<span style="color:var(--sub);font-weight:400">${c.code}</span></b><button class="bd-x" id="mc-close">✕</button></div>
    <div class="bc-g">${row('Mesh ID', c.code)}${row('People', fmt(c.v)+' 人')}${row('Stay', m.avg_stay_sec? Math.round(m.avg_stay_sec/60)+' min' : '—')}${row('Inflow', fmt(m.inflow||0))}${row('Outflow', fmt(m.outflow||0))}${row('Walking Speed', m.avg_speed!=null? (+m.avg_speed).toFixed(2)+' m/s' : '—')}${row('Density', m.density!=null? (+m.density).toFixed(0)+' 人/ha' : '—')}${row('Congestion', m.congestion_index!=null? (+m.congestion_index*100).toFixed(0)+' %' : '—')}${row('Peak', '<span id="mc-peak">…</span>')}${row('Origin', '<span id="mc-org">…</span>')}${row('Destination', '<span id="mc-dst">…</span>')}</div>
    <div id="mc-spark" style="margin-top:6px"></div>
    <div class="bc-src">PostgreSQL <code>mobility.mesh_stats</code>（${DBSRC.bucket}分バケット・source=${DBSRC.source}${DBSRC.source==='synthetic'?'＝合成データ':''}）。時系列は <code>/api/mesh/{id}</code></div>`;
  mcard.style.display='block'; mcard.style.left=Math.min(innerWidth-330, e.clientX+16)+'px'; mcard.style.top=Math.min(innerHeight-300, e.clientY+12)+'px';
  document.getElementById('mc-close').onclick=()=>{ mcard.style.display='none'; };
  if(!c.meta){ document.getElementById('mc-peak').textContent='—'; document.getElementById('mc-org').textContent='—'; document.getElementById('mc-dst').textContent='—'; document.getElementById('mc-spark').innerHTML='<div class="hint">地域メッシュ／ヘックスは点（raw_points）の客側集計。時系列は正方 50/100/250m（mesh_stats）で表示できます</div>'; return; }
  dbFetch('meshd|'+c.code, `/api/mesh/${encodeURIComponent(c.code)}?t=${encodeURIComponent(dbIso(timeState.min))}&bucket=${Math.max(15, DBSRC.bucket)}&source=${DBSRC.source}`, j=>{
    const pk=document.getElementById('mc-peak'); if(!pk) return;
    pk.textContent = j.peak ? `${fmt(j.peak.people_count)} 人 @ ${clockStr(dbMinOf(Date.parse(j.peak.time_bucket)/1000))}` : '—';
    document.getElementById('mc-org').textContent = j.top_origins.length ? j.top_origins.map(o=>o.id).join(' / ') : '—';
    document.getElementById('mc-dst').textContent = j.top_destinations.length ? j.top_destinations.map(o=>o.id).join(' / ') : '—';
    const ts=j.timeseries; if(ts.length>1){ const W=290, H=44, mx=Math.max(1, ...ts.map(r=>r.people_count)); const x=i=>(dbMinOf(Date.parse(ts[i].time_bucket)/1000)+360)/1440*W; const pts=ts.map((r,i)=>`${x(i).toFixed(1)},${(H-4-(r.people_count/mx)*(H-8)).toFixed(1)}`).join(' ');
      const nowX=((timeState.min+360)/1440*W).toFixed(1);
      document.getElementById('mc-spark').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><polyline points="${pts}" fill="none" stroke="#33d9f2" stroke-width="1.5"/><line x1="${nowX}" y1="0" x2="${nowX}" y2="${H}" stroke="#ff8a1e" stroke-dasharray="3 2"/><text x="2" y="10" font-size="8" fill="#9eafb9">当日 ${Math.max(15,DBSRC.bucket)}分 人数（最大 ${fmt(mx)}）</text></svg>`; }
  });
}
/* ---------- 毎フレームの同期（400ms 間引き・変化があった時だけ取得） ---------- */
function dbTick(now){
  if(!DBSRC.on) return;
  /* シミュレーションの来訪者ドット・尾・ルートは隠す（時計は動かしたまま） */
  if(typeof flowHeads!=='undefined'){ flowHeads.visible=false; trailMesh.visible=false; routeGroup.visible=false; agentMesh.visible=false; }
  const st=document.getElementById('render-status'); if(st){ const s=DBSRC.stat; st.textContent = DBSRC.ok ? `DB/API 接続（${DBSRC.source}${DBSRC.source==='synthetic'?'＝合成':''}）· LOD ${DBSRC.lod==='points'?'点':DBSRC.lod+'m'}${s.mesh?` · mesh ${s.mesh.n} cells ${s.mesh.ms}ms`:''}${s.pts?` · 点 ${DBSRC.ptsN} ${s.pts.ms}ms`:''}` : `DB/API 未接続: ${DBSRC.err||'…'}`; }
  if(now-DBSRC.lastTick<400) return; DBSRC.lastTick=now;
  if(!DBSRC.health){ if(!DBSRC.inflight.has('health') && now-(DBSRC.lastConn||0)>4000){ DBSRC.lastConn=now; dbConnect(); } return; }
  const mode = (typeof FLOWVIS!=='undefined') ? FLOWVIS.mode : 'point';
  const lod = DBSRC.autoLod ? dbLodNow() : String(MESH.res);
  DBSRC.lod=lod;
  const tq = Math.floor((timeState.min+360)/Math.max(1, Math.min(DBSRC.bucket, 5)))*Math.max(1, Math.min(DBSRC.bucket, 5)) - 360;   // 時刻は最大5分刻みで丸めて取得
  const T = encodeURIComponent(dbIso(tq)); const bb = dbViewBBox(); const src=DBSRC.source;
  const wantMesh = MESH.on, wantPts = mode==='point' || lod==='points', wantTraj = TRAJ.on, wantFlow = FLOWA.on, wantHeat = HEATV.on;
  /* メッシュ: 正方 50/100/250 は mesh_stats、地域メッシュ/ヘックスは点を客側で集計 */
  if(wantMesh){
    if(MESH.kind==='jis'){ buildMesh(100, 'sq'); renderPanel(); }   // DB モードの既定は mesh_stats の正方グリッド（地域メッシュは客側集計になるため）
    if(MESH.kind==='sq' && DBSRC.autoLod && lod!=='points' && MESH.res!==+lod){ MESH.res=+lod; }
    if(MESH.kind==='sq' && ![50,100,250].includes(MESH.res)) MESH.res=100;
    if(MESH.kind==='sq'){ const key=`mesh|${MESH.res}|${DBSRC.bucket}|${T}|${ctrl.sph.radius<3000?bb:'all'}|${src}`;
      if(DBSRC.meshKey!==key){ DBSRC.meshKey=key; dbFetch('mesh', `/api/mesh?res=${MESH.res}&t=${T}&bucket=${DBSRC.bucket}&format=json&source=${src}${ctrl.sph.radius<3000?'&bbox='+bb:''}`, dbApplyMesh); } }
    else { const key=`bin|${MESH.kind}|${MESH.res}|${DBSRC.bucket}|${T}|${src}`;
      if(DBSRC.meshKey!==key){ DBSRC.meshKey=key; dbFetch('pts', `/api/people/current?t=${T}&window=${DBSRC.bucket}&limit=20000&source=${src}`, j=>{ dbApplyPoints(j); dbBinPoints(j); }); } }
    if(MESH.shapeKey!==DBSRC.shapeKey){ DBSRC.shapeKey=MESH.shapeKey; DBSRC.meshKey=''; }   // 柱/面/円柱の切替でセルを組み直す
  }
  /* 点 */
  if(wantPts){ const smp = ctrl.sph.radius>=3000 ? 0.2 : ctrl.sph.radius>=1500 ? 0.5 : 1; const key=`pts|${T}|${bb}|${smp}|${src}`;
    if(DBSRC.last.pts!==key){ DBSRC.last.pts=key; dbFetch('pts', `/api/people/current?t=${T}&window=5&limit=20000&sample=${smp}&bbox=${bb}&source=${src}`, dbApplyPoints); }
    if(DBSRC.pts) DBSRC.pts.visible = level!=='wide' && !(window.twinPcl && twinPcl.on); }
  else if(DBSRC.pts) DBSRC.pts.visible=false;
  /* 軌跡（動く軌跡は時間窓、累積は当日全体を上限 2000 本） */
  if(wantTraj){ const win = TRAJ.anim ? Math.max(30, (TRAJ.mat ? TRAJ.mat.uniforms.uTrail.value : 40)+10) : 1440; const tt = TRAJ.anim ? T : encodeURIComponent(dbIso(1080)); const key=`traj|${tt}|${win}|${src}|${TRAJ.mode}`;
    if(DBSRC.last.traj!==key){ DBSRC.last.traj=key; dbFetch('traj', `/api/trajectory?t=${tt}&window=${win}&limit=${TRAJ.anim?600:2000}&source=${src}`, dbApplyTraj); dbFetch('stays', `/api/stays?t=${tt}&window=${win}&limit=5000&source=${src}`, dbApplyStaysAsStops); } }
  /* 流線（OD: 直近 3 時間） */
  if(wantFlow){ const key=`od|${T}|${src}`; if(DBSRC.last.od!==key){ DBSRC.last.od=key; dbFetch('od', `/api/od?t=${T}&window=180&bucket=60&limit=48&source=${src}`, dbApplyFlow); } }
  /* ヒートマップ（滞在: 直近 1 時間） */
  if(wantHeat){ const key=`stays|${T}|${src}`; if(DBSRC.last.heat!==key){ DBSRC.last.heat=key; dbFetch('heat', `/api/stays?t=${T}&window=60&limit=20000&source=${src}`, dbApplyStays); } }
  /* KPI（市内 bbox） */
  { const key=`kpi|${T}|${src}`; if(DBSRC.last.kpi!==key){ DBSRC.last.kpi=key; dbFetch('kpi', `/api/people/bbox?bbox=${DB_DEFAULT_BBOX.join(',')}&t=${T}&window=60&source=${src}`, j=>{ DBSRC.kpi=j; }); } }
  /* 3DCityDB 建物: 近傍は LOD2 */
  if(DBSRC.bld){ DBSRC.bldGroup.visible = level!=='wide';
    if(DBSRC.bldLod2 && ctrl.sph.radius<1200){ const key=dbViewBBox(1.2); if(DBSRC.bldL2Key!==key && !DBSRC.inflight.has('bld2')){ DBSRC.bldL2Key=key; dbFetch('bld2', `/api/buildings?lod=2&bbox=${key}&limit=1500`, j=> dbApplyBuildingsL2(j, key)); } if(DBSRC.bldL1) DBSRC.bldL1.material.opacity=0.18; }
    else { if(DBSRC.bldL1) DBSRC.bldL1.material.opacity=0.55; DBSRC.bldL2.forEach(m=>{ DBSRC.bldGroup.remove(m); m.children.forEach(c=>c.geometry.dispose()); }); DBSRC.bldL2.clear(); DBSRC.bldL2Key=''; } }
}
/* ---------- パネル ---------- */
function dbSrcSec(){
  const h=DBSRC.health; const pg = h ? (h.pg||'').match(/PostgreSQL [\d.]+/) : null; const gis = h ? (h.postgis||'').match(/POSTGIS="([\d.]+)/) : null;
  const srcs = h && h.sources ? Object.entries(h.sources) : [];
  const status = !DBSRC.on ? '' : h ? `<div class="hint" style="margin-top:6px">接続 <code>${dbBase()}</code> · ${pg?pg[0]:'PostgreSQL'} · PostGIS ${gis?gis[1]:'?'} · 3DCityDB ${h.citydb_version? (Array.isArray(h.citydb_version)?h.citydb_version[0]:h.citydb_version) : '?'}（SRID ${h.citydb_srid}）· 建物 ${fmt(h.citydb_buildings||0)} 棟 · 日付 ${DBSRC.dateLabel}</div>`
      : `<div class="hint" style="margin-top:6px;color:#ff9b90">API に接続できません（${DBSRC.err||'接続中…'}）。<code>cd infra/docker && docker compose up -d</code> または <code>uvicorn app.main:app</code> を起動し、URL を確認してください</div>`;
  const srcChips = srcs.map(([k,v])=>`<button class="chip ${DBSRC.source===k?'active':''}" data-dbsrc="${k}" title="${v[0]} 〜 ${v[1]}">${k}${k==='synthetic'?'（合成データ・実測ではない）':''} ${fmt(v[2])} 点</button>`).join('');
  return `<div class="sec"><div class="sec-t"><b>データソース</b> — シミュレーション ⇄ DB / API</div>
    <div class="row-btns" style="margin-bottom:6px"><button class="chip ${!DBSRC.on?'active':''}" data-dbmode="sim">ブラウザ内シミュレーション（synthetic）</button><button class="chip ${DBSRC.on?'active':''}" data-dbmode="db">DB / API（PostgreSQL + PostGIS + 3DCityDB）</button></div>
    ${DBSRC.on ? `<div style="display:flex;gap:6px;align-items:center;margin:4px 0"><input id="db-url" type="text" value="${dbBase()}" style="flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:6px;padding:4px 6px;font-size:11px"><button class="chip" id="db-reconnect">再接続</button></div>
    ${srcChips ? `<div class="row-btns" style="margin-bottom:6px">${srcChips}</div>` : ''}
    <div class="row-btns" style="margin-bottom:6px">${[1,5,15,30,60].map(b=>`<button class="chip ${DBSRC.bucket===b?'active':''}" data-dbbucket="${b}">${b}分</button>`).join('')}<span class="hint" style="align-self:center">集計バケット</span></div>
    <div class="row-btns" style="margin-bottom:6px"><button class="chip ${DBSRC.autoLod?'active':''}" data-dblod="auto">ズーム連動 LOD（250m→100m→50m→点）</button><span class="hint" style="align-self:center">現在: ${DBSRC.lod==='points'?'サンプル点':DBSRC.lod+'m'}</span></div>
    <div class="row-btns" style="margin-bottom:6px"><button class="chip ${DBSRC.bld?'active':''}" data-dbbld="1">3DCityDB 建物を重ねる（LOD1 / 近傍 LOD2）</button>${DBSRC.bld?`<span class="hint" style="align-self:center">LOD1 ${fmt(DBSRC.bldN||0)} 棟${DBSRC.bldL2N?` · LOD2 ${fmt(DBSRC.bldL2N)} 棟`:''}</span>`:''}</div>` : ''}
    ${status}
    <div class="hint" style="margin-top:6px">${DBSRC.on ? 'ブラウザは PostgreSQL に直接接続せず、<code>/api/*</code>（FastAPI）から GeoJSON / JSON を取得。点＝raw_points、メッシュ＝mesh_stats（正方 50/100/250m、地域メッシュ・ヘックスは点を客側集計）、軌跡＝trajectories、流線＝od、ヒートマップ＝stays（重み＝滞在時間）、建物＝citydb（3DCityDB v5）。人数は実人数（ドット換算なし）' : '「DB / API」に切り替えると、同じ画面のまま PostgreSQL/PostGIS（mobility スキーマ）と 3DCityDB（citydb スキーマ）の値を表示します。<code>infra/README_DB.md</code> 参照'}</div></div>`;
}
function bindDbSrc(){
  document.querySelectorAll('[data-dbmode]').forEach(b=> b.onclick=()=> setDbSource(b.dataset.dbmode==='db'));
  document.querySelectorAll('[data-dbsrc]').forEach(b=> b.onclick=()=>{ DBSRC.source=b.dataset.dbsrc; DBSRC.meshKey=''; DBSRC.last={}; dbConnect(); });
  document.querySelectorAll('[data-dbbucket]').forEach(b=> b.onclick=()=>{ DBSRC.bucket=+b.dataset.dbbucket; DBSRC.meshKey=''; renderPanel(); });
  document.querySelectorAll('[data-dblod]').forEach(b=> b.onclick=()=>{ DBSRC.autoLod=!DBSRC.autoLod; DBSRC.meshKey=''; renderPanel(); });
  document.querySelectorAll('[data-dbbld]').forEach(b=> b.onclick=()=> setDbBuildings(!DBSRC.bld));
  const rc=document.getElementById('db-reconnect'); if(rc) rc.onclick=()=>{ DBSRC.base=document.getElementById('db-url').value.trim().replace(/\/$/,''); DBSRC.health=null; DBSRC.bldL1=null; DBSRC.bldGroup.clear(); DBSRC.meshKey=''; DBSRC.last={}; dbConnect(); };
}
if(window.TWIN_CONFIG && TWIN_CONFIG.api && TWIN_CONFIG.api.autoConnect){ setDbSource(true); }
window.twinDb = DBSRC; DBSRC.meshCard = dbMeshCard; DBSRC.setBuildings = setDbBuildings; DBSRC.setSource = setDbSource; DBSRC.connect = dbConnect;
