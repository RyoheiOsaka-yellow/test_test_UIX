/* ================================================================
   新宿駅構内図3D — 地下 物理人流レイヤ (mathcat, 複数フロア連結版)
   b1_layer.js の一般化: フロアごとに独立したシミュ実体(場・SoA・CSR・電車)を
   持ち、階段/EV/ESC ポータルでエージェントをフロア間転送する。
   - フィールド配置(フロア毎): [0..5]=出口k-means群 / [6]=ポータル / [7..]=ホーム
   - 旅程: leg 0=直行 / 1=ポータル経由→他フロアの出口 / 2=ポータル経由→他フロアのホーム
   - 乱数は全フロア共有の xorshift128 → フロア順が固定なので全体が決定的
   - 描画は各フロアグループ(Zi.get(level))の子 → 表示切替・フロア展開に追従
   規約: 属性間SoA・成分内インターリーブ / op(out,...) アロケーションフリー /
         CSR 近傍索引を毎フレーム再構築
   ================================================================ */
(() => {
"use strict";
const PACKS = JSON.parse(document.getElementById('floorspack').textContent).floors;

const easing = { cubicOut: t => 1 - Math.pow(1-t,3), cubicIn: t => t*t*t };
const rand = (()=>{ // xorshift128 決定的乱数(全フロア共有)
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

const DT=1/60, AMAX=5.0, TAU=0.5, WALLR=0.40, WALLC=1.2, REP_A=4.0, REP_B=0.12;
const CB=Math.cos(0.30), SB=Math.sin(0.30);
const KEX=6, FIELD_PORTAL=6, FIELD_PLAT=7;
const NMAX=2000;                       // フロアあたり
const R=0.25, R2=2*R;
const T_APP=8, T_DWELL=25, T_DEP=8;
const CROSS_ALIGHT=0.35;               // 降車客がポータル経由で他フロアへ抜ける率
const CROSS_BOARD=0.30;                // 乗車客が他フロアのホームを目指す率
const BOARD_RATE={B1:2.2, B2:1.4};     // 乗車客湧出 (人/s)

let simT=0;
const M={ exited:0, boarded:0, transferred:0, wallHits:0, slides:0 };
const transferQ=[];                    // フロア間転送 {fi,x,y,kind,goal}
const tmp2=new Float32Array(2);

/* ---------- フロア実体 ---------- */
function makeFloor(pk, fi){
  const CELL=pk.cell, W=pk.W, H=pk.H, NC=W*H;

  // RLE → walk
  const walk=new Uint8Array(NC);
  { let i=0,v=0; for(const run of pk.rle){ if(v) walk.fill(1,i,i+run); i+=run; v^=1; } }

  // チャンファーSDF
  const sdf=new Float32Array(NC);
  { const INF=1e9,d=sdf;
    for(let i=0;i<NC;i++) d[i]=walk[i]?INF:0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; if(d[i]===0)continue;
      let m=d[i];
      if(x>0)     m=Math.min(m,d[i-1]+3);
      if(y>0){    m=Math.min(m,d[i-W]+3);
        if(x>0)   m=Math.min(m,d[i-W-1]+4);
        if(x<W-1) m=Math.min(m,d[i-W+1]+4); }
      d[i]=m; }
    for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){ const i=y*W+x; if(d[i]===0)continue;
      let m=d[i];
      if(x<W-1)   m=Math.min(m,d[i+1]+3);
      if(y<H-1){  m=Math.min(m,d[i+W]+3);
        if(x<W-1) m=Math.min(m,d[i+W+1]+4);
        if(x>0)   m=Math.min(m,d[i+W-1]+4); }
      d[i]=m; }
    const k=CELL/3; for(let i=0;i<NC;i++) d[i]=Math.min(d[i]*k,50);
  }

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
        const L=x>0,Rt=x<W-1,U=y>0,D=y<H-1;
        if(L&&walk[i-1]&&b+5<c[i-1]){c[i-1]=b+5;push(b+5,i-1);}
        if(Rt&&walk[i+1]&&b+5<c[i+1]){c[i+1]=b+5;push(b+5,i+1);}
        if(U&&walk[i-W]&&b+5<c[i-W]){c[i-W]=b+5;push(b+5,i-W);}
        if(D&&walk[i+W]&&b+5<c[i+W]){c[i+W]=b+5;push(b+5,i+W);}
        if(L&&U&&walk[i-1]&&walk[i-W]&&walk[i-W-1]&&b+7<c[i-W-1]){c[i-W-1]=b+7;push(b+7,i-W-1);}
        if(Rt&&U&&walk[i+1]&&walk[i-W]&&walk[i-W+1]&&b+7<c[i-W+1]){c[i-W+1]=b+7;push(b+7,i-W+1);}
        if(L&&D&&walk[i-1]&&walk[i+W]&&walk[i+W-1]&&b+7<c[i+W-1]){c[i+W-1]=b+7;push(b+7,i+W-1);}
        if(Rt&&D&&walk[i+1]&&walk[i+W]&&walk[i+W+1]&&b+7<c[i+W+1]){c[i+W+1]=b+7;push(b+7,i+W+1);}
      }
      buckets[b]=null;
    }
    return c;
  }
  const gi=(x,y)=>{
    let cx=(x/CELL)|0, cy=(y/CELL)|0;
    cx=cx<0?0:cx>=W?W-1:cx; cy=cy<0?0:cy>=H?H-1:cy; return cy*W+cx;
  };

  // 縦動線: links 有 = ポータル / 無 = 出口
  const portals=pk.verts.filter(v=>v.links&&v.links.length);
  const exits=pk.verts.filter(v=>!v.links||!v.links.length);
  // 出口 k-means 6群
  const exitGroup=new Uint8Array(exits.length);
  { const cx=new Float32Array(KEX), cy=new Float32Array(KEX);
    for(let k=0;k<KEX;k++){ const e=exits[(k*exits.length/KEX)|0]; cx[k]=e.x; cy[k]=e.y; }
    for(let it=0;it<20;it++){
      const sx=new Float32Array(KEX), sy=new Float32Array(KEX), n=new Uint16Array(KEX);
      for(let e=0;e<exits.length;e++){ let bk=0,bd=1e18;
        for(let k=0;k<KEX;k++){ const dx=exits[e].x-cx[k], dy=exits[e].y-cy[k], d=dx*dx+dy*dy;
          if(d<bd){bd=d;bk=k;} }
        exitGroup[e]=bk; sx[bk]+=exits[e].x; sy[bk]+=exits[e].y; n[bk]++; }
      for(let k=0;k<KEX;k++) if(n[k]){ cx[k]=sx[k]/n[k]; cy[k]=sy[k]/n[k]; }
    }
  }
  const PLATS=pk.platforms;
  function platformSeeds(p){
    const seeds=[], dx=p.x1-p.x0, dy=p.y1-p.y0, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    for(let t=0;t<=len;t+=CELL){
      for(let o=-2;o<=2;o+=CELL){
        const x=p.x0+ux*t-uy*o, y=p.y0+uy*t+ux*o, i=gi(x,y);
        if(walk[i]) seeds.push(i);
      } }
    return seeds;
  }

  // 場の構築ジョブ(呼び出し側でフレーム分割)
  const fields=[];
  const jobs=[];
  for(let k=0;k<KEX;k++) jobs.push(()=>{
    const seeds=[]; for(let e=0;e<exits.length;e++) if(exitGroup[e]===k) seeds.push(exits[e].gy*W+exits[e].gx);
    fields[k]=costField(seeds); });
  jobs.push(()=>{ fields[FIELD_PORTAL]=portals.length?
    costField(portals.map(v=>v.gy*W+v.gx)):null; });
  for(let p=0;p<PLATS.length;p++) jobs.push(()=> fields[FIELD_PLAT+p]=costField(platformSeeds(PLATS[p])));

  function sampleCost(f,x,y,ref){
    let fx=x/CELL-0.5, fy=y/CELL-0.5;
    let x0=Math.floor(fx), y0=Math.floor(fy);
    const tx=fx-x0, ty=fy-y0;
    x0=x0<0?0:x0>W-2?W-2:x0; y0=y0<0?0:y0>H-2?H-2:y0;
    const i00=y0*W+x0;
    const V=(i)=>{ const v=f[i]; return (v===65535||!walk[i])?ref+8:v; };
    const a=V(i00),b=V(i00+1),c=V(i00+W),d=V(i00+W+1);
    return a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+d*tx*ty;
  }
  function fieldDir(f,x,y,out){
    const i=gi(x,y);
    const c=f[i]===65535?1e6:f[i];
    const h=0.6, ref=c===1e6?30000:c;
    const gx=sampleCost(f,x+h,y,ref)-sampleCost(f,x-h,y,ref);
    const gy=sampleCost(f,x,y+h,ref)-sampleCost(f,x,y-h,ref);
    const n=Math.hypot(gx,gy);
    if(n<1e-6){ out[0]=0; out[1]=0; return c; }
    out[0]=-gx/n; out[1]=-gy/n; return c;
  }

  // SoA
  const pos=new Float32Array(2*NMAX), vel=new Float32Array(2*NMAX);
  const vdes=new Float32Array(NMAX), goal=new Uint8Array(NMAX);
  const kind=new Uint8Array(NMAX), leg=new Uint8Array(NMAX), tgt=new Uint8Array(NMAX);
  const born=new Float32Array(NMAX);
  let N=0;

  function spawn(x,y,fieldIdx,kd,lg,tg){
    if(N>=NMAX) return -1;
    let bi=-1,bd=1e18;
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
    goal[a]=fieldIdx; kind[a]=kd; leg[a]=lg||0; tgt[a]=tg||0; born[a]=simT;
    return a;
  }
  function kill(a){
    N--;
    pos[2*a]=pos[2*N]; pos[2*a+1]=pos[2*N+1];
    vel[2*a]=vel[2*N]; vel[2*a+1]=vel[2*N+1];
    vdes[a]=vdes[N]; goal[a]=goal[N]; kind[a]=kind[N]; leg[a]=leg[N]; tgt[a]=tgt[N]; born[a]=born[N];
  }

  // CSR 近傍ハッシュ
  const HCELL=1.0, HW=Math.ceil(W*CELL/HCELL), HH=Math.ceil(H*CELL/HCELL), HN=HW*HH;
  const hCount=new Uint16Array(HN), hOff=new Uint32Array(HN+1);
  const hIdx=new Uint32Array(NMAX), hKey=new Uint32Array(NMAX);
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

  // 電車
  const trains=PLATS.map((p,idx)=>{
    const dx=p.x1-p.x0, dy=p.y1-p.y0, len=Math.hypot(dx,dy);
    const tlen=Math.min(len-8,105);
    return { p, ux:dx/len, uy:dy/len, len, tlen,
      period:70+(fi*4+idx)*17, offset:(fi*4+idx)*22, doors:Math.max(4,(tlen/18)|0),
      alightLeft:0, emitAcc:0 };
  });
  function trainState(tr,t){
    const ph=((t+tr.offset)%tr.period+tr.period)%tr.period;
    if(ph<T_APP)               return {s:'app', u:easing.cubicOut(ph/T_APP)};
    if(ph<T_APP+T_DWELL)       return {s:'dwell',u:1};
    if(ph<T_APP+T_DWELL+T_DEP) return {s:'dep', u:easing.cubicIn((ph-T_APP-T_DWELL)/T_DEP)};
    return {s:'gone',u:0};
  }
  function doorXY(tr,d,out){
    const c=(tr.len-tr.tlen)/2 + tr.tlen*(d+0.5)/tr.doors;
    out[0]=tr.p.x0+tr.ux*c; out[1]=tr.p.y0+tr.uy*c;
  }
  const prevDwell=new Array(trains.length).fill(false);

  function nearestPortal(x,y){
    let best=null,bd=1e18;
    for(const v of portals){
      const d=(v.x-x)*(v.x-x)+(v.y-y)*(v.y-y);
      if(d<bd){bd=d;best=v;}
    }
    return best;
  }
  // 降車客の目的地決定
  function alightGoal(){
    if(portals.length && rand.f()<CROSS_ALIGHT) return {g:FIELD_PORTAL, lg:1, tg:0};
    return {g:(rand.f()*KEX)|0, lg:0, tg:0};
  }

  function step(other){
    // 電車イベント
    for(let ti=0;ti<trains.length;ti++){
      const tr=trains[ti], st=trainState(tr,simT);
      const dw=st.s==='dwell';
      if(dw&&!prevDwell[ti]){ tr.alightLeft=40+rand.poisson(20); tr.emitAcc=0; }
      if(dw&&tr.alightLeft>0){
        tr.emitAcc+=tr.doors*0.7*DT;
        while(tr.emitAcc>=1&&tr.alightLeft>0){
          tr.emitAcc-=1; tr.alightLeft--;
          const d=(rand.f()*tr.doors)|0;
          doorXY(tr,d,tmp2);
          const gd=alightGoal();
          spawn(tmp2[0]+rand.normal(0,0.5),tmp2[1]+rand.normal(0,0.5),gd.g,0,gd.lg,gd.tg);
        }
      }
      prevDwell[ti]=dw;
    }
    // 乗車客の湧出(出口から)
    const rate=BOARD_RATE[pk.name]??1.5;
    if(exits.length && rand.f()<rate*DT){
      const e=exits[(rand.f()*exits.length)|0];
      if(other && other.PLATS.length && portals.length && rand.f()<CROSS_BOARD){
        // 他フロアのホームへ: まずポータルへ
        spawn(e.x,e.y,FIELD_PORTAL,1,2,(rand.f()*other.PLATS.length)|0);
      } else if(PLATS.length){
        spawn(e.x,e.y,FIELD_PLAT+((rand.f()*PLATS.length)|0),1,0,0);
      }
    }
    rebuildHash();
    for(let a=0;a<N;a++){
      const ax=pos[2*a], ay=pos[2*a+1];
      const f=fields[goal[a]];
      const cost=fieldDir(f,ax,ay,tmp2);
      let gx=tmp2[0], gy=tmp2[1];
      let waiting=false;
      // 到達判定
      if(goal[a]===FIELD_PORTAL){
        if(cost<=10){ // ポータル到達 → 転送キューへ
          const v=nearestPortal(ax,ay);
          if(v){
            const lk=v.links[(rand.f()*v.links.length)|0];
            transferQ.push({fi:lk.floor, vi:lk.vi, kind:kind[a], leg:leg[a], tgt:tgt[a]});
            M.transferred++;
          }
          kill(a); a--; continue;
        }
      } else if(kind[a]===0){
        if(cost<=10){ M.exited++; kill(a); a--; continue; }
      } else {
        if(cost<=20){
          const pi=goal[a]-FIELD_PLAT, st=trainState(trains[pi],simT);
          if(st.s==='dwell'){ if(rand.f()<2.0*DT){ M.boarded++; kill(a); a--; continue; } }
          gx*=0.12; gy*=0.12; waiting=true;
        }
      }
      // 操舵 + 社会力(左側通行バイアス) + 壁力 — 単一フロア版と同一
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
            const m=REP_A*Math.exp((R2-d)/REP_B);
            const ux=dx/d, uy=dy/d;
            fx+=(ux*CB-uy*SB)*m; fy+=(ux*SB+uy*CB)*m;
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

  // 転送受け入れ: ポータル vi の位置に湧出
  function receive(t){
    const v=pk.verts[t.vi];
    if(!v) return;
    if(t.leg===1){       // 降車客: このフロアの出口へ
      spawn(v.x+rand.normal(0,1.2), v.y+rand.normal(0,1.2), (rand.f()*KEX)|0, 0, 0, 0);
    } else if(t.leg===2){ // 乗車客: このフロアのホーム tgt へ
      const p=Math.min(t.tgt, Math.max(0,PLATS.length-1));
      if(PLATS.length) spawn(v.x+rand.normal(0,1.2), v.y+rand.normal(0,1.2), FIELD_PLAT+p, 1, 0, 0);
    }
  }

  function reset(){ N=0; prevDwell.fill(false); for(const tr of trains){ tr.alightLeft=0; tr.emitAcc=0; } }

  return { pk, fi, W, H, CELL, walk, jobs, fields, PLATS, trains, trainState,
    portals, exits, pos, kind, get N(){return N;}, step, receive, spawn, reset };
}

const floors = PACKS.map((pk,fi)=>makeFloor(pk,fi));
// verts のグローバル index → 転送先解決のため、リンクは pk.verts の添字で保持されている
// (build_floors_pack.py 側で links[].vi は相手フロアの verts 添字)

/* ---------- 全体ステップ ---------- */
function stepAll(){
  simT+=DT;
  for(let i=0;i<floors.length;i++) floors[i].step(floors.length===2?floors[1-i]:null);
  // 転送フラッシュ(同一ステップ内到達分)
  while(transferQ.length){
    const t=transferQ.shift();
    floors[t.fi].receive(t);
  }
}

/* ================================================================
   ビューア統合
   ================================================================ */
let inited=false, mode='on';
let stepMs=0, acc=0, statT=0, statsEl=null;
const AGENT_Y=1.6;
const COL_ALIGHT=[1.0,0.62,0.28], COL_BOARD=[0.35,0.78,1.0];
const views=[];  // フロア毎の {group, pts, posAttr, colAttr, trainMeshes, ox, oz}

function init(app){
  const flow=app.flowPoints;
  const BufferGeometry=flow.geometry.constructor;
  const BufferAttribute=flow.geometry.attributes.position.constructor;
  const Points=flow.constructor;
  const PointsMaterial=flow.material.constructor;
  const fill=app.fillMeshes[0];
  const Mesh=fill.constructor;
  const MeshBasicMaterial=fill.material.constructor;

  const boxGeo=(()=>{
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

  for(const F of floors){
    const floorGroup=app.floors.get(F.pk.level);
    const Group=floorGroup.constructor;
    const group=new Group(); group.name='crowd-'+F.pk.name;
    floorGroup.add(group);
    const ox=F.pk.origin[0]-app.origin[0];
    const oz=-(F.pk.origin[1]-app.origin[1]);
    const g=new BufferGeometry();
    const posAttr=new BufferAttribute(new Float32Array(NMAX*3),3); posAttr.setUsage?.(35048);
    const colAttr=new BufferAttribute(new Float32Array(NMAX*3),3); colAttr.setUsage?.(35048);
    g.setAttribute('position',posAttr); g.setAttribute('color',colAttr);
    g.setDrawRange(0,0);
    const pts=new Points(g,new PointsMaterial({
      size:1.5, vertexColors:true, transparent:true, opacity:0.95,
      blending:2, depthWrite:false, sizeAttenuation:true }));
    pts.frustumCulled=false; pts.renderOrder=9;
    group.add(pts);
    const trainMeshes=[];
    for(const tr of F.trains){
      const mat=new MeshBasicMaterial({ color:0xff7fb2, transparent:true, opacity:0.16,
        depthWrite:false, side:2 });
      const mesh=new Mesh(boxGeo,mat);
      mesh.scale.set(tr.tlen,3.0,3.2);
      mesh.rotation.y=Math.atan2(tr.uy,tr.ux);
      mesh.renderOrder=8; mesh.frustumCulled=false;
      group.add(mesh); trainMeshes.push(mesh);
    }
    views.push({F, group, pts, posAttr, colAttr, trainMeshes, ox, oz});
  }

  const seg=document.getElementById('flow-presets');
  seg.insertAdjacentHTML('afterend',
    `<div class="sec-title" style="margin-top:10px">地下 物理人流 <span style="opacity:.55">mathcat / B1+B2 連結</span></div>
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
      for(const v of views) v.group.visible=mode!=='off';
    });
  });
  inited=true;
}

function updateRender(){
  for(const v of views){
    const F=v.F, pb=v.posAttr.array, cb=v.colAttr.array, n=F.N;
    for(let a=0;a<n;a++){
      pb[3*a]=F.pos[2*a]+v.ox;
      pb[3*a+1]=AGENT_Y;
      pb[3*a+2]=v.oz-F.pos[2*a+1];
      const c=F.kind[a]===0?COL_ALIGHT:COL_BOARD;
      cb[3*a]=c[0]; cb[3*a+1]=c[1]; cb[3*a+2]=c[2];
    }
    v.posAttr.needsUpdate=true; v.colAttr.needsUpdate=true;
    v.pts.geometry.setDrawRange(0,n);
    for(let i=0;i<F.trains.length;i++){
      const tr=F.trains[i], st=F.trainState(tr,simT), m=v.trainMeshes[i];
      if(st.s==='gone'){ m.visible=false; continue; }
      m.visible=true;
      const mid=tr.len/2;
      let c;
      if(st.s==='app') c=mid+(1-st.u)*(tr.len*0.9+60);
      else if(st.s==='dep') c=mid-st.u*(tr.len*0.9+60);
      else c=mid;
      m.position.set(tr.p.x0+tr.ux*c+v.ox, 0.2, v.oz-(tr.p.y0+tr.uy*c));
      m.material.opacity=st.s==='dwell'?0.34:0.16;
    }
  }
}

/* ---------- ティック(ビューアの vf から毎フレーム) ---------- */
const allJobs=[];
let jobI=0;
for(const F of floors) allJobs.push(...F.jobs);
const fieldsReady=()=>jobI>=allJobs.length;

window.__b1tick=(dt)=>{
  const app=window.__app;
  if(!app||!app.floors) return;
  if(!inited){
    if(document.getElementById('loading')) return;
    if(!app.fillMeshes.length) return;
    init(app);
    return;
  }
  if(!fieldsReady()){
    allJobs[jobI++]();                    // 1 ジョブ/フレーム
    if(fieldsReady()) statsEl.textContent='準備完了';
    return;
  }
  if(mode==='off') return;
  const t0=performance.now();
  let done=0;
  if(mode==='fast'){ for(let i=0;i<4;i++){ stepAll(); done++; } acc=0; }
  else { acc+=Math.min(dt,0.1); while(acc>=DT&&done<3){ stepAll(); acc-=DT; done++; } }
  if(done) stepMs=0.9*stepMs+0.1*(performance.now()-t0)/done;
  updateRender();
  statT+=dt;
  if(statT>0.5){
    statT=0;
    const parts=floors.map(F=>`${F.pk.name} ${F.N}`).join(' + ');
    const dwell=floors.reduce((s,F)=>s+F.trains.filter(tr=>F.trainState(tr,simT).s==='dwell').length,0);
    statsEl.textContent=
      `歩行者 ${parts} ／ 退出 ${M.exited} ／ 乗車 ${M.boarded} ／ 乗換 ${M.transferred} ／ `+
      `停車中 ${dwell}本 ／ 壁貫通 ${M.wallHits} ／ ${stepMs.toFixed(1)}ms/step`;
  }
};

// デバッグ・検証フック
window.__b1={ floors, M, stepAll, updateRender,
  get simT(){return simT;}, get inited(){return inited;}, fieldsReady,
  get views(){return views;} };
})();
