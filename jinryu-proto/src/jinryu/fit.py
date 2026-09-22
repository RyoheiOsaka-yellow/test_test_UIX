"""実測通行量を教師に、OD の重み（集中係数・発生係数・距離抵抗）を推定する.

経路配分は「どの OD がどのリンクを通るか」が OD 重みに依存しないため、
  flow = M @ T        （M: リンク × (発生ゾーン, 集中ゾーン) の疎行列、T: OD 量）
と書ける。M を一度だけ展開しておけば、係数を変えるたびの評価が疎行列積 1 回で済む。
これにより数百〜数千回の反復最適化が現実的になる。
"""

from __future__ import annotations

from dataclasses import dataclass, field

import geopandas as gpd
import numpy as np
import scipy.sparse as sp

from jinryu import config
from jinryu.assign import build_network, shortest_tree
from jinryu.od import access_matrix, gateway_nodes, make_zones, walk_pois
from jinryu.pipeline import split_station_exits, station_nodes
from jinryu.units.build import nearest_node

# 集中側で係数を推定する用途クラス（住宅・工業は来訪先としては扱わない）
FIT_CLASSES = ("retail", "office", "public", "hotel", "mixed", "other")


@dataclass
class RouteModel:
    """経路展開済みのネットワーク。係数を変えても再計算不要な部分をすべて保持する."""

    links: gpd.GeoDataFrame
    zone_ids: list[str]
    M: sp.csr_matrix  # (n_links, n_origin*n_zone)
    dist: np.ndarray  # (n_origin, n_zone) ゾーン間の最短距離 m
    origin_idx: np.ndarray  # dist の行に対応する zone のインデックス
    pop_by_class: np.ndarray = field(default=None)  # (n_zone, n_class) 集中候補の滞在人口
    night_pop: np.ndarray = field(default=None)  # (n_zone,) 住宅系の深夜滞在人口
    poi_count: np.ndarray = field(default=None)  # (n_zone,)
    station_pax: np.ndarray = field(default=None)  # (n_zone,) 乗降客数
    ext_night: np.ndarray = field(default=None)  # (n_zone,) 外部ゾーンの夜間人口
    ext_day: np.ndarray = field(default=None)  # (n_zone,) 外部ゾーンの昼間人口
    under_len: np.ndarray = field(default=None)  # (n_zone,) 地下歩行路の長さ m（地下街の集中重み用）
    access: sp.csr_matrix = field(default=None)  # (n_links, n_zone) ゾーン到着を沿道リンクへ配分


