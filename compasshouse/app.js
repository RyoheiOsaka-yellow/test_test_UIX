/* ============================================================
   COMPASS HOUSE — Renewal Demo / app.js
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   1. DATA
   ------------------------------------------------------------ */

// 画像スワップスロット（Drive素材が入るまでのプレースホルダ）
function ph(file){
  return '<div class="ph"><span><b>IMAGE SLOT</b>'+(file||(isEn()?'Drive asset':'Drive素材'))+'</span></div>';
}

const IMG = {
  heroSummer:'images/hero-summer.jpg',
  heroWinter:'images/hero-winter.jpg',
  bikes:'images/rental-bikes.jpg',
  ski:'images/rental-ski.jpg',
  guide:'images/tour-guide.jpg'
};

/* ---------- TOURS（文言修正シート準拠） ---------- */
const TOURS_GREEN = [
  {
    id:'g0',
    img:IMG.heroSummer,
    tags:['SURF','レッスン'],
    tagsEn:['SURF','LESSON'],
    title:'旅するサーフレッスン',
    titleEn:'Traveling Surf Lesson',
    price:'9,900',
    priceNote:'',
    cap:'おひとり様',
    capEn:'per person',
    note:'BIKE / SURF',
    noteEn:'BIKE / SURF',
    url:'#/contact?type=tour'
  },
  {
    id:'t1',
    fit:true, img:'images/tour-g1.jpg',
    tags:['E-BIKE','半日','初心者歓迎'],
    tagsEn:['E-BIKE','HALF DAY','BEGINNER OK'],
    title:'【長野・野沢温泉・MTB】里山トレイルを走るE-BIKEツアー（半日）初心者歓迎・ガイド付き',
    titleEn:'[Nagano/Nozawa Onsen/MTB] E-BIKE Tour on Satoyama Trails (Half Day) — Beginners Welcome, Guided',
    price:'14,300',
    priceNote:'〜',
    cap:'最大6名',
    capEn:'Max 6 pax',
    note:'レンタルバイク込み',
    noteEn:'Rental bike included',
    url:'https://compass-onlinestore.com/reserve/compassonline/1670492#pageContent'
  },
  {
    id:'t2',
    fit:true, img:'images/tour-g2.jpg',
    tags:['E-BIKE','半日','ファミリー'],
    tagsEn:['E-BIKE','HALF DAY','FAMILY'],
    title:'【長野・野沢温泉・E-BIKE】小学校高学年から参加OK！里山と田園風景を巡るサイクリング＆ランチツアー（35km・半日）初心者歓迎・ガイド付き',
    titleEn:'[Nagano/Nozawa Onsen/E-BIKE] Open from upper elementary age! Cycling & Lunch Tour through Satoyama and Rural Scenery (35km, Half Day) — Beginners Welcome, Guided',
    price:'16,500',
    priceNote:'',
    cap:'最大8名',
    capEn:'Max 8 pax',
    note:'レンタルバイク込み／ランチ別',
    noteEn:'Rental bike included / Lunch not included',
    url:'https://compass-onlinestore.com/reserve/compassonline/1920793#pageContent'
  },
  {
    id:'t3',
    fit:true, img:'images/tour-g3.jpg',
    tags:['MTB','半日','ダウンヒル'],
    tagsEn:['MTB','HALF DAY','DOWNHILL'],
    title:'【長野・野沢温泉・MTB】ゴンドラで楽しむダウンヒルMTBツアー（半日）本格マウンテンバイク体験',
    titleEn:'[Nagano/Nozawa Onsen/MTB] Downhill MTB Tour with Gondola (Half Day) — Authentic Mountain Bike Experience',
    price:'14,300',
    priceNote:'',
    cap:'最大8名',
    capEn:'Max 8 pax',
    note:'レンタルバイク込み／ゴンドラ料金別',
    noteEn:'Rental bike included / Gondola fee not included',
    url:'https://compass-onlinestore.com/reserve/compassonline/1473679#pageContent'
  }
];

/* --- ウィンターツアー：fd-system（株式会社ドリームシップ ツアー一覧）掲載分 --- */
const TOURS_WINTER = [
  {id:'w1', img:IMG.heroWinter,
   tags:['バックカントリー','2026シーズン'], tagsEn:['BACKCOUNTRY','2026 SEASON'],
   title:'野沢温泉コンパスハウス主催バックカントリーツアー2026',
   titleEn:'Nozawa Onsen Compass House Backcountry Tour 2026',
   lead:'非日常の大冒険！おひとり様大歓迎のバックカントリーツアーへようこそ！',
   leadEn:'An extraordinary adventure — solo participants very welcome!',
   price:'5,000', priceNote:'〜18,900', cap:'おひとり様', capEn:'per person',
   note:'販売期間 2026.01.07〜2026.05.30', noteEn:'On sale 2026.01.07-2026.05.30',
   url:'https://fd-system.tours/plan/?plan=plan000778'},
  {id:'w2', img:'images/ski-group.jpg',
   tags:['日本語ガイド限定','バックカントリー','プライベート'], tagsEn:['JAPANESE ONLY','BACKCOUNTRY','PRIVATE'],
   title:'プライベートバックカントリーツアー【日本語ガイド／日本語対応のお客様限定】',
   titleEn:'Private Backcountry Tour [Japanese-speaking guests only]',
   lead:'非日常の大冒険！プライベートバックカントリーツアーへようこそ！',
   leadEn:'An extraordinary adventure — welcome to the private backcountry tour!',
   price:'100,000', priceNote:'', cap:'4名様まで', capEn:'up to 4 guests',
   note:'販売期間 2025.01.20〜2025.05.10', noteEn:'On sale 2025.01.20-2025.05.10',
   url:'https://fd-system.tours/plan/?plan=plan000783'},
  {id:'w3', img:IMG.heroWinter,
   tags:['BACKCOUNTRY','ENGLISH'], tagsEn:['BACKCOUNTRY','ENGLISH'],
   title:'Private Backcountry Tours（英語対応）',
   titleEn:'Private Backcountry Tour',
   lead:'Welcome to beautiful skiing NOZAWA',
   leadEn:'Welcome to beautiful skiing NOZAWA',
   price:'143,000', priceNote:'', cap:'4名様まで', capEn:'up to 4 guests',
   note:'販売期間 2025.01.27〜2025.05.10', noteEn:'On sale 2025.01.27-2025.05.10',
   url:'https://fd-system.tours/plan/?plan=plan000791'},
  {id:'w4', img:IMG.ski,
   tags:['スノーシュー','グループ'], tagsEn:['SNOWSHOE','GROUP'],
   title:'Snowshoeing Tours!',
   titleEn:'Snowshoeing Tours!',
   lead:'Welcome to Snowshoeing Tours!',
   leadEn:'Welcome to Snowshoeing Tours!',
   price:'66,000', priceNote:'〜88,000', cap:'1グループ', capEn:'per group',
   note:'販売期間 2025.02.19〜2025.04.30', noteEn:'On sale 2025.02.19-2025.04.30',
   url:'https://fd-system.tours/plan/?plan=plan000806'}
];

const TOURS = { green: TOURS_GREEN, winter: TOURS_WINTER };


/* ---------- RENTAL GEAR ---------- */
const GEAR = {
  green:[
    {cat:'E-BIKE MTB', name:'Specialized Levo SL',
     catch:'トレイルを遊び尽くす。未舗装路・トレイル対応',
     catchEn:'Play the trails to the fullest. For unpaved roads and trails.',
     d:'軽量フルサスペンションE-MTB。野沢の坂道もトレイルも快適に。',
     dEn:'Lightweight full-suspension E-MTB. Comfortable on Nozawa\'s hills and trails.',
     p:'8,800', unit:'半日 ／ 1日 ¥11,000', unitEn:'/ half day / 1 day ¥11,000',
     fit:true, img:'images/gear-levo.jpg'},
    {cat:'E-BIKE ROAD', name:'Specialized Creo SL',
     catch:'ロード×E-Bikeの新感覚。軽くて速いロングライド向け',
     catchEn:'Road meets E-Bike. Light and fast, for long rides.',
     d:'軽くて速いロングライド向け。坂道やロングライドも快適に楽しめます。',
     dEn:'Light and fast for long rides. Enjoy hills and long distances comfortably.',
     p:'7,040', unit:'半日 ／ 1日 ¥8,800', unitEn:'/ half day / 1 day ¥8,800',
     fit:true, img:'images/gear-creo.jpg'},
    {cat:'E-BIKE CROSS', name:'Specialized Vado SL',
     catch:'街も観光も快適に。街乗り・観光・移動に最適',
     catchEn:'Comfortable in town and sightseeing. Ideal for town riding and getting around.',
     d:'野沢温泉の坂道も楽々。街乗りから軽めのサイクリングまで楽しめます。（2時間 ¥3,300 もございます）',
     dEn:'Nozawa\'s slopes made easy. From town riding to light cycling. (2-hour rental ¥3,300 also available)',
     p:'5,280', unit:'半日 ／ 1日 ¥6,600', unitEn:'/ half day / 1 day ¥6,600',
     fit:true, img:'images/gear-vado.jpg'},
    {cat:'MTB', name:'Specialized FSR',
     d:'本格フルサスペンションMTB。野沢のトレイルやダウンヒルをしっかり楽しめます。',
     dEn:'Authentic full-suspension MTB. Fully enjoy Nozawa\'s trails and downhill.',
     p:'9,000', unit:'半日 ／ 1日 ¥11,000', unitEn:'/ half day / 1 day ¥11,000',
     fit:true, img:'images/gear-fsr.jpg'},
    {cat:'MTB', name:'Specialized HT',
     nameEn:'Specialized HT',
     d:'気軽に楽しめるスタンダードMTB（ハードテール）。街乗りから軽めのオフロードまで対応。',
     dEn:'Easy-going standard MTB (hardtail). From town riding to light off-road.',
     p:'5,600', unit:'半日 ／ 1日 ¥7,000', unitEn:'/ half day / 1 day ¥7,000',
     fit:true, img:'images/gear-ht.jpg'},
  {cat:'MTB KIDS', name:'Specialized Kids MTB',
     nameEn:'Specialized Kids MTB',
     d:'身長130cm〜対応。小さな車体でも太いタイヤで安定感があり、安心して楽しめるキッズマウンテンバイクです。',
     dEn:'For riders 130cm and up. A compact frame with wide tires for great stability — a kids mountain bike everyone can enjoy with confidence.',
     p:'3,600', unit:'半日 ／ 1日 ¥4,500', unitEn:'/ half day / 1 day ¥4,500',
     fit:true, img:'images/gear-kids.jpg'},
  {cat:'ROAD BIKE', name:'ロードバイク｜Specialized Aethos',
     nameEn:'Road Bike｜Specialized Aethos',
     d:'舗装路を軽快に走るロードバイク。千曲川サイクリングロードなどのロングライドに。',
     dEn:'A road bike for smooth riding on paved roads. Ideal for long rides such as the Chikuma River cycling road.',
     p:'13,200', unit:'半日 ／ 1日 ¥16,500', unitEn:'/ half day / 1 day ¥16,500',
     fit:true, img:'images/gear-road.jpg'},
    {cat:'RENTAL BASE', name:'BIKE 一覧・料金 PDF',
     nameEn:'BIKE List & Price PDF',
     d:'BIKEレンタルの全ラインナップと料金表はPDFにてご確認いただけます。',
     dEn:'The full BIKE rental lineup and price list are available as a PDF.',
     p:null, unit:'', unitEn:'',
     img:IMG.bikes, isPdf:true,
     pdf:'docs/bike_price_2025.pdf'}
  ],
  winter:[
    {cat:'STANDARD RENTAL', name:'Ski & Snowboard Set',
     d:'初めての方から中級者まで使いやすいスタンダードセット。スキー・スノーボードを気軽に楽しみたい方におすすめです。',
     dEn:'A standard set easy to use from first-timers to intermediates. Recommended for those who want to casually enjoy skiing or snowboarding.',
     p:'5,700', unit:'日〜（板＋ブーツ）', unitEn:'/ day~ (set + boots)',
     img:IMG.ski},
    {cat:'PREMIUM SKI', name:'ARMADA Ski Set',
     d:'ARMADAの高性能スキーで、野沢の雪をしっかり楽しめます。パウダーやフリーライドを楽しみたい方におすすめ。中・上級者向けの高性能モデルをご用意。',
     dEn:'Enjoy Nozawa\'s snow with ARMADA\'s high-performance skis. Recommended for powder and freeride. High-performance models for intermediate and advanced skiers.',
     p:'7,200', unit:'日〜（板＋ブーツ）', unitEn:'/ day~ (skis + boots)',
     img:'images/armada-madsteez.jpg'},
    {cat:'PREMIUM SNOWBOARD', name:'CAPiTA / KORUA',
     catch:'ARMADA / BURTON / CAPiTA / KORUA SHAPES',
     catchEn:'ARMADA / BURTON / CAPiTA / KORUA SHAPES',
     d:'ハイエンドブランドをラインナップ。通常は購入しなければ体験できない高性能モデルをレンタルでお試しいただけます。カービングやパウダーなど、より質の高い滑りを求める方に。',
     dEn:'High-end brand lineup. Try high-performance models normally only available for purchase. For those seeking higher-quality riding such as carving and powder.',
     p:'7,200', unit:'日〜（板＋ブーツ）', unitEn:'/ day~ (board + boots)',
     img:'images/armada-black.jpg'},
    {cat:'STANDARD SNOWBOARD', name:'Burton Set',
     d:'初めてスノーボードに挑戦する方や、気軽に楽しみたい方におすすめ。扱いやすく乗りやすいBurtonのボードを中心に、安心してゲレンデデビューをお楽しみいただけます。',
     dEn:'Recommended for first-time snowboarders. Centered on easy-to-handle Burton boards for a confident slope debut.',
     p:'5,700', unit:'日〜（板＋ブーツ）', unitEn:'/ day~ (board + boots)',
     img:'images/snowboard-powder.jpg'},
    {cat:'STANDARD SKI', name:'ARMADA Standard',
     d:'初めてスキーを楽しむ方や、久しぶりに雪山へ来た方に最適なセット。扱いやすく安定感のあるARMADAのスキーを採用し、安心してゲレンデを楽しめます。',
     dEn:'Ideal for first-time skiers or those returning to the mountains. Easy-to-handle, stable ARMADA skis for confident slope enjoyment.',
     p:'5,700', unit:'日〜（板＋ブーツ）', unitEn:'/ day~ (skis + boots)',
     img:'images/ski-group.jpg'},
    {cat:'STEP ON', name:'BURTON Step On',
     d:'着脱がワンステップで完了するBURTONのStep Onシステム。リフト降り場での手間を大幅に軽減します。',
     dEn:'BURTON\'s Step On system completes entry in one step, greatly reducing hassle at lift exits.',
     p:'8,700', unit:'日〜（ボード＋ブーツ）', unitEn:'/ day~ (board + boots)',
     imgFile:null, imgLabel:'BURTON Step On', img:null},
  {cat:'RENTAL BASE', name:'WINTER 料金表 PDF',
     nameEn:'WINTER Price List PDF',
     d:'スキー・スノーボードのレンタルラインナップと料金表はPDFにてご確認いただけます。',
     dEn:'Ski & snowboard rental lineup and price list available as PDF.',
     p:null, unit:'', unitEn:'',
     img:IMG.heroWinter, isPdf:true,
     pdf:'https://compasshouse.jp/assets/docs/winter_2024.pdf'}
  ]
};

