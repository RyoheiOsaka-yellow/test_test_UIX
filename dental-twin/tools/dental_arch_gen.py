#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dental_arch_gen.py — DENTAL TWIN 暫定歯列ジェネレータ (SPEC.md §4.7)

購入モデル到着までビューア開発を止めないための「契約を満たす仮ジオメトリ」を生成する。
出力: dental_template.glb  (32歯 + 歯肉x2 + 歯槽骨x2, 各歯ノードに extras メタデータ)

座標系 (SPEC.md §4.1):
  単位 mm / 右手系 / Y-up
  +X = 患者の左 / +Y = 頭頂 / +Z = 顔面前方
  原点 = 正中矢状面 x 咬合平面 x 上顎中切歯唇面接線

歯のローカル座標:
  +Y = 咬合面方向 / +X = 頬側 / +Z = 近心
  CEJ が y=0、歯冠が +Y 側、歯根が -Y 側

依存: numpy のみ (GLB は自前で書き出す)
"""

import json
import os
import struct
import math
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

# ============================================================
# 1. 歯種パラメータ
# ============================================================
# crown_h : 歯冠高 (CEJ→咬頭頂) mm
# root_l  : 歯根長 mm
# md      : 近遠心幅 mm
# bl      : 頬舌幅 mm
# roots   : 歯根数
# cap     : 咬合面形状 'ridge'(切歯) / 'point'(犬歯) / 'cusps'(小臼歯・大臼歯)
# ncusp   : cusps のときの咬頭数
# amp     : 咬頭の高さ mm
# sq      : 断面のスーパー楕円指数 (2=楕円, 大きいほど角張る)
# torque  : 頬舌的傾斜角 deg (+ = 歯冠が頬側へ傾く)

TOOTH_TYPES = {
    "U1": dict(crown_h=10.5, root_l=13.0, md=8.5,  bl=7.0,  roots=1, cap="ridge", ncusp=0, amp=0.6, sq=2.3, torque=+12.0),
    "U2": dict(crown_h=9.0,  root_l=13.0, md=6.5,  bl=6.0,  roots=1, cap="ridge", ncusp=0, amp=0.7, sq=2.3, torque=+10.0),
    "U3": dict(crown_h=10.0, root_l=17.0, md=7.5,  bl=8.0,  roots=1, cap="point", ncusp=1, amp=1.8, sq=2.4, torque=+4.0),
    "U4": dict(crown_h=8.5,  root_l=14.0, md=7.0,  bl=9.0,  roots=2, cap="cusps", ncusp=2, amp=1.6, sq=2.8, torque=-3.0),
    "U5": dict(crown_h=8.5,  root_l=14.0, md=6.5,  bl=9.0,  roots=1, cap="cusps", ncusp=2, amp=1.4, sq=2.8, torque=-4.0),
    "U6": dict(crown_h=7.5,  root_l=13.0, md=10.0, bl=11.0, roots=3, cap="cusps", ncusp=4, amp=1.5, sq=3.2, torque=-6.0),
    "U7": dict(crown_h=7.0,  root_l=12.5, md=9.0,  bl=11.0, roots=3, cap="cusps", ncusp=4, amp=1.3, sq=3.2, torque=-7.0),
    "U8": dict(crown_h=6.5,  root_l=11.0, md=8.5,  bl=10.0, roots=2, cap="cusps", ncusp=3, amp=1.1, sq=3.0, torque=-8.0),
    "L1": dict(crown_h=9.0,  root_l=12.5, md=5.0,  bl=6.0,  roots=1, cap="ridge", ncusp=0, amp=0.5, sq=2.3, torque=+4.0),
    "L2": dict(crown_h=9.5,  root_l=14.0, md=5.5,  bl=6.5,  roots=1, cap="ridge", ncusp=0, amp=0.5, sq=2.3, torque=+4.0),
    "L3": dict(crown_h=11.0, root_l=16.0, md=7.0,  bl=7.5,  roots=1, cap="point", ncusp=1, amp=1.8, sq=2.4, torque=+2.0),
    "L4": dict(crown_h=7.5,  root_l=14.0, md=7.0,  bl=7.5,  roots=1, cap="cusps", ncusp=2, amp=1.5, sq=2.8, torque=-6.0),
    "L5": dict(crown_h=8.0,  root_l=14.5, md=7.0,  bl=8.0,  roots=1, cap="cusps", ncusp=2, amp=1.4, sq=2.8, torque=-8.0),
    "L6": dict(crown_h=7.5,  root_l=14.0, md=11.0, bl=10.5, roots=2, cap="cusps", ncusp=4, amp=1.5, sq=3.2, torque=-12.0),
    "L7": dict(crown_h=7.0,  root_l=13.0, md=10.5, bl=10.0, roots=2, cap="cusps", ncusp=4, amp=1.3, sq=3.2, torque=-14.0),
    "L8": dict(crown_h=7.0,  root_l=11.0, md=10.0, bl=9.5,  roots=2, cap="cusps", ncusp=3, amp=1.1, sq=3.0, torque=-16.0),
}

# FDI 歯番 → 歯種キー
def fdi_type(fdi):
    quad, num = fdi // 10, fdi % 10
    jaw = "U" if quad in (1, 2) else "L"
    return f"{jaw}{num}"

QUAD_ORDER = {
    1: [11, 12, 13, 14, 15, 16, 17, 18],   # 上顎右
    2: [21, 22, 23, 24, 25, 26, 27, 28],   # 上顎左
    3: [31, 32, 33, 34, 35, 36, 37, 38],   # 下顎左
    4: [41, 42, 43, 44, 45, 46, 47, 48],   # 下顎右
}

# 象限 → (顎, X符号)   +X = 患者の左
QUAD_SIDE = {1: ("U", -1), 2: ("U", +1), 3: ("L", +1), 4: ("L", -1)}

# 解像度
RADIAL   = 24   # 断面の分割数
CROWN_R  = 10   # 歯冠のリング数
ROOT_R   = 12   # 歯根のリング数
CAP_R    = 5    # 咬合面キャップのリング数

OCCLUSAL_GAP = 0.25   # 咬合平面からの上下クリアランス mm


# ============================================================
# 2. 汎用メッシュユーティリティ
# ============================================================
class Mesh:
    def __init__(self):
        self.v = []
        self.f = []

    def add(self, verts, faces):
        off = len(self.v)
        self.v.extend(verts)
        self.f.extend([(a + off, b + off, c + off) for a, b, c in faces])

    def arrays(self):
        return np.asarray(self.v, np.float32), np.asarray(self.f, np.uint32)


def superellipse(n_seg, rx, rz, sq):
    """スーパー楕円の断面リング。theta は +X(頬側) から +Z(近心) 回り。"""
    th = np.linspace(0, 2 * np.pi, n_seg, endpoint=False)
    c, s = np.cos(th), np.sin(th)
    e = 2.0 / sq
    x = rx * np.sign(c) * np.abs(c) ** e
    z = rz * np.sign(s) * np.abs(s) ** e
    return x, z, th


def loft_faces(n_ring, n_seg, flip=False):
    """連続するリング間を三角形化。頂点は ring-major で並んでいる前提。

    リングが +Y 方向に進む場合、flip=False で法線は外向きになる。
    -Y 方向に進む場合や、頂点側で内側へ収束する場合は flip=True。
    """
    f = []
    for i in range(n_ring - 1):
        for j in range(n_seg):
            j2 = (j + 1) % n_seg
            a = i * n_seg + j
            b = i * n_seg + j2
            c = (i + 1) * n_seg + j
            d = (i + 1) * n_seg + j2
            if flip:
                f.append((a, d, c))
                f.append((a, b, d))
            else:
                f.append((a, c, d))
                f.append((a, d, b))
    return f


def signed_volume(V, F):
    p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    return float(np.einsum("ij,ij->i", p0, np.cross(p1 - p0, p2 - p0)).sum() / 6.0)


def orient_outward(V, F):
    """符号付き体積が負なら全面の巻き順を反転する（安全網）。"""
    if signed_volume(V, F) < 0:
        F = F[:, ::-1].copy()
    return V, F


def fan_cap(center_idx, ring_start, n_seg, flip=False):
    f = []
    for j in range(n_seg):
        j2 = (j + 1) % n_seg
        a, b = ring_start + j, ring_start + j2
        f.append((center_idx, b, a) if flip else (center_idx, a, b))
    return f


# ============================================================
# 3. 咬合面の高さ関数
# ============================================================
def cusp_amp(u, v, p):
    """u,v は咬合面上の正規化座標 (u=頬舌 +1=頬側, v=近遠心 +1=近心)。戻り値 mm。"""
    style, A, N = p["cap"], p["amp"], p["ncusp"]
    if style == "ridge":
        # 近遠心方向に走る切縁の稜線
        return A * (1.0 - np.clip(u * u, 0, 1))
    if style == "point":
        # 犬歯の単一尖頭
        return A * (1.0 - np.clip(u * u, 0, 1)) * (1.0 - 0.85 * np.clip(v * v, 0, 1))
    # cusps
    r = np.clip(np.sqrt(u * u + v * v), 0, 1)
    th = np.arctan2(v, u)
    th0 = np.pi / 4 if N == 4 else 0.0
    lobe = np.maximum(0.0, np.cos(N * (th - th0)))
    return A * (0.30 + 0.70 * lobe ** 1.3) * r ** 0.7


# ============================================================
# 4. 単一歯の生成 (ローカル座標)
# ============================================================
ROOT_LAYOUT = {
    # key: (n_roots, jaw, tooth_num) -> [(dx_ratio, dz_ratio, radius_scale), ...]
    "U4_2": [(+0.28, 0.0, 0.50), (-0.28, 0.0, 0.50)],
    "U6_3": [(+0.30, +0.28, 0.42), (+0.30, -0.28, 0.40), (-0.34, 0.0, 0.48)],
    "U8_2": [(+0.26, +0.18, 0.46), (-0.28, -0.10, 0.46)],
    "L6_2": [(0.0, +0.30, 0.52), (0.0, -0.28, 0.48)],
}


def root_layout(key, p):
    if key in ROOT_LAYOUT:
        return ROOT_LAYOUT[key]
    if p["roots"] == 2:
        return ROOT_LAYOUT["L6_2"]
    if p["roots"] == 3:
        return ROOT_LAYOUT["U6_3"]
    return None


def build_tooth(tkey, p):
    """歯冠 + 歯根のメッシュをローカル座標で生成。"""
    m = Mesh()
    ch, rl = p["crown_h"], p["root_l"]
    rx0, rz0 = p["bl"] / 2.0, p["md"] / 2.0
    sq = p["sq"]

    # ---- 歯冠 ----
    # t: 0 = CEJ, 1 = 咬頭頂
    ts = np.linspace(0.0, 1.0, CROWN_R)
    # 歯頸部で括れ、歯冠豊隆部(t≒0.35)で最大、咬合面で少し狭まる
    def crown_scale(t):
        sx = 0.85 + 0.60 * t - 0.73 * t ** 2      # 頬舌
        sz = 0.86 + 0.48 * t - 0.54 * t ** 2      # 近遠心
        return sx, sz

    ring_xz = []
    verts = []
    for t in ts:
        sx, sz = crown_scale(t)
        x, z, _ = superellipse(RADIAL, rx0 * sx, rz0 * sz, sq)
        u = x / max(rx0, 1e-6)
        v = z / max(rz0, 1e-6)
        y = ch * t + cusp_amp(u, v, p) * (t ** 3)
        ring_xz.append((x, z))
        for k in range(RADIAL):
            verts.append((x[k], y[k], z[k]))
    m.add(verts, loft_faces(CROWN_R, RADIAL))

    # ---- 咬合面キャップ ----
    top_x, top_z = ring_xz[-1]
    cap_verts = []
    # s = 1(外周) → 0(中心)
    ss = np.linspace(1.0, 0.0, CAP_R + 1)[1:]   # 外周リングは歯冠の最終リングを流用
    for s in ss:
        x, z = top_x * s, top_z * s
        u = top_x / max(rx0, 1e-6)
        v = top_z / max(rz0, 1e-6)
        y = ch + cusp_amp(u, v, p) * (s ** 1.6)
        for k in range(RADIAL):
            cap_verts.append((x[k], y[k], z[k]))
    cap_start = len(m.v)
    crown_top_ring = (CROWN_R - 1) * RADIAL
    m.v.extend(cap_verts)
    # 歯冠最終リング → キャップ第1リング
    for j in range(RADIAL):
        j2 = (j + 1) % RADIAL
        a, b = crown_top_ring + j, crown_top_ring + j2
        c, d = cap_start + j, cap_start + j2
        m.f.append((a, c, d))
        m.f.append((a, d, b))
    m.f.extend([(a + cap_start, b + cap_start, c + cap_start)
                for a, b, c in loft_faces(CAP_R, RADIAL, flip=False)])
    # 中心
    ci = len(m.v)
    m.v.append((0.0, ch, 0.0))
    last_ring = cap_start + (CAP_R - 1) * RADIAL
    m.f.extend(fan_cap(ci, last_ring, RADIAL, flip=True))

    # ---- 歯根 ----
    layout = root_layout(f"{tkey}_{p['roots']}", p) if p["roots"] > 1 else None
    cej_x, cej_z = ring_xz[0]

    if layout is None:
        # 単根: CEJ から根尖まで一本でテーパ
        rverts = []
        ts_r = np.linspace(0.0, 1.0, ROOT_R)
        for t in ts_r:
            sc = (1.0 - t) ** 0.62 * (1.0 + 0.06 * math.sin(math.pi * t))
            y = -rl * t
            for k in range(RADIAL):
                rverts.append((cej_x[k] * sc, y, cej_z[k] * sc))
        rs = len(m.v)
        m.v.extend(rverts)
        m.f.extend([(a + rs, b + rs, c + rs)
                    for a, b, c in loft_faces(ROOT_R, RADIAL, flip=True)])
        # CEJ リングと接続 (歯冠の第0リング = index 0..RADIAL-1)
        for j in range(RADIAL):
            j2 = (j + 1) % RADIAL
            m.f.append((j, rs + j2, rs + j))
            m.f.append((j, j2, rs + j2))
        # 根尖
        ai = len(m.v)
        m.v.append((0.0, -rl - 0.4, 0.0))
        m.f.extend(fan_cap(ai, rs + (ROOT_R - 1) * RADIAL, RADIAL, flip=False))
    else:
        # 複根: 根幹 → 分岐 → 各根
        furc = rl * 0.36
        trunk_r = 5
        tverts = []
        for t in np.linspace(0.0, 1.0, trunk_r):
            sc = 1.0 - 0.22 * t
            y = -furc * t
            for k in range(RADIAL):
                tverts.append((cej_x[k] * sc, y, cej_z[k] * sc))
        ts_i = len(m.v)
        m.v.extend(tverts)
        m.f.extend([(a + ts_i, b + ts_i, c + ts_i)
                    for a, b, c in loft_faces(trunk_r, RADIAL, flip=True)])
        for j in range(RADIAL):
            j2 = (j + 1) % RADIAL
            m.f.append((j, ts_i + j2, ts_i + j))
            m.f.append((j, j2, ts_i + j2))
        # 分岐部の底を塞ぐ
        bi = len(m.v)
        m.v.append((0.0, -furc, 0.0))
        m.f.extend(fan_cap(bi, ts_i + (trunk_r - 1) * RADIAL, RADIAL, flip=False))

        seg_n = max(12, RADIAL // 2)
        for (dxr, dzr, rsc) in layout:
            cx0, cz0 = dxr * p["bl"], dzr * p["md"]
            rrx, rrz = rx0 * rsc, rz0 * rsc
            rverts = []
            ts_r = np.linspace(0.0, 1.0, ROOT_R)
            for t in ts_r:
                sc = (1.0 - t) ** 0.55
                spread = 0.55 + 0.75 * t          # 根尖に向かって離開
                cx, cz = cx0 * spread, cz0 * spread
                y = -furc - (rl - furc) * t
                x, z, _ = superellipse(seg_n, rrx * sc + 1e-3, rrz * sc + 1e-3, 2.2)
                for k in range(seg_n):
                    rverts.append((cx + x[k], y, cz + z[k]))
            rs = len(m.v)
            m.v.extend(rverts)
            m.f.extend([(a + rs, b + rs, c + rs)
                        for a, b, c in loft_faces(ROOT_R, seg_n, flip=True)])
            # 上端を塞ぐ (分岐部に埋没するので簡易)
            ti = len(m.v)
            m.v.append((cx0 * 0.55, -furc + 0.6, cz0 * 0.55))
            m.f.extend(fan_cap(ti, rs, seg_n, flip=True))
            ai = len(m.v)
            m.v.append((cx0 * 1.30, -rl - 0.3, cz0 * 1.30))
            m.f.extend(fan_cap(ai, rs + (ROOT_R - 1) * seg_n, seg_n, flip=False))

    V, F = m.arrays()
    return orient_outward(V, F)


# ============================================================
# 5. 歯列弓
# ============================================================
class Arch:
    """XZ平面上の楕円弓。歯の近遠心幅の総和に合わせて弧長を正規化する。"""

    def __init__(self, a, b, z_front, total_len):
        self.a, self.b, self.z_front = a, b, z_front
        self.us = np.linspace(0, math.pi * 0.62, 2000)
        self._build()
        scale = (total_len / 2.0) / self.half_len
        self.a *= scale
        self.b *= scale
        self._build()

    def _build(self):
        a, b = self.a, self.b
        x = a * np.sin(self.us)
        z = self.z_front - b * (1 - np.cos(self.us))
        d = np.sqrt(np.diff(x) ** 2 + np.diff(z) ** 2)
        self.s = np.concatenate([[0], np.cumsum(d)])
        self.half_len = self.s[-1]

    def at(self, s):
        """弧長 s (>=0) の点と外向き法線。s は片側分。"""
        u = float(np.interp(s, self.s, self.us))
        x = self.a * math.sin(u)
        z = self.z_front - self.b * (1 - math.cos(u))
        nx, nz = self.b * math.sin(u), self.a * math.cos(u)
        n = math.hypot(nx, nz)
        return (x, z), (nx / n, nz / n), u


def rot_axis(axis, ang):
    ax = np.asarray(axis, float)
    ax = ax / np.linalg.norm(ax)
    c, s = math.cos(ang), math.sin(ang)
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) * c + s * K + (1 - c) * np.outer(ax, ax)


def place_teeth():
    """32歯を配置し、(fdi, verts_world, faces, extras) を返す。"""
    out = []
    for jaw, quads, (a, b, zf), ysign in (
        ("U", (1, 2), (33.0, 46.0, 26.0), -1),
        ("L", (3, 4), (30.5, 44.0, 24.0), +1),
    ):
        widths = [TOOTH_TYPES[fdi_type(f)]["md"] for f in QUAD_ORDER[quads[0]]]
        arch = Arch(a, b, zf, sum(widths) * 2.0)

        for quad in quads:
            xsign = QUAD_SIDE[quad][1]
            s_cursor = 0.0
            for fdi in QUAD_ORDER[quad]:
                p = TOOTH_TYPES[fdi_type(fdi)]
                s_center = s_cursor + p["md"] / 2.0
                s_cursor += p["md"]
                (ax, az), (nx, nz), _ = arch.at(s_center)

                px = ax * xsign
                pz = az
                nvec = np.array([nx * xsign, 0.0, nz])
                nvec /= np.linalg.norm(nvec)

                # 近心 = 正中方向へ向かう弓の接線
                tang = np.array([-nvec[2], 0.0, nvec[0]])
                if np.dot(tang, np.array([-xsign, 0.0, 0.0])) < 0:
                    tang = -tang
                m_axis = tang / np.linalg.norm(tang)

                o_axis = np.array([0.0, -1.0, 0.0]) if jaw == "U" else np.array([0.0, 1.0, 0.0])
                b_axis = nvec.copy()

                # トルク: (咬合軸, 頬側軸) 平面内の回転として適用する。
                # 近心軸まわりの回転として書くと、正中をまたいだ時に
                # 近心軸の向きが反転して符号が破綻する（左右非対称になる）。
                tq = math.radians(p["torque"])
                ct, st = math.cos(tq), math.sin(tq)
                o_new = ct * o_axis + st * b_axis
                b_new = -st * o_axis + ct * b_axis
                o_axis, b_axis = o_new, b_new

                # 正規直交化
                o_axis /= np.linalg.norm(o_axis)
                b_axis = b_axis - np.dot(b_axis, o_axis) * o_axis
                b_axis /= np.linalg.norm(b_axis)
                m_axis = m_axis - np.dot(m_axis, o_axis) * o_axis - np.dot(m_axis, b_axis) * b_axis
                m_axis /= np.linalg.norm(m_axis)

                # ローカル(x=頬側, y=咬合, z=近心) → ワールド
                M = np.column_stack([b_axis, o_axis, m_axis])

                gap = OCCLUSAL_GAP if jaw == "U" else -OCCLUSAL_GAP
                y_cej = gap + p["crown_h"] if jaw == "U" else gap - p["crown_h"]
                origin = np.array([px, y_cej, pz])

                V, F = build_tooth(fdi_type(fdi), p)
                Vw = (V @ M.T) + origin
                # 左右の歯は互いに鏡像なので基底の行列式が反転する。
                # そのままだと片側の面法線が裏返るため巻き順を反転する。
                if np.linalg.det(M) < 0:
                    F = F[:, ::-1].copy()

                centroid = Vw.mean(axis=0)
                cej_h = float(np.dot(origin - centroid, o_axis))
                extras = {
                    "fdi": int(fdi),
                    "type": fdi_type(fdi),
                    "jaw": jaw,
                    "quadrant": int(fdi // 10),
                    "roots": int(p["roots"]),
                    "axis_occlusal": [round(float(x), 6) for x in o_axis],
                    "axis_buccal": [round(float(x), 6) for x in b_axis],
                    "axis_mesial": [round(float(x), 6) for x in m_axis],
                    "centroid": [round(float(x), 4) for x in centroid],
                    "cej_h": round(cej_h, 4),
                    "crown_top_h": round(cej_h + p["crown_h"], 4),
                    "apex_h": round(cej_h - p["root_l"], 4),
                    "cej_y": round(float(origin[1]), 4),
                    "crown_h": p["crown_h"],
                    "root_l": p["root_l"],
                    "md_width": p["md"],
                    "bl_width": p["bl"],
                    "bone_level_mm": 2.0,
                    "placeholder": True,
                }
                out.append((fdi, Vw.astype(np.float32), F, extras))
    return out


# ============================================================
# 6. 歯肉・歯槽骨
# ============================================================
def build_collar(jaw, teeth, kind):
    """歯列弓に沿った襟状メッシュ。kind = 'gingiva' | 'bone'"""
    quads = (1, 2) if jaw == "U" else (3, 4)
    pts = []   # (x, z, y_margin, width, fdi)
    for fdi, V, F, ex in teeth:
        if ex["quadrant"] not in quads:
            continue
        c = ex["centroid"]
        pts.append((ex["cej_y"], ex, c))

    # 弓に沿った順序 = 右8番 → 右1番 → 左1番 → 左8番
    order = [f for f in reversed(QUAD_ORDER[quads[0]])] + QUAD_ORDER[quads[1]]
    if jaw == "U":
        order = [f for f in reversed(QUAD_ORDER[1])] + QUAD_ORDER[2]
    else:
        order = [f for f in reversed(QUAD_ORDER[4])] + QUAD_ORDER[3]

    ex_by = {ex["fdi"]: ex for _, _, _, ex in teeth}
    ctrl = []
    for fdi in order:
        ex = ex_by[fdi]
        cx, cz = ex["centroid"][0], ex["centroid"][2]
        # 歯軸の頬側方向 (XZ 射影)
        bx, bz = ex["axis_buccal"][0], ex["axis_buccal"][2]
        n = math.hypot(bx, bz) or 1.0
        ctrl.append(dict(fdi=fdi, x=cx, z=cz, bx=bx / n, bz=bz / n,
                         w=ex["bl_width"] / 2.0, y=ex["cej_y"],
                         bone=ex["bone_level_mm"]))

    # 制御点をスプライン的に細分
    NS = 8
    samples = []
    for i in range(len(ctrl) - 1):
        A, B = ctrl[i], ctrl[i + 1]
        for k in range(NS):
            t = k / NS
            sm = t * t * (3 - 2 * t)
            s = {}
            for key in ("x", "z", "bx", "bz", "w", "y", "bone"):
                s[key] = A[key] * (1 - sm) + B[key] * sm
            # 歯間乳頭: 歯の中央で低く、歯間で高い(咬合方向へ)
            pap = math.sin(math.pi * t) ** 2
            s["pap"] = pap
            samples.append(s)
    samples.append({**ctrl[-1], "pap": 0.0})

    up = 1.0 if jaw == "U" else -1.0   # 根尖方向(=歯肉が広がる向き)
    occ = -up                          # 咬合方向

    if kind == "gingiva":
        # 歯根(最大17mm)を覆いきる深さにする。浅いと根尖が歯肉から突き出す。
        margin_off, drop, wpad = -2.2, 21.0, 1.0
        pap_h = 1.4
    else:
        margin_off, drop, wpad = 2.0, 17.0, 2.0
        pap_h = 0.9

    # 断面は閉じたループにする（上面のアーチ + 底面の戻り）。
    # 開いた板だと下から見たときに裏面が見え、法線の向きも検証できない。
    NPHI, NBOT = 14, 5
    NSEC = NPHI + NBOT           # 断面の頂点数（閉ループ）
    verts = []
    for s in samples:
        y_margin = s["y"] + up * (margin_off + (s["bone"] - 2.0 if kind == "bone" else 0.0)) \
                   + occ * pap_h * s["pap"]
        W = s["w"] + wpad
        y_base = y_margin + up * drop
        sec = []
        for j in range(NPHI):     # 頬側基部 → 歯頸部 → 舌側基部
            phi = math.pi * j / (NPHI - 1)
            lat = math.cos(phi)
            y = y_margin + up * drop * (1.0 - max(0.0, math.sin(phi)) ** 0.65)
            sec.append((lat * W, y))
        for j in range(1, NBOT + 1):   # 舌側基部 → 頬側基部（底面）
            t = j / (NBOT + 1)
            sec.append((-W + 2 * W * t, y_base))
        for (lat, y) in sec:
            verts.append((s["x"] + s["bx"] * lat, y, s["z"] + s["bz"] * lat))

    nring = len(samples)
    faces = []
    for i in range(nring - 1):
        for j in range(NSEC):
            j2 = (j + 1) % NSEC
            a = i * NSEC + j
            b = i * NSEC + j2
            c = (i + 1) * NSEC + j
            d = (i + 1) * NSEC + j2
            faces.append((a, c, d))
            faces.append((a, d, b))

    # 前後端を塞ぐ
    V = np.asarray(verts, np.float32)
    for ring, flip in ((0, False), (nring - 1, True)):
        base = ring * NSEC
        ctr = V[base:base + NSEC].mean(axis=0)
        ci = len(V)
        V = np.vstack([V, ctr[None, :].astype(np.float32)])
        for j in range(NSEC):
            j2 = (j + 1) % NSEC
            faces.append((ci, base + j2, base + j) if flip else (ci, base + j, base + j2))

    return orient_outward(V, np.asarray(faces, np.uint32))


def build_palate(jaw, teeth):
    """上顎は口蓋、下顎は口腔底。歯列弓の内側の穴を塞ぐ。"""
    quads = (1, 2) if jaw == "U" else (3, 4)
    ex_by = {ex["fdi"]: ex for _, _, _, ex in teeth}
    if jaw == "U":
        order = [f for f in reversed(QUAD_ORDER[1])] + QUAD_ORDER[2]
    else:
        order = [f for f in reversed(QUAD_ORDER[4])] + QUAD_ORDER[3]

    up = 1.0 if jaw == "U" else -1.0
    vault = 9.0 if jaw == "U" else 3.5

    rim = []
    for fdi in order:
        ex = ex_by[fdi]
        bx, bz = ex["axis_buccal"][0], ex["axis_buccal"][2]
        n = math.hypot(bx, bz) or 1.0
        bx, bz = bx / n, bz / n
        W = ex["bl_width"] / 2.0 + 1.0
        # 舌側やや基部寄りの点
        rim.append((ex["centroid"][0] - bx * W, ex["cej_y"] + up * 3.0,
                    ex["centroid"][2] - bz * W))

    # 制御点を細分
    NS = 6
    pts = []
    for i in range(len(rim) - 1):
        for k in range(NS):
            t = k / NS
            sm = t * t * (3 - 2 * t)
            pts.append(tuple(rim[i][j] * (1 - sm) + rim[i + 1][j] * sm for j in range(3)))
    pts.append(rim[-1])

    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[2] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)

    K = 6
    N = len(pts)
    verts = []
    for k in range(K):
        s = 1.0 - k / K
        dome = up * vault * math.sin(math.pi / 2 * (1 - s))
        for (x, y, z) in pts:
            verts.append((cx + (x - cx) * s, y * s + cy * (1 - s) + dome,
                          cz + (z - cz) * s))
    faces = []
    for i in range(K - 1):
        for j in range(N - 1):
            a = i * N + j
            b = i * N + j + 1
            c = (i + 1) * N + j
            d = (i + 1) * N + j + 1
            faces.append((a, c, d))
            faces.append((a, d, b))
    ci = len(verts)
    verts.append((cx, cy + up * vault, cz))
    base = (K - 1) * N
    for j in range(N - 1):
        faces.append((ci, base + j, base + j + 1))
    return np.asarray(verts, np.float32), np.asarray(faces, np.uint32)


# ============================================================
# 7. 法線と GLB 書き出し
# ============================================================
def vertex_normals(V, F):
    N = np.zeros_like(V, dtype=np.float64)
    p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    fn = np.cross(p1 - p0, p2 - p0)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    ln = np.linalg.norm(N, axis=1, keepdims=True)
    ln[ln == 0] = 1.0
    return (N / ln).astype(np.float32)


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []
        self.meshes = []
        self.nodes = []

    def _pad(self):
        while len(self.bin) % 4:
            self.bin.append(0)

    def _view(self, data, target):
        self._pad()
        off = len(self.bin)
        self.bin.extend(data)
        self.views.append({"buffer": 0, "byteOffset": off,
                           "byteLength": len(data), "target": target})
        return len(self.views) - 1

    def add_mesh(self, name, V, F, material):
        Vb = np.ascontiguousarray(V, np.float32)
        Nb = vertex_normals(Vb, F)
        Fb = np.ascontiguousarray(F, np.uint32)

        vv = self._view(Vb.tobytes(), 34962)
        self.accessors.append({"bufferView": vv, "componentType": 5126,
                               "count": int(len(Vb)), "type": "VEC3",
                               "min": [float(x) for x in Vb.min(axis=0)],
                               "max": [float(x) for x in Vb.max(axis=0)]})
        a_pos = len(self.accessors) - 1

        nv = self._view(Nb.tobytes(), 34962)
        self.accessors.append({"bufferView": nv, "componentType": 5126,
                               "count": int(len(Nb)), "type": "VEC3"})
        a_nrm = len(self.accessors) - 1

        iv = self._view(Fb.tobytes(), 34963)
        self.accessors.append({"bufferView": iv, "componentType": 5125,
                               "count": int(Fb.size), "type": "SCALAR"})
        a_idx = len(self.accessors) - 1

        self.meshes.append({"name": name, "primitives": [
            {"attributes": {"POSITION": a_pos, "NORMAL": a_nrm},
             "indices": a_idx, "material": material}]})
        return len(self.meshes) - 1

    def write(self, path, materials, scene_nodes, all_nodes):
        gltf = {
            "asset": {"version": "2.0", "generator": "YELLOW dental_arch_gen 0.1"},
            "scene": 0,
            "scenes": [{"nodes": scene_nodes}],
            "nodes": all_nodes,
            "meshes": self.meshes,
            "materials": materials,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(js) % 4:
            js += b" "
        self._pad()
        blob = bytes(self.bin)
        total = 12 + 8 + len(js) + 8 + len(blob)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(blob)
        return total


MATERIALS = [
    {"name": "enamel", "pbrMetallicRoughness": {
        "baseColorFactor": [0.949, 0.929, 0.894, 1.0],
        "metallicFactor": 0.0, "roughnessFactor": 0.35}},
    {"name": "gingiva", "doubleSided": True, "pbrMetallicRoughness": {
        "baseColorFactor": [0.898, 0.639, 0.627, 1.0],
        "metallicFactor": 0.0, "roughnessFactor": 0.75}},
    {"name": "bone", "alphaMode": "BLEND", "doubleSided": True,
     "pbrMetallicRoughness": {
        "baseColorFactor": [0.863, 0.835, 0.784, 0.35],
        "metallicFactor": 0.0, "roughnessFactor": 0.9}},
]


def main(out_path=None):
    if out_path is None:
        os.makedirs(DIST, exist_ok=True)
        out_path = os.path.join(DIST, "dental_template.glb")
    teeth = place_teeth()
    glb = GLB()
    nodes = []
    idx_of = {}

    for fdi, V, F, ex in teeth:
        mi = glb.add_mesh(f"tooth_{fdi}", V, F, 0)
        nodes.append({"name": f"tooth_{fdi}", "mesh": mi, "extras": ex})
        idx_of[f"tooth_{fdi}"] = len(nodes) - 1

    for jaw, suffix in (("U", "upper"), ("L", "lower")):
        for kind, mat in (("gingiva", 1), ("bone", 2)):
            V, F = build_collar(jaw, teeth, kind)
            name = f"{'gingiva' if kind == 'gingiva' else 'bone'}_{suffix}"
            mi = glb.add_mesh(name, V, F, mat)
            nodes.append({"name": name, "mesh": mi,
                          "extras": {"layer": kind, "jaw": jaw, "placeholder": True}})
            idx_of[name] = len(nodes) - 1
        pname = "palate_upper" if jaw == "U" else "floor_lower"
        V, F = build_palate(jaw, teeth)
        mi = glb.add_mesh(pname, V, F, 1)
        nodes.append({"name": pname, "mesh": mi,
                      "extras": {"layer": "gingiva", "jaw": jaw, "placeholder": True}})
        idx_of[pname] = len(nodes) - 1

    maxilla_children = [idx_of[f"tooth_{f}"] for f in QUAD_ORDER[1] + QUAD_ORDER[2]] + \
                       [idx_of["gingiva_upper"], idx_of["palate_upper"],
                        idx_of["bone_upper"]]
    mandible_children = [idx_of[f"tooth_{f}"] for f in QUAD_ORDER[3] + QUAD_ORDER[4]] + \
                        [idx_of["gingiva_lower"], idx_of["floor_lower"],
                         idx_of["bone_lower"]]
    nodes.append({"name": "maxilla", "children": maxilla_children,
                  "extras": {"group": "maxilla"}})
    i_max = len(nodes) - 1
    nodes.append({"name": "mandible", "children": mandible_children,
                  "extras": {"group": "mandible",
                             "hinge_point": [0.0, -12.0, -75.0],
                             "hinge_axis": [1.0, 0.0, 0.0],
                             "open_max_deg": 28.0}})
    i_man = len(nodes) - 1

    size = glb.write(out_path, MATERIALS, [i_max, i_man], nodes)

    tri = sum(a["count"] for a in glb.accessors if a["type"] == "SCALAR") // 3
    vtx = sum(a["count"] for a in glb.accessors
              if a["type"] == "VEC3" and "min" in a)
    print(f"[OK] {out_path}")
    print(f"     nodes={len(nodes)} meshes={len(glb.meshes)} "
          f"tri={tri:,} vtx={vtx:,} size={size/1024/1024:.2f} MB")
    return out_path, teeth


if __name__ == "__main__":
    main()
