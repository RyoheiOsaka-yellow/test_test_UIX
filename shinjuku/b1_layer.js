/* ================================================================
   新宿駅構内図3D — B1 物理人流レイヤ (mathcat 移植)
   HANDOVER.md の垂直スライス(フローフィールド + 社会力 + 電車連動)を
   構内図ビューアのシーンへ統合する。物理は 2D/3D 版と同一・決定的。
   - window.__app フック(パッチで floors/floorH/origin/flowPoints を追加)経由で
     three.js のクラスを既存オブジェクトから収穫(バンドル内部名に非依存)
   - エージェント: 加算ブレンドの Points(頂点色: 降車=アンバー / 乗車=シアン)
   - 電車: 半透明ネオンボックス 4 本(B1 ホーム PCA 軸上)
   - すべて B1 フロアグループ(level=-1)の子 → フロア表示/展開スライダに追従
   - UI: 人流シミュレーションの下に「B1 物理人流(mathcat)」セグメント
   規約: 属性間SoA・成分内インターリーブ / op(out,...) アロケーションフリー /
         CSR 近傍索引を毎フレーム再構築 / xorshift128 決定的乱数
   ================================================================ */
(() => {
"use strict";
const PACK = JSON.parse(document.getElementById('b1pack').textContent);
const CELL = PACK.cell, W = PACK.W, H = PACK.H, NC = W*H;
const PACK_ORIGIN = [-12381.8, -34673.3]; // B1 グリッド原点 (EPSG:6677)

/* ---------- mathcat 抜粋 ---------- */
const easing = { cubicOut: t => 1 - Math.pow(1-t,3), cubicIn: t => t*t*t };
const rand = (()=>{ // xorshift128 決定的乱数
  let s0=0x9E3779B9|0, s1=0x243F6A88|0;
  function u32(){ let x=s0,y=s1; s0=y; x^=x<<23; s1=(x^y^(x>>>17)^(y>>>26))|0; return (s1+y)>>>0; }
  return {
    f: ()=>u32()/4294967296,
    normal(mu,sd){ const u=Math.max(this.f(),1e-9), v=this.f();
      return mu + sd*Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v); },
    poisson(lam){ const L=Math.exp(-lam); let k=0,p=1;
      do{ k++; p*=this.f(); }while(p>L); return k-1; },
    reset(){ s0=0x9E3779B9|0; s1=0x243F6A88|0; }
  };
})();

/* ---------- 1) RLE 展開 → 歩行可能マスク ---------- */
const walk = new Uint8Array(NC);
{ let i=0, v=0;
  for(const run of PACK.rle){ if(v) walk.fill(1,i,i+run); i+=run; v^=1; } }

/* ---------- 2) チャンファーSDF(壁距離, m) ---------- */
const sdf = new Float32Array(NC);
{ const INF=1e9, d=sdf;
  for(let i=0;i<NC;i++) d[i]=walk[i]?INF:0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; if(d[i]===0)continue;
    let m=d[i];
    if(x>0)          m=Math.min(m,d[i-1]+3);
    if(y>0){         m=Math.min(m,d[i-W]+3);
      if(x>0)        m=Math.min(m,d[i-W-1]+4);
      if(x<W-1)      m=Math.min(m,d[i-W+1]+4); }
    d[i]=m; }
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){ const i=y*W+x; if(d[i]===0)continue;
    let m=d[i];
    if(x<W-1)        m=Math.min(m,d[i+1]+3);
    if(y<H-1){       m=Math.min(m,d[i+W]+3);
      if(x<W-1)      m=Math.min(m,d[i+W+1]+4);
      if(x>0)        m=Math.min(m,d[i+W-1]+4); }
    d[i]=m; }
  const k=CELL/3; for(let i=0;i<NC;i++) d[i]=Math.min(d[i]*k, 50);
}

