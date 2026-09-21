// 人流ポテンシャル評価 v0.1 UI (MapLibre + deck.gl, ビルド不要)
const { MapboxOverlay, GeoJsonLayer, ScatterplotLayer } = deck;
const API = "";
const $ = (id) => document.getElementById(id);
const state = { mode: "realestate", period: null, periodB: null, dayType: "weekday", timeBand: "all", compare: null, area: null, links: null, buildings: null, sites: null, selectedLink: null };

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: { gsi: { type: "raster", tiles: ["https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"], tileSize: 256, attribution: "地理院タイル | © OpenStreetMap contributors | 人流: 国土交通省 人流オープンデータ（Agoop換算人口） | 建物: PLATEAU 岡山市 | 通行量: 岡山市（CC BY 4.0）" } },
    layers: [{ id: "gsi", type: "raster", source: "gsi", paint: { "raster-opacity": 0.85, "raster-saturation": -0.6, "raster-brightness-max": 0.55 } }],
  },
  center: [133.9245, 34.664], zoom: 14.6, pitch: 45, bearing: -10, antialias: true,
});
map.addControl(new maplibregl.NavigationControl(), "top-left");
const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
map.addControl(overlay);

// ---- helpers ------------------------------------------------------------
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? "—" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: d }));
const pctColor = (p) => { // 0..100 → 青→黄→赤
  const t = Math.max(0, Math.min(1, (p || 0) / 100));
  const stops = [[37, 99, 235], [34, 197, 94], [250, 204, 21], [249, 115, 22], [220, 38, 38]];
  const i = Math.min(3, Math.floor(t * 4)); const f = t * 4 - i;
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
};
const divColor = (ratio) => { // 差分: <1 青, 1 白, >1 赤
  if (ratio == null || !isFinite(ratio)) return [160, 160, 160, 120];
  const t = Math.max(-1, Math.min(1, Math.log2(ratio)));
  return t < 0 ? [Math.round(255 + 200 * t), Math.round(255 + 120 * t), 255, 220] : [255, Math.round(255 - 200 * t), Math.round(255 - 220 * t), 220];
};
const usageColor = { retail: [249, 115, 22], office: [59, 130, 246], residential: [148, 163, 184], mixed: [234, 179, 8], hotel: [168, 85, 247], public: [20, 184, 166], industrial: [100, 116, 139], other: [120, 120, 120] };
const usageJa = { retail: "商業", office: "業務", residential: "住宅", mixed: "店舗併用住宅", hotel: "宿泊", public: "公共", industrial: "工業・倉庫", other: "その他" };

async function getJSON(url, opt) { const r = await fetch(API + url, opt); if (!r.ok) throw new Error(await r.text()); return r.json(); }
const post = (url, body) => getJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ---- data loading -------------------------------------------------------
async function loadArea() {
  state.area = await getJSON("/areas/current");
  const ps = state.area.periods;
  for (const sel of [$("period"), $("periodB")]) { sel.innerHTML = ps.map((p) => `<option value="${p}">${p}</option>`).join(""); }
  state.period = state.area.baseline_period && ps.includes(state.area.baseline_period) ? state.area.baseline_period : ps[0];
  $("period").value = state.period;
  state.periodB = ps[ps.length - 1]; $("periodB").value = state.periodB;
  const c = state.area.calibration;
  $("calib").innerHTML = `<h3>較正状況</h3><div class="note">実測 ${c.n_sites ?? "—"} 地点（平休別）に対する Spearman: in-sample ${c.spearman_in_sample ?? "—"} / 空間ブロックCV ${c.spearman_block_cv ?? "—"}。距離抵抗 half=${c.half_distance_m ?? "—"}m。<br/>建物 ${fmt(state.area.counts.buildings)} 棟・街路リンク ${fmt(state.area.counts.links)} 本。</div>`;
  $("legend").innerHTML = `<h3>凡例</h3><div class="note"><span class="sw" style="background:rgb(37,99,235)"></span>通行量 下位 → <span class="sw" style="background:rgb(250,204,21)"></span> → <span class="sw" style="background:rgb(220,38,38)"></span>上位（エリア内パーセンタイル、線の太さ＝通行量）<br/>建物の高さ＝階数、色＝用途（<span style="color:rgb(249,115,22)">商業</span>・<span style="color:rgb(59,130,246)">業務</span>・<span style="color:rgb(148,163,184)">住宅</span>・<span style="color:rgb(234,179,8)">店舗併用</span>・<span style="color:rgb(20,184,166)">公共</span>）<br/>◎ 実測地点（岡山市 AIカメラ）</div>`;
  $("panel-sources").innerHTML = `<b>出典</b>: ${state.area.sources.map((s) => s.credit || s.name).join(" / ")}<br/><b>免責</b>: ${state.area.disclaimer.replace(/\n/g, " ")}`;
}
async function loadLayers() {
  const q = `period=${state.period}&day_type=${state.dayType}&time_band=${state.timeBand}`;
  const [links, buildings, sites] = await Promise.all([
    getJSON(`/links/flow?${q}`),
    state.buildings && state.buildings._key === `${state.period}|${state.dayType}` ? state.buildings : getJSON(`/buildings/pop?period=${state.period}&day_type=${state.dayType}&time_band=day`),
    state.sites || getJSON("/sites"),
  ]);
  buildings._key = `${state.period}|${state.dayType}`;
  state.links = links; state.buildings = buildings; state.sites = sites;
  render();
}

