/* ================= High Quality Point Cloud — 人流粒子（deck.gl PointCloudLayer 相当を Three.js の Custom Shader で実装） =================
   データ形: 1 レコード＝同一人物の連続 2 サンプル（線分: p0,t0 → p1,t1）。GPU で時刻補間（linear）し、線分に沿って K 個のサブ粒子を
   固定 seed で分布させる（道路・軌跡に沿った分布 / 密度感の維持 / チラつき無し）。粒子数 = 線分数 × K。K は Point Budget と LOD から決める。
   ・属性: position(p0,p1) / color(モード別ランプ) / normal(上向き) / density / stayDuration / speed / direction / timestamp(t0,t1) / confidence
   ・描画: soft circular point（Gaussian falloff）・距離連動サイズ 1〜3px・near/far fade・fog・彩度低下・弱い glow・depth test
   ・持続（Particle Persistence）: 同じジオメトリを uLag をずらして複数回描く（100ms→70%, 300ms→40%, 500ms→10%）
   ・軌跡 trail: 速度に応じて 3〜15m の短い線（instanced LineSegments）
   ・ソース: sim（ブラウザ内エージェント）/ db（/api/points バイナリ: bbox × time × lod × maxPoints）
   ・LOD: LOD0 都市 / LOD1 地区 / LOD2 街区 / LOD3 局所。Adaptive Point Budget（FPS<30 で減、>55 が続けば増）。カメラ移動中は 1/4 に間引き
   ・7 モード: PURE / SOFT / FLOW / DENSITY / VOLUME / TRAIL / LIDAR。色: density / speed / stay / direction。Z: ground / density / stay */
