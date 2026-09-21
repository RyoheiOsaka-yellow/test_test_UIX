"""通行量調査 → count_site / count_obs テーブル.

count_site(site_id, name, kind, block, direction, geom, link_id[後付け])
count_obs(site_id, period(YYYY-MM), day_type, time_band, count, n_days, source)

岡山市 AIカメラ（xlsx, 日別24時間通行量）と、PDF 報告書の手入力 CSV（data/raw/counts_manual/*.csv）の2系統。
手入力 CSV の形式: site_id,period,day_type,time_band,count,n_days,source
"""

from __future__ import annotations

import datetime as dt
import glob
import re
from pathlib import Path

import geopandas as gpd
import openpyxl
import pandas as pd
from shapely.geometry import Point

from jinryu import config

JP_HOLIDAYS_EXTRA = set()  # 祝日は曜日列の '祝' 表記があれば使う。無い年は土日のみ休日扱い


def sites() -> gpd.GeoDataFrame:
    csv = config.paths().config / config.area().get("counts", {}).get("sites_csv", "count_sites_okayama.csv")
    if not csv.exists():
        return gpd.GeoDataFrame(
            {
                "site_id": [],
                "sheet": [],
                "name": [],
                "direction": [],
                "kind": [],
                "block": [],
                "lat": [],
                "lon": [],
                "active_from": [],
                "note": [],
            },
            geometry=[],
            crs="EPSG:4326",
        )
    df = pd.read_csv(csv, dtype=str)
    df["lat"] = df.lat.astype(float)
    df["lon"] = df.lon.astype(float)
    return gpd.GeoDataFrame(
        df, geometry=[Point(x, y) for x, y in zip(df.lon, df.lat, strict=False)], crs="EPSG:4326"
    )


def _excel_date(v) -> dt.date | None:
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, (int, float)):
        return (dt.datetime(1899, 12, 30) + dt.timedelta(days=float(v))).date()
    return None


def read_okayama_daily(path: Path, site_map: dict[str, str]) -> pd.DataFrame:
    """箇所別日別総通行量 (YYYYMMD.xlsx) → 日別レコード."""
    m = re.search(r"(\d{4})(\d{2})D\.xlsx$", path.name)
    period = f"{m.group(1)}-{m.group(2)}"
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = []
    for ws in wb.worksheets:
        site_id = site_map.get(str(ws.title).strip())
        if site_id is None:
            continue
        for r in ws.iter_rows(min_row=5, values_only=True):
            d = _excel_date(r[0])
            if d is None or d.strftime("%Y-%m") != period:
                continue
            cnt = r[2]
            if not isinstance(cnt, (int, float)):
                continue
            dow = str(r[1]) if r[1] is not None else ""
            holiday = d.weekday() >= 5 or "祝" in dow
            rows.append(
                {
                    "site_id": site_id,
                    "date": d,
                    "period": period,
                    "day_type": "holiday" if holiday else "weekday",
                    "count": float(cnt),
                    "male": r[3] if isinstance(r[3], (int, float)) else None,
                    "female": r[4] if isinstance(r[4], (int, float)) else None,
                }
            )
    return pd.DataFrame(rows)


def build_count_tables(raw_dir=None) -> tuple[gpd.GeoDataFrame, pd.DataFrame, pd.DataFrame]:
    raw_dir = raw_dir or config.paths().raw / config.area().get("counts", {}).get("raw_dir", "counts_okayama")
    site_gdf = sites()
    site_map = dict(zip(site_gdf.sheet, site_gdf.site_id, strict=False))
    daily = (
        pd.concat(
            [read_okayama_daily(Path(p), site_map) for p in sorted(glob.glob(str(raw_dir / "*D.xlsx")))],
            ignore_index=True,
        )
        if glob.glob(str(raw_dir / "*D.xlsx"))
        else pd.DataFrame()
    )
    obs = []
    if len(daily):
        g = (
            daily.groupby(["site_id", "period", "day_type"])
            .agg(count=("count", "mean"), n_days=("count", "size"))
            .reset_index()
        )
        g_all = (
            daily.groupby(["site_id", "period"])
            .agg(count=("count", "mean"), n_days=("count", "size"))
            .reset_index()
        )
        g_all["day_type"] = "all"
        obs.append(pd.concat([g, g_all]))
    # 手入力 CSV（PDF 報告書など）
    manual_dir = config.paths().raw / "counts_manual"
    for p in glob.glob(str(manual_dir / "*.csv")):
        m = pd.read_csv(p, dtype={"site_id": str, "period": str})
        m["source"] = m.get("source", Path(p).stem)
        obs.append(m)
    obs_df = (
        pd.concat(obs, ignore_index=True)
        if obs
        else pd.DataFrame(columns=["site_id", "period", "day_type", "time_band", "count", "n_days", "source"])
    )
    obs_df["time_band"] = obs_df.get("time_band", pd.Series(["all"] * len(obs_df))).fillna("all")
    obs_df["source"] = obs_df.get("source", pd.Series(["okayama_ai_camera"] * len(obs_df))).fillna(
        "okayama_ai_camera"
    )
    obs_df["count"] = obs_df["count"].round(1)
    return (
        site_gdf,
        obs_df[["site_id", "period", "day_type", "time_band", "count", "n_days", "source"]],
        daily,
    )