/* ---------- 3) コスト場(8近傍 Dijkstra, バケット付き) ---------- */
function costField(seeds){
  const c=new Uint16Array(NC).fill(65535);
  const buckets=[]; let maxb=0;
  const push=(cost,i)=>{ (buckets[cost]||(buckets[cost]=[])).push(i); if(cost>maxb)maxb=cost; };
  for(const s of seeds){ if(walk[s] && c[s]!==0){ c[s]=0; push(0,s); } }
  for(let b=0;b<=maxb;b++){
    const q=buckets[b]; if(!q)continue;
    for(let qi=0;qi<q.length;qi++){
      const i=q[qi]; if(c[i]!==b)continue;
      const x=i%W, y=(i-x)/W;
      const L=x>0, R=x<W-1, U=y>0, D=y<H-1;
      if(L&&walk[i-1]  &&b+5<c[i-1]  ){c[i-1]  =b+5;push(b+5,i-1);}
      if(R&&walk[i+1]  &&b+5<c[i+1]  ){c[i+1]  =b+5;push(b+5,i+1);}
      if(U&&walk[i-W]  &&b+5<c[i-W]  ){c[i-W]  =b+5;push(b+5,i-W);}
      if(D&&walk[i+W]  &&b+5<c[i+W]  ){c[i+W]  =b+5;push(b+5,i+W);}
      if(L&&U&&walk[i-1]&&walk[i-W]&&walk[i-W-1]&&b+7<c[i-W-1]){c[i-W-1]=b+7;push(b+7,i-W-1);}
      if(R&&U&&walk[i+1]&&walk[i-W]&&walk[i-W+1]&&b+7<c[i-W+1]){c[i-W+1]=b+7;push(b+7,i-W+1);}
      if(L&&D&&walk[i-1]&&walk[i+W]&&walk[i+W-1]&&b+7<c[i+W-1]){c[i+W-1]=b+7;push(b+7,i+W-1);}
      if(R&&D&&walk[i+1]&&walk[i+W]&&walk[i+W+1]&&b+7<c[i+W+1]){c[i+W+1]=b+7;push(b+7,i+W+1);}
    }
    buckets[b]=null;
  }
  return c;
}
const gi=(x,y)=>{
  let cx=(x/CELL)|0, cy=(y/CELL)|0;
  cx=cx<0?0:cx>=W?W-1:cx; cy=cy<0?0:cy>=H?H-1:cy; return cy*W+cx;
};

/* ---------- 4) 目的地: 出口 k-means 6群 + ホーム軸4本 ---------- */
const EXITS = PACK.dests;
const KEX = 6;
const exitGroup = new Uint8Array(EXITS.length);
{ const cx=new Float32Array(KEX), cy=new Float32Array(KEX);
  for(let k=0;k<KEX;k++){ const e=EXITS[(k*EXITS.length/KEX)|0]; cx[k]=e.x; cy[k]=e.y; }
  for(let it=0;it<20;it++){
    const sx=new Float32Array(KEX), sy=new Float32Array(KEX), n=new Uint16Array(KEX);
    for(let e=0;e<EXITS.length;e++){ let bk=0,bd=1e18;
      for(let k=0;k<KEX;k++){ const dx=EXITS[e].x-cx[k], dy=EXITS[e].y-cy[k], d=dx*dx+dy*dy;
        if(d<bd){bd=d;bk=k;} }
      exitGroup[e]=bk; sx[bk]+=EXITS[e].x; sy[bk]+=EXITS[e].y; n[bk]++; }
    for(let k=0;k<KEX;k++) if(n[k]){ cx[k]=sx[k]/n[k]; cy[k]=sy[k]/n[k]; }
  }
}
const PLATS = PACK.platforms;
function platformSeeds(p){
  const seeds=[], dx=p.x1-p.x0, dy=p.y1-p.y0, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
  for(let t=0;t<=len;t+=CELL){
    for(let o=-2;o<=2;o+=CELL){
      const x=p.x0+ux*t-uy*o, y=p.y0+uy*t+ux*o, i=gi(x,y);
      if(walk[i]) seeds.push(i);
    } }
  return seeds;
}

