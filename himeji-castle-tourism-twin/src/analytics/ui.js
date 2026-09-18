/* ================= OD分析 — 広域アーク（どこから来たか）＋ ガウスKDE（どこに滞留したか） ================= */
let odMode = false;
const odGroup = new THREE.Group(); odGroup.visible=false; scene.add(odGroup);
const wideGroup = new THREE.Group(); scene.add(wideGroup);   // L0 常時: 出発地ノード＋アーク

const arcUnis=[];
function buildArc(a, b, colv, share, group, lift=0.16){
  const mid=new THREE.Vector3((a.x+b.x)/2, 0, (a.z+b.z)/2);
  const d=Math.hypot(a.x-b.x, a.z-b.z);
  mid.y = 45 + d*lift;
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x,6,a.z), mid, new THREE.Vector3(b.x,6,b.z));
  const geo=new THREE.TubeGeometry(curve, 64, Math.max(4, 3+share*70)*(d>6000?2.2:1), 6, false);
  const uni={uCol:{value:new THREE.Color(colv)}, uTime:{value:Math.random()*4}, uAct:{value:0}};
  const mat=new THREE.ShaderMaterial({
    uniforms:uni, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:[
      'varying vec2 vUv; uniform vec3 uCol; uniform float uTime,uAct;',
      'void main(){',
      '  float band=pow(0.5+0.5*sin((vUv.x*3.0-uTime)*6.28318),3.0);',
      '  float head=smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x);',
      '  float a=uAct*(0.10+0.55*band)*head;',
      '  gl_FragColor=vec4(uCol*(0.55+0.75*band), a);',
      '}'].join('\n')
  });
  const m = new THREE.Mesh(geo, mat); group.add(m);
  arcUnis.push(uni);
  return {uni, mesh:m};
}
/* 市内アーク（ODモード）: ゲート → 大手門 → 回遊先 */
const cityArcG = new THREE.Group(); odGroup.add(cityArcG);
const CITY_ARCS = [];
Object.entries(GATES).forEach(([k,g])=>{
  const sh = SEG_KEYS.reduce((s,seg)=> s + GATE_SHARE[seg][k]*SCN[curScn].mix[seg], 0);
  CITY_ARCS.push({...buildArc(g, GATE_OTEMON, g.col, sh, cityArcG, 0.22), dir:'arr'});
});
SPOTS.forEach(s=>{
  const p=P(s.n); const sh = SEG_KEYS.reduce((a,seg)=> a + s.p[seg]*SCN[curScn].mix[seg], 0);
  CITY_ARCS.push({...buildArc(GATE_OTEMON, p, 0xffd166, sh*0.5, cityArcG, 0.22), dir:'tour'});
});
/* ---- 動線リボン: モード別の線種（鉄道=中心線＋枕木 / 高速=二重線 / 航路・空港=破線）＋ 流れの帯（方向・量） ---- */
function ribbonGeom(pts, w, hf){
  const pos=[], uv=[], idx=[]; let total=0; const seg=[0];
  for(let i=1;i<pts.length;i++){ total+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z); seg.push(total); }
  for(let i=0;i<pts.length;i++){
    const p0=pts[Math.max(0,i-1)], p1=pts[Math.min(pts.length-1,i+1)];
    const dx=p1.x-p0.x, dz=p1.z-p0.z, L=Math.hypot(dx,dz)||1, nx=-dz/L, nz=dx/L;
    const ya = hf ? hf(pts[i].x+nx*w/2, pts[i].z+nz*w/2) : 0, yb = hf ? hf(pts[i].x-nx*w/2, pts[i].z-nz*w/2) : 0;
    pos.push(pts[i].x+nx*w/2, ya, pts[i].z+nz*w/2, pts[i].x-nx*w/2, yb, pts[i].z-nz*w/2);
    const u=seg[i]/total; uv.push(u,0,u,1);
    if(i<pts.length-1){ const k=i*2; idx.push(k,k+2,k+1, k+1,k+2,k+3); }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  return {geo:g, total};
}
const RIBBON_VS = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const RIBBON_FS = [
 'varying vec2 vUv; uniform vec3 uCol, uFlowCol; uniform float uTime, uAct, uKind, uDir, uLen, uFlowW, uDim;',
 'void main(){',
 '  float y = abs(vUv.y-0.5)*2.0; float d = vUv.x*uLen; float base = 0.0;',
 '  if(uKind < 0.5){ base = smoothstep(0.30,0.18,y); float tie = step(0.55, fract(d/320.0)); base = max(base, (1.0-smoothstep(0.62,0.80,y))*tie*0.45); }',
 '  else if(uKind < 1.5){ base = smoothstep(0.92,0.80,y) - smoothstep(0.50,0.36,y); float dash = step(0.5, fract(d/420.0)); base = max(base*0.9, smoothstep(0.10,0.0,y)*dash*0.7); }',
 '  else if(uKind < 2.5){ float dash = step(0.42, fract(d/360.0)); base = smoothstep(0.28,0.16,y)*dash; }',
 '  else { base = smoothstep(0.34,0.10,y)*0.55; }',
 '  float band = pow(0.5+0.5*sin((d/1100.0 - uTime*uDir)*6.28318), 3.0);',
 '  float fw = smoothstep(uFlowW, uFlowW*0.45, y);',
 '  vec3 col = uCol*base*uDim*1.15 + uFlowCol*band*fw*uAct*1.5;',
 '  float a = base*0.62*uDim + band*fw*uAct*0.9;',
 '  if(a < 0.02) discard; gl_FragColor = vec4(col, a); }'].join('\n');
function buildRibbon(pts, style, group, y, hf){
  const {geo,total} = ribbonGeom(pts, style.w, hf || ((x,z)=>TH(x,z)));
  const uni = {uCol:{value:new THREE.Color(style.col)}, uFlowCol:{value:new THREE.Color(0xffffff)}, uTime:{value:Math.random()*4},
    uAct:{value:0}, uKind:{value:style.kind}, uDir:{value:1}, uLen:{value:total}, uFlowW:{value:0.3}, uDim:{value:1}};
  const mat = new THREE.ShaderMaterial({uniforms:uni, vertexShader:RIBBON_VS, fragmentShader:RIBBON_FS, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending});
  const m = new THREE.Mesh(geo, mat); m.position.y = y; m.renderOrder = 2; group.add(m);
  return {uni, mesh:m, total};
}
/* コリドー（路線・高速道路）ごとに: ゲート → 経由都市 → 終点 のリボン、経由地マーカー・ラベル */
const corrGroup = new THREE.Group(); wideGroup.add(corrGroup);
CORRIDORS.forEach((c, ci)=>{
  const st = MODE_STYLE[c.mode];
  const raw = [{x:c.gx, z:c.gz}].concat(c.pts.map(p=>({x:p.x, z:p.z})));
  const pts = []; for(let i=0;i<raw.length-1;i++){ const a=raw[i], b=raw[i+1]; const n=Math.max(1, Math.round(Math.hypot(b.x-a.x,b.z-a.z)/250)); for(let k=0;k<n;k++) pts.push({x:a.x+(b.x-a.x)*k/n, z:a.z+(b.z-a.z)*k/n}); } pts.push(raw[raw.length-1]);
  const rib = buildRibbon(pts, st, corrGroup, 3 + (ci%5)*0.4);
  c.rib = rib;
  c.pts.forEach((p, i)=>{
    const last = i===c.pts.length-1;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(last?300:200, last?300:200, 24, 14),
      new THREE.MeshStandardMaterial({color:st.col, emissive:st.col, emissiveIntensity:0.35, roughness:0.6}));
    disc.position.set(p.x, TY(p.x, p.z, 8), p.z);
    disc.userData = {name:`${p.n}（${c.name}）`, desc:`姫路から ${p.t}`};
    corrGroup.add(disc);
    const lb = makeLabel(p.n, last?640:460, st.css, 700); lb.position.set(p.x, last?900:640, p.z); corrGroup.add(lb);
    const lb2 = makeLabel(p.t, 320, '#c8cede', 500); lb2.position.set(p.x, last?500:340, p.z); corrGroup.add(lb2);
  });
  const mid = c.pts[Math.floor(c.pts.length/2)];
  const nl = makeLabel(c.name, 380, st.css, 500);
  const a = c.bear*Math.PI/180; const off = 1100;
  nl.position.set(mid.x + Math.cos(a)*off, 60, mid.z + Math.sin(a)*off);
  corrGroup.add(nl);
});
/* 出発地ポール（コリドーの経由地に乗せる。高さ＝流入シェア×セグメント構成） */
ORIGINS.forEach((o, i)=>{
  const col = SEG[o.seg].col;
  const same = ORIGINS.filter(q=> q.corr===o.corr && q.at===o.at);
  const k = same.indexOf(o), a = CORR_BY_ID[o.corr].bear*Math.PI/180;
  const off = (k - (same.length-1)/2) * 700;
  const px = o.x + Math.cos(a)*off, pz = o.z + Math.sin(a)*off;
  o.px = px; o.pz = pz;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(150, 190, 100, 8),
    new THREE.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:0.4, roughness:0.6, transparent:true}));
  pole.position.set(px, TY(px,pz,50), pz); o.py = TH(px,pz);
  pole.userData = {name:o.name, origin:true, desc:`${SEG[o.seg].name} ｜ ${o.via} ｜ 到着: ${GATES[o.gate].name}`};
  o.pole = pole; wideGroup.add(pole);
  const lb = makeLabel('', 300, hx6(col), 700); lb.position.set(px, 120, pz); o.lb = lb; wideGroup.add(lb);
});
function corrShares(){
  const mix = SCN[curScn].mix, out = {};
  CORRIDORS.forEach(c=> out[c.id] = {arr:0, dep:0, segs:{in:0,dom:0,loc:0}});
  ORIGINS.forEach(o=>{ if(!segByFilter(o.seg)) return; const w = o.share*(segFilter==='all'?mix[o.seg]:1); out[o.corr].arr += w; out[o.corr].segs[o.seg] += w; });
  SEG_KEYS.forEach(seg=>{ if(!segByFilter(seg)) return; DEST[seg].forEach(d=>{ const o=ORIGIN_BY_ID[d[0]]; if(!o) return; out[o.corr].dep += d[2]*(segFilter==='all'?mix[seg]:1); }); });
  return out;
}
const _WHITE = new THREE.Color(0xffffff);
function updateArcs(dt){
  const t = timeState.min;
  const aw = 0.25 + sstep(30,120,t)*(1-sstep(420,560,t));
  const dw = sstep(500,600,t)*(1-sstep(880,1000,t));
  const tw = sstep(240,360,t)*(1-sstep(640,760,t));
  if(level==='wide'){
    const sh = corrShares(), mix = SCN[curScn].mix;
    CORRIDORS.forEach(c=>{
      const s = sh[c.id]; const u = c.rib.uni;
      const vol = Math.max(s.arr*aw, s.dep*dw);
      u.uAct.value = Math.min(1.2, 0.2 + vol*4.5);
      u.uFlowW.value = 0.18 + Math.min(0.75, vol*2.2);
      u.uDir.value = (s.dep*dw > s.arr*aw) ? -1 : 1;
      u.uDim.value = (s.arr+s.dep) > 0.002 ? 1 : 0.35;
      const top = SEG_KEYS.reduce((m,k)=> s.segs[k]>s.segs[m]?k:m, 'dom');
      u.uFlowCol.value.setHex(segFilter==='all' ? SEG[top].col : SEG[segFilter].col).lerp(_WHITE, segFilter==='all'?0.35:0.15);
    });
    ORIGINS.forEach(o=>{
      const on = segByFilter(o.seg); const w = o.share*(segFilter==='all'?mix[o.seg]:1);
      const h = 60 + w*9000;
      o.pole.scale.y = h/100; o.pole.position.y = o.py + h/2; o.pole.material.opacity = on?1:0.2;
      o.lb.position.y = o.py + h + 240; o.lb.material.opacity = on?1:0.25;
      const txt = `${o.name} ${(w*100).toFixed(0)}%`;
      if(o.lb.userData.txt !== txt){ o.lb.userData.txt = txt; const nl = makeLabel(txt, 300, hx6(SEG[o.seg].col), 700); o.lb.material.map.dispose(); o.lb.material.map = nl.material.map; o.lb.material.needsUpdate = true; }
    });
  }
  CITY_ARCS.forEach(a=> a.uni.uAct.value = odMode ? (a.dir==='arr' ? aw : tw) : 0);
  arcUnis.forEach(u=> u.uTime.value += dt*0.55);
  CORRIDORS.forEach(c=> c.rib.uni.uTime.value += dt*0.35);
}
/* --- ガウスKDEサーフェス（市内滞留密度） --- */
const KDE={bw:1.0, maxH:220, lastT:-99};
const kdeGeo=new THREE.PlaneGeometry(7600, 6400, 95, 80);
kdeGeo.rotateX(-Math.PI/2);
kdeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(kdeGeo.attributes.position.count*3),3));
const kdeMesh=new THREE.Mesh(kdeGeo, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.6, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
kdeMesh.position.set(-300, 2.4, -400);
odGroup.add(kdeMesh);
function kdeSources(t){
  const s=[];
  const arr = 0.15 + sstep(30,120,t)*(1-sstep(420,560,t));
  const dep = sstep(520,620,t)*(1-sstep(880,1000,t));
  Object.entries(GATES).forEach(([k,g])=>{ const sh=SEG_KEYS.reduce((a,seg)=> a + (segByFilter(seg)?GATE_SHARE[seg][k]*SCN[curScn].mix[seg]:0), 0); s.push([g.x, g.z, sh*(arr*0.6+dep*0.7), 230]); });
  const inC = Math.max(0.05, STATS.inCastle/Math.max(60, agents.length));
  s.push([CASTLE.x, CASTLE.z+140, 0.9*inC + 0.3*sstep(150,330,t)*(1-sstep(560,720,t)), 300]);
  SPOTS.forEach(sp=>{ const p=P(sp.n); const now=(STATS.atSpot[sp.n]||0)/Math.max(30, agents.length); s.push([p.x, p.z, 0.15*sstep(240,420,t)*(1-sstep(620,760,t))*SEG_KEYS.reduce((a,seg)=>a+(segByFilter(seg)?sp.p[seg]:0),0) + now*1.5, sp.n==='書写山圓教寺'?260:170]); });
  const night = sstep(720,840,t)*SCN[curScn].stay*5;
  s.push([STN.x+80, STN.z-120, night, 300]);
  return s;
}
function updateKDE(force){
  if(!odMode || level==='castle') return;
  const t=timeState.min;
  if(!force && Math.abs(t-KDE.lastT)<2) return;
  KDE.lastT=t;
  const srcs=kdeSources(t).filter(v=>v[2]>0.004);
  const pos=kdeGeo.attributes.position, col=kdeGeo.attributes.color;
  const ox=kdeMesh.position.x, oz=kdeMesh.position.z;
  const n=pos.count, H=new Float32Array(n);
  let mx=0.0001;
  for(let i=0;i<n;i++){
    const wx=pos.getX(i)+ox, wz=pos.getZ(i)+oz;
    let h=0;
    for(let k=0;k<srcs.length;k++){
      const sg=srcs[k][3]*KDE.bw;
      const dx=wx-srcs[k][0], dz=wz-srcs[k][1], d2=dx*dx+dz*dz;
      if(d2 < sg*sg*9) h += srcs[k][2]*Math.exp(-d2/(2*sg*sg));
    }
    H[i]=h; if(h>mx) mx=h;
  }
  const c=new THREE.Color();
  for(let i=0;i<n;i++){
    const k=H[i]/mx;
    pos.setY(i, TH(pos.getX(i)+ox, pos.getZ(i)+oz) + k*KDE.maxH);
    c.copy(heatC(Math.min(1, k*1.1))).multiplyScalar(Math.min(1, 0.08+k*1.4));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  pos.needsUpdate=true; col.needsUpdate=true;
}

/* ================= 観光導線（姫路駅ハブ発・周辺観光地） ================= */
let tourMode=false;
const tourGroup=new THREE.Group(); tourGroup.visible=false; scene.add(tourGroup);
const TOURS=[
 {name:'書写山圓教寺（ロープウェイ）', via:'神姫バス 約30分 + ロープウェイ4分', time:'約35分', spots:'摩尼殿・三つの堂（ラストサムライ ロケ地）', col:0xffd166, to:()=>P('書写山圓教寺')},
 {name:'太陽公園・広峯神社方面',      via:'神姫バス 約30分',                time:'約30分', spots:'石のエリア・白鳥城 / 播磨国総社', col:0xb56ce8, to:()=>P('廣峯神社')},
 {name:'手柄山中央公園・水族館',      via:'山陽電鉄 手柄駅 徒歩',           time:'約15分', spots:'姫路市立水族館・平和資料館・回転展望台', col:0x3ddc84, to:()=>P('手柄山中央公園')},
 {name:'姫路港 → 家島諸島・小豆島',   via:'神姫バス 約25分 + 高速船',        time:'約60分', spots:'坊勢島・家島 海の幸 / 小豆島 周遊', col:0x35d0c0, to:()=>PORT},
 {name:'灘のけんか祭り（松原八幡神社）',via:'山陽電鉄 白浜の宮駅 徒歩',       time:'約20分', spots:'10月14・15日 屋台練り / 白浜海岸', col:0xff6b5e, to:()=>P('松原八幡神社')},
 {name:'姫路セントラルパーク',        via:'神姫バス 約30分（地図外・北東）', time:'約30分', spots:'サファリ・遊園地（ファミリー層）', col:0x8fd0ff, to:()=>({x:6200, z:-4200})},
];
const chevrons=[];
TOURS.forEach(t=>{
  const e = t.to(); t.end = e;
  const r = route({x:STN.x, z:STN.z}, e);
  t.path = r.path; t.wp = r.path; t.seg = r.seg; t.total = r.total;
  const v3 = t.wp.map(p=>new THREE.Vector3(p[0], 2.6, p[1]));
  /* 導線リボン（バス/鉄道の帯・流れ付き） */
  t.rib = buildRibbon(t.wp.map(p=>({x:p[0], z:p[1]})), {col:t.col, w:46, kind:0}, tourGroup, 2.0);
  t.rib.uni.uAct.value = 0.7; t.rib.uni.uFlowW.value = 0.5; t.rib.uni.uFlowCol.value.setHex(t.col).lerp(new THREE.Color(0xffffff), 0.5);
  const glow = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v3), new THREE.LineBasicMaterial({color:t.col, transparent:true, opacity:0.9}));
  tourGroup.add(glow);
  const cgeo=new THREE.ConeGeometry(7, 20, 5);
  const cmat=new THREE.MeshBasicMaterial({color:t.col, transparent:true, opacity:0.9});
  const nCh=Math.max(4, Math.round(t.total/380));
  for(let i=0;i<nCh;i++){ const m=new THREE.Mesh(cgeo, cmat); tourGroup.add(m); chevrons.push({t, m, u:i/nCh}); }
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(6,6,34,6), new THREE.MeshStandardMaterial({color:t.col, emissive:t.col, emissiveIntensity:0.35, roughness:0.6}));
  const ey = TH(e.x, e.z);
  pole.position.set(e.x, ey+17, e.z); pole.userData.name = t.name+'（'+t.via+'）';
  tourGroup.add(pole);
  const lb=makeLabel(t.name+'  '+t.time, 13, hx6(t.col)); lb.position.set(e.x, ey+74, e.z); tourGroup.add(lb);
  const lb2=makeLabel(t.spots, 9, '#c8cede', 500); lb2.position.set(e.x, ey+56, e.z); tourGroup.add(lb2);
});
const hub=new THREE.Mesh(new THREE.CylinderGeometry(18,18,3,24), new THREE.MeshBasicMaterial({color:0xff8a1e, transparent:true, opacity:0.55}));
hub.position.set(STN.x, TY(STN.x, STN.z, 1.5), STN.z); tourGroup.add(hub);
const hubLb=makeLabel('観光ハブ: JR姫路駅・バスターミナル', 11, '#ff8a1e'); hubLb.position.set(STN.x, TY(STN.x, STN.z, 60), STN.z+70); tourGroup.add(hubLb);
const UP=new THREE.Vector3(0,1,0);
function updateChevrons(dt){
  if(!tourGroup.visible) return;
  TOURS.forEach(t=>{ if(t.rib) t.rib.uni.uTime.value += dt*0.6; });
  chevrons.forEach(c=>{
    c.u += dt*46/c.t.total; if(c.u>=1) c.u-=1;
    const d=c.u*c.t.total;
    const s=sampleRoute(c.t, d), s2=sampleRoute(c.t, Math.min(c.t.total, d+8));
    c.m.position.set(s[0], TY(s[0], s[1], 6), s[1]);
    const dir=new THREE.Vector3(s2[0]-s[0],0,s2[1]-s[1]); if(dir.lengthSq()>0){ dir.normalize(); c.m.quaternion.setFromUnitVectors(UP, dir); }
  });
}

