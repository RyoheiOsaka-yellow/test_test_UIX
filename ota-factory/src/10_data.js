// ================= 計画データ（YELLOW 大田区 フュージョン・ファクトリー構想） =================
// 座標系: x=東(+), z=南(+ 道路側), y=上。単位はすべて m。
// ※敷地・寸法は構想段階の想定値。実敷地が決まれば SITE / BLD の数値差替えで全体が追従する。

const SITE = {
  w: 120, d: 80,                              // 敷地 120m × 80m = 9,600㎡
  name: "東京都大田区（羽田・糀谷 工業地域 想定地）",
  zoning: "工業地域", bcrMax: 60, farMax: 200, // 建蔽率60% / 容積率200%（工業地域の一般値）
  heightNote: "高さ制限なし（日影規制対象外の想定）・航空法 羽田制限表面内 要確認",
  road: "南側 前面道路 幅員 12m（歩道 3m）",
};

const BLD = {
  x0: -44, x1: 44,     // 東西 88m
  z0: -30, zh: 2,      // 北壁 → 機械ホール 32m
  z1: 18,              // 南側 3層ストリップ 16m（ホール z 2〜18）
  terraceZ: 22,        // 2F テラス先端
  eaveZ: 24,           // 屋根 南側キャンチ先端
  lv: [0, 5.0, 9.5],   // 1F / 2F / 3F FL
  eave: 14.0,          // 軒高
  craneRail: 10.5,     // クレーンレール天端
  grid: 8,             // 柱スパン（東西）
  // 折板屋根 断面プロファイル (z, y)  北軒 → 棟1 → 谷 → 棟2 → 南軒
  roofProfile: [[-31, 13.6], [-16, 18.2], [-4, 15.6], [6, 17.6], [24, 14.2]],
};
BLD.w = BLD.x1 - BLD.x0; BLD.d = BLD.z1 - BLD.z0;

// ---- 階ごとのゾーン ----
// type: hall(機械ホール) eng(ソフト・設計) lab(実験・計測) pub(共用) core(コア) svc(設備) out(屋外)
const ZTYPE = {
  mach:  { c: 0x58a6ff, n: "機械加工" },
  asm:   { c: 0xf2c744, n: "大型組立" },
  test:  { c: 0xff7b72, n: "試運転・試験" },
  logi:  { c: 0x3fb950, n: "受入・出荷" },
  sw:    { c: 0xbc8cff, n: "ソフトウェア開発" },
  design:{ c: 0x79c0ff, n: "設計（CAD/CAE）" },
  lab:   { c: 0xf778ba, n: "計測・電子ラボ" },
  pub:   { c: 0xd2a8ff, n: "共用・来客" },
  core:  { c: 0x8b949e, n: "コア（階段・EV・WC）" },
  svc:   { c: 0x6e7681, n: "設備・サービス" },
  out:   { c: 0x56d364, n: "屋外・外構" },
};

