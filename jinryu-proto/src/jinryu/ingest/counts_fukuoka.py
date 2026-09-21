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


def georeference(items: PageItems, tree: cKDTree, guess_lonlat: tuple[float, float], plane_epsg: int):
    """ページ座標 → 平面直角座標のアフィン変換を推定して (変換関数, 残差, パラメータ) を返す."""
    ticks = sorted(items.scale_ticks)
    zero = [x for m, x in ticks if m == 0]
    if not zero or len(ticks) < 2:
        return None  # 縮尺バーが文字として無いページ（天神地下）は座標を決められない
    x_zero = zero[0]
    m_max, x_max = max(ticks)
    scale0 = m_max / (x_max - x_zero)  # m/pt

    pts = np.array([[x, y] for _, x, y in items.marks])
    centre = pts.mean(axis=0)
    fwd = Transformer.from_crs(4326, plane_epsg, always_xy=True)
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

    grid = (
        (cost([de, dn, 0.0, scale0]), [de, dn, 0.0, scale0])
        for de in np.arange(-500, 501, 100)
        for dn in np.arange(-500, 501, 100)
    )
    best = min(grid, key=lambda a: a[0])
    res = minimize(
        cost, best[1], method="Nelder-Mead", options={"maxiter": 6000, "xatol": 0.05, "fatol": 0.005}
    )
    resid = tree.query(apply(res.x))[0]
    return apply, resid, res.x, scale0


def build_fukuoka_counts(
    raw_dir: Path | None = None, links: gpd.GeoDataFrame | None = None, verbose: bool = True
):
    """→ (count_site GeoDataFrame, count_obs DataFrame, 変換の診断情報)."""
    raw_dir = raw_dir or config.paths().raw / "counts_fukuoka"
    if links is None:
        links = gpd.read_parquet(config.paths().table("road_link"))
    plane = config.epsg_plane()
    tree = _road_tree(links.to_crs(plane))
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
        if code not in transforms:  # 地区ごとに1回だけ推定し、平日/休日で共有する
            fitted = georeference(items, tree, guess, plane)
            if fitted is None:
                if verbose:
                    print(f"  {district}: 縮尺バーが無く座標を決められないため除外（{len(items.marks)}地点）")
                continue
            apply, resid, params, scale0 = fitted
            transforms[code] = (apply, params, scale0)
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
        apply, params, _ = transforms[code]
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