/* ================= ◆ 点群ビュー（建物・道路をポイント化したデジタルレイヤー） ================= */
let pcMode=false, pcBuilt=false;
const pcGroup = new THREE.Group(); pcGroup.visible=false; scene.add(pcGroup);
function buildPC(){
  pcBuilt = true;
  if(REAL && REAL.pc){
    /* 兵庫県 DSM（1m計測 → 3m間引き）の実測点群。色: 地表 / 建物 / 樹木 / 水域、明度 = 地物高さ */
    const g = REAL.pc, H = decI16(g.h), ND = decI16(g.nd), C = decU8(g.c);
    const pos = new Float32Array(g.valid*3), col = new Float32Array(g.valid*3);
    const cG=new THREE.Color(0x2a3f66), cB=new THREE.Color(0x7de8ff), cV=new THREE.Color(0x3fc27a), cW=new THREE.Color(0x2f6fd0), cBh=new THREE.Color(0xffffff);
    const c = new THREE.Color(); let k=0;
    for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){
      const idx=j*g.nx+i, hv=H[idx]; if(hv <= -9000) continue;
      const x=g.x0+i*g.step, y=g.y0+j*g.step, h=hv*0.1, nd=ND[idx]*0.1, cl=C[idx];
      pos[k*3]=x; pos[k*3+1]=h+0.3; pos[k*3+2]=-y;
      if(cl===3) c.copy(cW); else if(cl===1) c.copy(cB).lerp(cBh, Math.min(0.6, nd/60)); else if(cl===2) c.copy(cV).multiplyScalar(0.6+Math.min(0.5, nd/25)); else c.copy(cG);
      col[k*3]=c.r; col[k*3+1]=c.g; col[k*3+2]=c.b; k++;
      if(k>=g.valid) break;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0,k*3),3));
    geo.setAttribute('color', new THREE.BufferAttribute(col.subarray(0,k*3),3));
    pcGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({size:1.6, vertexColors:true, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false})));
    /* 点群範囲外は従来の建物輪郭点で補完 */
  }
  const pts=[], cols=[];
  const cw=new THREE.Color(0x66e0ff), cc=new THREE.Color(0xffd166), cr=new THREE.Color(0x3d8fd0);
  const inPC = (b)=>{ if(!(REAL&&REAL.pc)) return false; const g=REAL.pc; const q=b.p[0]; return q[0]>=g.x0 && q[0]<=g.x0+g.nx*g.step && q[1]>=g.y0 && q[1]<=g.y0+g.ny*g.step; };
  SCENE_DATA.buildings.forEach(b=>{
    const h=b.h||8, col = b.k==='castle' ? cc : cw;
    if(inPC(b)) return;
    if(b.k!=='castle' && pts.length > 1500000) return;
    const step = b.k==='castle' ? 2.2 : 4.5;
    for(let i=0;i<b.p.length-1;i++){
      const a=b.p[i], q=b.p[i+1]; const L=Math.hypot(q[0]-a[0], q[1]-a[1]); const n=Math.max(1, Math.round(L/step));
      for(let j=0;j<=n;j++){ const x=a[0]+(q[0]-a[0])*j/n, y=a[1]+(q[1]-a[1])*j/n;
        const bz=TH(x,-y); for(let z=0;z<=h;z+=step){ pts.push(x, bz+z, -y); cols.push(col.r, col.g, col.b); } }
    }
  });
  SCENE_DATA.roads.forEach(r=>{
    if(r.c>2) return;
    for(let i=0;i<r.p.length-1;i++){ const a=r.p[i], q=r.p[i+1]; const L=Math.hypot(q[0]-a[0], q[1]-a[1]); const n=Math.max(1, Math.round(L/9));
      for(let j=0;j<n;j++){ const px=a[0]+(q[0]-a[0])*j/n, py=a[1]+(q[1]-a[1])*j/n; pts.push(px, TY(px,-py,0.8), -py); cols.push(cr.r, cr.g, cr.b); } }
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols),3));
  pcGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({size:1.25, vertexColors:true, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false})));
}
function applyPCVisibility(){
  groundGroup.visible = !pcMode;
  LG.bldg.visible = !pcMode; LG.lu.visible = !pcMode && LAYER_STATE.lu;
  pcGroup.visible = pcMode;
  if(pcMode){ scene.background=null; wrap.classList.add('pc-grad'); scene.fog.color.setHex(0x0a2a44);
    dotMat.color.setHex(0x66e0ff); dotMat.size=2.8; dotMat.opacity=0.9; dotMat.blending=THREE.AdditiveBlending; }
  else { scene.background=new THREE.Color(BG_HEX); wrap.classList.remove('pc-grad'); scene.fog.color.setHex(BG_HEX);
    dotMat.color.setHex(0x556080); dotMat.size=2.6; dotMat.opacity=0.5; dotMat.blending=THREE.NormalBlending; }
  dotMat.needsUpdate=true;
}
function setPCMode(on){
  pcMode=on; if(on && !pcBuilt) buildPC();
  document.getElementById('pc-toggle').classList.toggle('active', on);
  applyPCVisibility();
  toast(on ? (REAL&&REAL.pc ? '点群ビュー: 既存DSMの点群＋建物形状による表示補完（追加点は実測ではありません）' : '点群ビュー: ON（建物・道路をデジタルレイヤー表示）') : '通常ビューに戻しました', 3600);
}

/* ================= レベル管理 ================= */
let level = 'wide';
const enterHint = document.getElementById('enter-hint');
function setLevel(lv, fly=true){
  level = lv;
  document.querySelectorAll('.crumb[data-lvl]').forEach(c=>c.classList.toggle('active', c.dataset.lvl===lv));
  zoneGroup.visible = (lv==='castle');
  routeGroup.visible = (lv!=='wide'); trailMesh.visible = (lv!=='wide');
  castleLabel.visible = (lv!=='castle');
  wideGroup.visible = (lv==='wide');
  odGroup.visible = odMode && lv!=='castle';
  tourGroup.visible = tourMode && lv!=='castle';
  enterHint.style.display = lv==='city' ? 'block' : 'none';
  if(lv==='wide'){ scene.fog.near=22000; scene.fog.far=70000; if(fly) flyTo(new THREE.Vector3(1800, 0, 900), 33000, 0.5, -0.3, 1600); }
  if(lv==='city'){ scene.fog.near=6000; scene.fog.far=20000; if(fly) flyTo(new THREE.Vector3(CASTLE.x, TH(CASTLE.x, CASTLE.z), CASTLE.z), 2450, 0.88, -0.55, 1500); }
  if(lv==='castle'){ scene.fog.near=2500; scene.fog.far=9000; if(fly) flyTo(new THREE.Vector3(CASTLE.x-40, TH(CASTLE.x-40, CASTLE.z+190)+10, CASTLE.z+190), 640, 0.95, -0.35, 1500); }
  renderPanel();
}
document.querySelectorAll('.crumb[data-lvl]').forEach(c=> c.addEventListener('click', ()=> setLevel(c.dataset.lvl)));
document.getElementById('pc-toggle').addEventListener('click', ()=> setPCMode(!pcMode));
const odBtn = document.getElementById('od-toggle'), tourBtn = document.getElementById('tour-toggle');
odBtn.onclick = ()=>{
  odMode=!odMode; if(odMode && level==='castle') setLevel('city');
  odGroup.visible = odMode && level!=='castle'; odBtn.classList.toggle('active', odMode);
  if(odMode){ updateKDE(true); toast('OD分析: ガウスKDE（滞留密度）＋ ODアーク。タイムライン ▶ で「流入 → 城内滞留 → 回遊 → 帰路」の質量移動', 3600); }
  renderPanel();
};
tourBtn.onclick = ()=>{
  tourMode=!tourMode; if(tourMode && level==='castle') setLevel('city');
  tourGroup.visible = tourMode && level!=='castle'; tourBtn.classList.toggle('active', tourMode);
  if(tourMode) toast('観光導線: 姫路駅ハブから6方面（方面クリックで視点移動）', 3200);
  renderPanel();
};
/* 折りたたみUI */
const panelEl = document.getElementById('panel'), panelTab = document.getElementById('panel-tab');
document.getElementById('panel-toggle').onclick = ()=>{ panelEl.classList.add('collapsed'); panelTab.style.display='block'; };
panelTab.onclick = ()=>{ panelEl.classList.remove('collapsed'); panelTab.style.display='none'; };
const tlEl = document.getElementById('timeline'), tlFold = document.getElementById('tl-fold');
tlFold.onclick = ()=>{ const c=tlEl.classList.toggle('collapsed'); tlFold.textContent = c?'▴':'▾'; };

