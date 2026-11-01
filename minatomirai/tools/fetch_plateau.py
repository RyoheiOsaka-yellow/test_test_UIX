#!/usr/bin/env python3
"""
PLATEAU (横浜市 2024) の 3D Tiles / MVT から、みなとみらい周辺の必要タイルだけを取得する。
  建築物: 西区・中区 LOD3 (LOD3 がない建物は LOD2 が入っている "no_texture" 配信)
  橋梁:   市全域 LOD2 + ペデストリアンデッキ LOD3
  道路:   交通(道路)モデル LOD1 MVT (z=16)
取得先: PLATEAU VIEW データカタログ API (https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets)
出力先: $MM_WORK (既定 /tmp/mm) 配下。続けて decode_b3dm.js で Draco を展開する。
"""
import json, math, os, sys, urllib.request, concurrent.futures as cf

WORK = os.environ.get("MM_WORK", "/tmp/mm")
LON0, LON1, LAT0, LAT1 = 139.616, 139.650, 35.445, 35.470
CATALOG = "https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets"
TILESETS = {  # 出力ディレクトリ名: データセット ID
    "nishi_lod3": "14103_bldg_lod3_no_texture",
    "naka_lod3": "14104_bldg_lod3_no_texture",
    "brid_lod2": "14100_brid_lod2",
    "brid_lod3": "14100_brid_lod3",
}
MVT = "14100_tran_lod1"

def get(url, timeout=120):
    return urllib.request.urlopen(url, timeout=timeout).read()

def deg(r):
    return [math.degrees(v) for v in r[:4]]

def walk(tile, base, out, depth=0):
    bv = tile.get("boundingVolume", {})
    if "region" in bv:
        w, s, e, n = deg(bv["region"])
        if e < LON0 or w > LON1 or n < LAT0 or s > LAT1:
            return
    c = tile.get("content")
    children = tile.get("children", [])
    if c and not children:  # refine=REPLACE なので葉タイルのみ
        out.append(base + (c.get("uri") or c.get("url")))
    for ch in children:
        walk(ch, base, out, depth + 1)

def main():
    os.makedirs(WORK, exist_ok=True)
    cat_fn = os.path.join(WORK, "plateau_catalog.json")
    if not os.path.exists(cat_fn):
        open(cat_fn, "wb").write(get(CATALOG))
    cat = {x["id"]: x for x in json.load(open(cat_fn))["datasets"]}
    jobs = []
    for name, ds in TILESETS.items():
        url = cat[ds]["url"]; base = url.rsplit("/", 1)[0] + "/"
        ts = json.loads(get(url))
        out = []; walk(ts["root"], base, out)
        d = os.path.join(WORK, name); os.makedirs(d, exist_ok=True)
        print(f"{name}: {len(out)} leaf tiles")
        jobs += [(u, os.path.join(d, u.rsplit("/", 1)[1])) for u in out]
    def dl(j):
        u, fn = j
        if os.path.exists(fn) and os.path.getsize(fn) > 0: return "cached"
        try: open(fn, "wb").write(get(u, 300)); return "ok"
        except Exception as e: return f"ERR {e}"
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(dl, jobs))
    print("tiles:", {k: res.count(k) for k in set(res)})
    # 道路 MVT
    url = cat[MVT]["url"]; z = 16; n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    d = os.path.join(WORK, "tran"); os.makedirs(d, exist_ok=True)
    for x in range(tx(LON0), tx(LON1) + 1):
        for y in range(ty(LAT1), ty(LAT0) + 1):
            fn = os.path.join(d, f"{z}_{x}_{y}.mvt")
            if os.path.exists(fn): continue
            try: open(fn, "wb").write(get(url.replace("{z}", str(z)).replace("{x}", str(x)).replace("{y}", str(y))))
            except Exception: open(fn, "wb").write(b"")  # 海域などタイル無し
    print("mvt tiles:", len(os.listdir(d)))

if __name__ == "__main__":
    main()