/* ---------- 5) 場の構築(フレーム分割) ---------- */
const fields = [];
const FIELD_PLAT = KEX;
const fieldJobs=[];
for(let k=0;k<KEX;k++) fieldJobs.push(()=>{
  const seeds=[]; for(let e=0;e<EXITS.length;e++) if(exitGroup[e]===k) seeds.push(EXITS[e].gy*W+EXITS[e].gx);
  fields[k]=costField(seeds); });
for(let p=0;p<PLATS.length;p++) fieldJobs.push(()=> fields[FIELD_PLAT+p]=costField(platformSeeds(PLATS[p])));
let fieldJobI=0;
const fieldsReady=()=>fieldJobI>=fieldJobs.length;

function sampleCost(f, x, y, ref){
  let fx=x/CELL-0.5, fy=y/CELL-0.5;
  let x0=Math.floor(fx), y0=Math.floor(fy);
  const tx=fx-x0, ty=fy-y0;
  x0=x0<0?0:x0>W-2?W-2:x0; y0=y0<0?0:y0>H-2?H-2:y0;
  const i00=y0*W+x0;
  const V=(i)=>{ const v=f[i]; return (v===65535||!walk[i]) ? ref+8 : v; };
  const a=V(i00), b=V(i00+1), c=V(i00+W), d=V(i00+W+1);
  return a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+d*tx*ty;
}
function fieldDir(f, x, y, out){
  const i=gi(x,y);
  const c=f[i]===65535?1e6:f[i];
  const h=0.6, ref=c===1e6?30000:c;
  const gx=sampleCost(f,x+h,y,ref)-sampleCost(f,x-h,y,ref);
  const gy=sampleCost(f,x,y+h,ref)-sampleCost(f,x,y-h,ref);
  const n=Math.hypot(gx,gy);
  if(n<1e-6){ out[0]=0; out[1]=0; return c; }
  out[0]=-gx/n; out[1]=-gy/n; return c;
}

/* ---------- 6) エージェント(SoA・インターリーブ) ---------- */
const NMAX=3000;
const pos = new Float32Array(2*NMAX);
const vel = new Float32Array(2*NMAX);
const vdes= new Float32Array(NMAX);
const goal= new Uint8Array(NMAX);
const kind= new Uint8Array(NMAX);   // 0=降車(→出口) 1=乗車(→ホーム)
const born= new Float32Array(NMAX);
let N=0;
const R=0.25, R2=2*R;

function spawn(x,y,fieldIdx,kd){
  if(N>=NMAX) return -1;
  let bi=-1, bd=1e18;
  const cx0=(x/CELL)|0, cy0=(y/CELL)|0, RR=6;
  for(let dy=-RR;dy<=RR;dy++)for(let dx=-RR;dx<=RR;dx++){
    const cx=cx0+dx, cy=cy0+dy;
    if(cx<0||cy<0||cx>=W||cy>=H) continue;
    const i=cy*W+cx; if(!walk[i]) continue;
    const d=dx*dx+dy*dy; if(d<bd){bd=d;bi=i;}
  }
  if(bi<0) return -1;
  const px=(bi%W+0.5)*CELL, py=(((bi-bi%W)/W)+0.5)*CELL;
  const a=N++;
  let jx=px+rand.normal(0,0.25), jy=py+rand.normal(0,0.25);
  if(!walk[gi(jx,jy)]){ jx=px; jy=py; }
  pos[2*a]=jx; pos[2*a+1]=jy;
  vel[2*a]=0; vel[2*a+1]=0;
  vdes[a]=Math.min(1.9,Math.max(0.8,rand.normal(1.34,0.2)));
  goal[a]=fieldIdx; kind[a]=kd; born[a]=simT;
  return a;
}
function kill(a){
  N--;
  pos[2*a]=pos[2*N]; pos[2*a+1]=pos[2*N+1];
  vel[2*a]=vel[2*N]; vel[2*a+1]=vel[2*N+1];
  vdes[a]=vdes[N]; goal[a]=goal[N]; kind[a]=kind[N]; born[a]=born[N];
}