/* ================= 左パネル ================= */
const pb = document.getElementById('panel-body');
function kpi(v, l, g){ return `<div class="kpi${g?' g':''}"><div class="v">${v}</div><div class="l">${l}</div></div>`; }
function barRows(rows, col){ return rows.map(r=>`<div class="bar-row"><span title="${r[0]}">${r[0]}</span><div class="bar"><i style="width:${(r[1]*100).toFixed(0)}%;background:${r[2]||col}"></i></div><b>${(r[1]*100).toFixed(0)}%</b></div>`).join(''); }
function segChips(){
  return `<div class="row-btns" id="seg-chips">
    <button class="chip ${segFilter==='all'?'active':''}" data-s="all">全体</button>
    <button class="chip in ${segFilter==='in'?'active':''}" data-s="in">インバウンド</button>
    <button class="chip dom ${segFilter==='dom'?'active':''}" data-s="dom">国内（県外）</button>
    <button class="chip loc ${segFilter==='loc'?'active':''}" data-s="loc">県内・近隣</button></div>`;
}
function scnChips(){
  return `<div class="row-btns" id="scn-chips">${Object.entries(SCN).map(([k,s])=>`<button class="chip ${k===curScn?'active':''}" data-scn="${k}">${s.name}</button>`).join('')}</div>`;
}
function bindCommon(){
  document.querySelectorAll('#seg-chips .chip').forEach(c=> c.onclick=()=>{ segFilter=c.dataset.s; HEAT.lastT=-99; repaintHeat(); KDE.lastT=-99; updateKDE(true); renderPanel(); });
  document.querySelectorAll('#scn-chips .chip').forEach(c=> c.onclick=()=>{ curScn=c.dataset.scn; resetSim(); timeState.min=0; syncClock(); HEAT.lastT=-99; repaintHeat(); renderPanel(); toast(`シナリオ: ${SCN[curScn].name}（入城 想定 ${fmt(SCN[curScn].castle)}人/日 ｜ ${SCN[curScn].note}）`, 4200); });
  document.querySelectorAll('#layer-chips .chip').forEach(c=> c.onclick=()=>{ LAYER_STATE[c.dataset.l]=!LAYER_STATE[c.dataset.l]; c.classList.toggle('active'); applyLayers(); });
  document.querySelectorAll('#heat-chips .chip').forEach(c=> c.onclick=()=>{ heatMode=c.dataset.h; HEAT.lastT=-99; applyLayers(); repaintHeat(); renderPanel(); });
  document.querySelectorAll('[data-tr]').forEach(b=> b.onclick=()=>{ const t=TOURS[+b.dataset.tr]; const e=t.end; flyTo(new THREE.Vector3((e.x+STN.x)/2, 0, (e.z+STN.z)/2), Math.max(1400, t.total*0.9), 0.8, Math.atan2(e.x-STN.x, e.z-STN.z)+Math.PI, 1300); });
  document.querySelectorAll('[data-corr]').forEach(b=> b.onclick=()=>{ const c=CORR_BY_ID[b.dataset.corr]; const e=c.pts[c.pts.length-1]; const a=c.bear*Math.PI/180; flyTo(new THREE.Vector3(e.x*0.5, 0, e.z*0.5), Math.max(9000, e.r*1.05), 0.72, a+Math.PI, 1300); });
  const cin=document.getElementById('csv-in'), cbtn=document.getElementById('csv-btn');
  if(cbtn){ cbtn.onclick=()=>cin.click(); cin.onchange=()=>{ const f=cin.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ const n=rd.result.split(/\r?\n/).filter(l=>l.trim()).length-1; toast(`${Math.max(0,n)}行を読み込みました（実データ接続のプレースホルダ：本番はDB直結）`, 3200); }; rd.readAsText(f); }; }
}
function lineSwatch(mode){
  const st=MODE_STYLE[mode];
  if(st.kind===1) return `<span class="lsw" style="border-top:2px solid ${st.css};border-bottom:2px solid ${st.css}"></span>`;
  if(st.kind===2) return `<span class="lsw" style="background:repeating-linear-gradient(90deg,${st.css} 0 5px,transparent 5px 9px);height:3px"></span>`;
  return `<span class="lsw" style="background:${st.css};height:3px;box-shadow:0 -3px 0 -1px ${st.css}55,0 3px 0 -1px ${st.css}55"></span>`;
}
function modeLegend(){
  return `<div class="legend">${Object.entries(MODE_STYLE).map(([k,st])=>`<div class="li">${lineSwatch(k)}${st.name}</div>`).join('')}
    <div class="li" style="margin-top:3px"><div class="sw" style="background:var(--in)"></div>インバウンド　<div class="sw" style="background:var(--dom)"></div>国内（県外）　<div class="sw" style="background:var(--loc)"></div>県内・近隣　＝ 帯の色・ポールの高さ</div></div>`;
}
function corridorRows(){
  const sh = corrShares();
  const rows = CORRIDORS.map(c=>({c, s:sh[c.id]})).filter(r=> r.s.arr+r.s.dep > 0.001).sort((a,b)=> (b.s.arr+b.s.dep)-(a.s.arr+a.s.dep));
  return rows.map(r=>{ const st=MODE_STYLE[r.c.mode]; const origins = ORIGINS.filter(o=> o.corr===r.c.id && segByFilter(o.seg)).map(o=>o.name).join('・');
    return `<button class="mode-btn" data-corr="${r.c.id}" style="padding:6px 9px"><div class="dot" style="background:${st.css}"></div><div style="flex:1;min-width:0">${r.c.name}　<b style="color:var(--txt);font-family:var(--mono);font-weight:500">${(r.s.arr*100).toFixed(0)}%</b> <span style="color:var(--sub);font-size:10px">→ 帰路 ${(r.s.dep*100).toFixed(0)}%</span><span class="desc">${r.c.pts.map(p=>`${p.n} ${p.t}`).join(' → ')}</span><span class="desc" style="color:#c8cede">${origins}</span></div></button>`; }).join('');
}
function destRows(){
  const segs = segFilter==='all' ? SEG_KEYS : [segFilter];
  const acc = {};
  segs.forEach(seg=> DEST[seg].forEach(d=>{ const w = segFilter==='all' ? SCN[curScn].mix[seg] : 1; acc[d[1]] = (acc[d[1]]||0) + d[2]*w; }));
  const rows = Object.entries(acc).sort((a,b)=>b[1]-a[1]).slice(0,7).map(r=>[r[0], r[1], r[0].includes('宿泊')?'#35d0c0':'#8f9cc0']);
  return barRows(rows);
}
function tourSec(){
  if(!tourMode || level==='castle') return '';
  return `<div class="sec"><div class="sec-t"><b>観光導線</b> — 姫路駅ハブ発 6方面（回遊拡張の仮ルート）</div>
    <div class="mode-list">${TOURS.map((t,i)=>`<button class="mode-btn" data-tr="${i}" style="padding:6px 9px"><div class="dot" style="background:${hx6(t.col)}"></div><div style="flex:1;min-width:0">${t.name}　<b style="color:var(--txt);font-family:var(--mono);font-weight:500">${t.time}</b><span class="desc">${t.via} ｜ ${t.spots}</span></div></button>`).join('')}</div>
    <div class="hint" style="margin-top:7px">矢羽が進行方向。姫路城「だけ」で帰る来訪者（回遊率の残り）を周辺へ送客する導線候補。実測では<b>方面別の遷移率・滞在時間</b>に置換します。</div></div>`;
}
function odSec(){
  if(!odMode || level==='castle') return '';
  return `<div class="sec"><div class="sec-t"><b>◎ OD分析</b> — ガウスKDE（滞留密度）× ODアーク</div>
    <div class="grad-bar"></div><div class="grad-lbl"><span>低密度</span><span>高密度</span></div>
    <div class="hint" style="margin:7px 0">山の高さ＝<b>人数 × 正規カーネル N(μ, σ²) の重ね合わせ</b>。再生で「駅・ICの山 → 姫路城へ質量移動 → 商店街・好古園へ分散 → 夕方に駅へ戻る → 夜は宿泊集積」。弧＝OD流（太さ＝シェア、帯の進行方向＝流れの向き）。</div></div>`;
}
function renderPanel(){
  const sc = SCN[curScn];
  if(level==='wide'){
    pb.innerHTML = `
      <div class="sec"><div class="sec-t"><b>L0</b> 広域流入 — 誰が・どこから来たか</div><div class="kpi-grid" id="kpi-main"></div></div>
      ${anaSec()}
      <div class="sec"><div class="sec-t">来訪者セグメント</div>${segChips()}</div>
      <div class="sec"><div class="sec-t">シナリオ（入城者数/日・想定）</div>${scnChips()}</div>
      ${odSec()}${tourSec()}${dbSrcSec()}${flowModeSec()}${flowSec()}${contourSec()}${meshSec()}${trajSec()}${floorSec()}
      <div class="sec"><div class="sec-t">動線（路線・高速道路・航路・空港）— 流入シェア（クリックで視点）</div><div class="mode-list">${corridorRows()}</div></div>
      <div class="sec"><div class="sec-t">凡例 — 線種＝交通モード、帯の色＝セグメント</div>${modeLegend()}</div>
      <div class="sec"><div class="sec-t">到着ゲート（市内側）</div><div id="gate-rows"></div></div>
      <div class="sec"><div class="sec-t">操作</div><div class="hint"><b>ドラッグ＝地図を掴んで引っ張る</b>／<b>握って少し待つ（⟳）→ドラッグ、または握ったままホイール＝回転・傾き（真上〜真横）</b>／右ドラッグ・Shift＋ドラッグも回転／スクロール＝カーソル位置へズーム／ダブルクリック＝フォーカス。右下のボタンで 2D・俯瞰・横・地表・目線 の視点へ。各動線は<b>経由都市と所要時間</b>付き。帯の流れは<b>朝は姫路へ、夕方は帰路方向へ</b>反転し、太さ＝流入量。ポールの高さ＝出発地シェア（観光動向調査の居住地構成から換算）。<b style="color:var(--gold)">L1</b>で市内の滞留、<b style="color:var(--gold)">L2</b>で城内の混雑へ。</div></div>`;
  }
  if(level==='city'){
    pb.innerHTML = `
      <div class="sec"><div class="sec-t"><b>L1</b> 市内回遊・滞留 — どこに・どれだけ滞留したか</div><div class="kpi-grid" id="kpi-main"></div></div>
      ${anaSec()}
      <div class="sec"><div class="sec-t">来訪者セグメント</div>${segChips()}</div>
      <div class="sec"><div class="sec-t">シナリオ</div>${scnChips()}</div>
      ${odSec()}${tourSec()}${dbSrcSec()}${flowModeSec()}${flowSec()}${contourSec()}${meshSec()}${trajSec()}${floorSec()}
      <div class="sec"><div class="sec-t">滞留ヒートマップ — 通り単位・時間連動</div>
        <div class="row-btns" id="heat-chips">
          <button class="chip ${heatMode==='off'?'active':''}" data-h="off">OFF</button>
          <button class="chip ${heatMode==='all'?'active':''}" data-h="all">全体</button>
          <button class="chip in ${heatMode==='in'?'active':''}" data-h="in">インバウンド</button>
          <button class="chip dom ${heatMode==='dom'?'active':''}" data-h="dom">国内</button></div>
        ${heatMode!=='off' ? `<div class="grad-bar" style="margin-top:7px"></div><div class="grad-lbl"><span>静</span><span>滞留 大</span></div>
        <div class="hint" style="margin-top:6px">${heatMode==='in' ? 'インバウンドは<b>姫路城・好古園・駅〜大手前通り</b>に集中し、商店街・手柄山への広がりが弱い（＝回遊の伸びしろ）。' : heatMode==='dom' ? '国内客は<b>商店街・美術館・動物園</b>まで広がり、車客は駐車場〜城周辺に滞留。' : '駅・大手前通り・姫路城の「一本道」構造。夕方は駅へ収束、夜は宿泊集積のみ発熱。'}</div>` : ''}</div>
      <div class="sec"><div class="sec-t">回遊先 立寄り（現在の滞留ドット）</div><div id="spot-rows"></div></div>
      <div class="sec"><div class="sec-t">帰路 — どこへ帰ったか（想定シェア）</div>${destRows()}</div>
      <div class="sec"><div class="sec-t">レイヤー</div>
        <div class="row-btns" id="layer-chips">
          <button class="chip ${LAYER_STATE.agents?'active':''}" data-l="agents">来訪者ドット</button>
          <button class="chip ${LAYER_STATE.lu?'active':''}" data-l="lu">土地利用・堀</button>
          <button class="chip ${LAYER_STATE.ped?'active':''}" data-l="ped">歩行者・商店街</button>
          <button class="chip ${LAYER_STATE.poi?'active':''}" data-l="poi">POI</button>
          <button class="chip ${LAYER_STATE.hotel?'active':''}" data-l="hotel">宿泊</button>
          <button class="chip ${LAYER_STATE.rail?'active':''}" data-l="rail">鉄道</button>
          <button class="chip ${LAYER_STATE.dots?'active':''}" data-l="dots">点描（広域）</button>
          <button class="chip ${LAYER_STATE.plu?'active':''}" data-l="plu">土地利用（PLATEAU）</button>
          <button class="chip ${LAYER_STATE.proad?'active':''}" data-l="proad">道路面</button></div></div>
      <div class="sec"><div class="sec-t">凡例</div><div class="legend">
          <div class="li"><div class="sw" style="background:var(--in)"></div>インバウンド　<div class="sw" style="background:var(--dom)"></div>国内（県外）　<div class="sw" style="background:var(--loc)"></div>県内・近隣</div>
          <div class="li"><div class="sw" style="background:#ffd166"></div>世界遺産・史跡　<div class="sw" style="background:#b56ce8"></div>文化施設　<div class="sw" style="background:#e87ca0"></div>商業・食</div>
          <div class="li"><div class="sw" style="background:#4da3ff"></div>交通結節点　<div class="sw" style="background:#3ddc84"></div>自然・公園　<div class="sw" style="background:#35d0c0"></div>宿泊（OSM ${SCENE_DATA.hotels.length}軒）</div>
          <div class="li"><div class="sw" style="background:#d0d6ea"></div>JR　<div class="sw" style="background:#9ec5ff"></div>山陽新幹線　<div class="sw" style="background:#ff9a3d"></div>山陽電鉄　<div class="sw" style="background:#2a5a8a"></div>堀・河川</div>
        </div></div>
      <div class="sec"><div class="sec-t">実データ接続（プレースホルダ）</div>
        <input type="file" id="csv-in" accept=".csv,text/csv" style="display:none"><button class="tool-btn" id="csv-btn">CSVを読み込んで滞留データを上書き</button>
        <div class="hint" style="margin-top:6px">列: date, hour, mesh_id, segment, count（携帯位置情報の500mメッシュ集計を想定）。本番はDB直結で自動更新。</div></div>
      <div class="sec"><div class="sec-t">操作</div><div class="hint"><b>ドラッグ＝地図を掴んで引っ張る</b>／<b>握って少し待つ（⟳）→ドラッグ、または握ったままホイール＝回転・傾き（真上〜真横）</b>／右ドラッグ・Shift＋ドラッグも回転／スクロール＝カーソル位置へズーム／ダブルクリック＝フォーカス。右下のボタンで 2D・俯瞰・横・地表・目線 の視点へ。POI・宿泊ピンにホバーで解説。<b style="color:var(--gold)">姫路城をクリック</b>で城内（L2）へ。</div></div>`;
  }
  if(level==='castle'){
    pb.innerHTML = `
      <div class="sec"><div class="sec-t"><b class="g">L2</b> 姫路城 — 城内滞留・待ち行列・入城制限</div><div class="kpi-grid" id="kpi-main"></div></div>
      ${anaSec()}
      <div class="sec"><div class="sec-t">来訪者セグメント</div>${segChips()}</div>
      <div class="sec"><div class="sec-t">シナリオ</div>${scnChips()}</div>
      ${dbSrcSec()}${flowModeSec()}${flowSec()}${contourSec()}${meshSec()}${trajSec()}${floorSec()}
      <div class="sec"><div class="sec-t">ゾーン別 滞留・混雑（1ドット＝${AG_SCALE}人）</div><div id="zone-rows"></div></div>
      <div class="sec"><div class="sec-t">入城料（2026年3月〜 二段階料金・想定）</div><div class="legend">
        <div class="li"><div class="sw" style="background:var(--gold)"></div>市外・海外 ¥${FEE.out.toLocaleString()}　<div class="sw" style="background:#8f9cc0"></div>姫路市民 ¥${FEE.resident.toLocaleString()}</div></div></div>
      <div class="sec"><div class="sec-t">インサイト</div><div class="hint">律速点は<b>大天守（入場制限 15,000人/日）</b>と<b>菱の門の券売</b>。桜・GWは12時前後に待ち60分超が発生。入城券の<b>時間指定枠・事前販売</b>と、待ち時間を<b>好古園・西の丸へ振り替える案内</b>が滞留分散の打ち手になります。ドラッグで地図を引っ張る・握って待ってから（⟳）ドラッグで回転。<kbd>Esc</kbd>で市内へ戻る。</div></div>`;
  }
  bindCommon(); bindFlow3D(); bindFlowVis(); if(typeof bindDbSrc==='function') bindDbSrc();
  updateKPIs(); updateFlowPanels();
}
function updateKPIs(){
  if(typeof updateAna==='function') updateAna();
  const k = document.getElementById('kpi-main'); if(!k) return;
  const dbNote = (window.twinDb && twinDb.on) ? '<div class="hint" style="grid-column:1/-1;color:#ffd166">▼ ブラウザ内シミュレーション値（DB モードの実人数は下の Analytics）</div>' : '';
  const sc = SCN[curScn];
  const arrTot = STATS.arrived.in+STATS.arrived.dom+STATS.arrived.loc;
  const seg = segFilter;
  const arrSeg = seg==='all' ? arrTot : STATS.arrived[seg];
  const people = n=> fmt(n*AG_SCALE);
  if(level==='wide'){
    const inShare = arrTot ? STATS.arrived.in/arrTot : sc.mix.in;
    k.innerHTML = dbNote +
      kpi(people(arrSeg)+'<small> 人</small>', `本日累計 来訪（${seg==='all'?'全体':SEG[seg].name}）`) +
      kpi((inShare*100).toFixed(0)+'<small> %</small>', 'インバウンド比率') +
      kpi(people(STATS.inCity), '現在 市内滞在') +
      kpi('1,567,674<small> 人/年</small>', '2025年度 入城者（実績）・外国人34.9%', true);
    const gr = document.getElementById('gate-rows');
    if(gr){ const tot=Math.max(1, Object.values(STATS.byGate).reduce((a,b)=>a+b,0)); gr.innerHTML = barRows(Object.entries(GATES).map(([g,v])=>[v.name.replace('（','<br>（'), (STATS.byGate[g]||0)/tot, hx6(v.col)]).sort((a,b)=>b[1]-a[1])); }
  }
  if(level==='city'){
    const avgDwell = STATS.dwellN ? STATS.dwellSum/STATS.dwellN : 0;
    const kaiyu = STATS.dwellN ? STATS.kaiyu/STATS.dwellN : 0;
    k.innerHTML = dbNote +
      kpi(people(STATS.inCastle), '現在 城内滞留') +
      kpi(people(STATS.atSpotN||0), '現在 市内回遊先に滞留') +
      kpi(avgDwell ? (avgDwell/60).toFixed(1)+'<small> h</small>' : '—', '平均 市内滞在時間（退出者）') +
      kpi(STATS.dwellN ? (kaiyu*100).toFixed(0)+'<small> %</small>' : '—', '回遊率（城以外にも立寄り）') +
      kpi(people(STATS.staying), '本日 市内宿泊（転換）') +
      kpi(`¥${fmt(SEG_KEYS.reduce((a,k)=>a+STATS.arrived[k]*AG_SCALE*spendPer(k),0)/10000)}<small> 万</small>`, '本日 市内消費 推定（宿泊・飲食・土産・入場料）', true);
    const sr = document.getElementById('spot-rows');
    if(sr){ const mx=Math.max(1, ...SPOTS.map(s=>STATS.atSpot[s.n]||0)); sr.innerHTML = barRows(SPOTS.map(s=>[s.n, (STATS.atSpot[s.n]||0)/mx, '#ffd166']).sort((a,b)=>b[1]-a[1]).slice(0,6)).replace(/<b>(\d+)%<\/b>/g, (m,v)=>`<b>${fmt(v/100*mx*AG_SCALE)}</b>`); }
  }
  if(level==='castle'){
    const zs = zoneStats(); const tenshu = zs.find(s=>s.z.n==='大天守'); const gate = zs.find(s=>s.z.n==='入城口（菱の門）');
    const entered = STATS.castleEntered*AG_SCALE;
    k.innerHTML = dbNote +
      kpi(people(STATS.inCastle), '現在 城内滞留', true) +
      kpi(Math.round(tenshu.wait)+'<small> 分</small>', '大天守 待ち時間（推定）') +
      kpi(fmt(entered)+'<small> / '+fmt(TENSHU_CAP)+'</small>', '本日入城 / 大天守上限') +
      kpi(Math.round(gate.wait)+'<small> 分</small>', '券売 待ち（菱の門）') +
      kpi(`¥${fmt(entered*(FEE.out*0.85+FEE.resident*0.15)/10000)}<small> 万</small>`, '入城料 収入（市外85%想定）') +
      kpi(sc.name, 'シナリオ');
    const zr = document.getElementById('zone-rows');
    if(zr) zr.innerHTML = zs.map(s=>`<div class="zone-row"><div class="zn">${s.z.n}<small>${s.z.desc}</small></div><span class="pill ${s.lvl}">${s.lvl==='hi'?'混雑':s.lvl==='mid'?'やや混雑':'快適'}</span><div class="zv" style="color:${s.lvl==='hi'?'var(--warn)':s.lvl==='mid'?'var(--gold)':'var(--ok)'}">${fmt(s.occ)}<small style="font-size:9px;color:var(--sub)"> 人</small></div></div>`).join('');
  }
}