/* ============================================================
   PRICE TABLES — 公式PDF準拠
   winter : https://compasshouse.jp/assets/docs/winter_2024.pdf
   bike   : https://compasshouse.jp/assets/docs/bike_list_price.pdf?240401
   E-BIKE : 要件シート「文言修正」タブ（PDF未掲載）
   ============================================================ */

/* --- WINTER : 日数階段制（1 / 1.5 / 2 / 3 / 4 / 5 / 6 / 7日） --- */
const W_DURS = [
  {i:0, n:'1 DAY', jp:'1日'},
  {i:1, n:'1.5',   jp:'1.5日'},
  {i:2, n:'2 DAYS',jp:'2日'},
  {i:3, n:'3 DAYS',jp:'3日'},
  {i:4, n:'4 DAYS',jp:'4日'},
  {i:5, n:'5 DAYS',jp:'5日'},
  {i:6, n:'6 DAYS',jp:'6日'},
  {i:7, n:'7 DAYS',jp:'7日'}
];

const W_GEAR = [
  {k:'pa_b', grp:'PREMIUM', n:'プレミアム 大人｜板/ボード＋ブーツ', nEn:'Premium Adult｜Skis or Board + Boots',
   s:'ARMADA / CAPiTA / KORUA 上位モデル', sEn:'ARMADA / CAPiTA / KORUA top models',
   p:[7200,13400,13900,17280,23040,28800,34560,35280]},
  {k:'pa',   grp:'PREMIUM', n:'プレミアム 大人｜板/ボードのみ', nEn:'Premium Adult｜Skis or Board only',
   s:'ブーツをお持ちの方', sEn:'For those with own boots',
   p:[6000,11000,11500,14400,19200,24000,28800,29400]},
  {k:'sa_b', grp:'STANDARD', n:'スタンダード 大人｜板/ボード＋ブーツ', nEn:'Standard Adult｜Skis or Board + Boots',
   s:'ARMADA / Burton 定番セット', sEn:'ARMADA / Burton standard set',
   p:[5700,10400,10900,13680,18240,22800,27360,27930]},
  {k:'sa',   grp:'STANDARD', n:'スタンダード 大人｜板/ボードのみ', nEn:'Standard Adult｜Skis or Board only',
   s:'ブーツをお持ちの方', sEn:'For those with own boots',
   p:[4500,8000,8500,10800,14400,18000,21600,22050]},
  {k:'sk_b', grp:'STANDARD', n:'スタンダード 子供｜板/ボード＋ブーツ', nEn:'Standard Kids｜Skis or Board + Boots',
   s:'キッズサイズ', sEn:'Kids sizes',
   p:[4000,7000,7500,9600,12800,16000,19200,19600]},
  {k:'sk',   grp:'STANDARD', n:'スタンダード 子供｜板/ボードのみ', nEn:'Standard Kids｜Skis or Board only',
   s:'キッズサイズ', sEn:'Kids sizes',
   p:[2500,4000,4500,6000,8000,10000,12000,12250]},
  {k:'so_b', grp:'STEP ON', n:'STEP ON 大人｜ボード＋ブーツ', nEn:'STEP ON Adult｜Board + Boots',
   s:'BURTON Step On システム', sEn:'BURTON Step On system',
   p:[8700,16400,16900,20880,27840,34800,41760,42630]},
  {k:'so',   grp:'STEP ON', n:'STEP ON 大人｜ボード＋ビンディング', nEn:'STEP ON Adult｜Board + Binding',
   s:'ブーツをお持ちの方', sEn:'For those with own boots',
   p:[7000,13000,13500,16800,22400,28000,33600,34300]},
  {k:'bc_pb',grp:'BACKCOUNTRY', n:'BC プレミアム｜板・ポール・シール＋ブーツ', nEn:'BC Premium｜Skis, Poles, Skins + Boots',
   s:'バックカントリー装備一式', sEn:'Full backcountry set',
   p:[20000,null,39500,48000,64000,80000,96000,98000]},
  {k:'bc_p', grp:'BACKCOUNTRY', n:'BC プレミアム｜板・シール / スプリットボード', nEn:'BC Premium｜Skis & Skins / Splitboard',
   s:'ブーツをお持ちの方', sEn:'For those with own boots',
   p:[15000,null,29500,36000,48000,60000,72000,73500]},
  {k:'bc_s', grp:'BACKCOUNTRY', n:'BC スタンダード｜板・ポール・シール', nEn:'BC Standard｜Skis, Poles, Skins',
   s:'標準セット', sEn:'Standard set',
   p:[9000,null,17500,21600,28800,36000,43200,44100]},
  {k:'snsh', grp:'BACKCOUNTRY', n:'スノーシュー＋ポール', nEn:'Snow Shoes + Poles',
   s:'スノーハイク向け', sEn:'For snow hiking',
   p:[4000,null,7500,9600,12800,16000,19200,19600]}
];

const W_ADDONS = [
  {k:'ajp',  n:'ウェア 大人｜上下', nEn:'Wear Adult｜Jacket & Pants', p:[3500,null,6500,8400,11200,14000,16800,17150]},
  {k:'kjp',  n:'ウェア 子供｜上下', nEn:'Wear Kids｜Jacket & Pants',  p:[3000,null,5500,7200,9600,12000,14400,14700]},
  {k:'ajop', n:'ウェア 大人｜上または下', nEn:'Wear Adult｜Jacket or Pants', p:[3000,null,5500,7200,9600,12000,14400,14700]},
  {k:'kjop', n:'ウェア 子供｜上または下', nEn:'Wear Kids｜Jacket or Pants',  p:[2500,null,4500,6000,8000,10000,12000,12250]},
  {k:'helm', n:'ヘルメット', nEn:'Helmet',                    p:[1500,null,2500,3600,4800,6000,7200,7350]},
  {k:'boot', n:'ブーツ単品（スキー / スノーボード）', nEn:'Boots only (Ski / Snowboard)', p:[2500,null,4500,6000,8000,10000,12000,12250]},
  {k:'bind', n:'ビンディング単品', nEn:'Bindings only',        p:[3000,null,5500,7200,9600,12000,14400,14700]}
];

/* --- GREEN : 半日 / 1日 --- */
const G_DURS = [
  {k:'half', n:'HALF', jp:'半日'},
  {k:'day',  n:'1 DAY', jp:'1日'}
];

const G_GEAR = [
  {k:'ebike_levo', grp:'E-BIKE', n:'E-BIKE MTB｜Specialized Levo SL', nEn:'E-BIKE MTB｜Specialized Levo SL',
   s:'軽量フルサスE-MTB', sEn:'Light full-sus E-MTB', src:'pdf',
   p:{half:8800, day:11000}},
  {k:'ebike_creo', grp:'E-BIKE', n:'E-BIKE ROAD｜Specialized Creo SL', nEn:'E-BIKE ROAD｜Specialized Creo SL',
   s:'軽くて速いEロードバイク', sEn:'Light, fast E-road bike', src:'pdf',
   p:{half:7040, day:8800}},
  {k:'ebike_vado', grp:'E-BIKE', n:'E-BIKE CROSS｜Specialized Vado SL', nEn:'E-BIKE CROSS｜Specialized Vado SL',
   s:'街乗り・観光向け／2時間 ¥3,300 も有', sEn:'For town riding & sightseeing / 2-hour rental ¥3,300 available', src:'pdf',
   p:{half:5280, day:6600}},
  {k:'fsr', grp:'MTB', n:'MTB｜Specialized FSR', nEn:'MTB｜Specialized FSR',
   s:'フルサスペンションMTB', sEn:'Full-suspension MTB', src:'sheet',
   p:{half:9000, day:11000}},
  {k:'ht', grp:'MTB', n:'MTB｜Specialized HT（ハードテール）', nEn:'MTB｜Specialized HT (Hardtail)',
   s:'扱いやすいスタンダードMTB', sEn:'Easy-going standard MTB', src:'sheet',
   p:{half:5600, day:7000}},
  {k:'kids', grp:'MTB', n:'MTB｜Specialized Kids（キッズバイク）', nEn:'MTB｜Specialized Kids',
   s:'お子様向けキッズバイク', sEn:'Kids bike for younger riders', src:'sheet',
   p:{half:3600, day:4500}},
  {k:'road', grp:'ROAD BIKE', n:'ロードバイク｜Specialized Aethos', nEn:'Road Bike｜Specialized Aethos',
   s:'舗装路を軽快に走るロードバイク', sEn:'Road bike for smooth riding on paved roads', src:'pdf',
   p:{half:13200, day:16500}}
];

/* ---------- ROUTES ---------- */
const ROUTES = [
  {n:'ROUTE 01', t:'準備中', tEn:'Coming soon', m:[], mEn:[], tbd:true,
   d:'おすすめルートの情報をご提供いただき次第、この枠に掲載します。',
   dEn:'Route details will be published here once provided.'},
  {n:'ROUTE 02', t:'準備中', tEn:'Coming soon', m:[], mEn:[], tbd:true,
   d:'おすすめルートの情報をご提供いただき次第、この枠に掲載します。',
   dEn:'Route details will be published here once provided.'},
  {n:'ROUTE 03', t:'準備中', tEn:'Coming soon', m:[], mEn:[], tbd:true,
   d:'おすすめルートの情報をご提供いただき次第、この枠に掲載します。',
   dEn:'Route details will be published here once provided.'}
];

/* ---------- SHOP ---------- */
const SHOPS = [
  {
    tag:'BRAND 01', name:'COMPASS ONLINE STORE', img:'images/store-front.jpg',
    d:'スキー・スノーボード・自転車を中心に、プロショップが厳選したギアやアパレルを販売するオンラインショップです。野沢温泉から、アウトドアライフをより豊かにするアイテムをお届けします。',
    dEn:'An online shop selling gear and apparel carefully selected by a pro shop, centered on skis, snowboards and bicycles. From Nozawa Onsen, we deliver items that enrich your outdoor life.',
    url:'https://compass-onlinestore.com/'
  },
  {
    tag:'BRAND 02', name:'ARMADA ONLINE', img:'images/armada-madsteez.jpg',
    d:'ARMADAのスキー、アパレル、アクセサリーを販売するオンラインショップです。ライダー目線で開発された機能性とデザイン性を兼ね備えたアイテムを取り揃えています。初心者から上級者まで、それぞれのスタイルに合ったギア選びをサポートします。',
    dEn:'An online shop selling ARMADA skis, apparel and accessories. We stock items combining functionality and design developed from a rider\'s perspective, supporting gear selection for every style from beginner to advanced.',
    url:'https://armadaonline.stores.jp/'
  }
];

const SHOP_CATS = [
  {n:'CATEGORY', t:'取扱カテゴリ', tEn:'Product Categories',
   items:['E-BIKE','アパレル','スキー・スノーボード','カフェ'],
   itemsEn:['E-BIKE','Apparel','Ski & Snowboard','Cafe']},
  {n:'BRAND', t:'取扱ブランド', tEn:'Brands',
   items:["ARC'TERYX",'ARMADA','OAKLEY','HESTRA','COAL','Specialized','ROXY'],
   itemsEn:["ARC'TERYX",'ARMADA','OAKLEY','HESTRA','COAL','Specialized','ROXY']}
];

/* ---------- 実店舗（SHOP_Akiタブ：エントランス写真追加希望） ---------- */
const REAL_STORES = [
  {name:'COMPASS HOUSE', jp:'コンパスハウス',
   addr:'長野県下高井郡野沢温泉村豊郷6463-15',
   addrEn:'6463-15 Toyosato, Nozawa Onsen, Shimotakai, Nagano',
   hours:'13:00〜18:00（夏季：火・水 定休／冬季：無休）',
   hoursEn:'13:00-18:00 (Summer: closed Tue & Wed / Winter: open daily)',
   imgFile:null, imgLabel:'COMPASS HOUSE エントランス写真', img:null},
  {name:'COMPASS VILLAGE', jp:'コンパス ビレッジ',
   addr:'長野県下高井郡野沢温泉村豊郷9526',
   addrEn:'9526 Toyosato, Nozawa Onsen, Shimotakai, Nagano',
   hours:'9:30〜17:30（火 定休／冬季：10:00〜20:00 無休）',
   hoursEn:'9:30-17:30 (Closed Tue / Winter: 10:00-20:00, open daily)',
   imgFile:null, imgLabel:'COMPASS VILLAGE エントランス写真', img:null}
];

/* ---------- EVENTS ---------- */
const EVENTS = [
  {date:'COMING SOON', t:'イベント枠 01', tEn:'Event Slot 01',
   m:['準備中','—'], mEn:['Preparing','—'], img:IMG.heroSummer},
  {date:'COMING SOON', t:'イベント枠 02', tEn:'Event Slot 02',
   m:['準備中','—'], mEn:['Preparing','—'], img:IMG.heroWinter},
  {date:'COMING SOON', t:'イベント枠 03', tEn:'Event Slot 03',
   m:['準備中','—'], mEn:['Preparing','—'], img:IMG.guide}
];

