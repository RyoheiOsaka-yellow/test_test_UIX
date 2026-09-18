
/* ================= OD分析 — 広域アーク（どこから来たか）＋ ガウスKDE（どこに滞留したか） ================= */
let odMode = false;
const odGroup = new THREE.Group(); odGroup.visible=false; scene.add(odGroup);
const wideGroup = new THREE.Group(); scene.add(wideGroup);   // L0 常時: 出発地ノード＋アーク

/* 地図外 出発地ノード */
ORIGINS.forEach(o=>{
  const col = SEG[o.seg].col;
  const ph = 80 + o.share*1400;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(55, 70, ph, 8),
    new THREE.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:0.35, roughness:0.6}));
  pole.position.set(o.x, ph/2, o.z);
  pole.userData = {name:o.name, origin:true, desc:`${SEG[o.seg].name} ｜ ${o.via} ｜ 到着ゲート: ${GATES[o.gate].name}`};
  o.pole = pole;
  wideGroup.add(pole);
  const lb = makeLabel(`${o.name}`, 230, hx6(col)); lb.position.set(o.x, ph+260, o.z); o.lb=lb; wideGroup.add(lb);
  const lb2 = makeLabel(`${SEG[o.seg].name} ${Math.round(o.share*100)}%`, 150, '#c8cede', 500); lb2.position.set(o.x, ph+90, o.z); o.lb2=lb2; wideGroup.add(lb2);
});
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
/* 流入アーク: 出発地 → ゲート（L0） / 帰路アーク: ゲート → 出発地（退場時間帯） */
const ARR_ARCS = ORIGINS.map(o=>{ const g=GATES[o.gate]; const a=buildArc(o, g, SEG[o.seg].col, o.share*0.5, wideGroup, 0.12); a.o=o; a.dir='arr'; return a; });
const DEP_ARCS = [];
SEG_KEYS.forEach(seg=>{
  DEST[seg].forEach(d=>{
    const o = ORIGIN_BY_ID[d[0]]; if(!o) return;
    const g = GATES[o.gate];
    const a = buildArc(g, o, SEG[seg].col, d[2]*0.35, wideGroup, 0.20); a.o=o; a.seg=seg; a.dir='dep'; a.share=d[2]; DEP_ARCS.push(a);
  });
});
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
function updateArcs(dt){
  const t = timeState.min;
  const aw = 0.25 + sstep(30,120,t)*(1-sstep(420,560,t));
  const dw = sstep(500,600,t)*(1-sstep(880,1000,t));
  const tw = sstep(240,360,t)*(1-sstep(640,760,t));
  const wideOn = level==='wide' ? 1 : 0;
  ARR_ARCS.forEach(a=> a.uni.uAct.value = (segByFilter(a.o.seg) ? 1 : 0.08) * aw * wideOn);
  DEP_ARCS.forEach(a=> a.uni.uAct.value = (segByFilter(a.seg) ? 1 : 0.08) * dw * wideOn);
  CITY_ARCS.forEach(a=> a.uni.uAct.value = odMode ? (a.dir==='arr' ? aw : tw) : 0);
  arcUnis.forEach(u=> u.uTime.value += dt*0.55);
  ORIGINS.forEach(o=>{ const on = segByFilter(o.seg); o.pole.material.opacity = on?1:0.25; o.pole.material.transparent = !on; o.lb.material.opacity = on?1:0.3; o.lb2.material.opacity = on?1:0.3; });
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
    pos.setY(i, k*KDE.maxH);
    c.copy(heatC(Math.min(1, k*1.1))).multiplyScalar(Math.min(1, 0.08+k*1.4));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  pos.needsUpdate=true; col.needsUpdate=true;
}