// id, 名称, 階(1/2/3/0=屋外), type, x0,x1,z0,z1, 想定人員, 概要
const ZONES = [
  // ---- 1F 機械ホール（高天井 14m / 10tクレーン2基）----
  ["mach",  "機械加工エリア",       1, "mach", -44, -12, -30, 2,  14, "5軸MC・横型MC・門型MC・旋盤・EDM。ロボットセル2基で自動供給。"],
  ["asm1",  "大型組立ベイ A",       1, "asm",  -12,   4, -30, 2,  10, "開発中大型機の組立・調整。10tクレーン直下、床耐荷重 5t/㎡。"],
  ["asm2",  "大型組立ベイ B",       1, "asm",    4,  20, -30, 2,  10, "第2号機／顧客立会い組立。可動間仕切りでAと連結可。"],
  ["recv",  "受入・資材置場",       1, "logi",  20,  36, -30, -14, 3, "パレットラック・部品棚。入荷検査後 AGV で各ベイへ供給。"],
  ["tcell", "試運転・性能試験セル", 1, "test",  20,  36, -14, 2,   4, "防音ガラス囲い。振動・騒音・熱測定、ソフトとの連成試験。"],
  ["ship",  "出荷ドック",           1, "logi",  36,  44, -30, 2,   3, "ドックレベラー2基・大型機は東側大扉からトレーラー積込。"],
  // ---- 1F 南側ストリップ ----
  ["lobby", "エントランス・受付",   1, "pub",  -44, -30,  2, 18,  2, "来客ロビー。ガラス越しに機械ホールを見せるショーケース動線。"],
  ["show",  "ショールーム・実機展示",1, "pub", -30, -16,  2, 18,  1, "開発機の実機展示・デモ。ホールと一体の吹抜け。"],
  ["cmm",   "精密計測室（恒温）",   1, "lab",  -16,  -6,  2, 18,  3, "20±0.5℃恒温。門型三次元測定機・真円度・粗さ計。"],
  ["elab",  "電子・制御ラボ",       1, "lab",   -6,   6,  2, 18,  6, "制御盤組立・配線・基板試験。ESD床。"],
  ["tool",  "工具・治具室",         1, "svc",    6,  16,  2, 18,  2, "ツールプリセッタ・治具保管・計測工具管理。"],
  ["insp",  "受入検査",             1, "logi",  16,  28,  2, 18,  3, "購入部品の受入検査・一時保管。"],
  ["rest1", "休憩・更衣",           1, "pub",   28,  36,  2, 18,  0, "製造スタッフ更衣・休憩。"],
  ["core1", "コア（階段・EV・WC）", 1, "core",  36,  44,  2, 18,  0, "荷物用EV 2t・人荷共用。"],
  // ---- 2F ソフトウェア階 ----
  ["core2w","コア（階段・EV）",     2, "core", -44, -36,  2, 18,  0, ""],
  ["sw",    "ソフトウェア開発フロア",2, "sw",   -36,  -8,  2, 18, 56, "オープンデスク56席。ガラス越しに組立ベイを俯瞰。実機ログを即時に見られる位置。"],
  ["hil",   "HIL・シミュレーションラボ",2,"lab", -8,   2,  2, 18,  6, "Hardware-in-the-Loop。実機制御盤＋デジタルツイン連成。"],
  ["mtg2",  "会議室 A/B",           2, "pub",    2,  12,  2, 18,  0, "ガラス間仕切り・ホール側にモニタ。"],
  ["ctrl",  "制御・組込開発",       2, "sw",    12,  24,  2, 18, 16, "PLC/モーションコントローラ/組込ファーム開発。"],
  ["srv",   "サーバー室・エッジDC", 2, "svc",   24,  34,  2, 18,  1, "GPUサーバー 8ラック。工場データ基盤・学習用。"],
  ["rest2", "休憩・フォンブース",   2, "pub",   34,  36,  2, 18,  0, ""],
  ["core2e","コア（階段・EV・WC）", 2, "core",  36,  44,  2, 18,  0, ""],
  ["terr2", "2F テラス（植栽）",    2, "out",  -44,  44, 18, 22,  0, "南面全長のテラス。木天井の軒下。"],
  // ---- 3F 設計・共用階 ----
  ["core3w","コア（階段・EV）",     3, "core", -44, -36,  2, 18,  0, ""],
  ["design","設計フロア（メカ/電気）",3,"design",-36, -10,  2, 18, 40, "CAD/CAE 40席。2Fソフトと吹抜け階段で直結。"],
  ["mtg3",  "会議室群・プロジェクトルーム",3,"pub",-10, 4,  2, 18,  0, "大4・中2。壁面ホワイトボード。"],
  ["exec",  "役員・管理部門",       3, "pub",    4,  16,  2, 18, 12, "経営・人事・総務。"],
  ["cafe",  "カフェテリア・ラウンジ",3, "pub",   16,  36,  2, 18,  0, "全社の交流点。木天井・ホール側ガラス。"],
  ["core3e","コア（階段・EV・WC）", 3, "core",  36,  44,  2, 18,  0, ""],
  // ---- 屋外 ----
  ["plaza", "前庭プラザ・来客駐車", 0, "out",  -44,  44, 24, 40,  0, "歩道からの緩やかなアプローチ。樹木・ベンチ。"],
  ["park",  "駐車場（太陽光カーポート）",0,"out",-60, -44,-40, 40, 0, "32台。カーポート屋根に太陽光 120kW。"],
  ["yard",  "東側ヤード・トラック動線",0,"out",  44,  60,-40, 40, 0, "大型トレーラー進入路・ドック待機。"],
  ["north", "北側 屋外試験ヤード・設備",0,"out",-44,  44,-40,-30, 0, "キュービクル・コンプレッサ・屋外試験スペース。"],
];

