"""FastAPI: 仕様 7 章の API + web/ の静的配信."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any

import geopandas as gpd
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from shapely.geometry import shape

from jinryu import config
from jinryu.score import Store

STORE: dict[str, Store] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    STORE["s"] = Store()
    yield
    STORE.clear()


app = FastAPI(title="人流ポテンシャル評価 API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=50_000)
_CACHE: dict[str, dict] = {}  # GeoJSON レスポンスのメモリキャッシュ（建物 3 万棟の直列化が数秒かかるため）


def store() -> Store:
    return STORE["s"]


def _sources_block() -> dict[str, Any]:
    src = config.sources()
    return {
        "sources": [
            {
                "id": s["id"],
                "name": s["name"],
                "provider": s.get("provider"),
                "url": s.get("url"),
                "period": s.get("period"),
                "license": s.get("license"),
                "credit": s.get("credit"),
            }
            for s in src["sources"]
            if s.get("fetched_at")
        ],
        "disclaimer": src["disclaimer"].strip(),
    }


def _with_meta(payload: dict) -> dict:
    return {**payload, **_sources_block()}


# ---------------------------------------------------------------- meta
@app.get("/areas/current")
def areas_current():
    a = config.area()["area"]
    s = store()
    cal = s.calibration.get("chosen", {})
    return _with_meta(
        {
            "area": a,
            "periods": s.periods,
            "baseline_period": config.area()["periods"]["baseline"],
            "day_types": ["weekday", "holiday"],
            "time_bands": [
                {"id": "day", "label": "昼（11–14時台）"},
                {"id": "night", "label": "深夜（1–4時台）"},
                {"id": "all", "label": "終日"},
            ],
            "counts": {
                "buildings": int(s.building.in_bbox.sum()),
                "links": len(s.link),
                "count_sites": len(s.count_site),
            },
            "calibration": {
                "half_distance_m": cal.get("half_distance_m"),
                "scale_k": cal.get("scale_k"),
                "spearman_in_sample": (cal.get("in_sample") or {}).get("spearman"),
                "spearman_block_cv": (cal.get("block_cv") or {}).get("spearman"),
                "n_sites": (cal.get("in_sample") or {}).get("n"),
            },
        }
    )


@app.get("/meta/sources")
def meta_sources():
    return _sources_block()


# ---------------------------------------------------------------- layers
def _geojson(gdf: gpd.GeoDataFrame, props: list[str], tol: float = 0.000005) -> dict:
    import shapely

    g = gdf[props + ["geometry"]].copy()
    g["geometry"] = shapely.set_precision(g.geometry.simplify(tol).values, 1e-6)
    return json.loads(g.to_json(drop_id=True))


@app.get("/links/flow")
def links_flow(
    period: str = Query(...), day_type: str = "weekday", time_band: str = "all", min_flow: float = 0
):
    s = store()
    f = s.flows(period, day_type, time_band)
    if not len(f):
        raise HTTPException(
            404, f"period={period} day_type={day_type} time_band={time_band} のデータがありません"
        )
    g = s.link.merge(f[["link_id", "flow_synth", "flow_calibrated", "confidence"]], on="link_id", how="left")
    g["flow_calibrated"] = g.flow_calibrated.fillna(0).round(0)
    g = g[g.flow_calibrated >= min_flow]
    minv = s.coef["disclosure"]["min_value"]
    g.loc[g.flow_calibrated < minv, "flow_calibrated"] = 0
    g["pct"] = (g.flow_calibrated.rank(pct=True) * 100).round(0)
    return JSONResponse(
        _geojson(g, ["link_id", "name", "highway_type", "flow_calibrated", "pct", "confidence"])
    )


@app.get("/buildings/pop")
def buildings_pop(
    period: str = Query(...), day_type: str = "weekday", time_band: str = "day", with_geometry: bool = True
):
    s = store()
    bp = s.bpop(period, day_type, time_band)
    if not len(bp):
        raise HTTPException(404, "データがありません")
    b = s.building[s.building.in_bbox].merge(
        bp[["building_id", "pop_est", "confidence"]], on="building_id", how="left"
    )
    minv = s.coef["disclosure"]["min_value"]
    b["pop_est"] = b.pop_est.fillna(0).round(1)
    b["pop_masked"] = b.pop_est < minv
    b["height_m"] = b.height.fillna(b.floors * 3.5).round(1)
    props = [
        "building_id",
        "usage_class",
        "floors",
        "height_m",
        "gfa",
        "zoning_name",
        "pop_est",
        "pop_masked",
        "confidence",
        "front_link_id",
    ]
    if not with_geometry:
        return b[props].to_dict(orient="records")
    key = f"bpop|{period}|{day_type}|{time_band}"
    if key not in _CACHE:
        _CACHE[key] = _geojson(b, props)
    return JSONResponse(_CACHE[key])


@app.get("/sites")
def sites():
    s = store()
    g = s.count_site.copy()
    latest = (
        s.count_obs[s.count_obs.day_type == "weekday"]
        .sort_values("period")
        .drop_duplicates("site_id", keep="last")
    )
    g = g.merge(
        latest[["site_id", "period", "count"]].rename(
            columns={"period": "obs_period", "count": "obs_weekday"}
        ),
        on="site_id",
        how="left",
    )
    return JSONResponse(
        _geojson(g, ["site_id", "name", "kind", "block", "direction", "obs_period", "obs_weekday"])
    )


@app.get("/stations")
def stations():
    s = store()
    return JSONResponse(_geojson(s.station, ["station_id", "name", "operator", "line", "passengers_per_day"]))


# ---------------------------------------------------------------- scoring
class ParcelRequest(BaseModel):
    period: str
    building_id: str | None = None
    polygon: dict | None = Field(None, description="GeoJSON Polygon (EPSG:4326)")
    sales: dict | None = Field(
        None, description="capture_rate / spend_per_customer_yen / business_days_per_month"
    )


@app.post("/parcels/score")
def parcels_score(req: ParcelRequest):
    s = store()
    if req.period not in s.periods:
        raise HTTPException(400, f"period は {s.periods} のいずれか")
    if req.building_id is None and req.polygon is None:
        raise HTTPException(400, "building_id か polygon を指定")
    if req.building_id is not None and req.building_id not in s._b_by_id.index:
        raise HTTPException(404, "building_id が見つかりません")
    poly = shape(req.polygon) if req.polygon else None
    return _with_meta(s.parcel_score(req.period, req.building_id, poly, req.sales))


class CompareRequest(BaseModel):
    period_a: str
    period_b: str
    day_type: str = "weekday"
    time_band: str = "all"
    polygon: dict | None = None
    geojson: bool = True


@app.post("/compare")
def compare(req: CompareRequest):
    s = store()
    for q in (req.period_a, req.period_b):
        if q not in s.periods:
            raise HTTPException(400, f"period は {s.periods} のいずれか")
    poly = shape(req.polygon) if req.polygon else None
    res = s.compare(req.period_a, req.period_b, req.day_type, req.time_band, poly)
    links: pd.DataFrame = res.pop("links")
    out = dict(res)
    if req.geojson:
        key = f"compare|{req.period_a}|{req.period_b}|{req.day_type}|{req.time_band}"
        if key not in _CACHE:
            g = s.link.merge(links, on="link_id", how="left").fillna({"a": 0, "b": 0, "diff": 0})
            g["ratio"] = g.ratio.round(3)
            g["diff"] = g["diff"].round(0)
            _CACHE[key] = _geojson(g, ["link_id", "name", "a", "b", "diff", "ratio"])
        out["links"] = _CACHE[key]
    return _with_meta(out)


class GapRequest(BaseModel):
    period: str
    day_type: str = "weekday"
    top: int = 30
    usage_classes: list[str] | None = None


@app.post("/search/gap")
def search_gap(req: GapRequest):
    s = store()
    if req.period not in s.periods:
        raise HTTPException(400, f"period は {s.periods} のいずれか")
    t = s.gap_table(req.period, req.day_type, req.top, req.usage_classes)
    return _with_meta(
        {
            "period": req.period,
            "day_type": req.day_type,
            "items": json.loads(t.to_json(orient="records", force_ascii=False)),
        }
    )


# ---------------------------------------------------------------- web
WEB = config.ROOT / "web"
if WEB.exists():
    app.mount("/static", StaticFiles(directory=str(WEB)), name="static")

    @app.get("/")
    def index():
        return FileResponse(str(WEB / "index.html"))
