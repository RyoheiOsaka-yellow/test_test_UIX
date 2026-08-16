/* =========================================================
 * Virtual Studio — 制作ワークフロー+ラフカット (app.jsから分離)
 *  WF画面 / 参照画像 / ラフカット再生・書き出し / 音声 /
 *  saveFileAs / ZIP / プロンプトMD / バックアップ
 * ======================================================= */
/* =========================================================
 * 制作ワークフロー
 *   1 素材 (参照画像+ストーリー) → 2 カット設計 (本体)
 *   → 3 生成へ書き出し (Seedance等) → 4 レビュー → 1へ戻る
 * 全体編集は外部NLE (EDL書き出しで受け渡す) 前提。
 * ======================================================= */
const WF_STATUS = [
  { id: "plan",      label: "設計中" },
  { id: "prompted",  label: "プロンプト済" },
  { id: "generated", label: "生成済み" },
  { id: "approved",  label: "採用" },
];
const LS_APICFG = "vsApiCfg";

async function downscaleImage(file, maxPx) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(bmp.width * scale));
  cv.height = Math.max(1, Math.round(bmp.height * scale));
  const cx = cv.getContext("2d");
  cx.drawImage(bmp, 0, 0, cv.width, cv.height);
  /* 背景透過PNG/WebPの検出 (間引きスキャン) — 透過があれば「被写体レイヤー」として合成する */
  let hasAlpha = false;
  if (/png|webp/i.test(file.type)) {
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 4 * 7) {
      if (d[i] < 250) { hasAlpha = true; break; }
    }
  }
  return { url: cv.toDataURL(hasAlpha ? "image/png" : "image/jpeg", 0.82), hasAlpha };
}

async function wfAddRefFiles(files) {
  const MAX = 12;
  let added = 0;
  for (const file of files) {
    if (!(file.type || "").startsWith("image/")) continue;
    if (state.story.refs.length >= MAX) { alert(`参照画像は${MAX}枚までです (ブラウザ保存容量のため)`); break; }
    try {
      const d = await downscaleImage(file, 768);
      state.story.refs.push({ id: uid(), name: file.name, dataUrl: d.url, hasAlpha: d.hasAlpha });
      added++;
    } catch { /* 読めない画像はスキップ */ }
  }
  if (added) renderWorkflow();
}

/* ストーリー文 → カット群 (IntentParserを文単位に適用) */
function wfDesignFromStory() {
  const text = (state.story.text || "").trim();
  if (!text) { byId("wfDesignMsg").textContent = "⚠️ 先にストーリーを入力してください"; return; }
  const segs = text.split(/\n+|(?<=[。！？!?])/).map(s => s.trim()).filter(s => s.length >= 4).slice(0, 12);
  if (!segs.length) { byId("wfDesignMsg").textContent = "⚠️ カットに分解できる文が見つかりません"; return; }

  // 既存カットがあるときは置き換えか追記かを選んでもらう
  if (state.cuts.length && confirm(`既存の${state.cuts.length}カットを置き換えますか?\nOK = 置き換えて新しく設計 / キャンセル = 後ろに追加`)) {
    state.cuts = [];
  }
  const startIdx = state.cuts.length;

  segs.forEach((seg, si) => {
    const cut = buildCutFromIntent(parseIntent(seg));
    cut.name = seg.slice(0, 16) + (seg.length > 16 ? "…" : "");
    cut.aim = seg;
    if (si > 0) {
      for (const [re, id] of INTENT_TRANSITIONS) {
        if (re.test(seg)) { state.cuts[state.cuts.length - 1].transition = id; break; }
      }
    }
    state.cuts.push(cut);
  });
  state.activeCut = startIdx;
  state.selectedItem = null;
  renderAll();
  byId("wfDesignMsg").innerHTML = `✓ ${segs.length}文 → <b>C${startIdx + 1}〜C${state.cuts.length}</b> を設計しました。ステップ2で精緻化してください`;
  renderWorkflow();
}

function wfApiCfg() { return lsGet(LS_APICFG, { endpoint: "" }); }

/* 実験的API連携: 自前の中継サーバーへカットをPOSTする */
async function wfSendCut(cut, statusEl) {
  const cfg = wfApiCfg();
  if (!cfg.endpoint) return;
  const ref = state.story.refs.find(r => r.id === cut.refImgId);
  statusEl.textContent = "送信中…";
  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: state.projectTitle,
        cut_no: state.cuts.indexOf(cut) + 1,
        name: cut.name,
        model_hint: state.promptModel,
        prompt: generatePrompt(cut, state.promptModel),
        params: {
          ratio: seedanceRatio(cut.aspect),
          duration_s: cut.kind === "still" ? null : (cut.duration || 5),
          resolution: "1080p",
          camerafixed: cut.camera.move === "fix",
        },
        first_frame_data_url: ref ? ref.dataUrl : null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    statusEl.textContent = "✓ 送信しました (生成が終わったら「生成済み」を押してください)";
    if (cut.wfStatus === "plan") cut.wfStatus = "prompted";
    renderCutStrip();
  } catch (err) {
    statusEl.textContent = `⚠️ 送信できませんでした: ${err.message} — 中継サーバーが起動しているか・CORSを許可しているか確認してください`;
  }
}

function wfStatusPill(cut) {
  const st = WF_STATUS.find(w => w.id === cut.wfStatus) || WF_STATUS[0];
  return `<span class="wf-pill ${st.id}">${st.label}</span>`;
}

