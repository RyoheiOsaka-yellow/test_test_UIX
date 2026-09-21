"""福岡 219 地点を教師に、経路配分の広がり（確率的配分）とスクリーンライン条件を評価する.

JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_assign_fukuoka.py
"""

import copy
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
sites0 = gpd.read_parquet(p.table("count_site")).drop(
    columns=[
        c
        for c in ["link_id", "link_ids", "n_links", "street_bearing_deg", "match_dist_m"]
        if c in gpd.read_parquet(p.table("count_site")).columns
    ]
)
obs = pd.read_parquet(p.table("count_obs"))
baseline = config.area()["periods"]["baseline"]
match = match_sites_to_links(sites0, tables["road_link"], cfg["site_match_max_m"])
sites = sites0.merge(match, on="site_id", how="left")
cal_obs = _obs_for_calibration(obs, sites, cfg)
print(f"教師 {cal_obs.site_id.nunique()} 地点 / {len(cal_obs)} 観測")

rows = []
for draws, sigma in [(1, 0.0), (3, 0.25), (5, 0.4), (8, 0.6), (12, 0.8)]:
    c = copy.deepcopy(coef0)
    c["assign"]["stochastic"] = {"draws": draws, "cost_sigma": sigma, "seed": 42}
    t = time.time()
    _, lf = run_build(periods=[baseline], coef=c, write=False, tables=tables)
    m, met, k = evaluate(lf, cal_obs, baseline)
    cv = block_cv(m)
    zero = float((m.flow_synth == 0).mean())
    r = {
        "draws": draws,
        "sigma": sigma,
        "spearman": met["spearman"],
        "cv": cv["spearman"],
        "mape": met["mape"],
        "top20": met["top20_hit"],
        "zero_share": round(zero, 3),
        "sec": round(time.time() - t),
    }
    rows.append(r)
    print(r, flush=True)
print(pd.DataFrame(rows).sort_values("cv", ascending=False).to_string(index=False))