const PCL = {
  on:true, mode:'SOFT', color:'density', zmode:'ground', zScale:80, src:'sim',
  MAXSEG:262144, KMAX:192, K:8, kEff:8, alive:0, aliveT:0, count:0, lineCount:0, MAXLINE:200000,
  budget:{target:500000, cur:500000, min:200000, max:1000000, lo:0, hi:0, auto:true, probed:false},
  lodTarget:[30000, 150000, 500000, 1000000], lod:1,
  moving:false, movingUntil:0, lastCam:'', lastFeed:0, lastDbKey:'', dbWin:null, dbLoading:false, dbHeader:null, sel:null, selGeo:null,
  passes:[], lines:null, group:new THREE.Group(), geo:null, mat:null, debug:false, dbg:null, gpu:{ext:null, q:null, pending:false, ms:0}, bench:null,
  heat:false, pick:false, fadeIn:0, stats:{visible:0, loaded:0, draw:0}, ring:new WeakMap(), lasGroup:null, lasN:0, simDensBins:new Map()
};
PCL.group.renderOrder=7; scene.add(PCL.group);
PCL.MODES = [['PURE','PURE POINTS'],['SOFT','SOFT POINTS'],['FLOW','FLOW'],['DENSITY','DENSITY'],['VOLUME','VOLUME'],['TRAIL','TRAIL'],['LIDAR','LIDAR']];
/* 固定 seed 乱数（毎フレーム位置が変わらない） */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15, 1|a); t=t+Math.imul(t^t>>>7, 61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
/* ---------- シェーダ ---------- */
const PCL_RAMPS = `
vec3 rampDensity(float v){ vec3 c0=vec3(0.10,0.24,0.62), c1=vec3(0.20,0.85,0.95), c2=vec3(1.0,0.86,0.30), c3=vec3(1.0,0.55,0.15), c4=vec3(0.95,0.20,0.20);
  return v<0.25? mix(c0,c1,v/0.25) : v<0.5? mix(c1,c2,(v-0.25)/0.25) : v<0.75? mix(c2,c3,(v-0.5)/0.25) : mix(c3,c4,(v-0.75)/0.25); }
vec3 rampSpeed(float v){ vec3 c0=vec3(0.20,0.35,0.95), c1=vec3(0.25,0.85,0.95), c2=vec3(1.0,1.0,1.0); return v<0.5? mix(c0,c1,v/0.5) : mix(c1,c2,(v-0.5)/0.5); }
vec3 rampStay(float v){ vec3 c0=vec3(0.25,0.85,0.95), c1=vec3(1.0,0.86,0.30), c2=vec3(1.0,0.50,0.12); return v<0.5? mix(c0,c1,v/0.5) : mix(c1,c2,(v-0.5)/0.5); }
vec3 rampDir(float v){ /* 虹ではなく 4 色の周期パレット（teal→lavender→rose→sand→teal） */
  vec3 c0=vec3(0.30,0.80,0.80), c1=vec3(0.60,0.60,0.95), c2=vec3(0.95,0.60,0.70), c3=vec3(0.90,0.85,0.60); float u=fract(v)*4.0; int i=int(floor(u)); float f=fract(u);
  return i==0? mix(c0,c1,f) : i==1? mix(c1,c2,f) : i==2? mix(c2,c3,f) : mix(c3,c0,f); }`;
const PCL_VS = `
attribute float sizeJ; attribute vec3 iP0; attribute vec3 iP1; attribute vec2 iT; attribute vec4 iA; attribute vec4 iB;
uniform float uNow, uLag, uSizeNear, uSizeFar, uZScale, uZMode, uJitter, uHMin, uHMax, uDpr, uSpread, uDensBoost, uColorMode, uAlpha, uSelOn, uSelInv, uFogNear, uFogFar, uNearFade, uLidar, uPersist;
uniform vec3 uSel, uFogColor;
varying vec4 vC; varying float vLive;
${PCL_RAMPS}
void main(){
  float tNow = uNow - uLag; float span = max(iT.y - iT.x, 1e-3);
  float age = tNow - iT.y;   /* 線分の終端からの経過（分）。uPersist の間は経路上に粒を残して薄くする（連続した流れ） */
  if(tNow < iT.x - 0.2 || age > uPersist){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vC = vec4(0.0); vLive = 0.0; return; }
  float f = clamp((tNow - iT.x) / span, 0.0, 1.0);
  vec3 p = mix(iP0, iP1, f);
  vec3 d = iP1 - iP0; float L = length(d.xz); vec3 dn = L > 0.01 ? d / L : vec3(0.0, 0.0, 1.0); vec3 side = vec3(-dn.z, 0.0, dn.x);
  float dens = iA.x, stay = iA.y, spd = iA.z, conf = iA.w;
  /* 線分に沿ったサブ粒子の分布（尾側へ）＋ 横方向の小さな散らばり（密度が高いほど広がる） */
  p += dn * (-abs(position.x) * max(L * f, min(L, uSpread))) + side * (position.y * (0.9 + dens * 2.2 * uJitter));   /* 通過した区間を粒で埋める */
  /* 高さ: 地表 + 0.5〜1.5m、高密度は XYZ にわずかに分散（固定 seed）、Z モードで density / stay を高さに */
  float h = mix(uHMin, uHMax, position.z) + dens * (position.z - 0.5) * 6.0 * uJitter;
  if(uZMode > 0.5) h += (uZMode < 1.5 ? dens : stay) * uZScale;
  p.y += h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); float dist = -mv.z;
  float sz = mix(uSizeNear, uSizeFar, smoothstep(250.0, 6000.0, dist)) * (1.0 + dens * uDensBoost) * (0.85 + 0.3 * sizeJ);
  gl_PointSize = sz * uDpr; gl_Position = projectionMatrix * mv;
  vec3 c = uColorMode < 0.5 ? rampDensity(dens) : uColorMode < 1.5 ? rampSpeed(spd) : uColorMode < 2.5 ? rampStay(stay) : rampDir(iB.x);
  if(uLidar > 0.5) c = mix(vec3(0.82, 0.90, 0.95), vec3(0.55, 0.95, 1.0), spd);
  float depthFade = 1.0 - smoothstep(uFogNear, uFogFar, dist); float nearFade = smoothstep(uNearFade * 0.35, uNearFade, dist);
  float lum = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(c, vec3(lum), (1.0 - depthFade) * 0.6); c = mix(c, uFogColor, (1.0 - depthFade) * 0.55);
  float a = (0.55 + 0.45 * conf) * (age > 0.0 ? 1.0 - 0.8 * age / max(uPersist, 1e-3) : 1.0);
  if(uSelOn > 0.5){ float ds = distance(p.xz, uSel.xy); bool inside = ds < uSel.z; a *= (uSelInv > 0.5) ? (inside ? 0.0 : 1.0) : (inside ? 1.0 : 0.3); }
  vC = vec4(c, a * (0.35 + 0.65 * depthFade) * nearFade * uAlpha); vLive = 1.0;
}`;
const PCL_FS = `
uniform float uSharp, uSoft, uGlow; varying vec4 vC; varying float vLive;
void main(){ if(vLive < 0.5) discard; vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if(r2 > 1.0) discard;
  float a = uSoft < 0.5 ? (1.0 - smoothstep(0.45, 1.0, sqrt(r2))) : exp(-r2 * uSharp);
  vec3 col = vC.rgb * (1.0 + uGlow * a); gl_FragColor = vec4(col, a * vC.a); }`;
const PCL_LINE_VS = `
attribute vec3 iP0; attribute vec3 iP1; attribute vec2 iT; attribute vec4 iA; attribute vec4 iB;
uniform float uNow, uHMin, uHMax, uColorMode, uAlpha, uSelOn, uFogNear, uFogFar, uTrailMin, uTrailMax; uniform vec3 uSel, uFogColor;
varying vec4 vC;
${PCL_RAMPS}
void main(){
  float span = max(iT.y - iT.x, 1e-3);
  if(uNow < iT.x - 0.3 || uNow > iT.y + 0.3 || iA.z < 0.08){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vC = vec4(0.0); return; }
  float f = clamp((uNow - iT.x) / span, 0.0, 1.0);
  vec3 p = mix(iP0, iP1, f); vec3 d = iP1 - iP0; float L = length(d.xz); vec3 dn = L > 0.01 ? d / L : vec3(0.0);
  float side = position.x; float len = mix(uTrailMin, uTrailMax, iA.z);   /* 速度で 3〜15m */
  vec3 q = p - dn * len * side; q.y += mix(uHMin, uHMax, 0.5);
  vec4 mv = modelViewMatrix * vec4(q, 1.0); float dist = -mv.z; gl_Position = projectionMatrix * mv;
  vec3 c = uColorMode < 0.5 ? rampDensity(iA.x) : uColorMode < 1.5 ? rampSpeed(iA.z) : uColorMode < 2.5 ? rampStay(iA.y) : rampDir(iB.x);
  float depthFade = 1.0 - smoothstep(uFogNear, uFogFar, dist); c = mix(c, uFogColor, (1.0 - depthFade) * 0.5);
  float a = (1.0 - side) * 0.55 * uAlpha * depthFade;
  if(uSelOn > 0.5){ a *= distance(p.xz, uSel.xy) < uSel.z ? 1.0 : 0.3; }
  vC = vec4(c, a);
}`;
const PCL_LINE_FS = `varying vec4 vC; void main(){ if(vC.a <= 0.001) discard; gl_FragColor = vC; }`;
/* ---------- ジオメトリ / マテリアル ---------- */
function pclUniforms(){
  const fog = scene.fog;
  return { uNow:{value:0}, uLag:{value:0}, uSizeNear:{value:1.6}, uSizeFar:{value:2.6}, uZScale:{value:PCL.zScale}, uZMode:{value:0}, uJitter:{value:1}, uHMin:{value:0.5}, uHMax:{value:1.5},
    uDpr:{value:Math.min(devicePixelRatio||1, 2)}, uSpread:{value:6}, uDensBoost:{value:0.35}, uColorMode:{value:0}, uAlpha:{value:1}, uSelOn:{value:0}, uSelInv:{value:0},
    uFogNear:{value:fog?fog.near*0.6:6000}, uFogFar:{value:fog?fog.far:26000}, uNearFade:{value:40}, uLidar:{value:0}, uSel:{value:new THREE.Vector3()},
    uFogColor:{value:fog?fog.color.clone():new THREE.Color(0x0b1922)}, uPersist:{value:1.5}, uSharp:{value:3.2}, uSoft:{value:1}, uGlow:{value:0.18}, uTrailMin:{value:3}, uTrailMax:{value:15} };
}
function pclInit(){
  if(PCL.geo) return;
  const N=PCL.MAXSEG;
  PCL.aP0=new Float32Array(N*3); PCL.aP1=new Float32Array(N*3); PCL.aT=new Float32Array(N*2); PCL.aA=new Uint8Array(N*4); PCL.aB=new Uint8Array(N*4);
  const rnd=mulberry32(20261004); const sub=new Float32Array(PCL.KMAX*3), sj=new Float32Array(PCL.KMAX);
  for(let k=0;k<PCL.KMAX;k++){ sub[k*3]=(k===0?0:(rnd()*2-1)); sub[k*3+1]=(k===0?0:(rnd()*2-1)); sub[k*3+2]=rnd(); sj[k]=rnd(); }
  const mk=()=>{ const g=new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sub,3)); g.setAttribute('sizeJ', new THREE.BufferAttribute(sj,1));
    g.setAttribute('iP0', new THREE.InstancedBufferAttribute(PCL.aP0,3)); g.setAttribute('iP1', new THREE.InstancedBufferAttribute(PCL.aP1,3)); g.setAttribute('iT', new THREE.InstancedBufferAttribute(PCL.aT,2));
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(PCL.aA,4,true)); g.setAttribute('iB', new THREE.InstancedBufferAttribute(PCL.aB,4,true)); g.instanceCount=0; g.setDrawRange(0,PCL.K); g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e6); return g; };
  PCL.geo=mk();
  for(let i=0;i<7;i++){ const mat=new THREE.ShaderMaterial({uniforms:pclUniforms(), vertexShader:PCL_VS, fragmentShader:PCL_FS, transparent:true, depthTest:true, depthWrite:false, blending:THREE.NormalBlending});
    const pts=new THREE.Points(PCL.geo, mat); pts.frustumCulled=false; pts.visible=(i===0); PCL.group.add(pts); PCL.passes.push(pts); }
  /* trail（instanced LineSegments: 頂点 2 つ × インスタンス） */
  const lg=new THREE.InstancedBufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0]),3));
  ['iP0','iP1','iT','iA','iB'].forEach(n=> lg.setAttribute(n, PCL.geo.getAttribute(n)));
  lg.instanceCount=0; lg.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e6);
  PCL.lines=new THREE.LineSegments(lg, new THREE.ShaderMaterial({uniforms:pclUniforms(), vertexShader:PCL_LINE_VS, fragmentShader:PCL_LINE_FS, transparent:true, depthWrite:false}));
  PCL.lines.frustumCulled=false; PCL.lines.visible=false; PCL.group.add(PCL.lines);
  /* GPU 時間（EXT_disjoint_timer_query_webgl2） */
  try{ const gl=renderer.getContext(); if(renderer.capabilities.isWebGL2){ PCL.gpu.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'); } }catch(e){}
  pclApplyMode();
}
function pclSetCount(n){ PCL.count=n; PCL.geo.instanceCount=n; ['iP0','iP1','iT','iA','iB'].forEach(k=>{ PCL.geo.getAttribute(k).needsUpdate=true; }); PCL.lines.geometry.instanceCount=Math.min(n, PCL.MAXLINE); }
function pclWriteSeg(i, x0,y0,z0, x1,y1,z1, t0,t1, dens,stay,spd,conf, dir,seed){
  const P0=PCL.aP0, P1=PCL.aP1; P0[i*3]=x0; P0[i*3+1]=y0; P0[i*3+2]=z0; P1[i*3]=x1; P1[i*3+1]=y1; P1[i*3+2]=z1; PCL.aT[i*2]=t0; PCL.aT[i*2+1]=t1;
  const A=PCL.aA, B=PCL.aB; A[i*4]=dens; A[i*4+1]=stay; A[i*4+2]=spd; A[i*4+3]=conf; B[i*4]=dir; B[i*4+1]=seed; B[i*4+2]=i&255; B[i*4+3]=(i>>8)&255;
}
/* ---------- モード適用 ---------- */
function pclApplyMode(){
  const m=PCL.mode; const set=(k,v)=>{ PCL.passes.forEach(p=>{ if(p.material.uniforms[k]) p.material.uniforms[k].value=v; }); if(PCL.lines.material.uniforms[k]) PCL.lines.material.uniforms[k].value=v; };
  const lags = m==='TRAIL' ? [0,100,200,300,400,500,650] : (m==='FLOW' ? [0,100,300,500] : [0]);
  const alphas = m==='TRAIL' ? [1,0.8,0.62,0.45,0.3,0.18,0.08] : (m==='FLOW' ? [1,0.7,0.4,0.1] : [1]);
  PCL.lagsMs=lags; PCL.passes.forEach((p,i)=>{ p.visible = i<lags.length && PCL.on; p.material.uniforms.uAlpha.value = alphas[i]||0; p.material.depthWrite = (m==='PURE' && i===0); });
  set('uSoft', m==='PURE' ? 0 : 1); set('uSharp', m==='SOFT'||m==='DENSITY' ? 3.2 : m==='VOLUME' ? 2.6 : 4.0); set('uGlow', m==='PURE' ? 0 : m==='DENSITY' ? 0.25 : 0.15);
  set('uSizeNear', m==='PURE' ? 1.0 : m==='LIDAR' ? 1.0 : 1.5); set('uSizeFar', m==='PURE' ? 2.0 : m==='LIDAR' ? 1.8 : m==='DENSITY' ? 3.0 : 2.6);
  set('uDensBoost', m==='DENSITY' ? 0.6 : 0.35); set('uJitter', m==='VOLUME' ? 1.8 : 1.0); set('uSpread', m==='FLOW'||m==='TRAIL' ? 9 : 6);
  set('uLidar', m==='LIDAR' ? 1 : 0); set('uPersist', m==='TRAIL' ? 3.5 : m==='FLOW' ? 2.5 : m==='LIDAR' ? 1.0 : 1.5);
  const zm = m==='VOLUME' ? (PCL.zmode==='stay' ? 2 : 1) : (PCL.zmode==='density' ? 1 : PCL.zmode==='stay' ? 2 : 0); set('uZMode', zm); set('uZScale', PCL.zScale);
  set('uColorMode', {density:0, speed:1, stay:2, direction:3}[PCL.color] ?? 0);
  PCL.lines.visible = PCL.on && (m==='FLOW' || m==='TRAIL');
  PCL.heat = (m==='DENSITY'); if(typeof HEATV!=='undefined' && HEATV.uni){ HEATV.uni.uOpacity.value = PCL.heat ? 0.32 : 0.82; }
  if(typeof setHeatV==='function'){ if(PCL.heat && !HEATV.on){ setHeatV(true); PCL.heatAuto=true; } else if(!PCL.heat && PCL.heatAuto){ setHeatV(false); PCL.heatAuto=false; } }
  if(typeof fineCloud!=='undefined'){ fineCloud.userData.lidar = (m==='LIDAR'); }
  if(PCL.lasGroup) PCL.lasGroup.visible = (m==='LIDAR');
}
function setPclMode(m){ PCL.mode=m; pclApplyMode(); if(typeof toast==='function') toast(({PURE:'PURE POINTS: 1〜2px の硬い粒（AA 付き）。数十万の粒が都市表面を流れる',SOFT:'SOFT POINTS: ガウス減衰の柔らかい粒（弱い glow）',FLOW:'FLOW: 持続する粒子（100/300/500ms 前を 70/40/10%）＋速度に応じた 3〜15m の短い尾',DENSITY:'DENSITY: 密度で着色、下に薄いヒートマップ（点＝動き、ヒート＝密度）',VOLUME:'VOLUME: Z 軸を密度／滞在時間に使った立体点群',TRAIL:'TRAIL: 長めの持続（650ms まで 7 段）で流れを強調',LIDAR:'LIDAR: 都市点群を LiDAR 風（強度・高さ）に、人流は淡い白。LAS を読み込むと重ねて表示'})[m], 3800); renderPanel(); }
function setPclColor(c){ PCL.color=c; pclApplyMode(); renderPanel(); }
function setPclZ(z){ PCL.zmode=z; pclApplyMode(); renderPanel(); }
function setPclOn(on){ PCL.on=on; PCL.group.visible=on; pclApplyMode(); if(!on && typeof syncRefinement==='function') syncRefinement(); renderPanel(); }
/* ---------- LOD / Budget ---------- */
function pclLod(){ const r=ctrl.sph.radius; return r>=6000 ? 0 : r>=2500 ? 1 : r>=900 ? 2 : 3; }
function pclCameraMoving(now){
  const key=[ctrl.target.x.toFixed(1), ctrl.target.z.toFixed(1), ctrl.sph.radius.toFixed(1), ctrl.sph.phi.toFixed(4), ctrl.sph.theta.toFixed(4)].join('|');
  if(key!==PCL.lastCam){ PCL.lastCam=key; PCL.movingUntil=now+260; }
  PCL.moving = now < PCL.movingUntil || !!(typeof tween!=='undefined' && tween) || !!(typeof inertia!=='undefined' && inertia);
  return PCL.moving;
}
function pclBudgetTick(now){
  const B=PCL.budget; if(!B.auto) return;
  const fps = (typeof PERF!=='undefined') ? PERF.fps : 60;
  if(!B.probed && now>12000){ B.probed=true; B.cur = fps<38 ? B.min : fps>58 ? 800000 : B.target; }   // 起動時の GPU 性能から初期値
  if(fps<30){ B.lo+=1; B.hi=0; if(B.lo>=2){ B.lo=0; B.cur=Math.max(B.min, Math.round(B.cur*0.75)); } }
  else if(fps>55){ B.hi+=1; B.lo=0; if(B.hi>=3){ B.hi=0; B.cur=Math.min(B.max, Math.round(B.cur*1.15)); } }
  else { B.lo=0; B.hi=0; }
}
function pclAlive(now){   /* 現在時刻に生きている線分数（K の基準）。250ms ごとに数える */
  if(now-PCL.aliveT<250) return PCL.alive; PCL.aliveT=now; const t=timeState.min, T=PCL.aT, per=(PCL.passes[0]?PCL.passes[0].material.uniforms.uPersist.value:1.5); let n=0;
  for(let i=0;i<PCL.count;i++){ if(t>=T[i*2]-0.2 && t<=T[i*2+1]+per) n++; } PCL.alive=n; return n;
}
function pclChooseK(now){
  const lod=pclLod(); PCL.lod=lod; const target=Math.min(PCL.budget.cur, PCL.lodTarget[lod]); const alive=Math.max(1, pclAlive(now));
  let K = PCL.count ? Math.max(1, Math.min(PCL.KMAX, Math.floor(target/alive))) : 1;
  PCL.K=K; const kEff = PCL.moving ? Math.max(1, Math.round(K*0.25)) : K;
  PCL.kEff += (kEff-PCL.kEff)*0.4; if(Math.abs(kEff-PCL.kEff)<0.6) PCL.kEff=kEff;
  PCL.geo.setDrawRange(0, Math.max(1, Math.round(PCL.kEff)));
  PCL.stats.visible = PCL.alive*Math.max(1, Math.round(PCL.kEff));
}
/* ---------- sim フィード: エージェントの位置履歴（0.35 分ごと）から線分を作る ---------- */
function pclFeedSim(now){
  if(now-PCL.lastFeed<90) return; PCL.lastFeed=now;
  const t=timeState.min, G=50, bins=PCL.simDensBins; bins.clear();
  for(const a of agents){ if(!segByFilter(a.seg) || !LAYER_STATE.agents) continue; const k=((a.cur.x/G)|0)*4096+((a.cur.z/G)|0); bins.set(k,(bins.get(k)||0)+AG_SCALE); }
  let n=0, ai=0; const N=PCL.MAXSEG;
  for(const a of agents){
    if(!segByFilter(a.seg) || !LAYER_STATE.agents) continue; if(a.state==='castle' && level==='castle') continue;
    let x=a.cur.x, z=a.cur.z; if(a.state==='castle'){ x=CASTLE.x-60+a.jx; z=CASTLE.z+130+a.jz; } else if(a.state==='spot'){ x+=a.jx*0.35; z+=a.jz*0.35; } else if(a.state==='stay'){ x+=a.jx*0.15; z+=a.jz*0.15; }
    let r=PCL.ring.get(a); if(!r || r.t0>t){ r={s:[], t0:t}; PCL.ring.set(a,r); }
    const last=r.s[r.s.length-1];
    if(!last || t-last[2]>=0.35 || t<last[2]){ if(t<(last?last[2]:-1e9)) r.s.length=0; r.s.push([x,z,t]); if(r.s.length>6) r.s.shift(); }
    const dens=Math.min(255, (bins.get(((a.cur.x/G)|0)*4096+((a.cur.z/G)|0))||0)/40*255)|0;
    const stay=a.tStop!=null ? Math.min(255, (t-a.tStop)/60*255)|0 : 0, spd=a.state==='move' ? Math.min(255, (a.sp/60)/3*255)|0 : 0;
    const seed=(ai++)&255;
    const s=r.s; const m=s.length;
    for(let j=0;j<m && n<N;j++){ const p0=s[j], p1=(j<m-1)?s[j+1]:[x,z,t]; if(p1[2]-p0[2]<1e-3 && j<m-1) continue;
      const dir=Math.atan2(p1[1]-p0[1], p1[0]-p0[0]); const d8=((dir/Math.PI/2+0.5)*255)&255;
      pclWriteSeg(n++, p0[0], TH(p0[0],p0[1]), p0[1], p1[0], TH(p1[0],p1[1]), p1[1], p0[2], (j<m-1)?p1[2]:t+0.001, dens, stay, spd, 255, d8, seed); }
  }
  pclSetCount(n); PCL.stats.loaded=n; PCL.src='sim';
}
/* ---------- DB フィード: /api/points バイナリ（bbox × time × lod × maxPoints） ---------- */
function pclParseBinary(buf){
  const u8=new Uint8Array(buf); if(String.fromCharCode(u8[0],u8[1],u8[2],u8[3])!=='HPC1') throw new Error('bad magic');
  const hl=new DataView(buf,4,4).getUint32(0,true); const h=JSON.parse(new TextDecoder().decode(u8.subarray(8,8+hl))); let o=8+hl; const n=h.count;
  const f32=(cnt)=>{ const a=new Float32Array(buf.slice(o,o+cnt*4)); o+=cnt*4; return a; }; const pos0=f32(n*2), pos1=f32(n*2), t0=f32(n), t1=f32(n);
  const attr=u8.slice(o,o+n*4); o+=n*4; const dir=u8.slice(o,o+n); o+=n; const pid=new Uint32Array(buf.slice(o,o+n*4));
  return {h, n, pos0, pos1, t0, t1, attr, dir, pid};
}
function pclApplyDb(d, extra){
  const base=extra ? PCL.baseCount||0 : 0; let n=base; const N=PCL.MAXSEG; const tb=d.h.tbase;
  for(let i=0;i<d.n && n<N;i++){ const a=toXZ(d.pos0[i*2+1], d.pos0[i*2]), b=toXZ(d.pos1[i*2+1], d.pos1[i*2]);
    const m0=dbMinOf(tb+d.t0[i]), m1=dbMinOf(tb+d.t1[i]);
    pclWriteSeg(n++, a.x, TH(a.x,a.z), a.z, b.x, TH(b.x,b.z), b.z, m0, m1, d.attr[i*4], d.attr[i*4+1], d.attr[i*4+2], d.attr[i*4+3], d.dir[i], d.pid[i]&255); }
  if(!extra) PCL.baseCount=n; pclSetCount(n); PCL.stats.loaded=n; PCL.dbHeader=d.h; PCL.src='db';
  if(PCL.heat && window.twinDb){ const H=[]; for(let i=0;i<n;i+=4){ H.push(PCL.aP1[i*3], PCL.aP1[i*3+2], 0.5+PCL.aA[i*4]/255); } twinDb.heat=H; }
}
async function pclFetchDb(now){
  if(!(window.twinDb && twinDb.on && twinDb.health) || PCL.dbLoading) return;
  const t=timeState.min, lod=pclLod(); const bb=dbViewBBox(1.3);
  const win=PCL.dbWin; const need = !win || t<win.t0+3.5 || t>win.t1-1.5 || win.bb!==bb || win.lod!==lod || win.src!==twinDb.source;
  if(!need) return;
  const t0=t-4, t1=t+4; const maxp=Math.min(PCL.MAXSEG, PCL.lodTarget[lod]);
  PCL.dbLoading=true; const T0=performance.now();
  try{
    const url=`${dbBase()}/api/points?bbox=${bb}&timeFrom=${encodeURIComponent(dbIso(t0))}&timeTo=${encodeURIComponent(dbIso(t1))}&lod=${lod}&maxPoints=${maxp}&source=${twinDb.source}`;
    const r=await fetch(url, {cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+r.statusText);
    const d=pclParseBinary(await r.arrayBuffer()); pclApplyDb(d, false); PCL.dbWin={t0, t1, bb, lod, src:twinDb.source}; twinDb.stat.points={ms:Math.round(performance.now()-T0), bytes:d.h.count*30, n:d.n, total:d.h.total_segments};
    if(PCL.sel) pclFetchSel();
  }catch(e){ twinDb.err=e.message; PCL.dbWin={t0, t1, bb, lod, src:twinDb.source, err:true}; }
  finally{ PCL.dbLoading=false; }
}
/* 選択範囲だけ LOD3 で高解像度化（他は 30%） */
async function pclFetchSel(){
  const s=PCL.sel; if(!s || !(window.twinDb && twinDb.on && twinDb.health)) return;
  const a=toLL(s.x-s.r, s.z+s.r), b=toLL(s.x+s.r, s.z-s.r); const bb=[a.lon,a.lat,b.lon,b.lat].map(v=>v.toFixed(5)).join(',');
  try{ const w=PCL.dbWin||{t0:timeState.min-1, t1:timeState.min+4};
    const r=await fetch(`${dbBase()}/api/points?bbox=${bb}&timeFrom=${encodeURIComponent(dbIso(w.t0))}&timeTo=${encodeURIComponent(dbIso(w.t1))}&lod=3&maxPoints=200000&source=${twinDb.source}`, {cache:'no-store'});
    if(r.ok){ const d=pclParseBinary(await r.arrayBuffer()); pclApplyDb(d, true); } }catch(e){}
}
function pclSelect(x, z, r){
  PCL.sel = (x==null) ? null : {x, z, r:r||120};
  const on=PCL.sel?1:0; PCL.passes.forEach(p=>{ p.material.uniforms.uSelOn.value=on; if(PCL.sel) p.material.uniforms.uSel.value.set(PCL.sel.x, PCL.sel.z, PCL.sel.r); });
  PCL.lines.material.uniforms.uSelOn.value=on; if(PCL.sel) PCL.lines.material.uniforms.uSel.value.set(PCL.sel.x, PCL.sel.z, PCL.sel.r);
  if(!PCL.selGeo){ const g=new THREE.RingGeometry(0.97,1,64); g.rotateX(-Math.PI/2); PCL.selGeo=new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:0x76dfcb, transparent:true, opacity:0.7, depthWrite:false, side:THREE.DoubleSide})); PCL.group.add(PCL.selGeo); }
  PCL.selGeo.visible=!!PCL.sel; if(PCL.sel){ PCL.selGeo.position.set(x, TH(x,z)+1.5, z); PCL.selGeo.scale.set(PCL.sel.r, 1, PCL.sel.r); }
  if(PCL.sel && PCL.src==='db'){ pclFetchSel(); } else if(!PCL.sel && PCL.src==='db' && PCL.baseCount){ pclSetCount(PCL.baseCount); }
  if(typeof toast==='function') toast(PCL.sel ? `選択範囲（半径 ${PCL.sel.r}m）だけ高解像度化。範囲外は 30%。もう一度クリックで解除` : '選択を解除', 2600);
  renderPanel();
}
/* ---------- ピック（十分に近いときだけ 1 点単位の hover） ---------- */
const _pclV=new THREE.Vector3();
function pclHover(e){
  PCL.pick = PCL.on && ctrl.sph.radius < 400 && PCL.count>0; if(!PCL.pick) return false;
  const r=el.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top; const t=timeState.min; let best=-1, bd=100;
  const P0=PCL.aP0, P1=PCL.aP1, T=PCL.aT;
  for(let i=0;i<PCL.count;i++){ const t0=T[i*2], t1=T[i*2+1]; if(t<t0-0.6||t>t1+0.6) continue; const f=Math.max(0,Math.min(1,(t-t0)/Math.max(1e-3,t1-t0)));
    _pclV.set(P0[i*3]+(P1[i*3]-P0[i*3])*f, P0[i*3+1]+(P1[i*3+1]-P0[i*3+1])*f+1, P0[i*3+2]+(P1[i*3+2]-P0[i*3+2])*f).project(camera);
    const sx=(_pclV.x+1)/2*r.width, sy=(1-_pclV.y)/2*r.height; const d=(sx-mx)*(sx-mx)+(sy-my)*(sy-my); if(d<bd){ bd=d; best=i; } }
  if(best<0) return false;
  const A=PCL.aA; tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+10)+'px';
  tip.innerHTML=`<span class="t-nm">粒子 #${PCL.aB[best*4+2]+(PCL.aB[best*4+3]<<8)}</span><span style="color:var(--sub)">｜${PCL.src==='db'?'DB':'sim'}</span><br>速度 ${(A[best*4+2]/255*3).toFixed(2)} m/s・滞在 ${Math.round(A[best*4+1]/255*60)} 分・密度 ${(A[best*4]/255*40).toFixed(0)} 人/50m・信頼度 ${(A[best*4+3]/255*100).toFixed(0)}%`;
  return true;
}
/* ---------- 毎フレーム ---------- */
function pclUpdate(now, dt){
  if(!PCL.geo) pclInit();
  if(!PCL.on){ PCL.group.visible=false; return; } PCL.group.visible = level!=='wide' || PCL.src==='db';
  if(typeof flowHeads!=='undefined'){ flowHeads.visible=false; trailMesh.visible=false; agentMesh.visible=false; }
  pclCameraMoving(now); pclBudgetTick(now);
  if(window.twinDb && twinDb.on){ pclFetchDb(now); } else { pclFeedSim(now); }
  pclChooseK(now);
  const t=timeState.min, spd=timeState.playing ? timeState.speed : 0; const lags=PCL.lagsMs||[0];
  PCL.passes.forEach((p,i)=>{ if(!p.visible) return; p.material.uniforms.uNow.value=t; p.material.uniforms.uLag.value=(lags[i]||0)/1000*spd; p.material.uniforms.uDpr.value=Math.min(devicePixelRatio||1,2); });
  PCL.lines.material.uniforms.uNow.value=t;
  /* メッシュとの連続 LOD: 点群が近距離で主役になるにつれメッシュを薄く（cross fade） */
  if(typeof MESH!=='undefined' && MESH.inst){ const target = pclLod()>=3 ? 0.28 : (MESH.style==='2d'?0.86:0.78); const m=MESH.inst.material; m.opacity += (target-m.opacity)*Math.min(1, dt*6); if(MESH.fade){ MESH.fade.forEach(f=>{ f.inst.material.opacity -= dt*2.2; if(f.inst.material.opacity<=0){ MESH.group.remove(f.inst); f.inst.geometry.dispose(); f.inst.material.dispose(); } }); MESH.fade=MESH.fade.filter(f=>f.inst.material.opacity>0); } }
  if(typeof fineCloud!=='undefined' && fineCloud.userData.lidar!==undefined){ if(fineCloud.userData.lidar) fineCloud.visible = level!=='wide'; fineCloud.children.forEach(p=>{ if(p.isPoints){ if(fineCloud.userData.lidar){ if(!p.userData.pcOrig){ p.userData.pcOrig={size:p.material.size, opacity:p.material.opacity}; } p.material.size=1.1; p.material.opacity=0.95; } else if(p.userData.pcOrig){ p.material.size=p.userData.pcOrig.size; p.material.opacity=p.userData.pcOrig.opacity; p.userData.pcOrig=null; } } }); }
  if(PCL.debug) pclDebugTick(now);
}
/* GPU 時間（描画呼び出しの前後で呼ぶ） */
function pclGpuBegin(){ const g=PCL.gpu; if(!g.ext || g.pending) return; const gl=renderer.getContext(); g.q=gl.createQuery(); gl.beginQuery(g.ext.TIME_ELAPSED_EXT, g.q); g.pending=true; g.open=true; }
function pclGpuEnd(){ const g=PCL.gpu; if(!g.ext || !g.open) return; const gl=renderer.getContext(); gl.endQuery(g.ext.TIME_ELAPSED_EXT); g.open=false; }
function pclGpuPoll(){ const g=PCL.gpu; if(!g.ext || !g.pending || g.open) return; const gl=renderer.getContext(); const avail=gl.getQueryParameter(g.q, gl.QUERY_RESULT_AVAILABLE); const dis=gl.getParameter(g.ext.GPU_DISJOINT_EXT); if(avail && !dis){ g.ms=gl.getQueryParameter(g.q, gl.QUERY_RESULT)/1e6; } if(avail||dis){ gl.deleteQuery(g.q); g.q=null; g.pending=false; } }
/* ---------- Debug Panel（開発モード: ?debug=1 または ` キー） ---------- */
function pclDebug(on){ PCL.debug=on; let d=PCL.dbg; if(!d){ d=document.createElement('div'); d.id='pcl-debug'; document.body.appendChild(d); PCL.dbg=d; } d.style.display=on?'block':'none'; }
function pclDebugTick(now){
  if(now-(PCL.dbgT||0)<250) return; PCL.dbgT=now; pclGpuPoll(); const info=renderer.info; const mem=performance.memory ? (performance.memory.usedJSHeapSize/1048576).toFixed(0)+' MB heap' : '—';
  const K=Math.max(1,Math.round(PCL.kEff)); const rows=[['FPS', (typeof PERF!=='undefined'?PERF.fps:0).toFixed(0)], ['GPU time', PCL.gpu.ext ? PCL.gpu.ms.toFixed(2)+' ms' : 'n/a（timer query 無し）'], ['draw calls', info.render.calls], ['triangles', info.render.triangles], ['points', info.render.points],
    ['visible points', fmt(PCL.alive*K)+' (alive seg '+fmt(PCL.alive)+' × K '+K+')'], ['loaded segments', fmt(PCL.stats.loaded)+(PCL.dbHeader?` / total ${fmt(PCL.dbHeader.total_segments)}`:'')], ['memory', `${mem} · geom ${info.memory.geometries} · tex ${info.memory.textures}`],
    ['LOD', `LOD${PCL.lod}（半径 ${ctrl.sph.radius.toFixed(0)} m）`], ['budget', `${fmt(PCL.budget.cur)}${PCL.budget.auto?' auto':''}`], ['moving', PCL.moving?'yes（1/4）':'no'], ['mode', `${PCL.mode} · ${PCL.color} · z=${PCL.zmode} · src=${PCL.src}`], ['pick', PCL.pick?'on':'off (radius<400 で on)']];
  if(PCL.bench) rows.push(['bench', PCL.bench.rows.map(r=>`${fmt(r.points)}: ${r.fps.toFixed(1)} fps${r.gpu?` / ${r.gpu.toFixed(1)} ms`:''}`).join(' · ')+(PCL.bench.done?'':' …')]);
  PCL.dbg.innerHTML = '<b>POINT CLOUD DEBUG</b>' + rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}
