/* =========================================================
 * Virtual Studio — 撮影技法ナレッジベース
 * 座標系: スタジオ俯瞰図 1000 x 700 (SVG units)。
 *   被写体の基準位置 (500, 330) / カメラ基準位置 (500, 600)。
 *   height(cm) はスタジオ床からの機材高さ。100px = 1m。
 * このファイルがプロダクトの「知識」の中核。
 * 将来的には md ナレッジ (docs/knowledge/) から生成する。
 * ======================================================= */

const SUBJECT_POS = { x: 500, y: 330 };
const CAMERA_POS = { x: 500, y: 600 };

/* ---------- 機材タイプ定義 ---------- */
const EQUIP_TYPES = {
  subject:   { label: "被写体",        color: "#5a6478", shape: "subject" },
  camera:    { label: "カメラ",        color: "#2f7fe0", shape: "camera" },
  key:       { label: "キーライト",    color: "#e8920a", shape: "light" },
  fill:      { label: "フィルライト",  color: "#d9ae4e", shape: "light" },
  back:      { label: "バックライト",  color: "#d4569e", shape: "light" },
  rim:       { label: "リムライト",    color: "#d4569e", shape: "light" },
  top:       { label: "トップライト",  color: "#9a6ae0", shape: "light" },
  bg:        { label: "背景ライト",    color: "#2aa87e", shape: "light" },
  hmi:       { label: "HMI(太陽光風)", color: "#c9a92c", shape: "light" },
  practical: { label: "プラクティカル", color: "#d98a4e", shape: "light" },
  reflector: { label: "レフ板",        color: "#e8e8e8", shape: "panel" },
  flag:      { label: "フラッグ(黒)",  color: "#4a505e", shape: "panel" },
  diff:      { label: "ディフューザー", color: "#8ec8e8", shape: "panel" },
  drone:     { label: "ドローン",      color: "#2a9ed8", shape: "drone" },
  sun:       { label: "太陽(自然光)",  color: "#e8c220", shape: "sun" },
  /* --- 特効 (SFX) --- */
  fan:       { label: "送風機",        color: "#8a90a0", shape: "panel" },
  smoke:     { label: "スモークマシン", color: "#8a90a0", shape: "panel" },
  rainmachine:{ label: "レインマシン", color: "#4aa8d8", shape: "panel" },
  snowmachine:{ label: "スノーマシン", color: "#b8d8e8", shape: "panel" },
  confetti:  { label: "紙吹雪キャノン", color: "#d4569e", shape: "panel" },
  pyro:      { label: "特効: 爆発ポイント", color: "#e05a2a", shape: "sfx" },
  spark:     { label: "特効: スパークマシン", color: "#e0b02a", shape: "sfx" },
  /* --- 車両・ロジスティクス --- */
  truck:     { label: "機材車",        color: "#8a90a0", shape: "vehicle" },
  genny:     { label: "発電車",        color: "#c9a92c", shape: "vehicle" },
  locabus:   { label: "ロケバス",      color: "#7fb0d0", shape: "vehicle" },
  cranetruck:{ label: "クレーン車",    color: "#d98a4e", shape: "vehicle" },
  village:   { label: "モニター(ビレッジ)", color: "#9a6ae0", shape: "panel" },
  sound:     { label: "音声(ブームポジション)", color: "#2aa87e", shape: "panel" },
};

