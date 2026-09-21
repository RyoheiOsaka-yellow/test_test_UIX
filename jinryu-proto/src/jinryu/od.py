"""② OD 生成（重力モデル、発生制約型）.

発生点 O_i : 駅（乗降客数×係数）＋ 住宅系建物（深夜滞在人口×トリップ率）
集中点 D_j : 商業・業務・公共・宿泊系建物（時間帯別滞在人口）＋ 駅
T_ij = O_i × D_j f(d_ij) / Σ_j D_j f(d_ij),  f(d) = exp(-ln2 · d / half_distance)
発生・集中点はネットワークノードに寄せ、さらに zone_cell_m のグリッドで集約する（経路配分の計算量削減）。
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from pyproj import Transformer

from jinryu import config

DEST_CLASSES = ("retail", "office", "public", "hotel", "mixed", "other")
BAND_ORIGIN_FACTOR = {"day": 0.45, "night": 0.03, "all": 1.0}  # 時間帯ごとの発生量スケール（相対値）


def make_zones(nodes: pd.DataFrame, cell_m: float | None = None) -> pd.DataFrame:
    """node → zone_id（グリッドセル）。各ゾーンの代表ノードはセル中心に最も近いノード."""
    cell_m = cell_m or config.coefficients()["od"]["zone_cell_m"]
    tr = Transformer.from_crs(4326, config.epsg_plane(), always_xy=True)
    x, y = tr.transform(nodes.lon.values, nodes.lat.values)
    cx, cy = np.floor(x / cell_m).astype(int), np.floor(y / cell_m).astype(int)
    z = pd.DataFrame(
        {
            "node_id": nodes.node_id.values,
            "x": x,
            "y": y,
            "zone_id": [f"{a}_{b}" for a, b in zip(cx, cy, strict=False)],
        }
    )
    z["dx"] = (z.x - (cx + 0.5) * cell_m) ** 2 + (z.y - (cy + 0.5) * cell_m) ** 2
    rep = (
        z.sort_values("dx")
        .drop_duplicates("zone_id")[["zone_id", "node_id"]]
        .rename(columns={"node_id": "rep_node"})
    )
    return z[["node_id", "zone_id"]].merge(rep, on="zone_id")


def zone_weights(
    buildings: pd.DataFrame,
    building_pop: pd.DataFrame,
    stations: pd.DataFrame,
    zones: pd.DataFrame,
    period: str,
    day_type: str,
    time_band: str,
    coef: dict | None = None,
    pois: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """zone ごとの O（発生）と D（集中）を返す。列: zone_id, rep_node, O, D."""
    coef = coef or config.coefficients()
    od = coef["od"]
    b = buildings[buildings.in_bbox][["building_id", "usage_class", "node_id"]].merge(
        zones[["node_id", "zone_id"]], on="node_id", how="left"
    )
    bp = building_pop[building_pop.period == period]
    night = bp[(bp.day_type == day_type) & (bp.time_band == "night")].set_index("building_id").pop_est
    dest_band = time_band if time_band != "all" else od["destination_time_band"]
    dayp = bp[(bp.day_type == day_type) & (bp.time_band == dest_band)].set_index("building_id").pop_est

    rate = od["residential_trip_rate"][day_type if day_type != "all" else "weekday"]
    b["O"] = np.where(
        b.usage_class.isin(["residential", "mixed"]), b.building_id.map(night).fillna(0) * rate, 0.0
    )
    b["D"] = np.where(b.usage_class.isin(DEST_CLASSES), b.building_id.map(dayp).fillna(0), 0.0)
    # 用途別の集中係数（推定値があれば使う。無ければ mixed のみ従来の係数）
    dw = od.get("dest_weight")
    if dw:
        b["D"] *= b.usage_class.map(dw).fillna(1.0).values
    else:
        b.loc[b.usage_class == "mixed", "D"] *= od.get("mixed_dest_factor", 0.5)
    zw = b.groupby("zone_id")[["O", "D"]].sum()
    # POI（店舗・飲食）密度による追加集中: 小規模店舗が密集するアーケード等を補う
    pw = od.get("poi_weight", 0.0)
    if pw and pois is not None and len(pois) and "node_id" in pois.columns:
        pz = (
            pois.merge(zones[["node_id", "zone_id"]], on="node_id", how="left").groupby("zone_id").size() * pw
        )
        pz = pz * (BAND_ORIGIN_FACTOR[time_band] if time_band != "all" else 1.0)
        zw["D"] = zw["D"].add(pz, fill_value=0.0)

    # 駅: 乗降客数 → 発生・集中の両方
    st = stations.copy()
    hf = od["station_holiday_factor"] if day_type == "holiday" else 1.0
    st["O"] = st.passengers_per_day * od["station_origin_weight"] * hf
    st["D"] = st["O"]
    st = st.merge(zones[["node_id", "zone_id"]], on="node_id", how="left")
    zw = zw.add(st.groupby("zone_id")[["O", "D"]].sum(), fill_value=0.0)
    zw["O"] *= BAND_ORIGIN_FACTOR[time_band]
    zw = zw.reset_index().merge(zones[["zone_id", "rep_node"]].drop_duplicates("zone_id"), on="zone_id")
    return zw[(zw.O > 0) | (zw.D > 0)].reset_index(drop=True)


def gateway_nodes(links: pd.DataFrame, nodes: pd.DataFrame, bbox) -> pd.DataFrame:
    """bbox の外側にある端点（境界を越えるリンクの外側ノード）= 外部ゾーンの接続点."""
    x0, y0, x1, y1 = bbox
    n = nodes.set_index("node_id")
    outside = ~(n.lon.between(x0, x1) & n.lat.between(y0, y1))
    cand = set(n.index[outside])
    used = set(links.u) | set(links.v)
    g = n.loc[sorted(cand & used)].reset_index()
    return g[["node_id", "lon", "lat"]]


def external_zone_weights(
    mesh_flow: pd.DataFrame,
    gateways: pd.DataFrame,
    zones: pd.DataFrame,
    period: str,
    day_type: str,
    time_band: str,
    coef: dict,
) -> pd.DataFrame:
    """外周メッシュの滞在人口を、そのメッシュ内（無ければ最寄り）の境界ノードに等分して O/D にする."""
    from jinryu.mesh import mesh3_code

    ext = coef["od"].get("external", {})
    if not ext.get("enabled") or "in_core" not in mesh_flow.columns or len(gateways) == 0:
        return pd.DataFrame(columns=["zone_id", "rep_node", "O", "D"])
    mf = mesh_flow[(~mesh_flow.in_core) & (mesh_flow.period == period) & (mesh_flow.day_type == day_type)]
    night = mf[mf.time_band == "night"].set_index("mesh_code").population
    dest_band = time_band if time_band != "all" else coef["od"]["destination_time_band"]
    dayp = mf[mf.time_band == dest_band].set_index("mesh_code").population
    rate = coef["od"]["residential_trip_rate"][day_type if day_type != "all" else "weekday"]
    g = gateways.copy()
    g["mesh_code"] = [mesh3_code(la, lo) for la, lo in zip(g.lat, g.lon, strict=False)]
    rows = []
    for mesh in set(night.index) | set(dayp.index):
        gw = g[g.mesh_code == mesh]
        if len(gw) == 0:
            continue  # 境界ノードを持たない外周メッシュは無視（さらに外側）
        o = (
            float(night.get(mesh, 0.0))
            * rate
            * ext["origin_factor"]
            * BAND_ORIGIN_FACTOR[time_band]
            / len(gw)
        )
        d = float(dayp.get(mesh, 0.0)) * ext["dest_factor"] / len(gw)
        for nid in gw.node_id:
            rows.append({"node_id": nid, "O": o, "D": d})
    if not rows:
        return pd.DataFrame(columns=["zone_id", "rep_node", "O", "D"])
    df = pd.DataFrame(rows).merge(zones[["node_id", "zone_id", "rep_node"]], on="node_id", how="left")
    return df.groupby(["zone_id", "rep_node"], as_index=False)[["O", "D"]].sum()


def gravity_row(
    o: float, d: np.ndarray, dist: np.ndarray, half_distance_m: float, max_distance_m: float
) -> np.ndarray:
    """1つの発生点 i から各集中点 j へのトリップ T_ij."""
    f = np.exp(-np.log(2.0) * dist / half_distance_m)
    f[~np.isfinite(dist) | (dist > max_distance_m)] = 0.0
    w = d * f
    s = w.sum()
    return o * w / s if s > 0 else np.zeros_like(w)
