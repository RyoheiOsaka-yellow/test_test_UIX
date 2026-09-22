"""fit.link_flow が本番 run_build と一致することを確かめる（到着端あり・なし両方）.

係数学習は fit.link_flow の上で回すので、ここがずれると「学習で測った改善」が
本番に出ない。実装が 2 つある以上、変更のたびにこの照合を通す。
JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/verify_fit_matches_build.py
"""

import copy
import sys

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from jinryu import config, fit
from jinryu.pipeline import load_tables, run_build


def check(label: str, coef: dict, params: np.ndarray, tables: dict) -> bool:
    period = config.area()["periods"]["baseline"]
    # fit.link_flow が対応するのは time_band="all"。本番は band ごとに発生量を
    # BAND_ORIGIN_FACTOR で割り増し・割り引きするが、"all" だけは 1.0 で、
    # 集中側も destination_time_band の滞在人口を使う（fit と同じ組み立てになる）。
    band = "all"
    bpop, lf = run_build(
        periods=[period],
        coef=coef,
        write=False,
        tables=tables,
        day_types=("weekday",),
        time_bands=(band,),
        quiet=True,
    )
    # fit 側は建物別滞在人口を入力に取る（run_build は内部で作るので受け渡す）
    rm = fit.build_route_model({**tables, "building_pop": bpop}, coef=coef, period=period, day_type="weekday")
    mine = pd.Series(fit.link_flow(rm, params), index=rm.links.link_id.values)
    theirs = lf.set_index("link_id").flow_synth
    both = pd.DataFrame({"build": theirs, "fit": mine.reindex(theirs.index)}).fillna(0.0)
    # 通行量がほぼ 0 のリンクは flow_synth の丸め（小数 2 桁）で順位が入れ替わるだけなので、
    # 順位の一致は意味のある通行量があるリンクで見る。総量と最大差は全リンクで見る。
    big = both[both.build > 1.0]
    r = float(spearmanr(big.build, big.fit).correlation)
    pr = float(np.corrcoef(both.build, both.fit)[0, 1])
    d = (both.build - both.fit).abs()
    rel = abs(both.fit.sum() - both.build.sum()) / max(both.build.sum(), 1.0)
    ok = r > 0.9999 and pr > 0.99999 and rel < 1e-4
    print(
        f"{label}: spearman={r:.5f}（通行量>1 の {len(big)} 本）pearson={pr:.5f}  "
        f"合計 build={both.build.sum():,.0f} fit={both.fit.sum():,.0f}（差 {rel:.2e}）"
        f"  最大差={d.max():.2f}  {'OK' if ok else 'ずれあり'}"
    )
    return ok


def main():
    base = copy.deepcopy(config.coefficients())
    # 確率的配分を切って決定的にする（fit 側は単一木）
    base["assign"]["stochastic"] = {"draws": 1, "cost_sigma": 0.0, "seed": 0}
    tables = load_tables()

    params = np.array(
        [
            *[base["od"]["dest_weight"][c] for c in fit.FIT_CLASSES],
            base["od"]["poi_weight"],
            base["od"]["station_origin_weight"],
            base["od"]["residential_trip_rate"]["weekday"],
            base["od"]["external"]["origin_factor"],
            base["od"].get("underground_weight", 0.0),
            base["od"]["half_distance_m"],
        ],
        dtype=float,
    )

    # 設定の既定値に関わらず、比較する条件は明示する（fit 側は 12 個なら到着端なし）
    base["od"]["access_weight"] = 0.0
    ok = check("到着端なし", base, params, tables)
    withacc = copy.deepcopy(base)
    withacc["od"]["access_weight"] = 3.0
    ok &= check("到着端あり(access_weight=3)", withacc, np.append(params, 3.0), tables)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
