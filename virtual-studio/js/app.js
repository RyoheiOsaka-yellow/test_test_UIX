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
  promptModel: "seedance",
  customPresets: [], // mdインポートされた技法
  // プロジェクト共通の使用機材キット (機材DBで選択 → 全カット・保存に反映)
  kit: { body: null, lens: null, support: null, drone: null },
  customDNA: [], // 参照の手動注釈から作られたPattern DNA (V8 Phase 2)
  // 制作ワークフロー: ChatGPT等で作った参照画像+ストーリーの受け入れ (ステップ1)
  story: { text: "", refs: [], audioVol: { bgm: 0.4, nar: 1 } }, // refs: {id, name, thumb, clipId, hasAlpha} 本体はIDB
};

function allPresets() { return PRESETS.concat(state.customPresets); }

/* 選択インデックスは常にカット数の範囲へ丸める
 * (非同期の再描画がカット削除と行き違っても落ちないように) */
function activeCut() {
  if (state.activeCut >= state.cuts.length) state.activeCut = Math.max(0, state.cuts.length - 1);
  return state.cuts[state.activeCut];
}

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
    if (it.watt == null) it.watt = TYPE_WATT[it.type] ?? 0;
  }
  return it;
}

const SUBJECT_DEFAULT_ACTION = { person: "stand", bottle: "place", cosme: "place", food: "place", car: "drive", arch: "place" };

