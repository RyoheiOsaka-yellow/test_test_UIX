#!/usr/bin/env python3
"""
OpenStreetMap の map API から、みなとみらい周辺の生データ (XML) を 4 分割で取得する。
(Overpass API はこの環境から到達できなかったため、本家 API の bbox 取得を利用。1 回あたり 50,000 ノード上限)
出力先: $MM_WORK/osm/*.xml
"""
import os, urllib.request

WORK = os.environ.get("MM_WORK", "/tmp/mm")
BOXES = [
    "139.616,35.445,139.633,35.4575", "139.633,35.445,139.650,35.4575",
    "139.616,35.4575,139.633,35.470", "139.633,35.4575,139.650,35.470",
]

def main():
    d = os.path.join(WORK, "osm"); os.makedirs(d, exist_ok=True)
    for b in BOXES:
        fn = os.path.join(d, "osm_" + b.replace(",", "_") + ".xml")
        if os.path.exists(fn) and os.path.getsize(fn) > 0:
            print("cached", fn); continue
        req = urllib.request.Request(f"https://api.openstreetmap.org/api/0.6/map?bbox={b}", headers={"User-Agent": "minatomirai-3d-map/1.0"})
        data = urllib.request.urlopen(req, timeout=300).read()
        open(fn, "wb").write(data); print("fetched", fn, len(data), "bytes")

if __name__ == "__main__":
    main()
