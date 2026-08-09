/* =========================================================
 * Virtual Studio — アプリ本体
 *  - スタジオ俯瞰図 (機材ドラッグ配置)
 *  - ライティング解析 → 想定カットプレビュー自動生成
 *  - Seedance等 AI動画生成用プロンプト生成
 *  - 撮影指示書 (PDF/印刷・SVG画像・JSON) 書き出し
 * ======================================================= */

"use strict";

/* ---------- ユーティリティ ---------- */
let _uid = 1;
const uid = () => "id" + (_uid++);
const deg = (rad) => rad * 180 / Math.PI;
const normDeg = (d) => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (id) => document.getElementById(id);

function seededRand(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function hashStr(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + 1; }

const LIGHT_TYPES = ["key", "fill", "back", "rim", "top", "bg", "hmi", "practical", "sun"];
const VEHICLE_TYPES = ["truck", "genny", "locabus", "cranetruck"];
const SOFT_WORDS = ["ソフト", "オクタ", "アンブレラ", "ディフュージョン", "ブックライト", "ビューティー"];

/* ---------- 状態 ---------- */
const state = {
  mode: "video",
  cuts: [],
  activeCut: 0,
  selectedItem: null,
  projectTitle: "無題プロジェクト",
};

function activeCut() { return state.cuts[state.activeCut]; }

function makeItem(def) {
  return {
    id: uid(),
    type: def.type,
    x: def.x, y: def.y,
    height: def.height ?? 150,
    power: def.power ?? 50,
    colorTemp: def.colorTemp ?? 5600,
    modifier: def.modifier ?? "なし(直射)",
  };
}

/* ---------- 詳細フィールドのデフォルト補完 (プリセット/旧JSON互換) ---------- */
function ensureItemDefaults(it) {
  if (LIGHT_TYPES.includes(it.type)) {
    if (it.beamAngle == null) it.beamAngle = MODIFIER_BEAM[it.modifier] ?? 60;
    if (!it.stand) it.stand = it.type === "top" ? "ブームアーム" : "ライトスタンド";
  }
  return it;
}

function ensureCameraDefaults(cut) {
  const c = cut.camera;
  if (!c.body) c.body = cut.aspect === "3:2" ? "medium" : "cine";
  if (c.focalMm == null) c.focalMm = LENS_FOCAL[c.lens] ?? 50;
  if (c.apertureF == null) {
    const m = String(c.aperture || "").match(/[\d.]+/);
    c.apertureF = m ? parseFloat(m[0]) : 2.8;
  }
  if (c.focusM == null) c.focusM = ["bottle", "cosme", "food"].includes(cut.subjectType) ? 0.8 : 2.5;
  if (!c.nd) c.nd = "なし";
  if (!Array.isArray(c.filters)) c.filters = [];
  if (!c.support) c.support = MOVE_SUPPORT[c.move] || "tripod";
  const sup = CAMERA_SUPPORTS.find(s => s.id === c.support);
  if (c.supportParam == null) c.supportParam = sup && sup.param ? sup.param.def : 0;
  if (!c.head) c.head = c.support === "gimbal" ? "3軸スタビ雲台" : "フルード雲台";
  cut.items.forEach(ensureItemDefaults);
  return cut;
}

function makeCut(preset) {
  const cut = {
    id: uid(),
    name: preset ? preset.name : "新規カット",
    presetId: preset ? preset.id : null,
    aim: preset ? preset.look : "",
    notes: "",
    duration: 5,
    aspect: state.mode === "still" ? "3:2" : "16:9",
    subjectType: preset ? preset.subjectType : "person",
    bgStyle: preset ? preset.bgStyle : "dark",
    options: preset && preset.defaultOptions ? [...preset.defaultOptions] : [],
    camera: preset
      ? { ...preset.camera }
      : { shotSize: "BS", angle: "eye", move: "fix", lens: "50", aperture: "F2.8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K" },
    items: [
      makeItem({ type: "subject", x: SUBJECT_POS.x, y: SUBJECT_POS.y, height: 160, power: 0 }),
      makeItem({ type: "camera", x: CAMERA_POS.x, y: CAMERA_POS.y, height: 140, power: 0 }),
      ...(preset ? preset.items.map(makeItem) : []),
    ],
  };
  return ensureCameraDefaults(cut);
}

/* =========================================================
 * ライティング解析
 * カメラ→被写体の軸を基準に各灯の相対方位を計算する。
 * rel > 0: カメラから見て左側 / |rel| > 115°: 逆光(リム)
 * ======================================================= */
function analyzeLighting(cut) {
  const sub = cut.items.find(i => i.type === "subject") || SUBJECT_POS;
  const cam = cut.items.find(i => i.type === "camera") || CAMERA_POS;
  const camDir = deg(Math.atan2(sub.y - cam.y, sub.x - cam.x));

  const a = {
    lights: [], frontVec: 0, frontPower: 0, fillPower: 0,
    rimPower: 0, rimSide: 0, topPower: 0, bgPower: 0,
    soft: false, avgTemp: 5600, keySide: 0, keyRel: 0, keyLight: null,
  };
  let tempSum = 0, tempN = 0, maxFront = -1;

  for (const it of cut.items) {
    if (!LIGHT_TYPES.includes(it.type) || it.power <= 0) continue;
    const lightDir = deg(Math.atan2(sub.y - it.y, sub.x - it.x));
    const rel = normDeg(lightDir - camDir);
    const info = { item: it, rel, dist: Math.hypot(sub.x - it.x, sub.y - it.y) };
    a.lights.push(info);
    tempSum += it.colorTemp * it.power; tempN += it.power;

    if (it.type === "bg") { a.bgPower += it.power; continue; }
    if (it.type === "top" || (it.height > 350 && Math.abs(rel) < 115)) { a.topPower += it.power; }

    if (Math.abs(rel) > 115) {
      a.rimPower += it.power;
      a.rimSide += Math.sign(rel) * it.power;
    } else {
      a.frontPower += it.power;
      a.frontVec += Math.sign(rel) * Math.abs(Math.sin(rel * Math.PI / 180)) * it.power;
      if (it.type === "fill") a.fillPower += it.power;
      if (it.power > maxFront && it.type !== "fill") {
        maxFront = it.power; a.keyRel = rel; a.keyLight = it;
        a.soft = SOFT_WORDS.some(w => (it.modifier || "").includes(w));
      }
    }
  }
  a.keySide = Math.sign(a.frontVec) || Math.sign(a.keyRel) || 1; // + = カメラ左
  a.avgTemp = tempN ? Math.round(tempSum / tempN) : 5600;
  a.contrast = a.frontPower > 0 ? 1 - Math.min(1, a.fillPower / a.frontPower) : 1;
  return a;
}

/* 灯の相対方位 → 日本語/英語の位置表現 */
function relToJa(rel) {
  const ab = Math.abs(rel);
  const side = rel > 15 ? "カメラ左" : rel < -15 ? "カメラ右" : "カメラ正面";
  if (ab <= 15) return "正面 (0°)";
  if (ab <= 60) return `${side} 約${Math.round(ab)}° (斜め前)`;
  if (ab <= 115) return `${side} 約${Math.round(ab)}° (真横〜斜め後)`;
  if (ab <= 160) return `${side}後方 約${Math.round(ab)}° (半逆光)`;
  return "真後ろ (逆光)";
}
function relToEn(rel) {
  const ab = Math.abs(rel);
  const side = rel > 15 ? "camera left" : rel < -15 ? "camera right" : "directly frontal";
  if (ab <= 15) return "from the front";
  if (ab <= 60) return `from ${side} at about 45 degrees`;
  if (ab <= 115) return `from the side (${side})`;
  if (ab <= 160) return `from behind ${side} (three-quarter backlight)`;
  return "from directly behind (backlight)";
}

/* =========================================================
 * Seedance / AI動画生成プロンプト
 * ======================================================= */
/* 焦点距離(mm) → 英語表現 */
function focalToEn(mm, isAnam) {
  let s;
  if (mm <= 16) s = `${mm}mm ultra-wide lens, dramatic perspective`;
  else if (mm <= 28) s = `${mm}mm wide-angle lens`;
  else if (mm <= 42) s = `${mm}mm lens, natural field of view`;
  else if (mm <= 65) s = `${mm}mm standard lens`;
  else if (mm <= 105) s = `${mm}mm portrait lens, compressed background`;
  else if (mm <= 250) s = `${mm}mm telephoto lens, strong compression`;
  else s = `${mm}mm super-telephoto lens, extreme compression`;
  return isAnam ? s + ", 2x anamorphic with oval bokeh and horizontal flares" : s;
}

function generatePrompt(cut) {
  ensureCameraDefaults(cut);
  const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || SHOT_SIZES[2];
  const ang = CAM_ANGLES.find(s => s.id === cut.camera.angle) || CAM_ANGLES[0];
  const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || CAM_MOVES[0];
  const subj = SUBJECT_TYPES.find(s => s.id === cut.subjectType) || SUBJECT_TYPES[0];
  const bg = BG_STYLES[cut.bgStyle] || BG_STYLES.dark;
  const an = analyzeLighting(cut);

  const optPhrases = cut.options
    .map(o => SHOT_OPTIONS.find(s => s.id === o))
    .filter(Boolean).map(o => o.en);

  const lightPhrases = [];
  if (cut.options.includes("silhouette") || (an.frontPower === 0 && (an.bgPower > 0 || an.rimPower > 0))) {
    lightPhrases.push("subject in full silhouette against a bright background");
  } else if (an.frontPower > 0) {
    lightPhrases.push(`${an.soft ? "soft diffused" : "hard direct"} key light ${relToEn(an.keyRel)}`);
    lightPhrases.push(an.contrast > 0.7 ? "high contrast with deep dramatic shadows"
      : an.contrast > 0.35 ? "moderate contrast with gentle fill" : "low contrast, evenly filled shadows");
  }
  if (an.rimPower > 0) lightPhrases.push("bright rim light outlining the subject's edges");
  if (an.topPower > 0) lightPhrases.push("overhead top light adding highlights");
  if (an.bgPower > 0 && cut.bgStyle !== "white") lightPhrases.push("separately lit background");
  lightPhrases.push(an.avgTemp <= 3800 ? "warm tungsten color palette"
    : an.avgTemp >= 7000 ? "cool blue color palette" : "neutral daylight color balance");

  /* カメラ・レンズ・リグの言語化 */
  const c = cut.camera;
  const body = CAMERA_BODIES.find(b => b.id === c.body);
  const sup = CAMERA_SUPPORTS.find(s => s.id === c.support);
  const lensPhrase = focalToEn(c.focalMm, c.lens === "anam");
  const dofPhrase = c.apertureF <= 2.8 && c.focalMm >= 50
    ? "shallow depth of field with creamy bokeh"
    : c.apertureF <= 2.8 ? "shallow depth of field"
    : c.apertureF >= 8 ? "deep focus, everything sharp" : "";
  const filterPhrases = (c.filters || [])
    .map(f => LENS_FILTERS.find(x => x.id === f)).filter(Boolean).map(f => f.en);
  const bodyPhrase = body && !["cine", "mirrorless"].includes(body.id) ? body.en : "";
  const supPhrase = sup && ["steadicam", "shoulder", "bodyrig", "wearable", "cablecam", "carmount", "technocrane", "slider"].includes(sup.id)
    ? `shot with ${sup.en}` : "";

  const parts = [
    `${size.en}, ${ang.en}`,
    mov.en,
    supPhrase,
    bodyPhrase,
    `subject: ${subj.en}${optPhrases.length ? ", " + optPhrases.join(", ") : ""}`,
    lightPhrases.join(", "),
    bg.en,
    `${lensPhrase}, aperture f/${c.apertureF}${c.focusM ? `, focus at ${c.focusM}m` : ""}`,
    dofPhrase,
    filterPhrases.join(", "),
    cut.aspect === "3:2" ? "still photograph, ultra high resolution" : `${cut.camera.fps}, cinematic motion`,
    "photorealistic, professional cinematography, high detail",
  ];
  return parts.filter(Boolean).join(". ") + ".";
}

/* 日本語の撮影意図サマリー (指示書用) */
function generateJaSummary(cut) {
  const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || SHOT_SIZES[2];
  const ang = CAM_ANGLES.find(s => s.id === cut.camera.angle) || CAM_ANGLES[0];
  const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || CAM_MOVES[0];
  const an = analyzeLighting(cut);
  const lines = [];
  lines.push(`${size.label} / ${ang.label} / ${mov.label}`);
  if (an.keyLight) {
    lines.push(`キー: ${relToJa(an.keyRel)}、${an.soft ? "柔らかい光 (拡散)" : "硬い光 (直射系)"}、` +
      `コントラスト${an.contrast > 0.7 ? "強 (影を深く残す)" : an.contrast > 0.35 ? "中" : "弱 (フラット目)"}`);
  }
  if (an.rimPower > 0) lines.push("リム/バックライトで輪郭を背景から分離する");
  if (an.bgPower > 0) lines.push("背景は別灯で独立してコントロールする");
  lines.push(`色温度の中心: 約${an.avgTemp}K`);
  return lines;
}

/* =========================================================
 * 「この配置だとこう写る」— 誰でも分かる平易な自動解説
 * ======================================================= */
const OPTION_EFFECTS_JA = {
  droplets: "💧 商品に雫・結露がつき、冷たさと新鮮さが伝わります",
  gloss: "✨ フチに光沢のラインが走り、高級感が出ます",
  matte: "🪶 テカリを抑えた、落ち着いた質感になります",
  steam: "♨️ 湯気が後ろからの光に浮かび、出来立て感を演出します",
  haze: "🌫 空気中のもやで光の筋が見え、幻想的な奥行きが出ます",
  wind: "🍃 髪や布が風でなびき、画に動きが生まれます",
  splash: "💦 液体のしぶきが空中で止まったような躍動感が出ます",
  rain: "🌧 逆光に照らされた雨の線が全面に光ります",
  snow: "❄️ 雪がゆっくり舞い、冬の空気感に包まれます",
  explosion: "💥 背景で火球と黒煙が上がる迫力のカットになります(特効技師の管理下で実施)",
  sparks: "🎇 オレンジの火花が雨のように降り注ぎます",
  confetti: "🎉 色とりどりの紙吹雪が舞い、お祝いのクライマックス感が出ます",
  bokeh: "🔮 背景に丸い光のボケが散り、ロマンチックな雰囲気になります",
  lensflare: "🌟 レンズに光が差し込み、映画のようなフレアが入ります",
  silhouette: "👤 人物・商品は影絵(シルエット)になり、輪郭の形で見せます",
  gel: "🎨 左右から2色のカラーライトに挟まれ、ネオンのような世界観になります",
};

function explainCut(cut) {
  ensureCameraDefaults(cut);
  const an = analyzeLighting(cut);
  const lines = [];
  const silhouette = cut.options.includes("silhouette") || (an.frontPower === 0 && (an.bgPower > 0 || an.rimPower > 0));
  const sideJa = an.keySide > 0 ? "左" : "右";
  const otherJa = an.keySide > 0 ? "右" : "左";

  if (silhouette) {
    lines.push("💡 正面からの光がないので、被写体は真っ黒な影絵(シルエット)として写ります。表情ではなく「形」で見せるカットです。");
  } else if (an.frontPower > 0) {
    const ab = Math.abs(an.keyRel);
    const dirWord = ab <= 15 ? "ほぼ正面" : ab <= 60 ? `${sideJa}ななめ前` : `ほぼ真横(${sideJa}側)`;
    lines.push(`💡 メインの光は、カメラから見て【${dirWord}】から当たっています。→ 画面の${sideJa}側が明るく、${otherJa}側に影ができます。`);
    lines.push(an.soft
      ? "☁️ 光をやわらかく拡散しているので、影のフチはふんわり。肌や質感がなめらかに写ります。"
      : "🔦 光を直接当てる硬い光なので、影のフチがくっきり。シャープでドラマチックな印象になります。");
    lines.push(an.contrast > 0.7
      ? "🌓 影を明るくする補助光はほぼ無し。→ 明暗差の大きい、重厚で映画的な画になります。"
      : an.contrast > 0.35
        ? "🌗 影はほどよく残ります。→ 立体感のある自然な仕上がりです。"
        : "🌕 影をしっかり明るく起こしています。→ 明るくフラットで、清潔感のある画になります。");
  } else {
    lines.push("💡 ライトが無い/光量ゼロの状態です。ライトを置くか出力を上げてください。");
  }
  if (an.rimPower > 0 && !silhouette) {
    lines.push("✨ 被写体の後ろからも光が当たっています。→ 輪郭が細く光って、背景からくっきり浮き上がります。");
  }
  if (an.topPower > 0 && !silhouette) {
    lines.push("⬇️ 真上からの光もあります。→ 髪や商品の天面にハイライトが乗ります。");
  }
  const bgBrightJa = ["white", "bright", "day", "sky"].includes(cut.bgStyle) || an.bgPower > 60
    ? "背景は明るく抜けます" : an.bgPower > 0 ? "背景はほどよい明るさに整えられます" : "背景は暗く落ち、被写体だけが浮かび上がります";
  lines.push(`🖼 ${bgBrightJa}。`);
  if (an.avgTemp <= 3800) lines.push("🔥 全体はオレンジ系の暖かい色味です(夕方・ろうそく・白熱灯のイメージ)。");
  else if (an.avgTemp >= 7000) lines.push("🧊 全体は青系の冷たい色味です(月夜・冬・近未来のイメージ)。");

  const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || SHOT_SIZES[2];
  const ang = CAM_ANGLES.find(s => s.id === cut.camera.angle) || CAM_ANGLES[0];
  const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || CAM_MOVES[0];
  const angJa = { eye: "目の高さから自然に", high: "少し上から見下ろして(小さく・客観的に見える)", low: "下からあおって(大きく・力強く見える)", birds: "真上から(地図のような構図)", dutch: "画面を斜めに傾けて(不安・スピード感)", ots: "手前の人物の肩越しに(会話の臨場感)" }[cut.camera.angle] || "";
  const sup = CAMERA_SUPPORTS.find(s => s.id === cut.camera.support);
  const supJa = sup ? `カメラは${sup.label}${sup.param ? `(${cut.camera.supportParam}${sup.param.unit})` : ""}に載せ、` : "";
  lines.push(`🎥 ${supJa}${size.label}で、${angJa}撮ります。動き: ${mov.label}。レンズは${cut.camera.focalMm}mm・F${cut.camera.apertureF}${cut.camera.apertureF <= 2.8 ? "(背景が大きくボケます)" : cut.camera.apertureF >= 8 ? "(手前から奥までピントが合います)" : ""}。`);
  const bodyDef = CAMERA_BODIES.find(b => b.id === cut.camera.body);
  if (bodyDef && !["cine", "mirrorless", "medium"].includes(bodyDef.id)) {
    lines.push(`📹 カメラ本体は「${bodyDef.label}」。${bodyDef.id === "pov_ear" || bodyDef.id === "action" ? "本人の見た目そのままの一人称視点になります。" : bodyDef.id === "highspeed" ? "超スローモーションで撮れます。" : bodyDef.id === "cam360" ? "全方位が記録され、後から画角を切り出せます。" : ""}`);
  }

  for (const o of cut.options) {
    if (OPTION_EFFECTS_JA[o]) lines.push(OPTION_EFFECTS_JA[o] + "。");
  }
  return lines;
}

/* =========================================================
 * スタジオ俯瞰図 SVG
 * ======================================================= */
function equipGlyph(it, sub, cut) {
  const t = EQUIP_TYPES[it.type] || EQUIP_TYPES.key;
  const aim = deg(Math.atan2(sub.y - it.y, sub.x - it.x));
  let body = "";
  switch (t.shape) {
    case "subject":
      body = `<circle class="equip-body" r="26" fill="#ffffff" stroke="${t.color}" stroke-width="1.5"/>
              <circle r="9" fill="${t.color}"/>`;
      break;
    case "camera": {
      // サポート機材 (支持機材) の可視化
      const supId = cut && cut.camera ? cut.camera.support : "tripod";
      const supParam = cut && cut.camera ? cut.camera.supportParam : 0;
      let rig = "";
      if (supId === "slider" || supId === "dolly") {
        const L = supId === "slider" ? Math.max(40, supParam) * 0.8 : Math.max(2, supParam) * 18;
        rig = `<line x1="-16" y1="${-L / 2}" x2="-16" y2="${L / 2}" stroke="#8a90a0" stroke-width="3"/>
               <line x1="-24" y1="${-L / 2}" x2="-24" y2="${L / 2}" stroke="#8a90a0" stroke-width="3"/>
               ${Array.from({ length: Math.max(2, Math.round(L / 26)) }, (_, k) =>
                 `<line x1="-28" y1="${-L / 2 + k * 26}" x2="-12" y2="${-L / 2 + k * 26}" stroke="#b8bdc9" stroke-width="2"/>`).join("")}`;
      } else if (supId === "crane" || supId === "technocrane") {
        const armPx = Math.max(2, supParam) * 14;
        rig = `<line x1="${-armPx}" y1="0" x2="-10" y2="0" stroke="#d98a4e" stroke-width="4"/>
               <circle cx="${-armPx}" cy="0" r="10" fill="#ffffff" stroke="#d98a4e" stroke-width="2.5"/>
               <line x1="${-armPx - 8}" y1="10" x2="${-armPx + 8}" y2="10" stroke="#d98a4e" stroke-width="3"/>`;
      } else if (supId === "cablecam") {
        rig = `<line x1="-30" y1="-160" x2="-30" y2="160" stroke="#8a90a0" stroke-width="2" stroke-dasharray="8 6"/>`;
      } else if (supId === "tripod" || supId === "highhat") {
        rig = `${[150, 270, 30].map(a =>
          `<line x1="0" y1="0" x2="${18 * Math.cos(a * Math.PI / 180)}" y2="${18 * Math.sin(a * Math.PI / 180)}" stroke="#8a90a0" stroke-width="2.5"/>`).join("")}`;
      } else if (supId === "ladder" || supId === "intore") {
        rig = `<rect x="-30" y="-14" width="14" height="28" fill="none" stroke="#8a90a0" stroke-width="2"/>
               <line x1="-30" y1="-5" x2="-16" y2="-5" stroke="#8a90a0" stroke-width="2"/>
               <line x1="-30" y1="4" x2="-16" y2="4" stroke="#8a90a0" stroke-width="2"/>`;
      }
      body = `<g transform="rotate(${aim})">
                ${rig}
                <path d="M-40,0 L-8,-16 L-8,16 Z" fill="rgba(47,127,224,.15)"/>
                <rect class="equip-body" x="-8" y="-13" width="30" height="26" rx="4" fill="#ffffff" stroke="${t.color}" stroke-width="1.5"/>
                <rect x="-16" y="-6" width="9" height="12" fill="${t.color}"/>
              </g>`;
      break;
    }
    case "light": {
      const beam = it.beamAngle ?? 60;
      const len = Math.min(150, 60 + it.power * 0.8);
      const spread = Math.tan(Math.min(60, beam / 2) * Math.PI / 180) * len;
      body = `<g transform="rotate(${aim})">
                <path d="M12,-7 L${12 + len},${-spread} L${12 + len},${spread} L12,7 Z" fill="${t.color}" opacity="0.18"/>
                <rect class="equip-body" x="-14" y="-12" width="26" height="24" rx="5" fill="#ffffff" stroke="${t.color}" stroke-width="1.5"/>
                <circle cx="6" cy="0" r="6" fill="${t.color}"/>
              </g>`;
      break;
    }
    case "panel":
      body = `<g transform="rotate(${aim + 90})">
                <rect class="equip-body" x="-26" y="-5" width="52" height="10" rx="3" fill="${t.color}" opacity="0.9" stroke="#8a90a0" stroke-width="1"/>
              </g>`;
      break;
    case "vehicle":
      body = `<g>
                <rect class="equip-body" x="-34" y="-16" width="68" height="32" rx="5" fill="#ffffff" stroke="${t.color}" stroke-width="2"/>
                <rect x="14" y="-12" width="16" height="24" rx="3" fill="${t.color}" opacity="0.85"/>
                <rect x="-30" y="-12" width="40" height="24" rx="2" fill="${t.color}" opacity="0.25"/>
                <rect x="-26" y="-19" width="12" height="4" rx="2" fill="${t.color}"/><rect x="8" y="-19" width="12" height="4" rx="2" fill="${t.color}"/>
                <rect x="-26" y="15" width="12" height="4" rx="2" fill="${t.color}"/><rect x="8" y="15" width="12" height="4" rx="2" fill="${t.color}"/>
              </g>`;
      break;
    case "sfx":
      body = `<g>
                <path class="equip-body" d="${[0,45,90,135,180,225,270,315].map((a,i)=>{
                  const r1=18, r2=8, a1=a*Math.PI/180, a2=(a+22.5)*Math.PI/180;
                  return `${i===0?"M":"L"}${(r1*Math.cos(a1)).toFixed(1)},${(r1*Math.sin(a1)).toFixed(1)} L${(r2*Math.cos(a2)).toFixed(1)},${(r2*Math.sin(a2)).toFixed(1)}`;
                }).join(" ")} Z" fill="${t.color}" opacity="0.85" stroke="#b03e1a" stroke-width="1.5"/>
                <circle r="6" fill="#fff3c4"/>
              </g>`;
      break;
    case "drone":
      body = `<g>
                <circle class="equip-body" r="15" fill="#ffffff" stroke="${t.color}" stroke-width="1.5"/>
                <line x1="-20" y1="-20" x2="20" y2="20" stroke="${t.color}" stroke-width="2"/>
                <line x1="-20" y1="20" x2="20" y2="-20" stroke="${t.color}" stroke-width="2"/>
                <circle cx="-20" cy="-20" r="6" fill="none" stroke="${t.color}"/><circle cx="20" cy="-20" r="6" fill="none" stroke="${t.color}"/>
                <circle cx="-20" cy="20" r="6" fill="none" stroke="${t.color}"/><circle cx="20" cy="20" r="6" fill="none" stroke="${t.color}"/>
              </g>`;
      break;
    case "sun":
      body = `<g>
                <circle class="equip-body" r="16" fill="${t.color}" opacity="0.9"/>
                ${[0, 45, 90, 135, 180, 225, 270, 315].map(a =>
                  `<line x1="${22 * Math.cos(a * Math.PI / 180)}" y1="${22 * Math.sin(a * Math.PI / 180)}" x2="${30 * Math.cos(a * Math.PI / 180)}" y2="${30 * Math.sin(a * Math.PI / 180)}" stroke="${t.color}" stroke-width="2.5"/>`).join("")}
              </g>`;
      break;
  }
  let subLabel = "";
  if (LIGHT_TYPES.includes(it.type) && it.power > 0) {
    subLabel = `${it.power}% / ${it.colorTemp}K / h${it.height}cm / ${it.beamAngle ?? 60}°`;
  } else if (it.type === "drone") {
    subLabel = `高度 ${it.height}cm`;
  } else if (it.type === "camera" && cut && cut.camera) {
    const sup = CAMERA_SUPPORTS.find(s => s.id === cut.camera.support);
    const p = sup && sup.param ? ` ${cut.camera.supportParam}${sup.param.unit}` : "";
    subLabel = `${sup ? sup.label + p : ""} / ${cut.camera.focalMm}mm F${cut.camera.apertureF}`;
  }
  return `<g class="equip-item" data-id="${it.id}" transform="translate(${it.x},${it.y})">
    ${body}
    <text class="equip-label" y="-34" text-anchor="middle">${esc(t.label)}</text>
    ${subLabel ? `<text class="equip-sub" y="42" text-anchor="middle">${esc(subLabel)}</text>` : ""}
  </g>`;
}

function renderCanvasSVG(cut, interactive) {
  const sub = cut.items.find(i => i.type === "subject") || SUBJECT_POS;
  // 床グリッド (1マス = 50cm 想定, 100px = 1m)
  let grid = "";
  for (let x = 0; x <= 1000; x += 50) grid += `<line x1="${x}" y1="0" x2="${x}" y2="700" stroke="${x % 100 ? "#eceef3" : "#dfe2e9"}" stroke-width="1"/>`;
  for (let y = 0; y <= 700; y += 50) grid += `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="${y % 100 ? "#eceef3" : "#dfe2e9"}" stroke-width="1"/>`;

  const items = cut.items.map(it => equipGlyph(it, sub, cut)).join("");
  return `${grid}
    <text x="14" y="24" fill="#8a90a0" font-size="12">グリッド 1マス = 50cm (100px = 1m) / 背景: ${esc((BG_STYLES[cut.bgStyle] || {}).en || "")}</text>
    <line x1="0" y1="90" x2="1000" y2="90" stroke="#c3c9d6" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="986" y="82" fill="#8a90a0" font-size="11" text-anchor="end">背景 / ホリゾント</text>
    ${items}`;
}

/* =========================================================
 * 想定カットプレビュー SVG (ライティングシミュレーション)
 * ======================================================= */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function renderPreviewSVG(cut, idPrefix) {
  const W = 640, H = cut.aspect === "3:2" ? 427 : 360;
  const an = analyzeLighting(cut);
  const bg = BG_STYLES[cut.bgStyle] || BG_STYLES.dark;
  const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || SHOT_SIZES[2];
  const angId = cut.camera.angle;
  const scale = size.scale;
  const p = idPrefix || cut.id;
  const rand = seededRand(hashStr(cut.id));
  const silhouette = cut.options.includes("silhouette") || (an.frontPower === 0 && (an.bgPower > 0 || an.rimPower > 0));

  // 明るさ係数
  const bgBright = cut.bgStyle === "white" || cut.bgStyle === "bright" ? 1
    : Math.min(1, 0.25 + an.bgPower / 120 + (["sunset", "sky"].includes(cut.bgStyle) ? 0.6 : 0));
  const keyF = silhouette ? 0.12 : Math.min(1.25, 0.35 + an.frontPower / 90);
  const shadowF = silhouette ? 0.08 : Math.max(0.06, keyF * (1 - an.contrast * 0.85));
  const keySide = an.keySide; // + = 左が明るい

  let defs = `
    <linearGradient id="${p}bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(bg.top, 0.35 + bgBright * 0.65)}"/>
      <stop offset="1" stop-color="${shade(bg.bottom, 0.35 + bgBright * 0.65)}"/>
    </linearGradient>`;

  let bgExtra = "";
  if (cut.bgStyle === "night" || cut.options.includes("bokeh")) {
    for (let i = 0; i < 14; i++) {
      const colors = ["#ff5fa2", "#4dd2ff", "#ffd24d", "#9d7bff"];
      bgExtra += `<circle cx="${rand() * W}" cy="${rand() * H * 0.7}" r="${6 + rand() * 16}" fill="${colors[i % 4]}" opacity="${0.12 + rand() * 0.25}"/>`;
    }
  }
  if (cut.bgStyle === "sunset") {
    bgExtra += `<circle cx="${W * 0.68}" cy="${H * 0.32}" r="34" fill="#fff0c0" opacity="0.95"/>
                <circle cx="${W * 0.68}" cy="${H * 0.32}" r="60" fill="#ffcf70" opacity="0.35"/>`;
  }
  if (cut.bgStyle === "sky") {
    bgExtra += `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#6a8f5e" opacity="0.8"/>
                <path d="M0,${H * 0.72} Q${W * 0.3},${H * 0.6} ${W * 0.55},${H * 0.7} T${W},${H * 0.68} V${H}H0Z" fill="#597d4e" opacity="0.9"/>`;
  }
  if (cut.options.includes("haze")) {
    const hx = keySide > 0 ? 0 : W;
    bgExtra += `<polygon points="${hx},0 ${hx + keySide * 260},0 ${W / 2 + keySide * 40},${H} ${W / 2 - keySide * 120},${H}" fill="#ffffff" opacity="0.09"/>
                <polygon points="${hx},0 ${hx + keySide * 140},0 ${W / 2 - keySide * 40},${H}" fill="#ffffff" opacity="0.07"/>`;
  }
  if (cut.options.includes("explosion")) {
    // 爆発は被写体の背後に描く
    const ex = W * 0.62, ey = H * 0.42;
    bgExtra += `
      <circle cx="${ex}" cy="${ey - 70}" r="46" fill="#3a3430" opacity="0.85"/>
      <circle cx="${ex - 34}" cy="${ey - 50}" r="36" fill="#4a4038" opacity="0.8"/>
      <circle cx="${ex + 30}" cy="${ey - 44}" r="32" fill="#443a32" opacity="0.8"/>
      <circle cx="${ex}" cy="${ey}" r="52" fill="#e05a2a" opacity="0.95"/>
      <circle cx="${ex - 20}" cy="${ey + 6}" r="34" fill="#f5921e" opacity="0.95"/>
      <circle cx="${ex + 14}" cy="${ey + 10}" r="26" fill="#ffd24d"/>
      <circle cx="${ex}" cy="${ey + 12}" r="14" fill="#fff3c4"/>
      ${Array.from({ length: 10 }, () => {
        const a = rand() * Math.PI * 2, r = 55 + rand() * 45;
        return `<line x1="${ex}" y1="${ey}" x2="${ex + Math.cos(a) * r}" y2="${ey + Math.sin(a) * r * 0.7}" stroke="#f5921e" stroke-width="${1 + rand() * 2.5}" opacity="0.8"/>`;
      }).join("")}`;
  }
  if (cut.options.includes("gel")) {
    bgExtra += `<rect x="0" y="0" width="${W / 2}" height="${H}" fill="#e040c8" opacity="0.16"/>
                <rect x="${W / 2}" y="0" width="${W / 2}" height="${H}" fill="#2a6ae8" opacity="0.16"/>`;
  }

  /* ---- 被写体 ---- */
  const cx = W / 2;
  const baseCy = angId === "high" ? H * 0.30 : angId === "low" ? H * 0.46 : H * 0.38;
  const gradAngle = keySide > 0 ? { x1: 0, x2: 1 } : { x1: 1, x2: 0 };
  let subjectSvg = "";
  const baseColors = { person: "#d9b48f", bottle: "#7fb8d8", cosme: "#e8c8d8", food: "#e0a05a", car: "#b04a55", arch: "#8a93a8" };
  const base = baseColors[cut.subjectType] || "#d9b48f";
  defs += `
    <linearGradient id="${p}subj" x1="${gradAngle.x1}" y1="0" x2="${gradAngle.x2}" y2="0">
      <stop offset="0" stop-color="${shade(base, keyF)}"/>
      <stop offset="0.55" stop-color="${shade(base, (keyF + shadowF) / 2)}"/>
      <stop offset="1" stop-color="${shade(base, shadowF)}"/>
    </linearGradient>`;
  const rimColor = an.avgTemp >= 7000 ? "#bfe0ff" : an.avgTemp <= 3800 ? "#ffd9a0" : "#fff2d8";
  const rimStroke = an.rimPower > 0
    ? `stroke="${rimColor}" stroke-width="${2 + an.rimPower / 40}" stroke-opacity="0.9"` : `stroke="none"`;

  if (cut.subjectType === "person") {
    const R = 30 * scale;
    const headCy = baseCy;
    subjectSvg = `
      <g ${angId === "dutch" ? `transform="rotate(-7 ${cx} ${headCy})"` : ""}>
        <path d="M${cx - R * 2.3},${headCy + R * 3.6} Q${cx - R * 1.9},${headCy + R * 1.25} ${cx - R * 0.85},${headCy + R * 1.05}
                 Q${cx},${headCy + R * 1.35} ${cx + R * 0.85},${headCy + R * 1.05}
                 Q${cx + R * 1.9},${headCy + R * 1.25} ${cx + R * 2.3},${headCy + R * 3.6} L${cx - R * 2.3},${headCy + R * 3.6} Z"
              fill="url(#${p}subj)" ${rimStroke}/>
        <circle cx="${cx}" cy="${headCy}" r="${R}" fill="url(#${p}subj)" ${rimStroke}/>
        ${silhouette ? "" : `<circle cx="${cx - R * 0.35}" cy="${headCy - R * 0.1}" r="${R * 0.07}" fill="#20242c"/>
        <circle cx="${cx + R * 0.35}" cy="${headCy - R * 0.1}" r="${R * 0.07}" fill="#20242c"/>`}
        ${an.topPower > 0 && !silhouette ? `<ellipse cx="${cx}" cy="${headCy - R * 0.75}" rx="${R * 0.7}" ry="${R * 0.22}" fill="#ffffff" opacity="0.5"/>` : ""}
      </g>`;
  } else if (cut.subjectType === "bottle" || cut.subjectType === "cosme") {
    const bh = (cut.subjectType === "bottle" ? 190 : 120) * scale * 0.75;
    const bw = bh * 0.3;
    const by = baseCy + bh * 0.55;
    subjectSvg = `
      <g>
        <rect x="${cx - bw * 0.28}" y="${by - bh - bh * 0.22}" width="${bw * 0.56}" height="${bh * 0.28}" rx="${bw * 0.1}" fill="${shade(base, shadowF + 0.15)}"/>
        <rect x="${cx - bw / 2}" y="${by - bh}" width="${bw}" height="${bh}" rx="${bw * 0.22}" fill="url(#${p}subj)" ${rimStroke}/>
        ${cut.options.includes("gloss") && !silhouette ? `
          <rect x="${cx - bw * 0.38}" y="${by - bh * 0.95}" width="${bw * 0.09}" height="${bh * 0.9}" rx="${bw * 0.05}" fill="#ffffff" opacity="0.75"/>
          <rect x="${cx + bw * 0.28}" y="${by - bh * 0.95}" width="${bw * 0.06}" height="${bh * 0.9}" rx="${bw * 0.03}" fill="#ffffff" opacity="0.45"/>` : ""}
        <rect x="${cx - bw / 2}" y="${by - bh * 0.62}" width="${bw}" height="${bh * 0.26}" fill="#f2ede2" opacity="${silhouette ? 0.25 : 0.92}"/>
        ${cut.options.includes("droplets") ? Array.from({ length: 26 }, () =>
          `<circle cx="${cx - bw / 2 + rand() * bw}" cy="${by - bh + rand() * bh}" r="${0.8 + rand() * 2.2}" fill="#ffffff" opacity="${0.35 + rand() * 0.45}"/>`).join("") : ""}
        <ellipse cx="${cx}" cy="${by + 6}" rx="${bw * 0.9}" ry="7" fill="#000" opacity="0.35"/>
      </g>`;
  } else if (cut.subjectType === "food") {
    const rw = 150 * scale * 0.7;
    subjectSvg = `
      <g>
        <ellipse cx="${cx}" cy="${baseCy + rw * 0.35}" rx="${rw}" ry="${rw * 0.3}" fill="#e8e4dc" opacity="${silhouette ? 0.3 : 1}"/>
        <ellipse cx="${cx}" cy="${baseCy + rw * 0.2}" rx="${rw * 0.62}" ry="${rw * 0.3}" fill="url(#${p}subj)" ${rimStroke}/>
        ${cut.options.includes("gloss") && !silhouette ? `<ellipse cx="${cx - rw * 0.2}" cy="${baseCy + rw * 0.08}" rx="${rw * 0.2}" ry="${rw * 0.07}" fill="#fff" opacity="0.6"/>` : ""}
      </g>`;
  } else if (cut.subjectType === "car") {
    const cw = 320 * scale * 0.75, ch = cw * 0.28;
    const cy2 = baseCy + ch;
    subjectSvg = `
      <g>
        <path d="M${cx - cw / 2},${cy2} Q${cx - cw / 2},${cy2 - ch * 0.55} ${cx - cw * 0.28},${cy2 - ch * 0.6}
                 L${cx - cw * 0.16},${cy2 - ch} Q${cx},${cy2 - ch * 1.12} ${cx + cw * 0.18},${cy2 - ch}
                 L${cx + cw * 0.3},${cy2 - ch * 0.6} Q${cx + cw / 2},${cy2 - ch * 0.5} ${cx + cw / 2},${cy2}Z"
              fill="url(#${p}subj)" ${rimStroke}/>
        ${cut.options.includes("gloss") && !silhouette ? `<path d="M${cx - cw * 0.4},${cy2 - ch * 0.52} L${cx + cw * 0.42},${cy2 - ch * 0.48}" stroke="#fff" stroke-width="3" opacity="0.7"/>` : ""}
        <circle cx="${cx - cw * 0.28}" cy="${cy2}" r="${ch * 0.28}" fill="#14161a"/>
        <circle cx="${cx + cw * 0.28}" cy="${cy2}" r="${ch * 0.28}" fill="#14161a"/>
      </g>`;
  } else { // arch
    subjectSvg = `
      <g>
        <rect x="${cx - 130 * scale}" y="${baseCy - 90 * scale}" width="${90 * scale}" height="${190 * scale}" fill="url(#${p}subj)" ${rimStroke}/>
        <rect x="${cx - 20 * scale}" y="${baseCy - 140 * scale}" width="${70 * scale}" height="${240 * scale}" fill="${shade(base, (keyF + shadowF) / 2)}"/>
        <rect x="${cx + 65 * scale}" y="${baseCy - 60 * scale}" width="${60 * scale}" height="${160 * scale}" fill="${shade(base, shadowF)}"/>
      </g>`;
  }

  /* ---- オプションエフェクト ---- */
  let fx = "";
  if (cut.options.includes("steam")) {
    fx += `<path d="M${cx - 20},${baseCy - 40} q14,-26 0,-50 q-14,-24 4,-46" stroke="#ffffff" stroke-width="7" fill="none" opacity="0.35" stroke-linecap="round"/>
           <path d="M${cx + 18},${baseCy - 36} q-12,-24 2,-46 q13,-22 -2,-44" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.28" stroke-linecap="round"/>`;
  }
  if (cut.options.includes("splash")) {
    for (let i = 0; i < 16; i++) {
      fx += `<circle cx="${cx - 90 + rand() * 180}" cy="${baseCy - 60 + rand() * 100}" r="${1.5 + rand() * 4}" fill="#cfe8ff" opacity="${0.5 + rand() * 0.4}"/>`;
    }
    fx += `<path d="M${cx - 70},${baseCy + 30} Q${cx - 30},${baseCy - 70} ${cx + 10},${baseCy - 20} Q${cx + 50},${baseCy + 20} ${cx + 80},${baseCy - 40}" stroke="#cfe8ff" stroke-width="5" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  }
  if (cut.options.includes("lensflare")) {
    const fxX = keySide > 0 ? W * 0.82 : W * 0.18;
    fx += `<line x1="0" y1="${H * 0.22}" x2="${W}" y2="${H * 0.22}" stroke="#9fd0ff" stroke-width="2.5" opacity="0.45"/>
           <circle cx="${fxX}" cy="${H * 0.22}" r="26" fill="#fff" opacity="0.55"/>
           <circle cx="${fxX - keySide * 90}" cy="${H * 0.30}" r="10" fill="#ffd9a0" opacity="0.4"/>
           <circle cx="${fxX - keySide * 170}" cy="${H * 0.38}" r="6" fill="#9fd0ff" opacity="0.4"/>`;
  }
  if (cut.options.includes("wind")) {
    fx += `<path d="M${cx - 150},${baseCy - 10} q40,-12 80,0" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.35"/>
           <path d="M${cx - 170},${baseCy + 20} q50,-14 100,0" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.28"/>`;
  }
  if (cut.options.includes("rain")) {
    for (let i = 0; i < 34; i++) {
      const rx = rand() * W, ry = rand() * H, len = 14 + rand() * 20;
      fx += `<line x1="${rx}" y1="${ry}" x2="${rx - len * 0.25}" y2="${ry + len}" stroke="#dceaf5" stroke-width="1.2" opacity="${0.3 + rand() * 0.4}"/>`;
    }
  }
  if (cut.options.includes("snow")) {
    for (let i = 0; i < 40; i++) {
      fx += `<circle cx="${rand() * W}" cy="${rand() * H}" r="${1 + rand() * 3}" fill="#ffffff" opacity="${0.4 + rand() * 0.5}"/>`;
    }
  }
  if (cut.options.includes("sparks")) {
    for (let i = 0; i < 36; i++) {
      const sx = rand() * W, sy = rand() * H * 0.85, len = 6 + rand() * 14;
      const c = ["#ffd24d", "#f5921e", "#ffb547"][i % 3];
      fx += `<line x1="${sx}" y1="${sy}" x2="${sx + (rand() - 0.5) * 6}" y2="${sy + len}" stroke="${c}" stroke-width="${0.8 + rand() * 1.4}" opacity="${0.5 + rand() * 0.5}"/>`;
    }
    fx += `<circle cx="${W * 0.3}" cy="${H * 0.12}" r="8" fill="#fff3c4" opacity="0.9"/>
           <circle cx="${W * 0.72}" cy="${H * 0.1}" r="8" fill="#fff3c4" opacity="0.9"/>`;
  }
  if (cut.options.includes("confetti")) {
    const colors = ["#e05a7a", "#4da3ff", "#ffd24d", "#4dc98a", "#c97ae0", "#f5921e"];
    for (let i = 0; i < 44; i++) {
      const px = rand() * W, py = rand() * H, rot = Math.round(rand() * 360);
      fx += `<rect x="${px}" y="${py}" width="${4 + rand() * 5}" height="${2.5 + rand() * 3}" fill="${colors[i % colors.length]}" opacity="${0.6 + rand() * 0.4}" transform="rotate(${rot} ${px} ${py})"/>`;
    }
  }

  /* ---- フレームオーバーレイ ---- */
  const ang2 = CAM_ANGLES.find(s => s.id === cut.camera.angle) || CAM_ANGLES[0];
  const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || CAM_MOVES[0];
  const overlay = `
    <g opacity="0.28" stroke="#ffffff" stroke-width="0.7">
      <line x1="${W / 3}" y1="0" x2="${W / 3}" y2="${H}"/><line x1="${W * 2 / 3}" y1="0" x2="${W * 2 / 3}" y2="${H}"/>
      <line x1="0" y1="${H / 3}" x2="${W}" y2="${H / 3}"/><line x1="0" y1="${H * 2 / 3}" x2="${W}" y2="${H * 2 / 3}"/>
    </g>
    <rect x="0" y="${H - 26}" width="${W}" height="26" fill="#000" opacity="0.55"/>
    <text x="10" y="${H - 8}" fill="#ffd98a" font-size="13" font-family="monospace">${esc(cut.camera.shotSize)} | ${esc(ang2.label)} | ${esc(mov.label)} | ${cut.camera.focalMm || ""}mm F${cut.camera.apertureF || ""} | ${esc((CAMERA_SUPPORTS.find(s => s.id === cut.camera.support) || {}).label || "")}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>
    <rect width="${W}" height="${H}" fill="url(#${p}bg)"/>
    ${bgExtra}${subjectSvg}${fx}${overlay}
  </svg>`;
}

/* =========================================================
 * UI レンダリング
 * ======================================================= */
function renderPresetList() {
  const q = byId("presetSearch").value.trim().toLowerCase();
  const wrap = byId("presetList");
  const cut = activeCut();
  const groups = {};
  for (const p of PRESETS) {
    if (!p.modes.includes(state.mode)) continue;
    const text = (p.name + p.desc + p.tags.join(" ")).toLowerCase();
    if (q && !text.includes(q)) continue;
    (groups[p.group] = groups[p.group] || []).push(p);
  }
  wrap.innerHTML = Object.entries(groups).map(([g, ps]) => `
    <div class="preset-group-title">${esc(g)}</div>
    ${ps.map(p => `
      <div class="preset-card ${cut && cut.presetId === p.id ? "active" : ""}" data-preset="${p.id}">
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-desc">${esc(p.desc)}</div>
        <div class="p-tags">${p.tags.map(t => `<span class="p-tag">${esc(t)}</span>`).join("")}</div>
      </div>`).join("")}
  `).join("") || `<div class="insp-hint" style="margin-top:12px">該当する技法がありません</div>`;

  wrap.querySelectorAll(".preset-card").forEach(el => {
    el.addEventListener("click", () => applyPreset(el.dataset.preset));
  });
}

function applyPreset(presetId) {
  const preset = PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  const cut = activeCut();
  const idx = state.activeCut;
  const fresh = makeCut(preset);
  fresh.id = cut.id; // プレビューseedを安定させたい場合は維持しない方が自然だが、参照維持のためIDは引き継ぐ
  state.cuts[idx] = fresh;
  state.selectedItem = null;
  renderAll();
}

function renderCanvas() {
  const svg = byId("studioCanvas");
  svg.innerHTML = renderCanvasSVG(activeCut(), true);
  // 選択ハイライト
  if (state.selectedItem) {
    const g = svg.querySelector(`[data-id="${state.selectedItem}"]`);
    if (g) g.classList.add("selected");
  }
}

function renderPreview() {
  byId("previewWrap").innerHTML = renderPreviewSVG(activeCut(), "live");
  byId("explainList").innerHTML = explainCut(activeCut()).map(l => `<li>${esc(l)}</li>`).join("");
}

function renderPrompt() {
  byId("promptText").value = generatePrompt(activeCut());
}

function renderCutStrip() {
  const strip = byId("cutStrip");
  strip.innerHTML = state.cuts.map((c, i) => `
    <div class="cut-thumb ${i === state.activeCut ? "active" : ""}" data-idx="${i}">
      ${renderPreviewSVG(c, "th" + i)}
      <div class="cut-cap">C${i + 1}　${esc(c.name)}</div>
    </div>`).join("");
  strip.querySelectorAll(".cut-thumb").forEach(el => {
    el.addEventListener("click", () => {
      state.activeCut = +el.dataset.idx;
      state.selectedItem = null;
      renderAll();
    });
  });
}

function fieldRow(label, inner) {
  return `<div class="field"><label>${esc(label)}</label>${inner}</div>`;
}
function selectHtml(id, options, value) {
  return `<select id="${id}">${options.map(o =>
    `<option value="${esc(o.id)}" ${o.id === value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
}

function renderInspector() {
  const cut = activeCut();
  const insp = byId("inspector");
  const selItem = cut.items.find(i => i.id === state.selectedItem);

  let itemSection = "";
  if (selItem) {
    const t = EQUIP_TYPES[selItem.type];
    const isLight = LIGHT_TYPES.includes(selItem.type);
    const hasHeight = !VEHICLE_TYPES.includes(selItem.type) && !["village", "sound", "subject", "camera"].includes(selItem.type);
    const distM = (Math.hypot(selItem.x - SUBJECT_POS.x, selItem.y - SUBJECT_POS.y) / 100).toFixed(1);
    itemSection = `
      <div class="insp-section">
        <h3>選択中の機材: ${esc(t.label)}</h3>
        ${hasHeight ? `<div class="field-row3"><label>高さ</label>
          <input type="range" id="itHeight" min="10" max="${selItem.type === "drone" || selItem.type === "sun" ? 5000 : 450}" value="${selItem.height}">
          <span class="range-val">${selItem.height}cm</span></div>` : ""}
        ${isLight ? `
        <div class="field-row3"><label>出力</label>
          <input type="range" id="itPower" min="0" max="100" value="${selItem.power}">
          <span class="range-val">${selItem.power}%</span></div>
        <div class="field-row3"><label>色温度</label>
          <input type="range" id="itTemp" min="2500" max="10000" step="100" value="${selItem.colorTemp}">
          <span class="range-val">${selItem.colorTemp}K</span></div>
        <div class="field-row3"><label>照射角</label>
          <input type="range" id="itBeam" min="10" max="120" step="1" value="${selItem.beamAngle ?? 60}">
          <span class="range-val">${selItem.beamAngle ?? 60}°</span></div>
        ${fieldRow("モディファイア", `<select id="itMod">${MODIFIERS.map(m =>
          `<option ${m === selItem.modifier ? "selected" : ""}>${esc(m)}</option>`).join("")}</select>`)}
        ${fieldRow("スタンド", `<select id="itStand">${LIGHT_STANDS.map(s =>
          `<option ${s === (selItem.stand || "ライトスタンド") ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`)}` : ""}
        <div class="insp-hint">被写体からの距離: 約${distM}m ｜ 方位: ${esc(relToJa(analyzeLighting(cut).lights.find(l => l.item.id === selItem.id)?.rel ?? 0))}</div>
        ${selItem.type !== "subject" && selItem.type !== "camera"
          ? `<button class="btn small danger" id="btnDelItem" style="margin-top:6px">この機材を削除</button>` : ""}
      </div>`;
  }

  insp.innerHTML = `
    <div class="insp-section">
      <h3>カット設定 — C${state.activeCut + 1}</h3>
      ${fieldRow("カット名", `<input type="text" id="cName" value="${esc(cut.name)}">`)}
      ${fieldRow("狙い/意図", `<textarea id="cAim" rows="2">${esc(cut.aim)}</textarea>`)}
      ${fieldRow("被写体", selectHtml("cSubject", SUBJECT_TYPES, cut.subjectType))}
      ${fieldRow("背景", selectHtml("cBg", Object.keys(BG_STYLES).map(k => ({ id: k, label: k + " — " + BG_STYLES[k].en })), cut.bgStyle))}
      ${cut.aspect !== "3:2" ? fieldRow("尺(秒)", `<input type="number" id="cDur" value="${cut.duration}" min="1" max="60">`) : ""}
    </div>
    <div class="insp-section">
      <h3>カメラ & レンズ</h3>
      ${fieldRow("ボディ", selectHtml("cBody", CAMERA_BODIES, cut.camera.body))}
      ${fieldRow("カットサイズ", selectHtml("cShot", SHOT_SIZES, cut.camera.shotSize))}
      ${fieldRow("アングル", selectHtml("cAngle", CAM_ANGLES, cut.camera.angle))}
      ${fieldRow("カメラワーク", selectHtml("cMove", CAM_MOVES, cut.camera.move))}
      ${fieldRow("レンズ選択", selectHtml("cLens", LENSES, cut.camera.lens))}
      <div class="field-row3"><label>焦点距離</label>
        <input type="range" id="cFocal" min="8" max="800" step="1" value="${cut.camera.focalMm}">
        <span class="range-val">${cut.camera.focalMm}mm</span></div>
      <div class="field-row3"><label>絞り (F値)</label>
        <input type="range" id="cApertureF" min="1.2" max="22" step="0.1" value="${cut.camera.apertureF}">
        <span class="range-val">F${cut.camera.apertureF}</span></div>
      <div class="field-row3"><label>フォーカス</label>
        <input type="range" id="cFocus" min="0.2" max="30" step="0.1" value="${cut.camera.focusM}">
        <span class="range-val">${cut.camera.focusM}m</span></div>
      ${fieldRow("NDフィルター", `<select id="cNd">${ND_FILTERS.map(n => `<option ${n === cut.camera.nd ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`)}
      <div class="field"><label>レンズフィルター</label>
        <div class="opt-toggles">${LENS_FILTERS.map(f =>
          `<span class="opt-toggle filter-toggle ${cut.camera.filters.includes(f.id) ? "on" : ""}" data-filter="${f.id}" title="${esc(f.en)}">${esc(f.label)}</span>`).join("")}</div></div>
      ${fieldRow("シャッター", `<input type="text" id="cShutter" value="${esc(cut.camera.shutter)}">`)}
      ${fieldRow("ISO", `<input type="text" id="cIso" value="${esc(cut.camera.iso)}">`)}
      ${cut.aspect !== "3:2" ? fieldRow("フレームレート", `<input type="text" id="cFps" value="${esc(cut.camera.fps)}">`) : ""}
      ${fieldRow("WB", `<input type="text" id="cWb" value="${esc(cut.camera.wb)}">`)}
    </div>
    <div class="insp-section">
      <h3>サポート (支持機材)</h3>
      ${fieldRow("支持機材", selectHtml("cSupport", CAMERA_SUPPORTS, cut.camera.support))}
      ${(() => {
        const sup = CAMERA_SUPPORTS.find(s => s.id === cut.camera.support);
        if (!sup || !sup.param) return "";
        return `<div class="field-row3"><label>${esc(sup.param.label)}</label>
          <input type="range" id="cSupParam" min="${sup.param.min}" max="${sup.param.max}" step="1" value="${cut.camera.supportParam}">
          <span class="range-val">${cut.camera.supportParam}${esc(sup.param.unit)}</span></div>`;
      })()}
      ${fieldRow("雲台", `<select id="cHead">${CAMERA_HEADS.map(h => `<option ${h === cut.camera.head ? "selected" : ""}>${esc(h)}</option>`).join("")}</select>`)}
      <div class="insp-hint">カメラワークを変えると支持機材が自動で切り替わります (手動変更も可能)。俯瞰図のカメラ下にレール・アーム等が表示されます。</div>
    </div>
    <div class="insp-section">
      <h3>演出オプション <small style="color:var(--text-dim)">(商品の光り方・雫など)</small></h3>
      <div class="opt-toggles">
        ${SHOT_OPTIONS.map(o => `<span class="opt-toggle ${cut.options.includes(o.id) ? "on" : ""}" data-opt="${o.id}" title="${esc(o.note)}">${esc(o.label)}</span>`).join("")}
      </div>
      <div class="insp-hint" style="margin-top:8px">${cut.options.map(o => {
        const s = SHOT_OPTIONS.find(x => x.id === o); return s ? `<b>${esc(s.label)}</b>: ${esc(s.note)}` : "";
      }).join("<br>") || "オプションを選択すると実施上の注意が表示されます"}</div>
    </div>
    ${itemSection}
    <div class="insp-section">
      <h3>備考 (指示書に記載)</h3>
      <textarea id="cNotes" rows="3" style="width:100%">${esc(cut.notes)}</textarea>
    </div>`;

  /* --- bind --- */
  const bind = (id, fn, ev = "change") => { const el = byId(id); if (el) el.addEventListener(ev, fn); };
  bind("cName", e => { cut.name = e.target.value; renderCutStrip(); });
  bind("cAim", e => { cut.aim = e.target.value; });
  bind("cSubject", e => { cut.subjectType = e.target.value; refresh(); });
  bind("cBg", e => { cut.bgStyle = e.target.value; refresh(); });
  bind("cDur", e => { cut.duration = +e.target.value; });
  bind("cShot", e => { cut.camera.shotSize = e.target.value; refresh(); });
  bind("cAngle", e => { cut.camera.angle = e.target.value; refresh(); });
  bind("cMove", e => {
    cut.camera.move = e.target.value;
    // カメラワークに応じて支持機材を自動選択
    const supId = MOVE_SUPPORT[e.target.value] || "tripod";
    cut.camera.support = supId;
    const sup = CAMERA_SUPPORTS.find(s => s.id === supId);
    cut.camera.supportParam = sup && sup.param ? sup.param.def : 0;
    refresh(); renderInspector();
  });
  bind("cBody", e => { cut.camera.body = e.target.value; renderPrompt(); });
  bind("cLens", e => {
    cut.camera.lens = e.target.value;
    cut.camera.focalMm = LENS_FOCAL[e.target.value] ?? cut.camera.focalMm;
    refresh(); renderInspector();
  });
  bind("cNd", e => { cut.camera.nd = e.target.value; });
  bind("cSupport", e => {
    cut.camera.support = e.target.value;
    const sup = CAMERA_SUPPORTS.find(s => s.id === e.target.value);
    cut.camera.supportParam = sup && sup.param ? sup.param.def : 0;
    renderCanvas(); renderPrompt(); renderInspector();
  });
  bind("cHead", e => { cut.camera.head = e.target.value; });
  { // 連続値スライダー (焦点距離 / F値 / フォーカス / サポートパラメータ)
    const bindCamRange = (id, prop, fmt) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("input", e => {
        cut.camera[prop] = +e.target.value;
        el.nextElementSibling.textContent = fmt(+e.target.value);
        renderCanvas(); renderPreview(); renderPrompt();
      });
    };
    bindCamRange("cFocal", "focalMm", v => v + "mm");
    bindCamRange("cApertureF", "apertureF", v => "F" + v);
    bindCamRange("cFocus", "focusM", v => v + "m");
    const supDef = CAMERA_SUPPORTS.find(s => s.id === cut.camera.support);
    bindCamRange("cSupParam", "supportParam", v => v + (supDef && supDef.param ? supDef.param.unit : ""));
  }
  insp.querySelectorAll(".filter-toggle").forEach(el => {
    el.addEventListener("click", () => {
      const f = el.dataset.filter;
      const i = cut.camera.filters.indexOf(f);
      if (i >= 0) cut.camera.filters.splice(i, 1); else cut.camera.filters.push(f);
      renderPrompt(); renderInspector();
    });
  });
  bind("cShutter", e => { cut.camera.shutter = e.target.value; });
  bind("cIso", e => { cut.camera.iso = e.target.value; });
  bind("cFps", e => { cut.camera.fps = e.target.value; renderPrompt(); });
  bind("cWb", e => { cut.camera.wb = e.target.value; });
  bind("cNotes", e => { cut.notes = e.target.value; });

  insp.querySelectorAll(".opt-toggle[data-opt]").forEach(el => {
    el.addEventListener("click", () => {
      const o = el.dataset.opt;
      const i = cut.options.indexOf(o);
      if (i >= 0) cut.options.splice(i, 1); else cut.options.push(o);
      refresh(); renderInspector();
    });
  });

  if (selItem) {
    const UNITS = { colorTemp: "K", power: "%", beamAngle: "°", height: "cm" };
    const bindRange = (id, prop) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener("input", e => {
        selItem[prop] = +e.target.value;
        el.nextElementSibling.textContent = e.target.value + (UNITS[prop] || "");
        renderCanvas(); renderPreview(); renderPrompt();
      });
    };
    bindRange("itHeight", "height");
    bindRange("itPower", "power");
    bindRange("itTemp", "colorTemp");
    bindRange("itBeam", "beamAngle");
    bind("itMod", e => {
      selItem.modifier = e.target.value;
      // モディファイアに応じた照射角へ自動更新 (手動調整はその後も可能)
      if (MODIFIER_BEAM[e.target.value] != null) selItem.beamAngle = MODIFIER_BEAM[e.target.value];
      refresh(); renderInspector();
    });
    bind("itStand", e => { selItem.stand = e.target.value; });
    bind("btnDelItem", () => {
      cut.items = cut.items.filter(i => i.id !== selItem.id);
      state.selectedItem = null;
      renderAll();
    }, "click");
  }
}

function refresh() { renderCanvas(); renderPreview(); renderPrompt(); renderCutStrip(); }
function renderAll() { renderPresetList(); renderCanvas(); renderPreview(); renderPrompt(); renderCutStrip(); renderInspector(); }

/* =========================================================
 * キャンバス ドラッグ操作
 * ======================================================= */
(function setupDrag() {
  const svg = byId("studioCanvas");
  let dragging = null;

  function svgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  svg.addEventListener("pointerdown", e => {
    const g = e.target.closest(".equip-item");
    if (!g) { state.selectedItem = null; renderCanvas(); renderInspector(); return; }
    const cut = activeCut();
    const item = cut.items.find(i => i.id === g.dataset.id);
    if (!item) return;
    const p = svgPoint(e);
    dragging = { item, dx: item.x - p.x, dy: item.y - p.y, moved: false };
    state.selectedItem = item.id;
    try { svg.setPointerCapture(e.pointerId); } catch { /* 合成イベント等では失敗しても問題ない */ }
    renderCanvas(); renderInspector();
  });

  svg.addEventListener("pointermove", e => {
    if (!dragging) return;
    const p = svgPoint(e);
    dragging.item.x = Math.max(20, Math.min(980, p.x + dragging.dx));
    dragging.item.y = Math.max(20, Math.min(680, p.y + dragging.dy));
    dragging.moved = true;
    renderCanvas();
  });

  const endDrag = () => {
    if (dragging && dragging.moved) { renderPreview(); renderPrompt(); renderCutStrip(); renderInspector(); }
    dragging = null;
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
})();

/* =========================================================
 * 指示書 (PDF/印刷) 書き出し
 * ======================================================= */
function equipTableRows(cut) {
  const an = analyzeLighting(cut);
  return cut.items.filter(i => i.type !== "subject" && i.type !== "camera").map(it => {
    const t = EQUIP_TYPES[it.type];
    const distM = (Math.hypot(it.x - SUBJECT_POS.x, it.y - SUBJECT_POS.y) / 100).toFixed(1);
    const rel = an.lights.find(l => l.item.id === it.id)?.rel;
    const isLight = LIGHT_TYPES.includes(it.type);
    const hasHeight = !VEHICLE_TYPES.includes(it.type) && !["village", "sound"].includes(it.type);
    return `<tr>
      <td>${esc(t.label)}</td>
      <td>${rel !== undefined ? esc(relToJa(rel)) : "—"}</td>
      <td>${distM}m</td>
      <td>${hasHeight ? it.height + "cm" : "—"}</td>
      <td>${isLight ? it.power + "%" : "—"}</td>
      <td>${isLight && it.power > 0 ? it.colorTemp + "K" : "—"}</td>
      <td>${isLight ? (it.beamAngle ?? 60) + "°" : "—"}</td>
      <td>${isLight ? esc(it.modifier) : "—"}</td>
      <td>${isLight ? esc(it.stand || "ライトスタンド") : "—"}</td>
    </tr>`;
  }).join("");
}

function buildInstructionDoc() {
  const today = new Date().toLocaleDateString("ja-JP");
  const modeLabel = { video: "動画スタジオ", still: "スチールスタジオ", outdoor: "屋外・ドローン" }[state.mode];

  const cutPages = state.cuts.map((cut, i) => {
    const preset = PRESETS.find(p => p.id === cut.presetId);
    const jaLines = generateJaSummary(cut);
    const opts = cut.options.map(o => SHOT_OPTIONS.find(s => s.id === o)).filter(Boolean);
    return `
    <section class="cut-page">
      <h2>CUT ${i + 1}　${esc(cut.name)} <span class="dur">${cut.aspect === "3:2" ? "スチール" : "尺: " + cut.duration + "秒"}</span></h2>
      ${cut.aim ? `<p class="aim"><b>狙い:</b> ${esc(cut.aim)}</p>` : ""}
      <div class="two-col">
        <figure>
          <figcaption>スタジオ配置図 (俯瞰) — グリッド1マス=50cm</figcaption>
          <svg viewBox="0 0 1000 700" style="background:#fbfcfd;border-radius:6px">${renderCanvasSVG(cut, false)}</svg>
        </figure>
        <figure>
          <figcaption>想定カットイメージ</figcaption>
          ${renderPreviewSVG(cut, "doc" + i)}
        </figure>
      </div>

      <h3>この配置だとこう写る (かんたん解説)</h3>
      <ul class="ja-summary">${explainCut(cut).map(l => `<li>${esc(l)}</li>`).join("")}</ul>

      <h3>ライティング指示</h3>
      <ul class="ja-summary">${jaLines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
      <table>
        <thead><tr><th>機材</th><th>方位 (カメラ軸基準)</th><th>被写体距離</th><th>高さ</th><th>出力</th><th>色温度</th><th>照射角</th><th>モディファイア</th><th>スタンド</th></tr></thead>
        <tbody>${equipTableRows(cut)}</tbody>
      </table>

      <h3>カメラ・レンズ設定</h3>
      <table>
        <thead><tr><th>ボディ</th><th>サイズ</th><th>アングル</th><th>ワーク</th><th>焦点距離</th><th>絞り</th><th>フォーカス</th><th>SS</th><th>ISO</th><th>FPS</th><th>WB</th></tr></thead>
        <tbody><tr>
          <td>${esc((CAMERA_BODIES.find(b => b.id === cut.camera.body) || {}).label || "")}</td>
          <td>${esc((SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || {}).label || "")}</td>
          <td>${esc((CAM_ANGLES.find(s => s.id === cut.camera.angle) || {}).label || "")}</td>
          <td>${esc((CAM_MOVES.find(s => s.id === cut.camera.move) || {}).label || "")}</td>
          <td>${cut.camera.focalMm}mm${cut.camera.lens === "anam" ? " (アナモ2x)" : ""}</td>
          <td>F${cut.camera.apertureF}</td><td>${cut.camera.focusM}m</td>
          <td>${esc(cut.camera.shutter)}</td>
          <td>${esc(cut.camera.iso)}</td><td>${esc(cut.camera.fps)}</td><td>${esc(cut.camera.wb)}</td>
        </tr></tbody>
      </table>

      <h3>支持機材・フィルター</h3>
      <table>
        <thead><tr><th>支持機材</th><th>パラメータ</th><th>雲台</th><th>ND</th><th>レンズフィルター</th></tr></thead>
        <tbody><tr>
          ${(() => {
            const sup = CAMERA_SUPPORTS.find(s => s.id === cut.camera.support);
            const p = sup && sup.param ? `${sup.param.label}: ${cut.camera.supportParam}${sup.param.unit}` : "—";
            const fl = (cut.camera.filters || []).map(f => (LENS_FILTERS.find(x => x.id === f) || {}).label).filter(Boolean).join(" / ") || "なし";
            return `<td>${esc(sup ? sup.label : "")}</td><td>${esc(p)}</td><td>${esc(cut.camera.head)}</td><td>${esc(cut.camera.nd)}</td><td>${esc(fl)}</td>`;
          })()}
        </tr></tbody>
      </table>

      ${opts.length ? `<h3>演出オプションと実施上の注意</h3>
      <ul>${opts.map(o => `<li><b>${esc(o.label)}</b> — ${esc(o.note)}</li>`).join("")}</ul>` : ""}

      ${preset ? `<h3>技法メモ: ${esc(preset.name)}</h3><p class="memo">${esc(preset.desc)}</p>` : ""}
      ${cut.notes ? `<h3>備考</h3><p class="memo">${esc(cut.notes)}</p>` : ""}

      <h3>AI動画生成プロンプト (Seedance / 英語)</h3>
      <pre class="prompt">${esc(generatePrompt(cut))}</pre>
    </section>`;
  }).join("");

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <title>撮影指示書 — ${esc(state.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #1a1d24; padding: 24px; background: #fff; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { color: #667; font-size: 12px; margin-bottom: 18px; }
    .toolbar { margin: 12px 0 24px; }
    .toolbar button { padding: 10px 22px; font-size: 14px; cursor: pointer; background: #1a1d24; color: #fff; border: 0; border-radius: 6px; }
    .toc { margin-bottom: 24px; border-collapse: collapse; width: 100%; }
    .cut-page { page-break-after: always; border-top: 3px solid #1a1d24; padding-top: 14px; margin-bottom: 36px; }
    h2 { font-size: 19px; margin-bottom: 8px; }
    h2 .dur { font-size: 12px; color: #667; font-weight: 400; margin-left: 10px; }
    h3 { font-size: 14px; margin: 16px 0 6px; border-left: 4px solid #ffb547; padding-left: 8px; }
    .aim { font-size: 13px; background: #fff7e8; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; }
    .two-col { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; align-items: start; }
    figure figcaption { font-size: 11px; color: #667; margin-bottom: 4px; }
    figure svg { width: 100%; height: auto; border: 1px solid #ccc; border-radius: 6px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
    th { background: #f0f2f5; font-size: 11px; }
    ul { padding-left: 20px; font-size: 13px; line-height: 1.7; }
    .ja-summary li { margin-bottom: 2px; }
    .memo { font-size: 12px; line-height: 1.7; color: #333; }
    .prompt { background: #14161b; color: #b8e0b8; padding: 12px; border-radius: 6px; font-size: 11px; white-space: pre-wrap; font-family: ui-monospace, monospace; line-height: 1.6; }
    @media print { .toolbar { display: none; } body { padding: 0; } }
  </style></head><body>
    <h1>撮影指示書 — ${esc(state.projectTitle)}</h1>
    <div class="meta">モード: ${esc(modeLabel)} ｜ カット数: ${state.cuts.length} ｜ 出力日: ${esc(today)} ｜ Generated by Virtual Studio</div>
    <div class="toolbar"><button onclick="window.print()">🖨 印刷 / PDFに保存</button></div>
    <table class="toc">
      <thead><tr><th>#</th><th>カット名</th><th>サイズ</th><th>ワーク</th><th>尺</th><th>狙い</th></tr></thead>
      <tbody>${state.cuts.map((c, i) => `<tr>
        <td>C${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.camera.shotSize)}</td>
        <td>${esc((CAM_MOVES.find(s => s.id === c.camera.move) || {}).label || "")}</td>
        <td>${c.aspect === "3:2" ? "スチール" : c.duration + "s"}</td><td>${esc(c.aim.slice(0, 40))}</td></tr>`).join("")}
      </tbody>
    </table>
    ${cutPages}
  </body></html>`;
}

function exportDoc() {
  const html = buildInstructionDoc();
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    // ポップアップブロック時: HTMLファイルとしてダウンロード
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shooting-instructions.html";
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

/* ---------- SVG画像 / JSON 書き出し ---------- */
function downloadPlanSVG() {
  const cut = activeCut();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" style="background:#fbfcfd">${renderCanvasSVG(cut, false)}</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `studio-plan-C${state.activeCut + 1}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportJSON() {
  const blob = new Blob([JSON.stringify({ version: 1, ...state }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "virtual-studio-project.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.cuts) || !data.cuts.length) throw new Error("cuts がありません");
      state.mode = data.mode || "video";
      state.cuts = data.cuts.map(ensureCameraDefaults); // 旧バージョンのJSONに詳細フィールドを補完
      state.activeCut = Math.min(data.activeCut || 0, state.cuts.length - 1);
      state.selectedItem = null;
      state.projectTitle = data.projectTitle || state.projectTitle;
      document.querySelectorAll(".mode-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
      renderAll();
    } catch (err) {
      alert("読み込みに失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* =========================================================
 * イベント接続 / 初期化
 * ======================================================= */
function setupHeader() {
  document.querySelectorAll(".mode-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      document.querySelectorAll(".mode-tab").forEach(b => b.classList.toggle("active", b === btn));
      renderPresetList();
    });
  });
  byId("presetSearch").addEventListener("input", renderPresetList);
  byId("btnExportDoc").addEventListener("click", exportDoc);
  byId("btnExportJson").addEventListener("click", exportJSON);
  byId("btnImportJson").addEventListener("click", () => byId("fileImport").click());
  byId("fileImport").addEventListener("change", e => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });
  byId("btnDownloadPlan").addEventListener("click", downloadPlanSVG);

  // 機材追加
  const sel = byId("equipTypeSelect");
  sel.innerHTML = Object.entries(EQUIP_TYPES)
    .filter(([k]) => k !== "subject" && k !== "camera")
    .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
  byId("btnAddEquip").addEventListener("click", () => {
    const type = sel.value;
    const cut = activeCut();
    const item = makeItem({ type, x: 200 + Math.random() * 100, y: 150 + Math.random() * 100, power: LIGHT_TYPES.includes(type) ? 50 : 0 });
    cut.items.push(item);
    state.selectedItem = item.id;
    renderCanvas(); renderPreview(); renderPrompt(); renderInspector();
  });

  // カット操作
  byId("btnAddCut").addEventListener("click", () => {
    state.cuts.push(makeCut(null));
    state.activeCut = state.cuts.length - 1;
    state.selectedItem = null;
    renderAll();
  });
  byId("btnDupCut").addEventListener("click", () => {
    const clone = JSON.parse(JSON.stringify(activeCut()));
    clone.id = uid();
    clone.items.forEach(i => i.id = uid());
    clone.name += " (複製)";
    state.cuts.splice(state.activeCut + 1, 0, clone);
    state.activeCut++;
    renderAll();
  });
  byId("btnDelCut").addEventListener("click", () => {
    if (state.cuts.length <= 1) { alert("最後のカットは削除できません"); return; }
    state.cuts.splice(state.activeCut, 1);
    state.activeCut = Math.max(0, state.activeCut - 1);
    state.selectedItem = null;
    renderAll();
  });

  byId("btnCopyPrompt").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byId("promptText").value);
      byId("btnCopyPrompt").textContent = "✓ コピー済";
      setTimeout(() => byId("btnCopyPrompt").textContent = "コピー", 1500);
    } catch { byId("promptText").select(); document.execCommand("copy"); }
  });
}

function init() {
  setupHeader();
  // デモ用の初期カット割り: 三点照明 → レンブラント → 逆光シルエット
  state.cuts = [
    makeCut(PRESETS.find(p => p.id === "three-point")),
    makeCut(PRESETS.find(p => p.id === "rembrandt")),
    makeCut(PRESETS.find(p => p.id === "backlight-silhouette")),
  ];
  state.activeCut = 0;
  renderAll();
}

init();
