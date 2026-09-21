#!/usr/bin/env python3
"""タイルを復号し、再投影前の元 GeoTIFF（EPSG:6676 の VRT）と直接突き合わせる。

タイル画素中心（EPSG:3857 のタイル格子）→ 経緯度 → EPSG:6676 に変換して元ラスタを
最近傍で参照する。merged.tif を経由しないので、再投影とタイル化を含めた
全工程の位置ずれ・値ずれを見る。
"""
import argparse, os, random, json, sys
import numpy as np
from PIL import Image
import rasterio
from rasterio.warp import transform
sys.path.insert(0, os.path.dirname(__file__))
from decode_check import tile_px_lonlat, decode, list_tiles

ap = argparse.ArgumentParser()
ap.add_argument("--output", required=True); ap.add_argument("--vrt", required=True)
ap.add_argument("--kind", required=True); ap.add_argument("--zoom", type=int, required=True)
ap.add_argument("--samples", type=int, default=40); ap.add_argument("--seed", type=int, default=0)
a = ap.parse_args()
tiles = list_tiles(os.path.join(a.output, a.kind), a.zoom)
random.seed(a.seed); random.shuffle(tiles); tiles = tiles[: a.samples]
src = rasterio.open(a.vrt)
nod = src.nodata
rng = np.random.default_rng(a.seed)
d_all, d_int = [], []
n_valid = n_nod = 0
for (z, x, y) in tiles:
    img = np.asarray(Image.open(os.path.join(a.output, a.kind, str(z), str(x), f"{y}.png")).convert("RGB"))
    size = img.shape[0]
    h, valid = decode(a.kind, img)
    lon, lat = tile_px_lonlat(z, x, y, size)
    idx = rng.choice(size * size, size=min(3000, size * size), replace=False)
    lo, la = lon.ravel()[idx], lat.ravel()[idx]
    ex, ny = transform("EPSG:4326", src.crs, list(lo), list(la))
    ex, ny = np.array(ex), np.array(ny)
    v = np.array([q[0] for q in src.sample(zip(ex, ny))], dtype=np.float64)
    hv, vv = h.ravel()[idx], valid.ravel()[idx]
    ok = (v != nod) & vv
    n_valid += ok.sum(); n_nod += (v == nod).sum()
    d_all.append(hv[ok] - v[ok])
    interior = v != nod
    for dx in (-0.5, 0, 0.5):
        for dy in (-0.5, 0, 0.5):
            if dx == 0 and dy == 0: continue
            nb = np.array([q[0] for q in src.sample(zip(ex + dx, ny + dy))], dtype=np.float64)
            interior &= nb != nod
    d_int.append(hv[interior & vv] - v[interior & vv])
d = np.concatenate(d_all); di = np.concatenate(d_int)
print(json.dumps({"kind": a.kind, "zoom": a.zoom, "tiles": len(tiles), "valid_px": int(n_valid), "src_nodata_px": int(n_nod),
    "abs_max": float(np.abs(d).max()), "abs_mean": float(np.abs(d).mean()), "bias_mean": float(d.mean()),
    "within_0.1m": float((np.abs(d) <= 0.1001).mean()), "within_0.5m": float((np.abs(d) <= 0.5).mean()),
    "interior_px": int(di.size), "interior_abs_max": float(np.abs(di).max()), "interior_abs_mean": float(np.abs(di).mean()),
    "interior_within_0.1m": float((np.abs(di) <= 0.1001).mean()), "interior_within_0.5m": float((np.abs(di) <= 0.5).mean())}))
