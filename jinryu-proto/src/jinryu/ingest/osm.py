"""OSM XML（bbox タイル）→ 歩行者ネットワーク road_link ／ POI ／ 建物（PLATEAU 補完用）.

road_link(link_id, geom, u, v, length_m, highway_type, name, cost_m)
node(node_id, lon, lat)
"""

from __future__ import annotations

import glob
from collections import defaultdict

import geopandas as gpd
import numpy as np
import pandas as pd
from lxml import etree
from pyproj import Geod
from shapely.geometry import LineString, Point

from jinryu import config

GEOD = Geod(ellps="WGS84")


def _parse_tiles(osm_dir):
    nodes: dict[str, tuple[float, float]] = {}
    ways: dict[str, tuple[list[str], dict[str, str]]] = {}
    pois: list[dict] = []
    for f in sorted(glob.glob(str(osm_dir / "*.xml"))):
        for _, el in etree.iterparse(f, events=("end",), tag=("node", "way")):
            if el.tag == "node":
                nodes[el.get("id")] = (float(el.get("lon")), float(el.get("lat")))
                tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
                if tags.get("shop") or tags.get("amenity") or tags.get("tourism"):
                    pois.append(
                        {
                            "osm_id": el.get("id"),
                            "lon": nodes[el.get("id")][0],
                            "lat": nodes[el.get("id")][1],
                            "name": tags.get("name"),
                            "shop": tags.get("shop"),
                            "amenity": tags.get("amenity"),
                            "tourism": tags.get("tourism"),
                        }
                    )
            else:
                refs = [r.get("ref") for r in el.findall("nd")]
                tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
                ways[el.get("id")] = (refs, tags)
            el.clear()
    return nodes, ways, pois


def _walkable(tags: dict[str, str], cfg: dict) -> bool:
    hw = tags.get("highway")
    if not hw or hw in cfg["exclude_tags"]["highway"]:
        return False
    if hw not in cfg["highway_walkable"]:
        return False
    if tags.get("foot") == "no" or tags.get("access") in ("private", "no"):
        return False
    if tags.get("tunnel") == "yes" and hw not in ("footway", "pedestrian", "corridor"):
        return False
    return True


def build_network(osm_dir=None, bbox=None):
    """OSM から歩行者ネットワークを作る。共有ノード（交差点）で way を分割してリンク化."""
    osm_dir = osm_dir or config.paths().raw / "osm"
    cfg = config.coefficients()["assign"]
    bbox = bbox or config.bbox()
    nodes, ways, pois = _parse_tiles(osm_dir)
    if not ways:
        raise FileNotFoundError(f"{osm_dir} に OSM XML がありません（jinryu fetch --osm）")

    walk = {wid: (refs, tags) for wid, (refs, tags) in ways.items() if _walkable(tags, cfg)}
    deg: dict[str, int] = defaultdict(int)
    for refs, _ in walk.values():
        for i, r in enumerate(refs):
            deg[r] += 2 if i in (0, len(refs) - 1) else 1  # 端点は必ず分割点
    links = []
    for wid, (refs, tags) in walk.items():
        refs = [r for r in refs if r in nodes]
        if len(refs) < 2:
            continue
        seg: list[str] = [refs[0]]
        k = 0
        for r in refs[1:]:
            seg.append(r)
            if deg[r] >= 2:  # 交差点 or 端点で切る
                if len(seg) >= 2 and seg[0] != seg[-1] or len(seg) > 2:
                    coords = [nodes[s] for s in seg]
                    length = sum(
                        GEOD.inv(a[0], a[1], b[0], b[1])[2]
                        for a, b in zip(coords[:-1], coords[1:], strict=False)
                    )
                    hw = tags.get("highway")
                    pen = cfg["penalty"].get(hw, cfg["penalty"]["default"])
                    links.append(
                        {
                            "link_id": f"{wid}_{k}",
                            "u": seg[0],
                            "v": seg[-1],
                            "length_m": round(length, 1),
                            "cost_m": round(length * pen, 1),
                            "highway_type": hw,
                            "name": tags.get("name"),
                            "geometry": LineString(coords),
                        }
                    )
                    k += 1
                seg = [r]
    gdf = gpd.GeoDataFrame(links, geometry="geometry", crs="EPSG:4326")
    gdf = gdf[gdf.length_m > 0]
    gdf = gdf.cx[bbox[0] : bbox[2], bbox[1] : bbox[3]].reset_index(drop=True)
    # 最大連結成分のみ残す（孤立した歩道片を除く）
    gdf = _largest_component(gdf)
    used = set(gdf.u) | set(gdf.v)
    node_df = pd.DataFrame([{"node_id": n, "lon": nodes[n][0], "lat": nodes[n][1]} for n in used])
    poi_df = (
        gpd.GeoDataFrame(pois, geometry=[Point(p["lon"], p["lat"]) for p in pois], crs="EPSG:4326")
        if pois
        else gpd.GeoDataFrame()
    )
    if len(poi_df):
        poi_df = poi_df.cx[bbox[0] : bbox[2], bbox[1] : bbox[3]].reset_index(drop=True)
    return gdf, node_df, poi_df


def _largest_component(links: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    import scipy.sparse as sp
    from scipy.sparse.csgraph import connected_components

    ids = pd.Index(pd.unique(pd.concat([links.u, links.v])))
    ui = ids.get_indexer(links.u)
    vi = ids.get_indexer(links.v)
    m = sp.coo_matrix((np.ones(len(links)), (ui, vi)), shape=(len(ids), len(ids)))
    n, lab = connected_components(m, directed=False)
    big = np.bincount(lab).argmax()
    keep = lab[ui] == big
    return links[keep].reset_index(drop=True)