/* ---------- 7) CSR 近傍ハッシュ ---------- */
const HCELL=1.0, HW=Math.ceil(W*CELL/HCELL), HH=Math.ceil(H*CELL/HCELL), HN=HW*HH;
const hCount=new Uint16Array(HN);
const hOff  =new Uint32Array(HN+1);
const hIdx  =new Uint32Array(NMAX);
const hKey  =new Uint32Array(NMAX);
function rebuildHash(){
  hCount.fill(0);
  for(let a=0;a<N;a++){
    let cx=(pos[2*a]/HCELL)|0, cy=(pos[2*a+1]/HCELL)|0;
    cx=cx<0?0:cx>=HW?HW-1:cx; cy=cy<0?0:cy>=HH?HH-1:cy;
    const k=cy*HW+cx; hKey[a]=k; hCount[k]++;
  }
  hOff[0]=0; for(let i=0;i<HN;i++) hOff[i+1]=hOff[i]+hCount[i];
  const cur=hCount; cur.fill(0);
  for(let a=0;a<N;a++){ const k=hKey[a]; hIdx[hOff[k]+cur[k]++]=a; }
}

/* ---------- 8) 電車 ---------- */
const trains = PLATS.map((p,idx)=>{
  const dx=p.x1-p.x0, dy=p.y1-p.y0, len=Math.hypot(dx,dy);
  const tlen=Math.min(len-8, 105);
  return { p, ux:dx/len, uy:dy/len, len, tlen,
    period: 70+idx*17, offset: idx*22, doors: Math.max(4,(tlen/18)|0),
    alightLeft: 0, emitAcc: 0 };
});
const T_APP=8, T_DWELL=25, T_DEP=8;
function trainState(tr, t){
  const ph=((t+tr.offset)%tr.period+tr.period)%tr.period;
  if(ph<T_APP)              return {s:'app',  u:easing.cubicOut(ph/T_APP)};
  if(ph<T_APP+T_DWELL)      return {s:'dwell',u:1};
  if(ph<T_APP+T_DWELL+T_DEP)return {s:'dep',  u:easing.cubicIn((ph-T_APP-T_DWELL)/T_DEP)};
  return {s:'gone',u:0};
}
function doorXY(tr, d, out){
  const c=(tr.len-tr.tlen)/2 + tr.tlen*(d+0.5)/tr.doors;
  out[0]=tr.p.x0+tr.ux*c; out[1]=tr.p.y0+tr.uy*c;
}
const prevDwell=new Array(trains.length).fill(false);

/* ---------- 9) 計測 ---------- */
const M = { exited:0, boarded:0, wallHits:0, slides:0, overlapPairs:0, pairChecks:0 };

