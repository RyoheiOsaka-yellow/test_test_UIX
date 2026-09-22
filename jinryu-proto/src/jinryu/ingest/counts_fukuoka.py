"""福岡市「歩行者交通量等調査」PDF → count_site / count_obs.

PDF（天神地上・天神地下・博多駅周辺・ウォーターフロント）は地図画像の上に、
  - 地点番号  : フォント HGPGothicE（地図上の実際の位置）
  - 値ラベル  : HGSoeiKakugothic の番号 ＋ 右隣の MS-PGothic の実測値
  - 縮尺バー  : HGPGothicE の大きい数字（0 / 50 / 100 / 200 / 300 と m）
がテキストとして載っている。地点の緯度経度は PDF に無いので、

  1. 縮尺バーから m/pt を求める（地図は北上・無回転）
  2. 地点群を OSM 歩行可能リンクに最も良く重なるよう平行移動・微小回転・縮尺を最適化

してページ座標→平面直角座標のアフィン変換を推定する。残差（地点から最寄り街路までの距離）
が数 m に収まることが、変換が正しいことの検証になる。値は 7:00–20:00 の 13 時間計。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pymupdf
from pyproj import Transformer
from scipy.optimize import minimize
from scipy.spatial import cKDTree
from shapely.geometry import Point

from jinryu import config

# ファイル・ページ → (地区コード, 地区名, 平休, 種別, 初期推定中心)
PAGES: list[tuple[str, int, str, str, str, str, tuple[float, float]]] = [
    ("r06_tenjin_walker", 0, "TJ", "天神地区（地上）", "weekday", "street", (130.3985, 33.5900)),
    ("r06_tenjin_walker", 2, "TJ", "天神地区（地上）", "holiday", "street", (130.3985, 33.5900)),
    ("r06_hakata_walker", 0, "HK", "博多駅周辺地区（地上）", "weekday", "street", (130.4205, 33.5900)),
    ("r06_hakata_walker", 2, "HK", "博多駅周辺地区（地上）", "holiday", "street", (130.4205, 33.5900)),
    ("r06_wf_walker", 0, "WF", "ウォーターフロント地区", "weekday", "street", (130.4020, 33.6050)),
    ("r06_wf_walker", 1, "WF", "ウォーターフロント地区", "holiday", "street", (130.4020, 33.6050)),
    ("r06_tenjin_under", 0, "TU", "天神地区（地下）", "weekday", "underground", (130.3990, 33.5900)),
    ("r06_tenjin_under", 1, "TU", "天神地区（地下）", "holiday", "underground", (130.3990, 33.5900)),
]
MIN_MARKS = 8  # これ未満のページ（今泉地区など）は変換が定まらないので飛ばす
OBS_PERIOD = "2024-11"  # 令和6年度調査。月は公表資料に明記が無いため名目値


@dataclass
class PageItems:
    marks: list[tuple[int, float, float]]  # (地点番号, x, y) 地図上の位置
    scale_ticks: list[tuple[int, float]]  # (メートル, x)
    values: dict[int, int]  # 地点番号 → 実測値


def read_page(path: Path, page: int) -> PageItems:
    pg = pymupdf.open(path)[page]
    marks: list[tuple[int, float, float]] = []
    ticks: list[tuple[int, float]] = []
    nums: list[tuple[int, float, float, float]] = []
    vals: list[tuple[int, float, float, float]] = []
    for blk in pg.get_text("dict")["blocks"]:
        for line in blk.get("lines", []):
            for sp in line["spans"]:
                t = sp["text"].strip()
                if not t:
                    continue
                font, size = sp["font"], round(sp["size"], 1)
                x0, y0, x1, y1 = sp["bbox"]
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                if font.startswith("HGPGothicE") and re.fullmatch(r"\d{1,3}", t):
                    (ticks.append((int(t), cx)) if size > 10 else marks.append((int(t), cx, cy)))
                elif font.startswith("HGSoeiKakugoth") and re.fullmatch(r"\d{1,3}", t):
                    nums.append((int(t), cx, cy, x1))
                elif font.startswith("MS-PGothic") and re.fullmatch(r"\d[\d,]*", t) and size < 9.5:
                    vals.append((int(t.replace(",", "")), cx, cy, x0))
    values: dict[int, int] = {}
    for no, _cx, cy, x1 in nums:  # 値ラベル: 番号のすぐ右に同じ高さで値がある
        near = [v for v in vals if abs(v[2] - cy) < 3.0 and 0 < v[3] - x1 < 8.0]
        if near:
            values[no] = near[0][0]
    return PageItems(marks=marks, scale_ticks=ticks, values=values)


def _road_tree(links: gpd.GeoDataFrame, step_m: float = 10.0) -> cKDTree:
    pts: list[tuple[float, float]] = []
    for geom in links.geometry:
        n = max(2, int(geom.length / step_m))
        pts += [geom.interpolate(i / n, normalized=True).coords[0] for i in range(n + 1)]
    return cKDTree(np.array(pts))


def _pca_axis(pts: np.ndarray) -> tuple[float, float]:
    """点群の主軸の向き（ラジアン）と、その軸方向の広がり（標準偏差）."""
    c = pts - pts.mean(axis=0)
    _, sv, vt = np.linalg.svd(c, full_matrices=False)
    ang = float(np.arctan2(vt[0, 1], vt[0, 0]))
    spread = float(sv[0] / np.sqrt(len(pts)))
    return ang, spread


def georeference(
    items: PageItems,
    tree: cKDTree,
    guess_lonlat: tuple[float, float],
    plane_epsg: int,
    target_pts: np.ndarray | None = None,
):
    """ページ座標 → 平面直角座標のアフィン変換を推定して (変換関数, 残差, パラメータ, 初期縮尺) を返す.

    縮尺バーがあるページはそこから m/pt を決め、回転 0（北上）を初期値に平行移動だけを探索する。
    縮尺バーが無いページ（天神地下）は、地点群と対象ネットワーク（地下リンク）の主軸・広がりを
    合わせて縮尺と回転の初期値を作り、回転・縮尺・平行移動をまとめて最適化する。
    """
    ticks = sorted(items.scale_ticks)
    zero = [x for m, x in ticks if m == 0]
    has_bar = bool(zero) and len(ticks) >= 2
    pts_page = np.array([[x, y] for _, x, y in items.marks])
    if has_bar:
        x_zero = zero[0]
        m_max, x_max = max(ticks)
        scale0 = m_max / (x_max - x_zero)  # m/pt
        rot_candidates = [0.0]
    else:
        if target_pts is None or len(target_pts) < 10:
            return None
        # 対象は調査範囲の近傍だけに絞る（全域の地下リンクを使うと広がりを過大評価して縮尺がずれる）
        fwd0 = Transformer.from_crs(4326, plane_epsg, always_xy=True)
        cx, cy = fwd0.transform(*guess_lonlat)
        near = target_pts[np.hypot(target_pts[:, 0] - cx, target_pts[:, 1] - cy) < 800]
        if len(near) < 10:
            near = target_pts
        target_pts = near
        flipped = pts_page * np.array([1.0, -1.0])  # PDF は y 下向き
        _, spread_p = _pca_axis(flipped)
        _, spread_t = _pca_axis(target_pts)
        scale0 = spread_t / max(spread_p, 1e-6)
        rot_candidates = list(np.radians(np.arange(0, 360, 15)))  # 地下図は回転しているので全周を探す

    pts = pts_page
    centre = pts.mean(axis=0)
    fwd = Transformer.from_crs(4326, plane_epsg, always_xy=True)
    if target_pts is not None and not has_bar:
        gx, gy = target_pts.mean(axis=0)
    else:
        gx, gy = fwd.transform(*guess_lonlat)

    def apply(params, query=None):
        q = pts if query is None else query
        de, dn, theta, scale = params
        cos, sin = np.cos(theta), np.sin(theta)
        dx = (q[:, 0] - centre[0]) * scale
        dy = -(q[:, 1] - centre[1]) * scale  # PDF は y 下向き
        return np.c_[gx + de + cos * dx - sin * dy, gy + dn + sin * dx + cos * dy]

    def cost(params):
        return float(np.median(tree.query(apply(params))[0]))

    # 縮尺バーがあるページでは縮尺と回転は既知（北上）なので固定し、平行移動だけを合わせる。
    # 縮尺を自由にすると 1% 程度のずれで地図の端の地点が隣の街路に乗り移り、結果が不安定になる。
    span, step = (500, 50) if has_bar else (350, 175)
    scales = [scale0] if has_bar else [scale0 * f for f in (0.6, 0.75, 0.9, 1.0, 1.15, 1.35)]
    grid = (
        (cost([de, dn, th, sc]), [de, dn, th, sc])
        for de in np.arange(-span, span + 1, step)
        for dn in np.arange(-span, span + 1, step)
        for th in rot_candidates
        for sc in scales
    )
    best = min(grid, key=lambda a: a[0])
    if has_bar:
        # 縮尺バーの値と北上を信用し、平行移動だけを合わせる。縮尺を自由にすると 1% 程度のずれで
        # 地図の端の地点が隣の街路に乗り移り、取り込みのたびに結果が変わってしまう。
        res = minimize(
            lambda v: cost([v[0], v[1], 0.0, scale0]),
            best[1][:2],
            method="Nelder-Mead",
            options={"maxiter": 4000, "xatol": 0.05, "fatol": 0.005},
        )
        params = np.array([res.x[0], res.x[1], 0.0, scale0])
    else:
        res = minimize(
            cost, best[1], method="Nelder-Mead", options={"maxiter": 8000, "xatol": 0.05, "fatol": 0.005}
        )
        params = np.asarray(res.x)
    resid = tree.query(apply(params))[0]
    return apply, resid, params, scale0


def build_fukuoka_counts(
    raw_dir: Path | None = None, links: gpd.GeoDataFrame | None = None, verbose: bool = True
):
    """→ (count_site GeoDataFrame, count_obs DataFrame, 変換の診断情報)."""
    raw_dir = raw_dir or config.paths().raw / "counts_fukuoka"
    if links is None:
        links = gpd.read_parquet(config.paths().table("road_link"))
    plane = config.epsg_plane()
    lv = links["level"] if "level" in links.columns else None
    surface = links[lv >= 0] if lv is not None else links
    under = links[lv < 0] if lv is not None else links.iloc[0:0]
    tree_surface = _road_tree(surface.to_crs(plane))
    tree_under = _road_tree(under.to_crs(plane)) if len(under) else None
    under_pts = np.array(tree_under.data) if tree_under is not None else None
    inv = Transformer.from_crs(plane, 4326, always_xy=True)

    transforms: dict[str, tuple] = {}
    site_rows: dict[str, dict] = {}
    obs_rows: list[dict] = []
    diags: list[dict] = []

    for stem, page, code, district, day_type, kind, guess in PAGES:
        path = raw_dir / f"{stem}.pdf"
        if not path.exists():
            continue
        items = read_page(path, page)
        if len(items.marks) < MIN_MARKS:
            continue
        tree = tree_under if kind == "underground" and tree_under is not None else tree_surface
        if code not in transforms:  # 地区ごとに1回だけ推定し、平日/休日で共有する
            fitted = georeference(
                items, tree, guess, plane, target_pts=under_pts if kind == "underground" else None
            )
            if fitted is None:
                if verbose:
                    print(f"  {district}: 座標の手がかりが足りず除外（{len(items.marks)}地点）")
                continue
            apply, resid, params, scale0 = fitted
            transforms[code] = (apply, params, scale0, tree)
            diags.append(
                {
                    "district": district,
                    "sites": len(items.marks),
                    "scale_bar_m_per_pt": round(scale0, 4),
                    "fitted_m_per_pt": round(params[3], 4),
                    "rotation_deg": round(float(np.degrees(params[2])), 3),
                    "resid_median_m": round(float(np.median(resid)), 1),
                    "resid_mean_m": round(float(resid.mean()), 1),
                    "resid_p90_m": round(float(np.percentile(resid, 90)), 1),
                }
            )
            if verbose:
                d = diags[-1]
                print(
                    f"  {district}: {d['sites']}地点 縮尺 {d['scale_bar_m_per_pt']}→{d['fitted_m_per_pt']} m/pt "
                    f"回転 {d['rotation_deg']}° 残差 中央値 {d['resid_median_m']}m / p90 {d['resid_p90_m']}m"
                )
        if code not in transforms:
            continue
        apply, params, _, tree = transforms[code]
        pts = np.array([[x, y] for _, x, y in items.marks])
        world = apply(params, pts)
        lon, lat = inv.transform(world[:, 0], world[:, 1])
        resid = tree.query(world)[0]
        for (no, _x, _y), lo, la, rs in zip(items.marks, lon, lat, resid, strict=False):
            sid = f"{code}-{no}"
            site_rows.setdefault(
                sid,
                {
                    "site_id": sid,
                    "sheet": "",
                    "name": f"{district} 地点{no}",
                    "direction": "",
                    "kind": kind,
                    "block": code,
                    "lat": round(float(la), 6),
                    "lon": round(float(lo), 6),
                    "active_from": OBS_PERIOD,
                    "geo_resid_m": round(float(rs), 1),
                    "note": f"PDF地図から座標推定（最寄り街路まで {rs:.0f}m）",
                },
            )
            if no in items.values:
                obs_rows.append(
                    {
                        "site_id": sid,
                        "period": OBS_PERIOD,
                        "day_type": day_type,
                        "time_band": "all",
                        "count": float(items.values[no]),
                        "n_days": 1,
                        "source": "fukuoka_city_survey_pdf",
                    }
                )

    sites = pd.DataFrame(site_rows.values())
    gdf = gpd.GeoDataFrame(sites, geometry=[Point(r.lon, r.lat) for r in sites.itertuples()], crs="EPSG:4326")
    return gdf, pd.DataFrame(obs_rows), pd.DataFrame(diags)
