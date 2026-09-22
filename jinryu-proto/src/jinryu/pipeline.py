"""make build: ①→②→③ を通して link_flow（合成値）を作る."""

from __future__ import annotations

import json
import time

import geopandas as gpd
import numpy as np
import pandas as pd
import typer

from jinryu import config
from jinryu.assign import accumulate, build_network, shortest_tree
from jinryu.downscale import downscale
from jinryu.od import external_zone_weights, gateway_nodes, gravity_row, make_zones, zone_weights
from jinryu.units.build import nearest_node


def load_tables():
    p = config.paths()
    t = {
        "mesh_flow": pd.read_parquet(p.table("mesh_flow")),
        "building": gpd.read_parquet(p.table("building")),
        "road_link": gpd.read_parquet(p.table("road_link")),
        "node": pd.read_parquet(p.table("node")),
        "station": gpd.read_parquet(p.table("station")),
        "poi": gpd.read_parquet(p.table("poi")) if p.table("poi").exists() else None,
    }
    return t


def split_station_exits(stations: gpd.GeoDataFrame) -> pd.DataFrame:
    """駅を出口点に分割（area.yaml: station_exits）。定義が無い駅は駅点そのまま."""
    ex = config.area().get("station_exits", {}) or {}
    rows = []
    for _, r in stations.iterrows():
        exits = ex.get(str(r["name"]))
        if exits:
            for e in exits:
                rows.append(
                    {
                        "station_id": f"{r.station_id}:{e['name']}",
                        "name": r["name"],
                        "line": r.line,
                        "passengers_per_day": r.passengers_per_day * e["share"],
                        "lon": e["lon"],
                        "lat": e["lat"],
                    }
                )
        else:
            rows.append(
                {
                    "station_id": r.station_id,
                    "name": r["name"],
                    "line": r.line,
                    "passengers_per_day": r.passengers_per_day,
                    "lon": r.geometry.x,
                    "lat": r.geometry.y,
                }
            )
    return pd.DataFrame(rows)


