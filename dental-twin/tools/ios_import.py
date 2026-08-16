#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ios_import.py — 口腔内スキャナ(IOS)の STL を DENTAL_WORLD へ正規化する

  $ python3 tools/ios_import.py scan.stl --arch upper [--out dist/]
      → <name>_normalized.stl  +  <name>_report.json

SPEC §6.3.1 の実装。外部データは「Z-up かつ原点バラバラ」と想定し、
必ずこのパスを通す（CLAUDE.md §2）。

重要な原則:
  * 元データは書き換えない。変換行列をレポートに残す
  * 正規化結果を自動的に「正しい」と扱わない。review_state は PENDING_REVIEW
  * 上下顎は術者が --arch で指定するのが既定（スキャナ出力で分かっているため）
"""

import argparse
import json
import math
import os
import struct
import sys

import numpy as np

# DENTAL_WORLD: mm / 右手系 / Y-up / +X=患者の左 / +Y=頭頂 / +Z=顔面前方（SPEC §4.1）
ARCH_WIDTH_MM = (45.0, 80.0)      # 永久歯列の頬側最大幅の妥当レンジ
UNIT_CANDIDATES = [               # (名前, mm への倍率)
    ("mm", 1.0),
    ("cm", 10.0),
    ("m", 1000.0),
    ("inch", 25.4),
]


# ---------------------------------------------------------------- STL 入出力
def read_stl(path):
    """binary / ascii を自動判別して (V[n,3], F[m,3]) を返す"""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        head = f.read(84)
        if len(head) < 84:
            raise ValueError("STL が短すぎます")
        n_tri = struct.unpack("<I", head[80:84])[0]
        # binary STL のサイズは 84 + 50*n
        if size == 84 + 50 * n_tri and not head[:5].lower().startswith(b"solid "):
            return _read_binary(f, n_tri)
        if size == 84 + 50 * n_tri:
            return _read_binary(f, n_tri)
    return _read_ascii(path)


def _read_binary(f, n_tri):
    f.seek(84)
    raw = np.frombuffer(f.read(50 * n_tri), dtype=np.uint8)
    if raw.size != 50 * n_tri:
        raise ValueError("binary STL の三角形データが不足しています")
    raw = raw.reshape(n_tri, 50)
    tri = raw[:, 12:48].copy().view(np.float32).reshape(n_tri, 3, 3)
    return _weld(tri.astype(np.float64))


def _read_ascii(path):
    pts = []
    with open(path, "r", errors="ignore") as f:
        for line in f:
            s = line.strip()
            if s.startswith("vertex"):
                p = s.split()
                pts.append((float(p[1]), float(p[2]), float(p[3])))
    if not pts or len(pts) % 3:
        raise ValueError("ascii STL の頂点数が 3 の倍数ではありません")
    tri = np.asarray(pts, dtype=np.float64).reshape(-1, 3, 3)
    return _weld(tri)


def _weld(tri):
    """三角形スープ → 共有頂点。Draco/STL は頂点が重複するので必ず通す"""
    flat = tri.reshape(-1, 3)
    key = np.round(flat, 5)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    V = flat[idx]
    F = inv.reshape(-1, 3)
    return V, F


def write_stl(path, V, F):
    n = len(F)
    tri = V[F]                                    # (n,3,3)
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    nor = np.cross(e1, e2)
    ln = np.linalg.norm(nor, axis=1, keepdims=True)
    nor = np.divide(nor, np.where(ln == 0, 1, ln))
    buf = bytearray(b"\0" * 80 + struct.pack("<I", n))
    body = np.zeros((n, 12), dtype=np.float32)
    body[:, 0:3] = nor
    body[:, 3:12] = tri.reshape(n, 9)
    rec = bytearray()
    for i in range(n):
        rec += body[i].tobytes() + b"\0\0"
    buf += rec
    with open(path, "wb") as f:
        f.write(bytes(buf))


# ------------------------------------------------------------- メッシュ検証
def validate_mesh(V, F):
    """研究資料 §16 の確認項目。壊れていても止めず warnings に積む"""
    warn = []
    e1 = V[F[:, 1]] - V[F[:, 0]]
    e2 = V[F[:, 2]] - V[F[:, 0]]
    area = 0.5 * np.linalg.norm(np.cross(e1, e2), axis=1)
    degenerate = int((area < 1e-9).sum())

    # 境界エッジ（穴）と非多様体エッジ
    ed = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    ed = np.sort(ed, axis=1)
    _, cnt = np.unique(ed, axis=0, return_counts=True)
    boundary = int((cnt == 1).sum())
    nonmanifold = int((cnt > 2).sum())

    bbox = np.vstack([V.min(axis=0), V.max(axis=0)])
    stats = {
        "vertices": int(len(V)),
        "triangles": int(len(F)),
        "bbox_min": [round(float(x), 3) for x in bbox[0]],
        "bbox_max": [round(float(x), 3) for x in bbox[1]],
        "bbox_size": [round(float(x), 3) for x in (bbox[1] - bbox[0])],
        "degenerate_triangles": degenerate,
        "boundary_edges": boundary,
        "non_manifold_edges": nonmanifold,
        "closed": boundary == 0 and nonmanifold == 0,
    }
    if degenerate:
        warn.append("DEGENERATE_TRIANGLES: 退化三角形 %d 個" % degenerate)
    if nonmanifold:
        warn.append("NON_MANIFOLD: 非多様体エッジ %d 本" % nonmanifold)
    if boundary:
        # IOS スキャンは開いた面なので通常。異常ではない
        stats["note"] = "境界エッジあり（IOSスキャンは開いた面が正常）"
    if len(F) < 1000:
        warn.append("LOW_POLY: 三角形が %d 個しかありません" % len(F))
    return stats, warn


# --------------------------------------------------------------- 単位の判定
def detect_unit(V, occ_normal):
    """咬合平面内での最大幅が歯列弓として妥当になる倍率を選ぶ"""
    P = project_plane(V, occ_normal)
    extent = float(np.percentile(P[:, 0], 99) - np.percentile(P[:, 0], 1))
    ext2 = float(np.percentile(P[:, 1], 99) - np.percentile(P[:, 1], 1))
    width = max(extent, ext2)

    best, best_pen = None, None
    lo, hi = ARCH_WIDTH_MM
    for name, s in UNIT_CANDIDATES:
        w = width * s
        if w < lo:
            pen = lo - w
        elif w > hi:
            pen = w - hi
        else:
            pen = 0.0
        if best_pen is None or pen < best_pen:
            best, best_pen = (name, s), pen
    ok = best_pen == 0.0
    return best[0], best[1], round(width * best[1], 2), ok


# --------------------------------------------------- 咬合平面と面内の座標系
def fit_occlusal_plane(V, F):
    """面積重みつき PCA。最小分散軸を咬合平面の法線とする"""
    tri = V[F]
    c = tri.mean(axis=1)
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    w = 0.5 * np.linalg.norm(np.cross(e1, e2), axis=1)
    w = np.where(w < 1e-12, 0.0, w)
    if w.sum() <= 0:
        c, w = V, np.ones(len(V))

    mean = (c * w[:, None]).sum(axis=0) / w.sum()
    d = c - mean
    cov = (d * w[:, None]).T @ d / w.sum()
    val, vec = np.linalg.eigh(cov)
    normal = vec[:, 0] / np.linalg.norm(vec[:, 0])       # 最小固有値 = 平面法線
    rms = float(np.sqrt(max(val[0], 0.0)))
    return normal, mean, rms


def refine_occlusal_plane(V, normal, crown_sign, nsect=48):
    """咬合平面を臨床定義どおり「咬頭頂・切縁を通る平面」で取り直す。

    開いた殻（IOS スキャン）の PCA 最小軸は歯肉側の曲面に引っ張られて数度ずれる。
    歯列弓を角度セクタに分け、各セクタで最も歯冠側の点（= 咬頭頂）を拾って
    その点群に平面を当てると、傾きが大きく改善する。
    """
    u, v = plane_basis(normal)
    o = V.mean(axis=0)
    d = V - o
    P = np.stack([d @ u, d @ v], axis=1)
    h = (d @ normal) * crown_sign            # 大きいほど歯冠側

    r = np.hypot(P[:, 0], P[:, 1])
    keep = np.where(r > np.percentile(r, 35))[0]   # 口蓋の中央部を除く
    if len(keep) < nsect * 3:
        return normal
    ang = np.arctan2(P[keep, 1], P[keep, 0])
    b = (((ang + math.pi) / (2 * math.pi)) * nsect).astype(np.int32) % nsect

    tips = []
    for k in range(nsect):
        m = keep[b == k]
        if len(m) < 3:
            continue
        tips.append(V[m[int(np.argmax(h[m]))]])
    if len(tips) < 10:
        return normal

    T = np.asarray(tips)
    c = T.mean(axis=0)
    dd = T - c
    val, vec = np.linalg.eigh(dd.T @ dd / len(dd))
    n2 = vec[:, 0] / np.linalg.norm(vec[:, 0])
    if float(n2 @ normal) < 0:
        n2 = -n2
    return n2


def plane_basis(normal):
    """法線から面内の正規直交基底 (u, v) を作る"""
    a = np.array([0.0, 0.0, 1.0])
    if abs(float(normal @ a)) > 0.9:
        a = np.array([1.0, 0.0, 0.0])
    u = np.cross(a, normal)
    u /= np.linalg.norm(u)
    v = np.cross(normal, u)
    return u, v


def project_plane(V, normal, origin=None):
    u, v = plane_basis(normal)
    o = V.mean(axis=0) if origin is None else origin
    d = V - o
    return np.stack([d @ u, d @ v], axis=1)


# ------------------------------------------------------------- 正中面の推定
def symmetry_score(Q, nbins=96):
    """鏡像面を x=0 に固定した占有グリッドで、x → −x との一致率(IoU)を測る。

    グリッドを x=0 対称に張るので `grid[::-1]` が厳密な鏡像になる。
    （bbox 基準で張ると鏡像軸がデータの偏りでずれ、スコアが当てにならない）
    """
    half = float(np.percentile(np.abs(Q[:, 0]), 99)) or 1e-6
    vlo = float(np.percentile(Q[:, 1], 1))
    vhi = float(np.percentile(Q[:, 1], 99))
    vspan = max(vhi - vlo, 1e-6)

    inb = (np.abs(Q[:, 0]) <= half) & (Q[:, 1] >= vlo) & (Q[:, 1] <= vhi)
    if inb.sum() < 50:
        return 0.0
    R = Q[inb]
    i = ((R[:, 0] + half) / (2 * half) * (nbins - 1)).astype(np.int32)
    j = ((R[:, 1] - vlo) / vspan * (nbins - 1)).astype(np.int32)
    grid = np.zeros((nbins, nbins), dtype=bool)
    grid[np.clip(i, 0, nbins - 1), np.clip(j, 0, nbins - 1)] = True
    mir = grid[::-1, :]
    both = np.logical_and(grid, mir).sum()
    any_ = np.logical_or(grid, mir).sum()
    return float(both) / float(any_) if any_ else 0.0


def _rot2(P, theta):
    c, s = math.cos(theta), math.sin(theta)
    return P @ np.array([[c, s], [-s, c]])


def _centered(Q):
    """鏡像軸をデータの左右中心（2–98 パーセンタイルの中点）に合わせる"""
    mid = 0.5 * (np.percentile(Q[:, 0], 2) + np.percentile(Q[:, 0], 98))
    return Q - np.array([mid, 0.0]), float(mid)


def estimate_midsagittal(P):
    """面内 PCA を初期値に、左右対称性が最大になる回転 θ を求める。

    歯列弓は左右幅(≈65mm) > 前後長(≈50mm) なので、面内の第1主軸が
    ほぼ左右方向になる。総当りだけだと U 字の偽の対称軸に引っかかるため、
    PCA で当たりを付けてから ±25° を精密探索する。
    """
    d = P - P.mean(axis=0)
    cov = d.T @ d / max(len(d), 1)
    val, vec = np.linalg.eigh(cov)
    major = vec[:, int(np.argmax(val))]           # 左右方向の推定
    # 主軸の方位が +φ のとき、それを x 軸に載せるには点群を −φ 回す。
    # 符号を誤ると弓が面内で回ったまま正規化される（正解姿勢では φ=0 で露見しない）
    theta0 = -math.atan2(major[1], major[0])

    def score_at(theta):
        Q, _ = _centered(_rot2(P, theta))
        return symmetry_score(Q)

    # 対称性スコアはスパースな殻の上では平坦でノイズが乗る。PCA を主とし、
    # 対称性は「明確に改善するときだけ」±6° の範囲で微修正に使う
    s0 = score_at(theta0)
    best_t, best_s = theta0, s0
    for k in range(-24, 25):                      # ±6°, 0.25° 刻み
        t = theta0 + math.radians(0.25 * k)
        sc = score_at(t)
        if sc > best_s + 0.02:                    # ノイズ追従を避ける閾値
            best_t, best_s = t, sc
    _, mid = _centered(_rot2(P, best_t))
    return best_t, best_s, mid


def anterior_sign(Q):
    """歯列弓が閉じている側が前方。左右方向の広がりが小さい側を選ぶ"""
    v = Q[:, 1]
    mid = np.median(v)
    top = Q[v >= mid]
    bot = Q[v < mid]
    if len(top) < 10 or len(bot) < 10:
        return 1.0
    spread_top = np.percentile(top[:, 0], 95) - np.percentile(top[:, 0], 5)
    spread_bot = np.percentile(bot[:, 0], 95) - np.percentile(bot[:, 0], 5)
    # 広がりが小さい側 = 前歯部。そちらを +v にしたいので符号を返す
    return 1.0 if spread_top < spread_bot else -1.0


def boundary_vertices(F):
    """境界エッジ（1 つの面にしか属さないエッジ）の頂点インデックス"""
    ed = np.sort(np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    uq, cnt = np.unique(ed, axis=0, return_counts=True)
    return np.unique(uq[cnt == 1].reshape(-1)), int((cnt == 1).sum()), len(uq)


def crown_side(V, F, normal, u, v, nbins=64):
    """咬合面（歯冠）がどちら側かを返す（法線方向に対する符号）と、その確度。

    主判定 — **境界（スキャンの切り口）は歯肉側にある。**
      IOS の出力は閉じた立体ではなく開いた面で、縁は歯肉側の歯頸部付近で切れる。
      よって「境界頂点の平均高さ」と反対側が歯冠。実データで最も安定する。

    予備判定 — 閉じたメッシュ（購入モデル等）で境界が無いときは面内の占有で見る。
      歯冠側は歯列の帯だけなので占有が小さく、歯肉・口蓋側は広く埋まる。

    ⚠ この判定を誤ると 3D の左右が反転する（CLAUDE.md 6.5-1: 診療上の実害）。
      確度を必ず返し、低い場合は術者確認に回す（研究資料 §34）。
    """
    o = V.mean(axis=0)
    d = V - o
    h = d @ normal
    hspan = float(np.percentile(h, 98) - np.percentile(h, 2)) or 1.0

    bidx, n_bnd, n_edge = boundary_vertices(F)
    if n_edge and n_bnd / n_edge > 0.005 and len(bidx) >= 20:
        hb = float(np.mean(h[bidx]))
        # 境界（歯肉側）と反対が歯冠
        sign = -1.0 if hb > float(np.mean(h)) else 1.0
        conf = min(1.0, abs(hb - float(np.mean(h))) / (hspan * 0.25))
        return sign, conf, "boundary"

    P = np.stack([d @ u, d @ v], axis=1)
    lo, hi = np.percentile(h, 2), np.percentile(h, 98)
    q1, q3 = lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75
    pmin, pmax = P.min(axis=0), P.max(axis=0)
    span = np.maximum(pmax - pmin, 1e-6)

    def occupancy(mask):
        if mask.sum() < 50:
            return 1.0
        ij = ((P[mask] - pmin) / span * (nbins - 1)).astype(np.int32)
        g = np.zeros((nbins, nbins), dtype=bool)
        g[ij[:, 0], ij[:, 1]] = True
        return float(g.sum()) / float(nbins * nbins)

    occ_lo = occupancy(h <= q1)
    occ_hi = occupancy(h >= q3)
    sign = -1.0 if occ_lo < occ_hi else 1.0
    conf = abs(occ_hi - occ_lo) / (max(occ_lo, occ_hi) or 1.0)
    return sign, float(conf), "occupancy"


def guess_arch(V, F, normal, u, v):
    """上下顎の推定。確度は高くないので必ず arch_guessed を立てて術者確認に回す。
    （--arch で明示するのが既定の運用）"""
    sign, conf, _ = crown_side(V, F, normal, u, v)
    # 咬合面が法線の正側を向いている = 法線は歯冠方向 → 便宜的に upper とする
    return ("upper" if sign > 0 else "lower"), conf


# ------------------------------------------------------------------ 正規化
def normalize(V, F, arch=None, flip=False):
    report = {"warnings": []}

    stats, warn = validate_mesh(V, F)
    report["mesh_stats"] = stats
    report["warnings"] += warn

    normal, centroid, rms = fit_occlusal_plane(V, F)
    report["plane_rms_mm"] = round(rms, 4)

    unit, scale, width, unit_ok = detect_unit(V, normal)
    report["unit_detected"] = unit
    report["scale_applied"] = scale
    report["arch_width_mm"] = width
    if not unit_ok:
        report["warnings"].append(
            "UNKNOWN_SCALE: 弓幅の推定値 %.1fmm が想定レンジ %.0f–%.0fmm 外です"
            % (width, ARCH_WIDTH_MM[0], ARCH_WIDTH_MM[1]))

    Vs = V * scale
    normal, centroid, rms = fit_occlusal_plane(Vs, F)

    # 咬合面の側を先に決め、咬頭頂を通る平面へ取り直す（傾きが数度改善する）
    u0, v0 = plane_basis(normal)
    csign, cconf, cmethod = crown_side(Vs, F, normal, u0, v0)
    normal = refine_occlusal_plane(Vs, normal, csign)
    # 平面を取り直したので残差と咬合面の側を測り直す
    d0 = Vs - Vs.mean(axis=0)
    report["plane_rms_mm"] = round(float(np.std(d0 @ normal)), 4)
    u, v = plane_basis(normal)
    csign, cconf, cmethod = crown_side(Vs, F, normal, u, v)

    # 面内へ落として正中面を推定
    P = np.stack([(Vs - centroid) @ u, (Vs - centroid) @ v], axis=1)
    theta, sym, mid_u = estimate_midsagittal(P)
    report["symmetry_score"] = round(sym, 4)
    # 実スキャン相当（歯冠のみの開いた殻）では 0.5 前後が正常値。
    # 閾値を高くすると毎回警告が出て意味を失うので 0.45 とする
    if sym < 0.45:
        report["warnings"].append(
            "LOW_SYMMETRY: 正中面の一致率 %.2f。術者の確認が必要です" % sym)

    # 面内で回した基底。座標が _rot2(P, theta) と一致するように取る
    #   _rot2: (pu·c − pv·s, pu·s + pv·c)
    #   基底 : (p·u2, p·v2) = (pu·c − pv·s, pu·s + pv·c)
    # ここを逆向きにすると弓が面内で回ったまま正規化される
    c, s = math.cos(theta), math.sin(theta)
    u2 = u * c - v * s
    v2 = u * s + v * c

    Q = np.stack([(Vs - centroid) @ u2, (Vs - centroid) @ v2], axis=1)
    sign = anterior_sign(Q)
    v2 = v2 * sign

    # 咬合面がどちら側か（上で算出済み）。誤ると左右が反転するので確度を残す
    report["crown_side_confidence"] = round(cconf, 3)
    report["crown_side_method"] = cmethod
    if cconf < 0.15:
        report["warnings"].append(
            "AMBIGUOUS_ORIENTATION: 咬合面の向きの確度が低い（%.2f）。"
            "プレビューで上下・左右を必ず確認し、誤っていれば --flip を付けて再実行" % cconf)

    # 上下顎: 指定が既定。省略時のみ推定
    guessed = False
    if arch is None:
        arch, conf = guess_arch(Vs, F, normal, u2, v2)
        guessed = True
        report["arch_guess_confidence"] = round(float(conf), 3)
        report["warnings"].append(
            "ARCH_GUESSED: 上下顎を推定しました（%s）。--arch での明示を推奨します" % arch)
    report["arch"] = arch
    report["arch_guessed"] = guessed

    # DENTAL_WORLD の軸を組む:
    #   +Z = 顔面前方 = 前歯側 (v2)
    #   +Y = 頭頂     = 咬合面から歯根へ向かう向き（上顎）
    #   +X = 患者の左 = Y × Z（右手系）
    zc = v2 / np.linalg.norm(v2)
    yc = (normal / np.linalg.norm(normal)) * csign   # yc = 歯冠方向
    # 上顎は歯根が +Y（歯冠が -Y）。下顎はその逆
    if arch == "upper":
        yc = -yc
    if flip:
        yc = -yc
    xc = np.cross(yc, zc)
    xc /= np.linalg.norm(xc)
    zc = np.cross(xc, yc)      # 直交性を締め直す

    R = np.stack([xc, yc, zc])          # world = R @ (p - origin)
    Vr = (Vs - centroid) @ R.T

    # 原点: x=正中面 / y=咬合平面 / z=最前方点（中切歯唇面接線の近似）
    # 咬合平面は「噛む面の高さ」であって点群の中央ではない。歯冠側の端に置く
    ox = mid_u * float(u2 @ xc)      # 対称性から求めた正中面の位置

    oy = (float(np.percentile(Vr[:, 1], 0.5)) if arch == "upper"
          else float(np.percentile(Vr[:, 1], 99.5)))
    oz = float(np.percentile(Vr[:, 2], 99.5))
    Vr = Vr - np.array([ox, oy, oz])

    # 元 → DENTAL_WORLD の 4×4（元データは書き換えない。行列を残す）
    M = np.eye(4)
    M[:3, :3] = R * scale
    M[:3, 3] = -(R @ (centroid)) - np.array([ox, oy, oz])
    report["transform"] = [[round(float(x), 8) for x in row] for row in M]
    report["origin_shift"] = [round(ox, 4), round(oy, 4), round(oz, 4)]

    bb = np.vstack([Vr.min(axis=0), Vr.max(axis=0)])
    report["normalized_bbox"] = {
        "min": [round(float(x), 3) for x in bb[0]],
        "max": [round(float(x), 3) for x in bb[1]],
    }
    report["flip_applied"] = bool(flip)
    report["coordinate_frame"] = "DENTAL_WORLD (mm, Y-up, +X=patient left, +Z=facial)"
    report["source"] = "IOS"
    report["processing_state"] = "NORMALIZED"
    # 自動的に「正しい」と扱わない（研究資料 §20 / §34）
    report["review_state"] = "PENDING_REVIEW"
    report["review_note"] = ("正面観と咬合面観のプレビューを術者が確認し、"
                            "承認するまで Twin へ反映しないこと。")
    return Vr, F, report


def main(argv=None):
    ap = argparse.ArgumentParser(description="IOS の STL を DENTAL_WORLD へ正規化")
    ap.add_argument("stl")
    ap.add_argument("--arch", choices=["upper", "lower"], default=None,
                    help="上下顎（既定は術者指定。省略時は推定し警告を出す）")
    ap.add_argument("--out", default=None, help="出力ディレクトリ")
    ap.add_argument("--flip", action="store_true",
                    help="咬合面の向きが上下逆に出たときに反転させる（術者確認後に使う）")
    a = ap.parse_args(argv)

    V, F = read_stl(a.stl)
    Vr, F, report = normalize(V, F, a.arch, a.flip)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = a.out or os.path.join(root, "dist")
    os.makedirs(outdir, exist_ok=True)
    base = os.path.splitext(os.path.basename(a.stl))[0]
    stl_out = os.path.join(outdir, base + "_normalized.stl")
    rep_out = os.path.join(outdir, base + "_report.json")
    write_stl(stl_out, Vr, F)
    report["input"] = os.path.basename(a.stl)
    report["output_mesh"] = os.path.basename(stl_out)
    with open(rep_out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)

    print("入力      : %s" % a.stl)
    print("単位      : %s (×%g) → 弓幅 %.1fmm" %
          (report["unit_detected"], report["scale_applied"], report["arch_width_mm"]))
    print("咬合平面  : 残差 RMS %.3fmm" % report["plane_rms_mm"])
    print("正中面    : 対称性 %.3f" % report["symmetry_score"])
    print("上下顎    : %s%s" % (report["arch"], "（推定）" if report["arch_guessed"] else ""))
    print("三角形    : %d / 頂点 %d" %
          (report["mesh_stats"]["triangles"], report["mesh_stats"]["vertices"]))
    for w in report["warnings"]:
        print("  ⚠ " + w)
    print("出力      : %s" % os.path.relpath(stl_out, root))
    print("レポート  : %s  (review_state=%s)" %
          (os.path.relpath(rep_out, root), report["review_state"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
