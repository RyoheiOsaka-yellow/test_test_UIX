/* =========================================================
 * Virtual Studio — ロケ地 (演出レイヤー)
 *
 * 「パリの街」では出力が定まらない。場所が場所らしく見えるのは
 * 建築・素材・看板の言語・植生・路面・人の気配の積み重ねによる。
 * ここではその要素を土地ごとに持ち、プロンプトへ渡す。
 *
 * 地図はオフライン動作 (外部通信なし) のため埋め込まない。代わりに
 * Google Maps のURLから座標を取り出し、太陽の方位・高度を自前計算して
 * スタジオの太陽配置とゴールデンアワーの時刻に変換する。
 * 読み込み順: app.js より前
 * ======================================================= */

/* ---------- 太陽位置 (NOAA/SunCalc系の近似・通信不要) ---------- */
const SUN_RAD = Math.PI / 180;
function sunPosition(lat, lng, date) {
  const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const d = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const e = SUN_RAD * 23.4397;                        // 地軸の傾き
  const M = SUN_RAD * (357.5291 + 0.98560028 * d);    // 平均近点角
  const C = SUN_RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + SUN_RAD * 102.9372 + Math.PI;     // 黄経
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const lw = SUN_RAD * -lng, phi = SUN_RAD * lat;
  const H = SUN_RAD * (280.16 + 360.9856235 * d) - lw - ra;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return {
    azimuth: (az / SUN_RAD + 180 + 360) % 360,        // 北を0°とした時計回り
    elevation: alt / SUN_RAD,
  };
}

/* 日の出/日の入り・ゴールデンアワー・ブルーアワーを走査で求める。
 * 時刻は経度から求めた現地太陽時 (時計時刻とは時差分ずれる) */
function sunEvents(lat, lng, ymd) {
  const [y, m, dd] = ymd.split("-").map(Number);
  if (!y || !m || !dd) return null;
  const base = Date.UTC(y, m - 1, dd, 0, 0, 0);
  const step = 2 * 60000;
  const solarOff = lng / 15 * 3600000;                 // 経度による太陽時オフセット
  const fmt = ms => {
    const t = new Date(ms + solarOff);
    return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
  };
  const marks = [
    { key: "rise", th: -0.833, dir: 1 }, { key: "set", th: -0.833, dir: -1 },
    { key: "goldenEnd", th: 6, dir: 1 }, { key: "goldenStart", th: 6, dir: -1 },
    { key: "blueEnd", th: -6, dir: 1 }, { key: "blueStart", th: -6, dir: -1 },
  ];
  const out = { maxEl: -90, maxAt: null };
  let prev = sunPosition(lat, lng, new Date(base)).elevation;
  for (let t = base + step; t <= base + 86400000; t += step) {
    const el = sunPosition(lat, lng, new Date(t)).elevation;
    if (el > out.maxEl) { out.maxEl = el; out.maxAt = fmt(t); }
    for (const mk of marks) {
      if (out[mk.key]) continue;
      const crossed = mk.dir > 0 ? (prev < mk.th && el >= mk.th) : (prev >= mk.th && el < mk.th);
      if (crossed) out[mk.key] = fmt(t);
    }
    prev = el;
  }
  out.polar = !out.rise && !out.set ? (out.maxEl > 0 ? "白夜 (一日中日が沈まない)" : "極夜 (一日中日が昇らない)") : "";
  return out;
}

/* ---------- Google Maps URL / 座標のパース ---------- */
function parseMapsUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  let lat = null, lng = null, name = "";
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);           // 場所ピンの正確な座標
  if (!m) m = s.match(/[@?&](?:ll=|q=)?(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  if (!m) m = s.match(/^\s*(-?\d{1,3}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)\s*$/); // 生の緯度経度
  if (m) { lat = +m[1]; lng = +m[2]; }
  const pn = s.match(/\/maps\/place\/([^/@]+)/);
  if (pn) name = decodeURIComponent(pn[1].replace(/\+/g, " "));
  if (lat === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: /goo\.gl|maps\.app/.test(s)
      ? "短縮URLからは座標を読み取れません。Mapsで開いてからアドレスバーの完全なURL (…/@35.68,139.76,17z…) を貼ってください"
      : "座標が見つかりません。Google MapsのURL、または「35.6586, 139.7454」の形式で入力してください" };
  }
  return { lat, lng, name };
}

function mapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
function streetViewLink(lat, lng) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/* ---------- ロケ地の状態 ---------- */
function locActive(cut) {
  const L = cut.location;
  return !!(L && (L.presetId || L.name || L.coords || L.photoRefId || (L.note || "").trim()));
}
function locPreset(cut) {
  return LOCATION_PRESETS.find(p => p.id === (cut.location && cut.location.presetId)) || null;
}

/* 看板の言語から「その土地では出てはいけないもの」を導く */
const LOC_SIGNAGE_NEG = [
  { re: /Japanese|kanji|kana/i, neg: "no Latin/English shop signage" },
  { re: /Chinese/i, neg: "no Latin/English shop signage" },
  { re: /Hangul|Korean/i, neg: "no Latin/English shop signage" },
  { re: /Thai script/i, neg: "no Latin/English shop signage" },
  { re: /Arabic/i, neg: "no Latin-only signage" },
  { re: /French/i, neg: "no English-language signage" },
  { re: /Italian/i, neg: "no English-language signage" },
  { re: /Spanish/i, neg: "no English-language signage" },
];

/* プロンプトに足すロケ地ブロック (未設定なら空文字) */
function buildLocationBlock(cut, prose) {
  if (!locActive(cut)) return "";
  const L = cut.location;
  const p = locPreset(cut);
  const keep = (L.keep && L.keep.length ? L.keep : LOCATION_ASPECTS.map(a => a.id));
  const partsMap = p ? {
    arch: p.arch, material: p.material, signage: p.signage,
    vegetation: p.vegetation, ground: p.ground, life: p.life, sky: p.sky,
  } : {};
  const details = LOCATION_ASPECTS
    .filter(a => keep.includes(a.id) && partsMap[a.id])
    .map(a => `${a.en}: ${partsMap[a.id]}`);
  /* メモ (許可・段取り) は現場向けの情報なので生成プロンプトには入れない */
  const head = [p ? p.en : "", L.name || ""].filter(Boolean).join(" — ");

  /* 太陽 (座標と日時があるときだけ) */
  let sun = "";
  if (L.coords && L.date && L.time) {
    const s = locSunNow(cut);
    if (s) {
      sun = `natural sun from ${Math.round(s.azimuth)}° compass at ${Math.round(s.elevation)}° above the horizon`
        + (s.elevation < 0 ? " (below the horizon — night)"
          : s.elevation < 6 ? " (golden hour, long warm shadows)"
          : s.elevation > 60 ? " (high overhead sun, short hard shadows)" : "");
    }
  }
  /* 写真から測った空気感 (光と色) — 参照写真が一番正確に持っている情報 */
  const photo = L.photoTraits && L.usePhoto !== false ? L.photoTraits.en.join(", ") : "";

  const negs = [];
  if (p) LOC_SIGNAGE_NEG.forEach(n => { if (n.re.test(p.signage || "")) negs.push(n.neg); });
  if (p && /none/i.test(p.vegetation || "")) negs.push("no trees or planting");

  if (prose) {
    return [
      `Location: ${head}.`,
      details.length ? details.join("; ") + "." : "",
      photo ? `Light and colour as in the location photo: ${photo}.` : "",
      sun ? `Sun: ${sun}.` : "",
      negs.length ? `Avoid: ${negs.join(", ")}.` : "",
    ].filter(Boolean).join(" ");
  }
  return [
    `LOCATION: ${head}`,
    details.length ? details.map(d => `- ${d}`).join("\n") : "",
    photo ? `LOCATION LIGHT (from photo): ${photo}` : "",
    sun ? `SUN: ${sun}` : "",
    negs.length ? `LOCATION NEGATIVE: ${negs.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

/* 現在設定の日時での太陽位置 */
function locSunNow(cut) {
  const L = cut.location;
  if (!L || !L.coords || !L.date || !L.time) return null;
  const [hh, mm] = String(L.time).split(":").map(Number);
  const [y, mo, d] = String(L.date).split("-").map(Number);
  if (!y || isNaN(hh)) return null;
  /* 入力時刻は現地太陽時として扱う (時差はUTCへ戻して計算) */
  const utcMs = Date.UTC(y, mo - 1, d, hh, mm || 0) - (L.coords.lng / 15) * 3600000;
  return sunPosition(L.coords.lat, L.coords.lng, new Date(utcMs));
}

/* 太陽の方位をカメラ基準の相対角へ (カメラの向き camBearing を基準) */
function locSunRelative(cut) {
  const s = locSunNow(cut);
  if (!s) return null;
  const bearing = +(cut.location.camBearing ?? 0);
  const rel = ((s.azimuth - bearing + 540) % 360) - 180; // -180..180 (0=被写体の奥=逆光)
  return { ...s, rel };
}

/* スタジオの太陽アイテムへ反映 — ロケ地とスタジオを繋ぐ */
function applySunToStudio(cut) {
  const s = locSunRelative(cut);
  if (!s) { showToast("⚠️ 座標と日時を入力すると太陽を配置できます"); return false; }
  if (s.elevation <= 0) { showToast("⚠️ その日時は日の出前/日の入り後です (太陽高度 " + s.elevation.toFixed(1) + "°)"); return false; }
  const sub = cut.items.find(i => i.type === "subject") || SUBJECT_POS;
  const cam = cut.items.find(i => i.type === "camera") || CAMERA_POS;
  /* カメラの向き (方位) が camDir に対応する。太陽の方位差 rel をそのまま
   * studio角へ移し、被写体から見た太陽の方向に配置する
   * (rel≈0 = カメラが太陽を向いている = 逆光 → 太陽は被写体の奥) */
  const camDir = Math.atan2(sub.y - cam.y, sub.x - cam.x);     // カメラ→被写体
  const toSun = camDir + s.rel * SUN_RAD;                       // 被写体→太陽
  const R = 420;                                               // 配置半径 (cm)
  let sun = cut.items.find(i => i.type === "sun");
  if (!sun) {
    sun = makeItem({ type: "sun", x: 0, y: 0, power: 100, colorTemp: 5600 });
    cut.items.push(sun);
  }
  sun.x = sub.x + R * Math.cos(toSun);
  sun.y = sub.y + R * Math.sin(toSun);
  sun.height = Math.max(60, Math.min(5000, Math.round(R * Math.tan(Math.max(3, s.elevation) * SUN_RAD))));
  /* 低い太陽ほど暖色 (大気による減衰) */
  sun.colorTemp = s.elevation < 5 ? 2800 : s.elevation < 12 ? 3600 : s.elevation < 25 ? 4800 : 5600;
  sun.power = Math.min(100, Math.round(40 + s.elevation));
  refresh(); renderInspector();
  showToast(`太陽を配置しました (方位${Math.round(s.azimuth)}° / 高度${s.elevation.toFixed(1)}° / ${sun.colorTemp}K)`);
  return true;
}

/* =========================================================
 * ロケ地写真からの空気感の取り込み
 * 写真が一番正確に持っているのは「その場の光と色」。
 * 解析はブラウザ内だけで完結し、画像はどこにも送信されない。
 * ======================================================= */

/* 画像 (dataURL) の輝度・コントラスト・色温度・彩度を測る */
function locPhotoStats(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = 96, H = 54;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0, W, H);
      try {
        const st = frameStats(cx, W, H);
        resolve({ mean: st.mean, contrast: st.contrast, warmth: st.warmth, sat: st.sat });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/* 測定値を、言葉 (日本語の確認用 / 英語のプロンプト用) と設定の推定に変換する */
function locPhotoDescribe(st) {
  if (!st) return null;
  const ja = [], en = [];
  if (st.warmth > 0.06) { ja.push("暖色 (夕方・タングステン寄り)"); en.push("warm golden light"); }
  else if (st.warmth < -0.03) { ja.push("寒色 (曇天・日陰寄り)"); en.push("cool blue-grey light"); }
  else { ja.push("ニュートラルな色"); en.push("neutral daylight colour"); }

  if (st.contrast > 0.7) { ja.push("硬い光 (影が濃い)"); en.push("hard directional light with deep shadows"); }
  else if (st.contrast < 0.35) { ja.push("柔らかい光 (影が薄い)"); en.push("soft flat light, shadows barely visible"); }
  else { ja.push("中間のコントラスト"); en.push("moderate contrast"); }

  if (st.mean > 0.6) { ja.push("明るい (ハイキー)"); en.push("bright high-key exposure"); }
  else if (st.mean < 0.26) { ja.push("暗い (ローキー)"); en.push("dark low-key exposure"); }

  if (st.sat > 0.28) { ja.push("彩度が高い"); en.push("saturated colour palette"); }
  else if (st.sat < 0.09) { ja.push("彩度が低い (ほぼ無彩色)"); en.push("desaturated, near-monochrome palette"); }

  /* 設定の推定 (自動適用はせず、ボタンで反映させる) */
  const guess = {};
  if (st.warmth > 0.07 && st.contrast > 0.45 && st.mean > 0.3) guess.timeOfDay = "golden";
  else if (st.warmth < -0.03 && st.contrast < 0.4) { guess.weather = "cloudy"; }
  else if (st.mean < 0.26) guess.timeOfDay = "night";
  if (st.sat < 0.09) guess.look = "mono";
  else if (st.sat > 0.3 && st.warmth > 0.03) guess.look = "filmwarm";
  return { ja, en, guess, stats: st };
}

/* カットにロケ地写真を割り当てて解析する (参照素材として保存され、
 * プロジェクト保存・バックアップにも乗る) */
async function locSetPhoto(cut, refId) {
  cut.location.photoRefId = refId || null;
  cut.location.photoTraits = null;
  if (!refId) return null;
  const ref = (state.story.refs || []).find(r => r.id === refId);
  if (!ref || !ref.dataUrl) return null;
  const st = await locPhotoStats(ref.dataUrl);
  const desc = locPhotoDescribe(st);
  cut.location.photoTraits = desc ? { ja: desc.ja, en: desc.en, guess: desc.guess, stats: desc.stats } : null;
  return cut.location.photoTraits;
}

/* 推定した時間帯・天候・ルックをカットへ反映する (明示操作) */
function locApplyPhotoGuess(cut) {
  const g = cut.location.photoTraits && cut.location.photoTraits.guess;
  if (!g || !Object.keys(g).length) { showToast("この写真からは時間帯・天候の推定ができませんでした"); return false; }
  const done = [];
  if (g.timeOfDay && TIMES_OF_DAY.some(t => t.id === g.timeOfDay)) {
    cut.timeOfDay = g.timeOfDay;
    done.push("時間帯: " + (TIMES_OF_DAY.find(t => t.id === g.timeOfDay) || {}).label);
  }
  if (g.weather && WEATHERS.some(w => w.id === g.weather)) {
    cut.weather = g.weather;
    done.push("天候: " + (WEATHERS.find(w => w.id === g.weather) || {}).label);
  }
  if (g.look && LOOKS.some(l => l.id === g.look)) {
    cut.look = g.look;
    done.push("ルック: " + (LOOKS.find(l => l.id === g.look) || {}).label);
  }
  refresh(); renderInspector();
  showToast(done.length ? "写真から反映しました — " + done.join(" / ") : "反映できる項目がありませんでした");
  return true;
}

/* ---------- ロケ地ライブラリ (オーバーレイ) ---------- */
let locTargetCut = null;   // 適用先のカット index
function renderLocationLib() {
  const q = (byId("locSearch").value || "").trim().toLowerCase();
  const region = byId("locRegion").value;
  const list = LOCATION_PRESETS.filter(p =>
    (!region || p.region === region)
    && (!q || `${p.label} ${p.en} ${p.tags.join(" ")} ${p.arch} ${p.life}`.toLowerCase().includes(q)));
  const cut = state.cuts[locTargetCut] || activeCut();
  const cur = cut.location && cut.location.presetId;
  byId("locGrid").innerHTML = list.map(p => `
    <div class="loc-card ${p.id === cur ? "current" : ""}">
      <div class="loc-head">
        <div>
          <div class="loc-name">${esc(p.label)}</div>
          <div class="loc-region">${esc((LOCATION_REGIONS.find(r => r.id === p.region) || {}).label || "")} ｜ ${esc(p.en)}</div>
        </div>
        <div class="loc-tags">${p.tags.map(t => `<span class="p-tag">${esc(t)}</span>`).join("")}</div>
      </div>
      <dl class="loc-aspects">
        ${LOCATION_ASPECTS.map(a => p[a.id === "material" ? "material" : a.id] ? `
          <dt>${esc(a.label)}</dt><dd>${esc(p[a.id === "material" ? "material" : a.id])}</dd>` : "").join("")}
      </dl>
      <div class="loc-note">☀️ ${esc(p.lightNote)}</div>
      <div class="loc-note">📋 ${esc(p.permit)}</div>
      <button class="btn small primary" data-locapply="${p.id}">C${(locTargetCut ?? state.activeCut) + 1} に適用</button>
    </div>`).join("") || `<p class="insp-hint">該当するロケ地がありません</p>`;
  byId("locCount").textContent = `${list.length}件`;
}

function openLocationLib(cutIdx) {
  locTargetCut = cutIdx != null ? cutIdx : state.activeCut;
  byId("locOverlay").hidden = false;
  renderLocationLib();
}

function setupLocationPage() {
  /* ロケ地写真の取り込み — 参照素材として保存してから解析する */
  byId("locPhotoInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    const ci = +e.target.dataset.ci;
    e.target.value = "";
    const cut = state.cuts[ci];
    if (!file || !cut) return;
    const before = state.story.refs.length;
    await wfAddRefFiles([file]);
    if (state.story.refs.length === before) { showToast("⚠️ この画像は読み込めませんでした"); return; }
    const ref = state.story.refs[state.story.refs.length - 1];
    await locSetPhoto(cut, ref.id);
    refresh(); renderInspector();
    if (!byId("scriptOverlay").hidden) renderScriptPage();
    showToast("ロケ地写真の光と色を取り込みました");
  });

  byId("locRegion").innerHTML = `<option value="">すべての地域</option>`
    + LOCATION_REGIONS.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join("");
  byId("btnLocBack").addEventListener("click", () => { byId("locOverlay").hidden = true; });
  byId("locSearch").addEventListener("input", renderLocationLib);
  byId("locRegion").addEventListener("change", renderLocationLib);
  byId("locGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-locapply]");
    if (!b) return;
    const cut = state.cuts[locTargetCut] || activeCut();
    const p = LOCATION_PRESETS.find(x => x.id === b.dataset.locapply);
    if (!cut || !p) return;
    cut.location = Object.assign({ keep: LOCATION_ASPECTS.map(a => a.id) }, cut.location, { presetId: p.id });
    /* 空・大気の傾向を環境設定にも軽く反映 (上書きはしない) */
    byId("locOverlay").hidden = true;
    refresh(); renderInspector();
    if (!byId("scriptOverlay").hidden) renderScriptPage();
    showToast(`C${state.cuts.indexOf(cut) + 1} のロケ地を「${p.label}」にしました`);
  });
}
