#!/usr/bin/env python3
"""
地理院タイル (全国最新写真: seamlessphoto) から、対象範囲の航空写真を平面直角座標 (EPSG:6677, 原点相対) の
正方格子に再投影した地表テクスチャ data/ground.jpg を作る。リアル表示モードで地形メッシュに貼る。
出典: 地理院タイル (https://maps.gsi.go.jp/development/ichiran.html)
"""
import io, math, os, urllib.request
import numpy as np
from PIL import Image
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
WORK = os.environ.get("MM_WORK", "/tmp/mm")
GN = (-18292.7, -60134.6); BOX = (-1300, -1350, 1500, 1200)   # build_data.py と同じ
Z = 17; RES = 1.4   # m/px (出力)
URL = "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"

def main():
    pl2geo = Transformer.from_crs("EPSG:6677", "EPSG:4326", always_xy=True)
    W = int((BOX[2] - BOX[0]) / RES); H = int((BOX[3] - BOX[1]) / RES)
    xs = BOX[0] + (np.arange(W) + 0.5) * RES + GN[0]; ys = BOX[3] - (np.arange(H) + 0.5) * RES + GN[1]   # 行 0 = 北
    X, Y = np.meshgrid(xs, ys); lon, lat = pl2geo.transform(X, Y)
    n = 2 ** Z
    fx = (lon + 180) / 360 * n; fy = (1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * n
    tx = np.floor(fx).astype(int); ty = np.floor(fy).astype(int); px = ((fx - tx) * 256).astype(int); py = ((fy - ty) * 256).astype(int)
    out = np.zeros((H, W, 3), dtype=np.uint8); cache = {}
    os.makedirs(os.path.join(WORK, "photo"), exist_ok=True)
    for x in range(tx.min(), tx.max() + 1):
        for y in range(ty.min(), ty.max() + 1):
            fn = os.path.join(WORK, "photo", f"{Z}_{x}_{y}.jpg")
            if not os.path.exists(fn):
                try: open(fn, "wb").write(urllib.request.urlopen(urllib.request.Request(URL.format(z=Z, x=x, y=y), headers={"User-Agent": "minatomirai-3d/1.0"}), timeout=60).read())
                except Exception as e: open(fn, "wb").write(b"")
            if os.path.getsize(fn) > 0: cache[(x, y)] = np.array(Image.open(fn).convert("RGB"))
            else: cache[(x, y)] = np.full((256, 256, 3), 40, dtype=np.uint8)
            m = (tx == x) & (ty == y)
            if m.any(): out[m] = cache[(x, y)][py[m], px[m]]
    im = Image.fromarray(out)
    im.save(os.path.join(DATA, "ground.jpg"), "JPEG", quality=72, optimize=True, progressive=True)
    print("ground.jpg", im.size, os.path.getsize(os.path.join(DATA, "ground.jpg")), "bytes; tiles", len(cache))

if __name__ == "__main__":
    main()