/* ---------- 10) 物理ステップ(2D/3D 版と同一) ---------- */
const DT=1/60, AMAX=5.0, TAU=0.5, WALLR=0.40, WALLC=1.2, REP_A=4.0, REP_B=0.12;
const CB=Math.cos(0.30), SB=Math.sin(0.30);
const tmp2=new Float32Array(2);
let simT=0;
function stepSim(){
  simT+=DT;
  for(let ti=0;ti<trains.length;ti++){
    const tr=trains[ti], st=trainState(tr,simT);
    const dw= st.s==='dwell';
    if(dw && !prevDwell[ti]){ tr.alightLeft = 40 + rand.poisson(20); tr.emitAcc=0; }
    if(dw && tr.alightLeft>0){
      tr.emitAcc += tr.doors*0.7*DT;
      while(tr.emitAcc>=1 && tr.alightLeft>0){
        tr.emitAcc-=1; tr.alightLeft--;
        const d=(rand.f()*tr.doors)|0;
        doorXY(tr,d,tmp2);
        spawn(tmp2[0]+rand.normal(0,0.5), tmp2[1]+rand.normal(0,0.5),
              (rand.f()*KEX)|0, 0);
      }
    }
    prevDwell[ti]=dw;
  }
  if(rand.f() < 2.2*DT){
    const e=EXITS[(rand.f()*EXITS.length)|0];
    spawn(e.x, e.y, FIELD_PLAT+((rand.f()*PLATS.length)|0), 1);
  }
  rebuildHash();
  M.overlapPairs=0; M.pairChecks=0;
  for(let a=0;a<N;a++){
    const ax=pos[2*a], ay=pos[2*a+1];
    const cost=fieldDir(fields[goal[a]], ax, ay, tmp2);
    let gx=tmp2[0], gy=tmp2[1];
    let waiting=false;
    if(kind[a]===0){
      if(cost<=10){ M.exited++; kill(a); a--; continue; }
    } else {
      if(cost<=20){
        const pi=goal[a]-FIELD_PLAT, st=trainState(trains[pi],simT);
        if(st.s==='dwell'){ if(rand.f()<2.0*DT){ M.boarded++; kill(a); a--; continue; } }
        gx*=0.12; gy*=0.12; waiting=true;
      }
    }
    let fx=(gx*vdes[a]-vel[2*a])/TAU, fy=(gy*vdes[a]-vel[2*a+1])/TAU;
    { let cx=(ax/HCELL)|0, cy=(ay/HCELL)|0;
      cx=cx<1?1:cx>=HW-1?HW-2:cx; cy=cy<1?1:cy>=HH-1?HH-2:cy;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        const k=(cy+oy)*HW+cx+ox;
        for(let q=hOff[k];q<hOff[k+1];q++){
          const b=hIdx[q]; if(b===a) continue;
          const dx=ax-pos[2*b], dy=ay-pos[2*b+1];
          const d2=dx*dx+dy*dy; if(d2>2.25) continue;
          const d=Math.sqrt(d2)||1e-4;
          M.pairChecks++;
          if(d<0.9*R2 && b>a) M.overlapPairs++;
          const m=REP_A*Math.exp((R2-d)/REP_B);
          const ux=dx/d, uy=dy/d;
          fx+=(ux*CB - uy*SB)*m; fy+=(ux*SB + uy*CB)*m;
        } } }
    const ci=gi(ax,ay), sd=sdf[ci];
    if(sd<WALLC){
      const xr=ci%W;
      const sl=xr>0?sdf[ci-1]:0, sr=xr<W-1?sdf[ci+1]:0;
      const su=ci>=W?sdf[ci-W]:0, sdn=ci<NC-W?sdf[ci+W]:0;
      let wx=sr-sl, wy=sdn-su; const wn=Math.hypot(wx,wy)||1e-4;
      const t=1-sd/WALLC;
      let m=2.6*t*t;
      if(sd<WALLR) m+=16*(WALLR-sd);
      fx+=wx/wn*m; fy+=wy/wn*m;
    }
    const fn=Math.hypot(fx,fy);
    if(fn>AMAX){ fx*=AMAX/fn; fy*=AMAX/fn; }
    vel[2*a]+=fx*DT; vel[2*a+1]+=fy*DT;
    const sp=Math.hypot(vel[2*a],vel[2*a+1]);
    if(sp>2.2){ vel[2*a]*=2.2/sp; vel[2*a+1]*=2.2/sp; }
    let nx=ax+vel[2*a]*DT, ny=ay+vel[2*a+1]*DT;
    const XM=W*CELL-0.01, YM=H*CELL-0.01;
    nx=nx<0.01?0.01:nx>XM?XM:nx; ny=ny<0.01?0.01:ny>YM?YM:ny;
    if(!walk[gi(nx,ny)]){
      M.slides++;
      if(walk[gi(nx,ay)]){ ny=ay; vel[2*a+1]=0; }
      else if(walk[gi(ax,ny)]){ nx=ax; vel[2*a]=0; }
      else { nx=ax; ny=ay; vel[2*a]=0; vel[2*a+1]=0; }
    }
    if(!walk[gi(nx,ny)]){
      M.wallHits++;
      let bi=-1,bd=1e18; const cx0=(nx/CELL)|0, cy0=(ny/CELL)|0;
      for(let dy2=-3;dy2<=3;dy2++)for(let dx2=-3;dx2<=3;dx2++){
        const cx=cx0+dx2, cy=cy0+dy2;
        if(cx<0||cy<0||cx>=W||cy>=H) continue;
        const ii=cy*W+cx; if(!walk[ii]) continue;
        const dd=dx2*dx2+dy2*dy2; if(dd<bd){bd=dd;bi=ii;} }
      if(bi>=0){ nx=(bi%W+0.5)*CELL; ny=(((bi-bi%W)/W)+0.5)*CELL; }
      vel[2*a]=0; vel[2*a+1]=0;
    }
    pos[2*a]=nx; pos[2*a+1]=ny;
  }
}

