#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ios_segment.py — 正規化済み IOS スキャンを歯牙へ分割し FDI を付与する

  $ python3 tools/ios_segment.py dist/scan_normalized.stl --arch upper
      → dist/scan_segmented.glb + dist/scan_segment_report.json

SPEC §6.5 の実装。**学習モデルは使わない**（学習データなし・外部通信禁止）。
正規化済み（§6.3）を前提にした幾何処理で行う。

これは解剖学的同定であって診断ではない（う蝕の自動判定は実装しない: CLAUDE.md §1-3）。
結果は必ず SUGGESTED として出し、術者の Accept / Edit / Reject を経る。
"""

import argparse
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ios_import as IOS   # noqa: E402
from dental_arch_gen import GLB   # noqa: E402

# 歯冠の高さ（mm）。歯肉との切り離し位置に使う概算値
CROWN_H = {"incisor": 9.5, "canine": 10.5, "premolar": 8.0, "molar": 7.0}
# スキャンに写らない歯根の標準値（GENERIC。研究資料 §22–23）
ROOT_L = {1: 12.5, 2: 12.0, 3: 16.0, 4: 13.5, 5: 14.0, 6: 13.0, 7: 12.5, 8: 11.0}
ROOTS_N = {1: 1, 2: 1, 3: 1, 4: 2, 5: 1, 6: 3, 7: 3, 8: 3}       # 上顎
ROOTS_N_L = {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2}     # 下顎


def tooth_kind(n):
    if n <= 2:
        return "incisor"
    if n == 3:
        return "canine"
    if n <= 5:
        return "premolar"
    return "molar"


# ------------------------------------------------------------- メッシュ操作
def adjacency(F, n):
    """頂点隣接リスト（連結成分用）"""
    adj = [[] for _ in range(n)]
    for a, b, c in F:
        adj[a].append(b); adj[b].append(a)
        adj[b].append(c); adj[c].append(b)
        adj[c].append(a); adj[a].append(c)
    return adj


def components(mask, adj):
    """mask=True の頂点だけを辿って連結成分を返す"""
    lab = np.full(len(mask), -1, dtype=np.int32)
    cid = 0
    for s in range(len(mask)):
        if not mask[s] or lab[s] >= 0:
            continue
        stack, lab[s] = [s], cid
        while stack:
            v = stack.pop()
            for w in adj[v]:
                if mask[w] and lab[w] < 0:
                    lab[w] = cid
                    stack.append(w)
        cid += 1
    return lab, cid


# ------------------------------------------------- 歯肉ライン推定と歯牙抽出
def arch_param(V, up):
    """弓に沿った角度（前歯=0 を中心）と半径を返す"""
    x, z = V[:, 0], V[:, 2]
    cz = np.percentile(z, 50)
    ang = np.arctan2(x, -(z - cz))     # 前方(+Z)を 0、患者左(+X)を正にとる
    rad = np.hypot(x, z - cz)
    return ang, rad, cz


def separate_teeth(V, F, up, nsect=72):
    """角度セクタごとに咬頭頂を求め、歯冠高さぶん歯肉側で切る。

    水平面 1 枚で切ると歯肉ラインの起伏（歯間乳頭）に追従できず、
    前歯と臼歯で切りすぎ／切り足りないが同時に起きる。
    """
    ang, rad, cz = arch_param(V, up)
    h = V[:, 1] * up                    # 大きいほど歯肉（根尖）側
    keep = rad > np.percentile(rad, 25)  # 口蓋中央を除く

    b = (((ang + math.pi) / (2 * math.pi)) * nsect).astype(np.int32) % nsect
    cut = np.full(nsect, np.nan)
    for k in range(nsect):
        m = np.where(keep & (b == k))[0]
        if len(m) < 12:
            continue
        tip = np.percentile(h[m], 2)                     # 咬頭頂
        # 歯種は弓上の位置から推定（前歯ほど歯冠が長い）
        a = abs(((ang[m].mean() + math.pi) % (2 * math.pi)) - math.pi)
        kind = "incisor" if a < 0.42 else ("canine" if a < 0.62 else
                                           ("premolar" if a < 0.95 else "molar"))
        cut[k] = tip + CROWN_H[kind]
    # 欠測セクタを補間して滑らかにする
    idx = np.arange(nsect)
    ok = ~np.isnan(cut)
    if ok.sum() < 8:
        raise ValueError("歯列弓を検出できませんでした")
    cut = np.interp(idx, idx[ok], cut[ok], period=nsect)
    cut = np.convolve(np.r_[cut[-3:], cut, cut[:3]], np.ones(7) / 7, "same")[3:-3]

    is_tooth = h < cut[b]
    return is_tooth, ang, rad, cut, b


# ----------------------------------------------------- 個歯への分割と FDI
def split_teeth(V, F, is_tooth, adj, up, ang):
    """接触点より咬合側で切って連結成分を取り、島＝個々の歯とする"""
    h = V[:, 1] * up
    ti = np.where(is_tooth)[0]
    if len(ti) < 100:
        raise ValueError("歯牙領域が小さすぎます")

    # 咬合側 40% だけを残すと、隣接歯は接触点で切れて島に分かれる
    lo = np.percentile(h[ti], 2)
    hi = np.percentile(h[ti], 98)
    best = None
    for frac in (0.30, 0.35, 0.40, 0.45, 0.50, 0.55):
        core = is_tooth & (h < lo + (hi - lo) * frac)
        lab, n = components(core, adj)
        sizes = np.bincount(lab[lab >= 0]) if n else np.array([])
        big = [i for i in range(n) if sizes[i] >= 60]
        if best is None or abs(len(big) - 14) < abs(best[0] - 14):
            best = (len(big), frac, lab, big)
    nbig, frac, lab, big = best

    # 島を弧長順に並べ、歯牙頂点を最も近い島へ割り当てる
    centers = []
    for c in big:
        m = np.where(lab == c)[0]
        centers.append((float(np.median(ang[m])), c))
    centers.sort()

    seg = np.full(len(V), -1, dtype=np.int32)
    if not centers:
        raise ValueError("個歯を分離できませんでした")
    ca = np.array([c[0] for c in centers])
    for i, v in enumerate(ti):
        seg[v] = int(np.argmin(np.abs(ca - ang[v])))
    return seg, len(centers), frac, ca


def assign_fdi(V, seg, ncomp, jaw, ang):
    """正中で象限を分け、正中に近い順に歯番を振る（欠損があるとずれる）。

    ⚠ 並べ替えは **x 座標ではなく弓に沿った角度**で行う。歯列弓は後方で内側へ
    湾曲するため、7番より8番の方が正中に近い x を取ることがあり、x 順に
    並べると臼歯部の歯番がずれる（実際にずれた）。
    """
    q_right = 1 if jaw == "U" else 4      # 患者の右 (-X)
    q_left = 2 if jaw == "U" else 3       # 患者の左 (+X)
    info = []
    for c in range(ncomp):
        m = np.where(seg == c)[0]
        if len(m) == 0:
            continue
        cen = V[m].mean(axis=0)
        info.append({"comp": c, "x": float(cen[0]), "n": int(len(m)),
                     "ang": float(np.median(np.abs(ang[m]))), "centroid": cen})
    # |ang| は正中で最大、遠心へ行くほど小さくなる
    right = sorted([i for i in info if i["x"] < 0], key=lambda d: -d["ang"])
    left = sorted([i for i in info if i["x"] >= 0], key=lambda d: -d["ang"])
    out = {}
    for k, it in enumerate(right):
        out[it["comp"]] = q_right * 10 + min(k + 1, 8)
    for k, it in enumerate(left):
        out[it["comp"]] = q_left * 10 + min(k + 1, 8)
    return out, info


# --------------------------------------------------------------- extras 構成
def build_extras(V, m, fdi, jaw, up, cz, cut_h):
    """§4.5 の契約に合わせた extras。3軸は正規直交化して 3 本とも格納する"""
    n = fdi % 10
    cen = V[m].mean(axis=0)

    occ = np.array([0.0, -up, 0.0])                  # 咬合方向（歯冠側）
    # 頬側 = 弓の外向き（XZ 平面）
    b = np.array([cen[0], 0.0, cen[2] - cz])
    nb = np.linalg.norm(b)
    buc = (b / nb) if nb > 1e-6 else np.array([0.0, 0.0, 1.0])
    # 近心 = 弓の接線。左右で向きが反転するので外積に頼らず符号を決める
    tan = np.array([-buc[2], 0.0, buc[0]])
    if (fdi // 10) in (1, 4):        # 患者の右側は +X が近心方向
        tan = -tan
    # 正規直交化（Gram-Schmidt）
    buc = buc - occ * float(buc @ occ)
    buc /= np.linalg.norm(buc)
    mes = tan - occ * float(tan @ occ) - buc * float(tan @ buc)
    mes /= np.linalg.norm(mes)

    h = (V[m] - cen) @ occ
    crown_top_h = float(np.percentile(h, 98))
    cej_h = float((cut_h - cen[1] * up) * -1.0) if False else float(np.percentile(h, 2))
    root_l = ROOT_L[n]
    roots = (ROOTS_N if jaw == "U" else ROOTS_N_L)[n]

    return {
        "fdi": int(fdi),
        "type": ("U" if jaw == "U" else "L") + str(n),
        "jaw": jaw,
        "quadrant": int(fdi // 10),
        "roots": int(roots),
        "axis_occlusal": [round(float(x), 6) for x in occ],
        "axis_buccal": [round(float(x), 6) for x in buc],
        "axis_mesial": [round(float(x), 6) for x in mes],
        "centroid": [round(float(x), 4) for x in cen],
        "cej_h": round(cej_h, 4),
        "crown_top_h": round(crown_top_h, 4),
        "apex_h": round(cej_h - root_l, 4),
        "cej_y": round(float(cen[1] + cej_h * occ[1]), 4),
        "crown_h": round(crown_top_h - cej_h, 3),
        "root_l": root_l,
        "md_width": round(float(np.ptp((V[m] - cen) @ mes)), 3),
        "bl_width": round(float(np.ptp((V[m] - cen) @ buc)), 3),
        "bone_level_mm": 2.0,
        # スキャンに歯根は写らない。標準値で補ったことを明示する（研究資料 §21）
        "crown_source": "IOS",
        "root_source": "GENERIC",
        "segmentation": "SUGGESTED",
    }


def submesh(V, F, m):
    """頂点集合 m を含む三角形だけを取り出して再インデックスする"""
    sel = np.zeros(len(V), dtype=bool)
    sel[m] = True
    keep = sel[F].all(axis=1)
    Fk = F[keep]
    if len(Fk) == 0:
        return None, None
    used, inv = np.unique(Fk.reshape(-1), return_inverse=True)
    return V[used], inv.reshape(-1, 3).astype(np.uint32)


# -------------------------------------------------------------------- main
def segment(V, F, arch):
    jaw = "U" if arch == "upper" else "L"
    up = 1.0 if jaw == "U" else -1.0
    report = {"arch": arch, "warnings": []}

    adj = adjacency(F, len(V))
    is_tooth, ang, rad, cut, b = separate_teeth(V, F, up)
    report["tooth_vertices"] = int(is_tooth.sum())
    report["gingiva_vertices"] = int((~is_tooth).sum())

    seg, ncomp, frac, ca = split_teeth(V, F, is_tooth, adj, up, ang)
    report["components"] = int(ncomp)
    report["core_fraction"] = frac
    if ncomp < 10:
        report["warnings"].append(
            "FEW_TEETH: 検出した歯が %d 本です。欠損・接触の強い症例では"
            "分割が不足します。術者が確認・修正してください" % ncomp)
    if ncomp > 16:
        report["warnings"].append(
            "MANY_TEETH: 検出した歯が %d 本で 16 本を超えています。"
            "破折片やノイズを歯として拾った可能性があります" % ncomp)

    fdi_of, info = assign_fdi(V, seg, ncomp, jaw, ang)
    cz = arch_param(V, up)[2]

    teeth = []
    for it in info:
        c = it["comp"]
        fdi = fdi_of[c]
        m = np.where(seg == c)[0]
        Vt, Ft = submesh(V, F, m)
        if Vt is None:
            continue
        ex = build_extras(V, m, fdi, jaw, up, cz, 0.0)
        teeth.append({"fdi": fdi, "V": Vt, "F": Ft, "extras": ex,
                      "vertices": int(len(m))})
    teeth.sort(key=lambda t: t["fdi"])

    gm = np.where(~is_tooth)[0]
    Vg, Fg = submesh(V, F, gm)

    report["teeth"] = [{"fdi": t["fdi"], "vertices": t["vertices"],
                        "md_width": t["extras"]["md_width"],
                        "crown_h": t["extras"]["crown_h"]} for t in teeth]
    report["fdi_assigned"] = [t["fdi"] for t in teeth]
    report["method"] = "geometric (no learned model)"
    report["segmentation_state"] = "SUGGESTED"
    report["review_state"] = "PENDING_REVIEW"
    report["review_note"] = ("歯番は正中からの並び順で機械的に振っています。"
                            "欠損・埋伏があるとずれます。必ず術者が確認してください。")
    return teeth, (Vg, Fg), report


def write_glb(path, teeth, ging, jaw):
    g = GLB()
    mats = [
        {"name": "tooth", "pbrMetallicRoughness": {
            "baseColorFactor": [0.95, 0.93, 0.89, 1.0], "metallicFactor": 0.0,
            "roughnessFactor": 0.45}},
        {"name": "gingiva", "pbrMetallicRoughness": {
            "baseColorFactor": [0.90, 0.64, 0.63, 1.0], "metallicFactor": 0.0,
            "roughnessFactor": 0.8}},
    ]
    kids = []
    for t in teeth:
        mi = g.add_mesh("tooth_%d" % t["fdi"], t["V"], t["F"], 0)
        g.nodes.append({"name": "tooth_%d" % t["fdi"], "mesh": mi,
                        "extras": t["extras"]})
        kids.append(len(g.nodes) - 1)
    Vg, Fg = ging
    if Vg is not None:
        nm = "gingiva_" + ("upper" if jaw == "U" else "lower")
        mi = g.add_mesh(nm, Vg, Fg, 1)
        g.nodes.append({"name": nm, "mesh": mi})
        kids.append(len(g.nodes) - 1)

    grp = "maxilla" if jaw == "U" else "mandible"
    g.nodes.append({"name": grp, "children": kids})
    root = len(g.nodes) - 1
    g.save(path, [root], mats) if hasattr(g, "save") else _save(g, path, [root], mats)
    return path


def _save(g, path, roots, materials):
    """dental_arch_gen.GLB に save が無い場合のフォールバック"""
    import struct
    js = {
        "asset": {"version": "2.0", "generator": "ios_segment.py"},
        "scene": 0, "scenes": [{"nodes": roots}],
        "nodes": g.nodes, "meshes": g.meshes, "materials": materials,
        "accessors": g.accessors, "bufferViews": g.views,
        "buffers": [{"byteLength": len(g.bin)}],
    }
    jb = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jb += b" " * (-len(jb) % 4)
    bb = bytes(g.bin) + b"\0" * (-len(g.bin) % 4)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    with open(path, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        f.write(struct.pack("<II", len(bb), 0x004E4942) + bb)


def main(argv=None):
    ap = argparse.ArgumentParser(description="正規化済みスキャンの歯牙分割と FDI 付与")
    ap.add_argument("stl")
    ap.add_argument("--arch", choices=["upper", "lower"], required=True)
    ap.add_argument("--out", default=None)
    a = ap.parse_args(argv)

    V, F = IOS.read_stl(a.stl)
    teeth, ging, rep = segment(V, F, a.arch)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outdir = a.out or os.path.join(root, "dist")
    os.makedirs(outdir, exist_ok=True)
    base = os.path.splitext(os.path.basename(a.stl))[0].replace("_normalized", "")
    glb = os.path.join(outdir, base + "_segmented.glb")
    rp = os.path.join(outdir, base + "_segment_report.json")
    write_glb(glb, teeth, ging, "U" if a.arch == "upper" else "L")
    rep["input"] = os.path.basename(a.stl)
    rep["output_mesh"] = os.path.basename(glb)
    with open(rp, "w", encoding="utf-8") as f:
        json.dump(rep, f, ensure_ascii=False, indent=1)

    print("歯牙/歯肉  : %d / %d 頂点" % (rep["tooth_vertices"], rep["gingiva_vertices"]))
    print("検出した歯 : %d 本  歯番 %s" % (rep["components"], rep["fdi_assigned"]))
    for w in rep["warnings"]:
        print("  ⚠ " + w)
    print("出力       : %s" % os.path.relpath(glb, root))
    print("レポート   : %s  (%s / %s)" %
          (os.path.relpath(rp, root), rep["segmentation_state"], rep["review_state"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
