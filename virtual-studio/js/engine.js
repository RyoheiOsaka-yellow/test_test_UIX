/* =========================================================
 * CineOS 移植エンジン群 (cineos/CLAUDE.md §5 準拠のモジュール分割)
 *  - EquipmentMatcher: capability-first の機材アーキタイプ推薦
 *  - FeasibilityEngine / SafetyFlagger: ルールベースの実現性・安全チェック
 * ルールIDは cineos/data/advanced/advanced_rules.json に対応。
 * 安全方針: Class C は演出計画・座組みのみを扱い、
 * 危険な構造物・火薬量等の情報は一切生成しない (CLAUDE.md §3)。
 * ======================================================= */

"use strict";

/* =========================================================
 * EquipmentMatcher — アプリ内の機材タイプ/設定 → DBアーキタイプ候補
 * 「capability first, SKU second」(CLAUDE.md §9)
 * ======================================================= */
const MATCH_RULES = {
  /* ライト: モディファイアの性格も加味して候補を寄せる */
  key:       { cats: [["lighting", ["COB_LED", "high_output_LED", "LED_panel"]]], need: "拡散前提の主光源 (COB/パネル系)" },
  fill:      { cats: [["lighting", ["LED_panel", "COB_LED"]]], need: "起こし用の面光源" },
  back:      { cats: [["lighting", ["COB_LED", "ellipsoidal", "LED_point_source"]]], need: "輪郭用の指向性光源" },
  rim:       { cats: [["lighting", ["COB_LED", "ellipsoidal", "LED_point_source"]]], need: "エッジ用の指向性光源" },
  top:       { cats: [["lighting", ["soft_overhead", "large_soft", "LED_array"]]], need: "頭上の大面積ソフト" },
  bg:        { cats: [["lighting", ["LED_panel", "pixel_tube", "cinema_LED"]]], need: "背景を独立制御できる面/チューブ光源" },
  hmi:       { cats: [["lighting", ["HMI", "high_output_LED"]]], need: "太陽光級の大出力デイライト (フリッカーセーフ)" },
  practical: { cats: [["lighting", ["pixel_tube", "LED_point_source", "tungsten"]]], need: "画面内に写る演出光源" },
  reflector: { cats: [["modifier_support", ["bounce", "bounce_diffusion"]]], need: "バウンス面" },
  flag:      { cats: [["modifier_support", ["negative_fill", "light_control"]]], need: "ネガティブフィル / 光のカット" },
  diff:      { cats: [["modifier_support", ["diffusion"]], ["grip", ["overhead"]]], need: "拡散フレーム / オーバーヘッド" },
  fan:       { cats: [["special_effects", ["wind_machine"]]], need: "送風 (風量段階制御)" },
  smoke:     { cats: [["special_effects", ["hazer", "fogger", "atmosphere", "low_fog", "fog_effect"]]], need: "ヘイズ/フォグ (粒径と滞留時間で選定)" },
  rainmachine: { cats: [["special_effects", ["rain_rig", "water_system"]]], need: "レインリグ (逆光前提・水量制御)" },
  snowmachine: { cats: [["special_effects", ["snow_machine", "particle"]]], need: "降雪 (泡雪/紙雪)" },
  confetti:  { cats: [["special_effects", ["particle"]]], need: "紙吹雪/パーティクル射出" },
  pyro:      { cats: [["special_effects", ["pyrotechnics", "fire"]]], need: "火工特効 — Class C: 有資格特効技師の専任領域 (本ツールは演出計画のみ)" },
  spark:     { cats: [["special_effects", ["particle", "impact_effect", "pyrotechnics"]]], need: "スパーク演出 — 有資格者運用" },
  drone:     { cats: [["aerial", ["cinema_drone", "heavy_lift", "FPV", "FPV_cinewhoop"]]], need: "空撮プラットフォーム" },
};

const BODY_MATCH = {
  cine:       [["camera", ["cinema", "compact_cinema"]]],
  mirrorless: [["camera", ["hybrid"]]],
  highspeed:  [["camera", ["high_speed", "ultra_high_speed"]]],
  broadcast:  [["camera", ["cinema", "compact_cinema"]]],
  action:     [["camera", ["action"]]],
  pov_ear:    [["camera", ["action"]]],
  fpv:        [["aerial", ["FPV", "FPV_cinewhoop"]]],
  cam360:     [["camera", ["360"]]],
  medium:     [["camera", ["medium_format_still"]]],
  phone:      [],
};

