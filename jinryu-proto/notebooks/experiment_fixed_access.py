"""到着端係数を「学習させず固定する」案の検証.

到着端は「目的地に着いた人は必ず最後の一区間を歩く」という構造なので、
本来は他の係数と取引して決まる自由パラメータではない。自由にすると学習地区に
特化して転移しなくなる（天神で学習 → 博多で検証 0.306 → 0.250）。

A 固定・無学習   : 手置き係数のまま、到着端係数だけ学習地区で選ぶ
B 固定・他を学習 : 到着端係数を学習地区で選んで固定し、残り 12 個を学習
C 従来           : 到着端なしで 12 個を学習

JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_fixed_access.py
"""

import os
import time

import geopandas as gpd
import numpy as np
import pandas as pd
from experiment_params import fit_on
from experiment_underground import sp, teacher_for

from jinryu import config, fit
from jinryu.pipeline import load_tables

GRID = (10.0, 30.0, 100.0, 300.0, 1000.0, 3000.0)
SEEDS = tuple(int(v) for v in os.environ.get("SEEDS", "5,17,29").split(","))


def pick_w(rm, tr, params):
    """学習地区だけを見て到着端係数を選ぶ（検証地区は一切使わない）."""
    best = max(GRID, key=lambda w: sp(fit.link_flow(rm, np.append(params, w)), tr))
    return best


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
    cal = teacher_for(tables["road_link"], sites_raw, obs, cfg)
    rm = fit.build_route_model(tables)

    rows = []
    for tr_b, te_b in [("TJ", "HK"), ("HK", "TJ")]:
        tr, te = cal[cal.block == tr_b], cal[cal.block == te_b]
        w = pick_w(rm, tr, fit.DEFAULT_PARAMS)
        flow0 = fit.link_flow(rm, np.append(fit.DEFAULT_PARAMS, w))
        rows.append(
            {
                "model": "A 固定・無学習",
                "train": tr_b,
                "test": te_b,
                "seed": "-",
                "access_w": w,
                "学習内": sp(flow0, tr),
                "検証": sp(flow0, te),
                "sec": 0,
            }
        )
        print(
            f"A {tr_b}→{te_b}: 学習地区で選んだ access_weight={w:g}  "
            f"学習内 {rows[-1]['学習内']} / 検証 {rows[-1]['検証']}",
            flush=True,
        )

        # B: 到着端を w に固定して残り 12 個を学習
        lo, hi = np.append(fit.LOWER, w), np.append(fit.UPPER, w)
        x0 = np.append(fit.DEFAULT_PARAMS, w)
        for seed in SEEDS:
            t0 = time.time()
            x = fit_on(rm, tr, lo, hi, x0, np.asarray, seed)
            flow = fit.link_flow(rm, x)
            rows.append(
                {
                    "model": "B 固定・他を学習",
                    "train": tr_b,
                    "test": te_b,
                    "seed": seed,
                    "access_w": w,
                    "学習内": sp(flow, tr),
                    "検証": sp(flow, te),
                    "sec": round(time.time() - t0),
                }
            )
            print(
                f"B {tr_b}→{te_b} seed={seed}: 学習内 {rows[-1]['学習内']} / 検証 {rows[-1]['検証']}"
                f"  ({rows[-1]['sec']}s)",
                flush=True,
            )
            pd.DataFrame(rows).to_csv("/tmp/fixed_rows.csv", index=False)

    df = pd.DataFrame(rows)
    print("\n=== まとめ（学習に使っていない地区での順位相関）")
    print(df.groupby(["model", "train", "test"])["検証"].agg(["mean", "min", "max"]).round(3).to_string())
    print("\n参考: C 従来（到着端なし 12 個を学習）TJ→HK 0.306 / HK→TJ 0.207")
    print("参考: POI 密度指標（学習なし）天神 0.595 / 博多 0.382")


if __name__ == "__main__":
    main()
