/* =========================================================
 * CineOS V8 移植: Pattern DNA (cineos/knowledge/v8/PATTERN_DNA_MASTER.md)
 * Phase 1 (§36): キュレーション済みDNAアーキタイプ + 自然言語検索 + 適用
 * + §34 DNA Mixer (次元別ブレンド) + §23 来歴 (lineage) 記録
 *
 * DNAは「なぜ効くか」を制御可能な撮影変数で表現する (§6):
 * 悪い例: cinematic, premium
 * 良い例: 大面積ソフト45°+ネガティブフィル / 85-135mm浅い被写界深度 / 10cmの遅いプッシュ
 * ======================================================= */

"use strict";

/* 次元: editorial / camera / lighting / color / movement (§34) */
const DNA_LIBRARY = [
  {
    id: "luxury", name: "ラグジュアリー", family: "commercial",
    keywords: ["高級", "ラグジュアリー", "プレミアム", "上質", "ハイエンド", "luxury"],
    why: "大面積ソフトを45°から+反対側はネガティブフィルで深い影。85-135mmの浅い被写界深度で背景を溶かし、動きは10cm級の極遅プッシュのみ。カットは長く、ディゾルブで繋ぐ。",
    dims: {
      editorial: { durationMul: 1.5, transition: "dissolve", pace: "遅い" },
      camera: { focal: [85, 135], aperture: 2.0 },
      lighting: { fillScale: 0.35, rimBoost: 1.2, contrast: "高 (影を残す)" },
      color: { look: "filmwarm" },
      movement: { moveSpeed: "veryslow", prefMove: "dollyin" },
    },
    tokens: ["restrained premium composition", "large soft key with deep negative fill", "shallow depth of field melting the background", "slow deliberate 10cm push-in"],
    avoid: ["fast cuts", "harsh on-camera flash", "busy background"],
  },
  {
    id: "refreshing", name: "爽快 (リフレッシング)", family: "commercial",
    keywords: ["爽やか", "爽快", "清涼", "フレッシュ", "炭酸", "refreshing"],
    why: "ハイキー寄りの明るい透過光+雫と飛沫のハイスピード。動きは速め、カットは短くリズミカル。青空系の抜けと高彩度。",
    dims: {
      editorial: { durationMul: 0.7, transition: "cut", pace: "速い" },
      camera: { focal: [35, 85], aperture: 4 },
      lighting: { fillScale: 1.3, rimBoost: 1.3, contrast: "低 (明るく)" },
      color: { look: "vivid" },
      movement: { moveSpeed: "fast", prefMove: "track" },
    },
    tokens: ["bright airy backlight", "sparkling condensation and splash energy", "crisp high-key freshness"],
    avoid: ["murky shadows", "warm heavy grade"],
  },
  {
    id: "appetizing", name: "食欲 (シズル)", family: "food",
    keywords: ["食欲", "シズル", "おいしそう", "うまそう", "appetizing"],
    why: "半逆光45°で照りと湯気を立て、暖色4300-5000Kで食欲色に。マクロ寄りの浅い深度、ゆっくり寄る。艶と湯気が主役。",
    dims: {
      editorial: { durationMul: 1.0, transition: "cut", pace: "中" },
      camera: { focal: [85, 100], aperture: 3.2 },
      lighting: { fillScale: 0.7, rimBoost: 1.4, contrast: "中" },
      color: { look: "filmwarm" },
      movement: { moveSpeed: "slow", prefMove: "dollyin" },
    },
    tokens: ["glistening back-side key on texture", "steam catching the backlight", "warm appetizing palette"],
    avoid: ["cold blue cast", "flat frontal light"],
  },
  {
    id: "beauty", name: "ビューティー", family: "beauty",
    keywords: ["ビューティー", "美容", "コスメ", "美肌", "beauty"],
    why: "正面上からの大光面 (クラムシェル) +下からの返しで影を消し、目に大きなキャッチライト。肌のスペキュラーを整え CU 中心。動きは最小限。",
    dims: {
      editorial: { durationMul: 1.2, transition: "dissolve", pace: "遅い" },
      camera: { focal: [85, 100], aperture: 4 },
      lighting: { fillScale: 1.4, rimBoost: 1.0, contrast: "低 (影を消す)" },
      color: { look: "pastel" },
      movement: { moveSpeed: "veryslow", prefMove: "fix" },
    },
    tokens: ["clamshell beauty light with big round catchlights", "smooth controlled skin speculars", "clean close-up framing"],
    avoid: ["hard nose shadow", "green-magenta skin cast"],
  },
  {
    id: "minimal-clinical", name: "ミニマル / クリニカル", family: "product",
    keywords: ["ミニマル", "アップル", "Apple", "クリニカル", "シンプル", "無駄のない", "minimal"],
    why: "被写体以外を徹底的に排除。無地背景+制御された写り込み一本、対称構図、直線的な極遅ムーブ。色は無彩色寄り、余白で語る。",
    dims: {
      editorial: { durationMul: 1.3, transition: "cut", pace: "遅い" },
      camera: { focal: [50, 100], aperture: 5.6 },
      lighting: { fillScale: 0.9, rimBoost: 1.1, contrast: "中 (整った)" },
      color: { look: "natural" },
      movement: { moveSpeed: "veryslow", prefMove: "track" },
    },
    tokens: ["minimal product staging on seamless background", "single controlled reflection line", "symmetric composition with generous negative space", "restrained typography-friendly framing"],
    avoid: ["clutter", "decorative props", "dutch angle"],
  },
  {
    id: "futuristic", name: "近未来 / フューチャリスティック", family: "style",
    keywords: ["近未来", "未来", "サイバー", "SF", "テック", "futuristic"],
    why: "シアン寄りの冷たいベース+アクセントのネオン。ヘイズで光条を可視化し、直線的なスライド移動と正確な等速。黒を締める。",
    dims: {
      editorial: { durationMul: 0.9, transition: "cut", pace: "中" },
      camera: { focal: [24, 50], aperture: 2.8 },
      lighting: { fillScale: 0.5, rimBoost: 1.5, contrast: "高" },
      color: { look: "cyber" },
      movement: { moveSpeed: "normal", prefMove: "track" },
    },
    tokens: ["cool cyan base with neon accents", "haze-defined light beams", "precise linear robotic camera motion"],
    avoid: ["warm cozy tones", "organic handheld wobble"],
  },
  {
    id: "nostalgic", name: "ノスタルジック / レトロ", family: "style",
    keywords: ["ノスタルジ", "レトロ", "懐かし", "90年代", "昭和", "フィルム", "vintage"],
    why: "暖色に転んだハレーション気味のハイライト、ソフトな拡散とグレイン。ズーム/手持ちの不完全な動き、少し長い間。",
    dims: {
      editorial: { durationMul: 1.2, transition: "fadeout", pace: "ゆったり" },
      camera: { focal: [35, 85], aperture: 2.0 },
      lighting: { fillScale: 0.8, rimBoost: 1.3, contrast: "中" },
      color: { look: "filmwarm" },
      movement: { moveSpeed: "slow", prefMove: "handheld" },
    },
    tokens: ["warm halated highlights", "soft diffusion and gentle grain", "imperfect nostalgic camera energy", "held moments that breathe"],
    avoid: ["clinical sharpness", "modern speed ramps"],
  },
  {
    id: "documentary", name: "ドキュメンタリー・ナチュラル", family: "doc",
    keywords: ["ドキュメンタリー", "ナチュラル", "リアル", "自然体", "documentary"],
    why: "自然光/既存光を活かし、補助光は起こす程度。手持ちの呼吸感、被写体を追う反応的なカメラ。演出感を消す。",
    dims: {
      editorial: { durationMul: 1.0, transition: "cut", pace: "自然" },
      camera: { focal: [35, 50], aperture: 2.8 },
      lighting: { fillScale: 1.0, rimBoost: 0.8, contrast: "自然" },
      color: { look: "natural" },
      movement: { moveSpeed: "normal", prefMove: "handheld" },
    },
    tokens: ["available-light naturalism", "reactive observational handheld", "unforced honest moments"],
    avoid: ["stylized gel lighting", "choreographed crane moves"],
  },
  {
    id: "sports", name: "ハイエナジー・スポーツ", family: "sports",
    keywords: ["スポーツ", "躍動", "アスリート", "エナジー", "疾走", "sports"],
    why: "硬いサイド/バックライトで汗と筋肉のエッジを立て、超速カット+ハイスピードの緩急。広角で寄って迫力、追従ムーブ。",
    dims: {
      editorial: { durationMul: 0.5, transition: "whippan", pace: "超速" },
      camera: { focal: [14, 35], aperture: 2.8 },
      lighting: { fillScale: 0.4, rimBoost: 1.8, contrast: "高" },
      color: { look: "bleach" },
      movement: { moveSpeed: "veryfast", prefMove: "d_chase" },
    },
    tokens: ["hard rim light carving muscle and sweat", "wide lens in close for aggression", "speed-ramped chase energy"],
    avoid: ["static tripod distance", "soft romantic glow"],
  },
  {
    id: "intimate", name: "親密ドラマ (インティメット)", family: "drama",
    keywords: ["親密", "静かな", "会話劇", "余韻", "intimate"],
    why: "窓光1方向+浅い深度の長回し。カメラは登場人物の呼吸に合わせた微細な手持ち。沈黙とリアクションを長く持つ。",
    dims: {
      editorial: { durationMul: 1.6, transition: "cut", pace: "長回し" },
      camera: { focal: [50, 85], aperture: 1.8 },
      lighting: { fillScale: 0.6, rimBoost: 0.9, contrast: "柔らかい高コントラスト" },
      color: { look: "natural" },
      movement: { moveSpeed: "veryslow", prefMove: "handheld" },
    },
    tokens: ["single-direction window light", "long held reactions in shallow focus", "breathing intimate camera"],
    avoid: ["rapid coverage cutting", "flashy transitions"],
  },
  {
    id: "suspense", name: "サスペンス", family: "drama",
    keywords: ["サスペンス", "緊張", "スリラー", "不穏", "suspense"],
    why: "ローキー+片側からの硬い光で顔を割る。ゆっくり寄るドリーで圧を上げ、音と静寂で締める。情報を隠すフレーミング。",
    dims: {
      editorial: { durationMul: 1.3, transition: "cut", pace: "じわじわ" },
      camera: { focal: [35, 50], aperture: 2.8 },
      lighting: { fillScale: 0.25, rimBoost: 1.2, contrast: "非常に高" },
      color: { look: "tealorange" },
      movement: { moveSpeed: "veryslow", prefMove: "dollyin" },
    },
    tokens: ["low-key split face in hard light", "creeping slow push building pressure", "withheld information framing"],
    avoid: ["cheerful high-key", "playful whip pans"],
  },
  {
    id: "horror", name: "ホラー", family: "drama",
    keywords: ["ホラー", "恐怖", "怪談", "怖い", "horror"],
    why: "アンダーライトと闇の面積。動かないカメラで「見えない」を長く見せ、要所だけ突発的な速い動き。色は冷たく沈む。",
    dims: {
      editorial: { durationMul: 1.4, transition: "cut", pace: "静→突発" },
      camera: { focal: [24, 35], aperture: 2.0 },
      lighting: { fillScale: 0.15, rimBoost: 0.7, contrast: "極高" },
      color: { look: "cyber" },
      movement: { moveSpeed: "veryslow", prefMove: "fix" },
    },
    tokens: ["darkness occupying most of the frame", "underlight dread", "long motionless watching then sudden movement"],
    avoid: ["even bright illumination", "warm comfort tones"],
  },
  {
    id: "epic", name: "エピック / モニュメンタル", family: "style",
    keywords: ["エピック", "壮大", "スケール", "雄大", "epic"],
    why: "超広角+空撮の引き画でスケールを提示し、人物は小さく置く。ゆっくり上昇するクレーン/ドローン。逆光と大気感。",
    dims: {
      editorial: { durationMul: 1.4, transition: "dissolve", pace: "大きい" },
      camera: { focal: [14, 24], aperture: 5.6 },
      lighting: { fillScale: 0.8, rimBoost: 1.5, contrast: "高" },
      color: { look: "tealorange" },
      movement: { moveSpeed: "slow", prefMove: "d_pullback" },
    },
    tokens: ["monumental wide vistas with a small human figure", "slow rising aerial reveal", "atmospheric backlit scale"],
    avoid: ["cramped tight framing only"],
  },
  {
    id: "social-native", name: "SNSネイティブ / UGC風", family: "social",
    keywords: ["SNS", "TikTok", "リール", "UGC", "スマホっぽい", "バズ", "social"],
    why: "縦9:16+冒頭1秒のフック。スマホ風の広角手持ち、速いジャンプカット、字幕前提の中央寄り構図。作り込みすぎない光。",
    dims: {
      editorial: { durationMul: 0.5, transition: "jumpcut", pace: "超速フック" },
      camera: { focal: [24, 35], aperture: 2.8 },
      lighting: { fillScale: 1.2, rimBoost: 0.9, contrast: "低" },
      color: { look: "vivid" },
      movement: { moveSpeed: "fast", prefMove: "handheld" },
    },
    tokens: ["vertical phone-native energy", "first-second hook framing", "authentic casual light"],
    avoid: ["cinematic letterbox", "slow establishing openings"],
    aspect: "9:16",
  },
  {
    id: "fashion-editorial", name: "ファッション・エディトリアル", family: "fashion",
    keywords: ["ファッション", "エディトリアル", "モード", "ヴォーグ", "fashion"],
    why: "硬い単灯を高めから直射し、影を構図の一部としてデザイン。ポーズは静止、カットは大胆に間引く。彩度を抑えたグラフィカルな画。",
    dims: {
      editorial: { durationMul: 0.9, transition: "cut", pace: "スタッカート" },
      camera: { focal: [50, 85], aperture: 8 },
      lighting: { fillScale: 0.3, rimBoost: 1.0, contrast: "極高 (影をデザイン)" },
      color: { look: "bleach" },
      movement: { moveSpeed: "normal", prefMove: "fix" },
    },
    tokens: ["hard single-source fashion light", "shadows designed as graphic shapes", "held sculptural poses"],
    avoid: ["soft romantic diffusion everywhere"],
  },
  {
    id: "automotive-premium", name: "自動車プレミアム", family: "automotive",
    keywords: ["自動車", "カーCM", "クルマ", "走行美", "automotive"],
    why: "ボディに走る一本の細長い写り込みを設計し、ロー気味の並走でスピードの品格を出す。黒背景or夜明けの空。リグ消し前提の複合ムーブ。",
    dims: {
      editorial: { durationMul: 1.1, transition: "dissolve", pace: "滑らか" },
      camera: { focal: [35, 85], aperture: 4 },
      lighting: { fillScale: 0.4, rimBoost: 1.6, contrast: "高" },
      color: { look: "tealorange" },
      movement: { moveSpeed: "slow", prefMove: "d_side" },
    },
    tokens: ["one long designed reflection traveling the body line", "low parallel tracking with dignified speed", "sculpted dark automotive stage"],
    avoid: ["random busy reflections", "shaky amateur pans"],
  },
];