function renderWorkflow() {
  byId("wfProjTitle").textContent = state.projectTitle;
  byId("wfStory").value = state.story.text || "";

  /* ステッパー: 各段階の進行を数で示す */
  const n = state.cuts.length;
  const counts = { prompted: 0, generated: 0, approved: 0 };
  state.cuts.forEach(c => {
    if (c.wfStatus === "prompted") counts.prompted++;
    if (c.wfStatus === "generated") counts.generated++;
    if (c.wfStatus === "approved") counts.approved++;
  });
  const steps = [
    { no: 1, t: "素材", d: `${state.story.refs.length}枚 / ${state.story.text.trim() ? "ストーリーあり" : "ストーリー未入力"}`, done: !!state.story.text.trim() },
    { no: 2, t: "カット設計", d: `${n}カット`, done: n > 0 },
    { no: 3, t: "生成", d: `${counts.prompted + counts.generated + counts.approved}/${n} 書き出し`, done: n > 0 && counts.prompted + counts.generated + counts.approved >= n },
    { no: 4, t: "レビュー", d: `${counts.approved}/${n} 採用`, done: n > 0 && counts.approved >= n },
  ];
  byId("wfStepper").innerHTML = steps.map((s, i) =>
    `<a class="wf-stepchip ${s.done ? "done" : ""}" href="#wfStep${s.no}"><span class="wf-stepno">${s.no}</span><b>${s.t}</b><small>${esc(s.d)}</small></a>${i < 3 ? '<span class="wf-arrow">→</span>' : ""}`).join("");

  /* ステップ1: 参照画像 */
  byId("wfRefGrid").innerHTML = state.story.refs.map(r => {
    const usedBy = state.cuts.map((c, i) => c.refImgId === r.id ? `C${i + 1}` : null).filter(Boolean);
    return `
    <div class="wf-ref" draggable="true" data-refdrag="${r.id}" title="ドラッグしてカットや書き出しカードへドロップすると割り当てられます">
      <img src="${r.dataUrl}" alt="${esc(r.name)}">
      <div class="wf-ref-body">
        <div class="wf-ref-name" title="${esc(r.name)}">${esc(r.name)}${r.hasAlpha ? `<span class="wf-ref-used" title="背景透過 — スタジオ背景に被写体として合成されます">透過</span>` : ""}${usedBy.length ? `<span class="wf-ref-used">${usedBy.join(" ")}</span>` : ""}</div>
        <select data-refassign="${r.id}" title="選んだカットにこの画像を割り当て (プレビュー/first frameに反映。複数カットにも割当可)">
          <option value="">カットに割当…</option>
          ${state.cuts.map((c, i) => `<option value="${c.id}" ${c.refImgId === r.id ? "selected" : ""}>C${i + 1} ${esc(c.name.slice(0, 10))}</option>`).join("")}
          <option value="__clear">— 割当をすべて外す</option>
        </select>
        <button class="icon-btn small danger" data-refdel="${r.id}" title="削除"><svg class="ic"><use href="#i-trash"/></svg></button>
      </div>
    </div>`;
  }).join("") || `<p class="insp-hint">まだ画像がありません。ChatGPT等で作成したキャラクター/シーン画像をドロップしてください</p>`;

  /* ステップ2: 設計サマリー */
  const cov = n ? evaluateCoverage(state.cuts) : [];
  const ngs = cov.filter(c => !c.ok);
  const warns = state.cuts.reduce((s, c) => s + evaluateFeasibility(c).filter(w => w.lv === "warn").length, 0);
  byId("wfSummary").innerHTML = n
    ? `<div class="wf-sum">
        <span class="wf-pill">${n}カット / 計${state.cuts.reduce((s, c) => s + (c.kind === "still" ? 0 : c.duration || 5), 0)}秒</span>
        <span class="wf-pill ${ngs.length ? "warn" : "ok"}">カバレッジ: ${ngs.length ? ngs.map(x => x.label).join("・") : "OK"}</span>
        <span class="wf-pill ${warns ? "warn" : "ok"}">フィージビリティ警告: ${warns}件</span>
      </div>`
    : `<p class="insp-hint">まだカットがありません。ステップ1の「ストーリーからカット設計」か、スタジオの技法ライブラリから作成してください</p>`;

  /* ステップ3: 書き出しセンター */
  const cfg = wfApiCfg();
  byId("wfApiUrl").value = cfg.endpoint || "";
  byId("wfModelSel").value = state.promptModel;
  byId("wfExportList").innerHTML = state.cuts.map((c, i) => {
    const ref = state.story.refs.find(r => r.id === c.refImgId);
    const sp = seedanceParams(c);
    return `
    <div class="wf-exp" data-cid="${c.id}">
      <div class="wf-exp-head">
        <b>C${i + 1}　${esc(c.name)}</b>
        ${wfStatusPill(c)}
        <span class="wf-exp-params">${esc(sp.ratio)} ｜ ${c.kind === "still" ? "静止画" : (c.duration || 5) + "s"} ｜ 1080p ｜ camerafixed: ${c.camera.move === "fix"}</span>
      </div>
      <div class="wf-exp-row">
        ${ref ? `<img class="wf-exp-ref" src="${ref.dataUrl}" title="first frame 参照: ${esc(ref.name)}">` : `<div class="wf-exp-noref" title="ステップ1で参照画像を割り当てると first frame として使えます">参照<br>なし</div>`}
        <textarea readonly rows="3">${esc(generatePrompt(c, state.promptModel))}</textarea>
      </div>
      <div class="wf-exp-actions">
        <button class="btn small" data-wfcopy="${c.id}"><svg class="ic"><use href="#i-copy"/></svg> プロンプトをコピー</button>
        ${cfg.endpoint ? `<button class="btn small" data-wfsend="${c.id}"><svg class="ic"><use href="#i-upload"/></svg> APIへ送信</button>` : ""}
        <button class="btn small" data-wfgen="${c.id}">生成済みにする</button>
        <button class="btn small" data-wfok="${c.id}">採用にする</button>
        <span class="insp-hint" data-wfmsg="${c.id}"></span>
      </div>
    </div>`;
  }).join("") || `<p class="insp-hint">カットを設計するとここに書き出しカードが並びます</p>`;

  /* ステップ4: レビューボード */
  byId("wfBoard").innerHTML = n
    ? `<div class="wf-board">${state.cuts.map((c, i) =>
        `<button class="wf-boardcell ${c.wfStatus}" data-wfcycle="${c.id}" title="クリックで状態を進める (${(WF_STATUS.find(w => w.id === c.wfStatus) || WF_STATUS[0]).label})">C${i + 1}<small>${(WF_STATUS.find(w => w.id === c.wfStatus) || WF_STATUS[0]).label}</small></button>`).join("")}</div>
      <p class="insp-hint">採用 ${counts.approved}/${n} — 全カット採用でこのストーリーは完成。生成結果がイメージと違う場合はステップ2に戻って機材・ライティングを調整 → 再書き出し</p>`
    : "";

  /* ラフカット: 添付状況をIndexedDBから読み直す (非同期) */
  rcRefreshIndex();
}

