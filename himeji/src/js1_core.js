/* ================================================================
   姫路城・姫路市 観光人流デジタルツイン — 提案用プロトタイプ
   座標系: 1 world unit = 1 m。原点 = 姫路城 大天守。x=東+, z=南+, y=標高
   地図: 国土地理院 地理院タイル z15 (市域 9×9タイル ≈ 9.0 km四方) + z17 (城周辺 1.5 km四方)
   標高: 地理院 標高タイル(DEM10B) 192×192 グリッド
================================================================ */
'use strict';
const $ = (id)=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,k)=>a+(b-a)*k;
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
let seed = 20261001;
const rnd = ()=>{ seed = (seed*1664525 + 1013904223) % 4294967296; return seed/4294967296; };
const gaussR = ()=>{ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v); };
const fmt=(v)=>Math.round(v).toLocaleString('ja-JP');
const yen=(v)=>'¥'+Math.round(v).toLocaleString('ja-JP');
const man=(v)=>{ if(Math.abs(v)>=1e8) return (v/1e8).toFixed(1)+'億円'; return Math.round(v/1e4).toLocaleString('ja-JP')+'万円'; };

/* ---------- 地理座標 → world ---------- */
const LAT0=34.8394, LON0=134.6939; /* 大天守 */
const N15=32768;
function tileXY(lat,lon){ const x=(lon+180)/360*N15; const r=lat*Math.PI/180; const y=(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*N15; return [x,y]; }
const TC=tileXY(LAT0,LON0);
const TILE_M=40075016.686*Math.cos(LAT0*Math.PI/180)/N15; /* ≈1004 m */
const LL=(lat,lon)=>{ const t=tileXY(lat,lon); return [(t[0]-TC[0])*TILE_M, (t[1]-TC[1])*TILE_M]; };
const MOS={x0:28639, y0:12992, n:9}; MOS.size=MOS.n*TILE_M; MOS.cx=(MOS.x0+MOS.n/2-TC[0])*TILE_M; MOS.cz=(MOS.y0+MOS.n/2-TC[1])*TILE_M;
const CORE={cx:(28644.5-TC[0])*TILE_M, cz:(12997.875-TC[1])*TILE_M, w:1.5*TILE_M, h:2.75*TILE_M};
const HALF=MOS.size/2;

/* ---------- 標高 (DEM 192×192, 単位 0.1 m, little-endian uint16) ---------- */
const DEM_N=192; const DEM=new Float32Array(DEM_N*DEM_N);
(function(){ const b=atob('__DEM_B64__'); for(let i=0;i<DEM_N*DEM_N;i++){ DEM[i]=((b.charCodeAt(i*2))|(b.charCodeAt(i*2+1)<<8))*0.1; } })();
let terrEx=1; /* 地形強調 */
function demAt(x,z){ /* bilinear */
  const u=(x-(MOS.cx-HALF))/MOS.size*DEM_N-0.5, v=(z-(MOS.cz-HALF))/MOS.size*DEM_N-0.5;
  const i=clamp(Math.floor(u),0,DEM_N-2), j=clamp(Math.floor(v),0,DEM_N-2); const fu=clamp(u-i,0,1), fv=clamp(v-j,0,1);
  const a=DEM[j*DEM_N+i], b=DEM[j*DEM_N+i+1], c=DEM[(j+1)*DEM_N+i], d=DEM[(j+1)*DEM_N+i+1];
  return lerp(lerp(a,b,fu), lerp(c,d,fu), fv);
}
/* 姫山(城の丘)は DEM 解像度(約47 m)で平均化されるため、局所的に補正 */
function bump(x,z){ const d2=x*x+z*z; return 24*Math.exp(-d2/(2*115*115)) + 6*Math.exp(-((x+120)*(x+120)+(z-40)*(z-40))/(2*90*90)); }
function hAt(x,z){ return (demAt(x,z)+bump(x,z))*terrEx; }
const BASE_H=hAt(0,0); /* 大天守 地盤高 */

/* ---------- 来訪元セグメント ---------- */
/* share: 来訪者構成比(休日想定) · grp: 'in'(インバウンド) / 'dom'(国内) · stay: 姫路市内宿泊率 · mode: 入域手段 [新幹線, 在来線(JR/山陽), 自家用車, 観光バス, 高速バス] */
const SEG=[
  /* インバウンド 35% — 姫路市観光動向調査 R6(姫路城地点 n=359) の国別比率 × 外国人比率 34.9%(FY2025) */
  {id:'eu', name:'欧州(仏・英・西・伊・独)', grp:'in', share:0.105, col:'#1abc9c', stay:0.16, mode:[0.40,0.50,0.03,0.05,0.02], flag:'🇪🇺', via:'kix'},
  {id:'us', name:'米国・カナダ', grp:'in',  share:0.060, col:'#16a085', stay:0.16, mode:[0.45,0.45,0.02,0.06,0.02], flag:'🇺🇸', via:'tokyo'},
  {id:'tw', name:'台湾',        grp:'in',  share:0.048, col:'#2ec4c6', stay:0.12, mode:[0.35,0.50,0.03,0.10,0.02], flag:'🇹🇼', via:'kix'},
  {id:'au', name:'豪州・NZ',    grp:'in',  share:0.041, col:'#48c9b0', stay:0.16, mode:[0.45,0.45,0.03,0.05,0.02], flag:'🇦🇺', via:'kix'},
  {id:'cn', name:'中国',        grp:'in',  share:0.039, col:'#22a3a5', stay:0.10, mode:[0.35,0.45,0.05,0.13,0.02], flag:'🇨🇳', via:'kix'},
  {id:'sea',name:'東南アジア(星・泰等)', grp:'in', share:0.018, col:'#0e7490', stay:0.10, mode:[0.35,0.50,0.03,0.10,0.02], flag:'🇸🇬', via:'kix'},
  {id:'hk', name:'香港',        grp:'in',  share:0.010, col:'#7ee8fa', stay:0.10, mode:[0.40,0.45,0.10,0.03,0.02], flag:'🇭🇰', via:'kix'},
  {id:'kr', name:'韓国',        grp:'in',  share:0.005, col:'#5ee0e2', stay:0.08, mode:[0.40,0.50,0.05,0.03,0.02], flag:'🇰🇷', via:'kix'},
  {id:'oth',name:'その他海外',  grp:'in',  share:0.024, col:'#5b8a8a', stay:0.12, mode:[0.40,0.48,0.04,0.06,0.02], flag:'🌐', via:'kix'},
  /* 国内 65% — 同調査 姫路城地点(n=488) 居住地構成 */
  {id:'tky',name:'関東(東京・首都圏)', grp:'dom', share:0.148, col:'#6f4fd6', stay:0.50, mode:[0.85,0.02,0.05,0.06,0.02], flag:'🗼', node:'tokyo'},
  {id:'ngy',name:'東海(愛知・静岡等)', grp:'dom', share:0.099, col:'#8b6ee0', stay:0.45, mode:[0.75,0.03,0.15,0.05,0.02], flag:'🏯', node:'nagoya'},
  {id:'osa',name:'大阪府',      grp:'dom', share:0.092, col:'#2f7fe8', stay:0.08, mode:[0.15,0.60,0.20,0.03,0.02], flag:'🏙', node:'osaka'},
  {id:'hyo',name:'兵庫県内(市外+市内)', grp:'dom', share:0.092, col:'#1a5ed9', stay:0.03, mode:[0.02,0.45,0.48,0.02,0.03], flag:'🏠', node:'kobe'},
  {id:'kyu',name:'九州・沖縄',  grp:'dom', share:0.058, col:'#f59e0b', stay:0.45, mode:[0.80,0.02,0.10,0.06,0.02], flag:'🌋', node:'fukuoka'},
  {id:'kyo',name:'京都・滋賀・奈良', grp:'dom', share:0.033, col:'#4d94f0', stay:0.10, mode:[0.40,0.35,0.20,0.03,0.02], flag:'⛩', node:'kyoto'},
  {id:'hok',name:'北海道・東北', grp:'dom', share:0.033, col:'#a78bfa', stay:0.50, mode:[0.55,0.30,0.05,0.08,0.02], flag:'❄', node:'itami'},
  {id:'oky',name:'岡山県',      grp:'dom', share:0.030, col:'#b45309', stay:0.08, mode:[0.30,0.35,0.33,0.02,0.00], flag:'🍑', node:'okayama'},
  {id:'shi',name:'四国',        grp:'dom', share:0.028, col:'#ea580c', stay:0.15, mode:[0.10,0.05,0.60,0.05,0.20], flag:'🍊', node:'takamatsu'},
  {id:'hir',name:'広島・山陰',  grp:'dom', share:0.027, col:'#d97706', stay:0.20, mode:[0.65,0.05,0.25,0.05,0.00], flag:'⛵', node:'hiroshima'},
  {id:'kin',name:'北陸・北近畿', grp:'dom', share:0.010, col:'#9a3412', stay:0.15, mode:[0.20,0.40,0.35,0.05,0.00], flag:'♨', node:'kinosaki'},
];
SEG.forEach((s,i)=>s.i=i);
const SEG_IN=SEG.filter(s=>s.grp==='in'), SEG_DOM=SEG.filter(s=>s.grp==='dom');
const MODES=['新幹線','在来線・私鉄','自家用車','観光バス','高速バス'];
const MODE_COL=['#1a5ed9','#2ec4c6','#f59e0b','#b45309','#7c3aed'];

/* ---------- 広域ノード (圧縮スケール: 市域外は 1 km = 40 units) ---------- */
const KM=40, R0=HALF+300;
function regPos(bearingDeg, km){ const r=R0+Math.min(km,360)*KM; const a=(bearingDeg-90)*Math.PI/180; return [Math.cos(a)*r, Math.sin(a)*r]; }
const REG={
  kobe:     {name:'神戸・三宮',   sub:'JR新快速 約40分',     b:101, km:52,  kind:'city', ly:700},
  osaka:    {name:'大阪・新大阪', sub:'新幹線 約30分 / 新快速 約60分', b:87, km:88, kind:'city', ly:1700},
  kyoto:    {name:'京都',         sub:'新幹線 約45分',        b:78,  km:125, kind:'city'},
  nara:     {name:'奈良',         sub:'約2時間',              b:97,  km:118, kind:'city', ly:900},
  kix:      {name:'関西国際空港', sub:'はるか+新幹線 約2時間', b:124, km:95,  kind:'air', ly:1300},
  itami:    {name:'大阪国際(伊丹)空港', sub:'リムジンバス+JR', b:76, km:78, kind:'air', ly:2700},
  ukb:      {name:'神戸空港',     sub:'ポートライナー+JR',   b:113, km:56,  kind:'air', ly:400},
  okayama:  {name:'岡山',         sub:'新幹線 約20分',        b:262, km:75,  kind:'city'},
  hiroshima:{name:'広島',         sub:'新幹線 約60分',        b:252, km:200, kind:'city'},
  fukuoka:  {name:'福岡・九州',   sub:'新幹線 約2時間',       b:246, km:380, kind:'city'},
  nagoya:   {name:'名古屋・中部', sub:'新幹線 約1時間20分',   b:76,  km:220, kind:'city'},
  tokyo:    {name:'東京・首都圏', sub:'新幹線 約3時間',       b:70,  km:500, kind:'city'},
  takamatsu:{name:'高松・四国',   sub:'瀬戸大橋・淡路経由',   b:222, km:90,  kind:'city'},
  kinosaki: {name:'城崎・北近畿', sub:'播但線・特急 約1時間40分', b:352, km:85, kind:'city'},
  awaji:    {name:'淡路島',       sub:'車 約1時間',           b:165, km:60,  kind:'city'},
};
Object.keys(REG).forEach(k=>{ const r=REG[k]; r.id=k; const p=regPos(r.b,r.km); r.x=p[0]; r.z=p[1]; });
/* 海外発地 (関空・成田/羽田経由) */
const ABROAD=[
  {id:'tw',name:'台湾',b:212,km:470},{id:'hk',name:'香港',b:238,km:520},{id:'cn',name:'中国(上海・北京)',b:275,km:500},{id:'kr',name:'韓国(ソウル・釜山)',b:300,km:430},
  {id:'sea',name:'東南アジア',b:222,km:560},{id:'au',name:'豪州',b:168,km:560},{id:'us',name:'米国・カナダ',b:58,km:600},{id:'eu',name:'欧州',b:338,km:590},{id:'oth',name:'その他',b:130,km:600},
];
ABROAD.forEach(a=>{ const p=regPos(a.b,a.km); a.x=p[0]; a.z=p[1]; a.seg=SEG.find(s=>s.id===a.id); });

/* ---------- 市内 主要地点 (滞留地点) ---------- */
/* dwell: [平均, 標準偏差] 分 · cap: 快適容量(人) · kind: castle/garden/museum/street/station/park/temple/hotel */
const SPOTS=[
  {id:'castle',  name:'姫路城(城内)',          ll:[34.8394,134.6939], r:120, dwell:[110,30], cap:6000, kind:'castle', fee:1000, desc:'世界遺産・国宝。大天守は入場制限(整理券)あり', open:540, close:960, last:960},
  {id:'sannomaru',name:'三の丸広場・大手門',   ll:[34.8366,134.6938], r:90,  dwell:[20,8],  cap:5000, kind:'park', fee:0, desc:'桜門橋・大手門から城内へ。撮影スポット'},
  {id:'kokoen',  name:'好古園',                 ll:[34.8378,134.6899], r:70,  dwell:[45,12], cap:1500, kind:'garden', fee:310, desc:'姫路城西御屋敷跡庭園。城とのセット券あり'},
  {id:'zoo',     name:'姫路市立動物園',         ll:[34.8393,134.6965], r:60,  dwell:[40,12], cap:1500, kind:'park', fee:210, desc:'城内三の丸東側。家族層の滞留'},
  {id:'hist',    name:'兵庫県立歴史博物館',     ll:[34.8422,134.6968], r:40,  dwell:[40,10], cap:600,  kind:'museum', fee:200, desc:'城の北東。城郭・祭りの展示'},
  {id:'art',     name:'姫路市立美術館',         ll:[34.8410,134.6980], r:45,  dwell:[40,10], cap:600,  kind:'museum', fee:210, desc:'赤レンガの旧陸軍倉庫。城を望む庭'},
  {id:'lit',     name:'姫路文学館',             ll:[34.8412,134.6880], r:35,  dwell:[30,8],  cap:300,  kind:'museum', fee:310, desc:'安藤忠雄設計。城の北西'},
  {id:'otemae',  name:'大手前通り',             ll:[34.8330,134.6935], r:40,  dwell:[12,5],  cap:8000, kind:'street', fee:0, desc:'駅から城へ続くメインストリート(約1 km)'},
  {id:'miyuki',  name:'みゆき通り商店街',       ll:[34.8312,134.6918], r:60,  dwell:[45,15], cap:3000, kind:'street', fee:0, desc:'飲食・土産。回遊と消費の中心'},
  {id:'eagle',   name:'イーグレひめじ・大手前公園', ll:[34.8347,134.6933], r:45, dwell:[20,8], cap:2000, kind:'street', fee:0, desc:'屋上展望台から城を一望。観光案内所'},
  {id:'station', name:'姫路駅周辺(ピオレ・飲食)', ll:[34.8270,134.6903], r:70, dwell:[35,15], cap:8000, kind:'station', fee:0, desc:'駅ビル・飲食・土産。到着/出発の結節点'},
  {id:'tegara',  name:'手柄山中央公園',         ll:[34.8130,134.6800], r:120, dwell:[60,20], cap:3000, kind:'park', fee:0, desc:'水族館・遊園地・慰霊塔。市民・家族層'},
  {id:'shosha',  name:'書写山圓教寺',           ll:[34.8735,134.6440], r:90,  dwell:[110,25],cap:1500, kind:'temple', fee:500, desc:'西の比叡山。ロープウェイ利用。映画ロケ地'},
  {id:'hiromine',name:'広峯神社',               ll:[34.8700,134.6850], r:40,  dwell:[40,10], cap:300,  kind:'temple', fee:0, desc:'黒田官兵衛ゆかり。城下を一望'},
];
SPOTS.forEach((s,i)=>{ s.i=i; const p=LL(s.ll[0],s.ll[1]); s.x=p[0]; s.z=p[1]; s.cnt=0; s.cum=0; s.dwellSum=0; s.dwellN=0; s.peak=0; s.peakT=0; s.bySeg=new Float32Array(SEG.length); s.sales=0; });
const SP={}; SPOTS.forEach(s=>SP[s.id]=s);
const KIND_COL={castle:'#e11d74',garden:'#17a05e',museum:'#7c3aed',street:'#f59e0b',station:'#1a5ed9',park:'#65a30d',temple:'#b45309',hotel:'#c026d3'};
const KIND_JP={castle:'城郭',garden:'庭園',museum:'博物館・美術館',street:'商業・街路',station:'駅・交通',park:'公園・動物園',temple:'寺社',hotel:'宿泊'};

/* ---------- 入域ゲート (到着・出発点) ---------- */
const GATES=[
  {id:'shink', name:'姫路駅 新幹線口',     ll:[34.8262,134.6905], mode:0, col:'#1a5ed9', kind:'rail', cap:99999},
  {id:'jr',    name:'姫路駅 北口(在来線・山陽電車)', ll:[34.8272,134.6902], mode:1, col:'#2ec4c6', kind:'rail', cap:99999},
  {id:'p_north',name:'城の北駐車場',        ll:[34.8428,134.6938], mode:2, col:'#f59e0b', kind:'park', cap:530},
  {id:'p_otemon',name:'大手門駐車場',        ll:[34.8360,134.6960], mode:2, col:'#f59e0b', kind:'park', cap:555},
  {id:'p_himeyama',name:'姫山駐車場',        ll:[34.8388,134.6990], ll2:null, mode:2, col:'#f59e0b', kind:'park', cap:250},
  {id:'p_under',name:'大手前公園地下駐車場', ll:[34.8343,134.6924], mode:2, col:'#f59e0b', kind:'park', cap:340},
  {id:'bus',   name:'観光バス乗降場(大手前公園南)', ll:[34.8340,134.6945], mode:3, col:'#b45309', kind:'bus', cap:24},
  {id:'hwbus', name:'高速バス・ループバス停(駅北)', ll:[34.8276,134.6912], mode:4, col:'#7c3aed', kind:'bus', cap:99999},
];
GATES.forEach((g,i)=>{ g.i=i; const p=LL(g.ll[0],g.ll[1]); g.x=p[0]; g.z=p[1]; g.cumIn=0; g.cumOut=0; g.occ=0; g.peak=0; g.hist=null; });

/* ---------- ホテル (宿泊者の夜間滞留) ---------- */
const HOTELS=[
  {id:'h1', name:'ホテルモントレ姫路', ll:[34.8271,134.6893], rooms:220, h:60},
  {id:'h2', name:'ホテル日航姫路',     ll:[34.8248,134.6898], rooms:270, h:70},
  {id:'h3', name:'ダイワロイネットホテル姫路', ll:[34.8280,134.6922], rooms:210, h:52},
  {id:'h4', name:'東横イン姫路駅新幹線北口', ll:[34.8266,134.6931], rooms:250, h:40},
  {id:'h5', name:'ホテルウィングインターナショナル姫路', ll:[34.8288,134.6873], rooms:180, h:36},
  {id:'h6', name:'姫路キャッスルグランヴィリオホテル', ll:[34.8395,134.7050], rooms:170, h:30},
  {id:'h7', name:'ドーミーイン姫路', ll:[34.8296,134.6903], rooms:200, h:44},
  {id:'h8', name:'ゲストハウス・民泊(城北エリア)', ll:[34.8440,134.6910], rooms:80, h:12},
];
HOTELS.forEach((h,i)=>{ h.i=i; const p=LL(h.ll[0],h.ll[1]); h.x=p[0]; h.z=p[1]; h.cnt=0; h.booked=0; });

/* ---------- 帰路先 ---------- */
const RET=[
  {id:'osaka', name:'大阪方面(泊・帰宅)', col:'#2f7fe8'},
  {id:'kyoto', name:'京都方面', col:'#4d94f0'},
  {id:'kobe',  name:'神戸・県内(帰宅)', col:'#1a5ed9'},
  {id:'west',  name:'岡山・広島方面', col:'#d97706'},
  {id:'home',  name:'遠方へ帰宅(新幹線)', col:'#6f4fd6'},
  {id:'north', name:'城崎・北近畿へ', col:'#9a3412'},
  {id:'stay',  name:'姫路市内に宿泊', col:'#c026d3'},
];
const RET_NODE={osaka:'osaka',kyoto:'kyoto',kobe:'kobe',west:'okayama',home:'tokyo',north:'kinosaki',stay:null};

/* ---------- センサー (人流計測点: Wi-Fi/カメラ/ビーコン) ---------- */
const SENSORS=[
  {id:'S01', name:'姫路駅 北口コンコース', ll:[34.8270,134.6904], type:'3Dカメラ人数計測', r:60},
  {id:'S02', name:'大手前通り(中央)',       ll:[34.8318,134.6935], type:'Wi-Fiパケットセンサー', r:80},
  {id:'S03', name:'大手門・桜門橋',         ll:[34.8355,134.6938], type:'3Dカメラ人数計測', r:50},
  {id:'S04', name:'菱の門(入城口)',          ll:[34.8382,134.6935], type:'入城券ゲート(QR)', r:40},
  {id:'S05', name:'大天守 入口',             ll:[34.8394,134.6939], type:'整理券・QRゲート', r:30},
  {id:'S06', name:'好古園 入口',             ll:[34.8375,134.6903], type:'入園券ゲート', r:40},
  {id:'S07', name:'みゆき通り商店街',        ll:[34.8312,134.6918], type:'Wi-Fiパケットセンサー', r:80},
  {id:'S08', name:'城の北駐車場',            ll:[34.8428,134.6938], type:'駐車場入出庫(ナンバー)', r:60},
  {id:'S09', name:'大手門駐車場',            ll:[34.8360,134.6960], type:'駐車場入出庫(ナンバー)', r:60},
  {id:'S10', name:'観光バス乗降場',          ll:[34.8340,134.6945], type:'バス予約・乗降記録', r:50},
  {id:'S11', name:'美術館・歴博 前',         ll:[34.8416,134.6972], type:'Wi-Fiパケットセンサー', r:70},
  {id:'S12', name:'書写山ロープウェイ山麓', ll:[34.8690,134.6480], type:'乗車券ゲート', r:60},
  {id:'S13', name:'携帯位置情報(市域メッシュ)', ll:[34.8500,134.7200], type:'キャリア位置情報(500mメッシュ)', r:900, virt:true},
];
SENSORS.forEach((s,i)=>{ s.i=i; const p=LL(s.ll[0],s.ll[1]); s.x=p[0]; s.z=p[1]; s.det=0; s.detMin=0; });

/* ---------- 歩行ネットワーク ---------- */
const NODES_LL={
  st_s:[34.8258,134.6905], st_n:[34.8274,134.6904], st_e:[34.8276,134.6915], bus_n:[34.8278,134.6912],
  ot1:[34.8292,134.6935], ot2:[34.8312,134.6936], ot3:[34.8332,134.6936], ot4:[34.8348,134.6936],
  my1:[34.8296,134.6919], my2:[34.8316,134.6919], my3:[34.8332,134.6922],
  eagle:[34.8347,134.6930], busbay:[34.8340,134.6946], p_under:[34.8343,134.6924],
  otemon:[34.8356,134.6938], sannomaru:[34.8368,134.6936], hishi:[34.8382,134.6935], castle:[34.8393,134.6939], castle_w:[34.8390,134.6925],
  kokoen:[34.8378,134.6902], kokoen_g:[34.8372,134.6910],
  zoo:[34.8391,134.6962], p_otemon:[34.8360,134.6960], himeyama:[34.8388,134.6988],
  east1:[34.8405,134.6975], art:[34.8410,134.6980], hist:[34.8421,134.6968], north1:[34.8426,134.6940], p_north:[34.8429,134.6938],
  lit:[34.8412,134.6883], west1:[34.8395,134.6885], nw:[34.8425,134.6905],
  hotel_e:[34.8395,134.7048], h_road:[34.8400,134.7010],
  tegara1:[34.8200,134.6860], tegara:[34.8130,134.6800],
  shosha_l:[34.8690,134.6480], shosha:[34.8735,134.6445], hiro1:[34.8560,134.6900], hiromine:[34.8700,134.6850],
  n_road1:[34.8500,134.6930], n_road2:[34.8600,134.6800], n_road3:[34.8640,134.6560],
};
const NODE={}; Object.keys(NODES_LL).forEach((k,i)=>{ const p=LL(NODES_LL[k][0],NODES_LL[k][1]); NODE[k]={id:k,i,x:p[0],z:p[1]}; });
const EDGES=[
  ['st_s','st_n'],['st_n','st_e'],['st_e','bus_n'],['st_n','ot1'],['st_e','ot1'],['ot1','ot2'],['ot2','ot3'],['ot3','ot4'],['ot4','otemon'],
  ['st_n','my1'],['my1','my2'],['my2','my3'],['my3','ot3'],['my1','ot1'],['my2','ot2'],
  ['ot4','eagle'],['eagle','p_under'],['ot3','busbay'],['busbay','ot4'],
  ['otemon','sannomaru'],['sannomaru','hishi'],['hishi','castle'],['castle','castle_w'],['castle_w','kokoen'],['kokoen','kokoen_g'],['kokoen_g','otemon'],['kokoen_g','sannomaru'],
  ['sannomaru','zoo'],['zoo','p_otemon'],['p_otemon','otemon'],['zoo','himeyama'],['himeyama','east1'],['east1','art'],['art','hist'],['hist','north1'],['north1','p_north'],['north1','castle'],
  ['castle_w','west1'],['west1','lit'],['lit','nw'],['nw','north1'],['nw','p_north'],
  ['east1','h_road'],['h_road','hotel_e'],
  ['st_s','tegara1'],['tegara1','tegara'],
  ['p_north','n_road1'],['n_road1','hiro1'],['hiro1','hiromine'],['hiro1','n_road2'],['n_road2','n_road3'],['n_road3','shosha_l'],['shosha_l','shosha'],
];
const GRAPH=(function(){ const ids=Object.keys(NODE); const n=ids.length; const adj=ids.map(()=>[]); EDGES.forEach(e=>{ const a=NODE[e[0]], b=NODE[e[1]]; if(!a||!b){ console.warn('edge',e); return; } const d=Math.hypot(a.x-b.x,a.z-b.z); adj[a.i].push([b.i,d]); adj[b.i].push([a.i,d]); });
  const pos=ids.map(k=>NODE[k]); const cache={};
  function path(a,b){ const key=a+'>'+b; if(cache[key]) return cache[key]; const dist=new Float64Array(n).fill(1e18), prev=new Int32Array(n).fill(-1), done=new Uint8Array(n); dist[a]=0;
    for(let it=0;it<n;it++){ let u=-1, best=1e18; for(let i=0;i<n;i++) if(!done[i]&&dist[i]<best){ best=dist[i]; u=i; } if(u<0||u===b) break; done[u]=1; for(const [v,d] of adj[u]){ if(dist[u]+d<dist[v]){ dist[v]=dist[u]+d; prev[v]=u; } } }
    const out=[]; let c=b; while(c>=0){ out.push(c); if(c===a) break; c=prev[c]; } out.reverse(); if(out[0]!==a) out.unshift(a); cache[key]=out; return out; }
  return {ids,n,adj,pos,path}; })();
/* 地点 → 最寄りノード */
const SPOT_NODE={castle:'castle',sannomaru:'sannomaru',kokoen:'kokoen',zoo:'zoo',hist:'hist',art:'art',lit:'lit',otemae:'ot3',miyuki:'my2',eagle:'eagle',station:'st_n',tegara:'tegara',shosha:'shosha',hiromine:'hiromine'};
const GATE_NODE={shink:'st_s',jr:'st_n',p_north:'p_north',p_otemon:'p_otemon',p_himeyama:'himeyama',p_under:'p_under',bus:'busbay',hwbus:'bus_n'};
const HOTEL_NODE=['st_n','st_s','st_e','st_e','st_n','hotel_e','st_n','nw'];

/* ---------- 車両ルート (lat,lon 折れ線) ---------- */
const ROUTES={
  shinkansen:{name:'山陽新幹線', col:0x1a5ed9, pts:[[34.8280,134.6376],[34.8272,134.6600],[34.8263,134.6905],[34.8250,134.7150],[34.8240,134.7362]], kind:'rail', elev:12},
  jr:{name:'JR山陽本線', col:0x2ec4c6, pts:[[34.8262,134.6376],[34.8265,134.6700],[34.8272,134.6905],[34.8285,134.7150],[34.8300,134.7362]], kind:'rail', elev:8},
  bantan:{name:'JR播但線', col:0x2ec4c6, pts:[[34.8272,134.6905],[34.8300,134.7000],[34.8400,134.7080],[34.8600,134.7150],[34.8735,134.7180]], kind:'rail', elev:2},
  kishin:{name:'JR姫新線', col:0x2ec4c6, pts:[[34.8272,134.6905],[34.8300,134.6820],[34.8420,134.6720],[34.8600,134.6600],[34.8735,134.6560]], kind:'rail', elev:2},
  sanyo:{name:'山陽自動車道', col:0x475569, pts:[[34.8660,134.6376],[34.8670,134.6500],[34.8690,134.6700],[34.8710,134.6900],[34.8700,134.7100],[34.8690,134.7270],[34.8660,134.7362]], kind:'road', elev:6},
  bypass:{name:'国道2号 姫路バイパス', col:0x64748b, pts:[[34.8150,134.6376],[34.8150,134.6600],[34.8145,134.6900],[34.8150,134.7150],[34.8160,134.7362]], kind:'road', elev:6},
  r2:{name:'国道2号(市街)', col:0x94a3b8, pts:[[34.8300,134.6376],[34.8296,134.6700],[34.8294,134.6905],[34.8296,134.7150],[34.8300,134.7362]], kind:'road', elev:0.3},
  otemae_rd:{name:'大手前通り', col:0x94a3b8, pts:[[34.8278,134.6935],[34.8356,134.6938]], kind:'road', elev:0.3},
  north_rd:{name:'県道(城北〜書写)', col:0x94a3b8, pts:[[34.8356,134.6938],[34.8430,134.6940],[34.8500,134.6930],[34.8600,134.6800],[34.8640,134.6560],[34.8690,134.6480]], kind:'road', elev:0.3},
  loop:{name:'姫路城ループバス', col:0xe11d74, pts:[[34.8276,134.6912],[34.8292,134.6935],[34.8332,134.6936],[34.8356,134.6938],[34.8360,134.6960],[34.8405,134.6975],[34.8421,134.6968],[34.8428,134.6938],[34.8425,134.6905],[34.8412,134.6883],[34.8378,134.6899],[34.8350,134.6905],[34.8300,134.6905],[34.8276,134.6912]], kind:'bus', elev:0.4},
};
Object.values(ROUTES).forEach(r=>{ r.w=r.pts.map(p=>LL(p[0],p[1])); let L=0; r.seg=[0]; for(let i=1;i<r.w.length;i++){ L+=Math.hypot(r.w[i][0]-r.w[i-1][0], r.w[i][1]-r.w[i-1][1]); r.seg.push(L); } r.len=L; });
function routeAt(r, s){ s=((s%r.len)+r.len)%r.len; let i=1; while(i<r.seg.length-1 && r.seg[i]<s) i++; const k=(s-r.seg[i-1])/Math.max(1e-6,r.seg[i]-r.seg[i-1]); const a=r.w[i-1], b=r.w[i]; return [lerp(a[0],b[0],k), lerp(a[1],b[1],k), Math.atan2(b[0]-a[0], b[1]-a[1])]; }

/* ---------- 時間 ---------- */
const T0H=6, T_END=1080; /* 06:00 → 24:00 */
const timeState={min:0, playing:false, speed:6};
const clockStr=(t)=>{ const h=(T0H+Math.floor(t/60))%24, m=Math.floor(t%60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
const PHASES=[[0,'早朝 · 到着前'],[120,'午前 · 到着はじまる'],[180,'開城 09:00 · 入城開始'],[240,'午前の来訪ピーク'],[360,'昼 · 商店街・駅前で食事'],[420,'午後の来訪ピーク · 大天守待ち'],[600,'最終入城 16:00'],[660,'閉門 17:00 · 帰路へ'],[720,'夕方 · 大阪・京都へ帰還ラッシュ'],[840,'夜 · 宿泊者の夕食・城ライトアップ'],[960,'夜間 · 市内滞在は宿泊者のみ']];
const phaseAt=(t)=>{ let p=PHASES[0][1]; for(const ph of PHASES){ if(t>=ph[0]) p=ph[1]; } return p; };
const DAYS=[
  {name:'平日', sub:'11月 平日', n:1600, label:'11月 平日 · 想定 約6,400人'},
  {name:'休日', sub:'11月 休日', n:3000, label:'11月 休日 · 想定 約12,000人'},
  {name:'ピーク日', sub:'桜・GW', n:4500, label:'桜・GW ピーク日 · 想定 約18,000人'},
];
let curDay=1;
const N_AG=4500, PER_AGENT=4;