def build_route_model(
    tables: dict,
    coef: dict | None = None,
    period: str | None = None,
    day_type: str = "weekday",
    max_distance_m: float | None = None,
) -> RouteModel:
    coef = coef or config.coefficients()
    period = period or config.area()["periods"]["baseline"]
    maxd = max_distance_m or coef["od"]["max_distance_m"]
    links, nodes = tables["road_link"], tables["node"]
    net = build_network(links)
    zones = make_zones(nodes, coef["od"]["zone_cell_m"])
    rep = zones.drop_duplicates("zone_id").set_index("zone_id").rep_node
    # リンクを間引いたネットワークでは代表ノードが消えることがあるので、生きているゾーンだけ残す
    alive = set(net.node_ids)
    zone_ids = sorted(z for z in rep.index if rep[z] in alive)
    zpos = {z: i for i, z in enumerate(zone_ids)}
    rep_idx = np.array([net.idx(rep[z]) for z in zone_ids])
    nz = len(zone_ids)

    rows, cols = [], []
    dist = np.full((nz, nz), np.inf)
    p2l = net.pair_to_link
    for i, oi in enumerate(rep_idx):
        d, pred = shortest_tree(net, int(oi), limit=maxd)
        dist[i] = d[rep_idx]
        for j, dj in enumerate(rep_idx):
            if i == j or not np.isfinite(d[dj]):
                continue
            node = int(dj)
            col = i * nz + j
            while node != oi:
                par = int(pred[node])
                if par < 0:
                    break
                r = p2l.get((par, node))
                if r is not None:
                    rows.append(r)
                    cols.append(col)
                node = par
    M = sp.csr_matrix((np.ones(len(rows), dtype=np.float32), (rows, cols)), shape=(len(links), nz * nz))

    # ゾーン属性（係数を変えても不変）
    b = tables["building"]
    b = b[b.in_bbox][["building_id", "usage_class", "node_id"]].merge(
        zones[["node_id", "zone_id"]], on="node_id", how="left"
    )
    bp = tables["building_pop"]
    bp = bp[(bp.period == period) & (bp.day_type == day_type)]
    day = bp[bp.time_band == coef["od"]["destination_time_band"]].set_index("building_id").pop_est
    night = bp[bp.time_band == "night"].set_index("building_id").pop_est
    pop_by_class = np.zeros((nz, len(FIT_CLASSES)))
    for k, cls in enumerate(FIT_CLASSES):
        sub = b[b.usage_class == cls]
        g = sub.building_id.map(day).fillna(0).groupby(sub.zone_id).sum()
        for z, v in g.items():
            if z in zpos:
                pop_by_class[zpos[z], k] = v
    res = b[b.usage_class.isin(["residential", "mixed"])]
    gn = res.building_id.map(night).fillna(0).groupby(res.zone_id).sum()
    night_pop = np.zeros(nz)
    for z, v in gn.items():
        if z in zpos:
            night_pop[zpos[z]] = v

    poi = walk_pois(tables.get("poi"))
    poi_count = np.zeros(nz)
    if poi is not None and len(poi):
        poi["node_id"], _ = nearest_node(
            nodes, poi.geometry.x.values, poi.geometry.y.values, config.epsg_plane()
        )
        gp = poi.merge(zones[["node_id", "zone_id"]], on="node_id", how="left").groupby("zone_id").size()
        for z, v in gp.items():
            if z in zpos:
                poi_count[zpos[z]] = v

    st = station_nodes(split_station_exits(tables["station"]), nodes, links, coef)
    st = st[st.passengers_per_day > 0].merge(zones[["node_id", "zone_id"]], on="node_id", how="left")
    station_pax = np.zeros(nz)
    for z, v in st.groupby("zone_id").passengers_per_day.sum().items():
        if z in zpos:
            station_pax[zpos[z]] = v

    # 外部ゾーン（bbox 外周メッシュ）
    ext_night = np.zeros(nz)
    ext_day = np.zeros(nz)
    mf = tables["mesh_flow"]
    if "in_core" in mf.columns:
        from jinryu.mesh import mesh3_code

        gw = gateway_nodes(links, nodes, config.bbox())
        if len(gw):
            gw = gw.copy()
            gw["mesh_code"] = [mesh3_code(la, lo) for la, lo in zip(gw.lat, gw.lon, strict=False)]
            gw = gw.merge(zones[["node_id", "zone_id"]], on="node_id", how="left")
            sub = mf[(~mf.in_core) & (mf.period == period) & (mf.day_type == day_type)]
            nmap = sub[sub.time_band == "night"].set_index("mesh_code").population
            dmap = sub[sub.time_band == coef["od"]["destination_time_band"]].set_index("mesh_code").population
            for mesh, grp in gw.groupby("mesh_code"):
                n = float(nmap.get(mesh, 0.0)) / len(grp)
                dd = float(dmap.get(mesh, 0.0)) / len(grp)
                for z in grp.zone_id:
                    if z in zpos:
                        ext_night[zpos[z]] += n
                        ext_day[zpos[z]] += dd

    from jinryu.od import underground_attraction

    ua = underground_attraction(links, zones, 1.0)
    under_len = np.zeros(nz)
    if len(ua):
        for z, v in ua.items():
            if z in zpos:
                under_len[zpos[z]] = float(v)

    access = access_matrix(links, zones, walk_pois(tables.get("poi")), zpos)

    return RouteModel(
        links=links,
        zone_ids=zone_ids,
        M=M,
        dist=dist,
        origin_idx=np.arange(nz),
        pop_by_class=pop_by_class,
        night_pop=night_pop,
        poi_count=poi_count,
        station_pax=station_pax,
        ext_night=ext_night,
        ext_day=ext_day,
        under_len=under_len,
        access=access,
    )


# パラメータ: FIT_CLASSES の集中係数 + poi + 駅発生 + 住宅発生 + 外部 + 半減距離
PARAM_NAMES = [f"dest_{c}" for c in FIT_CLASSES] + [
    "poi_weight",
    "station_weight",
    "resident_rate",
    "external_factor",
    "underground_weight",
    "half_distance_m",
]
DEFAULT_PARAMS = np.array([1.0, 1.0, 1.0, 1.0, 0.5, 1.0, 100.0, 0.5, 1.2, 0.35, 0.0, 450.0])
LOWER = np.array([0.0] * 6 + [0.0, 0.05, 0.1, 0.0, 0.0, 120.0])
UPPER = np.array([6.0] * 6 + [1500.0, 3.0, 5.0, 2.0, 400.0, 2000.0])


# 12 個 + 到着端（本番候補）。link_flow がそのまま受け取れる並びなので変換は要らない。
FULL_ACCESS_NAMES = [*PARAM_NAMES, "access_weight"]
FULL_ACCESS_DEFAULT = np.append(DEFAULT_PARAMS, 1.0)
FULL_ACCESS_LOWER = np.append(LOWER, 0.0)
FULL_ACCESS_UPPER = np.append(UPPER, 50.0)