// ---- rendering ----------------------------------------------------------
function render() {
  const layers = [];
  const cmp = state.compare;
  layers.push(new GeoJsonLayer({
    id: "links", data: cmp ? cmp.links : state.links, pickable: true, lineWidthUnits: "meters", lineWidthMinPixels: 1,
    getLineColor: (f) => cmp ? divColor(f.properties.ratio) : (f.properties.flow_calibrated > 0 ? [...pctColor(f.properties.pct), 230] : [90, 90, 90, 60]),
    getLineWidth: (f) => cmp ? 3 + Math.min(12, Math.abs(f.properties.diff || 0) / 400) : 1.5 + Math.sqrt(f.properties.flow_calibrated || 0) / 6,
    onClick: (info) => info.object && onLinkClick(info.object),
    updateTriggers: { getLineColor: [cmp], getLineWidth: [cmp] },
  }));
  if ($("chk3d").checked && state.buildings) {
    layers.push(new GeoJsonLayer({
      id: "buildings", data: state.buildings, pickable: true, extruded: true, wireframe: false, opacity: 0.55,
      getElevation: (f) => f.properties.height_m || 6,
      getFillColor: (f) => [...(usageColor[f.properties.usage_class] || [120, 120, 120]), 200],
      onClick: (info) => info.object && onBuildingClick(info.object),
    }));
  }
  if ($("chkSites").checked && state.sites) {
    layers.push(new GeoJsonLayer({
      id: "sites", data: state.sites, pickable: true, pointType: "circle", pointRadiusUnits: "meters", getPointRadius: 12,
      getFillColor: (f) => (f.properties.kind === "street" ? [255, 255, 255, 230] : [255, 255, 255, 110]), getLineColor: [0, 0, 0, 200], lineWidthMinPixels: 1.5,
      onClick: (info) => info.object && showSite(info.object.properties),
    }));
  }
  overlay.setProps({ layers, getTooltip: tooltip });
}
function tooltip({ object, layer }) {
  if (!object) return null;
  const p = object.properties;
  if (layer.id === "links") return state.compare ? `${p.name || "(無名)"}\nA ${fmt(p.a)} → B ${fmt(p.b)} 人/日（×${p.ratio ?? "—"}）` : `${p.name || "(無名)"} [${p.highway_type}]\n推定 ${fmt(p.flow_calibrated)} 人/日（上位 ${fmt(100 - p.pct)}%）信頼度 ${p.confidence}`;
  if (layer.id === "buildings") return `${usageJa[p.usage_class] || p.usage_class} ${p.floors}F 延床 ${fmt(p.gfa)}m²\n滞在人口(平日昼) ${p.pop_masked ? "—(秘匿)" : fmt(p.pop_est)} 人`;
  if (layer.id === "sites") return `実測 ${p.site_id} ${p.name}\n${p.obs_period || ""} 平日平均 ${fmt(p.obs_weekday)} 人/日`;
  return null;
}