/* 手動注釈で作られたカスタムDNA (state.customDNA) を含む全DNA */
function allDNA() {
  const custom = (typeof state !== "undefined" && Array.isArray(state.customDNA)) ? state.customDNA : [];
  return DNA_LIBRARY.concat(custom);
}

/* ---------- 自然言語検索 (§21, §33) ---------- */
function searchDNA(query) {
  const q = String(query || "").toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const dna of allDNA()) {
    const matched = (dna.keywords || []).filter(k => k && q.includes(k.toLowerCase()));
    if (matched.length) hits.push({ dna, matched, score: matched.length });
  }
  return hits.sort((a, b) => b.score - a.score);
}

/* =========================================================
 * Failure DNA (§27): 生成AIで再発しやすい失敗モード → 安全な分解の推奨
 * ======================================================= */
const FAILURE_DNA = [
  {
    id: "liquid-complex-move",
    when: c => (c.options.includes("splash") || c.action === "pour") &&
      ["orbit", "d_orbit", "dollyzoom", "d_dzoom", "whip", "arc", "d_spiral"].includes(c.camera.move),
    risk: "複雑なカメラ移動中の液体は形状が破綻しやすい",
    safer: "カメラは固定/直線の遅い移動にし、液体側だけを動かす。または実写ハイスピード撮影を推奨",
  },
  {
    id: "label-rotation",
    when: c => ["bottle", "cosme"].includes(c.subjectType) &&
      ["orbit", "d_orbit", "rotate"].includes(c.camera.move) || (["bottle", "cosme"].includes(c.subjectType) && c.action === "rotate"),
    risk: "回転中に商品ラベル/ロゴが変形・崩壊しやすい",
    safer: "参照画像 (first frame) を必ず与え、回転は45°以内の部分回転に分割。正確なパックショットは実写/CGを推奨",
  },
  {
    id: "hands-product",
    when: c => c.action === "hands" || (c.action === "pour" && c.subjectType !== "person"),
    risk: "商品を扱う手指は本数・関節が破綻しやすい",
    safer: "手元は実写インサートで撮り、AI生成は手が写らない構図に分解する",
  },
  {
    id: "overloaded-prompt",
    when: c => c.kind !== "still" && (c.duration || 5) >= 10 && c.options.length >= 3,
    risk: "長尺+多要素の1プロンプトはビート過積載で破綻する (§27)",
    safer: "1ショット=1〜2アクションに分割し、編集で繋ぐ (「3カットに展開」も有効)",
  },
  {
    id: "whip-identity",
    when: c => c.transition === "whippan" || c.camera.move === "whip",
    risk: "ウィップパン中に被写体のアイデンティティ (顔・服装) が変わりやすい",
    safer: "ウィップはカット割り+編集ブラーで作り、生成は前後の静止側だけにする",
  },
  {
    id: "rain-consistency",
    when: c => c.options.includes("rain") || c.weather === "rainy",
    risk: "雨の密度・方向がカット間で変わりやすい",
    safer: "全カットのプロンプトに同じ雨記述を繰り返し、濡れの継続 (continuity) を明示する",
  },
  {
    id: "fast-parallax",
    when: c => ["d_chase", "d_lowpass", "d_dive", "d_gap"].includes(c.camera.move),
    risk: "高速の空撮的移動は背景パララックスが物理的に破綻しやすい",
    safer: "速度を1段落とすか、実写FPV素材+AI背景拡張のハイブリッドを検討",
  },
];

