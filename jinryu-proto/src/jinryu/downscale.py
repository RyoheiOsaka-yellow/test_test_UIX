"""① 建物単位 滞在人口推定（ダスメトリック配分）.

w_b = GFA_b × α(用途_b, 平休日, 時間帯) × β(用途地域_b)
P_b = P_m × w_b / Σ_{b∈m} w_b
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from jinryu import config


def alpha_for(coef: dict, day_type: str, time_band: str) -> dict[str, float]:
    """α を返す。day_type='all' は平日・休日の平均（週5:2 加重）."""
    if day_type in coef["alpha"]:
        return coef["alpha"][day_type][time_band]
    wd, hd = coef["alpha"]["weekday"][time_band], coef["alpha"]["holiday"][time_band]
    return {k: (5 * wd[k] + 2 * hd.get(k, wd[k])) / 7 for k in wd}


def building_weights(
    buildings: pd.DataFrame, day_type: str, time_band: str, coef: dict | None = None
) -> pd.Series:
    coef = coef or config.coefficients()
    alpha = alpha_for(coef, day_type, time_band)
    a = buildings.usage_class.map(alpha).fillna(alpha.get("other", 0.3))
    if coef["beta"]["enabled"]:
        bz = coef["beta"]["by_zone_code"]
        b = buildings.zoning.astype(str).map(bz).fillna(bz["default"])
    else:
        b = 1.0
    return buildings.gfa.clip(lower=1.0) * a * b


def downscale(mesh_flow: pd.DataFrame, buildings: pd.DataFrame, coef: dict | None = None) -> pd.DataFrame:
    """mesh_flow(全期間) → building_pop(building_id, period, day_type, time_band, pop_est, confidence)."""
    coef = coef or config.coefficients()
    if "in_core" in mesh_flow.columns:
        mesh_flow = mesh_flow[mesh_flow.in_core]
    out = []
    b = buildings[
        [
            "building_id",
            "mesh_code",
            "usage_class",
            "zoning",
            "gfa",
            "gfa_is_estimated",
            "floors_is_estimated",
        ]
    ].copy()
    conf = np.where(b.gfa_is_estimated | b.floors_is_estimated, "low", "mid")
    combos = mesh_flow[["day_type", "time_band"]].drop_duplicates()
    for day_type, time_band in combos.itertuples(index=False):
        w = building_weights(b, day_type, time_band, coef)
        share = w / w.groupby(b.mesh_code).transform("sum")
        mf = mesh_flow[(mesh_flow.day_type == day_type) & (mesh_flow.time_band == time_band)]
        for period, grp in mf.groupby("period"):
            pm = b.mesh_code.map(grp.set_index("mesh_code").population).fillna(0.0)
            out.append(
                pd.DataFrame(
                    {
                        "building_id": b.building_id.values,
                        "period": period,
                        "day_type": day_type,
                        "time_band": time_band,
                        "pop_est": (pm * share).round(3).values,
                        "confidence": conf,
                    }
                )
            )
    return pd.concat(out, ignore_index=True)