/* ================= 分析ボード（SVGチャート・サンキー） ================= */
const board = document.getElementById('board');
let boardOn=false, boardTab='who';
const CC = { in:'#3a90d6', dom:'#27b062', loc:'#d05f8a', gold:'#ffd166', sub:'#8b93a8', line:'#2a3145', txt:'#e8eaf2', brex:'#ff8a1e' };
function svgHBars(rows, W=520, colFn){
  const rh=18, L=150, R=48, H=rows.length*rh+8;
  const mx=Math.max(...rows.map(r=>r[1]));
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">${rows.map((r,i)=>{ const w=(W-L-R)*r[1]/mx; const y=4+i*rh;
    return `<text x="${L-8}" y="${y+13}" font-size="10" fill="${CC.sub}" text-anchor="end">${r[0]}</text><rect x="${L}" y="${y+3}" width="${w.toFixed(1)}" height="12" rx="3" fill="${colFn?colFn(r,i):CC.gold}"/><text x="${L+w+6}" y="${y+13}" font-size="10" fill="${CC.txt}" font-family="Oswald">${r[2]||(r[1]*100).toFixed(0)+'%'}</text>`; }).join('')}</svg>`;
}
function svgStacked(label, parts, W=520){
  let x=0; const H=40;
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img"><text x="0" y="11" font-size="10" fill="${CC.sub}">${label}</text>${parts.map(p=>{ const w=W*p[1]; const s=`<rect x="${x.toFixed(1)}" y="16" width="${Math.max(0,w-2).toFixed(1)}" height="18" rx="3" fill="${p[2]}"/>${w>44?`<text x="${(x+w/2).toFixed(1)}" y="29" font-size="10" fill="#0b0e14" text-anchor="middle" font-weight="700">${p[0]} ${(p[1]*100).toFixed(0)}%</text>`:''}`; x+=w; return s; }).join('')}</svg>`;
}
function svgDayCurve(W=520, H=190){
  const L=36,R=12,T=14,B=26, iw=W-L-R, ih=H-T-B;
  const N=36; const arr=[], stay=[], dep=[];
  let cum=0; const sc=SCN[curScn];
  for(let i=0;i<=N;i++){ const m=i*30; const a=arrProfile(m)/ARR_NORM*sc.castle*CITY_FACTOR*30; arr.push(a); }
  const mxA=Math.max(...arr);
  let inCity=0; const inC=[];
  for(let i=0;i<=N;i++){ const m=i*30; inCity += arr[i]; const d = i>=8 ? arr[i-8]*0.85 + (i>=10?arr[i-10]*0.15:0) : 0; inCity -= d; dep.push(d); inC.push(Math.max(0,inCity)); }
  const mxC=Math.max(...inC);
  const X=i=> L+i/N*iw, Ya=v=> T+ih-(v/mxA)*ih*0.55, Yc=v=> T+ih-(v/mxC)*ih;
  const area = `M${X(0)},${T+ih} `+inC.map((v,i)=>`L${X(i).toFixed(1)},${Yc(v).toFixed(1)}`).join(' ')+` L${X(N)},${T+ih} Z`;
  const la = arr.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Ya(v).toFixed(1)}`).join(' ');
  const ld = dep.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Ya(v).toFixed(1)}`).join(' ');
  const ticks=[0,6,12,18,24,30,36].map(i=>`<text x="${X(i).toFixed(1)}" y="${H-8}" font-size="9" fill="${CC.sub}" text-anchor="middle">${6+i/2}時</text><line x1="${X(i).toFixed(1)}" y1="${T}" x2="${X(i).toFixed(1)}" y2="${T+ih}" stroke="${CC.line}" stroke-dasharray="2 3"/>`).join('');
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">${ticks}<path d="${area}" fill="${CC.gold}" opacity=".18"/><path d="${inC.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Yc(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${CC.gold}" stroke-width="2"/><path d="${la}" fill="none" stroke="${CC.in}" stroke-width="2"/><path d="${ld}" fill="none" stroke="${CC.loc}" stroke-width="2"/>
    <text x="${L}" y="${T-3}" font-size="9.5" fill="${CC.gold}">■ 市内滞在人数（左）</text><text x="${L+120}" y="${T-3}" font-size="9.5" fill="${CC.in}">— 到着/30分</text><text x="${L+200}" y="${T-3}" font-size="9.5" fill="${CC.loc}">— 出発/30分</text>
    <text x="${L-4}" y="${T+10}" font-size="9" fill="${CC.sub}" text-anchor="end">${fmt(mxC/1000)}k</text><text x="${L-4}" y="${T+ih}" font-size="9" fill="${CC.sub}" text-anchor="end">0</text></svg>`;
}
function svgSankey(W=520, H=300){
  /* 3列: 出発地（左） → 姫路 滞留（中央: 城 / 好古園 / 商店街 / 書写山 / 通過） → 帰路（右） */
  const sc=SCN[curScn]; const segs = segFilter==='all' ? SEG_KEYS : [segFilter];
  const w = seg=> segFilter==='all' ? sc.mix[seg] : 1;
  const left = {}; segs.forEach(seg=> ORIGINS.filter(o=>o.seg===seg).forEach(o=> left[o.name]=(left[o.name]||0)+o.share*w(seg)));
  const mid = {'姫路城':0,'好古園':0,'商店街・駅ビル':0,'書写山・周辺':0,'美術館・博物館':0};
  segs.forEach(seg=>{ const ww=w(seg); mid['姫路城']+=0.9*ww; mid['好古園']+=SPOTS[0].p[seg]*ww; mid['商店街・駅ビル']+=SPOTS[1].p[seg]*ww; mid['書写山・周辺']+=(SPOTS[5].p[seg]+SPOTS[6].p[seg])*ww; mid['美術館・博物館']+=(SPOTS[2].p[seg]+SPOTS[3].p[seg])*ww; });
  const right = {}; segs.forEach(seg=> DEST[seg].forEach(d=> right[d[1].replace(/へ.*$/,'').replace('（帰国）','')] = (right[d[1].replace(/へ.*$/,'').replace('（帰国）','')]||0) + d[2]*w(seg)));
  const cols=[Object.entries(left).sort((a,b)=>b[1]-a[1]).slice(0,7), Object.entries(mid), Object.entries(right).sort((a,b)=>b[1]-a[1]).slice(0,7)];
  const xs=[16, W/2-40, W-96], bw=8, gap=6, T=18;
  const layout = cols.map(c=>{ const tot=c.reduce((a,b)=>a+b[1],0); const avail=H-T-10-gap*(c.length-1); let y=T; return c.map(e=>{ const h=Math.max(3, avail*e[1]/tot); const o={n:e[0], v:e[1], y, h}; y+=h+gap; return o; }); });
  const segCol = n=>{ const o=ORIGINS.find(o=>o.name===n); return o ? CC[o.seg] : CC.gold; };
  let out='';
  /* ribbons: left→mid (比例配分), mid→right */
  const rib=(a,b,x0,x1,col,op)=> `<path d="M${x0+bw},${a.y0} C${(x0+x1)/2},${a.y0} ${(x0+x1)/2},${b.y0} ${x1},${b.y0} L${x1},${b.y1} C${(x0+x1)/2},${b.y1} ${(x0+x1)/2},${a.y1} ${x0+bw},${a.y1} Z" fill="${col}" opacity="${op}"/>`;
  [[0,1],[1,2]].forEach(([ci,cj])=>{
    const A=layout[ci], B=layout[cj];
    const totB=B.reduce((s,b)=>s+b.v,0);
    const cur=B.map(b=>b.y);
    A.forEach(a=>{ let ay=a.y; B.forEach((b,bi)=>{ const h=a.h*b.v/totB; const bh=b.h*a.v/A.reduce((s,x)=>s+x.v,0); out+=rib({y0:ay,y1:ay+h},{y0:cur[bi],y1:cur[bi]+bh}, xs[ci], xs[cj], ci===0?segCol(a.n):CC.gold, ci===0?0.28:0.22); ay+=h; cur[bi]+=bh; }); });
  });
  layout.forEach((c,ci)=> c.forEach(o=>{ out+=`<rect x="${xs[ci]}" y="${o.y.toFixed(1)}" width="${bw}" height="${o.h.toFixed(1)}" rx="2" fill="${ci===0?segCol(o.n):(ci===1?CC.gold:CC.sub)}"/><text x="${ci===2?xs[ci]+bw+4:(ci===1?xs[ci]+bw+4:xs[ci]+bw+4)}" y="${(o.y+o.h/2+3.5).toFixed(1)}" font-size="9" fill="${CC.txt}">${o.n}</text>`; }));
  out+=`<text x="${xs[0]}" y="11" font-size="9.5" fill="${CC.sub}">出発地（どこから）</text><text x="${xs[1]}" y="11" font-size="9.5" fill="${CC.sub}">滞留（どこに）</text><text x="${xs[2]}" y="11" font-size="9.5" fill="${CC.sub}">帰路（どこへ）</text>`;
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
}
function svgStackedH(rows, W=520, cols){
  /* 複数行の100%積み上げ横棒（各行: [ラベル, [[name,val],...]]） */
  const rh=26, L=110, H=rows.length*rh+6, iw=W-L-6;
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img">${rows.map((r,i)=>{ const y=3+i*rh; let x=L; const tot=r[1].reduce((a,b)=>a+b[1],0)||1;
    return `<text x="${L-8}" y="${y+16}" font-size="10" fill="${CC.sub}" text-anchor="end">${r[0]}</text>` + r[1].map((p,k)=>{ const w=iw*p[1]/tot; const s=`<rect x="${x.toFixed(1)}" y="${y+4}" width="${Math.max(0,w-2).toFixed(1)}" height="16" rx="3" fill="${cols[k]}"/>${w>52?`<text x="${(x+w/2).toFixed(1)}" y="${y+16}" font-size="9.5" fill="#0b0e14" text-anchor="middle" font-weight="700">${p[0]} ${(p[1]/tot*100).toFixed(0)}%</text>`:''}`; x+=w; return s; }).join(''); }).join('')}</svg>`;
}
function svgPairBars(rows, W=520){
  /* 2系列（日本人 / 外国人）の横棒比較 */
  const rh=22, L=120, R=40, H=rows.length*rh+18, mx=Math.max(...rows.flatMap(r=>[r[1],r[2]]));
  return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img"><text x="${L}" y="10" font-size="9.5" fill="${CC.dom}">■ 日本人</text><text x="${L+60}" y="10" font-size="9.5" fill="${CC.in}">■ 外国人</text>
    ${rows.map((r,i)=>{ const y=16+i*rh; const w1=(W-L-R)*r[1]/mx, w2=(W-L-R)*r[2]/mx;
      return `<text x="${L-8}" y="${y+12}" font-size="10" fill="${CC.sub}" text-anchor="end">${r[0]}</text><rect x="${L}" y="${y+2}" width="${w1.toFixed(1)}" height="7" rx="2" fill="${CC.dom}"/><text x="${L+w1+4}" y="${y+9}" font-size="8.5" fill="${CC.txt}" font-family="Oswald">${r[1]}%</text><rect x="${L}" y="${y+11}" width="${w2.toFixed(1)}" height="7" rx="2" fill="${CC.in}"/><text x="${L+w2+4}" y="${y+18}" font-size="8.5" fill="${CC.txt}" font-family="Oswald">${r[2]}%</text>`; }).join('')}</svg>`;
}
function boardHTML(){
  const sc=SCN[curScn];
  const tabs=[['who','誰が・どこから'],['where','どこに滞留'],['back','どこへ帰った'],['spend','消費・料金改定'],['when','季節・時間帯'],['src','出典・前提']];
  let body='';
  const src = n=>`<span style="color:var(--sub);font-weight:400;letter-spacing:0;margin-left:6px">${n}</span>`;
  if(boardTab==='who'){
    const region = [['近畿（大阪41%・兵庫41%・京都5%・滋賀5%）',34.4],['関東',22.8],['東海',15.2],['九州・沖縄',9.0],['中国',8.7],['北海道・東北',5.1],['四国',4.3],['北陸',1.6]];
    const trans = [['JR在来線',40.6,71.9],['JR新幹線',32.0,56.0],['自家用車・レンタカー',36.5,10.0],['飛行機',9.8,68.8],['山陽電鉄など私鉄',11.5,5.0],['市内バス',10.9,15.9],['高速バス・貸切バス',6.6,7.2]];
    const before = [['大阪府',22.4,39.3],['岡山県',20.4,5.5],['京都府',11.2,18.4],['広島県',8.2,6.7],['東京都',6.1,5.5],['香川県',7.1,0.5]];
    body = `<div class="mcard"><h4>来訪者セグメント構成${src(`${sc.name}・入城 ${fmt(sc.castle)}人/日（${sc.note}）`)}</h4>${svgStacked('構成比', [['インバウンド',sc.mix.in,CC.in],['国内（県外）',sc.mix.dom,CC.dom],['県内・近隣',sc.mix.loc,CC.loc]])}
      <div class="insight">2025年度の入城者は<b>1,567,674人</b>、うち外国人 <b>547,426人（34.9%）</b>。4月は42%・7月は46%が外国人で、季節により構成が大きく変わる。姫路城地点の日本人来訪者は<b>兵庫県内が14%</b>に留まり、8割以上が県外から（遠来型の世界遺産）。</div></div>
      <div class="mgrid"><div class="mcard"><h4>インバウンド 国・地域別${src('観光動向調査 姫路城地点 359人')}</h4>${svgHBars(COUNTRIES, 250, ()=>CC.in)}
      <div class="insight">台湾・米国・豪州・中国・フランスが上位。<b>欧米豪で4割超</b>＝長期滞在・高消費型で、初来訪が89%。</div></div>
      <div class="mcard"><h4>国内 居住地（地方別）${src('観光動向調査 姫路城地点 488人')}</h4>${svgHBars(region.map(r=>[r[0],r[1],r[1]+'%']), 250, ()=>CC.dom)}
      <div class="insight">関東23%・東海15%・九州9%と<b>新幹線圏からの来訪が厚い</b>。近畿の内訳は大阪と兵庫がほぼ同数。</div></div></div>
      <div class="mcard"><h4>交通手段（全行程・複数回答）${src('観光動向調査 姫路城地点')}</h4>${svgPairBars(trans)}
      <div class="insight">外国人は<b>JR在来線72%・飛行機69%・新幹線56%</b>＝空港→大阪・京都拠点→新快速/新幹線で姫路へ。日本人は在来線41%・新幹線32%・車37%。<b>JR姫路駅（乗降 9.2万人/日）が最大ゲート</b>で、駅北口〜大手前通りが介入点。</div></div>
      <div class="mcard"><h4>姫路の「前」に訪れた都道府県${src('観光動向調査・複数回答')}</h4>${svgPairBars(before)}
      <div class="insight">日本人は大阪22%・岡山20%、外国人は<b>大阪39%・京都18%</b>から。岡山側（西）からの流入が日本人で2割あるのは瀬戸内周遊の途中下車。</div></div>`;
  } else if(boardTab==='where'){
    const fac = [['姫路城',1532],['好古園',580],['姫路セントラルパーク',525],['アクリエひめじ',456],['動物園',379],['手柄山周辺（水族館等）',318],['書写山周辺',210]];
    const visit = SPOTS.map(s=>[s.n, SEG_KEYS.reduce((a,k)=>a+s.p[k]*sc.mix[k],0)]).sort((a,b)=>b[1]-a[1]);
    const dwell = [['姫路城（城内）',150,'2h30m'],['書写山圓教寺',150,'2h30m'],['アクリエひめじ',90,'1h30m'],['手柄山中央公園',60,'1h00m'],['姫路市立美術館',50,'50m'],['好古園',45,'45m'],['みゆき通り商店街',40,'40m'],['中心市街地（GPS実測の典型値）',30,'30m']];
    body = `<div class="mcard"><h4>市内観光施設 入込客数（千人・令和6年度）${src('姫路市入込客数調査')}</h4>${svgHBars(fac.map(f=>[f[0],f[1],fmt(f[1])+'千人']), 520)}
      <div class="insight">総入込 923.2万人のうち<b>姫路城周辺ゾーンが271万人（観光施設の56%）</b>。好古園58万は城の38%＝共通券効果。書写山周辺21万・手柄山32万は城の1〜2割で、<b>城以外へ広がる余地が大きい</b>。</div></div>
      <div class="mgrid"><div class="mcard"><h4>回遊先 立寄率（仮置き）${src('外国人「姫路城以外の観光施設」42%・飲食9%・物販7%')}</h4>${svgHBars(visit, 250)}</div>
      <div class="mcard"><h4>スポット別 平均滞在時間（仮置き）</h4>${svgHBars(dwell.map(d=>[d[0],d[1],d[2]]), 250)}
      <div class="insight">総務省の姫路市中心市街地GPS分析（約27万ID）では<b>来街1回の滞在が30分程度</b>の層が厚い。城で2.5時間過ごした後、まちなかは「通過」になりがち。</div></div></div>
      <div class="mcard"><h4>時間帯別 滞留分布（シミュレーション）${src('城内 / 市内回遊先 / 移動中')}</h4>${svgDayCurve()}</div>`;
  } else if(boardTab==='back'){
    const lodge = [['日本人', [['日帰り',37.1],['市内宿泊',30.5],['市外宿泊',32.4]]],['外国人', [['日帰り（拠点へ戻る）',0],['市内宿泊',13.9],['市外宿泊',86.1]]]];
    const after = [['大阪府',44.6,53.9],['岡山県',20.3,9.5],['京都府',11.7,24.7],['東京都',8.2,23.0],['広島県',7.1,17.1],['香川県',6.4,0.5],['福岡県',2.0,3.3]];
    body = `<div class="mcard"><h4>出発地 → 滞留 → 帰路（サンキー）${src(segFilter==='all'?'全体':SEG[segFilter].name)}</h4>${svgSankey()}
      <div class="insight">インバウンドは<b>大阪・京都の宿泊拠点へ戻る</b>か東京・広島へ抜ける「通過型」。日本人も帰路は<b>大阪45%・岡山20%</b>。姫路で夜を過ごすのは日本人3割・外国人14%。</div></div>
      <div class="mgrid"><div class="mcard"><h4>宿泊形態${src('観光動向調査 姫路城地点')}</h4>${svgStackedH(lodge, 250, [CC.sub,'#35d0c0',CC.dom])}
      <div class="insight">市内宿泊率 日本人30.5%（宿泊62.9%×市内48.5%）・外国人13.9%。<b>外国人の市内宿泊+5pt</b>＝年間約2.7万泊、宿泊費 ¥3,920→上振れ余地。</div></div>
      <div class="mcard"><h4>姫路の「後」に訪れる都道府県${src('観光動向調査・複数回答')}</h4>${svgPairBars(after, 250)}
      <div class="insight">大阪→姫路→岡山/広島の<b>東西通過軸</b>が主流。帰路先（大阪・岡山）と組む周遊券・時間指定枠が、滞在時間を延ばす打ち手。</div></div></div>`;
  } else if(boardTab==='spend'){
    const rows = SEG_KEYS.map(k=>[SEG[k].name, [['宿泊',SPEND[k].stay],['飲食',SPEND[k].food],['土産',SPEND[k].gift],['入場料',SPEND[k].fee]]]);
    const annualVisitors = ANNUAL_2025.total*CITY_FACTOR;
    const mixY = {in:ANNUAL_2025.foreign/ANNUAL_2025.total, dom:(1-ANNUAL_2025.foreign/ANNUAL_2025.total)*0.85, loc:(1-ANNUAL_2025.foreign/ANNUAL_2025.total)*0.15};
    const annualSpend = SEG_KEYS.reduce((a,k)=> a + annualVisitors*mixY[k]*spendPer(k), 0);
    const feeOld = ANNUAL_2025.total*0.92*1000, feeNew = ANNUAL_2025.total*(0.85*FEE.out+0.07*FEE.resident);
    body = `<div class="mcard"><h4>1人あたり 市内消費（円・平均）${src('観光動向調査 姫路城地点：宿泊費・飲食費・土産代・入場料')}</h4>${svgStackedH(rows, 520, ['#35d0c0',CC.gold,CC.loc,CC.sub])}
      <div class="insight">市内消費は日本人 約¥13,600・外国人 約¥13,900で<b>ほぼ同額</b>。一方、全行程の消費は日本人 ¥36,562 に対し外国人 <b>¥203,965</b>（交通費 ¥190,000）。財布はあるのに<b>姫路で使う場面が無い</b>＝滞在・宿泊の設計課題。</div></div>
      <div class="mgrid"><div class="mcard"><h4>年間 市内消費 試算</h4><div class="kpi-grid">${kpi('約'+fmt(annualSpend/1e8)+'<small> 億円</small>','入城者157万人×1.35×市内消費単価',true)}${kpi('¥'+fmt(spendPer('in'))+'<small> /人</small>','外国人 市内消費（現状）')}${kpi('+'+(0.05*ANNUAL_2025.foreign*15000/1e8).toFixed(1)+'<small> 億円/年</small>','外国人 市内宿泊+5pt の宿泊消費増（¥15,000/泊）')}${kpi('+'+(ANNUAL_2025.total*0.4*2500/1e8).toFixed(1)+'<small> 億円/年</small>','回遊+1スポット（40%が¥2,500追加消費）')}</div></div>
      <div class="mcard"><h4>入城料改定（2026年3月1日〜）</h4><div class="legend">
        <div class="li"><div class="sw" style="background:var(--gold)"></div>一般 ¥2,500（団体 ¥2,000）　<div class="sw" style="background:#8f9cc0"></div>市民 ¥1,000（団体 ¥800）</div>
        <div class="li"><div class="sw" style="background:#35d0c0"></div>18歳未満 無料　<div class="sw" style="background:#b56ce8"></div>好古園共通券 ¥2,600・年間券 ¥5,000</div></div>
        <div class="kpi-grid" style="margin-top:8px">${kpi('約'+fmt(feeOld/1e8)+'<small> 億円</small>','改定前 入城料収入（¥1,000×157万人 試算）')}${kpi('約'+fmt(feeNew/1e8)+'<small> 億円</small>','改定後 試算（市外85%・市民7%・無料8%）',true)}</div>
        <div class="insight">デジタルチケット（日時指定）が同時に始まり、<b>入城者の「いつ・誰が（市民/市外）」が券売データとして取れる</b>。来訪者DBのPhase 1はこの券売データが軸。</div></div></div>`;
  } else if(boardTab==='when'){
    const W=520,H=190,L=34,R=10,T=16,B=26,iw=W-L-R,ih=H-T-B; const bw=iw/12-6; const mx=Math.max(...MONTHLY_2025.map(m=>m[1]));
    const bars=MONTHLY_2025.map((m,i)=>{ const h=m[1]/mx*ih, hin=m[2]/mx*ih; const x=L+i*(iw/12)+3;
      return `<rect x="${x.toFixed(1)}" y="${(T+ih-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h-hin).toFixed(1)}" rx="2" fill="${CC.dom}" opacity=".85"/><rect x="${x.toFixed(1)}" y="${(T+ih-hin).toFixed(1)}" width="${bw.toFixed(1)}" height="${hin.toFixed(1)}" rx="2" fill="${CC.in}"/><text x="${(x+bw/2).toFixed(1)}" y="${T+ih-h-3}" font-size="8" fill="${CC.txt}" text-anchor="middle" font-family="Oswald">${(m[1]/1000).toFixed(0)}k</text><text x="${(x+bw/2).toFixed(1)}" y="${H-10}" font-size="9" fill="${CC.sub}" text-anchor="middle">${m[0]}</text>`; }).join('');
    body = `<div class="mcard"><h4>月別 入城者数（2025年度 実績）× 外国人${src('姫路市')}</h4><svg class="ch" viewBox="0 0 ${W} ${H}" role="img"><line x1="${L}" y1="${T+ih}" x2="${W-R}" y2="${T+ih}" stroke="${CC.line}"/>${bars}<text x="${L}" y="${T-5}" font-size="9.5" fill="${CC.dom}">■ 日本人</text><text x="${L+50}" y="${T-5}" font-size="9.5" fill="${CC.in}">■ 外国人</text></svg>
      <div class="insight"><b>4月（桜）20.0万人・11月（紅葉）17.9万人の二山</b>、最少は1月8.7万人（2.3倍差）。外国人比率は7月46%・4月42%が高く、11月28%・2月30%が低い＝<b>紅葉は国内、夏は海外</b>。桜・GWは大天守上限15,000人/日に到達し待ち2〜3時間。</div></div>
      <div class="mcard"><h4>1日の流れ（シミュレーション）${src(sc.name)}</h4>${svgDayCurve()}
      <div class="insight">到着ピーク（9〜11時）と帰路ピーク（16〜18時）の間に正午前後の城内滞留ピーク。<b>大天守1,000人/時の律速</b>に同期して待ちが発生。日時指定チケットの枠配分で山を崩せる。</div></div>
      <div class="mcard"><h4>年間ボリューム</h4><div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">${kpi('1,567,674<small> 人</small>','2025年度 入城者（実績）',true)}${kpi('34.9<small> %</small>','外国人比率（547,426人）')}${kpi('923<small> 万人</small>','姫路市 総入込客数（令和6年度）')}${kpi('271<small> 万人</small>','姫路城周辺ゾーン 入込（観光施設の56%）')}${kpi('125<small> 万人泊</small>','市内 延べ宿泊者数（令和5年度）')}${kpi('9.2<small> 万人/日</small>','JR姫路駅 乗降客数')}</div></div>`;
  } else {
    body = `<div class="mcard"><h4>公表統計（本ダッシュボードの仮置き値の根拠）</h4><div class="legend" style="gap:7px">${SOURCES.map(s=>`<div class="li" style="align-items:flex-start"><div class="sw" style="background:var(--gold);margin-top:3px"></div><div><a href="${s[1]}" target="_blank" rel="noopener" style="color:var(--txt);text-decoration:underline dotted">${s[0]}</a></div></div>`).join('')}</div></div>
      <div class="mcard"><h4>数値の扱い（提案書での注記案）</h4><div class="hint" style="font-size:11px">
        ・入城者数・外国人比率・月別・入城料・入城制限は<b>公表実績値</b>。<br>
        ・居住地・交通手段・宿泊形態・帰路・消費額は<b>令和6年度 観光動向調査（姫路城地点 日本人488人／外国人359人・年4回の対面アンケート）</b>の構成比を、シナリオ別の来訪者数に掛けた<b>換算値</b>。<br>
        ・回遊先の立寄率・滞在時間・時間帯分布・ゾーン別混雑・待ち時間は<b>仮置き（シミュレーション）</b>で、来訪者DB（券売データ＋携帯位置情報）の接続で実測値に置換する対象。<br>
        ・1ドット＝8人。県内・近隣は周辺市町の日帰りを加味して国内の15%で仮置き（調査値は14%）。</div></div>`;
  }
  return `<div class="bd-head"><h2>分析ボード<small>来訪者DB アウトプットイメージ — 公表統計ベースの換算値＋仮置き（出典タブ参照）</small></h2><button class="bd-x" id="bd-close">✕ 閉じる</button></div>
    <div class="bd-tabs">${tabs.map(t=>`<button class="chip ${boardTab===t[0]?'active':''}" data-bt="${t[0]}">${t[1]}</button>`).join('')}</div>${body}`;
}
function renderBoard(){
  if(!boardOn) return;
  board.innerHTML = boardHTML();
  document.getElementById('bd-close').onclick = ()=> setBoard(false);
  board.querySelectorAll('[data-bt]').forEach(b=> b.onclick=()=>{ boardTab=b.dataset.bt; renderBoard(); });
}
function setBoard(on){
  boardOn = on; board.style.display = on ? 'block' : 'none';
  document.getElementById('board-toggle').classList.toggle('active', on);
  if(on){ dbOn=false; propOn=false; document.getElementById('db-toggle').classList.remove('active'); document.getElementById('prop-toggle').classList.remove('active'); renderBoard(); }
}
document.getElementById('board-toggle').onclick = ()=> setBoard(!boardOn);

