/* ================= タイムライン（00:00〜24:00） ================= */
const timeState = { min:0, playing:false, speed:6 };   // 実1秒 = 6分（フル再生 3分）
const DAY0 = -360;   // タイムライン起点 00:00（内部の分は 06:00 起点なので -360）
const PHASES = [
  {t:-360, name:'深夜（宿泊者のみ・静穏）'},
  {t:0,   name:'早朝・到着開始'},
  {t:150, name:'到着ピーク（新幹線・新快速）'},
  {t:300, name:'城内滞留ピーク'},
  {t:480, name:'市内回遊（商店街・好古園）'},
  {t:600, name:'帰路ピーク'},
  {t:780, name:'夜間（宿泊者の回遊・ライトアップ）'},
];
function phaseAt(min){ let p=PHASES[0]; for(const ph of PHASES){ if(min>=ph.t) p=ph; } return p; }
function clockStr(min){ const tot=Math.max(0, Math.round(360+min)); const h=Math.floor(tot/60), m=tot%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
/* 到着プロファイル（時刻→相対到着率） */
function arrProfile(min){
  const h = 6 + min/60;
  if(h < 5.5) return 0;
  const pk = Math.exp(-Math.pow((h-9.8)/1.6, 2)) + 0.55*Math.exp(-Math.pow((h-13.2)/1.5, 2)) + 0.08*Math.exp(-Math.pow((h-16.5)/1.2, 2));
  const night = SCN[curScn].night * 0.5 * Math.exp(-Math.pow((h-19.0)/1.1, 2));
  return pk + night;
}
let ARR_NORM = 1;
function calcArrNorm(){ let s=0; for(let m=-360;m<1080;m+=2) s += arrProfile(m)*2; ARR_NORM = s || 1; }
calcArrNorm();

/* ================= 道路グラフ & 経路探索（A* / 二分ヒープ） ================= */
const roadGraph = (function(){
  const nodes = new Map();
  const key = (x,z)=> `${Math.round(x/3)}_${Math.round(z/3)}`;
  function node(x,z){ const k=key(x,z); if(!nodes.has(k)) nodes.set(k,{x,z,adj:[]}); return k; }
  SCENE_DATA.roads.forEach(r=>{
    for(let i=0;i<r.p.length-1;i++){
      const a=node(r.p[i][0], -r.p[i][1]), b=node(r.p[i+1][0], -r.p[i+1][1]);
      if(a!==b){ nodes.get(a).adj.push(b); nodes.get(b).adj.push(a); }
    }
  });
  /* 空間グリッドで最近傍探索 */
  const grid = new Map(); const GS = 120;
  nodes.forEach((n,k)=>{ const g=`${Math.floor(n.x/GS)}_${Math.floor(n.z/GS)}`; if(!grid.has(g)) grid.set(g,[]); grid.get(g).push(k); });
  function nearest(x,z){
    for(let ring=0; ring<40; ring++){
      let best=null, bd=1e18;
      const gx=Math.floor(x/GS), gz=Math.floor(z/GS);
      for(let i=-ring;i<=ring;i++) for(let j=-ring;j<=ring;j++){
        if(Math.max(Math.abs(i),Math.abs(j))!==ring) continue;
        const arr=grid.get(`${gx+i}_${gz+j}`); if(!arr) continue;
        arr.forEach(k=>{ const n=nodes.get(k); const d=(n.x-x)**2+(n.z-z)**2; if(d<bd){bd=d;best=k;} });
      }
      if(best) return best;
    }
    return null;
  }
  class Heap{ constructor(){this.a=[];} push(v){ const a=this.a; a.push(v); let i=a.length-1; while(i>0){ const p=(i-1)>>1; if(a[p][0]<=a[i][0]) break; [a[p],a[i]]=[a[i],a[p]]; i=p; } }
    pop(){ const a=this.a; const top=a[0]; const last=a.pop(); if(a.length){ a[0]=last; let i=0; for(;;){ const l=2*i+1, r=l+1; let m=i; if(l<a.length&&a[l][0]<a[m][0]) m=l; if(r<a.length&&a[r][0]<a[m][0]) m=r; if(m===i) break; [a[m],a[i]]=[a[i],a[m]]; i=m; } } return top; } get size(){ return this.a.length; } }
  const cache = new Map();
  function path(x0,z0,x1,z1){
    const ck = `${Math.round(x0)}_${Math.round(z0)}_${Math.round(x1)}_${Math.round(z1)}`;
    if(cache.has(ck)) return cache.get(ck);
    const s=nearest(x0,z0), g=nearest(x1,z1);
    let out=null;
    if(s&&g){
      const gp=nodes.get(g);
      const open=new Heap(); open.push([0,s]);
      const came=new Map(), cost=new Map([[s,0]]), closed=new Set();
      let found=false, guard=0;
      while(open.size && guard++<400000){
        const [f,cur]=open.pop();
        if(cur===g){found=true;break;}
        if(closed.has(cur)) continue; closed.add(cur);
        const cn=nodes.get(cur);
        for(const nb of cn.adj){
          const nn=nodes.get(nb);
          const nc=cost.get(cur)+Math.hypot(nn.x-cn.x, nn.z-cn.z);
          if(nc < (cost.get(nb) ?? 1e18)){ cost.set(nb,nc); came.set(nb,cur); open.push([nc+Math.hypot(nn.x-gp.x, nn.z-gp.z), nb]); }
        }
      }
      if(found){ out=[]; let cur=g; while(cur){ const n=nodes.get(cur); out.push([n.x,n.z]); cur=came.get(cur); } out.reverse(); }
    }
    if(!out || out.length<2) out=[[x0,z0],[x1,z1]];
    else { out.unshift([x0,z0]); out.push([x1,z1]); }
    cache.set(ck, out);
    return out;
  }
  return {path, nodes};
})();
/* 距離テーブル付き経路 */
const ROUTES = new Map();
/* 来訪者が実際に歩く経路（駅→大手前通り→大手門、城→好古園・商店街 等）を淡い金色の線で常時表示 */
const routeGroup = new THREE.Group(); scene.add(routeGroup);
const ROUTE_LINE_MAT = new THREE.LineBasicMaterial({color:0xffd166, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false});
function route(a, b, draw){
  const k = `${Math.round(a.x)}_${Math.round(a.z)}>${Math.round(b.x)}_${Math.round(b.z)}`;
  if(ROUTES.has(k)) return ROUTES.get(k);
  const pth = roadGraph.path(a.x, a.z, b.x, b.z);
  let total=0; const seg=[0];
  for(let i=1;i<pth.length;i++){ total += Math.hypot(pth[i][0]-pth[i-1][0], pth[i][1]-pth[i-1][1]); seg.push(total); }
  const r = {path:pth, seg, total:Math.max(1,total)};
  ROUTES.set(k, r);
  if(draw && total < 6000){
    /* 経路リボン: 利用者数に応じて帯が太く・明るくなり、帯は進行方向へ流れる */
    r.rib = buildRibbon(pth.map(p=>({x:p[0], z:p[1]})), {col:0xffd166, w:5, kind:3}, routeGroup, 1.6);
    r.rib.uni.uDim.value = 0.8; r.rib.uni.uFlowCol.value.setHex(0xffe08a);
    r.uses = 0;
  }
  return r;
}
function sampleRoute(r, d){
  const seg=r.seg, pth=r.path;
  let lo=0, hi=seg.length-1;
  while(lo<hi-1){ const mid=(lo+hi)>>1; if(seg[mid]<=d) lo=mid; else hi=mid; }
  const k=(d-seg[lo])/Math.max(0.001, seg[lo+1]-seg[lo]);
  return [pth[lo][0]+(pth[lo+1][0]-pth[lo][0])*k, pth[lo][1]+(pth[lo+1][1]-pth[lo][1])*k];
}

/* ================= 来訪者エージェント（1ドット = 8人） ================= */
const MAX_AG = 2400;
const agentMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1.35, 6, 5), new THREE.MeshBasicMaterial(), MAX_AG);
/* 軌跡（移動中の来訪者が残す尾）: 細長い板を進行方向に並べ、線として見せる */
const TRAIL_K = 24, TRAIL_STEP = 2.8;
const trailMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({transparent:true, opacity:0.65, blending:THREE.AdditiveBlending, depthWrite:false}), MAX_AG*TRAIL_K);
trailMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_AG*TRAIL_K*3), 3);
trailMesh.count = 0; trailMesh.frustumCulled = false; scene.add(trailMesh);
const _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _S = new THREE.Vector3(), _PV = new THREE.Vector3();
agentMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_AG*3), 3);
agentMesh.count = 0; agentMesh.frustumCulled = false;
scene.add(agentMesh);
const agents = [];
const HOTEL_NODES = SCENE_DATA.hotels.map(h=>({x:h.p[0], z:-h.p[1], n:h.n})).filter(h=> Math.hypot(h.x-STN.x, h.z-STN.z) < 1500);
const STATS = { arrived:{in:0,dom:0,loc:0}, departed:{}, byGate:{}, inCastle:0, inCity:0, moving:0, atSpot:{}, staying:0, castleEntered:0, dwellSum:0, dwellN:0, kaiyu:0, tenshuQueue:0 };
let spawnAcc = 0, dayTotal = 0;
function pickW(list){ let s=0; list.forEach(v=>s+=v[1]); let r=rnd()*s; for(const v of list){ r-=v[1]; if(r<=0) return v[0]; } return list[list.length-1][0]; }
function segByFilter(seg){ return segFilter==='all' || segFilter===seg; }
function spawnAgent(){
  const sc = SCN[curScn];
  const seg = pickW(SEG_KEYS.map(k=>[k, sc.mix[k]]));
  const gk = pickW(Object.entries(GATE_SHARE[seg]));
  const gate = GATES[gk];
  const dest = pickW(DEST[seg].map(d=>[d, d[2]]));
  const spots = SPOTS.filter(s=> rnd() < s.p[seg]);
  /* 順路: ゲート → 姫路城（大手門） → 回遊先（最大2） → 帰路ゲート or 宿泊 */
  const plan = [];
  const enterCastle = rnd() < 0.9;
  if(enterCastle) plan.push({kind:'castle', node:GATE_OTEMON, dwell:CASTLE_DWELL[seg]*(0.7+rnd()*0.6)});
  spots.slice(0,2).forEach(s=>{ const p=P(s.n); plan.push({kind:'spot', name:s.n, node:p, dwell:s.dw*(0.7+rnd()*0.6)}); });
  if(!enterCastle && !plan.length){ const p=P('大手前通り'); plan.push({kind:'spot', name:'大手前通り', node:p, dwell:30}); }
  let endNode, endKind;
  if(dest[0]==='stay' && HOTEL_NODES.length){ const h=HOTEL_NODES[Math.floor(rnd()*HOTEL_NODES.length)]; endNode={x:h.x,z:h.z}; endKind='stay'; }
  else { const o=ORIGIN_BY_ID[dest[0]]; const g=GATES[o ? o.gate : gk]; endNode={x:g.x,z:g.z}; endKind='gate'; }
  const jr = 40+rnd()*130, ja = rnd()*6.283;
  const a = { seg, gk, dest, plan, pi:0, state:'move', endNode, endKind, r:null, d:0, sp:70+rnd()*30, dwellLeft:0, cur:{x:gate.x,z:gate.z}, t0:timeState.min, visited:0, jx:Math.cos(ja)*jr, jz:Math.sin(ja)*jr*0.8 };
  a.lane = (rnd()-0.5)*5;
  a.tr = [];
  a.legFrom = 'gate:'+gk;
  trajPush(a, gate.x, gate.z);
  a.r = route(a.cur, plan.length ? plan[0].node : endNode, true); a.r.uses = (a.r.uses||0)+1;
  agents.push(a);
  STATS.arrived[seg]++; STATS.byGate[gk]=(STATS.byGate[gk]||0)+1; dayTotal++;
}
function resetSim(){
  agents.length = 0; spawnAcc = 0; dayTotal = 0;
  STATS.arrived={in:0,dom:0,loc:0}; STATS.departed={}; STATS.byGate={}; STATS.atSpot={}; STATS.staying=0; STATS.castleEntered=0; STATS.dwellSum=0; STATS.dwellN=0; STATS.kaiyu=0;
  agentMesh.count = 0; trailMesh.count = 0;
  if(typeof ANA!=='undefined'){ ANA.hist=[]; ANA.peak=0; ANA.peakT=DAY0; ANA.lastRec=-1e9; } if(typeof OD!=='undefined'){ OD.clear(); FLOWA.dirty=true; }
  trajReset();
  calcArrNorm();
}
function updateAgents(dtMin){
  const sc = SCN[curScn];
  const perDay = sc.castle * CITY_FACTOR / AG_SCALE;
  spawnAcc += perDay * arrProfile(timeState.min)/ARR_NORM * dtMin;
  while(spawnAcc >= 1 && agents.length < MAX_AG){ spawnAcc -= 1; spawnAgent(); }
  const M = new THREE.Matrix4(), C = new THREE.Color();
  let vi=0, ti=0, inCastle=0, moving=0, atSpotN=0;
  const spotNow = {};
  for(let i=agents.length-1;i>=0;i--){
    const a = agents[i];
    if(a.state==='move'){
      a.d += a.sp * dtMin;
      if(a.d >= a.r.total){
        if(a.pi < a.plan.length){
          const st = a.plan[a.pi];
          a.cur = {x:st.node.x, z:st.node.z};
          a.state = st.kind; a.dwellLeft = st.dwell; a.tStop = timeState.min;
          trajStop(a, st.node.x, st.node.z); odRecord(a, st.kind==='castle' ? 'castle' : st.name);
          if(st.kind==='castle') STATS.castleEntered++;
          else { a.visited++; }
        } else {
          /* 退出: 帰路ゲート or 宿泊 */
          if(a.endKind==='stay'){ a.state='stay'; a.cur={x:a.endNode.x, z:a.endNode.z}; STATS.staying++; a.tStop = timeState.min; trajStop(a, a.cur.x, a.cur.z); odRecord(a, 'stay'); }
          else {
            STATS.departed[a.dest[0]] = (STATS.departed[a.dest[0]]||0)+1;
            STATS.dwellSum += timeState.min - a.t0; STATS.dwellN++;
            if(a.visited>0) STATS.kaiyu++;
            trajStop(a, a.cur.x, a.cur.z); odRecord(a, 'exit:'+(ORIGIN_BY_ID[a.dest[0]] ? ORIGIN_BY_ID[a.dest[0]].gate : a.gk));
            agents.splice(i,1); continue;
          }
        }
      } else {
        const p = sampleRoute(a.r, a.d);
        const ahead=sampleRoute(a.r,Math.min(a.r.total,a.d+3));
        const dx=ahead[0]-p[0], dz=ahead[1]-p[1], dl=Math.hypot(dx,dz)||1;
        p[0]-=dz/dl*(a.lane||0);p[1]+=dx/dl*(a.lane||0);
        a.cur = {x:p[0], z:p[1]};
        trajPush(a, p[0], p[1]);
        const lt = a.tr[a.tr.length-1];
        if(!lt || Math.hypot(lt[0]-p[0], lt[1]-p[1]) >= TRAIL_STEP){ a.tr.push([p[0], p[1]]); if(a.tr.length > TRAIL_K+1) a.tr.shift(); }
      }
    } else if(a.state==='castle' || a.state==='spot'){
      a.dwellLeft -= dtMin;
      if(a.state==='castle') inCastle++; else { atSpotN++; const nm=a.plan[a.pi].name; spotNow[nm]=(spotNow[nm]||0)+1; }
      if(a.dwellLeft <= 0){
        a.pi++;
        const next = a.pi < a.plan.length ? a.plan[a.pi].node : a.endNode;
        a.r = route(a.cur, next, true); a.r.uses = (a.r.uses||0)+1; a.d = 0; a.state='move'; a.tr = []; a.tStop = null;
      }
    }
    /* 描画（城内滞留中は城内ではなく周辺に薄く散らす / L2は別表現） */
    if(!segByFilter(a.seg) || !LAYER_STATE.agents) continue;
    if(a.state==='castle' && level==='castle') continue;
    let x=a.cur.x, z=a.cur.z, y=3.2, yoff=3.2;
    if(a.state==='castle'){ x = CASTLE.x - 60 + a.jx; z = CASTLE.z + 130 + a.jz; yoff=2.4; }
    else if(a.state==='spot'){ x += a.jx*0.35; z += a.jz*0.35; }
    else if(a.state==='stay'){ x += a.jx*0.15; z += a.jz*0.15; yoff=32; }
    y = TH(x, z) + yoff;
    if(a.state==='move'){
      moving++;
      /* 尾: 古いほど細く暗く */
      const n = a.tr.length;
      for(let j=0; j<n-1 && ti<MAX_AG*TRAIL_K; j++){
        const p0=a.tr[j], p1=a.tr[j+1];
        const dx=p1[0]-p0[0], dz=p1[1]-p0[1], L=Math.hypot(dx,dz); if(L<0.5) continue;
        const f=(j+1)/n;
        _E.set(0, Math.atan2(-dz, dx), 0); _Q.setFromEuler(_E);
        const mx=(p0[0]+p1[0])/2, mz=(p0[1]+p1[1])/2; _PV.set(mx, TH(mx,mz)+2.4, mz); _S.set(L+0.3, 0.18, (0.2+0.65*f*f)*Math.min(3.4,Math.max(.7,ctrl.sph.radius/900)));
        M.compose(_PV, _Q, _S); trailMesh.setMatrixAt(ti, M);
        C.setHex(SEG[a.seg].col).multiplyScalar(0.08+0.85*f*f); trailMesh.setColorAt(ti, C);
        ti++;
      }
    }
    M.makeTranslation(x, y, z);
    agentMesh.setMatrixAt(vi, M);
    C.setHex(SEG[a.seg].col);
    agentMesh.setColorAt(vi, C);
    vi++;
  }
  agentMesh.count = vi;
  trailMesh.count = ti; trailMesh.instanceMatrix.needsUpdate = true; if(trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
  agentMesh.instanceMatrix.needsUpdate = true;
  if(agentMesh.instanceColor) agentMesh.instanceColor.needsUpdate = true;
  STATS.inCastle = inCastle; STATS.moving = moving; STATS.inCity = agents.length; STATS.atSpot = spotNow; STATS.atSpotN = atSpotN;
}

/* ================= 滞留ヒートマップ（通り単位・時間連動・セグメント別） ================= */
const HEAT = { verts:[], obj:null, base:null, lastT:-99, max:1 };
(function buildHeat(){
  const pts=[], meta=[];
  SCENE_DATA.roads.forEach(r=>{
    if(r.c > 3) return;
    for(let i=0;i<r.p.length-1;i++){
      if(Math.abs(r.p[i][0])>3600 || Math.abs(r.p[i][1])>3600) continue;
      pts.push(r.p[i][0], TY(r.p[i][0], -r.p[i][1], 1.0), -r.p[i][1], r.p[i+1][0], TY(r.p[i+1][0], -r.p[i+1][1], 1.0), -r.p[i+1][1]);
      meta.push([r.p[i][0], -r.p[i][1], r.c], [r.p[i+1][0], -r.p[i+1][1], r.c]);
    }
  });
  HEAT.verts = meta;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(meta.length*3), 3));
  const mat = new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false});
  HEAT.obj = new THREE.LineSegments(geo, mat);
  HEAT.obj.position.y = 0.5;
  LG.heat.add(HEAT.obj);
  LG.heat.visible = false;
})();
/* 熱源: 名称・座標・σ・セグメント別重み・時間プロファイル */
const HEAT_SRC = [
  {n:'姫路城', node:()=>CASTLE, sig:300, w:{in:1.4, dom:1.2, loc:0.9}, prof:t=> 0.15+sstep(150,330,t)*(1-sstep(560,720,t))},
  {n:'大手門', node:()=>GATE_OTEMON, sig:160, w:{in:1.0, dom:1.0, loc:0.8}, prof:t=> 0.1+sstep(120,260,t)*(1-sstep(520,700,t))},
  {n:'JR姫路駅', node:()=>STN, sig:260, w:{in:1.2, dom:1.1, loc:1.0}, prof:t=> 0.35+0.8*Math.exp(-Math.pow((t-210)/110,2))+0.9*Math.exp(-Math.pow((t-680)/120,2))},
  {n:'大手前通り', node:()=>P('大手前通り'), sig:220, w:{in:0.9, dom:0.9, loc:0.8}, prof:t=> 0.2+sstep(150,300,t)*(1-sstep(700,820,t))},
  {n:'みゆき通り商店街', node:()=>P('みゆき通り商店街'), sig:200, w:{in:0.7, dom:0.9, loc:1.0}, prof:t=> 0.15+sstep(300,480,t)*(1-sstep(720,860,t))},
  {n:'好古園', node:()=>P('好古園'), sig:150, w:{in:0.9, dom:0.6, loc:0.4}, prof:t=> 0.05+sstep(240,420,t)*(1-sstep(600,700,t))},
  {n:'姫路市立美術館', node:()=>P('姫路市立美術館'), sig:150, w:{in:0.4, dom:0.6, loc:0.4}, prof:t=> 0.05+sstep(300,460,t)*(1-sstep(620,700,t))},
  {n:'書写山圓教寺', node:()=>P('書写山圓教寺'), sig:260, w:{in:0.7, dom:0.45, loc:0.3}, prof:t=> 0.05+sstep(240,420,t)*(1-sstep(560,660,t))},
  {n:'手柄山中央公園', node:()=>P('手柄山中央公園'), sig:220, w:{in:0.1, dom:0.3, loc:0.6}, prof:t=> 0.05+sstep(300,480,t)*(1-sstep(620,720,t))},
  {n:'アクリエひめじ', node:()=>P('アクリエひめじ'), sig:160, w:{in:0.1, dom:0.2, loc:0.3}, prof:t=> 0.1+0.4*sstep(180,300,t)*(1-sstep(660,760,t))},
  {n:'宿泊集積（駅周辺）', node:()=>({x:STN.x+80, z:STN.z-120}), sig:280, w:{in:0.8, dom:0.6, loc:0.15}, prof:t=> 0.05+0.9*sstep(720,840,t)*SCN[curScn].stay*6},
];
const heatC = (v)=>{
  const stops = [[0,0x1c2540],[0.35,0x6b3a12],[0.72,0xff8a1e],[1,0xffe1b3]];
  for(let i=0;i<stops.length-1;i++){
    if(v <= stops[i+1][0]){
      const k=(v-stops[i][0])/(stops[i+1][0]-stops[i][0]);
      return new THREE.Color(stops[i][1]).lerp(new THREE.Color(stops[i+1][1]), k);
    }
  }
  return new THREE.Color(0xffe1b3);
};
function repaintHeat(){
  if(heatMode==='off') return;
  const t = timeState.min;
  if(Math.abs(t-HEAT.lastT) < 3) return;
  HEAT.lastT = t;
  const segs = heatMode==='all' ? SEG_KEYS : [heatMode];
  const mix = SCN[curScn].mix;
  const src = HEAT_SRC.map(s=>{ const n=s.node(); let w=0; segs.forEach(k=> w += s.w[k]*(heatMode==='all'?mix[k]:1)); return [n.x, n.z, w*s.prof(t), s.sig]; });
  const meta = HEAT.verts, n = meta.length, col = HEAT.obj.geometry.attributes.color;
  const H = new Float32Array(n); let mx=0.0001;
  for(let i=0;i<n;i++){
    const v=meta[i];
    let e = v[2]===3 ? 0.12 : (v[2]===2 ? 0.04 : 0.01);
    for(let s=0;s<src.length;s++){
      const dx=v[0]-src[s][0], dz=v[1]-src[s][1], sg=src[s][3], d2=dx*dx+dz*dz;
      if(d2 < sg*sg*9) e += src[s][2]*Math.exp(-d2/(2*sg*sg));
    }
    H[i]=e; if(e>mx) mx=e;
  }
  const c = new THREE.Color();
  const norm = Math.max(mx, 1.2);
  for(let i=0;i<n;i++){ c.copy(heatC(Math.min(1, H[i]/norm*1.15))); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true;
}

/* ================= L2 姫路城 城内ゾーン・待ち行列 ================= */
const CZ = (dx, dz)=> ({x:CASTLE.x+dx, z:CASTLE.z+dz});
const ZONES = [
  {n:'大手門・桜門橋',  node:CZ(-37, 465), frac:0.10, cap:2000, desc:'入城導線の起点。三の丸広場へ'},
  {n:'三の丸広場',      node:CZ(-20, 270), frac:0.20, cap:4000, desc:'撮影スポット。滞留・待合の緩衝地帯'},
  {n:'入城口（菱の門）',node:CZ(-80, 150), frac:0.12, cap:900,  desc:'入城券・ゲート。券売の待ち行列が発生'},
  {n:'西の丸（百間廊下）',node:CZ(-220, 100), frac:0.16, cap:1500, desc:'化粧櫓・長局。回遊の分散先'},
  {n:'大天守',          node:CZ(0, 0),     frac:0.24, cap:1100, desc:'入場制限 15,000人/日。最長待ちが発生する律速点'},
  {n:'備前丸・本丸',    node:CZ(-45, 40),  frac:0.18, cap:1400, desc:'天守を見上げる広場。退出動線'},
];
const zoneGroup = new THREE.Group(); zoneGroup.visible=false; scene.add(zoneGroup);
ZONES.forEach(z=>{
  const disc = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:0.18, depthWrite:false, side:THREE.DoubleSide}));
  disc.rotation.x=-Math.PI/2; disc.position.set(z.node.x, TY(z.node.x, z.node.z, 1.2), z.node.z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(36, 39, 40), new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:0.7, depthWrite:false, side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.set(z.node.x, TY(z.node.x, z.node.z, 1.4), z.node.z);
  disc.userData = {name:z.n, zone:true, desc:z.desc}; z.disc=disc; z.ring=ring;
  const lb = makeLabel(z.n, 9, '#ffd166'); lb.position.set(z.node.x, TY(z.node.x, z.node.z, 46), z.node.z); z.lb=lb;
  zoneGroup.add(disc, ring, lb);
});
/* 城内ルート（大手門→三の丸→菱の門→いの門〜はの門→大天守→備前丸→出口） */
const CROUTE = (function(){
  const pts = [CZ(-37,465), CZ(-25,300), CZ(-20,240), CZ(-80,150), CZ(-110,120), CZ(-95,70), CZ(-40,50), CZ(-10,20), CZ(0,0), CZ(-20,25), CZ(-45,40), CZ(-70,90), CZ(-90,160), CZ(-30,250), CZ(-37,465)];
  const seg=[0]; let total=0;
  for(let i=1;i<pts.length;i++){ total+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z); seg.push(total); }
  return {path:pts.map(p=>[p.x,p.z]), seg, total};
})();
const CROUTE_LINE = new THREE.Line(new THREE.BufferGeometry().setFromPoints(CROUTE.path.map(p=>new THREE.Vector3(p[0], TY(p[0], p[1], 2.2), p[1]))),
  new THREE.LineBasicMaterial({color:0xffd166, transparent:true, opacity:0.5}));
