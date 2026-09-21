"""実測通行量を教師に OD 係数を推定する（jinryu.fit の高速経路モデルを使用）.

JINRYU_AREA=fukuoka JINRYU_DATA_DIR=data/fukuoka uv run python notebooks/fit_coefficients.py
"""

import json
import sys
import time

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.optimize import differential_evolution
from scipy.stats import spearmanr

from jinryu import config, fit
from jinryu.calibrate import _obs_for_calibration, match_sites_to_links
from jinryu.pipeline import load_tables

EPS = 1.0


def load_teacher(tables, day_type="weekday"):
    p = config.paths()
    cfg = config.coefficients()["calibrate"]
    raw = gpd.read_parquet(p.table("count_site"))
    base = raw.drop(
        columns=[
            c
            for c in ["link_id", "link_ids", "n_links", "street_bearing_deg", "match_dist_m"]
            if c in raw.columns
        ]
    )
    match = match_sites_to_links(base, tables["road_link"], cfg["site_match_max_m"])
    sites = base.merge(match, on="site_id", how="left")
    obs = pd.read_parquet(p.table("count_obs"))
    cal = _obs_for_calibration(obs, sites, cfg)
    cal = cal[cal.day_type == day_type].copy()
    # 空間ブロック: 地区をさらに東西に割って 5 ブロックにする
    g = sites.set_index("site_id")
    cal["lon"] = cal.site_id.map(g.geometry.x)
    cal["lat"] = cal.site_id.map(g.geometry.y)
    blocks = []
    for b, sub in cal.groupby("block"):
        med = sub.lon.median()
        blocks.append(sub.assign(cv_block=np.where(sub.lon < med, f"{b}-W", f"{b}-E")))
    cal = pd.concat(blocks)
    # site → link 行番号
    order = {lid: i for i, lid in enumerate(tables["road_link"].link_id)}
    rows = []
    for ids in cal.link_ids:
        rows.append(np.array([order[x] for x in str(ids).split(",") if x in order], dtype=int))
    cal["rows"] = rows
    return cal


def predict(flow, cal):
    return np.array([flow[r].sum() if len(r) else 0.0 for r in cal["rows"]])


def score(pred, obs):
    p = np.maximum(pred, 0) + EPS
    o = np.asarray(obs, dtype=float) + EPS
    k = float(np.exp(np.mean(np.log(o) - np.log(p))))
    resid = np.log(k * p) - np.log(o)
    return {
        "k": k,
        "logrmse": float(np.sqrt(np.mean(resid**2))),
        "spearman": round(float(spearmanr(obs, pred).correlation), 3),
        "mape": round(float(np.mean(np.abs(k * p - o) / o)), 3),
        "zero": round(float((pred <= 0).mean()), 3),
    }


def fit_params(rm, cal, seed=1, maxiter=90, popsize=12):
    """順位相関を直接最大化する。

    logRMSE を目的にすると、推定 0 の地点（実測は数千人）の巨大な残差に引きずられ、
    モデルを極端に局所化する縮退解に落ちて順位相関がむしろ悪化した。
    我々が売る指標は「エリア内の順位」なので Spearman を主目的にし、
    ゼロ率と対数誤差はごく小さい重みの正則化として添える。
    """
    obs = cal["count"].values

    def loss(x):
        pred = predict(fit.link_flow(rm, x), cal)
        if pred.max() <= 0:
            return 10.0
        s = score(pred, obs)
        sp = s["spearman"] if s["spearman"] == s["spearman"] else -1.0
        return -sp + 0.30 * s["zero"] + 0.02 * s["logrmse"]

    res = differential_evolution(
        loss,
        list(zip(fit.LOWER, fit.UPPER, strict=False)),
        seed=seed,
        maxiter=maxiter,
        popsize=popsize,
        tol=1e-4,
        polish=True,
        x0=fit.DEFAULT_PARAMS,
        init="sobol",
    )
    return res.x, res.fun


def main():
    t0 = time.time()
    tables = load_tables()
    tables["building_pop"] = pd.read_parquet(config.paths().table("building_pop"))
    rm = fit.build_route_model(tables)
    cal = load_teacher(tables)
    print(
        f"教師 {len(cal)} 地点（平日）/ ブロック {sorted(cal.cv_block.unique())}  経路展開 {time.time() - t0:.0f}s"
    )

    base = score(predict(fit.link_flow(rm, fit.DEFAULT_PARAMS), cal), cal["count"].values)
    print(
        f"手置き係数: spearman={base['spearman']} logRMSE={base['logrmse']:.3f} mape={base['mape']} ゼロ率={base['zero']}"
    )

    x, f = fit_params(rm, cal, maxiter=60, popsize=10)
    tuned = score(predict(fit.link_flow(rm, x), cal), cal["count"].values)
    print(
        f"学習後(in-sample): spearman={tuned['spearman']} logRMSE={tuned['logrmse']:.3f} mape={tuned['mape']} ゼロ率={tuned['zero']}"
    )
    for n, v in zip(fit.PARAM_NAMES, x, strict=False):
        print(
            f"    {n:18s} {v:9.3f}   (手置き {dict(zip(fit.PARAM_NAMES, fit.DEFAULT_PARAMS, strict=False))[n]})"
        )

    # 空間ブロック CV
    preds = np.full(len(cal), -2.0)
    for blk in [b for b in sorted(cal.cv_block.unique()) if (cal.cv_block == b).sum() >= 10]:
        tr = cal[cal.cv_block != blk]
        xb, _ = fit_params(rm, tr, seed=2, maxiter=35, popsize=8)
        flow = fit.link_flow(rm, xb)
        te = cal.cv_block == blk
        preds[te.values] = predict(flow, cal[te])
        print(f"  CV {blk}: 学習 {len(tr)} → 検証 {int(te.sum())}")
    done = preds > -1
    cv = score(preds[done], cal["count"].values[done])
    print(f"学習後(空間ブロックCV): spearman={cv['spearman']} logRMSE={cv['logrmse']:.3f} mape={cv['mape']}")

    out = {
        "params": dict(zip(fit.PARAM_NAMES, [round(float(v), 4) for v in x], strict=False)),
        "in_sample": tuned,
        "block_cv": cv,
        "handset": base,
        "n_sites": int(len(cal)),
        "elapsed_s": round(time.time() - t0, 1),
    }
    path = config.paths().processed / "fitted_params.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"→ {path}  ({out['elapsed_s']}s)")


if __name__ == "__main__":
    sys.exit(main())