// ---- 設備台帳（機械ホール・ラボ） ----
// kind: mc5 hmc lathe gantry edm grind robotcell cmm assembly testcell rack bench tool server hil crane agv
const EQUIP = [
  // ※ 工作機械・組立ステーション・制御盤組立はレーン定義（LANES）から自動生成される
  // 組立ベイ
  { id:"RK-A",  kind:"rack",   name:"部品ラック A", x:-10.5, z:-27, rot:0, zone:"asm1", spec:{ 仕様:"パレットラック 3段 L8m", 用途:"組立部品キット" } },
  { id:"RK-B",  kind:"rack",   name:"部品ラック B", x:17.5, z:-27, rot:0, zone:"asm2", spec:{ 仕様:"パレットラック 3段 L8m", 用途:"組立部品キット" } },
  // 試験・受入・出荷
  { id:"TC-01", kind:"testcell", name:"試運転・性能試験セル", x:28, z:-6, rot:0, zone:"tcell",
    spec:{ 仕様:"防音ガラス囲い 14×12m・H6m", 計測:"振動/騒音/熱/消費電力", 連成:"HILラボとリアルタイム接続", 電源:"200 kVA" } },
  { id:"RK-R1", kind:"rack",   name:"資材パレットラック 1", x:24, z:-26, rot:0, zone:"recv", spec:{ 仕様:"パレットラック 4段 L8m", 用途:"購入部品・鋼材" } },
  { id:"RK-R2", kind:"rack",   name:"資材パレットラック 2", x:24, z:-20, rot:0, zone:"recv", spec:{ 仕様:"パレットラック 4段 L8m", 用途:"購入部品・鋼材" } },
  { id:"RK-R3", kind:"rack",   name:"資材パレットラック 3", x:32, z:-26, rot:0, zone:"recv", spec:{ 仕様:"パレットラック 4段 L8m", 用途:"梱包材・治具" } },
  { id:"DK-01", kind:"dock",   name:"ドックレベラー #1", x:43, z:-24, rot:0, zone:"ship", spec:{ 仕様:"油圧式 2.0×2.5m 6t", 扉:"電動オーバースライダー W3.5×H4.5" } },
  { id:"DK-02", kind:"dock",   name:"ドックレベラー #2", x:43, z:-16, rot:0, zone:"ship", spec:{ 仕様:"油圧式 2.0×2.5m 6t", 扉:"電動オーバースライダー W3.5×H4.5" } },
  { id:"DK-03", kind:"bigdoor",name:"大型機搬出大扉", x:43, z:-5, rot:0, zone:"ship", spec:{ 仕様:"W8.0×H7.0 電動ハンガードア", 用途:"大型機のトレーラー積込（低床）" } },
  // クレーン・AGV
  { id:"CR-01", kind:"crane",  name:"天井クレーン #1（10t）", x:-20, z:-14, rot:0, zone:"mach",
    spec:{ 定格:"10 t", スパン:"30 m", 揚程:"9 m", 走行:"全長 88m 共用ランウェイ", 制御:"インバータ・無線操作" } },
  { id:"CR-02", kind:"crane",  name:"天井クレーン #2（10t）", x:14, z:-14, rot:0, zone:"asm2",
    spec:{ 定格:"10 t", スパン:"30 m", 揚程:"9 m", 走行:"全長 88m 共用ランウェイ", 制御:"インバータ・無線操作" } },
  { id:"AGV-1", kind:"agv",    name:"AGV #1（パレット搬送）", x:30, z:-14, rot:0, zone:"recv", spec:{ 可搬:"1,000 kg", 速度:"1.5 m/s", 誘導:"SLAM（自社ソフト）" } },
  { id:"AGV-2", kind:"agv",    name:"AGV #2（部品供給）", x:-20, z:-14, rot:0, zone:"mach", spec:{ 可搬:"500 kg", 速度:"1.5 m/s", 誘導:"SLAM（自社ソフト）" } },
  // 1F ラボ
  { id:"CM-01", kind:"cmm",    name:"門型三次元測定機", x:-11, z:9, rot:0, zone:"cmm",
    spec:{ 測定範囲:"X1200×Y2000×Z1000", 精度:"1.5+L/350 µm", 環境:"20±0.5℃", 基礎:"独立防振基礎" } },
  { id:"TL-01", kind:"toolroom", name:"ツールプリセッタ・工具棚", x:11, z:10, rot:0, zone:"tool", spec:{ 仕様:"プリセッタ ×1・ツールキャビネット ×8", 管理:"RFID 工具管理" } },
  // 2F
  { id:"HIL-1", kind:"hil",    name:"HILシミュレータ", x:-3, z:10, rot:0, zone:"hil",
    spec:{ 構成:"リアルタイム機 ×2・実機制御盤 ×2・モーションシミュレータ", 用途:"制御ソフトの実機レス検証、試験セルと連成" } },
  { id:"SV-01", kind:"server", name:"GPUサーバー・ラック列", x:29, z:10, rot:0, zone:"srv",
    spec:{ ラック:"42U ×8（GPU 4ラック・ストレージ 2・NW 2）", 電源:"UPS 150kVA・N+1", 冷却:"リアドア水冷" } },
];

// ---- 人員計画 ----
const STAFF = [
  ["ソフトウェア開発", 72, "sw"], ["設計（メカ・電気）", 40, "design"], ["製造・組立・加工", 38, "asm"],
  ["品質・計測・試験", 12, "test"], ["生産管理・物流", 8, "logi"], ["経営・管理", 14, "pub"],
];

