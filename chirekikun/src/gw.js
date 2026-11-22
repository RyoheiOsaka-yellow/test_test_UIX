/* ══════════ 地下水汚染が到達し得る距離 ══════════
   環境省「地下水汚染が到達し得る距離の計算ツール（令和3年4月1日以降の基準が適用される場合）」と同じ計算を行う。
   出典：https://www.env.go.jp/water/dojo/law/kaisei2009.html（ツール本体：/content/900540073.xlsx、マニュアル：/content/900540079.pdf）
   ・計算式：2次元平面のドメニコ解析式（汚染源の中心線上 y=0、経過時間100年）
       C(x,t)=Cgw × exp{x/(2αx)·(1−√(1+4λαx/v))} × erfc{(x−v·t/R·√(1+4λαx/v))/(2√(αx·v·t/R))}/2 × erf{Sw/(4√(αy·x))}
       v=k·i/ne（実流速）、R=1+Kd·ρd/ne（遅延係数）、λ=ln2/半減期、Kd=Koc×foc（Kdの設定が無い物質）
   ・到達距離：C が地下水基準以下になる最小の x。ツールと同じ手順（10万m→1万m→1,000m→100m→10m→1m刻み）で探す。
   ・ランク別到達距離：100m以下は10m単位、500m以下は50m単位、それを超えると100m単位に切り上げ。
   ・パラメーターは、ツールの「パラメーター 一覧表」の値。tests/gw.js が、ツール本体で再計算した値と照合する。 */
const GW_TOOL={name:'地下水汚染が到達し得る距離の計算ツール（令和3年4月1日以降の基準が適用される場合）',org:'環境省',url:'https://www.env.go.jp/water/dojo/law/kaisei2009.html',manual:'https://www.env.go.jp/content/900540079.pdf',checkedOn:'2026-11-22'};
/* 土質：透水係数 k(m/s)、有効間隙率 ne、間隙率 n、乾燥土壌密度 ρd(t/m3)＝土粒子密度2.7×(1−n)、有機性炭素含有率 foc(g/g) */
const GW_SOILS=[
 {id:'gravel',name:'礫',k:1e-3,ne:0.2,n:0.4,rd:1.62,foc:0.0005,ex:'玉石、礫（粗礫、中礫、細礫を含む）'},
 {id:'sandgravel',name:'砂礫',k:1e-4,ne:0.2,n:0.4,rd:1.62,foc:0.0005,ex:'砂礫、礫質土'},
 {id:'sand',name:'砂',k:3e-5,ne:0.3,n:0.4,rd:1.62,foc:0.001,ex:'砂質土、砂（細砂、中砂、粗砂を含む）'},
 {id:'ash',name:'火山灰質土',k:1e-5,ne:0.2,n:0.6,rd:1.08,foc:0.01,ex:'関東ローム、火山灰質粘性土、凝灰質シルト'},
 {id:'siltsand',name:'シルト質砂',k:1e-6,ne:0.15,n:0.45,rd:1.485,foc:0.001,ex:'シルト、粘性土、有機質土、シルト質砂'},
];
/* 物質：sub＝本システムの物質ID、tool＝ツール上の物質名、Sw 汚染源幅(m)、Cgw 汚染源の地下水濃度(mg/L)、Kd(L/kg。0はKoc×focで求める)、
   half 半減期(年。0は分解なし)、Koc(L/kg)、ax・ay 縦・横分散長(m)、std 地下水基準(mg/L)、gen 一般値(m) */
