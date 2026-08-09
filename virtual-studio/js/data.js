/* =========================================================
 * Virtual Studio — 撮影技法ナレッジベース
 * 座標系: スタジオ俯瞰図 1000 x 700 (SVG units)。
 *   被写体の基準位置 (500, 330) / カメラ基準位置 (500, 600)。
 *   height(cm) はスタジオ床からの機材高さ。
 * このファイルがプロダクトの「知識」の中核。
 * 将来的には md ナレッジ (docs/knowledge/) から生成する。
 * ======================================================= */

const SUBJECT_POS = { x: 500, y: 330 };
const CAMERA_POS = { x: 500, y: 600 };

/* ---------- 機材タイプ定義 ---------- */
const EQUIP_TYPES = {
  subject:   { label: "被写体",        color: "#e8eaf0", shape: "subject" },
  camera:    { label: "カメラ",        color: "#4da3ff", shape: "camera" },
  key:       { label: "キーライト",    color: "#ffb547", shape: "light" },
  fill:      { label: "フィルライト",  color: "#ffd98a", shape: "light" },
  back:      { label: "バックライト",  color: "#ff8ad2", shape: "light" },
  rim:       { label: "リムライト",    color: "#ff8ad2", shape: "light" },
  top:       { label: "トップライト",  color: "#c9a0ff", shape: "light" },
  bg:        { label: "背景ライト",    color: "#7fe0c3", shape: "light" },
  hmi:       { label: "HMI(太陽光風)", color: "#fff3c4", shape: "light" },
  practical: { label: "プラクティカル", color: "#ffc9a0", shape: "light" },
  reflector: { label: "レフ板",        color: "#dddddd", shape: "panel" },
  flag:      { label: "フラッグ(黒)",  color: "#555c6b", shape: "panel" },
  diff:      { label: "ディフューザー", color: "#aftfff", shape: "panel" },
  drone:     { label: "ドローン",      color: "#7fd4ff", shape: "drone" },
  sun:       { label: "太陽(自然光)",  color: "#ffe680", shape: "sun" },
  fan:       { label: "送風機",        color: "#9aa3b5", shape: "panel" },
  smoke:     { label: "スモークマシン", color: "#9aa3b5", shape: "panel" },
};
// panel の色 typo 修正
EQUIP_TYPES.diff.color = "#a0e8ff";

/* ---------- モディファイア ---------- */
const MODIFIERS = [
  "なし(直射)", "ソフトボックス60cm", "ソフトボックス120cm", "オクタボックス150cm",
  "アンブレラ(透過)", "アンブレラ(反射)", "ビューティーディッシュ", "グリッド30°",
  "グリッド10°", "スヌート", "バーンドア", "ディフュージョン#216", "ディフュージョン#250",
  "ブックライト", "ストリップボックス30x120", "フレネル", "CTOフィルター", "CTBフィルター",
];

/* ---------- カットサイズ ---------- */
const SHOT_SIZES = [
  { id: "ECU", label: "超クローズアップ (ECU)", scale: 3.2, en: "extreme close-up" },
  { id: "CU",  label: "クローズアップ (CU)",    scale: 2.2, en: "close-up" },
  { id: "BS",  label: "バストショット (BS)",    scale: 1.5, en: "medium close-up (bust shot)" },
  { id: "WS",  label: "ウエストショット (WS)",  scale: 1.15, en: "medium shot (waist up)" },
  { id: "KS",  label: "ニーショット (KS)",      scale: 0.9, en: "medium full shot (knee up)" },
  { id: "FF",  label: "フルフィギュア (FF)",    scale: 0.7, en: "full shot" },
  { id: "LS",  label: "ロングショット (LS)",    scale: 0.45, en: "long shot" },
  { id: "ELS", label: "超ロングショット (ELS)", scale: 0.25, en: "extreme long shot / establishing shot" },
];

/* ---------- カメラアングル ---------- */
const CAM_ANGLES = [
  { id: "eye",   label: "アイレベル",        en: "eye-level angle" },
  { id: "high",  label: "ハイアングル",      en: "high angle, looking down" },
  { id: "low",   label: "ローアングル(アオリ)", en: "low angle, looking up" },
  { id: "birds", label: "俯瞰(真上)",        en: "top-down bird's-eye view" },
  { id: "dutch", label: "ダッチアングル(傾け)", en: "dutch angle, tilted horizon" },
  { id: "ots",   label: "肩越し(OTS)",       en: "over-the-shoulder shot" },
];

