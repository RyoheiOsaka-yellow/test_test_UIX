"""スタンドアロン HTML（単一ファイル、サーバ不要）の書き出し.

- 街路リンク（2 期間 × 平休 × 時間帯 = 12 値）、建物（bbox 内）、実測地点、ギャップ上位、来街者構成、較正結果を JSON で埋め込む
- 背景地図は地理院タイル（淡色）を z16 で貼り合わせた JPEG を data URI で埋め込む（オフライン・CSP 制限下でも表示できる）
- `--fragment` で <title>/<style>/本文のみ（claude.ai Artifact 用）、既定は完全な HTML 文書
"""

from __future__ import annotations

import base64
import io
import json
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
import typer

from jinryu import config
from jinryu.score import Store

PERIODS = ("2019-10", "2021-10")
DAY_TYPES = ("weekday", "holiday")
TIME_BANDS = ("all", "day", "night")
BASEMAP_ZOOM = 16
GSI = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"


def _tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def _tile_bounds(x: int, y: int, z: int) -> tuple[float, float, float, float]:
    n = 2**z
    lon0 = x / n * 360 - 180
    lon1 = (x + 1) / n * 360 - 180
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon0, lat0, lon1, lat1


def fetch_basemap(
    bbox, z: int = BASEMAP_ZOOM, cache: Path | None = None, margin: int = 1, quality: int = 72
) -> tuple[str, list[list[float]]]:
    """地理院タイルを貼り合わせて JPEG data URI と四隅座標（MapLibre image source の順: 左上, 右上, 右下, 左下）を返す."""
    from PIL import Image

    cache = cache or config.paths().interim / f"basemap_z{z}.json"
    if cache.exists():
        d = json.loads(cache.read_text())
        return d["uri"], d["coords"]
    x0, y1 = _tile(bbox[0], bbox[1], z)
    x1, y0 = _tile(bbox[2], bbox[3], z)
    x0, y0, x1, y1 = x0 - margin, y0 - margin, x1 + margin, y1 + margin
    w, h = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
    im = Image.new("RGB", (w, h), (230, 230, 230))
    s = requests.Session()
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            r = s.get(GSI.format(z=z, x=x, y=y), timeout=60, headers={"User-Agent": "jinryu-proto/0.1"})
            if r.status_code == 200:
                im.paste(Image.open(io.BytesIO(r.content)).convert("RGB"), ((x - x0) * 256, (y - y0) * 256))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    lon0, _, _, lat1 = _tile_bounds(x0, y0, z)
    _, lat0, lon1, _ = _tile_bounds(x1, y1, z)
    coords = [[lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"uri": uri, "coords": coords}))
    typer.echo(f"basemap {w}x{h}px, {len(uri) // 1024} KB (base64)")
    return uri, coords


def _ring_ints(geom, lon0: float, lat0: float, scale: float = 1e-5) -> list[int]:
    g = geom.simplify(0.00001)
    if g.geom_type == "MultiPolygon":
        g = max(g.geoms, key=lambda p: p.area)
    xs, ys = g.exterior.coords.xy
    out = []
    for x, y in zip(xs[:-1], ys[:-1], strict=False):
        out += [int(round((x - lon0) / scale)), int(round((y - lat0) / scale))]
    return out


def prefecture_layer(store: Store) -> dict:
    """県全域の 1km メッシュ滞在人口（2 期間 × 平休 × 時間帯）. 中心部の建物・街路レイヤの「外側」を埋める広域ビュー用."""
    from jinryu.adapters import get_source

    src = get_source()
    attr = src.attributes()
    pref = config.area()["area"]["pref_code"]
    a = attr[attr.prefcode == pref]
    pbox = (float(a.lon_min.min()), float(a.lat_min.min()), float(a.lon_max.max()), float(a.lat_max.max()))
    combos = [f"{q}|{d}|{b}" for q in PERIODS for d in DAY_TYPES for b in TIME_BANDS]
    frames = {q: src.load(pbox, q) for q in PERIODS}
    piv = {}
    for q, df in frames.items():
        piv[q] = df.pivot_table(
            index="mesh_code", columns=["day_type", "time_band"], values="population", aggfunc="sum"
        )
    codes = sorted(set().union(*[set(p.index) for p in piv.values()]) & set(a.mesh_code))
    ac = a.set_index("mesh_code")
    rows = []
    for code in codes:
        vals = []
        for c in combos:
            q, d, b = c.split("|")
            v = piv[q][(d, b)].get(code, 0.0) if (d, b) in piv[q].columns else 0.0
            vals.append(int(v) if v == v else 0)
        r = ac.loc[code]
        rows.append([code, round(float(r.lon_min), 4), round(float(r.lat_min), 4), vals])
    return {"bbox": [round(v, 4) for v in pbox], "cell": [1 / 80, 1 / 120], "combos": combos, "meshes": rows}