/* ---------- OFFICES / ACCESS ---------- */
const OFFICES = [
  {
    name:'COMPASS HOUSE', jp:'コンパスハウス',
    zip:'〒389-2502', addr:'長野県下高井郡野沢温泉村豊郷6463-15',
    addrEn:'6463-15 Toyosato, Nozawa Onsen, Shimotakai, Nagano',
    tel:'0269-67-0224',
    biz:'本社機能／スキー・バイク販売、修理、カスタムチューン（RETÜL バイクフィット／スキーブーツフィッティング）',
    bizEn:'Head office / Ski & bike sales, repair, custom tuning (RETÜL bike fit / ski boot fitting)',
    hours:'13:00〜18:00',
    hoursNote:'夏季：火・水 定休／冬季：無休',
    hoursNoteEn:'Summer: closed Tue & Wed / Winter: open daily',
    park:'あり', parkEn:'Available',
    map:'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12759.621177062329!2d138.4402871!3d36.9165287!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x1899d88ef65bdf79!2zQ29tcGFzcyBIb3VzZSDjg4njg6rjg7zjg6Djgrfjg4Pjg5c!5e0!3m2!1sja!2sjp!4v1531564771173',
    mapLink:'https://maps.app.goo.gl/ogYNkVVbM7JaBv1j8'
  },
  {
    name:'COMPASS VILLAGE', jp:'コンパス ビレッジ',
    zip:'〒389-2502', addr:'長野県下高井郡野沢温泉村豊郷9526',
    addrEn:'9526 Toyosato, Nozawa Onsen, Shimotakai, Nagano',
    tel:'0269-67-0921',
    biz:'夏季：バイクレンタル／ツアーガイドデスク／スポーツ用品販売　冬季：スキー・スノーボードアイテム販売／レンタル／ガイドデスク',
    bizEn:'Summer: bike rental / tour guide desk / sports goods. Winter: ski & snowboard sales / rental / guide desk',
    hours:'9:30〜17:30',
    hoursNote:'火 定休／冬季：10:00〜20:00 無休',
    hoursNoteEn:'Closed Tue / Winter: 10:00-20:00, open daily',
    park:'なし ※近隣の村営駐車場をご利用ください',
    parkEn:'None — please use nearby village parking',
    map:'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12758.589859917582!2d138.4472028!3d36.9226925!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x5fcadafa320805af!2zQ09NUEFTUyB2aWxsYWdlIOOCs-ODs-ODkeOCuSDjg5Pjg6zjg4Pjgrg!5e0!3m2!1sja!2sjp!4v1594798454889!5m2!1sja!2sjp',
    mapLink:'https://maps.app.goo.gl/4T8VbQTYJSP2pDSVA'
  },
  {
    name:'COMPASS RENTAL BASE', jp:'コンパス レンタルベース',
    zip:'〒389-2502', addr:'長野県下高井郡野沢温泉村豊郷7809',
    addrEn:'7809 Toyosato, Nozawa Onsen, Shimotakai, Nagano',
    tel:'0269-67-0644',
    biz:'冬季：スキー・スノーボードレンタル／カフェ',
    bizEn:'Winter: ski & snowboard rental / cafe',
    hours:'8:00〜17:00',
    hoursNote:'休み：野沢温泉スキー場ゴンドラ営業期間に準ずる',
    hoursNoteEn:'Closures follow the Nozawa Onsen ski resort gondola operating period',
    park:'なし ※村営駐車場またはスキー場駐車場をご利用ください',
    parkEn:'None — please use village or ski resort parking',
    map:'https://maps.google.com/maps?q=36.9201479,138.4515299&t=&z=17&ie=UTF8&iwloc=&output=embed',
    mapLink:'https://maps.app.goo.gl/5F7ysVcs2H6Y6J8y6'
  }
];

/* ---------- CONTACT TYPES（要件：6種） ---------- */
const CT_TYPES = [
  {k:'tour',    n:'ツアーに関するお問い合わせ',       nEn:'Inquiry about tours',
   hint:'ご希望のツアー名、参加予定日、人数、参加者のレベルをご記入ください。',
   hintEn:'Please include the desired tour name, planned date, number of participants and their level.'},
  {k:'custom',  n:'カスタムツアーに関するお問い合わせ', nEn:'Inquiry about custom tours',
   hint:'ご希望内容（例：スタジオレンタル・宿泊／自転車ツアーパッケージ／学校・団体向けカスタムパッケージ／企業様向け福利厚生パッケージ）、想定人数、ご希望時期をご記入ください。',
   hintEn:'Please include your request (e.g. studio rental & lodging / cycle tour package / school or group custom package / corporate welfare package), expected group size and preferred dates.'},
  {k:'tieup',   n:'企業タイアップのお問い合わせ',     nEn:'Corporate tie-up inquiry',
   hint:'貴社名、ご担当者名、ご相談内容の概要をご記入ください。DMO・自治体の皆様もこちらからご連絡ください。',
   hintEn:'Please include your company name, contact person and an outline of your request. DMOs and local governments are also welcome here.'},
  {k:'company', n:'会社についてのお問い合わせ',       nEn:'Inquiry about the company',
   hint:'お問い合わせ内容をご記入ください。',
   hintEn:'Please describe your inquiry.'},
  {k:'recruit', n:'リクルートについてのお問い合わせ',  nEn:'Recruitment inquiry',
   hint:'ご希望の職種（ショップスタッフ／アクティビティガイド／インターンシップ）、ご経験、ご希望勤務時期をご記入ください。',
   hintEn:'Please include the desired position (shop staff / activity guide / internship), your experience and preferred start date.'},
  {k:'other',   n:'その他',                          nEn:'Other',
   hint:'お問い合わせ内容をご記入ください。',
   hintEn:'Please describe your inquiry.'}
];

/* ---------- TERMS TEXT ---------- */
const TERMS_JA = `
<div class="tbd">
<b>利用規約は現在ご提供待ちです</b>
<p>正式な規約文言をご提供いただき次第、この枠に全文を掲載します。<br>
（要件シート「法的表記／利用規約」欄：フォームに載せる・規約はもらえる）</p>
</div>
<h4>キャンセルポリシー</h4>
<ul>
<li>7〜4日前：ご利用料金の30%</li>
<li>3〜2日前：ご利用料金の50%</li>
<li>前日・当日：ご利用料金の100%</li>
</ul>
`;

const TERMS_EN = `
<div class="tbd">
<b>Terms of Use — pending provision</b>
<p>The full text will be published here once the official wording is provided.</p>
</div>
<h4>Cancellation Policy</h4>
<ul>
<li>7-4 days prior: 30% of the fee</li>
<li>3-2 days prior: 50% of the fee</li>
<li>Day before / same day: 100% of the fee</li>
</ul>
`;

const POLICY_JA = `
<h3>1. 基本的な考え方</h3>
<p>株式会社ドリームシップ（以下、「当社」）は、事業を推進、運営していく上で、個人情報が個人の重要な財産であることを認識し、個人情報を適切に取得・利用・提供しております。個人情報に関する法令等を遵守し、個人情報の漏えい等を防止・是正するため、以下の方針を定め、全従業者に周知徹底を図り、個人情報の保護に努めます。また、適正な個人情報保護を実現するため、この方針を継続的に維持・改善してまいります。</p>
<h3>2. 利用目的</h3>
<p>お客さまの個人情報はイベントエントリー、ID登録、資料請求、メールマガジン配信申込や当社へのお問い合わせなどを当社が受ける場合など、本ウェブサイトにおけるサービス提供に必要な場合にのみご提供をお願いしております。お客さまにご提供いただいた個人情報は、利用目的の範囲内で、当社の業務を適切かつ円滑に遂行するために利用いたします。</p>
<h3>3. 利用及び提供の制限</h3>
<p>当社は個人情報を厳正に管理し、その利用・提供に当たっては、法令に基づく場合を除き、提供者が同意を与えた範囲内で利用し、利用目的を超えて個人情報の取り扱いを行う場合には、あらかじめ本人の同意を得るものとします。</p>
<h3>4. 安全確保の措置</h3>
<p>当社は、ご提供いただきましたお客さまの個人情報を安全に管理するよう努めており、個人情報の漏えい、滅失、き損などを防止するため必要かつ適切な安全管理措置を実施いたします。個人情報をご提供いただきます際には、第三者による不正なアクセスに備え、SSL（Secure Sockets Layer）による暗号化またはこれに準ずるセキュリティ技術を施し、安全性の確保に努めます。また、当社は個人情報を適正に保護するため取り扱いについては従業員等を対象に社内教育を実施いたします。</p>
<h3>5. 適用範囲</h3>
<p>本プライバシーポリシーは、当社が管理・運営する、「http://www.compasshouse.jp」から始まるURL（アドレス）を有するウェブサイト（以下当サイト）を通じて提供いただく、お客さまの個人情報（氏名・住所・生年月日・性別・電話番号・メールアドレスなど）に適用されます。</p>
<h3>6. お問い合わせについて（プライバシーポリシー）</h3>
<p>当社は、個人情報に関するお問い合わせ、苦情の適切な対応に努めます。お問い合わせ前に必ず「個人情報保護方針」の内容をご確認の上、同意をいたただける方のみ、メールでのお問い合わせを行ってください。電話でのお問い合わせは受け付けておりません。</p>
<p style="margin-top:24px;font-size:11.5px;color:#8a807b">出典：既存サイト compasshouse.jp/policy/ の掲載内容</p>
`;

const POLICY_EN = `
<div class="tbd"><b>English version — pending translation</b>
<p>The Japanese Privacy Policy is quoted from the existing site (compasshouse.jp/policy/). An English translation will be added once the wording is confirmed.</p></div>
`;

const TOKUSHO = [
  ['販売業者','株式会社ドリームシップ','Seller','Dream Ship CO., Ltd.'],
  ['運営統括責任者','河口　尭矢','Managing Officer','Takaya Kawaguchi'],
  ['所在地','〒389-2502　長野県下高井郡野沢温泉村豊郷6463-15','Address','6463-15 Toyosato, Nozawa Onsen, Shimotakai, Nagano 389-2502, Japan'],
  ['電話番号','0269-67-0224','Phone','+81-269-67-0224'],
  ['メールアドレス','info@compasshouse.jp','E-mail','info@compasshouse.jp'],
  ['キャンセルについて（サービス）','7〜4日前：30%　3〜2日前：50%　前日・当日：100%','Cancellation (Services)','7-4 days prior: 30%. 3-2 days prior: 50%. Day before / same day: 100%.'],
  ['販売価格','<span class="tbd-inline">要確認</span>','Price','<span class="tbd-inline">TBC</span>'],
  ['商品代金以外の必要料金','<span class="tbd-inline">要確認</span>','Additional Fees','<span class="tbd-inline">TBC</span>'],
  ['支払方法','<span class="tbd-inline">要確認</span>','Payment Methods','<span class="tbd-inline">TBC</span>'],
  ['支払時期','<span class="tbd-inline">要確認</span>','Payment Timing','<span class="tbd-inline">TBC</span>'],
  ['商品の引渡時期','<span class="tbd-inline">要確認</span>','Delivery','<span class="tbd-inline">TBC</span>'],
  ['返品・交換について','<span class="tbd-inline">要確認</span>','Returns & Exchanges','<span class="tbd-inline">TBC</span>'],
  ['適格請求書発行事業者登録番号','<span class="tbd-inline">要確認</span>','Qualified Invoice Number','<span class="tbd-inline">TBC</span>']
];