// ---- ガイドツアー ----
const TOUR = [
  { cam:{ yaw:-0.75, pitch:0.55, dist:190, target:[0,6,0] }, mode:"ext", title:"大田区 フュージョン・ファクトリー",
    text:"大型機械の開発ホールとソフトウェア開発フロアをひとつの屋根の下に重ねた「開発一体型工場」。敷地 120×80m、延床約7,000㎡。" },
  { cam:{ yaw:0.0, pitch:0.22, dist:120, target:[0,8,20] }, mode:"ext", title:"南面：折板屋根と木天井の軒下",
    text:"3層のガラスファサード。2Fテラスは植栽帯、3Fは軒下の設計フロア。1Fは実機展示・ロビーからホールを見通す。" },
  { cam:{ yaw:2.0, pitch:0.5, dist:60, target:[44,6,-14] }, mode:"ext", title:"東側：出荷ドックと大型機搬出扉",
    text:"ドックレベラー2基と W8×H7m の大扉。トレーラー進入路は敷地東側に集約し、来客動線と分離。" },
  { cam:{ yaw:-0.4, pitch:0.5, dist:150, target:[0,6,-10] }, mode:"floor", floor:1, title:"1F 機械ホール（屋根を外して俯瞰）",
    text:"西から機械加工 → 大型組立ベイA/B → 試運転セル → 出荷。中央通路 4m に AGV ループ。10t クレーン2基が全長を走行。" },
  { cam:{ yaw:-2.3, pitch:0.28, dist:48, target:[-28,3,-14] }, mode:"int", floor:1, title:"機械加工エリア",
    text:"5軸MC×3、横型MC×2、門型MC、旋盤、EDM、研削。ロボットセル2基が夜間無人運転。切粉・クーラントは地下トレンチ集約。" },
  { cam:{ yaw:-0.6, pitch:0.62, dist:42, target:[-28,2,-20] }, mode:"floor", floor:1, lane:"L1", title:"レーン L1：精密部品 加工レーン（自動生成）",
    text:"レシピ「旋盤→5軸MC×3→横型MC×2→洗浄→計測→ストア」を区画に流し込むと、機械配置・床の流れ・天井ガントリーローダ・ツールレールが自動生成され、タクト・日産・OEE・自動化率が算出される。" },
  { cam:{ yaw:-0.6, pitch:0.62, dist:42, target:[-28,2,-5] }, mode:"floor", floor:1, lane:"L2", title:"レーン L2：大型構造物 加工レーン",
    text:"門型MCを中心に研削・EDM・計測へ。ジブクレーンとエネルギーブームが大物の段取りを支える。" },
  { cam:{ yaw:-1.0, pitch:0.3, dist:46, target:[-4,4,-16] }, mode:"int", floor:1, title:"大型組立ベイ A",
    text:"床耐荷重 5t/㎡・クレーン直下。開発機を組み上げながら、真上のソフト開発フロアからログを見てパラメータを即時に調整。" },
  { cam:{ yaw:0.9, pitch:0.3, dist:40, target:[28,3,-6] }, mode:"int", floor:1, title:"試運転・性能試験セル",
    text:"防音ガラス囲い。振動・騒音・電力を計測し、2F HIL ラボとリアルタイム連成。" },
  { cam:{ yaw:-0.8, pitch:0.5, dist:48, target:[4,2,-14] }, mode:"floor", floor:1, lane:"L3", title:"レーン L3：大型機 組立レーンと天井工具",
    text:"10t クレーン（フェストゥーン・巻上ドラム・フックブロック）、ツールバランサーレールのナットランナ、エネルギーブーム、据付基準を床に描くレーザー投影、天井カメラ／UWB で人と部品の位置を把握。" },
  { cam:{ yaw:-0.5, pitch:0.55, dist:120, target:[0,3,-12] }, mode:"floor", floor:1, plant:true, title:"工場全体のライン：需要 → 必要物量 → 制約",
    text:"目標「大型機 2 台/月」から BOM で各レーンの必要量を出し、能力と比べて稼働率を表示。緑の流線が供給レーン→組立の物量リンク。社内レーンの無い品目は外注前提として表示する。左下「工場全体」で目標台数を動かせる。" },
  { cam:{ yaw:-0.7, pitch:0.5, dist:140, target:[0,5,-8] }, mode:"floor", floor:2, module:"edge", title:"YELLOW Factory OS：Edge Runtime",
    text:"全レーンの機械に載る実行環境。1 kHz のログが 2F の Edge DC に集まり、Scheduler・Quality AI・Digital Twin（このモデル自身）に供給される。モジュールをクリックすると、使うレーンとデータの流れを表示。" },
  { cam:{ yaw:-1.1, pitch:0.4, dist:60, target:[-20,7,10] }, mode:"floor", floor:2, lane:"L5", title:"2F ソフトウェア開発フロア = レーン L5",
    text:"コミット→ビルド→HIL→試験セルでの実機試験→OTA 配信を 1 本のレーンとして扱い、週あたりのリリース数とリードタイムを機械レーンと同じ KPI で見る。" },
  { cam:{ yaw:-1.1, pitch:0.4, dist:60, target:[-20,7,10] }, mode:"floor", floor:2, title:"2F ソフトウェア開発フロア",
    text:"56席のオープンフロア。ホール側は全面ガラスとバルコニーで、組立中の実機が常に視界にある。" },
  { cam:{ yaw:-0.9, pitch:0.4, dist:60, target:[-20,11.5,10] }, mode:"floor", floor:3, title:"3F 設計フロア・カフェテリア",
    text:"CAD/CAE 40席、会議室群、全社のカフェテリア。木天井の下で設計とソフトが日常的に交わる。" },
  { cam:{ yaw:-0.6, pitch:0.18, dist:70, target:[-30,4,24] }, mode:"ext", title:"前庭プラザ・来客アプローチ",
    text:"歩道から樹木とベンチの前庭を抜けてロビーへ。西側はソーラーカーポート駐車場 32台。" },
];

// ---- 構想イメージ ----
const PHOTOS = [
  { f:"img/c01_aerial.jpg",   t:"全体鳥瞰：機械ホール＋ソフト棟＋中庭＋ソーラー駐車場" },
  { f:"img/c02_exterior.jpg", t:"西面：ガラス越しの機械ホールと前庭" },
  { f:"img/c03_hall.jpg",     t:"機械ホール内部：黄色クレーンと2Fガラス越しのオフィス" },
  { f:"img/c04_courtyard.jpg",t:"中庭：ソフト棟テラスとホールの対面" },
  { f:"img/v01_terraced.jpg", t:"南面テラス：1Fホール／2Fテラス／3F軒下オフィス" },
  { f:"img/v02_street.jpg",   t:"夕景：街路から見える開発ホール" },
  { f:"img/v03_folded.jpg",   t:"折板屋根と木天井のファサード" },
  { f:"img/v04_machining.jpg",t:"機械加工エリアとガラス越しのエンジニアリング" },
  { f:"img/v05_englab.jpg",   t:"エンジニアリング・ラボ：ホールを背にした設計席" },
];