// ---- report panel -------------------------------------------------------
function showPanel(html) { $("panel-empty").hidden = true; const r = $("panel-report"); r.hidden = false; r.innerHTML = html; }
function conf(c) { return `<span class="conf-${c}">${{ high: "高（較正地点 150m 以内）", mid: "中（400m 以内）", low: "低" }[c] || c}</span>`; }

async function onBuildingClick(f) {
  const bid = f.properties.building_id;
  const rep = await post("/parcels/score", { period: state.period, building_id: bid });
  renderReport(rep, f.properties);
}
function renderReport(rep, bp) {
  const m = rep.metrics, b = rep.building || {};
  const prof = rep.profile.filter((x) => x.time_band !== "all");
  const maxv = Math.max(...prof.map((x) => x.flow || 0), 1);
  const bars = prof.map((x) => `<div style="height:${Math.max(2, (100 * (x.flow || 0)) / maxv)}%"><b>${fmt(x.flow)}</b><span>${x.day_type === "weekday" ? "平日" : "休日"}${x.time_band === "day" ? "昼" : "深夜"}</span></div>`).join("");
  const mix = rep.origin_mix || [];
  const mixColors = ["#3b82f6", "#22c55e", "#eab308", "#ef4444"];
  const s = rep.sales_estimate;
  const gov = state.mode === "gov";
  showPanel(`
    <h2>${gov ? "街区レポート" : "区画レポート"} <span class="note">${rep.period}</span></h2>
    <div class="note">${usageJa[b.usage_class] || ""} ${b.floors ?? ""}F / 延床 ${fmt(b.gfa)} m²${b.gfa_is_estimated ? "（推定）" : ""} / ${b.zoning_name || ""} / 建物ID ${rep.parcel_id}</div>
    <div class="kpi">
      <div><div class="v">${fmt(m.potential_weekday_all)}</div><div class="l">前面道路 推定通行量（平日・終日, 人/日）</div></div>
      <div><div class="v">上位 ${fmt(100 - (m.potential_percentile ?? 0))}%</div><div class="l">エリア内順位（パーセンタイル ${fmt(m.potential_percentile)}）</div></div>
      <div><div class="v">${fmt(m.potential_holiday_all)}</div><div class="l">休日・終日（人/日）</div></div>
      <div><div class="v">${fmt(m.stay_pop_weekday_day)}</div><div class="l">建物滞在人口 推定（平日昼, 人）</div></div>
    </div>
    <div class="note">信頼度: ${conf(rep.confidence)}${rep.nearest_count_site ? `／最寄り実測地点まで ${fmt(rep.nearest_count_site.distance_m)} m` : ""}</div>
    <h3>時間帯プロファイル（前面道路 推定通行量）</h3>
    <div class="bars">${bars}</div><div style="height:16px"></div>
    <h3>来街者構成（${gov ? "市区町村単位・昼" : "居住地区分・昼"}）</h3>
    <div class="mix">${mix.map((x, i) => `<div style="width:${(x.share || 0) * 100}%;background:${mixColors[i]}"></div>`).join("")}</div>
    <div class="mixl">${mix.map((x, i) => `<span><span class="sw" style="background:${mixColors[i]};display:inline-block;width:10px;height:10px;border-radius:2px"></span> ${x.label} ${fmt((x.share || 0) * 100, 1)}%</span>`).join("")}</div>
    <div class="note">※ 人流オープンデータは市区町村単位の居住地区分のみ提供。区画単位の構成は商用データで置換予定。</div>
    ${gov ? "" : `
    <h3>低利用ギャップ</h3>
    <div>ギャップスコア <b>${fmt(m.gap_score, 1)}</b> <span class="note">（通行ポテンシャル順位 − 滞在密度順位。高いほど「通行は多いのに使われていない」）</span></div>
    <h3>簡易売上試算 <span class="note">ユーザー入力の仮定に基づく試算</span></h3>
    <div class="note">入店率 <input class="num" id="capture" type="number" step="0.001" value="${s.assumptions.capture_rate}"> × 客単価 <input class="num" id="spend" type="number" step="100" value="${s.assumptions.spend_per_customer_yen}">円 × 営業日 <input class="num" id="days" type="number" value="${s.assumptions.business_days_per_month}"> <button class="small" id="recalc">再計算</button></div>
    <div class="kpi"><div><div class="v">${fmt(s.monthly_customers)}</div><div class="l">月間来店 推計（人）</div></div><div><div class="v">¥${fmt(s.monthly_sales_yen)}</div><div class="l">月商 試算</div></div></div>
    <div class="note">${s.note} 保証値ではありません。</div>`}
    <div style="margin-top:12px"><button class="small" onclick="window.print()">レポートを印刷/PDF</button> <button class="small" id="back">閉じる</button></div>
  `);
  $("back").onclick = () => { $("panel-report").hidden = true; $("panel-empty").hidden = false; };
  const rc = $("recalc");
  if (rc) rc.onclick = async () => {
    const r = await post("/parcels/score", { period: state.period, building_id: rep.parcel_id, sales: { capture_rate: +$("capture").value, spend_per_customer_yen: +$("spend").value, business_days_per_month: +$("days").value } });
    renderReport(r, bp);
  };
}

