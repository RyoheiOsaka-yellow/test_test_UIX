/* =========================================================
 * Virtual Studio — 台本 / 絵コンテ ページ
 *
 * 役割分担:
 *   スタジオ = カメラ・照明・機材 (どう撮るか)
 *   台本コンテ = 演出・動き・セリフ (何が起きるか)
 * 動くのは人だけではないため、登場要素 (人物/車両/動物/群衆/物/カメラ) を
 * 同じ台本の上で扱う。カメラ側の設定はここでは読み取り専用で並べ、
 * 尺・カメラワークとの噛み合わせだけを診断する。
 * 読み込み順: app.js より前 (呼び出しはすべて実行時)
 * ======================================================= */

function scriptTotalSec() {
  return state.cuts.reduce((s, c) => s + (c.kind === "still" ? 0 : c.duration || 5), 0);
}

/* カットのビート行 (台本の本体) */
function scriptBeatRows(cut, ci) {
  const p = cut.perf;
  let acc = 0;
  const rows = p.beats.map((b, i) => {
    const from = acc; acc += +b.sec || 0;
    return `
    <div class="sc-beat" data-ci="${ci}" data-bi="${i}">
      <span class="sc-t">${from.toFixed(1)}–${acc.toFixed(1)}s</span>
      <input type="number" class="sc-sec" data-scsec="${i}" value="${b.sec}" min="0.5" max="120" step="0.5" title="長さ(秒)">
      <select class="sc-who" data-scwho="${i}" title="どの要素の動きか">
        <option value="">主体</option>
        ${p.actors.map(a => `<option value="${esc(a.id)}" ${a.id === b.who ? "selected" : ""}>${esc(actorLabel(cut, a.id))}</option>`).join("")}
      </select>
      <input type="text" class="sc-do" data-scdo="${i}" value="${esc(b.do)}" placeholder="何が起きる (例: 車が右から進入して停まる)">
      <select class="sc-gaze" data-scgaze="${i}" title="視線・向き">
        ${GAZE_TARGETS.map(g => `<option value="${g.id}" ${g.id === b.gaze ? "selected" : ""}>${esc(g.label)}</option>`).join("")}
      </select>
      <select class="sc-cam" data-sccam="${i}" title="このビートでのカメラ">
        ${CAM_LINKS.map(c => `<option value="${c.id}" ${c.id === b.cam ? "selected" : ""}>${esc(c.label)}</option>`).join("")}
      </select>
      <button class="icon-btn small" data-scbup="${i}" title="上へ" ${i === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-btn small danger" data-scbdel="${i}" title="削除">×</button>
    </div>`;
  }).join("");
  return rows || `<div class="insp-hint">ビート未設定 — 「何が・いつ起きるか」を並べると、尺とカメラの噛み合わせを診断します</div>`;
}

