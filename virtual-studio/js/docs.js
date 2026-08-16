/* =========================================================
 * Virtual Studio — ドキュメント出力 (app.jsから分離)
 *  指示書 / 絵コンテ / 技法mdインポータ / DMX / 香盤表 / EDL
 *  読み込み順: app.js より前 (呼び出しはすべて実行時)
 * ======================================================= */
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
      <td>${isLight && it.type !== "sun" && it.watt ? it.watt + "W" : "—"}</td>
    </tr>`;
  }).join("");
}

function buildInstructionDoc() {
  const today = new Date().toLocaleDateString("ja-JP");
  const modeLabel = { video: "動画スタジオ", still: "スチールスタジオ", outdoor: "屋外・ドローン" }[state.mode];

  const cutPages = state.cuts.map((cut, i) => {
    const preset = allPresets().find(p => p.id === cut.presetId);
    const jaLines = generateJaSummary(cut);
    const opts = cut.options.map(o => SHOT_OPTIONS.find(s => s.id === o)).filter(Boolean);
    return `
    <section class="cut-page">
      <h2>CUT ${i + 1}　${esc(cut.name)} <span class="dur">${cut.kind === "still" ? "スチール" : "尺: " + cut.duration + "秒"} ｜ ${esc(cut.aspect)} ｜ テイク${cut.takes} ｜ 準備${cut.setupMin}分</span></h2>
      ${cut.aim ? `<p class="aim"><b>狙い:</b> ${esc(cut.aim)}</p>` : ""}
      ${cut.dna ? `<p class="memo">🧬 <b>Pattern DNA: ${esc(cut.dna.name)}</b> — ${esc(cut.dna.tokens.join(", "))}${cut.dna.lineage && cut.dna.lineage.sources.length > 1 ? ` ｜ 由来: ${esc(cut.dna.lineage.sources.join(" + "))}` : ""}</p>` : ""}
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
        <thead><tr><th>機材</th><th>方位 (カメラ軸基準)</th><th>被写体距離</th><th>高さ</th><th>出力</th><th>色温度</th><th>照射角</th><th>モディファイア</th><th>スタンド</th><th>消費電力</th></tr></thead>
        <tbody>${equipTableRows(cut)}</tbody>
      </table>
      ${(() => {
        const pp = powerPlan(cut);
        if (!pp.total) return "";
        return `<p class="power-plan">⚡ <b>電源プラン (自動計算)</b>: 点灯 ${pp.count}灯 / 合計 ${pp.total}W → 100V15A回路 <b>${pp.circuits}回路</b> に分散${pp.genkVA ? ` ｜ 発電機使用時の推奨容量: <b>${pp.genkVA}kVA</b> (余裕率25%込み)` : ""}。大電力灯 (HMI等) は単独回路に。</p>`;
      })()}

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

      <h3>演出・収録・環境</h3>
      <table>
        <thead><tr><th>演技/動き</th><th>被写体メモ</th><th>移動速度</th><th>サイズ変化</th><th>ルック</th><th>音声</th><th>天候</th><th>時間帯</th></tr></thead>
        <tbody><tr>
          <td>${esc((SUBJECT_ACTIONS.find(a => a.id === cut.action) || {}).label || "—")}</td>
          <td>${esc(cut.subjectNote || "—")}</td>
          <td>${esc((MOVE_SPEEDS.find(s => s.id === cut.camera.moveSpeed) || {}).label || "標準")}</td>
          <td>${cut.camera.endShotSize !== "same" ? esc(cut.camera.shotSize + " → " + cut.camera.endShotSize) : "変化なし"}</td>
          <td>${esc((LOOKS.find(l => l.id === cut.look) || {}).label || "")}</td>
          <td>${cut.kind === "still" ? "—" : esc(cut.audio)}</td>
          <td>${esc((WEATHERS.find(w => w.id === cut.weather) || {}).label || "")}</td>
          <td>${esc((TIMES_OF_DAY.find(t => t.id === cut.timeOfDay) || {}).label || "")}</td>
        </tr></tbody>
      </table>

      ${opts.length ? `<h3>演出オプションと実施上の注意</h3>
      <ul>${opts.map(o => `<li><b>${esc(o.label)}</b> — ${esc(o.note)}</li>`).join("")}</ul>` : ""}

      ${(() => {
        const warns = evaluateFeasibility(cut);
        if (!warns.length) return "";
        return `<h3>フィージビリティ / 安全チェック</h3>
        <ul class="feas-doc">${warns.map(x =>
          `<li class="lv-${x.lv}">${x.lv === "danger" ? "⛔" : x.lv === "warn" ? "⚠️" : "💡"} ${esc(x.t)}</li>`).join("")}</ul>`;
      })()}

      ${(() => {
        const recs = recommendForCut(cut);
        if (!recs.length) return "";
        return `<h3>機材候補 (capability first, SKU second)</h3>
        <table><thead><tr><th>役割</th><th>必要な能力</th><th>代表機種 (例)</th><th>安全区分</th></tr></thead>
        <tbody>${recs.map(r => `<tr>
          <td>${esc(r.role)}</td><td>${esc(r.need)}</td>
          <td>${esc(r.examples.join(" / "))} など同等能力機</td>
          <td>${esc(r.safety)}</td></tr>`).join("")}</tbody></table>
        <p class="memo">※ CineOS機材マスター (131機種シード) より。ブランド固定ではなく「能力で選び、同等機で代替可」が原則。</p>`;
      })()}

      ${preset ? `<h3>技法メモ: ${esc(preset.name)}</h3><p class="memo">${esc(preset.desc)}${preset.notesExtra ? `<br><b>実施上の注意:</b> ${esc(preset.notesExtra)}` : ""}</p>` : ""}
      ${cut.notes ? `<h3>備考</h3><p class="memo">${esc(cut.notes)}</p>` : ""}
      ${i < state.cuts.length - 1 ? (() => {
        const t = TRANSITIONS.find(x => x.id === (cut.transition || "cut"));
        return t ? `<h3>次のカットへの繋ぎ</h3><p class="memo">▼ <b>${esc(t.label)}</b> — ${esc(t.note)}</p>` : "";
      })() : ""}

      <h3>Seedance プロンプト (英語)</h3>
      <pre class="prompt">${esc(generatePrompt(cut, "seedance"))}</pre>
      ${(() => {
        const sp = seedanceParams(cut);
        return `<table class="sd-params">
          <thead><tr><th>ratio</th><th>duration</th><th>resolution</th><th>camerafixed</th><th>参照画像 (first frame)</th></tr></thead>
          <tbody><tr>
            <td>${esc(sp.ratio)}</td><td>${esc(sp.duration)}</td><td>${esc(sp.resolution)}</td>
            <td>${esc(sp.camerafixed)}</td><td>${esc(sp.firstFrame)}</td>
          </tr></tbody>
        </table>`;
      })()}
      ${!["seedance", "generic"].includes(state.promptModel) ? `
      <h3>参考: ${esc((PROMPT_MODELS.find(m => m.id === state.promptModel) || {}).label || "")} 版プロンプト</h3>
      <pre class="prompt">${esc(generatePrompt(cut, state.promptModel))}</pre>` : ""}
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
    .power-plan { font-size: 12px; background: #f0f6ff; border: 1px solid #c8d8f0; border-radius: 6px; padding: 8px 10px; margin-top: 8px; }
    .sd-params { margin-top: 8px; }
    .sd-params th { background: #eaf3ec; }
    .feas-doc { list-style: none; padding-left: 0; }
    .feas-doc li { padding: 3px 0; font-size: 12px; }
    .feas-doc li.lv-danger { color: #c0392b; font-weight: 700; }
    @media print { .toolbar { display: none; } body { padding: 0; } }
  </style></head><body>
    <h1>撮影指示書 — ${esc(state.projectTitle)}</h1>
    <div class="meta">モード: ${esc(modeLabel)} ｜ カット数: ${state.cuts.length}
      ｜ 想定合計テイク: ${state.cuts.reduce((s, c) => s + (c.takes || 0), 0)}
      ｜ 合計準備時間: 約${Math.round(state.cuts.reduce((s, c) => s + (c.setupMin || 0), 0) / 60 * 10) / 10}時間
      ｜ 出力日: ${esc(today)} ｜ Generated by Virtual Studio</div>
    <div class="toolbar"><button onclick="window.print()">🖨 印刷 / PDFに保存</button></div>
    <table class="toc">
      <thead><tr><th>#</th><th>カット名</th><th>サイズ</th><th>ワーク</th><th>尺</th><th>テイク</th><th>準備</th><th>狙い</th></tr></thead>
      <tbody>${state.cuts.map((c, i) => `<tr>
        <td>C${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.camera.shotSize)}${c.camera.endShotSize && c.camera.endShotSize !== "same" ? "→" + esc(c.camera.endShotSize) : ""}</td>
        <td>${esc((CAM_MOVES.find(s => s.id === c.camera.move) || {}).label || "")}</td>
        <td>${c.kind === "still" ? "スチール" : c.duration + "s"}</td>
        <td>${c.takes ?? "-"}</td><td>${c.setupMin ?? "-"}分</td>
        <td>${esc(c.aim.slice(0, 40))}</td></tr>`).join("")}
      </tbody>
    </table>
    ${cutPages}
    ${(() => {
      const seq = buildSeedanceSequence();
      if (!seq) return "";
      const videoCuts = state.cuts.filter(c => c.kind !== "still");
      const total = videoCuts.reduce((s, c) => s + (c.duration || 5), 0);
      const ratio = seedanceRatio(videoCuts[0].aspect);
      return `
    <section class="cut-page">
      <h2>Seedance マルチショット・シーケンス <span class="dur">全${videoCuts.length}ショット ｜ 総尺 約${total}s ｜ ratio ${esc(ratio)}</span></h2>
      <p class="memo">1回の生成で複数ショットを繋げる場合のプロンプト。被写体・光・グレードの一貫性指示を先頭に置き、各ショットを [Shot n — 秒数] で区切り、ショット間のトランジションを [ ] で明示しています。</p>
      <pre class="prompt">${esc(seq)}</pre>
      <h3>Seedance 運用のヒント</h3>
      <ul>
        <li>1ショット = 1〜2アクションに絞る。動きを詰め込むほど破綻しやすい</li>
        <li>カメラ用語は英語 (dolly in / orbit / crane up 等) がもっとも安定して通る</li>
        <li>各カットの「想定カットイメージ」を参照画像 (first frame) に渡すと構図・ライティングが安定する</li>
        <li>人物・商品の一貫性は「同じ被写体記述を全ショットで繰り返す」ことで担保する</li>
        <li>フィックスは camerafixed=true を併用するとプロンプトより確実</li>
        <li>ratio・duration・resolution は生成時のパラメータ側でも必ず指定する (各カットの表を参照)</li>
        <li>ネガティブ指示: no subtitles, no watermark, no on-screen text は常に付ける</li>
        <li>長尺は「シーケンス一括」より「カット毎に生成→編集で繋ぐ」方が歩留まりが良い。その場合は各カットのプロンプトを使用</li>
      </ul>
    </section>`;
    })()}
  </body></html>`;
}

/* =========================================================
 * 絵コンテ (コマ割りレイアウト・1ページ6コマ) 書き出し
 * ======================================================= */
function buildStoryboardDoc() {
  const today = new Date().toLocaleDateString("ja-JP");
  const panels = state.cuts.map((cut, i) => {
    ensureCameraDefaults(cut);
    const size = SHOT_SIZES.find(s => s.id === cut.camera.shotSize) || {};
    const mov = CAM_MOVES.find(s => s.id === cut.camera.move) || {};
    const act = SUBJECT_ACTIONS.find(a => a.id === cut.action);
    const trans = i < state.cuts.length - 1 ? TRANSITIONS.find(t => t.id === (cut.transition || "cut")) : null;
    const endS = cut.camera.endShotSize !== "same" ? ` → ${cut.camera.endShotSize}` : "";
    return `
    <div class="panel">
      <div class="frame">${renderPreviewSVG(cut, "sb" + i)}</div>
      <div class="panel-meta">
        <div class="panel-no">C${i + 1}</div>
        <div class="panel-info">
          <div class="panel-name">${esc(cut.name)}</div>
          <div class="panel-tech">${esc(cut.camera.shotSize)}${endS} ｜ ${esc(mov.label || "")} ｜ ${cut.camera.focalMm}mm</div>
          <div class="panel-action">${esc(act ? act.label : "")}${cut.subjectNote ? " — " + esc(cut.subjectNote) : ""}</div>
          <div class="panel-aim">${esc((cut.aim || "").slice(0, 60))}</div>
        </div>
        <div class="panel-dur">${cut.kind === "still" ? "STILL" : cut.duration + "s"}</div>
      </div>
      ${trans ? `<div class="panel-trans">▼ ${esc(trans.label)}</div>` : `<div class="panel-trans end">— END —</div>`}
    </div>`;
  }).join("");

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <title>絵コンテ — ${esc(state.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #1a1d24; background: #fff; padding: 20px; }
    h1 { font-size: 20px; }
    .meta { color: #667; font-size: 11px; margin: 4px 0 14px; }
    .toolbar { margin-bottom: 16px; }
    .toolbar button { padding: 10px 22px; font-size: 14px; cursor: pointer; background: #1a1d24; color: #fff; border: 0; border-radius: 6px; }
    .board { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .panel { border: 1.5px solid #1a1d24; border-radius: 6px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column; }
    .frame { background: #000; display:flex; justify-content:center; }
    .frame svg { display: block; max-width: 100%; height: 150px; }
    .panel-meta { display: flex; gap: 8px; padding: 6px 8px; align-items: flex-start; flex: 1; }
    .panel-no { font-size: 16px; font-weight: 800; min-width: 34px; }
    .panel-info { flex: 1; min-width: 0; }
    .panel-name { font-size: 12px; font-weight: 700; }
    .panel-tech { font-size: 10px; color: #446; margin-top: 2px; font-family: ui-monospace, monospace; }
    .panel-action { font-size: 10px; color: #333; margin-top: 2px; }
    .panel-aim { font-size: 10px; color: #667; margin-top: 2px; }
    .panel-dur { font-size: 12px; font-weight: 700; color: #b06e06; }
    .panel-trans { font-size: 10px; text-align: center; background: #f0f2f5; padding: 3px; color: #445; border-top: 1px dashed #ccc; }
    .panel-trans.end { color: #999; }
    @media print {
      .toolbar { display: none; } body { padding: 0; }
      .board { grid-template-columns: 1fr 1fr; }
      .panel:nth-of-type(6n) { page-break-after: always; }
    }
  </style></head><body>
    <h1>絵コンテ — ${esc(state.projectTitle)}</h1>
    <div class="meta">カット数: ${state.cuts.length} ｜ 総尺(動画カット): 約${state.cuts.reduce((s, c) => s + (c.kind === "still" ? 0 : c.duration || 0), 0)}秒 ｜ 出力日: ${esc(today)} ｜ Generated by Virtual Studio</div>
    <div class="toolbar"><button onclick="window.print()">🖨 印刷 / PDFに保存 (A4縦・1ページ6コマ)</button></div>
    <div class="board">${panels}</div>
  </body></html>`;
}

/* 書き出しドキュメントはアプリ内オーバーレイで開く (「← スタジオに戻る」で戻れる) */
let docCurrent = { html: "", name: "document.html" };

function openDocWindow(html, fallbackName, title) {
  docCurrent = { html, name: fallbackName || "document.html" };
  byId("docFrame").srcdoc = html;
  byId("docOverlayTitle").textContent = title || fallbackName || "ドキュメント";
  byId("docOverlay").hidden = false;
}

function setupDocOverlay() {
  byId("btnDocBack").addEventListener("click", () => { byId("docOverlay").hidden = true; });
  byId("btnDocPrint").addEventListener("click", () => {
    try { byId("docFrame").contentWindow.print(); }
    catch { window.print(); }
  });
  byId("btnDocDownload").addEventListener("click", () => {
    saveFileAs(docCurrent.name, docCurrent.html);
  });
  // ドキュメント内 (iframe) からの保存依頼 (EDLの.edl等) を親で受けて保存する
  window.addEventListener("message", e => {
    if (e.data && e.data.vsSave && typeof e.data.vsSave.name === "string" && typeof e.data.vsSave.text === "string") {
      saveFileAs(e.data.vsSave.name, e.data.vsSave.text);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      byId("docOverlay").hidden = true;
      byId("equipOverlay").hidden = true;
      byId("projOverlay").hidden = true;
      byId("dnaOverlay").hidden = true;
      byId("wfOverlay").hidden = true;
    }
  });
}

/* =========================================================
 * 技法md インポータ (docs/knowledge/FORMAT.md 形式)
 * ======================================================= */
function parseYamlScalar(v) {
  v = v.trim().replace(/^["']|["']$/g, "");
  if (/^-?\d+(\.\d+)?$/.test(v)) return parseFloat(v);
  return v;
}

function parseKnowledgeMd(text) {
  const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fmMatch) throw new Error("フロントマター (--- で囲まれた部分) が見つかりません");
  const [, fm, body] = fmMatch;
  const data = {};
  let ctx = null;      // 現在のネスト先 (camera オブジェクト or equipment 配列)
  let ctxKey = null;
  let listItem = null; // equipment の現在の要素

  for (const raw of fm.split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();

    if (indent === 0) {
      listItem = null;
      const m = line.match(/^([\w]+):\s*(.*)$/);
      if (!m) continue;
      const [, key, val] = m;
      if (val === "") { // ネスト開始
        ctxKey = key;
        ctx = key === "equipment" ? [] : {};
        data[key] = ctx;
      } else if (val.startsWith("[")) {
        data[key] = val.replace(/^\[|\]$/g, "").split(",").map(s => parseYamlScalar(s)).filter(s => s !== "");
        ctx = null;
      } else {
        data[key] = parseYamlScalar(val);
        ctx = null;
      }
    } else if (ctx) {
      if (line.startsWith("- ")) { // 配列要素の開始
        listItem = {};
        if (Array.isArray(ctx)) ctx.push(listItem);
        const m = line.slice(2).match(/^([\w]+):\s*(.*)$/);
        if (m) listItem[m[1]] = parseYamlScalar(m[2]);
      } else {
        const m = line.match(/^([\w]+):\s*(.*)$/);
        if (!m) continue;
        const target = Array.isArray(ctx) ? listItem : ctx;
        if (target) target[m[1]] = parseYamlScalar(m[2]);
      }
    }
  }

  // 本文セクション抽出
  const section = (title) => {
    const m = body.match(new RegExp(`##\\s*${title}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`));
    return m ? m[1].trim().replace(/\n+/g, " ") : "";
  };

  if (!data.id || !data.name) throw new Error("id と name は必須です");
  return {
    id: "md-" + data.id,
    modes: Array.isArray(data.modes) && data.modes.length ? data.modes : ["video", "still", "outdoor"],
    group: "📥 " + (data.group || "インポート技法"),
    name: data.name,
    desc: section("概要") || data.name,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    subjectType: data.subject || "person",
    bgStyle: BG_STYLES[data.background] ? data.background : "dark",
    look: section("仕上がりの見え方"),
    notesExtra: section("実施上の注意"),
    camera: {
      shotSize: "BS", angle: "eye", move: "fix", lens: "50",
      aperture: "F2.8", shutter: "1/50", iso: "400", fps: "24fps", wb: "5600K",
      ...(data.camera || {}),
      lens: String((data.camera || {}).lens ?? "50"),
      iso: String((data.camera || {}).iso ?? "400"),
    },
    items: (Array.isArray(data.equipment) ? data.equipment : [])
      .filter(e => EQUIP_TYPES[e.type])
      .map(e => ({
        type: e.type,
        x: e.x ?? 300, y: e.y ?? 300,
        height: e.height ?? 150,
        power: e.power ?? (LIGHT_TYPES.includes(e.type) ? 50 : 0),
        colorTemp: e.colorTemp ?? 5600,
        modifier: e.modifier || "なし(直射)",
      })),
    defaultOptions: Array.isArray(data.options)
      ? data.options.map(String).filter(o => SHOT_OPTIONS.some(s => s.id === o)) : [],
  };
}

function importKnowledgeMdFiles(files) {
  let ok = 0; const errs = [];
  let pending = files.length;
  const finish = () => {
    if (--pending > 0) return;
    renderPresetList();
    alert(`技法mdインポート: ${ok}件成功` + (errs.length ? `\n失敗:\n` + errs.join("\n") : ""));
  };
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const preset = parseKnowledgeMd(reader.result);
        // 同IDは上書き
        state.customPresets = state.customPresets.filter(p => p.id !== preset.id);
        state.customPresets.push(preset);
        ok++;
      } catch (err) {
        errs.push(`${file.name}: ${err.message}`);
      }
      finish();
    };
    reader.onerror = () => { errs.push(`${file.name}: 読み込み失敗`); finish(); };
    reader.readAsText(file);
  }
}