/* ---------- i18n ---------- */
const I18N = {
  ja:{
    'gd.g.item.h':'持ち物・服装','gd.g.note.h':'当日の注意事項',
    'gd.g.i1':'動きやすい服装','gd.g.i2':'スニーカーなど運動に適した靴','gd.g.i3':'飲み物',
    'gd.g.i4':'タオル','gd.g.i5':'季節に応じた防寒着・雨具・日焼け対策',
    'gd.g.icaution':'※ サンダルやヒールなど、安全に走行できない履物でのご参加はできません。',
    'gd.g.n1':'開始15分前までにお越しください。',
    'gd.g.n2':'安全のため、必ずスタッフ・ガイドの指示に従ってください。',
    'gd.g.n3':'飲酒されている方はご参加いただけません。',
    'gd.g.n4':'天候やコース状況により、内容の変更または中止となる場合があります。',
    'gd.g.n5':'レンタル用品は大切にご使用ください。',
    'gd.g.n6':'交通ルールを守り、安全運転にご協力をお願いいたします。',
    'gd.w.item.h':'持ち物・服装','gd.w.note.h':'当日の注意事項',
    'gd.w.i1':'防水・防寒性のあるスキーウェア','gd.w.i2':'グローブ','gd.w.i3':'ゴーグル',
    'gd.w.i4':'ヘルメット（レンタル可）','gd.w.i5':'暖かいインナー・厚手の靴下','gd.w.i6':'飲み物',
    'gd.w.icaution':'※ レンタルをご利用の方は、ウェア・アクセサリー類もレンタル可能です。（一部有料）',
    'gd.w.n1':'開始15分前までにお越しください。',
    'gd.w.n2':'レンタル受付時に身分証明書をご提示いただく場合があります。',
    'gd.w.n3':'安全のため、スタッフの指示に従ってご利用ください。',
    'gd.w.n4':'飲酒後の滑走はできません。',
    'gd.w.n5':'天候やリフト運行状況により、内容の変更または中止となる場合があります。',
    'gd.w.n6':'レンタル用品は大切にご使用ください。',
    'gd.w.n7':'スキー場のルール・マナーを守り、安全にお楽しみください。',
    'qk.h':'かんたん予約','qk.s':'2ステップで予約ページへ','qk.season':'シーズン','qk.service':'サービス',
    'qk.green':'グリーン','qk.winter':'ウィンター','qk.tour':'ツアー','qk.rental':'レンタル','qk.go':'進む',
    'tp.src':'※ ウィンターツアーは fd-system.tours 掲載のプランより',
    'nav.season':'シーズン特集','nav.guide':'初回利用ガイド',
    'lc.season.t':'シーズン特集','lc.season.d':'グリーンシーズンとウィンターシーズン、それぞれの遊び方',
    'lc.guide.t':'初回利用ガイド','lc.guide.d':'はじめての方へ。ご予約から当日までの流れ',
    'ph.season':'シーズン特集','ph.guide':'初回利用ガイド',
    'ss.green':'グリーンシーズン','ss.winter':'ウィンターシーズン',
    'ss.cta.r':'レンタルを見る','ss.cta.t':'ツアーを見る',
    'ss.src':'※ 本文は既存サイト（compasshouse.jp/summer・/winter）の掲載内容より',
    'ss.g.h':'野沢のグリーンシーズンを自由に遊び尽くす',
    'ss.g.p1':'夏の野沢温泉の魅力はまだまだ人々が知り尽くしてしない程、奥深く魅力的なポテンシャルを秘めています。野沢温泉へのスキー来伝から約100年。冬の野沢温泉の魅力は今や世界に配信され、世界中の人々を魅了しています。',
    'ss.g.p2':'夏の魅力はまだまだ開拓段階ではありますが、実際にこの地で遊ぶ我々が皆様にグリーンシーズンの遊びを提案します。地形に富んだスキー場エリアや春から秋にかけて刻一刻と変化し様々な表情を見せる森林の中でのMTBやロードバイクでのライド。そして、アフターライドの体を癒すコンパクトにまとまった温泉街。「スポーツ」「食」「温泉」野沢温泉ならではの夏の文化を楽しみにお越しください。',
    'ss.g.r1h':'COMPASS VILLAGE｜E-BIKE レンタル',
    'ss.g.r1p':'最新のE-BIKE（電動アシスト自転車）をレンタル可能。E-BIKE Tourも随時開催中。合宿等の団体利用にも対応いたしますのでお気軽にご相談ください。',
    'ss.g.r1m':'営業時間 9:00〜18:00 ／ 営業期間 4月〜11月',
    'ss.g.r2h':'COMPASS RENTAL BASE｜マウンテンバイク レンタル',
    'ss.g.r2p':'ダウンヒルに特化したMTBをレンタル可能。MTB初めての方向けにコースガイドも随時開催中。合宿等の団体利用にも対応いたします。',
    'ss.g.r2m':'営業時間 9:00〜17:00 ／ 営業期間 7月〜10月（夏季野沢温泉スキー場営業期間中）',
    'ss.g.t1h':'MOUNTAIN BIKE TOUR',
    'ss.g.t1p':'COMPASS HOUSEの遊びのフィールドは、野沢温泉スキー場を飛び出し、周辺の大自然の中へ。ファミリーで参加できる手軽なMTBツアーから中級者向けのアドベンチャーツアーまで。ライディングスタイル、レベルに合わせてご参加ください。',
    'ss.w.h':'スキーをもっと楽しく… もっと自由に…',
    'ss.w.p1':'私たちは2010年、「スキーをもっと楽しく…もっと自由に…」を合い言葉に、フリースキーの魅力をたくさんの人に伝えていく事を目的とした活動「Compass Project」をスタートしました。そのProjectの情報発信基地として長野県の野沢温泉村に拠点を構えることとなりました。',
    'ss.w.p2':'Projectの中でスキーの用具の普及や雪上での遊びの提案を行うためにCOMPASS HOUSEをOPENさせました。ここはスキーショップというだけではなく、雪山に関わる「ヒト」「モノ」「コト」が集まる場所になることを目的に運営しています。',
    'ss.w.r1h':'SKI & SNOWBOARD RENTAL',
    'ss.w.r1p':'長坂エリアにて営業しているレンタルステーションの「Compass Rental Base」。スキー場に隣接した場所にて営業しているので、最新のフリーライドスキーが手軽にレンタルできます。また、各ブランドの最新機種のテストセンターとしての営業も行っています。',
    'ss.w.r1m':'長野県下高井郡野沢温泉村豊郷7809 ／ 営業時間 8:00〜17:00 ／ レンタルに関するご予約・お問い合わせ 070-1403-0303',
    'ss.w.t1h':'COMPASS HOUSE WINTER TOUR',
    'ss.w.t1p':'野沢の大自然を滑るバックカントリーや、初心者から上級者までレベルや年齢に関係なく多くの人に参加していただけるイベント・ツアーを開催しています。ヘトヘトになるまで遊んで、心から「楽しかった！」と終える1日を、COMPASS HOUSEでぜひ体験してください。',
    'ss.w.tbd':'冬季ツアーの個別プラン（プラン名・料金・所要時間）をご提供いただき次第、この枠に掲載します。',
    'gd.flow.h':'ご利用の流れ','gd.before.h':'ご利用前のご確認','ac.h.car':'BY CAR ／ お車','ac.h.train':'BY TRAIN ／ 電車',
    'gd.flow.sub':'ご予約から当日まで',
    'gd.s1t':'サービスを選ぶ','gd.s1d':'ツアー・レンタルの各ページから、ご希望のプランまたは機材をお選びください。レンタルは料金シミュレーターで概算料金をご確認いただけます。',
    'gd.s2t':'利用規約に同意する','gd.s2d':'「予約へ進む」を押すと利用規約が表示されます。内容をご確認・ご同意のうえ、次へお進みください。',
    'gd.s3t':'予約システムで申し込む','gd.s3d':'ツアーは外部予約システム（STORES予約）へ、レンタルは各申込フォームへ移動します。日程・人数・機材をご入力ください。',
    'gd.s4t':'予約確定・当日ご来店','gd.s4d':'お申し込み後、確認のご連絡をいたします。当日は各拠点にお越しください。',
    'gd.form.mtb':'ペダルバイク','gd.form.ski':'スキー・スノーボード',
    'gd.tbd.t':'持ち物・服装／当日の注意事項','gd.tbd.d':'ご案内内容をご提供いただき次第、この枠に掲載します。',
    'gd.cta':'ご不明な点はお問い合わせへ',
    'vd.note':'サービス別の動画は制作中のため、共通動画を掲載しています。',
    'cta.contact':'お問い合わせ',
    'ct.exlbl':'EXAMPLES / お問い合わせ例','rt.custom.t':'カスタムツアーのご相談','rt.custom.s':'団体・法人・教育機関向けのオリジナルプランを承ります',
    'nav.home':'ホーム','nav.tour':'ツアー','nav.rental':'レンタル','nav.shop':'ショップ',
    'nav.event':'イベント','nav.gallery':'ギャラリー','nav.access':'アクセス',
    'nav.company':'会社概要','nav.contact':'お問い合わせ',
    'hero.h':'人生に生き甲斐の方位磁針<br><b>ようこそコンパスハウスへ</b>',
    'hero.sub':'スキー・スノーボード・自転車。<br>野沢温泉のフィールドを知り尽くした私たちが、遊びのすべてを提案します。',
    'hero.cta1':'ツアーはこちら','hero.cta2':'レンタルはこちら',
    'con.h':'大自然の片隅が<br><span>あなたの遊び場に</span>',
    'con.p1':'自宅でも職場でもない、あなたらしくいられる居場所。COMPASS HOUSEは長野県野沢温泉村に拠点を構える、SKI &amp; BIKE の遊びを発信するショップです。',
    'con.p2':'日常の中にスポーツをプラスすることで、皆様のライフワークがより豊かになることを目指し、サポートし続けます。地域の文化とフィールドを活かしながら、野沢温泉の更なる発展を考え、私たちも共に成長していけるチームでありたいと想います。',
    'svc.sub':'サービス案内',
    'svc.lead':'野沢の極上コンディション。相応しい本物の遊び道具と、心躍る体験がここに。',
    'svc.tour':'野沢を知る私たちから、心躍るお裾分け。MTB・E-BIKE・BCツアー',
    'svc.rental':'E-BIKE / MTB / スキー / スノーボード。料金シミュレーター搭載',
    'svc.shop':'COMPASS ONLINE STORE / ARMADA ONLINE',
    'svc.event':'自社イベント・タイアップ企画・地域連携',
    'svc.gallery':'Instagram 連携ギャラリー',
    'svc.company':'会社概要 / DMO / 求人 / 事業所',
    'svc.more':'詳しく見る',
    'tour.sub':'ガイドツアー',
    'tour.lead':'あなたの貴重な１日こそ、委ねるべきガイドがここに。<br>知らない自分に出会わせてくれる、それがスポーツの力。',
    'link.alltour':'ツアー一覧へ','link.allrental':'レンタル一覧・料金計算へ','link.shop':'ショップページへ',
    'link.event':'イベント一覧へ','link.access':'施設情報の詳細へ',
    'rt.sub':'レンタル','sh.sub':'オンラインショップ','ev.sub':'イベント情報','gl.sub':'ギャラリー',
    'gl.detail':'詳細はこちら',
    'ev.ext.t':'野沢温泉観光協会 イベントカレンダー','ev.ext.s':'温泉街・地域全体の最新イベント情報',
    'ev.ext.cta':'公式サイトを見る',
    'vd.sub':'動画コンテンツ',
    'vd.p':'公式YouTubeチャンネル「コンパスTV 野沢温泉チャンネル」より。<br>※ ご指定の動画（youtu.be/xqmio9N8OYs）は現在非公開のため、公開動画を仮設置しています。',
    'vd.cta':'YouTubeチャンネル',
    'ac.sub':'アクセス・施設情報','cp.sub':'会社概要・DMO・求人・事業所','cp.cta':'会社情報を見る',
    'ph.tour':'ツアー','ph.rental':'レンタル','ph.shop':'オンラインショップ','ph.event':'イベント',
    'ph.gallery':'ギャラリー','ph.access':'アクセス・施設情報','ph.company':'会社情報',
    'ph.contact':'お問い合わせ','ph.policy':'プライバシーポリシー','ph.tokusho':'特定商取引法に基づく表記',
    'tp.h':'あなたの貴重な１日こそ<br>委ねるべきガイドがここに',
    'tp.p':'知らない自分に出会わせてくれる、それがスポーツの力。野沢温泉のフィールドを知り尽くしたガイドが、レベルとコンディションに合わせて最適なルートをご案内します。',
    'ct.sub':'カスタムツアー',
    'ct.p':'団体・法人・教育機関向けに、目的に合わせたオリジナルツアーを組み立てます。宿泊やランチの手配を含むパッケージもご相談ください。',
    'ct.cta':'カスタムツアーはこちら',
    'ct.e1':'スタジオレンタル・宿泊','ct.e2':'自転車ツアーパッケージ',
    'ct.e3':'学校 / 団体向けカスタムパッケージツアー','ct.e4':'企業様向け（福利厚生）パッケージツアー',
    'tn.sub':'ご予約前のご確認',
    'tn.1t':'予約方法','tn.1d':'各ツアーの「予約へ進む」より、利用規約をご確認・ご同意のうえ外部予約システムへ進みます。',
    'tn.2t':'持ち物・服装','tn.2d':'持ち物・服装に関するご案内は準備中です。',
    'tn.3t':'キャンセルポリシー','tn.3d':'7〜4日前：30%／3〜2日前：50%／前日・当日：100%',
    'rp.h':'野沢の極上コンディション<br>相応しい本物の遊び道具がここに',
    'rp.p':'Specialized の E-BIKE・MTB、ARMADA のスキー、Burton / CAPiTA / KORUA のスノーボード。プロショップが実際に使い込んだ道具を、そのままレンタルでご提供します。',
    'rs.green':'グリーンシーズン / 自転車','rs.winter':'ウインターシーズン / スキー・スノーボード',
    'sim.sub':'料金シミュレーター','sim.lead':'機材・期間・人数・オプションを選ぶと、概算料金が自動で表示されます。',
    'sim.l1':'機材を選択','sim.l2':'利用期間','sim.l3':'台数 / 人数','sim.l4':'オプション（任意）',
    'sim.note':'※ 表示は税込の概算です。実際の料金は機材・在庫状況により変動する場合があります。正式料金はPDF料金表または店頭にてご確認ください。',
    'sim.book':'レンタルを予約する','sim.ask':'団体・長期利用のご相談',
    'ro.sub':'おすすめルート','ro.link':'ルートのご相談','rm.sub':'貸出拠点マップ',
    'rtm.sub':'レンタルご利用条件',
    'rtm.1t':'ご利用条件','rtm.1d':'自転車：身長140cm以上の方<br>スキー・スノーボード：特に制限はございません',
    'rtm.2t':'キャンセルポリシー','rtm.2d':'7〜4日前：30%<br>3〜2日前：50%<br>前日・当日：100%',
    'sp.p':'野沢温泉から、アウトドアライフをより豊かにするアイテムをお届けします。スキー・スノーボード・自転車を中心に、プロショップが厳選したギアやアパレルを販売しています。',
    'sp.cat':'取扱カテゴリ・ブランド',
    'sp.store':'実店舗',
    'sp.store.link':'アクセス・営業時間の詳細',
    'ep.sub':'自社イベント・タイアップ','ep.lead':'※ 掲載内容は準備中です。運用開始後、随時更新いたします。',
    'ep.local':'野沢温泉村のイベント情報',
    'gp.sub':'インスタグラム連携',
    'ac.car':'上信越自動車道・豊田飯山ICより約25分。',
    'ac.train':'飯山駅より野沢温泉ライナーまたは路線バスで約25分。野沢温泉バス停から徒歩圏内です。',
    'tab.profile':'会社概要','tab.dmo':'地域連携','tab.recruit':'求人','tab.office':'事業所',
    'cm.msg.h':'代表メッセージ',
    'cm.msg.p1':'「日常の中にスポーツをプラスすることで、皆様のライフワークがより豊かになることを目指し、サポートし続けます」',
    'cm.msg.p2':'弊社は長野県野沢温泉村に拠点を構えるドリームシップと言うチーム（株式会社）です。地域の文化、フィールドを活かしながら野沢温泉の更なる発展を考え、私たちも共に成長していけるチームでありたいと想います。',
    'cm.msg.p3':'代表　河口　尭矢',
    'cm.ov.h':'会社概要','cm.hist.h':'',
    'cm.t1':'会社名','cm.v1':'株式会社ドリームシップ',
    'cm.t2':'代表取締役','cm.v2':'河口　尭矢',
    'cm.t3':'所在地','cm.v3':'長野県下高井郡野沢温泉村豊郷6463-15',
    'cm.t4':'電話番号','cm.t5':'メール','cm.t6':'設立年月日','cm.v6':'2009年8月7日',
    'cm.t7':'事業内容','cm.v7':'スポーツ用品の開発、製造、販売、レンタル。<br>スポーツ用品輸入、販売。<br>スポーツ選手の指導、育成。<br>インターネット販売。<br>イベント企画、運営。<br>各種マーケティングコンサルタント業務。',
    'cm.t8':'英表記','cm.v8':'Dream Ship CO., Ltd.',
    'cm.h1':'',
    'cm.h2':'',
    'cm.h3':'',
    'cm.h4':'',
    'cm.h5':'',
    'cm.note':'',
    'dmo.h1':'DMO・地域連携について',
    'dmo.p1':'掲載内容は準備中です。連携実績・取り組み領域の情報をご提供いただき次第、この枠に掲載します。',
    'dmo.p2':'',
    'dmo.s1':'','dmo.s2':'','dmo.s3':'','dmo.s4':'',
    'dmo.snote':'',
    'dmo.h2':'連携実績・取り組み領域',
    'dmo.tbd':'連携実績・取り組み領域の情報をご提供いただき次第、この枠に掲載します。',
    'tbd.h':'準備中',
    'tbd.wait1':'ご提供待ち','tbd.wait2':'ご提供待ち','tbd.wait3':'ご提供待ち','tbd.wait4':'ご提供待ち',
    'ss.w.tbd.h':'ウインターツアー プラン一覧',
    'dmo.l1':'',
    'dmo.l2':'',
    'dmo.l3':'',
    'dmo.l4':'',
    'dmo.l5':'',
    'dmo.l6':'',
    'dmo.h3':'連携のご相談',
    'dmo.p3':'自治体・DMO・企業の皆様からのご相談を承っております。お問い合わせフォームより「企業タイアップのお問い合わせ」を選択のうえご連絡ください。',
    'dmo.cta':'企業タイアップのお問い合わせ',
    'rc.h1':'採用について',
    'rc.p1':'募集要項は準備中です。職種・業務内容・条件をご提供いただき次第、この枠に掲載します。',
    'rc.p2':'',
    'rc.j1t':'','rc.j1s':'',
    'rc.j1d':'',
    'rc.j1p':'','rc.j1e':'',
    'rc.j1w':'',
    'rc.j2t':'','rc.j2s':'',
    'rc.j2d':'',
    'rc.j2e':'',
    'rc.j2w':'',
    'rc.j3t':'','rc.j3s':'',
    'rc.j3d':'',
    'rc.j3e':'',
    'rc.j3w':'',
    'rc.d1':'業務内容','rc.d2':'勤務地','rc.d3':'雇用形態','rc.d4':'求める人物像',
    'rc.apply':'ご応募・ご質問はお問い合わせフォームより「リクルートについてのお問い合わせ」を選択のうえご連絡ください。',
    'rc.cta':'リクルートのお問い合わせ',
    'of.h':'事業所一覧','of.p':'野沢温泉村内に3つの拠点を構え、シーズンに応じたサービスをご提供しています。',
    'ct2.p':'お問い合わせ内容に応じて、下記より種別をお選びください。<br>お急ぎの場合はお電話（0269-67-0224）でもご相談を承ります。',
    'cf.type':'お問い合わせ種別','cf.name':'お名前','cf.company':'会社名・団体名',
    'cf.email':'メールアドレス','cf.tel':'電話番号','cf.body':'お問い合わせ内容',
    'cf.terms':'利用規約・プライバシーポリシー','cf.agree':'利用規約およびプライバシーポリシーに同意します',
    'cf.submit':'この内容で送信する',
    'cf.demo':'※ 本サイトはデモです。実際の送信は行われません。（送信先想定: info@compasshouse.jp）',
    'md.sub':'ご予約前に利用規約をご確認ください','md.agree':'上記の利用規約に同意します',
    'md.go':'同意して予約ページへ進む','md.cancel':'キャンセル',
    'ft.tag':'〒389-2502<br>長野県下高井郡野沢温泉村豊郷6463-15<br>TEL 0269-67-0224',
    'ft.policy':'プライバシーポリシー','ft.tokusho':'特定商取引法に基づく表記',
    'fab':'お問い合わせ'
  },
  en:{
    'gd.g.item.h':'What to Bring','gd.g.note.h':'Notes for the Day',
    'gd.g.i1':'Comfortable clothing you can move in','gd.g.i2':'Sneakers or other shoes suitable for activity','gd.g.i3':'Drinks',
    'gd.g.i4':'Towel','gd.g.i5':'Seasonal warm layers, rain gear and sun protection',
    'gd.g.icaution':'* Participation is not possible in sandals, heels or other footwear unsafe for riding.',
    'gd.g.n1':'Please arrive at least 15 minutes before the start.',
    'gd.g.n2':'For safety, always follow the instructions of our staff and guides.',
    'gd.g.n3':'Those who have consumed alcohol may not participate.',
    'gd.g.n4':'Content may be changed or cancelled depending on weather and course conditions.',
    'gd.g.n5':'Please treat rental equipment with care.',
    'gd.g.n6':'Please observe traffic rules and ride safely.',
    'gd.w.item.h':'What to Bring','gd.w.note.h':'Notes for the Day',
    'gd.w.i1':'Waterproof, insulated ski wear','gd.w.i2':'Gloves','gd.w.i3':'Goggles',
    'gd.w.i4':'Helmet (rental available)','gd.w.i5':'Warm base layers and thick socks','gd.w.i6':'Drinks',
    'gd.w.icaution':'* Rental customers may also rent wear and accessories (some at additional cost).',
    'gd.w.n1':'Please arrive at least 15 minutes before the start.',
    'gd.w.n2':'You may be asked to present identification at rental reception.',
    'gd.w.n3':'For safety, please follow the instructions of our staff.',
    'gd.w.n4':'Skiing and riding after drinking alcohol is not permitted.',
    'gd.w.n5':'Content may be changed or cancelled depending on weather and lift operations.',
    'gd.w.n6':'Please treat rental equipment with care.',
    'gd.w.n7':'Please observe the rules and etiquette of the ski resort and enjoy safely.',
    'qk.h':'Quick Booking','qk.s':'Two steps to the booking page','qk.season':'Season','qk.service':'Service',
    'qk.green':'Green','qk.winter':'Winter','qk.tour':'Tour','qk.rental':'Rental','qk.go':'Go',
    'tp.src':'* Winter tours are taken from the plans listed on fd-system.tours',
    'nav.season':'Season','nav.guide':'First Time Guide',
    'lc.season.t':'Season Feature','lc.season.d':'Green season and winter season — how to play in each',
    'lc.guide.t':'First Time Guide','lc.guide.d':'For first-timers: from booking to the day',
    'ph.season':'Season Feature','ph.guide':'First Time Guide',
    'ss.green':'Green Season','ss.winter':'Winter Season',
    'ss.cta.r':'View Rentals','ss.cta.t':'View Tours',
    'ss.src':'* Text quoted from the existing site (compasshouse.jp/summer, /winter)',
    'ss.g.h':'The green season in Nozawa is playful !!',
    'ss.g.p1':'The summer in Nozawa has unknown potential compared to the winter. The snow season here has already passed over 100 years since skiing was imported and has become world famous.',
    'ss.g.p2':'Now we try to develop summer activities and suggest them as locals. Experience the diverse wilderness in Nozawa, which changes day by day through the season, by MTB or road bike, then enjoy the pure natural hot spring and classical town afterwards. Come and join Nozawa\'s new summer culture !!',
    'ss.g.r1h':'COMPASS VILLAGE｜E-BIKE Rental',
    'ss.g.r1p':'The latest e-bikes (electric bicycles) are available for rent, and e-bike guide tours are also available at any time. We can accommodate group use such as training camps.',
    'ss.g.r1m':'Hours 9:00-18:00 / Season April - November',
    'ss.g.r2h':'COMPASS RENTAL BASE｜Mountain Bike Rental',
    'ss.g.r2p':'MTBs specialised for downhill riding are available for rent, and course guides are always available for those new to MTB. Group use is also accommodated.',
    'ss.g.r2m':'Hours 9:00-17:00 / Season July - October (during summer ski resort operation)',
    'ss.g.t1h':'MOUNTAIN BIKE TOUR',
    'ss.g.t1p':'The playground for Compass House is not limited to Nozawa village — we jump into the wilderness! We have plans for anyone, even families, so ask us regardless of age or style.',
    'ss.w.h':'Ride skiing more happily, more freely !',
    'ss.w.p1':'We began the "Compass Project" in 2010 to tell you how awesome skiing is, with the words "Ride skiing more happily, more freely". We made the base at Nozawa Onsen for the project.',
    'ss.w.p2':'We built the shop "Compass House" for ski gear. The Compass House is not only to supply gear but also to supply relationships and experiences !!',
    'ss.w.r1h':'SKI & SNOWBOARD RENTAL',
    'ss.w.r1p':'Our rental shop "Compass Rental Base" is located in front of Nagasaka Gondola station. You can hire high performance gear easily! It also operates as a test centre for the latest models of each brand.',
    'ss.w.r1m':'7809 Toyosato, Nozawa Onsen, Shimotakai, Nagano / Hours 8:00-17:00 / Rental reservations & inquiries 070-1403-0303',
    'ss.w.t1h':'COMPASS HOUSE WINTER TOUR',
    'ss.w.t1p':'We have a variety of tours for riders, from those who want to explore Japanese wilderness to those who want to enjoy a fun ride in Japow. We suggest an awesome day for each and every rider !!',
    'ss.w.tbd':'Individual winter tour plans (name, price, duration) will be published here once provided.',
    'gd.flow.h':'How It Works','gd.before.h':'Before You Book','ac.h.car':'BY CAR','ac.h.train':'BY TRAIN',
    'gd.flow.sub':'From booking to the day',
    'gd.s1t':'Choose a service','gd.s1d':'Select your plan or equipment from the Tour and Rental pages. For rentals, the price simulator gives you an estimate.',
    'gd.s2t':'Agree to the terms','gd.s2d':'Pressing "Proceed to Booking" displays the terms of use. Please review and agree before continuing.',
    'gd.s3t':'Apply via the booking system','gd.s3d':'Tours go to the external booking system (STORES); rentals go to the relevant application form. Enter your dates, party size and equipment.',
    'gd.s4t':'Confirmation and arrival','gd.s4d':'After applying, we will contact you to confirm. Please come to the relevant base on the day.',
    'gd.form.mtb':'Pedal Bike','gd.form.ski':'Ski & Snowboard',
    'gd.tbd.t':'What to bring / notes for the day','gd.tbd.d':'Details will be published here once provided.',
    'gd.cta':'Contact us with any questions',
    'vd.note':'The specified video (youtu.be/xqmio9N8OYs) is currently not public, so a public video from the official channel is shown provisionally.',
    'cta.contact':'CONTACT',
    'ct.exlbl':'EXAMPLES','rt.custom.t':'Custom Tour Inquiry','rt.custom.s':'Original plans for groups, corporations and educational institutions',
    'nav.home':'Home','nav.tour':'Tour','nav.rental':'Rental','nav.shop':'Shop',
    'nav.event':'Event','nav.gallery':'Gallery','nav.access':'Access',
    'nav.company':'Company','nav.contact':'Contact',
    'hero.h':'A compass for a life worth living<br><b>Welcome to Compass House</b>',
    'hero.sub':'Ski, snowboard and bicycles.<br>We know the fields of Nozawa Onsen inside out, and we propose everything about playing here.',
    'hero.cta1':'View Tours','hero.cta2':'View Rentals',
    'con.h':'A corner of great nature<br><span>becomes your playground</span>',
    'con.p1':'Not home, not work — a place where you can be yourself. COMPASS HOUSE is a shop based in Nozawa Onsen Village, Nagano, sharing the joy of SKI &amp; BIKE.',
    'con.p2':'By adding sport into daily life, we aim to make your life\'s work richer, and we keep supporting that. While making use of local culture and fields, we think about the further development of Nozawa Onsen, and hope to be a team that grows together with it.',
    'svc.sub':'Our Services',
    'svc.lead':'Nozawa\'s finest conditions, with genuine gear and thrilling experiences to match.',
    'svc.tour':'A share of excitement from those who know Nozawa. MTB / E-BIKE / BC tours',
    'svc.rental':'E-BIKE / MTB / Ski / Snowboard, with a price simulator',
    'svc.shop':'COMPASS ONLINE STORE / ARMADA ONLINE',
    'svc.event':'Own events, tie-up projects and local partnerships',
    'svc.gallery':'Instagram-linked gallery',
    'svc.company':'Profile / DMO / Recruit / Offices',
    'svc.more':'View More',
    'tour.sub':'Guided Tour',
    'tour.lead':'For your one precious day, here are the guides worth entrusting it to.<br>Sport has the power to introduce you to a self you did not know.',
    'link.alltour':'All Tours','link.allrental':'Rentals & Price Simulator','link.shop':'Shop Page',
    'link.event':'All Events','link.access':'Facility Details',
    'rt.sub':'Rental','sh.sub':'Online Store','ev.sub':'Event','gl.sub':'Gallery',
    'gl.detail':'View Details',
    'ev.ext.t':'Nozawa Onsen Tourism Association Event Calendar','ev.ext.s':'Latest events across the onsen town and region',
    'ev.ext.cta':'Visit Official Site',
    'vd.sub':'Movie',
    'vd.p':'From the official YouTube channel.<br>* The specified video (youtu.be/xqmio9N8OYs) is currently not public, so a public video is shown provisionally.',
    'vd.cta':'YouTube Channel',
    'ac.sub':'Access & Facilities','cp.sub':'Profile / DMO / Recruit / Offices','cp.cta':'View Company Info',
    'ph.tour':'Tour','ph.rental':'Rental','ph.shop':'Online Store','ph.event':'Event',
    'ph.gallery':'Gallery','ph.access':'Access & Facilities','ph.company':'Company',
    'ph.contact':'Contact','ph.policy':'Privacy Policy','ph.tokusho':'Legal Notice (Specified Commercial Transactions Act)',
    'tp.h':'For your one precious day,<br>here are the guides worth entrusting it to',
    'tp.p':'Sport has the power to introduce you to a self you did not know. Our guides know the fields of Nozawa Onsen inside out and will lead you on the best route for your level and the day\'s conditions.',
    'ct.sub':'Custom Tour',
    'ct.p':'We build original tours for groups, corporations and educational institutions. Packages including lodging and lunch arrangements are also available.',
    'ct.cta':'Custom Tour Inquiry',
    'ct.e1':'Studio rental & lodging','ct.e2':'Cycle tour package',
    'ct.e3':'Custom package tours for schools / groups','ct.e4':'Corporate (employee welfare) package tours',
    'tn.sub':'Before You Book',
    'tn.1t':'How to Book','tn.1d':'From "Proceed to Booking" on each tour, review and agree to the terms, then continue to the external booking system.',
    'tn.2t':'What to Bring','tn.2d':'Information on what to bring is in preparation.',
    'tn.3t':'Cancellation Policy','tn.3d':'7-4 days prior: 30% / 3-2 days prior: 50% / day before &amp; same day: 100%',
    'rp.h':'Nozawa\'s finest conditions,<br>with genuine gear to match',
    'rp.p':'Specialized E-BIKEs and MTBs, ARMADA skis, and Burton / CAPiTA / KORUA snowboards. We rent out exactly the gear our pro shop actually rides.',
    'rs.green':'Green Season / Bicycles','rs.winter':'Winter Season / Ski & Snowboard',
    'sim.sub':'Price Simulator','sim.lead':'Select gear, duration, quantity and options, and an estimate is calculated automatically.',
    'sim.l1':'Select Gear','sim.l2':'Duration','sim.l3':'Quantity','sim.l4':'Options (optional)',
    'sim.note':'* Figures are tax-included estimates. Actual prices may vary by model and availability. Please check the PDF price list or in store for official rates.',
    'sim.book':'Book Rental','sim.ask':'Group & Long-term Inquiry',
    'ro.sub':'Recommended Routes','ro.link':'Route Consultation','rm.sub':'Pick-up Base Map',
    'rtm.sub':'Rental Terms',
    'rtm.1t':'Requirements','rtm.1d':'Bicycles: 140cm and taller<br>Ski &amp; snowboard: no particular restrictions',
    'rtm.2t':'Cancellation Policy','rtm.2d':'7-4 days prior: 30%<br>3-2 days prior: 50%<br>Day before &amp; same day: 100%',
    'sp.p':'From Nozawa Onsen, we deliver items that enrich your outdoor life. We sell gear and apparel carefully selected by a pro shop, centered on skis, snowboards and bicycles.',
    'sp.cat':'Product Categories & Brands',
    'sp.store':'Our Stores',
    'sp.store.link':'Access & Opening Hours',
    'ep.sub':'Our Events & Tie-ups','ep.lead':'* Content is in preparation and will be updated once operations begin.',
    'ep.local':'Events in Nozawa Onsen Village',
    'gp.sub':'Instagram Feed',
    'ac.car':'Approx. 25 min from Toyota-Iiyama IC on the Joshinetsu Expressway.',
    'ac.train':'Approx. 25 min from Iiyama Station by Nozawa Onsen Liner or local bus. Walking distance from the Nozawa Onsen bus stop.',
    'tab.profile':'Profile','tab.dmo':'DMO','tab.recruit':'Recruit','tab.office':'Offices',
    'cm.msg.h':'Message',
    'cm.msg.p1':'"By adding sport into daily life, we aim to make your life’s work richer, and we keep supporting that."',
    'cm.msg.p2':'We are a team called Dream Ship CO., Ltd., based in Nozawa Onsen Village, Nagano. While making use of local culture and fields, we think about the further development of Nozawa Onsen and hope to be a team that grows together with it.',
    'cm.msg.p3':'Representative　Takaya Kawaguchi',
    'cm.ov.h':'Company Profile','cm.hist.h':'',
    'cm.t1':'Company Name','cm.v1':'Dream Ship CO., Ltd.',
    'cm.t2':'Representative Director','cm.v2':'Takaya Kawaguchi',
    'cm.t3':'Address','cm.v3':'6463-15 Toyosato, Nozawa Onsen, Shimotakai, Nagano',
    'cm.t4':'Phone','cm.t5':'E-mail','cm.t6':'Established','cm.v6':'7 August 2009',
    'cm.t7':'Business','cm.v7':'Development, manufacture, sales and rental of sporting goods.<br>Import and sales of sporting goods.<br>Coaching and development of athletes.<br>Internet sales.<br>Event planning and operation.<br>Various marketing consultancy services.',
    'cm.t8':'English Name','cm.v8':'Dream Ship CO., Ltd.',
    'cm.h1':'',
    'cm.h2':'',
    'cm.h3':'',
    'cm.h4':'',
    'cm.h5':'',
    'cm.note':'',
    'dmo.h1':'DMO & Local Partnerships',
    'dmo.p1':'Content is in preparation. Details will be published here once provided.',
    'dmo.p2':'',
    'dmo.s1':'','dmo.s2':'','dmo.s3':'','dmo.s4':'',
    'dmo.snote':'',
    'dmo.h2':'Track Record & Areas of Work',
    'dmo.tbd':'Details of partnership track record and focus areas will be published here once provided.',
    'tbd.h':'In preparation',
    'tbd.wait1':'To be provided','tbd.wait2':'To be provided','tbd.wait3':'To be provided','tbd.wait4':'To be provided',
    'ss.w.tbd.h':'Winter Tour Plans',
    'dmo.l1':'',
    'dmo.l2':'',
    'dmo.l3':'',
    'dmo.l4':'',
    'dmo.l5':'',
    'dmo.l6':'',
    'dmo.h3':'Partnership Inquiries',
    'dmo.p3':'We welcome inquiries from local governments, DMOs and companies. Please select "Corporate tie-up inquiry" on the contact form.',
    'dmo.cta':'Corporate Tie-up Inquiry',
    'rc.h1':'Recruitment',
    'rc.p1':'Job listings are in preparation. Positions, duties and conditions will be published here once provided.',
    'rc.p2':'',
    'rc.j1t':'','rc.j1s':'',
    'rc.j1d':'',
    'rc.j1p':'','rc.j1e':'',
    'rc.j1w':'',
    'rc.j2t':'','rc.j2s':'',
    'rc.j2d':'',
    'rc.j2e':'',
    'rc.j2w':'',
    'rc.j3t':'','rc.j3s':'',
    'rc.j3d':'',
    'rc.j3e':'',
    'rc.j3w':'',
    'rc.d1':'Duties','rc.d2':'Location','rc.d3':'Employment Type','rc.d4':'Ideal Candidate',
    'rc.apply':'For applications and questions, please select "Recruitment inquiry" on the contact form.',
    'rc.cta':'Recruitment Inquiry',
    'of.h':'Our Offices','of.p':'We operate three bases within Nozawa Onsen Village, providing services according to the season.',
    'ct2.p':'Please select the type of inquiry below.<br>For urgent matters you may also call us at 0269-67-0224.',
    'cf.type':'Inquiry Type','cf.name':'Name','cf.company':'Company / Organisation',
    'cf.email':'Email','cf.tel':'Phone','cf.body':'Message',
    'cf.terms':'Terms & Privacy Policy','cf.agree':'I agree to the Terms of Use and Privacy Policy',
    'cf.submit':'Submit',
    'cf.demo':'* This is a demo site. No message is actually sent. (Intended recipient: info@compasshouse.jp)',
    'md.sub':'Please review the terms before booking','md.agree':'I agree to the terms above',
    'md.go':'Agree and proceed to booking','md.cancel':'Cancel',
    'ft.tag':'6463-15 Toyosato, Nozawa Onsen<br>Shimotakai, Nagano 389-2502, Japan<br>TEL +81-269-67-0224',
    'ft.policy':'Privacy Policy','ft.tokusho':'Legal Notice',
    'fab':'Contact'
  }
};