// ================= YELLOW Factory OS（ソフトウェア層） =================
// layer: 1=現場制御 2=協調・計画 3=品質・データ 4=開発
const OS_MODULES = {
  edge:  { n:"Edge Runtime",     layer:1, d:"各機械のPLC/CNC/ロボットに載る実行環境。1kHzでログ・振動・電流を収集し、レシピ（加工条件・組立手順）を配信。" },
  fleet: { n:"Fleet 協調",        layer:2, d:"AGV・天井クレーン・ガントリーローダの経路と優先度を一括制御。干渉を予測して待機を最小化。" },
  sched: { n:"Scheduler",         layer:2, d:"全レーン横断の工程計画。タクト・納期・無人運転枠から日次スケジュールを自動生成。" },
  mes:   { n:"MES / 実績",        layer:3, d:"着手・完了・不良を自動収集し、OEE・リードタイムをレーン別に可視化。" },
  qai:   { n:"Quality AI",        layer:3, d:"CMM・画像・振動データから寸法ドリフトと異常を推定。加工条件を Edge へフィードバック。" },
  twin:  { n:"Digital Twin",      layer:3, d:"このモデルと同じ台帳・レーン定義から工場の双子を生成。配置変更・増設の影響を事前に試算。" },
  cmms:  { n:"予知保全",          layer:3, d:"主軸・ボールねじ・クレーン巻上機の劣化を推定し、保全枠を Scheduler に予約。" },
  cicd:  { n:"CI/CD・HIL",        layer:4, d:"制御ソフトのビルド→シミュレーション→HIL→実機試験→配信を自動化。リリースを週次で回す。" },
  ota:   { n:"OTA 配信",          layer:4, d:"出荷済み機械・社内機械へのソフト更新をロールアウト。失敗時は自動ロールバック。" },
};
const OS_LAYERS = [[1,"現場制御"],[2,"協調・計画"],[3,"品質・データ"],[4,"開発・配信"]];

// ---- ステーション種別（レーン生成の部品）----
// fp:[レーン方向の幅, 奥行] m / ct:標準作業時間 / unit: min|h / auto: auto(無人可) semi(監視付) manual / ppl:要員
const STATION_TYPES = {
  load:    { n:"素材投入・段取",     kind:"load",     fp:[2.6,2.4], ct:5,   unit:"min", auto:"semi",   ppl:1,
             spec:{ 仕様:"素材パレット台＋ツールプリセット端末", 連携:"Scheduler が投入順を指示" } },
  lathe:   { n:"CNC旋盤",            kind:"lathe",    fp:[3.6,2.2], ct:18,  unit:"min", auto:"semi",   ppl:0.5,
             spec:{ 型式:"CNC旋盤 Y軸付（想定）", 最大加工径:"φ450", 電源:"25 kVA", 質量:"6 t" } },
  mc5:     { n:"5軸マシニングセンタ", kind:"mc5",      fp:[4.6,5.0], ct:42,  unit:"min", auto:"auto",   ppl:0.3,
             spec:{ 型式:"5軸立形MC（想定）", 加工範囲:"X800×Y800×Z600", 主軸:"15,000 min⁻¹", 電源:"30 kVA", 質量:"12 t", 供給:"天井ガントリーローダ" } },
  hmc:     { n:"横型マシニングセンタ", kind:"hmc",      fp:[5.6,6.4], ct:25,  unit:"min", auto:"auto",   ppl:0.3,
             spec:{ 型式:"横型MC パレット2面（想定）", パレット:"630×630", 主軸:"12,000 min⁻¹", 電源:"35 kVA", 質量:"16 t" } },
  gantry:  { n:"門型マシニングセンタ", kind:"gantry",   fp:[12.0,7.0], ct:240, unit:"min", auto:"semi",  ppl:1,
             spec:{ 型式:"門型5面加工機（想定）", 加工範囲:"X4000×Y2500×Z1200", テーブル:"4×2.5 m 耐荷重 15 t", 電源:"80 kVA", 質量:"45 t", 基礎:"独立基礎 深さ1.5 m" } },
  edm:     { n:"ワイヤ放電加工機",    kind:"edm",      fp:[3.2,3.0], ct:90,  unit:"min", auto:"auto",   ppl:0.2,
             spec:{ 型式:"ワイヤEDM（想定）", 加工範囲:"X600×Y400", 電源:"15 kVA", 質量:"4 t" } },
  grind:   { n:"平面研削盤",          kind:"grind",    fp:[3.0,2.2], ct:60,  unit:"min", auto:"semi",   ppl:0.5,
             spec:{ 型式:"平面研削盤（想定）", テーブル:"600×300", 電源:"10 kVA", 質量:"3 t" } },
  robotcell:{ n:"ロボット段取セル",    kind:"robotcell",fp:[6.4,6.4], ct:3,   unit:"min", auto:"auto",   ppl:0,
             spec:{ 構成:"6軸ロボット 可搬50 kg＋ワークストッカ", 役割:"夜間無人運転の素材・治具段取", 安全柵:"H2.0 m メッシュ" } },
  wash:    { n:"洗浄・エアブロー",    kind:"wash",     fp:[2.8,2.2], ct:6,   unit:"min", auto:"auto",   ppl:0,
             spec:{ 仕様:"高圧温水洗浄機 バスケット式", 排水:"油水分離→再生" } },
  cmm:     { n:"三次元測定（計測室）", kind:"ref",      ref:"CM-01",  ct:12,  unit:"min", auto:"auto",   ppl:0.3 },
  store:   { n:"完成品ストア",        kind:"store",    fp:[3.2,1.4], ct:2,   unit:"min", auto:"auto",   ppl:0,
             spec:{ 仕様:"ライトガイド棚 4段×8間口", 連携:"MES が棚番を発行、AGV が組立へ供給" } },
  asmMech: { n:"機械組立（ベイ）",    kind:"asmA",     fp:[14,9],    ct:160, unit:"h",   auto:"manual", ppl:4,
             spec:{ 機種:"大型門型加工システム（開発中）", 寸法:"L9.0×W4.5×H5.2 m", 質量:"38 t", 工具:"天井ツールレール（ナットランナ）・エネルギーブーム", 位置決め:"レーザー投影で据付基準を床に表示" } },
  asmWire: { n:"配線・制御盤接続",    kind:"asmB",     fp:[12,8],    ct:60,  unit:"h",   auto:"manual", ppl:3,
             spec:{ 機種:"自律搬送・ロボット統合セル（開発中）", 寸法:"L8.0×W4.0×H3.6 m", 質量:"22 t", 工程:"配線→盤接続→I/O チェック" } },
  asmSoft: { n:"ソフト結合・調整",    kind:"ref",      ref:"@lane",  ct:48,  unit:"h",   auto:"semi",   ppl:2 },
  test:    { n:"試運転・性能試験",    kind:"ref",      ref:"TC-01",  ct:40,  unit:"h",   auto:"semi",   ppl:2 },
  ship:    { n:"出荷・積込",          kind:"ref",      ref:"DK-03",  ct:16,  unit:"h",   auto:"manual", ppl:2 },
  panel:   { n:"盤組立",              kind:"panel",    fp:[2.6,3.2], ct:12,  unit:"h",   auto:"manual", ppl:1,
             spec:{ 仕様:"盤組立架台＋部品ピッキング棚", 図面:"電気CADから配線表を Edge 端末へ配信" } },
  wiring:  { n:"配線ステーション",    kind:"wiring",   fp:[2.6,3.2], ct:16,  unit:"h",   auto:"manual", ppl:1,
             spec:{ 仕様:"ワイヤ加工機＋圧着＋配線台", 支援:"AR 端末で配線経路を表示" } },
  ptest:   { n:"通電・絶縁試験",      kind:"ptest",    fp:[3.0,3.0], ct:4,   unit:"h",   auto:"semi",   ppl:1,
             spec:{ 仕様:"耐電圧試験器・絶縁抵抗計・I/O シミュレータ", 記録:"MES へ自動登録" } },
  commit:  { n:"開発・コミット",      kind:"ref",      ref:"@zone:sw", ct:0,  unit:"h",   auto:"manual", ppl:0 },
  build:   { n:"ビルド・シミュレーション", kind:"ref", ref:"SV-01",  ct:0.5, unit:"h",   auto:"auto",   ppl:0 },
  hil:     { n:"HIL 試験",            kind:"ref",      ref:"HIL-1",  ct:2,   unit:"h",   auto:"auto",   ppl:0.5 },
  ftest:   { n:"実機試験（試験セル）", kind:"ref",     ref:"TC-01",  ct:4,   unit:"h",   auto:"semi",   ppl:1 },
  release: { n:"リリース・OTA",       kind:"ref",      ref:"SV-01",  ct:1,   unit:"h",   auto:"auto",   ppl:0.5 },
};

