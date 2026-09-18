
/* ================= 来訪者セグメント / シナリオ / 流入ゲート（ダミー定義） ================= */
const SEG = {
  in: {name:'インバウンド',  col:0x3a90d6, css:'var(--in)'},
  dom:{name:'国内（県外）',  col:0x27b062, css:'var(--dom)'},
  loc:{name:'県内・近隣',    col:0xd05f8a, css:'var(--loc)'},
};
const SEG_KEYS = ['in','dom','loc'];
/* シナリオ: 姫路城 入城者数/日（想定）・セグメント構成・宿泊転換率 */
const SCN = {
  wkd:   {name:'通常の平日',   castle:4200,  mix:{in:0.38, dom:0.40, loc:0.22}, stay:0.11, night:0.35},
  wke:   {name:'通常の週末',   castle:7800,  mix:{in:0.28, dom:0.45, loc:0.27}, stay:0.10, night:0.4},
  sakura:{name:'桜（4月上旬）', castle:14000, mix:{in:0.30, dom:0.47, loc:0.23}, stay:0.13, night:0.9},
  gw:    {name:'GW',           castle:15000, mix:{in:0.16, dom:0.58, loc:0.26}, stay:0.14, night:0.6},
  autumn:{name:'紅葉（11月）', castle:9500,  mix:{in:0.34, dom:0.44, loc:0.22}, stay:0.12, night:0.55},
};
let curScn = 'wke';
let segFilter = 'all';   // all | in | dom | loc
const TENSHU_CAP = 15000;      // 大天守 入城制限（人/日）
const FEE = { out:2500, resident:1000 };   // 入城料（2026年3月〜 市外/市民）想定
const CITY_FACTOR = 1.35;      // 市内来訪者 ≒ 入城者 × 1.35（入城しない来訪含む）
const AG_SCALE = 8;            // 1ドット = 8人

