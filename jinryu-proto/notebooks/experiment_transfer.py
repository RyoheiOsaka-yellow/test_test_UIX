"""実測の無い別の街へ係数を持ち出したときの精度（UI に出している「0.26〜0.35」の根拠）.

本番と同じ構成（到着端と距離抵抗は固定）で、一方の地区だけで残り 12 個を学習し、
もう一方の地区で順位相関を測る。学習に使う地区を入れ替えて両方向。
JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_transfer.py
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

SEEDS = tuple(int(v) for v in os.environ.get("SEEDS", "5,17,29").split(","))


def main():
    coef = config.coefficients()
    cfg = coef["calibrate"]
    acc = float(coef["od"].get("access_weight", 0.0))
    half = float(coef["od"]["half_distance_m"])
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

    lo, hi, x0 = fit.FULL_ACCESS_LOWER.copy(), fit.FULL_ACCESS_UPPER.copy(), fit.FULL_ACCESS_DEFAULT.copy()
    lo[12] = hi[12] = x0[12] = acc
    lo[11] = hi[11] = x0[11] = half
    print(f"本番構成: 到着端={acc:g} / half={half:g}m")

    rows = []
    for tr_b, te_b in [("TJ", "HK"), ("HK", "TJ")]:
        tr, te = cal[cal.block == tr_b], cal[cal.block == te_b]
        for seed in SEEDS:
            t0 = time.time()
            x = fit_on(rm, tr, lo, hi, x0, np.asarray, seed)
            flow = fit.link_flow(rm, x)
            r = {
                "train": tr_b,
                "test": te_b,
                "seed": seed,
                "学習内": sp(flow, tr),
                "検証": sp(flow, te),
                "sec": round(time.time() - t0),
            }
            rows.append(r)
            print(
                f"  {tr_b}({len(tr)})→{te_b}({len(te)}) seed={seed}: "
                f"学習内 {r['学習内']} / 検証 {r['検証']}  ({r['sec']}s)",
                flush=True,
            )
    df = pd.DataFrame(rows)
    print("\n=== まとめ（実測の無い別の街へ持ち出した場合の順位相関）")
    print(df.groupby(["train", "test"])["検証"].agg(["mean", "min", "max"]).round(3).to_string())
    print(f"\n全体: {df['検証'].min():.2f}〜{df['検証'].max():.2f}（平均 {df['検証'].mean():.3f}）")


if __name__ == "__main__":
    main()
