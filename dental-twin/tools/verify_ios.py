#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verify_ios.py — IOS 取り込み(ios_import.py)の正規化を数値検証する

実 IOS データがないので、**正解が分かっている合成スキャン**を作って検証する:

  dist/dental_template.glb の上顎（歯 + 歯肉）
    → 「Z-up・cm 単位・任意回転・任意平行移動」に崩す = 疑似 IOS スキャン
    → ios_import.normalize() に通す
    → 元の DENTAL_WORLD 姿勢に戻っているかを数値で確認

合格条件:
  * 単位を cm と判定し、弓幅が妥当レンジに入る
  * 咬合平面法線が ±Y と 3° 以内で一致
  * 前後方向 (+Z) が 5° 以内で一致
  * 正中面のズレが 1.5mm 以内
  * review_state が PENDING_REVIEW（自動承認しない）
"""

import json
import math
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ios_import as IOS   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "dist", "dental_template.glb")
TMP = os.path.join(ROOT, "dist", "_synthetic_scan.stl")

COMP = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


# --------------------------------------------------------------- GLB 読み込み
def load_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    assert data[:4] == b"glTF", "GLB ではありません"
    p, js, bins = 12, None, b""
    while p < len(data):
        ln, ty = struct.unpack("<II", data[p:p + 8])
        chunk = data[p + 8:p + 8 + ln]
        if ty == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ty == 0x004E4942:
            bins = chunk
        p += 8 + ln + (-ln % 4)
    return js, bins


def read_acc(js, bins, i):
    acc = js["accessors"][i]
    bv = js["bufferViews"][acc["bufferView"]]
    off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    n = acc["count"] * NCOMP[acc["type"]]
    fmt = "<" + COMP[acc["componentType"]] * n
    vals = struct.unpack_from(fmt, bins, off)
    return np.array(vals).reshape(acc["count"], NCOMP[acc["type"]])


def tooth_centroid(js, bins, name):
    """指定ノード（例 tooth_26）の重心を DENTAL_WORLD で返す"""
    for node in js["nodes"]:
        if node.get("name") != name or "mesh" not in node:
            continue
        for prim in js["meshes"][node["mesh"]]["primitives"]:
            V = read_acc(js, bins, prim["attributes"]["POSITION"])
            return V.mean(axis=0)
    raise KeyError(name)


def collect_upper(js, bins):
    """上顎の歯と歯肉だけを集めて 1 つのメッシュにする（IOS スキャン相当）"""
    Vs, Fs, base = [], [], 0
    for node in js["nodes"]:
        nm = node.get("name", "")
        if "mesh" not in node:
            continue
        keep = (nm.startswith("tooth_1") or nm.startswith("tooth_2")
                or nm == "gingiva_upper" or nm == "palate_upper")
        if not keep:
            continue
        for prim in js["meshes"][node["mesh"]]["primitives"]:
            V = read_acc(js, bins, prim["attributes"]["POSITION"])
            F = read_acc(js, bins, prim["indices"]).reshape(-1, 3)
            Vs.append(V)
            Fs.append(F + base)
            base += len(V)
    return np.vstack(Vs), np.vstack(Fs)


# ------------------------------------------------------------ 合成スキャン化
def rot(axis, deg):
    a = np.asarray(axis, dtype=float)
    a /= np.linalg.norm(a)
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) * c + s * K + (1 - c) * np.outer(a, a)


def cull_to_open_shell(V, F, view_dir):
    """実際の IOS スキャンに近づける: 走査方向から見える面だけを残して開いた殻にする。

    IOS の出力は閉じた立体ではなく、スキャナが捉えた表面だけの**開いた面**で、
    歯肉側の縁が切り口（境界）になる。閉じたメッシュのままだと取り込み側の
    向き判定を正しく検証できない。
    """
    tri = V[F]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    n = n / np.where(ln == 0, 1, ln)
    keep = (n @ np.asarray(view_dir, dtype=float)) > 0.15
    F2 = F[keep]
    used, inv = np.unique(F2.reshape(-1), return_inverse=True)
    return V[used], inv.reshape(-1, 3)


SCAN_T = np.array([137.4, -58.2, 903.1])   # 原点バラバラを再現する平行移動


def scan_matrix():
    # Y-up → Z-up（IOS の典型）
    zup = np.array([[1.0, 0, 0], [0, 0, -1.0], [0, 1.0, 0]])
    # スキャナ据え付けの傾き（決め打ち。乱数は使わない = 再現性のため）
    tilt = rot([1, 0, 0], 7.5) @ rot([0, 1, 0], -12.0) @ rot([0, 0, 1], 23.0)
    return tilt @ zup


def to_scan(P, M):
    """DENTAL_WORLD の点 → 生スキャン座標（Z-up・cm・傾き・原点ズレ）"""
    return (np.atleast_2d(P) @ M.T) / 10.0 + SCAN_T


def make_scan(V):
    """DENTAL_WORLD の上顎 → Z-up・cm・傾き・原点ズレ の「生スキャン」に崩す"""
    M = scan_matrix()
    return to_scan(V, M), M


# -------------------------------------------------------------------- 検証
def angle_deg(a, b):
    a = np.asarray(a, float) / np.linalg.norm(a)
    b = np.asarray(b, float) / np.linalg.norm(b)
    return math.degrees(math.acos(max(-1.0, min(1.0, abs(float(a @ b))))))


def main():
    ok = True
    print("── IOS 取り込みの検証 ──────────────────────────")
    if not os.path.exists(GLB):
        print("❌ %s がありません。先に dental_arch_gen.py を実行してください" % GLB)
        return 1

    js, bins = load_glb(GLB)
    V0, Fall = collect_upper(js, bins)
    # 上顎は下から走査する = 下向き(-Y)の面が写る
    V0, F = cull_to_open_shell(V0, Fall, [0, -1, 0])
    print("素材      : 上顎（走査で見える面のみ）頂点 %d / 三角形 %d" % (len(V0), len(F)))

    raw, M = make_scan(V0)
    IOS.write_stl(TMP, raw, F)
    print("合成スキャン: Z-up + cm + 傾き(7.5°,-12°,23°) + 原点ズレ → %s"
          % os.path.relpath(TMP, ROOT))

    # ---- STL を読み直して正規化（実運用と同じ経路を通す）
    Vin, Fin = IOS.read_stl(TMP)
    Vn, Fn, rep = IOS.normalize(Vin, Fin, arch="upper")

    print("\n[結果]")
    print("  単位判定      : %s (×%g) / 弓幅 %.1fmm"
          % (rep["unit_detected"], rep["scale_applied"], rep["arch_width_mm"]))
    print("  咬合平面 RMS  : %.3f mm" % rep["plane_rms_mm"])
    print("  正中面 対称性 : %.3f" % rep["symmetry_score"])
    print("  review_state  : %s" % rep["review_state"])

    if rep["unit_detected"] != "cm":
        print("  ❌ 単位を cm と判定できていません")
        ok = False
    if not (IOS.ARCH_WIDTH_MM[0] <= rep["arch_width_mm"] <= IOS.ARCH_WIDTH_MM[1]):
        print("  ❌ 弓幅が想定レンジ外です")
        ok = False
    if rep["review_state"] != "PENDING_REVIEW":
        print("  ❌ 正規化結果を自動承認しています（PENDING_REVIEW であるべき）")
        ok = False

    # ---- 復元した3軸を正解と直接比べる
    # （正規化後の点群を同じ関数で再フィットする検査は循環していて無意味）
    T0 = np.array(rep["transform"])
    R = T0[:3, :3] / rep["scale_applied"]
    truth = {"X(患者の左)": M @ np.array([1.0, 0, 0]),
             "Y(頭頂)": M @ np.array([0, 1.0, 0]),
             "Z(顔面前方)": M @ np.array([0, 0, 1.0])}
    worst = 0.0
    for i, (nm, tv) in enumerate(truth.items()):
        a = math.degrees(math.acos(max(-1.0, min(1.0, float(
            R[i] / np.linalg.norm(R[i]) @ (tv / np.linalg.norm(tv)))))))
        worst = max(worst, a)
        print("  軸 %-12s のズレ : %5.2f°" % (nm, a))
    if worst > 3.0:
        print("  ❌ 座標軸が復元できていません")
        ok = False

    # 前後方向: 元モデルの最前方点は +Z 側。正規化後も +Z 側にあるか
    # （原点は最前方点に置くので、ほぼ全ての点が z<=0 になるのが正しい）
    z_hi = float(np.percentile(Vn[:, 2], 99.5))
    z_lo = float(np.percentile(Vn[:, 2], 0.5))
    print("  前後の範囲    : z %.1f 〜 %.1f mm" % (z_lo, z_hi))
    if not (abs(z_hi) < 2.0 and z_lo < -25.0):
        print("  ❌ 前後方向（+Z=顔面前方）が想定と違います")
        ok = False

    # 正中: x の中央値が 0 付近
    x_med = float(np.median(Vn[:, 0]))
    print("  正中のズレ    : %.2f mm" % abs(x_med))
    if abs(x_med) > 1.5:
        print("  ❌ 正中面が合っていません")
        ok = False

    # 左右の広がりが妥当か（元モデルと同程度）
    w_ref = float(V0[:, 0].max() - V0[:, 0].min())
    w_new = float(Vn[:, 0].max() - Vn[:, 0].min())
    print("  左右幅        : 元 %.1fmm → 正規化後 %.1fmm" % (w_ref, w_new))
    if abs(w_ref - w_new) > 2.0:
        print("  ❌ スケールが復元できていません")
        ok = False

    # ---- 姿勢の総合検査: 歯番ランドマークの剛体残差
    # 正しく復元できていれば「元の DENTAL_WORLD 座標 + 一定の平行移動」に一致する。
    # 回転誤差・鏡像・上下反転をこれ一つで検出できる（幅の一致では検出できない）
    T = np.array(rep["transform"])
    names = ["tooth_16", "tooth_14", "tooth_13", "tooth_11",
             "tooth_21", "tooth_23", "tooth_24", "tooth_26"]
    A = np.array([tooth_centroid(js, bins, n) for n in names])
    B = np.array([T[:3, :3] @ to_scan(a, M)[0] + T[:3, 3] for a in A])
    offset = B.mean(axis=0) - A.mean(axis=0)
    resid = np.abs(B - A - offset)
    print("  ランドマーク残差 : 最大 %.2f mm（8歯・平行移動を除いた誤差）"
          % float(resid.max()))
    if resid.max() > 2.5:
        print("  ❌ 姿勢が復元できていません（回転・鏡像・上下のいずれかが誤り）")
        ok = False

    # 左右の取り違えは診療上の実害（CLAUDE.md 6.5-1）なので明示的にも検査する
    mirrored = False
    for name, expect in (("tooth_26", +1), ("tooth_16", -1),
                         ("tooth_23", +1), ("tooth_13", -1)):
        c0 = tooth_centroid(js, bins, name)
        cn = T[:3, :3] @ to_scan(c0, M)[0] + T[:3, 3]
        side = "+X(患者の左)" if cn[0] > 0 else "-X(患者の右)"
        good = (np.sign(cn[0]) == expect)
        print("  %s : x=%+7.2f %s %s" % (name, cn[0], side, "OK" if good else "NG"))
        if not good:
            mirrored = True
    if mirrored:
        print("  ❌ 左右が反転しています（鏡像）")
        ok = False

    # 変換行列が保存されているか（元データを書き換えず行列を残す原則）
    # ※ STL 読込で頂点はマージ・並べ替えされるので、比較には Vin を使う
    T = np.array(rep["transform"])
    if T.shape != (4, 4):
        print("  ❌ transform 行列が不正です")
        ok = False
    else:
        chk = (T[:3, :3] @ Vin.T).T + T[:3, 3]
        err = float(np.abs(chk - Vn).max())
        print("  transform 検算: 最大誤差 %.5f mm" % err)
        if err > 0.01:
            print("  ❌ レポートの transform で入力を再現できません")
            ok = False

    os.remove(TMP)
    print("\n" + ("✅ IOS 正規化 検証合格" if ok else "❌ IOS 正規化 検証不合格"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
