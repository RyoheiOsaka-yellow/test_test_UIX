"""最終構成（地下鉄→地下街 ON、POI 絞り込み後）での候補比較.

FULL(12)        : 従来
FULL+ACC(13)    : 従来 + 到着端  ← 本番候補
REDUCED(6)      : 絞り込み
REDUCED+ACC(7)  : 絞り込み + 到着端

学習に使っていない地区（TJ↔HK）で順位相関を比べ、シードを変えて再現性も見る。
JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_final.py
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

SEEDS = tuple(int(v) for v in os.environ.get("SEEDS", "5,17,29,41").split(","))


def main():
    cfg = config.coefficients()["calibrate"]
    assert config.coefficients()["od"]["subway"]["underground_attach"], "地下鉄接続が無効"
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

    specs = {
        "FULL(12)": (fit.LOWER, fit.UPPER, fit.DEFAULT_PARAMS, np.asarray, fit.PARAM_NAMES),
        "FULL+ACC(13)": (
            fit.FULL_ACCESS_LOWER,
            fit.FULL_ACCESS_UPPER,
            fit.FULL_ACCESS_DEFAULT,
            np.asarray,
            fit.FULL_ACCESS_NAMES,
        ),
        "REDUCED(6)": (
            fit.REDUCED_LOWER,
            fit.REDUCED_UPPER,
            fit.REDUCED_DEFAULT,
            fit.expand,
            fit.REDUCED_NAMES,
        ),
        "REDUCED+ACC(7)": (
            fit.ACCESS_LOWER,
            fit.ACCESS_UPPER,
            fit.ACCESS_DEFAULT,
            fit.expand_access,
            fit.ACCESS_NAMES,
        ),
    }
    only = os.environ.get("ONLY", "")
    if only:
        specs = {k: v for k, v in specs.items() if k in only.split("|")}

    rows, sols = [], []
    for label, (lo, hi, x0, to_full, names) in specs.items():
        print(f"\n=== {label}", flush=True)
        for tr_b, te_b in [("TJ", "HK"), ("HK", "TJ")]:
            tr, te = cal[cal.block == tr_b], cal[cal.block == te_b]
            for seed in SEEDS:
                t0 = time.time()
                x = fit_on(rm, tr, lo, hi, x0, to_full, seed)
                flow = fit.link_flow(rm, to_full(x))
                r = {
                    "model": label,
                    "train": tr_b,
                    "test": te_b,
                    "seed": seed,
                    "学習内": sp(flow, tr),
                    "検証": sp(flow, te),
                    "sec": round(time.time() - t0),
                }
                rows.append(r)
                sols.append(
                    {
                        "model": label,
                        "train": tr_b,
                        "seed": seed,
                        **dict(zip(names, np.round(x, 3), strict=False)),
                    }
                )
                print(
                    f"  {tr_b}({len(tr)})→{te_b}({len(te)}) seed={seed}: "
                    f"学習内 {r['学習内']} / 検証 {r['検証']}  ({r['sec']}s)",
                    flush=True,
                )
                pd.DataFrame(rows).to_csv("/tmp/final_rows.csv", index=False)
                pd.DataFrame(sols).to_csv("/tmp/final_sols.csv", index=False)
    df = pd.DataFrame(rows)
    print("\n=== まとめ（学習に使っていない地区での順位相関）")
    g = df.groupby(["model", "train", "test"])["検証"]
    print(pd.DataFrame({"平均": g.mean().round(3), "最小": g.min(), "最大": g.max()}).to_string())
    print("\n=== 2 方向平均")
    print(df.groupby("model")["検証"].agg(["mean", "std"]).round(3).to_string())
    print("\n=== 解のばらつき")
    print(pd.DataFrame(sols).to_string(index=False))


if __name__ == "__main__":
    main()
