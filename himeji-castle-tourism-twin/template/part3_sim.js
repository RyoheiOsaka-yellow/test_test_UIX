
/* ================= 来訪者セグメント / シナリオ / 流入ゲート（ダミー定義） ================= */
const SEG = {
  in: {name:'インバウンド',  col:0x3a90d6, css:'var(--in)'},
  dom:{name:'国内（県外）',  col:0x27b062, css:'var(--dom)'},
  loc:{name:'県内・近隣',    col:0xd05f8a, css:'var(--loc)'},
};
const SEG_KEYS = ['in','dom','loc'];
/* ---------------------------------------------------------------
   公表統計に基づく仮置き値（ダミー）。出典は SOURCES 参照。
   ・姫路城 入城者数 2025年度 1,567,674人（外国人 547,426人・34.9%）、月別実績（姫路市）
   ・令和6年度 姫路市入込客数・観光動向調査（姫路城地点: 日本人488人・外国人359人）
   ・入城料 2026年3月1日改定（一般 ¥2,500 / 市民 ¥1,000 / 18歳未満 無料）、大天守 1,000人/時・15,000人/日
--------------------------------------------------------------- */
const MONTHLY_2025 = [  // 2025年度 月別入城者数（総数, 外国人）
  ['4月',200073,84264],['5月',156624,62698],['6月',102551,35437],['7月',92148,42298],['8月',128887,39859],['9月',113777,39614],
  ['10月',164127,60690],['11月',178693,50009],['12月',91513,29518],['1月',86986,28228],['2月',106711,31494],['3月',145584,43317]];
const ANNUAL_2025 = { total:1567674, foreign:547426, japanese:1020248 };
/* 日本人来訪者のうち兵庫県内（姫路市外＋市内）＝ 近畿34.4%×兵庫41.0% ≒ 14%（姫路城地点）。県内近隣は周辺市町の日帰りを加味し 15% で仮置き */
function mixOf(inShare){ const d=1-inShare; return {in:inShare, dom:+(d*0.85).toFixed(3), loc:+(d*0.15).toFixed(3)}; }
/* シナリオ: 姫路城 入城者数/日（2025年度 月別実績から換算）・インバウンド比率（同月実績）・夜間係数 */
const SCN = {
  wkd:   {name:'平日（10月）',        castle:4300,  mix:mixOf(0.37), night:0.35, note:'10月 164,127人 ÷ 31日 ≒ 5,300人/日を平日換算'},
  wke:   {name:'週末（10月）',        castle:7500,  mix:mixOf(0.36), night:0.4,  note:'月平均の約1.4倍で仮置き'},
  sakura:{name:'桜（4月上旬の週末）', castle:15000, mix:mixOf(0.42), night:0.9,  note:'4月 200,073人（外国人42.1%）。大天守上限 15,000人/日に到達'},
  gw:    {name:'GW',                  castle:15000, mix:mixOf(0.30), night:0.6,  note:'5月 156,624人。GWは国内比率が上がる想定'},
  autumn:{name:'紅葉（11月の週末）',  castle:11000, mix:mixOf(0.28), night:0.55, note:'11月 178,693人（外国人28.0%）'},
  summer:{name:'夏（7月平日）',       castle:2900,  mix:mixOf(0.46), night:0.5,  note:'7月 92,148人（外国人45.9%・年間最少月）'},
};
let curScn = 'wke';
let segFilter = 'all';   // all | in | dom | loc
const TENSHU_CAP = 15000;      // 大天守 入城制限（人/日）・1,000人/時（姫路城公式）
const FEE = { out:2500, resident:1000, group:2000, combo:2600, annual:5000 };   // 2026年3月1日〜
const CITY_FACTOR = 1.35;      // 市内来訪者 ≒ 入城者 × 1.35（入城しない来訪含む・仮置き）
const AG_SCALE = 8;            // 1ドット = 8人
/* 市内宿泊率（観光動向調査 姫路城地点: 日本人 宿泊62.9%×市内48.5%≒30%、外国人 市内宿泊13.9%） */
const STAY_RATE = { in:0.14, dom:0.30, loc:0.03 };
/* 1人あたり市内消費（観光動向調査 姫路城地点 平均: 宿泊費・飲食費・土産代・入場料の合計） */
const SPEND = { in:{stay:3920, food:5968, gift:2799, fee:1167}, dom:{stay:4600, food:4644, gift:3269, fee:1134}, loc:{stay:300, food:2800, gift:1500, fee:600} };
const spendPer = seg=>{ const s=SPEND[seg]; return s.stay+s.food+s.gift+s.fee; };