function setupWorkflow() {
  byId("btnFlowPage").addEventListener("click", () => { renderWorkflow(); byId("wfOverlay").hidden = false; });
  byId("btnWfBack").addEventListener("click", () => { byId("wfOverlay").hidden = true; });
  byId("btnWfStudio").addEventListener("click", () => { byId("wfOverlay").hidden = true; });
  byId("wfStory").addEventListener("input", e => { state.story.text = e.target.value; });
  byId("btnWfDesign").addEventListener("click", wfDesignFromStory);

  /* 参照画像: ドロップ/選択 */
  const drop = byId("wfDrop");
  drop.addEventListener("click", () => byId("wfRefInput").click());
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); wfAddRefFiles([...e.dataTransfer.files]); });
  byId("wfRefInput").addEventListener("change", e => { wfAddRefFiles([...e.target.files]); e.target.value = ""; });

  const wfm = byId("wfModelSel");
  wfm.innerHTML = PROMPT_MODELS.map(m => `<option value="${m.id}">${esc(m.label)}</option>`).join("");
  wfm.addEventListener("change", () => {
    state.promptModel = wfm.value;
    const pm2 = byId("promptModelSelect");
    if (pm2) pm2.value = wfm.value; // ヘッダー側と同期
    renderPrompt();
    renderWorkflow();
  });
  byId("btnWfCopySeq").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(buildSeedanceSequence()); } catch { /* file://等 */ }
    state.cuts.forEach(c => { if (c.wfStatus === "plan" && c.kind !== "still") c.wfStatus = "prompted"; });
    renderCutStrip(); renderWorkflow();
  });
  byId("btnWfPngs").addEventListener("click", () => {
    exportBoardPngs(byId("wfPngMsg")).catch(err => { byId("wfPngMsg").textContent = "⚠️ " + err.message; });
  });
  byId("btnWfMd").addEventListener("click", () => {
    exportPromptPack(byId("wfPngMsg")).catch(err => { byId("wfPngMsg").textContent = "⚠️ " + err.message; });
  });
  byId("btnWfApiSave").addEventListener("click", () => {
    lsSet(LS_APICFG, { endpoint: byId("wfApiUrl").value.trim() });
    byId("wfApiMsg").textContent = "✓ 保存しました";
    renderWorkflow();
  });

  /* カード内の操作は委譲で受ける */
  byId("wfBody").addEventListener("click", async e => {
    const cutBy = attr => { const el = e.target.closest(`[${attr}]`); return el ? { el, cut: state.cuts.find(c => c.id === el.getAttribute(attr)) } : null; };
    let hit;
    if ((hit = cutBy("data-wfcopy")) && hit.cut) {
      try { await navigator.clipboard.writeText(generatePrompt(hit.cut, state.promptModel)); } catch { /* 手動コピーにフォールバック */ }
      if (hit.cut.wfStatus === "plan") hit.cut.wfStatus = "prompted";
      renderCutStrip(); renderWorkflow();
    } else if ((hit = cutBy("data-wfsend")) && hit.cut) {
      wfSendCut(hit.cut, byId("wfBody").querySelector(`[data-wfmsg="${hit.cut.id}"]`));
    } else if ((hit = cutBy("data-wfgen")) && hit.cut) {
      hit.cut.wfStatus = "generated"; renderCutStrip(); renderWorkflow();
    } else if ((hit = cutBy("data-wfok")) && hit.cut) {
      hit.cut.wfStatus = "approved"; renderCutStrip(); renderWorkflow();
    } else if ((hit = cutBy("data-wfcycle")) && hit.cut) {
      const order = WF_STATUS.map(w => w.id);
      hit.cut.wfStatus = order[(order.indexOf(hit.cut.wfStatus) + 1) % order.length];
      renderCutStrip(); renderWorkflow();
    } else if (e.target.closest("[data-refdel]")) {
      const id = e.target.closest("[data-refdel]").getAttribute("data-refdel");
      state.story.refs = state.story.refs.filter(r => r.id !== id);
      state.cuts.forEach(c => { if (c.refImgId === id) c.refImgId = null; });
      refresh(); renderInspector();
      renderWorkflow();
    } else if (e.target.closest("[data-rcattach]")) {
      const input = byId("rcClipInput");
      input.dataset.cutId = e.target.closest("[data-rcattach]").getAttribute("data-rcattach");
      input.click();
    } else if (e.target.closest("[data-rcdel]")) {
      const id = e.target.closest("[data-rcdel]").getAttribute("data-rcdel");
      idbDelClip(id).then(() => {
        if (roughCut.urls[id]) { URL.revokeObjectURL(roughCut.urls[id]); delete roughCut.urls[id]; }
        rcRefreshIndex();
      });
    }
  });
  byId("wfBody").addEventListener("change", e => {
    const sel = e.target.closest("[data-refassign]");
    if (!sel) return;
    const refId = sel.getAttribute("data-refassign");
    if (sel.value === "__clear") {
      state.cuts.forEach(c => { if (c.refImgId === refId) c.refImgId = null; });
    } else if (sel.value) {
      const c = state.cuts.find(c2 => c2.id === sel.value);
      if (c) c.refImgId = refId;
    }
    refresh(); renderInspector();
    renderWorkflow();
  });

  /* 4→1: プロジェクトを保存して次のストーリーへ */
  byId("btnWfNext").addEventListener("click", () => {
    if (!confirm("このストーリーを完了して、新しいストーリーを開始しますか?\n(現在のプロジェクトはブラウザに保存されます)")) return;
    if (!state.projectId) state.projectId = "p" + Date.now();
    const all = lsGet(LS_PROJECTS, {});
    all[state.projectId] = { id: state.projectId, title: state.projectTitle, updated: Date.now(), data: snapshotState() };
    lsSet(LS_PROJECTS, all);
    applySnapshot({
      mode: "video", projectTitle: "無題プロジェクト", projectId: null,
      cuts: [makeCut(allPresets().find(p => p.id === "three-point"))],
      story: { text: "", refs: [] },
    });
    renderWorkflow();
    byId("wfBody").scrollTop = 0;
    setTimeout(gcMediaClips, 4000); // 自動保存が新しい状態を書いた後に回収
  });

  /* 参照画像のドラッグ&ドロップ割当 (WF内: 画像カード → 書き出しカード) */
  byId("wfRefGrid").addEventListener("dragstart", e => {
    const card = e.target.closest("[data-refdrag]");
    if (card) e.dataTransfer.setData("text/vs-ref", card.dataset.refdrag);
  });
  byId("wfBody").addEventListener("dragover", e => {
    const exp = e.target.closest(".wf-exp");
    if (!exp) return;
    e.preventDefault();
    exp.classList.add("drop-hint");
  });
  byId("wfBody").addEventListener("dragleave", e => {
    const exp = e.target.closest(".wf-exp");
    if (exp) exp.classList.remove("drop-hint");
  });
  byId("wfBody").addEventListener("drop", e => {
    const exp = e.target.closest(".wf-exp");
    if (!exp) return;
    e.preventDefault();
    exp.classList.remove("drop-hint");
    const refId = e.dataTransfer.getData("text/vs-ref");
    const cut = state.cuts.find(c => c.id === exp.dataset.cid);
    if (!cut || !refId || !state.story.refs.some(r => r.id === refId)) return;
    cut.refImgId = refId;
    refresh(); renderInspector();
    renderWorkflow();
  });
}

/* スタジオ側: カット割りサムネへ参照画像 (内部ドラッグ or OSの画像ファイル) をドロップ */
function setupRefDnD() {
  const strip = byId("cutStrip");
  strip.addEventListener("dragover", e => {
    const th = e.target.closest(".cut-thumb");
    if (!th) return;
    e.preventDefault();
    th.classList.add("drop-hint");
  });
  strip.addEventListener("dragleave", e => {
    const th = e.target.closest(".cut-thumb");
    if (th) th.classList.remove("drop-hint");
  });
  strip.addEventListener("drop", async e => {
    const th = e.target.closest(".cut-thumb");
    if (!th) return;
    e.preventDefault();
    th.classList.remove("drop-hint");
    const cut = state.cuts[+th.dataset.idx];
    if (!cut) return;
    const refId = e.dataTransfer.getData("text/vs-ref");
    if (refId && state.story.refs.some(r => r.id === refId)) {
      cut.refImgId = refId;
    } else if (e.dataTransfer.files && e.dataTransfer.files.length) {
      const before = state.story.refs.length;
      await wfAddRefFiles([...e.dataTransfer.files]); // 取り込み+縮小 (透過検出込み)
      if (state.story.refs.length === before) return; // 画像でなかった等
      cut.refImgId = state.story.refs[state.story.refs.length - 1].id;
    } else {
      return;
    }
    refresh(); renderInspector();
    showToast(`C${state.cuts.indexOf(cut) + 1} に参照画像を割り当てました`);
  });
}

/* =========================================================
 * ラフカット編集 — 生成動画の保存 (IndexedDB) と連結再生/書き出し
 * トリムは各カットの「素材イン点(秒)」と「尺(秒)」をそのまま使う
 * (= EDLと同じ値で仮組みできる)。書き出しはWebM (プレビュー品質)。
 * ======================================================= */
