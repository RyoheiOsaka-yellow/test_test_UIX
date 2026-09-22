"""地下歩行空間をモデルに入れる効果を測る A/B.

A: 地下通路・地下街を含むネットワーク（地上の調査地点は地上リンクにのみ対応させる）
B: 地下リンクを除いたネットワーク

どちらも同じ手順で係数を再学習し、学習に使っていない地区で順位相関を比べる。
JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_underground.py
"""

import os
import time

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from jinryu import config, fit
from jinryu.calibrate import _obs_for_calibration, match_sites_to_links
from jinryu.pipeline import load_tables


def teacher_for(links, sites_raw, obs, cfg):
    match = match_sites_to_links(sites_raw, links, cfg["site_match_max_m"])
    sites = sites_raw.merge(match, on="site_id", how="left")
    cal = _obs_for_calibration(obs, sites, cfg)
    cal = cal[cal.day_type == "weekday"].copy()
    order = {lid: i for i, lid in enumerate(links.link_id)}
    cal["rows"] = [
        np.array([order[x] for x in str(v).split(",") if x in order], dtype=int) for v in cal.link_ids
    ]
    return cal


def predict(flow, cal):
    return np.array([flow[r].sum() if len(r) else 0.0 for r in cal["rows"]])


def sp(flow, cal):
    p = predict(flow, cal)
    return round(float(spearmanr(cal["count"], p).correlation), 3)


def fit_on(rm, cal, seed=5, maxiter=40, popsize=9):
    from scipy.optimize import differential_evolution

    obs = cal["count"].values

    def loss(x):
        p = predict(fit.link_flow(rm, x), cal)
        if p.max() <= 0:
            return 10.0
        r = spearmanr(obs, p).correlation
        return -(r if r == r else -1.0) + 0.30 * float((p <= 0).mean())

    res = differential_evolution(
        loss,
        list(zip(fit.LOWER, fit.UPPER, strict=False)),
        seed=seed,
        maxiter=maxiter,
        popsize=popsize,
        tol=1e-4,
        polish=True,
        x0=fit.DEFAULT_PARAMS,
        init="sobol",
    )
    return res.x


def main():
    cfg = config.coefficients()["calibrate"]
    tables = load_tables()
    tables["building_pop"] = pd.read_parquet(config.paths().table("building_pop"))
    sites_raw = gpd.read_parquet(config.paths().table("count_site"))
    sites_raw = sites_raw.drop(
        columns=[
            c
            for c in ["link_id", "link_ids", "n_links", "street_bearing_deg", "match_dist_m"]
            if c in sites_raw.columns
        ]
    )
    obs = pd.read_parquet(config.paths().table("count_obs"))
    full = tables["road_link"]
    under = full[full["level"] < 0]
    print(f"全リンク {len(full)} / 地下 {len(under)} 本 {under.length_m.sum():.0f}m")

    rows = []
    only = os.environ.get("AB_ONLY", "")
    variants = [("A 地下あり", full), ("B 地下なし", full[full["level"] >= 0].reset_index(drop=True))]
    if only:
        variants = [v for v in variants if v[0].startswith(only)]
    for label, links in variants:
        t = dict(tables)
        t["road_link"] = links
        used = set(links.u) | set(links.v)
        t["node"] = tables["node"][tables["node"].node_id.isin(used)].reset_index(drop=True)
        rm = fit.build_route_model(t)
        cal = teacher_for(links, sites_raw, obs, cfg)
        base_all = sp(fit.link_flow(rm, fit.DEFAULT_PARAMS), cal)
        print(f"\n{label}: リンク {len(links)}  教師 {len(cal)}  手置き係数での全体 spearman={base_all}")
        for tr_b, te_b in [("TJ", "HK"), ("HK", "TJ")]:
            tr, te = cal[cal.block == tr_b], cal[cal.block == te_b]
            t0 = time.time()
            x = fit_on(rm, tr)
            flow = fit.link_flow(rm, x)
            r = {
                "model": label,
                "train": tr_b,
                "test": te_b,
                "n_test": len(te),
                "手置き": sp(fit.link_flow(rm, fit.DEFAULT_PARAMS), te),
                "学習後": sp(flow, te),
                "sec": round(time.time() - t0),
            }
            rows.append(r)
            print(
                f"  {tr_b}({len(tr)})で学習 → {te_b}({len(te)})で検証: 手置き {r['手置き']} → 学習後 {r['学習後']}  ({r['sec']}s)"
            )
    df = pd.DataFrame(rows)
    print("\n=== まとめ（学習に使っていない地区での順位相関）")
    print(df.pivot_table(index=["train", "test"], columns="model", values="学習後").to_string())


if __name__ == "__main__":
    main()