function evaluateFailureDNA(cut) {
  return FAILURE_DNA.filter(f => { try { return f.when(cut); } catch { return false; } })
    .map(f => ({ id: f.id, risk: f.risk, safer: f.safer }));
}

/* =========================================================
 * 実行モードルーティング (§28): Real / AI / CG / Hybrid を能力ベースで推奨
 * ======================================================= */
function routeExecution(cut) {
  const fails = evaluateFailureDNA(cut);
  const opts = new Set(cut.options);
  if (opts.has("explosion")) {
    return { mode: "実写特効 (Class C) + マルチカム、またはAI生成+実写プレート合成", reason: "一発勝負の破壊系。実写なら特効技師専任、AIなら人物プレートと分離生成が安全" };
  }
  if ((opts.has("splash") || cut.action === "pour") && ["bottle", "food", "cosme"].includes(cut.subjectType)) {
    return { mode: "実写ハイスピード (または制御CG)", reason: "物理的に複雑な液体マクロは生成AIより実写HS/CGが歩留まり良 (§28)" };
  }
  if (["bottle", "cosme"].includes(cut.subjectType) && opts.has("gloss") && ["ECU", "CU"].includes(cut.camera.shotSize)) {
    return { mode: "実写/CG (パックショット品質)", reason: "ブランドロゴ・形状の忠実性が必要な寄りは幾何制御の効く実写/CGを推奨" };
  }
  if (fails.length >= 2) {
    return { mode: "ハイブリッド (実写プレート + AI)", reason: `破綻リスクが${fails.length}件。リスク要素を実写で押さえ、環境をAIで拡張する分担が安全` };
  }
  if (cut.subjectType === "person" && !opts.has("splash") && cut.kind !== "still") {
    return { mode: "AI生成向き", reason: "雰囲気系の人物ショットは生成AIの得意領域。被写体記述の一貫性だけ担保する" };
  }
  return null;
}

