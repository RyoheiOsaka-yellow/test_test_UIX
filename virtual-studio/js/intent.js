/* =========================================================
 * CineOS 移植: IntentParser (cineos/CLAUDE.md §5, §8)
 * 自由文の日本語 (+一部英語) をルールベースで解釈し、
 * ベース技法プリセット + 上書き設定 + 「解釈の根拠」リストを返す。
 * 例: 「夜の豪雨。主人公が路地を走り、後方で大きな爆発。35mm映画の緊張感。」
 * すべての推定は assumptions として明示し、ユーザーが修正できるようにする。
 * ======================================================= */

"use strict";

/* 追加機材のデフォルト配置 (俯瞰図座標) */
const INTENT_ITEM_POS = {
  rainmachine: { x: 500, y: 90, height: 500 },
  snowmachine: { x: 400, y: 100, height: 450 },
  fan: { x: 280, y: 460, height: 120 },
  smoke: { x: 750, y: 150, height: 50 },
  pyro: { x: 500, y: 120, height: 0 },
  spark: { x: 350, y: 140, height: 400 },
  confetti: { x: 250, y: 250, height: 100 },
};

function parseIntent(text) {
  const t = String(text || "").trim();
  const A = [];           // assumptions: {label, value, ev}
  const R = {             // 解釈結果
    presetId: null, presetWhy: "",
    subjectType: null, action: null, subjectNote: "",
    options: [], addItems: [],
    weather: null, timeOfDay: null, bgStyle: null,
    aspect: null, look: null, duration: null,
    camera: {},           // 上書き: shotSize/angle/move/focalMm/fps/body など
  };
  const has = (re) => { const m = t.match(re); return m ? m[0] : null; };
  const note = (label, value, ev) => A.push({ label, value, ev });

  /* ---------- 天候 ---------- */
  let ev;
  if ((ev = has(/豪雨|土砂降り|大雨|どしゃ降り/))) {
    R.weather = "rainy"; R.options.push("rain"); R.addItems.push("rainmachine");
    note("天候", "雨 (レインマシン+逆光前提)", ev);
  } else if ((ev = has(/雨/))) {
    R.weather = "rainy"; R.options.push("rain"); R.addItems.push("rainmachine");
    note("天候", "雨", ev);
  } else if ((ev = has(/吹雪|雪/))) {
    R.weather = "snowy"; R.options.push("snow"); R.addItems.push("snowmachine");
    note("天候", "雪", ev);
  } else if ((ev = has(/霧|靄|もや/))) {
    R.weather = "foggy"; R.options.push("haze");
    note("天候", "霧 (ヘイズ)", ev);
  } else if ((ev = has(/曇/))) { R.weather = "cloudy"; note("天候", "曇天", ev); }
  else if ((ev = has(/快晴|晴れ/))) { R.weather = "clear"; note("天候", "快晴", ev); }
  if ((ev = has(/強風|暴風|風が|風の|嵐/))) {
    if (!R.options.includes("wind")) { R.options.push("wind"); R.addItems.push("fan"); }
    note("風", "送風あり", ev);
  }

  /* ---------- 時間帯 ---------- */
  if ((ev = has(/夜明け|明け方|早朝/))) { R.timeOfDay = "dawn"; note("時間帯", "早朝 (夜明け)", ev); }
  else if ((ev = has(/ブルーアワー|薄暮|トワイライト/))) { R.timeOfDay = "blue"; R.bgStyle = "bluehour"; note("時間帯", "ブルーアワー", ev); }
  else if ((ev = has(/夕暮れ|夕方|夕陽|夕日|日没|ゴールデンアワー|マジックアワー/))) { R.timeOfDay = "golden"; R.bgStyle = "sunset"; note("時間帯", "ゴールデンアワー", ev); }
  else if ((ev = has(/深夜|真夜中|夜/))) { R.timeOfDay = "night"; R.bgStyle = "night"; note("時間帯", "夜", ev); }
  else if ((ev = has(/真昼|正午/))) { R.timeOfDay = "noon"; note("時間帯", "正午 (トップ光)", ev); }
  else if ((ev = has(/朝/))) { R.timeOfDay = "morning"; note("時間帯", "午前", ev); }

  /* ---------- 被写体 ---------- */
  const subjMap = [
    [/主人公|男性|女性|男の|女の|人物|モデル|俳優|彼女|彼|子供|老人|アスリート|ダンサー/, "person", "人物"],
    [/ビール|ワイン|ウイスキー|ハイボール|日本酒|香水|ボトル|瓶|ドリンク|飲料|ジュース|コーヒー|カクテル/, "bottle", "ボトル/飲料"],
    [/コスメ|化粧品|口紅|リップ|美容液|ジュエリー|指輪|時計|スマホ|スマートフォン|ガジェット|イヤホン|小物/, "cosme", "コスメ/小物"],
    [/料理|フード|食べ物|ラーメン|ハンバーガー|ステーキ|パスタ|スイーツ|ケーキ|寿司|食品/, "food", "料理"],
    [/車|クルマ|自動車|バイク|スポーツカー/, "car", "自動車"],
    [/ビル|建物|建築|街並み|風景|山|海|森|渓谷|滝|neighborhood/, "arch", "建築/ロケーション"],
  ];
  for (const [re, id, label] of subjMap) {
    if ((ev = has(re))) { R.subjectType = id; note("被写体", label, ev); break; }
  }

  /* ---------- 動き/演技 ---------- */
  const actMap = [
    [/走り|走る|疾走|ダッシュ/, "run", "走る"], [/歩き|歩く/, "walk", "歩く"],
    [/振り返/, "turn", "振り返る"], [/座る|座り|腰掛/, "sit", "座る"],
    [/踊る|踊り|ダンス/, "dance", "踊る"], [/ジャンプ|跳ぶ|飛び上/, "jump", "ジャンプ"],
    [/注ぐ|注がれ/, "pour", "注ぐ"], [/回転|回る/, "rotate", "回転"],
    [/走行|ドライブ/, "drive", "走行"], [/話す|語り|カメラ目線/, "talk", "話す"],
  ];
  for (const [re, id, label] of actMap) {
    if ((ev = has(re))) { R.action = id; note("演技/動き", label, ev); break; }
  }

  /* ---------- 特効 ---------- */
  if ((ev = has(/爆発|爆炎|火球/))) {
    R.options.push("explosion"); R.addItems.push("pyro");
    note("特効", "爆発 (Class C: 特効技師専任)", ev);
  }
  if ((ev = has(/火花|スパーク/))) { R.options.push("sparks"); R.addItems.push("spark"); note("特効", "火花", ev); }
  if ((ev = has(/煙|スモーク|ヘイズ|光条|ゴッドレイ/))) { if (!R.options.includes("haze")) R.options.push("haze"); R.addItems.push("smoke"); note("特効", "スモーク/ヘイズ", ev); }
  if ((ev = has(/湯気|スチーム/))) { R.options.push("steam"); note("演出", "湯気", ev); }
  if ((ev = has(/雫|水滴|結露/))) { R.options.push("droplets"); note("演出", "雫・結露", ev); }
  if ((ev = has(/しぶき|スプラッシュ|飛沫/))) { R.options.push("splash"); note("演出", "スプラッシュ", ev); }
  if ((ev = has(/紙吹雪|コンフェッティ/))) { R.options.push("confetti"); R.addItems.push("confetti"); note("特効", "紙吹雪", ev); }
  if ((ev = has(/シルエット|影絵/))) { R.options.push("silhouette"); note("演出", "シルエット", ev); }
  if ((ev = has(/玉ボケ|ボケ/))) { R.options.push("bokeh"); note("演出", "玉ボケ", ev); }
  if ((ev = has(/フレア/))) { R.options.push("lensflare"); note("演出", "レンズフレア", ev); }

  /* ---------- カメラ ---------- */
  const mm = t.match(/(\d{2,3})\s*mm/);
  if (mm) {
    R.camera.focalMm = Math.min(800, Math.max(8, parseInt(mm[1])));
    note("レンズ", `${R.camera.focalMm}mm`, mm[0]);
  }
  if ((ev = has(/スローモーション|スロー|ハイスピード/))) {
    R.camera.fps = "120fps(HS)"; R.camera.body = "highspeed";
    note("カメラ", "ハイスピード 120fps (スローモーション)", ev);
  }
  if ((ev = has(/手持ち|ハンドヘルド/))) { R.camera.move = "handheld"; note("カメラワーク", "手持ち", ev); }
  else if ((ev = has(/追いかけ|追跡|チェイス/))) { R.camera.move = "d_chase"; note("カメラワーク", "FPV追跡", ev); }
  else if ((ev = has(/回り込み|オービット/))) { R.camera.move = "orbit"; note("カメラワーク", "オービット", ev); }
  else if ((ev = has(/ドリーイン|寄っていく/))) { R.camera.move = "dollyin"; note("カメラワーク", "ドリーイン", ev); }
  else if ((ev = has(/並走/))) { R.camera.move = "d_side"; note("カメラワーク", "並走トラッキング", ev); }
  if ((ev = has(/縦動画|縦型|リール|ショート動画|TikTok|ティックトック/i))) { R.aspect = "9:16"; note("アスペクト比", "9:16 (縦)", ev); }
  else if ((ev = has(/シネスコ|スコープ|2\.39/))) { R.aspect = "2.39:1"; note("アスペクト比", "2.39:1 (シネスコ)", ev); }
  if ((ev = has(/クローズアップ|どアップ|アップで|寄りで/))) { R.camera.shotSize = "CU"; note("サイズ", "クローズアップ", ev); }
  else if ((ev = has(/全身/))) { R.camera.shotSize = "FF"; note("サイズ", "フルフィギュア", ev); }
  else if ((ev = has(/引きで|ロングショット|引きの/))) { R.camera.shotSize = "LS"; note("サイズ", "ロングショット", ev); }
  if ((ev = has(/俯瞰|見下ろ|真上から/))) { R.camera.angle = has(/真上/) ? "birds" : "high"; note("アングル", "俯瞰", ev); }
  else if ((ev = has(/あおり|ローアングル|見上げ/))) { R.camera.angle = "low"; note("アングル", "ローアングル", ev); }
  const dur = t.match(/(\d{1,2})\s*秒/);
  if (dur) { R.duration = parseInt(dur[1]); note("尺", `${R.duration}秒`, dur[0]); }

  /* ---------- ムード / ルック ---------- */
  if ((ev = has(/映画|シネマティック|シネマ|フィルム/))) {
    R.look = "tealorange"; if (!R.camera.fps) R.camera.fps = "24fps";
    note("ルック", "シネマティック (ティール&オレンジ / 24fps)", ev);
  }
  if ((ev = has(/モノクロ|白黒/))) { R.look = "mono"; note("ルック", "モノクロ", ev); }
  if ((ev = has(/ノスタルジ|レトロ|ヴィンテージ|回想/))) { R.look = "filmwarm"; note("ルック", "フィルム暖色", ev); }

  /* ---------- ベース技法プリセットの決定 (優先度順) ---------- */
  const pick = (id, why, evd) => { if (!R.presetId) { R.presetId = id; R.presetWhy = why; note("ベース技法", why, evd || "-"); } };
  if (has(/爆発|爆炎|火球/)) pick("sfx-explosion", "爆発バック (パイロ)", has(/爆発|爆炎|火球/));
  if (has(/豪雨|土砂降り|大雨|雨/)) pick("rain-backlight", "レインメイキング (雨+逆光)", has(/豪雨|雨/));
  if (has(/吹雪|雪/)) pick("sfx-snow", "スノーメイキング", has(/吹雪|雪/));
  if (has(/火花|スパーク/)) pick("sfx-sparks", "スパークシャワー", has(/火花|スパーク/));
  if (has(/紙吹雪/)) pick("sfx-confetti", "紙吹雪フィナーレ", "紙吹雪");
  if (has(/ネオン|サイバー/)) pick("neon-duotone", "ネオンデュオトーン", has(/ネオン|サイバー/));
  if (has(/路地|街角|繁華街|ストリート/) && R.timeOfDay === "night") pick("night-street", "ナイトストリート", has(/路地|街角|繁華街|ストリート/));
  if (has(/ライブ|ステージ|コンサート/)) pick("stage-concert", "ステージ/ライブ演出", has(/ライブ|ステージ|コンサート/));
  if (has(/インタビュー|対談/)) pick("window-interview", "インタビュー (窓光風)", has(/インタビュー|対談/));
  if (has(/ホラー|不気味|怪談/)) pick("underlight", "アンダーライト (ホラー)", has(/ホラー|不気味|怪談/));
  if (has(/緊張|サスペンス|葛藤|対峙/)) pick("split", "スプリットライト (緊張)", has(/緊張|サスペンス|葛藤|対峙/));
  if (has(/ノワール|闇|重厚/)) pick("lowkey-noir", "ローキー/ノワール", has(/ノワール|闇|重厚/));
  if (has(/空撮|ドローン/)) {
    pick(has(/追いかけ|追跡|チェイス|追う/) ? "drone-fpv-chase" : has(/真俯瞰|真上/) ? "drone-topdown" : "drone-orbit",
      "ドローンショット", has(/空撮|ドローン/));
  }
  if (has(/ビール/)) pick("beer-sizzle", "ビール: 泡・透過・結露", "ビール");
  if (has(/ウイスキー|ハイボール|ロックグラス|ブランデー/)) pick("whisky-highball", "ウイスキー: 琥珀の透過", has(/ウイスキー|ハイボール|ロックグラス|ブランデー/));
  if (has(/ワイン/)) pick("wine-red", "赤ワイン: バック/サイド透過", "ワイン");
  if (has(/香水/)) pick("perfume-gel", "香水: カラージェル背景", "香水");
  if (has(/美容液|セラム|スポイト/)) pick("serum", "美容液: 透過とコースティクス", has(/美容液|セラム|スポイト/));
  if (has(/口紅|リップ/)) pick("lipstick", "リップ: 精密スペキュラー", has(/口紅|リップ/));
  if (has(/パウダー|粉/)) pick("powder-burst", "パウダーバースト", has(/パウダー|粉/));
  if (has(/ミルククラウン|ウォータークラウン|王冠/)) pick("water-crown", "ウォータークラウン", has(/ミルククラウン|ウォータークラウン|王冠/));
  if (has(/ジュエリー|指輪|宝石/)) pick("jewelry", "ジュエリー: テント+ピンスポット", has(/ジュエリー|指輪|宝石/));
  if (has(/バーガー|ハンバーガー/)) pick("burger", "バーガー: テクスチャ半逆光", has(/バーガー|ハンバーガー/));
  if (has(/唐揚げ|チキン|揚げ物|フライ/)) pick("fried-chicken", "フライドチキン: 衣のハード", has(/唐揚げ|チキン|揚げ物|フライ/));
  if (has(/アイス|ソフトクリーム|ジェラート/)) pick("icecream", "アイスクリーム: 冷感管理", has(/アイス|ソフトクリーム|ジェラート/));
  if (has(/水光肌|ガラススキン|ツヤ肌|つや肌/)) pick("glass-skin", "Glass Skin (水光肌)", has(/水光肌|ガラススキン|ツヤ肌|つや肌/));
  if (has(/髪|ヘア/) && has(/なびか|なびく|風|揺れ/)) pick("hair-motion", "ヘアモーション", "髪+風");
  if (has(/メガネ|眼鏡|サングラス/)) pick("eyewear", "アイウェア (反射制御)", has(/メガネ|眼鏡|サングラス/));
  if (has(/ドライアイス|低い霧|這う霧/)) pick("dryice-lowfog", "ドライアイス (低い霧)", has(/ドライアイス|低い霧|這う霧/));
  if (has(/注ぐ|注がれ|ポア/) && (R.subjectType === "bottle" || !R.subjectType)) pick("water-pour", "ポア (注ぎ)", has(/注ぐ|注がれ|ポア/));
  if (has(/グラス/)) pick("dark-field", "ダークフィールド (グラス)", "グラス");
  if (R.subjectType === "bottle") pick("product-gradation", "ボトル: グラデーションライティング", "ボトル/飲料");
  if (R.subjectType === "cosme") pick("cosme-beauty", "コスメ: クリーンビューティー", "コスメ/小物");
  if (R.subjectType === "food") pick("food-sizzle", "フード: 半逆光シズル", "料理");
  if (R.subjectType === "car") pick("car-studio", "自動車: スタジオリフレクション", "自動車");
  if (has(/ビューティ|美肌|化粧/)) pick("clamshell", "クラムシェル (ビューティー)", has(/ビューティ|美肌|化粧/));
  if (has(/明るく|爽やか|ポップ|清潔感/)) pick("highkey", "ハイキー", has(/明るく|爽やか|ポップ|清潔感/));
  if (R.timeOfDay === "golden") pick("golden-hour", "ゴールデンアワー", "夕景");
  if (R.timeOfDay === "blue") pick("bluehour", "ブルーアワー", "薄暮");
  pick("three-point", "三点照明 (デフォルト)", null);

  return { result: R, assumptions: A, raw: t };
}

