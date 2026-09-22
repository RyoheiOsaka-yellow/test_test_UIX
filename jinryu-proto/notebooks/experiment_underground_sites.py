"""到着端を入れた今、地下の調査地点を較正に使えるようになったかを確かめる.

v0.6 では地下 43 地点を教師に加えると全体の Spearman が 0.43 → 0.21 に落ちたため除外した。
地下街は店舗密度が極めて高いので、到着端の配分が地下にも正しく効く可能性がある。
学習はせず、手置き係数と現行の学習済み係数それぞれで、地上のみ／地上+地下を比べる。

JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/experiment_underground_sites.py
"""

import copy

import geopandas as gpd
import numpy as np
import pandas as pd
from experiment_underground import predict, teacher_for
from scipy.stats import spearmanr

from jinryu import config, fit
from jinryu.pipeline import load_tables


def main():
    coef = config.coefficients()
    cfg_surface = coef["calibrate"]
    cfg_all = copy.deepcopy(cfg_surface)
    cfg_all["exclude_site_kinds"] = [k for k in cfg_surface["exclude_site_kinds"] if k != "underground"]

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
    rm = fit.build_route_model(tables)

    cal_s = teacher_for(links, sites_raw, obs, cfg_surface)
    cal_a = teacher_for(links, sites_raw, obs, cfg_all)
    und = cal_a[~cal_a.site_id.isin(cal_s.site_id)]
    print(f"地上のみ {len(cal_s)} 地点 / 地上+地下 {len(cal_a)} 地点（地下 {len(und)}）")

    od = coef["od"]
    shipped = np.array(
        [
            *[od["dest_weight"][c] for c in fit.FIT_CLASSES],
            od["poi_weight"],
            od["station_origin_weight"],
            od["residential_trip_rate"]["weekday"],
            od["external"]["origin_factor"],
            od.get("underground_weight", 0.0),
            od["half_distance_m"],
        ]
    )
    rows = []
    for pname, base in [("手置き係数", fit.DEFAULT_PARAMS), ("学習済み係数", shipped)]:
        for acc in (0.0, 100.0, 300.0):
            x = base if acc == 0 else np.append(base, acc)
            flow = fit.link_flow(rm, x)

            def s(c, f=flow):
                p = predict(f, c)
                return round(float(spearmanr(c["count"], p).correlation), 3)

            rows.append(
                {
                    "係数": pname,
                    "到着端": acc,
                    "地上のみ": s(cal_s),
                    "地上+地下": s(cal_a),
                    "地下のみ": s(und),
                    "地下で合成値0": int((predict(flow, und) <= 0.5).sum()),
                }
            )
    print(pd.DataFrame(rows).to_string(index=False))
    print("\n※ 地下のみの列が正なら、地下の順位も再現できている＝較正に使える")


if __name__ == "__main__":
    main()