/* ---------- DNA適用 (§29 に向けた制御変数の書き込み) ----------
 * use: {editorial, camera, lighting, color, movement} 各 true/false */
function applyPatternDNA(cut, dna, use, lineage) {
  const U = Object.assign({ editorial: true, camera: true, lighting: true, color: true, movement: true }, use || {});
  const D = dna.dims;
  if (U.editorial && D.editorial) {
    if (cut.kind !== "still") {
      cut.duration = Math.max(2, Math.min(20, Math.round((cut.duration || 5) * D.editorial.durationMul)));
    }
    cut.transition = D.editorial.transition || cut.transition;
  }
  if (U.camera && D.camera) {
    const [mn, mx] = D.camera.focal;
    if (cut.camera.focalMm < mn || cut.camera.focalMm > mx) cut.camera.focalMm = Math.round((mn + mx) / 2);
    cut.camera.apertureF = D.camera.aperture;
  }
  if (U.movement && D.movement) {
    cut.camera.moveSpeed = D.movement.moveSpeed;
    if (cut.camera.move === "fix" && D.movement.prefMove && D.movement.prefMove !== "fix") {
      cut.camera.move = D.movement.prefMove;
      const supId = MOVE_SUPPORT[D.movement.prefMove] || "tripod";
      cut.camera.support = supId;
      const sup = CAMERA_SUPPORTS.find(s => s.id === supId);
      cut.camera.supportParam = sup && sup.param ? sup.param.def : 0;
    }
  }
  if (U.lighting && D.lighting) {
    for (const it of cut.items) {
      if (it.type === "fill") it.power = Math.max(0, Math.min(100, Math.round(it.power * D.lighting.fillScale)));
      if (["rim", "back"].includes(it.type)) it.power = Math.max(0, Math.min(100, Math.round(it.power * D.lighting.rimBoost)));
    }
  }
  if (U.color && D.color && D.color.look) cut.look = D.color.look;
  if (dna.aspect && U.editorial) cut.aspect = dna.aspect;

  cut.dna = {
    name: dna.name,
    tokens: dna.tokens.slice(),
    avoid: (dna.avoid || []).slice(),
    lineage: lineage || { sources: [dna.id], weights: null, date: new Date().toISOString().slice(0, 10) },
  };
  return cut;
}