/* 流入ゲート（市内側の到着地点） */
function icByName(pat, fallbackIdx){
  const f = SCENE_DATA.ic.find(i=> pat.test(i.n));
  const ic = f || SCENE_DATA.ic[fallbackIdx] || {n:'IC', p:[3000,-1500]};
  return {x:ic.p[0], z:-ic.p[1], n:ic.n};
}
const IC_E = icByName(/東|市川|花田|別所/, 0), IC_W = icByName(/西|中地|太子|飾磨/, 1);
const GATES = {
  shin: {name:'JR姫路駅（新幹線）',        x:STN.x, z:STN.z, col:0x9ec5ff, mode:'rail'},
  jr:   {name:'JR姫路駅（在来線・新快速）', x:STN.x, z:STN.z, col:0xd0d6ea, mode:'rail'},
  sanyo:{name:'山陽姫路駅',                x:SANYO_STN.x, z:SANYO_STN.z, col:0xff9a3d, mode:'rail'},
  bus:  {name:'姫路駅北 バスターミナル',   x:BUS_TERM.x, z:BUS_TERM.z, col:0xffd166, mode:'bus'},
  carE: {name:IC_E.n+'（車・東）',         x:IC_E.x, z:IC_E.z, col:0x8fd0ff, mode:'car'},
  carW: {name:IC_W.n+'（車・西）',         x:IC_W.x, z:IC_W.z, col:0x8fd0ff, mode:'car'},
  port: {name:'姫路港（家島・小豆島）',    x:PORT.x, z:PORT.z, col:0x35d0c0, mode:'ship'},
};
/* セグメント別ゲート利用率（ダミー） */
const GATE_SHARE = {
  in: {shin:0.40, jr:0.35, sanyo:0.04, bus:0.11, carE:0.05, carW:0.03, port:0.02},
  dom:{shin:0.28, jr:0.30, sanyo:0.05, bus:0.07, carE:0.18, carW:0.11, port:0.01},
  loc:{shin:0.02, jr:0.34, sanyo:0.18, bus:0.03, carE:0.22, carW:0.19, port:0.02},
};
/* 広域 出発地（地図外ノード: 方位角°・距離m・セグメント・ゲート） */
const ORIGINS = [
  {id:'osaka', name:'大阪・神戸',       bear:100, r:8600, seg:'dom', share:0.30, gate:'jr',   via:'新快速 約60分 / 新幹線 約30分'},
  {id:'kyoto', name:'京都・奈良',       bear:78,  r:9200, seg:'dom', share:0.09, gate:'shin', via:'新幹線 約50分'},
  {id:'tokyo', name:'東京・首都圏',     bear:88,  r:11500,seg:'dom', share:0.16, gate:'shin', via:'新幹線 約3時間'},
  {id:'nagoya',name:'名古屋・中部',     bear:70,  r:10500,seg:'dom', share:0.06, gate:'shin', via:'新幹線 約1時間30分'},
  {id:'okayama',name:'岡山・倉敷',      bear:262, r:8800, seg:'dom', share:0.10, gate:'jr',   via:'新幹線 約20分 / 在来線 約80分'},
  {id:'hiroshima',name:'広島',          bear:250, r:11000,seg:'dom', share:0.09, gate:'shin', via:'新幹線 約1時間'},
  {id:'kyushu',name:'福岡・九州',       bear:240, r:12500,seg:'dom', share:0.05, gate:'shin', via:'新幹線 約2時間20分'},
  {id:'sanin', name:'鳥取・山陰',       bear:5,   r:9000, seg:'dom', share:0.04, gate:'carE', via:'播但連絡道路・特急はまかぜ'},
  {id:'shikoku',name:'四国・小豆島',    bear:200, r:8800, seg:'dom', share:0.03, gate:'port', via:'フェリー（姫路港）'},
  {id:'chugoku_car',name:'中国道・山陽道（車）', bear:275, r:7600, seg:'dom', share:0.08, gate:'carW', via:'山陽自動車道'},
  {id:'kakogawa',name:'加古川・明石・神戸西', bear:118, r:7300, seg:'loc', share:0.45, gate:'jr', via:'JR・山陽電鉄 20〜40分'},
  {id:'tatsuno',name:'たつの・赤穂・相生',   bear:255, r:7300, seg:'loc', share:0.30, gate:'carW', via:'車・JR 20〜40分'},
  {id:'fukusaki',name:'福崎・神河・市川',    bear:20,  r:7300, seg:'loc', share:0.25, gate:'carE', via:'播但線・播但連絡道路'},
  {id:'kix',   name:'関西国際空港',     bear:128, r:12500,seg:'in',  share:0.42, gate:'shin', via:'特急はるか+新幹線 / 直行バス'},
  {id:'itm',   name:'伊丹・神戸空港',   bear:98,  r:10800,seg:'in',  share:0.10, gate:'jr',   via:'リムジンバス+JR'},
  {id:'hnd',   name:'成田・羽田 経由',  bear:85,  r:13500,seg:'in',  share:0.18, gate:'shin', via:'新幹線（ゴールデンルート）'},
  {id:'hij',   name:'広島・岡山空港 経由', bear:258, r:12200, seg:'in', share:0.14, gate:'shin', via:'新幹線（広島⇄京都 途中下車）'},
  {id:'osaka_in',name:'大阪・京都 宿泊拠点', bear:92, r:8000, seg:'in', share:0.16, gate:'jr', via:'JRパス・新快速 日帰り'},
];
ORIGINS.forEach(o=>{ const a=o.bear*Math.PI/180; o.x = Math.sin(a)*o.r; o.z = -Math.cos(a)*o.r; });
const ORIGIN_BY_ID = Object.fromEntries(ORIGINS.map(o=>[o.id,o]));
/* インバウンド 国・地域構成（分析ボード用） */
const COUNTRIES = [['台湾',0.18],['米国',0.15],['欧州（英・仏・独・西）',0.17],['中国',0.12],['韓国',0.10],['香港',0.08],['豪州',0.08],['東南アジア',0.08],['その他',0.04]];
/* 帰路・次の目的地（セグメント別シェア） */
const DEST = {
  in: [['osaka_in','大阪・京都の宿泊拠点へ戻る',0.34],['hiroshima','広島へ（ゴールデンルート西進）',0.22],['kyoto','京都へ',0.12],['stay','姫路市内 宿泊',0.13],['okayama','岡山・倉敷へ',0.07],['kakogawa','神戸へ',0.08],['kix','関西国際空港（帰国）',0.04]],
  dom:[['osaka','大阪・神戸へ',0.30],['tokyo','東京・首都圏へ',0.15],['kyoto','京都・奈良へ',0.08],['okayama','岡山・広島へ',0.13],['stay','姫路市内 宿泊',0.12],['nagoya','名古屋・中部へ',0.05],['kyushu','九州へ',0.04],['shikoku','四国・小豆島へ',0.04],['sanin','山陰へ',0.03],['chugoku_car','車で中国道方面へ',0.06]],
  loc:[['kakogawa','加古川・明石方面へ帰宅',0.42],['tatsuno','たつの・赤穂方面へ帰宅',0.30],['fukusaki','福崎・神河方面へ帰宅',0.20],['osaka','大阪・神戸へ',0.05],['stay','姫路市内 宿泊',0.03]],
};
/* 市内 回遊先（セグメント別 立寄率・平均滞在分） */
const SPOTS = [
  {n:'好古園',            p:{in:0.45, dom:0.36, loc:0.24}, dw:45},
  {n:'みゆき通り商店街',  p:{in:0.55, dom:0.62, loc:0.66}, dw:40},
  {n:'姫路市立美術館',    p:{in:0.14, dom:0.20, loc:0.14}, dw:50},
  {n:'兵庫県立歴史博物館',p:{in:0.08, dom:0.14, loc:0.10}, dw:45},
  {n:'姫路市立動物園',    p:{in:0.05, dom:0.10, loc:0.18}, dw:50},
  {n:'書写山圓教寺',      p:{in:0.13, dom:0.09, loc:0.05}, dw:150},
  {n:'手柄山中央公園',    p:{in:0.02, dom:0.05, loc:0.10}, dw:60},
  {n:'アクリエひめじ',    p:{in:0.01, dom:0.03, loc:0.03}, dw:90},
];
const CASTLE_DWELL = {in:170, dom:140, loc:120};   // 平均滞在分（城内）

