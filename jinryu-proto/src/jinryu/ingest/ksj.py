"""国土数値情報（駅別乗降客数 S12、用途地域 A29、地価公示 L01）の取り込み."""

from __future__ import annotations

import io
import shutil
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd

from jinryu import config


def _extract(zip_path: Path, dest: Path) -> Path:
    """cp932 のディレクトリ名が化けるので、メンバー名を ASCII 化しながら展開する."""
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name
            try:
                name.encode("ascii")
            except UnicodeEncodeError:
                name = name.encode("cp437").decode("cp932", errors="ignore")
            sub = "utf8" if "UTF-8" in info.filename else "sjis" if "Shift-JIS" in info.filename else ""
            out = dest / sub / name if sub else dest / name
            out.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(out, "wb") as dst:
                shutil.copyfileobj(src, dst)
    return dest


def stations(raw_dir=None, bbox=None) -> gpd.GeoDataFrame:
    """station(station_id, name, operator, line, passengers_per_day, geom). 同名・同事業者の複数路線は合算しない（路線別）."""
    raw_dir = raw_dir or config.paths().raw / "ksj"
    bbox = bbox or config.bbox()
    z = next(raw_dir.glob("S12-*_GML.zip"))
    with zipfile.ZipFile(z) as zf:
        member = [n for n in zf.namelist() if n.startswith("UTF-8/") and n.endswith(".geojson")][0]
        gdf = gpd.read_file(io.BytesIO(zf.read(member)))
    gdf = gdf.to_crs(4326).cx[bbox[0] : bbox[2], bbox[1] : bbox[3]].copy()
    # S12_0xx: 4列1組 (整備状況, 重複コード, 備考, 乗降客数)。最後の年度の乗降客数を末尾の数値列から取る
    num_cols = [c for c in gdf.columns if c.startswith("S12_") and gdf[c].dtype.kind in "if"]
    passenger_cols = [
        c for c in num_cols if int(c.split("_")[1]) >= 9 and (int(c.split("_")[1]) - 9) % 4 == 0
    ]
    latest = None
    for c in reversed(passenger_cols):
        if gdf[c].notna().any() and (gdf[c] > 0).any():
            latest = c
            break
    gdf["passengers_per_day"] = pd.to_numeric(gdf[latest], errors="coerce").fillna(0)
    # 重複（同一駅を複数路線で計上）フラグ S12_0xx 整備状況=1 を尊重せず、ここでは路線別にそのまま持つ
    out = gdf.rename(columns={"S12_001": "name", "S12_002": "operator", "S12_003": "line"})
    out["station_id"] = (
        out.get("S12_001c", pd.Series(range(len(out)), index=out.index)).astype(str)
        + "_"
        + out.line.astype(str)
    )
    out["geometry"] = out.geometry.representative_point()
    return out[["station_id", "name", "operator", "line", "passengers_per_day", "geometry"]].reset_index(
        drop=True
    )


def zoning(raw_dir=None, bbox=None) -> gpd.GeoDataFrame:
    """zoning(zone_code, zone_name, bcr, far, geom)."""
    raw_dir = raw_dir or config.paths().raw / "ksj"
    bbox = bbox or config.bbox()
    z = next(raw_dir.glob("A29-*_GML.zip"))
    dest = _extract(z, config.paths().interim / "ksj_a29")
    city = config.area()["area"]["city_codes"][0][:3] + "00"  # 33100 = 岡山市
    shp = list(dest.rglob(f"A29-*_{city}.shp")) or list(dest.rglob("A29-*.shp"))
    gdf = gpd.read_file(shp[0], encoding="cp932")
    gdf = gdf.to_crs(4326).cx[bbox[0] : bbox[2], bbox[1] : bbox[3]].copy()
    out = gdf.rename(
        columns={"A29_004": "zone_code", "A29_005": "zone_name", "A29_006": "bcr", "A29_007": "far"}
    )
    out["zone_code"] = out.zone_code.astype(str)
    return out[["zone_code", "zone_name", "bcr", "far", "geometry"]].reset_index(drop=True)


def land_price(raw_dir=None, bbox=None) -> gpd.GeoDataFrame:
    """land_price(point_id, price_yen_m2, address, use, geom)."""
    raw_dir = raw_dir or config.paths().raw / "ksj"
    bbox = bbox or config.bbox()
    z = next(raw_dir.glob("L01-*_GML.zip"))
    with zipfile.ZipFile(z) as zf:
        member = [n for n in zf.namelist() if n.endswith(".geojson")][0]
        gdf = gpd.read_file(io.BytesIO(zf.read(member)))
    gdf = gdf.to_crs(4326).cx[bbox[0] : bbox[2], bbox[1] : bbox[3]].copy()
    # L01 の列名は年度で変わる: 価格は L01_006 (2025版: 公示価格), 住所 L01_024 付近 → 数値列の最初を価格とみなす
    price_col = next(
        (
            c
            for c in gdf.columns
            if c.startswith("L01_") and gdf[c].dtype.kind in "if" and gdf[c].max() > 1000
        ),
        None,
    )
    str_cols = [c for c in gdf.columns if gdf[c].dtype == object and c.startswith("L01_")]
    addr_col = next((c for c in str_cols if gdf[c].astype(str).str.contains("岡山市").any()), None)
    out = pd.DataFrame(
        {
            "point_id": [f"L01_{i}" for i in range(len(gdf))],
            "price_yen_m2": pd.to_numeric(gdf[price_col], errors="coerce") if price_col else None,
            "address": gdf[addr_col].astype(str) if addr_col else None,
        }
    )
    return gpd.GeoDataFrame(out, geometry=gdf.geometry.values, crs="EPSG:4326").reset_index(drop=True)
