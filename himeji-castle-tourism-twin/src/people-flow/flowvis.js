
/* ================= 人流 Visualization モード（Phase 4〜7）: 粒子 / 熱（ガウス密度・GPU） / グリッド / ヘックス / 柱 / 流線 / 軌跡 / 等高線 =================
   情報軸の分離: 高さ＝人数、色＝密度（Blue→Cyan→Yellow→Orange→Red）、不透明度＝信頼度（サンプル数）、サイズ＝滞在時間、アニメ速度＝歩行速度 */
const FLOWVIS = { mode:'point', modes:[['point','粒子'],['heat','熱'],['grid','グリッド'],['hex','ヘックス'],['column','柱'],['flow','流線'],['trips','軌跡'],['contour','等高線']] };
function densC(t){ return rampC(DENS_RAMP, t); }

/* ---------- 熱（ガウス密度ヒートマップ・GPU スプラット） ---------- */
const HEATV = { on:false, size:512, ext:2700, rt:null, scene:new THREE.Scene(), cam:null, pts:null, mesh:null, uni:null, max:1, lastRead:0, peak:0 };
function heatInit(){
  if(HEATV.rt) return;
  const gl2 = renderer.capabilities.isWebGL2;
  const type = gl2 ? THREE.FloatType : (renderer.extensions.get('OES_texture_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType);
  HEATV.type = type;
  HEATV.rt = new THREE.WebGLRenderTarget(HEATV.size, HEATV.size, {type, format:THREE.RGBAFormat, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, depthBuffer:false, stencilBuffer:false});
  const E=HEATV.ext; HEATV.cam = new THREE.OrthographicCamera(-E, E, E, -E, 0.1, 10); HEATV.cam.position.set(0,0,5); HEATV.cam.lookAt(0,0,0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_AG*3), 3)); g.setAttribute('w', new THREE.BufferAttribute(new Float32Array(MAX_AG), 1)); g.setDrawRange(0,0);
  HEATV.pts = new THREE.Points(g, new THREE.ShaderMaterial({ transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uR:{value:CONFIG.peopleFlow.heatmapRadius}, uPx:{value:HEATV.size/(2*E)} },
    vertexShader:'uniform float uR; uniform float uPx; attribute float w; varying float vW; void main(){ vW=w; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=max(2.0, uR*2.0*uPx); }',
    fragmentShader:'varying float vW; void main(){ vec2 q=gl_PointCoord-0.5; float d2=dot(q,q)*4.0; if(d2>1.0) discard; float g=exp(-d2*3.0)-exp(-3.0); gl_FragColor=vec4(g*vW,0.0,0.0,1.0); }' }));
  HEATV.pts.frustumCulled=false; HEATV.scene.add(HEATV.pts);
  /* 表示面（地形に沿う） */
  const N=128, geo=new THREE.PlaneGeometry(2*E, 2*E, N, N); const ps=geo.attributes.position; for(let i=0;i<ps.count;i++) ps.setZ(i, TH(ps.getX(i), -ps.getY(i))+1.6);
  HEATV.uni = { uTex:{value:HEATV.rt.texture}, uMax:{value:1}, uExt:{value:E}, uOpacity:{value:0.82}, uGamma:{value:0.65} };
  HEATV.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:HEATV.uni,
    vertexShader:'uniform float uExt; varying vec2 vT; void main(){ vT=vec2((position.x+uExt)/(2.0*uExt), (-position.y+uExt)/(2.0*uExt)); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform sampler2D uTex; uniform float uMax; uniform float uOpacity; uniform float uGamma; varying vec2 vT;
      vec3 ramp(float t){ vec3 c0=vec3(0.16,0.35,0.85), c1=vec3(0.2,0.85,0.95), c2=vec3(1.0,0.85,0.3), c3=vec3(1.0,0.55,0.15), c4=vec3(0.95,0.2,0.2); t=clamp(t,0.0,1.0);
        return t<0.25 ? mix(c0,c1,t/0.25) : t<0.5 ? mix(c1,c2,(t-0.25)/0.25) : t<0.75 ? mix(c2,c3,(t-0.5)/0.25) : mix(c3,c4,(t-0.75)/0.25); }
      void main(){ float v=texture2D(uTex, vT).r/max(uMax,1e-4); float t=pow(clamp(v,0.0,1.0), uGamma); float a=smoothstep(0.02,0.22,v)*uOpacity; gl_FragColor=vec4(ramp(t), a); }` }));
  HEATV.mesh.rotation.x=-Math.PI/2; HEATV.mesh.visible=false; HEATV.mesh.renderOrder=5; scene.add(HEATV.mesh);
  HEATV.readBuf = new Float32Array(HEATV.size*HEATV.size*4);
}
function heatUpdate(now){
  if(!HEATV.on) return;
  const g=HEATV.pts.geometry, P=g.attributes.position.array, W=g.attributes.w.array; let n=0;
  if(window.twinDb && twinDb.on){ const H=twinDb.heat, N=P.length/3; for(let i=0;i+2<H.length && n<N;i+=3){ const x=H[i], z=H[i+1]; if(Math.abs(x)>HEATV.ext||Math.abs(z)>HEATV.ext) continue; P[n*3]=x; P[n*3+1]=z; P[n*3+2]=0; W[n]=H[i+2]; n++; } }
  else for(const a of agents){
    if(!segByFilter(a.seg)) continue;
    let x=a.cur.x, z=a.cur.z;
    if(a.state==='castle'){ if(a.zr===undefined) a.zr=rnd(); let acc=0, zn=ZONES[ZONES.length-1]; for(const zz of ZONES){ acc+=zz.frac; if(a.zr<=acc){ zn=zz; break; } } x=zn.node.x+a.jx*0.35; z=zn.node.z+a.jz*0.35; }
    if(Math.abs(x)>HEATV.ext||Math.abs(z)>HEATV.ext) continue;
    P[n*3]=x; P[n*3+1]=z; P[n*3+2]=0; W[n]=1; n++;
  }
  g.setDrawRange(0,n); g.attributes.position.needsUpdate=true; g.attributes.w.needsUpdate=true;
  HEATV.pts.material.uniforms.uR.value = CONFIG.peopleFlow.heatmapRadius;
  const prev=renderer.getRenderTarget(); const cc=new THREE.Color(); renderer.getClearColor(cc); const ca=renderer.getClearAlpha();
  renderer.setRenderTarget(HEATV.rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(HEATV.scene, HEATV.cam);
  renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca);
  /* 正規化: 0.6秒ごとにピークを読み戻す（ゆっくり追従して点滅を防ぐ） */
  if(now-HEATV.lastRead>600 && HEATV.type!==THREE.UnsignedByteType){
    HEATV.lastRead=now; let mx=0; try{ renderer.readRenderTargetPixels(HEATV.rt, 0, 0, HEATV.size, HEATV.size, HEATV.readBuf); const B=HEATV.readBuf; for(let i=0;i<B.length;i+=4){ if(B[i]>mx) mx=B[i]; } }catch(e){}
    HEATV.peak = mx; const target=Math.max(0.8, mx)*0.85/Math.max(0.2, CONFIG.peopleFlow.heatmapIntensity); HEATV.uni.uMax.value += (target-HEATV.uni.uMax.value)*0.35;
  } else if(HEATV.type===THREE.UnsignedByteType){ HEATV.uni.uMax.value = 0.9/Math.max(0.2, CONFIG.peopleFlow.heatmapIntensity); }
}
function setHeatV(on){ HEATV.on=on; if(on) heatInit(); if(HEATV.mesh) HEATV.mesh.visible=on && level!=='wide'; }


/* ---------- 流線（Origin → Destination のアーク）: 来訪者のレグ（ゲート→城→回遊先→帰路/宿泊）を集計 ---------- */
const OD = new Map();
const FLOWA = { on:false, group:new THREE.Group(), meshes:[], dirty:true, last:0, rows:[] };
FLOWA.group.visible=false; scene.add(FLOWA.group);
function odRecord(a, to){
  const from = a.legFrom || ('gate:'+a.gk); a.legFrom = to; if(from===to) return;
  const k=from+'>'+to; let r=OD.get(k); if(!r){ r={from,to,n:0,seg:[0,0,0]}; OD.set(k,r); }
  r.n++; r.seg[SEG_KEYS.indexOf(a.seg)]++; FLOWA.dirty=true;
}
function odNodePos(key){
  if(key.startsWith('gate:')||key.startsWith('exit:')){ const g=GATES[key.slice(5)]; return g ? {x:g.x, z:g.z} : null; }
  if(key==='castle') return GATE_OTEMON; if(key==='stay') return {x:STN.x+80, z:STN.z-120};
  const p=P(key); return (p.x||p.z) ? p : null;
}
function odLabel(key){
  if(key.startsWith('gate:')){ const g=GATES[key.slice(5)]; return g ? g.name : key; }
  if(key.startsWith('exit:')){ const g=GATES[key.slice(5)]; return (g ? g.name : key)+'（帰路）'; }
  if(key==='castle') return '姫路城（大手門）'; if(key==='stay') return '市内宿泊'; return key;
}
function buildArcT(a, b, colv, share, group, lift=0.2){
  const ya=TH(a.x,a.z)+4, yb=TH(b.x,b.z)+4, d=Math.hypot(a.x-b.x, a.z-b.z);
  const mid=new THREE.Vector3((a.x+b.x)/2, Math.max(ya,yb)+40+d*lift, (a.z+b.z)/2);
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x,ya,a.z), mid, new THREE.Vector3(b.x,yb,b.z));
  const geo=new THREE.TubeGeometry(curve, 48, 2.5+share*22, 6, false);
  const uni={uCol:{value:new THREE.Color(colv)}, uTime:{value:Math.random()*4}, uAct:{value:0.3+0.9*share}};
  const mat=new THREE.ShaderMaterial({ uniforms:uni, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'varying vec2 vUv; uniform vec3 uCol; uniform float uTime,uAct; void main(){ float band=pow(0.5+0.5*sin((vUv.x*4.0-uTime)*6.28318),3.0); float head=smoothstep(0.0,0.05,vUv.x)*smoothstep(1.0,0.95,vUv.x); gl_FragColor=vec4(uCol*(0.5+0.8*band), uAct*(0.12+0.6*band)*head); }' });
  const m=new THREE.Mesh(geo, mat); group.add(m); arcUnis.push(uni); return {uni, mesh:m};
}
function rebuildFlowArcs(now){
  if(window.twinDb && twinDb.on) return;   // DB モードは api_client が /api/od からアークを作る
  if(!FLOWA.on || !FLOWA.dirty || now-FLOWA.last<2500) return; FLOWA.dirty=false; FLOWA.last=now;
  FLOWA.meshes.forEach(m=>{ FLOWA.group.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); const i=arcUnis.indexOf(m.uni); if(i>=0) arcUnis.splice(i,1); }); FLOWA.meshes=[];
  const rows=[...OD.values()].filter(r=> r.n>=2 && (segFilter==='all' || r.seg[SEG_KEYS.indexOf(segFilter)]>0)).sort((a,b)=>b.n-a.n).slice(0,48); FLOWA.rows=rows;
  const mx=rows.length?rows[0].n:1;
  rows.forEach(r=>{ const a=odNodePos(r.from), b=odNodePos(r.to); if(!a||!b) return; const share=r.n/mx; const col=densC(Math.pow(share,0.55)); FLOWA.meshes.push(buildArcT(a, b, col.getHex(), share, FLOWA.group, 0.18)); });
}
function setFlowArcs(on){ FLOWA.on=on; FLOWA.group.visible=on && level!=='wide'; if(on){ FLOWA.dirty=true; FLOWA.last=0; } }
function flowRowsHTML(){
  const rows=FLOWA.rows.slice(0,8); const mx=rows.length?rows[0].n:1;
  return rows.length ? rows.map(r=>`<div class="bar-row"><span title="${odLabel(r.from)} → ${odLabel(r.to)}" style="width:118px">${odLabel(r.from).replace(/（.*?）/g,'')} → ${odLabel(r.to).replace(/（.*?）/g,'')}</span><div class="bar"><i style="width:${(r.n/mx*100).toFixed(0)}%;background:${hx6(densC(Math.pow(r.n/mx,0.55)).getHex())}"></i></div><b>${fmt(r.real ? r.n : r.n*AG_SCALE)}</b></div>`).join('') : (window.twinDb && twinDb.on ? '<div class="hint">この時間帯の OD（mobility.od・直近3時間）はありません</div>' : '<div class="hint">▶ で再生するとレグ（ゲート→城→回遊先→帰路）が集計されます</div>');
}
function flowSec(){
  if(!FLOWA.on) return '';
  return `<div class="sec"><div class="sec-t"><b>流線（Origin → Destination）</b> — 本日のレグ集計</div>
    <div id="flow-rows">${flowRowsHTML()}</div>
    <div class="grad-bar dens" style="margin-top:6px"></div><div class="grad-lbl"><span>少</span><span>多（本日累計）</span></div>
    <div class="hint" style="margin-top:6px">アークの太さ・色＝OD ペアの人数（本日累計、1ドット＝${AG_SCALE}人）、帯の流れ＝方向。実データでは携帯位置情報の滞在→滞在の遷移（トリップ）から作ります。</div></div>`;
}
/* ---------- 動く軌跡（TripsLayer 相当） ---------- */
function setTripsAnim(on){ TRAJ.anim=!!on; if(TRAJ.mat){ TRAJ.mat.uniforms.uAnim.value=on?1:0; } if(TRAJ.stops) TRAJ.stops.visible=!on; }


/* ---------- Analytics（KPI）: 現在滞在・流入・流出・平均滞在・ピーク・混雑メッシュ数・平均速度・前時間帯比・主要 Origin/Destination ---------- */
const ANA = { hist:[], peak:0, peakT:0, lastRec:-1e9, busy:0, busyCells:0, speed:0, lastBusy:0, origin:'—', dest:'—' };
function anaRecord(){
  const t=timeState.min; if(t-ANA.lastRec < 5 && ANA.hist.length) return;   // 5分ごと
  ANA.lastRec=t; const arr=STATS.arrived.in+STATS.arrived.dom+STATS.arrived.loc, dep=Object.values(STATS.departed).reduce((a,b)=>a+b,0);
  ANA.hist.push({t, inCity:agents.length, arr, dep}); if(ANA.hist.length>400) ANA.hist.shift();
  if(agents.length>ANA.peak){ ANA.peak=agents.length; ANA.peakT=t; }
}
function anaAt(minAgo){ const t=timeState.min-minAgo; let best=null; for(const h of ANA.hist){ if(h.t<=t) best=h; } return best; }
function anaBusy(now){
  if(now-ANA.lastBusy<700) return; ANA.lastBusy=now;
  const G=100, bins=new Map(); let spd=0, nm=0;
  for(const a of agents){ if(!segByFilter(a.seg)) continue; const k=Math.floor(a.cur.x/G)+','+Math.floor(a.cur.z/G); bins.set(k,(bins.get(k)||0)+AG_SCALE); if(a.state==='move'){ spd+=a.sp; nm++; } }
  let busy=0; bins.forEach(v=>{ if(v>=160) busy++; }); ANA.busyCells=busy; ANA.speed = nm? spd/nm/60 : 0;   // 100m メッシュで 160人以上（0.016人/m²）を混雑
  const gates=Object.entries(STATS.byGate).sort((a,b)=>b[1]-a[1]); ANA.origin = gates.length ? GATES[gates[0][0]].name : '—';
  const spots=Object.entries(STATS.atSpot||{}).sort((a,b)=>b[1]-a[1]); ANA.dest = spots.length && spots[0][1]>0 ? spots[0][0] : (STATS.inCastle>0 ? '姫路城' : '—');
}
function anaSec(){ return `<div class="sec"><div class="sec-t">Analytics — 現在時刻の指標（${(window.twinDb && twinDb.on) ? 'DB 集計・実人数' : '1ドット＝'+AG_SCALE+'人'}）</div><div class="kpi-grid" id="kpi-ana"></div></div>`; }
function updateAna(){
  const k=document.getElementById('kpi-ana'); if(!k) return;
  if(window.twinDb && twinDb.on){ dbUpdateAna(k); return; }
  const people=n=>fmt(n*AG_SCALE); const h60=anaAt(60), cur=ANA.hist[ANA.hist.length-1];
  const inflow = (cur&&h60) ? cur.arr-h60.arr : 0, outflow = (cur&&h60) ? cur.dep-h60.dep : 0;
  const ratio = (h60 && h60.inCity>0) ? agents.length/h60.inCity : null;
  let staySum=0, stayN=0; for(const a of agents){ if(a.tStop!=null){ staySum += timeState.min-a.tStop; stayN++; } }
  const stay = stayN ? staySum/stayN : 0;
  k.innerHTML =
    kpi(people(agents.length), '現在 滞在人口（市内）') +
    kpi(people(inflow), '流入（直近1時間）') +
    kpi(people(outflow), '流出（直近1時間）') +
    kpi(stay ? Math.round(stay)+'<small> 分</small>' : '—', '平均滞在時間（滞留中の平均）') +
    kpi(people(ANA.peak)+`<small> ${clockStr(ANA.peakT)}</small>`, 'ピーク人数（本日）') +
    kpi(String(ANA.busyCells), '混雑メッシュ数（100m・160人以上）') +
    kpi(ANA.speed ? ANA.speed.toFixed(2)+'<small> m/s</small>' : '—', '平均移動速度（移動中）') +
    kpi(ratio!=null ? (ratio>=1?'+':'')+((ratio-1)*100).toFixed(0)+'<small> %</small>' : '—', '前時間帯比（滞在人口）') +
    kpi(`<span style="font-size:13px">${ANA.origin.replace(/（.*?）/g,'')}</span>`, '主要 Origin（到着ゲート）') +
    kpi(`<span style="font-size:13px">${ANA.dest}</span>`, '主要 Destination（滞留先）');
}
/* ---------- メッシュクリック → 詳細パネル ---------- */
const mcard = document.getElementById('mcard');
function meshClick(e){
  if(!MESH.on || !MESH.inst || !MESH.group.visible) return false;
  const hits = pick(e, [MESH.inst], false); if(!hits.length) return false;
  const c = MESH.cells[hits[0].instanceId]; showMeshCard(c, e); if(typeof pclSelect==='function' && window.twinPcl && twinPcl.on) pclSelect(c.cx, c.cz, Math.max(c.w, c.d)*0.6); return true;
}
function showMeshCard(c, e){
  if(!mcard) return; if(c.db){ dbMeshCard(c, e); return; }
  const bkt=Math.floor((timeState.min+360)/10); let inflow=0, outflow=0; for(let b=bkt-5;b<=bkt;b++){ inflow+=(c.in[b]||0); outflow+=(c.out[b]||0); }
  let staySum=0, stayN=0, spd=0, nm=0; const org={}, dst={};
  (c.ag||[]).forEach(a=>{ if(a.tStop!=null){ staySum+=timeState.min-a.tStop; stayN++; } if(a.state==='move'){ spd+=a.sp; nm++; }
    const g=GATES[a.gk]; if(g) org[g.name]=(org[g.name]||0)+1;
    const nx = a.pi<a.plan.length ? (a.plan[a.pi].kind==='castle' ? '姫路城' : a.plan[a.pi].name) : (a.endKind==='stay' ? '市内宿泊' : '帰路（'+(ORIGIN_BY_ID[a.dest[0]]?ORIGIN_BY_ID[a.dest[0]].name:'市外')+'）'); dst[nx]=(dst[nx]||0)+1; });
  const top=o=>{ const e=Object.entries(o).sort((a,b)=>b[1]-a[1]); return e.length? e[0][0] : '—'; };
  const tot=Math.max(1,c.v);
  mcard.innerHTML = `<div class="bc-h"><b>${c.near||'メッシュ'}　<span style="color:var(--sub);font-weight:400">${c.code}</span></b><button class="bd-x" id="mc-close">✕</button></div>
    <div class="bc-g"><span>Mesh ID</span><b>${c.code}</b><span>People</span><b>${fmt(c.v)} 人</b><span>Stay</span><b>${stayN? Math.round(staySum/stayN)+' min' : '—'}</b><span>Inflow（1h）</span><b>${fmt(inflow*AG_SCALE)}</b><span>Outflow（1h）</span><b>${fmt(outflow*AG_SCALE)}</b><span>Walking Speed</span><b>${nm? (spd/nm/60).toFixed(2)+' m/s' : '—'}</b><span>Peak</span><b>${c.peak? fmt(c.peak)+' 人 @ '+clockStr(c.peakT) : '—'}</b><span>Origin</span><b>${top(org).replace(/（.*?）/g,'')}</b><span>Destination</span><b>${top(dst)}</b><span>構成</span><b>海外 ${(c.seg[0]/tot*100).toFixed(0)}%・国内 ${(c.seg[1]/tot*100).toFixed(0)}%・近隣 ${(c.seg[2]/tot*100).toFixed(0)}%</b></div>
    <div class="bc-src">セル内の来訪者ドットから算出（synthetic）。実データでは dwell_mesh / trip_trace テーブルの集計値に置き換わります</div>`;
  mcard.style.display='block'; mcard.style.left=Math.min(innerWidth-330, e.clientX+16)+'px'; mcard.style.top=Math.min(innerHeight-300, e.clientY+12)+'px';
  document.getElementById('mc-close').onclick=()=>{ mcard.style.display='none'; };
}


/* ---------- 等高線（混雑エリアを等高線で表示: 正方グリッドの密度を marching squares で追跡） ---------- */
const CONT = { on:false, group:new THREE.Group(), lines:null, last:0, levels:[0.12,0.25,0.45,0.7], res:100 };
CONT.group.visible=false; scene.add(CONT.group);
function contourBuild(now){
  if(!CONT.on || now-CONT.last<400 || !MESH.inst || MESH.kind!=='sq') return; CONT.last=now;
  const res=MESH.res, n1=Math.ceil(MESH_RANGE.x/res), n2=Math.ceil(MESH_RANGE.z/res), W=2*n1, H=2*n2;
  const F=new Float32Array(W*H); const mx=Math.max(1, MESH.max);
  MESH.cells.forEach(c=>{ const i=c.i+n1, j=c.j+n2; if(i>=0&&i<W&&j>=0&&j<H) F[j*W+i]=Math.min(1, c.v/mx); });
  /* 軽いぼかし（3x3）で滑らかに */
  const G=new Float32Array(W*H); for(let j=1;j<H-1;j++) for(let i=1;i<W-1;i++){ let s=0; for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++) s+=F[(j+dj)*W+(i+di)]*((di||dj)?1:2); G[j*W+i]=s/10; }
  const pos=[], col=[]; const cc=new THREE.Color();
  const cx=i=>(i-n1+0.5)*res, cz=j=>(j-n2+0.5)*res;
  CONT.levels.forEach((lv,li)=>{
    cc.copy(densC(0.2+0.8*lv));
    for(let j=0;j<H-1;j++) for(let i=0;i<W-1;i++){
      const a=G[j*W+i], b=G[j*W+i+1], c=G[(j+1)*W+i+1], d=G[(j+1)*W+i];
      const idx=(a>lv?8:0)|(b>lv?4:0)|(c>lv?2:0)|(d>lv?1:0); if(idx===0||idx===15) continue;
      const lerp=(p,q,vp,vq)=>p+(q-p)*((lv-vp)/((vq-vp)||1e-6));
      const top=[lerp(cx(i),cx(i+1),a,b), cz(j)], right=[cx(i+1), lerp(cz(j),cz(j+1),b,c)], bot=[lerp(cx(i),cx(i+1),d,c), cz(j+1)], left=[cx(i), lerp(cz(j),cz(j+1),a,d)];
      const segs={1:[[left,bot]],2:[[bot,right]],3:[[left,right]],4:[[top,right]],5:[[top,left],[bot,right]],6:[[top,bot]],7:[[top,left]],8:[[top,left]],9:[[top,bot]],10:[[top,right],[bot,left]],11:[[top,right]],12:[[left,right]],13:[[bot,right]],14:[[left,bot]]}[idx]||[];
      segs.forEach(([p,q])=>{ const y1=TH(p[0],p[1])+3+li*1.5, y2=TH(q[0],q[1])+3+li*1.5; pos.push(p[0],y1,p[1], q[0],y2,q[1]); col.push(cc.r,cc.g,cc.b, cc.r,cc.g,cc.b); });
    }
  });
  if(CONT.lines){ CONT.group.remove(CONT.lines); CONT.lines.geometry.dispose(); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  CONT.lines=new THREE.LineSegments(g, new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:0.95})); CONT.group.add(CONT.lines);
}
function setContour(on){ CONT.on=on; CONT.group.visible=on && level!=='wide'; if(on){ if(MESH.kind!=='sq') buildMesh(100,'sq'); MESH.style='2d'; meshRebuildShape(); MESH.inst.material.opacity=0.25; MESH.dirty=true; CONT.last=0; } else if(MESH.inst){ MESH.inst.material.opacity=0.86; } }
function contourSec(){ if(!CONT.on) return ''; return `<div class="sec"><div class="sec-t"><b>等高線</b> — 混雑エリアの輪郭（密度 ${CONT.levels.map(l=>(l*100).toFixed(0)+'%').join(' / ')}）</div><div class="grad-bar dens"></div><div class="grad-lbl"><span>低</span><span>高（ピーク比）</span></div><div class="hint" style="margin-top:6px">100m グリッドの滞在密度を 3×3 で平滑化し、等値線（marching squares）で追跡。内側の線ほど混雑。下地の面は薄く表示。</div></div>`; }
/* ---------- 性能: FPS 計測と自動軽量化（30fps を下回り続けたら補完点群・軌跡の負荷を下げる） ---------- */
const PERF = { frames:0, t0:performance.now(), fps:60, low:0, degraded:false };
function perfTick(now){
  PERF.frames++; const dt=now-PERF.t0; if(dt<1000) return; PERF.fps=PERF.frames*1000/dt; PERF.frames=0; PERF.t0=now;
  const el=document.getElementById('perf-fps'); if(el) el.textContent=PERF.fps.toFixed(0)+' fps';
  if(PERF.fps<28 && now>15000){ if(++PERF.low>=5 && !PERF.degraded){ PERF.degraded=true; const d=document.getElementById('cloud-density'); if(d){ d.value='50'; d.dispatchEvent(new Event('input')); } toast('描画負荷が高いため補完点群を 50% に自動調整しました（表示のデザインで変更可）', 3500); } } else PERF.low=0;
}

/* ---------- モード切替 ---------- */
function setFlowMode(mode){
  FLOWVIS.mode = mode;
  /* 既存機能とのマッピング: grid=地域メッシュ（MESH 3D柱）、trips=軌跡ライン（TRAJ）、flow=ODアーク（KDE無し）、column=MESH column スタイル */
  const wantMesh = (mode==='grid' || mode==='column' || mode==='hex' || mode==='contour');
  if(MESH.on!==wantMesh){ MESH.on=wantMesh; if(wantMesh && !MESH.inst) buildMesh(MESH.res); MESH.group.visible=wantMesh && level!=='wide'; document.getElementById('mesh-toggle').classList.toggle('active', wantMesh); }
  if(wantMesh){
    if(mode==='hex'){ if(MESH.kind!=='hex') buildMesh(174, 'hex'); MESH.style='3d'; }
    else if(mode==='contour'){ /* setContour が整える */ }
    else { if(MESH.kind==='hex') buildMesh(100, 'sq'); MESH.style = mode==='column' ? 'column' : (MESH.style==='column'||MESH.style==='2d'&&CONT.on ? '3d' : MESH.style); }
    meshRebuildShape(); MESH.dirty=true; }
  const wantTraj = (mode==='trips');
  if(TRAJ.on!==wantTraj){ TRAJ.on=wantTraj; TRAJ.group.visible=wantTraj && level!=='wide'; setGhost(wantTraj); document.getElementById('traj-toggle').classList.toggle('active', wantTraj); if(wantTraj) trajUpload(); }
  if(wantTraj && TRAJ.anim===undefined) setTripsAnim(true);
  setHeatV(mode==='heat');
  setFlowArcs(mode==='flow');
  setContour(mode==='contour');
  document.querySelectorAll('[data-fm]').forEach(b=>b.classList.toggle('active', b.dataset.fm===mode));
  if(level==='wide' && mode!=='point') setLevel('city');
  renderPanel();
}
function flowModeSec(){
  const chips = FLOWVIS.modes.map(([k,l])=>`<button class="chip ${FLOWVIS.mode===k?'active':''}" data-fm="${k}" title="${k}">${l}</button>`).join('');
  let extra='';
  if(FLOWVIS.mode==='heat') extra = `<div class="studio-label" style="margin:8px 0 4px">ぼかし半径 <output id="heat-r-v">${CONFIG.peopleFlow.heatmapRadius} m</output></div><input id="heat-r" type="range" min="40" max="400" step="10" value="${CONFIG.peopleFlow.heatmapRadius}" style="width:100%">
    <div class="studio-label" style="margin:8px 0 4px">強調 <output id="heat-i-v">×${CONFIG.peopleFlow.heatmapIntensity.toFixed(1)}</output></div><input id="heat-i" type="range" min="0.3" max="3" step="0.1" value="${CONFIG.peopleFlow.heatmapIntensity}" style="width:100%">
    <div class="grad-bar dens" style="margin-top:8px"></div><div class="grad-lbl"><span>低密度</span><span>高密度（ピーク基準）</span></div>
    <div class="hint" style="margin-top:6px">来訪者ドット（1ドット＝${AG_SCALE}人）をガウス核（σ≒半径/2.4）で GPU にスプラットした連続密度。色＝密度、透明度＝信頼度（密度が薄い所は消える）。実データでは携帯位置情報の点をそのまま入力できます。</div>`;
  if(FLOWVIS.mode==='point') extra = `<div class="hint" style="margin-top:6px">一人ひとり（サンプル化: 1ドット＝${AG_SCALE}人）の位置。細い尾＝直近の移動方向。右上「表示のデザイン」で粒子／軌跡／動線を切替。</div>`;
  return `<div class="sec"><div class="sec-t"><b>人流 Visualization</b> — 表現モード</div><div class="row-btns" id="fm-chips">${chips}</div>${extra}</div>`;
}
function bindFlowVis(){
  document.querySelectorAll('[data-fm]').forEach(b=> b.onclick=()=>{ if(window.twinAi) twinAi.user.viz=true; setFlowMode(b.dataset.fm); });   // USER > AI
  const r=document.getElementById('heat-r'); if(r) r.oninput=e=>{ CONFIG.peopleFlow.heatmapRadius=+e.target.value; document.getElementById('heat-r-v').value=e.target.value+' m'; };
  const i=document.getElementById('heat-i'); if(i) i.oninput=e=>{ CONFIG.peopleFlow.heatmapIntensity=+e.target.value; document.getElementById('heat-i-v').value='×'+(+e.target.value).toFixed(1); };
}
function updateFlowVis(dtMin, now){
  if(dtMin>0) anaRecord(); anaBusy(now);
  if(HEATV.on){ HEATV.mesh.visible = level!=='wide'; heatUpdate(now); }
  perfTick(now);
  if(CONT.on){ CONT.group.visible = level!=='wide'; contourBuild(now); }
  if(FLOWA.on){ FLOWA.group.visible = level!=='wide'; rebuildFlowArcs(now); const fr=document.getElementById('flow-rows'); if(fr && now-(FLOWA.lastUI||0)>600){ FLOWA.lastUI=now; fr.innerHTML=flowRowsHTML(); } }
  if(TRAJ.mat) TRAJ.mat.uniforms.uNow.value = timeState.min;
  if(typeof dbTick==='function') dbTick(now);
}
/* ヘッダーのトグルもモード切替に統一 */
document.getElementById('mesh-toggle').onclick = ()=> setFlowMode(MESH.on ? 'point' : 'grid');
document.getElementById('traj-toggle').onclick = ()=> setFlowMode(TRAJ.on ? 'point' : 'trips');
