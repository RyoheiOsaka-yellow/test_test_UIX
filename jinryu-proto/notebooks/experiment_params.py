"""係数を絞り込む効果を測る A/B.

FULL: 12 個（従来）
REDUCED: 6 個（小売=1・住宅発生率=1 に固定し、小売・オフィス以外の用途を 1 つにまとめる）

同じ手順で学習し、学習に使っていない地区で順位相関を比べる。
再現性も見たいので乱数シードを変えて複数回まわし、解のばらつきも出す。
JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_params.py
"""

import time

import geopandas as gpd
import numpy as np
import pandas as pd
from experiment_underground import predict, sp, teacher_for  # noqa: E402
from scipy.optimize import differential_evolution
from scipy.stats import spearmanr

from jinryu import config, fit
from jinryu.pipeline import load_tables

SEEDS = (5, 17, 29)


def fit_on(rm, cal, lower, upper, x0, to_full, seed):
    obs = cal["count"].values

    def loss(x):
        p = predict(fit.link_flow(rm, to_full(x)), cal)
        if p.max() <= 0:
            return 10.0
        r = spearmanr(obs, p).correlation
        return -(r if r == r else -1.0) + 0.30 * float((p <= 0).mean())

    res = differential_evolution(
        loss,
        list(zip(lower, upper, strict=False)),
        seed=seed,
        maxiter=40,
        popsize=9,
        tol=1e-4,
        polish=True,
        x0=x0,
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
    links = tables["road_link"]
    cal = teacher_for(links, sites_raw, obs, cfg)
    rm = fit.build_route_model(tables)

    specs = {
        "FULL(12)": (fit.LOWER, fit.UPPER, fit.DEFAULT_PARAMS, np.asarray, fit.PARAM_NAMES),
        "REDUCED(6)": (
            fit.REDUCED_LOWER,
            fit.REDUCED_UPPER,
            fit.REDUCED_DEFAULT,
            fit.expand,
            fit.REDUCED_NAMES,
        ),
    }
    rows, sols = [], []
    for label, (lo, hi, x0, to_full, names) in specs.items():
        print(f"\n=== {label}")
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
                    f"学習内 {r['学習内']} / 検証 {r['検証']}  ({r['sec']}s)"
                )
    df = pd.DataFrame(rows)
    print("\n=== まとめ（学習に使っていない地区での順位相関、シード平均±幅）")
    g = df.groupby(["model", "train", "test"])["検証"]
    print(pd.DataFrame({"平均": g.mean().round(3), "最小": g.min(), "最大": g.max()}).to_string())
    print("\n=== 解のばらつき（同じ学習データ・別シード）")
    print(pd.DataFrame(sols).to_string(index=False))


if __name__ == "__main__":
    main()