/* 流入ゲート（市内側の到着地点） */
function icByName(pat, fallbackIdx){
  const f = SCENE_DATA.ic.find(i=> pat.test(i.n));
  const ic = f || SCENE_DATA.ic[fallbackIdx] || {n:'IC', p:[3000,-1500]};
  return {x:ic.p[0], z:-ic.p[1], n:ic.n};
}
const IC_E = SCENE_DATA.ic.length ? icByName(/東|市川|花田|別所/, 0) : {x:3900, z:2000, n:'姫路東ランプ'};
const IC_W = SCENE_DATA.ic.length > 1 ? icByName(/西|中地|太子|飾磨/, 1) : {x:-3200, z:2400, n:'中地ランプ'};
const GATES = {
  shin: {name:'JR姫路駅（新幹線）',        x:STN.x, z:STN.z, col:0x9ec5ff, mode:'rail'},
  jr:   {name:'JR姫路駅（在来線・新快速）', x:STN.x, z:STN.z, col:0xd0d6ea, mode:'rail'},
  sanyo:{name:'山陽姫路駅',                x:SANYO_STN.x, z:SANYO_STN.z, col:0xff9a3d, mode:'rail'},
  bus:  {name:'姫路駅北 バスターミナル',   x:BUS_TERM.x, z:BUS_TERM.z, col:0xffd166, mode:'bus'},
  carE: {name:IC_E.n+'（車・東）',         x:IC_E.x, z:IC_E.z, col:0x8fd0ff, mode:'car'},
  carW: {name:IC_W.n+'（車・西）',         x:IC_W.x, z:IC_W.z, col:0x8fd0ff, mode:'car'},
  port: {name:'姫路港（家島・小豆島）',    x:PORT.x, z:PORT.z, col:0x35d0c0, mode:'ship'},
};
/* セグメント別ゲート利用率（観光動向調査 交通手段（複数回答）から換算・仮置き）
   日本人（姫路城）: JR在来線40.6% 新幹線32.0% 自家用車31.6% 私鉄11.5% 市内バス10.9% 飛行機9.8% レンタカー4.9% 高速バス3.5% 貸切バス3.1%
   外国人（姫路城）: JR在来線71.9% 飛行機68.8% 新幹線56.0% 市内バス15.9% 私鉄5.0% レンタカー5.0% 貸切バス3.6% */
const GATE_SHARE = {
  in: {shin:0.38, jr:0.45, sanyo:0.03, bus:0.08, carE:0.03, carW:0.02, port:0.01},
  dom:{shin:0.32, jr:0.30, sanyo:0.06, bus:0.05, carE:0.16, carW:0.10, port:0.01},
  loc:{shin:0.01, jr:0.30, sanyo:0.20, bus:0.03, carE:0.24, carW:0.21, port:0.01},
};

/* ================= 広域動線（コリドー）: 路線・高速道路ごとに経由都市と所要時間を持つ ================= */
/* mode: shin 新幹線 / jr JR在来線 / sanyo 山陽電鉄 / exp 高速道路 / road 国道 / sea 航路 / air 空港アクセス
   bear: 姫路からの方位角（北0°・時計回り）。nodes: [名称, 中心からの距離m, 所要時間] */