/* TOP動画の遅延読み込み：ポスターを先に表示し、ページ読み込み完了後に動画を取得 */
(function(){
  const hv = document.querySelector('.hero-fig video');
  if(!hv) return;
  const load = () => { if(hv.src) return; hv.src = 'images/hero-pv.mp4'; const p = hv.play(); if(p && p.catch) p.catch(function(){}); };
  if(document.readyState === 'complete') load();
  else window.addEventListener('load', load);
})();

/* 単一ファイル版：data URI化されたPDFリンクをBlob URLで開く（分割構成では無効） */
document.addEventListener('click', function(e){
  const a = e.target && e.target.closest ? e.target.closest('a[href^="data:application/pdf"]') : null;
  if(!a) return;
  e.preventDefault();
  const b64 = a.getAttribute('href').split(',')[1];
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  window.open(URL.createObjectURL(new Blob([bytes], {type:'application/pdf'})), '_blank');
});

/* ------------------------------------------------------------
   2. STATE
   ------------------------------------------------------------ */
let LANG = 'ja';
const isEn = () => LANG === 'en';
const t = (ja, en) => (isEn() && en ? en : ja);

/* ------------------------------------------------------------
   3. RENDERERS
   ------------------------------------------------------------ */
function imgOrPh(o){
  return o.img
    ? '<img src="'+o.img+'" alt="'+(o.name||'')+'" loading="lazy">'
    : ph(o.imgFile || o.imgLabel);
}