function exportDoc() {
  openDocWindow(buildInstructionDoc(), "shooting-instructions.html", "撮影指示書");
}
function exportBoard() {
  openDocWindow(buildStoryboardDoc(), "storyboard.html", "絵コンテ (1ページ6コマ)");
}

/* ---------- SVG画像 / JSON 書き出し ---------- */
function downloadPlanSVG() {
  const cut = activeCut();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" style="background:#fbfcfd">${renderCanvasSVG(cut, false)}</svg>`;
  saveFileAs(`studio-plan-C${state.activeCut + 1}.svg`, svg);
}

/* =========================================================
 * DMX キューシート (照明卓向け・CineOS Phase 4 の一部を先行移植)
 * パッチは全カットの灯体を役割別にマージした固定パッチ (10ch刻み)。
 * 汎用8chモード想定: 1=Dimmer 2=CCT 3=G/M 4=Strobe 5-7=RGB 8=Fan
 * ======================================================= */
const GEL_RGB = {
  "カラージェル(マゼンタ)": [255, 0, 255],
  "カラージェル(シアン)": [0, 255, 255],
  "カラージェル(アンバー)": [255, 150, 0],
};

function buildDmxPatch() {
  // 役割(type)ごとに全カット中の最大灯数を数え、固定パッチを作る
  const maxCount = {};
  for (const cut of state.cuts) {
    const per = {};
    for (const it of cut.items) {
      if (LIGHT_TYPES.includes(it.type) && it.type !== "sun") per[it.type] = (per[it.type] || 0) + 1;
    }
    for (const k in per) maxCount[k] = Math.max(maxCount[k] || 0, per[k]);
  }
  const patch = [];
  let addr = 1;
  for (const type of Object.keys(maxCount)) {
    for (let i = 0; i < maxCount[type]; i++) {
      patch.push({ key: `${type}#${i + 1}`, label: `${EQUIP_TYPES[type].label} ${i + 1}`, type, idx: i, addr });
      addr += 10; // 10ch刻みで余裕を持たせる
    }
  }
  return patch;
}

