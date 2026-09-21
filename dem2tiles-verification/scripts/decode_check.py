#!/usr/bin/env python3
"""dem2tiles の3形式のタイルを復号し、元 DEM（merged.tif / 図郭 GeoTIFF）と突き合わせる。

- mapbox    : h = -10000 + (R*65536 + G*256 + B) * 0.1
- terrarium : h = (R*256 + G + B/256) - 32768
- gsidem    : x = R<<16 | G<<8 | B ; x == 2^23 -> 無効 ; x < 2^23 -> x*0.01 ; x > 2^23 -> (x-2^24)*0.01

タイル画素中心の座標（EPSG:3857 -> 4326）で merged.tif を最近傍参照し、差の統計を出す。
"""
import argparse, math, os, random, sqlite3, sys, json
import numpy as np
from PIL import Image
import rasterio
from rasterio.warp import transform

R = 6378137.0

def tile_px_lonlat(z, x, y, size):
    """タイル内の全画素中心の経度緯度を返す (size x size)。"""
    n = 2 ** z
    px = (np.arange(size) + 0.5) / size
    lon = ((x + px) / n * 360.0) - 180.0
    lat_rad = np.arctan(np.sinh(np.pi * (1 - 2 * (y + px) / n)))
    lat = np.degrees(lat_rad)
    return np.meshgrid(lon, lat)  # lon[j,i], lat[j,i]

def decode(kind, arr):
    r = arr[..., 0].astype(np.int64); g = arr[..., 1].astype(np.int64); b = arr[..., 2].astype(np.int64)
    if kind == "mapbox":
        return -10000 + (r * 65536 + g * 256 + b) * 0.1, np.ones(r.shape, bool)
    if kind == "terrarium":
        return (r * 256 + g + b / 256.0) - 32768, np.ones(r.shape, bool)
    x = (r << 16) | (g << 8) | b
    h = np.where(x < 2 ** 23, x * 0.01, (x - 2 ** 24) * 0.01)
    valid = x != 2 ** 23
    return h, valid

def list_tiles(root, z):
    out = []
    zdir = os.path.join(root, str(z))
    if not os.path.isdir(zdir):
        return out
    for xs in os.listdir(zdir):
        for f in os.listdir(os.path.join(zdir, xs)):
            if f.endswith(".png"):
                out.append((z, int(xs), int(f[:-4])))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True)
    ap.add_argument("--kind", choices=["mapbox", "terrarium", "gsidem"], required=True)
    ap.add_argument("--zoom", type=int, required=True)
    ap.add_argument("--samples", type=int, default=40, help="調べるタイル数")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--nodata", type=float, default=-9999)
    ap.add_argument("--fill", type=float, default=0)
    args = ap.parse_args()

    tiles = list_tiles(os.path.join(args.output, args.kind), args.zoom)
    random.seed(args.seed)
    random.shuffle(tiles)
    tiles = tiles[: args.samples]
    merged = rasterio.open(os.path.join(args.output, "merged.tif"))

    diffs, diffs_int, n_valid_px, n_nodata_src, n_nodata_tile = [], [], 0, 0, 0
    mismatch_nodata = 0
    hmin, hmax = math.inf, -math.inf
    per_tile = []
    for (z, x, y) in tiles:
        img = np.asarray(Image.open(os.path.join(args.output, args.kind, str(z), str(x), f"{y}.png")).convert("RGB"))
        size = img.shape[0]
        h, valid = decode(args.kind, img)
        lon, lat = tile_px_lonlat(z, x, y, size)
        # サンプルを減らす（1タイルあたり最大 4096 画素）
        idx = np.random.default_rng(args.seed).choice(size * size, size=min(4096, size * size), replace=False)
        lo, la = lon.ravel()[idx], lat.ravel()[idx]
        src = np.array([v[0] for v in merged.sample(zip(lo, la))], dtype=np.float64)
        # 3x3 近傍（merged.tif の画素単位）がすべて有効な「内部」画素を求める
        rx, ry = merged.res
        interior = src != args.nodata
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nb = np.array([v[0] for v in merged.sample(zip(lo + dx * rx, la + dy * ry))], dtype=np.float64)
                interior &= nb != args.nodata
        hv = h.ravel()[idx]; vv = valid.ravel()[idx]
        src_nodata = src == args.nodata
        # 有効画素同士の差
        both = (~src_nodata) & vv
        d = hv[both] - src[both]
        diffs.append(d)
        di = hv[interior & vv] - src[interior & vv]
        diffs_int.append(di)
        n_valid_px += both.sum()
        n_nodata_src += src_nodata.sum()
        if args.kind == "gsidem":
            n_nodata_tile += (~vv).sum()
            mismatch_nodata += (src_nodata != ~vv).sum()
        else:
            # RGB 系は nodata が FILL_VALUE になっているはず
            fill_ok = np.isclose(hv[src_nodata], args.fill, atol=0.11)
            mismatch_nodata += (~fill_ok).sum()
        if both.any():
            hmin = min(hmin, hv[both].min()); hmax = max(hmax, hv[both].max())
            per_tile.append((z, x, y, float(np.abs(d).max()), float(np.abs(d).mean())))
    d = np.concatenate(diffs) if diffs else np.array([])
    di = np.concatenate(diffs_int) if diffs_int else np.array([])
    res = {
        "kind": args.kind, "zoom": args.zoom, "tiles": len(tiles), "sampled_px": int(n_valid_px + n_nodata_src),
        "valid_px": int(n_valid_px), "src_nodata_px": int(n_nodata_src),
        "tile_nodata_px": int(n_nodata_tile), "nodata_mismatch_px": int(mismatch_nodata),
        "abs_diff_max": float(np.abs(d).max()) if d.size else None,
        "abs_diff_mean": float(np.abs(d).mean()) if d.size else None,
        "abs_diff_p99": float(np.quantile(np.abs(d), 0.99)) if d.size else None,
        "frac_within_0.1m": float((np.abs(d) <= 0.1001).mean()) if d.size else None,
        "frac_within_0.5m": float((np.abs(d) <= 0.5).mean()) if d.size else None,
        "interior_px": int(di.size),
        "interior_abs_diff_max": float(np.abs(di).max()) if di.size else None,
        "interior_abs_diff_mean": float(np.abs(di).mean()) if di.size else None,
        "interior_frac_within_0.1m": float((np.abs(di) <= 0.1001).mean()) if di.size else None,
        "decoded_min": hmin if hmin != math.inf else None, "decoded_max": hmax if hmax != -math.inf else None,
    }
    print(json.dumps(res, ensure_ascii=False))
    worst = sorted(per_tile, key=lambda t: -t[3])[:3]
    for w in worst:
        print("  worst tile z/x/y=%d/%d/%d  max|d|=%.3f mean|d|=%.3f" % w, file=sys.stderr)

if __name__ == "__main__":
    main()