def build_payload(store: Store) -> dict:
    s = store
    bbox = config.bbox()
    combos = [f"{q}|{d}|{b}" for q in PERIODS for d in DAY_TYPES for b in TIME_BANDS]
    # --- links
    flows = {}
    conf = None
    for c in combos:
        q, d, b = c.split("|")
        f = s.flows(q, d, b).set_index("link_id")
        flows[c] = f.flow_calibrated
        if conf is None and "confidence" in f.columns:
            conf = f.confidence
    minv = s.coef["disclosure"]["min_value"]
    links = []
    for r in s.link.itertuples():
        g = r.geometry.simplify(0.00001)
        coords = [round(v, 5) for xy in g.coords for v in xy]
        fl = [float(flows[c].get(r.link_id, 0.0)) for c in combos]
        fl = [0 if v < minv else round(v) for v in fl]
        links.append(
            [
                r.link_id,
                r.name if isinstance(r.name, str) else "",
                r.highway_type,
                (conf.get(r.link_id, "low") if conf is not None else "low"),
                coords,
                fl,
            ]
        )
    # --- buildings (bbox 内、極小除外)
    lon0, lat0 = bbox[0], bbox[1]
    bp_day = s.bpop(PERIODS[0], "weekday", "day").set_index("building_id").pop_est
    bp_night = s.bpop(PERIODS[0], "weekday", "night").set_index("building_id").pop_est
    gap = s.gap_score(PERIODS[0])
    b = s.building[s.building.in_bbox & (s.building.footprint_area >= 12)].copy()
    # 用途地域ポリゴンから建蔽率・容積率を重心で付与
    zoning = gpd.read_parquet(s.p.table("zoning"))
    pts = gpd.GeoDataFrame(
        b[["building_id"]], geometry=gpd.points_from_xy(b.centroid_lon, b.centroid_lat), crs="EPSG:4326"
    )
    zj = gpd.sjoin(pts, zoning[["zone_code", "bcr", "far", "geometry"]], how="left", predicate="within")
    zj = zj[~zj.index.duplicated()]
    b["zone_code"] = pd.to_numeric(zj.zone_code.values, errors="coerce")
    b["bcr"] = zj.bcr.values
    b["far"] = zj.far.values
    # 最寄りの地価公示
    if len(s.land_price):
        lp = s.land_price.to_crs(config.epsg_plane())
        nj = gpd.sjoin_nearest(
            pts.to_crs(config.epsg_plane()),
            lp[["price_yen_m2", "geometry"]],
            how="left",
            distance_col="lp_dist",
        )
        nj = nj[~nj.index.duplicated()]
        b["lp_price"] = nj.price_yen_m2.values
        b["lp_dist"] = nj.lp_dist.values
    else:
        b["lp_price"] = float("nan")
        b["lp_dist"] = float("nan")
    items = []
    for r in b.itertuples():
        pd_ = float(bp_day.get(r.building_id, 0.0))
        pn_ = float(bp_night.get(r.building_id, 0.0))
        year = int(r.year_built) if str(r.year_built).isdigit() and 1800 < int(r.year_built) < 2100 else None
        items.append(
            [
                r.building_id,
                r.usage_class,
                int(r.floors),
                (None if pd.isna(r.height) else round(float(r.height), 1)),
                round(float(r.gfa)),
                (r.zoning_name if isinstance(r.zoning_name, str) else ""),
                (r.front_link_id if isinstance(r.front_link_id, str) else ""),
                (None if pd_ < minv else round(pd_)),
                (None if pn_ < minv else round(pn_)),
                (round(gap[r.building_id], 1) if r.building_id in gap else None),
                bool(r.gfa_is_estimated),
                _ring_ints(r.geometry, lon0, lat0),
                (None if pd.isna(r.zone_code) else int(r.zone_code)),
                (None if pd.isna(r.bcr) else int(r.bcr)),
                (None if pd.isna(r.far) else int(r.far)),
                year,
                (None if pd.isna(r.lp_price) else int(r.lp_price)),
                (None if pd.isna(r.lp_dist) else int(r.lp_dist)),
                round(float(r.footprint_area)),
            ]
        )
    # 用途地域ポリゴン（レイヤ表示用）
    zpolys = []
    for r in zoning.itertuples():
        g = r.geometry.simplify(0.00003)
        for gg in g.geoms if g.geom_type == "MultiPolygon" else [g]:
            zpolys.append([int(r.zone_code), r.zone_name, int(r.bcr), int(r.far), _ring_ints(gg, lon0, lat0)])
    # 地価公示
    lps = []
    for r in s.land_price.itertuples():
        lps.append(
            [
                round(float(r.geometry.x), 5),
                round(float(r.geometry.y), 5),
                (None if pd.isna(r.price_yen_m2) else int(r.price_yen_m2)),
                r.address,
                getattr(r, "current_use", ""),
                (None if pd.isna(getattr(r, "change_pct", float("nan"))) else float(r.change_pct)),
            ]
        )
    # --- sites
    latest = (
        s.count_obs[s.count_obs.day_type == "weekday"]
        .sort_values("period")
        .drop_duplicates("site_id", keep="last")
        .set_index("site_id")
    )
    sites = []
    for r in s.count_site.itertuples():
        o = latest.loc[r.site_id] if r.site_id in latest.index else None
        sites.append(
            [
                r.site_id,
                r.name,
                r.kind,
                r.block,
                r.direction,
                round(float(r.geometry.x), 5),
                round(float(r.geometry.y), 5),
                (o.period if o is not None else None),
                (round(float(o["count"])) if o is not None else None),
            ]
        )
    # --- gap top / origin mix / calibration
    gap_top = {
        q: json.loads(s.gap_table(q, "weekday", 25).to_json(orient="records", force_ascii=False))
        for q in PERIODS
    }
    mix = {q: s.origin_mix_for(q) for q in PERIODS}
    cal = s.calibration.get("chosen", {})
    src = config.sources()
    return {
        "area": {
            "name": config.area()["area"]["name"],
            "bbox": list(bbox),
            "periods": list(PERIODS),
            "baseline": PERIODS[0],
            "counts": {"buildings": len(items), "links": len(links), "sites": len(sites)},
        },
        "calibration": {
            "half_distance_m": cal.get("half_distance_m"),
            "scale_k": cal.get("scale_k"),
            "spearman_in_sample": (cal.get("in_sample") or {}).get("spearman"),
            "spearman_block_cv": (cal.get("block_cv") or {}).get("spearman"),
            "n_sites": (cal.get("in_sample") or {}).get("n"),
        },
        "combos": combos,
        "links": links,
        "buildings": {"origin": [lon0, lat0], "scale": 1e-5, "items": items},
        "zoning": zpolys,
        "land_price": lps,
        "sites": sites,
        "gap_top": gap_top,
        "origin_mix": mix,
        "sales": s.coef["sales"],
        "prefecture": prefecture_layer(s),
        "pref_name": config.area()["area"].get("pref_name", ""),
        "sources": [
            {"name": x["name"], "credit": x.get("credit"), "license": x.get("license"), "url": x.get("url")}
            for x in src["sources"]
            if x.get("fetched_at")
        ],
        "disclaimer": src["disclaimer"].strip(),
    }


