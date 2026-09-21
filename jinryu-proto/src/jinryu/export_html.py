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


def fetch_basemap(bbox, z: int = BASEMAP_ZOOM, cache: Path | None = None) -> tuple[str, list[list[float]]]:
    """地理院タイルを貼り合わせて JPEG data URI と四隅座標（MapLibre image source の順: 左上, 右上, 右下, 左下）を返す."""
    from PIL import Image

    cache = cache or config.paths().interim / f"basemap_z{z}.json"
    if cache.exists():
        d = json.loads(cache.read_text())
        return d["uri"], d["coords"]
    x0, y1 = _tile(bbox[0], bbox[1], z)
    x1, y0 = _tile(bbox[2], bbox[3], z)
    x0, y0, x1, y1 = x0 - 1, y0 - 1, x1 + 1, y1 + 1
    w, h = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
    im = Image.new("RGB", (w, h), (230, 230, 230))
    s = requests.Session()
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            r = s.get(GSI.format(z=z, x=x, y=y), timeout=60, headers={"User-Agent": "jinryu-proto/0.1"})
            if r.status_code == 200:
                im.paste(Image.open(io.BytesIO(r.content)).convert("RGB"), ((x - x0) * 256, (y - y0) * 256))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=72, optimize=True)
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
    b = s.building[s.building.in_bbox & (s.building.footprint_area >= 12)]
    items = []
    for r in b.itertuples():
        pd_ = float(bp_day.get(r.building_id, 0.0))
        pn_ = float(bp_night.get(r.building_id, 0.0))
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
        "sites": sites,
        "gap_top": gap_top,
        "origin_mix": mix,
        "sales": s.coef["sales"],
        "sources": [
            {"name": x["name"], "credit": x.get("credit"), "license": x.get("license"), "url": x.get("url")}
            for x in src["sources"]
            if x.get("fetched_at")
        ],
        "disclaimer": src["disclaimer"].strip(),
    }


def render(fragment: bool = False, out: Path | None = None) -> Path:
    store = Store()
    payload = build_payload(store)
    uri, coords = fetch_basemap(config.bbox())
    tpl = (config.ROOT / "web" / "standalone.html").read_text(encoding="utf-8")
    css = (config.ROOT / "web" / "vendor" / "maplibre-gl.css").read_text(encoding="utf-8")
    html = (
        tpl.replace("/*__MAPLIBRE_CSS__*/", css)
        .replace("__BASEMAP_URI__", uri)
        .replace("/*__BASEMAP_COORDS__*/", json.dumps(coords))
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