function renderTours(el, list){
  if(!el) return;
  el.innerHTML = list.map(x => `
    <article class="tour-row rv">
      <div class="tour-thumb${x.fit?' fit':''}"><img src="${x.img}" alt="${t(x.title,x.titleEn).replace(/"/g,'&quot;')}" loading="lazy"></div>
      <div>
        <div class="tour-tags">
          ${(isEn()?x.tagsEn:x.tags).map((g,i)=>`<span class="tag${i===0?' tag-a':''}">${g}</span>`).join('')}
        </div>
        ${x.lead ? `<p class="tour-lead">${t(x.lead,x.leadEn)}</p>` : ''}
        <h3 class="tour-t">${t(x.title,x.titleEn)}</h3>
        <div class="tour-meta">
          <span><b>&yen;${x.price}</b>${x.priceNote}</span>
          <span>${t(x.cap,x.capEn)}</span>
        </div>
        <p class="tour-note">${t(x.note,x.noteEn)}</p>
      </div>
      <div>
        <button class="btn btn-fill book-btn" data-url="${x.url}" data-title="${t(x.title,x.titleEn).replace(/"/g,'&quot;')}">
          ${t('予約へ進む','Proceed to Booking')}<span class="ar">&rarr;</span>
        </button>
      </div>
    </article>`).join('');
}

function renderGear(el, list){
  if(!el) return;
  el.innerHTML = list.map(g => `
    <article class="gear">
      <div class="gear-img${g.fit?' fit':''}">${imgOrPh(g)}</div>
      <div class="gear-body">
        <div class="gear-cat">${g.cat}</div>
        <h3 class="gear-n">${t(g.name, g.nameEn||g.name)}</h3>
        ${g.catch ? `<p class="gear-catch">${t(g.catch,g.catchEn)}</p>` : ''}
        <p class="gear-d">${t(g.d,g.dEn)}</p>
        ${g.isPdf
          ? `<a href="${g.pdf}" target="_blank" rel="noopener" class="btn btn-sm" style="margin-top:16px">${t('料金表PDFを見る','View Price PDF')}<span class="ar">&#8599;</span></a>`
          : `<div class="gear-p">&yen;${g.p}<small>${t(g.unit,g.unitEn)}</small></div>`}
      </div>
    </article>`).join('');
}

function renderRoutes(el){
  if(!el) return;
  el.innerHTML = ROUTES.map(r => `
    <div class="route">
      <div class="route-n">${r.n}</div>
      <h3 class="route-t">${t(r.t,r.tEn)}</h3>
      ${(isEn()?r.mEn:r.m).length ? `<div class="route-m">${(isEn()?r.mEn:r.m).map(m=>`<span>${m}</span>`).join('')}</div>` : ''}
      ${r.tbd ? `<div class="tbd" style="margin-top:12px"><b>${t("準備中","In preparation")}</b><p>${t(r.d,r.dEn)}</p></div>`
              : `<p class="route-d">${t(r.d,r.dEn)}</p>`}
    </div>`).join('');
}

function renderShops(el){
  if(!el) return;
  el.innerHTML = SHOPS.map(s => `
    <a href="${s.url}" target="_blank" rel="noopener" class="shop-c">
      <div class="shop-bg"><img src="${s.img}" alt="" loading="lazy"></div>
      <div class="shop-veil"></div>
      <div class="shop-in">
        <div class="shop-tag">${s.tag}</div>
        <div class="shop-n">${s.name}</div>
        <p class="shop-d">${t(s.d,s.dEn)}</p>
        <span class="shop-go">${t('ストアへ移動','Visit Store')}<span>&#8599;</span></span>
      </div>
    </a>`).join('');
}

function renderShopCats(el){
  if(!el) return;
  el.innerHTML = SHOP_CATS.map(c => `
    <div class="route">
      <div class="route-n">${c.n}</div>
      <h3 class="route-t">${t(c.t,c.tEn)}</h3>
      <div class="route-m" style="margin-top:14px">${(isEn()?c.itemsEn:c.items).map(m=>`<span>${m}</span>`).join('')}</div>
    </div>`).join('');
}

function renderRealStores(el){
  if(!el) return;
  el.innerHTML = REAL_STORES.map(s => `
    <article class="gear">
      <div class="gear-img">${imgOrPh(s)}</div>
      <div class="gear-body">
        <div class="gear-cat">REAL STORE</div>
        <h3 class="gear-n">${s.name}${isEn()?'':`<span style="display:block;font-size:11px;letter-spacing:.2em;color:var(--ink-3);margin-top:4px">${s.jp}</span>`}</h3>
        <p class="gear-d">${t(s.addr,s.addrEn)}<br>${t(s.hours,s.hoursEn)}</p>
        <a href="#/access" class="btn btn-sm" style="margin-top:16px">${t('アクセスを見る','See Access')}<span class="ar">&rarr;</span></a>
      </div>
    </article>`).join('');
}

function renderEvents(el){
  if(!el) return;
  el.innerHTML = EVENTS.map(e => `
    <article class="ev">
      <div class="ev-img"><img src="${e.img}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;opacity:.35"></div>
      <div class="ev-b">
        <div class="ev-date">${e.date}</div>
        <h3 class="ev-t">${t(e.t,e.tEn)}</h3>
        <div class="ev-m">${(isEn()?e.mEn:e.m).map(m=>`<span>${m}</span>`).join('')}</div>
      </div>
    </article>`).join('');
}

const IG_SET = [IMG.heroSummer,IMG.guide,IMG.bikes,IMG.heroWinter,IMG.ski,IMG.guide,IMG.heroSummer,IMG.bikes,IMG.ski,IMG.heroWinter];
function renderIg(el, n, withBig){
  if(!el) return;
  let out = '';
  for(let i=0;i<n;i++){
    out += `<a href="https://www.instagram.com/compasshouse/" target="_blank" rel="noopener" class="ig-item">
      <img src="${IG_SET[i%IG_SET.length]}" alt="" loading="lazy">
      <div class="ig-ov"><div><span>Instagram</span><em>${t('詳細はこちら','View Details')}</em></div></div>
    </a>`;
  }
  el.innerHTML = out;
}

function renderAccess(el, list){
  if(!el) return;
  el.innerHTML = list.map(o => `
    <div class="acc">
      <div class="acc-map">
        <iframe src="${o.map}" loading="lazy" title="${o.name}" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <a class="map-open" href="${o.mapLink}" target="_blank" rel="noopener">${t('Googleマップで開く','Open in Google Maps')} &#8599;</a>
      </div>
      <div class="acc-body">
        <h3 class="acc-n">${o.name}${isEn()?'':`<em>${o.jp}</em>`}</h3>
        <dl class="acc-dl">
          <div><dt>Address</dt><dd>${o.zip}<br>${t(o.addr,o.addrEn)}</dd></div>
          <div><dt>Tel</dt><dd><a href="tel:${o.tel.replace(/-/g,'')}" style="border-bottom:1px solid var(--line-2)">${o.tel}</a></dd></div>
          <div><dt>Hours</dt><dd>${o.hours}<br><span style="font-size:11.5px;color:var(--ink-3)">${t(o.hoursNote,o.hoursNoteEn)}</span></dd></div>
          <div><dt>Service</dt><dd>${t(o.biz,o.bizEn)}</dd></div>
          <div><dt>Parking</dt><dd>${t(o.park,o.parkEn)}</dd></div>
        </dl>
      </div>
    </div>`).join('');
}

function renderContactTypes(){
  const el = document.getElementById('ctType');
  if(!el) return;
  el.innerHTML = CT_TYPES.map((c,i) => `
    <label class="radio${i===0?' on':''}" data-k="${c.k}"><i></i><span>${t(c.n,c.nEn)}</span></label>`).join('');
  el.querySelectorAll('.radio').forEach(r => {
    r.addEventListener('click', () => {
      el.querySelectorAll('.radio').forEach(x => x.classList.remove('on'));
      r.classList.add('on');
      setHint(r.dataset.k);
    });
  });
  setHint(CT_TYPES[0].k);
}
function setHint(k){
  const c = CT_TYPES.find(x => x.k===k) || CT_TYPES[0];
  const h = document.getElementById('cfHint');
  const b = document.getElementById('cfBody');
  if(h) h.textContent = t(c.hint,c.hintEn);
  if(b) b.placeholder = t(c.hint,c.hintEn);
}
function pickContactType(k){
  const el = document.getElementById('ctType');
  if(!el) return;
  const target = el.querySelector('.radio[data-k="'+k+'"]');
  if(target){
    el.querySelectorAll('.radio').forEach(x => x.classList.remove('on'));
    target.classList.add('on');
    setHint(k);
  }
}

function renderTokusho(){
  const el = document.getElementById('tokushoBody');
  if(!el) return;
  el.innerHTML = '<tbody>' + TOKUSHO.map(r =>
    `<tr><th>${isEn()?r[2]:r[0]}</th><td>${isEn()?r[3]:r[1]}</td></tr>`).join('') +
    `<tr><td colspan="2" style="font-size:11px;color:#8a807b;border-bottom:0">${t('※ 本表記はデモ用のサンプルです。正式内容は確定後に差し替えます。','* This notice is a demo sample and will be replaced once finalised.')}</td></tr></tbody>`;
}

function renderStatic(){
  const p = document.getElementById('policyBody');
  if(p) p.innerHTML = isEn() ? POLICY_EN : POLICY_JA;
  const ct = document.getElementById('ctTerms');
  if(ct) ct.innerHTML = isEn() ? TERMS_EN : TERMS_JA;
  const mt = document.getElementById('modalTerms');
  if(mt) mt.innerHTML = isEn() ? TERMS_EN : TERMS_JA;
}

function renderPdfBand(season){
  const el = document.getElementById('pdfBand');
  if(!el) return;
  const green = season === 'green';
  const url = green
    ? 'docs/bike_price_2025.pdf'
    : 'https://compasshouse.jp/assets/docs/winter_2024.pdf';
  const ttl = green
    ? t('自転車 レンタルラインナップ / 料金表','Bicycle Rental Lineup / Price List')
    : t('スキー・スノーボード レンタルラインナップ / 料金表','Ski & Snowboard Rental Lineup / Price List');
  el.innerHTML = `
    <div>
      <b>${ttl}</b>
      <span>${t('全ラインナップと詳細料金はPDFにてご確認いただけます。','Full lineup and detailed prices available as PDF.')}</span>
    </div>
    <a href="${url}" target="_blank" rel="noopener" class="btn btn-sm btn-fill">${t('PDFを開く','Open PDF')}<span class="ar">&#8599;</span></a>`;
}