/* ================= DB構成（データソース・スキーマ・パイプライン） ================= */
let dbOn=false;
function dbHTML(){
  const src = [
    ['携帯位置情報（国内）','docomo モバイル空間統計 / KDDI Location Analyzer / Agoop','500mメッシュ×1h','居住地（都道府県・市区町村）・滞在時間・回遊','dom loc'],
    ['携帯位置情報（インバウンド）','ローミングデータ（国・地域別）','500mメッシュ×1h','国籍・滞在時間・訪問順序','in'],
    ['入城券・入場データ','姫路城 券売・ゲート（時間指定枠含む）','1件×分','入城時刻・券種（市民/市外）・団体/個人','in dom loc'],
    ['決済データ','クレジット/QR（加盟店別・国籍別）','店舗×日','消費額・業種・国籍・時間帯','in dom'],
    ['宿泊データ','宿泊旅行統計・OTA・ホテルPMS','施設×日','宿泊数・国籍・宿泊日数・単価','in dom'],
    ['交通データ','JR/山陽電鉄 改札・IC / 高速道路 IC / 駐車場 / 港','地点×1h','流入ゲート別 到着・出発量','in dom loc'],
    ['Wi-Fi・ビーコン・カメラ','駅北口・大手前通り・城内AIカメラ','地点×5分','通行量・滞留・待ち行列長','in dom loc'],
    ['SNS・口コミ','Instagram / Google / TripAdvisor','投稿×日','関心スポット・満足度・言語','in dom'],
  ];
  const tables = [
    ['visitor_od','出発地→到着ゲート→帰路の1日OD','date, seg, origin, gate, dest, count'],
    ['dwell_mesh','500mメッシュ×時間帯の滞在人数','date, hour, mesh_id, seg, count'],
    ['dwell_mesh_fine','250m/125mメッシュの滞在人数（Wi-Fi・カメラ・入城券で補完）','date, hour, mesh_id, mesh_level, seg, count'],
    ['trip_trace','トリップ復元した移動軌跡（GPS-OD相当）','trip_id, seq, ts, lat, lon, mesh_id, stop_flag'],
    ['stay_floor','施設×階×時間帯の滞在人数（気圧センサ・BLE・階別カメラ）','date, hour, facility_id, floor, count'],
    ['poi_visit','スポット別 立寄り・滞在時間','date, poi_id, seg, visits, avg_dwell'],
    ['castle_entry','入城ログ・ゾーン混雑・待ち','ts, ticket_type, zone, occupancy, wait'],
    ['lodging','宿泊数・宿泊地・国籍','date, facility, seg, nights, adr'],
    ['spend','消費額（業種×国籍×時間帯）','date, hour, category, seg, amount'],
    ['transit_gate','ゲート別 流入・流出','date, hour, gate, in, out'],
    ['dim_poi / dim_origin','マスタ（POI・出発地・セグメント）','id, name, lat, lon, category'],
  ];
  return `<div class="bd-head"><h2>来訪者DB 構成<small>姫路城〜姫路市全体を1つの「来訪者データ基盤」に統合するイメージ</small></h2><button class="bd-x" id="bd-close">✕ 閉じる</button></div>
    <div class="mcard"><h4>パイプライン</h4><div class="flowmap">
      <div class="st"><b>① 収集</b>位置情報・決済・入城券・宿泊・交通・SNS をAPI/バッチで取得</div><div class="ar">→</div>
      <div class="st"><b>② 統合</b>500mメッシュ／POI／ゲート／セグメントの共通キーで名寄せ・匿名加工</div><div class="ar">→</div>
      <div class="st"><b>③ 分析</b>OD推定・滞在時間・回遊・宿泊転換・混雑予測（KDE/待ち行列モデル）</div><div class="ar">→</div>
      <div class="st"><b>④ 可視化</b>本ダッシュボード（L0/L1/L2）・分析ボード・月次レポート・現場アラート</div></div></div>
    <div class="mcard"><h4>データソース候補<span>粒度と得られる項目</span></h4><div class="tbl-wrap"><table class="db"><thead><tr><th>ソース</th><th>提供元候補</th><th>粒度</th><th>得られる項目</th><th>対象</th></tr></thead><tbody>
      ${src.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4].split(' ').map(t=>`<span class="tag ${t}">${SEG[t].name}</span>`).join('')}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="mcard"><h4>テーブル構成（論理スキーマ）</h4><div class="schema">${tables.map(t=>`<div class="tb"><b>${t[0]}</b><i>${t[1]}</i><i class="k">${t[2]}</i></div>`).join('')}</div></div>
    <div class="mcard"><h4>本ダッシュボードの各画面が読むテーブル</h4><div class="legend">
      <div class="li"><span class="tag gold">L0 広域流入</span> visitor_od × transit_gate × dim_origin</div>
      <div class="li"><span class="tag gold">L1 市内回遊・滞留</span> dwell_mesh × poi_visit × lodging</div>
      <div class="li"><span class="tag gold">L2 姫路城</span> castle_entry（ゾーン混雑・待ち時間・入城制限）</div>
      <div class="li"><span class="tag gold">OD分析 / 分析ボード</span> visitor_od × dwell_mesh × spend</div></div>
      <div class="insight">まず<b>携帯位置情報＋入城券データ</b>の2ソースで L0〜L2 の骨格が成立。決済・宿泊は第2フェーズで追加し「消費・宿泊転換」を定量化する段階設計。</div></div>`;
}
function setDB(on){
  dbOn = on;
  document.getElementById('db-toggle').classList.toggle('active', on);
  if(on){ boardOn=false; propOn=false; document.getElementById('board-toggle').classList.remove('active'); document.getElementById('prop-toggle').classList.remove('active'); board.innerHTML = dbHTML(); board.style.display='block'; document.getElementById('bd-close').onclick=()=>setDB(false); }
  else board.style.display='none';
}
document.getElementById('db-toggle').onclick = ()=> setDB(!dbOn);
/* ================= 提案骨子（世界遺産 姫路城 × 姫路市 来訪者DB） ================= */
let propOn=false;
function propHTML(){
  const step = (n, t, body)=> `<div class="step"><div class="sn">${n}</div><div><b>${t}</b><div>${body}</div></div></div>`;
  return `<div class="bd-head"><h2>提案骨子<small>世界遺産 姫路城 × 姫路市 来訪者DB — 「誰が・どこから・どこに滞留し・どこへ帰ったか」を日次で見える化する</small></h2><button class="bd-x" id="bd-close">✕ 閉じる</button></div>
  <div class="mcard"><h4>① 現状と課題<span>公表統計から読み取れること</span></h4>
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">${kpi('157<small> 万人</small>','2025年度 入城者（過去最多圏）',true)}${kpi('35<small> %</small>','外国人比率（54.7万人）')}${kpi('30% / 14%','市内宿泊率（日本人 / 外国人）')}${kpi('大阪45%・岡山20%','日本人の「次の訪問先」')}${kpi('15,000<small> 人/日</small>','大天守 入城上限（桜・GWに到達）')}${kpi('年4回','現状の実測（対面アンケート 約850人）')}</div>
    <div class="insight" style="margin-top:10px">来訪者は増え、構成は季節で大きく変わる（4月は外国人42%、11月は28%）。しかし「姫路城→大阪／岡山へ抜ける通過型」で、<b>まちなかの滞在は30分程度、宿泊は2〜3割</b>。判断材料は年4回のアンケートと年次集計に留まり、<b>日次・時間帯・回遊・帰路を継続的に測る仕組みがない</b>。2026年3月に入城料が¥2,500（市民¥1,000）へ改定され、日時指定デジタルチケットも始まった今が、データ基盤を作る好機。</div></div>
  <div class="mcard"><h4>② 提案<span>姫路城〜姫路市全体の「来訪者DB」と 3層ダッシュボード</span></h4>
    <div class="flowmap">
      <div class="st"><b>L0 広域流入</b>路線・高速道路・航路・空港ごとの流入量と経由都市。誰が・どこから・どのルートで</div><div class="ar">→</div>
      <div class="st"><b>L1 市内回遊・滞留</b>500mメッシュ×時間帯の滞留、回遊先の立寄率、滞在時間、帰路先</div><div class="ar">→</div>
      <div class="st"><b>L2 姫路城</b>ゾーン別混雑、大天守の待ち時間、入城制限・時間指定枠の稼働</div><div class="ar">→</div>
      <div class="st"><b>分析ボード</b>構成・消費・季節・帰路のチャートと、提案書へそのまま貼れる図表</div></div>
    <div class="insight" style="margin-top:10px">核となるデータは2つ。<b>入城券（デジタルチケット）の券売・入場ログ</b>で「いつ・誰が（市民/市外・団体）・何人」を正確に、<b>携帯位置情報（GPS非集計OD）</b>で「どこから来て・どこに滞留し・どこへ帰ったか」を面的に。総務省の令和6年3月調査で姫路市中心市街地のGPSデータ（約27万ID）を購入・分析した先例があり、<b>技術的にも調達面でも実現性が確認されている</b>。</div></div>
  <div class="mcard"><h4>③ 実測化ロードマップ<span>提案 2026年10月 → 2028年度 運用定着</span></h4>
    <div class="roadmap">
      ${step('Phase 0','提案・要件定義（2026年10月〜12月）','本ダッシュボードで完成イメージを合意。データ提供元（券売システム・位置情報事業者・宿泊統計）と粒度・匿名加工の方針を確定')}
      ${step('Phase 1','骨格の実測化（2027年1月〜6月）','券売データ＋GPS位置情報で L0〜L2 を実測値に置換。桜（4月）・GW の混雑をリアルデータで可視化し、時間指定枠の配分に反映')}
      ${step('Phase 2','消費・宿泊の接続（2027年7月〜2028年3月）','決済（国籍別）・宿泊（PMS/OTA）・Wi-Fi/カメラを追加。市内宿泊転換率・回遊+1スポット・消費額を KPI 化。周遊券・夜間観光の効果測定')}
      ${step('Phase 3','予測・運用（2028年度〜）','混雑予測と現場アラート、券売枠の動的配分、帰路先（大阪・岡山）と連携した周遊施策の効果検証。市・DMO・事業者で共有する月次レポート')}
    </div></div>
  <div class="mcard"><h4>④ 施策への接続とKPI<span>現状値（公表統計）→ 目標（仮置き）</span></h4>
    <div class="tbl-wrap"><table class="db"><thead><tr><th>施策</th><th>DBで測るもの</th><th>現状（出典）</th><th>目標（案）</th></tr></thead><tbody>
      <tr><td>時間指定枠の配分・混雑分散</td><td>大天守 待ち時間、時間帯別入城、ゾーン混雑</td><td>桜・GW 待ち2〜3時間（公式FAQ）</td><td>最大待ち 60分以下</td></tr>
      <tr><td>市内宿泊への転換（夜間開城・ライトアップ・周遊券）</td><td>宿泊地・宿泊日数・夜間滞留</td><td>日本人30.5%・外国人13.9%（観光動向調査）</td><td>外国人 +5pt（年 約2.7万泊）</td></tr>
      <tr><td>回遊 +1スポット（好古園・西の丸・商店街・書写山）</td><td>立寄率・滞在時間・回遊経路</td><td>外国人「城以外の施設」42%、まちなか滞在30分（総務省）</td><td>55%・+45分</td></tr>
      <tr><td>入城料改定の効果検証</td><td>市民/市外別 入城数・収入・満足度</td><td>¥2,500/¥1,000（2026年3月〜）</td><td>収入 約+20億円/年 の実測</td></tr>
      <tr><td>帰路先との周遊連携（大阪・岡山・広島）</td><td>前後訪問地・交通手段・OD</td><td>帰路 大阪45%・岡山20%（日本人）</td><td>姫路発の周遊商品 送客数</td></tr>
    </tbody></table></div></div>
  <div class="mcard"><h4>⑤ 体制・留意点</h4><div class="hint" style="font-size:11px">
    ・<b>個人情報</b>: 位置情報は事業者側で匿名加工済みの非集計OD／メッシュ集計を利用。券売データは統計目的の集計値に限定。<br>
    ・<b>データ費用</b>: 位置情報データは対象期間・粒度で価格が決まる（総務省事例は約2年半分を一括購入）。Phase 1 は桜〜GW を含む半年分から開始。<br>
    ・<b>推進体制</b>: 姫路市（観光・姫路城管理）× 姫路観光コンベンションビューロー（DMO）× 券売システム事業者 × 分析・可視化（XBUILD）。<br>
    ・<b>横展開</b>: 同じスキーマで書写山・セントラルパーク・灘のけんか祭りなど市内全域へ拡張可能。</div></div>
  <div class="mcard"><h4>出典</h4><div class="legend" style="gap:5px">${SOURCES.map(s=>`<div class="li" style="align-items:flex-start"><div class="sw" style="background:var(--gold);margin-top:3px"></div><a href="${s[1]}" target="_blank" rel="noopener" style="color:var(--sub);text-decoration:underline dotted">${s[0]}</a></div>`).join('')}</div></div>`;
}
function setProp(on){
  propOn = on;
  document.getElementById('prop-toggle').classList.toggle('active', on);
  if(on){ boardOn=false; dbOn=false; document.getElementById('board-toggle').classList.remove('active'); document.getElementById('db-toggle').classList.remove('active');
    board.innerHTML = propHTML(); board.style.display='block'; document.getElementById('bd-close').onclick=()=>setProp(false); }
  else board.style.display='none';
}
document.getElementById('prop-toggle').onclick = ()=> setProp(!propOn);