/* ---------- モディファイア ---------- */
const MODIFIERS = [
  "なし(直射)", "ソフトボックス60cm", "ソフトボックス120cm", "オクタボックス150cm",
  "アンブレラ(透過)", "アンブレラ(反射)", "ビューティーディッシュ", "パラボリックリフレクター",
  "グリッド30°", "グリッド10°", "スヌート", "バーンドア", "フレネル", "リングライト",
  "ディフュージョン#216", "ディフュージョン#250", "ブックライト", "ストリップボックス30x120",
  "ライトテント(乳白)", "12x12シルク(頭上)", "CTOフィルター", "CTBフィルター",
  "カラージェル(マゼンタ)", "カラージェル(シアン)", "カラージェル(アンバー)",
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
  { id: "whip",     label: "ウィップパン",         en: "fast whip pan with motion blur" },
  { id: "tilt",     label: "ティルト",             en: "smooth vertical tilt" },
  { id: "pedestal", label: "ペデスタル(垂直移動)", en: "vertical pedestal move keeping the framing level" },
  { id: "dollyin",  label: "ドリーイン",           en: "slow dolly-in, pushing toward the subject" },
  { id: "dollyout", label: "ドリーアウト",         en: "slow dolly-out, pulling away from the subject" },
  { id: "track",    label: "トラック(横移動)",     en: "lateral tracking shot" },
  { id: "arc",      label: "アーク(弧移動)",       en: "arcing camera move partially around the subject" },
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
  { id: "d_side",   label: "ドローン: 並走トラッキング", en: "aerial side tracking shot flying parallel to the subject" },
  { id: "d_pullback",label: "ドローン: プルバック", en: "slow aerial pull-back, flying backward to reveal the wider scene" },
  { id: "d_dronie", label: "ドローン: ドローニー", en: "dronie shot, pulling back and rising away from the subject" },
  { id: "d_spiral", label: "ドローン: スパイラル上昇", en: "spiral drone shot, orbiting while steadily ascending" },
  { id: "d_lowpass",label: "ドローン: ローパス",   en: "low-altitude drone pass skimming just above the surface" },
  { id: "d_dive",   label: "ドローン: ダイブ(急降下)", en: "FPV drone dive plunging vertically along the structure" },
  { id: "d_dzoom",  label: "ドローン: ドリーズーム", en: "aerial dolly zoom, flying backward while zooming in (vertigo effect)" },
  { id: "d_lead",   label: "ドローン: リード (前方後退)", en: "aerial lead shot, flying backward in front of the moving subject" },
  { id: "d_gap",    label: "ドローン: FPVギャップ (狭所通過)", en: "FPV drone threading through a narrow gap" },
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

/* ---------- カメラボディ ---------- */
const CAMERA_BODIES = [
  { id: "cine",       label: "シネマカメラ (フルサイズ)", en: "full-frame cinema camera" },
  { id: "mirrorless", label: "ミラーレス一眼",           en: "mirrorless camera" },
  { id: "highspeed",  label: "ハイスピードカメラ",       en: "high-speed camera, ultra slow motion" },
  { id: "broadcast",  label: "放送用ENGカメラ",          en: "broadcast ENG camera" },
  { id: "action",     label: "アクションカム",           en: "rugged action camera, ultra-wide POV" },
  { id: "pov_ear",    label: "ウェアラブルPOV (耳掛けCCD)", en: "ear-mounted micro POV camera, true first-person view" },
  { id: "fpv",        label: "FPVドローンカメラ",        en: "FPV drone camera" },
  { id: "cam360",     label: "360°カメラ",               en: "360-degree camera" },
  { id: "phone",      label: "スマートフォン",           en: "smartphone camera footage" },
  { id: "medium",     label: "中判デジタル (スチール)",   en: "medium format digital camera, exceptional detail" },
];

/* ---------- カメラサポート (支持機材) ---------- */
const CAMERA_SUPPORTS = [
  { id: "tripod",     label: "三脚",                    en: "locked off on a tripod", param: { label: "高さ", min: 20, max: 220, unit: "cm", def: 140 } },
  { id: "highhat",    label: "ハイハット (地面すれすれ)", en: "ground-level hi-hat rig", param: { label: "高さ", min: 5, max: 40, unit: "cm", def: 15 } },
  { id: "ladder",     label: "脚立 (俯瞰ポジション)",    en: "elevated angle shot from a stepladder", param: { label: "高さ", min: 150, max: 400, unit: "cm", def: 250 } },
  { id: "intore",     label: "イントレ (足場櫓)",        en: "high vantage point from scaffolding", param: { label: "高さ", min: 200, max: 800, unit: "cm", def: 400 } },
  { id: "slider",     label: "スライダー (平行移動レール)", en: "smooth short slider move", param: { label: "レール長", min: 40, max: 200, unit: "cm", def: 100 } },
  { id: "dolly",      label: "ドリー (レール)",          en: "dolly rolling on tracks", param: { label: "レール長", min: 2, max: 20, unit: "m", def: 6 } },
  { id: "crane",      label: "クレーン / ジブ",          en: "sweeping crane arm move", param: { label: "アーム長", min: 2, max: 15, unit: "m", def: 6 } },
  { id: "technocrane",label: "テクノクレーン+リモートヘッド", en: "telescopic techno-crane with a remote head", param: { label: "アーム長", min: 4, max: 15, unit: "m", def: 10 } },
  { id: "steadicam",  label: "ステディカム (平衡機)",     en: "smooth gliding steadicam", param: null },
  { id: "gimbal",     label: "3軸ジンバル",              en: "floating 3-axis gimbal", param: null },
  { id: "shoulder",   label: "ショルダーリグ",           en: "documentary-style shoulder mount", param: null },
  { id: "handheld",   label: "完全手持ち",               en: "raw handheld energy", param: null },
  { id: "carmount",   label: "車載リグ (サクション)",     en: "car-mounted suction rig", param: null },
  { id: "cablecam",   label: "ケーブルカム",             en: "cable cam flying along a wire", param: { label: "スパン", min: 10, max: 200, unit: "m", def: 50 } },
  { id: "bodyrig",    label: "ボディマウント (スノリカム)", en: "body-mounted snorricam locked on the actor", param: null },
  { id: "wearable",   label: "ウェアラブル (頭部/耳掛け)", en: "head-mounted wearable POV", param: null },
  { id: "dronemount", label: "ドローン搭載",             en: "mounted on a drone", param: { label: "高度", min: 1, max: 120, unit: "m", def: 30 } },
];

/* カメラワーク → 推奨サポートの対応 */
const MOVE_SUPPORT = {
  fix: "tripod", pan: "tripod", whip: "tripod", tilt: "tripod", zoomin: "tripod",
  pedestal: "crane", dollyin: "dolly", dollyout: "dolly", track: "dolly", arc: "dolly",
  dollyzoom: "dolly", crane: "crane", handheld: "handheld", gimbal: "gimbal", orbit: "gimbal",
  d_orbit: "dronemount", d_reveal: "dronemount", d_flyover: "dronemount", d_chase: "dronemount",
  d_topdown: "dronemount", d_side: "dronemount", d_pullback: "dronemount", d_dronie: "dronemount",
  d_spiral: "dronemount", d_lowpass: "dronemount", d_dive: "dronemount", d_dzoom: "dronemount",
};

/* ---------- 雲台 / ND / レンズフィルター ---------- */
const CAMERA_HEADS = ["フルード雲台", "ギア雲台", "ボール雲台", "リモートヘッド(電子制御)", "3軸スタビ雲台", "直付け(リジッド)"];
const ND_FILTERS = ["なし", "ND4 (2段)", "ND8 (3段)", "ND64 (6段)", "ND400 (8.6段)", "可変ND"];
const LENS_FILTERS = [
  { id: "pl",        label: "PL (偏光)",           en: "polarizer taming reflections and deepening colors" },
  { id: "blackmist", label: "ブラックミスト 1/4",  en: "black mist filter, gentle halation on highlights" },
  { id: "promist",   label: "プロミスト 1/2",      en: "pro-mist filter, dreamy glowing highlights" },
  { id: "cross",     label: "クロスフィルター",     en: "cross screen filter, star-shaped sparkles on light sources" },
  { id: "streak",    label: "ストリーク (アナモ風)", en: "streak filter, horizontal anamorphic-style flares" },
  { id: "diopter",   label: "クローズアップ (接写)", en: "close-up diopter for macro detail" },
];

/* ---------- ライトスタンド / 照射角デフォルト ---------- */
const LIGHT_STANDS = ["ライトスタンド", "センチュリースタンド(Cスタンド)", "ブームアーム", "オートポール", "グリッド吊り(バトン)", "クランプ固定", "床置き"];
const MODIFIER_BEAM = {
  "グリッド10°": 10, "グリッド30°": 30, "スヌート": 15, "フレネル": 35, "バーンドア": 50,
  "パラボリックリフレクター": 45, "リングライト": 70,
  "ソフトボックス60cm": 80, "ソフトボックス120cm": 95, "オクタボックス150cm": 100,
  "アンブレラ(透過)": 110, "アンブレラ(反射)": 100, "ビューティーディッシュ": 65,
  "ディフュージョン#216": 110, "ディフュージョン#250": 115, "ブックライト": 120,
  "ストリップボックス30x120": 55, "ライトテント(乳白)": 120, "12x12シルク(頭上)": 120,
};

/* レンズプリセットID → 焦点距離mm */
const LENS_FOCAL = { "14": 14, "24": 24, "35": 35, "50": 50, "85": 85, "100m": 100, "135": 135, "anam": 50 };

/* ---------- アスペクト比 ---------- */
const ASPECTS = [
  { id: "16:9",   label: "16:9 (横・標準)",        w: 16, h: 9,  en: "16:9 widescreen" },
  { id: "9:16",   label: "9:16 (縦・リール/TikTok)", w: 9, h: 16, en: "9:16 vertical video" },
  { id: "2.39:1", label: "2.39:1 (シネスコ)",      w: 239, h: 100, en: "2.39:1 anamorphic widescreen, cinematic letterbox" },
  { id: "4:3",    label: "4:3 (クラシック)",        w: 4, h: 3,  en: "4:3 classic aspect ratio" },
  { id: "1:1",    label: "1:1 (スクエア)",          w: 1, h: 1,  en: "1:1 square format" },
  { id: "3:2",    label: "3:2 (スチール標準)",      w: 3, h: 2,  en: "3:2 photographic frame" },
  { id: "4:5",    label: "4:5 (縦スチール/SNS)",    w: 4, h: 5,  en: "4:5 vertical photographic frame" },
];

/* ---------- ルック / グレーディング ---------- */
const LOOKS = [
  { id: "natural",    label: "ナチュラル",         en: "natural true-to-life color grade" },
  { id: "tealorange", label: "ティール&オレンジ",  en: "teal and orange blockbuster color grade",
    tintA: "#ff8a3c", tintB: "#186e8a" },
  { id: "filmwarm",   label: "フィルム暖色",       en: "warm vintage film emulation with soft grain",
    tintA: "#ffb060", sat: 0.9 },
  { id: "bleach",     label: "ブリーチバイパス",   en: "bleach bypass look, desaturated and high contrast", sat: 0.35 },
  { id: "mono",       label: "モノクロ",           en: "black and white, rich tonal range", sat: 0 },
  { id: "pastel",     label: "パステル",           en: "soft pastel tones with lifted shadows",
    tintA: "#ffd9e8", sat: 0.8 },
  { id: "vivid",      label: "ビビッド",           en: "punchy vivid saturated colors", sat: 1.5 },
  { id: "cyber",      label: "シネパンク (青強調)", en: "cyberpunk grade with deep blues and neon accents",
    tintB: "#2040c0" },
];

/* ---------- 被写体の演技・動き ---------- */
const SUBJECT_ACTIONS = [
  { id: "stand",  label: "立ち (静止)",     en: "standing still" },
  { id: "walk",   label: "歩く",            en: "walking" },
  { id: "run",    label: "走る",            en: "running" },
  { id: "sit",    label: "座る",            en: "sitting" },
  { id: "turn",   label: "振り返る",        en: "turning around to look back at the camera" },
  { id: "jump",   label: "ジャンプ",        en: "jumping mid-air" },
  { id: "dance",  label: "踊る",            en: "dancing" },
  { id: "talk",   label: "話す (カメラ目線)", en: "speaking directly to the camera" },
  { id: "hands",  label: "手元作業",        en: "hands working in detail" },
  { id: "pour",   label: "注ぐ (液体)",     en: "liquid being poured in a smooth stream" },
  { id: "rotate", label: "回転 (ターンテーブル)", en: "slowly rotating on a turntable" },
  { id: "float",  label: "浮遊 (商品)",     en: "floating weightlessly in mid-air" },
  { id: "place",  label: "置き (静物)",     en: "a carefully arranged still composition" },
  { id: "drive",  label: "走行 (車両)",     en: "driving at speed" },
];

/* ---------- カメラ移動速度 ---------- */
const MOVE_SPEEDS = [
  { id: "veryslow", label: "とてもゆっくり", en: "very slow, almost imperceptible" },
  { id: "slow",     label: "ゆっくり",       en: "slow and deliberate" },
  { id: "normal",   label: "標準",           en: "" },
  { id: "fast",     label: "速い",           en: "fast and energetic" },
  { id: "veryfast", label: "とても速い",     en: "rapid, high-speed" },
];

/* ---------- ドリー/スライダー軌道 ---------- */
const TRACK_SHAPES = ["直線", "カーブ (S字/緩弧)", "円弧 (被写体中心)"];

/* ---------- 音声収録 ---------- */
const AUDIO_MODES = ["同録 (ガンマイク+ブーム)", "ラベリア (ピンマイク)", "同録+ラベリア (2系統)", "アンビエンスのみ", "MOS (現場無音・後付け)"];

/* ---------- 音の編集点 (V6 EditDecision — J/Lカット) ---------- */
const AUDIO_EDITS = [
  { id: "none", label: "同時 (ストレート)",
    note: "映像と音を同じ点で切る。基本形。" },
  { id: "jcut", label: "Jカット (音が先行)",
    note: "次カットの音声を映像より先に始める。会話シーンの定番。自然な流れを作る。" },
  { id: "lcut", label: "Lカット (音が残る)",
    note: "前カットの音声を次の映像に持ち越す。リアクションを見せながら台詞を聞かせる。" },
];

/* ---------- 天候・時間帯 (主に屋外) ---------- */
const WEATHERS = [
  { id: "none",   label: "指定なし", en: "" },
  { id: "clear",  label: "快晴",     en: "clear sunny weather" },
  { id: "thin",   label: "薄曇り",   en: "thin high clouds, soft daylight" },
  { id: "cloudy", label: "曇天",     en: "overcast sky, diffused light" },
  { id: "rainy",  label: "雨",       en: "rainy weather, wet surfaces" },
  { id: "snowy",  label: "雪",       en: "snowy weather" },
  { id: "foggy",  label: "霧",       en: "thick fog, limited visibility" },
  { id: "windy",  label: "強風",     en: "strong wind" },
];
const TIMES_OF_DAY = [
  { id: "none",    label: "指定なし",       en: "" },
  { id: "dawn",    label: "早朝 (夜明け)",   en: "at dawn, first light" },
  { id: "morning", label: "午前",           en: "in the morning" },
  { id: "noon",    label: "正午 (トップ光)", en: "at high noon" },
  { id: "aft",     label: "午後",           en: "in the afternoon" },
  { id: "golden",  label: "ゴールデンアワー", en: "during golden hour" },
  { id: "blue",    label: "ブルーアワー",   en: "during blue hour twilight" },
  { id: "night",   label: "夜",             en: "at night" },
];

/* ---------- カット間トランジション ---------- */
const TRANSITIONS = [
  { id: "cut",       label: "カット (直つなぎ)",      en: "hard cut",
    note: "最も基本。アクションつなぎ (動作の途中で切る) にすると滑らか。" },
  { id: "dissolve",  label: "ディゾルブ",             en: "cross dissolve",
    note: "時間経過・場面転換の定番。1〜2秒が標準。多用すると間延びする。" },
  { id: "fadeout",   label: "フェードアウト→イン",    en: "fade to black, then fade in",
    note: "章の区切り。完全な黒を1秒挟むと「終わり」感が強まる。" },
  { id: "whiteout",  label: "ホワイトアウト",         en: "flash to white transition",
    note: "回想・爆発・眩しさの表現。次カットの頭を白飛びから始める。" },
  { id: "matchcut",  label: "マッチカット",           en: "match cut on matching shape and motion",
    note: "前後カットで形・動き・構図を一致させる。丸→太陽、ドア→ドア等。撮影時に構図を揃えておくこと。" },
  { id: "whippan",   label: "ウィップパンつなぎ",     en: "whip-pan transition, motion blur bridging the cuts",
    note: "前カットの終わりと次カットの頭で同方向に高速パン。ブラー中に編集点を隠す。" },
  { id: "wipe",      label: "ワイプ",                 en: "wipe transition",
    note: "画面を横切る物体 (通行人・柱) で切り替えると自然なワイプになる。" },
  { id: "jumpcut",   label: "ジャンプカット",         en: "jump cut",
    note: "同構図で時間を飛ばす。テンポと省略の表現。VLOG的。" },
  { id: "morph",     label: "モーフ (シームレス)",    en: "seamless morph transition",
    note: "被写体をフレーム内の同位置・同サイズで撮り、ポスプロで溶かす。AI動画では1プロンプト内で指示可能。" },
  { id: "speedramp", label: "スピードランプ",         en: "speed ramp transition",
    note: "前カット末尾を加速→次カット頭を減速。動きの勢いで繋ぐ。" },
];

/* ---------- AI動画/画像モデル別プロンプト方言 ---------- */
const PROMPT_MODELS = [
  { id: "seedance", label: "Seedance",  hint: "CineOS §10 準拠: FORMAT→SUBJECT→…→NEGATIVE の構造化ブロック" },
  { id: "veo",      label: "Veo 3",     hint: "自然な英文の1段落+音声指示に対応" },
  { id: "kling",    label: "Kling",     hint: "項目ラベル形式 (Subject/Camera/Lighting...)" },
  { id: "runway",   label: "Runway Gen-4", hint: "[camera]: [scene] 形式の簡潔な指示" },
  { id: "sora",     label: "Sora",      hint: "情景描写の長文パラグラフ" },
  { id: "mj",       label: "Midjourney (静止画)", hint: "タグ列+--ar パラメータ" },
  { id: "generic",  label: "汎用",      hint: "標準フォーマット" },
];

/* =========================================================
 * 人の動き (演技演出) — カメラ/技術とは別レイヤー
 *
 * 動きの正解は「◯◯という名前の動き」では決まらない。概念名は解釈の幅が
 * そのまま出力の幅になるため、質 (速さ・雑さ・誰に向けた動きか) と
 * 時間軸のビート (いつ何をするか) で書く。カメラ側の設計には手を入れず、
 * 尺・カメラワーク・カットサイズと相互にチェックして噛み合わせる。
 * ======================================================= */

/* 動きの質 — 名前ではなく質で指定する */
const MOTION_SPEEDS = [
  { id: "slow", label: "遅い", en: "slow" },
  { id: "moderate", label: "ふつう", en: "moderate speed" },
  { id: "fast", label: "速い", en: "fast" },
];
const MOTION_CARES = [
  { id: "loose", label: "雑", en: "loose and unpolished" },
  { id: "natural", label: "自然", en: "natural" },
  { id: "precise", label: "丁寧", en: "careful and precise" },
];
const MOTION_TOWARDS = [
  { id: "alone", label: "一人で (見せていない)", en: "performed alone, not for an audience" },
  { id: "camera", label: "カメラに向けて", en: "directed at the camera" },
  { id: "partner", label: "相手に向けて", en: "directed at the other person" },
];
/* 演技の温度 — 誰かに見せているのか、一人でやっているのか */
const PERF_TEMPS = [
  { id: "private", label: "一人でやっている", en: "private, unaware of being watched" },
  { id: "shown", label: "誰かに見せている", en: "aware of an audience" },
  { id: "observed", label: "観察されている (気づいていない)", en: "observational, does not acknowledge the camera" },
];
/* 登場要素 (アクター) — 動くのは人だけではない。車両・動物・群衆・物、
 * そしてカメラ自身も「動き」を持つ。台本上ではすべて同じ扱いにする */
const ACTOR_TYPES = [
  { id: "person", label: "人物", en: "a person" },
  { id: "vehicle", label: "車両", en: "a vehicle" },
  { id: "animal", label: "動物", en: "an animal" },
  { id: "crowd", label: "群衆", en: "a crowd" },
  { id: "object", label: "商品・物", en: "an object" },
  { id: "camera", label: "カメラ自身", en: "the camera itself" },
];

/* 視線・向き — どこを見ている/向いているか (車なら進行方向) */
const GAZE_TARGETS = [
  { id: "none", label: "指定なし", en: "" },
  { id: "ahead", label: "前方", en: "facing ahead" },
  { id: "camera", label: "カメラ", en: "looking into the camera" },
  { id: "partner", label: "相手", en: "looking at the other person" },
  { id: "object", label: "手元/対象物", en: "looking at the object in hand" },
  { id: "away", label: "外す/逸らす", en: "looking away" },
];
/* 要素同士の絡み — risk が高いほど「先に撮る」向き。
 * 人同士に限らず、車と人・動物と人の絡みも同じ判断でよい */
const CONTACT_TYPES = [
  { id: "none", label: "絡みなし", en: "no physical interaction", risk: 0 },
  { id: "near", label: "すれ違い/近接", en: "passing close to each other", risk: 1 },
  { id: "touch", label: "触れる/接触する", en: "physical contact between subjects", risk: 2 },
  { id: "handoff", label: "受け渡し", en: "handing an object over", risk: 2 },
  { id: "embrace", label: "組み合う/衝突", en: "grappling / colliding", risk: 3 },
];
/* カメラが体の動きに連動するか — カメラワーク側と矛盾しないか診断する */
const CAM_LINKS = [
  { id: "none", label: "連動しない", en: "camera stays independent of the body" },
  { id: "follow", label: "体に連動 (追う)", en: "camera motion is linked to the body, following it" },
  { id: "lead", label: "先回りする", en: "camera leads the movement" },
];

/* 作り方3通り。難しい動きは先に撮る */
const PROD_METHODS = [
  { id: "gen", label: "全部AIに作らせる", en: "full generation",
    fit: "実在しない世界・単純な動き・強い世界観" },
  { id: "ref", label: "見本を渡して作らせる", en: "reference-guided generation",
    fit: "顔・商品の形が決まっている / 構図を継続したい" },
  { id: "shoot", label: "先に撮ってから変える", en: "shoot first, then restyle",
    fit: "複雑な動き・人同士の接触・複数人の絡み" },
];
/* 「先に撮る」でも解決しないケース */
const UNFIT_CASES = [
  { id: "nosrc", label: "元素材なしで全部を生成したい" },
  { id: "complex", label: "接触が複雑すぎる" },
  { id: "hidden", label: "顔が完全に隠れる" },
  { id: "ambiguous", label: "誰がどこにいるか曖昧" },
  { id: "broken", label: "元素材の段階で立ち位置が崩れている" },
];

/* 残す / 変える — 先に撮った素材を作り変えるときの境界 */
const PRESERVE_ITEMS = [
  { id: "performance", label: "演技", en: "the performance" },
  { id: "timing", label: "タイミング", en: "the timing" },
  { id: "gaze", label: "視線", en: "the gaze" },
  { id: "blocking", label: "立ち位置", en: "the blocking" },
  { id: "cameraMotion", label: "カメラの動き", en: "the camera motion" },
];
const CHANGE_ITEMS = [
  { id: "person", label: "人物", en: "the person" },
  { id: "environment", label: "環境", en: "the environment" },
  { id: "wardrobe", label: "衣装", en: "the wardrobe" },
  { id: "timeOfDay", label: "時間帯", en: "the time of day" },
  { id: "style", label: "質感/スタイル", en: "the visual style" },
];

/* 一本撮りの時間配分ガイド (公式の目安)。尺に合わせて比率で流し込む */
const BEAT_TEMPLATES = [
  { id: "oneTake", label: "一本撮りの配分 (引き→寄り→展開→収束)",
    beats: [
      { r: 0.20, do: "引きの画で状況を見せる", gaze: "ahead", cam: "none" },
      { r: 0.27, do: "寄りの画で本題の動きに入る", gaze: "object", cam: "follow" },
      { r: 0.33, do: "カメラを動かすかインサートで展開する", gaze: "none", cam: "follow" },
      { r: 0.20, do: "収束させる", gaze: "away", cam: "none" },
    ] },
  { id: "actReact", label: "動作 → 反応 (2ビート)",
    beats: [
      { r: 0.55, do: "動作を起こす", gaze: "object", cam: "follow" },
      { r: 0.45, do: "反応する", gaze: "partner", cam: "none" },
    ] },
  { id: "enterExit", label: "入り → 芝居 → 抜け (3ビート)",
    beats: [
      { r: 0.25, do: "フレームインする", gaze: "ahead", cam: "lead" },
      { r: 0.5, do: "止まって芝居をする", gaze: "partner", cam: "none" },
      { r: 0.25, do: "フレームアウトする", gaze: "away", cam: "follow" },
    ] },
];

/* ---------- 消費電力デフォルト (W) — 電源プラン自動計算用 ---------- */
const TYPE_WATT = {
  key: 300, fill: 200, back: 150, rim: 150, top: 300, bg: 200,
  hmi: 1200, practical: 60,
};
/* 発電機の標準容量 (kVA) */
const GENERATOR_SIZES = [2.8, 5.5, 15, 25, 60];

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
  { id: "rain", label: "雨・レイン", en: "rain falling, raindrops glistening in the backlight",
    note: "レインマシンは必ず逆光に置く(順光の雨は写らない)。機材の防水養生と電源の漏電対策を徹底。" },
  { id: "snow", label: "雪・スノー", en: "snow falling gently through the air",
    note: "スノーマシン(泡雪)も逆光で映える。地面は白布で連続性を出す。溶けない泡雪は衣装への付着に注意。" },
  { id: "explosion", label: "特効: 爆発 (パイロ)", en: "a controlled pyrotechnic explosion erupting in the background, fireball and black smoke",
    note: "有資格の特効技師のみが実施(煙火消費許可・所轄届出)。爆点は俳優の規定距離後方、リモート点火、消火体制と安全区域の設定が前提。" },
  { id: "sparks", label: "特効: 火花・スパーク", en: "showers of orange sparks raining down",
    note: "スパークマシンで上から降らせる。防炎シートで床・機材を養生し、消火器を常備。衣装は難燃素材を確認。" },
  { id: "confetti", label: "紙吹雪・コンフェッティ", en: "colorful confetti fluttering down through the air",
    note: "キャノンで打ち上げ、送風機の弱風でゆっくり舞わせる。金銀は光を反射して華やか。連続テイクは掃除時間を段取りに含める。" },
  { id: "gel", label: "カラージェル (2色)", en: "bold magenta and cyan duotone gel lighting",
    note: "補色の2灯 (例: マゼンタ×シアン) で左右から挟む。地明かりを完全に切ると色が濁らない。" },
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

  /* =====================================================
   * 人物ライティング (基本) — 動画/スチール共通
   * =================================================== */
  {
    id: "three-point", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "三点照明 (スタンダード)",
    desc: "キー・フィル・バックの基本形。キーを斜め45°・上方45°から当て、フィルで影を1〜2段暗く起こし、バックで輪郭を背景から分離する。キー:フィル比は2:1(自然)〜4:1(ドラマチック)で調整。",
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
    id: "loop", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "ループライト",
    desc: "キーを正面から30〜40°横・やや上方に。鼻の影が頬に小さな輪(ループ)を描く、最も汎用的で失敗の少ない配置。レンブラントより浅く、バタフライより立体的。迷ったらこれ。",
    tags: ["基本", "ポートレート", "万能"],
    subjectType: "person", bgStyle: "gradient",
    look: "鼻横に小さな影のループ。顔の8割に光が回り、健康的で親しみやすい立体感。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F2.8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key",  x: 380, y: 500, height: 210, power: 70, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "fill", x: 660, y: 510, height: 150, power: 25, colorTemp: 5600, modifier: "アンブレラ(透過)" },
      { type: "back", x: 650, y: 160, height: 240, power: 40, colorTemp: 5600, modifier: "グリッド30°" },
    ],
  },
  {
    id: "rembrandt", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "レンブラントライト",
    desc: "キーを45°横・45°上から。影側の頬に逆三角形のハイライトを作る古典肖像画のライティング。三角形は「目の幅より狭く、鼻の長さより短く」。キーが低いとホラーになるので必ず上方から。",
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
    id: "butterfly", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "バタフライ (パラマウント)",
    desc: "キーをカメラ真上・高めから正面に。鼻下に蝶形の影。頬骨を強調しビューティー/グラマー撮影の定番。あご下にレフを入れて影を起こすとクラムシェルに発展する。",
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
    id: "split", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "スプリットライト",
    desc: "真横90°からのキーで顔を明暗半分に割る。緊張感・二面性・葛藤の表現。フィルは使わないか極少量。ストリップボックスで縦に細く切ると現代的。",
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
    id: "broad", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "ブロードライティング",
    desc: "被写体の顔をキーと逆側へ振らせ、カメラに近い側の広い面を照らす。顔が広く明るく写るため、細面の人物や快活な印象に向く。眼鏡の反射が出にくいのも利点。",
    tags: ["ポートレート", "明るい", "顔の向き"],
    subjectType: "person", bgStyle: "gradient",
    look: "カメラ側の頬が広く明るい。開放的で若々しい印象。影は奥側に隠れる。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F2.8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key",  x: 330, y: 470, height: 210, power: 75, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "fill", x: 680, y: 520, height: 150, power: 20, colorTemp: 5600, modifier: "アンブレラ(透過)" },
      { type: "back", x: 620, y: 150, height: 240, power: 40, colorTemp: 5600, modifier: "グリッド30°" },
    ],
  },
  {
    id: "short", modes: ["video", "still"], group: "人物ライティング (基本)",
    name: "ショートライティング",
    desc: "被写体の顔をキー側へ振らせ、カメラから遠い側の狭い面を照らす。カメラ側の頬に影が落ち、顔が細く彫り深く見える。ドラマチックなポートレートの定石。",
    tags: ["ポートレート", "小顔", "陰影"],
    subjectType: "person", bgStyle: "dark",
    look: "カメラ側の頬が影になり、輪郭が引き締まる。立体的でシャープな印象。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F2.0", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key",  x: 280, y: 290, height: 210, power: 75, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "fill", x: 660, y: 520, height: 150, power: 18, colorTemp: 5600, modifier: "アンブレラ(透過)" },
      { type: "back", x: 700, y: 180, height: 240, power: 35, colorTemp: 5600, modifier: "グリッド30°" },
    ],
  },

  /* =====================================================
   * 人物ライティング (応用)
   * =================================================== */
  {
    id: "clamshell", modes: ["video", "still"], group: "人物ライティング (応用)",
    name: "クラムシェル (貝殻ライティング)",
    desc: "正面上45°のビューティーディッシュと、あご下からの弱い返し(レフまたは2灯目)で挟む。首やあごの影が消え、肌のディテールが均一に出るビューティーの完成形。上下ライトの比は3:1目安。",
    tags: ["ビューティー", "コスメ", "肌"],
    subjectType: "person", bgStyle: "white",
    look: "影のない滑らかな肌、上下二重のキャッチライト。ビューティー広告の質感。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F5.6", shutter: "1/125", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key",  x: 500, y: 480, height: 240, power: 70, colorTemp: 5500, modifier: "ビューティーディッシュ" },
      { type: "fill", x: 500, y: 460, height: 50, power: 25, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "bg",   x: 500, y: 130, height: 100, power: 55, colorTemp: 5500, modifier: "ディフュージョン#216" },
    ],
  },
  {
    id: "backlight-silhouette", modes: ["video", "still"], group: "人物ライティング (応用)",
    name: "逆光シルエット",
    desc: "被写体の背後のみを照らし、輪郭だけで見せる。背景に明るい面(白ホリ・夕景)を作り、前面は無灯火。ヘイズで光条を可視化するとより映画的。露出は背景に合わせる。",
    tags: ["シルエット", "エモーショナル", "逆光"],
    subjectType: "person", bgStyle: "bright",
    look: "人物は完全な黒いシルエット。背景は明るく、輪郭に細い光のエッジ。",
    camera: { shotSize: "FF", angle: "low", move: "fix", lens: "35", aperture: "F5.6", shutter: "1/50", iso: "200", fps: "24fps", wb: "5600K" },
    items: [
      { type: "bg",  x: 350, y: 110, height: 150, power: 100, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "bg",  x: 650, y: 110, height: 150, power: 100, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "rim", x: 500, y: 130, height: 260, power: 60, colorTemp: 5600, modifier: "グリッド10°" },
    ],
    defaultOptions: ["silhouette"],
  },
  {
    id: "highkey", modes: ["video", "still"], group: "人物ライティング (応用)",
    name: "ハイキー",
    desc: "全体を明るく、影を最小化。白背景を2灯で被写体より+1〜1.5EV明るく飛ばし、正面から大光面のキー。清潔感・ポップ・コマーシャル向け。背景の飛ばしすぎはフレアの原因になるので+2EVまで。",
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
    id: "lowkey-noir", modes: ["video", "still"], group: "人物ライティング (応用)",
    name: "ローキー / フィルムノワール",
    desc: "闇を基調に、硬い光を一方向から。フレネルの直射でブラインド影・帽子影を作る。黒フラッグで漏れ光を徹底的に切り、黒は黒として沈める。色温度をやや低くすると退廃感が出る。",
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
    id: "underlight", modes: ["video", "still"], group: "人物ライティング (応用)",
    name: "アンダーライト (ホラー/怪談)",
    desc: "床レベルの低い位置から顔を照らす、日常には存在しない光。影が上向きに反転し本能的な不気味さを生む。焚き火・懐中電灯・PC画面などのモチベーションを添えると説得力が出る。",
    tags: ["ホラー", "不気味", "特殊"],
    subjectType: "person", bgStyle: "black",
    look: "あご・鼻・眉の影が上へ伸びる反転陰影。眼窩が落ち込み不穏な印象。",
    camera: { shotSize: "CU", angle: "low", move: "dollyin", lens: "35", aperture: "F2.8", shutter: "1/50", iso: "1600", fps: "24fps", wb: "4000K" },
    items: [
      { type: "key",  x: 500, y: 470, height: 20, power: 80, colorTemp: 4000, modifier: "なし(直射)" },
      { type: "flag", x: 500, y: 150, height: 250, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "window-interview", modes: ["video"], group: "人物ライティング (応用)",
    name: "インタビュー (ウィンドウライト風)",
    desc: "大型ソフトボックス(またはブックライト)を窓光に見立てて斜め45°から。反対側にネガティブフィル(黒)でコントラストを整える。背景に暖色プラクティカルの玉ボケを置くと奥行きが出る。2カメ想定。",
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
    defaultOptions: ["bokeh"],
  },

  /* =====================================================
   * シーン再現ライティング (動画)
   * =================================================== */
  {
    id: "day-interior", modes: ["video"], group: "シーン再現ライティング",
    name: "デイシーン (窓光の再現)",
    desc: "大出力HMIを窓の外からディフュージョン越しに入れ、昼の室内を再現する。光源は1方向に限定し、部屋の反対側はバウンスの起こしのみ。カーテン越しなら#250を2枚重ねて質を柔らかく。",
    tags: ["シーン", "昼", "室内"],
    subjectType: "person", bgStyle: "day",
    look: "窓から差し込む一方向の柔らかい昼光。室内は自然なコントラストで、生活感のあるリアリティ。",
    camera: { shotSize: "WS", angle: "eye", move: "gimbal", lens: "35", aperture: "F2.8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "hmi",  x: 220, y: 300, height: 280, power: 85, colorTemp: 5600, modifier: "ディフュージョン#216" },
      { type: "reflector", x: 700, y: 470, height: 100, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 700, y: 250, height: 200, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "moonlight", modes: ["video"], group: "シーン再現ライティング",
    name: "ムーンライト (夜の月光)",
    desc: "高い位置からCTB(青)を貼ったHMIを月光に見立てて逆サイドから落とし、室内の暖色プラクティカルと対比させる。青は5600Kベースで+1/2〜1CTBに抑えると嘘っぽくならない。露出は2〜3段アンダー基準。",
    tags: ["シーン", "夜", "ブルー"],
    subjectType: "person", bgStyle: "bluehour",
    look: "冷たい青の月光が窓側から差し、暖色の室内灯と青橙のコントラスト。夜の静けさ。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "50", aperture: "F1.8", shutter: "1/50", iso: "1600", fps: "24fps", wb: "4300K" },
    items: [
      { type: "hmi", x: 650, y: 120, height: 350, power: 60, colorTemp: 7500, modifier: "CTBフィルター" },
      { type: "practical", x: 320, y: 380, height: 100, power: 18, colorTemp: 2400, modifier: "なし(直射)" },
      { type: "flag", x: 300, y: 200, height: 220, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "candle", modes: ["video"], group: "シーン再現ライティング",
    name: "キャンドル / 暖炉あかり",
    desc: "2200K前後の低色温度光を低い位置・至近距離から。ゆらぎ(フリッカー)を出すためライトのエフェクトモードか手前で布を振る。距離が近いほど減衰が急で、顔だけが闇に浮かぶ。",
    tags: ["シーン", "夜", "暖色"],
    subjectType: "person", bgStyle: "black",
    look: "オレンジの揺れる光が顔の下半分を照らし、背景は闇へ沈む。親密さと孤独感。",
    camera: { shotSize: "CU", angle: "eye", move: "handheld", lens: "50", aperture: "F1.4", shutter: "1/50", iso: "3200", fps: "24fps", wb: "3200K" },
    items: [
      { type: "practical", x: 480, y: 430, height: 90, power: 45, colorTemp: 2200, modifier: "なし(直射)" },
      { type: "fill", x: 660, y: 500, height: 140, power: 8, colorTemp: 2800, modifier: "CTOフィルター" },
    ],
  },
  {
    id: "tv-glow", modes: ["video"], group: "シーン再現ライティング",
    name: "モニター / TVの光",
    desc: "カメラ下・正面低めから7000K前後の青白い光を当て、画面を見る人物を再現。ライトのフリッカー/エフェクトモードで不規則な明滅を加えるとリアル。暗い部屋設定で露出はアンダーに。",
    tags: ["シーン", "夜", "スクリーン"],
    subjectType: "person", bgStyle: "black",
    look: "青白い光が下から顔に揺らめく。深夜にスクリーンを見つめる孤独な空気。",
    camera: { shotSize: "CU", angle: "eye", move: "dollyin", lens: "35", aperture: "F2.0", shutter: "1/50", iso: "1600", fps: "24fps", wb: "5600K" },
    items: [
      { type: "practical", x: 500, y: 520, height: 90, power: 50, colorTemp: 7000, modifier: "なし(直射)" },
      { type: "rim", x: 680, y: 160, height: 220, power: 20, colorTemp: 4300, modifier: "スヌート" },
    ],
  },
  {
    id: "interrogation", modes: ["video"], group: "シーン再現ライティング",
    name: "尋問シーン (トップ単灯)",
    desc: "被写体の真上からフレネル直射1灯のみ。眼窩・鼻下に深い影が落ち、圧迫感と閉塞感を生む。ヘイズを焚いて光柱を見せるのが定番。周囲は完全な黒に沈める。",
    tags: ["シーン", "サスペンス", "単灯"],
    subjectType: "person", bgStyle: "black",
    look: "頭上からの光柱の中に人物だけが浮かぶ。目元は影に落ち、表情が読めない緊張感。",
    camera: { shotSize: "WS", angle: "eye", move: "orbit", lens: "35", aperture: "F2.8", shutter: "1/50", iso: "800", fps: "24fps", wb: "4300K" },
    items: [
      { type: "top", x: 500, y: 330, height: 320, power: 85, colorTemp: 4300, modifier: "フレネル" },
    ],
    defaultOptions: ["haze"],
  },
  {
    id: "stage-concert", modes: ["video"], group: "シーン再現ライティング",
    name: "ステージ / ライブ演出",
    desc: "背後からカラーバックライト2灯(補色)+正面スポット。ヘイズ必須で光線を可視化。バックの点滅・スイープでライブ感を出す。正面のキーは顔が見える最低限に絞る。",
    tags: ["ライブ", "音楽", "カラー"],
    subjectType: "person", bgStyle: "night",
    look: "色光線が交差する中、逆光のシルエットと顔のスポット。ライブの熱気と高揚感。",
    camera: { shotSize: "FF", angle: "low", move: "crane", lens: "24", aperture: "F2.8", shutter: "1/50", iso: "1600", fps: "24fps", wb: "5600K" },
    items: [
      { type: "rim", x: 380, y: 140, height: 300, power: 85, colorTemp: 3200, modifier: "カラージェル(マゼンタ)" },
      { type: "rim", x: 620, y: 140, height: 300, power: 85, colorTemp: 9000, modifier: "カラージェル(シアン)" },
      { type: "key", x: 500, y: 560, height: 260, power: 45, colorTemp: 5600, modifier: "グリッド10°" },
      { type: "smoke", x: 800, y: 150, height: 50, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["haze", "gel"],
  },
  {
    id: "neon-duotone", modes: ["video", "still"], group: "シーン再現ライティング",
    name: "ネオンデュオトーン (MV/サイバー)",
    desc: "マゼンタとシアンの補色ジェル2灯で左右から挟む。地明かりを完全に切ることで色が濁らず、肌が2色に染め分けられる。ミュージックビデオ・サイバーパンクの定番。白い小道具は色が乗りやすい。",
    tags: ["MV", "ネオン", "カラー"],
    subjectType: "person", bgStyle: "gel",
    look: "顔の左右がマゼンタとシアンに染まる。近未来的で音楽的なムード。",
    camera: { shotSize: "BS", angle: "dutch", move: "handheld", lens: "35", aperture: "F1.8", shutter: "1/50", iso: "800", fps: "24fps", wb: "5600K" },
    items: [
      { type: "key", x: 300, y: 400, height: 180, power: 70, colorTemp: 3200, modifier: "カラージェル(マゼンタ)" },
      { type: "rim", x: 700, y: 260, height: 200, power: 70, colorTemp: 9000, modifier: "カラージェル(シアン)" },
      { type: "flag", x: 500, y: 150, height: 220, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gel"],
  },
  {
    id: "flashback", modes: ["video"], group: "シーン再現ライティング",
    name: "回想 / ドリームシーン (ハレーション)",
    desc: "強いバックライトを直接レンズに入れハレーション(滲み)を作る。プロミスト系フィルター(1/2〜1)併用でハイライトが柔らかく滲む。露出はややオーバー基準、ソフトなキーで現実感を薄める。",
    tags: ["回想", "ソフト", "エモーショナル"],
    subjectType: "person", bgStyle: "bright",
    look: "白く滲んだ逆光、ふわりとした肌。記憶の中のような輪郭の溶けた画。",
    camera: { shotSize: "BS", angle: "eye", move: "gimbal", lens: "85", aperture: "F1.8", shutter: "1/50", iso: "200", fps: "24fps", wb: "5600K" },
    items: [
      { type: "rim", x: 500, y: 120, height: 260, power: 95, colorTemp: 5600, modifier: "なし(直射)" },
      { type: "key", x: 350, y: 480, height: 200, power: 45, colorTemp: 5600, modifier: "ブックライト" },
    ],
    defaultOptions: ["lensflare", "haze"],
  },
  {
    id: "chromakey", modes: ["video"], group: "シーン再現ライティング",
    name: "グリーンバック (クロマキー標準)",
    desc: "背景グリーンを2灯で±1/3EV以内のムラなく均一に照らし、被写体は背景から2m以上離して緑被りを防ぐ。バックライトにCTO(アンバー)を入れると緑のスピルを相殺できる。合成先のライティング方向と一致させること。",
    tags: ["VFX", "合成", "スタジオ"],
    subjectType: "person", bgStyle: "green",
    look: "均一なグリーンに、スピルのないクリーンなエッジの被写体。キーイング前提の素材。",
    camera: { shotSize: "WS", angle: "eye", move: "fix", lens: "50", aperture: "F4", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "bg", x: 300, y: 120, height: 150, power: 70, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "bg", x: 700, y: 120, height: 150, power: 70, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "key", x: 360, y: 490, height: 210, power: 65, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "back", x: 640, y: 180, height: 250, power: 45, colorTemp: 4300, modifier: "CTOフィルター" },
    ],
  },

  /* =====================================================
   * 商品・テーブル動画 (動画)
   * =================================================== */
  {
    id: "turntable", modes: ["video"], group: "商品・テーブル動画",
    name: "商品ターンテーブル / オービット",
    desc: "商品を電動ターンテーブルで回転(またはカメラがオービット)。両サイドのストリップの写り込みが回転に合わせて流れ、質感が全周で見える。1回転10〜15秒、背景は無地で視線を商品に集中させる。",
    tags: ["商品", "回転", "EC動画"],
    subjectType: "bottle", bgStyle: "dark",
    look: "ボトルの側面をハイライトが滑らかに流れ、全周の質感が伝わる。高級感のある回転ショット。",
    camera: { shotSize: "CU", angle: "eye", move: "orbit", lens: "85", aperture: "F5.6", shutter: "1/50", iso: "200", fps: "30fps", wb: "5500K" },
    items: [
      { type: "key",  x: 340, y: 180, height: 90, power: 70, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim",  x: 660, y: 180, height: 90, power: 55, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "fill", x: 500, y: 520, height: 70, power: 25, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "flag", x: 330, y: 430, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "cooking-topdown", modes: ["video"], group: "商品・テーブル動画",
    name: "料理動画 (真俯瞰キッチン)",
    desc: "カメラを真俯瞰に固定し、手元と食材を見せる料理動画の定番。キーは半逆光45°で食材の照りを出し、手前レフで影を起こす。カメラの影が落ちないようキーはカメラ軸から外す。",
    tags: ["料理", "俯瞰", "レシピ動画"],
    subjectType: "food", bgStyle: "day",
    look: "真上から見た調理面。食材に艶があり、手の影が邪魔しないフラットで見やすい画。",
    camera: { shotSize: "WS", angle: "birds", move: "fix", lens: "35", aperture: "F4", shutter: "1/50", iso: "400", fps: "30fps", wb: "5200K" },
    items: [
      { type: "key", x: 650, y: 200, height: 230, power: 75, colorTemp: 5200, modifier: "ソフトボックス120cm" },
      { type: "reflector", x: 350, y: 500, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "fill", x: 300, y: 300, height: 180, power: 25, colorTemp: 5200, modifier: "アンブレラ(透過)" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "hands-table", modes: ["video"], group: "商品・テーブル動画",
    name: "手元・開封動画 (アンボクシング)",
    desc: "斜め上からのトップ+左右45°の3灯で手元の影を消し、商品パッケージの文字が読める均一光を作る。手の肌色が転ばないよう全灯同色温度で統一。カメラは俯瞰60°が見やすい。",
    tags: ["開封", "手元", "レビュー動画"],
    subjectType: "cosme", bgStyle: "white",
    look: "影のない明るいテーブル面。手と商品が常にクリアに見え、文字も読める実用的な画。",
    camera: { shotSize: "WS", angle: "high", move: "fix", lens: "35", aperture: "F5.6", shutter: "1/60", iso: "400", fps: "30fps", wb: "5500K" },
    items: [
      { type: "top", x: 500, y: 300, height: 250, power: 60, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "key", x: 350, y: 480, height: 200, power: 50, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "fill", x: 650, y: 480, height: 200, power: 35, colorTemp: 5500, modifier: "ソフトボックス60cm" },
    ],
  },

  /* =====================================================
   * 人物スチール
   * =================================================== */
  {
    id: "white-holi-fashion", modes: ["still"], group: "人物スチール",
    name: "白ホリ全身ファッション",
    desc: "白ホリゾント背景を2灯で+1.5EVに飛ばし、オクタでメイン、透過アンブレラでフィル。床の映り込みを活かすなら白アクリルを敷く。全身のためライトは高め・遠めで光を均一に回す。",
    tags: ["ファッション", "白ホリ", "全身"],
    subjectType: "person", bgStyle: "white",
    look: "完全な白背景に全身が浮かぶ。影は足元にわずか、カタログ・ルックブックの標準。",
    camera: { shotSize: "FF", angle: "eye", move: "fix", lens: "85", aperture: "F8", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key",  x: 380, y: 520, height: 240, power: 75, colorTemp: 5500, modifier: "オクタボックス150cm" },
      { type: "fill", x: 640, y: 530, height: 180, power: 35, colorTemp: 5500, modifier: "アンブレラ(透過)" },
      { type: "bg",   x: 280, y: 130, height: 150, power: 100, colorTemp: 5500, modifier: "アンブレラ(反射)" },
      { type: "bg",   x: 720, y: 130, height: 150, power: 100, colorTemp: 5500, modifier: "アンブレラ(反射)" },
    ],
  },
  {
    id: "gel-portrait", modes: ["still"], group: "人物スチール",
    name: "カラージェルポートレート",
    desc: "ニュートラルなキー(ビューティーディッシュ)を正面に置き、左右後方からマゼンタ/シアンのジェルリムで輪郭を色で縁取る。キーの出力を落とすほどジェルの色が支配的になる。背景にもジェルを回すと世界観が締まる。",
    tags: ["ポートレート", "カラー", "クリエイティブ"],
    subjectType: "person", bgStyle: "gel",
    look: "顔は正しい肌色のまま、輪郭と背景が2色のネオンカラーに染まる。雑誌的でグラフィカル。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F4", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 500, y: 490, height: 220, power: 60, colorTemp: 5500, modifier: "ビューティーディッシュ" },
      { type: "rim", x: 300, y: 180, height: 200, power: 70, colorTemp: 3200, modifier: "カラージェル(マゼンタ)" },
      { type: "rim", x: 700, y: 180, height: 200, power: 70, colorTemp: 9000, modifier: "カラージェル(シアン)" },
    ],
    defaultOptions: ["gel"],
  },
  {
    id: "hard-fashion", modes: ["still"], group: "人物スチール",
    name: "ハードライト・ファッション (単灯)",
    desc: "パラボリックリフレクター1灯を高め正面から直射。硬くシャープな影がエッジの効いたハイファッションの緊張感を作る。影の落ち方が命なのでポージングと影を同時にデザインする。背景に影を落として二重像にするのも定番。",
    tags: ["ファッション", "ハード", "単灯"],
    subjectType: "person", bgStyle: "gradient",
    look: "輪郭のはっきりした濃い影、艶のある肌のハイライト。雑誌の表紙のような強い画。",
    camera: { shotSize: "WS", angle: "eye", move: "fix", lens: "85", aperture: "F8", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 450, y: 540, height: 290, power: 85, colorTemp: 5500, modifier: "パラボリックリフレクター" },
      { type: "flag", x: 250, y: 400, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 750, y: 400, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "sandwich-rim", modes: ["still"], group: "人物スチール",
    name: "サンドイッチリム (2灯挟み)",
    desc: "左右後方からストリップボックス2灯で挟み、体の両輪郭をエッジライトで浮かび上がらせる。正面は弱いフィルのみ、または無灯。アスリート・ボディライン・黒背景ファッションの定番。",
    tags: ["エッジ", "アスリート", "黒背景"],
    subjectType: "person", bgStyle: "black",
    look: "黒背景に体の両輪郭だけが光で描かれる。筋肉やボディラインが彫刻のように際立つ。",
    camera: { shotSize: "FF", angle: "eye", move: "fix", lens: "85", aperture: "F5.6", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "rim", x: 260, y: 200, height: 200, power: 80, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim", x: 740, y: 200, height: 200, power: 80, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "fill", x: 500, y: 540, height: 150, power: 12, colorTemp: 5500, modifier: "アンブレラ(透過)" },
    ],
  },

  /* =====================================================
   * 商品撮影 (プロダクト)
   * =================================================== */
  {
    id: "product-gradation", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "ボトル: グラデーションライティング",
    desc: "ストリップボックスを背面斜めから当て、ボトル側面に縦グラデーションの写り込みを作る。黒カードでエッジを締め、ラベル面は手前の弱いフィルで均一に。飲料・酒類パッケージの定番。",
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
    desc: "被写体の真後ろから乳白ディフューザー越しに光を当て、液体の透明感と色を最大化する。手前は黒締めで輪郭を出す。液色の彩度は透過光の強さで決まる。飲料の「抜け感」表現。",
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
    desc: "冷えた飲料の結露・水滴・スプラッシュを高速シャッター(または閃光時間の短いストロボ)で凍結。バックライトで雫を輝かせる。スプラッシュは水槽+投げ込みを複数テイク合成前提で。",
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
    id: "white-knockout", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "EC白抜き (規格物撮り)",
    desc: "EC・カタログ規格の完全白背景。背景紙を+1.5EVで飛ばし、商品はトップソフト+前面フィルで影を最小化。床面はアクリルか白紙で、切り抜き前提なら接地影を1つだけ残すと自然。",
    tags: ["EC", "白抜き", "規格"],
    subjectType: "cosme", bgStyle: "white",
    look: "完全な白背景、均一光の商品、うっすら一つの接地影。Amazon等の規格に準拠した画。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F13", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",  x: 500, y: 140, height: 100, power: 100, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "top", x: 500, y: 270, height: 200, power: 60, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "fill", x: 500, y: 540, height: 80, power: 35, colorTemp: 5500, modifier: "ディフュージョン#216" },
    ],
  },
  {
    id: "cosme-beauty", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "コスメ: クリーンビューティー",
    desc: "大面積の柔らかい光でパッケージの質感を出しつつ、ストリップの写り込みで高級感を演出。白〜淡グラデ背景。アクリル台で鏡面の映り込みを作ると誌面映えする。",
    tags: ["コスメ", "クリーン", "高級感"],
    subjectType: "cosme", bgStyle: "white",
    look: "淡い背景に浮かぶ商品、天面に柔らかいハイライト、下面に美しい鏡面反射。",
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
    id: "perfume-gel", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "香水: カラージェル背景",
    desc: "背景にジェルを入れたスポットで色のグラデーションを作り、ボトルはストリップ2灯のグラデーション写り込みで立体感を出す。ガラスの透明部分に背景色が透けてブランドカラーの世界観を作れる。",
    tags: ["香水", "カラー", "世界観"],
    subjectType: "bottle", bgStyle: "gel",
    look: "背景の色グラデーションがガラス越しに透け、エッジにシャープなハイライト。ブランドムードの一枚。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F11", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",  x: 500, y: 140, height: 120, power: 65, colorTemp: 3200, modifier: "カラージェル(マゼンタ)" },
      { type: "key", x: 340, y: 200, height: 90, power: 60, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim", x: 660, y: 200, height: 90, power: 50, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 500, y: 520, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss", "gel"],
  },
  {
    id: "beer-sizzle", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "ビール: 泡・透過・結露",
    desc: "透過光で液色の黄金色を出し、注ぎたての泡はトップの柔らかい光で立体感を出す。グラスの結露は霧吹き+グリセリン。泡が消える前の30秒が勝負のため、注ぎは本番直前・複数テイク前提。",
    tags: ["ビール", "泡", "シズル"],
    subjectType: "bottle", bgStyle: "bright",
    look: "黄金色に透ける液体、白い泡の立体感、グラス表面の無数の雫。喉が鳴る一枚。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F8", shutter: "1/250", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",  x: 500, y: 150, height: 90, power: 90, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "top", x: 500, y: 250, height: 170, power: 40, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "rim", x: 340, y: 200, height: 90, power: 45, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 660, y: 340, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["droplets", "gloss"],
  },
  {
    id: "food-sizzle", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "フード: 半逆光シズル",
    desc: "料理撮影の鉄則=半逆光。斜め後ろ45°からのキーで照り・ツヤ・湯気を出し、手前はレフで起こす。トップ気味に振ると立体感が増す。湯気は背景を暗く落とした部分でしか写らない。",
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
    id: "flatlay", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "フラットレイ (真俯瞰置き画)",
    desc: "商品・小物を平面に構成し真俯瞰から。キーは片側45°の大面積ソフトで統一方向の影を作り、逆サイドをレフで起こす。影の方向が揃うと構成が締まる。アパレル・雑貨・SNS向けの定番。",
    tags: ["フラットレイ", "俯瞰", "SNS"],
    subjectType: "cosme", bgStyle: "day",
    look: "真上から見た整然としたレイアウト。柔らかい一方向の影が立体感とリズムを作る。",
    camera: { shotSize: "WS", angle: "birds", move: "fix", lens: "50", aperture: "F8", shutter: "1/125", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 300, y: 250, height: 230, power: 70, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "reflector", x: 700, y: 420, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "car-studio", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "自動車: スタジオリフレクション",
    desc: "巨大オーバーヘッドの面光源(スカイパネル+シルク)をボディに写り込ませ、一本の美しいハイライトラインを作る。黒ホリで余計な写り込みを排除。ボディラインに沿って光源の端(エッジ)を置くのがコツ。",
    tags: ["自動車", "写り込み", "大規模"],
    subjectType: "car", bgStyle: "black",
    look: "ボディサイドに天井光源の細長い写り込みが一本走る。黒背景にボディラインが浮かぶ。",
    camera: { shotSize: "FF", angle: "low", move: "track", lens: "35", aperture: "F8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      { type: "top", x: 400, y: 280, height: 400, power: 90, colorTemp: 5600, modifier: "12x12シルク(頭上)" },
      { type: "top", x: 600, y: 280, height: 400, power: 90, colorTemp: 5600, modifier: "12x12シルク(頭上)" },
      { type: "rim", x: 250, y: 150, height: 150, power: 45, colorTemp: 5600, modifier: "フレネル" },
      { type: "flag", x: 500, y: 560, height: 200, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss"],
  },

  /* =====================================================
   * 特殊素材 (ガラス・金属・ジュエリー) — スチール
   * =================================================== */
  {
    id: "bright-field", modes: ["still"], group: "特殊素材 (ガラス・金属・ジュエリー)",
    name: "ガラス: ブライトフィールド",
    desc: "ガラスの背後に乳白の明るい面を作り、ガラスの輪郭を「黒い線」として描く手法。背景光のみで、輪郭の黒は左右の黒カード(フラッグ)の写り込みで作る。無色透明のガラス・理化学品に最適。",
    tags: ["ガラス", "透過", "輪郭"],
    subjectType: "bottle", bgStyle: "bright",
    look: "白い背景の中にガラスの輪郭が黒いシャープな線で浮かぶ。清潔で正確な描写。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F11", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",   x: 500, y: 150, height: 90, power: 100, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "flag", x: 330, y: 330, height: 70, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 670, y: 330, height: 70, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "dark-field", modes: ["still"], group: "特殊素材 (ガラス・金属・ジュエリー)",
    name: "ガラス: ダークフィールド",
    desc: "黒背景の中でガラスの輪郭を「白い線」として描く手法。背景は黒に落とし、左右やや後方の縦ストリップの写り込みだけでエッジを光らせる。ウイスキー・クリスタル等の高級表現。",
    tags: ["ガラス", "黒背景", "エッジ"],
    subjectType: "bottle", bgStyle: "black",
    look: "漆黒の中にガラスの両エッジだけが白い線で光る。重厚でラグジュアリーな描写。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F11", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "rim",  x: 330, y: 210, height: 90, power: 75, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim",  x: 670, y: 210, height: 90, power: 75, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 500, y: 130, height: 100, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "jewelry", modes: ["still"], group: "特殊素材 (ガラス・金属・ジュエリー)",
    name: "ジュエリー: テント+ピンスポット",
    desc: "ライトテント(乳白)で全周を柔らかく包んで金属の写り込みを整えた上で、グリッド10°のピンスポットで石にだけ強い点光源を当てファイア(輝き)を出す。マクロ域では被写界深度が極浅のため深度合成前提。",
    tags: ["ジュエリー", "マクロ", "輝き"],
    subjectType: "cosme", bgStyle: "black",
    look: "滑らかな金属面と、石の内部で弾ける虹色のファイア。深い黒背景に浮かぶ宝石。",
    camera: { shotSize: "ECU", angle: "high", move: "fix", lens: "100m", aperture: "F16", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "diff", x: 350, y: 280, height: 80, power: 0, colorTemp: 0, modifier: "ライトテント(乳白)" },
      { type: "diff", x: 650, y: 280, height: 80, power: 0, colorTemp: 0, modifier: "ライトテント(乳白)" },
      { type: "top",  x: 500, y: 250, height: 150, power: 60, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "key",  x: 380, y: 180, height: 120, power: 80, colorTemp: 5500, modifier: "グリッド10°" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "metal-tent", modes: ["still"], group: "特殊素材 (ガラス・金属・ジュエリー)",
    name: "金属/シルバー: 写り込み制御テント",
    desc: "鏡面金属は「周囲のすべて」が写る。乳白テントまたは白ケント紙で被写体を囲い、写り込みを白のグラデーションだけに整理する。レンズ穴の黒写りは最小化し、あえて一辺に黒を写して形を締める。",
    tags: ["金属", "鏡面", "写り込み"],
    subjectType: "cosme", bgStyle: "gradient",
    look: "鏡面に白の滑らかなグラデーションだけが写り、形が正確に伝わる。ノイズのない金属面。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F13", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "diff", x: 340, y: 330, height: 90, power: 0, colorTemp: 0, modifier: "ライトテント(乳白)" },
      { type: "diff", x: 660, y: 330, height: 90, power: 0, colorTemp: 0, modifier: "ライトテント(乳白)" },
      { type: "top",  x: 500, y: 260, height: 190, power: 70, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "flag", x: 500, y: 540, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["matte"],
  },
  {
    id: "gadget-specular", modes: ["still"], group: "特殊素材 (ガラス・金属・ジュエリー)",
    name: "スマホ/家電: スペキュラー制御",
    desc: "ガラス面・アルミ筐体のエッジに沿ってストリップの写り込みを走らせ、画面は無反射(偏光)で黒く締める。左右+トップの3面の写り込みをそれぞれ独立制御。指紋・ホコリはブロワーと手袋で徹底排除。",
    tags: ["ガジェット", "エッジ", "精密"],
    subjectType: "cosme", bgStyle: "black",
    look: "筐体エッジに細く正確なハイライトライン、画面は完全な黒。プレスリリースの製品画像。",
    camera: { shotSize: "CU", angle: "high", move: "fix", lens: "100m", aperture: "F11", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 320, y: 240, height: 100, power: 60, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim", x: 680, y: 240, height: 100, power: 60, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "top", x: 500, y: 240, height: 180, power: 45, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 500, y: 540, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss", "matte"],
  },

  /* =====================================================
   * 屋外撮影
   * =================================================== */
  {
    id: "golden-hour", modes: ["outdoor"], group: "屋外撮影",
    name: "ゴールデンアワー + レフ起こし",
    desc: "日没前後1時間の低い太陽を半逆光に置き、銀レフ or HMIで顔を起こす。髪に金色のリム。太陽は刻々と沈むため、カット割りは「引きから寄り」の順で撮ると光が繋がる。マジックアワーへの移行も計画に含める。",
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
    id: "bluehour", modes: ["outdoor"], group: "屋外撮影",
    name: "ブルーアワー / トワイライト",
    desc: "日没後20〜40分の空が深い青に染まる時間帯。空の青と街灯・窓明かりの暖色のコントラストが最も美しい約15分が勝負。人物はディフューズしたLEDで薄く起こし、空の露出を基準にする。",
    tags: ["夕暮れ", "青", "シネマティック"],
    subjectType: "person", bgStyle: "bluehour",
    look: "深い青の空気の中、暖色の街明かりが灯る。青と橙の映画的なコントラスト。",
    camera: { shotSize: "WS", angle: "eye", move: "gimbal", lens: "35", aperture: "F1.8", shutter: "1/50", iso: "1600", fps: "24fps", wb: "4300K" },
    items: [
      { type: "key", x: 360, y: 470, height: 180, power: 40, colorTemp: 4300, modifier: "ディフュージョン#216" },
      { type: "practical", x: 280, y: 160, height: 250, power: 50, colorTemp: 2800, modifier: "なし(直射)" },
      { type: "practical", x: 720, y: 180, height: 220, power: 50, colorTemp: 3200, modifier: "なし(直射)" },
    ],
    defaultOptions: ["bokeh"],
  },
  {
    id: "midday-silk", modes: ["outdoor"], group: "屋外撮影",
    name: "真昼: オーバーヘッドシルク",
    desc: "最悪の光といわれる真上からの直射日光を、頭上の12x12シルクで大面積の柔光に変える。シルク外の背景は日なたのままなので、被写体が1段暗くなりHMIかレフで背景と露出を合わせる。",
    tags: ["真昼", "ディフューズ", "ロケ"],
    subjectType: "person", bgStyle: "sky",
    look: "頭上の硬い影が消え、肌が滑らかに。背景の日なたと自然に馴染む昼のクリーンな画。",
    camera: { shotSize: "WS", angle: "eye", move: "fix", lens: "50", aperture: "F4", shutter: "1/250", iso: "100", fps: "24fps", wb: "5600K" },
    items: [
      { type: "sun", x: 500, y: 180, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
      { type: "diff", x: 500, y: 330, height: 280, power: 0, colorTemp: 0, modifier: "12x12シルク(頭上)" },
      { type: "hmi", x: 340, y: 490, height: 200, power: 50, colorTemp: 5600, modifier: "ディフュージョン#250" },
      { type: "flag", x: 680, y: 420, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "noon-backlit", modes: ["outdoor"], group: "屋外撮影",
    name: "日中逆光 + HMIフィル",
    desc: "太陽を常に被写体の後ろに置き、輪郭光として使う。顔はHMI(またはレフ)で1段アンダー程度に起こす。順光は影が汚いので原則使わない。背景が飛びやすいのでNDで絞りをコントロール。",
    tags: ["逆光", "デイエクステリア", "基本"],
    subjectType: "person", bgStyle: "sky",
    look: "輪郭に太陽のエッジライト、顔は柔らかく起きた自然な露出。抜けの良い屋外の基本形。",
    camera: { shotSize: "BS", angle: "eye", move: "handheld", lens: "85", aperture: "F2.8 (ND8)", shutter: "1/100", iso: "100", fps: "24fps", wb: "5600K" },
    items: [
      { type: "sun", x: 500, y: 110, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
      { type: "hmi", x: 350, y: 500, height: 200, power: 55, colorTemp: 5600, modifier: "ディフュージョン#250" },
      { type: "reflector", x: 650, y: 500, height: 120, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },
  {
    id: "overcast-diffuse", modes: ["outdoor"], group: "屋外撮影",
    name: "曇天 / オープンシェード",
    desc: "曇天や日陰の均一光を活かす。上からの平板な光にならないよう、黒フラッグで頭上を切り、白レフで目線方向から起こして立体感を作る。色温度は6500K前後に転ぶため WB 補正を忘れずに。",
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
    desc: "街灯・ネオン・ショーウィンドウをプラクティカルとして活かし、LEDチューブ(色付き)で顔にアクセント。ヘイズ+濡れた路面(散水)で光を倍増させる。画面内の光源は「理由のある光」に揃える。",
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
    id: "location-basecamp", modes: ["outdoor"], group: "屋外撮影",
    name: "ロケ基地レイアウト (機材車・ベース設営)",
    desc: "撮影セットの周辺配置の標準形。発電車は騒音のため現場から離して風下へ、ケーブルは1本道で引き回す。機材車は搬入動線の最短位置、ビデオビレッジ(監督・クライアント席)はカメラ後方の邪魔にならない位置。ロケバスと控えは日陰・トイレ動線を確保。",
    tags: ["ロジ", "機材車", "設営"],
    subjectType: "person", bgStyle: "sky",
    look: "本番セットの周囲に、動線が交差しない機材・車両・スタッフ配置。事故と待ち時間を減らす現場設計。",
    camera: { shotSize: "WS", angle: "eye", move: "fix", lens: "35", aperture: "F4", shutter: "1/100", iso: "100", fps: "24fps", wb: "5600K" },
    items: [
      { type: "sun", x: 650, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
      { type: "hmi", x: 340, y: 480, height: 220, power: 60, colorTemp: 5600, modifier: "ディフュージョン#250" },
      { type: "reflector", x: 650, y: 480, height: 120, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "truck", x: 100, y: 620, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "genny", x: 100, y: 120, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "locabus", x: 900, y: 620, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "cranetruck", x: 900, y: 130, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "village", x: 700, y: 590, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sound", x: 320, y: 260, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
  },

  /* =====================================================
   * 特殊効果 (SFX) — 雨・風・雪・爆発・火花・紙吹雪
   * =================================================== */
  {
    id: "rain-backlight", modes: ["outdoor", "video"], group: "特殊効果 (SFX)",
    name: "レインメイキング (雨+逆光)",
    desc: "レインマシン(散水クレーン)は必ず逆光に配置——順光の雨はほぼ写らない。強いバックライトで雨粒を白い線として描き、被写体は薄いキーで起こす。防水養生・漏電対策・俳優の保温を徹底。",
    tags: ["特効", "雨", "ドラマチック"],
    subjectType: "person", bgStyle: "night",
    look: "逆光に無数の雨の線が光る。濡れた髪と肌のハイライト。感情が溢れるクライマックスの画。",
    camera: { shotSize: "BS", angle: "eye", move: "dollyin", lens: "85", aperture: "F2.0", shutter: "1/50", iso: "800", fps: "24fps", wb: "4500K" },
    items: [
      { type: "rainmachine", x: 500, y: 90, height: 500, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "rim", x: 420, y: 140, height: 300, power: 95, colorTemp: 5600, modifier: "なし(直射)" },
      { type: "key", x: 340, y: 470, height: 190, power: 35, colorTemp: 4500, modifier: "ディフュージョン#216" },
      { type: "flag", x: 660, y: 450, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["rain"],
  },
  {
    id: "sfx-storm-wind", modes: ["video", "outdoor", "still"], group: "特殊効果 (SFX)",
    name: "ストームウィンド (大型送風)",
    desc: "大型送風機を斜め前45°に置き、髪・衣装・小物を大きくなびかせる。ハードな半逆光と組み合わせるとファッション誌の「嵐の中」の画になる。風は常時より「断続的に強弱」の方がドラマチック。砂・落ち葉を混ぜると風が可視化される。",
    tags: ["特効", "風", "ファッション"],
    subjectType: "person", bgStyle: "gradient",
    look: "髪と衣装が大きく流れ、静止画でも動きを感じる。硬い逆光がなびく髪を1本ずつ光らせる。",
    camera: { shotSize: "WS", angle: "low", move: "fix", lens: "85", aperture: "F4", shutter: "1/500", iso: "200", fps: "60fps", wb: "5600K" },
    items: [
      { type: "fan", x: 280, y: 460, height: 120, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "key", x: 350, y: 490, height: 220, power: 65, colorTemp: 5600, modifier: "ソフトボックス120cm" },
      { type: "rim", x: 660, y: 150, height: 260, power: 80, colorTemp: 5600, modifier: "なし(直射)" },
      { type: "flag", x: 720, y: 450, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["wind"],
  },
  {
    id: "sfx-explosion", modes: ["video", "outdoor"], group: "特殊効果 (SFX)",
    name: "爆発バック (パイロテクニクス)",
    desc: "被写体の後方に特効技師が管理する爆点を設定し、火球と黒煙を背景に「振り返らずに歩く」定番カット。ハイスピード(120fps以上)で撮ると火球の膨張が描写できる。爆発は一発勝負のためカメラは複数台回し。※有資格者・所轄届出・安全区域の設定が絶対条件。",
    tags: ["特効", "爆発", "アクション"],
    subjectType: "person", bgStyle: "sunset",
    look: "背後で膨らむ火球と黒煙、逆光で縁取られた人物のシルエット気味の歩き。アクション映画の象徴的な画。",
    camera: { shotSize: "FF", angle: "low", move: "track", lens: "85", aperture: "F5.6", shutter: "1/250", iso: "200", fps: "120fps(HS)", wb: "5000K" },
    items: [
      { type: "pyro", x: 500, y: 120, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "pyro", x: 330, y: 150, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "hmi", x: 340, y: 490, height: 200, power: 50, colorTemp: 5600, modifier: "ディフュージョン#250" },
      { type: "truck", x: 100, y: 620, height: 0, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["explosion"],
  },
  {
    id: "sfx-sparks", modes: ["video", "still"], group: "特殊効果 (SFX)",
    name: "スパークシャワー (火花の雨)",
    desc: "スパークマシンを高所2点から下向きに設置し、オレンジの火花を雨のように降らせる。火花自体が光源になるため地明かりは最小限、被写体は薄いキーのみ。ハイスピードで火花の軌跡が線から粒に変わる。床・機材は防炎シートで養生。",
    tags: ["特効", "火花", "MV"],
    subjectType: "person", bgStyle: "black",
    look: "オレンジの火花が降り注ぐ中に立つ人物。火花の粒が玉ボケになり、工業的でドラマチックな熱量。",
    camera: { shotSize: "FF", angle: "eye", move: "orbit", lens: "50", aperture: "F2.0", shutter: "1/250", iso: "800", fps: "120fps(HS)", wb: "3800K" },
    items: [
      { type: "spark", x: 350, y: 140, height: 400, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "spark", x: 650, y: 140, height: 400, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "key", x: 340, y: 480, height: 190, power: 30, colorTemp: 3800, modifier: "ディフュージョン#216" },
      { type: "flag", x: 700, y: 450, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["sparks"],
  },
  {
    id: "sfx-snow", modes: ["video", "outdoor", "still"], group: "特殊効果 (SFX)",
    name: "スノーメイキング (降雪)",
    desc: "スノーマシンを高所・風上に設置し、泡雪をゆっくり降らせる。雨と同じく逆光でしか綺麗に写らない。色温度を高め(青め)に振り、吐く息や肌の赤みと対比させると冬の空気になる。地面は白布や塩で連続性を作る。",
    tags: ["特効", "雪", "冬"],
    subjectType: "person", bgStyle: "bluehour",
    look: "青い空気の中を雪がゆっくり舞い、逆光にきらめく。頬と鼻先の赤みが冬の体感温度を伝える。",
    camera: { shotSize: "BS", angle: "eye", move: "dollyin", lens: "85", aperture: "F2.0", shutter: "1/100", iso: "400", fps: "60fps", wb: "6500K" },
    items: [
      { type: "snowmachine", x: 400, y: 100, height: 450, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "rim", x: 560, y: 140, height: 300, power: 85, colorTemp: 6500, modifier: "なし(直射)" },
      { type: "key", x: 350, y: 480, height: 200, power: 40, colorTemp: 5000, modifier: "ソフトボックス120cm" },
    ],
    defaultOptions: ["snow"],
  },
  {
    id: "sfx-confetti", modes: ["video", "still"], group: "特殊効果 (SFX)",
    name: "紙吹雪フィナーレ (コンフェッティ)",
    desc: "紙吹雪キャノンを左右から打ち上げ、送風機の弱風で滞空時間を稼ぐ。明るいハイキー気味のライティングで祝祭感を出し、金銀紙は光を反射してきらめく。打ち上げ後の数秒が最も画になるのでカメラは先に回す。",
    tags: ["特効", "紙吹雪", "祝祭"],
    subjectType: "person", bgStyle: "white",
    look: "色とりどりの紙吹雪が舞う中の笑顔。明るく開放的で、勝利や祝福のクライマックス。",
    camera: { shotSize: "WS", angle: "low", move: "crane", lens: "35", aperture: "F4", shutter: "1/250", iso: "200", fps: "60fps", wb: "5500K" },
    items: [
      { type: "confetti", x: 250, y: 250, height: 100, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "confetti", x: 750, y: 250, height: 100, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "fan", x: 280, y: 470, height: 120, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "key", x: 400, y: 520, height: 220, power: 65, colorTemp: 5500, modifier: "オクタボックス150cm" },
      { type: "bg", x: 300, y: 130, height: 120, power: 90, colorTemp: 5500, modifier: "アンブレラ(反射)" },
      { type: "bg", x: 700, y: 130, height: 120, power: 90, colorTemp: 5500, modifier: "アンブレラ(反射)" },
    ],
    defaultOptions: ["confetti"],
  },
  {
    id: "sfx-smoke-beam", modes: ["video", "still"], group: "特殊効果 (SFX)",
    name: "スモーク+光条 (ゴッドレイ)",
    desc: "スモークを濃いめに焚き、グリッドを付けた硬いバックライトで「見える光の柱」を作る。被写体は光条の中にシルエット〜半シルエットで立たせる。スモークは撹拌して均一に、換気とテイク間の充満待ちを段取りに含める。",
    tags: ["特効", "スモーク", "光条"],
    subjectType: "person", bgStyle: "black",
    look: "闇の中に光の柱が立ち、その中に人物のシルエット。神々しく象徴的なオープニングカット。",
    camera: { shotSize: "FF", angle: "low", move: "dollyin", lens: "35", aperture: "F2.8", shutter: "1/50", iso: "800", fps: "24fps", wb: "5600K" },
    items: [
      { type: "smoke", x: 750, y: 150, height: 50, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "rim", x: 500, y: 110, height: 320, power: 95, colorTemp: 5600, modifier: "グリッド30°" },
      { type: "rim", x: 320, y: 150, height: 300, power: 60, colorTemp: 5600, modifier: "グリッド10°" },
      { type: "fill", x: 500, y: 540, height: 120, power: 10, colorTemp: 5600, modifier: "アンブレラ(透過)" },
    ],
    defaultOptions: ["haze", "silhouette"],
  },

  /* =====================================================
   * ドローン基本ムーブ
   * =================================================== */
  {
    id: "drone-orbit", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "オービット (POI回り込み)",
    desc: "被写体を中心に半径を保って円軌道(POI機能)。高度とジンバル角を一定に保ち、背景が流れて被写体が主役に。1周10〜15秒が基準。半径を徐々に詰める/広げると感情の変化を作れる。",
    tags: ["ドローン", "オービット", "基本"],
    subjectType: "person", bgStyle: "sky",
    look: "被写体を中心に世界が回る。背景の風景が滑らかに流れ、スケール感と主役感を両立。",
    camera: { shotSize: "FF", angle: "high", move: "d_orbit", lens: "24", aperture: "F2.8", shutter: "1/50", iso: "100", fps: "30fps", wb: "5600K" },
    items: [
      { type: "drone", x: 340, y: 200, height: 1000, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 700, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-reveal", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "リビール (上昇開示)",
    desc: "手前の障害物(木・建物・崖)越しに低空から上昇し、隠れていた壮大な景色を開示する。動画の冒頭カットの定番。前進+上昇+ティルトダウン→アップの複合操作。開示の瞬間に音楽のドロップを合わせる。",
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
    id: "drone-topdown", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "真俯瞰 (トップダウン)",
    desc: "真下90°を見下ろす神の視点。地形・道路・水面がグラフィックデザインのような抽象的な画になる。ゆっくり上昇 or 一定高度の直進トラッキングが基本。太陽が低い時間帯は自機の影の写り込みに注意。",
    tags: ["ドローン", "俯瞰", "グラフィカル"],
    subjectType: "car", bgStyle: "sky",
    look: "真上から見た抽象的な構図。被写体が図形として整理され、動きが軌跡として見える。",
    camera: { shotSize: "LS", angle: "birds", move: "d_topdown", lens: "24", aperture: "F4", shutter: "1/60", iso: "100", fps: "30fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 330, height: 2000, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 700, y: 120, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-side", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "並走トラッキング (サイド)",
    desc: "走る被写体(車・ランナー・列車)の真横を同速度で並走。背景が流れ、速度感が最も伝わる構図。障害物の少ない側を選び、被写体との距離・高度を一定に保つ。広角なら近く、望遠なら離れて圧縮。",
    tags: ["ドローン", "並走", "速度感"],
    subjectType: "car", bgStyle: "sky",
    look: "被写体は画面に固定され、背景だけが高速で流れる。疾走感と映画的な安定感。",
    camera: { shotSize: "FF", angle: "eye", move: "d_side", lens: "35", aperture: "F4", shutter: "1/100", iso: "100", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 260, y: 330, height: 250, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 650, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-pullback", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "プルバック (引きのエンディング)",
    desc: "被写体から後退しながら上昇し、周囲の環境を開示していく。物語の「終わり」を告げる文法で、エンドロールやシーン転換に最適。速度は一定より「徐々に加速」がエモーショナル。",
    tags: ["ドローン", "エンディング", "引き"],
    subjectType: "person", bgStyle: "sunset",
    look: "人物が徐々に風景の一部になっていく。余韻と寂寥感、物語の締めくくり。",
    camera: { shotSize: "ELS", angle: "high", move: "d_pullback", lens: "24", aperture: "F2.8", shutter: "1/50", iso: "100", fps: "24fps", wb: "5000K" },
    items: [
      { type: "drone", x: 500, y: 500, height: 800, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 500, y: 90, height: 1000, power: 100, colorTemp: 3200, modifier: "なし(直射)" },
    ],
    defaultOptions: ["lensflare"],
  },
  {
    id: "drone-dronie", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "ドローニー (後退上昇セルフィー)",
    desc: "被写体の顔アップから始まり、後退+上昇で一気に引いて壮大なロケーションを見せる。SNSで最もバズりやすい定番ムーブ。開始フレームで被写体をしっかり固定してから引き始めるのがコツ。",
    tags: ["ドローン", "SNS", "セルフィー"],
    subjectType: "person", bgStyle: "sky",
    look: "顔のアップから数秒で大絶景へ。スケールのジャンプが笑いと驚きを生む。",
    camera: { shotSize: "CU", angle: "eye", move: "d_dronie", lens: "24", aperture: "F2.8", shutter: "1/60", iso: "100", fps: "30fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 450, height: 170, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 300, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },

  /* =====================================================
   * ドローン応用 (FPV・シネマティック)
   * =================================================== */
  {
    id: "drone-fpv-chase", modes: ["outdoor"], group: "ドローン応用 (FPV・シネマティック)",
    name: "FPV追跡 (チェイス)",
    desc: "FPV機で走る被写体(車・人・バイク)を低空高速追跡。障害物ギリギリを抜けるダイブやフリップで没入感を演出。安全マージンとロケハン必須。プロポの感度設定とシミュレーター練習が前提。",
    tags: ["FPV", "スピード", "没入感"],
    subjectType: "car", bgStyle: "sky",
    look: "地面すれすれの疾走感。被写体に食らいつくカメラ、流れる背景、ダイナミックな機動。",
    camera: { shotSize: "FF", angle: "low", move: "d_chase", lens: "14", aperture: "F2.8", shutter: "1/120", iso: "200", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 560, height: 150, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 650, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-dive", modes: ["outdoor"], group: "ドローン応用 (FPV・シネマティック)",
    name: "FPVダイブ (急降下)",
    desc: "高層ビル・崖・滝の縁から機首を下げ、壁面に沿って垂直落下する。落下中は壁との距離を一定に保つと速度感が最大化。ND フィルターでシャッターを 1/2fps 目安にしモーションブラーを確保。",
    tags: ["FPV", "ダイブ", "アドレナリン"],
    subjectType: "arch", bgStyle: "sky",
    look: "壁面が猛速で流れ落ちる圧倒的な落下感。ジェットコースターの一人称視点。",
    camera: { shotSize: "LS", angle: "birds", move: "d_dive", lens: "14", aperture: "F2.8", shutter: "1/60", iso: "100", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 200, height: 4000, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 700, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-spiral", modes: ["outdoor"], group: "ドローン応用 (FPV・シネマティック)",
    name: "スパイラル上昇",
    desc: "オービットしながら一定レートで上昇し、被写体を中心に螺旋を描く。タワー・灯台・巨木など縦に長い被写体で真価を発揮。上昇と旋回の速度比を一定に保つのが美しさの鍵。",
    tags: ["ドローン", "スパイラル", "タワー"],
    subjectType: "arch", bgStyle: "sky",
    look: "建造物に巻き付くように上昇する視点。高さと形状が立体的に伝わるダイナミズム。",
    camera: { shotSize: "LS", angle: "high", move: "d_spiral", lens: "24", aperture: "F4", shutter: "1/60", iso: "100", fps: "30fps", wb: "5600K" },
    items: [
      { type: "drone", x: 300, y: 250, height: 1500, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 700, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-lowpass", modes: ["outdoor"], group: "ドローン応用 (FPV・シネマティック)",
    name: "ローパス (地表すれすれ)",
    desc: "水面・麦畑・砂丘の表面すれすれ(高度1〜3m)を高速直進。地表のテクスチャが猛速で流れ、突入感が生まれる。障害物センサーはOFFになるため事前の徹底したコース確認が必須。",
    tags: ["ドローン", "ローパス", "スピード"],
    subjectType: "arch", bgStyle: "sky",
    look: "足元の地表が滝のように流れ、正面の景色へ突っ込んでいく没入感。",
    camera: { shotSize: "ELS", angle: "low", move: "d_lowpass", lens: "14", aperture: "F4", shutter: "1/60", iso: "100", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 560, height: 150, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 350, y: 100, height: 3000, power: 100, colorTemp: 5200, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-dollyzoom", modes: ["outdoor"], group: "ドローン応用 (FPV・シネマティック)",
    name: "空撮ドリーズーム (めまい)",
    desc: "後退しながらズームインし、被写体の大きさを保ったまま背景だけが迫る「めまい」効果。ズーム搭載機で被写体をフレーム中央に固定し、後退速度とズーム速度を同期させる。使いすぎ注意の劇薬。",
    tags: ["ドローン", "ドリーズーム", "特殊効果"],
    subjectType: "arch", bgStyle: "sunset",
    look: "被写体は動かないのに世界が歪んで迫る違和感。心理的な不安と高揚。",
    camera: { shotSize: "FF", angle: "eye", move: "d_dzoom", lens: "50", aperture: "F4", shutter: "1/60", iso: "100", fps: "30fps", wb: "5000K" },
    items: [
      { type: "drone", x: 500, y: 520, height: 400, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 650, y: 90, height: 1000, power: 100, colorTemp: 3400, modifier: "なし(直射)" },
    ],
  },
];

/* =====================================================
   * MASTER_CINEMATOGRAPHY_OS_V4.md 由来の追加技法
   * (cineos/knowledge PART 8-24 からの移植)
   * =================================================== */
PRESETS.push(
  /* --- 飲料・液体 (PART 9) --- */
  {
    id: "whisky-highball", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "ウイスキー/ハイボール: 琥珀の透過",
    desc: "琥珀色の液体エッジを硬めのバックライトで透過させ、氷のスペキュラーと炭酸の気泡を立てる。冷たい環境光×温かい液色の対比が鉄則。氷はアクリル氷も併用し、マクロで結露を寄る。",
    tags: ["ウイスキー", "琥珀", "氷"],
    subjectType: "bottle", bgStyle: "black",
    look: "漆黒の中で琥珀色が内側から発光し、氷の面がきらめく。大人の時間の一杯。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F8", shutter: "1/200", iso: "100", fps: "-", wb: "5000K" },
    items: [
      { type: "bg",  x: 500, y: 150, height: 80, power: 85, colorTemp: 4300, modifier: "ディフュージョン#216" },
      { type: "rim", x: 340, y: 200, height: 90, power: 70, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "top", x: 500, y: 250, height: 160, power: 35, colorTemp: 6500, modifier: "グリッド30°" },
      { type: "flag", x: 660, y: 340, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["droplets", "gloss"],
  },
  {
    id: "wine-red", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "赤ワイン: バック/サイド透過",
    desc: "赤はバック〜サイドの透過で液色を出し、エレガントな暖色プラクティカルを背景に置く。ステム(脚)の写り込みは白カードの位置で1本に制御。白ワインはクール寄りの透過+微結露。",
    tags: ["ワイン", "透過", "エレガント"],
    subjectType: "bottle", bgStyle: "dark",
    look: "深いガーネットの透過色、グラスの脚に一本の端正なハイライト。上質なレストランの空気。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F8", shutter: "1/160", iso: "100", fps: "-", wb: "4800K" },
    items: [
      { type: "bg",  x: 620, y: 150, height: 90, power: 75, colorTemp: 5200, modifier: "ディフュージョン#216" },
      { type: "practical", x: 320, y: 160, height: 120, power: 25, colorTemp: 2700, modifier: "なし(直射)" },
      { type: "reflector", x: 350, y: 300, height: 70, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 660, y: 380, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss", "bokeh"],
  },
  {
    id: "serum", modes: ["still", "video"], group: "商品撮影 (プロダクト)",
    name: "美容液/セラム: 透過とコースティクス",
    desc: "半透明の液体をバックライトで透かし、粘度とスポイトのマクロで「とろみ」を見せる。ガラス越しの光が作るコースティクス(光の模様)を白面に落とすと透明感が倍増する。",
    tags: ["コスメ", "透明感", "マクロ"],
    subjectType: "cosme", bgStyle: "bright",
    look: "光を含んだ透明の雫がスポイトから伸びる。清潔で高機能な美容の画。",
    camera: { shotSize: "ECU", angle: "eye", move: "fix", lens: "100m", aperture: "F11", shutter: "1/200", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",  x: 500, y: 150, height: 80, power: 95, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "top", x: 500, y: 260, height: 150, power: 40, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "flag", x: 340, y: 330, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 660, y: 330, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss", "droplets"],
  },
  {
    id: "lipstick", modes: ["still"], group: "商品撮影 (プロダクト)",
    name: "リップスティック: 精密スペキュラー",
    desc: "口紅の面に正確なエッジハイライトを走らせるストリップ2灯+黒締め。ターンテーブル(回転台)でハイライトの流れを選ぶ。マクロで質感の粒立ちまで解像させる。",
    tags: ["コスメ", "マクロ", "エッジ"],
    subjectType: "cosme", bgStyle: "black",
    look: "漆黒に浮かぶ艶のエッジライン。彩度の高いリップカラーが主役の一枚。",
    camera: { shotSize: "ECU", angle: "eye", move: "orbit", lens: "100m", aperture: "F13", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 330, y: 230, height: 90, power: 60, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim", x: 670, y: 230, height: 90, power: 55, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 500, y: 130, height: 80, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["gloss"],
  },

  /* --- ハイスピード・リキッド (PART 21/23) --- */
  {
    id: "powder-burst", modes: ["still", "video"], group: "ハイスピード・リキッド",
    name: "パウダーバースト (粉体飛散)",
    desc: "粉体は「バックライト+ハイスピード」が鉄則。黒背景で硬いサイド〜バックライトを当て、粉の一粒一粒を光で拾う。エアジェットで吹き上げ、複数テイク前提。清掃と機材養生を段取りに含める。",
    tags: ["パウダー", "ハイスピード", "黒背景"],
    subjectType: "cosme", bgStyle: "black",
    look: "闇の中で色粉が爆ぜ、逆光に粒子の輪郭が光る。エネルギーの静止画。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F8", shutter: "1/8000", iso: "400", fps: "1000fps(HS)", wb: "5500K" },
    items: [
      { type: "rim", x: 330, y: 180, height: 120, power: 90, colorTemp: 5500, modifier: "なし(直射)" },
      { type: "rim", x: 670, y: 180, height: 120, power: 90, colorTemp: 5500, modifier: "なし(直射)" },
      { type: "fan", x: 280, y: 460, height: 80, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 500, y: 540, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["splash", "wind"],
  },
  {
    id: "water-crown", modes: ["still"], group: "ハイスピード・リキッド",
    name: "ウォータークラウン (王冠水滴)",
    desc: "電子ドロップコントローラーで水滴を正確なタイミングで落とし、マクロ+ハイスピード+バックライトで王冠を凍結する。液体の粘度(牛乳/増粘剤)で王冠の形が決まる。",
    tags: ["水滴", "マクロ", "ハイスピード"],
    subjectType: "cosme", bgStyle: "dark",
    look: "水面に王冠が立ち上がる一瞬。物理の美しさをそのまま閉じ込めた画。",
    camera: { shotSize: "ECU", angle: "eye", move: "fix", lens: "100m", aperture: "F16", shutter: "1/10000", iso: "400", fps: "-", wb: "5500K" },
    items: [
      { type: "bg",  x: 500, y: 150, height: 70, power: 90, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "rim", x: 340, y: 200, height: 80, power: 70, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "flag", x: 660, y: 330, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["splash", "droplets"],
  },
  {
    id: "water-pour", modes: ["still", "video"], group: "ハイスピード・リキッド",
    name: "ポア (注ぎ)",
    desc: "注ぎの形は液体の粘度と容器の口で管理する。透過光で液流を光らせ、120〜500fpsで滑らかに。グラス内の対流と泡も画になる。注ぎ手の再現性のためポンプ/バルブ制御も検討。",
    tags: ["注ぎ", "液体", "シズル"],
    subjectType: "bottle", bgStyle: "bright",
    look: "光を含んだ液体の帯がグラスに吸い込まれ、飛沫が舞う。飲みたくなる瞬間の画。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "85", aperture: "F5.6", shutter: "1/1000", iso: "200", fps: "240fps(HS)", wb: "5500K" },
    items: [
      { type: "bg",  x: 500, y: 150, height: 80, power: 95, colorTemp: 5500, modifier: "ディフュージョン#216" },
      { type: "top", x: 500, y: 250, height: 170, power: 35, colorTemp: 5500, modifier: "グリッド30°" },
      { type: "flag", x: 340, y: 340, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "flag", x: 660, y: 340, height: 60, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["splash", "gloss"],
  },

  /* --- フード撮影 (PART 10) --- */
  {
    id: "burger", modes: ["still", "video"], group: "フード撮影",
    name: "バーガー: テクスチャ半逆光",
    desc: "バック〜サイドのキーでバンズとパティの質感を立て、前面はフィルで起こす。湯気+グリセリン/オイルの照りは控えめに丁寧に。マクロ気味の浅い被写界深度で断面のシズルに寄る。",
    tags: ["バーガー", "シズル", "マクロ"],
    subjectType: "food", bgStyle: "dark",
    look: "バンズの照り、チーズのとろけ、立ち上る湯気。断面のレイヤーが主役のヒーローショット。",
    camera: { shotSize: "CU", angle: "eye", move: "dollyin", lens: "100m", aperture: "F4", shutter: "1/125", iso: "200", fps: "30fps", wb: "5000K" },
    items: [
      { type: "key", x: 650, y: 180, height: 130, power: 75, colorTemp: 5200, modifier: "ソフトボックス120cm" },
      { type: "fill", x: 400, y: 520, height: 90, power: 30, colorTemp: 5200, modifier: "ディフュージョン#216" },
      { type: "flag", x: 300, y: 300, height: 70, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["steam", "gloss"],
  },
  {
    id: "fried-chicken", modes: ["still", "video"], group: "フード撮影",
    name: "フライドチキン: 衣のハードサイド",
    desc: "衣のザクザク感は硬めのサイドキーで影を立てて描く。色温度は暖色寄り(4300K前後)で揚げ物の食欲色に。ちぎる瞬間の湯気とパン粉の飛散はハイスピードで。",
    tags: ["揚げ物", "テクスチャ", "湯気"],
    subjectType: "food", bgStyle: "dark",
    look: "衣の凹凸に硬い光が食い込み、割った断面から湯気。音まで聞こえそうなザクザク感。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F5.6", shutter: "1/250", iso: "400", fps: "120fps(HS)", wb: "4300K" },
    items: [
      { type: "key", x: 300, y: 250, height: 120, power: 80, colorTemp: 4300, modifier: "グリッド30°" },
      { type: "rim", x: 680, y: 180, height: 130, power: 45, colorTemp: 4800, modifier: "ストリップボックス30x120" },
      { type: "reflector", x: 620, y: 500, height: 50, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["steam"],
  },
  {
    id: "icecream", modes: ["still"], group: "フード撮影",
    name: "アイスクリーム: 冷感管理",
    desc: "溶けとの時間勝負。トップソフト+リムで冷たさを描き、セッティングはスタンドイン(偽ヒーロー)で完成させ、本物は最後に置いて数十秒で撮り切る。ドライアイスの冷気やフロストで冷感を足す。",
    tags: ["アイス", "冷感", "時間勝負"],
    subjectType: "food", bgStyle: "bright",
    look: "スクープの角が立ち、表面にフロストの微結晶。溶ける前の完璧な一瞬。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F8", shutter: "1/200", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "top", x: 500, y: 250, height: 170, power: 60, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "rim", x: 650, y: 170, height: 120, power: 45, colorTemp: 6000, modifier: "ストリップボックス30x120" },
      { type: "reflector", x: 350, y: 500, height: 50, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["droplets"],
  },

  /* --- ビューティー詳細 (PART 11) --- */
  {
    id: "glass-skin", modes: ["still", "video"], group: "人物スチール",
    name: "Glass Skin (水光肌)",
    desc: "広いスペキュラー(面の写り込み)で肌をガラスのように艶めかせる。大面積ソフトをやや横から当てて艶のグラデーションを作り、保湿剤で表面を整える。偏光は使いすぎると艶が死ぬので注意。",
    tags: ["ビューティー", "艶", "韓国系"],
    subjectType: "person", bgStyle: "gradient",
    look: "頬骨のハイライトが濡れたように光る水光肌。透明感の極致。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "100m", aperture: "F4", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 340, y: 430, height: 210, power: 70, colorTemp: 5500, modifier: "オクタボックス150cm" },
      { type: "fill", x: 500, y: 470, height: 60, power: 25, colorTemp: 5500, modifier: "ソフトボックス60cm" },
      { type: "rim", x: 680, y: 180, height: 230, power: 35, colorTemp: 5500, modifier: "ストリップボックス30x120" },
    ],
    defaultOptions: ["gloss"],
  },
  {
    id: "hair-motion", modes: ["still", "video"], group: "人物スチール",
    name: "ヘアモーション (なびく髪)",
    desc: "髪はバック/リムで背景から分離するのが大前提。送風機で動きを作り、50〜120fpsで滑らかに。サイド〜バックの光が1本1本を光らせる。ヘアスプレーの艶も光の角度で拾う。",
    tags: ["ヘア", "リム", "動き"],
    subjectType: "person", bgStyle: "dark",
    look: "浮き上がった髪の一本一本が光の線になる。シャンプーCMの決め画。",
    camera: { shotSize: "BS", angle: "eye", move: "fix", lens: "85", aperture: "F4", shutter: "1/500", iso: "400", fps: "120fps(HS)", wb: "5500K" },
    items: [
      { type: "key", x: 380, y: 480, height: 210, power: 60, colorTemp: 5500, modifier: "ソフトボックス120cm" },
      { type: "rim", x: 300, y: 170, height: 250, power: 75, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "rim", x: 700, y: 170, height: 250, power: 75, colorTemp: 5500, modifier: "ストリップボックス30x120" },
      { type: "fan", x: 280, y: 460, height: 120, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["wind"],
  },
  {
    id: "eyewear", modes: ["still", "video"], group: "人物スチール",
    name: "アイウェア (眼鏡の反射制御)",
    desc: "レンズ反射とフレーム影が二大課題。ライトを高めに上げ、大面積ソフトで写り込みを整理し、偏光と「あご/テンプルのわずかな角度」で反射を逃がす。レンズに写す白カードをデザインする発想も有効。",
    tags: ["眼鏡", "反射制御", "ポートレート"],
    subjectType: "person", bgStyle: "gradient",
    look: "レンズはクリアに目が見え、フレームの影が頬に落ちない端正なポートレート。",
    camera: { shotSize: "CU", angle: "eye", move: "fix", lens: "85", aperture: "F4", shutter: "1/160", iso: "100", fps: "-", wb: "5500K" },
    items: [
      { type: "key", x: 360, y: 460, height: 260, power: 70, colorTemp: 5500, modifier: "オクタボックス150cm" },
      { type: "fill", x: 640, y: 500, height: 150, power: 25, colorTemp: 5500, modifier: "アンブレラ(透過)" },
      { type: "reflector", x: 500, y: 440, height: 50, power: 0, colorTemp: 0, modifier: "なし(直射)" },
    ],
    defaultOptions: ["matte"],
  },

  /* --- ライティング応用 / 特効 --- */
  {
    id: "cove-light", modes: ["video", "still"], group: "人物ライティング (応用)",
    name: "コーブライト (大面積の回り込み)",
    desc: "複数灯を1つの巨大な面光源として形成し、白ホリの壁面バウンスで全周から光を回す。影がほぼ消える広告的な明るさで、車・ファッション・ダンスの白ホリ撮影の土台になる。",
    tags: ["白ホリ", "大面積", "回り込み"],
    subjectType: "person", bgStyle: "white",
    look: "どこにも硬い影のない、白く満ちた光。清潔で未来的な空間感。",
    camera: { shotSize: "FF", angle: "eye", move: "gimbal", lens: "35", aperture: "F5.6", shutter: "1/50", iso: "200", fps: "24fps", wb: "5600K" },
    items: [
      { type: "bg", x: 250, y: 130, height: 200, power: 90, colorTemp: 5600, modifier: "アンブレラ(反射)" },
      { type: "bg", x: 500, y: 110, height: 200, power: 90, colorTemp: 5600, modifier: "アンブレラ(反射)" },
      { type: "bg", x: 750, y: 130, height: 200, power: 90, colorTemp: 5600, modifier: "アンブレラ(反射)" },
      { type: "key", x: 400, y: 520, height: 230, power: 55, colorTemp: 5600, modifier: "オクタボックス150cm" },
    ],
  },
  {
    id: "dryice-lowfog", modes: ["video", "still"], group: "特殊効果 (SFX)",
    name: "ドライアイス (低く這う霧)",
    desc: "ドライアイス(低温フォグ)は床を低く流れるのが特徴。足元を照らすローポジションのバックライトで霧の層を光らせる。換気と酸欠防止、素手で触らない等の取り扱い注意。",
    tags: ["特効", "霧", "幻想"],
    subjectType: "person", bgStyle: "black",
    look: "足元を白い霧が川のように流れ、被写体が幻想の中に立つ。",
    camera: { shotSize: "FF", angle: "low", move: "dollyin", lens: "35", aperture: "F2.8", shutter: "1/50", iso: "800", fps: "24fps", wb: "5000K" },
    items: [
      { type: "smoke", x: 750, y: 400, height: 20, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "rim", x: 400, y: 160, height: 40, power: 70, colorTemp: 6000, modifier: "なし(直射)" },
      { type: "key", x: 340, y: 470, height: 200, power: 45, colorTemp: 5000, modifier: "ソフトボックス120cm" },
    ],
    defaultOptions: ["haze"],
  },

  /* --- ドローン語彙の追加 (PART 16.7) --- */
  {
    id: "drone-lead", modes: ["outdoor"], group: "ドローン基本ムーブ",
    name: "リード (前方後退)",
    desc: "走る被写体の前方に位置し、同速で後退しながら正面の表情を撮る。被写体との距離を一定に保つのが鍵。表情+背景の流れが同時に撮れる、走り/車/バイクの正面ヒーローショット。",
    tags: ["ドローン", "正面", "疾走"],
    subjectType: "person", bgStyle: "sky",
    look: "被写体は画面に固定され、世界が背後へ流れ去る。追われるような疾走の正面画。",
    camera: { shotSize: "BS", angle: "eye", move: "d_lead", lens: "35", aperture: "F4", shutter: "1/100", iso: "100", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 480, height: 180, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 650, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
  {
    id: "drone-fpv-gap", modes: ["outdoor"], group: "ドローン応用 (FPV・シネマティック)",
    name: "FPVギャップ (狭所通過)",
    desc: "窓・橋脚・木々の間など狭い隙間を高速で通過するFPV必殺技。通過の瞬間に世界が切り替わるトランジションとしても機能する。予備機とプロップガード、綿密なコース設計が前提。",
    tags: ["FPV", "ギャップ", "トランジション"],
    subjectType: "arch", bgStyle: "sky",
    look: "隙間の暗がりを抜けた瞬間、視界が開ける。ゲームのような没入トランジション。",
    camera: { shotSize: "LS", angle: "eye", move: "d_gap", lens: "14", aperture: "F2.8", shutter: "1/120", iso: "200", fps: "60fps", wb: "5600K" },
    items: [
      { type: "drone", x: 500, y: 540, height: 200, power: 0, colorTemp: 0, modifier: "なし(直射)" },
      { type: "sun", x: 350, y: 100, height: 3000, power: 100, colorTemp: 5600, modifier: "なし(直射)" },
    ],
  },
);

/* ---------- 背景スタイル (プレビュー描画用) ---------- */
const BG_STYLES = {
  dark:     { top: "#2a2e38", bottom: "#14161b", en: "dark gradient studio background" },
  black:    { top: "#0a0a0c", bottom: "#000000", en: "pitch black background" },
  white:    { top: "#ffffff", bottom: "#e8e8ec", en: "pure white seamless background" },
  gradient: { top: "#5a6478", bottom: "#232834", en: "soft gray gradient background" },
  bright:   { top: "#f5f0e6", bottom: "#d8d0c0", en: "bright glowing backdrop" },
  day:      { top: "#f7f2e8", bottom: "#ddd2c2", en: "bright daylight interior" },
  sunset:   { top: "#ff9a56", bottom: "#5b3a6e", en: "golden hour sunset sky" },
  bluehour: { top: "#27437a", bottom: "#0d1830", en: "deep blue twilight sky (blue hour)" },
  night:    { top: "#1a1035", bottom: "#0a0618", en: "neon-lit night city street" },
  sky:      { top: "#7db8e8", bottom: "#cfe8f5", en: "wide open sky and landscape" },
  green:    { top: "#4cbf6b", bottom: "#2f9c50", en: "even chroma-key green screen background" },
  gel:      { top: "#c94fd4", bottom: "#1f4fd8", en: "magenta and cyan duotone gel-lit background" },
};