/* ================================================================
   11) ビューア統合(three.js クラスは __app の既存オブジェクトから収穫)
   ================================================================ */
let inited=false, mode='on';   // 'off' | 'on' | 'fast'
let group=null, agentPts=null, agentPosAttr=null, agentColAttr=null;
let trainMeshes=[], statsEl=null, stepMs=0, acc=0, statT=0;

// シミュ座標 → B1 フロアグループのローカル座標
const OX = PACK_ORIGIN[0], OY = PACK_ORIGIN[1];
let ox=0, oz=0; // init 時に __app.origin から確定
const AGENT_Y = 1.6;

// 頂点色(加算ブレンドで映えるネオン)
const COL_ALIGHT=[1.0,0.62,0.28], COL_BOARD=[0.35,0.78,1.0];

function init(app){
  const flow=app.flowPoints;
  const BufferGeometry=flow.geometry.constructor;
  const BufferAttribute=flow.geometry.attributes.position.constructor;
  const Points=flow.constructor;
  const PointsMaterial=flow.material.constructor;
  const floorB1=app.floors.get(-1);
  const Group=floorB1.constructor;
  const fill=app.fillMeshes[0];
  const Mesh=fill.constructor;
  const MeshBasicMaterial=fill.material.constructor;

  ox = OX - app.origin[0];           // sceneX = simX + ox
  oz = -(OY - app.origin[1]);        // sceneZ = oz - simY

  group=new Group(); group.name='b1-crowd';
  floorB1.add(group);                // B1 の表示切替・フロア展開に追従

  // --- エージェント Points(頂点色・加算ブレンド) ---
  const g=new BufferGeometry();
  const pbuf=new Float32Array(NMAX*3), cbuf=new Float32Array(NMAX*3);
  agentPosAttr=new BufferAttribute(pbuf,3); agentPosAttr.setUsage?.(35048);
  agentColAttr=new BufferAttribute(cbuf,3); agentColAttr.setUsage?.(35048);
  g.setAttribute('position',agentPosAttr);
  g.setAttribute('color',agentColAttr);
  g.setDrawRange(0,0);
  agentPts=new Points(g,new PointsMaterial({
    size:1.5, vertexColors:true, transparent:true, opacity:0.95,
    blending:2 /*Additive*/, depthWrite:false, sizeAttenuation:true
  }));
  agentPts.frustumCulled=false; agentPts.renderOrder=9;
  group.add(agentPts);

  // --- 電車(半透明ネオンボックス) ---
  const boxGeo=(()=>{ // x∈[-.5,.5], y∈[0,1], z∈[-.5,.5]
    const V=[],I=[];
    const v=[[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[-.5,1,-.5],[.5,1,-.5],[.5,1,.5],[-.5,1,.5]];
    const quads=[[0,1,5,4],[2,3,7,6],[1,2,6,5],[3,0,4,7],[4,5,6,7],[3,2,1,0]];
    for(const q of quads){ const b=V.length/3;
      for(const vi of q) V.push(v[vi][0],v[vi][1],v[vi][2]);
      I.push(b,b+1,b+2,b,b+2,b+3); }
    const geo=new BufferGeometry();
    geo.setAttribute('position',new BufferAttribute(new Float32Array(V),3));
    geo.setIndex(I);
    return geo;
  })();
  for(const tr of trains){
    const mat=new MeshBasicMaterial({ color:0xff7fb2, transparent:true, opacity:0.16,
      depthWrite:false, side:2 });
    const mesh=new Mesh(boxGeo,mat);
    mesh.scale.set(tr.tlen,3.0,3.2);
    mesh.rotation.y=Math.atan2(tr.uy,tr.ux);
    mesh.renderOrder=8; mesh.frustumCulled=false;
    group.add(mesh);
    trainMeshes.push(mesh);
  }

  // --- UI(人流シミュレーションの直下に挿入) ---
  const seg=document.getElementById('flow-presets');
  seg.insertAdjacentHTML('afterend',
    `<div class="sec-title" style="margin-top:10px">B1 物理人流 <span style="opacity:.55">mathcat</span></div>
     <div class="seg-row" id="b1-mode">
       <button data-m="off">オフ</button>
       <button data-m="on" class="active">オン</button>
       <button data-m="fast">4×速</button>
     </div>
     <div class="hint" id="b1-stats" style="margin-top:6px">場を構築中…</div>`);
  statsEl=document.getElementById('b1-stats');
  document.querySelectorAll('#b1-mode button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#b1-mode button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      mode=b.dataset.m;
      group.visible = mode!=='off';
    });
  });
  inited=true;
}