function onLinkClick(f) {
  const p = f.properties;
  if (state.compare) {
    showPanel(`<h2>街路の変化 <span class="note">${state.compare.period_a} → ${state.compare.period_b}</span></h2>
      <div class="note">${p.name || "(無名)"} / link ${p.link_id}</div>
      <div class="kpi"><div><div class="v">${fmt(p.a)}</div><div class="l">A: ${state.compare.period_a}（人/日）</div></div><div><div class="v">${fmt(p.b)}</div><div class="l">B: ${state.compare.period_b}（人/日）</div></div>
      <div><div class="v">${p.diff > 0 ? "+" : ""}${fmt(p.diff)}</div><div class="l">差分</div></div><div><div class="v">×${p.ratio ?? "—"}</div><div class="l">変化率</div></div></div>
      <div class="note">エリア全体の変化率: ×${state.compare.area_change_ratio ?? "—"}（${state.dayType === "weekday" ? "平日" : "休日"}・${state.timeBand}）</div>
      <div class="note">周辺 300m への波及は「範囲を指定して比較」（POST /compare に polygon）で算出できます。</div>
      <div style="margin-top:12px"><button class="small" id="back">閉じる</button></div>`);
  } else {
    showPanel(`<h2>街路 <span class="note">${state.period}</span></h2><div class="note">${p.name || "(無名)"} [${p.highway_type}] link ${p.link_id}</div>
      <div class="kpi"><div><div class="v">${fmt(p.flow_calibrated)}</div><div class="l">推定通行量（${state.dayType === "weekday" ? "平日" : "休日"}・${state.timeBand}, 人/日）</div></div><div><div class="v">上位 ${fmt(100 - p.pct)}%</div><div class="l">エリア内順位</div></div></div>
      <div class="note">信頼度: ${conf(p.confidence)}</div><div style="margin-top:12px"><button class="small" id="back">閉じる</button></div>`);
  }
  $("back").onclick = () => { $("panel-report").hidden = true; $("panel-empty").hidden = false; };
}
function showSite(p) {
  showPanel(`<h2>実測地点 ${p.site_id}</h2><div>${p.name}（${p.direction}／${p.kind}）</div>
    <div class="kpi"><div><div class="v">${fmt(p.obs_weekday)}</div><div class="l">実測 平日平均 24h（${p.obs_period || "—"}）</div></div></div>
    <div class="note">岡山市 市内中心部歩行者通行量データ（AIカメラ, CC BY 4.0）。地下街・入退場・広場地点は較正に使っていません。</div>
    <div style="margin-top:12px"><button class="small" id="back">閉じる</button></div>`);
  $("back").onclick = () => { $("panel-report").hidden = true; $("panel-empty").hidden = false; };
}