/* ================= インタラクション（ホバー / クリック / キー） ================= */
const tip = document.getElementById('tip');
const raycaster = new THREE.Raycaster();
const mouseV = new THREE.Vector2();
function pick(e, targets, recursive){
  const r = el.getBoundingClientRect();
  mouseV.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  raycaster.setFromCamera(mouseV, camera);
  return raycaster.intersectObjects(targets, recursive);
}
const NAMED = [];
function collectNamed(){ NAMED.length=0; [siteGroup, wideGroup, tourGroup, zoneGroup].forEach(g=> g.traverse(o=>{ if(o.userData && o.userData.name && o.visible !== false) NAMED.push(o); })); }
collectNamed();
let downXY=null, hoverT=0;
el.addEventListener('pointerdown', e=>{ downXY=e.button===0?[e.clientX, e.clientY]:null; });
el.addEventListener('pointermove', e=>{
  if(grab.on || ctrl.rotating){tip.style.display='none';el.style.cursor='grabbing';return;}
  const now = performance.now(); if(now-hoverT < 40) return; hoverT=now;
  if(meshTip(e)){ el.style.cursor='grab'; return; }
  const targets = NAMED.filter(o=> o.visible && o.parent && o.parent.visible);
  const hits = pick(e, targets, false);
  if(hits.length){
    const o = hits[0].object, u=o.userData;
    tip.style.display='block'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY+10)+'px';
    if(u.castle) tip.innerHTML = `<span class="t-nm" style="color:var(--gold)">${u.name}</span><br>世界遺産（1993年登録）・国宝。現在 城内滞留 ${fmt(STATS.inCastle*AG_SCALE)}人<br><b style="color:var(--gold)">クリックで城内（L2）へ</b>`;
    else if(u.hotel) tip.innerHTML = `<span class="t-nm">${u.name}</span><span style="color:var(--sub)">｜宿泊</span><br>${u.desc}`;
    else if(u.poi) tip.innerHTML = `<span class="t-nm">${u.name}</span><span style="color:var(--sub)">｜${u.catL}</span><br>${u.desc}${u.dwell?`<br><span style="color:var(--sub)">平均滞在 約${u.dwell}分</span>`:''}`;
    else if(u.origin) tip.innerHTML = `<span class="t-nm">${u.name}</span><span style="color:var(--sub)">｜出発地</span><br>${u.desc}`;
    else if(u.zone){ const s=zoneStats().find(z=>z.z.n===u.name); tip.innerHTML = `<span class="t-nm" style="color:var(--gold)">${u.name}</span><br>${u.desc}<br>現在 約${fmt(s.occ)}人${s.wait>0?`　待ち 約${Math.round(s.wait)}分`:''}`; }
    else tip.innerHTML = `<span class="t-nm">${u.name}</span>${u.desc?'<br>'+u.desc:''}`;
    el.style.cursor = u.castle ? 'pointer' : 'grab';
    return;
  }
  tip.style.display='none'; el.style.cursor='grab';
});
addEventListener('pointerup', e=>{
  if(!downXY) return;
  const moved = Math.hypot(e.clientX-downXY[0], e.clientY-downXY[1]); downXY=null;
  if(moved>5) return;
  if(typeof meshClick==='function' && meshClick(e)) return;   // メッシュ表示中はセルの詳細を優先
  if(level!=='castle'){
    const hits = pick(e, CASTLE_MESHES, false);
    if(hits.length){ toast('姫路城 城内（L2）へ移動します'); setLevel('castle'); return; }
  }
  const hb = pickBuilding(e); if(hb) showBuildingCard(hb, e); else hideBuildingCard();
});
/* 建物情報カード（PLATEAU 属性） */
const bcard = document.getElementById('bcard');
function hideBuildingCard(){ if(bcard) bcard.style.display='none'; }
function showBuildingCard(hb, e){
  const b = hb.b, inf = plateauInfo(b); if(!bcard) return;
  const code = (typeof meshCode==='function') ? meshCode(inf.lat, inf.lon, 250) : '';
  bcard.innerHTML = `<div class="bc-h"><b>${inf.name || (inf.castle ? '姫路城 城郭内の建造物' : USAGE_NAME[b.u] || '建物')}</b><button class="bd-x" id="bc-close">✕</button></div>
    <div class="bc-g"><span>建物ID</span><b>${inf.id}</b><span>用途</span><b>${inf.usage}</b><span>高さ（計測）</span><b>${inf.h.toFixed(1)} m</b><span>階数</span><b>${inf.storeys ? inf.storeys+' 階' : '—'}</b><span>建築面積</span><b>${fmt(inf.area)} m²</b><span>地盤高</span><b>T.P. ${inf.ground.toFixed(1)} m</b><span>LOD</span><b>${inf.lod}</b><span>250mメッシュ</span><b>${code}</b></div>
    <div class="bc-src">出典: 国土交通省 PLATEAU 姫路市 2023年度（CityGML 仕様4.1）。人流との結合は建物ID × 250mメッシュで行う想定</div>`;
  bcard.style.display='block'; bcard.style.left=Math.min(innerWidth-330, e.clientX+16)+'px'; bcard.style.top=Math.min(innerHeight-260, e.clientY+12)+'px';
  document.getElementById('bc-close').onclick = hideBuildingCard;
}
addEventListener('keydown', e=>{
  if(e.key==='Escape'){ if(boardOn) setBoard(false); else if(dbOn) setDB(false); else if(propOn) setProp(false); else if(level==='castle') setLevel('city'); }

});