const CORRIDORS = [
  {id:'shin_e', mode:'shin', name:'山陽新幹線（東）', gate:'shin', bear:93,
   nodes:[['西明石',7600,'15分'],['新神戸',9200,'16分'],['新大阪',10800,'30分'],['京都',12400,'45分'],['名古屋',14000,'1時間20分'],['東京',15800,'2時間55分']]},
  {id:'shin_w', mode:'shin', name:'山陽新幹線（西）', gate:'shin', bear:267,
   nodes:[['相生',7600,'8分'],['岡山',9400,'20分'],['福山',11200,'35分'],['広島',13000,'1時間'],['博多',15600,'2時間10分']]},
  {id:'jr_e', mode:'jr', name:'JR山陽本線 新快速（東）', gate:'jr', bear:106,
   nodes:[['加古川',7600,'11分'],['明石',9200,'25分'],['三ノ宮（神戸）',10800,'40分'],['大阪',12400,'62分'],['京都',14000,'1時間30分']]},
  {id:'jr_w', mode:'jr', name:'JR山陽本線（西）', gate:'jr', bear:254,
   nodes:[['相生',7600,'20分'],['播州赤穂',9200,'35分'],['岡山',11600,'1時間30分']]},
  {id:'sanyo_e', mode:'sanyo', name:'山陽電鉄本線 直通特急', gate:'sanyo', bear:118,
   nodes:[['高砂',7600,'15分'],['明石',9400,'35分'],['神戸三宮',11600,'60分'],['阪神 大阪梅田',13600,'1時間40分']]},
  {id:'bantan', mode:'jr', name:'JR播但線・特急はまかぜ', gate:'jr', bear:6,
   nodes:[['福崎',7600,'20分'],['寺前・和田山',10000,'1時間'],['城崎温泉・鳥取',13400,'2時間']]},
  {id:'kishin', mode:'jr', name:'JR姫新線', gate:'jr', bear:300,
   nodes:[['本竜野',7600,'20分'],['佐用',10400,'55分'],['津山',13000,'1時間40分']]},
  {id:'exp_e', mode:'exp', name:'山陽自動車道（東）', gate:'carE', bear:78,
   nodes:[['三木・神戸JCT',8200,'30分'],['大阪（吹田）',11600,'1時間10分'],['京都',13800,'1時間40分']]},
  {id:'exp_w', mode:'exp', name:'山陽自動車道（西）', gate:'carW', bear:282,
   nodes:[['龍野',7600,'15分'],['岡山',10600,'50分'],['広島',14200,'2時間20分']]},
  {id:'exp_n', mode:'exp', name:'播但連絡道路 → 中国自動車道', gate:'carE', bear:28,
   nodes:[['福崎IC',7400,'15分'],['神戸三田・宝塚',10200,'50分'],['大阪（中国吹田）',12800,'1時間20分']]},
  {id:'r2_e', mode:'road', name:'国道2号・姫路バイパス（東）', gate:'carE', bear:97,
   nodes:[['加古川',7600,'25分'],['明石・神戸',10400,'60分']]},
  {id:'r2_w', mode:'road', name:'国道2号・250号（西）', gate:'carW', bear:262,
   nodes:[['太子・たつの',7600,'20分'],['相生・赤穂',10400,'40分']]},
  {id:'sea', mode:'sea', name:'姫路港 航路', gate:'port', bear:188,
   nodes:[['家島（坊勢・家島）',9000,'高速船 30分'],['小豆島 福田港',12600,'フェリー 1時間40分']]},
  {id:'air_kix', mode:'air', name:'関西国際空港アクセス', gate:'shin', bear:132,
   nodes:[['関西国際空港',13800,'直行バス 2時間 / はるか＋新幹線 1時間40分']]},
  {id:'air_itm', mode:'air', name:'伊丹・神戸空港アクセス', gate:'jr', bear:96,
   nodes:[['神戸空港',11400,'ポートライナー＋新快速 1時間15分'],['伊丹空港',13200,'リムジンバス＋新快速 1時間30分']]},
];
const MODE_STYLE = {
  shin: {name:'山陽新幹線', col:0x9ec5ff, css:'#9ec5ff', w:440, kind:0},
  jr:   {name:'JR在来線（新快速・播但線・姫新線）', col:0xdfe4f2, css:'#dfe4f2', w:340, kind:0},
  sanyo:{name:'山陽電鉄', col:0xff9a3d, css:'#ff9a3d', w:300, kind:0},
  exp:  {name:'高速道路（山陽道・中国道・播但連絡道）', col:0x39a86b, css:'#39a86b', w:440, kind:1},
  road: {name:'国道2号・250号', col:0xc8a24a, css:'#c8a24a', w:260, kind:0},
  sea:  {name:'航路（家島・小豆島）', col:0x35d0c0, css:'#35d0c0', w:300, kind:2},
  air:  {name:'空港アクセス（関空・伊丹・神戸）', col:0xb56ce8, css:'#b56ce8', w:280, kind:2},
};
const CORR_BY_ID = Object.fromEntries(CORRIDORS.map(c=>[c.id,c]));
CORRIDORS.forEach(c=>{
  const a = c.bear*Math.PI/180, g = GATES[c.gate];
  c.gx = g.x; c.gz = g.z;
  c.pts = c.nodes.map(n=>({n:n[0], t:n[2], r:n[1], x:Math.sin(a)*n[1], z:-Math.cos(a)*n[1]}));
});
function corrNode(cid, idx){ const c=CORR_BY_ID[cid]; const p=c.pts[Math.min(idx, c.pts.length-1)]; return {x:p.x, z:p.z, c, p}; }

