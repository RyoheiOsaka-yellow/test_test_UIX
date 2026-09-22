"""④ 較正と評価.

- 通行量調査地点 → 最寄りリンク（距離閾値付き）
- 合成通行量 → 実測へのスケール係数 k と距離抵抗 half_distance を格子探索でフィット（log 空間の最小二乗）
- ブロック別スケール CV（count_site.block 単位で leave-one-block-out。ただし再推定するのは
  スケール k だけで、係数と到着端は全観測から決めた値のまま。係数の転移性能ではない）
- 指標: Spearman 順位相関、MAPE、上位20%地点の一致率
- 出力: data/processed/calibration.json, link_flow.parquet（較正後）, docs/EVAL.md, docs/eval/scatter.png
"""

from __future__ import annotations

import itertools
import json
import os
import re
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import typer
from scipy.stats import spearmanr

from jinryu import config


def _bearing(geom) -> float:
    """リンクの代表方位（0〜π、向きは区別しない）."""
    x0, y0 = geom.coords[0]
    x1, y1 = geom.coords[-1]
    return np.arctan2(y1 - y0, x1 - x0) % np.pi


def match_sites_to_links(sites: gpd.GeoDataFrame, links: gpd.GeoDataFrame, max_m: float) -> pd.DataFrame:
    """調査地点 → スクリーンライン交差リンク集合.

    カメラ・調査員は「街路を横切る線」を通る人を数える。そこで地点ごとに、その街路と直交する
    長さ 2×max_m のスクリーンラインを置き、交差する歩行リンクのうち<その街路と平行なもの>だけを
    集める。平行判定を入れないと、交差点で直交する街路まで合算して数倍に膨れる。

    街路の向きは、調査票に方向（南北/東西）があればそれを、無ければ最寄りリンクの方位を使う。
    """
    from shapely.geometry import LineString

    plane = config.epsg_plane()
    s = sites.to_crs(plane)
    cols = ["link_id", "geometry"] + (["level"] if "level" in links.columns else [])
    l_ = links[cols].to_crs(plane)
    if "level" not in l_.columns:
        l_ = l_.assign(level=0)
    levels = l_["level"].fillna(0).values
    tol = np.radians(config.coefficients()["calibrate"].get("parallel_tolerance_deg", 40))
    rows = []
    for _, r in s.iterrows():
        x, y = r.geometry.x, r.geometry.y
        direction = str(r.get("direction", "") or "")
        # 地上の調査地点は地上リンクだけに対応させる（地下街の真上で流量を二重に足さないため）
        want_under = str(r.get("kind", "")) == "underground"
        same_level = (levels < 0) if want_under else (levels >= 0)
        pool = l_[same_level]
        if len(pool) == 0:
            pool = l_
        pool_sidx = pool.sindex
        nearest_idx = int(list(pool_sidx.nearest(r.geometry, return_all=False)[1])[0])
        if "南北" in direction:
            street = np.pi / 2  # 南北に通行する街路
        elif "東西" in direction:
            street = 0.0
        else:
            street = float(_bearing(pool.geometry.iloc[nearest_idx]))
        # 街路に直交するスクリーンライン
        nx, ny = -np.sin(street), np.cos(street)
        line = LineString([(x - nx * max_m, y - ny * max_m), (x + nx * max_m, y + ny * max_m)])
        cand = pool.iloc[list(pool_sidx.query(line, predicate="intersects"))]
        if len(cand):
            diff = np.abs(cand.geometry.map(_bearing).values - street)
            diff = np.minimum(diff, np.pi - diff)
            cand = cand[diff <= tol]
        if len(cand) == 0:
            cand = pool.iloc[[nearest_idx]]
        d = cand.geometry.distance(r.geometry)
        rows.append(
            {
                "site_id": r.site_id,
                "link_id": cand.link_id.iloc[int(np.argmin(d.values))],
                "link_ids": ",".join(cand.link_id.tolist()),
                "n_links": len(cand),
                "street_bearing_deg": round(float(np.degrees(street)), 1),
                "match_dist_m": round(float(d.min()), 1),
            }
        )
    return pd.DataFrame(rows)