/* ------------------------------------------------------------
   4. SIMULATOR — PDF準拠（階段制）
   ------------------------------------------------------------ */
let TOUR_SEASON = 'green';
const SIM = { season:'green', gear:null, dur:null, qty:1, addons:[] };

/* 1.5日など該当レートが無い場合は上位ティア（2日）を適用 */
function tierPrice(arr, idx){
  if(arr[idx] != null) return {v:arr[idx], sub:false};
  for(let i = idx + 1; i < arr.length; i++){
    if(arr[i] != null) return {v:arr[i], sub:true};
  }
  return {v:null, sub:false};
}

function currentGearList(){ return SIM.season === 'green' ? G_GEAR : W_GEAR; }
function currentDurList(){  return SIM.season === 'green' ? G_DURS : W_DURS; }

function unitPrice(g){
  if(SIM.season === 'green'){
    return {v: g.p[SIM.dur] != null ? g.p[SIM.dur] : null, sub:false};
  }
  return tierPrice(g.p, SIM.dur);
}

function buildSim(){
  const gears = currentGearList();
  const durs  = currentDurList();

  if(!SIM.gear || !gears.find(g => g.k === SIM.gear)) SIM.gear = gears[0].k;
  const durKeys = durs.map(d => SIM.season === 'green' ? d.k : d.i);
  if(SIM.dur === null || !durKeys.includes(SIM.dur)) SIM.dur = durKeys[0];

  /* --- gear options --- */
  const ge = document.getElementById('simGear');
  if(ge){
    let lastGrp = null;
    ge.innerHTML = gears.map(g => {
      const head = g.grp !== lastGrp
        ? `<div class="opt-grp">${g.grp}</div>` : '';
      lastGrp = g.grp;
      const base = SIM.season === 'green' ? g.p.half : g.p[0];
      const unitLbl = SIM.season === 'green' ? t('半日〜','half day~') : t('1日〜','1 day~');
      return head + `
      <button type="button" class="opt${g.k===SIM.gear?' on':''}" data-k="${g.k}">
        <div class="opt-n">${t(g.n,g.nEn)}</div>
        <div class="opt-s">${t(g.s,g.sEn)}</div>
        <div class="opt-p">&yen;${base.toLocaleString()}<span style="font-size:9px;color:var(--ink-3);margin-left:4px">${unitLbl}</span></div>
      </button>`;
    }).join('');
    ge.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
      SIM.gear = b.dataset.k;
      ge.querySelectorAll('.opt').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      calcSim();
    }));
  }

  /* --- duration chips --- */
  const de = document.getElementById('simDur');
  if(de){
    de.innerHTML = durs.map(d => {
      const key = SIM.season === 'green' ? d.k : d.i;
      return `<button type="button" class="chip${key===SIM.dur?' on':''}" data-k="${key}">${d.n}${isEn()?'':`<em>${d.jp}</em>`}</button>`;
    }).join('');
    de.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      const raw = b.dataset.k;
      SIM.dur = SIM.season === 'green' ? raw : parseInt(raw, 10);
      de.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      calcSim();
    }));
  }

  /* --- addons (winter only / PDF掲載分) --- */
  const ab = document.getElementById('simAddBlock');
  const ae = document.getElementById('simAdd');
  if(ab && ae){
    if(SIM.season === 'winter'){
      ab.style.display = '';
      SIM.addons = SIM.addons.filter(k => W_ADDONS.some(a => a.k === k));
      ae.innerHTML = W_ADDONS.map(a => {
        const pr = tierPrice(a.p, SIM.dur);
        return `<label class="addon${SIM.addons.includes(a.k)?' on':''}" data-k="${a.k}">
          <i>&check;</i><span>${t(a.n,a.nEn)}</span>
          <span class="ap">+&yen;${pr.v.toLocaleString()}${pr.sub?'<sup style="color:var(--accent)">*</sup>':''}</span>
        </label>`;
      }).join('');
      ae.querySelectorAll('.addon').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k;
        if(SIM.addons.includes(k)){ SIM.addons = SIM.addons.filter(x => x !== k); b.classList.remove('on'); }
        else { SIM.addons.push(k); b.classList.add('on'); }
        calcSim();
      }));
    } else {
      ab.style.display = 'none';
      SIM.addons = [];
      ae.innerHTML = '';
    }
  }
  calcSim();
}

function calcSim(){
  const g = currentGearList().find(x => x.k === SIM.gear);
  const durs = currentDurList();
  const d = SIM.season === 'green'
    ? durs.find(x => x.k === SIM.dur)
    : durs.find(x => x.i === SIM.dur);
  if(!g || !d) return;

  const up = unitPrice(g);
  const rows = document.getElementById('simRows');
  const tt   = document.getElementById('simTotal');
  const note = document.getElementById('simSub');
  const bk   = document.getElementById('simBook');

  /* --- 価格未設定（E-BIKEの1日料金など） --- */
  if(up.v === null){
    if(rows){
      rows.innerHTML =
        `<div><span>${t('機材','Gear')}</span><span>${t(g.n,g.nEn)}</span></div>` +
        `<div><span>${t('期間','Duration')}</span><span>${isEn()?d.n:d.jp}</span></div>` +
        `<div><span>${t('数量','Quantity')}</span><span>${SIM.qty} ${t('台','pcs')}</span></div>` +
        `<div><span>${t('料金','Price')}</span><span>${t('未掲載','Not listed')}</span></div>`;
    }
    if(tt) tt.innerHTML = `<span style="font-size:19px;letter-spacing:.02em">${t('お問い合わせ','Please inquire')}</span>`;
    if(note) note.innerHTML = t(
      'この組み合わせの料金は公開料金表に掲載がありません。店頭またはお問い合わせにてご確認ください。',
      'This combination is not on the published price list. Please check in store or contact us.');
    if(bk){
      bk.setAttribute('href', '#/contact?type=other');
      bk.removeAttribute('target');
      const lb1=bk.querySelector('[data-i]')||bk.querySelector('span'); if(lb1) lb1.textContent = t('料金を問い合わせる','Inquire about price');
    }
    return;
  }

  const base = up.v * SIM.qty;
  const adds = SIM.season === 'winter'
    ? W_ADDONS.filter(a => SIM.addons.includes(a.k)).map(a => {
        const pr = tierPrice(a.p, SIM.dur);
        return {n:a.n, nEn:a.nEn, v:pr.v * SIM.qty, sub:pr.sub};
      })
    : [];
  const addSum = adds.reduce((s, a) => s + a.v, 0);
  const total = base + addSum;
  const anySub = up.sub || adds.some(a => a.sub);

  if(rows){
    rows.innerHTML =
      `<div><span>${t('機材','Gear')}</span><span>${t(g.n,g.nEn)}</span></div>` +
      `<div><span>${t('期間','Duration')}</span><span>${isEn()?d.n:d.jp}</span></div>` +
      `<div><span>${t('数量','Quantity')}</span><span>${SIM.qty} ${t('台 / 名','pcs / pax')}</span></div>` +
      `<div><span>${t('機材小計','Gear subtotal')}</span><span>&yen;${base.toLocaleString()}${up.sub?'<sup style="color:var(--accent-2)">*</sup>':''}</span></div>` +
      (adds.length
        ? adds.map(a => `<div><span>+ ${t(a.n,a.nEn)}</span><span>&yen;${a.v.toLocaleString()}${a.sub?'<sup style="color:var(--accent-2)">*</sup>':''}</span></div>`).join('')
        : `<div><span>${t('オプション','Options')}</span><span>${t('なし','None')}</span></div>`);
  }
  if(tt) tt.textContent = '¥' + total.toLocaleString();

  if(note){
    const src = SIM.season === 'green'
      ? t('料金出典：BIKE料金表PDF（新料金）','Source: BIKE price list PDF (updated prices)')
      : t('料金出典：winter_2024.pdf','Source: winter_2024.pdf');
    note.innerHTML = src + (anySub
      ? '<br><span style="color:var(--accent-2)">*</span> ' + t('1.5日の設定が無い項目は2日料金を適用しています。','Items without a 1.5-day rate use the 2-day rate.')
      : '');
  }

  if(bk){
    const isE = String(SIM.gear).indexOf('ebike') === 0;
    bk.setAttribute('href', SIM.season === 'winter'
      ? 'https://compasshouse.jp/rental-form/'
      : (isE ? 'https://compasshouse.jp/rental-form_e-bike/'
             : 'https://compasshouse.jp/rental-form_mtb/'));
    bk.setAttribute('target', '_blank');
    bk.setAttribute('rel', 'noopener');
    const lb2=bk.querySelector('[data-i]')||bk.querySelector('span'); if(lb2) lb2.textContent = t('レンタルを予約する','Book Rental');
  }
}

/* ------------------------------------------------------------
   5. ROUTER
   ------------------------------------------------------------ */
const PAGES = ['home','season','guide','tour','rental','shop','event','gallery','access','company','contact','policy','tokusho'];