/* 広域 出発地 — 観光動向調査（姫路城地点）の居住地構成から換算した仮置きシェア。corr/at = 乗る動線とその経由地 */
const ORIGINS = [
  /* 国内（県外）: 近畿34.4%（大阪41.1%・京都5.4%・滋賀5.4%・奈良4.1%・和歌山3.0%）関東22.8% 東海15.2% 九州9.0% 中国8.7% 北海道・東北5.1% 四国4.3% 北陸1.6% を兵庫除きで正規化 */
  {id:'osaka',   name:'大阪府',            seg:'dom', share:0.16, corr:'jr_e',   at:3, gate:'jr',   via:'新快速 62分'},
  {id:'kyoto',   name:'京都・滋賀・奈良',  seg:'dom', share:0.09, corr:'shin_e', at:3, gate:'shin', via:'新幹線 45分'},
  {id:'tokyo',   name:'東京・首都圏',      seg:'dom', share:0.27, corr:'shin_e', at:5, gate:'shin', via:'新幹線 2時間55分'},
  {id:'nagoya',  name:'名古屋・東海',      seg:'dom', share:0.18, corr:'shin_e', at:4, gate:'shin', via:'新幹線 1時間20分'},
  {id:'okayama', name:'岡山・広島（中国）',seg:'dom', share:0.10, corr:'shin_w', at:1, gate:'shin', via:'新幹線 20分〜1時間'},
  {id:'kyushu',  name:'九州・沖縄',        seg:'dom', share:0.10, corr:'shin_w', at:4, gate:'shin', via:'新幹線 2時間10分 / 空路'},
  {id:'tohoku',  name:'北海道・東北',      seg:'dom', share:0.06, corr:'air_itm', at:1, gate:'jr', via:'伊丹空港 経由'},
  {id:'shikoku', name:'四国',              seg:'dom', share:0.05, corr:'sea',    at:1, gate:'port', via:'小豆島経由 / 瀬戸大橋'},
  {id:'car_e',   name:'車（京阪神方面）',  seg:'dom', share:0.10, corr:'exp_e',  at:1, gate:'carE', via:'山陽道 1時間10分'},
  {id:'car_w',   name:'車（岡山・中国道）',seg:'dom', share:0.06, corr:'exp_w',  at:1, gate:'carW', via:'山陽道 50分'},
  {id:'hokuriku',name:'北陸',              seg:'dom', share:0.02, corr:'shin_e', at:3, gate:'shin', via:'京都乗換'},
  /* 県内・近隣（兵庫県 姫路市外・周辺市町） */
  {id:'kakogawa',name:'加古川・明石・神戸', seg:'loc', share:0.45, corr:'jr_e',   at:1, gate:'jr',   via:'新快速 11〜40分'},
  {id:'sanyo_loc',name:'山陽電鉄沿線',     seg:'loc', share:0.15, corr:'sanyo_e',at:1, gate:'sanyo',via:'直通特急'},
  {id:'tatsuno', name:'たつの・赤穂・相生', seg:'loc', share:0.22, corr:'r2_w',   at:0, gate:'carW', via:'国道2号 20分'},
  {id:'fukusaki',name:'福崎・神河・市川',   seg:'loc', share:0.18, corr:'bantan', at:0, gate:'jr',   via:'播但線 20分'},
  /* インバウンド: 前訪問地 大阪39.3%・京都18.4%、交通手段 JR在来線71.9%・飛行機68.8%・新幹線56.0% から入国・経由ルートで換算 */
  {id:'osaka_in',name:'大阪 宿泊拠点（関空入国）', seg:'in', share:0.40, corr:'jr_e',   at:3, gate:'jr',   via:'新快速 62分（日帰り）'},
  {id:'kyoto_in',name:'京都 宿泊拠点',     seg:'in', share:0.18, corr:'shin_e', at:3, gate:'shin', via:'新幹線 45分'},
  {id:'tokyo_in',name:'東京（成田・羽田）→ 西進', seg:'in', share:0.20, corr:'shin_e', at:5, gate:'shin', via:'新幹線 ゴールデンルート'},
  {id:'hiro_in', name:'広島・福岡 → 東進', seg:'in', share:0.12, corr:'shin_w', at:3, gate:'shin', via:'新幹線 1時間'},
  {id:'kix_in',  name:'関空 直行（バス）', seg:'in', share:0.06, corr:'air_kix', at:0, gate:'bus',  via:'リムジンバス 2時間'},
  {id:'kobe_in', name:'神戸空港・伊丹',    seg:'in', share:0.04, corr:'air_itm', at:0, gate:'jr',   via:'1時間15分'},
];
ORIGINS.forEach(o=>{ const n = corrNode(o.corr, o.at); o.x = n.x; o.z = n.z; o.node = n.p; });
const ORIGIN_BY_ID = Object.fromEntries(ORIGINS.map(o=>[o.id,o]));
/* インバウンド 国・地域構成（観光動向調査 姫路城地点・外国人359人） */
const COUNTRIES = [['台湾',0.136],['アメリカ',0.128],['オーストラリア',0.117],['中国',0.111],['フランス',0.098],['ドイツ',0.071],['イギリス',0.049],['カナダ',0.044],['スペイン',0.035],['韓国',0.015],['その他',0.196]];
/* 帰路・次の目的地（観光動向調査「調査地点後に訪問予定の都道府県」を正規化・市内宿泊率を加味） */
const DEST = {
  in: [['osaka_in','大阪へ戻る',0.36],['kyoto_in','京都へ',0.16],['tokyo_in','東京へ（東進）',0.14],['hiro_in','広島へ（西進）',0.11],['stay','姫路市内 宿泊',0.14],['okayama','岡山へ',0.06],['kix_in','関西国際空港（帰国）',0.03]],
  dom:[['osaka','大阪へ',0.24],['okayama','岡山へ',0.11],['kyoto','京都へ',0.06],['tokyo','東京・首都圏へ帰る',0.09],['nagoya','東海へ帰る',0.06],['stay','姫路市内 宿泊',0.30],['shikoku','香川・四国へ',0.04],['fukusaki','山陰（鳥取・城崎）へ',0.03],['car_e','車で京阪神へ',0.04],['kyushu','九州へ帰る',0.03]],
  loc:[['kakogawa','加古川・明石方面へ帰宅',0.40],['tatsuno','たつの・赤穂方面へ帰宅',0.24],['fukusaki','福崎・神河方面へ帰宅',0.18],['sanyo_loc','山陽電鉄沿線へ帰宅',0.10],['osaka','大阪・神戸へ',0.05],['stay','姫路市内 宿泊',0.03]],
};
/* 市内 回遊先（入込客数 R6: 好古園58万・動物園37.9万・美術館 等 と、外国人の「姫路城以外の観光施設」42.1% から立寄率を仮置き） */
const SPOTS = [
  {n:'好古園',            p:{in:0.42, dom:0.36, loc:0.24}, dw:45},
  {n:'みゆき通り商店街',  p:{in:0.50, dom:0.60, loc:0.66}, dw:40},
  {n:'姫路市立美術館',    p:{in:0.12, dom:0.18, loc:0.14}, dw:50},
  {n:'兵庫県立歴史博物館',p:{in:0.07, dom:0.12, loc:0.10}, dw:45},
  {n:'姫路市立動物園',    p:{in:0.06, dom:0.22, loc:0.24}, dw:50},
  {n:'書写山圓教寺',      p:{in:0.12, dom:0.10, loc:0.06}, dw:150},
  {n:'手柄山中央公園',    p:{in:0.02, dom:0.06, loc:0.12}, dw:60},
  {n:'アクリエひめじ',    p:{in:0.01, dom:0.04, loc:0.05}, dw:90},
];
const CASTLE_DWELL = {in:150, dom:140, loc:120};   // 平均滞在分（城内）
/* 出典 */
const SOURCES = [
  ['姫路市「姫路城の2025年度入城者数」（総数 1,567,674人・外国人 547,426人・月別）','https://www.city.himeji.lg.jp/shisei/0000033218.html'],
  ['姫路市「姫路城の2024年度入城者数」（1,532,111人・外国人 549,161人 35.8%）','https://www.city.himeji.lg.jp/shisei/0000030634.html'],
  ['姫路市・姫路観光コンベンションビューロー「令和6年度 姫路市入込客数・観光動向調査 報告書」（総入込 923.2万人、居住地・交通手段・旅行形態・消費額）','https://www.himeji-kanko.jp/dmo/content/wRE4GT'],
  ['姫路城公式サイト「3月1日以降の姫路城縦覧料等について」（一般 ¥2,500・市民 ¥1,000・デジタルチケット）','https://www.city.himeji.lg.jp/castle/0000030746.html'],
  ['姫路城公式サイト「ご利用案内」（大天守 1,000人/時・15,000人/日の入城制限）','https://www.city.himeji.lg.jp/castle/0000007671.html'],
  ['神戸新聞（2024/9）「姫路城の観光客、日本人も外国人も市内宿泊は2割未満」','https://www.kobe-np.co.jp/news/himeji/202409/0018123917.shtml'],
  ['総務省「兵庫県姫路市の市街地における回遊行動促進に関する調査研究」（令和6年3月・GPS非集計ODデータ約27万IDの購入分析事例）','https://www.soumu.go.jp/main_content/000948772.pdf'],
  ['国土数値情報 駅別乗降客数（JR姫路駅 91,574人/日・山陽姫路駅 22,566人/日）','https://statresearch.jp/traffic/train/stations/passengers_station_94_618.html'],
];

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
    r.rib = buildRibbon(pth.map(p=>({x:p[0], z:p[1]})), {col:0xffd166, w:22, kind:3}, routeGroup, 1.6);
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
const agentMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 6, 5), new THREE.MeshBasicMaterial(), MAX_AG);
/* 軌跡（移動中の来訪者が残す尾）: 細長い板を進行方向に並べ、線として見せる */
const TRAIL_K = 16, TRAIL_STEP = 6;
const trailMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false}), MAX_AG*TRAIL_K);
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
  a.tr = [];
  a.r = route(a.cur, plan.length ? plan[0].node : endNode, true); a.r.uses = (a.r.uses||0)+1;
  agents.push(a);
  STATS.arrived[seg]++; STATS.byGate[gk]=(STATS.byGate[gk]||0)+1; dayTotal++;
}
function resetSim(){
  agents.length = 0; spawnAcc = 0; dayTotal = 0;
  STATS.arrived={in:0,dom:0,loc:0}; STATS.departed={}; STATS.byGate={}; STATS.atSpot={}; STATS.staying=0; STATS.castleEntered=0; STATS.dwellSum=0; STATS.dwellN=0; STATS.kaiyu=0;
  agentMesh.count = 0; trailMesh.count = 0;
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
        const lt = a.tr[a.tr.length-1];
        if(!lt || Math.hypot(lt[0]-p[0], lt[1]-p[1]) >= TRAIL_STEP){ a.tr.push([p[0], p[1]]); if(a.tr.length > TRAIL_K+1) a.tr.shift(); }
      }
    } else if(a.state==='castle' || a.state==='spot'){
      a.dwellLeft -= dtMin;
      if(a.state==='castle') inCastle++; else { atSpotN++; const nm=a.plan[a.pi].name; spotNow[nm]=(spotNow[nm]||0)+1; }
      if(a.dwellLeft <= 0){
        a.pi++;
        const next = a.pi < a.plan.length ? a.plan[a.pi].node : a.endNode;
        a.r = route(a.cur, next, true); a.r.uses = (a.r.uses||0)+1; a.d = 0; a.state='move'; a.tr = [];
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
        const mx=(p0[0]+p1[0])/2, mz=(p0[1]+p1[1])/2; _PV.set(mx, TH(mx,mz)+2.4, mz); _S.set(L+1.2, 0.6, 0.8+2.2*f);
        M.compose(_PV, _Q, _S); trailMesh.setMatrixAt(ti, M);
        C.setHex(SEG[a.seg].col).multiplyScalar(0.2+1.0*f); trailMesh.setColorAt(ti, C);
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