const SUPPORT_MATCH = {
  slider: [["camera_support", ["slider"]]],
  dolly: [["camera_support", ["dolly", "robotic_dolly", "railcam"]]],
  crane: [["camera_support", ["telescopic_crane"]]],
  technocrane: [["camera_support", ["telescopic_crane", "remote_head"]]],
  steadicam: [["camera_support", ["body_stabilizer"]]],
  bodyrig: [["camera_support", ["body_stabilizer"]]],
  gimbal: [["camera_support", ["gimbal", "remote_head"]]],
  cablecam: [["camera_support", ["cablecam", "multi_cable_camera"]]],
  dronemount: [["aerial", ["cinema_drone", "heavy_lift"]]],
  tripod: [["modifier_support", ["still_support"]], ["grip", ["stand"]]],
};

function dbQuery(catSubPairs, limit = 3) {
  const out = [];
  for (const [cat, subs] of catSubPairs) {
    for (const r of EQUIPMENT_DB) {
      if (r.category !== cat) continue;
      if (subs && subs.length && !subs.includes(r.subcategory)) continue;
      out.push(r);
      if (out.length >= limit) return out;
    }
  }
  return out.slice(0, limit);
}

function lensMatch(cut) {
  if (cut.camera.lens === "anam") return dbQuery([["lens", ["anamorphic"]]]);
  if (cut.camera.lens === "100m" || cut.camera.focalMm >= 90 && cut.subjectType !== "person")
    return dbQuery([["lens", ["macro", "probe", "supermacro"]]]);
  return dbQuery([["lens", ["prime", "cinema_zoom"]]], 2);
}

/* カット全体の機材候補リスト (指示書用) */
function recommendForCut(cut) {
  const recs = [];
  const fmtR = (r) => `${r.manufacturer} ${r.model}`;
  const push = (role, need, records) => {
    if (records.length) recs.push({ role, need, examples: records.map(fmtR), safety: records[0].safety_class });
  };

  const body = BODY_MATCH[cut.camera.body];
  if (body && body.length) push("カメラ", (CAMERA_BODIES.find(b => b.id === cut.camera.body) || {}).label || "", dbQuery(body, 2));
  push("レンズ", cut.camera.lens === "anam" ? "アナモルフィック" : `${cut.camera.focalMm}mm 相当`, lensMatch(cut));
  const sup = SUPPORT_MATCH[cut.camera.support];
  if (sup) push("サポート", (CAMERA_SUPPORTS.find(s => s.id === cut.camera.support) || {}).label || "", dbQuery(sup, 2));

  const seen = new Set();
  for (const it of cut.items) {
    if (it.type === "subject" || it.type === "camera" || seen.has(it.type)) continue;
    seen.add(it.type);
    const m = MATCH_RULES[it.type];
    if (m) push(EQUIP_TYPES[it.type].label, m.need, dbQuery(m.cats, 2));
  }
  return recs;
}

/* 選択中の機材1つの候補 (インスペクター用) */
function recommendForItem(it) {
  const m = MATCH_RULES[it.type];
  if (!m) return null;
  return { need: m.need, records: dbQuery(m.cats, 3) };
}

/* =========================================================
 * FeasibilityEngine / SafetyFlagger
 * 優先順位: SAFETY → 物理的実現性 → 継続性 → … (CLAUDE.md §6)
 * ======================================================= */
const SFX_SAFETY_CLASS = {
  pyro: "C", spark: "B", rainmachine: "B", snowmachine: "B",
  smoke: "B", fan: "A", confetti: "A",
};