function renderScriptPage() {
  const body = byId("scriptBody");
  if (!body) return;
  const total = scriptTotalSec();
  byId("scriptTotal").textContent = `${state.cuts.length}カット / 計${total}秒`;

  body.innerHTML = state.cuts.map((cut, ci) => {
    ensureCameraDefaults(cut);
    const p = cut.perf;
    const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || {};
    const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || {};
    const beatTotal = perfBeatTotal(cut);
    const dur = cut.duration || 5;
    const gap = cut.kind !== "still" && p.beats.length && Math.abs(beatTotal - dur) > 0.5;
    const rec = recommendMethod(cut);
    const used = perfMethodOf(cut);
    const lint = lintCut(cut);
    const trans = ci < state.cuts.length - 1 ? TRANSITIONS.find(t => t.id === (cut.transition || "cut")) : null;
    return `
    <section class="sc-cut ${ci === state.activeCut ? "active" : ""}" data-sccut="${ci}">
      <div class="sc-left">
        <div class="sc-frame" data-scselect="${ci}" title="クリックでこのカットをスタジオ側でも選択">${renderPreviewCached(cut, "sc" + ci)}</div>
        <div class="sc-no">C${ci + 1}</div>
        <input type="text" class="sc-name" data-scname="${ci}" value="${esc(cut.name)}" title="カット名">
        <div class="sc-tech" title="カメラ設定はスタジオ側で編集します">
          ${esc(size.label || cut.camera.shotSize)} ｜ ${esc(mov.label || "")} ｜ ${cut.camera.focalMm}mm F${cut.camera.apertureF}
        </div>
        <div class="sc-dur">
          ${cut.kind === "still" ? "スチール" : `<input type="number" data-scdur="${ci}" value="${dur}" min="1" max="120" step="1" title="カットの尺(秒)"> 秒`}
        </div>
      </div>

      <div class="sc-main">
        <div class="sc-row">
          <label>セリフ / テロップ</label>
          <input type="text" data-sccap="${ci}" value="${esc(cut.caption)}" placeholder="画に焼き込む字幕・セリフ">
        </div>
        <div class="sc-row">
          <label>狙い</label>
          <input type="text" data-scaim="${ci}" value="${esc(cut.aim)}" placeholder="このカットで何を伝えるか">
        </div>

        <div class="sc-sub">ロケ地 <small>どこで起きるか — 地図は使わず座標から太陽を計算します</small></div>
        <div class="sc-loc">
          <button class="btn small" data-scloclib="${ci}"><svg class="ic"><use href="#i-search"/></svg> ${cut.location.presetId ? "ロケ地を変更" : "ロケ地を選ぶ"}</button>
          ${(() => {
            const lp = locPreset(cut);
            return lp ? `<span class="sc-loc-name" title="${esc(lp.en)}">${esc(lp.label)}</span>
              <button class="icon-btn small danger" data-sclocclear="${ci}" title="ロケ地を外す"><svg class="ic"><use href="#i-trash"/></svg></button>` : "";
          })()}
          <input type="text" data-scsite="${ci}" value="${esc(cut.location.name)}" placeholder="実際の地名 (例: 新宿ゴールデン街)">
        </div>
        <div class="sc-loc">
          <input type="text" data-scmaps="${ci}" value="${cut.location.coords ? `${cut.location.coords.lat}, ${cut.location.coords.lng}` : ""}"
            placeholder="Google MapsのURL か 緯度,経度 を貼る" title="MapsのURL (…/@35.68,139.76,17z…) または「35.6586, 139.7454」">
          ${cut.location.coords ? `
            <a class="btn tiny" href="${mapsLink(cut.location.coords.lat, cut.location.coords.lng)}" target="_blank" rel="noopener">地図で開く</a>
            <a class="btn tiny" href="${streetViewLink(cut.location.coords.lat, cut.location.coords.lng)}" target="_blank" rel="noopener">ストリートビュー</a>` : ""}
        </div>
        ${cut.location.coords ? `
        <div class="sc-loc sc-sun">
          <input type="date" data-scdate="${ci}" value="${esc(cut.location.date || "")}" title="撮影日">
          <input type="time" data-sctime="${ci}" value="${esc(cut.location.time || "")}" title="撮影時刻 (現地の太陽時)">
          <label title="カメラが向いている方位 (北=0°)">カメラ方位 <input type="number" data-scbearing="${ci}" value="${+cut.location.camBearing || 0}" min="0" max="359" step="5">°</label>
          ${(() => {
            const sn = locSunRelative(cut);
            if (!sn) return `<span class="insp-hint">日付と時刻を入れると太陽の方位・高度を計算します</span>`;
            const side = Math.abs(sn.rel) < 30 ? "逆光" : Math.abs(sn.rel) > 150 ? "順光" : sn.rel > 0 ? "右サイド" : "左サイド";
            return `<span class="sc-sun-info">☀️ 方位${Math.round(sn.azimuth)}° / 高度${sn.elevation.toFixed(1)}° → <b>${side}</b>${sn.elevation < 6 && sn.elevation > 0 ? " (ゴールデンアワー)" : sn.elevation <= 0 ? " (日没後)" : ""}</span>
              <button class="btn tiny primary" data-scsun="${ci}">スタジオの太陽に反映</button>`;
          })()}
          ${(() => {
            const ev = cut.location.date ? sunEvents(cut.location.coords.lat, cut.location.coords.lng, cut.location.date) : null;
            if (!ev) return "";
            if (ev.polar) return `<span class="sc-sun-ev">${esc(ev.polar)}</span>`;
            return `<span class="sc-sun-ev" title="経度から求めた現地太陽時 (時計時刻とは時差分ずれます)">
              日の出 ${ev.rise || "—"} ｜ 朝GH〜${ev.goldenEnd || "—"} ｜ 夕GH ${ev.goldenStart || "—"}〜 ｜ 日の入 ${ev.set || "—"}</span>`;
          })()}
        </div>` : ""}
        <input type="text" class="sc-locnote" data-scsitenote="${ci}" value="${esc(cut.location.note)}" placeholder="ロケ地メモ (許可・段取り・その場所固有の注意)">

        <div class="sc-sub">登場要素 <small>動くのは人だけではない (車両・動物・群衆・物・カメラ自身)</small></div>
        <div class="sc-actors">
          ${p.actors.map(a => `
            <span class="sc-actor">
              <select data-scatype="${esc(a.id)}" title="要素の種類">
                ${ACTOR_TYPES.map(t => `<option value="${t.id}" ${t.id === a.type ? "selected" : ""}>${esc(t.label)}</option>`).join("")}
              </select>
              <input type="text" data-scaname="${esc(a.id)}" value="${esc(a.name)}" placeholder="名前/識別" size="6">
              <button class="icon-btn small danger" data-scadel="${esc(a.id)}" title="削除">×</button>
            </span>`).join("")}
          <button class="btn tiny" data-scaadd="${ci}"><svg class="ic"><use href="#i-plus"/></svg> 要素を追加</button>
          <select data-sccontact="${ci}" title="要素同士の絡み">
            ${CONTACT_TYPES.map(c => `<option value="${c.id}" ${c.id === p.contact ? "selected" : ""}>${esc(c.label)}</option>`).join("")}
          </select>
        </div>

        <div class="sc-sub">
          動き (ビート)
          <small class="${gap ? "sc-gap" : ""}">合計 ${beatTotal.toFixed(1)}s / 尺 ${dur}s${gap ? " ⚠️ ズレています" : ""}</small>
        </div>
        <div class="sc-beats">${scriptBeatRows(cut, ci)}</div>
        <div class="sc-beat-actions">
          <button class="btn small" data-scbadd="${ci}"><svg class="ic"><use href="#i-plus"/></svg> ビート追加</button>
          <select data-sctpl="${ci}" title="尺に合わせて比率で流し込みます">
            <option value="">配分テンプレ…</option>
            ${BEAT_TEMPLATES.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}
          </select>
          ${p.beats.length ? `<button class="btn small ghost" data-scfit="${ci}">尺に合わせる</button>` : ""}
          <span class="sc-quality">
            ${selectHtml2(`scspeed-${ci}`, MOTION_SPEEDS, p.speed, "scspeed", ci, "動きの速さ")}
            ${selectHtml2(`sccare-${ci}`, MOTION_CARES, p.care, "sccare", ci, "動きの丁寧さ")}
            ${selectHtml2(`sctoward-${ci}`, MOTION_TOWARDS, p.toward, "sctoward", ci, "誰に向けた動きか")}
            ${selectHtml2(`sccam-${ci}`, CAM_LINKS, p.camLink, "sccamlink", ci, "カメラが動きに連動するか")}
          </span>
        </div>

        <div class="sc-foot">
          <span class="sc-method" title="${esc(rec.why.join(" / "))}">
            作り方: <b>${esc((PROD_METHODS.find(m => m.id === used) || {}).label || "")}</b>
            ${p.method === "auto" ? `<small>(推奨)</small>` : ""}
            <select data-scmethod="${ci}">
              <option value="auto" ${p.method === "auto" ? "selected" : ""}>自動</option>
              ${PROD_METHODS.map(m => `<option value="${m.id}" ${p.method === m.id ? "selected" : ""}>${esc(m.label)}</option>`).join("")}
            </select>
          </span>
          ${trans ? `<span class="sc-trans">次へ: ${esc(trans.label)}</span>` : `<span class="sc-trans">— 最終カット —</span>`}
        </div>
        ${lint.length ? `<ul class="sc-lint">${lint.map(x =>
          `<li class="lv-${x.lv}">${x.lv === "danger" ? "⛔" : x.lv === "warn" ? "⚠️" : "💡"} ${esc(x.t)}</li>`).join("")}</ul>` : ""}
      </div>
    </section>`;
  }).join("") || `<p class="insp-hint">カットがありません。スタジオで技法を選ぶか、ワークフローのストーリーから設計してください</p>`;
}