function updateRender(){
  const pb=agentPosAttr.array, cb=agentColAttr.array;
  for(let a=0;a<N;a++){
    pb[3*a]  =pos[2*a]+ox;
    pb[3*a+1]=AGENT_Y;
    pb[3*a+2]=oz-pos[2*a+1];
    const c=kind[a]===0?COL_ALIGHT:COL_BOARD;
    cb[3*a]=c[0]; cb[3*a+1]=c[1]; cb[3*a+2]=c[2];
  }
  agentPosAttr.needsUpdate=true; agentColAttr.needsUpdate=true;
  agentPts.geometry.setDrawRange(0,N);
  for(let i=0;i<trains.length;i++){
    const tr=trains[i], st=trainState(tr,simT), m=trainMeshes[i];
    if(st.s==='gone'){ m.visible=false; continue; }
    m.visible=true;
    const mid=tr.len/2;
    let c;
    if(st.s==='app') c=mid + (1-st.u)*(tr.len*0.9+60);
    else if(st.s==='dep') c=mid - st.u*(tr.len*0.9+60);
    else c=mid;
    m.position.set(tr.p.x0+tr.ux*c+ox, 0.2, oz-(tr.p.y0+tr.uy*c));
    m.material.opacity = st.s==='dwell' ? 0.34 : 0.16;
  }
}

/* ---------- ティック(ビューアの vf からパッチ経由で毎フレーム呼出) ---------- */
window.__b1tick=(dt)=>{
  const app=window.__app;
  if(!app || !app.floors) return;
  if(!inited){
    if(document.getElementById('loading')) return;  // データ読み込み中
    if(!app.fillMeshes.length) return;
    init(app);
    return;
  }
  if(!fieldsReady()){
    // 場の構築をフレーム分割(1 ジョブ/フレーム)
    fieldJobs[fieldJobI++]();
    if(fieldsReady()) statsEl.textContent='準備完了';
    return;
  }
  if(mode==='off') return;
  const t0=performance.now();
  let done=0;
  if(mode==='fast'){ for(let i=0;i<4;i++){ stepSim(); done++; } acc=0; }
  else { acc+=Math.min(dt,0.1); while(acc>=DT && done<3){ stepSim(); acc-=DT; done++; } }
  if(done) stepMs=0.9*stepMs+0.1*(performance.now()-t0)/done;
  updateRender();
  statT+=dt;
  if(statT>0.5){
    statT=0;
    const dwell=trains.filter(tr=>trainState(tr,simT).s==='dwell').length;
    statsEl.textContent=
      `歩行者 ${N} ／ 退出 ${M.exited} ／ 乗車 ${M.boarded} ／ 停車中 ${dwell}本 ／ `+
      `壁貫通 ${M.wallHits} ／ ${stepMs.toFixed(1)}ms/step`;
  }
};

// デバッグ・検証フック
window.__b1={ stepSim, get N(){return N;}, M, get simT(){return simT;},
  trains, trainState, updateRender, get inited(){return inited;},
  fieldsReady, get group(){return group;} };
})();