// ---- レーンのレシピ（「こういうレーンには こういう機械」）----
// mode: flow(部品/日) project(台/月) release(件/週)
const LANE_RECIPES = {
  precision: { n:"精密部品 加工レーン", mode:"flow", color:0x58a6ff, unitName:"個",
    stations:[["load",1],["lathe",2],["mc5",3],["hmc",2],["wash",1],["cmm",1],["store",1]], aux:[["robotcell",1]],
    overhead:["gantryLoader","toolRail","cams"], os:["edge","fleet","sched","mes","qai","cmms","twin"], params:{ mcCount:3 },
    desc:"旋盤→5軸MC→横型MC→洗浄→計測→ストア。5軸MC列は天井ガントリーローダで無人供給。" },
  heavy:     { n:"大型構造物 加工レーン", mode:"flow", color:0x79c0ff, unitName:"個",
    stations:[["load",1],["gantry",1],["grind",1],["edm",1],["cmm",1]], aux:[],
    overhead:["jib","boom","cams"], os:["edge","sched","mes","qai","cmms"], params:{},
    desc:"門型MCでベッド・コラム級の大物を5面加工。研削・EDMで仕上げ、計測室で検査。" },
  assembly:  { n:"大型機 組立レーン", mode:"project", color:0xf2c744, unitName:"台",
    stations:[["asmMech",1],["asmWire",1],["asmSoft",1],["test",1],["ship",1]], aux:[],
    overhead:["crane","toolRail","boom","laser","cams"], os:["edge","fleet","sched","mes","twin","cicd"], params:{},
    desc:"機械組立→配線→ソフト結合→試運転→出荷。天井クレーン・ツールレール・レーザー投影で据付。" },
  panel:     { n:"制御盤・電子 組立レーン", mode:"flow", color:0xf778ba, unitName:"面",
    stations:[["panel",2],["wiring",2],["ptest",1]], aux:[],
    overhead:["toolRail","boom"], os:["edge","mes","qai"], params:{},
    desc:"盤組立→配線→通電試験。完成盤は組立レーンへ AGV 供給。" },
  software:  { n:"ソフトウェア デリバリーレーン", mode:"release", color:0xbc8cff, unitName:"リリース",
    stations:[["commit",1],["build",1],["hil",1],["ftest",1],["release",1]], aux:[],
    overhead:[], os:["cicd","ota","twin","mes"], params:{},
    desc:"コミット→ビルド/シミュレーション→HIL→試験セルでの実機試験→OTA配信。機械と同じ屋根の下で週次に回す。" },
};