/* ================= タイムライン ================= */
const slider=document.getElementById('tl-slider'), clockEl=document.getElementById('tl-clock'), phaseEl=document.getElementById('tl-phase'), scnEl=document.getElementById('tl-scn'), playBtn=document.getElementById('tl-play');
playBtn.onclick = ()=>{ timeState.playing=!timeState.playing; playBtn.textContent = timeState.playing ? '❚❚' : '▶'; if(timeState.playing && timeState.min>=1080){ timeState.min=DAY0; resetSim(); } };
/* 時刻選択（00:00〜23:00）・目盛クリック・速度 ×0.5/×1/×2/×4 */
const hourSel=document.getElementById('tl-hour');
for(let h=0;h<24;h++){ const o=document.createElement('option'); o.value=String(h*60-360); o.textContent=String(h).padStart(2,'0')+':00'; hourSel.appendChild(o); }
hourSel.onchange=()=>{ slider.value=hourSel.value; slider.oninput(); };
document.querySelectorAll('#tl-marks span[data-min]').forEach(sp=> sp.onclick=()=>{ slider.value=sp.dataset.min; slider.oninput(); });
document.querySelectorAll('[data-tspeed]').forEach(b=> b.onclick=()=>{ timeState.speed=+b.dataset.tspeed; document.querySelectorAll('[data-tspeed]').forEach(x=>x.classList.toggle('active', x===b)); document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active', +x.dataset.speed===timeState.speed)); });
slider.oninput = ()=>{
  const target=+slider.value;
  if(target < timeState.min){ resetSim(); timeState.min=DAY0; }
  /* 早送り: エージェント状態を目標時刻まで進める */
  let guard=0; while(timeState.min < target && guard++<2000){ const st=Math.min(2, target-timeState.min); timeState.min+=st; updateAgents(st); if(typeof anaRecord==='function') anaRecord(); }
  timeState.min=target; syncClock(); HEAT.lastT=-99; repaintHeat(); KDE.lastT=-99; updateKDE(true); updateKPIs();
};
function syncClock(){ clockEl.textContent=clockStr(timeState.min); phaseEl.textContent=phaseAt(timeState.min).name; scnEl.textContent=SCN[curScn].name; slider.value=timeState.min; const hv=String(Math.floor((timeState.min+360)/60)*60-360); if(hourSel.value!==hv) hourSel.value=hv; }

/* ================= メインループ ================= */
let lastT=performance.now(), lastKpi=0;
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.1,(now-lastT)/1000); lastT=now;
  updateTween(now);
  if(timeState.playing){
    timeState.min += dt*timeState.speed;
    if(timeState.min>=1080){ timeState.min=1080; timeState.playing=false; playBtn.textContent='▶'; }
    syncClock();
  }
  const dtMin = timeState.playing ? dt*timeState.speed : 0;
  const visualKey=segFilter+'|'+LAYER_STATE.agents+'|'+level; if(dtMin>0 || loop.visualKey!==visualKey){updateAgents(dtMin);loop.visualKey=visualKey;}
  if(dtMin>0){ if(heatMode!=='off') repaintHeat(); }
  updateFlow3D(dtMin, now); updatePlateauLOD(); updateFlowVis(dtMin, now);
  if(level==='castle') updateCastleZones(dtMin);
  updateArcs(dt);
  if(odMode && level!=='castle') updateKDE(false);
  updateChevrons(dt);
  beam.material.opacity = 0.07 + 0.05*Math.sin(now/900);
  castleGlow.material.opacity = 0.10 + 0.05*Math.sin(now/700);
  if(level!=='wide'){ ROUTES.forEach(r=>{ if(!r.rib) return; const u=r.rib.uni; u.uTime.value += dt*0.9; const k=Math.min(1, (r.uses||0)/80); u.uAct.value = 0.10 + 0.55*k; u.uFlowW.value = 0.16 + 0.55*k; }); }
  if(now-lastKpi>500){ lastKpi=now; updateKPIs(); updateFlowPanels(); }
  updateFlowHeads(); renderer.render(scene, camera);
}

