
/* ================= 人流 Visualization モード（Phase 4〜7）: 粒子 / 熱（ガウス密度・GPU） / グリッド / ヘックス / 柱 / 流線 / 軌跡 / 等高線 =================
   情報軸の分離: 高さ＝人数、色＝密度（Blue→Cyan→Yellow→Orange→Red）、不透明度＝信頼度（サンプル数）、サイズ＝滞在時間、アニメ速度＝歩行速度 */
const CONFIG = window.TWIN_CONFIG = {
  peopleFlow: { pointSize:1.35, opacity:0.65, trailLength:24, heatmapRadius:110, heatmapIntensity:1.0, gridSize:100, heightScale:1.0 },
  buildings:  { opacity:1.0, lodDistance:2800 },
  camera:     { minZoom:30, maxZoom:30000, defaultPitch:0.88 },
};
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
  for(const a of agents){
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

/* ---------- モード切替 ---------- */
function setFlowMode(mode){
  FLOWVIS.mode = mode;
  /* 既存機能とのマッピング: grid=地域メッシュ（MESH 3D柱）、trips=軌跡ライン（TRAJ）、flow=ODアーク（KDE無し）、column=MESH column スタイル */
  const wantMesh = (mode==='grid' || mode==='column' || mode==='hex' || mode==='contour');
  if(MESH.on!==wantMesh){ MESH.on=wantMesh; if(wantMesh && !MESH.inst) buildMesh(MESH.res); MESH.group.visible=wantMesh && level!=='wide'; document.getElementById('mesh-toggle').classList.toggle('active', wantMesh); }
  if(wantMesh){
    if(mode==='hex'){ if(MESH.kind!=='hex') buildMesh(174, 'hex'); MESH.style='3d'; }
    else { if(MESH.kind==='hex') buildMesh(100, 'sq'); MESH.style = mode==='column' ? 'column' : (MESH.style==='column' ? '3d' : MESH.style); }
    meshRebuildShape(); MESH.dirty=true; }
  const wantTraj = (mode==='trips');
  if(TRAJ.on!==wantTraj){ TRAJ.on=wantTraj; TRAJ.group.visible=wantTraj && level!=='wide'; setGhost(wantTraj); document.getElementById('traj-toggle').classList.toggle('active', wantTraj); if(wantTraj) trajUpload(); }
  if(typeof setTripsAnim==='function') setTripsAnim(wantTraj);
  setHeatV(mode==='heat');
  if(typeof setFlowArcs==='function') setFlowArcs(mode==='flow');
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
  document.querySelectorAll('[data-fm]').forEach(b=> b.onclick=()=> setFlowMode(b.dataset.fm));
  const r=document.getElementById('heat-r'); if(r) r.oninput=e=>{ CONFIG.peopleFlow.heatmapRadius=+e.target.value; document.getElementById('heat-r-v').value=e.target.value+' m'; };
  const i=document.getElementById('heat-i'); if(i) i.oninput=e=>{ CONFIG.peopleFlow.heatmapIntensity=+e.target.value; document.getElementById('heat-i-v').value='×'+(+e.target.value).toFixed(1); };
}
function updateFlowVis(dtMin, now){
  if(HEATV.on){ HEATV.mesh.visible = level!=='wide'; heatUpdate(now); }
}
/* ヘッダーのトグルもモード切替に統一 */
document.getElementById('mesh-toggle').onclick = ()=> setFlowMode(MESH.on ? 'point' : 'grid');
document.getElementById('traj-toggle').onclick = ()=> setFlowMode(TRAJ.on ? 'point' : 'trips');