/* ---------- DNA Mixer (§34): 次元別に A↔B をブレンド ----------
 * weights: {editorial, camera, lighting, color, movement} 各 0(A)〜1(B) */
function mixDNA(a, b, weights) {
  const w = weights || {};
  const pick = (dim) => (w[dim] ?? 0.5) < 0.5 ? a : b;
  const lerp = (va, vb, t) => va + (vb - va) * t;
  const tE = w.editorial ?? 0.5, tC = w.camera ?? 0.5, tL = w.lighting ?? 0.5;
  return {
    id: `mix-${a.id}-${b.id}`,
    name: `${a.name} × ${b.name}`,
    family: "mix",
    keywords: [],
    why: `ミックス: editorial=${pick("editorial").name} / camera=${pick("camera").name} / lighting=${pick("lighting").name} / color=${pick("color").name} / movement=${pick("movement").name}`,
    dims: {
      editorial: {
        durationMul: lerp(a.dims.editorial.durationMul, b.dims.editorial.durationMul, tE),
        transition: pick("editorial").dims.editorial.transition,
        pace: pick("editorial").dims.editorial.pace,
      },
      camera: {
        focal: [
          Math.round(lerp(a.dims.camera.focal[0], b.dims.camera.focal[0], tC)),
          Math.round(lerp(a.dims.camera.focal[1], b.dims.camera.focal[1], tC)),
        ],
        aperture: +lerp(a.dims.camera.aperture, b.dims.camera.aperture, tC).toFixed(1),
      },
      lighting: {
        fillScale: +lerp(a.dims.lighting.fillScale, b.dims.lighting.fillScale, tL).toFixed(2),
        rimBoost: +lerp(a.dims.lighting.rimBoost, b.dims.lighting.rimBoost, tL).toFixed(2),
        contrast: pick("lighting").dims.lighting.contrast,
      },
      color: { look: pick("color").dims.color.look },
      movement: pick("movement").dims.movement,
    },
    tokens: [...new Set([...pick("lighting").tokens.slice(0, 2), ...pick("camera").tokens.slice(0, 1), ...pick("editorial").tokens.slice(0, 1)])],
    avoid: [...new Set([...(a.avoid || []), ...(b.avoid || [])])].slice(0, 4),
    aspect: pick("editorial").aspect,
  };
}