/* ---------- 解釈結果 → カット生成 (IntentParser → ShotDesigner 相当) ---------- */
function buildCutFromIntent(parsed) {
  const R = parsed.result;
  const preset = allPresets().find(p => p.id === R.presetId) || PRESETS[0];
  const cut = makeCut(preset);
  cut.name = parsed.raw.slice(0, 18) + (parsed.raw.length > 18 ? "…" : "");
  cut.aim = `自由文からの自動設計: 「${parsed.raw.slice(0, 60)}」`;

  if (R.subjectType) { cut.subjectType = R.subjectType; cut.action = SUBJECT_DEFAULT_ACTION[R.subjectType] || "stand"; }
  if (R.action) cut.action = R.action;
  if (R.weather) cut.weather = R.weather;
  if (R.timeOfDay) cut.timeOfDay = R.timeOfDay;
  if (R.bgStyle) cut.bgStyle = R.bgStyle;
  if (R.aspect) cut.aspect = R.aspect;
  if (R.look) cut.look = R.look;
  if (R.duration) cut.duration = R.duration;
  for (const o of R.options) if (!cut.options.includes(o)) cut.options.push(o);
  Object.assign(cut.camera, R.camera);
  if (R.camera.focalMm) cut.camera.lens = String(
    [14, 24, 35, 50, 85, 135].reduce((a, b) => Math.abs(b - R.camera.focalMm) < Math.abs(a - R.camera.focalMm) ? b : a));

  // 追加機材 (プリセットに同種が無い場合のみ)
  for (const type of [...new Set(R.addItems)]) {
    if (cut.items.some(i => i.type === type)) continue;
    const pos = INTENT_ITEM_POS[type] || { x: 300, y: 200, height: 150 };
    cut.items.push(makeItem({ type, ...pos, power: 0 }));
  }
  return ensureCameraDefaults(cut);
}

