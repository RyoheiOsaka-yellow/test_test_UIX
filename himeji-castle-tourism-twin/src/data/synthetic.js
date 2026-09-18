
/* =====================================================================================
   SYNTHETIC DATA — 合成パラメータ（実データではありません）
   来訪者セグメント・シナリオ・流入ゲート・動線・出発地・回遊先・滞在時間・消費額など、
   公表統計（SOURCES 参照）から換算した仮置き値。実データに差し替える際はこのファイル
   （data/synthetic）を、DB 由来の値（data/real）を読むモジュールに置換する。
   ===================================================================================== */
const DATA_ORIGIN = { synthetic:true, note:'人流はシミュレーション（synthetic）。地図・建物・地形・土地利用は実データ（PLATEAU / OSM / 地理院 / 兵庫県DSM）' };
/* ================= 来訪者セグメント / シナリオ / 流入ゲート（ダミー定義） ================= */
const SEG = {
  in: {name:'インバウンド',  col:0x65beff, css:'var(--in)'},
  dom:{name:'国内（県外）',  col:0x62e4ab, css:'var(--dom)'},
  loc:{name:'県内・近隣',    col:0xef91bb, css:'var(--loc)'},
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