/* ================= 🗾 観光導線（姫路駅ハブ発・周辺観光地） ================= */
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
  t.wp = r.path; t.seg = r.seg; t.total = r.total;
  const v3 = t.wp.map(p=>new THREE.Vector3(p[0], 2.6, p[1]));
  const glow = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v3), new THREE.LineBasicMaterial({color:t.col, transparent:true, opacity:0.9}));
  tourGroup.add(glow);
  const glow2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v3), new THREE.LineBasicMaterial({color:t.col, transparent:true, opacity:0.35, blending:THREE.AdditiveBlending, depthWrite:false}));
  glow2.position.y = 1; tourGroup.add(glow2);
  const cgeo=new THREE.ConeGeometry(7, 20, 5);
  const cmat=new THREE.MeshBasicMaterial({color:t.col, transparent:true, opacity:0.9});
  const nCh=Math.max(4, Math.round(t.total/380));
  for(let i=0;i<nCh;i++){ const m=new THREE.Mesh(cgeo, cmat); tourGroup.add(m); chevrons.push({t, m, u:i/nCh}); }
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(6,6,34,6), new THREE.MeshStandardMaterial({color:t.col, emissive:t.col, emissiveIntensity:0.35, roughness:0.6}));
  pole.position.set(e.x, 17, e.z); pole.userData.name = t.name+'（'+t.via+'）';
  tourGroup.add(pole);
  const lb=makeLabel(t.name+'  '+t.time, 13, hx6(t.col)); lb.position.set(e.x, 74, e.z); tourGroup.add(lb);
  const lb2=makeLabel(t.spots, 9, '#c8cede', 500); lb2.position.set(e.x, 56, e.z); tourGroup.add(lb2);
});
const hub=new THREE.Mesh(new THREE.CylinderGeometry(18,18,3,24), new THREE.MeshBasicMaterial({color:0xff8a1e, transparent:true, opacity:0.55}));
hub.position.set(STN.x, 1.5, STN.z); tourGroup.add(hub);
const hubLb=makeLabel('観光ハブ: JR姫路駅・バスターミナル', 11, '#ff8a1e'); hubLb.position.set(STN.x, 60, STN.z+70); tourGroup.add(hubLb);
const UP=new THREE.Vector3(0,1,0);
function updateChevrons(dt){
  if(!tourGroup.visible) return;
  chevrons.forEach(c=>{
    c.u += dt*46/c.t.total; if(c.u>=1) c.u-=1;
    const d=c.u*c.t.total;
    const s=sampleRoute(c.t, d), s2=sampleRoute(c.t, Math.min(c.t.total, d+8));
    c.m.position.set(s[0], 6, s[1]);
    const dir=new THREE.Vector3(s2[0]-s[0],0,s2[1]-s[1]); if(dir.lengthSq()>0){ dir.normalize(); c.m.quaternion.setFromUnitVectors(UP, dir); }
  });
}

/* ================= ◆ 点群ビュー（建物・道路をポイント化したデジタルレイヤー） ================= */
let pcMode=false, pcBuilt=false;
const pcGroup = new THREE.Group(); pcGroup.visible=false; scene.add(pcGroup);
function buildPC(){
  pcBuilt = true;
  const pts=[], cols=[];
  const cw=new THREE.Color(0x66e0ff), cc=new THREE.Color(0xffd166), cr=new THREE.Color(0x3d8fd0);
  SCENE_DATA.buildings.forEach(b=>{
    const h=b.h||8, col = b.k==='castle' ? cc : cw;
    if(b.k!=='castle' && pts.length > 1500000) return;
    const step = b.k==='castle' ? 2.2 : 4.5;
    for(let i=0;i<b.p.length-1;i++){
      const a=b.p[i], q=b.p[i+1]; const L=Math.hypot(q[0]-a[0], q[1]-a[1]); const n=Math.max(1, Math.round(L/step));
      for(let j=0;j<=n;j++){ const x=a[0]+(q[0]-a[0])*j/n, y=a[1]+(q[1]-a[1])*j/n;
        for(let z=0;z<=h;z+=step){ pts.push(x, z, -y); cols.push(col.r, col.g, col.b); } }
    }
  });
  SCENE_DATA.roads.forEach(r=>{
    if(r.c>2) return;
    for(let i=0;i<r.p.length-1;i++){ const a=r.p[i], q=r.p[i+1]; const L=Math.hypot(q[0]-a[0], q[1]-a[1]); const n=Math.max(1, Math.round(L/9));
      for(let j=0;j<n;j++){ pts.push(a[0]+(q[0]-a[0])*j/n, 0.8, -(a[1]+(q[1]-a[1])*j/n)); cols.push(cr.r, cr.g, cr.b); } }
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols),3));
  pcGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({size:1.9, vertexColors:true, transparent:true, opacity:0.85, blending:THREE.AdditiveBlending, depthWrite:false})));
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
  toast(on ? '点群ビュー: ON（建物・道路をデジタルレイヤー表示）' : '通常ビューに戻しました');
}