/* ================= タイムライン（06:00〜24:00） ================= */
const timeState = { min:0, playing:false, speed:6 };   // 実1秒 = 6分（フル再生 3分）
const PHASES = [
  {t:0,   name:'早朝・到着開始'},
  {t:150, name:'到着ピーク（新幹線・新快速）'},
  {t:300, name:'城内滞留ピーク'},
  {t:480, name:'市内回遊（商店街・好古園）'},
  {t:600, name:'帰路ピーク'},
  {t:780, name:'夜間（宿泊者の回遊・ライトアップ）'},
];
function phaseAt(min){ let p=PHASES[0]; for(const ph of PHASES){ if(min>=ph.t) p=ph; } return p; }
function clockStr(min){ const h=6+Math.floor(min/60), m=Math.floor(min%60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
/* 到着プロファイル（時刻→相対到着率） */
function arrProfile(min){
  const h = 6 + min/60;
  const pk = Math.exp(-Math.pow((h-9.8)/1.6, 2)) + 0.55*Math.exp(-Math.pow((h-13.2)/1.5, 2)) + 0.08*Math.exp(-Math.pow((h-16.5)/1.2, 2));
  const night = SCN[curScn].night * 0.5 * Math.exp(-Math.pow((h-19.0)/1.1, 2));
  return pk + night;
}
let ARR_NORM = 1;
function calcArrNorm(){ let s=0; for(let m=0;m<1080;m+=2) s += arrProfile(m)*2; ARR_NORM = s || 1; }
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
function route(a, b){
  const k = `${Math.round(a.x)}_${Math.round(a.z)}>${Math.round(b.x)}_${Math.round(b.z)}`;
  if(ROUTES.has(k)) return ROUTES.get(k);
  const pth = roadGraph.path(a.x, a.z, b.x, b.z);
  let total=0; const seg=[0];
  for(let i=1;i<pth.length;i++){ total += Math.hypot(pth[i][0]-pth[i-1][0], pth[i][1]-pth[i-1][1]); seg.push(total); }
  const r = {path:pth, seg, total:Math.max(1,total)};
  ROUTES.set(k, r);
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
const agentMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.4, 6, 5), new THREE.MeshBasicMaterial(), MAX_AG);
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
  a.r = route(a.cur, plan.length ? plan[0].node : endNode);
  agents.push(a);
  STATS.arrived[seg]++; STATS.byGate[gk]=(STATS.byGate[gk]||0)+1; dayTotal++;
}
function resetSim(){
  agents.length = 0; spawnAcc = 0; dayTotal = 0;
  STATS.arrived={in:0,dom:0,loc:0}; STATS.departed={}; STATS.byGate={}; STATS.atSpot={}; STATS.staying=0; STATS.castleEntered=0; STATS.dwellSum=0; STATS.dwellN=0; STATS.kaiyu=0;
  agentMesh.count = 0;
  calcArrNorm();
}
function updateAgents(dtMin){
  const sc = SCN[curScn];
  const perDay = sc.castle * CITY_FACTOR / AG_SCALE;
  spawnAcc += perDay * arrProfile(timeState.min)/ARR_NORM * dtMin;
  while(spawnAcc >= 1 && agents.length < MAX_AG){ spawnAcc -= 1; spawnAgent(); }
  const M = new THREE.Matrix4(), C = new THREE.Color();
  let vi=0, inCastle=0, moving=0, atSpotN=0;
  const spotNow = {};
  for(let i=agents.length-1;i>=0;i--){
    const a = agents[i];
    if(a.state==='move'){
      a.d += a.sp * dtMin;
      if(a.d >= a.r.total){
        if(a.pi < a.plan.length){
          const st = a.plan[a.pi];
          a.cur = {x:st.node.x, z:st.node.z};
          a.state = st.kind; a.dwellLeft = st.dwell;
          if(st.kind==='castle') STATS.castleEntered++;
          else { a.visited++; }
        } else {
          /* 退出: 帰路ゲート or 宿泊 */
          if(a.endKind==='stay'){ a.state='stay'; a.cur={x:a.endNode.x, z:a.endNode.z}; STATS.staying++; }
          else {
            STATS.departed[a.dest[0]] = (STATS.departed[a.dest[0]]||0)+1;
            STATS.dwellSum += timeState.min - a.t0; STATS.dwellN++;
            if(a.visited>0) STATS.kaiyu++;
            agents.splice(i,1); continue;
          }
        }
      } else {
        const p = sampleRoute(a.r, a.d);
        a.cur = {x:p[0], z:p[1]};
      }
    } else if(a.state==='castle' || a.state==='spot'){
      a.dwellLeft -= dtMin;
      if(a.state==='castle') inCastle++; else { atSpotN++; const nm=a.plan[a.pi].name; spotNow[nm]=(spotNow[nm]||0)+1; }
      if(a.dwellLeft <= 0){
        a.pi++;
        const next = a.pi < a.plan.length ? a.plan[a.pi].node : a.endNode;
        a.r = route(a.cur, next); a.d = 0; a.state='move';
      }
    }
    /* 描画（城内滞留中は城内ではなく周辺に薄く散らす / L2は別表現） */
    if(!segByFilter(a.seg) || !LAYER_STATE.agents) continue;
    if(a.state==='castle' && level==='castle') continue;
    let x=a.cur.x, z=a.cur.z, y=3.2;
    if(a.state==='castle'){ x = CASTLE.x - 60 + a.jx; z = CASTLE.z + 130 + a.jz; y=2.4; }
    else if(a.state==='spot'){ x += a.jx*0.35; z += a.jz*0.35; }
    else if(a.state==='stay'){ x += a.jx*0.15; z += a.jz*0.15; y=32; }
    if(a.state==='move') moving++;
    M.makeTranslation(x, y, z);
    agentMesh.setMatrixAt(vi, M);
    C.setHex(SEG[a.seg].col);
    agentMesh.setColorAt(vi, C);
    vi++;
  }
  agentMesh.count = vi;
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
      pts.push(r.p[i][0], 1.0, -r.p[i][1], r.p[i+1][0], 1.0, -r.p[i+1][1]);
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
  disc.rotation.x=-Math.PI/2; disc.position.set(z.node.x, 1.2, z.node.z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(36, 39, 40), new THREE.MeshBasicMaterial({color:0xffd166, transparent:true, opacity:0.7, depthWrite:false, side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.set(z.node.x, 1.4, z.node.z);
  disc.userData = {name:z.n, zone:true, desc:z.desc}; z.disc=disc; z.ring=ring;
  const lb = makeLabel(z.n, 9, '#ffd166'); lb.position.set(z.node.x, 46, z.node.z); z.lb=lb;
  zoneGroup.add(disc, ring, lb);
});
/* 城内ルート（大手門→三の丸→菱の門→いの門〜はの門→大天守→備前丸→出口） */
const CROUTE = (function(){
  const pts = [CZ(-37,465), CZ(-25,300), CZ(-20,240), CZ(-80,150), CZ(-110,120), CZ(-95,70), CZ(-40,50), CZ(-10,20), CZ(0,0), CZ(-20,25), CZ(-45,40), CZ(-70,90), CZ(-90,160), CZ(-30,250), CZ(-37,465)];
  const seg=[0]; let total=0;
  for(let i=1;i<pts.length;i++){ total+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z); seg.push(total); }
  return {path:pts.map(p=>[p.x,p.z]), seg, total};
})();
const CROUTE_LINE = new THREE.Line(new THREE.BufferGeometry().setFromPoints(CROUTE.path.map(p=>new THREE.Vector3(p[0], 2.2, p[1]))),
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
    M.makeTranslation(p[0]+((h%20)-10)*0.9, 2.0, p[1]+(((h>>8)%20)-10)*0.9);
    castleAg.setMatrixAt(i,M); C.setHex(SEG[w.seg].col); castleAg.setColorAt(i,C);
  });
  castleAg.count = castleWalkers.length;
  castleAg.instanceMatrix.needsUpdate = true;
  if(castleAg.instanceColor) castleAg.instanceColor.needsUpdate = true;
}
