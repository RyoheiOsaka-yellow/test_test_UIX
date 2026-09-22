"""地点をランダムに分けた検証（同じ市内で、観測のない場所を当てられるか）.

地区丸ごとの holdout（TJ↔HK）は「別の街へ係数を持ち出せるか」を問うている。
実運用は市内の全観測で学習して市内の未観測地点を推定するので、こちらも測る。
ブロック構成を保ったまま 70/30 に分け、分割を変えて繰り返す。

JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_split.py
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

SPLITS = tuple(int(v) for v in os.environ.get("SPLITS", "0,1,2").split(","))


def specs():
    """本番と同じ組み立てで測る。到着端と距離抵抗は calibrate が全観測から決めた値に固定し、
    残り 12 個だけを学習データ内で学習する（本番は既存の学習済み係数を使うが、
    未観測地点への当てはまりを測るには分割内で学習し直す必要がある）."""
    f, od = fit, config.coefficients()["od"]
    acc = float(od.get("access_weight", 0.0))
    half = float(od["half_distance_m"])
    lo, hi, x0 = f.FULL_ACCESS_LOWER.copy(), f.FULL_ACCESS_UPPER.copy(), f.FULL_ACCESS_DEFAULT.copy()
    lo[12] = hi[12] = x0[12] = acc  # 到着端は固定
    lo[11] = hi[11] = x0[11] = half  # 距離抵抗も固定
    return {
        f"本番構成(到着端{acc:g}/half{half:g})": (lo, hi, x0, np.asarray, f.FULL_ACCESS_NAMES),
        "到着端なし(従来)": (f.LOWER, f.UPPER, f.DEFAULT_PARAMS, np.asarray, f.PARAM_NAMES),
    }


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

    sel = os.environ.get("ONLY", "")
    sp_ = specs()
    if sel:
        sp_ = {k: v for k, v in sp_.items() if k in sel.split("|")}

    rows, sols = [], []
    for label, (lo, hi, x0, to_full, names) in sp_.items():
        print(f"\n=== {label}", flush=True)
        for s in SPLITS:
            rng = np.random.default_rng(s)
            # ブロック構成を保って 70/30
            te_idx = np.concatenate(
                [
                    rng.permutation(g.index.values)[: max(1, int(round(0.3 * len(g))))]
                    for _, g in cal.groupby("block")
                ]
            )
            te = cal.loc[te_idx]
            tr = cal.drop(index=te_idx)
            t0 = time.time()
            x = fit_on(rm, tr, lo, hi, x0, to_full, 5)
            flow = fit.link_flow(rm, to_full(x))
            r = {
                "model": label,
                "split": s,
                "n_tr": len(tr),
                "n_te": len(te),
                "学習内": sp(flow, tr),
                "検証": sp(flow, te),
                "sec": round(time.time() - t0),
            }
            rows.append(r)
            sols.append({"model": label, "split": s, **dict(zip(names, np.round(x, 3), strict=False))})
            print(
                f"  分割{s}: 学習 {len(tr)} / 検証 {len(te)} → 学習内 {r['学習内']} / 検証 {r['検証']}  ({r['sec']}s)",
                flush=True,
            )
            pd.DataFrame(rows).to_csv("/tmp/split_rows.csv", index=False)
            pd.DataFrame(sols).to_csv("/tmp/split_sols.csv", index=False)
    df = pd.DataFrame(rows)
    print("\n=== まとめ（同じ市内・未観測地点での順位相関）")
    print(df.groupby("model")["検証"].agg(["mean", "min", "max"]).round(3).to_string())
    print("\n=== 解（全地点の 70% で学習）")
    print(pd.DataFrame(sols).to_string(index=False))


if __name__ == "__main__":
    main()
