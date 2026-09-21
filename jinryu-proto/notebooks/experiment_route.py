"""経路選好（アーケード選好）とスクリーンライン幅の実験."""

import copy
import itertools
import time

import geopandas as gpd
import pandas as pd

from jinryu import config
from jinryu.calibrate import _obs_for_calibration, block_cv, evaluate, match_sites_to_links
from jinryu.ingest.osm import build_network as osm_network
from jinryu.pipeline import load_tables, run_build

coef0 = config.coefficients()
cfg = coef0["calibrate"]
p = config.paths()
tables = load_tables()
sites0 = gpd.read_parquet(p.table("count_site"))
obs = pd.read_parquet(p.table("count_obs"))
baseline = config.area()["periods"]["baseline"]
rows = []
for ped_pen, width in itertools.product([0.9, 0.75, 0.6], [40, 60]):
    c = copy.deepcopy(coef0)
    c["assign"]["penalty"]["pedestrian"] = ped_pen
    # ペナルティはリンク cost_m に焼き込まれているので再生成
    links, nodes, _ = osm_network.__wrapped__() if hasattr(osm_network, "__wrapped__") else (None, None, None)
    t = time.time()
    tl = dict(tables)
    import jinryu.ingest.osm as osmmod

    orig = config.coefficients
    config.coefficients = (lambda cc: lambda: cc)(c)
    try:
        links, nodes, _ = osmmod.build_network()
    finally:
        config.coefficients = orig
    tl["road_link"] = links
    tl["node"] = nodes
    match = match_sites_to_links(sites0, links, width)
    sites = sites0.drop(
        columns=[x for x in ["link_id", "link_ids", "n_links", "match_dist_m"] if x in sites0.columns]
    ).merge(match, on="site_id", how="left")
    cal_obs = _obs_for_calibration(obs, sites, cfg)
    _, lf = run_build(periods=[baseline], coef=c, write=False, tables=tl)
    m, met, k = evaluate(lf, cal_obs, baseline)
    cv = block_cv(m)
    r = {
        "ped_pen": ped_pen,
        "width": width,
        "sp": met["spearman"],
        "sp_cv": cv["spearman"],
        "mape": met["mape"],
        "top20": met["top20_hit"],
        "s": round(time.time() - t),
    }
    rows.append(r)
    print(r, flush=True)
    print(
        m[m.day_type == "weekday"][["site_id", "count", "flow_synth", "pred"]]
        .round(0)
        .to_string(index=False),
        flush=True,
    )
print(pd.DataFrame(rows).sort_values("sp_cv", ascending=False).to_string(index=False))