const IDB_NAME = "vsMedia", IDB_STORE = "clips";
const roughCut = { index: {}, playing: false, stopFlag: false, urls: {}, ac: null, dest: null, wired: new Set(), gains: {}, stats: { cross: 0, veil: 0 } };

/* =========================================================
 * ファイル保存 — Artifact上では claude.use("downloads") 経由
 * (ビューアが確認して保存)、通常ブラウザではアンカーで直接保存。
 * ======================================================= */
async function saveFileAs(filename, data) {
  let dl = null;
  try { dl = typeof claude !== "undefined" && claude.use ? await claude.use("downloads") : null; }
  catch { dl = null; }
  if (dl) {
    /* Artifact内: アンカーは効かないので downloads のみ。失敗は false を返し呼び出し側で代替 */
    try {
      await dl.save({ filename, data });
      return true;
    } catch (err) {
      const code = err && err.code;
      if ((code === "rejected_extension" || code === "extension_not_enabled") && typeof data === "string") {
        // 許可外の拡張子 (.edl / .html / .svg等) のテキストは .txt として保存し直す
        try { await dl.save({ filename: filename.replace(/\.[^.]+$/, "") + ".txt", data }); return true; }
        catch { return false; }
      }
      return false;
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); // DOM外のアンカーだとファイル名が失われるブラウザがある
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}

/* =========================================================
 * ZIPライタ (無圧縮ストア・依存ゼロ) + SVG→PNGラスタライズ
 * ======================================================= */
function crc32(buf) {
  if (!crc32.t) {
    crc32.t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crc32.t[n] = c;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crc32.t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) { // files: [{name, data: Uint8Array}]
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8ファイル名
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true);
    lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, nameB.length, true);
    parts.push(lh.buffer, nameB, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, nameB.length, true);
    cd.setUint32(42, offset, true);
    central.push(cd.buffer, nameB);
    offset += 30 + nameB.length + f.data.length;
  }
  const cdSize = central.reduce((s, b) => s + b.byteLength, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);
  return new Blob([...parts, ...central, eocd.buffer], { type: "application/zip" });
}

function svgToCanvas(svgStr, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" }));
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVGを描画できませんでした")); };
    img.src = url;
  });
}