/* V9 visual refinement. Supplemental geometry is schematic, not a new survey. */
const urbanDetail=new THREE.Group(); scene.add(urbanDetail);
const fineCloud=new THREE.Group(); scene.add(fineCloud);
const flowGeometry=new THREE.BufferGeometry();flowGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(MAX_AG*3),3));flowGeometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(MAX_AG*3),3));
const flowHeads=new THREE.Points(flowGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,vertexShader:'varying vec3 vColor;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(3500.0 / max(1.0,-mv.z),2.8,6.0);}',fragmentShader:'varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(vColor,vec3(1.),.22),1.-smoothstep(.25,.5,d));}'}));flowHeads.frustumCulled=false;scene.add(flowHeads);
let urbanStyle='hybrid', flowStyle='trail', supplementalCount=0;
const roundTexture=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(16,16,1,16,16,15);g.addColorStop(0,'#fff');g.addColorStop(.4,'#fffe');g.addColorStop(1,'#fff0');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})();
function addFinePoints(positions,colors,size,group){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const m=new THREE.PointsMaterial({size,vertexColors:true,map:roundTexture,transparent:true,opacity:.78,alphaTest:.03,depthWrite:false});
 const p=new THREE.Points(g,m);p.userData.fullCount=positions.length/3;group.add(p);return p;
}
function buildUrbanDetail(){
 const pos=[],cols=[],edge=[],win=[],wc=[],road=[];
 let pointSeen=0, sampleSeed=417;
 const blue=new THREE.Color('#7aacbf'),roof=new THREE.Color('#adc9c9'),warm=new THREE.Color('#d5c7a4');
 function point(x,y,z,c){pointSeen++;if(pos.length<1800000){pos.push(x,y,z);cols.push(c.r,c.g,c.b);return}sampleSeed=(Math.imul(sampleSeed,1664525)+1013904223)>>>0;const k=Math.floor(sampleSeed/4294967296*pointSeen);if(k>=600000)return;pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;cols[k*3]=c.r;cols[k*3+1]=c.g;cols[k*3+2]=c.b}
 function line(a,b){edge.push(...a,...b)}
 const srcB=((typeof PL!=='undefined' && PL.ext.length) ? PL.ext : SCENE_DATA.buildings).map(b=>{ let cx=0,cz=0; b.p.forEach(p=>{cx+=p[0];cz-=p[1]}); cx/=b.p.length; cz/=b.p.length; return {b, d:Math.hypot(cx-CASTLE.x,cz-(CASTLE.z+600))}; }).filter(o=>o.d<=2550).sort((a,b)=>a.d-b.d);
 srcB.forEach((o,bi)=>{ const b=o.b; if(pos.length>=1800000) return;   // 中心に近い建物から順に点予算まで（以前の密度感を維持）
  const poly=b.p;let cx=0,cz=0;poly.forEach(p=>{cx+=p[0];cz-=p[1]});cx/=poly.length;cz/=poly.length;
  const base=TH(cx,cz),h=b.h||8,step=Math.hypot(cx-CASTLE.x,cz-CASTLE.z)<950?1.5:2.8;
  for(let k=0;k<poly.length;k++){
   const a=poly[k],b2=poly[(k+1)%poly.length],len=Math.hypot(b2[0]-a[0],b2[1]-a[1]);if(len<.1)continue;
   const nx=(b2[1]-a[1])/len,nz=(b2[0]-a[0])/len,n=Math.ceil(len/step);
   line([a[0],base+h,-a[1]],[b2[0],base+h,-b2[1]]);
   if(k%2===0)line([a[0],base,-a[1]],[a[0],base+h,-a[1]]);
   for(let j=0;j<n;j++){
    const x=a[0]+(b2[0]-a[0])*j/n,z=-a[1]-(b2[1]-a[1])*j/n;
    for(let y=.4;y<=h;y+=step)point(x,base+y,z,blue);
    if(j%2===0 && h>7)for(let y=4;y<h-1;y+=3.4){win.push(x+nx*.12,base+y,z+nz*.12);const c=(bi+j)%6===0?warm:blue;wc.push(c.r*.75,c.g*.75,c.b*.75)}
   }
  }
  // Triangulate footprints, so roof samples stay within concave building boundaries.
  const contour=poly.map(p=>new THREE.Vector2(p[0],-p[1]));
  const triangles=THREE.ShapeUtils.triangulateShape(contour,[]);
  for(const t of triangles){const a=contour[t[0]],b2=contour[t[1]],c=contour[t[2]];const n=Math.min(70,Math.max(1,Math.ceil(Math.max(a.distanceTo(b2),a.distanceTo(c))/ (step*1.7))));
   for(let u=0;u<=n;u++)for(let v=0;v<=n-u;v++)point(a.x+(b2.x-a.x)*u/n+(c.x-a.x)*v/n,base+h+.12,a.y+(b2.y-a.y)*u/n+(c.y-a.y)*v/n,roof);
  }
 });
 // Deterministically shuffle once: density reduction retains all neighbourhoods.
 let seed=93;for(let i=pos.length/3-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);for(let d=0;d<3;d++){let q=pos[i*3+d];pos[i*3+d]=pos[j*3+d];pos[j*3+d]=q;q=cols[i*3+d];cols[i*3+d]=cols[j*3+d];cols[j*3+d]=q}}
 supplementalCount=pos.length/3;
 addFinePoints(pos,cols,1.15,fineCloud);
 addFinePoints(win,wc,1.5,urbanDetail);
 const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(edge,3));urbanDetail.add(new THREE.LineSegments(eg,new THREE.LineBasicMaterial({color:0x87b2bc,transparent:true,opacity:.22,depthWrite:false})));
 SCENE_DATA.roads.forEach(r=>{
  if(r.c>3)return;const width=r.c===0?5:r.c===1?4:2;
  for(let i=0;i<r.p.length-1;i++){
   const a=r.p[i],b=r.p[i+1];if(Math.hypot(a[0]-CASTLE.x,-a[1]-CASTLE.z)>2600)continue;
   const dx=b[0]-a[0],dz=-b[1]+a[1],L=Math.hypot(dx,dz);if(L<2)continue;
   for(const sign of [-1,1]){const ox=-dz/L*width*sign,oz=dx/L*width*sign;road.push(a[0]+ox,TH(a[0]+ox,-a[1]+oz)+.55,-a[1]+oz,b[0]+ox,TH(b[0]+ox,-b[1]+oz)+.55,-b[1]+oz)}
  }
 });
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(road,3));urbanDetail.add(new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0x65aaa3,transparent:true,opacity:.3,depthWrite:false})));
 MAT.bldg.color.setHex(0x253e4b);MAT.bldgNamed.color.setHex(0x3e5863);MAT.bldg.roughness=1;
}
function syncRefinement(){
 const local=level!=='wide';
 pcGroup.children.forEach(p=>{if(!p.isPoints||p.userData.refined)return;p.userData.refined=true;p.material.blending=THREE.NormalBlending;p.material.opacity=.7;p.material.map=roundTexture;p.material.alphaTest=.025;p.material.needsUpdate=true});
 fineCloud.visible=local&&urbanStyle!=='solid'&&!TRAJ.on;urbanDetail.visible=local;
 if(urbanStyle==='hybrid')fineCloud.children.forEach(p=>p.material.opacity=.42);
 else fineCloud.children.forEach(p=>p.material.opacity=.88);
 trailMesh.visible=local&&LAYER_STATE.agents&&flowStyle==='trail'&&!TRAJ.on;
 routeGroup.visible=local&&LAYER_STATE.agents&&flowStyle==='route';
 agentMesh.visible=false;flowHeads.visible=local&&LAYER_STATE.agents;
 updateFlowHeads();
 document.getElementById('north-arrow').style.transform=`rotate(${-ctrl.sph.theta*180/Math.PI}deg)`;
 document.getElementById('render-status').textContent=`${pcMode?'点群':urbanStyle==='hybrid'?'複合':'立体'}表示 · 人流シミュレーション · 補完点 ${Math.round(supplementalCount*(+document.getElementById('cloud-density').value)/100).toLocaleString()}`;
}
function updateFlowHeads(){
 const fp=flowGeometry.attributes.position.array,fc=flowGeometry.attributes.color.array,mat=agentMesh.instanceMatrix.array,colors=agentMesh.instanceColor.array;
 for(let i=0;i<agentMesh.count;i++){fp[i*3]=mat[i*16+12];fp[i*3+1]=mat[i*16+13]+.5;fp[i*3+2]=mat[i*16+14];fc[i*3]=colors[i*3];fc[i*3+1]=colors[i*3+1];fc[i*3+2]=colors[i*3+2]}
 flowGeometry.setDrawRange(0,agentMesh.count);flowGeometry.attributes.position.needsUpdate=true;flowGeometry.attributes.color.needsUpdate=true;
}
function chooseUrbanStyle(style){
 urbanStyle=style;setPCMode(style==='cloud');
 document.querySelectorAll('[data-style]').forEach(b=>{const active=b.dataset.style===style;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)});
 syncRefinement();
}
function initRefinement(){
 buildUrbanDetail();timeState.speed=3;
 document.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>chooseUrbanStyle(b.dataset.style));
 document.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>{flowStyle=b.dataset.flow;document.querySelectorAll('[data-flow]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});syncRefinement()});
 document.getElementById('cloud-density').oninput=e=>{const ratio=+e.target.value/100;fineCloud.children.forEach(p=>p.geometry.setDrawRange(0,Math.floor(p.userData.fullCount*ratio)));document.getElementById('density-value').value=e.target.value+'%';syncRefinement()};
 document.getElementById('flow-weight').oninput=e=>{trailMesh.material.opacity=+e.target.value/100;document.getElementById('flow-value').value=e.target.value+'%'};
 document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{timeState.speed=+b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});document.querySelectorAll('[data-tspeed]').forEach(x=>x.classList.toggle('active', +x.dataset.tspeed===timeState.speed))});
 document.getElementById('drag-mode').onclick=()=>{endGrab();primaryDragMode=primaryDragMode==='rotate'?'pan':'rotate';const b=document.getElementById('drag-mode');b.textContent=primaryDragMode==='rotate'?'回転中':'移動中';b.setAttribute('aria-pressed',primaryDragMode==='rotate');b.setAttribute('aria-label',primaryDragMode==='rotate'?'左ドラッグは回転。押すと移動に切替':'左ドラッグは地図を掴んで移動。押すと回転に切替');toast(primaryDragMode==='rotate'?'回転モード：左ドラッグで地球儀のように回す（横＝360度・縦＝真上〜真横）。右ドラッグ＝移動':'移動モード：ドラッグで地図を引っ張る。握って待ってから（⟳）ドラッグ／握ったままホイール＝回転・傾き',3200)};
 document.getElementById('view-side').onclick=()=>flyTo(ctrl.target.clone(),ctrl.sph.radius,ctrl.maxPhi,ctrl.sph.theta,700);
 document.getElementById('view-bird').onclick=()=>flyTo(ctrl.target.clone(),ctrl.sph.radius,0.85,ctrl.sph.theta,700);
 document.getElementById('view-ground').onclick=()=>flyTo(ctrl.target.clone(),Math.min(ctrl.sph.radius,650),1.40,ctrl.sph.theta,800);
 document.getElementById('view-eye').onclick=()=>flyTo(ctrl.target.clone(),170,1.545,ctrl.sph.theta,900);
 document.getElementById('view-home').onclick=()=>setLevel('city');
 document.getElementById('view-top').onclick=()=>flyTo(ctrl.target.clone(),ctrl.sph.radius,ctrl.minPhi,ctrl.sph.theta,700);
 document.getElementById('view-near').onclick=()=>{setLevel('city',false);flyTo(new THREE.Vector3(CASTLE.x,TH(CASTLE.x,CASTLE.z+650),CASTLE.z+650),1250,1.06,-.14,1000)};
 document.getElementById('view-plus').onclick=()=>flyTo(ctrl.target.clone(),ctrl.sph.radius*.72,ctrl.sph.phi,ctrl.sph.theta,350);
 document.getElementById('view-minus').onclick=()=>flyTo(ctrl.target.clone(),ctrl.sph.radius*1.38,ctrl.sph.phi,ctrl.sph.theta,350);
 document.getElementById('view-focus').onclick=()=>{document.body.classList.toggle('focus-map');document.getElementById('view-focus').setAttribute('aria-pressed',document.body.classList.contains('focus-map'))};
 const studio=document.getElementById('studio');
 document.getElementById('studio-hide').onclick=()=>{studio.style.display='none'};
 document.getElementById('view-settings').onclick=()=>{document.body.classList.remove('focus-map');studio.style.display=getComputedStyle(studio).display==='none'?'block':'none';if(innerWidth<=760 && studio.style.display==='block'){panelEl.classList.add('collapsed');panelTab.style.display='block'}};
 addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.target.isContentEditable||e.target.closest('[role=button]'))return;if(e.code==='Space'){e.preventDefault();playBtn.click()}if(e.key.toLowerCase()==='f')document.getElementById('view-focus').click()});
 document.querySelectorAll('.crumb').forEach(b=>{b.tabIndex=0;b.setAttribute('role','button');b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}})});
 document.querySelectorAll('.studio-seg button').forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('active')));
 if(innerWidth<=760){panelEl.classList.add('collapsed');panelTab.style.display='block'}
 document.getElementById('pc-toggle').addEventListener('click',()=>{urbanStyle=pcMode?'cloud':'hybrid';document.querySelectorAll('[data-style]').forEach(b=>{b.classList.toggle('active',b.dataset.style===urbanStyle);b.setAttribute('aria-pressed',b.dataset.style===urbanStyle)});syncRefinement()});
 syncRefinement();setInterval(syncRefinement,150);
}

/* 初期化 */
applyLayers();
setLevel('city', false);
ctrl.target.set(CASTLE.x, TH(CASTLE.x,CASTLE.z), CASTLE.z); ctrl.sph.set(2450, 0.88, -0.35); ctrl.apply();
/* 初期状態: 10:30まで進めて「到着ピーク」の姿で開く */
timeState.min = DAY0;
(function warmup(){ let g=0; while(timeState.min < 270 && g++<800){ timeState.min += 2; updateAgents(2); } syncClock(); })();
renderPanel();
initRefinement();
toast('操作: ドラッグ＝地図を掴んで引っ張る ／ 握って少し待つ（⟳）→ドラッグ、または握ったままホイール＝回転・真上〜真横 ／ スクロール＝ズーム ／ ダブルクリック＝フォーカス。▶ で1日を再生', 5200);
requestAnimationFrame(loop);
window.__twin={ctrl,camera,groundAt,PL,MESH,TRAJ,FLOORS,FLOWVIS,HEATV,FLOWA,OD,ANA,setFlowMode,setMesh,setTraj,setFloors,setLevel,timeState,agents,STATS,get level(){return level}};
window.twinDiagnostics=()=>({db:(window.twinDb?{on:twinDb.on,ok:twinDb.ok,err:twinDb.err,lod:twinDb.lod,pts:twinDb.ptsN,stat:twinDb.stat,bld:twinDb.bld,bldN:twinDb.bldN,bldL2N:twinDb.bldL2N,kpi:twinDb.kpi,heat:twinDb.heat.length/3,flows:FLOWA.rows.length}:null),mesh:MESH.on,meshCells:MESH.cells.length,traj:TRAJ.on,trajSegs:TRAJ.n,floors:FLOORS.on,points:supplementalCount,agents:agents.length,trailVisible:trailMesh.visible,routeVisible:routeGroup.visible,level,phi:ctrl.sph.phi,time:timeState.min,style:urbanStyle,primaryDragMode,target:ctrl.target.toArray(),theta:ctrl.sph.theta,castle:[CASTLE.x,CASTLE.z],cloudVisible:fineCloud.visible,heads:flowGeometry.drawRange.count});
})();
</script>
</body>
</html>
