"""地下鉄駅を地下歩行路に接続する効果を測る A/B.

A: 地下鉄（福岡市交通局）の駅を最寄りの地下ノードに接続する
B: 全駅を最寄りノードに接続する（従来）

ネットワークはどちらも地下込みで同一。違いは駅の接続先だけ。
同じ手順で係数を再学習し、学習に使っていない地区で順位相関を比べる。
JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_subway.py
"""

import copy
import time

import geopandas as gpd
import pandas as pd
from experiment_underground import fit_on, sp, teacher_for  # noqa: E402

from jinryu import config, fit
from jinryu.pipeline import load_tables


def main():
    coef0 = config.coefficients()
    cfg = coef0["calibrate"]
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

    on = copy.deepcopy(coef0)
    on["od"]["subway"] = {"underground_attach": True, "operator_pattern": "福岡市", "max_attach_m": 400}
    off = copy.deepcopy(coef0)
    off["od"]["subway"] = {"underground_attach": False}

    rows = []
    for label, coef in [("A 地下鉄→地下街", on), ("B 従来（最寄り）", off)]:
        rm = fit.build_route_model(tables, coef=coef)
        base_all = sp(fit.link_flow(rm, fit.DEFAULT_PARAMS), cal)
        print(f"\n{label}: 教師 {len(cal)}  手置き係数での全体 spearman={base_all}")
        for tr_b, te_b in [("TJ", "HK"), ("HK", "TJ")]:
            tr, te = cal[cal.block == tr_b], cal[cal.block == te_b]
            t0 = time.time()
            x = fit_on(rm, tr)
            r = {
                "model": label,
                "train": tr_b,
                "test": te_b,
                "n_test": len(te),
                "手置き": sp(fit.link_flow(rm, fit.DEFAULT_PARAMS), te),
                "学習後": sp(fit.link_flow(rm, x), te),
                "sec": round(time.time() - t0),
            }
            rows.append(r)
            print(
                f"  {tr_b}({len(tr)})で学習 → {te_b}({len(te)})で検証: "
                f"手置き {r['手置き']} → 学習後 {r['学習後']}  ({r['sec']}s)"
            )
    df = pd.DataFrame(rows)
    print("\n=== まとめ（学習に使っていない地区での順位相関）")
    print(df.pivot_table(index=["train", "test"], columns="model", values="学習後").to_string())


if __name__ == "__main__":
    main()
