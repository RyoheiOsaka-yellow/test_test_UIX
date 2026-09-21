"""単位テーブルの統合: 建物にメッシュ・用途地域を付与し、リンクとノードを確定する."""

from __future__ import annotations

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

from jinryu import config
from jinryu.mesh import mesh3_code


def attach_mesh_and_zoning(buildings: gpd.GeoDataFrame, zoning: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    b = buildings.copy()
    # メッシュ境界をまたぐ建物は重心で帰属（仕様 5.2）
    b["mesh_code"] = [mesh3_code(la, lo) for la, lo in zip(b.centroid_lat, b.centroid_lon, strict=False)]
    pts = gpd.GeoDataFrame(
        b[["building_id"]],
        geometry=[Point(x, y) for x, y in zip(b.centroid_lon, b.centroid_lat, strict=False)],
        crs="EPSG:4326",
    )
    j = gpd.sjoin(pts, zoning[["zone_code", "zone_name", "geometry"]], how="left", predicate="within")
    j = j[~j.index.duplicated()]
    b["zoning"] = j.zone_code.values
    b["zoning_name"] = j.zone_name.values
    b["zoning"] = b.zoning.fillna(b.zoning_code_src.astype(str)).fillna("unknown")
    return b


def nearest_node(
    nodes: pd.DataFrame, lons: np.ndarray, lats: np.ndarray, plane_epsg: int
) -> tuple[np.ndarray, np.ndarray]:
    """各点に最も近いネットワークノード（平面座標で KD-tree）."""
    from pyproj import Transformer
    from scipy.spatial import cKDTree

    tr = Transformer.from_crs(4326, plane_epsg, always_xy=True)
    nx, ny = tr.transform(nodes.lon.values, nodes.lat.values)
    px, py = tr.transform(lons, lats)
    tree = cKDTree(np.c_[nx, ny])
    d, i = tree.query(np.c_[px, py])
    return nodes.node_id.values[i], d


def attach_nodes(buildings: gpd.GeoDataFrame, nodes: pd.DataFrame) -> gpd.GeoDataFrame:
    b = buildings.copy()
    nid, d = nearest_node(nodes, b.centroid_lon.values, b.centroid_lat.values, config.epsg_plane())
    b["node_id"] = nid
    b["node_dist_m"] = d.round(1)
    return b


def front_link(buildings: gpd.GeoDataFrame, links: gpd.GeoDataFrame, max_m: float = 60.0) -> pd.Series:
    """建物の前面リンク: 建物ポリゴンに最も近い（歩ける）リンク."""
    plane = config.epsg_plane()
    b = buildings[["building_id", "geometry"]].to_crs(plane)
    l_ = links[["link_id", "geometry"]].to_crs(plane)
    j = gpd.sjoin_nearest(b, l_, how="left", max_distance=max_m, distance_col="front_dist_m")
    j = j[~j.index.duplicated()]
    return pd.DataFrame(
        {"front_link_id": j.link_id.values, "front_dist_m": j.front_dist_m.round(1).values},
        index=buildings.index,
    )
