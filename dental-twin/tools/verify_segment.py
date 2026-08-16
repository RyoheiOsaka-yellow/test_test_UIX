#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify_segment.py — 歯牙セグメンテーション(ios_segment.py)の精度を数値検証する

合成スキャンは自前モデルから作るので**頂点ごとの正解歯番が分かる**。
これを使って、実データでは測れない精度を数値で押さえる:

  * 歯牙 / 歯肉の分離精度（正解率）
  * 検出した歯の本数
  * FDI 付与の正解率（各島の多数決ラベルと正解の一致）
  * extras が §4.5 の契約を満たすか（3軸の正規直交性・高さの順序）

合格条件:
  * 歯牙/歯肉の分離が 90% 以上
  * 16 歯すべてを検出し、FDI が 100% 一致
  * 全 extras で 3 軸が正規直交、apex_h < cej_h < crown_top_h
"""

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ios_import as IOS          # noqa: E402
import ios_segment as SEG         # noqa: E402
import verify_ios as VI           # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = os.path.join(ROOT, "dist", "_seg_scan.stl")


def build_labeled_scan(js, bins):
    """上顎の可視面スキャンを、頂点ごとの正解ラベル付きで作る"""
    Vs, Fs, lab, base = [], [], [], 0
    for node in js["nodes"]:
        nm = node.get("name", "")
        if "mesh" not in node:
            continue
        is_tooth = nm.startswith("tooth_") and nm[6] in "12"
        is_ging = nm in ("gingiva_upper", "palate_upper")
        if not (is_tooth or is_ging):
            continue
        fdi = int(nm[6:]) if is_tooth else 0
        for prim in js["meshes"][node["mesh"]]["primitives"]:
            V = VI.read_acc(js, bins, prim["attributes"]["POSITION"])
            F = VI.read_acc(js, bins, prim["indices"]).reshape(-1, 3)
            if is_tooth:
                # 実際の IOS は歯根を撮れない。歯肉に隠れる部分を落とす
                ex = node.get("extras") or {}
                V, F = VI.drop_below_gingiva(V, F, ex.get("cej_y", 1e9))
                if V is None:
                    continue
            Vs.append(V)
            Fs.append(F + base)
            lab.append(np.full(len(V), fdi, dtype=np.int32))
            base += len(V)
    V = np.vstack(Vs)
    F = np.vstack(Fs)
    L = np.concatenate(lab)

    # 走査で見える面のみ（実データに近づける）
    tri = V[F]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    n = n / np.where(ln == 0, 1, ln)
    keep = (n @ np.array([0.0, -1.0, 0.0])) > 0.15
    F2 = F[keep]
    used, inv = np.unique(F2.reshape(-1), return_inverse=True)
    return V[used], inv.reshape(-1, 3), L[used]


def main():
    ok = True
    print("── 歯牙セグメンテーションの検証 ────────────────")
    js, bins = VI.load_glb(VI.GLB)
    V, F, L = build_labeled_scan(js, bins)
    print("素材      : 頂点 %d / 三角形 %d / 正解歯番 %d 種"
          % (len(V), len(F), len(set(L[L > 0]))))

    # 正規化済みスキャンとして扱う（§6.3 を通した後を想定）
    teeth, ging, rep = SEG.segment(V, F, "upper")

    # ---- 歯牙 / 歯肉の分離精度
    is_tooth_pred = np.zeros(len(V), dtype=bool)
    # segment() は内部で分離するので、同じ関数で取り直して突き合わせる
    adj = SEG.adjacency(F, len(V))
    is_tooth_pred, ang, rad, cut, b = SEG.separate_teeth(V, F, 1.0)
    truth = L > 0
    acc = float((is_tooth_pred == truth).mean())
    tp = int((is_tooth_pred & truth).sum())
    fp = int((is_tooth_pred & ~truth).sum())
    fn = int((~is_tooth_pred & truth).sum())
    print("\n[歯牙/歯肉の分離]")
    print("  正解率 %.1f%%  (歯牙と正しく判定 %d / 歯肉を歯牙と誤り %d / 取りこぼし %d)"
          % (acc * 100, tp, fp, fn))
    if acc < 0.90:
        print("  ❌ 分離精度が不足しています")
        ok = False

    # ---- 検出本数と FDI 付与
    print("\n[個歯への分割と歯番付与]")
    print("  検出 %d 本 / 正解 16 本 (切り出し比率 %.2f)"
          % (rep["components"], rep["core_fraction"]))
    got = rep["fdi_assigned"]
    want = sorted([int(n[6:]) for n in
                   [nd.get("name", "") for nd in js["nodes"]]
                   if n.startswith("tooth_") and n[6] in "12"])
    print("  付与した歯番: %s" % got)
    if rep["components"] != 16:
        print("  ❌ 16 本に分割できていません")
        ok = False
    if got != want:
        print("  ❌ 歯番が正解と一致しません")
        print("     正解: %s" % want)
        ok = False

    # ---- 各歯の中身が正解と合っているか（多数決ラベル）
    bad = []
    for t in teeth:
        # 出力メッシュの頂点位置から元の頂点を引き当てて正解ラベルを見る
        key = {tuple(np.round(p, 4)): i for i, p in enumerate(V)}
        idx = [key.get(tuple(np.round(p, 4)), -1) for p in t["V"]]
        idx = [i for i in idx if i >= 0]
        if not idx:
            continue
        lb = L[idx]
        lb = lb[lb > 0]
        if len(lb) == 0:
            continue
        vals, cnt = np.unique(lb, return_counts=True)
        major = int(vals[int(np.argmax(cnt))])
        purity = float(cnt.max() / cnt.sum())
        if major != t["fdi"] or purity < 0.80:
            bad.append((t["fdi"], major, round(purity, 2)))
    print("  各歯の中身: 不一致 %d 件" % len(bad))
    for f, m, p in bad[:6]:
        print("     付与 %d ← 実際は %d が主 (純度 %.2f)" % (f, m, p))
    if bad:
        print("  ❌ 歯の中身が歯番と対応していません")
        ok = False

    # ---- extras が §4.5 の契約を満たすか
    print("\n[extras の契約確認]")
    worst_orth, worst_unit = 0.0, 0.0
    order_ng = []
    for t in teeth:
        ex = t["extras"]
        o = np.array(ex["axis_occlusal"]); bx = np.array(ex["axis_buccal"])
        m = np.array(ex["axis_mesial"])
        worst_orth = max(worst_orth, abs(float(o @ bx)), abs(float(o @ m)),
                         abs(float(bx @ m)))
        for a in (o, bx, m):
            worst_unit = max(worst_unit, abs(float(np.linalg.norm(a) - 1.0)))
        if not (ex["apex_h"] < ex["cej_h"] < ex["crown_top_h"]):
            order_ng.append(ex["fdi"])
    print("  3軸の直交性の最大ずれ : %.2e" % worst_orth)
    print("  3軸の長さの最大ずれ   : %.2e" % worst_unit)
    print("  高さの順序 (apex<cej<crown) 違反: %s" % (order_ng or "なし"))
    if worst_orth > 1e-6 or worst_unit > 1e-6 or order_ng:
        print("  ❌ extras が §4.5 の契約を満たしていません")
        ok = False

    # ---- 出力 GLB がビューアの命名規約に合うか
    out = os.path.join(ROOT, "dist", "_seg_test.glb")
    SEG.write_glb(out, teeth, ging, "U")
    js2, bins2 = VI.load_glb(out)
    names = [n.get("name", "") for n in js2["nodes"]]
    n_tooth = len([n for n in names if n.startswith("tooth_")])
    has_ging = "gingiva_upper" in names
    has_grp = "maxilla" in names
    print("\n[出力 GLB]")
    print("  tooth_* %d ノード / gingiva_upper %s / maxilla %s"
          % (n_tooth, has_ging, has_grp))
    if not (n_tooth == 16 and has_ging and has_grp):
        print("  ❌ ビューアの命名規約に合っていません")
        ok = False
    ex0 = [n for n in js2["nodes"] if n.get("name") == "tooth_11"][0].get("extras")
    if not ex0 or "axis_mesial" not in ex0:
        print("  ❌ extras が GLB に埋め込まれていません")
        ok = False
    else:
        print("  extras 例 (tooth_11): fdi=%s roots=%s root_source=%s segmentation=%s"
              % (ex0["fdi"], ex0["roots"], ex0.get("root_source"),
                 ex0.get("segmentation")))
    if rep["review_state"] != "PENDING_REVIEW" or rep["segmentation_state"] != "SUGGESTED":
        print("  ❌ 結果を自動承認しています（SUGGESTED/PENDING_REVIEW であるべき）")
        ok = False
    os.remove(out)

    print("\n" + ("✅ セグメンテーション 検証合格" if ok else "❌ セグメンテーション 検証不合格"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