const GW_SUBS=[
 {sub:'VC',tool:'クロロエチレン',sw:10,cgw:100,kd:0,half:7.9,koc:19,ax:100,ay:10,std:0.002,gen:1000},
 {sub:'DCM',tool:'ジクロロメタン',sw:10,cgw:100,kd:0,half:4.5,koc:12,ax:100,ay:10,std:0.02,gen:1000},
 {sub:'CCl4',tool:'四塩化炭素',sw:10,cgw:100,kd:0,half:4.5,koc:49,ax:100,ay:10,std:0.002,gen:1000},
 {sub:'12DCA',tool:'1,2-ジクロロエタン',sw:10,cgw:100,kd:0,half:2,koc:17,ax:100,ay:10,std:0.004,gen:1000},
 {sub:'11DCE',tool:'1,1-ジクロロエチレン',sw:10,cgw:100,kd:0,half:7.9,koc:35,ax:100,ay:10,std:0.1,gen:1000},
 {sub:'12DCE',tool:'シス-1,2-ジクロロエチレン',sw:10,cgw:100,kd:0,half:7.9,koc:36,ax:100,ay:10,std:0.04,gen:1000},
 {sub:'',tool:'トランス-1,2-ジクロロエチレン',sw:10,cgw:100,kd:0,half:7.9,koc:36,ax:100,ay:10,std:0.04,gen:1000},
 {sub:'111TCA',tool:'1,1,1-トリクロロエタン',sw:10,cgw:100,kd:0,half:2,koc:81,ax:100,ay:10,std:1,gen:1000},
 {sub:'112TCA',tool:'1,1,2-トリクロロエタン',sw:10,cgw:100,kd:0,half:2,koc:50,ax:100,ay:10,std:0.006,gen:1000},
 {sub:'TCE',tool:'トリクロロエチレン',sw:10,cgw:100,kd:0,half:7.9,koc:68,ax:100,ay:10,std:0.01,gen:1000},
 {sub:'PCE',tool:'テトラクロロエチレン',sw:10,cgw:100,kd:0,half:7.9,koc:160,ax:100,ay:10,std:0.01,gen:1000},
 {sub:'13DCP',tool:'1,3-ジクロロプロペン',sw:10,cgw:100,kd:0,half:0.03,koc:46,ax:100,ay:10,std:0.002,gen:1000},
 {sub:'BZ',tool:'ベンゼン',sw:10,cgw:100,kd:0,half:2,koc:59,ax:100,ay:10,std:0.01,gen:1000},
 {sub:'Pb',tool:'鉛',sw:5,cgw:10,kd:10,half:0,koc:0,ax:8,ay:0.8,std:0.01,gen:80},
 {sub:'Cd',tool:'カドミウム',sw:5,cgw:10,kd:11,half:0,koc:0,ax:8,ay:0.8,std:0.003,gen:80},
 {sub:'Hg',tool:'水銀',sw:5,cgw:10,kd:7.9,half:0,koc:0,ax:8,ay:0.8,std:0.0005,gen:80},
 {sub:'As',tool:'砒素',sw:5,cgw:10,kd:4,half:0,koc:0,ax:25,ay:2.5,std:0.01,gen:250},
 {sub:'Cr6',tool:'六価クロム',sw:5,cgw:30,kd:1,half:0,koc:0,ax:50,ay:5,std:0.05,gen:500},
 {sub:'F',tool:'ふっ素',sw:5,cgw:30,kd:1,half:0,koc:0,ax:25,ay:2.5,std:0.8,gen:250},
 {sub:'B',tool:'ほう素',sw:5,cgw:30,kd:0.1,half:0,koc:0,ax:25,ay:2.5,std:1,gen:250},
 {sub:'Se',tool:'セレン',sw:5,cgw:10,kd:5,half:0,koc:0,ax:8,ay:0.8,std:0.01,gen:80},
 {sub:'CN',tool:'シアン',sw:5,cgw:100,kd:9.9,half:0,koc:0,ax:8,ay:0.8,std:0.1,gen:80},
 {sub:'SIM',tool:'シマジン',sw:5,cgw:10,kd:0,half:0.49,koc:300,ax:8,ay:0.8,std:0.003,gen:80},
 {sub:'THI',tool:'チウラム',sw:5,cgw:10,kd:0,half:0.19,koc:670,ax:8,ay:0.8,std:0.006,gen:80},
 {sub:'TBC',tool:'チオベンカルブ',sw:5,cgw:10,kd:0,half:0.22,koc:900,ax:8,ay:0.8,std:0.02,gen:80},
 {sub:'PCB',tool:'PCB',sw:5,cgw:10,kd:0,half:0,koc:250000,ax:8,ay:0.8,std:0.0005,gen:80},
 {sub:'OP',tool:'有機リン',sw:5,cgw:10,kd:0,half:0.16,koc:650,ax:8,ay:0.8,std:0.1,gen:80},
];
const GW_YEARS=100;          /* 評価する経過時間（年） */
const GW_MIN_I=1/10000;      /* 標高差が無い場合に入力する動水勾配（マニュアル 1-2-3(4)） */

/* 誤差関数。|x|<3 は級数、それ以上は連分数（相補誤差関数）で、倍精度の範囲で求める */
function gwErfc(x){
  if(x<0)return 2-gwErfc(-x);
  if(x<3){let sum=x,term=x,n=0;while(Math.abs(term)>1e-17*Math.abs(sum)&&n<200){n++;term*=-x*x/n;sum+=term/(2*n+1);}return 1-2/Math.sqrt(Math.PI)*sum;}
  if(x>27)return 0;
  /* erfc(x)=exp(−x²)/(x√π)·1/(1+1/(2x²)/(1+2/(2x²)/(1+…))) */
  let f=0;for(let k=60;k>=1;k--)f=k/2/(x+f);
  return Math.exp(-x*x)/Math.sqrt(Math.PI)/(x+f);
}
const gwErf=x=>1-gwErfc(x);