function buildDmxCues(patch) {
  return state.cuts.map((cut, ci) => {
    const perType = {};
    const values = {};
    for (const it of cut.items) {
      if (!LIGHT_TYPES.includes(it.type) || it.type === "sun") continue;
      const idx = perType[it.type] = (perType[it.type] || 0) + 1;
      const key = `${it.type}#${idx}`;
      const gel = GEL_RGB[it.modifier] || null;
      values[key] = {
        dim: Math.round(it.power * 2.55),
        cct: Math.round(((it.colorTemp - 2500) / 7500) * 255),
        gel,
        note: it.modifier !== "なし(直射)" ? it.modifier : "",
      };
    }
    const prev = ci > 0 ? state.cuts[ci - 1].transition : null;
    const fade = ci === 0 ? 3.0 : prev === "dissolve" ? 2.0 : prev === "fadeout" ? 3.0 : prev === "cut" ? 0.0 : 1.0;
    return { cue: ci + 1, name: cut.name, fade, values };
  });
}

function buildDmxDoc() {
  const today = new Date().toLocaleDateString("ja-JP");
  const patch = buildDmxPatch();
  const cues = buildDmxCues(patch);
  if (!patch.length) return null;

  const patchRows = patch.map(p => `<tr>
    <td>${esc(p.label)}</td><td>1</td><td>${p.addr}</td><td>${p.addr}-${p.addr + 7}</td>
    <td>1:Dim ｜ 2:CCT ｜ 3:G/M ｜ 4:Strobe ｜ 5-7:RGB ｜ 8:Fan</td></tr>`).join("");

  const cueTables = cues.map(c => `
    <h3>Cue ${c.cue} — ${esc(c.name)} <span class="fade">Fade ${c.fade.toFixed(1)}s</span></h3>
    <table>
      <thead><tr><th>灯体</th><th>Addr</th><th>Dim (ch1)</th><th>CCT (ch2)</th><th>RGB (ch5-7)</th><th>備考</th></tr></thead>
      <tbody>${patch.map(p => {
        const v = c.values[p.key];
        if (!v) return `<tr class="off"><td>${esc(p.label)}</td><td>${p.addr}</td><td>0</td><td>—</td><td>—</td><td>消灯</td></tr>`;
        return `<tr><td>${esc(p.label)}</td><td>${p.addr}</td>
          <td><b>${v.dim}</b> (${Math.round(v.dim / 2.55)}%)</td>
          <td>${v.cct} (${Math.round(2500 + (v.cct / 255) * 7500)}K)</td>
          <td>${v.gel ? v.gel.join(" / ") : "—"}</td>
          <td>${esc(v.note)}</td></tr>`;
      }).join("")}</tbody>
    </table>`).join("");

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <title>DMXキューシート — ${esc(state.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #1a1d24; background: #fff; padding: 24px; }
    h1 { font-size: 20px; } .meta { color: #667; font-size: 11px; margin: 4px 0 12px; }
    .toolbar { margin-bottom: 16px; }
    .toolbar button { padding: 10px 22px; font-size: 14px; cursor: pointer; background: #1a1d24; color: #fff; border: 0; border-radius: 6px; }
    h2 { font-size: 15px; margin: 18px 0 8px; border-left: 4px solid #9a6ae0; padding-left: 8px; }
    h3 { font-size: 13px; margin: 14px 0 6px; }
    h3 .fade { font-size: 11px; color: #9a6ae0; font-weight: 600; margin-left: 8px; }
    table { border-collapse: collapse; width: 100%; font-size: 11.5px; margin-bottom: 4px; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-variant-numeric: tabular-nums; }
    th { background: #f2effa; font-size: 10.5px; }
    tr.off td { color: #aab; }
    ul { padding-left: 20px; font-size: 12px; line-height: 1.7; margin-top: 6px; }
    @media print { .toolbar { display: none; } body { padding: 0; } h3 { page-break-after: avoid; } }
  </style></head><body>
    <h1>DMXキューシート — ${esc(state.projectTitle)}</h1>
    <div class="meta">キュー数: ${cues.length} ｜ 灯体数 (パッチ): ${patch.length} ｜ 出力日: ${esc(today)} ｜ Generated by Virtual Studio</div>
    <div class="toolbar"><button onclick="window.print()">🖨 印刷 / PDFに保存</button></div>
    <h2>パッチ表 (Universe 1 / 10ch刻み / 汎用8chモード想定)</h2>
    <table>
      <thead><tr><th>灯体</th><th>Univ</th><th>開始Addr</th><th>使用ch</th><th>チャンネルマップ</th></tr></thead>
      <tbody>${patchRows}</tbody>
    </table>
    <h2>キューリスト (カット順)</h2>
    ${cueTables}
    <h2>運用メモ</h2>
    <ul>
      <li>チャンネルマップは汎用8chモードの想定。実機のモード表に合わせてch割りを読み替えること</li>
      <li>Fade はカット間トランジション設定から自動算出 (カット=0s / ディゾルブ=2s / フェード=3s / その他=1s)</li>
      <li>HMI・大電力灯はDMX調光でなくバラスト側制御の場合あり。パッチ表と機材リストを照合すること</li>
      <li>カラージェル指定の灯はRGB値で近似。実ジェル使用時はRGBを0にしてジェルを優先</li>
    </ul>
  </body></html>`;
}

function exportDmx() {
  const html = buildDmxDoc();
  if (!html) { alert("パッチ対象のライトがありません"); return; }
  openDocWindow(html, "dmx-cue-sheet.html", "DMXキューシート");
}

/* =========================================================
 * 香盤表 (撮影スケジュール) — 準備/撮影時間から予定時刻を積算
 * ======================================================= */
function buildScheduleDoc() {
  const today = new Date().toLocaleDateString("ja-JP");
  let clock = 9 * 60; // 9:00 開始
  let lunchDone = false;
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rows = state.cuts.map((cut, i) => {
    // 昼休憩 (12:00を跨いだ最初の区切りで60分)
    let lunch = "";
    if (!lunchDone && clock >= 12 * 60) { lunch = `<tr class="lunch"><td colspan="8">🍱 昼休憩 (${fmt(clock)}–${fmt(clock + 60)})</td></tr>`; clock += 60; lunchDone = true; }
    const setup = cut.setupMin || 30;
    const shootMin = Math.max(10, Math.ceil((cut.takes || 3) * Math.max(cut.kind === "still" ? 2 : (cut.duration || 5) / 60, 0.5) * 2 + 5));
    const start = clock;
    clock += setup + shootMin;
    const preset = allPresets().find(p => p.id === cut.presetId);
    const sfx = cut.items.filter(it => SFX_SAFETY_CLASS[it.type]).map(it => `${EQUIP_TYPES[it.type].label}(${SFX_SAFETY_CLASS[it.type]})`);
    const lights = cut.items.filter(it => LIGHT_TYPES.includes(it.type) && it.type !== "sun").length;
    return lunch + `<tr>
      <td>C${i + 1}</td>
      <td>${fmt(start)}–${fmt(clock)}</td>
      <td><b>${esc(cut.name)}</b><br><small>${esc((cut.aim || "").slice(0, 42))}</small></td>
      <td>${esc(preset ? preset.name : "-")}</td>
      <td>灯体${lights} ｜ ${esc((CAMERA_SUPPORTS.find(x => x.id === cut.camera.support) || {}).label || "")}${state.kit.body ? `<br><small>${esc(state.kit.body)}</small>` : ""}</td>
      <td>${setup}分</td>
      <td>${shootMin}分 (${cut.takes || 3}T)</td>
      <td>${sfx.length ? sfx.map(x => esc(x)).join("<br>") : "—"}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <title>香盤表 — ${esc(state.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #1a1d24; background: #fff; padding: 24px; }
    h1 { font-size: 20px; } .meta { color: #667; font-size: 11px; margin: 4px 0 12px; }
    .toolbar { margin-bottom: 16px; }
    .toolbar button { padding: 10px 22px; font-size: 14px; cursor: pointer; background: #1a1d24; color: #fff; border: 0; border-radius: 6px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; font-variant-numeric: tabular-nums; }
    th { background: #eef4ff; font-size: 11px; }
    tr.lunch td { background: #fff7e8; text-align: center; font-weight: 700; }
    small { color: #667; }
    ul { padding-left: 20px; font-size: 12px; line-height: 1.7; margin-top: 10px; }
    @media print { .toolbar { display: none; } body { padding: 0; } }
  </style></head><body>
    <h1>香盤表 — ${esc(state.projectTitle)}</h1>
    <div class="meta">9:00 開始想定 ｜ 終了見込み ${fmt(clock)} ｜ カット数 ${state.cuts.length} ｜ 出力日 ${esc(today)} ｜ Generated by Virtual Studio</div>
    <div class="toolbar"><button onclick="window.print()">🖨 印刷 / PDFに保存</button></div>
    <table>
      <thead><tr><th>#</th><th>予定時刻</th><th>カット / 狙い</th><th>技法</th><th>主要機材</th><th>段取り</th><th>撮影 (テイク)</th><th>特効 / 安全</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <ul>
      <li>撮影時間は「テイク数 × 尺 × 2 + 5分」の概算。特効・ハイスピードはリセット時間を上乗せして調整すること</li>
      <li>段取り時間は各カットの「準備時間(分)」設定から。並行仕込みができる場合は前倒し可</li>
      <li>Class B/C 特効のあるカットは安全ブリーフィングの時間を別途確保する</li>
    </ul>
  </body></html>`;
}

function exportSchedule() {
  openDocWindow(buildScheduleDoc(), "schedule.html", "香盤表 (撮影スケジュール)");
}

/* =========================================================
 * 編集リスト (V6 EditDecision → コンフォーム)
 * 採用テイク・素材イン点・J/Lカットを CSV表 + CMX3600風EDL で出力。
 * タイムコードはカットのfps設定 (既定24) の Non-Drop。
 * ======================================================= */
function buildEdlDoc() {
  const vcuts = state.cuts.filter(c => c.kind !== "still");
  const stills = state.cuts.length - vcuts.length;
  const fps = parseFps(vcuts[0] ? vcuts[0].camera.fps : "24fps") || 24;
  const tc = (sec) => {
    const f = Math.round(sec * fps);
    const h = Math.floor(f / (3600 * fps)), m = Math.floor(f / (60 * fps)) % 60,
      s = Math.floor(f / fps) % 60, fr = f % fps;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":") + ":" + String(fr).padStart(2, "0");
  };
  const DISSOLVES = { dissolve: 1.5, fadeout: 2, whiteout: 1 };

  let rec = 0;
  const events = vcuts.map((cut, i) => {
    const dur = cut.duration || 5;
    const prev = i > 0 ? vcuts[i - 1] : null;
    const transIn = prev ? prev.transition : null;       // このカットへの入り方 = 前カットの「次への繋ぎ」
    const dSec = DISSOLVES[transIn] || 0;
    const reel = `C${state.cuts.indexOf(cut) + 1}TK${cut.take || 1}`;
    const ev = {
      no: i + 1, cut, reel, dur,
      srcIn: cut.srcInSec || 0, srcOut: (cut.srcInSec || 0) + dur,
      recIn: rec, recOut: rec + dur,
      transIn, dFrames: dSec ? Math.round(dSec * fps) : 0,
      audioEdit: prev ? prev.audioEdit : "none",
      audioOv: prev ? prev.audioOverlapSec : 0,
    };
    rec += dur;
    return ev;
  });

  const edlLines = [`TITLE: ${state.projectTitle.toUpperCase()}`, "FCM: NON-DROP FRAME", ""];
  events.forEach(ev => {
    const n = String(ev.no).padStart(3, "0");
    const trans = ev.dFrames ? `D    ${String(ev.dFrames).padStart(3, "0")}` : "C        ";
    edlLines.push(`${n}  ${ev.reel.padEnd(8)} V     ${trans} ${tc(ev.srcIn)} ${tc(ev.srcOut)} ${tc(ev.recIn)} ${tc(ev.recOut)}`);
    edlLines.push(`* FROM CLIP NAME: C${state.cuts.indexOf(ev.cut) + 1} ${ev.cut.name}`);
    if (ev.transIn && ev.transIn !== "cut" && !ev.dFrames) {
      const t = TRANSITIONS.find(x => x.id === ev.transIn);
      edlLines.push(`* TRANSITION NOTE: ${t ? t.en.toUpperCase() : ev.transIn}`);
    }
    if (ev.audioEdit === "jcut") edlLines.push(`* AUDIO: J-CUT — このカットの音声を ${ev.audioOv}s 先行させる`);
    if (ev.audioEdit === "lcut") edlLines.push(`* AUDIO: L-CUT — 前カットの音声を ${ev.audioOv}s 持ち越す`);
    edlLines.push("");
  });
  const edl = edlLines.join("\n");

  const rows = events.map(ev => {
    const idx = state.cuts.indexOf(ev.cut);
    const t = ev.transIn ? TRANSITIONS.find(x => x.id === ev.transIn) : null;
    const ae = AUDIO_EDITS.find(x => x.id === ev.audioEdit);
    return `<tr>
      <td>${ev.no}</td>
      <td><b>C${idx + 1}　${esc(ev.cut.name)}</b></td>
      <td>TK${ev.cut.take || 1} / 全${ev.cut.takes || 3}</td>
      <td>${tc(ev.srcIn)}<br>${tc(ev.srcOut)}</td>
      <td>${tc(ev.recIn)}<br>${tc(ev.recOut)}</td>
      <td>${ev.dur}s</td>
      <td>${ev.no === 1 ? "—" : esc(t ? t.label : "カット")}${ev.dFrames ? `<br><small>${ev.dFrames}f</small>` : ""}</td>
      <td>${ev.no === 1 || !ae || ae.id === "none" ? "—" : `${esc(ae.label)}<br><small>${ev.audioOv}s</small>`}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
  <title>編集リスト (EDL) — ${esc(state.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; color: #1a1d24; background: #fff; padding: 24px; }
    h1 { font-size: 20px; } h2 { font-size: 14px; margin: 20px 0 8px; }
    .meta { color: #667; font-size: 11px; margin: 4px 0 12px; }
    .toolbar { margin-bottom: 16px; display: flex; gap: 8px; }
    .toolbar button, .toolbar a { padding: 10px 22px; font-size: 14px; cursor: pointer; background: #1a1d24; color: #fff; border: 0; border-radius: 6px; text-decoration: none; display: inline-block; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; font-variant-numeric: tabular-nums; }
    th { background: #eef4ff; font-size: 11px; }
    small { color: #667; }
    pre { background: #14161a; color: #d7e0ea; font: 11px/1.6 ui-monospace, "SF Mono", Menlo, monospace; padding: 14px 16px; border-radius: 8px; overflow-x: auto; margin-top: 8px; }
    ul { padding-left: 20px; font-size: 12px; line-height: 1.7; margin-top: 10px; }
    @media print { .toolbar { display: none; } body { padding: 0; } pre { background: #f2f4f7; color: #1a1d24; } }
  </style></head><body>
    <h1>編集リスト (EditDecision) — ${esc(state.projectTitle)}</h1>
    <div class="meta">${fps}fps Non-Drop ｜ ビデオカット ${vcuts.length}${stills ? ` (スチール${stills}は対象外)` : ""} ｜ 合計 ${tc(rec)} ｜ Generated by Virtual Studio</div>
    <div class="toolbar">
      <button onclick="window.print()">🖨 印刷 / PDFに保存</button>
      <button onclick="parent.postMessage({vsSave:{name:document.getElementById('edlName').value,text:document.getElementById('edlSrc').textContent}},'*')">⬇ .edl をダウンロード (CMX3600)</button>
      <input type="hidden" id="edlName" value="${esc(state.projectTitle)}.edl">
    </div>
    <table>
      <thead><tr><th>#</th><th>カット</th><th>採用テイク</th><th>素材 IN/OUT</th><th>レコード IN/OUT</th><th>尺</th><th>入りの繋ぎ</th><th>音の繋ぎ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>CMX3600 EDL</h2>
    <pre id="edlSrc">${esc(edl)}</pre>
    <ul>
      <li>素材INは各カットの「素材イン点(秒)」設定 (録画開始→アクション頭のプリロール)。テイクを変えたら撮影時のメモに合わせて更新すること</li>
      <li>ディゾルブ系は D + フレーム数で表現 (ディゾルブ1.5s / フェード2s / ホワイトアウト1s)。マッチカット等はコメント行で指示</li>
      <li>J/Lカットは音声トラックのトリム指示としてコメント行に出力。NLEに読み込んだ後、音声を指定秒ずらすこと</li>
    </ul>
  </body></html>`;
}

function exportEdl() {
  openDocWindow(buildEdlDoc(), "edit-decision-list.html", "編集リスト (EDL)");
}