/* 全カットをPNG化してZIP (+連結シート)。Artifactでzipが保存できない場合はシートPNG単体で保存 */
async function exportBoardPngs(msgEl) {
  const title = state.projectTitle.replace(/[\\/:*?"<>|]/g, "_");
  const files = [];
  const panels = [];
  for (let i = 0; i < state.cuts.length; i++) {
    if (msgEl) msgEl.textContent = `画像化中… C${i + 1}/${state.cuts.length}`;
    const cut = state.cuts[i];
    const d = aspectDims(cut.aspect);
    const tw = 1280, th = Math.round(1280 * d.H / d.W);
    let svg = renderPreviewSVG(cut, "bp" + i);
    svg = svg.replace("<svg ", `<svg width="${tw}" height="${th}" `);
    const cv = await svgToCanvas(svg, tw, th);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    files.push({ name: `C${String(i + 1).padStart(2, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    panels.push({ cv, cut, i });
  }

  /* 連結シート (2列グリッド + キャプションバー) */
  const cols = 2, pw = 640, gap = 18, capH = 30, pad = 24;
  const rows = [];
  for (let i = 0; i < panels.length; i += cols) rows.push(panels.slice(i, i + cols));
  const rowHs = rows.map(r => Math.max(...r.map(p => Math.round(pw * p.cv.height / p.cv.width))) + capH);
  const sheet = document.createElement("canvas");
  sheet.width = pad * 2 + cols * pw + (cols - 1) * gap;
  sheet.height = pad * 2 + 34 + rowHs.reduce((a, b) => a + b + gap, -gap);
  const sc = sheet.getContext("2d");
  sc.fillStyle = "#f5f5f7";
  sc.fillRect(0, 0, sheet.width, sheet.height);
  sc.fillStyle = "#1a1d24";
  sc.font = "700 20px 'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
  sc.fillText(`${state.projectTitle} — 絵コンテ (${panels.length}カット)`, pad, pad + 16);
  let y = pad + 34;
  rows.forEach((row, ri) => {
    row.forEach((pn, ci) => {
      const x = pad + ci * (pw + gap);
      const ph = Math.round(pw * pn.cv.height / pn.cv.width);
      sc.drawImage(pn.cv, x, y, pw, ph);
      sc.fillStyle = "#1a1d24";
      sc.font = "600 13px 'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
      const t = TRANSITIONS.find(x2 => x2.id === (pn.cut.transition || "cut"));
      sc.fillText(
        `C${pn.i + 1}  ${pn.cut.name.slice(0, 22)} ｜ ${pn.cut.kind === "still" ? "スチール" : (pn.cut.duration || 5) + "s"}${pn.i < state.cuts.length - 1 && t ? " ｜ →" + t.label.split(" ")[0] : ""}`,
        x, y + ph + 19);
    });
    y += rowHs[ri] + gap;
  });
  const sheetBlob = await new Promise(r => sheet.toBlob(r, "image/png"));
  files.unshift({ name: "storyboard-sheet.png", data: new Uint8Array(await sheetBlob.arrayBuffer()) });
  files.push({ name: "prompts.md", data: new TextEncoder().encode(buildPromptPackMd()) });

  if (msgEl) msgEl.textContent = "保存中…";
  const okZip = await saveFileAs(`${title}-storyboard.zip`, buildZip(files));
  if (!okZip) {
    // Artifact等でzipが保存できない場合は連結シートPNG単体で
    const okPng = await saveFileAs(`${title}-storyboard-sheet.png`, sheetBlob);
    if (msgEl) msgEl.textContent = okPng ? `✓ 連結シートPNGを保存しました (この環境ではZIPが保存できないため。単体HTMLならZIPで${files.length}枚)` : "保存をキャンセルしました";
    return;
  }
  if (msgEl) msgEl.textContent = `✓ ZIPを保存しました (シート+各カットPNG+prompts.md ${files.length}ファイル)`;
}

/* =========================================================
 * プロンプト一式 Markdown — ストーリー+全カットの生成指示を1ファイルに
 * (ChatGPT/Seedance へそのまま貼れる受け渡し資料)
 * ======================================================= */
function buildPromptPackMd() {
  const total = state.cuts.reduce((s, c) => s + (c.kind === "still" ? 0 : c.duration || 5), 0);
  const L = [];
  L.push(`# ${state.projectTitle} — 生成プロンプト一式`);
  L.push(`カット数 ${state.cuts.length} ｜ 合計 ${total}s ｜ Generated by Virtual Studio`);
  if (state.story.text.trim()) {
    L.push(`\n## ストーリー\n`);
    L.push(state.story.text.trim());
  }
  const pmLabel = (PROMPT_MODELS.find(m => m.id === state.promptModel) || PROMPT_MODELS[0]).label;
  L.push(`\n## カット別プロンプト (${pmLabel})`);
  state.cuts.forEach((c, i) => {
    const ref = state.story.refs.find(r => r.id === c.refImgId);
    const t = TRANSITIONS.find(x => x.id === (c.transition || "cut"));
    L.push(`\n### C${i + 1}　${c.name}`);
    const meta = [
      `${c.kind === "still" ? "静止画" : (c.duration || 5) + "s"}`,
      seedanceRatio(c.aspect), "1080p",
      `camerafixed: ${c.camera.move === "fix"}`,
    ];
    L.push(`- パラメータ: ${meta.join(" / ")}`);
    if (c.aim) L.push(`- 狙い: ${c.aim}`);
    if (ref) L.push(`- first frame 参照画像: ${ref.name}${ref.hasAlpha ? " (背景透過)" : ""}`);
    if (c.caption) L.push(`- テロップ (編集時に付ける — プロンプトには入れない): ${c.caption}`);
    if (i < state.cuts.length - 1 && t) L.push(`- 次カットへの繋ぎ: ${t.label}`);
    L.push("\n```");
    L.push(generatePrompt(c, state.promptModel));
    L.push("```");
  });
  const seq = buildSeedanceSequence();
  if (seq) {
    L.push(`\n## 連結シーケンス (1プロンプト版・Seedance形式)\n`);
    L.push("```");
    L.push(seq);
    L.push("```");
  }
  return L.join("\n");
}

async function exportPromptPack(msgEl) {
  const title = state.projectTitle.replace(/[\\/:*?"<>|]/g, "_");
  const ok = await saveFileAs(`${title}-prompts.md`, buildPromptPackMd());
  if (msgEl) msgEl.textContent = ok ? "✓ プロンプト一式 (Markdown) を保存しました" : "保存をキャンセルしました";
}

/* =========================================================
 * プロジェクト一式バックアップ — 設定JSON+参照画像+動画/音声をZIPに
 * (無圧縮ストアZIPのみ対応の自前パーサで完全復元できる)
 * ======================================================= */
function parseZip(buf) { // Uint8Array → [{name, data}]
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("ZIPファイルではありません");
  const count = dv.getUint16(e + 10, true);
  let off = dv.getUint32(e + 16, true);
  const dec = new TextDecoder();
  const files = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("ZIPの解析に失敗しました");
    const method = dv.getUint16(off + 10, true);
    const size = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(buf.subarray(off + 46, off + 46 + nameLen));
    if (method !== 0) throw new Error(`圧縮されたZIPは未対応です (${name}) — 本アプリが書き出したZIPを指定してください`);
    const lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
    const dataOff = lho + 30 + lnl + lel;
    files.push({ name, data: buf.subarray(dataOff, dataOff + size) });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

async function exportBackupZip(msgEl) {
  const enc = new TextEncoder();
  const title = state.projectTitle.replace(/[\\/:*?"<>|]/g, "_");
  if (msgEl) msgEl.textContent = "バックアップ作成中…";
  const files = [{
    name: "project.json",
    data: enc.encode(JSON.stringify({ kind: "vs-backup", version: 2, data: snapshotState() }, null, 1)),
  }];
  const manifest = [];
  try {
    for (const c of await idbAllClips()) {
      const special = Object.values(RC_AUDIO_KEYS).includes(c.cutId);
      if (!special && !state.cuts.some(x => x.id === c.cutId)) continue; // 現プロジェクト分のみ
      const extM = String(c.name || "").match(/\.([a-z0-9]{2,4})$/i);
      const fname = `media/${c.cutId}.${extM ? extM[1] : "webm"}`;
      files.push({ name: fname, data: new Uint8Array(await c.blob.arrayBuffer()) });
      manifest.push({ cutId: c.cutId, file: fname, name: c.name, type: c.type });
    }
  } catch { /* IDB不可でも設定だけは保存する */ }
  files.push({ name: "media-manifest.json", data: enc.encode(JSON.stringify(manifest)) });
  const blob = buildZip(files);
  const ok = await saveFileAs(`${title}-backup.zip`, blob);
  if (msgEl) {
    msgEl.textContent = ok
      ? `✓ バックアップを保存しました (${(blob.size / 1048576).toFixed(1)}MB / メディア${manifest.length}件)`
      : "⚠️ この環境ではZIPを保存できません (単体HTML版で実行してください)";
  }
}

async function importBackupZip(file, msgEl) {
  if (msgEl) msgEl.textContent = "読み込み中…";
  const entries = parseZip(new Uint8Array(await file.arrayBuffer()));
  const pj = entries.find(f => f.name === "project.json");
  if (!pj) throw new Error("project.json が見つかりません (本アプリのバックアップZIPを指定してください)");
  const parsed = JSON.parse(new TextDecoder().decode(pj.data));
  applySnapshot(parsed.data || parsed);
  let n = 0;
  const mf = entries.find(f => f.name === "media-manifest.json");
  if (mf) {
    for (const m of JSON.parse(new TextDecoder().decode(mf.data))) {
      const ent = entries.find(f => f.name === m.file);
      if (!ent) continue;
      await idbPutClip({ cutId: m.cutId, name: m.name, type: m.type, size: ent.data.length, blob: new Blob([ent.data], { type: m.type }), addedAt: Date.now() });
      if (roughCut.urls[m.cutId]) { URL.revokeObjectURL(roughCut.urls[m.cutId]); delete roughCut.urls[m.cutId]; }
      n++;
    }
  }
  rcRefreshIndex();
  if (msgEl) msgEl.textContent = `✓ 復元しました (${state.cuts.length}カット / メディア${n}件)`;
}

function idbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(IDB_STORE, { keyPath: "cutId" });
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbPutClip(rec) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(rec);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGetClip(cutId) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const rq = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(cutId);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbDelClip(cutId) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(cutId);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbAllClips() {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const rq = db.transaction(IDB_STORE).objectStore(IDB_STORE).getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
}

async function rcRefreshIndex() {
  try {
    const all = await idbAllClips();
    roughCut.index = {};
    all.forEach(r => { roughCut.index[r.cutId] = { name: r.name, size: r.size }; });
    renderRcList();
    renderRcAudio();
  } catch {
    byId("rcList").innerHTML = `<p class="insp-hint">⚠️ このブラウザでは動画保存 (IndexedDB) が使えません</p>`;
  }
}

/* 音声トラック (BGM/ナレーション) はIDBの特別キーに保存 */
const RC_AUDIO_KEYS = { bgm: "__bgm", nar: "__nar" };

function renderRcAudio() {
  for (const [key, id] of Object.entries(RC_AUDIO_KEYS)) {
    const clip = roughCut.index[id];
    const cap = key === "bgm" ? "Bgm" : "Nar";
    byId(`rc${cap}Name`).textContent = clip ? `${clip.name} (${(clip.size / 1048576).toFixed(1)}MB)` : "なし";
    byId(`rc${cap}Del`).hidden = !clip;
    byId(`rc${cap}Vol`).value = Math.round((state.story.audioVol?.[key] ?? (key === "bgm" ? 0.4 : 1)) * 100);
  }
  /* ナレーションの開始カット選択 */
  const sel = byId("rcNarStart");
  sel.hidden = !roughCut.index[RC_AUDIO_KEYS.nar];
  sel.innerHTML = state.cuts.map((c, i) =>
    `<option value="${esc(c.id)}" ${state.story.narStartCutId === c.id || (!state.story.narStartCutId && i === 0) ? "selected" : ""}>C${i + 1}から</option>`).join("");
  renderRcSeek();
}

/* シークバー: 再生可能カットを尺比例のブロックで表示 */
function renderRcSeek() {
  const cuts = state.cuts.filter(c => c.kind !== "still" && roughCut.index[c.id]);
  const wrap = byId("rcSeekBlocks");
  if (!cuts.length) { wrap.innerHTML = ""; byId("rcSeek").classList.add("empty"); return; }
  byId("rcSeek").classList.remove("empty");
  const total = cuts.reduce((s, c) => s + (c.duration || 5), 0);
  wrap.innerHTML = cuts.map(c =>
    `<div class="rc-seg" style="flex:${c.duration || 5}" title="C${state.cuts.indexOf(c) + 1} ${esc(c.name)} (${c.duration || 5}s)">C${state.cuts.indexOf(c) + 1}</div>`).join("");
  const tm = byId("rcTime");
  if (tm && !roughCut.playing) tm.textContent = `0.0 / ${total.toFixed(1)}s`;
  rcRenderNarWave(); // 非同期でナレーション波形を重ねる
}

/* ナレーション波形: decodeAudioDataでピークを取り、シークバー上の
 * 「開始カット位置から音声の長さ分」に重ねて描く — どこで喋るかが見える */
async function rcRenderNarWave() {
  const cvs = byId("rcNarWave");
  const clipInfo = roughCut.index[RC_AUDIO_KEYS.nar];
  const cuts = state.cuts.filter(c => c.kind !== "still" && roughCut.index[c.id]);
  if (!clipInfo || !cuts.length) { cvs.hidden = true; return; }
  const key = `${clipInfo.name}:${clipInfo.size}`;
  if (!roughCut.narPeaks || roughCut.narPeaks.key !== key) {
    try {
      const rec = await idbGetClip(RC_AUDIO_KEYS.nar);
      const dac = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await dac.decodeAudioData(await rec.blob.arrayBuffer());
      dac.close();
      const ch = buf.getChannelData(0);
      const N = 240;
      const peaks = new Float32Array(N);
      const step = Math.max(1, Math.floor(ch.length / N));
      for (let i = 0; i < N; i++) {
        let mx = 0;
        const base = i * step;
        for (let j = 0; j < step; j += 16) mx = Math.max(mx, Math.abs(ch[base + j] || 0));
        peaks[i] = mx;
      }
      roughCut.narPeaks = { key, peaks, dur: buf.duration };
    } catch {
      roughCut.narPeaks = { key, peaks: null };
    }
  }
  const pk = roughCut.narPeaks;
  if (!pk.peaks) { cvs.hidden = true; return; }
  cvs.hidden = false;
  cvs.width = cvs.offsetWidth || 640;
  const g = cvs.getContext("2d");
  g.clearRect(0, 0, cvs.width, cvs.height);
  let acc = 0;
  const sched = cuts.map(c => { const s0 = acc; acc += c.duration || 5; return s0; });
  const total = acc;
  let startSec = 0;
  if (state.story.narStartCutId) {
    const t = state.cuts.findIndex(c => c.id === state.story.narStartCutId);
    const kk = cuts.findIndex(c => state.cuts.indexOf(c) >= t);
    if (kk > 0) startSec = sched[kk];
  }
  const x0 = startSec / total * cvs.width;
  const w = Math.max(2, Math.min(pk.dur, total - startSec) / total * cvs.width);
  const shown = Math.min(1, (total - startSec) / pk.dur); // タイムラインからはみ出す分は切る
  const n = Math.max(1, Math.floor(pk.peaks.length * shown));
  g.fillStyle = "rgba(10, 132, 255, 0.5)";
  for (let i = 0; i < n; i++) {
    const h = Math.max(1.5, pk.peaks[i] * (cvs.height - 4));
    g.fillRect(x0 + (i / n) * w, (cvs.height - h) / 2, Math.max(1, w / n - 0.6), h);
  }
}

function renderRcList() {
  const rows = state.cuts.filter(c => c.kind !== "still").map(c => {
    const i = state.cuts.indexOf(c);
    const clip = roughCut.index[c.id];
    return `<div class="rc-row">
      <b>C${i + 1}</b>
      <span class="rc-name">${esc(c.name)}</span>
      <span class="rc-trim" title="タイムライン/インスペクタの「素材イン点」「尺」がそのまま使われます">IN ${c.srcInSec || 0}s ｜ 尺 ${c.duration || 5}s</span>
      ${clip
        ? `<span class="rc-clip" title="${esc(clip.name)}">🎞 ${esc(clip.name)}<small> (${(clip.size / 1048576).toFixed(1)}MB)</small></span>
           <button class="btn small" data-rcattach="${c.id}">差し替え</button>
           <button class="icon-btn small danger" data-rcdel="${c.id}" title="添付した動画を削除"><svg class="ic"><use href="#i-trash"/></svg></button>`
        : `<button class="btn small" data-rcattach="${c.id}"><svg class="ic"><use href="#i-plus"/></svg> 生成動画を添付</button>`}
    </div>`;
  }).join("");
  byId("rcList").innerHTML = rows || `<p class="insp-hint">ビデオカットがありません</p>`;
}

async function wfAttachClip(cut, file) {
  await idbPutClip({ cutId: cut.id, name: file.name, type: file.type, size: file.size, blob: file, addedAt: Date.now() });
  if (roughCut.urls[cut.id]) { URL.revokeObjectURL(roughCut.urls[cut.id]); delete roughCut.urls[cut.id]; }
  if (cut.wfStatus === "plan" || cut.wfStatus === "prompted") cut.wfStatus = "generated";
  renderCutStrip();
  renderWorkflow();
}

async function rcGetUrl(cutId) {
  if (roughCut.urls[cutId]) return roughCut.urls[cutId];
  const rec = await idbGetClip(cutId);
  if (!rec) return null;
  roughCut.urls[cutId] = URL.createObjectURL(rec.blob);
  return roughCut.urls[cutId];
}

/* 音声: MediaElementSource は要素につき1回しか作れないため配線済みを記録 */
function rcWireAudio(v) {
  try {
    if (!roughCut.ac) {
      roughCut.ac = new (window.AudioContext || window.webkitAudioContext)();
      roughCut.dest = roughCut.ac.createMediaStreamDestination();
    }
    if (!roughCut.wired.has(v.id)) {
      const s = roughCut.ac.createMediaElementSource(v);
      const g = roughCut.ac.createGain();
      s.connect(g);
      g.connect(roughCut.dest);
      g.connect(roughCut.ac.destination);
      roughCut.gains[v.id] = g;
      roughCut.wired.add(v.id);
    }
  } catch { /* 音声なしで続行 */ }
}

function rcLoad(v, url) {
  return new Promise(res => {
    v.addEventListener("loadeddata", res, { once: true });
    v.addEventListener("error", res, { once: true });
    v.src = url;
    v.load();
  });
}

/* ラフカット再生/書き出し — 常にcanvasに合成描画する。
 * A/B 2系統の<video>でディゾルブ (クロスフェード0.7s)、
 * フェードアウト=黒経由0.5s / ホワイトアウト=白経由0.35s。その他は直つなぎ。 */
async function rcRun(record, startAt) {
  if (roughCut.playing) return;
  const cuts = state.cuts.filter(c => c.kind !== "still" && roughCut.index[c.id]);
  if (!cuts.length) { byId("rcMsg").textContent = "⚠️ 添付された動画がありません。各カットに生成動画を添付してください"; return; }
  startAt = startAt || { k: 0, offset: 0 };
  roughCut.playing = true;
  roughCut.recording = !!record;
  roughCut.stopFlag = false;
  roughCut.seekReq = null;
  roughCut.stats = { cross: 0, veil: 0 };

  /* シーク用スケジュール (レコードイン概算 — ディゾルブの重なりは無視) */
  const sched = [];
  let totalDur = 0;
  cuts.forEach(c => { sched.push(totalDur); totalDur += c.duration || 5; });
  const updHead = (k2, v) => {
    const pos = Math.min(totalDur, sched[k2] + Math.max(0, v && v._segStart != null ? v.currentTime - v._segStart : 0));
    const ph = byId("rcPlayhead");
    if (ph) ph.style.left = `${(pos / totalDur * 100).toFixed(2)}%`;
    const tm = byId("rcTime");
    if (tm) tm.textContent = `${pos.toFixed(1)} / ${totalDur.toFixed(1)}s`;
  };

  const canvas = byId("rcCanvas");
  canvas.width = 1280; canvas.height = 720;
  const c2 = canvas.getContext("2d");
  const vids = [byId("rcVideoA"), byId("rcVideoB")];
  const draw = { a: null, b: null, alphaB: 0, veil: 0, veilColor: "#000", caption: "" };
  let stopDraw = false;

  const paint = () => {
    c2.fillStyle = "#000";
    c2.fillRect(0, 0, canvas.width, canvas.height);
    const dv = (v, alpha) => {
      if (!v || !v.videoWidth || alpha <= 0) return;
      c2.globalAlpha = Math.min(1, alpha);
      const s = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
      const w = v.videoWidth * s, h = v.videoHeight * s;
      c2.drawImage(v, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      c2.globalAlpha = 1;
    };
    dv(draw.a, 1);
    dv(draw.b, draw.alphaB);
    if (draw.caption) {
      /* テロップ焼き込み (編集用字幕) */
      c2.font = "600 34px 'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
      c2.textAlign = "center";
      const tw = Math.min(canvas.width * 0.86, c2.measureText(draw.caption).width + 56);
      c2.globalAlpha = 0.45;
      c2.fillStyle = "#000";
      c2.fillRect((canvas.width - tw) / 2, canvas.height - 100, tw, 54);
      c2.globalAlpha = 1;
      c2.fillStyle = "#fff";
      c2.fillText(draw.caption, canvas.width / 2, canvas.height - 62);
    }
    if (draw.veil > 0) {
      c2.globalAlpha = Math.min(1, draw.veil);
      c2.fillStyle = draw.veilColor;
      c2.fillRect(0, 0, canvas.width, canvas.height);
      c2.globalAlpha = 1;
    }
    if (!stopDraw) requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);

  vids.forEach(rcWireAudio);

  /* 音声トラック: BGM=ループ / ナレーション=1回。GainNodeで音量調整 */
  const audioEls = [];
  for (const [key, id] of Object.entries(RC_AUDIO_KEYS)) {
    if (!roughCut.index[id]) continue;
    const el = byId(key === "bgm" ? "rcBgmEl" : "rcNarEl");
    const url = await rcGetUrl(id);
    if (!url) continue;
    if (el.src !== url) { el.src = url; el.load(); }
    el.loop = key === "bgm";
    rcWireAudio(el);
    if (roughCut.gains[el.id]) roughCut.gains[el.id].gain.value = state.story.audioVol?.[key] ?? (key === "bgm" ? 0.4 : 1);
    audioEls.push(el);
  }
  if (roughCut.ac) roughCut.ac.resume();

  let recorder = null;
  const chunks = [];
  if (record) {
    const stream = canvas.captureStream(30);
    const at = roughCut.dest && roughCut.dest.stream.getAudioTracks()[0];
    if (at) stream.addTrack(at);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.start(250);
  }

  const frame = () => new Promise(r => requestAnimationFrame(r));
  const startSeg = async (v, cut, extra = 0) => {
    let s0 = (cut.srcInSec || 0) + extra;
    if (v.duration && s0 >= v.duration - 0.2) s0 = extra; // 素材がイン点より短ければ頭から
    if (v.duration && s0 >= v.duration - 0.1) s0 = 0;
    v.currentTime = s0;
    v._segStart = s0 - extra; // 経過時間の基準はイン点 (シーク位置表示のため extra を引く)
    try { await v.play(); } catch { /* 再生不可素材はスキップ扱い */ }
  };

  await rcLoad(vids[startAt.k % 2], await rcGetUrl(cuts[startAt.k].id));
  /* ナレーションは指定カット到達時に開始 (BGMは常に頭から) */
  const narEl = byId("rcNarEl");
  const hasNar = audioEls.includes(narEl);
  let narStarted = false;
  const narStartK = (() => {
    const id = state.story.narStartCutId;
    if (!id) return 0;
    const target = state.cuts.findIndex(c => c.id === id);
    if (target < 0) return 0;
    const kk = cuts.findIndex(c => state.cuts.indexOf(c) >= target);
    return kk < 0 ? 0 : kk;
  })();
  audioEls.forEach(el => {
    if (el === narEl && hasNar) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  });
  let veilIn = 0;

  for (let k = startAt.k; k < cuts.length && !roughCut.stopFlag && !roughCut.seekReq; k++) {
    const v = vids[k % 2], nv = vids[(k + 1) % 2];
    const cut = cuts[k];
    const dur = cut.duration || 5;
    if (!v._prestarted) await startSeg(v, cut, k === startAt.k ? startAt.offset : 0);
    v._prestarted = false;
    if (hasNar && !narStarted && k >= narStartK) {
      narEl.currentTime = 0;
      narEl.play().catch(() => {});
      narStarted = true;
    }
    draw.a = v; draw.b = null; draw.alphaB = 0;
    draw.caption = cut.caption || "";
    byId("rcMsg").textContent = `${record ? "録画中" : "再生中"}: C${state.cuts.indexOf(cut) + 1} (${k + 1}/${cuts.length})`;

    // フェード明け (前カットが黒/白経由だった場合)
    if (veilIn > 0) {
      const t0 = performance.now();
      while (!roughCut.stopFlag && !roughCut.seekReq && performance.now() - t0 < veilIn * 1000) {
        draw.veil = 1 - (performance.now() - t0) / (veilIn * 1000);
        await frame();
      }
      draw.veil = 0;
      veilIn = 0;
    }

    // 次カットを先読み
    let preload = null;
    if (k + 1 < cuts.length) preload = rcGetUrl(cuts[k + 1].id).then(u => rcLoad(nv, u));

    const endT = Math.min(v.duration || 1e9, (v._segStart || 0) + dur);
    const trans = k + 1 < cuts.length ? (cut.transition || "cut") : "cut";
    const X = trans === "dissolve" ? 0.7 : 0;
    const FADE = trans === "fadeout" ? 0.5 : trans === "whiteout" ? 0.35 : 0;

    // 本編 (トランジション分を残して再生)
    while (!roughCut.stopFlag && !roughCut.seekReq && !v.ended && v.currentTime < endT - X - FADE - 0.03) {
      updHead(k, v);
      await frame();
    }

    if (roughCut.stopFlag || roughCut.seekReq) break;
    if (X > 0) {
      // ディゾルブ: 次カットを重ねてクロスフェード
      await preload;
      const nc = cuts[k + 1];
      await startSeg(nv, nc);
      nv._prestarted = true;
      draw.b = nv;
      roughCut.stats.cross++;
      const t0 = performance.now();
      while (!roughCut.stopFlag && !roughCut.seekReq && performance.now() - t0 < X * 1000) {
        draw.alphaB = (performance.now() - t0) / (X * 1000);
        updHead(k, v);
        await frame();
      }
      draw.a = nv; draw.b = null; draw.alphaB = 0;
      draw.caption = cuts[k + 1].caption || "";
      v.pause();
    } else if (FADE > 0) {
      // 黒/白経由
      draw.veilColor = trans === "whiteout" ? "#ffffff" : "#000000";
      roughCut.stats.veil++;
      const t0 = performance.now();
      while (!roughCut.stopFlag && !roughCut.seekReq && performance.now() - t0 < FADE * 1000) {
        draw.veil = (performance.now() - t0) / (FADE * 1000);
        updHead(k, v);
        await frame();
      }
      draw.veil = 1;
      v.pause();
      veilIn = FADE;
    } else {
      while (!roughCut.stopFlag && !roughCut.seekReq && !v.ended && v.currentTime < endT - 0.03) {
        updHead(k, v);
        await frame();
      }
      v.pause();
    }
  }

  vids.forEach(v => v.pause());
  audioEls.forEach(el => el.pause());
  roughCut.playing = false;
  if (recorder) {
    await new Promise(res => { recorder.onstop = res; recorder.stop(); });
    stopDraw = true;
    if (!roughCut.stopFlag && chunks.length) {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const name = `${state.projectTitle.replace(/[\\/:*?"<>|]/g, "_")}-roughcut.webm`;
      await saveFileAs(name, blob);
      byId("rcMsg").textContent = `✓ 書き出しました (${(blob.size / 1048576).toFixed(1)}MB WebM)。納品品質はEDL+元素材で編集ソフトへ`;
    } else {
      byId("rcMsg").textContent = "停止しました";
    }
  } else {
    stopDraw = true;
    if (roughCut.seekReq) {
      const rq = roughCut.seekReq;
      roughCut.seekReq = null;
      return rcRun(false, rq); // シーク位置から再入
    }
    byId("rcMsg").textContent = roughCut.stopFlag ? "停止しました" : "✓ 最後まで再生しました";
  }
}

function setupRoughCut() {
  byId("btnRcPlay").addEventListener("click", () => rcRun(false));
  byId("btnRcExport").addEventListener("click", () => rcRun(true));
  byId("btnRcStop").addEventListener("click", () => { roughCut.stopFlag = true; });
  byId("rcClipInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    const cut = state.cuts.find(c => c.id === e.target.dataset.cutId);
    e.target.value = "";
    if (file && cut) await wfAttachClip(cut, file);
  });

  /* 音声トラックの添付/削除/音量 */
  document.querySelectorAll("[data-audiokey]").forEach(btn => btn.addEventListener("click", () => {
    const input = byId("rcAudioInput");
    input.dataset.key = btn.dataset.audiokey;
    input.click();
  }));
  byId("rcAudioInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    const key = e.target.dataset.key;
    e.target.value = "";
    if (!file || !RC_AUDIO_KEYS[key]) return;
    const id = RC_AUDIO_KEYS[key];
    await idbPutClip({ cutId: id, name: file.name, type: file.type, size: file.size, blob: file, addedAt: Date.now() });
    if (roughCut.urls[id]) { URL.revokeObjectURL(roughCut.urls[id]); delete roughCut.urls[id]; }
    rcRefreshIndex();
  });
  document.querySelectorAll("[data-audiodel]").forEach(btn => btn.addEventListener("click", async () => {
    const id = RC_AUDIO_KEYS[btn.dataset.audiodel];
    await idbDelClip(id);
    if (roughCut.urls[id]) { URL.revokeObjectURL(roughCut.urls[id]); delete roughCut.urls[id]; }
    rcRefreshIndex();
  }));
  const volBind = (elId, key, audioElId) => byId(elId).addEventListener("input", e => {
    state.story.audioVol = state.story.audioVol || { bgm: 0.4, nar: 1 };
    state.story.audioVol[key] = +e.target.value / 100;
    const g = roughCut.gains[audioElId];
    if (g) g.gain.value = state.story.audioVol[key]; // 再生中もライブ反映
  });
  volBind("rcBgmVol", "bgm", "rcBgmEl");
  volBind("rcNarVol", "nar", "rcNarEl");
  byId("rcNarStart").addEventListener("change", e => {
    state.story.narStartCutId = e.target.value || null;
    renderRcSeek(); // 波形の開始位置を引き直す
  });

  /* ホバーでカットのプレビューサムネイルを出す */
  const seekEl = byId("rcSeek"), tip = byId("rcSeekTip");
  seekEl.addEventListener("mousemove", e => {
    const cuts = state.cuts.filter(c => c.kind !== "still" && roughCut.index[c.id]);
    if (!cuts.length) { tip.hidden = true; return; }
    const rect = seekEl.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let acc = 0;
    const sched = cuts.map(c => { const s0 = acc; acc += c.duration || 5; return s0; });
    const t = frac * acc;
    let k = cuts.length - 1;
    for (let i = 0; i < cuts.length; i++) {
      if (t < sched[i] + (cuts[i].duration || 5)) { k = i; break; }
    }
    const cut = cuts[k];
    if (tip.dataset.cid !== cut.id) {
      tip.innerHTML = `<div class="tip-thumb">${renderPreviewSVG(cut, "sktip")}</div>
        <div class="tip-cap">C${state.cuts.indexOf(cut) + 1}　${esc(cut.name.slice(0, 16))} ｜ ${cut.duration || 5}s</div>`;
      tip.dataset.cid = cut.id;
    }
    tip.hidden = false;
    const tw = tip.offsetWidth || 160;
    tip.style.left = `${Math.max(0, Math.min(rect.width - tw, e.clientX - rect.left - tw / 2))}px`;
  });
  seekEl.addEventListener("mouseleave", () => { tip.hidden = true; });

  /* シーク: クリック位置のカット/オフセットから再生 (録画中は無効) */
  byId("rcSeek").addEventListener("click", e => {
    const cuts = state.cuts.filter(c => c.kind !== "still" && roughCut.index[c.id]);
    if (!cuts.length || roughCut.recording && roughCut.playing) return;
    const rect = byId("rcSeek").getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let acc = 0;
    const sched = cuts.map(c => { const s0 = acc; acc += c.duration || 5; return s0; });
    const t = frac * acc;
    let k = cuts.length - 1;
    for (let i = 0; i < cuts.length; i++) {
      if (t < sched[i] + (cuts[i].duration || 5)) { k = i; break; }
    }
    const target = { k, offset: Math.max(0, t - sched[k]) };
    if (roughCut.playing) roughCut.seekReq = target; // ループが検知して再入する
    else rcRun(false, target);
  });
}

