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

    # 開口方向: 下顎の前方が下がる = X軸回りの回転角が正（SPEC §5.4）
    rotx = pg.evaluate("() => window.__DT.mandible.rotation.x")
    print("開口 24° → mandible.rotation.x =", round(rotx, 3), "(正=下顎が下がる)")
    if not rotx > 0.2:
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