const PAGE_META = {
  home:   {ja:['COMPASS HOUSE｜野沢温泉村 スキー・スノーボード・自転車のアウトドア専門店','長野県野沢温泉村のアクティビティ発信基地。スキー・スノーボード・自転車の販売、レンタル、ガイドツアー。'],
           en:['COMPASS HOUSE | Ski, Snowboard & Bike Outdoor Shop in Nozawa Onsen','Outdoor activity base in Nozawa Onsen, Nagano. Ski, snowboard and bicycle sales, rental and guided tours.']},
  season: {ja:['シーズン特集｜COMPASS HOUSE 野沢温泉村','野沢温泉のグリーンシーズン・ウィンターシーズンの楽しみ方をご紹介します。'],
           en:['Seasons | COMPASS HOUSE Nozawa Onsen','How to enjoy Nozawa Onsen in the green and winter seasons.']},
  tour:   {ja:['ツアー一覧・予約｜COMPASS HOUSE 野沢温泉村','MTB・E-BIKEツアー、バックカントリーツアー、スノーシューツアーのご案内と予約。'],
           en:['Tours | COMPASS HOUSE Nozawa Onsen','MTB and E-BIKE tours, backcountry tours and snowshoe tours — details and booking.']},
  rental: {ja:['レンタル料金・機材｜COMPASS HOUSE 野沢温泉村','Specialized E-BIKE・MTB、ARMADAスキー、スノーボードのレンタル機材と料金シミュレーター。'],
           en:['Rental | COMPASS HOUSE Nozawa Onsen','Specialized E-BIKEs and MTBs, ARMADA skis and snowboards — rental gear and price simulator.']},
  shop:   {ja:['オンラインショップ｜COMPASS HOUSE 野沢温泉村','COMPASS ONLINE STORE・ARMADA ONLINEのご案内と実店舗情報。'],
           en:['Shop | COMPASS HOUSE Nozawa Onsen','COMPASS ONLINE STORE, ARMADA ONLINE and our physical stores.']},
  event:  {ja:['イベント情報｜COMPASS HOUSE 野沢温泉村','自社イベントと野沢温泉村のイベント情報。'],
           en:['Events | COMPASS HOUSE Nozawa Onsen','Our events and events around Nozawa Onsen village.']},
  gallery:{ja:['ギャラリー｜COMPASS HOUSE 野沢温泉村','野沢温泉のフィールドとアクティビティのフォトギャラリー。'],
           en:['Gallery | COMPASS HOUSE Nozawa Onsen','Photo gallery of Nozawa Onsen fields and activities.']},
  access: {ja:['アクセス・店舗情報｜COMPASS HOUSE 野沢温泉村','COMPASS HOUSE・COMPASS VILLAGE・COMPASS RENTAL BASEの住所・営業時間・地図。'],
           en:['Access | COMPASS HOUSE Nozawa Onsen','Addresses, hours and maps for our three locations.']},
  company:{ja:['会社概要｜株式会社ドリームシップ（COMPASS HOUSE）','株式会社ドリームシップの会社概要・DMO連携・採用情報。'],
           en:['Company | Dream Ship CO., Ltd. (COMPASS HOUSE)','Company profile, DMO partnership and recruitment.']},
  guide:  {ja:['初回利用ガイド｜COMPASS HOUSE 野沢温泉村','はじめての方向けのご利用の流れ・持ち物・注意事項。'],
           en:['First-timer Guide | COMPASS HOUSE Nozawa Onsen','How it works, what to bring and notes for first-time guests.']},
  contact:{ja:['お問い合わせ｜COMPASS HOUSE 野沢温泉村','ツアー・レンタル・企業タイアップ・採用のお問い合わせ。'],
           en:['Contact | COMPASS HOUSE Nozawa Onsen','Inquiries about tours, rentals, corporate tie-ups and recruitment.']},
  policy: {ja:['プライバシーポリシー｜COMPASS HOUSE','株式会社ドリームシップのプライバシーポリシー。'],
           en:['Privacy Policy | COMPASS HOUSE','Privacy policy of Dream Ship CO., Ltd.']},
  tokusho:{ja:['特定商取引法に基づく表記｜COMPASS HOUSE','特定商取引法に基づく表記。'],
           en:['Legal Notice | COMPASS HOUSE','Notice based on the Specified Commercial Transactions Act.']}
};
let CURRENT_PAGE = 'home';
function applyPageMeta(key){
  const m = PAGE_META[key] || PAGE_META.home;
  const v = isEn() ? m.en : m.ja;
  document.title = v[0];
  const d = document.querySelector('meta[name="description"]');
  if(d) d.setAttribute('content', v[1]);
}

function route(){
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathRaw, queryRaw] = raw.split('?');
  const path = (pathRaw || 'home').replace(/\/$/, '') || 'home';
  const q = new URLSearchParams(queryRaw || '');
  const key = PAGES.includes(path) ? path : 'home';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  const target = document.getElementById('p-' + key);
  if(target) target.classList.add('on');

  document.querySelectorAll('.gnav-list a').forEach(a =>
    a.classList.toggle('on', a.dataset.nav === key));

  if(key === 'company' && q.get('tab')) switchTab(q.get('tab'));
  if(key === 'contact' && q.get('type')) pickContactType(q.get('type'));

  CURRENT_PAGE = key;
  applyPageMeta(key);
  document.getElementById('drawer').classList.remove('on');
  window.scrollTo({top:0, behavior:'instant'});
  setTimeout(observeReveal, 60);
  syncHeader();
}

function switchTab(tab){
  const tabs = document.getElementById('cTabs');
  if(!tabs) return;
  const btn = tabs.querySelector('[data-tab="'+tab+'"]');
  if(!btn) return;
  tabs.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.tabp').forEach(p => { if(p.id.startsWith('tab-')) p.classList.remove('on'); });
  const pane = document.getElementById('tab-' + tab);
  if(pane) pane.classList.add('on');
}

/* ------------------------------------------------------------
   6. i18n APPLY
   ------------------------------------------------------------ */
function applyLang(lang){
  LANG = lang;
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i]').forEach(el => {
    const v = I18N[lang][el.dataset.i];
    if(v !== undefined) el.innerHTML = v;
  });
  document.querySelectorAll('.lang button').forEach(b =>
    b.classList.toggle('on', b.dataset.lang === lang));
  applyPageMeta(CURRENT_PAGE);
  renderAll();
}

function renderAll(){
  renderTours(document.getElementById('topTours'), TOURS.green.slice(0,2));
  renderTours(document.getElementById('tourList'), TOURS[TOUR_SEASON]);
  renderGear(document.getElementById('topGear'), GEAR.green.slice(0,3));
  renderGear(document.getElementById('rentalGrid'), GEAR[SIM.season]);
  renderPdfBand(SIM.season);
  renderRoutes(document.getElementById('routeGrid'));
  renderShops(document.getElementById('shopCards'));
  renderShops(document.getElementById('shopCards2'));
  renderRealStores(document.getElementById('shopStores'));
  renderShopCats(document.getElementById('shopCats'));
  renderEvents(document.getElementById('topEvents'));
  renderEvents(document.getElementById('eventGrid'));
  renderIg(document.getElementById('topIg'), 8, true);
  renderIg(document.getElementById('galleryGrid'), 12, true);
  renderAccess(document.getElementById('topAccess'), OFFICES.slice(0,1));
  renderAccess(document.getElementById('accessGrid'), OFFICES);
  renderAccess(document.getElementById('officeGrid'), OFFICES);
  renderAccess(document.getElementById('rentalMaps'), OFFICES.slice(1));
  renderContactTypes();
  renderTokusho();
  renderStatic();
  buildSim();
  bindBookButtons();
  setTimeout(observeReveal, 60);
}

/* ------------------------------------------------------------
   7. BOOKING MODAL (利用規約 → 予約)
   ------------------------------------------------------------ */
const modal = () => document.getElementById('bookModal');
let modalUrl = '#';

function bindBookButtons(){
  document.querySelectorAll('.book-btn').forEach(b => {
    b.onclick = () => openBook(b.dataset.url, b.dataset.title);
  });
}
function openBook(url, title){
  modalUrl = url;
  document.getElementById('modalTitle').textContent = title || '';
  const ag = document.getElementById('modalAgree');
  const go = document.getElementById('modalGo');
  ag.classList.remove('on');
  go.style.pointerEvents = 'none';
  go.style.opacity = '.35';
  go.removeAttribute('href');
  modal().classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeBook(){
  modal().classList.remove('on');
  document.body.style.overflow = '';
}

/* ------------------------------------------------------------
   8. REVEAL
   ------------------------------------------------------------ */
let io;
function observeReveal(){
  if(!io){
    io = new IntersectionObserver(es => {
      es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.08, rootMargin:'0px 0px -40px 0px'});
  }
  document.querySelectorAll('.page.on .rv:not(.in)').forEach(el => io.observe(el));
}

/* ------------------------------------------------------------
   9. HEADER STATE
   ------------------------------------------------------------ */
function syncHeader(){
  const hdr = document.getElementById('hdr');
  const home = document.getElementById('p-home').classList.contains('on');
  if(!home){ hdr.classList.add('solid'); return; }
  hdr.classList.toggle('solid', window.scrollY > 60);
}

/* ------------------------------------------------------------
   10. INIT
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {

  // hero season
  document.querySelectorAll('.season-sw button').forEach(b => {
    b.addEventListener('click', () => {
      const s = b.dataset.s;
      document.querySelectorAll('.season-sw button').forEach(x => x.classList.toggle('on', x.dataset.s === s));
      document.querySelectorAll('.hero-fig').forEach(f => f.classList.toggle('on', !f.dataset.s || f.dataset.s === s));
    });
  });

  // rental season tabs
  const rt = document.getElementById('rentalTabs');
  if(rt){
    rt.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        SIM.season = b.dataset.rs;
        rt.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        renderGear(document.getElementById('rentalGrid'), GEAR[SIM.season]);
        renderPdfBand(SIM.season);
        buildSim();
        setTimeout(observeReveal, 60);
      });
    });
  }

  // company tabs
  const ct = document.getElementById('cTabs');
  if(ct){
    ct.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => switchTab(b.dataset.tab)));
  }

  // qty stepper
  const qv = document.getElementById('qVal');
  const upd = () => {
    qv.textContent = SIM.qty;
    document.getElementById('qMinus').disabled = SIM.qty <= 1;
    document.getElementById('qPlus').disabled = SIM.qty >= 10;
    calcSim();
  };
  document.getElementById('qMinus').addEventListener('click', () => { if(SIM.qty>1){SIM.qty--;upd();} });
  document.getElementById('qPlus').addEventListener('click', () => { if(SIM.qty<10){SIM.qty++;upd();} });

  // drawer
  document.getElementById('burger').addEventListener('click', () =>
    document.getElementById('drawer').classList.add('on'));
  document.getElementById('drawerClose').addEventListener('click', () =>
    document.getElementById('drawer').classList.remove('on'));

  // lang
  document.querySelectorAll('.lang button').forEach(b =>
    b.addEventListener('click', () => applyLang(b.dataset.lang)));

  // modal
  document.getElementById('modalX').addEventListener('click', closeBook);
  document.getElementById('modalCancel').addEventListener('click', closeBook);
  modal().addEventListener('click', e => { if(e.target === modal()) closeBook(); });
  document.getElementById('modalAgree').addEventListener('click', function(){
    this.classList.toggle('on');
    const go = document.getElementById('modalGo');
    if(this.classList.contains('on')){
      go.style.pointerEvents = 'auto';
      go.style.opacity = '1';
      go.href = modalUrl;
      go.target = '_blank';
      go.rel = 'noopener';
    } else {
      go.style.pointerEvents = 'none';
      go.style.opacity = '.35';
      go.removeAttribute('href');
    }
  });

  // contact agree
  const ag = document.getElementById('cfAgree');
  if(ag){
    ag.addEventListener('click', function(){
      this.classList.toggle('on');
      document.getElementById('cfSubmit').disabled = !this.classList.contains('on');
    });
  }
  const sb = document.getElementById('cfSubmit');
  if(sb){
    sb.addEventListener('click', () => {
      const type = document.querySelector('#ctType .radio.on');
      const label = type ? type.textContent.trim() : '';
      alert(t(
        '【デモ】送信内容を確認しました。\n\n種別: ' + label + '\n\n本番環境では info@compasshouse.jp 宛に送信されます。',
        '[DEMO] Your submission has been received.\n\nType: ' + label + '\n\nIn production this is sent to info@compasshouse.jp.'
      ));
    });
  }

  // クイック予約（ファーストビュー導線）
  const qkState = {season:'green', service:'tour'};
  function qkUpdate(){
    const go = document.getElementById('qkGo');
    if(!go) return;
    if(qkState.service === 'tour'){
      go.setAttribute('href', '#/tour');
      TOUR_SEASON = qkState.season;
      const tt = document.getElementById('tourTabs');
      if(tt) tt.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.ts === qkState.season));
      renderTours(document.getElementById('tourList'), TOURS[qkState.season]);
      bindBookButtons();
    } else {
      go.setAttribute('href', '#/rental');
      SIM.season = qkState.season;
      const rt = document.getElementById('rentalTabs');
      if(rt) rt.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.rs === qkState.season));
      renderGear(document.getElementById('rentalGrid'), GEAR[qkState.season]);
      renderPdfBand(qkState.season);
      buildSim();
    }
  }
  [['qkSeason','season'],['qkService','service']].forEach(([id,key]) => {
    const box = document.getElementById(id);
    if(!box) return;
    box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      qkState[key] = b.dataset.v;
      box.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      qkUpdate();
    }));
  });

  // ご利用ガイド シーズンタブ
  const gt = document.getElementById('guideTabs');
  if(gt){
    gt.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const s = b.dataset.gs;
      gt.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.gs === s));
      ['green','winter'].forEach(k => {
        const pane = document.getElementById('gs-' + k);
        if(pane) pane.classList.toggle('on', k === s);
      });
    }));
  }

  // ツアー季節タブ
  const tt = document.getElementById('tourTabs');
  if(tt){
    tt.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      TOUR_SEASON = b.dataset.ts;
      tt.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.ts === TOUR_SEASON));
      renderTours(document.getElementById('tourList'), TOURS[TOUR_SEASON]);
      bindBookButtons();
      setTimeout(observeReveal, 60);
    }));
  }

  // ギャラリースライダー
  document.querySelectorAll('.ig-nav').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = document.getElementById(btn.dataset.t);
      if(!tr) return;
      const item = tr.querySelector('.ig-item');
      const step = item ? item.getBoundingClientRect().width + 8 : 240;
      tr.scrollBy({left: btn.classList.contains('next') ? step*2 : -step*2, behavior:'smooth'});
    });
  });

  // シーズン特集タブ
  const st = document.getElementById('seasonTabs');
  if(st){
    st.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const s = b.dataset.ss;
      st.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.ss === s));
      ['green','winter'].forEach(k => {
        const pane = document.getElementById('ss-' + k);
        if(pane) pane.classList.toggle('on', k === s);
      });
      setTimeout(observeReveal, 60);
    }));
  }

  // scroll
  window.addEventListener('scroll', syncHeader, {passive:true});
  window.addEventListener('hashchange', route);

  applyLang('ja');
  route();

  console.log('%cCOMPASS HOUSE', 'color:#820c00;font-family:"Roboto Condensed",sans-serif;font-size:26px;font-weight:700;letter-spacing:.1em');
  console.log('%cRenewal Demo — Nozawa Onsen', 'color:#231815;font-size:12px;letter-spacing:.15em');
});