/* 土質・物質・動水勾配から、計算に使う量をそろえる */
function gwParams(sub,soil,i){
  const kd=sub.kd||sub.koc*soil.foc;const ky=soil.k*86400*365;const v=ky*i/soil.ne;const R=1+kd*soil.rd/soil.ne;
  const lam=sub.half?Math.LN2/sub.half:0;const s=Math.sqrt(1+4*lam*sub.ax/v);
  return {kd,ky,v,R,lam,s};
}
/* 汚染源から下流 x(m) の地点の、t 年後の地下水濃度(mg/L) */
function gwConc(sub,p,x,t){
  const a=p.v*t/p.R;
  return sub.cgw*Math.exp(x/(2*sub.ax)*(1-p.s))*gwErfc((x-a*p.s)/(2*Math.sqrt(sub.ax*a)))/2*gwErf(sub.sw/(4*Math.sqrt(sub.ay*x)));
}
/* ランク別到達距離（ツールの丸め方） */
function gwRank(d){if(!isFinite(d))return Infinity;const up=(v,m)=>Math.ceil(v/m-1e-9)*m;return d>500?up(d,100):d>100?up(d/5,10)*5:up(d,10);}
/* 到達距離：ツールと同じ段階的な探索。返り値 d は m（1,000,000m を超えるときは Infinity） */
function gwReach(sub,soil,i){
  if(!(i>0))return null;
  const p=gwParams(sub,soil,i);const ok=x=>gwConc(sub,p,x,GW_YEARS)<=sub.std;const BIG=1000000;
  const first=xs=>{const hit=xs.filter(ok);return hit.length?Math.min.apply(null,hit):BIG;};
  const seq=(n,f)=>Array.from({length:n},(_,k)=>f(k));
  const k1=first(seq(10,k=>100000*(k+1)));
  const u=first(seq(9,k=>k1-100000+10000*(k+1)));
  const ad=first(seq(10,k=>u-10000+1000*(k+1)));
  const an=first(seq(10,k=>ad-100*k));
  const ax=first(seq(10,k=>an-10*k));
  let x=ax+5;const last=[x];for(let k=1;k<21;k++){x=x-1>0?x-1:0.1;last.push(x);}
  const bi=first(last);const d=bi>=BIG?Infinity:bi;
  return {d,rank:gwRank(d),v:p.v,R:p.R,kd:p.kd,lam:p.lam,conc:isFinite(d)?gwConc(sub,p,d,GW_YEARS):null};
}
/* 案件の条件（土質・動水勾配）をそろえる。土質が不明なら、過小に算出しないよう「礫」（マニュアル 1-2-3(3)）。
   動水勾配は、指定が無ければ標高（国土地理院 標高API）から求めた地形の勾配。標高差が無ければ 1/10,000 */
function gwSetup(c){
  const g=c.gw||{};const e=(c.site||{}).gwElev;
  const soil=GW_SOILS.find(x=>x.id===g.soil)||GW_SOILS[0];
  let i=null,iSrc='';
  if(+g.i>0){i=+g.i;iSrc='担当者の入力';}
  else if(e&&isFinite(e.drop)&&e.r>0){const raw=e.drop/e.r;i=raw>GW_MIN_I?raw:GW_MIN_I;
    iSrc=raw>GW_MIN_I?`標高からの概算（対象地 ${e.elev.toFixed(1)}m、${e.r}m先の最も低い地点との標高差 ${e.drop.toFixed(1)}m）`:'周囲との標高差がほぼ無いため、1/10,000（計算ツールのマニュアルの扱い）';}
  return {soil,soilKnown:!!g.soil,i,iSrc,iManual:+g.i>0};
}
/* 案件の物質ごとの到達距離。対象物質が選ばれていればその物質、無ければ全物質 */
function gwTable(c){
  const st=gwSetup(c);if(!st.i)return {st,rows:[]};
  const sel=new Set(c.substances||[]);const list=GW_SUBS.filter(s=>s.sub&&(!sel.size||sel.has(s.sub)));
  return {st,all:!sel.size,rows:list.map(s=>{const r=gwReach(s,st.soil,st.i);return {s,r,use:isFinite(r.rank)&&r.rank<=s.gen?r.rank:s.gen,over:!(r.rank<=s.gen)};})};
}
const gwFmt=d=>isFinite(d)?(d<1?String(d):Math.round(d).toLocaleString('ja-JP')):'1,000,000超';
const gwFrac=i=>i>=0.1?i.toFixed(2):'1/'+Math.round(1/i).toLocaleString('ja-JP');