function parseFps(fpsStr) {
  const m = String(fpsStr || "").match(/(\d+)\s*fps/i) || String(fpsStr || "").match(/^(\d+)/);
  return m ? parseInt(m[1]) : 24;
}
function parseShutterDenom(s) {
  const m = String(s || "").match(/1\s*\/\s*(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function evaluateFeasibility(cut) {
  const w = []; // {lv: "danger"|"warn"|"info", t}
  const an = analyzeLighting(cut);
  const types = new Set(cut.items.map(i => i.type));
  const opts = new Set(cut.options);

  /* --- SAFETY (最優先) --- */
  if (types.has("pyro") || opts.has("explosion")) {
    w.push({ lv: "danger", t: "Class C 特効 (爆発/火工): 有資格の特効技師専任・所轄届出・安全区域とリスクアセスメントが前提。本ツールが出すのは演出計画と座組みのみ (SFX-002)。" });
    w.push({ lv: "warn", t: "一発勝負の破壊系イベント → 同時マルチカム (本線+HS+寄り) を推奨 (COV-003)。" });
  }
  const classB = [...types].filter(t => SFX_SAFETY_CLASS[t] === "B");
  if (classB.length) {
    w.push({ lv: "warn", t: `Class B 特効機材 (${classB.map(t => EQUIP_TYPES[t].label).join("・")}): 訓練を受けたクルーによる運用と養生・消火/漏電対策が必要。` });
  }
  if (types.has("smoke") || opts.has("haze")) {
    w.push({ lv: "info", t: "スモーク/ヘイズ: 会場の火災報知器対応と換気計画、テイク間の充満待ちを段取りに含める。" });
  }

  /* --- 物理的実現性 --- */
  const fps = parseFps(cut.camera.fps);
  if (fps >= 100) {
    const stops = Math.log2(fps / 24).toFixed(1);
    w.push({ lv: "warn", t: `ハイスピード ${fps}fps: 24fps比で約 +${stops} 段の光量が必要 (LGT-002)。フリッカーフリー電源/灯体を確認。` });
  }
  if ((opts.has("rain") || opts.has("snow")) && an.rimPower === 0) {
    w.push({ lv: "warn", t: "雨・雪は逆光がないとほぼ写らない (SFX-001)。バック/サイドバックのライトを追加してください。" });
  }
  if (opts.has("steam") && ["white", "bright", "day", "sky"].includes(cut.bgStyle)) {
    w.push({ lv: "warn", t: "湯気・スチームは明るい背景では消える。被写体背後に暗い面を作り逆光で抜くこと。" });
  }
  if (opts.has("splash")) {
    const denom = parseShutterDenom(cut.camera.shutter);
    if (fps < 120 && (!denom || denom < 1000)) {
      w.push({ lv: "warn", t: "スプラッシュの凍結には 1/1000s 以上のシャッター、ハイスピード撮影、または閃光時間の短いストロボが必要。" });
    }
  }
  if (opts.has("silhouette") && an.frontPower > 0) {
    w.push({ lv: "warn", t: "シルエット指定なのに正面光が点灯している。前面の灯を消すか出力0にしないと輪郭が濁る。" });
  }

  /* --- 材質物理 (subject material) --- */
  if (cut.subjectType === "bottle" && an.bgPower === 0 && !opts.has("silhouette")) {
    w.push({ lv: "info", t: "透明ガラス/液体は「透過光+エッジ制御」で設計する。背面の面光源 (背景ライト) の追加を推奨。" });
  }
  if (opts.has("gloss") && ["black", "dark"].includes(cut.bgStyle)) {
    w.push({ lv: "info", t: "黒い光沢面は照度ではなく「写り込む光源の形」で描く (LGT-003)。ストリップ等の細長い面光源をエッジに正対させる。" });
  }

  /* --- 演出と機材の整合 --- */
  if (opts.has("rain") && !types.has("rainmachine")) w.push({ lv: "info", t: "雨オプションON: レインマシンが未配置です。" });
  if (opts.has("snow") && !types.has("snowmachine")) w.push({ lv: "info", t: "雪オプションON: スノーマシンが未配置です。" });
  if (opts.has("wind") && !types.has("fan")) w.push({ lv: "info", t: "風オプションON: 送風機が未配置です。" });
  if (opts.has("sparks") && !types.has("spark")) w.push({ lv: "info", t: "火花オプションON: スパークマシンが未配置です。" });
  if (opts.has("confetti") && !types.has("confetti")) w.push({ lv: "info", t: "紙吹雪オプションON: キャノンが未配置です。" });
  if (an.frontPower === 0 && an.rimPower === 0 && an.bgPower === 0 && !["outdoor"].includes(state.mode)) {
    w.push({ lv: "warn", t: "点灯しているライトがありません。" });
  }

  /* --- カメラ/動きの整合 --- */
  if (cut.camera.move === "fix" && cut.kind !== "still") {
    w.push({ lv: "info", t: "フィックス: AI生成時は camerafixed=true の併用がプロンプトより確実。" });
  }
  if (["d_chase", "d_dive", "d_lowpass"].includes(cut.camera.move)) {
    w.push({ lv: "warn", t: "低空・高速のドローン飛行: 事前ロケハン/コース確認と安全マージン、操縦者の資格・許可空域の確認が必須。" });
  }
  return w;
}