// ---- 配置するレーン（区画・シフト・レシピ）----
// area:[x0,x1,z0,z1] 生成範囲 / rows: 蛇行配置の行数上限 / shifts: {hours, shifts, unattended(無人運転 h/日)}
const LANES = [
  { id:"L1", recipe:"precision", zone:"mach", floor:1, area:[-43,-13,-29.5,-12], flowDir:1,
    shifts:{ hours:8, shifts:2, unattended:8 }, oee:{ avail:0.88, perf:0.95, qual:0.985 } },
  { id:"L2", recipe:"heavy",     zone:"mach", floor:1, area:[-43,-13,-11,1],    flowDir:1,
    shifts:{ hours:8, shifts:2, unattended:6 }, oee:{ avail:0.85, perf:0.9, qual:0.98 } },
  { id:"L3", recipe:"assembly",  zone:"asm1", floor:1, area:[-11,19,-29,1],     flowDir:1,
    shifts:{ hours:8, shifts:1, unattended:0, days:21 }, oee:{ avail:0.9, perf:0.9, qual:1 } },
  { id:"L4", recipe:"panel",     zone:"elab", floor:1, area:[-5.5,5.5,3,17],    flowDir:1,
    shifts:{ hours:8, shifts:2, unattended:0 }, oee:{ avail:0.92, perf:0.95, qual:0.99 } },
  { id:"L5", recipe:"software",  zone:"sw",   floor:2, area:[-36,34,3,17],      flowDir:1,
    shifts:{ hours:8, shifts:1, unattended:16, days:5 }, oee:{ avail:0.97, perf:1, qual:0.95 } },
];

// ================= v0.3: 追加レシピ・レーン間の物量リンク・需要 =================
Object.assign(STATION_TYPES, {
  laser:   { n:"ファイバーレーザー加工機", kind:"laser",  fp:[7.0,4.2], ct:9,   unit:"min", auto:"auto",   ppl:0.3,
             spec:{ 型式:"ファイバーレーザー 6 kW（想定）", 加工範囲:"3000×1500", 材料:"SS400/SUS/AL t25まで", 供給:"自動パレットチェンジャ", 電源:"60 kVA" } },
  brake:   { n:"プレスブレーキ",        kind:"brake",  fp:[4.4,2.6], ct:12,  unit:"min", auto:"semi",   ppl:1,
             spec:{ 型式:"油圧プレスブレーキ 220 t（想定）", 曲げ長:"4,000 mm", 支援:"曲げ順序を Edge 端末へ配信、角度センサ補正" } },
  weld:    { n:"溶接ロボットセル",      kind:"weld",   fp:[6.4,6.4], ct:35,  unit:"min", auto:"auto",   ppl:0.5,
             spec:{ 構成:"6軸溶接ロボット＋2軸ポジショナ＋ヒューム集塵", 方式:"MAG/TIG 切替", 安全:"遮光パネル・光線式安全装置" } },
  finish:  { n:"仕上げ・研磨ブース",    kind:"finish", fp:[3.6,3.0], ct:15,  unit:"min", auto:"manual", ppl:1,
             spec:{ 仕様:"集塵ブース・ベルトサンダ・歪取り定盤", 品質:"溶接外観をカメラで自動判定" } },
  mask:    { n:"マスキング・前処理",    kind:"mask",   fp:[3.4,2.6], ct:20,  unit:"min", auto:"manual", ppl:1,
             spec:{ 仕様:"脱脂槽・マスキング台・吊り治具", 連携:"塗装レシピ（色・膜厚）は MES から取得" } },
  booth:   { n:"塗装ブース",            kind:"booth",  fp:[8.0,5.0], ct:30,  unit:"min", auto:"semi",   ppl:1,
             spec:{ 仕様:"給排気ブース 8×5×4 m、塗装ロボット＋手吹き", 排気:"活性炭フィルタ、消防法 指定数量以下", 電源:"40 kVA" } },
  oven:    { n:"乾燥炉",                kind:"oven",   fp:[6.0,3.6], ct:40,  unit:"min", auto:"auto",   ppl:0,
             spec:{ 仕様:"熱風循環炉 80℃、台車式", 熱源:"ヒートポンプ＋電気" } },
  demoPrep:{ n:"デモ準備・段取",        kind:"demoPrep", fp:[4.0,3.0], ct:4, unit:"h",  auto:"manual", ppl:2,
             spec:{ 仕様:"デモ用ワーク・治具の準備台、搬入経路確保", 連携:"デモシナリオを Scheduler に登録" } },
  demo:    { n:"デモステージ（実演）",  kind:"demo",   fp:[10.0,7.0], ct:3,  unit:"h",   auto:"manual", ppl:2,
             spec:{ 仕様:"可動ステージ＋大型ディスプレイ＋来客席 12", 演出:"稼働データを Digital Twin にライブ表示" } },
  accept:  { n:"立会い検収・契約",      kind:"ref",    ref:"@zone:mtg2", ct:2, unit:"h", auto:"manual", ppl:1 },
  tcell:   { n:"試験セル（防音・計測）", kind:"tcell",  fp:[10.2,9.4], ct:40, unit:"h", auto:"semi",   ppl:2,
             spec:{ 仕様:"防音ガラス囲い 10×9×5 m", 計測:"振動/騒音/熱/電力", 連成:"HIL ラボとリアルタイム接続", 電源:"200 kVA" } },
  report:  { n:"試験報告・判定",        kind:"ref",    ref:"HIL-1", ct:4, unit:"h", auto:"auto", ppl:0.5 },
});
Object.assign(LANE_RECIPES, {
  sheet:   { n:"板金・溶接 レーン", mode:"flow", color:0xff9f43, unitName:"個",
    stations:[["load",1],["laser",1],["brake",1],["weld",2],["finish",1],["store",1]], aux:[],
    overhead:["toolRail","boom","cams"], os:["edge","sched","mes","qai","cmms"], params:{},
    desc:"レーザー切断→曲げ→ロボット溶接×2→仕上げ→ストア。カバー・架台・ブラケット類を内製。", supplies:"板金部品" },
  paint:   { n:"塗装 レーン", mode:"flow", color:0x2ec4b6, unitName:"個",
    stations:[["mask",1],["booth",1],["oven",1],["store",1]], aux:[],
    overhead:["boom","cams"], os:["edge","mes","qai"], params:{},
    desc:"前処理→塗装ブース（ロボット＋手吹き）→乾燥炉→ストア。カバー・外装の社内塗装。", supplies:"塗装部品" },
  demo:    { n:"顧客デモ・立会い レーン", mode:"release", color:0xffd166, unitName:"デモ",
    stations:[["demoPrep",1],["demo",1],["accept",1]], aux:[],
    overhead:["laser","cams"], os:["twin","mes","sched"], params:{},
    desc:"デモ準備→ステージ実演→会議室で検収・契約。稼働データをライブで見せる営業の工程。" },
  testing: { n:"試験 レーン（試験セル複数）", mode:"project", color:0xff6b6b, unitName:"台",
    stations:[["tcell",2],["report",1]], aux:[],
    overhead:["crane","cams"], os:["edge","cicd","qai","mes"], params:{},
    desc:"試験セル×2 で並行試験、HIL ラボで自動判定。組立レーンの試験工程をここへ外出しして組立タクトを縮める。" },
});
// 既存レシピの供給品目
LANE_RECIPES.precision.supplies = "精密部品"; LANE_RECIPES.heavy.supplies = "大型構造部品"; LANE_RECIPES.panel.supplies = "制御盤";
LANE_RECIPES.software.supplies = "ソフトリリース"; LANE_RECIPES.assembly.consumes = true; LANE_RECIPES.testing.supplies = "試験済み機";