/* ================= レベル管理 ================= */
let level = 'wide';
const enterHint = document.getElementById('enter-hint');
function setLevel(lv, fly=true){
  level = lv;
  document.querySelectorAll('.crumb[data-lvl]').forEach(c=>c.classList.toggle('active', c.dataset.lvl===lv));
  zoneGroup.visible = (lv==='castle');
  castleLabel.visible = (lv!=='castle');
  wideGroup.visible = (lv!=='castle');
  odGroup.visible = odMode && lv!=='castle';
  tourGroup.visible = tourMode && lv!=='castle';
  enterHint.style.display = lv==='city' ? 'block' : 'none';
  if(lv==='wide'){ scene.fog.near=12000; scene.fog.far=40000; if(fly) flyTo(new THREE.Vector3(0, 0, 600), 17500, 0.72, -0.35, 1600); }
  if(lv==='city'){ scene.fog.near=6000; scene.fog.far=20000; if(fly) flyTo(new THREE.Vector3(CASTLE.x-100, 0, CASTLE.z+700), 3200, 0.88, -0.55, 1500); }
  if(lv==='castle'){ scene.fog.near=2500; scene.fog.far=9000; if(fly) flyTo(new THREE.Vector3(CASTLE.x-40, 10, CASTLE.z+190), 640, 0.95, -0.35, 1500); }
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
  document.querySelectorAll('#scn-chips .chip').forEach(c=> c.onclick=()=>{ curScn=c.dataset.scn; resetSim(); timeState.min=0; syncClock(); HEAT.lastT=-99; repaintHeat(); renderPanel(); toast(`シナリオ: ${SCN[curScn].name}（入城 想定 ${fmt(SCN[curScn].castle)}人/日）`); });
  document.querySelectorAll('#layer-chips .chip').forEach(c=> c.onclick=()=>{ LAYER_STATE[c.dataset.l]=!LAYER_STATE[c.dataset.l]; c.classList.toggle('active'); applyLayers(); });
  document.querySelectorAll('#heat-chips .chip').forEach(c=> c.onclick=()=>{ heatMode=c.dataset.h; HEAT.lastT=-99; applyLayers(); repaintHeat(); renderPanel(); });
  document.querySelectorAll('[data-tr]').forEach(b=> b.onclick=()=>{ const t=TOURS[+b.dataset.tr]; const e=t.end; flyTo(new THREE.Vector3((e.x+STN.x)/2, 0, (e.z+STN.z)/2), Math.max(1400, t.total*0.9), 0.8, Math.atan2(e.x-STN.x, e.z-STN.z)+Math.PI, 1300); });
  document.querySelectorAll('[data-org]').forEach(b=> b.onclick=()=>{ const o=ORIGIN_BY_ID[b.dataset.org]; flyTo(new THREE.Vector3(o.x*0.55, 0, o.z*0.55), 9000, 0.78, Math.atan2(o.x, o.z)+Math.PI, 1300); });
  const cin=document.getElementById('csv-in'), cbtn=document.getElementById('csv-btn');
  if(cbtn){ cbtn.onclick=()=>cin.click(); cin.onchange=()=>{ const f=cin.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ const n=rd.result.split(/\r?\n/).filter(l=>l.trim()).length-1; toast(`${Math.max(0,n)}行を読み込みました（実データ接続のプレースホルダ：本番はDB直結）`, 3200); }; rd.readAsText(f); }; }
}
function originRows(){
  const rows = ORIGINS.filter(o=> segByFilter(o.seg)).map(o=>{ const mixW = segFilter==='all' ? SCN[curScn].mix[o.seg] : 1; return [o, o.share*mixW]; }).sort((a,b)=>b[1]-a[1]).slice(0, segFilter==='all'?9:8);
  return rows.map(r=>`<button class="mode-btn" data-org="${r[0].id}" style="padding:5px 9px"><div class="dot" style="background:${hx6(SEG[r[0].seg].col)}"></div><div style="flex:1;min-width:0">${r[0].name} <b style="color:var(--txt);font-family:var(--mono);font-weight:500">${(r[1]*100).toFixed(0)}%</b><span class="desc">${r[0].via}</span></div></button>`).join('');
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
  return `<div class="sec"><div class="sec-t"><b>🗾 観光導線</b> — 姫路駅ハブ発 6方面（回遊拡張の仮ルート）</div>
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
      <div class="sec"><div class="sec-t">来訪者セグメント</div>${segChips()}</div>
      <div class="sec"><div class="sec-t">シナリオ（入城者数/日・想定）</div>${scnChips()}</div>
      ${odSec()}${tourSec()}
      <div class="sec"><div class="sec-t">出発地 × 到着ゲート（クリックで視点）</div><div class="mode-list">${originRows()}</div></div>
      <div class="sec"><div class="sec-t">到着ゲート（市内側）</div><div id="gate-rows"></div></div>
      <div class="sec"><div class="sec-t">操作</div><div class="hint">出発地ポールの高さ＝流入シェア。弧は<b>到着（朝）→ 帰路（夕方）</b>で向きが反転します。<b style="color:var(--gold)">L1</b>で市内の滞留、<b style="color:var(--gold)">L2</b>で城内の混雑・待ち時間へ。</div></div>`;
  }
  if(level==='city'){
    pb.innerHTML = `
      <div class="sec"><div class="sec-t"><b>L1</b> 市内回遊・滞留 — どこに・どれだけ滞留したか</div><div class="kpi-grid" id="kpi-main"></div></div>
      <div class="sec"><div class="sec-t">来訪者セグメント</div>${segChips()}</div>
      <div class="sec"><div class="sec-t">シナリオ</div>${scnChips()}</div>
      ${odSec()}${tourSec()}
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
          <button class="chip ${LAYER_STATE.dots?'active':''}" data-l="dots">点描（広域）</button></div></div>
      <div class="sec"><div class="sec-t">凡例</div><div class="legend">
          <div class="li"><div class="sw" style="background:var(--in)"></div>インバウンド　<div class="sw" style="background:var(--dom)"></div>国内（県外）　<div class="sw" style="background:var(--loc)"></div>県内・近隣</div>
          <div class="li"><div class="sw" style="background:#ffd166"></div>世界遺産・史跡　<div class="sw" style="background:#b56ce8"></div>文化施設　<div class="sw" style="background:#e87ca0"></div>商業・食</div>
          <div class="li"><div class="sw" style="background:#4da3ff"></div>交通結節点　<div class="sw" style="background:#3ddc84"></div>自然・公園　<div class="sw" style="background:#35d0c0"></div>宿泊（OSM ${SCENE_DATA.hotels.length}軒）</div>
          <div class="li"><div class="sw" style="background:#d0d6ea"></div>JR　<div class="sw" style="background:#9ec5ff"></div>山陽新幹線　<div class="sw" style="background:#ff9a3d"></div>山陽電鉄　<div class="sw" style="background:#2a5a8a"></div>堀・河川</div>
        </div></div>
      <div class="sec"><div class="sec-t">実データ接続（プレースホルダ）</div>
        <input type="file" id="csv-in" accept=".csv,text/csv" style="display:none"><button class="tool-btn" id="csv-btn">CSVを読み込んで滞留データを上書き</button>
        <div class="hint" style="margin-top:6px">列: date, hour, mesh_id, segment, count（携帯位置情報の500mメッシュ集計を想定）。本番はDB直結で自動更新。</div></div>
      <div class="sec"><div class="sec-t">操作</div><div class="hint">POI・宿泊ピンにホバーで解説。<b style="color:var(--gold)">姫路城をクリック</b>で城内（L2）へ。</div></div>`;
  }
  if(level==='castle'){
    pb.innerHTML = `
      <div class="sec"><div class="sec-t"><b class="g">L2</b> 姫路城 — 城内滞留・待ち行列・入城制限</div><div class="kpi-grid" id="kpi-main"></div></div>
      <div class="sec"><div class="sec-t">来訪者セグメント</div>${segChips()}</div>
      <div class="sec"><div class="sec-t">シナリオ</div>${scnChips()}</div>
      <div class="sec"><div class="sec-t">ゾーン別 滞留・混雑（1ドット＝${AG_SCALE}人）</div><div id="zone-rows"></div></div>
      <div class="sec"><div class="sec-t">入城料（2026年3月〜 二段階料金・想定）</div><div class="legend">
        <div class="li"><div class="sw" style="background:var(--gold)"></div>市外・海外 ¥${FEE.out.toLocaleString()}　<div class="sw" style="background:#8f9cc0"></div>姫路市民 ¥${FEE.resident.toLocaleString()}</div></div></div>
      <div class="sec"><div class="sec-t">インサイト</div><div class="hint">律速点は<b>大天守（入場制限 15,000人/日）</b>と<b>菱の門の券売</b>。桜・GWは12時前後に待ち60分超が発生。入城券の<b>時間指定枠・事前販売</b>と、待ち時間を<b>好古園・西の丸へ振り替える案内</b>が滞留分散の打ち手になります。<kbd>Esc</kbd>で市内へ戻る。</div></div>`;
  }
  bindCommon();
  updateKPIs();
}
function updateKPIs(){
  const k = document.getElementById('kpi-main'); if(!k) return;
  const sc = SCN[curScn];
  const arrTot = STATS.arrived.in+STATS.arrived.dom+STATS.arrived.loc;
  const seg = segFilter;
  const arrSeg = seg==='all' ? arrTot : STATS.arrived[seg];
  const people = n=> fmt(n*AG_SCALE);
  if(level==='wide'){
    const inShare = arrTot ? STATS.arrived.in/arrTot : sc.mix.in;
    k.innerHTML =
      kpi(people(arrSeg)+'<small> 人</small>', `本日累計 来訪（${seg==='all'?'全体':SEG[seg].name}）`) +
      kpi((inShare*100).toFixed(0)+'<small> %</small>', 'インバウンド比率') +
      kpi(people(STATS.inCity), '現在 市内滞在') +
      kpi(phaseAt(timeState.min).name, 'フェーズ');
    const gr = document.getElementById('gate-rows');
    if(gr){ const tot=Math.max(1, Object.values(STATS.byGate).reduce((a,b)=>a+b,0)); gr.innerHTML = barRows(Object.entries(GATES).map(([g,v])=>[v.name.replace('（','<br>（'), (STATS.byGate[g]||0)/tot, hx6(v.col)]).sort((a,b)=>b[1]-a[1])); }
  }
  if(level==='city'){
    const avgDwell = STATS.dwellN ? STATS.dwellSum/STATS.dwellN : 0;
    const kaiyu = STATS.dwellN ? STATS.kaiyu/STATS.dwellN : 0;
    k.innerHTML =
      kpi(people(STATS.inCastle), '現在 城内滞留') +
      kpi(people(STATS.atSpotN||0), '現在 市内回遊先に滞留') +
      kpi(avgDwell ? (avgDwell/60).toFixed(1)+'<small> h</small>' : '—', '平均 市内滞在時間（退出者）') +
      kpi(STATS.dwellN ? (kaiyu*100).toFixed(0)+'<small> %</small>' : '—', '回遊率（城以外にも立寄り）') +
      kpi(people(STATS.staying), '本日 市内宿泊（転換）') +
      kpi(`¥${fmt(STATS.castleEntered*AG_SCALE*FEE.out*0.85/10000)}<small> 万</small>`, '入城料 収入（市外¥2,500 想定）', true);
    const sr = document.getElementById('spot-rows');
    if(sr){ const mx=Math.max(1, ...SPOTS.map(s=>STATS.atSpot[s.n]||0)); sr.innerHTML = barRows(SPOTS.map(s=>[s.n, (STATS.atSpot[s.n]||0)/mx, '#ffd166']).sort((a,b)=>b[1]-a[1]).slice(0,6)).replace(/<b>(\d+)%<\/b>/g, (m,v)=>`<b>${fmt(v/100*mx*AG_SCALE)}</b>`); }
  }
  if(level==='castle'){
    const zs = zoneStats(); const tenshu = zs.find(s=>s.z.n==='大天守'); const gate = zs.find(s=>s.z.n==='入城口（菱の門）');
    const entered = STATS.castleEntered*AG_SCALE;
    k.innerHTML =
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

/* ================= 📊 分析ボード（SVGチャート・サンキー） ================= */
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
function boardHTML(){
  const sc=SCN[curScn];
  const tabs=[['who','誰が・どこから'],['where','どこに滞留'],['back','どこへ帰った'],['when','時間帯・季節']];
  let body='';
  if(boardTab==='who'){
    const pref = [['兵庫県内（姫路市除く）',0.25],['大阪府',0.19],['東京都・首都圏',0.11],['岡山県',0.07],['京都府・奈良県',0.06],['広島県',0.05],['愛知県・中部',0.04],['九州',0.03],['その他',0.20]];
    const trans = [['JR新幹線',0.30],['JR在来線（新快速）',0.32],['自家用車・レンタカー',0.22],['山陽電鉄',0.07],['高速バス・ツアーバス',0.07],['船（姫路港）',0.02]];
    body = `<div class="mcard"><h4>来訪者セグメント構成<span>${sc.name}・入城 ${fmt(sc.castle)}人/日 想定</span></h4>${svgStacked('構成比', [['インバウンド',sc.mix.in,CC.in],['国内（県外）',sc.mix.dom,CC.dom],['県内・近隣',sc.mix.loc,CC.loc]])}
      <div class="insight">季節で構成が変わる：<b>桜・紅葉はインバウンド比率が上がり</b>、GWは国内（県外）に振れる。セグメント別に「滞留先」「帰路」が違うため、構成比が変わるとまちの滞留パターンも変わる。</div></div>
      <div class="mgrid"><div class="mcard"><h4>インバウンド 国・地域別<span>ローミング/入国データ想定</span></h4>${svgHBars(COUNTRIES, 250, ()=>CC.in)}</div>
      <div class="mcard"><h4>国内 都道府県別<span>携帯位置情報 居住地推定</span></h4>${svgHBars(pref, 250, ()=>CC.dom)}</div></div>
      <div class="mcard"><h4>交通手段別 流入<span>駅改札・IC・駐車場・港</span></h4>${svgHBars(trans, 520, (r,i)=>[ '#9ec5ff','#d0d6ea','#8fd0ff','#ff9a3d','#ffd166','#35d0c0'][i])}
      <div class="insight">新幹線＋新快速で<b>6割超が姫路駅に集中</b>。駅北口〜大手前通りが「まちの玄関」であり、ここでの案内・回遊誘導が最も効率的な介入点。</div></div>`;
  } else if(boardTab==='where'){
    const dwell = [['姫路城（城内）',150,'2h30m'],['書写山圓教寺',150,'2h30m'],['アクリエひめじ',90,'1h30m'],['手柄山中央公園',60,'1h00m'],['姫路市立美術館',50,'50m'],['好古園',45,'45m'],['みゆき通り商店街',40,'40m']];
    const visit = SPOTS.map(s=>[s.n, SEG_KEYS.reduce((a,k)=>a+s.p[k]*sc.mix[k],0)]).sort((a,b)=>b[1]-a[1]);
    body = `<div class="mcard"><h4>回遊先 立寄率<span>姫路城以外への立寄り（ダミー）</span></h4>${svgHBars(visit, 520)}</div>
      <div class="mgrid"><div class="mcard"><h4>スポット別 平均滞在時間</h4>${svgHBars(dwell.map(d=>[d[0],d[1],d[2]]), 250)}</div>
      <div class="mcard"><h4>セグメント別 市内滞在時間</h4>${svgHBars([['インバウンド',3.6,'3.6h'],['国内（県外）',4.4,'4.4h'],['県内・近隣',3.1,'3.1h']], 250, (r,i)=>[CC.in,CC.dom,CC.loc][i])}
      <div class="insight">インバウンドは滞在が短く「城のみ」比率が高い。<b>好古園・西の丸・商店街への+1スポット</b>で平均滞在+45分、飲食消費の獲得余地。</div></div></div>
      <div class="mcard"><h4>時間帯別 滞留分布<span>城内 / 市内回遊先 / 移動中</span></h4>${svgDayCurve()}</div>`;
  } else if(boardTab==='back'){
    const lodging = [['日帰り（宿泊なし）',1-sc.stay-0.08],['姫路市内 宿泊',sc.stay],['神戸・大阪・京都 宿泊',0.08]];
    body = `<div class="mcard"><h4>出発地 → 滞留 → 帰路（サンキー）<span>${segFilter==='all'?'全体':SEG[segFilter].name}</span></h4>${svgSankey()}
      <div class="insight">インバウンドは<b>大阪・京都の宿泊拠点へ戻る</b>か<b>広島へ西進</b>する「通過型」が主流。国内（県外）は大阪・神戸への帰路が3割、首都圏帰りが1.5割。<b>姫路市内宿泊は約1割</b>で、ここが観光消費の最大の伸びしろ。</div></div>
      <div class="mgrid"><div class="mcard"><h4>宿泊 / 日帰り</h4>${svgStacked('宿泊形態', [['日帰り',lodging[0][1],CC.sub],['姫路泊',lodging[1][1],'#35d0c0'],['周辺泊',lodging[2][1],CC.dom]], 250)}
      <div class="insight">宿泊転換率 ${(sc.stay*100).toFixed(0)}% → 1pt改善で <b>年間 約${fmt(sc.castle*365*0.01*0.6/1000)}千泊</b>（入城者×稼働日換算・ダミー）。</div></div>
      <div class="mcard"><h4>帰路 上位（全体）</h4>${svgHBars(Object.entries(SEG_KEYS.reduce((acc,seg)=>{ DEST[seg].forEach(d=>{ const k=d[1].replace(/へ.*$/,''); acc[k]=(acc[k]||0)+d[2]*sc.mix[seg]; }); return acc; },{})).sort((a,b)=>b[1]-a[1]).slice(0,7), 250, ()=>CC.sub)}</div></div>`;
  } else {
    const months=[['1月',0.55],['2月',0.6],['3月',0.9],['4月',1.0],['5月',0.95],['6月',0.55],['7月',0.5],['8月',0.7],['9月',0.6],['10月',0.8],['11月',0.95],['12月',0.55]];
    const inMonths=[0.30,0.34,0.36,0.32,0.22,0.30,0.28,0.24,0.30,0.34,0.36,0.30];
    const W=520,H=170,L=30,R=10,T=14,B=26,iw=W-L-R,ih=H-T-B; const bw=iw/12-6;
    const bars=months.map((m,i)=>{ const h=m[1]*ih; const x=L+i*(iw/12)+3; const hin=h*inMonths[i]; return `<rect x="${x.toFixed(1)}" y="${(T+ih-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h-hin).toFixed(1)}" rx="2" fill="${CC.dom}" opacity=".8"/><rect x="${x.toFixed(1)}" y="${(T+ih-hin).toFixed(1)}" width="${bw.toFixed(1)}" height="${hin.toFixed(1)}" rx="2" fill="${CC.in}"/><text x="${(x+bw/2).toFixed(1)}" y="${H-10}" font-size="9" fill="${CC.sub}" text-anchor="middle">${m[0]}</text>`; }).join('');
    body = `<div class="mcard"><h4>月別 入城者数（相対）× インバウンド比率<span>姫路城 入城券データ想定</span></h4><svg class="ch" viewBox="0 0 ${W} ${H}" role="img"><line x1="${L}" y1="${T+ih}" x2="${W-R}" y2="${T+ih}" stroke="${CC.line}"/>${bars}<text x="${L}" y="${T-3}" font-size="9.5" fill="${CC.dom}">■ 国内</text><text x="${L+50}" y="${T-3}" font-size="9.5" fill="${CC.in}">■ インバウンド</text></svg>
      <div class="insight"><b>4月（桜）・11月（紅葉）に二山</b>。夏はインバウンド比率が相対的に下がる（国内の家族連れ）。ライトアップ・夜間開城は「夜の滞留」を作り宿泊転換に効く。</div></div>
      <div class="mcard"><h4>1日の流れ<span>${sc.name}</span></h4>${svgDayCurve()}
      <div class="insight">到着ピーク（9〜11時）と帰路ピーク（16〜18時）の間に<b>正午前後の城内滞留ピーク</b>。大天守の待ち時間はこの山に同期して発生する。</div></div>
      <div class="mcard"><h4>年間ボリューム感（ダミー）</h4><div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">${kpi('約160<small> 万人</small>','年間入城者（想定）',true)}${kpi('約30<small> %</small>','インバウンド比率')}${kpi('約215<small> 万人</small>','市内来訪者（×1.35）')}${kpi('¥'+fmt(1600000*0.85*FEE.out/1e8)+'<small> 億</small>','入城料 収入試算（市外¥2,500）')}</div></div>`;
  }
  return `<div class="bd-head"><h2>📊 分析ボード<small>来訪者DB アウトプットイメージ — 数値はダミー（携帯位置情報・決済・入城券・宿泊データ接続で実測化）</small></h2><button class="bd-x" id="bd-close">✕ 閉じる</button></div>
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
  if(on){ dbOn=false; document.getElementById('db-toggle').classList.remove('active'); renderBoard(); }
}
document.getElementById('board-toggle').onclick = ()=> setBoard(!boardOn);

/* ================= 🗄 DB構成（データソース・スキーマ・パイプライン） ================= */
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
    ['poi_visit','スポット別 立寄り・滞在時間','date, poi_id, seg, visits, avg_dwell'],
    ['castle_entry','入城ログ・ゾーン混雑・待ち','ts, ticket_type, zone, occupancy, wait'],
    ['lodging','宿泊数・宿泊地・国籍','date, facility, seg, nights, adr'],
    ['spend','消費額（業種×国籍×時間帯）','date, hour, category, seg, amount'],
    ['transit_gate','ゲート別 流入・流出','date, hour, gate, in, out'],
    ['dim_poi / dim_origin','マスタ（POI・出発地・セグメント）','id, name, lat, lon, category'],
  ];
  return `<div class="bd-head"><h2>🗄 来訪者DB 構成<small>姫路城〜姫路市全体を1つの「来訪者データ基盤」に統合するイメージ</small></h2><button class="bd-x" id="bd-close">✕ 閉じる</button></div>
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
  if(on){ boardOn=false; document.getElementById('board-toggle').classList.remove('active'); board.innerHTML = dbHTML(); board.style.display='block'; document.getElementById('bd-close').onclick=()=>setDB(false); }
  else board.style.display='none';
}
document.getElementById('db-toggle').onclick = ()=> setDB(!dbOn);

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
el.addEventListener('pointerdown', e=>{ downXY=[e.clientX, e.clientY]; });
el.addEventListener('pointermove', e=>{
  const now = performance.now(); if(now-hoverT < 40) return; hoverT=now;
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
    el.style.cursor = u.castle ? 'pointer' : 'default';
    return;
  }
  tip.style.display='none'; el.style.cursor='default';
});
addEventListener('pointerup', e=>{
  if(!downXY) return;
  const moved = Math.hypot(e.clientX-downXY[0], e.clientY-downXY[1]); downXY=null;
  if(moved>5) return;
  if(level!=='castle'){
    const hits = pick(e, CASTLE_MESHES, false);
    if(hits.length){ toast('姫路城 城内（L2）へ移動します'); setLevel('castle'); }
  }
});
addEventListener('keydown', e=>{
  if(e.key==='Escape'){ if(boardOn) setBoard(false); else if(dbOn) setDB(false); else if(level==='castle') setLevel('city'); }
  if(e.key===' ' && e.target===document.body){ e.preventDefault(); playBtn.click(); }
});

/* ================= タイムライン ================= */
const slider=document.getElementById('tl-slider'), clockEl=document.getElementById('tl-clock'), phaseEl=document.getElementById('tl-phase'), scnEl=document.getElementById('tl-scn'), playBtn=document.getElementById('tl-play');
playBtn.onclick = ()=>{ timeState.playing=!timeState.playing; playBtn.textContent = timeState.playing ? '❚❚' : '▶'; if(timeState.playing && timeState.min>=1080){ timeState.min=0; resetSim(); } };
slider.oninput = ()=>{
  const target=+slider.value;
  if(target < timeState.min){ resetSim(); timeState.min=0; }
  /* 早送り: エージェント状態を目標時刻まで進める */
  let guard=0; while(timeState.min < target && guard++<2000){ const st=Math.min(2, target-timeState.min); timeState.min+=st; updateAgents(st); }
  timeState.min=target; syncClock(); HEAT.lastT=-99; repaintHeat(); KDE.lastT=-99; updateKDE(true); updateKPIs();
};
function syncClock(){ clockEl.textContent=clockStr(timeState.min); phaseEl.textContent=phaseAt(timeState.min).name; scnEl.textContent=SCN[curScn].name; slider.value=timeState.min; }

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
  if(dtMin>0){ updateAgents(dtMin); if(heatMode!=='off') repaintHeat(); }
  if(level==='castle') updateCastleZones(dtMin);
  updateArcs(dt);
  if(odMode && level!=='castle') updateKDE(false);
  updateChevrons(dt);
  beam.material.opacity = 0.07 + 0.05*Math.sin(now/900);
  if(now-lastKpi>500){ lastKpi=now; updateKPIs(); }
  renderer.render(scene, camera);
}

/* 初期化 */
applyLayers();
setLevel('wide', false);
ctrl.target.set(0,0,600); ctrl.sph.set(26000, 0.6, -0.35); ctrl.apply();
flyTo(new THREE.Vector3(0, 0, 600), 17500, 0.72, -0.35, 2200);
/* 初期状態: 10:30まで進めて「到着ピーク」の姿で開く */
(function warmup(){ let g=0; while(timeState.min < 270 && g++<400){ timeState.min += 2; updateAgents(2); } syncClock(); })();
renderPanel();
toast('▶ で1日（06:00→24:00）を再生：流入 → 城内滞留 → 市内回遊 → 帰路 → 夜間。ヘッダーで L0/L1/L2 を切替', 4200);
requestAnimationFrame(loop);
</script>
</body>
</html>