def run_build(
    periods: list[str] | None = None,
    coef: dict | None = None,
    write: bool = True,
    tables: dict | None = None,
    day_types: tuple[str, ...] = ("weekday", "holiday"),
    time_bands: tuple[str, ...] = ("day", "night", "all"),
    quiet: bool = False,
):
    coef = coef or config.coefficients()
    t = tables or load_tables()
    t0 = time.time()
    echo = (lambda *a, **k: None) if quiet else typer.echo
    periods = periods or sorted(t["mesh_flow"].period.unique().tolist())
    mesh_flow = t["mesh_flow"][t["mesh_flow"].period.isin(periods)]

    # ① 建物配分
    bpop = downscale(mesh_flow, t["building"], coef)
    echo(f"① building_pop rows={len(bpop)}  ({time.time() - t0:.1f}s)")

    # ネットワークとゾーン
    links = t["road_link"]
    net = build_network(links)
    nodes = t["node"]
    zones = make_zones(nodes, coef["od"]["zone_cell_m"])
    st = split_station_exits(t["station"])
    st["node_id"], _ = nearest_node(nodes, st.lon.values, st.lat.values, config.epsg_plane())
    st = st[st.passengers_per_day > 0]

    # ② OD 重み（全組合せ列を用意）
    combos = [(q, d, b) for q in periods for d in day_types for b in time_bands]
    gw = gateway_nodes(links, nodes, config.bbox())
    pois = t.get("poi")
    if pois is not None and len(pois):
        pois = pois[
            pois.shop.notna()
            | pois.amenity.isin(
                [
                    "restaurant",
                    "cafe",
                    "fast_food",
                    "bar",
                    "pub",
                    "bank",
                    "pharmacy",
                    "clinic",
                    "cinema",
                    "theatre",
                ]
            )
        ].copy()
        pois["node_id"], _ = nearest_node(
            nodes, pois.geometry.x.values, pois.geometry.y.values, config.epsg_plane()
        )
    zw_all = {}
    for c in combos:
        zw = zone_weights(t["building"], bpop, st, zones, *c, coef=coef, pois=pois, links=links)
        ext = external_zone_weights(t["mesh_flow"], gw, zones, *c, coef=coef)
        zw_all[c] = (
            pd.concat([zw, ext]).groupby(["zone_id", "rep_node"], as_index=False)[["O", "D"]].sum()
            if len(ext)
            else zw
        )
    zone_ids = sorted({z for zw in zw_all.values() for z in zw.zone_id})
    rep = pd.concat(zw_all.values()).drop_duplicates("zone_id").set_index("zone_id").rep_node
    zi = pd.Index(zone_ids)
    O = np.zeros((len(zi), len(combos)))  # noqa: E741
    D = np.zeros((len(zi), len(combos)))
    for k, c in enumerate(combos):
        zw = zw_all[c].set_index("zone_id")
        O[zi.get_indexer(zw.index), k] = zw.O.values
        D[zi.get_indexer(zw.index), k] = zw.D.values
    rep_idx = np.array([net.idx(rep[z]) for z in zone_ids])
    echo(f"② zones={len(zi)} combos={len(combos)}  ({time.time() - t0:.1f}s)")

    # ③ 経路配分（確率的配分の近似: 無摂動距離で OD を作り、コスト摂動した木 draws 本に同じ荷重を載せて平均）
    L = len(links)
    link_flow = np.zeros((L, len(combos)))
    half = coef["od"]["half_distance_m"]
    maxd = coef["od"]["max_distance_m"]
    n_nodes = len(net.node_ids)
    origins = np.where(O.sum(axis=1) > 0)[0]
    stoch = coef["assign"].get("stochastic", {"draws": 1, "cost_sigma": 0.0, "seed": 0})
    draws = max(1, int(stoch["draws"]))
    rng = np.random.default_rng(int(stoch.get("seed", 0)))
    nets = [net]
    for _ in range(draws - 1):
        noisy = links.copy()
        noisy["cost_m"] = links.cost_m.values * np.exp(rng.normal(0.0, float(stoch["cost_sigma"]), size=L))
        nets.append(build_network(noisy))
    for i in origins:
        dist, pred = shortest_tree(net, int(rep_idx[i]), limit=maxd)
        dz = dist[rep_idx]
        loads = np.zeros((n_nodes, len(combos)))
        for k in range(len(combos)):
            if O[i, k] <= 0:
                continue
            T = gravity_row(O[i, k], D[:, k], dz, half, maxd)
            np.add.at(loads[:, k], rep_idx, T)
        accumulate(net, dist, pred, loads, link_flow)
        for net_d in nets[1:]:
            dist_d, pred_d = shortest_tree(net_d, int(rep_idx[i]), limit=maxd * 1.5)
            accumulate(net_d, dist_d, pred_d, loads, link_flow)
    link_flow *= 2.0 / draws  # 往復・平均
    echo(f"③ assignment done: {len(origins)} origins × {draws} draws ({time.time() - t0:.1f}s)")

    rows = []
    for k, (q, d, b) in enumerate(combos):
        rows.append(
            pd.DataFrame(
                {
                    "link_id": links.link_id.values,
                    "period": q,
                    "day_type": d,
                    "time_band": b,
                    "flow_synth": link_flow[:, k].round(2),
                }
            )
        )
    lf = pd.concat(rows, ignore_index=True)
    if write:
        p = config.paths()
        p.processed.mkdir(parents=True, exist_ok=True)
        bpop.to_parquet(p.table("building_pop"), index=False)
        lf.to_parquet(p.table("link_flow_synth"), index=False)
        zones.to_parquet(p.table("zone"), index=False)
        with open(p.processed / "build_summary.json", "w", encoding="utf-8") as f:
            json.dump(
                {
                    "periods": periods,
                    "zones": len(zi),
                    "origins": int(len(origins)),
                    "links": L,
                    "elapsed_s": round(time.time() - t0, 1),
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        echo(f"saved building_pop / link_flow_synth → {p.processed}")
    return bpop, lf