def site_flows(
    link_flow: pd.DataFrame, sites: pd.DataFrame, period: str, time_band: str = "all"
) -> pd.DataFrame:
    """スクリーンライン上のリンク流量を地点ごとに合算 → (site_id, day_type, flow_synth)."""
    lf = link_flow[(link_flow.period == period) & (link_flow.time_band == time_band)]
    m = (
        sites[["site_id", "link_ids"]]
        .dropna()
        .assign(link_id=lambda d: d.link_ids.str.split(","))
        .explode("link_id")
    )
    j = m.merge(lf[["link_id", "day_type", "flow_synth"]], on="link_id", how="left")
    return j.groupby(["site_id", "day_type"], as_index=False).flow_synth.sum()


def _obs_for_calibration(obs: pd.DataFrame, sites: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """較正に使う実測: 街路地点のみ、期間は全月平均、平日/休日別、time_band=all."""
    ok = sites[~sites.kind.isin(cfg["exclude_site_kinds"]) & sites.link_id.notna()]
    # PDF 地図から座標を起こした地点は、ネットワークから離れすぎているものを較正から外す
    lim = cfg.get("max_site_resid_m")
    if lim and "geo_resid_m" in ok.columns:
        resid = pd.to_numeric(ok.geo_resid_m, errors="coerce")
        ok = ok[resid.isna() | (resid <= lim)]
    o = obs[
        obs.site_id.isin(ok.site_id) & (obs.time_band == "all") & obs.day_type.isin(["weekday", "holiday"])
    ]
    o = o.groupby(["site_id", "day_type"], as_index=False).agg(count=("count", "mean"), n=("n_days", "sum"))
    o = o[o.site_id.isin(ok.site_id)]
    return o.merge(ok[["site_id", "link_id", "link_ids", "block", "name"]], on="site_id")


def metrics(y_obs: np.ndarray, y_hat: np.ndarray) -> dict:
    if len(y_obs) < 3:
        return {"n": int(len(y_obs)), "spearman": None, "mape": None, "top20_hit": None}
    rho = spearmanr(y_obs, y_hat).correlation
    mape = float(np.mean(np.abs(y_hat - y_obs) / np.maximum(y_obs, 1)))
    k = max(1, int(round(0.2 * len(y_obs))))
    top_obs = set(np.argsort(-y_obs)[:k])
    top_hat = set(np.argsort(-y_hat)[:k])
    return {
        "n": int(len(y_obs)),
        "spearman": round(float(rho), 3),
        "mape": round(mape, 3),
        "top20_hit": round(len(top_obs & top_hat) / k, 2),
    }


def fit_scale(synth: np.ndarray, obs: np.ndarray) -> float:
    """log(obs) = log k + log(synth) の最小二乗 → k."""
    m = (synth > 0) & (obs > 0)
    if m.sum() == 0:
        return 1.0
    return float(np.exp(np.mean(np.log(obs[m]) - np.log(synth[m]))))


def evaluate(link_flow: pd.DataFrame, cal_obs: pd.DataFrame, period: str) -> tuple[pd.DataFrame, dict, float]:
    sf = site_flows(link_flow, cal_obs.drop_duplicates("site_id"), period)
    m = cal_obs.merge(sf, on=["site_id", "day_type"], how="left").fillna({"flow_synth": 0})
    k = fit_scale(m.flow_synth.values, m["count"].values)
    m["pred"] = m.flow_synth * k
    return m, metrics(m["count"].values, m.pred.values), k


def block_cv(m: pd.DataFrame) -> dict:
    """ブロック単位の leave-one-block-out。ただし**スケール k だけ**を学習ブロックで推定する.

    係数と到着端係数は全観測から決めた値のまま固定なので、これは「係数を別の地区へ
    持ち出せるか」を測っていない。除外ブロックの観測も係数の決定には使われている。
    係数の転移を測るには、係数自体をフォールド内で学習し直す必要がある
    （notebooks/experiment_fixed_access.py 参照。福岡では 0.26〜0.35）。
    """
    preds = []
    for blk in m.block.unique():
        tr, te = m[m.block != blk], m[m.block == blk].copy()
        k = fit_scale(tr.flow_synth.values, tr["count"].values)
        te["pred_cv"] = te.flow_synth * k
        preds.append(te)
    cv = pd.concat(preds)
    return {"blocks": sorted(m.block.unique().tolist()), **metrics(cv["count"].values, cv.pred_cv.values)}


def choose_grid_point(results: list[dict], tol: float = 0.01) -> tuple[int, int]:
    """格子探索の結果から採用する点を選ぶ。返り値は (採用した添字, 候補数).

    順位（ブロック別スケール CV の Spearman）が最良から tol 以内の点の中で、
    絶対値の誤差（in-sample MAPE）が最小のものを採る。436 観測で Spearman 0.001 の
    差は誤差以下なのに、そこで決めると MAPE が 14% 悪い点が選ばれることがあった。
    同順なら格子の先頭（距離抵抗が短く、到着端が小さいほう）を採る。
    """

    def sp_of(r):
        v = (r.get("block_cv") or {}).get("spearman")
        return v if v is not None else -1.0

    def mape_of(r):
        v = (r.get("in_sample") or {}).get("mape")
        return v if v is not None and v == v else 9e9  # nan は候補外

    top = max(sp_of(r) for r in results) - tol
    near = [i for i, r in enumerate(results) if sp_of(r) >= top]
    return min(near, key=lambda i: (mape_of(results[i]), i)), len(near)


def write_back_chosen(chosen: dict) -> Path:
    """採用した距離抵抗・到着端をエリアの係数 YAML に書き戻す.

    calibration.json だけに残すと jinryu build を単体で回したときに旧設定のままになり、
    設定と実際の出力が食い違う。転記を手作業にすると必ずずれるので自動化する。
    YAML はコメントが説明そのものなので、safe_dump で作り直さず該当行だけ置き換える。
    """
    name = config.area_file().replace("area", "coefficients")
    path = config.CONFIG_DIR / name
    if not path.exists():  # エリア別の上書きが無ければ既定側に書く
        path = config.CONFIG_DIR / "coefficients.yaml"
    text = path.read_text(encoding="utf-8")
    for key, value in (
        ("half_distance_m", int(chosen["half_distance_m"])),
        ("access_weight", float(chosen.get("access_weight", 0.0))),
        ("calibrated_scale_k", float(chosen["scale_k"])),
    ):
        pat = re.compile(rf"^(?P<head>  {key}: )(?P<val>[^#\n]*?)(?P<gap>\s*)(?P<rest>#.*)?$", re.M)

        def _swap(m, v=f"{value:g}"):
            # コメントは説明なので残し、桁も揃えたままにする
            gap = m["gap"] or ""
            if m["rest"]:
                gap = " " * max(2, len(m["val"]) + len(gap) - len(v))
            return f"{m['head']}{v}{gap}{m['rest'] or ''}"

        text, n = pat.subn(_swap, text, count=1)
        if not n:  # まだ無いキーは od: の直後に足す（ファイル先頭が od: のこともある）
            text, n = re.subn(r"^od:\n", f"od:\n  {key}: {value:g}\n", text, count=1, flags=re.M)
            if not n:
                raise ValueError(f"{path.name} に od: が無いため {key} を書けない")
    path.write_text(text, encoding="utf-8")
    config.coefficients.cache_clear()
    return path


def run_calibration(write: bool = True) -> dict:
    from jinryu.pipeline import load_tables, run_build

    t0 = time.time()
    coef = config.coefficients()
    cfg = coef["calibrate"]
    p = config.paths()
    tables = load_tables()
    sites = gpd.read_parquet(p.table("count_site"))
    obs = pd.read_parquet(p.table("count_obs"))
    if len(sites) == 0 or len(obs) == 0:
        return _run_transfer(tables, sites, coef, write, t0)
    match = match_sites_to_links(sites, tables["road_link"], cfg["site_match_max_m"])
    # 前回の calibrate が書き戻した対応付けの列を落としてから付け直す（再実行できるように）。
    # 冪等性を直す前の実行が street_bearing_deg_x/_y のような残骸を残しているので、それも掃除する。
    stale = {c for c in match.columns if c != "site_id"}
    sites = sites.drop(
        columns=[c for c in sites.columns if c in stale or c.rsplit("_", 1)[0] in stale]
    ).merge(match, on="site_id", how="left")
    cal_obs = _obs_for_calibration(obs, sites, cfg)
    baseline = config.area()["periods"]["baseline"]
    typer.echo(
        f"較正地点 {cal_obs.site_id.nunique()} 箇所 × 平休日 = {len(cal_obs)} 観測（基準期間 {baseline}）"
    )

    # 距離抵抗と到着端の格子探索（基準期間のみ再構築）
    # 到着端係数は他の係数と取引させると学習地区に特化して転移しなくなるので、
    # 最適化に任せず全観測に対する格子探索で 1 つ決める。
    acc_grid = cfg.get("access_weight_grid") or [coef["od"].get("access_weight", 0.0)]
    results, matches = [], []
    for half, acc in itertools.product(cfg["half_distance_grid"], acc_grid):
        c = json.loads(json.dumps(coef))
        c["od"]["half_distance_m"] = half
        c["od"]["access_weight"] = acc
        _, lf = run_build(periods=[baseline], coef=c, write=False, tables=tables)
        m, met, k = evaluate(lf, cal_obs, baseline)
        cv = block_cv(m)
        r = {
            "half_distance_m": half,
            "access_weight": acc,
            "scale_k": round(k, 4),
            "in_sample": met,
            "block_cv": cv,
        }
        results.append(r)
        typer.echo(
            f"  half={half}m access={acc:g}  spearman={met['spearman']}  "
            f"cv_spearman={cv['spearman']}  mape={met['mape']}"
        )
        matches.append(m)

    tol = float(cfg.get("spearman_tolerance", 0.01))
    ci, n_near = choose_grid_point(results, tol)
    chosen, chosen_match = results[ci], matches[ci]
    if n_near > 1:
        typer.echo(f"  順位が最良から {tol} 以内の {n_near} 点のうち、MAPE 最小の点を採用")
    typer.echo(
        f"採用: half_distance={chosen['half_distance_m']}m, "
        f"access_weight={chosen['access_weight']:g}, k={chosen['scale_k']}  "
        f"(spearman_cv={chosen['block_cv']['spearman']}, mape={chosen['in_sample']['mape']})"
    )

    if write:
        typer.echo(f"採用値を {write_back_chosen(chosen).name} に書き戻した")

    # 採用パラメータで全期間を再構築し、較正後 link_flow を保存
    c = json.loads(json.dumps(coef))
    c["od"]["half_distance_m"] = chosen["half_distance_m"]
    c["od"]["access_weight"] = chosen["access_weight"]
    bpop, lf = run_build(periods=None, coef=c, write=write, tables=tables)
    lf["flow_calibrated"] = (lf.flow_synth * chosen["scale_k"]).round(1)
    lf = lf.merge(_confidence_by_link(tables["road_link"], sites, coef), on="link_id", how="left")
    calib = {
        "baseline_period": baseline,
        "chosen": {k_: v for k_, v in chosen.items() if k_ != "match"},
        "grid": results,
        "sites_used": chosen
        and chosen_match[["site_id", "name", "block", "day_type", "count", "flow_synth", "pred"]]
        .round(1)
        .to_dict(orient="records"),
        "site_matching": match.to_dict(orient="records"),
        "elapsed_s": round(time.time() - t0, 1),
    }
    if write:
        config.write_table(lf, p.table("link_flow"), index=False)
        config.write_table(sites, p.table("count_site"))
        with open(p.processed / "calibration.json", "w", encoding="utf-8") as f:
            json.dump(calib, f, ensure_ascii=False, indent=2)
        write_eval_md(calib, chosen_match, p.docs)
        typer.echo(
            f"saved link_flow (calibrated), calibration.json, {eval_paths(p.docs)[0].relative_to(config.ROOT)} ({time.time() - t0:.1f}s)"
        )
    return calib


def _run_transfer(tables, sites, coef, write, t0) -> dict:
    """実測通行量が無いエリア: 他エリアで較正した距離抵抗とスケールを転用（area.yaml: calibrate_transfer）."""
    from jinryu.pipeline import run_build

    tr = config.area().get("calibrate_transfer") or {}
    half = tr.get("half_distance_m", coef["od"]["half_distance_m"])
    k = tr.get("scale_k", 1.0)
    typer.echo(
        f"実測通行量が無いため較正はスキップ。転用パラメータ half_distance={half}m, k={k}（{tr.get('source', '未指定')}）"
    )
    c = json.loads(json.dumps(coef))
    c["od"]["half_distance_m"] = half
    if "access_weight" in tr:
        c["od"]["access_weight"] = tr["access_weight"]
    p = config.paths()
    _, lf = run_build(periods=None, coef=c, write=write, tables=tables)
    lf["flow_calibrated"] = (lf.flow_synth * k).round(1)
    lf["confidence"] = "low"
    lf["nearest_site_m"] = float("nan")
    calib = {
        "baseline_period": config.area()["periods"]["baseline"],
        "transfer": tr,
        "chosen": {
            "half_distance_m": half,
            "access_weight": c["od"].get("access_weight", 0.0),
            "scale_k": k,
            "in_sample": {"n": 0, "spearman": None, "mape": None, "top20_hit": None},
            "block_cv": {"blocks": [], "n": 0, "spearman": None, "mape": None, "top20_hit": None},
        },
        "grid": [],
        "sites_used": [],
        "site_matching": [],
        "elapsed_s": round(time.time() - t0, 1),
    }
    if write:
        config.write_table(lf, p.table("link_flow"), index=False)
        with open(p.processed / "calibration.json", "w", encoding="utf-8") as f:
            json.dump(calib, f, ensure_ascii=False, indent=2)
        typer.echo("saved link_flow (transfer), calibration.json")
    return calib


def _confidence_by_link(links: gpd.GeoDataFrame, sites: gpd.GeoDataFrame, coef: dict) -> pd.DataFrame:
    """較正地点からの距離で high/mid/low（仕様 5.6 の簡易信頼度）."""
    plane = config.epsg_plane()
    l_ = links[["link_id", "geometry"]].to_crs(plane)
    s = sites[~sites.kind.isin(coef["calibrate"]["exclude_site_kinds"])][["site_id", "geometry"]].to_crs(
        plane
    )
    j = gpd.sjoin_nearest(l_, s, how="left", distance_col="d")
    j = j[~j.index.duplicated()]
    d1, d2, _ = coef["disclosure"]["confidence_distance_m"]
    conf = np.where(j.d <= d1, "high", np.where(j.d <= d2, "mid", "low"))
    return pd.DataFrame(
        {"link_id": j.link_id.values, "confidence": conf, "nearest_site_m": j.d.round(0).values}
    )


def eval_paths(docs: Path) -> tuple[Path, Path, str]:
    """エリアごとに EVAL を分ける（docs/EVAL.md は岡山、docs/EVAL_<area>.md はそれ以外）."""
    a = os.environ.get("JINRYU_AREA", "").strip()
    if a and a != "okayama":
        return docs / f"EVAL_{a}.md", docs / "eval" / f"scatter_{a}.png", f"eval/scatter_{a}.png"
    return docs / "EVAL.md", docs / "eval" / "scatter.png", "eval/scatter.png"


def write_eval_md(calib: dict, m: pd.DataFrame, docs: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    md_path, png_path, png_rel = eval_paths(docs)
    (docs / "eval").mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(5.5, 5))
    floor = max(1.0, min(m["count"][m["count"] > 0].min(), m.pred[m.pred > 0].min()) * 0.5)
    for dt, mk in (("weekday", "o"), ("holiday", "^")):
        mm = m[m.day_type == dt]
        ax.scatter(mm["count"].clip(lower=floor), mm.pred.clip(lower=floor), marker=mk, label=dt, alpha=0.8)
        for _, r in mm.iterrows():
            ax.annotate(
                r.site_id + ("(0)" if r.pred <= 0 else ""),
                (max(r["count"], floor), max(r.pred, floor)),
                fontsize=7,
                alpha=0.7,
            )
    lim = [floor, max(m["count"].max(), m.pred.max()) * 1.3]
    ax.plot(lim, lim, "k--", lw=0.8)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("observed (AI camera, persons/day)")
    ax.set_ylabel("estimated (calibrated)")
    ax.legend()
    ax.set_title(f"{config.area()['area']['name']}: link flow vs observed")
    fig.tight_layout()
    fig.savefig(png_path, dpi=130)
    plt.close(fig)

    ch = calib["chosen"]
    obs_src = (
        "岡山市 AIカメラ通行量（2024年〜）の全月平均"
        if "EVAL.md" == md_path.name
        else "福岡市 歩行者交通量等調査 令和6年度（7:00–20:00 の13時間計、平日・休日各1日）"
    )
    lines = [
        f"# 評価レポート: {config.area()['area']['name']}（自動生成: `jinryu calibrate`）",
        "",
        f"- 基準期間: {calib['baseline_period']}（人流オープンデータ）／実測: {obs_src}",
        f"- 較正地点数: {m.site_id.nunique()} 箇所（街路地点のみ。地下街・入退場・広場地点は除外）× 平日/休日 = {len(m)} 観測",
        f"- 採用パラメータ: half_distance = {ch['half_distance_m']} m, "
        f"到着端 access_weight = {ch.get('access_weight', 0):g}, スケール k = {ch['scale_k']}",
        "",
        "## 指標",
        "",
        "| 評価 | n | Spearman | MAPE | 上位20%一致率 |",
        "|---|---|---|---|---|",
        f"| in-sample | {ch['in_sample']['n']} | {ch['in_sample']['spearman']} | {ch['in_sample']['mape']} | {ch['in_sample']['top20_hit']} |",
        f"| ブロック別スケール CV (leave-one-block-out: {', '.join(ch['block_cv']['blocks'])}"
        f"／再推定するのはスケール k のみ) | {ch['block_cv']['n']} | {ch['block_cv']['spearman']} | {ch['block_cv']['mape']} | {ch['block_cv']['top20_hit']} |",
        "",
        f"H1 の目標 Spearman ≥ {config.coefficients()['calibrate']['target_spearman']}: "
        + (
            "**達成**"
            if (ch["block_cv"]["spearman"] or 0) >= config.coefficients()["calibrate"]["target_spearman"]
            else "**未達**（下の考察を参照）"
        ),
        "",
        "## 距離抵抗と到着端の格子探索",
        "",
        "| half_distance (m) | access_weight | k | Spearman (in) | Spearman (CV) | MAPE (in) |",
        "|---|---|---|---|---|---|",
    ]
    for r in calib["grid"]:
        lines.append(
            f"| {r['half_distance_m']} | {r.get('access_weight', 0):g} | {r['scale_k']} | "
            f"{r['in_sample']['spearman']} | {r['block_cv']['spearman']} | {r['in_sample']['mape']} |"
        )
    lines += [
        "",
        "## 散布図",
        "",
        "![scatter](eval/scatter.png)",
        "",
        "## 地点別",
        "",
        "| 地点 | ブロック | 平休 | 実測 | 合成値 | 推定 | 比 |",
        "|---|---|---|---|---|---|---|",
    ]
    for _, r in m.sort_values(["block", "site_id", "day_type"]).iterrows():
        ratio = r.pred / r["count"] if r["count"] else float("nan")
        lines.append(
            f"| {r.site_id} {r['name']} | {r.block} | {r.day_type} | {r['count']:.0f} | {r.flow_synth:.0f} | {r.pred:.0f} | {ratio:.2f} |"
        )
    lines += [
        "",
        "## 外れ値と考察（v0.1）",
        "",
        "- 駅前広場（S07-1）は駅出入りの「上り下り」カウントで、街路通行量とは性質が異なるため較正から除外。地下街 4 地点（S10〜S13）も同様。",
        "- 人流データ（2019〜2021年）と実測（2024年〜）で期間が 3〜5 年ずれている。相対的な空間分布は安定という仮定を置いている。",
        "- 表町商店街（アーケード）は OSM 上 pedestrian/footway として繋がっているが、天満屋などの大規模商業の集中点をアーケード側の前面リンクに正しく寄せられているかは要確認。",
        "- 較正地点が 10 箇所前後と少なく、Spearman の信頼区間は広い。隔年の「岡山市商店街等通行量調査」（時間帯別・多地点）を手入力 CSV で追加することが精度評価の最優先課題。",
        "",
        "### Spearman 未達時の原因仮説（3つ）",
        "",
        "1. **集中点の重み**: 延床面積×用途係数 α だけでは、百貨店・駅ビルのような「来訪者密度」の高い施設を過小評価する。POI 密度や売場面積（経済センサス）で補正する。",
        "2. **経路配分が all-or-nothing**: 並行する街路（アーケード vs 車道歩道）の分担が極端になる。確率的配分（ロジット）や歩行環境ペナルティが必要。",
        "3. **発生点の粒度**: 1km メッシュの深夜人口を住宅に配分した発生量は、駅からの流入（乗降客数）に比べ粗い。商用人流（500m/100m メッシュ）でメッシュ側の解像度を上げる。",
    ]
    md_path.write_text("\n".join(lines), encoding="utf-8")