function ensureCameraDefaults(cut) {
  /* カット全体の詳細フィールド */
  if (!cut.kind) cut.kind = cut.aspect === "3:2" || cut.aspect === "4:5" ? "still" : "video";
  if (!cut.look) cut.look = "natural";
  if (!cut.action) cut.action = SUBJECT_DEFAULT_ACTION[cut.subjectType] || "stand";
  if (cut.subjectNote == null) cut.subjectNote = "";
  if (!cut.audio) cut.audio = cut.kind === "still" ? "MOS (現場無音・後付け)" : AUDIO_MODES[0];
  if (!cut.weather) cut.weather = "none";
  if (!cut.timeOfDay) cut.timeOfDay = "none";
  if (cut.takes == null) cut.takes = 3;
  if (cut.setupMin == null) cut.setupMin = 30;
  if (!cut.transition) cut.transition = "cut";
  /* V6 EditDecision: 採用テイク・素材イン点 (プリロール込み)・音の編集点 */
  if (cut.take == null) cut.take = 1;
  if (cut.srcInSec == null) cut.srcInSec = 2;
  if (!cut.audioEdit) cut.audioEdit = "none";
  if (cut.audioOverlapSec == null) cut.audioOverlapSec = 1;
  /* ワークフロー進行状態 (1素材→2設計→3生成→4レビュー) */
  if (!cut.wfStatus) cut.wfStatus = "plan";
  /* 参照画像 (ワークフローの素材) — プレビュー/first frameに使う */
  if (cut.refImgId === undefined) cut.refImgId = null;
  if (cut.refOffX == null) cut.refOffX = 0; // 画像の寄り位置 (%)
  if (cut.refOffY == null) cut.refOffY = 0;
  if (cut.caption == null) cut.caption = ""; // テロップ/セリフ (編集用・プロンプトには入れない)
  /* ロケ地 (演出) — 未設定なら既存の出力に影響しない */
  if (!cut.location || typeof cut.location !== "object") cut.location = {};
  const lc = cut.location;
  if (!Array.isArray(lc.keep)) lc.keep = LOCATION_ASPECTS.map(a => a.id);
  if (lc.name == null) lc.name = "";
  if (lc.note == null) lc.note = "";
  if (lc.camBearing == null) lc.camBearing = 0;
  /* 人の動き (演技演出) — 使わなければ空のまま。既存の出力には影響しない */
  if (!cut.perf || typeof cut.perf !== "object") cut.perf = {};
  const pf = cut.perf;
  if (!Array.isArray(pf.beats)) pf.beats = [];   // [{id, sec, who, do, gaze, cam}]
  if (!pf.speed) pf.speed = "moderate";
  if (!pf.care) pf.care = "natural";
  if (!pf.toward) pf.toward = "alone";
  if (!pf.temp) pf.temp = "private";
  if (pf.people == null) pf.people = 1;
  /* 登場要素 — 動くのは人だけではない。旧データの人数から自動生成する */
  if (!Array.isArray(pf.actors) || !pf.actors.length) {
    const t = cut.subjectType === "car" ? "vehicle"
      : ["bottle", "cosme", "food", "arch"].includes(cut.subjectType) ? "object" : "person";
    const n = Math.max(1, +pf.people || 1);
    pf.actors = Array.from({ length: n }, (_, i) => ({ id: uid(), type: t, name: n > 1 ? `${i + 1}` : "" }));
  }
  pf.people = pf.actors.length; // 人数は登場要素数から導出
  if (!pf.contact) pf.contact = "none";
  if (!pf.camLink) pf.camLink = "none";
  if (!pf.method) pf.method = "auto";            // auto = 推奨に従う
  if (!Array.isArray(pf.preserve)) pf.preserve = [];
  if (!Array.isArray(pf.change)) pf.change = [];
  if (!Array.isArray(pf.unfit)) pf.unfit = [];
  /* どのモード (動画/スチール/屋外・ドローン) で作られたカットか。
   * 旧データはkindとプリセットの対応モードから推定する */
  if (!cut.originMode) {
    const p = cut.presetId ? allPresets().find(x => x.id === cut.presetId) : null;
    cut.originMode = cut.kind === "still" ? "still"
      : p && Array.isArray(p.modes) && p.modes.length === 1 && p.modes[0] === "outdoor" ? "outdoor"
      : "video";
  }
  const c = cut.camera;
  if (!c.moveSpeed) c.moveSpeed = "normal";
  if (!c.endShotSize) c.endShotSize = "same";
  if (!c.trackShape) c.trackShape = "直線";
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
    kind: state.mode === "still" ? "still" : "video",
    originMode: state.mode,
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
 * カット操作 (追加・複製・削除・並べ替え・分割)
 * スタジオのボタンと台本ページの両方から呼ぶ。描画は呼び出し側の担当。
 * ======================================================= */
function cutInsert(at, preset) {
  const cut = makeCut(preset || null);
  const i = Math.max(0, Math.min(at == null ? state.cuts.length : at, state.cuts.length));
  state.cuts.splice(i, 0, cut);
  state.activeCut = i;
  state.selectedItem = null;
  return i;
}

async function cutDuplicate(at) {
  const src = state.cuts[at];
  if (!src) return -1;
  const clone = JSON.parse(JSON.stringify(src));
  clone.id = uid();
  clone.items.forEach(i => i.id = uid());
  clone.name += " (複製)";
  state.cuts.splice(at + 1, 0, clone);
  state.activeCut = at + 1;
  state.selectedItem = null;
  try {
    const clip = await idbGetClip(src.id); // 添付動画も複製に引き継ぐ
    if (clip) {
      await idbPutClip({ ...clip, cutId: clone.id, addedAt: Date.now() });
      rcRefreshIndex();
      showToast("カットを複製しました (添付動画もコピー)");
    }
  } catch { /* IDBなし環境 */ }
  return at + 1;
}

function cutDelete(at) {
  if (state.cuts.length <= 1) { showToast("⚠️ 最後のカットは削除できません"); return false; }
  if (!state.cuts[at]) return false;
  state.cuts.splice(at, 1);
  state.activeCut = Math.max(0, Math.min(at, state.cuts.length - 1));
  state.selectedItem = null;
  return true;
}

function cutMove(from, to) {
  if (from === to || !state.cuts[from] || to < 0 || to >= state.cuts.length) return false;
  const [mv] = state.cuts.splice(from, 1);
  state.cuts.splice(to, 0, mv);
  state.activeCut = to;
  return true;
}

/* ビートの切れ目でカットを2つに割る。
 * 台本を書いているうちに「1カットに詰め込みすぎた」と気づく場面のための操作で、
 * 前半/後半の尺はそれぞれのビート合計に合わせ直す。
 * 登場要素は両方に残す (ビートの「誰が」がidで結ばれているため)。 */
function cutSplitAtBeat(at, bi) {
  const cut = state.cuts[at];
  if (!cut) return -1;
  const beats = (cut.perf && cut.perf.beats) || [];
  if (bi < 1 || bi >= beats.length) { showToast("⚠️ 分割はビートとビートの間でのみできます"); return -1; }
  const tail = JSON.parse(JSON.stringify(cut));
  tail.id = uid();
  tail.items.forEach(i => i.id = uid());
  tail.perf.beats = beats.slice(bi).map(b => ({ ...b, id: uid() }));
  cut.perf.beats = beats.slice(0, bi);
  const sum = arr => arr.reduce((s, b) => s + (+b.sec || 0), 0);
  if (cut.kind !== "still") {
    cut.duration = Math.max(1, Math.round(sum(cut.perf.beats)) || 1);
    tail.duration = Math.max(1, Math.round(sum(tail.perf.beats)) || 1);
  }
  tail.name = cut.name + " (後半)";
  tail.caption = "";                 // セリフは前半のもの。後半へは複製しない
  tail.transition = cut.transition;  // 次カットへの繋ぎは後半が引き継ぐ
  cut.transition = "cut";            // 割った境目はカット繋ぎ
  state.cuts.splice(at + 1, 0, tail);
  state.activeCut = at + 1;
  state.selectedItem = null;
  return at + 1;
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
/* ---------- アスペクト比 → プレビュー寸法 ---------- */
function aspectDims(aspectId) {
  const a = ASPECTS.find(x => x.id === aspectId) || ASPECTS[0];
  const ratio = a.w / a.h;
  if (ratio >= 1) { const W = 640; return { W, H: Math.round(W / ratio) }; }
  const H = 520; return { W: Math.round(H * ratio), H };
}

/* ---------- 電源プラン自動計算 ---------- */
function powerPlan(cut) {
  const lights = cut.items.filter(i => LIGHT_TYPES.includes(i.type) && i.type !== "sun" && i.power > 0);
  const total = lights.reduce((s, i) => s + (i.watt || 0), 0);
  const circuits = total > 0 ? Math.ceil(total / 1500) : 0; // 100V 15A = 1500W/回路
  const genkVA = total === 0 ? 0
    : (GENERATOR_SIZES.find(g => g * 1000 * 0.8 >= total * 1.25) || GENERATOR_SIZES[GENERATOR_SIZES.length - 1]);
  return { count: lights.length, total, circuits, genkVA };
}

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

function buildPromptParts(cut) {
  ensureCameraDefaults(cut);
  const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || SHOT_SIZES[2];
  const ang = CAM_ANGLES.find(s => s.id === cut.camera.angle) || CAM_ANGLES[0];
  const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || CAM_MOVES[0];
  const subj = SUBJECT_TYPES.find(s => s.id === cut.subjectType) || SUBJECT_TYPES[0];
  const bg = BG_STYLES[cut.bgStyle] || BG_STYLES.dark;
  const an = analyzeLighting(cut);

  const optPhrases = cut.options
    .filter(o => o !== "silhouette") // シルエットはライティング解析側で言語化するため重複を避ける
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

  /* 動き・演技・環境・ルックの言語化 */
  const spd = MOVE_SPEEDS.find(s => s.id === c.moveSpeed);
  const movPhrase = spd && spd.en && c.move !== "fix" ? `${mov.en}, ${spd.en} pace` : mov.en;
  const endSize = c.endShotSize !== "same" ? SHOT_SIZES.find(s => s.id === c.endShotSize) : null;
  const framingPhrase = endSize && endSize.id !== size.id
    ? `framing evolves from ${size.en} to ${endSize.en}` : "";
  const act = SUBJECT_ACTIONS.find(a => a.id === cut.action);
  const weather = WEATHERS.find(w => w.id === cut.weather);
  const tod = TIMES_OF_DAY.find(t => t.id === cut.timeOfDay);
  const envPhrase = [weather && weather.en, tod && tod.en].filter(Boolean).join(", ");
  const look = LOOKS.find(l => l.id === cut.look);
  const aspect = ASPECTS.find(a => a.id === cut.aspect);

  /* プロンプト構成要素 (モデル別方言の共通材料) */
  const idx = state.cuts.indexOf(cut);
  const trans = idx >= 0 && idx < state.cuts.length - 1 && cut.transition && cut.transition !== "cut"
    ? TRANSITIONS.find(t => t.id === cut.transition) : null;
  return {
    sizeEn: size.en, angEn: ang.en, movPhrase, framingPhrase, supPhrase, bodyPhrase,
    subjClause: `${subj.en}${act && act.en ? ", " + act.en : ""}${cut.subjectNote ? ` (${cut.subjectNote})` : ""}${optPhrases.length ? ", " + optPhrases.join(", ") : ""}`,
    lightStr: lightPhrases.join(", "),
    bgEn: bg.en, envPhrase,
    lensStr: `${lensPhrase}, aperture f/${c.apertureF}${c.focusM ? `, focus at ${c.focusM}m` : ""}`,
    dofPhrase, filterStr: filterPhrases.join(", "),
    lookEn: look && look.id !== "natural" ? look.en : "",
    aspectEn: aspect ? aspect.en : "", aspectId: cut.aspect,
    motionStr: cut.kind === "still" ? "still photograph, ultra high resolution" : `${cut.camera.fps}, cinematic motion`,
    isStill: cut.kind === "still",
    audio: cut.audio, transEn: trans ? trans.en : "",
    fps: cut.camera.fps, shutter: cut.camera.shutter,
    focusM: c.focusM, dur: cut.duration || 5,
    optList: optPhrases,
    dnaTokens: cut.dna ? cut.dna.tokens : [],
    dnaAvoid: cut.dna ? cut.dna.avoid : [],
    dnaName: cut.dna ? cut.dna.name : "",
  };
}

/* ---------- 音声モード → 英語 (Veo等の音声対応モデル用) ---------- */
const AUDIO_EN = {
  "同録 (ガンマイク+ブーム)": "natural location sound and dialogue",
  "ラベリア (ピンマイク)": "clear close-mic dialogue",
  "同録+ラベリア (2系統)": "natural ambience with clear dialogue",
  "アンビエンスのみ": "ambient environmental sound only, no dialogue",
  "MOS (現場無音・後付け)": "fitting music and sound design (no location dialogue)",
};

/* ---------- モデル別プロンプト方言フォーマッタ ---------- */
/* =========================================================
 * 人の動き (演技演出) レイヤー
 * カメラ/技術の設計には手を入れず、使われたときだけプロンプトに足す。
 * ======================================================= */

/* このカットで演技演出が「使われている」か (未使用なら出力は従来のまま) */
function perfActive(cut) {
  const p = cut.perf;
  if (!p) return false;
  return p.beats.length > 0 || (p.actors || []).length > 1 || p.contact !== "none"
    || p.camLink !== "none" || p.preserve.length > 0 || p.change.length > 0;
}

function perfBeatTotal(cut) {
  return (cut.perf.beats || []).reduce((s, b) => s + (+b.sec || 0), 0);
}

/* ビートのテンプレを尺に合わせて比率で流し込む */
function perfApplyTemplate(cut, tplId) {
  const tpl = BEAT_TEMPLATES.find(t => t.id === tplId);
  if (!tpl) return;
  const dur = cut.kind === "still" ? 5 : (cut.duration || 5);
  cut.perf.beats = tpl.beats.map(b => ({
    id: uid(),
    sec: Math.max(0.5, Math.round(dur * b.r * 10) / 10),
    do: b.do, gaze: b.gaze, cam: b.cam,
  }));
}

/* 作り方の推奨 — 開発元が「複数被写体が相互作用するシーンの安定性」を
 * 改善余地として挙げている領域を、文章で押し切らせない */
function recommendMethod(cut) {
  const p = cut.perf;
  const risk = (CONTACT_TYPES.find(c => c.id === p.contact) || {}).risk || 0;
  const many = (p.actors || []).length > 1;
  const busy = p.beats.length >= 4 || (p.beats.length >= 2 && p.speed === "fast" && p.care === "loose");
  const why = [];
  let id = "gen";
  if (many && risk >= 2) {
    id = "shoot";
    why.push("複数の要素が絡む — 開発元が安定性の改善余地として挙げている領域");
  } else if (risk >= 1 || many) {
    id = "shoot";
    why.push(many ? "複数の要素が同じ画にいる" : "要素同士が近接する");
  } else if (busy) {
    id = "shoot";
    why.push("ビートが多く動きが速い/雑 — 演技の発明をAIに任せると崩れやすい");
  } else if (cut.refImgId) {
    id = "ref";
    why.push("参照画像があるので顔・構図を保ったまま生成できる");
  } else {
    why.push("単純な動きで参照も不要 — 全部AIに任せられる");
  }
  if (id === "shoot") why.push("AIの仕事を『演技の発明』から『見た目の変更』に置き換えられる");
  return { id, why };
}

/* 実際に採用される作り方 (auto なら推奨) */
function perfMethodOf(cut) {
  return cut.perf.method === "auto" ? recommendMethod(cut).id : cut.perf.method;
}

/* 登場要素の表示名 (台本・プロンプト共通) */
function actorLabel(cut, actorId) {
  const a = (cut.perf.actors || []).find(x => x.id === actorId);
  if (!a) return "";
  const t = ACTOR_TYPES.find(x => x.id === a.type) || ACTOR_TYPES[0];
  return a.name ? `${t.label}${a.name}` : t.label;
}
function actorEn(cut, actorId) {
  const a = (cut.perf.actors || []).find(x => x.id === actorId);
  if (!a) return "";
  const t = ACTOR_TYPES.find(x => x.id === a.type) || ACTOR_TYPES[0];
  return a.name ? `${t.en} (${a.name})` : t.en;
}

/* プロンプトに足す演出ブロック (未使用なら空文字) */
function buildPerfBlock(cut, prose) {
  if (!perfActive(cut)) return "";
  const p = cut.perf;
  const g = (arr, id) => (arr.find(x => x.id === id) || {}).en || "";
  const contact = CONTACT_TYPES.find(c => c.id === p.contact) || CONTACT_TYPES[0];
  const cast = (p.actors || []).map(a => actorEn(cut, a.id)).filter(Boolean);
  const head = [
    cast.length ? `cast: ${cast.join(", ")}` : "",
    contact.en,
    `motion quality: ${g(MOTION_SPEEDS, p.speed)}, ${g(MOTION_CARES, p.care)}, ${g(MOTION_TOWARDS, p.toward)}`,
    g(PERF_TEMPS, p.temp),
    p.camLink !== "none" ? g(CAM_LINKS, p.camLink) : "",
  ].filter(Boolean).join("; ");

  let t = 0;
  const beats = p.beats.map(b => {
    const from = t; t += +b.sec || 0;
    const gz = g(GAZE_TARGETS, b.gaze);
    const cm = b.cam && b.cam !== "none" ? g(CAM_LINKS, b.cam) : "";
    const who = b.who ? actorEn(cut, b.who) : "";
    return `${from.toFixed(1)}–${t.toFixed(1)}s — ${who ? who + ": " : ""}${b.do}${gz ? ` (${gz})` : ""}${cm ? `; ${cm}` : ""}`;
  });
  const pres = p.preserve.map(id => g(PRESERVE_ITEMS, id)).filter(Boolean);
  const chg = p.change.map(id => g(CHANGE_ITEMS, id)).filter(Boolean);

  if (prose) {
    /* 文章系の方言では1段落にまとめる */
    return [
      `Performance: ${head}.`,
      beats.length ? `Beats: ${beats.join(" / ")}.` : "",
      pres.length || chg.length ? `Preserve ${pres.join(", ") || "—"}; change ${chg.join(", ") || "—"}.` : "",
    ].filter(Boolean).join(" ");
  }
  return [
    `PERFORMANCE: ${head}`,
    beats.length ? `BEATS:\n${beats.map(b => `- ${b}`).join("\n")}` : "",
    pres.length || chg.length
      ? `PRESERVE / CHANGE: preserve = ${pres.join(", ") || "—"} / change = ${chg.join(", ") || "—"}` : "",
  ].filter(Boolean).join("\n");
}

/* =========================================================
 * プロンプト診断 — 書いてはいけない5項目 + 設計同士の噛み合わせ
 * ======================================================= */
const LINT_BODY_PARTS = ["腕", "肩", "手", "指", "首", "腰", "脚", "膝", "肘", "背中", "足"];
const LINT_MOTION_NAMES = /ダンス|踊り|踊る|ポーズ|パフォーマンス|ムーブ|っぽい動き|風の動き|dance|choreo/i;
const LINT_REF_OWNED = ["顔", "髪", "服", "衣装", "目元", "肌", "瞳"];

function lintCut(cut) {
  const out = [];
  const p = cut.perf || {};
  const texts = [cut.aim || "", cut.subjectNote || "", ...(p.beats || []).map(b => b.do || "")];
  const all = texts.join(" ");

  /* ① 形容詞の積み上げ — 具体的な動きとレンズの選択のほうがうまくいく */
  const mods = (cut.aim + " " + (cut.subjectNote || ""))
    .split(/[、,。\s]+/)
    .filter(t => t.length >= 2 && t.length <= 10 && /(い|く|な|に|で|的|げ|そう|やか)$/.test(t));
  if (mods.length >= 3) {
    out.push({ lv: "warn", code: "ADJ-PILE",
      t: `形容詞が積み上がっています (${mods.slice(0, 4).join("・")})。雰囲気の描写より、動きとレンズの選択を具体的に書くほうが効きます` });
  }
  /* ② 動きの「名前」— 概念名は解釈の幅がそのまま出力の幅になる */
  if (LINT_MOTION_NAMES.test(all)) {
    out.push({ lv: "warn", code: "MOTION-NAME",
      t: "動きを「名前」で指定しています。速さ・雑さ・誰に向けた動きかで書くか、動きの見本を先に撮って渡すほうが再現されます" });
  }
  /* ③ 身体の各部位の分解 — 分解して長くしても参照1本の情報量には届かない */
  const parts = LINT_BODY_PARTS.filter(w => all.includes(w));
  if (parts.length >= 3) {
    out.push({ lv: "warn", code: "BODY-PARTS",
      t: `身体の部位を分解して書いています (${parts.slice(0, 4).join("・")})。長い分解より、動きの見本1本のほうが正確です` });
  }
  /* ④ 参照素材がすでに持っている情報の重複 */
  if (cut.refImgId) {
    const dup = LINT_REF_OWNED.filter(w => (cut.subjectNote || "").includes(w));
    if (dup.length) {
      out.push({ lv: "warn", code: "REF-DUP",
        t: `参照画像が持つ情報 (${dup.join("・")}) を文章でも書いています。参照と文章が別々のことを言い出して破綻する原因になります` });
    }
  }
  /* ⑤ 互いに矛盾する指示 — 守れない指示が混ざるとAIが取捨を自分で決める */
  if (p.camLink && p.camLink !== "none" && cut.camera.move === "fix") {
    out.push({ lv: "danger", code: "CONFLICT-CAM",
      t: "カメラワークが「フィックス」なのに、演技側で「カメラが体に連動」を指定しています。どちらかに揃えてください" });
  }
  if ((p.contact || "none") !== "none" && (p.actors || []).length <= 1) {
    out.push({ lv: "warn", code: "CONFLICT-CONTACT",
      t: "要素同士の絡みを指定していますが、登場要素が1つしかありません" });
  }
  if (p.preserve && p.change) {
    const clash = [];
    if (p.preserve.includes("performance") && p.change.includes("person") && perfMethodOf(cut) === "gen") {
      clash.push("演技を残しつつ人物を変える (見本なしでは両立しない)");
    }
    if (clash.length) out.push({ lv: "info", code: "CONFLICT-PC", t: `${clash.join(" / ")} — 「先に撮ってから変える」向きの設計です` });
  }
  /* 尺との噛み合わせ */
  if (p.beats && p.beats.length && cut.kind !== "still") {
    const total = perfBeatTotal(cut);
    const dur = cut.duration || 5;
    if (Math.abs(total - dur) > 0.5) {
      out.push({ lv: "warn", code: "BEAT-DUR",
        t: `ビート合計 ${total.toFixed(1)}秒 に対してカットの尺は ${dur}秒 です (${total > dur ? "尺を超えています" : "尺が余ります"})` });
    }
  }
  /* 立ち位置が読めない寄り */
  const risk = (CONTACT_TYPES.find(c => c.id === p.contact) || {}).risk || 0;
  if (risk >= 2 && ["CU", "BCU", "ECU"].includes(cut.camera.shotSize)) {
    out.push({ lv: "info", code: "CONTACT-SIZE",
      t: "絡みのあるカットを寄りで撮ると、どの要素がどこにいるかが読めなくなります。引きのカバレッジを1カット足すのが安全です" });
  }
  /* ロケ地とスタジオ設定の食い違い */
  if (typeof locActive === "function" && locActive(cut)) {
    const lp = locPreset(cut);
    if (lp && lp.region === "studio") {
      if (cut.items.some(i => i.type === "sun")) {
        out.push({ lv: "warn", code: "LOC-INDOOR-SUN",
          t: `ロケ地が屋内 (${lp.label}) ですが、スタジオに太陽 (自然光) が置かれています` });
      }
      if (cut.weather && cut.weather !== "none") {
        out.push({ lv: "info", code: "LOC-INDOOR-WX",
          t: "屋内ロケ地に天候が指定されています。窓外の見え方として意図したものか確認してください" });
      }
    }
    const sn = typeof locSunNow === "function" ? locSunNow(cut) : null;
    if (sn) {
      const dayTod = ["morning", "noon", "afternoon", "golden"].includes(cut.timeOfDay);
      const nightTod = ["night", "midnight", "blue"].includes(cut.timeOfDay);
      if (sn.elevation <= -6 && dayTod) {
        out.push({ lv: "warn", code: "LOC-SUN-TOD",
          t: `指定日時の太陽高度は ${sn.elevation.toFixed(1)}° (夜) ですが、時間帯設定は昼系です` });
      } else if (sn.elevation > 10 && nightTod) {
        out.push({ lv: "warn", code: "LOC-SUN-TOD",
          t: `指定日時の太陽高度は ${sn.elevation.toFixed(1)}° (昼) ですが、時間帯設定は夜系です` });
      }
    }
  }

  /* 「先に撮る」でも解決しないケース */
  if (perfMethodOf(cut) === "shoot" && p.unfit && p.unfit.length) {
    const names = p.unfit.map(id => (UNFIT_CASES.find(u => u.id === id) || {}).label).filter(Boolean);
    out.push({ lv: "danger", code: "UNFIT",
      t: `先に撮っても解決しないケースに該当しています (${names.join(" / ")})。設計そのものを見直してください` });
  }
  return out;
}

function generatePrompt(cut, modelId) {
  const P = buildPromptParts(cut);
  const model = modelId || state.promptModel || "seedance";
  const j = (arr, sep) => arr.filter(Boolean).join(sep);
  /* 人の動き (演技演出) は使われたときだけ足す。未使用なら従来の出力のまま */
  const proseModel = ["veo", "sora", "runway", "mj"].includes(model);
  const perf = buildPerfBlock(cut, proseModel);
  const loc = buildLocationBlock(cut, proseModel);
  const extra = [loc, perf].filter(Boolean).join(proseModel ? " " : "\n");
  const withPerf = (text, sep) => extra ? text + sep + extra : text;

  switch (model) {
    case "veo": { // 自然な英文パラグラフ + 音声指示
      const s = [];
      s.push(`A ${P.sizeEn} of ${P.subjClause}, seen from ${P.angEn}.`);
      s.push(`The camera: ${P.movPhrase}${P.framingPhrase ? "; " + P.framingPhrase : ""}${P.supPhrase ? "; " + P.supPhrase : ""}.`);
      if (P.bodyPhrase) s.push(`Captured with ${P.bodyPhrase}.`);
      s.push(`Lighting: ${P.lightStr}.`);
      s.push(`Setting: ${j([P.bgEn, P.envPhrase], ", ")}.`);
      s.push(`Shot on a ${P.lensStr}${P.dofPhrase ? ", " + P.dofPhrase : ""}${P.filterStr ? ", " + P.filterStr : ""}.`);
      if (P.lookEn) s.push(`Color grade: ${P.lookEn}.`);
      if (!P.isStill) s.push(`Audio: ${AUDIO_EN[P.audio] || "fitting ambient sound"}.`);
      if (P.transEn) s.push(`The shot ends with a ${P.transEn}.`);
      s.push(`${P.aspectEn}. Photorealistic, professional cinematography.`);
      return withPerf(s.join(" "), " ");
    }
    case "kling": { // 項目ラベル形式
      return withPerf(j([
        `Subject: ${P.subjClause}`,
        `Camera: ${j([P.sizeEn, P.angEn, P.movPhrase, P.framingPhrase, P.supPhrase], ", ")}`,
        `Lens: ${j([P.lensStr, P.dofPhrase, P.filterStr], ", ")}`,
        `Lighting: ${P.lightStr}`,
        `Environment: ${j([P.bgEn, P.envPhrase], ", ")}`,
        `Style: ${j([P.lookEn, P.aspectEn, P.motionStr, "photorealistic, high detail"], ", ")}`,
        P.transEn ? `Transition out: ${P.transEn}` : "",
      ], "\n"), "\n");
    }
    case "runway": { // [camera]: [scene] 簡潔形式
      const cam = j([P.movPhrase, P.sizeEn, P.angEn], ", ");
      const scene = j([P.subjClause, P.bgEn, P.envPhrase], ", ");
      const detail = j([P.lightStr, P.lensStr, P.dofPhrase, P.lookEn, P.filterStr], ". ");
      return withPerf(`[${cam}]: [${scene}]. ${detail}. Cinematic, photorealistic.`, " ");
    }
    case "sora": { // 情景描写の長文
      const s = [];
      s.push(`${P.subjClause[0].toUpperCase() + P.subjClause.slice(1)} in ${j([P.bgEn, P.envPhrase], ", ")}.`);
      s.push(`${P.lightStr[0].toUpperCase() + P.lightStr.slice(1)}.`);
      s.push(`The scene is framed as a ${P.sizeEn} from ${P.angEn}, ${P.movPhrase}${P.framingPhrase ? ", " + P.framingPhrase : ""}.`);
      s.push(`${P.lensStr}${P.dofPhrase ? ", " + P.dofPhrase : ""}.`);
      if (P.lookEn || P.filterStr) s.push(`${j([P.lookEn, P.filterStr], ", ")}.`);
      s.push(`${P.aspectEn}, ${P.motionStr}, photorealistic, rich in detail and atmosphere.`);
      return withPerf(s.join(" "), " ");
    }
    case "mj": { // Midjourney: タグ列 + パラメータ
      const arMap = { "16:9": "16:9", "9:16": "9:16", "2.39:1": "21:9", "4:3": "4:3", "1:1": "1:1", "3:2": "3:2", "4:5": "4:5" };
      const tags = j([
        P.subjClause, P.sizeEn, P.angEn, P.lightStr,
        P.bgEn, P.envPhrase, P.lensStr, P.dofPhrase, P.filterStr, P.lookEn,
        "professional photography, photorealistic, high detail",
      ], ", ");
      return `${withPerf(tags, ", ")} --ar ${arMap[P.aspectId] || "16:9"} --style raw`;
    }
    case "seedance": {
      // CineOS プロンプトコンパイル順序 (cineos/CLAUDE.md §10) に準拠した構造化ブロック
      return j([
        `FORMAT: ${P.aspectEn}${P.isStill ? ", still photograph, ultra high resolution" : `, video, ${P.dur}s`}`,
        `SUBJECT & ACTION: ${P.subjClause}`,
        `ENVIRONMENT: ${j([P.bgEn, P.envPhrase], ", ")}`,
        P.bodyPhrase ? `CAMERA FORMAT: ${P.bodyPhrase}` : "",
        `LENS: ${P.lensStr}`,
        `CAMERA: ${j([P.sizeEn, P.angEn], ", ")}`,
        `CAMERA MOVE: ${j([P.movPhrase, P.framingPhrase, P.supPhrase], "; ")}${P.isStill ? "" : ` — over ${P.dur} seconds`}`,
        `FOCUS: focus at ${P.focusM}m${P.dofPhrase ? ", " + P.dofPhrase : ""}${P.filterStr ? ", " + P.filterStr : ""}`,
        P.isStill ? `EXPOSURE: shutter ${P.shutter}` : `FRAME RATE / SHUTTER: ${P.fps}, shutter ${P.shutter}`,
        `LIGHTING: ${P.lightStr}`,
        P.optList.length ? `PRACTICAL FX: ${P.optList.join(", ")}` : "",
        `COLOR / FINISH: ${j([P.lookEn || "natural true-to-life color grade", "photorealistic, professional cinematography, high detail"], ", ")}`,
        P.transEn ? `EDIT: shot ends with a ${P.transEn}` : "",
        P.dnaTokens.length ? `STYLE DNA: ${P.dnaTokens.join(", ")}` : "",
        loc,
        perf,
        `NEGATIVE: no subtitles, no watermark, no on-screen text, no morphing artifacts${P.dnaAvoid.length ? ", " + P.dnaAvoid.join(", ") : ""}`,
      ], "\n");
    }
    default: { // generic: 標準フォーマット
      return j([
        `${P.sizeEn}, ${P.angEn}`,
        P.movPhrase, P.framingPhrase, P.supPhrase, P.bodyPhrase,
        `subject: ${P.subjClause}`,
        P.lightStr, P.bgEn, P.envPhrase,
        P.lensStr, P.dofPhrase, P.filterStr, P.lookEn, P.aspectEn,
        P.transEn ? `shot ends with a ${P.transEn}` : "",
        P.dnaTokens.join(", "),
        P.motionStr,
        "photorealistic, professional cinematography, high detail",
      ], ". ") + "." + (extra ? "\n" + extra : "");
    }
  }
}

/* =========================================================
 * Seedance 向け: 推奨パラメータ / マルチショット・シーケンス
 * ======================================================= */
function seedanceRatio(aspectId) {
  // Seedance が受け付ける ratio への対応 (近いものへマップ)
  const map = { "16:9": "16:9", "9:16": "9:16", "2.39:1": "21:9", "4:3": "4:3", "1:1": "1:1", "3:2": "4:3 (3:2近似)", "4:5": "3:4 (4:5近似)" };
  return map[aspectId] || "16:9";
}

function seedanceParams(cut) {
  return {
    ratio: seedanceRatio(cut.aspect),
    duration: cut.kind === "still" ? "— (静止画: 画像モデル推奨)" : `${cut.duration || 5}s`,
    resolution: "1080p",
    camerafixed: cut.camera.move === "fix" ? "true (フィックスを厳守させる)" : "false",
    firstFrame: "本カットの「想定カットイメージ」を参照画像 (first frame) に使うと構図が安定",
  };
}

/* 全カットを1プロンプトに繋いだマルチショット・シーケンス */
function buildSeedanceSequence() {
  const cuts = state.cuts.filter(c => c.kind !== "still");
  if (!cuts.length) return "";
  const shots = cuts.map((cut, i) => {
    const P = buildPromptParts(cut);
    let s = `[Shot ${i + 1} — ${cut.duration || 5}s] ${P.sizeEn}, ${P.angEn}. ${P.movPhrase}. ${P.subjClause}. ${P.lightStr}. ${P.bgEn}${P.envPhrase ? ", " + P.envPhrase : ""}.`;
    if (i < cuts.length - 1) {
      const t = TRANSITIONS.find(x => x.id === (cut.transition || "cut"));
      s += ` [${t ? t.en : "hard cut"} to next shot]`;
    }
    return s;
  });
  return "Multi-shot cinematic sequence. Keep the same subject, wardrobe, lighting style and color grade consistent across all shots. "
    + shots.join(" ")
    + " Photorealistic, professional cinematography, no subtitles, no watermark, no on-screen text.";
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
  if (cut.camera.endShotSize && cut.camera.endShotSize !== "same" && cut.camera.endShotSize !== cut.camera.shotSize) {
    const endS = SHOT_SIZES.find(s => s.id === cut.camera.endShotSize);
    lines.push(`↔️ カットの中でサイズが変わります: ${size.label} から ${endS ? endS.label : cut.camera.endShotSize} へ${SHOT_SIZES.indexOf(endS) < SHOT_SIZES.indexOf(size) ? "引いていき、状況を見せます" : "寄っていき、感情や細部に迫ります"}。`);
  }
  const lookDef = LOOKS.find(l => l.id === cut.look);
  if (lookDef && lookDef.id !== "natural") {
    lines.push(`🎞 仕上げの色は「${lookDef.label}」。${lookDef.id === "mono" ? "白黒になり、光と影だけで見せます。" : lookDef.id === "tealorange" ? "肌はオレンジ・背景は青緑に分かれる映画の定番カラーです。" : lookDef.id === "bleach" ? "色が薄く硬い、戦場映画のような質感です。" : ""}`);
  }
  const actDef = SUBJECT_ACTIONS.find(a => a.id === cut.action);
  if (actDef && !["stand", "place"].includes(actDef.id)) {
    lines.push(`🏃 被写体の動き: ${actDef.label}。`);
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
      body = `<circle class="equip-body" r="26" fill="var(--cv-body, #ffffff)" stroke="${t.color}" stroke-width="1.5"/>
              <circle r="9" fill="${t.color}"/>`;
      break;
    case "camera": {
      // サポート機材 (支持機材) の可視化
      const supId = cut && cut.camera ? cut.camera.support : "tripod";
      const supParam = cut && cut.camera ? cut.camera.supportParam : 0;
      let rig = "";
      if (supId === "slider" || supId === "dolly") {
        const L = supId === "slider" ? Math.max(40, supParam) * 0.8 : Math.max(2, supParam) * 18;
        const shape = (cut && cut.camera && cut.camera.trackShape) || "直線";
        if (shape.startsWith("カーブ")) {
          rig = `<path d="M-16,${-L / 2} Q-52,0 -16,${L / 2}" fill="none" stroke="var(--cv-rail, #8a90a0)" stroke-width="3"/>
                 <path d="M-24,${-L / 2} Q-62,0 -24,${L / 2}" fill="none" stroke="var(--cv-rail, #8a90a0)" stroke-width="3"/>`;
        } else if (shape.startsWith("円弧")) {
          const R = Math.max(60, Math.hypot(sub.x - it.x, sub.y - it.y));
          const a = 28 * Math.PI / 180;
          const x1 = R - R * Math.cos(a), y1 = -R * Math.sin(a);
          const x2 = R - R * Math.cos(a), y2 = R * Math.sin(a);
          rig = `<path d="M${x1 - 16},${y1} A${R},${R} 0 0 0 ${x2 - 16},${y2}" fill="none" stroke="var(--cv-rail, #8a90a0)" stroke-width="3"/>
                 <path d="M${x1 - 24},${y1} A${R + 8},${R + 8} 0 0 0 ${x2 - 24},${y2}" fill="none" stroke="var(--cv-rail, #8a90a0)" stroke-width="3"/>`;
        } else {
          rig = `<line x1="-16" y1="${-L / 2}" x2="-16" y2="${L / 2}" stroke="var(--cv-rail, #8a90a0)" stroke-width="3"/>
                 <line x1="-24" y1="${-L / 2}" x2="-24" y2="${L / 2}" stroke="var(--cv-rail, #8a90a0)" stroke-width="3"/>
                 ${Array.from({ length: Math.max(2, Math.round(L / 26)) }, (_, k) =>
                   `<line x1="-28" y1="${-L / 2 + k * 26}" x2="-12" y2="${-L / 2 + k * 26}" stroke="var(--cv-rail2, #b8bdc9)" stroke-width="2"/>`).join("")}`;
        }
      } else if (supId === "crane" || supId === "technocrane") {
        const armPx = Math.max(2, supParam) * 14;
        rig = `<line x1="${-armPx}" y1="0" x2="-10" y2="0" stroke="#d98a4e" stroke-width="4"/>
               <circle cx="${-armPx}" cy="0" r="10" fill="#ffffff" stroke="#d98a4e" stroke-width="2.5"/>
               <line x1="${-armPx - 8}" y1="10" x2="${-armPx + 8}" y2="10" stroke="#d98a4e" stroke-width="3"/>`;
      } else if (supId === "cablecam") {
        rig = `<line x1="-30" y1="-160" x2="-30" y2="160" stroke="var(--cv-rail, #8a90a0)" stroke-width="2" stroke-dasharray="8 6"/>`;
      } else if (supId === "tripod" || supId === "highhat") {
        rig = `${[150, 270, 30].map(a =>
          `<line x1="0" y1="0" x2="${18 * Math.cos(a * Math.PI / 180)}" y2="${18 * Math.sin(a * Math.PI / 180)}" stroke="var(--cv-rail, #8a90a0)" stroke-width="2.5"/>`).join("")}`;
      } else if (supId === "ladder" || supId === "intore") {
        rig = `<rect x="-30" y="-14" width="14" height="28" fill="none" stroke="var(--cv-rail, #8a90a0)" stroke-width="2"/>
               <line x1="-30" y1="-5" x2="-16" y2="-5" stroke="var(--cv-rail, #8a90a0)" stroke-width="2"/>
               <line x1="-30" y1="4" x2="-16" y2="4" stroke="var(--cv-rail, #8a90a0)" stroke-width="2"/>`;
      }
      body = `<g transform="rotate(${aim})">
                ${rig}
                <path d="M-40,0 L-8,-16 L-8,16 Z" fill="rgba(47,127,224,.15)"/>
                <rect class="equip-body" x="-8" y="-13" width="30" height="26" rx="4" fill="var(--cv-body, #ffffff)" stroke="${t.color}" stroke-width="1.5"/>
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
                <rect class="equip-body" x="-14" y="-12" width="26" height="24" rx="5" fill="var(--cv-body, #ffffff)" stroke="${t.color}" stroke-width="1.5"/>
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
                <rect class="equip-body" x="-34" y="-16" width="68" height="32" rx="5" fill="var(--cv-body, #ffffff)" stroke="${t.color}" stroke-width="2"/>
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
                <circle class="equip-body" r="15" fill="var(--cv-body, #ffffff)" stroke="${t.color}" stroke-width="1.5"/>
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
  for (let x = 0; x <= 1000; x += 50) grid += `<line x1="${x}" y1="0" x2="${x}" y2="700" stroke="${x % 100 ? "var(--cv-grid-minor, #eceef3)" : "var(--cv-grid-major, #dfe2e9)"}" stroke-width="1"/>`;
  for (let y = 0; y <= 700; y += 50) grid += `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="${y % 100 ? "var(--cv-grid-minor, #eceef3)" : "var(--cv-grid-major, #dfe2e9)"}" stroke-width="1"/>`;

  const items = cut.items.map(it => equipGlyph(it, sub, cut)).join("");
  return `${grid}
    <text x="14" y="24" fill="var(--cv-text, #8a90a0)" font-size="12">グリッド 1マス = 50cm (100px = 1m) / 背景: ${esc((BG_STYLES[cut.bgStyle] || {}).en || "")}</text>
    <line x1="0" y1="90" x2="1000" y2="90" stroke="var(--cv-horizon, #c3c9d6)" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="986" y="82" fill="var(--cv-text, #8a90a0)" font-size="11" text-anchor="end">背景 / ホリゾント</text>
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
  const { W, H } = aspectDims(cut.aspect);
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

  /* ルック / グレーディング */
  const look = LOOKS.find(l => l.id === (cut.look || "natural")) || LOOKS[0];
  let lookFilter = "";
  if (look.sat != null) {
    defs += `<filter id="${p}lk"><feColorMatrix type="saturate" values="${look.sat}"/></filter>`;
    lookFilter = `filter="url(#${p}lk)"`;
  }
  let lookTint = "";
  if (look.tintA) lookTint += `<rect width="${W}" height="${H}" fill="${look.tintA}" opacity="0.10"/>`;
  if (look.tintB) lookTint += `<rect width="${W}" height="${H}" fill="${look.tintB}" opacity="0.12"/>`;

  /* ---- 参照画像モード ----
   * ワークフローで取り込んだ実画像をベースに、ライティング解析の結果
   * (露出/コントラスト/キー方向/リム/色温度/シルエット) を
   * ブレンドレイヤーで簡易合成する — 技法を切り替えると画像上で効果が変わる */
  const refImg = cut.refImgId && state.story && state.story.refs
    ? state.story.refs.find(r => r.id === cut.refImgId) : null;
  let refScene = "";
  if (refImg) {
    const isSubject = !!refImg.hasAlpha; // 背景透過 = 被写体レイヤーとして合成
    const B = silhouette ? (isSubject ? 0.18 : 0.45) : Math.max(0.55, Math.min(1.15, 0.55 + keyF * 0.5));
    const C = silhouette ? 1.35 : 1 + an.contrast * 0.6;
    const slope = +(B * C).toFixed(3);
    const inter = +(B * (1 - C) * 0.5).toFixed(3);
    const gx1 = keySide > 0 ? 0 : 1, gx2 = keySide > 0 ? 1 : 0;
    /* 被写体レイヤーは露出補正の後にリム光 (feDropShadow) を背後に描く */
    const rimGlow = isSubject && an.rimPower > 0
      ? `<feDropShadow dx="0" dy="-1.5" stdDeviation="${silhouette ? 6 : 4.5}" flood-color="${rimColor}" flood-opacity="${Math.min(0.95, (silhouette ? 0.55 : 0.3) + an.rimPower / 90).toFixed(2)}"/>`
      : "";
    defs += `
      <filter id="${p}imf" x="-25%" y="-25%" width="150%" height="150%"><feComponentTransfer>
        <feFuncR type="linear" slope="${slope}" intercept="${inter}"/>
        <feFuncG type="linear" slope="${slope}" intercept="${inter}"/>
        <feFuncB type="linear" slope="${slope}" intercept="${inter}"/>
      </feComponentTransfer>${rimGlow}</filter>
      <linearGradient id="${p}imkey" x1="${gx1}" y1="0" x2="${gx2}" y2="0">
        <stop offset="0" stop-color="${rimColor}" stop-opacity="${silhouette ? 0 : (0.10 + keyF * 0.16).toFixed(2)}"/>
        <stop offset="0.6" stop-color="${rimColor}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${p}imshad" x1="${gx1}" y1="0" x2="${gx2}" y2="0">
        <stop offset="0.45" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="${(an.contrast * 0.55).toFixed(2)}"/>
      </linearGradient>
      <linearGradient id="${p}imtop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="${an.topPower > 0 && !silhouette ? 0.22 : 0}"/>
        <stop offset="0.4" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${p}imrim" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0.55" stop-color="${rimColor}" stop-opacity="0"/>
        <stop offset="1" stop-color="${rimColor}" stop-opacity="${Math.min(0.5, an.rimPower / 160).toFixed(2)}"/>
      </linearGradient>
      <radialGradient id="${p}imglow" cx="0.5" cy="0.38" r="0.62">
        <stop offset="0" stop-color="#fff6dd" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#fff6dd" stop-opacity="0"/>
      </radialGradient>`;
    const tempTint = an.avgTemp >= 7000 ? `<rect width="${W}" height="${H}" fill="#3d78ff" opacity="0.10"/>`
      : an.avgTemp <= 3800 ? `<rect width="${W}" height="${H}" fill="#ff9a3d" opacity="0.10"/>` : "";

    /* フレーミング: カットサイズ→ズーム、アングル→視点シフト/傾き、位置調整→アンカー */
    const zoom = Math.max(1, Math.min(2.6, 0.9 + ((size.scale || 1) - 0.45) * 0.55));
    const dutch = angId === "dutch" ? -7 : 0;
    const ax = W / 2 + (W * (cut.refOffX || 0)) / 100;
    const ay = H * 0.42 + (H * (cut.refOffY || 0)) / 100
      + (angId === "high" || angId === "topdown" || angId === "drone" ? -H * 0.05 : angId === "low" ? H * 0.05 : 0);
    const frameTf = `translate(${(W / 2).toFixed(1)} ${(H * 0.45).toFixed(1)}) rotate(${dutch}) scale(${zoom.toFixed(3)}) translate(${(-ax).toFixed(1)} ${(-ay).toFixed(1)})`;
    const imgTag = `<image href="${refUrl(refImg)}" x="${-W * 0.06}" y="${-H * 0.06}" width="${W * 1.12}" height="${H * 1.12}" preserveAspectRatio="xMidYMid slice" filter="url(#${p}imf)"/>`;

    /* 被写界深度: 開放絞りでは周辺をボカす (radialマスク) */
    const dof = (cut.camera.apertureF || 2.8) <= 2.2;
    if (dof) {
      const blurStd = Math.min(6, Math.max(2, (2.2 - cut.camera.apertureF) * 3 + 2));
      defs += `
        <filter id="${p}imblf" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${blurStd.toFixed(1)}"/></filter>
        <radialGradient id="${p}dofg" cx="0.5" cy="0.45" r="0.72">
          <stop offset="0.42" stop-color="#000"/>
          <stop offset="1" stop-color="#fff"/>
        </radialGradient>
        <mask id="${p}dofm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <rect width="${W}" height="${H}" fill="url(#${p}dofg)"/>
        </mask>`;
    }

    /* ビネット (コントラスト/ローキーに連動) とフィルムグレイン (ルック連動) */
    const vigOp = Math.min(0.5, an.contrast * 0.3 + (silhouette ? 0.18 : 0));
    if (vigOp > 0.12) {
      defs += `<radialGradient id="${p}imvig" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="${vigOp.toFixed(2)}"/>
      </radialGradient>`;
    }
    const grainy = ["filmwarm", "bleach", "mono"].includes(cut.look);
    if (grainy) {
      defs += `<filter id="${p}imgr"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>`;
    }

    const gelRects = cut.options.includes("gel") ? `
      <rect x="0" y="0" width="${W / 2}" height="${H}" fill="#e040c8" opacity="0.18" style="mix-blend-mode:screen"/>
      <rect x="${W / 2}" y="0" width="${W / 2}" height="${H}" fill="#2a6ae8" opacity="0.18" style="mix-blend-mode:screen"/>` : "";
    const finishing = `${tempTint}${gelRects}
      ${vigOp > 0.12 ? `<rect width="${W}" height="${H}" fill="url(#${p}imvig)"/>` : ""}
      ${grainy ? `<rect width="${W}" height="${H}" filter="url(#${p}imgr)" opacity="0.07" style="mix-blend-mode:overlay"/>` : ""}
      ${fx}`;

    if (isSubject) {
      /* 被写体合成モード: スタジオ背景 (既存のシーン描画) + 透過被写体。
       * ライティングの明暗は被写体のアルファ形状にだけ乗せる */
      defs += `<mask id="${p}sm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" style="mask-type:alpha">
        <g transform="${frameTf}"><image href="${refUrl(refImg)}" x="${-W * 0.06}" y="${-H * 0.06}" width="${W * 1.12}" height="${H * 1.12}" preserveAspectRatio="xMidYMid slice"/></g>
      </mask>`;
      /* 接地影: 被写体の足元に楕円影 (キーの逆側へ寄せ、ズームに追従) */
      defs += `<filter id="${p}gsb" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${(5 * Math.sqrt(zoom)).toFixed(1)}"/></filter>`;
      const gsX = W / 2 - keySide * W * 0.035 * zoom;
      const gsY = Math.min(H * 0.96, H * 0.45 + (H * 0.5) * zoom * 0.92);
      const groundShadow = `<ellipse cx="${gsX.toFixed(1)}" cy="${gsY.toFixed(1)}" rx="${(W * 0.2 * zoom).toFixed(1)}" ry="${(H * 0.035 * Math.sqrt(zoom)).toFixed(1)}"
        fill="#000" opacity="${Math.min(0.5, 0.22 + an.contrast * 0.2).toFixed(2)}" filter="url(#${p}gsb)"/>`;
      refScene = `
        <rect x="${-W * 0.15}" y="${-H * 0.15}" width="${W * 1.3}" height="${H * 1.3}" fill="url(#${p}bg)"/>
        ${bgExtra}
        <rect width="${W}" height="${H}" fill="url(#${p}imshad)" opacity="0.5" style="mix-blend-mode:multiply"/>
        ${groundShadow}
        <g transform="${frameTf}">${imgTag}</g>
        <rect width="${W}" height="${H}" fill="url(#${p}imshad)" mask="url(#${p}sm)" style="mix-blend-mode:multiply"/>
        <rect width="${W}" height="${H}" fill="url(#${p}imkey)" mask="url(#${p}sm)" style="mix-blend-mode:screen"/>
        <rect width="${W}" height="${H}" fill="url(#${p}imtop)" mask="url(#${p}sm)" style="mix-blend-mode:screen"/>
        ${finishing}`;
    } else {
      refScene = `
        <rect x="${-W * 0.15}" y="${-H * 0.15}" width="${W * 1.3}" height="${H * 1.3}" fill="url(#${p}bg)"/>
        <g transform="${frameTf}">${imgTag}</g>
        ${dof ? `<g transform="${frameTf}" filter="url(#${p}imblf)" mask="url(#${p}dofm)">${imgTag}</g>` : ""}
        ${silhouette ? `<rect width="${W}" height="${H}" fill="url(#${p}imglow)" style="mix-blend-mode:screen"/>
                        <rect width="${W}" height="${H}" fill="#0a0c12" opacity="0.5" style="mix-blend-mode:multiply"/>` : ""}
        <rect width="${W}" height="${H}" fill="url(#${p}imshad)" style="mix-blend-mode:multiply"/>
        <rect width="${W}" height="${H}" fill="url(#${p}imkey)" style="mix-blend-mode:screen"/>
        <rect width="${W}" height="${H}" fill="url(#${p}imtop)" style="mix-blend-mode:screen"/>
        ${an.rimPower > 0 ? `<rect width="${W}" height="${H}" fill="url(#${p}imrim)" style="mix-blend-mode:screen"/>` : ""}
        ${finishing}`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>
    <g id="${p}anim"><g ${lookFilter}>
      ${refImg ? refScene : `
      <rect x="${-W * 0.15}" y="${-H * 0.15}" width="${W * 1.3}" height="${H * 1.3}" fill="url(#${p}bg)"/>
      ${bgExtra}${subjectSvg}${fx}`}
    </g></g>
    ${cut.caption ? `
    <rect x="${W * 0.08}" y="${H - 60}" width="${W * 0.84}" height="26" rx="5" fill="#000" opacity="0.45"/>
    <text x="${W / 2}" y="${H - 42}" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="600" font-family="'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif">${esc(cut.caption.slice(0, 48))}</text>` : ""}
    ${lookTint}${overlay}
    ${refImg ? `<text x="${W - 8}" y="14" text-anchor="end" fill="#ffd98a" font-size="10" font-family="monospace" opacity="0.85">REF: ${esc(refImg.name.slice(0, 18))}</text>` : ""}
  </svg>`;
}

/* =========================================================
 * UI レンダリング
 * ======================================================= */
/* 技法の使用統計とお気に入り (ブラウザに永続) */
const LS_PRESETSTATS = "vsPresetStats";
function presetStats() { return lsGet(LS_PRESETSTATS, {}); }
function bumpPresetUse(id) {
  const st = presetStats();
  st[id] = st[id] || { used: 0, fav: false };
  st[id].used++;
  lsSet(LS_PRESETSTATS, st);
}
function togglePresetFav(id) {
  const st = presetStats();
  st[id] = st[id] || { used: 0, fav: false };
  st[id].fav = !st[id].fav;
  lsSet(LS_PRESETSTATS, st);
}

let presetListMemo = "";
function renderPresetList() {
  const q = byId("presetSearch").value.trim().toLowerCase();
  const wrap = byId("presetList");
  const scroller = byId("libraryPanel");
  const keepScroll = scroller.scrollTop; // 再描画でスクロール位置を失わない
  const cut = activeCut();
  const stats = presetStats();
  /* 検索語・モード・選択中プリセット・統計が同じなら再構築しない */
  const memoKey = `${q}|${state.mode}|${cut ? cut.presetId : ""}|${JSON.stringify(stats)}|${allPresets().length}`;
  if (memoKey === presetListMemo) return;
  presetListMemo = memoKey;
  const groups = {};
  const visible = [];
  for (const p of allPresets()) {
    if (!p.modes.includes(state.mode)) continue;
    const text = (p.name + p.desc + p.tags.join(" ")).toLowerCase();
    if (q && !text.includes(q)) continue;
    (groups[p.group] = groups[p.group] || []).push(p);
    visible.push(p);
  }

  const cardHtml = p => {
    const st = stats[p.id] || {};
    return `
      <div class="preset-card ${cut && cut.presetId === p.id ? "active" : ""}" data-preset="${p.id}">
        <button class="p-fav ${st.fav ? "on" : ""}" data-fav="${p.id}" title="${st.fav ? "お気に入りを解除" : "お気に入りに追加 (一覧の先頭に固定)"}">${st.fav ? "★" : "☆"}</button>
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-desc">${esc(p.desc)}</div>
        <div class="p-tags">${p.tags.map(t => `<span class="p-tag">${esc(t)}</span>`).join("")}${st.used ? `<span class="p-tag p-used">${st.used}回使用</span>` : ""}</div>
      </div>`;
  };

  /* ★ よく使う: お気に入り + 使用2回以上 (使用回数順・最大8件) を先頭に固定 */
  const pinned = visible.filter(p => stats[p.id]?.fav)
    .concat(visible
      .filter(p => !stats[p.id]?.fav && (stats[p.id]?.used || 0) >= 2)
      .sort((a, b) => stats[b.id].used - stats[a.id].used))
    .slice(0, 8);

  wrap.innerHTML = (pinned.length ? `
    <div class="preset-group-title pinned">★ よく使う・お気に入り</div>
    ${pinned.map(cardHtml).join("")}` : "")
    + Object.entries(groups).map(([g, ps]) => `
    <div class="preset-group-title">${esc(g)}</div>
    ${ps.map(cardHtml).join("")}
  `).join("") || `<div class="insp-hint" style="margin-top:12px">該当する技法がありません</div>`;

  wrap.querySelectorAll(".p-fav").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    togglePresetFav(b.dataset.fav);
    renderPresetList();
  }));
  wrap.querySelectorAll(".preset-card").forEach(el => {
    el.addEventListener("click", () => applyPreset(el.dataset.preset));
  });
  scroller.scrollTop = keepScroll;
}

function applyPreset(presetId) {
  const preset = allPresets().find(p => p.id === presetId);
  if (!preset) return;
  bumpPresetUse(presetId); // 使用統計 (「よく使う」への昇格に使う)
  const cut = activeCut();
  const idx = state.activeCut;
  const fresh = makeCut(preset);
  fresh.id = cut.id; // プレビューseedを安定させたい場合は維持しない方が自然だが、参照維持のためIDは引き継ぐ
  // カットの物語上の設定 (繋ぎ・段取り・参照画像・進行状態) はプリセットを変えても維持する
  fresh.transition = cut.transition;
  fresh.takes = cut.takes;
  fresh.setupMin = cut.setupMin;
  fresh.refImgId = cut.refImgId;
  fresh.refOffX = cut.refOffX;
  fresh.refOffY = cut.refOffY;
  fresh.wfStatus = cut.wfStatus;
  fresh.caption = cut.caption;
  fresh.perf = cut.perf; // 人の動きは技法を変えても維持する
  fresh.location = cut.location; // ロケ地も維持する
  fresh.originMode = cut.originMode;
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
  if (typeof S3D !== "undefined" && S3D.active) render3D();
}

/* 2D/3D/POV ビュー切替 */
function setupViewToggle() {
  document.querySelectorAll(".view-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      const is3d = view !== "2d";
      S3D.active = is3d;
      S3D.pov = view === "pov";
      document.querySelectorAll(".view-tab").forEach(b => b.classList.toggle("active", b === btn));
      // SVG要素は hidden プロパティが効かない (HTMLElement専用) ため display で切替える
      byId("studioCanvas").style.display = is3d ? "none" : "";
      byId("studio3d").style.display = is3d ? "block" : "none";
      byId("zoomControls").style.display = is3d ? "none" : "";
      byId("viewHint").textContent =
        view === "pov" ? "カメラ視点 — 再生ボタンで軌道を移動"
        : is3d ? "回転して光錐・視野角・被写界深度・カメラ軌道を確認"
        : "ドラッグで機材を移動";
      if (is3d) requestAnimationFrame(render3D);
    });
  });
}

let previewMemo = "";
function renderPreview() {
  const svg = renderPreviewCached(activeCut(), "live");
  if (svg !== previewMemo) {
    previewMemo = svg;
    byId("previewFrame").innerHTML = svg;
  }
  byId("explainList").innerHTML = explainCut(activeCut()).map(l => `<li>${esc(l)}</li>`).join("");
  updatePlayButton();
  renderAspectChips();
  renderFeasibility();
}

/* フィージビリティ / 安全チェック (CineOS FeasibilityEngine) */
function renderFeasibility() {
  const warnings = evaluateFeasibility(activeCut());
  const box = byId("feasBox");
  box.hidden = warnings.length === 0;
  byId("feasList").innerHTML = warnings
    .map(x => `<li class="lv-${x.lv}">${esc(x.t)}</li>`).join("");
}

/* プロンプト診断パネル (書いてはいけない5項目 + 噛み合わせ) */
function renderLint() {
  const box = byId("lintBox");
  if (!box) return;
  const items = lintCut(activeCut());
  box.hidden = items.length === 0;
  byId("lintList").innerHTML = items
    .map(x => `<li class="lv-${x.lv}"><b>${esc(x.code)}</b> ${esc(x.t)}</li>`).join("");
}

/* アスペクト比クイック切替チップ (プレビュー直上) */
function renderAspectChips() {
  const wrap = byId("aspectChips");
  const cur = activeCut().aspect;
  wrap.innerHTML = ASPECTS.map(a =>
    `<button class="aspect-chip ${a.id === cur ? "active" : ""}" data-a="${a.id}" title="${esc(a.label)}">${esc(a.id)}</button>`).join("");
  wrap.querySelectorAll(".aspect-chip").forEach(b => b.addEventListener("click", () => {
    activeCut().aspect = b.dataset.a;
    refresh(); renderInspector();
  }));
}

/* =========================================================
 * カメラワークのプレビュー再生 (アニメーション)
 * ======================================================= */
let animRAF = null, animStart = 0;

function updatePlayButton() {
  const btn = byId("btnPlayPreview");
  const cut = activeCut();
  const isStill = cut.kind === "still" && cut.camera.move === "fix";
  btn.style.display = isStill ? "none" : "";
  btn.classList.toggle("playing", !!state.previewPlay);
  btn.innerHTML = `<svg class="ic"><use href="#${state.previewPlay ? "i-pause" : "i-play"}"/></svg>`;
  btn.title = state.previewPlay ? "再生を停止" : "カメラワークを再生";
}

/* カメラワーク種別 → フレーム内の擬似的な動き */
function animTransform(cut, t, W, H) {
  const easeIO = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const move = cut.camera.move;
  let s = 1, tx = 0, ty = 0, rot = 0;
  const sin = (f, ph = 0) => Math.sin(t * Math.PI * 2 * f + ph);

  switch (move) {
    case "dollyin": case "zoomin": s = 1 + 0.20 * easeIO; break;
    case "dollyout": s = 1.20 - 0.20 * easeIO; break;
    case "pan": tx = (easeIO - 0.5) * W * 0.14; break;
    case "whip": { const e2 = Math.min(1, t * 2.5); tx = (e2 - 0.5) * W * 0.55; break; }
    case "tilt": ty = (easeIO - 0.5) * H * 0.16; break;
    case "pedestal": case "crane": ty = (0.5 - easeIO) * H * 0.2; s = 1 + 0.05 * easeIO; break;
    case "track": case "d_side": tx = (0.5 - easeIO) * W * 0.2; break;
    case "arc": case "orbit": case "d_orbit": case "d_spiral":
      tx = sin(1) * W * 0.06; s = 1.05 + 0.04 * sin(2, 1); break;
    case "handheld":
      tx = (sin(3.1) + 0.5 * sin(7.3, 2)) * W * 0.008;
      ty = (sin(2.7, 1) + 0.5 * sin(6.1, 4)) * H * 0.01;
      rot = sin(1.9, 3) * 0.4; break;
    case "gimbal": tx = sin(1) * W * 0.02; ty = Math.cos(t * Math.PI * 2) * H * 0.015; break;
    case "dollyzoom": case "d_dzoom": s = 1.06 + 0.1 * sin(1); break;
    case "d_reveal": ty = (0.5 - easeIO) * H * 0.3; s = 1.18 - 0.15 * easeIO; break;
    case "d_flyover": case "d_lowpass": ty = (easeIO - 0.5) * H * 0.25; s = 1.12; break;
    case "d_chase": tx = sin(4) * W * 0.02; ty = sin(5) * H * 0.012; s = 1.08; break;
    case "d_topdown": s = 1.18 - 0.15 * easeIO; break;
    case "d_pullback": case "d_dronie": s = 1.3 - 0.28 * easeIO; break;
    case "d_dive": ty = (0.5 - easeIO) * H * 0.35; s = 1.1; break;
    default: break;
  }
  // 開始→終了サイズの変化 (常に s>=1 側で表現し、余白の露出を防ぐ)
  if (cut.camera.endShotSize && cut.camera.endShotSize !== "same") {
    const st = SHOT_SIZES.find(x => x.id === cut.camera.shotSize) || SHOT_SIZES[2];
    const en = SHOT_SIZES.find(x => x.id === cut.camera.endShotSize);
    if (en && en.id !== st.id) {
      const ratio = Math.max(0.35, Math.min(2.8, en.scale / st.scale));
      const f = Math.pow(ratio, easeIO) * (ratio < 1 ? 1 / ratio : 1);
      s *= f;
    }
  }
  const cx = W / 2, cy = H / 2;
  return `rotate(${rot} ${cx} ${cy}) translate(${(cx * (1 - s) + tx).toFixed(2)} ${(cy * (1 - s) + ty).toFixed(2)}) scale(${s.toFixed(4)})`;
}

function startPreviewAnim() {
  stopPreviewAnim();
  animStart = performance.now();
  const tick = (now) => {
    const cut = activeCut();
    const speedMul = { veryslow: 1.8, slow: 1.3, normal: 1, fast: 0.65, veryfast: 0.45 }[cut.camera.moveSpeed] || 1;
    const dur = Math.min(8, Math.max(2, cut.kind === "still" ? 3 : cut.duration || 5)) * 1000 * speedMul;
    const t = ((now - animStart) % dur) / dur;
    const g = document.getElementById("liveanim");
    if (g) {
      const { W, H } = aspectDims(cut.aspect);
      g.setAttribute("transform", animTransform(cut, t, W, H));
    }
    // 3D/POVビューにもカメラ軌道の進行を反映
    if (typeof S3D !== "undefined" && S3D.active) {
      S3D.animT = t;
      render3D();
    }
    animRAF = requestAnimationFrame(tick);
  };
  animRAF = requestAnimationFrame(tick);
}

function stopPreviewAnim() {
  if (animRAF) cancelAnimationFrame(animRAF);
  animRAF = null;
  const g = document.getElementById("liveanim");
  if (g) g.removeAttribute("transform");
  if (typeof S3D !== "undefined") {
    S3D.animT = null;
    if (S3D.active) render3D();
  }
}

function renderPrompt() {
  byId("promptText").value = generatePrompt(activeCut(), state.promptModel);
  const m = PROMPT_MODELS.find(x => x.id === state.promptModel);
  byId("promptHint").textContent = m ? `${m.label}: ${m.hint}` : "";
}

let cutStripMemo = "";
function renderCutStrip() {
  const strip = byId("cutStrip");
  const keepScroll = strip.scrollLeft; // 再描画で横スクロール位置を失わない
  const html = state.cuts.map((c, i) => {
    const trans = i < state.cuts.length - 1 ? TRANSITIONS.find(t => t.id === (c.transition || "cut")) : null;
    // サムネイルはカットの実アスペクト比 (9:16なら縦長) で表示する
    const d = aspectDims(c.aspect);
    const tw = Math.max(56, Math.min(150, Math.round(76 * d.W / d.H)));
    // 動画モード以外で作られたカットには由来バッジを出す (混在時の見分け用)
    const mb = c.originMode === "still" ? { cls: "mb-still", t: "ス", tip: "スチールモードで作成 (静止画カット)" }
      : c.originMode === "outdoor" ? { cls: "mb-outdoor", t: "屋", tip: "屋外・ドローンモードで作成" } : null;
    // 演技演出が設計されているカットには「演」バッジ
    const pb = perfActive(c)
      ? `<span class="mode-badge mb-perf" title="演技演出あり: ${c.perf.beats.length}ビート / ${(c.perf.beats.reduce((s2, b) => s2 + (+b.sec || 0), 0)).toFixed(1)}秒">演</span>` : "";
    return `
    <div class="cut-thumb ${i === state.activeCut ? "active" : ""}" data-idx="${i}" style="width:${tw + 4}px">
      ${renderPreviewCached(c, "th" + i)}
      <div class="cut-cap"><span class="wf-dot ${c.wfStatus || "plan"}" title="${(WF_STATUS.find(w => w.id === c.wfStatus) || WF_STATUS[0]).label}"></span>C${i + 1}${mb ? `<span class="mode-badge ${mb.cls}" title="${mb.tip}">${mb.t}</span>` : ""}${pb}　${esc(c.name)}</div>
    </div>
    ${trans ? `<div class="trans-chip" title="${esc(trans.note)}">${esc(trans.label.split(" ")[0])}</div>` : ""}`;
  }).join("");
  if (html === cutStripMemo && strip.children.length) return; // 変化なし → DOM再構築しない
  cutStripMemo = html;
  strip.innerHTML = html;
  strip.querySelectorAll(".cut-thumb").forEach(el => {
    el.addEventListener("click", () => {
      state.activeCut = +el.dataset.idx;
      state.selectedItem = null;
      renderAll();
    });
  });
  strip.scrollLeft = keepScroll;
}

/* ---------- CoverageSufficiency 表示 (V6) ---------- */
function renderCoverage() {
  const bar = byId("coverageBar");
  const items = evaluateCoverage(state.cuts);
  bar.innerHTML = items.map((c, i) =>
    `<button class="cov-chip ${c.ok ? "" : "ng"}" data-cov="${i}" title="${esc(c.tip)}${c.fix ? " — クリックで不足カットを自動追加" : ""}">${esc(c.label)}</button>`).join("");
  bar.querySelectorAll(".cov-chip.ng").forEach(el => {
    el.addEventListener("click", () => {
      const c = items[+el.dataset.cov];
      if (!c.fix) return;
      // 不足カバレッジの自動補完: 現在のカットを複製してサイズを変更
      const base = JSON.parse(JSON.stringify(activeCut()));
      base.id = uid(); base.items.forEach(it => it.id = uid());
      if (c.fix === "wide") {
        base.name = "引き (状況説明)"; base.camera.shotSize = "LS"; base.camera.endShotSize = "same";
        base.camera.move = "fix"; base.aim = "シーンの地理を見せるエスタブリッシング (COV-001 自動補完)。";
        state.cuts.unshift(ensureCameraDefaults(base));
        state.activeCut = 0;
      } else {
        base.name = "寄り (感情/ディテール)"; base.camera.shotSize = "CU"; base.camera.endShotSize = "same";
        base.camera.move = "dollyin"; base.camera.moveSpeed = "slow";
        base.aim = "感情・ディテールを読ませる寄り (COV-002 自動補完)。";
        state.cuts.push(ensureCameraDefaults(base));
        state.activeCut = state.cuts.length - 1;
      }
      renderAll();
    });
  });
}

/* ---------- 尺タイムライン (V6 — トリム/並べ替え対応) ---------- */
function renderTimeline() {
  const bar = byId("timelineBar");
  const durs = state.cuts.map(c => c.kind === "still" ? 2 : (c.duration || 5));
  const vTotal = state.cuts.reduce((s2, c) => s2 + (c.kind === "still" ? 0 : c.duration || 5), 0);
  const stills = state.cuts.filter(c => c.kind === "still").length;
  const total = `${vTotal}s${stills ? ` +ス${stills}` : ""}`;
  bar.innerHTML = state.cuts.map((c, i) =>
    `<div class="tl-block ${i === state.activeCut ? "active" : ""}" style="flex:${durs[i]}"
       title="C${i + 1} ${esc(c.name)} — ${c.kind === "still" ? "スチール" : (c.duration || 5) + "秒"}。ドラッグで並べ替え${c.kind === "still" ? "" : "、右端で尺トリム"}" data-idx="${i}" data-cid="${esc(c.id)}">
       <span class="tl-label">C${i + 1}${c.kind === "still" ? "" : " " + (c.duration || 5) + "s"}</span>
       ${c.kind === "still" ? "" : `<span class="tl-handle" data-h="${i}" title="ドラッグで尺を変更"></span>`}
     </div>`).join("")
    + `<span class="tl-total" title="動画カットの合計尺${stills ? `。スチール${stills}枚はラフカットで各3秒静止` : ""}">計 ${total}</span>`;
}

/* タイムライン操作 (委譲・1回だけ登録): 右端ドラッグ=トリム / ブロックドラッグ=並べ替え / クリック=選択 */
function setupTimeline() {
  const bar = byId("timelineBar");
  let drag = null;

  bar.addEventListener("pointerdown", e => {
    const handle = e.target.closest(".tl-handle");
    const block = e.target.closest(".tl-block");
    if (handle) {
      const idx = +handle.dataset.h;
      drag = { type: "trim", cutId: state.cuts[idx].id, startX: e.clientX, startDur: state.cuts[idx].duration || 5 };
    } else if (block) {
      drag = { type: "move", cutId: block.dataset.cid, startX: e.clientX, moved: false };
    } else return;
    try { bar.setPointerCapture(e.pointerId); } catch { /* noop */ }
    e.preventDefault();
  });

  bar.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (drag.type === "trim") {
      const cut = state.cuts.find(c => c.id === drag.cutId);
      if (!cut) return;
      const nd = Math.max(1, Math.min(30, drag.startDur + Math.round(dx / 10)));
      if (nd !== cut.duration) { cut.duration = nd; drag.trimmed = true; renderTimeline(); }
    } else {
      if (Math.abs(dx) > 8) drag.moved = true;
      if (!drag.moved) return;
      // ポインタ位置のブロックへ並べ替え
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const over = el && el.closest ? el.closest(".tl-block") : null;
      if (!over) return;
      const from = state.cuts.findIndex(c => c.id === drag.cutId);
      const to = +over.dataset.idx;
      if (from < 0 || to === from) return;
      const [mv] = state.cuts.splice(from, 1);
      state.cuts.splice(to, 0, mv);
      renderTimeline();
    }
  });

  const end = () => {
    if (!drag) return;
    const idx = state.cuts.findIndex(c => c.id === drag.cutId);
    if (drag.type === "trim") {
      if (drag.trimmed) { refresh(); renderInspector(); }
    } else if (drag.moved) {
      if (idx >= 0) state.activeCut = idx;
      renderAll();
    } else if (idx >= 0) {
      state.activeCut = idx;
      state.selectedItem = null;
      renderAll();
    }
    drag = null;
  };
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
}

function fieldRow(label, inner) {
  return `<div class="field"><label>${esc(label)}</label>${inner}</div>`;
}
function selectHtml(id, options, value) {
  return `<select id="${id}">${options.map(o =>
    `<option value="${esc(o.id)}" ${o.id === value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
}

/* 人の動き (演技演出) セクション。開閉状態は再描画をまたいで保持する */
let perfOpen = false;
function perfSectionHtml(cut) {
  const p = cut.perf;
  const rec = recommendMethod(cut);
  const used = perfMethodOf(cut);
  const total = perfBeatTotal(cut);
  const dur = cut.duration || 5;
  const chip = (arr, sel, attr) => arr.map(x =>
    `<span class="opt-toggle ${sel.includes(x.id) ? "on" : ""}" data-${attr}="${x.id}">${esc(x.label)}</span>`).join("");
  let acc = 0;
  return `
  <details class="insp-section perf-sec"${perfOpen ? " open" : ""}>
    <summary>演出・動き <small>${perfActive(cut) ? `${p.beats.length}ビート / ${total.toFixed(1)}s` : "未設定"}</small></summary>

    <button class="btn small" id="pOpenScript" style="margin-bottom:8px"><svg class="ic"><use href="#i-doc"/></svg> 台本・コンテで編集</button>
    <h4 class="perf-h">動きの質 <small>「◯◯という動き」ではなく速さ・雑さ・向き先で</small></h4>
    ${fieldRow("速さ", selectHtml("pSpeed", MOTION_SPEEDS, p.speed))}
    ${fieldRow("丁寧さ", selectHtml("pCare", MOTION_CARES, p.care))}
    ${fieldRow("向き先", selectHtml("pToward", MOTION_TOWARDS, p.toward))}
    ${fieldRow("演技の温度", selectHtml("pTemp", PERF_TEMPS, p.temp))}

    <h4 class="perf-h">登場要素と絡み <small>絡みが多いほど「先に撮る」向き</small></h4>
    ${fieldRow("登場要素", `<span class="insp-hint">${esc(p.actors.map(a => actorLabel(cut, a.id)).join("・"))} <small>(台本ページで追加/変更)</small></span>`)}
    ${fieldRow("絡み", selectHtml("pContact", CONTACT_TYPES, p.contact))}
    ${fieldRow("カメラ連動", selectHtml("pCamLink", CAM_LINKS, p.camLink))}
    ${p.camLink !== "none" && cut.camera.move === "fix"
      ? `<div class="insp-hint warn">⚠️ カメラワークが「フィックス」です。連動させるならカメラワークを手持ち/ジンバル系に変えてください</div>` : ""}

    <h4 class="perf-h">ビート (時間軸の動き) <small>合計 ${total.toFixed(1)}s / 尺 ${dur}s</small></h4>
    <div class="beat-list">
      ${p.beats.map((b, i) => {
        const from = acc; acc += +b.sec || 0;
        return `
        <div class="beat-row">
          <span class="beat-t">${from.toFixed(1)}–${acc.toFixed(1)}s</span>
          <input type="number" class="beat-sec" data-bsec="${i}" value="${b.sec}" min="0.5" max="60" step="0.5" title="このビートの長さ(秒)">
          <input type="text" class="beat-do" data-bdo="${i}" value="${esc(b.do)}" placeholder="何をする (例: 立ち止まって振り返る)">
          <select data-bgaze="${i}" title="視線">${GAZE_TARGETS.map(g => `<option value="${g.id}" ${g.id === b.gaze ? "selected" : ""}>${esc(g.label)}</option>`).join("")}</select>
          <select data-bcam="${i}" title="このビートでのカメラ">${CAM_LINKS.map(c => `<option value="${c.id}" ${c.id === b.cam ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
          <button class="icon-btn small" data-bup="${i}" title="上へ" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-btn small danger" data-bdel="${i}" title="削除">×</button>
        </div>`;
      }).join("") || `<div class="insp-hint">ビート未設定 — 「いつ・何をするか」を並べると、尺とカメラの噛み合わせを診断できます</div>`}
    </div>
    <div class="beat-actions">
      <button class="btn small" id="pBeatAdd"><svg class="ic"><use href="#i-plus"/></svg> ビート追加</button>
      <select id="pBeatTpl" title="尺に合わせて比率で流し込みます">
        <option value="">配分テンプレ…</option>
        ${BEAT_TEMPLATES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}
      </select>
      ${p.beats.length ? `<button class="btn small ghost" id="pBeatFit" title="ビートの比率を保ったまま合計をカットの尺に合わせます">尺に合わせる</button>` : ""}
    </div>

    <h4 class="perf-h">作り方 <small>難しい動きは先に撮る</small></h4>
    ${fieldRow("方式", `<select id="pMethod">
      <option value="auto" ${p.method === "auto" ? "selected" : ""}>自動 (推奨に従う)</option>
      ${PROD_METHODS.map(m => `<option value="${m.id}" ${p.method === m.id ? "selected" : ""}>${esc(m.label)}</option>`).join("")}
    </select>`)}
    <div class="insp-hint">${p.method === "auto" ? "推奨: " : "採用: "}<b>${esc((PROD_METHODS.find(m => m.id === used) || {}).label || "")}</b> — ${esc(rec.why[0] || "")}</div>
    ${used === "shoot" ? `
      <div class="field"><label>残す</label><div class="opt-toggles">${chip(PRESERVE_ITEMS, p.preserve, "pres")}</div></div>
      <div class="field"><label>変える</label><div class="opt-toggles">${chip(CHANGE_ITEMS, p.change, "chg")}</div></div>
      <div class="field"><label>解決しない例</label><div class="opt-toggles">${chip(UNFIT_CASES, p.unfit, "unfit")}</div></div>` : ""}
  </details>`;
}

function renderInspector() {
  const cut = activeCut();
  const insp = byId("inspector");
  const rightPanel = byId("rightPanel");
  const keepScroll = rightPanel.scrollTop; // トグル操作等の再描画でスクロール位置を失わない
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
          `<option ${s === (selItem.stand || "ライトスタンド") ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`)}
        ${fieldRow("消費電力(W)", `<input type="number" id="itWatt" value="${selItem.watt ?? 0}" min="0" max="20000" step="10" title="電源プラン(指示書)の自動計算に使われます">`)}` : ""}
        <div class="insp-hint">被写体からの距離: 約${distM}m ｜ 方位: ${esc(relToJa(analyzeLighting(cut).lights.find(l => l.item.id === selItem.id)?.rel ?? 0))}</div>
        ${selItem.sku ? `<div class="insp-hint" style="margin-top:6px">🎬 使用機材: <b>${esc(selItem.sku)}</b> (機材DBで変更可)</div>` : ""}
        ${(() => {
          const rec = recommendForItem(selItem);
          if (!rec || !rec.records.length) return "";
          return `<div class="insp-hint" style="margin-top:6px">🎬 実機材候補: ${esc(rec.records.map(r => `${r.manufacturer} ${r.model}`).join(" / "))} など同等能力機<br><small>${esc(rec.need)}</small></div>`;
        })()}
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
      ${fieldRow("演技/動き", selectHtml("cAction", SUBJECT_ACTIONS, cut.action))}
      ${fieldRow("被写体メモ", `<input type="text" id="cSubNote" value="${esc(cut.subjectNote)}" placeholder="例: 20代女性・白ワンピース / 青いガラス瓶のジン">`)}
      ${fieldRow("テロップ/セリフ", `<input type="text" id="cCaption" value="${esc(cut.caption)}" placeholder="編集用の字幕 — プレビューとラフカットに焼き込み (プロンプトには入れない)">`)}
      ${fieldRow("背景", selectHtml("cBg", Object.keys(BG_STYLES).map(k => ({ id: k, label: k + " — " + BG_STYLES[k].en })), cut.bgStyle))}
      ${state.story.refs.length ? fieldRow("参照画像", `<select id="cRefImg">
        <option value="">なし (図解プレビュー)</option>
        ${state.story.refs.map(r => `<option value="${esc(r.id)}" ${cut.refImgId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
      </select>`) : ""}
      ${cut.refImgId ? fieldRow("画像位置 X", `<input type="range" id="cRefOffX" min="-25" max="25" step="1" value="${cut.refOffX || 0}" title="寄りの中心を左右に調整">`)
        + fieldRow("画像位置 Y", `<input type="range" id="cRefOffY" min="-25" max="25" step="1" value="${cut.refOffY || 0}" title="寄りの中心を上下に調整">`) : ""}
      ${fieldRow("アスペクト比", selectHtml("cAspect", ASPECTS, cut.aspect))}
      ${fieldRow("ルック/グレード", selectHtml("cLook", LOOKS, cut.look))}
      ${fieldRow("天候", selectHtml("cWeather", WEATHERS, cut.weather))}
      ${fieldRow("時間帯", selectHtml("cTod", TIMES_OF_DAY, cut.timeOfDay))}
      ${cut.kind !== "still" ? fieldRow("尺(秒)", `<input type="number" id="cDur" value="${cut.duration}" min="1" max="60">`) : ""}
      ${cut.kind !== "still" ? fieldRow("音声収録", `<select id="cAudio">${AUDIO_MODES.map(a => `<option ${a === cut.audio ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>`) : ""}
      ${fieldRow("想定テイク", `<input type="number" id="cTakes" value="${cut.takes}" min="1" max="50">`)}
      ${fieldRow("準備時間(分)", `<input type="number" id="cSetup" value="${cut.setupMin}" min="0" max="480">`)}
      ${state.activeCut < state.cuts.length - 1
        ? fieldRow("次カットへの繋ぎ", `<select id="cTrans">${TRANSITIONS.map(t =>
            `<option value="${t.id}" ${t.id === cut.transition ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select>`)
        : ""}
      ${(() => {
        const t = TRANSITIONS.find(x => x.id === cut.transition);
        return t && state.activeCut < state.cuts.length - 1 ? `<div class="insp-hint">🎬 ${esc(t.note)}</div>` : "";
      })()}
    </div>
    ${cut.kind !== "still" ? perfSectionHtml(cut) : ""}
    ${cut.kind !== "still" ? `
    <div class="insp-section">
      <h3>編集 (EditDecision)</h3>
      ${fieldRow("採用テイク", `<input type="number" id="cTake" value="${cut.take}" min="1" max="50">`)}
      ${fieldRow("素材イン点(秒)", `<input type="number" id="cSrcIn" value="${cut.srcInSec}" min="0" max="600" step="0.5">`)}
      <div class="insp-hint">録画開始からアクション頭までのプリロール。EDLの素材INに反映されます</div>
      ${state.activeCut < state.cuts.length - 1 ? fieldRow("音の繋ぎ", selectHtml("cAudioEdit", AUDIO_EDITS, cut.audioEdit)) : ""}
      ${cut.audioEdit !== "none" && state.activeCut < state.cuts.length - 1
        ? fieldRow("音のズレ(秒)", `<input type="number" id="cAudioOv" value="${cut.audioOverlapSec}" min="0.5" max="5" step="0.5">`)
        : ""}
      ${(() => {
        const ae = AUDIO_EDITS.find(x => x.id === cut.audioEdit);
        return ae && ae.id !== "none" && state.activeCut < state.cuts.length - 1 ? `<div class="insp-hint">🔊 ${esc(ae.note)}</div>` : "";
      })()}
    </div>` : ""}
    <div class="insp-section">
      <h3>カメラ & レンズ</h3>
      ${fieldRow("ボディ", selectHtml("cBody", CAMERA_BODIES, cut.camera.body))}
      ${fieldRow("カットサイズ", selectHtml("cShot", SHOT_SIZES, cut.camera.shotSize))}
      ${fieldRow("アングル", selectHtml("cAngle", CAM_ANGLES, cut.camera.angle))}
      ${fieldRow("カメラワーク", selectHtml("cMove", CAM_MOVES, cut.camera.move))}
      ${cut.camera.move !== "fix" ? fieldRow("移動速度", selectHtml("cMoveSpeed", MOVE_SPEEDS, cut.camera.moveSpeed)) : ""}
      ${fieldRow("終了サイズ", selectHtml("cEndShot", [{ id: "same", label: "変化なし (同サイズ)" }, ...SHOT_SIZES], cut.camera.endShotSize))}
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
      ${cut.kind !== "still" ? fieldRow("フレームレート", `<input type="text" id="cFps" value="${esc(cut.camera.fps)}">`) : ""}
      ${fieldRow("WB", `<input type="text" id="cWb" value="${esc(cut.camera.wb)}">`)}
    </div>
    <div class="insp-section">
      <h3>使用機材 (プロジェクト共通・保存されます)</h3>
      ${[["body", "カメラ"], ["lens", "レンズ"], ["support", "サポート"], ["drone", "ドローン"]].map(([k, label]) => `
        <div class="field"><label>${label}</label>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="insp-hint" style="flex:1">${state.kit[k] ? `<b>${esc(state.kit[k])}</b>` : "未設定"}</span>
            ${state.kit[k] ? `<button class="icon-btn small kit-clear" data-kit="${k}" title="解除" aria-label="解除"><svg class="ic"><use href="#i-close"/></svg></button>` : ""}
          </div>
        </div>`).join("")}
      <button class="btn small" id="btnKitOpenDb">機材DBから選ぶ</button>
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
      ${["dolly", "slider"].includes(cut.camera.support)
        ? fieldRow("レール軌道", `<select id="cTrack">${TRACK_SHAPES.map(t => `<option ${t === cut.camera.trackShape ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`) : ""}
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
  bind("cSubject", e => {
    cut.subjectType = e.target.value;
    cut.action = SUBJECT_DEFAULT_ACTION[e.target.value] || "stand";
    refresh(); renderInspector();
  });
  bind("cAction", e => { cut.action = e.target.value; renderPrompt(); });
  bind("cSubNote", e => { cut.subjectNote = e.target.value; renderPrompt(); }, "input");
  bind("cCaption", e => { cut.caption = e.target.value; renderPreview(); renderCutStrip(); }, "input");
  bind("cBg", e => { cut.bgStyle = e.target.value; refresh(); });
  bind("cRefImg", e => { cut.refImgId = e.target.value || null; refresh(); renderInspector(); });
  bind("cRefOffX", e => { cut.refOffX = +e.target.value; renderPreview(); renderCutStrip(); }, "input");
  bind("cRefOffY", e => { cut.refOffY = +e.target.value; renderPreview(); renderCutStrip(); }, "input");
  bind("cAspect", e => { cut.aspect = e.target.value; refresh(); });
  bind("cLook", e => { cut.look = e.target.value; renderPreview(); renderPrompt(); renderCutStrip(); });
  bind("cWeather", e => { cut.weather = e.target.value; renderPrompt(); });
  bind("cTod", e => { cut.timeOfDay = e.target.value; renderPrompt(); });
  bind("cAudio", e => { cut.audio = e.target.value; });
  bind("cTakes", e => { cut.takes = +e.target.value; });
  bind("cSetup", e => { cut.setupMin = +e.target.value; });
  bind("cDur", e => { cut.duration = +e.target.value; });
  bind("cTrans", e => { cut.transition = e.target.value; renderCutStrip(); renderPrompt(); renderInspector(); });
  bind("cTake", e => { cut.take = Math.max(1, +e.target.value || 1); });
  bind("cSrcIn", e => { cut.srcInSec = Math.max(0, +e.target.value || 0); });
  bind("cAudioEdit", e => { cut.audioEdit = e.target.value; renderInspector(); });
  bind("cAudioOv", e => { cut.audioOverlapSec = Math.max(0.5, +e.target.value || 1); });
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
  bind("cMoveSpeed", e => { cut.camera.moveSpeed = e.target.value; renderPrompt(); });
  bind("cEndShot", e => { cut.camera.endShotSize = e.target.value; renderPrompt(); });
  bind("cTrack", e => { cut.camera.trackShape = e.target.value; renderCanvas(); });
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
  insp.querySelectorAll(".kit-clear").forEach(el => {
    el.addEventListener("click", () => { state.kit[el.dataset.kit] = null; renderInspector(); });
  });
  bind("btnKitOpenDb", () => {
    byId("equipAssignHint").innerHTML = "";
    byId("equipOverlay").hidden = false;
    renderEquipPage();
  }, "click");
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

  /* ---------- 人の動き (演技演出) ---------- */
  {
    const sec = insp.querySelector(".perf-sec");
    if (sec) sec.addEventListener("toggle", () => { perfOpen = sec.open; });
    const p = cut.perf;
    const redraw = () => { renderInspector(); renderPrompt(); renderLint(); renderCutStrip(); };
    bind("pSpeed", e => { p.speed = e.target.value; renderPrompt(); renderLint(); });
    bind("pCare", e => { p.care = e.target.value; renderPrompt(); renderLint(); });
    bind("pToward", e => { p.toward = e.target.value; renderPrompt(); renderLint(); });
    bind("pTemp", e => { p.temp = e.target.value; renderPrompt(); renderLint(); });
    bind("pOpenScript", () => { byId("scriptOverlay").hidden = false; renderScriptPage(); }, "click");
    bind("pContact", e => { p.contact = e.target.value; redraw(); });
    bind("pCamLink", e => { p.camLink = e.target.value; redraw(); });
    bind("pMethod", e => { p.method = e.target.value; redraw(); });
    bind("pBeatAdd", () => {
      /* 残り尺を初期値にする (尺との噛み合わせを崩さない) */
      const rest = Math.max(0.5, Math.round(((cut.duration || 5) - perfBeatTotal(cut)) * 10) / 10);
      p.beats.push({ id: uid(), sec: rest || 1, do: "", gaze: "none", cam: "none" });
      redraw();
    }, "click");
    bind("pBeatTpl", e => {
      if (!e.target.value) return;
      perfApplyTemplate(cut, e.target.value);
      redraw();
      showToast("配分テンプレをカットの尺に合わせて流し込みました");
    });
    bind("pBeatFit", () => {
      const total = perfBeatTotal(cut);
      if (!total) return;
      const k = (cut.duration || 5) / total;
      p.beats.forEach(b => { b.sec = Math.max(0.5, Math.round(b.sec * k * 10) / 10); });
      redraw();
    }, "click");
    insp.querySelectorAll("[data-bsec]").forEach(el => el.addEventListener("change", () => {
      p.beats[+el.dataset.bsec].sec = Math.max(0.5, +el.value || 0.5); redraw();
    }));
    insp.querySelectorAll("[data-bdo]").forEach(el => el.addEventListener("input", () => {
      p.beats[+el.dataset.bdo].do = el.value; renderPrompt(); renderLint();
    }));
    insp.querySelectorAll("[data-bgaze]").forEach(el => el.addEventListener("change", () => {
      p.beats[+el.dataset.bgaze].gaze = el.value; renderPrompt();
    }));
    insp.querySelectorAll("[data-bcam]").forEach(el => el.addEventListener("change", () => {
      p.beats[+el.dataset.bcam].cam = el.value; renderPrompt(); renderLint();
    }));
    insp.querySelectorAll("[data-bup]").forEach(el => el.addEventListener("click", () => {
      const i = +el.dataset.bup;
      [p.beats[i - 1], p.beats[i]] = [p.beats[i], p.beats[i - 1]];
      redraw();
    }));
    insp.querySelectorAll("[data-bdel]").forEach(el => el.addEventListener("click", () => {
      p.beats.splice(+el.dataset.bdel, 1); redraw();
    }));
    const toggleIn = (arr, id) => {
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
    };
    insp.querySelectorAll(".perf-sec [data-pres]").forEach(el => el.addEventListener("click", () => {
      toggleIn(p.preserve, el.dataset.pres); redraw();
    }));
    insp.querySelectorAll(".perf-sec [data-chg]").forEach(el => el.addEventListener("click", () => {
      toggleIn(p.change, el.dataset.chg); redraw();
    }));
    insp.querySelectorAll(".perf-sec [data-unfit]").forEach(el => el.addEventListener("click", () => {
      toggleIn(p.unfit, el.dataset.unfit); redraw();
    }));
  }

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
    bind("itWatt", e => { selItem.watt = +e.target.value; });
    bind("btnDelItem", () => {
      cut.items = cut.items.filter(i => i.id !== selItem.id);
      state.selectedItem = null;
      renderAll();
    }, "click");
  }
  insp.querySelectorAll('input[type="range"]').forEach(updateRangeFill);
  rightPanel.scrollTop = keepScroll;
}

function updateRangeFill(el) {
  const min = +el.min || 0, max = +el.max || 100;
  const pct = ((+el.value - min) / (max - min)) * 100;
  el.style.setProperty("--fill", pct.toFixed(1) + "%");
}

function refresh() { renderCanvas(); renderPreview(); renderPrompt(); renderCutStrip(); renderCoverage(); renderTimeline(); renderLint(); captureUndo(); }
function renderAll() { renderPresetList(); renderCanvas(); renderPreview(); renderPrompt(); renderCutStrip(); renderInspector(); renderTimeline(); renderCoverage(); renderLint(); captureUndo(); }

/* =========================================================
 * Undo / Redo — 描画フックで状態差分を自動キャプチャする。
 * 個々の操作ハンドラに手を入れず、refresh()/renderAll() の後に
 * スナップショットを比較して変化があれば履歴に積む。
 * ======================================================= */
const undoState = { stack: [], redo: [], last: null, applying: false, lastPushAt: 0 };
const UNDO_MAX = 50, UNDO_MAX_CHARS = 25 * 1024 * 1024; // 件数と総容量の両方で制限
const UNDO_COALESCE_MS = 500; // この間隔以内の連続変化 (スライダードラッグ等) は1ステップに合体

function captureUndo() {
  if (undoState.applying) return;
  let snap;
  try { snap = JSON.stringify(snapshotState()); } catch { return; }
  if (undoState.last === null) { undoState.last = snap; return; } // 初回は基準登録のみ
  if (snap === undoState.last) return;
  const now = performance.now();
  if (now - undoState.lastPushAt < UNDO_COALESCE_MS && undoState.stack.length) {
    // ドラッグ中の連続入力: 直前にpushした「操作前」を保ったまま最新状態だけ更新
    // → 1回のUndoでドラッグ開始前まで戻る
    undoState.redo.length = 0;
    undoState.last = snap;
    undoState.lastPushAt = now;
    return;
  }
  undoState.stack.push(undoState.last);
  undoState.redo.length = 0;
  undoState.last = snap;
  undoState.lastPushAt = now;
  // 上限を超えたら古いものから捨てる
  while (undoState.stack.length > UNDO_MAX) undoState.stack.shift();
  let total = undoState.stack.reduce((s, x) => s + x.length, 0);
  while (total > UNDO_MAX_CHARS && undoState.stack.length > 1) total -= undoState.stack.shift().length;
}

function doUndo() {
  if (!undoState.stack.length) { showToast("これ以上戻れません"); return; }
  undoState.redo.push(undoState.last);
  const snap = undoState.stack.pop();
  undoState.last = snap;
  undoState.lastPushAt = 0; // Undo直後の変化は合体させず新しいステップにする
  undoState.applying = true;
  try { applySnapshot(JSON.parse(snap)); } finally { undoState.applying = false; }
  showToast(`↩ 元に戻しました (残り${undoState.stack.length})`);
}

function doRedo() {
  if (!undoState.redo.length) { showToast("やり直す操作がありません"); return; }
  undoState.stack.push(undoState.last);
  const snap = undoState.redo.pop();
  undoState.last = snap;
  undoState.lastPushAt = 0;
  undoState.applying = true;
  try { applySnapshot(JSON.parse(snap)); } finally { undoState.applying = false; }
  showToast(`↪ やり直しました`);
}

/* ---------- トースト通知 ---------- */
let toastTimer = null;
function showToast(msg, sticky) {
  const t = byId("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

/* =========================================================
 * キャンバス ドラッグ操作
 * ======================================================= */
(function setupDrag() {
  const svg = byId("studioCanvas");
  let dragging = null; // 機材ドラッグ
  let panning = null;  // 背景パン

  function svgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  svg.addEventListener("pointerdown", e => {
    const g = e.target.closest(".equip-item");
    if (!g) {
      // 空白部分: ドラッグでパン、動かさなければ選択解除
      panning = {
        startX: e.clientX, startY: e.clientY,
        viewX: canvasView.x, viewY: canvasView.y, moved: false,
      };
      try { svg.setPointerCapture(e.pointerId); } catch { /* noop */ }
      svg.style.cursor = "grabbing";
      return;
    }
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
    if (panning) {
      const kx = canvasView.w / svg.clientWidth;
      const ky = canvasView.h / svg.clientHeight;
      const dx = (e.clientX - panning.startX) * kx;
      const dy = (e.clientY - panning.startY) * ky;
      if (Math.abs(dx) + Math.abs(dy) > 2) panning.moved = true;
      canvasView.x = panning.viewX - dx;
      canvasView.y = panning.viewY - dy;
      applyCanvasView();
      return;
    }
    if (!dragging) return;
    const p = svgPoint(e);
    dragging.item.x = Math.max(20, Math.min(980, p.x + dragging.dx));
    dragging.item.y = Math.max(20, Math.min(680, p.y + dragging.dy));
    dragging.moved = true;
    renderCanvas();
  });

  const endDrag = () => {
    if (panning) {
      if (!panning.moved) { state.selectedItem = null; renderCanvas(); renderInspector(); }
      panning = null;
      svg.style.cursor = "";
      return;
    }
    if (dragging && dragging.moved) { renderPreview(); renderPrompt(); renderCutStrip(); renderInspector(); }
    dragging = null;
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
})();

/* =========================================================
 * Canonical Shot JSON エクスポート (CineOS V3 ベンダー中立形式)
 * 座標系は cineos/CLAUDE.md §4 に準拠:
 *   +X=被写体の右 / +Y=被写体の後ろ / -Y=カメラ側 / +Z=上 (SI単位)
 * 俯瞰図 (100px=1m, 被写体(500,330)) から変換する。
 * planned のみを持つ (actual は実撮影で追記する設計)。
 * ======================================================= */
function toWorldM(item) {
  return [
    +((item.x - SUBJECT_POS.x) / 100).toFixed(2),   // +X = 右
    +((SUBJECT_POS.y - item.y) / 100).toFixed(2),   // +Y = 被写体の後ろ (画面上方向)
    +(((item.height || 0) / 100)).toFixed(2),        // +Z = 上
  ];
}

function cutToCanonicalShot(cut, i, projectId) {
  ensureCameraDefaults(cut);
  const cam = cut.items.find(x => x.type === "camera") || CAMERA_POS;
  const sub = cut.items.find(x => x.type === "subject") || SUBJECT_POS;
  const an = analyzeLighting(cut);
  const sup = CAMERA_SUPPORTS.find(s => s.id === cut.camera.support);
  const fxItems = cut.items.filter(x => SFX_SAFETY_CLASS[x.type]);
  const maxSafety = fxItems.reduce((m, x) =>
    SFX_SAFETY_CLASS[x.type] > m ? SFX_SAFETY_CLASS[x.type] : m, "A");

  return {
    shot_id: `${projectId}_SC01_SH${String(i + 1).padStart(3, "0")}`,
    scene_id: `${projectId}_SC01`,
    name: cut.name,
    intent: {
      purpose: cut.aim || "",
      mood: [cut.bgStyle, cut.timeOfDay !== "none" ? cut.timeOfDay : null, cut.weather !== "none" ? cut.weather : null, cut.look !== "natural" ? cut.look : null].filter(Boolean),
    },
    planned: {
      timing: { duration_s: cut.kind === "still" ? null : cut.duration, kind: cut.kind },
      composition: {
        shot_size: cut.camera.shotSize,
        end_shot_size: cut.camera.endShotSize !== "same" ? cut.camera.endShotSize : null,
        angle: cut.camera.angle,
        aspect_ratio: cut.aspect,
      },
      camera: {
        position_m: toWorldM(cam),
        target_m: toWorldM({ ...sub, height: 150 }),
        roll_deg: cut.camera.angle === "dutch" ? 7 : 0,
        body_archetype: cut.camera.body,
        body_sku: state.kit.body || cut.camera.bodySku || null,
        support: { type: cut.camera.support, param: sup && sup.param ? { [sup.param.label]: `${cut.camera.supportParam}${sup.param.unit}` } : null, head: cut.camera.head, support_sku: state.kit.support || cut.camera.supportSku || null },
      },
      lens: {
        focal_length_mm: cut.camera.focalMm,
        aperture_f: cut.camera.apertureF,
        focus_distance_m: cut.camera.focusM,
        anamorphic: cut.camera.lens === "anam",
        lens_sku: state.kit.lens || cut.camera.lensSku || null,
        nd: cut.camera.nd,
        filters: cut.camera.filters,
      },
      exposure: { shutter: cut.camera.shutter, iso: cut.camera.iso, fps: cut.camera.fps, white_balance: cut.camera.wb },
      movement: { type: cut.camera.move, speed: cut.camera.moveSpeed, track_shape: ["dolly", "slider"].includes(cut.camera.support) ? cut.camera.trackShape : null },
      subject: { type: cut.subjectType, action: cut.action, note: cut.subjectNote || null },
      lighting: cut.items
        .filter(x => LIGHT_TYPES.includes(x.type))
        .map(x => ({
          role: x.type, position_m: toWorldM(x),
          power_pct: x.power, color_temp_k: x.colorTemp,
          beam_angle_deg: x.beamAngle, modifier: x.modifier,
          stand: x.stand, watt: x.watt, sku: x.sku || null,
          azimuth_from_camera_axis_deg: Math.round(an.lights.find(l => l.item.id === x.id)?.rel ?? 0),
        })),
      grip: cut.items
        .filter(x => ["reflector", "flag", "diff"].includes(x.type))
        .map(x => ({ type: x.type, position_m: toWorldM(x), modifier: x.modifier })),
      practical_fx: fxItems.map(x => ({
        type: x.type, position_m: toWorldM(x),
        safety_class: SFX_SAFETY_CLASS[x.type],
        specialist_only: SFX_SAFETY_CLASS[x.type] !== "A",
      })),
      fx_options: cut.options,
      environment: { background: cut.bgStyle, weather: cut.weather, time_of_day: cut.timeOfDay },
      audio: cut.kind === "still" ? null : { plan: cut.audio },
      color: { look: cut.look },
      logistics: {
        vehicles: cut.items.filter(x => VEHICLE_TYPES.includes(x.type)).map(x => ({ type: x.type, position_m: toWorldM(x) })),
        power_plan: powerPlan(cut),
        estimated_takes: cut.takes, setup_min: cut.setupMin,
      },
    },
    transition_out: cut.transition,
    edit_decision: cut.kind === "still"
      ? (cut.caption ? { caption: cut.caption } : null)
      : {
        take: cut.take || 1,
        src_in_s: cut.srcInSec || 0,
        audio_edit: cut.audioEdit || "none",
        audio_overlap_s: cut.audioEdit && cut.audioEdit !== "none" ? cut.audioOverlapSec : null,
        caption: cut.caption || "",
      },
    location: locActive(cut) ? (() => {
      const L = cut.location, p = locPreset(cut), s2 = locSunNow(cut);
      return {
        preset_id: L.presetId || null, name: L.name || "", note: L.note || "",
        region: p ? p.region : null, descriptor_en: p ? p.en : "",
        coordinates: L.coords || null, map_url: L.coords ? mapsLink(L.coords.lat, L.coords.lng) : null,
        shoot_date: L.date || null, shoot_time_solar: L.time || null,
        camera_bearing_deg: +L.camBearing || 0,
        sun: s2 ? { azimuth_deg: +s2.azimuth.toFixed(1), elevation_deg: +s2.elevation.toFixed(1) } : null,
        keep_aspects: L.keep,
        photo_traits: L.photoTraits && L.usePhoto !== false
          ? { descriptors_en: L.photoTraits.en, descriptors_ja: L.photoTraits.ja, measured: L.photoTraits.stats } : null,
      };
    })() : null,
    performance: perfActive(cut) ? (() => {
      /* 人の動き — 時間軸のビートと動きの質。カメラ設計とは独立に記録する */
      const p = cut.perf;
      let acc = 0;
      return {
        method: perfMethodOf(cut),
        cast: (p.actors || []).map(a => ({ id: a.id, type: a.type, name: a.name || "", label_en: actorEn(cut, a.id) })),
        people: p.people, contact: p.contact, camera_link: p.camLink,
        motion_quality: { speed: p.speed, care: p.care, toward: p.toward },
        temperature: p.temp,
        beats: p.beats.map(b => {
          const from = acc; acc += +b.sec || 0;
          return {
            in_s: +from.toFixed(1), out_s: +acc.toFixed(1), duration_s: +b.sec || 0,
            actor_id: b.who || null, actor: b.who ? actorEn(cut, b.who) : null,
            action: b.do || "", gaze: b.gaze, camera: b.cam,
          };
        }),
        preserve: p.preserve, change: p.change,
      };
    })() : null,
    first_frame_ref: (() => {
      const r = cut.refImgId && state.story && state.story.refs
        ? state.story.refs.find(x => x.id === cut.refImgId) : null;
      return r ? { name: r.name, has_alpha: !!r.hasAlpha } : null;
    })(),
    feasibility_flags: evaluateFeasibility(cut).map(w => ({ level: w.lv, message: w.t })),
    safety_classification: maxSafety,
    equipment_capabilities: recommendForCut(cut).map(r => ({ role: r.role, need: r.need, example_skus: r.examples })),
    prompt_fragments: { seedance: generatePrompt(cut, "seedance"), generic: generatePrompt(cut, "generic") },
    ai_generation_runs: [],
  };
}

function exportCanonicalJSON() {
  const projectId = "PRJ_" + (state.projectTitle === "無題プロジェクト" ? "UNTITLED" : state.projectTitle.replace(/\W+/g, "_").toUpperCase()).slice(0, 24);
  const doc = {
    schema: "cineos.canonical_shot_list/v1-lite",
    generator: "Virtual Studio",
    coordinate_convention: "+X=subject right, +Y=behind subject, -Y=camera side, +Z=up, meters",
    project_id: projectId,
    story_text: state.story.text || "",
    shots: state.cuts.map((c, i) => cutToCanonicalShot(c, i, projectId)),
  };
  saveFileAs("canonical-shots.json", JSON.stringify(doc, null, 2));
}

function exportJSON() {
  saveFileAs("virtual-studio-project.json", JSON.stringify({ version: 1, ...state }, null, 2));
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      // canonical shot list はインポート経路を分岐 (書き出しとの往復対応)
      if (data.schema && String(data.schema).startsWith("cineos.canonical_shot_list")) {
        importCanonical(data);
        return;
      }
      if (!Array.isArray(data.cuts) || !data.cuts.length) throw new Error("cuts がありません");
      state.mode = data.mode || "video";
      state.cuts = data.cuts.map(ensureCameraDefaults); // 旧バージョンのJSONに詳細フィールドを補完
      state.customPresets = Array.isArray(data.customPresets) ? data.customPresets : [];
      state.kit = Object.assign({ body: null, lens: null, support: null, drone: null }, data.kit || {});
      state.promptModel = data.promptModel || state.promptModel;
      const pmSel = byId("promptModelSelect");
      if (pmSel) pmSel.value = state.promptModel;
      state.activeCut = Math.min(data.activeCut || 0, state.cuts.length - 1);
      state.selectedItem = null;
      state.projectTitle = data.projectTitle || state.projectTitle;
      document.querySelectorAll(".mode-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
      renderAll();
    } catch (err) {
      showToast("⚠️ 読み込みに失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* =========================================================
 * プロジェクトマネージャー (ブラウザ内保存・切替・自動保存)
 * localStorage: vsProjects = {id: {id,title,updated,data}} / vsCurrent = 作業中
 * ======================================================= */
const LS_PROJECTS = "vsProjects", LS_CURRENT = "vsCurrent";

function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

function snapshotState() {
  return JSON.parse(JSON.stringify({
    mode: state.mode, cuts: state.cuts, activeCut: state.activeCut,
    projectTitle: state.projectTitle, projectId: state.projectId || null,
    promptModel: state.promptModel, customPresets: state.customPresets,
    kit: state.kit, customDNA: state.customDNA, story: state.story,
  }));
}

function applySnapshot(s) {
  state.mode = s.mode || "video";
  state.cuts = (s.cuts || []).map(ensureCameraDefaults);
  if (!state.cuts.length) state.cuts = [makeCut(allPresets().find(p => p.id === "three-point"))];
  state.activeCut = Math.min(s.activeCut || 0, state.cuts.length - 1);
  state.selectedItem = null;
  state.projectTitle = s.projectTitle || "無題プロジェクト";
  state.projectId = s.projectId || null;
  state.promptModel = s.promptModel || "seedance";
  state.customPresets = Array.isArray(s.customPresets) ? s.customPresets : [];
  state.kit = Object.assign({ body: null, lens: null, support: null, drone: null }, s.kit || {});
  state.customDNA = Array.isArray(s.customDNA) ? s.customDNA : [];
  state.story = s.story && typeof s.story === "object"
    ? { text: s.story.text || "", refs: Array.isArray(s.story.refs) ? s.story.refs : [] }
    : { text: "", refs: [] };
  state.story.audioVol = Object.assign({ bgm: 0.4, nar: 1 }, s.story && s.story.audioVol || {});
  state.story.audio = Object.assign({}, s.story && s.story.audio || {});
  // 旧形式 (ref.assign = cutId) からの移行: カット側ポインタに変換
  state.story.refs.forEach(r => {
    if (r.assign) {
      const c = state.cuts.find(c2 => c2.id === r.assign);
      if (c && !c.refImgId) c.refImgId = r.id;
    }
  });
  document.querySelectorAll(".mode-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));
  const pm = byId("promptModelSelect");
  if (pm && pm.options.length) pm.value = state.promptModel;
  renderAll();
  /* 参照画像の本体はIDBにあるので、まずサムネで描いてから差し替える */
  if (state.story.refs.some(r => r.clipId && !refFull.has(r.id))) setTimeout(refLoadAll, 0);
}

/* 自動保存 (3秒ごと・変化時のみ) */
let lastAutosave = "";
let autosaveFailNotified = false;
function startAutosave() {
  setInterval(() => {
    const snap = JSON.stringify(snapshotState());
    if (snap !== lastAutosave) {
      lastAutosave = snap;
      const ok = lsSet(LS_CURRENT, JSON.parse(snap));
      if (!ok && !autosaveFailNotified) {
        autosaveFailNotified = true; // 直るまで繰り返し出さない
        showToast("⚠️ 自動保存に失敗しました — ブラウザ保存容量が不足しています。プロジェクトページで容量を確認し、不要な参照画像や保存済みプロジェクトを削除してください", true);
      } else if (ok && autosaveFailNotified) {
        autosaveFailNotified = false;
        showToast("✓ 自動保存が復帰しました");
      }
    }
  }, 3000);
}

/* =========================================================
 * メディアGC — どのプロジェクトからも参照されない添付動画/音声を
 * IndexedDBから削除する (起動時・ストーリー完了時・プロジェクト削除時)。
 * 現在編集中(state)・自動保存(vsCurrent)・全保存プロジェクトを生存扱い
 * にするため、削除直後でもUndo可能な間はクリップが残る。
 * ======================================================= */
async function gcMediaClips() {
  try {
    const valid = new Set(Object.values(RC_AUDIO_LEGACY));
    const addSnap = snap => {
      (snap?.cuts || []).forEach(c => valid.add(c.id));
      Object.values(snap?.story?.audio || {}).forEach(k => valid.add(k));
      (snap?.story?.refs || []).forEach(r => { if (r.clipId) valid.add(r.clipId); });
    };
    addSnap(state);
    addSnap(lsGet(LS_CURRENT, null));
    Object.values(lsGet(LS_PROJECTS, {})).forEach(p => addSnap(p.data));
    let removed = 0;
    for (const clip of await idbAllClips()) {
      if (valid.has(clip.cutId)) continue;
      await idbDelClip(clip.cutId);
      if (roughCut.urls[clip.cutId]) {
        URL.revokeObjectURL(roughCut.urls[clip.cutId]);
        delete roughCut.urls[clip.cutId];
      }
      removed++;
    }
    if (removed) rcRefreshIndex();
    return removed;
  } catch {
    return 0;
  }
}

/* ストレージ使用量メーター (プロジェクトページ) */
async function renderStorageMeter() {
  const el = byId("storageMeter");
  if (!el) return;
  /* localStorageの上限は「文字数 (UTF-16単位)」で数えられ、一般的に約5M文字。
   * バイト換算 (×2) で数えると使用率を2倍に見積もってしまうので文字数で数える */
  let lsUnits = 0;
  try { for (const k of Object.keys(localStorage)) lsUnits += k.length + (localStorage.getItem(k) || "").length; } catch { /* 権限なし */ }
  const LS_LIMIT = 5 * 1024 * 1024; // 目安。実際の上限はブラウザにより異なる
  const pct = Math.min(100, lsUnits / LS_LIMIT * 100);
  let idbNote = "";
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const free = est.quota ? ` (空き目安 ${((est.quota - est.usage) / 1073741824).toFixed(1)}GB)` : "";
      idbNote = ` ｜ 画像/動画/音声 ${(est.usage / 1048576).toFixed(1)}MB${free}`;
    }
  } catch { /* 未対応ブラウザ */ }
  el.innerHTML = `
    <div class="sm-bar" title="ブラウザ内保存 (localStorage) の使用量 — 設定・カット・保存プロジェクトが対象。上限は一般的に約5MBでブラウザにより異なります。参照画像の本体・動画・音声はIndexedDBに別枠で保存されます (localStorageにはサムネだけ)"><div class="sm-fill${pct > 80 ? " warn" : ""}" style="width:${pct.toFixed(1)}%"></div></div>
    <span class="sm-label">設定/カット ${(lsUnits / 1048576).toFixed(2)}MB / 目安5MB${idbNote}</span>`;
}

function saveCurrentProject() {
  const title = byId("projName").value.trim() || "無題プロジェクト";
  state.projectTitle = title;
  if (!state.projectId) state.projectId = "p" + Date.now();
  const all = lsGet(LS_PROJECTS, {});
  all[state.projectId] = { id: state.projectId, title, updated: Date.now(), data: snapshotState() };
  const ok = lsSet(LS_PROJECTS, all);
  byId("projSavedMsg").textContent = ok ? `✓ 保存しました (${new Date().toLocaleTimeString("ja-JP")})` : "⚠️ ブラウザ保存が使えない環境です (JSONで書き出してください)";
  renderProjPage();
}

function renderProjPage() {
  renderStorageMeter();
  const all = lsGet(LS_PROJECTS, {});
  const list = Object.values(all).sort((a, b) => b.updated - a.updated);
  byId("projName").value = state.projectTitle;
  byId("projStorageNote").textContent = `保存: ${list.length}件 (このブラウザ内)`;
  byId("projGrid").innerHTML = list.map(p => {
    const firstCut = p.data?.cuts?.[0];
    const thumb = firstCut ? renderPreviewSVG(ensureCameraDefaults(JSON.parse(JSON.stringify(firstCut))), "pj" + p.id) : "";
    return `
    <div class="proj-card ${p.id === state.projectId ? "current" : ""}">
      <div class="p-thumb">${thumb}</div>
      <div class="p-body">
        <div class="p-title">${esc(p.title)}${p.id === state.projectId ? " <small>(編集中)</small>" : ""}</div>
        <div class="p-meta">カット ${p.data?.cuts?.length ?? 0} ｜ 更新 ${new Date(p.updated).toLocaleString("ja-JP")}</div>
      </div>
      <div class="p-actions">
        <button class="btn small" data-open="${esc(p.id)}">開く</button>
        <button class="btn small ghost" data-dup="${esc(p.id)}">複製</button>
        <button class="btn small ghost danger" data-del="${esc(p.id)}">削除</button>
      </div>
    </div>`;
  }).join("") || `<div class="insp-hint" style="padding:8px">まだ保存されたプロジェクトがありません。「保存」で現在の作業を名前を付けて保存できます。</div>`;

  const grid = byId("projGrid");
  grid.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => {
    const p = lsGet(LS_PROJECTS, {})[b.dataset.open];
    if (!p) return;
    applySnapshot({ ...p.data, projectId: p.id, projectTitle: p.title });
    byId("projOverlay").hidden = true;
  }));
  grid.querySelectorAll("[data-dup]").forEach(b => b.addEventListener("click", () => {
    const all2 = lsGet(LS_PROJECTS, {});
    const src = all2[b.dataset.dup];
    if (!src) return;
    const id = "p" + Date.now();
    all2[id] = { id, title: src.title + " のコピー", updated: Date.now(), data: JSON.parse(JSON.stringify(src.data)) };
    all2[id].data.projectId = id;
    lsSet(LS_PROJECTS, all2);
    renderProjPage();
  }));
  grid.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
    const all2 = lsGet(LS_PROJECTS, {});
    if (!confirm(`「${all2[b.dataset.del]?.title}」を削除しますか?`)) return;
    setTimeout(gcMediaClips, 500); // 参照が消えた添付メディアを回収
    delete all2[b.dataset.del];
    lsSet(LS_PROJECTS, all2);
    if (state.projectId === b.dataset.del) state.projectId = null;
    renderProjPage();
  }));
}

function setupProjects() {
  byId("btnProjPage").addEventListener("click", () => {
    byId("projSavedMsg").textContent = "";
    byId("projOverlay").hidden = false;
    renderProjPage();
  });
  byId("btnProjBack").addEventListener("click", () => { byId("projOverlay").hidden = true; });
  byId("btnProjSave").addEventListener("click", saveCurrentProject);
  byId("btnProjBackup").addEventListener("click", () => {
    exportBackupZip(byId("projSavedMsg")).catch(err => { byId("projSavedMsg").textContent = "⚠️ " + err.message; });
  });
  byId("btnProjRestore").addEventListener("click", () => byId("projRestoreInput").click());
  byId("projRestoreInput").addEventListener("change", e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("バックアップZIPから復元しますか?\n(現在の作業はこの内容で置き換わります。自動保存には残ります)")) return;
    importBackupZip(file, byId("projSavedMsg")).then(() => renderProjPage())
      .catch(err => { byId("projSavedMsg").textContent = "⚠️ " + err.message; });
  });
  byId("projName").addEventListener("keydown", e => { if (e.key === "Enter") saveCurrentProject(); });
  byId("btnProjNew").addEventListener("click", () => {
    if (!confirm("新規プロジェクトを開始しますか? (現在の作業は自動保存に残ります。名前を付けて保存していない変更は失われます)")) return;
    applySnapshot({
      mode: "video", projectTitle: "無題プロジェクト", projectId: null,
      cuts: [makeCut(allPresets().find(p => p.id === "three-point"))],
    });
    byId("projOverlay").hidden = true;
  });
}

/* =========================================================
 * パフォーマンス: プレビューSVGのキャッシュ
 * 参照画像 (base64) を埋め込むSVGの再構築は重いので、
 * カット内容が変わらない限り文字列を再利用する。
 * ======================================================= */
const previewCache = new Map();
function renderPreviewCached(cut, prefix) {
  const ref = cut.refImgId && state.story && state.story.refs
    ? state.story.refs.find(r => r.id === cut.refImgId) : null;
  const key = JSON.stringify(cut) + "|" + (ref ? `${ref.id}:${refUrl(ref).length}` : "") + "|" + prefix;
  const slot = `${cut.id}|${prefix}`;
  const hit = previewCache.get(slot);
  if (hit && hit.key === key) return hit.svg;
  const svg = renderPreviewSVG(cut, prefix);
  if (previewCache.size > 80) previewCache.clear(); // 際限なく貯めない
  previewCache.set(slot, { key, svg });
  return svg;
}

/* =========================================================
 * サンプルプロジェクト (初回起動用) — 画像もコードで生成する
 * ======================================================= */
function makeSampleStreetImage() {
  const cv = document.createElement("canvas");
  cv.width = 768; cv.height = 432;
  const g = cv.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, "#3a2a55");
  sky.addColorStop(0.55, "#c75b39");
  sky.addColorStop(1, "#f5a54a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 768, 300);
  g.fillStyle = "#ffe9b0";
  g.beginPath(); g.arc(520, 258, 34, 0, 7); g.fill();
  g.fillStyle = "rgba(255,210,120,0.35)";
  g.beginPath(); g.arc(520, 258, 62, 0, 7); g.fill();
  // スカイライン
  g.fillStyle = "#241a30";
  const bl = [[0, 190, 90, 110], [80, 160, 70, 140], [160, 210, 60, 90], [230, 150, 80, 150], [320, 195, 66, 105], [598, 170, 76, 130], [686, 200, 82, 100], [420, 205, 70, 95]];
  bl.forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  // 路面 (反射)
  const rd = g.createLinearGradient(0, 300, 0, 432);
  rd.addColorStop(0, "#3a2f42");
  rd.addColorStop(1, "#191320");
  g.fillStyle = rd;
  g.fillRect(0, 300, 768, 132);
  g.fillStyle = "rgba(245,165,74,0.28)";
  g.fillRect(492, 300, 56, 132);
  return cv.toDataURL("image/jpeg", 0.85);
}

function makeSampleHeroineImage() {
  const cv = document.createElement("canvas");
  cv.width = 400; cv.height = 520; // 背景透過 (被写体合成のデモ用)
  const g = cv.getContext("2d");
  g.fillStyle = "#caa287";
  g.beginPath(); g.arc(200, 120, 62, 0, 7); g.fill();          // 顔
  g.fillStyle = "#43301f";
  g.beginPath(); g.arc(200, 96, 66, Math.PI, 0); g.fill();     // 髪
  g.fillRect(134, 96, 18, 120); g.fillRect(248, 96, 18, 120);  // サイドの髪
  g.fillStyle = "#2a2e36";
  g.beginPath(); g.arc(176, 122, 6, 0, 7); g.arc(224, 122, 6, 0, 7); g.fill(); // 目
  g.fillStyle = "#8a3d4d";
  g.fillRect(150, 190, 100, 40);                               // 首元
  const coat = g.createLinearGradient(0, 200, 0, 520);
  coat.addColorStop(0, "#7d3646");
  coat.addColorStop(1, "#4c1f2e");
  g.fillStyle = coat;
  g.beginPath();
  g.moveTo(120, 240); g.quadraticCurveTo(200, 196, 280, 240);
  g.lineTo(300, 520); g.lineTo(100, 520); g.closePath(); g.fill(); // コート
  return cv.toDataURL("image/png");
}

function loadSampleProject() {
  const refStreet = { id: uid(), name: "sample-street.jpg", dataUrl: makeSampleStreetImage(), hasAlpha: false };
  const refHeroine = { id: uid(), name: "sample-heroine.png", dataUrl: makeSampleHeroineImage(), hasAlpha: true };
  const mk = (pid, patch, cam) => {
    const c = makeCut(allPresets().find(p => p.id === pid));
    Object.assign(c, patch || {});
    Object.assign(c.camera, cam || {});
    return c;
  };
  /* サンプルは新しい層 (ロケ地・演出ビート) も一通り使った状態にする */
  const sampleLoc = {
    presetId: "jp-alley", name: "夕暮れの路地",
    coords: { lat: 35.6936, lng: 139.7047 },
    date: new Date().toISOString().slice(0, 10), time: "17:30", camBearing: 270,
    note: "私道のため店舗ごとに許可を取る",
    keep: LOCATION_ASPECTS.map(a => a.id),
  };
  const cuts = [
    mk("three-point", {
      name: "夕暮れの街 (状況説明)", aim: "シーンの地理と時間帯を見せるエスタブリッシング。",
      refImgId: refStreet.id, duration: 5, transition: "dissolve", bgStyle: "sunset", timeOfDay: "golden",
      location: { ...sampleLoc },
    }, { shotSize: "LS", move: "fix", focalMm: 24, lens: "24" }),
    mk("loop", {
      name: "ヒロイン、歩き出す", aim: "決意して歩き出す姿。街の光を背負う。",
      refImgId: refHeroine.id, duration: 4, transition: "cut", action: "walk", bgStyle: "sunset",
      caption: "「行かなきゃ。」",
      location: { ...sampleLoc },
      perf: {
        actors: [{ id: "sa1", type: "person", name: "ヒロイン" }],
        beats: [
          { id: "sb1", sec: 2, who: "sa1", do: "立ち止まったまま息を整える", gaze: "away", cam: "none" },
          { id: "sb2", sec: 2, who: "sa1", do: "顔を上げて歩き出す", gaze: "ahead", cam: "follow" },
        ],
        speed: "moderate", care: "natural", toward: "alone", temp: "observed",
        people: 1, contact: "none", camLink: "follow", method: "auto",
        preserve: [], change: [], unfit: [],
      },
    }, { shotSize: "BS", move: "track" }),
    mk("rembrandt", {
      name: "ふり返る", aim: "感情の転換点。浅い被写界深度で表情に寄る。",
      refImgId: refHeroine.id, duration: 4, transition: "fadeout", action: "turn", look: "filmwarm",
    }, { shotSize: "CU", move: "dollyin", moveSpeed: "slow", apertureF: 1.8, aperture: "F1.8" }),
    mk("backlight-silhouette", {
      name: "シルエットで決める", aim: "夕陽を背にしたシルエットで余韻を残すラストカット。",
      refImgId: refHeroine.id, duration: 5, bgStyle: "sunset",
    }, { shotSize: "FF", move: "fix", angle: "low" }),
  ];
  applySnapshot({
    mode: "video",
    projectTitle: "サンプル: 夕暮れのヒロイン",
    cuts,
    activeCut: 0,
    story: {
      text: "夕暮れの街。ビルの谷間に金色の光が沈んでいく。\nヒロインは意を決して歩き出す。\nふと立ち止まり、ゆっくりふり返る。\n最後は夕陽を背にしたシルエットで。",
      refs: [refStreet, refHeroine],
      audioVol: { bgm: 0.4, nar: 1 },
    },
  });
  refIngest(state.story.refs).then(n => { if (n) refreshAllPreviews(); }); // 本体をIDBへ寄せる
}

/* =========================================================
 * オンボーディング: ようこそ画面 + スポットライトツアー
 * ======================================================= */
const TOUR_STEPS = [
  { el: "#libraryPanel", title: "1. 技法ライブラリ", body: "86の撮影技法プリセット。クリックすると照明・カメラ・機材がまるごとカットに適用されます。★でお気に入り、よく使う技法は先頭に固定されます。" },
  { el: "#canvasWrap", title: "2. スタジオ俯瞰図", body: "灯体や機材をドラッグで配置。上のトグルで3Dビュー/カメラPOVにも切り替えられます。配置は右のプレビューに即反映されます。" },
  { el: "#previewWrap", title: "3. 想定カット", body: "ライティング解析の結果 (キーの方向・コントラスト・リム) を反映したプレビュー。参照画像を割り当てると実画像に技法の効果が乗ります。▶でカメラワークも再生できます。" },
  { el: "#rightPanel", title: "4. インスペクタ", body: "カメラボディ・レンズ・絞り・尺・テロップ・編集 (テイク/イン点) まで全てここで微調整。下にはAIプロンプトが常に自動生成されています。" },
  { el: "#storyboard", title: "5. カット割りとタイムライン", body: "カバレッジ充足チップ (⚠クリックで自動補完)、尺タイムライン (右端ドラッグでトリム・ブロックドラッグで並べ替え)、カット間の繋ぎ表示。", },
  { el: "#intentInput", title: "6. 言葉からカット設計", body: "「夜の雨の街を走る。35mmで緊張感」のように書いて設計ボタンを押すと、IntentParserがカットを自動設計します。複文なら複数カットに分解されます。" },
  { el: "#btnScriptPage", title: "7. 台本・コンテ (演出)", body: "「何が起きるか」はここで設計します — セリフ、登場要素 (人物だけでなく車両・動物・群衆も)、時間軸のビート、そしてロケ地。ロケ地は国・地域別のライブラリから選べ、Google Mapsの座標を貼ると太陽の方位・高度・ゴールデンアワーまで計算してスタジオの太陽に反映できます。カメラ設定はスタジオ側の担当です。" },
  { el: "#btnFlowPage", title: "8. 制作ワークフロー", body: "画像+ストーリーの受け入れ→カット設計→Seedanceへの書き出し→生成動画のラフカット編集 (BGM/ナレーション/字幕付き) まで、制作ループ全体をここで回します。" },
  { el: "#btnExportDoc", title: "9. 書き出し", body: "撮影指示書・絵コンテ・香盤表・DMX・編集リスト (EDL)・プロンプト一式MD・画像ZIP。最終編集は編集ソフトへ、このアプリはその手前の全部を担当します。ショートカットは ? キーで。" },
];
let tourIdx = 0;

function tourShow(i) {
  const step = TOUR_STEPS[i];
  const el = document.querySelector(step.el);
  if (!el) { tourNext(1); return; } // 見つからないステップは飛ばす
  tourIdx = i;
  byId("tourWrap").hidden = false;
  el.scrollIntoView({ block: "nearest", behavior: "instant" });
  const r = el.getBoundingClientRect();
  const hole = byId("tourHole");
  const pad = 6;
  Object.assign(hole.style, {
    left: `${Math.max(0, r.left - pad)}px`,
    top: `${Math.max(0, r.top - pad)}px`,
    width: `${Math.min(window.innerWidth, r.width + pad * 2)}px`,
    height: `${Math.min(window.innerHeight, r.height + pad * 2)}px`,
  });
  byId("tourTitle").textContent = step.title;
  byId("tourBody").textContent = step.body;
  byId("tourStep").textContent = `${i + 1} / ${TOUR_STEPS.length}`;
  byId("btnTourPrev").disabled = i === 0;
  byId("btnTourNext").textContent = i === TOUR_STEPS.length - 1 ? "完了" : "次へ";
  // カードは対象の下、入らなければ上に
  const card = byId("tourCard");
  card.style.visibility = "hidden";
  requestAnimationFrame(() => {
    const ch = card.offsetHeight, cw = card.offsetWidth;
    let top = r.bottom + 14;
    if (top + ch > window.innerHeight - 10) top = Math.max(10, r.top - ch - 14);
    let left = Math.max(10, Math.min(window.innerWidth - cw - 10, r.left + r.width / 2 - cw / 2));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.visibility = "visible";
  });
}

function tourNext(dir) {
  const n = tourIdx + dir;
  if (n < 0) return;
  if (n >= TOUR_STEPS.length) { tourEnd(); return; }
  tourShow(n);
}

function tourEnd() {
  byId("tourWrap").hidden = true;
  lsSet("vsTourDone", true);
}

function startTour() {
  byId("kbdHelp").hidden = true;
  ["equipOverlay", "docOverlay", "projOverlay", "dnaOverlay", "wfOverlay", "scriptOverlay", "locOverlay"].forEach(id => { byId(id).hidden = true; });
  tourShow(0);
}

function setupOnboarding() {
  byId("btnWelSample").addEventListener("click", () => {
    byId("welcome").hidden = true;
    loadSampleProject();
    startTour();
  });
  byId("btnWelEmpty").addEventListener("click", () => {
    byId("welcome").hidden = true;
    lsSet("vsTourDone", true);
  });
  byId("btnTourNext").addEventListener("click", () => tourNext(1));
  byId("btnTourPrev").addEventListener("click", () => tourNext(-1));
  byId("btnTourSkip").addEventListener("click", tourEnd);
  byId("btnTourAgain").addEventListener("click", startTour);
  /* ウィンドウリサイズでスポットライトとカードを引き直す (回転・分割表示対応) */
  let tourResizeTimer = null;
  window.addEventListener("resize", () => {
    if (byId("tourWrap").hidden) return;
    clearTimeout(tourResizeTimer);
    tourResizeTimer = setTimeout(() => { if (!byId("tourWrap").hidden) tourShow(tourIdx); }, 150);
  });
}

/* =========================================================
 * アクセシビリティ: オーバーレイのフォーカストラップと
 * 開閉時のフォーカス移動 (hidden属性の変化を監視して汎用対応)
 * ======================================================= */
function setupA11y() {
  /* [href] ではSVGの <use href="#icon"> まで拾ってしまう (フォーカスできない要素が
   * 末尾に来るとトラップが効かなくなる) ので、リンクは a[href] に限定する */
  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  ["equipOverlay", "docOverlay", "projOverlay", "dnaOverlay", "wfOverlay", "scriptOverlay", "locOverlay", "welcome"].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("keydown", e => {
      if (e.key !== "Tab") return;
      const f = [...el.querySelectorAll(FOCUSABLE)].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    let opener = null;
    new MutationObserver(() => {
      if (!el.hidden) {
        opener = document.activeElement;
        const target = el.querySelector(FOCUSABLE);
        if (target) target.focus();
      } else if (opener && document.contains(opener)) {
        opener.focus();
        opener = null;
      }
    }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
  });
}

/* =========================================================
 * キーボードショートカット
 *   Space=再生/停止 (WF中はラフカット) / ←→=カット選択 /
 *   1-8=カットサイズ / ?=ヘルプ / Esc=閉じる (既存)
 * ======================================================= */
function setupShortcuts() {
  byId("btnKbdClose").addEventListener("click", () => { byId("kbdHelp").hidden = true; });
  document.addEventListener("keydown", e => {
    /* ツアー表示中: 矢印で前後、Escで終了 */
    if (!byId("tourWrap").hidden) {
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); tourNext(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); tourNext(-1); return; }
      if (e.key === "Escape") { e.preventDefault(); tourEnd(); return; }
    }
    /* Undo / Redo (入力欄ではブラウザ既定に任せる) */
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "z" || e.key === "Z")) {
      if (e.target.matches("input, textarea")) return;
      e.preventDefault();
      if (e.shiftKey) doRedo(); else doUndo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "y" || e.key === "Y")) {
      if (e.target.matches("input, textarea")) return;
      e.preventDefault();
      doRedo();
      return;
    }
    if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    const wfOpen = !byId("wfOverlay").hidden;
    const otherOverlay = ["equipOverlay", "docOverlay", "projOverlay", "dnaOverlay", "scriptOverlay", "locOverlay"].some(id => !byId(id).hidden);

    if (e.key === "?") {
      e.preventDefault();
      byId("kbdHelp").hidden = !byId("kbdHelp").hidden;
      return;
    }
    if (e.key === "Escape") {
      if (!byId("kbdHelp").hidden) { byId("kbdHelp").hidden = true; return; }
      /* 前面 (後から開いたもの) から閉じる */
      for (const id of ["locOverlay", "scriptOverlay", "wfOverlay", "docOverlay", "equipOverlay", "dnaOverlay", "projOverlay"]) {
        if (!byId(id).hidden) { byId(id).hidden = true; return; }
      }
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (wfOpen) {
        if (roughCut.playing) roughCut.stopFlag = true;
        else rcRun(false);
      } else if (!otherOverlay) {
        byId("btnPlayPreview").click();
      }
      return;
    }
    if (wfOpen || otherOverlay) return;

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = state.activeCut + (e.key === "ArrowRight" ? 1 : -1);
      if (next < 0 || next >= state.cuts.length) return;
      state.activeCut = next;
      state.selectedItem = null;
      renderAll();
    } else if (/^[1-8]$/.test(e.key)) {
      const size = SHOT_SIZES[+e.key - 1];
      if (!size) return;
      activeCut().camera.shotSize = size.id;
      refresh();
      renderInspector();
    }
  });
}

/* =========================================================
 * Pattern DNA ページ (CineOS V8 Phase 1: 検索・適用・ミキサー)
 * ======================================================= */
const dnaSel = { a: null, b: null };

/* ---------- Phase 5-lite: パターン性能トラッキング (§26) ---------- */
function dnaPerf() { return lsGet("vsDnaPerf", {}); }
function bumpPerf(id, key) {
  const p = dnaPerf();
  p[id] = p[id] || { applied: 0, up: 0, down: 0 };
  p[id][key]++;
  lsSet("vsDnaPerf", p);
}

/* ---------- Phase 3-lite: プロジェクトからのDNA自動抽出 (推定値マーク付き §4) ---------- */
function extractProjectDNA() {
  const cuts = state.cuts;
  if (!cuts.length) return null;
  const most = (arr) => {
    const m = {};
    arr.filter(v => v != null).forEach(v => m[v] = (m[v] || 0) + 1);
    const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    return e ? e[0] : null;
  };
  const durs = cuts.filter(c => c.kind !== "still").map(c => c.duration || 5);
  const avgDur = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 5;
  const focals = cuts.map(c => c.camera.focalMm);
  const mn = Math.min(...focals), mx = Math.max(...focals);
  const analyses = cuts.map(c => analyzeLighting(c));
  const avgContrast = analyses.reduce((a, x) => a + x.contrast, 0) / analyses.length;
  const avgRim = analyses.reduce((a, x) => a + x.rimPower, 0) / analyses.length;
  const rep = cuts.slice().sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
  const P = buildPromptParts(rep);
  const apertures = cuts.map(c => c.camera.apertureF).sort((a, b) => a - b);
  return {
    id: "proj-" + Date.now(),
    name: `${state.projectTitle} のDNA (自動抽出)`,
    family: "プロジェクト抽出",
    keywords: [state.projectTitle],
    why: `現在の${cuts.length}カットから自動抽出した推定値。平均尺${avgDur.toFixed(1)}s / レンズ${mn}-${mx}mm / コントラスト${avgContrast > 0.7 ? "高" : avgContrast > 0.35 ? "中" : "低"} / リム${avgRim > 40 ? "強め" : "控えめ"} / 主なムーブ: ${most(cuts.map(c => c.camera.move))}`,
    dims: {
      editorial: { durationMul: Math.max(0.4, Math.min(2, avgDur / 5)), transition: most(cuts.map(c => c.transition)) || "cut", pace: "抽出値" },
      camera: { focal: [mn, mx], aperture: apertures[Math.floor(apertures.length / 2)] },
      lighting: {
        fillScale: avgContrast > 0.7 ? 0.35 : avgContrast > 0.35 ? 0.7 : 1.3,
        rimBoost: avgRim > 40 ? 1.4 : 1.0,
        contrast: avgContrast > 0.7 ? "高" : avgContrast > 0.35 ? "中" : "低",
      },
      color: { look: most(cuts.map(c => c.look)) || "natural" },
      movement: { moveSpeed: most(cuts.map(c => c.camera.moveSpeed)) || "normal", prefMove: most(cuts.map(c => c.camera.move).filter(m => m !== "fix")) },
    },
    tokens: [P.lightStr.split(", ")[0], P.bgEn].filter(Boolean),
    avoid: [],
    provenance: {
      source: state.projectTitle, source_type: "cineos_project",
      extraction_method: "auto_from_project", annotator: "model",
      confidence: "estimate", // §4: 推定値は推定値と明示する
      date: new Date().toISOString().slice(0, 10),
    },
  };
}
/* =========================================================
 * Phase 3 ステップ1: 参照メディア (画像/動画) からのDNA抽出
 * ブラウザ内解析のみ — ファイルはどこにも送信されない。
 * 輝度分布/コントラスト/色温度/彩度、動画はさらに
 * フレーム差分によるカット検出 (平均ショット尺) とモーション量を推定する。
 * ======================================================= */
function frameStats(cx, w, h) {
  const d = cx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const lums = new Float32Array(n);
  let rSum = 0, bSum = 0, satSum = 0;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
    rSum += r; bSum += b;
    /* 彩度は絶対クロマ (max-min)。相対彩度は暗部ノイズで暴れるため使わない */
    satSum += Math.max(r, g, b) - Math.min(r, g, b);
    lums[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const sorted = Float32Array.from(lums).sort();
  const pct = q => sorted[Math.min(n - 1, Math.floor(q * n))];
  let mean = 0;
  for (let i = 0; i < n; i++) mean += lums[i];
  return {
    mean: mean / n,
    contrast: pct(0.95) - pct(0.05),   // 輝度レンジ (0-1)
    warmth: (rSum - bSum) / n,         // 正=暖色寄り / 負=寒色寄り
    sat: satSum / n,
    lums,
  };
}

function lumaDiff(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

async function extractMediaDNA(file) {
  const isVideo = (file.type || "").startsWith("video");
  const W = 96, H = 54;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const frames = [];
  let avgShotSec = null, motion = 0, shotCount = 1, videoDur = 0;

  if (isVideo) {
    const url = URL.createObjectURL(file);
    try {
      const v = document.createElement("video");
      v.muted = true; v.preload = "auto"; v.src = url;
      await new Promise((res, rej) => {
        v.onloadedmetadata = res;
        v.onerror = () => rej(new Error("動画を読み込めませんでした (ブラウザ非対応のコーデックの可能性)"));
      });
      videoDur = Math.min(v.duration || 10, 180);
      const N = Math.min(24, Math.max(8, Math.round(videoDur)));
      let prev = null, cutsDetected = 0;
      const moves = [];
      for (let k = 0; k < N; k++) {
        await new Promise(res => { v.onseeked = res; v.currentTime = (videoDur * (k + 0.5)) / N; });
        cx.drawImage(v, 0, 0, W, H);
        const st = frameStats(cx, W, H);
        frames.push(st);
        if (prev) {
          const df = lumaDiff(prev.lums, st.lums);
          if (df > 0.18) cutsDetected++;   // 大きな画変わり=カット点とみなす
          else moves.push(df);              // 同ショット内の変化=モーション量
        }
        prev = st;
      }
      motion = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : 0;
      shotCount = cutsDetected + 1;
      avgShotSec = videoDur / shotCount;
    } finally { URL.revokeObjectURL(url); }
  } else {
    const bmp = await createImageBitmap(file);
    cx.drawImage(bmp, 0, 0, W, H);
    frames.push(frameStats(cx, W, H));
  }

  const avg = k => frames.reduce((a, f) => a + f[k], 0) / frames.length;
  const meanLum = avg("mean"), contrast = avg("contrast"), warmth = avg("warmth"), sat = avg("sat");

  /* 解析値 → 撮影変数へのマッピング (すべて推定値) */
  /* 色被り (暖/寒) は彩度の高低より優先して判定する */
  const look = sat < 0.02 ? "mono" : sat < 0.06 ? "bleach"
    : warmth > 0.06 ? "filmwarm" : warmth < -0.05 ? "tealorange"
    : sat > 0.28 ? "vivid" : "natural";
  const fillScale = meanLum > 0.6 ? 1.3 : meanLum < 0.32 ? 0.35 : contrast > 0.6 ? 0.7 : 1.0;
  const contrastLabel = contrast > 0.65 ? "高" : contrast > 0.4 ? "中" : "低";
  const keyLabel = meanLum > 0.6 ? "ハイキー" : meanLum < 0.32 ? "ローキー" : "ミドルキー";
  const moveSpeed = !isVideo ? "normal"
    : motion > 0.09 ? "fast" : motion > 0.045 ? "normal" : motion > 0.015 ? "slow" : "veryslow";
  const durationMul = avgShotSec != null ? Math.max(0.4, Math.min(2, avgShotSec / 5)) : 1;

  const tokens = [
    meanLum > 0.6 ? "bright high-key exposure" : meanLum < 0.32 ? "dark low-key mood" : null,
    contrast > 0.65 ? "high contrast lighting" : contrast < 0.4 ? "soft flat lighting" : null,
    look === "filmwarm" ? "warm color palette" : look === "tealorange" ? "cool teal-leaning palette"
      : look === "mono" ? "black and white" : look === "vivid" ? "punchy saturated colors" : null,
    isVideo ? (moveSpeed === "fast" ? "energetic camera movement" : moveSpeed !== "normal" ? "slow deliberate camera movement" : null) : null,
    isVideo && avgShotSec != null && avgShotSec < 3 ? "quick rhythmic cutting" : null,
  ].filter(Boolean);

  const base = file.name.replace(/\.[^.]+$/, "");
  return {
    id: "media-" + Date.now(),
    name: `${base} のDNA (メディア解析)`,
    family: "メディア抽出",
    keywords: [base, keyLabel, `コントラスト${contrastLabel}`,
      look === "filmwarm" ? "暖色" : look === "tealorange" ? "寒色" : null].filter(Boolean),
    why: `${isVideo ? `動画${Math.round(videoDur)}s (検出ショット${shotCount}・平均${avgShotSec.toFixed(1)}s)` : "静止画"}をブラウザ内解析。`
      + `${keyLabel} / コントラスト${contrastLabel} / ${warmth > 0.06 ? "暖色寄り" : warmth < -0.05 ? "寒色寄り" : "色温度ニュートラル"} / 彩度${sat > 0.28 ? "高" : sat < 0.06 ? "低" : "中"}`
      + `${isVideo ? ` / モーション${moveSpeed === "fast" ? "速い" : moveSpeed === "normal" ? "標準" : "ゆっくり"}` : ""}`,
    dims: {
      editorial: { durationMul, transition: "cut", pace: "解析値" },
      camera: {},   // 焦点距離/絞りは画からは判定しない (推定しない=空)
      lighting: { fillScale, rimBoost: contrast > 0.65 ? 1.3 : 1.0, contrast: contrastLabel },
      color: { look },
      movement: isVideo ? { moveSpeed } : {},
    },
    tokens,
    avoid: [],
    provenance: {
      source: file.name, source_type: "user_media",
      extraction_method: "auto_from_media", annotator: "model",
      confidence: "estimate", // §4: 画素統計からの推定であり実測ではない
      date: new Date().toISOString().slice(0, 10),
    },
  };
}

const mixWeights = { editorial: 0.5, camera: 0.5, lighting: 0.5, color: 0.5, movement: 0.5 };
const MIX_DIMS = [["editorial", "編集リズム"], ["camera", "カメラ/レンズ"], ["lighting", "ライティング"], ["color", "カラー"], ["movement", "ムーブ"]];

function applyDnaToScope(dna, lineage) {
  const targets = byId("dnaScope").value === "all" ? state.cuts : [activeCut()];
  for (const c of targets) {
    applyPatternDNA(c, dna, null, lineage ? JSON.parse(JSON.stringify(lineage)) : undefined);
  }
  refresh(); renderInspector();
  bumpPerf(dna.id, "applied"); // Phase 5-lite: 使用実績を記録 (§26)
  byId("dnaMsg").innerHTML = `✓ <b>${esc(dna.name)}</b> を${targets.length}カットに適用しました (プレビュー/プロンプト/指示書に反映)`;
}

function renderDnaPage() {
  const q = byId("dnaSearch").value.trim();
  const hits = q ? searchDNA(q) : [];
  const list = hits.length ? hits : allDNA().map(d => ({ dna: d, matched: [] }));

  byId("dnaGrid").innerHTML = list.map(({ dna, matched }) => `
    <div class="dna-card ${dnaSel.a === dna.id ? "sel-a" : ""} ${dnaSel.b === dna.id ? "sel-b" : ""}">
      <div class="d-head">
        <span class="d-name">${esc(dna.name)}${matched.length ? ` <small style="color:var(--accent)">「${esc(matched[0])}」に一致</small>` : ""}</span>
        <span class="d-family">${esc(dna.family)}</span>
      </div>
      <div class="d-why">${esc(dna.why)}</div>
      <div class="d-tokens">${esc(dna.tokens.slice(0, 3).join(" / "))}${dna.provenance && dna.provenance.confidence === "estimate" ? ' <span class="d-est">推定値</span>' : ""}</div>
      <div class="d-actions">
        <button class="btn small primary" data-apply="${esc(dna.id)}">適用</button>
        <button class="btn small ${dnaSel.a === dna.id ? "primary" : ""}" data-mixa="${esc(dna.id)}">A</button>
        <button class="btn small ${dnaSel.b === dna.id ? "primary" : ""}" data-mixb="${esc(dna.id)}">B</button>
        ${(() => { const p = dnaPerf()[dna.id]; return `
        <span class="d-perf" title="適用回数と評価 (§26 パターン性能)">${p ? `適用${p.applied}` : ""}</span>
        <button class="btn tiny ghost" data-good="${esc(dna.id)}" title="この結果は良かった">👍${p && p.up ? p.up : ""}</button>
        <button class="btn tiny ghost" data-bad="${esc(dna.id)}" title="この結果は微妙だった">👎${p && p.down ? p.down : ""}</button>`; })()}
      </div>
    </div>`).join("");

  const grid = byId("dnaGrid");
  grid.querySelectorAll("[data-apply]").forEach(b => b.addEventListener("click", () => {
    const d = allDNA().find(x => x.id === b.dataset.apply);
    if (d) applyDnaToScope(d);
    renderDnaPage();
  }));
  grid.querySelectorAll("[data-mixa]").forEach(b => b.addEventListener("click", () => {
    dnaSel.a = dnaSel.a === b.dataset.mixa ? null : b.dataset.mixa; renderDnaPage();
  }));
  grid.querySelectorAll("[data-mixb]").forEach(b => b.addEventListener("click", () => {
    dnaSel.b = dnaSel.b === b.dataset.mixb ? null : b.dataset.mixb; renderDnaPage();
  }));
  grid.querySelectorAll("[data-good]").forEach(b => b.addEventListener("click", () => { bumpPerf(b.dataset.good, "up"); renderDnaPage(); }));
  grid.querySelectorAll("[data-bad]").forEach(b => b.addEventListener("click", () => { bumpPerf(b.dataset.bad, "down"); renderDnaPage(); }));

  // ミキサー (§34): AとBが選ばれたら表示
  const a = allDNA().find(x => x.id === dnaSel.a);
  const b = allDNA().find(x => x.id === dnaSel.b);
  const mixer = byId("dnaMixer");
  mixer.hidden = !(a && b);
  if (a && b) {
    byId("mixA").textContent = a.name;
    byId("mixB").textContent = b.name;
    byId("mixSliders").innerHTML = MIX_DIMS.map(([k, label]) => `
      <div class="mix-row"><label>${label}</label>
        <input type="range" min="0" max="100" value="${Math.round(mixWeights[k] * 100)}" data-mixdim="${k}">
      </div>`).join("");
    byId("mixSliders").querySelectorAll("[data-mixdim]").forEach(el => {
      el.addEventListener("input", () => { mixWeights[el.dataset.mixdim] = +el.value / 100; });
    });
  }
}

function setupDnaPage() {
  byId("btnDnaPage").addEventListener("click", () => {
    byId("dnaMsg").textContent = "";
    byId("dnaOverlay").hidden = false;
    renderDnaPage();
  });
  byId("btnDnaBack").addEventListener("click", () => { byId("dnaOverlay").hidden = true; });
  byId("dnaSearch").addEventListener("input", renderDnaPage);
  byId("btnMixApply").addEventListener("click", () => {
    const a = allDNA().find(x => x.id === dnaSel.a);
    const b = allDNA().find(x => x.id === dnaSel.b);
    if (!a || !b) return;
    const mixed = mixDNA(a, b, mixWeights);
    applyDnaToScope(mixed, { sources: [a.id, b.id], weights: { ...mixWeights }, date: new Date().toISOString().slice(0, 10) });
    renderDnaPage();
  });
  byId("btnMixClear").addEventListener("click", () => { dnaSel.a = null; dnaSel.b = null; renderDnaPage(); });

  /* --- V8 Phase 2: 参照の手動注釈 → カスタムDNA --- */
  byId("anTrans").innerHTML = TRANSITIONS.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join("");
  byId("anSpeed").innerHTML = MOVE_SPEEDS.map(m => `<option value="${m.id}" ${m.id === "slow" ? "selected" : ""}>${esc(m.label)}</option>`).join("");
  byId("anLook").innerHTML = LOOKS.map(l => `<option value="${l.id}">${esc(l.label)}</option>`).join("");
  byId("btnDnaAnnotate").addEventListener("click", () => {
    byId("dnaAnnotateForm").hidden = !byId("dnaAnnotateForm").hidden;
  });
  byId("btnDnaExtract").addEventListener("click", () => {
    const dna = extractProjectDNA();
    if (!dna) return;
    state.customDNA.push(dna);
    byId("dnaMsg").innerHTML = `✓ <b>${esc(dna.name)}</b> を抽出しました (推定値・来歴付き)。他プロジェクトを開いてから適用すると、このスタイルを移植できます`;
    renderDnaPage();
  });
  byId("btnDnaMedia").addEventListener("click", () => byId("dnaMediaInput").click());
  byId("dnaMediaInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    byId("dnaMsg").textContent = "解析中… (ブラウザ内で完結します。ファイルは外部に送信されません)";
    try {
      const dna = await extractMediaDNA(file);
      state.customDNA.push(dna);
      byId("dnaMsg").innerHTML = `✓ <b>${esc(dna.name)}</b> を抽出しました — ${esc(dna.why)}`;
      renderDnaPage();
    } catch (err) {
      byId("dnaMsg").textContent = "⚠️ 解析できませんでした: " + err.message;
    }
  });
  byId("btnAnnotClose").addEventListener("click", () => { byId("dnaAnnotateForm").hidden = true; });
  byId("btnAnnotSave").addEventListener("click", () => {
    const name = byId("anName").value.trim();
    const why = byId("anWhy").value.trim();
    if (!name || !why) { byId("dnaMsg").textContent = "⚠️ 参照名と「なぜ効くか」は必須です"; return; }
    const kw = byId("anKeywords").value.split(/[,、]/).map(x => x.trim()).filter(Boolean);
    const tokens = byId("anTokens").value.split(/[,、]/).map(x => x.trim()).filter(Boolean);
    const mn = Math.min(+byId("anFocalMin").value || 50, +byId("anFocalMax").value || 85);
    const mx = Math.max(+byId("anFocalMin").value || 50, +byId("anFocalMax").value || 85);
    const dna = {
      id: "ref-" + Date.now(),
      name, family: "手動注釈",
      keywords: [...new Set([name, ...kw])],
      why,
      dims: {
        editorial: { durationMul: +byId("anPace").value, transition: byId("anTrans").value, pace: byId("anPace").selectedOptions[0].textContent },
        camera: { focal: [mn, mx], aperture: +byId("anAperture").value || 2.8 },
        lighting: { fillScale: +byId("anFill").value, rimBoost: +byId("anRim").value, contrast: byId("anFill").selectedOptions[0].textContent },
        color: { look: byId("anLook").value },
        movement: { moveSpeed: byId("anSpeed").value, prefMove: null },
      },
      tokens: tokens.length ? tokens : [why.slice(0, 60)],
      avoid: [],
      // 来歴 (§23): 手動注釈は human/confidence高
      provenance: {
        source: name, source_type: byId("anType").value,
        extraction_method: "manual_annotation", annotator: "human",
        confidence: "high", date: new Date().toISOString().slice(0, 10),
      },
    };
    state.customDNA.push(dna);
    byId("dnaAnnotateForm").hidden = true;
    byId("anName").value = ""; byId("anWhy").value = ""; byId("anTokens").value = ""; byId("anKeywords").value = "";
    byId("dnaMsg").innerHTML = `✓ カスタムDNA <b>${esc(name)}</b> を保存しました (検索・適用・ミックス可、プロジェクトに保存されます)`;
    renderDnaPage();
  });
}

/* =========================================================
 * 機材データベースページ (アプリ内オーバーレイ・戻るボタン付き)
 * 選んだ実機材はカット/選択中の機材に割当できる (capability-first の具体化)
 * ======================================================= */
const EQUIP_CATS = [
  { id: "all", label: "すべて" },
  { id: "camera", label: "カメラ" },
  { id: "lens", label: "レンズ" },
  { id: "lighting", label: "ライティング" },
  { id: "camera_support", label: "カメラサポート" },
  { id: "aerial", label: "ドローン/空撮" },
  { id: "special_effects", label: "特効" },
  { id: "modifier_support", label: "モディファイア" },
  { id: "grip", label: "グリップ" },
];
const SFX_ITEM_TYPES = ["fan", "smoke", "rainmachine", "snowmachine", "confetti", "pyro", "spark"];
let equipCat = "all";

function assignTargetLabel(record) {
  switch (record.category) {
    case "camera": return "このカメラを使用";
    case "lens": return "このレンズを使用";
    case "camera_support": return "このサポートを使用";
    case "aerial": return "このドローンを使用";
    default: return "選択中の機材に割当";
  }
}

function assignEquipment(record) {
  const cut = activeCut();
  const name = `${record.manufacturer} ${record.model}`;
  // カメラ・レンズ・サポート・ドローンはプロジェクト共通キットに保存
  // (全カット・自動保存・書き出しに反映され、戻っても保持される)
  switch (record.category) {
    case "camera": state.kit.body = name; break;
    case "lens": state.kit.lens = name; break;
    case "camera_support": state.kit.support = name; break;
    case "aerial": {
      state.kit.drone = name;
      const droneItem = cut.items.find(i => i.type === "drone");
      if (droneItem) droneItem.sku = name;
      break;
    }
    default: {
      const sel = cut.items.find(i => i.id === state.selectedItem);
      const compatible = sel && (
        (record.category === "lighting" && LIGHT_TYPES.includes(sel.type)) ||
        (record.category === "special_effects" && SFX_ITEM_TYPES.includes(sel.type)) ||
        (["modifier_support", "grip"].includes(record.category) && ["reflector", "flag", "diff"].includes(sel.type))
      );
      if (!compatible) {
        byId("equipAssignHint").innerHTML = `⚠️ 先に俯瞰図で対応する機材 (${record.category === "lighting" ? "ライト" : record.category === "special_effects" ? "特効機材" : "レフ/フラッグ/ディフューザー"}) を選択してから割り当ててください。`;
        return;
      }
      sel.sku = name;
      break;
    }
  }
  byId("equipAssignHint").innerHTML = `✓ <b>${esc(name)}</b> を使用機材に保存しました (全カット共通・自動保存・指示書/canonical JSONに反映)`;
  renderInspector();
  renderEquipPage();
}

function renderEquipPage() {
  const q = byId("equipSearch").value.trim().toLowerCase();
  byId("equipFilters").innerHTML = EQUIP_CATS.map(c =>
    `<span class="opt-toggle ${equipCat === c.id ? "on" : ""}" data-cat="${c.id}">${esc(c.label)}</span>`).join("");
  byId("equipFilters").querySelectorAll("[data-cat]").forEach(el =>
    el.addEventListener("click", () => { equipCat = el.dataset.cat; renderEquipPage(); }));

  const records = EQUIPMENT_DB.filter(r => {
    if (equipCat !== "all" && r.category !== equipCat) return false;
    if (!q) return true;
    const text = `${r.manufacturer} ${r.model} ${r.subcategory} ${r.use_cases.join(" ")}`.toLowerCase();
    return text.includes(q);
  });
  byId("equipCount").textContent = `${records.length} / ${EQUIPMENT_DB.length} 機種`;

  const sel = activeCut().items.find(i => i.id === state.selectedItem);
  if (!byId("equipAssignHint").innerHTML.startsWith("✓") && !byId("equipAssignHint").innerHTML.startsWith("⚠️")) {
    const kitStr = [
      state.kit.body && `カメラ: ${state.kit.body}`,
      state.kit.lens && `レンズ: ${state.kit.lens}`,
      state.kit.support && `サポート: ${state.kit.support}`,
      state.kit.drone && `ドローン: ${state.kit.drone}`,
    ].filter(Boolean).join(" ｜ ");
    byId("equipAssignHint").innerHTML =
      (kitStr ? `🎬 <b>使用機材 (保存済み)</b>: ${esc(kitStr)}<br>` : "") +
      (sel
        ? `選択中: <b>${esc(EQUIP_TYPES[sel.type].label)}</b> — ライト/特効/モディファイアのカードから割当できます`
        : "カメラ/レンズ/サポート/ドローンは選ぶだけで保存されます。ライト等は俯瞰図で機材を選択してから開いてください");
  }

  byId("equipGrid").innerHTML = records.map((r, i) => `
    <div class="equip-card">
      <div class="e-head">
        <div>
          <div class="e-name">${esc(r.manufacturer)} ${esc(r.model)}</div>
          <div class="e-cat">${esc(r.category)} / ${esc(r.subcategory)}</div>
        </div>
        <span class="safety-badge sc-${esc(r.safety_class)}" title="安全区分 ${esc(r.safety_class)}${r.specialist_only ? " (専門者のみ)" : ""}">${esc(r.safety_class)}</span>
      </div>
      <div class="e-cap">${esc(Object.entries(r.capability).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" ｜ ") || "—")}</div>
      <div class="e-use">${esc(r.use_cases.join(" / "))}</div>
      <div class="e-actions"><button class="btn small ${[state.kit.body, state.kit.lens, state.kit.support, state.kit.drone].includes(`${r.manufacturer} ${r.model}`) ? "primary" : ""}" data-assign="${i}">${[state.kit.body, state.kit.lens, state.kit.support, state.kit.drone].includes(`${r.manufacturer} ${r.model}`) ? "✓ 使用中" : esc(assignTargetLabel(r))}</button></div>
    </div>`).join("");
  byId("equipGrid").querySelectorAll("[data-assign]").forEach(btn =>
    btn.addEventListener("click", () => assignEquipment(records[+btn.dataset.assign])));
}

function setupEquipPage() {
  byId("btnEquipPage").addEventListener("click", () => {
    byId("equipAssignHint").innerHTML = "";
    byId("equipOverlay").hidden = false;
    renderEquipPage();
  });
  byId("btnEquipBack").addEventListener("click", () => { byId("equipOverlay").hidden = true; });
  byId("equipSearch").addEventListener("input", renderEquipPage);
}

/* =========================================================
 * Canonical Shot JSON インポート (書き出しとの往復対応)
 * ======================================================= */
function fromWorldM(pos) {
  return {
    x: Math.max(20, Math.min(980, (pos?.[0] ?? 0) * 100 + SUBJECT_POS.x)),
    y: Math.max(20, Math.min(680, SUBJECT_POS.y - (pos?.[1] ?? 0) * 100)),
    height: Math.round(Math.max(0, (pos?.[2] ?? 1.5) * 100)),
  };
}

function cutFromCanonicalShot(shot) {
  const cut = makeCut(null);
  const P = shot.planned || {};
  cut.name = shot.name || shot.shot_id || "インポートカット";
  cut.aim = shot.intent?.purpose || "";
  cut.kind = P.timing?.kind || "video";
  cut.originMode = cut.kind === "still" ? "still" : cut.originMode; // kindと由来バッジを揃える
  if (P.timing?.duration_s) cut.duration = P.timing.duration_s;
  if (P.composition) {
    cut.camera.shotSize = P.composition.shot_size || cut.camera.shotSize;
    cut.camera.endShotSize = P.composition.end_shot_size || "same";
    cut.camera.angle = P.composition.angle || cut.camera.angle;
    cut.aspect = P.composition.aspect_ratio || cut.aspect;
  }
  if (P.subject) {
    cut.subjectType = P.subject.type || cut.subjectType;
    cut.action = P.subject.action || cut.action;
    cut.subjectNote = P.subject.note || "";
  }
  if (P.environment) {
    cut.bgStyle = BG_STYLES[P.environment.background] ? P.environment.background : cut.bgStyle;
    cut.weather = P.environment.weather || "none";
    cut.timeOfDay = P.environment.time_of_day || "none";
  }
  if (P.color?.look) cut.look = P.color.look;
  if (P.audio?.plan) cut.audio = P.audio.plan;
  if (Array.isArray(P.fx_options)) cut.options = P.fx_options.filter(o => SHOT_OPTIONS.some(s => s.id === o));
  cut.transition = shot.transition_out || "cut";
  if (shot.edit_decision) {
    cut.take = shot.edit_decision.take || 1;
    cut.srcInSec = shot.edit_decision.src_in_s || 0;
    cut.audioEdit = shot.edit_decision.audio_edit || "none";
    if (shot.edit_decision.audio_overlap_s != null) cut.audioOverlapSec = shot.edit_decision.audio_overlap_s;
    if (shot.edit_decision.caption) cut.caption = shot.edit_decision.caption;
  }
  if (shot.location) {
    const L = shot.location;
    cut.location.presetId = L.preset_id || null;
    cut.location.name = L.name || "";
    cut.location.note = L.note || "";
    if (L.coordinates) cut.location.coords = L.coordinates;
    if (L.shoot_date) cut.location.date = L.shoot_date;
    if (L.shoot_time_solar) cut.location.time = L.shoot_time_solar;
    if (L.camera_bearing_deg != null) cut.location.camBearing = L.camera_bearing_deg;
    if (Array.isArray(L.keep_aspects)) cut.location.keep = L.keep_aspects;
    if (L.photo_traits && Array.isArray(L.photo_traits.descriptors_en)) {
      /* 写真そのものはJSONに含まれないが、測った光と色は設計として復元する */
      cut.location.photoTraits = {
        ja: L.photo_traits.descriptors_ja || L.photo_traits.descriptors_en,
        en: L.photo_traits.descriptors_en,
        guess: {}, stats: L.photo_traits.measured || null,
      };
    }
  }
  if (shot.performance) {
    const P2 = shot.performance;
    const p = cut.perf;
    if (P2.method) p.method = P2.method;
    if (P2.people) p.people = P2.people;
    if (P2.contact) p.contact = P2.contact;
    if (P2.camera_link) p.camLink = P2.camera_link;
    if (P2.motion_quality) {
      p.speed = P2.motion_quality.speed || p.speed;
      p.care = P2.motion_quality.care || p.care;
      p.toward = P2.motion_quality.toward || p.toward;
    }
    if (P2.temperature) p.temp = P2.temperature;
    if (Array.isArray(P2.cast) && P2.cast.length) {
      p.actors = P2.cast.map(a => ({ id: a.id || uid(), type: a.type || "person", name: a.name || "" }));
      p.people = p.actors.length;
    }
    if (Array.isArray(P2.beats)) {
      p.beats = P2.beats.map(b => ({
        id: uid(), sec: +b.duration_s || 1,
        who: b.actor_id && p.actors.some(a => a.id === b.actor_id) ? b.actor_id : "",
        do: b.action || "", gaze: b.gaze || "none", cam: b.camera || "none",
      }));
    }
    if (Array.isArray(P2.preserve)) p.preserve = P2.preserve;
    if (Array.isArray(P2.change)) p.change = P2.change;
  }
  if (P.logistics) { cut.takes = P.logistics.estimated_takes ?? cut.takes; cut.setupMin = P.logistics.setup_min ?? cut.setupMin; }

  const c = P.camera || {};
  if (c.position_m) {
    const camItem = cut.items.find(i => i.type === "camera");
    Object.assign(camItem, fromWorldM(c.position_m));
  }
  cut.camera.body = c.body_archetype || cut.camera.body;
  if (c.support) { cut.camera.support = c.support.type || cut.camera.support; cut.camera.head = c.support.head || cut.camera.head; }
  const L = P.lens || {};
  if (L.focal_length_mm) cut.camera.focalMm = L.focal_length_mm;
  if (L.aperture_f) cut.camera.apertureF = L.aperture_f;
  if (L.focus_distance_m) cut.camera.focusM = L.focus_distance_m;
  if (L.anamorphic) cut.camera.lens = "anam";
  if (L.nd) cut.camera.nd = L.nd;
  if (Array.isArray(L.filters)) cut.camera.filters = L.filters;
  const E = P.exposure || {};
  Object.assign(cut.camera, {
    shutter: E.shutter || cut.camera.shutter, iso: E.iso || cut.camera.iso,
    fps: E.fps || cut.camera.fps, wb: E.white_balance || cut.camera.wb,
  });
  if (P.movement) { cut.camera.move = P.movement.type || cut.camera.move; cut.camera.moveSpeed = P.movement.speed || cut.camera.moveSpeed; if (P.movement.track_shape) cut.camera.trackShape = P.movement.track_shape; }

  for (const l of P.lighting || []) {
    if (!EQUIP_TYPES[l.role]) continue;
    cut.items.push(makeItem({
      type: l.role, ...fromWorldM(l.position_m),
      power: l.power_pct ?? 50, colorTemp: l.color_temp_k ?? 5600,
      modifier: l.modifier || "なし(直射)",
    }));
    const it = cut.items[cut.items.length - 1];
    if (l.beam_angle_deg) it.beamAngle = l.beam_angle_deg;
    if (l.stand) it.stand = l.stand;
    if (l.watt) it.watt = l.watt;
  }
  for (const g of P.grip || []) {
    if (EQUIP_TYPES[g.type]) cut.items.push(makeItem({ type: g.type, ...fromWorldM(g.position_m), power: 0, modifier: g.modifier || "なし(直射)" }));
  }
  for (const f of P.practical_fx || []) {
    if (EQUIP_TYPES[f.type]) cut.items.push(makeItem({ type: f.type, ...fromWorldM(f.position_m), power: 0 }));
  }
  for (const v of P.logistics?.vehicles || []) {
    if (EQUIP_TYPES[v.type]) cut.items.push(makeItem({ type: v.type, ...fromWorldM(v.position_m), power: 0 }));
  }
  return ensureCameraDefaults(cut);
}

function importCanonical(data) {
  if (!Array.isArray(data.shots) || !data.shots.length) throw new Error("shots がありません");
  const c0 = data.shots[0].planned?.camera || {};
  state.kit = {
    body: c0.body_sku || null,
    lens: data.shots[0].planned?.lens?.lens_sku || null,
    support: c0.support?.support_sku || null,
    drone: state.kit?.drone || null,
  };
  state.cuts = data.shots.map(cutFromCanonicalShot);
  if (typeof data.story_text === "string" && data.story_text) state.story.text = data.story_text;
  state.activeCut = 0;
  state.selectedItem = null;
  renderAll();
}

/* =========================================================
 * テーマ (自動/ライト/ダーク)
 * ======================================================= */
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") delete root.dataset.theme;
  else root.dataset.theme = mode;
  try { localStorage.setItem("vsTheme", mode); } catch { /* プライベートモード等 */ }
  state.theme = mode;
  const icons = { auto: "i-autotheme", light: "i-sun", dark: "i-moon" };
  const titles = { auto: "テーマ: 自動 (OS設定に追従) — クリックで切替", light: "テーマ: ライト — クリックで切替", dark: "テーマ: ダーク — クリックで切替" };
  const btn = byId("btnTheme");
  btn.innerHTML = `<svg class="ic"><use href="#${icons[mode]}"/></svg>`;
  btn.title = titles[mode];
}

function setupTheme() {
  let saved = "auto";
  try { saved = localStorage.getItem("vsTheme") || "auto"; } catch { /* noop */ }
  applyTheme(["auto", "light", "dark"].includes(saved) ? saved : "auto");
  byId("btnTheme").addEventListener("click", () => {
    const order = ["auto", "dark", "light"];
    applyTheme(order[(order.indexOf(state.theme) + 1) % order.length]);
  });
}

/* =========================================================
 * スタジオ俯瞰図のズーム / パン
 * ======================================================= */
const canvasView = { x: 0, y: 0, w: 1000, h: 700 };

function applyCanvasView() {
  byId("studioCanvas").setAttribute("viewBox", `${canvasView.x} ${canvasView.y} ${canvasView.w} ${canvasView.h}`);
}

function zoomCanvasAt(factor, cx, cy) {
  const nw = Math.min(1400, Math.max(240, canvasView.w * factor));
  const k = nw / canvasView.w;
  canvasView.x = cx - (cx - canvasView.x) * k;
  canvasView.y = cy - (cy - canvasView.y) * k;
  canvasView.w = nw;
  canvasView.h = nw * 0.7;
  applyCanvasView();
}

function resetCanvasView() {
  canvasView.x = 0; canvasView.y = 0; canvasView.w = 1000; canvasView.h = 700;
  applyCanvasView();
}

function setupZoom() {
  const svg = byId("studioCanvas");
  const center = () => ({ x: canvasView.x + canvasView.w / 2, y: canvasView.y + canvasView.h / 2 });
  byId("btnZoomIn").addEventListener("click", () => { const c = center(); zoomCanvasAt(1 / 1.25, c.x, c.y); });
  byId("btnZoomOut").addEventListener("click", () => { const c = center(); zoomCanvasAt(1.25, c.x, c.y); });
  byId("btnZoomReset").addEventListener("click", resetCanvasView);
  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    zoomCanvasAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  }, { passive: false });
  svg.addEventListener("dblclick", resetCanvasView);
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
  byId("btnExportBoard").addEventListener("click", exportBoard);
  byId("btnExportJson").addEventListener("click", exportJSON);
  byId("btnExportCanonical").addEventListener("click", exportCanonicalJSON);
  byId("btnExportDmx").addEventListener("click", exportDmx);
  byId("btnExportSchedule").addEventListener("click", exportSchedule);
  byId("btnExportEdl").addEventListener("click", exportEdl);

  // プロンプトモデル (方言) 切り替え
  const pm = byId("promptModelSelect");
  pm.innerHTML = PROMPT_MODELS.map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join("");
  pm.value = state.promptModel;
  pm.addEventListener("change", () => {
    state.promptModel = pm.value;
    renderPrompt();
    const wfm2 = byId("wfModelSel");
    if (wfm2) wfm2.value = pm.value;
    if (!byId("wfOverlay").hidden) renderWorkflow();
  });

  // 技法md インポート
  byId("btnImportMd").addEventListener("click", () => byId("fileMdImport").click());
  byId("fileMdImport").addEventListener("change", e => {
    if (e.target.files.length) importKnowledgeMdFiles([...e.target.files]);
    e.target.value = "";
  });
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
  byId("btnAddCut").addEventListener("click", () => { cutInsert(state.cuts.length); renderAll(); });
  byId("btnDupCut").addEventListener("click", async () => { await cutDuplicate(state.activeCut); renderAll(); });
  byId("btnDelCut").addEventListener("click", () => { if (cutDelete(state.activeCut)) renderAll(); });

  const copyFeedback = (btn, restoreIcon) => {
    btn.innerHTML = '<svg class="ic"><use href="#i-check"/></svg>';
    btn.style.color = "var(--accent)";
    setTimeout(() => {
      btn.innerHTML = `<svg class="ic"><use href="#${restoreIcon}"/></svg>`;
      btn.style.color = "";
    }, 1400);
  };
  byId("btnCopyPrompt").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byId("promptText").value);
    } catch { byId("promptText").select(); document.execCommand("copy"); }
    copyFeedback(byId("btnCopyPrompt"), "i-copy");
  });
  byId("btnCopySequence").addEventListener("click", async () => {
    const seq = buildSeedanceSequence();
    if (!seq) { showToast("⚠️ 動画カットがありません (スチールのみのため)"); return; }
    try { await navigator.clipboard.writeText(seq); } catch { /* clipboard不可環境 */ }
    copyFeedback(byId("btnCopySequence"), "i-board");
  });

  // スライダーの進捗塗り (トラック左側をアクセント色に)
  byId("inspector").addEventListener("input", e => {
    if (e.target.type === "range") updateRangeFill(e.target);
  });
}

/* =========================================================
 * IntentParser の配線 (自由文 → カット自動設計)
 * ======================================================= */
let lastIntentCutId = null;

const chipHtml = (a) =>
  `<span class="intent-chip">${esc(a.label)}: ${esc(a.value)}${a.ev ? `<small>「${esc(a.ev)}」</small>` : ""}</span>`;

function runIntent() {
  const text = byId("intentInput").value.trim();
  if (!text) return;

  /* 複文 (「まず…次に…最後に…」) → 複数カット */
  const multi = parseIntentMulti(text);
  if (multi) {
    const startIdx = state.cuts.length;
    let chipsHtml = "";
    multi.forEach((seg, si) => {
      const cut = buildCutFromIntent(seg.parsed);
      cut.name = seg.segment.slice(0, 16) + (seg.segment.length > 16 ? "…" : "");
      // セグメント文中のトランジション語は「前カット→このカット」の繋ぎ
      if (si > 0) {
        for (const [re, id] of INTENT_TRANSITIONS) {
          if (re.test(seg.segment)) { state.cuts[state.cuts.length - 1].transition = id; break; }
        }
      }
      state.cuts.push(cut);
      chipsHtml += `<div class="intent-cutgroup"><span class="intent-cutno">C${state.cuts.length}</span>${seg.parsed.assumptions.map(chipHtml).join("")}</div>`;
    });
    state.activeCut = startIdx;
    state.selectedItem = null;
    lastIntentCutId = state.cuts[startIdx].id;
    renderAll();
    byId("intentChips").innerHTML = chipsHtml;
    byId("intentResult").hidden = false;
    return;
  }

  const parsed = parseIntent(text);
  const cut = buildCutFromIntent(parsed);
  state.cuts.push(cut);
  state.activeCut = state.cuts.length - 1;
  state.selectedItem = null;
  lastIntentCutId = cut.id;
  renderAll();
  // 解釈の根拠を表示 (すべての推定を明示する — CLAUDE.md §8)
  byId("intentChips").innerHTML = parsed.assumptions.map(chipHtml).join("");
  byId("intentResult").hidden = false;
}

function setupIntent() {
  byId("btnIntent").addEventListener("click", runIntent);
  byId("intentInput").addEventListener("keydown", e => { if (e.key === "Enter") runIntent(); });
  byId("btnIntentClose").addEventListener("click", () => { byId("intentResult").hidden = true; });
  byId("btnCoverage").addEventListener("click", () => {
    const idx = state.cuts.findIndex(c => c.id === lastIntentCutId);
    const target = idx >= 0 ? state.cuts[idx] : activeCut();
    const three = expandCoverage(target);
    const at = idx >= 0 ? idx : state.activeCut;
    state.cuts.splice(at, 1, ...three);
    state.activeCut = at + 1; // メインカットを選択
    lastIntentCutId = three[1].id;
    renderAll();
  });
}

function init() {
  setupHeader();
  setupTheme();
  setupZoom();
  setupIntent();
  setupViewToggle();
  setup3DControls();
  setupDocOverlay();
  setupEquipPage();
  setupProjects();
  setupDnaPage();
  setupTimeline();
  setupWorkflow();
  setupRoughCut();
  setupShortcuts();
  setupOnboarding();
  setupScriptPage();
  setupLocationPage();
  setupRefDnD();
  setupA11y();
  byId("btnPlayPreview").addEventListener("click", () => {
    state.previewPlay = !state.previewPlay;
    if (state.previewPlay) startPreviewAnim(); else stopPreviewAnim();
    updatePlayButton();
  });
  // 前回の作業を復元 (自動保存)。無ければデモ用の初期カット割り
  const saved = lsGet(LS_CURRENT, null);
  const firstRun = !(saved && Array.isArray(saved.cuts) && saved.cuts.length);
  if ((firstRun && !lsGet("vsTourDone", false) && !navigator.webdriver) || lsGet("vsForceWelcome", false)) {
    byId("welcome").hidden = false; // 初回だけ (自動テスト環境では出さない)
  }
  if (!firstRun) {
    applySnapshot(saved);
  } else {
    state.cuts = [
      makeCut(PRESETS.find(p => p.id === "three-point")),
      makeCut(PRESETS.find(p => p.id === "rembrandt")),
      makeCut(PRESETS.find(p => p.id === "backlight-silhouette")),
    ];
    state.activeCut = 0;
    renderAll();
  }
  startAutosave();
  setTimeout(async () => {
    await rcMigrateLegacyAudio();
    await refMigrateToIdb();   // 参照画像の本体をlocalStorage→IndexedDBへ
    await refLoadAll();
    rcRefreshIndex();
    gcMediaClips();
  }, 2500); // 旧形式の移行→孤児回収

  /* ラフカットのWebM書き出しに必要なAPIが無いブラウザ (Safari等) には一度だけ案内 */
  const webmOk = typeof MediaRecorder !== "undefined"
    && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("video/webm")
    && !!HTMLCanvasElement.prototype.captureStream;
  if (!webmOk && !lsGet("vsBrowserWarned", false) && !navigator.webdriver) {
    lsSet("vsBrowserWarned", true);
    setTimeout(() => showToast("⚠️ このブラウザはWebM録画に未対応のため、ラフカットの書き出しが使えない可能性があります (再生・EDL・指示書は利用可)。Chrome / Edge を推奨します"), 1500);
  }
}

init();
