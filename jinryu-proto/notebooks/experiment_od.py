"""パラメータ実験: OD の集中重み（POI, 店舗併用住宅）と距離抵抗の組合せで Spearman を比較する.

uv run python notebooks/experiment_od.py
"""

import copy
import itertools
import time

import geopandas as gpd
import pandas as pd

from jinryu import config
from jinryu.calibrate import _obs_for_calibration, block_cv, evaluate, match_sites_to_links
from jinryu.pipeline import load_tables, run_build

coef0 = config.coefficients()
cfg = coef0["calibrate"]
p = config.paths()
tables = load_tables()
sites = gpd.read_parquet(p.table("count_site"))
obs = pd.read_parquet(p.table("count_obs"))
match = match_sites_to_links(sites, tables["road_link"], cfg["site_match_max_m"])
sites = sites.drop(
    columns=[c for c in ["link_id", "link_ids", "n_links", "match_dist_m"] if c in sites.columns]
).merge(match, on="site_id", how="left")
cal_obs = _obs_for_calibration(obs, sites, cfg)
baseline = config.area()["periods"]["baseline"]

rows = []
for poi_w, mixed, half, draws in itertools.product([0.0, 30.0, 100.0], [0.5, 1.0], [300, 600], [1]):
    c = copy.deepcopy(coef0)
    c["od"]["poi_weight"] = poi_w
    c["od"]["mixed_dest_factor"] = mixed
    c["od"]["half_distance_m"] = half
    c["assign"]["stochastic"]["draws"] = draws
    t = time.time()
    _, lf = run_build(periods=[baseline], coef=c, write=False, tables=tables)
    m, met, k = evaluate(lf, cal_obs, baseline)
    cv = block_cv(m)
    r = {
        "poi_w": poi_w,
        "mixed": mixed,
        "half": half,
        "draws": draws,
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
