#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify_viewer.py — Playwright(SwiftShader)でビューアを検証"""

import sys, subprocess, threading, http.server, socketserver, functools, os, time
from playwright.sync_api import sync_playwright

PORT = 8931
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

FLAGS = ["--use-gl=angle", "--use-angle=swiftshader",
         "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"]

# Playwright 同梱リビジョンと環境のブラウザが食い違う環境向け:
# 実行環境に固定インストールされた Chromium があればそちらを使う
CHROMIUM = os.environ.get("PW_CHROMIUM", "/opt/pw-browsers/chromium")
LAUNCH_KW = {"executable_path": CHROMIUM} if os.path.exists(CHROMIUM) else {}

logs, errs = [], []
ok = True

with sync_playwright() as pw:
    b = pw.chromium.launch(args=FLAGS, **LAUNCH_KW)
    pg = b.new_page(viewport={"width": 1280, "height": 820})
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text))
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{PORT}/dist/dental_twin_v1.html")
    pg.wait_for_timeout(16000)

    ready = pg.evaluate("() => !!(window.__DT && window.__DT.ready)")
    nteeth = pg.evaluate("() => window.__DT ? window.__DT.teeth.size : -1")
    ntris = pg.evaluate("() => document.getElementById('meta').textContent")
    print("ready =", ready, "| teeth =", nteeth, "|", ntris)
    if not ready or nteeth != 32:
        ok = False

    # 歯面判定テスト
    st = pg.evaluate("() => window.__surfaceTest()")
    rate = st["pass"] / st["total"] * 100 if st["total"] else 0
    print(f"歯面判定テスト: {st['pass']}/{st['total']}  ({rate:.1f}%)")
    if st["fails"]:
        for f in st["fails"][:10]:
            print("   FAIL", f)
        ok = False

    shots = []

    def shot(name):
        p = os.path.join(DOCS, name)
        pg.locator("#view").screenshot(path=p)
        shots.append(p)

    shot("shot_front.png")

    # クリックで歯を選択（16番あたり = 画面左寄り）
    pg.mouse.click(430, 430)
    pg.wait_for_timeout(4000)
    sel = pg.evaluate("() => window.__DT.selected")
    print("selected after click:", sel)
    shot("shot_pick.png")
    detail = pg.evaluate("() => document.getElementById('detail').innerText.slice(0,180)")
    print("detail:\n", detail.replace("\n", " / "))

    # リセット → 上顎咬合面
    pg.click("#reset"); pg.wait_for_timeout(3000)
    pg.click("[data-preset=occ_up]"); pg.wait_for_timeout(6000)
    shot("shot_occ_up.png")

    # 表示段階③（骨）
    pg.click("[data-preset=front]"); pg.wait_for_timeout(5000)
    pg.eval_on_selector("#stage", "el => { el.value = 2; el.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(2500)
    shot("shot_stage3.png")

    # ---- B-3: 2D歯式チャート入力 ----
    pg.eval_on_selector("#stage", "el => { el.value = 0; el.dispatchEvent(new Event('input')); }")
    ncell = pg.evaluate("() => document.querySelectorAll('#chart .tc').length")
    print("chart cells:", ncell)
    if ncell != 32:
        ok = False
    pg.click(".tc[data-fdi='16']")
    pg.wait_for_timeout(2500)
    pop_open = pg.evaluate("() => !document.getElementById('pop').classList.contains('hide')")
    sel = pg.evaluate("() => window.__DT.selected")
    print("cell tap: selected =", sel, "| popover =", pop_open)
    if sel != 16 or not pop_open:
        ok = False
    shot("shot_chart_pop.png")

    # 面所見の入力 → Undo（16-O: C2 → C3 → C2）
    pg.click("#pop button[data-pfind='C3']")
    pg.wait_for_timeout(600)
    f16 = pg.evaluate("() => (window.__DT.baseDoc.teeth.find(t=>t.fdi===16)"
                      ".surfaces.find(s=>s.surface==='O')||{}).finding")
    pg.click("#undoBtn")
    pg.wait_for_timeout(600)
    f16b = pg.evaluate("() => (window.__DT.baseDoc.teeth.find(t=>t.fdi===16)"
                       ".surfaces.find(s=>s.surface==='O')||{}).finding")
    print("チャート入力テスト: 16-O 入力後 =", f16, "/ Undo後 =", f16b)
    if f16 != "C3" or f16b != "C2":
        ok = False
    pg.click("#popClose")
    pg.click("#reset")
    pg.mouse.move(70, 320)   # ビュー内の空白へ（ツールチップを消す）
    pg.wait_for_timeout(2500)

    # ---- B-3: 治療後シミュレーション ----
    pg.click("#simBtn")
    pg.wait_for_timeout(1500)
    sim = pg.evaluate("() => window.__DT.simulated")
    st47 = pg.evaluate("() => window.__DT.byTooth.get(47).status")
    st36 = pg.evaluate("() => window.__DT.byTooth.get(36).status")
    v36 = pg.evaluate("() => window.__DT.teeth.get(36).mesh.visible")
    banner = pg.evaluate("() => !document.getElementById('simNote').classList.contains('hide')")
    print("sim:", sim, "| 47 →", st47, "| 36 →", st36, "(visible:", v36, ") | banner:", banner)
    if not (sim and st47 == "ROOT_CANAL_TREATED" and st36 == "BRIDGE_PONTIC"
            and v36 and banner):
        ok = False
    shot("shot_sim_after.png")
    pg.click("#simBtn")
    pg.wait_for_timeout(800)

    # ---- B-3: 歯周レイヤ（6点法マーカー） ----
    pg.click("[data-layer='perio']")
    pg.wait_for_timeout(1500)
    nmk = pg.evaluate("() => window.__DT.perioU.children.length"
                      " + window.__DT.perioL.children.length")
    print("perio markers:", nmk)
    if nmk < 150:
        ok = False
    shot("shot_perio.png")
    pg.click("[data-layer='perio']")
    pg.wait_for_timeout(600)

    # ---- B-3.3: 2D 表示モード（上下顎の咬合面俯瞰ツインビュー） ----
    pg.click("#dimBtn")
    pg.wait_for_timeout(1500)
    is2d = pg.evaluate("() => document.body.classList.contains('mode2d')")
    # ページ内の 2D カメラで歯の重心を投影し、正確な画面座標をタップする
    pt_u = pg.evaluate("""() => {
      const S = window.__DT, t = S.teeth.get(16);
      const p = t.centroid.clone().applyMatrix4(t.mesh.matrixWorld).project(S.cam2dU);
      const r = document.getElementById('view').getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width,
               y: r.top + (1 - (p.y + 1) / 2) * (r.height / 2) };
    }""")
    pg.mouse.click(pt_u["x"], pt_u["y"])
    pg.wait_for_timeout(700)
    sel_u = pg.evaluate("() => window.__DT.selected")
    pt_l = pg.evaluate("""() => {
      const S = window.__DT, t = S.teeth.get(46);
      const p = t.centroid.clone().applyMatrix4(t.mesh.matrixWorld).project(S.cam2dL);
      const r = document.getElementById('view').getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width,
               y: r.top + r.height / 2 + (1 - (p.y + 1) / 2) * (r.height / 2) };
    }""")
    pg.mouse.click(pt_l["x"], pt_l["y"])
    pg.wait_for_timeout(700)
    sel_l = pg.evaluate("() => window.__DT.selected")
    print("2D mode:", is2d, "| 上顎16タップ →", sel_u, "| 下顎46タップ →", sel_l)
    if not (is2d and sel_u == 16 and sel_l == 46):
        ok = False
    pg.click("#reset")
    pg.wait_for_timeout(700)
    shot2 = os.path.join(DOCS, "shot_2d.png")
    pg.screenshot(path=shot2); shots.append(shot2)
    pg.click("#dimBtn")
    pg.wait_for_timeout(800)

    # ---- B-3.4: ツールチップの消去・クランプ / 凡例のレイヤ連動 / タップ 60px ----
    box = pg.locator("#view").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.45)
    pg.wait_for_timeout(500)
    tip_on = pg.evaluate("() => !document.getElementById('tip').classList.contains('hide')")
    pg.mouse.move(box["x"] + box["width"] + 120, box["y"] + 200)   # ビュー外へ
    pg.wait_for_timeout(500)
    tip_off = pg.evaluate("() => document.getElementById('tip').classList.contains('hide')")
    print("tooltip: ビュー内で表示 =", tip_on, "/ ビュー外で消える =", tip_off)
    if not tip_off:
        ok = False
    # 右端でのはみ出し（クランプ）
    over = pg.evaluate("""() => {
      const S = window.__DT, t = S.teeth.get(11);
      const p = t.centroid.clone().applyMatrix4(t.mesh.matrixWorld).project(S.camera);
      const r = document.getElementById('view').getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - (p.y + 1) / 2) * r.height };
    }""")
    pg.mouse.move(over["x"], over["y"])
    pg.wait_for_timeout(400)
    clamp = pg.evaluate("""() => {
      const tip = document.getElementById('tip').getBoundingClientRect();
      const v = document.getElementById('view').getBoundingClientRect();
      return tip.right <= v.right + 1 && tip.bottom <= v.bottom + 1;
    }""")
    print("tooltip clamp (ビュー内に収まる):", clamp)
    if not clamp:
        ok = False

    # 凡例は perio レイヤ ON のときだけポケット色を出す
    lg_off = pg.evaluate(
        "() => document.querySelectorAll('.perioLg:not(.hide)').length")
    pg.click("[data-layer='perio']"); pg.wait_for_timeout(500)
    lg_on = pg.evaluate("() => document.querySelectorAll('.perioLg:not(.hide)').length")
    pg.click("[data-layer='perio']"); pg.wait_for_timeout(500)
    print("凡例の歯周項目: OFF時 =", lg_off, "/ ON時 =", lg_on)
    if not (lg_off == 0 and lg_on == 4):
        ok = False

    # タップ対象 60px（入力面: ポップオーバー / チャートセル / 右パネル）
    pg.click(".tc[data-fdi='16']"); pg.wait_for_timeout(1200)
    sizes = pg.evaluate("""() => {
      const min = sel => Math.min(...[...document.querySelectorAll(sel)]
        .map(e => e.getBoundingClientRect().height));
      return { pop: min('#pop .grp button'), cell: min('.tc'),
               panel: min('aside .row button'), header: min('header button') };
    }""")
    print("タップ高さ最小値:", sizes)
    if not (sizes["pop"] >= 59.5 and sizes["cell"] >= 59.5 and sizes["panel"] >= 59.5):
        ok = False
    # 入力ポップオーバーが凡例バー・チャートに被らない
    nolap = pg.evaluate("""() => {
      const p = document.getElementById('pop').getBoundingClientRect();
      return ['#legend', '#chart', 'footer'].every(s => {
        const r = document.querySelector(s).getBoundingClientRect();
        return p.bottom <= r.top + 1;
      });
    }""")
    print("ポップオーバーが凡例/チャート/フッタに被らない:", nolap)
    if not nolap:
        ok = False
    pg.click("#popClose"); pg.click("#reset"); pg.wait_for_timeout(800)

    # 患者モードの文字は 18px 以上（SPEC §5.6-8）
    pg.click("#modeBtn"); pg.wait_for_timeout(800)
    fonts = pg.evaluate("""() => {
      const px = sel => { const e = document.querySelector(sel);
        return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
      return { body: px('body'), legend: px('#legend span'), side: px('#sideL'),
               btn: px('aside .row button'), detail: px('#detail') };
    }""")
    print("患者モードの文字サイズ:", fonts)
    if min(v for v in fonts.values() if v) < 18:
        ok = False
    pg.click("#modeBtn"); pg.wait_for_timeout(800)

    # ---- B-4: 歯周6点法の入力グリッド ----
    pg.click("[data-ctab='perio']")
    pg.wait_for_timeout(1200)
    perio_shown = pg.evaluate(
        "() => document.querySelector('.tc[data-fdi=\"16\"] .pgrid').style.display !== 'none'")
    pg.click(".tc[data-fdi='16']")
    pg.wait_for_timeout(1500)
    pg.click("#pop button[data-psite='DB']")
    pg.wait_for_timeout(400)
    pg.click("#pop button[data-ppd='9']")
    pg.wait_for_timeout(600)
    pd_new = pg.evaluate(
        "() => window.__DT.baseDoc.teeth.find(t=>t.fdi===16).perio.DB.pd")
    pg.click("#pop button[data-pbop='1']")
    pg.wait_for_timeout(500)
    bop_new = pg.evaluate(
        "() => window.__DT.baseDoc.teeth.find(t=>t.fdi===16).perio.DB.bop")
    print("歯周入力: 16-DB pd =", pd_new, "/ bop =", bop_new, "| セル表示:", perio_shown)
    if not (perio_shown and pd_new == 9 and bop_new):
        ok = False
    shotp = os.path.join(DOCS, "shot_perio_input.png")
    pg.screenshot(path=shotp); shots.append(shotp)

    # ---- B-4: 骨吸収レベルの 3D 反映 ----
    pg.click("#pop button[data-pbone='10']")
    pg.wait_for_timeout(2000)
    bone = pg.evaluate("""() => {
      const m = window.__DT.bone.find(b => b.userData.__jaw === 'U');
      const base = m.userData.__base, pos = m.geometry.attributes.position.array;
      let maxd = 0;
      for (let i = 0; i < base.length; i += 3) maxd = Math.max(maxd, Math.abs(pos[i+1] - base[i+1]));
      return { maxDisp: +maxd.toFixed(2), level16: window.__DT.api.boneLevelOf(16) };
    }""")
    print("骨吸収: 16 の bone_level =", bone["level16"], "mm / 骨メッシュ最大変位 =",
          bone["maxDisp"], "mm")
    if not (bone["level16"] == 10 and bone["maxDisp"] > 3):
        ok = False
    pg.click("#undoBtn")   # 骨レベルを戻す
    pg.wait_for_timeout(800)
    pg.click("#popClose")
    pg.click("[data-ctab='caries']")
    pg.wait_for_timeout(800)

    # ---- B-4: 患者渡し物 PDF ----
    pg.click("#pdfBtn")
    pg.wait_for_timeout(6000)
    ho = pg.evaluate("""() => {
      const c = document.getElementById('hoCanvas');
      const px = c.getContext('2d').getImageData(0, 0, 1, 1).data;
      return { open: !document.getElementById('handout').classList.contains('hide'),
               w: c.width, h: c.height, white: px[0] === 255 };
    }""")
    pdf = pg.evaluate("""() => {
      const c = document.getElementById('hoCanvas'), S = window.__DT;
      const u = S.api.buildPDF(S.api.dataURLToU8(c.toDataURL('image/jpeg', 0.9)),
                               c.width, c.height);
      let head = '';
      for (let i = 0; i < 8; i++) head += String.fromCharCode(u[i]);
      let tail = '';
      for (let i = u.length - 6; i < u.length; i++) tail += String.fromCharCode(u[i]);
      return { head: head, tail: tail.trim(), bytes: u.length };
    }""")
    print("渡し物:", ho, "| PDF:", pdf)
    if not (ho["open"] and ho["w"] == 1240 and ho["h"] == 1754
            and pdf["head"] == "%PDF-1.4" and pdf["tail"] == "%%EOF"
            and pdf["bytes"] > 50000):
        ok = False
    shoth = os.path.join(DOCS, "shot_handout_modal.png")
    pg.screenshot(path=shoth); shots.append(shoth)
    pg.click("#hoClose")
    pg.wait_for_timeout(600)

    # ---- Phase 2: 経過比較（T0 / T1） ----
    prev = os.path.join(ROOT, "data", "findings_prev_sample.json")
    with open(prev, encoding="utf-8") as f:
        prev_doc = f.read()
    cmp_res = pg.evaluate("""(txt) => {
      const S = window.__DT;
      S.api.loadPrev(JSON.parse(txt));
      const c = S.cmp;
      const pick = k => c.rows.filter(r => r.kind === k).length;
      return { on: S.compare, sim: S.simulated,
               worse: c.worse, better: c.better,
               rowsWorse: pick('worse'), rowsBetter: pick('better'),
               t16: (c.teeth.get(16) || {}).state,
               t21: (c.teeth.get(21) || {}).state,
               t36: (c.teeth.get(36) || {}).state,
               banner: document.getElementById('cmpNote').textContent };
    }""", prev_doc)
    print("経過比較:", {k: cmp_res[k] for k in
                    ("on", "worse", "better", "t16", "t21", "t36")})
    print("  バナー:", cmp_res["banner"])
    lg = pg.evaluate("""() => ({
      cmp: document.querySelectorAll('.cmpLg:not(.hide)').length,
      caries: document.querySelectorAll('#legend span:not(.perioLg):not(.cmpLg):not(.hide)').length
    })""")
    print("  凡例の切替(比較用/う蝕用):", lg)
    if not (lg["cmp"] == 3 and lg["caries"] == 0):
        ok = False
    if not (cmp_res["on"] and cmp_res["worse"] > 0 and cmp_res["better"] > 0
            and cmp_res["t16"] == "worse" and cmp_res["t21"] == "better"
            and cmp_res["t36"] == "worse" and not cmp_res["sim"]):
        ok = False
    pg.wait_for_timeout(2500)
    shotcmp = os.path.join(DOCS, "shot_compare.png")
    pg.screenshot(path=shotcmp); shots.append(shotcmp)

    # 比較中にシミュレーションへ切り替えると比較は解除される（ACTUAL/SIM 排他）
    pg.click("#simBtn")
    pg.wait_for_timeout(1200)
    excl = pg.evaluate("() => ({cmp: window.__DT.compare, sim: window.__DT.simulated})")
    print("  ACTUAL/SIMULATION 排他:", excl)
    if excl["cmp"] or not excl["sim"]:
        ok = False
    pg.click("#simBtn")
    pg.wait_for_timeout(800)

    # ---- B-3.3: パネルの折りたたみ ----
    pg.click("#sideTgl")
    pg.wait_for_timeout(500)
    aside_hidden = pg.evaluate(
        "() => getComputedStyle(document.querySelector('aside')).display === 'none'")
    pg.click("#chartTgl")
    pg.wait_for_timeout(500)
    rows_hidden = pg.evaluate(
        "() => getComputedStyle(document.querySelector('#chart .crow')).display === 'none'")
    undo_alive = pg.evaluate(
        "() => getComputedStyle(document.getElementById('undoBtn')).display !== 'none'")
    print("collapse: aside hidden =", aside_hidden,
          "| chart rows hidden =", rows_hidden, "| undo visible =", undo_alive)
    if not (aside_hidden and rows_hidden and undo_alive):
        ok = False
    shotc = os.path.join(DOCS, "shot_collapsed.png")
    pg.screenshot(path=shotc); shots.append(shotc)
    pg.click("#sideTgl")
    pg.click("#chartTgl")
    pg.wait_for_timeout(500)

    # ---- B-3: 説明プリセット ----
    pg.click("[data-seq='caries']")
    pg.wait_for_timeout(3400)
    seq_sel = pg.evaluate("() => window.__DT.selected")
    seq_note = pg.evaluate("() => document.getElementById('seqNote').textContent")
    print("preset caries: selected =", seq_sel, "|", seq_note)
    if seq_sel != 47:
        ok = False
    pg.click("#reset")
    pg.wait_for_timeout(1500)

    # 開口 + 患者モード
    pg.eval_on_selector("#stage", "el => { el.value = 1; el.dispatchEvent(new Event('input')); }")
    pg.eval_on_selector("#open", "el => { el.value = 24; el.dispatchEvent(new Event('input')); }")
    pg.click("#modeBtn")
    pg.wait_for_timeout(4000)

    # 開口方向: 下顎は正（下がる）・上顎は負（上がる）の両開き（SPEC §5.4）
    rotx = pg.evaluate("() => window.__DT.mandible.rotation.x")
    rotu = pg.evaluate("() => window.__DT.maxilla.rotation.x")
    print("開口 24° → mandible.rotation.x =", round(rotx, 3),
          "/ maxilla.rotation.x =", round(rotu, 3))
    if not (rotx > 0.2 and rotu < -0.15):
        ok = False
    # 表示段階②: 歯肉の不透明度が目標値 0.25 まで滑らかに遷移している
    galpha = pg.evaluate("() => window.__DT.gingiva[0].material.opacity")
    print("歯肉 opacity(stage②) =", round(galpha, 3))
    if abs(galpha - 0.25) > 0.04:
        ok = False
    pg.screenshot(path=os.path.join(DOCS, "shot_patient.png"))
    shots.append(os.path.join(DOCS, "shot_patient.png"))
    mode = pg.evaluate("() => window.__DT.mode")
    print("mode:", mode)

    sideL = pg.inner_text("#sideL"); sideR = pg.inner_text("#sideR")
    print("side labels:", sideL, "|", sideR)

    b.close()

httpd.shutdown()

if errs:
    ok = False
    print("\n❌ PAGE ERRORS")
    for e in errs: print("  ", e)
warn = [l for l in logs if l.startswith("warning") or l.startswith("error")]
if warn:
    print("\n⚠ console:")
    for l in warn[:12]: print("  ", l)

# 縮小 JPEG 化
from PIL import Image
for p in shots:
    im = Image.open(p).convert("RGB")
    im.thumbnail((640, 640))
    im.save(p.replace(".png", ".jpg"), quality=78)
    os.remove(p)
print("\n" + ("✅ 検証合格" if ok else "❌ 検証不合格"))
sys.exit(0 if ok else 1)