async function runGap() {
  const g = await post("/search/gap", { period: state.period, day_type: state.dayType, top: 25 });
  const rows = g.items.map((x) => `<tr class="row" data-id="${x.building_id}" data-lon="${x.centroid_lon}" data-lat="${x.centroid_lat}"><td>${usageJa[x.usage_class] || x.usage_class}</td><td>${x.floors}F</td><td>${fmt(x.gfa)}</td><td>${fmt(x.front_flow)}</td><td>${fmt(x.flow_pct)}</td><td>${fmt(x.density_pct)}</td><td><b>${fmt(x.gap_score, 1)}</b></td></tr>`).join("");
  showPanel(`<h2>低利用ギャップ検索 <span class="note">${g.period} ${g.day_type}</span></h2>
    <div class="note">前面通行量のエリア内順位（%）が高く、延床あたり滞在人口の順位（%）が低い建物。行クリックで地図移動＋レポート。</div>
    <table class="t"><tr><th>用途</th><th>階</th><th>延床m²</th><th>前面通行量</th><th>通行%</th><th>密度%</th><th>ギャップ</th></tr>${rows}</table>
    <div style="margin-top:12px"><button class="small" id="back">閉じる</button></div>`);
  $("back").onclick = () => { $("panel-report").hidden = true; $("panel-empty").hidden = false; };
  document.querySelectorAll("tr.row").forEach((tr) => tr.onclick = async () => {
    map.flyTo({ center: [+tr.dataset.lon, +tr.dataset.lat], zoom: 17.5 });
    const rep = await post("/parcels/score", { period: state.period, building_id: tr.dataset.id });
    renderReport(rep, {});
  });
}
async function runCompare() {
  const c = await post("/compare", { period_a: state.period, period_b: state.periodB, day_type: state.dayType, time_band: state.timeBand });
  state.compare = c;
  render();
  showPanel(`<h2>施策前後の比較 <span class="note">${c.period_a} → ${c.period_b}</span></h2>
    <div class="kpi"><div><div class="v">×${c.area_change_ratio ?? "—"}</div><div class="l">エリア全体の通行量変化率（${state.dayType === "weekday" ? "平日" : "休日"}・${state.timeBand}）</div></div></div>
    <div class="note">青＝減少、赤＝増加（線の太さ＝差分の大きさ）。街路をクリックで A/B の値。<br/>2019→2021 はコロナ禍の影響が主因です。施策（例: ハレまち通り 1 車線化 2022〜）の評価には 2022 年以降の人流データが必要です（docs/QUESTIONS.md Q7）。</div>
    <div style="margin-top:12px"><button class="small" id="back">閉じる</button></div>`);
  $("back").onclick = () => { $("panel-report").hidden = true; $("panel-empty").hidden = false; };
}

// ---- events -------------------------------------------------------------
function setMode(m) { state.mode = m; document.body.classList.remove("gov", "realestate"); document.body.classList.add(m); if (m !== "gov" && state.compare) { state.compare = null; render(); } }
$("mode").onchange = (e) => setMode(e.target.value);
$("period").onchange = (e) => { state.period = e.target.value; state.compare = null; loadLayers(); };
$("periodB").onchange = (e) => { state.periodB = e.target.value; };
$("daytype").onchange = (e) => { state.dayType = e.target.value; state.compare = null; loadLayers(); };
$("timeband").onchange = (e) => { state.timeBand = e.target.value; state.compare = null; loadLayers(); };
$("chk3d").onchange = render; $("chkSites").onchange = render;
$("btnGap").onclick = runGap;
$("btnCompare").onclick = runCompare;
$("btnCompareOff").onclick = () => { state.compare = null; render(); };

// URL パラメータ: ?mode=gov&demo=gap|compare&period=2019-10&periodB=2021-10（デモ台本・スクリーンショット用）
const qs = new URLSearchParams(location.search);
setMode(qs.get("mode") === "gov" ? "gov" : "realestate");
$("mode").value = state.mode;
(async () => {
  try { await loadArea(); } catch (e) { $("calib").innerHTML = `<div class="note">API に接続できません: ${e.message}</div>`; return; }
  if (qs.get("period") && state.area.periods.includes(qs.get("period"))) { state.period = qs.get("period"); $("period").value = state.period; }
  if (qs.get("periodB") && state.area.periods.includes(qs.get("periodB"))) { state.periodB = qs.get("periodB"); $("periodB").value = state.periodB; }
  await loadLayers();
  const start = async () => {
    await loadLayers();
    if (qs.get("demo") === "gap") await runGap();
    if (qs.get("demo") === "compare") await runCompare();
    if (qs.get("demo") === "report" && qs.get("building")) {
      const rep = await post("/parcels/score", { period: state.period, building_id: qs.get("building") });
      renderReport(rep, {});
    }
    document.body.dataset.demoReady = "1";
  };
  if (map.loaded()) start(); else map.on("load", start);
})();