# 絞り込み版。217 地点に対して 12 個は多すぎて、同じ当てはまりでまったく違う解が並ぶ。
# ・吸引側の全体倍率と発生側の全体倍率は順位に効かない（スケール k は後段の fit_scale が別に合わせる）
#   ので、小売 = 1、住宅発生率 = 1 に固定して自由度を 2 つ落とす。
# ・小売・オフィス以外の用途は実測で区別がつかなかったので 1 つにまとめる。
REDUCED_NAMES = [
    "dest_office",
    "dest_other",
    "poi_weight",
    "station_weight",
    "underground_weight",
    "half_distance_m",
]
REDUCED_DEFAULT = np.array([1.0, 1.0, 20.0, 0.5, 0.0, 450.0])
REDUCED_LOWER = np.array([0.0, 0.0, 0.0, 0.05, 0.0, 120.0])
REDUCED_UPPER = np.array([4.0, 4.0, 400.0, 3.0, 120.0, 1200.0])


def expand(x: np.ndarray) -> np.ndarray:
    """絞り込んだ 6 個を link_flow が受け取る 12 個に広げる（小売・住宅発生率・外部係数を 1 に固定）."""
    office, other, poi_w, st_w, und_w, half = (float(v) for v in x)
    return np.array([1.0, office, other, other, other, other, poi_w, st_w, 1.0, 1.0, und_w, half])


# 到着端の配分を入れる版（絞り込み + access_weight）
ACCESS_NAMES = [*REDUCED_NAMES, "access_weight"]
ACCESS_DEFAULT = np.append(REDUCED_DEFAULT, 1.0)
ACCESS_LOWER = np.append(REDUCED_LOWER, 0.0)
ACCESS_UPPER = np.append(REDUCED_UPPER, 50.0)


def expand_access(x: np.ndarray) -> np.ndarray:
    """絞り込み 6 個 + 到着端係数 → link_flow の 13 個."""
    return np.append(expand(x[:6]), float(x[6]))


def link_flow(rm: RouteModel, params: np.ndarray, max_distance_m: float = 2500.0) -> np.ndarray:
    """係数からリンク通行量（合成値）を計算する."""
    dest = np.asarray(params[:6], dtype=float)
    poi_w, st_w, res_rate, ext_f, und_w, half = (float(v) for v in params[6:12])
    attract = rm.pop_by_class @ dest + poi_w * rm.poi_count + st_w * rm.station_pax + ext_f * rm.ext_day
    if und_w and rm.under_len is not None:
        attract = attract + und_w * rm.under_len
    origins = res_rate * rm.night_pop + st_w * rm.station_pax + ext_f * res_rate * rm.ext_night
    f = np.exp(-np.log(2.0) * rm.dist / half)
    f[~np.isfinite(rm.dist) | (rm.dist > max_distance_m)] = 0.0
    W = f * attract[None, :]
    s = W.sum(axis=1)
    T = np.where(s[:, None] > 0, origins[:, None] * W / np.where(s[:, None] > 0, s[:, None], 1.0), 0.0)
    flow = 2.0 * (rm.M @ T.ravel().astype(np.float32))
    if len(params) > 12 and rm.access is not None and float(params[12]):
        flow = flow + 2.0 * float(params[12]) * (rm.access @ T.sum(axis=0).astype(np.float32))
    return flow


def params_to_coefficients(params: np.ndarray | dict, coef: dict | None = None) -> dict:
    """推定した係数を本番パイプラインの coefficients 辞書に反映した新しい辞書を返す.

    fit.link_flow の D / O の組み立ては od.zone_weights と 1 対 1 に対応させてあるので、
    そのまま対応する設定値に書き戻せる（検証済み: 手置き値で run_build と完全一致）。
    集中係数は downscale の在館係数 α とは別物で、「その用途へ来訪しやすいか」を表す。
    """
    import copy

    if isinstance(params, dict):
        params = np.array([params[n] for n in PARAM_NAMES], dtype=float)
    c = copy.deepcopy(coef or config.coefficients())
    dest = {cls: round(float(v), 4) for cls, v in zip(FIT_CLASSES, params[:6], strict=False)}
    c["od"]["dest_weight"] = dest
    c["od"]["mixed_dest_factor"] = dest.get("mixed", c["od"].get("mixed_dest_factor", 0.5))
    c["od"]["poi_weight"] = round(float(params[6]), 3)
    c["od"]["station_origin_weight"] = round(float(params[7]), 4)
    rate = round(float(params[8]), 4)
    c["od"]["residential_trip_rate"] = {"weekday": rate, "holiday": round(rate * 1.17, 4)}
    c["od"].setdefault("external", {})["origin_factor"] = round(float(params[9]), 4)
    c["od"]["external"]["dest_factor"] = round(float(params[9]), 4)
    c["od"]["underground_weight"] = round(float(params[10]), 3)
    c["od"]["half_distance_m"] = int(round(float(params[11])))
    c["od"]["fitted"] = True
    return c
