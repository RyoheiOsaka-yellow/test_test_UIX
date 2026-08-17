#!/usr/bin/env python3
"""verify.py — CLAUDE.md §3 の検証儀式 Step 2 / Step 3

ヘッドレス描画（SwiftShader）→ ピクセル検証 → 受け入れ基準の数値検証。
コンソールに error / warning が1件でもあれば失敗扱い。
"""
import json
import os
import random
import sys

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGE = "file://" + os.path.join(ROOT, "dist", "foot_twin_v0.html")
SHOTS = os.path.join(ROOT, "shots")

LAYERS = ["L0_surface", "L1_contour", "L2_height", "L3_landmark", "L4_pressure",
          "L5_complaint", "L6_rx", "L7_drift", "L8_cohort", "L9_insole"]

fails = []
notes = []


def check(cond, msg):
    if cond:
        notes.append("  OK   " + msg)
    else:
        fails.append(msg)
        notes.append("  FAIL " + msg)
    return cond


def shot(pg, name):
    path = os.path.join(SHOTS, name + ".png")
    pg.screenshot(path=path)
    return np.array(Image.open(path).convert("RGB"))


def main():
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        # SwiftShader での真っ黒（WebGL コンテキスト生成失敗）を避ける起動フラグ3点セット
        launch = {"args": [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ]}
        # 環境に同梱の Chromium を使う（playwright のリビジョンと一致しない場合がある）
        for cand in ("/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                     "/opt/pw-browsers/chromium/chrome-linux/chrome"):
            if os.path.exists(cand):
                launch["executable_path"] = cand
                break
        b = p.chromium.launch(**launch)
        pg = b.new_page(viewport={"width": 1600, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        pg.on("console", lambda m: errs.append(m.type + ": " + m.text)
              if m.type in ("error", "warning") else None)

        pg.goto(PAGE)
        pg.wait_for_function("window.FOOT_TWIN !== undefined", timeout=15000)
        pg.wait_for_timeout(1200)

        # ---- 受け入れ基準1：3秒以内に描画完了 ----
        # ページ内で boot() 完了時に記録した時刻を読む。
        # ここで performance.now() を測るとテスト側の待ち時間まで混ざる。
        t = pg.evaluate("FOOT_TWIN.bootMs()")
        notes.append("  info 初回描画完了 %.0f ms（three.js のパース込み）" % t)
        check(t < 3000, "3秒以内に描画完了（実測 %.0f ms）" % t)

        # ---- Step 3: ピクセル検証 ----
        a = shot(pg, "default")
        uniq = len(np.unique(a.reshape(-1, 3), axis=0))
        check(uniq > 2000, "描画されている: uniq=%d" % uniq)
        check(30 < a.mean() < 245, "全面塗り潰しでない: mean=%.1f" % a.mean())

        vp = a[80:820, 0:1240]
        bg = np.array([244, 245, 242])
        ink = (np.abs(vp.astype(int) - bg).sum(axis=2) > 24).mean()
        check(0.05 < ink < 0.75, "足の描画面積: %.3f" % ink)

        # ---- レイヤトグルで描画が変わること ----
        # 足が画面いっぱいに写る底面ビューで比べる。立体化したので、
        # 真上からでは甲しか見えず足底のレイヤが一つも判定できない。
        # 引きの既定視点では足が画面の 17% しか占めず、細い線の増減が
        # 平均差分に埋もれるため、寄せて撮る。
        # subject は全レイヤに中身がある S004310（アーチが高く等高線が多い、
        # 主訴・処方の記録あり）を使う。
        pg.evaluate("FOOT_TWIN.setSubject('S004310')")
        pg.evaluate("FOOT_TWIN.setView('B'); FOOT_TWIN.zoom(400);")
        pg.wait_for_timeout(200)
        # 差分は 3D ビューポートの範囲だけで取る。右の固定パネル 340px を
        # 含めると、レイヤの増減が平均差分の中で薄まってしまう。
        base = shot(pg, "layer_base")[:, 0:1260]
        for ly in LAYERS:
            on = ly in ("L0_surface", "L1_contour", "L2_height")
            pg.evaluate("FOOT_TWIN.setLayer(%s, %s)" % (json.dumps(ly), json.dumps(not on)))
            pg.wait_for_timeout(260)
            after = shot(pg, "layer_" + ly)[:, 0:1260]
            d = np.abs(base.astype(int) - after.astype(int)).mean()
            check(d > 0.5, "%s のトグルで描画が変化: diff=%.3f" % (ly, d))
            pg.evaluate("FOOT_TWIN.setLayer(%s, %s)" % (json.dumps(ly), json.dumps(on)))
            pg.wait_for_timeout(120)

        # ---- 定型ビュー ----
        pg.evaluate("FOOT_TWIN.setSubject('S000142'); FOOT_TWIN.setView('R');")
        for v in ["T", "B", "M", "L", "R"]:
            pg.evaluate("FOOT_TWIN.setView(%s)" % json.dumps(v))
            pg.wait_for_timeout(220)
            im = shot(pg, "view_" + v)
            sub = im[80:820, 0:1240]
            frac = (np.abs(sub.astype(int) - bg).sum(axis=2) > 24).mean()
            check(0.02 < frac < 0.85, "ビュー %s に足が描かれている: %.3f" % (v, frac))

        # ---- 3D で回せること ----
        # ドラッグ・ホイール・自動回転を、実際のマウス入力とカメラの動きで確かめる。
        pg.evaluate("FOOT_TWIN.setMode('3d'); FOOT_TWIN.setView('R');")
        pg.wait_for_timeout(200)
        p0 = pg.evaluate("FOOT_TWIN.state().viewer.camera3d.position.toArray()")
        pg.mouse.move(600, 450)
        pg.mouse.down()
        for x in range(600, 830, 20):
            pg.mouse.move(x, 450 - (x - 600) // 6)
        pg.mouse.up()
        pg.wait_for_timeout(250)
        p1 = pg.evaluate("FOOT_TWIN.state().viewer.camera3d.position.toArray()")
        moved = sum((a - b2) ** 2 for a, b2 in zip(p0, p1)) ** 0.5
        check(moved > 20, "ドラッグで視点が回る（カメラが %.0f mm 移動）" % moved)
        shot(pg, "rotated")

        r0 = pg.evaluate("FOOT_TWIN.state().viewer.controls.radius")
        pg.mouse.move(600, 450)
        pg.mouse.wheel(0, -400)
        pg.wait_for_timeout(200)
        r1 = pg.evaluate("FOOT_TWIN.state().viewer.controls.radius")
        check(r1 < r0 * 0.92, "ホイールで拡大できる（%.0f → %.0f mm）" % (r0, r1))

        th0 = pg.evaluate("FOOT_TWIN.state().viewer.controls.theta")
        pg.evaluate("FOOT_TWIN.setAutoRotate(true)")
        pg.wait_for_timeout(900)
        th1 = pg.evaluate("FOOT_TWIN.state().viewer.controls.theta")
        pg.evaluate("FOOT_TWIN.setAutoRotate(false)")
        check(abs(th1 - th0) > 0.02,
              "自動回転で角度が進む（Δθ=%.3f rad）" % abs(th1 - th0))
        th2 = pg.evaluate("FOOT_TWIN.state().viewer.controls.theta")
        pg.wait_for_timeout(500)
        th3 = pg.evaluate("FOOT_TWIN.state().viewer.controls.theta")
        check(abs(th3 - th2) < 1e-9, "自動回転を止めると角度が固定される")
        pg.evaluate("FOOT_TWIN.setView('R')")

        # ---- 2D モード ----
        pg.evaluate("FOOT_TWIN.setMode('2d')")
        pg.wait_for_timeout(400)
        im = shot(pg, "mode_2d")[:, 0:1260]
        frac = (np.abs(im.astype(int) - bg).sum(axis=2) > 24).mean()
        check(0.02 < frac < 0.70, "2D に足底面が描かれている: %.3f" % frac)
        check(pg.evaluate("FOOT_TWIN.state().viewer.camera.isOrthographicCamera === true"),
              "2D は正射影カメラ（透視ではない）")
        # 2D では回転しない＝ドラッグしてもカメラの向きが変わらない
        d0 = pg.evaluate("FOOT_TWIN.state().viewer.camera2d.position.toArray()")
        pg.mouse.move(600, 450)
        pg.mouse.down()
        for x in range(600, 700, 20):
            pg.mouse.move(x, 450)
        pg.mouse.up()
        pg.wait_for_timeout(200)
        d1 = pg.evaluate("FOOT_TWIN.state().viewer.camera2d.position.toArray()")
        check(abs(d1[1] - d0[1]) < 1e-6 and abs(d1[0] - d0[0]) > 1e-3,
              "2D のドラッグは回転せず平行移動する")
        # 2D でもピッキングが効く
        pg.evaluate("FOOT_TWIN.setView('R')")
        pg.wait_for_timeout(200)
        hit = pg.evaluate("""(function(){
          var r = FOOT_TWIN.state().viewer.renderer.domElement.getBoundingClientRect();
          var h = FOOT_TWIN.state().viewer.pick(r.left + r.width/2, r.top + r.height/2);
          return h ? h.height : null;
        })()""")
        check(hit is not None, "2D でもピッキングが効く（高さ %s）" % hit)
        # 2D でのレイヤ切替
        pg.evaluate("FOOT_TWIN.setLayer('L9_insole', true)")
        pg.wait_for_timeout(350)
        im9 = shot(pg, "mode_2d_insole")[:, 0:1260]
        d = np.abs(im.astype(int) - im9.astype(int)).mean()
        check(d > 0.5, "2D で L9 のトグルが効く: diff=%.3f" % d)
        pg.evaluate("FOOT_TWIN.setLayer('L9_insole', false); FOOT_TWIN.setMode('3d');")
        pg.wait_for_timeout(350)
        im3 = shot(pg, "mode_3d_back")[:, 0:1260]
        d = np.abs(im.astype(int) - im3.astype(int)).mean()
        check(d > 0.5, "3D へ戻せる: diff=%.3f" % d)

        # ---- subject / 左右 / 経過週 ----
        pg.evaluate("FOOT_TWIN.setView('R')")
        for sid in ["S000142", "S001987", "S004310", "S005806"]:
            pg.evaluate("FOOT_TWIN.setSubject(%s)" % json.dumps(sid))
            pg.wait_for_timeout(200)
            shot(pg, "subject_" + sid)
        pg.evaluate("FOOT_TWIN.setSubject('S000142')")
        for sd in ["L", "R"]:
            pg.evaluate("FOOT_TWIN.setSide(%s)" % json.dumps(sd))
            pg.wait_for_timeout(220)
            shot(pg, "side_" + sd)

        prev = None
        pg.evaluate("FOOT_TWIN.setLayer('L9_insole', true)")
        for w in [0, 6, 26, 78, 156]:
            pg.evaluate("FOOT_TWIN.setWeek(%d)" % w)
            pg.wait_for_timeout(230)
            im = shot(pg, "week_%03d" % w)
            if prev is not None:
                d = np.abs(prev.astype(int) - im.astype(int)).mean()
                check(d > 0.2, "タイムライン %d週 で描画が変化: diff=%.3f" % (w, d))
            prev = im
        pg.evaluate("FOOT_TWIN.setLayer('L9_insole', false); FOOT_TWIN.setWeek(0);")

        # ---- 全レイヤ ON の合成表示 ----
        for ly in LAYERS:
            pg.evaluate("FOOT_TWIN.setLayer(%s, true)" % json.dumps(ly))
        pg.wait_for_timeout(500)
        allon = shot(pg, "all_layers")
        check(len(np.unique(allon.reshape(-1, 3), axis=0)) > 2000, "全レイヤ ON で描画される")

        # ---- L9 単独（インソールの絵） ----
        pg.evaluate("""
          ['L1_contour','L3_landmark','L4_pressure','L5_complaint','L6_rx','L7_drift','L8_cohort']
            .forEach(function(k){ FOOT_TWIN.setLayer(k,false); });
          FOOT_TWIN.setLayer('L9_insole', true);
        """)
        pg.evaluate("FOOT_TWIN.setView('T')")
        pg.wait_for_timeout(400)
        shot(pg, "insole_top")
        pg.evaluate("FOOT_TWIN.setView('M')")
        pg.wait_for_timeout(300)
        shot(pg, "insole_medial")
        pg.evaluate("FOOT_TWIN.setView('R')")
        pg.wait_for_timeout(300)
        shot(pg, "insole_persp")

        # ---- ランダム 30 通りのレイヤ組み合わせ ----
        random.seed(7)
        bad = 0
        for n in range(30):
            combo = {ly: bool(random.getrandbits(1)) for ly in LAYERS}
            pg.evaluate("""(function(c){
                var S = FOOT_TWIN.state();
                Object.keys(c).forEach(function(k){ S.layers[k] = c[k]; });
                FOOT_TWIN.setLayer('L0_surface', c['L0_surface']);
            })(%s)""" % json.dumps(combo))
            pg.wait_for_timeout(60)
            if errs:
                bad += 1
                break
        check(bad == 0, "ランダム30通りのレイヤ組み合わせで例外なし")

        # 既定へ戻す
        pg.evaluate("""
          ['L0_surface','L1_contour','L2_height'].forEach(function(k){FOOT_TWIN.setLayer(k,true);});
          ['L3_landmark','L4_pressure','L5_complaint','L6_rx','L7_drift','L8_cohort','L9_insole']
            .forEach(function(k){FOOT_TWIN.setLayer(k,false);});
        """)
        pg.wait_for_timeout(300)

        # ---- 受け入れ基準の数値検証（B-1〜B-11） ----
        res = pg.evaluate(open(os.path.join(ROOT, "tests.js"), encoding="utf-8").read())
        for r in res:
            check(r["ok"], "%s — %s" % (r["name"], r["detail"]))

        # ---- スクラブ中のフレーム予算 ----
        # SwiftShader はソフトウェア描画なので、ここで測る fps は実機の指標にならない
        # （rAF 自体が数百 ms 間隔まで落ちる）。実 GPU での 60fps は実機確認に回し、
        # ここでは我々が制御できる JS 側の再構築コストだけを見る。
        #
        # 2つの経路を分けて測る：
        #   full  … 等高線とインソールも毎フレーム作り直す最悪ケース
        #   thin  … 実装どおり 90ms に間引いた通常のスクラブ経路
        # rAF の間隔に依存させないよう、間引き判定はページ側で直接制御する。
        for heavy_layers in (False, True):
            if heavy_layers:
                pg.evaluate("['L1_contour','L3_landmark','L4_pressure','L5_complaint',"
                            "'L6_rx','L7_drift','L8_cohort','L9_insole']"
                            ".forEach(function(k){FOOT_TWIN.setLayer(k,true);});")
            r = pg.evaluate("""(function(){
              var S = FOOT_TWIN.state();
              function run(throttled){
                var t = [];
                for (var pass = 0; pass < 2; pass++) {      // 1周目は JIT の暖機
                  t = [];
                  for (var y = 0; y <= 156; y += 7) {
                    S.scrubbing = throttled;
                    if (!throttled) S.lastHeavyAt = 0;      // 常に完全再構築
                    FOOT_TWIN.setWeek(y);
                    t.push(FOOT_TWIN.rebuildMs());
                  }
                }
                S.scrubbing = false;
                t.sort(function(a,b){return a-b;});
                return { med: t[(t.length/2)|0], max: t[t.length-1] };
              }
              return { full: run(false), thin: run(true),
                       draw: FOOT_TWIN.renderMs() };
            })()""")
            tag = "全レイヤ ON" if heavy_layers else "既定レイヤ"
            check(r["thin"]["med"] < 16.6,
                  "スクラブ 1 フレームの JS が 60fps 予算内（%s：中央値 %.1fms / 最大 %.1fms）"
                  % (tag, r["thin"]["med"], r["thin"]["max"]))
            check(r["full"]["med"] < 33.3,
                  "間引きなしの完全再構築でも 2 フレーム以内（%s：中央値 %.1fms / 最大 %.1fms）"
                  % (tag, r["full"]["med"], r["full"]["max"]))
            notes.append("  info %s の描画投入 %.1fms（SwiftShader のソフトウェア描画込み）"
                         % (tag, r["draw"]))
        pg.evaluate("['L3_landmark','L4_pressure','L5_complaint','L6_rx','L7_drift',"
                    "'L8_cohort','L9_insole'].forEach(function(k){FOOT_TWIN.setLayer(k,false);});")

        # ---- 768px 幅：横スクロールが出ないこと ----
        pg.set_viewport_size({"width": 768, "height": 900})
        pg.wait_for_timeout(600)
        sw = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check(sw[0] <= sw[1] + 1, "768px で横スクロールなし: scrollW=%d clientW=%d" % (sw[0], sw[1]))
        shot(pg, "responsive_768")
        pg.set_viewport_size({"width": 420, "height": 900})
        pg.wait_for_timeout(600)
        sw2 = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        check(sw2[0] <= sw2[1] + 1, "420px で横スクロールなし: scrollW=%d clientW=%d" % (sw2[0], sw2[1]))
        shot(pg, "responsive_420")

        # ---- コンソール ----
        check(not errs, "コンソールに error / warning なし（%d 件）" % len(errs))
        if errs:
            for e in errs[:12]:
                notes.append("       " + e)

        b.close()

    print("\n".join(notes))
    print("\n%d checks, %d failed" % (len(notes) - sum(1 for n in notes if n.startswith("  info")), len(fails)))
    if fails:
        print("\nFAILED:")
        for f in fails:
            print("  - " + f)
        return 1
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
