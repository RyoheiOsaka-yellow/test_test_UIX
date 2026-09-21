#!/usr/bin/env python3
"""出力ディレクトリのタイル集合を点検する。

- 各形式・各ズームの枚数
- mbtiles の metadata と、展開ディレクトリの枚数の一致
- z17 で RGB 系（フットプリント列挙）と gsidem（nodata 保持ラスタから生成）を比較する:
  gsidem にあって RGB 系に無いタイルがあれば tile_driver の絞り込みが漏れている
- RGB 系の最大ズームで、全画素が FILL_VALUE のタイルの枚数（無駄タイルの目安）
- PNG のサイズ（512 / 256）
"""
import os, sqlite3, sys, json, random
import numpy as np
from PIL import Image

out = sys.argv[1]
kinds = ["mapbox", "terrarium", "gsidem"]

def tiles(kind):
    s = {}
    root = os.path.join(out, kind)
    for z in sorted(os.listdir(root)):
        if not z.isdigit():
            continue
        s[int(z)] = set()
        for x in os.listdir(os.path.join(root, z)):
            for f in os.listdir(os.path.join(root, z, x)):
                if f.endswith(".png"):
                    s[int(z)].add((int(x), int(f[:-4])))
    return s

T = {k: tiles(k) for k in kinds}
res = {"counts": {k: {z: len(v) for z, v in T[k].items()} for k in kinds},
       "total": {k: sum(len(v) for v in T[k].values()) for k in kinds}}

for k in ("mapbox", "terrarium"):
    con = sqlite3.connect(os.path.join(out, f"{k}.mbtiles"))
    meta = dict(con.execute("select name, value from metadata"))
    n = con.execute("select count(*) from tiles").fetchone()[0]
    res[f"{k}_mbtiles"] = {"metadata": meta, "tiles_in_mbtiles": n}

# 共通ズームでの集合比較
common = sorted(set(T["mapbox"]) & set(T["gsidem"]))
cmp = {}
for z in common:
    a, g = T["mapbox"][z], T["gsidem"][z]
    cmp[z] = {"rgb": len(a), "gsidem": len(g), "gsidem_not_in_rgb": len(g - a), "rgb_not_in_gsidem": len(a - g)}
res["z_compare_mapbox_vs_gsidem"] = cmp
res["mapbox_vs_terrarium_identical_sets"] = all(T["mapbox"][z] == T["terrarium"].get(z) for z in T["mapbox"])

# 画像サイズ
for k in kinds:
    z = max(T[k]); x, y = next(iter(T[k][z]))
    im = Image.open(os.path.join(out, k, str(z), str(x), f"{y}.png"))
    res[f"{k}_png"] = {"size": im.size, "mode": im.mode}

# RGB 最大ズームで全画素 FILL(0) のタイル数（mapbox: 0m は RGB=(1,134,160)）
z = max(T["mapbox"])
flat = 0
for (x, y) in T["mapbox"][z]:
    a = np.asarray(Image.open(os.path.join(out, "mapbox", str(z), str(x), f"{y}.png")).convert("RGB"))
    v = a[..., 0].astype(np.int64) * 65536 + a[..., 1].astype(np.int64) * 256 + a[..., 2]
    if (v == 100000).all():
        flat += 1
res["mapbox_maxzoom_all_fill_tiles"] = flat
# gsidem 最大ズームで全画素無効のタイル数
z = max(T["gsidem"])
flat = 0
for (x, y) in T["gsidem"][z]:
    a = np.asarray(Image.open(os.path.join(out, "gsidem", str(z), str(x), f"{y}.png")).convert("RGB"))
    v = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    if (v == 2 ** 23).all():
        flat += 1
res["gsidem_maxzoom_all_nodata_tiles"] = flat
print(json.dumps(res, ensure_ascii=False, indent=1, default=str))