/* ---------- カメラワーク ---------- */
const CAM_MOVES = [
  { id: "fix",      label: "フィックス(固定)",     en: "static locked-off shot on tripod" },
  { id: "pan",      label: "パン",                 en: "smooth horizontal pan" },
  { id: "tilt",     label: "ティルト",             en: "smooth vertical tilt" },
  { id: "dollyin",  label: "ドリーイン",           en: "slow dolly-in, pushing toward the subject" },
  { id: "dollyout", label: "ドリーアウト",         en: "slow dolly-out, pulling away from the subject" },
  { id: "track",    label: "トラック(横移動)",     en: "lateral tracking shot" },
  { id: "crane",    label: "クレーン/ジブ",        en: "crane shot, rising vertically" },
  { id: "handheld", label: "手持ち",               en: "handheld camera with subtle natural shake" },
  { id: "gimbal",   label: "ジンバル(浮遊移動)",   en: "smooth floating gimbal movement" },
  { id: "zoomin",   label: "ズームイン",           en: "slow zoom-in" },
  { id: "dollyzoom",label: "ドリーズーム(めまい)", en: "dolly zoom (vertigo effect)" },
  { id: "orbit",    label: "オービット(回り込み)", en: "360-degree orbit around the subject" },
  { id: "d_orbit",  label: "ドローン: オービット", en: "aerial drone orbit circling the subject" },
  { id: "d_reveal", label: "ドローン: リビール",   en: "drone reveal shot, rising over an obstacle to reveal the scene" },
  { id: "d_flyover",label: "ドローン: フライオーバー", en: "drone flyover, passing directly above the subject" },
  { id: "d_chase",  label: "ドローン: 追跡",       en: "FPV drone chase shot following the subject at speed" },
  { id: "d_topdown",label: "ドローン: 真俯瞰上昇", en: "drone top-down shot slowly ascending" },
];

/* ---------- レンズ ---------- */
const LENSES = [
  { id: "14", label: "14mm 超広角", en: "14mm ultra-wide lens, dramatic perspective" },
  { id: "24", label: "24mm 広角",   en: "24mm wide-angle lens" },
  { id: "35", label: "35mm",        en: "35mm lens, natural field of view" },
  { id: "50", label: "50mm 標準",   en: "50mm standard lens" },
  { id: "85", label: "85mm 中望遠", en: "85mm portrait lens, compressed background" },
  { id: "100m", label: "100mm マクロ", en: "100mm macro lens, extreme detail" },
  { id: "135", label: "135mm 望遠", en: "135mm telephoto lens, strong compression" },
  { id: "anam", label: "アナモルフィック 2x", en: "2x anamorphic lens, oval bokeh and horizontal flares" },
];

/* ---------- 被写体タイプ ---------- */
const SUBJECT_TYPES = [
  { id: "person",  label: "人物",             en: "a person" },
  { id: "bottle",  label: "ボトル/飲料",      en: "a glass beverage bottle" },
  { id: "cosme",   label: "コスメ/小物",      en: "a cosmetic product" },
  { id: "food",    label: "料理/フード",      en: "a gourmet dish" },
  { id: "car",     label: "自動車",           en: "a car" },
  { id: "arch",    label: "建築/ロケーション", en: "a building / location" },
];