/* data属性で束ねるセレクト (台本ページ用の簡易ヘルパー) */
function selectHtml2(id, arr, val, attr, ci, title) {
  return `<select id="${id}" data-${attr}="${ci}" title="${esc(title || "")}">
    ${arr.map(o => `<option value="${o.id}" ${o.id === val ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
  </select>`;
}

function setupScriptPage() {
  const open = () => {
    byId("scriptOverlay").hidden = false;
    renderScriptPage();
  };
  byId("btnScriptPage").addEventListener("click", open);
  byId("btnScriptBack").addEventListener("click", () => { byId("scriptOverlay").hidden = true; });
  byId("btnScriptBoard").addEventListener("click", () => exportBoard());
  byId("btnScriptDoc").addEventListener("click", () => exportDoc());

  const body = byId("scriptBody");
  const cutOf = el => state.cuts[+el.closest("[data-sccut]").dataset.sccut];
  /* 台本を編集したらスタジオ側の描画も更新する (カメラ設定には触れない) */
  const sync = (full) => {
    renderScriptPage();
    renderCutStrip(); renderTimeline(); renderPrompt(); renderLint();
    if (full) renderInspector();
  };

  body.addEventListener("click", e => {
    const sel = e.target.closest("[data-scselect]");
    if (sel) {
      state.activeCut = +sel.dataset.scselect;
      state.selectedItem = null;
      renderAll();
      renderScriptPage();
      showToast(`C${state.activeCut + 1} をスタジオでも選択しました`);
      return;
    }
    const add = e.target.closest("[data-scbadd]");
    if (add) {
      const cut = state.cuts[+add.dataset.scbadd];
      const rest = Math.max(0.5, Math.round(((cut.duration || 5) - perfBeatTotal(cut)) * 10) / 10);
      cut.perf.beats.push({ id: uid(), sec: rest || 1, who: "", do: "", gaze: "none", cam: "none" });
      sync(true);
      return;
    }
    const fit = e.target.closest("[data-scfit]");
    if (fit) {
      const cut = state.cuts[+fit.dataset.scfit];
      const t = perfBeatTotal(cut);
      if (t) {
        const k = (cut.duration || 5) / t;
        cut.perf.beats.forEach(b => { b.sec = Math.max(0.5, Math.round(b.sec * k * 10) / 10); });
      }
      sync(true);
      return;
    }
    const aadd = e.target.closest("[data-scaadd]");
    if (aadd) {
      const cut = state.cuts[+aadd.dataset.scaadd];
      cut.perf.actors.push({ id: uid(), type: "person", name: String(cut.perf.actors.length + 1) });
      cut.perf.people = cut.perf.actors.length;
      sync(true);
      return;
    }
    const adel = e.target.closest("[data-scadel]");
    if (adel) {
      const cut = cutOf(adel);
      const id = adel.dataset.scadel;
      if (cut.perf.actors.length <= 1) { showToast("⚠️ 登場要素は1つ以上必要です"); return; }
      cut.perf.actors = cut.perf.actors.filter(a => a.id !== id);
      cut.perf.beats.forEach(b => { if (b.who === id) b.who = ""; });
      cut.perf.people = cut.perf.actors.length;
      sync(true);
      return;
    }
    const lib = e.target.closest("[data-scloclib]");
    if (lib) { openLocationLib(+lib.dataset.scloclib); return; }
    const lclr = e.target.closest("[data-sclocclear]");
    if (lclr) { state.cuts[+lclr.dataset.sclocclear].location.presetId = null; sync(true); return; }
    const sunb = e.target.closest("[data-scsun]");
    if (sunb) { applySunToStudio(state.cuts[+sunb.dataset.scsun]); renderScriptPage(); return; }
    const bup = e.target.closest("[data-scbup]");
    if (bup) {
      const cut = cutOf(bup); const i = +bup.dataset.scbup;
      [cut.perf.beats[i - 1], cut.perf.beats[i]] = [cut.perf.beats[i], cut.perf.beats[i - 1]];
      sync(true);
      return;
    }
    const bdel = e.target.closest("[data-scbdel]");
    if (bdel) {
      cutOf(bdel).perf.beats.splice(+bdel.dataset.scbdel, 1);
      sync(true);
    }
  });

  /* 入力系 (change) — セレクトと数値 */
  body.addEventListener("change", e => {
    const t = e.target;
    const d = t.dataset;
    const cut = t.closest("[data-sccut]") ? cutOf(t) : null;
    if (!cut) return;
    if (d.scsec != null) cut.perf.beats[+d.scsec].sec = Math.max(0.5, +t.value || 0.5);
    else if (d.scwho != null) cut.perf.beats[+d.scwho].who = t.value;
    else if (d.scgaze != null) cut.perf.beats[+d.scgaze].gaze = t.value;
    else if (d.sccam != null) cut.perf.beats[+d.sccam].cam = t.value;
    else if (d.scatype != null) {
      const a = cut.perf.actors.find(x => x.id === d.scatype);
      if (a) a.type = t.value;
    } else if (d.sccontact != null) cut.perf.contact = t.value;
    else if (d.scspeed != null) cut.perf.speed = t.value;
    else if (d.sccare != null) cut.perf.care = t.value;
    else if (d.sctoward != null) cut.perf.toward = t.value;
    else if (d.sccamlink != null) cut.perf.camLink = t.value;
    else if (d.scmethod != null) cut.perf.method = t.value;
    else if (d.scdur != null) cut.duration = Math.max(1, +t.value || 5);
    else if (d.scmaps != null) {
      const v = t.value.trim();
      if (!v) delete cut.location.coords;
      else {
        const r = parseMapsUrl(v);
        if (r && r.error) { showToast("⚠️ " + r.error); return; }
        if (r) {
          cut.location.coords = { lat: +r.lat.toFixed(6), lng: +r.lng.toFixed(6) };
          if (r.name && !cut.location.name) cut.location.name = r.name;
          showToast(`座標を読み取りました (${r.lat.toFixed(4)}, ${r.lng.toFixed(4)})`);
        }
      }
    }
    else if (d.scdate != null) cut.location.date = t.value;
    else if (d.sctime != null) cut.location.time = t.value;
    else if (d.scbearing != null) cut.location.camBearing = ((+t.value || 0) % 360 + 360) % 360;
    else if (d.sctpl != null) {
      if (!t.value) return;
      perfApplyTemplate(cut, t.value);
      showToast("配分テンプレを尺に合わせて流し込みました");
    } else return;
    sync(true);
  });

  /* テキスト入力は再描画せず値だけ反映 (入力中のフォーカスを失わない) */
  body.addEventListener("input", e => {
    const t = e.target;
    const d = t.dataset;
    const wrap = t.closest("[data-sccut]");
    if (!wrap) return;
    const cut = state.cuts[+wrap.dataset.sccut];
    if (d.scdo != null) cut.perf.beats[+d.scdo].do = t.value;
    else if (d.scaname != null) {
      const a = cut.perf.actors.find(x => x.id === d.scaname);
      if (a) a.name = t.value;
    } else if (d.scsite != null) cut.location.name = t.value;
    else if (d.scsitenote != null) cut.location.note = t.value;
    else if (d.sccap != null) cut.caption = t.value;
    else if (d.scaim != null) cut.aim = t.value;
    else if (d.scname != null) cut.name = t.value;
    else return;
    renderCutStrip(); renderPreview(); renderPrompt();
  });
}