/* ---------- カバレッジ展開: 1カット → 引き/メイン/寄りの3カット ---------- */
function expandCoverage(cut) {
  const base = JSON.stringify(cut);
  const clone = () => {
    const c = JSON.parse(base);
    c.id = uid(); c.items.forEach(i => i.id = uid());
    return c;
  };
  const wide = clone();
  wide.name = "引き (状況説明)"; wide.camera.shotSize = "LS"; wide.camera.endShotSize = "same";
  wide.camera.move = "fix"; wide.camera.support = "tripod"; wide.duration = Math.max(3, (cut.duration || 5) - 2);
  wide.aim = "シーンの地理と状況を最初に見せるエスタブリッシング (COV-001)。";
  const main = clone();
  main.name = cut.name;
  const tight = clone();
  tight.name = "寄り (感情/ディテール)"; tight.camera.shotSize = "CU"; tight.camera.endShotSize = "same";
  tight.camera.move = "dollyin"; tight.camera.moveSpeed = "slow";
  tight.camera.support = "dolly"; tight.duration = Math.max(2, (cut.duration || 5) - 2);
  tight.aim = "感情・ディテールを読ませる寄り (COV-002)。";
  [wide, main, tight].forEach(ensureCameraDefaults);
  return [wide, main, tight];
}