/* ---------- 演出オプション ---------- */
const SHOT_OPTIONS = [
  { id: "droplets", label: "雫・結露 (シズル)", en: "covered in fresh water droplets and condensation",
    note: "グリセリン1:1水溶液を霧吹きで付与。撮影直前にリタッチ。冷感・鮮度の訴求に必須。" },
  { id: "gloss", label: "光沢・グロス強調", en: "glossy specular highlights running along the edges",
    note: "ストリップボックスをエッジに正対させ、面で細い写り込みを作る。黒カードで締めるとエッジが立つ。" },
  { id: "matte", label: "マット・反射抑制", en: "soft matte finish with controlled reflections",
    note: "偏光(PL)フィルター+ディフューズ大面積。テカリを抑え質感を出す。" },
  { id: "steam", label: "湯気・スチーム", en: "rising steam backlit by a rim light",
    note: "湯気は逆光でのみ写る。背景を暗く落とし、バックライトで抜く。" },
  { id: "haze", label: "ヘイズ・空気感", en: "atmospheric haze catching the light beams",
    note: "ヘイザーで薄く焚き、光線(ゴッドレイ)を可視化。ライトの立体感が増す。" },
  { id: "wind", label: "風・なびき", en: "hair and fabric flowing in the wind",
    note: "送風機を斜め前45°から。強さは3段階でテスト。" },
  { id: "splash", label: "スプラッシュ・液体", en: "dynamic liquid splash frozen in motion",
    note: "ハイスピード撮影(1/8000相当 or 1000fps)。ストロボ閃光時間で止める。" },
  { id: "bokeh", label: "前ボケ・玉ボケ", en: "foreground bokeh and sparkling background bokeh lights",
    note: "背景2m以上離しLEDフェアリーライト。開放F値で玉ボケ化。前ボケは小物をレンズ直前に。" },
  { id: "lensflare", label: "レンズフレア", en: "cinematic lens flare entering the frame",
    note: "光源をフレームエッジぎりぎりに配置。アナモレンズで横フレア。" },
  { id: "silhouette", label: "シルエット", en: "subject in full silhouette against a bright background",
    note: "背景のみ露出を合わせ、被写体前面は無灯火。輪郭で語る。" },
];

/* =========================================================
 * 撮影技法プリセット
 * mode: video | still | outdoor (複数可)
 * ======================================================= */