def _inline_js(path: Path) -> str:
    """<script> にインラインするため、文字列中の </script を閉じタグと誤認されない形にする."""
    return path.read_text(encoding="utf-8").replace("</script", "<\\/script")


def render(fragment: bool = False, out: Path | None = None) -> Path:
    store = Store()
    payload = build_payload(store)
    uri, coords = fetch_basemap(config.bbox())
    pref_uri, pref_coords = fetch_basemap(
        tuple(payload["prefecture"]["bbox"]),
        z=config.area().get("basemap_pref_zoom", 11),
        margin=0,
        quality=60,
    )
    tpl = (config.ROOT / "web" / "standalone.html").read_text(encoding="utf-8")
    vendor = config.ROOT / "web" / "vendor"
    css = (vendor / "maplibre-gl.css").read_text(encoding="utf-8")
    html = (
        tpl.replace("/*__MAPLIBRE_CSS__*/", css)
        .replace("/*__VENDOR_MAPLIBRE__*/", _inline_js(vendor / "maplibre-gl.js"))
        .replace("/*__VENDOR_DECK__*/", _inline_js(vendor / "deck.min.js"))
        .replace("__BASEMAP_URI__", uri)
        .replace("/*__BASEMAP_COORDS__*/", json.dumps(coords))
        .replace("__PREF_URI__", pref_uri)
        .replace("/*__PREF_COORDS__*/", json.dumps(pref_coords))
        .replace("/*__DATA__*/", json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    )
    if not fragment:
        html = (
            '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
            + html.replace("<!--BODY-->", "</head>\n<body>", 1)
            + "\n</body>\n</html>\n"
        )
    else:
        html = html.replace("<!--BODY-->", "", 1)
    out = out or (config.ROOT / "dist" / ("jinryu-demo.fragment.html" if fragment else "jinryu-demo.html"))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    typer.echo(
        f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB): links {len(payload['links'])}, buildings {len(payload['buildings']['items'])}"
    )
    return out


if __name__ == "__main__":
    import sys

    render(fragment="--fragment" in sys.argv)
