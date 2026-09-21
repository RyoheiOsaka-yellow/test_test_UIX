"""PLATEAU CityGML (bldg) → building テーブル.

building(building_id, geom, usage, usage_class, floors, height, footprint_area, gfa, zoning, mesh_code, name, src)
lod0RoofEdge（無ければ lod1Solid の底面）から平面ポリゴンを取る。
"""

from __future__ import annotations

import glob
import os

import geopandas as gpd
import numpy as np
import pandas as pd
from lxml import etree
from shapely.geometry import Polygon

from jinryu import config

NS = {
    "bldg": "http://www.opengis.net/citygml/building/2.0",
    "gml": "http://www.opengis.net/gml",
    "core": "http://www.opengis.net/citygml/2.0",
    "gen": "http://www.opengis.net/citygml/generics/2.0",
}
BLDG_TAG = "{http://www.opengis.net/citygml/building/2.0}Building"


def _text(el, path):
    v = el.find(path, NS)
    return None if v is None else v.text


def _uro_text(el, local):
    # uro のバージョン (3.0/3.1/...) に依存しないよう local-name で探す
    for c in el.iter():
        if etree.QName(c).localname == local:
            return c.text
    return None


def _first_ring(el) -> Polygon | None:
    for path in ("bldg:lod0RoofEdge", "bldg:lod0FootPrint", "bldg:lod1Solid"):
        g = el.find(path, NS)
        if g is None:
            continue
        pos = g.find(".//gml:posList", NS)
        if pos is None or not pos.text:
            continue
        vals = np.fromstring(pos.text, sep=" ")
        dim = 3 if len(vals) % 3 == 0 else 2
        pts = vals.reshape(-1, dim)
        if len(pts) < 4:
            continue
        # PLATEAU は lat lon (EPSG:6697) の順
        ring = [(float(p[1]), float(p[0])) for p in pts]
        try:
            poly = Polygon(ring)
            if poly.is_valid and poly.area > 0:
                return poly
            poly = poly.buffer(0)
            if not poly.is_empty:
                return poly
        except Exception:
            continue
    return None


def parse_file(path: str) -> list[dict]:
    rows = []
    mesh = os.path.basename(path).split("_")[0]
    for _, el in etree.iterparse(path, events=("end",), tag=BLDG_TAG):
        poly = _first_ring(el)
        if poly is not None:
            h = _text(el, "bldg:measuredHeight")
            rows.append(
                {
                    "building_id": _uro_text(el, "buildingID") or el.get("{http://www.opengis.net/gml}id"),
                    "gml_id": el.get("{http://www.opengis.net/gml}id"),
                    "usage": _text(el, "bldg:usage"),
                    "floors": _text(el, "bldg:storeysAboveGround"),
                    "height": None if h in (None, "-9999") else h,
                    "year_built": _text(el, "bldg:yearOfConstruction"),
                    "footprint_area_src": _uro_text(el, "buildingFootprintArea"),
                    "gfa_src": _uro_text(el, "totalFloorArea"),
                    "zoning_code_src": _uro_text(el, "districtsAndZonesType"),
                    "detailed_usage": _uro_text(el, "detailedUsage"),
                    "mesh_code": mesh,
                    "geometry": poly,
                }
            )
        el.clear()
        while el.getprevious() is not None:
            del el.getparent()[0]
    return rows


def build_building_table(bldg_dir=None, bbox=None) -> gpd.GeoDataFrame:
    bldg_dir = bldg_dir or config.paths().raw / "plateau" / "bldg"
    files = sorted(glob.glob(str(bldg_dir / "*_bldg_*.gml")))
    if not files:
        raise FileNotFoundError(f"{bldg_dir} に bldg GML がありません（jinryu fetch --plateau）")
    rows: list[dict] = []
    for f in files:
        rows.extend(parse_file(f))
    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")
    # メッシュ単位の質量保存のため bbox では切らず、対象メッシュの建物を全部持つ（in_bbox で区別）
    gdf = gdf.drop_duplicates("building_id").reset_index(drop=True)
    bbox = bbox or config.bbox()

    # 数値化・GFA 算出（延床 = 属性があれば優先、無ければ 建築面積 × 階数）
    plane = gdf.to_crs(config.epsg_plane())
    gdf["footprint_area"] = plane.geometry.area.round(1)
    gdf["height"] = pd.to_numeric(gdf.height, errors="coerce")
    gdf.loc[(gdf.height <= 0) | (gdf.height > 400), "height"] = np.nan
    uc = config.coefficients()["usage_class"]
    gdf["usage"] = gdf.usage.fillna("454")
    gdf["usage_class"] = gdf.usage.map(lambda u: uc.get(str(u), uc["default"]))
    # 階数: 9999 等の欠損コードは高さ/3.5m で推定、それも無ければ用途別既定値
    floors = pd.to_numeric(gdf.floors, errors="coerce")
    floors = floors.where((floors >= 1) & (floors <= 80))
    from_height = (gdf.height / 3.5).round().clip(lower=1)
    default_floors = gdf.usage_class.map({"residential": 2, "mixed": 2, "other": 1, "industrial": 1}).fillna(
        3
    )
    gdf["floors_is_estimated"] = floors.isna()
    gdf["floors"] = floors.fillna(from_height).fillna(default_floors).astype(int)
    # 延床: 属性が妥当（建築面積×階数の 0.3〜3 倍以内）なら採用、そうでなければ 建築面積×階数
    gfa_attr = pd.to_numeric(gdf.gfa_src, errors="coerce")
    est = gdf.footprint_area * gdf.floors
    ok = (gfa_attr > 0) & (gfa_attr >= est * 0.3) & (gfa_attr <= est * 3.0)
    gdf["gfa"] = gfa_attr.where(ok, est).round(1)
    gdf["gfa_is_estimated"] = ~ok
    gdf["centroid_lon"] = plane.geometry.centroid.to_crs(4326).x
    gdf["centroid_lat"] = plane.geometry.centroid.to_crs(4326).y
    gdf["in_bbox"] = (gdf.centroid_lon.between(bbox[0], bbox[2])) & (
        gdf.centroid_lat.between(bbox[1], bbox[3])
    )
    gdf["src"] = "plateau"
    cols = [
        "building_id",
        "gml_id",
        "usage",
        "usage_class",
        "detailed_usage",
        "floors",
        "height",
        "year_built",
        "footprint_area",
        "gfa",
        "gfa_is_estimated",
        "floors_is_estimated",
        "zoning_code_src",
        "mesh_code",
        "centroid_lon",
        "centroid_lat",
        "in_bbox",
        "src",
        "geometry",
    ]
    return gdf[cols]