/* ---------- ベンチマーク: 100k / 250k / 500k / 1M 点で FPS と GPU 時間を計測（?bench=1） ---------- */
async function pclBench(counts){
  counts = counts || [100000, 250000, 500000, 1000000]; pclInit(); if(!PCL.debug) pclDebug(true);
  const saved={on:PCL.on, auto:PCL.budget.auto, cur:PCL.budget.cur, mode:PCL.mode, src:PCL.src}; PCL.on=true; PCL.group.visible=true; PCL.budget.auto=false; PCL.bench={rows:[], done:false};
  PCL.benchLock=true;
  const rnd=mulberry32(7); const K=16; const t=timeState.min;
  for(const total of counts){
    const segs=Math.min(PCL.MAXSEG, Math.ceil(total/K)); let n=0;
    for(let i=0;i<segs;i++){ const x=(rnd()-0.5)*3600, z=(rnd()-0.5)*3200, ang=rnd()*6.283, L=2+rnd()*20; const x1=x+Math.cos(ang)*L, z1=z+Math.sin(ang)*L; const y=TH(x,z);
      pclWriteSeg(n++, x, y, z, x1, y, z1, t-2, t+2, (rnd()*255)|0, (rnd()*255)|0, (rnd()*255)|0, 255, (rnd()*255)|0, i&255); }
    pclSetCount(n); PCL.budget.cur=total; PCL.geo.setDrawRange(0,K); PCL.kEff=K; PCL.K=K;
    await new Promise(r=>setTimeout(r, 700));   // ウォームアップ
    const f0=(typeof PERF!=='undefined')?PERF.frames:0; const T0=performance.now(); let frames=0, gpuSum=0, gpuN=0; const row={points:n*K, fps:0, gpu:0};
    await new Promise(res=>{ const tick=()=>{ frames++; pclGpuPoll(); if(PCL.gpu.ms>0){ gpuSum+=PCL.gpu.ms; gpuN++; } if(performance.now()-T0<3500) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
    row.fps=frames/((performance.now()-T0)/1000); row.gpu=gpuN?gpuSum/gpuN:0; PCL.bench.rows.push(row); console.log('[pcl bench]', row);
  }
  PCL.bench.done=true; PCL.benchLock=false; PCL.budget.auto=saved.auto; PCL.budget.cur=saved.cur; PCL.on=saved.on; PCL.dbWin=null; PCL.ring=new WeakMap(); pclSetCount(0);
  window.twinBench=PCL.bench; return PCL.bench;
}
/* ---------- LAS 読込（非圧縮 LAS 1.2〜1.4、point format 0〜8。LAZ は laz-perf 等のデコーダが必要） ---------- */
function pclLoadLAS(buf, opts){
  const dv=new DataView(buf); if(String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='LASF') throw new Error('LAS signature not found');
  const vMaj=dv.getUint8(24), vMin=dv.getUint8(25); const off=dv.getUint32(96,true); const fmt=dv.getUint8(104)&0x3f; const rec=dv.getUint16(105,true);
  let n=dv.getUint32(107,true); if(vMaj===1 && vMin>=4 && n===0){ n=Number(dv.getBigUint64(247,true)); }
  const sx=dv.getFloat64(131,true), sy=dv.getFloat64(139,true), sz=dv.getFloat64(147,true), ox=dv.getFloat64(155,true), oy=dv.getFloat64(163,true), oz=dv.getFloat64(171,true);
  const maxN=(opts&&opts.max)||2000000; const step=Math.max(1, Math.ceil(n/maxN)); const cnt=Math.floor(n/step);
  const pos=new Float32Array(cnt*3), col=new Float32Array(cnt*3); let minI=1e9, maxI=0, minZ=1e9, maxZ=-1e9; const raw=[];
  for(let i=0;i<cnt;i++){ const o=off+i*step*rec; if(o+12>buf.byteLength) break; const X=dv.getInt32(o,true)*sx+ox, Y=dv.getInt32(o+4,true)*sy+oy, Z=dv.getInt32(o+8,true)*sz+oz; const I=dv.getUint16(o+12,true); raw.push(X,Y,Z,I); if(I<minI) minI=I; if(I>maxI) maxI=I; if(Z<minZ) minZ=Z; if(Z>maxZ) maxZ=Z; }
  const m=raw.length/4; const geo=(Math.abs(raw[0])<400 && Math.abs(raw[1])<90);   // 経緯度か（メートル系なら原点を指定 or 重心を城に合わせる）
  let cx=0, cy=0; if(!geo){ const org=(window.TWIN_CONFIG&&TWIN_CONFIG.las&&TWIN_CONFIG.las.originXY)||null; if(org){ cx=org[0]; cy=org[1]; } else { for(let i=0;i<m;i++){ cx+=raw[i*4]; cy+=raw[i*4+1]; } cx/=m; cy/=m; } }
  const c0=new THREE.Color(0x365c70), c1=new THREE.Color(0xc9f2ff); const tmp=new THREE.Color();
  for(let i=0;i<m;i++){ const X=raw[i*4], Y=raw[i*4+1], Z=raw[i*4+2], I=raw[i*4+3]; let x,z; if(geo){ const p=toXZ(Y,X); x=p.x; z=p.z; } else { x=X-cx+(geo?0:CASTLE.x); z=-(Y-cy)+(geo?0:CASTLE.z); }
    pos[i*3]=x; pos[i*3+1]=(Z-minZ)+TH(x,z); pos[i*3+2]=z; const k=maxI>minI ? (I-minI)/(maxI-minI) : (Z-minZ)/Math.max(1,maxZ-minZ); tmp.copy(c0).lerp(c1, Math.pow(k,0.6)); col[i*3]=tmp.r; col[i*3+1]=tmp.g; col[i*3+2]=tmp.b; }
  if(PCL.lasGroup){ PCL.group.remove(PCL.lasGroup); PCL.lasGroup.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0,m*3),3)); g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0,m*3),3));
  const pts=new THREE.Points(g, new THREE.PointsMaterial({size:1.3, sizeAttenuation:true, vertexColors:true, transparent:true, opacity:0.92, depthWrite:true}));
  PCL.lasGroup=new THREE.Group(); PCL.lasGroup.add(pts); PCL.group.add(PCL.lasGroup); PCL.lasN=m; PCL.lasInfo={version:`${vMaj}.${vMin}`, format:fmt, points:n, shown:m, geo, minZ, maxZ};
  setPclMode('LIDAR'); if(typeof toast==='function') toast(`LAS ${vMaj}.${vMin} format ${fmt}: ${fmt(n)} 点のうち ${fmt(m)} 点を表示（${geo?'経緯度':'メートル座標・'+(TWIN_CONFIG.las&&TWIN_CONFIG.las.originXY?'origin 指定':'重心を姫路城に合わせた')}）`, 5000);
  return PCL.lasInfo;
}
/* ---------- パネル ---------- */
function pclSec(){
  const chip=(k,v,l,attr)=>`<button class="chip ${String(PCL[k])===String(v)?'active':''}" data-pcl-${attr||k}="${v}">${l}</button>`;
  const K=Math.max(1,Math.round(PCL.kEff));
  const alive=PCL.alive||PCL.count;
  return `<div class="sec"><div class="sec-t"><b>◦ Point Cloud</b> — 人流粒子（${PCL.src==='db'?'DB /api/points':'シミュレーション'}）</div>
    <div class="row-btns" style="margin-bottom:6px"><button class="chip ${PCL.on?'active':''}" data-pcl-on="1">${PCL.on?'ON':'OFF'}</button>${PCL.MODES.map(([k,l])=>chip('mode',k,l)).join('')}</div>
    <div class="row-btns" style="margin-bottom:6px"><span class="hint" style="align-self:center">色</span>${chip('color','density','Density')}${chip('color','speed','Speed')}${chip('color','stay','Stay')}${chip('color','direction','Direction')}</div>
    <div class="row-btns" style="margin-bottom:6px"><span class="hint" style="align-self:center">Z</span>${chip('zmode','ground','地表 +0.5〜1.5m')}${chip('zmode','density','Z＝密度')}${chip('zmode','stay','Z＝滞在時間')}</div>
    <div class="studio-label" style="margin:4px 0">Point Budget <output id="pcl-b-v">${fmt(PCL.budget.cur)}${PCL.budget.auto?'（auto）':''}</output></div><input id="pcl-b" type="range" min="200000" max="1000000" step="50000" value="${PCL.budget.cur}" style="width:100%">
    <div class="row-btns" style="margin:6px 0"><button class="chip ${PCL.budget.auto?'active':''}" data-pcl-auto="1">Adaptive（FPS で自動）</button><button class="chip ${PCL.debug?'active':''}" data-pcl-debug="1">Debug Panel</button><button class="chip" data-pcl-bench="1">Bench 100k→1M</button><label class="chip" style="cursor:pointer">LAS 読込<input id="pcl-las" type="file" accept=".las" style="display:none"></label>${PCL.sel?`<button class="chip active" data-pcl-clearsel="1">選択解除</button>`:''}</div>
    <div class="hint">表示 ${fmt(alive*K)} 粒（生きている線分 ${fmt(alive)} × K ${K}、読込 ${fmt(PCL.count)} 線分）· LOD${PCL.lod} · ${PCL.moving?'移動中（1/4）':'静止'}${PCL.lasN?` · LAS ${fmt(PCL.lasN)} 点`:''}<br>粒は道路・軌跡（連続 2 サンプルの線分）に沿って固定 seed で分布。時刻は GPU で線形補間、FLOW/TRAIL は 100/300/500ms 前を 70/40/10% で残す。地図をクリックで半径 120m を高解像度化（他 30%）。半径 400m 以下で 1 粒ホバー。</div></div>`;
}
function bindPcl(){
  document.querySelectorAll('[data-pcl-on]').forEach(b=> b.onclick=()=> setPclOn(!PCL.on));
  document.querySelectorAll('[data-pcl-mode]').forEach(b=> b.onclick=()=> setPclMode(b.dataset.pclMode));
  document.querySelectorAll('[data-pcl-color]').forEach(b=> b.onclick=()=> setPclColor(b.dataset.pclColor));
  document.querySelectorAll('[data-pcl-zmode]').forEach(b=> b.onclick=()=> setPclZ(b.dataset.pclZmode));
  document.querySelectorAll('[data-pcl-auto]').forEach(b=> b.onclick=()=>{ PCL.budget.auto=!PCL.budget.auto; renderPanel(); });
  document.querySelectorAll('[data-pcl-debug]').forEach(b=> b.onclick=()=>{ pclDebug(!PCL.debug); renderPanel(); });
  document.querySelectorAll('[data-pcl-bench]').forEach(b=> b.onclick=()=>{ pclBench(); });
  document.querySelectorAll('[data-pcl-clearsel]').forEach(b=> b.onclick=()=> pclSelect(null));
  const r=document.getElementById('pcl-b'); if(r) r.oninput=e=>{ PCL.budget.cur=+e.target.value; PCL.budget.auto=false; document.getElementById('pcl-b-v').value=fmt(PCL.budget.cur); };
  const f=document.getElementById('pcl-las'); if(f) f.onchange=e=>{ const file=e.target.files[0]; if(!file) return; file.arrayBuffer().then(b=>{ try{ pclLoadLAS(b); }catch(x){ toast('LAS 読込エラー: '+x.message, 4000); } renderPanel(); }); };
}
addEventListener('keydown', e=>{ if(e.key==='`' && !e.target.closest('input,textarea,select')){ pclDebug(!PCL.debug); } if(e.key==='Escape' && PCL.sel) pclSelect(null); });
if(/[?&]debug=1/.test(location.search)) pclDebug(true);
if(/[?&]bench=1/.test(location.search)) setTimeout(()=>pclBench(), 9000);
window.twinPcl = PCL; PCL.hover = pclHover; PCL.bench_run = pclBench; PCL.select = pclSelect; PCL.setMode = setPclMode; PCL.loadLAS = pclLoadLAS;