// ---- 1 台の大型機に必要な物量（BOM）と需要 ----
const BOM = {
  "精密部品":     { perUnit:120, n:"精密加工部品（軸・ハウジング・治具）", unit:"個" },
  "大型構造部品": { perUnit:6,   n:"大型構造部品（ベッド・コラム・クロスレール）", unit:"個" },
  "板金部品":     { perUnit:40,  n:"板金部品（カバー・架台・ブラケット）", unit:"個" },
  "塗装部品":     { perUnit:40,  n:"塗装部品（外装カバー）", unit:"個" },
  "制御盤":       { perUnit:3,   n:"制御盤（主盤・操作盤・ロボット盤）", unit:"面" },
  "ソフトリリース": { perUnit:2, n:"ソフトリリース（出荷検証版＋現地版）", unit:"件" },
};
const DEMAND = { target: 2.0 };   // 目標：大型機 台/月
const WORK_DAYS = 21, WORK_WEEKS = 4.3;

// ================= v0.4: 社内化 vs 外注の比較・組立シナリオ =================
// 想定値（百万円）。設備投資 capex は据付・基礎込みの概算。人件費は 1 人あたり年 8 百万円（製造）。
const COST = { laborPerPerson: 8, areaRentPerM2: 0.036, opHoursPerYear: 1900 };   // 面積は坪 1 万円/月 相当
Object.assign(STATION_TYPES.laser,  { capex:120 }); Object.assign(STATION_TYPES.brake, { capex:35 }); Object.assign(STATION_TYPES.weld, { capex:45 });
Object.assign(STATION_TYPES.finish, { capex:6 });   Object.assign(STATION_TYPES.mask,  { capex:4 });  Object.assign(STATION_TYPES.booth,{ capex:60 });
Object.assign(STATION_TYPES.oven,   { capex:25 });  Object.assign(STATION_TYPES.store, { capex:5 });  Object.assign(STATION_TYPES.load, { capex:3 });
Object.assign(STATION_TYPES.mc5, { capex:90 }); Object.assign(STATION_TYPES.hmc, { capex:110 }); Object.assign(STATION_TYPES.lathe, { capex:45 }); Object.assign(STATION_TYPES.gantry, { capex:380 });
Object.assign(STATION_TYPES.edm, { capex:40 }); Object.assign(STATION_TYPES.grind, { capex:25 }); Object.assign(STATION_TYPES.robotcell, { capex:35 }); Object.assign(STATION_TYPES.wash, { capex:12 });
Object.assign(STATION_TYPES.tcell, { capex:80 }); Object.assign(STATION_TYPES.panel, { capex:3 }); Object.assign(STATION_TYPES.wiring, { capex:4 }); Object.assign(STATION_TYPES.ptest, { capex:8 });
Object.assign(STATION_TYPES.asmMech, { capex:40 }); Object.assign(STATION_TYPES.asmWire, { capex:10 }); Object.assign(STATION_TYPES.demoPrep, { capex:3 }); Object.assign(STATION_TYPES.demo, { capex:25 });
// 外注の想定：単価（万円/個）とリードタイム（日）
BOM["板金部品"].outsource = { unitCost:1.8, leadDays:14, n:"町工場（大田区内）へ外注" };
BOM["塗装部品"].outsource = { unitCost:1.2, leadDays:7,  n:"塗装業者へ外注" };
BOM["精密部品"].outsource = { unitCost:4.5, leadDays:21, n:"精密加工業者へ外注" };
BOM["大型構造部品"].outsource = { unitCost:120, leadDays:45, n:"大物加工業者へ外注" };
BOM["制御盤"].outsource = { unitCost:180, leadDays:30, n:"盤メーカーへ外注" };
// 社内化の候補レシピと推奨区画
const INHOUSE = { "板金部品":{ recipe:"sheet", slot:"yard" }, "塗装部品":{ recipe:"paint", slot:"yard2" }, "精密部品":{ recipe:"precision", slot:"mach-N" }, "大型構造部品":{ recipe:"heavy", slot:"mach-S" }, "制御盤":{ recipe:"panel", slot:"elab" } };
