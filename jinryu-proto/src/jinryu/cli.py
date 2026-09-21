"""jinryu CLI: fetch / ingest / build / calibrate / score."""

from __future__ import annotations

import json
import time

import typer

from jinryu import config

app = typer.Typer(help="人流ポテンシャル評価プロトタイプ", no_args_is_help=True)


@app.command()
def fetch(
    flow: bool = typer.Option(True, help="人流オープンデータ"),
    ksj: bool = typer.Option(True, help="国土数値情報"),
    osm: bool = typer.Option(True, help="OSM タイル"),
    plateau: bool = typer.Option(True, help="PLATEAU 建物（HTTP Range で部分取得）"),
    counts: bool = typer.Option(True, help="岡山市 AIカメラ通行量 xlsx"),
):
    """オープンデータを data/raw に取得する（存在するものはスキップ）."""
    from jinryu.ingest import fetch as f

    if flow:
        f.fetch_mlit_flow()
    if ksj:
        f.fetch_ksj()
    if osm:
        f.fetch_osm_tiles()
    if plateau:
        f.fetch_plateau_bldg()
    if counts:
        f.fetch_okayama_counts()


@app.command()
def ingest():
    """raw → processed/*.parquet（mesh_flow, building, road_link, node, count_site, count_obs, station, zoning, land_price, poi）."""
    from jinryu.adapters import get_source
    from jinryu.ingest import counts, ksj, osm, plateau
    from jinryu.units import build as ub

    p = config.paths()
    p.processed.mkdir(parents=True, exist_ok=True)
    p.interim.mkdir(parents=True, exist_ok=True)
    summary = {}
    t0 = time.time()

    src = get_source()
    periods = [q for q in config.area()["periods"]["available"] if q in src.available_periods()]
    import pandas as pd

    ring = (
        config.coefficients()["od"].get("external", {}).get("ring_km", 0)
        if config.coefficients()["od"].get("external", {}).get("enabled")
        else 0
    )
    x0, y0, x1, y1 = config.bbox()
    dlon, dlat = ring / 91.0, ring / 111.0
    mesh_flow = pd.concat(
        [src.load((x0 - dlon, y0 - dlat, x1 + dlon, y1 + dlat), q) for q in periods], ignore_index=True
    )
    mesh_flow["in_core"] = mesh_flow.mesh_code.isin(set(config.area()["mesh3_codes"]))
    mesh_flow.to_parquet(p.table("mesh_flow"), index=False)
    mix = pd.concat(
        [src.load_origin_mix(config.area()["area"]["city_codes"], q) for q in periods], ignore_index=True
    )
    mix.to_parquet(p.table("origin_mix"), index=False)
    summary["mesh_flow"] = {
        "rows": len(mesh_flow),
        "meshes": int(mesh_flow.mesh_code.nunique()),
        "periods": periods,
    }
    typer.echo(f"mesh_flow: {summary['mesh_flow']}")

    st = ksj.stations()
    st.to_parquet(p.table("station"))
    zn = ksj.zoning()
    zn.to_parquet(p.table("zoning"))
    lp = ksj.land_price()
    lp.to_parquet(p.table("land_price"))
    summary["station"] = len(st)
    summary["zoning"] = len(zn)
    summary["land_price"] = len(lp)
    typer.echo(f"station {len(st)}, zoning {len(zn)}, land_price {len(lp)}")

    links, nodes, pois = osm.build_network()
    links.to_parquet(p.table("road_link"))
    nodes.to_parquet(p.table("node"), index=False)
    if len(pois):
        pois.to_parquet(p.table("poi"))
    summary["road_link"] = {
        "links": len(links),
        "nodes": len(nodes),
        "km": round(float(links.length_m.sum()) / 1000, 1),
    }
    typer.echo(f"road_link: {summary['road_link']}")

    b = plateau.build_building_table()
    b = ub.attach_mesh_and_zoning(b, zn)
    b = ub.attach_nodes(b, nodes)
    fl = ub.front_link(b, links)
    b["front_link_id"] = fl.front_link_id.values
    b["front_dist_m"] = fl.front_dist_m.values
    b.to_parquet(p.table("building"))
    summary["building"] = {
        "rows": len(b),
        "usage_class": b.usage_class.value_counts().to_dict(),
        "gfa_estimated_share": round(float(b.gfa_is_estimated.mean()), 3),
        "floors_estimated_share": round(float(b.floors_is_estimated.mean()), 3),
        "zoning_missing_share": round(float((b.zoning == "unknown").mean()), 3),
        "no_front_link_share": round(float(b.front_link_id.isna().mean()), 3),
    }
    typer.echo(f"building: {summary['building']}")

    sites, obs, daily = counts.build_count_tables()
    sites.to_parquet(p.table("count_site"))
    obs.to_parquet(p.table("count_obs"), index=False)
    if len(daily):
        daily.to_parquet(p.table("count_daily"), index=False)
    summary["counts"] = {
        "sites": len(sites),
        "obs": len(obs),
        "periods": sorted(obs.period.unique().tolist()),
    }
    typer.echo(f"counts: {summary['counts']}")

    summary["elapsed_s"] = round(time.time() - t0, 1)
    with open(p.processed / "ingest_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    typer.echo(f"done in {summary['elapsed_s']} s → {p.processed}")


@app.command()
def build(
    period: list[str] = typer.Option(None, help="対象期間 YYYY-MM（省略時は area.yaml の available 全部）"),
):
    """① 建物配分 → ② OD → ③ 経路配分 → link_flow(合成値)."""
    from jinryu.pipeline import run_build

    run_build(periods=period or None)


@app.command()
def calibrate():
    """④ 較正（スケール・距離抵抗）と空間ブロック CV 評価 → docs/EVAL.md."""
    from jinryu.calibrate import run_calibration

    run_calibration()


@app.command()
def score():
    """⑤ 建物スコア表 parcel_score を生成."""
    from jinryu.score import build_parcel_scores

    build_parcel_scores()


@app.command("export-html")
def export_html(fragment: bool = False, out: str | None = None):
    """サーバ不要の単一 HTML（dist/jinryu-demo.html）を書き出す。--fragment は Artifact 用（head/body 無し）."""
    from pathlib import Path

    from jinryu.export_html import render

    render(fragment=fragment, out=Path(out) if out else None)


if __name__ == "__main__":
    app()