const PRESETS = [
  /* ===== ライティング: 人物 ===== */
  {
    id: "three-point", modes: ["video", "still"], group: "人物ライティング",
    name: "三点照明 (スタンダード)",
    desc: "キー・フィル・バックの基本形。あらゆる人物撮影の出発点。キーを45°上方から当て、フィルで影を起こし、バックで輪郭を分離する。",
    tags: ["基本", "インタビュー", "人物"],
    subjectType: "person", bgStyle: "dark",
    look: "立体感がありつつ自然。影は柔らかく、髪と肩に細いエッジライトが乗り背景から分離される。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F2.8", shutter: "1/50", iso: "800", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key",  x: 350, y: 480, height: 220, power: 70, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "fill", x: 660, y: 500, height: 160, power: 30, colorTemp: 5600, modifier: "アンブレラ(透過)" },
      { type: "back", x: 620, y: 160, height: 250, power: 50, colorTemp: 5600, modifier: "グリッド30°" },
    ],
  },
  {
    id: "rembrandt", modes: ["video", "still"], group: "人物ライティング",
    name: "レンブラントライト",
    desc: "キーを45°横・45°上から。影側の頬に逆三角形のハイライトを作る古典肖像画のライティング。ドラマチックで彫りの深い印象。",
    tags: ["ドラマチック", "ポートレート", "ローキー"],
    subjectType: "person", bgStyle: "dark",
    look: "顔の半分が影に落ち、影側の頬に三角形の光。目にキャッチライト。重厚で映画的。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "85", aperture: "F2.0", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key",  x: 300, y: 420, height: 230, power: 80, colorTemp: 5600, modifier: "ソフトボックス60cm" },
      { type: "flag", x: 680, y: 420, height: 150, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "back", x: 680, y: 170, height: 240, power: 35, colorTemp: 5600, modifier: "スヌート" },
    ],
  },
  {
    id: "butterfly", modes: ["video", "still"], group: "人物ライティング",
    name: "バタフライ (パラマウント)",
    desc: "キーをカメラ真上・高めから正面に。鼻下に蝶形の影。頬骨を強調しビューティー/グラマー撮影の定番。あご下にレフで影を起こす。",
    tags: ["ビューティー", "正面", "ハイキー"],
    subjectType: "person", bgStyle: "gradient",
    look: "正面からの均一で華やかな光。肌が美しく、鼻下に小さな蝶形の影。目に大きなキャッチライト。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F4", shutter: "1/125", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 500, y: 500, height: 260, power: 75, colorTemp: 5500, modifier: "ビューティーディッシュ" },
      { type: "reflector", x: 500, y: 430, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "bg", x: 300, y: 130, height: 100, power: 40, colorTemp: 5500, modifier: "なし(直射)" },
    ],
  },
  {
    id: "split", modes: ["video", "still"], group: "人物ライティング",
    name: "スプリットライト",
    desc: "真横90°からのキーで顔を明暗半分に割る。緊張感・二面性・葛藤の表現。フィルは使わないか極少量。",
    tags: ["ドラマチック", "サスペンス", "ローキー"],
    subjectType: "person", bgStyle: "dark",
    look: "顔の左右が光と闇に二分される。強いコントラスト。心理的緊張を演出。",
    camera: { shotSize: "CU", angle: "eye", move: "dollyin", lens: "50", aperture: "F2.8", shutter: "1/50", iso: "800", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key",  x: 220, y: 330, height: 170, power: 85, colorTemp: 5600, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 760, y: 330, height: 170, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "backlight-silhouette", modes: ["video", "still"], group: "人物ライティング",
    name: "逆光シルエット",
    desc: "被写体の背後のみを照らし、輪郭だけで見せる。背景に明るい面(白ホリ・夕景)を作り、前面は無灯火。ヘイズで光条を可視化するとより映画的。",
    tags: ["シルエット", "エモーショナル", "逆光"],
    subjectType: "person", bgStyle: "bright",
    look: "人物は完全な黒いシルエット。背景は明るく、輪郭に細い光のエッジ。",
    camera: { shotSize: "FF", angle: "low", move: "fix", lens: "35", aperture: "F5.6", shutter: "1/50", iso: "200", fps: "24fps", wb: "5600K" },
    items: [
      { type: "bg",  x: 350, y: 110, height: 150, power: 100, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "bg",  x: 650, y: 110, height: 150, power: 100, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "rim", x: 500, y: 130, height: 260, power: 60, colorTemp: 5600, modifier: "グリッド10°" },
    ],
  },
  {
    id: "highkey", modes: ["video", "still"], group: "人物ライティング",
    name: "ハイキー",
    desc: "全体を明るく、影を最小化。白背景を2灯で被写体より+1EV明るく飛ばし、正面から大光面のキー。清潔感・ポップ・コマーシャル向け。",
    tags: ["明るい", "CM", "白背景"],
    subjectType: "person", bgStyle: "white",
    look: "影のほとんどない明るく清潔な画。白背景は完全な白に飛ぶ。",
    camera: { shotSize: "WS", angle: "eye", move: "fix", lens: "50", aperture: "F5.6", shutter: "1/125", iso: "100", fps: "30fps", wb: "5500K" },
    items: [
      { type: "key",  x: 400, y: 520, height: 220, power: 60, colorTemp: 5500, modifier: "オクタボックス150cm" },
      { type: "fill", x: 620, y: 520, height: 180, power: 45, colorTemp: 5500, modifier: "アンブレラ(透過)" },
      { type: "bg",   x: 280, y: 140, height: 120, power: 100, colorTemp: 5500, modifier: "アンブレラ(反射)" },
      { type: "bg",   x: 720, y: 140, height: 120, power: 100, colorTemp: 5500, modifier: "アンブレラ(反射)" },
    ],
  },
  {
    id: "lowkey-noir", modes: ["video", "still"], group: "人物ライティング",
    name: "ローキー / フィルムノワール",
    desc: "闇を基調に、硬い光を一方向から。ブラインド影やスモークと相性が良い。黒フラッグで漏れ光を徹底的に切る。",
    tags: ["ノワール", "ドラマチック", "闇"],
    subjectType: "person", bgStyle: "black",
    look: "画面の大部分が黒。硬い光が顔の一部だけを照らし、深い陰影と緊張感。",
    camera: { shotSize: "BS", angle: "low", move: "fix", lens: "35", aperture: "F4", shutter: "1/50", iso: "800", fps: "24fps", wb: "4300K" },
    items: [
      { type: "key",  x: 280, y: 250, height: 260, power: 90, colorTemp: 4300, modifier: "フレネル" },
      { type: "flag", x: 400, y: 460, height: 150, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "rim",  x: 700, y: 150, height: 250, power: 40, colorTemp: 4300, modifier: "スヌート" },
    ],
  },
  {
    id: "window-interview", modes: ["video"], group: "人物ライティング",
    name: "インタビュー (ウィンドウライト風)",
    desc: "大型ソフトボックス(またはブックライト)を窓光に見立てて斜め45°から。反対側にネガティブフィル(黒)でコントラストを整える。2カメ想定。",
    tags: ["インタビュー", "ドキュメンタリー", "自然"],
    subjectType: "person", bgStyle: "gradient",
    look: "柔らかな窓光のような自然な立体感。背景は暗めに落ち、プラクティカルの玉ボケ。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F2.0", shutter: "1/50", iso: "640", fps: "24fps", wb: "5000K" },
    items: [
      { type: "key",  x: 300, y: 470, height: 200, power: 65, colorTemp: 5200, modifier: "ブックライト" },
      { type: "flag", x: 700, y: 430, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "back", x: 660, y: 150, height: 230, power: 35, colorTemp: 4300, modifier: "グリッド30°" },
      { type: "practical", x: 800, y: 200, height: 120, power: 20, colorTemp: 3200, modifier: "なし(直射)" },
    ],
  },

  /* ===== 商品 / スチール ===== */
  {
    id: "product-gradation", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "ボトル: グラデーションライティング",
    desc: "乳白アクリル越しにストリップボックスを背面斜めから当て、ボトル側面に美しい縦グラデーションの写り込みを作る。黒カードでエッジを締める。飲料・酒類の定番。",
    tags: ["ボトル", "グラデーション", "写り込み"],
    subjectType: "bottle", bgStyle: "dark",
    look: "ボトルの側面に滑らかな明→暗のグラデーション。エッジは黒く締まり、ラベルは均一光。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F11", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key",  x: 340, y: 180, height: 90, power: 70, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim",  x: 660, y: 180, height: 90, power: 55, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 330, y: 430, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 670, y: 430, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "fill", x: 500, y: 520, height: 70, power: 25, colorTemp: 5500, modifier: "ディフュージョン#216" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "product-transmission", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "グラス/液体: 透過ライティング",
    desc: "被写体の真後ろから乳白ディフューザー越しに光を当て、液体の透明感と色を最大化する。手前は黒締めで輪郭を出す。飲料の「抜け感」表現。",
    tags: ["透過光", "液体", "透明感"],
    subjectType: "bottle", bgStyle: "bright",
    look: "液体が内側から発光するように透け、色が鮮やかに出る。輪郭は黒く締まる。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F8", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",   x: 500, y: 150, height: 80, power: 100, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "flag", x: 340, y: 340, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 660, y: 340, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "top",  x: 500, y: 260, height: 160, power: 30, colorTemp: 5500, modifier: "グリッド30°" },
    ],
    defaultOptions: ["droplets"],
  },
  {
    id: "product-sizzle", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "シズル: 雫・スプラッシュ",
    desc: "冷えた飲料の結露・水滴・スプラッシュを高速シャッター(または閃光時間の短いストロボ)で凍結。バックライトで雫を輝かせる。",
    tags: ["シズル", "雫", "ハイスピード"],
    subjectType: "bottle", bgStyle: "dark",
    look: "雫の一粒一粒が逆光で輝く。スプラッシュは空中で静止し、液体の躍動感が伝わる。",
    camera: { shotSize: "CU", angle: "low", move: "fix", lens: "100m", aperture: "F11", shutter: "1/8000", iso: "200", fps: "1000fps(HS)", wb: "5500K" },
    items: [
      { type: "back", x: 380, y: 150, height: 120, power: 90, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "back", x: 620, y: 150, height: 120, power: 90, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "fill", x: 500, y: 540, height: 80, power: 20, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "flag", x: 500, y: 120, height: 100, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["droplets", "splash"],
  },
  {
    id: "cosme-beauty", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "コスメ: クリーンビューティー",
    desc: "大面積の柔らかい光でパッケージの質感を出しつつ、ストリップの写り込みで高級感を演出。白〜淡グラデ背景。アクリル台で映り込みを作る。",
    tags: ["コスメ", "クリーン", "高級感"],
    subjectType: "cosme", bgStyle: "white",
    look: "clean & luxury。淡い背景に浮かぶ商品、天面に柔らかいハイライト、下面に美しい鏡面反射。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F13", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "top",  x: 500, y: 250, height: 180, power: 65, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "key",  x: 330, y: 220, height: 80, power: 45, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "reflector", x: 670, y: 300, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "bg",   x: 500, y: 120, height: 90, power: 80, colorTemp: 5500, modifier: "ディフュージョン#216" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "food-sizzle", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "フード: 半逆光シズル",
    desc: "料理撮影の鉄則=半逆光。斜め後ろ45°からのキーで照り・ツヤ・湯気を出し、手前はレフで起こす。トップ気味に振ると立体感が増す。",
    tags: ["フード", "半逆光", "湯気"],
    subjectType: "food", bgStyle: "dark",
    look: "料理の表面に艶のハイライト、湯気が逆光に浮かぶ。手前の影はレフで柔らかく起こされ食欲を誘う。",
    camera: { shotSize: "CU", angle: "high", move: "fix", lens: "100m", aperture: "F5.6", shutter: "1/125", iso: "200", fps: "-", wb: "5000K" },
    items: [
      { type: "key", x: 630, y: 170, height: 140, power: 75, colorTemp: 5200, modifier: "ソフトボックス120cm" },
      { type: "reflector", x: 400, y: 520, height: 40, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 750, y: 330, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["steam", "gloss"],
  },
  {
    id: "car-studio", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "自動車: スタジオリフレクション",
    desc: "巨大オーバーヘッドの面光源(スカイパネル+シルク)をボディに写り込ませ、一本の美しいハイライトラインを作る。黒ホリで余計な写り込みを排除。",
    tags: ["自動車", "写り込み", "大規模"],
    subjectType: "car", bgStyle: "black",
    look: "ボディサイドに天井光源の細長い写り込みが一本走る。黒背景にボディラインが浮かぶ。",
    camera: { shotSize: "FF", angle: "low", move: "track", lens: "35", aperture: "F8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "top", x: 400, y: 280, height: 400, power: 90, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "top", x: 600, y: 280, height: 400, power: 90, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "rim", x: 250, y: 150, height: 150, power: 45, colorTemp: 5600, modifier: "フレネル" },
      { type: "flag", x: 500, y: 560, height: 200, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss"],
  },

  /* ===== 屋外 / ドローン ===== */
  {
    id: "golden-hour", modes: ["outdoor"], group: "屋外撮影",
    name: "ゴールデンアワー + レフ起こし",
    desc: "日没前後1時間の低い太陽を半逆光に置き、銀レフ or HMIで顔を起こす。髪に金色のリム。マジックアワーへの移行も計画に含める。",
    tags: ["夕景", "自然光", "エモーショナル"],
    subjectType: "person", bgStyle: "sunset",
    look: "金色の逆光が髪と輪郭を縁取り、肌は柔らかいレフの光。長い影とオレンジの空気感。",
    camera: { shotSize: "BS", angle: "eye", move: "gimbal", lens: "85", aperture: "F2.0", shutter: "1/100", iso: "100", fps: "24fps", wb: "5600K→4500K" },
    items: [
      { type: "sun", x: 620, y: 100, height: 800, power: 100, colorTemp: 3200, modifier: "なし(直射)" },
      { type: "reflector", x: 380, y: 500, height: 120, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "hmi", x: 300, y: 480, height: 200, power: 40, colorTemp: 5600, modifier: "ディフュージョン#250" },
    ],
    defaultOptions: ["lensflare"],
  },
  {
    id: "overcast-diffuse", modes: ["outdoor"], group: "屋外撮影",
    name: "曇天 / オープンシェード",
    desc: "曇天や日陰の均一光を活かす。上からの平板な光にならないよう、黒フラッグで頭上を切り、白レフで目線方向から起こして立体感を作る。",
    tags: ["曇天", "自然光", "ナチュラル"],
    subjectType: "person", bgStyle: "gradient",
    look: "柔らかく色再現の良い光。フラッグとレフで方向性を持たせ、のっぺりしない自然な立体感。",
    camera: { shotSize: "WS", angle: "eye", move: "handheld", lens: "35", aperture: "F2.8", shutter: "1/100", iso: "200", fps: "24fps", wb: "6500K" },
    items: [
      { type: "flag", x: 500, y: 240, height: 260, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "reflector", x: 360, y: 480, height: 130, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "night-street", modes: ["outdoor", "video"], group: "屋外撮影",
    name: "ナイトストリート / ネオン",
    desc: "街灯・ネオン・ショーウィンドウをプラクティカルとして活かし、LEDチューブ(色付き)で顔にアクセント。ヘイズ+濡れた路面で光を倍増させる。",
    tags: ["夜景", "ネオン", "シネマティック"],
    subjectType: "person", bgStyle: "night",
    look: "シアン/マゼンタのネオンが顔を染め、濡れた路面に光が反射。玉ボケの街明かり。",
    camera: { shotSize: "BS", angle: "eye", move: "gimbal", lens: "50", aperture: "F1.4", shutter: "1/50", iso: "1600", fps: "24fps", wb: "3800K" },
    items: [
      { type: "key", x: 340, y: 430, height: 180, power: 50, colorTemp: 4500, modifier: "ディフュージョン#216" },
      { type: "practical", x: 250, y: 180, height: 300, power: 60, colorTemp: 2800, modifier: "なし(直射)" },
      { type: "practical", x: 720, y: 200, height: 250, power: 60, colorTemp: 8000, modifier: "なし(直射)" },
      { type: "rim", x: 650, y: 130, height: 220, power: 45, colorTemp: 8000, modifier: "なし(直射)" },
    ],
    defaultOptions: ["haze", "bokeh"],
  },
  {
    id: "drone-orbit", modes: ["outdoor"], group: "ドローン",
    name: "ドローン: オービット (回り込み)",
    desc: "被写体を中心に半径を保って円軌道。高度とジンバル角を一定に保ち、背景が流れて被写体が主役に。速度は10-15秒/周が基準。",
    tags: ["ドローン", "オービット", "ダイナミック"],
    subjectType: "person", bgStyle: "sky",
    look: "被写体を中心に世界が回る。背景の風景が滑らかに流れ、スケール感と主役感を両立。",
    camera: { shotSize: "FF", angle: "high", move: "d_orbit", lens: "24", aperture: "F2.8", shutter: "1/50", iso: "100", fps: "30fps", wb: "5600K" },
    items: [
      { type: "drone", x: 340, y: 200, height: 1000, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 700, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-reveal", modes: ["outdoor"], group: "ドローン",
    name: "ドローン: リビール (上昇開示)",
    desc: "手前の障害物(木・建物・崖)越しに低空から上昇し、隠れていた壮大な景色を開示する。動画の冒頭カットの定番。前進+上昇+ティルトダウン→アップの複合操作。",
    tags: ["ドローン", "リビール", "オープニング"],
    subjectType: "arch", bgStyle: "sky",
    look: "閉じた画から一気に世界が開ける快感。スケールの落差がドラマを生む。",
    camera: { shotSize: "ELS", angle: "high", move: "d_reveal", lens: "24", aperture: "F4", shutter: "1/60", iso: "100", fps: "30fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 520, height: 300, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 300, y: 90, height: 3000, power: 100, colorTemp: 5000, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-fpv-chase", modes: ["outdoor"], group: "ドローン",
    name: "ドローン: FPV追跡",
    desc: "FPV機で走る被写体(車・人・バイク)を低空高速追跡。障害物ギリギリを抜けるダイブやフリップで没入感を演出。安全マージンとロケハン必須。",
    tags: ["FPV", "スピード", "没入感"],
    subjectType: "car", bgStyle: "sky",
    look: "地面すれすれの疾走感。被写体に食らいつくカメラ、流れる背景、ダイナミックな機動。",
    camera: { shotSize: "FF", angle: "low", move: "d_chase", lens: "14", aperture: "F2.8", shutter: "1/120", iso: "200", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 560, height: 150, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 650, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
];

/* ---------- 背景スタイル (プレビュー描画用) ---------- */
const BG_STYLES = {
  dark:     { top: "#2a2e38", bottom: "#14161b", en: "dark gradient studio background" },
  black:    { top: "#0a0a0c", bottom: "#000000", en: "pitch black background" },
  white:    { top: "#ffffff", bottom: "#e8e8ec", en: "pure white seamless background" },
  gradient: { top: "#5a6478", bottom: "#232834", en: "soft gray gradient background" },
  bright:   { top: "#f5f0e6", bottom: "#d8d0c0", en: "bright glowing backdrop" },
  sunset:   { top: "#ff9a56", bottom: "#5b3a6e", en: "golden hour sunset sky" },
  night:    { top: "#1a1035", bottom: "#0a0618", en: "neon-lit night city street" },
  sky:      { top: "#7db8e8", bottom: "#cfe8f5", en: "wide open sky and landscape" },
};
