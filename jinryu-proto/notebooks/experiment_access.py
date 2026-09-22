"""到着端（目的地に着いてからの最後の数十 m）をモデルに入れる効果を測る A/B.

最短経路配分はゾーン代表ノードで打ち切られるので、商店街で通行量が立つ最後の区間が
どのリンクにも乗らない。到着人数を沿道の店舗密度に比例して配分する項を足して比べる。

REDUCED(6): 到着端なし
ACCESS(7):  到着端あり（access_weight を 1 つ足すだけ）

JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_access.py
"""

import os
import time

import geopandas as gpd
import numpy as np
import pandas as pd
from experiment_params import fit_on
from experiment_underground import predict, sp, teacher_for
from scipy.stats import rankdata, spearmanr

from jinryu import config, fit
from jinryu.pipeline import load_tables

SEEDS = (5, 17, 29)


def partial(a, b, ctrl):
    """ctrl の順位で説明できる分を除いた後の順位相関."""
    ra, rb, rc = (rankdata(v) for v in (a, b, ctrl))

    def resid(r):
        return r - np.polyval(np.polyfit(rc, r, 1), rc)

    return round(float(np.corrcoef(resid(ra), resid(rb))[0, 1]), 3)


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

    # access_weight = 0 なら従来と完全に一致すること（回帰チェック）
    base = fit.expand(fit.REDUCED_DEFAULT)
    assert np.array_equal(fit.link_flow(rm, base), fit.link_flow(rm, np.append(base, 0.0))), (
        "access_weight=0 が従来と一致しない"
    )
    print("回帰チェック OK: access_weight=0 は従来と一致")

    specs = {
        "REDUCED(6)": (
            fit.REDUCED_LOWER,
            fit.REDUCED_UPPER,
            fit.REDUCED_DEFAULT,
            fit.expand,
            fit.REDUCED_NAMES,
        ),
        "ACCESS(7)": (
            fit.ACCESS_LOWER,
            fit.ACCESS_UPPER,
            fit.ACCESS_DEFAULT,
            fit.expand_access,
            fit.ACCESS_NAMES,
        ),
    }
    only = os.environ.get("AB_ONLY", "")
    if only:
        specs = {k: v for k, v in specs.items() if k.startswith(only)}
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
                    f"  {tr_b}({len(tr)})→{te_b}({len(te)}) seed={seed}: 学習内 {r['学習内']} / 検証 {r['検証']}  ({r['sec']}s)"
                )
    df = pd.DataFrame(rows)
    print("\n=== まとめ（学習に使っていない地区での順位相関、シード平均±幅）")
    g = df.groupby(["model", "train", "test"])["検証"]
    print(pd.DataFrame({"平均": g.mean().round(3), "最小": g.min(), "最大": g.max()}).to_string())
    print("\n=== 解のばらつき")
    print(pd.DataFrame(sols).to_string(index=False))

    # 全 217 地点で学習した場合の到達点と、POI 密度との関係
    print("\n=== 全 217 地点で学習した場合")
    for label, (lo, hi, x0, to_full, names) in specs.items():
        x = fit_on(rm, cal, lo, hi, x0, to_full, 5)
        p = predict(fit.link_flow(rm, to_full(x)), cal)
        print(
            f"  {label}: spearman={round(float(spearmanr(cal['count'], p).correlation), 3)}  "
            + ", ".join(f"{n}={v:.3g}" for n, v in zip(names, x, strict=False))
        )


if __name__ == "__main__":
    main()