zoneGroup.add(CROUTE_LINE);
const castleAg = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 6, 5), new THREE.MeshBasicMaterial(), 1200);
castleAg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1200*3), 3);
castleAg.count=0; castleAg.frustumCulled=false; zoneGroup.add(castleAg);
const castleWalkers = [];
function zoneStats(){
  const people = STATS.inCastle * AG_SCALE;
  const t = timeState.min;
  return ZONES.map(z=>{
    const occ = people * z.frac;
    const load = occ / z.cap;
    let wait = 0;
    if(z.n==='大天守') wait = clamp((occ - 380) / 9, 0, 120);
    else if(z.n==='入城口（菱の門）') wait = clamp((occ - 300) / 14, 0, 40);
    return {z, occ, load, wait, lvl: load<0.45?'ok':(load<0.8?'mid':'hi')};
  });
}
function updateCastleZones(dtMin){
  const zs = zoneStats();
  zs.forEach(s=>{
    const c = s.lvl==='hi' ? 0xff6b5e : (s.lvl==='mid' ? 0xffd166 : 0x3ddc84);
    s.z.disc.material.color.setHex(c); s.z.ring.material.color.setHex(c);
    s.z.disc.material.opacity = 0.12 + Math.min(0.5, s.load*0.4);
    const sc = 0.8 + Math.min(1.2, s.load*0.9);
    s.z.disc.scale.set(sc,sc,1); s.z.ring.scale.set(sc,sc,1);
  });
  /* 城内ウォーカー: 城内人数に比例（1ドット=8人） */
  const target = Math.min(1200, Math.round(STATS.inCastle));
  while(castleWalkers.length < target) castleWalkers.push({u:rnd(), sp:(38+rnd()*22), seg:pickW(SEG_KEYS.map(k=>[k, SCN[curScn].mix[k]]))});
  if(castleWalkers.length > target) castleWalkers.length = target;
  const M=new THREE.Matrix4(), C=new THREE.Color();
  castleWalkers.forEach((w,i)=>{
    if(!segByFilter(w.seg)){ M.makeTranslation(0,-100,0); castleAg.setMatrixAt(i,M); return; }
    w.u += dtMin * w.sp / CROUTE.total; if(w.u>=1) w.u-=1;
    const p = sampleRoute(CROUTE, w.u*CROUTE.total);
    const h=(i*2654435761)>>>0;
    const wx=p[0]+((h%20)-10)*0.9, wz=p[1]+(((h>>8)%20)-10)*0.9;
    M.makeTranslation(wx, TH(wx,wz)+2.0, wz);
    castleAg.setMatrixAt(i,M); C.setHex(SEG[w.seg].col); castleAg.setColorAt(i,C);
  });
  castleAg.count = castleWalkers.length;
  castleAg.instanceMatrix.needsUpdate = true;
  if(castleAg.instanceColor) castleAg.instanceColor.needsUpdate = true;
}

