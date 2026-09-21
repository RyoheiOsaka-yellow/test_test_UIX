#!/usr/bin/env python3
"""復号値と元 DEM の差が、元 DEM の局所起伏（3x3 近傍の max-min）で説明できるかを見る。

差 |d| が局所起伏を超える画素は、リサンプリングでは説明できない「本当のずれ」。
"""
import os, sys, random, json
import numpy as np
from PIL import Image
import rasterio
from rasterio.warp import transform
sys.path.insert(0, os.path.dirname(__file__))
from decode_check import tile_px_lonlat, decode, list_tiles
out, vrt, kind, zoom, n = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
tiles = list_tiles(os.path.join(out, kind), zoom); random.seed(11); random.shuffle(tiles); tiles = tiles[:n]
src = rasterio.open(vrt); nod = src.nodata; rng = np.random.default_rng(11)
D, RNG = [], []
for (z, x, y) in tiles:
    img = np.asarray(Image.open(os.path.join(out, kind, str(z), str(x), f"{y}.png")).convert("RGB"))
    size = img.shape[0]; h, valid = decode(kind, img)
    lon, lat = tile_px_lonlat(z, x, y, size)
    idx = rng.choice(size * size, size=2000, replace=False)
    ex, ny = transform("EPSG:4326", src.crs, list(lon.ravel()[idx]), list(lat.ravel()[idx])); ex, ny = np.array(ex), np.array(ny)
    nb = []
    for dx in (-0.5, 0, 0.5):
        for dy in (-0.5, 0, 0.5):
            nb.append(np.array([q[0] for q in src.sample(zip(ex + dx, ny + dy))], dtype=np.float64))
    nb = np.stack(nb)  # 9 x N
    ok = (nb != nod).all(axis=0) & valid.ravel()[idx]
    centre = nb[4]
    d = h.ravel()[idx][ok] - centre[ok]
    D.append(d); RNG.append(nb[:, ok].max(axis=0) - nb[:, ok].min(axis=0))
d = np.concatenate(D); r = np.concatenate(RNG)
big = np.abs(d) > 0.1001
unexplained = big & (np.abs(d) > r + 0.1001)
print(json.dumps({"kind": kind, "zoom": zoom, "tiles": len(tiles), "interior_px": int(d.size),
    "px_diff_gt_0.1m": int(big.sum()), "px_diff_gt_local_relief": int(unexplained.sum()),
    "frac_diff_gt_local_relief": float(unexplained.mean()),
    "median_local_relief_where_big": float(np.median(r[big])) if big.any() else None,
    "median_local_relief_overall": float(np.median(r)),
    "max_unexplained_diff": float(np.abs(d[unexplained]).max()) if unexplained.any() else 0.0}))
